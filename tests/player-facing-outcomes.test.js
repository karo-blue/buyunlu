const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('领导者考验只展示训勉，不向玩家公开隐藏判定机制', () => {
  const rules = read('game/honor-rules.js');
  assert.doesNotMatch(rules, /唯一一次终极考验|50%执行成功率|广告不提供加成|无法再获得领导者荣誉/);
  assert.match(rules, /位置越高，越要把责任放在个人得失之前/);
  assert.match(rules, /请以职责为先、以百姓为念/);
});

test('人民公仆和领导者荣誉都展示完整长篇训勉', () => {
  const page = read('pages/index/index.js');
  assert.match(page, /同志们从今往后这样称呼你——人民公仆/);
  assert.match(page, /权力源自人民的托付，权重一分，责任便重一分/);
  assert.match(page, /同志们从今往后这样称呼你——领导者 · 人民公仆/);
  assert.match(page, /走到更高的位置，不是为了让更多人仰望/);
  assert.match(page, /把功劳留给众人，把责任担在自己肩上/);
});

test('出逃成功具有独立的橙色结果页和文字标识', () => {
  const page = read('pages/index/index.js');
  const wxml = read('pages/index/index.wxml');
  const wxss = read('pages/index/index.wxss');
  assert.match(page, /tone: 'warning'/);
  assert.match(wxml, /dialog-mask-warning/);
  assert.match(wxml, /warning-banner/);
  assert.match(wxml, />出逃</);
  assert.match(wxss, /\.dialog-card-warning/);
  assert.match(wxss, /\.warning-banner/);
});
