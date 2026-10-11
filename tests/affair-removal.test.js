'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../game/core');

test('retired spouse events never enter the burst pool', () => {
  const single = core.burstPoolFor({ rankIndex: 11 });
  const partnered = core.burstPoolFor({ rankIndex: 11, relationship: '婚姻', partner: '沈禾' });
  assert.deepEqual(partnered, single);
  assert.equal(core.BURST_EVENTS.some(event => event.requiresPartner || event.tag === '桃色风波'), false);
});

test('an old pending follow-up does not appear after upgrading', () => {
  const state = core.normalizeState({ rankIndex: 1, pendingAffairHushFee: 500000 });
  assert.equal(state.pendingAffairHushFee || 0, 0);
  assert.equal(core.pickBurst(state, () => 1), null);
});
