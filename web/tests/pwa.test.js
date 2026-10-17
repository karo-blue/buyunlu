'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build } = require('../build');
const root = path.resolve(__dirname, '../..');

test('home-screen app has scoped manifest, real icons and Apple launch metadata', () => {
  const { output } = build();
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, '步云录');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === size + 'x' + size);
    assert.ok(icon);
    const data = fs.readFileSync(path.join(output, icon.src));
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.equal(data.readUInt32BE(16), size);
    assert.equal(data.readUInt32BE(20), size);
  }
  const apple = fs.readFileSync(path.join(output, 'assets/apple-touch-icon.png'));
  assert.equal(apple.readUInt32BE(16), 180);
  assert.equal(apple.readUInt32BE(20), 180);
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /worker-src 'self'/);
  assert.match(html, /manifest-src 'self'/);
});

function worker(scope) {
  const listeners = {};
  const stores = new Map();
  let offline = false;
  let claimed = false;
  const urlOf = request => new URL(typeof request === 'string' ? request : request.url, scope).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(requests) {
          for (const request of requests) {
            const url = urlOf(request);
            assert.ok(url.startsWith(scope));
            entries.set(url, 'cached:' + url);
          }
        },
        async match(request) {
          const entry = entries.get(urlOf(request));
          return entry == null ? undefined : new Response(entry);
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    registration: { scope }, location: new URL('sw.js', scope),
    addEventListener(name, callback) { listeners[name] = callback; },
    async skipWaiting() {}, clients: { async claim() { claimed = true; } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'docs/sw.js'), 'utf8'), {
    self, caches, URL, Request,
    async fetch(request) { if (offline) throw new TypeError('offline'); return new Response('network:' + urlOf(request)); },
  });
  return {
    stores, get claimed() { return claimed; },
    setOffline() { offline = true; },
    async lifecycle(name) {
      let work;
      listeners[name]({ waitUntil(promise) { work = promise; } });
      await work;
    },
    fetch(url, options = {}) {
      let result;
      listeners.fetch({ request: { url, method: 'GET', mode: 'cors', ...options }, respondWith(promise) { result = promise; } });
      return result;
    },
  };
}

for (const scope of ['https://example.invalid/', 'https://example.invalid/buyunlu/']) {
  test('offline launch and scoped cache cleanup work at ' + scope, async () => {
    const app = worker(scope);
    await app.lifecycle('install');
    const [current] = app.stores.keys();
    assert.ok(current.includes(scope), 'cache must be separated from other apps on the origin');
    const old = current.slice(0, current.lastIndexOf(':') + 1) + 'previous';
    app.stores.set(old, new Map());
    app.stores.set('unrelated-cache', new Map());
    app.stores.set('buyunlu-web:https://example.invalid/other/:old', new Map());
    await app.lifecycle('activate');
    assert.equal(app.claimed, true);
    assert.equal(app.stores.has(old), false);
    assert.equal(app.stores.has('unrelated-cache'), true);
    assert.equal(app.stores.has('buyunlu-web:https://example.invalid/other/:old'), true);
    const version = require('../../package.json').version;
    const online = await app.fetch(scope + '?from=home', { mode: 'navigate' });
    assert.match(await online.text(), /^network:/);
    app.setOffline();
    const launch = await app.fetch(scope + '?from=home', { mode: 'navigate' });
    assert.equal(await launch.text(), 'cached:' + scope + 'index.html?v=' + version);
    const script = await app.fetch(scope + 'game.js?v=' + version);
    assert.equal(await script.text(), 'cached:' + scope + 'game.js?v=' + version);
    assert.equal(app.fetch('https://other.invalid/game.js'), undefined);
    assert.equal(app.fetch(scope + 'unrelated.js'), undefined);
    assert.equal(app.fetch(scope + 'game.js?v=' + version, {method:'POST'}), undefined);
    assert.equal(app.fetch(scope + 'api/private', {mode:'navigate'}), undefined);
  });
}

test('home-screen registration preserves subpaths and safely skips local HTML', async () => {
  const source = fs.readFileSync(path.join(root, 'docs/pwa.js'), 'utf8');
  for (const protocol of ['file:', 'https:']) {
    const listeners = {};
    const calls = [];
    vm.runInNewContext(source, {
      window: { location: {protocol}, addEventListener(name, callback) { listeners[name] = callback; } },
      document: { currentScript: {src: 'https://example.invalid/buyunlu/pwa.js?v=1.0.5'} },
      navigator: { serviceWorker: { async register(url, options) { calls.push({url,options}); } } }, URL,
    });
    if (listeners.load) await listeners.load();
    assert.equal(calls.length, protocol === 'file:' ? 0 : 1);
    if (calls.length) {
      assert.equal(calls[0].url, 'https://example.invalid/buyunlu/sw.js?v=1.0.5');
      assert.equal(calls[0].options.scope, './');
      assert.equal(calls[0].options.updateViaCache, 'none');
    }
  }
});
