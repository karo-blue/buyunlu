// 小程序虚拟支付（道具直购）服务端。
//
// 为什么必须放在服务端：
//   1. 现网 AppKey 是密钥，只能进环境变量，绝不能下发到小程序端；
//   2. 用户态签名 signature 用 sessionKey 算，sessionKey 也只能留在服务端；
//   3. 「免广告卡」的余量必须服务端记账，存本地会被改存档白嫖。
//
// 配置全部走环境变量。缺任何一项 → enabled=false，支付接口返回 503，
// 小程序端自动隐藏购买入口，游戏其余部分完全不受影响（可安全先上线再补配置）。
//
// 需要的环境变量：
//   WX_APPID                 小程序 AppID
//   WX_APPSECRET             小程序密钥（用于 code2Session 和 access_token）
//   WX_XPAY_OFFER_ID         虚拟支付 OfferID
//   WX_XPAY_APP_KEY          现网 AppKey（支付签名密钥）
//   WX_XPAY_SANDBOX_APP_KEY  沙箱 AppKey（WX_XPAY_ENV=1 时才需要）
//   WX_XPAY_PRODUCT_ID       后台【道具管理】里的道具 ID
//   WX_MESSAGE_TOKEN         后台【消息推送】Token（明文模式签名校验）
//   WX_XPAY_GOODS_PRICE      道具单价，单位【分】，必须与后台价格完全一致（默认 100）
//   WX_XPAY_CARDS_PER_UNIT   一份道具发多少张卡（默认 10，即 1 元 10 张）
//   WX_XPAY_ENV              0 现网 / 1 沙箱（默认 0）
//   WX_PAY_DATA_FILE         数据文件路径（默认 server/data/virtual-pay.json）

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = 'https://api.weixin.qq.com';
// 服务端接口的签名 uri 口径在官方页面与部分示例之间有过出入（带不带前导斜杠），
// 报签名错误时我们会自动换另一种再试一次，见 queryOrder。
const QUERY_ORDER_URI = '/xpay/query_order';
const QUERY_ORDER_URI_ALT = 'xpay/query_order';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 会话 7 天，过期需重新 wx.login
// query_order 的订单状态枚举。官方文档把状态放在返回体的 order 子对象里，
// 只有这几个值代表"钱确实收到了"。
const ORDER_STATUS_PAID = [2, 3, 4]; // 2 已支付 3 已支付并结算 4 已发货
const ORDER_STATUS_UNPAID = [0, 1]; // 0 未创建/未支付 1 已创建未支付
// pending 订单的兜底查单有效期。虚拟支付的支付窗口很短，超时未付的单子
// 不可能再被支付，继续每隔 5 分钟查一次只是白白调微信接口（还会一直打日志）。
const PENDING_SWEEP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONSUMPTION_LOG_LIMIT = 200;
// 单笔最多 1000 份（按 0.1 元/份即 100 元）。客户端传来的数字一律不可信，
// 下单前必须用 normalizeQuantity 夹取范围，防手滑也防恶意参数。
const MAX_ORDER_QUANTITY = 1000;

// 任意输入 → 安全的购买份数（整数，1..MAX_ORDER_QUANTITY）
function normalizeQuantity(value) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count) || count < 1) return 1;
  return Math.min(count, MAX_ORDER_QUANTITY);
}

