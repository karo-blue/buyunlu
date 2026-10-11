const core = require('../../game/core');

function excellentStories() {
  const result = {};
  const paths = {
    school: ['survey', 'protect', 'check', 'visit'],
    backlog: ['triage', 'coordinate', 'callback', 'review'],
    mentor: ['coach', 'lead', 'credit', 'listen'],
  };
  Object.entries(paths).forEach(([id, choices], index) => {
    result[id] = choices.map((choiceId, step) => ({ choiceId, year: 2026 + index * 5 + step + (step === 3 && id !== 'backlog' ? 1 : 0) }));
  });
  return result;
}

function candidate(overrides = {}) {
  return Object.assign(core.newState(), {
    year: 2067, age: 63, rankIndex: 11, rankYears: 3, quarter: 1,
    currentPosition: '国家级重要领导岗位', honorTitle: '人民公仆', honorYear: 2066,
    integrity: 100, reputation: 100, health: 80, review: 100, achievements: 140,
    storyProgress: excellentStories(),
    honorHistory: Array.from({ length: 5 }, (_, i) => ({ year: 2062 + i, review: 100, faults: 0 })),
    leaderTrial: { year: 2066, choices: [
      { id: 'essentials', quarter: 1, success: true }, { id: 'bridge', quarter: 2, success: true }, { id: 'verify', quarter: 3, success: true },
    ] },
  }, overrides);
}

module.exports = { candidate, excellentStories };
