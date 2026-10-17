'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createServer } = require('../server');

async function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-h5-'));
  if (options.accounts) fs.writeFileSync(path.join(directory, 'accounts.json'), JSON.stringify(options.accounts));
  const forwarded = []; const messages = [];
  let now = Date.now(); let server; let base;
  const serverOptions = { dataDir: directory, secure: false, origin: 'http://localhost', now: () => now,
    upstream: 'https://example.test/buyunlu-api', sendVerificationEmail: async message => {
      if (options.send) await options.send(message);
      messages.push(message);
    }, fetch: async (url, config) => {
      forwarded.push({ url, options: config });
      return { ok: true, json: async () => options.remoteResult || ({ ok: true, entries: [], total: 0 }) };
    }, payments: options.payments, basePath: options.basePath };
  async function start() {
    server = createServer(serverOptions);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await start();
  t.after(async () => { await close(); fs.rmSync(directory, { recursive: true, force: true }); });
  async function request(route, body, cookie = '', extra = {}) {
    const response = await fetch(base + (options.basePath || '/') + 'api' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', Cookie: cookie, ...extra }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    return { status: response.status, cookie: response.headers.get('set-cookie'), body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text() };
  }
  async function verified(username = 'player_a') {
    const account = await request('/register', { username, password: 'long password 123', email: username + '@example.test' });
    assert.equal(account.status, 201);
    const verification = await request('/email/verify', { code: messages.at(-1).code }, account.cookie);
    assert.equal(verification.status, 200);
    return verification;
  }
  return { request, directory, forwarded, messages, verified, advance: milliseconds => { now += milliseconds; }, restart: async () => { await close(); await start(); } };
}

test('login sessions survive restarts and logout remains revoked after restart without saving raw tokens', async t => {
  const { request, verified, restart, directory } = await fixture(t);
  const account = await verified();
  const token = account.cookie.match(/buyunlu_session=([^;]+)/)[1];
  assert.match(account.cookie, /Max-Age=2592000/);
  const file = path.join(directory, 'sessions.json');
  assert.equal(fs.readFileSync(file, 'utf8').includes(token), false);
  assert.equal(fs.readFileSync(file, 'utf8').includes('long password 123'), false);
  await restart();
  assert.equal((await request('/account', undefined, account.cookie)).status, 200);
  await request('/logout', {}, account.cookie);
  await restart();
  assert.equal((await request('/account', undefined, account.cookie)).status, 401);
});

test('active sessions roll forward for 30 days and inactive expired sessions are rejected', async t => {
  const { request, verified, restart, advance } = await fixture(t);
  const account = await verified();
  advance(29 * 86400000);
  const active = await request('/account', undefined, account.cookie);
  assert.equal(active.status, 200); assert.match(active.cookie, /Max-Age=2592000/);
  await restart(); advance(29 * 86400000);
  assert.equal((await request('/account', undefined, account.cookie)).status, 200);
  advance(31 * 86400000);
  assert.equal((await request('/account', undefined, account.cookie)).status, 401);
});

test('email verification invalidates the old session durably across restart', async t => {
  const { request, messages, restart } = await fixture(t);
  const account = await request('/register', { username: 'session_player', password: '12345678', email: 'session@example.test' });
  const verified = await request('/email/verify', { code: messages[0].code }, account.cookie);
  assert.equal(verified.status, 200);
  await restart();
  assert.equal((await request('/account', undefined, account.cookie)).status, 401);
  assert.equal((await request('/account', undefined, verified.cookie)).status, 200);
});

test('session write failures cannot acknowledge login or logout and preserve the previous session', async t => {
  const { request, verified, directory, restart } = await fixture(t);
  const account = await verified(), rename = fs.renameSync;
  fs.renameSync = function(from, to) { if (to === path.join(directory, 'sessions.json')) throw new Error('disk full'); return rename.apply(this, arguments); };
  try {
    assert.equal((await request('/login', { username: 'player_a', password: 'long password 123' })).status, 500);
    assert.equal((await request('/logout', {}, account.cookie)).status, 500);
  } finally { fs.renameSync = rename; }
  assert.equal((await request('/account', undefined, account.cookie)).status, 200);
  await restart();
  assert.equal((await request('/account', undefined, account.cookie)).status, 200);
});

test('a failed new session write cannot revive the pre-verification session after restart', async t => {
  const { request, directory, messages, restart } = await fixture(t);
  const registered = await request('/register', { username: 'version_player', password: '12345678', email: 'version@example.test' });
  const rename = fs.renameSync;
  fs.renameSync = function(from, to) { if (to === path.join(directory, 'sessions.json')) throw new Error('disk full'); return rename.apply(this, arguments); };
  try { assert.equal((await request('/email/verify', { code: messages[0].code }, registered.cookie)).status, 500); }
  finally { fs.renameSync = rename; }
  await restart();
  assert.equal((await request('/account', undefined, registered.cookie)).status, 401);
  const login = await request('/login', { username: 'version_player', password: '12345678' });
  assert.equal(login.status, 200); assert.equal(login.body.user.emailVerified, true);
});

test('registration restores ASCII usernames and keeps 8 to 20 character passwords', async t => {
  const { request } = await fixture(t);
  for (const [username, password, email] of [['player123', '12345678', 'short@example.test'], ['player_2', 'x'.repeat(20), 'long@example.test']]) {
    const registered = await request('/register', { username, password, email });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.user.username, username);
    assert.equal((await request('/login', { username, password })).status, 200);
  }
  for (const password of ['x'.repeat(7), 'x'.repeat(21)]) {
    assert.equal((await request('/register', { username: 'invalid_player', password, email: 'invalid@example.test' })).status, 400);
  }
  for (const username of ['ab', '中文玩家', 'player<script>', 'player name', 'email@example.test']) {
    assert.equal((await request('/register', { username, password: '12345678', email: 'invalid@example.test' })).status, 400);
  }
});

