'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const createAPI=require('../commerce-api'),{install}=require('../commerce');
test('payment API uses the configured server without cookies, stores only opaque sessions and never puts tokens in URLs',async()=>{
  const storage=new Map(),calls=[];let token='a'.repeat(43),status=200;
  const host={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,headers:{get:()=>token},json:async()=>({ok:status===200})};}};
  const api=createAPI(host,{apiBaseUrl:'https://backend.example/buyunlu/api'});
  await api.request('/login',{username:'tester',password:'test-only-password'});
  await api.request('/pay/balance');
  assert.equal(calls[1].options.headers.Authorization,'Bearer '+token);
  assert.equal(calls[1].options.credentials,'omit');assert.equal(calls[1].options.cache,'no-store');
  assert.equal(calls[1].url,'https://backend.example/buyunlu/api/pay/balance');
  assert.equal(JSON.stringify([...storage.values()]).includes('test-only-password'),false);
  token=null;status=401;await assert.rejects(api.request('/account'));assert.equal(api.hasSession(),false);
});
function fixture({store=new Map(),state,failAfterDebit=false,user=true}={}){
  let balance=10,rewards=0,debits=0,opened=0;const spent=new Set(),requests=[];
  const host={crypto,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},wx:{showToast(){}},
    BuyunluCardAccount:{user:user?{id:'one',username:'tester',emailVerified:true}:null,ready:Promise.resolve(),open:()=>opened++,checkout:()=>opened++},
    BuyunluAPI:{request:async(route,body)=>{
      if(route==='/pay/balance')return {balance};
      requests.push(body.requestId);
      if(!spent.has(body.requestId)){spent.add(body.requestId);balance--;debits++;if(failAfterDebit){failAfterDebit=false;throw new Error('response lost');}}
      return {balance};
    }}};
  const page={data:{state:state||{year:2026,rankIndex:1,promotionAdUsedYear:2026,promotionAdWatchCount:0},dialog:{}},_payRaw:{balance:0},
    setPay(value){this._payRaw={...this._payRaw,...value};},setData(){},showModal(){},showActionSheet(){},buildPatch:()=>({}),selectNav(){},startFreshGame(){},applyLoadedSlot(){},startQuarter(){}};
  install(page,{host});
  return {page,host,store,requests,use:()=>page.consumeAdCard({scene:'promotion',reward:()=>{rewards++;page.data.state.promotionAdWatchCount++;}}),counts:()=>({balance,rewards,debits,opened})};
}
test('old offline free-card balances cannot become paid cards and guests cannot consume',async()=>{
  const f=fixture({user:false,store:new Map([['buyunlu_mobile_cards_v1','99999']])});
  await f.host.BuyunluCardAccount.ready;await f.use();
  assert.equal(f.page.cardBalance(),0);assert.equal(f.counts().debits,0);assert.equal(f.counts().opened,1);
});
test('a lost debit response retries the same id and grants one reward after one server debit',async()=>{
  const f=fixture({failAfterDebit:true});await f.host.BuyunluCardAccount.ready;
  await f.use();assert.equal(f.counts().rewards,0);assert.equal(f.counts().debits,1);
  await f.use();assert.equal(f.counts().rewards,1);assert.equal(f.counts().debits,1);
  assert.equal(f.requests[0],f.requests[1]);assert.equal(f.page.cardBalance(),9);
});
test('an unsupported reward scene never spends paid cards',async()=>{
  const f=fixture();await f.host.BuyunluCardAccount.ready;
  await f.page.consumeAdCard({scene:'health',reward:()=>{throw new Error('must not reward');}});
  assert.equal(f.counts().debits,0);
});

test('a debit response cannot grant a reward or replace the balance after account identity changes',async()=>{
 const f=fixture();await f.host.BuyunluCardAccount.ready;await new Promise(resolve=>setImmediate(resolve));
 const pending=f.use();assert.equal(f.host.BuyunluCardAccount.canChange(),false);
 f.host.BuyunluCardAccount.user={id:'other',username:'other',emailVerified:true};
 await pending;assert.equal(f.counts().rewards,0);
});
