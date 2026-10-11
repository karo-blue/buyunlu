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
