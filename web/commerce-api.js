(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.BuyunluAPI = factory(root, root.BuyunluWebConfig);
})(typeof window === 'object' ? window : globalThis, function(host, config) {
  'use strict';
  const key = 'buyunlu_web_session_v1';
  let token = host.localStorage.getItem(key) || '';
  const clear = () => { token = ''; host.localStorage.removeItem(key); };
  async function request(route, body) {
    if (!/^\/[a-zA-Z0-9/?=&_-]+$/.test(route)) throw new Error('接口路径无效');
    const controller = new host.AbortController();
    const timeout = host.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await host.fetch(config.apiBaseUrl + route, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result.ok === false) {
        if (response.status === 401 && route !== '/login') clear();
        throw Object.assign(new Error(result.error || '请求失败，请重试'), { status: response.status, retryAfter: result.retryAfter });
      }
      const next = response.headers.get('X-Buyunlu-Session');
      if (next && /^[A-Za-z0-9_-]{43}$/.test(next)) { token = next; host.localStorage.setItem(key, token); }
      if (route === '/logout') clear();
      return result;
    } finally { host.clearTimeout(timeout); }
  }
  return { request, clear, hasSession: () => !!token };
});
