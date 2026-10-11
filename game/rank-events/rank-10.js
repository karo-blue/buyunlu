// 职级 10 · 省部级正职（正部级）
//
// 权力边界：主政一省或一部。定全局、用干部、守底线。所有重大问题最终都要
// 在你这里定调。题目围绕"全局判断、底线意识与长久之功"。
// 50 道。

module.exports = [
  {
    title: '主政一省',
    scene: '到任之初，摆在你面前的是一份成绩单和一份问题清单。',
    options: [
      { text: '用三个月跑遍所有市州，把问题清单自己核一遍', performance: 3, effect: { reputation: 5, seniority: 4 }, result: '三个月后提出的思路，让全省上下心里有数。' },
      { text: '先听班子和部门汇报', performance: 1, effect: { reputation: 1 }, result: '听到了一套说法，还有几套没听到。' },
      { text: '沿用原有格局', performance: -1, effect: { reputation: -2 }, result: '格局沿用下来了，也没打开新局。' },
    ],
  },
  {
    title: '全省战略',
    scene: '要定未来五到十年的全省战略，几种意见相持不下。',
    options: [
      { text: '做扎实的省情再认识，把战略收敛到几条硬任务', performance: 3, effect: { reputation: 5, seniority: 5 }, result: '五年后回头看，这几条都落了地。' },
      { text: '折中各家意见', performance: 1, effect: { reputation: 1 }, result: '什么都写了，什么都没抓实。' },
      { text: '提出一个新提法', performance: -1, effect: { reputation: -2 }, result: '提法响了，事还是那些事。' },
    ],
  },
  {
    title: '省委全会',
    scene: '全会要通过一个影响深远的决定，会前争议不小。',
    options: [
      { text: '把争议充分摆开，形成共识后再上会', performance: 3, effect: { reputation: 4, seniority: 4, network: 3 }, result: '决定通过得很顺，执行也坚决。' },
      { text: '先把稿子磨好', performance: 1, effect: { reputation: 1 }, result: '稿子很好，共识没有形成。' },
      { text: '依靠表决通过', performance: -1, effect: { reputation: -2, network: -2 }, result: '通过了，执行中处处打折。' },
    ],
  },
  {
    title: '贯彻中央部署',
    scene: '中央有一项重大部署要落地，省情与之有落差。',
    options: [
      { text: '吃透精神，结合省情拿出可操作方案', performance: 3, effect: { reputation: 5, seniority: 4, integrity: 1 }, result: '结合得好，被作为经验推广。' },
      { text: '照搬照转', performance: 1, effect: { reputation: 1 }, result: '转下去了，基层不知道怎么干。' },
      { text: '选择性落实', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '督查时被发现落实不到位。' },
    ],
  },
  {
    title: '经济工作',
    scene: '经济下行压力大，既要稳增长又要防风险。',
    options: [
      { text: '把力气下在市场主体上，目标实事求是', performance: 3, effect: { reputation: 5, seniority: 3, integrity: 2 }, result: '当年不算亮眼，两年后反超。' },
      { text: '全力稳增长', performance: 1, effect: { reputation: 1, health: -1 }, result: '增速保住了，风险积累。' },
      { text: '在数字上想办法', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计造假被查，一把手首责。' },
    ],
  },
  {
    title: '高质量发展',
    scene: '要转到高质量发展上来，短期代价不小。',
    options: [
      { text: '明确取舍，把资源压到创新和质量上', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 1 }, result: '五年后结构明显优化。' },
      { text: '边转边看', performance: 1, effect: { reputation: 1 }, result: '转了几年，结构没变。' },
      { text: '先保速度', performance: -2, effect: { reputation: -3 }, result: '速度保住了，问题更重。' },
    ],
  },
  {
    title: '财政与债务',
    scene: '财政紧平衡，债务风险在积累。',
    options: [
      { text: '坚决遏制新增，用几年时间把存量降下来', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 4, health: -2 }, result: '五年后风险等级明显下降。' },
      { text: '边化债边发展', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '两头都不够。' },
      { text: '换个马甲继续借', performance: -4, effect: { reputation: -5, integrity: -5 }, result: '隐性债务越积越多。' },
    ],
  },
  {
    title: '营商环境',
    scene: '企业反映最集中的是"新官不理旧账"和执法不公。',
    options: [
      { text: '全省专项清理，把兑现和执法规范纳入硬约束', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3 }, result: '三年后投资信心明显恢复。' },
      { text: '出台新优惠政策', performance: 1, effect: { reputation: 1 }, result: '新政策出了，旧账还是没人认。' },
      { text: '强调诚信建设', performance: -1, effect: { reputation: -2 }, result: '强调完了，欠账还在。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营企业家信心不足，投资意愿下降。',
    options: [
      { text: '坦诚座谈，解决一批具体问题并公开结果', performance: 3, effect: { reputation: 5, network: 5, seniority: 3 }, result: '半年后投资开始回暖。' },
      { text: '出台扶持意见', performance: 1, effect: { reputation: 1 }, result: '意见出了，信心没回来。' },
      { text: '多表彰多鼓励', performance: -1, effect: { reputation: -2 }, result: '表彰了，该走的还是走了。' },
    ],
  },
  {
    title: '国资国企',
    scene: '省属国企大而不强，布局分散。',
    options: [
      { text: '按功能分类重组，主业聚焦，机制转换跟上', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '五年后整体竞争力明显提升。' },
      { text: '换一批负责人', performance: 1, effect: { reputation: 1 }, result: '人换了，布局没变。' },
      { text: '先做大', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '规模上去了，效益下来了。' },
    ],
  },
  {
    title: '金融风险',
    scene: '省内金融风险点多面广，有外溢迹象。',
    options: [
      { text: '建省级协调机制，早识别早处置，稳住预期', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3, health: -2 }, result: '风险逐个拆掉，没有发生系统性事件。' },
      { text: '盯住最紧迫的', performance: 1, effect: { reputation: 1 }, result: '最急的稳了，别的爆了。' },
      { text: '捂一捂', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '捂不住，风险集中爆发。' },
    ],
  },
  {
    title: '地方债风险',
    scene: '部分市县债务率已过高，还在上项目。',
    options: [
      { text: '坚决刹车，把化债作为硬约束纳入考核', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 4 }, result: '五年后高风险地区明显减少。' },
      { text: '谁家孩子谁抱走', performance: 1, effect: { reputation: 1 }, result: '抱不动的还是往上推。' },
      { text: '省里兜底', performance: -2, effect: { reputation: -2, integrity: -2 }, result: '兜了一次，后面都来要。' },
    ],
  },
  {
    title: '房地产市场',
    scene: '市场深度调整，交付压力和市场信心相互拖累。',
    options: [
      { text: '控增量、去库存、保交付、防风险一体推进', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3, health: -2 }, result: '三年后市场趋于平稳。' },
      { text: '先救一批大的', performance: 1, effect: { reputation: 1 }, result: '大的稳了，小的爆了。' },
      { text: '等政策', performance: -2, effect: { reputation: -3 }, result: '等到政策，已经耽误了大半年。' },
    ],
  },
  {
    title: '重大项目',
    scene: '一个影响全省格局的重大项目，论证有正反两面。',
    options: [
      { text: '把反对意见充分论证后再定，一旦定了就坚持', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 1 }, result: '十年后看，这一步很关键。' },
      { text: '先上再补论证', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '上了一半发现问题。' },
      { text: '久拖不决', performance: -2, effect: { reputation: -3 }, result: '窗口关了，机会没了。' },
    ],
  },
  {
    title: '基础设施',
    scene: '基础设施仍有短板，但投资空间在收窄。',
    options: [
      { text: '按效益排序，把钱花在能改变格局的地方', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '五年后关键瓶颈打通了。' },
      { text: '全面铺开', performance: 1, effect: { reputation: 1 }, result: '铺开了，效益普遍不高。' },
      { text: '先做看得见的', performance: -2, effect: { reputation: -3 }, result: '看得见的做了，瓶颈还在。' },
    ],
  },
  {
    title: '产业体系',
    scene: '产业体系大而不强，关键环节受制于人。',
    options: [
      { text: '聚焦几条链，一链一策补关键环节', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '五年后几条链真正站稳了。' },
      { text: '全面扶持', performance: 1, effect: { reputation: 1 }, result: '都扶了，都不强。' },
      { text: '引进大项目', performance: -1, effect: { reputation: -2 }, result: '项目来了，根扎不下去。' },
    ],
  },
  {
    title: '科技创新',
    scene: '创新资源不少，但转化不畅、协同不够。',
    options: [
      { text: '重构平台与机制，让企业出题、全省答题', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后创新对增长的支撑明显增强。' },
      { text: '加大财政投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，产出分散。' },
      { text: '引进大院大所', performance: -1, effect: { reputation: -2 }, result: '牌子挂了，跟产业没关系。' },
    ],
  },
  {
    title: '人才强省',
    scene: '人才引不进、留不住，各地政策互相抬高。',
    options: [
      { text: '省级统筹，按产业定清单，把舞台和生态做好', performance: 3, effect: { reputation: 4, seniority: 4, network: 4 }, result: '五年后人才净流入态势形成。' },
      { text: '加大补贴', performance: 1, effect: { reputation: 1 }, result: '补贴涨了，人还是留不住。' },
      { text: '各地各抢各的', performance: -2, effect: { reputation: -3, network: -2 }, result: '内耗严重，财政白花。' },
    ],
  },
  {
    title: '改革开放',
    scene: '一项改革牵动全省利益格局，阻力很大。',
    options: [
      { text: '先试点后推开，把利益调整方案一起做出来', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '两年后全面推开，没有大的震荡。' },
      { text: '强力推开', performance: 1, effect: { reputation: 1, network: -2 }, result: '推开了，反弹很厉害。' },
      { text: '先出方案', performance: -1, effect: { reputation: -2 }, result: '方案出了一年，没动。' },
    ],
  },
  {
    title: '对外贸易',
    scene: '外需走弱，外贸结构也需要调整。',
    options: [
      { text: '帮企业拓市场、调结构，同时打通通关堵点', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '那年全省外贸份额反而提升了。' },
      { text: '出台扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，落到企业手里慢。' },
      { text: '等形势好转', performance: -2, effect: { reputation: -3 }, result: '等来了更多企业外迁。' },
    ],
  },
  {
    title: '区域协调',
    scene: '省内区域差距明显，且有扩大趋势。',
    options: [
      { text: '分类施策，先补短板，同时建利益共享机制', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后差距开始收敛。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '钱给了，机制没变。' },
      { text: '集中做强核心区', performance: -2, effect: { reputation: -3, network: -3 }, result: '核心强了，差距更大。' },
    ],
  },
  {
    title: '城乡融合',
    scene: '城乡二元结构明显，要素流动不畅。',
    options: [
      { text: '以县域为单元统筹，把要素流动的通道打开', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '五年后县域经济明显活跃。' },
      { text: '继续加大农村投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制没变。' },
      { text: '鼓励进城', performance: -1, effect: { reputation: -2 }, result: '人进了城，配套没跟上。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '乡村振兴推进几年，产业同质、人才外流。',
    options: [
      { text: '按资源禀赋分类，把联农带农机制做实', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '五年后多数村有了稳定来源。' },
      { text: '继续投基础设施', performance: 1, effect: { reputation: 1 }, result: '设施好了，人还是往外走。' },
      { text: '集中做示范', performance: -1, effect: { reputation: -2 }, result: '示范很漂亮，面上没变。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '产粮大省要扛稳责任，但种粮收益偏低。',
    options: [
      { text: '保面积保产能，在收益和补贴机制上做文章', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 2 }, result: '五年后面积产量稳，农民收益也上去了。' },
      { text: '下指标压任务', performance: 1, effect: { reputation: 1 }, result: '指标下了，落实打折扣。' },
      { text: '在数字上做文章', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '核查时被发现。' },
    ],
  },
  {
    title: '生态保护',
    scene: '生态地位重要，发展与保护的张力长期存在。',
    options: [
      { text: '把红线钉死，同时把生态价值转化路径做出来', performance: 3, effect: { reputation: 5, seniority: 4, integrity: 2 }, result: '五年后保护和发展的关系顺了。' },
      { text: '以保为主', performance: 1, effect: { reputation: 1 }, result: '保住了，发展受限。' },
      { text: '先发展再治理', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '治理代价远高于当初的收益。' },
    ],
  },
  {
    title: '绿色转型',
    scene: '产业结构偏重，转型成本高、阵痛大。',
    options: [
      { text: '先立后破，把新动能先建起来再退旧的', performance: 3, effect: { reputation: 4, seniority: 5, health: -2 }, result: '五年后结构明显变轻。' },
      { text: '坚决压减', performance: 1, effect: { reputation: 1, network: -1 }, result: '压了，经济也下来了。' },
      { text: '运动式推进', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '一刀切引发诸多问题。' },
    ],
  },
  {
    title: '能源安全',
    scene: '能源保供和低碳转型要同时兼顾。',
    options: [
      { text: '先立后破，把供应能力建起来再调结构', performance: 3, effect: { reputation: 4, seniority: 4, health: -2 }, result: '五年后既保住了供应，结构也优化了。' },
      { text: '保供优先', performance: 1, effect: { reputation: 1 }, result: '保住了，转型落后。' },
      { text: '转型优先', performance: -1, effect: { reputation: -2 }, result: '转型快了，供应吃紧。' },
    ],
  },
  {
    title: '流域治理',
    scene: '一条重要江河的治理跨省跨市，协调难度极大。',
    options: [
      { text: '推动上下游联防联治和生态补偿', performance: 3, effect: { reputation: 5, network: 5, seniority: 4 }, result: '五年后水质稳定改善。' },
      { text: '管好自己这一段', performance: 1, effect: { reputation: 1 }, result: '自己这段清了，整体没变。' },
      { text: '等统一部署', performance: -1, effect: { reputation: -2 }, result: '等了几年，问题还在。' },
    ],
  },
  {
    title: '教育事业',
    scene: '教育发展与产业需求、人口变化都不匹配。',
    options: [
      { text: '跟着需求调结构，把产教融合和布局优化一起做', performance: 3, effect: { reputation: 4, seniority: 4, health: -1 }, result: '五年后教育与需求的匹配度明显提高。' },
      { text: '继续扩规模', performance: 1, effect: { reputation: 1 }, result: '规模上去了，就业更难。' },
      { text: '集中办名校', performance: -1, effect: { reputation: -2 }, result: '名校强了，整体没变。' },
    ],
  },
  {
    title: '卫生健康',
    scene: '优质医疗资源集中，基层能力不足。',
    options: [
      { text: '建高地与强基层并举，把分级诊疗做实', performance: 3, effect: { reputation: 5, seniority: 4, network: 2 }, result: '五年后外转率明显下降。' },
      { text: '建大医院', performance: 1, effect: { reputation: 1 }, result: '大医院更大，基层更弱。' },
      { text: '引进名医', performance: -1, effect: { reputation: -1 }, result: '名医来了又走。' },
    ],
  },
  {
    title: '社会保障',
    scene: '基金可持续压力上升，人口结构在变。',
    options: [
      { text: '扩面征缴与制度改革并举，把长期缺口补上', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 1 }, result: '五年后基金运行更稳。' },
      { text: '提高补助标准', performance: 1, effect: { reputation: 1 }, result: '补助涨了，缺口更大。' },
      { text: '等顶层设计', performance: -1, effect: { reputation: -2 }, result: '等了一年，什么也没变。' },
    ],
  },
  {
    title: '就业优先',
    scene: '总量压力和结构性矛盾同时存在。',
    options: [
      { text: '培训和岗位对接一起做，重点群体一对一', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '两年后重点群体就业明显改善。' },
      { text: '扩大培训规模', performance: 1, effect: { reputation: 1 }, result: '培训了很多，用不上。' },
      { text: '开发公益岗', performance: -1, effect: { reputation: -2 }, result: '岗位有限，结构问题没解。' },
    ],
  },
  {
    title: '住房问题',
    scene: '大城市住房突出问题与新市民需求交织。',
    options: [
      { text: '租购并举，保障性供给和租赁规范一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '五年后新市民住房压力明显缓解。' },
      { text: '多建保障房', performance: 1, effect: { reputation: 1 }, result: '建了，位置和配套不理想。' },
      { text: '稳定房价优先', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '房价稳了，居住问题没解。' },
    ],
  },
  {
    title: '民生实事',
    scene: '要办一批民生实事，钱紧，诉求多。',
    options: [
      { text: '按急难愁盼排序，办一件成一件', performance: 3, effect: { reputation: 5, seniority: 3 }, result: '五年办成一批，群众有实感。' },
      { text: '按部门报的办', performance: 1, effect: { reputation: 1 }, result: '办了不少，群众没感觉。' },
      { text: '做几个亮点', performance: -1, effect: { reputation: -2 }, result: '亮点有了，急事没办。' },
    ],
  },
  {
    title: '社会治理',
    scene: '矛盾集中在基层，化解资源在上面。',
    options: [
      { text: '资源下沉，把化解做早做小', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '三年后越级上访明显减少。' },
      { text: '加强排查', performance: 1, effect: { reputation: 1 }, result: '排查了，化解不了。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '压住一时，堆得更多。' },
    ],
  },
  {
    title: '平安建设',
    scene: '社会治安出现新的突出问题，群众安全感下降。',
    options: [
      { text: '打防结合、源头治理，交政法机关依法办、不干预个案', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 3 }, result: '两年后治安形势明显好转。' },
      { text: '集中打击', performance: 1, effect: { reputation: 1 }, result: '打了一阵又回来。' },
      { text: '打打招呼', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '打招呼的事，后患无穷。' },
    ],
  },
  {
    title: '安全生产',
    scene: '全省发生一起重大事故，影响很大。',
    options: [
      { text: '第一时间到现场，救人优先，如实上报，全省举一反三', performance: 3, effect: { reputation: 5, integrity: 3, health: -4, seniority: 2 }, result: '处置得当，全省安全形势随后明显好转。' },
      { text: '先处置再上报', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '被认定迟报漏报。' },
      { text: '控制消息', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '瞒报被查，从重追责。' },
    ],
  },
  {
    title: '应急体系',
    scene: '一次极端天气暴露出全省应急体系的短板。',
    options: [
      { text: '重构指挥和预案体系，搞实战化演练', performance: 3, effect: { reputation: 4, seniority: 4, health: -2 }, result: '下一次实战中响应明显更快。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案厚了，没人翻。' },
      { text: '配装备', performance: -1, effect: { reputation: -1 }, result: '装备有了，人不会用。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '极端天气频发，全省防灾能力不均衡。',
    options: [
      { text: '按风险区划分类施策，打通预警到响应的链条', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '下一次极端天气损失明显减小。' },
      { text: '加强值班值守', performance: 1, effect: { reputation: 1 }, result: '值班加强了，流程不清。' },
      { text: '事后救灾', performance: -2, effect: { reputation: -3 }, result: '救了灾，损失已经造成。' },
    ],
  },
  {
    title: '信访稳定',
    scene: '一批跨地区跨部门的积案，多年没有化解。',
    options: [
      { text: '亲自包最难的一件，逐案定责任定时限', performance: 3, effect: { reputation: 5, seniority: 3, health: -2 }, result: '两年后积案化解过半。' },
      { text: '交办下去', performance: 1, effect: { reputation: 1 }, result: '交办了，转一圈又回来。' },
      { text: '稳住就行', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '问题越积越多。' },
    ],
  },
  {
    title: '法治建设',
    scene: '全省法治环境评价不高，行政行为不规范问题突出。',
    options: [
      { text: '从制度入手，把程序和裁量规范起来，自己带头守规矩', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 4 }, result: '三年后法治环境明显改善。' },
      { text: '要求各地重视', performance: 1, effect: { reputation: 1 }, result: '重视了，还是照旧出错。' },
      { text: '协调一下个案', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '协调的事留下了记录。' },
    ],
  },
  {
    title: '统计工作',
    scene: '有迹象表明个别地方的数据不实。',
    options: [
      { text: '立即组织核查，发现一起查处一起，全省通报', performance: 3, effect: { reputation: 4, integrity: 5, seniority: 3 }, result: '查处之后，全省风气为之一正。' },
      { text: '要求自查自纠', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '自查结果全部合格。' },
      { text: '压着不查', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '被督查发现，一并追责。' },
    ],
  },
  {
    title: '审计监督',
    scene: '审计发现一条资金链上有系统性问题。',
    options: [
      { text: '全面整改并建长效机制，结果公开', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 3 }, result: '机制建起来后，同类问题基本消失。' },
      { text: '要求逐个整改', performance: 1, effect: { reputation: 1 }, result: '整改了，还会再犯。' },
      { text: '控制影响范围', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被公开通报。' },
    ],
  },
  {
    title: '政府自身建设',
    scene: '政府系统效率不高，形式主义仍有市场。',
    options: [
      { text: '从自身改起，把流程、责任、公开三件事做实', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 2 }, result: '两年后政府效能明显提升。' },
      { text: '发文件提要求', performance: 1, effect: { reputation: 1 }, result: '文件发了，没人当回事。' },
      { text: '开会强调', performance: -1, effect: { reputation: -2 }, result: '强调完了，还是那样。' },
    ],
  },
  {
    title: '数字政府',
    scene: '要建全省一体化平台，最怕建成空壳。',
    options: [
      { text: '先立共享硬规矩，从高频场景切入', performance: 3, effect: { reputation: 3, seniority: 4 }, result: '平台真用起来了，应用也多了。' },
      { text: '一次建全', performance: 1, effect: { reputation: 1 }, result: '建完了，没人用。' },
      { text: '先建大屏', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '大屏漂亮，数据不更新。' },
    ],
  },
  {
    title: '基层减负',
    scene: '基层报表多、证明多、留痕多，早已不堪重负。',
    options: [
      { text: '省级带头清，拉清单逐项删并公开', performance: 3, effect: { reputation: 5, seniority: 3 }, result: '清掉一半后，基层腾出了手。' },
      { text: '要求减少', performance: 1, effect: { reputation: 1 }, result: '要求提了，没人真删。' },
      { text: '先统计', performance: -1, effect: { reputation: -2 }, result: '统计本身又成了负担。' },
    ],
  },
  {
    title: '督查落实',
    scene: '很多部署落不下去，督查也督查不动。',
    options: [
      { text: '督查与激励并重，把干得好的树起来', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '一年后落实情况明显好转。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '选人用人',
    scene: '一批重要岗位要动，递话打招呼的不少。',
    options: [
      { text: '把标准立在前，全程留痕，打招呼的一律登记', performance: 3, effect: { reputation: 4, integrity: 5, seniority: 4 }, result: '这批人用得服众，往后递话的人少了。' },
      { text: '平衡各方', performance: 1, effect: { reputation: 1 }, result: '平衡了，能力匹配一般。' },
      { text: '用熟悉的', performance: -4, effect: { reputation: -5, integrity: -5, network: -2 }, result: '圈子一成形，风气就坏了。' },
    ],
  },
  {
    title: '全面从严治党',
    scene: '主体责任压得不实，有的领域问题易发多发。',
    options: [
      { text: '自己先领最难的责任，逐级约谈压实，支持监督机关', performance: 3, effect: { reputation: 5, integrity: 5, seniority: 4 }, result: '三年后政治生态明显好转。' },
      { text: '发文件提要求', performance: 1, effect: { reputation: 1 }, result: '文件发了，没人当回事。' },
      { text: '交给纪委', performance: -1, effect: { reputation: -2 }, result: '纪委扛不动主体责任。' },
    ],
  },
  {
    title: '廉政与家风',
    scene: '你的位置意味着你和家人都会被盯上。',
    options: [
      { text: '立规矩、公开回避、主动报备，家里人先说清楚', performance: 3, effect: { reputation: 3, integrity: 6, seniority: 3 }, result: '若干年后回看，这一条护住了你。' },
      { text: '自己严格，家里提醒一下', performance: 1, effect: { reputation: 1, integrity: 2 }, result: '提醒了，边界还模糊。' },
      { text: '相信家人不会出问题', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '出事时，是从家里开的口子。' },
    ],
  },
];
