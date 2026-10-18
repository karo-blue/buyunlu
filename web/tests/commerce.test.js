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
test('API resumes the latest session from another tab and an old 401 cannot clear a newer login',async()=>{
 const key='buyunlu_web_session_v1',storage=new Map([[key,'a'.repeat(43)]]),calls=[];let reply;
 const host={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},AbortController,setTimeout,clearTimeout,
  fetch:async(url,options)=>{calls.push(options.headers.Authorization);return new Promise(resolve=>{reply=resolve;});}};
 const api=createAPI(host,{apiBaseUrl:'https://backend.example/api'});
 storage.set(key,'b'.repeat(43));
 const first=api.request('/account');assert.equal(calls[0],'Bearer '+'b'.repeat(43));
 storage.set(key,'c'.repeat(43));reply({ok:false,status:401,headers:{get:()=>null},json:async()=>({error:'expired'})});
 await assert.rejects(first);assert.equal(storage.get(key),'c'.repeat(43));
 const next=api.request('/account');assert.equal(calls[1],'Bearer '+'c'.repeat(43));
 reply({ok:true,status:200,headers:{get:()=>null},json:async()=>({ok:true})});await next;
});

test('a temporary connection failure preserves the remembered session',async()=>{
 const key='buyunlu_web_session_v1',storage=new Map([[key,'a'.repeat(43)]]);
 const host={localStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},AbortController,setTimeout,clearTimeout,fetch:async()=>{throw new TypeError('offline');}};
 const api=createAPI(host,{apiBaseUrl:'https://backend.example/api'});
 await assert.rejects(api.request('/account'));assert.equal(api.hasSession(),true);
});

test('mail delivery errors retain their safe code and retry guidance at the API boundary', async () => {
 const host = { localStorage: { getItem: () => '' }, AbortController, setTimeout, clearTimeout,
  fetch: async () => ({ ok: false, status: 422, json: async () => ({ ok: false, code: 'SMTP_RECIPIENT_INVALID', error: '收件邮箱不存在或地址不正确，请核对后重试。' }) }) };
 await assert.rejects(createAPI(host, { apiBaseUrl: 'https://backend.example/api' }).request('/email/send', { email: 'missing@example.test' }), cause => {
  assert.equal(cause.status, 422); assert.equal(cause.code, 'SMTP_RECIPIENT_INVALID'); assert.match(cause.message, /核对/); return true;
 });
});

function fixture({store=new Map(),state,failAfterDebit=false,user=true,boards,boardRequest,consumeRequest,slots={1:{name:"旧存档",year:2024,age:30,rankIndex:1}},saveFails=false}={}){
  let balance=10,rewards=0,debits=0,opened=0;let saved;const spent=new Set(),requests=[];
  const host={crypto,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},wx:{showToast(){}},
    BuyunluCardAccount:{user:user?{id:'one',username:'tester',emailVerified:true}:null,ready:Promise.resolve(),open:()=>opened++,checkout:()=>opened++},
    BuyunluAPI:{request:async(route,body)=>{
      if(route.startsWith('/public/'))return boardRequest(route);
      if(route==='/pay/balance')return {balance};
      await consumeRequest?.(body);
      requests.push(body.requestId);
      if(!spent.has(body.requestId)){spent.add(body.requestId);balance--;debits++;if(failAfterDebit){failAfterDebit=false;throw new Error('response lost');}}
      return {balance};
    }}};
  const page={data:{state:state||{year:2026,rankIndex:1,promotionAdUsedYear:2026,promotionAdWatchCount:0},dialog:{}},_payRaw:{balance:0},
    setPay(value){this._payRaw={...this._payRaw,...value};},setData(){},showModal(options){this.data.dialog={...options,visible:true};},showActionSheet(options){this.sheet=options;},buildPatch:()=>({}),selectNav(){},startFreshGame(){},applyLoadedSlot(){},startQuarter(){},tryPromotion(){this.data.state.promotionAppliedYear=this.data.state.year;}};
  const storage={KEY:'save',load:()=>saved,loadSlot:slot=>slots[slot]||null,
    slotList:()=>[1,2,3].map(slot=>({slot,empty:!slots[slot],...slots[slot]})),
    save:state=>{if(saveFails)return false;saved=JSON.parse(JSON.stringify(state));return true;}};
  host.wx.removeStorageSync=()=>{};page.refresh=()=>{};
  page.setData=function(value,callback){Object.assign(this.data,value);callback?.();};
  install(page,{host,boards,storage});
  return {page,host,store,requests,storage,failSaves(value){saveFails=value;},use:()=>page.consumeAdCard({scene:'promotion',reward:()=>{rewards++;page.data.state.promotionAdUsedYear=page.data.state.year;page.data.state.promotionAdWatchCount++;}}),counts:()=>({balance,rewards,debits,opened})};
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