test('verified email login is case insensitive and reaches the same account and wallet as username login', async t => {
  const { request, messages } = await fixture(t, { payments: { balance: buyer => buyer.username === 'player123' ? 17 : 0 } });
  const fields = { username: 'player123', password: '12345678', email: 'owner@example.test' };
  const registered = await request('/register', fields);
  assert.equal(registered.status, 201);
  assert.equal((await request('/login', { username: fields.email, password: fields.password })).status, 401, 'Unverified email must not identify an account');
  const verified = await request('/email/verify', { code: messages.at(-1).code }, registered.cookie);
  assert.equal(verified.status, 200);
  const emailLogin = await request('/login', { username: ' Owner@Example.Test ', password: fields.password });
  const nameLogin = await request('/login', { username: 'PLAYER123', password: fields.password });
  assert.equal(emailLogin.status, 200); assert.equal(nameLogin.status, 200);
  assert.equal(emailLogin.body.user.id, nameLogin.body.user.id);
  assert.equal(emailLogin.body.user.username, fields.username);
  assert.equal((await request('/pay/balance', undefined, emailLogin.cookie)).body.balance, 17);
  assert.equal((await request('/pay/balance', undefined, nameLogin.cookie)).body.balance, 17);
  const wrong = await request('/login', { username: fields.email, password: 'wrong-password' });
  const missing = await request('/login', { username: 'missing@example.test', password: fields.password });
  assert.equal(wrong.status, 401); assert.equal(missing.status, 401);
  assert.equal(wrong.body.error, missing.body.error);
});

