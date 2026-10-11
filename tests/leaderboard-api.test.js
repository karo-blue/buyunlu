// Tests opt in to an inert example endpoint; the distributed application stays offline.
require('../services/config').leaderboardApiBaseUrl = 'https://example.invalid/buyunlu-api';
const test = require('node:test');
const assert = require('node:assert/strict');

test('leaderboard API client submits the ending state to the configured domain', async () => {
  let requestOptions;
  let clientId = '';
  global.wx = {
    getStorageSync: () => clientId,
    setStorageSync: (key, value) => { clientId = value; },
    request: options => {
      requestOptions = options;
      options.success({ statusCode: 200, data: { ok: true, rank: 4, total: 2, entries: [] } });
    },
  };
  const apiPath = require.resolve('../services/leaderboard-api');
  delete require.cache[apiPath];
  const api = require(apiPath);
  const response = await api.submit({
    name: '高植物', rankIndex: 11, age: 65, achievements: 30,
    reputation: 96, health: 88, illicitIncome: 0, faultHelpUsedYear: 0,
  });
  assert.equal(response.rank, 4);
  assert.match(requestOptions.url, /^https:\/\/example\.invalid\/buyunlu-api\/leaderboard\/submit$/);
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.data.name, '高植物');
  assert.equal(requestOptions.data.reputation, 96);
  assert.equal(requestOptions.data.health, 88);
  assert.equal(requestOptions.data.illicitIncome, 0);
  assert.equal(requestOptions.data.faultHelpUsedYear, 0);
  assert.ok(clientId);
  delete global.wx;
});

test('落马结局上报真实履历，由服务端归零人生榜并保留老虎榜工作年限', async () => {
  let requestOptions;
  let clientId = '';
  global.wx = {
    getStorageSync: () => clientId,
    setStorageSync: (key, value) => { clientId = value; },
    request: options => {
      requestOptions = options;
      options.success({ statusCode: 200, data: { ok: true, rank: 1, total: 1, entries: [] } });
    },
  };
  const apiPath = require.resolve('../services/leaderboard-api');
  delete require.cache[apiPath];
  const api = require(apiPath);
  const response = await api.submit({
    name: '林知行', rankIndex: 8, rankYears: 4, achievements: 60, review: 92, integrity: 30, age: 49,
    currentPosition: '县委办副主任',
    fallDetail: { stance: 'silent', informant: '县长裴怀瑾', confiscated: 220000, proofs: ['2027年，一份档案袋'] },
    ending: '落马被查',
  });
  assert.equal(response.rank, 1);
  assert.equal(requestOptions.data.fell, true);
  assert.equal(requestOptions.data.rankIndex, 8);
  assert.equal(requestOptions.data.rankYears, 4);
  assert.equal(requestOptions.data.workYears, 27);
  assert.equal(requestOptions.data.achievements, 60);
  assert.equal(requestOptions.data.review, 92);
  assert.equal(requestOptions.data.integrity, 30);
  assert.equal(requestOptions.data.position, '县委办副主任');
  assert.equal(requestOptions.data.confiscatedValue, 220000);
  delete global.wx;
});

test('leaderboard API format identifies the real player and total users', () => {
  const api = require('../services/leaderboard-api');
  const text = api.formatRanking({ total: 2, rank: 4, entries: [{ rank: 1, name: '甲知行', position: '正厅级' }, { rank: 4, name: '高植物', position: '副国级', isPlayer: true }] });
  assert.match(text, /全网玩家：2人/);
  assert.match(text, /你的全网排名：第4名/);
  assert.match(text, /4\. 你 · 高植物/);
});

