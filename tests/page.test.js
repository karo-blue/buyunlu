// Use an inert endpoint only inside tests; the distributed application stays offline.
require('../services/config').leaderboardApiBaseUrl = 'https://example.invalid/buyunlu-api';
const test = require('node:test');
const assert = require('node:assert/strict');

function createPageInstance(definition) {
  const instance = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch, callback) {
      Object.entries(patch || {}).forEach(([key, value]) => {
        const parts = key.split('.');
        let target = this.data;
        while (parts.length > 1) {
          const part = parts.shift();
          target[part] = target[part] || {};
          target = target[part];
        }
        target[parts[0]] = value;
      });
      if (callback) callback();
    },
  });
  return instance;
}

test('page boots, opens first-run naming, and keeps event choices in-page', () => {
  let definition;
  const saved = [];
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: (key, value) => saved.push([key, value]),
    removeStorageSync: () => {},
    showToast: () => {},
  };

  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();

  assert.equal(page.data.nameSelect.visible, true);
  assert.equal(page.data.nameSelect.groups[0].title, '名字候选');
  assert.equal(page.data.nameSelect.surnames.length, 70);
  assert.equal(page.data.nameSelect.givenNames.length, 15);
  assert.equal(page.data.nameSelect.groups[0].names.length, 15);
  assert.equal(new Set(page.data.nameSelect.groups[0].names).size, 15);
  assert.ok(page.data.nameSelect.groups[0].names.every(name => name.startsWith(page.data.nameSelect.surname)));
  assert.equal(page.data.nameSelect.groups.length, 1);
  const firstSurname = page.data.nameSelect.surname;
  page.selectSurname({ detail: { value: 3 } });
  assert.notEqual(page.data.nameSelect.surname, firstSurname);
  assert.ok(page.data.nameSelect.groups[0].names.every(name => name.startsWith(page.data.nameSelect.surname)));
  const firstGivenNames = page.data.nameSelect.givenNames.slice();
  page.refreshNameChoices();
  assert.equal(page.data.nameSelect.givenNames.length, 15);
  assert.equal(new Set(page.data.nameSelect.givenNames).size, 15);
  assert.equal(firstGivenNames.some(name => page.data.nameSelect.givenNames.includes(name)), false);
  page.selectPresetName({ currentTarget: { dataset: { name: page.data.nameSelect.groups[0].names[0] } } });
  assert.equal(page.data.nameSelect.selected, page.data.nameSelect.groups[0].names[0]);
  page.setData({ 'nameSelect.visible': false });
  page.setData({ 'state.name': '林知行' });
  page.refresh();
  assert.equal(page.data.nameKicker, '生涯简报');
  assert.equal(page.data.careerTitle, '林知行 · 二级科员');
  assert.equal(page.data.expenseText, '预计年度开销 1.9万（基础生活1.9万）');
  const share = page.onShareAppMessage();
  assert.match(share.title, /林知行/);
  assert.equal(share.path, '/pages/index/index?from=share');
  assert.equal(page.data.promotionStatusText, '今年未使用');
  page.data.state.promotionAppliedYear = page.data.state.year;
  page.refresh();
  assert.equal(page.data.promotionStatusText, '今年已使用');
  page.data.state.promotionAppliedYear = 0;
  page.refresh();
  page.data.state.rankYears = 1;
  page.data.state.network = 0;
  page.refresh();
  assert.equal(page.data.state.rankYears, 1);
  assert.equal(page.data.metrics.find(item => item.label === '累计过失').action, 'faultBribe');
  assert.equal(page.data.metrics.find(item => item.label === '腐败指数'), undefined);
  assert.equal(page.data.metrics.find(item => item.label === '落马风险').value, 0);
  page.showStats();
  assert.doesNotMatch(page.data.dialog.content, /腐败指数/);
  assert.match(page.data.dialog.content, /落马风险：0\/100/);
  page.closeDialog();
  page.startQuarter();
  assert.ok(page.data.currentEvent);
  assert.equal(page.data.scrollIntoView, '');
  assert.equal(page.data.dialog.visible, false);

  page.selectEventOption({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.currentEvent, null);
  assert.equal(page.data.dialog.visible, true);
  assert.equal(page.data.dialog.mode, 'modal');
  // 结算弹窗必须先呈现这一手选择带来的后果，不能只报"本季度完成"
  assert.match(page.data.dialog.content, /选择，年度绩效/);
  assert.ok(saved.length > 0);
  page.closeDialog();
  for (let index = 0; index < 3; index += 1) {
    page.startQuarter();
    page.selectEventOption({ currentTarget: { dataset: { index: 0 } } });
    page.closeDialog();
  }
  assert.equal(page.data.state.year, 2027);
  assert.equal(page.data.state.age, 23);
  assert.equal(page.data.state.rankYears, 2);

  let navAction = '';
  page.runNavAction = action => { navAction = action; };
  page.selectNav({ currentTarget: { dataset: { nav: 'asset' } } });
  assert.equal(page.data.activeNav, 'asset');
  assert.equal(page.data.dialog.mode, 'actions');
  assert.deepEqual(page.data.dialog.items, ['购置房产', '购置车辆', '账户管理']);
  page.dialogSelect({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(navAction, 'car');

  page.selectNav({ currentTarget: { dataset: { nav: 'main' } } });
  assert.deepEqual(page.data.dialog.items, ['晋升条件', '监督核查说明', '年度考核回顾']);
  page.dialogSelect({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.dialog.visible, false);
  page.showPromotionPath();
  assert.equal(page.data.dialog.mode, 'actions');
  assert.ok(page.data.dialog.items.includes('看广告，晋升概率+3%'));
  assert.equal(page.data.dialog.cancelText, '返回');
  page.closeDialog();

  page.health();
  page.dialogConfirm();
  assert.deepEqual(page.data.dialog.items, [
    '日常锻炼 · 免费 · 恢复3点',
    '医院门诊 · 0.3万元 · 恢复8点',
    '住院调养 · 1.2万元 · 恢复18点',
  ]);
  page.closeDialog();

  page.handleMetricAction({ currentTarget: { dataset: { action: 'faultBribe' } } });
  assert.equal(page.data.dialog.title, '累计过失处理');
  assert.equal(page.data.dialog.mode, 'amount');
  assert.equal(page.data.dialog.confirmText, '寻求领导的帮助');
  assert.equal(page.data.dialog.shareAction, 'faultHelp');
  assert.equal(page.data.dialog.shareReady, false);
  assert.match(page.data.dialog.content, /成功减少2点累计过失，失败增加1点/);
  assert.match(page.data.dialog.content, /成功后有机会破格晋升/);
  assert.doesNotMatch(page.data.dialog.content, /1%至10%|100万元|概率/);
  assert.match(page.data.dialog.content, /本年度请领导拉一把机会：未使用/);
  page.dialogAmountInput({ detail: { value: '12a345' } });
  assert.equal(page.data.dialog.inputValue, '12345');
  assert.equal(page.data.dialog.shareReady, true);
  page.closeDialog();

  page.data.state.faultHelpUsedYear = page.data.state.year;
  page.handleMetricAction({ currentTarget: { dataset: { action: 'faultBribe' } } });
  assert.equal(page.data.dialog.mode, 'modal');
  assert.match(page.data.dialog.content, /本年度请领导拉一把机会已经使用/);
  page.closeDialog();

  page.data.state.name = '高植物';
  page.data.state.age = 31;
  page.data.state.year = 2035;
  page.data.state.currentPosition = '县处级副职岗位';
  page.data.state.rankIndex = 5;
  page.showPromotionResult();
  assert.match(page.data.dialog.content, /姓名：高植物/);
  assert.match(page.data.dialog.content, /当前年龄：31岁/);
  assert.match(page.data.dialog.content, /当前年度：2035年/);
  page.closeDialog();

  page.data.state.ended = true;
  page.data.state.ending = '正常退休';
  page.showEnding();
  assert.equal(page.data.dialog.confirmText, '查看排行榜');
  assert.equal(page.data.dialog.cancelText, '再试一次');
  assert.match(page.data.dialog.content, /综合排名：第\d+名/);
  page.closeDialog();
  assert.equal(page.data.state.ended, false);
  assert.equal(page.data.nameSelect.visible, true);

  let selected = -1;
  page.showActionSheet({ itemList: ['第一项', '第二项'], success: result => { selected = result.tapIndex; } });
  page.dialogSelect({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(selected, 1);
  assert.equal(page.data.dialog.visible, false);

  page.openNameSelect();
  page.confirmName();
  assert.equal(page.data.nameSelect.visible, true);
  assert.equal(page.data.nameSelect.error, '请选择下方的候选角色名');
  page.setData({ 'nameSelect.selected': '王某某' });
  page.confirmName();
  assert.equal(page.data.nameSelect.error, '请从下方候选中选择安全角色名');

  delete global.Page;
  delete global.wx;
});

test('fault-help action validates amount, shares to a friend, and keeps rewarded ads separate', () => {
  let definition;
  let closeHandler = null;
  const requestedAdUnits = [];
  const sharedAd = {
    onLoad() {},
    onError() {},
    onClose(handler) { if (!closeHandler) closeHandler = handler; },
    offLoad() {},
    offError() {},
    offClose() {},
    show() { return Promise.resolve(); },
    load() { return Promise.resolve(); },
  };
  global.Page = page => { definition = page; };
  global.wx = {
    createRewardedVideoAd(options) { requestedAdUnits.push(options.adUnitId); return sharedAd; },
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showShareMenu: () => {},
    showToast: () => {},
    nextTick: callback => callback(),
  };
  global.getCurrentPages = () => [page];

  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();
  page.data.state.name = '高植物';
  page.data.state.money = 200000;
  page.data.state.faults = 5;
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    page.openFaultHelpDialog();
    page.dialogAmountInput({ detail: { value: '0' } });
    page.shareFaultHelp();
    assert.equal(page.data.dialog.visible, true);
    assert.match(page.data.dialog.content, /大于0元/);
    assert.equal(page.data.state.money, 200000);
    assert.equal(page.data.state.faults, 5);

    page.dialogAmountInput({ detail: { value: '100000' } });
    page.shareFaultHelp();
  } finally {
    Math.random = originalRandom;
    delete global.getCurrentPages;
  }
  assert.deepEqual(requestedAdUnits, [], '请领导拉一把改为转发，不应创建对应激励广告');
  assert.equal(page.data.state.money, 100000);
  // 0.5 < 70% 成功率 → 走成功分支，过失 -2
  assert.equal(page.data.state.faults, 3);
  assert.equal(page.data.state.faultHelpUsedYear, page.data.state.year);
  const share = page.onShareAppMessage();
  assert.equal(share.path, '/pages/index/index?from=fault-help-share');

  page.watchPromotionAd();
  assert.equal(requestedAdUnits[requestedAdUnits.length - 1], '');
  closeHandler({ isEnded: true });
  assert.equal(page.data.state.promotionAdWatchCount, 1);
});

test('a burst pop-up breaks in after the quarter settles and must be answered', () => {
  let definition;
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showToast: () => {},
    showShareMenu: () => {},
    nextTick: callback => callback(),
  };
  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();
  page.setData({ 'nameSelect.visible': false });
  page.setData({ 'state.name': '林知行' });
  // 有实权的岗位才会有人来送东西；0.35 同时躲开监督核查(20%)又低于突发概率(40%)
  page.data.state.rankIndex = 6;
  page.data.state.currentPosition = '市委副秘书长';
  page.data.state.rankYears = 1;
  page.refresh();
  assert.equal(page.data.burst.visible, false);

  const originalRandom = Math.random;
  Math.random = () => 0.35;
  try {
    page.startQuarter();
    assert.ok(page.data.currentEvent, '季度事项应正常抽出');
    page.selectEventOption({ currentTarget: { dataset: { index: 0 } } });
    assert.equal(page.data.currentEvent, null);
    assert.equal(page.data.dialog.visible, true);
    page.closeDialog();
    // 处理完事项之后突然弹出来，且不给取消按钮
    assert.equal(page.data.burst.visible, true);
    assert.ok(page.data.burst.title);
    assert.ok(page.data.burst.options.length >= 2);
    assert.equal(page.data.burst.review, false);
    assert.match(page.data.burst.tip, /必须当场表态/);

    const burstTitle = page.data.burst.title;
    page.selectBurstOption({ currentTarget: { dataset: { index: 0 } } });
    assert.equal(page.data.burst.visible, false);
    assert.equal(page.data.dialog.visible, true);
    assert.match(page.data.dialog.title, /^突发/);
    assert.match(page.data.dialog.content, new RegExp(burstTitle));
    assert.match(page.data.state.records[0], new RegExp(burstTitle));
    page.closeDialog();
  } finally {
    Math.random = originalRandom;
    delete global.getCurrentPages;
  }
  // 事件索引必须跟着洗牌后的顺序走，不能把风险加错到别的选项上
  assert.ok(page.data.state.riskTrail >= 0);
});

test('a special review is forced once the risk trail is full', () => {
  let definition;
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showToast: () => {},
    showShareMenu: () => {},
    nextTick: callback => callback(),
  };
  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();
  page.setData({ 'nameSelect.visible': false });
  page.setData({ 'state.name': '林知行' });
  page.data.state.rankIndex = 6;
  page.data.state.currentPosition = '市委副秘书长';
  page.data.state.riskTrail = 6;
  page.data.state.records = [];
  // 概率完全不中也要弹倒查：这是玩家自己攒出来的结果
  const originalRandom = Math.random;
  Math.random = () => 0.99;
  try {
    assert.equal(page.maybeBurstEvent(), true);
    assert.equal(page.data.burst.review, true);
    assert.equal(page.data.burst.title, '专项倒查');
    page.selectBurstOption({ currentTarget: { dataset: { index: 0 } } });
    assert.equal(page.data.state.riskTrail, 0);
    assert.equal(page.data.state.reviewCount, 1);
    assert.match(page.data.dialog.title, /专项倒查/);
    page.closeDialog();
  } finally {
    Math.random = originalRandom;
  }
});

test('every WXML binding has a matching page handler and data field', () => {
  const { auditPageWiring } = require('../tools/check-page-wiring');
  const result = auditPageWiring();
  assert.ok(result.handlers.includes('selectBurstOption'), '突发事件的选项必须绑上处理器');
  assert.deepEqual(result.missingHandlers, [], 'WXML 引用了不存在的处理函数');
  assert.deepEqual(result.missingObjects, [], 'WXML 绑定了 data 里不存在的对象');
  assert.deepEqual(result.missingFields, [], 'WXML 绑定了对象里不存在的字段');
  assert.ok(result.boundObjects.includes('burst'), 'burst 弹窗应当绑定到 data.burst');
});

// 免广告卡的完整链路：登录 → 晋升加成有卡先扣卡 → 卡用完回落播广告 → 购买补卡。
// 请领导拉一把已改为转发给好友，不再消耗免广告卡。
test('免广告卡只服务晋升广告，领导请托改为转发', async () => {
  let definition;
  const adUnits = [];
  const consumeScenes = [];
  const storage = new Map();
  let serverBalance = 2;
  let paidOrders = 0;
  let adShows = 0;
  let closeHandler = null;
  const sharedAd = {
    onLoad() {}, onError() {},
    onClose(handler) { closeHandler = handler; },
    offLoad() {}, offError() {}, offClose() {},
    show() { adShows += 1; return Promise.resolve(); },
    load() { return Promise.resolve(); },
  };
  global.Page = page => { definition = page; };
  global.wx = {
    createRewardedVideoAd(options) { adUnits.push(options.adUnitId); return sharedAd; },
    getStorageSync: key => (storage.has(key) ? storage.get(key) : null),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    showShareMenu: () => {},
    showToast: () => {},
    showLoading: () => {},
    hideLoading: () => {},
    nextTick: callback => callback(),
    getSystemInfoSync: () => ({ SDKVersion: '3.5.0', platform: 'devtools', version: '8.0.50' }),
    login: options => options.success({ code: 'wx-code' }),
    // 支付成功的一瞬间平台就会开始推发货，这里用余额增加来模拟
    requestVirtualPayment: options => { paidOrders += 1; serverBalance += 10; options.success({}); },
    request(options) {
      const respond = payload => options.success({ statusCode: 200, data: payload });
      const url = String(options.url);
      if (url.endsWith('/pay/status')) return respond({ ok: true, enabled: true, productId: 'adcard10', goodsPrice: 100, cardsPerUnit: 10 });
      if (url.endsWith('/pay/login')) return respond({ ok: true, token: 'token-1' });
      if (url.endsWith('/pay/balance')) return respond({ ok: true, balance: serverBalance, totalPurchased: 0, totalConsumed: 0 });
      if (url.endsWith('/pay/consume')) {
        consumeScenes.push(options.data && options.data.scene);
        if (serverBalance <= 0) return respond({ ok: false, reason: 'empty', balance: 0 });
        serverBalance -= 1;
        return respond({ ok: true, balance: serverBalance });
      }
      if (url.endsWith('/pay/order')) return respond({ ok: true, outTradeNo: 'BYL1', cards: 10, payData: { signData: '{}', paySig: 'p', signature: 's', mode: 'short_series_goods' } });
      return respond({ ok: true });
    },
  };
  const flush = async (times = 12) => {
    for (let index = 0; index < times; index += 1) await new Promise(resolve => setImmediate(resolve));
  };

  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  // 「等到账」的窗口压到毫秒级：用例不该被真实时钟拖成 1.5 秒
  page._payWaitMs = 300;
  page._payPollMs = 5;
  page.onLoad();
  await flush();

  // 支付能力拉到了，入口才出现；价格以后台配置为准
  assert.equal(page.data.pay.enabled, true);
  assert.equal(page.data.pay.balance, 2);
  assert.equal(page.data.pay.priceText, '￥1 / 10 张');

  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    // 请领导拉一把：直接转发，一次卡和广告都不该扣/拉起
    adUnits.length = 0;
    consumeScenes.length = 0;
    page.data.state.name = '高植物';
    page.data.state.money = 200000;
    page.data.state.faults = 5;
    page.openFaultHelpDialog();
    page.dialogAmountInput({ detail: { value: '100000' } });
    page.shareFaultHelp();
    await flush();
    assert.deepEqual(consumeScenes, []);
    assert.deepEqual(adUnits, [], '转发操作不该拉起激励广告');
    assert.equal(page.data.pay.balance, 2, '转发操作不该消耗免广告卡');
    assert.equal(page.data.state.money, 100000);
    // 0.5 < 70% 成功率 → 走成功分支，过失 -2
    assert.equal(page.data.state.faults, 3);
    assert.equal(page.data.state.faultHelpUsedYear, page.data.state.year);

    // 扣卡前先卡住不成立的操作：机会已用完时不能白扣一张
    page.data.state.faultHelpUsedYear = page.data.state.year;
    const balanceBefore = page.data.pay.balance;
    consumeScenes.length = 0;
    page.submitFaultHelp('100000');
    await flush();
    assert.deepEqual(consumeScenes, [], '操作不成立时不该扣卡');
    assert.equal(page.data.pay.balance, balanceBefore);

    // 玩家明确点“看广告”时必须尊重选择，即使有卡也不能先扣卡。
    page.data.state.promotionAdUsedYear = 0;
    page.data.state.promotionAdWatchCount = 0;
    consumeScenes.length = 0;
    const showsBeforeVideoChoice = adShows;
    page.showPromotionPath();
    const videoIndex = page.data.dialog.items.indexOf('看广告，晋升概率+3%');
    page.dialogSelect({ currentTarget: { dataset: { index: videoIndex } } });
    await flush();
    assert.deepEqual(consumeScenes, [], '明确选择看广告时不该扣除免广告卡');
    assert.equal(adShows, showsBeforeVideoChoice + 1, '明确选择看广告时应直接拉起激励广告');
    closeHandler({ isEnded: true });
    assert.equal(page.data.state.promotionAdWatchCount, 1, '看完广告应正常获得晋升加成');

    // 只有明确点“用免广告卡”时才扣卡，而且不拉起广告。
    consumeScenes.length = 0;
    const showsBeforeCardChoice = adShows;
    page.showPromotionPath();
    const cardIndex = page.data.dialog.items.findIndex(item => item.startsWith('用免广告卡'));
    page.dialogSelect({ currentTarget: { dataset: { index: cardIndex } } });
    await flush();
    assert.deepEqual(consumeScenes, ['promotion']);
    assert.equal(adShows, showsBeforeCardChoice, '明确选择用卡时不该拉起激励广告');
    assert.equal(page.data.pay.balance, 1);

    // 无卡时晋升加成仍然回落到对应的激励视频
    serverBalance = 0;
    page.setPay({ balance: 0 });
    page.data.state.promotionAdUsedYear = 0;
    page.data.state.promotionAdWatchCount = 0;
    adUnits.length = 0;
    page.watchPromotionAd();
    await flush();
    assert.equal(adUnits[adUnits.length - 1], '');
    closeHandler({ isEnded: true });
    assert.equal(page.data.state.promotionAdWatchCount, 1, '晋升广告看完应给加成');

    // 「没卡」是正常业务结果，不能被当成接口错误抛出来
    const virtualPay = require('../services/virtual-pay');
    const empty = await virtualPay.consume('promotion');
    assert.deepEqual(empty, { ok: false, reason: 'empty', balance: 0 });

    // 购买：拉起支付，发货是异步的，页面轮询到余额变化才算成功。
    // 这里 await 页面返回的 Promise，而不是睡固定时长 —— 靠墙钟猜时间在并行跑测试时必然漂移。
    const ordersBefore = paidOrders;
    const buying = page.buyAdCard();
    assert.equal(page.data.pay.buying, true, '确认到账之前按钮要挡住重复点击');
    assert.equal(page.data.pay.buyLabel, '处理中…');
    await flush();
    assert.equal(paidOrders, ordersBefore + 1, '必须真的拉起虚拟支付');
    await buying;
    assert.equal(page.data.pay.buying, false, '到账后按钮要恢复可点');
    assert.equal(page.data.pay.balance, 10, '发货到账后余额要刷新');
    assert.match(page.data.dialog.title, /购买成功/);
    assert.match(page.data.dialog.content, /10 张/);
  } finally {
    Math.random = originalRandom;
    delete global.Page;
    delete global.wx;
  }
});

// 没开通虚拟支付时必须彻底静默：不发支付请求，也不能因为查不到就报错打扰玩家。
test('支付未开通时悬浮窗保持说明态，不发支付请求', async () => {
  let definition;
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showShareMenu: () => {},
    showToast: () => {},
    nextTick: callback => callback(),
    // 老基础库：没有 requestVirtualPayment
    getSystemInfoSync: () => ({ SDKVersion: '2.10.0', platform: 'ios', version: '8.0.10' }),
    request() { throw new Error('支付未开通时不该发任何请求'); },
  };
  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const flush = async (times = 12) => {
    for (let index = 0; index < times; index += 1) await new Promise(resolve => setImmediate(resolve));
  };
  const page = createPageInstance(definition);
  page.onLoad();
  await flush();
  assert.equal(page.data.pay.enabled, false);
  assert.equal(page.cardBalance(), 0);
  // 没卡就只有看广告一条路
  page.showPromotionPath();
  assert.ok(page.data.dialog.items.includes('看广告，晋升概率+3%'));
  assert.ok(page.data.dialog.items.every(item => !item.includes('用免广告卡')), '没卡时不能出现用卡选项');
  page.closeDialog();
  page.showAdCard();
  assert.match(page.data.dialog.content, /暂未开放/);
  page.closeDialog();
  delete global.Page;
  delete global.wx;
});

