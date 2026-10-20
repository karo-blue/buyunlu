'use strict';
const fs = require('node:fs');
const path = require('node:path');

function decode(text) {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity]));
}

function parseWxml(source) {
  const root = { children: [] };
  const stack = [root];
  const tokens = source.match(/<!--[\s\S]*?-->|<\/?[\w-]+\b(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      const tag = token.slice(2, -1).trim();
      if (stack.length < 2 || stack.pop().tag !== tag) throw new Error(`WXML closing tag mismatch: ${tag}`);
    } else if (token.startsWith('<')) {
      const match = token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/);
      if (!match) throw new Error('Unsupported WXML tag');
      const attrs = {};
      const attrPattern = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
      let attribute;
      while ((attribute = attrPattern.exec(match[2]))) attrs[attribute[1]] = decode(attribute[2] ?? attribute[3] ?? '');
      const node = { tag: match[1], attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!/\/\s*>$/.test(token)) stack.push(node);
    } else if (token.trim()) stack[stack.length - 1].children.push({ text: decode(token) });
  }
  if (stack.length !== 1) throw new Error('Unclosed WXML tag');
  return root.children;
}

function convertCss(source) {
  return source.replace(/(-?(?:\d+\.?\d*|\.\d+))rpx\b/g, (_, value) => `calc(${value} * var(--rpx))`);
}

function mobileTemplate(nodes, sharedBoards = false) {
  return nodes.map(node => {
    if (node.text != null) return { text: sharedBoards ? node.text : node.text.replaceAll('全网排行榜', '本机排行榜').replaceAll('全网榜单', '本机榜单') };
    const attrs = { ...node.attrs };
    if (attrs['open-type']) delete attrs['open-type'];
    if (sharedBoards && attrs.class && attrs.class.startsWith('dialog-card ')) attrs.class += " {{dialog.tone === 'promotion' ? 'dialog-card-promotion' : ''}}";
    if (!sharedBoards && attrs['aria-label'] === '全网榜单') attrs['aria-label'] = '本机榜单';
    if (attrs.src === '/assets/ad-free-card.png') attrs.src = 'assets/ad-free-card.png';
    return { ...node, attrs, children: mobileTemplate(node.children, sharedBoards) };
  });
}

function listJs(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listJs(file) : entry.name.endsWith('.js') ? [file] : [];
  });
}

