const { RANKS } = require('../game/data-full');
const { PUBLIC_SERVANT_TITLE, honorDisplayTitle } = require('../game/core');
const WORK_START_AGE = 22;
// 「人民公仆」不进入游戏本体的晋升链，但在排行榜上作为副国级之上的虚拟档位。
const LEADERBOARD_HONOR_RANK = RANKS.length + 1;
const LEADERBOARD_LEADER_RANK = RANKS.length + 2;

function honorOf(raw) {
  const text = String(raw == null ? '' : raw).trim();
  return text === PUBLIC_SERVANT_TITLE ? PUBLIC_SERVANT_TITLE : '';
}

function leaderboardRankIndexOf(source) {
  const raw = source || {};
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(raw.rankIndex) || 1)));
  const honor = raw.honor !== undefined ? raw.honor : raw.honorTitle;
  if (!raw.fell && !raw.fallDetail && raw.leader === true && honorOf(honor)) return LEADERBOARD_LEADER_RANK;
  if (!raw.fell && !raw.fallDetail && honorOf(honor)) return LEADERBOARD_HONOR_RANK;
  return rankIndex;
}

function workYearsOf(source) {
  const explicit = Number(source && source.workYears);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
  const age = Number(source && source.age);
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.floor(age - WORK_START_AGE));
}

function remainingAssetsOf(state) {
  const source = state || {};
  const reported = Number(source.retirementWealth);
  if (source.ended && Number.isFinite(reported)) return Math.max(0, Math.floor(reported));
  const total = Number(source.money || 0)
    + Number(source.providentFund || 0)
    + Number(source.annuity || 0)
    + Number(source.houseValue || 0)
    + Number(source.carValue || 0)
    - Number(source.houseLoanBalance || 0)
    - Number(source.carLoanBalance || 0);
  return Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
}

function formatAssetValue(value) {
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}亿元`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万元`;
  return `${amount}元`;
}

function formatConfiscatedValue(value) {
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  const wan = amount / 10000;
  return `${wan >= 100 ? wan.toFixed(0) : wan.toFixed(1)}万元`;
}

function playerEntry(state) {
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(state && state.rankIndex) || 1)));
  // 落马的人不进榜面：职级、政绩、考核、廉政全部归零。
  // 这是这个游戏唯一一个"前功尽弃"的地方，排行榜必须如实反映，
  // 否则玩家会看到"被查了还排在前面"这种自相矛盾的结论。
  const fell = !!(state && state.fallDetail);
  if (fell) {
    return {
      id: 'player',
      name: state && state.name ? String(state.name).slice(0, 8) : '匿名玩家',
      rankIndex: 1,
      rankYears: 0,
      achievements: 0,
      review: 0,
      integrity: 0,
      position: state.ending ? String(state.ending).slice(0, 12) : '落马被查',
      isPlayer: true,
      fell: true,
    };
  }
  const honor = honorOf(state && state.honorTitle);
  const leader = honorDisplayTitle(state) === '领导者 · 人民公仆';
  return {
    id: 'player',
    name: state && state.name ? String(state.name).slice(0, 8) : '匿名玩家',
    rankIndex: leaderboardRankIndexOf({ rankIndex, honor, leader }),
    rankYears: Math.max(0, Math.floor(Number(state && state.rankYears) || 0)),
    achievements: Math.max(0, Math.floor(Number(state && state.achievements) || 0)),
    review: Math.max(0, Math.floor(Number(state && state.review) || 0)),
    integrity: Math.max(0, Math.floor(Number(state && state.integrity) || 0)),
    position: state && state.currentPosition && state.currentPosition !== '待选择具体岗位' ? String(state.currentPosition) : RANKS[rankIndex - 1].short,
    honor,
    leader,
    isPlayer: true,
  };
}

// 榜上只有真实提交过的记录。早期版本会在本地拼 7342 条随机样本做冷启动，
// 玩家会看到一个"看起来很热闹"的假榜 —— 那是编造出来的。现在离线时
// 本机自己的成绩就是全部，其余以服务端真实数据为准。
function getPlayerRanking(state) {
  if (state && state.escapeDetail) return { rank: null, total: 0, entries: [] };
  const entry = playerEntry(state);
  return { rank: 1, total: 1, entries: [Object.assign({ rank: 1 }, entry)] };
}

