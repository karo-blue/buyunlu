// 虚拟支付服务端测试。
//
// 这些测试全部用注入的假 fetch，不打真实微信接口 —— 真实链路要等 MP 后台开通后
// 用真机小额下单验证（见 server/README.md 的上线检查清单）。
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const vp = require('../server/virtual-pay');

function tempFile(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-pay-')), name || 'virtual-pay.json');
}

function makeConfig(overrides = {}) {
  return vp.loadConfig(Object.assign({
    WX_APPID: 'wx-test-appid',
    WX_APPSECRET: 'test-appsecret',
    WX_XPAY_OFFER_ID: 'offer-1234',
    WX_XPAY_APP_KEY: 'appkey-prod',
    WX_XPAY_SANDBOX_APP_KEY: 'appkey-sandbox',
    WX_XPAY_PRODUCT_ID: 'adcard10',
    WX_MESSAGE_TOKEN: 'message-token-123',
    WX_XPAY_GOODS_PRICE: '100',
    WX_XPAY_CARDS_PER_UNIT: '10',
    WX_XPAY_ENV: '0',
    WX_PAY_DATA_FILE: tempFile(),
  }, overrides));
}

// 假 fetch：按 URL 分流，query_order 的结果可以在测试里改写
function makeFetch(state) {
  return async (url, init) => {
    state.calls.push({ url: String(url), init: init || {} });
    const respond = payload => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
    if (String(url).includes('/cgi-bin/token')) return respond({ access_token: 'ACCESS_TOKEN', expires_in: 7200 });
    if (String(url).includes('/sns/jscode2session')) return respond({ openid: 'oUser001', session_key: 'SESSION_KEY_001' });
    if (String(url).includes('/xpay/query_order')) return respond(state.queryOrderResult);
    return respond({ errcode: 0 });
  };
}

function makeService(overrides = {}, queryOrderResult = { errcode: 0, order_state: '2', wx_order_id: 'WXORDER1' }) {
  const state = { calls: [], queryOrderResult };
  const config = makeConfig(overrides);
  const service = vp.createVirtualPayService({
    config,
    store: vp.createPayStore(config.dataFile),
    fetchImpl: makeFetch(state),
    logger: { warn() {}, log() {} },
  });
  return { service, config, state };
}

async function loggedIn(service) {
  const result = await service.login('wx-login-code');
  assert.equal(result.ok, true);
  return service.store.ensureLoaded().sessions[result.token];
}

test('paySig follows the documented HMAC-SHA256(uri&postBody) formula', () => {
  const body = '{"offerId":"1","buyQuantity":1}';
  const paySig = vp.calcPaySig('requestVirtualPayment', body, 'MY_APP_KEY');
  // 独立算一遍，防止把 uri 和 body 的顺序或分隔符写错
  const expected = crypto.createHmac('sha256', 'MY_APP_KEY').update(`requestVirtualPayment&${body}`, 'utf8').digest('hex');
  assert.equal(paySig, expected);
  assert.match(paySig, /^[0-9a-f]{64}$/);
  // 换密钥必须换签名，否则说明密钥没参与计算
  assert.notEqual(vp.calcPaySig('requestVirtualPayment', body, 'OTHER_KEY'), paySig);
  // 服务端接口用接口路径做 uri
  assert.notEqual(vp.calcPaySig('/xpay/query_order', body, 'MY_APP_KEY'), paySig);
});

test('signature uses sessionKey, not AppKey', () => {
  const body = '{"a":1}';
  const signature = vp.calcSignature(body, 'SESSION_KEY');
  assert.equal(signature, crypto.createHmac('sha256', 'SESSION_KEY').update(body, 'utf8').digest('hex'));
  assert.notEqual(signature, vp.calcPaySig(body, 'SESSION_KEY', 'irrelevant'));
  assert.notEqual(signature, vp.calcSignature(body, 'OTHER_SESSION'));
});

