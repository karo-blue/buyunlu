'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createPayments, loadAlipayConfig } = require('../alipay');
const merchant = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const platform = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const config = { enabled: true, appId: '2021000000000001', sellerId: '2088000000000001',
  privateKey: merchant.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  alipayPublicKey: platform.publicKey.export({ type: 'spki', format: 'pem' }),
  modes: ['page', 'wap'], sandbox: true };
const user = { id: 'h5-player', emailVerified: true };
const requestId = () => crypto.randomUUID();
function fixture(t, options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-alipay-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const create = extra => createPayments({ dataDir, origin: 'https://example.invalid', config, ...options, ...extra });
  return { payments: create(), create, dataDir };
}
function notice(order, patch = {}) {
  const data = { app_id: config.appId, seller_id: config.sellerId, out_trade_no: order.id,
    total_amount: order.amount, trade_no: '20261015000000000001', trade_status: 'TRADE_SUCCESS', sign_type: 'RSA2', ...patch };
  const content = Object.keys(data).filter(key => key !== 'sign' && key !== 'sign_type' && data[key] !== '').sort().map(key => key + '=' + data[key]).join('&');
  data.sign = crypto.sign('RSA-SHA256', Buffer.from(content), platform.privateKey).toString('base64');
  return data;
}
test('missing config disables payment and cannot create orders', t => {
  assert.equal(loadAlipayConfig({}).enabled, false);
  const { payments } = fixture(t, { config: { enabled: false } });
  assert.equal(payments.status().enabled, false);
  assert.throws(() => payments.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'page' }), /尚未开通/);
});

test('public purchasing has no username allowlist and accepts both signed website payment modes', t => {
  const { payments } = fixture(t, { config: { ...config, testUsernames: [] } });
  assert.equal(payments.status().enabled, true);
  assert.equal(payments.status().testOnly, false);
  for (const [username, mode] of [['中文玩家', 'wap'], ['other_player', 'page']]) {
    const buyer = { ...user, id: username, username };
    assert.equal(payments.status(buyer).enabled, true);
    const order = payments.createOrder(buyer, { requestId: requestId(), quantity: 1, mode });
    assert.equal(order.amount, '1.00'); assert.equal(order.cards, 10);
    assert.match(new URL(order.payUrl).searchParams.get('method'), mode === 'wap' ? /wap/ : /page/);
  }
});

test('limited live verification only permits its named verified account and one-yuan orders', t => {
  const testUser = { ...user, username: 'payment_tester' };
  const { payments } = fixture(t, { config: { ...config, testUsernames: ['payment_tester'] } });
  assert.equal(payments.status().enabled, false);
  assert.equal(payments.status(testUser).enabled, true);
  assert.equal(payments.status(testUser).testOnly, true);
  const input = { requestId: requestId(), quantity: 1, mode: 'wap', amount: '0.01', cards: 999 };
  assert.throws(() => payments.createOrder({ ...testUser, username: 'other' }, input), /测试账号/);
  assert.throws(() => payments.createOrder(testUser, { ...input, quantity: 2 }), /1元/);
  const order = payments.createOrder(testUser, input);
  assert.equal(order.amount, '1.00'); assert.equal(order.cards, 10);
  assert.equal(payments.createOrder(testUser, input).id, order.id);
  payments.notify(notice(order)); payments.notify(notice(order));
  assert.equal(payments.balance(testUser), 10);
});

test('payment callbacks stay within the configured subdirectory', t => {
  const { payments } = fixture(t, { basePath: '/buyunlu/' });
  const order = payments.createOrder(user, { requestId: requestId(), quantity: 6, mode: 'wap' });
  const url = new URL(order.payUrl);
  assert.equal(url.searchParams.get('notify_url'), 'https://example.invalid/buyunlu/api/pay/alipay/notify');
  assert.equal(url.searchParams.get('return_url'), 'https://example.invalid/buyunlu/checkout.html?order=' + order.id);
  assert.equal(JSON.parse(url.searchParams.get('biz_content')).quit_url, url.searchParams.get('return_url'));
});