// 买不了卡 ≠ 卡不能用了：基础库太老/开发者工具里只是不能下单，
// 已经买到的卡必须照常扣、照常跳过广告，否则玩家等于白花钱。
test('不支持购买时仍然查余额：买不了也能用已经买到的卡', async () => {
  let definition;
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showShareMenu: () => {},
    showToast: () => {},
    nextTick: callback => callback(),
    getSystemInfoSync: () => ({ SDKVersion: '2.10.0', platform: 'ios', version: '8.0.10' }),
    login: (options) => options && options.success && options.success({ code: 'fake-code' }),
    request(options) {
      const url = String((options && options.url) || '');
      const done = data => options.success && options.success({ statusCode: 200, data });
      if (url.includes('/pay/login')) return done({ ok: true, token: 't' });
      if (url.includes('/pay/balance')) return done({ ok: true, balance: 3 });
      throw new Error(`不支持购买时不该发 ${url}`);
    },
  };
  const flush = async (times = 12) => {
    for (let index = 0; index < times; index += 1) await new Promise(resolve => setImmediate(resolve));
  };
  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();
  await flush();
  assert.equal(page.data.pay.enabled, false, '环境不支持购买');
  assert.equal(page.data.pay.balance, 3, '但余额要照常同步下来');
  assert.equal(page.cardBalance(), 3);
  page.showPromotionPath();
  assert.ok(page.data.dialog.items.some(item => item.includes('用免广告卡')), '有卡就要给出用卡选项');
  assert.ok(page.data.dialog.items.some(item => item.includes('剩3张')));
  page.closeDialog();
  // 有卡时不该再显示"暂未开放"，说明里要先把余额摆出来
  page.showAdCard();
  assert.doesNotMatch(page.data.dialog.content, /暂未开放/);
  assert.match(page.data.dialog.content, /当前余额：3 张/);
  page.closeDialog();
  delete global.Page;
  delete global.wx;
});