function build(options = {}) {
  const source = path.resolve(options.source || path.join(__dirname, '..'));
  const output = path.resolve(options.output || path.join(source, 'docs'));
  const assetVersion = encodeURIComponent(JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).version);
  const site = options.site || JSON.parse(fs.readFileSync(path.join(__dirname, 'site.json'), 'utf8'));
  const apiOrigin = new URL(site.apiBaseUrl).origin;
  const template = mobileTemplate(parseWxml(fs.readFileSync(path.join(source, 'pages/index/index.wxml'), 'utf8')), true);
  const files = [...listJs(path.join(source, 'game')), ...['storage', 'leaderboard', 'leaderboard-api', 'virtual-pay'].map(name => path.join(source, `services/${name}.js`)), path.join(source, 'pages/index/index.js')];
  const entries = files.map(file => {
    const id = path.relative(source, file).replaceAll('\\', '/').replace(/\.js$/, '');
    let content = fs.readFileSync(file, 'utf8');
    // The highest rank has a real zero-fault requirement; keep it in the mobile copy's display.
    if (id === 'pages/index/index') content = content.replace('rank.faultLimit || 99', '(rank.faultLimit == null ? 99 : rank.faultLimit)');
    return `${JSON.stringify(id)}: function(module, exports, require) {\n${content}\n}`;
  });
  entries.push('"services/config": function(module) { module.exports = { appId: "", rewardedAdUnitId: "", faultHelpAdUnitId: "", leaderboardApiBaseUrl: "", adCardName: "免广告卡", adCardCardsPerUnit: 10, adCardPriceYuan: 0 }; }');
  let bundled = `(function() {\n'use strict';\nconst modules = {${entries.join(',\n')}};\nconst load = BuyunluRuntime.moduleLoader(modules);\nwindow.wx = BuyunluRuntime.createWx(window);\nlet page;\nwindow.Page = definition => { page = definition; };\nwindow.getCurrentPages = () => page ? [page] : [];\nload('pages/index/index');\nBuyunluOffline.install(page, { core: load('game/core'), storage: load('services/storage'), leaderboard: load('services/leaderboard'), host: window });\nBuyunluRuntime.attachPage(page, { document, root: document.getElementById('app'), template: ${JSON.stringify(template)}, afterRender: () => BuyunluRuntime.updateAccessibility(page, document) });\nwindow.buyunluPage = page;\nwindow.buyunluHandleBack = () => BuyunluOffline.handleBack(page);\npage.onLoad();\nif (page.onShow) page.onShow();\nwindow.addEventListener('pagehide', () => page.onUnload());\nwindow.addEventListener('pageshow', event => { if (event.persisted && page.onShow) page.onShow(); });\ndocument.addEventListener('visibilitychange', () => document.hidden ? page.onHide() : page.onShow && page.onShow());\nwindow.addEventListener('keydown', event => { if (event.key === 'Escape') window.buyunluHandleBack(); if (event.key === 'Tab') BuyunluRuntime.trapFocus(event, document); });\n})();\n`;
  bundled = bundled.replace('BuyunluRuntime.attachPage(page,', "if (window.BuyunluWebConfig && !window.BuyunluCommerce) throw new Error('购卡组件未能加载，请刷新');\nif (window.BuyunluCommerce) BuyunluCommerce.install(page, { host: window, boards: load('services/leaderboard-api'), storage: load('services/storage') });\nBuyunluRuntime.attachPage(page,");
  bundled = "(function(start) {\nif (window.BuyunluWebConfig && !window.BuyunluCardAccount) throw new Error('登录组件未能加载，请刷新');\nif (window.BuyunluCardAccount) window.BuyunluCardAccount.access.then(start); else start();\n})(function() {\n" + bundled + "\n});\n";
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(source, 'assets/ad-free-card.png'), path.join(output, 'assets/ad-free-card.png'));
  fs.writeFileSync(path.join(output, 'game.js'), bundled);
  fs.writeFileSync(path.join(output, 'template.json'), JSON.stringify(template));
  for (const name of ['runtime.js', 'offline.js']) fs.copyFileSync(path.join(__dirname, name), path.join(output, name));
  fs.writeFileSync(path.join(output, 'style.css'), convertCss(fs.readFileSync(path.join(source, 'pages/index/index.wxss'), 'utf8')) + '\n' + fs.readFileSync(path.join(__dirname, 'mobile.css'), 'utf8'));
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#f3e5cd"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'self'; manifest-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="步云录"><title>步云录 · 网页版</title><link rel="manifest" href="manifest.webmanifest?v=${assetVersion}"><link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v=${assetVersion}"><link rel="stylesheet" href="theme.css?v=${assetVersion}"><link rel="stylesheet" href="style.css?v=${assetVersion}"></head><body><main id="app" aria-label="步云录游戏"></main><div id="toast" role="status" aria-live="polite"></div><noscript>请启用 JavaScript 以运行离线游戏。</noscript><script src="runtime.js?v=${assetVersion}"></script><script src="offline.js?v=${assetVersion}"></script><script src="game.js?v=${assetVersion}"></script><script src="pwa.js?v=${assetVersion}"></script></body></html>\n`);
  const indexFile = path.join(output, 'index.html');
  fs.writeFileSync(indexFile, fs.readFileSync(indexFile, 'utf8')
    .replace('<main id="app"', '<main hidden inert id="app"')
    .replace("connect-src 'none'", 'connect-src ' + apiOrigin)
    .replace('</head>', `<link rel="stylesheet" href="commerce.css?v=${assetVersion}"></head>`)
    .replace('<script src="runtime.js', fs.readFileSync(path.join(__dirname, 'commerce-account.html'), 'utf8') +
      ['site.js','commerce-api.js','commerce-account.js','commerce.js'].map(name=>`<script src="${name}?v=${assetVersion}"></script>`).join('') + '<script src="runtime.js'));
  fs.writeFileSync(path.join(output, 'site.js'), 'window.BuyunluWebConfig = ' + JSON.stringify(site) + ';\n');
  for (const name of ['commerce-api.js','commerce-account.js','commerce.js','commerce.css','checkout.js','checkout.html','product.html','theme.css','store.css']) {
    let text = fs.readFileSync(path.join(__dirname, name), 'utf8');
    if (name.endsWith('.html')) text = text
      .replace('</head>', `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src ${apiOrigin}; base-uri 'none'; form-action 'none'"></head>`)
      .replace(/(?:src|href)="([\w-]+\.(?:js|css))"/g, (_,asset) => `${asset.endsWith('.css')?'href':'src'}="${asset}?v=${assetVersion}"`);
    fs.writeFileSync(path.join(output,name),text);
  }
  fs.copyFileSync(path.join(source, 'LICENSE'), path.join(output, 'LICENSE'));
  fs.copyFileSync(path.join(source, 'PRIVACY.md'), path.join(output, 'PRIVACY.md'));
  fs.copyFileSync(path.join(source, 'THIRD_PARTY_NOTICES.md'), path.join(output, 'THIRD_PARTY_NOTICES.md'));
  fs.copyFileSync(path.join(__dirname, 'DEPLOY.txt'), path.join(output, '使用说明.txt'));
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  const manifest = { id: './', name: '步云录', short_name: '步云录', lang: 'zh-CN', start_url: './', scope: './', display: 'standalone', background_color: '#f3e5cd', theme_color: '#ae3e2e',
    icons: [192, 512].map(size => ({ src: 'assets/icon-' + size + '.png', sizes: size + 'x' + size, type: 'image/png', purpose: 'any' })) };
  fs.writeFileSync(path.join(output, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  fs.copyFileSync(path.join(__dirname, 'pwa.js'), path.join(output, 'pwa.js'));
  fs.writeFileSync(path.join(output, 'sw.js'), fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8').replace('__BUILD_VERSION__', assetVersion));
  for (const icon of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(__dirname, 'icons', icon), path.join(output, 'assets', icon));
  return { output, modules: entries.length, templateNodes: template.length };
}

module.exports = { parseWxml, convertCss, mobileTemplate, build };
if (require.main === module) console.log(`已生成可直接部署的网页版：${build().output}`);
