// 运行时补充的现实岗位池。data-full.js 仍保持由原始 source/main.lua 生成，
// 这里集中维护新增岗位，避免下一次重新提取源数据时把扩展岗位覆盖掉。
// 岗位名称均采用现实机关、街道、乡镇和企事业单位中通行的正式称谓。

const EXTRA_POSITION_OPTIONS = {
  3: [
    {
      group: '乡镇人大和政府岗位', name: '镇人大副主席', level: '副科级',
      description: '协助镇人大主席开展代表联络、监督和基层民主法治建设工作。',
      effect: { seniority: 2, reputation: 1 },
    },
    {
      group: '乡镇党政岗位', name: '镇党委委员、副镇长（分管民政）', level: '副科级',
      description: '负责社会救助、养老服务、残疾人服务和基层民政事务。',
      effect: { reputation: 3, network: 1 },
    },
    {
      group: '乡镇党政岗位', name: '镇党委委员、党政办公室主任', level: '副科级',
      description: '负责党委政府机关运转、综合协调、文稿和督查工作。',
      effect: { seniority: 2, network: 2 },
    },
    {
      group: '乡镇专业岗位', name: '镇党委委员、农业农村办公室主任', level: '副科级',
      description: '负责农业生产、乡村建设、集体经济和乡村振兴项目协调。',
      effect: { reputation: 2, seniority: 2, health: -1 },
    },
    {
      group: '街道党政岗位', name: '街道党工委委员、办事处副主任', level: '副科级',
      description: '协助街道办事处开展城市管理、公共服务和社区治理。',
      effect: { network: 2, reputation: 2 },
    },
    {
      group: '街道纪检岗位', name: '街道党工委委员、纪工委书记', level: '副科级',
      description: '负责街道监督执纪、基层作风建设和廉政教育。',
      minIntegrity: 75,
      effect: { integrity: 4, reputation: 1 },
    },
  ],
  4: [
    {
      group: '乡镇人大岗位', name: '镇人大主席', level: '正科级',
      description: '主持镇人大主席团工作，组织代表依法履职并开展监督。',
      effect: { reputation: 3, network: 2, seniority: 3, health: -1 },
    },
    {
      group: '县委机关岗位', name: '县委组织部副部长', level: '正科级',
      description: '协助组织部长负责干部考察、基层组织建设和人才工作。',
      minAchievements: 4,
      effect: { network: 3, seniority: 3, integrity: 1 },
    },
    {
      group: '县委机关岗位', name: '县委宣传部副部长', level: '正科级',
      description: '协助负责宣传思想、意识形态、新闻舆情和文化建设。',
      minAchievements: 4,
      effect: { reputation: 4, network: 1 },
    },
    {
      group: '县政府部门正职', name: '县发展和改革局局长', level: '正科级',
      description: '主持发展改革工作，负责项目立项、投资管理和经济运行分析。',
      minAchievements: 4,
      effect: { network: 3, seniority: 3, health: -1 },
    },
    {
      group: '县政府部门正职', name: '县财政局局长', level: '正科级',
      description: '主持财政工作，负责预算管理、财政监督和政府债务风险防控。',
      minAchievements: 4,
      minIntegrity: 75,
      effect: { network: 3, integrity: 2, seniority: 2 },
    },
    {
      group: '县政府部门正职', name: '县自然资源局局长', level: '正科级',
      description: '主持自然资源管理、国土空间规划和不动产登记协调工作。',
      minAchievements: 4,
      effect: { network: 3, reputation: 2, health: -1 },
    },
  ],
  5: [
    {
      group: '县委常委岗位', name: '县委常委、统战部部长', level: '副处级',
      description: '负责统一战线、民族宗教、工商联和党外代表人士工作。',
      minAchievements: 8,
      effect: { network: 4, reputation: 2 },
    },
    {
      group: '县委常委岗位', name: '县委常委、政法委书记', level: '副处级',
      description: '统筹政法、平安建设、社会治理和信访维稳工作。',
      minAchievements: 8,
      minIntegrity: 75,
      effect: { network: 3, integrity: 2, health: -1 },
    },
    {
      group: '县政府领导岗位', name: '县政府党组成员、副县长（分管工业）', level: '副处级',
      description: '分管工业运行、招商引资、园区建设和企业服务。',
      minAchievements: 8,
      effect: { network: 3, seniority: 3, health: -1 },
    },
    {
      group: '县政府领导岗位', name: '县政府党组成员、副县长（分管城建）', level: '副处级',
      description: '分管住房城乡建设、城市更新、自然资源和交通项目。',
      minAchievements: 8,
      effect: { network: 3, reputation: 2, health: -2 },
    },
    {
      group: '市辖区党委岗位', name: '市辖区委常委、统战部部长', level: '副处级',
      description: '负责城区统一战线、民族宗教和党外人士联系服务工作。',
      minAchievements: 8,
      effect: { network: 4, reputation: 2 },
    },
    {
      group: '市辖区党委岗位', name: '市辖区委常委、纪委书记', level: '副处级',
      description: '主持城区纪检监察工作，负责监督执纪和党风廉政建设。',
      minAchievements: 8,
      minIntegrity: 80,
      effect: { integrity: 5, reputation: 2 },
    },
    {
      group: '县级市市委岗位', name: '县级市市委常委、组织部部长', level: '副处级',
      description: '负责县级市干部队伍、基层组织建设和人才工作。',
      minAchievements: 8,
      effect: { network: 4, seniority: 3, integrity: 1 },
    },
    {
      group: '县级市市委岗位', name: '县级市市委常委、宣传部部长', level: '副处级',
      description: '负责县级市宣传思想、意识形态、新闻舆情和文化建设。',
      minAchievements: 8,
      effect: { reputation: 4, network: 2 },
    },
  ],
  6: [
    {
      group: '县级市党政主官', name: '县级市市委副书记、市长', level: '正处级',
      description: '主持县级市政府全面工作，并以市委副书记身份参与市委领导。',
      minAchievements: 10,
      effect: { seniority: 4, reputation: 3, network: 4, health: -2 },
    },
    {
      group: '市委机关岗位', name: '市委组织部副部长', level: '正处级',
      description: '协助市委组织部长开展干部管理、考察任用和组织建设。',
      minAchievements: 10,
      effect: { network: 3, seniority: 3 },
    },
    {
      group: '市委机关岗位', name: '市委宣传部副部长', level: '正处级',
      description: '协助负责全市宣传思想、意识形态和文化发展工作。',
      minAchievements: 10,
      effect: { reputation: 4, network: 2 },
    },
    {
      group: '市委机关岗位', name: '市委政法委副书记（分管日常工作）', level: '正处级',
      description: '主持市委政法委日常工作，协助统筹全市政法、平安建设、信访和社会治理。',
      minAchievements: 10,
      minIntegrity: 75,
      effect: { network: 3, integrity: 2, health: -1 },
    },
    {
      group: '市政府部门正职', name: '市发展和改革委员会主任', level: '正处级',
      description: '主持市级发展改革工作，负责重大项目和经济运行统筹。',
      minAchievements: 10,
      effect: { network: 3, seniority: 3, health: -1 },
    },
    {
      group: '市政府领导岗位', name: '市政府党组成员、秘书长', level: '正处级',
      description: '主持市政府办公室工作，承担政府系统综合协调和政务运转。',
      minAchievements: 10,
      effect: { network: 3, seniority: 4, health: -1 },
    },
  ],
  7: [
    {
      group: '市委常委岗位', name: '市委常委、统战部部长', level: '副厅级',
      description: '负责全市统一战线、民族宗教、工商联和党外人士工作。',
      minAchievements: 12,
      effect: { network: 4, reputation: 2 },
    },
    {
      group: '市委常委岗位', name: '市委常委、政法委书记', level: '副厅级',
      description: '统筹全市政法、平安建设和社会治理工作。',
      minAchievements: 12,
      minIntegrity: 80,
      effect: { network: 4, integrity: 3, health: -1 },
    },
    {
      group: '市委常委岗位', name: '市委常委、秘书长', level: '副厅级',
      description: '负责市委机关运转、综合协调、督查和重大活动保障。',
      minAchievements: 12,
      effect: { network: 4, seniority: 4 },
    },
  ],
  8: [
    {
      group: '省政府组成部门岗位', name: '省政府秘书长', level: '正厅级',
      description: '负责省政府机关日常运转、综合协调和重大政务活动保障。',
      minAchievements: 14,
      effect: { network: 4, seniority: 4, health: -1 },
    },
    {
      group: '省政府组成部门岗位', name: '省发展和改革委员会主任', level: '正厅级',
      description: '主持全省发展改革工作，统筹重大项目、投资和经济运行。',
      minAchievements: 14,
      effect: { network: 4, seniority: 3, health: -1 },
    },
    {
      group: '省政府组成部门岗位', name: '省财政厅厅长', level: '正厅级',
      description: '主持全省财政工作，负责预算管理、财政监督和风险防控。',
      minAchievements: 14,
      minIntegrity: 80,
      effect: { network: 3, integrity: 3, seniority: 3 },
    },
  ],
  9: [
    {
      group: '省委常委岗位', name: '省委常委、统战部部长', level: '副部级',
      description: '负责全省统一战线、民族宗教和党外代表人士工作。',
      minAchievements: 16,
      effect: { network: 5, reputation: 3 },
    },
    {
      group: '省纪委监委岗位', name: '省纪委书记', level: '副部级',
      description: '主持省级纪检监察工作，负责监督执纪和反腐倡廉建设。',
      minAchievements: 16,
      minIntegrity: 85,
      effect: { integrity: 5, reputation: 2, network: 3 },
    },
  ],
  10: [
    {
      group: '省级人大岗位', name: '省人大常委会主任', level: '正部级',
      description: '主持省人大常委会工作，依法履行地方国家权力机关职责。',
      minAchievements: 18,
      effect: { reputation: 5, network: 4, health: -2 },
    },
  ],
};

module.exports = { EXTRA_POSITION_OPTIONS };