test('免广告卡图标加载失败时退回文字徽章，不留空白', async () => {
  let definition;
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showShareMenu: () => {},
    showToast: () => {},
    nextTick: callback => callback(),
    getSystemInfoSync: () => ({ SDKVersion: '2.19.2', platform: 'android', version: '8.0.49' }),
    login: options => options && options.success && options.success({ code: 'c' }),
    request(options) { options.success && options.success({ statusCode: 200, data: { ok: true, enabled: true, goodsPrice: 10, cardsPerUnit: 1, balance: 0 } }); },
  };
  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();
  assert.equal(page.data.adCardIconBroken, false);
  page.onAdCardIconError();
  assert.equal(page.data.adCardIconBroken, true, '图片报错后要切成文字徽章');
  delete global.Page;
  delete global.wx;
});

test('有卡时晋升路线同时提供用卡与看广告两个选项，存档弹窗不带说明小字', () => {
  let definition;
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showShareMenu: () => {},
    showToast: () => {},
    nextTick: callback => callback(),
    getSystemInfoSync: () => ({ SDKVersion: '2.19.2', platform: 'android', version: '8.0.49' }),
    request() { throw new Error('本用例不该发任何请求'); },
  };
  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();
  // 模拟服务端发货后本机有卡
  page._payRaw = { enabled: true, balance: 5 };
  page.showPromotionPath();
  const items = page.data.dialog.items;
  assert.ok(items.some(item => item.includes('用免广告卡') && item.includes('剩5张')), '用卡选项要显示剩余张数');
  assert.ok(items.includes('看广告，晋升概率+3%'), '有卡也要保留看广告的选项，玩家可以省着用');
  assert.ok(items.indexOf(items.find(i => i.includes('用免广告卡'))) < items.indexOf('看广告，晋升概率+3%'),
    '用卡排在看广告前面，一眼看到省钱的那条');
  page.closeDialog();
  // 存档弹窗：说明小字已按要求去掉，content 必须是空
  page.save();
  assert.equal(page.data.dialog.mode, 'actions');
  assert.equal(page.data.dialog.content, '');
  assert.equal(page.data.dialog.title, '保存到本机');
  page.closeDialog();
  delete global.Page;
  delete global.wx;
});

