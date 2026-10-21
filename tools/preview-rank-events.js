// 生成按职级的季度工作题库预览页（不参与小程序打包，tools/ 已在 packOptions.ignore 里）
// 用法：node tools/preview-rank-events.js
const fs = require('fs');
const path = require('path');

const { RANK_EVENT_POOL } = require('../game/events-by-rank');
const { RANKS } = require('../game/data-full');

const esc = text => String(text == null ? '' : text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const total = RANK_EVENT_POOL.reduce((sum, pool) => sum + pool.length, 0);
const uniqueTitles = new Set(RANK_EVENT_POOL.flat().map(item => item.title)).size;

const nav = RANK_EVENT_POOL.map((pool, index) =>
  `<a href="#rank-${index + 1}">${index + 1}·${RANKS[index] ? esc(RANKS[index].name) : ''}<em>${pool.length}</em></a>`,
).join('');

const body = RANK_EVENT_POOL.map((pool, index) => {
  const rank = index + 1;
  const items = pool.map((event, i) => {
    const options = event.options.map((option) => {
      const marks = [];
      if (option.performance >= 3) marks.push('<b class="best">最优</b>');
      else if (option.performance > 0) marks.push('<b>一般</b>');
      else marks.push('<b class="bad">不佳</b>');
      const effect = Object.entries(option.effect || {})
        .map(([key, value]) => `<i>${esc(key)} ${value > 0 ? '+' : ''}${esc(value)}</i>`).join('');
      return `<li>${marks.join('')}<span>${esc(option.text)}</span>${effect ? `<u>${effect}</u>` : ''}<p>${esc(option.result)}</p></li>`;
    }).join('');
    return `<article><h3>${i + 1}. ${esc(event.title)}</h3><p class="scene">${esc(event.scene)}</p><ol>${options}</ol></article>`;
  }).join('');
  return `<section id="rank-${rank}"><h2>职级 ${rank} · ${esc(RANKS[index] ? RANKS[index].name : '')}<em>${pool.length} 道</em></h2>${items}</section>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>步步有为 · 季度工作题库预览（${total} 道）</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1c1a;--dim:#6b6862;--line:#e3e0d9;--best:#b3261e;--bad:#2f6b3a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
header{padding:28px 32px 20px;border-bottom:1px solid var(--line);background:var(--card)}
header h1{margin:0 0 6px;font-size:22px}
header p{margin:0;color:var(--dim);font-size:13px}
nav{display:flex;flex-wrap:wrap;gap:8px;padding:16px 32px;background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:2}
nav a{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border:1px solid var(--line);border-radius:999px;color:var(--ink);text-decoration:none;font-size:13px}
nav a:hover{border-color:var(--best);color:var(--best)}
nav a em{font-style:normal;color:var(--dim);font-size:12px}
main{padding:0 32px 80px}
section{padding-top:34px}
section h2{position:sticky;top:57px;margin:0 0 14px;padding:10px 0;background:var(--bg);font-size:18px;border-bottom:2px solid var(--ink)}
section h2 em{margin-left:10px;font-style:normal;font-size:13px;color:var(--dim)}
article{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:12px}
article h3{margin:0 0 4px;font-size:16px}
article .scene{margin:0 0 10px;color:var(--dim);font-size:14px}
article ol{margin:0;padding-left:20px}
article li{margin:6px 0}
article li span{font-weight:600}
article li p{margin:2px 0 0;color:var(--dim);font-size:13px}
b{margin-right:6px;font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:#eceae4;color:var(--dim)}
b.best{background:#fdecea;color:var(--best)}
b.bad{background:#e8f2ea;color:var(--bad)}
u{text-decoration:none;margin-left:8px}
u i{font-style:normal;font-size:11px;color:var(--dim);margin-right:6px}
@media(max-width:640px){header,nav,main{padding-left:16px;padding-right:16px}nav{position:static}section h2{position:static}}
</style></head><body>
<header><h1>步步有为 · 季度工作题库预览</h1>
<p>共 ${RANKS.length} 个职级 · ${total} 道 · 去重题名 ${uniqueTitles} 个。每个职级只从自己的题库抽取，且完整轮一遍才开始重复。</p></header>
<nav>${nav}</nav><main>${body}</main></body></html>`;

const out = path.join(__dirname, '..', '.workbuddy', 'rank-events-preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log('written:', out, `${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
