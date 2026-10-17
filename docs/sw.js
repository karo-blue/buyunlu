'use strict';
const VERSION = '1.0.10';
const SCOPE = self.registration.scope;
const CACHE_PREFIX = 'buyunlu-web:' + SCOPE + ':';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const scoped = name => new URL(name, SCOPE).href;
const INDEX = scoped('index.html?v=' + VERSION);
const PRECACHE = [
  'index.html?v=' + VERSION, 'style.css?v=' + VERSION,
  'runtime.js?v=' + VERSION, 'offline.js?v=' + VERSION, 'game.js?v=' + VERSION,
  'site.js?v=' + VERSION, 'commerce-api.js?v=' + VERSION,
  'commerce-account.js?v=' + VERSION, 'commerce.js?v=' + VERSION, 'commerce.css?v=' + VERSION,
  'pwa.js?v=' + VERSION, 'manifest.webmanifest?v=' + VERSION,
  'assets/apple-touch-icon.png?v=' + VERSION, 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/ad-free-card.png', 'template.json', 'LICENSE', 'PRIVACY.md',
  'THIRD_PARTY_NOTICES.md', '使用说明.txt',
].map(scoped);
const ASSETS = new Set(PRECACHE);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(SCOPE);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const isLaunch = request.mode === 'navigate' && [scope.pathname, scope.pathname + 'index.html'].includes(url.pathname);
  if (!isLaunch && !ASSETS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isLaunch) {
      try { return await fetch(request); }
      catch (error) { return (await cache.match(INDEX)) || Promise.reject(error); }
    }
    return (await cache.match(request)) || fetch(request);
  })());
});
