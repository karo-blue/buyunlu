const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../game/core');
const network = require('../game/network');
const config = require('../services/config');
const sourceData = require('../game/data-full');

test('new game starts at the original baseline', () => {
  const state = core.newState();
  assert.equal(state.age, 22);
  assert.equal(state.year, 2026);
  assert.equal(state.quarter, 1);
  assert.equal(state.rankIndex, 1);
  assert.equal(state.money, 80000);
  assert.equal(state.review, 76);
});

test('corrupted or legacy saves are normalized into a playable state', () => {
  const state = core.normalizeState({ rankIndex: 999, quarter: '9', age: 'bad', records: 'broken', name: 123 });
  assert.equal(state.rankIndex, core.RANKS.length);
  assert.equal(state.quarter, 1);
  assert.equal(state.age, 22);
  assert.deepEqual(state.records, []);
  assert.equal(state.name, '');
  assert.doesNotThrow(() => core.retirementEnding(state));
  assert.doesNotThrow(() => core.addRecord(state, '存档恢复完成'));
  assert.equal(core.normalizeState({ ended: true, ending: '违纪处分离职' }).ending, '违纪处分');
});

test('promotion qualification keeps all gates', () => {
  const state = core.newState();
  const next = core.RANKS[1];
  assert.equal(core.isQualified(state, next), false);
  state.promotionAdWatchCount = 33;
  assert.equal(core.isQualified(state, next), false, '100% probability cannot bypass qualification gates');
  Object.assign(state, { age: 23, rankYears: 1, review: 62, reputation: 32, network: 16, achievements: 1 });
  assert.equal(core.isQualified(state, next), true);
  state.integrity = 59;
  assert.equal(core.isQualified(state, next), false);
});

test('promotion chances are slightly higher and rewarded ads add three percentage points', () => {
  const state = core.newState();
  assert.equal(core.promotionChance(2), 0.56);
  assert.equal(core.promotionChance(8), 0.26);
  assert.equal(core.promotionChance(11), 0.01);
  state.promotionAdUsedYear = state.year;
  state.promotionAdWatchCount = 1;
  assert.equal(core.currentPromotionChance(state, 8), 0.29);
  state.promotionAdWatchCount = 20;
  assert.equal(core.currentPromotionChance(state, 2), 1);
});

test('promotion card bonuses last for the career across years, ranks and saved state', () => {
  let state = core.newState();
  Object.assign(state, { promotionAdUsedYear: 2026, promotionAdWatchCount: 2, promotionAdBonus: .06 });
  for (const year of [2026, 2027, 2040]) {
    state.year = year;
    for (let rank = 2; rank <= core.RANKS.length; rank++) {
      state.rankIndex = rank - 1;
      assert.equal(core.currentPromotionChance(state, rank), Number((core.promotionChance(rank) + .06).toFixed(4)));
    }
    state = core.normalizeState(JSON.parse(JSON.stringify(state)));
    assert.equal(state.promotionAdWatchCount, 2);
  }
  assert.equal(core.newState().promotionAdWatchCount, 0, 'a fresh career has no inherited bonus');
});

test('an annual promotion can use a bonus earned in an earlier year', () => {
  const state = core.newState();
  Object.assign(state, { year: 2027, quarter: 4, age: 24, rankYears: 2, review: 90, integrity: 100, reputation: 100, network: 100, seniority: 100, health: 100, achievements: 10, promotionAdUsedYear: 2026, promotionAdWatchCount: 1 });
  const result = core.finishQuarter(state, () => .58);
  assert.equal(result.annual, true);
  assert.equal(result.promoted, true, '56% base plus 3 career points passes a 58% roll');
  assert.equal(state.promotionAdWatchCount, 1);
  assert.match(state.lastResult, /本局.*3个百分/);
});

test('asking a leader for help succeeds ninety percent of the time', () => {
  const reduced = core.newState();
  reduced.money = 200000;
  reduced.faults = 5;
  const reducedResult = core.resolveFaultHelp(reduced, 100000, () => 0.89);
  assert.equal(reduced.money, 100000);
  assert.equal(reduced.faults, 3);
  assert.equal(reduced.faultHelpUsedYear, reduced.year);
  assert.equal(reducedResult.delta, -2);
  assert.equal(reducedResult.favorable, true);
  assert.ok(core.LEADER_HELP_SUCCESS_LINES.some(line => reduced.lastResult.startsWith(line)));

  const increased = core.newState();
  increased.money = 200000;
  increased.faults = 5;
  // 0.9 本身不算成功：rng() < 0.9 才算，边界要落在失败一侧
  const increasedResult = core.resolveFaultHelp(increased, 100000, () => 0.9);
  assert.equal(increased.money, 100000);
  assert.equal(increased.faults, 6);
  assert.equal(increasedResult.delta, 1);
  assert.equal(increasedResult.favorable, false);
  assert.ok(core.LEADER_HELP_FAILURE_LINES.some(line => increased.lastResult.startsWith(line)));
  assert.equal(core.FAULT_HELP_SUCCESS_CHANCE, 0.9);
});

test('leader help keeps ten acceptance and ten refusal lines and lets the player name any amount', () => {
  assert.equal(core.LEADER_HELP_SUCCESS_LINES.length, 10);
  assert.equal(core.LEADER_HELP_FAILURE_LINES.length, 10);
  // 1 万元门槛已取消：小额请托照常成立，一年一次的限制照旧
  const state = core.newState();
  state.money = 200000;
  state.faults = 5;
  const small = core.resolveFaultHelp(state, 999, () => 0.1);
  assert.equal(small.ok, true);
  assert.equal(state.money, 200000 - 999);
  assert.equal(state.faults, 3);
  assert.equal(core.resolveFaultHelp(state, 100).ok, false, '当年机会已用掉');
  const fresh = core.newState();
  fresh.money = 200000;
  const snapshot = JSON.stringify(fresh);
  const zero = core.resolveFaultHelp(fresh, 0, () => 0);
  assert.equal(zero.ok, false);
  assert.match(zero.reason, /大于0元/);
  assert.equal(JSON.stringify(fresh), snapshot);
});

test('leader help opportunity can only be used once in a natural year', () => {
  const state = core.newState();
  state.money = 200000;
  state.faults = 5;
  const first = core.resolveFaultHelp(state, 100000, () => 0.5);
  assert.equal(first.ok, true);
  const moneyAfterFirst = state.money;
  const faultsAfterFirst = state.faults;
  const second = core.resolveFaultHelp(state, 100000, () => 0);
  assert.equal(second.ok, false);
  assert.match(second.reason, /本年度.*已使用/);
  assert.equal(state.money, moneyAfterFirst);
  assert.equal(state.faults, faultsAfterFirst);
  state.year += 1;
  state.money += 100000;
  const nextYear = core.resolveFaultHelp(state, 100000, () => 0.5);
  assert.equal(nextYear.ok, true);
  assert.equal(state.faultHelpUsedYear, state.year);
});