const boardFormatters=require('../../services/leaderboard-api');
test('guests view all three original boards with upstream ranks and totals and without submitting scores',async()=>{
 const routes=[];
 const f=fixture({user:false,boards:boardFormatters,boardRequest:async route=>{routes.push(route);return {ok:true,total:89433,rank:null,entries:[{rank:1,name:'历史玩家',rankIndex:11}]};}});
 for(const method of ['showLeaderboard','showTigerBoard','showEscapeBoard']){
  await f.page[method]();
  assert.equal(f.page.data.dialog.rows.find(row=>row.kind==='entry').name,'历史玩家');
  assert.equal(f.page.data.dialog.rows.find(row=>row.kind==='entry').rank,1);
  assert.ok(f.page.data.dialog.rows.some(row=>row.text?.includes('89433')));
 }
 assert.deepEqual(routes,['/public/leaderboard?limit=8','/public/tigerboard?limit=8','/public/escapeboard?limit=8']);
 assert.equal(f.counts().opened,0);assert.equal(f.counts().debits,0);
});

test('late or failed leaderboard reads never replace another board or pretend local scores are shared data',async()=>{
 const pending={};
 const f=fixture({user:false,boards:boardFormatters,boardRequest:route=>new Promise((resolve,reject)=>{pending[route]={resolve,reject};})});
 const first=f.page.showLeaderboard(),second=f.page.showTigerBoard();
 pending['/public/tigerboard?limit=8'].resolve({ok:true,total:12,entries:[{rank:1,name:'旧虎榜',rankIndex:8}]});await second;
 pending['/public/leaderboard?limit=8'].resolve({ok:true,total:2,entries:[{rank:1,name:'延迟旧响应'}]});await first;
 assert.equal(f.page.data.dialog.title,'步云录 · 老虎榜');
 assert.equal(f.page.data.dialog.rows.find(row=>row.kind==='entry').name,'旧虎榜');
 const third=f.page.showEscapeBoard();pending['/public/escapeboard?limit=8'].reject(new Error('offline'));await third;
 assert.ok(f.page.data.dialog.rows.some(row=>/连接失败/.test(row.text)));
 assert.equal(f.page.data.dialog.rows.some(row=>row.kind==='entry'),false);
});

test('save loading requires confirmation; cancelling, empty and unreadable slots spend nothing',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 f.page.load();assert.match(f.page.sheet.content,/1 张/);
 f.page.sheet.success({tapIndex:1});assert.equal(f.counts().debits,0);
 f.page.sheet.success({tapIndex:0});f.page.data.dialog.success({confirm:false});
 assert.equal(f.counts().debits,0);await f.page.useLoadAdCard(2);assert.equal(f.counts().debits,0);
});
test('lost load response retries the saved snapshot once even if the slot changes',async()=>{
 const slots={1:{name:'原存档',year:2024,age:30,rankIndex:1}};
 const f=fixture({slots,failAfterDebit:true});await new Promise(resolve=>setImmediate(resolve));
 const before=f.page.data.state;await f.page.useLoadAdCard(1);
 assert.equal(f.page.data.state,before);assert.equal(f.counts().debits,1);
 slots[1]={name:'新存档',year:2030};
 await f.page.useLoadAdCard(1);
 assert.equal(f.counts().debits,1);assert.equal(f.requests[0],f.requests[1]);
 assert.equal(f.page.data.state.name,'原存档');assert.equal(f.storage.load().name,'原存档');
 assert.equal(f.page.cardBalance(),9);assert.equal(f.host.BuyunluCardAccount.canChange(),true);
 assert.equal(JSON.parse(f.store.get('buyunlu_paid_card_use:one')).request,null);
});
test('a confirmed load whose local save fails remains retryable without another debit',async()=>{
 const f=fixture({saveFails:true});await new Promise(resolve=>setImmediate(resolve));
 await f.page.useLoadAdCard(1);await f.page.useLoadAdCard(1);
 assert.equal(f.counts().debits,1);assert.equal(f.host.BuyunluCardAccount.canChange(),false);
 assert.equal(f.page.data.state.name,undefined);
});
test('guests cannot load a paid save or bypass payment through applyLoadedSlot',async()=>{
 const f=fixture({user:false});await new Promise(resolve=>setImmediate(resolve));
 await f.page.applyLoadedSlot(1);assert.equal(f.counts().debits,0);assert.equal(f.counts().opened,1);
});

