(function() {
'use strict';
const modules = {"game/core": function(module, exports, require) {
const { RANKS, COMPENSATION_BY_RANK, EVENTS, POSITION_OPTIONS: SOURCE_POSITION_OPTIONS, POSITION_EVENTS, ADDITIONAL_POSITION_EVENTS, INVESTIGATION_EVENT } = require('./data-full');
const { EXTRA_COMMON_EVENTS, EXTRA_POSITION_EVENTS } = require('./events-extra');
const { EXTRA_POSITION_OPTIONS } = require('./positions-extra');
const { BURST_EVENTS: SOURCE_BURST_EVENTS, REVIEW_EVENT } = require('./events-burst');
const { RICH_BURST_EVENTS } = require('./events-rich');
const { RANK_EVENT_POOL } = require('./events-by-rank');
const network = require('./network');
const stories = require('./story-chains');
const honors = require('./honor-rules');

// data-full.js 是由 tools/convert-source-data.js 生成的，重跑提取会整份覆盖，
// 所以手写扩展内容放在 events-extra.js / events-burst.js，这里做合并。
// 合并后的事件池：通用池 = 原版 16 条 + 手写扩展（按 minRank 逐级解锁）。
const COMMON_EVENT_POOL = EVENTS.concat(EXTRA_COMMON_EVENTS);

// data-full.js 保持原始源数据可重提取；运行时将手写扩展岗位合并到独立副本，
// 页面和晋升逻辑看到的是完整岗位池，源数据测试仍能准确反映原版规模。
const POSITION_OPTIONS = Object.keys(SOURCE_POSITION_OPTIONS).reduce((result, rank) => {
  result[rank] = (SOURCE_POSITION_OPTIONS[rank] || []).concat(EXTRA_POSITION_OPTIONS[rank] || []);
  return result;
}, {});

// 突发事件的"风险痕迹"阈值：累到 6 以上，下一次突发必定是专项倒查。
const RISK_TRAIL_THRESHOLD = 6;
const BURST_BASE_CHANCE = 0.3;

// 意外收入换风险：**3 万元起征**，超过的部分每 1 万元 ≈ 1 点往来痕迹，封顶 10。
// 3 万以内属于人情往来，不进折算，只按事件里手写的小额痕迹（1~2 点）记账。
// 结下关系网的再 +1 —— 有人情往来就多一个能开口的人，痕迹更难抹平。
// 落马风险由此与"拿了多少钱"严格成正比，不再是事件里随手写的 2~5。
const BRIBE_RISK_PER_WAN = 1;
const BRIBE_RISK_FLOOR = 30000;
const BRIBE_RISK_CAP = 10;
const BOND_RISK_BONUS = 1;

// 不当收入账本最多留多少笔。落马页要逐笔列出，留太多既撑爆存档也说不完；
// 12 笔已经够把"从第一笔两万到最后一笔两百万"的轨迹讲清楚。
const ILLICIT_LEDGER_MAX = 12;

// 「人民公仆」是副国级之上的荣誉称呼，不是第12个晋升职级。
// 它不参与晋升、待遇、岗位池或题库，只在满足条件后的年度结算中自动形成，
// 并在落马或处分结局时撤销。
const PUBLIC_SERVANT_TITLE = '人民公仆';
const PUBLIC_SERVANT_MIN_RANK_YEARS = 2;
// 不当收入按整数元记录，因此“低于1元”就是分文未取。
const PUBLIC_SERVANT_MAX_ILLICIT_INCOME = 1;
const PUBLIC_SERVANT_MIN_INTEGRITY = 20;

function publicServantIncomeText() {
  if (PUBLIC_SERVANT_MAX_ILLICIT_INCOME <= 1) return '分文未取';
  const wan = PUBLIC_SERVANT_MAX_ILLICIT_INCOME / 10000;
  return `低于${Number.isInteger(wan) ? wan : Number(wan.toFixed(1))}万元`;
}

// 监督核查里的"落马骰"：核查抽中时，按当前落马风险 × 30% 的概率当场查出问题
// （风险 50 → 15%）。中招即进入落马程序，三个选项各有对应的言辞，
// 下一件事就是终局审讯——态度只影响处理档次，不影响"是否落马"。
const INVESTIGATION_FALL_CHANCE = 0.3;
const INVESTIGATION_FALL_RESULTS = [
  '材料核到第三层时，一笔多年前的资金往来对上了另一份笔录。谈话没有结束，你的名字进了立案审查的名单。',
  '你补交的材料让核查组多留了三天。第四天，通知上的说法从"说明情况"变成了"配合调查"，约谈的地点换了一层楼。',
  '你的拖延被原样记录在案，也给了核查组继续深挖的理由。第五天，进来的人换了，问题从"工作流程"变成了"你本人"。',
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const copy = value => JSON.parse(JSON.stringify(value));
const BURST_EVENTS = SOURCE_BURST_EVENTS.concat(RICH_BURST_EVENTS);
const MAX_BURST_HISTORY = 256;
const RANDOM_EVENT_LIMIT = 24;
const EVIDENCE_WARNING_CHANCE = 0.30;
const SMALL_CONFESSION_LIMIT = 50000;
const DENIAL_NEXT_BRIBE_DISCOVERY_CHANCE = 0.85;
const DENIAL_FALL_MULTIPLIER = 3;
const ESCAPE_METHODS = [
  { id: 'plane', name: '飞机', chance: 0.28, offset: 0.11 },
  { id: 'ship', name: '轮船', chance: 0.32, offset: 0.61 },
  { id: 'train', name: '火车', chance: 0.30, offset: 0.24 },
];

function burstHistoryOf(state) {
  const history = Array.isArray(state && state.burstHistory) ? state.burstHistory : [];
  const recent = Array.isArray(state && state.burstTitles) ? state.burstTitles : [];
  return Array.from(new Set(history.concat(recent)));
}

function rememberBurst(state, title) {
  if (!state || !title) return;
  const history = burstHistoryOf(state).filter(item => item !== title);
  const recent = Array.isArray(state.burstTitles) ? state.burstTitles.filter(item => item !== title) : [];
  state.lastBurstTitle = title;
  state.burstHistory = [title].concat(history).slice(0, MAX_BURST_HISTORY);
  state.burstTitles = [title].concat(recent).slice(0, 6);
}

const PARTNER_PROFILES = [
  {
    id: 'socialite', name: '许小姐', role: '青年活动策划',
    description: '年轻漂亮、社交活跃，需要投入较多陪伴时间。',
    timeLabel: '高', annualPerformanceCost: 1, annualHealthCost: 3, promotionBonus: 0,
    // annualExpense：这位伴侣每年给家庭开销带来的增减（元）。社交活跃 = 花销大。
    entryEffect: { reputation: 1 }, annualExpense: 3000,
  },
  {
    id: 'executive_family', name: '顾小姐', role: '高管之女',
    description: '熟悉人情往来与组织节奏，能提供仕途助力，但应酬和陪伴压力较大。',
    timeLabel: '高', annualPerformanceCost: 1, annualHealthCost: 2, promotionBonus: .04,
    entryEffect: { network: 2 }, annualExpense: 2500,
  },
  {
    id: 'teacher', name: '沈禾', role: '中学教师',
    description: '朴素踏实、生活安稳，对仕途几乎没有影响。',
    timeLabel: '低', annualPerformanceCost: 0, annualHealthCost: 0, promotionBonus: 0,
    entryEffect: { reputation: 1 }, annualExpense: -600,
  },
  {
    id: 'doctor', name: '林静', role: '社区医生',
    description: '朴素细致、重视规律作息，能让家庭生活更健康。',
    timeLabel: '低', annualPerformanceCost: 0, annualHealthCost: -1, promotionBonus: 0,
    entryEffect: { health: 2 }, annualExpense: -300,
  },
];

function partnerProfile(state) {
  if (!state || state.relationship === '单身') return null;
  const aliases = { 顾宁: 'doctor', 程悦: 'teacher' };
  const id = state.partnerProfileId || aliases[state.partner];
  return PARTNER_PROFILES.find(item => item.id === id || item.name === state.partner) || null;
}

function partnerPromotionBonus(state) {
  const profile = partnerProfile(state);
  return profile ? profile.promotionBonus : 0;
}

function applyPartnerAnnualEffect(state) {
  const profile = partnerProfile(state);
  if (!profile) return { healthCost: 0, performanceCost: 0, text: '' };
  const performanceCost = Math.max(0, Number(profile.annualPerformanceCost) || 0);
  if (performanceCost) state.annualPerformance = clamp(state.annualPerformance - performanceCost, -10, 12);
  const healthCost = Number(profile.annualHealthCost) || 0;
  const effects = [];
  if (performanceCost) effects.push(`陪伴投入使年度绩效-${performanceCost}`);
  if (healthCost > 0) effects.push(`健康额外-${healthCost}`);
  if (healthCost < 0) effects.push('规律生活抵消1点年度健康损耗');
  if (profile.promotionBonus > 0) effects.push(`晋升机会+${Math.round(profile.promotionBonus * 100)}%`);
  return { profile, healthCost, performanceCost, text: effects.join('、') };
}

// 关系网里的人是存档数据，反序列化后不可信：按白名单字段重建，其余一律丢掉。
function sanitizePeople(list, prefix) {
  return (Array.isArray(list) ? list : []).slice(0, 8).map((item, index) => ({
    id: String((item && item.id) || `${prefix}${index}`),
    name: String((item && item.name) || '某').slice(0, 6),
    title: String((item && item.title) || '职务未明').slice(0, 24),
    year: Math.max(1, Math.floor(Number(item && item.year) || 1)),
    weight: clamp(Math.floor(Number(item && item.weight) || 1), 1, 3),
    reason: String((item && item.reason) || '').slice(0, 40),
    fallen: item && item.fallen === true,
    fallenYear: Math.max(0, Math.floor(Number(item && item.fallenYear) || 0)),
  }));
}

function newState() {
  return {
    name: '', age: 22, year: 2026, quarter: 1, rankIndex: 1, rankYears: 0,
    currentPosition: '非领导职级', previousPosition: '', positionLevel: '职级序列', dutyType: '职级序列',
    annualPerformance: 0, lastPerformance: 0, achievements: 0, faults: 0, annualAchievements: 0, annualFaults: 0,
    lastAnnualAchievements: 0, lastAnnualFaults: 0,
    investigationCheckedYear: 0, promotionAppliedYear: 0, money: 80000,
    hasHouse: false, houseName: '无房', houseValue: 0, hasCar: false, carName: '无车', carValue: 0,
    relationship: '单身', partner: '', partnerProfileId: '', affection: 0, relationshipYears: 0, lastPartnerActionYear: 0,
    lastPositionEventTitle: '', rankEventTitles: [], rankEventRank: 0, promotionAdUsedYear: 0, promotionAdBonus: 0, promotionAdWatchCount: 0, faultHelpUsedYear: 0,
    children: 0, seniority: 10, reputation: 50, network: 18, integrity: 90, health: 86,
    lastHospitalYear: 0, lastExerciseYear: 0, wealth: 42, review: 76, providentFund: 0, annuity: 0,
    riskTrail: 0, reviewCount: 0, illicitIncome: 0, illicitLedger: [], lastBurstTitle: '', burstTitles: [], burstHistory: [], randomEventCount: 0, randomEventLimit: RANDOM_EVENT_LIMIT, lastAnnualExpense: 0,
    // 关系网：同船的领导、经你帮扶的同僚、被记下来的事证，以及由它们推出来的落马风险。
    // evidence 是审讯时"勾起当时的事"的唯一来源，没有它审讯就只是一段套话。
    fellows: [], proteges: [], evidence: [], networkEventYear: 0,
    pendingInterrogation: null, fallDetail: null,
    warningUsed: false, pendingEvidenceWarning: null, reportedIllicitIncome: 0, denialPressure: 0, escapeDetail: null,
    houseLoanYears: 0, houseAnnualPayment: 0, houseLoanBalance: 0, carLoanYears: 0, carAnnualPayment: 0, carLoanBalance: 0,
    retirementWealth: 0,
    honorTitle: '', honorYear: 0,
    leaderYear: 0, leaderCertificate: null, leaderTrial: null,
    honorHistory: [], honorYearFaults: 0, honorTrackingStartYear: 2026,
    storyProgress: {},
    lastReview: '尚未进行年度考核', lastResult: '欢迎来到澄江市云岭镇基层岗位。',
    records: ['2026年：入职澄江市云岭镇，任二级科员，非领导职级。'], ended: false, ending: '',
  };
}

function normalizeState(data) {
  const defaults = newState();
  const state = Object.assign({}, defaults, copy(data || {}));
  ['age', 'year', 'rankYears', 'annualPerformance', 'lastPerformance', 'achievements', 'faults', 'annualAchievements', 'annualFaults', 'lastAnnualAchievements', 'lastAnnualFaults', 'investigationCheckedYear', 'promotionAppliedYear', 'money', 'affection', 'relationshipYears', 'lastPartnerActionYear', 'promotionAdUsedYear', 'promotionAdBonus', 'promotionAdWatchCount', 'faultHelpUsedYear', 'children', 'seniority', 'reputation', 'network', 'integrity', 'health', 'lastHospitalYear', 'lastExerciseYear', 'wealth', 'review', 'providentFund', 'annuity', 'houseLoanYears', 'houseAnnualPayment', 'houseLoanBalance', 'carLoanYears', 'carAnnualPayment', 'carLoanBalance', 'retirementWealth', 'riskTrail', 'reviewCount', 'networkEventYear', 'lastAnnualExpense', 'randomEventCount', 'randomEventLimit', 'illicitIncome', 'reportedIllicitIncome', 'denialPressure'].forEach(key => {
    const value = Number(state[key]);
    state[key] = Number.isFinite(value) ? value : defaults[key];
  });
  state.rankIndex = clamp(Math.floor(Number(state.rankIndex) || 1), 1, RANKS.length);
  const quarter = Math.floor(Number(state.quarter));
  state.quarter = quarter >= 1 && quarter <= 4 ? quarter : 1;
  state.age = Math.max(0, Math.floor(state.age));
  state.year = Math.max(1, Math.floor(state.year));
  state.storyProgress = stories.normalizeProgress(state.storyProgress, state.year);
  state.honorHistory = honors.historyOf(state.honorHistory, state.year);
  state.leaderTrial = honors.trialOf(state.leaderTrial, state.year);
  state.honorYearFaults = Math.max(0, Math.floor(Number(state.honorYearFaults) || 0));
  // 旧档从下一个完整年度起积累，不将缺失历史误认成五年优秀。
  state.honorTrackingStartYear = data && Number.isInteger(data.honorTrackingStartYear)
    ? Math.max(1, data.honorTrackingStartYear) : state.year + 1;
  state.name = typeof state.name === 'string' ? state.name.slice(0, 8) : '';
  state.partnerProfileId = typeof state.partnerProfileId === 'string' ? state.partnerProfileId.slice(0, 32) : '';
  state.records = Array.isArray(state.records) ? state.records.map(String).slice(0, 18) : [];
  // burstTitles 供界面和最近记录使用；burstHistory 记录这一生已经触发过的全部事件。
  state.burstTitles = Array.isArray(state.burstTitles) ? state.burstTitles.map(String).slice(0, 6) : [];
  const history = Array.isArray(state.burstHistory) ? state.burstHistory.map(String) : [];
  // 旧版本没有完整历史字段，尽量从仍保留在档案里的突发记录回填，避免升级后立刻重播。
  const catalog = BURST_EVENTS.concat([REVIEW_EVENT]);
  const recordedTitles = catalog
    .filter(item => state.records.some(record => String(record).includes(item.title)))
    .map(item => item.title);
  state.burstHistory = Array.from(new Set(history.concat(state.burstTitles, recordedTitles))).slice(0, MAX_BURST_HISTORY);
  state.lastBurstTitle = typeof state.lastBurstTitle === 'string' ? state.lastBurstTitle : '';
  // 按职级抽取季度工作时的"最近出过的题"，用于在 50 道里避开重复。
  // 缺了它 normalizeState 不会报错，但每个职级的题库会被当成"每次都能重抽"。
  state.rankEventTitles = Array.isArray(state.rankEventTitles)
    ? state.rankEventTitles.map(String).slice(0, RANK_EVENT_RECENT)
    : [];
  state.rankEventRank = clamp(Math.floor(Number(state.rankEventRank) || 0), 0, RANK_EVENT_POOL.length);
  delete state.affairEventSeen;
  delete state.affairChanceResolved;
  delete state.affairEligible;
  state.riskTrail = clamp(Math.floor(state.riskTrail), 0, 12);
  state.randomEventCount = clamp(Math.floor(state.randomEventCount), 0, 30);
  state.randomEventLimit = clamp(Math.floor(state.randomEventLimit) || RANDOM_EVENT_LIMIT, 20, 30);
  delete state.pendingAffairHushFee;
  // 关系网与事证：老存档没有这几个字段，必须能安全补成空数组。
  // 每一条都按白名单字段重建，避免改过的存档塞进乱七八糟的结构。
  state.fellows = sanitizePeople(state.fellows, 'f');
  state.proteges = sanitizePeople(state.proteges, 'p');
  state.evidence = (Array.isArray(state.evidence) ? state.evidence : []).slice(0, 10).map(item => ({
    year: Math.max(1, Math.floor(Number(item && item.year) || 1)),
    title: String((item && item.title) || '一次说不清的往来').slice(0, 40),
    choice: String((item && item.choice) || '').slice(0, 60),
    risk: clamp(Math.floor(Number(item && item.risk) || 0), 0, 12),
  }));
  // 不当收入账本：落马页要逐笔列出"哪一年、哪件事、拿了多少钱"。
  // 这是"钱变成风险"的唯一凭据，缺了它落马页就只能给一个总数，说不清来源。
  state.illicitIncome = Math.max(0, Math.floor(Number(state.illicitIncome) || 0));
  state.reportedIllicitIncome = clamp(Math.floor(Number(state.reportedIllicitIncome) || 0), 0, state.illicitIncome);
  state.denialPressure = state.denialPressure > 0 ? 1 : 0;
  state.warningUsed = state.warningUsed === true;
  state.illicitLedger = (Array.isArray(state.illicitLedger) ? state.illicitLedger : []).slice(0, ILLICIT_LEDGER_MAX).map(item => ({
    year: Math.max(1, Math.floor(Number(item && item.year) || 1)),
    title: String((item && item.title) || '一次说不清的往来').slice(0, 40),
    choice: String((item && item.choice) || '').slice(0, 60),
    amount: Math.max(0, Math.floor(Number(item && item.amount) || 0)),
  }));
  state.pendingInterrogation = state.pendingInterrogation && typeof state.pendingInterrogation === 'object'
    ? { year: Math.max(1, Math.floor(Number(state.pendingInterrogation.year) || 1)), risk: clamp(Math.floor(Number(state.pendingInterrogation.risk) || 0), 0, 100), forcedStance: state.pendingInterrogation.forcedStance === 'confess' ? 'confess' : '' }
    : null;
  state.pendingEvidenceWarning = state.pendingEvidenceWarning && typeof state.pendingEvidenceWarning === 'object'
    ? {
      year: Math.max(1, Math.floor(Number(state.pendingEvidenceWarning.year) || state.year)),
      risk: clamp(Math.floor(Number(state.pendingEvidenceWarning.risk) || 0), 0, 100),
      stage: state.pendingEvidenceWarning.stage === 'method' ? 'method' : 'choice',
      seed: Math.max(0, Math.floor(Number(state.pendingEvidenceWarning.seed) || 0)) >>> 0,
    }
    : null;
  if (state.pendingEvidenceWarning) state.warningUsed = true;
  state.escapeDetail = state.escapeDetail && typeof state.escapeDetail === 'object'
    ? {
      method: ESCAPE_METHODS.some(item => item.id === state.escapeDetail.method) ? state.escapeDetail.method : '',
      amount: Math.max(0, Math.floor(Number(state.escapeDetail.amount) || 0)),
      year: Math.max(1, Math.floor(Number(state.escapeDetail.year) || state.year)),
      rankIndex: clamp(Math.floor(Number(state.escapeDetail.rankIndex) || state.rankIndex), 1, RANKS.length),
    }
    : null;
  // proofs 必须一起留下：它记的是落马那一刻桌上摊开的几件事。
  // 页面每次 buildPatch 都会过一遍 normalizeState，漏掉这个字段，
  // 落马结局里的"压在桌上的那几件事"就会静默消失。
  state.fallDetail = state.fallDetail && typeof state.fallDetail === 'object'
    ? {
      stance: String(state.fallDetail.stance || ''),
      cause: String(state.fallDetail.cause || '').slice(0, 24),
      informant: String(state.fallDetail.informant || '').slice(0, 40),
      confiscated: Math.max(0, Math.floor(Number(state.fallDetail.confiscated) || 0)),
      proofs: (Array.isArray(state.fallDetail.proofs) ? state.fallDetail.proofs : []).slice(0, 4).map(item => String(item || '').slice(0, 80)),
    }
    : null;
  state.ended = state.ended === true;
  state.ending = typeof state.ending === 'string' ? state.ending : '';
  // 兼容旧存档，但不再向玩家展示“离职”字样。
  if (state.ending === '违纪处分离职') state.ending = '违纪处分';
  // 荣誉称呼与授予年份必须成对存在；只接受白名单值，避免脏存档伪造榜面标签。
  state.honorYear = clamp(Math.floor(Number(state.honorYear) || 0), 0, 9999);
  state.honorTitle = state.honorTitle === PUBLIC_SERVANT_TITLE ? PUBLIC_SERVANT_TITLE : '';
  if (!state.honorTitle || !state.honorYear) { state.honorTitle = ''; state.honorYear = 0; }
  state.leaderYear = Math.max(0, Math.floor(Number(state.leaderYear) || 0));
  state.leaderCertificate = honors.certificateOf(state.leaderCertificate);
  if (!honors.hasLeader(state)) { state.leaderYear = 0; state.leaderCertificate = null; }
  if (state.illicitIncome > 0 || state.fallDetail || state.ending === '违纪处分' || state.ending === '作风问题处理') revokeHonor(state);
  if (state.rankIndex >= 3 && state.currentPosition === '非领导职级') state.currentPosition = '待选择具体岗位';
  if (state.rankIndex < 3) state.currentPosition = state.currentPosition || '非领导职级';
  if (state.previousPosition === '待选择具体岗位') state.previousPosition = '';
  if (!state.positionLevel) state.positionLevel = state.rankIndex >= 3 ? '领导职务' : '职级序列';
  if (state.quarter < 1 || state.quarter > 4) state.quarter = 1;
  if (state.hasHouse && state.houseValue <= 0) state.houseValue = state.houseName.includes('品质') ? 1000000 : state.houseName.includes('三居') ? 700000 : state.houseName.includes('两居') ? 500000 : state.houseName.includes('小户型') ? 350000 : 250000;
  if (state.hasCar && state.carValue <= 0) state.carValue = state.carName.includes('商务') ? 280000 : state.carName.includes('舒适') ? 180000 : state.carName.includes('新能源') ? 120000 : state.carName.includes('实用') ? 80000 : 50000;
  if (state.relationship !== '单身' && state.affection <= 0) state.affection = 40;
  if (state.relationship !== '单身' && !state.partnerProfileId) {
    const legacy = { 顾宁: 'doctor', 程悦: 'teacher' };
    const matched = PARTNER_PROFILES.find(item => item.name === state.partner);
    state.partnerProfileId = matched ? matched.id : (legacy[state.partner] || '');
  }
  return state;
}

function addRecord(state, text) {
  state.records.unshift(`${state.year}年：${String(text)}`);
  state.records = state.records.slice(0, 18);
}

function applyEffect(state, effect) {
  if (effect && effect.faults > 0) state.honorYearFaults = (state.honorYearFaults || 0) + effect.faults;
  Object.entries(effect || {}).forEach(([key, value]) => { state[key === 'wealth' ? 'money' : key] = (state[key === 'wealth' ? 'money' : key] || 0) + value; });
  ['reputation', 'network', 'integrity', 'health', 'seniority'].forEach(key => { state[key] = clamp(state[key], 0, 100); });
}

function promotionChance(nextRankIndex) {
  return ({ 2: .56, 3: .54, 4: .52, 5: .50, 6: .48, 7: .36, 8: .26, 9: .16, 10: .06, 11: .01 })[nextRankIndex] || .56;
}

function currentPromotionChance(state, nextRankIndex, year = state.year) {
  const count = state.promotionAdUsedYear === year ? state.promotionAdWatchCount : 0;
  return Math.min(1, Number((promotionChance(nextRankIndex) + count * .03 + partnerPromotionBonus(state)).toFixed(4)));
}

// 请领导拉一把的成功率：2026-09-12 由 50% → 70% → 90%（玩家反馈成功率太低，请托一次太亏）。
const FAULT_HELP_SUCCESS_CHANCE = 0.9;

function faultHelpPromotionChance(amount) {
  const paid = Math.max(0, Math.floor(Number(amount) || 0));
  return Math.max(.01, Math.min(.10, paid / 1000000 * .10));
}

// 领导的回应准备多套克制话术，避免每次处理累计过失都出现完全相同的句子。
// 这里不再使用“贿赂”等表述，玩家看到的是一次需要付出代价的请托。
const LEADER_HELP_SUCCESS_LINES = [
  '领导很欣赏你的工作担当，愿意在关键时刻拉你一把。',
  '领导看到了你平时的投入，表示这次可以帮你把难关渡过去。',
  '领导点了点头，认为你还有改正空间，愿意替你说句公道话。',
  '领导认可你近期的表现，决定给你一次重新证明自己的机会。',
  '领导沉吟片刻，表示会关注后续整改，也愿意帮你缓冲一次。',
  '领导了解情况后态度缓和，答应在程序允许范围内帮你协调。',
  '领导认为你并非无可救药，愿意把这次请求作为一次提醒。',
  '领导看重你承担工作的态度，表示关键时刻会给你必要支持。',
  '领导翻了翻记录，认可你过去的补救，答应帮你争取一次机会。',
  '领导语气平和地表示，既然你愿意改，就帮你把这件事往前推一步。',
];

const LEADER_HELP_FAILURE_LINES = [
  '领导两袖清风，婉言谢绝了你的请求。',
  '领导明确表示要按制度办事，不能为个人请求开口子。',
  '领导摆摆手说，组织程序不能靠人情绕开，请你接受正常处理。',
  '领导神情严肃，提醒你不要把工作关系变成私下请托。',
  '领导当场拒绝，并表示任何问题都应留在制度和证据里解决。',
  '领导只说了一句“按规矩来”，随后结束了这次谈话。',
  '领导没有接你的话，转而要求你按规定提交书面说明。',
  '领导表示自己不能收受任何形式的好处，这件事只能依法依规处理。',
  '领导态度坚决，称职责所在不能帮你掩盖累计过失。',
  '领导退回了你的请求，提醒你靠整改和实际表现解决问题。',
];

function selectLeaderHelpLine(lines, state, paid, before) {
  const seed = Math.abs(Math.floor(Number(paid) || 0) + Math.floor(Number(before) || 0) * 17 + Math.floor(Number(state.year) || 0));
  return lines[seed % lines.length];
}

function resolveFaultHelp(state, amount, rng = Math.random) {
  const paid = Math.floor(Number(amount));
  // 金额不设下限（2026-09-12 取消 1 万元门槛）：一年只有一次机会，支出多少由玩家自己定，
  // 金额只影响破格晋升概率（1%~10%），不影响本次成功率。
  if (!Number.isFinite(paid) || paid <= 0) return { ok: false, reason: '请输入大于0元的金额。' };
  if (paid > state.money) return { ok: false, reason: '现金存款不足，请重新输入金额。' };
  if (state.faultHelpUsedYear === state.year) return { ok: false, reason: '本年度请领导拉一把机会已使用，下一年度恢复。' };
  const before = Math.max(0, Math.floor(Number(state.faults) || 0));
  state.faultHelpUsedYear = state.year;
  state.leaderYear = 0; state.leaderCertificate = null;
  state.money -= paid;
  if (rng() < FAULT_HELP_SUCCESS_CHANCE) {
    state.faults = Math.max(0, before - 2);
    const removed = before - state.faults;
    const leaderMessage = selectLeaderHelpLine(LEADER_HELP_SUCCESS_LINES, state, paid, before);
    const chance = faultHelpPromotionChance(paid);
    let promoted = false;
    if (state.rankIndex < 8 && state.rankIndex < RANKS.length && rng() < chance) {
      state.previousPosition = state.currentPosition;
      state.rankIndex += 1;
      state.rankYears = 0;
      state.currentPosition = state.rankIndex >= 3 ? '待选择具体岗位' : '非领导职级';
      state.dutyType = RANKS[state.rankIndex - 1].dutyType;
      promoted = true;
    }
    const faultText = removed > 0 ? `累计过失减少${removed}点。` : '当前没有可消除的累计过失。';
    const promotionText = promoted ? `你同时获得破格认可，晋升至${RANKS[state.rankIndex - 1].name}。` : '';
    state.lastResult = `${leaderMessage}${faultText}${promotionText}本次支出${paid}元。`;
    addRecord(state, state.lastResult);
    return { ok: true, delta: -removed, favorable: true, promoted, promotionChance: chance, leaderMessage };
  }
  state.faults = before + 1;
  state.honorYearFaults = (state.honorYearFaults || 0) + 1;
  const leaderMessage = selectLeaderHelpLine(LEADER_HELP_FAILURE_LINES, state, paid, before);
  state.lastResult = `${leaderMessage}累计过失增加1点，本次支出${paid}元。`;
  addRecord(state, state.lastResult);
  return { ok: true, delta: 1, favorable: false, promoted: false, promotionChance: 0, leaderMessage };
}

function investigationChance(rankIndex) { return rankIndex < 3 ? 0 : Math.min(.45, (rankIndex - 2) * .05); }

function isQualified(state, nextRank) {
  return state.rankYears >= nextRank.years && state.age >= nextRank.age && state.review >= nextRank.review &&
    state.reputation >= nextRank.reputation && state.network >= nextRank.network && state.integrity >= 60 &&
    state.achievements >= (nextRank.achievement || 0) && state.faults <= (nextRank.faultLimit || 99);
}

function positionAllowance(position = '') {
  if (/国家级|省级主要负责人|国家部委主要负责人/.test(position)) return 20000;
  if (/市委书记|市长|省公安厅/.test(position)) return 16000;
  if (/副市长|市委副书记|县委书记|县长|市辖区委书记|区长/.test(position)) return 12000;
  if (/常务副|公安局局长|市委常委|县委常委/.test(position)) return 8000;
  if (/镇党委书记|镇长|主要负责人|局长/.test(position)) return 5000;
  if (/副书记|副县长|副区长|副镇长/.test(position)) return 3000;
  return 0;
}

function annualCompensation(state) {
  const base = COMPENSATION_BY_RANK[state.rankIndex] || COMPENSATION_BY_RANK[1];
  const allowance = positionAllowance(state.currentPosition);
  return { salary: base.salary + allowance, providentFund: base.providentFund + Math.floor(allowance * .24), annuity: base.annuity + Math.floor(allowance * .10), allowance };
}

function netWealth(state) { return Math.max(0, Math.floor(state.money + state.providentFund + state.annuity + (state.houseValue || 0) + (state.carValue || 0) - state.houseLoanBalance - state.carLoanBalance)); }

// 每一项都放进 livingDetail，页面与年度记录可以逐条对上"钱花在哪"。
// 基础生活仍随职级上涨，再叠加子女抚养、房车持有、父母赡养、医疗康复与伴侣的消费习惯。
// 每年结算时自动扣除的家庭开销。2026-09-12 定稿口径（玩家两轮调参后拍板）：
// - 基础生活锚定"年度待遇的 30%"，随职级同步上涨，不再是固定数；
// - 一个孩子一年 2.5 万抚养费，生几个加几份；
// - 住房/车辆使用维护、父母赡养、医疗康复、伴侣开销仍按固定值逐项列出；
// - 还贷上一道"银行也会上"的闸：年供按 LOAN_PAYMENT_FACTOR 计提，
//   房贷+车贷合并封顶到年度待遇的 LOAN_PAYMENT_SALARY_CAP，触顶按比例压缩。
// 也就是说总开销不是待遇的固定百分比：它随职级、家庭负担和玩家自己的购置选择浮动，
// 封顶只保证现金流压力有上限。超出部分余额随年限到期自动清零（见 finishQuarter）。
const LOAN_PAYMENT_FACTOR = 0.3;
const LOAN_PAYMENT_SALARY_CAP = 0.22;
const BASE_LIVING_PAY_SHARE = 0.3;
const CHILD_ANNUAL_COST = 25000;

function annualLoanPayments(state) {
  const salary = Math.max(0, Math.floor(Number(annualCompensation(state).salary) || 0));
  const cap = Math.floor(salary * LOAN_PAYMENT_SALARY_CAP);
  const paymentOf = (yearsKey, annualKey, balanceKey) => {
    if (!(Number(state[yearsKey]) > 0)) return 0;
    const full = Math.max(0, Math.floor(Number(state[annualKey]) || 0));
    const balance = Math.max(0, Math.floor(Number(state[balanceKey]) || 0));
    return Math.min(Math.ceil(full * LOAN_PAYMENT_FACTOR), balance);
  };
  let houseLoan = paymentOf('houseLoanYears', 'houseAnnualPayment', 'houseLoanBalance');
  let carLoan = paymentOf('carLoanYears', 'carAnnualPayment', 'carLoanBalance');
  const planned = houseLoan + carLoan;
  if (planned > cap && planned > 0) {
    // 两笔贷款按同一比例压缩，不偏袒任何一方；封顶后仍保留余额，到期自动清零
    const scale = cap / planned;
    houseLoan = Math.floor(houseLoan * scale);
    carLoan = Math.floor(carLoan * scale);
  }
  return { houseLoan, carLoan, total: houseLoan + carLoan };
}

function annualExpenses(state) {
  const children = Math.max(0, Math.floor(Number(state.children) || 0));
  const age = Math.max(0, Math.floor(Number(state.age) || 0));
  const health = clamp(Math.floor(Number(state.health) || 0), 0, 100);
  const salary = Math.max(0, Math.floor(Number(annualCompensation(state).salary) || 0));
  // 基础生活 = 年度待遇 × 30%（取整到百元），跟着职级走
  const baseLiving = Math.round(salary * BASE_LIVING_PAY_SHARE / 100) * 100;
  const items = [{ label: '基础生活', amount: baseLiving }];
  if (children > 0) items.push({ label: `子女抚养×${children}`, amount: children * CHILD_ANNUAL_COST });
  if (state.hasHouse) items.push({ label: '住房使用维护', amount: 2250 });
  if (state.hasCar) items.push({ label: '车辆使用维护', amount: 1900 });
  if (age >= 50) items.push({ label: '父母赡养', amount: age >= 62 ? 4500 : 2250 });
  if (health < 60) items.push({ label: '医疗康复', amount: health < 40 ? 3000 : 1500 });
  const profile = partnerProfile(state);
  const partnerExpense = profile ? Math.floor(Number(profile.annualExpense) || 0) : 0;
  if (partnerExpense !== 0) items.push({ label: `伴侣开销（${profile.name}）`, amount: partnerExpense });
  const living = items.reduce((sum, item) => sum + item.amount, 0);
  const loan = annualLoanPayments(state).total;
  return { living, livingDetail: items, loan, total: living + loan };
}
function positionEventKey(state) {
  const position = state.currentPosition || '';
  if (state.rankIndex <= 2) return 'grassroots';
  if (position.includes('省公安厅')) return 'province_security';
  if (/省级主要负责人|省委副书记|副省长|省长/.test(position)) return 'province_lead';
  if (/国家部委|国家级/.test(position)) return 'national';
  if (/市委常委、县委书记|市委书记|市委副书记|市长|副市长/.test(position)) return 'city_lead';
  if (position.includes('市委常委')) return 'city_party';
  if (/市委副秘书长|市政府副秘书长|市政府办公室主任/.test(position)) return 'city_party';
  if (/市辖区政府党组书记、区长|市辖区委书记/.test(position)) return 'district_lead';
  if (position.includes('市辖区')) return 'district';
  if (position.includes('镇党委书记')) return 'town_party';
  if (position.includes('镇党委副书记、政法委书记')) return 'town_security';
  if (/镇党委委员、派出所|公安局/.test(position)) return 'public_security';
  if (position.includes('镇党委委员、人武部')) return 'military';
  if (/镇党委委员、组织|镇党委委员、宣传|镇党委委员、统战/.test(position)) return 'town_organization';
  if (position.includes('镇党委委员、纪委')) return 'discipline';
  if (/镇党委副书记|镇长|副镇长/.test(position)) return 'town_government';
  if (/镇党委.*副书记/.test(position)) return 'town_party';
  if (position.includes('县委书记')) return 'county_party_lead';
  if (/县委副书记、县长|县长/.test(position)) return 'county_government_lead';
  if (position.includes('县委副书记、政法委书记')) return 'county_security';
  if (position.includes('县委常委、组织部部长')) return 'county_organization';
  if (position.includes('县委常委、宣传部部长')) return 'county_propaganda';
  if (position.includes('县委常委、县委办公室主任')) return 'county_office';
  if (/县委常委|县委/.test(position)) return 'county_party';
  if (/县政府|副县长/.test(position)) return 'county_government';
  if (/县.*(局|企业)/.test(position)) return 'county_government';
  if (/纪委|监督/.test(position)) return 'discipline';
  if (/组织|宣传/.test(position)) return 'organization';
  if (/单位|部门/.test(position)) return 'department';
  if (state.rankIndex >= 9) return 'national';
  if (state.rankIndex >= 8) return 'province_lead';
  if (state.rankIndex >= 7) return 'city_lead';
  if (state.rankIndex >= 4) return 'executive';
  return 'grassroots';
}

function selectPositionEvent(state, pool, rng) {
  const candidates = pool.filter(item => item.title !== state.lastPositionEventTitle || pool.length === 1);
  const event = copy(candidates[Math.floor(rng() * candidates.length)] || pool[0]);
  state.lastPositionEventTitle = event.title;
  return event;
}

const EXTRA_POOL_KEYS = { city_lead: ['city'], city_party: ['city'] };

function eventForPosition(state, rng = Math.random) {
  const key = positionEventKey(state);
  let pool = ADDITIONAL_POSITION_EVENTS[key] || POSITION_EVENTS[key] || POSITION_EVENTS.grassroots;
  const extra = (EXTRA_POOL_KEYS[key] || []).map(name => POSITION_EVENTS[name]).filter(Boolean);
  if (extra.length) pool = (Array.isArray(pool) ? pool : [pool]).concat(extra);
  // 手写扩展的岗位事件：补齐原版里只有 1 条事件的池（这些池重复感最重）。
  // 注意 EXTRA_POOL_KEYS 里的别名池（如 city 会并入 city_lead / city_party），
  // 否则这些池的扩展内容永远抽不到，等于死数据。
  const handWritten = (EXTRA_POOL_KEYS[key] || []).concat([key])
    .flatMap(name => EXTRA_POSITION_EVENTS[name] || [])
    .filter(item => state.rankIndex >= (item.minRank || 1));
  if (handWritten.length) pool = (Array.isArray(pool) ? pool : [pool]).concat(handWritten);
  const event = Array.isArray(pool) ? selectPositionEvent(state, pool, rng) : copy(pool);
  event.scene = event.scene.replace(/当前岗位/g, state.currentPosition);
  return event;
}

// 通用事件按职级解锁：低职级不会抽到需要实权才会遇到的事
function commonEventPoolFor(state) {
  return COMMON_EVENT_POOL.filter(item => state.rankIndex >= (item.minRank || 1));
}

function commonEventFor(state, rng = Math.random) {
  const pool = commonEventPoolFor(state);
  return copy(pool[Math.floor(rng() * pool.length)] || pool[0]);
}

// ── 按职级的季度工作题库 ────────────────────────────────────────────────
// 每个职级一份 50 道的题库，只在本职级抽取：二级科员办窗口和入户，副处级才
// 谈得上协调部门。这样副科级往上不会再出现"翻来覆去只有四五个选项"的情况。
// 最近抽过的题目记在 rankEventTitles 里。记录长度取「题库长度 - 1」，
// 于是 50 道题会被完整地轮一遍才开始重复——随机抽样会让 40 个季度里
// 有近 1/4 是重题，玩家感知到的就是"总是这几件事"。
const RANK_EVENT_RECENT = 60;

function rankPoolFor(rankIndex) {
  const index = clamp(Math.floor(Number(rankIndex) || 1), 1, RANK_EVENT_POOL.length) - 1;
  return RANK_EVENT_POOL[index] || [];
}

function rankEventFor(state, rng = Math.random) {
  const pool = rankPoolFor(state.rankIndex);
  if (!pool.length) return null;
  const rank = clamp(Math.floor(Number(state.rankIndex) || 1), 1, RANK_EVENT_POOL.length);
  // 换了职级就换题库，上一职级记住的题名对这一职级没有意义。
  if (state.rankEventRank !== rank) {
    state.rankEventRank = rank;
    state.rankEventTitles = [];
  }
  const keep = Math.max(1, pool.length - 1);
  const recent = (Array.isArray(state.rankEventTitles) ? state.rankEventTitles : []).slice(0, keep);
  let candidates = pool.filter(item => !recent.includes(item.title));
  if (!candidates.length) candidates = pool;
  const event = copy(candidates[Math.floor(rng() * candidates.length)] || pool[0]);
  state.rankEventTitles = [event.title].concat(recent.filter(item => item !== event.title)).slice(0, keep);
  event.scene = event.scene.replace(/当前岗位/g, state.currentPosition);
  return event;
}

// ── 突发事件（弹窗式） ────────────────────────────────────────────────
// 与季度主事项不同：它不占"本季度事项"，是在处理完一件事之后突然弹出来的，
// 必须当场表态。职位越高，被围猎的概率越大；自己收下的东西越多，倒查来得越快。

// 触发概率：基础 30%，职级每高一级 +2.5%，最高 50%。
function burstChance(state) {
  if (state.ended) return 0;
  if ((Number(state.randomEventCount) || 0) >= (Number(state.randomEventLimit) || RANDOM_EVENT_LIMIT)) return 0;
  // 刚入职的科员手上没有可交换的东西，这个阶段不会有人来送东西、拉入股。
  if (!burstPoolFor(state).some(item => !burstHistoryOf(state).includes(item.title))) return 0;
  const rankBonus = Math.min(0.2, Math.max(0, (Number(state.rankIndex) || 1) - 2) * 0.025);
  return Math.min(0.5, BURST_BASE_CHANCE + rankBonus);
}

// 风险痕迹到顶时不再是"概率"，而是必然——这是玩家自己攒出来的结果。
// 但同一段人生只允许经历一次专项倒查，之后不重复弹出同名事件。
function burstDue(state) {
  return (Number(state.riskTrail) || 0) >= RISK_TRAIL_THRESHOLD
    && !burstHistoryOf(state).includes(REVIEW_EVENT.title);
}

function burstPoolFor(state) {
  return BURST_EVENTS.filter(item => (Number(state.rankIndex) || 1) >= (item.minRank || 1));
}

function drawBurstEvent(state, rng = Math.random) {
  const all = burstPoolFor(state);
  if (!all.length) return null;
  const pool = all.filter(item => !burstHistoryOf(state).includes(item.title));
  if (!pool.length) return null;
  const total = pool.reduce((sum, item) => sum + (Number(item.weight) || 1), 0);
  let point = rng() * total;
  let picked = pool[pool.length - 1];
  for (const item of pool) { point -= (Number(item.weight) || 1); if (point <= 0) { picked = item; break; } }
  const event = copy(picked);
  rememberBurst(state, event.title);
  return event;
}

// 页面每次只调这一个入口：
//   返回 null                    → 这次没有突发事件
//   返回 { event, review:false, kind:'normal' }      → 普通突发（受贿 / 投资 / 围猎 / 举报 / 家庭 / 意外 / 结网）
//   返回 { event, review:true,  kind:'review' }      → 风险痕迹攒够了，触发专项倒查
//   返回 { event, review:false, kind:'fellowFall' }  → 关系网里有人被带走
//   返回 { event, review:false, kind:'evidenceWarning' } → 落马前唯一一次处置提醒
//   返回 { event, review:false, kind:'escapeMethod' } → 选择一种抽象交通方式判定出逃结局
//   返回 { event, review:false, kind:'interrogation' } → 终局审讯，答完就落马
//
// 优先级固定：证据提醒/出逃判定 > 审讯 > 倒查 > 牵连 > 普通。
function pickBurst(state, rng = Math.random) {
  if (state.ended) return null;
  if (state.pendingEvidenceWarning) {
    const methodStage = state.pendingEvidenceWarning.stage === 'method';
    return { event: copy(methodStage ? buildEscapeMethodEvent(state) : buildEvidenceWarningEvent(state)), review: false, kind: methodStage ? 'escapeMethod' : 'evidenceWarning' };
  }
  if (state.pendingInterrogation) {
    const event = copy(network.buildInterrogationEvent(state, rng));
    if (state.pendingInterrogation.forcedStance === 'confess') event.options = (event.options || []).filter(option => option.stance === 'confess');
    return { event, review: false, kind: 'interrogation' };
  }
  if (burstDue(state)) {
    rememberBurst(state, REVIEW_EVENT.title);
    return { event: copy(REVIEW_EVENT), review: true, kind: 'review' };
  }
  const fellowFall = pickFellowFall(state, rng);
  if (fellowFall) return fellowFall;
  if (rng() >= burstChance(state)) return null;
  const event = drawBurstEvent(state, rng);
  if (event) state.randomEventCount = Math.min(Number(state.randomEventLimit) || RANDOM_EVENT_LIMIT, (Number(state.randomEventCount) || 0) + 1);
  return event ? { event, review: false, kind: 'normal' } : null;
}

// 关系网里有人被带走。这是"线头"：玩家先看到别人倒了，才轮到自己。
// 每人每年最多来一次，否则高风险存档会被同一类事件刷屏，反而麻木。
function pickFellowFall(state, rng = Math.random) {
  if (state.networkEventYear === state.year) return null;
  const candidates = [];
  (Array.isArray(state.fellows) ? state.fellows : []).forEach(person => { if (!person.fallen) candidates.push({ person, kind: 'fellow' }); });
  (Array.isArray(state.proteges) ? state.proteges : []).forEach(person => { if (!person.fallen) candidates.push({ person, kind: 'protege' }); });
  if (!candidates.length) return null;
  // 每个人自己的概率不同，但整张网里至少要有一个到点，事情才会发生
  const due = candidates.filter(item => rng() < network.fallChanceFor(state, item.person));
  if (!due.length) return null;
  const picked = due[Math.floor(rng() * due.length)] || due[0];
  network.takeIntoCustody(state, picked.person);
  state.networkEventYear = state.year;
  // 有人被带走，串并案的压力立刻落到你身上
  state.riskTrail = clamp((Number(state.riskTrail) || 0) + 2, 0, 12);
  return { event: network.buildFellowFallEvent(state, picked.person, picked.kind, rng), review: false, kind: 'fellowFall' };
}

// 拿了多少意外收入，就冒多大风险 —— 这是"落马风险"里唯一直接由钱决定的一项。
//
// 3 万元以内的人情往来不进折算（土产、购物卡、加油卡这类），只按事件手写的小痕迹记账；
// 超过 3 万的部分每 1 万元折 1 点。退回去、自己掏钱补上的选项仍走手写的 risk
//（通常为 0 或负值），所以主动切割永远比收下划算。
// 返回 { risk, wealth, note }：note 是可以摆在明面上的一句说明，
// 玩家在结果里就能看见"这笔钱换来了多少痕迹"，不必等到落马才知道自己怎么被盯上的。
function bribeRiskOf(resolved) {
  const written = Number(resolved && resolved.risk) || 0;
  const wealth = Number(resolved && resolved.effect && resolved.effect.wealth) || 0;
  if (wealth <= BRIBE_RISK_FLOOR) return { risk: written, wealth, note: '' };
  let risk = Math.max(1, Math.floor((wealth - BRIBE_RISK_FLOOR) / 10000) * BRIBE_RISK_PER_WAN);
  if (resolved && resolved.bond) risk += BOND_RISK_BONUS;
  risk = clamp(risk, 1, BRIBE_RISK_CAP);
  const wan = Math.round(wealth / 10000);
  return {
    risk,
    wealth,
    note: `意外收入${wan}万元，超过3万元的部分按每万元1点计，往来痕迹 +${risk}${resolved.bond ? '（结下的关系另计1点）' : ''}。`,
  };
}

// 监督核查查出实问题的概率：当前落马风险 × 30%（风险 50 → 15%）。
// 沿用年度判定的两道闸门——风险不到 20 说明没有可查的东西，没有线头则落马无从解释。
function investigationFallChance(state) {
  if (!state || state.ended || state.pendingInterrogation) return 0;
  const risk = network.fallRiskOf(state).risk;
  // 阈值直接取年度判定的那一个，不在这里另写一份 20 —— 两处各写一个数字，
  // 改了一个另一个就会静默失配，表现为"年度不查但核查能查"这种说不通的结果。
  if (risk < network.FALL_CHANCE_MIN_RISK) return 0;
  if (!network.hasThread(state)) return 0;
  const base = (risk * INVESTIGATION_FALL_CHANCE) / 100;
  return clamp(base * (state.denialPressure ? DENIAL_FALL_MULTIPLIER : 1), 0, 1);
}

function annualFallChance(state) {
  const base = network.fallChance(state);
  return clamp(base * (state && state.denialPressure ? DENIAL_FALL_MULTIPLIER : 1), 0, 1);
}

function buildEvidenceWarningEvent() {
  return {
    title: '证据风险提示', tag: '处置选择',
    scene: '几处材料的核对口径突然收紧，熟悉情况的人也开始被分别谈话。没有人向你说明结论，但你已经意识到：部分事实可能已被掌握。\n\n这是本段生涯唯一一次处置机会。以下规则仅为虚构游戏机制，不构成现实法律判断，也不提供任何逃避调查的方法。',
    options: [
      { action: 'confess', text: '主动说明情况并退缴相关款项' },
      { action: 'deny', text: '拒不交代，继续维持原有说法' },
      { action: 'escape', text: '试图离开，接受去向判定' },
    ],
  };
}

function buildEscapeMethodEvent() {
  return {
    title: '去向判定', tag: '去向选择',
    scene: '你决定离开当前生活。现在只能选择一种交通方式。\n\n此处只作抽象概率判定，不提供任何现实操作信息。',
    options: ESCAPE_METHODS.map(item => ({ method: item.id, text: `选择${item.name}（${Math.round(item.chance * 100)}%）` })),
  };
}

function escapeResultFor(seed, methodId) {
  const method = ESCAPE_METHODS.find(item => item.id === methodId) || ESCAPE_METHODS[0];
  const base = (Math.max(0, Math.floor(Number(seed) || 0)) % 1000000) / 1000000;
  return (base + method.offset) % 1;
}

function queueFallOutcome(state, rng = Math.random) {
  const risk = network.fallRiskOf(state).risk;
  revokeHonor(state);
  if (!state.warningUsed && !state.pendingEvidenceWarning && network.outstandingIllicitIncomeOf(state) > 0
    && rng() < EVIDENCE_WARNING_CHANCE) {
    const seed = Math.floor(clamp(Number(rng()) || 0, 0, 0.999999999) * 1000000000) >>> 0;
    state.warningUsed = true;
    state.pendingInterrogation = null;
    state.pendingEvidenceWarning = { year: state.year, risk, stage: 'choice', seed };
    state.lastResult = '核查迹象已经出现。你获得本段生涯唯一一次处置机会。';
    addRecord(state, `出现证据风险提示（当时落马风险${risk}）。`);
    return { warning: true, risk };
  }
  state.pendingEvidenceWarning = null;
  state.pendingInterrogation = { year: state.year, risk, forcedStance: '' };
  return { warning: false, risk };
}

function resolveEvidenceWarning(state, event, optionIndex) {
  if (!state || !state.pendingEvidenceWarning || state.pendingEvidenceWarning.stage !== 'choice') return false;
  const option = event && event.options && event.options[optionIndex];
  if (!option) return false;
  const action = option.action;
  const outstanding = network.outstandingIllicitIncomeOf(state);
  const risk = state.pendingEvidenceWarning.risk;
  if (action === 'confess') {
    state.pendingEvidenceWarning = null;
    if (outstanding <= SMALL_CONFESSION_LIMIT && state.money >= outstanding) {
      state.money = Math.max(0, Math.floor(Number(state.money) || 0) - outstanding);
      state.reportedIllicitIncome = Math.max(0, Math.floor(Number(state.illicitIncome) || 0));
      state.riskTrail = 0;
      state.evidence = [];
      state.denialPressure = 0;
      state.lastResult = `你主动说明了全部情况，并退缴相关款项${outstanding}元。本次没有进入处分结局，生涯继续；这段记录不会消失，也不再符合清正荣誉条件。该结果仅为虚构游戏规则，不代表现实法律标准。`;
      addRecord(state, `证据风险提示后主动说明情况并退缴${outstanding}元，生涯继续。`);
      return true;
    }
    state.pendingInterrogation = { year: state.year, risk, forcedStance: 'confess' };
    state.lastResult = `涉及金额超过游戏内${SMALL_CONFESSION_LIMIT / 10000}万元的小额处置线，或当前现金不足以完成退缴。主动说明会作为后续处理态度记录，但公职生涯不能继续。该门槛仅为虚构玩法规则。`;
    addRecord(state, '证据风险提示后主动说明情况，进入正式审查流程。');
    return true;
  }
  if (action === 'deny') {
    state.pendingEvidenceWarning = null;
    state.denialPressure = 1;
    state.lastResult = '你维持原有说法，眼前的程序暂时没有推进。但材料仍在继续汇集：今后的监督核查概率显著上升，下一次再收不当收入时有85%概率被直接发现。';
    addRecord(state, '证据风险提示后拒不交代，后续核查压力显著上升。');
    return true;
  }
  if (action === 'escape') {
    state.pendingEvidenceWarning.stage = 'method';
    state.lastResult = '你决定离开当前生活，接下来只能选择一种交通方式。';
    return true;
  }
  return false;
}

function resolveEscapeMethod(state, event, optionIndex) {
  if (!state || !state.pendingEvidenceWarning || state.pendingEvidenceWarning.stage !== 'method') return { success: false, resolved: false };
  const option = event && event.options && event.options[optionIndex];
  const method = option && ESCAPE_METHODS.find(item => item.id === option.method);
  if (!method) return { success: false, resolved: false };
  const pending = state.pendingEvidenceWarning;
  const success = escapeResultFor(pending.seed, method.id) < method.chance;
  state.pendingEvidenceWarning = null;
  state.denialPressure = 0;
  if (success) {
    const amount = Math.max(0, Math.floor(Number(state.money) || 0));
    state.escapeDetail = { method: method.id, amount, year: state.year, rankIndex: state.rankIndex };
    state.pendingInterrogation = null;
    state.ended = true;
    state.ending = '出逃结局';
    revokeHonor(state);
    state.retirementWealth = netWealth(state);
    state.lastResult = `你离开了原有的生活轨迹，此后的去向无人知晓。系统记录当时涉案携带现金${amount}元；选择离开并未使此前发生的事情与相关后果消失。`;
    addRecord(state, `选择${method.name}离开，系统记录涉案携带现金${amount}元。`);
  } else {
    state.pendingInterrogation = { year: state.year, risk: pending.risk, forcedStance: '' };
    state.lastResult = `${method.name}行程尚未完成，调查程序已经启动。你将进入正式审查流程。`;
    addRecord(state, `选择${method.name}未能离开，进入正式审查流程。`);
  }
  return { success, resolved: true, method: method.id };
}

// 结算一条突发选项。突发不占季度绩效，所以不动 annualPerformance；
// 但廉政、健康、口碑、现金照常结算，收下的好处会累加"风险痕迹"。
//
// 关系网也在这里推进：选项上声明的 bond 会结成一个人，sever 会断掉一条关系，
// 有 risk 的选择会被记进 evidence —— 那份清单就是将来审讯时摆在桌上的东西。
function resolveBurst(state, event, optionIndex, rng = Math.random, isReview = false) {
  const option = event && event.options && event.options[optionIndex];
  if (!option) return false;
  rememberBurst(state, event.title);
  const resolved = resolveOption(state, option, rng);
  applyEffect(state, resolved.effect);
  // 现金不出现负数：真花光了就是花光了。
  state.money = Math.max(0, Math.floor(Number(state.money) || 0));
  // 风险痕迹允许为负：主动说明、切割关系这类处置必须能把风险压回去，
  // 否则玩家一旦走高就再也回不了头，玩法就只剩惩罚、没有选择。
  // 收了钱的选项不认手写值，一律按进账金额重算，保证"拿多少、冒多大"。
  const bribe = bribeRiskOf(resolved);
  const risk = bribe.risk;
  if (Number.isFinite(risk) && risk !== 0) state.riskTrail = clamp(state.riskTrail + risk, 0, 12);
  // 不当收入单独记一本累计账：trail 会被倒查清零，但钱进了口袋就一直在。
  // 这一本直接喂给落马风险里的 illicit 项，也是落马页逐笔列数的唯一来源。
  // 判据：选项本身带了痕迹，或者单笔就上了 3 万 —— 正常工作奖励（签约奖金那类）
  // 既没有 risk 也远不到 3 万，不会被误记成不当收入。
  if (bribe.wealth > 0 && (risk > 0 || bribe.wealth >= BRIBE_RISK_FLOOR)) {
    state.illicitIncome = Math.max(0, Math.floor(Number(state.illicitIncome) || 0)) + Math.floor(bribe.wealth);
    state.illicitLedger = [{
      year: Number(state.year) || 2026,
      title: String((event && event.title) || '一次说不清的往来').slice(0, 40),
      choice: String((resolved && resolved.text) || (option && option.text) || '').slice(0, 60),
      amount: Math.floor(bribe.wealth),
    }].concat(Array.isArray(state.illicitLedger) ? state.illicitLedger : []).slice(0, ILLICIT_LEDGER_MAX);
    revokeHonor(state);
  }
  const denialDiscovery = state.denialPressure > 0 && bribe.wealth > 0 && (risk > 0 || bribe.wealth >= BRIBE_RISK_FLOOR);
  if (denialDiscovery) {
    state.denialPressure = 0;
    if (rng() < DENIAL_NEXT_BRIBE_DISCOVERY_CHANCE) {
      state.pendingInterrogation = { year: state.year, risk: network.fallRiskOf(state).risk, forcedStance: '' };
    }
  }
  const bondedPerson = network.applyBond(state, resolved.bond, rng);
  if (resolved.sever) network.severFrom(state, resolved.severKind || 'fellow');
  network.recordEvidence(state, event, Object.assign({}, resolved, { risk }));
  let resultText;
  if (isReview) {
    state.reviewCount = (Number(state.reviewCount) || 0) + 1;
    state.riskTrail = 0; // 倒查结束，痕迹清零；但档案里的记录不会消失
    resultText = `${resolved.result}专项倒查结束，此事告一段落。`;
  } else {
    resultText = resolved.result;
  }
  // 收了钱的当场把代价写出来：拿了 8 万和拿了 3 万，痕迹不是一回事。
  if (bribe.note) resultText += `\n${bribe.note}`;
  if (denialDiscovery && state.pendingInterrogation) resultText += '\n此前拒不交代形成的核查压力在这笔往来中兑现，相关事实被直接发现。';
  else if (denialDiscovery) resultText += '\n这笔往来暂未被当场发现，但此前拒不交代带来的额外核查压力已经结算。';
  // 累计不当收入第一次跨过 3 万时提示一次。之后不重复啰嗦，
  // 玩家想看随时能在成长档案里看到累计数和它折算出的风险。
  if (bribe.wealth > 0 && state.illicitIncome > BRIBE_RISK_FLOOR
    && state.illicitIncome - bribe.wealth <= BRIBE_RISK_FLOOR) {
    resultText += `\n累计不当收入${(state.illicitIncome / 10000).toFixed(1)}万元，已超过3万元这条线，落马风险 +${network.illicitRiskOf(state).toFixed(1)}。`;
  }
  if (bondedPerson) {
    const relation = resolved.bond.kind === 'protege' ? '帮扶对象' : '同船领导';
    resultText += `\n关系链记录：${relation}${bondedPerson.title}${bondedPerson.name}，事由为“${bondedPerson.reason}”。`;
  }
  state.lastResult = resultText;
  const recordResult = String(resultText || '').replace(/[。！？!?]+$/, '');
  addRecord(state, `${isReview ? '专项倒查' : event.title}：${recordResult}。`);
  return true;
}

// 终局：被带走之后的谈话。
// 三种态度都不存在"过关"——被带走调查本身就是结局，区别只在处理档次与追缴比例。
// 追缴金额跟着 evidence 走，所以玩家能看清自己当年的每一笔选择都换了什么。
function resolveInterrogation(state, event, optionIndex) {
  const option = event && event.options && event.options[optionIndex];
  if (!option) return false;
  const stance = network.FALL_STANCES[option.stance] ? option.stance : 'silent';
  const config = network.FALL_STANCES[stance];
  applyEffect(state, option.effect);
  const confiscated = network.confiscationOf(state, stance);
  state.money = Math.max(0, Math.floor((Number(state.money) || 0) - confiscated));
  state.integrity = 0;
  // 出面交代的人：优先取已经落马的同船领导，其次是被你扶上去的人。
  const informant = (state.fellows || []).filter(item => item.fallen)[0] || (state.proteges || []).filter(item => item.fallen)[0] || null;
  state.fallDetail = {
    stance,
    informant: informant ? `${informant.title}${informant.name}` : '',
    confiscated,
    proofs: (Array.isArray(state.evidence) ? state.evidence : []).slice(0, 4).map(item => `${item.year}年，${item.title}——当时选的是「${item.choice}」`),
  };
  state.pendingInterrogation = null;
  state.riskTrail = 0;
  state.ended = true;
  state.ending = config.ending;
  revokeHonor(state);
  state.lastResult = `${option.result}\n${config.note}`;
  state.retirementWealth = netWealth(state);
  addRecord(state, `因涉嫌违纪违法被立案审查。处理结论：${config.ending}，追缴涉案资金${confiscated}元。`);
  return true;
}

function startQuarter(state, rng = Math.random) {
  let event;
  const alreadyChecked = state.investigationCheckedYear === state.year;
  state.investigationCheckedYear = state.year;
  if (!alreadyChecked && investigationChance(state.rankIndex) > 0 && rng() < investigationChance(state.rankIndex)) {
    event = copy(INVESTIGATION_EVENT);
    event.isInvestigation = true; // resolveEvent 凭这个标记掷"核查落马骰"
    // 提前把口径亮给玩家：查出实问题的概率 = 当前落马风险 × 30%，不是暗骰
    event.scene = `${event.scene}\n核查会结合你当前的暴露风险判断：落马风险越高，查出实问题的可能越大。`;
    const quarter = ['第一季度', '第二季度', '第三季度', '第四季度'][state.quarter - 1] || '第一季度';
    addRecord(state, `${quarter}触发监督核查程序，当前级别触发概率为${Math.floor(investigationChance(state.rankIndex) * 100)}% 。`);
  }
  // 进入领导岗位后，四个季度都从当前具体岗位池抽取，避免身居高位仍去办
  // 基层窗口、森林防火值守等不符合职责层级的工作。前两级没有具体岗位，
  // 继续使用基层通用事项。
  // 优先走按职级的题库（每职级 50 道，内容贴合该职级的权力边界）；
  // 题库缺这一级时才退回原来的岗位池／通用池。
  // 注意必须在监督核查分支的 else 里：那一支已经决定了本季度的事项，
  // 再抽一次会把核查事件覆盖掉。
  else {
    const trial = honors.trialEvent(state);
    if (trial) return trial;
    const story = stories.eventFor(state);
    if (story) return story;
    const ranked = rankEventFor(state, rng);
    if (ranked) event = ranked;
    else if (state.rankIndex >= 3) event = eventForPosition(state, rng);
    else event = commonEventFor(state, rng);
  }
  return event;
}

// 条件强化：平时积累的属性达到要求时，同一条选项会变成更强的一档
function meetsRequirement(state, require) {
  return Object.entries(require || {}).every(([key, value]) => Number(state[key] || 0) >= Number(value));
}

// 把一条选项解析成最终生效的版本：
//   upgraded —— 满足 require 时替换为更强的文案与效果
//   roll     —— 按 chance（可用属性修正）随机走 success / fail 分支
function resolveOption(state, option, rng = Math.random) {
  let chosen = option;
  if (option.upgraded && meetsRequirement(state, option.upgraded.require)) {
    chosen = Object.assign({}, option, option.upgraded);
  }
  if (option.roll) {
    const roll = option.roll;
    const perPoint = roll.perPoint == null ? 0.006 : roll.perPoint;
    const attrValue = roll.attr ? Number(state[roll.attr] || 0) : 0;
    const base = roll.chance == null ? 0.5 : Number(roll.chance);
    const chance = clamp(base + attrValue * perPoint, 0.05, 0.95);
    chosen = Object.assign({}, chosen, rng() < chance ? roll.success : roll.fail);
  }
  return chosen;
}

function resolveEvent(state, event, optionIndex, rng = Math.random) {
  const option = event.options && event.options[optionIndex];
  if (!option) return false;
  const resolved = event.leaderTrialStep !== undefined ? honors.resolveTrial(state, event, option, rng)
    : event.storyId ? stories.resolveChoice(state, event, option) : resolveOption(state, option, rng);
  if (!resolved) return false;
  applyEffect(state, resolved.effect);
  const performance = resolved.performance || 1;
  state.annualPerformance = clamp(state.annualPerformance + performance, -10, 12);
  if (performance >= 3) { state.achievements += 1; state.annualAchievements += 1; }
  else if (performance < 0) { state.faults += 1; state.annualFaults += 1; state.honorYearFaults = (state.honorYearFaults || 0) + 1; }
  const performanceResult = performance >= 3 ? '较优选择，年度绩效 +3' : performance >= 1 ? '一般选择，年度绩效 +1' : '不佳选择，年度绩效 -1';
  let resultText = String(resolved.result || '');
  let recordLine = `${event.title}：${resultText.replace(/[。！？!?]+$/, '')}`;
  // 监督核查的落马骰：无论选哪条，风险到了都可能当场被查出实问题。
  // 中招后本次按"查出问题"的言辞结算，下一件事直接进入终局审讯。
  let fell = false;
  if (event.isInvestigation && !state.ended && !state.pendingInterrogation) {
    const chance = investigationFallChance(state);
    if (rng() < chance) {
      fell = true;
      const risk = network.fallRiskOf(state).risk;
      resultText = INVESTIGATION_FALL_RESULTS[optionIndex] || INVESTIGATION_FALL_RESULTS[0];
      const queued = queueFallOutcome(state, rng);
      if (queued.warning) resultText = '几处材料的核对口径突然收紧。你意识到部分事实可能已被掌握，接下来必须作出一次处置选择。';
      recordLine = `${event.title}：${resultText.replace(/[。！？!?]+$/, '')}（当年落马风险${risk}，核查查出问题的概率${Math.floor(chance * 100)}%）`;
    }
  }
  if (fell) {
    state.lastResult = resultText;
    addRecord(state, `${recordLine}。`);
  } else {
    state.lastResult = `${resultText}（${performanceResult}）`;
    addRecord(state, `${recordLine}，${performanceResult}。`);
  }
  return true;
}

function finishQuarter(state, rng = Math.random) {
  if (state.quarter < 4) { const completedQuarter = state.quarter; state.quarter += 1; state.lastResult = `${['第一季度', '第二季度', '第三季度', '第四季度'][completedQuarter - 1]}事项已完成，年度累计绩效继续保留。`; return { annual: false }; }
  state.quarter = 1;
  const completedYear = state.year;
  state.age += 1; state.year += 1; state.rankYears += 1;
  if (state.relationship !== '单身') state.relationshipYears += 1;
  const partnerAnnual = applyPartnerAnnualEffect(state);
  const compensation = annualCompensation(state);
  const expenseForecast = annualExpenses(state);
  const living = expenseForecast.living;
  let loanPayment = 0;
  const loanDetails = [];
  const loanPayments = annualLoanPayments(state);
  [['houseLoanYears', 'houseAnnualPayment', 'houseLoanBalance', 'houseName', '房贷', loanPayments.houseLoan], ['carLoanYears', 'carAnnualPayment', 'carLoanBalance', 'carName', '车贷', loanPayments.carLoan]].forEach(([yearsKey, annualKey, balanceKey, nameKey, label, payment]) => {
    if (state[yearsKey] > 0) {
      if (payment > 0) {
        loanPayment += payment;
        state[balanceKey] = Math.max(0, state[balanceKey] - payment);
        loanDetails.push(`${label}${payment}元`);
      }
      state[yearsKey] -= 1;
      if (state[yearsKey] <= 0 || state[balanceKey] <= 0) {
        state[yearsKey] = 0; state[balanceKey] = 0; state[annualKey] = 0; state[nameKey] = state[nameKey].replace(/·分期$/, '');
        loanDetails.push(`${label}已结清`);
      }
    }
  });
  const annualExpense = living + loanPayment;
  state.lastAnnualExpense = annualExpense;
  state.money += compensation.salary - living - loanPayment;
  state.providentFund += compensation.providentFund; state.annuity += compensation.annuity;
  state.wealth = clamp(Math.floor(state.money / 10000), 0, 100); state.health = clamp(state.health - 1 - state.children - partnerAnnual.healthCost, 0, 100);
  state.lastPerformance = state.annualPerformance; state.lastAnnualAchievements = state.annualAchievements; state.lastAnnualFaults = state.annualFaults;
  const ability = Math.floor(state.reputation * .30 + state.integrity * .30 + state.network * .20 + state.seniority * .15 + state.health * .05);
  state.review = clamp(Math.floor(state.review * .60 + ability * .40) + state.lastPerformance + Math.max(0, state.rankIndex - 5), 0, 100);
  if (completedYear >= state.honorTrackingStartYear) {
    state.honorHistory = honors.historyOf(state.honorHistory, state.year)
      .filter(item => item.year !== completedYear)
      .concat({ year: completedYear, review: state.review, faults: state.honorYearFaults || 0 }).slice(-5);
  }
  state.honorYearFaults = 0;
  state.annualPerformance = 0; state.annualAchievements = 0; state.annualFaults = 0;
  state.lastReview = state.review >= 85 ? '优秀：工作扎实，群众口碑良好' : state.review >= 70 ? '称职：年度工作稳步推进' : '需改进：建议调整工作节奏';
  let promoted = false; const next = RANKS[state.rankIndex];
  let promotionApplicationText;
  if (!next) promotionApplicationText = '已达到最高职级，本年度无晋升申请';
  else if (state.promotionAppliedYear === completedYear) promotionApplicationText = '本年度晋升申请机会已使用';
  else promotionApplicationText = '本年度晋升申请机会已使用（年度结算自动考察）';
  if (next && state.promotionAppliedYear !== completedYear) {
    state.promotionAppliedYear = completedYear;
    if (isQualified(state, next) && rng() < currentPromotionChance(state, state.rankIndex + 1, completedYear)) {
      state.rankIndex += 1; state.rankYears = 0; state.dutyType = RANKS[state.rankIndex - 1].dutyType; state.previousPosition = state.currentPosition;
      state.currentPosition = state.rankIndex >= 3 ? '待选择具体岗位' : '非领导职级'; promoted = true;
    }
  }
  let promotionText = `年度考核${state.lastReview}（事件绩效${state.lastPerformance >= 0 ? '+' : ''}${state.lastPerformance}，总分${state.review}）${promoted ? `，通过考察晋升至${RANKS[state.rankIndex - 1].name}` : ''}`;
  const promotionBonusPoints = state.promotionAdUsedYear === completedYear ? state.promotionAdWatchCount * 3 : 0;
  if (promotionBonusPoints > 0) promotionText += `，含广告累计加成${promotionBonusPoints}%`;
  promotionText += `；${promotionApplicationText}`;
  const paymentText = loanPayment > 0 ? `，分期还款${loanPayment}元（${loanDetails.join('、')}）` : '';
  // 开销逐项列出：玩家要能对上"钱花在哪"，而不是看到一个总数就完事
  const livingDetailText = expenseForecast.livingDetail
    .map(item => `${item.label}${item.amount >= 0 ? `${item.amount}元` : `省${-item.amount}元`}`)
    .join('、');
  const partnerText = partnerAnnual.text ? `，伴侣相处影响：${partnerAnnual.text}` : '';
  state.lastResult = `${promotionText}。本年度开销${annualExpense}元。`;
  addRecord(state, `${promotionText}。年度工资及津补贴入账${compensation.salary}元（岗位津补贴${compensation.allowance}元），公积金入账${compensation.providentFund}元，职业年金入账${compensation.annuity}元，年度开销${annualExpense}元（生活支出${living}元：${livingDetailText}${paymentText}）${partnerText}。`);
  // 落马判定必须排在退休结局之前：被立案审查的人不可能"正常退休"。
  // 反过来的话，高风险的老年存档只要熬到年龄就能把整条审讯线绕过去，
  // "风险越高越可能落马"就成了一句空话。
  //
  // 命中就挂一个待审讯标记：页面处理完年度结算会立刻把它弹出来，
  // 玩家必须表态，没有绕过去的可能。
  // 注意 chance 为 0 时不要消费随机数，否则会整体挪动随机序列，把别处的可复现性一起带偏。
  const chance = annualFallChance(state);
  const fall = chance > 0 && rng() < chance;
  if (fall) {
    const queued = queueFallOutcome(state, rng);
    return { annual: true, promoted, ending: '', fall: true, warning: queued.warning };
  }
  // 先判定荣誉，再判定退休：退休当年刚好满足条件的存档也应留下称呼。
  const honorAwarded = grantPublicServant(state);
  const leaderAwarded = grantLeader(state);
  const ending = retirementEnding(state);
  if (ending) {
    if (ending === '违纪处分') revokeHonor(state);
    state.ended = true; state.ending = ending; state.retirementWealth = netWealth(state);
    return { annual: true, promoted, ending, fall: false, honor: honorAwarded, leaderHonor: leaderAwarded };
  }
  return { annual: true, promoted, ending: '', fall: false, honor: honorAwarded, leaderHonor: leaderAwarded };
}

function publicServantStatus(state) {
  const source = state || {};
  const atTopRank = Math.floor(Number(source.rankIndex) || 1) >= RANKS.length;
  const rankYears = Math.max(0, Math.floor(Number(source.rankYears) || 0));
  const income = Math.max(0, Math.floor(Number(source.illicitIncome) || 0));
  const integrity = Math.max(0, Math.floor(Number(source.integrity) || 0));
  const yearsEnough = rankYears >= PUBLIC_SERVANT_MIN_RANK_YEARS;
  const incomeOk = income < PUBLIC_SERVANT_MAX_ILLICIT_INCOME;
  const integrityOk = integrity > PUBLIC_SERVANT_MIN_INTEGRITY;
  return {
    title: PUBLIC_SERVANT_TITLE,
    awarded: source.honorTitle === PUBLIC_SERVANT_TITLE,
    honorYear: Math.max(0, Math.floor(Number(source.honorYear) || 0)),
    atTopRank, yearsEnough, incomeOk, integrityOk,
    rankYears, income,
    minRankYears: PUBLIC_SERVANT_MIN_RANK_YEARS,
    maxIllicitIncome: PUBLIC_SERVANT_MAX_ILLICIT_INCOME,
    incomeRuleText: publicServantIncomeText(),
    eligible: atTopRank && yearsEnough && incomeOk && integrityOk && !source.ended && !source.fallDetail && !source.pendingInterrogation,
  };
}

function grantPublicServant(state) {
  if (!state || state.honorTitle === PUBLIC_SERVANT_TITLE) return false;
  if (!publicServantStatus(state).eligible) return false;
  state.honorTitle = PUBLIC_SERVANT_TITLE;
  state.honorYear = Math.max(1, Math.floor(Number(state.year) || 1));
  addRecord(state, `半生不当收入始终${publicServantIncomeText()}，同志们从此称呼你为「${PUBLIC_SERVANT_TITLE}」，说你办事时心里装着老百姓。`);
  return true;
}

function grantLeader(state) {
  if (!state || state.leaderYear || !honors.status(state).eligible) return false;
  state.leaderCertificate = honors.certificateOf(Object.assign({ version: 1 }, state));
  if (!state.leaderCertificate) return false;
  state.leaderYear = state.year;
  addRecord(state, `副国级任满三年、人民公仆满一年，五年考核、跨年经历和统筹考验全部达标，获得「${honors.LEADER_TITLE}」终极荣誉。`);
  return true;
}

function revokeHonor(state) {
  if (!state) return;
  state.honorTitle = '';
  state.honorYear = 0;
  state.leaderYear = 0;
  state.leaderCertificate = null;
}

function retirementEnding(state) {
  if (state.integrity <= 20) return '违纪处分';
  if (state.health < 30) return '健康不足强制退休';
  if (state.age >= (RANKS[state.rankIndex - 1].retirementAge || 65)) return state.rankIndex >= 5 ? '高级岗位退休' : '正常退休';
  return '';
}

function buyAsset(state, type, name, price, years, fullPayment) {
  const amount = fullPayment ? price : Math.floor(price * .20);
  if (state.money < amount) return { ok: false, reason: '现金不足' };
  state.money -= amount;
  const prefix = type === 'house' ? 'house' : 'car';
  state[type === 'house' ? 'hasHouse' : 'hasCar'] = true; state[`${prefix}Value`] = price; state[`${prefix}Name`] = `有${type === 'house' ? '房' : '车'}·${name}${fullPayment ? '' : '·分期'}`;
  if (fullPayment) { state[`${prefix}LoanYears`] = 0; state[`${prefix}LoanBalance`] = 0; state[`${prefix}AnnualPayment`] = 0; }
  else { const principal = price - amount; state[`${prefix}LoanYears`] = years; state[`${prefix}LoanBalance`] = Math.floor(principal * 1.08); state[`${prefix}AnnualPayment`] = Math.ceil(state[`${prefix}LoanBalance`] / years); }
  const assetLabel = type === 'house' ? '房产' : '车辆';
  if (fullPayment) addRecord(state, `全款购置${name}${assetLabel}，现金支出${(price / 10000).toFixed(1)}万元。`);
  else { state.lastResult = '你采用分期方式完成购置，今后每年会自动扣除还款。'; addRecord(state, `分期购置${name}${assetLabel}，首付${(amount / 10000).toFixed(1)}万元，分${years}年偿还。`); }
  return { ok: true };
}

function withdrawProvident(state, amount, label) { const actual = Math.min(Math.floor(amount), Math.floor(state.providentFund)); if (actual <= 0) return false; state.providentFund -= actual; state.money += actual; state.lastResult = `你从公积金账户提取了${label || `${(actual / 10000).toFixed(1)}万元`}，资金已转入现金账户。`; addRecord(state, `提取公积金${(actual / 10000).toFixed(1)}万元，转入现金账户。`); return true; }
function restoreHealth(state, kind, cost, amount) { const field = kind === 'hospital' ? 'lastHospitalYear' : 'lastExerciseYear'; if (state[field] === state.year || state.money < cost) return false; const before = state.health; state.money -= cost; state.health = clamp(state.health + amount, 0, 100); state[field] = state.year; const recovered = state.health - before; const label = kind === 'hospital' ? '医院检查与治疗' : '规律锻炼'; state.lastResult = `${label}完成，健康恢复${recovered}点。`; addRecord(state, `${label}，健康恢复${recovered}点，支出${cost}元。`); return true; }
function focusCareer(state) { state.seniority = clamp(state.seniority + 1, 0, 100); }
function choosePosition(state, name) {
  const position = (POSITION_OPTIONS[state.rankIndex] || []).find(item => item.name === name) || { name };
  state.previousPosition = state.currentPosition === '待选择具体岗位' ? state.previousPosition : state.currentPosition;
  state.currentPosition = position.name;
  state.dutyType = position.level && position.level.includes('岗位') ? '机关岗位' : '领导职务';
  state.positionLevel = position.level || RANKS[state.rankIndex - 1].short;
  applyEffect(state, position.effect);
  state.lastResult = `你履新${position.name}，开始承担新的岗位职责。`;
  addRecord(state, `履新${position.name}（${RANKS[state.rankIndex - 1].name}）。`);
}
function positionAvailable(state, name) {
  const position = (POSITION_OPTIONS[state.rankIndex] || []).find(item => item.name === name) || name;
  return !position.blockedReason && state.integrity >= (position.minIntegrity || 0) && state.achievements >= (position.minAchievements || 0);
}

module.exports = { grantLeader, honorDisplayTitle: honors.displayTitle, leaderStatus: honors.status, RANKS, POSITION_OPTIONS, EXTRA_POSITION_OPTIONS, PARTNER_PROFILES, partnerProfile, partnerPromotionBonus, applyPartnerAnnualEffect, resolveFaultHelp, FAULT_HELP_SUCCESS_CHANCE, newState, normalizeState, addRecord, applyEffect, promotionChance, currentPromotionChance, faultHelpPromotionChance, LEADER_HELP_SUCCESS_LINES, LEADER_HELP_FAILURE_LINES, investigationChance, isQualified, positionAllowance, annualCompensation, annualExpenses, netWealth, startQuarter, resolveEvent, resolveOption, meetsRequirement, commonEventFor, commonEventPoolFor, COMMON_EVENT_POOL, EXTRA_COMMON_EVENTS, EXTRA_POSITION_EVENTS, finishQuarter, retirementEnding, publicServantStatus, grantPublicServant, revokeHonor, publicServantIncomeText, PUBLIC_SERVANT_TITLE, PUBLIC_SERVANT_MIN_RANK_YEARS, PUBLIC_SERVANT_MAX_ILLICIT_INCOME, PUBLIC_SERVANT_MIN_INTEGRITY, buyAsset, withdrawProvident, restoreHealth, focusCareer, choosePosition, positionAvailable, clamp, BURST_EVENTS, RICH_BURST_EVENTS, REVIEW_EVENT, RISK_TRAIL_THRESHOLD, BURST_BASE_CHANCE, ILLICIT_LEDGER_MAX, RANDOM_EVENT_LIMIT, burstChance, burstDue, burstPoolFor, drawBurstEvent, pickBurst, pickFellowFall, resolveBurst, bribeRiskOf, investigationFallChance, annualFallChance, INVESTIGATION_FALL_RESULTS, resolveInterrogation, EVIDENCE_WARNING_CHANCE, SMALL_CONFESSION_LIMIT, DENIAL_NEXT_BRIBE_DISCOVERY_CHANCE, DENIAL_FALL_MULTIPLIER, ESCAPE_METHODS, buildEvidenceWarningEvent, buildEscapeMethodEvent, escapeResultFor, queueFallOutcome, resolveEvidenceWarning, resolveEscapeMethod, network, RANK_EVENT_POOL, RANK_EVENT_RECENT, rankPoolFor, rankEventFor, storySummary: stories.summary };

},
"game/data-full": function(module, exports, require) {
// Generated mechanically from source/main.lua. Keep source data authoritative.
const RANKS = [
  {
    "name": "二级科员",
    "short": "二级科员",
    "dutyType": "职级序列",
    "years": 0,
    "age": 22,
    "review": 60,
    "reputation": 0,
    "network": 0,
    "achievement": 0,
    "faultLimit": 99
  },
  {
    "name": "四级主任科员",
    "short": "四级主任科员",
    "dutyType": "职级序列",
    "years": 1,
    "age": 23,
    "review": 62,
    "reputation": 32,
    "network": 16,
    "achievement": 1,
    "faultLimit": 3
  },
  {
    "name": "乡科级副职（副科级）",
    "short": "副科级",
    "dutyType": "领导职务",
    "years": 2,
    "age": 24,
    "review": 64,
    "reputation": 38,
    "network": 22,
    "achievement": 2,
    "faultLimit": 3
  },
  {
    "name": "乡科级正职（正科级）",
    "short": "正科级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 26,
    "review": 66,
    "reputation": 45,
    "network": 30,
    "achievement": 4,
    "faultLimit": 3
  },
  {
    "name": "县处级副职（副处级）",
    "short": "副处级",
    "dutyType": "领导职务",
    "years": 4,
    "age": 29,
    "review": 68,
    "reputation": 52,
    "network": 38,
    "achievement": 6,
    "faultLimit": 2
  },
  {
    "name": "县处级正职（正处级）",
    "short": "正处级",
    "dutyType": "领导职务",
    "years": 5,
    "age": 33,
    "review": 70,
    "reputation": 60,
    "network": 47,
    "achievement": 8,
    "faultLimit": 2
  },
  {
    "name": "厅局级副职（副厅级）",
    "short": "副厅级",
    "dutyType": "领导职务",
    "years": 6,
    "age": 38,
    "review": 72,
    "reputation": 68,
    "network": 56,
    "achievement": 10,
    "faultLimit": 2
  },
  {
    "name": "厅局级正职（正厅级）",
    "short": "正厅级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 44,
    "review": 74,
    "reputation": 73,
    "network": 62,
    "achievement": 12,
    "faultLimit": 1
  },
  {
    "name": "省部级副职（副部级）",
    "short": "副部级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 50,
    "retirementAge": 63,
    "review": 76,
    "reputation": 78,
    "network": 68,
    "achievement": 14,
    "faultLimit": 1
  },
  {
    "name": "省部级正职（正部级）",
    "short": "正部级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 55,
    "retirementAge": 65,
    "review": 78,
    "reputation": 83,
    "network": 74,
    "achievement": 16,
    "faultLimit": 1
  },
  {
    "name": "国家级副职（副国级）",
    "short": "副国级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 60,
    "review": 80,
    "reputation": 88,
    "network": 80,
    "achievement": 18,
    "faultLimit": 0
  }
];
const POSITION_OPTIONS = {
  "3": [
    {
      "group": "镇党委副书记岗位",
      "name": "镇党委专职副书记",
      "level": "副科级",
      "description": "协助党委书记抓党的建设、基层治理和综合协调，不兼任政府主官。",
      "effect": {
        "network": 3,
        "seniority": 2,
        "reputation": 1
      }
    },
    {
      "group": "镇党委副书记岗位",
      "name": "镇党委副书记、政法委书记",
      "level": "副科级",
      "description": "负责平安建设、信访维稳、矛盾化解和政法协调工作。",
      "effect": {
        "network": 2,
        "integrity": 2,
        "reputation": 2,
        "health": -1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、组织委员",
      "level": "副科级",
      "description": "负责基层党组织、干部管理、党员教育和人才工作。",
      "effect": {
        "network": 3,
        "seniority": 2,
        "integrity": 1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、派出所所长",
      "level": "副科级配置",
      "description": "负责辖区治安、公共安全和基层警务协同，通常具有公安机关任职经历。",
      "minIntegrity": 80,
      "effect": {
        "network": 3,
        "integrity": 2,
        "health": -2
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、宣传委员",
      "level": "副科级",
      "description": "负责宣传思想、意识形态、精神文明和公共文化工作。",
      "effect": {
        "reputation": 3,
        "network": 1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、统战委员",
      "level": "副科级",
      "description": "负责统一战线、民族宗教、商会和乡贤联络工作。",
      "effect": {
        "network": 4,
        "reputation": 1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、人武部部长",
      "level": "副科级",
      "description": "负责基层武装、民兵预备役、征兵和国防动员工作。",
      "effect": {
        "seniority": 3,
        "integrity": 2,
        "health": -1
      }
    },
    {
      "group": "镇纪委和政府岗位",
      "name": "镇党委委员、纪委书记",
      "level": "副科级",
      "description": "负责镇纪委工作、监督执纪、廉政教育和作风建设。",
      "minIntegrity": 75,
      "effect": {
        "integrity": 4,
        "reputation": 1
      }
    },
    {
      "group": "镇纪委和政府岗位",
      "name": "副镇长（明确分管领域）",
      "level": "副科级",
      "description": "根据分工负责农业农村、民政、项目建设或安全生产等领域。",
      "effect": {
        "reputation": 2,
        "seniority": 2
      }
    }
  ],
  "4": [
    {
      "group": "乡镇党政主官",
      "name": "镇党委书记",
      "level": "正科级",
      "description": "主持镇党委全面工作，统筹党建、发展、治理和干部队伍建设。",
      "effect": {
        "reputation": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "group": "乡镇党政主官",
      "name": "镇党委副书记、镇长",
      "level": "正科级",
      "description": "主持镇政府全面工作，在镇党委领导下统筹经济运行、民生和行政事务。",
      "effect": {
        "seniority": 4,
        "network": 2,
        "health": -2
      }
    },
    {
      "group": "县直正科岗位",
      "name": "县委办公室常务副主任",
      "level": "正科级",
      "description": "负责县委机关日常运转、文稿、信息和督查协调。",
      "effect": {
        "seniority": 3,
        "network": 3
      }
    },
    {
      "group": "县直正科岗位",
      "name": "县政府办公室主任",
      "level": "正科级",
      "description": "主持县政府办公室日常工作，承担综合协调、政务和督查职责。",
      "effect": {
        "seniority": 3,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "县政府部门正职",
      "name": "县民政局局长",
      "level": "正科级",
      "description": "主持民政工作，负责社会救助、养老服务和基层政权建设。",
      "effect": {
        "reputation": 4,
        "integrity": 1
      }
    },
    {
      "group": "县政府部门正职",
      "name": "县工业和信息化局局长",
      "level": "正科级",
      "description": "负责工业运行、企业服务、数字化和产业协调。",
      "effect": {
        "network": 3,
        "seniority": 3
      }
    },
    {
      "group": "县政府部门正职",
      "name": "县水利局局长",
      "level": "正科级",
      "description": "负责水利建设、防汛抗旱和水资源管理。",
      "effect": {
        "reputation": 3,
        "seniority": 2,
        "health": -1
      }
    },
    {
      "group": "驻县和企事业岗位",
      "name": "县税务局主要负责人",
      "level": "正科级配置",
      "description": "属于垂直管理系统，负责税费征管服务和部门协同。",
      "minIntegrity": 75,
      "effect": {
        "integrity": 3,
        "seniority": 2
      }
    },
    {
      "group": "驻县和企事业岗位",
      "name": "县烟草专卖局主要负责人",
      "level": "正科级配置",
      "description": "属于行业垂直管理单位，并非县政府组成部门。",
      "effect": {
        "network": 3,
        "reputation": 2
      }
    },
    {
      "group": "驻县和企事业岗位",
      "name": "县供电企业主要负责人",
      "level": "正科级相当岗位",
      "description": "属于供电企业管理岗位，并非公务员行政职务。",
      "effect": {
        "network": 3,
        "reputation": 2
      }
    }
  ],
  "5": [
    {
      "group": "重点镇高配岗位",
      "name": "县委常委、重点镇党委书记",
      "level": "副处级高配",
      "description": "经济强镇、人口大镇或城关重镇的特殊高配岗位；是否进入县委常委由地方机构设置决定。",
      "minAchievements": 8,
      "effect": {
        "reputation": 4,
        "network": 4,
        "seniority": 2,
        "health": -2
      }
    },
    {
      "group": "县委副书记岗位",
      "name": "县委专职副书记",
      "level": "副处级",
      "description": "协助县委书记抓党的建设、干部队伍和县委日常协调。",
      "minAchievements": 8,
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    },
    {
      "group": "县委副书记岗位",
      "name": "县委副书记、政法委书记",
      "level": "副处级",
      "description": "统筹政法、平安建设、信访和基层社会治理工作。",
      "minAchievements": 8,
      "minIntegrity": 75,
      "effect": {
        "network": 3,
        "integrity": 3,
        "reputation": 2,
        "health": -1
      }
    },
    {
      "group": "县委常委岗位",
      "name": "县委常委、组织部部长",
      "level": "副处级",
      "description": "负责县域干部队伍、基层组织建设和人才工作。",
      "minAchievements": 8,
      "minIntegrity": 75,
      "effect": {
        "network": 4,
        "seniority": 3,
        "integrity": 1
      }
    },
    {
      "group": "县委常委岗位",
      "name": "县委常委、宣传部部长",
      "level": "副处级",
      "description": "负责宣传思想、意识形态、新闻舆情和文化建设。",
      "minAchievements": 8,
      "effect": {
        "reputation": 4,
        "network": 2
      }
    },
    {
      "group": "县委常委岗位",
      "name": "县委常委、县委办公室主任",
      "level": "副处级",
      "description": "负责县委机关运转、重大文稿、督查和综合协调。",
      "minAchievements": 8,
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县委常委、县政府党组副书记、常务副县长",
      "level": "副处级",
      "description": "协助县长负责县政府常务工作，通常分管发改、财政、应急和重大项目。",
      "minAchievements": 8,
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、副县长（分管农业农村）",
      "level": "副处级",
      "description": "分管农业农村、乡村振兴、水利和相关重点项目。",
      "effect": {
        "reputation": 3,
        "network": 2,
        "health": -1
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、副县长（分管民政教育）",
      "level": "副处级",
      "description": "分管民政、教育、卫生健康和社会事业。",
      "effect": {
        "reputation": 4,
        "integrity": 1,
        "health": -1
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、副县长、公安局局长",
      "level": "副处级",
      "description": "分管公安、司法和公共安全，并主持县公安局全面工作。",
      "minIntegrity": 80,
      "effect": {
        "network": 3,
        "integrity": 3,
        "health": -2
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、县政府办公室主任",
      "level": "副处级高配",
      "description": "特殊高配安排，参与县政府班子工作并主持县政府办公室。",
      "minAchievements": 8,
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    }
  ],
  "6": [
    {
      "group": "县级党政主官",
      "name": "县委书记",
      "level": "正处级",
      "description": "主持县委全面工作，对县域发展、党的建设和基层治理负总责。",
      "minAchievements": 10,
      "effect": {
        "reputation": 5,
        "network": 4,
        "health": -2
      }
    },
    {
      "group": "县级党政主官",
      "name": "县政府党组书记、县长（县委副书记）",
      "level": "正处级",
      "description": "主持县政府全面工作，并以县委副书记身份参与县委领导。",
      "minAchievements": 9,
      "effect": {
        "seniority": 5,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "市级党政机关正处岗位",
      "name": "四线城市市委副秘书长",
      "level": "正处级",
      "description": "协助市委领导处理综合协调、督查和重要文稿等工作。",
      "effect": {
        "seniority": 3,
        "network": 3
      }
    },
    {
      "group": "市级党政机关正处岗位",
      "name": "四线城市市政府副秘书长",
      "level": "正处级",
      "description": "协助市政府领导开展综合协调、政务督查和重点事项调度。",
      "effect": {
        "seniority": 3,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "市级部门正职",
      "name": "四线城市市直部门主要负责人",
      "level": "正处级",
      "description": "主持市级政府组成部门或市级党委工作部门的全面工作。",
      "effect": {
        "seniority": 3,
        "network": 2,
        "reputation": 2
      }
    },
    {
      "group": "市级部门正职",
      "name": "四线城市市政府办公室主任",
      "level": "正处级",
      "description": "主持市政府办公室工作，承担全市政府系统综合协调。",
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "市辖区党政主官",
      "name": "市辖区委书记",
      "level": "正处级",
      "description": "主持市辖区党委全面工作，统筹城区党建、发展和治理。",
      "minAchievements": 10,
      "effect": {
        "reputation": 4,
        "network": 4,
        "health": -2
      }
    },
    {
      "group": "市辖区党政主官",
      "name": "市辖区政府党组书记、区长（区委副书记）",
      "level": "正处级",
      "description": "主持市辖区政府全面工作，并以区委副书记身份参与区委领导。",
      "minAchievements": 9,
      "effect": {
        "seniority": 4,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委副书记、政法委书记",
      "level": "正处级岗位",
      "description": "负责城区政法、信访、平安建设和社会治理工作。",
      "minAchievements": 8,
      "effect": {
        "network": 3,
        "integrity": 2,
        "reputation": 2
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委常委、组织部部长",
      "level": "正处级岗位",
      "description": "负责城区干部队伍、基层组织和人才工作。",
      "minAchievements": 8,
      "effect": {
        "network": 4,
        "seniority": 2,
        "integrity": 1
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委常委、宣传部部长",
      "level": "正处级岗位",
      "description": "负责城区宣传思想、意识形态和文化建设工作。",
      "minAchievements": 8,
      "effect": {
        "reputation": 4,
        "network": 2
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委常委、区委办公室主任",
      "level": "正处级岗位",
      "description": "负责城区党委机关运转、文稿、督查和综合协调。",
      "minAchievements": 8,
      "effect": {
        "seniority": 3,
        "network": 3
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府党组副书记、常务副区长",
      "level": "正处级岗位",
      "description": "协助区长负责政府常务工作，分管发改、财政、应急和重点项目。",
      "minAchievements": 8,
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府党组成员、副区长（分管民生）",
      "level": "正处级岗位",
      "description": "分管教育、民政、卫生健康、住房等公共服务领域。",
      "effect": {
        "reputation": 3,
        "health": -1
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府党组成员、副区长、公安分局局长",
      "level": "正处级岗位",
      "description": "分管公共安全并主持城区公安分局全面工作，通常需要公安系统经历。",
      "minIntegrity": 80,
      "effect": {
        "network": 3,
        "integrity": 3,
        "health": -2
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府办公室主任",
      "level": "正处级岗位",
      "description": "主持区政府办公室日常工作，负责政务运转和综合协调。",
      "effect": {
        "seniority": 3,
        "network": 2,
        "health": -1
      }
    }
  ],
  "7": [
    {
      "group": "县级主官高配",
      "name": "市委常委、县委书记",
      "level": "副厅级高配",
      "description": "少数重要县（市、区）的特殊高配岗位，兼任设区市市委常委。",
      "minAchievements": 14,
      "effect": {
        "reputation": 5,
        "network": 5,
        "health": -2
      }
    },
    {
      "group": "市政府领导岗位",
      "name": "四线城市副市长（分管民生）",
      "level": "副厅级",
      "description": "分管教育、民政、卫生健康、住房等公共服务。",
      "effect": {
        "reputation": 4,
        "seniority": 2,
        "health": -1
      }
    },
    {
      "group": "市政府领导岗位",
      "name": "四线城市副市长（分管产业）",
      "level": "副厅级",
      "description": "分管工业、招商、园区、能源和重大项目。",
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    },
    {
      "group": "市委常委岗位",
      "name": "市委常委、组织部部长",
      "level": "副厅级",
      "description": "负责全市干部队伍、基层组织建设和人才工作。",
      "minAchievements": 12,
      "effect": {
        "network": 4,
        "seniority": 3,
        "integrity": 1
      }
    },
    {
      "group": "市委常委岗位",
      "name": "市委常委、纪委书记",
      "level": "副厅级",
      "description": "负责监督执纪和党风廉政建设。",
      "minAchievements": 12,
      "minIntegrity": 80,
      "effect": {
        "integrity": 5,
        "reputation": 2
      }
    },
    {
      "group": "市委常委岗位",
      "name": "市委常委、宣传部部长",
      "level": "副厅级",
      "description": "负责全市宣传思想、意识形态和文化建设。",
      "minAchievements": 12,
      "effect": {
        "reputation": 4,
        "network": 2
      }
    }
  ],
  "8": [
    {
      "group": "市级党政主官",
      "name": "四线城市市委书记",
      "level": "正厅级",
      "description": "主持城市党委全面工作与发展布局。",
      "minAchievements": 14,
      "effect": {
        "reputation": 4,
        "network": 4,
        "health": -2
      }
    },
    {
      "group": "市级党政主官",
      "name": "四线城市市长",
      "level": "正厅级",
      "description": "主持市政府全面工作与公共服务。",
      "minAchievements": 13,
      "effect": {
        "seniority": 4,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "市委领导岗位",
      "name": "市委副书记",
      "level": "正厅级",
      "description": "协助市委书记统筹党建、干部和综合协调。",
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    },
    {
      "group": "省政府组成部门正职",
      "name": "省公安厅党委书记、厅长",
      "level": "正厅级",
      "description": "主持省公安厅全面工作，统筹全省公共安全、社会治安和公安队伍建设。",
      "minAchievements": 14,
      "minIntegrity": 85,
      "effect": {
        "integrity": 4,
        "network": 4,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "省直部门正职",
      "name": "省直部门主要负责人",
      "level": "正厅级",
      "description": "主持省级部门行业管理与政策落实。",
      "effect": {
        "network": 3,
        "seniority": 3
      }
    },
    {
      "group": "省直部门领导岗位",
      "name": "省直部门党组副书记",
      "level": "正厅级配置",
      "description": "协助主要负责人推进省级部门重点工作。",
      "effect": {
        "network": 3,
        "integrity": 2
      }
    }
  ],
  "9": [
    {
      "name": "副省长（分管民生）",
      "description": "协助分管省域公共服务和社会事业。",
      "effect": {
        "network": 3,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "name": "副省长（分管产业）",
      "description": "协助分管产业发展、重大项目和区域协调。",
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -2
      }
    },
    {
      "name": "省委常委、组织部部长",
      "description": "参与省级重大决策，负责干部和组织工作。",
      "minAchievements": 16,
      "effect": {
        "network": 5,
        "seniority": 3,
        "integrity": 1
      }
    },
    {
      "name": "省委常委、宣传部部长",
      "description": "负责省级宣传思想和文化建设。",
      "minAchievements": 16,
      "effect": {
        "reputation": 5,
        "network": 3
      }
    },
    {
      "name": "国家部委副职",
      "description": "分管国家部委专项工作与政策执行。",
      "effect": {
        "network": 3,
        "seniority": 2
      }
    }
  ],
  "10": [
    {
      "name": "省级主要负责人",
      "description": "主持省级党委或政府全面工作。",
      "minAchievements": 18,
      "effect": {
        "reputation": 5,
        "network": 4,
        "health": -2
      }
    },
    {
      "name": "省委副书记",
      "description": "协助主要负责人统筹省级党建和发展工作。",
      "minAchievements": 17,
      "effect": {
        "network": 5,
        "seniority": 4,
        "health": -2
      }
    },
    {
      "name": "国家部委主要负责人",
      "description": "主持国家部委全面工作和行业发展。",
      "effect": {
        "seniority": 4,
        "network": 2,
        "health": -1
      }
    },
    {
      "name": "国家部委党组副书记",
      "description": "协助主要负责人推进国家层面重点任务。",
      "effect": {
        "network": 4,
        "integrity": 2
      }
    }
  ],
  "11": [
    {
      "name": "国家级重要领导岗位",
      "description": "参与国家层面的重要决策与综合协调。",
      "effect": {
        "reputation": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "name": "国家机构副职",
      "description": "承担国家机构重要领导与统筹职责。",
      "effect": {
        "seniority": 4,
        "integrity": 2,
        "health": -1
      }
    },
    {
      "name": "国家级综合协调岗位",
      "description": "承担跨部门、跨区域的综合协调任务。",
      "effect": {
        "network": 5,
        "seniority": 3,
        "health": -2
      }
    }
  ]
};
const EVENTS = [
  {
    "title": "汛期排查",
    "scene": "连续降雨后，村干部报告一处山塘水位异常。镇里需要有人带队巡查。",
    "options": [
      {
        "text": "立即排查并建立闭环整改台账",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "health": -2,
          "network": 2
        },
        "result": "隐患被及时处置，完整台账也为后续巡查提供了依据。"
      },
      {
        "text": "协调村级力量先设置警示区域",
        "performance": 1,
        "effect": {
          "network": 3,
          "reputation": 1
        },
        "result": "现场得到基本控制，后续仍需持续跟进。"
      },
      {
        "text": "仅转发通知，等待村里自行处理",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "信息传达了，但处置不够主动，你在复盘中作出改进。"
      }
    ]
  },
  {
    "title": "群众办事",
    "scene": "一位老人来便民服务中心咨询社保事项，材料缺了一份，老人显得有些着急。",
    "options": [
      {
        "text": "核对材料并联系村级代办员协助",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "network": 2
        },
        "result": "老人顺利完成办理，窗口与村级代办衔接也更加顺畅。"
      },
      {
        "text": "耐心列出补充材料和办理步骤",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "解释清晰规范，老人知道了下一步该怎么做。"
      },
      {
        "text": "简单告知材料不全，让其下次再来",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "health": 1
        },
        "result": "流程没有出错，但服务温度和主动性不足。"
      }
    ]
  },
  {
    "title": "产业走访",
    "scene": "本地合作社准备扩大规模，希望镇里帮助对接技术和销售渠道。",
    "options": [
      {
        "text": "调研经营情况并对接专业部门",
        "performance": 3,
        "effect": {
          "network": 5,
          "reputation": 3,
          "wealth": 1000
        },
        "result": "专业服务精准落地，合作社的发展计划更稳健。"
      },
      {
        "text": "整理需求后提供公开政策清单",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "合作社获得了实用信息，开始按流程准备材料。"
      },
      {
        "text": "口头答应支持但没有继续跟进",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "network": -1
        },
        "result": "事项推进缓慢，你认识到承诺必须配套落实。"
      }
    ]
  },
  {
    "title": "年度材料",
    "scene": "临近年末，几项重点工作需要汇总。时间紧，但数据质量比速度更重要。",
    "options": [
      {
        "text": "逐项核验数据并按时提交",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "health": -2,
          "seniority": 2
        },
        "result": "材料经得起复核，年度工作留下了可靠底稿。"
      },
      {
        "text": "与同事分工汇总并统一口径",
        "performance": 1,
        "effect": {
          "network": 3,
          "reputation": 2
        },
        "result": "材料按时完成，协作流程也更加顺畅。"
      },
      {
        "text": "沿用旧数据，只修改日期和标题",
        "performance": -1,
        "effect": {
          "reputation": -3,
          "integrity": -1
        },
        "result": "复核时发现了偏差，你及时更正并吸取教训。"
      }
    ]
  },
  {
    "title": "基层调研",
    "scene": "镇里准备更新公共服务设施，需要听取不同村组的真实意见。",
    "options": [
      {
        "text": "分类走访并形成需求优先级清单",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "health": -2,
          "seniority": 2
        },
        "result": "一手信息让方案更加贴近实际，有限资金也用在了关键处。"
      },
      {
        "text": "召开代表座谈会集中收集建议",
        "performance": 1,
        "effect": {
          "network": 3,
          "reputation": 2
        },
        "result": "座谈高效完成，收集到了主要共性需求。"
      },
      {
        "text": "直接参考往年方案进行调整",
        "performance": -1,
        "effect": {
          "health": 1,
          "reputation": -2
        },
        "result": "方案推进较快，但部分新需求没有被及时发现。"
      }
    ]
  },
  {
    "title": "同事协作",
    "scene": "一项跨部门任务临时调整分工，新同事对流程还不熟悉。",
    "options": [
      {
        "text": "共享模板并共同检查关键节点",
        "performance": 3,
        "effect": {
          "network": 5,
          "reputation": 2
        },
        "result": "新同事迅速进入状态，团队按时高质量完成任务。"
      },
      {
        "text": "完成自己的部分并提醒截止时间",
        "performance": 1,
        "effect": {
          "seniority": 1,
          "integrity": 1
        },
        "result": "本职任务稳妥完成，整体进度基本可控。"
      },
      {
        "text": "只顾自己的部分，不回应协作请求",
        "performance": -1,
        "effect": {
          "network": -3,
          "reputation": -1
        },
        "result": "跨部门衔接出现延误，你开始重视主动沟通。"
      }
    ]
  },
  {
    "title": "矛盾调解",
    "scene": "两个村民因宅基地边界产生争议，双方情绪激动，希望镇里帮助协调。",
    "options": [
      {
        "text": "查阅资料、现场测量并组织协商",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "integrity": 2,
          "health": -2
        },
        "result": "事实依据清晰，双方最终达成了书面调解意见。"
      },
      {
        "text": "先分别听取诉求，再约定集中协商",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "network": 1
        },
        "result": "双方情绪得到缓和，为后续处理创造了条件。"
      },
      {
        "text": "让双方自行商量，暂不介入",
        "performance": -1,
        "effect": {
          "reputation": -3
        },
        "result": "矛盾没有及时化解，你随后补做了走访和协调。"
      }
    ]
  },
  {
    "title": "项目验收",
    "scene": "一项村级道路改造工程准备验收，现场仍有少量细节需要完善。",
    "options": [
      {
        "text": "按清单逐项核验并限期整改",
        "performance": 3,
        "effect": {
          "integrity": 4,
          "reputation": 3,
          "health": -1
        },
        "result": "整改完成后项目顺利验收，工程质量得到保障。"
      },
      {
        "text": "记录问题并安排后续复查",
        "performance": 1,
        "effect": {
          "integrity": 2,
          "seniority": 1
        },
        "result": "验收程序稳步推进，遗留问题进入跟踪台账。"
      },
      {
        "text": "认为问题不大，直接签字通过",
        "performance": -1,
        "effect": {
          "integrity": -4,
          "reputation": -2
        },
        "result": "复查发现遗漏，你主动纠正并重新完善流程。"
      }
    ]
  },
  {
    "title": "森林防火",
    "scene": "清明临近，连续干燥天气使森林火险等级升高，重点区域需要加强巡防。",
    "options": [
      {
        "text": "划分网格、安排巡查并宣传替代祭扫",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "network": 3,
          "health": -2
        },
        "result": "巡防和宣传同步开展，重点时段保持了安全平稳。"
      },
      {
        "text": "在主要入口增设提醒和值守",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "health": -1
        },
        "result": "关键区域得到管控，基本完成了防火任务。"
      },
      {
        "text": "只在工作群转发防火通知",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "宣传覆盖有限，你随后补充了线下巡查。"
      }
    ]
  },
  {
    "title": "校园周边治理",
    "scene": "群众反映学校放学时段车辆拥堵，存在一定安全隐患。",
    "options": [
      {
        "text": "联合学校和交管力量制定分流方案",
        "performance": 3,
        "effect": {
          "network": 4,
          "reputation": 4
        },
        "result": "错峰、引导和临时停车区同步启用，秩序明显改善。"
      },
      {
        "text": "安排志愿者在高峰时段引导",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "network": 1
        },
        "result": "拥堵有所缓解，后续还需完善长效方案。"
      },
      {
        "text": "认为只是短时拥堵，暂不处理",
        "performance": -1,
        "effect": {
          "reputation": -3
        },
        "result": "问题持续存在，你随后重新组织了现场调研。"
      }
    ]
  },
  {
    "title": "困难家庭走访",
    "scene": "入冬前，镇里需要核实一户困难家庭的生活保障和住房安全情况。",
    "options": [
      {
        "text": "入户核实并协调多项保障政策",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "network": 2,
          "health": -1
        },
        "result": "保障措施精准落实，家庭的过冬问题得到妥善解决。"
      },
      {
        "text": "电话核实情况并提醒准备材料",
        "performance": 1,
        "effect": {
          "reputation": 1,
          "seniority": 1
        },
        "result": "基本情况得到确认，后续进入常规办理流程。"
      },
      {
        "text": "仅依据旧台账直接上报",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "integrity": -1
        },
        "result": "信息更新不够及时，你随后完成了补充核查。"
      }
    ]
  },
  {
    "title": "政务公开",
    "scene": "一项惠民项目即将启动，需要向群众公开办理条件、流程和监督方式。",
    "options": [
      {
        "text": "制作清晰指南并线上线下同步公开",
        "performance": 3,
        "effect": {
          "integrity": 3,
          "reputation": 4,
          "network": 1
        },
        "result": "群众获取信息更加便利，项目推进公开透明。"
      },
      {
        "text": "在公开栏张贴正式通知",
        "performance": 1,
        "effect": {
          "integrity": 2,
          "reputation": 1
        },
        "result": "公开程序规范完成，主要信息得到发布。"
      },
      {
        "text": "等群众来咨询时再逐一解释",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "信息触达不足，你随后补充了公开渠道。"
      }
    ]
  },
  {
    "title": "季度例会",
    "scene": "季度工作例会上，各村居汇报了近期进展，其中一项民生事项需要协调解决。",
    "options": [
      {
        "text": "梳理问题清单并明确责任时限",
        "performance": 3,
        "effect": {
          "seniority": 2,
          "reputation": 3
        },
        "result": "问题被逐项分解，后续责任和时间节点清晰可查。"
      },
      {
        "text": "记录重点事项，会后分别沟通",
        "performance": 1,
        "effect": {
          "network": 2,
          "reputation": 1
        },
        "result": "会议顺利结束，重点事项进入跟踪范围。"
      },
      {
        "text": "只听取汇报，不形成后续安排",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "seniority": -1
        },
        "result": "问题缺少闭环，你在复盘中补充了跟踪机制。"
      }
    ]
  },
  {
    "title": "政策宣传",
    "scene": "一项新的公共服务政策开始实施，需要让群众了解申请条件和办理流程。",
    "options": [
      {
        "text": "制作易懂说明并开展现场答疑",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "network": 2
        },
        "result": "群众准确理解政策，咨询和办理更加顺畅。"
      },
      {
        "text": "按统一模板发布公告",
        "performance": 1,
        "effect": {
          "integrity": 1,
          "reputation": 1
        },
        "result": "公告规范发布，基本完成了政策告知。"
      },
      {
        "text": "等群众自行查找政策原文",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "政策触达不够充分，你随后补做了说明。"
      }
    ]
  },
  {
    "title": "季度复盘",
    "scene": "季度工作进入复盘阶段，需要从完成情况、群众反馈和后续安排三个方面总结。",
    "options": [
      {
        "text": "用数据和案例形成改进清单",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "reputation": 2
        },
        "result": "复盘不回避问题，也为下一季度留下了可执行的改进事项。"
      },
      {
        "text": "按任务完成情况整理总结",
        "performance": 1,
        "effect": {
          "seniority": 1
        },
        "result": "总结按时提交，基本反映了季度工作进展。"
      },
      {
        "text": "只罗列成绩，不记录困难",
        "performance": -1,
        "effect": {
          "integrity": -1,
          "reputation": -1
        },
        "result": "总结不够完整，你补充了风险和困难记录。"
      }
    ]
  },
  {
    "title": "应急值守",
    "scene": "节假日前后工作安排较多，值守和信息报送需要保持准确、及时。",
    "options": [
      {
        "text": "提前排班并核对联络和值守流程",
        "performance": 3,
        "effect": {
          "integrity": 3,
          "network": 2,
          "health": -1
        },
        "result": "值守衔接顺畅，信息报送保持及时准确。"
      },
      {
        "text": "按要求安排人员轮流值守",
        "performance": 1,
        "effect": {
          "integrity": 1,
          "seniority": 1
        },
        "result": "值守任务正常完成，基本满足工作要求。"
      },
      {
        "text": "临近假期才临时通知",
        "performance": -1,
        "effect": {
          "network": -2,
          "reputation": -1
        },
        "result": "安排较为被动，你随后完善了值守预案。"
      }
    ]
  }
];
const POSITION_EVENTS = {
  "grassroots": {
    "title": "基层事项 · 乡镇日常服务",
    "scene": "你在基层窗口接到群众关于社保、低保或证明材料的咨询，需要在不增加群众跑腿的前提下讲清流程。",
    "options": [
      {
        "text": "核对材料并联系村级代办员协助",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "network": 2
        },
        "result": "群众顺利完成办理，窗口与村级代办衔接更加顺畅。"
      },
      {
        "text": "耐心列出补充材料和办理步骤",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "解释清晰规范，群众知道了下一步办理路径。"
      },
      {
        "text": "简单告知材料不全，让群众下次再来",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "流程没有出错，但服务主动性不足。"
      }
    ]
  },
  "discipline": {
    "title": "岗位专项 · 监督规范",
    "scene": "你在当前岗位任职期间，发现一项内部流程记录不够完整，需要规范整改。",
    "options": [
      {
        "text": "核实情况、完善制度并组织警示教育",
        "performance": 3,
        "effect": {
          "integrity": 4,
          "reputation": 2
        },
        "result": "问题被规范整改，制度执行和廉政教育同步加强。"
      },
      {
        "text": "提醒相关人员补齐记录",
        "performance": 1,
        "effect": {
          "integrity": 2
        },
        "result": "记录得到补充，基本完成了规范要求。"
      },
      {
        "text": "认为影响不大，暂不处理",
        "performance": -1,
        "effect": {
          "integrity": -3,
          "reputation": -1
        },
        "result": "后续检查暴露了问题，你及时补做整改。"
      }
    ]
  },
  "organization": {
    "title": "岗位专项 · 队伍建设",
    "scene": "基层队伍需要补充年轻力量，你负责完善培养和岗位实践方案。",
    "options": [
      {
        "text": "调研需求并建立公开培养计划",
        "performance": 3,
        "effect": {
          "network": 4,
          "seniority": 2
        },
        "result": "培养计划公开务实，年轻干部获得了清晰成长路径。"
      },
      {
        "text": "沿用现有轮岗方案并定期复盘",
        "performance": 1,
        "effect": {
          "network": 2,
          "seniority": 1
        },
        "result": "轮岗工作平稳推进，基本达到培养目的。"
      },
      {
        "text": "只安排临时任务，没有长期计划",
        "performance": -1,
        "effect": {
          "network": -2,
          "reputation": -1
        },
        "result": "培养效果不够稳定，你随后补充了长期方案。"
      }
    ]
  },
  "executive": {
    "title": "岗位专项 · 综合治理",
    "scene": "辖区内多项民生工程同时推进，需要你统筹进度、质量和群众沟通。",
    "options": [
      {
        "text": "建立联合调度机制并公开进度",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "network": 3,
          "health": -1
        },
        "result": "项目协同高效，群众能够及时了解工程安排。"
      },
      {
        "text": "按项目分别推进并定期汇总",
        "performance": 1,
        "effect": {
          "seniority": 2,
          "reputation": 1
        },
        "result": "各项目基本按计划推进，协调成本略高。"
      },
      {
        "text": "优先追求进度，暂缓群众沟通",
        "performance": -1,
        "effect": {
          "reputation": -3,
          "health": 1
        },
        "result": "沟通不足产生了误解，你随后进行了集中说明。"
      }
    ]
  },
  "department": {
    "title": "岗位专项 · 行业管理",
    "scene": "上级部署一项行业专项行动，需要结合本地实际制定可执行方案。",
    "options": [
      {
        "text": "开展数据分析并细化责任清单",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "reputation": 2
        },
        "result": "方案目标清晰、责任明确，专项行动取得实效。"
      },
      {
        "text": "参照上级方案调整后执行",
        "performance": 1,
        "effect": {
          "seniority": 1,
          "integrity": 1
        },
        "result": "任务规范推进，完成了主要工作要求。"
      },
      {
        "text": "直接照搬方案，不做本地评估",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "部分措施不够适用，你随后进行了针对性修订。"
      }
    ]
  },
  "city": {
    "title": "岗位专项 · 城市统筹",
    "scene": "城市发展面临产业、交通和公共服务协同问题，需要形成跨区域统筹方案。",
    "options": [
      {
        "text": "组织多部门调研并分阶段推进",
        "performance": 3,
        "effect": {
          "network": 4,
          "reputation": 3,
          "health": -1
        },
        "result": "统筹方案兼顾发展与民生，阶段目标稳步落地。"
      },
      {
        "text": "先解决最迫切的单项问题",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "seniority": 1
        },
        "result": "重点问题得到缓解，系统方案仍需继续完善。"
      },
      {
        "text": "各部门自行推进，减少协调环节",
        "performance": -1,
        "effect": {
          "network": -3,
          "reputation": -1
        },
        "result": "部门间出现衔接偏差，你重新建立了协调机制。"
      }
    ]
  },
  "national": {
    "title": "岗位专项 · 跨区域协调",
    "scene": "一项跨区域公共服务政策需要统筹不同地区的实际情况和实施节奏。",
    "options": [
      {
        "text": "充分论证并设置分层实施机制",
        "performance": 3,
        "effect": {
          "integrity": 3,
          "network": 4,
          "seniority": 2
        },
        "result": "政策兼顾统一目标与地区差异，实施过程平稳有序。"
      },
      {
        "text": "先行试点，再根据反馈优化",
        "performance": 1,
        "effect": {
          "seniority": 2,
          "reputation": 1
        },
        "result": "试点积累了经验，为后续推广提供了参考。"
      },
      {
        "text": "统一要求立即实施，不留调整空间",
        "performance": -1,
        "effect": {
          "reputation": -3,
          "network": -2
        },
        "result": "部分地区执行困难，你随后增加了配套措施。"
      }
    ]
  },
  "county_party": {
    "title": "岗位专项 · 县委班子运转",
    "scene": "你在当前岗位分管县委系统工作，县域重点任务进入集中推进阶段。既要落实县委决策，也要处理班子协同和基层反馈。",
    "options": [
      {
        "text": "把重点任务拆解到部门和乡镇，建立督查闭环",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "network": 4,
          "reputation": 3
        },
        "result": "县委决策被细化为可检查的节点，部门和乡镇的责任边界更加清晰。"
      },
      {
        "text": "先抓住最紧迫的两项任务，再逐步铺开",
        "performance": 1,
        "effect": {
          "seniority": 2,
          "reputation": 2
        },
        "result": "重点任务得到推进，但仍需要补充统筹安排。"
      },
      {
        "text": "只转发会议要求，不跟踪基层落实",
        "performance": -1,
        "effect": {
          "network": -3,
          "reputation": -2
        },
        "result": "要求传达到了基层，但执行效果缺少反馈和校正。"
      }
    ]
  },
  "county_government": {
    "title": "岗位专项 · 县政府综合调度",
    "scene": "县政府近期同时面临产业项目、财政约束和民生诉求，需要在现有资源下排出轻重缓急。",
    "options": [
      {
        "text": "统筹财政承受能力，公开项目时序和责任分工",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "reputation": 4,
          "integrity": 2
        },
        "result": "项目安排更加稳妥，财政边界和群众预期都得到较好平衡。"
      },
      {
        "text": "先保障刚性民生支出，再协调重点项目",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "基本民生得到保障，部分项目需要延后安排。"
      },
      {
        "text": "只追求项目数量，暂不测算后续支出",
        "performance": -1,
        "effect": {
          "integrity": -3,
          "reputation": -2
        },
        "result": "项目推进较快，但后续资金和运维压力开始显现。"
      }
    ]
  }
};
const ADDITIONAL_POSITION_EVENTS = {
  "discipline": [
    {
      "title": "岗位专项 · 纪检监督岗位 · 年度重点工作",
      "scene": "你负责的监督事项进入年度检查阶段，需要兼顾线索核查、制度执行和干部教育。",
      "options": [
        {
          "text": "围绕监督执纪规范化开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "监督执纪规范化得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进监督执纪规范化，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "监督执纪规范化基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理监督执纪规范化的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "监督执纪规范化留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 纪检监督岗位 · 阶段性风险处置",
      "scene": "一项重点工程即将验收，监督部门要求提前介入，防止程序和资金使用留下漏洞。",
      "options": [
        {
          "text": "围绕重点领域廉政风险排查开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重点领域廉政风险排查得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重点领域廉政风险排查，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重点领域廉政风险排查基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重点领域廉政风险排查的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重点领域廉政风险排查留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "organization": [
    {
      "title": "岗位专项 · 组织人事岗位 · 年度重点工作",
      "scene": "县乡干部队伍进入年度考察期，需要把平时表现、群众评价和岗位需求结合起来。",
      "options": [
        {
          "text": "围绕干部考察和日常监督开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "干部考察和日常监督得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进干部考察和日常监督，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "干部考察和日常监督基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理干部考察和日常监督的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "干部考察和日常监督留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 组织人事岗位 · 阶段性风险处置",
      "scene": "一批年轻干部即将进入重点岗位，培养方案需要避免只重使用、不重跟踪。",
      "options": [
        {
          "text": "围绕年轻干部培养和轮岗开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "年轻干部培养和轮岗得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进年轻干部培养和轮岗，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "年轻干部培养和轮岗基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理年轻干部培养和轮岗的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "年轻干部培养和轮岗留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_party": [
    {
      "title": "岗位专项 · 镇党委书记 · 年度重点工作",
      "scene": "作为镇党委书记，你需要把县委部署转化为符合本镇实际的年度重点任务。",
      "options": [
        {
          "text": "围绕党委会集体决策开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "党委会集体决策得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进党委会集体决策，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "党委会集体决策基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理党委会集体决策的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "党委会集体决策留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委书记 · 阶段性风险处置",
      "scene": "本镇产业基础、人口规模和财政承受能力各不相同，县里要求拿出差异化发展方案。",
      "options": [
        {
          "text": "围绕镇域产业和基层党建统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇域产业和基层党建统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇域产业和基层党建统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇域产业和基层党建统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇域产业和基层党建统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇域产业和基层党建统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_government": [
    {
      "title": "岗位专项 · 镇党委副书记、镇长 · 年度重点工作",
      "scene": "镇政府同时收到民生服务、项目建设和安全生产三类任务，现有人员无法平均用力。",
      "options": [
        {
          "text": "围绕镇政府行政调度开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇政府行政调度得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇政府行政调度，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇政府行政调度基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇政府行政调度的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇政府行政调度留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委副书记、镇长 · 阶段性风险处置",
      "scene": "一项公共设施项目进入论证，项目有民生价值，但后续运维费用可能超出镇级财力。",
      "options": [
        {
          "text": "围绕镇级财政和公共服务平衡开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇级财政和公共服务平衡得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇级财政和公共服务平衡，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇级财政和公共服务平衡基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇级财政和公共服务平衡的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇级财政和公共服务平衡留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_security": [
    {
      "title": "岗位专项 · 镇党委副书记、政法委书记 · 年度重点工作",
      "scene": "辖区出现多起邻里纠纷和信访苗头，镇党委要求把风险化解在基层。",
      "options": [
        {
          "text": "围绕镇域矛盾排查化解开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇域矛盾排查化解得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇域矛盾排查化解，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇域矛盾排查化解基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇域矛盾排查化解的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇域矛盾排查化解留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委副书记、政法委书记 · 阶段性风险处置",
      "scene": "重点人员服务管理和基层公共安全工作进入集中排查阶段，需要多部门协同。",
      "options": [
        {
          "text": "围绕重点人员服务管理和基层平安建设开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重点人员服务管理和基层平安建设得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重点人员服务管理和基层平安建设，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重点人员服务管理和基层平安建设基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重点人员服务管理和基层平安建设的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重点人员服务管理和基层平安建设留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_organization": [
    {
      "title": "岗位专项 · 镇党委委员、组织宣传统战岗位 · 年度重点工作",
      "scene": "镇里需要调整村级班子并培养后备干部，既要看实绩，也要听取党员群众意见。",
      "options": [
        {
          "text": "围绕村级班子考察和党员教育开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "村级班子考察和党员教育得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进村级班子考察和党员教育，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "村级班子考察和党员教育基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理村级班子考察和党员教育的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "村级班子考察和党员教育留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委委员、组织宣传统战岗位 · 阶段性风险处置",
      "scene": "一项惠民政策即将实施，需要向群众讲清政策边界，也要做好乡贤和各界人士沟通。",
      "options": [
        {
          "text": "围绕基层宣传思想与统战联络开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "基层宣传思想与统战联络得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进基层宣传思想与统战联络，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "基层宣传思想与统战联络基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理基层宣传思想与统战联络的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "基层宣传思想与统战联络留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "military": [
    {
      "title": "岗位专项 · 基层武装岗位 · 年度重点工作",
      "scene": "征兵宣传、民兵整组和应急支援任务同期展开，需要核准基层底数。",
      "options": [
        {
          "text": "围绕征兵和民兵整组开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "征兵和民兵整组得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进征兵和民兵整组，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "征兵和民兵整组基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理征兵和民兵整组的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "征兵和民兵整组留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 基层武装岗位 · 阶段性风险处置",
      "scene": "极端天气预警发布，镇级应急力量和民兵队伍需要做好支援准备。",
      "options": [
        {
          "text": "围绕军地应急支援和国防动员开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "军地应急支援和国防动员得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进军地应急支援和国防动员，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "军地应急支援和国防动员基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理军地应急支援和国防动员的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "军地应急支援和国防动员留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "public_security": [
    {
      "title": "岗位专项 · 公安基层领导岗位 · 年度重点工作",
      "scene": "辖区进入人员流动高峰，派出所需要把治安防控、纠纷排查和应急值守一体推进。",
      "options": [
        {
          "text": "围绕重点时段治安防控开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重点时段治安防控得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重点时段治安防控，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重点时段治安防控基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重点时段治安防控的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重点时段治安防控留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 公安基层领导岗位 · 阶段性风险处置",
      "scene": "县域重大活动临近，人员流动、交通组织和重点场所安保需要提前研判。",
      "options": [
        {
          "text": "围绕重大活动安保和矛盾风险研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重大活动安保和矛盾风险研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重大活动安保和矛盾风险研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重大活动安保和矛盾风险研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重大活动安保和矛盾风险研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重大活动安保和矛盾风险研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "province_security": [
    {
      "title": "岗位专项 · 省公安厅党委书记、厅长 · 年度重点工作",
      "scene": "全省治安、交通、网络和公共安全风险进入集中研判期，需要统一部署警务资源。",
      "options": [
        {
          "text": "围绕全省公共安全形势研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "全省公共安全形势研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进全省公共安全形势研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "全省公共安全形势研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理全省公共安全形势研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "全省公共安全形势研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 省公安厅党委书记、厅长 · 阶段性风险处置",
      "scene": "多个地市上报相互关联的重大警情，需要省公安厅统筹指挥、依法处置并做好部门协同。",
      "options": [
        {
          "text": "围绕跨市重大案件和应急指挥协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "跨市重大案件和应急指挥协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进跨市重大案件和应急指挥协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "跨市重大案件和应急指挥协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理跨市重大案件和应急指挥协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "跨市重大案件和应急指挥协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_party_lead": [
    {
      "title": "岗位专项 · 县委书记 · 年度重点工作",
      "scene": "县域改革发展进入关键期，县委班子对一项重大任务存在不同意见，需要把握方向、凝聚共识。",
      "options": [
        {
          "text": "围绕县委常委会集体决策开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县委常委会集体决策得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县委常委会集体决策，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县委常委会集体决策基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县委常委会集体决策的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县委常委会集体决策留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委书记 · 阶段性风险处置",
      "scene": "县域招商项目承诺较多，但生态、财政和用地约束都需要正面回应。",
      "options": [
        {
          "text": "围绕县域发展底线和班子建设开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域发展底线和班子建设得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域发展底线和班子建设，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域发展底线和班子建设基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域发展底线和班子建设的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域发展底线和班子建设留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_government_lead": [
    {
      "title": "岗位专项 · 县政府党组书记、县长 · 年度重点工作",
      "scene": "县财政收入承压，但教育、医疗和困难群众保障支出不能简单压减。",
      "options": [
        {
          "text": "围绕县政府财政统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县政府财政统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县政府财政统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县政府财政统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县政府财政统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县政府财政统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县政府党组书记、县长 · 阶段性风险处置",
      "scene": "强对流天气预警发布，交通、供电、学校和乡镇都需要提前做好应急安排。",
      "options": [
        {
          "text": "围绕县域应急指挥和民生保障开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域应急指挥和民生保障得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域应急指挥和民生保障，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域应急指挥和民生保障基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域应急指挥和民生保障的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域应急指挥和民生保障留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_security": [
    {
      "title": "岗位专项 · 县委副书记、政法委书记 · 年度重点工作",
      "scene": "县域信访、矛盾纠纷和基层治理事项相互交织，需要建立县乡联动机制。",
      "options": [
        {
          "text": "围绕县域社会治理联动开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域社会治理联动得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域社会治理联动，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域社会治理联动基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域社会治理联动的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域社会治理联动留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委副书记、政法委书记 · 阶段性风险处置",
      "scene": "县域重大活动临近，公安、交通、应急和乡镇需要形成联合安保方案。",
      "options": [
        {
          "text": "围绕重大活动公共安全保障开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重大活动公共安全保障得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重大活动公共安全保障，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重大活动公共安全保障基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重大活动公共安全保障的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重大活动公共安全保障留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_organization": [
    {
      "title": "岗位专项 · 县委常委、组织部部长 · 年度重点工作",
      "scene": "县域干部交流和年度考察进入集中研判阶段，需要把干部实绩、群众评价和岗位需要结合起来。",
      "options": [
        {
          "text": "围绕县管干部分类研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县管干部分类研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县管干部分类研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县管干部分类研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县管干部分类研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县管干部分类研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委常委、组织部部长 · 阶段性风险处置",
      "scene": "村级班子换届准备同步推进，既要核实现实表现，也要做好风险提示和后续培养。",
      "options": [
        {
          "text": "围绕村级班子换届准备和人才工作开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "村级班子换届准备和人才工作得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进村级班子换届准备和人才工作，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "村级班子换届准备和人才工作基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理村级班子换届准备和人才工作的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "村级班子换届准备和人才工作留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_propaganda": [
    {
      "title": "岗位专项 · 县委常委、宣传部部长 · 年度重点工作",
      "scene": "一项民生政策发布后，网络和热线出现不同声音，群众对政策边界存在误解。",
      "options": [
        {
          "text": "围绕县域政策发布和舆情回应开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域政策发布和舆情回应得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域政策发布和舆情回应，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域政策发布和舆情回应基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域政策发布和舆情回应的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域政策发布和舆情回应留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委常委、宣传部部长 · 阶段性风险处置",
      "scene": "县域公共文化和宣传阵地需要年度建设，既要有内容，也要有规范管理。",
      "options": [
        {
          "text": "围绕意识形态阵地和公共文化建设开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "意识形态阵地和公共文化建设得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进意识形态阵地和公共文化建设，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "意识形态阵地和公共文化建设基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理意识形态阵地和公共文化建设的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "意识形态阵地和公共文化建设留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_office": [
    {
      "title": "岗位专项 · 县委常委、县委办公室主任 · 年度重点工作",
      "scene": "县委会议确定了多项重点任务，部分乡镇反馈任务交叉、口径不一，督查需要从材料检查转向解决问题。",
      "options": [
        {
          "text": "围绕县委重点任务督查开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县委重点任务督查得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县委重点任务督查，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县委重点任务督查基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县委重点任务督查的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县委重点任务督查留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委常委、县委办公室主任 · 阶段性风险处置",
      "scene": "年度重要会议和综合文稿集中交办，时间紧、协作部门多，需要统一口径和审核流程。",
      "options": [
        {
          "text": "围绕重大文稿和综合协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重大文稿和综合协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重大文稿和综合协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重大文稿和综合协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重大文稿和综合协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重大文稿和综合协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_party": [
    {
      "title": "岗位专项 · 县委班子岗位 · 年度重点工作",
      "scene": "县级党委系统需要把上级部署分解到部门、乡镇和基层组织，确保责任链条不悬空。",
      "options": [
        {
          "text": "围绕县级重点任务分解开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县级重点任务分解得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县级重点任务分解，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县级重点任务分解基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县级重点任务分解的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县级重点任务分解留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委班子岗位 · 阶段性风险处置",
      "scene": "县域重点工作进入集中推进期，班子成员之间需要在分工基础上加强协同。",
      "options": [
        {
          "text": "围绕县域干部班子协同开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域干部班子协同得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域干部班子协同，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域干部班子协同基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域干部班子协同的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域干部班子协同留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_government": [
    {
      "title": "岗位专项 · 县政府领导岗位 · 年度重点工作",
      "scene": "县政府近期同时面临产业项目、财政约束和民生诉求，需要在现有资源下排出轻重缓急。",
      "options": [
        {
          "text": "围绕县域项目和财政调度开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域项目和财政调度得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域项目和财政调度，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域项目和财政调度基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域项目和财政调度的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域项目和财政调度留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县政府领导岗位 · 阶段性风险处置",
      "scene": "多个县政府组成部门上报年度计划，部分事项存在交叉，需要明确牵头和配合关系。",
      "options": [
        {
          "text": "围绕县政府组成部门协同开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县政府组成部门协同得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县政府组成部门协同，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县政府组成部门协同基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县政府组成部门协同的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县政府组成部门协同留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "district_lead": [
    {
      "title": "岗位专项 · 市辖区党政主官 · 年度重点工作",
      "scene": "作为市辖区党政主官，你需要在城市更新、基层治理和财政约束之间作出统筹安排。",
      "options": [
        {
          "text": "围绕城区更新和财政承受能力开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "城区更新和财政承受能力得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进城区更新和财政承受能力，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "城区更新和财政承受能力基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理城区更新和财政承受能力的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "城区更新和财政承受能力留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市辖区党政主官 · 阶段性风险处置",
      "scene": "城区人口和公共服务需求持续变化，街道、社区和区直部门需要形成治理合力。",
      "options": [
        {
          "text": "围绕市辖区基层治理统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "市辖区基层治理统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进市辖区基层治理统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "市辖区基层治理统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理市辖区基层治理统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "市辖区基层治理统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "district": [
    {
      "title": "岗位专项 · 市辖区班子岗位 · 年度重点工作",
      "scene": "街道、社区和区直部门对一项公共服务改革存在不同理解，需要把政策要求落到基层末梢。",
      "options": [
        {
          "text": "围绕街道社区治理协同开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "街道社区治理协同得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进街道社区治理协同，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "街道社区治理协同基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理街道社区治理协同的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "街道社区治理协同留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市辖区班子岗位 · 阶段性风险处置",
      "scene": "一项城区公共服务改革进入试点阶段，需要平衡街道执行、社区反馈和部门资源。",
      "options": [
        {
          "text": "围绕城区公共服务改革落地开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "城区公共服务改革落地得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进城区公共服务改革落地，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "城区公共服务改革落地基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理城区公共服务改革落地的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "城区公共服务改革落地留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "city_lead": [
    {
      "title": "岗位专项 · 市委市政府领导岗位 · 年度重点工作",
      "scene": "城市面临产业升级、债务约束和公共服务提质等多重任务，需要确定年度主攻方向。",
      "options": [
        {
          "text": "围绕城市发展战略取舍开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "城市发展战略取舍得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进城市发展战略取舍，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "城市发展战略取舍基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理城市发展战略取舍的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "城市发展战略取舍留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市委市政府领导岗位 · 阶段性风险处置",
      "scene": "多个区县上报的风险事项相互关联，市级部门需要从单点处置转向跨区域协同。",
      "options": [
        {
          "text": "围绕市级跨区域风险研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "市级跨区域风险研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进市级跨区域风险研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "市级跨区域风险研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理市级跨区域风险研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "市级跨区域风险研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "city_party": [
    {
      "title": "岗位专项 · 市委常委岗位 · 年度重点工作",
      "scene": "市级干部队伍和基层组织建设进入集中研判阶段，需要把各区县班子运行情况纳入分析。",
      "options": [
        {
          "text": "围绕全市干部队伍研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "全市干部队伍研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进全市干部队伍研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "全市干部队伍研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理全市干部队伍研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "全市干部队伍研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市委常委岗位 · 阶段性风险处置",
      "scene": "市委确定了跨区县重点任务，多个部门和区县反馈口径不一，需要加强督查协调。",
      "options": [
        {
          "text": "围绕市委重点工作督查协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "市委重点工作督查协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进市委重点工作督查协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "市委重点工作督查协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理市委重点工作督查协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "市委重点工作督查协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "province_lead": [
    {
      "title": "岗位专项 · 省级领导岗位 · 年度重点工作",
      "scene": "省域经济、区域协同和公共服务均衡发展需要统筹推进，部门之间对资源配置存在不同意见。",
      "options": [
        {
          "text": "围绕省域战略协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "省域战略协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进省域战略协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "省域战略协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理省域战略协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "省域战略协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 省级领导岗位 · 阶段性风险处置",
      "scene": "部分地区出现财政、产业和公共安全风险交织的情况，需要建立省域风险会商机制。",
      "options": [
        {
          "text": "围绕区域均衡和重大风险防控开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "区域均衡和重大风险防控得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进区域均衡和重大风险防控，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "区域均衡和重大风险防控基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理区域均衡和重大风险防控的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "区域均衡和重大风险防控留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "national": [
    {
      "title": "岗位专项 · 国家层面领导岗位 · 年度重点工作",
      "scene": "一项国家层面的重大政策需要兼顾总体目标、地方差异和风险防控，多个部门正在提出意见。",
      "options": [
        {
          "text": "围绕国家政策统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "国家政策统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进国家政策统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "国家政策统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理国家政策统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "国家政策统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 国家层面领导岗位 · 阶段性风险处置",
      "scene": "跨区域重大事项需要统一政策边界，同时为地方差异和动态调整留下规范空间。",
      "options": [
        {
          "text": "围绕跨区域重大风险协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "跨区域重大风险协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进跨区域重大风险协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "跨区域重大风险协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理跨区域重大风险协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "跨区域重大风险协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ]
};
const INVESTIGATION_EVENT = {
  "title": "监督核查",
  "scene": "纪检监督部门对你任职期间的工作流程、项目记录和个人事项开展例行核查。这是规范监督程序，请认真配合。",
  "options": [
    {
      "text": "主动配合并完整提供规范材料",
      "performance": 3,
      "effect": {
        "integrity": 4,
        "reputation": 2,
        "health": -1
      },
      "result": "材料完整、程序规范，核查顺利结束，你的廉政表现得到认可。"
    },
    {
      "text": "按要求补充材料并说明情况",
      "performance": 1,
      "effect": {
        "integrity": 1,
        "health": -2
      },
      "result": "你及时补齐了记录，核查按程序结束。"
    },
    {
      "text": "拖延提供材料且沟通态度消极",
      "performance": -1,
      "effect": {
        "integrity": -8,
        "reputation": -4,
        "health": -2
      },
      "result": "你的配合不够及时，年度廉政评价受到影响。"
    }
  ]
};
const COMPENSATION_BY_RANK = {
  "1": {
    "salary": 64000,
    "providentFund": 13000,
    "annuity": 5000
  },
  "2": {
    "salary": 70000,
    "providentFund": 15000,
    "annuity": 6000
  },
  "3": {
    "salary": 82000,
    "providentFund": 19000,
    "annuity": 7500
  },
  "4": {
    "salary": 94000,
    "providentFund": 23000,
    "annuity": 9000
  },
  "5": {
    "salary": 110000,
    "providentFund": 28000,
    "annuity": 11500
  },
  "6": {
    "salary": 128000,
    "providentFund": 34000,
    "annuity": 14000
  },
  "7": {
    "salary": 148000,
    "providentFund": 41000,
    "annuity": 17000
  },
  "8": {
    "salary": 172000,
    "providentFund": 49000,
    "annuity": 20500
  },
  "9": {
    "salary": 202000,
    "providentFund": 59000,
    "annuity": 25000
  },
  "10": {
    "salary": 236000,
    "providentFund": 70000,
    "annuity": 30000
  },
  "11": {
    "salary": 276000,
    "providentFund": 83000,
    "annuity": 36000
  }
};
const HOUSES = [
  { name: '云汀单身公寓', price: 250000, years: 8 },
  { name: '云汀小户型', price: 350000, years: 10 },
  { name: '云汀家庭两居', price: 500000, years: 10 },
  { name: '云汀改善型三居', price: 700000, years: 12 },
  { name: '云汀城区品质住宅', price: 1000000, years: 15 },
];
const CARS = [
  { name: '二手代步车', price: 50000, years: 2 },
  { name: '实用代步车', price: 80000, years: 3 },
  { name: '新能源家用车', price: 120000, years: 4 },
  { name: '舒适家用车', price: 180000, years: 4 },
  { name: '商务型车辆', price: 280000, years: 5 },
];
module.exports = { RANKS, POSITION_OPTIONS, EVENTS, POSITION_EVENTS, ADDITIONAL_POSITION_EVENTS, INVESTIGATION_EVENT, COMPENSATION_BY_RANK, HOUSES, CARS };

},
"game/data": function(module, exports, require) {
// Compatibility entry point. Source-authoritative data is generated in data-full.js.
module.exports = require('./data-full');

},
"game/events-burst": function(module, exports, require) {
// 突发事件库（弹窗式，不占用季度主事项）。
//
// 与 events-extra.js 的区别：
//   events-extra.js  → 日常事项，作为季度的"主事件"被抽到
//   events-burst.js  → 突发事件，在结算完一个季度后按概率"突然弹出"，必须当场表态
//
// 字段说明（在通用字段 text / performance / effect / result 之上）：
//   minRank  仅当 state.rankIndex >= minRank 时才会出现（权力越大，被围猎的概率越高）
//   weight   抽选权重，默认 1；受贿与投资类给较高权重，保证这类事最常见
//   risk     该选项累加的"风险痕迹"（0~12，不在主界面显示具体数值）；允许为负，用于主动说明后降痕
//   roll     概率分支：chance + attr × perPoint，随机走 success / fail
//   bond     结成关系网：{ kind:'fellow'|'protege', weight:1~3, reason:'往来的由头' }
//            fellow = 同船的领导（他出事会牵出你），protege = 经你帮扶的同僚
//   sever    割席：{ count:1, kind:'fellow'|'protege' }，主动与在台上风险最大的那个人切割
//
// 关系网的逻辑：结成的人越多、权重越高，落马风险越大；已落马的人贡献最高（见 game/network.js）。
// 所以"收下好处"这类选项除了当场扣廉政、累加风险痕迹，还会额外结成一个同船的人。
//
// 写作约束（与全项目一致）：
//   1. 不出现真实人名、机构、案件；
//   2. 不写行贿的具体金额、渠道、话术与操作步骤，只写"东西递过来了"和"代价落在了哪"；
//   3. 收下好处的选项一律当场给钱、事后扣廉政并累加风险痕迹，绝不做"违规还赢"。
// 风险痕迹的逻辑：累到 6 以上，后面某年会强制触发"专项倒查"（见 core.js 的 startQuarter）。

const BURST_EVENTS = [
  // ── 基层阶段（minRank 2）────────────────────────────────────────────
  // 刚入职手上没有审批权，但"被请托、被请吃饭、被议论"照样躲不开。
  // 这一组的存在是为了让职级 2 的玩家别反复只看到体检报告和老同事病倒。
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '饭桌上被留下陪一场',
    scene: '本来只是去送材料，科长让你留下来一起吃饭。散场时那位老板走在你旁边，把一个信封往你手里塞，说"小伙子辛苦，拿去买条烟"。',
    options: [
      { text: '当场推回去，只当没这回事', effect: { integrity: 3, reputation: 1, network: -1 }, risk: 0, result: '信封被你按了回去，老板笑了笑没再坚持，这顿饭之后他没再单独找过你。' },
      { text: '先收下，回头交给科长处置', effect: { integrity: 1, seniority: 1 }, risk: 0, result: '东西交上去了，科长看了你一眼，什么也没说。' },
      { text: '收下，觉得就是个意思', effect: { integrity: -5, wealth: 2000, network: 1 }, risk: 2, result: '钱不多，但从此那家公司的名字一出现，你都会多看一眼。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 2,
    weight: 2,
    title: '老乡带着东西上门',
    scene: '同乡带着两箱土产找上门，说镇里有个项目马上要发公告，希望你能"帮着问一句"，还说你家里人他都熟。',
    options: [
      { text: '说明流程，让他按公告自己去报名', effect: { integrity: 3, network: -1 }, risk: 0, result: '老乡脸色不太好看，但公告发出后他确实报了名，后来也没再提这事。' },
      { text: '土产收下，事情不表态', effect: { integrity: -2, wealth: 1000, network: 1 }, risk: 2, result: '东西收进了厨房，你心里清楚这不算"没事"。' },
      { text: '答应帮着问一句', effect: { integrity: -5, network: 2 }, risk: 3, result: '你去问了一句，这句话后来被人记了起来。' },
    ],
  },
  {
    tag: '举报',
    minRank: 2,
    weight: 2,
    title: '办公室里的议论',
    scene: '有人在你背后说，你经手的一笔报销占了公家的便宜，说得有鼻子有眼。你知道那不是事实，但话已经传开了。',
    options: [
      { text: '主动找科长说明，把票据摊开', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '票据一张张对完，科长当场把话说清楚了，议论很快就散了。' },
      { text: '不理会，觉得清者自清', effect: { reputation: -1, health: -1 }, risk: 0, result: '你没有解释，话在办公室里多飘了一个月，你听着，只是不接。' },
      { text: '找人去"压一压"这个说法', effect: { integrity: -3, network: 1, reputation: -1 }, risk: 2, result: '议论压下去了，但"他找人打过招呼"又成了新的议论。' },
    ],
  },

  // ── 受贿类：东西递到手上 ───────────────────────────────────────────
  {
    tag: '受贿',
    minRank: 3,
    weight: 3,
    title: '办公室里多了个档案袋',
    scene: '你回到办公室，桌上多了一个没有署名的牛皮纸档案袋。问了一圈，都说没留意是谁放下的。袋子没封口，里面露出一沓现金。',
    options: [
      { text: '原封不动交给办公室登记，并说明情况', effect: { integrity: 5, reputation: 2, network: -1 }, risk: 0, result: '袋子当场登记入库，谁送来的一时查不出，但你的处置留了记录。' },
      { text: '先收着，等弄明白是谁送的再处理', effect: { integrity: -3, wealth: 50000 }, risk: 2, result: '钱进了抽屉，也进了你每天要惦记的一件事。' },
      { text: '收下，觉得是有人"看得起自己"', effect: { integrity: -8, wealth: 50000, network: 1 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '那个没有署名的档案袋' }, result: '钱留下了，从这一刻起，你在某些人眼里就多了一个可以说得上的把柄。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 3,
    title: '装修款已经有人结过了',
    scene: '家里刚装完房子，你去结账，老板笑着说"已经有人替您付过了"，还说这点小事不用放在心上。',
    options: [
      { text: '坚持自己把钱补上，并留好转账记录', effect: { integrity: 4, reputation: 1, wealth: -45000 }, risk: 0, result: '钱你自己付了，虽然多花了一笔，但这笔账从今往后说得清。' },
      { text: '默认接受，觉得是朋友之间的心意', effect: { integrity: -6, wealth: 45000, network: 2 }, risk: 3, result: '房子住得舒坦，但那句"不用放在心上"你一直记着。' },
      { text: '问清楚是谁付的，再做决定', effect: { integrity: 1, network: -1 }, risk: 1, result: '问明白了，答案让你有些为难，你决定先不动这笔钱。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 3,
    weight: 3,
    title: '节前的一箱"特产"',
    scene: '节前，一家有业务往来的公司送来一箱当地特产，箱子底下压着一张购物卡，包装上没有任何字样。',
    options: [
      { text: '整箱原样退回，并说明纪律要求', effect: { integrity: 4, reputation: 2, network: -1 }, risk: 0, result: '东西退回去了，对方脸上不好看，但从此没人再往你这送东西。' },
      { text: '特产留下，把卡退回去', effect: { integrity: 1, reputation: 1 }, risk: 0, result: '卡退了，特产留下了，边界感在这一次算是守住了。' },
      { text: '整箱收下，觉得节日往来很正常', effect: { integrity: -6, wealth: 8000, network: 2 }, risk: 2, result: '东西收了，卡也用了，这份"正常往来"以后每年都会准时出现。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 2,
    title: '给孩子办的卡',
    scene: '一家合作企业的负责人听说你孩子要买辅导资料，顺手递来一张书店卡，说"给孩子买书用，不值钱"。',
    options: [
      { text: '当场谢绝，说明不接受任何形式的卡券', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '对方把卡收了回去，孩子的事你自己买了单。' },
      { text: '收下但如实登记上交', effect: { integrity: 2 }, risk: 0, result: '卡登记上交了，事情走在了明处。' },
      { text: '收下，觉得是给孩子的心意', effect: { integrity: -5, wealth: 5000, network: 1 }, risk: 2, result: '孩子用上了新资料，而你从此很难再对这家企业说得上"公事公办"。' },
    ],
  },

  // ── 投资类：机会送到面前 ───────────────────────────────────────────
  {
    tag: '投资',
    minRank: 4,
    weight: 3,
    title: '一句"内部消息"',
    scene: '饭桌上有人压低声音说，某片区规划很快要调整，现在入手还来得及，"这种机会不会等人"。',
    options: [
      { text: '不参与，并提醒对方泄露规划信息风险很大', effect: { integrity: 4, reputation: 2, network: -1 }, risk: 0, result: '你没有接这个话，也在心里给这个人画了个标记。' },
      {
        text: '用小额资金试一下水',
        effect: { integrity: -3 },
        risk: 2,
        result: '你投了一笔不大的钱，剩下的交给消息本身。',
        roll: {
          chance: 0.45,
          attr: 'network',
          perPoint: 0.004,
          success: { effect: { integrity: -4, wealth: 60000 }, risk: 3, bond: { kind: 'fellow', weight: 1, reason: '那顿饭上一起听消息的人' }, result: '消息坐实，账面浮盈不小，你心里却并不轻松。' },
          fail: { effect: { integrity: -4, wealth: -20000 }, risk: 2, result: '规划调整搁置，钱套在里面，你开始回避当时一起吃饭的人。' },
        },
      },
      { text: '加大投入，趁机会做一笔大的', effect: { integrity: -8, wealth: 120000 }, risk: 5, bond: { kind: 'fellow', weight: 2, reason: '那顿饭上一起听消息的人' }, result: '这一笔赚得不少，但你从此在这个圈子里有了具体的名字。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 3,
    title: '老同学拉你入股',
    scene: '多年不见的老同学找上门，说公司正缺一笔资金周转，请你入股，"只出钱，不用出面，分红按季打给你"。',
    options: [
      { text: '明确拒绝，说明自己不适合参与这类经营', effect: { integrity: 4, reputation: 1, network: -2 }, risk: 0, result: '同学失望而归，但你的名下始终没有出现这家公司。' },
      { text: '让家人以自有资金少量参与', effect: { integrity: -5, wealth: 40000, network: 1 }, risk: 3, result: '股本挂在家人名下，分红也照常到账，关联关系却已经形成。' },
      { text: '自己出资入股并参与分红', effect: { integrity: -8, wealth: 90000, network: 3 }, risk: 5, result: '钱赚到了，可公司拿地、拿项目的时候，你都得想办法避开。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 2,
    title: '"上市就翻倍"的份额',
    scene: '有人拿着一份股权认购协议找你，说这是内部份额，企业很快要上市，翻倍不止，"过了这几天就没了"。',
    options: [
      { text: '不碰，这类口头承诺无法核实', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '份额被别人抢走了，你没有搭进去任何东西。' },
      {
        text: '拿一小笔钱试试',
        effect: { integrity: -2 },
        risk: 2,
        result: '你把钱打了过去，之后只能等消息。',
        roll: {
          chance: 0.4,
          attr: 'seniority',
          perPoint: 0.004,
          success: { effect: { integrity: -3, wealth: 50000 }, risk: 3, result: '那家企业确实有了动静，你的份额翻了倍，也把关系绑得更紧。' },
          fail: { effect: { integrity: -3, wealth: -30000 }, risk: 2, result: '企业上市的计划再无下文，认购协议成了一张废纸。' },
        },
      },
      { text: '多认购一些，机会难得', effect: { integrity: -8, wealth: -100000 }, risk: 5, result: '你把大部分积蓄押了上去，从此每天都要打听那家企业的消息。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 3,
    title: '明显低于市场价的"内部房"',
    scene: '一家开发商找你，说留了几套"内部房源"，价格明显低于周边成交价，只要签个字，不用排队不用摇号。',
    options: [
      { text: '按正常程序公开购买，不拿内部价', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '你按市价买下了一套，虽然多花了钱，但没有欠下任何人情。' },
      { text: '以内部价买下一套自住', effect: { integrity: -6, wealth: 50000, network: 1 }, risk: 3, result: '房子拿到了，差价摆在那里，你很难再对这家开发商的口碑保持中立。' },
      { text: '问清楚差价的来源再决定', effect: { integrity: 1, network: -1 }, risk: 1, result: '对方支支吾吾，你把资料留了下来，先没有签字。' },
    ],
  },
  {
    tag: '投资',
    minRank: 3,
    weight: 3,
    title: '年化很高的"稳赚理财"',
    scene: '有人给你推荐一个理财项目，说背后是熟人操盘，年化收益远超市场水平，"随时可以取"。',
    options: [
      { text: '不参与，收益越高风险越说不清', effect: { integrity: 2, reputation: 1 }, risk: 0, result: '你没有投，项目后来什么时候停的你也没再关注。' },
      {
        text: '投一笔试试能不能随时取',
        effect: { integrity: -1 },
        risk: 1,
        result: '钱投进去的当周，收益确实按天到账。',
        roll: {
          chance: 0.5,
          attr: 'network',
          perPoint: 0.004,
          success: { effect: { integrity: -2, wealth: 40000 }, risk: 2, result: '你把本金和收益都取了出来，及时收手。' },
          fail: { effect: { integrity: -2, wealth: -40000 }, risk: 1, result: '第二周平台就无法提现了，你的本金只剩下一个数字。' },
        },
      },
    ],
  },

  // ── 请托与围猎类 ───────────────────────────────────────────────────
  {
    tag: '围猎',
    minRank: 5,
    weight: 3,
    title: '饭局上要一个"明确答复"',
    scene: '饭局进行到一半，对方把话题收住，当着满桌人的面问你要一个明确答复，说"今天给句痛快话，咱们以后都好办事"。',
    options: [
      { text: '只谈政策口径，不表态', effect: { integrity: 4, reputation: 1, network: -2 }, risk: 0, result: '你把话拉回了政策本身，饭桌上一度冷场，但你没有留下承诺。' },
      { text: '含糊应下，先把场面圆过去', effect: { integrity: -4, network: 2 }, risk: 2, result: '场面圆过去了，可"含糊"在对方那里等于"答应了"。' },
      { text: '当场明确答应下来', effect: { integrity: -8, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '那顿饭桌上你当众给的那句痛快话' }, result: '满桌人都听见了你的答复，这句话以后是要兑现的。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 5,
    weight: 3,
    title: '老领导的电话',
    scene: '一位已经退下来的老领导打来电话，说有个"后辈"的事情卡在你这个环节，希望你关照一下，说得不多，只提了一句"当年我帮过你"。',
    options: [
      { text: '说明办理程序，只能按规则办', effect: { integrity: 4, network: -2 }, risk: 0, result: '你把程序讲清楚了，电话那头沉默了一会儿就挂了。' },
      { text: '按程序办，但不排队、优先往前放', effect: { integrity: -1, network: 2 }, risk: 1, result: '事情办得很快，程序上也说得过去，但你自己知道快在了哪里。' },
      { text: '直接安排下去', effect: { integrity: -7, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '他打来的那个电话' }, result: '事情当天就办妥了，这个人情也从此记在了对方账上。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 6,
    weight: 2,
    title: '一张会所里的照片',
    scene: '一个陌生号码发来一张照片：某次应酬你在会所与人碰杯的侧影。"照片拍得不错，想跟你聊聊。"',
    options: [
      {
        text: '不理会，同时向组织如实说明那次应酬',
        effect: { integrity: 5, reputation: 1, network: -2 },
        risk: 0,
        result: '你把情况先说了出去，照片就此失去了要价的价值。',
        roll: {
          chance: 0.75,
          attr: 'reputation',
          perPoint: 0.003,
          success: { effect: { integrity: 5, reputation: 2 }, risk: 0, result: '先说一步让事情变得简单，对方再没发来第二条消息。' },
          fail: { effect: { integrity: 4, reputation: -3 }, risk: 1, result: '照片还是在圈子里传了一圈，但你因为主动说明，没有被追着问。' },
        },
      },
      { text: '花钱把照片买断', effect: { integrity: -8, wealth: -100000, reputation: -2 }, risk: 5, result: '照片拿回来了，可对方手里还有底片，这件事永远不会真正结束。' },
      { text: '隔岸观火，先不做任何回应', effect: { integrity: -2, reputation: -2 }, risk: 2, result: '你没有回应，照片在半个月后被转到了别人的手机上。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 6,
    weight: 2,
    title: '记者手里那段录音',
    scene: '一位记者打来电话，说手上有一段你在某次内部会议上的录音，问你"要不要先沟通一下"。',
    options: [
      { text: '正面回应，请对方按程序核实公开', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '录音被核实后公开，内容与事实基本一致，你反而获得了正面评价。' },
      { text: '请宣传部门统一衔接', effect: { integrity: 2, seniority: 2 }, risk: 0, result: '回应由专业渠道作出，节奏稳了下来。' },
      { text: '找人"做做工作"把稿子压下去', effect: { integrity: -7, wealth: -50000, reputation: -3 }, risk: 4, result: '稿子没发，可"有人被公关过"的说法比稿子本身传得更快。' },
    ],
  },

  // ── 举报与核查类 ───────────────────────────────────────────────────
  {
    tag: '举报',
    minRank: 4,
    weight: 3,
    title: '一封匿名举报信的副本',
    scene: '你收到一封匿名举报信的副本，内容指向你经手过的一个项目，细节写得不算准确，但看得出是内部人写的。',
    options: [
      { text: '主动说明项目全过程，配合核查', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '材料交上去后，核查很快有了结论，事情没有继续发酵。' },
      { text: '先自己了解是谁写的，再做打算', effect: { integrity: -1, network: -1 }, risk: 1, result: '你花了不少精力去猜写信的人，项目本身的说明反而拖了。' },
      { text: '先压下来，不声张', effect: { integrity: -6, reputation: -2 }, risk: 3, result: '信压住了，但它已经存在，什么时候再出现不由你决定。' },
    ],
  },
  {
    tag: '举报',
    minRank: 5,
    weight: 3,
    title: '来人了解一位商人的情况',
    scene: '两名工作人员到单位了解一位长期在本地经营的企业主的情况，请你说明与他之间的往来。',
    options: [
      { text: '把自己知道的全部如实说明', effect: { integrity: 5, network: -2 }, risk: 0, result: '该说的都说了，之后没有再被反复找过。' },
      { text: '只说明有据可查的公务往来', effect: { integrity: -1 }, risk: 1, result: '说明结束了，但有几顿饭局你没有提。' },
      { text: '淡化关系，称只是工作上的认识', effect: { integrity: -7, reputation: -2 }, risk: 4, result: '说法与已有材料对不上，你随后需要反复解释同一件事。' },
    ],
  },

  // ── 家庭与生活类 ───────────────────────────────────────────────────
  {
    tag: '家庭',
    minRank: 4,
    weight: 2,
    title: '配偶要你签一份担保',
    scene: '配偶想和朋友合伙做一个项目，资金缺口需要你作为担保人签字。对方说得很有把握，但合同上有几处你看不太懂。',
    options: [
      { text: '不签，并把看不懂的条款逐条说明', effect: { integrity: 3, reputation: -1, network: -1 }, risk: 0, result: '家里为此争执了很久，但那份合同最后没有你的名字。' },
      { text: '签字支持，家里的事不该太计较', effect: { integrity: -3, wealth: -60000, network: 1 }, risk: 3, result: '项目推进了一段，后续的资金压力也一并落到了你身上。' },
      { text: '请律师看清楚条款再决定', effect: { integrity: 2 }, risk: 0, result: '律师指出了两处明显的风险条款，家里重新商量了方案。' },
    ],
  },
  {
    tag: '家庭',
    minRank: 5,
    weight: 2,
    title: '"孩子上学的事包在我身上"',
    scene: '有人主动提起你孩子升学的事，说自己和某所学校很熟，"一个电话的事，不用你操心"。',
    options: [
      { text: '婉拒，按正常途径报考', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '孩子按自己的成绩走完了流程，你也没有欠下这份人情。' },
      { text: '接受帮忙，觉得是孩子的事', effect: { integrity: -5, network: 1 }, risk: 3, bond: { kind: 'fellow', weight: 1, reason: '替孩子上学打的那些招呼' }, result: '事情办成了，这份人情却挂在了你身上，迟早要还。' },
    ],
  },

  // ── 结网类：关系就是在这些时刻结下的 ─────────────────────────────────
  // 这一组的作用是把"关系网"从隐含机制变成可感知的选择：
  // 同船的领导、经你帮扶的同僚，都是在这种具体场合里多出来的。
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '分管领导让你去跑一件私事',
    scene: '分管领导把你叫到办公室，说的不是工作：他一位亲戚的手续卡在某个环节，让你"帮忙盯一下"。他没说必须办，只是把茶杯往你这边推了推。',
    options: [
      { text: '问清程序，按正常时限往前排', effect: { integrity: 3, seniority: 1, network: -1 }, risk: 0, result: '你按正常时限办了，不快也不慢。领导没再提这件事。' },
      { text: '当天就办妥，不让领导再问第二遍', effect: { integrity: -4, network: 3, seniority: 2 }, risk: 3, bond: { kind: 'fellow', weight: 2, reason: '他亲戚那件手续是你办的' }, result: '事情办得很干净，从此你在他那里多了一个"能用"的位置。' },
      { text: '推给具体经办人，自己不出面', effect: { seniority: -1, reputation: -1 }, risk: 1, result: '你没有亲自经手，但这件事绕了一圈还是挂着你的名字。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '下属把责任全揽了',
    scene: '一份材料出了问题，上面追下来。你还没开口，科里那个刚来两年的年轻人先站起来说"是我核的，跟其他人没关系"。他知道那份材料最后是你签的字。',
    options: [
      { text: '当场说明签字的是自己，责任不在他', effect: { integrity: 5, reputation: 2, seniority: -1 }, risk: 0, result: '你把责任接了回来，材料重新核了一遍。那个年轻人看你的眼神变了。' },
      { text: '让他先顶着，事后找机会补上', effect: { integrity: -3, network: 2, reputation: -1 }, risk: 2, bond: { kind: 'protege', weight: 2, reason: '他替你顶下的那次责任' }, result: '事情压下去了。后来他在关键时候找过你一次，你没法拒绝。' },
      { text: '顺势把话头转开，交给上面定性', effect: { integrity: -1, reputation: -1 }, risk: 1, result: '最后谁也没被点名，只是那份材料从此没人愿意接。' },
    ],
  },
  {
    tag: '结网',
    minRank: 4,
    weight: 3,
    title: '他想要那个位置',
    scene: '一个跟你做过几个项目的老同事找上门，说某个位置马上要空出来，自己等了很多年，希望你能在上面替他说一句话。他说得很实在："这地方我只信你。"',
    options: [
      { text: '只谈他的实绩，不替任何人打包票', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '你把他的项目清单整理了一份交上去，其余的话一句没多说。' },
      { text: '明确替他说话，把人推上去', effect: { network: 3, reputation: 1 }, risk: 2, bond: { kind: 'protege', weight: 2, reason: '你出面向上面要的那个位置' }, result: '他上了那个位置。从那以后，别人提起他的时候，总会先提一句是谁推的。' },
      { text: '让他自己去找渠道，你不掺和', effect: { network: -2 }, risk: 0, result: '他愣了一下，说了句"打扰了"。这件事之后，你们之间的来往少了很多。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 2,
    title: '老同事被挪到了边上',
    scene: '和你同期进单位的一个人被调去管档案，手上的项目全交了。他来找你，不是抱怨，就是想问问你还缺不缺人手。',
    options: [
      { text: '把手上一个项目分给他做', effect: { reputation: 2, network: 2, seniority: 1 }, risk: 0, bond: { kind: 'protege', weight: 1, reason: '你分给他的那个项目' }, result: '项目进度慢了一点，但他重新有了事做，你也多了一个靠得住的人。' },
      { text: '替他去上面争一次，哪怕争不回来', effect: { integrity: 3, network: 1, reputation: 1 }, risk: 0, bond: { kind: 'protege', weight: 1, reason: '你替他去争过的那一次' }, result: '调动没有改回来，但这件事在同事之间传开了。' },
      { text: '劝他先忍一忍，别在这时候出头', effect: { seniority: 1, network: -1 }, risk: 0, result: '他听了，点点头走了。档案室那边后来一直很安静。' },
    ],
  },

  // ── 身体与意外类 ───────────────────────────────────────────────────
  {
    tag: '意外',
    minRank: 2,
    weight: 3,
    title: '体检报告上的箭头',
    scene: '连续几个月加班后，体检报告上出现了几项异常指标，医生建议尽快复查并调整作息。手上正好有一个不能拖的任务。',
    options: [
      { text: '先去复查，把任务重新安排', effect: { health: 6, seniority: -1 }, risk: 0, result: '复查结果是疲劳导致，休息一段时间后指标回落。' },
      { text: '先把手上的事忙完再说', effect: { health: -7, reputation: 1 }, risk: 0, result: '任务按时完成了，但那份报告被你压在了抽屉最下面。' },
      { text: '请几天假集中休整', effect: { health: 4, reputation: -1 }, risk: 0, result: '几天假让你缓了过来，有些工作也转到了别人手上。' },
    ],
  },
  {
    tag: '意外',
    minRank: 2,
    weight: 2,
    title: '老同事突然病倒',
    scene: '隔壁办公室的老同事在会议上突然晕倒，送医后需要长期休养，他手上的活一时没人接。',
    options: [
      { text: '主动顶上，同时协调其他人分担', effect: { reputation: 4, network: 2, health: -3 }, risk: 0, result: '工作没有断档，你连着忙了一个多月，也累得够呛。' },
      { text: '按程序申请增派人手', effect: { seniority: 2, health: -1 }, risk: 0, result: '人手上补充了，只是走完流程又等了两周。' },
      { text: '把最急的部分先接过来，其余照旧', effect: { reputation: 2, seniority: 1 }, risk: 0, result: '急事没有耽误，剩下的按原来的节奏慢慢推。' },
    ],
  },

  // ── 补充池：让每个职级都有足够多的唯一突发事件 ────────────────────────
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '窗口前的熟人请求',
    scene: '窗口前来了一位熟人，说材料还差一页，想请你先收下再补齐，"都是自己人，别卡得太细"。',
    options: [
      { text: '退回材料，列清补正清单', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '熟人把清单接了过去，补齐材料后重新排队。' },
      { text: '先收件，提醒他尽快补齐', effect: { integrity: -1, reputation: -1 }, risk: 1, result: '材料暂时进了窗口，后续催补让你多费了一番口舌。' },
      { text: '直接替他把缺页补上', effect: { integrity: -4, network: 2 }, risk: 3, result: '事情办得很快，但这次破例被同事看在了眼里。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '临时加塞的请示',
    scene: '同一批材料里，有人把一张请示单压在最上面，说领导已经点过头，只等你先处理。',
    options: [
      { text: '按收件时间重新排队', effect: { integrity: 3, seniority: 1 }, risk: 0, result: '请示回到了应有的位置，后续没有人再催你。' },
      { text: '先登记，等领导正式批示', effect: { integrity: 1, reputation: 1 }, risk: 0, result: '你把口头意思留在了纸面之外，手续按正常节点继续走。' },
      { text: '照着暗示先办下去', effect: { integrity: -4, network: 2 }, risk: 3, result: '事情提前办了，排队顺序却留下了一个解释不清的空档。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 2,
    weight: 3,
    title: '快递盒里的小礼物',
    scene: '你的办公桌旁放着一个没有寄件人的快递盒，里面是日常用品，夹着一张没有署名的卡片。',
    options: [
      { text: '原样封存，交办公室登记', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '快递被登记入册，送件人暂时没有出现。' },
      { text: '只留下用品，卡片退回去', effect: { integrity: 1 }, risk: 0, result: '卡片被你退回，用品也按规定处理了。' },
      { text: '把东西带回家再说', effect: { integrity: -4, wealth: 1200, network: 1 }, risk: 2, result: '盒子进了家门，你也记住了这份没有署名的心意。' },
    ],
  },
  {
    tag: '结网',
    minRank: 2,
    weight: 3,
    title: '同事请你代签',
    scene: '同事临时外出，一份需要核对的材料放到了你面前。他说内容都看过了，只差你先代签一下。',
    options: [
      { text: '等本人回来核对后再签', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '材料晚了一会儿，但每一处签字都找得到责任人。' },
      { text: '只核对关键页后签收', effect: { integrity: -1, seniority: 1 }, risk: 1, result: '材料顺利流转，剩下的细节后来又补核了一遍。' },
      { text: '不看内容，直接替他签字', effect: { integrity: -5, network: 2 }, risk: 3, bond: { kind: 'protege', weight: 1, reason: '你替他签下的那份材料' }, result: '同事回来连声道谢，这个签字却从此挂在你名下。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '下班后的那顿饭',
    scene: '下班后，项目相关的一位联系人约你吃饭，说只是叙旧，却把座位安排在了最方便说话的位置。',
    options: [
      { text: '婉拒邀请，说明工作时间外不便往来', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '你没有赴约，第二天照常按流程处理工作。' },
      { text: '参加但只谈公开信息', effect: { integrity: 1, health: -1 }, risk: 0, result: '饭局没有越过边界，只是你花掉了一个晚上的休息时间。' },
      { text: '顺着话题答应帮忙', effect: { integrity: -4, network: 2 }, risk: 3, result: '你给了一个模糊承诺，对方却把它当成了明确答复。' },
    ],
  },
  {
    tag: '举报',
    minRank: 2,
    weight: 3,
    title: '一份退回的材料',
    scene: '你退回的一份材料被人重新送了回来，批注旁边多了一句："大家都这么办，别让事情卡在你这里。"',
    options: [
      { text: '再次说明依据，并留下退回记录', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '退回理由写清楚了，材料最终按规范补正。' },
      { text: '请同事一起复核再决定', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '复核让事情慢了一点，但责任不再只落在你一个人身上。' },
      { text: '睁一只眼放过去', effect: { integrity: -4, reputation: -1 }, risk: 3, result: '材料流转了，那个缺口却留在了后续核查里。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 3,
    weight: 3,
    title: '会场外的求情',
    scene: '会议结束后，一位项目联系人在门口拦住你，说有个小环节希望你提前关照，别让材料再退回去。',
    options: [
      { text: '告知补正要求，让他回去完善', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '对方拿着清单离开，项目随后按程序补齐。' },
      { text: '口头提醒一次，但不承诺结果', effect: { integrity: -1, network: 1 }, risk: 1, result: '你给了提醒，没有替他越过任何审批节点。' },
      { text: '答应在流程里帮他盯着', effect: { integrity: -4, network: 2 }, risk: 3, bond: { kind: 'fellow', weight: 1, reason: '会场外那次求情' }, result: '这句话被记成了人情，后来每个环节都有人来问进度。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 3,
    weight: 3,
    title: '项目验收前的暗示',
    scene: '验收前夕，合作方把一份精心整理的汇报放到你桌上，暗示只要你在会上多说一句，结果就会顺利很多。',
    options: [
      { text: '按现场事实逐项核验', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '汇报回到数据和现场，验收意见写得清清楚楚。' },
      { text: '只提醒对方补齐佐证材料', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '对方补交了材料，结果由证据本身说话。' },
      { text: '提前替对方打包票', effect: { integrity: -5, network: 2 }, risk: 4, result: '会上话说得太满，后续每个差异都要你出面解释。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '领导让你先看一眼',
    scene: '分管领导把一份还没公开的名单递给你，让你先看看有没有熟悉的人，语气像是随口一问。',
    options: [
      { text: '说明名单尚未公开，原样退回', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '名单回到了领导手里，没有在你这里留下副本。' },
      { text: '只看公开信息能核对的部分', effect: { integrity: 1, seniority: 1 }, risk: 1, result: '你没有发表倾向，最后仍按正式名单办理。' },
      { text: '记住几个名字，提前打招呼', effect: { integrity: -5, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '那份提前看过的名单' }, result: '名单还没公布，人情已经先走了一步。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '奖金名单上的空白',
    scene: '年底分配奖励时，一位同事发现自己的名字漏在了名单外，来问你能不能替他说句话。',
    options: [
      { text: '把事实和材料整理后提交', effect: { integrity: 3, reputation: 2, network: 1 }, risk: 0, bond: { kind: 'protege', weight: 1, reason: '你帮他核对奖金名单' }, result: '名单重新核对，他最终拿到了应得的评价。' },
      { text: '建议他按申诉渠道反映', effect: { seniority: 1, reputation: 1 }, risk: 0, result: '他照着渠道提交了申请，事情交给了正式程序。' },
      { text: '答应直接去找人改名单', effect: { integrity: -4, network: 2 }, risk: 3, result: '你答应得很快，之后每次分配他都先来找你。' },
    ],
  },
  {
    tag: '家庭',
    minRank: 4,
    weight: 2,
    title: '家人想换学区房',
    scene: '家人看中一套价格明显偏低的房子，中介说房源和某个项目有关系，办起来会比普通房源快。',
    options: [
      { text: '按公开渠道重新比较房源', effect: { integrity: 3, health: -1 }, risk: 0, result: '家人虽然失望，但买房方案回到了公开市场。' },
      { text: '请专业人士核查产权', effect: { integrity: 2, reputation: 1 }, risk: 0, result: '核查发现几处手续问题，家里及时停了下来。' },
      { text: '接受所谓内部便利', effect: { integrity: -5, wealth: 70000, network: 2 }, risk: 4, result: '房子看似占了便宜，手续和人情却一起压了过来。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 2,
    title: '合作方请你评审',
    scene: '合作方邀请你参加一场内部评审，说专家费只是象征性的，主要是感谢你一直以来的支持。',
    options: [
      { text: '说明身份并退出评审', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '评审换了人，你和合作方之间保持了清楚的边界。' },
      { text: '只提供公开资料，不接受费用', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '你给了公开层面的建议，费用没有进入你的账户。' },
      { text: '接受邀请并领取费用', effect: { integrity: -6, wealth: 40000, network: 2 }, risk: 3, result: '费用到账了，之后对方每次遇到项目都拿这次往来作比较。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 2,
    title: '匿名包裹送到家',
    scene: '家门口收到一个没有寄件人的包裹，家人说看起来像是熟悉业务的那家单位送来的。',
    options: [
      { text: '拒收并留下退回记录', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '包裹退回去了，家里人也知道了边界在哪里。' },
      { text: '暂时封存，等核实来源', effect: { integrity: 1, health: -1 }, risk: 1, result: '包裹没有拆开，来源核清后按规定处理。' },
      { text: '拆开留下其中的东西', effect: { integrity: -6, wealth: 40000, network: 2 }, risk: 3, result: '东西留下了，家里也开始担心这份来路不明的便利。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 2,
    title: '老朋友请你照看生意',
    scene: '老朋友说自己的生意正遇到审批节点，希望你不要直接经手，只要在关键时刻提醒一句。',
    options: [
      { text: '说明回避要求，不参与提醒', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '朋友知道了边界，生意按公开流程继续。' },
      { text: '建议他找正式窗口咨询', effect: { integrity: 2, network: -1 }, risk: 0, result: '你把问题推回了公开渠道，没有留下私人承诺。' },
      { text: '答应帮忙盯住节点', effect: { integrity: -5, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '替朋友照看生意的承诺' }, result: '一句提醒变成了长期牵挂，朋友也开始把你当成固定的通道。' },
    ],
  },
  {
    tag: '举报',
    minRank: 5,
    weight: 2,
    title: '会议纪要被人改过',
    scene: '你复核会议纪要时发现，原本写得很清楚的保留意见被删掉了，修改痕迹却没有留下。',
    options: [
      { text: '按录音和原始材料恢复纪要', effect: { integrity: 5, reputation: 1 }, risk: 0, result: '纪要恢复了原貌，保留意见重新回到了记录里。' },
      { text: '要求所有参会人共同确认', effect: { integrity: 3, seniority: 1 }, risk: 0, result: '大家重新确认，修改过程也被补进了说明。' },
      { text: '顺着修改后的版本签字', effect: { integrity: -5, reputation: -1 }, risk: 4, result: '会议记录看起来更干净，却经不起后来逐字核对。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 6,
    weight: 2,
    title: '接待名单上的空位',
    scene: '一次正式接待的名单上多了一个没有姓名的空位，安排人说是老朋友，等你点头就能进场。',
    options: [
      { text: '要求补齐身份和事由', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '名单补全后才进入会场，接待流程留在了明处。' },
      { text: '让工作人员按规定核验', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '核验花了些时间，但没人能绕过登记。' },
      { text: '默认这个空位有人来坐', effect: { integrity: -6, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '接待名单上那个没有姓名的空位' }, result: '人进了场，名单却留下了一个迟早要解释的空白。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 6,
    weight: 2,
    title: '一笔没有备注的转账',
    scene: '账户里出现一笔没有备注的转账，金额不大，联系之后对方只说是之前那次饭局的感谢。',
    options: [
      { text: '原路退回并保存记录', effect: { integrity: 5, reputation: 1 }, risk: 0, result: '转账退回去了，饭局和账户之间没有留下模糊地带。' },
      { text: '暂不动账，先查清来源', effect: { integrity: 1, health: -1 }, risk: 1, result: '你把款项留在原处，核实后按规定处理。' },
      { text: '默认收下这份感谢', effect: { integrity: -7, wealth: 50000, network: 2 }, risk: 5, result: '钱留在账上，对方也就有了再次开口的理由。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 7,
    weight: 2,
    title: '项目名单里的名字',
    scene: '项目名单即将定稿，有人请你把一个熟悉的名字放进去，说这个人能力没问题，只差一份推荐。',
    options: [
      { text: '按公开标准逐项打分', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '名单按照评分定稿，推荐不再单独影响结果。' },
      { text: '把推荐意见一并留痕', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '意见进入材料，最终由集体评审决定。' },
      { text: '直接把名字排在前面', effect: { integrity: -7, network: 3 }, risk: 5, bond: { kind: 'protege', weight: 2, reason: '你替他放进项目名单' }, result: '名字进了名单，也让这份推荐变成了往后的牵连。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 7,
    weight: 2,
    title: '办公室门口的车钥匙',
    scene: '办公室门口放着一把车钥匙，来人说只是借你用几天，车就在楼下，不必登记。',
    options: [
      { text: '当场退回并说明纪律要求', effect: { integrity: 5, reputation: 1 }, risk: 0, result: '钥匙被拿走了，门口恢复了平常的安静。' },
      { text: '请办公室统一登记后再说', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '登记没有通过，借用的说法自然也就结束了。' },
      { text: '收下钥匙，先用起来再说', effect: { integrity: -8, network: 3 }, risk: 5, result: '车开走了，谁把钥匙放在门口却成了新的问题。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 8,
    weight: 2,
    title: '一封写给未来的请托',
    scene: '一位熟人送来一封信，说现在不用你办什么，只希望将来有合适机会时记得他的名字。',
    options: [
      { text: '退回信件，只接受正式申请', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '信退回去了，未来的事情仍由公开程序决定。' },
      { text: '收下信件但不作承诺', effect: { integrity: 1, network: -1 }, risk: 1, result: '你没有答应任何事，但这封信仍提醒你保持距离。' },
      { text: '把名字记进自己的安排', effect: { integrity: -7, network: 3 }, risk: 5, bond: { kind: 'fellow', weight: 2, reason: '那封提前递来的请托信' }, result: '事情还没有发生，人情账已经先写下了。' },
    ],
  },
];

// 风险痕迹累到阈值后触发的"专项倒查"。它不是随机事件，而是玩家自己选择的结果。
const REVIEW_EVENT = {
  tag: '倒查',
  title: '专项倒查',
  scene: '此前一些资金往来和项目记录被重新调阅，专项工作组逐项核对当年的签字、发票和说明材料，包括那些当时看起来"已经过去"的事。',
  options: [
    { text: '主动说明并提交完整材料，包括对自己不利的部分', effect: { integrity: 4, reputation: -1, health: -3 }, result: '你把该说的都说了，处理结果比预想的轻，事情到这里基本收尾。' },
    { text: '就有据可查的部分作答，其余不作说明', effect: { integrity: -5, reputation: -3, health: -3 }, result: '材料补齐了，但几处解释不通的地方被记了下来。' },
    {
      text: '先找关系缓和一下',
      effect: { integrity: -6, reputation: -2, health: -2 },
      risk: 2,
      result: '找人这件事本身被查了出来，问题从一个变成了两个。',
      roll: {
        chance: 0.6,
        success: {
          effect: { integrity: -5, reputation: -1, network: 1 },
          result: '有人把话递到了上面，核查的口径松了一扣：几处解释不通的地方按"材料瑕疵"归了档。你以为这件事过去了——递话的人也这么以为，从这天起，你们就绑在了同一条绳上。',
        },
        fail: {
          effect: { integrity: -8, reputation: -4, network: -2, health: -2 },
          result: '话还没递上去，"核查期间四处找人"先被记了下来。问题从一个变成了两个：原来几处解释不通的地方，如今每一条都成了态度问题。',
        },
      },
    },
  ],
};

module.exports = { BURST_EVENTS, REVIEW_EVENT };

},
"game/events-by-rank": function(module, exports, require) {
// 按职级分组的季度工作题库。
//
// 为什么另起一套：原来的季度事项只有 54 道公共 + 27 道岗位，副科级往上
// 每个职级只能抽到 4~5 道，一个存档要过几十个季度，必然翻来覆去。
// 这里每个职级 50 道，只在本职级抽取，内容贴合该职级真实的权力边界——
// 二级科员办的是窗口和入户，副处级才谈得上协调部门、副厅级才谈得上统筹条线。
//
// 写作约束（和全局一致，别破）：
//   · 人物、职务、事件全部虚构，不对应任何真实人物、机构或案件
//   · 不出现具体金额、渠道、操作步骤与话术细节
//   · **不存在"靠破规则赢"的路径**：违规选项最多是"少输"，performance 绝不能最高
//
// 事件字段：{ title, scene, options: [{ text, performance, effect, result }] }
// effect 可用：reputation / network / integrity / health / seniority / wealth（wealth 会转成现金）

const RANK_EVENT_FILES = [
  'rank-01', 'rank-02', 'rank-03', 'rank-04', 'rank-05', 'rank-06',
  'rank-07', 'rank-08', 'rank-09', 'rank-10', 'rank-11',
];

// 题库是按职级分批补的，缺哪一级就先返回空数组（core 会退回原来的抽取逻辑）。
// tests/rank-events.test.js 会断言 11 级全部非空，补齐前那条用例是红的。
const RANK_EVENT_POOL = RANK_EVENT_FILES.map(name => {
  try {
    return require(`./rank-events/${name}`);
  } catch (error) {
    return [];
  }
});

module.exports = { RANK_EVENT_POOL, RANK_EVENT_FILES };

},
"game/events-extra": function(module, exports, require) {
// 手写扩展事件库。
// 为什么单独放一个文件：data-full.js 由 tools/convert-source-data.js 从源数据机械生成，
// 任何手写内容写进去都会被下一次 `npm run extract:source-data` 覆盖。
//
// 选项基础字段（与源数据一致）：text / performance / effect / result
// 本文件额外支持的字段（由 game/core.js 解释）：
//   minRank   仅当 state.rankIndex >= minRank 时该事件才进入抽选池
//   tag       分类标签，便于统计与测试
//   upgraded  条件强化：state 满足 upgraded.require 时，整条选项替换为更强的版本
//   roll      概率分支：按 chance（可用 attr / perPoint 按属性修正）随机走 success 或 fail
//
// 写作约束：
//   1. 不出现真实人名、真实机构、真实案件；
//   2. 违规选项必须付出可见代价（廉政、口碑、人脉），不做"违规还赢"；
//   3. 不写行贿的具体金额、渠道、话术与操作步骤，只写"诱惑出现"和"代价落地"。
// 场景取自基层与机关日常里出现频率最高的那几类事项。

const EXTRA_COMMON_EVENTS = [
  // ── 基层事务：真实高频 ─────────────────────────────────────────────
  {
    tag: '基层事务',
    minRank: 1,
    title: '上级检查 · 台账留痕',
    scene: '检查组两天后到，办公室通知各站所把近一年台账补齐。有两件事当时办完了却没留档，只剩工作群里的聊天记录能证明。',
    options: [
      { text: '按记录如实补录，并在备注里写明材料来源', performance: 3, effect: { integrity: 2, reputation: 3 }, result: '检查顺利通过，补录说明写得清楚，没有留下新的问题。' },
      { text: '照格式先把材料做齐，来源以后再说', performance: 1, effect: { reputation: 1, seniority: 1 }, result: '材料形式上齐全，但你清楚其中有几处经不起追问。' },
      { text: '说明是当时经办人没交，与自己无关', performance: -1, effect: { reputation: -4, network: -2 }, result: '责任推出去了，但同事从此对你多了一层提防。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 1,
    title: '领导调研 · 接待安排',
    scene: '上级领导临时到镇里调研，办公室问你中午怎么安排。附近只有一家条件不错的饭店。',
    options: [
      { text: '按工作餐标准安排在镇食堂，如实说明', performance: 3, effect: { integrity: 3, reputation: 2 }, result: '领导吃得简单，反而多问了几句实际情况，调研很实在。' },
      { text: '在饭店订一桌，费用走别的科目', performance: -1, effect: { integrity: -5, reputation: 1, wealth: -800 }, result: '场面好看，但账目上多了一笔需要解释的支出。' },
      { text: '让企业老板帮忙安排并买单', performance: -1, effect: { integrity: -7, network: 2 }, result: '饭局是别人结的账，这张人情以后是要还的。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 1,
    title: '群众信访 · 初次接待',
    scene: '一位群众第八次来反映宅基地纠纷，前几次都被告知"再等等"。这次他带着一摞材料，情绪明显上来了。',
    options: [
      { text: '当场把材料过一遍，列出办理节点和责任人', performance: 3, effect: { reputation: 5, network: 2 }, result: '群众看到明确的节点，情绪先稳了下来，事情进入正常办理。' },
      { text: '按流程收下材料，告知等待答复', performance: 1, effect: { seniority: 1 }, result: '材料收下了，但对方临走时的表情说明他并不放心。' },
      { text: '解释权限不在镇里，建议他往上反映', performance: -1, effect: { reputation: -4 }, result: '事情推了出去，但矛盾也往上一级走了一步。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 1,
    title: '周末的急件',
    scene: '周六傍晚，工作群来了通知，要求次日上午报一份汇总表。表里的数据分散在三个站所，只有你能凑齐。',
    options: [
      { text: '当晚逐个沟通，把表准时报上去', performance: 3, effect: { reputation: 3, seniority: 2, health: -2 }, result: '材料按时报出，牵头部门记住了你的配合。' },
      { text: '先报已知部分，注明其余周一补齐', performance: 1, effect: { seniority: 1, reputation: 1 }, result: '表交上去了，但被要求周一再补一次。' },
      { text: '在群里说明周末无法完成，等周一', performance: -1, effect: { reputation: -2, health: 1 }, result: '你保住了周末，也在牵头部门那里留下了一次不配合的记录。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 2,
    title: '跨部门协调 · 谁牵头',
    scene: '一项工作需要三个部门配合，谁都不愿牵头。会开了两次，纪要上仍是"各负其责"。',
    options: [
      { text: '主动牵头，把分工和时限写清楚报上去', performance: 3, effect: { reputation: 4, network: 3, health: -1 }, result: '你接下了最难的部分，但事情第一次有了明确进度。' },
      { text: '建议由分管领导出面协调', performance: 1, effect: { seniority: 2 }, result: '领导出面后事情动了起来，只是你的主动也被记了一笔。' },
      { text: '先按现有分工推进自己能做的部分', performance: 1, effect: { seniority: 1, reputation: -1 }, result: '你完成了自己的那一块，整体进度仍卡在协调上。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '项目验收 · 材料补签',
    scene: '项目要赶在本月完成验收，但有两道关键工序的现场记录缺失。施工方希望先签字，资料随后补。',
    options: [
      { text: '不予签字，要求补齐现场记录后重新验收', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '验收推迟了几天，但程序上没有留下缺口。' },
      { text: '先签字，要求三天内补齐资料', performance: -1, effect: { integrity: -4, network: 2 }, result: '资料后来补上了，但签字那一刻的风险已经留在档案里。' },
      { text: '只签非关键部分，关键工序等记录', performance: 1, effect: { seniority: 2, integrity: 1 }, result: '你把风险压在了可控范围内，双方都接受。' },
      { text: '请分管领导一起到场后再定', performance: 1, effect: { network: 1, seniority: 1 }, result: '决定由集体作出，责任也被分担了。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 2,
    title: '安全生产 · 限期整改',
    scene: '检查发现一家小加工厂消防通道被货物堵住，按规定要停业整改。老板表示订单正紧，停一天损失很大。',
    options: [
      { text: '当场下达整改通知，先清通道再谈复工', performance: 3, effect: { integrity: 3, reputation: 3 }, result: '通道当晚清空，隐患消除，老板也承认自己疏忽。' },
      { text: '给三天期限，期间要求自行整改', performance: 1, effect: { seniority: 1, reputation: -1 }, result: '工厂整改了，但这三天里风险一直存在。' },
      { text: '口头提醒，不走过场开单', performance: -1, effect: { integrity: -5, reputation: -2 }, result: '你给对方留了面子，也给自己留了一个说不清的责任。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '环保督察 · 邻村偷排',
    scene: '环保督察组交办一条线索：邻村一家小作坊夜间偷排。这家作坊的负责人是本地老熟人，和你打过几次交道。',
    options: [
      { text: '按要求核查取证，一视同仁上报', performance: 3, effect: { integrity: 5, reputation: 3, network: -2 }, result: '问题被查实并依法处理，你在熟人圈里落了个"不好说话"。' },
      { text: '先通知对方自行整改，再决定是否上报', performance: -1, effect: { integrity: -5, network: 2 }, result: '作坊停了几天又开工，督察组第二次交办时你解释不清。' },
      { text: '核查后发现情节轻微，如实上报但建议从轻', performance: 1, effect: { integrity: 2, seniority: 1 }, result: '处理依法依规，也把实际情况写进了报告。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '征地补偿 · 标准争议',
    scene: '同一片地被划进两个补偿档次，边界上的几户认为自己被划低了，集体到指挥部要说法。',
    options: [
      { text: '公示测算依据，逐户核对，确有误差立即更正', performance: 3, effect: { integrity: 3, reputation: 5 }, result: '几户的误差被更正，其余人也接受了结果。' },
      { text: '坚持既有方案，解释标准不容更改', performance: 1, effect: { seniority: 1, reputation: -2 }, result: '方案没有改动，但矛盾被压到了后面。' },
      { text: '为求尽快签约，私下承诺个别照顾', performance: -1, effect: { integrity: -6, reputation: 1 }, result: '有人签了，也有人听说了"能私下谈"，反而更不肯签。' },
      { text: '请评估机构重新测算边界地块', performance: 3, effect: { reputation: 3, network: 1, seniority: 1 }, result: '第三方结论让各方都无话可说，签约进度明显加快。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '媒体来访 · 突发舆情',
    scene: '一位记者突然到镇里，想了解前几天一起纠纷的处理情况，并要求当天给出答复，否则先发稿再核实。',
    options: [
      { text: '如实说明进展和依据，请对方给一天核实时间', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '记者接受了核实安排，报道基本客观，没有引出次生舆情。' },
      { text: '以"需请示"为由不作任何回应', performance: -1, effect: { reputation: -5 }, result: '报道只采用了单方面说法，你随后花了更多力气解释。' },
      { text: '先请宣传部门出面统一口径再回应', performance: 1, effect: { seniority: 2, reputation: 1 }, result: '口径统一了，回应虽慢半拍，但没有说错话。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 4,
    title: '招商引资 · 政策开口子',
    scene: '一家企业表示愿意落户，但要求土地价格和税收返还上给"特殊政策"，并暗示周边地区都给。',
    options: [
      { text: '在现有政策框架内测算，能给多少给多少，说清底线', performance: 3, effect: { integrity: 3, reputation: 3, network: 1 }, result: '企业最终按政策落地，你也没有留下后续要兑现的口头承诺。' },
      { text: '先口头答应下来，把企业签进来再说', performance: -1, effect: { integrity: -6, network: 3 }, result: '项目签了，但那个口头承诺成了以后每年都要面对的麻烦。' },
      { text: '请上级明确政策边界后再谈', performance: 1, effect: { seniority: 2 }, result: '边界清楚了，谈判节奏也慢了下来。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 4,
    title: '数据口径 · 报表怎么填',
    scene: '年度报表要求上报一项指标，按现有统计口径算出来不好看。有人建议"按预计完成数"填报。',
    options: [
      { text: '按实际数上报，同时附上完成情况和原因说明', performance: 3, effect: { integrity: 4, reputation: 2 }, result: '数字不好看，但说明写得扎实，上级反而认可了你的实事求是。' },
      { text: '按预计完成数填报，反正年底能补上', performance: -1, effect: { integrity: -5, reputation: -1 }, result: '数字好看了，但年底一旦补不上，解释起来更难。' },
      { text: '两个数字都报，由上级决定采用哪个', performance: 1, effect: { seniority: 1, integrity: 1 }, result: '选择权交了出去，责任也随之减轻。' },
    ],
  },

  // ── 两难题：两个选项都有理，也都要付代价 ────────────────────────────
  {
    tag: '两难',
    minRank: 3,
    title: '两难 · 工期与程序',
    scene: '重点项目要赶在雨季前完成主体，施工方提出先开工、后补手续，说"本地项目都是这个节奏"。',
    options: [
      { text: '先保工期，手续边干边补', performance: 1, effect: { network: 3, reputation: 1, integrity: -3 }, result: '工期保住了，但那段手续成了以后每次检查都要解释的部分。' },
      { text: '先补齐手续再开工，工期压力自己扛', performance: 1, effect: { integrity: 3, reputation: -2, network: -1 }, result: '程序上没有瑕疵，工期耽误的责任全部落在你这一侧。' },
    ],
  },
  {
    tag: '两难',
    minRank: 3,
    title: '两难 · 稳定与依法',
    scene: '十几户居民因补偿问题堵住了施工便道，要求当天答复。依法处置会激化情绪，继续协商则影响整体进度。',
    options: [
      { text: '坚持依法依规，明确告知堵路的法律后果', performance: 1, effect: { integrity: 3, reputation: -2, network: -1 }, result: '便道恢复通行，但你在部分群众那里的评价短期下降了。' },
      { text: '先承诺研究诉求，劝离后再逐户做工作', performance: 1, effect: { reputation: 3, network: 2, integrity: -2, seniority: -1 }, result: '人群散了，承诺也记在了群众心里，接下来必须兑现。' },
    ],
  },
  {
    tag: '两难',
    minRank: 5,
    title: '两难 · 老同事的失误',
    scene: '一位共事多年的老同事在项目上出了纰漏，按规定要追责。他私下找你，希望"内部提醒一下就算了"。',
    options: [
      { text: '按规定如实上报，同时帮他梳理补救方案', performance: 1, effect: { integrity: 4, network: -3 }, result: '追责照章进行了，你也尽力把损失压到了最小，但这段交情冷了。' },
      { text: '内部提醒并督促整改，先不上报', performance: 1, effect: { network: 3, integrity: -3 }, result: '问题在内部消化了，但这个处理方式本身成了你以后的把柄。' },
    ],
  },
  {
    tag: '两难',
    minRank: 5,
    title: '两难 · 数字与实情',
    scene: '上级要求上报一项工作进度，实际情况明显低于预期。如实上报会影响全单位评价，虚报则以后要圆。',
    options: [
      { text: '如实上报，并附上原因分析和补救计划', performance: 1, effect: { integrity: 4, reputation: -2 }, result: '单位评价受了影响，但你保住了说真话的底气。' },
      { text: '按目标口径上报，年内想办法补回来', performance: 1, effect: { reputation: 3, integrity: -4 }, result: '数据好看了，接下来每个月都要为这个数字继续找补。' },
    ],
  },

  // ── 复杂题：多方案权衡 ─────────────────────────────────────────────
  {
    tag: '复杂',
    minRank: 4,
    title: '复杂 · 群体诉求处置',
    scene: '二十多户居民因安置问题集体到镇里反映，情绪激动，门外还来了两家媒体。现场需要你立刻拿出处置思路。',
    options: [
      { text: '先安排代表进会议室，逐条记录诉求并当场定节点', performance: 3, effect: { reputation: 5, network: 2 }, result: '人群分批散去，诉求进入书面流程，当天没有失控。' },
      { text: '请分管领导出面接待，自己负责现场秩序', performance: 1, effect: { seniority: 2, reputation: 1 }, result: '领导接了访，现场平稳，但后续落实仍然要靠你。' },
      { text: '以维稳为由先劝返，事后再逐一约谈', performance: -1, effect: { reputation: -4, network: -1 }, result: '人散了，但"被劝返"的说法很快传开，第二次人更多。' },
      { text: '现场核对材料，能当场答复的当场答复', performance: 3, effect: { integrity: 2, reputation: 4, network: 1 }, result: '当场解决了三户的具体问题，其余人看到了诚意。' },
      { text: '先请法律顾问到场，明确政策与法律边界', performance: 1, effect: { integrity: 3, seniority: 1, reputation: 1 }, result: '答复有了依据，节奏放缓但每一步都站得住。' },
    ],
  },
  {
    tag: '复杂',
    minRank: 6,
    title: '复杂 · 重大项目方案',
    scene: '一个上亿元的重点项目要定实施方案，三套方案各有取舍：进度快的成本高，成本低的影响群众，折中方案风险不明。',
    options: [
      { text: '选进度优先方案，抢在节点前形成实物量', performance: 1, effect: { network: 3, reputation: 2, wealth: -3000 }, result: '节点赶上了，但成本压力在后面几年持续存在。' },
      { text: '选成本优先方案，把群众沟通放到前面做', performance: 1, effect: { reputation: 3, network: -1 }, result: '预算控制住了，前期沟通花掉了大量精力。' },
      { text: '委托第三方做风险评估后再决策', performance: 3, effect: { integrity: 2, seniority: 2, reputation: 2 }, result: '评估指出了折中方案的两处隐患，决策变得有依据。' },
      { text: '分阶段实施，先做争议最小的一段', performance: 3, effect: { reputation: 3, network: 1, seniority: 1 }, result: '首段顺利落地，后续推进时阻力小了很多。' },
    ],
  },
  {
    tag: '复杂',
    minRank: 6,
    title: '复杂 · 干部推荐',
    scene: '一个关键岗位要推荐人选，有三个人进入视野：业务最熟的、群众基础最好的、以及老领导打过招呼的。',
    options: [
      { text: '按岗位需要和考察情况推荐业务最熟的人', performance: 3, effect: { integrity: 3, reputation: 2, network: -2 }, result: '人岗匹配，工作接得上，但你得罪了打招呼的那条线。' },
      { text: '推荐群众基础最好的人，稳妥不出错', performance: 1, effect: { reputation: 2, seniority: 1 }, result: '推荐平稳落地，岗位业务磨合期比预期长。' },
      { text: '照顾老领导的面子，推荐打过招呼的人', performance: -1, effect: { network: 3, integrity: -5, reputation: -2 }, result: '人情还上了，但这个岗位的短板很快显现出来。' },
      { text: '把三人材料一并上报，说明各自优劣，由集体研究', performance: 3, effect: { integrity: 2, seniority: 2 }, result: '决定由集体作出，程序上挑不出毛病。' },
    ],
  },

  // ── 人情与规矩：权力寻租的苗头 ─────────────────────────────────────
  {
    tag: '人情规矩',
    minRank: 2,
    title: '婚丧喜庆 · 怎么办',
    scene: '家里办喜事，同事、下属和一些打过交道的企业负责人都表示要来。规模一旦放开，很难收住。',
    options: [
      { text: '按规定报备，只请亲友，明确不收礼金', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '场面简单，事后没有任何需要解释的地方。' },
      { text: '小范围办几桌，熟人随礼不好推', performance: 1, effect: { integrity: -2, network: 2 }, result: '喜事办得体面，但礼金往来在往后几年里陆续需要"还"。' },
      { text: '分几场办，避免一次规模太大', performance: -1, effect: { integrity: -5, reputation: -2 }, result: '规模看上去小了，但拆场次本身就成了议论的话题。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 3,
    title: '老乡请托 · 打个招呼',
    scene: '多年没联系的老乡找到你，说亲戚的一件事"卡在你们那儿"，希望你在会上帮忙说句话。',
    options: [
      { text: '说明办理流程，让对方按正常渠道提交材料', performance: 3, effect: { integrity: 3, reputation: 2, network: -2 }, result: '对方不太高兴，但事情在流程里正常办结了。' },
      { text: '帮忙问一下进度，但不干预结论', performance: 1, effect: { network: 2, integrity: -1 }, result: '进度问清楚了，对方也理解了程序，但你已经欠下一次"问过"的记录。' },
      { text: '在会上明确帮着说话', performance: -1, effect: { integrity: -6, network: 3 }, result: '事办成了，这段人情在本地圈子里传开，来找你的人变多了。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 2,
    title: '公车私用 · 顺路一趟',
    scene: '下班后需要去一趟老家接人，单位车正好停在楼下，司机说"顺路，没人会问"。',
    options: [
      { text: '自行打车前往，不动用公车', performance: 3, effect: { integrity: 2, reputation: 1, wealth: -100 }, result: '多花了一点钱，但没有任何需要解释的地方。' },
      { text: '按程序申请用车并如实登记事由', performance: 1, effect: { seniority: 1, integrity: 1 }, result: '手续补上了，用车的性质就清楚了。' },
      { text: '直接用一次，反正没人知道', performance: -1, effect: { integrity: -4, reputation: -1 }, result: '当天没人问，但车队的行车记录是留着的。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 4,
    title: '下属的节礼',
    scene: '中秋前，一位下属提着两个盒子到办公室，说"就是点土特产，不值钱"。',
    options: [
      { text: '当面谢绝，并说明单位的规定', performance: 3, effect: { integrity: 4, reputation: 2 }, result: '对方略显尴尬，但此后没人再往你办公室送东西。' },
      { text: '收下一盒，回赠等值物品', performance: 1, effect: { integrity: -1, network: 1 }, result: '往来看上去对等，边界却已经模糊了。' },
      { text: '收下，觉得拒绝反而生分', performance: -1, effect: { integrity: -5, network: 2 }, result: '东西收下了，往后再谈工作安排时，你心里多了一层顾虑。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 5,
    title: '老板的饭局',
    scene: '一位长期在本地承接工程的企业负责人约你吃饭，说只是"汇报一下行业情况"，同席还有两位同行。',
    options: [
      { text: '婉拒饭局，约在企业办公室按程序谈工作', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '工作谈得很正式，对方也明白你的边界在哪里。' },
      { text: '赴约但明确由自己结账，不谈具体事项', performance: 1, effect: { network: 2, integrity: -2 }, result: '饭吃了，事情没谈，但同席的人都记住了你和他的关系。' },
      { text: '赴约并让对方安排，顺便听听项目消息', performance: -1, effect: { integrity: -6, network: 3 }, result: '饭桌上听到了不少消息，从此你在项目上很难再做到完全回避。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 4,
    title: '执法 · 放一马',
    scene: '例行检查发现一家小商户有轻微违规，按规定要罚款并记录。店主是本地人，反复说生意难做，希望你通融。',
    options: [
      { text: '依法处理，同时告知整改方式和减轻处罚的渠道', performance: 3, effect: { integrity: 4, reputation: 3 }, result: '处罚执行了，店主也按告知的渠道完成了整改。' },
      { text: '口头警告，要求限期整改，不予记录', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '店主很感激，但同类问题下一次出现时你更难按规矩处理。' },
      { text: '只做记录不处罚，让店主自己看着办', performance: -1, effect: { integrity: -5, reputation: -1 }, result: '事情压下去了，案卷里却留下了一个没有结论的记录。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 5,
    title: '津补贴 · 领导开口',
    scene: '领导提出，今年大家辛苦，能不能想办法在账上"处理"一笔辛苦费出来，由你具体经手。',
    options: [
      { text: '说明政策不允许，建议通过正规激励渠道争取', performance: 3, effect: { integrity: 5, reputation: 2, network: -2 }, result: '钱没有违规发放，领导当时不太高兴，但事后没再提。' },
      { text: '先拖一拖，等领导自己改变主意', performance: 1, effect: { seniority: 1, integrity: 1 }, result: '事情搁置了，你也没有把话说明白。' },
      { text: '按领导意思办，找科目处理', performance: -1, effect: { integrity: -7, network: 3 }, result: '钱发出去了，这笔账从此成了你心里的一根刺。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 5,
    title: '说情 · 为违规者开口',
    scene: '一名干部因违规被核查，他的家人找到你，希望你在会上"帮着说句话"，理由是"他平时人不错"。',
    options: [
      { text: '告知核查的独立性，明确表示不会干预', performance: 3, effect: { integrity: 4, reputation: 2, network: -2 }, result: '你没有介入，核查按程序推进，结论也经得起检验。' },
      { text: '如实反映自己了解的情况，不作评价', performance: 1, effect: { integrity: 2, seniority: 1 }, result: '你提供了客观信息，没有替任何人表态。' },
      { text: '在会上强调他的过往功劳，希望从轻', performance: -1, effect: { integrity: -5, network: 2 }, result: '话说出去了，核查的独立性也因此受到了质疑。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 6,
    title: '亲属 · 想接个工程',
    scene: '一位近亲提出想参与本地一个小型工程的投标，说"不用你特殊照顾，只要不给别人递话就行"。',
    options: [
      { text: '明确告知回避要求，建议对方去外地市场发展', performance: 3, effect: { integrity: 4, reputation: 2, network: -2 }, result: '亲戚很不理解，但你的任职范围里没有出现相关企业。' },
      { text: '不插手，但也不阻止对方正常投标', performance: 1, effect: { network: 1, integrity: -2 }, result: '程序上没有你的痕迹，但这个关联关系始终需要说明。' },
      { text: '帮忙打听一下评标情况，让对方心里有底', performance: -1, effect: { integrity: -6, network: 3 }, result: '信息递出去了，从这一刻起你就很难再说自己与此无关。' },
    ],
  },

  // ── 生活作风：厅局级以上（职级 7 起）──────────────────────────────
  {
    tag: '生活作风',
    minRank: 7,
    title: '应酬场合 · 分寸',
    scene: '一场必要的商务应酬上，一位长期合作的商人带来了几位朋友，其中一位对你的工作表现出格外热情的关切，散场后还几次发来信息。',
    options: [
      { text: '保持工作距离，信息一律不回，后续应酬减少单独往来', performance: 3, effect: { integrity: 4, reputation: 2, network: -2 }, result: '往来淡了下来，你在这个圈子里显得不好接近，但也省去了后面的麻烦。' },
      { text: '礼貌回应但守住边界，只谈工作范围的事', performance: 1, effect: { integrity: 1, network: 1 }, result: '关系维持在正常的公务往来上，但你清楚这条线需要一直盯着。' },
      { text: '觉得是正常交往，继续保持私下联系', performance: -1, effect: { integrity: -6, reputation: -3, network: 2 }, result: '联系逐渐频繁，你开始有一些不方便写进日程表的安排。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 7,
    title: '配偶亲属 · 经商与收受',
    scene: '你得知配偶在你分管领域的一家合作企业里领取了一份"顾问费"，对方从未要求过具体工作内容。',
    options: [
      { text: '立即要求退还款项，并向组织如实报告', performance: 3, effect: { integrity: 5, reputation: 2, network: -2 }, result: '款项退回并作了报告，虽然家里为此争执了很久，但事情摆到了明处。' },
      { text: '要求停止领取，已领部分自行处理不再声张', performance: 1, effect: { integrity: -2, reputation: 1 }, result: '领取停止了，但已发生的部分成了你心里一直没放下的事。' },
      { text: '认为配偶的往来与自己无关，不做处理', performance: -1, effect: { integrity: -7, reputation: -3 }, result: '这份"顾问费"此后持续存在，也持续留在了别人的账本上。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 7,
    title: '大额人情往来',
    scene: '一位企业负责人在你家人住院期间送来一笔数额明显超出正常往来范围的"慰问金"，并强调只是心意。',
    options: [
      { text: '当场退回，并按报告个人有关事项的要求处理', performance: 3, effect: { integrity: 5, reputation: 2, network: -2 }, result: '钱退回去了，对方此后与你打交道时规矩了很多。' },
      { text: '金额太大，先收下再找机会以其他方式还回去', performance: 1, effect: { integrity: -3, network: 1 }, result: '钱暂时留下了，什么时候还、怎么还，成了你反复琢磨的事。' },
      { text: '收下，认为人情往来属正常', performance: -1, effect: { integrity: -7, reputation: -2, network: 2 }, result: '这份人情被记在了对方心里，也意味着以后很难拒绝他提出的要求。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 8,
    title: '子女留学 · 有人"赞助"',
    scene: '孩子出国读书的费用压力不小。一位商人朋友主动提出"先垫上，等以后方便再说"，并说明不需要任何手续。',
    options: [
      { text: '明确拒绝，通过自有资金和正规贷款解决', performance: 3, effect: { integrity: 5, reputation: 2, wealth: -5000 }, result: '开支压力实实在在，但孩子的学费每一笔都来得清楚。' },
      { text: '只接受无息借款并写下借据，约定还款计划', performance: 1, effect: { integrity: 1, wealth: 3000, network: 1 }, result: '借据留下了，但你也明白这段关系从此不再是普通朋友。' },
      { text: '接受赞助，认为孩子的事与工作无关', performance: -1, effect: { integrity: -8, reputation: -3, network: 2 }, result: '孩子顺利出了国，这份"赞助"也成了日后最需要解释的一笔往来。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 8,
    title: '特定关系人被调查',
    scene: '一位与你私交甚密的商人因其他案件被调查，办案人员向你了解情况，并提醒如实说明。',
    options: [
      { text: '如实说明全部往来，包括自己认为不妥的部分', performance: 3, effect: { integrity: 5, reputation: 2, network: -3 }, result: '你把该说的都说了，虽然短期难看，但此后再没有被反复找过。' },
      { text: '只说明公开可见的往来，其余避而不谈', performance: 1, effect: { integrity: -3, network: 1 }, result: '问询结束了，但你知道有几件事并没有讲完。' },
      { text: '尽量淡化关系，称只是工作认识', performance: -1, effect: { integrity: -8, reputation: -4 }, result: '说法与在案材料对不上，随后你需要反复解释同一件事。' },
    ],
  },

  // ── 条件强化：平时积累的属性，决定了你能不能把事直接办成 ────────────
  {
    tag: '条件强化',
    minRank: 1,
    title: '群众办事 · 一次办好',
    scene: '一位老人来办社保关系转移，按规定需要本人再回原单位盖一次章。老人腿脚不便，来回一趟要大半天。',
    options: [
      {
        text: '按流程告知需要补办的手续和办理地点',
        performance: 1,
        effect: { seniority: 1 },
        result: '老人认真记下了流程，但这一趟还是免不了。',
        upgraded: {
          require: { reputation: 65 },
          text: '直接联系原单位线上核验，当场办结（口碑积累足够，对方愿意配合）',
          performance: 3,
          effect: { reputation: 5, network: 2 },
          result: '你一个电话把两个窗口对接上，老人当天就把事办完了。',
        },
      },
      { text: '先收下材料，内部流转后再答复', performance: 1, effect: { seniority: 1 }, result: '材料收下了，办结时间比预期长了两天。' },
      { text: '让老人先自己去原单位问清楚再来', performance: -1, effect: { reputation: -3 }, result: '老人来回跑了三趟，最后在意见簿上留了一段话。' },
    ],
  },
  {
    tag: '条件强化',
    minRank: 4,
    title: '项目协调 · 部门分歧',
    scene: '两个部门在项目时序上互不相让，都要求对方先出方案。协调会开了两次，纪要上仍然没有结论。',
    options: [
      { text: '按程序报请上级裁定', performance: 1, effect: { seniority: 2 }, result: '裁定下来了，但两个部门之间的配合依旧别扭。' },
      {
        text: '分别沟通，寻找彼此可以交换的条件',
        performance: 1,
        effect: { network: 1 },
        result: '双方各退一步，方案勉强定了下来。',
        upgraded: {
          require: { network: 60 },
          text: '把两边分管领导约到一起，当场把时序和资源一次谈定（人脉足够，双方都愿意给面子）',
          performance: 3,
          effect: { network: 4, reputation: 3, seniority: 1 },
          result: '一次会上把时序、人员和经费全部定死，后续再没有反复。',
        },
      },
      { text: '先推动自己能定的那部分', performance: 1, effect: { seniority: 1, reputation: -1 }, result: '你把自己那部分做完了，整体进度仍在等。' },
    ],
  },

  // ── 概率分支：同样的选择，结果要看当时的状态和一点运气 ──────────────
  {
    tag: '概率',
    minRank: 4,
    title: '项目争取 · 向上汇报',
    scene: '一份项目申请要争取上级支持，送审时间很紧。有人建议先托熟人探探口风，再决定汇报口径。',
    options: [
      {
        text: '托熟人先探口风，再定汇报口径',
        performance: 1,
        effect: { network: 1 },
        result: '你把口径调整得更贴近上级关注点，汇报基本顺利。',
        roll: {
          chance: 0.5,
          attr: 'network',
          perPoint: 0.006,
          success: { performance: 3, effect: { network: 3, reputation: 2 }, result: '熟人把关注点说透了，汇报一次通过，项目进入支持名单。' },
          fail: { performance: -1, effect: { reputation: -2, network: -1 }, result: '探口风的事被传了出去，有人质疑你在走门路，汇报反而受阻。' },
        },
      },
      { text: '按标准格式如实报送，不走旁路', performance: 1, effect: { integrity: 2, seniority: 1 }, result: '材料规范，评审按正常节奏推进。' },
      { text: '在材料里把预期收益写得乐观一些', performance: -1, effect: { integrity: -4, reputation: -1 }, result: '材料看上去更有吸引力，但后续考核要按这个口径兑现。' },
    ],
  },
  {
    tag: '概率',
    minRank: 3,
    title: '突发事件 · 现场处置',
    scene: '一处施工围挡被大风刮倒，砸坏了路边车辆。围观群众情绪激动，事故原因一时说不清楚。',
    options: [
      {
        text: '先清理现场、联系车主，再查原因',
        performance: 1,
        effect: { reputation: 1 },
        result: '现场秩序恢复，车主得到了先行赔付的承诺。',
        roll: {
          chance: 0.55,
          attr: 'reputation',
          perPoint: 0.005,
          success: { performance: 3, effect: { reputation: 5, network: 2 }, result: '处置干净利落，围观群众主动帮着维持秩序，没有形成舆情。' },
          fail: { performance: -1, effect: { reputation: -3, health: -1 }, result: '清理过程中双方争执起来，事情拖到晚上才平息。' },
        },
      },
      { text: '先等专业部门到场定性，再对外说明', performance: 1, effect: { seniority: 2 }, result: '责任划分清楚了，但现场多等了两小时。' },
      { text: '先让施工方自行处理，自己维持外围', performance: -1, effect: { reputation: -3, integrity: -1 }, result: '施工方赔付拖沓，车主把矛头转向了管理部门。' },
    ],
  },
  {
    tag: '概率',
    minRank: 6,
    title: '招商谈判 · 条件博弈',
    scene: '与一家企业谈落户条件，对方在用地和配套上反复加码，谈判已经进行到第三轮。',
    options: [
      {
        text: '在政策范围内测算后给出最终方案',
        performance: 1,
        effect: { network: 1 },
        result: '方案报出后，对方表示需要内部研究。',
        roll: {
          chance: 0.5,
          attr: 'seniority',
          perPoint: 0.006,
          success: { performance: 3, effect: { network: 3, reputation: 2, wealth: 2000 }, result: '对方接受了方案并当场签约，项目按计划落地。' },
          fail: { performance: -1, effect: { network: -2, reputation: -1 }, result: '对方以条件不足为由暂缓，项目被另一地争取了过去。' },
        },
      },
      { text: '请上级出面，提高谈判层级', performance: 1, effect: { seniority: 2, network: 1 }, result: '层级提高了，条件谈判重新开始。' },
      { text: '突破政策底线先签下来', performance: -1, effect: { integrity: -6, network: 2 }, result: '企业签了，但那个超出政策的承诺日后需要逐年兑现。' },
    ],
  },
];

// 补齐原版里只有 1 个事件的岗位池（这些池是"重复感"最重的地方）。
const EXTRA_POSITION_EVENTS = {
  grassroots: [
    {
      tag: '岗位·基层',
      title: '基层事项 · 政策宣传进村',
      scene: '一项新政策要求在半个月内让村民知晓。以往靠贴通知，效果一般，这次要求"入户见人"。',
      options: [
        { text: '组织村干部按片入户，用方言讲清关键条款', performance: 3, effect: { reputation: 5, network: 2, health: -1 }, result: '村民真正听懂了政策，后续办理时的往返明显减少。' },
        { text: '按老办法贴通知、发微信群', performance: 1, effect: { seniority: 1 }, result: '通知发出去了，来咨询的人仍然集中最后两天。' },
        { text: '只做一次集中宣讲，完成规定动作', performance: -1, effect: { reputation: -3 }, result: '宣讲搞了，但入户率不达标，复核时被点了名。' },
      ],
    },
    {
      tag: '岗位·基层',
      title: '基层事项 · 困难家庭走访',
      scene: '季度走访名单里有几户情况比较复杂，有人建议"拍照留痕就行，不用久留"。',
      options: [
        { text: '逐户坐下来聊，把实际困难记下来并对接政策', performance: 3, effect: { reputation: 5, integrity: 2 }, result: '两户符合条件却一直没申请的家庭被纳入了救助。' },
        { text: '按名单走完，重点户多留一会儿', performance: 1, effect: { seniority: 1, reputation: 1 }, result: '走访任务完成了，有一户的隐性困难当时没被发现。' },
        { text: '拍照留痕为主，不耽误下村的其他安排', performance: -1, effect: { reputation: -4 }, result: '照片齐了，但走访流于形式，被抽查时答不上具体情况。' },
      ],
    },
    {
      tag: '岗位·基层',
      title: '基层事项 · 窗口排队',
      scene: '便民窗口一位工作人员请假，排队的人越来越多，有人开始抱怨。你正好经过。',
      options: [
        { text: '临时坐到窗口帮忙，同时通知后台增派人手', performance: 3, effect: { reputation: 5, network: 2, health: -1 }, result: '队伍很快短了下来，群众的不满也消了大半。' },
        { text: '联系分管领导协调增派人手', performance: 1, effect: { seniority: 2 }, result: '人手到得稍晚，队伍等了一段时间但秩序没乱。' },
        { text: '记录情况，回到办公室再研究改进', performance: -1, effect: { reputation: -3 }, result: '问题被记下来了，但排队的群众当天并没有得到解决。' },
      ],
    },
  ],
  executive: [
    {
      tag: '岗位·综合',
      title: '岗位专项 · 民生工程推进',
      scene: '两项民生工程同时推进，一项进度落后，群众已有反映；另一项进度正常但资金偏紧。',
      options: [
        { text: '把资源集中到落后工程，先解决群众反映的问题', performance: 3, effect: { reputation: 4, network: 2, seniority: -1 }, result: '落后工程追上了节点，群众反映明显减少。' },
        { text: '两项均衡推进，按原计划调度资金', performance: 1, effect: { seniority: 2 }, result: '两项都在推进，但落后那一项的群众仍在反复询问。' },
        { text: '先保资金偏紧的项目，避免停工', performance: 1, effect: { network: 1, reputation: -1 }, result: '资金链没有断，但群众反映的问题又拖了一个月。' },
      ],
    },
    {
      tag: '岗位·综合',
      title: '岗位专项 · 信访积案化解',
      scene: '一件拖了三年的信访积案交到你手上，前任已调离，卷宗不全，当事人情绪很大。',
      options: [
        { text: '重新逐项核对事实，能查清的先查清，再当面答复', performance: 3, effect: { reputation: 5, integrity: 2, health: -1 }, result: '三年没查清的关键事实被理了出来，当事人接受了处理意见。' },
        { text: '按现有卷宗维持原结论，做好解释工作', performance: 1, effect: { seniority: 1 }, result: '答复作出了，当事人表示仍将向上反映。' },
        { text: '先安抚情绪，承诺研究，暂不作结论', performance: -1, effect: { reputation: -3 }, result: '情绪暂时压住，积案又多拖了一个季度。' },
      ],
    },
    {
      tag: '岗位·综合',
      title: '岗位专项 · 年度预算申报',
      scene: '各部门报上来的预算需求远超可用额度，需要你来压缩，每一项都有人来说"砍不得"。',
      options: [
        { text: '按轻重缓急排序，公开压减标准和依据', performance: 3, effect: { integrity: 3, reputation: 2, network: -2 }, result: '压减结果虽然得罪人，但因为标准公开，争议没有扩大。' },
        { text: '按比例统一压减，不做取舍', performance: 1, effect: { seniority: 2 }, result: '各方都能接受，但重点项目也被平均掉了一部分资源。' },
        { text: '给打招呼的部门多留一些', performance: -1, effect: { network: 3, integrity: -5, reputation: -2 }, result: '关系户满意了，压减方案的公正性却在圈内受到质疑。' },
      ],
    },
  ],
  discipline: [
    {
      tag: '岗位·纪检',
      title: '岗位专项 · 问题线索处置',
      scene: '收到一条反映某单位负责人的问题线索，材料比较零散，反映人要求匿名。',
      options: [
        { text: '按程序初步核实，不惊动被反映人，实事求是得出结论', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '核实后既不放过问题，也没有冤枉人，结论经得起复核。' },
        { text: '先谈话提醒，观察后续情况', performance: 1, effect: { integrity: 1, seniority: 1 }, result: '提醒起到了作用，但线索本身没有形成完整结论。' },
        { text: '把线索内容透露给被反映人，让其自行处理', performance: -1, effect: { integrity: -8, reputation: -3 }, result: '消息走漏了，反映人从此不再配合，线索也查不下去了。' },
      ],
    },
    {
      tag: '岗位·纪检',
      title: '岗位专项 · 廉政教育安排',
      scene: '要在本单位组织一次廉政教育，可选择通报案例、观看警示片，或结合本单位实际开展岗位风险排查。',
      options: [
        { text: '结合本单位岗位实际做风险排查，逐岗列出风险点', performance: 3, effect: { integrity: 3, reputation: 2, seniority: 1 }, result: '排查出了几处此前没人注意的风险点，并被明确整改责任。' },
        { text: '按惯例组织观看警示片并签到', performance: 1, effect: { seniority: 1 }, result: '教育按要求完成了，参与者的反应比较平淡。' },
        { text: '临时改为开会传达文件，缩短时间', performance: -1, effect: { reputation: -3, integrity: -1 }, result: '会议开得很短，但"走过场"的评价也传了出去。' },
      ],
    },
  ],
  department: [
    {
      tag: '岗位·部门',
      title: '岗位专项 · 行业专项治理',
      scene: '上级部署本行业专项治理，要求在一个月内完成自查并上报问题清单。自报问题多的单位会被重点跟进。',
      options: [
        { text: '如实上报自查问题，同步提交整改方案', performance: 3, effect: { integrity: 4, reputation: 2 }, result: '清单报得实在，整改也同步推进，后续跟进顺利。' },
        { text: '只报不痛不痒的问题，把主要问题留待后续', performance: -1, effect: { integrity: -5, reputation: -1 }, result: '清单好看了，但专项治理"回头看"时问题集中暴露。' },
        { text: '先报已整改完毕的问题，未完成的列时间表', performance: 1, effect: { integrity: 1, seniority: 1 }, result: '上报与实际进度基本匹配，没有引起额外关注。' },
      ],
    },
    {
      tag: '岗位·部门',
      title: '岗位专项 · 下属单位考核',
      scene: '年度考核要打分，一家单位工作扎实但材料做得差，另一家材料漂亮但实绩平平。',
      options: [
        { text: '以实地核查的实绩为主，材料只作参考', performance: 3, effect: { integrity: 3, reputation: 3 }, result: '打分结果与实际情况相符，基层对这个导向很认可。' },
        { text: '实绩与材料各占一半，综合打分', performance: 1, effect: { seniority: 1 }, result: '两家分数接近，谁都没有明显不满。' },
        { text: '倾向材料完整的那家，避免日后被挑毛病', performance: -1, effect: { integrity: -4, reputation: -2 }, result: '考核结果出来了，但"重材料不重实绩"的说法开始流传。' },
      ],
    },
  ],
  city: [
    {
      tag: '岗位·城市',
      title: '岗位专项 · 城市更新摸底',
      scene: '老城区更新要摸底，涉及上千户居民。全面入户耗时耗力，抽样调查又快但代表性不足。',
      options: [
        { text: '分片全面入户，同步建立一户一档', performance: 3, effect: { reputation: 4, network: 2, health: -2 }, result: '底数清楚了，后续方案调整时少了大量返工。' },
        { text: '先做抽样，再对重点片区入户', performance: 1, effect: { seniority: 2 }, result: '摸底按时完成，个别片区的特殊情况后续才发现。' },
        { text: '调用既有台账数据，不再入户', performance: -1, effect: { reputation: -4 }, result: '效率很高，但数据与现状已经脱节，方案发布后出现争议。' },
      ],
    },
    {
      tag: '岗位·城市',
      title: '岗位专项 · 企业座谈会',
      scene: '企业家座谈会上，几家企业集中反映审批环节多、时间长，希望市里"特事特办"。',
      options: [
        { text: '逐项梳理流程堵点，承诺时限并公开办理标准', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '堵点被逐项拆解，办理时限压缩后，类似反映明显减少。' },
        { text: '记录问题，会后转相关部门研究', performance: 1, effect: { seniority: 2 }, result: '问题转办下去了，企业短期内没有看到变化。' },
        { text: '口头答应个别企业特事特办', performance: -1, effect: { integrity: -5, network: 2 }, result: '个别企业得到了优先，其他企业得知后意见更大。' },
      ],
    },
  ],
  national: [
    {
      tag: '岗位·国家层面',
      title: '岗位专项 · 跨区域协调',
      scene: '两地在同一事项上政策口径不一致，企业往返两地多次仍无法办结，媒体开始关注。',
      options: [
        { text: '牵头建立统一口径并明确办结时限，向社会公开', performance: 3, effect: { integrity: 3, reputation: 4, network: 2 }, result: '口径统一后，企业一次办结，同类问题也有了明确规则。' },
        { text: '协调两地各让一步，个案解决', performance: 1, effect: { network: 2, seniority: 1 }, result: '这一件办结了，但换一家企业仍会遇到同样的问题。' },
        { text: '建议企业按其中一地口径重新申报', performance: -1, effect: { reputation: -4 }, result: '企业被迫重来一遍，舆情进一步发酵。' },
      ],
    },
    {
      tag: '岗位·国家层面',
      title: '岗位专项 · 政策效果评估',
      scene: '一项已实施的政策要求评估效果，基层反映与统计数据存在明显差异。',
      options: [
        { text: '组织实地调研，把基层反映的情况一并写入评估报告', performance: 3, effect: { integrity: 4, reputation: 3 }, result: '报告如实反映了差异，政策后续做了针对性调整。' },
        { text: '以统计数据为主，注明存在地区差异', performance: 1, effect: { seniority: 2 }, result: '报告顺利通过，但基层反映的问题仍未进入决策视野。' },
        { text: '按预期效果口径撰写，避免引起不必要的讨论', performance: -1, effect: { integrity: -6, reputation: -2 }, result: '报告很好看，但政策偏差在后面两年里持续累积。' },
      ],
    },
  ],
  province_lead: [
    {
      tag: '岗位·省级',
      title: '岗位专项 · 重大风险排查',
      scene: '辖区内一项重点领域被排查出多处风险隐患，涉及多个地市，整改需要动真格。',
      options: [
        { text: '挂牌督办，逐项明确责任人和完成时限', performance: 3, effect: { integrity: 4, reputation: 4, network: -2 }, result: '隐患逐项销号，整改情况每月通报，进度真实可见。' },
        { text: '召开专题会议部署，要求各地市自行整改', performance: 1, effect: { seniority: 2 }, result: '会议开了，各地进度不一，部分隐患整改流于形式。' },
        { text: '考虑影响面，先内部提示，不上报不督办', performance: -1, effect: { integrity: -7, reputation: -3 }, result: '风险被暂时压住，一处隐患在半年后演变成事故。' },
      ],
    },
    {
      tag: '岗位·省级',
      title: '岗位专项 · 干部队伍建设',
      scene: '多地反映基层人手紧、任务重，同时存在忙闲不均、借调过多的问题。',
      options: [
        { text: '清理违规借调，重新核定基层编制与任务清单', performance: 3, effect: { integrity: 3, reputation: 4, network: -2 }, result: '借调人员回流，基层力量得到补充，忙闲不均有所缓解。' },
        { text: '要求各地市自行优化，省里定期调度', performance: 1, effect: { seniority: 2 }, result: '调度进行了几轮，问题改善有限。' },
        { text: '维持现状，避免触动各方利益', performance: -1, effect: { reputation: -4, integrity: -2 }, result: '队伍问题继续积累，基层意见越来越大。' },
      ],
    },
  ],
};

module.exports = { EXTRA_COMMON_EVENTS, EXTRA_POSITION_EVENTS };

},
"game/events-rich": function(module, exports, require) {
// 扩展随机事件库：每个事件只在一段人生故事里出现一次，由 core.js 的 burstHistory 去重。
// 这些是虚构的日常工作场景；财富效果统一使用 wealth，由 core.applyEffect 映射到现金账户。
//
// 为什么不再用"主题 × 变体"批量生成：生成出来的几十条事件共用同一组三选项，
// 玩家很快就会觉得"选来选去就那几样"。突发事件的价值恰恰在于"意料之外"，
// 所以这一批全部手写，并且刻意让选项结构彼此不同：
//   有的两条是两难、有的四条要排序、有的带概率分支（roll）、
//   有的平时攒的属性够高才有第三条路（upgraded）、有的会结网（bond）或割席（sever）。
//
// 受贿类事件的风险痕迹不手写死：core.resolveBurst 会按
// 「每 1 万元意外收入 ≈ +1 点往来痕迹（至少 1 点、封顶 10；结下关系网的再 +1）」
// 统一重算，保证"拿多少东西、冒多大风险"永远成正比，并在结果里当场写出这笔账。
// 手写的 risk 只在"没进账"的选项上生效（退还、主动说明、自掏腰包补上）。

// ── 手写突发事件（结构刻意彼此不同）─────────────────────────────────
const HAND_WRITTEN_BURST_EVENTS = [
  {
    tag: '围猎', minRank: 3, weight: 3,
    title: '加油卡里的余额',
    scene: '司机把一张加油卡放到你桌上，说是几个老板凑钱办的，里头余额不低。"公车私车都是一个加法，查不出来。"',
    options: [
      { text: '退回加油卡，并让车队核查同类卡', effect: { integrity: 4, reputation: 1, network: -1 }, risk: 0, result: '卡退了回去，车队顺手清了一遍，这种卡从此在车队里绝迹。' },
      { text: '只用公车该用的那一部分，余额退回', effect: { integrity: -1 }, risk: 1, result: '卡用了一半退了一半，账面上说得过去，你自己知道边界挪了多少。' },
      { text: '收下，家里人加油也方便', effect: { integrity: -6, wealth: 6000, network: 1 }, risk: 1, result: '加油卡进了钱包，每次掏出来，你都会想起那句"查不出来"。' },
    ],
  },
  {
    tag: '受贿', minRank: 4, weight: 3,
    title: '低于市价的二手房',
    scene: '一套二手房源以明显低于市价的价格"只卖给有缘人"。房主你认识——正是你分管领域里一家企业的负责人。',
    options: [
      {
        text: '婉拒，让中介按正常市场渠道挂牌',
        effect: { integrity: 3, reputation: 1 },
        risk: 0,
        result: '房子你另找了，多花了钱，也少了一个说不清的邻居。',
        upgraded: {
          require: { integrity: 80 },
          text: '当面讲清纪律要求，请对方收回这套房的人情',
          performance: 0,
          effect: { integrity: 5, reputation: 2, network: -2 },
          result: '你把话说得很透，对方愣了一下，此后对你规矩了很多。平时攒下的廉洁名声，让你连拒绝都可以拒绝得体面。',
        },
      },
      { text: '让亲属出面去看房', effect: { integrity: -4, network: 2 }, risk: 3, result: '房子最后没买，但"亲属去看过房"这件事本身已经传了出去。' },
      { text: '收下这份"优惠"', effect: { integrity: -9, wealth: 80000, network: 2 }, risk: 11, bond: { kind: 'fellow', weight: 2, reason: '那套只卖给有缘人的房子' }, result: '差价足够装一次修。你也清楚，从过户那天起，这套房子就一直停在别人的账本上。' },
    ],
  },
  {
    tag: '投资', minRank: 3, weight: 3,
    title: '老同学的原始股',
    scene: '老同学的公司"马上要上一轮融资"，给你留了一份原始股份额。"稳赚，就看你敢不敢要。"',
    options: [
      { text: '明确拒绝，不碰分管领域的任何股权', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '老同学骂你不识抬举，电话挂得很难看，但你晚上睡得很沉。' },
      {
        text: '让配偶出面代持，自己不露面',
        effect: { integrity: -6, wealth: 40000, network: 2 },
        risk: 5,
        result: '代持协议签得很隐蔽，但融资材料上的联系人是瞒不住的。',
        roll: {
          chance: 0.45,
          attr: 'integrity',
          perPoint: 0.004,
          success: { effect: { wealth: 40000 }, result: '这轮融资顺利完成，账面浮盈。你每次看到那笔钱，都会下意识地锁上抽屉。' },
          fail: { effect: { integrity: -3, reputation: -2 }, result: '监管问询函里点到了"亲属代持"四个字，你连夜把股份转了出去，割在了最低点。' },
        },
      },
      { text: '介绍给毫不相干的亲戚，自己分文不沾', effect: { integrity: -2, network: 1 }, risk: 1, result: '亲戚赚没赚不知道，但你至少可以如实说：自己没有一股。' },
    ],
  },
  {
    tag: '意外', minRank: 2, weight: 2,
    title: '凌晨两点的挡墙垮塌',
    scene: '电话把你叫醒：辖区一处挡墙被夜雨冲垮，压坏了下方停放的三辆车，所幸无人伤亡。已经有媒体在往现场赶。',
    options: [
      {
        text: '立即赶赴现场，先撤人设警戒，再处理车辆',
        effect: { reputation: 4, health: -2 },
        risk: 0,
        result: '你到的时候雨还没停，警戒线拉起来之后，第二波垮塌落在了空车里。',
        roll: {
          chance: 0.6,
          attr: 'reputation',
          perPoint: 0.005,
          success: { effect: { reputation: 3, network: 2 }, result: '现场处置的视频被居民自发传开，评论区第一次全是表扬。' },
          fail: { effect: { reputation: -1, health: -1 }, result: '忙到天亮，车主对定损流程仍有怨言，你在现场站了整整六个小时。' },
        },
      },
      { text: '电话调度应急条线处理，自己盯到天亮', effect: { seniority: 2, health: -1 }, risk: 0, result: '处置没有断档，只是第二天复盘会上，"主要领导未到现场"被记录在案。' },
      { text: '让值班人员先到场顶着', effect: { reputation: -3, network: -1 }, risk: 1, result: '值班员处理得不算差，但"凌晨找不到领导"这句话传得比垮塌本身还快。' },
      { text: '等天亮再说，夜间处置容易出乱子', effect: { reputation: -5, integrity: -2 }, risk: 2, result: '天亮时第二波垮塌来了，所幸夜里没人靠近。这个侥幸没有写进汇报，却写进了你的心里。' },
    ],
  },
  {
    tag: '结网', minRank: 5, weight: 2,
    title: '老领导的孩子想进来',
    scene: '退休的老领导托人带话：小儿子想到你单位的二级机构，"条件都够，就差个机会"。',
    options: [
      { text: '一律走公开招聘，一个字不多说', effect: { integrity: 4, reputation: 2, network: -2 }, risk: 0, result: '孩子没进面试。老领导从此不再给你打电话，但招聘公告谁都挑不出毛病。' },
      { text: '让他正常报名，你按规定回避', effect: { integrity: -2, network: 2 }, risk: 2, result: '你确实回避了，可谁都知道面试的人当年是谁提拔的。' },
      { text: '打招呼安排进二级机构', effect: { integrity: -8, network: 3, reputation: -2 }, risk: 6, bond: { kind: 'protege', weight: 2, reason: '老领导的儿子进了二级机构' }, result: '人进来了，能力也还行。只是从这天起，你在老领导面前再也说不了"不"。' },
    ],
  },
  {
    tag: '两难', minRank: 4, weight: 2,
    title: '检查组来的前一晚',
    scene: '明天上午检查组到。晚上十点，分管领导让你"把今天下午的会议纪要补一下"——那场会实际上没有开成。',
    options: [
      { text: '不补，如实向检查组说明会议未召开', effect: { integrity: 5, reputation: -2, network: -2 }, risk: 0, result: '检查组把"会议未实际召开"写进了反馈，也把"如实说明"写进了评价。领导的脸很难看。' },
      { text: '补纪要，注明系事后补记并请参会人确认', effect: { integrity: 1, seniority: 1 }, risk: 1, result: '纪要里多了一行小字。程序上能对过去，但那场会终究是没有开。' },
      { text: '补一份"开过"的纪要，把人叫回来补签', effect: { integrity: -5, network: 2 }, risk: 3, result: '十个人在同一个晚上补签了同一份纪要，每个人的签名时间都那么整齐。' },
    ],
  },
  {
    tag: '受贿', minRank: 4, weight: 3,
    title: '住院时的信封',
    scene: '家人住院，一位管理服务对象赶到医院探望，留下一个厚信封，说"给病人买点营养品"，放下就走。',
    options: [
      { text: '追出去当场退还', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '你在电梯口追上了他。他红着脸收回去，此后再没来探过病。' },
      { text: '交护士站代管并做记录', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '信封在护士站放了一周，最后由单位按程序退回。病友们都夸你规矩。' },
      { text: '收下，住院正是用钱的时候', effect: { integrity: -6, wealth: 45000, network: 1 }, risk: 3, result: '营养品买了很多，账单也付得起。出院那天，你把那个信封的来路想了很久。' },
    ],
  },
  {
    tag: '家庭', minRank: 3, weight: 2,
    title: '配偶想去你分管的领域上班',
    scene: '配偶提出辞掉现在的工作，去你分管领域的一家民企做管理岗，收入翻倍，"专业完全对口"。',
    options: [
      { text: '明确反对，要求避开你的分管领域', effect: { integrity: 3, affection: -2 }, risk: 0, result: '家里冷战了一周，最后配偶去了别的行业。收入没翻倍，饭桌上的话却多了。' },
      { text: '建议去外地或无关行业，帮着一起改简历', effect: { integrity: 1, affection: 1, reputation: 1 }, risk: 0, result: '简历改到深夜，新工作离钱远了一点，离你近了一点。' },
      { text: '不干涉，让她自己决定', effect: { integrity: -5, affection: 2, network: 1 }, risk: 3, result: '入职那天起，你的每一次签字都自动带上了她的名字。' },
    ],
  },
  {
    tag: '围猎', minRank: 6, weight: 3,
    title: '会所里的"同学会"',
    scene: '一场以"母校情谊"为名的聚会。到了才发现，同桌大半是你分管领域的企业负责人，买单的人没有人认识。',
    options: [
      { text: '当场离席，事后向办公室报备', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '你起身时全桌安静了几秒。第二天报备记录写得清清楚楚，那场饭后来被查过，你是桌上唯一干净的。' },
      { text: '坐一会儿，坚持把单抢过来自己付', effect: { integrity: -1, network: 1 }, risk: 1, result: '单是你买的，但照片是别人拍的。饭桌上谁跟谁是什么关系，几周后你想不全了。' },
      { text: '尽兴而归', effect: { integrity: -7, network: 3, reputation: -2 }, risk: 5, bond: { kind: 'fellow', weight: 2, reason: '那场说不清谁买单的聚会' }, result: '那晚加了五个微信。后来每一个都在不同的时候，让你"方便的时候关照一下"。' },
    ],
  },
  {
    tag: '结网', minRank: 7, weight: 1,
    title: '风口上的老同事',
    scene: '一位老同事上周被有关部门带走。被带走前，他曾托你"照看他名下的一家公司"；今天，他的家属又找到了你。',
    options: [
      { text: '向组织如实报告这两次接触，并配合说明', effect: { integrity: 5, reputation: 2, network: -3 }, risk: -1, sever: { count: 1, kind: 'fellow' }, result: '你把两次接触的时间地点原原本本讲清楚，主动切断了和他关联的所有往来。材料交上去那天，你睡了这个月第一个整觉。' },
      { text: '只说工作往来，不提那次托付', effect: { integrity: -4, network: 1 }, risk: 4, result: '问询结束了。但"没提托付"这件事，从此成了你和档案之间的一根刺。' },
      { text: '帮家属打招呼，让公司"平稳过渡"', effect: { integrity: -8, network: 3 }, risk: 7, bond: { kind: 'fellow', weight: 2, reason: '替被带走的人照看公司' }, result: '公司真的平稳了。你也成了那份案卷里下一个被约谈的名字。' },
      { text: '不接触也不报告，就当不知道', effect: { integrity: -2, reputation: -1 }, risk: 2, result: '家属又来过两次，你都没见。沉默不是证据，但你比谁都清楚它是什么。' },
    ],
  },
  {
    tag: '两难', minRank: 9, weight: 3,
    title: '名单上那个有反映的人',
    scene: '讨论干部任免时，你手里那份名单上有一个名字被反复提起：能干事，也确实有人反映。主要领导问你："这个人，你怎么看？"',
    options: [
      { text: '如实说明反映内容，建议暂缓', effect: { integrity: 5, reputation: 2, network: -2 }, risk: 0, result: '你把反映的内容和核查进度都摆了出来。名单暂时压住了，会上没人反对，也没人附和。' },
      { text: '只谈实绩，不提反映', effect: { integrity: -2, network: 2 }, risk: 2, result: '你讲了半小时他的项目。表决通过了，会后有个人拍了拍你的肩膀，你没看清是谁。' },
      { text: '明确表态可以用，出了问题我负责', effect: { integrity: -6, network: 3, reputation: -1 }, risk: 5, bond: { kind: 'protege', weight: 3, reason: '你在任免会上替他担了保' }, result: '他上了。你那句"我负责"被会议记录原原本本地记了下来，往后每一次出事，都会有人翻到这一页。' },
      { text: '建议先核查清楚，再上会讨论', effect: { integrity: 3, seniority: 1 }, risk: 0, result: '事情往后推了一个月。核查结论出来时，问题已经不是问题了。' },
    ],
  },
  {
    tag: '围猎', minRank: 10, weight: 3,
    title: '孩子留学那笔钱的来路',
    scene: '孩子拿到了境外学校的录取通知，学费不是小数目。一位"老朋友"主动提出帮忙："钱我先垫上，等你方便再说。"',
    options: [
      { text: '婉拒，按家庭实际能力选学校', effect: { integrity: 5, reputation: 2, affection: -2 }, risk: 0, result: '孩子去了另一所学校，学费低了一半。开学那天他发的朋友圈，你看了很多遍。' },
      {
        text: '接受垫付，日后再还',
        effect: { integrity: -8, wealth: 400000, network: 3 },
        risk: 6,
        bond: { kind: 'fellow', weight: 3, reason: '替你垫付的那笔学费' },
        result: '钱到账了，孩子出了国。你算过一遍，按你的工资，这笔钱要还到退休以后——对方却从没提过还的事。',
        roll: {
          chance: 0.4,
          attr: 'integrity',
          perPoint: 0.004,
          success: { effect: { integrity: 2 }, result: '你在第二年硬是把这笔钱凑齐还了回去，对方收下时脸色很难看，从此不再来往。' },
          fail: { effect: { integrity: -4 }, result: '"方便再说"这四个字，后来被翻译成了一件又一件具体的事。' },
        },
      },
      { text: '向组织报告这一情况', effect: { integrity: 4, reputation: 1, network: -3 }, risk: -1, sever: { count: 1, kind: 'fellow' }, result: '你把这通电话的时间、内容和对方姓名都写了下来交上去。此后这类电话再没打来过第二个。' },
    ],
  },
  {
    tag: '结网', minRank: 8, weight: 3,
    title: '那个几十亿的项目要不要上',
    scene: '一个体量极大的项目等你拍方向。论证材料很漂亮，反对意见只有一句：这地方十年内可能用不了这么大的量。',
    options: [
      {
        text: '先做独立评估，再决定要不要上',
        effect: { integrity: 3, reputation: 1 },
        risk: 0,
        result: '评估跑了半年，规模压掉了三分之一。批下来的那天，没有人再提那句反对意见。',
        upgraded: {
          require: { seniority: 60 },
          text: '顶住压力，按压缩后的方案上报',
          effect: { integrity: 5, reputation: 3, seniority: 2 },
          result: '你在会上把十年用不了这么大量的那句话原样说了出来。会后有老同事说你"不像从前了"，你说是，从前没坐在这个位置上。',
        },
      },
      { text: '按原方案上报，先把项目拿下来', effect: { reputation: 2, seniority: 2, network: 2 }, risk: 2, result: '项目批了下来，开工那天场面很大。三年后产能利用率的数字，你每次开会都尽量不去看。' },
      { text: '顺着上面的意思办，不提反对意见', effect: { integrity: -4, network: 3, seniority: 1 }, risk: 3, result: '你什么都没说，也就等于说了。这个项目的每一道审批上都有你的名字。' },
    ],
  },
  {
    tag: '受贿', minRank: 6, weight: 3,
    title: '招标文件里那串技术参数',
    scene: '一份招标文件送到你桌上，技术参数细得反常，几乎只对应一家企业。起草人是你的老部下，他说这是"沿用上一版的模板"。',
    options: [
      { text: '退回重写，参数改成通用指标', effect: { integrity: 4, reputation: 2, network: -1 }, risk: 0, result: '文件退回去了，来了四家投标。中标价比上一次低了两成。' },
      { text: '只要求在公告里补充说明条款', effect: { integrity: -1, seniority: 1 }, risk: 1, result: '补充条款写得很漂亮，但懂行的人一眼就看得出参数是谁写的。' },
      { text: '照签，不追问参数的来源', effect: { integrity: -7, wealth: 60000, network: 2 }, risk: 7, bond: { kind: 'fellow', weight: 2, reason: '那串只对应一家的参数' }, result: '你签了字。开标结果和一个月前有人跟你提过的一模一样。' },
      { text: '把这件事交给纪检和审计去核', effect: { integrity: 3, reputation: 1, network: -2 }, risk: 0, result: '核查期间招标暂停了三周。老部下从此见你就绕着走。' },
    ],
  },
  {
    tag: '意外', minRank: 5, weight: 2,
    title: '你拍板的那条路出了事故',
    scene: '你力排众议推的那条路，通车不到半年，一段路基沉降，一辆车侧翻，两人受伤。记者已经在现场。',
    options: [
      {
        text: '先救人、先封路，当晚就把初步原因公开',
        effect: { reputation: 2, integrity: 2, health: -2 },
        risk: 0,
        result: '你在现场待到天亮。通报里写清了"设计时对地质情况估计不足"，也写了责任单位。',
        roll: {
          chance: 0.55,
          attr: 'reputation',
          perPoint: 0.005,
          success: { effect: { reputation: 3, seniority: 1 }, result: '事故处置和原因公开都算及时，事故调查组的结论里没有出现你的名字。' },
          fail: { effect: { reputation: -2 }, result: '通报发了，但"抢工期"的说法已经在网上传开，你被叫去说明了两次。' },
        },
      },
      { text: '先内部查清责任，再统一口径', effect: { reputation: -2, seniority: 1 }, risk: 1, result: '口径统一了，通报晚了三天。三天里的猜测，比事故本身更难收拾。' },
      { text: '把责任压给施工单位，自己不出面', effect: { integrity: -5, reputation: -3, network: 1 }, risk: 3, result: '施工单位承担了全部责任。那个项目经理后来托人带话，说他还留着当年催进度的所有会议纪要。' },
    ],
  },
  {
    tag: '举报', minRank: 3, weight: 2,
    title: '有人在外面用你的名字办事',
    scene: '一个陌生号码打来："我们是某某公司的，和您单位王主任合作很久了。"你单位根本没有姓王的主任，但对方一口一个"您那边"。',
    options: [
      { text: '当场说明身份并报警备案', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '备案回执你留了一份。后来那家公司真的出过事，你这份回执救了你一次。' },
      { text: '通过单位正式发函要求对方澄清', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '函发出去了，对方回了一封措辞谨慎的说明，从此再没打来过。' },
      { text: '不理会，反正不是自己', effect: { integrity: -3, reputation: -2 }, risk: 2, result: '你挂了电话。半年后有人拿着那段通话记录来问你："这个王主任，是不是就是你？"' },
    ],
  },
  {
    tag: '家庭', minRank: 2, weight: 2,
    title: '驻村最后一年的考核表',
    scene: '驻村满两年，考核表上要填"办成了哪几件事"。你手上的台账很薄，但村口那条路确实修起来了，只是还没验收。',
    options: [
      { text: '如实填写，附上未完工的说明', effect: { integrity: 3, reputation: 1, seniority: -1 }, risk: 0, result: '考核结果是"称职"，不是"优秀"。回城那天，村支书一直把你送到路口。' },
      { text: '把别的村的项目算进自己的台账', effect: { integrity: -4, reputation: 2, seniority: 2 }, risk: 2, result: '表交上去评了优秀。后来有人去那条路上看过一次，问的不是路修得好不好，是台账上写的是谁修的。' },
      { text: '请村里出一份证明，把在建工程写清楚', effect: { integrity: 2, reputation: 1 }, risk: 0, result: '证明材料附在表后，验收通过那年你已经调走了，村里还是把消息发给了你。' },
    ],
  },
  {
    tag: '意外', minRank: 4, weight: 2,
    title: '体检报告上的那个阴影',
    scene: '体检报告上有一个小结节，医生建议三个月后复查。同一周，你手上有两个项目要在三个月内落地。',
    options: [
      { text: '按医生说的去复查，工作重新排', effect: { health: 5, reputation: -1, seniority: -1 }, risk: 0, result: '复查结果是良性。你把两个项目中的一个交了出去，进度慢了，人还在。' },
      { text: '先忙完这三个月', effect: { health: -6, seniority: 2, reputation: 1 }, risk: 0, result: '项目按时落地了。三个月后你去医院，医生说："怎么现在才来。"' },
    ],
  },
  {
    tag: '两难', minRank: 11, weight: 3,
    title: '巡视组请你去谈一次话',
    scene: '巡视组进驻的第三周，通知你"去谈一谈"。提纲里一半是你分管过的项目，另一半是几个你很久没有联系的名字。',
    options: [
      { text: '如实说明，能提供的材料当场交出去', effect: { integrity: 5, reputation: 2, network: -3 }, risk: -1, sever: { count: 1, kind: 'fellow' }, result: '谈了整整一下午。你走的时候，桌面上的材料比来时厚了一倍。此后你被叫去谈过两次，谈的都是同一批事，答案没有变过。' },
      { text: '只谈项目本身，回避与那几个人的往来', effect: { integrity: -5, network: 1 }, risk: 4, result: '你把每个项目的来龙去脉讲得很细。问到那几个人时，你说"工作上有过接触"。这句话被原样记了下来。' },
      { text: '请组织给时间准备，约定下周再谈', effect: { seniority: 1, reputation: -1 }, risk: 1, result: '一周里你把十年间的批示翻了一遍。再谈时你说得清楚，只是这份清楚来得太晚了些。' },
      { text: '托人递话，请上面把范围收一收', effect: { integrity: -8, network: 2 }, risk: 6, result: '递话的人回了一句"知道了"。谈话范围确实小了一点，但"有人递过话"这件事，比原来的问题更难解释。' },
    ],
  },
  {
    tag: '受贿', minRank: 8, weight: 4, largeBribe: true,
    title: '工程顾问费的银行卡',
    scene: '一个重大工程通过评审后，项目方送来一张所谓“顾问费”银行卡，暗示这只是对你长期协调工作的感谢。',
    options: [
      { text: '当场拒绝并将接触情况书面报备', effect: { integrity: 5, reputation: 2, network: -2 }, risk: -1, result: '银行卡没有离开会议室，书面报备当天入档。项目方此后不再试探你的边界。' },
      { text: '让办公室暂时代收，等项目结束再处理', effect: { integrity: -4, network: 2 }, risk: 4, result: '卡没有进你的口袋，却在办公室保险柜里停了很久。谁都说不清这算拒绝还是等待。' },
      { text: '收下所谓顾问费', effect: { integrity: -16, wealth: 800000, network: 3 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '工程通过后的顾问费银行卡' }, result: '钱到账后，对方没有再提感谢，只把下一项工程的材料送到了你桌上。' },
    ],
  },
  {
    tag: '受贿', minRank: 9, weight: 4, largeBribe: true,
    title: '境外考察后的收益凭证',
    scene: '一次境外考察结束后，中间人拿出一份收益凭证，称这是合作方预留的“长期回报”，不需要你投入本金。',
    options: [
      { text: '拒收并要求全团补交利益冲突说明', effect: { integrity: 5, reputation: 2, network: -2 }, risk: -1, result: '凭证被退回，所有人补签了说明。有人埋怨你把事情闹大，也没人再敢把这类东西递过来。' },
      { text: '只退回自己的那份，不追问其他人', effect: { integrity: 1, reputation: -1 }, risk: 1, result: '你自己的账面干净了，但这次考察留下的问题没有真正查清。' },
      { text: '接受这份长期回报', effect: { integrity: -18, wealth: 1500000, network: 3 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '境外考察后的收益凭证' }, result: '收益很快兑现。合作方再来时，谈的已经不是感谢，而是需要你拍板的具体事项。' },
    ],
  },
  {
    tag: '受贿', minRank: 10, weight: 4, largeBribe: true,
    title: '旧城改造的感谢份额',
    scene: '旧城改造方案落定后，一名关联方表示给你留了一份无需出资的项目收益份额，说所有手续都由他们处理。',
    options: [
      { text: '明确拒绝，并提请重新核查关联方资格', effect: { integrity: 6, reputation: 3, network: -3 }, risk: -1, result: '核查让项目晚了一个月，也排除了一家关系说不清的公司。你的名字没有出现在任何收益文件上。' },
      { text: '不签字，但默许家人继续接触', effect: { integrity: -8, network: 2 }, risk: 6, result: '你没有签字，家人的接触记录却一条不少。项目每推进一步，这些记录就更重一点。' },
      { text: '接受无需出资的收益份额', effect: { integrity: -22, wealth: 3000000, network: 4 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '旧城改造里的感谢份额' }, result: '第一笔收益到账时，你已经无法再声称自己只是正常推动项目。' },
    ],
  },
  {
    tag: '受贿', minRank: 11, weight: 5, largeBribe: true,
    title: '重大项目落定后的代持协议',
    scene: '重大项目最终落定，一位多年往来的负责人送来一份代持协议，称这是最后一次感谢，此后彼此两清。',
    options: [
      { text: '拒绝签署，主动提交协议并申请回避后续事项', effect: { integrity: 6, reputation: 3, network: -4 }, risk: -2, result: '协议成为调查项目方的线索。你退出了后续决策，却保住了此前所有决定的清白。' },
      { text: '烧掉协议，当作从未见过', effect: { integrity: -10, reputation: -2 }, risk: 7, result: '纸烧掉了，对方手里的副本还在。你没有拿钱，却把主动权留给了别人。' },
      { text: '签下代持协议', effect: { integrity: -28, wealth: 5000000, network: 4 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '重大项目落定后的代持协议' }, result: '协议签完，对方只说了一句“以后就是自己人”。所谓两清，从这一刻变成了彻底绑在一起。' },
    ],
  },
];

// 不再使用"主题 × 变体"批量生成——那批事件共用同一组三选项，
// 玩家很快就会觉得"选来选去就那几样"。这一批全部手写。
const RICH_BURST_EVENTS = HAND_WRITTEN_BURST_EVENTS;

module.exports = { RICH_BURST_EVENTS };

},
"game/honor-rules": function(module, exports, require) {
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

},
"game/name-catalog": function(module, exports, require) {
// 与“步云之录”一致：先选姓氏，再从本地双字名库中随机生成候选姓名。
const COMMON_SURNAMES = Object.freeze([
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '郑', '谢', '梁', '宋', '唐', '许', '韩', '冯', '邓', '曹',
  '彭', '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡',
  '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈',
  '姚', '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金',
  '石', '廖', '贾', '夏', '韦', '傅', '方', '白', '邹', '孟',
]);

const GIVEN_NAME_FIRST_CHARS = Object.freeze([
  '安', '宁', '清', '和', '嘉', '乐', '明', '晓', '晨', '星',
  '阳', '雨', '晴', '云', '川', '山', '林', '森', '沐', '泽',
  '言', '知', '思', '念', '希', '予', '亦', '宜', '初', '若',
  '书', '然', '温', '景', '朗', '成', '远', '逸', '乔', '诚',
  '谦', '朴', '稳', '佳', '友', '简', '之', '向', '唯', '望',
]);
const GIVEN_NAME_SECOND_CHARS = Object.freeze([
  '安', '辰', '川', '林', '泽', '朗', '宁', '和', '轩', '霖',
  '宇', '阳', '轻', '远', '松', '书', '诚', '然', '昕', '宜',
]);

const GIVEN_NAMES = Object.freeze(
  GIVEN_NAME_FIRST_CHARS.flatMap(first => GIVEN_NAME_SECOND_CHARS.map(second => `${first}${second}`)),
);

function pickGivenNames(previous = [], count = 15, rng = Math.random) {
  const target = Math.max(0, Math.min(Number(count) || 0, GIVEN_NAMES.length));
  const excluded = new Set(Array.isArray(previous) ? previous : []);
  let pool = GIVEN_NAMES.filter(name => !excluded.has(name));
  if (pool.length < target) pool = GIVEN_NAMES.slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, target);
}

module.exports = { COMMON_SURNAMES, GIVEN_NAMES, pickGivenNames };

},
"game/network": function(module, exports, require) {
// 关系网：同船的领导、经你帮扶的同僚，以及由这张网推出来的落马风险与终局审讯。
//
// 为什么单独一个文件：
//   data-full.js 是 tools/convert-source-data.js 生成的（重跑会整份覆盖），
//   events-burst.js 放的是突发事件的固定文本；
//   而这里放的是"人"、由人算出来的风险，以及审讯这种需要按玩家历史动态组装的事件。
//
// 写作约束（与全项目一致）：
//   1. 全部为虚构人名与虚构职务，不对应任何真实人物、机构、案件；
//   2. 不出现具体金额、渠道、话术与操作步骤，只写"关系结成了"和"代价落在了哪"；
//   3. 三种审讯态度都不存在"过关"选项——被带走调查本身就是结局，
//      区别只在处理档次：主动交代从轻、保持沉默照章、对抗审查从重。
//
// 设计意图（改之前先读）：
//   落马不是随机的天降横祸，而是玩家自己攒出来的结果。所以风险必须可解释：
//   界面上的每一个风险来源，玩家都要能回想起是哪件事、哪个人带来的。

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// ── 人 ────────────────────────────────────────────────────────────────
// 与排行榜样本用的是同一套命名口味，但换了一批字，避免和榜上的人重名。
const SURNAMES = ['裴', '邢', '乔', '滕', '胥', '柏', '蔺', '霍', '邱', '龚', '席', '项'];
const GIVEN_NAMES = ['怀瑾', '立本', '慎之', '秉文', '勉之', '守拙', '孝先', '允中', '执中', '知节', '敬亭', '望舒'];

// 同船领导的职务档位。按玩家当前职级向上取 1~3 档 —— 和你同船的人一般比你高。
const LEADER_TITLES = ['镇党委副书记', '局长', '副县长', '县委常委、办公室主任', '县长', '县委书记', '市政府副秘书长', '副市长', '市委常委', '省厅副职', '省厅主要负责人'];
// 经你帮扶的人。你扶上去的人，职务通常比你低一两档。
const PROTEGE_TITLES = ['科员', '副科长', '科长', '副处长', '处长', '副局长', '乡镇党委委员', '副镇长', '镇党委书记', '县委办副主任', '市直部门副职'];

function pickName(rng) {
  const surname = SURNAMES[Math.floor(rng() * SURNAMES.length)] || SURNAMES[0];
  const given = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)] || GIVEN_NAMES[0];
  return `${surname}${given}`;
}

function leaderTitleFor(rankIndex, offset) {
  const base = clamp((Number(rankIndex) || 1) - 2, 0, LEADER_TITLES.length - 1);
  return LEADER_TITLES[clamp(base + offset, 0, LEADER_TITLES.length - 1)];
}

function protegeTitleFor(rankIndex, offset) {
  const base = clamp((Number(rankIndex) || 1) - 2, 0, PROTEGE_TITLES.length - 1);
  return PROTEGE_TITLES[clamp(base + offset, 0, PROTEGE_TITLES.length - 1)];
}

// 同一条船上的人。weight 是他牵出你的分量：往来越深，出事时牵出来的线越粗。
function createFellow(state, options = {}, rng = Math.random) {
  const offset = Number.isFinite(Number(options.offset)) ? Number(options.offset) : 1 + Math.floor(rng() * 3);
  return {
    id: `f${Date.now().toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
    name: pickName(rng),
    title: options.title || leaderTitleFor(state && state.rankIndex, offset),
    year: Number(state && state.year) || 2026,
    weight: clamp(Math.floor(Number(options.weight) || 1), 1, 3),
    reason: String(options.reason || '有过几次说不清的往来'),
    fallen: false,
    fallenYear: 0,
  };
}

function createProtege(state, options = {}, rng = Math.random) {
  const offset = Number.isFinite(Number(options.offset)) ? Number(options.offset) : Math.floor(rng() * 2);
  return {
    id: `p${Date.now().toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
    name: pickName(rng),
    title: options.title || protegeTitleFor(state && state.rankIndex, offset),
    year: Number(state && state.year) || 2026,
    weight: clamp(Math.floor(Number(options.weight) || 1), 1, 3),
    reason: String(options.reason || '你在关键时候替他说过话'),
    fallen: false,
    fallenYear: 0,
  };
}

// 结网。bond 写在事件选项里：
//   bond: { kind: 'fellow', weight: 2, reason: '收下那个档案袋' }
//   bond: { kind: 'protege', weight: 1, reason: '把他推上了那个位置' }
function applyBond(state, bond, rng = Math.random) {
  if (!bond || !bond.kind) return null;
  const kind = bond.kind === 'protege' ? 'protege' : 'fellow';
  const person = kind === 'protege' ? createProtege(state, bond, rng) : createFellow(state, bond, rng);
  const key = kind === 'protege' ? 'proteges' : 'fellows';
  // 上限 8 人。不是为了限制人数，而是防止一个小程序存档无限膨胀：
  // 每多一个人，落马风险就多一份，8 个人已经能把风险顶到很高的位置了。
  const list = (Array.isArray(state[key]) ? state[key] : []).slice(0, 7);
  list.push(person);
  state[key] = list;
  return person;
}

// 割席：主动与风险最大的那个在台上的同船人切割。
// 人已经落马时割席没有意义（他已经在交代了），所以只挑还在台上的。
function severFrom(state, kind = 'fellow') {
  const key = kind === 'protege' ? 'proteges' : 'fellows';
  const list = Array.isArray(state[key]) ? state[key] : [];
  let target = null;
  list.forEach(person => {
    if (person.fallen) return;
    if (!target || Number(person.weight) > Number(target.weight)) target = person;
  });
  if (!target) return null;
  state[key] = list.filter(person => person !== target);
  return target;
}

// ── 不当收入 ──────────────────────────────────────────────────────────
// 落马最主要的一条线。3 万元是性质分界线：
//   3 万以内的土产、购物卡、加油卡，按"人情往来"记，不进落马风险；
//   超过 3 万的部分，每 1 万元折 0.5 点，另外跨过门槛本身记 3 点。
// 与 riskTrail 的区别：trail 是"短期痕迹"，一次专项倒查结束就清零；
// 不当收入是累计账，钱进了口袋就一直在，这才是"最主要原因"该有的样子——
// 时间越长、笔数越多、金额越大，越难解释成一时糊涂。
const ILLICIT_RISK_FLOOR = 30000;
const ILLICIT_RISK_PER_WAN = 0.5;
const ILLICIT_RISK_STEP = 3;
const ILLICIT_RISK_CAP = 45;

function illicitIncomeOf(state) {
  return Math.max(0, Math.floor(Number(state && state.illicitIncome) || 0));
}

function outstandingIllicitIncomeOf(state) {
  const total = illicitIncomeOf(state);
  const reported = Math.max(0, Math.floor(Number(state && state.reportedIllicitIncome) || 0));
  return Math.max(0, total - Math.min(total, reported));
}

function illicitRiskOf(state) {
  const income = outstandingIllicitIncomeOf(state);
  if (income <= ILLICIT_RISK_FLOOR) return 0;
  const overWan = Math.floor((income - ILLICIT_RISK_FLOOR) / 10000);
  return clamp(ILLICIT_RISK_STEP + overWan * ILLICIT_RISK_PER_WAN, 0, ILLICIT_RISK_CAP);
}

// 给落马页用的一句话说明，把"钱怎么变成风险"摊在明面上
function illicitRiskNote(state) {
  const total = illicitIncomeOf(state);
  const income = outstandingIllicitIncomeOf(state);
  if (total <= 0) return '没有查到现金往来。';
  if (income <= 0) return `累计不当收入${(total / 10000).toFixed(total >= 100000 ? 0 : 1)}万元，已主动说明并全部退缴；终身记录仍保留，当前未说明金额为0。`;
  const wan = (income / 10000).toFixed(income >= 100000 ? 0 : 1);
  if (income <= ILLICIT_RISK_FLOOR) return `累计不当收入${wan}万元，未超过3万元，按人情往来记录，不计入落马风险。`;
  const risk = illicitRiskOf(state);
  return `累计不当收入${wan}万元，其中超过3万元的部分按每万元${ILLICIT_RISK_PER_WAN}点折算，落马风险 +${risk.toFixed(1)}。`;
}

// ── 风险 ──────────────────────────────────────────────────────────────
// 落马风险 0~100。每一项都要能在界面上说清楚来源，且都能追溯到玩家的选择。
function fallRiskOf(state) {
  const fellows = Array.isArray(state.fellows) ? state.fellows : [];
  const proteges = Array.isArray(state.proteges) ? state.proteges : [];
  const evidence = Array.isArray(state.evidence) ? state.evidence : [];
  const activeFellows = fellows.filter(item => !item.fallen);
  const fallenPeople = fellows.concat(proteges).filter(item => item.fallen);
  const activeProteges = proteges.filter(item => !item.fallen);

  const parts = {
    // 累计不当收入。落马最主要的一条线，超过 3 万才开始计
    illicit: illicitRiskOf(state),
    // 累积的往来痕迹（既有机制，0~12）
    trail: (Number(state.riskTrail) || 0) * 3.5,
    // 还在台上的同船领导。他能压一压风声，但一条船上的人越多，出事时牵出的线越多
    fellows: activeFellows.reduce((sum, item) => sum + (Number(item.weight) || 1), 0) * 4.5,
    // 你扶上去的人。他出事，第一份材料里就有你的名字
    proteges: activeProteges.reduce((sum, item) => sum + (Number(item.weight) || 1), 0) * 2,
    // 已经有人被带走了 —— 串并案一旦开始，确定性就上来了。
    // 系数必须大于他在台上时的 4.5×weight，否则"靠山倒了"反而让风险下降，
    // 与整个机制想表达的意思正好相反（weight 1 时 4.5 → 10，weight 3 时 13.5 → 16）。
    fallen: fallenPeople.reduce((sum, item) => sum + 7 + (Number(item.weight) || 1) * 3, 0),
    // 被记下来的具体事由。没有事由，风险就只是感觉
    evidence: Math.min(8, evidence.length) * 1.5,
    // 廉政值低于 70 开始加风险，这是可逆的那一项
    integrity: Math.max(0, 70 - Number(state.integrity || 0)) * 0.8,
    // 职级越高越显眼
    rank: Math.max(0, Number(state.rankIndex) - 4) * 1.5,
  };
  const total = Object.keys(parts).reduce((sum, key) => sum + parts[key], 0);
  return { risk: clamp(Math.round(total), 0, 100), parts };
}

const RISK_LEVELS = [
  { min: 0, label: '低', note: '目前没有人在查你。' },
  { min: 15, label: '偏低', note: '有几笔往来，但都还散着。' },
  { min: 30, label: '中', note: '已经有人把你的名字写进材料里了。' },
  { min: 50, label: '偏高', note: '只差一个开口的人。' },
  { min: 70, label: '极高', note: '该来的快了。' },
];

function riskLevel(risk) {
  const value = Number(risk) || 0;
  let level = RISK_LEVELS[0];
  RISK_LEVELS.forEach(item => { if (value >= item.min) level = item; });
  return level;
}

// 年度落马判定概率。两道闸门都必须在：
//   1. 风险低于 MIN_RISK 不查 —— 否则刚入职就可能暴死，玩家会觉得莫名其妙；
//   2. 没有任何"线头"（事证 / 关系网 / 往来痕迹 / 不当收入）时不查 ——
//      玩家必须能说清是哪件事、哪个人把他带到这一步的，否则落马就成了天降横祸。
//
// 只接受存档对象。第二道闸门需要读关系网与事证，光有一个风险数字判断不了，
// 所以不接受裸数字 —— 那样的"重载"会静默地把闸门关掉，是个陷阱。
// 有没有"线头"：没有任何能追溯到具体人事的东西，落马就只是天降横祸。
// 年度判定与监督核查的落马骰共用这一道闸门，避免两处逻辑各写一份、日后漂移。
function hasThread(state) {
  if (!state || typeof state !== 'object') return false;
  return (Array.isArray(state.evidence) && state.evidence.length > 0) ||
    outstandingIllicitIncomeOf(state) > 0 ||
    (Array.isArray(state.fellows) && state.fellows.length > 0) ||
    (Array.isArray(state.proteges) && state.proteges.length > 0) ||
    (Number(state.riskTrail) || 0) > 0;
}

// 年度落马概率的三个旋钮。目标：一路贪到底的落马率落在 98% 左右，留 2% 漏网之鱼。
//   MIN_RISK 是第一道闸门，"低于这个分数没人来查"；
//   SCALE 决定"风险每高一点，概率涨多少"；
//   CAP 是单年概率天花板——再高风险的年份也不是必被带走，这就是漏网的来源。
//
// 2026-09-12 二次校准（新增"累计不当收入"这一项之后）：
//   加了 illicit 项，一路贪到底的落马率被顶到 99.5%，漏网只剩 0.5%。
//   实测下来 SCALE 和 CAP 都不是有效杠杆（0.30~0.48 扫过去都在 99% 上下，是噪声），
//   真正的杠杆是第一道闸门：把 MIN_RISK 从 20 提到 30，落马率回到 98.0%。
//   30 也正好是 RISK_LEVELS 里"中"的起点（已经有人把你的名字写进材料里）——
//   什么样的分数该被查，本来就该由风险分档说了算，而不是拍一个数。
const FALL_CHANCE_MIN_RISK = 30;
const FALL_CHANCE_SCALE = 0.42;
const FALL_CHANCE_CAP = 0.4;

function fallChance(state) {
  if (!state || typeof state !== 'object') return 0;
  const risk = fallRiskOf(state).risk;
  if (risk < FALL_CHANCE_MIN_RISK) return 0;
  if (!hasThread(state)) return 0;
  return clamp(((risk - FALL_CHANCE_MIN_RISK) / 100) * FALL_CHANCE_SCALE, 0, FALL_CHANCE_CAP);
}

// 某个还在台上的人，本年度被带走的概率。风险越高、他自己牵你的分量越重，越早被带走。
function fallChanceFor(state, person) {
  if (!state || typeof state !== 'object') return 0;
  const risk = fallRiskOf(state).risk;
  if (risk < 25) return 0;
  const weight = clamp(Number(person && person.weight) || 1, 1, 3);
  return clamp(((risk - 25) / 100) * 0.55 + weight * 0.05, 0, 0.6);
}

// 还在台上、还能被牵出来的同船领导（突发事件"某人被带走"只从这里挑）
function activeFellows(state) {
  return (Array.isArray(state.fellows) ? state.fellows : []).filter(item => !item.fallen);
}

// 把一个人带走。这是不可逆的：人一旦落马，他在风险里的分量从"在台上的 4.5"跳到"已落马的 7"。
function takeIntoCustody(state, person) {
  if (!person || person.fallen) return false;
  person.fallen = true;
  person.fallenYear = Number(state.year) || 2026;
  return true;
}

// ── 事证：把玩家当年的选择记下来 ──────────────────────────────────────
// 审讯要"勾起当时的事"，靠的就是这份清单。没有它，审讯就只是一段套话。
function recordEvidence(state, event, option) {
  const risk = Number(option && option.risk) || 0;
  if (risk <= 0) return null;
  const entry = {
    year: Number(state.year) || 2026,
    title: String((event && event.title) || '一次说不清的往来'),
    choice: String((option && option.text) || ''),
    risk,
  };
  state.evidence = [entry].concat(Array.isArray(state.evidence) ? state.evidence : []).slice(0, 10);
  return entry;
}

function evidenceRiskTotal(state) {
  return (Array.isArray(state.evidence) ? state.evidence : []).reduce((sum, item) => sum + (Number(item.risk) || 0), 0);
}

// ── 突发事件：同船的人被带走了 ────────────────────────────────────────
// kind 由调用方明确给出，不从对象引用反推 —— 反推在存档反序列化后一定会失效。
function buildFellowFallEvent(state, person, kind = 'fellow', rng = Math.random) {
  const isFellow = kind !== 'protege';
  const kindLabel = isFellow ? '同一条船上的人' : '你扶上去的人';
  const proof = person && person.reason ? person.reason : '有过几次说不清的往来';
  const aftermath = isFellow
    ? '下午消息就传开了：人已经被带走，办公室当天就封了。'
    : '消息传得比想象中快：他被带走，谈话从他去年的那笔事项开始。';
  const scene = [
    `${person.year}年之后，${person.title}${person.name}一直是${kindLabel}里最常出现在你日程上的那个。`,
    `今天上午的会他没有到。${aftermath}`,
    '',
    `你和他之间的往来，别人未必清楚，但${proof}这件事，你们两个人心里都有数。`,
  ].join('\n');
  return {
    tag: '牵连',
    title: `${person.name}被带走了`,
    scene,
    options: [
      {
        text: '主动向组织说明与他的往来',
        effect: { integrity: 4, reputation: -1, network: -3 },
        risk: -2,
        sever: 1,
        severKind: isFellow ? 'fellow' : 'protege',
        result: '你把能想起来的往来按时间讲了一遍，包括对自己不利的那部分。有些关系从此断了，但你没有等别人来问。',
      },
      {
        text: '不主动提，等组织来问再说',
        effect: { reputation: -1, health: -2 },
        result: '你照常上班，只是每次走廊里有人叫你的名字，你都会先停一下。',
      },
      {
        text: '托人打听消息，想办法把事情压住',
        effect: { integrity: -6, reputation: -3, network: 1 },
        risk: 4,
        result: '你托了人，也听到了几句"暂时没涉及到你"。可你托人这件事本身，已经进了另一个人的记录。',
      },
    ],
  };
}

// ── 终局：被带走之后的谈话 ────────────────────────────────────────────
// 事件文本按玩家自己的历史组装：谁开的口、当年哪几件事被摆上了桌。
function buildInterrogationEvent(state, rng = Math.random) {
  const fellows = Array.isArray(state.fellows) ? state.fellows : [];
  const proteges = Array.isArray(state.proteges) ? state.proteges : [];
  const fallenFellows = fellows.filter(item => item.fallen);
  const fallenProteges = proteges.filter(item => item.fallen);
  const evidence = (Array.isArray(state.evidence) ? state.evidence : []).slice(0, 3);
  const informant = fallenFellows[0] || fallenProteges[0] || null;
  const informantIsFellow = informant ? fallenFellows.indexOf(informant) >= 0 : false;

  const lines = [`${state.year}年，你被通知去"配合了解情况"。房间不大，桌上放着一杯没开封的水，对面的人没有寒暄。`];
  if (informant) {
    lines.push(`他们把一叠材料推过来，第一页上有签名——${informant.title}${informant.name}。`);
    lines.push(`"${informant.name}${informantIsFellow ? '全都交代了' : '把知道的都说了'}。"对方翻到夹着标签的那几页，"有几件事，他记得比你清楚。"`);
  } else {
    lines.push('他们把一叠材料推过来，最上面是你自己签过字的那些纸。');
    lines.push('"这些，你怎么解释？"');
  }
  if (evidence.length) {
    lines.push('');
    // 用「」而不是""：选项文案本身就带引号（"看得起自己"），两层双引号会打架
    evidence.forEach(item => lines.push(`· ${item.year}年，${item.title} —— 你当时选的是「${item.choice}」。`));
    lines.push('');
  }
  lines.push('你可以选择怎么回答。');

  const proof = evidence.length ? `谈话从${evidence[0].year}年那件事开始。` : '谈话从最早的一笔往来开始。';
  return {
    tag: '审查',
    title: '被带走之后',
    scene: lines.join('\n'),
    options: [
      {
        text: '如实交代，每一件事都说清楚',
        stance: 'confess',
        effect: { integrity: 3, reputation: -2, health: -3 },
        result: `${proof}你按时间顺序把能想起来的都讲了，包括对自己最不利的那部分，签字，退赔。处理决定下来时，写的是"主动交代问题"。`,
      },
      {
        text: '保持沉默，只回答有据可查的部分',
        stance: 'silent',
        effect: { integrity: -2, reputation: -2, health: -4 },
        result: `${proof}你没有多说一个字，只在有自己签字的地方点头。材料一份一份摆出来，沉默没有让任何一页消失。`,
      },
      {
        text: '拒不交代，坚持自己没有任何问题',
        stance: 'defy',
        effect: { integrity: -6, reputation: -4, health: -5 },
        result: `${proof}你否认了全部内容，包括那些有签字的部分。审查期间的态度被单独记了一页，附在了处理意见后面。`,
      },
    ],
  };
}

// 三种态度对应三个不同的结局，但都不存在"过关"。
// 主动交代从轻，沉默照章，对抗从重 —— 追缴比例与最终口径都不同。
const FALL_STANCES = {
  confess: { ending: '主动交代，从轻处理', confiscateRate: 0.55, note: '经审查，你如实交代问题并配合核查。处理决定：开除党籍、开除公职，涉案财物予以追缴，合法财产予以保护。' },
  silent: { ending: '落马被查', confiscateRate: 0.78, note: '经审查，相关材料已形成完整证据链。处理决定：开除党籍、开除公职，违纪违法所得予以收缴。' },
  defy: { ending: '对抗审查，从重处理', confiscateRate: 1, note: '因对抗组织审查，相关情节被从重认定。处理决定：开除党籍、开除公职，涉案财物全部追缴。' },
};

// 追缴金额。用"占现有财产的比例"而不是绝对金额：
// 绝对金额在任何一个高职级存档里都会超过全部现金，三种态度就会被同一个上限
// 压成一模一样的结果，玩家在终局做出的选择也就失去了意义。
//
// 狠度还跟着"事证"走：当年收得越多、性质越重，追缴得越狠。
// 这样玩家能看清自己每一笔选择最终换了什么，而不只是看到一句结论。
function confiscationOf(state, stance) {
  const config = FALL_STANCES[stance] || FALL_STANCES.silent;
  const money = Math.max(0, Math.floor(Number(state.money) || 0));
  const severity = clamp(evidenceRiskTotal(state) / 12, 0, 1);
  const rate = clamp(config.confiscateRate * (0.75 + severity * 0.45), 0, 1);
  return Math.floor(money * rate);
}

// 追缴比例（0~1），给页面显示用，避免页面自己再算一遍导致口径不一致
function confiscationRate(state, stance) {
  return FALL_STANCES[stance] ? clamp(FALL_STANCES[stance].confiscateRate * (0.75 + clamp(evidenceRiskTotal(state) / 12, 0, 1) * 0.45), 0, 1) : 0;
}

module.exports = {
  SURNAMES, GIVEN_NAMES, LEADER_TITLES, PROTEGE_TITLES, RISK_LEVELS, FALL_STANCES,
  pickName, leaderTitleFor, protegeTitleFor, createFellow, createProtege, applyBond, severFrom,
  fallRiskOf, riskLevel, hasThread, fallChance, fallChanceFor, recordEvidence, evidenceRiskTotal,
  activeFellows, takeIntoCustody, buildFellowFallEvent, buildInterrogationEvent,
  confiscationOf, confiscationRate,
  illicitIncomeOf, outstandingIllicitIncomeOf, illicitRiskOf, illicitRiskNote,
  ILLICIT_RISK_FLOOR, ILLICIT_RISK_PER_WAN, ILLICIT_RISK_STEP, ILLICIT_RISK_CAP,
  FALL_CHANCE_MIN_RISK, FALL_CHANCE_SCALE, FALL_CHANCE_CAP,
};

},
"game/positions-extra": function(module, exports, require) {
// 运行时补充的现实岗位池。data-full.js 仍保持由原始 source/main.lua 生成，
// 这里集中维护新增岗位，避免下一次重新提取源数据时把扩展岗位覆盖掉。
// 岗位名称均采用现实机关、街道、乡镇和企事业单位中通行的正式称谓。

const EXTRA_POSITION_OPTIONS = {
  3: [
    {
      group: '乡镇人大和政府岗位', name: '镇人大副主席', level: '副科级',
      description: '协助镇人大主席开展代表联络、监督和基层民主法治建设工作。',
      effect: { seniority: 2, reputation: 1 },
    },
    {
      group: '乡镇党政岗位', name: '镇党委委员、副镇长（分管民政）', level: '副科级',
      description: '负责社会救助、养老服务、残疾人服务和基层民政事务。',
      effect: { reputation: 3, network: 1 },
    },
    {
      group: '乡镇党政岗位', name: '镇党委委员、党政办公室主任', level: '副科级',
      description: '负责党委政府机关运转、综合协调、文稿和督查工作。',
      effect: { seniority: 2, network: 2 },
    },
    {
      group: '乡镇专业岗位', name: '镇党委委员、农业农村办公室主任', level: '副科级',
      description: '负责农业生产、乡村建设、集体经济和乡村振兴项目协调。',
      effect: { reputation: 2, seniority: 2, health: -1 },
    },
    {
      group: '街道党政岗位', name: '街道党工委委员、办事处副主任', level: '副科级',
      description: '协助街道办事处开展城市管理、公共服务和社区治理。',
      effect: { network: 2, reputation: 2 },
    },
    {
      group: '街道纪检岗位', name: '街道党工委委员、纪工委书记', level: '副科级',
      description: '负责街道监督执纪、基层作风建设和廉政教育。',
      minIntegrity: 75,
      effect: { integrity: 4, reputation: 1 },
    },
  ],
  4: [
    {
      group: '乡镇人大岗位', name: '镇人大主席', level: '正科级',
      description: '主持镇人大主席团工作，组织代表依法履职并开展监督。',
      effect: { reputation: 3, network: 2, seniority: 3, health: -1 },
    },
    {
      group: '县委机关岗位', name: '县委组织部副部长', level: '正科级',
      description: '协助组织部长负责干部考察、基层组织建设和人才工作。',
      minAchievements: 4,
      effect: { network: 3, seniority: 3, integrity: 1 },
    },
    {
      group: '县委机关岗位', name: '县委宣传部副部长', level: '正科级',
      description: '协助负责宣传思想、意识形态、新闻舆情和文化建设。',
      minAchievements: 4,
      effect: { reputation: 4, network: 1 },
    },
    {
      group: '县政府部门正职', name: '县发展和改革局局长', level: '正科级',
      description: '主持发展改革工作，负责项目立项、投资管理和经济运行分析。',
      minAchievements: 4,
      effect: { network: 3, seniority: 3, health: -1 },
    },
    {
      group: '县政府部门正职', name: '县财政局局长', level: '正科级',
      description: '主持财政工作，负责预算管理、财政监督和政府债务风险防控。',
      minAchievements: 4,
      minIntegrity: 75,
      effect: { network: 3, integrity: 2, seniority: 2 },
    },
    {
      group: '县政府部门正职', name: '县自然资源局局长', level: '正科级',
      description: '主持自然资源管理、国土空间规划和不动产登记协调工作。',
      minAchievements: 4,
      effect: { network: 3, reputation: 2, health: -1 },
    },
  ],
  5: [
    {
      group: '县委常委岗位', name: '县委常委、统战部部长', level: '副处级',
      description: '负责统一战线、民族宗教、工商联和党外代表人士工作。',
      minAchievements: 8,
      effect: { network: 4, reputation: 2 },
    },
    {
      group: '县委常委岗位', name: '县委常委、政法委书记', level: '副处级',
      description: '统筹政法、平安建设、社会治理和信访维稳工作。',
      minAchievements: 8,
      minIntegrity: 75,
      effect: { network: 3, integrity: 2, health: -1 },
    },
    {
      group: '县政府领导岗位', name: '县政府党组成员、副县长（分管工业）', level: '副处级',
      description: '分管工业运行、招商引资、园区建设和企业服务。',
      minAchievements: 8,
      effect: { network: 3, seniority: 3, health: -1 },
    },
    {
      group: '县政府领导岗位', name: '县政府党组成员、副县长（分管城建）', level: '副处级',
      description: '分管住房城乡建设、城市更新、自然资源和交通项目。',
      minAchievements: 8,
      effect: { network: 3, reputation: 2, health: -2 },
    },
    {
      group: '市辖区党委岗位', name: '市辖区委常委、统战部部长', level: '副处级',
      description: '负责城区统一战线、民族宗教和党外人士联系服务工作。',
      minAchievements: 8,
      effect: { network: 4, reputation: 2 },
    },
    {
      group: '市辖区党委岗位', name: '市辖区委常委、纪委书记', level: '副处级',
      description: '主持城区纪检监察工作，负责监督执纪和党风廉政建设。',
      minAchievements: 8,
      minIntegrity: 80,
      effect: { integrity: 5, reputation: 2 },
    },
    {
      group: '县级市市委岗位', name: '县级市市委常委、组织部部长', level: '副处级',
      description: '负责县级市干部队伍、基层组织建设和人才工作。',
      minAchievements: 8,
      effect: { network: 4, seniority: 3, integrity: 1 },
    },
    {
      group: '县级市市委岗位', name: '县级市市委常委、宣传部部长', level: '副处级',
      description: '负责县级市宣传思想、意识形态、新闻舆情和文化建设。',
      minAchievements: 8,
      effect: { reputation: 4, network: 2 },
    },
  ],
  6: [
    {
      group: '县级市党政主官', name: '县级市市委副书记、市长', level: '正处级',
      description: '主持县级市政府全面工作，并以市委副书记身份参与市委领导。',
      minAchievements: 10,
      effect: { seniority: 4, reputation: 3, network: 4, health: -2 },
    },
    {
      group: '市委机关岗位', name: '市委组织部副部长', level: '正处级',
      description: '协助市委组织部长开展干部管理、考察任用和组织建设。',
      minAchievements: 10,
      effect: { network: 3, seniority: 3 },
    },
    {
      group: '市委机关岗位', name: '市委宣传部副部长', level: '正处级',
      description: '协助负责全市宣传思想、意识形态和文化发展工作。',
      minAchievements: 10,
      effect: { reputation: 4, network: 2 },
    },
    {
      group: '市委机关岗位', name: '市委政法委副书记（分管日常工作）', level: '正处级',
      description: '主持市委政法委日常工作，协助统筹全市政法、平安建设、信访和社会治理。',
      minAchievements: 10,
      minIntegrity: 75,
      effect: { network: 3, integrity: 2, health: -1 },
    },
    {
      group: '市政府部门正职', name: '市发展和改革委员会主任', level: '正处级',
      description: '主持市级发展改革工作，负责重大项目和经济运行统筹。',
      minAchievements: 10,
      effect: { network: 3, seniority: 3, health: -1 },
    },
    {
      group: '市政府领导岗位', name: '市政府党组成员、秘书长', level: '正处级',
      description: '主持市政府办公室工作，承担政府系统综合协调和政务运转。',
      minAchievements: 10,
      effect: { network: 3, seniority: 4, health: -1 },
    },
  ],
  7: [
    {
      group: '市委常委岗位', name: '市委常委、统战部部长', level: '副厅级',
      description: '负责全市统一战线、民族宗教、工商联和党外人士工作。',
      minAchievements: 12,
      effect: { network: 4, reputation: 2 },
    },
    {
      group: '市委常委岗位', name: '市委常委、政法委书记', level: '副厅级',
      description: '统筹全市政法、平安建设和社会治理工作。',
      minAchievements: 12,
      minIntegrity: 80,
      effect: { network: 4, integrity: 3, health: -1 },
    },
    {
      group: '市委常委岗位', name: '市委常委、秘书长', level: '副厅级',
      description: '负责市委机关运转、综合协调、督查和重大活动保障。',
      minAchievements: 12,
      effect: { network: 4, seniority: 4 },
    },
  ],
  8: [
    {
      group: '省政府组成部门岗位', name: '省政府秘书长', level: '正厅级',
      description: '负责省政府机关日常运转、综合协调和重大政务活动保障。',
      minAchievements: 14,
      effect: { network: 4, seniority: 4, health: -1 },
    },
    {
      group: '省政府组成部门岗位', name: '省发展和改革委员会主任', level: '正厅级',
      description: '主持全省发展改革工作，统筹重大项目、投资和经济运行。',
      minAchievements: 14,
      effect: { network: 4, seniority: 3, health: -1 },
    },
    {
      group: '省政府组成部门岗位', name: '省财政厅厅长', level: '正厅级',
      description: '主持全省财政工作，负责预算管理、财政监督和风险防控。',
      minAchievements: 14,
      minIntegrity: 80,
      effect: { network: 3, integrity: 3, seniority: 3 },
    },
  ],
  9: [
    {
      group: '省委常委岗位', name: '省委常委、统战部部长', level: '副部级',
      description: '负责全省统一战线、民族宗教和党外代表人士工作。',
      minAchievements: 16,
      effect: { network: 5, reputation: 3 },
    },
    {
      group: '省纪委监委岗位', name: '省纪委书记', level: '副部级',
      description: '主持省级纪检监察工作，负责监督执纪和反腐倡廉建设。',
      minAchievements: 16,
      minIntegrity: 85,
      effect: { integrity: 5, reputation: 2, network: 3 },
    },
  ],
  10: [
    {
      group: '省级人大岗位', name: '省人大常委会主任', level: '正部级',
      description: '主持省人大常委会工作，依法履行地方国家权力机关职责。',
      minAchievements: 18,
      effect: { reputation: 5, network: 4, health: -2 },
    },
  ],
};

module.exports = { EXTRA_POSITION_OPTIONS };

},
"game/rank-events/rank-01": function(module, exports, require) {
// 职级 1 · 二级科员（22 岁起，云岭镇基层岗位）
//
// 权力边界：没有审批权、没有签字权。能做的是窗口、入户、台账、报表、会务、值守。
// 所以这一级的题目全部围绕「把一件小事办到什么程度」，不涉及资金分配与人事安排。
// 50 道。

module.exports = [
  {
    title: '窗口咨询',
    scene: '有群众来窗口问社保转移怎么办，材料没带齐，情绪已经有点急。',
    options: [
      { text: '先安抚，列出缺少的材料并约好补交方式', performance: 3, effect: { reputation: 4, network: 1 }, result: '对方带着清单走了，第二天补齐办完，窗口少了半个钟头的争执。' },
      { text: '照规定告知材料不齐，请其下次再来', performance: 1, effect: { reputation: 1 }, result: '流程没出错，但对方还要再跑一趟。' },
      { text: '让他先去找村里问清楚再来', performance: -1, effect: { reputation: -2 }, result: '事情被推出去了，第二天镇里接到投诉电话。' },
    ],
  },
  {
    title: '材料核验',
    scene: '一批申请材料堆在桌上，有几份复印件看不清关键信息。',
    options: [
      { text: '逐份核对，把模糊的挑出来退回重报', performance: 3, effect: { reputation: 3, health: -2 }, result: '多花了两小时，但这一批没留下隐患。' },
      { text: '按能看清的部分录入，模糊的先放着', performance: 1, effect: { reputation: 1 }, result: '进度没耽误，后面可能要返工。' },
      { text: '照单全收，先录进去再说', performance: -1, effect: { reputation: -2 }, result: '录入很快，复核时被退回来重做。' },
    ],
  },
  {
    title: '档案整理',
    scene: '档案柜里三年的材料混在一起，上级要求本周完成清理。',
    options: [
      { text: '按年份和类别重新编号，补一份目录', performance: 3, effect: { reputation: 3, seniority: 1, health: -2 }, result: '后来谁找材料都能一翻就到。' },
      { text: '分堆归位，能找到就行', performance: 1, effect: { reputation: 1 }, result: '表面整齐了，目录还是没有。' },
      { text: '把柜子塞满，先应付检查', performance: -1, effect: { reputation: -2 }, result: '检查那天打开柜门，纸掉了半地。' },
    ],
  },
  {
    title: '数据录入',
    scene: '系统要录两百多条台账数据，格式要求很细。',
    options: [
      { text: '先录十条确认格式，再批量推进', performance: 3, effect: { reputation: 3, health: -1 }, result: '一次通过，没有返工。' },
      { text: '边录边改，遇到报错再处理', performance: 1, effect: { reputation: 1, health: -1 }, result: '磕磕绊绊做完了。' },
      { text: '照抄旧表，格式对不对先不管', performance: -1, effect: { reputation: -2 }, result: '系统报了一屏错，全部退回。' },
    ],
  },
  {
    title: '会议记录',
    scene: '镇里开调度会，领导讲话快，让你做记录。',
    options: [
      { text: '记录决议、责任人和时限，会后当天整理发出', performance: 3, effect: { reputation: 3, network: 2 }, result: '这份纪要后来成了督办的依据。' },
      { text: '记下主要意思，会后整理', performance: 1, effect: { reputation: 1 }, result: '纪要能用，但责任人和时限都模糊。' },
      { text: '只记个大概，反正有录音', performance: -1, effect: { reputation: -2 }, result: '会后没人知道谁该干什么。' },
    ],
  },
  {
    title: '下乡入户',
    scene: '要摸清几户人家的实际困难，路不好走，天还下着雨。',
    options: [
      { text: '一户一户走到，把情况记进本子', performance: 3, effect: { reputation: 4, health: -2 }, result: '摸上来的情况比报表准得多。' },
      { text: '找村干部集中问一遍', performance: 1, effect: { network: 2 }, result: '效率高，但细节有出入。' },
      { text: '照去年的名单报上去', performance: -1, effect: { reputation: -2 }, result: '有几户的情况早就变了。' },
    ],
  },
  {
    title: '迎检准备',
    scene: '上级下周来检查，需要准备台账和现场。',
    options: [
      { text: '对照清单逐项自查，缺的补齐', performance: 3, effect: { reputation: 3, health: -2 }, result: '检查组问什么都能答上来。' },
      { text: '把已有的材料整理摆好', performance: 1, effect: { reputation: 1 }, result: '表面过得去，问深了答不出。' },
      { text: '临时补几份材料凑数', performance: -1, effect: { reputation: -3, integrity: -1 }, result: '日期对不上，被当场指出。' },
    ],
  },
  {
    title: '值班值守',
    scene: '节假日轮到你值班，夜里接到一条情况报告。',
    options: [
      { text: '先核实再按流程上报，全程记时间', performance: 3, effect: { reputation: 3, health: -2 }, result: '情况处置得当，记录也完整。' },
      { text: '记下来，等天亮交给带班领导', performance: 1, effect: { reputation: 1 }, result: '没出事，但响应慢了半拍。' },
      { text: '觉得不严重，先睡一觉再说', performance: -2, effect: { reputation: -3 }, result: '第二天事态扩大，没人知道你早就接到过。' },
    ],
  },
  {
    title: '纠纷协管',
    scene: '两户人家为排水沟吵起来，村干部让你去看看。',
    options: [
      { text: '先分开听双方说，再找老辈人一起商量', performance: 3, effect: { reputation: 4, network: 2 }, result: '沟怎么挖定下来了，两家都认。' },
      { text: '各劝两句，让他们自己谈', performance: 1, effect: { reputation: 1 }, result: '当天没再吵，问题还在。' },
      { text: '说这不是你的事，让他们去司法所', performance: -1, effect: { reputation: -2 }, result: '两家的梁子结得更深了。' },
    ],
  },
  {
    title: '统计报表',
    scene: '月底要报一张表，几个村的数据还没收齐。',
    options: [
      { text: '逐个打电话催，核对后再填报', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '表报上去一次通过。' },
      { text: '用上月数据加估算先报', performance: 0, effect: { reputation: -1, integrity: -1 }, result: '数字看起来完整，其实对不上。' },
      { text: '等齐了再说，先不报', performance: -2, effect: { reputation: -2 }, result: '被催了两次，通报里点了名。' },
    ],
  },
  {
    title: '政策宣讲',
    scene: '要向村民讲一项新出的补贴政策，很多人听不懂。',
    options: [
      { text: '用本地方言讲，举身边的例子', performance: 3, effect: { reputation: 4, network: 1 }, result: '当场就有七八户问怎么申请。' },
      { text: '照文件念一遍，发宣传单', performance: 1, effect: { reputation: 1 }, result: '来的人听了，回去还是说不清。' },
      { text: '把宣传单贴出去就算完成', performance: -1, effect: { reputation: -2 }, result: '一个月后问起，几乎没人知道。' },
    ],
  },
  {
    title: '台账建立',
    scene: '一项工作要求建立专门台账，以前没人做过。',
    options: [
      { text: '先定字段和口径，再逐条登记', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '后来别的村都来借这份台账当样板。' },
      { text: '按上级给的模板照填', performance: 1, effect: { reputation: 1 }, result: '能交差，但查起来不方便。' },
      { text: '随便建个表，凑够条数', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '抽查时口径对不上，全部返工。' },
    ],
  },
  {
    title: '业务培训',
    scene: '县里组织业务培训，名额紧，正好轮到你。',
    options: [
      { text: '带着问题去，回来整理成要点分享', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '同事照着你那份要点少走了弯路。' },
      { text: '认真听完，做好笔记', performance: 1, effect: { seniority: 1 }, result: '自己懂了，别人还是不会。' },
      { text: '借机休息两天，签到就走', performance: -2, effect: { reputation: -3, seniority: -1 }, result: '回来什么也说不出，还被记了缺勤。' },
    ],
  },
  {
    title: '陪同调研',
    scene: '上级来镇里调研，安排你跟着做记录、带路。',
    options: [
      { text: '提前踩点，把路线和情况摸清', performance: 3, effect: { reputation: 3, network: 3 }, result: '调研很顺，领导记住了你的名字。' },
      { text: '跟着走，问到再答', performance: 1, effect: { network: 1 }, result: '没出岔子，也没留下印象。' },
      { text: '找机会躲开，少点麻烦', performance: -1, effect: { reputation: -2 }, result: '临时被问到时答不上来。' },
    ],
  },
  {
    title: '热线来电',
    scene: '服务热线转来一件投诉，指向你负责的片区。',
    options: [
      { text: '当天联系当事人，核实后给出答复时限', performance: 3, effect: { reputation: 4, health: -1 }, result: '对方在回访里说了满意。' },
      { text: '按流程登记，转给相关站所', performance: 1, effect: { reputation: 1 }, result: '件转出去了，结果没人跟。' },
      { text: '觉得是小事，压着不回', performance: -2, effect: { reputation: -3 }, result: '当事人又打了一次，这次打到县里。' },
    ],
  },
  {
    title: '来访登记',
    scene: '一位老人来反映待遇问题，说话不太清楚。',
    options: [
      { text: '慢慢听，帮他查档案再解释', performance: 3, effect: { reputation: 4, health: -1 }, result: '老人听明白了，临走一直道谢。' },
      { text: '按规定让他去对应窗口', performance: 1, effect: { reputation: 1 }, result: '流程没错，老人还要再跑。' },
      { text: '说这不归你管，让他下次来', performance: -2, effect: { reputation: -3 }, result: '老人在走廊坐了半天。' },
    ],
  },
  {
    title: '低保复核',
    scene: '低保户年度复核，有一户的情况和申报时不太一样。',
    options: [
      { text: '上门核实，如实记录变化', performance: 3, effect: { reputation: 3, integrity: 1, health: -1 }, result: '调整得及时，没人说闲话。' },
      { text: '照去年的名单报', performance: 0, effect: { reputation: -1 }, result: '报上去了，心里一直不踏实。' },
      { text: '按人情照顾一下，不改', performance: -2, effect: { reputation: -2, integrity: -3 }, result: '公示期间被人举报，核查组来了。' },
    ],
  },
  {
    title: '社保代办',
    scene: '几位老人不会用手机做认证，子女又不在身边。',
    options: [
      { text: '约个时间上门帮着办', performance: 3, effect: { reputation: 4, network: 1, health: -1 }, result: '几位老人的认证当天就办完了。' },
      { text: '在窗口留个指引，让他们找人帮忙', performance: 1, effect: { reputation: 1 }, result: '能办的多半还是没办成。' },
      { text: '告诉他们自己想办法', performance: -2, effect: { reputation: -3 }, result: '有人因为没认证停了待遇。' },
    ],
  },
  {
    title: '汛期值守',
    scene: '连日降雨，一处低洼路段开始积水。',
    options: [
      { text: '连夜巡查，设警示并上报', performance: 3, effect: { reputation: 4, health: -3 }, result: '夜里没人误入，第二天排水也及时。' },
      { text: '白天去看一趟，记进记录', performance: 1, effect: { reputation: 1 }, result: '没出事，但夜里那段没人管。' },
      { text: '等雨停了再说', performance: -2, effect: { reputation: -3 }, result: '有车半夜陷在水里。' },
    ],
  },
  {
    title: '防火宣传',
    scene: '进入森林防火期，要进村入户做宣传。',
    options: [
      { text: '挨户讲，重点盯住几个常上山的人', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '整个防火期没起火情。' },
      { text: '贴标语、放广播', performance: 1, effect: { reputation: 1 }, result: '形式有了，效果说不清。' },
      { text: '把宣传品发下去就算完成', performance: -1, effect: { reputation: -2 }, result: '有人在山上烧荒，差点出事。' },
    ],
  },
  {
    title: '走访慰问',
    scene: '节前要走访几户困难家庭，名单是上面给的。',
    options: [
      { text: '提前了解每家情况，问到具体难处', performance: 3, effect: { reputation: 4, network: 2 }, result: '走访之后，有两户的事被真正推动了。' },
      { text: '按名单走一遍，送到就走', performance: 1, effect: { reputation: 1 }, result: '任务完成了，情况还是老样子。' },
      { text: '让人代签代领，节省时间', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '有人根本没收到，事后被查出来。' },
    ],
  },
  {
    title: '信息报送',
    scene: '镇里要求每天报送一条工作信息。',
    options: [
      { text: '挑当天真解决问题的事写', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '有两条被县里采用了。' },
      { text: '把做过的事记流水账', performance: 1, effect: { reputation: 1 }, result: '报了，没人看。' },
      { text: '抄昨天的改个日期', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被编辑一眼看出，退回重写。' },
    ],
  },
  {
    title: '保密自查',
    scene: '要求对办公电脑和文件做一次保密自查。',
    options: [
      { text: '逐台核对，把不该留的清理掉', performance: 3, effect: { reputation: 2, integrity: 1, health: -1 }, result: '自查报告写得很实，抽查也没问题。' },
      { text: '填表交差', performance: 1, effect: { reputation: 1 }, result: '表交了，问题还在。' },
      { text: '把材料拷回家继续做', performance: -2, effect: { reputation: -2, integrity: -3 }, result: '被提醒了一次，写了情况说明。' },
    ],
  },
  {
    title: '差旅报销',
    scene: '下乡一趟回来要报销，票据有点乱。',
    options: [
      { text: '按实际逐张整理，多退少补', performance: 3, effect: { reputation: 2, integrity: 1 }, result: '报销一次过，财务印象很好。' },
      { text: '凑齐票据交上去', performance: 1, effect: { reputation: 1 }, result: '报下来了，明细说不清。' },
      { text: '顺手把私事的花销夹进去', performance: -2, effect: { reputation: -3, integrity: -4 }, result: '财务核对时问了一句，你答不上来。' },
    ],
  },
  {
    title: '档案数字化',
    scene: '要把纸质档案扫描录入系统，量很大。',
    options: [
      { text: '先做试点，定标准再铺开', performance: 3, effect: { reputation: 3, seniority: 1, health: -2 }, result: '后来扫描件的质量一直很稳。' },
      { text: '按顺序扫，能看清就行', performance: 1, effect: { reputation: 1, health: -1 }, result: '扫完了，有一批模糊的没发现。' },
      { text: '随便扫几页充数', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '抽查发现缺页，全部重来。' },
    ],
  },
  {
    title: '证明开具',
    scene: '有人来开一份证明，内容涉及你没核实过的情况。',
    options: [
      { text: '先核实，能开才开', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '开出去的每一份都经得起问。' },
      { text: '按他说的写，让他自己负责', performance: 0, effect: { reputation: -1, integrity: -1 }, result: '证明是开了，风险留给了自己。' },
      { text: '碍于情面直接盖章', performance: -2, effect: { reputation: -3, integrity: -4 }, result: '后来这份证明被追着问了很久。' },
    ],
  },
  {
    title: '信访件登记',
    scene: '收到一封信访件，措辞激烈，指向的是邻村的事。',
    options: [
      { text: '按规定登记、转送，并告知受理情况', performance: 3, effect: { reputation: 3, network: 1 }, result: '件进了流程，对方不再反复来信。' },
      { text: '登记后放着，等领导安排', performance: 1, effect: { reputation: 1 }, result: '件压在桌上，期限一天天过。' },
      { text: '觉得是老上访户，不登记', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '期限过了才被发现，挨了批评。' },
    ],
  },
  {
    title: '数据核对',
    scene: '两张表里同一项数字对不上，差得还不小。',
    options: [
      { text: '回原始凭证逐条核，找出差在哪', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '差在口径上，顺手把口径统一了。' },
      { text: '按多数那张表填报', performance: 1, effect: { reputation: 1 }, result: '报上去了，错误也一起报上去了。' },
      { text: '随手改一个数字让它对上', performance: -2, effect: { reputation: -3, integrity: -4 }, result: '后来被复查发现，说不清为什么改。' },
    ],
  },
  {
    title: '会务保障',
    scene: '明天有个重要会议，会场还没布置。',
    options: [
      { text: '提前踩点，设备、材料、座次都过一遍', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '会议很顺，没有人临时找东西。' },
      { text: '按要求摆好，材料放桌上', performance: 1, effect: { reputation: 1 }, result: '能开会，中间出了点小状况。' },
      { text: '等会前半小时再说', performance: -2, effect: { reputation: -3 }, result: '话筒没试，开场就卡了十分钟。' },
    ],
  },
  {
    title: '督查整改',
    scene: '上次督查指出的问题，整改期限快到了。',
    options: [
      { text: '逐条对照，改完一个销一个', performance: 3, effect: { reputation: 3, integrity: 1, health: -1 }, result: '复查时全部销号。' },
      { text: '改了容易的，难的先拖着', performance: 1, effect: { reputation: 1 }, result: '报上去说在推进，其实没动。' },
      { text: '补一份整改报告了事', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '复查组一到现场就明白了。' },
    ],
  },
  {
    title: '材料报送时限',
    scene: '一份材料要求今天下班前报，你手上还有别的事。',
    options: [
      { text: '先排好优先级，按时交一版完整的', performance: 3, effect: { reputation: 3, health: -1 }, result: '按时报上，质量也没打折。' },
      { text: '先交个初稿说明情况', performance: 1, effect: { reputation: 1 }, result: '没超时，但被退回来改。' },
      { text: '拖到明天再说', performance: -2, effect: { reputation: -3 }, result: '通报里点了你的名字。' },
    ],
  },
  {
    title: '节假日值班',
    scene: '轮到你值三天班，家里有点事。',
    options: [
      { text: '按规定完成交接，做好记录再走', performance: 3, effect: { reputation: 3, network: 1 }, result: '交接清清楚楚，没出空档。' },
      { text: '找人替一下，口头说一声', performance: 1, effect: { reputation: 1 }, result: '没出事，但交接没留痕。' },
      { text: '不来也不说', performance: -3, effect: { reputation: -4, integrity: -2 }, result: '查岗发现空岗，写了书面检查。' },
    ],
  },
  {
    title: '反诈宣传',
    scene: '村里接连有人接到诈骗电话，要入户做提醒。',
    options: [
      { text: '结合真实案例讲套路，重点盯独居老人', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '当月拦下了两起正在进行的转账。' },
      { text: '发宣传页，群里转一下', performance: 1, effect: { reputation: 1 }, result: '宣传覆盖了，效果说不准。' },
      { text: '等出了事再处理', performance: -2, effect: { reputation: -3 }, result: '有一户真的被骗了，来找你哭。' },
    ],
  },
  {
    title: '人居环境',
    scene: '村道两边堆着柴草和旧物，整治要求下来了。',
    options: [
      { text: '先跟村民商量堆放点，再动手清', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '路通了，也没跟人结怨。' },
      { text: '限期清理，到期统一清走', performance: 1, effect: { reputation: 1 }, result: '清干净了，有人背后骂。' },
      { text: '只清主路，别的看不见就不管', performance: -1, effect: { reputation: -2 }, result: '检查走的是另一条路，被拍了照。' },
    ],
  },
  {
    title: '户厕改造',
    scene: '几户人家的厕所要改，有人不愿意动工。',
    options: [
      { text: '先做一户样板，让邻居自己看效果', performance: 3, effect: { reputation: 4, network: 2 }, result: '看完样板，剩下几户主动报了名。' },
      { text: '挨家做工作，讲政策', performance: 1, effect: { reputation: 1, network: 1 }, result: '动员了一半。' },
      { text: '报个完成数，先应付', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '验收时户数对不上。' },
    ],
  },
  {
    title: '饮水安全',
    scene: '有村民反映自家井水有异味。',
    options: [
      { text: '当天取样送检，暂时安排替代水源', performance: 3, effect: { reputation: 4, health: -1 }, result: '结果出来得快，人也喝上了放心水。' },
      { text: '记录下来，向上反映', performance: 1, effect: { reputation: 1 }, result: '反映上去了，等了一阵。' },
      { text: '说可能是天气原因，再看看', performance: -2, effect: { reputation: -3 }, result: '后来有几个人闹肚子，事情闹大了。' },
    ],
  },
  {
    title: '道路隐患',
    scene: '一段村路被雨水冲出缺口，还没断交。',
    options: [
      { text: '先设警示、报修，再盯修复', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '修好了，期间没人出事。' },
      { text: '报给养护部门就完事', performance: 1, effect: { reputation: 1 }, result: '报了，修得慢。' },
      { text: '等它彻底断了再报', performance: -2, effect: { reputation: -3 }, result: '有摩托车夜间摔了进去。' },
    ],
  },
  {
    title: '助学申报',
    scene: '一户人家的孩子考上学校，助学金申报材料交不上来。',
    options: [
      { text: '上门帮着准备材料，赶在截止前报出', performance: 3, effect: { reputation: 4, network: 1 }, result: '孩子按时拿到了资助。' },
      { text: '告诉他们流程和截止日期', performance: 1, effect: { reputation: 1 }, result: '能不能办成看他们自己。' },
      { text: '错过就算了，明年再说', performance: -2, effect: { reputation: -3 }, result: '那一年这户的压力很大。' },
    ],
  },
  {
    title: '退役军人服务',
    scene: '一位退役军人来问优待证怎么办理。',
    options: [
      { text: '帮着查清流程，一次告知所需材料', performance: 3, effect: { reputation: 3, network: 2 }, result: '一次办成，他还带了几个人来问。' },
      { text: '告诉他去县里问', performance: 1, effect: { reputation: 1 }, result: '他跑了一趟县城。' },
      { text: '说不清楚，让他等通知', performance: -2, effect: { reputation: -3 }, result: '他在镇里等了半天。' },
    ],
  },
  {
    title: '留守老人',
    scene: '片区里几位老人长期独居，天冷了。',
    options: [
      { text: '排个名单，定期上门看看', performance: 3, effect: { reputation: 4, network: 1, health: -1 }, result: '有一次及时发现老人摔了跤。' },
      { text: '电话问一轮', performance: 1, effect: { reputation: 1 }, result: '都接了，都说没事。' },
      { text: '没人反映就不用管', performance: -2, effect: { reputation: -3 }, result: '开春才发现有一户出了事。' },
    ],
  },
  {
    title: '春耕备耕',
    scene: '要摸清农资需求和渠道，季节不等人。',
    options: [
      { text: '逐村统计，提前对接供应', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '没出现断供，也没人哄抬。' },
      { text: '让各村自己报需求', performance: 1, effect: { reputation: 1 }, result: '报上来的数不太准。' },
      { text: '等农户来问再说', performance: -1, effect: { reputation: -2 }, result: '开春那阵子天天有人上门问。' },
    ],
  },
  {
    title: '禁烧巡查',
    scene: '秸秆禁烧期，你在田埂上转。',
    options: [
      { text: '分片盯守，重点时段不离开', performance: 3, effect: { reputation: 3, health: -2 }, result: '整个期间没有火点。' },
      { text: '按路线巡一圈', performance: 1, effect: { reputation: 1, health: -1 }, result: '巡了，但晚间那阵没人。' },
      { text: '在岗点坐着等', performance: -2, effect: { reputation: -3 }, result: '卫星拍到了火点，通报到镇。' },
    ],
  },
  {
    title: '河长巡河',
    scene: '你负责的那段河道最近有人倒垃圾。',
    options: [
      { text: '沿线排查，找源头并设围挡', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '倒垃圾的口子被堵住了。' },
      { text: '把垃圾清了', performance: 1, effect: { reputation: 1, health: -1 }, result: '清完没两天又满了。' },
      { text: '巡河台账照填，问题不写', performance: -2, effect: { reputation: -2, integrity: -2 }, result: '上级巡河时一眼看见了。' },
    ],
  },
  {
    title: '自建房排查',
    scene: '要对自建房做安全排查，有几户不配合。',
    options: [
      { text: '讲清是为他们好，逐户看结构', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '查出两处隐患，及时加固。' },
      { text: '院外看一眼就登记', performance: 1, effect: { reputation: 1 }, result: '表填完了，隐患没发现。' },
      { text: '照着户口本填表交差', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '抽查发现根本没入户。' },
    ],
  },
  {
    title: '地灾点巡查',
    scene: '雨季后要盯住一个地灾隐患点。',
    options: [
      { text: '雨前雨中雨后各看一次，留记录', performance: 3, effect: { reputation: 3, health: -2 }, result: '发现裂缝变化，提前撤了人。' },
      { text: '每周看一次', performance: 1, effect: { reputation: 1 }, result: '没出事，记录也稀。' },
      { text: '电话问监测员', performance: -1, effect: { reputation: -2 }, result: '有一次裂缝变化是村民先发现的。' },
    ],
  },
  {
    title: '医保征缴',
    scene: '到了医保集中缴费期，还有几户没交。',
    options: [
      { text: '上门讲清断保后果，帮着代缴', performance: 3, effect: { reputation: 4, network: 1 }, result: '片区参保率排在前面。' },
      { text: '广播通知，等他们来', performance: 1, effect: { reputation: 1 }, result: '交了一部分。' },
      { text: '报个数字上去', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '有人住院才发现没参保。' },
    ],
  },
  {
    title: '养老认证',
    scene: '一批老人的待遇资格要认证，多数不会用手机。',
    options: [
      { text: '集中一天在村部帮办', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '一天办完大半，剩下的上门。' },
      { text: '让家属帮着认证', performance: 1, effect: { reputation: 1 }, result: '有家属在外地的还是没办。' },
      { text: '没认证就暂停，按规定办', performance: -1, effect: { reputation: -2 }, result: '有几位老人的待遇停了，意见很大。' },
    ],
  },
  {
    title: '就业帮扶',
    scene: '几个返乡的人找不到活干，来找你打听。',
    options: [
      { text: '摸清技能，对接用工信息和培训', performance: 3, effect: { reputation: 3, network: 2 }, result: '有几个人很快上了岗。' },
      { text: '把招工信息贴在公示栏', performance: 1, effect: { reputation: 1 }, result: '看到了多少算多少。' },
      { text: '让他们自己上网找', performance: -1, effect: { reputation: -2 }, result: '来问过的人后来不来了。' },
    ],
  },
  {
    title: '农家书屋',
    scene: '农家书屋长期没人来，书落了一层灰。',
    options: [
      { text: '按村民需要调整书，固定开放时间', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '慢慢有孩子和老人来看书了。' },
      { text: '打扫干净，把门打开', performance: 1, effect: { reputation: 1 }, result: '开了，还是没人来。' },
      { text: '锁着，等检查时再开', performance: -1, effect: { reputation: -2 }, result: '检查那天钥匙找不到了。' },
    ],
  },
  {
    title: '村务公开',
    scene: '村务公开栏内容很久没更新，有人拍照发了群。',
    options: [
      { text: '逐项核账后更新，并说明每一笔', performance: 3, effect: { reputation: 4, integrity: 1, health: -1 }, result: '群里那股气消了，反而有人点赞。' },
      { text: '把新内容贴上去', performance: 1, effect: { reputation: 1 }, result: '更新了，没人再问。' },
      { text: '把旧的内容撕掉，先空着', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '空栏子被拍下来，问的人更多了。' },
    ],
  },
];

},
"game/rank-events/rank-02": function(module, exports, require) {
// 职级 2 · 四级主任科员（独立承办一块业务）
//
// 权力边界：开始单独牵头一个小专项、负责一条线上的台账和材料，能经办、
// 能督办，但拍板权还在副科级手里。题目围绕"一件事由你从头跟到尾"。
// 50 道。

module.exports = [
  {
    title: '起草通知',
    scene: '分管领导要你起草一份专项整治通知，只给了口头要求，没有给成稿参考。',
    options: [
      { text: '先问清范围、时限和报送口径，再动笔', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '初稿一次过，领导只改了两个词。' },
      { text: '照以往同类通知改一版交上去', performance: 1, effect: { reputation: 1 }, result: '能用，但被退回来补了两处口径。' },
      { text: '等别的科室先出稿，再照着套', performance: -1, effect: { reputation: -2 }, result: '稿子交晚了，催办电话先到了。' },
    ],
  },
  {
    title: '汇总报表',
    scene: '八个村居的进度表陆续报上来，格式五花八门，有几个数字明显对不上。',
    options: [
      { text: '逐村打电话核口径，统一后再汇总', performance: 3, effect: { reputation: 4, health: -2 }, result: '汇总表一次通过，后面复查没返工。' },
      { text: '按多数格式整理，异常值标灰备注', performance: 1, effect: { reputation: 1 }, result: '交上去了，备注被追问了两次。' },
      { text: '把明显对不上的改成能对齐的数', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '表好看了，抽查那天对不上账。' },
    ],
  },
  {
    title: '陪同检查',
    scene: '上级检查组明天到，领导让你全程陪同并做记录。',
    options: [
      { text: '提前走一遍点位，把台账和现场对上', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '检查组问的每一处都能当场翻出来。' },
      { text: '按通知清单准备，跟着走完流程', performance: 1, effect: { reputation: 1 }, result: '没出岔子，也没什么亮点。' },
      { text: '临时把台账补齐，先把检查应付过去', performance: -1, effect: { reputation: -2, integrity: -2 }, result: '补的痕迹太新，被当场指出来。' },
    ],
  },
  {
    title: '专项摸排',
    scene: '要在两周内摸清辖区内的自建房情况，没人手，只能你自己跑。',
    options: [
      { text: '分片排期，白天入户晚上录表', performance: 3, effect: { reputation: 4, health: -3 }, result: '按期交账，底数清楚到每一栋。' },
      { text: '请各村自己报，你汇总', performance: 1, effect: { reputation: 1 }, result: '数据来了，但几处明显漏报。' },
      { text: '按去年数据改个日期报上去', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '抽查时一户新增的没人知道。' },
    ],
  },
  {
    title: '接访记录',
    scene: '一位老人来反映低保问题，说了四十分钟，重点散在各处。',
    options: [
      { text: '边听边记，复述一遍要点请他确认', performance: 3, effect: { reputation: 4 }, result: '诉求清楚了，转办单当天就出去了。' },
      { text: '记下主要诉求，细节略过', performance: 1, effect: { reputation: 1 }, result: '单子转出去了，被退回补了一次材料。' },
      { text: '劝他先回去，等材料齐了再来', performance: -1, effect: { reputation: -3 }, result: '老人又跑了两趟，情绪越来越大。' },
    ],
  },
  {
    title: '会议纪要',
    scene: '一个多小时的协调会，各方吵了三轮，最后才勉强有个结论。',
    options: [
      { text: '按议题分块记，结论和责任人单独列出', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '纪要当天发出，没人来扯皮。' },
      { text: '记下最后结论', performance: 1, effect: { reputation: 1 }, result: '结论有了，过程没人认。' },
      { text: '只记领导最后说的几句', performance: -1, effect: { reputation: -2 }, result: '两个部门都说自己没答应过。' },
    ],
  },
  {
    title: '政策宣讲',
    scene: '要去村里讲一轮新出的补贴政策，听众大多是上了年纪的人。',
    options: [
      { text: '做成一页纸的问答，逐条念完再答疑', performance: 3, effect: { reputation: 4, health: -1 }, result: '散场后被围住问了半小时，都是真问题。' },
      { text: '照文件念一遍', performance: 1, effect: { reputation: 1 }, result: '念完了，大部分人没听懂。' },
      { text: '把材料发下去让大家自己看', performance: -1, effect: { reputation: -2 }, result: '材料被折成纸飞机带回了家。' },
    ],
  },
  {
    title: '入户走访',
    scene: '一户人家连着三次没开门，台账上标着"已联系"。',
    options: [
      { text: '找邻居问清作息，改个时间去', performance: 3, effect: { reputation: 4, health: -1 }, result: '第四次见着人了，实际情况和台账不一样。' },
      { text: '按台账记为已走访', performance: 1, effect: { reputation: 1 }, result: '进度条满了，问题还压着。' },
      { text: '直接勾掉这户，不再联系', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '后来这户的事闹到了镇里。' },
    ],
  },
  {
    title: '数据核对',
    scene: '两个系统里同一批人的信息不一致，一边多出三十来条。',
    options: [
      { text: '逐条比对，把差异列成清单交上去', performance: 3, effect: { reputation: 3, health: -2 }, result: '差异清单成了后面清洗的依据。' },
      { text: '以新系统为准，旧的先放着', performance: 1, effect: { reputation: 1 }, result: '暂时一致了，来源说不清。' },
      { text: '把旧的删掉，只留新的', performance: -1, effect: { reputation: -2, integrity: -2 }, result: '删掉的那批里有人还在享受待遇。' },
    ],
  },
  {
    title: '报送材料',
    scene: '一份材料明天上午必须到，你今晚才发现缺一个盖章页。',
    options: [
      { text: '连夜联系盖章的人，第二天一早补上', performance: 3, effect: { reputation: 3, health: -2 }, result: '材料按时到了，章也齐。' },
      { text: '先报电子版，纸质后补', performance: 1, effect: { reputation: 1 }, result: '收下了，被提醒了一句。' },
      { text: '自己把章的位置处理一下', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '这件事后来成了说不清的一笔。' },
    ],
  },
  {
    title: '组织培训',
    scene: '要给村里的经办人做一次业务培训，来的人水平参差。',
    options: [
      { text: '分成基础和提高两段，各讲各的', performance: 3, effect: { reputation: 4, network: 1, health: -1 }, result: '两边都说听明白了，课后加了群。' },
      { text: '统一讲一遍通用内容', performance: 1, effect: { reputation: 1 }, result: '讲完了，一半人觉得太浅。' },
      { text: '放一段录像代替讲课', performance: -1, effect: { reputation: -2 }, result: '人走了大半。' },
    ],
  },
  {
    title: '督办进度',
    scene: '三件事交给了三个单位，到期的只有一件报了进度。',
    options: [
      { text: '逐个打电话问，把卡点记下来往上反映', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '卡点到了领导桌上，两件动了。' },
      { text: '发催办通知，等回复', performance: 1, effect: { reputation: 1 }, result: '回复来了，都是"正在推进"。' },
      { text: '把没报的写成已完成', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '月底核查时三件都还没动。' },
    ],
  },
  {
    title: '答复建议',
    scene: '收到一份人大代表建议，涉及的事不在你这条线上。',
    options: [
      { text: '先收下登记，查清归口后转办并回执', performance: 3, effect: { reputation: 3, network: 1 }, result: '代表收到回执，后面还专门来问过进展。' },
      { text: '告诉对方找别的科室', performance: 1, effect: { reputation: 1 }, result: '对方又跑去别的科室问了一圈。' },
      { text: '先压着，等有人来问再说', performance: -2, effect: { reputation: -3 }, result: '答复期过了，被通报了。' },
    ],
  },
  {
    title: '档案移交',
    scene: '一位老同事要调走，他手上的档案要交给你。',
    options: [
      { text: '按目录逐卷清点，缺的当场列清单', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '交接单签了字，后面没人再来找麻烦。' },
      { text: '大致数一下箱数就签字', performance: 1, effect: { reputation: 1 }, result: '签了，半年后发现少了两卷。' },
      { text: '让他自己处理，你不管', performance: -2, effect: { reputation: -3 }, result: '档案堆在过道，谁走过都看一眼。' },
    ],
  },
  {
    title: '现场核查',
    scene: '有人举报一处场地违规使用，照片拍得含糊。',
    options: [
      { text: '约上相关方一起去现场，当场做笔录', performance: 3, effect: { reputation: 4, integrity: 1 }, result: '事实清楚了，举报属实一半。' },
      { text: '自己单独去看一眼', performance: 1, effect: { reputation: 1 }, result: '看了，但双方说法对不上。' },
      { text: '按照片认定，不再去现场', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '认定错了，对方拿着证据来申诉。' },
    ],
  },
  {
    title: '民意收集',
    scene: '要在小区里收一轮意见，白天大部分人不在家。',
    options: [
      { text: '晚上和周末再跑两轮，线上线下都开', performance: 3, effect: { reputation: 4, health: -2 }, result: '收回的份数是上一轮的三倍。' },
      { text: '白天跑一轮，收到多少算多少', performance: 1, effect: { reputation: 1 }, result: '样本基本是在家的老人。' },
      { text: '找几个熟面孔填一填', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '意见高度雷同，一眼就看得出来。' },
    ],
  },
  {
    title: '物资登记',
    scene: '一批救灾物资到了，签收单和实物对不上。',
    options: [
      { text: '当场重数，差异写在签收单上', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '差异当场说清，后面没人背锅。' },
      { text: '照单签收，回头再查', performance: 1, effect: { reputation: 1 }, result: '签了，之后再查就查不清了。' },
      { text: '按单签收，多出来的先留着', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '留着的东西后来成了麻烦。' },
    ],
  },
  {
    title: '值班安排',
    scene: '节假日值班表排出来了，两个人的时间撞了。',
    options: [
      { text: '先问清各自难处，再协调对调', performance: 3, effect: { reputation: 3, network: 1 }, result: '两人都满意，表也排好了。' },
      { text: '按原表执行，让他们自己解决', performance: 1, effect: { reputation: 1 }, result: '解决了，但有人有意见。' },
      { text: '把自己排上去顶两班', performance: 1, effect: { reputation: 2, health: -3 }, result: '班顶下来了，假期也没了。' },
    ],
  },
  {
    title: '情况说明',
    scene: '上级要一份情况说明，事情的经过你只参与了一段。',
    options: [
      { text: '只写自己经手的部分，其余注明由谁补充', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '说明立得住，补充也有人认。' },
      { text: '把听到的都写进去', performance: 1, effect: { reputation: 1 }, result: '写完了，有两处被人否认。' },
      { text: '推给别人去写', performance: -1, effect: { reputation: -2 }, result: '交上去晚了，还被人说成是不配合。' },
    ],
  },
  {
    title: '典型材料',
    scene: '领导要报一个先进典型，手上有两个人选都还行。',
    options: [
      { text: '按实绩比对，把两个都报上去让上面选', performance: 3, effect: { reputation: 3, network: 1 }, result: '两个都入了围，都没得罪。' },
      { text: '报跟自己熟的那个', performance: 1, effect: { reputation: 1, network: 1 }, result: '报上去了，另一个人有想法。' },
      { text: '把材料编得漂亮些', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '实地核验时事迹对不上。' },
    ],
  },
  {
    title: '台账更新',
    scene: '台账三个月没更新，很多情况已经变了。',
    options: [
      { text: '从头核一遍，变更的都留痕', performance: 3, effect: { reputation: 3, health: -2 }, result: '台账重新能用，后面省了很多事。' },
      { text: '把明显变的改一改', performance: 1, effect: { reputation: 1 }, result: '表面跟上了，细节还是旧的。' },
      { text: '沿用旧台账，等检查再说', performance: -2, effect: { reputation: -3 }, result: '检查那天翻出一堆过期信息。' },
    ],
  },
  {
    title: '协调会',
    scene: '两个单位为一件事的归属扯了很久，会是你召集的。',
    options: [
      { text: '先摆职责依据，再把分歧点收敛成一个问题', performance: 3, effect: { reputation: 4, network: 2 }, result: '会开了一半就定了，双方都签了字。' },
      { text: '让双方各说各的，会后汇总', performance: 1, effect: { reputation: 1 }, result: '会散了，分歧还在。' },
      { text: '按领导的意思直接定', performance: -1, effect: { reputation: -2 }, result: '定了，被推的一方一直不服。' },
    ],
  },
  {
    title: '整改销号',
    scene: '一个问题挂了半年，整改报告交了三版。',
    options: [
      { text: '去现场看整改到底落地没有', performance: 3, effect: { reputation: 4, integrity: 1 }, result: '实地一看，报告里写的根本没做。' },
      { text: '看报告齐不齐，齐了就销', performance: 1, effect: { reputation: 1 }, result: '销号了，问题还在那儿。' },
      { text: '先销了免得挂账', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '复查时被翻出来，账算到你头上。' },
    ],
  },
  {
    title: '摸底调查',
    scene: '要在不惊动太多人的前提下摸清一件事的真实情况。',
    options: [
      { text: '分头找不同的人侧面问，交叉印证', performance: 3, effect: { reputation: 3, health: -1 }, result: '几个说法能对上，基本摸清了。' },
      { text: '直接找当事人问', performance: 1, effect: { reputation: 1 }, result: '问到了一套说法，没法印证。' },
      { text: '听一个人的说法就下结论', performance: -2, effect: { reputation: -3 }, result: '结论偏了，后面很难改口。' },
    ],
  },
  {
    title: '宣传稿',
    scene: '本单位的一件事被上面点名要报个稿子。',
    options: [
      { text: '写清做了什么、谁在办、下一步是什么', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '稿子发了，还被转了一次。' },
      { text: '套模板写一版', performance: 1, effect: { reputation: 1 }, result: '发了，没什么水花。' },
      { text: '把没做的事也写进去', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '有人拿着稿子来问什么时候兑现。' },
    ],
  },
  {
    title: '群众回访',
    scene: '三个月前办结的一件事，要回访当事人。',
    options: [
      { text: '问清办完后的实际情况，不满意的再跟进', performance: 3, effect: { reputation: 4 }, result: '回访出两个新问题，都补办了。' },
      { text: '打个电话确认办结', performance: 1, effect: { reputation: 1 }, result: '确认了，挂了电话。' },
      { text: '照台账填满意', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '抽查回访时当事人说根本没人联系过。' },
    ],
  },
  {
    title: '界线纠纷',
    scene: '两户人家为一道地界吵起来了，都说是自己的。',
    options: [
      { text: '找老台账和老邻居一起到现场指界', performance: 3, effect: { reputation: 4, health: -1 }, result: '界指清楚了，两家都认。' },
      { text: '让村里自己去调解', performance: 1, effect: { reputation: 1 }, result: '调解了，但没留下书面东西。' },
      { text: '按关系近的一方说', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '另一方不服，事情越闹越大。' },
    ],
  },
  {
    title: '帮扶走访',
    scene: '一户帮扶对象今年收入没起来，孩子还在上学。',
    options: [
      { text: '问清卡在哪，帮着对接一个能解决的口子', performance: 3, effect: { reputation: 4, network: 1 }, result: '下半年这户有了稳定来源。' },
      { text: '照例走访，记录情况', performance: 1, effect: { reputation: 1 }, result: '记录是完整的，情况没变。' },
      { text: '把收入填高一点让数据好看', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '复核时一问就露了。' },
    ],
  },
  {
    title: '应急值守',
    scene: '夜里接到预警，要求半小时内到岗。',
    options: [
      { text: '立刻到岗，先把点位和风险点过一遍', performance: 3, effect: { reputation: 3, health: -2 }, result: '一夜无事，第二天的交接也清楚。' },
      { text: '按时到岗，等通知', performance: 1, effect: { reputation: 1, health: -1 }, result: '到岗了，但没主动做什么。' },
      { text: '电话里说在路上了，人没去', performance: -3, effect: { reputation: -4, integrity: -3 }, result: '查岗时那半小时怎么都说不清。' },
    ],
  },
  {
    title: '台账自查',
    scene: '上面要求先自查，再抽查。自查表要自己填。',
    options: [
      { text: '照实填，把问题也写进去', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '抽查没挑出新的毛病，反而被说自查实。' },
      { text: '填成基本合格', performance: 1, effect: { reputation: 1 }, result: '合格了，问题还压着。' },
      { text: '全部填合格', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '抽查一项一项被打回来。' },
    ],
  },
  {
    title: '领导交办',
    scene: '领导口头交办了一件事，没说时限也没说标准。',
    options: [
      { text: '当场确认时限、标准和要不要留痕', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '办完一次到位，领导没再追问。' },
      { text: '按自己的理解办完回报', performance: 1, effect: { reputation: 1 }, result: '办了，方向偏了一点点。' },
      { text: '等领导再想起这件事', performance: -2, effect: { reputation: -3 }, result: '领导想起时，事已经过了窗口期。' },
    ],
  },
  {
    title: '数据口径',
    scene: '同一个指标，两个部门报上来的数差了一截。',
    options: [
      { text: '把两边的口径摊开对，找出差在哪一步', performance: 3, effect: { reputation: 3, health: -1 }, result: '口径统一了，往后不用再扯。' },
      { text: '取一个中间数报上去', performance: 1, effect: { reputation: 1 }, result: '报了，两个部门都不认。' },
      { text: '按对自己有利的那个报', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被问到来源时答不上来。' },
    ],
  },
  {
    title: '材料把关',
    scene: '下级报上来一份材料，里面有几处说法你没有依据确认。',
    options: [
      { text: '退回要求补依据，没有依据的表述删掉', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '材料干净了，后面经得起问。' },
      { text: '改动几处明显的错就报', performance: 1, effect: { reputation: 1 }, result: '报了，被追问了两处。' },
      { text: '照报，反正上面也不一定看', performance: -1, effect: { reputation: -2 }, result: '上面看了，还专门打电话来问。' },
    ],
  },
  {
    title: '现场会',
    scene: '要在你负责的这个点开一个现场会，来的人不少。',
    options: [
      { text: '提前演练动线，把讲解交给最熟的人', performance: 3, effect: { reputation: 4, health: -2 }, result: '会开得顺，点位被记进了典型。' },
      { text: '按流程走一遍', performance: 1, effect: { reputation: 1 }, result: '开完了，没留下什么印象。' },
      { text: '临时布置一下现场', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '有人提前一天来看过，看出来了。' },
    ],
  },
  {
    title: '走访台账',
    scene: '一季度的走访台账要归档，里面有几次是同事代填的。',
    options: [
      { text: '标注代填人并补齐走访记录', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '台账经得起翻，代填也说得清。' },
      { text: '补几个签名归档', performance: 1, effect: { reputation: 1 }, result: '归档了，记录还是空的。' },
      { text: '照原样归档', performance: -1, effect: { reputation: -2 }, result: '抽查时被问到那几次走访的细节。' },
    ],
  },
  {
    title: '舆情线索',
    scene: '有人在群里发了一段视频，说的跟实际情况有出入。',
    options: [
      { text: '核清事实后公开说明，能改的马上改', performance: 3, effect: { reputation: 4 }, result: '视频下面有人替你回了话。' },
      { text: '私下联系发帖人删掉', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '删了，但已经有人存了。' },
      { text: '不理，等热度过去', performance: -2, effect: { reputation: -3 }, result: '热度没过去，反而上了别的平台。' },
    ],
  },
  {
    title: '年度总结',
    scene: '要写本科室的年度总结，成绩不多，事情不少。',
    options: [
      { text: '按事列，把没做成的也写进去并说明原因', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '念完没人挑刺，第二年好要资源。' },
      { text: '把做过的事堆上去', performance: 1, effect: { reputation: 1 }, result: '厚厚一叠，没人看完。' },
      { text: '照去年的改改数字', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '有几个数据跟别处对不上。' },
    ],
  },
  {
    title: '业务轮训',
    scene: '有一个去上级跟班学习的名额，要去三个月。',
    options: [
      { text: '把手上的事交接清楚再去，回来写份报告', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '学成回来，认识了一批人。' },
      { text: '去，走前简单交代一下', performance: 1, effect: { reputation: 1, network: 1 }, result: '回来了，交接处留了个尾巴。' },
      { text: '不去，手上的事离不开', performance: 1, effect: { reputation: 1 }, result: '事没耽误，机会给了别人。' },
    ],
  },
  {
    title: '交叉检查',
    scene: '要去别的乡镇交叉检查，那边有人跟你认识。',
    options: [
      { text: '按清单查，熟人那块查得更细', performance: 3, effect: { reputation: 4, integrity: 1 }, result: '查出的问题对方认了，没伤情面。' },
      { text: '按清单查', performance: 1, effect: { reputation: 1 }, result: '查完了，没什么发现。' },
      { text: '熟人那块跳过', performance: -2, effect: { reputation: -2, integrity: -2 }, result: '后来那边出事，牵到这次检查。' },
    ],
  },
  {
    title: '帮办代办',
    scene: '一位行动不便的人要办一件事，按规定得本人到场。',
    options: [
      { text: '问清能否上门核验，按程序办', performance: 3, effect: { reputation: 4 }, result: '上门办成了，对方托人送来一封感谢信。' },
      { text: '让他找人代办', performance: 1, effect: { reputation: 1 }, result: '办成了，绕了一圈。' },
      { text: '让他自己想办法来', performance: -2, effect: { reputation: -3 }, result: '事拖了两个月才办。' },
    ],
  },
  {
    title: '流程优化',
    scene: '一个事项要盖四个章，群众来回跑三趟。',
    options: [
      { text: '量一遍各环节耗时，写份简化建议报上去', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '建议被采纳了两项，跑动少了一趟。' },
      { text: '口头上跟领导提一句', performance: 1, effect: { reputation: 1 }, result: '提了，没有下文。' },
      { text: '照旧办，不惹麻烦', performance: -1, effect: { reputation: -2 }, result: '投诉量一直没下来。' },
    ],
  },
  {
    title: '遗留问题',
    scene: '一件事拖了三年，经手的人换了两茬，材料只剩半份。',
    options: [
      { text: '把能找到的都拼起来，列清卡点再报', performance: 3, effect: { reputation: 4, health: -2 }, result: '卡点清楚了，事情重新启动。' },
      { text: '从头重新走一遍流程', performance: 1, effect: { reputation: 1, health: -1 }, result: '走了，但三年的问题又要三年。' },
      { text: '按历史遗留挂起来', performance: -1, effect: { reputation: -2 }, result: '又挂了一年，人又找上来了。' },
    ],
  },
  {
    title: '基层座谈',
    scene: '要开一场座谈会，来的都是村里的人。',
    options: [
      { text: '先给提纲，让人人都能说上三句', performance: 3, effect: { reputation: 3, network: 1 }, result: '会开得活，收集到不少真问题。' },
      { text: '让村干部先讲', performance: 1, effect: { reputation: 1 }, result: '讲完了，别人没怎么开口。' },
      { text: '念一通报就散会', performance: -1, effect: { reputation: -2 }, result: '下次再召集，来的人少了一半。' },
    ],
  },
  {
    title: '政策答疑',
    scene: '有人问的政策你只听过名字，细节不清楚。',
    options: [
      { text: '记下问题，查清文件后回电话', performance: 3, effect: { reputation: 4 }, result: '第二天回了电话，对方很意外。' },
      { text: '按大体理解说个方向', performance: 1, effect: { reputation: 1 }, result: '方向没大错，细节要再来问。' },
      { text: '说不在你这块，让他去问别人', performance: -1, effect: { reputation: -2 }, result: '他问了三家，回来还是找到你。' },
    ],
  },
  {
    title: '台账归档',
    scene: '一年的台账要归档，有几本记得很潦草。',
    options: [
      { text: '趁还记得补清楚再归档', performance: 3, effect: { reputation: 3, health: -1 }, result: '第二年翻出来，一查就到。' },
      { text: '照原样归档', performance: 1, effect: { reputation: 1 }, result: '归了，第二年看不懂。' },
      { text: '重抄一本干净的', performance: -1, effect: { reputation: -2, integrity: -2 }, result: '抄本和原件对不上，反而是个问题。' },
    ],
  },
  {
    title: '进度通报',
    scene: '要出一期进度通报，有几个单位排在最后。',
    options: [
      { text: '照实排名，同时写清落后原因和下一步', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '通报发出去，落后的那几家动起来了。' },
      { text: '只写进度不排名', performance: 1, effect: { reputation: 1 }, result: '通报发了，没人当回事。' },
      { text: '把熟人单位往前排', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '排名被人拿去对比，很难解释。' },
    ],
  },
  {
    title: '典型推荐',
    scene: '要推荐一个人去上面交流，两个人条件相当。',
    options: [
      { text: '列条件公开比，让几个人一起评', performance: 3, effect: { reputation: 3, network: 1 }, result: '评出来的那个大家都服。' },
      { text: '领导定', performance: 1, effect: { reputation: 1 }, result: '定了，另一个人来问过。' },
      { text: '推荐跟自己走得近的', performance: -1, effect: { reputation: -2, network: 1 }, result: '推荐成了，但有人背后议论。' },
    ],
  },
  {
    title: '联合排查',
    scene: '几个部门一起排查，各自的清单不一样。',
    options: [
      { text: '先把清单并成一份，再去现场', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '一次跑完，后面不用再约。' },
      { text: '各查各的，最后汇总', performance: 1, effect: { reputation: 1 }, result: '去了三趟同一户人家。' },
      { text: '只查自己这块', performance: -1, effect: { reputation: -1 }, result: '查完了，别的部门又来敲门。' },
    ],
  },
  {
    title: '问卷统计',
    scene: '收回几百份问卷，有几份填得明显不用心。',
    options: [
      { text: '按规则判无效，作废份数写进说明', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '结果站得住，被拿去用了。' },
      { text: '全部计入', performance: 1, effect: { reputation: 1 }, result: '统计完了，几项结果很怪。' },
      { text: '把不合适的答案删掉再统计', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '结果好看，但没有依据。' },
    ],
  },
  {
    title: '交接准备',
    scene: '你可能要调去新的岗位，手上的事要交出去。',
    options: [
      { text: '写一份交接清单，逐项带着接手人过一遍', performance: 3, effect: { reputation: 3, seniority: 1, network: 1 }, result: '走得很干净，新岗位的消息也来得快。' },
      { text: '把材料整理好放着', performance: 1, effect: { reputation: 1 }, result: '接手人翻了半天才理出头绪。' },
      { text: '先不管，等真调再说', performance: -1, effect: { reputation: -2 }, result: '调令来得突然，交接乱了一周。' },
    ],
  },
];

},
"game/rank-events/rank-03": function(module, exports, require) {
// 职级 3 · 乡科级副职（副科级）
//
// 权力边界：第一次有了"自己分管的一条线"。能拍线条线内的小事，能分几个人的
// 工，能在会上表态，但钱和人的最终决定还要往上走。题目围绕"分管线上的取舍"。
// 50 道。

module.exports = [
  {
    title: '分管条线',
    scene: '班子分工定了，你分到一条基础最差、历史欠账最多的线。',
    options: [
      { text: '先把欠账列成清单，分三年往下推', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '清单交上去，第一年就清了两项。' },
      { text: '先抓最显眼的一项', performance: 1, effect: { reputation: 1 }, result: '那一项做出来了，别的没动。' },
      { text: '抱怨分工不公，消极接手', performance: -2, effect: { reputation: -3 }, result: '班子会上被点了一次名。' },
    ],
  },
  {
    title: '包村工作',
    scene: '你包的那个村班子不太齐，书记和主任各说各话。',
    options: [
      { text: '分别谈一次，把职责划清楚再开联席会', performance: 3, effect: { reputation: 4, network: 2 }, result: '两个月后这个村能自己开会了。' },
      { text: '谁找你就听谁的', performance: 1, effect: { reputation: 1 }, result: '两边都觉得你站对面。' },
      { text: '只找书记，主任那边不管', performance: -1, effect: { reputation: -2 }, result: '主任开始绕开你往上报。' },
    ],
  },
  {
    title: '条线例会',
    scene: '第一次开条线例会，来了七个人，一半在玩手机。',
    options: [
      { text: '定死规矩：每人三分钟，先讲卡点', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '第三次例会，会短了一半，问题多了。' },
      { text: '照流程念一遍通报', performance: 1, effect: { reputation: 1 }, result: '念完了，散会。' },
      { text: '发火训一顿', performance: -1, effect: { reputation: -2 }, result: '会后没人再跟你说实话。' },
    ],
  },
  {
    title: '项目落地',
    scene: '一个项目批下来了，选址卡在两户人家的地上。',
    options: [
      { text: '逐户谈清补偿和安置，谈不拢就调规划', performance: 3, effect: { reputation: 4, health: -2 }, result: '一户谈成，一户调了红线，项目按期开。' },
      { text: '请村里出面施压', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了，但留下两个上访隐患。' },
      { text: '先开工，边干边谈', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '工地被堵了三天。' },
    ],
  },
  {
    title: '站所协调',
    scene: '一件跨站所的事，两个站所都说是对方的。',
    options: [
      { text: '把职责文件摆出来，当场划清牵头和配合', performance: 3, effect: { reputation: 3, network: 2 }, result: '事办了，往后这类事有先例可循。' },
      { text: '各打五十大板，一人一半', performance: 1, effect: { reputation: 1 }, result: '办了，两边都不太情愿。' },
      { text: '压给资历浅的那个', performance: -1, effect: { reputation: -2 }, result: '办砸了，也寒了人心。' },
    ],
  },
  {
    title: '矛盾调处',
    scene: '两家人因为排水沟打了架，一方住了院。',
    options: [
      { text: '先看伤情和现场，再分开调解并留书面协议', performance: 3, effect: { reputation: 4, health: -1 }, result: '协议签了，第二年没再闹。' },
      { text: '叫双方坐下来谈一次', performance: 1, effect: { reputation: 1 }, result: '谈崩了，各自回家。' },
      { text: '让派出所处理，你不管', performance: -1, effect: { reputation: -2 }, result: '处理完了，仇还在。' },
    ],
  },
  {
    title: '防汛值守',
    scene: '暴雨预警，你分管的两个村有地质灾害点。',
    options: [
      { text: '提前把人撤到安置点，通宵盯点', performance: 3, effect: { reputation: 4, health: -3 }, result: '半夜滑坡，没有人员伤亡。' },
      { text: '按预案电话通知到村', performance: 1, effect: { reputation: 1, health: -1 }, result: '通知到了，撤没撤不清楚。' },
      { text: '等雨大了再说', performance: -3, effect: { reputation: -4, integrity: -2 }, result: '路断了，人被围在里面。' },
    ],
  },
  {
    title: '安全生产',
    scene: '排查发现一处作坊有隐患，老板是你一个熟人。',
    options: [
      { text: '照样下整改，限期复查，熟人也不例外', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '改了，全镇都知道这次是动真格。' },
      { text: '口头提醒，不下文书', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '提醒了，隐患还在。' },
      { text: '打个招呼让他先歇两天', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '两天后出了事，招呼的事瞒不住。' },
    ],
  },
  {
    title: '资金分配建议',
    scene: '一笔资金要在你这条线上分，四个村都想要。',
    options: [
      { text: '按项目成熟度和需求排序，公开评分', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 1 }, result: '评分结果贴出去，没人不服。' },
      { text: '平均分配', performance: 1, effect: { reputation: 1 }, result: '谁都没意见，谁都不够用。' },
      { text: '给跟自己关系好的村多分', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '别村的干部开始在会上说话带刺。' },
    ],
  },
  {
    title: '人员分工',
    scene: '你手上有五个人，一个能干但不好管，两个老实但慢。',
    options: [
      { text: '按事配人，难事给能干的，流程活给细心的', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '半年后这五个人都能独当一面。' },
      { text: '平均分摊', performance: 1, effect: { reputation: 1 }, result: '活干完了，能干的那个憋着一肚子气。' },
      { text: '只把活派给两个老实的', performance: -1, effect: { reputation: -2 }, result: '老实人累倒了，能干的闲着。' },
    ],
  },
  {
    title: '迎检准备',
    scene: '后天上面来检查，你这条线的台账有两处对不上。',
    options: [
      { text: '连夜核清楚，能补的补，补不上的写说明', performance: 3, effect: { reputation: 3, health: -2 }, result: '检查组翻了说明，反而没再追问。' },
      { text: '把对不上的部分抽掉', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '抽掉了，检查组问起这一块没有东西。' },
      { text: '临时造一版台账', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '造的那版跟系统里的对不上。' },
    ],
  },
  {
    title: '信访件办理',
    scene: '一件缠访三年的案子转到你手上，前几任都判过。',
    options: [
      { text: '重新听一遍诉求，把真问题和情绪分开', performance: 3, effect: { reputation: 4, health: -2 }, result: '真问题是当年一处没落实的政策，补上了。' },
      { text: '照前任结论答复', performance: 1, effect: { reputation: 1 }, result: '答复了，人还在跑。' },
      { text: '劝他别再跑了，跑也没用', performance: -2, effect: { reputation: -3 }, result: '他跑去了上面。' },
    ],
  },
  {
    title: '招商接待',
    scene: '一家企业要来看地，看中的那块地另有规划。',
    options: [
      { text: '如实说明规划，另推两块符合条件的地', performance: 3, effect: { reputation: 3, network: 2 }, result: '企业在另一块地上落了脚。' },
      { text: '先答应下来，回头想办法调规划', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '规划调不动，企业白跑一趟。' },
      { text: '含糊带过，先把人留下', performance: -1, effect: { reputation: -2 }, result: '签约时才发现地用不了。' },
    ],
  },
  {
    title: '土地流转',
    scene: '一片地要流转出去，有十几户不愿意。',
    options: [
      { text: '逐户问清顾虑，能解决的先解决', performance: 3, effect: { reputation: 4, health: -2 }, result: '顾虑解决了九户，剩下几户另划了地块。' },
      { text: '请村里做工作', performance: 1, effect: { reputation: 1 }, result: '签了一部分，剩下的僵着。' },
      { text: '少数服从多数，硬推', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '推成了，也推出了上访。' },
    ],
  },
  {
    title: '村两委换届',
    scene: '换届在即，有个村的书记想连任，但群众反映不小。',
    options: [
      { text: '按程序考察，把反映的问题查清再说', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '查清了，反映的问题一半属实，换了人。' },
      { text: '先稳住，让他干完这届', performance: 1, effect: { reputation: 1 }, result: '稳住了，反映还在继续。' },
      { text: '保他连任，免得乱', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '选上去三个月，问题被人举报上去。' },
    ],
  },
  {
    title: '惠民政策落地',
    scene: '一项惠民政策下来了，符合条件的人比预想的多。',
    options: [
      { text: '重新摸底公示，按程序扩面或排队', performance: 3, effect: { reputation: 4 }, result: '公示后没人闹，分批也说得通。' },
      { text: '按原名单办，多的先登记', performance: 1, effect: { reputation: 1 }, result: '办了，登记的那批人来问了几次。' },
      { text: '悄悄多报几个名额', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '核对时发现名单里有人不符合条件。' },
    ],
  },
  {
    title: '突发舆情',
    scene: '一段关于你分管条线的视频在网上传开了，说得很重。',
    options: [
      { text: '两小时内核清事实，公开回应并给出整改时间表', performance: 3, effect: { reputation: 4, health: -1 }, result: '回应及时，风评反而转了。' },
      { text: '等上面统一口径', performance: 1, effect: { reputation: 1 }, result: '等到了口径，热度已经过去三轮。' },
      { text: '说是造谣，不做别的', performance: -2, effect: { reputation: -3 }, result: '造谣的说法没人信，反而引来更多追问。' },
    ],
  },
  {
    title: '横向协调',
    scene: '一件急事需要别的部门配合，对方说要走流程。',
    options: [
      { text: '带着材料上门，当面说清紧急程度并留函', performance: 3, effect: { reputation: 3, network: 2 }, result: '对方特事特办，还欠了你一个人情。' },
      { text: '发函等回复', performance: 1, effect: { reputation: 1 }, result: '回复来了，窗口期已经过了。' },
      { text: '找上级压对方', performance: -1, effect: { reputation: -2, network: -1 }, result: '压成了，往后这条路就断了。' },
    ],
  },
  {
    title: '条线考核',
    scene: '你这条线在镇里排名靠后，有几个指标根本不归你管。',
    options: [
      { text: '把指标来源摊开，能认的认，不能认的写清理由', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '第二年考核口径调整了，排名也上来了。' },
      { text: '全盘接受，回去加码', performance: 1, effect: { reputation: 1, health: -1 }, result: '加码了，指标还是上不去。' },
      { text: '私下找人改数据', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '改的那几个数，第二年成了别人的把柄。' },
    ],
  },
  {
    title: '下属失误',
    scene: '你手下的一个人把一份材料报错了，影响已经出去了。',
    options: [
      { text: '先补救，再查流程漏洞，责任你自己先担', performance: 3, effect: { reputation: 4, network: 2 }, result: '补救及时，那个人往后格外卖力。' },
      { text: '让他自己去说明', performance: 1, effect: { reputation: 1 }, result: '他说明了，上面觉得你在甩锅。' },
      { text: '当众批评，撇清关系', performance: -1, effect: { reputation: -2, network: -2 }, result: '人心散了，没人再愿意接急活。' },
    ],
  },
  {
    title: '会议决策',
    scene: '一件事要在会上定，你心里有倾向，但有个反对意见说得也在理。',
    options: [
      { text: '把两种方案摆开比，让班子一起定', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '最后选了反对的那版，效果比你的好。' },
      { text: '坚持自己的方案', performance: 1, effect: { reputation: 1 }, result: '定了，执行中磕磕绊绊。' },
      { text: '看一把手眼色再表态', performance: -1, effect: { reputation: -2 }, result: '表态晚了，两边都不讨好。' },
    ],
  },
  {
    title: '请示汇报',
    scene: '一件有风险的事，你可以自己定，也可以往上请示。',
    options: [
      { text: '带着两个方案和风险点去请示', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '领导当场定了，还说你想得周全。' },
      { text: '口头问一句，没留痕', performance: 1, effect: { reputation: 1 }, result: '问了，后面出事说不清是谁定的。' },
      { text: '自己定，不请示', performance: -2, effect: { reputation: -2, integrity: -1 }, result: '出了事，责任全在你。' },
    ],
  },
  {
    title: '村级财务',
    scene: '有个村的账目被村民质疑，票据不全。',
    options: [
      { text: '请第三方清账，结果公示', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '清完公示，质疑消了，也查出两笔要退。' },
      { text: '让村里自己解释', performance: 1, effect: { reputation: 1 }, result: '解释了，村民不信。' },
      { text: '把账压下来不让看', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '压不住，人直接反映到了上面。' },
    ],
  },
  {
    title: '道路修缮',
    scene: '一段村道要修，钱只够修一半。',
    options: [
      { text: '按通行量排序，先修最要紧那半并公示', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '公示后没人闹，第二年续上了。' },
      { text: '平均分成两段各修一点', performance: 1, effect: { reputation: 1 }, result: '两段都是断头路。' },
      { text: '修靠近自己包村的那段', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '另外一个村的干部在会上直接问了。' },
    ],
  },
  {
    title: '饮水工程',
    scene: '一个组的自来水时有时无，已经反映半年。',
    options: [
      { text: '顺着管道一段段查，找到漏点再改', performance: 3, effect: { reputation: 4, health: -2 }, result: '漏点在一个老接口上，换了就通了。' },
      { text: '请施工队来看一次', performance: 1, effect: { reputation: 1 }, result: '来看了，说要整体改造。' },
      { text: '记下来报明年计划', performance: -1, effect: { reputation: -2 }, result: '又一年，水还是时有时无。' },
    ],
  },
  {
    title: '产业项目',
    scene: '一个产业项目落地一年，效益跟当初说的不一样。',
    options: [
      { text: '实地核算收益和带动户数，该调整的调整', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '调整了经营模式，第二年真见到了收益。' },
      { text: '按原方案继续推', performance: 1, effect: { reputation: 1 }, result: '推了，带动力一直上不去。' },
      { text: '把数据做上去交差', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '核查时农户一句实话就戳破了。' },
    ],
  },
  {
    title: '劳务纠纷',
    scene: '一个工地十几个人没拿到工钱，堵在镇政府门口。',
    options: [
      { text: '当场登记欠薪明细，约谈施工方并给时限', performance: 3, effect: { reputation: 4, health: -1 }, result: '期限内付了七成，剩下的签了还款计划。' },
      { text: '劝散，让他们走程序', performance: 1, effect: { reputation: 1 }, result: '散了，第二天又来了。' },
      { text: '让施工方自己处理', performance: -2, effect: { reputation: -3 }, result: '施工方跑了，人找到了上面。' },
    ],
  },
  {
    title: '校园安全',
    scene: '有家长反映校门口上下学时很乱，出过一次险情。',
    options: [
      { text: '现场蹲一周，摸清车流再定分流方案', performance: 3, effect: { reputation: 4, health: -1 }, result: '划了临时停车区和护学岗，险情没再发生。' },
      { text: '让学校加强管理', performance: 1, effect: { reputation: 1 }, result: '学校管了，路还是那条路。' },
      { text: '加个告示牌', performance: -1, effect: { reputation: -2 }, result: '牌子立了，没人看。' },
    ],
  },
  {
    title: '集市秩序',
    scene: '集市占道经营多年，一管就吵，不管就堵。',
    options: [
      { text: '先划出摆卖区，给一段过渡期再管', performance: 3, effect: { reputation: 3, health: -1 }, result: '过渡期后路通了，摊主也有地方。' },
      { text: '集中整治一次', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '整治完三天，又回去了。' },
      { text: '随它去，反正年年如此', performance: -1, effect: { reputation: -2 }, result: '一起因占道引发的碰撞上了新闻。' },
    ],
  },
  {
    title: '违建处置',
    scene: '一户人家加盖了两层，手续没有。',
    options: [
      { text: '先认定性质，按程序下达文书并说明理由', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '程序走完，对方自己拆了。' },
      { text: '口头叫他停', performance: 1, effect: { reputation: 1 }, result: '停了两天，又接着盖。' },
      { text: '睁只眼闭只眼', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '隔壁照着样也盖起来了。' },
    ],
  },
  {
    title: '上级调研',
    scene: '上级领导要来调研，指名要看一个点。',
    options: [
      { text: '照实准备，亮点和问题都讲', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '领导当场问了问题，后面给了支持。' },
      { text: '只准备亮点', performance: 1, effect: { reputation: 1 }, result: '看完了，领导说"不错"。' },
      { text: '临时布置一个点', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '领导临时改了路线，看到了真实情况。' },
    ],
  },
  {
    title: '干部谈心',
    scene: '你手下一个年轻人最近状态很差，活总出错。',
    options: [
      { text: '单独聊一次，问清是事还是人', performance: 3, effect: { reputation: 3, network: 2 }, result: '是家里的事，调了两天休，状态回来了。' },
      { text: '在会上点一下', performance: 1, effect: { reputation: 1 }, result: '他更沉默了。' },
      { text: '把他的活分给别人', performance: -1, effect: { reputation: -2, network: -1 }, result: '他觉得被架空了。' },
    ],
  },
  {
    title: '条线台账',
    scene: '你这条线的台账有三个版本，谁也说不清哪个是准的。',
    options: [
      { text: '定一个来源，其他两个停用并说明', performance: 3, effect: { reputation: 2, seniority: 1, health: -1 }, result: '往后只有一个口径，省了很多口舌。' },
      { text: '保留三个，用时再比', performance: 1, effect: { reputation: 1 }, result: '每次汇报都要先对一遍。' },
      { text: '让下面自己定', performance: -1, effect: { reputation: -2 }, result: '越用越乱。' },
    ],
  },
  {
    title: '联合执法',
    scene: '要搞一次联合执法，涉及三个部门，时间紧。',
    options: [
      { text: '先开个碰头会定分工和边界，再统一行动', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '一次到位，没有越权也没有空档。' },
      { text: '各自行动，现场汇合', performance: 1, effect: { reputation: 1 }, result: '现场乱了一阵。' },
      { text: '抢在别人前面先动', performance: -1, effect: { reputation: -2, network: -1 }, result: '越了界，被叫停。' },
    ],
  },
  {
    title: '群众大会',
    scene: '要在村里开一场群众大会，议题有争议。',
    options: [
      { text: '会前先跟几个有威望的人通个气，会上让人说话', performance: 3, effect: { reputation: 4, network: 1 }, result: '会开到很晚，但方案定了。' },
      { text: '会上宣布方案', performance: 1, effect: { reputation: 1 }, result: '宣布完了，会后议论纷纷。' },
      { text: '不开，贴个公告', performance: -1, effect: { reputation: -2 }, result: '公告被人撕了。' },
    ],
  },
  {
    title: '财政评审',
    scene: '一个项目的预算报上来，明显偏高。',
    options: [
      { text: '请评审一项项过，砍掉没有依据的部分', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '审下来少了一大块，也没人闹。' },
      { text: '大致砍一点', performance: 1, effect: { reputation: 1 }, result: '砍了，剩下的还是偏高。' },
      { text: '照批，反正不是自己的钱', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '审计时这一项被单独点出来。' },
    ],
  },
  {
    title: '帮扶车间',
    scene: '一个帮扶车间开工半年，来干活的人越来越少。',
    options: [
      { text: '问清为什么不来，是工钱、时间还是活不合适', performance: 3, effect: { reputation: 4 }, result: '是接送孩子的时间冲突，调了班次就回来了。' },
      { text: '让村里动员人来', performance: 1, effect: { reputation: 1 }, result: '来了两天又走了。' },
      { text: '把在册人数报上去就行', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '抽查那天车间里只有三个人。' },
    ],
  },
  {
    title: '养老服务',
    scene: '几个自然村的老人吃饭成问题，食堂只覆盖了一半。',
    options: [
      { text: '按距离划片，远的设配送点', performance: 3, effect: { reputation: 4, health: -1 }, result: '最后一个村也吃上了热饭。' },
      { text: '先覆盖条件好的村', performance: 1, effect: { reputation: 1 }, result: '覆盖了一半，最远的还是没人管。' },
      { text: '发点物资代替', performance: -1, effect: { reputation: -2 }, result: '物资发了，老人不会做。' },
    ],
  },
  {
    title: '卫生整治',
    scene: '卫生评比排名靠后，突击搞过几次都没用。',
    options: [
      { text: '定长效机制，把路段责任分到人', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '三个月后名次进了中游，也没再反弹。' },
      { text: '再突击一次', performance: 1, effect: { reputation: 1, health: -1 }, result: '这次名次上去了，下月又掉。' },
      { text: '把考核标准改宽松些', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '标准改了，问题还在，被人看出来。' },
    ],
  },
  {
    title: '应急演练',
    scene: '要组织一次应急演练，往年都是走个形式。',
    options: [
      { text: '不预告，随机拉一次，事后复盘', performance: 3, effect: { reputation: 4, health: -1 }, result: '暴露了五个问题，逐一改掉。' },
      { text: '按脚本走一遍', performance: 1, effect: { reputation: 1 }, result: '走得很顺，什么也没测出来。' },
      { text: '拍几张照片交差', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '真出事时没人知道该干什么。' },
    ],
  },
  {
    title: '人大代表联络',
    scene: '一位代表提了一件比较尖锐的事，正是你分管的。',
    options: [
      { text: '当面听，能办的列时限，不能办的说清为什么', performance: 3, effect: { reputation: 3, network: 2 }, result: '代表后来在会上替你说了话。' },
      { text: '书面答复', performance: 1, effect: { reputation: 1 }, result: '答复了，代表不满意。' },
      { text: '拖着不答复', performance: -2, effect: { reputation: -3 }, result: '建议在会上被再提了一次。' },
    ],
  },
  {
    title: '村庄规划',
    scene: '要做村庄规划，村民想要的和规划规范冲突。',
    options: [
      { text: '把规范讲透，在允许的范围内尽量满足', performance: 3, effect: { reputation: 4, health: -1 }, result: '规划通过了，也没伤感情。' },
      { text: '按规范做，不做解释', performance: 1, effect: { reputation: 1 }, result: '规划批了，村民不认。' },
      { text: '按村民说的做，先报上去', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '报上去被打回三次。' },
    ],
  },
  {
    title: '用电保障',
    scene: '夏天用电高峰，一个片区老跳闸。',
    options: [
      { text: '请供电所一起查线路，定改造时序', performance: 3, effect: { reputation: 3, network: 1 }, result: '改造完了，那年夏天没再跳。' },
      { text: '报修一次', performance: 1, effect: { reputation: 1 }, result: '修了，过几天又跳。' },
      { text: '让村民少开空调', performance: -2, effect: { reputation: -3 }, result: '这句话被人发到了群里。' },
    ],
  },
  {
    title: '农产品滞销',
    scene: '一个村的果子熟了卖不出去，眼看要烂在地里。',
    options: [
      { text: '对接渠道、办采摘，同时摸清明年怎么防', performance: 3, effect: { reputation: 4, network: 2, health: -2 }, result: '卖掉大半，第二年签了订单。' },
      { text: '发动机关干部买一点', performance: 1, effect: { reputation: 1 }, result: '买了一点，杯水车薪。' },
      { text: '上报等支持', performance: -1, effect: { reputation: -2 }, result: '支持来的时候果子已经落了。' },
    ],
  },
  {
    title: '工程验收',
    scene: '一个小工程要验收，有几处做法和图纸不一样。',
    options: [
      { text: '逐项对照，不一致的要求整改后复验', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '整改完再验，这一年没出质量问题。' },
      { text: '大差不差就签', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了，半年后那几处出了问题。' },
      { text: '照签，反正有监理', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '出事后监理拿出了签字页。' },
    ],
  },
  {
    title: '条线总结',
    scene: '年底要交条线总结，成绩有几项，问题也不少。',
    options: [
      { text: '成绩写足，问题写实，明年打算写清', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '这份总结被拿去当范本。' },
      { text: '只写成绩', performance: 1, effect: { reputation: 1 }, result: '读了没人记住。' },
      { text: '把别人的成绩算进来', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '会上有人当场更正。' },
    ],
  },
  {
    title: '邻镇协作',
    scene: '一条跨界的水渠，两个镇各管一段，谁都不肯先动。',
    options: [
      { text: '主动约对方碰头，把责任段和投资比例谈清', performance: 3, effect: { reputation: 3, network: 2 }, result: '谈成了，那年的灌溉没出问题。' },
      { text: '各修各的那段', performance: 1, effect: { reputation: 1 }, result: '修了，接口处还是断的。' },
      { text: '拖，等上面来协调', performance: -1, effect: { reputation: -2 }, result: '上面协调时，两边都被说了。' },
    ],
  },
  {
    title: '纪律提醒',
    scene: '有人在你分管的环节上塞了东西，说是"一点心意"。',
    options: [
      { text: '当场退回并说明规矩，事后在条线会上讲一次', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '退了，往后这条线再没人敢提。' },
      { text: '退回去，不声张', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '退了，但对方还会再试。' },
      { text: '收下，就这一次', performance: -3, effect: { reputation: -4, integrity: -5, network: 1 }, result: '有了第一次，第二次就不好拒了。' },
    ],
  },
  {
    title: '年后开局',
    scene: '新的一年条线任务下来了，比去年还重。',
    options: [
      { text: '按轻重缓急排三档，明确哪几件必须做成', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '年底三件都成了，别的也没落下。' },
      { text: '摊下去，大家分', performance: 1, effect: { reputation: 1 }, result: '分了，年底样样都差一点。' },
      { text: '先做容易出彩的', performance: -1, effect: { reputation: -2 }, result: '出彩了，硬骨头留到了最后。' },
    ],
  },
  {
    title: '提拔谈话',
    scene: '组织上找你谈话，问你愿不愿意去更远的一个镇。',
    options: [
      { text: '问清岗位职责和组织考虑，当场表态服从', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '去了，一年后成了正科的候选人。' },
      { text: '表示想去，但想留在本地', performance: 1, effect: { reputation: 1 }, result: '留下了，也在名单上划了一下。' },
      { text: '托人打听能不能换个近的地方', performance: -2, effect: { reputation: -3 }, result: '消息传到组织那里，印象打了折。' },
    ],
  },
];

},
"game/rank-events/rank-04": function(module, exports, require) {
// 职级 4 · 乡科级正职（正科级）
//
// 权力边界：第一次当"一把手"。镇域或部门的事都要你拍板，钱怎么分、人怎么用、
// 风险怎么扛，都是你的题。题目围绕"一把手的取舍与兜底"。
// 50 道。

module.exports = [
  {
    title: '走马上任',
    scene: '到任第一周，桌上堆着三件没解决的事和一份上任留下的清单。',
    options: [
      { text: '先沉下去跑半个月，回来再定盘子', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '半个月后拿出的判断，跟实际对得上。' },
      { text: '先听班子汇报', performance: 1, effect: { reputation: 1 }, result: '听到了一套说法，还有一套没听到。' },
      { text: '上任三把火，先动一件事', performance: -1, effect: { reputation: -2 }, result: '火点了，也没烧到点子上。' },
    ],
  },
  {
    title: '班子磨合',
    scene: '班子里有两位资历比你老，话不太多。',
    options: [
      { text: '逐位上门请教，把职责边界先划清', performance: 3, effect: { reputation: 4, network: 3 }, result: '半年后这两位成了最顶事的人。' },
      { text: '按分工各管各的', performance: 1, effect: { reputation: 1 }, result: '各管各的，遇事还是没人兜。' },
      { text: '用新的人，绕开老的', performance: -2, effect: { reputation: -3, network: -2 }, result: '老的那几位开始袖手旁观。' },
    ],
  },
  {
    title: '全年盘子',
    scene: '要定全年工作盘子，想做的事远多过能做的事。',
    options: [
      { text: '砍到三件，把资源和人都压上去', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '年底三件都成了，上级也认可。' },
      { text: '列十件重点', performance: 1, effect: { reputation: 1, health: -1 }, result: '十件都启动，没一件收口。' },
      { text: '上面要什么做什么', performance: -1, effect: { reputation: -2 }, result: '考核过了，本地什么也没变。' },
    ],
  },
  {
    title: '财政盘子',
    scene: '一年的可用财力定了，刚性支出就占掉大半。',
    options: [
      { text: '重新排优先级，把能缓的缓，把该保的保住', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '紧着过了一年，没欠新账。' },
      { text: '各项都砍一点', performance: 1, effect: { reputation: 1 }, result: '砍完谁都不够用。' },
      { text: '先花，缺口以后再说', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '年底缺口压到了下一任头上。' },
    ],
  },
  {
    title: '人事调整',
    scene: '几个中层岗位空出来了，有人托关系来说情。',
    options: [
      { text: '定标准走程序，结果公示，说情的照退', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 1 }, result: '提上来的人服众，说情的人也没话说。' },
      { text: '平衡各方，各安排一个', performance: 1, effect: { reputation: 1 }, result: '平衡了，岗位和能力对不上。' },
      { text: '按关系亲疏定', performance: -3, effect: { reputation: -4, integrity: -4, network: 1 }, result: '提上来的人撑不住，事砸在你手里。' },
    ],
  },
  {
    title: '班子分工',
    scene: '一件急事，两位副职都说不该自己管。',
    options: [
      { text: '当场明确牵头人并给授权，事后补制度', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '事办了，往后这类事不用再问。' },
      { text: '自己顶上去干', performance: 1, effect: { reputation: 1, health: -2 }, result: '干完了，副职习惯了让你顶。' },
      { text: '让两人协商', performance: -1, effect: { reputation: -2 }, result: '协商了三天，事凉了。' },
    ],
  },
  {
    title: '重大项目',
    scene: '一个能改变镇域格局的项目在谈，条件里有一条你拿不准。',
    options: [
      { text: '把拿不准的那条单独请示，其余照谈', performance: 3, effect: { reputation: 3, seniority: 1, integrity: 1 }, result: '请示有了回音，项目落了地。' },
      { text: '先签下来，边走边补', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '签了，那一条后来成了麻烦。' },
      { text: '为了落地把条件放宽', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '落地了，也留下了后患。' },
    ],
  },
  {
    title: '土地指标',
    scene: '两个项目都要用地，指标只够一个。',
    options: [
      { text: '按产出和带动排序，上会集体定', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '定的那个投产了，另一个也给了说法。' },
      { text: '谁催得急给谁', performance: 1, effect: { reputation: 1 }, result: '给了，另一个项目黄了。' },
      { text: '两个各给一半', performance: -1, effect: { reputation: -2 }, result: '两个都开不了工。' },
    ],
  },
  {
    title: '债务化解',
    scene: '上任留下的一笔欠账到期了，账上没钱。',
    options: [
      { text: '分期谈判，公开还款计划并压缩开支', performance: 3, effect: { reputation: 3, integrity: 2, health: -1 }, result: '对方接受了计划，一年后清了大半。' },
      { text: '先还一部分拖着', performance: 1, effect: { reputation: 1 }, result: '拖了一年，利息又长了一截。' },
      { text: '借新的还旧的', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '窟窿没填，反而更大了。' },
    ],
  },
  {
    title: '招商引资',
    scene: '一家企业想来，开口就要特殊政策。',
    options: [
      { text: '把能给的政策讲清，不能给的说明依据', performance: 3, effect: { reputation: 3, integrity: 2, network: 2 }, result: '企业接受了常规政策，还是来了。' },
      { text: '先答应，想办法变通', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '变通过的口子，后来被人反复引用。' },
      { text: '破例给，先把项目抢到手', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '项目来了，审计时被单独拎出来。' },
    ],
  },
  {
    title: '上任审计',
    scene: '离任审计发现上任留下几笔说不清的支出。',
    options: [
      { text: '如实移送并配合，同时把制度漏洞补上', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '处理完了，你这一任再没出同类问题。' },
      { text: '内部整改，不外传', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '整改了，账还是那本账。' },
      { text: '帮忙把账抹平', performance: -3, effect: { reputation: -4, integrity: -5 }, result: '抹平的事，你自己也进去了。' },
    ],
  },
  {
    title: '信访积案',
    scene: '一件压了五年的积案，当事人每周都来。',
    options: [
      { text: '亲自接，把政策和现实的距离说清并给方案', performance: 3, effect: { reputation: 4, health: -1 }, result: '签了协议，人再没来过。' },
      { text: '安排专人盯', performance: 1, effect: { reputation: 1 }, result: '盯了，事情没进展。' },
      { text: '避而不见', performance: -2, effect: { reputation: -3 }, result: '人跑去了市里。' },
    ],
  },
  {
    title: '安全事故',
    scene: '你辖区里出了一起生产安全事故，有人受伤。',
    options: [
      { text: '第一时间到现场处置并上报，不瞒不拖', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '处置及时，问责时也说得清。' },
      { text: '先处置，视情况再报', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '报晚了，被认定迟报。' },
      { text: '压下来内部处理', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '消息走漏，责任更重。' },
    ],
  },
  {
    title: '突发公共卫生事件',
    scene: '辖区出现不明原因的聚集性病例，消息还没扩散。',
    options: [
      { text: '立即启动预案、上报并划定管控范围', performance: 3, effect: { reputation: 4, integrity: 2, health: -3 }, result: '控制住了，上级的评价是"反应快"。' },
      { text: '先核实再上报', performance: 1, effect: { reputation: 1, health: -1 }, result: '核实完报上去，已经晚了半天。' },
      { text: '先内部稳住，别引起恐慌', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '稳了两天，扩散开了。' },
    ],
  },
  {
    title: '上级考核',
    scene: '考核方案下来了，有几项指标明显不符合本地实际。',
    options: [
      { text: '照实反馈意见并拿出替代口径，同时把能做的做到位', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '意见被部分采纳，考核也没落下。' },
      { text: '照单全收，加码完成', performance: 1, effect: { reputation: 1, health: -2 }, result: '完成了，代价是全年都在应付。' },
      { text: '想办法在数据上达标', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '达标了，抽查时被发现口径有问题。' },
    ],
  },
  {
    title: '镇域规划',
    scene: '要修编镇域规划，各方对用地方向分歧很大。',
    options: [
      { text: '开几轮论证，把分歧摆到桌面上定方向', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '规划通过，五年没大改。' },
      { text: '委托设计院出方案，班子看一下', performance: 1, effect: { reputation: 1 }, result: '方案出来了，执行时处处卡。' },
      { text: '按主要领导的意思定', performance: -1, effect: { reputation: -2 }, result: '定了，落地时被反复推翻。' },
    ],
  },
  {
    title: '干部队伍',
    scene: '整个队伍年龄偏大，几个关键岗位没有后备。',
    options: [
      { text: '建梯队，给年轻人压担子也容错', performance: 3, effect: { reputation: 3, network: 3, seniority: 2 }, result: '两年后关键岗位都有人能顶。' },
      { text: '外面调几个人进来', performance: 1, effect: { reputation: 1 }, result: '调来了，本地的人更没劲了。' },
      { text: '先应付着，用老同志顶', performance: -1, effect: { reputation: -2 }, result: '老同志退了，岗位空了半年。' },
    ],
  },
  {
    title: '部门协调',
    scene: '一件涉及县直好几个部门的事，卡在某个环节三个月。',
    options: [
      { text: '带着方案逐个上门，最后请分管领导开一次协调会', performance: 3, effect: { reputation: 3, network: 3, health: -1 }, result: '会开完，事通了。' },
      { text: '发函催办', performance: 1, effect: { reputation: 1 }, result: '函发了，回函说在研究。' },
      { text: '请上级主要领导压', performance: -1, effect: { reputation: -2, network: -1 }, result: '压成了，往后没人愿意配合。' },
    ],
  },
  {
    title: '村集体收入',
    scene: '一半的村集体收入几乎为零，靠转移支付过日子。',
    options: [
      { text: '逐村盘资源，一村一策找能造血的路子', performance: 3, effect: { reputation: 4, seniority: 2, health: -2 }, result: '两年后有收入的村多了一半。' },
      { text: '选两个基础好的先做', performance: 1, effect: { reputation: 1 }, result: '两个村起来了，别的还是零。' },
      { text: '靠补助维持', performance: -1, effect: { reputation: -2 }, result: '补助一停，又回去了。' },
    ],
  },
  {
    title: '城镇管理',
    scene: '镇区秩序多年没人管，探头和人员的缺口都很大。',
    options: [
      { text: '先划重点区域，把有限的力气压在群众反映最多的地方', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '半年后镇区像样了，投诉降了大半。' },
      { text: '按上级要求配齐再管', performance: 1, effect: { reputation: 1 }, result: '等配齐，一年过去了。' },
      { text: '搞几次集中整治', performance: -1, effect: { reputation: -2 }, result: '整治完就反弹。' },
    ],
  },
  {
    title: '教育资源',
    scene: '镇上的中学教师流失严重，家长开始往外送孩子。',
    options: [
      { text: '摸清流失原因，从待遇和生活条件两头想办法', performance: 3, effect: { reputation: 4, seniority: 1, health: -1 }, result: '留住了大半，第二年回流了几个。' },
      { text: '向上要编制和资金', performance: 1, effect: { reputation: 1 }, result: '要到了一点，缺口还很大。' },
      { text: '做家长工作，别往外送', performance: -2, effect: { reputation: -3 }, result: '家长不听，反而更不信任。' },
    ],
  },
  {
    title: '医疗资源',
    scene: '镇卫生院看不了常见病，群众都往县城跑。',
    options: [
      { text: '跟县里谈对口支援，同时把设备缺口列清楚', performance: 3, effect: { reputation: 4, network: 2 }, result: '支援来了，能看的病多了十几种。' },
      { text: '要求卫生院自己提升', performance: 1, effect: { reputation: 1 }, result: '要求提了，能力没变。' },
      { text: '先放一放，财力不允许', performance: -1, effect: { reputation: -2 }, result: '群众意见更大了。' },
    ],
  },
  {
    title: '饮水安全',
    scene: '几个村的水源检测不达标，改水要动大工程。',
    options: [
      { text: '先上临时供水保障，同时把改水工程立项', performance: 3, effect: { reputation: 4, integrity: 1, health: -2 }, result: '临时措施顶上了，工程也批下来了。' },
      { text: '立项等资金', performance: 1, effect: { reputation: 1 }, result: '等了一年，水还是那样。' },
      { text: '检测结果不外传，先稳住', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '有人自己送检，事情闹大了。' },
    ],
  },
  {
    title: '乡村建设',
    scene: '一笔乡村建设资金到了，是撒胡椒面还是集中做？',
    options: [
      { text: '集中做两个村，做出样子再推', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '两个村成了样板，第二年资金更好争取。' },
      { text: '各村平均分', performance: 1, effect: { reputation: 1 }, result: '分了，哪个村都没变样。' },
      { text: '做在路边容易看见的村', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '路过的领导看见了，群众没受益。' },
    ],
  },
  {
    title: '人居环境',
    scene: '垃圾处理跟不上，几个村开始就地焚烧。',
    options: [
      { text: '重排收运线路，增配点位并定监督办法', performance: 3, effect: { reputation: 3, health: -1 }, result: '半年后基本没有露天焚烧。' },
      { text: '发通知禁止焚烧', performance: 1, effect: { reputation: 1 }, result: '通知发了，夜里照烧。' },
      { text: '罚款了事', performance: -2, effect: { reputation: -3 }, result: '罚了，矛盾也激化了。' },
    ],
  },
  {
    title: '产业升级',
    scene: '镇上的主导产业已经十年没变，利润越来越薄。',
    options: [
      { text: '请人做诊断，先扶持一两家转型做样子', performance: 3, effect: { reputation: 3, network: 2, seniority: 2 }, result: '两家转成功了，跟着转的越来越多。' },
      { text: '号召企业自己创新', performance: 1, effect: { reputation: 1 }, result: '号召了，没人动。' },
      { text: '维持现状，别出事就行', performance: -1, effect: { reputation: -2 }, result: '两年后产业垮了大半。' },
    ],
  },
  {
    title: '电商进村',
    scene: '要推农产品上网，村里没人懂，物流也是问题。',
    options: [
      { text: '先解决物流和品控，再培训一批年轻人', performance: 3, effect: { reputation: 3, network: 2 }, result: '第一年做出一个爆款，第二年带动了几十户。' },
      { text: '先开几个网店', performance: 1, effect: { reputation: 1 }, result: '店开了，没什么单。' },
      { text: '请代运营，花钱买数据', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '数据好看，农户一分没多赚。' },
    ],
  },
  {
    title: '文旅开发',
    scene: '有人看中了本地的老建筑想开发，村民意见不一。',
    options: [
      { text: '先确权和评估，再谈开发方式和收益分配', performance: 3, effect: { reputation: 3, seniority: 1, integrity: 1 }, result: '谈成了，村民年年有分红。' },
      { text: '先签框架协议', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了，确权问题一年都没解决。' },
      { text: '低价整体交给投资人', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '村民闹了三年，项目停摆。' },
    ],
  },
  {
    title: '园区建设',
    scene: '要建一个产业园，起步阶段招商很难。',
    options: [
      { text: '先把配套做起来，宁可慢一点也要引对的企业', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '第二年引来两家链主，园区活了。' },
      { text: '给优惠先把企业填进去', performance: 1, effect: { reputation: 1 }, result: '填满了，产出很低。' },
      { text: '先把厂房建起来', performance: -1, effect: { reputation: -2 }, result: '厂房空了两年。' },
    ],
  },
  {
    title: '企业纾困',
    scene: '一家用工大户资金链断了，几百人要失业。',
    options: [
      { text: '摸清是暂时困难还是根本问题，分别想办法', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '暂时困难的那家救回来了。' },
      { text: '协调贷款续上', performance: 1, effect: { reputation: 1, network: 1 }, result: '续上了，半年后又断。' },
      { text: '不管，让市场决定', performance: -2, effect: { reputation: -3 }, result: '人失业了，镇上一下子多了很多事。' },
    ],
  },
  {
    title: '营商环境',
    scene: '有企业反映办一件事要跑很多趟，还经常找不到人。',
    options: [
      { text: '自己带着材料走一遍流程，把卡点全部改掉', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '跑动次数少了一大半，企业口碑变了。' },
      { text: '要求窗口改进作风', performance: 1, effect: { reputation: 1 }, result: '作风改了，流程还是那样。' },
      { text: '给这家企业开绿色通道', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '这家方便了，别家更不满。' },
    ],
  },
  {
    title: '税费征管',
    scene: '完成任务和涵养税源有点冲突，年底压力很大。',
    options: [
      { text: '依法征管，同时把服务做上去涵养税源', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '当年任务完成，第二年税源还涨了。' },
      { text: '先完成当年任务', performance: 1, effect: { reputation: 1 }, result: '完成了，几家小企业关了门。' },
      { text: '想办法调剂一下', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '调剂的事，审计时躲不过。' },
    ],
  },
  {
    title: '工程项目',
    scene: '一个工程要发包，有人提前来找你打招呼。',
    options: [
      { text: '全程按程序走，打招呼的一律登记备案', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '工程顺利，往后打招呼的人少了。' },
      { text: '不表态，交给分管副职', performance: 1, effect: { reputation: 1 }, result: '副职被缠得没办法。' },
      { text: '照顾一下熟人', performance: -3, effect: { reputation: -4, integrity: -5, network: 1 }, result: '熟人做的工程质量不过关，你说不得。' },
    ],
  },
  {
    title: '招投标',
    scene: '一次开标，有人质疑程序有问题。',
    options: [
      { text: '暂停，请监督部门介入查清再定', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '查清后重新开，没人再说闲话。' },
      { text: '让招标方解释', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '解释了，质疑还在。' },
      { text: '照常定标', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '质疑上去了，被要求复核。' },
    ],
  },
  {
    title: '工程欠款',
    scene: '几个工程队来要钱，账上确实没有。',
    options: [
      { text: '当面说清情况，给出还款计划并签字', performance: 3, effect: { reputation: 3, integrity: 1, health: -1 }, result: '工程队接受了计划，没有闹。' },
      { text: '让财务去谈', performance: 1, effect: { reputation: 1 }, result: '谈了，工程队还是堵门。' },
      { text: '躲着不见', performance: -2, effect: { reputation: -3 }, result: '人堵到了县里。' },
    ],
  },
  {
    title: '生态治理',
    scene: '一家老企业排污不达标，关停会影响几百人就业。',
    options: [
      { text: '给整改期限和技术支持，同步安排就业出路', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '半年后达标了，人也留下了。' },
      { text: '限期整改，不改就关', performance: 1, effect: { reputation: 1 }, result: '整改走过场，一年后还是关了。' },
      { text: '睁只眼闭只眼，先保就业', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被督察发现，企业和人都没了。' },
    ],
  },
  {
    title: '河湖治理',
    scene: '一条河的治理涉及上下游三个乡镇。',
    options: [
      { text: '牵头建联防机制，把责任段和考核统一', performance: 3, effect: { reputation: 3, network: 3, seniority: 1 }, result: '一年后水质明显改善。' },
      { text: '管好自己这一段', performance: 1, effect: { reputation: 1 }, result: '自己这段清了，上游还在排。' },
      { text: '等上级统一部署', performance: -1, effect: { reputation: -2 }, result: '等了一年，问题还在。' },
    ],
  },
  {
    title: '森林防火',
    scene: '进入防火期，护林员人手不够，装备也旧。',
    options: [
      { text: '重新布点，把重点区域盯死并做一次演练', performance: 3, effect: { reputation: 3, health: -2 }, result: '那一季没有火情。' },
      { text: '发通知，加强巡查', performance: 1, effect: { reputation: 1 }, result: '巡查了，还是着了一次小火。' },
      { text: '按去年办', performance: -2, effect: { reputation: -3 }, result: '着了一场大火的边缘。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '有些耕地被撂荒，还有些被挪作他用。',
    options: [
      { text: '逐块摸底，能复耕的复耕，该整改的整改', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '复耕了一大片，也没出群体性事件。' },
      { text: '发通知要求复耕', performance: 1, effect: { reputation: 1 }, result: '通知发了，地还是荒着。' },
      { text: '报个复耕数字交差', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '卫星图斑一比就露了。' },
    ],
  },
  {
    title: '耕地保护',
    scene: '一个项目想占一块基本农田，投资方很有背景。',
    options: [
      { text: '明确不能占，另外帮着找合规地块', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '项目挪了地方，也没得罪人。' },
      { text: '往上请示', performance: 1, effect: { reputation: 1 }, result: '请示了，等了两个月。' },
      { text: '变通一下先占', performance: -3, effect: { reputation: -4, integrity: -5 }, result: '图斑被发现，问责到了你。' },
    ],
  },
  {
    title: '统计工作',
    scene: '几个统计指标不好看，有人建议在口径上想想办法。',
    options: [
      { text: '照实报，把下滑原因和举措一并说明', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '上级反而认可了这份说明。' },
      { text: '按去年的数微调', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '微调了，后面越来越难圆。' },
      { text: '授意改数', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '统计核查时，第一责任人是你。' },
    ],
  },
  {
    title: '舆情应对',
    scene: '一件事在网上传开，说法和事实有出入，外面已经有人在等回应。',
    options: [
      { text: '核清事实后主动说，认错的认错，整改的给时限', performance: 3, effect: { reputation: 4, health: -1 }, result: '回应之后风向转了。' },
      { text: '等上级统一口径', performance: 1, effect: { reputation: 1 }, result: '等到口径时，话题已经换了三轮。' },
      { text: '找人把帖子压下去', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '压了这边，那边又冒出来。' },
    ],
  },
  {
    title: '突发事件',
    scene: '深夜接到报告，辖区一处出现险情，情况不明。',
    options: [
      { text: '立即到现场，边处置边上报', performance: 3, effect: { reputation: 4, health: -3, integrity: 1 }, result: '处置得当，事后被作为正面案例。' },
      { text: '电话指挥，等天亮再去看', performance: 1, effect: { reputation: 1 }, result: '天亮去了，损失已经扩大。' },
      { text: '让下面先处理，有情况再报', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '情况失控，问责名单上有你。' },
    ],
  },
  {
    title: '老干部',
    scene: '几位退休老同志对一项新政策意见很大，联名写了信。',
    options: [
      { text: '上门听，能解释的解释，能解决的解决', performance: 3, effect: { reputation: 3, network: 2 }, result: '信撤了，这几位后来还帮着做别人的工作。' },
      { text: '书面答复', performance: 1, effect: { reputation: 1 }, result: '答复了，意见还在。' },
      { text: '不理会', performance: -2, effect: { reputation: -3, network: -1 }, result: '信寄到了上面。' },
    ],
  },
  {
    title: '换届选举',
    scene: '换届在即，有个岗位竞争激烈，有人活动得很厉害。',
    options: [
      { text: '把规矩讲在前面，全程留痕，违纪的一律查', performance: 3, effect: { reputation: 4, integrity: 3 }, result: '换届风清气正，也被上级表扬。' },
      { text: '平衡安排', performance: 1, effect: { reputation: 1 }, result: '平衡了，落选的人不服。' },
      { text: '睁只眼闭只眼', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '换届后被举报，结果被推翻。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你分管的线上有人出了问题，牵扯到你的一个老部下。',
    options: [
      { text: '照规定回避并配合，同时对线上制度做一次排查', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '处理干净了，往后这条线更规范。' },
      { text: '配合调查，不多说', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '配合了，也没撇清。' },
      { text: '想办法保他', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '保不住，还把自己搭进去。' },
    ],
  },
  {
    title: '家属安排',
    scene: '有合作方提出帮你解决一个家里人的工作问题。',
    options: [
      { text: '明确拒绝并记下来，往后跟这家保持距离', performance: 3, effect: { reputation: 2, integrity: 4 }, result: '拒绝了，这家反而更守规矩。' },
      { text: '婉拒，不记录', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '婉拒了，对方还会再来。' },
      { text: '答应，反正不违规', performance: -3, effect: { reputation: -4, integrity: -5, network: 1 }, result: '这份人情，迟早要还。' },
    ],
  },
  {
    title: '上级检查',
    scene: '一次不打招呼的检查，正好查到你最薄弱的一块。',
    options: [
      { text: '照实说明困难和打算，请求指导', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '检查组给了具体建议，还带了资源。' },
      { text: '尽量解释', performance: 1, effect: { reputation: 1 }, result: '解释了，问题还是被记下来。' },
      { text: '临时补材料挡一下', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '补的材料对不上时间，更难看。' },
    ],
  },
  {
    title: '先进评选',
    scene: '你们单位有资格报一个省级先进，材料你已经看过了。',
    options: [
      { text: '核一遍再报，有一项不实的坚决拿掉', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '报上去评上了，也经得起后来查。' },
      { text: '照材料报', performance: 1, effect: { reputation: 1 }, result: '报了，被公示期举报。' },
      { text: '包装一下再报', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '评上了又被摘牌。' },
    ],
  },
  {
    title: '离任交接',
    scene: '你要调走了，交接清单上有几件事是你任内埋下的。',
    options: [
      { text: '逐项写清来龙去脉和风险点，当面交给接任者', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 1 }, result: '接任的人年年还来找你请教，口碑留在了这里。' },
      { text: '按常规交接', performance: 1, effect: { reputation: 1 }, result: '交接完了，几件事后来爆了雷。' },
      { text: '挑好看的写', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '接任者吃了亏，也把话说出去了。' },
    ],
  },
];

},
"game/rank-events/rank-05": function(module, exports, require) {
// 职级 5 · 县处级副职（副处级）
//
// 权力边界：分管若干个部门，对一条战线负总责。人、钱、项目都有建议权，
// 但要上常委会定。题目围绕"协调部门、扛住条线、在多方之间找平衡"。
// 50 道。

module.exports = [
  {
    title: '分管分工',
    scene: '常委会定了分工，你分到一条跨七八个部门、历史问题最多的线。',
    options: [
      { text: '先逐个部门走访摸底，画一张问题地图', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两个月后你比很多部门一把手更清楚底数。' },
      { text: '先开一次分管部门会议', performance: 1, effect: { reputation: 1 }, result: '会开了，各部门各说各话。' },
      { text: '先抓最容易出成绩的一块', performance: -1, effect: { reputation: -2 }, result: '成绩有了，别的部门更不服。' },
    ],
  },
  {
    title: '首次议题',
    scene: '你第一次上常委会汇报议题，材料是部门准备的。',
    options: [
      { text: '自己把关键数据核一遍，能答的都答上来', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '会上被追问时都对答如流。' },
      { text: '照着材料念', performance: 1, effect: { reputation: 1 }, result: '念完了，被问住两次。' },
      { text: '让部门负责人陪着答', performance: -1, effect: { reputation: -2 }, result: '别人觉得你没吃透。' },
    ],
  },
  {
    title: '部门一把手',
    scene: '一个部门的一把手资历很老，对你的部署阳奉阴违。',
    options: [
      { text: '单独谈，把分歧摆开，能用则用，不能用则调整', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '谈开了，这位后来成了最得力的。' },
      { text: '绕开他，直接找副职', performance: 1, effect: { reputation: 1 }, result: '事办了，正职更不配合。' },
      { text: '当众批评', performance: -2, effect: { reputation: -3, network: -2 }, result: '结了梁子，往后事事卡你。' },
    ],
  },
  {
    title: '条线考核',
    scene: '你这条线在市里排名倒数，几个部门互相推。',
    options: [
      { text: '把指标拆到部门，签订责任书并按月调度', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '一年后名次进了中游。' },
      { text: '开会强调', performance: 1, effect: { reputation: 1 }, result: '强调了，排名还是那样。' },
      { text: '把责任推给一个部门', performance: -2, effect: { reputation: -3, network: -2 }, result: '那家部门从此撂挑子。' },
    ],
  },
  {
    title: '专项债项目',
    scene: '一批专项债项目要报，前期成熟度参差不齐。',
    options: [
      { text: '成熟度不够的坚决不报，报上去的全程盯', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '报上去的全都开工了，第二年额度更大。' },
      { text: '都报上去，先争额度', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '额度来了，一半开不了工。' },
      { text: '包装几个凑数', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '资金闲置被通报。' },
    ],
  },
  {
    title: '民生实事',
    scene: '要遴选年度民生实事，票选出来的几项都不好办。',
    options: [
      { text: '按票选结果定，把难处和时序一并公开', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '群众看到进度，难办也有人理解。' },
      { text: '挑容易办的办', performance: 1, effect: { reputation: 1 }, result: '办完了，票选的那几项没人提。' },
      { text: '改成自己想做的', performance: -2, effect: { reputation: -3 }, result: '群众发现票选的事没影。' },
    ],
  },
  {
    title: '安全生产条线',
    scene: '你分管的线上一年内出了两起事故，都是小事故。',
    options: [
      { text: '逐起复盘，把共性问题做成制度', performance: 3, effect: { reputation: 3, integrity: 1, seniority: 1 }, result: '往后两年这条线零事故。' },
      { text: '每次都严肃处理', performance: 1, effect: { reputation: 1 }, result: '处理了，事故还在出。' },
      { text: '要求下面别再报上来', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '第三起出了人命，瞒报一起查。' },
    ],
  },
  {
    title: '信访联席',
    scene: '一个跨部门的信访积案，牵扯三个单位、两届班子。',
    options: [
      { text: '牵头联席，把政策口径统一后一次性答复', performance: 3, effect: { reputation: 4, health: -2 }, result: '答复后签了息访协议。' },
      { text: '指定牵头部门', performance: 1, effect: { reputation: 1 }, result: '牵头单位推不动别的部门。' },
      { text: '批给信访局办', performance: -1, effect: { reputation: -2 }, result: '信访局没权推部门，案子压着。' },
    ],
  },
  {
    title: '舆情处置',
    scene: '一件事上了热搜，涉及你分管的两个部门。',
    options: [
      { text: '第一时间核清事实，统一发声并同步整改', performance: 3, effect: { reputation: 4, health: -2 }, result: '两天内平息，还被评为处置得当。' },
      { text: '让宣传部门统一口径', performance: 1, effect: { reputation: 1 }, result: '口径出了，事实还没查清。' },
      { text: '先删帖', performance: -3, effect: { reputation: -4, integrity: -3 }, result: '删了反而引来二次传播。' },
    ],
  },
  {
    title: '招商签约',
    scene: '一场签约活动马上要办，有几个项目其实还没谈实。',
    options: [
      { text: '只签落得了地的，没谈实的改成果对接', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '签的三个全部开工，第二年对方又来了。' },
      { text: '照原计划签', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了五个，落地一个。' },
      { text: '多签几个撑场面', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '签约额被上级拿出来比对，很难看。' },
    ],
  },
  {
    title: '园区升级',
    scene: '园区要提档升级，但土地、能耗、环保都有硬约束。',
    options: [
      { text: '先做存量盘活，把低效用地腾出来', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '腾出的地引来两家好企业。' },
      { text: '向上争取新增指标', performance: 1, effect: { reputation: 1 }, result: '指标批了一点，不够用。' },
      { text: '先把项目塞进去再补手续', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '手续补不上，企业被责令停产。' },
    ],
  },
  {
    title: '营商环境',
    scene: '测评结果出来了，你们排在后面，企业反映最集中的是办事慢。',
    options: [
      { text: '带队暗访，把每个卡点改掉并对社会公布', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '第二年测评前进了十几位。' },
      { text: '要求各部门自查自纠', performance: 1, effect: { reputation: 1 }, result: '自查报告都写"已整改"。' },
      { text: '把测评指标研究透了再应对', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '分数上去了，企业还是跑。' },
    ],
  },
  {
    title: '教育改革',
    scene: '要推一项教育改革，家长和老师都强烈反弹。',
    options: [
      { text: '开听证，把方案调整后再推，并设过渡期', performance: 3, effect: { reputation: 4, health: -2 }, result: '调整后的方案推行顺利。' },
      { text: '按原方案推', performance: 1, effect: { reputation: 1 }, result: '推了，投诉不断。' },
      { text: '暂缓，等别的地方先试', performance: -1, effect: { reputation: -2 }, result: '等了一年，机会没了。' },
    ],
  },
  {
    title: '医共体建设',
    scene: '要建紧密型医共体，几家医院各怀心思。',
    options: [
      { text: '先把利益分配和人事权谈清，再签协议', performance: 3, effect: { reputation: 3, network: 2, seniority: 2 }, result: '医共体真转起来了，基层就诊率上去了。' },
      { text: '先挂牌', performance: 1, effect: { reputation: 1 }, result: '牌挂了，各干各的。' },
      { text: '行政命令强行合并', performance: -2, effect: { reputation: -3, network: -2 }, result: '合了，骨干医生走了几个。' },
    ],
  },
  {
    title: '交通攻坚',
    scene: '一条断头路打通要拆几十户，资金也只够一半。',
    options: [
      { text: '分期实施，先打通关键一段并同步安置', performance: 3, effect: { reputation: 3, seniority: 1, health: -2 }, result: '第一段打通后，第二段的阻力小了很多。' },
      { text: '等资金齐了再动', performance: 1, effect: { reputation: 1 }, result: '等了两年，路还是断的。' },
      { text: '先拆，安置以后说', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '拆迁户堵路，项目停摆。' },
    ],
  },
  {
    title: '水利设施',
    scene: '几座小型水库年久失修，汛期前必须处理。',
    options: [
      { text: '逐库鉴定，能除险的除险，该降等的分流', performance: 3, effect: { reputation: 3, integrity: 1, health: -2 }, result: '那一年汛期平稳度过了。' },
      { text: '全部申报除险加固', performance: 1, effect: { reputation: 1 }, result: '批下来的只有一半。' },
      { text: '加固一下看得见的地方', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '汛期出险，责任追到你头上。' },
    ],
  },
  {
    title: '城市更新',
    scene: '一片老城区要改造，居民意见分成两派。',
    options: [
      { text: '逐栋征询，把方案做成可选项让居民选', performance: 3, effect: { reputation: 4, health: -2 }, result: '签约率超过了预期。' },
      { text: '统一按一个方案推', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '推了一半卡住了。' },
      { text: '先拆再说', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '强拆引发舆情，项目被叫停。' },
    ],
  },
  {
    title: '房地产风险',
    scene: '一个项目资金链断了，购房人开始聚集。',
    options: [
      { text: '成立专班，摸清资金缺口并引入纾困方案', performance: 3, effect: { reputation: 4, health: -2, seniority: 1 }, result: '项目复工，交付有了时间表。' },
      { text: '约谈开发商，要求限期解决', performance: 1, effect: { reputation: 1 }, result: '约谈了，开发商没钱。' },
      { text: '先稳住人，等上面政策', performance: -2, effect: { reputation: -3 }, result: '人越聚越多，事情往上捅。' },
    ],
  },
  {
    title: '保交楼',
    scene: '几个楼盘要保交付，监管账户里的钱不够。',
    options: [
      { text: '逐盘核定缺口，分类施策并公开进度', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '当年交付了两个盘，购房人情绪稳了。' },
      { text: '分批推进，先交最容易的', performance: 1, effect: { reputation: 1 }, result: '容易的交了，难的还在闹。' },
      { text: '挪用别处的资金先垫', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '挪用的钱被查出，问题更大。' },
    ],
  },
  {
    title: '农民工工资',
    scene: '年底了，几个项目的工资还没着落。',
    options: [
      { text: '提前排查，设专户和台账，出问题的当天介入', performance: 3, effect: { reputation: 4, health: -1 }, result: '那年没有发生群体性讨薪。' },
      { text: '等讨薪了再处理', performance: 1, effect: { reputation: 1 }, result: '处理了几起，很被动。' },
      { text: '让企业自己解决', performance: -2, effect: { reputation: -3 }, result: '人堵了政府大门。' },
    ],
  },
  {
    title: '社区治理',
    scene: '社区工作人员少、事项多，一年换了好几个人。',
    options: [
      { text: '厘清社区职责清单，把不该社区扛的收回去', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '减负后人留住了，服务也上来了。' },
      { text: '增加人手', performance: 1, effect: { reputation: 1 }, result: '加了两三个，还是不够。' },
      { text: '要求社区克服困难', performance: -2, effect: { reputation: -3 }, result: '又走了两个人。' },
    ],
  },
  {
    title: '双拥工作',
    scene: '要创建双拥模范城，标准细、时间紧。',
    options: [
      { text: '把任务分到部门并解决几个实际问题', performance: 3, effect: { reputation: 3, network: 2 }, result: '创建成功，也真解决了几件难事。' },
      { text: '按指标准备材料', performance: 1, effect: { reputation: 1 }, result: '材料齐了，测评一般。' },
      { text: '集中突击补材料', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '补的材料经不起实地看。' },
    ],
  },
  {
    title: '统计督查',
    scene: '统计督查组要来，有人提醒你几个指标要"注意"。',
    options: [
      { text: '如实准备，把口径和依据都摆出来', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '督查组没提出问题。' },
      { text: '让统计部门把关', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '把关了，有两个指标还是被问。' },
      { text: '安排口径', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '督查发现数据异常，立案调查。' },
    ],
  },
  {
    title: '审计整改',
    scene: '审计报告指出十几个问题，有几个是你任内定的。',
    options: [
      { text: '逐条建台账，能改的立即改，改不了的说明原因', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '整改销号率最高，被通报表扬。' },
      { text: '要求部门各自整改', performance: 1, effect: { reputation: 1 }, result: '报上来的整改多半是纸面的。' },
      { text: '能拖就拖', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '回头看时被点名。' },
    ],
  },
  {
    title: '巡视反馈',
    scene: '巡视反馈意见下来了，有几条直接点到你分管领域。',
    options: [
      { text: '认账领账，自己牵头最难的那条', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '最难那条啃下来了，评价很好。' },
      { text: '照单分解给部门', performance: 1, effect: { reputation: 1 }, result: '分解了，进度很慢。' },
      { text: '对点到的几条作解释', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被认为整改态度不端正。' },
    ],
  },
  {
    title: '整改台账',
    scene: '整改台账报上去了，实际上有三项只是纸面整改。',
    options: [
      { text: '把三项撤下来重做，如实报进度', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '重做后通过了验收。' },
      { text: '维持现状', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '验收时被抽查出来。' },
      { text: '补几份佐证材料', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '佐证经不起实地核验。' },
    ],
  },
  {
    title: '干部考察',
    scene: '一批干部要考察，其中一个人争议很大。',
    options: [
      { text: '扩大谈话范围，把争议点查清写进材料', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '材料扎实，后来的使用也没出问题。' },
      { text: '按程序走一遍', performance: 1, effect: { reputation: 1 }, result: '走了，争议没写进去。' },
      { text: '按主要领导的倾向写', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '提上去的人出事，材料被翻出来。' },
    ],
  },
  {
    title: '人才引进',
    scene: '要引进一批紧缺人才，编制和待遇都有压力。',
    options: [
      { text: '先摸清到底缺什么，再定精准的引才清单', performance: 3, effect: { reputation: 3, network: 2, seniority: 2 }, result: '引来的人正好用得上，也留得住。' },
      { text: '按上级指标招', performance: 1, effect: { reputation: 1 }, result: '招来了，一半用不上。' },
      { text: '先给待遇把人招来', performance: -1, effect: { reputation: -2 }, result: '人来了没有舞台，两年走了大半。' },
    ],
  },
  {
    title: '编制管理',
    scene: '几个部门都要编，编制池早就没有余量。',
    options: [
      { text: '盘活存量，把闲置编制收回来统筹', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '收回一批，重点岗位都补上了。' },
      { text: '谁要得急给谁', performance: 1, effect: { reputation: 1 }, result: '给了，别的部门闹。' },
      { text: '先借用，编制以后说', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '借用越借越多，清理时很难办。' },
    ],
  },
  {
    title: '基层减负',
    scene: '乡镇反映报表多、会议多、督查多，减不下来。',
    options: [
      { text: '先砍自己分管线的报表和会议', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '带头砍了三成，别的线也跟着动。' },
      { text: '发文件要求减', performance: 1, effect: { reputation: 1 }, result: '文件发了，报表更多了一份。' },
      { text: '先统计一下有多少', performance: -1, effect: { reputation: -2 }, result: '统计本身又成了一项负担。' },
    ],
  },
  {
    title: '会议改革',
    scene: '一周要开七八个会，很多是陪会。',
    options: [
      { text: '合并同类项，能开短的绝不开长，陪会一律取消', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '会议少了四成，干部拍手。' },
      { text: '控制会议时长', performance: 1, effect: { reputation: 1 }, result: '短了，但会还是那么多。' },
      { text: '照旧', performance: -1, effect: { reputation: -2 }, result: '下面开始找人代会。' },
    ],
  },
  {
    title: '督查检查',
    scene: '上级一次督查要准备十几种材料，基层叫苦。',
    options: [
      { text: '向上反映重复督查问题，内部先合并成一次', performance: 3, effect: { reputation: 3, integrity: 1, seniority: 1 }, result: '上面采纳了建议，督查精简了。' },
      { text: '要求基层照常准备', performance: 1, effect: { reputation: 1 }, result: '准备了，怨气很大。' },
      { text: '派人下去代做准备', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '督查组问细节时答不上来。' },
    ],
  },
  {
    title: '文件把关',
    scene: '一份要下发的文件，里面有两条要求基层根本做不到。',
    options: [
      { text: '把这两条拿掉，加上配套保障措施', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '文件执行率明显提高。' },
      { text: '照发', performance: 1, effect: { reputation: 1 }, result: '发了，基层应付。' },
      { text: '加一句"确保"强化要求', performance: -1, effect: { reputation: -2 }, result: '确保之后还是做不到。' },
    ],
  },
  {
    title: '政策落地',
    scene: '一项好政策下来半年，符合条件的没几个享受到。',
    options: [
      { text: '查卡在哪一环，改成主动推送、免申即享', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '覆盖面一下子上去了。' },
      { text: '加大宣传', performance: 1, effect: { reputation: 1 }, result: '宣传了，来办的人还是不多。' },
      { text: '指标分解下去', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '为了完成指标开始凑数。' },
    ],
  },
  {
    title: '部门推诿',
    scene: '一件事两个部门都说是对方的，已经卡了一个月。',
    options: [
      { text: '查职责依据当场拍板，并把边界写进备忘录', performance: 3, effect: { reputation: 3, network: 1, seniority: 1 }, result: '事办了，往后同类事有章可循。' },
      { text: '各打五十大板', performance: 1, effect: { reputation: 1 }, result: '两边都不服。' },
      { text: '上报等主要领导定', performance: -1, effect: { reputation: -2 }, result: '被说成是协调能力不行。' },
    ],
  },
  {
    title: '突发事件现场',
    scene: '你分管的领域出了事，你在外地出差。',
    options: [
      { text: '立即往回赶，途中远程部署并指定现场负责人', performance: 3, effect: { reputation: 4, health: -2 }, result: '到现场时处置已经有序展开。' },
      { text: '远程指挥', performance: 1, effect: { reputation: 1 }, result: '指挥了，现场有点乱。' },
      { text: '按日程走完再回', performance: -3, effect: { reputation: -5, integrity: -2 }, result: '缺席被写进了通报。' },
    ],
  },
  {
    title: '防汛抗旱',
    scene: '一边是汛情，一边是几个乡镇喊旱，两头都要应付。',
    options: [
      { text: '分片调度，按实时情况动态调整', performance: 3, effect: { reputation: 3, health: -2, seniority: 1 }, result: '两头都没出大问题。' },
      { text: '按预案执行', performance: 1, effect: { reputation: 1 }, result: '预案跟不上变化。' },
      { text: '先保重点区域', performance: -1, effect: { reputation: -2 }, result: '非重点区域的意见很大。' },
    ],
  },
  {
    title: '森林防火',
    scene: '防火期刚到，就有人野外用火引发火情。',
    options: [
      { text: '一线蹲守，把责任落实到山头地块', performance: 3, effect: { reputation: 3, health: -2 }, result: '那一季火情明显下降。' },
      { text: '通报批评并追责', performance: 1, effect: { reputation: 1 }, result: '追责了，第二个火点又起。' },
      { text: '要求加强宣传', performance: -1, effect: { reputation: -2 }, result: '宣传做了，火照着。' },
    ],
  },
  {
    title: '食品药品',
    scene: '抽检发现一批不合格产品，涉及本地好几家商户。',
    options: [
      { text: '全部下架溯源，公开结果并做一次专项整治', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '整治后合格率明显上升。' },
      { text: '处罚涉事商户', performance: 1, effect: { reputation: 1 }, result: '罚了，源头还在。' },
      { text: '先不公开，避免影响', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '消息走漏，信任危机。' },
    ],
  },
  {
    title: '特种设备',
    scene: '排查发现一批设备超期未检，集中在几家单位。',
    options: [
      { text: '立即停用整改，检验合格才能恢复', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '整改期间零事故。' },
      { text: '限期整改', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '限期内只改了一部分。' },
      { text: '先运行，边用边检', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '出了事故，责任在你。' },
    ],
  },
  {
    title: '校园餐',
    scene: '有家长反映学校餐食质量差，还发了照片。',
    options: [
      { text: '不打招呼去查，把供应链和账目一起查清', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '查实后换了供应商，家长群安静了。' },
      { text: '要求学校整改', performance: 1, effect: { reputation: 1 }, result: '整改了表面，账目没动。' },
      { text: '说是个案', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '更多家长站出来说话。' },
    ],
  },
  {
    title: '养老体系',
    scene: '老龄化程度高，机构养老一床难求，居家养老没人管。',
    options: [
      { text: '以居家为主建三级网络，机构只兜底最需要的', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '覆盖率上去，成本也可控。' },
      { text: '多建机构', performance: 1, effect: { reputation: 1 }, result: '建了，床位空着一半。' },
      { text: '发补贴', performance: -1, effect: { reputation: -2 }, result: '补贴发了，服务还是没有。' },
    ],
  },
  {
    title: '儿童关爱',
    scene: '排查出一批留守儿童监护缺失，没人专门管。',
    options: [
      { text: '建台账并落实一对一帮扶，定期上门', performance: 3, effect: { reputation: 4, health: -1 }, result: '一年后再排查，情况明显改善。' },
      { text: '建台账', performance: 1, effect: { reputation: 1 }, result: '台账有了，没人跟进。' },
      { text: '交给村里', performance: -1, effect: { reputation: -2 }, result: '村里没人手，还是那样。' },
    ],
  },
  {
    title: '残疾人服务',
    scene: '残疾人证办了，但配套服务跟不上。',
    options: [
      { text: '把服务清单做出来，一项项落实到承办单位', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '清单落地，投诉少了很多。' },
      { text: '增加补贴', performance: 1, effect: { reputation: 1 }, result: '补贴加了，服务还是没有。' },
      { text: '先放一放', performance: -2, effect: { reputation: -3 }, result: '有人写信反映到上面。' },
    ],
  },
  {
    title: '文化阵地',
    scene: '建好的文化设施使用率很低，都锁着门。',
    options: [
      { text: '问清群众要什么，调整开放时间并配活动', performance: 3, effect: { reputation: 3, network: 1 }, result: '半年后这里成了最热闹的地方。' },
      { text: '要求提高使用率', performance: 1, effect: { reputation: 1 }, result: '数字上去了，人没多。' },
      { text: '再建新的', performance: -1, effect: { reputation: -2 }, result: '新的也锁着门。' },
    ],
  },
  {
    title: '体育设施',
    scene: '一批健身器材装了两年，坏的坏、丢的丢。',
    options: [
      { text: '定管护责任到村到人，建报修渠道', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '完好率上去了，投诉没了。' },
      { text: '统一更换一批', performance: 1, effect: { reputation: 1 }, result: '换了，两年后还是那样。' },
      { text: '不管', performance: -1, effect: { reputation: -2 }, result: '有人受伤后找上门。' },
    ],
  },
  {
    title: '文明创建',
    scene: '创建迎检在即，平时欠账多，突击又容易出事。',
    options: [
      { text: '把创建变成日常机制，先解决几个真问题', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '迎检过了，群众也看到了变化。' },
      { text: '突击整治', performance: 1, effect: { reputation: 1, health: -1 }, result: '过了，检查一走又回去。' },
      { text: '材料做漂亮', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '实地测评直接露馅。' },
    ],
  },
  {
    title: '网络问政',
    scene: '网络问政平台上积压了一批件，有几件点了你们单位。',
    options: [
      { text: '逐件回复并公开办理结果，把共性问题改掉', performance: 3, effect: { reputation: 4, health: -1 }, result: '回复率上去后，新件反而少了。' },
      { text: '要求各单位限期回复', performance: 1, effect: { reputation: 1 }, result: '回复了，很多是套话。' },
      { text: '挑着回', performance: -2, effect: { reputation: -3 }, result: '没回的被人截图传播。' },
    ],
  },
  {
    title: '项目评审',
    scene: '一次项目评审，专家意见分歧很大。',
    options: [
      { text: '让分歧充分表达，按规则和多数意见定并记入档案', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '评审结果经得起复查。' },
      { text: '采纳资历最深那位', performance: 1, effect: { reputation: 1 }, result: '定了，其他专家有意见。' },
      { text: '按自己的倾向引导', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '后来项目出问题，评审记录被翻出。' },
    ],
  },
  {
    title: '年底述职',
    scene: '要述职了，成绩有几项，失误也有两项。',
    options: [
      { text: '成绩讲够，失误讲透，明年打算具体', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 1 }, result: '这份述职被评价为"实在"。' },
      { text: '只讲成绩', performance: 1, effect: { reputation: 1 }, result: '讲完了，没什么印象。' },
      { text: '把失误推给客观原因', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '大家都知道那两件事是怎么回事。' },
    ],
  },
];

},
"game/rank-events/rank-06": function(module, exports, require) {
// 职级 6 · 县处级正职（正处级）
//
// 权力边界：县域或部门一把手。人、财、事都要在你这里定盘子，也要为所有
// 结果兜底。题目围绕"一把手的判断、担当与边界"。
// 50 道。

module.exports = [
  {
    title: '到任履新',
    scene: '到任第一周，前任留下一份待办清单和几件没人敢碰的事。',
    options: [
      { text: '先跑遍所有乡镇和最难的几家企业，再定盘子', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '一个月后拿出的判断，让班子吃了一惊。' },
      { text: '先听四大班子汇报', performance: 1, effect: { reputation: 1 }, result: '听到了一套说法，还有几套没听到。' },
      { text: '先烧三把火立威', performance: -1, effect: { reputation: -2 }, result: '火烧起来了，也烧掉了支持。' },
    ],
  },
  {
    title: '首次常委会',
    scene: '第一次主持常委会，议题里有前任定下但你可能不认同的事。',
    options: [
      { text: '照常上会，让各位充分发表意见后再归纳', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '会开得稳，大家也开始敢说话。' },
      { text: '先把自己的意见亮出来', performance: 1, effect: { reputation: 1 }, result: '意见定了，会就没什么可议的了。' },
      { text: '把前任定的先翻掉', performance: -2, effect: { reputation: -3, network: -2 }, result: '翻了，也翻出了对立面。' },
    ],
  },
  {
    title: '县域战略',
    scene: '要定未来五年的发展定位，几种说法争执不下。',
    options: [
      { text: '请第三方做诊断，把比较优势摆清楚再定', performance: 3, effect: { reputation: 3, seniority: 3, network: 2 }, result: '定位定准了，五年没走弯路。' },
      { text: '沿用上一任的思路', performance: 1, effect: { reputation: 1 }, result: '沿用下来了，也没什么新气。' },
      { text: '按最新提法换个说法', performance: -1, effect: { reputation: -2 }, result: '说法变了，事还是那些事。' },
    ],
  },
  {
    title: '财政预算',
    scene: '预算编不出来，收入和支出的缺口很大。',
    options: [
      { text: '重新排优先级，压一般项目保基本民生和化债', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '紧着过了一年，没出风险。' },
      { text: '各部门都压一点', performance: 1, effect: { reputation: 1 }, result: '压完谁都喊疼。' },
      { text: '先过再说，缺口靠调度', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '年底调度不动，工资都差点发不出。' },
    ],
  },
  {
    title: '人事酝酿',
    scene: '一批重要岗位要动，各方递来的说法很多。',
    options: [
      { text: '定标准、走程序，动议过程全程留痕', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '调整的这批人服众，也没留下后患。' },
      { text: '多方平衡', performance: 1, effect: { reputation: 1 }, result: '平衡了，能力匹配度一般。' },
      { text: '用自己带来的人', performance: -3, effect: { reputation: -4, integrity: -3, network: -2 }, result: '本地干部开始离心。' },
    ],
  },
  {
    title: '重大决策',
    scene: '一个决定会影响未来十年，但眼前收益很诱人。',
    options: [
      { text: '做长周期评估，把不可逆的部分单独论证', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 1 }, result: '十年后看，这个决定是对的。' },
      { text: '集体决策，按多数意见定', performance: 1, effect: { reputation: 1 }, result: '定了，但没人真正负责。' },
      { text: '先干起来再说', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '干到一半发现走不通。' },
    ],
  },
  {
    title: '政府债务',
    scene: '存量债务滚不动了，还本付息压力集中到这两年。',
    options: [
      { text: '制定化债方案，盘资产、压支出、谈展期三管齐下', performance: 3, effect: { reputation: 4, integrity: 2, health: -2, seniority: 2 }, result: '两年后风险等级降了一档。' },
      { text: '借新还旧先扛过去', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '扛过去了一年，窟窿更大。' },
      { text: '向上要资金支持', performance: -1, effect: { reputation: -2 }, result: '要到了一点，条件很硬。' },
    ],
  },
  {
    title: '平台公司',
    scene: '几家平台公司政企不分，负债和职能都混在一起。',
    options: [
      { text: '清产核资，按功能分类转型，该并的并', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2, health: -1 }, result: '两年后平台有了自我造血能力。' },
      { text: '换一批人管理', performance: 1, effect: { reputation: 1 }, result: '人换了，机制没变。' },
      { text: '继续用它们融资', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '债越滚越多，最终还是要兜底。' },
    ],
  },
  {
    title: '重点项目',
    scene: '十几个重点项目同时铺开，资金和干部都跟不上。',
    options: [
      { text: '砍到五个，配最强的班子盯着干', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '五个全部按期建成，第二年更好争取。' },
      { text: '全部推进，能干多少算多少', performance: 1, effect: { reputation: 1, health: -2 }, result: '一半成了半拉子。' },
      { text: '先干领导关注的', performance: -1, effect: { reputation: -2 }, result: '关注点一变，项目就停。' },
    ],
  },
  {
    title: '土地出让',
    scene: '几块地要出让，市场不好，有人建议你找国企托底。',
    options: [
      { text: '按市场定价，找托底的事不做', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '出让价低了些，但账很干净。' },
      { text: '让国企托一下', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '账面好看了，国企的账留下了。' },
      { text: '找关系好的企业来拿', performance: -3, effect: { reputation: -4, integrity: -5 }, result: '拿地的企业后来出事，牵了出来。' },
    ],
  },
  {
    title: '城市经营',
    scene: '要搞一片新区，但现有建成区还有大量闲置。',
    options: [
      { text: '先盘活存量，新区缓一缓', performance: 3, effect: { reputation: 3, integrity: 1, seniority: 2 }, result: '存量起来了，新区也少了风险。' },
      { text: '新区先启动', performance: 1, effect: { reputation: 1 }, result: '新区起来了，老城更空。' },
      { text: '两头发力', performance: -1, effect: { reputation: -2 }, result: '两头都缺钱。' },
    ],
  },
  {
    title: '园区体制',
    scene: '园区和行政区的职能交叉，一件事要盖好几个章。',
    options: [
      { text: '理顺体制，园区专注经济，社会事务交回属地', performance: 3, effect: { reputation: 3, seniority: 2, network: 1 }, result: '理顺后招商效率明显提高。' },
      { text: '成立协调小组', performance: 1, effect: { reputation: 1 }, result: '小组成了又一个层级。' },
      { text: '维持现状', performance: -1, effect: { reputation: -2 }, result: '企业继续在两头跑。' },
    ],
  },
  {
    title: '招商体制',
    scene: '招商部门各自为政，同一个项目内部互相抢。',
    options: [
      { text: '建统一的项目库和信息共享机制，按产业分工', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '内耗没了，落地率提高。' },
      { text: '谁招到算谁的', performance: 1, effect: { reputation: 1 }, result: '抢得更厉害了。' },
      { text: '收归一个部门统管', performance: -1, effect: { reputation: -2, network: -1 }, result: '统管了，积极性也下去了。' },
    ],
  },
  {
    title: '营商环境',
    scene: '一家外地企业被本地同行挤兑，来找你告状。',
    options: [
      { text: '指定专班核查，依法处理并公开结果', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 1 }, result: '处理完，外地企业反而加大了投资。' },
      { text: '让主管部门去查', performance: 1, effect: { reputation: 1 }, result: '查了，结论是"证据不足"。' },
      { text: '劝外地企业入乡随俗', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '这家企业撤了，还带走了口碑。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '要推乡村振兴，钱有限，是做示范带还是普惠？',
    options: [
      { text: '普惠打底、示范引领，两笔钱分开算', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后既有亮点，面上也变了。' },
      { text: '集中做示范', performance: 1, effect: { reputation: 1 }, result: '示范很漂亮，别的村没动静。' },
      { text: '撒胡椒面', performance: -1, effect: { reputation: -2 }, result: '哪儿都没变样。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '要落实耕地保护和粮食面积，跟地方发展有冲突。',
    options: [
      { text: '先划死红线，再在存量上想办法提高产出', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '面积和产量都完成，也没耽误发展。' },
      { text: '完成任务优先', performance: 1, effect: { reputation: 1 }, result: '任务完成了，产出不高。' },
      { text: '在数字上达标', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '图斑比对时被发现。' },
    ],
  },
  {
    title: '生态环保督察',
    scene: '督察组指出一批问题，有几个是你任内上马的项目。',
    options: [
      { text: '照单认领，该停的停、该改的改，不找理由', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 1 }, result: '整改到位，督察组反馈评价正面。' },
      { text: '边改边说明困难', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '改了一半，说明也没被采纳。' },
      { text: '想办法沟通一下', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '沟通的事被作为典型通报。' },
    ],
  },
  {
    title: '巡视整改',
    scene: '巡视反馈点了一批人和事，其中有几件牵扯较深。',
    options: [
      { text: '逐件查清，该处理处理，同时把制度补上', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '整改扎实，上级给了肯定。' },
      { text: '处理几个轻的', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '处理了，深的水没动。' },
      { text: '保住人，处理事', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '回头看时全部翻出来。' },
    ],
  },
  {
    title: '治安整治',
    scene: '一个领域乱象多年，背后牵扯到一些本地关系。',
    options: [
      { text: '交政法机关依法办，自己不干预个案', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 1 }, result: '整治到位，也没留下干预的口子。' },
      { text: '集中打击一次', performance: 1, effect: { reputation: 1 }, result: '打了一阵，风头过了又回来。' },
      { text: '保住关系，缓一缓', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '乱象闹大了，一起被查。' },
    ],
  },
  {
    title: '信访稳定',
    scene: '一个群体性诉求，人数多、时间久、诉求有合理成分。',
    options: [
      { text: '亲自接访，把合理部分和政策边界一次说清', performance: 3, effect: { reputation: 4, health: -2, seniority: 1 }, result: '签了分批解决协议，人群散了。' },
      { text: '包案到人，稳控为主', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '稳住了，问题还在。' },
      { text: '先压下来', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '压不住，事情上去了。' },
    ],
  },
  {
    title: '安全生产',
    scene: '辖区出了较大事故，有人员伤亡。',
    options: [
      { text: '第一时间到现场，全力救援并按程序上报', performance: 3, effect: { reputation: 4, integrity: 2, health: -3 }, result: '处置得当，问责时也说得清。' },
      { text: '先处置，等清楚情况再报', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '被认定迟报。' },
      { text: '控制消息，先内部处理', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '瞒报被查，从重处理。' },
    ],
  },
  {
    title: '应急体系',
    scene: '几次小险情暴露出应急体系响应慢、职责不清。',
    options: [
      { text: '重构指挥体系，做几次不打招呼的演练', performance: 3, effect: { reputation: 3, seniority: 2, health: -2 }, result: '下一次真出事时，响应快了一倍。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案修订了，没人练。' },
      { text: '加强值班', performance: -1, effect: { reputation: -2 }, result: '值班加强了，还是乱。' },
    ],
  },
  {
    title: '公共卫生体系',
    scene: '一次突发公共卫生事件暴露出基层能力的薄弱。',
    options: [
      { text: '补基层能力和物资体系，把演练做成常态', performance: 3, effect: { reputation: 4, seniority: 2, health: -2 }, result: '下一次应对明显从容。' },
      { text: '建一个指挥中心', performance: 1, effect: { reputation: 1 }, result: '中心建了，基层还是薄弱。' },
      { text: '事后表彰一下', performance: -1, effect: { reputation: -2 }, result: '表彰完了，能力没变。' },
    ],
  },
  {
    title: '教育改革',
    scene: '优质教育资源集中在城区，农村学校空心化。',
    options: [
      { text: '做实质性集团化，教师轮岗落到人头和年限', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后农村学校回流了一批学生。' },
      { text: '硬件先补上', performance: 1, effect: { reputation: 1 }, result: '校舍新了，老师还是留不住。' },
      { text: '合并农村学校', performance: -1, effect: { reputation: -3 }, result: '合了，学生上学更远，家长意见大。' },
    ],
  },
  {
    title: '医疗改革',
    scene: '群众看病还是往外地跑，本地医院留不住病人。',
    options: [
      { text: '做实医共体，把人才和分配机制真正打通', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '两年后县域就诊率明显提高。' },
      { text: '引进设备', performance: 1, effect: { reputation: 1 }, result: '设备来了，会用的医生不够。' },
      { text: '跟外地大医院签合作', performance: -1, effect: { reputation: -1 }, result: '签了，病人还是往外跑。' },
    ],
  },
  {
    title: '社会保障',
    scene: '社保基金收支压力渐显，有几个群体还没覆盖到。',
    options: [
      { text: '先扩面征缴，把该保的保住', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '覆盖面扩大，基金也更稳。' },
      { text: '提高补助标准', performance: 1, effect: { reputation: 1 }, result: '标准提了，缺口更大。' },
      { text: '等上级政策', performance: -1, effect: { reputation: -2 }, result: '等了一年，什么也没变。' },
    ],
  },
  {
    title: '就业优先',
    scene: '一批企业用工减少，同时有一批人找不到活。',
    options: [
      { text: '摸清供需两侧，做定向培训和岗位对接', performance: 3, effect: { reputation: 4, seniority: 1, health: -1 }, result: '匹配率上去，就业形势稳住了。' },
      { text: '开发公益性岗位', performance: 1, effect: { reputation: 1 }, result: '岗位有限，杯水车薪。' },
      { text: '给企业稳岗补贴', performance: -1, effect: { reputation: -1 }, result: '补了，企业还是减员。' },
    ],
  },
  {
    title: '统计工作',
    scene: '几个主要指标掉得厉害，有人建议"做做工作"。',
    options: [
      { text: '照实报，把下滑原因和对策一起报上去', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 1 }, result: '上级认可了态度，还给了支持。' },
      { text: '微调一下', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '微调后越来越难圆。' },
      { text: '布置口径', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计造假被立案，一把手首责。' },
    ],
  },
  {
    title: '审计整改',
    scene: '审计报告里有一笔支出说不清，是前任留下的。',
    options: [
      { text: '如实说明并配合，同时健全制度', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '处理干净，自己也撇清了。' },
      { text: '要求经手人补说明', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '说明补了，还是说不清。' },
      { text: '想办法平掉', performance: -4, effect: { reputation: -5, integrity: -5 }, result: '平账的事，你成了经手人。' },
    ],
  },
  {
    title: '法治建设',
    scene: '一项行政决定被申请复议，可能站不住。',
    options: [
      { text: '请法制部门复查，错的就主动撤销', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '主动纠错反而没影响公信。' },
      { text: '坚持原决定', performance: 1, effect: { reputation: 1 }, result: '被撤销，执行也受影响。' },
      { text: '做对方工作撤回申请', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '撤回的事被对方留了证。' },
    ],
  },
  {
    title: '政务公开',
    scene: '有人申请公开一批信息，其中有你们不太想公开的。',
    options: [
      { text: '依法公开，不能公开的说明法律依据', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '公开后没人再追究。' },
      { text: '能不公开就不公开', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '被复议，还是要公开。' },
      { text: '拖着不答复', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '超期答复被通报。' },
    ],
  },
  {
    title: '数字政府',
    scene: '要上一个大平台，投入不小，各部门系统都是孤岛。',
    options: [
      { text: '先定数据共享的硬规则，再建平台', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '平台真用起来了，重复录入没了。' },
      { text: '先建平台再推共享', performance: 1, effect: { reputation: 1 }, result: '平台建了，数据还是不通。' },
      { text: '各部门各建各的', performance: -2, effect: { reputation: -3 }, result: '又多了几个孤岛。' },
    ],
  },
  {
    title: '政务服务',
    scene: '群众办事还是多头跑，一次没办成。',
    options: [
      { text: '自己暗访一次，把流程重做成一件事一次办', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '改革后跑动次数少了一大半。' },
      { text: '优化窗口设置', performance: 1, effect: { reputation: 1 }, result: '窗口多了，流程没变。' },
      { text: '加大宣传告知', performance: -1, effect: { reputation: -2 }, result: '告知清楚了，还是要跑。' },
    ],
  },
  {
    title: '干部作风',
    scene: '干部队伍里躺平的多，干事的少，追责也追不动。',
    options: [
      { text: '树标杆、给舞台、真容错，同时动几个不干事的', performance: 3, effect: { reputation: 4, network: 3, seniority: 2 }, result: '一年后主动干活的人多起来了。' },
      { text: '加强考核', performance: 1, effect: { reputation: 1 }, result: '考核多了，应付也多了。' },
      { text: '开会批评', performance: -1, effect: { reputation: -2 }, result: '批评完了，还是那样。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你身边一位共事多年的同事被反映有问题。',
    options: [
      { text: '按规定回避，交纪检监察机关依规办理', performance: 3, effect: { reputation: 3, integrity: 4 }, result: '处理干净，也没人说你护短。' },
      { text: '先找他谈一次', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '谈了，反而给了串供的时间。' },
      { text: '出面担保', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '担保的事，把你一起卷进去。' },
    ],
  },
  {
    title: '领导班子',
    scene: '班子里有两位长期不和，已经影响到工作推进。',
    options: [
      { text: '分别谈，把职责和边界重新划清，必要时调整', performance: 3, effect: { reputation: 3, seniority: 2, network: 1 }, result: '调整后班子重新形成合力。' },
      { text: '在会上强调团结', performance: 1, effect: { reputation: 1 }, result: '强调了，私下还是那样。' },
      { text: '各用各的，避免交集', performance: -1, effect: { reputation: -2 }, result: '工作被切成两半。' },
    ],
  },
  {
    title: '上级调研',
    scene: '主要领导要来调研，既要好看也要真实。',
    options: [
      { text: '照实准备，亮点和问题都讲，请求指导', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '领导现场给了支持政策。' },
      { text: '精心准备几个点', performance: 1, effect: { reputation: 1 }, result: '看完了，没留下什么。' },
      { text: '布置一个点', performance: -3, effect: { reputation: -4, integrity: -3 }, result: '领导临时改路线，直接露馅。' },
    ],
  },
  {
    title: '区域协作',
    scene: '邻县想一起做一件跨区域的事，利益怎么分还没谈。',
    options: [
      { text: '先谈成本和收益分担机制，再谈项目', performance: 3, effect: { reputation: 3, network: 3, seniority: 2 }, result: '机制定了，项目推进很顺。' },
      { text: '先签框架', performance: 1, effect: { reputation: 1 }, result: '签了，一谈细节就卡。' },
      { text: '只做对自己有利的部分', performance: -2, effect: { reputation: -3, network: -2 }, result: '对方也不配合了。' },
    ],
  },
  {
    title: '对口支援',
    scene: '要承接一批对口支援任务，本地也有困难。',
    options: [
      { text: '结合双方需要找结合点，做成长期协作', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '协作做实了，两边都有收益。' },
      { text: '按要求完成任务', performance: 1, effect: { reputation: 1 }, result: '任务完成了，没有后劲。' },
      { text: '能少做就少做', performance: -2, effect: { reputation: -3 }, result: '被通报，也失了机会。' },
    ],
  },
  {
    title: '灾后重建',
    scene: '一场灾害过后，重建任务和资金压力都很大。',
    options: [
      { text: '先保障安置，再做规划重建，把标准提上去', performance: 3, effect: { reputation: 5, seniority: 2, health: -3 }, result: '重建后的抗灾能力明显提高。' },
      { text: '按原样恢复', performance: 1, effect: { reputation: 1 }, result: '恢复了，下次还是一样。' },
      { text: '先争取资金再动', performance: -1, effect: { reputation: -2 }, result: '群众在板房里过了一冬。' },
    ],
  },
  {
    title: '舆情危机',
    scene: '一件事发酵成全国性话题，你处在风暴中心。',
    options: [
      { text: '主动发声，说清事实、认错、给时间表', performance: 3, effect: { reputation: 4, health: -3, integrity: 1 }, result: '一周后舆论转向，上级也认可处置。' },
      { text: '等上级统一安排', performance: 1, effect: { reputation: 1 }, result: '等到了安排，话题已经换了几轮。' },
      { text: '找渠道压热度', performance: -4, effect: { reputation: -5, integrity: -4 }, result: '压热度的事本身成了新话题。' },
    ],
  },
  {
    title: '突发事件',
    scene: '凌晨接到报告，辖区内发生重大险情。',
    options: [
      { text: '立即到现场成立指挥部，边救边报', performance: 3, effect: { reputation: 5, health: -3, seniority: 2 }, result: '处置及时，损失降到最低。' },
      { text: '在指挥部远程调度', performance: 1, effect: { reputation: 1 }, result: '调度了，现场缺主心骨。' },
      { text: '等天亮再说', performance: -4, effect: { reputation: -6, integrity: -3 }, result: '错过了最佳处置窗口。' },
    ],
  },
  {
    title: '年底冲刺',
    scene: '年底指标还差一截，下面已经开始想办法了。',
    options: [
      { text: '明确说不许造假，能完成多少算多少', performance: 3, effect: { reputation: 3, integrity: 4 }, result: '指标差了一点，但账是干净的。' },
      { text: '加码压下去', performance: 1, effect: { reputation: 1, health: -1 }, result: '压出了数字，也压出了怨气。' },
      { text: '默许下面想办法', performance: -4, effect: { reputation: -5, integrity: -5 }, result: '年报被人质疑，核查找上门。' },
    ],
  },
  {
    title: '述职评议',
    scene: '要向全委会述职，今年的成绩和失误都很清楚。',
    options: [
      { text: '成绩讲足，问题讲透，明年清单具体', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 1 }, result: '评议结果很好，也立住了威信。' },
      { text: '重点讲成绩', performance: 1, effect: { reputation: 1 }, result: '讲完了，评价一般。' },
      { text: '把问题归咎于客观', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '评议时有人当面提了意见。' },
    ],
  },
  {
    title: '干部任免',
    scene: '一个关键岗位要定人，能力强但风评有争议。',
    options: [
      { text: '把争议查清，能澄清的澄清，不能澄清的不用', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 2 }, result: '澄清后用了，这个人后来干得很好。' },
      { text: '用能力强的', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '用了，议论一直没断。' },
      { text: '用没争议的', performance: -1, effect: { reputation: -1 }, result: '没争议，也没能力。' },
    ],
  },
  {
    title: '重大工程',
    scene: '一个投资很大的工程要上，反对意见认为不划算。',
    options: [
      { text: '做全周期论证，把反对意见写进报告再决策', performance: 3, effect: { reputation: 3, seniority: 3, integrity: 1 }, result: '十年后看，这个工程是值的。' },
      { text: '上会定', performance: 1, effect: { reputation: 1 }, result: '定了，反对的人保留意见。' },
      { text: '先干，边干边看', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '干到一半发现收益远低于预期。' },
    ],
  },
  {
    title: '民生票决',
    scene: '民生实事票决结果出来了，几项花钱多、见效慢。',
    options: [
      { text: '尊重票决结果，分步实施并公开进度', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '几年后这几项成了最有口碑的事。' },
      { text: '调整成见效快的', performance: 1, effect: { reputation: 1 }, result: '见效快，群众不买账。' },
      { text: '先办一部分', performance: -1, effect: { reputation: -2 }, result: '票决的公信力打了折。' },
    ],
  },
  {
    title: '企业纾困',
    scene: '本地一家龙头遇到困难，牵动上下游很多人就业。',
    options: [
      { text: '分清是流动性还是竞争力问题，分类施策', performance: 3, effect: { reputation: 4, network: 2, seniority: 1 }, result: '该救的救回来了，该退的有序退出。' },
      { text: '全力保住', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '保住了，代价很大。' },
      { text: '市场化出清', performance: -1, effect: { reputation: -2 }, result: '出清了，就业压力集中爆发。' },
    ],
  },
  {
    title: '政策落地',
    scene: '一项好政策推了一年，基层还是老样子。',
    options: [
      { text: '查清是能力、动力还是机制问题，对症下药', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '第二年政策真正落了地。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查了，基层应付。' },
      { text: '换一批人', performance: -1, effect: { reputation: -2, network: -1 }, result: '换了人，机制还是那样。' },
    ],
  },
  {
    title: '离任交接',
    scene: '你要离开这个岗位了，手里还有几件没做完的事。',
    options: [
      { text: '逐件写清来龙去脉、风险和下一步，当面交给接任者', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 2 }, result: '离任后口碑还在，接任者年年登门。' },
      { text: '按常规交接', performance: 1, effect: { reputation: 1 }, result: '交接完了，几件事后来爆了。' },
      { text: '挑漂亮的写', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '接任者吃了亏，话说得很难听。' },
    ],
  },
];

},
"game/rank-events/rank-07": function(module, exports, require) {
// 职级 7 · 厅局级副职（副厅级）
//
// 权力边界：管一条战线，协调若干个部门甚至若干个地方。不大直接办具体事，
// 但要让体系转起来。题目围绕"跨部门协调、制度设计与尺度把握"。
// 50 道。

module.exports = [
  {
    title: '分管战线',
    scene: '分工下来，你分管一条跨十几个部门、上下都盯着看的战线。',
    options: [
      { text: '先摸清这条线的历史沿革和关键堵点', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '三个月后你说的每句话都很准。' },
      { text: '先开分管部门会', performance: 1, effect: { reputation: 1 }, result: '会开了，各家报了各自的说法。' },
      { text: '先抓一项最容易见效的', performance: -1, effect: { reputation: -2 }, result: '见效了，主线没人认领。' },
    ],
  },
  {
    title: '首次常务会',
    scene: '第一次上政府常务会，你的议题被几个部门提了意见。',
    options: [
      { text: '会前逐个沟通，把分歧解决在上会之前', performance: 3, effect: { reputation: 4, network: 2, seniority: 2 }, result: '议题一次通过。' },
      { text: '会上逐条解释', performance: 1, effect: { reputation: 1 }, result: '解释了，被要求再论证。' },
      { text: '请主要领导支持', performance: -1, effect: { reputation: -2 }, result: '通过了，部门心里不服。' },
    ],
  },
  {
    title: '部门协同',
    scene: '一件事涉及七八个部门，开了三次会还是推不动。',
    options: [
      { text: '建专班，定牵头、定节点、定考核，你亲自周调度', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两个月后事情有了实质进展。' },
      { text: '再开一次协调会', performance: 1, effect: { reputation: 1 }, result: '会开了，还是各说各话。' },
      { text: '报给主要领导', performance: -1, effect: { reputation: -2, network: -1 }, result: '被说成是协调能力不够。' },
    ],
  },
  {
    title: '跨区域协调',
    scene: '一条产业链跨三个市，各地都想把环节留在本地。',
    options: [
      { text: '推动建立利益分享机制，按环节分工', performance: 3, effect: { reputation: 4, network: 4, seniority: 2 }, result: '三地签了协议，链条真正打通。' },
      { text: '各地各干各的', performance: 1, effect: { reputation: 1 }, result: '重复建设，谁都没做大。' },
      { text: '让条件最好的那个先做', performance: -1, effect: { reputation: -2, network: -2 }, result: '另外两地从此不配合。' },
    ],
  },
  {
    title: '行业规划',
    scene: '要编一个行业五年规划，各方诉求差别很大。',
    options: [
      { text: '开门做规划，多轮论证后锁定几个硬指标', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '规划落地率高，五年没大改。' },
      { text: '委托机构做', performance: 1, effect: { reputation: 1 }, result: '做出来了，没人认。' },
      { text: '把各方诉求都写进去', performance: -1, effect: { reputation: -2 }, result: '规划成了清单，没有重点。' },
    ],
  },
  {
    title: '产业集群',
    scene: '一个产业集群大而不强，配套都在外地。',
    options: [
      { text: '找准缺失环节定向补链，同时做公共服务平台', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '三年后本地配套率翻了一倍。' },
      { text: '引进龙头企业', performance: 1, effect: { reputation: 1 }, result: '龙头来了，配套还是在外地。' },
      { text: '给补贴留住企业', performance: -1, effect: { reputation: -2 }, result: '补贴一停就想走。' },
    ],
  },
  {
    title: '项目调度',
    scene: '一批重点项目进度滞后，原因各不相同。',
    options: [
      { text: '逐个过堂，分出卡审批、卡资金、卡征拆三类分别解决', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '半年后开工率明显提升。' },
      { text: '通报排名', performance: 1, effect: { reputation: 1 }, result: '通报了，进度没变。' },
      { text: '约谈落后的', performance: -1, effect: { reputation: -2, network: -1 }, result: '约谈了，问题还是那些问题。' },
    ],
  },
  {
    title: '要素保障',
    scene: '土地、能耗、环境容量都紧，好项目落不了地。',
    options: [
      { text: '盘活存量、腾出指标，优先保真正的好项目', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '有限的要素用在了刀刃上。' },
      { text: '向上争取', performance: 1, effect: { reputation: 1 }, result: '争取到一点，僧多粥少。' },
      { text: '谁急给谁', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '好项目还是落不了。' },
    ],
  },
  {
    title: '营商环境',
    scene: '评价下来，企业反映最强烈的是政策不稳定、执法随意。',
    options: [
      { text: '推政策稳定性和执法规范化，设投诉直通渠道', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 2 }, result: '第二年评价名次大幅前移。' },
      { text: '出台一批优惠', performance: 1, effect: { reputation: 1 }, result: '优惠出了，根本问题没解决。' },
      { text: '做评价应对', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '名次上去了，企业还是在跑。' },
    ],
  },
  {
    title: '科技创新',
    scene: '研发投入上不去，成果转化也不畅。',
    options: [
      { text: '从需求侧切入，让企业出题、院所答题、政府搭台', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '转化率明显提高，投入也跟着涨。' },
      { text: '增加财政投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，产出没跟。' },
      { text: '引进几家研究院', performance: -1, effect: { reputation: -2 }, result: '院牌挂了，没有实。' },
    ],
  },
  {
    title: '数字化转型',
    scene: '企业想转不敢转，不知道从哪下手。',
    options: [
      { text: '做一批样板线，把改造方案和成本收益公开出来', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '样板出来后，跟进的企业排起了队。' },
      { text: '给改造补贴', performance: 1, effect: { reputation: 1 }, result: '补贴花了，改造流于形式。' },
      { text: '发文号召', performance: -1, effect: { reputation: -2 }, result: '号召了，没人动。' },
    ],
  },
  {
    title: '产业基金',
    scene: '要设一支产业基金，怎么选管理人、怎么容错都是问题。',
    options: [
      { text: '公开遴选管理人，明确容亏率和退出机制', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '基金运作规范，也真投出了项目。' },
      { text: '指定一家熟悉的机构', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '指定了，后续很难监管。' },
      { text: '要求保本', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '保本条款下没人敢投好项目。' },
    ],
  },
  {
    title: '国企改革',
    scene: '几家国企主业不清、亏损多年，人也多。',
    options: [
      { text: '一企一策定主业，该退的退，人妥善安置', performance: 3, effect: { reputation: 3, seniority: 2, health: -2 }, result: '两年后整体扭亏。' },
      { text: '换一批班子', performance: 1, effect: { reputation: 1 }, result: '班子换了，机制没动。' },
      { text: '先输血保稳定', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '血输完，还是亏。' },
    ],
  },
  {
    title: '金融风险',
    scene: '一家本地金融机构出现风险苗头。',
    options: [
      { text: '早识别早介入，制定处置方案并稳住储户情绪', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '风险平稳化解，没发生挤兑。' },
      { text: '要求机构自己化解', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '拖了半年，风险扩大。' },
      { text: '先压住消息', performance: -4, effect: { reputation: -6, integrity: -5 }, result: '消息走漏引发挤兑。' },
    ],
  },
  {
    title: '地方金融',
    scene: '中小微企业融资难，银行不敢贷。',
    options: [
      { text: '建信息共享和风险分担机制，把信用体系做起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '一年后融资规模和成本都改善了。' },
      { text: '要求银行放贷', performance: 1, effect: { reputation: 1 }, result: '放了一批，不良也上来了。' },
      { text: '财政贴息', performance: -1, effect: { reputation: -1 }, result: '贴息花了，覆盖面很小。' },
    ],
  },
  {
    title: '企业上市',
    scene: '要推企业上市，几家条件差距很大。',
    options: [
      { text: '分层培育，先解决规范性问题再谈进度', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '三年内上市了三家，也没有造假。' },
      { text: '给奖励冲刺', performance: 1, effect: { reputation: 1 }, result: '冲了一阵，撤材料了。' },
      { text: '包装一下先报', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '现场检查出问题，被立案。' },
    ],
  },
  {
    title: '外贸外资',
    scene: '外贸订单下滑，外资也有观望情绪。',
    options: [
      { text: '帮企业拓市场、稳订单，同时解决外资的实际困难', performance: 3, effect: { reputation: 4, network: 3, seniority: 1 }, result: '那年外贸份额反而涨了。' },
      { text: '出台扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，落到企业手里慢。' },
      { text: '等形势好转', performance: -2, effect: { reputation: -3 }, result: '等来了更多企业外迁。' },
    ],
  },
  {
    title: '开发区',
    scene: '几个开发区同质化严重，都在抢同一类项目。',
    options: [
      { text: '明确各自主导产业，建立项目流转和利益分享机制', performance: 3, effect: { reputation: 3, seniority: 3, network: 2 }, result: '错位发展后整体招商效果好很多。' },
      { text: '谁有能力谁上', performance: 1, effect: { reputation: 1 }, result: '强的更强，弱的空转。' },
      { text: '合并几个区', performance: -1, effect: { reputation: -2, network: -1 }, result: '合了，人心散了。' },
    ],
  },
  {
    title: '口岸建设',
    scene: '口岸通关效率排在后面，企业意见大。',
    options: [
      { text: '逐环节测时间，能并的并、能提前的提前', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '通关时间缩短，货运量上来了。' },
      { text: '增加人力和窗口', performance: 1, effect: { reputation: 1 }, result: '人加了，环节还是那么多。' },
      { text: '要求企业适应', performance: -2, effect: { reputation: -3 }, result: '企业开始走别的口岸。' },
    ],
  },
  {
    title: '交通网络',
    scene: '一条通道对区域格局很关键，但投资大、回收慢。',
    options: [
      { text: '做全周期论证，把不可量化的社会效益也摆出来', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '项目获批，十年后看是对的。' },
      { text: '先做一段', performance: 1, effect: { reputation: 1 }, result: '一段通了，效益有限。' },
      { text: '等条件成熟', performance: -1, effect: { reputation: -2 }, result: '邻市先建了，格局变了。' },
    ],
  },
  {
    title: '能源保障',
    scene: '用电高峰缺口明显，同时还要完成节能目标。',
    options: [
      { text: '供给侧和需求侧一起做，先保民生和重点', performance: 3, effect: { reputation: 4, health: -2, seniority: 2 }, result: '平稳度过高峰，也没拉闸限电。' },
      { text: '向上争取指标', performance: 1, effect: { reputation: 1 }, result: '争取到一点，缺口还在。' },
      { text: '有序用电', performance: -1, effect: { reputation: -2 }, result: '限了电，企业意见很大。' },
    ],
  },
  {
    title: '节能降碳',
    scene: '节能降碳目标压下来，跟增长目标有冲突。',
    options: [
      { text: '在存量改造上找空间，用技术和管理换指标', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '目标完成，增长也没掉。' },
      { text: '压项目', performance: 1, effect: { reputation: 1 }, result: '压了，增长也下来了。' },
      { text: '在核算上想办法', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '核算方法被上级纠正。' },
    ],
  },
  {
    title: '生态治理',
    scene: '一项治理任务涉及上下游、左右岸，标准不统一。',
    options: [
      { text: '推动统一标准、统一监测、联合执法', performance: 3, effect: { reputation: 4, network: 3, seniority: 2 }, result: '治理效果出来了，也没有互相扯皮。' },
      { text: '各自完成任务', performance: 1, effect: { reputation: 1 }, result: '各自达标，整体没改善。' },
      { text: '先治自己这段', performance: -1, effect: { reputation: -2 }, result: '治了，上游还在排。' },
    ],
  },
  {
    title: '流域治理',
    scene: '一条河的治理要动很多主体的利益。',
    options: [
      { text: '把责任清单和补偿机制一起建起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '三年后水质稳定达标。' },
      { text: '上工程', performance: 1, effect: { reputation: 1 }, result: '工程上了，源头没管住。' },
      { text: '先做景观', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '岸上漂亮，水里还是那样。' },
    ],
  },
  {
    title: '城市建设',
    scene: '城市扩张很快，但公共服务跟不上。',
    options: [
      { text: '把公共服务跟人口分布一起规划，缺什么补什么', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '三年后新区真正有人气。' },
      { text: '先把骨架拉开', performance: 1, effect: { reputation: 1 }, result: '路修了，人没来。' },
      { text: '先做地标', performance: -2, effect: { reputation: -3 }, result: '地标有了，生活不便。' },
    ],
  },
  {
    title: '城市管理',
    scene: '城市管理长期靠突击，一松就回潮。',
    options: [
      { text: '把标准、责任、经费一起定下来，做常态化', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '一年后不用再突击了。' },
      { text: '增加执法力量', performance: 1, effect: { reputation: 1 }, result: '人多了，矛盾也多了。' },
      { text: '搞集中行动', performance: -1, effect: { reputation: -2 }, result: '行动结束就回潮。' },
    ],
  },
  {
    title: '住房保障',
    scene: '新市民和青年人的住房问题突出。',
    options: [
      { text: '多渠道供给，把保障对象和标准先划清楚', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后保障覆盖面明显扩大。' },
      { text: '多建保障房', performance: 1, effect: { reputation: 1 }, result: '建了，位置和配套不理想。' },
      { text: '发补贴', performance: -1, effect: { reputation: -2 }, result: '补贴发了，房源没增加。' },
    ],
  },
  {
    title: '房地产市场',
    scene: '市场下行，库存高企，房企资金紧张。',
    options: [
      { text: '控增量、去库存、防风险三件事一起抓', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '两年后市场趋于平稳。' },
      { text: '出台刺激政策', performance: 1, effect: { reputation: 1 }, result: '刺激了一阵，又回去了。' },
      { text: '托市', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '托市留下的账，后面很难还。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '乡村振兴推进几年，产业同质化、留不住人。',
    options: [
      { text: '按资源禀赋分区分类，把联农带农机制做实', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后多数村有了稳定来源。' },
      { text: '继续投基础设施', performance: 1, effect: { reputation: 1 }, result: '设施好了，人还是往外走。' },
      { text: '做示范点', performance: -1, effect: { reputation: -2 }, result: '点很漂亮，面上没变。' },
    ],
  },
  {
    title: '现代农业',
    scene: '农业大而不强，产业链短，品牌没有。',
    options: [
      { text: '从加工和品牌两头入手，把利益联结做起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '三年后几个区域品牌真正立住了。' },
      { text: '扩大种植规模', performance: 1, effect: { reputation: 1 }, result: '规模上去了，价格下来了。' },
      { text: '给补贴', performance: -1, effect: { reputation: -2 }, result: '补贴一停就回去。' },
    ],
  },
  {
    title: '水利建设',
    scene: '防洪和灌溉都有欠账，一次投入很大。',
    options: [
      { text: '按风险排序，先除险再提升', performance: 3, effect: { reputation: 3, seniority: 1, integrity: 1 }, result: '那年汛期没有出险情。' },
      { text: '全面铺开', performance: 1, effect: { reputation: 1 }, result: '铺开了，资金跟不上。' },
      { text: '先做看得见的', performance: -2, effect: { reputation: -3 }, result: '看得见的做了，隐患还在。' },
    ],
  },
  {
    title: '就业工作',
    scene: '结构性矛盾突出，有人没活干、有活没人干。',
    options: [
      { text: '把培训跟着岗位走，跟企业一起定课程', performance: 3, effect: { reputation: 4, seniority: 1, network: 2 }, result: '匹配率上去，企业也不再喊缺工。' },
      { text: '扩大培训规模', performance: 1, effect: { reputation: 1 }, result: '培训了很多，用不上。' },
      { text: '开发公益岗', performance: -1, effect: { reputation: -2 }, result: '岗位有限，也解决不了结构问题。' },
    ],
  },
  {
    title: '教育事业',
    scene: '优质教育资源集中，择校热降不下来。',
    options: [
      { text: '做实质均衡，校长教师交流落到人和年限', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '三年后择校热明显降温。' },
      { text: '扩大优质校规模', performance: 1, effect: { reputation: 1 }, result: '规模大了，质量稀释。' },
      { text: '严格就近入学', performance: -1, effect: { reputation: -2 }, result: '择校转到别的通道。' },
    ],
  },
  {
    title: '卫生健康',
    scene: '分级诊疗推不动，大医院人满为患。',
    options: [
      { text: '做强基层能力，同时用医保支付引导分流', performance: 3, effect: { reputation: 3, seniority: 2, network: 1 }, result: '两年后基层就诊占比上去了。' },
      { text: '扩建大医院', performance: 1, effect: { reputation: 1 }, result: '扩了，还是人满。' },
      { text: '限制大医院门诊', performance: -2, effect: { reputation: -3 }, result: '限制了，群众意见很大。' },
    ],
  },
  {
    title: '养老服务',
    scene: '养老供需错配，机构空置和居家无人管并存。',
    options: [
      { text: '以居家社区为主建网络，机构兜底最刚需的', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '三年后服务体系成型。' },
      { text: '增加机构床位', performance: 1, effect: { reputation: 1 }, result: '床位多了，空着一半。' },
      { text: '提高补贴', performance: -1, effect: { reputation: -2 }, result: '补贴提高了，服务还是缺。' },
    ],
  },
  {
    title: '文化旅游',
    scene: '资源不错，但留不住人、消费上不去。',
    options: [
      { text: '先解决体验和公共服务，再做内容', performance: 3, effect: { reputation: 4, seniority: 1, network: 1 }, result: '两年后过夜游客翻了一倍。' },
      { text: '加大宣传', performance: 1, effect: { reputation: 1 }, result: '人来了，体验差，没回头客。' },
      { text: '建大项目', performance: -1, effect: { reputation: -2 }, result: '项目建了，客流撑不住。' },
    ],
  },
  {
    title: '体育事业',
    scene: '群众健身场地不足，赛事经济也没做起来。',
    options: [
      { text: '盘活存量空间，先把身边的场地补上', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '一年后人均场地面积明显提高。' },
      { text: '建大型场馆', performance: 1, effect: { reputation: 1 }, result: '场馆建了，日常利用率低。' },
      { text: '办几场赛事', performance: -1, effect: { reputation: -1 }, result: '赛事办了，没留下东西。' },
    ],
  },
  {
    title: '市场监管',
    scene: '监管力量有限，市场主体多，风险点分散。',
    options: [
      { text: '做信用分级分类监管，把力量压在高风险上', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '监管效能提升，企业干扰减少。' },
      { text: '增加检查频次', performance: 1, effect: { reputation: 1 }, result: '检查多了，企业叫苦，风险没降。' },
      { text: '出了事再查', performance: -2, effect: { reputation: -3 }, result: '出了事，已经晚了。' },
    ],
  },
  {
    title: '知识产权',
    scene: '企业创新能力上来了，但保护和运用跟不上。',
    options: [
      { text: '建快速协同保护和运营体系，帮企业把专利用起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '两年后质押融资和许可都起来了。' },
      { text: '打击侵权', performance: 1, effect: { reputation: 1 }, result: '打了，运用还是空白。' },
      { text: '给申请补贴', performance: -1, effect: { reputation: -2 }, result: '专利数量涨了，质量下降。' },
    ],
  },
  {
    title: '安全生产',
    scene: '这条战线的安全基础薄弱，事故时有发生。',
    options: [
      { text: '把责任体系、标准和隐患排查机制一起建起来', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后事故起数明显下降。' },
      { text: '开展专项整治', performance: 1, effect: { reputation: 1 }, result: '整治完又回来。' },
      { text: '追责为主', performance: -1, effect: { reputation: -2, network: -1 }, result: '追责了，基层开始瞒报。' },
    ],
  },
  {
    title: '应急管理',
    scene: '几起事件暴露出预案脱节、演练走过场。',
    options: [
      { text: '重构预案体系，搞不设脚本的实战演练', performance: 3, effect: { reputation: 4, seniority: 2, health: -2 }, result: '下一次实战中响应快了很多。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案厚了一倍，没人会翻。' },
      { text: '配齐装备', performance: -1, effect: { reputation: -1 }, result: '装备有了，人不会用。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '一次灾害预警发出去了，基层响应却慢半拍。',
    options: [
      { text: '把预警到响应的每一步都明确到人和时间', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '下一次预警响应及时，损失很小。' },
      { text: '加强值班', performance: 1, effect: { reputation: 1 }, result: '值班加强了，流程还是不清。' },
      { text: '事后总结', performance: -1, effect: { reputation: -2 }, result: '总结写了，下次还是慢。' },
    ],
  },
  {
    title: '信访工作',
    scene: '一批积案跨部门跨年份，谁都说不该自己办。',
    options: [
      { text: '逐案明确牵头和责任，公开办理时限', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '一年后积案化解了一多半。' },
      { text: '交办下去', performance: 1, effect: { reputation: 1 }, result: '交办了，转了一圈又回来。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '人稳住了，问题堆得更多。' },
    ],
  },
  {
    title: '法治政府',
    scene: '几个行政诉讼案件接连败诉，暴露出程序问题。',
    options: [
      { text: '从败诉案件倒查制度漏洞，把程序规范立起来', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 2 }, result: '第二年败诉率大幅下降。' },
      { text: '要求部门重视', performance: 1, effect: { reputation: 1 }, result: '重视了，还是照旧出错。' },
      { text: '协调法院', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '协调的事被记录下来。' },
    ],
  },
  {
    title: '统计审计',
    scene: '审计指出这条战线有几项资金使用不规范。',
    options: [
      { text: '逐项整改并建制度，主动公开整改结果', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 1 }, result: '整改通过后，后续审计问题少了。' },
      { text: '要求部门整改', performance: 1, effect: { reputation: 1 }, result: '整改报告交了，问题还在。' },
      { text: '说明客观原因', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被认为整改不实。' },
    ],
  },
  {
    title: '政务服务',
    scene: '一件事要跑好几个部门，网上办不通。',
    options: [
      { text: '以"一件事"为单元重构流程，打通数据', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '改革后跑动次数少了一大半。' },
      { text: '增加网上事项', performance: 1, effect: { reputation: 1 }, result: '网上能办了，还是要跑。' },
      { text: '优化大厅', performance: -1, effect: { reputation: -1 }, result: '大厅漂亮了，流程没变。' },
    ],
  },
  {
    title: '数据资源',
    scene: '数据散在各处，想用的时候拿不到。',
    options: [
      { text: '先立共享的硬规矩和责任制，再建平台', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '数据真跑起来了，应用也多了。' },
      { text: '建一个大数据平台', performance: 1, effect: { reputation: 1 }, result: '平台建了，数据还是不进。' },
      { text: '各部门自建', performance: -2, effect: { reputation: -3 }, result: '又多了几个烟囱。' },
    ],
  },
  {
    title: '督查落实',
    scene: '很多部署落不下去，督查一遍又一遍。',
    options: [
      { text: '查清是能力、资源还是动力问题，分别解决', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '半年后落实情况明显好转。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '廉政风险',
    scene: '你分管的领域资金密集、审批集中，风险点多。',
    options: [
      { text: '把流程公开、把权限分散、把留痕做实', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 2 }, result: '这条线两年没有出问题。' },
      { text: '加强教育提醒', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '提醒了，机制没变。' },
      { text: '相信干部', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '出事时，你是分管领导。' },
    ],
  },
  {
    title: '述职述廉',
    scene: '要述职述廉，这一年有亮点也有两件没做好的事。',
    options: [
      { text: '亮点讲够，问题讲透，廉政部分写实', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 2 }, result: '评议很好，问题也没被追问。' },
      { text: '全面讲成绩', performance: 1, effect: { reputation: 1 }, result: '讲完了，没什么印象。' },
      { text: '廉政部分套话', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被要求补充说明。' },
    ],
  },
];

},
"game/rank-events/rank-08": function(module, exports, require) {
// 职级 8 · 厅局级正职（正厅级）
//
// 权力边界：主政一方或一个厅。定方向、用干部、扛风险，三件事都是你的。
// 题目围绕"一把手的战略定力、用人导向与风险底线"。
// 50 道。

module.exports = [
  {
    title: '主政一方',
    scene: '到任第一件事，是搞清楚这个地方到底处在什么位置。',
    options: [
      { text: '用两个月跑遍所有县区和主要企业，再定调子', performance: 3, effect: { reputation: 5, seniority: 3 }, result: '两个月后的一次讲话，让全市上下心里有了数。' },
      { text: '先听汇报看材料', performance: 1, effect: { reputation: 1 }, result: '材料看完了，还是没有手感。' },
      { text: '沿用前任的路子', performance: -1, effect: { reputation: -2 }, result: '路子沿用下来了，也没有新局。' },
    ],
  },
  {
    title: '首次全会',
    scene: '第一次主持市委全会，要提出一个新的发展思路。',
    options: [
      { text: '多轮征求意见，把思路磨到能落地为止', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '全会通过，干部知道往哪使劲。' },
      { text: '委托起草', performance: 1, effect: { reputation: 1 }, result: '报告念完了，没人记得住。' },
      { text: '提出一个响亮口号', performance: -1, effect: { reputation: -2 }, result: '口号喊了，事还是那些事。' },
    ],
  },
  {
    title: '城市定位',
    scene: '关于城市定位，几种意见争执多年没有结论。',
    options: [
      { text: '做扎实比较研究，把定位收敛到一两条', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '定位收敛后，资源不再分散。' },
      { text: '折中，都写上', performance: 1, effect: { reputation: 1 }, result: '什么都想做，什么都做不深。' },
      { text: '按新提法换个表述', performance: -1, effect: { reputation: -2 }, result: '表述换了，定位还是模糊。' },
    ],
  },
  {
    title: '战略谋划',
    scene: '一件影响未来十年的大事，现在做代价大，不做以后更被动。',
    options: [
      { text: '做全周期论证，早下决心分步推进', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '十年后看，这一步走得很值。' },
      { text: '再研究研究', performance: 1, effect: { reputation: 1 }, result: '研究了两年，窗口关了。' },
      { text: '留给后任', performance: -2, effect: { reputation: -3 }, result: '后任接手时，代价更大。' },
    ],
  },
  {
    title: '经济工作',
    scene: '经济下行压力大，完成目标和保证质量之间有张力。',
    options: [
      { text: '把力气花在市场主体身上，目标能完成多少算多少', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 2 }, result: '当年增速不高，但两年后反超了。' },
      { text: '全力保目标', performance: 1, effect: { reputation: 1, health: -1 }, result: '目标保住了，后劲不足。' },
      { text: '在数字上下功夫', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计核查时，第一责任人是你。' },
    ],
  },
  {
    title: '财政与债务',
    scene: '财政紧平衡，债务又到了集中偿付期。',
    options: [
      { text: '盘资产、压支出、谈展期，把化债当成硬任务', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 3, health: -2 }, result: '三年后风险等级明显下降。' },
      { text: '保运转优先', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '运转保住了，债还在滚。' },
      { text: '借新还旧', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '窟窿越滚越大。' },
    ],
  },
  {
    title: '干部队伍建设',
    scene: '干部队伍年龄结构老化，能挑大梁的不多。',
    options: [
      { text: '建梯队、压担子、真容错，形成正向循环', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '三年后各层级都有能顶事的人。' },
      { text: '外面调一批', performance: 1, effect: { reputation: 1, network: -1 }, result: '调来了，本地的更没劲。' },
      { text: '用老人顶着', performance: -1, effect: { reputation: -2 }, result: '顶了两年，断层更严重。' },
    ],
  },
  {
    title: '选人用人',
    scene: '一批重要岗位要动，有人递话、有人打招呼。',
    options: [
      { text: '把标准立在前，动议全程留痕，打招呼的一律登记', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 3 }, result: '这批人用得服众，往后递话的人少了。' },
      { text: '平衡各方', performance: 1, effect: { reputation: 1 }, result: '平衡了，能力匹配一般。' },
      { text: '用熟悉的', performance: -3, effect: { reputation: -5, integrity: -4, network: -2 }, result: '圈子一成形，风气就坏了。' },
    ],
  },
  {
    title: '政治生态',
    scene: '这个地方前些年出过事，干部心气不高、怕担责。',
    options: [
      { text: '把界限划清、把规矩立明、把干事的撑起来', performance: 3, effect: { reputation: 5, integrity: 3, network: 3, seniority: 3 }, result: '两年后干部敢干事了，出事的反而少了。' },
      { text: '多讲纪律要求', performance: 1, effect: { reputation: 1 }, result: '纪律讲了，还是没人敢干。' },
      { text: '多讲担当', performance: -1, effect: { reputation: -2 }, result: '担当讲了，边界没人知道在哪。' },
    ],
  },
  {
    title: '全面从严治党',
    scene: '主体责任压得不够实，下面有的单位基本没动。',
    options: [
      { text: '自己先领最难的那份责任，逐级约谈压实', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 2 }, result: '一年后责任体系真正转起来了。' },
      { text: '发文件提要求', performance: 1, effect: { reputation: 1 }, result: '文件发了，没人当回事。' },
      { text: '交给纪委', performance: -1, effect: { reputation: -2 }, result: '纪委扛不动主体责任。' },
    ],
  },
  {
    title: '重大项目',
    scene: '一个超大项目在谈，条件里有超出常规的部分。',
    options: [
      { text: '该请示的请示，能把常规部分先落下来', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 2 }, result: '项目落了地，也没有越线。' },
      { text: '先签下来再补', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '签了，超常规的部分成了麻烦。' },
      { text: '破例抢下来', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '项目来了，审计也跟着来了。' },
    ],
  },
  {
    title: '产业布局',
    scene: '各地都想上同一个热门产业，容易一哄而上。',
    options: [
      { text: '按条件和基础定布局，硬约束写进考核', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '三年后没有出现严重同质化。' },
      { text: '让各地竞争', performance: 1, effect: { reputation: 1 }, result: '竞争的结果是普遍过剩。' },
      { text: '集中到一地做', performance: -1, effect: { reputation: -2, network: -2 }, result: '别的地方从此不配合。' },
    ],
  },
  {
    title: '创新驱动',
    scene: '创新资源不足，投入产出比不高。',
    options: [
      { text: '聚焦有限方向，把平台和成果转化机制做实', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '五年后几个方向真正形成了优势。' },
      { text: '全面加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，成果分散。' },
      { text: '引进几个大机构', performance: -1, effect: { reputation: -2 }, result: '机构来了，和本地产业没关系。' },
    ],
  },
  {
    title: '改革开放',
    scene: '一项改革牵动多方利益，推进阻力很大。',
    options: [
      { text: '先试点再推开，把利益调整方案一起做出来', performance: 3, effect: { reputation: 4, seniority: 3, health: -2 }, result: '一年后全面推开，阻力比预想小。' },
      { text: '强力推开', performance: 1, effect: { reputation: 1, network: -1 }, result: '推开了，反弹也来了。' },
      { text: '先放一放', performance: -2, effect: { reputation: -3 }, result: '放了两年，问题更重。' },
    ],
  },
  {
    title: '营商环境',
    scene: '企业和群众反映最集中的，是政策兑现慢、新官不理旧账。',
    options: [
      { text: '专项清理历史欠账，把兑现纳入硬约束', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 2 }, result: '清完之后，投资信心明显回来了。' },
      { text: '出台新的优惠政策', performance: 1, effect: { reputation: 1 }, result: '新政策出了，旧账还是没人认。' },
      { text: '强调诚信', performance: -1, effect: { reputation: -2 }, result: '强调了，欠账还在。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营企业家信心不足，投资意愿下降。',
    options: [
      { text: '开诚布公座谈，解决一批具体问题并公开', performance: 3, effect: { reputation: 5, network: 4, seniority: 2 }, result: '半年后投资开始回暖。' },
      { text: '出台扶持意见', performance: 1, effect: { reputation: 1 }, result: '意见出了，信心没回来。' },
      { text: '多鼓励多表彰', performance: -1, effect: { reputation: -2 }, result: '表彰了，该走的还是走了。' },
    ],
  },
  {
    title: '城市建设',
    scene: '城市框架拉得很大，但公共服务和产业跟不上。',
    options: [
      { text: '收缩战线，把资源集中到有人气的地方', performance: 3, effect: { reputation: 3, seniority: 3, integrity: 1 }, result: '三年后新城终于有了生活气。' },
      { text: '继续拉框架', performance: 1, effect: { reputation: 1 }, result: '框架更大了，人更少了。' },
      { text: '先做地标', performance: -2, effect: { reputation: -3 }, result: '地标立了，债务也上来了。' },
    ],
  },
  {
    title: '城市治理',
    scene: '城市管理长期靠运动式整治，群众不买账。',
    options: [
      { text: '把标准、责任、经费常态固化，让群众参与评价', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后不用再突击，满意率上去了。' },
      { text: '增加执法力量', performance: 1, effect: { reputation: 1 }, result: '人多了，冲突也多了。' },
      { text: '集中整治', performance: -1, effect: { reputation: -2 }, result: '整治完就回潮。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '城乡差距仍大，农村空心化在加重。',
    options: [
      { text: '以县域为单元统筹，把产业和公共服务一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '三年后一部分人开始回流。' },
      { text: '继续加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制没变。' },
      { text: '做几个示范村', performance: -1, effect: { reputation: -2 }, result: '示范村很漂亮，面上没变。' },
    ],
  },
  {
    title: '生态环境',
    scene: '环境质量改善进入瓶颈，边际效益下降。',
    options: [
      { text: '转向结构和源头治理，把标准钉死', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 1 }, result: '两年后指标又有了明显改善。' },
      { text: '继续末端治理', performance: 1, effect: { reputation: 1 }, result: '治了，改善越来越难。' },
      { text: '等上级给办法', performance: -2, effect: { reputation: -3 }, result: '等了一年，排名下滑。' },
    ],
  },
  {
    title: '流域治理',
    scene: '流域治理要跨市协调，各地投入和收益不对等。',
    options: [
      { text: '推动建立生态补偿，让保护者不吃亏', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '补偿机制落地，上下游一起动了。' },
      { text: '各自完成各自的任务', performance: 1, effect: { reputation: 1 }, result: '各自达标，整体没改善。' },
      { text: '上游先治', performance: -1, effect: { reputation: -2, network: -2 }, result: '上游不愿意，谈不下去。' },
    ],
  },
  {
    title: '民生保障',
    scene: '财政紧张，民生支出却必须保。',
    options: [
      { text: '重新排优先级，把钱花在最需要的人身上', performance: 3, effect: { reputation: 5, integrity: 2, seniority: 2 }, result: '紧日子里基本民生没出问题。' },
      { text: '各项都压一点', performance: 1, effect: { reputation: 1 }, result: '都压了，最困难的受影响最大。' },
      { text: '先保运转', performance: -2, effect: { reputation: -3 }, result: '民生欠账压不住。' },
    ],
  },
  {
    title: '教育事业',
    scene: '群众对教育的焦虑很重，优质资源不足是根本。',
    options: [
      { text: '用几年时间做实质均衡，教师交流落到人', performance: 3, effect: { reputation: 5, seniority: 3, health: -1 }, result: '五年后择校焦虑明显缓解。' },
      { text: '扩大学位供给', performance: 1, effect: { reputation: 1 }, result: '学位够了，质量差距还在。' },
      { text: '抓升学率', performance: -1, effect: { reputation: -2 }, result: '升学率上去了，负担更重。' },
    ],
  },
  {
    title: '医疗卫生',
    scene: '群众看病还是往外地跑，本地能力不足。',
    options: [
      { text: '做强几个重点专科，同时把基层能力建起来', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '三年后外转率明显下降。' },
      { text: '建新医院', performance: 1, effect: { reputation: 1 }, result: '楼起来了，人没招到。' },
      { text: '引进名医', performance: -1, effect: { reputation: -1 }, result: '名医来了又走。' },
    ],
  },
  {
    title: '就业与社保',
    scene: '结构性就业矛盾突出，社保基金压力上升。',
    options: [
      { text: '培训和岗位对接一起做，同时扩大社保覆盖面', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后就业形势稳定，基金也更稳。' },
      { text: '开发公益岗', performance: 1, effect: { reputation: 1 }, result: '岗位有限，结构问题没解。' },
      { text: '提高补贴', performance: -1, effect: { reputation: -2 }, result: '补贴涨了，基金更紧。' },
    ],
  },
  {
    title: '住房问题',
    scene: '房价高、租赁乱、保障不足，几头都压着。',
    options: [
      { text: '供给端多渠道发力，把保障对象和标准钉清楚', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '三年后住房矛盾明显缓和。' },
      { text: '调控需求端', performance: 1, effect: { reputation: 1 }, result: '压了一阵，又反弹。' },
      { text: '先保房价稳定', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '房价稳了，居住问题没解。' },
    ],
  },
  {
    title: '社会治理',
    scene: '矛盾纠纷集中在基层，化解能力却在上面。',
    options: [
      { text: '把资源和力量下沉到一线，把化解做在早', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '两年后越级上访明显减少。' },
      { text: '加强排查', performance: 1, effect: { reputation: 1 }, result: '排查了，化解不了。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '压住了一时，堆得更多。' },
    ],
  },
  {
    title: '平安建设',
    scene: '一类案件高发，群众安全感不高。',
    options: [
      { text: '打防结合，把源头治理和系统防控一起做', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后发案率大幅下降。' },
      { text: '集中打击', performance: 1, effect: { reputation: 1 }, result: '打了一阵又回来。' },
      { text: '增加警力', performance: -1, effect: { reputation: -1 }, result: '人加了，机制没变。' },
    ],
  },
  {
    title: '安全生产',
    scene: '辖区发生较大事故，社会影响很大。',
    options: [
      { text: '第一时间到场指挥，全力救援，如实上报', performance: 3, effect: { reputation: 4, integrity: 2, health: -3 }, result: '处置及时，问责时也有说法。' },
      { text: '先处置再上报', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '被认定迟报漏报。' },
      { text: '控制消息', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '瞒报被查，从重追责。' },
    ],
  },
  {
    title: '应急管理',
    scene: '一次极端天气过程，预警已经发了。',
    options: [
      { text: '提前把人撤出来，宁可十防九空', performance: 3, effect: { reputation: 5, health: -2, seniority: 1 }, result: '这次真的出事了，但没有人员伤亡。' },
      { text: '按预案响应', performance: 1, effect: { reputation: 1 }, result: '响应了，还是有薄弱环节。' },
      { text: '看情况再定', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '等到出事，已经撤不出来了。' },
    ],
  },
  {
    title: '信访稳定',
    scene: '一个群体性诉求规模大、持续时间长。',
    options: [
      { text: '亲自接访，把合理部分和政策边界一次讲清', performance: 3, effect: { reputation: 5, health: -2, seniority: 1 }, result: '签了分批方案，人群散了。' },
      { text: '包案稳控', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '稳住了，问题堆着。' },
      { text: '先压', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '压不住，事情上去。' },
    ],
  },
  {
    title: '风险防范',
    scene: '几个领域的风险交织，已经能闻到味道。',
    options: [
      { text: '建风险台账，一领域一方案，早处置', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 3, health: -2 }, result: '风险逐个拆掉，没有发生系统性事件。' },
      { text: '盯住最急的那个', performance: 1, effect: { reputation: 1 }, result: '最急的稳住了，别的爆了。' },
      { text: '等暴露再说', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '风险集中爆发，很被动。' },
    ],
  },
  {
    title: '金融风险',
    scene: '本地一家金融机构风险暴露，可能外溢。',
    options: [
      { text: '立即介入，制定处置方案并稳定预期', performance: 3, effect: { reputation: 4, integrity: 2, health: -3, seniority: 2 }, result: '风险平稳处置，没有外溢。' },
      { text: '要求机构自救', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '自救失败，风险扩大。' },
      { text: '先捂一捂', performance: -4, effect: { reputation: -6, integrity: -5 }, result: '捂不住，引发挤兑。' },
    ],
  },
  {
    title: '房地产风险',
    scene: '多家房企资金链紧张，交付压力大。',
    options: [
      { text: '逐项目建台账，分类施策并公开进度', performance: 3, effect: { reputation: 5, integrity: 3, health: -2, seniority: 2 }, result: '交付率上去，市场信心回来了一半。' },
      { text: '先救大的', performance: 1, effect: { reputation: 1 }, result: '大的稳了，小的爆了。' },
      { text: '等上级政策', performance: -2, effect: { reputation: -3 }, result: '等到政策，已经耽误了半年。' },
    ],
  },
  {
    title: '政府债务',
    scene: '债务率已经接近警戒线，还有项目要上。',
    options: [
      { text: '坚决不上新项目，把财力集中到化债', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 3 }, result: '三年后债务率降到安全区间。' },
      { text: '边化债边建设', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '两头都不够。' },
      { text: '换个方式继续借', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '隐性债务越积越多。' },
    ],
  },
  {
    title: '统计工作',
    scene: '数据不好看，下面有人开始"想办法"。',
    options: [
      { text: '明确划红线，同时把真实情况向上说清', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 2 }, result: '数据虽然难看，但没有人敢再动。' },
      { text: '不表态', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '下面的动作越来越大。' },
      { text: '默许', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计造假立案，一把手首责。' },
    ],
  },
  {
    title: '巡视整改',
    scene: '巡视反馈了一批问题，有的牵扯到人。',
    options: [
      { text: '全面认领，逐项查清，人和事一起处理', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 3 }, result: '整改扎实，评价正面。' },
      { text: '先改事，人缓缓', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '事改了，人还在，问题复发。' },
      { text: '保人', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '回头看时一起翻出。' },
    ],
  },
  {
    title: '法治建设',
    scene: '一项行政行为引发争议，可能经不起复议。',
    options: [
      { text: '请法制部门复查，错了就主动纠正', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 1 }, result: '主动纠错，公信没受影响。' },
      { text: '坚持', performance: 1, effect: { reputation: 1 }, result: '被撤销，很被动。' },
      { text: '做工作撤诉', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '撤诉的事留下了痕迹。' },
    ],
  },
  {
    title: '政府职能转变',
    scene: '政府对微观事务介入太深，市场活力不足。',
    options: [
      { text: '列负面清单，该退的坚决退，同时把监管补上', performance: 3, effect: { reputation: 3, seniority: 3, network: 2 }, result: '退到位后，市场反而活了。' },
      { text: '减少审批事项', performance: 1, effect: { reputation: 1 }, result: '事项少了，变相审批还在。' },
      { text: '加强服务', performance: -1, effect: { reputation: -1 }, result: '服务加强了，还是管得多。' },
    ],
  },
  {
    title: '数字政府',
    scene: '要建城市大脑，投入不小，最怕建成摆设。',
    options: [
      { text: '先解决几个真场景，用起来再扩', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '第一批场景见效后，推广很顺。' },
      { text: '一次建全', performance: 1, effect: { reputation: 1 }, result: '建完了，没人用。' },
      { text: '先建大屏', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '大屏很漂亮，数据不更新。' },
    ],
  },
  {
    title: '督查检查',
    scene: '基层反映督查太多，迎检成了主要工作。',
    options: [
      { text: '先从市委市政府自身砍起，合并同类项', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '砍掉四成后，基层松了一口气。' },
      { text: '规范督查程序', performance: 1, effect: { reputation: 1 }, result: '规范了，数量没减。' },
      { text: '照旧', performance: -1, effect: { reputation: -2 }, result: '基层继续应付。' },
    ],
  },
  {
    title: '基层减负',
    scene: '报表、证明、app 打卡，基层不堪其扰。',
    options: [
      { text: '拉清单逐项清理，删掉一半并公开', performance: 3, effect: { reputation: 5, seniority: 2 }, result: '清理后基层腾出了手，干实事的时间多了。' },
      { text: '要求减少', performance: 1, effect: { reputation: 1 }, result: '要求提了，没人真删。' },
      { text: '先统计', performance: -1, effect: { reputation: -2 }, result: '统计本身又成了负担。' },
    ],
  },
  {
    title: '对外合作',
    scene: '一次重要的对外合作，条件谈得差不多，但对方要求排他。',
    options: [
      { text: '不排他，把合作做成开放的', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '合作成了，别的伙伴也进来了。' },
      { text: '答应排他', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '答应了，被别的伙伴疏远。' },
      { text: '拖着不决', performance: -1, effect: { reputation: -2 }, result: '对方找了别的地方。' },
    ],
  },
  {
    title: '区域协同',
    scene: '都市圈内部各自为政，要素流动不畅。',
    options: [
      { text: '从最容易见效的公共服务一体化切入', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '一体化有了实感，深水区也好谈了。' },
      { text: '先签框架', performance: 1, effect: { reputation: 1 }, result: '签了很多，落不了地。' },
      { text: '只做对自己有利的', performance: -2, effect: { reputation: -3, network: -3 }, result: '别人也不带你了。' },
    ],
  },
  {
    title: '对口合作',
    scene: '对口合作关系要深化，不能只停留在走访。',
    options: [
      { text: '找产业互补点，做成能造血的长期合作', performance: 3, effect: { reputation: 3, network: 3, seniority: 2 }, result: '合作落地，两边都有收益。' },
      { text: '按要求完成任务', performance: 1, effect: { reputation: 1 }, result: '任务完成了，没有后劲。' },
      { text: '给点资金了事', performance: -2, effect: { reputation: -3 }, result: '钱给了，事情没变。' },
    ],
  },
  {
    title: '重大突发事件',
    scene: '辖区发生重大突发事件，情况还在变化。',
    options: [
      { text: '立即到一线成立指挥部，救人优先，同步如实上报', performance: 3, effect: { reputation: 5, health: -4, seniority: 2, integrity: 2 }, result: '处置有序，损失降到最低。' },
      { text: '在指挥中心调度', performance: 1, effect: { reputation: 1 }, result: '调度了，一线缺主心骨。' },
      { text: '等完整信息再动', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '错过窗口，后果严重。' },
    ],
  },
  {
    title: '舆情应对',
    scene: '一件事演变成全国性舆情，矛头指向这座城市。',
    options: [
      { text: '主动发声，说清事实、表明态度、给出时间表', performance: 3, effect: { reputation: 5, health: -3, integrity: 1 }, result: '一周后舆论转向，处置被评为得当。' },
      { text: '等上级口径', performance: 1, effect: { reputation: 1 }, result: '等到了口径，话题已经换了几轮。' },
      { text: '找渠道压热度', performance: -4, effect: { reputation: -6, integrity: -5 }, result: '压热度本身成了新的话题。' },
    ],
  },
  {
    title: '上级调研',
    scene: '上级主要领导要来，点名要听真话。',
    options: [
      { text: '照实汇报，把困难和请求一起说', performance: 3, effect: { reputation: 5, seniority: 3, integrity: 1 }, result: '领导当场给了支持，还记住了这座城市。' },
      { text: '重点汇报成绩', performance: 1, effect: { reputation: 1 }, result: '汇报完了，什么也没争取到。' },
      { text: '精心准备看点', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '领导临时改路线，很难看。' },
    ],
  },
  {
    title: '班子建设',
    scene: '班子整体不错，但有两件事上分歧公开化了。',
    options: [
      { text: '把分歧摆到桌面上，按规则形成决议后一致执行', performance: 3, effect: { reputation: 4, network: 3, seniority: 3 }, result: '分歧处理完，班子更紧密了。' },
      { text: '分别做工作', performance: 1, effect: { reputation: 1 }, result: '工作做了，分歧没消除。' },
      { text: '回避分歧', performance: -1, effect: { reputation: -2 }, result: '分歧越积越深。' },
    ],
  },
  {
    title: '离任交接',
    scene: '要离开这座城市了，有些事还没做完。',
    options: [
      { text: '把没做完的事、埋下的风险一样样交给接任者', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 2 }, result: '离任多年，这里的人还记得你。' },
      { text: '按程序交接', performance: 1, effect: { reputation: 1 }, result: '交接了，几件事后来爆了。' },
      { text: '只讲成绩', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '接任者吃了暗亏，话说得很难听。' },
    ],
  },
];

},
"game/rank-events/rank-09": function(module, exports, require) {
// 职级 9 · 省部级副职（副部级）
//
// 权力边界：统筹全省一条线。主要工作不再是办具体事，而是定规则、配资源、
// 建机制、抓落实。题目围绕"制度设计与全省尺度的取舍"。
// 50 道。

module.exports = [
  {
    title: '分管领域',
    scene: '分工下来，你分管一条覆盖全省、横跨十几个部门的线。',
    options: [
      { text: '先跑一圈市县，把省情和市情的差距摸清楚', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '半年后出台的政策，落地率明显高。' },
      { text: '先听部门汇报', performance: 1, effect: { reputation: 1 }, result: '听到了省级视角，基层视角没有。' },
      { text: '沿用原有政策框架', performance: -1, effect: { reputation: -2 }, result: '沿用了，问题也沿用了。' },
    ],
  },
  {
    title: '首次常务会',
    scene: '第一次上省政府常务会，议题是你分管领域的。',
    options: [
      { text: '会前把各方意见都谈过，把风险点想全', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '议题一次通过，也没有后遗症。' },
      { text: '会上解释', performance: 1, effect: { reputation: 1 }, result: '解释了，被要求补充论证。' },
      { text: '请主要领导定', performance: -1, effect: { reputation: -2 }, result: '定了，部门心里不服。' },
    ],
  },
  {
    title: '全省布局',
    scene: '一条产业线在全省怎么摆，各市都在争。',
    options: [
      { text: '按资源禀赋和环境容量定布局，配套差异化考核', performance: 3, effect: { reputation: 4, seniority: 4, network: 2 }, result: '五年后没有出现全省性过剩。' },
      { text: '让各市竞争', performance: 1, effect: { reputation: 1 }, result: '竞争的结果是遍地开花、普遍不强。' },
      { text: '集中在省会', performance: -2, effect: { reputation: -3, network: -3 }, result: '别的地方从此不配合。' },
    ],
  },
  {
    title: '政策制定',
    scene: '要出台一项全省性政策，各地情况差别很大。',
    options: [
      { text: '给原则和目标，给地方留足因地制宜的空间', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '政策落地后，各地都找到了自己的做法。' },
      { text: '全省一刀切', performance: 1, effect: { reputation: 1 }, result: '切了，一半地方执行不了。' },
      { text: '写得很原则', performance: -1, effect: { reputation: -2 }, result: '文件发了，没人知道怎么干。' },
    ],
  },
  {
    title: '制度设计',
    scene: '一个老大难问题，根子上是机制没理顺。',
    options: [
      { text: '从权责和激励两头改，把机制先建起来', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '机制一顺，问题自己就少了。' },
      { text: '加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制还是那样。' },
      { text: '加强考核', performance: -1, effect: { reputation: -2 }, result: '考核多了，数据好看了。' },
    ],
  },
  {
    title: '重大改革',
    scene: '一项改革涉及多方利益，牵一发动全身。',
    options: [
      { text: '先选不同类型的地方试点，再提炼推开', performance: 3, effect: { reputation: 5, seniority: 4, health: -2 }, result: '两年后全面推开，没有大的震荡。' },
      { text: '全省一次推开', performance: 1, effect: { reputation: 1, network: -1 }, result: '推开了，反弹很厉害。' },
      { text: '先出方案', performance: -1, effect: { reputation: -2 }, result: '方案出了一年，没动。' },
    ],
  },
  {
    title: '跨市协调',
    scene: '一件跨市的事，各方都想少出钱多受益。',
    options: [
      { text: '先把成本收益算清，按受益比例定分担', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '分担机制一定，事就推得动了。' },
      { text: '省级兜底', performance: 1, effect: { reputation: 1 }, result: '兜了底，地方以后都往上推。' },
      { text: '让各地协商', performance: -1, effect: { reputation: -2 }, result: '协商了两年没结果。' },
    ],
  },
  {
    title: '要素配置',
    scene: '土地、能耗、资金都紧，好项目等不起。',
    options: [
      { text: '建全省统一的要素配置规则和优先级', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 3 }, result: '要素流动起来，好项目不再排队。' },
      { text: '谁急给谁', performance: 1, effect: { reputation: 1 }, result: '给了，事后常有争议。' },
      { text: '平均分配', performance: -2, effect: { reputation: -3 }, result: '谁都不够用。' },
    ],
  },
  {
    title: '重大基础设施',
    scene: '一个跨区域重大工程，投资大、周期长、争议多。',
    options: [
      { text: '做全周期论证，把反对意见写进决策材料', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 1 }, result: '十年后看，这个工程改变了格局。' },
      { text: '分段实施', performance: 1, effect: { reputation: 1 }, result: '分段做了，效益打折。' },
      { text: '先做争议小的', performance: -1, effect: { reputation: -2 }, result: '关键那一段一直卡着。' },
    ],
  },
  {
    title: '产业规划',
    scene: '要定全省的主导产业方向，几个方向都有道理。',
    options: [
      { text: '做扎实的比较研究，收敛到两三个方向长期投入', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '五年后这几个方向真成了气候。' },
      { text: '都列为重点', performance: 1, effect: { reputation: 1 }, result: '重点太多等于没有重点。' },
      { text: '跟着热点走', performance: -2, effect: { reputation: -3 }, result: '热点一过，留下的是过剩。' },
    ],
  },
  {
    title: '科技创新体系',
    scene: '全省创新资源分散，成果转化不畅。',
    options: [
      { text: '重构平台体系，让企业出题、全省答题', performance: 3, effect: { reputation: 4, seniority: 4, network: 2 }, result: '五年后转化率明显提高。' },
      { text: '增加财政投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，产出分散。' },
      { text: '引进大院大所', performance: -1, effect: { reputation: -2 }, result: '牌子挂了，跟产业没关系。' },
    ],
  },
  {
    title: '人才工作',
    scene: '各地抢人，政策层层加码，效果越来越差。',
    options: [
      { text: '省级统筹，按产业需求定清单，避免内耗', performance: 3, effect: { reputation: 4, seniority: 3, network: 3 }, result: '三年后人才结构与产业更匹配。' },
      { text: '加大补贴力度', performance: 1, effect: { reputation: 1 }, result: '补贴涨了，人还是留不住。' },
      { text: '各地各抢各的', performance: -2, effect: { reputation: -3, network: -2 }, result: '内耗严重，财政白花。' },
    ],
  },
  {
    title: '对外开放',
    scene: '开放平台不少，但能级不高、联动不够。',
    options: [
      { text: '整合平台功能，打通口岸与产业的联系', performance: 3, effect: { reputation: 4, seniority: 3, network: 3 }, result: '三年后外贸结构明显优化。' },
      { text: '再建新平台', performance: 1, effect: { reputation: 1 }, result: '平台更多了，还是散。' },
      { text: '给更多优惠', performance: -1, effect: { reputation: -2 }, result: '优惠给了，能级没提升。' },
    ],
  },
  {
    title: '招商引资',
    scene: '全省招商各自为战，甚至互相挖项目。',
    options: [
      { text: '建全省招商信息平台和流转机制', performance: 3, effect: { reputation: 3, seniority: 3, network: 3 }, result: '内耗没了，落地率提高。' },
      { text: '下达指标', performance: 1, effect: { reputation: 1 }, result: '指标完成了，质量下降。' },
      { text: '谁招到算谁的', performance: -2, effect: { reputation: -3, network: -2 }, result: '挖得更厉害了。' },
    ],
  },
  {
    title: '营商环境',
    scene: '全省营商环境评价靠后，企业反映最集中的是执法不公。',
    options: [
      { text: '从规范执法和兑现承诺两头改，全省统一标准', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3 }, result: '三年后排名大幅前移。' },
      { text: '出台政策包', performance: 1, effect: { reputation: 1 }, result: '政策包发了，感受没变。' },
      { text: '抓评价应对', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '名次上去了，企业还在跑。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营投资意愿不足，信心问题是关键。',
    options: [
      { text: '清理拖欠账款和旧账，给稳定预期', performance: 3, effect: { reputation: 5, network: 4, seniority: 3 }, result: '清完之后，投资开始回暖。' },
      { text: '出台扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，信心没回来。' },
      { text: '多开座谈会', performance: -1, effect: { reputation: -2 }, result: '会开了，问题还是那些问题。' },
    ],
  },
  {
    title: '国资国企',
    scene: '省属国企布局分散，主业不聚焦。',
    options: [
      { text: '按功能分类重组，该退的退、该强的强', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '三年后省属国企整体竞争力提升。' },
      { text: '换一批负责人', performance: 1, effect: { reputation: 1 }, result: '人换了，布局没变。' },
      { text: '继续做大规模', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '规模上去了，效益下来了。' },
    ],
  },
  {
    title: '金融工作',
    scene: '实体经济融资难和资金空转并存。',
    options: [
      { text: '建信用和担保体系，把资金引向实体', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 1 }, result: '三年后融资结构和成本都改善了。' },
      { text: '要求加大投放', performance: 1, effect: { reputation: 1 }, result: '投放涨了，不良也涨了。' },
      { text: '给贴息', performance: -1, effect: { reputation: -2 }, result: '贴息花了，覆盖面很小。' },
    ],
  },
  {
    title: '财政体制',
    scene: '省以下财政体制不顺，基层事权多、财力少。',
    options: [
      { text: '重新划分事权支出责任，把财力下沉', performance: 3, effect: { reputation: 4, seniority: 4, network: 2 }, result: '调整后基层运转明显好转。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '转移支付涨了，机制没变。' },
      { text: '让基层自己想办法', performance: -2, effect: { reputation: -3 }, result: '基层开始想办法弄钱。' },
    ],
  },
  {
    title: '财税体制',
    scene: '要落实一项减税政策，财政减收压力很大。',
    options: [
      { text: '不折不扣落实，同时压一般性支出腾空间', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 2 }, result: '政策落了地，企业有实感。' },
      { text: '落实但留个口子', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '口子一开，企业感受打折。' },
      { text: '先收着，看情况再说', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被督查发现，很被动。' },
    ],
  },
  {
    title: '农业农村',
    scene: '农业大省不强，农民增收乏力。',
    options: [
      { text: '从加工、品牌、联农机制三头一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '五年后几个产业真正立住了。' },
      { text: '加大补贴', performance: 1, effect: { reputation: 1 }, result: '补贴涨了，竞争力没变。' },
      { text: '扩大规模', performance: -1, effect: { reputation: -2 }, result: '规模上去了，价格下来了。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '要扛稳粮食安全责任，与结构调整有张力。',
    options: [
      { text: '保面积保产能，在技术和收益上做文章', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 2 }, result: '面积产量双保，农民收益也上去了。' },
      { text: '下指标', performance: 1, effect: { reputation: 1 }, result: '指标下了，落实打折扣。' },
      { text: '在数字上做文章', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '核查时被发现。' },
    ],
  },
  {
    title: '生态环保',
    scene: '督察反馈了一批问题，有的牵扯到发展模式。',
    options: [
      { text: '照单全收，从结构上转、从源头上治', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 3 }, result: '三年后环境质量明显改善。' },
      { text: '逐个整改', performance: 1, effect: { reputation: 1 }, result: '整改了，还会再出现。' },
      { text: '边改边说明困难', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被认为整改不坚决。' },
    ],
  },
  {
    title: '双碳工作',
    scene: '降碳目标和能源安全、经济增长相互牵制。',
    options: [
      { text: '先立后破，把新能源和储能先建起来', performance: 3, effect: { reputation: 4, seniority: 4, health: -1 }, result: '五年后能源结构明显优化。' },
      { text: '压高耗能项目', performance: 1, effect: { reputation: 1 }, result: '压了，增长也下来了。' },
      { text: '运动式减碳', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '限电停产，影响很大。' },
    ],
  },
  {
    title: '能源安全',
    scene: '用电高峰缺口大，供应侧一时补不上。',
    options: [
      { text: '供需两侧一起做，先保民生，把需求响应机制建起来', performance: 3, effect: { reputation: 4, seniority: 3, health: -2 }, result: '平稳度峰，没有拉闸限电。' },
      { text: '向上争取指标', performance: 1, effect: { reputation: 1 }, result: '争取到一点，缺口还在。' },
      { text: '有序用电', performance: -2, effect: { reputation: -3 }, result: '限了电，企业意见很大。' },
    ],
  },
  {
    title: '交通运输',
    scene: '综合交通体系有短板，几种方式衔接不畅。',
    options: [
      { text: '从枢纽和衔接入手，把多式联运做起来', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '三年后物流成本明显下降。' },
      { text: '多修路', performance: 1, effect: { reputation: 1 }, result: '路更多了，衔接还是断的。' },
      { text: '先建大项目', performance: -1, effect: { reputation: -2 }, result: '项目建了，用不起来。' },
    ],
  },
  {
    title: '水利建设',
    scene: '水灾害、水资源、水生态三件事都要办。',
    options: [
      { text: '按风险排序，除险加固优先，同步做节水', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '那年汛期平稳，用水也更稳。' },
      { text: '全面铺开', performance: 1, effect: { reputation: 1 }, result: '铺开了，资金跟不上。' },
      { text: '先做景观', performance: -2, effect: { reputation: -3 }, result: '景观漂亮，隐患还在。' },
    ],
  },
  {
    title: '教育事业',
    scene: '高等教育与产业需求脱节，职业教育认可度低。',
    options: [
      { text: '调整学科专业结构，把产教融合做实', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '五年后毕业生本地就业率明显上升。' },
      { text: '扩大招生规模', performance: 1, effect: { reputation: 1 }, result: '规模上去了，就业更难。' },
      { text: '集中资源办一两所名校', performance: -1, effect: { reputation: -2 }, result: '名校强了，整体没变。' },
    ],
  },
  {
    title: '卫生健康',
    scene: '优质医疗资源集中在大城市，基层薄弱。',
    options: [
      { text: '建国家区域医疗中心，同时强基层、做分级', performance: 3, effect: { reputation: 5, seniority: 3, network: 2 }, result: '五年后外转率明显下降。' },
      { text: '扩建大医院', performance: 1, effect: { reputation: 1 }, result: '大医院更大，基层更弱。' },
      { text: '引进专家', performance: -1, effect: { reputation: -1 }, result: '专家来了又走。' },
    ],
  },
  {
    title: '社会保障',
    scene: '基金可持续压力上升，覆盖面也有缺口。',
    options: [
      { text: '扩面征缴与制度改革并举，把缺口补上', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 1 }, result: '五年后基金运行更稳。' },
      { text: '提高补助', performance: 1, effect: { reputation: 1 }, result: '补助涨了，缺口更大。' },
      { text: '等中央政策', performance: -1, effect: { reputation: -2 }, result: '等了一年，什么也没变。' },
    ],
  },
  {
    title: '就业优先',
    scene: '总量压力和结构性矛盾并存。',
    options: [
      { text: '把培训跟着岗位走，重点群体一对一帮扶', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后重点群体就业明显改善。' },
      { text: '扩大培训规模', performance: 1, effect: { reputation: 1 }, result: '培训了很多，用不上。' },
      { text: '开发公益岗', performance: -1, effect: { reputation: -2 }, result: '岗位有限，结构问题没解。' },
    ],
  },
  {
    title: '住房制度',
    scene: '要解决大城市住房突出问题，思路分歧大。',
    options: [
      { text: '租购并举，把保障性供给和租赁规范一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '五年后新市民住房压力明显缓解。' },
      { text: '多建保障房', performance: 1, effect: { reputation: 1 }, result: '建了，位置和配套不理想。' },
      { text: '稳定房价优先', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '房价稳了，居住问题没解。' },
    ],
  },
  {
    title: '文化旅游',
    scene: '文化资源丰富，但转化不足、消费不旺。',
    options: [
      { text: '抓内容和服务，把资源变成产品', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '三年后文旅收入结构明显改善。' },
      { text: '加大宣传', performance: 1, effect: { reputation: 1 }, result: '人来了，留不住。' },
      { text: '建大项目', performance: -1, effect: { reputation: -2 }, result: '项目建了，客流撑不住。' },
    ],
  },
  {
    title: '体育事业',
    scene: '竞技与群众体育失衡，场地设施不足。',
    options: [
      { text: '把场地补到群众身边，竞技与普及分开算账', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '五年后经常锻炼人口明显增加。' },
      { text: '集中资源抓竞技', performance: 1, effect: { reputation: 1 }, result: '奖牌有了，群众没受益。' },
      { text: '建大型场馆', performance: -1, effect: { reputation: -2 }, result: '场馆建了，日常闲置。' },
    ],
  },
  {
    title: '社会治理',
    scene: '矛盾集中在基层，化解资源在上面。',
    options: [
      { text: '资源下沉，把化解力量放到一线', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '三年后越级上访明显减少。' },
      { text: '加强排查', performance: 1, effect: { reputation: 1 }, result: '排查了，化解不了。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '压住一时，堆得更多。' },
    ],
  },
  {
    title: '平安建设',
    scene: '一类违法犯罪呈组织化趋势，群众反映强烈。',
    options: [
      { text: '依法严打与源头治理结合，交政法机关办、不干预个案', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '两年后治安形势明显好转。' },
      { text: '集中打击', performance: 1, effect: { reputation: 1 }, result: '打了一阵又回来。' },
      { text: '打打招呼保一下', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '打招呼的事，后患无穷。' },
    ],
  },
  {
    title: '安全生产',
    scene: '这条线事故多发，根子在主体责任不落实。',
    options: [
      { text: '把责任体系、标准体系和排查机制一起立起来', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '三年后事故起数大幅下降。' },
      { text: '开展专项整治', performance: 1, effect: { reputation: 1 }, result: '整治完又回来。' },
      { text: '以追责推动', performance: -1, effect: { reputation: -2, network: -1 }, result: '追责了，开始瞒报。' },
    ],
  },
  {
    title: '应急体系',
    scene: '一次事件暴露出全省应急体系响应慢、协同差。',
    options: [
      { text: '重构指挥和预案体系，搞实战化演练', performance: 3, effect: { reputation: 4, seniority: 3, health: -2 }, result: '下一次实战中响应明显更快。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案厚了，没人翻。' },
      { text: '配装备', performance: -1, effect: { reputation: -1 }, result: '装备有了，人不会用。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '极端天气频发，全省防灾能力参差不齐。',
    options: [
      { text: '按风险区划分类施策，把预警到响应的链条打通', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '下一次极端天气损失明显减小。' },
      { text: '加强值班值守', performance: 1, effect: { reputation: 1 }, result: '值班加强了，流程不清。' },
      { text: '事后救灾', performance: -2, effect: { reputation: -3 }, result: '救了灾，损失已经造成。' },
    ],
  },
  {
    title: '信访工作',
    scene: '一批跨地区跨部门的积案，多年没有化解。',
    options: [
      { text: '逐案明确责任主体和时限，公开督办', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '两年后积案化解过半。' },
      { text: '交办下去', performance: 1, effect: { reputation: 1 }, result: '交办了，转一圈又回来。' },
      { text: '稳住就行', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '问题越积越多。' },
    ],
  },
  {
    title: '法治建设',
    scene: '全省一批行政行为在复议诉讼中败诉。',
    options: [
      { text: '从败诉案件倒查制度，把程序和裁量规范起来', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 3 }, result: '两年后败诉率大幅下降。' },
      { text: '要求各地重视', performance: 1, effect: { reputation: 1 }, result: '重视了，还是照旧出错。' },
      { text: '协调一下', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '协调的事留下了记录。' },
    ],
  },
  {
    title: '统计工作',
    scene: '有迹象表明个别地方数据不实。',
    options: [
      { text: '立即组织核查，发现一起查处一起', performance: 3, effect: { reputation: 3, integrity: 5, seniority: 2 }, result: '查处之后，全省风气为之一正。' },
      { text: '要求自查自纠', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '自查结果全部合格。' },
      { text: '压着不查', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '被上级督查发现，一并追责。' },
    ],
  },
  {
    title: '审计监督',
    scene: '审计发现一条资金链上有系统性问题。',
    options: [
      { text: '全面整改并建长效机制，结果公开', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 2 }, result: '机制建起来后，同类问题基本消失。' },
      { text: '要求逐个整改', performance: 1, effect: { reputation: 1 }, result: '整改了，还会再犯。' },
      { text: '控制影响范围', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被公开通报。' },
    ],
  },
  {
    title: '政务服务',
    scene: '全省政务服务标准不一，跨市通办推不动。',
    options: [
      { text: '统一事项标准和平台，先打通高频事项', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '一年后高频事项全部跨市通办。' },
      { text: '各地自建', performance: 1, effect: { reputation: 1 }, result: '各自建了，互不相通。' },
      { text: '先建大厅', performance: -1, effect: { reputation: -1 }, result: '大厅漂亮，流程没变。' },
    ],
  },
  {
    title: '数字建设',
    scene: '要建全省一体化平台，最怕建成空壳。',
    options: [
      { text: '先立共享的硬规矩，从高频场景切入', performance: 3, effect: { reputation: 3, seniority: 4 }, result: '平台真用起来了，应用也多了。' },
      { text: '一次建全', performance: 1, effect: { reputation: 1 }, result: '建完了，没人用。' },
      { text: '先建大屏', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '大屏漂亮，数据不更新。' },
    ],
  },
  {
    title: '督查激励',
    scene: '很多部署落不下去，督查也督查不动。',
    options: [
      { text: '督查与激励并重，把干得好的地方树起来', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '一年后落实情况明显好转。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '区域协调',
    scene: '省内区域差距在拉大，协调机制不灵。',
    options: [
      { text: '分类施策，先补最短板，同时建利益共享机制', performance: 3, effect: { reputation: 4, seniority: 4, network: 3 }, result: '五年后区域差距开始收敛。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '钱给了，机制没变。' },
      { text: '让强的带弱的', performance: -1, effect: { reputation: -2 }, result: '带了一阵，没有动力。' },
    ],
  },
  {
    title: '对口支援',
    scene: '对口支援要做实，不能只停留在资金。',
    options: [
      { text: '做成产业协作和人才交流，留下带不走的能力', performance: 3, effect: { reputation: 4, network: 3, seniority: 3 }, result: '几年后对方有了自己的产业。' },
      { text: '按任务完成', performance: 1, effect: { reputation: 1 }, result: '任务完成了，没有后劲。' },
      { text: '给钱了事', performance: -2, effect: { reputation: -3 }, result: '钱给了，能力没留下。' },
    ],
  },
  {
    title: '突发事件',
    scene: '省内发生重大突发事件，多个市受影响。',
    options: [
      { text: '第一时间到一线，靠前指挥，边处置边上报', performance: 3, effect: { reputation: 5, health: -4, seniority: 3, integrity: 2 }, result: '处置有序，损失降到最低。' },
      { text: '在指挥中心调度', performance: 1, effect: { reputation: 1 }, result: '调度了，一线缺主心骨。' },
      { text: '等信息完整再动', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '错过窗口，后果严重。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你分管的领域资金密集、审批权集中。',
    options: [
      { text: '把流程公开、把权限分散、把留痕做实，自己带头回避', performance: 3, effect: { reputation: 3, integrity: 5, seniority: 3 }, result: '这条线多年没有出问题。' },
      { text: '加强教育提醒', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '提醒了，机制没变。' },
      { text: '相信干部自觉', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '出事时，你是分管领导。' },
    ],
  },
];

},
"game/rank-events/rank-10": function(module, exports, require) {
// 职级 10 · 省部级正职（正部级）
//
// 权力边界：主政一省或一部。定全局、用干部、守底线。所有重大问题最终都要
// 在你这里定调。题目围绕"全局判断、底线意识与长久之功"。
// 50 道。

module.exports = [
  {
    title: '主政一省',
    scene: '到任之初，摆在你面前的是一份成绩单和一份问题清单。',
    options: [
      { text: '用三个月跑遍所有市州，把问题清单自己核一遍', performance: 3, effect: { reputation: 5, seniority: 4 }, result: '三个月后提出的思路，让全省上下心里有数。' },
      { text: '先听班子和部门汇报', performance: 1, effect: { reputation: 1 }, result: '听到了一套说法，还有几套没听到。' },
      { text: '沿用原有格局', performance: -1, effect: { reputation: -2 }, result: '格局沿用下来了，也没打开新局。' },
    ],
  },
  {
    title: '全省战略',
    scene: '要定未来五到十年的全省战略，几种意见相持不下。',
    options: [
      { text: '做扎实的省情再认识，把战略收敛到几条硬任务', performance: 3, effect: { reputation: 5, seniority: 5 }, result: '五年后回头看，这几条都落了地。' },
      { text: '折中各家意见', performance: 1, effect: { reputation: 1 }, result: '什么都写了，什么都没抓实。' },
      { text: '提出一个新提法', performance: -1, effect: { reputation: -2 }, result: '提法响了，事还是那些事。' },
    ],
  },
  {
    title: '省委全会',
    scene: '全会要通过一个影响深远的决定，会前争议不小。',
    options: [
      { text: '把争议充分摆开，形成共识后再上会', performance: 3, effect: { reputation: 4, seniority: 4, network: 3 }, result: '决定通过得很顺，执行也坚决。' },
      { text: '先把稿子磨好', performance: 1, effect: { reputation: 1 }, result: '稿子很好，共识没有形成。' },
      { text: '依靠表决通过', performance: -1, effect: { reputation: -2, network: -2 }, result: '通过了，执行中处处打折。' },
    ],
  },
  {
    title: '贯彻中央部署',
    scene: '中央有一项重大部署要落地，省情与之有落差。',
    options: [
      { text: '吃透精神，结合省情拿出可操作方案', performance: 3, effect: { reputation: 5, seniority: 4, integrity: 1 }, result: '结合得好，被作为经验推广。' },
      { text: '照搬照转', performance: 1, effect: { reputation: 1 }, result: '转下去了，基层不知道怎么干。' },
      { text: '选择性落实', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '督查时被发现落实不到位。' },
    ],
  },
  {
    title: '经济工作',
    scene: '经济下行压力大，既要稳增长又要防风险。',
    options: [
      { text: '把力气下在市场主体上，目标实事求是', performance: 3, effect: { reputation: 5, seniority: 3, integrity: 2 }, result: '当年不算亮眼，两年后反超。' },
      { text: '全力稳增长', performance: 1, effect: { reputation: 1, health: -1 }, result: '增速保住了，风险积累。' },
      { text: '在数字上想办法', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计造假被查，一把手首责。' },
    ],
  },
  {
    title: '高质量发展',
    scene: '要转到高质量发展上来，短期代价不小。',
    options: [
      { text: '明确取舍，把资源压到创新和质量上', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 1 }, result: '五年后结构明显优化。' },
      { text: '边转边看', performance: 1, effect: { reputation: 1 }, result: '转了几年，结构没变。' },
      { text: '先保速度', performance: -2, effect: { reputation: -3 }, result: '速度保住了，问题更重。' },
    ],
  },
  {
    title: '财政与债务',
    scene: '财政紧平衡，债务风险在积累。',
    options: [
      { text: '坚决遏制新增，用几年时间把存量降下来', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 4, health: -2 }, result: '五年后风险等级明显下降。' },
      { text: '边化债边发展', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '两头都不够。' },
      { text: '换个马甲继续借', performance: -4, effect: { reputation: -5, integrity: -5 }, result: '隐性债务越积越多。' },
    ],
  },
  {
    title: '营商环境',
    scene: '企业反映最集中的是"新官不理旧账"和执法不公。',
    options: [
      { text: '全省专项清理，把兑现和执法规范纳入硬约束', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3 }, result: '三年后投资信心明显恢复。' },
      { text: '出台新优惠政策', performance: 1, effect: { reputation: 1 }, result: '新政策出了，旧账还是没人认。' },
      { text: '强调诚信建设', performance: -1, effect: { reputation: -2 }, result: '强调完了，欠账还在。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营企业家信心不足，投资意愿下降。',
    options: [
      { text: '坦诚座谈，解决一批具体问题并公开结果', performance: 3, effect: { reputation: 5, network: 5, seniority: 3 }, result: '半年后投资开始回暖。' },
      { text: '出台扶持意见', performance: 1, effect: { reputation: 1 }, result: '意见出了，信心没回来。' },
      { text: '多表彰多鼓励', performance: -1, effect: { reputation: -2 }, result: '表彰了，该走的还是走了。' },
    ],
  },
  {
    title: '国资国企',
    scene: '省属国企大而不强，布局分散。',
    options: [
      { text: '按功能分类重组，主业聚焦，机制转换跟上', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '五年后整体竞争力明显提升。' },
      { text: '换一批负责人', performance: 1, effect: { reputation: 1 }, result: '人换了，布局没变。' },
      { text: '先做大', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '规模上去了，效益下来了。' },
    ],
  },
  {
    title: '金融风险',
    scene: '省内金融风险点多面广，有外溢迹象。',
    options: [
      { text: '建省级协调机制，早识别早处置，稳住预期', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3, health: -2 }, result: '风险逐个拆掉，没有发生系统性事件。' },
      { text: '盯住最紧迫的', performance: 1, effect: { reputation: 1 }, result: '最急的稳了，别的爆了。' },
      { text: '捂一捂', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '捂不住，风险集中爆发。' },
    ],
  },
  {
    title: '地方债风险',
    scene: '部分市县债务率已过高，还在上项目。',
    options: [
      { text: '坚决刹车，把化债作为硬约束纳入考核', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 4 }, result: '五年后高风险地区明显减少。' },
      { text: '谁家孩子谁抱走', performance: 1, effect: { reputation: 1 }, result: '抱不动的还是往上推。' },
      { text: '省里兜底', performance: -2, effect: { reputation: -2, integrity: -2 }, result: '兜了一次，后面都来要。' },
    ],
  },
  {
    title: '房地产市场',
    scene: '市场深度调整，交付压力和市场信心相互拖累。',
    options: [
      { text: '控增量、去库存、保交付、防风险一体推进', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3, health: -2 }, result: '三年后市场趋于平稳。' },
      { text: '先救一批大的', performance: 1, effect: { reputation: 1 }, result: '大的稳了，小的爆了。' },
      { text: '等政策', performance: -2, effect: { reputation: -3 }, result: '等到政策，已经耽误了大半年。' },
    ],
  },
  {
    title: '重大项目',
    scene: '一个影响全省格局的重大项目，论证有正反两面。',
    options: [
      { text: '把反对意见充分论证后再定，一旦定了就坚持', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 1 }, result: '十年后看，这一步很关键。' },
      { text: '先上再补论证', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '上了一半发现问题。' },
      { text: '久拖不决', performance: -2, effect: { reputation: -3 }, result: '窗口关了，机会没了。' },
    ],
  },
  {
    title: '基础设施',
    scene: '基础设施仍有短板，但投资空间在收窄。',
    options: [
      { text: '按效益排序，把钱花在能改变格局的地方', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '五年后关键瓶颈打通了。' },
      { text: '全面铺开', performance: 1, effect: { reputation: 1 }, result: '铺开了，效益普遍不高。' },
      { text: '先做看得见的', performance: -2, effect: { reputation: -3 }, result: '看得见的做了，瓶颈还在。' },
    ],
  },
  {
    title: '产业体系',
    scene: '产业体系大而不强，关键环节受制于人。',
    options: [
      { text: '聚焦几条链，一链一策补关键环节', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '五年后几条链真正站稳了。' },
      { text: '全面扶持', performance: 1, effect: { reputation: 1 }, result: '都扶了，都不强。' },
      { text: '引进大项目', performance: -1, effect: { reputation: -2 }, result: '项目来了，根扎不下去。' },
    ],
  },
  {
    title: '科技创新',
    scene: '创新资源不少，但转化不畅、协同不够。',
    options: [
      { text: '重构平台与机制，让企业出题、全省答题', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后创新对增长的支撑明显增强。' },
      { text: '加大财政投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，产出分散。' },
      { text: '引进大院大所', performance: -1, effect: { reputation: -2 }, result: '牌子挂了，跟产业没关系。' },
    ],
  },
  {
    title: '人才强省',
    scene: '人才引不进、留不住，各地政策互相抬高。',
    options: [
      { text: '省级统筹，按产业定清单，把舞台和生态做好', performance: 3, effect: { reputation: 4, seniority: 4, network: 4 }, result: '五年后人才净流入态势形成。' },
      { text: '加大补贴', performance: 1, effect: { reputation: 1 }, result: '补贴涨了，人还是留不住。' },
      { text: '各地各抢各的', performance: -2, effect: { reputation: -3, network: -2 }, result: '内耗严重，财政白花。' },
    ],
  },
  {
    title: '改革开放',
    scene: '一项改革牵动全省利益格局，阻力很大。',
    options: [
      { text: '先试点后推开，把利益调整方案一起做出来', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '两年后全面推开，没有大的震荡。' },
      { text: '强力推开', performance: 1, effect: { reputation: 1, network: -2 }, result: '推开了，反弹很厉害。' },
      { text: '先出方案', performance: -1, effect: { reputation: -2 }, result: '方案出了一年，没动。' },
    ],
  },
  {
    title: '对外贸易',
    scene: '外需走弱，外贸结构也需要调整。',
    options: [
      { text: '帮企业拓市场、调结构，同时打通通关堵点', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '那年全省外贸份额反而提升了。' },
      { text: '出台扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，落到企业手里慢。' },
      { text: '等形势好转', performance: -2, effect: { reputation: -3 }, result: '等来了更多企业外迁。' },
    ],
  },
  {
    title: '区域协调',
    scene: '省内区域差距明显，且有扩大趋势。',
    options: [
      { text: '分类施策，先补短板，同时建利益共享机制', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后差距开始收敛。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '钱给了，机制没变。' },
      { text: '集中做强核心区', performance: -2, effect: { reputation: -3, network: -3 }, result: '核心强了，差距更大。' },
    ],
  },
  {
    title: '城乡融合',
    scene: '城乡二元结构明显，要素流动不畅。',
    options: [
      { text: '以县域为单元统筹，把要素流动的通道打开', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '五年后县域经济明显活跃。' },
      { text: '继续加大农村投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制没变。' },
      { text: '鼓励进城', performance: -1, effect: { reputation: -2 }, result: '人进了城，配套没跟上。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '乡村振兴推进几年，产业同质、人才外流。',
    options: [
      { text: '按资源禀赋分类，把联农带农机制做实', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '五年后多数村有了稳定来源。' },
      { text: '继续投基础设施', performance: 1, effect: { reputation: 1 }, result: '设施好了，人还是往外走。' },
      { text: '集中做示范', performance: -1, effect: { reputation: -2 }, result: '示范很漂亮，面上没变。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '产粮大省要扛稳责任，但种粮收益偏低。',
    options: [
      { text: '保面积保产能，在收益和补贴机制上做文章', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 2 }, result: '五年后面积产量稳，农民收益也上去了。' },
      { text: '下指标压任务', performance: 1, effect: { reputation: 1 }, result: '指标下了，落实打折扣。' },
      { text: '在数字上做文章', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '核查时被发现。' },
    ],
  },
  {
    title: '生态保护',
    scene: '生态地位重要，发展与保护的张力长期存在。',
    options: [
      { text: '把红线钉死，同时把生态价值转化路径做出来', performance: 3, effect: { reputation: 5, seniority: 4, integrity: 2 }, result: '五年后保护和发展的关系顺了。' },
      { text: '以保为主', performance: 1, effect: { reputation: 1 }, result: '保住了，发展受限。' },
      { text: '先发展再治理', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '治理代价远高于当初的收益。' },
    ],
  },
  {
    title: '绿色转型',
    scene: '产业结构偏重，转型成本高、阵痛大。',
    options: [
      { text: '先立后破，把新动能先建起来再退旧的', performance: 3, effect: { reputation: 4, seniority: 5, health: -2 }, result: '五年后结构明显变轻。' },
      { text: '坚决压减', performance: 1, effect: { reputation: 1, network: -1 }, result: '压了，经济也下来了。' },
      { text: '运动式推进', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '一刀切引发诸多问题。' },
    ],
  },
  {
    title: '能源安全',
    scene: '能源保供和低碳转型要同时兼顾。',
    options: [
      { text: '先立后破，把供应能力建起来再调结构', performance: 3, effect: { reputation: 4, seniority: 4, health: -2 }, result: '五年后既保住了供应，结构也优化了。' },
      { text: '保供优先', performance: 1, effect: { reputation: 1 }, result: '保住了，转型落后。' },
      { text: '转型优先', performance: -1, effect: { reputation: -2 }, result: '转型快了，供应吃紧。' },
    ],
  },
  {
    title: '流域治理',
    scene: '一条重要江河的治理跨省跨市，协调难度极大。',
    options: [
      { text: '推动上下游联防联治和生态补偿', performance: 3, effect: { reputation: 5, network: 5, seniority: 4 }, result: '五年后水质稳定改善。' },
      { text: '管好自己这一段', performance: 1, effect: { reputation: 1 }, result: '自己这段清了，整体没变。' },
      { text: '等统一部署', performance: -1, effect: { reputation: -2 }, result: '等了几年，问题还在。' },
    ],
  },
  {
    title: '教育事业',
    scene: '教育发展与产业需求、人口变化都不匹配。',
    options: [
      { text: '跟着需求调结构，把产教融合和布局优化一起做', performance: 3, effect: { reputation: 4, seniority: 4, health: -1 }, result: '五年后教育与需求的匹配度明显提高。' },
      { text: '继续扩规模', performance: 1, effect: { reputation: 1 }, result: '规模上去了，就业更难。' },
      { text: '集中办名校', performance: -1, effect: { reputation: -2 }, result: '名校强了，整体没变。' },
    ],
  },
  {
    title: '卫生健康',
    scene: '优质医疗资源集中，基层能力不足。',
    options: [
      { text: '建高地与强基层并举，把分级诊疗做实', performance: 3, effect: { reputation: 5, seniority: 4, network: 2 }, result: '五年后外转率明显下降。' },
      { text: '建大医院', performance: 1, effect: { reputation: 1 }, result: '大医院更大，基层更弱。' },
      { text: '引进名医', performance: -1, effect: { reputation: -1 }, result: '名医来了又走。' },
    ],
  },
  {
    title: '社会保障',
    scene: '基金可持续压力上升，人口结构在变。',
    options: [
      { text: '扩面征缴与制度改革并举，把长期缺口补上', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 1 }, result: '五年后基金运行更稳。' },
      { text: '提高补助标准', performance: 1, effect: { reputation: 1 }, result: '补助涨了，缺口更大。' },
      { text: '等顶层设计', performance: -1, effect: { reputation: -2 }, result: '等了一年，什么也没变。' },
    ],
  },
  {
    title: '就业优先',
    scene: '总量压力和结构性矛盾同时存在。',
    options: [
      { text: '培训和岗位对接一起做，重点群体一对一', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '两年后重点群体就业明显改善。' },
      { text: '扩大培训规模', performance: 1, effect: { reputation: 1 }, result: '培训了很多，用不上。' },
      { text: '开发公益岗', performance: -1, effect: { reputation: -2 }, result: '岗位有限，结构问题没解。' },
    ],
  },
  {
    title: '住房问题',
    scene: '大城市住房突出问题与新市民需求交织。',
    options: [
      { text: '租购并举，保障性供给和租赁规范一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '五年后新市民住房压力明显缓解。' },
      { text: '多建保障房', performance: 1, effect: { reputation: 1 }, result: '建了，位置和配套不理想。' },
      { text: '稳定房价优先', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '房价稳了，居住问题没解。' },
    ],
  },
  {
    title: '民生实事',
    scene: '要办一批民生实事，钱紧，诉求多。',
    options: [
      { text: '按急难愁盼排序，办一件成一件', performance: 3, effect: { reputation: 5, seniority: 3 }, result: '五年办成一批，群众有实感。' },
      { text: '按部门报的办', performance: 1, effect: { reputation: 1 }, result: '办了不少，群众没感觉。' },
      { text: '做几个亮点', performance: -1, effect: { reputation: -2 }, result: '亮点有了，急事没办。' },
    ],
  },
  {
    title: '社会治理',
    scene: '矛盾集中在基层，化解资源在上面。',
    options: [
      { text: '资源下沉，把化解做早做小', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '三年后越级上访明显减少。' },
      { text: '加强排查', performance: 1, effect: { reputation: 1 }, result: '排查了，化解不了。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '压住一时，堆得更多。' },
    ],
  },
  {
    title: '平安建设',
    scene: '社会治安出现新的突出问题，群众安全感下降。',
    options: [
      { text: '打防结合、源头治理，交政法机关依法办、不干预个案', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 3 }, result: '两年后治安形势明显好转。' },
      { text: '集中打击', performance: 1, effect: { reputation: 1 }, result: '打了一阵又回来。' },
      { text: '打打招呼', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '打招呼的事，后患无穷。' },
    ],
  },
  {
    title: '安全生产',
    scene: '全省发生一起重大事故，影响很大。',
    options: [
      { text: '第一时间到现场，救人优先，如实上报，全省举一反三', performance: 3, effect: { reputation: 5, integrity: 3, health: -4, seniority: 2 }, result: '处置得当，全省安全形势随后明显好转。' },
      { text: '先处置再上报', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '被认定迟报漏报。' },
      { text: '控制消息', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '瞒报被查，从重追责。' },
    ],
  },
  {
    title: '应急体系',
    scene: '一次极端天气暴露出全省应急体系的短板。',
    options: [
      { text: '重构指挥和预案体系，搞实战化演练', performance: 3, effect: { reputation: 4, seniority: 4, health: -2 }, result: '下一次实战中响应明显更快。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案厚了，没人翻。' },
      { text: '配装备', performance: -1, effect: { reputation: -1 }, result: '装备有了，人不会用。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '极端天气频发，全省防灾能力不均衡。',
    options: [
      { text: '按风险区划分类施策，打通预警到响应的链条', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '下一次极端天气损失明显减小。' },
      { text: '加强值班值守', performance: 1, effect: { reputation: 1 }, result: '值班加强了，流程不清。' },
      { text: '事后救灾', performance: -2, effect: { reputation: -3 }, result: '救了灾，损失已经造成。' },
    ],
  },
  {
    title: '信访稳定',
    scene: '一批跨地区跨部门的积案，多年没有化解。',
    options: [
      { text: '亲自包最难的一件，逐案定责任定时限', performance: 3, effect: { reputation: 5, seniority: 3, health: -2 }, result: '两年后积案化解过半。' },
      { text: '交办下去', performance: 1, effect: { reputation: 1 }, result: '交办了，转一圈又回来。' },
      { text: '稳住就行', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '问题越积越多。' },
    ],
  },
  {
    title: '法治建设',
    scene: '全省法治环境评价不高，行政行为不规范问题突出。',
    options: [
      { text: '从制度入手，把程序和裁量规范起来，自己带头守规矩', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 4 }, result: '三年后法治环境明显改善。' },
      { text: '要求各地重视', performance: 1, effect: { reputation: 1 }, result: '重视了，还是照旧出错。' },
      { text: '协调一下个案', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '协调的事留下了记录。' },
    ],
  },
  {
    title: '统计工作',
    scene: '有迹象表明个别地方的数据不实。',
    options: [
      { text: '立即组织核查，发现一起查处一起，全省通报', performance: 3, effect: { reputation: 4, integrity: 5, seniority: 3 }, result: '查处之后，全省风气为之一正。' },
      { text: '要求自查自纠', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '自查结果全部合格。' },
      { text: '压着不查', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '被督查发现，一并追责。' },
    ],
  },
  {
    title: '审计监督',
    scene: '审计发现一条资金链上有系统性问题。',
    options: [
      { text: '全面整改并建长效机制，结果公开', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 3 }, result: '机制建起来后，同类问题基本消失。' },
      { text: '要求逐个整改', performance: 1, effect: { reputation: 1 }, result: '整改了，还会再犯。' },
      { text: '控制影响范围', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被公开通报。' },
    ],
  },
  {
    title: '政府自身建设',
    scene: '政府系统效率不高，形式主义仍有市场。',
    options: [
      { text: '从自身改起，把流程、责任、公开三件事做实', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 2 }, result: '两年后政府效能明显提升。' },
      { text: '发文件提要求', performance: 1, effect: { reputation: 1 }, result: '文件发了，没人当回事。' },
      { text: '开会强调', performance: -1, effect: { reputation: -2 }, result: '强调完了，还是那样。' },
    ],
  },
  {
    title: '数字政府',
    scene: '要建全省一体化平台，最怕建成空壳。',
    options: [
      { text: '先立共享硬规矩，从高频场景切入', performance: 3, effect: { reputation: 3, seniority: 4 }, result: '平台真用起来了，应用也多了。' },
      { text: '一次建全', performance: 1, effect: { reputation: 1 }, result: '建完了，没人用。' },
      { text: '先建大屏', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '大屏漂亮，数据不更新。' },
    ],
  },
  {
    title: '基层减负',
    scene: '基层报表多、证明多、留痕多，早已不堪重负。',
    options: [
      { text: '省级带头清，拉清单逐项删并公开', performance: 3, effect: { reputation: 5, seniority: 3 }, result: '清掉一半后，基层腾出了手。' },
      { text: '要求减少', performance: 1, effect: { reputation: 1 }, result: '要求提了，没人真删。' },
      { text: '先统计', performance: -1, effect: { reputation: -2 }, result: '统计本身又成了负担。' },
    ],
  },
  {
    title: '督查落实',
    scene: '很多部署落不下去，督查也督查不动。',
    options: [
      { text: '督查与激励并重，把干得好的树起来', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '一年后落实情况明显好转。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '选人用人',
    scene: '一批重要岗位要动，递话打招呼的不少。',
    options: [
      { text: '把标准立在前，全程留痕，打招呼的一律登记', performance: 3, effect: { reputation: 4, integrity: 5, seniority: 4 }, result: '这批人用得服众，往后递话的人少了。' },
      { text: '平衡各方', performance: 1, effect: { reputation: 1 }, result: '平衡了，能力匹配一般。' },
      { text: '用熟悉的', performance: -4, effect: { reputation: -5, integrity: -5, network: -2 }, result: '圈子一成形，风气就坏了。' },
    ],
  },
  {
    title: '全面从严治党',
    scene: '主体责任压得不实，有的领域问题易发多发。',
    options: [
      { text: '自己先领最难的责任，逐级约谈压实，支持监督机关', performance: 3, effect: { reputation: 5, integrity: 5, seniority: 4 }, result: '三年后政治生态明显好转。' },
      { text: '发文件提要求', performance: 1, effect: { reputation: 1 }, result: '文件发了，没人当回事。' },
      { text: '交给纪委', performance: -1, effect: { reputation: -2 }, result: '纪委扛不动主体责任。' },
    ],
  },
  {
    title: '廉政与家风',
    scene: '你的位置意味着你和家人都会被盯上。',
    options: [
      { text: '立规矩、公开回避、主动报备，家里人先说清楚', performance: 3, effect: { reputation: 3, integrity: 6, seniority: 3 }, result: '若干年后回看，这一条护住了你。' },
      { text: '自己严格，家里提醒一下', performance: 1, effect: { reputation: 1, integrity: 2 }, result: '提醒了，边界还模糊。' },
      { text: '相信家人不会出问题', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '出事时，是从家里开的口子。' },
    ],
  },
];

},
"game/rank-events/rank-11": function(module, exports, require) {
// 职级 11 · 国家级副职（副国级）
//
// 权力边界：顶层统筹。主要工作是制度供给、全局平衡和重大政策的取舍。
// 不再有"办成一件事"，只有"让整个系统长期朝哪个方向走"。
// 题目围绕"全局权衡、制度设计与长期主义"。
// 50 道。

module.exports = [
  {
    title: '顶层设计',
    scene: '一项制度设计要定稿，几种方案各有利弊，影响面都很大。',
    options: [
      { text: '多方案比选并做小范围试算，把不可逆的部分单独论证', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 1 }, result: '制度落地后运行平稳，十年没大改。' },
      { text: '采纳主流意见', performance: 1, effect: { reputation: 1 }, result: '定了，执行中不断打补丁。' },
      { text: '取一个折中版本', performance: -1, effect: { reputation: -2 }, result: '折中的结果是谁都不满意。' },
    ],
  },
  {
    title: '全局平衡',
    scene: '东部要效率、西部要公平，双方都拿着充分的理由。',
    options: [
      { text: '建立可量化的平衡规则，让取舍有依据', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '规则一定，争论就变成了执行。' },
      { text: '照顾弱势一方', performance: 1, effect: { reputation: 1 }, result: '公平兼顾了，效率下来了。' },
      { text: '谁呼声高给谁', performance: -2, effect: { reputation: -3, network: -2 }, result: '两边都不满意。' },
    ],
  },
  {
    title: '重大政策',
    scene: '一项重大政策要出台，短期有阵痛、长期看必要。',
    options: [
      { text: '把阵痛期和配套安排一起设计好再推出', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '政策推出后平稳落地，三年见效。' },
      { text: '先推出再看', performance: 1, effect: { reputation: 1 }, result: '推出了，阵痛期很难熬。' },
      { text: '等条件成熟', performance: -2, effect: { reputation: -3 }, result: '等了几年，问题更重。' },
    ],
  },
  {
    title: '制度供给',
    scene: '一个领域长期靠文件和运动推动，缺的是制度。',
    options: [
      { text: '把权责、激励、约束一起写进制度', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '制度一立，运动式的推动就少了。' },
      { text: '再发一个文件', performance: 1, effect: { reputation: 1 }, result: '文件发了，还是老样子。' },
      { text: '加强督促', performance: -1, effect: { reputation: -2 }, result: '督促一阵好一阵。' },
    ],
  },
  {
    title: '国家战略',
    scene: '一个国家级战略要定方向，若干路径都讲得通。',
    options: [
      { text: '做长周期推演，把不可逆的选择单独标识', performance: 3, effect: { reputation: 5, seniority: 5 }, result: '十年后看，方向选对了。' },
      { text: '采纳多数专家意见', performance: 1, effect: { reputation: 1 }, result: '定了，争议还在。' },
      { text: '跟着热点', performance: -2, effect: { reputation: -3 }, result: '热点一过，留下沉没成本。' },
    ],
  },
  {
    title: '中长期规划',
    scene: '规划编制中，各方都想把自己的事写进去。',
    options: [
      { text: '按战略优先级收敛，写进去的必须有指标和路径', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '规划落地率高，五年后对照看很准。' },
      { text: '尽量兼顾', performance: 1, effect: { reputation: 1 }, result: '兼顾的结果是重点模糊。' },
      { text: '把目标写得高一些', performance: -1, effect: { reputation: -2 }, result: '目标很高，完成不了。' },
    ],
  },
  {
    title: '区域战略',
    scene: '几大区域战略并行，需要防止碎片化。',
    options: [
      { text: '明确各自功能定位，建立跨区域协调机制', performance: 3, effect: { reputation: 4, seniority: 5, network: 4 }, result: '五年后区域格局协同明显。' },
      { text: '各推各的', performance: 1, effect: { reputation: 1 }, result: '战略很多，合力没有。' },
      { text: '资源整合到一起', performance: -1, effect: { reputation: -2, network: -2 }, result: '整合了，地方的积极性没了。' },
    ],
  },
  {
    title: '产业安全',
    scene: '若干关键环节对外依赖度高，存在被"卡"的风险。',
    options: [
      { text: '分级分类梳理，对真正卡脖子的集中力量、长期投入', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 1 }, result: '十年后关键环节基本可控。' },
      { text: '全面自主', performance: 1, effect: { reputation: 1 }, result: '摊子铺太大，进展缓慢。' },
      { text: '继续买', performance: -3, effect: { reputation: -5, integrity: -2 }, result: '断供时非常被动。' },
    ],
  },
  {
    title: '科技自立',
    scene: '基础研究薄弱，投入周期长、见效慢。',
    options: [
      { text: '建立稳定支持机制，让科研人员能坐十年冷板凳', performance: 3, effect: { reputation: 5, seniority: 5 }, result: '十年后基础研究的底子明显厚了。' },
      { text: '加大项目投入', performance: 1, effect: { reputation: 1 }, result: '项目多了，还是追热点。' },
      { text: '引进消化', performance: -1, effect: { reputation: -2 }, result: '引进了，核心还是没拿到。' },
    ],
  },
  {
    title: '人才体系',
    scene: '人才评价和使用机制僵化，评价导向偏颇。',
    options: [
      { text: '分类评价、破"唯"，把舞台和待遇给真正做事的人', performance: 3, effect: { reputation: 4, seniority: 4, network: 3 }, result: '五年后人才活力明显释放。' },
      { text: '提高待遇', performance: 1, effect: { reputation: 1 }, result: '待遇涨了，导向没变。' },
      { text: '增加头衔', performance: -1, effect: { reputation: -2 }, result: '头衔多了，做事的没多。' },
    ],
  },
  {
    title: '创新体系',
    scene: '产学研脱节，科研成果和产业需求对不上。',
    options: [
      { text: '让企业真正成为出题人和出资人，改革评价与分配', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后转化率和产业支撑明显提升。' },
      { text: '建更多平台', performance: 1, effect: { reputation: 1 }, result: '平台更多了，还是各干各的。' },
      { text: '加大奖励', performance: -1, effect: { reputation: -1 }, result: '奖励发了，机制没动。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '要在资源约束下长期保住粮食安全。',
    options: [
      { text: '保耕地、推技术、稳收益三件事一起抓', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 2 }, result: '十年后产能和收益都稳住了。' },
      { text: '提高收购价', performance: 1, effect: { reputation: 1 }, result: '价格提了，成本也上来了。' },
      { text: '靠进口调剂', performance: -3, effect: { reputation: -5, integrity: -2 }, result: '国际市场一波动就很被动。' },
    ],
  },
  {
    title: '能源安全',
    scene: '能源保供、低碳转型、成本控制三头挤压。',
    options: [
      { text: '先立后破，构建多元供应体系再推进转型', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '十年后供应稳、结构也优了。' },
      { text: '保供优先', performance: 1, effect: { reputation: 1 }, result: '保住了，转型滞后。' },
      { text: '转型优先', performance: -2, effect: { reputation: -3 }, result: '转型快了，供应吃紧。' },
    ],
  },
  {
    title: '产业链供应链',
    scene: '产业链出现外迁迹象，同时也有升级的窗口。',
    options: [
      { text: '区分可转移和必须留住的，用升级对冲外迁', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后链条整体向上走了一级。' },
      { text: '用成本优势留住', performance: 1, effect: { reputation: 1 }, result: '留住了低端，高端没起来。' },
      { text: '限制流出', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '限制反而加速了转移。' },
    ],
  },
  {
    title: '金融稳定',
    scene: '几个领域的风险有联动迹象。',
    options: [
      { text: '建立跨部门监测和处置机制，早识别早干预', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 4, health: -2 }, result: '风险被逐个拆掉，没有发生系统性事件。' },
      { text: '盯住最急的', performance: 1, effect: { reputation: 1 }, result: '最急的稳住了，别的爆了。' },
      { text: '等暴露了再处置', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '风险集中爆发，代价巨大。' },
    ],
  },
  {
    title: '财政体制',
    scene: '中央与地方、地方各级之间的财政关系需要理顺。',
    options: [
      { text: '先划清事权与支出责任，再匹配财力', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '体制理顺后，基层运转明显改善。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '钱给了，机制没变。' },
      { text: '维持现状', performance: -2, effect: { reputation: -3 }, result: '矛盾继续积累。' },
    ],
  },
  {
    title: '税收制度',
    scene: '要推进一项税制改革，牵动各方利益。',
    options: [
      { text: '先立法后实施，给过渡期和明确预期', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '改革平稳落地，预期稳定。' },
      { text: '先试点', performance: 1, effect: { reputation: 1 }, result: '试点了很久，没推开。' },
      { text: '一步到位', performance: -2, effect: { reputation: -3, network: -2 }, result: '震动太大，执行走样。' },
    ],
  },
  {
    title: '对外开放',
    scene: '外部环境变化，开放的节奏和方式需要重新设计。',
    options: [
      { text: '稳步扩大制度型开放，同时把安全边界划清', performance: 3, effect: { reputation: 5, seniority: 5, network: 4 }, result: '五年后开放质量明显提升。' },
      { text: '加大优惠力度', performance: 1, effect: { reputation: 1 }, result: '优惠给了，规则没变。' },
      { text: '收缩防守', performance: -2, effect: { reputation: -3, network: -3 }, result: '收缩之后，机会也少了。' },
    ],
  },
  {
    title: '对外经贸',
    scene: '外部需求走弱，贸易结构也需要调整。',
    options: [
      { text: '拓市场、调结构，同时把通关和融资等服务做实', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '三年后贸易结构和韧性都改善了。' },
      { text: '加大出口补贴', performance: 1, effect: { reputation: 1 }, result: '补贴给了，结构没变。' },
      { text: '等外部回暖', performance: -2, effect: { reputation: -3 }, result: '等来了更多订单转移。' },
    ],
  },
  {
    title: '营商环境',
    scene: '经营主体信心不足，制度性成本偏高。',
    options: [
      { text: '从法律和制度层面稳定预期，把制度性成本降下来', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 3 }, result: '三年后主体数量和投资意愿都回升。' },
      { text: '出台一批扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，信心没回来。' },
      { text: '多开会多鼓励', performance: -1, effect: { reputation: -2 }, result: '会开了，问题还在。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营经济预期不稳，需要制度性回应。',
    options: [
      { text: '把平等保护和产权保护做实，清理一批存量问题', performance: 3, effect: { reputation: 5, network: 5, seniority: 4, integrity: 2 }, result: '两年后民间投资明显回暖。' },
      { text: '出台支持意见', performance: 1, effect: { reputation: 1 }, result: '意见出了，预期没稳。' },
      { text: '多宣传多表彰', performance: -1, effect: { reputation: -2 }, result: '表彰了，该观望的还是观望。' },
    ],
  },
  {
    title: '国资国企',
    scene: '国资布局与新时代要求不完全匹配。',
    options: [
      { text: '按功能分类，向关键领域集中，同时把机制转起来', performance: 3, effect: { reputation: 3, seniority: 5, integrity: 1 }, result: '五年后国资的战略支撑作用明显增强。' },
      { text: '继续做大', performance: 1, effect: { reputation: 1 }, result: '规模上去了，效率没变。' },
      { text: '全面退出竞争性领域', performance: -1, effect: { reputation: -2, network: -1 }, result: '退了，战略支撑也弱了。' },
    ],
  },
  {
    title: '统一大市场',
    scene: '地方保护和区域壁垒仍然存在。',
    options: [
      { text: '从制度上立规矩，清理一批妨碍公平的做法', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 3 }, result: '三年后要素流动明显顺畅。' },
      { text: '发通知要求清理', performance: 1, effect: { reputation: 1 }, result: '通知发了，壁垒还在。' },
      { text: '先做个案协调', performance: -1, effect: { reputation: -2 }, result: '个案协调不完。' },
    ],
  },
  {
    title: '市场竞争',
    scene: '一些领域出现不正当竞争和集中度过高的苗头。',
    options: [
      { text: '完善规则并依法监管，同时给各类主体公平机会', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 3 }, result: '三年后市场秩序明显改善。' },
      { text: '加强处罚', performance: 1, effect: { reputation: 1 }, result: '罚了，规则还是模糊。' },
      { text: '扶大做强', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '集中度更高，创新反而少了。' },
    ],
  },
  {
    title: '要素市场化',
    scene: '土地、劳动力、资本、技术等要素配置仍有扭曲。',
    options: [
      { text: '逐项破题，把价格形成和流动机制建起来', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 1 }, result: '五年后要素配置效率明显提高。' },
      { text: '先做最容易的一项', performance: 1, effect: { reputation: 1 }, result: '做了一项，别的还是扭曲。' },
      { text: '维持行政配置', performance: -2, effect: { reputation: -3 }, result: '扭曲继续，效率损失。' },
    ],
  },
  {
    title: '价格机制',
    scene: '一些关键领域的价格没有反映成本和稀缺程度。',
    options: [
      { text: '分步理顺，同时给困难群体兜底', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '理顺后资源配置改善，也没有引发波动。' },
      { text: '一步放开', performance: 1, effect: { reputation: 1, network: -1 }, result: '放开了，短期波动很大。' },
      { text: '继续管着', performance: -1, effect: { reputation: -2 }, result: '管着，短缺和浪费并存。' },
    ],
  },
  {
    title: '就业优先',
    scene: '结构性矛盾突出，新技术又在改变岗位结构。',
    options: [
      { text: '培训体系跟着产业走，同时织密重点群体帮扶网', performance: 3, effect: { reputation: 4, seniority: 4, health: -1 }, result: '三年后结构性矛盾明显缓解。' },
      { text: '扩大岗位供给', performance: 1, effect: { reputation: 1 }, result: '岗位多了，还是不匹配。' },
      { text: '靠增长自然解决', performance: -1, effect: { reputation: -2 }, result: '增长了，结构性失业还在。' },
    ],
  },
  {
    title: '社会保障',
    scene: '人口结构变化给社会保障体系带来长期压力。',
    options: [
      { text: '做長期精算，把制度参数调整和多层次体系一起推', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '十年后体系可持续明显增强。' },
      { text: '提高当期待遇', performance: 1, effect: { reputation: 1 }, result: '待遇涨了，压力更大。' },
      { text: '逐年打补丁', performance: -1, effect: { reputation: -2 }, result: '补丁越打越乱。' },
    ],
  },
  {
    title: '教育强国',
    scene: '教育体系与人口变化、产业需求都不匹配。',
    options: [
      { text: '跟着需求和人口趋势调整结构，把质量放在规模前面', performance: 3, effect: { reputation: 4, seniority: 5, health: -2 }, result: '十年后人力资源与需求更匹配。' },
      { text: '继续扩招', performance: 1, effect: { reputation: 1 }, result: '规模上去了，就业更难。' },
      { text: '集中资源办顶尖', performance: -1, effect: { reputation: -2 }, result: '顶尖强了，整体没变。' },
    ],
  },
  {
    title: '健康中国',
    scene: '医疗资源分布不均，慢性病负担上升。',
    options: [
      { text: '把重心下沉到预防和基层，同时保留攻坚能力', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '十年后主要健康指标明显改善。' },
      { text: '增加医疗供给', performance: 1, effect: { reputation: 1 }, result: '供给涨了，预防还是薄弱。' },
      { text: '提高报销比例', performance: -1, effect: { reputation: -1 }, result: '报得多了，基金更紧。' },
    ],
  },
  {
    title: '人口发展',
    scene: '人口结构变化带来一系列长期影响。',
    options: [
      { text: '从生育支持、养育成本、老龄服务系统施策', performance: 3, effect: { reputation: 4, seniority: 5, health: -2 }, result: '十年后结构性压力有所缓解。' },
      { text: '给生育补贴', performance: 1, effect: { reputation: 1 }, result: '补贴给了，效果有限。' },
      { text: '先看看趋势', performance: -2, effect: { reputation: -3 }, result: '看着看着，窗口期过了。' },
    ],
  },
  {
    title: '住房制度',
    scene: '住房问题关系民生与风险，两端都要顾。',
    options: [
      { text: '建立多主体供给、多渠道保障的制度框架', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '十年后住房矛盾与风险都明显缓解。' },
      { text: '扩大保障性供给', performance: 1, effect: { reputation: 1 }, result: '供给有了，机制没理顺。' },
      { text: '稳定市场优先', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '市场稳了，结构问题还在。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '城乡差距长期存在，需要长效机制。',
    options: [
      { text: '以县域为单元，把产业、服务和要素流动一起做', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '十年后城乡差距明显收敛。' },
      { text: '继续加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制没变。' },
      { text: '做一批示范', performance: -1, effect: { reputation: -2 }, result: '示范很漂亮，面上没变。' },
    ],
  },
  {
    title: '城乡融合',
    scene: '要素向城市单向流动的局面没有根本改变。',
    options: [
      { text: '打通双向流动的制度通道，让进城和返乡都顺畅', performance: 3, effect: { reputation: 4, seniority: 5, network: 2 }, result: '五年后要素双向流动开始形成。' },
      { text: '鼓励进城落户', performance: 1, effect: { reputation: 1 }, result: '人进了城，农村更空。' },
      { text: '限制流动', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '限制的结果是谁都不满意。' },
    ],
  },
  {
    title: '生态文明',
    scene: '生态保护与发展的关系需要制度性安排。',
    options: [
      { text: '把红线、补偿、考核三件事一起做成制度', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 3 }, result: '十年后保护与发展真正协调起来。' },
      { text: '加强督察', performance: 1, effect: { reputation: 1 }, result: '督察了，反弹还在。' },
      { text: '以项目推动', performance: -1, effect: { reputation: -2 }, result: '项目完了，机制没留下。' },
    ],
  },
  {
    title: '双碳目标',
    scene: '降碳目标与能源安全、经济增长存在张力。',
    options: [
      { text: '先立后破，把市场机制和核算体系先建起来', performance: 3, effect: { reputation: 5, seniority: 5, health: -2, integrity: 1 }, result: '十年后转型平稳，也守住了安全。' },
      { text: '层层分解压下去', performance: 1, effect: { reputation: 1, network: -1 }, result: '压下去了，出现了运动式减碳。' },
      { text: '顺其自然', performance: -2, effect: { reputation: -3 }, result: '十年后目标差距很大。' },
    ],
  },
  {
    title: '资源节约',
    scene: '资源利用效率不高，浪费与短缺并存。',
    options: [
      { text: '建立全流程的节约制度和循环利用体系', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '五年后利用效率明显提高。' },
      { text: '开展节约行动', performance: 1, effect: { reputation: 1 }, result: '行动一阵，之后照旧。' },
      { text: '靠价格调节', performance: -1, effect: { reputation: -1 }, result: '价格手段单一，效果有限。' },
    ],
  },
  {
    title: '流域治理',
    scene: '大江大河的治理涉及上下游、左右岸、干支流。',
    options: [
      { text: '建立统一规划、统一标准、联合调度的机制', performance: 3, effect: { reputation: 4, seniority: 5, network: 4 }, result: '十年后流域生态明显恢复。' },
      { text: '分段治理', performance: 1, effect: { reputation: 1 }, result: '各段达标，整体没变。' },
      { text: '先治重点段', performance: -1, effect: { reputation: -2 }, result: '重点段好了，别的还在恶化。' },
    ],
  },
  {
    title: '基础设施',
    scene: '基础设施网络需要整体优化，重复建设和短板并存。',
    options: [
      { text: '按网络效益统筹规划，把衔接和集约放在前面', performance: 3, effect: { reputation: 3, seniority: 5, integrity: 1 }, result: '十年后网络效率明显提高。' },
      { text: '各地按需建设', performance: 1, effect: { reputation: 1 }, result: '建了不少，衔接不畅。' },
      { text: '多上项目', performance: -2, effect: { reputation: -3 }, result: '重复建设，债务积累。' },
    ],
  },
  {
    title: '数字建设',
    scene: '数字化转型纵深推进，数据要素的价值还没释放。',
    options: [
      { text: '先把产权、流通、安全的制度建起来再谈应用', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '五年后数据要素市场真正运转起来。' },
      { text: '大规模建平台', performance: 1, effect: { reputation: 1 }, result: '平台建了，数据不流通。' },
      { text: '先抓安全', performance: -1, effect: { reputation: -2 }, result: '安全抓了，应用停摆。' },
    ],
  },
  {
    title: '统计制度',
    scene: '统计数据的真实性和口径一致性存在问题。',
    options: [
      { text: '改革核算制度并严肃查处造假，把真实性立起来', performance: 3, effect: { reputation: 4, integrity: 6, seniority: 4 }, result: '三年后数据质量明显提升。' },
      { text: '加强核查', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '核查了，源头没改。' },
      { text: '口径统一就行', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '口径统一了，真实性没解决。' },
    ],
  },
  {
    title: '法治建设',
    scene: '一些领域的法律供给滞后于实践。',
    options: [
      { text: '加快立法并严格执法，把权力关进制度的笼子', performance: 3, effect: { reputation: 4, integrity: 5, seniority: 5 }, result: '五年后法治环境明显改善。' },
      { text: '先出规范性文件', performance: 1, effect: { reputation: 1 }, result: '文件出了，效力不足。' },
      { text: '靠政策调节', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '政策多变，预期不稳。' },
    ],
  },
  {
    title: '社会治理',
    scene: '社会结构深刻变化，治理体系需要相应调整。',
    options: [
      { text: '把重心下沉到基层，同时用法治和自治做支撑', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '五年后基层治理能力明显增强。' },
      { text: '加强管控', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '管控加强了，活力下降。' },
      { text: '靠投入解决', performance: -1, effect: { reputation: -2 }, result: '投入涨了，机制没变。' },
    ],
  },
  {
    title: '公共安全',
    scene: '公共安全形势复杂，新风险不断出现。',
    options: [
      { text: '建立风险监测预警和协同处置体系，把防线前移', performance: 3, effect: { reputation: 4, seniority: 4, health: -2 }, result: '五年后重大公共安全事件明显减少。' },
      { text: '出了事再处置', performance: 1, effect: { reputation: 1 }, result: '处置及时，损失已经造成。' },
      { text: '加强安保', performance: -1, effect: { reputation: -1 }, result: '安保加强了，源头没管。' },
    ],
  },
  {
    title: '应急体系',
    scene: '巨灾情景下的应急能力还有明显短板。',
    options: [
      { text: '按最不利情景做预案并实战演练，建区域协同机制', performance: 3, effect: { reputation: 5, seniority: 5, health: -3 }, result: '下一次巨灾中，响应和协同明显改善。' },
      { text: '完善预案文本', performance: 1, effect: { reputation: 1 }, result: '文本完善了，没练过。' },
      { text: '增加储备', performance: -1, effect: { reputation: -1 }, result: '储备有了，调不动。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '极端天气常态化，需要新的防灾思路。',
    options: [
      { text: '把韧性理念纳入规划和建设标准', performance: 3, effect: { reputation: 4, seniority: 5, health: -1 }, result: '十年后城市和区域的韧性明显增强。' },
      { text: '加强工程建设', performance: 1, effect: { reputation: 1 }, result: '工程建了，标准不统一。' },
      { text: '加强救灾', performance: -1, effect: { reputation: -2 }, result: '救灾及时，损失已经造成。' },
    ],
  },
  {
    title: '风险防范',
    scene: '多重风险交织，需要系统性的防范框架。',
    options: [
      { text: '建风险台账和处置预案，压实各方责任', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 5, health: -2 }, result: '风险逐个化解，没有发生系统性事件。' },
      { text: '盯住最紧迫的', performance: 1, effect: { reputation: 1 }, result: '最紧的稳了，别的爆了。' },
      { text: '等风险暴露', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '风险集中爆发，代价巨大。' },
    ],
  },
  {
    title: '调查研究',
    scene: '一项政策在文件上很完美，基层反映完全不是那么回事。',
    options: [
      { text: '自己下去看，不带陪同、不看安排好的点', performance: 3, effect: { reputation: 5, seniority: 4, integrity: 2, health: -2 }, result: '看到了真相，政策做了重大调整。' },
      { text: '开座谈会听意见', performance: 1, effect: { reputation: 1 }, result: '听到了想听的话。' },
      { text: '要求下面报情况', performance: -2, effect: { reputation: -3 }, result: '报上来的情况很全面，也很假。' },
    ],
  },
  {
    title: '督查落实',
    scene: '很多决策在最后一公里变形走样。',
    options: [
      { text: '从制度上减少层级、明确责任、公开结果', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '两年后落实情况明显改善。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你所在的位置，意味着无数双眼睛和无数种试探。',
    options: [
      { text: '把制度笼子扎紧，自己主动回避和报备，从不例外', performance: 3, effect: { reputation: 4, integrity: 6, seniority: 4 }, result: '多年以后回看，这一条护住了你。' },
      { text: '严格要求自己', performance: 1, effect: { reputation: 1, integrity: 2 }, result: '自己严了，身边没管住。' },
      { text: '相信身边人', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '出事时，是从身边开的口子。' },
    ],
  },
];

},
"game/story-chains": function(module, exports, require) {
// 跨年故事占用正常季度事项，每年最多推进一次；选择记录独立于最近 18 条履历保存。
// 只保存节点选择和年份，事件内容按选择重建，关闭页面或读档不会换分支。
function choice(id, text, performance, effect, result, quality = 0) {
  return { id, text, performance, effect, result, quality };
}

const STORIES = [
  {
    id: 'school', title: '老旧学校修缮', minRank: 1, maxRank: 6,
    nodes: [
      {
        title: '雨后的教室', delayYears: 0,
        scene: '云岭小学送来几张雨后教室的照片：屋面渗水，旧线路也需要检查。你参与整理修缮建议，学校希望尽快开工，完整摸排却需要时间。预算和施工由主管部门审批实施，这次先决定建议怎样推进。',
        options: [
          choice('survey', '逐间核对问题，再提出整体修缮建议', 1, { reputation: 1, health: -1 }, '你和学校逐间核对，把漏水、线路和使用需求分别记清。建议递交得晚了一些，但每一项都有依据。', 2),
          choice('phased', '先保急需，提出分期修缮方案', 3, { reputation: 1 }, '你把急需处理的部分先送审，余下问题列入下一期计划。眼前的难处缓了下来，后续仍要持续跟进。', 1),
          choice('patch', '先建议局部修补，保留其余问题清单', 1, { health: 1 }, '局部修补建议很快交了出去，屋面问题先得到处理。旧线路和其他教室的问题留在待办清单里。'),
        ],
      },
      {
        title: '调整后的修缮计划', delayYears: 1,
        scene: steps => ({
          survey: '当年逐间核对的清单派上了用场：方案能区分安全修缮和一般改善。如今可用预算收紧，学校请你帮助说明哪些项目应当优先。',
          phased: '当年分期修缮的第一期已经完成，第二期却遇上预算收紧。学校拿着你留下的计划来问，余下教室今年还能不能排上。',
          patch: '当年的局部修补缓解了漏水，待办清单上的其他问题仍在。新一轮预算又收紧，校方希望你协助补充完整依据。',
        })[steps[0].choiceId],
        options: [
          choice('protect', '补齐依据，优先争取必要修缮', 1, { reputation: 2, health: -1 }, '你把现场情况和轻重缓急重新说明，必要修缮得到优先安排，一般改善继续等候。', 2),
          choice('coordinate', '协调错峰施工，先落地可实施的部分', 3, { network: 1 }, '你协调了教学和施工时段，一部分工程顺利推进，余下项目仍需后续接力。', 1),
          choice('defer', '维持现有安排，将余项转交后续年度', 1, { health: 1, reputation: -1 }, '材料按时移交，未完成部分继续留在计划中。校方理解资源有限，但等待比预想的更长。'),
        ],
      },
      {
        title: '交接清单上的空格', delayYears: 1,
        scene: steps => `学校送来了修缮交接材料。${steps[1].choiceId === 'protect' ? '当年优先争取的必要修缮已经完成，接下来要核实实际使用情况。' : '此前分批安排的项目进展不一，已完成与待完成部分需要分清。'}这次的跟进方式，会影响问题是否被带进下一学年。`,
        options: [
          choice('check', '核对师生反馈，推动问题整改后交接', 3, { reputation: 2, health: -1 }, '你把使用反馈交给负责单位，发现的问题整改后才逐项销号，维护联系人也留在了清单上。', 2),
          choice('handover', '完成分段交接，为余项明确接手人员', 1, { network: 1 }, '已完成部分先交接，余项逐一写明接手人。事情还没有全部结束，但后续有人继续负责。', 1),
          choice('paper', '按现有材料移交，由日常维护继续跟进', 1, { health: 1 }, '材料移交完成，零散问题进入日常维护。各项进展分散在不同记录里，后来查找需要多费一些工夫。'),
        ],
      },
      {
        title: '几年后的回信', delayYears: 2,
        scene: steps => schoolOutcome(steps),
        options: steps => {
          const score = qualityOf('school', steps);
          const outcome = schoolOutcome(steps);
          return [
            choice('visit', '回应学校来信，联系经办人员了解近况', score >= 5 ? 3 : 1, { reputation: score >= 5 ? 4 : score >= 3 ? 2 : 0 }, `${outcome}你回应了学校，也把仍需跟进的情况转给当前负责人员。这段修缮经历有了回音。`),
            choice('archive', '整理当年记录，把经验与问题交给接手人', 1, { seniority: 1, reputation: score >= 5 ? 2 : 0 }, `${outcome}你整理了历年的选择与交接资料，让后来者知道这件事是怎样走到今天的。`),
          ];
        },
      },
    ],
  },
  {
    id: 'backlog', title: '积压事项清理', minRank: 1, maxRank: 11,
    nodes: [
      {
        title: '那一柜旧材料', delayYears: 0,
        scene: '一次旧档整理中，几份反复转交的办事材料被找了出来。有的只差补件，有的涉及职责衔接，还有的已经解决却没有及时回访。你参与提出清理办法，眼前的数量和真正的问题未必是一回事。',
        options: [
          choice('triage', '核对当事人诉求，按实际原因分类', 1, { reputation: 1, health: -1 }, '你逐件核对现状，把补件、协调和已办待回访分开。清理数量暂时不多，原因却逐渐清楚。', 2),
          choice('batch', '先处理手续齐全的一批，再啃难题', 3, { reputation: 1 }, '一批事项很快办结，大家看见了进度，几件复杂事项留到了下一轮。', 1),
          choice('route', '先按职责转交，逐件登记去向', 1, { network: 1 }, '材料去向都有了记录，不过一些事项到了接收部门后，仍需要进一步厘清责任。'),
        ],
      },
      {
        title: '又转回来的三份材料', delayYears: 1,
        scene: steps => ({
          triage: '当年分类记录中的跨部门事项仍未全部办妥。你留下的原因说明让争议集中到几个具体环节，不必再从头猜测。',
          batch: '容易办理的事项已经清完，剩下的几份材料恰好都是当年留下的难题。如今它们又回到协调清单上。',
          route: '当年登记转出的三份材料又回来了，各方都有接收记录，却没有人能说明下一步由谁推动。',
        })[steps[0].choiceId],
        options: [
          choice('coordinate', '核清职责衔接，提出共同办理清单', 1, { network: 2, health: -1 }, '你把争议环节逐项写清，相关人员对照职责确定办理顺序，几份旧材料终于有了可执行的下一步。', 2),
          choice('follow', '逐个联系经办人，先推动能解决的环节', 3, { reputation: 1 }, '几处卡点逐渐打通，但衔接仍依赖经办人之间持续联系。', 1),
          choice('explain', '说明目前进度，继续按既有流程转办', 1, { reputation: -1, health: 1 }, '当事人知道了最新进度，程序也继续往前走，但反复衔接的问题没有彻底解决。'),
        ],
      },
      {
        title: '办结之后再问一句', delayYears: 1,
        scene: steps => `台账上的办结数量增加了。${steps[1].choiceId === 'coordinate' ? '共同办理清单正在使用，需要确认它是否真正减少了往返。' : '几个疑难事项终于有了进展，但经办记录和当事人的感受可能还有差距。'}负责汇总的人请你提出回访建议。`,
        options: [
          choice('callback', '逐件核对难点事项，完善交接与回访办法', 3, { reputation: 2, health: -1 }, '回访发现的小问题被及时补上，办理顺序和交接办法也整理成了可继续使用的记录。', 2),
          choice('sample', '先回访典型事项，保留定期抽查安排', 1, { reputation: 1 }, '几件典型事项的反馈不错，余下事项留待后续抽查，回访开始成为固定安排。', 1),
          choice('forms', '整理现有反馈，完成阶段总结', 1, { seniority: 1 }, '阶段总结如期完成。没有主动反馈的事项暂时未再核对，后续情况依赖新的反映。'),
        ],
      },
      {
        title: '办事窗口的变化', delayYears: 1,
        scene: steps => backlogOutcome(steps),
        options: steps => {
          const score = qualityOf('backlog', steps);
          const outcome = backlogOutcome(steps);
          return [
            choice('review', '把回访结果交给现任经办团队', score >= 5 ? 3 : 1, { reputation: score >= 5 ? 4 : score >= 3 ? 2 : 0 }, `${outcome}你把回访结果转交现任团队，这次清理留下的经验和不足都有了明确记录。`),
            choice('record', '留存完整办理经过，供后来者查阅', 1, { seniority: 1 }, `${outcome}那一柜旧材料最终被整理成可追溯的办理经过，你也记住了数字之外的差别。`),
          ];
        },
      },
    ],
  },
  {
    id: 'mentor', title: '青年同事培养', minRank: 3, maxRank: 11,
    nodes: [
      {
        title: '新同事的第一份方案', delayYears: 0,
        scene: '青年同事小林第一次参加你参与指导的专项工作。方案很认真，却没分清问题轻重。他希望得到修改建议，眼前又有一个紧迫的提交期限。',
        options: [
          choice('coach', '讲清判断依据，让他自己重做一遍', 1, { reputation: 1, health: -1 }, '你没有替他直接改完，而是一起理清目标和边界。方案提交慢了一点，小林开始知道为什么这样写。', 2),
          choice('pair', '共同修改关键部分，先完成这次任务', 3, { network: 1 }, '方案顺利交出，小林跟着学了一些方法，独立判断仍需要以后慢慢练。', 1),
          choice('template', '给他成熟范本，让他按格式完成', 1, { health: 1 }, '提交时间保住了，格式也没有问题。不过遇到范本之外的情况，小林仍不知道该如何处理。'),
        ],
      },
      {
        title: '第一次独立协调', delayYears: 1,
        scene: steps => ({
          coach: '当年一起推敲方案的小林带来了自己的协调思路。这次情况更复杂，他希望在明确职责边界后独立试一次。',
          pair: '当年与你共同改方案的小林接到新任务。他能把材料写好，但协调遇到分歧时，仍习惯先等你的判断。',
          template: '当年照范本完成任务的小林遇到了没有现成模板的情况。他列了几种做法，却拿不定主意。',
        })[steps[0].choiceId],
        options: [
          choice('lead', '明确边界与复盘节点，让他独立推进', 1, { network: 1, health: -1 }, '你说明需要请示的边界，让小林在职责内独立协调。过程有磕绊，他也第一次把问题从头跟到尾。', 2),
          choice('together', '共同参加关键协调，再逐步交给他', 3, { reputation: 1 }, '关键节点顺利通过，小林积累了经验，不过最困难的判断仍由你们共同完成。', 1),
          choice('takeover', '由熟悉情况的人接手，让他负责记录', 1, { health: 1 }, '任务进度稳定下来，小林整理了完整记录，却少了一次独立承担的机会。'),
        ],
      },
      {
        title: '总结里该写谁的名字', delayYears: 1,
        scene: steps => `专项工作进入总结阶段。${steps[1].choiceId === 'lead' ? '小林独立跟进的过程和关键判断，都能在记录里找到。' : '几位同事各有分工，需要把协作过程说明白。'}你收到征求意见稿，要为下一轮培养安排提出建议。`,
        options: [
          choice('credit', '如实写明个人贡献，建议按能力承担新任务', 3, { reputation: 2 }, '你把每个人的实际贡献写清，并提出相应的培养建议。小林看到了自己的进步，也知道还有哪些能力需要补足。', 2),
          choice('team', '突出团队合作，建议继续轮岗学习', 1, { network: 1 }, '总结保留了协作经过，后续培养转向轮岗，小林还会接触新的工作环节。', 1),
          choice('retain', '建议继续熟悉现有事务，暂缓增加职责', 1, { health: 1 }, '小林留在熟悉的事务中继续积累，工作稳定下来，新的历练机会暂时少了一些。'),
        ],
      },
      {
        title: '几年后的一次重逢', delayYears: 2,
        scene: steps => mentorOutcome(steps),
        options: steps => {
          const score = qualityOf('mentor', steps);
          const outcome = mentorOutcome(steps);
          return [
            choice('listen', '听他讲这些年的经历，交流新的判断', score >= 5 ? 3 : 1, { network: score >= 5 ? 3 : 1, reputation: score >= 5 ? 2 : 0 }, `${outcome}你们聊起当年那份方案，也聊起后来各自学会的事情。培养的结果终于在时间里显现。`),
            choice('notes', '把共同经历整理成一份工作笔记', 1, { seniority: 1 }, `${outcome}你把这段经历写进笔记，留下怎样教、何时放手，以及哪里还可以做得更好的思考。`),
          ];
        },
      },
    ],
  },
];

function qualityOf(id, steps) {
  const story = STORIES.find(item => item.id === id);
  return steps.slice(0, 3).reduce((score, step, index) => {
    const option = story.nodes[index].options.find(item => item.id === step.choiceId);
    return score + (option ? option.quality : 0);
  }, 0);
}

function schoolOutcome(steps) {
  const score = qualityOf('school', steps);
  if (score >= 5) return '一封师生来信寄到了你手上：修缮后的教室平稳用了几个学年，维护交接也一直有人接续。信里还提到了当年那份逐项落实的清单。';
  if (score >= 3) return '学校传来近况：主要教室已经改善，分期安排的余项仍在陆续完成。师生记得你参与的那些协调，也盼着后续维护继续跟上。';
  return '学校传来一份返修与补办清单：当年留下的零散问题陆续显现，接手人员正在重新梳理。眼前曾经省下的工夫，最终成了后来需要补上的工作。';
}

function backlogOutcome(steps) {
  const score = qualityOf('backlog', steps);
  if (score >= 5) return '回访结果送来了：反复往返的事项明显减少，新接手的人也能照清单找到办理路径。那几位曾反复补材料的办事人，终于说起了事情办成之后的日子。';
  if (score >= 3) return '回访结果显示，多数旧事项已经办妥，少数跨部门问题仍需要专人协调。清理确实有成效，稳定接续的办法还要继续完善。';
  return '回访中又出现了熟悉的材料：一些事项虽然转出或报结，实际困难仍未解决。现任团队决定重新核对，从当事人的诉求开始梳理。';
}

function mentorOutcome(steps) {
  const score = qualityOf('mentor', steps);
  if (score >= 5) return '一次工作交流中，你再次遇见小林。他已经能独立负责复杂事项，还在带新同事。他说起当年的那份方案和后来的历练：从反复确认到自己作出判断，走过的每一步都没有白费。';
  if (score >= 3) return '再次见到小林时，他已经成为团队里可靠的协作者。熟悉的事务处理得很稳，遇到新的难题，他仍会主动找人一起商量。';
  return '再次见到小林时，他把熟悉的事务做得很细，但遇到没有范本的问题，仍习惯等待别人拍板。你想起当年几次赶时间的选择，培养需要的空间终究没能凭空长出来。';
}

function optionsOf(node, steps) {
  return typeof node.options === 'function' ? node.options(steps) : node.options;
}

function normalizeProgress(raw, year) {
  const progress = {};
  STORIES.forEach(story => {
    const source = raw && raw[story.id];
    if (!Array.isArray(source)) return;
    const steps = [];
    for (let index = 0; index < Math.min(source.length, story.nodes.length); index += 1) {
      const step = source[index];
      const node = story.nodes[index];
      const selectedYear = Number(step && step.year);
      if (!step || !Number.isInteger(selectedYear) || selectedYear < 1 || selectedYear > year) break;
      if (index && selectedYear < steps[index - 1].year + node.delayYears) break;
      if (!optionsOf(node, steps).some(option => option.id === step.choiceId)) break;
      steps.push({ year: selectedYear, choiceId: step.choiceId });
    }
    if (steps.length) progress[story.id] = steps;
  });
  return progress;
}

function eventFor(state) {
  if (!state || state.ended || state.pendingInterrogation || state.fallDetail || state.quarter < 2) return null;
  const progress = normalizeProgress(state.storyProgress, state.year);
  const lastYear = Math.max(0, ...Object.values(progress).map(steps => steps[steps.length - 1].year));
  if (lastYear >= state.year) return null;
  // 一次只展开一条；等待回访的年份仍然正常处理原有季度事项。
  const active = STORIES.find(story => progress[story.id] && progress[story.id].length < story.nodes.length);
  const story = active || STORIES.find(item => !progress[item.id] && state.rankIndex >= item.minRank && state.rankIndex <= item.maxRank);
  if (!story) return null;
  const steps = progress[story.id] || [];
  const node = story.nodes[steps.length];
  if (steps.length && state.year < steps[steps.length - 1].year + node.delayYears) return null;
  const scene = typeof node.scene === 'function' ? node.scene(steps) : node.scene;
  const memory = steps.length ? `${steps[0].year}年开始的往事。上次在${steps[steps.length - 1].year}年，你选择了「${optionsOf(story.nodes[steps.length - 1], steps.slice(0, -1)).find(option => option.id === steps[steps.length - 1].choiceId).text}」。\n\n` : '';
  const tip = steps.length === story.nodes.length - 1 ? '这是这段经历的最后一次回访，结果将保留在履历记录中。' : '本次选择会记入这段经历，后续按年份继续。';
  return {
    storyId: story.id, storyStep: steps.length, storyYear: state.year,
    title: `跨年故事 · ${story.title}（${steps.length + 1}/${story.nodes.length}）`,
    scene: `${node.title}\n\n${memory}${scene}\n\n${tip}`,
    options: optionsOf(node, steps).map(option => Object.assign({}, option, { effect: Object.assign({}, option.effect) })),
  };
}

function resolveChoice(state, event, option) {
  const current = eventFor(state);
  if (!current || current.storyId !== event.storyId || current.storyStep !== event.storyStep || current.storyYear !== event.storyYear) return null;
  // 页面会打乱选项顺序，必须按 id 记录，不能把屏幕上的第几个当作分支编号。
  const chosen = current.options.find(item => item.id === option.id);
  if (!chosen) return null;
  const progress = normalizeProgress(state.storyProgress, state.year);
  const steps = progress[event.storyId] || [];
  steps.push({ year: state.year, choiceId: chosen.id });
  progress[event.storyId] = steps;
  state.storyProgress = progress;
  const story = STORIES.find(item => item.id === event.storyId);
  const next = story.nodes[steps.length];
  const followUp = next ? `这段经历将在${state.year + next.delayYears}年起继续跟进。` : `「${story.title}」已完成，可在履历记录中回看。`;
  return Object.assign({}, chosen, { result: `${chosen.result}\n${followUp}` });
}

function summary(state) {
  const progress = normalizeProgress(state.storyProgress, state.year);
  return STORIES.filter(story => progress[story.id]).map(story => {
    const steps = progress[story.id];
    const completed = steps.length === story.nodes.length;
    const status = completed ? '已完成' : state.ended ? `人生已结束，停在${steps.length}/4` : `已推进${steps.length}/4`;
    const lines = steps.map((step, index) => {
      const option = optionsOf(story.nodes[index], steps.slice(0, index)).find(item => item.id === step.choiceId);
      return `${step.year}年：${story.nodes[index].title}——${option.text}${completed && index === steps.length - 1 ? `\n${option.result}` : ''}`;
    });
    if (!completed && !state.ended) lines.push(`后续：${steps[steps.length - 1].year + story.nodes[steps.length].delayYears}年起跟进。`);
    return `${story.title}（${status}）\n${lines.join('\n')}`;
  }).join('\n\n');
}

function outcomes(state) {
  const progress = normalizeProgress(state.storyProgress, state.year);
  return STORIES.map(story => {
    const steps = progress[story.id] || [];
    return { id: story.id, title: story.title, completed: steps.length === story.nodes.length, quality: qualityOf(story.id, steps) };
  });
}

module.exports = { normalizeProgress, eventFor, resolveChoice, summary, outcomes };

},
"services/storage": function(module, exports, require) {
const core = require('../game/core');

const KEY = 'buyunlu_save_v1';
const SLOTS_KEY = 'buyunlu_save_slots_v1';
const HISTORY_KEY = 'buyunlu_local_history_v1';
const SLOT_COUNT = 3;

function load() {
  try {
    const value = wx.getStorageSync(KEY);
    return value && value.age ? core.normalizeState(value) : core.newState();
  } catch (error) {
    return core.newState();
  }
}

function save(state) {
  try {
    wx.setStorageSync(KEY, core.normalizeState(state));
    return true;
  } catch (error) {
    return false;
  }
}

function validSlot(slot) {
  const value = Number(slot);
  return Number.isInteger(value) && value >= 1 && value <= SLOT_COUNT;
}

function readSlots() {
  try {
    const value = wx.getStorageSync(SLOTS_KEY);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    return {};
  }
}

function localHistory() {
  try {
    const value = wx.getStorageSync(HISTORY_KEY);
    return Array.isArray(value) ? value.slice(0, 50) : [];
  } catch (error) {
    return [];
  }
}

function addLocalHistory(type, slot, state, savedAt) {
  const rank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
  const entry = {
    type,
    slot,
    at: savedAt || new Date().toISOString(),
    name: state.name || '未命名',
    year: state.year,
    age: state.age,
    rank: rank.short,
  };
  try {
    wx.setStorageSync(HISTORY_KEY, [entry].concat(localHistory()).slice(0, 50));
  } catch (error) { /* 历史写入失败不影响存档本身 */ }
}

function readableSlot(item) {
  const state = item && item.state;
  return !!(state && typeof state === 'object' && !Array.isArray(state) && Number.isFinite(Number(state.age)) && Number(state.age) > 0);
}

function slotList() {
  const slots = readSlots();
  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const item = slots[slot];
    if (!readableSlot(item)) return { slot, empty: true };
    const state = core.normalizeState(item.state);
    const rank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    return { slot, empty: false, savedAt: item.savedAt || '', name: state.name || '未命名', year: state.year, age: state.age, rank: rank.short };
  });
}

function saveSlot(slot, state) {
  if (!validSlot(slot) || !state || typeof state !== 'object') return false;
  try {
    const normalized = core.normalizeState(state);
    const savedAt = new Date().toISOString();
    const slots = readSlots();
    slots[slot] = { savedAt, state: normalized };
    wx.setStorageSync(SLOTS_KEY, slots);
    addLocalHistory('save', Number(slot), normalized, savedAt);
    return true;
  } catch (error) {
    return false;
  }
}

function loadSlot(slot) {
  if (!validSlot(slot)) return null;
  try {
    const item = readSlots()[slot];
    if (!readableSlot(item)) return null;
    const state = core.normalizeState(item.state);
    addLocalHistory('load', Number(slot), state);
    return state;
  } catch (error) {
    return null;
  }
}

function clear() {
  wx.removeStorageSync(KEY);
}

module.exports = { KEY, SLOTS_KEY, HISTORY_KEY, SLOT_COUNT, load, save, clear, slotList, saveSlot, loadSlot, localHistory };

},
"services/leaderboard": function(module, exports, require) {
const { RANKS } = require('../game/data-full');
const { PUBLIC_SERVANT_TITLE, honorDisplayTitle } = require('../game/core');
const WORK_START_AGE = 22;
// 「人民公仆」不进入游戏本体的晋升链，但在排行榜上作为副国级之上的虚拟档位。
const LEADERBOARD_HONOR_RANK = RANKS.length + 1;
const LEADERBOARD_LEADER_RANK = RANKS.length + 2;

function honorOf(raw) {
  const text = String(raw == null ? '' : raw).trim();
  return text === PUBLIC_SERVANT_TITLE ? PUBLIC_SERVANT_TITLE : '';
}

function leaderboardRankIndexOf(source) {
  const raw = source || {};
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(raw.rankIndex) || 1)));
  const honor = raw.honor !== undefined ? raw.honor : raw.honorTitle;
  if (!raw.fell && !raw.fallDetail && raw.leader === true && honorOf(honor)) return LEADERBOARD_LEADER_RANK;
  if (!raw.fell && !raw.fallDetail && honorOf(honor)) return LEADERBOARD_HONOR_RANK;
  return rankIndex;
}

function workYearsOf(source) {
  const explicit = Number(source && source.workYears);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
  const age = Number(source && source.age);
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.floor(age - WORK_START_AGE));
}

function remainingAssetsOf(state) {
  const source = state || {};
  const reported = Number(source.retirementWealth);
  if (source.ended && Number.isFinite(reported)) return Math.max(0, Math.floor(reported));
  const total = Number(source.money || 0)
    + Number(source.providentFund || 0)
    + Number(source.annuity || 0)
    + Number(source.houseValue || 0)
    + Number(source.carValue || 0)
    - Number(source.houseLoanBalance || 0)
    - Number(source.carLoanBalance || 0);
  return Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
}

function formatAssetValue(value) {
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}亿元`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万元`;
  return `${amount}元`;
}

function formatConfiscatedValue(value) {
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  const wan = amount / 10000;
  return `${wan >= 100 ? wan.toFixed(0) : wan.toFixed(1)}万元`;
}

function playerEntry(state) {
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(state && state.rankIndex) || 1)));
  // 落马的人不进榜面：职级、政绩、考核、廉政全部归零。
  // 这是这个游戏唯一一个"前功尽弃"的地方，排行榜必须如实反映，
  // 否则玩家会看到"被查了还排在前面"这种自相矛盾的结论。
  const fell = !!(state && state.fallDetail);
  if (fell) {
    return {
      id: 'player',
      name: state && state.name ? String(state.name).slice(0, 8) : '匿名玩家',
      rankIndex: 1,
      rankYears: 0,
      achievements: 0,
      review: 0,
      integrity: 0,
      position: state.ending ? String(state.ending).slice(0, 12) : '落马被查',
      isPlayer: true,
      fell: true,
    };
  }
  const honor = honorOf(state && state.honorTitle);
  const leader = honorDisplayTitle(state) === '领导者 · 人民公仆';
  return {
    id: 'player',
    name: state && state.name ? String(state.name).slice(0, 8) : '匿名玩家',
    rankIndex: leaderboardRankIndexOf({ rankIndex, honor, leader }),
    rankYears: Math.max(0, Math.floor(Number(state && state.rankYears) || 0)),
    achievements: Math.max(0, Math.floor(Number(state && state.achievements) || 0)),
    review: Math.max(0, Math.floor(Number(state && state.review) || 0)),
    integrity: Math.max(0, Math.floor(Number(state && state.integrity) || 0)),
    position: state && state.currentPosition && state.currentPosition !== '待选择具体岗位' ? String(state.currentPosition) : RANKS[rankIndex - 1].short,
    honor,
    leader,
    isPlayer: true,
  };
}

// 榜上只有真实提交过的记录。早期版本会在本地拼 7342 条随机样本做冷启动，
// 玩家会看到一个"看起来很热闹"的假榜 —— 那是编造出来的。现在离线时
// 本机自己的成绩就是全部，其余以服务端真实数据为准。
function getPlayerRanking(state) {
  if (state && state.escapeDetail) return { rank: null, total: 0, entries: [] };
  const entry = playerEntry(state);
  return { rank: 1, total: 1, entries: [Object.assign({ rank: 1 }, entry)] };
}

function playerTigerEntry(state) {
  const source = state || {};
  if (!source.fallDetail) return null;
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(source.rankIndex) || 1)));
  return {
    id: 'player',
    name: source.name ? String(source.name).slice(0, 8) : '匿名玩家',
    rankIndex,
    rankYears: Math.max(0, Math.floor(Number(source.rankYears) || 0)),
    age: Math.max(0, Math.floor(Number(source.age) || 0)),
    workYears: workYearsOf(source),
    confiscatedValue: Math.max(0, Math.floor(Number(source.fallDetail.confiscated) || 0)),
    assetValue: Math.max(0, Math.floor(Number(source.fallDetail.confiscated) || 0)),
    position: String(source.currentPosition || RANKS[rankIndex - 1].short).slice(0, 24),
    isPlayer: true,
    fell: true,
  };
}

function getTigerRanking(state, limit = 6) {
  // 老虎榜不做本地样本：查处财产是"指控性"信息，编一条假的就是造谣。
  // 离线时最多显示本机自己的落马记录，其余以服务端为准。
  const player = playerTigerEntry(state);
  const entries = player ? [player] : [];
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 6));
  const visible = entries.slice(0, safeLimit).map((entry, index) => Object.assign({ rank: index + 1 }, entry));
  return { rank: player ? 1 : null, total: entries.length, entries: visible };
}

const ESCAPE_METHOD_NAMES = { plane: '飞机', ship: '轮船', train: '火车' };

function playerEscapeEntry(state) {
  const source = state || {};
  const detail = source.escapeDetail;
  if (!detail || !ESCAPE_METHOD_NAMES[detail.method]) return null;
  return {
    id: 'player',
    name: source.name ? String(source.name).slice(0, 8) : '匿名玩家',
    rankIndex: Math.max(1, Math.min(RANKS.length, Math.floor(Number(detail.rankIndex || source.rankIndex) || 1))),
    escapeMethod: detail.method,
    escapeAmount: Math.max(0, Math.floor(Number(detail.amount) || 0)),
    isPlayer: true,
    escaped: true,
  };
}

function getEscapeRanking(state, limit = 6) {
  const player = playerEscapeEntry(state);
  const entries = player ? [Object.assign({ rank: 1 }, player)] : [];
  return { rank: player ? 1 : null, total: entries.length, entries: entries.slice(0, Math.max(1, Math.floor(Number(limit) || 6))) };
}

// 与 leaderboard-api 共用的榜面行结构（给自定义弹窗按样式渲染，纯文本做不到"自己那栏变色"）：
//   text    普通一行            section 段落标题（全网前列）
//   gap     名次空档分割线       entry  一条榜单行（medal 只有前三挂奖牌，其余行留空占位对齐）
// 全网前列显示前 8 名（只有前三挂奖牌），超出 8 名之外又还没到玩家身边的，用空档行带过。
const BOARD_TOP_SIZE = 8;

function boardRows(result, options) {
  const opts = options || {};
  const totalLabel = opts.totalLabel || '全网玩家：{total}人';
  const rankLabel = opts.rankLabel || '你的全网排名：第{rank}名 / {total}';
  const subOf = opts.subOf || (() => '');
  const total = Math.max(0, Number(result && result.total) || 0);
  const rank = (result && result.rank) || null;
  const entries = (result && result.entries) || [];
  const rows = [
    { kind: 'text', text: totalLabel.replace('{total}', total) },
    { kind: 'text', text: rank ? rankLabel.replace('{rank}', rank).replace('{total}', total) : '本设备尚未提交结局成绩' },
  ];
  const identity = entry => entry.isPlayer ? `你 · ${entry.name}（本设备）` : entry.name;
  const medalOf = value => opts.medals === false ? '' : value === 1 ? '🥇' : value === 2 ? '🥈' : value === 3 ? '🥉' : '';
  // 兼容早期响应使用的 honorTitle，以及只返回虚拟第 12 档但未带称号字段的记录。
  const entryHonorOf = entry => {
    const source = entry || {};
    const declared = honorOf(source.honor !== undefined ? source.honor : source.honorTitle);
    if (declared) return source.leader === true ? '领导者 · 人民公仆' : declared;
    if (!source.fell && !source.fallDetail && Math.floor(Number(source.rankIndex)) === LEADERBOARD_LEADER_RANK) return '领导者 · 人民公仆';
    const virtualHonorRank = Math.floor(Number(source.rankIndex)) === LEADERBOARD_HONOR_RANK;
    return !source.fell && !source.fallDetail && virtualHonorRank ? PUBLIC_SERVANT_TITLE : '';
  };
  const positionOf = entry => opts.positionOf ? opts.positionOf(entry) : (entryHonorOf(entry) ? '' : String(entry && entry.position || ''));
  const shown = new Set();
  const top = entries.filter(entry => entry.rank <= BOARD_TOP_SIZE).sort((a, b) => a.rank - b.rank);
  if (top.length) {
    rows.push({ kind: 'section', text: '全网前列' });
    top.forEach(entry => {
      shown.add(entry.rank);
      rows.push({ kind: 'entry', medal: medalOf(entry.rank), rank: entry.rank, name: identity(entry), player: !!entry.isPlayer, position: positionOf(entry), sub: subOf(entry), honor: entryHonorOf(entry) });
    });
  }
  const nearby = entries.filter(entry => !shown.has(entry.rank)).sort((a, b) => a.rank - b.rank);
  // 前列最后一名与"我上一位"之间隔着的名次数，就是分割线上要写的那个数
  const beforeEntry = rank ? nearby.find(entry => !entry.isPlayer && entry.rank < rank) : null;
  const topEnd = top.length ? top[top.length - 1].rank : 0;
  const gapCount = rank ? Math.max(0, (beforeEntry ? beforeEntry.rank : rank) - topEnd - 1) : 0;
  if (gapCount > 0) rows.push({ kind: 'gap', count: gapCount });
  // 前后位行不带任何箭头前缀：奖牌列固定占位已经把名次对齐，自己那栏靠蓝色高亮区分
  nearby.forEach(entry => {
    rows.push({ kind: 'entry', medal: '', rank: entry.rank, name: identity(entry), player: !!entry.isPlayer, position: positionOf(entry), sub: subOf(entry), honor: entryHonorOf(entry) });
  });
  if (!entries.length && opts.emptyTip) rows.push({ kind: 'text', text: opts.emptyTip });
  // 榜上每一个名字都来自真实玩家的存档，容易被误读成真实职务与真实案件，
  // 所以两个榜单底部都固定挂一句虚构声明。
  if (opts.footnote) rows.push({ kind: 'note', text: opts.footnote });
  return rows;
}

const BOARD_DISCLAIMER = '以上均为虚构故事设定，不对应任何真实人物、机构或事件。';

function rankingRows(result) {
  return boardRows(result, { footnote: BOARD_DISCLAIMER });
}

function tigerRows(result) {
  return boardRows(result, {
    footnote: '以上均为虚构故事设定，不对应任何真实人物、机构或案件。',
    totalLabel: '落马玩家：{total}人',
    rankLabel: '你的老虎榜排名：第{rank}名 / {total}',
    emptyTip: '还没有公开的落马记录。',
    subOf: entry => {
      const tenure = `${workYearsOf(entry)}年`;
      const money = formatConfiscatedValue(entry.confiscatedValue == null ? entry.assetValue : entry.confiscatedValue);
      return `工作${tenure}落马　查处财产${money}`;
    },
  });
}

function escapeRows(result) {
  return boardRows(result, {
    medals: false,
    totalLabel: '出逃结局记录：{total}人',
    rankLabel: '你的金蝉榜排名：第{rank}名 / {total}',
    emptyTip: '还没有公开的出逃结局记录。',
    footnote: '金蝉榜为虚构结局记录，不对应任何真实人物、机构、案件或现实处置建议。',
    positionOf: entry => {
      const rankIndex = Math.floor(Number(entry && entry.rankIndex));
      return rankIndex >= 1 && rankIndex <= RANKS.length ? RANKS[rankIndex - 1].name : '历史记录（职级未记录）';
    },
    subOf: entry => `${ESCAPE_METHOD_NAMES[entry.escapeMethod] || '方式未记录'}　涉案携带现金${formatAssetValue(entry.escapeAmount)}`,
  });
}

function rowsToText(rows) {
  return (rows || []).map(row => {
    if (row.kind === 'text' || row.kind === 'section' || row.kind === 'note') return row.text;
    if (row.kind === 'gap') return `····· 中间还有 ${row.count} 人 ·····`;
    const honor = row.honor ? `　${row.honor}` : '';
    const position = row.position ? `　${row.position}` : '';
    return `${row.medal ? `${row.medal} ` : ''}${row.rank}. ${row.name}${honor}${position}${row.sub ? `\n　　${row.sub}` : ''}`;
  }).join('\n');
}

function formatRanking(result) {
  return rowsToText(rankingRows(result));
}

function formatTigerRanking(result) {
  return rowsToText(tigerRows(result));
}

function formatEscapeRanking(result) {
  return rowsToText(escapeRows(result));
}

module.exports = {
  BOARD_TOP_SIZE,
  LEADERBOARD_HONOR_RANK, LEADERBOARD_LEADER_RANK, honorOf, leaderboardRankIndexOf,
  getPlayerRanking, formatRanking, rankingRows, tigerRows, escapeRows, rowsToText,
  WORK_START_AGE, workYearsOf, remainingAssetsOf, formatAssetValue, formatConfiscatedValue, getTigerRanking, formatTigerRanking,
  ESCAPE_METHOD_NAMES, getEscapeRanking, formatEscapeRanking,
};

},
"services/leaderboard-api": function(module, exports, require) {
const { leaderboardApiBaseUrl } = require('./config');
const leaderboard = require('./leaderboard');
const core = require('../game/core');

const CLIENT_ID_KEY = 'buyunlu_leaderboard_client_id_v1';

function isConfigured() {
  return !!leaderboardApiBaseUrl && typeof wx !== 'undefined' && typeof wx.request === 'function';
}

function getClientId() {
  try {
    const saved = wx.getStorageSync(CLIENT_ID_KEY);
    if (saved) return String(saved);
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    wx.setStorageSync(CLIENT_ID_KEY, id);
    return id;
  } catch (error) {
    return `p-${Date.now().toString(36)}`;
  }
}

function request(path, options = {}) {
  if (!isConfigured()) return Promise.reject(new Error('leaderboard API is unavailable'));
  return new Promise((resolve, reject) => {
    wx.request(Object.assign({
      url: `${leaderboardApiBaseUrl}${path}`,
      timeout: 8000,
      header: { 'content-type': 'application/json' },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.data && response.data.ok !== false) resolve(response.data);
        else reject(new Error(`leaderboard request failed: ${response.statusCode}`));
      },
      fail: reject,
    }, options));
  });
}

// 旧版服务端会在榜单里混入随机样本（高育良、李达康那些假名字）。
// 新服务端读盘时已经整批清洗，但只要线上还没重新部署，响应里就仍可能有旧数据。
// 这里做一道前端防线：isSample 的行一律不渲染，总数扣掉服务端声明的样本数
// 和本次响应里实际被滤掉的行数 —— 部署新服务端之前，人数也不会显示成 9292。
function sanitizeRemote(result) {
  if (!result || typeof result !== 'object') return result;
  const rawEntries = Array.isArray(result.entries) ? result.entries : [];
  const entries = rawEntries.filter(entry => entry && entry.isSample !== true);
  const dropped = rawEntries.length - entries.length;
  const declared = Number(result.sampleCount) || 0;
  const total = (declared > 0 || dropped > 0)
    ? Math.max(entries.length, (Number(result.total) || 0) - declared - dropped)
    : Number(result.total) || 0;
  return Object.assign({}, result, { entries, total });
}

function submit(state) {
  const source = state || {};
  // 落马结局在主榜仍会由服务端归零；同时提交落马前数据，供老虎榜展示。
  const fell = !!source.fallDetail;
  const escaped = !!(source.escapeDetail && source.ending === '出逃结局');
  return request('/leaderboard/submit', {
    method: 'POST',
    data: {
      clientId: getClientId(),
      name: source.name || '匿名玩家',
      rankIndex: source.rankIndex,
      rankYears: source.rankYears,
      workYears: leaderboard.workYearsOf(source),
      achievements: source.achievements,
      review: source.review,
      integrity: source.integrity,
      age: source.age,
      position: escaped ? '' : String(source.currentPosition || (fell ? '落马被查' : '')).slice(0, 24),
      honor: leaderboard.honorOf(source.honorTitle),
      leader: core.honorDisplayTitle(source) === '领导者 · 人民公仆',
      reputation: source.reputation,
      health: source.health,
      illicitIncome: source.illicitIncome,
      faultHelpUsedYear: source.faultHelpUsedYear,
      assetValue: leaderboard.remainingAssetsOf(Object.assign({}, source, { ended: !!(source.ended || fell) })),
      confiscatedValue: fell && source.fallDetail ? Math.max(0, Math.floor(Number(source.fallDetail.confiscated) || 0)) : 0,
      fell,
      escaped,
      escapeMethod: escaped ? source.escapeDetail.method : '',
      escapeAmount: escaped ? Math.max(0, Math.floor(Number(source.escapeDetail.amount) || 0)) : 0,
    },
  }).then(sanitizeRemote);
}

function fetchRanking(limit = 6) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 6)));
  return request(`/leaderboard?limit=${safeLimit}&clientId=${encodeURIComponent(getClientId())}`).then(sanitizeRemote);
}

function fetchTigerRanking(limit = 6) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 6)));
  return request(`/tigerboard?limit=${safeLimit}&clientId=${encodeURIComponent(getClientId())}`).then(sanitizeRemote);
}

function fetchEscapeRanking(limit = 6) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 6)));
  return request(`/escapeboard?limit=${safeLimit}&clientId=${encodeURIComponent(getClientId())}`).then(sanitizeRemote);
}

// 榜面行结构统一由 leaderboard.boardRows 生成（前三名 + 玩家前后位 + 名次空档分割线），
// 文本版 formatRanking 只是把同一份行拼回字符串，避免两处排版各写一份日后漂移。

function rankingRows(result) {
  return leaderboard.rankingRows(sanitizeRemote(result));
}

function tigerRows(result) {
  return leaderboard.tigerRows(sanitizeRemote(result));
}

function escapeRows(result) {
  return leaderboard.escapeRows(sanitizeRemote(result));
}

function formatRanking(result) {
  return leaderboard.rowsToText(rankingRows(result));
}

function formatTigerRanking(result) {
  return leaderboard.rowsToText(tigerRows(result));
}

function formatEscapeRanking(result) {
  return leaderboard.rowsToText(escapeRows(result));
}

module.exports = { CLIENT_ID_KEY, isConfigured, getClientId, request, submit, fetchRanking, formatRanking, fetchTigerRanking, formatTigerRanking, fetchEscapeRanking, formatEscapeRanking, sanitizeRemote, rankingRows, tigerRows, escapeRows };

},
"services/virtual-pay": function(module, exports, require) {
// 免广告卡：小程序端虚拟支付服务。
//
// 一句话说明职责：把「登录 → 下单 → 拉起支付 → 等服务端发货」这四步收成一个 Promise，
// 页面只关心「有没有卡」和「买没买到」。
//
// 重要：卡的数量以服务端为准，本地不存也不能存 —— 本地存的卡改了存档就能白嫖。
// 支付签名、AppKey、sessionKey 全部在服务端，这里拿不到也不需要。
//
// 交互口径（够用即止，别把用户绕晕）：
//   有卡 → 点免广告操作时直接扣一张卡，立刻给奖励，不播广告
//   无卡 → 走原来的激励视频流程

const { leaderboardApiBaseUrl } = require('./config');

const TOKEN_KEY = 'buyunlu_pay_token_v1';
const MIN_BASE_LIB = '2.19.2';
const IOS_MIN_WX_VERSION = '8.0.68';
// 支付成功后平台要推「发货推送」再到服务端入账，所以要轮询等一会儿
const DELIVER_WAIT_MS = 15000;
const DELIVER_POLL_MS = 1500;

// 官方错误码 → 人话。玩家不该看到 -15013 这种东西。
const ERROR_MESSAGES = {
  '-1': '支付未完成，请稍后重试',
  '-4': '本次支付被风控拦截，请稍后再试',
  '-5': '签约结果未知，请稍后在“我的”里查看',
  '-15001': '支付参数有误，请更新到最新版小程序',
  '-15002': '订单号重复，请重新发起购买',
  '-15005': '登录状态已失效，请重试',
  '-15006': '支付配置有误，请联系开发者',
  '-15007': '登录状态已过期，请重新打开小程序',
  '-15008': '收款资质还没配置完成',
  '-15010': '商品还没上架，请稍后再试',
  '-15011': '当前环境不支持该支付方式',
  '-15013': '商品价格不一致，请联系开发者',
  '-15014': '商品刚上架，约 10 分钟后可用',
  '-15017': '收款功能暂时受限，请稍后再试',
  '-15020': '操作太快了，请稍后再试',
  '-15021': '当前下单过于频繁，请稍后再试',
};

function compareVersion(left, right) {
  const a = String(left || '').split('.').map(value => parseInt(value, 10) || 0);
  const b = String(right || '').split('.').map(value => parseInt(value, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const x = a[index] || 0;
    const y = b[index] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function systemInfo() {
  try {
    return (typeof wx !== 'undefined' && wx.getSystemInfoSync && wx.getSystemInfoSync()) || {};
  } catch (error) {
    return {};
  }
}

// 基础库低于 2.19.2 时没有这个接口，直接判不可用，省得报错吓人
function isSupported() {
  if (typeof wx === 'undefined' || typeof wx.requestVirtualPayment !== 'function') return false;
  const info = systemInfo();
  if (info.SDKVersion && compareVersion(info.SDKVersion, MIN_BASE_LIB) < 0) {
    return typeof wx.canIUse === 'function' ? wx.canIUse('requestVirtualPayment') : false;
  }
  return true;
}

// iOS 端走 Apple IAP，微信客户端版本不够时拉起支付会失败，提前拦掉
function checkClientVersion() {
  const info = systemInfo();
  if (String(info.platform || '').toLowerCase() !== 'ios') return { ok: true };
  if (!info.version || compareVersion(info.version, IOS_MIN_WX_VERSION) >= 0) return { ok: true };
  return { ok: false, reason: `请先把微信更新到 ${IOS_MIN_WX_VERSION} 及以上版本，再用 iOS 购买` };
}

function isConfigured() {
  return !!leaderboardApiBaseUrl && typeof wx !== 'undefined' && typeof wx.request === 'function';
}

function readToken() {
  try { return String(wx.getStorageSync(TOKEN_KEY) || ''); } catch (error) { return ''; }
}

function writeToken(token) {
  try { token ? wx.setStorageSync(TOKEN_KEY, token) : wx.removeStorageSync(TOKEN_KEY); } catch (error) { /* 存不下就每次重登 */ }
}

function clearToken() { writeToken(''); }

function request(path, options = {}) {
  if (!isConfigured()) return Promise.reject(new Error('支付服务暂不可用'));
  const headers = { 'content-type': 'application/json' };
  const token = options.auth === false ? '' : (options.token || readToken());
  if (token) headers['x-session-token'] = token;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${leaderboardApiBaseUrl}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: headers,
      timeout: 10000,
      success(response) {
        const data = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && data.ok !== false) return resolve(data);
        const error = new Error(data.error || `支付请求失败(${response.statusCode})`);
        error.statusCode = response.statusCode;
        error.data = data;
        reject(error);
      },
      fail: () => reject(new Error('网络异常，请检查网络后重试')),
    });
  });
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || typeof wx.login !== 'function') return reject(new Error('当前环境不支持登录'));
    wx.login({
      success(result) { result && result.code ? resolve(result.code) : reject(new Error('登录失败，请重试')); },
      fail: () => reject(new Error('登录失败，请重试')),
    });
  });
}

// 换 token：openid 和 sessionKey 都留在服务端，本地只拿一个不透明 token
function login() {
  return (async () => {
    const code = await wxLogin();
    const result = await request('/pay/login', { method: 'POST', data: { code }, auth: false });
    writeToken(result.token);
    return result.token;
  })();
}

async function ensureToken(forceLogin = false) {
  if (!forceLogin) {
    const token = readToken();
    if (token) return token;
  }
  return login();
}

// 带自动重登的请求：token 过期（服务端返回 401）就重新登录再试一次
async function authedRequest(path, options = {}, retried = false) {
  const token = await ensureToken(retried);
  try {
    return await request(path, Object.assign({}, options, { token }));
  } catch (error) {
    if (error.statusCode === 401 && !retried) {
      clearToken();
      return authedRequest(path, options, true);
    }
    throw error;
  }
}

function fetchStatus() { return request('/pay/status', { auth: false }); }
function fetchBalance() { return authedRequest('/pay/balance'); }

// 「卡用完了」是正常业务结果，不是错误。
// 服务端会返回 200 + { ok:false, reason:'empty' }，而 request() 把 ok:false 统一当失败抛出，
// 这里把它翻回一个可判定的返回值，页面才能区分「没卡该降级播广告」和「接口真的挂了」。
function consume(scene) {
  return authedRequest('/pay/consume', { method: 'POST', data: { scene: String(scene || '') } })
    .catch(error => {
      const data = (error && error.data) || {};
      if (data.reason === 'empty') return { ok: false, reason: 'empty', balance: Number(data.balance) || 0 };
      throw error;
    });
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function payError(err) {
  const code = String((err && (err.errCode || err.errCode === 0 ? err.errCode : '')) || '');
  const message = ERROR_MESSAGES[code];
  const error = new Error(message || '支付未完成，请稍后重试');
  error.code = code;
  error.cancelled = code === '-2';
  error.sessionExpired = code === '-15007';
  return error;
}

function requestVirtualPayment(payData) {
  return new Promise((resolve, reject) => {
    wx.requestVirtualPayment({
      signData: payData.signData,
      paySig: payData.paySig,
      signature: payData.signature,
      mode: payData.mode || 'short_series_goods',
      success: resolve,
      fail: reject,
    });
  });
}

// 支付成功不代表已到账：平台的「发货推送」是异步的，所以要轮询余额。
// 超时不报错 —— 钱已经付了，卡随后会到，此时应该说"稍后到账"而不是"失败"。
async function waitForCards(previousBalance, options = {}) {
  const timeout = options.timeoutMs || DELIVER_WAIT_MS;
  const interval = options.pollMs || DELIVER_POLL_MS;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await delay(interval);
    try {
      const balance = await fetchBalance();
      if (Number(balance.balance) > Number(previousBalance || 0)) return { ok: true, balance: Number(balance.balance) };
    } catch (error) { /* 单次查询失败不算数，继续等 */ }
  }
  return { ok: false, pending: true };
}

// 完整购买流程。返回 { ok, balance, pending, cancelled, message, cards }
// options.quantity 是购买份数（一份 = 后台道具单价 × 1，对应发货 cardsPerUnit 张卡），
// 不传按 1 份处理；范围由服务端重新夹取，这里只是透传。
// options.timeoutMs / options.pollMs 用来调「等到账」的窗口（默认 15s / 1.5s），
// 正常调用不用传；网络慢的环境可以放宽，测试里可以压到毫秒级。
async function purchase(options = {}) {
  if (!isSupported()) return { ok: false, message: '当前微信版本不支持虚拟支付，请更新微信后再试' };
  const version = checkClientVersion();
  if (!version.ok) return { ok: false, message: version.reason };
  const quantity = Math.max(1, Math.min(1000, Math.floor(Number(options.quantity) || 1)));
  let before = 0;
  try { before = Number((await fetchBalance()).balance) || 0; } catch (error) { before = 0; }
  const order = await authedRequest('/pay/order', { method: 'POST', data: { quantity } });
  try {
    await requestVirtualPayment(order.payData);
  } catch (error) {
    const mapped = payError(error);
    // session_key 过期：清掉本地 token，下次点了会自动重登
    if (mapped.sessionExpired || mapped.code === '-15005') clearToken();
    if (mapped.cancelled) return { ok: false, cancelled: true, message: '已取消支付' };
    return { ok: false, message: mapped.message, code: mapped.code };
  }
  const waited = await waitForCards(before, options);
  if (waited.ok) return { ok: true, balance: waited.balance, cards: order.cards };
  return { ok: true, pending: true, cards: order.cards, message: `支付成功，${order.cards} 张免广告卡稍后到账` };
}

// 给页面用的一致性入口：拿卡数、判断能不能用卡
async function safeBalance() {
  try {
    const result = await fetchBalance();
    return { ok: true, balance: Number(result.balance) || 0, totalPurchased: Number(result.totalPurchased) || 0, totalConsumed: Number(result.totalConsumed) || 0 };
  } catch (error) {
    return { ok: false, balance: 0, error: error.message };
  }
}

module.exports = {
  TOKEN_KEY, MIN_BASE_LIB, IOS_MIN_WX_VERSION, ERROR_MESSAGES,
  compareVersion, isSupported, checkClientVersion, isConfigured,
  readToken, writeToken, clearToken,
  login, ensureToken, authedRequest, fetchStatus, fetchBalance, safeBalance, consume, purchase, waitForCards, payError,
};

},
"pages/index/index": function(module, exports, require) {
const core = require('../../game/core');
const network = require('../../game/network');
const storage = require('../../services/storage');
const leaderboard = require('../../services/leaderboard');
const leaderboardApi = require('../../services/leaderboard-api');
const virtualPay = require('../../services/virtual-pay');
const { COMMON_SURNAMES, GIVEN_NAMES, pickGivenNames } = require('../../game/name-catalog');
const { rewardedAdUnitId, adCardName, adCardCardsPerUnit, adCardPriceYuan, leaderboardApiBaseUrl } = require('../../services/config');

let videoAd = null;
let videoAdHandlers = null;
let activeAdPage = null;
const boundAdInstances = new WeakSet();
const NAV_ACTIONS = {
  main: [
    { label: '晋升条件', action: 'promotion' },
    { label: '监督核查说明', action: 'investigation' },
    { label: '年度考核回顾', action: 'annualReview' },
  ],
  life: [
    { label: '伴侣与家庭', action: 'romance' },
    { label: '健康管理', action: 'health' },
  ],
  asset: [
    { label: '购置房产', action: 'house' },
    { label: '购置车辆', action: 'car' },
    { label: '账户管理', action: 'accounts' },
  ],
  records: [
    { label: '成长档案', action: 'records' },
    { label: '履历记录', action: 'history' },
    { label: '保存进度', action: 'save' },
    { label: '读取存档', action: 'load' },
    { label: '本地存档记录', action: 'localHistory' },
    { label: '重新开始', action: 'restart', danger: true },
  ],
};

const NAV_COPY = {
  main: '处理晋升、监督核查和年度考核相关事项；进入晋升条件可观看激励广告。',
  life: '安排伴侣家庭互动，或管理健康状态。',
  asset: '管理房产、车辆和日常账户。',
  // 免广告卡不放在档案菜单里：它是一个售卖入口，藏在二级菜单里没人找得到。
  // 主界面顶部就有卡片（状态概览下方），点卡片看说明，点按钮直接买。
  // 关系网、人生排行榜的菜单入口已下线（2026-09-11）：关系网功能整体不再露出；
  // 人生排行榜仍可在人生结局页查看。老虎榜在主页「全网榜单」条上（showTigerBoard），
  // 只上真实落马记录，档案菜单里不重复挂。
  records: '查看成长档案、履历和本地存档记录，并保存本机进度。',
};

const BOARD_LOADING_ROW = { kind: 'note', text: '正在同步全网榜单…' };

function navActionsFor(key) {
  const actions = NAV_ACTIONS[key] || NAV_ACTIONS.main;
  return actions.map((item, index) => Object.assign({}, item, {
    lastOdd: actions.length % 2 === 1 && index === actions.length - 1,
  }));
}

// 免广告卡的界面数据。纯函数：只根据传入的状态出文案，绝不读 this.data，
// 否则拿到的会是上一轮的余额（对象字面量里的表达式在 setData 之前就求值完了）。
function payView(pay) {
  const source = pay || {};
  const balance = Math.max(0, Math.floor(Number(source.balance) || 0));
  const cardsPerUnit = Number(source.cardsPerUnit) > 0 ? Math.floor(Number(source.cardsPerUnit)) : adCardCardsPerUnit;
  const priceYuan = Number(source.priceYuan) > 0 ? Number(source.priceYuan) : adCardPriceYuan;
  const yuan = value => (value % 1 === 0 ? String(value) : value.toFixed(2));
  return {
    enabled: !!source.enabled,
    buying: !!source.buying,
    balance,
    // 关掉的原因要带到界面上：真机上一句"暂未开放"没法排查（域名没配？基础库太低？服务没开？）
    reason: source.reason || '',
    name: source.name || adCardName,
    cardsPerUnit,
    priceYuan,
    priceText: `￥${yuan(priceYuan)} / ${cardsPerUnit} 张`,
    buyLabel: source.buying ? '处理中…' : '购买',
  };
}

// 免广告卡的预设档位（单位：张）。份数 = 张数 / cardsPerUnit，
// 实际支付金额 = 份数 × 后台单价，价格以服务端 pay/status 返回为准。
const AD_CARD_PRESET_CARDS = [10, 60, 300];

// 关系网的界面数据。同样是纯函数，理由是同一个：
// 派生值不能在 setData 的对象字面量里读 this.data，那读到的是上一轮的状态。
function networkView(state) {
  const leaders = (state.fellows || []).length;
  const proteges = (state.proteges || []).length;
  const fallen = (state.fellows || []).concat(state.proteges || []).filter(item => item.fallen).length;
  const risk = network.fallRiskOf(state).risk;
  const level = network.riskLevel(risk);
  return {
    // 早期（职级 2 以下）既没有关系网也没有风险，整块不渲染，别占地方
    visible: leaders + proteges > 0 || risk >= 15,
    leaders,
    proteges,
    fallen,
    risk,
    level: level.label,
    note: level.note,
    tone: risk >= 50 ? 'high' : risk >= 30 ? 'mid' : 'low',
  };
}

function clearRewardedAd() {
  if (videoAd && videoAdHandlers) {
    if (typeof videoAd.offLoad === 'function') videoAd.offLoad(videoAdHandlers.load);
    if (typeof videoAd.offError === 'function') videoAd.offError(videoAdHandlers.error);
    if (typeof videoAd.offClose === 'function') videoAd.offClose(videoAdHandlers.close);
  }
  videoAd = null;
  videoAdHandlers = null;
}

function adAlreadyBound(ad) {
  return !!ad && (boundAdInstances.has(ad) || ad.__buyunluBound === 'rewarded-dispatcher-v2');
}

function markAdBound(ad) {
  if (!ad) return;
  boundAdInstances.add(ad);
  try { ad.__buyunluBound = 'rewarded-dispatcher-v2'; } catch (error) { /* native ad objects may be sealed */ }
}

function currentAdPage() {
  if (typeof getCurrentPages === 'function') {
    const pages = getCurrentPages();
    if (pages && pages.length) return pages[pages.length - 1];
  }
  return activeAdPage;
}

function settleRewardedAd(success) {
  const page = currentAdPage();
  if (!page || !page._rewardedAdPending) return;
  const resolve = page._rewardedAdPending;
  page._rewardedAdPending = null;
  resolve(success);
}

function getRewardedAd(adUnitId) {
  if (!wx.createRewardedVideoAd) return null;
  const ad = wx.createRewardedVideoAd({ adUnitId });
  videoAd = ad;
  if (!adAlreadyBound(ad)) {
    videoAdHandlers = {
      load: () => console.log('激励视频广告加载成功', adUnitId),
      error: (err) => {
        console.error('激励视频广告加载失败', adUnitId, err);
        settleRewardedAd(false);
      },
      close: (res) => {
        console.log('激励视频广告关闭', adUnitId, res || {});
        settleRewardedAd(!res || res.isEnded !== false);
      },
    };
    ad.onLoad(videoAdHandlers.load);
    ad.onError(videoAdHandlers.error);
    ad.onClose(videoAdHandlers.close);
    markAdBound(ad);
  }
  return ad;
}

const NAME_PRESET_GROUPS = [
  {
    title: '职场新人',
    names: ['高植物', '侯亮明', '李达安', '祁同为', '陈岩清', '季昌平', '易学成', '欧阳清', '丁义真', '赵东成', '沙瑞宁'],
  },
];

const NAME_BLOCKLIST = [
  // 现任及历任国家领导人
  '习近平', '李强', '赵乐际', '王沪宁', '蔡奇', '丁薛祥', '李希', '王毅', '何立峰', '张国清', '刘国中',
  '李干杰', '石泰峰', '李书磊', '陈文清', '尹力', '黄坤明', '陈吉宁', '王小洪', '陈敏尔', '袁家军',
  '栗战书', '汪洋', '韩正',
  '胡锦涛', '江泽民', '邓小平', '杨尚昆', '李先念', '华国锋', '赵紫阳', '李鹏', '朱镕基', '吴邦国',
  '贾庆林', '曾庆红', '吴官正', '贺国强', '刘云山', '张德江', '俞正声', '张高丽', '王岐山', '刘鹤',
  '毛泽东', '周恩来', '刘少奇', '朱德', '董必武', '宋庆龄', '陈云', '彭真', '万里', '乔石',
  // 中国当代在世及近年活跃的公众人物
  '任正非', '马云', '马化腾', '李彦宏', '雷军', '王传福', '曾毓群', '张一鸣', '刘强东', '王兴',
  '黄峥', '王健林', '董明珠', '俞敏洪', '许家印', '张朝阳', '周鸿祎', '李书福', '曹德旺', '尹同跃',
  '杨振宁', '屠呦呦', '钟南山', '李兰娟', '张伯礼', '陈薇', '潘建伟', '薛其坤', '颜宁', '施一公',
  '王贻芳', '饶毅', '张益唐', '朱松纯', '郭华东', '高福', '陈赛娟', '顾诵芬', '王选', '袁隆平',
  '莫言', '余华', '贾平凹', '余秋雨', '刘慈欣', '韩寒', '王安忆', '阿来', '迟子建', '方方',
  '成龙', '周润发', '周星驰', '刘德华', '李连杰', '甄子丹', '姜文', '张艺谋', '陈凯歌', '冯小刚',
  '巩俐', '章子怡', '周迅', '王菲', '周杰伦', '林俊杰', '邓紫棋', '陈奕迅', '蔡依林',
  '姚明', '郎平', '刘翔', '李娜', '苏炳添', '马龙', '樊振东', '郑钦文', '全红婵', '谷爱凌',
  '孙杨', '朱婷', '张怡宁', '李宁', '张继科', '杨威', '吴敏霞', '巩立姣', '徐梦桃',
  // 中国古代及近代历史人物
  '孙中山', '蒋介石', '袁世凯', '黄兴', '蔡锷', '陈独秀', '李大钊', '康有为', '梁启超', '曾国藩',
  '左宗棠', '李鸿章', '林则徐', '洪秀全', '秦始皇', '秦二世', '汉高祖', '刘邦', '汉文帝', '汉景帝',
  '汉武帝', '刘彻', '汉光武帝', '刘秀', '王莽', '陈胜', '吴广', '项羽', '韩信', '张良', '萧何',
  '卫青', '霍去病', '曹操', '刘备', '孙权', '关羽', '张飞', '司马懿', '司马光', '隋文帝', '杨坚',
  '隋炀帝', '杨广', '唐高祖', '李渊', '唐太宗', '李世民', '魏征', '房玄龄', '杜如晦', '武则天',
  '唐玄宗', '李隆基', '狄仁杰', '宋太祖', '赵匡胤', '宋太宗', '赵光义', '宋仁宗', '范仲淹', '王安石',
  '包拯', '朱元璋', '朱棣', '郑和', '戚继光', '海瑞', '张居正', '康熙', '雍正', '乾隆', '慈禧',
  '成吉思汗', '努尔哈赤', '皇太极', '岳飞', '文天祥', '郑成功',
  // 思想、文学、艺术与科学名人
  '孔子', '孟子', '老子', '庄子', '墨子', '荀子', '韩非子', '王阳明', '朱熹', '屈原', '司马迁', '班固',
  '王羲之', '陶渊明', '李白', '杜甫', '白居易', '王维', '苏轼', '辛弃疾', '李清照', '陆游', '曹雪芹',
  '罗贯中', '施耐庵', '吴承恩', '蒲松龄', '鲁迅', '胡适', '郭沫若', '巴金', '老舍', '钱学森', '邓稼先',
  '袁隆平', '钱三强', '李四光', '华罗庚', '茅以升', '詹天佑', '杨振宁', '屠呦呦', '钟南山', '焦裕禄',
  '雷锋', '孔繁森', '王进喜',
  // 国际公认历史人物及常见称谓
  '马克思', '恩格斯', '列宁', '斯大林', '华盛顿', '林肯', '丘吉尔', '拿破仑', '甘地', '曼德拉',
  '爱因斯坦', '牛顿', '达芬奇', '贝多芬', '莎士比亚', '国家领导人', '国家主席', '总书记', '伟人',
  '领袖', '毛主席', '周总理', '邓公', '总统', '总理', '主席', '皇帝', '大帝', '圣人',
];

function normalizedName(value) {
  return String(value || '').toLowerCase().replace(/[\s·•・.。,，!！?？_\-—]/g, '');
}

function legacyIsBlockedName(value) {
  const name = normalizedName(value);
  return !!name && NAME_BLOCKLIST.some(blocked => name.includes(normalizedName(blocked)));
}

const NAME_CHOICE_COUNT = 15;
const GIVEN_NAME_SET = new Set(GIVEN_NAMES);

function safeSurnameIndex(value) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < COMMON_SURNAMES.length ? index : 0;
}

function nameGroups(surname, givenNames) {
  return [{ title: '名字候选', names: givenNames.map(givenName => `${surname}${givenName}`) }];
}

function isBlockedName(value) {
  const name = String(value || '').trim();
  return !COMMON_SURNAMES.some(surname => name.startsWith(surname) && GIVEN_NAME_SET.has(name.slice(surname.length)));
}

function money(value) {
  const amount = Number(value || 0);
  return Math.abs(amount) >= 10000 ? `${(amount / 10000).toFixed(1)}万` : `${Math.floor(amount)}元`;
}

// 开销明细的紧凑口径：基础生活1.2万、子女8500元。省出来的钱标"省"。
function expenseBreakdown(expenses) {
  const items = (expenses && expenses.livingDetail) || [];
  return items
    .map(item => `${item.label}${item.amount >= 0 ? money(item.amount) : `省${money(-item.amount)}`}`)
    .slice(0, 4)
    .concat(items.length > 4 ? '等' : [])
    .join('、');
}

function partnerEffectText(state) {
  const profile = core.partnerProfile(state);
  if (!profile) return '尚未建立伴侣关系';
  const parts = [`陪伴投入：${profile.timeLabel}`];
  if (profile.annualHealthCost > 0) parts.push(`每年额外消耗健康${profile.annualHealthCost}点`);
  else if (profile.annualHealthCost < 0) parts.push('规律生活可抵消1点基础健康损耗');
  else parts.push('不额外消耗健康');
  if (profile.promotionBonus > 0) parts.push(`晋升概率增加${Math.round(profile.promotionBonus * 100)}%`);
  else parts.push('对晋升概率无直接影响');
  if (profile.annualPerformanceCost > 0) parts.push(`每年占用${profile.annualPerformanceCost}点年度绩效`);
  return `${profile.role}｜${parts.join('；')}`;
}

function quarterName(value) { return ['第一季度', '第二季度', '第三季度', '第四季度'][value - 1] || '第一季度'; }
function slotLabel(item) {
  if (!item || item.empty) return `存档 ${item ? item.slot : ''} · 空`;
  const time = String(item.savedAt || '').replace('T', ' ').slice(0, 16);
  return `存档 ${item.slot} · ${item.name} · ${item.year}年 · ${item.rank}${time ? ` · ${time}` : ''}`;
}
function shuffled(items) { const copy = items.slice(); for (let index = copy.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [copy[index], copy[swap]] = [copy[swap], copy[index]]; } return copy; }
function requirementText(state, rank, index) { return `任职满${rank.years}年　年龄≥${rank.age}　考核≥${rank.review}　口碑≥${rank.reputation}　人脉≥${rank.network}　政绩≥${rank.achievement || 0}　过失≤${(rank.faultLimit == null ? 99 : rank.faultLimit)}　机会${Math.floor(core.currentPromotionChance(state, index) * 100)}%`; }
function positionUnlockText(state, position) { if (position.blockedReason) return '不可直接转任'; if (position.minAchievements && state.achievements < position.minAchievements) return `暂不可选·还需${position.minAchievements - state.achievements}项累计政绩`; if (position.minIntegrity && state.integrity < position.minIntegrity) return `暂不可选·廉政值需达到${position.minIntegrity}`; return '可选'; }
function honorView(state) {
  const status = core.publicServantStatus(state);
  const leader = core.honorDisplayTitle(state) === '领导者 · 人民公仆';
  return {
    awarded: status.awarded,
    title: leader ? core.honorDisplayTitle(state) : status.title,
    year: leader ? state.leaderYear : status.honorYear,
    badge: status.awarded ? `同志们叫你${leader ? core.honorDisplayTitle(state) : status.title}` : '',
    requirement: leader ? '' : status.awarded
      ? '领导者条件：再任满1年，政绩≥120；连续5年考核≥95且无新增过失；廉政100、口碑≥98、健康≥60；三段跨年经历均获上等结果，并在一生仅有一次的统筹考验中连续通过三关（每关执行成功率50%，广告不加成）；从未请托消除过失、分文未取。'
      : `需在副国级任满${status.minRankYears}年，且一路走来的不当收入${status.incomeRuleText}`,
  };
}

Page({
  data: {
    state: core.newState(), careerTitle: '', lifeText: '',
    wealthText: '', compensationText: '', expenseText: '', loanText: '', reviewText: '', lastResult: '',
    progress: 0, quarterText: '第一季度', promotionChanceText: '0%', promotionStatusText: '今年未使用', metrics: [], adText: '', scrollIntoView: '',
    annualPerformanceLabel: '+0',
    activeNav: 'main', navActions: navActionsFor('main'), currentEvent: null,
    navItems: [{ key: 'main', label: '主线' }, { key: 'life', label: '生活' }, { key: 'asset', label: '资产' }, { key: 'records', label: '档案' }],
    dialog: { visible: false, mode: '', tone: '', title: '', content: '', confirmText: '确定', cancelText: '取消', showCancel: true, items: [], inputValue: '', inputPlaceholder: '', shareAction: '', shareReady: false },
    nameKicker: '生涯简报',
    honor: { awarded: false, title: '', year: 0, badge: '', requirement: '' },
    nameSelect: { visible: false, surnames: [], surnameIndex: 0, surname: '', givenNames: [], groups: [], selected: '', error: '' },
    burst: { visible: false, review: false, flag: '', tag: '', title: '', scene: '', tip: '', options: [] },
    // 关系网。人物与风险都从 state 派生，这里只放派生结果，不存第二份真值。
    net: { visible: false, leaders: 0, proteges: 0, fallen: 0, risk: 0, level: '低', note: '', tone: 'low' },
    // 免广告卡。入口常驻为悬浮窗；enabled 只控制购买态，游戏其余部分完全不受影响。
    pay: payView(null),
    // 图标加载失败时切成文字徽章（真机上偶发 WebP 不渲染）
    adCardIconBroken: false,
  },

  onAdCardIconError() {
    this.setData({ adCardIconBroken: true });
  },

  onLoad() {
    this._rewardedAdPending = null;
    this._sharePayload = null;
    this._burstKind = 'normal';
    this._payRaw = {};
    this._payBusy = false;
    activeAdPage = this;
    if (wx.showShareMenu) wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    const state = storage.load();
    const patch = this.buildPatch(state);
    this.setData(patch, () => {
      if (!state.name) {
        const openNameSelect = () => this.openNameSelect();
        if (typeof wx.nextTick === 'function') wx.nextTick(openNameSelect);
        else openNameSelect();
      }
    });
    // 支付能力是可选增强，拉取失败就静默隐藏，绝不阻塞开局
    this.refreshPay();
  },

  // 从支付收银台返回时会重新触发 onShow，正好用来补上「稍后到账」的那些卡
  onShow() {
    // 不管这里能不能买，回到前台都刷一次余额，"稍后到账"的卡才能自己补上
    if (virtualPay.isConfigured()) this.refreshPayBalance();
  },

  onUnload() {
    if (activeAdPage === this) activeAdPage = null;
    this._rewardedAdPending = null;
    this._payBusy = false;
  },

  onShareAppMessage() {
    if (this._sharePayload) {
      const payload = this._sharePayload;
      this._sharePayload = null;
      return payload;
    }
    const state = core.normalizeState(this.data.state);
    const rank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    const title = state.ended ? `《步云录》结局：${state.name || '匿名玩家'} · ${rank.short}` : `《步云录》：${state.name || '匿名玩家'}的仕途成长记录`;
    return { title, path: '/pages/index/index?from=share' };
  },

  onShareTimeline() {
    const state = core.normalizeState(this.data.state);
    const rank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    return { title: `《步云录》${state.name || '匿名玩家'} · ${rank.short}`, query: 'from=timeline' };
  },

  buildPatch(stateOverride) {
    const state = core.normalizeState(stateOverride || this.data.state || core.newState());
    const rank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    const compensation = core.annualCompensation(state);
    const watchCount = state.promotionAdUsedYear === state.year ? state.promotionAdWatchCount : 0;
    const net = networkView(state);
    const expenses = core.annualExpenses(state);
    return {
      state,
      nameKicker: '生涯简报',
      careerTitle: state.name ? `${state.name} · ${rank.name}` : rank.name,
      honor: honorView(state),
      lifeText: `${state.houseName}　${state.carName}　${state.relationship}${state.partner ? `·${state.partner}` : ''}　子女 ${state.children}`,
      progress: (state.rankIndex - 1) / (core.RANKS.length - 1),
      quarterText: quarterName(state.quarter),
      wealthText: `现金 ${money(state.money)}　公积金 ${money(state.providentFund)}　职业年金 ${money(state.annuity)}`,
      compensationText: `年度待遇 ${money(compensation.salary)}（岗位津补贴 ${money(compensation.allowance)}）`,
      expenseText: `预计年度开销 ${money(expenses.total)}（${expenseBreakdown(expenses)}）`,
      loanText: this.loanText(state),
      reviewText: state.quarter === 1 ? `上一年度考核：${state.lastReview}` : '本年度考核：累计进行中',
      lastResult: state.lastResult,
      metrics: [
        { label: '本年度考核', value: state.review, tone: 'gold' },
        { label: '累计政绩', value: state.achievements, tone: 'green' },
        { label: '累计过失', value: state.faults, tone: 'red', action: 'faultBribe' },
        { label: '健康值', value: state.health, tone: state.health < 40 ? 'red' : 'blue' },
        { label: '落马风险', value: net.risk, tone: net.risk >= 50 ? 'red' : net.risk >= 30 ? 'gold' : 'green' },
      ],
      promotionChanceText: state.rankIndex >= core.RANKS.length ? '已达最高职级' : `${Math.floor(core.currentPromotionChance(state, state.rankIndex + 1) * 100)}%`,
      promotionStatusText: state.rankIndex >= core.RANKS.length ? '已达最高职级' : state.promotionAppliedYear === state.year ? '今年已使用' : '今年未使用',
      adText: `本年度晋升广告加成：已完整观看${watchCount}次，累计 +${watchCount * 3}%（观看次数不限，最终概率最高100%）`,
      navActions: navActionsFor(this.data.activeNav),
      annualPerformanceLabel: `${state.annualPerformance >= 0 ? '+' : ''}${state.annualPerformance}`,
      net,
    };
  },

  refresh(extra) {
    const patch = this.buildPatch();
    if (extra) Object.assign(patch, extra);
    this.setData(patch);
  },

  loanText(state) {
    const loans = [];
    if (state.houseLoanYears > 0) loans.push(`房贷剩余${state.houseLoanYears}年·${money(state.houseLoanBalance)}`);
    if (state.carLoanYears > 0) loans.push(`车贷剩余${state.carLoanYears}年·${money(state.carLoanBalance)}`);
    return loans.length ? loans.join('　') : '贷款状态：无在途贷款';
  },

  persist(extra) { storage.save(this.data.state); this.refresh(extra); },

  noop() {},

  // ── 免广告卡（虚拟支付）──────────────────────────────────────────
  // 余额只认服务端。本地不缓存张数，页面显示的永远是最近一次查到的服务端值。

  // 支付状态一律从 this._payRaw 派生后整块 setData。
  // 不要写成 setData({ 'pay.balance': n, 'pay.priceText': f(this.data.pay.balance) })——
  // 对象字面量里的 this.data.pay.balance 是上一轮的值，文案会慢一拍。
  setPay(patch) {
    this._payRaw = Object.assign({}, this._payRaw || {}, patch);
    this.setData({ pay: payView(this._payRaw) });
  },

  refreshPay() {
    // 买卡和用卡是两件事：买卡要客户端支持虚拟支付，用卡只要服务端能连上。
    // 不能因为"这里买不了"就把已经买过卡的人一起关在门外，所以余额总是先拉一次。
    if (virtualPay.isConfigured()) this.refreshPayBalance();
    // 每一条分支都要写清楚原因：真机上只能看到"暂未开放"四个字，没有原因等于没法排查
    if (!virtualPay.isConfigured()) return this.setPay({ enabled: false, reason: '小程序未配置支付服务地址' });
    if (!virtualPay.isSupported()) return this.setPay({ enabled: false, reason: '当前环境不支持虚拟支付购买（真机 + 微信 8.0 以上才支持，开发者工具里一律不支持）；已有免广告卡仍可正常使用' });
    return virtualPay.fetchStatus().then(status => {
      if (!status || !status.enabled) return this.setPay({ enabled: false, reason: '服务端未开启虚拟支付（缺少支付密钥或商品未上架）' });
      this.setPay({
        enabled: true,
        reason: '',
        cardsPerUnit: Number(status.cardsPerUnit) || adCardCardsPerUnit,
        // 价格以后台配置为准，config.js 里的只是拿不到服务端值时的兜底
        priceYuan: Number(status.goodsPrice) > 0 ? Number(status.goodsPrice) / 100 : adCardPriceYuan,
      });
      return this.refreshPayBalance();
    }).catch(error => {
      // 真机最常见的一条：域名没进 request 合法域名白名单，wx.request 直接失败
      const detail = error && (error.message || error.errMsg) ? String(error.message || error.errMsg) : '未知错误';
      return this.setPay({ enabled: false, reason: `连不上支付服务（${detail}）。真机调试请检查 request 合法域名里有没有 ${leaderboardApiBaseUrl}` });
    });
  },

  refreshPayBalance() {
    // 不要求"能买"：只要服务地址配了就去问一次余额，买过的卡在哪都能用
    if (!virtualPay.isConfigured()) return Promise.resolve(null);
    return virtualPay.safeBalance().then(result => {
      if (result.ok) this.setPay({ balance: result.balance || 0 });
      return result;
    });
  },

  consumeAdCard(options) {
    const opts = options || {};
    this._payBusy = true;
    wx.showLoading({ title: '正在扣除免广告卡', mask: true });
    const finish = () => { this._payBusy = false; wx.hideLoading(); };
    return virtualPay.consume(opts.scene || '').then(result => {
      finish();
      if (result && result.ok) {
        this.setPay({ balance: Number(result.balance) || 0 });
        wx.showToast({ title: '已使用 1 张免广告卡', icon: 'none' });
        return opts.reward();
      }
      // 本地显示有卡、服务端说没有：以服务端为准，改走广告，不让玩家卡在这一步
      if (result && result.reason === 'empty') this.setPay({ balance: 0 });
      return this.playRewardedVideo(opts);
    }).catch(() => {
      finish();
      return this.playRewardedVideo(opts);
    });
  },

  playRewardedVideo(options) {
    const opts = options || {};
    if (this._rewardedAdPending) return wx.showToast({ title: '广告正在加载，请稍候', icon: 'none' });
    const ad = getRewardedAd(opts.adUnitId);
    if (!ad) return wx.showToast({ title: '当前环境暂不支持广告', icon: 'none' });
    this._rewardedAdPending = success => {
      if (!success) return wx.showToast({ title: opts.interruptText || '广告未完整观看，操作未生效', icon: 'none' });
      return opts.reward();
    };
    console.log('激励视频广告开始展示', opts.adUnitId);
    ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => settleRewardedAd(false)));
  },

  showAdCard() {
    const pay = this.data.pay || {};
    if (!pay.enabled) {
      // 把"为什么没开放"摆出来：真机上没有控制台，看不出是域名、基础库还是服务端的问题。
      // 有卡的人优先看到余额——他买过的东西不能只显示"暂未开放"。
      const balance = this.cardBalance();
      const content = balance > 0
        ? `当前余额：${balance} 张\n\n已有免广告卡，在需要看广告的地方会直接扣卡跳过。${pay.reason ? `\n\n当前暂不能购买：${pay.reason}` : ''}`
        : `暂未开放，稍后再来看看。${pay.reason ? `\n\n原因：${pay.reason}` : ''}`;
      return this.showModal({ title: pay.name || adCardName, content, showCancel: false });
    }
    const lines = [
      `当前余额：${pay.balance} 张`,
      `售价：${pay.priceText}`,
      '',
      '晋升加成等需要看激励广告的地方，有卡时会自动扣 1 张直接跳过。',
      '余额记在服务端，换设备或清缓存都不会丢。',
      '',
      '购买提示：卡是虚拟商品，售出后不退；支付后通常几秒内到账，没到账稍等片刻再查余额，别重复购买；余额以服务端显示为准。',
    ];
    this.showModal({
      title: pay.name || adCardName,
      content: lines.join('\n'),
      confirmText: '购买',
      cancelText: '返回',
      success: result => { if (result.confirm) this.chooseAdCardAmount(); },
    });
  },

  // 买多少张：预设档位 + 自定义。金额 = 份数 × 后台单价，份数由服务端重新夹取范围。
  chooseAdCardAmount() {
    const pay = this.data.pay || {};
    const perUnit = Number(pay.cardsPerUnit) > 0 ? Number(pay.cardsPerUnit) : adCardCardsPerUnit;
    const priceYuan = Number(pay.priceYuan) > 0 ? Number(pay.priceYuan) : adCardPriceYuan;
    const yuan = value => (Number(value) % 1 === 0 ? `￥${Math.round(Number(value))}` : `￥${Number(value).toFixed(2)}`);
    // priceYuan 是「每份」的单价（后台道具价），不是每张 —— 金额 = 份数 × priceYuan
    const items = AD_CARD_PRESET_CARDS.map(cards => `${cards} 张 · ${yuan((cards / perUnit) * priceYuan)}`);
    items.push('自定义数量');
    this.showActionSheet({
      title: `购买${pay.name || adCardName}`,
      content: `当前余额 ${pay.balance} 张 · ${pay.priceText}`,
      itemList: items,
      success: ({ tapIndex }) => {
        if (tapIndex >= AD_CARD_PRESET_CARDS.length) return this.showCustomAdCardAmount();
        return this.buyAdCard(AD_CARD_PRESET_CARDS[tapIndex]);
      },
    });
  },

  showCustomAdCardAmount() {
    const pay = this.data.pay || {};
    const perUnit = Number(pay.cardsPerUnit) > 0 ? Number(pay.cardsPerUnit) : adCardCardsPerUnit;
    const maxCards = 1000 * perUnit; // 与服务端 normalizeQuantity 的份数上限一致
    this.showModal({
      mode: 'amount',
      title: `购买${pay.name || adCardName}`,
      content: `${pay.priceText}。一次最多 ${maxCards} 张。`,
      inputLabel: '购买数量',
      inputUnit: '张',
      // 不给默认数字：默认值容易被顺手点成下单，买多少让玩家自己填
      inputValue: '',
      inputPlaceholder: '输入要买的数量',
      confirmText: '购买',
      cancelText: '返回',
      success: result => {
        if (!result.confirm) return;
        const cards = Math.floor(Number(result.value));
        if (!Number.isFinite(cards) || cards < 1) return wx.showToast({ title: '请输入要购买的数量', icon: 'none' });
        return this.buyAdCard(cards);
      },
    });
  },

  // rawCards 是要买的「张数」；份数 = 张数 / cardsPerUnit，最终范围由服务端夹取
  buyAdCard(rawCards) {
    const pay = this.data.pay || {};
    if (pay.buying) return;
    if (!virtualPay.isSupported()) return this.showModal({ title: '无法购买', content: '当前微信版本不支持虚拟支付，请更新微信后再试。', showCancel: false });
    const version = virtualPay.checkClientVersion();
    if (!version.ok) return this.showModal({ title: '无法购买', content: version.reason, showCancel: false });
    const perUnit = Number(pay.cardsPerUnit) > 0 ? Number(pay.cardsPerUnit) : adCardCardsPerUnit;
    const cards = Math.max(perUnit, Math.floor(Number(rawCards) || perUnit));
    // 向下取整：份数只能少不能多，不能让玩家为没输入的份额多付钱
    const quantity = Math.max(1, Math.min(1000, Math.floor(cards / perUnit)));
    this.setPay({ buying: true });
    // 窗口默认 15s / 1.5s，只有调优和测试会覆盖它
    return virtualPay.purchase({ quantity, timeoutMs: this._payWaitMs, pollMs: this._payPollMs }).then(result => {
      this.setPay({ buying: false });
      if (result.cancelled) return;
      if (result.ok && result.pending) {
        return this.showModal({
          title: '支付成功',
          content: `${pay.name || adCardName}正在到账，通常几秒内完成。\n稍后回到这里就能看到最新余额。`,
          showCancel: false,
          success: () => this.refreshPayBalance(),
        });
      }
      if (result.ok) {
        const balance = Number(result.balance) || 0;
        this.setPay({ balance });
        return this.showModal({ title: '购买成功', content: `已到账 ${result.cards} 张${pay.name || adCardName}，当前余额 ${balance} 张。`, showCancel: false });
      }
      return this.showModal({ title: '购买未完成', content: result.message || '支付未完成，请稍后重试。', showCancel: false });
    }).catch(error => {
      this.setPay({ buying: false });
      // 服务端还没配支付密钥会返回 503，这种情况把入口收掉，免得用户反复点
      if (error && error.statusCode === 503) {
        this.setPay({ enabled: false });
        return this.showModal({ title: '暂未开放', content: '免广告卡暂未开放购买，稍后再来看看。', showCancel: false });
      }
      return this.showModal({ title: '购买未完成', content: (error && error.message) || '支付未完成，请稍后重试。', showCancel: false });
    });
  },

  showModal(options, extra) {
    this._dialogOptions = options || {};
    const opts = this._dialogOptions;
    const patch = { dialog: { visible: true, mode: opts.mode || 'modal', tone: opts.tone || '', title: opts.title || '', content: opts.content || '', rows: opts.rows || [], confirmText: opts.confirmText || '确定', cancelText: opts.cancelText || '取消', showCancel: opts.showCancel !== false, items: [], inputValue: opts.inputValue || '', inputPlaceholder: opts.inputPlaceholder || '', inputLabel: opts.inputLabel || '', inputUnit: opts.inputUnit || '', shareAction: opts.shareAction || '', shareReady: !!opts.shareReady } };
    if (extra) Object.assign(patch, extra);
    this.setData(patch);
  },

  showActionSheet(options, extra) {
    this._dialogOptions = options || {};
    const opts = this._dialogOptions;
    // content 传空字符串表示"这一栏整个不要"（区别于不传，不传时给默认提示）
    const content = opts.content == null ? '轻触下方选项继续' : opts.content;
    const patch = { dialog: { visible: true, mode: 'actions', tone: opts.tone || '', title: opts.title || '请选择一项', content, rows: [], confirmText: '', cancelText: opts.cancelText || '取消', showCancel: true, items: opts.itemList || [], inputValue: '', inputPlaceholder: '', shareAction: '', shareReady: false } };
    if (extra) Object.assign(patch, extra);
    this.setData(patch);
  },

  closeDialog() {
    const mode = this.data.dialog.mode;
    this.setData({ 'dialog.visible': false });
    const opts = this._dialogOptions;
    this._dialogOptions = null;
    if (opts && opts.success && mode !== 'actions') opts.success({ confirm: false, cancel: true, value: this.data.dialog.inputValue });
  },

  dialogConfirm() {
    const opts = this._dialogOptions;
    const value = this.data.dialog.inputValue;
    this.setData({ 'dialog.visible': false });
    this._dialogOptions = null;
    if (opts && opts.success) opts.success({ confirm: true, cancel: false, value });
  },

  dialogAmountInput(event) {
    const value = String(event.detail.value || '').replace(/\D/g, '').slice(0, 9);
    const ready = this.data.dialog.shareAction === 'faultHelp' && !this.faultHelpBlocked(Math.floor(Number(value)));
    this.setData({ 'dialog.inputValue': value, 'dialog.shareReady': ready });
  },

  dialogSelect(event) {
    const index = Number(event.currentTarget.dataset.index);
    const opts = this._dialogOptions;
    this.setData({ 'dialog.visible': false });
    this._dialogOptions = null;
    if (opts && opts.success) opts.success({ tapIndex: index });
  },

  startQuarter() {
    const state = this.data.state;
    if (state.ended) return this.showEnding();
    if (state.rankIndex >= 3 && state.currentPosition === '待选择具体岗位') return this.choosePosition();
    const sourceEvent = core.startQuarter(state);
    const event = Object.assign({}, sourceEvent, { options: shuffled(sourceEvent.options || []) });
    this.setData({ state: core.normalizeState(state), currentEvent: event, scrollIntoView: '' });
  },

  selectEventOption(event) {
    const index = Number(event.currentTarget.dataset.index);
    const currentEvent = this.data.currentEvent;
    if (!currentEvent || !currentEvent.options || !currentEvent.options[index]) return;
    this.resolveEvent(currentEvent, index);
  },

  cancelEvent() {
    this.setData({ currentEvent: null });
  },

  resolveEvent(event, optionIndex) {
    const state = this.data.state;
    if (!core.resolveEvent(state, event, optionIndex)) return;
    // 先留下本次选择的实际后果（可能来自条件强化或概率分支），
    // 因为 finishQuarter 会用自己的结算文案覆盖 lastResult。
    const outcome = state.lastResult;
    const result = core.finishQuarter(state);
    storage.save(state);
    const patch = this.buildPatch();
    patch.currentEvent = null;
    const honorNotice = result.leaderHonor
      ? '\n\n同志们从今往后这样称呼你——领导者 · 人民公仆。\n\n'
        + '走到更高的位置，不是为了让更多人仰望，而是为了看见更远的困难、承担更重的责任。'
        + '\n真正的领导者，既要在纷繁局面中守住原则，也要听得进逆耳之言；既要敢于决断，也要为每一个决定留下经得起检验的结果。'
        + '\n心中常有百姓，脚下才有方向；手中握有权力，更应懂得克制与敬畏。'
        + '\n愿你不因顺境忘本，不因压力失守，不以一时得失改初心。把功劳留给众人，把责任担在自己肩上，行稳致远，方不负人民所托。'
      : result.honor
      ? '\n\n同志们从今往后这样称呼你——人民公仆。\n\n'
        + '身居高位，更知敬畏。权力源自人民的托付，权重一分，责任便重一分。'
        + '\n常问百姓冷暖，多谋长远之事，少虑个人进退。'
        + '\n为政当慎独慎微，一言一行皆在人民眼中；处世当虚怀若谷，多听逆耳之言，多纳务实之策。'
        + '\n功过自有历史评说，民心便是最好的丰碑。初心如始，行稳致远，方不负人民所托。'
      : '';
    this.showModal({
      title: result.annual ? '年度结算' : `${quarterName(state.quarter === 1 ? 4 : state.quarter - 1)}完成`,
      content: `${outcome}\n\n${state.lastResult}${honorNotice}`,
      showCancel: false,
      success: () => {
        if (result.promoted) return this.choosePosition(() => this.showPromotionResult('', () => this.maybeBurstEvent()));
        if (state.ended) return this.showEnding();
        return this.maybeBurstEvent();
      },
    }, patch);
  },

  // ── 突发事件 ──────────────────────────────────────────────────────
  // 处理完一个季度的事项之后，可能突然弹出来：有人送东西、有人拉你入股、
  // 老领导打来电话……它不占本季度事项，但必须当场表态，不能放着不管。

  burstTip(state, kind) {
    if (kind === 'evidenceWarning') return '这是本段生涯唯一一次处置机会，选择后立即生效。';
    if (kind === 'escapeMethod') return '只能选择一种交通方式；结果由本局存档固定。';
    if (kind === 'interrogation') return '这一次谈话之后，事情不会再有别的可能了。';
    if (kind === 'review') return '专项倒查由此前累积的往来触发，这一次必须给出说明。';
    if (kind === 'fellowFall') return '关系网里有人先倒了，他的材料里有没有你，取决于你现在怎么处理。';
    if ((state.riskTrail || 0) >= 3) return '近期有几笔往来，你不太愿意再想起。';
    return '突发事件不占本季度事项，但必须当场表态。';
  },

  // 弹窗右上角的角标。审讯和有人落马都是被别人的事牵出来的，
  // 和普通的"有人送东西"性质不同，得让玩家一眼看出这不是同一类事。
  burstFlag(kind) {
    if (kind === 'evidenceWarning') return '证据提醒';
    if (kind === 'escapeMethod') return '结局判定';
    if (kind === 'interrogation') return '组织谈话';
    if (kind === 'review') return '专项倒查';
    if (kind === 'fellowFall') return '牵连';
    return '突发';
  },

  maybeBurstEvent() {
    const state = this.data.state;
    if (state.ended) return false;
    const picked = core.pickBurst(state);
    if (!picked) return false;
    const event = Object.assign({}, picked.event, { options: shuffled(picked.event.options || []) });
    // kind 决定后面用哪个结算函数，也决定弹窗的提示语。
    // 审讯是终局事件，必须走 resolveInterrogation，不能用通用的 resolveBurst。
    this._burstEvent = event;
    this._burstKind = picked.kind || (picked.review ? 'review' : 'normal');
    this._burstReview = !!picked.review;
    storage.save(state);
    this.setData({
      state: core.normalizeState(state),
      burst: {
        visible: true,
        review: !!picked.review,
        flag: this.burstFlag(this._burstKind),
        tag: picked.event.tag || '突发',
        title: picked.event.title,
        scene: picked.event.scene,
        tip: this.burstTip(state, this._burstKind),
        options: event.options,
      },
    });
    return true;
  },

  selectBurstOption(event) {
    const index = Number(event.currentTarget.dataset.index);
    const burstEvent = this._burstEvent;
    if (!burstEvent || !burstEvent.options || !burstEvent.options[index]) return;
    const kind = this._burstKind || 'normal';
    const isReview = kind === 'review';
    const state = this.data.state;
    if (kind === 'interrogation') core.resolveInterrogation(state, burstEvent, index);
    else if (kind === 'evidenceWarning') core.resolveEvidenceWarning(state, burstEvent, index);
    else if (kind === 'escapeMethod') core.resolveEscapeMethod(state, burstEvent, index);
    else core.resolveBurst(state, burstEvent, index, Math.random, isReview);
    const hasFollowUp = !!(state.pendingEvidenceWarning || state.pendingInterrogation);
    this._burstEvent = null;
    this._burstKind = 'normal';
    this._burstReview = false;
    storage.save(state);
    const patch = this.buildPatch();
    patch.burst = { visible: false, review: false, flag: '', tag: '', title: '', scene: '', tip: '', options: [] };
    // buildPatch 取的 lastResult 正是本次突发事件的结果，直接展示给玩家看后果。
    // 审讯落马会把 ended 置真，于是紧接着弹出结局页。
    this.showModal({
      tone: kind === 'escapeMethod' && state.ending === '出逃结局'
        ? 'warning'
        : kind === 'interrogation' || !!state.fallDetail || (kind === 'escapeMethod' && !!state.pendingInterrogation) ? 'danger' : '',
      title: kind === 'interrogation' ? '处理结论' : kind === 'evidenceWarning' ? '处置结果' : kind === 'escapeMethod' ? '去向判定' : !!state.fallDetail ? '作风问题处理结论' : isReview ? '专项倒查结果' : `突发 · ${burstEvent.tag || '事项'}`,
      content: `${kind === 'interrogation' ? '经组织审查，相关事实和证据已完成核查，现作出如下处理结论。\n\n' : ''}${burstEvent.title}\n\n${state.lastResult}`,
      showCancel: false,
      success: () => { if (state.ended) this.showEnding(); else if (hasFollowUp) this.maybeBurstEvent(); },
    }, patch);
  },

  showPromotionPath() {
    const state = this.data.state; const next = core.RANKS[state.rankIndex];
    const lines = ['满足资历、考核、口碑、人脉与廉政条件后，可在年度节点争取晋升。', state.promotionAppliedYear === state.year ? '本年度晋升申请：已使用，下一年度可再次申请。' : '本年度晋升申请：未使用。'];
    core.RANKS.forEach((rank, index) => {
      lines.push(`${index + 1}. ${rank.name}　[${index + 1 < state.rankIndex ? '已完成' : index + 1 === state.rankIndex ? '当前' : '待解锁'}]`);
      if (index + 1 > state.rankIndex && index + 1 <= state.rankIndex + 2) lines.push(`　${requirementText(state, rank, index + 1)}`);
    });
    lines.push('', this.data.adText);
    const cardBalance = this.cardBalance();
    const actions = [];
    if (next) actions.push(state.promotionAppliedYear === state.year ? '本年度已申请晋升' : core.isQualified(state, next) ? '尝试年度晋升' : '查看晋升条件');
    // 有卡时把「用卡」放在最上面（一眼知道可以省掉这次广告），但看广告的选项保留 ——
    // 有卡不等于必须用卡，有的玩家想省着卡用在更要紧的地方。
    if (cardBalance > 0) actions.push(`用免广告卡，晋升概率+3%（剩${cardBalance}张）`);
    actions.push('看广告，晋升概率+3%');
    this.showActionSheet({ title: '完整晋升路线', content: lines.join('\n'), itemList: actions, cancelText: '返回', success: (res) => {
      const selected = actions[res.tapIndex];
      if (!selected) return;
      if (selected.startsWith('用免广告卡')) return this.usePromotionAdCard();
      if (selected.startsWith('看广告')) return this.watchPromotionAd();
      if (state.promotionAppliedYear === state.year) return this.showModal({ title: '晋升申请', content: '本年度晋升申请机会已经使用。\n无论本次申请成功或失败，本年度都不能重复申请。\n下一自然年度将恢复申请资格。', showCancel: false });
      if (!core.isQualified(state, next)) return this.showModal({ title: '晋升条件', content: `${next.name}\n${requirementText(state, next, state.rankIndex + 1)}\n当前状态：任职${state.rankYears}年，考核${state.review}，口碑${state.reputation}，人脉${state.network}`, showCancel: false });
      return this.tryPromotion();
    } });
  },

  // 本地已知的卡数。以最近一次服务端查询为准，没查到就是 0（此时会走广告）。
  // 注意只看余额、不看 enabled：enabled 说的是"这里能不能买"，
  // 买不了卡的地方（老基础库、开发者工具、服务端临时不可购买）已经到手的卡照样能用，
  // 否则玩家充了钱却因为环境不支持购买而用不掉，等于白买。
  cardBalance() {
    const raw = this._payRaw || {};
    return Math.max(0, Math.floor(Number(raw.balance) || 0));
  },

  tryPromotion() {
    const state = this.data.state; const next = core.RANKS[state.rankIndex];
    if (!next) return wx.showToast({ title: '已达到最高职级', icon: 'none' });
    if (state.promotionAppliedYear === state.year) return wx.showToast({ title: '本年度申请机会已使用', icon: 'none' });
    if (!core.isQualified(state, next)) return wx.showToast({ title: '当前条件尚未达标', icon: 'none' });
    state.promotionAppliedYear = state.year;
    const chance = core.currentPromotionChance(state, state.rankIndex + 1);
    if (Math.random() >= chance) { state.lastResult = '本次晋升考察暂未通过，你的任职资历会继续保留。'; core.addRecord(state, `参加${next.name}晋升考察，本次暂未通过。`); this.persist(); return this.showModal({ title: '晋升结果', content: `本次考察暂未通过。\n当前晋升机会为${Math.floor(chance * 100)}%，资历和属性不会扣除。\n继续保持良好考核，可在后续年度再次争取。`, showCancel: false }); }
    const bonusPoints = state.promotionAdUsedYear === state.year ? state.promotionAdWatchCount * 3 : 0;
    const bonusText = bonusPoints > 0 ? `（含广告累计加成${bonusPoints}%）` : '';
    state.rankIndex += 1; state.rankYears = 0; state.previousPosition = state.currentPosition; state.currentPosition = state.rankIndex >= 3 ? '待选择具体岗位' : '非领导职级'; state.dutyType = core.RANKS[state.rankIndex - 1].dutyType; state.lastResult = `通过竞争与考察，你迎来了新的职级变化。${bonusText}`; core.addRecord(state, `以${Math.floor(chance * 100)}%晋升机会${bonusText}晋升至${core.RANKS[state.rankIndex - 1].name}。`); this.persist(); this.choosePosition(() => this.showPromotionResult());
  },

  watchPromotionAd() {
    return this.playRewardedVideo({
      scene: 'promotion',
      adUnitId: rewardedAdUnitId,
      interruptText: '广告未完整观看，未获得加成',
      reward: () => this.grantPromotionBonus(),
    });
  },

  usePromotionAdCard() {
    if (this._payBusy) return wx.showToast({ title: '处理中，请稍候', icon: 'none' });
    return this.consumeAdCard({
      scene: 'promotion',
      adUnitId: rewardedAdUnitId,
      interruptText: '广告未完整观看，未获得加成',
      reward: () => this.grantPromotionBonus(),
    });
  },

  grantPromotionBonus() {
    const state = this.data.state;
    if (state.promotionAdUsedYear !== state.year) { state.promotionAdUsedYear = state.year; state.promotionAdWatchCount = 0; state.promotionAdBonus = 0; }
    state.promotionAdWatchCount += 1;
    state.promotionAdBonus = state.promotionAdWatchCount * 0.03;
    // 走卡还是走广告都会走到这里，记录文案不区分渠道，免得履历里出现自相矛盾的描述
    core.addRecord(state, `领取本年度晋升激励加成，累计增加${state.promotionAdWatchCount * 3}%。`);
    this.persist();
    wx.showToast({ title: '晋升概率 +3%', icon: 'success' });
  },

  handleMetricAction(event) {
    if (event.currentTarget.dataset.action !== 'faultBribe') return;
    if (this.data.state.faultHelpUsedYear === this.data.state.year) {
      return this.showModal({ title: '累计过失处理', content: '本年度请领导拉一把机会已经使用，下一自然年度恢复。', showCancel: false });
    }
    this.openFaultHelpDialog();
  },

  openFaultHelpDialog(errorText) {
    const state = this.data.state;
    const rankLimited = state.rankIndex >= 8;
    const error = errorText ? `\n${errorText}` : '';
    const previousValue = this.data.dialog && this.data.dialog.inputValue ? this.data.dialog.inputValue : '';
    this.showModal({
      mode: 'amount',
      title: '累计过失处理',
      content: `当前累计过失：${state.faults}\n本年度请领导拉一把机会：${state.faultHelpUsedYear === state.year ? '已使用' : '未使用'}\n可用现金存款：${money(state.money)}\n输入本次支出金额（金额自定，金额越高破格晋升机会越大）。成功减少2点累计过失，失败增加1点；成功后有机会破格晋升。确认金额后请转发给好友，完成本次请求。${rankLimited ? '\n当前已达厅局级正职或以上，不再适用破格晋升。' : ''}${error}`,
      inputValue: previousValue,
      inputPlaceholder: '请输入金额（元）',
      confirmText: '寻求领导的帮助',
      cancelText: '取消',
      shareAction: 'faultHelp',
      shareReady: false,
    });
  },

  submitFaultHelp(value) {
    const amount = Math.floor(Number(value));
    const blocked = this.faultHelpBlocked(amount);
    if (blocked) return this.openFaultHelpDialog(blocked);
    this.setData({ 'dialog.inputValue': String(amount), 'dialog.shareReady': true });
  },

  // 用卡之前先确认这次操作一定成立。
  // 卡扣掉了却什么都没发生是最糟的体验，而这三个条件都能提前判断。
  faultHelpBlocked(amount) {
    const state = this.data.state;
    if (!Number.isFinite(amount) || amount <= 0) return '请输入大于0元的金额。';
    if (amount > state.money) return '现金存款不足，请重新输入金额。';
    if (state.faultHelpUsedYear === state.year) return '本年度请领导拉一把机会已使用，下一年度恢复。';
    return '';
  },

  shareFaultHelp() {
    const state = this.data.state;
    const amount = Math.floor(Number(this.data.dialog.inputValue));
    const blocked = this.faultHelpBlocked(amount);
    if (blocked) return this.openFaultHelpDialog(blocked);
    this._sharePayload = {
      title: `这个时候有领导拉我${state.name || ''}一把，卑职为他做牛做马`,
      path: '/pages/index/index?from=fault-help-share',
    };
    this.setData({ 'dialog.visible': false });
    this._dialogOptions = null;
    this.grantFaultHelp(amount);
  },

  grantFaultHelp(amount) {
    const result = core.resolveFaultHelp(this.data.state, amount);
    if (!result.ok) return this.openFaultHelpDialog(result.reason);
    this.persist();
    if (result.promoted) return this.choosePosition(() => this.showPromotionResult(result.leaderMessage));
    this.showModal({ title: result.favorable ? '领导愿意拉你一把' : '未能得到帮助', content: this.data.state.lastResult, showCancel: false });
  },

  showPromotionResult(extraText, onDone) {
    const state = this.data.state; const rank = core.RANKS[state.rankIndex - 1];
    const prior = state.previousPosition && state.currentPosition !== '待选择具体岗位' ? `上一任职：${state.previousPosition}；本次：${state.currentPosition}\n` : '';
    const profile = `姓名：${state.name || '匿名玩家'}\n当前年龄：${state.age}岁　当前年度：${state.year}年\n`;
    const message = extraText ? `${extraText}\n` : '';
    this.showModal({ title: '晋升结果', content: `${profile}${message}恭喜，你已晋升为${rank.name}。\n${prior}新的岗位意味着更多责任，也意味着新的成长空间。\n本职级退休参考年龄：${rank.retirementAge || 65}岁\n具体岗位：${state.currentPosition}`, showCancel: false, success: () => { if (typeof onDone === 'function') onDone(); } });
  },

  choosePosition(onComplete) {
    const state = this.data.state; const all = core.POSITION_OPTIONS[state.rankIndex] || [];
    if (!all.length) { if (state.rankIndex < 3) state.currentPosition = '非领导职级'; this.persist(); if (onComplete) onComplete(); return; }
    const lines = [`你已进入${core.RANKS[state.rankIndex - 1].name}，本次任满考察后可选择新的任职方向。`, state.previousPosition ? `上一任职岗位：${state.previousPosition}` : '本次为首次领导岗位分流。', '岗位选择会在履满晋升后重新开放；政绩、廉政和岗位经历共同影响后续发展。'];
    all.forEach(position => lines.push(`· ${position.group || '任职方向'}｜${position.name}（${position.level || '对应岗位'}）：${position.description}〔${positionUnlockText(state, position)}〕`));
    this.showModal({ title: '任职方向选择', content: lines.join('\n'), confirmText: '选择岗位', cancelText: '稍后选择', success: (modal) => {
      if (!modal.confirm) return;
      const options = shuffled(all.filter(position => core.positionAvailable(state, position.name)));
      if (!options.length) return wx.showToast({ title: '当前没有满足条件的岗位', icon: 'none' });
      this.showPositionChoices(options, onComplete);
    } });
  },

  showPositionChoices(options, onComplete) {
    const select = list => this.showActionSheet({ itemList: list.map(position => position.name), success: (res) => { core.choosePosition(this.data.state, list[res.tapIndex].name); this.persist(); if (onComplete) onComplete(); } });
    if (options.length <= 6) return select(options);
    const groups = [];
    options.forEach(position => { const name = position.group || '任职方向'; let group = groups.find(item => item.name === name); if (!group) { group = { name, positions: [] }; groups.push(group); } group.positions.push(position); });
    this.showActionSheet({ itemList: groups.map(group => group.name), success: (res) => select(groups[res.tapIndex].positions) });
  },

  showStats() {
    const state = this.data.state; const rank = core.RANKS[state.rankIndex - 1]; const next = core.RANKS[state.rankIndex];
    const honor = honorView(state);
    const lines = [`职务类型：${state.dutyType}`, `当前职级：${rank.name}`, `岗位层级：${state.positionLevel}`, `本职级退休参考年龄：${rank.retirementAge || 65}岁`, `具体岗位：${state.currentPosition}`, honor.awarded ? `同志们这样称呼你：${honor.title}（${honor.year}年）` : `称呼条件：${honor.requirement}`, `累计政绩：${state.achievements}　累计过失：${state.faults}`, `落马风险：${this.data.net.risk}/100（${this.data.net.level}）`, (Number(state.illicitIncome) || 0) > 0 ? `累计不当收入：${money(state.illicitIncome)}　${network.illicitRiskNote(state)}` : '累计不当收入：无', `上年度政绩：+${state.lastAnnualAchievements}　上年度过失：+${state.lastAnnualFaults}`, `本年度晋升申请：${state.promotionAppliedYear === state.year ? '已使用' : '未使用'}`, this.data.adText, `当前级别监督核查概率：${Math.floor(core.investigationChance(state.rankIndex) * 100)}%`, next ? `下一职级任用条件：${requirementText(state, next, state.rankIndex + 1)}` : '已达到最高职级', this.data.compensationText, `预计年度开销：${money(core.annualExpenses(state).total)}${state.lastAnnualExpense ? `，上年度实际${money(state.lastAnnualExpense)}` : ''}`, this.data.wealthText, `年度考核：${state.lastReview}`, `最近经历：${state.lastResult}`];
    this.showModal({ title: '成长档案', content: lines.join('\n'), showCancel: false });
  },

  // 关系网入口已下线（菜单与详情页均移除），落马机制仍在游戏中运转：
  // 风险照常累积，主页的「落马风险」指标也保留，玩家只是看不到人员明细了。
  // showNetwork 已删除；showLeaderboard 保留给人生结局页的「查看排行榜」。

  // 老虎榜：只上真实落马记录，服务端不做样本（查处财产是"指控性"信息，
  // 编一条假的就是造谣）。离线时最多显示本机自己的落马记录。
  showTigerBoard() {
    const result = leaderboard.getTigerRanking(this.data.state);
    const title = '步云录 · 老虎榜';
    const localRows = leaderboard.tigerRows(result);
    const configured = leaderboardApi.isConfigured();
    this.showModal({ title, rows: configured ? localRows.concat([BOARD_LOADING_ROW]) : localRows, content: '', showCancel: false });
    if (!configured || this._tigerBoardSyncing) return;
    this._tigerBoardSyncing = true;
    // 拉取条数要跟榜面「全网前列」的名额对齐，否则前端最多只能渲染出拉回来的那几条
    leaderboardApi.fetchTigerRanking(leaderboard.BOARD_TOP_SIZE).then(remote => {
      if (this.data.dialog.visible && this.data.dialog.title === title) this.showModal({ title, rows: leaderboardApi.tigerRows(remote), content: '', showCancel: false });
    }).catch(() => {
      if (this.data.dialog.visible && this.data.dialog.title === title) this.showModal({ title, rows: localRows.concat([{ kind: 'text', text: '当前无法连接服务器，以上为本机记录。' }]), content: '', showCancel: false });
    }).then(() => {
      this._tigerBoardSyncing = false;
    });
  },

  showEscapeBoard() {
    const result = leaderboard.getEscapeRanking(this.data.state);
    const title = '金蝉榜 · 虚构结局记录';
    const localRows = leaderboard.escapeRows(result);
    const configured = leaderboardApi.isConfigured();
    this.showModal({ title, rows: configured ? localRows.concat([BOARD_LOADING_ROW]) : localRows, content: '', showCancel: false });
    if (!configured || this._escapeBoardSyncing) return;
    this._escapeBoardSyncing = true;
    leaderboardApi.fetchEscapeRanking(leaderboard.BOARD_TOP_SIZE).then(remote => {
      if (this.data.dialog.visible && this.data.dialog.title === title) this.showModal({ title, rows: leaderboardApi.escapeRows(remote), content: '', showCancel: false });
    }).catch(() => {
      if (this.data.dialog.visible && this.data.dialog.title === title) this.showModal({ title, rows: localRows.concat([{ kind: 'text', text: '当前无法连接服务器，以上为本机记录。' }]), content: '', showCancel: false });
    }).then(() => {
      this._escapeBoardSyncing = false;
    });
  },

  showRecords() {
    const state = this.data.state;
    const stories = core.storySummary(state);
    this.showModal({ title: '个人履历与年度记录', content: `年度考核、岗位履历、家庭与资产事项按时间顺序归档。\n\n${stories ? `跨年经历\n${stories}\n\n最近记录\n` : ''}${state.records.map(record => `· ${record}`).join('\n')}`, showCancel: false });
  },

  showAccounts() { const state = this.data.state; this.showModal({ title: '公积金与职业年金', content: `公积金账户余额　${money(state.providentFund)}\n公积金可按规定提取，提取后转入现金账户。\n职业年金账户余额　${money(state.annuity)}\n职业年金作为退休保障长期累计，不支持提前提取。\n${this.data.wealthText}`, confirmText: '账户操作', cancelText: '返回', success: (modal) => { if (!modal.confirm) return; const actions = [{ text: '提取1万元', amount: 10000, label: '1万元' }, { text: '提取5万元', amount: 50000, label: '5万元' }, { text: '提取余额50%', amount: state.providentFund * .5, label: '一半余额' }, { text: '提取全部余额', amount: state.providentFund, label: '全部余额' }]; this.showActionSheet({ itemList: actions.map(item => item.text), success: (res) => { const action = actions[res.tapIndex]; if (core.withdrawProvident(state, action.amount, action.label)) { this.persist(); wx.showToast({ title: '提取成功', icon: 'success' }); } else wx.showToast({ title: '公积金余额不足', icon: 'none' }); } }); } }); },

  buyHouse() { this.buy('house'); },
  buyCar() { this.buy('car'); },
  buy(type) {
    const state = this.data.state; if (state[type === 'house' ? 'hasHouse' : 'hasCar']) return wx.showToast({ title: '已有资产', icon: 'none' });
    const list = type === 'house' ? require('../../game/data').HOUSES : require('../../game/data').CARS;
    this.showActionSheet({ itemList: list.map(item => `${item.name} ¥${item.price / 10000}万 · 全款或${item.years}年分期`), success: (res) => {
      const item = list[res.tapIndex]; const downPayment = Math.floor(item.price * .2); const annualPayment = Math.ceil((item.price - downPayment) * 1.08 / item.years);
      this.showModal({ title: `购置${type === 'house' ? '房产' : '车辆'} · ${item.name}`, content: `总价 ${money(item.price)}\n全款不会产生后续还款。\n分期方案：首付20%（${money(downPayment)}），${item.years}年，每年约${money(annualPayment)}。\n${this.data.wealthText}\n${this.data.loanText}`, confirmText: '选择付款', cancelText: '返回', success: (modal) => {
        if (!modal.confirm) return;
        this.showActionSheet({ itemList: ['全款购买', `首付20% · ${item.years}年分期`], success: (pay) => { const result = core.buyAsset(state, type, item.name, item.price, item.years, pay.tapIndex === 0); if (!result.ok) return wx.showToast({ title: result.reason, icon: 'none' }); this.persist(); wx.showToast({ title: '购置完成', icon: 'success' }); } });
      } });
    } });
  },

  romance() {
    const state = this.data.state;
    if (state.relationship === '单身') {
      const profileLines = core.PARTNER_PROFILES.map(profile => {
        const health = profile.annualHealthCost > 0 ? `健康额外-${profile.annualHealthCost}/年` : profile.annualHealthCost < 0 ? '抵消1点基础健康损耗' : '无额外健康消耗';
        const career = profile.promotionBonus > 0 ? `晋升+${Math.round(profile.promotionBonus * 100)}%` : profile.annualPerformanceCost > 0 ? `年度绩效-${profile.annualPerformanceCost}` : '仕途影响很低';
        return `· ${profile.name}｜${profile.role}\n  ${profile.description}\n  陪伴投入${profile.timeLabel}；${health}；${career}`;
      });
      return this.showModal({ title: '认识伴侣', content: `不同伴侣拥有不同的生活节奏，关系建立后会影响每年健康、时间投入或晋升机会。\n\n${profileLines.join('\n\n')}`, confirmText: '查看选择', cancelText: '返回', success: (modal) => {
        if (!modal.confirm) return;
        const choices = shuffled(core.PARTNER_PROFILES.map(profile => ({
          label: `${profile.name}｜${profile.role} · 陪伴${profile.timeLabel}`,
          profile,
        })).concat({ label: '暂时专注个人成长', focus: true }));
        this.showActionSheet({ itemList: choices.map(choice => choice.label), success: (res) => {
          const choice = choices[res.tapIndex];
          if (choice.focus) { core.focusCareer(state); this.persist(); return; }
          const profile = choice.profile;
          state.partner = profile.name; state.partnerProfileId = profile.id; state.relationship = '相识中'; state.affection = 15; core.applyEffect(state, profile.entryEffect); state.lastResult = `你认识了${state.partner}，你们决定先从朋友开始了解彼此。`; core.addRecord(state, `认识了${state.partner}（${profile.role}），进入相识阶段。`); this.persist();
        } });
      } });
    }
    let labels; let configs;
    if (state.relationship === '相识中') { labels = ['认真约会并倾听近况 · ¥1500', '共同参加志愿活动 · ¥800', '临时取消约定且沟通不足']; configs = [[12, 1500, { health: 1 }, '你认真倾听了对方近期的工作和生活。'], [15, 800, { reputation: 2 }, '你们共同参加了公益活动。'], [-8, 0, { health: -1 }, '你因临时工作取消约定，沟通也不够充分。']]; }
    else if (state.relationship === '恋爱中') { labels = ['安排短途旅行 · ¥5000', '共同规划住房与未来 · ¥1000', '工作繁忙但保持坦诚沟通']; configs = [[14, 5000, { health: 3 }, '你们在短途旅行中增进了了解。'], [12, 1000, { integrity: 1 }, '你们坦诚讨论了住房、工作和家庭规划。'], [6, 0, { seniority: 1 }, '虽然工作繁忙，你仍及时分享近况。']]; if (state.affection >= 60) { labels.unshift('认真求婚并筹备婚礼 · ¥3万'); configs.unshift(['marry', 30000, {}, '']); } }
    else { labels = ['安排家庭日 · ¥3000', '共同承担家务和家庭计划', '因工作忽略家庭沟通']; configs = [[8, 3000, { health: 3 }, '你放下工作，和家人度过了完整的一天。'], [6, 0, { integrity: 1 }, '你们重新分配了家庭事务，彼此更能理解对方。'], [-6, 0, { seniority: 1, health: -1 }, '你把多数时间留给工作，家庭沟通有所减少。']]; if (state.children < 2 && state.affection >= 65) { const cost = state.children === 0 ? 20000 : 25000; labels.unshift(`共同决定迎接第${state.children + 1}个孩子 · ¥${cost / 10000}万`); configs.unshift(['child', cost, {}, '']); } }
    const pairs = labels.map((label, index) => ({ label, config: configs[index] }));
    this.showModal({ title: '伴侣与家庭', content: `伴侣：${state.partner}　关系：${state.relationship}\n${partnerEffectText(state)}\n感情值：${state.affection}/100　共同相处：${state.relationshipYears}年\n每个自然年度可以安排一次重要互动。真诚沟通和共同承担会让关系更稳定。${state.relationship === '恋爱中' && state.affection < 60 ? '\n结婚条件：感情值达到60，目前还需继续相处。' : ''}`, confirmText: '安排互动', cancelText: '返回', success: (modal) => {
      if (!modal.confirm) return;
      const options = shuffled(pairs);
      this.showActionSheet({ itemList: options.map(item => item.label), success: (res) => { const [affection, cost, effect, interactionText] = options[res.tapIndex].config; if (state.lastPartnerActionYear === state.year && affection !== 'marry' && affection !== 'child') return wx.showToast({ title: '本年度已安排互动', icon: 'none' }); if (state.money < cost) return wx.showToast({ title: '现金不足', icon: 'none' }); state.money -= cost; if (affection === 'marry') { state.relationship = '已婚'; state.affection = core.clamp(state.affection + 10, 0, 100); state.lastResult = `你和${state.partner}在亲友祝福下建立了家庭。`; core.addRecord(state, `与${state.partner}结婚，正式建立家庭。`); } else if (affection === 'child') { state.children += 1; state.health = core.clamp(state.health - 2, 0, 100); state.affection = core.clamp(state.affection + 5, 0, 100); core.addRecord(state, `家庭迎来第${state.children}个孩子。`); } else { state.affection = core.clamp(state.affection + affection, 0, 100); state.lastPartnerActionYear = state.year; core.applyEffect(state, effect); let resultText = interactionText; if (state.relationship === '相识中' && state.affection >= 35) { state.relationship = '恋爱中'; resultText += '你们正式确定了恋爱关系。'; } state.lastResult = `${resultText}当前感情值${state.affection}/100。`; core.addRecord(state, `${resultText}感情值变为${state.affection}。`); } this.persist(); } });
    } });
  },

  health() { const state = this.data.state; const hospitalUsed = state.lastHospitalYear === state.year; const choices = [{ label: '日常锻炼 · 免费 · 恢复3点', config: ['exercise', 0, 3] }]; if (hospitalUsed) choices.push({ label: '医院：本年度已使用', used: true }); else choices.push({ label: '医院门诊 · 0.3万元 · 恢复8点', config: ['hospital', 3000, 8] }, { label: '住院调养 · 1.2万元 · 恢复18点', config: ['hospital', 12000, 18] }); this.showModal({ title: '健康管理', content: `当前健康值：${state.health}/100\n医院每个自然年度只能使用一次；门诊和住院共享本年度次数。\n规律锻炼每个自然年度可进行一次，不占用医院次数。\n${hospitalUsed ? '本年度已就诊，下一年度可再次使用医院' : '本年度尚未就诊，可选择一种医院方案'}`, confirmText: '选择方案', cancelText: '返回', success: (modal) => { if (!modal.confirm) return; this.showActionSheet({ itemList: choices.map(item => item.label), success: (res) => { const choice = choices[res.tapIndex]; if (choice.used) return wx.showToast({ title: '本年度医院次数已使用', icon: 'none' }); const cfg = choice.config; if (core.restoreHealth(state, cfg[0], cfg[1], cfg[2])) { this.persist(); wx.showToast({ title: '健康值已恢复', icon: 'success' }); } else wx.showToast({ title: '本年度已使用或现金不足', icon: 'none' }); } }); } }); },

  save() {
    const slots = storage.slotList();
    this.showActionSheet({ title: '保存到本机', content: '', itemList: slots.map(slotLabel), cancelText: '返回', success: (res) => {
      const slot = slots[res.tapIndex];
      if (!slot) return;
      const ok = storage.saveSlot(slot.slot, this.data.state);
      wx.showToast({ title: ok ? `已保存到存档${slot.slot}` : '保存失败', icon: ok ? 'success' : 'none' });
    } });
  },
  // 手动读档属于一次广告权益：先选档，再在广告完成或免广告卡扣除成功后应用。
  load() {
    if (this._payBusy || this._rewardedAdPending) return wx.showToast({ title: '处理中，请稍候', icon: 'none' });
    const slots = storage.slotList();
    this.showActionSheet({ title: '读取本机存档', content: '读档需要一次广告权益：完整观看激励广告，或消耗1张免广告卡。广告未完整观看不读取。', itemList: slots.map(slotLabel), cancelText: '返回', success: (res) => {
      const slot = slots[res.tapIndex];
      if (!slot || slot.empty) return wx.showToast({ title: '该存档为空', icon: 'none' });
      const cardAvailable = this.cardBalance() > 0;
      const items = cardAvailable ? ['消耗1张免广告卡读档', '看广告读档'] : ['看广告读档'];
      this.showActionSheet({
        title: `读取存档${slot.slot}`,
        content: `${slotLabel(slot)}\n\n请选择本次读档方式。广告未完整观看不会读取存档。`,
        itemList: items,
        cancelText: '返回',
        success: ({ tapIndex }) => {
          const useCard = cardAvailable && tapIndex === 0;
          return useCard ? this.useLoadAdCard(slot.slot) : this.watchLoadAd(slot.slot);
        },
      });
    } });
  },
  applyLoadedSlot(slotNumber) {
    const loaded = storage.loadSlot(slotNumber);
    if (!loaded) return wx.showToast({ title: '存档损坏或读取失败', icon: 'none' });
    this._burstEvent = null;
    this._burstKind = 'normal';
    this._burstReview = false;
    storage.save(loaded);
    this.setData({
      state: loaded,
      currentEvent: null,
      burst: { visible: false, review: false, flag: '', tag: '', title: '', scene: '', tip: '', options: [] },
    }, () => { this.refresh(); wx.showToast({ title: `已读取存档${slotNumber}`, icon: 'success' }); });
  },
  watchLoadAd(slotNumber) {
    return this.playRewardedVideo({
      scene: 'load',
      adUnitId: rewardedAdUnitId,
      interruptText: '广告未完整观看，读档未生效',
      reward: () => this.applyLoadedSlot(slotNumber),
    });
  },
  useLoadAdCard(slotNumber) {
    if (this._payBusy) return wx.showToast({ title: '处理中，请稍候', icon: 'none' });
    return this.consumeAdCard({
      scene: 'load',
      adUnitId: rewardedAdUnitId,
      interruptText: '广告未完整观看，读档未生效',
      reward: () => this.applyLoadedSlot(slotNumber),
    });
  },
  showLocalHistory() {
    const history = storage.localHistory().filter(item => item && item.type === 'save');
    const lines = history.map(item => `${String(item.at || '').replace('T', ' ').slice(0, 16)}　保存存档${item.slot}\n${item.name} · ${item.year}年 · ${item.age}岁 · ${item.rank}`);
    const content = history.length ? `仅保存在当前设备，最多记录50条。\n\n${lines.join('\n\n')}` : '暂无手动存档记录。\n记录只保存在当前设备，不会上传服务器。';
    this.showModal({ title: '本地存档记录', content, showCancel: false });
  },
  selectNav(event) {
    const activeNav = event.currentTarget.dataset.nav;
    const actions = navActionsFor(activeNav);
    const navItem = (this.data.navItems || []).find(item => item.key === activeNav);
    this.setData({ activeNav, navActions: actions }, () => {
      this.showActionSheet({
        title: `${navItem ? navItem.label : '功能'}事项`,
        content: NAV_COPY[activeNav] || '轻触下方选项继续。',
        itemList: actions.map(item => item.label),
        success: result => {
          const item = actions[result.tapIndex];
          if (item) this.runNavAction(item.action);
        },
      });
    });
  },
  runNavAction(action) {
    const handlers = { promotion: 'showPromotionPath', quarter: 'startQuarter', romance: 'romance', health: 'health', house: 'buyHouse', car: 'buyCar', accounts: 'showAccounts', records: 'showStats', history: 'showRecords', localHistory: 'showLocalHistory', adCard: 'showAdCard', save: 'save', load: 'load', restart: 'restart', investigation: 'showInvestigation', annualReview: 'showAnnualReview' };
    if (handlers[action] && typeof this[handlers[action]] === 'function') this[handlers[action]]();
  },
  handleNavAction(event) {
    const action = event.currentTarget.dataset.action;
    this.runNavAction(action);
  },

  showInvestigation() {
    const state = this.data.state;
    const chance = Math.floor(core.investigationChance(state.rankIndex) * 100);
    const baseRank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    const lastChecked = state.investigationCheckedYear;
    const settled = lastChecked === state.year ? '本年已抽取' : '本年尚未抽取';
    const lines = [
      `当前职级：${baseRank.name}`,
      `进入任一季度时按概率随机抽取核查事件。`,
      `当前级别触发概率：${chance}%`,
      `${state.rankIndex < 3 ? '职级序列阶段不触发监督核查。' : '触发后按监督核查事件处理：合规操作获得廉政加分；违规操作会扣减廉政值并计入过失。'}`,
      `最近一次抽取：${lastChecked ? `${lastChecked}年（${settled}）` : '尚未触发'}`,
    ];
    this.showModal({ title: '监督核查说明', content: lines.join('\n'), showCancel: false });
  },

  showAnnualReview() {
    const state = this.data.state;
    const baseRank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    const totalAbility = Math.floor(state.reputation * .30 + state.integrity * .30 + state.network * .20 + state.seniority * .15 + state.health * .05);
    const lines = [
      `当前职级：${baseRank.name}（任职 ${state.rankYears} 年）`,
      `年度考核：${state.lastReview}　分数 ${state.review}/100`,
      `上年度综合能力估算：${totalAbility}`,
      `上年度绩效：${state.lastPerformance >= 0 ? '+' : ''}${state.lastPerformance}　当前累计年度绩效：${state.annualPerformance >= 0 ? '+' : ''}${state.annualPerformance}`,
      `累计政绩：${state.achievements}　累计过失：${state.faults}`,
      `上年度新增：政绩 +${state.lastAnnualAchievements}　过失 +${state.lastAnnualFaults}`,
      `本年度晋升申请：${state.promotionAppliedYear === state.year ? '已使用' : '未使用'}`,
      this.data.adText,
    ];
    this.showModal({ title: '年度考核回顾', content: lines.join('\n'), showCancel: false });
  },
  openNameSelect() {
    const surnameIndex = 0;
    const surname = COMMON_SURNAMES[surnameIndex];
    const givenNames = pickGivenNames([], NAME_CHOICE_COUNT);
    this.setData({
      nameSelect: {
        visible: true,
        surnames: COMMON_SURNAMES,
        surnameIndex,
        surname,
        givenNames,
        groups: nameGroups(surname, givenNames),
        selected: '',
        error: '',
      },
    });
  },

  selectSurname(event) {
    const surnameIndex = safeSurnameIndex(event && event.detail && event.detail.value);
    const surname = COMMON_SURNAMES[surnameIndex];
    const current = this.data.nameSelect || {};
    const givenNames = Array.isArray(current.givenNames) && current.givenNames.length
      ? current.givenNames
      : pickGivenNames([], NAME_CHOICE_COUNT);
    this.setData({
      'nameSelect.surnameIndex': surnameIndex,
      'nameSelect.surname': surname,
      'nameSelect.givenNames': givenNames,
      'nameSelect.groups': nameGroups(surname, givenNames),
      'nameSelect.selected': '',
      'nameSelect.error': '',
    });
  },

  refreshNameChoices() {
    const current = this.data.nameSelect || {};
    const surnameIndex = safeSurnameIndex(current.surnameIndex);
    const surname = COMMON_SURNAMES[surnameIndex];
    const givenNames = pickGivenNames(current.givenNames || [], NAME_CHOICE_COUNT);
    this.setData({
      'nameSelect.surnameIndex': surnameIndex,
      'nameSelect.surname': surname,
      'nameSelect.givenNames': givenNames,
      'nameSelect.groups': nameGroups(surname, givenNames),
      'nameSelect.selected': '',
      'nameSelect.error': '',
    });
  },

  selectPresetName(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({ 'nameSelect.selected': name, 'nameSelect.error': '' });
  },

  confirmName() {
    const sel = this.data.nameSelect;
    const name = (sel.selected || '').trim();
    if (!name) {
      this.setData({ 'nameSelect.error': '请选择下方的候选角色名' });
      return wx.showToast({ title: '请选择下方的候选角色名', icon: 'none' });
    }
    if (isBlockedName(name)) {
      this.setData({ 'nameSelect.error': '请从下方候选中选择安全角色名' });
      return wx.showToast({ title: '请从下方候选中选择安全角色名', icon: 'none' });
    }
    const state = this.data.state;
    state.name = name;
    if (state.records && state.records.length) state.records[0] = `2026年：${name}入职澄江市云岭镇，任二级科员，非领导职级。`;
    state.lastResult = `欢迎来到澄江市云岭镇基层岗位，${name}。`;
    core.addRecord(state, `以「${name}」之名开启仕途。`);
    this.setData({ 'nameSelect.visible': false, state: core.normalizeState(state) });
    this.persist();
  },

  startFreshGame() {
    storage.clear();
    const fresh = core.newState();
    this.setData({ state: fresh }, () => {
      this.persist();
      this.openNameSelect();
    });
  },

  restart() { this.showModal({ title: '确认重新开局', content: '重新开局会清空当前本地档案，并从22岁二级科员重新开始。', confirmText: '确认清空', cancelText: '取消', success: (res) => { if (res.confirm) this.startFreshGame(); } }); },
  showLeaderboard() {
    const result = leaderboard.getPlayerRanking(this.data.state);
    const title = '步云录 · 人生排行榜';
    const ending = !!this.data.state.ended;
    const showRows = rows => this.showModal({
      title,
      rows,
      content: '',
      showCancel: ending,
      confirmText: ending ? '再试一次' : '确定',
      cancelText: '关闭',
      success: res => { if (ending && res.confirm) this.startFreshGame(); },
    });
    const localRows = leaderboard.rankingRows(result);
    const configured = leaderboardApi.isConfigured();
    showRows(configured ? localRows.concat([BOARD_LOADING_ROW]) : localRows);
    if (!configured || this._lifeBoardSyncing) return;
    this._lifeBoardSyncing = true;
    const withLocalHonor = remote => {
      const local = leaderboard.honorOf(this.data.state && this.data.state.honorTitle);
      const leader = core.honorDisplayTitle(this.data.state) === '领导者 · 人民公仆';
      if (!local || !remote || !Array.isArray(remote.entries)) return remote;
      return Object.assign({}, remote, {
        entries: remote.entries.map(entry => (entry && entry.isPlayer ? Object.assign({}, entry, { honor: local, leader }) : entry)),
      });
    };
    leaderboardApi.fetchRanking(leaderboard.BOARD_TOP_SIZE).then(remote => {
      if (this.data.dialog.visible && this.data.dialog.title === title) showRows(leaderboardApi.rankingRows(withLocalHonor(remote)));
    }).catch(() => {
      if (this.data.dialog.visible && this.data.dialog.title === title) showRows(localRows.concat([{ kind: 'text', text: '当前无法连接服务器，以上为本机成绩。' }]));
    }).then(() => {
      this._lifeBoardSyncing = false;
    });
  },

  showEnding() {
    const state = this.data.state;
    leaderboardApi.submit(state).catch(() => {});
    if (state.escapeDetail && state.ending === '出逃结局') return this.showEscapeEnding(state);
    const rank = leaderboard.getPlayerRanking(state);
    const rankText = leaderboardApi.isConfigured() ? '全网排名：成绩提交中，请在排行榜中查看同步结果。' : `综合排名：第${rank.rank}名 / ${rank.total}`;
    const endingLead = state.ending === '违纪处分'
      ? '此前积累的违规问题在核查中被发现。经问责处理，你已被给予纪律处分，仕途就此止步。'
      : `你在${state.age}岁迎来了人生阶段的转折。`;
    // 落马结局是另一套落款：玩家最想知道的是"谁开的口、当年哪几件事被摆上了桌"，
    // 而不是退休净财产和一个排名。
    if (state.fallDetail) return this.showFallEnding(state, rankText);
    const honor = honorView(state);
    const honorLine = honor.awarded ? `\n同志们这样称呼你：${honor.title}（${honor.year}年）——你办过的事，老百姓记得。` : '';
    this.showModal({
      title: `人生结局：${state.ending}`,
      content: `${endingLead}\n${state.name ? '主角：' + state.name + '\n' : ''}最终官阶：${core.RANKS[state.rankIndex - 1].name}　具体职事：${state.currentPosition}${honorLine}\n家庭状态：${state.relationship}，子女 ${state.children}人\n退休净财产：${money(state.retirementWealth || core.netWealth(state))}\n${rankText}\n\n感谢体验《步云录》。这是一个虚构的成长模拟故事。`,
      confirmText: '查看排行榜',
      cancelText: '再试一次',
      success: res => { if (res.confirm) this.showLeaderboard(); else if (res.cancel) this.startFreshGame(); },
    });
  },

  showEscapeEnding(state) {
    const detail = state.escapeDetail || {};
    const method = leaderboard.ESCAPE_METHOD_NAMES[detail.method] || '方式未记录';
    const lines = [
      '从那天起，你没有再出现在原有的生活里，此后的去向无人知晓。',
      state.name ? `主角：${state.name}` : '',
      `离开时职级：${core.RANKS[Math.max(0, (detail.rankIndex || state.rankIndex || 1) - 1)].name}`,
      `交通方式：${method}`,
      `涉案携带现金：${money(detail.amount || 0)}`,
      '',
      '这不是胜利或免责；选择离开并未使相关事实与后果消失。',
      '本内容仅为虚构游戏结局，不构成现实法律判断，也不提供任何逃避调查的方法。',
    ].filter(line => line !== '');
    this.showModal({
      tone: 'warning',
      title: '人生落幕',
      content: lines.join('\n'),
      confirmText: '查看金蝉榜',
      cancelText: '再试一次',
      success: res => { if (res.confirm) this.showEscapeBoard(); else if (res.cancel) this.startFreshGame(); },
    });
  },

  showFallEnding(state, rankText) {
    const detail = state.fallDetail || {};
    const handlingByStance = {
      confess: '经审查，认定你主动交代问题并配合核查，依法依规从轻处理；涉案财物依法追缴，合法财产依法保护。',
      silent: '经审查，相关事实和证据已经核查完毕，依法依规作出组织处理；违纪违法所得依法收缴。',
      defy: '经审查，认定你存在对抗组织审查情节，依法依规从重处理；涉案财物依法全部追缴。',
      conduct: '经核查，相关作风问题已经查明并造成不良影响。处分决定作出后，你已不再具备继续任职的条件，仕途就此止步。',
    };
    const isConductEnding = detail.stance === 'conduct';
    const lines = [
      isConductEnding
        ? `此前积累的作风问题在核查中被发现，并于${state.age}岁作出处分。`
        : `经组织审查，你在${state.age}岁被带走调查，公职生涯就此终止。`,
      state.name ? `主角：${state.name}` : '',
      `${isConductEnding ? '处分时' : '被调查时'}的官阶：${core.RANKS[state.rankIndex - 1].name}　具体职事：${state.currentPosition}`,
      detail.cause ? `问题性质：${detail.cause}` : '',
      handlingByStance[detail.stance] || '经组织审查，相关事实和证据已经核查完毕，依法依规作出处理决定。',
      `处理结论：${state.ending}`,
      `追缴涉案资金：${money(detail.confiscated || 0)}`,
      detail.informant ? `出面交代的人：${detail.informant}` : '没有人出面，材料上是你的签字。',
    ].filter(Boolean);
    // 不当收入是落马最主要的一条线，必须逐笔摊开：
    // 哪一年、哪件事、选了什么、拿了多少钱，以及这些钱折算成了多少风险。
    const illicitTotal = Number(state.illicitIncome) || 0;
    const ledger = Array.isArray(state.illicitLedger) ? state.illicitLedger : [];
    if (illicitTotal > 0) {
      lines.push('', `累计不当收入：${money(illicitTotal)}`, network.illicitRiskNote(state), '每一笔都记在这里：');
      ledger.forEach(item => lines.push(`· ${item.year}年　${item.title}　选了「${item.choice}」　${money(item.amount)}`));
    } else {
      lines.push('', '没有查到现金往来。');
    }
    if (detail.proofs && detail.proofs.length) {
      lines.push('', '压在桌上的那几件事：');
      detail.proofs.forEach(item => lines.push(`· ${item}`));
    }
    const fellows = Array.isArray(state.fellows) ? state.fellows : [];
    const proteges = Array.isArray(state.proteges) ? state.proteges : [];
    if (fellows.length || proteges.length) {
      lines.push('', '关系链记录：');
      fellows.forEach(person => {
        const status = person.fallen ? `，${person.fallenYear || state.year}年已被带走` : '，目前仍在任';
        lines.push(`· 同船领导：${person.title}${person.name}；事由：${person.reason || '既有工作往来'}${status}。`);
      });
      proteges.forEach(person => {
        const status = person.fallen ? `，${person.fallenYear || state.year}年已被带走` : '，目前仍在任';
        lines.push(`· 帮扶对象：${person.title}${person.name}；事由：${person.reason || '既有帮扶往来'}${status}。`);
      });
    }
    // 关系网入口已经下线，落马页不再统计"同船几人、帮扶几人、带走几人"——
    // 上面"谁开的口 + 那几件事"已经把该说的说完了，再挂一行人数只会让人以为还有个没做完的页面。
    lines.push('', rankText);
    lines.push('', '感谢体验《步云录》。这是一个虚构的成长模拟故事。');
    this.showModal({
      tone: 'danger',
      title: isConductEnding ? '人生结局：作风处分' : `人生结局：落马｜${state.ending}`,
      content: lines.join('\n'),
      confirmText: '查看排行榜',
      cancelText: '再试一次',
      success: res => { if (res.confirm) this.showLeaderboard(); else if (res.cancel) this.startFreshGame(); },
    });
  },
});

},
"services/config": function(module) { module.exports = { appId: "", rewardedAdUnitId: "", faultHelpAdUnitId: "", leaderboardApiBaseUrl: "", adCardName: "免广告卡", adCardCardsPerUnit: 10, adCardPriceYuan: 0 }; }};
const load = BuyunluRuntime.moduleLoader(modules);
window.wx = BuyunluRuntime.createWx(window);
let page;
window.Page = definition => { page = definition; };
window.getCurrentPages = () => page ? [page] : [];
load('pages/index/index');
BuyunluOffline.install(page, { core: load('game/core'), storage: load('services/storage'), leaderboard: load('services/leaderboard'), host: window });
if (window.BuyunluWebConfig && !window.BuyunluCommerce) throw new Error('购卡组件未能加载，请刷新');
if (window.BuyunluCommerce) BuyunluCommerce.install(page, { host: window, boards: load('services/leaderboard-api'), storage: load('services/storage') });
BuyunluRuntime.attachPage(page, { document, root: document.getElementById('app'), template: [{"tag":"view","attrs":{"class":"page-shell"},"children":[{"tag":"view","attrs":{"class":"ambient ambient-one"},"children":[]},{"tag":"view","attrs":{"class":"ambient ambient-two"},"children":[]},{"tag":"scroll-view","attrs":{"class":"scroll","scroll-y":"","enhanced":"","show-scrollbar":"{{false}}","scroll-into-view":"{{scrollIntoView}}","scroll-with-animation":""},"children":[{"tag":"view","attrs":{"class":"content-stack"},"children":[{"tag":"view","attrs":{"class":"career-header enter-one"},"children":[{"tag":"view","attrs":{"class":"header-kicker-row"},"children":[{"tag":"text","attrs":{"class":"header-kicker"},"children":[{"text":"{{nameKicker}}"}]},{"tag":"text","attrs":{"class":"quarter-chip"},"children":[{"text":"{{quarterText}}"}]}]},{"tag":"view","attrs":{"class":"career-title-row"},"children":[{"tag":"view","attrs":{"class":"career-title-main"},"children":[{"tag":"text","attrs":{"wx:if":"{{honor.awarded}}","class":"career-honor"},"children":[{"text":"{{honor.badge}}"}]},{"tag":"text","attrs":{"class":"career-rank"},"children":[{"text":"{{careerTitle}}"}]},{"tag":"text","attrs":{"class":"career-period"},"children":[{"text":"{{state.year}}年度 · {{state.age}}岁"}]}]},{"tag":"view","attrs":{"class":"career-index"},"children":[{"tag":"text","attrs":{"class":"index-current"},"children":[{"text":"{{state.rankIndex}}"}]},{"tag":"text","attrs":{"class":"index-total"},"children":[{"text":"/ 11"}]}]}]},{"tag":"view","attrs":{"class":"progress-row"},"children":[{"tag":"view","attrs":{"class":"progress-track"},"children":[{"tag":"view","attrs":{"class":"progress-fill","style":"width: {{progress * 100}}%;"},"children":[]}]},{"tag":"text","attrs":{"class":"progress-copy"},"children":[{"text":"任职 {{state.rankYears}} 年"}]}]}]},{"tag":"view","attrs":{"class":"board-strip enter-two","aria-label":"全网榜单"},"children":[{"tag":"button","attrs":{"class":"board-button","hover-class":"board-button-pressed","hover-stay-time":"80","bindtap":"showLeaderboard"},"children":[{"tag":"view","attrs":{"class":"board-mark","aria-hidden":"true"},"children":[{"text":"榜"}]},{"tag":"text","attrs":{},"children":[{"text":"全网排行榜"}]}]},{"tag":"button","attrs":{"class":"board-button board-button-tiger","hover-class":"board-button-pressed","hover-stay-time":"80","bindtap":"showTigerBoard"},"children":[{"tag":"view","attrs":{"class":"board-mark board-mark-tiger","aria-hidden":"true"},"children":[{"text":"虎"}]},{"tag":"text","attrs":{},"children":[{"text":"老虎榜"}]}]},{"tag":"button","attrs":{"class":"board-button board-button-escape","hover-class":"board-button-pressed","hover-stay-time":"80","bindtap":"showEscapeBoard"},"children":[{"tag":"view","attrs":{"class":"board-mark board-mark-escape","aria-hidden":"true"},"children":[{"text":"录"}]},{"tag":"text","attrs":{},"children":[{"text":"金蝉榜"}]}]}]},{"tag":"view","attrs":{"class":"top-nav enter-two","role":"tablist","aria-label":"游戏功能导航"},"children":[{"tag":"block","attrs":{"wx:for":"{{navItems}}","wx:key":"key"},"children":[{"tag":"button","attrs":{"class":"top-nav-item {{activeNav === item.key ? 'top-nav-item-active' : ''}}","hover-class":"top-nav-item-pressed","hover-stay-time":"80","data-nav":"{{item.key}}","bindtap":"selectNav","role":"tab","aria-selected":"{{activeNav === item.key}}"},"children":[{"tag":"text","attrs":{},"children":[{"text":"{{item.label}}"}]}]}]}]},{"tag":"view","attrs":{"class":"mission-card enter-three"},"children":[{"tag":"view","attrs":{"class":"mission-head"},"children":[{"tag":"view","attrs":{"class":"mission-symbol"},"children":[{"text":"✓"}]},{"tag":"view","attrs":{"class":"mission-heading"},"children":[{"tag":"text","attrs":{"class":"eyebrow"},"children":[{"text":"本季度 · 核心任务"}]},{"tag":"text","attrs":{"class":"mission-title"},"children":[{"text":"{{reviewText}}"}]}]}]},{"tag":"text","attrs":{"class":"mission-result"},"children":[{"text":"{{lastResult}}"}]},{"tag":"view","attrs":{"class":"mission-actions"},"children":[{"tag":"button","attrs":{"class":"primary-button","hover-class":"primary-button-pressed","hover-stay-time":"80","bindtap":"startQuarter"},"children":[{"tag":"text","attrs":{"class":"primary-button-label"},"children":[{"text":"提交{{quarterText}}工作"}]},{"tag":"text","attrs":{"class":"button-arrow"},"children":[{"text":"→"}]}]},{"tag":"button","attrs":{"class":"promotion-button","hover-class":"promotion-button-pressed","hover-stay-time":"80","bindtap":"showPromotionPath"},"children":[{"tag":"text","attrs":{"class":"promotion-button-label"},"children":[{"text":"晋升条件"}]},{"tag":"text","attrs":{"class":"promotion-status"},"children":[{"text":"{{promotionStatusText}}"}]}]}]}]},{"tag":"view","attrs":{"wx:if":"{{currentEvent}}","id":"event-card","class":"event-card enter-three"},"children":[{"tag":"view","attrs":{"class":"event-head"},"children":[{"tag":"text","attrs":{"class":"event-kicker"},"children":[{"text":"步云录 · 当前事项"}]},{"tag":"text","attrs":{"class":"event-title"},"children":[{"text":"{{currentEvent.title}}"}]}]},{"tag":"text","attrs":{"class":"event-scene"},"children":[{"text":"{{currentEvent.scene}}"}]},{"tag":"text","attrs":{"class":"event-tip"},"children":[{"text":"轻触下方选项选择处理方式，当前累计绩效：{{annualPerformanceLabel}}"}]},{"tag":"view","attrs":{"class":"event-options"},"children":[{"tag":"block","attrs":{"wx:for":"{{currentEvent.options}}","wx:key":"text"},"children":[{"tag":"button","attrs":{"class":"event-option","hover-class":"event-option-pressed","hover-stay-time":"80","data-index":"{{index}}","bindtap":"selectEventOption"},"children":[{"tag":"text","attrs":{"class":"event-option-label"},"children":[{"text":"{{item.text}}"}]}]}]}]},{"tag":"button","attrs":{"class":"event-cancel","hover-class":"event-cancel-pressed","hover-stay-time":"80","bindtap":"cancelEvent"},"children":[{"text":"取消"}]}]},{"tag":"view","attrs":{"class":"section enter-three"},"children":[{"tag":"view","attrs":{"class":"section-head"},"children":[{"tag":"text","attrs":{"class":"section-title"},"children":[{"text":"状态概览"}]},{"tag":"text","attrs":{"class":"section-note"},"children":[{"text":"实时变化"}]}]},{"tag":"view","attrs":{"class":"metric-track"},"children":[{"tag":"block","attrs":{"wx:for":"{{metrics}}","wx:key":"label"},"children":[{"tag":"button","attrs":{"wx:if":"{{item.action}}","class":"metric metric-action metric-{{item.tone}}","hover-class":"metric-pressed","data-action":"{{item.action}}","bindtap":"handleMetricAction"},"children":[{"tag":"view","attrs":{"class":"metric-dot"},"children":[]},{"tag":"text","attrs":{"class":"metric-label"},"children":[{"text":"{{item.label}}"}]},{"tag":"text","attrs":{"class":"metric-value"},"children":[{"text":"{{item.value}}"}]},{"tag":"text","attrs":{"class":"metric-hint"},"children":[{"text":"点击处理"}]}]},{"tag":"view","attrs":{"wx:if":"{{!item.action}}","class":"metric metric-{{item.tone}}"},"children":[{"tag":"view","attrs":{"class":"metric-dot"},"children":[]},{"tag":"text","attrs":{"class":"metric-label"},"children":[{"text":"{{item.label}}"}]},{"tag":"text","attrs":{"class":"metric-value"},"children":[{"text":"{{item.value}}"}]}]}]}]}]},{"tag":"view","attrs":{"class":"overview-card enter-four"},"children":[{"tag":"view","attrs":{"class":"section-head"},"children":[{"tag":"text","attrs":{"class":"section-title"},"children":[{"text":"生活与资产"}]},{"tag":"text","attrs":{"class":"section-note"},"children":[{"text":"年度总览"}]}]},{"tag":"view","attrs":{"class":"overview-block"},"children":[{"tag":"text","attrs":{"class":"overview-label"},"children":[{"text":"家庭状态"}]},{"tag":"text","attrs":{"class":"overview-primary"},"children":[{"text":"{{lifeText}}"}]}]},{"tag":"view","attrs":{"class":"hairline"},"children":[]},{"tag":"view","attrs":{"class":"overview-block"},"children":[{"tag":"text","attrs":{"class":"overview-label"},"children":[{"text":"财务账户"}]},{"tag":"text","attrs":{"class":"overview-primary"},"children":[{"text":"{{wealthText}}"}]},{"tag":"text","attrs":{"class":"overview-secondary"},"children":[{"text":"{{compensationText}}"}]},{"tag":"text","attrs":{"class":"overview-secondary"},"children":[{"text":"{{expenseText}}"}]},{"tag":"text","attrs":{"class":"overview-warning"},"children":[{"text":"{{loanText}}"}]}]}]},{"tag":"text","attrs":{"class":"copyright"},"children":[{"text":"虚构成长模拟 · 个人学习研究用途"}]}]}]},{"tag":"view","attrs":{"class":"wallet-float {{pay.enabled ? '' : 'wallet-float-disabled'}}","hover-class":"wallet-float-pressed","hover-stay-time":"80","bindtap":"showAdCard","aria-label":"{{pay.name}}"},"children":[{"tag":"image","attrs":{"wx:if":"{{!adCardIconBroken}}","class":"wallet-float-icon","src":"assets/ad-free-card.png","mode":"aspectFit","aria-hidden":"true","binderror":"onAdCardIconError"},"children":[]},{"tag":"text","attrs":{"wx:else":"","class":"wallet-float-icon-fallback","aria-hidden":"true"},"children":[{"text":"卡"}]},{"tag":"view","attrs":{"class":"wallet-float-copy"},"children":[{"tag":"text","attrs":{"class":"wallet-float-title"},"children":[{"text":"{{pay.name}}"}]},{"tag":"text","attrs":{"wx:if":"{{pay.balance > 0}}","class":"wallet-float-status"},"children":[{"text":"余额 {{pay.balance}} 张"}]},{"tag":"text","attrs":{"wx:elif":"{{pay.enabled}}","class":"wallet-float-status"},"children":[{"text":"尚未购买"}]},{"tag":"text","attrs":{"wx:else":"","class":"wallet-float-status"},"children":[{"text":"暂未开放"}]}]},{"tag":"button","attrs":{"class":"wallet-float-buy","hover-class":"wallet-float-buy-pressed","hover-stay-time":"80","disabled":"{{!pay.enabled || pay.buying}}","catchtap":"chooseAdCardAmount"},"children":[{"tag":"text","attrs":{"wx:if":"{{pay.enabled}}"},"children":[{"text":"{{pay.buyLabel}}"}]},{"tag":"text","attrs":{"wx:else":""},"children":[{"text":"说明"}]}]}]},{"tag":"view","attrs":{"class":"dialog-mask {{dialog.visible ? 'dialog-mask-open' : ''}} {{dialog.tone === 'danger' ? 'dialog-mask-danger' : ''}} {{dialog.tone === 'warning' ? 'dialog-mask-warning' : ''}}","catchtouchmove":"true"},"children":[{"tag":"view","attrs":{"class":"dialog-card {{dialog.tone === 'danger' ? 'dialog-card-danger' : ''}} {{dialog.tone === 'warning' ? 'dialog-card-warning' : ''}} {{dialog.tone === 'promotion' ? 'dialog-card-promotion' : ''}}","catchtap":"noop"},"children":[{"tag":"view","attrs":{"wx:if":"{{dialog.tone === 'danger'}}","class":"danger-banner","aria-label":"落马处理结论"},"children":[{"tag":"text","attrs":{"class":"danger-word"},"children":[{"text":"落马"}]},{"tag":"text","attrs":{"class":"danger-label"},"children":[{"text":"组织处理"}]}]},{"tag":"view","attrs":{"wx:elif":"{{dialog.tone === 'warning'}}","class":"warning-banner","aria-label":"出逃结局"},"children":[{"tag":"text","attrs":{"class":"warning-word"},"children":[{"text":"出逃"}]},{"tag":"text","attrs":{"class":"warning-label"},"children":[{"text":"去向记录"}]}]},{"tag":"view","attrs":{"class":"dialog-kicker"},"children":[{"text":"步云录 · 当前事项"}]},{"tag":"text","attrs":{"class":"dialog-title"},"children":[{"text":"{{dialog.title}}"}]},{"tag":"scroll-view","attrs":{"class":"dialog-content-scroll dialog-body","scroll-y":"","enhanced":"","show-scrollbar":"{{false}}"},"children":[{"tag":"text","attrs":{"wx:if":"{{dialog.content}}","class":"dialog-content"},"children":[{"text":"{{dialog.content}}"}]},{"tag":"view","attrs":{"wx:if":"{{dialog.rows.length}}","class":"board-rows"},"children":[{"tag":"block","attrs":{"wx:for":"{{dialog.rows}}","wx:key":"index"},"children":[{"tag":"text","attrs":{"wx:if":"{{item.kind === 'text'}}","class":"board-text"},"children":[{"text":"{{item.text}}"}]},{"tag":"text","attrs":{"wx:elif":"{{item.kind === 'note'}}","class":"board-note"},"children":[{"text":"{{item.text}}"}]},{"tag":"text","attrs":{"wx:elif":"{{item.kind === 'section'}}","class":"board-section"},"children":[{"text":"{{item.text}}"}]},{"tag":"view","attrs":{"wx:elif":"{{item.kind === 'gap'}}","class":"board-gap","aria-label":"前后共隔{{item.count}}名"},"children":[{"tag":"view","attrs":{"class":"board-gap-line"},"children":[]},{"tag":"text","attrs":{"class":"board-gap-text"},"children":[{"text":"中间还有 {{item.count}} 人"}]},{"tag":"view","attrs":{"class":"board-gap-line"},"children":[]}]},{"tag":"view","attrs":{"wx:elif":"{{item.kind === 'entry'}}","class":"board-entry"},"children":[{"tag":"view","attrs":{"class":"board-entry-main"},"children":[{"tag":"text","attrs":{"class":"board-medal"},"children":[{"text":"{{item.medal}}"}]},{"tag":"text","attrs":{"class":"board-rank"},"children":[{"text":"{{item.rank}}."}]},{"tag":"text","attrs":{"class":"board-name {{item.player ? 'board-name-player' : ''}}"},"children":[{"text":"{{item.name}}"}]},{"tag":"text","attrs":{"wx:if":"{{item.honor}}","class":"board-honor"},"children":[{"text":"{{item.honor}}"}]},{"tag":"text","attrs":{"wx:if":"{{item.position}}","class":"board-position"},"children":[{"text":"{{item.position}}"}]}]},{"tag":"text","attrs":{"wx:if":"{{item.sub}}","class":"board-sub {{item.player ? 'board-sub-player' : ''}}"},"children":[{"text":"{{item.sub}}"}]}]}]}]},{"tag":"view","attrs":{"wx:if":"{{dialog.mode === 'amount'}}","class":"dialog-amount-wrap"},"children":[{"tag":"text","attrs":{"class":"dialog-amount-label"},"children":[{"text":"{{dialog.inputLabel || '支出金额'}}"}]},{"tag":"input","attrs":{"class":"dialog-amount-input","type":"number","maxlength":"9","value":"{{dialog.inputValue}}","placeholder":"{{dialog.inputPlaceholder}}","placeholder-class":"dialog-amount-placeholder","bindinput":"dialogAmountInput","confirm-type":"done"},"children":[]},{"tag":"text","attrs":{"class":"dialog-amount-unit"},"children":[{"text":"{{dialog.inputUnit || '元'}}"}]}]},{"tag":"block","attrs":{"wx:if":"{{dialog.mode === 'actions'}}"},"children":[{"tag":"view","attrs":{"class":"dialog-options"},"children":[{"tag":"block","attrs":{"wx:for":"{{dialog.items}}","wx:key":"index"},"children":[{"tag":"button","attrs":{"class":"dialog-option","data-index":"{{index}}","bindtap":"dialogSelect"},"children":[{"tag":"text","attrs":{"class":"dialog-option-label"},"children":[{"text":"{{item}}"}]}]}]}]}]}]},{"tag":"view","attrs":{"wx:if":"{{dialog.mode !== 'actions'}}","class":"dialog-footer"},"children":[{"tag":"button","attrs":{"wx:if":"{{dialog.showCancel}}","class":"dialog-button secondary","bindtap":"closeDialog"},"children":[{"text":"{{dialog.cancelText}}"}]},{"tag":"button","attrs":{"wx:if":"{{dialog.shareAction && dialog.shareReady}}","class":"dialog-button primary dialog-share-button","bindtap":"shareFaultHelp"},"children":[{"tag":"view","attrs":{"class":"share-icon","aria-hidden":"true"},"children":[]},{"tag":"text","attrs":{},"children":[{"text":"{{dialog.confirmText}}"}]}]},{"tag":"button","attrs":{"wx:elif":"{{dialog.shareAction}}","class":"dialog-button primary dialog-share-button","bindtap":"shareFaultHelp"},"children":[{"tag":"view","attrs":{"class":"share-icon","aria-hidden":"true"},"children":[]},{"tag":"text","attrs":{},"children":[{"text":"{{dialog.confirmText}}"}]}]},{"tag":"button","attrs":{"wx:else":"","class":"dialog-button primary","bindtap":"dialogConfirm"},"children":[{"text":"{{dialog.confirmText}}"}]}]},{"tag":"button","attrs":{"wx:if":"{{dialog.mode === 'actions'}}","class":"dialog-cancel","bindtap":"closeDialog"},"children":[{"text":"{{dialog.cancelText}}"}]}]}]},{"tag":"view","attrs":{"class":"burst-mask {{burst.visible ? 'burst-mask-open' : ''}}","catchtouchmove":"true"},"children":[{"tag":"view","attrs":{"class":"burst-card","catchtap":"noop"},"children":[{"tag":"view","attrs":{"class":"burst-head"},"children":[{"tag":"text","attrs":{"class":"burst-tag"},"children":[{"text":"{{burst.tag}}"}]},{"tag":"text","attrs":{"class":"burst-flag burst-flag-{{burst.flag === '组织谈话' ? 'trial' : burst.review ? 'review' : 'normal'}}"},"children":[{"text":"{{burst.flag}}"}]}]},{"tag":"text","attrs":{"class":"burst-title"},"children":[{"text":"{{burst.title}}"}]},{"tag":"scroll-view","attrs":{"class":"burst-scroll","scroll-y":"","enhanced":"","show-scrollbar":"{{false}}"},"children":[{"tag":"text","attrs":{"class":"burst-scene"},"children":[{"text":"{{burst.scene}}"}]},{"tag":"view","attrs":{"class":"burst-options"},"children":[{"tag":"block","attrs":{"wx:for":"{{burst.options}}","wx:key":"text"},"children":[{"tag":"button","attrs":{"class":"burst-option","hover-class":"burst-option-pressed","hover-stay-time":"80","data-index":"{{index}}","bindtap":"selectBurstOption"},"children":[{"tag":"text","attrs":{"class":"burst-option-label"},"children":[{"text":"{{item.text}}"}]}]}]}]}]},{"tag":"text","attrs":{"class":"burst-tip"},"children":[{"text":"{{burst.tip}}"}]}]}]},{"tag":"view","attrs":{"class":"nameselect-mask {{nameSelect.visible ? 'nameselect-mask-open' : ''}}"},"children":[{"tag":"view","attrs":{"class":"nameselect-backdrop","catchtap":"noop","catchtouchmove":"true"},"children":[]},{"tag":"view","attrs":{"class":"nameselect-card","catchtap":"noop"},"children":[{"tag":"scroll-view","attrs":{"class":"nameselect-scroll","scroll-y":"","enhanced":"","show-scrollbar":"{{false}}"},"children":[{"tag":"text","attrs":{"class":"nameselect-kicker"},"children":[{"text":"步云录 · 开局起名"}]},{"tag":"text","attrs":{"class":"nameselect-title"},"children":[{"text":"为你的仕途起个名字"}]},{"tag":"text","attrs":{"class":"nameselect-sub"},"children":[{"text":"先选姓氏，再从每批15个内置名字中选择。名称不支持自由输入，只保存在本机存档中。"}]},{"tag":"view","attrs":{"class":"nameselect-surname-row"},"children":[{"tag":"text","attrs":{"class":"nameselect-field-label"},"children":[{"text":"姓氏"}]},{"tag":"picker","attrs":{"class":"nameselect-picker","mode":"selector","range":"{{nameSelect.surnames}}","value":"{{nameSelect.surnameIndex}}","bindchange":"selectSurname"},"children":[{"tag":"view","attrs":{"class":"nameselect-picker-value"},"children":[{"tag":"text","attrs":{},"children":[{"text":"{{nameSelect.surname}}"}]},{"tag":"text","attrs":{"class":"nameselect-picker-arrow"},"children":[{"text":"选择⌄"}]}]}]}]},{"tag":"view","attrs":{"class":"nameselect-choice-head"},"children":[{"tag":"view","attrs":{},"children":[{"tag":"text","attrs":{"class":"nameselect-group nameselect-group-head"},"children":[{"text":"名字候选"}]},{"tag":"text","attrs":{"class":"nameselect-choice-hint"},"children":[{"text":"每次随机展示15个"}]}]},{"tag":"button","attrs":{"class":"nameselect-refresh","bindtap":"refreshNameChoices"},"children":[{"text":"换一批"}]}]},{"tag":"block","attrs":{"wx:for":"{{nameSelect.groups}}","wx:key":"title","wx:for-item":"group"},"children":[{"tag":"view","attrs":{"class":"nameselect-chips"},"children":[{"tag":"block","attrs":{"wx:for":"{{group.names}}","wx:key":"*this","wx:for-item":"name"},"children":[{"tag":"button","attrs":{"class":"nameselect-chip {{nameSelect.selected === name ? 'nameselect-chip-on' : ''}}","data-name":"{{name}}","bindtap":"selectPresetName"},"children":[{"text":"{{name}}"}]}]}]}]},{"tag":"text","attrs":{"wx:if":"{{nameSelect.selected}}","class":"nameselect-preview"},"children":[{"text":"已选：{{nameSelect.selected}}"}]},{"tag":"text","attrs":{"wx:if":"{{nameSelect.error}}","class":"nameselect-error"},"children":[{"text":"{{nameSelect.error}}"}]},{"tag":"button","attrs":{"class":"nameselect-confirm","bindtap":"confirmName"},"children":[{"text":"确定开局"}]}]}]}]}]}], afterRender: () => BuyunluRuntime.updateAccessibility(page, document) });
window.buyunluPage = page;
window.buyunluHandleBack = () => BuyunluOffline.handleBack(page);
page.onLoad();
if (page.onShow) page.onShow();
window.addEventListener('pagehide', () => page.onUnload());
window.addEventListener('pageshow', event => { if (event.persisted && page.onShow) page.onShow(); });
document.addEventListener('visibilitychange', () => document.hidden ? page.onHide() : page.onShow && page.onShow());
window.addEventListener('keydown', event => { if (event.key === 'Escape') window.buyunluHandleBack(); if (event.key === 'Tab') BuyunluRuntime.trapFocus(event, document); });
})();
