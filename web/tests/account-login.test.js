
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function fixture({canChange=true,failSend=false,sendError,user={id:'existing',username:'player123',email:'registered@example.test',emailVerified:true}}={}){
 const nodes=new Map(),calls=[];
 const byId=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,attributes:{},listeners:{},textContent:'',
  setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},focus(){},reportValidity:()=>true,getClientRects:()=>[{}],querySelectorAll:()=>[]});return nodes.get(id);};
 const host={BuyunluAPI:{hasSession:()=>false,request:async(route,body)=>{calls.push({route,body});if(route.endsWith('/send')){if(sendError)throw sendError;if(failSend)throw new Error('发送失败');return {ok:true,user,retryAfter:60,message:'验证码已提交发送，请检查邮箱'};}return {ok:true,user,retryAfter:60};}}};
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

test('invalid email addresses are explained before registration, resend or code login can send a request', async () => {
 for (const email of ['', '12345＠qq.com', '12345@qq', 'a..b@qq.com', 'a b@qq.com']) {
  const f = await fixture(); await f.emit('commerce-mode-code', 'click'); f.byId('commerce-login-email').value = email;
  await f.emit('commerce-login-send', 'click');
  assert.equal(f.calls.length, 0); assert.match(f.byId('commerce-error').textContent, /邮箱|@/);
  assert.equal(f.byId('commerce-login-email').attributes['aria-invalid'], 'true');
 }
 const f = await fixture(); await f.emit('commerce-toggle', 'click'); f.byId('commerce-email').value = 'bad';
 await f.emit('commerce-login-form', 'submit'); assert.equal(f.calls.length, 0);
 f.byId('commerce-verify-email').value = 'bad'; await f.emit('commerce-send', 'click'); assert.equal(f.calls.length, 0);
 await f.emit('commerce-email', 'invalid'); assert.match(f.byId('commerce-error').textContent, /邮箱/);
});

test('recipient errors keep the email editable, allow retry and clear stale success feedback', async () => {
 const sendError = Object.assign(new Error('收件邮箱不存在或地址不正确，请核对后重试'), { code: 'SMTP_RECIPIENT_INVALID' });
 const f = await fixture({ sendError }); await f.emit('commerce-mode-code', 'click');
 f.byId('commerce-login-email').value = 'wrong@example.test'; f.byId('commerce-status').textContent = '旧的发送成功';
 await f.emit('commerce-login-send', 'click');
 assert.match(f.byId('commerce-error').textContent, /邮箱不存在/); assert.equal(f.byId('commerce-status').textContent, '');
 assert.equal(f.byId('commerce-login-email').value, 'wrong@example.test');
 assert.equal(f.byId('commerce-login-email').attributes['aria-invalid'], 'true');
 assert.equal(f.byId('commerce-login-send').disabled, false);
});

test('accepted registration offers missing-email help without claiming delivery to the mailbox', async () => {
 const f = await fixture({ user: { id: 'new', username: 'player123', email: 'new@example.test', emailVerified: false } });
 await f.emit('commerce-toggle', 'click'); f.byId('commerce-email').value = 'new@example.test';
 await f.emit('commerce-login-form', 'submit');
 assert.match(f.byId('commerce-status').textContent, /已提交发送/);
 assert.doesNotMatch(f.byId('commerce-status').textContent, /已送达|已发送/);
 assert.equal(f.byId('commerce-delivery-help').hidden, false);
 await f.emit('commerce-delivery-help', 'click');
 assert.match(f.byId('commerce-delivery-detail').textContent, /new@example.test/);
 assert.match(f.byId('commerce-delivery-detail').textContent, /垃圾邮件/);
 assert.match(f.byId('commerce-delivery-detail').textContent, /邮箱/);
});

test('a sending request timeout explains uncertainty and does not start a success countdown', async () => {
 const f = await fixture({ sendError: Object.assign(new Error('aborted'), { name: 'AbortError' }) });
 await f.emit('commerce-mode-code', 'click'); f.byId('commerce-login-email').value = 'registered@example.test';
 await f.emit('commerce-login-send', 'click');
 assert.match(f.byId('commerce-error').textContent, /暂未确认验证码是否发出/);
 assert.equal(f.byId('commerce-status').textContent, ''); assert.equal(f.byId('commerce-login-send').disabled, false);
});
