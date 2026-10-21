'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMailer } = require('../mail');

const env = {
  H5_SMTP_HOST: 'smtp.126.com', H5_SMTP_PORT: '465',
  H5_SMTP_USER: 'sender@example.test', H5_SMTP_PASS: 'fake-test-secret',
  H5_SMTP_FROM: 'sender@example.test'
};

test('verification email uses one recipient, verified TLS and no debug logging', async () => {
  let config, message, closed = 0;
  const mailer = createMailer({ env, createTransport: value => {
    config = value;
    return { sendMail: async value => { message = value; return { accepted: [value.to.address] }; }, close: () => closed++ };
  } });
  await mailer.sendVerificationEmail({ email: 'player@example.test', code: '123456', username: 'player_1' });
  assert.equal(config.secure, true);
  assert.equal(config.tls.rejectUnauthorized, true);
  assert.equal(config.logger, false);
  assert.equal(config.debug, false);
  assert.ok(config.connectionTimeout < 12000);
  assert.ok(config.socketTimeout < 12000);
  assert.equal(config.disableFileAccess, true);
  assert.equal(config.disableUrlAccess, true);
  assert.deepEqual(message.to, { address: 'player@example.test' });
  assert.deepEqual(message.from, { name: '步步有为', address: 'sender@example.test' });
  assert.equal(message.subject, '步步有为邮箱验证码');
  assert.match(message.text, /你的步步有为邮箱验证码/);
  assert.doesNotMatch(message.text, /步云录/);
  assert.match(message.text, /123456/);
  assert.match(message.text, /player_1/);
  assert.equal(message.html, undefined);
  assert.equal(closed, 1);
});

