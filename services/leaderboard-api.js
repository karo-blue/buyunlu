const { leaderboardApiBaseUrl } = require('./config');
const leaderboard = require('./leaderboard');
const core = require('../game/core');

const CLIENT_ID_KEY = 'buyunlu_leaderboard_client_id_v1';

function isConfigured() {
  return !!leaderboardApiBaseUrl && typeof wx !== 'undefined' && typeof wx.request === 'function';
}

function getClientId() {
  try {
    const saved = wx.getStorageSync(CLIENT_ID_KEY);
    if (saved) return String(saved);
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    wx.setStorageSync(CLIENT_ID_KEY, id);
    return id;
  } catch (error) {
    return `p-${Date.now().toString(36)}`;
  }
}

function request(path, options = {}) {
  if (!isConfigured()) return Promise.reject(new Error('leaderboard API is unavailable'));
  return new Promise((resolve, reject) => {
    wx.request(Object.assign({
      url: `${leaderboardApiBaseUrl}${path}`,
      timeout: 8000,
      header: { 'content-type': 'application/json' },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.data && response.data.ok !== false) resolve(response.data);
        else reject(new Error(`leaderboard request failed: ${response.statusCode}`));
      },
      fail: reject,
    }, options));
  });
}

// 旧版服务端会在榜单里混入随机样本（高育良、李达康那些假名字）。
// 新服务端读盘时已经整批清洗，但只要线上还没重新部署，响应里就仍可能有旧数据。
// 这里做一道前端防线：isSample 的行一律不渲染，总数扣掉服务端声明的样本数
// 和本次响应里实际被滤掉的行数 —— 部署新服务端之前，人数也不会显示成 9292。
function sanitizeRemote(result) {
  if (!result || typeof result !== 'object') return result;
  const rawEntries = Array.isArray(result.entries) ? result.entries : [];
  const entries = rawEntries.filter(entry => entry && entry.isSample !== true);
  const dropped = rawEntries.length - entries.length;
  const declared = Number(result.sampleCount) || 0;
  const total = (declared > 0 || dropped > 0)
    ? Math.max(entries.length, (Number(result.total) || 0) - declared - dropped)
    : Number(result.total) || 0;
  return Object.assign({}, result, { entries, total });
}

function submit(state) {
  const source = state || {};
  // 落马结局在主榜仍会由服务端归零；同时提交落马前数据，供老虎榜展示。
  const fell = !!source.fallDetail;
  const escaped = !!(source.escapeDetail && source.ending === '出逃结局');
  return request('/leaderboard/submit', {
    method: 'POST',
    data: {
      clientId: getClientId(),
      name: source.name || '匿名玩家',
      rankIndex: source.rankIndex,
      rankYears: source.rankYears,
      workYears: leaderboard.workYearsOf(source),
      achievements: source.achievements,
      review: source.review,
      integrity: source.integrity,
      age: source.age,
      position: escaped ? '' : String(source.currentPosition || (fell ? '落马被查' : '')).slice(0, 24),
      honor: leaderboard.honorOf(source.honorTitle),
      leader: core.honorDisplayTitle(source) === '领导者 · 人民公仆',
      reputation: source.reputation,
      health: source.health,
      illicitIncome: source.illicitIncome,
      faultHelpUsedYear: source.faultHelpUsedYear,
      assetValue: leaderboard.remainingAssetsOf(Object.assign({}, source, { ended: !!(source.ended || fell) })),
      confiscatedValue: fell && source.fallDetail ? Math.max(0, Math.floor(Number(source.fallDetail.confiscated) || 0)) : 0,
      fell,
      escaped,
      escapeMethod: escaped ? source.escapeDetail.method : '',
      escapeAmount: escaped ? Math.max(0, Math.floor(Number(source.escapeDetail.amount) || 0)) : 0,
    },
  }).then(sanitizeRemote);
}

function fetchRanking(limit = 6) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 6)));
  return request(`/leaderboard?limit=${safeLimit}&clientId=${encodeURIComponent(getClientId())}`).then(sanitizeRemote);
}

function fetchTigerRanking(limit = 6) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 6)));
  return request(`/tigerboard?limit=${safeLimit}&clientId=${encodeURIComponent(getClientId())}`).then(sanitizeRemote);
}

function fetchEscapeRanking(limit = 6) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 6)));
  return request(`/escapeboard?limit=${safeLimit}&clientId=${encodeURIComponent(getClientId())}`).then(sanitizeRemote);
}

// 榜面行结构统一由 leaderboard.boardRows 生成（前三名 + 玩家前后位 + 名次空档分割线），
// 文本版 formatRanking 只是把同一份行拼回字符串，避免两处排版各写一份日后漂移。

function rankingRows(result) {
  return leaderboard.rankingRows(sanitizeRemote(result));
}

function tigerRows(result) {
  return leaderboard.tigerRows(sanitizeRemote(result));
}

function escapeRows(result) {
  return leaderboard.escapeRows(sanitizeRemote(result));
}

function formatRanking(result) {
  return leaderboard.rowsToText(rankingRows(result));
}

function formatTigerRanking(result) {
  return leaderboard.rowsToText(tigerRows(result));
}

function formatEscapeRanking(result) {
  return leaderboard.rowsToText(escapeRows(result));
}

module.exports = { CLIENT_ID_KEY, isConfigured, getClientId, request, submit, fetchRanking, formatRanking, fetchTigerRanking, formatTigerRanking, fetchEscapeRanking, formatEscapeRanking, sanitizeRemote, rankingRows, tigerRows, escapeRows };
