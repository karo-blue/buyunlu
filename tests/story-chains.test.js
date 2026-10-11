const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../game/core');

function stateAt(year = 2026, rankIndex = 1) {
  return Object.assign(core.newState(), { year, quarter: 2, rankIndex, investigationCheckedYear: year });
}

function advance(state, year) {
  state.year = year;
  state.quarter = 2;
  state.investigationCheckedYear = year;
  return core.startQuarter(state, () => 0.99);
}

function choose(state, event, id) {
  const index = event.options.findIndex(option => option.id === id);
  assert.ok(index >= 0, `缺少故事选项 ${id}`);
  assert.equal(core.resolveEvent(state, event, index), true);
}

test('跨年故事从第二季度进入，每年最多结算一个节点，退出重开不跳过', () => {
  const state = stateAt();
  state.quarter = 1;
  assert.equal(core.startQuarter(state, () => 0.99).storyId, undefined);
  state.quarter = 2;
  const first = core.startQuarter(state, () => 0.99);
  assert.equal(first.storyId, 'school');
  assert.deepEqual(state.storyProgress, {}, '仅打开事项不应算作已经选择');
  assert.deepEqual(core.startQuarter(state, () => 0.99), first);
  choose(state, first, 'survey');
  assert.equal(state.storyProgress.school.length, 1);
  core.finishQuarter(state, () => 0.99);
  assert.equal(core.startQuarter(state, () => 0.99).storyId, undefined);
  const next = advance(state, 2027);
  assert.equal(next.storyId, 'school');
  assert.equal(next.storyStep, 1);
  assert.match(next.scene, /2026年/);
  assert.match(next.scene, /逐间核对/);
});

test('早期选择改变后续处境和几年后的结果，而不只改变当前数值', () => {
  const careful = stateAt();
  const quick = stateAt();
  choose(careful, core.startQuarter(careful, () => 0.99), 'survey');
  choose(quick, core.startQuarter(quick, () => 0.99), 'patch');
  const carefulNext = advance(careful, 2027);
  const quickNext = advance(quick, 2027);
  assert.notEqual(carefulNext.scene, quickNext.scene);
  choose(careful, carefulNext, 'protect');
  choose(quick, quickNext, 'defer');
  choose(careful, advance(careful, 2028), 'check');
  choose(quick, advance(quick, 2028), 'paper');
  assert.equal(advance(careful, 2029).storyId, undefined, '回访需要等两年');
  const good = advance(careful, 2030);
  const weak = advance(quick, 2030);
  assert.match(good.scene, /师生来信/);
  assert.match(weak.scene, /返修/);
  const goodBefore = careful.reputation;
  const weakBefore = quick.reputation;
  choose(careful, good, 'visit');
  choose(quick, weak, 'visit');
  assert.ok(careful.reputation - goodBefore > quick.reputation - weakBefore);
  assert.match(core.storySummary(careful), /老旧学校修缮.*已完成/);
  assert.match(core.storySummary(quick), /返修/);
  assert.equal(careful.money, 80000, '项目工作不能从个人现金扣款');
});

test('三条故事能够完整走完，完成后不再重播，培养线按职级开放', () => {
  const state = stateAt();
  const seen = [];
  for (let year = 2026; year < 2044; year += 1) {
    if (year === 2034) state.rankIndex = 3;
    const event = advance(state, year);
    if (!event.storyId) continue;
    seen.push(`${event.storyId}:${event.storyStep}`);
    assert.ok(event.options.length >= 2);
    assert.ok(event.options.every(option => option.text && option.result && Number.isFinite(option.performance)));
    assert.equal(core.resolveEvent(state, event, 0), true);
  }
  assert.equal(seen.length, 12);
  assert.equal(new Set(seen).size, 12);
  for (const id of ['school', 'backlog', 'mentor']) assert.equal(state.storyProgress[id].length, 4);
  assert.equal(advance(state, 2050).storyId, undefined);
  const junior = core.normalizeState(Object.assign({}, state, { year: 2050, rankIndex: 1 }));
  delete junior.storyProgress.mentor;
  assert.equal(core.startQuarter(junior, () => 0.99).storyId, undefined);
});

test('监督核查优先，故事延后到后续季度，晋升和岗位变化不截断故事', () => {
  const state = stateAt(2026, 3);
  choose(state, core.startQuarter(state, () => 0.99), 'survey');
  Object.assign(state, { year: 2027, quarter: 2, rankIndex: 8, currentPosition: '新岗位' });
  const review = core.startQuarter(state, () => 0);
  assert.equal(review.isInvestigation, true);
  assert.equal(state.storyProgress.school.length, 1);
  core.resolveEvent(state, review, 0, () => 0.99);
  core.finishQuarter(state, () => 0.99);
  const next = core.startQuarter(state, () => 0.99);
  assert.equal(next.storyId, 'school');
  assert.equal(next.storyStep, 1);
  assert.match(next.scene, /当年/);
});