test('legacy Chinese usernames remain usable and pending email claims cannot shadow the verified owner', async t => {
  const account = (id, username, password, emailVerified) => {
    const salt = crypto.randomBytes(16).toString('hex');
    return { id, username, email: 'shared@example.test', emailVerified, salt, digest: crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex') };
  };
  const pending = account('pending', 'pending_player', 'pending-password', false);
  const owner = account('owner', '步云', 'owner-password', true);
  const { request } = await fixture(t, { accounts: [pending, owner] });
  const legacy = await request('/login', { username: owner.username, password: 'owner-password' });
  const email = await request('/login', { username: 'SHARED@example.test', password: 'owner-password' });
  assert.equal(legacy.status, 200); assert.equal(email.status, 200);
  assert.equal(legacy.body.user.id, owner.id); assert.equal(email.body.user.id, owner.id);
  assert.equal((await request('/login', { username: 'shared@example.test', password: 'pending-password' })).status, 401);
});

test('existing passwords longer than the new registration limit can still log in', async t => {
  const password = 'legacy-password-longer-than-twenty', salt = crypto.randomBytes(16).toString('hex');
  const account = { id: 'legacy-long-password', username: 'legacy_player', salt, digest: crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex'), emailVerified: true };
  const { request } = await fixture(t, { accounts: [account] });
  assert.equal((await request('/login', { username: account.username, password })).status, 200);
});

test('subdirectory accounts use scoped cookies and retain payment origin checks', async t => {
  const { request, verified } = await fixture(t, { basePath: '/buyunlu/' });
  assert.equal((await request('/health')).status, 200);
  const account = await verified();
  assert.match(account.cookie, /Path=\/buyunlu\/;/);
  assert.equal((await request('/account', undefined, account.cookie)).status, 200);
  assert.equal((await request('/logout', {}, account.cookie, { Origin: 'https://evil.test' })).status, 403);
  const logout = await request('/logout', {}, account.cookie);
  assert.match(logout.cookie, /Path=\/buyunlu\/;/);
});

test('payment availability receives the authenticated server account, never a URL username', async t => {
  let seen;
  const payments = { status: user => { seen = user; return { ok: true, enabled: !!user }; } };
  const { request, verified } = await fixture(t, { payments });
  assert.equal((await request('/pay/status?username=payment_tester')).body.enabled, false);
  assert.equal(seen, null);
  const account = await verified('payment_tester');
  assert.equal((await request('/pay/status', undefined, account.cookie)).body.enabled, true);
  assert.equal(seen.id, account.body.user.id);
});

test('payment routes require a verified session and origin while Alipay notification uses signature authentication', async t => {
  const calls = [];
  const payments = { status: () => ({ ok: true, enabled: true }), balance: () => 7,
    createOrder: (user, body) => { calls.push(['order', user.id, body]); return { id: 'order-one' }; },
    getOrder: (user, id) => { calls.push(['get', user.id, id]); return { id }; },
    reconcile: async (user, id) => ({ id, state: 'pending' }), consume: () => ({ ok: true, balance: 6 }),
    notify: data => { calls.push(['notify', data]); if (data.sign !== 'valid') throw Object.assign(new Error('bad signature'), { status: 400 }); } };
  const { request, verified } = await fixture(t, { payments });
  assert.equal((await request('/pay/status')).status, 200);
  assert.equal((await request('/pay/balance')).status, 401);
  const unverified = await request('/register', { username: 'not_verified', email: 'unverified@example.test', password: 'long password 123' });
  assert.equal((await request('/pay/order', {}, unverified.cookie)).status, 403);
  const account = await verified();
  assert.equal((await request('/pay/order', {}, account.cookie, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await request('/pay/balance', undefined, account.cookie)).body.balance, 7);
  assert.equal((await request('/pay/order', { quantity: 1 }, account.cookie)).body.order.id, 'order-one');
  assert.equal((await request('/pay/consume', { scene: 'promotion' }, account.cookie)).body.balance, 6);
  assert.equal((await request('/pay/order/order-one', undefined, account.cookie)).body.order.id, 'order-one');
  assert.equal((await request('/pay/order/order-one/check', {}, account.cookie)).body.order.state, 'pending');
  // The external POST has neither our cookie nor Origin; it must be authenticated by the payment verifier.
  const notifyCall = body => request('/pay/alipay/notify', body, '', { 'Content-Type': 'application/x-www-form-urlencoded', Origin: '' });
  assert.equal((await request('/pay/alipay/notify', { sign: 'valid' })).status, 415);
  assert.equal(calls.filter(call => call[0] === 'notify').length, 0);
  assert.equal((await notifyCall('sign=forged')).status, 400);
  assert.equal((await notifyCall('sign=valid')).body, 'success');
  assert.equal((await notifyCall('sign=valid&sign=forged')).status, 400);
  assert.equal((await notifyCall('sign=valid&large=' + 'x'.repeat(70000))).status, 413);
  assert.deepEqual(calls.filter(call => call[0] === 'notify').at(-1)[1], { sign: 'valid' });
});

test('registration requires email proof before gameplay, rotates sessions and persists only hashes', async t => {
  const { request, directory, messages } = await fixture(t);
  assert.equal((await request('/account')).status, 401);
  assert.equal((await request('/register', { username: 'bad_email', password: 'correct horse 123', email: 'not-an-email' })).status, 400);
  const account = await request('/register', { username: 'player_1', password: 'correct horse 123', email: ' Player_1@Example.Test ' });
  assert.equal(account.status, 201);
  assert.match(account.cookie, /HttpOnly/);
  assert.match(account.cookie, /SameSite=Strict/);
  assert.equal(account.body.user.username, 'player_1');
  assert.equal(account.body.user.email, 'player_1@example.test');
  assert.equal(account.body.user.emailVerified, false);
  assert.equal(account.body.verificationRequired, true);
  assert.equal(account.body.retryAfter, 60);
  assert.match(messages[0].code, /^\d{6}$/);
  assert.equal(messages[0].email, 'player_1@example.test');
  assert.equal((await request('/account', undefined, account.cookie)).status, 200);
  for (const [route, body] of [['/save', undefined], ['/save', { revision: 0, snapshot: {} }], ['/leaderboard', undefined], ['/leaderboard/submit', {}]]) {
    const blocked = await request(route, body, account.cookie);
    assert.equal(blocked.status, 403, route);
    assert.match(blocked.body.error, /邮箱/);
  }
  const stored = fs.readFileSync(path.join(directory, 'accounts.json'), 'utf8');
  assert.equal(stored.includes('correct horse'), false);
  assert.equal(stored.includes('"code"'), false);
  assert.notEqual(JSON.parse(stored)[0].emailVerification.codeHash, messages[0].code);
  const verified = await request('/email/verify', { code: messages[0].code }, account.cookie);
  assert.equal(verified.status, 200);
  assert.equal(verified.body.user.emailVerified, true);
  assert.equal(verified.body.user.id, account.body.user.id);
  assert.notEqual(verified.cookie, account.cookie);
  assert.equal((await request('/account', undefined, account.cookie)).status, 401);
  assert.equal((await request('/save', undefined, verified.cookie)).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'accounts.json'), 'utf8'))[0].emailVerification, undefined);
  assert.equal((await request('/email/verify', { code: messages[0].code }, verified.cookie)).status, 409);
  assert.equal((await request('/register', { username: 'PLAYER_1', password: 'another password', email: 'other@example.test' })).status, 409);
  assert.equal((await request('/login', { username: 'player_1', password: 'wrong password' })).status, 401);
  const login = await request('/login', { username: 'player_1', password: 'correct horse 123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.emailVerified, true);
  await request('/logout', {}, login.cookie);
  assert.equal((await request('/account', undefined, login.cookie)).status, 401);
});

test('cloud saves isolate verified users and reject stale writes and foreign origins', async t => {
  const { request, verified } = await fixture(t);
  const a = await verified('player_a'); const b = await verified('player_b');
  const snapshot = { buyunlu_save_v1: { age: 23, name: '测试角色' } };
  assert.equal((await request('/save', { revision: 0, snapshot }, a.cookie)).status, 200);
  assert.equal((await request('/save', undefined, a.cookie)).body.snapshot.buyunlu_save_v1.name, '测试角色');
  assert.equal((await request('/save', undefined, b.cookie)).body.revision, 0);
  assert.equal((await request('/save', { revision: 0, snapshot }, a.cookie)).status, 409);
  assert.equal((await request('/save', { revision: 1, snapshot }, a.cookie, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await request('/save', { revision: 1, snapshot: { arbitrary: 'secret' } }, a.cookie)).status, 400);
});

test('public boards reuse existing upstream data without login, identity or write access', async t => {
  const remoteResult = { ok: true, total: 89433, rank: null, entries: [{ rank: 1, name: '历史玩家', rankIndex: 11, isPlayer: false }] };
  const { request, forwarded } = await fixture(t, { remoteResult });
  for (const board of ['leaderboard', 'tigerboard', 'escapeboard']) {
    const result = await request('/public/' + board + '?clientId=victim&limit=999');
    assert.equal(result.status, 200); assert.deepEqual(result.body, remoteResult);
    const remote = new URL(forwarded.at(-1).url);
    assert.equal(remote.pathname, '/buyunlu-api/' + board);
    assert.equal(remote.searchParams.get('limit'), '100');
    assert.equal(remote.searchParams.has('clientId'), false);
    assert.equal(forwarded.at(-1).options.method, 'GET');
    assert.equal(forwarded.at(-1).options.body, undefined);
    assert.equal(forwarded.at(-1).options.headers.Authorization, undefined);
  }
  const count = forwarded.length;
  assert.equal((await request('/public/leaderboard', { clientId: 'victim' })).status, 401);
  assert.equal((await request('/leaderboard/submit', { clientId: 'victim' })).status, 401);
  assert.equal(forwarded.length, count);
});

test('public board upstream failures return a retriable error instead of an empty ranking', async t => {
  const { request } = await fixture(t, { remoteResult: { ok: false, error: 'upstream private detail' } });
  const result = await request('/public/leaderboard');
  assert.equal(result.status, 502);
  assert.match(result.body.error, /排行榜暂时连接失败/);
  assert.equal(JSON.stringify(result.body).includes('private detail'), false);
});

test('shared leaderboard id and name are assigned by server without forwarding email', async t => {
  const { request, forwarded, verified } = await fixture(t);
  assert.equal((await request('/leaderboard/submit', { clientId: 'victim' })).status, 401);
  const a = await verified();
  await request('/leaderboard/submit', { clientId: 'victim', name: '测试角色', email: 'private@example.test', rankIndex: 1 }, a.cookie);
  const body = JSON.parse(forwarded.at(-1).options.body);
  assert.equal(body.clientId, a.body.user.id);
  assert.equal(body.name, 'player_a');
  assert.equal(body.email, undefined);
  await request('/leaderboard?clientId=victim&limit=6', undefined, a.cookie);
  assert.match(forwarded.at(-1).url, /clientId=h5-/);
  assert.equal((await request('/pay/order', {}, a.cookie)).status, 503);
});

test('leaderboard responses restore only the current players full username without adding email', async t => {
  const remoteResult = { ok: true, total: 3, entries: [
    { name: 'player_w', isPlayer: true, rank: 1 },
    { name: '其他玩家', isPlayer: false, rank: 2 },
    { name: 'player_w', rank: 3 },
  ] };
  const { request, verified } = await fixture(t, { remoteResult });
  const account = await verified('player_with_long_name');
  for (const route of ['/leaderboard', '/tigerboard', '/escapeboard', '/leaderboard/submit']) {
    const response = await request(route, route.endsWith('/submit') ? { name: 'forged', rankIndex: 1 } : undefined, account.cookie);
    assert.equal(response.status, 200);
    assert.equal(response.body.entries[0].name, 'player_with_long_name');
    assert.deepEqual(response.body.entries.slice(1), remoteResult.entries.slice(1));
    assert.equal(JSON.stringify(response.body).includes(account.body.user.email), false);
    assert.equal(response.body.total, 3);
  }
  assert.equal(remoteResult.entries[0].name, 'player_w');
});

test('incorrect and expired codes cannot verify; new codes supersede old codes', async t => {
  const { request, messages, advance } = await fixture(t);
  const account = await request('/register', { username: 'player_a', password: 'long password 123', email: 'a@example.test' });
  const first = messages[0].code;
  const incorrect = first === '000000' ? '111111' : '000000';
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await request('/email/verify', { code: incorrect }, account.cookie)).status, 400);
  assert.equal((await request('/email/verify', { code: first }, account.cookie)).status, 429);
  assert.equal((await request('/email/send', { email: 'a@example.test' }, account.cookie)).status, 429);
  advance(60000);
  assert.equal((await request('/email/send', { email: 'a@example.test' }, account.cookie)).status, 200);
  const second = messages.at(-1).code;
  if (first !== second) assert.equal((await request('/email/verify', { code: first }, account.cookie)).status, 400);
  advance(10 * 60 * 1000);
  assert.equal((await request('/email/verify', { code: second }, account.cookie)).status, 400);
  assert.equal((await request('/save', undefined, account.cookie)).status, 403);
  assert.equal((await request('/email/send', { email: 'a@example.test' }, account.cookie)).status, 200);
  assert.equal((await request('/email/verify', { code: messages.at(-1).code }, account.cookie)).status, 200);
});

test('verification challenges and cooldown survive a server restart', async t => {
  const { request, messages, restart } = await fixture(t);
  await request('/register', { username: 'player_a', password: 'long password 123', email: 'a@example.test' });
  const code = messages[0].code;
  await restart();
  const login = await request('/login', { username: 'player_a', password: 'long password 123' });
  assert.equal(login.body.verificationRequired, true);
  assert.equal((await request('/email/send', { email: 'a@example.test' }, login.cookie)).status, 429);
  assert.equal((await request('/email/verify', { code }, login.cookie)).status, 200);
});

test('legacy accounts bind and verify email without losing account id or cloud progression', async t => {
  const salt = crypto.randomBytes(16).toString('hex');
  const legacy = { id: 'h5-existing-player', username: 'existing_player', salt, digest: crypto.scryptSync('long password 123', salt, 64).toString('hex') };
  const { request, directory, messages } = await fixture(t, { accounts: [legacy] });
  fs.mkdirSync(path.join(directory, 'saves'));
  const saved = { revision: 7, snapshot: { buyunlu_save_v1: { age: 48, name: '以前角色', rankIndex: 4 } }, updatedAt: '2026-10-14' };
  fs.writeFileSync(path.join(directory, 'saves', legacy.id + '.json'), JSON.stringify(saved));
  const login = await request('/login', { username: legacy.username, password: 'long password 123' });
  assert.equal(login.body.user.emailVerified, false);
  assert.equal(login.body.user.email, '');
  assert.equal(login.body.user.id, legacy.id);
  assert.equal((await request('/save', undefined, login.cookie)).status, 403);
  assert.equal((await request('/email/send', { email: 'existing@example.test' }, login.cookie)).status, 200);
  const verified = await request('/email/verify', { code: messages[0].code }, login.cookie);
  assert.equal(verified.body.user.id, legacy.id);
  assert.deepEqual((await request('/save', undefined, verified.cookie)).body, { ok: true, ...saved });
});

test('SMTP failure never claims delivery, creates a session or corrupts an existing challenge', async t => {
  let fail = true;
  const { request, directory, messages, advance } = await fixture(t, { send: async () => { if (fail) throw new Error('smtp password SECRET'); } });
  const fields = { username: 'player_a', password: 'long password 123', email: 'a@example.test' };
  const failed = await request('/register', fields);
  assert.equal(failed.status, 503);
  assert.equal(failed.cookie, null);
  assert.doesNotMatch(failed.body.error, /SECRET/);
  assert.equal(fs.existsSync(path.join(directory, 'accounts.json')), false);
  fail = false;
  const account = await request('/register', fields);
  const firstCode = messages[0].code;
  advance(60000); fail = true;
  assert.equal((await request('/email/send', { email: 'changed@example.test' }, account.cookie)).status, 503);
  assert.equal((await request('/account', undefined, account.cookie)).body.user.email, 'a@example.test');
  assert.equal((await request('/email/verify', { code: firstCode }, account.cookie)).status, 200);
});

test('verified email addresses are case insensitive and concurrent registration is reserved', async t => {
  let release; let notify;
  const started = new Promise(resolve => { notify = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const { request, messages } = await fixture(t, { send: async () => { notify(); await held; } });
  const first = request('/register', { username: 'player_a', password: 'long password 123', email: 'same@example.test' });
  await started;
  const sameEmail = await request('/register', { username: 'player_b', password: 'long password 123', email: 'SAME@example.test' });
  const sameUser = await request('/register', { username: 'PLAYER_A', password: 'long password 123', email: 'other@example.test' });
  assert.equal(sameEmail.status, 409); assert.equal(sameUser.status, 409);
  release();
  const registered = await first;
  assert.equal(registered.status, 201);
  assert.equal(messages.length, 1);
  assert.equal((await request('/email/verify', { code: messages[0].code }, registered.cookie)).status, 200);
  assert.equal((await request('/register', { username: 'player_c', password: 'long password 123', email: 'SAME@example.test' })).status, 409);
});

test('unverified registration cannot permanently reserve another persons mailbox', async t => {
  const { request, messages, advance } = await fixture(t);
  const first = await request('/register', { username: 'unverified_user', password: 'long password 123', email: 'owner@example.test' });
  const firstCode = messages.at(-1).code;
  const owner = await request('/register', { username: 'mailbox_owner', password: 'long password 123', email: 'OWNER@example.test' });
  assert.equal(owner.status, 201);
  const ownerCode = messages.at(-1).code;
  assert.equal((await request('/email/verify', { code: ownerCode }, owner.cookie)).status, 200);
  assert.equal((await request('/email/verify', { code: firstCode }, first.cookie)).status, 409);
  assert.equal((await request('/save', undefined, first.cookie)).status, 403);
  advance(60000);
  assert.equal((await request('/email/send', { email: 'owner@example.test' }, first.cookie)).status, 409);
  assert.equal((await request('/email/send', { email: 'different@example.test' }, first.cookie)).status, 200);
  assert.equal((await request('/email/verify', { code: messages.at(-1).code }, first.cookie)).status, 200);
});

test('concurrent proof for accounts sharing a candidate email verifies only one account', async t => {
  const { request, messages } = await fixture(t);
  const a = await request('/register', { username: 'player_a', password: 'long password 123', email: 'shared@example.test' });
  const aCode = messages.at(-1).code;
  const b = await request('/register', { username: 'player_b', password: 'long password 123', email: 'shared@example.test' });
  assert.equal(b.status, 201);
  const bCode = messages.at(-1).code;
  const results = await Promise.all([request('/email/verify', { code: aCode }, a.cookie), request('/email/verify', { code: bCode }, b.cookie)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
});

test('binding and sending serialize and reserve candidate emails across accounts', async t => {
  let hold = false; let release; let notify;
  const started = new Promise(resolve => { notify = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const { request, advance, messages } = await fixture(t, { send: async () => { if (hold) { notify(); await held; } } });
  const a = await request('/register', { username: 'player_a', password: 'long password 123', email: 'a@example.test' });
  const b = await request('/register', { username: 'player_b', password: 'long password 123', email: 'b@example.test' });
  advance(60000); hold = true;
  const first = request('/email/send', { email: 'shared@example.test' }, a.cookie);
  await started;
  assert.equal((await request('/email/send', { email: 'SHARED@example.test' }, b.cookie)).status, 409);
  const repeated = request('/email/send', { email: 'another@example.test' }, a.cookie);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await repeated).status, 429);
  assert.equal(messages.length, 3);
  assert.equal((await request('/email/verify', { code: messages.at(-1).code }, a.cookie)).status, 200);
});

test('verification is one time even for concurrent submissions', async t => {
  const { request, messages } = await fixture(t);
  const account = await request('/register', { username: 'player_a', password: 'long password 123', email: 'a@example.test' });
  const results = await Promise.all([request('/email/verify', { code: messages[0].code }, account.cookie), request('/email/verify', { code: messages[0].code }, account.cookie)]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.ok(results.some(result => [401, 409].includes(result.status)));
});

test('hourly account send limit survives restart and changing candidate email cannot bypass it', async t => {
  const { request, messages, advance, restart } = await fixture(t);
  const account = await request('/register', { username: 'player_a', password: 'long password 123', email: 'a@example.test' });
  for (let index = 1; index < 5; index++) {
    advance(60000);
    assert.equal((await request('/email/send', { email: `candidate${index}@example.test` }, account.cookie)).status, 200);
  }
  assert.equal(messages.length, 5);
  advance(60000);
  const blocked = await request('/email/send', { email: 'different@example.test' }, account.cookie);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.body.retryAfter > 60);
  await restart();
  const login = await request('/login', { username: 'player_a', password: 'long password 123' });
  assert.equal((await request('/email/send', { email: 'different@example.test' }, login.cookie)).status, 429);
  advance(3600000);
  assert.equal((await request('/email/send', { email: 'different@example.test' }, login.cookie)).status, 200);
});

test('hourly IP send limit applies across different accounts', async t => {
  const { request, messages, advance } = await fixture(t);
  for (const name of ['player_a', 'player_b']) {
    const account = await request('/register', { username: name, password: 'long password 123', email: name + '@example.test' });
    assert.equal(account.status, 201);
    for (let index = 1; index < 5; index++) {
      advance(60000);
      assert.equal((await request('/email/send', { email: name + '@example.test' }, account.cookie)).status, 200);
    }
  }
  const denied = await request('/register', { username: 'player_c', password: 'long password 123', email: 'c@example.test' });
  assert.equal(denied.status, 429);
  assert.equal(denied.cookie, null);
  assert.equal(messages.length, 10);
});


test('registered verified email code login preserves identity and is single-use across restart',async t=>{
 const f=await fixture(t,{payments:{status:()=>({ok:true}),balance:user=>user.id}});
 const account=await f.verified();await f.request('/logout',{},account.cookie);
 const sent=await f.request('/login/email/send',{email:'PLAYER_A@EXAMPLE.TEST'});
 assert.equal(sent.status,200);assert.equal(sent.cookie,null);assert.equal(sent.body.user,undefined);
 const code=f.messages.at(-1).code;assert.equal(f.messages.at(-1).purpose,'login');
 const contents=fs.readFileSync(path.join(f.directory,'accounts.json'),'utf8');
 assert.equal(contents.includes('"'+code+'"'),false);
 await f.restart();
 const login=await f.request('/login/email/verify',{email:'player_a@example.test',code});
 assert.equal(login.status,200);assert.equal(login.body.user.id,account.body.user.id);
 assert.equal((await f.request('/pay/balance',undefined,login.cookie)).body.balance,account.body.user.id);
 await f.restart();assert.equal((await f.request('/account',undefined,login.cookie)).status,200);
 assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code})).status,400);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'accounts.json'),'utf8')).length,1);
});