test('outTradeNo obeys the platform character and length rules', () => {
  const seen = new Set();
  for (let index = 0; index < 200; index += 1) {
    const value = vp.newOutTradeNo();
    assert.match(value, /^[0-9A-Za-z_\-|*@]{8,32}$/, value);
    assert.ok(!value.startsWith('_'), value);
    assert.ok(!seen.has(value), `单号重复：${value}`);
    seen.add(value);
  }
});

test('deliver notify XML is parsed including nested and CDATA values', () => {
  const xml = '<xml><Event><![CDATA[xpay_goods_deliver_notify]]></Event><OpenId><![CDATA[oABC]]></OpenId>'
    + '<OutTradeNo>BYL123</OutTradeNo><WeChatPayInfo><MchOrderNo><![CDATA[WX777]]></MchOrderNo></WeChatPayInfo>'
    + '<GoodsInfo><ProductId>adcard10</ProductId><Quantity>2</Quantity></GoodsInfo></xml>';
  assert.equal(vp.xmlValue(xml, 'Event'), 'xpay_goods_deliver_notify');
  assert.equal(vp.xmlValue(xml, 'OutTradeNo'), 'BYL123');
  assert.equal(vp.xmlValue(xml, 'MchOrderNo'), 'WX777');
  assert.equal(vp.xmlValue(xml, 'Quantity'), '2');
  assert.equal(vp.xmlValue(xml, 'Missing'), '');
  // 退款推送字段名口径不统一，取第一个命中的候选名
  assert.equal(vp.xmlValueAny('<xml><Refund_Fee>100</Refund_Fee></xml>', ['RefundFee', 'Refund_Fee']), '100');
  assert.equal(vp.xmlValueAny('<xml><Other>1</Other></xml>', ['RefundFee', 'Refund_Fee']), '');
  assert.equal(vp.deliverNotifyResponse(0), '<xml><ErrCode>0</ErrCode><ErrMsg><![CDATA[success]]></ErrMsg></xml>');
});

test('message push signature is checked with SHA1 sorted token timestamp and nonce', () => {
  const token = 'message-token-123';
  const timestamp = '1789012345';
  const nonce = 'nonce-456';
  const signature = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join(''), 'utf8').digest('hex');
  assert.equal(vp.verifyMessageSignature(token, signature, timestamp, nonce), true);
  assert.equal(vp.verifyMessageSignature(token, `0${signature.slice(1)}`, timestamp, nonce), false);
  assert.equal(vp.verifyMessageSignature('', signature, timestamp, nonce), false);
  assert.equal(vp.verifyMessageSignature(token, '', timestamp, nonce), false);
});

test('missing env vars disable payment instead of half-working', async () => {
  const config = vp.loadConfig({ WX_APPID: 'wx-only', WX_PAY_DATA_FILE: tempFile() });
  assert.equal(config.enabled, false);
  assert.deepEqual(config.missing, ['WX_APPSECRET', 'WX_XPAY_OFFER_ID', 'WX_XPAY_APP_KEY', 'WX_XPAY_PRODUCT_ID', 'WX_MESSAGE_TOKEN']);
  const service = vp.createVirtualPayService({ config, fetchImpl: makeFetch({ calls: [] }), logger: { warn() {} } });
  assert.equal(service.status().enabled, false);
  assert.equal((await service.login('code')).error, 'disabled');
  assert.equal((await service.handleNotify('<xml></xml>')).ok, false);
  // 沙箱环境缺的是沙箱 AppKey，不能因为配了现网 AppKey 就放行
  const sandbox = vp.loadConfig({ WX_APPID: 'a', WX_APPSECRET: 'b', WX_XPAY_OFFER_ID: 'c', WX_XPAY_APP_KEY: 'd', WX_XPAY_PRODUCT_ID: 'e', WX_MESSAGE_TOKEN: 'f', WX_XPAY_ENV: '1', WX_PAY_DATA_FILE: tempFile() });
  assert.equal(sandbox.enabled, false);
  assert.deepEqual(sandbox.missing, ['WX_XPAY_SANDBOX_APP_KEY']);
});

