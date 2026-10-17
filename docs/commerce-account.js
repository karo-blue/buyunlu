(function() {
  'use strict';
  const byId = id => document.getElementById(id), api = window.BuyunluAPI.request;
  const screen = byId('commerce-account');
  let registering = false, busy = false, afterLogin = false, retryAt = 0, opener, verificationEmail = '';
  const controller = window.BuyunluCardAccount = { user: null, onChange() {}, open, checkout, ready: null };
  function error(cause) { byId('commerce-error').textContent = cause.message || '暂时无法连接服务，请重试'; }
  function lock(value) { busy = value; screen.setAttribute('aria-busy', String(value)); for (const button of screen.querySelectorAll('button')) button.disabled = value;
    if(value)byId('commerce-status').textContent='正在处理，请稍候…';else if(byId('commerce-status').textContent==='正在处理，请稍候…')byId('commerce-status').textContent=''; }
  function close() { if (busy) return; screen.hidden = true; byId('app').inert = false; opener?.focus?.(); }
  function returnToCheckout() {
    const id = new URLSearchParams(location.search).get('order');
    location.assign('checkout.html' + (id && /^[A-Za-z0-9]{20,64}$/.test(id) ? '?order=' + id : ''));
  }
  function finish(user) {
    controller.user = user;
    controller.onChange();
    if (afterLogin || new URLSearchParams(location.search).get('checkout') === '1') returnToCheckout();
    else { lock(false); close(); }
  }
  function showVerify(result, sent) {
    const user = result.user;
    byId('commerce-login-form').hidden = true; byId('commerce-verify-form').hidden = false;
    byId('commerce-title').textContent = '验证购卡账号邮箱';
    byId('commerce-verify-email').value = user.email || ''; byId('commerce-code').value = '';
    verificationEmail = (user.email || '').trim().toLowerCase();
    retryAt = Date.now() + (result.retryAfter || 0) * 1000;
    byId('commerce-status').textContent = sent ? '验证码已发送，请检查邮箱及垃圾邮件，10分钟内有效。' : '请验证邮箱后继续；可以输入已收到的验证码。';
  }
  function open(wantsCheckout = false) {
    afterLogin = wantsCheckout; opener = document.activeElement;
    screen.hidden = false; byId('app').inert = true;
    byId('commerce-error').textContent = ''; byId('commerce-status').textContent = '';
    byId('commerce-login-form').hidden = false; byId('commerce-verify-form').hidden = true;
    byId('commerce-current').hidden = byId('commerce-logout').hidden = !controller.user;
    byId('commerce-current').textContent = controller.user ? '当前购卡账号：' + controller.user.username : '';
    byId('commerce-username').focus();
  }
  async function checkout() { await controller.ready; if (controller.user?.emailVerified) returnToCheckout(); else open(true); }
  byId('commerce-close').addEventListener('click', close);
  byId('commerce-toggle').addEventListener('click', () => {
    registering = !registering;
    byId('commerce-title').textContent = registering ? '注册购卡账号' : '登录购卡账号';
    byId('commerce-identifier-label').textContent = registering ? '用户名' : '用户名或邮箱';
    byId('commerce-identifier-help').textContent = registering ? '3～24 位英文字母、数字或下划线' : '可使用用户名或已验证邮箱登录';
    byId('commerce-username').pattern = registering ? '[A-Za-z0-9_]{3,24}' : '.*';
    byId('commerce-username').minLength = registering ? 3 : 1;
    byId('commerce-username').maxLength = registering ? 24 : 254;
    byId('commerce-email-field').hidden = !registering;
    byId('commerce-email').disabled = !registering; byId('commerce-email').required = registering;
    byId('commerce-password').autocomplete = registering ? 'new-password' : 'current-password';
    byId('commerce-password').maxLength = registering ? 20 : 128;
    byId('commerce-submit').textContent = registering ? '注册并发送验证码' : '登录';
    byId('commerce-toggle').textContent = registering ? '已有账号？登录' : '没有账号？注册';
  });
  byId('commerce-login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if(controller.user && controller.canChange?.()===false)return error(new Error('上次用卡结果未确认，请先重试用卡'));
    lock(true); byId('commerce-error').textContent = '';
    try {
      const body = { username: byId('commerce-username').value, password: byId('commerce-password').value };
      if (registering) body.email = byId('commerce-email').value.trim();
      const result = await api(registering ? '/register' : '/login', body);
      byId('commerce-password').value = '';
      if (result.user.emailVerified) finish(result.user); else showVerify(result, registering);
    } catch(cause) { error(cause); } finally { lock(false); }
  });
  byId('commerce-send').addEventListener('click', async () => {
    if (busy) return;
    if (Date.now() < retryAt) return error(new Error('请等待 ' + Math.ceil((retryAt-Date.now())/1000) + ' 秒后重发'));
    if (!byId('commerce-verify-email').reportValidity()) return;
    lock(true); byId('commerce-error').textContent = '';
    try { const result = await api('/email/send', {email:byId('commerce-verify-email').value.trim()}); showVerify(result,true); }
    catch(cause) { error(cause); if(cause.retryAfter) retryAt=Date.now()+cause.retryAfter*1000; } finally { lock(false); }
  });
  byId('commerce-verify-form').addEventListener('submit', async event => {
    event.preventDefault(); if(busy) return;
    if (byId('commerce-verify-email').value.trim().toLowerCase() !== verificationEmail) return error(new Error('邮箱已修改，请先向新邮箱发送验证码'));
    lock(true); byId('commerce-error').textContent = '';
    try { const result = await api('/email/verify',{code:byId('commerce-code').value.trim()}); finish(result.user); }
    catch(cause) { error(cause); } finally { lock(false); }
  });
  byId('commerce-logout').addEventListener('click', async () => {
    if(busy) return;
    if(controller.canChange?.()===false)return error(new Error('上次用卡结果未确认，请先重试用卡'));
    lock(true);
    try { await api('/logout',{}); controller.user=null; controller.onChange(); byId('commerce-current').hidden=byId('commerce-logout').hidden=true; }
    catch(cause) { error(cause); } finally { lock(false); }
  });
  screen.addEventListener('keydown', event => {
    if(event.key==='Escape') {event.stopPropagation();close();}
    if(event.key==='Tab') {
      const controls=[...screen.querySelectorAll('button,input')].filter(node=>!node.disabled && node.getClientRects().length);
      if(!controls.length)return;
      if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls[controls.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===controls[controls.length-1]){event.preventDefault();controls[0].focus();}
    }
  });
  controller.ready = (window.BuyunluAPI.hasSession() ? api('/account').then(result=>{controller.user=result.user;}) : Promise.resolve()).catch(()=>{}).then(()=>{
    const query=new URLSearchParams(location.search);
    if(query.get('checkout')==='1') checkout(); else if(query.get('account')==='1') open();
  });
})();
