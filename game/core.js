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