test('login returns an opaque token and keeps openid and sessionKey server-side', async () => {
  const { service } = makeService();
  const result = await service.login('wx-login-code');
  assert.equal(result.ok, true);
  assert.equal(result.openid, 'oUser001');
  assert.match(result.token, /^[0-9a-f]{48}$/);
  // token 里不能夹带 openid 或 sessionKey
  assert.ok(!result.token.includes('oUser001'));
  assert.ok(!result.token.includes('SESSION_KEY_001'));
  const session = service.resolveSession(result.token);
  assert.equal(session.openid, 'oUser001');
  assert.equal(session.sessionKey, 'SESSION_KEY_001');
  assert.equal(service.resolveSession('forged-token'), null);
  assert.equal(service.resolveSession(''), null);
});

test('createOrder returns signable payData for short_series_goods', async () => {
  const { service, state } = makeService();
  const session = await loggedIn(service);
  // login 已经打过 code2Session，所以只看 createOrder 自己有没有新增调用
  const callsBefore = state.calls.length;
  const order = service.createOrder(session);
  assert.equal(order.ok, true);
  const signData = JSON.parse(order.payData.signData);
  assert.equal(signData.offerId, 'offer-1234');
  assert.equal(signData.env, 0);
  assert.equal(signData.currencyType, 'CNY');
  assert.equal(signData.productId, 'adcard10');
  assert.equal(signData.goodsPrice, 100, '金额单位是分，不能换算成元');
  assert.equal(signData.buyQuantity, 1);
  assert.ok(signData.attach, 'attach 必填，发货时要透传回来');
  assert.equal(signData.outTradeNo, order.outTradeNo);
  assert.equal(order.payData.mode, 'short_series_goods');
  // 两把签名都必须能用服务端的密钥复算出来
  assert.equal(order.payData.paySig, vp.calcPaySig('requestVirtualPayment', order.payData.signData, 'appkey-prod'));
  assert.equal(order.payData.signature, vp.calcSignature(order.payData.signData, 'SESSION_KEY_001'));
  assert.equal(order.cards, 10, '一份道具 = 10 张卡');
  assert.equal(state.calls.length, callsBefore, '下单只是本地签名，不该打微信接口');
  // 下单后必须立刻能查到这笔订单（写盘不能拖到微任务里，否则紧接着的查单会扑空）
  assert.equal(service.store.ensureLoaded().orders[order.outTradeNo].status, 'pending');
});

test('createOrder 接受数量并夹取范围：份数进签名，张数按份数放大', async () => {
  const { service } = makeService();
  const session = await loggedIn(service);

  // 正常数量：份数写进 signData（支付金额 = goodsPrice × 份数），发货张数跟着放大
  const order = service.createOrder(session, 6);
  const signData = JSON.parse(order.payData.signData);
  assert.equal(signData.buyQuantity, 6);
  assert.equal(order.quantity, 6);
  assert.equal(order.cards, 60, '6 份 × 每份 10 张');
  assert.equal(service.store.ensureLoaded().orders[order.outTradeNo].quantity, 6, '订单要记下份数，兜底查单补发时用');
  // 数量变了签名必须跟着变，而且仍能用服务端密钥复算
  assert.equal(order.payData.paySig, vp.calcPaySig('requestVirtualPayment', order.payData.signData, 'appkey-prod'));

  // 客户端传来的数字一律不可信，全部夹回安全范围
  const zero = service.createOrder(session, 0);
  assert.equal(JSON.parse(zero.payData.signData).buyQuantity, 1);
  const negative = service.createOrder(session, -5);
  assert.equal(JSON.parse(negative.payData.signData).buyQuantity, 1);
  const fractional = service.createOrder(session, 7.9);
  assert.equal(JSON.parse(fractional.payData.signData).buyQuantity, 7, '小数向下取整');
  const garbage = service.createOrder(session, '12张');
  assert.equal(JSON.parse(garbage.payData.signData).buyQuantity, 1, '解析不出数字按 1 份');
  const huge = service.createOrder(session, 999999);
  assert.equal(JSON.parse(huge.payData.signData).buyQuantity, 1000, '单笔上限 1000 份');
  assert.equal(huge.cards, 10000);
});

