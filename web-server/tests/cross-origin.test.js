'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createServer } = require('../server');
test('GitHub frontend sessions work without third-party cookies and reject other origins', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-cors-'));
  const frontend = 'https://frontend.example', backend = 'https://backend.example';
  let code;
  const server = createServer({ dataDir, origin: backend, frontendUrl: frontend + '/buyunlu/',
    sendVerificationEmail: async value => { code = value.code; } });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (route, body, token, origin = frontend) => fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin:origin, 'Sec-Fetch-Site':'cross-site',
      'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}) },
    body: body===undefined?undefined:JSON.stringify(body) });
  const options = await fetch(base+'/login',{method:'OPTIONS',headers:{Origin:frontend,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(options.status,204); assert.equal(options.headers.get('access-control-allow-origin'),frontend);
  assert.equal(options.headers.get('access-control-allow-credentials'),null);
  const badOptions = await fetch(base+'/login',{method:'OPTIONS',headers:{Origin:'https://evil.example'}});
  assert.equal(badOptions.headers.get('access-control-allow-origin'),null);
  const registered = await call('/register',{username:'web_tester',password:'long password 123',email:'tester@example.test'});
  assert.equal(registered.status,201);
  const token = registered.headers.get('x-buyunlu-session');
  assert.match(token,/^[A-Za-z0-9_-]{43}$/); assert.equal(registered.headers.get('set-cookie'),null);
  assert.equal((await call('/save',undefined,token)).status,403);
  const verified = await call('/email/verify',{code},token);
  assert.equal(verified.status,200);
  const next = verified.headers.get('x-buyunlu-session'); assert.notEqual(next,token);
  assert.equal((await call('/account',undefined,token)).status,401);
  assert.equal((await call('/account',undefined,next)).status,200);
  assert.equal((await call('/account',undefined,next,'https://evil.example')).status,401);
  assert.equal((await call('/save',{revision:0,snapshot:{}},next,'https://evil.example')).status,403);
  assert.equal((await call('/save',{revision:0,snapshot:{}},next)).status,200);
  assert.equal((await call('/logout',{},next)).status,200);
  assert.equal((await call('/account',undefined,next)).status,401);
});
