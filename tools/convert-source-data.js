const fs = require('fs');
const path = require('path');

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node tools/convert-source-data.js <authorized-source.lua> [output.js]');
const outPath = process.argv[3] || path.join(__dirname, '..', 'game', 'data-full.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function stripComments(text) {
  let result = ''; let quote = null; let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]; const next = text[i + 1];
    if (quote) { result += ch; if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = null; continue; }
    if ((ch === '"' || ch === "'") && !quote) { quote = ch; result += ch; continue; }
    if (ch === '-' && next === '-') { while (i < text.length && text[i] !== '\n') i += 1; result += '\n'; continue; }
    result += ch;
  }
  return result;
}

function findTable(name) {
  const start = source.indexOf(`local ${name} =`);
  if (start < 0) throw new Error(`missing table ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0; let quote = null; let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth === 0) return source.slice(brace, i + 1); }
  }
  throw new Error(`unclosed table ${name}`);
}

function parseLua(text) {
  const input = stripComments(text); let index = 0;
  const skip = () => { while (/\s/.test(input[index] || '')) index += 1; };
  const stringValue = () => { const quote = input[index++]; let value = ''; let escaped = false; while (index < input.length) { const ch = input[index++]; if (escaped) { value += ch === 'n' ? '\n' : ch === 'r' ? '\r' : ch === 't' ? '\t' : ch; escaped = false; } else if (ch === '\\') escaped = true; else if (ch === quote) break; else value += ch; } return value; };
  const scalar = () => { skip(); if (input[index] === '"' || input[index] === "'") return stringValue(); const number = input.slice(index).match(/^-?\d+(?:\.\d+)?/); if (number) { index += number[0].length; return Number(number[0]); } const ident = input.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/); if (ident) { index += ident[0].length; return ident[0] === 'true' ? true : ident[0] === 'false' ? false : ident[0] === 'nil' ? null : ident[0]; } throw new Error(`unexpected Lua token near ${input.slice(index, index + 30)}`); };
  const value = () => { skip(); if (input[index] !== '{') return scalar(); index += 1; const array = []; const object = {}; let keyed = false; while (true) { skip(); if (input[index] === '}') { index += 1; break; } let key; let entry; const start = index; if (input[index] === '[') { index += 1; key = scalar(); skip(); if (input[index++] !== ']') throw new Error('missing ]'); skip(); if (input[index++] !== '=') throw new Error('missing ='); keyed = true; entry = value(); } else { const ident = input.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/); if (ident) { index += ident[0].length; skip(); if (input[index] === '=') { index += 1; keyed = true; key = ident[0]; entry = value(); } else { index = start; entry = value(); } } else entry = value(); } if (keyed) object[String(key)] = entry; else array.push(entry); skip(); if (input[index] === ',') index += 1; } return keyed ? Object.assign(object, array.length ? { __array: array } : {}) : array; };
  const result = value();
  const clean = item => { if (Array.isArray(item)) return item.map(clean); if (item && typeof item === 'object') { if (item.__array) { const merged = Object.assign({}, item); delete merged.__array; item.__array.forEach((v, i) => { merged[String(i + 1)] = clean(v); }); return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, clean(v)])); } return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, clean(v)])); } return item; };
  return clean(result);
}

function splitArgs(text) {
  const result = []; let start = 0; let depth = 0; let quote = null; let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) { result.push(text.slice(start, i).trim()); start = i + 1; }
  }
  result.push(text.slice(start).trim());
  return result;
}

function luaString(expression) { return parseLua(expression); }

function buildRoleEventPool(role, focusOne, focusTwo, sceneOne, sceneTwo) {
  const build = (title, scene, focus) => ({
    title: `岗位专项 · ${role} · ${title}`,
    scene,
    options: [
      { text: `围绕${focus}开展调研，建立责任和时限闭环`, performance: 3, effect: { reputation: 4, network: 3, seniority: 2 }, result: `${focus}得到系统推进，责任边界和后续节点清晰可查。` },
      { text: `按常规程序推进${focus}，定期汇总进度`, performance: 1, effect: { seniority: 1, reputation: 1 }, result: `${focus}基本按计划推进，但仍有部分细节需要继续完善。` },
      { text: `只看短期指标，暂不处理${focus}的长期风险`, performance: -1, effect: { reputation: -3, integrity: -2 }, result: `${focus}留下后续隐患，你在复盘中补做了风险处置。` },
    ],
  });
  return [build('年度重点工作', sceneOne, focusOne), build('阶段性风险处置', sceneTwo, focusTwo)];
}

const ranks = parseLua(findTable('RANKS'));
const positionsRaw = parseLua(findTable('POSITION_OPTIONS'));
const events = parseLua(findTable('EVENTS'));
const positionEvents = parseLua(findTable('POSITION_EVENTS'));
const investigationEvent = parseLua(findTable('INVESTIGATION_EVENT'));
const compensation = parseLua(findTable('COMPENSATION_BY_RANK'));

const additionalStart = source.indexOf('local ADDITIONAL_POSITION_EVENTS =');
const additionalEnd = source.indexOf('local function PositionEventKey', additionalStart);
const additionalText = source.slice(additionalStart, additionalEnd);
const additional = {};
const callRegex = /^\s*([a-z_]+)\s*=\s*BuildRoleEventPool\((.*)\),\s*$/gm;
let match;
while ((match = callRegex.exec(additionalText))) {
  const args = parseLua(`{${match[2]}}`);
  additional[match[1]] = buildRoleEventPool(...args);
}

const output = `// Generated mechanically from source/main.lua. Keep source data authoritative.\nconst RANKS = ${JSON.stringify(ranks, null, 2)};\nconst POSITION_OPTIONS = ${JSON.stringify(positionsRaw, null, 2)};\nconst EVENTS = ${JSON.stringify(events, null, 2)};\nconst POSITION_EVENTS = ${JSON.stringify(positionEvents, null, 2)};\nconst ADDITIONAL_POSITION_EVENTS = ${JSON.stringify(additional, null, 2)};\nconst INVESTIGATION_EVENT = ${JSON.stringify(investigationEvent, null, 2)};\nconst COMPENSATION_BY_RANK = ${JSON.stringify(compensation, null, 2)};\nconst HOUSES = [\n  { name: '云汀单身公寓', price: 250000, years: 8 },\n  { name: '云汀小户型', price: 350000, years: 10 },\n  { name: '云汀家庭两居', price: 500000, years: 10 },\n  { name: '云汀改善型三居', price: 700000, years: 12 },\n  { name: '云汀城区品质住宅', price: 1000000, years: 15 },\n];\nconst CARS = [\n  { name: '二手代步车', price: 50000, years: 2 },\n  { name: '实用代步车', price: 80000, years: 3 },\n  { name: '新能源家用车', price: 120000, years: 4 },\n  { name: '舒适家用车', price: 180000, years: 4 },\n  { name: '商务型车辆', price: 280000, years: 5 },\n];\nmodule.exports = { RANKS, POSITION_OPTIONS, EVENTS, POSITION_EVENTS, ADDITIONAL_POSITION_EVENTS, INVESTIGATION_EVENT, COMPENSATION_BY_RANK, HOUSES, CARS };\n`;
fs.writeFileSync(outPath, output);
console.log(`generated ${outPath}`);
console.log(JSON.stringify({ ranks: ranks.length, commonEvents: events.length, positionNames: Object.values(positionsRaw).reduce((n, v) => n + v.length, 0), basePositionPools: Object.keys(positionEvents).length, generatedRolePools: Object.keys(additional).length }, null, 2));
