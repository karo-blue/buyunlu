const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../services/config');

test('published client starts without service or advertising identifiers', () => {
  for (const key of ['appId', 'rewardedAdUnitId', 'faultHelpAdUnitId', 'leaderboardApiBaseUrl']) assert.equal(config[key], '', key);
  const project = require('../project.config.json');
  assert.equal(project.appid, 'touristappid');
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'project.private.config.json')), false);
});

test('an unconfigured leaderboard cannot send device data to a network service', async () => {
  let sent = false;
  global.wx = { request() { sent = true; } };
  try {
    const api = require('../services/leaderboard-api');
    assert.equal(api.isConfigured(), false);
    await assert.rejects(api.submit({ name: '测试角色', rankIndex: 1 }), /unavailable/);
    assert.equal(sent, false);
  } finally { delete global.wx; }
});

test('public repository contains only the mini-program distribution', () => {
  const root = path.join(__dirname, '..');
  assert.equal(fs.existsSync(path.join(root, 'mobile')), false);
  const pkg = require('../package.json');
  assert.deepEqual(Object.keys(pkg.scripts).sort(), ['extract:source-data', 'test']);
  assert.doesNotMatch(pkg.description, /安卓|Android|离线版/);
  for (const file of ['README.md', 'RELEASE_NOTES.md', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /mobile\/|安卓|Android SDK|WebView|手机兼容层/);
  }
  const ignored = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/);
  assert.ok(ignored.includes('mobile/'));
  assert.ok(ignored.includes('*.apk'));
  assert.ok(require('../project.config.json').packOptions.ignore.some(item => item.type === 'folder' && item.value === '.git'));
});

test('published license consistently restricts use to noncommercial purposes', () => {
  const root = path.join(__dirname, '..');
  const licenseId = 'SEE LICENSE IN LICENSE';
  assert.equal(require('../package.json').license, licenseId);
  assert.equal(require('../server/package.json').license, 'SEE LICENSE IN ../LICENSE');
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
  assert.match(license, /步云录非商业使用许可 1\.0/);
  for (const restriction of ['不授权商业化使用', '售卖', '原样副本', '广告', '内购', '订阅', '收费运营']) assert.ok(license.includes(restriction), restriction);
  assert.doesNotMatch(license, /PolyForm|MIT License/);
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /不授权商业化使用/);
  assert.match(readme, /旧版本.*MIT/);
  assert.match(readme, /不会追溯撤回/);
  assert.doesNotMatch(readme, /本项目按 MIT 许可证开源/);
  assert.match(fs.readFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'), /步云录非商业使用许可 1\.0/);
});
