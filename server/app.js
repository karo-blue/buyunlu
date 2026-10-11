const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createVirtualPayService, loadConfig: loadPayConfig, deliverNotifyResponse, verifyMessageSignature } = require('./virtual-pay');

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 官方建议的兜底查单频率
const SERVICE_NAME = String(process.env.SERVICE_NAME || 'buyunlu-leaderboard');
const WORK_START_AGE = 22;
const RANKS = [
  ['二级科员', '二级科员'], ['四级主任科员', '四级主任科员'], ['乡科级副职（副科级）', '副科级'],
  ['乡科级正职（正科级）', '正科级'], ['县处级副职（副处级）', '副处级'], ['县处级正职（正处级）', '正处级'],
  ['厅局级副职（副厅级）', '副厅级'], ['厅局级正职（正厅级）', '正厅级'], ['省部级副职（副部级）', '副部级'],
  ['省部级正职（正部级）', '正部级'], ['国家级副职（副国级）', '副国级'],
];
// 「人民公仆」不是第12个晋升职级，只在公开排行榜中作为副国级之上的虚拟档位。
const LEADERBOARD_HONOR_RANK = RANKS.length + 1;
const LEADERBOARD_LEADER_RANK = RANKS.length + 2;
const HONOR_TITLE = '人民公仆';
const HONOR_TITLE_MAX_LENGTH = 12;

function honorOf(raw) {
  return safeText(raw, HONOR_TITLE_MAX_LENGTH) === HONOR_TITLE ? HONOR_TITLE : '';
}

function leaderboardRankIndexOf(entry) {
  const source = entry || {};
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(source.rankIndex) || 1)));
  if (!source.fell && source.leader === true && honorOf(source.honor)) return LEADERBOARD_LEADER_RANK;
  return !source.fell && honorOf(source.honor) ? LEADERBOARD_HONOR_RANK : rankIndex;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function safeText(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function workYearsFromAge(age) {
  const value = Number(age);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value - WORK_START_AGE));
}

function storedWorkYearsOf(entry) {
  const source = entry || {};
  for (const field of ['fallWorkYears', 'workYears']) {
    if (!Object.prototype.hasOwnProperty.call(source, field) || source[field] == null) continue;
    const value = Number(source[field]);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
  }
  return workYearsFromAge(source.fallAge || source.age);
}

function normalizeSubmission(input = {}) {
  const rankIndex = clamp(input.rankIndex, 1, RANKS.length);
  const rankYears = clamp(input.rankYears, 0, 60);
  const age = clamp(input.age, 18, 120);
  const workYears = input.workYears == null ? null : clamp(input.workYears, 0, 100);
  const submittedPosition = safeText(input.position, 40);
  // 落马是这个游戏唯一的"前功尽弃"。归零必须在服务端也做一遍：
  // 客户端可以被改，而且老记录里可能还压着落马之前的高分。
  const fell = input.fell === true || input.fell === 'true' || input.fell === 1;
  const escaped = !fell && (input.escaped === true || input.escaped === 'true' || input.escaped === 1);
  const escapeMethods = ['plane', 'ship', 'train'];
  const escapeMethod = escaped && escapeMethods.includes(input.escapeMethod) ? input.escapeMethod : '';
  const honor = fell || escaped ? '' : honorOf(input.honor);
  // 领导者是荣誉档位，不是第13个官阶；服务端至少复核提交时的硬门槛。
  // 完整经历仍由客户端资格快照留存，排行榜接口本身不是防破解系统。
  const leader = !fell && !escaped && honor === HONOR_TITLE && input.leader === true
    && rankIndex === RANKS.length && rankYears >= 3 && clamp(input.achievements, 0, 9999) >= 120
    && clamp(input.review, 0, 100) >= 95 && clamp(input.integrity, 0, 100) === 100
    && clamp(input.reputation, 0, 100) >= 98 && clamp(input.health, 0, 100) >= 60
    && clamp(input.illicitIncome, 0, 1000000000000) === 0 && clamp(input.faultHelpUsedYear, 0, 9999) === 0;
  return {
    id: safeText(input.clientId, 128),
    clientId: safeText(input.clientId, 128),
    name: safeText(input.name || '匿名玩家', 8) || '匿名玩家',
    rankIndex: fell || escaped ? 1 : rankIndex,
    rankYears: fell || escaped ? 0 : rankYears,
    achievements: fell || escaped ? 0 : clamp(input.achievements, 0, 9999),
    review: fell || escaped ? 0 : clamp(input.review, 0, 100),
    integrity: fell || escaped ? 0 : clamp(input.integrity, 0, 100),
    age,
    position: escaped ? '' : (submittedPosition || (fell ? '落马被查' : RANKS[rankIndex - 1][1])),
    honor,
    leader,
    assetValue: clamp(input.assetValue, 0, 1000000000000),
    confiscatedValue: clamp(input.confiscatedValue, 0, 1000000000000),
    fallRankIndex: fell ? rankIndex : 0,
    fallRankYears: fell ? rankYears : 0,
    fallWorkYears: fell ? workYears : null,
    fallAge: fell ? age : 0,
    fallPosition: fell ? (submittedPosition || RANKS[rankIndex - 1][1]) : '',
    fell,
    escaped,
    escapeRankIndex: escaped ? rankIndex : 0,
    escapeMethod,
    escapeAmount: escaped ? clamp(input.escapeAmount, 0, 1000000000000) : 0,
    updatedAt: new Date().toISOString(),
  };
}

