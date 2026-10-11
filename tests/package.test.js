const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('main package enables required-component lazy loading', () => {
  const app = JSON.parse(read('app.json'));
  assert.equal(app.lazyCodeLoading, 'requiredComponents');
});

test('development-only files are excluded from the main package', () => {
  const project = JSON.parse(read('project.config.json'));
  const ignored = new Set((project.packOptions.ignore || []).map(item => `${item.type}:${item.value}`));
  ['folder:tests', 'folder:tools', 'folder:server', 'folder:.workbuddy', 'file:deploy-server.ps1', 'file:deploy-server.bat', 'file:deploy-all.bat', 'file:configure-payment.ps1', 'file:configure-payment.bat', 'file:verify-payment-release.ps1', 'file:verify-payment-release.bat', 'file:PAYMENT-DEPLOYMENT-CHECKLIST.md', 'file:package.json', 'file:README.md', 'file:project.private.config.json'].forEach(item => assert.ok(ignored.has(item), item));
});

test('one-click deployment enables payment configuration in the same SSH run', () => {
  const batch = read('deploy-all.bat');
  const deploy = read('deploy-server.ps1');
  assert.match(batch, /deploy-server\.ps1" -ConfigurePayment/);
  assert.match(deploy, /\[switch\]\$ConfigurePayment/);
  assert.match(deploy, /WX_MESSAGE_TOKEN/);
  assert.match(deploy, /\.pay\.env/);
});

test('remote deployment verifies and resolves the extracted runner before executing it', () => {
  const deploy = read('deploy-server.ps1');
  assert.match(deploy, /archive is missing deploy-remote\.sh/);
  assert.match(deploy, /find .*deploy-remote\.sh/);
  assert.match(deploy, /chmod 700 .*deploy-remote\.sh/);
  assert.doesNotMatch(deploy, /^#.*\$serverFiles/m, 'Windows PowerShell must not comment out the archive file list');
});

test('payment release verifier checks the production route and official fixed requirements', () => {
  const verifier = read('verify-payment-release.ps1');
  const checklist = read('PAYMENT-DEPLOYMENT-CHECKLIST.md');
  assert.match(verifier, /buyunlu-api\/pay\/status/);
  assert.match(verifier, /enabled/);
  assert.match(verifier, /env[^\r\n]*0/);
  assert.match(verifier, /project\.appid/);
  assert.match(checklist, /个人主体/);
  assert.match(checklist, /每月累计支付金额上限[^\r\n]*100,000/);
  assert.match(checklist, /wx_order_id/);
  assert.match(checklist, /Android[^\r\n]*1%/);
  assert.match(checklist, /iOS[^\r\n]*12%/);
  assert.match(checklist, /真机小额/);
});

test('server deployment targets the active BaoTa nginx instance when present', () => {
  const deploy = read('server/deploy-remote.sh');
  assert.match(deploy, /\/www\/server\/nginx\/sbin\/nginx/);
  assert.match(deploy, /\/www\/server\/panel\/vhost\/nginx/);
  assert.match(deploy, /\/www\/server\/nginx\/conf/);
  assert.match(deploy, /nginx: master process/);
  assert.match(deploy, /kill -HUP/);
  assert.match(deploy, /port_is_free/);
  assert.match(deploy, /buyunlu-leaderboard/);
});

test('release checks stay enabled in project settings', () => {
  const project = JSON.parse(read('project.config.json'));
  assert.equal(fs.existsSync(path.join(root, 'project.private.config.json')), false);
  assert.equal(project.setting.urlCheck, true);
});

test('page config contains only supported share settings and ad listeners are singleton-bound', () => {
  const pageConfig = read('pages/index/index.json');
  const page = read('pages/index/index.js');
  assert.doesNotMatch(pageConfig, /enableShareAppMessage|enableShareTimeline/);
  assert.match(page, /__buyunluBound/);
  assert.match(page, /const patch = this\.buildPatch\(state\)/);
  assert.match(page, /wx\.nextTick\(openNameSelect\)/);
});

test('rewarded-video listeners are cleaned up before hot reload rebinds them', () => {
  const page = read('pages/index/index.js');
  assert.match(page, /function clearRewardedAd\(\)/);
  assert.match(page, /videoAd\.offLoad\(videoAdHandlers\.load\)/);
  assert.match(page, /videoAd\.offError\(videoAdHandlers\.error\)/);
  assert.match(page, /videoAd\.offClose\(videoAdHandlers\.close\)/);
});

test('leaderboard is bundled while audio implementation stays absent', () => {
  assert.equal(fs.existsSync(path.join(root, 'services/leaderboard.js')), true);
  ['services/audio.js', 'cloudfunctions/retirement-rank'].forEach(file => {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  });
  const page = read('pages/index/index.js');
  assert.match(page, /showLeaderboard/);
  assert.match(page, /onShareAppMessage/);
  assert.doesNotMatch(page, /createInnerAudioContext|toggleMusic|playClick|playYear/);
});

test('restored original interaction details remain wired into the page', () => {
  const page = read('pages/index/index.js');
  const template = read('pages/index/index.wxml');
  assert.match(page, /暂时专注个人成长/);
  assert.match(page, /showStats\(\)/);
  assert.match(page, /positionUnlockText/);
  assert.match(page, /触发监督核查程序|core\.startQuarter/);
  assert.match(template, /class="promotion-button"[^>]*bindtap="showPromotionPath"/);
  assert.match(template, /promotion-status/);
  assert.match(template, /bindtap="handleMetricAction"/);
  assert.match(page, /请领导拉一把/);
  assert.match(template, /bindinput="dialogAmountInput"/);
  assert.match(page, /shareFaultHelp/);
  assert.doesNotMatch(page, /faultHelpAdUnitId/);
  assert.doesNotMatch(page, /成功后另有1%至10%|金额达到100万元时为10%/);
  assert.match(page, /faultHelpUsedYear/);
});

test('all dialogs are in-page and action choices can expand and wrap', () => {
  const page = read('pages/index/index.js');
  const template = read('pages/index/index.wxml');
  const style = read('pages/index/index.wxss');
  assert.doesNotMatch(page, /wx\.showModal|wx\.showActionSheet/);
  assert.match(template, /dialog-mask/);
  assert.match(template, /dialog-content-scroll/);
  assert.match(template, /dialog-option-label/);
  assert.match(template, /<view class="dialog-options">/);
  assert.doesNotMatch(template, /active-actions/, 'navigation actions should be presented in the popup');
  assert.match(template, /nameselect-scroll[^>]*scroll-y/);
  assert.match(template, /nameselect-backdrop[^>]*catchtouchmove/);
  assert.match(template, /nameselect-error/);
  assert.match(template, /range="\{\{nameSelect\.surnames\}\}"/);
  assert.match(template, /bindchange="selectSurname"/);
  assert.match(template, /bindtap="refreshNameChoices"/);
  assert.match(page, /请选择下方的候选角色名/);
  assert.doesNotMatch(template, /bindinput="onCustomNameInput"/);
  assert.match(template, /careerTitle/);
  assert.doesNotMatch(template, /class="career-position"/);
  assert.match(style, /\.nameselect-card\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(style, /\.nameselect-chip\s*\{[^}]*flex:\s*0\s+0\s+calc\(33\.333%/s);
  ['primary-button-label', 'event-option', 'event-option-label'].forEach(selector => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = style.match(new RegExp(`\\.${escaped}\\s*\\{[^}]*\\}`, 's'));
    assert.ok(rule, selector);
    assert.doesNotMatch(rule[0], /text-overflow:\s*ellipsis|white-space:\s*nowrap/);
  });
  const dialogOptionRule = style.match(/\.dialog-option\s*\{[^}]*\}/s);
  assert.ok(dialogOptionRule, 'dialog-option');
  assert.match(dialogOptionRule[0], /width:\s*100%/);
  assert.match(dialogOptionRule[0], /width:\s*100%\s*!important/);
  assert.match(dialogOptionRule[0], /min-height:\s*84rpx/);
  assert.match(dialogOptionRule[0], /white-space:\s*normal/);
  const dialogOptionLabelRule = style.match(/\.dialog-option-label\s*\{[^}]*\}/s);
  assert.ok(dialogOptionLabelRule, 'dialog-option-label');
  assert.match(dialogOptionLabelRule[0], /white-space:\s*normal/);
  assert.match(dialogOptionLabelRule[0], /text-overflow:\s*clip/);
  assert.match(dialogOptionRule[0], /box-sizing:\s*border-box/);
  const dialogCancelRule = style.match(/\.dialog-cancel\s*\{[^}]*\}/s);
  assert.ok(dialogCancelRule, 'dialog-cancel');
  assert.match(dialogCancelRule[0], /display:\s*flex/);
  assert.match(dialogCancelRule[0], /align-items:\s*center/);
  assert.match(dialogCancelRule[0], /justify-content:\s*center/);
  const dialogCardRule = style.match(/\.dialog-card\s*\{[^}]*\}/s);
  assert.ok(dialogCardRule, 'dialog-card');
  assert.match(dialogCardRule[0], /display:\s*flex/);
  assert.match(dialogCardRule[0], /flex-direction:\s*column/);
  const dialogContentRule = style.match(/\.dialog-content-scroll\s*\{[^}]*\}/s);
  assert.ok(dialogContentRule, 'dialog-content-scroll');
  assert.match(dialogContentRule[0], /min-height:\s*0/);
  assert.match(dialogContentRule[0], /max-height:\s*56vh/);
  assert.match(style, /\.dialog-body\s*\{[^}]*width:\s*100%/s);
  assert.match(dialogCancelRule[0], /flex:\s*0\s+0\s+auto/);
  const eventOptionRule = style.match(/\.event-option\s*\{[^}]*\}/s);
  assert.ok(eventOptionRule, 'event-option');
  assert.match(eventOptionRule[0], /display:\s*flex/);
  assert.match(eventOptionRule[0], /width:\s*100%/);
  assert.match(eventOptionRule[0], /width:\s*100%\s*!important/);
  assert.match(eventOptionRule[0], /min-width:\s*0/);
  assert.match(template, /event-option-label/);
  const centeredButtonRules = ['event-cancel', 'dialog-button', 'nameselect-confirm'];
  centeredButtonRules.forEach(selector => {
    const rule = style.match(new RegExp(`\\.${selector}\\s*\\{[^}]*\\}`, 's'));
    assert.ok(rule, selector);
    assert.match(rule[0], /display:\s*flex/);
    assert.match(rule[0], /align-items:\s*center/);
    assert.match(rule[0], /justify-content:\s*center/);
  });
  const navRule = style.match(/\.top-nav-item\s*\{[^}]*\}/s);
  assert.ok(navRule, 'top-nav-item');
  assert.match(navRule[0], /flex:\s*1/);
  assert.match(navRule[0], /min-width:\s*0/);
  assert.match(navRule[0], /box-sizing:\s*border-box/);
  assert.match(style, /\.career-title-main\s*\{[^}]*min-width:\s*0/s);
  assert.doesNotMatch(style, />\s*:[a-z-]/, 'WXSS must not use an untyped pseudo selector');
  assert.doesNotMatch(style, /(^|\n)\s*(page|button|view|text|image|input|scroll-view)(?:\s|[:{])/s, 'page WXSS should use class selectors');
});

