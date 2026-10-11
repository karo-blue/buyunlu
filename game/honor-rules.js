// 授予时保存资格快照；退休后的健康变化不会抹除已取得的荣誉。
// 这只是规则一致性校验，并非可抵御篡改客户端的服务端反作弊证明。
const stories = require('./story-chains');
const LEADER_TITLE = '领导者 · 人民公仆';
const LEADER_TRIAL_SUCCESS_CHANCE = 0.5;

function historyOf(raw, year) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-5).filter(item => item && Number.isInteger(item.year) && item.year > 0 && item.year < year
    && Number.isInteger(item.review) && item.review >= 0 && item.review <= 100
    && Number.isInteger(item.faults) && item.faults >= 0)
    .map(item => ({ year: item.year, review: item.review, faults: item.faults }));
}

const TRIAL_IDS = [['essentials', 'reserve', 'headline'], ['bridge', 'flex', 'rush'], ['verify', 'paper', 'defer']];
function trialOf(raw, year) {
  if (!raw || !Number.isInteger(raw.year) || raw.year < 1 || raw.year > year || !Array.isArray(raw.choices)) return null;
  const choices = [];
  for (const item of raw.choices.slice(0, 3)) {
    if (!item || !TRIAL_IDS[choices.length].includes(item.id) || !Number.isInteger(item.quarter)
      || item.quarter < 1 || item.quarter > 4 || (choices.length && item.quarter <= choices[choices.length - 1].quarter)) break;
    if (typeof item.success !== 'boolean') break;
    choices.push({ id: item.id, quarter: item.quarter, success: item.success });
  }
  return { year: raw.year, choices };
}

function trialFailed(trial) {
  const ids = trial.choices.map(item => item.id);
  return trial.choices.some(item => item.success !== true)
    || (ids.length > 0 && !['essentials', 'reserve'].includes(ids[0]))
    || (ids.length > 1 && ids[1] !== (ids[0] === 'essentials' ? 'bridge' : 'flex'))
    || (ids.length > 2 && ids[2] !== 'verify');
}

function status(state) {
  const s = state || {};
  const history = historyOf(s.honorHistory, s.year);
  const trial = trialOf(s.leaderTrial, s.year);
  const checks = {
    tenure: s.rankIndex === 11 && s.rankYears >= 3,
    publicServant: s.honorTitle === '人民公仆' && s.honorYear > 0 && s.year - s.honorYear >= 1,
    clean: s.illicitIncome === 0 && !s.fallDetail && !s.pendingInterrogation,
    noHelp: !s.faultHelpUsedYear,
    achievements: s.achievements >= 120,
    history: history.length === 5 && history.every((item, i) => item.year === s.year - 5 + i && item.review >= 95 && item.faults === 0),
    integrity: s.integrity === 100,
    reputation: s.reputation >= 98,
    health: s.health >= 60,
    stories: stories.outcomes(s).every(item => item.completed && item.quality >= 5),
    trial: !!trial && trial.choices.length === 3 && !trialFailed(trial) && trial.year < s.year,
  };
  return { checks, eligible: !s.ended && Object.values(checks).every(Boolean) };
}

