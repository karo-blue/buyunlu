'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function checkout(status, user) {
  const nodes = new Map();
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '1', hidden: false, disabled: false, textContent: '', checked:false,listeners:{},setAttribute() {}, addEventListener(name,callback) {this.listeners[name]=callback;} });
    return nodes.get(id);
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../checkout.js'), 'utf8'), {
    document: { getElementById: byId, querySelectorAll:()=>[] }, navigator: { userAgent: 'iPhone Mobile' },
    URL, URLSearchParams, location: { search: '' },
    window: { BuyunluAPI: { request: async route => {
      if (route === '/pay/status') return status;
      if (route === '/account') return { user };
      if (route === '/pay/balance') return { balance: 0 };
      throw new Error('Unexpected request');
    } } },
  });
  await new Promise(resolve => setImmediate(resolve));
  return byId;
}

test('restricted payment testing keeps registration reachable without calling Alipay unopened', async () => {
  const byId = await checkout({ enabled: false, testOnly: true, reason: '当前仅开放指定账号的1元购买验证' }, null);
  assert.equal(byId('payment-login').hidden, false);
  assert.equal(byId('payment-login').href, './?checkout=1');
  assert.equal(byId('payment-login').textContent, '登录或注册后购买');
  assert.equal(byId('pay-button').disabled, true);
  assert.equal(byId('alipay-state').textContent, '限指定账号测试');
  assert.doesNotMatch(byId('pay-button').textContent, /待开通/);
});

test('a verified account outside the payment test cannot pay and sees the actual restriction', async () => {
  const byId = await checkout({ enabled: false, testOnly: true, reason: '当前仅开放指定账号的1元购买验证' }, { username: 'tester', emailVerified: true });
  assert.equal(byId('purchase-account').textContent, 'tester');
  assert.equal(byId('pay-button').hidden, false);
  assert.equal(byId('pay-button').disabled, true);
  assert.equal(byId('pay-button').textContent, '测试购买未开放');
  assert.equal(byId('payment-notice').textContent, '当前仅开放指定账号的1元购买验证');
});

test('an allowed verified account must explicitly accept the purchase notice before payment', async () => {
  const byId = await checkout({ enabled: true, testOnly: true, modes: ['page', 'wap'] }, { username: 'tester', emailVerified: true });
  assert.equal(byId('pay-button').disabled, true);
  assert.equal(byId('purchase-agree').checked,false);
  byId('purchase-agree').checked=true;byId('purchase-agree').listeners.change();
  assert.equal(byId('pay-button').disabled, false);
  assert.equal(byId('pay-button').textContent, '支付宝支付 ¥1.00');
  assert.equal(byId('purchase-yuan').disabled, true);
  assert.equal(byId('purchase-cards').textContent, '10 张');
});

test('changing an amount requires fresh confirmation and rejects decimal and excessive amounts',async()=>{
 const byId=await checkout({enabled:true,modes:['wap']},{username:'tester',emailVerified:true});
 byId('purchase-agree').checked=true;byId('purchase-agree').listeners.change();assert.equal(byId('pay-button').disabled,false);
 byId('purchase-yuan').value='6';byId('purchase-yuan').listeners.input();
 assert.equal(byId('purchase-agree').checked,false);assert.equal(byId('pay-button').disabled,true);assert.equal(byId('purchase-cards').textContent,'60 张');
 for(const amount of ['0','1.5','101','-1']){byId('purchase-yuan').value=amount;byId('purchase-agree').checked=true;byId('purchase-agree').listeners.change();assert.equal(byId('pay-button').disabled,true);}
});
