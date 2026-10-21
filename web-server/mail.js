'use strict';
const net = require('node:net');

const MAIL_ERRORS = Object.freeze({
  SMTP_RECIPIENT_INVALID: { status: 422, message: '收件邮箱不存在或地址不正确，请核对邮箱账号和后缀后重新发送。' },
  SMTP_RECIPIENT_REJECTED: { status: 422, message: '收件邮箱拒收验证码，请检查邮箱收信设置，或更换可正常收信的邮箱。' },
  SMTP_MAILBOX_FULL: { status: 422, message: '收件邮箱空间已满，请清理邮箱后重新发送，或更换邮箱。' },
  SMTP_TEMPORARY: { status: 503, message: '邮件服务暂时繁忙，请稍后重新发送。' },
  SMTP_TIMEOUT: { status: 503, message: '验证码发送超时，暂未确认是否发出。请先检查收件箱和垃圾邮件，未收到再重试。' },
  SMTP_NOT_CONFIGURED: { status: 503, message: '验证码邮件服务暂不可用，请稍后重试。' },
  SMTP_FAILED: { status: 503, message: '验证码发送失败，请稍后重试；仍未收到请核对邮箱地址，或更换邮箱。' }
});

function mailError(code, message = MAIL_ERRORS[code]?.message) {
  return Object.assign(new Error(message), { code });
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && value.split('@')[0].length <= 64 && !value.startsWith('.') && !value.includes('..') && !value.includes('.@')
    && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);
}

function smtpFailure(cause) {
  if (Object.hasOwn(MAIL_ERRORS, cause.code)) return mailError(cause.code);
  if (cause.code === 'ETIMEDOUT') return mailError('SMTP_TIMEOUT');
  const recipient = cause.command === 'RCPT TO' || cause.rejected?.length > 0;
  const status = String(cause.response || '').match(/\b[45]\.\d{1,3}\.\d{1,3}\b/)?.[0];
  if (recipient && /^5\.1\.[1236]$/.test(status)) return mailError('SMTP_RECIPIENT_INVALID');
  if (recipient && /^[45]\.2\.2$/.test(status)) return mailError('SMTP_MAILBOX_FULL');
  if (cause.responseCode >= 400 && cause.responseCode < 500) return mailError('SMTP_TEMPORARY');
  if (recipient) return mailError('SMTP_RECIPIENT_REJECTED');
  return mailError('SMTP_FAILED');
}

