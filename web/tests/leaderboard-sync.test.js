'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const {install}=require('../commerce'),core=require('../../game/core');
const originalBoards=require('../../services/leaderboard-api');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture({ended=true,user=true,submit,apiRequest}={}){
 const boards={...originalBoards},calls=[],toasts=[],records=new Map();let saved;
 const host={localStorage:{getItem:()=>null,setItem(){}},wx:{showToast:message=>toasts.push(message.title)},
  BuyunluCardAccount:{user:user?{id:'h5-one',username:'player_one',emailVerified:true}:null,ready:Promise.resolve(),open(){},checkout(){}},
  BuyunluAPI:{request:async(route,body)=>{
   if(route==='/pay/balance')return {ok:true,balance:10};
   calls.push({route,body});
   if(apiRequest)return apiRequest(route,body);
   if(route==='/leaderboard/submit'){
    await submit?.(body);
    records.set(body.accountId,body);
   }
   const owner=host.BuyunluCardAccount.user?.id,own=records.get(owner);
   return {ok:true,total:100+records.size,rank:own?1:null,entries:own?[{...own,name:'player_one',rank:1,isPlayer:true}]:[{name:'历史玩家',rank:1,rankIndex:1}]};
  }}};
 const storage={load:()=>saved,save:state=>{saved=JSON.parse(JSON.stringify(state));return true;},slotList:()=>[],loadSlot:()=>null};
 const pageFile=path.resolve(__dirname,'../../pages/index/index.js'),localRequire=createRequire(pageFile);let page;
 vm.runInNewContext(fs.readFileSync(pageFile,'utf8'),{
  require:id=>id==='../../services/leaderboard-api'?boards:id==='../../services/storage'?storage:localRequire(id),
  Page:definition=>{page=definition;},wx:host.wx,setTimeout,clearTimeout,console
 },{filename:pageFile});
 page.data.state={...core.newState(),name:'游戏角色',age:60,ended,ending:ended?'正常退休':''};
 page.setData=function(values,callback){for(const [key,value] of Object.entries(values)){const parts=key.split('.');let target=this.data;for(const part of parts.slice(0,-1))target=target[part]||(target[part]={});target[parts.at(-1)]=value;}callback?.();};
 page.showModal=function(options){this.data.dialog={...options,visible:true};};
 install(page,{host,boards,storage});
 return {page,boards,host,calls,toasts,records,storage};
}

test('the real ending handler uploads through the authenticated account and displays its new shared rank',async()=>{
 const f=fixture();f.page.showEnding();await tick();
 const posts=f.calls.filter(call=>call.body);
 assert.equal(posts.length,1);assert.equal(posts[0].route,'/leaderboard/submit');
 assert.equal(posts[0].body.accountId,'h5-one');assert.equal(posts[0].body.clientId,undefined);
 assert.equal(posts[0].body.rankIndex,f.page.data.state.rankIndex);
 assert.equal(f.storage.load()._webLeaderboardOwner,'h5-one');
 await f.page.showLeaderboard();
 assert.equal(f.calls.filter(call=>call.body).length,1);
 assert.equal(f.calls.at(-1).route,'/leaderboard?limit=8');
 assert.ok(f.page.data.dialog.rows.some(row=>row.player===true));
 assert.ok(f.page.data.dialog.rows.some(row=>row.text?.includes('101')));
});

test('unfinished careers and anonymous board views never upload scores',async()=>{
 const f=fixture({ended:false});await f.page.showLeaderboard();
 assert.equal(f.calls.some(call=>call.body),false);assert.equal(f.calls.at(-1).route,'/leaderboard?limit=8');
 const guest=fixture({user:false});
 for(const method of ['showLeaderboard','showTigerBoard','showEscapeBoard'])await guest.page[method]();
 assert.deepEqual(guest.calls.map(call=>call.route),['/public/leaderboard?limit=8','/public/tigerboard?limit=8','/public/escapeboard?limit=8']);
 assert.equal(guest.calls.some(call=>call.body),false);
});

test('concurrent ending and board requests share one upload and wait for its result',async()=>{
 let finish;const f=fixture({submit:()=>new Promise(resolve=>{finish=resolve;})});
 const first=f.boards.submit(f.page.data.state),opened=f.page.showTigerBoard();await tick();
 assert.equal(f.calls.filter(call=>call.body).length,1);
 assert.equal(f.calls.some(call=>call.route==='/tigerboard?limit=8'),false);
 finish();await Promise.all([first,opened]);
 assert.equal(f.calls.at(-1).route,'/tigerboard?limit=8');
});