function playerTigerEntry(state) {
  const source = state || {};
  if (!source.fallDetail) return null;
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(source.rankIndex) || 1)));
  return {
    id: 'player',
    name: source.name ? String(source.name).slice(0, 8) : '匿名玩家',
    rankIndex,
    rankYears: Math.max(0, Math.floor(Number(source.rankYears) || 0)),
    age: Math.max(0, Math.floor(Number(source.age) || 0)),
    workYears: workYearsOf(source),
    confiscatedValue: Math.max(0, Math.floor(Number(source.fallDetail.confiscated) || 0)),
    assetValue: Math.max(0, Math.floor(Number(source.fallDetail.confiscated) || 0)),
    position: String(source.currentPosition || RANKS[rankIndex - 1].short).slice(0, 24),
    isPlayer: true,
    fell: true,
  };
}

function getTigerRanking(state, limit = 6) {
  // 老虎榜不做本地样本：查处财产是"指控性"信息，编一条假的就是造谣。
  // 离线时最多显示本机自己的落马记录，其余以服务端为准。
  const player = playerTigerEntry(state);
  const entries = player ? [player] : [];
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 6));
  const visible = entries.slice(0, safeLimit).map((entry, index) => Object.assign({ rank: index + 1 }, entry));
  return { rank: player ? 1 : null, total: entries.length, entries: visible };
}

const ESCAPE_METHOD_NAMES = { plane: '飞机', ship: '轮船', train: '火车' };

function playerEscapeEntry(state) {
  const source = state || {};
  const detail = source.escapeDetail;
  if (!detail || !ESCAPE_METHOD_NAMES[detail.method]) return null;
  return {
    id: 'player',
    name: source.name ? String(source.name).slice(0, 8) : '匿名玩家',
    rankIndex: Math.max(1, Math.min(RANKS.length, Math.floor(Number(detail.rankIndex || source.rankIndex) || 1))),
    escapeMethod: detail.method,
    escapeAmount: Math.max(0, Math.floor(Number(detail.amount) || 0)),
    isPlayer: true,
    escaped: true,
  };
}

function getEscapeRanking(state, limit = 6) {
  const player = playerEscapeEntry(state);
  const entries = player ? [Object.assign({ rank: 1 }, player)] : [];
  return { rank: player ? 1 : null, total: entries.length, entries: entries.slice(0, Math.max(1, Math.floor(Number(limit) || 6))) };
}

// 与 leaderboard-api 共用的榜面行结构（给自定义弹窗按样式渲染，纯文本做不到"自己那栏变色"）：
//   text    普通一行            section 段落标题（全网前列）
//   gap     名次空档分割线       entry  一条榜单行（medal 只有前三挂奖牌，其余行留空占位对齐）
// 全网前列显示前 8 名（只有前三挂奖牌），超出 8 名之外又还没到玩家身边的，用空档行带过。
const BOARD_TOP_SIZE = 8;

function boardRows(result, options) {
  const opts = options || {};
  const totalLabel = opts.totalLabel || '全网玩家：{total}人';
  const rankLabel = opts.rankLabel || '你的全网排名：第{rank}名 / {total}';
  const subOf = opts.subOf || (() => '');
  const total = Math.max(0, Number(result && result.total) || 0);
  const rank = (result && result.rank) || null;
  const entries = (result && result.entries) || [];
  const rows = [
    { kind: 'text', text: totalLabel.replace('{total}', total) },
    { kind: 'text', text: rank ? rankLabel.replace('{rank}', rank).replace('{total}', total) : '本设备尚未提交结局成绩' },
  ];
  const identity = entry => entry.isPlayer ? `你 · ${entry.name}（本设备）` : entry.name;
  const medalOf = value => opts.medals === false ? '' : value === 1 ? '🥇' : value === 2 ? '🥈' : value === 3 ? '🥉' : '';
  // 兼容早期响应使用的 honorTitle，以及只返回虚拟第 12 档但未带称号字段的记录。
  const entryHonorOf = entry => {
    const source = entry || {};
    const declared = honorOf(source.honor !== undefined ? source.honor : source.honorTitle);
    if (declared) return source.leader === true ? '领导者 · 人民公仆' : declared;
    if (!source.fell && !source.fallDetail && Math.floor(Number(source.rankIndex)) === LEADERBOARD_LEADER_RANK) return '领导者 · 人民公仆';
    const virtualHonorRank = Math.floor(Number(source.rankIndex)) === LEADERBOARD_HONOR_RANK;
    return !source.fell && !source.fallDetail && virtualHonorRank ? PUBLIC_SERVANT_TITLE : '';
  };
  const positionOf = entry => opts.positionOf ? opts.positionOf(entry) : (entryHonorOf(entry) ? '' : String(entry && entry.position || ''));
  const shown = new Set();
  const top = entries.filter(entry => entry.rank <= BOARD_TOP_SIZE).sort((a, b) => a.rank - b.rank);
  if (top.length) {
    rows.push({ kind: 'section', text: '全网前列' });
    top.forEach(entry => {
      shown.add(entry.rank);
      rows.push({ kind: 'entry', medal: medalOf(entry.rank), rank: entry.rank, name: identity(entry), player: !!entry.isPlayer, position: positionOf(entry), sub: subOf(entry), honor: entryHonorOf(entry) });
    });
  }
  const nearby = entries.filter(entry => !shown.has(entry.rank)).sort((a, b) => a.rank - b.rank);
  // 前列最后一名与"我上一位"之间隔着的名次数，就是分割线上要写的那个数
  const beforeEntry = rank ? nearby.find(entry => !entry.isPlayer && entry.rank < rank) : null;
  const topEnd = top.length ? top[top.length - 1].rank : 0;
  const gapCount = rank ? Math.max(0, (beforeEntry ? beforeEntry.rank : rank) - topEnd - 1) : 0;
  if (gapCount > 0) rows.push({ kind: 'gap', count: gapCount });
  // 前后位行不带任何箭头前缀：奖牌列固定占位已经把名次对齐，自己那栏靠蓝色高亮区分
  nearby.forEach(entry => {
    rows.push({ kind: 'entry', medal: '', rank: entry.rank, name: identity(entry), player: !!entry.isPlayer, position: positionOf(entry), sub: subOf(entry), honor: entryHonorOf(entry) });
  });
  if (!entries.length && opts.emptyTip) rows.push({ kind: 'text', text: opts.emptyTip });
  // 榜上每一个名字都来自真实玩家的存档，容易被误读成真实职务与真实案件，
  // 所以两个榜单底部都固定挂一句虚构声明。
  if (opts.footnote) rows.push({ kind: 'note', text: opts.footnote });
  return rows;
}

