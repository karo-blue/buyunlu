
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function fixture({canChange=true,failSend=false,sendError,hasSession=false,accountError,search='',openAfterReady=true,user={id:'existing',username:'player123',email:'registered@example.test',emailVerified:true}}={}){
 const nodes=new Map(),calls=[];
 const byId=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,attributes:{},listeners:{},textContent:'',
  setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},focus(){},reportValidity:()=>true,getClientRects:()=>[{}],querySelectorAll:()=>[]});return nodes.get(id);};
 const session={active:hasSession,user,error:accountError},redirects=[];
 const host={BuyunluAPI:{hasSession:()=>session.active,request:async(route,body)=>{calls.push({route,body});if(route==='/account'){if(session.error)throw session.error;return {user:session.user};}if(route==='/logout')session.active=false;
  if(route.endsWith('/send')){if(sendError)throw sendError;if(failSend)throw new Error('发送失败');return {ok:true,user,retryAfter:60,message:'验证码已提交发送，请检查邮箱'};}
  return {ok:true,user:route.endsWith('/verify')?{...user,emailVerified:true}:user,retryAfter:60};}}};
 const context={window:host,document:{getElementById:byId,activeElement:null},URLSearchParams,location:{search,assign:url=>redirects.push(url)},Date,
  setInterval:fn=>{const timer=setInterval(fn,1000);timer.unref();return timer;},clearInterval};
 vm.runInNewContext(fs.readFileSync(require.resolve('../commerce-account.js'),'utf8'),context);
 await host.BuyunluCardAccount.ready;if(openAfterReady)host.BuyunluCardAccount.open();host.BuyunluCardAccount.canChange=()=>canChange;
 return {host,nodes,byId,calls,session,redirects,emit:(id,event,detail={})=>byId(id).listeners[event]({preventDefault(){},stopPropagation(){},...detail})};
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

test('opening the website requires login and neither close nor Escape can bypass it', async () => {
 const f=await fixture({openAfterReady:false});let started=false;
 assert.equal(typeof f.host.BuyunluCardAccount.access?.then,'function');
 f.host.BuyunluCardAccount.access.then(()=>{started=true;});
 assert.equal(f.byId('commerce-account').hidden,false);assert.equal(f.byId('commerce-close').hidden,true);
 await f.emit('commerce-close','click');await f.emit('commerce-account','keydown',{key:'Escape'});
 assert.equal(f.byId('commerce-account').hidden,false);assert.equal(f.byId('app').hidden,true);assert.equal(f.byId('app').inert,true);assert.equal(started,false);
 await f.emit('commerce-login-form','submit');await f.host.BuyunluCardAccount.access;
 assert.equal(started,true);assert.equal(f.byId('app').hidden,false);assert.equal(f.byId('app').inert,false);
});

test('a verified persistent session enters directly while an unverified session must verify first', async () => {
 const f=await fixture({hasSession:true,openAfterReady:false});await f.host.BuyunluCardAccount.access;
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].route,'/account');assert.equal(f.byId('commerce-account').hidden,true);assert.equal(f.byId('app').hidden,false);
 const pending=await fixture({hasSession:true,openAfterReady:false,user:{id:'pending',email:'new@example.test',emailVerified:false}});
 assert.equal(pending.byId('commerce-verify-form').hidden,false);assert.equal(pending.byId('commerce-close').hidden,true);assert.equal(pending.byId('app').hidden,true);
 pending.byId('commerce-code').value='123456';await pending.emit('commerce-verify-form','submit');await pending.host.BuyunluCardAccount.access;
 assert.equal(pending.byId('app').hidden,false);assert.equal(pending.byId('commerce-account').hidden,true);
});

test('failed session recovery keeps the game locked and offers a working retry', async () => {
 const f=await fixture({hasSession:true,accountError:new TypeError('offline'),openAfterReady:false});
 assert.equal(f.byId('app').hidden,true);assert.equal(f.byId('commerce-retry').hidden,false);assert.match(f.byId('commerce-error').textContent,/登录状态|网络/);
 assert.equal(f.session.active,true,'temporary failure must preserve the credential');
 f.session.error=null;await f.emit('commerce-retry','click');await f.host.BuyunluCardAccount.access;
 assert.equal(f.calls.filter(c=>c.route==='/account').length,2);assert.equal(f.byId('commerce-account').hidden,true);
});

test('logout and an expired session relock the game, and signing in unlocks it again', async () => {
 for(const expired of [false,true]){
  const f=await fixture({hasSession:true,openAfterReady:false});await f.host.BuyunluCardAccount.access;
  if(expired){f.session.error=Object.assign(new Error('expired'),{status:401});await f.host.BuyunluCardAccount.restore();}
  else {f.host.BuyunluCardAccount.open();await f.emit('commerce-logout','click');}
  assert.equal(f.host.BuyunluCardAccount.user,null);assert.equal(f.byId('app').hidden,true);assert.equal(f.byId('app').inert,true);
  assert.equal(f.byId('commerce-account').hidden,false);assert.equal(f.byId('commerce-close').hidden,true);
  await f.emit('commerce-login-form','submit');assert.equal(f.byId('app').hidden,false);assert.equal(f.byId('commerce-account').hidden,true);
 }
});

test('login preserves the checkout destination and verified users can close the account panel', async () => {
 const order='12345678901234567890';
 const f=await fixture({search:'?checkout=1&order='+order,openAfterReady:false});
 assert.equal(f.redirects.length,0);await f.emit('commerce-login-form','submit');assert.equal(f.redirects[0],'checkout.html?order='+order);
 const existing=await fixture({hasSession:true,search:'?account=1',openAfterReady:false});
 assert.equal(existing.byId('commerce-account').hidden,false);assert.equal(existing.byId('commerce-close').hidden,false);
 await existing.emit('commerce-account','keydown',{key:'Escape'});assert.equal(existing.byId('commerce-account').hidden,true);
});
