const test = require('node:test');
const assert = require('node:assert/strict');
const leaderboard = require('../services/leaderboard');

test('local career ranking only contains the real player entry, no fabricated rows', () => {
  // 早期版本会在本地拼 7342 条随机样本冒充"全网玩家"，那是编造的数据。
  // 现在离线时榜上只有本机自己：rank 1 / total 1，其余以服务端为准。
  const result = leaderboard.getPlayerRanking({ name: '高植物', rankIndex: 11, rankYears: 0, achievements: 100, review: 100, integrity: 100 });
  assert.equal(result.total, 1);
  assert.equal(result.rank, 1);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].name, '高植物');
  assert.equal(result.entries[0].isPlayer, true);
  const text = leaderboard.formatRanking(result);
  assert.match(text, /高植物.*副国级/);
  assert.match(text, /全网玩家：1人/);
  assert.doesNotMatch(text, /样本/, '榜面文案里不能再出现"样本"这种说法');
});

test('ending rank reflects a fallen player with zeroed stats', () => {
  const result = leaderboard.getPlayerRanking({ name: '高植物', fallDetail: { confiscated: 1000000 }, ending: '违纪被查' });
  assert.equal(result.entries[0].rankIndex, 1);
  assert.equal(result.entries[0].achievements, 0);
  assert.equal(result.entries[0].integrity, 0);
  assert.equal(result.entries[0].fell, true);
});

test('老虎榜只收录落马玩家，本地不掺样本数据', () => {
  const state = {
    name: '高植物', ended: true, rankIndex: 11, rankYears: 4, age: 49, currentPosition: '国家级副职',
    fallDetail: { confiscated: 9999999999 }, ending: '依法处理',
  };
  const result = leaderboard.getTigerRanking(state);
  // 查处财产是指控性内容，不能编造：离线时只有本机自己的记录
  assert.equal(result.total, 1);
  assert.equal(result.rank, 1);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].name, '高植物');
  assert.equal(result.entries[0].confiscatedValue, 9999999999);
  assert.equal(result.entries[0].workYears, 27);
  assert.ok(result.entries.every(entry => entry.isPlayer));
  assert.match(leaderboard.formatTigerRanking(result), /查处财产/);
  assert.match(leaderboard.formatTigerRanking(result), /国家级副职[\s\S]*工作27年落马/);
  // 职位后面那圈"（落马时职位）"是给开发者的注释，不该展示给玩家
  assert.doesNotMatch(leaderboard.formatTigerRanking(result), /落马时职位/);
});

test('老虎榜显示总工作年限，不再显示晋升后归零的当前职级任职年限', () => {
  const result = leaderboard.getTigerRanking({
    name: '沈明远', ended: true, rankIndex: 8, rankYears: 2, age: 55, currentPosition: '正厅级',
    fallDetail: { confiscated: 8000000 }, ending: '依法处理',
  });
  assert.equal(result.entries[0].rankYears, 2);
  assert.equal(result.entries[0].workYears, 33);
  const text = leaderboard.formatTigerRanking(result);
  assert.match(text, /工作33年落马/);
  assert.doesNotMatch(text, /任职0年|任职2年|工作2年/);
});

test('未落马存档不会进入老虎榜，空榜要有明确说法', () => {
  const result = leaderboard.getTigerRanking({
    name: '试算玩家', ended: false, money: 10000, providentFund: 2000, annuity: 3000,
    houseValue: 50000, carValue: 20000, houseLoanBalance: 1000, carLoanBalance: 500,
  });
  assert.equal(result.total, 0);
  assert.equal(result.rank, null);
  assert.equal(result.entries.find(entry => entry.isPlayer), undefined);
  assert.match(leaderboard.formatTigerRanking(result), /还没有公开的落马记录/);
});

test('金蝉榜只显示职级、方式和涉案携带现金，不泄露具体职位与工作年限', () => {
  const state = {
    name: '林知行', age: 55, rankIndex: 8, rankYears: 9, currentPosition: '某具体敏感岗位',
    ended: true, ending: '出逃结局',
    escapeDetail: { method: 'ship', amount: 1286000, year: 2048, rankIndex: 8 },
  };
  const result = leaderboard.getEscapeRanking(state);
  assert.equal(result.total, 1);
  assert.equal(result.entries[0].escapeMethod, 'ship');
  assert.equal(result.entries[0].escapeAmount, 1286000);
  assert.equal(Object.hasOwn(result.entries[0], 'position'), false);
  assert.equal(Object.hasOwn(result.entries[0], 'workYears'), false);
  const rows = leaderboard.escapeRows(result);
  const entry = rows.find(row => row.kind === 'entry');
  assert.equal(entry.medal, '');
  assert.match(entry.sub, /轮船.*涉案携带现金128\.6万元/);
  const text = leaderboard.formatEscapeRanking(result);
  assert.doesNotMatch(text, /某具体敏感岗位|工作\d+年|任职\d+年|🥇|🥈|🥉/);
  assert.match(text, /虚构结局记录/);
});

test('金蝉榜历史记录缺少原始职级时不伪装成二级科员', () => {
  const rows = leaderboard.escapeRows({ rank: null, total: 1, entries: [
    { rank: 1, name: '历史记录', rankIndex: null, escapeMethod: 'train', escapeAmount: 100000 },
  ] });
  const entry = rows.find(row => row.kind === 'entry');
  assert.equal(entry.position, '历史记录（职级未记录）');
});

