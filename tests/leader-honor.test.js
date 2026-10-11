const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../game/core');
const honorRules = require('../game/honor-rules');
const { candidate } = require('./helpers/leader-fixture');

test('终极考验三关的纯执行通过率为12.5%', () => {
  assert.equal(honorRules.LEADER_TRIAL_SUCCESS_CHANCE, 0.5);
  assert.equal(honorRules.LEADER_TRIAL_SUCCESS_CHANCE ** 3, 0.125);
});

test('人民公仆必须副国任满两年，第三年才可能升级领导者', () => {
  const one = candidate({ honorTitle: '', honorYear: 0, rankYears: 1 });
  assert.equal(core.grantPublicServant(one), false);
  one.rankYears = 2;
  assert.equal(core.grantPublicServant(one), true);
  assert.equal(core.grantLeader(one), false, '刚获得人民公仆不能同时升级');
  const ready = candidate();
  assert.equal(core.grantLeader(ready), true);
  assert.equal(core.honorDisplayTitle(ready), '领导者 · 人民公仆');
  assert.equal(ready.rankIndex, 11);
  assert.equal(ready.leaderYear, 2067);
  assert.equal(core.grantLeader(ready), false);
});

test('每项苛刻条件独立生效，无法用广告加成代替', () => {
  const changes = [
    { rankYears: 2 }, { honorYear: 2067 }, { illicitIncome: 1 }, { integrity: 99 },
    { reputation: 97 }, { health: 59 }, { achievements: 119 }, { faultHelpUsedYear: 2030 },
    { honorHistory: [] }, { storyProgress: {} }, { leaderTrial: null },
    { pendingInterrogation: { year: 2067, risk: 80 } }, { ended: true },
  ];
  for (const change of changes) {
    const state = candidate(Object.assign({ promotionAdWatchCount: 999 }, change));
    assert.equal(core.grantLeader(state), false, JSON.stringify(change));
  }
  for (const bad of [{ review: 94 }, { faults: 1 }, { year: 2040 }]) {
    const state = candidate();
    Object.assign(state.honorHistory[2], bad);
    assert.equal(core.grantLeader(state), false);
  }
});

test('三季度统筹考验每关只有50%执行成功率，广告不能加成，失败后本局不重试', () => {
  let state = candidate({ year: 2066, rankYears: 2, age: 62, leaderTrial: null });
  state.honorHistory = Array.from({ length: 5 }, (_, i) => ({ year: 2061 + i, review: 100, faults: 0 }));
  const choices = ['reserve', 'flex', 'verify'];
  for (let quarter = 1; quarter <= 3; quarter += 1) {
    state.quarter = quarter;
    state.investigationCheckedYear = state.year;
    const event = core.startQuarter(state, () => 0.99);
    assert.equal(event.leaderTrialStep, quarter - 1);
    const shuffled = Object.assign({}, event, { options: event.options.slice().reverse() });
    const index = shuffled.options.findIndex(option => option.id === choices[quarter - 1]);
    assert.equal(core.resolveEvent(state, shuffled, index, () => 0.49), true);
    assert.equal(core.resolveEvent(state, shuffled, index), false, '同一节点不可重复结算');
    core.finishQuarter(state, () => 0.99);
    state = core.normalizeState(JSON.parse(JSON.stringify(state)));
  }
  assert.equal(state.leaderTrial.choices.length, 3);
  assert.ok(state.leaderTrial.choices.every(item => item.success === true));
  const last = core.startQuarter(state, () => 0.99);
  assert.equal(last.leaderTrialStep, undefined);
  core.resolveEvent(state, last, last.options.findIndex(o => o.performance === 3), () => 0.99);
  const annual = core.finishQuarter(state, () => 0.99);
  assert.equal(annual.leaderHonor, true);
  const failed = candidate({ year: 2066, rankYears: 2, quarter: 1, leaderTrial: null, promotionAdWatchCount: 999 });
  failed.honorHistory = state.honorHistory.map(item => ({ ...item, year: item.year - 1 }));
  failed.investigationCheckedYear = failed.year;
  const event = core.startQuarter(failed, () => 0.99);
  core.resolveEvent(failed, event, event.options.findIndex(o => o.id === 'essentials'), () => 0.50);
  assert.equal(failed.leaderTrial.choices[0].success, false);
  core.finishQuarter(failed);
  assert.equal(core.startQuarter(failed, () => 0.99).leaderTrialStep, undefined);
  failed.year += 1;
  failed.quarter = 1;
  assert.equal(core.startQuarter(failed, () => 0.99).leaderTrialStep, undefined, '终极考验每段人生只有一次完整机会');
});

test('退休当年达标可先授予荣誉，后来健康下降不抹除已获荣誉', () => {
  const state = candidate({ year: 2066, age: 64, rankYears: 2, quarter: 4, honorYear: 2066, leaderTrial: { year: 2066, choices: candidate().leaderTrial.choices }, annualPerformance: 12 });
  state.honorHistory = Array.from({ length: 5 }, (_, i) => ({ year: 2061 + i, review: 100, faults: 0 }));
  const result = core.finishQuarter(state, () => 0.99);
  assert.equal(result.leaderHonor, true);
  assert.equal(state.ended, true);
  assert.match(state.ending, /退休/);
  state.health = 45;
  assert.equal(core.honorDisplayTitle(core.normalizeState(state)), '领导者 · 人民公仆');
});

test('年度荣誉记录不会被消除过失洗掉，旧存档不补造历史', () => {
  const state = candidate({ year: 2066, quarter: 4, honorHistory: [], faults: 0 });
  core.resolveEvent(state, { title: '测试过失', options: [{ text: '选择', performance: -1, result: '出现过失' }] }, 0);
  core.resolveFaultHelp(state, 1, () => 0);
  assert.equal(state.faults, 0);
  core.finishQuarter(state, () => 0.99);
  assert.equal(state.honorHistory.at(-1).faults, 1);
  const old = core.normalizeState({ year: 2066, age: 62, rankIndex: 11, rankYears: 2, quarter: 4 });
  assert.deepEqual(old.honorHistory, []);
  core.finishQuarter(old, () => 0.99);
  assert.deepEqual(old.honorHistory, [], '更新前不完整的年度也不能补成无过失');
});

test('获得荣誉后新增不当收入立即撤销两级荣誉', () => {
  const state = candidate();
  core.grantLeader(state);
  core.resolveBurst(state, { title: '测试往来', options: [{ text: '收取', effect: { wealth: 10000 }, risk: 1, result: '收到钱' }] }, 0);
  assert.equal(state.honorTitle, '');
  assert.equal(state.leaderYear, 0);
  assert.equal(state.leaderCertificate, null);
});