test('help amount maps breakthrough promotion from one to ten percent and stops at department-director level', () => {
  assert.equal(core.faultHelpPromotionChance(1), 0.01);
  assert.equal(core.faultHelpPromotionChance(1000000), 0.10);
  assert.equal(core.faultHelpPromotionChance(5000000), 0.10);

  const promoted = core.newState();
  promoted.money = 1200000;
  promoted.faults = 4;
  promoted.rankIndex = 7;
  const rolls = [0.1, 0.09];
  const result = core.resolveFaultHelp(promoted, 1000000, () => rolls.shift());
  assert.equal(result.promoted, true);
  assert.equal(promoted.rankIndex, 8);
  assert.equal(promoted.rankYears, 0);
  assert.equal(promoted.currentPosition, '待选择具体岗位');

  const blocked = core.newState();
  blocked.money = 1200000;
  blocked.rankIndex = 8;
  const blockedResult = core.resolveFaultHelp(blocked, 1000000, () => 0);
  assert.equal(blockedResult.promoted, false);
  assert.equal(blocked.rankIndex, 8);
});

test('asking for help rejects invalid or unaffordable amounts without changing state', () => {
  const state = core.newState();
  state.money = 80000;
  state.faults = 3;
  const snapshot = JSON.stringify(state);
  assert.equal(core.resolveFaultHelp(state, 0).ok, false);
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(core.resolveFaultHelp(state, 80001).ok, false);
  assert.equal(JSON.stringify(state), snapshot);
});

test('quarter flow resolves an event, then annual settlement', () => {
  const state = core.newState();
  const event = core.startQuarter(state, () => 0.1);
  assert.equal(state.investigationCheckedYear, state.year);
  // 事件池扩充后不能假设选项 0 一定是最优解，改为按绩效挑出最佳选项
  const bestIndex = event.options.findIndex(option => (option.performance || 1) >= 3);
  assert.ok(bestIndex >= 0, '基层事件仍应提供最优选项');
  core.resolveEvent(state, event, bestIndex, () => 0.1);
  assert.equal(state.annualPerformance, 3);
  core.finishQuarter(state, () => 0.99);
  core.finishQuarter(state, () => 0.99);
  core.finishQuarter(state, () => 0.99);
  core.finishQuarter(state, () => 0.99);
  assert.equal(state.year, 2027);
  assert.equal(state.age, 23);
  assert.equal(state.quarter, 1);
  assert.equal(state.rankYears, 1);
  assert.ok(state.providentFund > 0);
});

test('annual expenses are calculated by household and charged at year end', () => {
  const state = core.newState();
  state.children = 1;
  state.hasHouse = true;
  state.hasCar = true;
  state.houseLoanYears = 2;
  state.houseLoanBalance = 24000;
  state.houseAnnualPayment = 12000;
  state.carLoanYears = 1;
  state.carLoanBalance = 6000;
  state.carAnnualPayment = 6000;
  const forecast = core.annualExpenses(state);
  // 基础生活 = 待遇 64000 × 30% = 19200，孩子 25000，房 2250 + 车 1900 = 48350，贷款 30% 计提 5400
  assert.equal(forecast.living, 48350);
  assert.equal(forecast.loan, 5400);
  assert.equal(forecast.total, 53750);
  assert.deepEqual(forecast.livingDetail.map(item => item.label),
    ['基础生活', '子女抚养×1', '住房使用维护', '车辆使用维护']);
  assert.equal(forecast.livingDetail.reduce((sum, item) => sum + item.amount, 0), forecast.living,
    '明细加总必须等于生活支出总额');
  state.quarter = 4;
  const before = state.money;
  core.finishQuarter(state, () => 0.99);
  assert.equal(state.lastAnnualExpense, forecast.total);
  assert.equal(state.money, before + core.annualCompensation(state).salary - forecast.total);
  assert.match(state.records[0], /年度开销53750元/);
  assert.match(state.records[0], /子女抚养×125000元/, '年度记录要逐项列出开销去向');
});

test('annual expenses track the choices instead of sitting at a fixed share of the pay', () => {
  // 开销不是"待遇的固定百分比"：它由生活项（职级/年龄/健康/子女/伴侣）+ 自己签下的贷款决定。
  const build = (patch) => {
    const state = Object.assign(core.newState(), { rankIndex: 6, age: 45, health: 100, children: 1, money: 3000000 }, patch);
    return state;
  };
  const plain = build({});
  const salary = core.annualCompensation(plain).salary;
  const plainRatio = core.annualExpenses(plain).total / salary;
  // 同一职级，多养一个孩子、父母年迈就会多花
  const bigger = build({ children: 2, age: 62 });
  assert.ok(core.annualExpenses(bigger).living > core.annualExpenses(plain).living, '家庭负担变重开销要跟着涨');
  // 买不买房、买多大的房是玩家自己的选择，开销必须拉开差距
  const mid = build({});
  core.buyAsset(mid, 'house', '中档', 350000, 10, false);
  const top = build({});
  core.buyAsset(top, 'house', '顶配', 1000000, 15, false);
  core.buyAsset(top, 'car', '顶配', 280000, 5, false);
  assert.ok(core.annualExpenses(top).total > core.annualExpenses(mid).total, '买得越贵每年还得越多');
  // 基础生活占 30%、一个孩子 2.5 万：无贷家庭落在待遇一半附近，满配负债再叠 22% 封顶的还贷
  const topRatio = core.annualExpenses(top).total / salary;
  assert.ok(topRatio > 0.6 && topRatio < 0.8, `满配负债应落在 60%~80%，实际 ${(topRatio * 100).toFixed(1)}%`);
  assert.ok(plainRatio > 0.4 && plainRatio < 0.6, `无贷带娃家庭应落在 40%~60%，实际 ${(plainRatio * 100).toFixed(1)}%`);
  // 还贷压力封顶只做上限，不做定额：额度没用完时按实际年供走
  const smallLoan = build({});
  core.buyAsset(smallLoan, 'house', '小户型', 250000, 8, false);
  const smallPlan = Math.ceil(smallLoan.houseAnnualPayment * 0.3);
  assert.equal(core.annualExpenses(smallLoan).loan, smallPlan, '未触顶时按 30% 计提，不被抬到上限');
  assert.ok(core.annualExpenses(smallLoan).loan < Math.floor(salary * 0.22));
});

test('living expenses scale with rank, age, health and partner instead of a fixed base', () => {
  // 职级越高，基础生活开销越大
  const junior = core.newState();
  const senior = core.newState();
  senior.rankIndex = 8;
  assert.ok(core.annualExpenses(senior).living > core.annualExpenses(junior).living,
    '高职级的基础开销必须高于基层');
  const rankGrowth = core.annualExpenses(core.newState()).living;
  // 基础生活 = 年度待遇 × 30%：二级科员 64000 → 19200，正厅级 172000 → 51600
  assert.equal(rankGrowth, 19200);
  assert.equal(core.annualExpenses(Object.assign(core.newState(), { rankIndex: 8 })).living - rankGrowth, 51600 - 19200);
  // 50 岁起赡养父母，62 岁起负担加重
  assert.equal(core.annualExpenses(Object.assign(core.newState(), { age: 49 })).living, rankGrowth);
  assert.equal(core.annualExpenses(Object.assign(core.newState(), { age: 50 })).living, rankGrowth + 2250);
  assert.equal(core.annualExpenses(Object.assign(core.newState(), { age: 62 })).living, rankGrowth + 4500);
  // 健康掉到 60 以下开始产生医疗开销，40 以下翻倍
  assert.equal(core.annualExpenses(Object.assign(core.newState(), { health: 60 })).living, rankGrowth);
  assert.equal(core.annualExpenses(Object.assign(core.newState(), { health: 59 })).living, rankGrowth + 1500);
  assert.equal(core.annualExpenses(Object.assign(core.newState(), { health: 39 })).living, rankGrowth + 3000);
  // 伴侣的消费习惯直接进家庭账本：社交型多花，朴素型省钱
  const withSocialite = core.newState();
  withSocialite.relationship = '恋爱';
  withSocialite.partner = '许小姐';
  withSocialite.partnerProfileId = 'socialite';
  assert.equal(core.annualExpenses(withSocialite).living, rankGrowth + 3000);
  const withTeacher = core.newState();
  withTeacher.relationship = '已婚';
  withTeacher.partner = '沈禾';
  withTeacher.partnerProfileId = 'teacher';
  assert.equal(core.annualExpenses(withTeacher).living, rankGrowth - 600);
  const teacherDetail = core.annualExpenses(withTeacher).livingDetail.find(item => item.label.includes('沈禾'));
  assert.ok(teacherDetail && teacherDetail.amount === -600, '伴侣省钱要单独列出一项');
});

