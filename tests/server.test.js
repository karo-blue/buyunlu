const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const server = require('../server/app');
const vp = require('../server/virtual-pay');

test('服务端只在全部硬门槛成立时接受领导者排行档位', () => {
  const eligible = {
    clientId: 'leader', name: '周慎行', rankIndex: 11, rankYears: 3, age: 65,
    achievements: 140, review: 100, integrity: 100, reputation: 100, health: 80,
    illicitIncome: 0, faultHelpUsedYear: 0, honor: '人民公仆', leader: true,
  };
  const leader = server.normalizeSubmission(eligible);
  assert.equal(leader.leader, true);
  assert.equal(server.leaderboardRankIndexOf(leader), 13);
  for (const change of [{ rankYears: 2 }, { achievements: 119 }, { review: 94 }, { integrity: 99 },
    { reputation: 97 }, { health: 59 }, { illicitIncome: 1 }, { faultHelpUsedYear: 2030 }, { honor: '' }]) {
    assert.equal(server.normalizeSubmission(Object.assign({}, eligible, change)).leader, false, JSON.stringify(change));
  }
});

function httpCall(port, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('a fresh store starts empty and legacy sample rows are purged on load', async () => {
  // 早期版本会灌 7342 条随机样本做冷启动，榜上全是假名字。
  // 现在要么是空榜，要么只有真实提交；旧数据文件里的样本要在读入时被洗掉。
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-clean-')), 'leaderboard.json');
  const legacy = [
    { id: 'sample-1', clientId: 'sample-1', name: '周知行', rankIndex: 5, rankYears: 2, achievements: 30, review: 80, integrity: 90, age: 40, position: '副厅级', assetValue: 1000000, isSample: true },
    { id: 'sample-2', clientId: 'sample-2', name: '沈明远', rankIndex: 3, rankYears: 1, achievements: 12, review: 75, integrity: 88, age: 33, position: '副科级', assetValue: 300000, isSample: true },
    { id: 'real-1', clientId: 'real-1', name: '林知行', rankIndex: 6, rankYears: 3, achievements: 44, review: 88, integrity: 95, age: 45, position: '正处级', assetValue: 800000 },
  ];
  fs.writeFileSync(file, JSON.stringify(legacy), 'utf8');
  const store = server.createStore(file);
  const ranked = store.ranking({});
  assert.equal(ranked.total, 1, '样本必须在读入时被清掉，只留真实记录');
  assert.equal(ranked.entries[0].name, '林知行');
  assert.equal(ranked.entries[0].isPlayer, false);
  const tiger = store.assetRanking({});
  assert.equal(tiger.total, 0, '没有落马记录就没有老虎榜');
  // 清理要落盘：重新开一个实例读同一个文件，样本不会再回来
  const reopened = server.createStore(file);
  assert.equal(reopened.ranking({}).total, 1);
});

test('message push callback echoes only requests signed with the configured token', async () => {
  const token = 'message-token-123';
  const payService = {
    config: { messageToken: token, missing: [] },
    enabled: () => true,
    status: () => ({ enabled: true }),
  };
  const api = server.createApiServer({ payService, startSweep: false });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  try {
    const port = api.address().port;
    const timestamp = '1789012345';
    const nonce = 'nonce-456';
    const signature = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex');
    const valid = await httpCall(port, `/api/pay/notify?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}&echostr=verified`);
    assert.deepEqual(valid, { status: 200, body: 'verified' });
    const invalid = await httpCall(port, `/api/pay/notify?signature=bad&timestamp=${timestamp}&nonce=${nonce}&echostr=verified`);
    assert.equal(invalid.status, 403);
  } finally {
    await new Promise(resolve => api.close(resolve));
  }
});

// 端到端锁住这条接线：app.js 验签通过后必须把 verified 传给底层，
// 否则"查单状态滞后"这一档会在真实链路上把发货卡死（付了钱拿不到卡）。
test('a signed delivery notify is honoured even while query_order still lags behind', async () => {
  const token = 'message-token-123';
  const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-notify-')), 'virtual-pay.json');
  const config = vp.loadConfig({
    WX_APPID: 'wx-test-appid', WX_APPSECRET: 'test-appsecret', WX_XPAY_OFFER_ID: 'offer-1234',
    WX_XPAY_APP_KEY: 'appkey-prod', WX_XPAY_PRODUCT_ID: 'adcard10', WX_MESSAGE_TOKEN: token,
    WX_PAY_DATA_FILE: dataFile,
  });
  const payService = vp.createVirtualPayService({
    config,
    store: vp.createPayStore(dataFile),
    logger: { warn() {}, log() {} },
    fetchImpl: async url => {
      const respond = payload => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
      if (String(url).includes('/cgi-bin/token')) return respond({ access_token: 'AT', expires_in: 7200 });
      if (String(url).includes('/sns/jscode2session')) return respond({ openid: 'oUser001', session_key: 'SESSION_KEY_001' });
      // 微信真实的返回体：订单在 order 子对象里，且状态还停在"已创建未支付"
      if (String(url).includes('/xpay/query_order')) return respond({ errcode: 0, errmsg: '', order: { order_id: 'X', status: 1 } });
      return respond({ errcode: 0 });
    },
  });
  const logged = await payService.login('wx-login-code');
  assert.equal(logged.ok, true);
  const order = payService.createOrder(payService.resolveSession(logged.token), 1);
  const api = server.createApiServer({ payService, startSweep: false });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  try {
    const port = api.address().port;
    const timestamp = '1789012345';
    const nonce = 'nonce-789';
    const signature = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex');
    const xml = '<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oUser001</OpenId>'
      + `<OutTradeNo>${order.outTradeNo}</OutTradeNo><WeChatPayInfo><MchOrderNo>WX-E2E</MchOrderNo></WeChatPayInfo>`
      + '<GoodsInfo><ProductId>adcard10</ProductId><Quantity>1</Quantity></GoodsInfo></xml>';
    const response = await postXml(port, `/api/pay/notify?signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`, xml);
    assert.equal(response.status, 200);
    assert.match(response.body, /<ErrCode>0<\/ErrCode>/, '验签通过的推送必须回成功，不能让平台一直重试');
    assert.equal(payService.balanceOf('oUser001').balance, 10, '钱付了卡就必须到账');
    assert.equal(payService.store.ensureLoaded().orders[order.outTradeNo].status, 'delivered');
  } finally {
    await new Promise(resolve => api.close(resolve));
  }
});

function postXml(port, requestPath, xml) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(xml, 'utf8');
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'POST', headers: { 'Content-Type': 'application/xml', 'Content-Length': body.length } }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: text }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

