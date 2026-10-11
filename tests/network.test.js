const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../game/core');
const network = require('../game/network');

// 关系网里的 id 用 Date 与 rng 混出来，测试里不能依赖 Math.random，
// 所以统一喂一个确定性的 rng。
function seededRng(seed = 1) {
  let value = (seed >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function person(overrides = {}) {
  return Object.assign({
    id: 'f1', name: '裴怀瑾', title: '县长', year: 2026,
    weight: 1, reason: '有过几次说不清的往来', fallen: false, fallenYear: 0,
  }, overrides);
}

// ── 人 ────────────────────────────────────────────────────────────────

test('同船的领导与经手的人都是虚构角色，分量限制在一到三档', () => {
  const state = core.newState();
  state.rankIndex = 5;
  const rng = seededRng(7);
  const fellow = network.createFellow(state, { weight: 9, offset: 1, reason: '收下那个档案袋' }, rng);
  assert.equal(fellow.weight, 3, '分量上限是三档，不能靠事件堆出一个人顶十个人');
  // 和你同船的人一般比你高：base = 5-2 = 3，再加一档
  assert.equal(fellow.title, network.LEADER_TITLES[4]);
  assert.equal(fellow.year, 2026);
  assert.equal(fellow.fallen, false);
  assert.equal(fellow.reason, '收下那个档案袋');
  assert.match(fellow.name, /^[裴邢乔滕胥柏蔺霍邱龚席项][\u4e00-\u9fa5]{2}$/);

  const protege = network.createProtege(state, { weight: 0, offset: 0 }, rng);
  assert.equal(protege.weight, 1, '没写分量的人按最轻的一档算');
  assert.equal(protege.title, network.PROTEGE_TITLES[3]);
  assert.notEqual(protege.id, fellow.id);
});

test('职务档位不会越界：最低职级也不会挂上省厅的头衔', () => {
  assert.equal(network.leaderTitleFor(1, 0), network.LEADER_TITLES[0]);
  assert.equal(network.leaderTitleFor(11, 3), network.LEADER_TITLES[network.LEADER_TITLES.length - 1]);
  assert.equal(network.protegeTitleFor(1, 0), network.PROTEGE_TITLES[0]);
  assert.equal(network.protegeTitleFor(11, 5), network.PROTEGE_TITLES[network.PROTEGE_TITLES.length - 1]);
});

test('结网把人和对应的事由一起记下来，单边最多八个人', () => {
  const rng = seededRng(11);
  const state = core.newState();
  const first = network.applyBond(state, { kind: 'fellow', weight: 2, reason: '饭局上的答复' }, rng);
  assert.equal(state.fellows.length, 1);
  assert.equal(state.fellows[0].reason, '饭局上的答复');
  assert.equal(first.weight, 2);
  assert.equal(network.applyBond(state, { kind: 'protege', weight: 1 }, rng).id.startsWith('p'), true);
  assert.equal(state.proteges.length, 1);
  assert.equal(network.applyBond(state, null), null, '没有 bond 的选项不该凭空多出一个人');
  assert.equal(network.applyBond(state, { kind: '' }, rng), null);

  for (let index = 0; index < 20; index += 1) network.applyBond(state, { kind: 'fellow', weight: 1 }, rng);
  assert.equal(state.fellows.length, 8, '存档不能随着事件无限膨胀');
});

test('割席只会断掉还在台上的那个人，而且优先断掉分量最重的', () => {
  const rng = seededRng(3);
  const state = core.newState();
  network.applyBond(state, { kind: 'fellow', weight: 3, reason: '重' }, rng);
  network.applyBond(state, { kind: 'fellow', weight: 1, reason: '轻' }, rng);
  network.takeIntoCustody(state, state.fellows[1]);
  const cut = network.severFrom(state, 'fellow');
  assert.equal(cut.reason, '重');
  assert.equal(state.fellows.length, 1);
  assert.equal(state.fellows[0].reason, '轻');
  // 剩下的那个已经被带走了，割席对他没有意义
  assert.equal(network.severFrom(state, 'fellow'), null);
  assert.equal(network.severFrom(core.newState(), 'protege'), null);
});

// ── 风险 ──────────────────────────────────────────────────────────────

test('风险由关系网的每一个来源加总，一穷二白时为零', () => {
  const rng = seededRng(5);
  const state = core.newState();
  const baseline = network.fallRiskOf(state);
  assert.equal(baseline.risk, 0, '刚入职、没关系、没事由的人不该有落马风险');
  assert.equal(baseline.parts.integrity, 0, '廉政值在 70 以上不加风险');

  network.applyBond(state, { kind: 'fellow', weight: 3, reason: '往来' }, rng);
  assert.equal(network.fallRiskOf(state).risk, Math.round(3 * 4.5));
  network.applyBond(state, { kind: 'protege', weight: 2, reason: '把他推上去' }, rng);
  assert.equal(network.fallRiskOf(state).risk, Math.round(3 * 4.5 + 2 * 2));
});

test('有人在关系网里落马之后，风险只会更高、不会更低', () => {
  const rng = seededRng(5);
  const state = core.newState();
  const fellow = network.applyBond(state, { kind: 'fellow', weight: 3, reason: '往来' }, rng);
  const onStage = network.fallRiskOf(state).risk;
  assert.equal(network.takeIntoCustody(state, fellow), true);
  const afterFall = network.fallRiskOf(state);
  assert.ok(afterFall.risk > onStage, `靠山倒了不该等于变安全：${onStage} → ${afterFall.risk}`);
  assert.equal(afterFall.parts.fellows, 0);
  assert.equal(Math.round(afterFall.parts.fallen), 7 + 3 * 3);
  // 不可逆：重复带走不再叠加
  assert.equal(network.takeIntoCustody(state, fellow), false);
  assert.equal(network.fallRiskOf(state).risk, afterFall.risk);
  assert.equal(network.takeIntoCustody(state, null), false);
});

test('风险档位对应玩家能读懂的描述', () => {
  assert.equal(network.riskLevel(0).label, '低');
  assert.equal(network.riskLevel(14).label, '低');
  assert.equal(network.riskLevel(20).label, '偏低');
  assert.equal(network.riskLevel(30).label, '中');
  assert.equal(network.riskLevel(49).label, '中');
  assert.equal(network.riskLevel(50).label, '偏高');
  assert.equal(network.riskLevel(80).label, '极高');
  assert.ok(network.riskLevel(80).note.length > 0);
});

test('落马概率有两道闸门：风险不够不查，没有线头也不查', () => {
  assert.equal(network.fallChance(core.newState()), 0);

  // 风险够高，但这条线上没有任何人、任何事 —— 不允许天降横祸
  const ghost = core.newState();
  ghost.rankIndex = 11;
  ghost.integrity = 0;
  assert.ok(network.fallRiskOf(ghost).risk >= 20, '前提：这时风险已经很高了');
  assert.equal(network.fallChance(ghost), 0, '玩家说不清是谁把自己带到这一步的，就不该落马');

  // 补上一个线头，概率就出来了
  const wired = core.normalizeState(ghost);
  wired.fellows = [person({ weight: 3 })];
  const chance = network.fallChance(wired);
  assert.ok(chance > 0 && chance <= 0.6);
  // 光给一个风险数字是不够的：第二道闸门要靠关系网与事证才判断得了，
  // 所以这里只接受存档对象，不给裸数字开后门。
  assert.equal(network.fallChance(network.fallRiskOf(wired).risk), 0);
  assert.equal(network.fallChance(null), 0);
  // 风险继续往上，概率只会跟着往上
  wired.riskTrail = 12;
  assert.ok(network.fallChance(wired) > chance);
  assert.ok(network.fallChance(Object.assign(core.normalizeState(wired), { rankIndex: 11, integrity: 0, riskTrail: 12 })) <= 0.6);
});

test('即使一路贪到底也不是必被带走：年度概率封顶，留出漏网之鱼', () => {
  // 2026-09-12 调参：全贪存档的落马率要从 99%+ 落到 98% 左右，
  // 留 2% 的幸运儿一路溜到退休。漏网的唯一来源就是"单年概率不是 1"。
  const worst = core.normalizeState(Object.assign(core.newState(), {
    rankIndex: 11, integrity: 0, riskTrail: 12,
    fellows: [person({ weight: 3 }), person({ id: 'f2', weight: 3 })],
    proteges: [person({ id: 'p1' })],
    evidence: [{ year: 2030, title: '档案袋', risk: 10 }],
  }));
  const chance = network.fallChance(worst);
  assert.ok(chance > 0.2, `满暴露时每年都要有实打实的概率，实际 ${chance}`);
  assert.ok(chance <= 0.4, `但必须留出运气（≤40%），实际 ${chance}`);
  assert.ok(chance < 1, '任何一年都不做"必被带走"的判定');
});

test('关系网里每个人的被带走概率随风险和他自己的分量递增', () => {
  const state = core.newState();
  assert.equal(network.fallChanceFor(state, person()), 0, '风险不到 25 时谁都不会被带走');
  state.rankIndex = 11;
  state.integrity = 0;
  const light = network.fallChanceFor(state, person({ weight: 1 }));
  const heavy = network.fallChanceFor(state, person({ weight: 3 }));
  assert.ok(heavy > light && light > 0);
  assert.ok(network.fallChanceFor(Object.assign(core.normalizeState(state), { integrity: 0, rankIndex: 11, riskTrail: 12, fellows: [person()], proteges: [person({ id: 'p1' })] }), person({ weight: 3 })) <= 0.6);
});

// ── 事证 ──────────────────────────────────────────────────────────────

test('被记下来的事由按时间倒序累积，最多十条', () => {
  const state = core.newState();
  assert.equal(network.recordEvidence(state, { title: '一份档案袋' }, { text: '原样退回', risk: 0 }), null, '没有风险的选择不该进材料');
  const entry = network.recordEvidence(state, { title: '一份档案袋' }, { text: '收下，什么都不问', risk: 3 });
  assert.equal(entry.year, 2026);
  assert.equal(entry.title, '一份档案袋');
  assert.equal(entry.choice, '收下，什么都不问');
  assert.equal(network.evidenceRiskTotal(state), 3);
  for (let index = 0; index < 20; index += 1) {
    network.recordEvidence(state, { title: `事${index}` }, { text: 'x', risk: 1 });
  }
  assert.equal(state.evidence.length, 10);
  assert.equal(state.evidence[0].title, '事19');
  assert.equal(network.evidenceRiskTotal(core.newState()), 0);
});

// ── 牵连 ──────────────────────────────────────────────────────────────

test('牵连事件点出具体是谁、当年是什么事把你们连在一起', () => {
  const state = core.newState();
  state.year = 2031;
  const fellow = person({ weight: 3, reason: '收下那个档案袋', fallen: true, fallenYear: 2031 });
  const asFellow = network.buildFellowFallEvent(state, fellow, 'fellow');
  const asProtege = network.buildFellowFallEvent(state, fellow, 'protege');

  assert.equal(asFellow.tag, '牵连');
  assert.match(asFellow.title, /裴怀瑾被带走了/);
  assert.match(asFellow.scene, /同一条船上的人/);
  assert.match(asProtege.scene, /你扶上去的人/);
  assert.match(asFellow.scene, /收下那个档案袋/);
  assert.match(asProtege.scene, /收下那个档案袋/);
  // 没有 reason 的人也要能出一段完整的话，不能出现 undefined
  assert.doesNotMatch(network.buildFellowFallEvent(state, person({ reason: '' }), 'fellow').scene, /undefined/);

  assert.equal(asFellow.options.length, 3);
  const explain = asFellow.options[0];
  assert.equal(explain.sever, 1);
  assert.equal(explain.severKind, 'fellow');
  assert.ok(explain.risk < 0, '主动说明必须能把关系砍掉、把风险压回去');
  assert.equal(asProtege.options[0].severKind, 'protege');
  assert.ok(asFellow.options.some(option => option.risk > 0), '必须存在一条会把事情做坏的选项');
});

// ── 审讯 ──────────────────────────────────────────────────────────────

test('审讯把落马的人和玩家当年的选择一起摆上桌', () => {
  const state = core.newState();
  state.year = 2033;
  state.rankIndex = 7;
  state.fellows = [person({ weight: 3, fallen: true, fallenYear: 2031 })];
  state.evidence = [
    { year: 2027, title: '一份档案袋', choice: '收下，什么都不问', risk: 3 },
    { year: 2028, title: '一个饭局', choice: '去了，席上把话说开了', risk: 2 },
  ];
  const event = network.buildInterrogationEvent(state);
  assert.equal(event.tag, '审查');
  assert.match(event.scene, /裴怀瑾全都交代了/);
  assert.match(event.scene, /2027年，一份档案袋 —— 你当时选的是「收下，什么都不问」/);
  assert.match(event.scene, /2028年，一个饭局/);
  assert.deepEqual(event.options.map(option => option.stance), ['confess', 'silent', 'defy']);
});

test('审讯文本按存档实际情况组装：你扶上去的人开口、或者谁都没开口', () => {
  const protegeOnly = core.newState();
  protegeOnly.proteges = [person({ id: 'p1', name: '乔守拙', title: '科长', fallen: true, fallenYear: 2030 })];
  const byProtege = network.buildInterrogationEvent(protegeOnly);
  assert.match(byProtege.scene, /乔守拙把知道的都说了/);
  assert.match(byProtege.scene, /科长乔守拙/);

  // 一个人都没倒：材料上一页别人的签名都没有，只有你自己的签字
  const alone = network.buildInterrogationEvent(core.newState());
  assert.match(alone.scene, /最上面是你自己签过字的那些纸/);
  assert.match(alone.scene, /这些，你怎么解释/);
  assert.match(alone.options[0].result, /谈话从最早的一笔往来开始/);
});

test('三种审讯态度都不存在过关，但处理档次和追缴结果各不相同', () => {
  const state = core.newState();
  state.money = 680000;
  state.evidence = [{ year: 2027, title: '一份档案袋', choice: '收下', risk: 12 }];

  assert.equal(network.confiscationOf(state, 'confess'), network.confiscationOf(state, 'confess'));
  const confess = network.confiscationOf(state, 'confess');
  const silent = network.confiscationOf(state, 'silent');
  const defy = network.confiscationOf(state, 'defy');
  assert.ok(confess < silent && silent < defy, `追缴应当随态度递增：${confess} / ${silent} / ${defy}`);
  assert.equal(defy, 680000, '对抗审查全部追缴');
  assert.ok(confess > 0);
  assert.ok(network.confiscationRate(state, 'confess') < network.confiscationRate(state, 'silent'));
  assert.equal(network.confiscationRate(state, 'defy'), 1);
  assert.equal(network.confiscationRate(state, 'unknown-stance'), 0, '未知态度不该算出一个比例');

  // 当年收得越重，追缴越狠 —— 玩家能看清每一笔选择换了什么
  const light = Object.assign({}, state, { evidence: [] });
  assert.ok(network.confiscationOf(light, 'confess') < confess);
  assert.equal(network.confiscationOf(Object.assign({}, state, { money: 0 }), 'defy'), 0);

  const stances = Object.keys(network.FALL_STANCES);
  assert.deepEqual(stances, ['confess', 'silent', 'defy']);
  stances.forEach(stance => {
    assert.ok(network.FALL_STANCES[stance].ending.length > 0);
    assert.match(network.FALL_STANCES[stance].note, /开除/);
  });
});

// ── 与主流程的接线 ────────────────────────────────────────────────────

test('有待处理的审讯时，突发事件一律让位给审讯', () => {
  const state = core.newState();
  state.pendingInterrogation = { year: 2033, risk: 68 };
  const picked = core.pickBurst(state);
  assert.equal(picked.kind, 'interrogation');
  assert.equal(picked.event.title, '被带走之后');
  assert.equal(picked.review, false);
  // 已经结束的存档不再抽任何事件
  state.ended = true;
  assert.equal(core.pickBurst(state), null);
});

test('有人被带走这件事每年最多来一次，且会自己加重痕迹', () => {
  const state = core.newState();
  state.rankIndex = 11;
  state.integrity = 0;
  state.fellows = [person({ weight: 3 })];
  // 概率完全命中，确保抽中"某人被带走"（不要用 Math.random，那会让用例变得时灵时不灵）
  const picked = core.pickFellowFall(state, () => 0);
  assert.ok(picked, '风险高、分量重的人应当会到点');
  assert.equal(picked.kind, 'fellowFall', 'kind 是给突发事件用的分类，不是人的分类');
  assert.equal(picked.event.tag, '牵连');
  assert.match(picked.event.scene, /同一条船上的人/, '同船的人倒了，不能写成你扶上去的人');
  assert.equal(state.fellows[0].fallen, true);
  assert.equal(state.fellows[0].fallenYear, state.year);
  assert.equal(state.networkEventYear, state.year);
  assert.equal(state.riskTrail, 2, '串并案的压力会落到你身上');
  assert.equal(core.pickFellowFall(state, () => 0), null, '同一年不再重复来');

  // 换到明年，但关系网上已经没人还在台上了
  state.year += 1;
  assert.equal(core.pickFellowFall(state, () => 0), null);
});

test('突发结算会把结网、割席和事证一起落进存档', () => {
  const state = core.newState();
  state.year = 2029;
  const collect = {
    title: '一份档案袋',
    options: [
      { text: '收下，什么都不问', effect: { integrity: -5 }, risk: 3, bond: { kind: 'fellow', weight: 2, reason: '收下那个档案袋' } },
      { text: '原样退回去', effect: { integrity: 2 }, risk: 0, sever: 1, severKind: 'fellow' },
    ],
  };
  assert.equal(core.resolveBurst(state, collect, 0), true);
  assert.equal(state.fellows.length, 1);
  assert.equal(state.fellows[0].weight, 2);
  assert.equal(state.fellows[0].year, 2029);
  assert.equal(state.evidence.length, 1);
  assert.equal(state.evidence[0].choice, '收下，什么都不问');
  assert.equal(state.riskTrail, 3);

  const returnIt = { title: '退回原件', options: [collect.options[1]] };
  assert.equal(core.resolveBurst(state, returnIt, 0), true);
  assert.equal(state.fellows.length, 0, '把关系断掉之后，风险来源也跟着消失');
  assert.equal(state.evidence.length, 1, '没有风险的选择不该进材料');
  assert.equal(state.riskTrail, 3, '退回原件不额外加痕迹');
});

test('落马结算：廉政清零、按态度追缴、记录进档案并且不能重开', () => {
  const state = core.newState();
  state.year = 2033;
  state.age = 48;
  state.rankIndex = 8;
  state.currentPosition = '县委办副主任';
  state.money = 500000;
  state.fellows = [person({ weight: 3, fallen: true, fallenYear: 2031 })];
  state.pendingInterrogation = { year: 2033, risk: 68 };
  state.evidence = [{ year: 2027, title: '一份档案袋', choice: '收下，什么都不问', risk: 3 }];

  const event = core.pickBurst(state).event;
  const confessIndex = event.options.findIndex(option => option.stance === 'confess');
  assert.equal(core.resolveInterrogation(state, event, confessIndex), true);

  assert.equal(state.ended, true);
  assert.equal(state.ending, '主动交代，从轻处理');
  assert.equal(state.integrity, 0);
  assert.equal(state.pendingInterrogation, null);
  assert.equal(state.riskTrail, 0);
  assert.equal(state.fallDetail.stance, 'confess');
  assert.equal(state.fallDetail.informant, '县长裴怀瑾');
  assert.ok(state.fallDetail.confiscated > 0);
  assert.equal(state.money, 500000 - state.fallDetail.confiscated);
  assert.match(state.fallDetail.proofs[0], /2027年，一份档案袋/);
  assert.match(state.fallDetail.proofs[0], /收下，什么都不问/);
  assert.match(state.lastResult, /主动交代问题/);
  assert.match(state.lastResult, /合法财产予以保护/, '主动交代的处理口径要和沉默、对抗区分开');
  assert.match(state.ending, /从轻/);

  // 存档往返之后这些信息一个都不能丢
  const restored = core.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.fallDetail.informant, '县长裴怀瑾');
  assert.equal(restored.fallDetail.confiscated, state.fallDetail.confiscated);
  assert.deepEqual(restored.fallDetail.proofs, state.fallDetail.proofs);
  assert.doesNotThrow(() => core.retirementEnding(restored));
  assert.equal(core.pickBurst(restored), null);
  // 非法索引不该把存档弄成半落马状态
  assert.equal(core.resolveInterrogation(core.newState(), event, 99), false);
});

test('老存档补字段：关系网与事证缺字段时安全降级，脏数据被丢掉', () => {
  const restored = core.normalizeState({ fellows: 'broken', proteges: null, evidence: 'nope' });
  assert.deepEqual(restored.fellows, []);
  assert.deepEqual(restored.proteges, []);
  assert.deepEqual(restored.evidence, []);
  assert.equal(restored.pendingInterrogation, null);
  assert.equal(restored.fallDetail, null);
  assert.equal(network.fallRiskOf(restored).risk, 0);

  const dirty = core.normalizeState({
    fellows: [
      { id: 'f1', name: '裴怀瑾', title: '县长', weight: 99, fallen: 'yes', evil: { nested: true } },
      { name: 'x'.repeat(40), weight: -3 },
    ],
    evidence: [{ year: 'abc', title: 'y'.repeat(80), choice: 'z'.repeat(200), risk: 99 }],
  });
  assert.equal(dirty.fellows.length, 2);
  assert.equal(dirty.fellows[0].weight, 3);
  assert.equal(dirty.fellows[0].fallen, false, 'fallen 必须是严格的 true，字符串不算');
  assert.equal(dirty.fellows[0].evil, undefined, '白名单之外的字段一律丢掉');
  assert.equal(dirty.fellows[1].weight, 1);
  assert.equal(dirty.fellows[1].name.length, 6);
  assert.equal(dirty.evidence[0].risk, 12);
  assert.equal(dirty.evidence[0].title.length, 40);
  assert.equal(dirty.evidence[0].choice.length, 60);
  assert.ok(Number.isFinite(dirty.evidence[0].year));
});

test('突发事件里确实挂着能结网、能记事的选项', () => {
  const bonded = [];
  const risky = [];
  core.BURST_EVENTS.forEach(event => (event.options || []).forEach(option => {
    if (option.bond) bonded.push(option);
    if (Number(option.risk) > 0) risky.push(option);
  }));
  assert.ok(bonded.length >= 8, `结网选项太少，机制会和事件表脱钩：${bonded.length}`);
  assert.ok(bonded.some(option => option.bond.kind === 'fellow'));
  assert.ok(bonded.some(option => option.bond.kind === 'protege'));
  assert.ok(bonded.every(option => Number(option.bond.weight) >= 1 && Number(option.bond.weight) <= 3));
  assert.ok(risky.length >= 6, `会被记进材料的选择太少：${risky.length}`);
});

test('落马判定优先于退休结局：被立案的人不可能"到点走人"', () => {
  const state = core.newState();
  state.quarter = 4;
  state.rankIndex = 11;
  state.integrity = 0;
  state.money = 500000;
  state.fellows = [person({ weight: 3 })];
  state.evidence = [{ year: 2030, title: '一份档案袋', choice: '收下', risk: 12 }];
  // 前提：廉政低于 20 本来会直接判"违纪处分"
  assert.equal(core.retirementEnding(state), '违纪处分');
  assert.ok(network.fallChance(state) > 0);

  const result = core.finishQuarter(state, () => 0);
  assert.equal(result.fall, true);
  assert.equal(result.ending, '');
  assert.equal(state.ended, false, '玩家还没表态，不能直接算成结局');
  assert.ok(state.pendingInterrogation, '挂了待审讯标记，页面必须把它弹出来');
  assert.ok(state.pendingInterrogation.risk >= 60);

  // 表完态才真正结束，而且落的是落马结局，不是退休结局
  const event = core.pickBurst(state).event;
  assert.equal(event.title, '被带走之后');
  assert.equal(core.resolveInterrogation(state, event, 0), true);
  assert.equal(state.ended, true);
  assert.notEqual(state.ending, '违纪处分离职');
});

test('没有任何线头的存档照常退休，不会被落马机制牵连', () => {
  const state = core.newState();
  state.quarter = 4;
  state.age = (core.RANKS[state.rankIndex - 1].retirementAge || 65) - 1;
  const result = core.finishQuarter(state, () => 0);
  assert.equal(result.fall, false);
  assert.equal(result.ending, '正常退休');
  assert.equal(state.ended, true);
  assert.equal(state.pendingInterrogation, null);
  assert.equal(state.fallDetail, null);
});

// ── 不当收入：落马最主要的一条线 ──────────────────────────────────────
// 3 万元是性质分界线。这一组用例守的是"钱和风险严格联动"这条主线：
// 金额越大风险越高（单调），3 万以内不进风险，且跨过门槛的那一步要看得见。

test('不当收入 3 万元以内不计入落马风险', () => {
  assert.equal(network.illicitRiskOf({ illicitIncome: 0 }), 0);
  assert.equal(network.illicitRiskOf({ illicitIncome: 20000 }), 0);
  assert.equal(network.illicitRiskOf({ illicitIncome: 30000 }), 0, '正好 3 万仍算人情往来');
  assert.equal(network.illicitRiskOf({}), 0);
});

test('不当收入越多，落马风险越高（单调递增，且过了 3 万才起步）', () => {
  const at = income => network.illicitRiskOf({ illicitIncome: income });
  assert.ok(at(30001) > 0, '刚过门槛就该有分数');
  assert.ok(at(100000) > at(50000));
  assert.ok(at(500000) > at(100000));
  assert.ok(at(1000000) >= at(500000));
  assert.equal(at(100000000), network.ILLICIT_RISK_CAP, '再多也只到封顶');
});

test('不当收入折算进落马风险总分，是各项里的最大头', () => {
  const base = { rankIndex: 9, integrity: 70, riskTrail: 0, evidence: [], fellows: [], proteges: [] };
  const clean = network.fallRiskOf(Object.assign({}, base, { illicitIncome: 0 }));
  const dirty = network.fallRiskOf(Object.assign({}, base, { illicitIncome: 600000 }));
  assert.equal(clean.parts.illicit, 0);
  assert.ok(dirty.parts.illicit > 0);
  assert.ok(dirty.risk - clean.risk >= 20, '贪到 60 万，风险应显著高于清白同职级');
  assert.ok(dirty.parts.illicit > dirty.parts.rank, '不当收入要比"职高显眼"更主要');
});

test('只有不当收入也算线头：拿过钱本身就是能被追的一条线', () => {
  const state = { rankIndex: 1, integrity: 90, evidence: [], fellows: [], proteges: [], riskTrail: 0, illicitIncome: 5000 };
  assert.equal(network.hasThread({}), false);
  // 5 千元不足以进风险，但已经是一条能追溯到具体往来的线头
  assert.equal(network.hasThread(state), true);
  assert.equal(network.fallChance(state), 0, '风险不到闸门，有线索也不会来查');
});

test('不当收入折算说明把"钱怎么变成风险"写在明面上', () => {
  assert.match(network.illicitRiskNote({ illicitIncome: 0 }), /没有查到现金往来/);
  assert.match(network.illicitRiskNote({ illicitIncome: 20000 }), /未超过3万元/);
  const note = network.illicitRiskNote({ illicitIncome: 130000 });
  assert.match(note, /13万元/);
  assert.match(note, /超过3万元/);
  assert.match(note, /落马风险 \+/);
});

test('第一道闸门用风险分档说话：低于分档线不查', () => {
  assert.equal(network.FALL_CHANCE_MIN_RISK, 30);
  const just = { rankIndex: 1, integrity: 90, evidence: [{ year: 2030, title: 'x', choice: 'y', risk: 3 }], illicitIncome: 0, fellows: [], proteges: [], riskTrail: 0 };
  const risk = network.fallRiskOf(just).risk;
  assert.ok(risk < network.FALL_CHANCE_MIN_RISK, `这条用例的前提是风险低于闸门，实际 ${risk}`);
  assert.equal(network.fallChance(just), 0);
  assert.ok(network.hasThread(just), '有线头，但因为风险不够不查');
});
