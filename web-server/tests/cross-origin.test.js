'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createServer } = require('../server');
test('GitHub frontend sessions work without third-party cookies and reject other origins', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-cors-'));
  const frontend = 'https://frontend.example', backend = 'https://backend.example';
  let code;
  const serverOptions = { dataDir, origin: backend, frontendUrl: frontend + '/buyunlu/',
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, total: 3, entries: [{ rank: 1, name: '历史玩家' }] }) }),
    sendVerificationEmail: async value => { code = value.code; } };
  let server = createServer(serverOptions);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
  let base = `http://127.0.0.1:${server.address().port}/api`;
  async function restart() {
    server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
    server=createServer(serverOptions);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    base=`http://127.0.0.1:${server.address().port}/api`;
  }
  const call = (route, body, token, origin = frontend) => fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin:origin, 'Sec-Fetch-Site':'cross-site',
      'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}) },
    body: body===undefined?undefined:JSON.stringify(body) });
  const options = await fetch(base+'/login',{method:'OPTIONS',headers:{Origin:frontend,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(options.status,204); assert.equal(options.headers.get('access-control-allow-origin'),frontend);
  assert.equal(options.headers.get('access-control-allow-credentials'),null);
  const badOptions = await fetch(base+'/login',{method:'OPTIONS',headers:{Origin:'https://evil.example'}});
  assert.equal(badOptions.headers.get('access-control-allow-origin'),null);
  const board = await call('/public/leaderboard');
  assert.equal(board.status,200);
  assert.equal(board.headers.get('access-control-allow-origin'),frontend);
  assert.equal(board.headers.get('set-cookie'),null);
  assert.equal((await board.json()).entries[0].name,'历史玩家');
  const registered = await call('/register',{username:'web_tester',password:'long password 123',email:'tester@example.test'});
  assert.equal(registered.status,201);
  const token = registered.headers.get('x-buyunlu-session');
  assert.match(token,/^[A-Za-z0-9_-]{43}$/); assert.equal(registered.headers.get('set-cookie'),null);
  assert.equal((await call('/save',undefined,token)).status,403);
  const verified = await call('/email/verify',{code},token);
  assert.equal(verified.status,200);
  const next = verified.headers.get('x-buyunlu-session'); assert.notEqual(next,token);
  await restart();
  assert.equal((await call('/account',undefined,token)).status,401);
  assert.equal((await call('/account',undefined,next)).status,200);
  assert.equal((await call('/account',undefined,next,'https://evil.example')).status,401);
  assert.equal((await call('/save',{revision:0,snapshot:{}},next,'https://evil.example')).status,403);
  assert.equal((await call('/save',{revision:0,snapshot:{}},next)).status,200);
  assert.equal((await call('/logout',{},next)).status,200);
  await restart();
  assert.equal((await call('/account',undefined,next)).status,401);
  const emailLogin=await call('/login',{username:'TESTER@EXAMPLE.TEST',password:'long password 123'});
  assert.equal(emailLogin.status,200);
  assert.equal(emailLogin.headers.get('set-cookie'),null);
  const emailToken=emailLogin.headers.get('x-buyunlu-session');
  assert.match(emailToken,/^[A-Za-z0-9_-]{43}$/);
  assert.equal((await (await call('/account',undefined,emailToken)).json()).user.username,'web_tester');
  const identity=(await (await call('/account',undefined,emailToken)).json()).user.id;
  const sent=await call('/login/email/send',{email:'TESTER@EXAMPLE.TEST'});
  assert.equal(sent.status,200);assert.equal(sent.headers.get('set-cookie'),null);
  const otp=await call('/login/email/verify',{email:'tester@example.test',code});
  assert.equal(otp.status,200);assert.equal((await otp.json()).user.id,identity);
  const otpToken=otp.headers.get('x-buyunlu-session');assert.match(otpToken,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(otp.headers.get('set-cookie'),null);
  await restart();assert.equal((await call('/account',undefined,otpToken)).status,200);
  assert.equal((await call('/account',undefined,otpToken,'https://evil.example')).status,401);

});