// ── 关系网与落马 ──────────────────────────────────────────────────────

function bootPage() {
  let definition;
  global.Page = page => { definition = page; };
  global.wx = {
    getStorageSync: () => null,
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showToast: () => {},
    showShareMenu: () => {},
    nextTick: callback => callback(),
  };
  const pagePath = require.resolve('../pages/index/index');
  delete require.cache[pagePath];
  require(pagePath);
  const page = createPageInstance(definition);
  page.onLoad();
  page.setData({ 'nameSelect.visible': false });
  page.setData({ 'state.name': '林知行' });
  return page;
}

test('跨年故事沿季度按钮呈现、结算并存档，履历可查看进度', () => {
  const page = bootPage();
  const storage = require('../services/storage');
  const saved = new Map();
  global.wx.setStorageSync = (key, value) => saved.set(key, JSON.parse(JSON.stringify(value)));
  Object.assign(page.data.state, { quarter: 2, investigationCheckedYear: 2026 });
  page.startQuarter();
  assert.equal(page.data.currentEvent.storyId, 'school');
  const firstTitle = page.data.currentEvent.title;
  page.cancelEvent();
  page.startQuarter();
  assert.equal(page.data.currentEvent.title, firstTitle);
  const event = page.data.currentEvent;
  const index = event.options.findIndex(option => option.id === 'survey');
  page.selectEventOption({ currentTarget: { dataset: { index } } });
  assert.equal(page.data.state.quarter, 3);
  assert.equal(page.data.currentEvent, null);
  assert.match(page.data.dialog.content, /逐间核对/);
  assert.match(page.data.dialog.content, /2027年起继续/);
  assert.equal(saved.get(storage.KEY).storyProgress.school[0].choiceId, 'survey');
  const afterChoice = JSON.stringify(page.data.state);
  page.resolveEvent(event, index);
  assert.equal(JSON.stringify(page.data.state), afterChoice, '旧选择不能再推进季度或领奖');
  page.closeDialog();
  page.showRecords();
  assert.match(page.data.dialog.content, /跨年经历/);
  assert.match(page.data.dialog.content, /老旧学校修缮（已推进1\/4）/);
  assert.match(page.data.dialog.content, /2026年：雨后的教室/);
  page.closeDialog();
  Object.assign(page.data.state, { year: 2027, quarter: 2, investigationCheckedYear: 2027 });
  page.refresh();
  page.startQuarter();
  assert.equal(page.data.currentEvent.storyStep, 1);
  assert.match(page.data.currentEvent.scene, /当年逐间核对/);
});

