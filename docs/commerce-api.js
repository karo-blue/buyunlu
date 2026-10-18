(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.BuyunluAPI = factory(root, root.BuyunluWebConfig);
})(typeof window === 'object' ? window : globalThis, function(host, config) {
  'use strict';
  const key = 'buyunlu_web_session_v1';
  const session = () => host.localStorage.getItem(key) || '';
  const clear = () => host.localStorage.removeItem(key);
  async function request(route, body) {
    if (!/^\/[a-zA-Z0-9/?=&_-]+$/.test(route)) throw new Error('接口路径无效');
    const controller = new host.AbortController();
    const timeout = host.setTimeout(() => controller.abort(), 15000);
    const token = session();
    try {
      const response = await host.fetch(config.apiBaseUrl + route, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result.ok === false) {
        if (response.status === 401 && route !== '/login' && session() === token) clear();
        throw Object.assign(new Error(result.error || '请求失败，请重试'), { status: response.status, code: result.code, retryAfter: result.retryAfter });
      }
      const next = response.headers.get('X-Buyunlu-Session');
      if (next && /^[A-Za-z0-9_-]{43}$/.test(next) && session() === token) host.localStorage.setItem(key, next);
      if (route === '/logout' && session() === token) clear();
      return result;
    } finally { host.clearTimeout(timeout); }
  }
  return { request, clear, hasSession: () => !!session() };
});