test('sandbox env signs with the sandbox AppKey', async () => {
  const { service } = makeService({ WX_XPAY_ENV: '1' });
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  assert.equal(JSON.parse(order.payData.signData).env, 1);
  assert.equal(order.payData.paySig, vp.calcPaySig('requestVirtualPayment', order.payData.signData, 'appkey-sandbox'));
});

test('delivery grants cards per unit and is idempotent by wx_order_id', async () => {
  const { service } = makeService();
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  const xml = '<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oUser001</OpenId>'
    + `<OutTradeNo>${order.outTradeNo}</OutTradeNo><WeChatPayInfo><MchOrderNo>WX777</MchOrderNo></WeChatPayInfo>`
    + '<GoodsInfo><ProductId>adcard10</ProductId><Quantity>1</Quantity></GoodsInfo></xml>';
  const first = await service.handleNotify(xml);
  assert.equal(first.ok, true);
  assert.equal(first.errCode, 0);
  assert.equal(first.cards, 10);
  assert.equal(service.balanceOf('oUser001').balance, 10);
  // 平台会重复推送（推送失败最多重试 15 次），第二次不能再发
  const second = await service.handleNotify(xml);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(service.balanceOf('oUser001').balance, 10, '重复推送不能重复发卡');
  // 数量按份数放大
  const multi = await service.deliver({ openid: 'oUser001', productId: 'adcard10', quantity: 3, wxOrderId: 'WX888', outTradeNo: 'OTHER' });
  assert.equal(multi.cards, 30);
  assert.equal(service.balanceOf('oUser001').balance, 40);
});

test('unpaid or unverifiable orders are never delivered', async () => {
  const { service } = makeService({}, { errcode: 0, order_state: '1' });
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  const xml = `<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oUser001</OpenId><OutTradeNo>${order.outTradeNo}</OutTradeNo>`
    + '<WeChatPayInfo><MchOrderNo>WX999</MchOrderNo></WeChatPayInfo><GoodsInfo><ProductId>adcard10</ProductId><Quantity>1</Quantity></GoodsInfo></xml>';
  const result = await service.handleNotify(xml);
  assert.equal(result.ok, false, '查单没确认支付就不能发货');
  assert.equal(result.errCode, 1, '必须回非 0 让平台重试，不能默默吞掉');
  assert.equal(service.balanceOf('oUser001').balance, 0);
});

test('unknown events answer success so the platform stops retrying', async () => {
  const { service } = makeService();
  const result = await service.handleNotify('<xml><Event>xpay_complaint_notify</Event></xml>');
  assert.equal(result.ok, true);
  assert.equal(result.errCode, 0);
  assert.equal(result.ignored, true);
});

test('consume spends one card at a time and refuses at zero', async () => {
  const { service } = makeService();
  await service.deliver({ openid: 'oUser001', productId: 'adcard10', quantity: 1, wxOrderId: 'WX-A', outTradeNo: 'A' });
  for (let index = 10; index > 0; index -= 1) {
    const result = await service.consume('oUser001', 'promotion');
    assert.equal(result.ok, true);
    assert.equal(result.balance, index - 1);
  }
  const empty = await service.consume('oUser001', 'promotion');
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, 'empty');
  assert.equal(service.balanceOf('oUser001').balance, 0, '余额不能变成负数');
  const wallet = service.balanceOf('oUser001');
  assert.equal(wallet.totalPurchased, 10);
  assert.equal(wallet.totalConsumed, 10);
});