test('问责、作风处分和落马结局对齐参考页，并允许立即再试一次', () => {
  const page = bootPage();

  Object.assign(page.data.state, {
    ended: true,
    ending: '违纪处分',
    age: 48,
    integrity: 12,
  });
  page.showEnding();
  assert.equal(page.data.dialog.cancelText, '再试一次');
  assert.equal(page.data.dialog.title, '人生结局：违纪处分');
  assert.match(page.data.dialog.content, /违规问题在核查中被发现/);
  assert.match(page.data.dialog.content, /纪律处分/);
  assert.doesNotMatch(page.data.dialog.content, /离职/);
  assert.match(page.data.dialog.content, /仕途就此止步/);

  Object.assign(page.data.state, {
    ended: true,
    ending: '作风问题处理',
    fallDetail: { stance: 'conduct', cause: '作风问题', confiscated: 0 },
  });
  page.showEnding();
  assert.equal(page.data.dialog.title, '人生结局：作风处分');
  assert.equal(page.data.dialog.cancelText, '再试一次');
  assert.match(page.data.dialog.content, /作风问题在核查中被发现/);
  assert.match(page.data.dialog.content, /仕途就此止步/);
  assert.doesNotMatch(page.data.dialog.content, /被带走调查/);

  page.dialogConfirm();
  assert.equal(page.data.dialog.title, '步步有为 · 人生排行榜');
  assert.equal(page.data.dialog.confirmText, '再试一次');
  assert.equal(page.data.dialog.cancelText, '关闭');
  page.dialogConfirm();
  assert.equal(page.data.state.ended, false);
  assert.equal(page.data.nameSelect.visible, true);

  delete global.Page;
  delete global.wx;
});

test('关系网卡片按存档派生人数与风险，开局整块不渲染', () => {
  const page = bootPage();
  // 开局没关系也没风险，这块不占地方
  assert.equal(page.data.net.visible, false);
  assert.equal(page.data.net.leaders, 0);
  assert.equal(page.data.net.proteges, 0);
  assert.equal(page.data.net.risk, 0);

  page.data.state.rankIndex = 6;
  page.data.state.currentPosition = '市委副秘书长';
  page.data.state.fellows = [{ id: 'f1', name: '裴怀瑾', title: '县长', year: 2026, weight: 3, reason: '收下那个档案袋', fallen: false, fallenYear: 0 }];
  page.data.state.proteges = [{ id: 'p1', name: '乔守拙', title: '科长', year: 2027, weight: 1, reason: '替他说过话', fallen: true, fallenYear: 2031 }];
  page.refresh();

  assert.equal(page.data.net.visible, true);
  assert.equal(page.data.net.leaders, 1, '同船领导');
  assert.equal(page.data.net.proteges, 1, '经我帮扶');
  assert.equal(page.data.net.fallen, 1, '已经被带走的人');
  // 在台上的 weight3 = 13.5，已落马的 weight1 = 7+3，职级 6 的显眼程度 = 3
  assert.equal(page.data.net.risk, Math.round(13.5 + 10 + 3));
  assert.equal(page.data.net.level, '偏低');
  assert.equal(page.data.net.tone, 'low');
  assert.ok(page.data.net.note.length > 0);

  delete global.Page;
  delete global.wx;
});

// 关系网详情入口已下线：菜单里没有、runNavAction 也不再路由，
// 保留一条断言防止有人把入口悄悄加回来。
test('关系网入口已下线，navAction 不再路由到详情', () => {
  const page = bootPage();
  page.data.state.rankIndex = 6;
  page.data.state.currentPosition = '市委副秘书长';
  page.data.state.fellows = [{ id: 'f1', name: '裴怀瑾', title: '县长', year: 2026, weight: 3, reason: '收下那个档案袋', fallen: false, fallenYear: 0 }];
  page.refresh();
  page.runNavAction('network');
  assert.notEqual(page.data.dialog.title, '关系网与落马风险');
  assert.ok(typeof page.showNetwork !== 'function', 'showNetwork 处理器应已删除');
  // 落马风险指标仍在主页状态区，数字照常派生
  assert.ok(page.data.net.risk > 0, '风险照常累积');
  delete global.Page;
  delete global.wx;
});

// 老虎榜入口在主页「全网榜单」条上（不在档案菜单），只上真实落马记录。
test('老虎榜入口挂在主页榜单条，离线时只显示本机落马记录', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const page = bootPage();
  assert.equal(typeof page.showTigerBoard, 'function', 'showTigerBoard 处理器应存在');
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  assert.match(wxml, /bindtap="showTigerBoard"/);
  assert.match(wxml, /class="board-button board-button-tiger"/);
  // 档案菜单里依旧没有它
  page.setData({ activeNav: 'records' });
  page.refresh();
  assert.ok(!page.data.navActions.some(item => item.action === 'tigerboard'));
  // 没有落马记录时是空榜，不造样本
  const ranking = require('../services/leaderboard').getTigerRanking(page.data.state);
  assert.equal(ranking.total, 0);
  assert.match(require('../services/leaderboard').formatTigerRanking(ranking), /还没有公开的落马记录/);
  delete global.Page;
  delete global.wx;
});

