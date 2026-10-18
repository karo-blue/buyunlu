(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const payButton = byId('pay-button'), checkButton = byId('check-payment'), notice = byId('payment-notice');
  let status, order, user, busy = false, receiptId = '';
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const modeAvailable = () => !mobile || status?.modes?.includes('wap');
  const requestKey = 'buyunlu_alipay_request';
  const amountInput = byId('purchase-yuan'), agreement = byId('purchase-agree');
  const presets = [...document.querySelectorAll('[data-yuan]')];
  const quantity = () => /^[1-9]\d{0,2}$/.test(amountInput.value) && Number(amountInput.value) <= 100 ? Number(amountInput.value) : null;
  async function api(route, body) {
    if (window.BuyunluAPI) return window.BuyunluAPI.request(route, body);
    const response = await fetch('/api' + route, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000), body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw Object.assign(new Error(result.error || '请求失败，请重试'), { status: response.status });
    return result;
  }
  function render() {
    const paid = order?.state === 'paid', available = status?.enabled && user?.emailVerified && modeAvailable();
    const units = order ? order.quantity : quantity();
    const active = order ? order.state === 'pending' && !!order.payUrl : available && units !== null;
    amountInput.disabled = busy || !!order || !!receiptId || !!status?.testOnly;
    for (const preset of presets) { preset.disabled = amountInput.disabled; preset.setAttribute('aria-pressed', String(Number(preset.dataset.yuan) === units)); }
    byId('purchase-terms').hidden = !!order || !!receiptId;
    agreement.disabled = busy || !!order;
    byId('amount-error').textContent = !order && units === null ? '请输入 1～100 的整数元金额，每元到账 10 张。' : '';
    amountInput.setAttribute('aria-invalid', String(!order && units === null));
    byId('purchase-cards').textContent = order ? order.cards + ' 张' : units === null ? '—' : units * 10 + ' 张';
    if (!order) byId('order-amount').textContent = byId('order-total').textContent = units === null ? '—' : '¥' + units.toFixed(2);
    if (receiptId && !order) byId('purchase-cards').textContent = byId('order-total').textContent = '—';
    payButton.hidden = paid || !user?.emailVerified;
    payButton.disabled = busy || !available || !active || (!order && !agreement.checked);
    payButton.textContent = busy ? '正在处理…' : status?.enabled && !modeAvailable() ? '请在电脑端购买' : !available ? status?.testOnly ? '测试购买未开放' : '支付暂不可用' : order ? active ? '继续支付宝付款' : '订单已结束' : units === null ? '请输入整数金额' : !agreement.checked ? '请先确认购买须知' : '支付宝支付 ¥' + units.toFixed(2);
    payButton.setAttribute('aria-busy', String(busy));
    checkButton.hidden = (!order && !receiptId) || paid; checkButton.disabled = busy;
    checkButton.textContent = busy ? '正在查询…' : '我已支付，查询结果';
    byId('back-to-game').hidden = !paid || !!receiptId;
    byId('new-order').hidden = !available || !order || !['closed', 'expired', 'paid'].includes(order.state);
    byId('new-order').disabled = busy;
    if (!order && status?.enabled && !modeAvailable()) notice.textContent = '手机网站支付尚未开通，请在电脑浏览器打开本页，用手机支付宝扫码付款。';
    if (order) {
      byId('order-amount').textContent = byId('order-total').textContent = '¥' + order.amount;
      byId('checkout-title').textContent = paid ? '支付已确认' : '订单状态';
      notice.textContent = paid ? `支付已确认，${order.cards} 张广告卡已到账。` : order.state === 'closed' ? '此订单已关闭，未发放广告卡。' : order.state === 'expired' ? '订单已超时。若已付款，请查询结果，系统确认后到账。' : '订单尚未确认支付。完成付款后可在这里查询，重复查询不会重复发卡。';
      if (status.sandbox) notice.textContent = '沙箱测试，不进行真实收款。' + notice.textContent;
    }
  }
  function paymentUrl(value) {
    const url = new URL(value), host = status.sandbox ? 'openapi-sandbox.dl.alipaydev.com' : 'openapi.alipay.com';
    if (url.protocol !== 'https:' || url.hostname !== host || url.pathname !== '/gateway.do' || url.username || url.password || url.port) throw new Error('支付地址异常，请重试');
    return url.href;
  }
  async function check() {
    if (busy || (!order && !receiptId)) return;
    busy = true; byId('payment-error').textContent = ''; render();
    try {
      const result = await api(receiptId ? '/pay/receipt' : '/pay/order/' + order.id + '/check', receiptId ? { orderId: receiptId } : {});
      order = result.order;
      if (!receiptId) byId('card-balance').textContent = result.balance + ' 张';
      if (order.state === 'paid') sessionStorage.removeItem(requestKey);
    } catch (cause) { byId('payment-error').textContent = cause.message || '暂未确认支付结果，请稍后再试'; }
    finally { busy = false; render(); }
  }
  payButton.addEventListener('click', async () => {
    if (busy || !status?.enabled || !user?.emailVerified || !modeAvailable()) return;
    if (!order && (!agreement.checked || quantity() === null)) { render(); return; }
    busy = true; byId('payment-error').textContent = ''; render();
    try {
      if (!order) {
        const mode = mobile && status.modes.includes('wap') ? 'wap' : status.modes.includes('page') ? 'page' : 'wap';
        const units = quantity();
        let saved;
        try { saved = JSON.parse(sessionStorage.getItem(requestKey) || 'null'); } catch {}
        // Keep the request bound to its amount and channel when retrying a lost response.
        if (saved?.accountId && saved.accountId !== user.id) throw new Error('上次下单账号已变化，请切回原账号核对订单');
        if (saved && (saved.quantity !== units || saved.mode !== mode)) throw new Error('上次下单结果尚未确认，请先按原金额重试，避免重复购买');
        if (!saved) { saved = { requestId: crypto.randomUUID(), quantity: units, mode, accountId: user.id }; sessionStorage.setItem(requestKey, JSON.stringify(saved)); }
        order = (await api('/pay/order', { ...saved, accountId: user.id })).order;
        history.replaceState(null, '', 'checkout.html?order=' + order.id);
      }
      if (!order.payUrl || order.state !== 'pending') throw new Error('订单无法继续付款，请查询支付结果');
      location.assign(paymentUrl(order.payUrl));
    } catch (cause) { if (cause.status === 409 && /账号已变化/.test(cause.message)) sessionStorage.removeItem(requestKey); byId('payment-error').textContent = cause.message || '下单失败，请重试'; }
    finally { busy = false; render(); }
  });
  amountInput.addEventListener('input', () => { agreement.checked = false; render(); });
  agreement.addEventListener('change', render);
  for (const preset of presets) preset.addEventListener('click', () => { if (!preset.disabled) { amountInput.value = preset.dataset.yuan; agreement.checked = false; render(); } });
  checkButton.addEventListener('click', check);
  byId('new-order').addEventListener('click', () => {
    if (busy) return;
    order = null; agreement.checked = false; sessionStorage.removeItem(requestKey); history.replaceState(null, '', 'checkout.html');
    byId('checkout-title').textContent = '购买广告卡'; byId('order-amount').textContent = byId('order-total').textContent = '¥1.00';
    notice.textContent = '尚未创建新订单，确认后前往支付宝收银台。'; byId('payment-error').textContent = ''; render();
  });
  (async () => {
    try {
      status = await api('/pay/status');
      if (status.testOnly) { amountInput.value = '1'; byId('amount-help').textContent = '本次仅开放 1 元购买 10 张的支付验证。'; }
      byId('alipay-state').textContent = status.enabled ? status.sandbox ? '沙箱测试' : '已开通' : status.testOnly ? '限指定账号测试' : '暂不可用';
      notice.textContent = status.enabled ? status.sandbox ? '当前为支付宝沙箱环境，不进行真实收款。' : '确认后前往支付宝，支付成功并经系统确认后到账。' : status.reason;
      try { user = (await api('/account')).user; } catch (cause) { if (cause.status !== 401) throw cause; }
      if (!user?.emailVerified) {
        const orderId = new URLSearchParams(location.search).get('order');
        if (!user && /^BYL[a-f0-9]{36}$/.test(orderId || '')) {
          receiptId = orderId;
          for (const id of ['checkout-back', 'checkout-intro', 'purchase-panel', 'payment-channel']) byId(id).hidden = true;
          byId('checkout-layout').className = 'checkout-layout receipt-only';
          byId('payment-login').hidden = true;
          byId('purchase-account').textContent = '付款前已登录的账号';
          byId('card-balance').textContent = '请在原浏览器查看';
          byId('checkout-title').textContent = '确认支付结果';
          byId('payment-return-help').hidden = false;
          byId('payment-return-help').textContent = '支付宝可能打开了新的浏览器页面，登录和本机存档不会自动共享。请切回支付前打开步云录的原浏览器或标签页继续游戏，余额会自动更新，无需在此重新登录。';
          notice.textContent = '正在确认这笔订单，支付结果以服务器确认为准。';
          await check(); return;
        }
        byId('payment-login').href = './?checkout=1' + (orderId && /^[A-Za-z0-9]{20,64}$/.test(orderId) ? '&order=' + orderId : '');
        byId('purchase-account').textContent = user ? '请先验证邮箱' : '尚未登录';
        byId('payment-login').hidden = false; byId('payment-login').textContent = user ? '验证邮箱后购买' : '登录或注册后购买'; render(); return;
      }
      byId('purchase-account').textContent = user.username;
      byId('card-balance').textContent = (await api('/pay/balance')).balance + ' 张';
      const id = new URLSearchParams(location.search).get('order');
      if (id) {
        if (!/^[A-Za-z0-9]{20,64}$/.test(id)) throw new Error('订单编号无效');
        order = (await api('/pay/order/' + id)).order; render(); await check();
      }
      render();
    } catch (cause) { byId('payment-error').textContent = cause.message || '支付服务连接失败，请刷新重试'; payButton.disabled = true; }
  })();
  window.addEventListener?.('pageshow', event => { if (event.persisted && order?.state !== 'paid') check(); });
  document.addEventListener?.('visibilitychange', () => { if (!document.hidden && order?.state !== 'paid') check(); });
})();