test('installment assets use the original 20% down payment and 8% interest', () => {
  const state = core.newState();
  const result = core.buyAsset(state, 'house', '云汀小筑', 250000, 8, false);
  assert.equal(result.ok, true);
  assert.equal(state.money, 30000);
  assert.equal(state.houseLoanBalance, Math.floor(200000 * 1.08));
  assert.equal(state.houseLoanYears, 8);
});

test('retirement outcome checks integrity, health, then age', () => {
  const state = core.newState();
  state.integrity = 20;
  assert.equal(core.retirementEnding(state), '违纪处分');
  state.integrity = 90;
  state.health = 29;
  assert.equal(core.retirementEnding(state), '健康不足强制退休');
  state.health = 90;
  state.age = 65;
  assert.equal(core.retirementEnding(state), '正常退休');
});

test('all rewarded-video flows use the supplied ad unit', () => {
  assert.equal(config.rewardedAdUnitId, '');
  assert.equal(config.faultHelpAdUnitId, '');
  assert.equal(config.appId, '');
});

test('sensitive position routes retain integrity gates', () => {
  const state = core.newState(); state.rankIndex = 3; state.integrity = 79;
  assert.equal(core.positionAvailable(state, '镇党委委员、派出所所长'), false);
  state.integrity = 80;
  assert.equal(core.positionAvailable(state, '镇党委委员、派出所所长'), true);
});

test('source-authoritative content is fully present', () => {
  assert.equal(sourceData.RANKS.length, 11);
  assert.equal(sourceData.EVENTS.length, 16);
  assert.equal(Object.values(sourceData.POSITION_OPTIONS).reduce((sum, list) => sum + list.length, 0), 70);
  assert.equal(Object.values(sourceData.ADDITIONAL_POSITION_EVENTS).reduce((sum, list) => sum + list.length, 0), 46);
  assert.equal(new Set(sourceData.EVENTS.flatMap(event => event.options.map(option => option.text))).size, 48);
});

test('runtime position catalog expands by about fifty percent with realistic roles', () => {
  const sourceCount = Object.values(sourceData.POSITION_OPTIONS).reduce((sum, list) => sum + list.length, 0);
  const runtimeCount = Object.values(core.POSITION_OPTIONS).reduce((sum, list) => sum + list.length, 0);
  assert.equal(sourceCount, 70);
  assert.equal(runtimeCount, 105);
  assert.equal(runtimeCount, Math.floor(sourceCount * 1.5));
  assert.ok(core.POSITION_OPTIONS[4].some(item => item.name === '县财政局局长'));
  assert.ok(core.POSITION_OPTIONS[7].some(item => item.name === '市委常委、秘书长'));
  assert.ok(core.POSITION_OPTIONS[10].some(item => item.name === '省人大常委会主任'));
  Object.values(core.POSITION_OPTIONS).flat().forEach(position => {
    // Some generated legacy entries do not carry a level field; the runtime
    // catalog still requires the user-facing name/description and effects.
    assert.ok(position.name && position.description, position.name);
    assert.ok(position.effect && Object.keys(position.effect).length > 0, position.name);
  });
  Object.values(core.EXTRA_POSITION_OPTIONS).flat().forEach(position => {
    assert.ok(position.level, position.name);
  });
  Object.entries(core.EXTRA_POSITION_OPTIONS).forEach(([rank, positions]) => {
    const expectedLevel = core.RANKS[Number(rank) - 1].short;
    positions.forEach(position => assert.equal(position.level, expectedLevel, position.name));
  });
  assert.ok(core.POSITION_OPTIONS[5].some(item => item.name === '县级市市委常委、组织部部长'));
  assert.ok(core.POSITION_OPTIONS[5].some(item => item.name === '县级市市委常委、宣传部部长'));
  assert.ok(core.POSITION_OPTIONS[6].some(item => item.name === '市政府党组成员、秘书长'));
  assert.ok(core.POSITION_OPTIONS[6].some(item => item.name === '市委政法委副书记（分管日常工作）'));
});

test('position and investigation events use their own effects', () => {
  const state = core.newState();
  state.rankIndex = 3; state.currentPosition = '镇党委委员、纪委书记'; state.quarter = 2;
  const event = core.startQuarter(state, () => 0.01);
  assert.match(event.title, /监督核查|岗位专项/);
  assert.match(state.records[0], /触发监督核查程序/);
  const effectBefore = state.integrity;
  core.resolveEvent(state, event, event.options.findIndex(option => option.performance < 0));
  assert.notEqual(state.integrity, effectBefore);
});

test('staying single to focus on career keeps the original seniority reward', () => {
  const state = core.newState();
  const before = state.seniority;
  core.focusCareer(state);
  assert.equal(state.seniority, before + 1);
});

test('four partner profiles apply distinct health, time and promotion effects', () => {
  assert.equal(core.PARTNER_PROFILES.length, 4);

  const connected = core.newState();
  connected.relationship = '恋爱中';
  connected.partner = '顾小姐';
  connected.partnerProfileId = 'executive_family';
  assert.equal(core.partnerPromotionBonus(connected), 0.04);
  assert.equal(core.currentPromotionChance(connected, 8), 0.30);

  const social = core.newState();
  social.relationship = '恋爱中';
  social.partner = '许小姐';
  social.partnerProfileId = 'socialite';
  social.quarter = 4;
  social.health = 90;
  social.annualPerformance = 4;
  core.finishQuarter(social, () => 0.99);
  assert.equal(social.health, 86, '基础下降1点，许小姐额外消耗3点');
  assert.equal(social.lastPerformance, 3, '高陪伴投入占用1点年度绩效');

  const teacher = core.newState();
  teacher.relationship = '已婚';
  teacher.partner = '沈禾';
  teacher.partnerProfileId = 'teacher';
  teacher.quarter = 4;
  teacher.health = 90;
  teacher.annualPerformance = 4;
  core.finishQuarter(teacher, () => 0.99);
  assert.equal(teacher.health, 89);
  assert.equal(teacher.lastPerformance, 4);
  assert.equal(core.partnerPromotionBonus(teacher), 0);

  const doctor = core.newState();
  doctor.relationship = '已婚';
  doctor.partner = '林静';
  doctor.partnerProfileId = 'doctor';
  doctor.quarter = 4;
  doctor.health = 90;
  core.finishQuarter(doctor, () => 0.99);
  assert.equal(doctor.health, 90, '规律生活抵消基础年度健康损耗');
});