test('code login does not create accounts or send to unknown and unverified addresses',async t=>{
 const f=await fixture(t);await f.request('/register',{username:'unverified',password:'12345678',email:'unverified@example.test'});
 const count=f.messages.length;
 for(const email of ['missing@example.test','unverified@example.test']){
  const result=await f.request('/login/email/send',{email});assert.equal(result.status,200);assert.equal(result.cookie,null);
  const invalid=await f.request('/login/email/verify',{email,code:'123456'});assert.equal(invalid.status,400);assert.equal(invalid.cookie,null);
 }
 assert.equal(f.messages.length,count);assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'accounts.json'),'utf8')).length,1);
});

test('login codes expire, cannot use registration codes and lock after five wrong guesses',async t=>{
 const f=await fixture(t);await f.verified();const registerCode=f.messages[0].code;
 assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code:registerCode})).status,400);
 await f.request('/login/email/send',{email:'player_a@example.test'});let code=f.messages.at(-1).code;
 const wrong=code==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code:wrong})).status,400);
 await f.restart();assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code})).status,429);
 f.advance(60000);assert.equal((await f.request('/login/email/send',{email:'player_a@example.test'})).status,200);code=f.messages.at(-1).code;
 f.advance(10*60000);assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code})).status,400);
});