test('落马流程：风险很高但没有任何线头时不查，不允许天降横祸', () => {
  const page = bootPage();
  page.data.state.rankIndex = 11;
  page.data.state.integrity = 0;
  page.refresh();
  // 前提：风险已经被拉得很高，但这条线上没有任何人、任何事
  assert.ok(page.data.net.risk >= 20, '前提：此时风险已经很高');
  assert.equal(page.data.net.leaders + page.data.net.proteges + page.data.net.fallen, 0);
  const originalRandom = Math.random;
  // 普通突发事件必须完全不中（满职级下它的概率是 0.5），
  // 否则这个用例会被另一个机制干扰，时灵时不灵。
  Math.random = () => 0.99;
  try {
    assert.equal(page.maybeBurstEvent(), false);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(page.data.state.pendingInterrogation, null);
  assert.equal(page.data.burst.visible, false);
  delete global.Page;
  delete global.wx;
});

test('落马结局：审讯勾起当年的事，表完态直接进落马结局', () => {
  const page = bootPage();
  Object.assign(page.data.state, {
    year: 2033, age: 49, rankIndex: 8, currentPosition: '县委办副主任', money: 400000,
    pendingInterrogation: { year: 2033, risk: 64 },
    fellows: [{ id: 'f1', name: '裴怀瑾', title: '县长', year: 2026, weight: 3, reason: '收下那个档案袋', fallen: true, fallenYear: 2031 }],
    proteges: [{ id: 'p1', name: '周砚川', title: '科长', year: 2029, weight: 1, reason: '你替他核过一次材料', fallen: false, fallenYear: 0 }],
    evidence: [{ year: 2027, title: '一份档案袋', choice: '收下，什么都不问', risk: 3 }],
  });
  page.refresh();

  assert.equal(page.maybeBurstEvent(), true);
  assert.equal(page.data.burst.visible, true);
  assert.equal(page.data.burst.flag, '组织谈话');
  assert.equal(page.data.burst.title, '被带走之后');
  // 勾起当时的事：谁开的口、当年选了哪一手
  assert.match(page.data.burst.scene, /裴怀瑾全都交代了/);
  assert.match(page.data.burst.scene, /2027年，一份档案袋 —— 你当时选的是「收下，什么都不问」/);
  assert.match(page.data.burst.tip, /不会再有别的可能/);

  const labels = page.data.burst.options.map(option => option.text);
  assert.equal(labels.length, 3);
  assert.ok(labels.some(text => /如实交代/.test(text)));
  assert.ok(labels.some(text => /保持沉默/.test(text)));
  assert.ok(labels.some(text => /拒不交代/.test(text)));

  const silentIndex = page.data.burst.options.findIndex(option => /保持沉默/.test(option.text));
  page.selectBurstOption({ currentTarget: { dataset: { index: silentIndex } } });
  assert.equal(page.data.burst.visible, false);
  assert.equal(page.data.dialog.title, '处理结论');
  assert.equal(page.data.dialog.tone, 'danger');
  assert.match(page.data.dialog.content, /经组织审查/);
  assert.equal(page.data.state.ended, true);
  assert.equal(page.data.state.ending, '落马被查');
  assert.equal(page.data.state.integrity, 0);
  assert.equal(page.data.state.pendingInterrogation, null);
  assert.equal(page.data.state.fallDetail.stance, 'silent');
  assert.equal(page.data.state.fallDetail.informant, '县长裴怀瑾');
  assert.ok(page.data.state.fallDetail.confiscated > 0);
  assert.ok(page.data.state.money < 400000);

  // 确认结论之后进落马结局：谁开的口、当年哪几件事、追缴了多少
  page.dialogConfirm();
  assert.match(page.data.dialog.title, /落马被查/);
  assert.equal(page.data.dialog.tone, 'danger');
  assert.match(page.data.dialog.content, /被带走调查/);
  assert.match(page.data.dialog.content, /经组织审查/);
  assert.match(page.data.dialog.content, /出面交代的人：县长裴怀瑾/);
  assert.match(page.data.dialog.content, /压在桌上的那几件事/);
  assert.match(page.data.dialog.content, /2027年，一份档案袋/);
  assert.match(page.data.dialog.content, /追缴涉案资金/);
  // 关系网入口已下线，落马页不再统计人数（只留"谁开的口 + 那几件事"）
  assert.doesNotMatch(page.data.dialog.content, /同船领导\d+人/);
  assert.match(page.data.dialog.content, /关系链记录/);
  assert.match(page.data.dialog.content, /同船领导：县长裴怀瑾/);
  assert.match(page.data.dialog.content, /帮扶对象：科长周砚川/);
  // 落马之后不再有任何后续事项
  assert.equal(page.maybeBurstEvent(), false);
  delete global.Page;
  delete global.wx;
});

test('免广告卡以紧凑悬浮窗常驻主页，不因支付未开通而消失', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const page = bootPage();

  // 档案菜单里不该再有这个入口：售卖入口藏在二级菜单里没人找得到
  page.setData({ activeNav: 'records' });
  page.refresh();
  assert.ok(page.data.navActions.some(item => item.action === 'records'), '档案本身还在');
  // 关系网、人生排行榜的菜单入口已下线（2026-09-11）：
  // 人生排行榜只能在人生结局页看；老虎榜在主页「全网榜单」条上，不进档案菜单
  ['network', 'leaderboard', 'tigerboard'].forEach(action => {
    assert.ok(!page.data.navActions.some(item => item.action === action), `${action} 入口应已从档案菜单移除`);
  });
  assert.ok(!page.data.navActions.some(item => item.action === 'adCard'), '档案菜单里不该再挂免广告卡');

  // 商品入口常驻主页，未开通时也要能看见生成的道具图和状态说明
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxss'), 'utf8');
  assert.doesNotMatch(wxml, /<view wx:if="\{\{pay\.enabled\}\}" class="wallet-card/);
  assert.match(wxml, /class="wallet-float/);
  assert.match(wxml, /wx:else[^>]*>暂未开放/);
  assert.match(wxss, /\.wallet-float\s*\{[^}]*position:\s*fixed/);
  assert.match(wxss, /\.wallet-float\s*\{[^}]*bottom:\s*calc\(24rpx \+ env\(safe-area-inset-bottom\)\)/s);
  assert.match(wxss, /\.content-stack\s*\{[^}]*calc\(156rpx \+ env\(safe-area-inset-bottom\)\)/s);
  // 购买按钮用 catchtap：否则点按钮会冒泡到悬浮窗，把说明弹窗也一起打开。
  // 按钮直接进档位选择（buyAdCard 只负责下单，不负责选数量）。
  assert.match(wxml, /catchtap="chooseAdCardAmount"/);
  assert.doesNotMatch(wxml, /catchtap="buyAdCard"/);
  // 悬浮窗上不标单价：余额几条纹清楚就行，多少钱在档位选择里看
  assert.doesNotMatch(wxml, /class="wallet-float-price"/);
  assert.match(wxml, /bindtap="showAdCard"/);

  delete global.Page;
  delete global.wx;
});

test('five status metrics fit in one row without horizontal scrolling', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..', 'pages', 'index');
  const wxml = fs.readFileSync(path.join(root, 'index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'index.wxss'), 'utf8');
  assert.doesNotMatch(wxml, /class="metrics-scroll"[^>]*scroll-x/);
  assert.match(wxml, /<view class="metric-track">/);
  const track = wxss.match(/\.metric-track\s*\{[^}]*\}/s);
  const metric = wxss.match(/\.metric\s*\{[^}]*\}/s);
  assert.ok(track, 'metric-track');
  assert.ok(metric, 'metric');
  assert.match(track[0], /width:\s*100%/);
  assert.match(metric[0], /flex:\s*1\s+1\s+0/);
  assert.match(metric[0], /min-width:\s*0/);
  assert.doesNotMatch(metric[0], /min-width:\s*190rpx/);
});

test('annual expense forecast is visible in the financial overview', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const page = bootPage();
  page.setData({ 'nameSelect.visible': false, 'state.children': 1, 'state.hasHouse': true, 'state.hasCar': true });
  page.refresh();
  assert.equal(page.data.expenseText, '预计年度开销 4.8万（基础生活1.9万、子女抚养×12.5万、住房使用维护2250元、车辆使用维护1900元）');
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  assert.match(wxml, /class="overview-secondary">\{\{expenseText\}\}/);
  delete global.Page;
  delete global.wx;
});