test('server ranking inserts and updates a player by client id', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-board-')), 'leaderboard.json');
  const store = server.createStore(file);
  const submitted = await store.submit({
    clientId: 'client-test', name: '高植物', rankIndex: 11, rankYears: 0,
    achievements: 100, review: 100, integrity: 100, age: 65,
  });
  assert.equal(submitted.rank, 1);
  assert.equal(submitted.total, 1);
  const again = await store.submit({
    clientId: 'client-test', name: '高植物', rankIndex: 1, rankYears: 0,
    achievements: 0, review: 60, integrity: 100, age: 22,
  });
  assert.equal(again.rank, 1, 'a worse duplicate submission must not replace the best result');
  const loaded = store.ranking({ clientId: 'client-test', limit: 3 });
  assert.equal(loaded.entries[0].name, '高植物');
  assert.equal(loaded.entries[0].isPlayer, true);
});

test('server ranking returns the players right above and below, not just the top list', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-board-')), 'leaderboard.json');
  const store = server.createStore(file);
  // 三名玩家，按政绩从高到低应是 甲 > 乙 > 丙；只看丙的前后位
  for (const [clientId, name, achievements] of [['a', '甲知行', 90], ['b', '乙知行', 60], ['c', '丙知行', 30]]) {
    await store.submit({ clientId, name, rankIndex: 5, rankYears: 1, achievements, review: 80, integrity: 90, age: 40 });
  }
  const view = store.ranking({ clientId: 'c', limit: 1 });
  assert.deepEqual(view.entries.map(item => `${item.rank}.${item.name}`), ['1.甲知行', '2.乙知行', '3.丙知行']);
  assert.equal(view.entries.find(item => item.name === '乙知行').isPlayer, false, '上一位是别人');
  assert.equal(view.entries.find(item => item.name === '丙知行').isPlayer, true);
  assert.equal(view.rank, 3);
  assert.equal(view.total, 3);
  // 玩家冲进前三后，前后位与前列合并去重，不会把同一个人列两遍
  const top = store.ranking({ clientId: 'c', limit: 3 });
  assert.equal(top.entries.length, 3);
});