test('distinct completed loads each cost one card and cannot restore the wallet',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 await f.page.useLoadAdCard(1);await f.page.useLoadAdCard(1);
 assert.equal(f.counts().debits,2);assert.equal(f.page.cardBalance(),8);assert.notEqual(f.requests[0],f.requests[1]);
});
test('storage failure before debit cannot spend a card',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 f.host.localStorage.setItem=()=>{throw new Error('disk full');};
 await f.page.useLoadAdCard(1);assert.equal(f.counts().debits,0);
});
test('a completion receipt prevents reapplying progress when journal completion fails and is retried',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 const write=f.host.localStorage.setItem;let count=0;
 f.host.localStorage.setItem=(key,value)=>{if(++count===2)throw new Error('journal unavailable');write(key,value);};
 await f.page.useLoadAdCard(1);assert.equal(f.counts().debits,1);
 const receipt=f.page.data.state._paidLoadRequest;
 f.page.data.state.year=2025;f.storage.save(f.page.data.state);
 // Restore the durable pending request just as a fresh page would.
 install(f.page,{host:f.host,storage:f.storage});await new Promise(resolve=>setImmediate(resolve));
 await f.page.useLoadAdCard(1);
 assert.equal(f.counts().debits,1);assert.equal(f.page.data.state.year,2025);assert.equal(f.page.data.state._paidLoadRequest,receipt);
});

test('another tab switching account cannot cause a stale page to debit its new wallet',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 f.host.BuyunluCardAccount.restore=async()=>{f.host.BuyunluCardAccount.user={id:'other',emailVerified:true};};
 await f.use();assert.equal(f.counts().debits,0);assert.equal(f.counts().rewards,0);
});

test('account revalidation failure cannot debit and overlapping clicks issue one account-bound request',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 f.host.BuyunluCardAccount.restore=async()=>{throw new Error('offline');};
 await f.use();assert.equal(f.counts().debits,0);
 let resume;f.host.BuyunluCardAccount.restore=()=>new Promise(resolve=>{resume=resolve;});
 const first=f.use();await new Promise(resolve=>setImmediate(resolve));const second=f.use();resume();await Promise.all([first,second]);
 assert.equal(f.counts().debits,1);assert.equal(f.counts().rewards,1);
});

test('pending review and evidence decisions are restored before advancing another quarter',()=>{
 const offline=require('../offline');
 for(const pending of [{pendingInterrogation:{year:2026,risk:50}},{pendingEvidenceWarning:{year:2026,stage:'choice',seed:1}}]){
  let advanced=0,restored=0;
  const page={data:{state:{name:'测试',...pending},dialog:{}},startQuarter(){advanced++;},maybeBurstEvent(){restored++;}};
  offline.install(page,{core:{},storage:{},host:{wx:{}},leaderboard:{}});
  page.startQuarter();assert.equal(advanced,0);assert.equal(restored,1);
 }
});

test('an account change after a lost debit response retains the original receipt for later recovery',async()=>{
 let reject=false,changed=false;
 const f=fixture({failAfterDebit:true,consumeRequest:()=>{if(reject){changed=true;throw Object.assign(new Error('登录账号已变化'),{status:409});}}});await new Promise(resolve=>setImmediate(resolve));
 await f.use();const pending=JSON.parse(f.store.get('buyunlu_paid_card_use:one')).request.requestId;
 f.host.BuyunluCardAccount.restore=async()=>{if(changed&&f.host.BuyunluCardAccount.user.id!=='other'){f.host.BuyunluCardAccount.user={id:'other',emailVerified:true};f.host.BuyunluCardAccount.onChange();}};
 reject=true;await f.use();assert.equal(JSON.parse(f.store.get('buyunlu_paid_card_use:one')).request.requestId,pending);
 changed=false;reject=false;f.host.BuyunluCardAccount.user={id:'one',emailVerified:true};f.host.BuyunluCardAccount.onChange();
 await f.use();assert.equal(f.counts().debits,1);assert.equal(f.counts().rewards,1);
});

