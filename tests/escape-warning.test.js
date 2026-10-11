const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../game/core');
const network = require('../game/network');

function riskyState(amount = 40000) {
  const state = core.newState();
  Object.assign(state, {
    name: '测试玩家', money: 260000, illicitIncome: amount, riskTrail: 12,
    evidence: [{ year: 2028, title: '一笔异常往来', choice: '收下款项', risk: 8 }],
  });
  return state;
}

test('落马命中时只有一次30%证据提醒机会，并完整写入存档', () => {
  const state = riskyState();
  const rolls = [0.29, 0.123456];
  const result = core.queueFallOutcome(state, () => rolls.shift());
  assert.equal(result.warning, true);
  assert.equal(state.warningUsed, true);
  assert.equal(state.pendingInterrogation, null);
  assert.equal(state.pendingEvidenceWarning.stage, 'choice');
  assert.ok(Number.isInteger(state.pendingEvidenceWarning.seed));

  const loaded = core.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(loaded.pendingEvidenceWarning, state.pendingEvidenceWarning);
  const second = core.queueFallOutcome(loaded, () => 0);
  assert.equal(second.warning, false, '同一人生不得再次触发提醒');
  assert.ok(loaded.pendingInterrogation);

  const missed = riskyState();
  assert.equal(core.queueFallOutcome(missed, () => 0.3).warning, false, '边界0.30不触发');
  assert.ok(missed.pendingInterrogation);

  const clean = core.newState();
  clean.riskTrail = 12;
  assert.equal(core.queueFallOutcome(clean, () => 0).warning, false, '没有未说明不当收入时不出现提醒');
});

test('小额主动说明会全额退缴并继续游戏，但终身记录仍保留', () => {
  const state = riskyState(50000);
  core.queueFallOutcome(state, () => 0);
  const event = core.buildEvidenceWarningEvent(state);
  assert.match(event.scene, /虚构游戏机制/);
  assert.doesNotMatch(event.scene, /路线|证件|边境/);
  assert.equal(core.resolveEvidenceWarning(state, event, 0), true);
  assert.equal(state.ended, false);
  assert.equal(state.pendingEvidenceWarning, null);
  assert.equal(state.pendingInterrogation, null);
  assert.equal(state.money, 210000);
  assert.equal(state.reportedIllicitIncome, 50000);
  assert.equal(state.illicitIncome, 50000, '累计记录不能被抹掉');
  assert.equal(state.riskTrail, 0);
  assert.equal(network.illicitRiskOf(state), 0);
  assert.match(network.illicitRiskNote(state), /已主动说明并全部退缴/);
});

test('大额主动说明进入既有从轻处理流程，拒不交代会显著抬高后续风险', () => {
  const large = riskyState(core.SMALL_CONFESSION_LIMIT + 1);
  core.queueFallOutcome(large, () => 0);
  assert.equal(core.resolveEvidenceWarning(large, core.buildEvidenceWarningEvent(large), 0), true);
  assert.ok(large.pendingInterrogation);
  assert.equal(large.pendingEvidenceWarning, null);
  assert.match(large.lastResult, /不能继续/);

  const denied = riskyState(40000);
  core.queueFallOutcome(denied, () => 0);
  assert.equal(core.resolveEvidenceWarning(denied, core.buildEvidenceWarningEvent(denied), 1), true);
  assert.equal(denied.pendingInterrogation, null);
  assert.equal(denied.denialPressure, 1);
  assert.match(denied.lastResult, /85%/);
  assert.equal(core.annualFallChance(denied), Math.min(1, network.fallChance(denied) * 3));
});

test('拒不交代后下一笔不当收入有85%概率直接被发现且不会再给提醒', () => {
  const state = riskyState(40000);
  state.warningUsed = true;
  state.denialPressure = 1;
  const event = {
    title: '再次收受款项',
    options: [{ text: '收下', effect: { wealth: 100000 }, risk: 3, result: '钱已到账。' }],
  };
  assert.equal(core.resolveBurst(state, event, 0, () => 0.84), true);
  assert.ok(state.pendingInterrogation);
  assert.equal(state.pendingEvidenceWarning, null);
  assert.equal(state.denialPressure, 0);
  assert.match(state.lastResult, /直接发现/);
});

test('三种交通方式只做抽象概率判定，结果由存档种子固定', () => {
  assert.deepEqual(core.ESCAPE_METHODS.map(item => [item.id, item.chance]), [
    ['plane', 0.28], ['ship', 0.32], ['train', 0.30],
  ]);
  const state = riskyState(40000);
  state.money = 1286000;
  core.queueFallOutcome(state, () => 0);
  assert.equal(core.resolveEvidenceWarning(state, core.buildEvidenceWarningEvent(state), 2), true);
  assert.equal(state.pendingEvidenceWarning.stage, 'method');
  const transport = core.buildEscapeMethodEvent(state);
  assert.deepEqual(transport.options.map(item => item.method), ['plane', 'ship', 'train']);
  assert.doesNotMatch(transport.scene, /国家|城市|航班|港口|车次|证件/);

  const method = core.ESCAPE_METHODS.find(item => core.escapeResultFor(state.pendingEvidenceWarning.seed, item.id) < item.chance);
  assert.ok(method, '测试种子至少应有一种成功方式');
  const first = core.resolveEscapeMethod(state, transport, transport.options.findIndex(item => item.method === method.id));
  assert.equal(first.success, true);
  assert.equal(state.ended, true);
  assert.equal(state.ending, '出逃结局');
  assert.equal(state.escapeDetail.amount, 1286000, '榜单金额必须等于成功一刻的当前现金');
  assert.equal(Object.hasOwn(state.escapeDetail, 'position'), false);
  assert.equal(Object.hasOwn(state.escapeDetail, 'workYears'), false);
  assert.match(state.lastResult, /去向无人知晓/);
  assert.doesNotMatch(state.lastResult, /进入出逃结局|公职生涯在此终止/);
});

test('出逃失败进入现有审查流程，不提供广告或读档重掷入口', () => {
  const state = riskyState(90000);
  core.queueFallOutcome(state, () => 0);
  core.resolveEvidenceWarning(state, core.buildEvidenceWarningEvent(state), 2);
  const event = core.buildEscapeMethodEvent(state);
  const method = core.ESCAPE_METHODS.find(item => core.escapeResultFor(state.pendingEvidenceWarning.seed, item.id) >= item.chance);
  assert.ok(method, '测试种子至少应有一种失败方式');
  const result = core.resolveEscapeMethod(state, event, event.options.findIndex(item => item.method === method.id));
  assert.equal(result.success, false);
  assert.equal(state.ended, false);
  assert.ok(state.pendingInterrogation);
  assert.equal(state.pendingEvidenceWarning, null);
  assert.doesNotMatch(state.lastResult, /广告|免广告卡|重试/);
});