test('server tiger board keeps only fallen players and accepts a higher confiscation amount', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-tiger-')), 'leaderboard.json');
  const store = server.createStore(file);
  const first = await store.submit({ clientId: 'tiger-test', name: '高植物', rankIndex: 8, rankYears: 4, age: 49, position: '县处级正职', fell: true, assetValue: 120000, confiscatedValue: 120000 });
  assert.equal(first.total, 1);
  const second = await store.submit({ clientId: 'tiger-test', name: '高植物', rankIndex: 8, rankYears: 4, age: 49, position: '县处级正职', fell: true, assetValue: 5000000000, confiscatedValue: 5000000000 });
  assert.equal(second.total, 1);
  const result = store.assetRanking({ clientId: 'tiger-test', limit: 3 });
  assert.equal(result.rank, 1);
  // 老虎榜不能掺假数据：查处财产是指控性内容，只认真实落马的提交
  assert.equal(result.total, 1, '只有真实落马的提交，样本不该出现在老虎榜');
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].confiscatedValue, 5000000000);
  assert.equal(result.entries[0].position, '县处级正职');
  assert.equal(result.entries[0].rankYears, 4);
  assert.equal(result.entries[0].workYears, 27);
  assert.equal(result.entries[0].isPlayer, true);
});

test('老虎榜总工作年限优先读上报值，旧记录按落马年龄倒推', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-workyears-')), 'leaderboard.json');
  const store = server.createStore(file);
  await store.submit({ clientId: 'wy-explicit', name: '沈明远', rankIndex: 8, rankYears: 2, workYears: 33, age: 55, position: '正厅级', fell: true, confiscatedValue: 8000000 });
  await store.submit({ clientId: 'wy-legacy', name: '林知行', rankIndex: 8, rankYears: 4, age: 49, position: '县处级正职', fell: true, confiscatedValue: 5000000 });
  const result = store.assetRanking({ clientId: 'wy-explicit', limit: 10 });
  assert.deepEqual(result.entries.map(entry => entry.workYears).sort((a, b) => a - b), [27, 33]);
});

test('server exposes the tiger board through its public API route', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-tiger-api-')), 'leaderboard.json');
  const store = server.createStore(file);
  await store.submit({ clientId: 'tiger-api-test', name: '高植物', rankIndex: 8, rankYears: 4, age: 49, position: '县处级正职', fell: true, assetValue: 5000000000, confiscatedValue: 5000000000 });
  const api = server.createApiServer({ store, payService: { enabled: () => false, status: () => ({ enabled: false }), resolveSession: () => null }, startSweep: false });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  try {
    const response = await httpCall(api.address().port, '/api/tigerboard?clientId=tiger-api-test&limit=3');
    assert.equal(response.status, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.rank, 1);
    assert.equal(payload.entries[0].confiscatedValue, 5000000000);
  } finally {
    await new Promise(resolve => api.close(resolve));
  }
});