function loadConfig(env = process.env) {
  const text = key => String(env[key] == null ? '' : env[key]).trim();
  const appId = text('WX_APPID');
  const appSecret = text('WX_APPSECRET');
  const offerId = text('WX_XPAY_OFFER_ID');
  const appKey = text('WX_XPAY_APP_KEY');
  const sandboxAppKey = text('WX_XPAY_SANDBOX_APP_KEY');
  const productId = text('WX_XPAY_PRODUCT_ID');
  const messageToken = text('WX_MESSAGE_TOKEN');
  const payEnv = Number(env.WX_XPAY_ENV) === 1 ? 1 : 0;
  const price = Number(env.WX_XPAY_GOODS_PRICE);
  const perUnit = Number(env.WX_XPAY_CARDS_PER_UNIT);
  const config = {
    appId, appSecret, offerId, appKey, sandboxAppKey, productId, messageToken,
    goodsPrice: Number.isFinite(price) && price > 0 ? Math.floor(price) : 100,
    cardsPerUnit: Number.isFinite(perUnit) && perUnit > 0 ? Math.floor(perUnit) : 10,
    env: payEnv,
    // 会话 token 的签名密钥；不单独配就用 AppSecret 派生，少一个环境变量
    sessionSecret: text('WX_SESSION_SECRET') || appSecret,
    dataFile: text('WX_PAY_DATA_FILE') || path.join(__dirname, 'data', 'virtual-pay.json'),
  };
  const activeAppKey = payEnv === 1 ? sandboxAppKey : appKey;
  config.enabled = Boolean(appId && appSecret && offerId && activeAppKey && productId && messageToken);
  config.missing = [
    ['WX_APPID', appId], ['WX_APPSECRET', appSecret], ['WX_XPAY_OFFER_ID', offerId],
    [payEnv === 1 ? 'WX_XPAY_SANDBOX_APP_KEY' : 'WX_XPAY_APP_KEY', activeAppKey], ['WX_XPAY_PRODUCT_ID', productId],
    ['WX_MESSAGE_TOKEN', messageToken],
  ].filter(([, value]) => !value).map(([name]) => name);
  return config;
}

// ── 签名：官方两套，算法不同不要混用 ────────────────────────────────
// paySig    = HMAC-SHA256(AppKey, `${uri}&${postBody}`)
// signature = HMAC-SHA256(sessionKey, postBody)
// postBody 必须与实际发出的字符串逐字节一致（不格式化、不改键顺序）。
function hmacSha256Hex(key, data) {
  return crypto.createHmac('sha256', String(key)).update(String(data), 'utf8').digest('hex');
}

function calcPaySig(uri, postBody, appKey) {
  return hmacSha256Hex(appKey, `${uri}&${postBody}`);
}

function calcSignature(postBody, sessionKey) {
  return hmacSha256Hex(sessionKey, postBody);
}

// 微信消息推送明文模式：SHA1(sort(Token, timestamp, nonce)).
// GET 保存回调地址与后续 POST 推送都必须校验，不能只依赖报文内容。
function verifyMessageSignature(token, signature, timestamp, nonce) {
  if (!token || !signature || !timestamp || !nonce) return false;
  const expected = crypto.createHash('sha1')
    .update([String(token), String(timestamp), String(nonce)].sort().join(''), 'utf8')
    .digest('hex');
  const supplied = String(signature).toLowerCase();
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(supplied, 'utf8'));
}

// 业务单号：8-32 位，只允许数字/大小写字母与 _-|*@，不能以下划线开头。
function newOutTradeNo(now = Date.now()) {
  return `BYL${now.toString(36)}${crypto.randomBytes(5).toString('hex')}`.slice(0, 32);
}

// ── 极简 XML 取值：发货推送的字段名在同一份报文里唯一，正则足够 ──────
function xmlValue(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, 'i'));
  if (!match) return '';
  return String(match[1] == null ? match[2] : match[1]).trim();
}

// 退款推送的字段名在公开文档里没有固定下来，用候选名逐个试，
// 并额外把原始报文落盘，等第一笔真实退款到账后照着日志校准。
function xmlValueAny(xml, tags) {
  for (const tag of tags) {
    const value = xmlValue(xml, tag);
    if (value) return value;
  }
  return '';
}

function deliverNotifyResponse(errCode = 0, errMsg = 'success') {
  return `<xml><ErrCode>${Number(errCode) || 0}</ErrCode><ErrMsg><![CDATA[${String(errMsg)}]]></ErrMsg></xml>`;
}