test('GitHub checkout receives the return while server alone receives signed notification', t => {
  const { payments } = fixture(t, { basePath:'/buyunlu/', frontendUrl:'https://frontend.example/buyunlu/' });
  const order=payments.createOrder(user,{requestId:requestId(),quantity:1,mode:'wap'});
  const url=new URL(order.payUrl);
  assert.equal(url.searchParams.get('return_url'),'https://frontend.example/buyunlu/checkout.html?order='+order.id);
  assert.equal(url.searchParams.get('notify_url'),'https://example.invalid/buyunlu/api/pay/alipay/notify');
});
test('orders use server prices, bind ownership and remain idempotent across restart', t => {
  const { payments, create } = fixture(t);
  const input = { requestId: requestId(), quantity: 2, mode: 'page', amount: '0.01', cards: 999 };
  const order = payments.createOrder(user, input);
  assert.equal(order.amount, '2.00'); assert.equal(order.cards, 20);
  assert.equal(payments.createOrder(user, input).id, order.id);
  assert.equal(create().getOrder(user, order.id).id, order.id);
  assert.throws(() => payments.getOrder({ id: 'someone-else' }, order.id), /不存在/);
  assert.throws(() => payments.createOrder(user, { ...input, quantity: 3 }), /请求/);
  for (const quantity of [0, -1, 1.5, '2', 101]) assert.throws(() => payments.createOrder(user, { ...input, requestId: requestId(), quantity }), /数量/);
  const url = new URL(order.payUrl);
  assert.equal(url.hostname, 'openapi-sandbox.dl.alipaydev.com');
  assert.equal(url.searchParams.get('method'), 'alipay.trade.page.pay');
  assert.equal(url.searchParams.get('notify_url'), 'https://example.invalid/api/pay/alipay/notify');
  const biz = JSON.parse(url.searchParams.get('biz_content'));
  assert.equal(biz.product_code, 'FAST_INSTANT_TRADE_PAY'); assert.equal(biz.total_amount, '2.00');
  const wap = payments.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'wap' });
  assert.equal(JSON.parse(new URL(wap.payUrl).searchParams.get('biz_content')).product_code, 'QUICK_WAP_WAY');
});
test('only signed matching paid notifications credit cards exactly once, including after restart', t => {
  const { payments, create } = fixture(t);
  const order = payments.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'page' });
  for (const patch of [{ app_id: 'wrong' }, { seller_id: 'wrong' }, { total_amount: '0.01' }, { out_trade_no: 'missing' }, { sign_type: 'RSA' }]) {
    assert.throws(() => payments.notify(notice(order, patch)));
  }
  const forged = notice(order); forged.total_amount = '9.00';
  assert.throws(() => payments.notify(forged));
  assert.equal(payments.balance(user), 0);
  payments.notify(notice(order, { trade_status: 'WAIT_BUYER_PAY' }));
  assert.equal(payments.balance(user), 0);
  payments.notify(notice(order)); payments.notify(notice(order));
  const restarted = create(); restarted.notify(notice(order));
  assert.equal(restarted.balance(user), 10);
  assert.equal(restarted.getOrder(user, order.id).state, 'paid');
  const other = restarted.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'page' });
  assert.throws(() => restarted.notify(notice(other)), /交易/);
  assert.equal(restarted.balance(user), 10);
});
test('card consumption is durable, idempotent, account-bound and never goes below zero', t => {
  const { payments, create } = fixture(t);
  const order = payments.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'page' }); payments.notify(notice(order));
  const input = { requestId: requestId(), scene: 'promotion' };
  assert.equal(payments.consume(user, input).balance, 9);
  assert.equal(create().consume(user, input).balance, 9);
  assert.throws(() => payments.consume({ id: 'other' }, input), /不足/);
  assert.throws(() => payments.consume(user, { ...input, scene: 'annualReview' }), /用途/);
  for (let i = 0; i < 9; i++) payments.consume(user, { requestId: requestId(), scene: 'promotion' });
  assert.throws(() => payments.consume(user, { requestId: requestId(), scene: 'promotion' }), /不足/);
  assert.equal(payments.balance(user), 0);
});
test('order reconciliation verifies ownership, trusts server query only and never browser return fields', async t => {
  let reply; let queries = 0;
  const { payments } = fixture(t, { queryTrade: async id => { queries++; return { out_trade_no: id, ...reply }; } });
  const order = payments.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'page' });
  await assert.rejects(payments.reconcile({ id: 'other' }, order.id)); assert.equal(queries, 0);
  reply = { total_amount: '0.01', trade_status: 'TRADE_SUCCESS', trade_no: 'trade-one' };
  await assert.rejects(payments.reconcile(user, order.id)); assert.equal(payments.balance(user), 0);
  reply = { total_amount: '1.00', trade_status: 'TRADE_SUCCESS', trade_no: 'trade-one' };
  assert.equal((await payments.reconcile(user, order.id)).state, 'paid');
  assert.equal(payments.balance(user), 10);
});
test('failed ledger writes never acknowledge credit or consume; corrupt ledgers fail closed', t => {
  let fail = false;
  const { payments, dataDir, create } = fixture(t, { write: (file, contents) => { if (fail) throw new Error('disk unavailable'); fs.writeFileSync(file, contents); } });
  const order = payments.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'page' }); fail = true;
  assert.throws(() => payments.notify(notice(order))); assert.equal(payments.balance(user), 0);
  fail = false; payments.notify(notice(order)); fail = true;
  assert.throws(() => payments.consume(user, { requestId: requestId(), scene: 'promotion' })); assert.equal(payments.balance(user), 10);
  fs.writeFileSync(path.join(dataDir, 'payments.json'), '{broken'); assert.throws(() => create());
});
test('sandbox money cannot become a real-money wallet by changing configuration', t => {
  const { payments, create } = fixture(t);
  const order = payments.createOrder(user, { requestId: requestId(), quantity: 1, mode: 'page' }); payments.notify(notice(order));
  assert.throws(() => create({ config: { ...config, sandbox: false } }), /独立数据目录/);
});
