'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseWxml, convertCss, build } = require('../build');
const runtime = require('../runtime');

class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.childNodes = []; this.attributes = {}; this.dataset = {}; this.listeners = {}; this.scrollTop = 0; this.scrollLeft = 0; }
  appendChild(child) { child.parentNode = this; this.childNodes.push(child); return child; }
  replaceChild(next, previous) { const i = this.childNodes.indexOf(previous); previous.parentNode = null; next.parentNode = this; this.childNodes[i] = next; }
  removeChild(child) { this.childNodes.splice(this.childNodes.indexOf(child), 1); child.parentNode = null; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  focus() { this.ownerDocument.activeElement = this; }
  dispatch(name, detail = {}) { this.listeners[name]?.({ currentTarget: this, target: this, stopPropagation() {}, preventDefault() {}, ...detail }); }
}
class TextNode { constructor(text) { this.nodeType = 3; this.nodeValue = text; } }
function dom() {
  const doc = { activeElement: null, createElement(tag) { return new Element(tag, doc); }, createTextNode(text) { return new TextNode(text); } };
  const root = doc.createElement('main');
  return { doc, root };
}
function nodes(root, predicate) { return (root.childNodes || []).flatMap(node => [ ...(predicate(node) ? [node] : []), ...nodes(node, predicate) ]); }
function content(root) { return root.childNodes.map(node => node.nodeType === 3 ? node.nodeValue : content(node)).join(''); }

test('WXML compiler handles quoted >, entities, self-closing tags, and nested loop attributes', () => {
  const ast = parseWxml('<view wx:if="{{count > 0}}"><input value="{{count}}" /><text>甲 &amp; 乙</text></view>');
  assert.equal(ast[0].attrs['wx:if'], '{{count > 0}}');
  assert.equal(ast[0].children[0].tag, 'input');
  assert.equal(ast[0].children[1].children[0].text, '甲 & 乙');
  assert.throws(() => parseWxml('<view><text></view>'), /mismatch/i);
});

test('if/elif/else picks exactly one branch and nested loops preserve their own names', () => {
  const { doc, root } = dom();
  const ast = parseWxml('<view><text wx:if="{{flag === 1}}">A</text><text wx:elif="{{flag === 2}}">B</text><text wx:else>C</text><block wx:for="{{groups}}" wx:for-item="group"><block wx:for="{{group.names}}" wx:for-item="name"><button data-name="{{name}}" bindtap="choose">{{group.title}}:{{name}};</button></block></block></view>');
  let selected;
  const page = { data: { flag: 2, groups: [{ title: '一', names: ['甲', '乙'] }, { title: '二', names: ['丙'] }] }, choose(event) { selected = event.currentTarget.dataset.name; } };
  runtime.attachPage(page, { document: doc, root, template: ast });
  assert.equal(content(root), 'B一:甲;一:乙;二:丙;');
  nodes(root, x => x.tagName === 'BUTTON')[2].dispatch('click');
  assert.equal(selected, '丙');
  page.setData({ flag: 3 });
  assert.equal(content(root), 'C一:甲;一:乙;二:丙;');
});

test('setData updates dotted paths without replacing focused inputs or scrollers', () => {
  const { doc, root } = dom();
  const ast = parseWxml('<scroll-view scroll-y><input value="{{dialog.value}}" bindinput="input" /><text>{{dialog.value}}</text></scroll-view>');
  let callbacks = 0;
  const page = { data: { dialog: { value: '' } }, input(event) { this.setData({ 'dialog.value': event.detail.value }); } };
  runtime.attachPage(page, { document: doc, root, template: ast });
  const input = nodes(root, x => x.tagName === 'INPUT')[0];
  const scroll = root.childNodes[0];
  scroll.scrollTop = 123;
  input.focus(); input.value = '12345'; input.dispatch('input');
  page.setData({ 'dialog.value': '123456' }, () => { callbacks += 1; });
  assert.equal(page.data.dialog.value, '123456');
  assert.equal(nodes(root, x => x.tagName === 'INPUT')[0], input);
  assert.equal(doc.activeElement, input);
  assert.equal(scroll.scrollTop, 123);
  assert.equal(callbacks, 1);
});

test('picker emits a string index and catchtap stops bubbling', () => {
  const { doc, root } = dom();
  const ast = parseWxml('<picker range="{{names}}" value="{{index}}" bindchange="pick"><view>姓</view></picker><button catchtap="choose" data-index="4">选</button>');
  let chosen; let stopped = false;
  const page = { data: { names: ['张', '王'], index: 0 }, pick(event) { chosen = event.detail.value; }, choose(event) { chosen = event.currentTarget.dataset.index; } };
  runtime.attachPage(page, { document: doc, root, template: ast });
  const select = nodes(root, x => x.tagName === 'SELECT')[0];
  select.value = '1'; select.dispatch('change');
  assert.equal(chosen, '1');
  nodes(root, x => x.tagName === 'BUTTON')[0].dispatch('click', { stopPropagation() { stopped = true; } });
  assert.equal(chosen, '4'); assert.equal(stopped, true);
});