function compareEntries(left, right) {
  const leftRank = leaderboardRankIndexOf(left);
  const rightRank = leaderboardRankIndexOf(right);
  if (leftRank !== rightRank) return rightRank - leftRank;
  const fields = ['rankYears', 'achievements', 'review', 'integrity'];
  for (const field of fields) {
    if (left[field] !== right[field]) return right[field] - left[field];
  }
  return String(left.id).localeCompare(String(right.id));
}

function assetValueOf(entry) {
  const reported = Number(entry && entry.assetValue);
  if (Number.isFinite(reported) && reported >= 0) return Math.floor(reported);
  const source = entry || {};
  const id = String(source.id || 'sample');
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return Math.max(0, Math.floor(
    (Number(source.rankIndex) || 1) * 450000
    + (Number(source.rankYears) || 0) * 20000
    + (Number(source.achievements) || 0) * 3000
    + (Number(source.review) || 0) * 1000
    + (Number(source.integrity) || 0) * 500
    + (hash % 440001) + 10000,
  ));
}

function compareAssetEntries(left, right) {
  const leftValue = assetValueOf(left);
  const rightValue = assetValueOf(right);
  if (leftValue !== rightValue) return rightValue - leftValue;
  if ((left.rankIndex || 0) !== (right.rankIndex || 0)) return (right.rankIndex || 0) - (left.rankIndex || 0);
  return String(left.id).localeCompare(String(right.id));
}

function confiscatedValueOf(entry) {
  if (entry && Object.prototype.hasOwnProperty.call(entry, 'confiscatedValue')) {
    const reported = Number(entry.confiscatedValue);
    if (Number.isFinite(reported) && reported >= 0) return Math.floor(reported);
  }
  // 兼容旧版记录：旧提交没有独立的查处金额，使用当时上报资产作为保守替代。
  return assetValueOf(entry);
}

function tigerEntryOf(entry) {
  if (!entry || !entry.fell) return null;
  const rankIndex = Math.max(1, Math.min(RANKS.length, Math.floor(Number(entry.fallRankIndex || entry.rankIndex) || 1)));
  const rankYears = Math.max(0, Math.floor(Number(entry.fallRankYears == null ? entry.rankYears : entry.fallRankYears) || 0));
  const age = Math.max(18, Math.floor(Number(entry.fallAge || entry.age) || (22 + rankIndex * 4 + rankYears)));
  const workYears = storedWorkYearsOf(entry);
  const position = safeText(entry.fallPosition || entry.position, 40) || RANKS[rankIndex - 1][1];
  const confiscatedValue = confiscatedValueOf(entry);
  return Object.assign({}, entry, {
    rankIndex, rankYears, workYears, age, position, fell: true,
    confiscatedValue, assetValue: confiscatedValue,
  });
}

