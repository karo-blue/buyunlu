// 批量模拟整局游戏，用来验证数值机制（落马率、晋升天花板、退休金）是否站得住。
// 不参与小程序打包（tools/ 已在 packOptions.ignore 里）。
//
// 用法：
//   node tools/simulate-playthroughs.js                 稳健玩法 1000 局
//   node tools/simulate-playthroughs.js 500            指定局数
//   node tools/simulate-playthroughs.js 500 --ad=0      不看广告（无晋升加成）
//   node tools/simulate-playthroughs.js 500 --strategy=greedy   一路收钱的对照
//
// 两种策略：
//   steady —— 好好干活、不收钱、生病就医、有余钱买房车、每年看满广告争取晋升（正常玩法）
//   greedy —— 突发里永远挑进账最多的那个（对照用）
const core = require('../game/core');
const network = require('../game/network');
const { HOUSES, CARS } = require('../game/data');

// 落马结局 = 审讯的三种处理结论 + 作风问题/违纪处分
const FALL_ENDINGS = new Set(Object.keys(network.FALL_STANCES || {}).map(key => network.FALL_STANCES[key].ending));
['作风问题处理', '违纪处分'].forEach(name => FALL_ENDINGS.add(name));

const arg = (name, fallback) => {
  const hit = process.argv.find(item => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const RUNS = Number(process.argv[2]) || 1000;
const AD_COUNT = Number(arg('ad', 3));
const STRATEGY = arg('strategy', 'steady');
// --nonetwork=1：连"结下关系"的选项也不碰，用来量化关系网这一项对落马率的贡献
const NO_NETWORK = arg('nonetwork', '0') === '1';

const scoreEffect = (effect = {}) => (effect.reputation || 0) * 1
  + (effect.seniority || 0) * 0.8
  + (effect.integrity || 0) * 0.9
  + (effect.network || 0) * 0.4
  + (effect.health || 0) * 1.2
  + (effect.achievements || 0) * 2
  - (effect.faults || 0) * 2
  + Math.min(0, (effect.wealth || 0) / 10000);

function pickMain(option) {
  return (Number(option.performance) || 0) * 10 + scoreEffect(option.effect);
}

// 稳健玩法：突发事件只走"干净"的选项（不留痕迹、不收钱），其余按综合收益挑最好的
// pragmatic（务实型）放宽一档：小额人情往来照收、替人打个招呼也行，但不碰 3 万元以上的钱
function pickSteadyBurst(options) {
  const riskLimit = STRATEGY === 'pragmatic' ? 1 : 0;
  const wealthLimit = STRATEGY === 'pragmatic' ? 30000 : 0;
  let clean = options
    .map((option, index) => ({ option, index }))
    .filter(item => Number(item.option.risk) <= riskLimit && !(Number(item.option.effect && item.option.effect.wealth) > wealthLimit));
  if (NO_NETWORK) {
    const withoutBond = clean.filter(item => !item.option.bond);
    if (withoutBond.length) clean = withoutBond;
  }
  const pool = clean.length ? clean : options.map((option, index) => ({ option, index }));
  // 务实型在允许的范围内挑收益最高的（会吃下小额人情与 1 点痕迹），稳健型永远先挑最干净的
  if (STRATEGY === 'pragmatic') {
    return pool.slice().sort((a, b) => scoreEffect(b.option.effect) - scoreEffect(a.option.effect))[0].index;
  }
  return pool.slice().sort((a, b) => (Number(a.option.risk) || 0) - (Number(b.option.risk) || 0)
    || scoreEffect(b.option.effect) - scoreEffect(a.option.effect))[0].index;
}

function pickGreedyBurst(options) {
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => (Number(b.option.effect && b.option.effect.wealth) || 0) - (Number(a.option.effect && a.option.effect.wealth) || 0))[0].index;
}

// calculated（精算式）：风险压在闸门以下时照收（挑进账最多的），
// 风险一上来就立刻收手、只挑干净选项，全程不结网（bond）、能切割就切割（sever）。
// 这一档专门用来回答"有没有一种贪污但安稳退休的活法"。
const RISK_CEILING = Number(arg('ceiling', 18));

function pickCalculatedBurst(state, options) {
  const mapped = options.map((option, index) => ({ option, index }));
  const clean = mapped.filter(item => !item.option.bond && !(Number(item.option.effect && item.option.effect.wealth) > 0));
  if (network.fallRiskOf(state).risk >= RISK_CEILING) {
    const sever = clean.filter(item => item.option.sever);
    const pool = sever.length ? sever : (clean.length ? clean : mapped);
    return pool.slice().sort((a, b) => (Number(a.option.risk) || 0) - (Number(b.option.risk) || 0)
      || scoreEffect(b.option.effect) - scoreEffect(a.option.effect))[0].index;
  }
  const take = mapped.filter(item => !item.option.bond && Number(item.option.effect && item.option.effect.wealth) > 0);
  const pool = take.length ? take : clean.length ? clean : mapped;
  return pool.slice().sort((a, b) => (Number(b.option.effect && b.option.effect.wealth) || 0) - (Number(a.option.effect && a.option.effect.wealth) || 0))[0].index;
}

function burstIndexFor(state, options) {
  if (STRATEGY === 'greedy') return pickGreedyBurst(options);
  if (STRATEGY === 'calculated') return pickCalculatedBurst(state, options);
  return pickSteadyBurst(options);
}

function playOne() {
  const state = core.newState();
  const stats = { investigations: 0, investigationFalls: 0, reviews: 0, bursts: 0, promotions: 0 };
  let peakRisk = 0;
  let guard = 0;
  while (!state.ended && guard++ < 500) {
    if (guard % 4 === 1 && AD_COUNT > 0) {
      state.promotionAdUsedYear = state.year;
      state.promotionAdWatchCount = AD_COUNT;
    }
    // 履新：待选择岗位时选一个（正常玩家不会一直挂着不就任）
    if (state.currentPosition === '待选择具体岗位') {
      const list = core.POSITION_OPTIONS[state.rankIndex] || [];
      if (list.length) core.choosePosition(state, list[0].name);
    }
    // 健康管理：低于 50 就医，否则每年锻炼一次
    if (state.health < 50 && state.money > 20000) core.restoreHealth(state, 'hospital', 12000, 18);
    else if (state.health < 75) core.restoreHealth(state, 'exercise', 0, 3);
    // 有余钱就置产（分期），这是正常生活的一部分，也影响退休时的净资产
    if (!state.hasHouse && state.money > 200000) {
      const house = HOUSES[Math.floor(HOUSES.length / 2)];
      core.buyAsset(state, 'house', house.name, house.price, house.years, false);
    }
    if (!state.hasCar && state.money > 120000) {
      const car = CARS[Math.floor(CARS.length / 2)];
      core.buyAsset(state, 'car', car.name, car.price, car.years, false);
    }

    const event = core.startQuarter(state);
    if (event) {
      if (event.isInvestigation) stats.investigations += 1;
      const before = !!state.pendingInterrogation;
      const index = event.options
        .map((option, i) => ({ option, i }))
        .sort((a, b) => pickMain(b.option) - pickMain(a.option))[0].i;
      core.resolveEvent(state, event, index);
      if (!before && state.pendingInterrogation) stats.investigationFalls += 1;
    }

    const picked = core.pickBurst(state);
    if (picked) {
      if (picked.kind === 'interrogation') {
        const options = picked.event.options;
        const index = options.findIndex(option => option.stance === 'confess');
        core.resolveInterrogation(state, picked.event, index >= 0 ? index : 0);
      } else {
        if (picked.review) stats.reviews += 1;
        else stats.bursts += 1;
        const index = burstIndexFor(state, picked.event.options);
        core.resolveBurst(state, picked.event, index, Math.random, picked.review);
      }
    }
    if (state.ended) break;

    const beforeRank = state.rankIndex;
    core.finishQuarter(state);
    if (state.rankIndex > beforeRank) stats.promotions += 1;
    // 记录生涯风险峰值：漏网者是"一直没被抽中"还是"曾经九死一生"全看这个数
    peakRisk = Math.max(peakRisk, network.fallRiskOf(state).risk);
    if (state.ended) break;
    // 落马判定挂起后必须走完审讯，不然这局没有结局
    if (state.pendingInterrogation) {
      const interrogation = core.pickBurst(state);
      if (interrogation && interrogation.kind === 'interrogation') {
        const options = interrogation.event.options;
        const index = options.findIndex(option => option.stance === 'confess');
        core.resolveInterrogation(state, interrogation.event, index >= 0 ? index : 0);
      }
    }
  }
  return {
    state,
    stats,
    risk: network.fallRiskOf(state).risk,
    peakRisk,
  };
}

const endings = new Map();
const ranks = new Map();
let ended = 0;
let fell = 0;
let age = 0;
let health = 0;
let integrity = 0;
let wealth = 0;
let risk = 0;
const counters = { investigations: 0, investigationFalls: 0, reviews: 0, bursts: 0, promotions: 0 };
let fellAge = 0;
const escapees = [];

for (let i = 0; i < RUNS; i += 1) {
  const run = playOne();
  const { state, stats } = run;
  endings.set(state.ending || '未结束（到达模拟上限）', (endings.get(state.ending || '未结束（到达模拟上限）') || 0) + 1);
  ranks.set(state.rankIndex, (ranks.get(state.rankIndex) || 0) + 1);
  ended += state.ended ? 1 : 0;
  const isFall = FALL_ENDINGS.has(String(state.ending || ''));
  if (isFall) { fell += 1; fellAge += state.age; }
  else if (state.ended) {
    // 漏网之鱼：走到结局却没被带走。这一档的画像直接回答"一直贪到底有没有人能安稳退休"
    escapees.push({
      rankIndex: state.rankIndex,
      integrity: state.integrity,
      risk: run.risk,
      wealth: core.netWealth(state),
      evidence: Array.isArray(state.evidence) ? state.evidence.length : 0,
      fellows: Array.isArray(state.fellows) ? state.fellows.length : 0,
      investigations: stats.investigations,
      reviews: stats.reviews,
      age: state.age,
      peakRisk: run.peakRisk,
      ending: state.ending,
    });
  }
  age += state.age;
  health += state.health;
  integrity += state.integrity;
  wealth += core.netWealth(state);
  risk += run.risk;
  Object.keys(counters).forEach(key => { counters[key] += stats[key]; });
}

const pct = value => `${((value / RUNS) * 100).toFixed(1)}%`;
const avg = value => (value / RUNS).toFixed(1);
const wan = value => `${(value / 10000).toFixed(1)}万`;

const STRATEGY_LABELS = { steady: '稳健晋升（不收钱、不留痕）', pragmatic: '务实型（小额人情照收，不碰 3 万以上）', calculated: `精算式（风险<${RISK_CEILING} 就收，过线收手，不结网）`, greedy: '一路收钱（对照）' };
console.log(`\n策略：${STRATEGY_LABELS[STRATEGY] || STRATEGY}${NO_NETWORK ? ' · 不结网' : ''}　广告加成：${AD_COUNT} 次（+${AD_COUNT * 3}%）　局数：${RUNS}`);
console.log('── 终局分布 ──');
[...endings.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
  console.log(`  ${String(name).padEnd(12, '　')} ${String(count).padStart(5)} 局  ${pct(count)}`);
});
console.log('── 终局职级分布 ──');
[...ranks.entries()].sort((a, b) => a[0] - b[0]).forEach(([rankIndex, count]) => {
  const name = core.RANKS[rankIndex - 1] ? core.RANKS[rankIndex - 1].name : `职级${rankIndex}`;
  console.log(`  ${String(name).padEnd(12, '　')} ${String(count).padStart(5)} 局  ${pct(count)}`);
});
console.log('── 平均情况 ──');
console.log(`  正常走完结局   ${ended}/${RUNS}`);
console.log(`  落马（含作风/违纪） ${pct(fell)}${fell ? `　平均落马年龄 ${(fellAge / fell).toFixed(1)} 岁` : ''}`);
console.log(`  终局年龄       ${avg(age)} 岁`);
console.log(`  终局职级       ${avg([...ranks.entries()].reduce((sum, [rankIndex, count]) => sum + rankIndex * count, 0))} 级`);
console.log(`  晋升次数       ${avg(counters.promotions)} 次`);
console.log(`  终局廉政/健康  ${avg(integrity)} / ${avg(health)}`);
console.log(`  终局落马风险   ${avg(risk)} / 100`);
console.log(`  人均退休净资产 ${wan(wealth / RUNS)}（现金 + 公积金 + 职业年金 + 房车净值 - 未结清贷款）`);
console.log(`  监督核查       ${avg(counters.investigations)} 次，其中查出实问题 ${avg(counters.investigationFalls)} 次`);
console.log(`  专项倒查       ${avg(counters.reviews)} 次　随机突发 ${avg(counters.bursts)} 次`);

