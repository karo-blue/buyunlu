// 按职级分组的季度工作题库。
//
// 为什么另起一套：原来的季度事项只有 54 道公共 + 27 道岗位，副科级往上
// 每个职级只能抽到 4~5 道，一个存档要过几十个季度，必然翻来覆去。
// 这里每个职级 50 道，只在本职级抽取，内容贴合该职级真实的权力边界——
// 二级科员办的是窗口和入户，副处级才谈得上协调部门、副厅级才谈得上统筹条线。
//
// 写作约束（和全局一致，别破）：
//   · 人物、职务、事件全部虚构，不对应任何真实人物、机构或案件
//   · 不出现具体金额、渠道、操作步骤与话术细节
//   · **不存在"靠破规则赢"的路径**：违规选项最多是"少输"，performance 绝不能最高
//
// 事件字段：{ title, scene, options: [{ text, performance, effect, result }] }
// effect 可用：reputation / network / integrity / health / seniority / wealth（wealth 会转成现金）

const RANK_EVENT_FILES = [
  'rank-01', 'rank-02', 'rank-03', 'rank-04', 'rank-05', 'rank-06',
  'rank-07', 'rank-08', 'rank-09', 'rank-10', 'rank-11',
];

// 题库是按职级分批补的，缺哪一级就先返回空数组（core 会退回原来的抽取逻辑）。
// tests/rank-events.test.js 会断言 11 级全部非空，补齐前那条用例是红的。
const RANK_EVENT_POOL = RANK_EVENT_FILES.map(name => {
  try {
    return require(`./rank-events/${name}`);
  } catch (error) {
    return [];
  }
});

module.exports = { RANK_EVENT_POOL, RANK_EVENT_FILES };