function trialEvent(state) {
  if (!state || state.ended || state.pendingInterrogation || state.fallDetail || state.leaderYear) return null;
  let trial = trialOf(state.leaderTrial, state.year);
  if (trial && (trialFailed(trial) || trial.year < state.year || trial.choices.length === 3)) return null;
  if (!trial || trial.year !== state.year) {
    const checks = status(state).checks;
    const ready = state.rankIndex === 11 && state.rankYears >= 2 && state.honorTitle === '人民公仆'
      && Object.keys(checks).filter(key => !['tenure', 'publicServant', 'trial'].includes(key)).every(key => checks[key]);
    if (!ready || state.quarter > 2) return null;
    trial = { year: state.year, choices: [] };
  }
  const step = trial.choices.length;
  if (step >= 3 || (step && trial.choices[step - 1].quarter >= state.quarter)) return null;
  const reserve = step && trial.choices[0].id === 'reserve';
  const definitions = [
    {
      title: '先定轻重',
      scene: '多地公共服务同时需要支援，现有资源无法一次满足全部需求。必须保障急需，同时为下一季度的不确定情况留下可执行的安排。',
      options: [
        ['essentials', '优先保障基本服务，落实跨地区接续清单', true, '基本服务得到保障，下一阶段必须落实跨地区接续。'],
        ['reserve', '划出应急储备，按需求设置分期启用条件', true, '应急储备已留足，下一阶段必须按实际需求调配。'],
        ['headline', '资源集中到展示项目，其他事项以后再补', false, '紧迫需求没有获得保障，本年度考验未通过。'],
      ],
    },
    {
      title: '接续落实',
      scene: reserve ? '你上季度预留了应急储备。如今需求发生变化，需要按事先约定的条件及时启用。' : '你上季度优先保障了基本服务。如今地区间承接出现缺口，需要落实已经约定的接续安排。',
      options: [
        ['bridge', '依照接续清单，协调承接地区逐项补位', !reserve, !reserve ? '承接责任逐项落实，基本服务保持连续。' : '仅协调接续不能代替启用储备，需求仍未得到及时回应，考验未通过。'],
        ['flex', '按需求启用已预留储备，并公开调配依据', !!reserve, reserve ? '储备按条件启用，紧迫需求得到回应。' : '上一阶段没有安排这笔储备，调配方案无法落地，考验未通过。'],
        ['rush', '跳过约束直接下达统一完成指标', false, '进度要求脱离实际条件，本年度考验未通过。'],
      ],
    },
    {
      title: '实效验收',
      scene: '执行期结束，汇总材料已送到。能否把实际效果和后续责任核实清楚，是最后一关。',
      options: [
        ['verify', '抽查服务现场、核实群众反馈并落实后续责任', true, '三阶段考验全部通过，完整记录将用于下一次年度荣誉评定。'],
        ['paper', '按汇总报表直接宣布全部完成', false, '材料不能代替实效核验，本年度考验未通过。'],
        ['defer', '暂不验收，等下一任自行梳理', false, '接续责任没有落实，本年度考验未通过。'],
      ],
    },
  ];
  const definition = definitions[step];
  return {
    leaderTrialStep: step, leaderTrialYear: state.year,
    title: `统筹考验 · ${definition.title}（${step + 1}/3）`,
    scene: `${definition.scene}\n\n位置越高，越要把责任放在个人得失之前。真正的担当，不在一时表态，而在复杂局面中守住原则、照顾长远、把事情办稳办实。\n\n请以职责为先、以百姓为念，审慎作出选择。`,
    // 失败只终止荣誉考验，不额外制造一条正式工作过失。
    options: definition.options.map(([id, text, pass, result]) => ({ id, text, trialPass: pass, performance: pass ? 3 : 1, effect: {}, result })),
  };
}

function resolveTrial(state, event, option, rng = Math.random) {
  const current = trialEvent(state);
  if (!current || current.leaderTrialStep !== event.leaderTrialStep || current.leaderTrialYear !== event.leaderTrialYear) return null;
  const chosen = current.options.find(item => item.id === option.id);
  if (!chosen) return null;
  const old = trialOf(state.leaderTrial, state.year);
  const trial = old && old.year === state.year ? old : { year: state.year, choices: [] };
  const success = chosen.trialPass === true && rng() < LEADER_TRIAL_SUCCESS_CHANCE;
  trial.choices.push({ id: chosen.id, quarter: state.quarter, success });
  state.leaderTrial = trial;
  return Object.assign({}, chosen, {
    performance: success ? 3 : 1,
    result: success
      ? `${chosen.result}\n这一步经住了实践检验。越是向前，越要保持清醒、稳慎和担当。`
      : `${chosen.result}\n这一程留下了遗憾。荣誉有无并非终点，往后的每一步仍要守住初心、尽好职责。`,
  });
}

function certificateOf(raw) {
  if (!raw || raw.version !== 1) return null;
  const proof = { version: 1, honorTitle: '人民公仆' };
  const fields = ['year', 'honorYear', 'rankIndex', 'rankYears', 'integrity', 'reputation', 'health', 'achievements', 'illicitIncome', 'faultHelpUsedYear'];
  if (fields.some(key => !Number.isInteger(raw[key]) || raw[key] < 0 || raw[key] > 999999)) return null;
  fields.forEach(key => { proof[key] = raw[key]; });
  proof.honorHistory = historyOf(raw.honorHistory, proof.year);
  proof.storyProgress = stories.normalizeProgress(raw.storyProgress, proof.year);
  proof.leaderTrial = trialOf(raw.leaderTrial, proof.year);
  return status(proof).eligible ? proof : null;
}

function hasLeader(state) {
  if (!state || state.honorTitle !== '人民公仆' || state.illicitIncome > 0 || state.fallDetail
    || state.faultHelpUsedYear || !state.leaderYear) return false;
  const proof = certificateOf(state.leaderCertificate);
  return !!proof && proof.year === state.leaderYear && proof.honorYear === state.honorYear && state.leaderYear <= state.year;
}

function displayTitle(state) {
  if (hasLeader(state)) return LEADER_TITLE;
  return state && state.honorTitle === '人民公仆' ? '人民公仆' : '';
}

module.exports = { LEADER_TITLE, LEADER_TRIAL_SUCCESS_CHANCE, historyOf, trialOf, status, trialEvent, resolveTrial, certificateOf, hasLeader, displayTitle };