test('服务端金蝉榜按携带现金排序，公开结果不含具体职位和工作年限', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-escape-')), 'leaderboard.json');
  const store = server.createStore(file);
  await store.submit({ clientId: 'escape-a', name: '甲知行', rankIndex: 8, rankYears: 20, workYears: 33, position: '不应公开的岗位甲', escaped: true, escapeMethod: 'ship', escapeAmount: 8000000 });
  await store.submit({ clientId: 'escape-b', name: '乙知行', rankIndex: 11, rankYears: 10, workYears: 40, position: '不应公开的岗位乙', escaped: true, escapeMethod: 'train', escapeAmount: 3000000 });
  await store.submit({ clientId: 'normal', name: '正常玩家', rankIndex: 9, achievements: 50, review: 90, integrity: 90 });
  const result = store.escapeRanking({ clientId: 'escape-b', limit: 8 });
  assert.equal(result.total, 2);
  assert.deepEqual(result.entries.map(entry => entry.name), ['甲知行', '乙知行']);
  assert.equal(result.rank, 2);
  assert.equal(result.entries[0].escapeAmount, 8000000);
  for (const entry of result.entries) {
    assert.equal(Object.hasOwn(entry, 'position'), false);
    assert.equal(Object.hasOwn(entry, 'workYears'), false);
    assert.equal(Object.hasOwn(entry, 'rankYears'), false);
  }
  assert.equal(store.ranking({}).total, 1, '出逃结局只进入金蝉榜');
  assert.equal(store.assetRanking({}).total, 0);
});

test('server exposes the escape board through its public API route', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-escape-api-')), 'leaderboard.json');
  const store = server.createStore(file);
  await store.submit({ clientId: 'escape-api', name: '林知行', rankIndex: 8, escaped: true, escapeMethod: 'plane', escapeAmount: 765432 });
  const api = server.createApiServer({ store, payService: { enabled: () => false, status: () => ({ enabled: false }), resolveSession: () => null }, startSweep: false });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  try {
    const response = await httpCall(api.address().port, '/api/escapeboard?clientId=escape-api&limit=8');
    assert.equal(response.status, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.rank, 1);
    assert.equal(payload.entries[0].escapeMethod, 'plane');
    assert.equal(payload.entries[0].escapeAmount, 765432);
  } finally {
    await new Promise(resolve => api.close(resolve));
  }
});

test('submission values are clamped and names are safe for public display', () => {
  const entry = server.normalizeSubmission({
    clientId: 'x'.repeat(300), name: '<script>高植物\n', rankIndex: 999,
    age: -1, rankYears: 999, achievements: -3, review: 999, integrity: -8,
  });
  assert.equal(entry.clientId.length, 128);
  assert.equal(entry.name, 'script高植');
  assert.equal(entry.rankIndex, 11);
  assert.equal(entry.age, 18);
  assert.equal(entry.achievements, 0);
  assert.equal(entry.integrity, 0);
  assert.equal(entry.fell, false);
});

test('落马的成绩一律归零，并且会覆盖掉落马之前的高分', async () => {
  // 服务端不信任客户端：即使有人绕过界面直接提交，落马也必须归零
  const entry = server.normalizeSubmission({
    clientId: 'fallen', name: '林知行', rankIndex: 11, rankYears: 9,
    achievements: 999, review: 100, integrity: 100, fell: true,
  });
  assert.equal(entry.fell, true);
  assert.equal(entry.rankIndex, 1);
  assert.equal(entry.rankYears, 0);
  assert.equal(entry.achievements, 0);
  assert.equal(entry.review, 0);
  assert.equal(entry.integrity, 0);
  assert.equal(entry.position, '落马被查');

  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buyunlu-fall-')), 'leaderboard.json');
  const store = server.createStore(file);
  const best = await store.submit({
    clientId: 'fallen', name: '林知行', rankIndex: 11, rankYears: 2,
    achievements: 100, review: 100, integrity: 100, age: 60,
  });
  assert.equal(best.rank, 1);
  const fell = await store.submit({
    clientId: 'fallen', name: '林知行', rankIndex: 11, rankYears: 2,
    achievements: 100, review: 100, integrity: 100, age: 61, fell: true,
  });
  // 落马提交必须能覆盖此前的高分（归零后名次数字可能仍是第 1，
  // 因为榜上只有他自己，但榜上挂着的必须是归零后的那条记录）
  assert.equal(fell.rank, 1);
  const loaded = store.ranking({ clientId: 'fallen', limit: 3 });
  const self = store.ranking({ clientId: 'fallen', limit: 100 }).entries.find(item => item.isPlayer);
  assert.equal(self.fell, true);
  assert.equal(self.position, '落马被查');
  assert.equal(self.rankIndex, 1);
  // 旧版榜上有 7342 条样本垫底，落马者会被挤到末尾单独附上；
  // 现在榜上只有他自己，榜面第一条就是归零后的那条记录 —— 这就是真实状态。
  assert.equal(loaded.entries[0].isPlayer, true);
  assert.equal(loaded.entries[0].fell, true);
  assert.equal(loaded.entries[0].rank, 1);
});

