'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function checkout(status, user, options = {}) {
  const nodes = new Map();
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '1', hidden: false, disabled: false, textContent: '', checked:false,listeners:{},setAttribute() {}, addEventListener(name,callback) {this.listeners[name]=callback;} });
    return nodes.get(id);
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../checkout.js'), 'utf8'), {
    document: { getElementById: byId, querySelectorAll:()=>[] }, navigator: { userAgent: 'iPhone Mobile' },
    URL, URLSearchParams, location: { search: options.search || '' }, sessionStorage: {removeItem(){}},
    window: { BuyunluAPI: { request: async route => {
      if (route === '/pay/status') return status;
      if (route === '/account') return { user };
      if (route === '/pay/balance') return { balance: 0 };
      if (route === '/pay/receipt') { if(options.receiptError) throw new Error('暂未确认支付结果，请稍后再查询'); return {ok:true,order:options.receipt}; }
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

test('an Alipay return in a new browser shows the confirmed receipt without requiring a second login', async () => {
 const id='BYL'+'a'.repeat(36);
 const byId=await checkout({enabled:true,modes:['wap']},null,{search:'?order='+id,receipt:{id,state:'paid',quantity:1,amount:'1.00',cards:10}});
 assert.equal(byId('payment-login').hidden,true);assert.equal(byId('pay-button').hidden,true);
 assert.equal(byId('checkout-title').textContent,'支付已确认');assert.match(byId('payment-notice').textContent,/10 张广告卡已到账/);
 assert.equal(byId('payment-return-help').hidden,false);assert.match(byId('payment-return-help').textContent,/原.*浏览器|支付前.*浏览器/);
 assert.equal(byId('back-to-game').hidden,true,'a new browser must not open an empty local game by mistake');
});

test('browser return parameters cannot fake payment and a failed receipt lookup can be retried without login', async () => {
 const id='BYL'+'b'.repeat(36);
 const byId=await checkout({enabled:true,modes:['wap']},null,{search:'?order='+id+'&trade_status=TRADE_SUCCESS',receipt:{id,state:'pending',quantity:1,amount:'1.00',cards:10}});
 assert.match(byId('payment-notice').textContent,/尚未确认/);assert.equal(byId('check-payment').hidden,false);assert.equal(byId('payment-login').hidden,true);
 const failed=await checkout({enabled:true,modes:['wap']},null,{search:'?order='+id,receiptError:true});
 assert.equal(failed('payment-login').hidden,true);assert.equal(failed('check-payment').hidden,false);assert.match(failed('payment-error').textContent,/暂未确认/);
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