test('年度故事推进后，其余季度继续使用职级题库', () => {
  const state = core.newState();
  state.rankIndex = 3; state.currentPosition = '镇党委委员、纪委书记'; state.quarter = 2;
  const story = core.startQuarter(state, () => 0.99);
  assert.equal(story.storyId, 'school');
  core.resolveEvent(state, story, 0);
  core.finishQuarter(state, () => 0.99);
  assert.equal(state.quarter, 3);
  const event = core.startQuarter(state, () => 0.99);
  // 本年度故事已处理后，其余季度继续命中本职级的原有题库。
  const rankPool = core.rankPoolFor(3);
  assert.ok(rankPool.length >= 50, '职级 3 题库规模');
  assert.ok(rankPool.some(item => item.title === event.title), `应命中职级3题库：${event.title}`);
  assert.ok(event.options.length >= 2);
  assert.ok(event.options.every(option => typeof option.text === 'string' && option.text.length > 0));
});

test('every work submission at leadership ranks uses the current-position event pool', () => {
  const state = core.newState();
  state.rankIndex = 8;
  state.currentPosition = '市委书记';
  state.investigationCheckedYear = state.year;
  for (let quarter = 1; quarter <= 4; quarter += 1) {
    state.quarter = quarter;
    const event = core.startQuarter(state, () => 0);
    assert.doesNotMatch(event.title, /群众办事|汛期排查|森林防火|困难家庭走访/, `第${quarter}季度抽到了基层通用事项`);
  }
});

// ── 手写扩展内容与新增题型 ──────────────────────────────────────────────

test('hand-written events extend the pool and unlock by rank', () => {
  assert.ok(core.EXTRA_COMMON_EVENTS.length >= 30, '扩展事件数量');
  const lowTitles = new Set(core.commonEventPoolFor(core.newState()).map(item => item.title));
  // 低职级不会抽到需要实权才会遇到的高阶事件
  assert.equal(lowTitles.has('老板的饭局'), false);
  assert.equal(lowTitles.has('应酬场合 · 分寸'), false);
  const high = core.newState();
  high.rankIndex = 8;
  const highTitles = new Set(core.commonEventPoolFor(high).map(item => item.title));
  assert.equal(highTitles.has('老板的饭局'), true);
  assert.equal(highTitles.has('应酬场合 · 分寸'), true);
  assert.equal(highTitles.has('特定关系人被调查'), true);
  // 原版 16 条一条都不能丢
  sourceData.EVENTS.forEach(item => assert.ok(highTitles.has(item.title), item.title));
});

test('random event catalog is hand written: unique titles, no recycled option sets', () => {
  // 曾经的"主题 × 变体"批量生成会让几十条事件共用同一组三选项，
  // 玩家选来选去都是那几句。现在整池手写，标题与选项文案都不再复用。
  const titles = core.BURST_EVENTS.map(item => item.title);
  assert.equal(new Set(titles).size, titles.length, '突发事件标题不得重复');
  const optionTexts = new Map();
  core.BURST_EVENTS.forEach(event => (event.options || []).forEach(option => {
    optionTexts.set(option.text, (optionTexts.get(option.text) || 0) + 1);
  }));
  assert.ok(Math.max(...optionTexts.values()) <= 2, '同一句选项文案不得被大量事件复用');
  assert.ok(core.BURST_EVENTS.length >= 60, '突发事件池至少 60 条');
  const hasMoney = event => (event.options || []).some(option => option.effect && (
    Object.prototype.hasOwnProperty.call(option.effect, 'wealth')
    || Object.prototype.hasOwnProperty.call(option.effect, 'money')
  ));
  assert.ok(core.BURST_EVENTS.filter(hasMoney).length >= 15, '要有足够多的事件会动到钱');
  const event = core.BURST_EVENTS.find(hasMoney);
  const optionIndex = event.options.findIndex(option => option.effect && Number(option.effect.wealth || option.effect.money));
  const state = core.newState();
  const before = state.money;
  assert.equal(core.resolveBurst(state, event, optionIndex, () => 0.5), true);
  assert.notEqual(state.money, before, '随机事件的金钱结果应联动现金资产');
});

test('burst options are structurally varied instead of the same three buttons everywhere', () => {
  const pool = core.BURST_EVENTS;
  const count = predicate => pool.filter(predicate).length;
  assert.ok(count(item => item.options.some(option => option.roll)) >= 8, '要有带概率分支的事件');
  assert.ok(count(item => item.options.some(option => option.upgraded)) >= 2, '要有攒够属性才解锁的第三条路');
  assert.ok(count(item => item.options.some(option => option.bond)) >= 15, '要有会结下关系的选项');
  assert.ok(count(item => item.options.some(option => Number(option.risk) < 0)) >= 1, '要有能把痕迹压回去的切割');
  assert.ok(count(item => item.options.length >= 4) >= 4, '要有四条选项的事件');
  assert.ok(count(item => item.options.length === 2) >= 3, '要有只有两条路的纯两难');
  const byLength = {};
  pool.forEach(item => { byLength[item.options.length] = (byLength[item.options.length] || 0) + 1; });
  assert.ok(Object.keys(byLength).length >= 3, '选项数量不能只有一种');
  // 每个职级都有新内容可抽，高职级不该只剩重复
  const sizes = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(rank => core.burstPoolFor({ rankIndex: rank }).length);
  sizes.forEach((size, index) => {
    if (index > 0) assert.ok(size > sizes[index - 1], `职级 ${index + 2} 应当比上一级多出可选的突发事件`);
  });
});

test('one life story limits normal random events to the 20-30 range', () => {
  const state = core.newState();
  state.rankIndex = 11;
  state.randomEventLimit = 24;
  let normalCount = 0;
  for (let index = 0; index < 1000; index += 1) {
    const picked = core.pickBurst(state, () => 0.01);
    if (!picked) break;
    if (picked.kind === 'normal') {
      normalCount += 1;
      core.resolveBurst(state, picked.event, 0, () => 0.99);
    }
  }
  assert.equal(state.randomEventCount, 24);
  assert.ok(normalCount >= 20 && normalCount <= 30);
  assert.equal(core.pickBurst(state, () => 0.01), null);
});

test('conditional choices upgrade once the required attribute is high enough', () => {
  const event = core.EXTRA_COMMON_EVENTS.find(item => item.title === '群众办事 · 一次办好');
  const option = event.options[0];
  const weak = core.newState(); weak.reputation = 40;
  const weakResolved = core.resolveOption(weak, option, () => 0.5);
  assert.equal(weakResolved.performance, 1);
  assert.equal(weakResolved.text, option.text);
  const strong = core.newState(); strong.reputation = 80;
  const strongResolved = core.resolveOption(strong, option, () => 0.5);
  assert.equal(strongResolved.performance, 3);
  assert.notEqual(strongResolved.text, option.text);
  assert.equal(core.meetsRequirement(weak, option.upgraded.require), false);
  assert.equal(core.meetsRequirement(strong, option.upgraded.require), true);
});