// ── 仓储：和排行榜一样落 JSON 文件，写盘用临时文件 + rename ──────────
function createPayStore(dataFile) {
  let data = null;

  function emptyData() {
    return { sessions: {}, orders: {}, deliveredOrders: {}, cards: {}, refunds: {}, consumptions: [] };
  }

  function ensureLoaded() {
    if (data) return data;
    try {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      data = Object.assign(emptyData(), parsed && typeof parsed === 'object' ? parsed : {});
    } catch (error) {
      data = emptyData();
      persist();
    }
    ['sessions', 'orders', 'deliveredOrders', 'cards', 'refunds'].forEach(key => {
      if (!data[key] || typeof data[key] !== 'object') data[key] = {};
    });
    if (!Array.isArray(data.consumptions)) data.consumptions = [];
    return data;
  }

  function persist() {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    const temp = `${dataFile}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data), 'utf8');
    fs.renameSync(temp, dataFile);
  }

  // 读改写必须原子。这里的 mutator 全是同步函数，落盘也是同步的
  //（fs.writeFileSync + rename），Node 单线程下不会被别的请求插进来，所以直接跑完再返回。
  //
  // 注意：绝不要把 mutator 排到微任务里执行（早先写法是 writeChain.then(...)）。
  // 那样 createOrder 刚返回时订单还没写进去，紧接着的查单/发货就扑空；
  // 调用方也会拿到"已经返回但状态未生效"的假象。返回值包一层 Promise 只为保留 await 写法。
  function transact(mutator) {
    ensureLoaded();
    const result = mutator(data);
    persist();
    return Promise.resolve(result);
  }

  return { dataFile, ensureLoaded, persist, transact };
}

// ── query_order 返回体解析 ────────────────────────────────────────
// 微信返回的是 { errcode, errmsg, order: { order_id, status, wx_order_id, ... } }，
// 订单字段全部在 order 子对象里。早期版本按顶层 order_state / status 读，
// 永远读不到值，所有订单都被判成"未确认支付"，卡一张也发不出去。
// 这里统一从 order 里取，同时保留顶层兜底（兼容沙箱/灰度返回的扁平结构）。
function orderInfoOf(result) {
  if (!result || typeof result !== 'object') return {};
  const nested = result.order;
  if (nested && typeof nested === 'object') return nested;
  return result;
}

// 返回数字状态；取不到返回 null（表示"查单没给出结论"）
function orderStatusOf(result) {
  const info = orderInfoOf(result);
  const raw = info.status == null ? (info.order_state == null ? '' : info.order_state) : info.status;
  if (raw === '' || raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function createVirtualPayService(options = {}) {
  const config = options.config || loadConfig();
  const store = options.store || createPayStore(config.dataFile);
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const logger = options.logger || console;
  const now = options.now || (() => Date.now());
  let tokenCache = { value: '', expiresAt: 0 };

  const enabled = () => Boolean(config.enabled && fetchImpl);

  function masterKey() { return config.env === 1 ? config.sandboxAppKey : config.appKey; }

  function walletOf(data, openid) {
    if (!data.cards[openid]) data.cards[openid] = { balance: 0, totalPurchased: 0, totalConsumed: 0, updatedAt: new Date(now()).toISOString() };
    return data.cards[openid];
  }

  async function getJson(url) {
    const response = await fetchImpl(url, { method: 'GET' });
    const text = await response.text();
    try { return JSON.parse(text); } catch (error) { throw new Error(`微信接口返回非 JSON：${text.slice(0, 200)}`); }
  }

  async function postJson(url, body) {
    const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const text = await response.text();
    try { return JSON.parse(text); } catch (error) { throw new Error(`微信接口返回非 JSON：${text.slice(0, 200)}`); }
  }

  // access_token 有效期 7200 秒，提前 5 分钟过期，避免边界失败
  async function getAccessToken(force = false) {
    const stamp = now();
    if (!force && tokenCache.value && tokenCache.expiresAt > stamp) return tokenCache.value;
    const url = `${API_BASE}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}`;
    const result = await getJson(url);
    if (!result.access_token) throw new Error(`获取 access_token 失败：${result.errcode || ''} ${result.errmsg || ''}`.trim());
    tokenCache = { value: result.access_token, expiresAt: stamp + (Number(result.expires_in || 7200) - 300) * 1000 };
    return tokenCache.value;
  }

  async function code2Session(code) {
    const url = `${API_BASE}/sns/jscode2session?appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const result = await getJson(url);
    if (!result.openid || !result.session_key) throw new Error(`登录凭证校验失败：${result.errcode || ''} ${result.errmsg || ''}`.trim());
    return { openid: result.openid, sessionKey: result.session_key };
  }

  // 登录：换 openid + sessionKey，签一个我们自己的 token 给小程序端存
  async function login(code) {
    if (!enabled()) return { ok: false, error: 'disabled' };
    if (!code || typeof code !== 'string') return { ok: false, error: 'code is required' };
    const session = await code2Session(code);
    const token = crypto.randomBytes(24).toString('hex');
    const stamp = now();
    store.transact(data => {
      Object.entries(data.sessions).forEach(([key, value]) => {
        if (!value || stamp - Number(value.updatedAt || 0) > SESSION_TTL_MS) delete data.sessions[key];
      });
      data.sessions[token] = { openid: session.openid, sessionKey: session.sessionKey, updatedAt: stamp };
      walletOf(data, session.openid);
    });
    return { ok: true, token, openid: session.openid };
  }

  function resolveSession(token) {
    if (!token) return null;
    const data = store.ensureLoaded();
    const session = data.sessions[token];
    if (!session) return null;
    if (now() - Number(session.updatedAt || 0) > SESSION_TTL_MS) return null;
    return session;
  }

  function balanceOf(openid) {
    const data = store.ensureLoaded();
    const wallet = walletOf(data, openid);
    return { balance: wallet.balance, totalPurchased: wallet.totalPurchased, totalConsumed: wallet.totalConsumed };
  }

  // 下单：生成 signData 字符串并签名，小程序端拿到后直接喂给 wx.requestVirtualPayment
  // quantity 是买几「份」道具（一份 = cardsPerUnit 张卡），支付金额 = goodsPrice × quantity。
  // 服务端必须重新夹取范围：客户端传来的数字一律不可信。
  function createOrder(session, rawQuantity) {
    const quantity = normalizeQuantity(rawQuantity);
    const outTradeNo = newOutTradeNo(now());
    // 键顺序固定，签名的字符串就是发出去的字符串
    const signData = JSON.stringify({
      offerId: config.offerId,
      buyQuantity: quantity,
      env: config.env,
      currencyType: 'CNY',
      productId: config.productId,
      goodsPrice: config.goodsPrice,
      outTradeNo,
      attach: 'buyunlu-adcard',
    });
    const paySig = calcPaySig('requestVirtualPayment', signData, masterKey());
    const signature = calcSignature(signData, session.sessionKey);
    store.transact(data => {
      data.orders[outTradeNo] = {
        openid: session.openid, productId: config.productId, quantity, goodsPrice: config.goodsPrice,
        status: 'pending', createdAt: new Date(now()).toISOString(), wxOrderId: '', attach: 'buyunlu-adcard',
      };
    });
    return {
      ok: true,
      outTradeNo,
      payData: { signData, paySig, signature, mode: 'short_series_goods' },
      quantity,
      cards: quantity * config.cardsPerUnit,
      goodsPrice: config.goodsPrice,
    };
  }

  function cardsForQuantity(quantity) {
    const count = Number(quantity);
    const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
    return safe * config.cardsPerUnit;
  }

  // 发货：以微信侧单号 wx_order_id 幂等，重复通知只发一次
  function deliver({ openid, productId, quantity, wxOrderId, outTradeNo, source }) {
    return store.transact(data => {
      const order = outTradeNo ? data.orders[outTradeNo] : null;
      if (wxOrderId && data.deliveredOrders[wxOrderId]) return { ok: true, duplicate: true, reason: 'wx_order_id', openid, cards: 0 };
      if (order && order.status === 'delivered') return { ok: true, duplicate: true, reason: 'order_status', openid, cards: 0 };
      if (!openid) return { ok: false, error: 'openid is required' };
      if (productId && config.productId && productId !== config.productId) return { ok: false, error: 'unknown productId' };
      const cards = cardsForQuantity(quantity);
      const wallet = walletOf(data, openid);
      wallet.balance += cards;
      wallet.totalPurchased += cards;
      wallet.updatedAt = new Date(now()).toISOString();
      if (order) {
        order.status = 'delivered';
        order.wxOrderId = wxOrderId || '';
        order.cards = cards;
        order.deliveredAt = new Date(now()).toISOString();
        order.deliveredBy = source || 'notify';
      }
      if (wxOrderId) data.deliveredOrders[wxOrderId] = outTradeNo || '';
      return { ok: true, duplicate: false, openid, cards, balance: wallet.balance };
    });
  }

  // 查单：口径有带不带前导斜杠两种说法，签名错就换一种再试
  async function queryOrder({ openid, orderId }) {
    const body = JSON.stringify({ openid, env: config.env, order_id: orderId });
    const accessToken = await getAccessToken();
    const attempt = async uri => {
      const paySig = calcPaySig(uri, body, masterKey());
      const result = await postJson(`${API_BASE}${uri.startsWith('/') ? '' : '/'}${uri}?access_token=${encodeURIComponent(accessToken)}&pay_sig=${paySig}`, body);
      return result;
    };
    let result = await attempt(QUERY_ORDER_URI);
    if (result && result.errcode && /sign|签名/i.test(String(result.errmsg || ''))) {
      logger.warn && logger.warn('[xpay] query_order 签名被拒，改用无前导斜杠的 uri 重试');
      result = await attempt(QUERY_ORDER_URI_ALT);
    }
    // 查单失败一定要留痕：这条日志是判断"微信侧到底返回了什么"的唯一依据
    if (!result || Number(result.errcode || 0) !== 0) {
      logger.warn && logger.warn('[xpay] query_order 返回错误码', String(result && result.errcode), String(result && result.errmsg).slice(0, 160));
    }
    return result;
  }

  // 判断查单结果是否已支付成功。状态一律按 order.status 读（见 orderInfoOf）。
  function isPaidOrder(result) {
    if (!result || Number(result.errcode || 0) !== 0) return false;
    const status = orderStatusOf(result);
    if (status != null) return ORDER_STATUS_PAID.includes(status);
    const info = orderInfoOf(result);
    const text = String(info.order_state == null ? (info.status == null ? '' : info.status) : info.order_state);
    return /paid|success|已支付|支付成功/i.test(text);
  }

  // 明确未支付。与"查不出结论"是两回事：只有这个状态才敢直接拒绝发货。
  function isUnpaidOrder(result) {
    if (!result || Number(result.errcode || 0) !== 0) return false;
    const status = orderStatusOf(result);
    return status != null && ORDER_STATUS_UNPAID.includes(status);
  }

  // 发货推送处理：解析 → 查单核实 → 幂等发货。
  //
  // 查单在这里的角色是"兜底 + 留痕"，不是发货的门槛：
  // 官方口径是「发货以发货推送为主，推送丢失时才用 query_order 补发」。
  // 推送本身已经过 Token 签名校验（app.js 传入 verified:true），伪造者拿不到 Token；
  // 而 query_order 的状态同步最长会滞后几十分钟，拿它当门槛就是让已付款的用户干等。
  // 所以只有"查单明确说未支付"且"这条推送没验签"时才拒发。
  async function handleDeliverNotify(xml, options2 = {}) {
    if (!enabled()) return { ok: false, errCode: 1, errMsg: 'disabled' };
    logRawNotify('deliver', xml);
    const event = xmlValue(xml, 'Event');
    const openid = xmlValue(xml, 'OpenId');
    const outTradeNo = xmlValue(xml, 'OutTradeNo');
    let wxOrderId = xmlValue(xml, 'MchOrderNo');
    const productId = xmlValue(xml, 'ProductId');
    const quantity = Number(xmlValue(xml, 'Quantity') || 1);
    if (event && event !== 'xpay_goods_deliver_notify') return { ok: true, errCode: 0, errMsg: 'ignored', ignored: true };
    if (!openid || !outTradeNo) return { ok: false, errCode: 1, errMsg: 'missing openid or outTradeNo' };
    const already = store.ensureLoaded().deliveredOrders[wxOrderId];
    if (wxOrderId && already) return { ok: true, errCode: 0, errMsg: 'success', duplicate: true };
    if (options2.skipVerify !== true) {
      const result = await queryOrder({ openid, orderId: outTradeNo });
      const info = orderInfoOf(result);
      // 查单给的是权威微信单号，优先级高于推送报文里的（推送里可能压根没有）
      const confirmed = String(info.wx_order_id || '');
      if (confirmed) wxOrderId = confirmed;
      if (isPaidOrder(result)) {
        // 查单与推送一致，最稳的一条路
      } else if (options2.verified === true) {
        // 推送已经过 Token 签名校验（Token 只有微信和服务端持有，不下发到小程序），
        // 而 query_order 的状态同步官方已知存在延迟，社区反馈最长可达 40 分钟。
        // 这时若硬性等查单，用户就是"付了钱、卡迟迟不到账"。
        logger.warn && logger.warn('[xpay] 查单未确认支付，但推送已验签，按微信的发货通知放行', outTradeNo, orderStatusOf(result), JSON.stringify(result).slice(0, 200));
      } else if (isUnpaidOrder(result)) {
        logger.warn && logger.warn('[xpay] 查单显示订单未支付，拒绝发货', outTradeNo, orderStatusOf(result));
        return { ok: false, errCode: 1, errMsg: 'order not paid' };
      } else {
        logger.warn && logger.warn('[xpay] 发货推送对应的订单未确认支付，等待平台重试', outTradeNo, result && result.errcode);
        return { ok: false, errCode: 1, errMsg: 'order not confirmed' };
      }
    }
    const outcome = await deliver({ openid, productId, quantity, wxOrderId, outTradeNo, source: 'notify' });
    if (!outcome.ok) return { ok: false, errCode: 1, errMsg: outcome.error || 'deliver failed' };
    return { ok: true, errCode: 0, errMsg: 'success', ...outcome };
  }

  // 兜底查单：发货推送可能丢（平台重试 15 次后放弃），定时补发
  async function sweepPending(limit = 20) {
    if (!enabled()) return { ok: false, error: 'disabled', checked: 0, delivered: 0 };
    const data = store.ensureLoaded();
    const cutoff = now() - PENDING_SWEEP_TTL_MS;
    const all = Object.entries(data.orders).filter(([, order]) => order.status === 'pending');
    // 时间解析不出来的老数据照查（保守），只对明确超龄的停手
    const pending = all
      .filter(([, order]) => {
        const created = Date.parse(String(order.createdAt || ''));
        return !Number.isFinite(created) || created >= cutoff;
      })
      .sort((left, right) => String(left[1].createdAt).localeCompare(String(right[1].createdAt)))
      .slice(0, limit);
    let delivered = 0;
    for (const [outTradeNo, order] of pending) {
      try {
        const result = await queryOrder({ openid: order.openid, orderId: outTradeNo });
        if (!isPaidOrder(result)) continue;
        // wx_order_id 同样在 order 子对象里，取不到就退回微信支付交易单号
        const info = orderInfoOf(result);
        const wxOrderId = String(info.wx_order_id || info.wxpay_order_id || result.wx_order_id || '');
        const outcome = await deliver({ openid: order.openid, productId: order.productId, quantity: order.quantity, wxOrderId, outTradeNo, source: 'sweep' });
        if (outcome.ok && !outcome.duplicate) delivered += 1;
      } catch (error) {
        logger.warn && logger.warn('[xpay] 兜底查单失败', outTradeNo, error.message);
      }
    }
    return { ok: true, checked: pending.length, delivered, stale: all.length - pending.length };
  }

  // 退款推送：把已经发出去的卡按退款份数扣回来。
  // 字段名口径不固定，所以金额→份数这条推导为主（refund_fee 在 refund_order 接口里是分），
  // 同时把原始报文落盘，第一笔真实退款之后照着日志校准。
  function logRawNotify(kind, payload) {
    try {
      const file = path.join(path.dirname(config.dataFile), 'notify-raw.log');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${new Date(now()).toISOString()}\t${kind}\t${String(payload).replace(/\s+/g, ' ')}\n`, 'utf8');
    } catch (error) { /* 日志写不进去不能影响主流程 */ }
  }

  // 幂等键：优先用退款单号，没有就用 业务单号+退款金额
  function reverseDeliveredOrder({ outTradeNo, refundFee, refundOrderId, source }) {
    return store.transact(data => {
      const order = outTradeNo ? data.orders[outTradeNo] : null;
      if (!order) return { ok: false, error: 'order not found', outTradeNo };
      const refundedPerUnit = config.cardsPerUnit;
      // 按退款金额反推退了几份；算不出来就按整单退回
      const fee = Number(refundFee);
      const units = Number.isFinite(fee) && fee > 0 && config.goodsPrice > 0
        ? Math.max(1, Math.round(fee / config.goodsPrice))
        : (Number(order.quantity) || 1);
      const cards = units * refundedPerUnit;
      const key = refundOrderId || `${outTradeNo}:${cards}`;
      if (data.refunds[key]) return { ok: true, duplicate: true, reason: 'already_reversed', openid: order.openid, cards: 0 };
      const wallet = walletOf(data, order.openid);
      // 已经消耗掉的卡退不回来，余额扣到 0 为止（欠账不记负数）
      const deducted = Math.min(wallet.balance, cards);
      wallet.balance -= deducted;
      wallet.updatedAt = new Date(now()).toISOString();
      data.refunds[key] = { outTradeNo, openid: order.openid, cards, deducted, at: new Date(now()).toISOString(), source: source || 'refund_notify' };
      order.status = 'refunded';
      order.refundedAt = new Date(now()).toISOString();
      order.refundedCards = cards;
      return { ok: true, duplicate: false, openid: order.openid, cards, deducted, balance: wallet.balance };
    });
  }

  // 退款推送处理：解析 → 回查订单确认退款 → 反向扣卡。
  // 同样不信推送内容本身，一律以 query_order 的结果为准。
  async function handleRefundNotify(xml, options3 = {}) {
    if (!enabled()) return { ok: false, errCode: 1, errMsg: 'disabled' };
    const event = xmlValue(xml, 'Event');
    const outTradeNo = xmlValueAny(xml, ['OutTradeNo', 'Out_Trade_No', 'out_trade_no']);
    const openid = xmlValueAny(xml, ['OpenId', 'Openid', 'openid']);
    const refundFee = xmlValueAny(xml, ['RefundFee', 'Refund_Fee', 'refund_fee', 'TotalFee']);
    const refundOrderId = xmlValueAny(xml, ['RefundOrderId', 'Refund_Order_Id', 'refund_order_id', 'MchRefundNo']);
    logRawNotify('refund', xml);
    if (event && event !== 'xpay_refund_notify') return { ok: true, errCode: 0, errMsg: 'ignored', ignored: true };
    if (!outTradeNo) return { ok: false, errCode: 1, errMsg: 'missing outTradeNo' };
    const order = store.ensureLoaded().orders[outTradeNo];
    if (!order) {
      logger.warn && logger.warn('[xpay] 退款推送找不到对应订单，已记录原始报文待人工核对', outTradeNo);
      return { ok: false, errCode: 1, errMsg: 'order not found' };
    }
    if (order.status === 'refunded') return { ok: true, errCode: 0, errMsg: 'success', duplicate: true };
    if (options3.skipVerify !== true) {
      const result = await queryOrder({ openid: order.openid, orderId: outTradeNo });
      const info = orderInfoOf(result);
      const leftFee = info.left_fee == null ? result.left_fee : info.left_fee;
      const refunded = result && Number(result.errcode || 0) === 0
        && (Number(leftFee) === 0 || /refund/i.test(String(info.refund_state || info.refund_status || result.refund_state || '')));
      // 查不到确凿的退款结论时不动余额，交给平台重试
      if (!refunded) {
        logger.warn && logger.warn('[xpay] 退款推送未能确认退款状态，等待平台重试', outTradeNo);
        return { ok: false, errCode: 1, errMsg: 'refund not confirmed' };
      }
    }
    const outcome = await reverseDeliveredOrder({ outTradeNo, refundFee, refundOrderId, source: 'refund_notify' });
    if (!outcome.ok) return { ok: false, errCode: 1, errMsg: outcome.error || 'reverse failed' };
    return { ok: true, errCode: 0, errMsg: 'success', ...outcome };
  }

  // 消息推送只有一个回调 URL，按 Event 分发。
  // 未知事件一律回成功，避免平台对我们不认识的事件重试 15 次。
  // options.verified 由调用方在**校验过 Token 签名之后**传入，只有它能让
  // "查单没结论"这一档放行发货（理由见 handleDeliverNotify 里的注释）。
  async function handleNotify(xml, options4 = {}) {
    const event = xmlValue(xml, 'Event');
    if (event === 'xpay_refund_notify') return handleRefundNotify(xml, options4);
    if (event === 'xpay_goods_deliver_notify' || !event) return handleDeliverNotify(xml, options4);
    logRawNotify(`other:${event}`, xml);
    return { ok: true, errCode: 0, errMsg: 'success', ignored: true };
  }

  // 扣卡：读改写同步完成，一次只扣一张，不出现负数
  function consume(openid, scene = '') {
    const data = store.ensureLoaded();
    const wallet = walletOf(data, openid);
    if (wallet.balance <= 0) return Promise.resolve({ ok: false, reason: 'empty', balance: 0 });
    return store.transact(local => {
      const target = walletOf(local, openid);
      if (target.balance <= 0) return { ok: false, reason: 'empty', balance: 0 };
      target.balance -= 1;
      target.totalConsumed += 1;
      target.updatedAt = new Date(now()).toISOString();
      local.consumptions.unshift({ openid, scene: String(scene || '').slice(0, 40), at: new Date(now()).toISOString() });
      if (local.consumptions.length > CONSUMPTION_LOG_LIMIT) local.consumptions.length = CONSUMPTION_LOG_LIMIT;
      return { ok: true, balance: target.balance };
    });
  }

  function status() {
    return {
      enabled: enabled(),
      missing: config.missing,
      env: config.env,
      productId: config.productId,
      goodsPrice: config.goodsPrice,
      cardsPerUnit: config.cardsPerUnit,
    };
  }

  return { config, store, status, enabled, login, resolveSession, balanceOf, createOrder, deliver, queryOrder, isPaidOrder, isUnpaidOrder, handleDeliverNotify, handleRefundNotify, handleNotify, reverseDeliveredOrder, sweepPending, consume, cardsForQuantity };
}

module.exports = {
  loadConfig, createPayStore, createVirtualPayService,
  hmacSha256Hex, calcPaySig, calcSignature, newOutTradeNo,
  verifyMessageSignature, xmlValue, xmlValueAny, deliverNotifyResponse, QUERY_ORDER_URI, SESSION_TTL_MS,
  orderInfoOf, orderStatusOf, ORDER_STATUS_PAID, ORDER_STATUS_UNPAID,
};
