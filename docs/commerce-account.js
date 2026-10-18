(function() {
  'use strict';
  const byId = id => document.getElementById(id), api = window.BuyunluAPI.request;
  const screen = byId('commerce-account');
  let registering = false, busy = false, afterLogin = false, retryAt = 0, opener, verificationEmail = '', loginRetryAt = 0, loginTimer;
  const controller = window.BuyunluCardAccount = { user: null, onChange() {}, open, checkout, restore, ready: null };
  let restoring;
  function restore() {
    if (restoring) return restoring;
    restoring = (async () => {
      const previous = controller.user;
      let user = null;
      if (window.BuyunluAPI.hasSession()) {
        try { user = (await api('/account')).user; }
        catch (cause) { if (cause.status !== 401) throw cause; }
      }
      controller.user = user;
      if (previous?.id !== user?.id || previous?.emailVerified !== user?.emailVerified) controller.onChange();
      return user;
    })().finally(() => { restoring = null; });
    return restoring;
  }
  function error(cause, field) {
    byId('commerce-status').textContent = '';
    byId('commerce-error').textContent = cause.name === 'AbortError' ? (field ? '请求超时，暂未确认验证码是否发出。请先检查邮箱，未收到再重试。' : '请求超时，请稍后重试。')
      : cause.name === 'TypeError' ? '网络连接失败，请检查网络后重试。' : cause.message || '暂时无法连接服务，请重试';
    if (field && cause.code === 'SMTP_RECIPIENT_INVALID') { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  function validateEmail(field) {
    const email = field.value.trim().toLowerCase();
    const valid = email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)
      && email.split('@')[0].length <= 64 && !email.startsWith('.') && !email.includes('..') && !email.includes('.@');
    field.setAttribute('aria-invalid', String(!valid));
    if (!valid) {
      error(new Error(!email ? '请输入完整邮箱地址，例如 123456@qq.com。' : email.includes('＠') ? '邮箱中的 @ 请使用英文半角字符，例如 123456@qq.com。'
        : '邮箱格式不正确，请检查 @、空格和邮箱后缀，例如 123456@qq.com。'));
      field.focus(); return false;
    }
    field.value = email; return true;
  }
  function deliveryHelp(email) {
    byId('commerce-delivery-help').hidden = false;
    byId('commerce-delivery-help').setAttribute('aria-expanded', 'false');
    byId('commerce-delivery-detail').hidden = true;
    byId('commerce-delivery-detail').textContent = '请先核对收件邮箱 ' + email + '，特别是账号数字和后缀，并检查垃圾邮件。确认邮箱能正常收信后再重发；验证邮箱可修改为其他可用邮箱。邮件可能稍后才退回，提交发送不代表已送达。';
  }
  for (const id of ['commerce-email', 'commerce-login-email', 'commerce-verify-email']) {
    const field = byId(id);
    field.addEventListener('invalid', event => { event.preventDefault(); validateEmail(field); });
    field.addEventListener('input', () => {
      field.setAttribute('aria-invalid', 'false'); byId('commerce-error').textContent = ''; byId('commerce-status').textContent = '';
      byId('commerce-delivery-help').hidden = true; byId('commerce-delivery-detail').hidden = true;
    });
  }
  byId('commerce-delivery-help').addEventListener('click', () => {
    const detail = byId('commerce-delivery-detail'); detail.hidden = !detail.hidden;
    byId('commerce-delivery-help').setAttribute('aria-expanded', String(!detail.hidden));
  });
  function lock(value) { busy = value; screen.setAttribute('aria-busy', String(value)); for (const button of screen.querySelectorAll('button')) button.disabled = value;
    renderLoginSend();
    if(value)byId('commerce-status').textContent='正在处理，请稍候…';else if(byId('commerce-status').textContent==='正在处理，请稍候…')byId('commerce-status').textContent=''; }
  function close() { if (busy) return; clearInterval(loginTimer); screen.hidden = true; byId('app').inert = false; opener?.focus?.(); }
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
    byId('commerce-login-modes').hidden = true; byId('commerce-code-login-form').hidden = true;
    byId('commerce-login-form').hidden = true; byId('commerce-verify-form').hidden = false;
    byId('commerce-title').textContent = '验证购卡账号邮箱';
    byId('commerce-verify-email').value = user.email || ''; byId('commerce-code').value = '';
    verificationEmail = (user.email || '').trim().toLowerCase();
    retryAt = Date.now() + (result.retryAfter || 0) * 1000;
    byId('commerce-status').textContent = sent ? '验证码已提交发送至 ' + user.email + '，10分钟内有效。请检查收件箱及垃圾邮件。' : '请验证邮箱后继续；可以输入已收到的验证码。';
    deliveryHelp(user.email || '');
  }
  function open(wantsCheckout = false) {
    afterLogin = wantsCheckout; opener = document.activeElement;
    screen.hidden = false; byId('app').inert = true;
    byId('commerce-error').textContent = ''; byId('commerce-status').textContent = '';
    byId('commerce-delivery-help').hidden = true; byId('commerce-delivery-detail').hidden = true;
    setLoginMode('password');
    byId('commerce-current').hidden = byId('commerce-logout').hidden = !controller.user;
    byId('commerce-current').textContent = controller.user ? '当前购卡账号：' + controller.user.username : '';
    byId('commerce-username').focus();
  }
  async function checkout() {
    await controller.ready;
    try { await restore(); }
    catch { return window.wx?.showToast({ title: '账号服务暂时连接失败，请稍后重试，无需重新登录' }); }
    if (controller.user?.emailVerified) returnToCheckout(); else open(true);
  }
  byId('commerce-close').addEventListener('click', close);
  function setRegistering(value) {
    registering = value;
    byId('commerce-error').textContent = ''; byId('commerce-status').textContent = '';
    byId('commerce-delivery-help').hidden = true; byId('commerce-delivery-detail').hidden = true;
    byId('commerce-login-modes').hidden = registering;
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
  }
  function renderLoginSend() {
    const remaining = Math.max(0, Math.ceil((loginRetryAt - Date.now()) / 1000));
    byId('commerce-login-send').disabled = busy || remaining > 0;
    byId('commerce-login-send').textContent = remaining ? remaining + '秒后重发' : '发送验证码';
    if (!remaining) clearInterval(loginTimer);
  }
  function startLoginCountdown() {
    clearInterval(loginTimer); renderLoginSend();
    if (loginRetryAt > Date.now()) loginTimer = setInterval(renderLoginSend, 1000);
  }
  function setLoginMode(mode) {
    if (busy) return;
    setRegistering(false);
    const code = mode === 'code';
    byId('commerce-login-modes').hidden = false;
    byId('commerce-verify-form').hidden = true;
    byId('commerce-login-form').hidden = code;
    byId('commerce-code-login-form').hidden = !code;
    byId('commerce-mode-password').setAttribute('aria-pressed', String(!code));
    byId('commerce-mode-code').setAttribute('aria-pressed', String(code));
    byId('commerce-title').textContent = code ? '邮箱验证码登录' : '登录购卡账号';
    byId('commerce-error').textContent = ''; byId('commerce-status').textContent = '';
    byId('commerce-password').value = '';
    startLoginCountdown();
    byId(code ? 'commerce-login-email' : 'commerce-username').focus();
  }
  byId('commerce-mode-password').addEventListener('click', () => setLoginMode('password'));
  byId('commerce-mode-code').addEventListener('click', () => setLoginMode('code'));
  byId('commerce-toggle').addEventListener('click', () => { if (!busy) setRegistering(!registering); });
  byId('commerce-code-register').addEventListener('click', () => { if (!busy) { setLoginMode('password'); setRegistering(true); } });
  byId('commerce-login-send').addEventListener('click', async () => {
    const field = byId('commerce-login-email');
    if (busy || Date.now() < loginRetryAt || !validateEmail(field)) return;
    const email = field.value;
    lock(true); byId('commerce-error').textContent = '';
    try {
      const result = await api('/login/email/send', { email });
      loginRetryAt = Date.now() + result.retryAfter * 1000;
      byId('commerce-status').textContent = result.message;
      deliveryHelp(email);
      byId('commerce-login-code').focus();
    } catch (cause) { error(cause, field); if (cause.retryAfter) loginRetryAt = Date.now() + cause.retryAfter * 1000; }
    finally { lock(false); startLoginCountdown(); }
  });
  byId('commerce-code-login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (controller.user && controller.canChange?.() === false) return error(new Error('上次用卡结果未确认，请先重试用卡'));
    lock(true); byId('commerce-error').textContent = '';
    try {
      const result = await api('/login/email/verify', { email: byId('commerce-login-email').value.trim().toLowerCase(), code: byId('commerce-login-code').value.trim() });
      byId('commerce-login-code').value = ''; clearInterval(loginTimer);
      finish(result.user);
    } catch (cause) { error(cause); } finally { lock(false); }
  });
  byId('commerce-login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (registering && !validateEmail(byId('commerce-email'))) return;
    if(controller.user && controller.canChange?.()===false)return error(new Error('上次用卡结果未确认，请先重试用卡'));
    lock(true); byId('commerce-error').textContent = '';
    try {
      const body = { username: byId('commerce-username').value, password: byId('commerce-password').value };
      if (registering) body.email = byId('commerce-email').value.trim();
      const result = await api(registering ? '/register' : '/login', body);
      byId('commerce-password').value = '';
      if (result.user.emailVerified) finish(result.user); else showVerify(result, registering);
    } catch(cause) { error(cause, registering ? byId('commerce-email') : null); } finally { lock(false); }
  });
  byId('commerce-send').addEventListener('click', async () => {
    if (busy) return;
    if (Date.now() < retryAt) return error(new Error('请等待 ' + Math.ceil((retryAt-Date.now())/1000) + ' 秒后重发'));
    if (!validateEmail(byId('commerce-verify-email'))) return;
    lock(true); byId('commerce-error').textContent = '';
    try { const result = await api('/email/send', {email:byId('commerce-verify-email').value.trim()}); showVerify(result,true); }
    catch(cause) { error(cause, byId('commerce-verify-email')); if(cause.retryAfter) retryAt=Date.now()+cause.retryAfter*1000; } finally { lock(false); }
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
  controller.ready = restore().catch(()=>{}).then(()=>{
    const query=new URLSearchParams(location.search);
    if(query.get('checkout')==='1') checkout(); else if(query.get('account')==='1') open();
  });
})();
