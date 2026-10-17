// node tools/simulate-leader.js --runs=10000 --ads=0,3,10,33 --output=reports/leader-simulation.json
// 实际 core 完整人生；不读档、不重掷、不修改角色属性。广告假设每次都成功发奖。
const fs = require('node:fs');
const path = require('node:path');
const core = require('../game/core');
const stories = require('../game/story-chains');

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = Math.imul(value ^ value >>> 15, value | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function effectScore(state, effect = {}) {
  return ['network', 'seniority', 'reputation', 'integrity', 'health'].reduce((score, key) => {
    const gain = Math.max(0, Math.min(100, state[key] + (effect[key] || 0))) - state[key];
    return score + gain * (key === 'integrity' ? 2 : 1);
  }, 0) + (effect.achievements || 0) * 5 - (effect.faults || 0) * 50;
}

function mainChoice(state, event, strategy) {
  if (event.leaderTrialStep !== undefined) {
    const first = state.leaderTrial && state.leaderTrial.choices[0];
    const id = ['essentials', first && first.id === 'reserve' ? 'flex' : 'bridge', 'verify'][event.leaderTrialStep];
    return event.options.findIndex(option => option.id === id);
  }
  return event.options.map((option, index) => ({ index, score:
    (strategy === 'expert' && event.storyId ? (option.quality || 0) * 1000 : 0)
    + (option.performance || 0) * 100 + effectScore(state, option.effect),
  })).sort((a, b) => b.score - a.score)[0].index;
}

function burstChoice(state, event) {
  const options = event.options.map((option, index) => ({ option, index }));
  const clean = options.filter(({ option }) => !(option.risk > 0) && !option.bond && !option.nextEvent
    && !(option.effect && option.effect.wealth > 0));
  if (!clean.length) throw new Error(`无可用清正选项：${event.title}`);
  return clean.sort((a, b) => effectScore(state, b.option.effect) - effectScore(state, a.option.effect))[0].index;
}

function snapshot(s) {
  return { year: s.year, age: s.age, rankIndex: s.rankIndex, rankYears: s.rankYears,
    achievements: s.achievements, integrity: s.integrity, reputation: s.reputation, health: s.health,
    review: s.review, faults: s.faults, illicitIncome: s.illicitIncome, honorYear: s.honorYear, leaderYear: s.leaderYear };
}

function play({ seed = 1, ads = 0, strategy = 'expert', trace = false } = {}) {
  const rng = random(seed);
  let state = core.newState();
  const start = snapshot(state);
  const milestones = [];
  const choices = [];
  let quarters = 0;
  let adRewards = 0;
  while (!state.ended && quarters < 200) {
    if (state.currentPosition === '待选择具体岗位') {
      const position = core.POSITION_OPTIONS[state.rankIndex].find(item => core.positionAvailable(state, item));
      if (!position) throw new Error('无可用岗位');
      core.choosePosition(state, position.name);
    }
    // 对应页面每自然年一次免费锻炼、一次医院服务；不购房车，不恋爱结婚。
    if (state.health <= 97) core.restoreHealth(state, 'exercise', 0, 3);
    if (state.health < 82) core.restoreHealth(state, 'hospital', 12000, 18);
    // 整局只领取指定次数，后续年度和职级继续使用同一份生涯加成。
    if (state.rankIndex < 11 && state.promotionAdWatchCount === 0 && ads > 0) {
      state.promotionAdUsedYear = state.year;
      state.promotionAdWatchCount = ads;
      state.promotionAdBonus = ads * 0.03;
      adRewards += ads;
    }
    const event = core.startQuarter(state, rng);
    const index = mainChoice(state, event, strategy);
    const chosen = { year: state.year, quarter: state.quarter, title: event.title, choice: event.options[index].text };
    if (!core.resolveEvent(state, event, index, rng)) throw new Error('主事件未结算');
    // 顺序对齐页面：主事件 -> 季度/年度结算 -> 岗位/结局 -> 突发。
    const annual = core.finishQuarter(state, rng);
    quarters += 1;
    if (trace) choices.push(chosen);
    if (annual.promoted || annual.honor || annual.leaderHonor) milestones.push(snapshot(state));
    if (annual.promoted && state.currentPosition === '待选择具体岗位') {
      const position = core.POSITION_OPTIONS[state.rankIndex].find(item => core.positionAvailable(state, item));
      if (position) core.choosePosition(state, position.name);
    }
    if (!state.ended) {
      const picked = core.pickBurst(state, rng);
      if (picked) {
        if (picked.kind === 'interrogation') {
          const i = picked.event.options.findIndex(option => option.stance === 'confess');
          core.resolveInterrogation(state, picked.event, i < 0 ? 0 : i);
        } else {
          const i = burstChoice(state, picked.event);
          core.resolveBurst(state, picked.event, i, rng, picked.review);
          if (trace) choices.push({ year: state.year, title: picked.event.title, choice: picked.event.options[i].text });
        }
      }
    }
    // 页面 buildPatch 会规范化；每季执行，验证持久化不会丢失成就进度。
    state = core.normalizeState(state);
  }
  if (!state.ended) throw new Error('超过完整人生步数上限');
  return { seed, ads, strategy, start, state, quarters, adRewards, milestones, choices };
}

function wilson(successes, n) {
  const z2 = 1.96 ** 2;
  const p = successes / n;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = 1.96 * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [successes === 0 ? 0 : center - half, successes === n ? 1 : center + half];
}

function batch(runs, ads, strategy = 'expert', firstSeed = 1) {
  const result = { runs, ads, strategy, firstSeed, lastSeed: firstSeed + runs - 1, leader: 0, publicServant: 0, topRank: 0,
    excellentStories: 0, adRewards: 0, firstSuccess: null, missed: {}, ranks: {} };
  for (let i = 0; i < runs; i++) {
    const run = play({ seed: firstSeed + i, ads, strategy });
    const s = run.state;
    result.adRewards += run.adRewards;
    result.ranks[s.rankIndex] = (result.ranks[s.rankIndex] || 0) + 1;
    if (s.rankIndex === 11) result.topRank++;
    if (s.honorTitle) result.publicServant++;
    if (stories.outcomes(s).every(item => item.completed && item.quality >= 5)) result.excellentStories++;
    if (s.leaderYear) {
      result.leader++;
      if (!result.firstSuccess) {
        const witness = play({ seed: run.seed, ads, strategy, trace: true });
        result.firstSuccess = { seed: run.seed, milestones: run.milestones, certificate: s.leaderCertificate,
          final: snapshot(s), choices: witness.choices };
      }
    } else {
      Object.entries(core.leaderStatus(s).checks).filter(([, ok]) => !ok).forEach(([key]) => { result.missed[key] = (result.missed[key] || 0) + 1; });
    }
  }
  result.probability = result.leader / runs;
  result.confidence95 = wilson(result.leader, runs);
  return result;
}

if (require.main === module) {
  const arg = (name, fallback) => (process.argv.find(item => item.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=').slice(1).join('=');
  const runs = Number(arg('runs', 1000));
  const counts = arg('ads', '0,3,10,33').split(',').map(Number);
  const strategy = arg('strategy', 'expert');
  if (!Number.isInteger(runs) || runs < 1 || counts.some(n => !Number.isInteger(n) || n < 0) || !['expert', 'performance'].includes(strategy)) throw new Error('无效参数');
  const results = counts.map(ads => {
    const result = batch(runs, ads, strategy);
    console.log(JSON.stringify({ ...result, firstSuccess: result.firstSuccess && { seed: result.firstSuccess.seed, final: result.firstSuccess.final } }));
    return result;
  });
  const output = arg('output', '');
  if (output) {
    const target = path.resolve(output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ assumptions: '独身、清正、无读档无请托；熟悉选项与跨年任务；整局领取指定次数的生涯晋升加成；每年健康管理；不模拟广告库存/支付/真人失误', results }, null, 2));
  }
}

module.exports = { random, play, wilson, batch };