function compareTigerEntries(left, right) {
  const leftValue = confiscatedValueOf(left);
  const rightValue = confiscatedValueOf(right);
  if (leftValue !== rightValue) return rightValue - leftValue;
  if ((left.rankIndex || 0) !== (right.rankIndex || 0)) return (right.rankIndex || 0) - (left.rankIndex || 0);
  return String(left.id).localeCompare(String(right.id));
}

function publicTigerEntry(entry, rank, isPlayer = false) {
  const tiger = tigerEntryOf(entry) || entry;
  return {
    rank,
    name: tiger.name,
    rankIndex: tiger.rankIndex,
    rankYears: tiger.rankYears,
    workYears: tiger.workYears,
    age: tiger.age,
    position: tiger.position,
    confiscatedValue: confiscatedValueOf(tiger),
    assetValue: confiscatedValueOf(tiger),
    fell: true,
    isPlayer,
  };
}

function compareEscapeEntries(left, right) {
  if (left.escapeAmount !== right.escapeAmount) return right.escapeAmount - left.escapeAmount;
  if (left.escapeRankIndex !== right.escapeRankIndex) return right.escapeRankIndex - left.escapeRankIndex;
  return String(left.id).localeCompare(String(right.id));
}

function publicEscapeEntry(entry, rank, isPlayer = false) {
  return {
    rank,
    name: entry.name,
    rankIndex: clamp(entry.escapeRankIndex, 1, RANKS.length),
    escapeMethod: ['plane', 'ship', 'train'].includes(entry.escapeMethod) ? entry.escapeMethod : '',
    escapeAmount: clamp(entry.escapeAmount, 0, 1000000000000),
    escaped: true,
    isPlayer,
  };
}

function publicEntry(entry, rank, isPlayer = false) {
  return {
    rank,
    name: entry.name,
    rankIndex: leaderboardRankIndexOf(entry),
    rankYears: entry.rankYears,
    achievements: entry.achievements,
    review: entry.review,
    integrity: entry.integrity,
    age: entry.age,
    position: entry.position,
    honor: entry.fell ? '' : honorOf(entry.honor),
    leader: !entry.fell && entry.leader === true,
    assetValue: assetValueOf(entry),
    fell: !!entry.fell,
    isPlayer,
  };
}