test('refund reverses delivered cards, floors at zero and is idempotent', async () => {
  const { service, config } = makeService({}, { errcode: 0, order_state: '2', left_fee: 0, refund_state: 'refunded' });
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  await service.handleNotify(`<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oUser001</OpenId><OutTradeNo>${order.outTradeNo}</OutTradeNo>`
    + '<WeChatPayInfo><MchOrderNo>WX-R1</MchOrderNo></WeChatPayInfo><GoodsInfo><ProductId>adcard10</ProductId><Quantity>1</Quantity></GoodsInfo></xml>');
  assert.equal(service.balanceOf('oUser001').balance, 10);
  await service.consume('oUser001', 'promotion');
  await service.consume('oUser001', 'promotion');
  assert.equal(service.balanceOf('oUser001').balance, 8);
  const refundXml = `<xml><Event>xpay_refund_notify</Event><OpenId>oUser001</OpenId><OutTradeNo>${order.outTradeNo}</OutTradeNo>`
    + `<RefundFee>${config.goodsPrice}</RefundFee><RefundOrderId>REF-1</RefundOrderId></xml>`;
  const refunded = await service.handleNotify(refundXml);
  assert.equal(refunded.ok, true);
  assert.equal(refunded.cards, 10);
  assert.equal(refunded.deducted, 8, '已消耗的卡退不回来，只扣得掉剩下的');
  assert.equal(service.balanceOf('oUser001').balance, 0);
  // 同一笔退款重复推送不能再扣一次
  const again = await service.handleNotify(refundXml);
  assert.equal(again.duplicate, true);
  assert.equal(service.balanceOf('oUser001').balance, 0);
});

test('an unconfirmed refund leaves the balance untouched', async () => {
  const { service } = makeService({}, { errcode: 0, order_state: '2', left_fee: 100 });
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  await service.deliver({ openid: 'oUser001', productId: 'adcard10', quantity: 1, wxOrderId: 'WX-K', outTradeNo: order.outTradeNo });
  assert.equal(service.balanceOf('oUser001').balance, 10);
  const result = await service.handleNotify(`<xml><Event>xpay_refund_notify</Event><OutTradeNo>${order.outTradeNo}</OutTradeNo><RefundFee>100</RefundFee></xml>`);
  assert.equal(result.ok, false);
  assert.equal(service.balanceOf('oUser001').balance, 10, '没确认退款就不许动余额');
});

test('sweep delivers paid orders whose notify was lost', async () => {
  const { service, state } = makeService();
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  // 推送丢了：订单一直是 pending
  assert.equal(service.store.ensureLoaded().orders[order.outTradeNo].status, 'pending');
  state.queryOrderResult = { errcode: 0, order_state: '2', wx_order_id: 'WX-SWEEP' };
  const swept = await service.sweepPending();
  assert.equal(swept.checked, 1);
  assert.equal(swept.delivered, 1);
  assert.equal(service.balanceOf('oUser001').balance, 10);
  assert.equal(service.store.ensureLoaded().orders[order.outTradeNo].status, 'delivered');
  // 再扫一遍不会重复发
  const again = await service.sweepPending();
  assert.equal(again.delivered, 0);
  assert.equal(service.balanceOf('oUser001').balance, 10);
});