test('login send cooldown survives restart, codes are superseded, and concurrent proof wins once',async t=>{
 const f=await fixture(t);await f.verified();
 await f.request('/login/email/send',{email:'player_a@example.test'});const first=f.messages.at(-1).code;
 assert.equal((await f.request('/login/email/send',{email:'player_a@example.test'})).status,429);
 await f.restart();assert.equal((await f.request('/login/email/send',{email:'player_a@example.test'})).status,429);
 f.advance(60000);assert.equal((await f.request('/login/email/send',{email:'player_a@example.test'})).status,200);
 const code=f.messages.at(-1).code;
 if(first!==code)assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code:first})).status,400);
 const results=await Promise.all([1,2].map(()=>f.request('/login/email/verify',{email:'player_a@example.test',code})));
 assert.deepEqual(results.map(item=>item.status).sort(),[200,400]);
});

test('login email failures retain a usable prior code and never expose SMTP details',async t=>{
 let fail=false;const f=await fixture(t,{send:()=>{if(fail)throw new Error('PRIVATE SMTP detail');}});await f.verified();
 await f.request('/login/email/send',{email:'player_a@example.test'});const code=f.messages.at(-1).code;
 f.advance(60000);fail=true;
 const failed=await f.request('/login/email/send',{email:'player_a@example.test'});
 assert.equal(failed.status,503);assert.doesNotMatch(failed.body.error,/PRIVATE/);assert.equal(failed.cookie,null);
 assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code})).status,200);
});

