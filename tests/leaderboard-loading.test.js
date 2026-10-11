const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('三个联网榜单在等待期间显示同步状态并阻止重复请求', () => {
  const page = fs.readFileSync(path.join(__dirname, '../pages/index/index.js'), 'utf8');
  assert.match(page, /正在同步全网榜单/);
  assert.match(page, /_tigerBoardSyncing/);
  assert.match(page, /_escapeBoardSyncing/);
  assert.match(page, /_lifeBoardSyncing/);
});
