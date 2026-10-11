// 生成"当前全部随机事件"总览页（不参与小程序打包，tools/ 已在 packOptions.ignore 里）。
// 用法：node tools/preview-all-events.js
//
// 与 tools/preview-rank-events.js 的分工：
//   preview-rank-events.js → 只看 550 道季度工作题库的完整内容
//   preview-all-events.js  → 全部随机事件入口的总账：突发 / 通用 / 岗位 / 核查，
//                            职级题库只列题名（完整内容去 rank-events-preview.html 看）
const fs = require('fs');
const path = require('path');

const core = require('../game/core');
const { EVENTS, POSITION_EVENTS, ADDITIONAL_POSITION_EVENTS, INVESTIGATION_EVENT, RANKS } = require('../game/data-full');
const { EXTRA_COMMON_EVENTS, EXTRA_POSITION_EVENTS } = require('../game/events-extra');
const { REVIEW_EVENT } = require('../game/events-burst');

const esc = text => String(text == null ? '' : text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const EFFECT_LABELS = {
  reputation: '口碑', network: '人脉', integrity: '廉洁', health: '健康',
  seniority: '资历', wealth: '现金', achievements: '政绩', faults: '过失',
  affection: '感情', review: '考核',
};

function effectText(effect) {
  return Object.entries(effect || {})
    .map(([key, value]) => `${EFFECT_LABELS[key] || key} ${value > 0 ? '+' : ''}${value}`)
    .join('　');
}

function eventCard(event, index, extraMarks = [], scaledRisk = false) {
  const marks = extraMarks.join('');
  const options = (event.options || []).map((option) => {
    const chips = [];
    if (option.performance != null) {
      chips.push(option.performance >= 3 ? '<b class="best">最优</b>'
        : option.performance > 0 ? '<b>一般</b>' : '<b class="bad">不佳</b>');
    }
    // 突发事件的进账选项，真正生效的风险是按金额折算出来的那一档，不是数据里写的初值
    const effective = scaledRisk ? core.bribeRiskOf(option) : { risk: Number(option.risk) || 0, wealth: 0 };
    const risk = scaledRisk ? effective.risk : Number(option.risk) || 0;
    if (risk !== 0) {
      chips.push(`<b class="${risk > 0 ? 'bad' : 'safe'}">风险${risk > 0 ? '+' : ''}${risk}</b>`);
    }
    if (scaledRisk && effective.wealth > 0) {
      const wan = Math.round(effective.wealth / 10000);
      if (effective.wealth > 30000) chips.push(`<b class="gold">意外收入 ${wan} 万元 → 超过 3 万元部分折算 ${risk} 点</b>`);
      else chips.push(`<b class="gold">人情往来 ${wan} 万元 · 不折算</b>`);
    }
    if (option.roll) chips.push(`<b>概率分支·${esc(option.roll.attr || '')}</b>`);
    if (option.upgraded) chips.push('<b class="gold">条件强化</b>');
    const effect = effectText(option.effect);
    return `<li>${chips.join('')}<span>${esc(option.text)}</span>${effect ? `<u><i>${esc(effect)}</i></u>` : ''}<p>${esc(option.result)}</p></li>`;
  }).join('');
  return `<article><h3>${index + 1}. ${esc(event.title)}${marks}</h3><p class="scene">${esc(event.scene)}</p><ol>${options}</ol></article>`;
}

function gateMarks(event) {
  const marks = [];
  if (Number(event.minRank) > 1) marks.push(`<em class="gate">${Number(event.minRank)} 级起</em>`);
  if (event.requiresPartner) marks.push('<em class="gate partner">需有伴侣</em>');
  if (event.weight != null && Number(event.weight) !== 1) marks.push(`<em class="gate">权重 ${event.weight}</em>`);
  return marks;
}

function section(id, title, count, note, cards) {
  return `<section id="${id}"><h2>${esc(title)}<em>${count} 条</em></h2>${note ? `<p class="note">${note}</p>` : ''}${cards.join('')}</section>`;
}

// ── 1. 突发事件 ─────────────────────────────────────────────────────────
const burstEvents = core.BURST_EVENTS.slice();
const burstCards = burstEvents
  .slice()
  .sort((left, right) => (Number(left.minRank) || 1) - (Number(right.minRank) || 1))
  .map((event, index) => eventCard(event, index, gateMarks(event), true));
const burstCount = burstEvents.length;
const burstNote = '季度事项处理完后按概率弹出（基础 30%，职级每高一级 +2.5%，上限 50%），必须当场表态。'
  + '围猎/受贿/投资类权重更高所以更常见；每个事件一生只出现一次（burstHistory 去重）。'
  + '「风险」是往来痕迹：攒到 6 点必然触发一次专项倒查。<b>落马风险 3 万元起征——超过 3 万元的意外收入，'
  + '超出部分每 1 万元折 1 点往来痕迹，至少 1 点、封顶 10 点，结下关系网的再 +1</b>；'
  + '3 万元以内的人情往来不折算，按事件里手写的小额痕迹记；退回去、自掏腰包补上的选项仍按手写值走'
  + '（主动切割为负，能把痕迹压回去）。';;

// ── 2. 专项倒查（风险痕迹攒满后必触发）──────────────────────────────────
const reviewCards = [eventCard(REVIEW_EVENT, 0, ['<em class="gate risk">风险痕迹 ≥ 6 必触发·一生一次</em>'])];

// ── 3. 监督核查（按职级的季度主事项替换）───────────────────────────────
const investigationCards = INVESTIGATION_EVENT
  ? (Array.isArray(INVESTIGATION_EVENT) ? INVESTIGATION_EVENT : [INVESTIGATION_EVENT]).map((event, index) => eventCard(event, index))
  : [];
const investigationCount = investigationCards.length;

// ── 4. 通用主事件（低职级的季度主事项池）───────────────────────────────
const commonEvents = core.COMMON_EVENT_POOL;
const commonCards = commonEvents
  .slice()
  .sort((left, right) => (Number(left.minRank) || 1) - (Number(right.minRank) || 1))
  .map((event, index) => eventCard(event, index, gateMarks(event)));
const commonNote = `原版 ${EVENTS.length} 条 + 手写扩展 ${EXTRA_COMMON_EVENTS.length} 条。`
  + '职级 1-2 的季度主事项从这里抽取（职级 3 起优先走本职级题库，抽不到才回退到这里）。';

// ── 5. 岗位主事件（担任实职后的季度主事项池）───────────────────────────
const POOL_LABELS = {
  grassroots: '基层通用', discipline: '纪检监察', organization: '组织宣传',
  executive: '机关中层', department: '部门单位', city: '市级通用',
  national: '国家级 / 部委', county_party: '县委机关', county_government: '县政府部门',
  town_party: '镇党委班子', town_government: '镇政府班子', town_security: '镇政法公安',
  town_organization: '镇组织宣传统战', military: '镇人武部', public_security: '公安派出所',
  province_security: '省公安厅', county_party_lead: '县委书记', county_government_lead: '县长',
  county_security: '县政法委', county_organization: '县委组织部', county_propaganda: '县委宣传部',
  county_office: '县委办公室', district_lead: '区领导班子', district: '区直机关',
  city_lead: '市领导班子', city_party: '市委机关', province_lead: '省领导班子',
};
const poolNames = Array.from(new Set([
  ...Object.keys(POSITION_EVENTS || {}),
  ...Object.keys(ADDITIONAL_POSITION_EVENTS || {}),
  ...Object.keys(EXTRA_POSITION_EVENTS || {}),
]));
const positionSections = poolNames.map((key) => {
  const merge = (source) => {
    const value = source && source[key];
    if (!value) return [];
    return (Array.isArray(value) ? value : [value]);
  };
  const pool = merge(POSITION_EVENTS).concat(merge(ADDITIONAL_POSITION_EVENTS), merge(EXTRA_POSITION_EVENTS));
  if (!pool.length) return '';
  const cards = pool.map((event, index) => eventCard(event, index, gateMarks(event)));
  return `<details class="pool"><summary>${esc(POOL_LABELS[key] || key)}<em>${esc(key)} · ${pool.length} 条</em></summary>${cards.join('')}</details>`;
}).join('');
const positionTotal = poolNames.reduce((sum, key) => {
  const merge = source => (source && source[key] ? (Array.isArray(source[key]) ? source[key] : [source[key]]) : []);
  return sum + merge(POSITION_EVENTS).length + merge(ADDITIONAL_POSITION_EVENTS).length + merge(EXTRA_POSITION_EVENTS).length;
}, 0);
const positionNote = '职级 ≥ 3 且担任实职时，季度主事项按 positionEventKey 映射到对应岗位池抽取（不重复抽上一次的题）。';

// ── 6. 职级题库（只列题名，完整内容见 rank-events-preview.html）────────
const rankSummary = core.RANK_EVENT_POOL.map((pool, index) => {
  const titles = pool.map((event, i) => `<li>${esc(event.title)}</li>`).join('');
  return `<details class="pool"><summary>职级 ${index + 1} · ${esc(RANKS[index] ? RANKS[index].name : '')}<em>${pool.length} 道</em></summary><ol class="titles">${titles}</ol></details>`;
}).join('');
const rankTotal = core.RANK_EVENT_POOL.reduce((sum, pool) => sum + pool.length, 0);

const totalAll = burstCount + reviewCards.length + investigationCount + commonEvents.length + positionTotal + rankTotal;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>步云录 · 随机事件总览（${totalAll} 条）</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1c1a;--dim:#6b6862;--line:#e3e0d9;--best:#b3261e;--bad:#2f6b3a;--gold:#9a6b1f}
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
section h2{margin:0 0 6px;font-size:18px;border-bottom:2px solid var(--ink);padding-bottom:8px}
section h2 em{margin-left:10px;font-style:normal;font-size:13px;color:var(--dim)}
p.note{margin:0 0 14px;color:var(--dim);font-size:13px}
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
b.safe{background:#e8f2ea;color:var(--bad)}
b.gold{background:#fdf3e0;color:var(--gold)}
em.gate{font-style:normal;margin-left:8px;font-size:11px;color:var(--gold);border:1px solid #ecd9b8;border-radius:4px;padding:1px 6px;background:#fdf8ee}
em.gate.partner{color:#7a4b8f;border-color:#ddc6e6;background:#f7effa}
em.gate.risk{color:var(--best);border-color:#efc7c4;background:#fdecea}
u{text-decoration:none;margin-left:8px}
u i{font-style:normal;font-size:11px;color:var(--dim);margin-right:6px}
details.pool{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 18px;margin-bottom:12px}
details.pool summary{cursor:pointer;font-weight:700}
details.pool summary em{font-style:normal;margin-left:8px;color:var(--dim);font-size:12px;font-weight:400}
details.pool[open] summary{margin-bottom:10px}
ol.titles{margin:0;padding-left:22px;columns:2;column-gap:32px}
ol.titles li{font-size:13px;color:var(--dim);margin:2px 0}
@media(max-width:640px){header,nav,main{padding-left:16px;padding-right:16px}nav{position:static}ol.titles{columns:1}}
</style></head><body>
<header><h1>步云录 · 随机事件总览</h1>
<p>共 ${totalAll} 条。覆盖突发、倒查、监督核查、通用主事件、岗位主事件与职级题库（题库只列题名，完整内容用 tools/preview-rank-events.js 生成的预览页看）。</p></header>
<nav>
<a href="#burst">突发事件<em>${burstCount}</em></a>
<a href="#review">专项倒查<em>${reviewCards.length}</em></a>
<a href="#investigation">监督核查<em>${investigationCount}</em></a>
<a href="#common">通用主事件<em>${commonEvents.length}</em></a>
<a href="#position">岗位主事件<em>${positionTotal}</em></a>
<a href="#rankbank">职级题库<em>${rankTotal}</em></a>
</nav>
<main>
${section('burst', '突发事件', burstCount, burstNote, burstCards)}
${section('review', '专项倒查', reviewCards.length, '风险痕迹攒到 6 点后，下一次突发必定是它，不再是概率。一生只触发一次。', reviewCards)}
${section('investigation', '监督核查', investigationCount, '职级 ≥ 3 的季度有固定核查概率（职级越高越高，上限 45%），抽中就替换本季度主事项。', investigationCards)}
${section('common', '通用主事件', commonEvents.length, commonNote, commonCards)}
${section('position', '岗位主事件', positionTotal, positionNote, [positionSections])}
${section('rankbank', '职级季度题库（题名）', rankTotal, '每职级 50 道、只在本职级抽取、完整轮一遍才开始重复。逐题内容见 tools/preview-rank-events.js 生成的 rank-events-preview.html。', [rankSummary])}
</main></body></html>`;

const out = path.join(__dirname, '..', '.workbuddy', 'all-events-preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log('written:', out, `${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
console.log(`burst=${burstCount} review=${reviewCards.length} investigation=${investigationCount} common=${commonEvents.length} position=${positionTotal} rankBank=${rankTotal} total=${totalAll}`);
