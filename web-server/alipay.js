'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { AlipaySdk } = require('alipay-sdk');
const fail = (status, message) => Object.assign(new Error(message), { status });
const PRICE_FEN = 100;
const CARDS_PER_UNIT = 10;
const ORDER_AGE = 30 * 60 * 1000;
const GATEWAYS = { live: 'https://openapi.alipay.com/gateway.do', sandbox: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do' };
const money = fen => (fen / 100).toFixed(2);
function fen(value) {
  if (typeof value !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) throw fail(400, '支付金额格式错误');
  const [whole, cents = ''] = value.split('.');
  return Number(whole) * 100 + Number(cents.padEnd(2, '0'));
}
function loadAlipayConfig(env = process.env) {
  const enabled = env.H5_ALIPAY_ENABLED === '1';
  const value = key => String(env['H5_ALIPAY_' + key] || '').trim();
  const material = key => value(key + '_FILE') ? fs.readFileSync(value(key + '_FILE'), 'utf8') : value(key).replace(/\\n/g, '\n');
  const config = { enabled, appId: value('APP_ID'), sellerId: value('SELLER_ID'), sandbox: value('SANDBOX') === '1',
    privateKey: material('PRIVATE_KEY'), alipayPublicKey: material('PUBLIC_KEY'), keyType: value('KEY_TYPE') || 'PKCS8',
    modes: value('MODES').split(',').map(item => item.trim()).filter(Boolean),
    testUsernames: value('TEST_USERS').split(',').map(item => item.trim()).filter(Boolean),
    appCertPath: value('APP_CERT_FILE'), alipayPublicCertPath: value('PUBLIC_CERT_FILE'), alipayRootCertPath: value('ROOT_CERT_FILE') };
  const certificates = config.appCertPath && config.alipayPublicCertPath && config.alipayRootCertPath;
  config.configured = !!(/^\d{16}$/.test(config.appId) && /^2088\d{12}$/.test(config.sellerId) && config.privateKey && (config.alipayPublicKey || certificates));
  if (enabled && (!config.configured || !config.modes.length || config.modes.some(mode => !['page', 'wap'].includes(mode)))) throw new Error('支付宝配置不完整，请检查外置支付配置');
  return config;
}
function createPayments(options) {
  const { dataDir, origin } = options;
  const basePath = options.basePath || '/';
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)) throw new Error('支付网站路径无效');
  const frontend = new URL(options.frontendUrl || origin + basePath);
  if (!(frontend.protocol === 'https:' || frontend.protocol === 'http:' && ['localhost','127.0.0.1'].includes(frontend.hostname)) || frontend.username || frontend.password || frontend.search || frontend.hash || !frontend.pathname.endsWith('/')) throw new Error('支付返回地址无效');
  const config = options.config || loadAlipayConfig();
  if (!/^https:\/\//.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) throw new Error('支付宝回调需要可信站点地址');
  const gateway = GATEWAYS[config.sandbox ? 'sandbox' : 'live'];
  const now = options.now || Date.now;
  const file = path.join(dataDir, 'payments.json');
  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (cause) { if (cause.code !== 'ENOENT') throw cause; ledger = { version: 1, orders: {}, wallets: {}, consumed: {} }; }
  if (ledger.version !== 1 || !ledger.orders || !ledger.wallets || !ledger.consumed || [ledger.orders, ledger.wallets, ledger.consumed].some(Array.isArray)
    || Object.values(ledger.wallets).some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('支付账本损坏，拒绝启动');
  const environment = config.sandbox ? 'sandbox' : 'live';
  if (ledger.environment && ledger.environment !== environment) throw new Error('沙箱与正式支付必须使用独立数据目录');
  const configured = config.configured ?? !!(config.appId && config.sellerId && config.privateKey && (config.alipayPublicKey || config.appCertPath));
  const sdk = options.sdk || (configured ? new AlipaySdk({ appId: config.appId, privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey || undefined, keyType: config.keyType || 'PKCS8', signType: 'RSA2', gateway,
    endpoint: new URL(gateway).origin, timeout: 8000,
    ...(config.appCertPath ? { appCertPath: config.appCertPath, alipayPublicCertPath: config.alipayPublicCertPath, alipayRootCertPath: config.alipayRootCertPath } : {}) }) : null);
  if (sdk && !options.sdk) {
    const privateKey = crypto.createPrivateKey(sdk.config.privateKey), publicKey = crypto.createPublicKey(sdk.config.alipayPublicKey);
    if ([privateKey, publicKey].some(key => key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048)) throw new Error('支付宝需要2048位及以上RSA2密钥');
  }
  function mutate(change) {
    const next = structuredClone(ledger);
    next.environment = environment;
    const result = change(next);
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const temp = file + '.tmp';
    if (options.write) options.write(temp, JSON.stringify(next));
    else fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
    fs.renameSync(temp, file);
    ledger = next;
    return result;
  }
  function owned(user, id) {
    const order = /^[A-Za-z0-9]{20,64}$/.test(id || '') && ledger.orders[id];
    if (!order || order.userId !== user.id) throw fail(404, '订单不存在');
    return order;
  }
  function enabled() { return !!(config.enabled && sdk && config.modes?.length); }
  const testOnly = !!config.testUsernames?.length;
  const allowed = user => !testOnly || !!(user?.emailVerified && config.testUsernames.includes(user.username));
  function payUrl(order) {
    if (!enabled() || order.state !== 'pending' || order.expiresAt <= now()) return null;
    const time = new Date(order.expiresAt + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    return sdk.pageExecute(order.mode === 'wap' ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay', 'GET', {
      notifyUrl: origin + basePath + 'api/pay/alipay/notify', returnUrl: frontend.href + 'checkout.html?order=' + order.id,
      bizContent: { out_trade_no: order.id, total_amount: money(order.amountFen), subject: '步云录概率卡 · ' + order.cards + '张',
        product_code: order.mode === 'wap' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY', seller_id: config.sellerId,
        time_expire: time, ...(order.mode === 'wap' ? { quit_url: frontend.href + 'checkout.html?order=' + order.id } : {}) }
    });
  }
  function view(order) {
    return { id: order.id, amount: money(order.amountFen), cards: order.cards, quantity: order.quantity,
      state: order.state === 'pending' && order.expiresAt <= now() ? 'expired' : order.state,
      createdAt: order.createdAt, expiresAt: order.expiresAt, payUrl: payUrl(order), sandbox: !!config.sandbox };
  }
  const validRequest = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
  function applyTrade(data, notification = false) {
    if (notification && (data.app_id !== config.appId || data.seller_id !== config.sellerId)) throw fail(400, '支付商户不匹配');
    const order = ledger.orders[data.out_trade_no];
    if (!order || order.appId !== config.appId || order.sellerId !== config.sellerId || fen(data.total_amount) !== order.amountFen) throw fail(400, '支付订单或金额不匹配');
    if (data.seller_id && data.seller_id !== config.sellerId) throw fail(400, '支付商户不匹配');
    const paid = ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(data.trade_status);
    if (paid) {
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(data.trade_no || '')) throw fail(400, '支付交易号无效');
      if (Object.values(ledger.orders).some(item => item.id !== order.id && item.tradeNo === data.trade_no) || (order.tradeNo && order.tradeNo !== data.trade_no)) throw fail(400, '支付交易号不匹配');
      if (order.state === 'paid') return;
      mutate(next => {
        next.orders[order.id] = { ...order, state: 'paid', tradeNo: data.trade_no, paidAt: now() };
        const balance = (next.wallets[order.userId] || 0) + order.cards;
        if (!Number.isSafeInteger(balance)) throw fail(409, '概率卡余额超出范围');
        next.wallets[order.userId] = balance;
      });
    } else if (data.trade_status === 'TRADE_CLOSED' && order.state !== 'paid' && order.state !== 'closed') mutate(next => { next.orders[order.id].state = 'closed'; });
    else if (!['WAIT_BUYER_PAY', 'TRADE_CLOSED'].includes(data.trade_status)) throw fail(400, '支付状态无效');
  }
  return {
    status: user => ({ ok: true, enabled: enabled() && allowed(user), channels: enabled() && allowed(user) ? ['alipay'] : [], modes: enabled() && allowed(user) ? config.modes : [], testOnly,
      sandbox: !!config.sandbox, cardsPerUnit: CARDS_PER_UNIT, priceFen: PRICE_FEN, price: money(PRICE_FEN),
      reason: enabled() && allowed(user) ? '' : testOnly ? '当前仅开放指定账号的1元购买验证' : '支付宝支付尚未开通，当前不会创建订单或扣款' }),
    balance: user => ledger.wallets[user.id] || 0,
    createOrder(user, body) {
      if (body.accountId !== undefined && body.accountId !== user.id) throw fail(409, '登录账号已变化，请刷新页面核对账号后重试');
      if (!enabled()) throw fail(503, '支付宝支付尚未开通');
      if (!allowed(user)) throw fail(403, '当前仅供指定测试账号购买');
      if (testOnly && body.quantity !== 1) throw fail(400, '本次验证仅支持1元购买10张');
      if (user.emailVerified !== true) throw fail(403, '请先完成邮箱验证');
      if (!validRequest(body.requestId)) throw fail(400, '下单请求标识无效');
      if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100) throw fail(400, '购买数量必须为1～100份');
      if (!config.modes.includes(body.mode)) throw fail(400, '此支付方式尚未开通');
      const previous = Object.values(ledger.orders).find(order => order.userId === user.id && order.requestId === body.requestId);
      if (previous) {
        if (previous.quantity !== body.quantity || previous.mode !== body.mode) throw fail(409, '重复请求的商品不一致');
        return view(previous);
      }
      const order = { id: 'BYL' + crypto.randomBytes(18).toString('hex'), userId: user.id, requestId: body.requestId,
        quantity: body.quantity, amountFen: body.quantity * PRICE_FEN, cards: body.quantity * CARDS_PER_UNIT,
        appId: config.appId, sellerId: config.sellerId, mode: body.mode, state: 'pending', createdAt: now(), expiresAt: now() + ORDER_AGE };
      mutate(next => { next.orders[order.id] = order; });
      return view(order);
    },
    getOrder: (user, id) => view(owned(user, id)),
    async reconcile(user, id) {
      const order = owned(user, id);
      if (order.state !== 'pending' || !sdk) return view(order);
      let data;
      try {
        data = options.queryTrade ? await options.queryTrade(id) : (await sdk.curl('POST', '/v3/alipay/trade/query', { body: { out_trade_no: id }, requestTimeout: 8000 })).data;
      } catch (cause) {
        if (cause.code === 'ACQ.TRADE_NOT_EXIST') return view(owned(user, id));
        throw fail(502, '暂未确认支付结果，请稍后再查询');
      }
      if (!data || data.out_trade_no !== id) throw fail(400, '支付查询结果与订单不匹配');
      applyTrade(data);
      return view(owned(user, id));
    },
    notify(data) {
      if (!sdk || data.sign_type !== 'RSA2' || !sdk.checkNotifySignV2(data)) throw fail(400, '支付通知验签失败');
      applyTrade(data, true);
    },
    consume(user, body) {
      if (body.accountId !== undefined && body.accountId !== user.id) throw fail(409, '登录账号已变化，请刷新页面核对账号后重试');
      if (!validRequest(body.requestId)) throw fail(400, '用卡请求标识无效');
      if (!['promotion', 'load'].includes(body.scene)) throw fail(400, '广告卡仅支持晋升或读档用途');
      const key = user.id + ':' + body.requestId;
      if (ledger.consumed[key]) {
        if (ledger.consumed[key].scene !== body.scene) throw fail(409, '用卡请求用途不一致');
        return { ok: true, balance: ledger.wallets[user.id] || 0, requestId: body.requestId };
      }
      if (!(ledger.wallets[user.id] > 0)) throw fail(409, '概率卡余额不足');
      return mutate(next => { next.wallets[user.id]--; next.consumed[key] = { scene: body.scene, at: now() }; return { ok: true, balance: next.wallets[user.id], requestId: body.requestId }; });
    }
  };
}
module.exports = { createPayments, loadAlipayConfig };
