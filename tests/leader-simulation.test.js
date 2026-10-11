const test = require('node:test');
const assert = require('node:assert/strict');
const { random, play, wilson } = require('../tools/simulate-leader');

test('完整人生模拟从真实新局出发，可按种子重放', () => {
  const a = play({ seed: 7, ads: 10 });
  const b = play({ seed: 7, ads: 10 });
  assert.deepEqual(a, b);
  assert.equal(a.start.age, 22);
  assert.equal(a.start.rankIndex, 1);
  assert.equal(a.start.achievements, 0);
  assert.equal(a.state.ended, true);
  assert.ok(a.quarters <= 172);
});

test('模拟随机源和置信区间边界有效', () => {
  const rng = random(12);
  for (let i = 0; i < 1000; i++) { const n = rng(); assert.ok(n >= 0 && n < 1); }
  assert.equal(wilson(0, 1000)[0], 0);
  assert.ok(wilson(0, 1000)[1] < 0.004);
  assert.ok(wilson(1000, 1000)[0] > 0.996);
});
