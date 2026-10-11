// 静态检查页面接线：WXML 里引用的事件处理函数必须在 index.js 中有定义，
// WXML 里绑定的数据字段必须在 data 初值里存在。
// 这一类问题在小程序里是运行时报错，纯引擎测试发现不了，所以单独守一道。
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
// catchtouchmove="true" 这类是字面量而不是处理函数
const LITERALS = new Set(['true', 'false', 'null', 'undefined']);
// wx:for 自带的别名指向数组元素，不是 data 上的字段
const DEFAULT_ALIASES = ['item', 'index'];

// 从 "data: {" 开始按花括号配对切出 data 块的原文
function extractDataBlock(source) {
  const start = source.indexOf('data: {');
  if (start < 0) return '';
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return '';
}

// data 块里的键有的独占一行、有的挤在一行里（currentEvent 就是挤着的），
// 所以按花括号深度扫描：只有刚好在 data 这一层出现的 "标识符:" 才算数据字段。
function dataKeysOf(block) {
  const keys = new Set();
  let depth = 0;
  let index = block.indexOf('{');
  while (index >= 0 && index < block.length) {
    const char = block[index];
    if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') depth -= 1;
    else if (depth === 1 && /[a-zA-Z_$]/.test(char)) {
      const match = block.slice(index).match(/^([a-zA-Z_$][\w$]*)\s*:/);
      if (match && !/\w/.test(block[index - 1] || '')) {
        keys.add(match[1]);
        index += match[0].length - 1;
      }
    }
    index += 1;
  }
  return [...keys];
}

function objectLiteralInitial(block, name) {
  const match = block.match(new RegExp(`^\\s{4}${name}:\\s*\\{([\\s\\S]*?)\\n\\s{4}\\}`, 'm'));
  return match ? match[1] : '';
}

function auditPageWiring(pageDirectory = path.join(root, 'pages/index')) {
  const wxml = fs.readFileSync(path.join(pageDirectory, 'index.wxml'), 'utf8');
  const source = fs.readFileSync(path.join(pageDirectory, 'index.js'), 'utf8');
  const dataBlock = extractDataBlock(source);
  const dataKeys = dataKeysOf(dataBlock);

  const aliases = new Set(DEFAULT_ALIASES.concat(
    [...wxml.matchAll(/wx:for-(?:item|index)="([a-zA-Z_$][\w$]*)"/g)].map(match => match[1])
  ));

  const handlers = [...new Set([...wxml.matchAll(/(?:bind|catch)[a-z]*="([a-zA-Z_$][\w$]*)"/g)].map(match => match[1]))]
    .filter(name => !LITERALS.has(name));
  const missingHandlers = handlers.filter(name => !new RegExp(`(^|\\s)${name}\\s*\\(`).test(source));

  const boundObjects = [...new Set([...wxml.matchAll(/\{\{\s*([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)/g)].map(match => match[1]))]
    .filter(name => !aliases.has(name));
  const missingObjects = boundObjects.filter(name => !dataKeys.includes(name));

  // 只有能取到对象字面量初值的字段才能逐项核对（state 的初值是函数调用，只能查对象是否存在）
  const missingFields = [];
  boundObjects.forEach(name => {
    const initial = objectLiteralInitial(dataBlock, name);
    if (!initial) return;
    const fields = [...new Set([...wxml.matchAll(new RegExp(`\\{\\{\\s*${name}\\.([a-zA-Z_$][\\w$]*)`, 'g'))].map(match => match[1]))];
    fields.forEach(field => { if (!new RegExp(`(^|\\s)${field}\\s*:`).test(initial)) missingFields.push(`${name}.${field}`); });
  });

  return { handlers, missingHandlers, boundObjects, dataKeys, missingObjects, missingFields };
}

if (require.main === module) {
  const result = auditPageWiring();
  console.log(`WXML 引用处理函数 ${result.handlers.length} 个`);
  console.log(`  处理函数缺失：${result.missingHandlers.length ? result.missingHandlers.join('、') : '无'}`);
  console.log(`  绑定对象缺失：${result.missingObjects.length ? result.missingObjects.join('、') : '无'}`);
  console.log(`  对象字段缺失：${result.missingFields.length ? result.missingFields.join('、') : '无'}`);
  if (result.missingHandlers.length || result.missingObjects.length || result.missingFields.length) process.exit(1);
}

module.exports = { auditPageWiring };
