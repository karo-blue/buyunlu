const test = require('node:test');
const assert = require('node:assert/strict');

function loadStorageApi() {
  const modulePath = require.resolve('../services/storage');
  delete require.cache[modulePath];
  return require(modulePath);
}

test('manual save slots and their history stay entirely in local WeChat storage', () => {
  const local = new Map();
  global.wx = {
    getStorageSync: key => local.get(key),
    setStorageSync: (key, value) => local.set(key, JSON.parse(JSON.stringify(value))),
    removeStorageSync: key => local.delete(key),
  };
  const storage = loadStorageApi();
  const state = require('../game/core').newState();
  state.name = '高植物';
  state.year = 2030;
  state.rankIndex = 4;

  assert.equal(storage.saveSlot(1, state), true);
  assert.equal(storage.slotList()[0].empty, false);
  assert.equal(storage.slotList()[0].name, '高植物');
  assert.equal(storage.localHistory()[0].type, 'save');
  assert.equal(storage.loadSlot(1).year, 2030);
  assert.equal(storage.localHistory()[0].type, 'load');

  state.year = 2035;
  assert.equal(storage.saveSlot(2, state), true);
  assert.equal(storage.loadSlot(2).year, 2035);
  assert.equal(storage.localHistory()[0].type, 'load');
  assert.ok([...local.keys()].every(key => key.startsWith('buyunlu_')), 'storage must not involve a network or foreign key');
  delete global.wx;
});

test('invalid or empty slots fail safely without replacing the current game', () => {
  const local = new Map();
  global.wx = {
    getStorageSync: key => local.get(key),
    setStorageSync: (key, value) => local.set(key, value),
    removeStorageSync: key => local.delete(key),
  };
  const storage = loadStorageApi();
  assert.equal(storage.loadSlot(1), null);
  assert.equal(storage.saveSlot(0, {}), false);
  assert.equal(storage.loadSlot(4), null);
  assert.equal(storage.slotList().length, 3);
  delete global.wx;
});
