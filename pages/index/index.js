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
function requirementText(state, rank, index) { return `任职满${rank.years}年　年龄≥${rank.age}　考核≥${rank.review}　口碑≥${rank.reputation}　人脉≥${rank.network}　政绩≥${rank.achievement || 0}　过失≤${rank.faultLimit || 99}　机会${Math.round(core.currentPromotionChance(state, index) * 100)}%`; }
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
    const title = state.ended ? `《步步有为》结局：${state.name || '匿名玩家'} · ${rank.short}` : `《步步有为》：${state.name || '匿名玩家'}的仕途成长记录`;
    return { title, path: '/pages/index/index?from=share' };
  },

  onShareTimeline() {
    const state = core.normalizeState(this.data.state);
    const rank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    return { title: `《步步有为》${state.name || '匿名玩家'} · ${rank.short}`, query: 'from=timeline' };
  },

  buildPatch(stateOverride) {
    const state = core.normalizeState(stateOverride || this.data.state || core.newState());
    const rank = core.RANKS[state.rankIndex - 1] || core.RANKS[0];
    const compensation = core.annualCompensation(state);
    const watchCount = state.promotionAdWatchCount;
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
      promotionChanceText: state.rankIndex >= core.RANKS.length ? '已达最高职级' : `${Math.round(core.currentPromotionChance(state, state.rankIndex + 1) * 100)}%`,
      promotionStatusText: state.rankIndex >= core.RANKS.length ? '已达最高职级' : state.promotionAppliedYear === state.year ? '今年已使用' : '今年未使用',
      adText: `本局生涯晋升加成：已领取${watchCount}次，累计 +${watchCount * 3}个百分点；跨年、晋升保留，重新开局清零，最终概率最高100%。`,
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
    if (Math.random() >= chance) { state.lastResult = '本次晋升考察暂未通过，你的任职资历会继续保留。'; core.addRecord(state, `参加${next.name}晋升考察，本次暂未通过。`); this.persist(); return this.showModal({ title: '晋升结果', content: `本次考察暂未通过。\n当前晋升机会为${Math.round(chance * 100)}%，资历和属性不会扣除。\n继续保持良好考核，可在后续年度再次争取。`, showCancel: false }); }
    const bonusPoints = state.promotionAdWatchCount * 3;
    const bonusText = bonusPoints > 0 ? `（含本局生涯累计加成${bonusPoints}个百分点）` : '';
    state.rankIndex += 1; state.rankYears = 0; state.previousPosition = state.currentPosition; state.currentPosition = state.rankIndex >= 3 ? '待选择具体岗位' : '非领导职级'; state.dutyType = core.RANKS[state.rankIndex - 1].dutyType; state.lastResult = `通过竞争与考察，你迎来了新的职级变化。${bonusText}`; core.addRecord(state, `以${Math.round(chance * 100)}%晋升机会${bonusText}晋升至${core.RANKS[state.rankIndex - 1].name}。`); this.persist(); this.choosePosition(() => this.showPromotionResult());
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
    state.promotionAdUsedYear = state.year;
    state.promotionAdWatchCount += 1;
    state.promotionAdBonus = state.promotionAdWatchCount * 0.03;
    // 走卡还是走广告都会走到这里，记录文案不区分渠道，免得履历里出现自相矛盾的描述
    core.addRecord(state, `领取本局生涯晋升加成，累计增加${state.promotionAdWatchCount * 3}个百分点；跨年与晋升后保留。`);
    this.persist();
    wx.showToast({ title: '本局晋升概率 +3个百分点', icon: 'success' });
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
    const title = '步步有为 · 老虎榜';
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
    const title = '步步有为 · 人生排行榜';
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
      content: `${endingLead}\n${state.name ? '主角：' + state.name + '\n' : ''}最终官阶：${core.RANKS[state.rankIndex - 1].name}　具体职事：${state.currentPosition}${honorLine}\n家庭状态：${state.relationship}，子女 ${state.children}人\n退休净财产：${money(state.retirementWealth || core.netWealth(state))}\n${rankText}\n\n感谢体验《步步有为》。这是一个虚构的成长模拟故事。`,
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
    lines.push('', '感谢体验《步步有为》。这是一个虚构的成长模拟故事。');
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
