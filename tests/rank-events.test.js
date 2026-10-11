const test = require('node:test');
const assert = require('node:assert');

const {
  RANKS,
  RANK_EVENT_POOL,
  RANK_EVENT_RECENT,
  rankPoolFor,
  rankEventFor,
  startQuarter,
  normalizeState,
  newState,
} = require('../game/core');

const RANK_COUNT = RANKS.length;

function eachEvent(fn) {
  RANK_EVENT_POOL.forEach((pool, index) => {
    pool.forEach((event, i) => fn(event, index + 1, i));
  });
}

test('题库覆盖全部 11 个职级，每职级至少 50 道', () => {
  assert.strictEqual(RANK_EVENT_POOL.length, RANK_COUNT);
  RANK_EVENT_POOL.forEach((pool, index) => {
    assert.ok(Array.isArray(pool), `第 ${index + 1} 级题库不是数组`);
    assert.ok(pool.length >= 50, `第 ${index + 1} 级只有 ${pool.length} 道，不足 50`);
  });
});

test('每一道题的字段都完整可用', () => {
  eachEvent((event, rank, i) => {
    const where = `职级${rank} 第${i + 1}题`;
    assert.ok(typeof event.title === 'string' && event.title.length > 0, `${where} 缺 title`);
    assert.ok(typeof event.scene === 'string' && event.scene.length > 0, `${where} 缺 scene`);
    assert.ok(Array.isArray(event.options) && event.options.length >= 2, `${where} 选项不足`);
    event.options.forEach((option, j) => {
      assert.ok(typeof option.text === 'string' && option.text.length > 0, `${where} 选项${j + 1} 缺 text`);
      assert.ok(Number.isFinite(option.performance), `${where} 选项${j + 1} performance 非法`);
      assert.ok(typeof option.result === 'string' && option.result.length > 0, `${where} 选项${j + 1} 缺 result`);
      Object.entries(option.effect || {}).forEach(([key, value]) => {
        assert.ok(
          ['reputation', 'network', 'integrity', 'health', 'seniority', 'wealth'].includes(key),
          `${where} 选项${j + 1} 用了未支持的 effect 字段 ${key}`,
        );
        assert.ok(Number.isFinite(value), `${where} 选项${j + 1} 的 ${key} 不是数字`);
      });
    });
  });
});

// 全局写作约束：不存在"靠破规则赢"的路径。
// 拿最高分的那个选项，绝不能是扣廉洁的那一个。
test('最高分的选项永远不是减廉洁的那一个', () => {
  eachEvent((event, rank, i) => {
    const best = Math.max(...event.options.map(item => item.performance));
    const winners = event.options.filter(item => item.performance === best);
    winners.forEach(item => {
      assert.ok(
        (item.effect && item.effect.integrity ? item.effect.integrity : 0) >= 0,
        `职级${rank} 第${i + 1}题：最高分选项是「${item.text}」，却在扣廉洁`,
      );
    });
  });
});

test('同一职级内题目不重名', () => {
  RANK_EVENT_POOL.forEach((pool, index) => {
    const titles = pool.map(item => item.title);
    assert.strictEqual(new Set(titles).size, titles.length, `第 ${index + 1} 级有重复题名`);
  });
});

test('rankPoolFor 按职级取题库，越界会被夹回', () => {
  assert.strictEqual(rankPoolFor(1), RANK_EVENT_POOL[0]);
  assert.strictEqual(rankPoolFor(6), RANK_EVENT_POOL[5]);
  assert.strictEqual(rankPoolFor(11), RANK_EVENT_POOL[10]);
  assert.strictEqual(rankPoolFor(0), RANK_EVENT_POOL[0]);
  assert.strictEqual(rankPoolFor(99), RANK_EVENT_POOL[RANK_COUNT - 1]);
  assert.strictEqual(rankPoolFor(undefined), RANK_EVENT_POOL[0]);
});

test('每个职级都只从自己的题库里抽题', () => {
  for (let rank = 1; rank <= RANK_COUNT; rank += 1) {
    const state = normalizeState(Object.assign(newState(), { rankIndex: rank }));
    state.investigationCheckedYear = state.year;
    const pool = rankPoolFor(rank);
    const titles = new Set(pool.map(item => item.title));
    for (let i = 0; i < RANK_EVENT_RECENT; i += 1) {
      const event = startQuarter(state, () => i / RANK_EVENT_RECENT);
      assert.ok(titles.has(event.title), `职级${rank} 抽到了别的职级的题：${event.title}`);
    }
  }
});

// 50 道题要完整地轮一遍才开始重复：随机抽样会让 40 个季度里出现近 1/4 重题。
test('一个职级内先把 50 道题轮完才开始重复', () => {
  const state = normalizeState(Object.assign(newState(), { rankIndex: 4 }));
  state.investigationCheckedYear = state.year;
  const pool = rankPoolFor(4);
  const seen = [];
  for (let i = 0; i < pool.length; i += 1) {
    seen.push(startQuarter(state, Math.random).title);
  }
  assert.strictEqual(new Set(seen).size, pool.length, `${pool.length} 个季度里出现了重题`);
  assert.strictEqual(state.rankEventTitles.length, pool.length - 1);
  assert.strictEqual(state.rankEventRank, 4);
});

test('换了职级会重新轮一遍新职级的题库', () => {
  const state = normalizeState(Object.assign(newState(), { rankIndex: 2 }));
  state.investigationCheckedYear = state.year;
  startQuarter(state, Math.random);
  assert.strictEqual(state.rankEventRank, 2);
  state.rankIndex = 8;
  const titles = new Set(rankPoolFor(8).map(item => item.title));
  for (let i = 0; i < 20; i += 1) {
    assert.ok(titles.has(startQuarter(state, Math.random).title));
  }
  assert.strictEqual(state.rankEventRank, 8);
});

test('监督核查触发的季度事项不会被题库覆盖', () => {
  const state = normalizeState(Object.assign(newState(), { rankIndex: 9 }));
  // rng 第一次返回 0 命中核查概率，之后返回 0.99 留给题库
  const event = startQuarter(state, (() => {
    let n = 0;
    return () => (n++ === 0 ? 0 : 0.99);
  })());
  assert.strictEqual(event.title, require('../game/data-full').INVESTIGATION_EVENT.title);
  assert.strictEqual(state.rankEventTitles.length, 0, '核查季度不应该动 rankEventTitles');
});

// 约定：新增持久化字段必须同步进 normalizeState 的白名单重建，
// 否则页面每次 buildPatch 都会把它静默丢掉。
test('rankEventTitles 经过 JSON 往返后仍然保留', () => {
  const state = normalizeState(Object.assign(newState(), { rankIndex: 2 }));
  state.investigationCheckedYear = state.year;
  startQuarter(state, () => 0.1);
  const roundTrip = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepStrictEqual(roundTrip.rankEventTitles, state.rankEventTitles);
  assert.ok(roundTrip.rankEventTitles.length > 0);
});

test('JSON 往返后仍能继续按职级抽题', () => {
  const state = normalizeState(Object.assign(newState(), { rankIndex: 7 }));
  state.investigationCheckedYear = state.year;
  for (let i = 0; i < 5; i += 1) startQuarter(state, () => i / 5);
  const restored = normalizeState(JSON.parse(JSON.stringify(state)));
  restored.investigationCheckedYear = restored.year;
  const pool = rankPoolFor(7);
  const titles = new Set(pool.map(item => item.title));
  for (let i = 0; i < 5; i += 1) {
    assert.ok(titles.has(startQuarter(restored, () => 0.5 + i / 20).title));
  }
});
