
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function fixture({canChange=true,failSend=false}={}){
 const nodes=new Map(),calls=[];const user={id:'existing',username:'player123',email:'registered@example.test',emailVerified:true};
 const byId=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,attributes:{},listeners:{},textContent:'',
  setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},focus(){},reportValidity:()=>true,getClientRects:()=>[{}],querySelectorAll:()=>[]});return nodes.get(id);};
 const host={BuyunluAPI:{hasSession:()=>false,request:async(route,body)=>{calls.push({route,body});if(route.endsWith('/send')){if(failSend)throw new Error('发送失败');return {ok:true,retryAfter:60,message:'请检查邮箱'};}return {ok:true,user};}}};
 const context={window:host,document:{getElementById:byId,activeElement:null},URLSearchParams,location:{search:'',assign(){}},Date,
  setInterval:fn=>{const timer=setInterval(fn,1000);timer.unref();return timer;},clearInterval};
 vm.runInNewContext(fs.readFileSync(require.resolve('../commerce-account.js'),'utf8'),context);
 await host.BuyunluCardAccount.ready;host.BuyunluCardAccount.open();host.BuyunluCardAccount.canChange=()=>canChange;
 return {host,nodes,byId,calls,emit:(id,event)=>byId(id).listeners[event]({preventDefault(){}})};
}
test('email code login needs no password, sends a normalized email and preserves the existing identity',async()=>{
 const f=await fixture();await f.emit('commerce-mode-code','click');
 assert.equal(f.byId('commerce-login-form').hidden,true);assert.equal(f.byId('commerce-code-login-form').hidden,false);
 f.byId('commerce-login-email').value='REGISTERED@EXAMPLE.TEST';
 await f.emit('commerce-login-send','click');assert.equal(f.calls[0].route,'/login/email/send');assert.equal(f.calls[0].body.email,'registered@example.test');
 assert.equal(f.byId('commerce-login-send').disabled,true);
 f.byId('commerce-login-code').value='123456';await f.emit('commerce-code-login-form','submit');
 assert.equal(f.calls[1].route,'/login/email/verify');assert.equal(f.calls[1].body.code,'123456');assert.equal(f.calls[1].body.password,undefined);
 assert.equal(f.host.BuyunluCardAccount.user.id,'existing');assert.equal(f.byId('commerce-account').hidden,true);
});
test('failed sends show an error and do not fake a successful send',async()=>{
 const f=await fixture({failSend:true});await f.emit('commerce-mode-code','click');f.byId('commerce-login-email').value='registered@example.test';
 await f.emit('commerce-login-send','click');assert.match(f.byId('commerce-error').textContent,/发送失败/);assert.equal(f.byId('commerce-login-send').disabled,false);
});
test('unresolved paid card requests block code-based account switching',async()=>{
 const f=await fixture({canChange:false});f.host.BuyunluCardAccount.user={id:'previous'};
 await f.emit('commerce-mode-code','click');f.byId('commerce-login-email').value='registered@example.test';f.byId('commerce-login-code').value='123456';
 await f.emit('commerce-code-login-form','submit');assert.equal(f.calls.length,0);assert.equal(f.host.BuyunluCardAccount.user.id,'previous');
 assert.match(f.byId('commerce-error').textContent,/用卡/);
});