function createStore(dataFile) {
  const file = dataFile || path.join(__dirname, 'data', 'leaderboard.json');
  let entries = null;
  let writeChain = Promise.resolve();

  function ensureLoaded() {
    if (entries) return entries;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('invalid leaderboard data');
      // 早期版本会往榜单里灌 7342 条随机样本做冷启动，上线后这些假名字一直挂在榜上。
      // 读入时一次性洗掉并立即回写：线上旧数据文件也会被自动清理，不用人工处理。
      entries = parsed.filter(entry => entry && entry.isSample !== true);
      if (entries.length !== parsed.length) persist();
    } catch (error) {
      entries = [];
      persist();
    }
    return entries;
  }

  function persist() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(entries), 'utf8');
    fs.renameSync(temp, file);
  }

  // 榜单响应统一为「前 N 名（N = 客户端请求的前列名额）+ 玩家前后各一位」：玩家要能看见再进一步要超过谁、
  // 身后会超过谁，而不是只看到自己的名次悬在半空。
  function boardWindow(sorted, playerIndex, safeLimit, makePublic) {
    const wanted = new Map();
    for (let i = 0; i < safeLimit && i < sorted.length; i += 1) wanted.set(i, true);
    if (playerIndex >= 0) {
      [-1, 0, 1].forEach(offset => {
        const index = playerIndex + offset;
        if (index >= 0 && index < sorted.length) wanted.set(index, true);
      });
    }
    return [...wanted.keys()].sort((a, b) => a - b)
      .map(index => makePublic(sorted[index], index + 1, index === playerIndex));
  }

  function ranking({ clientId = '', limit = 20 } = {}) {
    const sorted = ensureLoaded().filter(entry => !entry.escaped).sort(compareEntries);
    const safeLimit = clamp(limit, 1, 100);
    const playerIndex = clientId ? sorted.findIndex(entry => entry.clientId === clientId) : -1;
    return {
      ok: true,
      rank: playerIndex < 0 ? null : playerIndex + 1,
      total: sorted.length,
      entries: boardWindow(sorted, playerIndex, safeLimit, publicEntry),
    };
  }

  function assetRanking({ clientId = '', limit = 20 } = {}) {
    // 老虎榜只上真实的落马记录：查处财产是"指控性"内容，编一条假的就是造谣。
    const sorted = ensureLoaded()
      .map(tigerEntryOf)
      .filter(Boolean)
      .sort(compareTigerEntries);
    const safeLimit = clamp(limit, 1, 100);
    const playerIndex = clientId ? sorted.findIndex(entry => entry.clientId === clientId) : -1;
    return {
      ok: true,
      rank: playerIndex < 0 ? null : playerIndex + 1,
      total: sorted.length,
      entries: boardWindow(sorted, playerIndex, safeLimit, publicTigerEntry),
    };
  }

  function escapeRanking({ clientId = '', limit = 20 } = {}) {
    const sorted = ensureLoaded().filter(entry => entry && entry.escaped).sort(compareEscapeEntries);
    const safeLimit = clamp(limit, 1, 100);
    const playerIndex = clientId ? sorted.findIndex(entry => entry.clientId === clientId) : -1;
    return {
      ok: true,
      rank: playerIndex < 0 ? null : playerIndex + 1,
      total: sorted.length,
      entries: boardWindow(sorted, playerIndex, safeLimit, publicEscapeEntry),
    };
  }

  function submit(input) {
    const entry = normalizeSubmission(input);
    if (!entry.clientId) return Promise.reject(new Error('clientId is required'));
    const operation = writeChain.then(() => {
      ensureLoaded();
      const index = entries.findIndex(item => item.clientId === entry.clientId);
      // entry.fell 一定要能覆盖旧记录：落马后的成绩全是 0，按"只升不降"的老规则
      // 会被落马前的高分挡住，服务端就会一直挂着一个已经被带走的人的名次。
      if (index < 0) {
        entries.push(entry);
        persist();
      } else {
        const current = entries[index];
        let changed = false;
        if (entry.escaped && current.escaped && current.escapeAmount > entry.escapeAmount) {
          // 同一设备重复提交出逃结局时只保留较高的涉案携带现金记录。
        } else if (entry.fell || entry.escaped || compareEntries(entry, current) < 0) {
          const bestAssetValue = Math.max(assetValueOf(entry), assetValueOf(current));
          // 进入老虎榜的查处金额只取落马结局本身；不能把落马前的
          // 普通资产榜数值误当成查处金额。若双方都是落马记录，再保留较高值。
          const previousFallenValue = current.fell ? confiscatedValueOf(current) : 0;
          const bestConfiscatedValue = Math.max(confiscatedValueOf(entry), previousFallenValue);
          entries[index] = entry;
          entries[index].assetValue = bestAssetValue;
          entries[index].confiscatedValue = bestConfiscatedValue;
          changed = true;
        } else if (assetValueOf(entry) > assetValueOf(current) || confiscatedValueOf(entry) > confiscatedValueOf(current)) {
          current.assetValue = Math.max(assetValueOf(entry), assetValueOf(current));
          current.confiscatedValue = Math.max(confiscatedValueOf(entry), confiscatedValueOf(current));
          current.updatedAt = entry.updatedAt;
          changed = true;
        }
        if (changed) persist();
      }
      return entry.escaped ? escapeRanking({ clientId: entry.clientId, limit: 20 }) : ranking({ clientId: entry.clientId, limit: 20 });
    });
    writeChain = operation.catch(() => {});
    return operation;
  }

  return { file, ensureLoaded, ranking, assetRanking, escapeRanking, submit };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      raw += chunk;
      if (raw.length > 256 * 1024) reject(new Error('request body too large'));
    });
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(new Error('invalid JSON')); }
    });
    request.on('error', reject);
  });
}