test('resolveEvent applies the upgraded branch when the requirement is met', () => {
  const event = core.EXTRA_COMMON_EVENTS.find(item => item.title === '群众办事 · 一次办好');
  const weak = core.newState(); weak.reputation = 30;
  core.resolveEvent(weak, event, 0, () => 0.5);
  assert.equal(weak.annualPerformance, 1);
  assert.match(weak.lastResult, /这一趟还是免不了/);
  const strong = core.newState(); strong.reputation = 90;
  core.resolveEvent(strong, event, 0, () => 0.5);
  assert.equal(strong.annualPerformance, 3);
  assert.match(strong.lastResult, /当天就把事办完了/);
});

test('probabilistic choices follow the injected roll and attribute bonus', () => {
  const event = core.EXTRA_COMMON_EVENTS.find(item => item.title === '项目争取 · 向上汇报');
  const option = event.options[0];
  const strong = core.newState(); strong.network = 60;
  assert.equal(core.resolveOption(strong, option, () => 0.01).performance, 3);
  assert.equal(core.resolveOption(strong, option, () => 0.99).performance, -1);
  // 属性越高，同样的骰子结果会从失败翻成成功
  const weak = core.newState(); weak.network = 0;
  assert.equal(core.resolveOption(weak, option, () => 0.52).performance, -1);
  assert.equal(core.resolveOption(strong, option, () => 0.52).performance, 3);
  // 概率分支必须给出不同的结果文案
  assert.notEqual(core.resolveOption(strong, option, () => 0.01).result, core.resolveOption(strong, option, () => 0.99).result);
  // 概率被限制在 5% ~ 95% 之间
  const maxed = core.newState(); maxed.network = 100;
  assert.equal(core.resolveOption(maxed, option, () => 0.96).performance, -1);
});

test('resolveEvent applies the resolved branch of a probabilistic choice', () => {
  const event = core.EXTRA_COMMON_EVENTS.find(item => item.title === '项目争取 · 向上汇报');
  const state = core.newState(); state.rankIndex = 6; state.network = 60; state.integrity = 90;
  const integrityBefore = state.integrity;
  assert.equal(core.resolveEvent(state, event, 0, () => 0.01), true);
  assert.equal(state.annualPerformance, 3);
  assert.match(state.lastResult, /进入支持名单/);
  assert.match(state.records[0], /项目争取 · 向上汇报/);
  assert.equal(state.integrity, integrityBefore);
});

test('choice shapes now cover two, four and five option events', () => {
  const shapes = new Set(core.EXTRA_COMMON_EVENTS.map(item => item.options.length));
  assert.ok(shapes.has(2), '两难题');
  assert.ok(shapes.has(4), '四选项');
  assert.ok(shapes.has(5), '五选项');
  core.EXTRA_COMMON_EVENTS.concat(...Object.values(core.EXTRA_POSITION_EVENTS)).forEach(item => {
    assert.ok(item.title && item.scene, item.title);
    assert.ok(item.options.length >= 2, item.title);
    item.options.forEach(option => {
      assert.ok(typeof option.text === 'string' && option.text.length > 0, item.title);
      assert.ok(typeof option.result === 'string' && option.result.length > 0, item.title);
      assert.ok(Number.isFinite(option.performance), item.title);
    });
  });
});

test('thin position pools are filled with hand-written events', () => {
  ['grassroots', 'executive', 'discipline', 'department', 'city', 'national', 'province_lead'].forEach(key => {
    assert.ok((core.EXTRA_POSITION_EVENTS[key] || []).length >= 2, key);
    assert.ok(sourceData.POSITION_EVENTS[key] || sourceData.ADDITIONAL_POSITION_EVENTS[key], key);
  });
});

test('every drawable event keeps at least one non-punitive option', () => {
  // 保证不会出现"全是坏选项"的事件，否则玩家无法通过选择维持状态
  core.EXTRA_COMMON_EVENTS.concat(...Object.values(core.EXTRA_POSITION_EVENTS)).forEach(item => {
    assert.ok(item.options.some(option => (option.performance || 1) >= 1), item.title);
  });
});

// ── 突发事件（弹窗式） ────────────────────────────────────────────────

test('burst events only unlock as the player gains real power', () => {
  const junior = core.burstPoolFor({ rankIndex: 1 });
  assert.equal(junior.length, 0, '刚入职的科员不该有人来送东西');
  assert.equal(core.burstChance({ rankIndex: 1, ended: false }), 0);
  const senior = core.burstPoolFor({ rankIndex: 11 });
  const seniorWithPartner = core.burstPoolFor({ rankIndex: 11, relationship: '婚姻', partner: '沈禾', partnerProfileId: 'teacher' });
  assert.equal(seniorWithPartner.length, core.BURST_EVENTS.length);
  assert.equal(senior.length, seniorWithPartner.length);
  assert.ok(core.burstPoolFor({ rankIndex: 3 }).length < senior.length, '低职级池必须更小');
  // 职级越高，被围猎的概率越大，但有上限
  assert.ok(core.burstChance({ rankIndex: 4, ended: false }) > core.burstChance({ rankIndex: 3, ended: false }));
  assert.ok(core.burstChance({ rankIndex: 11, ended: false }) <= core.BURST_BASE_CHANCE + 0.2);
  assert.ok(core.burstChance({ rankIndex: 6, ended: false }) <= 0.5);
  assert.equal(core.burstChance({ rankIndex: 6, ended: true }), 0);
});

test('burst draw is weighted so bribery and investment surface most often', () => {
  const probe = { rankIndex: 11 };
  const pool = core.burstPoolFor(probe);
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  // 权重的意义只有一条：围猎 / 受贿 / 投资这三类要压过其余所有类别的总和
  const hot = pool.filter(item => ['围猎', '受贿', '投资'].includes(item.tag));
  const rest = pool.filter(item => !['围猎', '受贿', '投资'].includes(item.tag));
  assert.ok(hot.length > 0 && rest.length > 0, '两类都要存在，这个断言才有意义');
  const hotWeight = hot.reduce((sum, item) => sum + item.weight, 0);
  const restWeight = rest.reduce((sum, item) => sum + item.weight, 0);
  assert.equal(hotWeight + restWeight, total);
  assert.ok(hotWeight > restWeight * 1.2, '围猎受贿投资的总权重应明显高于其余类别');
  // 确定性验证加权区间：随机点落在哪个累积区间，就取哪一条
  const target = 0.5;
  let cumulative = 0;
  let expected = pool[pool.length - 1];
  for (const item of pool) { cumulative += item.weight; if (target * total <= cumulative) { expected = item; break; } }
  const picked = core.drawBurstEvent({ rankIndex: 11, burstTitles: [] }, () => target);
  assert.equal(picked.title, expected.title);
});

test('burst pool has enough unique content across the career ladder', () => {
  assert.ok(core.BURST_EVENTS.length >= 40, '突发事件池至少要有40条，避免早期职位很快耗尽');
  assert.ok(core.burstPoolFor({ rankIndex: 2 }).length >= 10, '二级科员阶段也要有足够的唯一事件');
  assert.ok(core.burstPoolFor({ rankIndex: 5 }).length > core.burstPoolFor({ rankIndex: 2 }).length);
});