test('rpx scales to viewport with a capped width, including negative values in calc', () => {
  const result = convertCss('view { width: 750rpx; padding: 24rpx; margin: -16rpx; letter-spacing: .3rpx; bottom: calc(156rpx + env(safe-area-inset-bottom)); }');
  assert.ok(!/\d+rpx/.test(result));
  assert.match(result, /750 \* var\(--rpx\)/);
  assert.match(result, /-16 \* var\(--rpx\)/);
  assert.match(result, /calc\(\.3 \* var\(--rpx\)\)/);
  assert.ok(!result.includes('.calc'));
});

test('bundle boots actual game offline, opens naming, saves/restores and grants explicit free reward', () => {
  const result = build();
  const { doc, root } = dom();
  const saved = new Map();
  const events = {};
  const ctx = { console, document: doc, navigator: {}, localStorage: { getItem(key) { return saved.get(key) || null; }, setItem(key, value) { saved.set(key, value); }, removeItem(key) { saved.delete(key); } }, setTimeout(fn) { fn(); return 1; }, clearTimeout() {}, addEventListener(name, fn) { events[name] = fn; } };
  doc.getElementById = id => id === 'app' ? root : null;
  doc.addEventListener = (name, fn) => { events[name] = fn; };
  doc.querySelectorAll = () => [];
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(result.output, 'runtime.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(result.output, 'offline.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(result.output, 'game.js'), 'utf8'), ctx);
  const page = ctx.buyunluPage;
  assert.equal(page.data.nameSelect.visible, true);
  const name = page.data.nameSelect.groups[0].names[0];
  page.selectPresetName({ currentTarget: { dataset: { name } } }); page.confirmName();
  assert.equal(page.data.state.name, name);
  assert.equal(ctx.buyunluHandleBack(), false);
  page.showPromotionPath();
  assert.ok(page.data.dialog.items.some(item => item.includes('免费')));
  assert.ok(!page.data.dialog.items.some(item => /广告|购买/.test(item)));
  assert.match(page.data.dialog.content, /资历、考核、口碑、人脉与廉政/);
  assert.equal(page.data.dialog.items[0], '查看晋升条件');
  page.data.state.rankIndex = 10; page.refresh(); page.showPromotionPath();
  assert.match(page.data.dialog.content, /过失≤0/);
  assert.ok(!page.data.dialog.content.includes('过失≤99'));
  page.data.state.rankIndex = 1; page.refresh(); page.showPromotionPath();
  page.dialogSelect({ currentTarget: { dataset: { index: '1' } } });
  assert.match(page.data.dialog.content, /免费/);
  page.dialogConfirm();
  assert.equal(page.data.state.promotionAdWatchCount, 1);
  page.startQuarter();
  const title = page.data.currentEvent.title;
  events.pagehide();
  assert.ok(saved.has('buyunlu_save_v1'));
  assert.ok(saved.has('buyunlu_mobile_pending_v1'));
  vm.runInContext(fs.readFileSync(path.join(result.output, 'game.js'), 'utf8'), ctx);
  assert.equal(ctx.buyunluPage.data.currentEvent.title, title);
  assert.equal(typeof ctx.wx.request, 'undefined');
  assert.equal(typeof ctx.wx.createRewardedVideoAd, 'undefined');
  assert.equal(typeof ctx.wx.requestVirtualPayment, 'undefined');
  assert.ok(fs.readFileSync(path.join(result.output, 'template.json'), 'utf8').includes('wallet-float'));
  const restored = ctx.buyunluPage;
  restored.selectEventOption({ currentTarget: { dataset: { index: '0' } } });
  restored.dialogConfirm();
  for (let i = 0; i < 3; i += 1) {
    restored.startQuarter();
    assert.ok(restored.data.currentEvent, 'quarter has selectable event');
    restored.selectEventOption({ currentTarget: { dataset: { index: '0' } } });
    restored.dialogConfirm();
  }
  assert.equal(restored.data.state.year, 2027);
  assert.equal(restored.data.state.quarter, 1);
  restored.save();
  restored.dialogSelect({ currentTarget: { dataset: { index: '0' } } });
  const savedMoney = restored.data.state.money;
  restored.data.state.money = 1; restored.persist();
  restored.load();
  assert.match(restored.data.dialog.title, /免费/);
  restored.dialogSelect({ currentTarget: { dataset: { index: '0' } } });
  restored.dialogConfirm();
  assert.equal(restored.data.state.money, savedMoney);
  restored.openFaultHelpDialog();
  assert.ok(!/请转发给好友|购买|广告/.test(restored.data.dialog.content));
  restored.dialogAmountInput({ detail: { value: '1a000' } });
  assert.equal(restored.data.dialog.inputValue, '1000');
  const input = nodes(root, x => x.tagName === 'INPUT')[0];
  assert.equal(input.value, '1000');
  const beforeMoney = restored.data.state.money;
  restored.shareFaultHelp();
  assert.equal(restored._sharePayload, null);
  assert.equal(restored.data.state.faultHelpUsedYear, restored.data.state.year);
  assert.equal(restored.data.state.money, beforeMoney - 1000);
  if (restored.data.dialog.visible) restored.closeDialog();
  restored._burstEvent = { title: '必选事项', options: [{ text: '待选择' }] };
  restored.setData({ burst: { visible: true, review: false, flag: '突发', tag: '事项', title: '必选事项', scene: '测试', tip: '待处理', options: [{ text: '待选择' }] } });
  const quarter = restored.data.state.quarter;
  assert.equal(ctx.buyunluHandleBack(), true);
  assert.equal(restored.data.burst.visible, false);
  restored.startQuarter();
  assert.equal(restored.data.burst.visible, true);
  assert.equal(restored.data.state.quarter, quarter, 'back never advances or silently skips mandatory burst');
  restored.startFreshGame();
  assert.equal(restored._burstEvent, null);
  assert.equal(restored.data.burst.visible, false);
  assert.equal(restored.data.currentEvent, null);
  assert.equal(restored.data.nameSelect.visible, true);
});

