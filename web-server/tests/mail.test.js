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
  assert.deepEqual(message.from, { name: '步云录', address: 'sender@example.test' });
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
  await assert.rejects(rejected.sendVerificationEmail(input), error => error.code === 'SMTP_FAILED' && !error.message.includes('a@example.test'));
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
