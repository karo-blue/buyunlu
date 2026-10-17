(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuyunluOffline = factory();
})(typeof window === 'object' ? window : globalThis, function() {
  'use strict';
  const PENDING_KEY = 'buyunlu_mobile_pending_v1';
  const CARD_BALANCE_KEY = 'buyunlu_mobile_cards_v1';
  const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
  function visibleText(text) {
    return typeof text !== 'string' ? text : text.replace(/确认金额后请转发给好友，完成本次请求。/g, '确认金额后直接处理。本手机版不需要微信转发。')
      .replace(/广告累计加成/g, '免费累计加成').replace(/广告不加成/g, '免费奖励不加成')
      .replace(/全网排行榜/g, '本机排行榜').replace(/全网榜单/g, '本机榜单')
      .replace(/公开的落马记录/g, '本机的落马结局记录').replace(/公开的出逃结局记录/g, '本机的出逃结局记录');
  }
  function install(page, dependencies) {
    const { core, storage, host } = dependencies;
    page.data.dialog.rows = page.data.dialog.rows || [];
    page._mobileSavePending = function() {
      try {
        host.wx.setStorageSync(PENDING_KEY, {
          name: this.data.state.name, year: this.data.state.year, quarter: this.data.state.quarter,
          currentEvent: clone(this.data.currentEvent), burst: clone(this.data.burst),
          burstEvent: clone(this._burstEvent), burstKind: this._burstKind || 'normal', burstReview: !!this._burstReview,
        });
      } catch (error) { host.wx.showToast({ title: '本机存储空间不足，待处理事项未能保存' }); }
    };
    const originalLoad = page.onLoad;
    page.onLoad = function() {
      originalLoad.call(this);
      try {
        const pending = host.wx.getStorageSync(PENDING_KEY);
        const state = this.data.state;
        if (pending && pending.name === state.name && pending.year === state.year && pending.quarter === state.quarter) {
          this._burstEvent = pending.burstEvent;
          this._burstKind = pending.burstKind;
          this._burstReview = pending.burstReview;
          const burst = pending.burst || this.data.burst;
          if (pending.burstEvent) burst.visible = true;
          this.setData({ currentEvent: pending.currentEvent || null, burst });
        }
      } catch (error) { /* A corrupt pending view does not prevent loading the main save. */ }
    };
    const originalUnload = page.onUnload;
    page.onHide = function() { if (!storage.save(this.data.state)) host.wx.showToast({ title: '保存失败，请检查本机存储空间' }); this._mobileSavePending(); };
    page.onUnload = function() { this.onHide(); if (originalUnload) originalUnload.call(this); };
    const originalPersist = page.persist;
    page.persist = function(extra) { originalPersist.call(this, extra); this._mobileSavePending(); };
    for (const method of ['startFreshGame', 'applyLoadedSlot']) {
      const original = page[method];
      page[method] = function(...args) {
        host.wx.removeStorageSync(PENDING_KEY);
        if (method === 'startFreshGame') {
          this._burstEvent = null; this._burstKind = 'normal'; this._burstReview = false;
          this.setData({ currentEvent: null, 'burst.visible': false, 'dialog.visible': false });
        }
        return original.apply(this, args);
      };
    }
    const originalPatch = page.buildPatch;
    page.buildPatch = function(...args) {
      const patch = originalPatch.apply(this, args);
      const state = patch.state;
      const count = state.promotionAdWatchCount;
      patch.adText = `本局免费晋升加成：已领取${count}次，累计 +${count * 3}个百分点；跨年、晋升保留，重新开局清零，最终概率最高100%。离线版无广告、无付费。`;
      patch.lastResult = visibleText(patch.lastResult);
      patch.honor.requirement = visibleText(patch.honor.requirement);
      return patch;
    };
    const originalModal = page.showModal;
    const originalSheet = page.showActionSheet;
    for (const [method, original] of [['showModal', originalModal], ['showActionSheet', originalSheet]]) {
      page[method] = function(options, extra) {
        const next = { ...options, title: visibleText(options.title), content: visibleText(options.content) };
        if (next.rows) next.rows = next.rows.map(row => ({ ...row, text: visibleText(row.text) }));
        if (next.itemList) next.itemList = next.itemList.map(item => item === '看广告，晋升概率+3%' ? '免费领取晋升概率+3%' : item);
        return original.call(this, next, extra);
      };
    }
    page.cardBalance = function() {
      try {
        const value = Number(host.wx.getStorageSync(CARD_BALANCE_KEY));
        return Number.isSafeInteger(value) && value > 0 ? value : 0;
      } catch (error) { return 0; }
    };
    page.refreshPay = function() {
      this.setPay({ enabled: true, buying: false, name: '免广告卡', balance: this.cardBalance(), cardsPerUnit: 10, priceYuan: 0, reason: '' });
      this.setData({ 'pay.priceText': '免费', 'pay.buyLabel': '免费购买' });
    };
    page.refreshPayBalance = function() { this.refreshPay(); return Promise.resolve({ ok: true, balance: this.cardBalance() }); };
    page.showAdCard = function() { this.chooseAdCardAmount(); };
    page.chooseAdCardAmount = function() {
      const amounts = [10, 60, 300];
      this.showActionSheet({ title: '免费购买免广告卡', content: `当前余额 ${this.cardBalance()} 张。无需付款，不扣游戏现金；卡片只保存在本机。`, itemList: [...amounts.map(cards => `${cards} 张 · 免费`), '自定义数量 · 免费'], cancelText: '返回', success: ({ tapIndex }) => {
        if (tapIndex === amounts.length) return this.showCustomAdCardAmount();
        if (amounts[tapIndex]) this.buyAdCard(amounts[tapIndex]);
      } });
    };
    page.showCustomAdCardAmount = function() {
      this.showModal({ mode: 'amount', title: '免费购买免广告卡', content: '输入 1～10000 的整数，确认后免费到账。', inputLabel: '购买数量', inputUnit: '张', inputValue: '', inputPlaceholder: '输入要买的数量', confirmText: '免费购买', cancelText: '返回', success: result => { if (result.confirm) this.buyAdCard(result.value); } });
    };
    page.buyAdCard = function(rawCards) {
      if (this._payBusy) return;
      const cards = Number(rawCards); const balance = this.cardBalance();
      if (!Number.isSafeInteger(cards) || cards < 1 || cards > 10000 || !Number.isSafeInteger(balance + cards)) return host.wx.showToast({ title: '请输入 1～10000 的整数数量' });
      try {
        host.wx.setStorageSync(CARD_BALANCE_KEY, balance + cards);
        this.refreshPay();
        this.showModal({ title: '免费购买成功', content: `已免费到账 ${cards} 张免广告卡，当前余额 ${balance + cards} 张。未产生任何付款。`, showCancel: false });
      } catch (error) {
        this.showModal({ title: '卡片未到账', content: '本机存储不可用，请检查存储空间后重试。', showCancel: false });
      }
    };
    page.consumeAdCard = function(options = {}) {
      if (this._payBusy || typeof options.reward !== 'function') return;
      if (options.scene === 'promotion' && (this.data.state.ended || this.data.state.rankIndex >= core.RANKS.length)) return host.wx.showToast({ title: '当前无需晋升加成，未扣除卡片' });
      const balance = this.cardBalance();
      if (!balance) return this.playRewardedVideo(options);
      this._payBusy = true;
      let deducted = false;
      try {
        host.wx.setStorageSync(CARD_BALANCE_KEY, balance - 1);
        deducted = true;
        this.refreshPay();
        host.wx.showToast({ title: '已使用 1 张免广告卡' });
        return options.reward();
      } catch (error) {
        if (deducted) {
          try { host.wx.setStorageSync(CARD_BALANCE_KEY, balance); this.refreshPay(); } catch (restoreError) { /* Report failure without retrying the reward. */ }
        }
        host.wx.showToast({ title: '操作未完成，请检查本机存储后重试' });
      } finally { this._payBusy = false; }
    };
    const originalUseLoadCard = page.useLoadAdCard;
    page.useLoadAdCard = function(slot) {
      if (!storage.loadSlot(slot)) return host.wx.showToast({ title: '存档为空或损坏，未扣除卡片' });
      return originalUseLoadCard.call(this, slot);
    };
    page.playRewardedVideo = function(options) {
      this.showModal({ title: '领取免费加成', content: '离线手机版不播放广告，也不收取费用。确认后领取本次免费奖励。', confirmText: '免费领取', cancelText: '取消', success: result => { if (result.confirm && typeof options.reward === 'function') options.reward(); } });
    };
    page.load = function() {
      const slots = storage.slotList();
      this.showActionSheet({ title: '免费读取本机存档', content: '请选择存档。离线版读档免费，读取将替换当前游戏进度。', itemList: slots.map(slot => slot.empty ? `存档${slot.slot} · 空` : `存档${slot.slot} · ${slot.name} · ${slot.year}年 · ${slot.rank}`), cancelText: '返回', success: result => {
        const slot = slots[result.tapIndex];
        if (!slot || slot.empty) return host.wx.showToast({ title: '该存档为空' });
        this.showModal({ title: `读取存档${slot.slot}`, content: `将读取${slot.name}在${slot.year}年的进度，并替换当前进度。`, confirmText: '免费读取', cancelText: '取消', success: answer => { if (answer.confirm) this.applyLoadedSlot(slot.slot); } });
      } });
    };
    page.shareFaultHelp = function() {
      const amount = Math.floor(Number(this.data.dialog.inputValue));
      const blocked = this.faultHelpBlocked(amount);
      if (blocked) return this.openFaultHelpDialog(blocked);
      this._sharePayload = null; this._dialogOptions = null;
      this.setData({ 'dialog.visible': false });
      this.grantFaultHelp(amount);
    };
    page.selectNav = (function(original) { return function(event) {
      if (!this.data.state.name) { this.openNameSelect(); return; }
      original.call(this, event);
      if (this.data.activeNav === 'main') this.setData({ 'dialog.content': '处理晋升、监督核查和年度考核相关事项。离线版可免费领取晋升加成。' });
    }; })(page.selectNav);
    page.startQuarter = (function(original) { return function() {
      if (!this.data.state.name) return this.openNameSelect();
      if (this._burstEvent) return this.setData({ 'burst.visible': true });
      if (this.data.state.pendingEvidenceWarning || this.data.state.pendingInterrogation) return this.maybeBurstEvent();
      if (this.data.currentEvent) return host.wx.showToast({ title: '请先处理当前季度事项' });
      return original.call(this);
    }; })(page.startQuarter);
    return page;
  }

  function handleBack(page) {
    if (page.data.burst.visible) { page.setData({ 'burst.visible': false }); page.onHide(); return true; }
    if (page.data.nameSelect.visible) { page.setData({ 'nameSelect.visible': false }); return true; }
    if (page.data.dialog.visible) { page.closeDialog(); return true; }
    if (page.data.currentEvent) { page.cancelEvent(); page.onHide(); return true; }
    return false;
  }
  return { install, handleBack, PENDING_KEY, CARD_BALANCE_KEY };
});
