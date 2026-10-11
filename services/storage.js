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

function slotList() {
  const slots = readSlots();
  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const item = slots[slot];
    if (!item || !item.state) return { slot, empty: true };
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
    if (!item || !item.state) return null;
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
