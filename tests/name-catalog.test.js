const assert = require('node:assert/strict');
const { test } = require('node:test');
const { COMMON_SURNAMES, GIVEN_NAMES, pickGivenNames } = require('../game/name-catalog');

test('开局姓名目录提供70个姓氏和1000个不重复双字名', () => {
  const addedSurnames = [
    '郑', '谢', '梁', '宋', '唐', '许', '韩', '冯', '邓', '曹',
    '彭', '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡',
    '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈',
    '姚', '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金',
    '石', '廖', '贾', '夏', '韦', '傅', '方', '白', '邹', '孟',
  ];
  assert.equal(COMMON_SURNAMES.length, 70);
  assert.equal(new Set(COMMON_SURNAMES).size, 70);
  assert.deepEqual(COMMON_SURNAMES.slice(20), addedSurnames);
  assert.equal(GIVEN_NAMES.length, 1000);
  assert.equal(new Set(GIVEN_NAMES).size, 1000);
});

test('开局姓名每批随机展示15个，换一批不重复上一批', () => {
  const first = pickGivenNames([], 15, () => 0.37);
  const second = pickGivenNames(first, 15, () => 0.73);
  assert.equal(first.length, 15);
  assert.equal(second.length, 15);
  assert.equal(new Set(first).size, 15);
  assert.equal(new Set(second).size, 15);
  assert.equal(first.some(name => second.includes(name)), false);
});
