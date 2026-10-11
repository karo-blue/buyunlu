// 免广告卡：小程序端虚拟支付服务。
//
// 一句话说明职责：把「登录 → 下单 → 拉起支付 → 等服务端发货」这四步收成一个 Promise，
// 页面只关心「有没有卡」和「买没买到」。
//
// 重要：卡的数量以服务端为准，本地不存也不能存 —— 本地存的卡改了存档就能白嫖。
// 支付签名、AppKey、sessionKey 全部在服务端，这里拿不到也不需要。
//
// 交互口径（够用即止，别把用户绕晕）：
//   有卡 → 点免广告操作时直接扣一张卡，立刻给奖励，不播广告
//   无卡 → 走原来的激励视频流程

const { leaderboardApiBaseUrl } = require('./config');

const TOKEN_KEY = 'buyunlu_pay_token_v1';
const MIN_BASE_LIB = '2.19.2';
const IOS_MIN_WX_VERSION = '8.0.68';
// 支付成功后平台要推「发货推送」再到服务端入账，所以要轮询等一会儿
const DELIVER_WAIT_MS = 15000;
const DELIVER_POLL_MS = 1500;

// 官方错误码 → 人话。玩家不该看到 -15013 这种东西。
const ERROR_MESSAGES = {
  '-1': '支付未完成，请稍后重试',
  '-4': '本次支付被风控拦截，请稍后再试',
  '-5': '签约结果未知，请稍后在“我的”里查看',
  '-15001': '支付参数有误，请更新到最新版小程序',
  '-15002': '订单号重复，请重新发起购买',
  '-15005': '登录状态已失效，请重试',
  '-15006': '支付配置有误，请联系开发者',
  '-15007': '登录状态已过期，请重新打开小程序',
  '-15008': '收款资质还没配置完成',
  '-15010': '商品还没上架，请稍后再试',
  '-15011': '当前环境不支持该支付方式',
  '-15013': '商品价格不一致，请联系开发者',
  '-15014': '商品刚上架，约 10 分钟后可用',
  '-15017': '收款功能暂时受限，请稍后再试',
  '-15020': '操作太快了，请稍后再试',
  '-15021': '当前下单过于频繁，请稍后再试',
};

function compareVersion(left, right) {
  const a = String(left || '').split('.').map(value => parseInt(value, 10) || 0);
  const b = String(right || '').split('.').map(value => parseInt(value, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const x = a[index] || 0;
    const y = b[index] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function systemInfo() {
  try {
    return (typeof wx !== 'undefined' && wx.getSystemInfoSync && wx.getSystemInfoSync()) || {};
  } catch (error) {
    return {};
  }
}

// 基础库低于 2.19.2 时没有这个接口，直接判不可用，省得报错吓人
function isSupported() {
  if (typeof wx === 'undefined' || typeof wx.requestVirtualPayment !== 'function') return false;
  const info = systemInfo();
  if (info.SDKVersion && compareVersion(info.SDKVersion, MIN_BASE_LIB) < 0) {
    return typeof wx.canIUse === 'function' ? wx.canIUse('requestVirtualPayment') : false;
  }
  return true;
}

// iOS 端走 Apple IAP，微信客户端版本不够时拉起支付会失败，提前拦掉
function checkClientVersion() {
  const info = systemInfo();
  if (String(info.platform || '').toLowerCase() !== 'ios') return { ok: true };
  if (!info.version || compareVersion(info.version, IOS_MIN_WX_VERSION) >= 0) return { ok: true };
  return { ok: false, reason: `请先把微信更新到 ${IOS_MIN_WX_VERSION} 及以上版本，再用 iOS 购买` };
}

function isConfigured() {
  return !!leaderboardApiBaseUrl && typeof wx !== 'undefined' && typeof wx.request === 'function';
}

function readToken() {
  try { return String(wx.getStorageSync(TOKEN_KEY) || ''); } catch (error) { return ''; }
}

function writeToken(token) {
  try { token ? wx.setStorageSync(TOKEN_KEY, token) : wx.removeStorageSync(TOKEN_KEY); } catch (error) { /* 存不下就每次重登 */ }
}

function clearToken() { writeToken(''); }

function request(path, options = {}) {
  if (!isConfigured()) return Promise.reject(new Error('支付服务暂不可用'));
  const headers = { 'content-type': 'application/json' };
  const token = options.auth === false ? '' : (options.token || readToken());
  if (token) headers['x-session-token'] = token;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${leaderboardApiBaseUrl}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: headers,
      timeout: 10000,
      success(response) {
        const data = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && data.ok !== false) return resolve(data);
        const error = new Error(data.error || `支付请求失败(${response.statusCode})`);
        error.statusCode = response.statusCode;
        error.data = data;
        reject(error);
      },
      fail: () => reject(new Error('网络异常，请检查网络后重试')),
    });
  });
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || typeof wx.login !== 'function') return reject(new Error('当前环境不支持登录'));
    wx.login({
      success(result) { result && result.code ? resolve(result.code) : reject(new Error('登录失败，请重试')); },
      fail: () => reject(new Error('登录失败，请重试')),
    });
  });
}

// 换 token：openid 和 sessionKey 都留在服务端，本地只拿一个不透明 token
function login() {
  return (async () => {
    const code = await wxLogin();
    const result = await request('/pay/login', { method: 'POST', data: { code }, auth: false });
    writeToken(result.token);
    return result.token;
  })();
}

