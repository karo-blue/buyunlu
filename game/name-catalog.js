// 与“步云之录”一致：先选姓氏，再从本地双字名库中随机生成候选姓名。
const COMMON_SURNAMES = Object.freeze([
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '郑', '谢', '梁', '宋', '唐', '许', '韩', '冯', '邓', '曹',
  '彭', '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡',
  '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈',
  '姚', '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金',
  '石', '廖', '贾', '夏', '韦', '傅', '方', '白', '邹', '孟',
]);

const GIVEN_NAME_FIRST_CHARS = Object.freeze([
  '安', '宁', '清', '和', '嘉', '乐', '明', '晓', '晨', '星',
  '阳', '雨', '晴', '云', '川', '山', '林', '森', '沐', '泽',
  '言', '知', '思', '念', '希', '予', '亦', '宜', '初', '若',
  '书', '然', '温', '景', '朗', '成', '远', '逸', '乔', '诚',
  '谦', '朴', '稳', '佳', '友', '简', '之', '向', '唯', '望',
]);
const GIVEN_NAME_SECOND_CHARS = Object.freeze([
  '安', '辰', '川', '林', '泽', '朗', '宁', '和', '轩', '霖',
  '宇', '阳', '轻', '远', '松', '书', '诚', '然', '昕', '宜',
]);

const GIVEN_NAMES = Object.freeze(
  GIVEN_NAME_FIRST_CHARS.flatMap(first => GIVEN_NAME_SECOND_CHARS.map(second => `${first}${second}`)),
);

function pickGivenNames(previous = [], count = 15, rng = Math.random) {
  const target = Math.max(0, Math.min(Number(count) || 0, GIVEN_NAMES.length));
  const excluded = new Set(Array.isArray(previous) ? previous : []);
  let pool = GIVEN_NAMES.filter(name => !excluded.has(name));
  if (pool.length < target) pool = GIVEN_NAMES.slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, target);
}

module.exports = { COMMON_SURNAMES, GIVEN_NAMES, pickGivenNames };