test('failed account and session writes cannot acknowledge code login or leave reusable successful codes',async t=>{
 const f=await fixture(t);await f.verified();await f.request('/login/email/send',{email:'player_a@example.test'});
 const code=f.messages.at(-1).code,rename=fs.renameSync;
 fs.renameSync=function(from,to){if(to===path.join(f.directory,'accounts.json'))throw new Error('full');return rename.apply(this,arguments);};
 try{assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code})).status,500);}finally{fs.renameSync=rename;}
 fs.renameSync=function(from,to){if(to===path.join(f.directory,'sessions.json'))throw new Error('full');return rename.apply(this,arguments);};
 try{const result=await f.request('/login/email/verify',{email:'player_a@example.test',code});assert.equal(result.status,500);assert.equal(result.cookie,null);}finally{fs.renameSync=rename;}
 await f.restart();assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code})).status,400);
});

test('successful code login cannot reset the hourly send limit across restarts',async t=>{
 const f=await fixture(t);await f.verified();
 for(let i=0;i<5;i++){
  assert.equal((await f.request('/login/email/send',{email:'player_a@example.test'})).status,200);
  assert.equal((await f.request('/login/email/verify',{email:'player_a@example.test',code:f.messages.at(-1).code})).status,200);
  await f.restart();f.advance(60000);
 }
 assert.equal((await f.request('/login/email/send',{email:'player_a@example.test'})).status,429);
});
test('login email IP quota also covers addresses that are not registered',async t=>{
 const f=await fixture(t);
 for(let i=0;i<10;i++)assert.equal((await f.request('/login/email/send',{email:'unknown'+i+'@example.test'})).status,200);
 assert.equal((await f.request('/login/email/send',{email:'other@example.test'})).status,429);
 assert.equal(f.messages.length,0);assert.equal(fs.existsSync(path.join(f.directory,'accounts.json')),false);
});