test('verification email links to the current deployment instead of the canceled site', async () => {
  let config, message;
  const mailer = createMailer({ env: { ...env, H5_ORIGIN: 'https://new-site.example', H5_BASE_PATH: '/buyunlu/' }, createTransport: value => {
    config = value;
    return { sendMail: async value => { message = value; return { accepted: [value.to.address] }; }, close() {} };
  } });
  await mailer.sendVerificationEmail({ email: 'player@example.test', code: '123456', username: 'player_1' });
  assert.match(message.text, /https:\/\/new-site\.example\/buyunlu\//);
  assert.doesNotMatch(message.text, /buyunlu\.com/);
  assert.equal(config.name, 'new-site.example');
});

test('GitHub deployment email links to the frontend while SMTP identifies the server hostname', async()=>{
 let config,message;
 const mailer=createMailer({env:{...env,H5_ORIGIN:'https://backend.example',H5_FRONTEND_URL:'https://frontend.example/buyunlu/'},createTransport:value=>{
  config=value;return {sendMail:async value=>{message=value;return {accepted:[value.to.address]};},close(){}};
 }});
 await mailer.sendVerificationEmail({email:'player@example.test',code:'123456',username:'player_1'});
 assert.ok(message.text.includes('https://frontend.example/buyunlu/'));assert.equal(config.name,'backend.example');
});

test('missing configuration and malformed recipients fail before connecting', async () => {
  let calls = 0;
  const createTransport = () => { calls++; throw new Error('must not connect'); };
  const unconfigured = createMailer({ env: { ...env, H5_SMTP_PASS: '' }, createTransport });
  await assert.rejects(unconfigured.verify(), error => error.code === 'SMTP_NOT_CONFIGURED');
  const mailer = createMailer({ env, createTransport });
  for (const email of ['a@example.test,b@example.test', 'a@example.test\r\nBcc:b@example.test', 'Name <a@example.test>']) {
    await assert.rejects(mailer.sendVerificationEmail({ email, code: '123456', username: 'player_1' }), /邮箱/);
  }
  await assert.rejects(mailer.sendVerificationEmail({ email: 'a@example.test', code: 'bad', username: 'player_1' }), /验证码/);
  assert.equal(calls, 0);
});

test('STARTTLS is mandatory on other ports and verify does not send mail', async () => {
  let config, verifies = 0, sends = 0;
  const mailer = createMailer({ env: { ...env, H5_SMTP_PORT: '587' }, createTransport: value => {
    config = value;
    return { verify: async () => { verifies++; return true; }, sendMail: async () => sends++, close() {} };
  } });
  await mailer.verify();
  assert.equal(config.secure, false);
  assert.equal(config.requireTLS, true);
  assert.equal(verifies, 1);
  assert.equal(sends, 0);
});

test('delivery rejection and SMTP failures never expose provider details or secrets', async () => {
  const input = { email: 'a@example.test', code: '123456', username: 'player_1' };
  const rejected = createMailer({ env, createTransport: () => ({ sendMail: async () => ({ accepted: [], rejected: ['a@example.test'] }), close() {} }) });
  await assert.rejects(rejected.sendVerificationEmail(input), error => error.code === 'SMTP_RECIPIENT_REJECTED' && !error.message.includes('a@example.test'));
  const failed = createMailer({ env, createTransport: () => ({ verify: async () => { throw new Error('fake-test-secret 123456'); }, close() {} }) });
  await assert.rejects(failed.verify(), error => error.code === 'SMTP_FAILED' && !error.message.includes('fake-test-secret') && !error.message.includes('123456'));
});

test('an overall deadline closes an unresponsive SMTP transport', async () => {
  let closed = 0;
  const mailer = createMailer({ env, timeoutMs: 20, createTransport: () => ({ verify: () => new Promise(() => {}), close: () => closed++ }) });
  await assert.rejects(mailer.verify(), error => error.code === 'SMTP_TIMEOUT');
  assert.equal(closed, 1);
});

test('the real SMTP socket is destroyed at the overall deadline', async t => {
  const net = require('node:net');
  let accepted;
  const connection = new Promise(resolve => { accepted = resolve; });
  const server = net.createServer(socket => accepted(socket));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const mailer = createMailer({ env: { ...env, H5_SMTP_HOST: '127.0.0.1', H5_SMTP_PORT: String(server.address().port) }, timeoutMs: 150 });
  const pending = mailer.verify();
  const socket = await connection;
  const closed = new Promise(resolve => socket.once('close', resolve));
  await assert.rejects(pending, error => error.code === 'SMTP_TIMEOUT');
  await closed;
  assert.equal(socket.destroyed, true);
});

test('login email is clearly identified and supports registered legacy Chinese usernames',async()=>{
 let message;
 const mailer=createMailer({env,createTransport:()=>({sendMail:async value=>{message=value;return {accepted:[value.to.address]};},close(){}})});
 await mailer.sendVerificationEmail({email:'player@example.test',code:'123456',username:'原有玩家',purpose:'login'});
 assert.match(message.subject,/登录验证码/);assert.match(message.text,/登录验证码/);assert.match(message.text,/123456/);
});

test('SMTP failures distinguish bad addresses, full mailboxes, refusals and temporary failures without exposing raw replies', async () => {
  const cases = [
    [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550, response: '550 5.1.1 No such user PRIVATE' }, 'SMTP_RECIPIENT_INVALID', /邮箱不存在或地址不正确/],
    [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550, response: '550 5.1.2 Bad destination PRIVATE' }, 'SMTP_RECIPIENT_INVALID', /后缀/],
    [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550, response: '550 5.2.2 Mailbox full PRIVATE' }, 'SMTP_MAILBOX_FULL', /空间已满/],
    [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550, response: '550 5.7.1 Policy PRIVATE' }, 'SMTP_RECIPIENT_REJECTED', /拒收/],
    [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550, response: '550 Unspecified PRIVATE' }, 'SMTP_RECIPIENT_REJECTED', /拒收/],
    [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 450, response: '450 4.2.0 Busy PRIVATE' }, 'SMTP_TEMPORARY', /繁忙/],
    [{ code: 'ETIMEDOUT' }, 'SMTP_TIMEOUT', /超时/],
    [{ code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535, response: '535 PRIVATE' }, 'SMTP_FAILED', /发送失败/],
    [{ code: 'EENVELOPE', command: 'MAIL FROM', responseCode: 550, response: '550 5.1.1 Sender PRIVATE' }, 'SMTP_FAILED', /发送失败/]
  ];
  for (const [details, code, message] of cases) {
    const mailer = createMailer({ env, createTransport: () => ({ sendMail: async () => { throw Object.assign(new Error('PRIVATE fake-test-secret 123456'), details); }, close() {} }) });
    await assert.rejects(mailer.sendVerificationEmail({ email: 'a@example.test', code: '123456', username: 'player_1' }), cause => {
      assert.equal(cause.code, code); assert.match(cause.message, message);
      assert.doesNotMatch(cause.message, /PRIVATE|fake-test-secret|123456|a@example/);
      return true;
    });
  }
});

test('recipient rejection details in a send result are classified and malformed local parts never connect', async () => {
  const mailer = createMailer({ env, createTransport: () => ({ sendMail: async () => ({ accepted: [], rejected: ['a@example.test'],
    rejectedErrors: [{ command: 'RCPT TO', responseCode: 550, response: '550 5.1.1 User unknown' }] }), close() {} }) });
  await assert.rejects(mailer.sendVerificationEmail({ email: 'a@example.test', code: '123456', username: 'player_1' }), cause => cause.code === 'SMTP_RECIPIENT_INVALID');
  let calls = 0;
  const invalid = createMailer({ env, createTransport: () => { calls++; throw new Error('must not connect'); } });
  for (const email of ['.a@example.test', 'a..b@example.test', 'a.@example.test', 'x'.repeat(65) + '@example.test']) {
    await assert.rejects(invalid.sendVerificationEmail({ email, code: '123456', username: 'player_1' }), cause => cause.code === 'INVALID_EMAIL');
  }
  assert.equal(calls, 0);
});