test('两个榜单前三名带特殊标识，玩家行清晰标记', () => {
  const career = leaderboard.formatRanking({ rank: 2, total: 3, entries: [
    { rank: 1, name: '甲', position: '正厅级' },
    { rank: 2, name: '高植物', position: '副厅级', isPlayer: true },
    { rank: 3, name: '丙', position: '正处级' },
  ] });
  const tiger = leaderboard.formatTigerRanking({ rank: 2, total: 3, entries: [
    { rank: 1, name: '甲', position: '正厅级', rankYears: 8, confiscatedValue: 3000000 },
    { rank: 2, name: '高植物', position: '副厅级', rankYears: 4, confiscatedValue: 2000000, isPlayer: true },
    { rank: 3, name: '丙', position: '正处级', rankYears: 2, confiscatedValue: 1000000 },
  ] });
  ['🥇', '🥈', '🥉'].forEach(mark => { assert.match(career, new RegExp(mark)); assert.match(tiger, new RegExp(mark)); });
  assert.match(career, /2\. 你 · 高植物（本设备）/);
  assert.match(tiger, /2\. 你 · 高植物（本设备）/);
});

test('board rows mark the player, count the skipped ranks and carry the fiction disclaimer', () => {
  const rows = leaderboard.rankingRows({ rank: 9292, total: 9292, entries: [
    { rank: 1, name: '郑某', position: '国家级重要领导岗位' },
    { rank: 2, name: '刘书记', position: '国家级重要领导岗位' },
    { rank: 3, name: '王某某', position: '国家级重要领导岗位' },
    { rank: 9291, name: '张某', position: '厅局级正职' },
    { rank: 9292, name: '高植物', position: '厅局级副职', isPlayer: true },
  ] });
  // 前列最后一名（第3）与我上一位（第9291）之间隔着第4~9290，共 9287 人
  const gap = rows.find(row => row.kind === 'gap');
  assert.ok(gap && gap.count === 9287, '分割线要写清中间还有多少人');
  assert.equal(rows.filter(row => row.kind === 'gap').length, 1, '空档行只出现一次');
  const self = rows.filter(row => row.kind === 'entry').find(row => row.player);
  assert.ok(self && self.medal === '' && self.name.includes('你 · 高植物'), '自己那栏不带箭头，靠 player 标记走样式高亮');
  // 玩家挤进前三时不该出现空档行（第3名后面紧跟着就是他）
  const nearTop = leaderboard.rankingRows({ rank: 4, total: 9, entries: [
    { rank: 1, name: '甲', position: '' }, { rank: 2, name: '乙', position: '' },
    { rank: 3, name: '丙', position: '' }, { rank: 4, name: '高植物', position: '', isPlayer: true },
    { rank: 5, name: '丁', position: '' },
  ] });
  assert.equal(nearTop.filter(row => row.kind === 'gap').length, 0, '紧挨前列时没有名次空档');
  // 全网前列要放出前 8 名，但奖牌只挂前三（第 4~8 名留空奖牌位）
  const topEight = leaderboard.rankingRows({ rank: 40, total: 40, entries: [
    ...Array.from({ length: 8 }, (_, i) => ({ rank: i + 1, name: `第${i + 1}名`, position: '' })),
    { rank: 39, name: '张某', position: '' },
    { rank: 40, name: '高植物', position: '', isPlayer: true },
  ] });
  const sectionAt = topEight.findIndex(row => row.kind === 'section');
  const afterSection = topEight.slice(sectionAt + 1);
  const firstGapAt = afterSection.findIndex(row => row.kind === 'gap');
  const topEntries = afterSection.slice(0, firstGapAt);
  assert.equal(topEntries.length, 8, '全网前列显示前 8 名');
  assert.deepEqual(topEntries.map(row => row.medal), ['🥇', '🥈', '🥉', '', '', '', '', ''], '奖牌只挂前三名');
  assert.equal(topEntries.map(row => row.rank).join(','), '1,2,3,4,5,6,7,8');
  const gapEight = topEight.find(row => row.kind === 'gap');
  assert.ok(gapEight && gapEight.count === 30, '第 8 名与第 39 名之间隔着 30 人');
  // 老虎榜走同一套行结构，前列名额同样要放到 8
  const tigerTop = leaderboard.tigerRows({ rank: 20, total: 20, entries: [
    ...Array.from({ length: 9 }, (_, i) => ({ rank: i + 1, name: `虎${i + 1}`, position: '', rankYears: 3, confiscatedValue: 1000000 })),
    { rank: 20, name: '高植物', position: '', rankYears: 2, confiscatedValue: 500000, isPlayer: true },
  ] });
  const tigerSectionAt = tigerTop.findIndex(row => row.kind === 'section');
  const tigerLead = tigerTop.slice(tigerSectionAt + 1).filter(row => row.kind === 'entry');
  assert.equal(tigerLead.filter(row => row.rank <= 8).length, 8, '老虎榜同样显示前 8 名');
  // 免责声明固定挂在最后，两个榜单都要有
  assert.match(rows[rows.length - 1].text, /虚构/);
  const tiger = leaderboard.tigerRows({ rank: 2, total: 3, entries: [{ rank: 2, name: '高植物', position: '', rankYears: 4, confiscatedValue: 100, isPlayer: true }] });
  assert.match(tiger[tiger.length - 1].text, /虚构.*案件/);
  // 玩家行的落马财产副行也带 player 标记，跟着一起高亮
  const selfTiger = tiger.filter(row => row.kind === 'entry').find(row => row.player);
  assert.ok(selfTiger.sub.includes('查处财产'));
});