test('部署包必须包含 server/app.js 依赖的每一个本地模块', () => {
  const fs = require('node:fs');
  const projectRoot = path.join(__dirname, '..');
  const appSource = fs.readFileSync(path.join(projectRoot, 'server', 'app.js'), 'utf8');
  const deployScript = fs.readFileSync(path.join(projectRoot, 'deploy-server.ps1'), 'utf8');

  // app.js 里 require('./x') 的每一个本地模块
  const required = [...new Set([...appSource.matchAll(/require\('\.\/([^']+)'\)/g)].map(match => match[1]))];
  assert.ok(required.includes('virtual-pay'), '前提：支付服务是按文件名相对引入的');

  const listMatch = deployScript.match(/\$serverFiles\s*=\s*@\(([^)]*)\)/);
  assert.ok(listMatch, 'deploy-server.ps1 里应当有一张显式的打包文件清单 $serverFiles');
  const packaged = [...listMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(packaged.includes('app.js'));

  required.forEach(name => {
    const fileName = name.endsWith('.js') ? name : `${name}.js`;
    assert.ok(
      packaged.includes(fileName),
      `server/app.js 依赖 ${fileName}，但 deploy-server.ps1 的打包清单里没有它 —— 漏传会让远端服务启动即退出，排行榜一起挂掉`
    );
  });
});

test('支付补单接口接受文档约定的管理请求头', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'app.js'), 'utf8');
  assert.match(source, /x-pay-admin-token/);
});

test('远端脚本在解包后真的 require 一遍 app.js，而不是只做语法检查', () => {
  const fs = require('node:fs');
  const remote = fs.readFileSync(path.join(__dirname, '..', 'server', 'deploy-remote.sh'), 'utf8');
  assert.match(remote, /node -e "require\('\.\/app\.js'\)"/, '语法检查拦不住漏传模块，必须真正加载一次');
});

test('支付安装不会被部署脚本的非零退出码吞掉', () => {
  const fs = require('node:fs');
  const ps1 = fs.readFileSync(path.join(__dirname, '..', 'deploy-server.ps1'), 'utf8');
  // 远程命令开头是 set -e，部署脚本一失败 shell 就终止，pay.env 永远装不上。
  // 必须先把退出码收进变量，装完支付再用原码退出。
  assert.match(ps1, /\|\| DEPLOY_RC=/, '部署脚本失败时要捕获退出码，而不是让 set -e 终止整个 shell');
  assert.ok(ps1.includes('DEPLOY_RC:-0'), '捕获之后要用原退出码退出，真失败才报得出来');
  // 本机 --resolve 到 127.0.0.1:443 的探活在 BaoTa 多 HTTPS block 时会误报 502，
  // 此时以公网校验结果为准，不能把整次部署判死。
  assert.match(ps1, /\$deployExit -eq 10/, 'exit 10（本机 HTTPS 探活失败）应按公网校验结果处理');
  // 不带 -ConfigurePayment 的普通部署同样会撞上这个误报（实测：服务健康、nginx 已重载，
  // 但脚本报 "Remote deployment failed, exit code 10"）。两条分支都要处理，
  // 否则每次发版都显示失败，用户会被误导以为没部署上去。
  const exit10Handled = ps1.match(/\$deployExit -eq 10/g) || [];
  assert.equal(exit10Handled.length, 2, '支付分支与普通分支都要处理 exit 10');
  assert.match(ps1, /\$healthUrl/, '普通分支要用公网 health 端点复核');
});