test('burst draw avoids repeating the events just seen and remembers the last six', () => {
  const state = { rankIndex: 11, burstTitles: [] };
  const first = core.drawBurstEvent(state, () => 0);
  assert.ok(state.burstTitles.includes(first.title));
  assert.equal(state.lastBurstTitle, first.title);
  const second = core.drawBurstEvent(state, () => 0);
  assert.notEqual(second.title, first.title, '连续两次不该抽到同一件事');
  for (let index = 0; index < 12; index += 1) core.drawBurstEvent(state, () => 0);
  assert.equal(state.burstTitles.length, 6);
  assert.equal(new Set(state.burstTitles).size, 6);
  assert.equal(state.burstTitles[0], state.lastBurstTitle);
});

test('a burst event happens at most once in one life story, then the pool is exhausted', () => {
  const state = core.newState();
  state.rankIndex = 11;
  const available = core.burstPoolFor(state);
  const seen = [];
  for (let index = 0; index < available.length; index += 1) {
    const picked = core.drawBurstEvent(state, () => 0);
    assert.ok(picked, `第${index + 1}次抽取应该还有未看过的突发事件`);
    seen.push(picked.title);
  }
  assert.equal(new Set(seen).size, available.length, '同一人生故事里不得重复突发事件');
  assert.equal(core.drawBurstEvent(state, () => 0), null, '突发事件池耗尽后不应循环重播');
  assert.equal(state.burstHistory.length, available.length);

  // 风险痕迹再次到顶也不能把同一条“专项倒查”重复弹出。
  const reviewState = core.newState();
  reviewState.rankIndex = 6;
  reviewState.riskTrail = core.RISK_TRAIL_THRESHOLD;
  const firstReview = core.pickBurst(reviewState, () => 0.999);
  assert.equal(firstReview.event.title, '专项倒查');
  assert.equal(core.resolveBurst(reviewState, firstReview.event, 0, () => 0.5, true), true);
  reviewState.riskTrail = core.RISK_TRAIL_THRESHOLD;
  const afterReview = core.pickBurst(reviewState, () => 0);
  assert.notEqual(afterReview && afterReview.event.title, '专项倒查');
});

test('risk trail reaching the threshold forces a special review', () => {
  const state = core.newState(); state.rankIndex = 5;
  assert.equal(core.burstDue(state), false);
  state.riskTrail = core.RISK_TRAIL_THRESHOLD;
  assert.equal(core.burstDue(state), true);
  // 概率判定完全不中，痕迹到顶也必须触发
  const picked = core.pickBurst(state, () => 0.999);
  assert.equal(picked.review, true);
  assert.equal(picked.event.title, '专项倒查');
  // 未到阈值时由概率决定，低职级永远不触发
  const calm = Object.assign(core.newState(), { rankIndex: 6, riskTrail: 1 });
  assert.equal(core.pickBurst(calm, () => 0.999), null);
  assert.equal(core.pickBurst(core.newState(), () => 0.001), null);
});

test('accepting a bribe leaves a risk trail and buys no quarterly performance', () => {
  const event = core.BURST_EVENTS.find(item => item.title === '办公室里多了个档案袋');
  const state = core.newState(); state.rankIndex = 4;
  const integrityBefore = state.integrity;
  const moneyBefore = state.money;
  assert.equal(core.resolveBurst(state, event, 2, () => 0.5), true);
  assert.equal(state.integrity, integrityBefore - 8);
  assert.equal(state.money, moneyBefore + 50000);
  assert.equal(state.riskTrail, 3, '5 万元：超出起征线 2 万元折 2 点，结网再 +1');
  assert.equal(state.annualPerformance, 0, '突发事件不占季度绩效');
  assert.match(state.records[0], /办公室里多了个档案袋/);
  assert.ok(state.lastResult.startsWith(event.options[2].result));
  assert.match(state.lastResult, /同船领导/);
  assert.match(state.lastResult, new RegExp(state.fellows[0].name));
});

test('bribe risk scales with the money taken, not with whatever the author typed', () => {
  const take = (amount, extra = {}) => {
    const s = core.newState();
    s.rankIndex = 6;
    s.year = 2031;
    core.resolveBurst(s, {
      title: '一笔来路不明的钱',
      options: [
        Object.assign({ text: '收下', effect: { integrity: -5, wealth: amount }, risk: 2, result: '钱留下了。' }, extra),
        { text: '原路退回', effect: { integrity: 3 }, risk: 0, result: '钱退回去了。' },
      ],
    }, 0);
    return s;
  };
  // 3 万元起征：以内属于人情往来，只记手写的小额痕迹，不进折算
  const favor = take(20000);
  const justOver = take(40000);
  const mid = take(50000);
  const big = take(120000);
  const huge = take(200000);
  assert.equal(favor.riskTrail, 2, '3 万元以内不折算，按事件里手写的痕迹记');
  assert.equal(justOver.riskTrail, 1, '4 万元：超出部分 1 万折 1 点');
  assert.equal(mid.riskTrail, 2);
  assert.equal(big.riskTrail, 9);
  assert.equal(huge.riskTrail, 10, '折算封顶，不再往上堆');
  assert.ok(justOver.riskTrail < mid.riskTrail && mid.riskTrail < big.riskTrail);
  // 手写的 risk 在"超过起征线的进账"上一律不作数：同样 5 万，写 2 还是写 5 结果一样
  assert.equal(take(50000, { risk: 5 }).riskTrail, mid.riskTrail);
  // 结下关系网的多 1 点 —— 多了一个能开口的人
  assert.equal(take(50000, { bond: { kind: 'fellow', weight: 2, reason: '这笔钱' } }).riskTrail, 3);
  // 退回去、自掏腰包这类"没进账"的选项仍按手写值走，负值（主动切割）也照常生效
  const clean = core.newState();
  clean.riskTrail = 5;
  core.resolveBurst(clean, { title: '主动说明', options: [{ text: '如实说明', effect: { integrity: 4 }, risk: -2, result: '说清楚了。' }] }, 0);
  assert.equal(clean.riskTrail, 3, '主动切割必须能把已经攒下的痕迹压回去');
  // 超线金额的这笔账当场写在结果里，并且记进事证，玩家事后能追溯到每一笔
  assert.match(justOver.lastResult, /意外收入4万元，超过3万元的部分按每万元1点计，往来痕迹 \+1/);
  assert.match(justOver.records[0], /往来痕迹/);
  assert.equal(justOver.evidence[0].risk, 1);
  // 3 万元以内的人情往来不出现折算说明，事证记的是手写值
  assert.ok(!favor.lastResult.includes('超过3万元'), '人情往来不该被当成大额折算');
  assert.equal(favor.evidence[0].risk, 2);
});

test('高职级新增四类大额受贿事件，收下即形成大额不当收入并失去荣誉', () => {
  const events = core.RICH_BURST_EVENTS.filter(item => item.largeBribe === true);
  assert.equal(events.length, 4);
  events.forEach(event => {
    assert.ok(event.minRank >= 8);
    assert.ok(event.options.some(option => option.risk <= 0 && !(option.effect.wealth > 0)), `${event.title}缺少清正路线`);
    assert.ok(event.options.some(option => option.effect.wealth >= 500000), `${event.title}金额不足大额事件门槛`);
  });
  const state = core.newState();
  Object.assign(state, { rankIndex: 11, rankYears: 3, honorTitle: '人民公仆', honorYear: 2066 });
  const event = events.find(item => Math.max(...item.options.map(option => option.effect.wealth || 0)) >= 3000000);
  const index = event.options.findIndex(option => (option.effect.wealth || 0) >= 3000000);
  assert.equal(core.resolveBurst(state, event, index, () => 0.5), true);
  assert.ok(state.illicitIncome >= 3000000);
  assert.equal(state.riskTrail, 10);
  assert.equal(state.honorTitle, '');
  assert.match(state.lastResult, /意外收入\d+万元/);
});

