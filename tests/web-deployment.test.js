'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { createServer } = require('../web/serve');
const root = path.join(__dirname, '..');

test('committed web distribution rebuilds exactly from the public source', () => {
  const { build } = require('../web/build');
  const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'buyunlu-web-'));
  try {
    build({ output });
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)).map(file => `${entry.name}/${file}`) : [entry.name]);
    const expected = walk(output).sort();
    assert.deepEqual(walk(path.join(root, 'docs')).sort(), expected);
    for (const file of expected) assert.deepEqual(fs.readFileSync(path.join(root, 'docs', file)), fs.readFileSync(path.join(output, file)), file);
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    assert.match(html, /connect-src 'none'/);
    assert.doesNotMatch(html, /(?:src|href)=["'](?:https?:|\/)/);
    assert.equal(fs.readFileSync(path.join(output, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
    assert.doesNotMatch(expected.join('\n'), /android|\.apk|\.env|private|\.key|\.pem|\.db|save|leaderboard\.json/i);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});

test('standalone web server serves the game, supports HEAD and rejects traversal and missing files', async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /步云录/);
    assert.equal((await fetch(`${base}/game.js`)).status, 200);
    const image = await fetch(`${base}/assets/ad-free-card.png`);
    assert.equal(image.headers.get('content-type'), 'image/png');
    const head = await fetch(base, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(`${base}/missing.js`)).status, 404);
    const escaped = await new Promise((resolve, reject) => {
      http.get(`${base}/..%2fpackage.json`, result => { result.resume(); resolve(result.statusCode); }).on('error', reject);
    });
    assert.equal(escaped, 403);
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