// 发货推送是 XML 报文，不能按 JSON 解析
function readTextBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      raw += chunk;
      if (raw.length > 256 * 1024) reject(new Error('request body too large'));
    });
    request.on('end', () => resolve(raw));
    request.on('error', reject);
  });
}

function sendXml(response, status, xml) {
  response.writeHead(status, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(xml);
}

function sendText(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(String(value == null ? '' : value));
}

function createApiServer(options = {}) {
  const store = options.store || createStore(options.dataFile);
  const payConfig = options.payConfig || loadPayConfig();
  const payService = options.payService || createVirtualPayService({ config: payConfig });
  // 会话 token 从请求头拿，避免出现在 URL 里被日志记下来
  const sessionOf = request => payService.resolveSession(String(request.headers['x-session-token'] || ''));

  const server = require('node:http').createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Session-Token');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (request.method === 'OPTIONS') return response.writeHead(204).end();
    const url = new URL(request.url, 'http://localhost');
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return sendJson(response, 200, { ok: true, service: SERVICE_NAME, time: new Date().toISOString(), virtualPay: payService.status() });
      }
      if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
        return sendJson(response, 200, store.ranking({ clientId: url.searchParams.get('clientId') || '', limit: url.searchParams.get('limit') || 20 }));
      }
      if (request.method === 'GET' && url.pathname === '/api/tigerboard') {
        return sendJson(response, 200, store.assetRanking({ clientId: url.searchParams.get('clientId') || '', limit: url.searchParams.get('limit') || 20 }));
      }
      if (request.method === 'GET' && url.pathname === '/api/escapeboard') {
        return sendJson(response, 200, store.escapeRanking({ clientId: url.searchParams.get('clientId') || '', limit: url.searchParams.get('limit') || 20 }));
      }
      if (request.method === 'POST' && url.pathname === '/api/leaderboard/submit') {
        const result = await store.submit(await readJsonBody(request));
        return sendJson(response, 200, result);
      }
      if (request.method === 'POST' && url.pathname === '/api/tigerboard/submit') {
        const result = await store.submit(await readJsonBody(request));
        return sendJson(response, 200, result);
      }
      if (request.method === 'POST' && url.pathname === '/api/escapeboard/submit') {
        const result = await store.submit(await readJsonBody(request));
        return sendJson(response, 200, result);
      }

      // ── 虚拟支付 ──────────────────────────────────────────────────
      // 未配置环境变量时全部返回 503，小程序端据此隐藏购买入口。
      if (request.method === 'GET' && url.pathname === '/api/pay/status') {
        return sendJson(response, 200, { ok: true, ...payService.status() });
      }
      // 后台保存消息推送地址时会用 GET 发 echostr；仅签名正确才原样返回。
      if (request.method === 'GET' && url.pathname === '/api/pay/notify') {
        if (!payService.enabled()) return sendText(response, 503, 'virtual pay disabled');
        const valid = verifyMessageSignature(
          payService.config.messageToken,
          url.searchParams.get('signature'),
          url.searchParams.get('timestamp'),
          url.searchParams.get('nonce'),
        );
        return valid ? sendText(response, 200, url.searchParams.get('echostr') || '') : sendText(response, 403, 'invalid signature');
      }
      if (url.pathname.startsWith('/api/pay/') && !payService.enabled()) {
        return sendJson(response, 503, { ok: false, error: 'virtual_pay_disabled', missing: payService.config.missing });
      }
      if (request.method === 'POST' && url.pathname === '/api/pay/login') {
        const body = await readJsonBody(request);
        const result = await payService.login(body.code);
        return sendJson(response, result.ok ? 200 : 400, result);
      }
      // 平台消息推送（发货 / 退款 / 其他）：必须返回 XML，否则平台会重试（最多 15 次）
      if (request.method === 'POST' && url.pathname === '/api/pay/notify') {
        const valid = verifyMessageSignature(
          payService.config.messageToken,
          url.searchParams.get('signature'),
          url.searchParams.get('timestamp'),
          url.searchParams.get('nonce'),
        );
        if (!valid) return sendText(response, 403, 'invalid signature');
        const xml = await readTextBody(request);
        // verified=true：签名已校验，这条推送确实来自微信。
        // 查单只是交叉核对，查不出结论时不能卡单（query_order 状态同步可能延迟几十分钟）。
        const result = await payService.handleNotify(xml, { verified: true });
        return sendXml(response, 200, deliverNotifyResponse(result.ok ? 0 : 1, result.errMsg || (result.ok ? 'success' : 'failed')));
      }
      if (request.method === 'POST' && url.pathname === '/api/pay/order') {
        const session = sessionOf(request);
        if (!session) return sendJson(response, 401, { ok: false, error: 'login_required' });
        const body = await readJsonBody(request).catch(() => ({}));
        // quantity 在 createOrder 里重新夹取范围，这里的职责只是透传
        return sendJson(response, 200, payService.createOrder(session, body.quantity));
      }
      if (request.method === 'GET' && url.pathname === '/api/pay/balance') {
        const session = sessionOf(request);
        if (!session) return sendJson(response, 401, { ok: false, error: 'login_required' });
        return sendJson(response, 200, { ok: true, ...payService.balanceOf(session.openid) });
      }
      if (request.method === 'POST' && url.pathname === '/api/pay/consume') {
        const session = sessionOf(request);
        if (!session) return sendJson(response, 401, { ok: false, error: 'login_required' });
        const body = await readJsonBody(request);
        return sendJson(response, 200, await payService.consume(session.openid, body.scene));
      }
      // 兜底查单：属于运维动作，必须带 WX_PAY_ADMIN_TOKEN，未配置则关闭
      if (request.method === 'POST' && url.pathname === '/api/pay/sweep') {
        const adminToken = String(process.env.WX_PAY_ADMIN_TOKEN || '');
        const suppliedToken = request.headers['x-pay-admin-token'] || request.headers['x-admin-token'];
        if (!adminToken || suppliedToken !== adminToken) return sendJson(response, 403, { ok: false, error: 'forbidden' });
        return sendJson(response, 200, await payService.sweepPending());
      }

      return sendJson(response, 404, { ok: false, error: 'not_found' });
    } catch (error) {
      const status = /required|invalid|large/.test(error.message) ? 400 : 500;
      return sendJson(response, status, { ok: false, error: error.message });
    }
  });
  server.store = store;
  server.payService = payService;
  server.payConfig = payConfig;
  // 兜底查单定时器：后台常驻，测试里传 startSweep:false 关掉
  if (options.startSweep !== false && payService.enabled()) {
    server.sweepTimer = setInterval(() => {
      payService.sweepPending().catch(error => console.warn('[xpay] 兜底查单异常', error.message));
    }, options.sweepIntervalMs || SWEEP_INTERVAL_MS);
    if (server.sweepTimer.unref) server.sweepTimer.unref();
  }
  return server;
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

if (require.main === module) {
  const port = clamp(process.env.PORT || 18787, 1, 65535);
  createApiServer().listen(port, '127.0.0.1', () => console.log(`${SERVICE_NAME} listening on 127.0.0.1:${port}`));
}

module.exports = {
  RANKS, LEADERBOARD_HONOR_RANK, LEADERBOARD_LEADER_RANK, WORK_START_AGE, workYearsFromAge, normalizeSubmission, leaderboardRankIndexOf,
  compareEntries, assetValueOf, compareAssetEntries, confiscatedValueOf, tigerEntryOf, compareTigerEntries, compareEscapeEntries, publicEscapeEntry, createStore, createApiServer,
};