if (escapees.length) {
  const mean = pick => (escapees.reduce((sum, item) => sum + item[pick], 0) / escapees.length);
  const byEnding = new Map();
  escapees.forEach(item => byEnding.set(item.ending, (byEnding.get(item.ending) || 0) + 1));
  console.log('── 漏网者画像（一路贪到底却没被带走）──');
  console.log(`  人数           ${escapees.length} 局 / ${RUNS}（${pct(escapees.length)}）　结局：${[...byEnding.entries()].map(([name, count]) => `${name} ${count}`).join('、')}`);
  console.log(`  平均终局职级   ${mean('rankIndex').toFixed(1)} 级　平均终局年龄 ${mean('age').toFixed(1)} 岁`);
  console.log(`  平均廉政/风险  ${mean('integrity').toFixed(1)} / ${mean('risk').toFixed(1)}（风险仍是满档量级，只是没被抽中）`);
  console.log(`  平均净资产     ${wan(mean('wealth'))}　平均事证 ${mean('evidence').toFixed(1)} 条　同船领导 ${mean('fellows').toFixed(1)} 人`);
  console.log(`  平均被核查     ${mean('investigations').toFixed(1)} 次　专项倒查 ${mean('reviews').toFixed(1)} 次`);
  const peaks = escapees.map(item => item.peakRisk).sort((a, b) => a - b);
  console.log(`  生涯风险峰值   ${mean('peakRisk').toFixed(1)} / 100（区间 ${peaks[0]}~${peaks[peaks.length - 1]}，中位数 ${peaks[Math.floor(peaks.length / 2)]}）`);
}
