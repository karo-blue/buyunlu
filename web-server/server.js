'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const SAVE_KEYS = new Set(['buyunlu_save_v1', 'buyunlu_save_slots_v1', 'buyunlu_local_history_v1', 'buyunlu_h5_pending_v1']);
const SESSION_AGE = 7 * 24 * 3600 * 1000;
const VERIFICATION_AGE = 10 * 60 * 1000;
const RESEND_DELAY = 60 * 1000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const error = (status, message) => Object.assign(new Error(message), { status });
const publicUser = user => ({ id: user.id, username: user.username, email: user.email || '', emailVerified: user.emailVerified === true });
function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)
    || email.split('@')[0].length > 64 || email.startsWith('.') || email.includes('..') || email.includes('.@')) throw error(400, '请输入有效的邮箱地址');
  return email;
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(temp, file);
}
function readFile(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (cause) { if (cause.code === 'ENOENT') return fallback; throw cause; }
}
async function bodyOf(request) {
  if (!String(request.headers['content-type']).startsWith('application/json')) throw error(415, '请使用 JSON 请求');
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw error(413, '存档过大');
    chunks.push(chunk);
  }
  try { const body = JSON.parse(Buffer.concat(chunks).toString()); if (!body || typeof body !== 'object' || Array.isArray(body)) throw 0; return body; }
  catch { throw error(400, '请求格式错误'); }
}