test('archive menu exposes save slots, save history, and a gated read action', () => {
  const page = bootPage();
  page.setData({ activeNav: 'records' });
  page.refresh();
  assert.ok(page.data.navActions.some(item => item.action === 'save'));
  assert.ok(page.data.navActions.some(item => item.action === 'load'));
  assert.ok(page.data.navActions.some(item => item.action === 'localHistory'));
  const loadItem = page.data.navActions.find(item => item.action === 'load');
  assert.equal(loadItem.label, '读取存档');
  assert.doesNotMatch(loadItem.label, /看广告/);
  assert.equal(typeof page.load, 'function');
  page.save();
  assert.equal(page.data.dialog.mode, 'actions');
  assert.equal(page.data.dialog.items.length, 3);
  delete global.Page;
  delete global.wx;
});

test('证据提醒可进入固定的出逃判定，页面不提供广告重掷', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const page = bootPage();
  Object.assign(page.data.state, {
    year: 2038, age: 44, rankIndex: 8, currentPosition: '厅局级正职', money: 1286000,
    illicitIncome: 90000, riskTrail: 12, warningUsed: true,
    pendingEvidenceWarning: { year: 2038, risk: 72, stage: 'choice', seed: 0 },
  });
  page.refresh();
  assert.equal(page.maybeBurstEvent(), true);
  assert.equal(page.data.burst.flag, '证据提醒');
  assert.equal(page.data.burst.title, '证据风险提示');
  assert.match(page.data.burst.scene, /不构成现实法律判断/);
  const escapeIndex = page.data.burst.options.findIndex(option => option.action === 'escape');
  page.selectBurstOption({ currentTarget: { dataset: { index: escapeIndex } } });
  assert.equal(page.data.burst.visible, false);
  page.dialogConfirm();
  assert.equal(page.data.burst.visible, true);
  assert.equal(page.data.burst.flag, '结局判定');
  assert.deepEqual(page.data.burst.options.map(option => option.method).sort(), ['plane', 'ship', 'train']);
  assert.doesNotMatch(page.data.burst.scene, /航班|港口|车次|证件|路线/);
  assert.doesNotMatch(page.data.burst.scene, /判定结果已经由本局存档固定|广告、免广告卡|重复读取同一存档/);

  const planeIndex = page.data.burst.options.findIndex(option => option.method === 'plane');
  page.selectBurstOption({ currentTarget: { dataset: { index: planeIndex } } });
  assert.equal(page.data.state.ending, '出逃结局');
  assert.equal(page.data.state.escapeDetail.amount, 1286000);
  assert.equal(page.data.dialog.tone, 'warning');
  page.dialogConfirm();
  assert.equal(page.data.dialog.title, '人生落幕');
  assert.equal(page.data.dialog.tone, 'warning');
  assert.doesNotMatch(page.data.dialog.content, /进入出逃结局|公职生涯在此终止/);
  assert.equal(page.data.dialog.confirmText, '查看金蝉榜');
  assert.match(page.data.dialog.content, /虚构游戏结局/);
  assert.doesNotMatch(page.data.dialog.content, /恭喜|广告|免广告卡/);

  const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  assert.match(wxml, /bindtap="showEscapeBoard"/);
  assert.match(wxml, />金蝉榜</);
  assert.equal(typeof page.showEscapeBoard, 'function');
  page.showEscapeBoard();
  assert.equal(page.data.dialog.title, '金蝉榜 · 虚构结局记录');
  assert.doesNotMatch(page.data.dialog.rows.map(row => row.text || row.position || row.sub || '').join('\n'), /具体职事|工作\d+年|任职\d+年/);
  delete global.Page;
  delete global.wx;
});