function cardApp(saved = new Map(), options = {}) {
  const result = build();
  const { doc, root } = dom();
  let blocked = false;
  const ctx = { console, document: doc, localStorage: {
    getItem(key) { return saved.get(key) || null; },
    setItem(key, value) { if (blocked && key === 'buyunlu_mobile_cards_v1') throw new Error('storage full'); saved.set(key, value); },
    removeItem(key) { saved.delete(key); },
  }, setTimeout(fn) { fn(); return 1; }, clearTimeout() {}, addEventListener() {}, fetch() { throw new Error('A free card must never make a network request'); } };
  doc.getElementById = id => id === 'app' ? root : null;
  doc.addEventListener = () => {};
  doc.querySelectorAll = () => [];
  ctx.window = ctx;
  vm.createContext(ctx);
  if (options.legacyStrings) vm.runInContext('String.prototype.replaceAll = undefined', ctx);
  for (const file of ['runtime.js', 'offline.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(result.output, file), 'utf8'), ctx);
  return { page: ctx.buyunluPage, ctx, root, saved, blockWrites(value) { blocked = value; } };
}

test('ad-card entry buys presets and custom cards free, without payment, game cash or duplicate confirmations', () => {
  const app = cardApp();
  const page = app.page;
  const name = page.data.nameSelect.groups[0].names[0];
  page.selectPresetName({ currentTarget: { dataset: { name } } }); page.confirmName();
  assert.equal(page.data.pay.enabled, true);
  assert.equal(page.data.pay.buyLabel, '免费购买');
  assert.equal(page.cardBalance(), 0);
  const entry = nodes(app.root, node => node.attributes?.class?.split(' ').includes('wallet-float'))[0];
  assert.ok(entry, 'card is rendered');
  const beforeCash = page.data.state.money;
  entry.dispatch('click');
  assert.match(page.data.dialog.title, /免费/);
  assert.equal(page.data.dialog.items.length, 4);
  for (const [index, balance] of [[0, 10], [1, 70], [2, 370]]) {
    if (index) page.chooseAdCardAmount();
    page.dialogSelect({ currentTarget: { dataset: { index } } });
    assert.equal(page.cardBalance(), balance);
    assert.equal(page.data.pay.balance, balance);
    assert.match(page.data.dialog.title, /免费购买成功/);
    page.dialogConfirm(); page.dialogConfirm();
    assert.equal(page.cardBalance(), balance);
  }
  page.showCustomAdCardAmount();
  page.dialogAmountInput({ detail: { value: '37' } });
  page.dialogConfirm(); page.dialogConfirm();
  assert.equal(page.cardBalance(), 407);
  page.showCustomAdCardAmount(); page.dialogAmountInput({ detail: { value: '100' } }); page.closeDialog();
  assert.equal(page.cardBalance(), 407, 'cancel never buys');
  page.chooseAdCardAmount(); page.closeDialog();
  for (const invalid of [0, -1, 1.5, NaN, Infinity, 10001, Number.MAX_SAFE_INTEGER]) page.buyAdCard(invalid);
  assert.equal(page.cardBalance(), 407);
  assert.equal(page.data.state.money, beforeCash, 'real/free purchase never debits game cash');
  assert.equal(typeof app.ctx.wx.requestVirtualPayment, 'undefined');
  assert.equal(typeof app.ctx.wx.request, 'undefined');
  const reloaded = cardApp(app.saved).page;
  assert.equal(reloaded.cardBalance(), 407, 'wallet survives application restart');
  reloaded.save(); reloaded.dialogSelect({ currentTarget: { dataset: { index: 0 } } });
  reloaded.buyAdCard(10); reloaded.dialogConfirm();
  reloaded.applyLoadedSlot(1);
  assert.equal(reloaded.cardBalance(), 417, 'loading an old game slot cannot restore old card count');
  reloaded.startFreshGame();
  assert.equal(reloaded.cardBalance(), 417, 'new game does not reset the separate wallet');
  assert.ok(fs.existsSync(path.join(__dirname, '../../docs/assets/ad-free-card.png')));
  const ast = fs.readFileSync(path.join(__dirname, '../../docs/template.json'), 'utf8');
  assert.ok(ast.includes('assets/ad-free-card.png') && !ast.includes('"src":"/assets/'));
});

test('one local card gives one reward, and failed storage or blocked rewards never debit cards', () => {
  const app = cardApp(); const page = app.page;
  page.buyAdCard(10); page.dialogConfirm();
  page.showPromotionPath();
  const index = page.data.dialog.items.findIndex(item => item.startsWith('用免广告卡'));
  assert.ok(index >= 0, 'existing use-card action is restored');
  page.dialogSelect({ currentTarget: { dataset: { index } } }); page.dialogConfirm();
  assert.equal(page.cardBalance(), 9);
  assert.equal(page.data.state.promotionAdWatchCount, 1);
  page.data.state.ended = true;
  const endedState = JSON.stringify(page.data.state);
  page.usePromotionAdCard();
  assert.equal(page.cardBalance(), 9);
  assert.equal(JSON.stringify(page.data.state), endedState, 'ended careers cannot receive or persist another reward');
  page.data.state.ended = false;
  page.data.state.rankIndex = 11;
  const maximumRankState = JSON.stringify(page.data.state);
  page.usePromotionAdCard();
  assert.equal(page.cardBalance(), 9);
  assert.equal(JSON.stringify(page.data.state), maximumRankState, 'highest rank cannot receive another promotion reward');
  page.data.state.rankIndex = 1;
  app.blockWrites(true);
  page.buyAdCard(60);
  assert.equal(page.cardBalance(), 9);
  assert.doesNotMatch(page.data.dialog.title, /购买成功/);
  let rewarded = 0;
  page.consumeAdCard({ reward() { rewarded++; } });
  assert.equal(rewarded, 0); assert.equal(page.cardBalance(), 9);
  assert.equal(page._payBusy, false);
  app.blockWrites(false);
  page.consumeAdCard({ reward() { throw new Error('reward failed'); } });
  assert.equal(page.cardBalance(), 9, 'throwing reward is rolled back and never retried');
  page.useLoadAdCard(3);
  assert.equal(page.cardBalance(), 9, 'unreadable slot cannot consume cards');
  app.saved.set('buyunlu_mobile_cards_v1', '0'); page.refreshPay();
  page.consumeAdCard({ reward() { rewarded++; } });
  assert.match(page.data.dialog.title, /免费加成/);
  page.closeDialog();
  assert.equal(rewarded, 0);
  app.saved.set('buyunlu_mobile_cards_v1', '"corrupt"');
  assert.equal(page.cardBalance(), 0);
});

test('web game boots and plays without newer String.replaceAll support', () => {
  const app = cardApp(new Map(), { legacyStrings: true });
  const page = app.page;
  assert.equal(page.data.nameSelect.visible, true);
  const name = page.data.nameSelect.groups[0].names[0];
  page.selectPresetName({ currentTarget: { dataset: { name } } });
  page.confirmName();
  assert.equal(page.data.state.name, name);
  page.showPromotionPath();
  assert.ok(page.data.dialog.items.some(item => item.includes('免费')));
  page.closeDialog();
  page.buyAdCard(10);
  assert.equal(page.cardBalance(), 10);
  assert.match(page.data.dialog.title, /免费购买成功/);
  page.closeDialog();
  page.startQuarter();
  assert.ok(page.data.currentEvent.title);
  page.onHide();
  assert.ok(app.saved.has('buyunlu_save_v1'));
});