function configuration(env) {
  const host = String(env.H5_SMTP_HOST || '').trim();
  const port = Number(env.H5_SMTP_PORT);
  const user = String(env.H5_SMTP_USER || '').trim();
  const pass = String(env.H5_SMTP_PASS || '');
  const from = String(env.H5_SMTP_FROM || '').trim();
  if (!/^[A-Za-z0-9.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !validEmail(user) || !validEmail(from) || !pass.trim() || /[\r\n\0]/.test(pass)) {
    throw mailError('SMTP_NOT_CONFIGURED', '邮箱发信服务尚未配置完成，请稍后再试。');
  }
  const server = env.H5_ORIGIN ? new URL(env.H5_ORIGIN) : null;
  const site = env.H5_FRONTEND_URL ? new URL(env.H5_FRONTEND_URL) : server ? new URL(env.H5_BASE_PATH || '/', server) : null;
  return {
    from, site: site?.href || '',
    transport: {
      host, port, secure: port === 465, requireTLS: port !== 465,
      auth: { user, pass }, tls: { servername: host, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      name: server?.hostname || 'localhost', connectionTimeout: 4000, greetingTimeout: 3000, socketTimeout: 5000, dnsTimeout: 3000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true, maxRecipients: 1
    }
  };
}

function createMailer({ env = process.env, createTransport, timeoutMs = 9500 } = {}) {
  const transportFactory = createTransport || (options => require('nodemailer').createTransport(options));
  async function run(operation) {
    const config = configuration(env);
    let socket, timer, transport;
    try {
      transport = transportFactory({
        ...config.transport,
        // Retain the underlying socket so the overall deadline also aborts SMTP work.
        getSocket(options, done) {
          socket = net.connect({ host: options.host, port: options.port });
          socket.once('error', done);
          socket.once('connect', () => {
            socket.removeListener('error', done);
            done(null, { connection: socket });
          });
        }
      });
      await Promise.race([
        Promise.resolve().then(() => operation(transport, config.from, config.site)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(mailError('SMTP_TIMEOUT')), timeoutMs);
        })
      ]);
    } catch (error) {
      throw smtpFailure(error);
    } finally {
      clearTimeout(timer);
      if (socket) socket.destroy();
      if (transport && typeof transport.close === 'function') transport.close();
    }
  }
  return {
    verify() { return run(transport => transport.verify()); },
    async sendVerificationEmail({ email, code, username, purpose = 'verify' }) {
      if (!validEmail(email)) throw mailError('INVALID_EMAIL', '邮箱格式不正确。');
      if (!/^\d{6}$/.test(code)) throw mailError('INVALID_CODE', '验证码格式不正确。');
      if (typeof username !== 'string' || !(purpose === 'login' ? /^[A-Za-z0-9_\u4e00-\u9fff]{2,24}$/ : /^[A-Za-z0-9_]{3,24}$/).test(username)) {
        throw mailError('INVALID_USERNAME', '用户名格式不正确。');
      }
      const label = purpose === 'login' ? '登录验证码' : '邮箱验证码';
      return run(async (transport, from, site) => {
        const result = await transport.sendMail({
          from: { name: '步步有为', address: from }, to: { address: email },
          envelope: { from, to: [email] }, subject: '步步有为' + label,
          text: `${username}，你好：\n\n你的步步有为${label}是：${code}\n\n验证码 10 分钟内有效，请勿转发或提供给他人。\n如果不是你本人操作，请忽略此邮件。\n\n步步有为${site ? ' ' + site : ''}`
        });
        if (!result || !Array.isArray(result.accepted) || !result.accepted.some(address => String(address).toLowerCase() === email.toLowerCase())) {
          throw result?.rejectedErrors?.[0] || mailError(result?.rejected?.length ? 'SMTP_RECIPIENT_REJECTED' : 'SMTP_FAILED');
        }
      });
    }
  };
}

function readEnvironmentFile(filename) {
  const fs = require('node:fs');
  const env = { ...process.env };
  const allowed = new Set(['H5_SMTP_HOST', 'H5_SMTP_PORT', 'H5_SMTP_USER', 'H5_SMTP_PASS', 'H5_SMTP_FROM']);
  for (const line of fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || !allowed.has(match[1])) throw mailError('SMTP_NOT_CONFIGURED', '发信配置文件格式不正确。');
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

const defaultMailer = createMailer();
module.exports = { MAIL_ERRORS, createMailer, sendVerificationEmail: defaultMailer.sendVerificationEmail, verifySMTP: defaultMailer.verify };

if (require.main === module) {
  (async () => {
    if (process.argv[2] !== '--verify' || ![3, 5].includes(process.argv.length) || (process.argv.length === 5 && process.argv[3] !== '--env-file')) {
      throw mailError('SMTP_NOT_CONFIGURED', 'usage: node mail.js --verify [--env-file /absolute/smtp.env]');
    }
    const env = process.argv[4] ? readEnvironmentFile(process.argv[4]) : process.env;
    await createMailer({ env }).verify();
    process.stdout.write('SMTP connection and authentication verified; no email sent.\n');
  })().catch(error => {
    process.stderr.write(`SMTP preflight failed (${['SMTP_NOT_CONFIGURED', 'SMTP_FAILED', 'SMTP_TIMEOUT'].includes(error.code) ? error.code : 'SMTP_NOT_CONFIGURED'}).\n`);
    process.exitCode = 1;
  });
}