test('读档必须完成激励广告或消耗免广告卡后才应用存档', () => {
  const page = bootPage();
  const core = require('../game/core');
  const storage = require('../services/storage');
  const local = new Map();
  global.wx = {
    getStorageSync: key => local.get(key),
    setStorageSync: (key, value) => local.set(key, JSON.parse(JSON.stringify(value))),
    removeStorageSync: key => local.delete(key),
    showToast: () => {},
  };
  const saved = core.newState();
  saved.name = '存档角色';
  saved.year = 2035;
  saved.age = 31;
  storage.saveSlot(1, saved);

  let cardOptions = null;
  let adOptions = null;
  page.cardBalance = () => 1;
  page.consumeAdCard = options => { cardOptions = options; };
  page.playRewardedVideo = options => { adOptions = options; };

  page.load();
  page.dialogSelect({ currentTarget: { dataset: { index: 0 } } });
  assert.deepEqual(page.data.dialog.items, ['消耗1张免广告卡读档', '看广告读档']);
  page.dialogSelect({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.state.year, 2026, '扣卡前不能提前读取存档');
  assert.equal(cardOptions.scene, 'load');
  assert.equal(adOptions, null, '明确选用免广告卡时不应拉起广告');
  cardOptions.reward();
  assert.equal(page.data.state.year, 2035, '扣卡成功后才读取存档');

  page.setData({ state: core.newState() });
  page.cardBalance = () => 1;
  cardOptions = null;
  adOptions = null;
  page.load();
  page.dialogSelect({ currentTarget: { dataset: { index: 0 } } });
  page.dialogSelect({ currentTarget: { dataset: { index: 1 } } });
  assert.equal(page.data.state.year, 2026, '广告完成前不能读取存档');
  assert.equal(cardOptions, null, '明确选择看广告时不应扣卡');
  assert.equal(adOptions.scene, 'load');
  adOptions.reward();
  assert.equal(page.data.state.year, 2035, '广告完成后才读取存档');
  page.showLocalHistory();
  assert.match(page.data.dialog.content, /保存存档1/);
  assert.doesNotMatch(page.data.dialog.content, /读取/);

  delete global.Page;
  delete global.wx;
});

test('支付已开通时点卡片能看到余额与售价，确认后先选档位再购买', () => {
  const page = bootPage();
  page.setData({
    pay: {
      enabled: true, buying: false, balance: 7, name: '免广告卡', cardsPerUnit: 10,
      priceYuan: 1, priceText: '￥1 / 10 张', buyLabel: '购买',
    },
  });
  const bought = [];
  const originalBuy = page.buyAdCard;
  page.buyAdCard = cards => { bought.push(cards); };
  try {
    page.showAdCard();
    assert.equal(page.data.dialog.visible, true);
    assert.match(page.data.dialog.content, /当前余额：7 张/);
    assert.match(page.data.dialog.content, /￥1 \/ 10 张/);
    // 平台分成、累计上限是给开发者看的规则，不该原样甩给用户
    assert.doesNotMatch(page.data.dialog.content, /个人主体/);
    assert.doesNotMatch(page.data.dialog.content, /技术服务费/);
    assert.doesNotMatch(page.data.dialog.content, /12%/);
    // 用户需要知道的是这两件事：不退、没到账别重复买
    assert.match(page.data.dialog.content, /售出后不退/);
    assert.match(page.data.dialog.content, /别重复购买/);
    assert.equal(page.data.dialog.confirmText, '购买');
    // 先看说明再决定，取消不该产生任何购买动作
    page.closeDialog();
    assert.deepEqual(bought, []);
    page.showAdCard();
    page.dialogConfirm();
    // 确认后进入档位选择：3 个预设 + 自定义
    assert.equal(page.data.dialog.mode, 'actions');
    assert.equal(page.data.dialog.items.length, 4);
    assert.match(page.data.dialog.items[0], /10 张 · ￥1$/);
    assert.match(page.data.dialog.items[1], /60 张 · ￥6$/);
    assert.match(page.data.dialog.items[2], /300 张 · ￥30$/);
    assert.match(page.data.dialog.items[3], /自定义/);
    // 点第一档：10 张 / 每份 10 张 = 1 份
    page.dialogSelect({ currentTarget: { dataset: { index: 0 } } });
    assert.deepEqual(bought, [10]);
  } finally {
    page.buyAdCard = originalBuy;
    delete global.Page;
    delete global.wx;
  }
});

test('自定义购买数量走输入框，张数换算成份数传给下单', () => {
  const page = bootPage();
  page.setData({
    pay: {
      enabled: true, buying: false, balance: 0, name: '免广告卡', cardsPerUnit: 1,
      priceYuan: 0.1, priceText: '￥0.10 / 1 张', buyLabel: '购买',
    },
  });
  const bought = [];
  const originalBuy = page.buyAdCard;
  page.buyAdCard = cards => { bought.push(cards); };
  try {
    page.showAdCard();
    page.dialogConfirm();
    page.dialogSelect({ currentTarget: { dataset: { index: 3 } } }); // 自定义数量
    assert.equal(page.data.dialog.mode, 'amount');
    assert.equal(page.data.dialog.inputLabel, '购买数量');
    assert.equal(page.data.dialog.inputUnit, '张');
    // 输入框不预填数字：默认值容易被顺手点成下单，买多少由玩家自己填
    assert.equal(page.data.dialog.inputValue, '');
    assert.ok(page.data.dialog.inputPlaceholder, '应有占位提示');
    // 没填就点购买：不产生订单
    page.dialogConfirm();
    assert.deepEqual(bought, []);
    // 填 88 张（每份 1 张）→ 买 88 张
    page.showAdCard();
    page.dialogConfirm();
    page.dialogSelect({ currentTarget: { dataset: { index: 3 } } });
    page.setData({ 'dialog.inputValue': '88' });
    page.dialogConfirm();
    assert.deepEqual(bought, [88]);
  } finally {
    page.buyAdCard = originalBuy;
    delete global.Page;
    delete global.wx;
  }
});

test('virtual payment item uses the generated project-local icon', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  // 2026-09-12 从 WebP 换成 PNG：个别真机不渲染 WebP（开发者工具正常、真机空白），
  // PNG 全平台通吃，34KB 也在预算内。谁改回 WebP 这条测试会拦住。
  const asset = path.join(root, 'assets', 'ad-free-card.png');
  const wxml = fs.readFileSync(path.join(root, 'pages', 'index', 'index.wxml'), 'utf8');
  assert.equal(fs.existsSync(asset), true);
  assert.ok(fs.statSync(asset).size <= 200 * 1024, '商品图标不能超过200KB');
  assert.match(wxml, /src="\/assets\/ad-free-card\.png"/);
  assert.match(wxml, /class="wallet-float-icon"/);
  assert.doesNotMatch(wxml, /ad-free-card\.webp/, '不能再引用已删除的 WebP');
  assert.match(wxml, /binderror="onAdCardIconError"/, '图片加载失败要退回文字徽章');
});

test('落马结局：逐笔列出不当收入，并把它折算成的风险写在旁边', () => {
  const page = bootPage();
  Object.assign(page.data.state, {
    year: 2033, age: 49, rankIndex: 8, currentPosition: '县委办副主任', money: 900000,
    pendingInterrogation: { year: 2033, risk: 64 },
    illicitIncome: 620000,
    illicitLedger: [
      { year: 2028, title: '一只信封', choice: '收下，觉得就是个意思', amount: 20000 },
      { year: 2031, title: '一套房', choice: '收下这份"优惠"', amount: 600000 },
    ],
    evidence: [{ year: 2031, title: '一套房', choice: '收下这份"优惠"', risk: 3 }],
  });
  page.refresh();
  assert.equal(page.maybeBurstEvent(), true);
  const silentIndex = page.data.burst.options.findIndex(option => /保持沉默/.test(option.text));
  page.selectBurstOption({ currentTarget: { dataset: { index: silentIndex } } });
  page.dialogConfirm();

  const content = page.data.dialog.content;
  assert.match(content, /累计不当收入：62\.0万/);
  assert.match(content, /超过3万元的部分按每万元0\.5点折算/);
  assert.match(content, /每一笔都记在这里/);
  // 逐笔：年份、事件、当时选了什么、金额
  assert.match(content, /2028年　一只信封　选了「收下，觉得就是个意思」　2\.0万/);
  assert.match(content, /2031年　一套房　选了「收下这份"优惠"」　60\.0万/);
});

test('落马结局：没有现金往来时明说，不编一条', () => {
  const page = bootPage();
  Object.assign(page.data.state, {
    year: 2033, age: 49, rankIndex: 8, money: 300000,
    pendingInterrogation: { year: 2033, risk: 64 },
    illicitIncome: 0, illicitLedger: [],
    evidence: [{ year: 2031, title: '一份签字', choice: '照签，不追问', risk: 4 }],
  });
  page.refresh();
  assert.equal(page.maybeBurstEvent(), true);
  const silentIndex = page.data.burst.options.findIndex(option => /保持沉默/.test(option.text));
  page.selectBurstOption({ currentTarget: { dataset: { index: silentIndex } } });
  page.dialogConfirm();
  assert.match(page.data.dialog.content, /没有查到现金往来/);
  assert.doesNotMatch(page.data.dialog.content, /每一笔都记在这里/);
});

test('成长档案：累计不当收入与落马风险并排显示', () => {
  const page = bootPage();
  page.data.state.illicitIncome = 150000;
  page.data.state.illicitLedger = [{ year: 2030, title: '一只信封', choice: '收下', amount: 150000 }];
  page.refresh();
  page.showStats();
  assert.match(page.data.dialog.content, /累计不当收入：15\.0万/);
  assert.match(page.data.dialog.content, /落马风险 \+/);

  const clean = bootPage();
  clean.refresh();
  clean.showStats();
  assert.match(clean.data.dialog.content, /累计不当收入：无/);
});