test('乱序选项按稳定标识记录，重复、失效和结束后的选择不能重复发奖励', () => {
  const state = stateAt();
  const event = core.startQuarter(state, () => 0.99);
  const shuffled = Object.assign({}, event, { options: event.options.slice().reverse() });
  choose(state, shuffled, 'survey');
  assert.equal(state.storyProgress.school[0].choiceId, 'survey');
  const before = JSON.stringify(state);
  assert.equal(core.resolveEvent(state, shuffled, 0), false);
  assert.equal(JSON.stringify(state), before);
  const next = advance(state, 2027);
  state.ended = true;
  assert.equal(core.resolveEvent(state, next, 0), false);
  state.ended = false;
  state.pendingInterrogation = { year: 2027, risk: 80 };
  assert.equal(core.resolveEvent(state, next, 0), false);
});

test('旧存档补空进度，损坏的故事记录按有效前缀恢复', () => {
  assert.deepEqual(core.normalizeState({}).storyProgress, {});
  const restored = core.normalizeState({ year: 2028, storyProgress: {
    school: [{ year: 2026, choiceId: 'survey', extra: '丢弃' }, { year: 2027, choiceId: '不存在' }],
    backlog: null,
    mentor: [{ year: 2099, choiceId: 'coach' }],
    unknown: [{ year: 2026, choiceId: 'anything' }],
  } });
  assert.deepEqual(restored.storyProgress, { school: [{ year: 2026, choiceId: 'survey' }] });
  assert.equal(advance(restored, 2028).storyStep, 1, '错过年份后仍能接续');
});

test('自动存档和手动存档都保留选择，重启后沿原分支继续', (t) => {
  const previousWx = global.wx;
  const local = new Map();
  global.wx = {
    getStorageSync: key => local.get(key),
    setStorageSync: (key, value) => local.set(key, JSON.parse(JSON.stringify(value))),
  };
  t.after(() => { global.wx = previousWx; });
  const storage = require('../services/storage');
  const state = stateAt();
  choose(state, core.startQuarter(state, () => 0.99), 'phased');
  assert.equal(storage.save(state), true);
  assert.equal(storage.saveSlot(1, state), true);
  for (const restored of [storage.load(), storage.loadSlot(1)]) {
    assert.deepEqual(restored.storyProgress, state.storyProgress);
    const next = advance(restored, 2027);
    assert.equal(next.storyStep, 1);
    assert.match(next.scene, /分期/);
  }
});

test('三条故事全部162条选择路径均可存档接续，并保留各自的结果', () => {
  const baseline = stateAt(2026, 3);
  const starts = [];
  for (let year = 2026; year <= 2040; year += 1) {
    const event = advance(baseline, year);
    if (!event.storyId) continue;
    if (event.storyStep === 0) starts.push(JSON.parse(JSON.stringify(baseline)));
    core.resolveEvent(baseline, event, 0);
  }
  assert.equal(starts.length, 3);
  let paths = 0;
  for (const start of starts) {
    const outcomes = new Set();
    for (let first = 0; first < 3; first += 1) {
      for (let second = 0; second < 3; second += 1) {
        for (let third = 0; third < 3; third += 1) {
          for (let last = 0; last < 2; last += 1) {
            let state = core.normalizeState(start);
            const id = core.startQuarter(state, () => 0.99).storyId;
            const choices = [first, second, third, last];
            let steps = 0;
            for (let year = start.year; year < start.year + 6; year += 1) {
              const event = advance(state, year);
              if (!event.storyId) continue;
              assert.equal(event.storyId, id);
              assert.equal(event.storyStep, steps);
              assert.doesNotMatch(event.scene, /undefined|NaN/);
              if (steps === 3) outcomes.add(event.options[0].result);
              assert.equal(core.resolveEvent(state, event, choices[steps]), true);
              assert.ok([state.health, state.reputation, state.annualPerformance].every(Number.isFinite));
              state = core.normalizeState(JSON.parse(JSON.stringify(state)));
              steps += 1;
              if (steps === 4) break;
            }
            assert.equal(steps, 4);
            assert.equal(state.storyProgress[id].length, 4);
            paths += 1;
          }
        }
      }
    }
    assert.equal(outcomes.size, 3, '每条故事应有三种不同的长期结果');
  }
  assert.equal(paths, 162);
});

test('连续20年的季度和年度结算正常推进故事，结局后履历仍保留', () => {
  let state = stateAt(2026, 3);
  state.quarter = 1;
  const nodesByYear = new Map();
  for (let quarter = 0; quarter < 80; quarter += 1) {
    if (state.quarter === 1) core.restoreHealth(state, 'exercise', 0, 3);
    const event = core.startQuarter(state, () => 0.99);
    if (event.storyId) nodesByYear.set(state.year, (nodesByYear.get(state.year) || 0) + 1);
    assert.equal(core.resolveEvent(state, event, 0, () => 0.99), true);
    core.finishQuarter(state, () => 0.99);
    state = core.normalizeState(JSON.parse(JSON.stringify(state)));
    assert.equal(state.ended, false);
  }
  assert.equal(state.year, 2046);
  assert.equal(nodesByYear.size, 12);
  assert.ok([...nodesByYear.values()].every(count => count === 1));
  assert.equal(Object.values(state.storyProgress).every(steps => steps.length === 4), true);
  state.ended = true;
  state.ending = '正常退休';
  state.records = [];
  const text = core.storySummary(core.normalizeState(state));
  for (const title of ['老旧学校修缮', '积压事项清理', '青年同事培养']) assert.ok(text.includes(`${title}（已完成）`));
  assert.match(text, /2026年：雨后的教室/);
});