test('a protege bond is also written into the current story chain', () => {
  const event = core.BURST_EVENTS.find(item => item.title === '下属把责任全揽了');
  const state = core.newState(); state.rankIndex = 3;
  assert.equal(core.resolveBurst(state, event, 1, () => 0.5), true);
  assert.equal(state.proteges.length, 1);
  assert.match(state.lastResult, /关系链记录：帮扶对象/);
  assert.match(state.lastResult, new RegExp(state.proteges[0].name));
});

test('turning the envelope in keeps the book clean', () => {
  const event = core.BURST_EVENTS.find(item => item.title === '办公室里多了个档案袋');
  const state = core.newState(); state.rankIndex = 4;
  const integrityBefore = state.integrity;
  assert.equal(core.resolveBurst(state, event, 0, () => 0.5), true);
  assert.ok(state.integrity > integrityBefore);
  assert.equal(state.riskTrail, 0);
  assert.equal(state.money, 80000, '退回的选项不该进账');
});

test('a special review clears the risk trail and is written into the record', () => {
  const state = core.newState(); state.rankIndex = 5; state.riskTrail = core.RISK_TRAIL_THRESHOLD;
  const integrityBefore = state.integrity;
  assert.equal(core.resolveBurst(state, core.REVIEW_EVENT, 1, () => 0.5, true), true);
  assert.equal(state.riskTrail, 0, '倒查结束风险痕迹清零');
  assert.equal(state.reviewCount, 1);
  assert.ok(state.integrity < integrityBefore);
  assert.match(state.lastResult, /专项倒查结束/);
  assert.match(state.records[0], /专项倒查/);
});

test('buying time in a special review is a coin flip, not a death sentence', () => {
  // 六成：话递上去了，问题按"材料瑕疵"归档 —— 但从此和递话的人绑在一条绳上
  const lucky = core.newState(); lucky.rankIndex = 6;
  core.resolveBurst(lucky, core.REVIEW_EVENT, 2, () => 0.5, true);
  assert.match(lucky.lastResult, /口径松了一扣/);
  assert.match(lucky.lastResult, /绑在了同一条绳上/);
  assert.match(lucky.lastResult, /专项倒查结束/);
  // 四成：话还没递上去，"四处找人"先被记了下来
  const unlucky = core.newState(); unlucky.rankIndex = 6;
  core.resolveBurst(unlucky, core.REVIEW_EVENT, 2, () => 0.9, true);
  assert.match(unlucky.lastResult, /每一条都成了态度问题/);
});

test('an investigation can find real problems proportional to current risk', () => {
  const investigation = {
    title: '监督核查',
    isInvestigation: true,
    options: [
      { text: '主动配合并完整提供规范材料', performance: 3, effect: { integrity: 4, reputation: 2, health: -1 }, result: '材料完整、程序规范，核查顺利结束。' },
      { text: '按要求补充材料并说明情况', performance: 1, effect: { integrity: 1, health: -2 }, result: '你及时补齐了记录。' },
      { text: '拖延提供材料且沟通态度消极', performance: -1, effect: { integrity: -8, reputation: -4, health: -2 }, result: '你的配合不够及时。' },
    ],
  };
  // 概率口径：当前落马风险 × 30%（风险 50 → 15%），且已终局或已在审讯中时不再掷骰
  const high = core.newState(); high.rankIndex = 8; high.riskTrail = 12;
  assert.ok(Math.abs(core.investigationFallChance(high) - core.network.fallRiskOf(high).risk * 0.003) < 1e-9);
  assert.equal(core.investigationFallChance(Object.assign(core.newState(), { ended: true, rankIndex: 8, riskTrail: 12 })), 0);
  assert.equal(core.investigationFallChance(Object.assign(core.newState(), { rankIndex: 8, riskTrail: 12, pendingInterrogation: { year: 2031, risk: 60 } })), 0);
  // 两道闸门同年度判定一致：风险不到 20 没有可查的东西；没有线头则落马无从解释
  assert.equal(core.investigationFallChance(core.newState()), 0, '清白的新人不会被核查查出问题');
  const noThread = core.newState();
  noThread.rankIndex = 11;
  noThread.integrity = 0;
  assert.equal(core.investigationFallChance(noThread), 0, '风险再高，也要有一条能追溯到人事的线头');
  // 命中：无论选哪条，按对应言辞结算，并挂上终局审讯；审讯答完态度才定处理档次
  [0, 1, 2].forEach((index) => {
    const state = core.newState();
    state.rankIndex = 8;
    state.riskTrail = 12;
    core.resolveEvent(state, investigation, index, () => 0);
    assert.match(state.lastResult, new RegExp(core.INVESTIGATION_FALL_RESULTS[index].slice(0, 6)));
    assert.equal(state.pendingInterrogation.year, state.year);
    assert.ok(!state.ended, '进入的是审讯程序，终局由审讯的态度决定');
    assert.ok(!state.lastResult.includes('年度绩效'), '被查出问题时不该再谈绩效');
    assert.match(state.records[0], /核查查出问题的概率/);
  });
  const hitState = core.newState();
  hitState.rankIndex = 8;
  hitState.riskTrail = 12;
  core.resolveEvent(hitState, investigation, 0, () => 0);
  assert.equal(core.pickBurst(hitState, () => 0.5).kind, 'interrogation');
  // 未命中：按普通核查结算
  const clean = core.newState();
  clean.rankIndex = 8;
  clean.riskTrail = 12;
  core.resolveEvent(clean, investigation, 2, () => 0.999);
  assert.equal(clean.pendingInterrogation, null);
  assert.match(clean.lastResult, /年度绩效/);
});

test('burst outcomes never push cash below zero', () => {
  const event = core.BURST_EVENTS.find(item => item.title === '装修款已经有人结过了');
  const state = core.newState(); state.rankIndex = 4; state.money = 1000;
  assert.equal(core.resolveBurst(state, event, 0, () => 0.5), true);
  assert.equal(state.money, 0);
});