async function ensureToken(forceLogin = false) {
  if (!forceLogin) {
    const token = readToken();
    if (token) return token;
  }
  return login();
}

// 带自动重登的请求：token 过期（服务端返回 401）就重新登录再试一次
async function authedRequest(path, options = {}, retried = false) {
  const token = await ensureToken(retried);
  try {
    return await request(path, Object.assign({}, options, { token }));
  } catch (error) {
    if (error.statusCode === 401 && !retried) {
      clearToken();
      return authedRequest(path, options, true);
    }
    throw error;
  }
}

function fetchStatus() { return request('/pay/status', { auth: false }); }
function fetchBalance() { return authedRequest('/pay/balance'); }

// 「卡用完了」是正常业务结果，不是错误。
// 服务端会返回 200 + { ok:false, reason:'empty' }，而 request() 把 ok:false 统一当失败抛出，
// 这里把它翻回一个可判定的返回值，页面才能区分「没卡该降级播广告」和「接口真的挂了」。
function consume(scene) {
  return authedRequest('/pay/consume', { method: 'POST', data: { scene: String(scene || '') } })
    .catch(error => {
      const data = (error && error.data) || {};
      if (data.reason === 'empty') return { ok: false, reason: 'empty', balance: Number(data.balance) || 0 };
      throw error;
    });
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function payError(err) {
  const code = String((err && (err.errCode || err.errCode === 0 ? err.errCode : '')) || '');
  const message = ERROR_MESSAGES[code];
  const error = new Error(message || '支付未完成，请稍后重试');
  error.code = code;
  error.cancelled = code === '-2';
  error.sessionExpired = code === '-15007';
  return error;
}

function requestVirtualPayment(payData) {
  return new Promise((resolve, reject) => {
    wx.requestVirtualPayment({
      signData: payData.signData,
      paySig: payData.paySig,
      signature: payData.signature,
      mode: payData.mode || 'short_series_goods',
      success: resolve,
      fail: reject,
    });
  });
}

// 支付成功不代表已到账：平台的「发货推送」是异步的，所以要轮询余额。
// 超时不报错 —— 钱已经付了，卡随后会到，此时应该说"稍后到账"而不是"失败"。
async function waitForCards(previousBalance, options = {}) {
  const timeout = options.timeoutMs || DELIVER_WAIT_MS;
  const interval = options.pollMs || DELIVER_POLL_MS;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await delay(interval);
    try {
      const balance = await fetchBalance();
      if (Number(balance.balance) > Number(previousBalance || 0)) return { ok: true, balance: Number(balance.balance) };
    } catch (error) { /* 单次查询失败不算数，继续等 */ }
  }
  return { ok: false, pending: true };
}

// 完整购买流程。返回 { ok, balance, pending, cancelled, message, cards }
// options.quantity 是购买份数（一份 = 后台道具单价 × 1，对应发货 cardsPerUnit 张卡），
// 不传按 1 份处理；范围由服务端重新夹取，这里只是透传。
// options.timeoutMs / options.pollMs 用来调「等到账」的窗口（默认 15s / 1.5s），
// 正常调用不用传；网络慢的环境可以放宽，测试里可以压到毫秒级。
async function purchase(options = {}) {
  if (!isSupported()) return { ok: false, message: '当前微信版本不支持虚拟支付，请更新微信后再试' };
  const version = checkClientVersion();
  if (!version.ok) return { ok: false, message: version.reason };
  const quantity = Math.max(1, Math.min(1000, Math.floor(Number(options.quantity) || 1)));
  let before = 0;
  try { before = Number((await fetchBalance()).balance) || 0; } catch (error) { before = 0; }
  const order = await authedRequest('/pay/order', { method: 'POST', data: { quantity } });
  try {
    await requestVirtualPayment(order.payData);
  } catch (error) {
    const mapped = payError(error);
    // session_key 过期：清掉本地 token，下次点了会自动重登
    if (mapped.sessionExpired || mapped.code === '-15005') clearToken();
    if (mapped.cancelled) return { ok: false, cancelled: true, message: '已取消支付' };
    return { ok: false, message: mapped.message, code: mapped.code };
  }
  const waited = await waitForCards(before, options);
  if (waited.ok) return { ok: true, balance: waited.balance, cards: order.cards };
  return { ok: true, pending: true, cards: order.cards, message: `支付成功，${order.cards} 张免广告卡稍后到账` };
}

// 给页面用的一致性入口：拿卡数、判断能不能用卡
async function safeBalance() {
  try {
    const result = await fetchBalance();
    return { ok: true, balance: Number(result.balance) || 0, totalPurchased: Number(result.totalPurchased) || 0, totalConsumed: Number(result.totalConsumed) || 0 };
  } catch (error) {
    return { ok: false, balance: 0, error: error.message };
  }
}

module.exports = {
  TOKEN_KEY, MIN_BASE_LIB, IOS_MIN_WX_VERSION, ERROR_MESSAGES,
  compareVersion, isSupported, checkClientVersion, isConfigured,
  readToken, writeToken, clearToken,
  login, ensureToken, authedRequest, fetchStatus, fetchBalance, safeBalance, consume, purchase, waitForCards, payError,
};