test('failed uploads are visible, keep the saved ending and retry when a board is reopened',async()=>{
 let failures=2;const f=fixture({submit:()=>{if(failures-->0)throw new Error('offline');}});
 f.page.showEnding();await tick();
 assert.ok(f.toasts.some(text=>text.includes('同步失败')));
 await f.page.showLeaderboard();
 assert.ok(f.page.data.dialog.rows.some(row=>row.text?.includes('尚未同步')));
 assert.equal(f.storage.load().ended,true);
 await f.page.showLeaderboard();
 assert.equal(f.calls.filter(call=>call.body).length,3);
 assert.ok(f.page.data.dialog.rows.some(row=>row.player===true));
 assert.equal(f.records.size,1);
});

test('a saved pending ending remains owned by its original account after an account change',async()=>{
 const f=fixture({submit:()=>{throw new Error('offline');}});
 await assert.rejects(f.boards.submit(f.page.data.state));
 const count=f.calls.filter(call=>call.body).length;
 f.host.BuyunluCardAccount.user={id:'h5-other',username:'other',emailVerified:true};
 await f.page.showLeaderboard();
 assert.equal(f.calls.filter(call=>call.body).length,count);
 assert.equal(f.page.data.state._webLeaderboardOwner,'h5-one');
 assert.ok(f.page.data.dialog.rows.some(row=>row.text?.includes('尚未同步')));
});

test('a delayed response for an old account cannot display its personal ranking to another account',async()=>{
 let finish;const f=fixture({submit:()=>new Promise(resolve=>{finish=resolve;})});
 const opened=f.page.showLeaderboard();await tick();
 f.host.BuyunluCardAccount.user={id:'h5-other',username:'other',emailVerified:true};
 finish();await opened;
 assert.equal(f.page.data.dialog.rows.some(row=>row.player===true),false);
 assert.equal(f.calls.some(call=>call.route==='/leaderboard?limit=8'),false);
});

test('real browser API, account proxy and shared store increase a new player once and keep its personal rank',async t=>{
 const os=require('node:os'),createAPI=require('../commerce-api');
 const {createServer}=require('../../web-server/server'),{createStore,createApiServer}=require('../../server/app');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'buyunlu-board-flow-'));
 const store=createStore(path.join(directory,'leaderboard.json'));
 const upstream=createApiServer({store,payService:{enabled:()=>false,status:()=>({enabled:false}),resolveSession:()=>null}});
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 let code;
 const backend=createServer({dataDir:path.join(directory,'accounts'),origin:'http://localhost',frontendUrl:'https://frontend.example.test/',secure:false,
  upstream:'http://127.0.0.1:'+upstream.address().port+'/api',payments:{},sendVerificationEmail:async message=>{code=message.code;}});
 await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{
  for(const server of [backend,upstream]){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(directory).startsWith('buyunlu-board-flow-'));
  fs.rmSync(directory,{recursive:true,force:true});
 });
 const sessions=new Map();
 const api=createAPI({AbortController,setTimeout,clearTimeout,
  localStorage:{getItem:key=>sessions.get(key),setItem:(key,value)=>sessions.set(key,value),removeItem:key=>sessions.delete(key)},
  fetch:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:'https://frontend.example.test'}})
 },{apiBaseUrl:'http://127.0.0.1:'+backend.address().port+'/api'});
 await api.request('/register',{username:'board_flow',password:'test-only-password',email:'board@example.test'});
 const account=(await api.request('/email/verify',{code})).user;
 const f=fixture({apiRequest:api.request});f.host.BuyunluCardAccount.user=account;
 f.page.showEnding();await f.boards.submit(f.page.data.state);await f.page.showLeaderboard();
 assert.equal(store.ranking().total,1);
 assert.ok(f.page.data.dialog.rows.some(row=>row.player===true&&row.name.includes('board_flow')&&row.name.includes('（本账号）')));
 assert.equal(store.ranking({clientId:account.id}).rank,1);
 const submitted=f.calls.find(call=>call.route==='/leaderboard/submit').body;
 await api.request('/leaderboard/submit',submitted);
 assert.equal(store.ranking().total,1,'Retry updates the same account instead of adding a duplicate');
 await assert.rejects(api.request('/leaderboard/submit',{...submitted,accountId:'h5-other'}),error=>error.status===409);
 assert.equal(store.ranking().total,1);
 assert.equal(core.normalizeState(f.storage.load())._webLeaderboardOwner,account.id);
});