test('burst content is gated, documented and always leaves a clean way out', () => {
  const tags = new Set();
  core.BURST_EVENTS.forEach(item => {
    tags.add(item.tag);
    assert.ok(item.title && item.scene, item.title);
    assert.ok((item.minRank || 1) >= 2, `${item.title} 不该在入职第一年就出现`);
    assert.ok(Number.isFinite(item.weight) && item.weight > 0, item.title);
    assert.ok(item.options.length >= 2, item.title);
    // 每条突发事件都要有一条完全不沾的选项，玩家不能被逼着违纪
    // （主动报告、切割关系是 risk 为负，比"无风险"更干净，同样算退路）
    assert.ok(item.options.some(option => Number(option.risk) <= 0), `${item.title} 缺少无风险选项`);
    item.options.forEach(option => {
      assert.ok(typeof option.text === 'string' && option.text.length > 2, item.title);
      assert.ok(typeof option.result === 'string' && option.result.length > 4, item.title);
      assert.ok(option.effect && Object.keys(option.effect).length > 0, option.text);
      // 进账选项的 risk 只是兜底初值，真正生效的是 core 按金额重算出来的那一档；
      // 主动切割允许为负，所以下界放到 -2。
      assert.ok(Number.isFinite(option.risk) && option.risk >= -2 && option.risk <= 12, option.text);
      if (option.roll) {
        assert.ok(Number.isFinite(option.roll.chance), option.text);
        assert.ok(option.roll.success && option.roll.fail, option.text);
      }
    });
  });
  ['受贿', '投资', '围猎', '举报', '家庭', '意外'].forEach(tag => assert.ok(tags.has(tag), tag));
  assert.ok(core.REVIEW_EVENT.scene && core.REVIEW_EVENT.options.length >= 2);
  core.REVIEW_EVENT.options.forEach(option => {
    assert.ok(typeof option.text === 'string' && option.text.length > 2);
    assert.ok(typeof option.result === 'string' && option.result.length > 4);
    assert.ok(option.effect && Object.keys(option.effect).length > 0);
  });
});

test('legacy saves without burst fields are upgraded in place', () => {
  const legacy = core.normalizeState({ name: '林知行', rankIndex: 4, riskTrail: 'broken', burstTitles: 'broken' });
  assert.equal(legacy.riskTrail, 0);
  assert.deepEqual(legacy.burstTitles, []);
  assert.deepEqual(legacy.burstHistory, []);
  assert.equal(legacy.reviewCount, 0);
  assert.equal(legacy.lastBurstTitle, '');
  const messy = core.normalizeState({ riskTrail: 99, burstTitles: ['甲', '乙'], reviewCount: '2' });
  assert.equal(messy.riskTrail, 12);
  assert.deepEqual(messy.burstTitles, ['甲', '乙']);
  assert.deepEqual(messy.burstHistory, ['甲', '乙']);
  assert.equal(messy.reviewCount, 2);
  const migrated = core.normalizeState({ rankIndex: 2, burstTitles: [core.BURST_EVENTS[0].title] });
  const next = core.drawBurstEvent(migrated, () => 0);
  assert.notEqual(next.title, core.BURST_EVENTS[0].title, '老存档最近记录里的事件也不能马上重播');
});

// ── 不当收入账本 ──────────────────────────────────────────────────────
// 落马页要逐笔列出"哪一年、哪件事、拿了多少钱"，这本账是唯一来源。
// 判据：带痕迹的进账，或者单笔就上了 3 万。正常工作奖励不该被算成不当收入。
const moneyEvent = () => ({
  title: '一笔说不清的往来',
  tag: '围猎',
  options: [
    { text: '当场推回去', effect: { integrity: 3 }, risk: 0, result: '推回去了。' },
    { text: '收下，觉得就是个意思', effect: { integrity: -6, wealth: 120000 }, risk: 0, result: '收下了。' },
  ],
});

test('收下的钱记进不当收入账本，逐笔可查', () => {
  const state = core.newState();
  state.year = 2033;
  core.resolveBurst(state, moneyEvent(), 1, () => 0.5);
  assert.equal(state.illicitIncome, 120000);
  assert.equal(state.illicitLedger.length, 1);
  assert.equal(state.illicitLedger[0].amount, 120000);
  assert.equal(state.illicitLedger[0].year, 2033);
  assert.equal(state.illicitLedger[0].title, '一笔说不清的往来');
  assert.match(state.illicitLedger[0].choice, /收下/);
});

test('推回去的钱不进账本，也不推高落马风险', () => {
  const state = core.newState();
  core.resolveBurst(state, moneyEvent(), 0, () => 0.5);
  assert.equal(state.illicitIncome, 0);
  assert.deepEqual(state.illicitLedger, []);
  assert.equal(network.illicitRiskOf(state), 0);
});

test('正常工作奖励不算不当收入（无痕迹且远不到 3 万）', () => {
  const state = core.newState();
  const reward = { title: '项目签约', tag: '工作', options: [{ text: '按方案推进', effect: { wealth: 2000, network: 2 }, risk: 0, result: '签约了。' }] };
  core.resolveBurst(state, reward, 0, () => 0.5);
  assert.equal(state.illicitIncome, 0, '2000 元的签约奖金不是不当收入');
  assert.deepEqual(state.illicitLedger, []);
});

test('累计不当收入第一次跨过 3 万时提示一次，之后不再重复', () => {
  const state = core.newState();
  const small = { title: '第一笔', tag: '围猎', options: [{ text: '收下', effect: { wealth: 20000 }, risk: 2, result: '收下了。' }] };
  const big = { title: '第二笔', tag: '围猎', options: [{ text: '收下', effect: { wealth: 20000 }, risk: 2, result: '收下了。' }] };
  core.resolveBurst(state, small, 0, () => 0.5);
  assert.doesNotMatch(state.lastResult, /已超过3万元这条线/);
  core.resolveBurst(state, big, 0, () => 0.5);
  assert.equal(state.illicitIncome, 40000);
  assert.match(state.lastResult, /已超过3万元这条线/);
  const third = { title: '第三笔', tag: '围猎', options: [{ text: '收下', effect: { wealth: 50000 }, risk: 2, result: '收下了。' }] };
  core.resolveBurst(state, third, 0, () => 0.5);
  assert.doesNotMatch(state.lastResult, /已超过3万元这条线/, '只提示跨线那一次');
});

test('不当收入与落马风险联动：拿得越多风险越高', () => {
  const state = core.newState();
  const before = network.fallRiskOf(state).risk;
  const event = { title: '一笔大的', tag: '围猎', options: [{ text: '收下', effect: { wealth: 600000, integrity: -8 }, risk: 0, result: '收下了。' }] };
  core.resolveBurst(state, event, 0, () => 0.5);
  const after = network.fallRiskOf(state).risk;
  assert.ok(after > before, `拿了 60 万之后风险必须上升：${before} → ${after}`);
  assert.ok(network.fallRiskOf(state).parts.illicit >= 20);
});

test('不当收入账本与累计数能穿过存档往返', () => {
  const state = core.newState();
  state.year = 2031;
  core.resolveBurst(state, moneyEvent(), 1, () => 0.5);
  const round = core.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(round.illicitIncome, 120000, '白名单漏掉就会静默归零，落马页逐笔明细会整块消失');
  assert.equal(round.illicitLedger.length, 1);
  assert.equal(round.illicitLedger[0].amount, 120000);
  assert.equal(round.illicitLedger[0].choice, state.illicitLedger[0].choice);
});

test('账本最多留 12 笔，老存档缺字段时补成空账', () => {
  const state = core.newState();
  const event = { title: '往来', tag: '围猎', options: [{ text: '收下', effect: { wealth: 50000 }, risk: 2, result: '收下了。' }] };
  for (let i = 0; i < 20; i += 1) core.resolveBurst(state, event, 0, () => 0.5);
  assert.equal(state.illicitLedger.length, core.ILLICIT_LEDGER_MAX);
  assert.equal(state.illicitIncome, 1000000);
  const legacy = core.normalizeState({ rankIndex: 3 });
  assert.equal(legacy.illicitIncome, 0);
  assert.deepEqual(legacy.illicitLedger, []);
});