const BOARD_DISCLAIMER = '以上均为虚构故事设定，不对应任何真实人物、机构或事件。';

function rankingRows(result) {
  return boardRows(result, { footnote: BOARD_DISCLAIMER });
}

function tigerRows(result) {
  return boardRows(result, {
    footnote: '以上均为虚构故事设定，不对应任何真实人物、机构或案件。',
    totalLabel: '落马玩家：{total}人',
    rankLabel: '你的老虎榜排名：第{rank}名 / {total}',
    emptyTip: '还没有公开的落马记录。',
    subOf: entry => {
      const tenure = `${workYearsOf(entry)}年`;
      const money = formatConfiscatedValue(entry.confiscatedValue == null ? entry.assetValue : entry.confiscatedValue);
      return `工作${tenure}落马　查处财产${money}`;
    },
  });
}

function escapeRows(result) {
  return boardRows(result, {
    medals: false,
    totalLabel: '出逃结局记录：{total}人',
    rankLabel: '你的金蝉榜排名：第{rank}名 / {total}',
    emptyTip: '还没有公开的出逃结局记录。',
    footnote: '金蝉榜为虚构结局记录，不对应任何真实人物、机构、案件或现实处置建议。',
    positionOf: entry => {
      const rankIndex = Math.floor(Number(entry && entry.rankIndex));
      return rankIndex >= 1 && rankIndex <= RANKS.length ? RANKS[rankIndex - 1].name : '历史记录（职级未记录）';
    },
    subOf: entry => `${ESCAPE_METHOD_NAMES[entry.escapeMethod] || '方式未记录'}　涉案携带现金${formatAssetValue(entry.escapeAmount)}`,
  });
}

function rowsToText(rows) {
  return (rows || []).map(row => {
    if (row.kind === 'text' || row.kind === 'section' || row.kind === 'note') return row.text;
    if (row.kind === 'gap') return `····· 中间还有 ${row.count} 人 ·····`;
    const honor = row.honor ? `　${row.honor}` : '';
    const position = row.position ? `　${row.position}` : '';
    return `${row.medal ? `${row.medal} ` : ''}${row.rank}. ${row.name}${honor}${position}${row.sub ? `\n　　${row.sub}` : ''}`;
  }).join('\n');
}

function formatRanking(result) {
  return rowsToText(rankingRows(result));
}

function formatTigerRanking(result) {
  return rowsToText(tigerRows(result));
}

function formatEscapeRanking(result) {
  return rowsToText(escapeRows(result));
}

module.exports = {
  BOARD_TOP_SIZE,
  LEADERBOARD_HONOR_RANK, LEADERBOARD_LEADER_RANK, honorOf, leaderboardRankIndexOf,
  getPlayerRanking, formatRanking, rankingRows, tigerRows, escapeRows, rowsToText,
  WORK_START_AGE, workYearsOf, remainingAssetsOf, formatAssetValue, formatConfiscatedValue, getTigerRanking, formatTigerRanking,
  ESCAPE_METHOD_NAMES, getEscapeRanking, formatEscapeRanking,
};