test('query_order falls back to the slash-less uri when the signature is rejected', async () => {
  const { service, state } = makeService();
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  let call = 0;
  const original = state.queryOrderResult;
  service.queryOrder = service.queryOrder.bind(service);
  const baseFetch = service.config;
  // 第一次返回签名错误，第二次（换 uri）返回成功
  const patched = vp.createVirtualPayService({
    config: makeConfig({ WX_PAY_DATA_FILE: baseFetch.dataFile }),
    fetchImpl: async (url, init) => {
      const respond = payload => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
      if (String(url).includes('/sns/jscode2session')) return respond({ openid: 'oUser001', session_key: 'SESSION_KEY_001' });
      if (String(url).includes('/cgi-bin/token')) return respond({ access_token: 'AT', expires_in: 7200 });
      if (String(url).includes('/xpay/query_order')) {
        call += 1;
        if (call === 1) return respond({ errcode: 90010, errmsg: 'signature签名错误' });
        return respond({ errcode: 0, order_state: '2', wx_order_id: 'WX-ALT' });
      }
      return respond({ errcode: 0 });
    },
    logger: { warn() {} },
  });
  const result = await patched.queryOrder({ openid: 'oUser001', orderId: order.outTradeNo });
  assert.equal(call, 2, '签名被拒后应当换 uri 重试一次');
  assert.equal(result.errcode, 0);
  assert.equal(original.order_state, '2');
});

test('query_order status is read from the nested order object, not the top level', () => {
  // 微信真实返回体：订单字段全部在 order 子对象里。
  // 早期实现按顶层 order_state 读，永远读不到 → 所有订单都被判成未支付。
  const realShape = { errcode: 0, errmsg: '', order: { order_id: 'BYL1', status: 3, wx_order_id: 'WX-REAL' } };
  assert.equal(vp.orderInfoOf(realShape).status, 3);
  assert.equal(vp.orderStatusOf(realShape), 3);
  assert.equal(vp.ORDER_STATUS_PAID.includes(3), true);
  // 顶层扁平结构（沙箱/灰度）也必须兼容
  const flatShape = { errcode: 0, order_state: '2' };
  assert.equal(vp.orderStatusOf(flatShape), 2);
  // 什么都不给 → 没有结论（既不是已支付也不是未支付）
  assert.equal(vp.orderStatusOf({ errcode: 0 }), null);
  assert.equal(vp.orderStatusOf(null), null);
});

test('isPaidOrder recognises every paid status and rejects unpaid ones', () => {
  const { service } = makeService();
  [2, 3, 4].forEach(status => {
    assert.equal(service.isPaidOrder({ errcode: 0, order: { status } }), true, `status=${status} 应判为已支付`);
  });
  [0, 1].forEach(status => {
    assert.equal(service.isPaidOrder({ errcode: 0, order: { status } }), false, `status=${status} 不是已支付`);
    assert.equal(service.isUnpaidOrder({ errcode: 0, order: { status } }), true, `status=${status} 应判为未支付`);
  });
  // errcode 非 0 一律不算已支付，也不能当成"明确未支付"直接拒发
  assert.equal(service.isPaidOrder({ errcode: -1, order: { status: 3 } }), false);
  assert.equal(service.isUnpaidOrder({ errcode: -1, order: { status: 0 } }), false);
  // 已支付状态不能同时被判成未支付
  assert.equal(service.isUnpaidOrder({ errcode: 0, order: { status: 3 } }), false);
});

test('a signature-verified notify is not blocked by a lagging query_order status', async () => {
  // query_order 的状态同步官方已知会延迟（社区反馈最长 40 分钟），
  // 而发货推送本身已经是微信确认支付后才发的，且 URL 签名已校验过。
  // 这时卡单就是"用户付了钱拿不到卡"。
  const { service } = makeService({}, { errcode: 0, errmsg: '', order: { status: 1 } });
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  const xml = `<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oUser001</OpenId><OutTradeNo>${order.outTradeNo}</OutTradeNo>`
    + '<WeChatPayInfo><MchOrderNo>WX-DELAY</MchOrderNo></WeChatPayInfo><GoodsInfo><ProductId>adcard10</ProductId><Quantity>2</Quantity></GoodsInfo></xml>';
  const result = await service.handleNotify(xml, { verified: true });
  assert.equal(result.ok, true, '推送已验签，不能因为查单没同步就卡着不发');
  assert.equal(result.cards, 20);
  assert.equal(service.balanceOf('oUser001').balance, 20);
});