function createServer(options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.H5_DATA_DIR || path.join(__dirname, 'data'));
  const publicDir = path.resolve(options.publicDir || path.join(__dirname, '../docs'));
  const origin = options.origin || process.env.H5_ORIGIN || 'http://localhost:4182';
  const frontendUrl = options.frontendUrl || process.env.H5_FRONTEND_URL || origin + (options.basePath || process.env.H5_BASE_PATH || '/');
  const frontendOrigin = new URL(frontendUrl).origin;
  const basePath = options.basePath || process.env.H5_BASE_PATH || '/';
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)) throw new Error('网站路径无效');
  const secure = options.secure ?? !origin.startsWith('http://localhost');
  const upstream = options.upstream || process.env.H5_LEADERBOARD_URL || 'https://example.invalid/buyunlu-api';
  const fetchRemote = options.fetch || globalThis.fetch;
  const now = options.now || Date.now;
  const sendVerificationEmail = options.sendVerificationEmail || (message => require('./mail').sendVerificationEmail(message));
  const payments = options.payments || require('./alipay').createPayments({ dataDir, origin, basePath, frontendUrl });
  const accountsFile = path.join(dataDir, 'accounts.json');
  const accounts = readFile(accountsFile, []);
  const sessions = new Map(); const limits = new Map();
  const reservedUsernames = new Set(); const reservedEmails = new Set(); const accountLocks = new Map();
  let passwordWork = 0;
  const persistAccounts = () => atomicWrite(accountsFile, accounts);
  function json(response, status, value) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  }
  function setSession(response, user, request) {
    const token = crypto.randomBytes(32).toString('base64url');
    const timestamp = now();
    for (const [key, session] of sessions) if (session.expires <= timestamp) sessions.delete(key);
    const crossOrigin = frontendOrigin !== origin && request.headers.origin === frontendOrigin;
    sessions.set(hash(token), { id: user.id, expires: timestamp + SESSION_AGE, ...(crossOrigin ? { clientOrigin: frontendOrigin } : {}) });
    if (crossOrigin) { response.setHeader('X-Buyunlu-Session', token); return; }
    response.setHeader('Set-Cookie', `buyunlu_session=${token}; HttpOnly; SameSite=Strict; Path=${basePath}; Max-Age=${SESSION_AGE / 1000}${secure ? '; Secure' : ''}`);
  }
  function sessionKey(request) {
    if (request.headers.authorization) return hash(String(request.headers.authorization).match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1] || '');
    if (frontendOrigin !== origin && request.headers.origin === frontendOrigin) return hash('');
    return hash((request.headers.cookie || '').match(/(?:^|;\s*)buyunlu_session=([^;]*)/)?.[1] || '');
  }
  function currentUser(request) {
    const session = sessions.get(sessionKey(request));
    return session && session.expires > now() && (!session.clientOrigin || session.clientOrigin === request.headers.origin) ? accounts.find(user => user.id === session.id) : null;
  }
  function rateLimit(key, maximum, window = 15 * 60 * 1000) {
    const timestamp = now();
    if (limits.size > 10000) for (const [key, value] of limits) if (value.until <= timestamp) limits.delete(key);
    const value = limits.get(key);
    if (!value || value.until <= timestamp) { limits.set(key, { count: 1, until: timestamp + window }); return; }
    if (++value.count > maximum) throw Object.assign(error(429, '操作太频繁，请稍后重试'), { retryAfter: Math.ceil((value.until - timestamp) / 1000) });
  }
  async function withAccountLock(user, task) {
    const previous = accountLocks.get(user.id) || Promise.resolve();
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    accountLocks.set(user.id, pending);
    await previous;
    try { return await task(); }
    finally { release(); if (accountLocks.get(user.id) === pending) accountLocks.delete(user.id); }
  }
  function assertEmailAvailable(email, user) {
    // An unverified registration must not permanently claim somebody else's mailbox.
    if (accounts.some(item => item !== user && item.emailVerified === true && String(item.email || '').toLowerCase() === email)) throw error(409, '该邮箱已被使用，请使用其他邮箱');
  }
  function reserveEmail(email, user) {
    assertEmailAvailable(email, user);
    if (reservedEmails.has(email)) throw error(409, '该邮箱正在发送验证码，请稍后重试');
    reservedEmails.add(email);
  }
  async function newChallenge(user, email, ip) {
    const previous = user.emailVerification;
    const timestamp = now();
    if (previous?.sentAt + RESEND_DELAY > timestamp) throw Object.assign(error(429, '验证码刚刚发送，请稍后重试'), { retryAfter: Math.ceil((previous.sentAt + RESEND_DELAY - timestamp) / 1000) });
    const sameWindow = previous && previous.sendWindowStart + 3600000 > timestamp;
    if (sameWindow && previous.sendCount >= 5) throw Object.assign(error(429, '验证码发送过于频繁，请稍后重试'), { retryAfter: Math.ceil((previous.sendWindowStart + 3600000 - timestamp) / 1000) });
    rateLimit('email-ip:' + ip, 10, 3600000);
    rateLimit('email-account:' + user.id, 5, 3600000);
    rateLimit('email-address:' + email, 5, 3600000);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const salt = crypto.randomBytes(16).toString('hex');
    const challenge = { codeHash: hash(user.id + ':' + salt + ':' + code), salt, expiresAt: timestamp + VERIFICATION_AGE, sentAt: timestamp, attempts: 0,
      sendWindowStart: sameWindow ? previous.sendWindowStart : timestamp, sendCount: sameWindow ? previous.sendCount + 1 : 1 };
    try { await sendVerificationEmail({ email, code, username: user.username }); }
    catch { throw error(503, '验证邮件暂时发送失败，请稍后重试'); }
    return challenge;
  }
  function accountResponse(user) {
    const retryAfter = Math.max(0, Math.ceil(((user.emailVerification?.sentAt || 0) + RESEND_DELAY - now()) / 1000));
    return { ok: true, user: publicUser(user), verificationRequired: user.emailVerified !== true, retryAfter };
  }
  function saveFile(user) { return path.join(dataDir, 'saves', user.id + '.json'); }
  function getSave(user) { return readFile(saveFile(user), { revision: 0, snapshot: {}, updatedAt: null }); }
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(request.url, origin);
      if (!url.pathname.startsWith(basePath)) throw error(404, '页面不存在');
      url.pathname = '/' + url.pathname.slice(basePath.length);
      const crossOrigin = frontendOrigin !== origin && request.headers.origin === frontendOrigin;
      if (url.pathname.startsWith('/api/') && crossOrigin) {
        response.setHeader('Access-Control-Allow-Origin', frontendOrigin);
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.setHeader('Access-Control-Expose-Headers', 'X-Buyunlu-Session');
        response.setHeader('Vary', 'Origin');
        if (request.method === 'OPTIONS') { response.writeHead(204, { 'Cache-Control': 'no-store' }); return response.end(); }
      }
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method)) throw error(405, '不支持此请求');
        const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        // Serve only the public build, never source, credentials or runtime data.
        if (relative.split('/').some(part => part.startsWith('.'))) throw error(404, '页面不存在');
        const file = path.resolve(publicDir, '.' + relative);
        if (!file.startsWith(publicDir + path.sep)) throw error(404, '页面不存在');
        let bytes; try { bytes = fs.readFileSync(file); } catch { throw error(404, '页面不存在'); }
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" });
        return response.end(request.method === 'HEAD' ? undefined : bytes);
      }
      const route = url.pathname.slice(4);
      // This one external callback is authenticated by RSA2, never by browser cookies or Origin.
      if (route === '/pay/alipay/notify' && request.method === 'POST') {
        try {
          rateLimit('pay-notify:' + (request.headers['x-real-ip'] || request.socket.remoteAddress), 300, 60000);
          if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw error(415, '支付通知格式错误');
          const chunks = []; let size = 0;
          for await (const chunk of request) { size += chunk.length; if (size > 65536) throw error(413, '支付通知过大'); chunks.push(chunk); }
          const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8')); const data = {};
          for (const [key, value] of form) {
            if (!/^[a-zA-Z0-9_]{1,64}$/.test(key) || Object.hasOwn(data, key)) throw error(400, '支付通知参数重复或无效');
            Object.defineProperty(data, key, { value, enumerable: true });
          }
          payments.notify(data);
          response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return response.end('success');
        } catch (cause) {
          response.writeHead(cause.status || 500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return response.end('failure');
        }
      }
      if (request.method === 'POST' && !crossOrigin && (request.headers.origin !== origin || request.headers['sec-fetch-site'] === 'cross-site')) throw error(403, '请求来源不受信任');
      if (route === '/health' && request.method === 'GET') return json(response, 200, { ok: true, service: 'buyunlu-h5' });
      if (route === '/pay/status' && request.method === 'GET') return json(response, 200, payments.status(currentUser(request)));
      const user = currentUser(request);
      // Nginx must replace X-Real-IP; the service binds only to loopback.
      const ip = String(request.headers['x-real-ip'] || request.socket.remoteAddress);
      if (['/register', '/login'].includes(route) && request.method === 'POST') {
        rateLimit('auth:' + ip, 30);
        const body = await bodyOf(request);
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
        const password = body.password;
        const email = route === '/register' ? normalizeEmail(body.email) : '';
        if (!/^[a-z0-9_\u4e00-\u9fff]{2,24}$/.test(username)) throw error(400, '用户名为2～24位中文、字母、数字或下划线');
        // Retain login compatibility for existing passwords above the new registration limit.
        if (typeof password !== 'string' || password.length < 8 || password.length > (route === '/register' ? 20 : 128)) throw error(400, route === '/register' ? '密码为8～20位' : '密码至少8位；已有长密码仍可登录');
        rateLimit('user:' + username, 15);
        if (passwordWork >= 4) throw error(429, '系统繁忙，请稍后重试');
        let account = accounts.find(item => item.username === username);
        const salt = account?.salt || crypto.randomBytes(16).toString('hex');
        let digest;
        passwordWork++;
        try { digest = (await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })).toString('hex'); }
        finally { passwordWork--; }
        if (route === '/register') {
          if (reservedUsernames.has(username) || accounts.some(item => item.username === username)) throw error(409, '用户名已被使用');
          reserveEmail(email);
          reservedUsernames.add(username);
          try {
            account = { id: 'h5-' + crypto.randomUUID(), username, salt, digest, email, emailVerified: false };
            account.emailVerification = await newChallenge(account, email, ip);
            assertEmailAvailable(email, account);
            accounts.push(account);
            try { persistAccounts(); } catch (cause) { accounts.splice(accounts.indexOf(account), 1); throw cause; }
          } finally { reservedUsernames.delete(username); reservedEmails.delete(email); }
        } else if (!account || !crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(account.digest, 'hex'))) throw error(401, '用户名或密码错误');
        setSession(response, account, request);
        return json(response, route === '/register' ? 201 : 200, accountResponse(account));
      }
      if (!user) throw error(401, '请先登录');
      rateLimit('api:' + user.id, 240, 60000);
      if (route === '/account' && request.method === 'GET') return json(response, 200, accountResponse(user));
      if (route === '/logout' && request.method === 'POST') {
        sessions.delete(sessionKey(request));
        response.setHeader('Set-Cookie', `buyunlu_session=; HttpOnly; SameSite=Strict; Path=${basePath}; Max-Age=0${secure ? '; Secure' : ''}`);
        return json(response, 200, { ok: true });
      }
      if (route === '/email/send' && request.method === 'POST') {
        const body = await bodyOf(request);
        const email = normalizeEmail(body.email);
        return await withAccountLock(user, async () => {
          if (user.emailVerified) throw error(409, '邮箱已经验证，无需重复发送');
          reserveEmail(email, user);
          try {
            const challenge = await newChallenge(user, email, ip);
            assertEmailAvailable(email, user);
            const previousEmail = user.email; const previousChallenge = user.emailVerification;
            user.email = email; user.emailVerification = challenge;
            try { persistAccounts(); }
            catch (cause) { user.email = previousEmail; user.emailVerification = previousChallenge; throw cause; }
            return json(response, 200, accountResponse(user));
          } finally { reservedEmails.delete(email); }
        });
      }
      if (route === '/email/verify' && request.method === 'POST') {
        const body = await bodyOf(request);
        return await withAccountLock(user, async () => {
          if (user.emailVerified) throw error(409, '邮箱已经验证，无需重复验证');
          rateLimit('email-verify-ip:' + ip, 60);
          const challenge = user.emailVerification;
          if (!challenge || challenge.expiresAt <= now()) throw error(400, '验证码已过期，请重新发送');
          if (challenge.attempts >= 5) throw error(429, '验证码尝试次数过多，请重新发送');
          const code = typeof body.code === 'string' ? body.code.trim() : '';
          if (!/^\d{6}$/.test(code) || !crypto.timingSafeEqual(Buffer.from(challenge.codeHash, 'hex'), Buffer.from(hash(user.id + ':' + challenge.salt + ':' + code), 'hex'))) {
            challenge.attempts++;
            persistAccounts();
            throw error(400, '验证码不正确，请重试');
          }
          // Keep the ownership check and commit synchronous so concurrent proofs cannot both win.
          assertEmailAvailable(user.email, user);
          user.emailVerified = true; user.emailVerifiedAt = new Date(now()).toISOString(); delete user.emailVerification;
          try { persistAccounts(); }
          catch (cause) { user.emailVerified = false; delete user.emailVerifiedAt; user.emailVerification = challenge; throw cause; }
          // Invalidate every unverified session before issuing a fresh verified session.
          for (const [key, session] of sessions) if (session.id === user.id) sessions.delete(key);
          setSession(response, user, request);
          return json(response, 200, accountResponse(user));
        });
      }
      if (user.emailVerified !== true && (route.startsWith('/pay/') || ['/save', '/leaderboard', '/leaderboard/submit', '/tigerboard', '/escapeboard'].includes(route))) throw error(403, '请先完成邮箱验证，再进入游戏');
      if (route === '/pay/balance' && request.method === 'GET') return json(response, 200, { ok: true, balance: payments.balance(user) });
      if (route === '/pay/order' && request.method === 'POST') {
        rateLimit('pay-order:' + user.id, 20, 3600000);
        return json(response, 201, { ok: true, order: payments.createOrder(user, await bodyOf(request)) });
      }
      if (route === '/pay/consume' && request.method === 'POST') return json(response, 200, payments.consume(user, await bodyOf(request)));
      const orderRoute = route.match(/^\/pay\/order\/([A-Za-z0-9-]{1,64})(\/check)?$/);
      if (orderRoute && !orderRoute[2] && request.method === 'GET') return json(response, 200, { ok: true, order: payments.getOrder(user, orderRoute[1]), balance: payments.balance(user) });
      if (orderRoute?.[2] && request.method === 'POST') {
        rateLimit('pay-check:' + user.id, 12, 60000);
        return json(response, 200, { ok: true, order: await payments.reconcile(user, orderRoute[1]), balance: payments.balance(user) });
      }
      if (route === '/save' && request.method === 'GET') return json(response, 200, { ok: true, ...getSave(user) });
      if (route === '/save' && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!body.snapshot || typeof body.snapshot !== 'object' || Array.isArray(body.snapshot) || Object.keys(body.snapshot).some(key => !SAVE_KEYS.has(key))) throw error(400, '存档格式错误');
        const saved = getSave(user);
        if (!Number.isSafeInteger(body.revision) || body.revision !== saved.revision) throw error(409, '其他设备已有新存档，请先载入云端进度');
        const next = { revision: saved.revision + 1, snapshot: body.snapshot, updatedAt: new Date().toISOString() };
        atomicWrite(saveFile(user), next);
        return json(response, 200, { ok: true, revision: next.revision, updatedAt: next.updatedAt });
      }
      if ((['/leaderboard', '/tigerboard', '/escapeboard'].includes(route) && request.method === 'GET') || (route === '/leaderboard/submit' && request.method === 'POST')) {
        const remote = new URL(upstream + route);
        const config = { method: request.method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000) };
        if (request.method === 'POST') {
          const body = await bodyOf(request);
          delete body.email;
          config.body = JSON.stringify({ ...body, clientId: user.id, name: user.username });
        } else {
          remote.searchParams.set('clientId', user.id);
          remote.searchParams.set('limit', String(Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 6))));
        }
        let result;
        try { const remoteResponse = await fetchRemote(remote.toString(), config); if (!remoteResponse.ok) throw 0; result = await remoteResponse.json(); }
        catch { throw error(502, '排行榜暂时连接失败，请稍后重试'); }
        if (result && Array.isArray(result.entries)) result = { ...result, entries: result.entries.map(entry => entry?.isPlayer === true ? { ...entry, name: user.username } : entry) };
        return json(response, 200, result);
      }
      throw error(404, '接口不存在');
    } catch (cause) {
      if (!response.headersSent) json(response, cause.status || 500, { ok: false, error: cause.status ? cause.message : '服务暂时不可用，请稍后重试', ...(cause.retryAfter ? { retryAfter: cause.retryAfter } : {}) });
    }
  });
  server.requestTimeout = 15000;
  return server;
}
module.exports = { createServer, SAVE_KEYS };
if (require.main === module) {
  const port = Number(process.env.PORT || 4180);
  createServer().listen(port, '127.0.0.1', () => console.log(`Buyunlu H5: http://127.0.0.1:${port}`));
}