test('release build does not present copyrighted character presets', () => {
  const page = read('pages/index/index.js');
  const template = read('pages/index/index.wxml');
  assert.doesNotMatch(`${page}\n${template}`, /人民的名义|高育良|侯亮平|李达康|祁同伟|沙瑞金/);
});

test('release metadata consistently uses the Buyunlu title', () => {
  const metadata = `${read('app.json')}\n${read('project.config.json')}\n${read('sitemap.json')}\n${read('README.md')}`;
  assert.match(metadata, /步云录/);
  assert.doesNotMatch(metadata, /重生之我是公务员的一生|重生公务员-反编译/);
});

test('all packaged image and audio files are within 200 KB', () => {
  const media = [];
  const visit = dir => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|aac)$/i.test(entry.name)) media.push(full);
    });
  };
  visit(path.join(root, 'assets'));
  media.forEach(file => assert.ok(fs.statSync(file).size <= 200 * 1024, `${file} exceeds 200 KB`));
});

test('the complete project stays below the 1.5 MB main-package limit', () => {
  // 测的是「小程序主包」大小，不是仓库大小。读取 project.config.json 的 packOptions.ignore
  // 来对齐：tests/tools/server/.workbuddy 以及 deploy 脚本都不进主包；
  // 比如 server/data/leaderboard.json 这种部署运行期产物（线上有 599 条真实记录，已经 1MB+）
  // 留在仓库里会让这条用例持续误报。
  const project = JSON.parse(read('project.config.json'));
  const ignoredFolders = new Set((project.packOptions.ignore || []).filter(item => item.type === 'folder').map(item => item.value));
  const ignoredFiles = new Set((project.packOptions.ignore || []).filter(item => item.type === 'file').map(item => item.value));

  let total = 0;
  const visit = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    if (ignoredFolders.has(entry.name)) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(full);
    else if (!ignoredFiles.has(path.relative(root, full).replace(/\\/g, '/'))) total += fs.statSync(full).size;
  });
  visit(root);
  assert.ok(total < 1.5 * 1024 * 1024, `main package is ${total} bytes`);
});