test('a notify without signature verification is still refused when the verdict is unknown', async () => {
  const { service } = makeService({}, { errcode: 0, order: { status: 1 } });
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  const xml = `<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oUser001</OpenId><OutTradeNo>${order.outTradeNo}</OutTradeNo>`
    + '<WeChatPayInfo><MchOrderNo>WX-NOVERIFY</MchOrderNo></WeChatPayInfo><GoodsInfo><ProductId>adcard10</ProductId><Quantity>1</Quantity></GoodsInfo></xml>';
  const result = await service.handleNotify(xml);
  assert.equal(result.ok, false, '没验签就不能靠"查不出结论"放行');
  assert.equal(service.balanceOf('oUser001').balance, 0);
});

test('an order the platform reports as paid takes the wx_order_id from the query result', async () => {
  const { service } = makeService({}, { errcode: 0, order: { status: 3, wx_order_id: 'WX-FROM-QUERY' } });
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  const xml = `<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oUser001</OpenId><OutTradeNo>${order.outTradeNo}</OutTradeNo>`
    + '<GoodsInfo><ProductId>adcard10</ProductId><Quantity>1</Quantity></GoodsInfo></xml>';
  const result = await service.handleNotify(xml);
  assert.equal(result.ok, true);
  // 幂等键要用查单给的微信单号，不能停留在推送里可能为空的那个
  assert.ok(service.store.ensureLoaded().deliveredOrders['WX-FROM-QUERY'] !== undefined);
  assert.equal(service.store.ensureLoaded().orders[order.outTradeNo].wxOrderId, 'WX-FROM-QUERY');
});

test('sweep reads wx_order_id from the nested order object', async () => {
  const { service, state } = makeService();
  const session = await loggedIn(service);
  const order = service.createOrder(session);
  state.queryOrderResult = { errcode: 0, errmsg: '', order: { status: 4, wx_order_id: 'WX-NESTED' } };
  const swept = await service.sweepPending();
  assert.equal(swept.delivered, 1);
  assert.equal(service.balanceOf('oUser001').balance, 10);
  assert.equal(service.store.ensureLoaded().orders[order.outTradeNo].wxOrderId, 'WX-NESTED');
});

test('sweep stops re-querying pending orders that aged out of the payment window', async () => {
  const { service, state } = makeService();
  const session = await loggedIn(service);
  const fresh = service.createOrder(session);
  const stale = service.createOrder(session);
  state.queryOrderResult = { errcode: 0, order: { status: 2, wx_order_id: 'WX-FRESH' } };
  // 只有其中一笔被推到 7 天以前
  await service.store.transact(data => {
    data.orders[stale.outTradeNo].createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  });
  const swept = await service.sweepPending();
  assert.equal(swept.checked, 1, '只查还在支付窗口里的那一笔');
  assert.equal(swept.delivered, 1);
  assert.equal(swept.stale, 1, '超龄的那一笔要单独报出来，方便排查');
  assert.equal(service.store.ensureLoaded().orders[stale.outTradeNo].status, 'pending');
  assert.equal(service.store.ensureLoaded().orders[fresh.outTradeNo].status, 'delivered');
});

test('payment data survives a restart of the service', async () => {
  const config = makeConfig();
  const first = vp.createVirtualPayService({ config, store: vp.createPayStore(config.dataFile), fetchImpl: makeFetch({ calls: [] }), logger: { warn() {} } });
  await first.deliver({ openid: 'oUser001', productId: 'adcard10', quantity: 1, wxOrderId: 'WX-P', outTradeNo: 'P1' });
  // 重开一个实例读同一个文件，卡数必须还在
  const second = vp.createVirtualPayService({ config, store: vp.createPayStore(config.dataFile), fetchImpl: makeFetch({ calls: [] }), logger: { warn() {} } });
  assert.equal(second.balanceOf('oUser001').balance, 10);
});