test('支付配置脚本不写死端口，且装成功后一定交出消息推送 Token', () => {
  const fs = require('node:fs');
  const ps1 = fs.readFileSync(path.join(__dirname, '..', 'configure-payment.ps1'), 'utf8');
  // 部署时 18787 被占用会漂到 28787，写死就会"装成功但校验失败"，还会把 Token 吞掉
  assert.doesNotMatch(ps1, /127\.0\.0\.1:18787/, '端口要从 systemd 单元读，不能写死 18787');
  assert.match(ps1, /systemctl show -p Environment/, '端口应从 systemd 单元的 Environment 读取');
  // 退出码要能区分"没装上(9/11)"和"装上了但校验没过(12)"
  assert.match(ps1, /exit 12/);
  assert.match(ps1, /\$exit -eq 12/, '12 = 已写入但校验没过，此时 Token 已生效');
  assert.match(ps1, /Message push Token/, '消息推送 Token 必须交给用户，配微信后台回调要用');
});

test('支付配置脚本解码 pay.env 能容忍 PowerShell 管道带来的 CRLF，且空内容不会覆盖线上配置', () => {
  const fs = require('node:fs');
  const ps1 = fs.readFileSync(path.join(__dirname, '..', 'configure-payment.ps1'), 'utf8');

  // PowerShell 把字符串管道给 ssh 时结尾是 \r\n，GNU base64 -d 见到 \r 直接
  // "base64: invalid input" 退出（rc=1），pay.env 一个字节都写不进去。
  // deploy-server.ps1 一直带着 --ignore-garbage 所以没出过这事。
  // 注释里会提到"裸的 base64 -d"长什么样，检查前先把注释行剥掉，只看真正执行的代码
  const code = ps1.split(/\r?\n/).filter(line => !/^\s*#/.test(line)).join('\n');
  assert.match(
    code,
    /base64 -d --ignore-garbage/,
    'base64 -d 必须带 --ignore-garbage，否则 PowerShell 的 CRLF 会让解码直接失败'
  );
  assert.doesNotMatch(code, /base64 -d(?! --ignore-garbage)/, '不允许再出现裸的 base64 -d');

  // 反过来：--ignore-garbage 会把坏输入静默解成空文件。
  // 写入 pay.env 前必须先校验内容，否则一次解码事故就会清空线上正在用的支付配置。
  const writeChain = ps1.match(/base64 -d --ignore-garbage > [^\n]*?(?=; PAY_PORT)/);
  assert.ok(writeChain, '应能在远程命令里定位到写 pay.env 的那一段');
  assert.match(writeChain[0], /grep -q '\^WX_APPSECRET='/, 'mv 之前要校验解码结果非空');
  assert.match(writeChain[0], /grep -q '\^WX_XPAY_APP_KEY='/, 'mv 之前要校验关键字段存在');
  assert.match(writeChain[0], /\|\| \{[^}]*exit 11/, '校验不通过要 exit 11 且不动原文件');
});

test('支付配置脚本把远程脚本交给 bash -s（走 stdin），密钥内联而不是管道喂', () => {
  const fs = require('node:fs');
  const ps1 = fs.readFileSync(path.join(__dirname, '..', 'configure-payment.ps1'), 'utf8');

  // 把长命令当 ssh 的 argv 传，会被 PowerShell 5.1 的原生参数引号处理吞掉：
  // 实测表现为 SSH 只打印 MOTD 就退出、退出码仍是 0，脚本误报"安装成功"，
  // 而服务器上 pay.env 一个字节都没变（日志里连 systemctl restart 都没有）。
  assert.match(
    ps1,
    /ssh\.exe[^\n]*'bash -s'/,
    '远程脚本必须经 stdin 交给 bash -s，不能作为 ssh 的命令行参数'
  );
  // PowerShell 管道结尾是 CRLF，把 payload 从 stdin 喂进去会让 base64 -d 直接失败。
  // 密钥内联进脚本（printf '%s' <b64>）就彻底绕开这件事。
  assert.match(ps1, /printf '%s' '\$payload'/, 'pay.env 内容必须内联在脚本里');
  // 同理，PS 追加的 CR 会挂在最后一个命令上（exit 0\r），用注释收尾把它吃掉。
  assert.match(ps1, /exit 0 #"/, '远程脚本必须以注释结尾，吞掉 PowerShell 追加的 CR');
});
