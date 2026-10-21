const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../game/core');
const leaderboard = require('../services/leaderboard');
const server = require('../server/app');
const { candidate } = require('./helpers/leader-fixture');

test('人民公仆在步步有为中按清正条件自动形成荣誉称呼', () => {
  const state = core.newState();
  Object.assign(state, {
    rankIndex: core.RANKS.length,
    rankYears: 2,
    illicitIncome: 0,
    integrity: 90,
    year: 2038,
  });
  const status = core.publicServantStatus(state);
  assert.equal(status.eligible, true);
  assert.equal(core.grantPublicServant(state), true);
  assert.equal(state.honorTitle, core.PUBLIC_SERVANT_TITLE);
  assert.equal(state.honorYear, 2038);
  assert.equal(core.grantPublicServant(state), false, '同一称呼不重复记账');
});

test('年度结算会在退休检查前记录人民公仆，但不改变11档官阶', () => {
  const state = core.newState();
  Object.assign(state, {
    rankIndex: core.RANKS.length,
    rankYears: 1,
    quarter: 4,
    age: 50,
    year: 2038,
    illicitIncome: 0,
    integrity: 90,
    health: 90,
    riskTrail: 0,
  });
  const result = core.finishQuarter(state, () => 1);
  assert.equal(result.honor, true);
  assert.equal(state.honorTitle, '人民公仆');
  assert.equal(state.rankIndex, core.RANKS.length);
  assert.equal(core.RANKS.length, 11);
});

test('落马或处分状态不能继续携带人民公仆称呼', () => {
  const state = core.normalizeState({ honorTitle: '人民公仆', honorYear: 2038 });
  core.revokeHonor(state);
  assert.equal(state.honorTitle, '');
  assert.equal(state.honorYear, 0);
  assert.equal(core.normalizeState({ honorTitle: '伪造称呼', honorYear: 2038 }).honorTitle, '');
  assert.equal(core.normalizeState({ honorTitle: '人民公仆', honorYear: 2038, fallDetail: { stance: 'silent' } }).honorTitle, '');
});

test('本地排行榜把人民公仆放在副国级之前并显示称呼', () => {
  const result = leaderboard.getPlayerRanking({
    name: '周慎行', rankIndex: 11, rankYears: 1, honorTitle: '人民公仆', currentPosition: '国家级副职',
  });
  assert.equal(result.entries[0].rankIndex, 12);
  const text = leaderboard.formatRanking(result);
  assert.match(text, /人民公仆/);
  assert.doesNotMatch(text, /国家级副职/);
});

test('领导者在排行榜排在人民公仆之前并保留完整称号', () => {
  const state = candidate();
  assert.equal(core.grantLeader(state), true);
  const result = leaderboard.getPlayerRanking(state);
  assert.equal(result.entries[0].rankIndex, 13);
  assert.equal(result.entries[0].leader, true);
  assert.match(leaderboard.formatRanking(result), /领导者 · 人民公仆/);
});

test('排行榜兼容旧版 honorTitle 字段并显示人民公仆', () => {
  const rows = leaderboard.rankingRows({
    rank: 1,
    total: 1,
    entries: [{ rank: 1, name: '王念书', rankIndex: 12, position: '', honorTitle: '人民公仆' }],
  });
  const first = rows.find(row => row.kind === 'entry');
  assert.equal(first.honor, '人民公仆');
  assert.match(leaderboard.rowsToText(rows), /王念书.*人民公仆/);
});

test('排行榜把旧接口的虚拟第12档还原为人民公仆', () => {
  const rows = leaderboard.rankingRows({
    rank: 1,
    total: 1,
    entries: [{ rank: 1, name: '王念书', rankIndex: 12, position: '' }],
  });
  const first = rows.find(row => row.kind === 'entry');
  assert.equal(first.honor, '人民公仆');
  assert.match(leaderboard.rowsToText(rows), /王念书.*人民公仆/);
});

test('服务端只接受白名单荣誉，并按虚拟第12档排序', () => {
  const honor = server.normalizeSubmission({
    clientId: 'honor', name: '周慎行', rankIndex: 11, rankYears: 1,
    achievements: 1, review: 80, integrity: 90, age: 50, honor: '人民公仆',
  });
  const ordinary = server.normalizeSubmission({
    clientId: 'ordinary', name: '林知行', rankIndex: 11, rankYears: 20,
    achievements: 999, review: 100, integrity: 100, age: 60,
  });
  assert.equal(honor.honor, '人民公仆');
  assert.equal(server.leaderboardRankIndexOf(honor), 12);
  assert.equal(server.compareEntries(honor, ordinary) < 0, true);
  assert.equal(server.normalizeSubmission(Object.assign({}, honor, { honor: '伪造称呼' })).honor, '');
});