test('remote board is split into top three and the players right around me', () => {
  const api = require('../services/leaderboard-api');
  const text = api.formatRanking({
    total: 9000, rank: 5000,
    entries: [
      { rank: 1, name: '榜首', position: '国家级副职' },
      { rank: 2, name: '榜眼', position: '省部级正职' },
      { rank: 3, name: '榜三', position: '省部级副职' },
      { rank: 4999, name: '前面那位', position: '厅局级正职' },
      { rank: 5000, name: '高植物', position: '厅局级副职', isPlayer: true },
      { rank: 5001, name: '后面那位', position: '厅局级副职' },
    ],
  });
  assert.match(text, /全网前列/);
  ['🥇 1. 榜首', '🥈 2. 榜眼', '🥉 3. 榜三'].forEach(row => assert.match(text, new RegExp(row.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.ok(!text.includes('你的前后位'), '前后位不再挂段落标题');
  assert.ok(!text.includes('↑') && !text.includes('▶') && !text.includes('↓'), '前后位行不带箭头前缀，自己那栏靠高亮区分');
  assert.match(text, /4999\. 前面那位/);
  assert.match(text, /5000\. 你 · 高植物（本设备）/);
  assert.match(text, /5001\. 后面那位/);
});

test('remote board entries flagged as samples are dropped and the total is corrected', () => {
  const api = require('../services/leaderboard-api');
  // 旧版服务端还没重新部署时，响应里仍会混着样本行与 sampleCount；前端必须自己兜底
  const clean = api.sanitizeRemote({
    ok: true, rank: 9292, total: 9292, sampleCount: 9291,
    entries: [
      { rank: 1, name: '高育良', position: '省级领导', isSample: true },
      { rank: 2, name: '李达康', position: '市委书记', isSample: true },
      { rank: 9292, name: '高植物', position: '科员', isPlayer: true },
    ],
  });
  assert.equal(clean.entries.length, 1);
  assert.equal(clean.entries[0].name, '高植物');
  assert.equal(clean.total, 1);
  const text = api.formatRanking(clean);
  assert.ok(!text.includes('高育良') && !text.includes('李达康'));
  assert.match(text, /全网玩家：1人/);
});

test('leaderboard API submits remaining assets and fetches the tiger board', async () => {
  let requestOptions;
  let clientId = 'client-tiger';
  global.wx = {
    getStorageSync: () => clientId,
    setStorageSync: () => {},
    request: options => {
      requestOptions = options;
      options.success({ statusCode: 200, data: { ok: true, rank: 2, total: 1, entries: [] } });
    },
  };
  const apiPath = require.resolve('../services/leaderboard-api');
  delete require.cache[apiPath];
  const api = require(apiPath);
  await api.submit({ ended: true, name: '高植物', retirementWealth: 123456 });
  assert.equal(requestOptions.data.assetValue, 123456);
  const tiger = await api.fetchTigerRanking(6);
  assert.match(requestOptions.url, /\/tigerboard\?limit=6/);
  assert.match(api.formatTigerRanking(tiger), /你的老虎榜排名/);
  delete global.wx;
});

test('出逃结局提交固定现金并可读取金蝉榜', async () => {
  let requestOptions;
  global.wx = {
    getStorageSync: () => 'client-escape',
    setStorageSync: () => {},
    request: options => {
      requestOptions = options;
      options.success({ statusCode: 200, data: { ok: true, rank: 1, total: 1, entries: [] } });
    },
  };
  const apiPath = require.resolve('../services/leaderboard-api');
  delete require.cache[apiPath];
  const api = require(apiPath);
  await api.submit({
    name: '林知行', rankIndex: 8, age: 55, currentPosition: '不应上传的具体岗位',
    ended: true, ending: '出逃结局', escapeDetail: { method: 'train', amount: 765432, rankIndex: 8 },
  });
  assert.equal(requestOptions.data.escaped, true);
  assert.equal(requestOptions.data.escapeMethod, 'train');
  assert.equal(requestOptions.data.escapeAmount, 765432);
  assert.equal(requestOptions.data.position, '', '出逃记录不上传具体职位');
  await api.fetchEscapeRanking(8);
  assert.match(requestOptions.url, /\/escapeboard\?limit=8/);
  assert.match(api.formatEscapeRanking({ rank: null, total: 0, entries: [] }), /还没有公开的出逃结局记录/);
  delete global.wx;
});