test('promotion dialog exposes one consistently named paid card action and preserves the other action mapping',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));let used=0,selected;
 f.page.usePromotionAdCard=()=>used++;
 f.page.showActionSheet({title:'完整晋升路线',content:'本年度晋升申请：未使用。',itemList:['查看晋升条件','用免广告卡，晋升概率+3%（剩10张）','看广告，晋升概率+3%'],success:result=>{selected=result.tapIndex;}});
 assert.equal(f.page.sheet.tone,'promotion');assert.equal(f.page.sheet.itemList.length,2);
 assert.equal(f.page.sheet.itemList.filter(text=>text.includes('广告卡')).length,1);assert.equal(f.page.sheet.itemList.some(text=>text.includes('免广告卡')),false);
 f.page.sheet.success({tapIndex:0});assert.equal(selected,0);f.page.sheet.success({tapIndex:1});assert.equal(used,1);
});

test('the unified promotion action offers purchase when there is no card and never debits',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));f.page.setPay({balance:0});
 f.page.showActionSheet({title:'完整晋升路线',content:'',itemList:['查看晋升条件','看广告，晋升概率+3%']});
 assert.equal(f.page.sheet.itemList[1],'购买广告卡');f.page.sheet.success({tapIndex:1});
 assert.equal(f.counts().opened,1);assert.equal(f.counts().debits,0);
});

test('annual application and current-rank cap still allow a bonus for future career promotions',async()=>{
 for(const applied of [true,false]){
  const f=fixture();await new Promise(resolve=>setImmediate(resolve));
  if(applied)f.page.data.state.promotionAppliedYear=2026;else f.page.data.promotionChanceText='100%';
  await f.use();assert.equal(f.counts().debits,1);assert.equal(f.counts().rewards,1);
  f.page.showActionSheet({title:'完整晋升路线',content:'',itemList:['查看晋升条件','用免广告卡，晋升概率+3%（剩10张）','看广告，晋升概率+3%']});
  assert.equal(f.page.sheet.itemList.filter(text=>/广告卡/.test(text)).length,1);
  assert.match(f.page.sheet.content,/本局生涯/);
 }
});

test('a fully boosted career never spends another card',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));f.page.data.state.promotionAdWatchCount=33;
 await f.use();assert.equal(f.counts().debits,0);assert.equal(f.counts().rewards,0);
 f.page.showActionSheet({title:'完整晋升路线',content:'',itemList:['查看晋升条件','看广告，晋升概率+3%']});
 assert.equal(f.page.sheet.itemList.filter(text=>/广告卡/.test(text)).length,0);
 assert.match(f.page.sheet.content,/本局.*100%/);
});

test('upgrading a pending annual receipt grants its missing reward without mistaking an old-year count for completion',async()=>{
 const request={requestId:crypto.randomUUID(),scene:'promotion',year:2027,rankIndex:1,before:0};
 const store=new Map([['buyunlu_paid_card_use:one',JSON.stringify({request,applied:[]})]]);
 const f=fixture({store,state:{year:2027,rankIndex:1,promotionAdUsedYear:2026,promotionAdWatchCount:4}});
 await new Promise(resolve=>setImmediate(resolve));await f.use();
 assert.equal(f.counts().rewards,1);assert.equal(f.page.data.state.promotionAdWatchCount,5);assert.equal(f.counts().debits,1);
});

test('a career reward that cannot be saved stays pending and retries without another debit or bonus',async()=>{
 const f=fixture({saveFails:true});await new Promise(resolve=>setImmediate(resolve));await f.use();
 assert.equal(f.counts().debits,1);assert.equal(f.counts().rewards,1);
 assert.ok(JSON.parse(f.store.get('buyunlu_paid_card_use:one')).request);
 assert.equal(f.host.BuyunluCardAccount.canChange(),false);
 f.failSaves(false);await f.use();
 assert.equal(f.counts().debits,1);assert.equal(f.counts().rewards,1);assert.equal(f.storage.load().promotionAdWatchCount,1);
 assert.equal(JSON.parse(f.store.get('buyunlu_paid_card_use:one')).request,null);
});

test('a pending debit blocks promotion and remains confirmable from a capped promotion dialog',async()=>{
 const f=fixture({failAfterDebit:true});await new Promise(resolve=>setImmediate(resolve));
 await f.use();f.page.tryPromotion();assert.equal(f.page.data.state.promotionAppliedYear,undefined);
 f.page.data.promotionChanceText='100%';f.page.setPay({balance:0});f.page.usePromotionAdCard=f.use;
 f.page.showActionSheet({title:'完整晋升路线',content:'',itemList:['查看晋升条件','看广告，晋升概率+3%']});
 const index=f.page.sheet.itemList.findIndex(text=>text.includes('确认上次用卡'));assert.ok(index>=0);
 await f.page.sheet.success({tapIndex:index});assert.equal(f.counts().debits,1);assert.equal(f.counts().rewards,1);assert.equal(f.host.BuyunluCardAccount.canChange(),true);
});
