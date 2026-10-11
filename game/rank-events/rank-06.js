// 职级 6 · 县处级正职（正处级）
//
// 权力边界：县域或部门一把手。人、财、事都要在你这里定盘子，也要为所有
// 结果兜底。题目围绕"一把手的判断、担当与边界"。
// 50 道。

module.exports = [
  {
    title: '到任履新',
    scene: '到任第一周，前任留下一份待办清单和几件没人敢碰的事。',
    options: [
      { text: '先跑遍所有乡镇和最难的几家企业，再定盘子', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '一个月后拿出的判断，让班子吃了一惊。' },
      { text: '先听四大班子汇报', performance: 1, effect: { reputation: 1 }, result: '听到了一套说法，还有几套没听到。' },
      { text: '先烧三把火立威', performance: -1, effect: { reputation: -2 }, result: '火烧起来了，也烧掉了支持。' },
    ],
  },
  {
    title: '首次常委会',
    scene: '第一次主持常委会，议题里有前任定下但你可能不认同的事。',
    options: [
      { text: '照常上会，让各位充分发表意见后再归纳', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '会开得稳，大家也开始敢说话。' },
      { text: '先把自己的意见亮出来', performance: 1, effect: { reputation: 1 }, result: '意见定了，会就没什么可议的了。' },
      { text: '把前任定的先翻掉', performance: -2, effect: { reputation: -3, network: -2 }, result: '翻了，也翻出了对立面。' },
    ],
  },
  {
    title: '县域战略',
    scene: '要定未来五年的发展定位，几种说法争执不下。',
    options: [
      { text: '请第三方做诊断，把比较优势摆清楚再定', performance: 3, effect: { reputation: 3, seniority: 3, network: 2 }, result: '定位定准了，五年没走弯路。' },
      { text: '沿用上一任的思路', performance: 1, effect: { reputation: 1 }, result: '沿用下来了，也没什么新气。' },
      { text: '按最新提法换个说法', performance: -1, effect: { reputation: -2 }, result: '说法变了，事还是那些事。' },
    ],
  },
  {
    title: '财政预算',
    scene: '预算编不出来，收入和支出的缺口很大。',
    options: [
      { text: '重新排优先级，压一般项目保基本民生和化债', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '紧着过了一年，没出风险。' },
      { text: '各部门都压一点', performance: 1, effect: { reputation: 1 }, result: '压完谁都喊疼。' },
      { text: '先过再说，缺口靠调度', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '年底调度不动，工资都差点发不出。' },
    ],
  },
  {
    title: '人事酝酿',
    scene: '一批重要岗位要动，各方递来的说法很多。',
    options: [
      { text: '定标准、走程序，动议过程全程留痕', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '调整的这批人服众，也没留下后患。' },
      { text: '多方平衡', performance: 1, effect: { reputation: 1 }, result: '平衡了，能力匹配度一般。' },
      { text: '用自己带来的人', performance: -3, effect: { reputation: -4, integrity: -3, network: -2 }, result: '本地干部开始离心。' },
    ],
  },
  {
    title: '重大决策',
    scene: '一个决定会影响未来十年，但眼前收益很诱人。',
    options: [
      { text: '做长周期评估，把不可逆的部分单独论证', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 1 }, result: '十年后看，这个决定是对的。' },
      { text: '集体决策，按多数意见定', performance: 1, effect: { reputation: 1 }, result: '定了，但没人真正负责。' },
      { text: '先干起来再说', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '干到一半发现走不通。' },
    ],
  },
  {
    title: '政府债务',
    scene: '存量债务滚不动了，还本付息压力集中到这两年。',
    options: [
      { text: '制定化债方案，盘资产、压支出、谈展期三管齐下', performance: 3, effect: { reputation: 4, integrity: 2, health: -2, seniority: 2 }, result: '两年后风险等级降了一档。' },
      { text: '借新还旧先扛过去', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '扛过去了一年，窟窿更大。' },
      { text: '向上要资金支持', performance: -1, effect: { reputation: -2 }, result: '要到了一点，条件很硬。' },
    ],
  },
  {
    title: '平台公司',
    scene: '几家平台公司政企不分，负债和职能都混在一起。',
    options: [
      { text: '清产核资，按功能分类转型，该并的并', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2, health: -1 }, result: '两年后平台有了自我造血能力。' },
      { text: '换一批人管理', performance: 1, effect: { reputation: 1 }, result: '人换了，机制没变。' },
      { text: '继续用它们融资', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '债越滚越多，最终还是要兜底。' },
    ],
  },
  {
    title: '重点项目',
    scene: '十几个重点项目同时铺开，资金和干部都跟不上。',
    options: [
      { text: '砍到五个，配最强的班子盯着干', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '五个全部按期建成，第二年更好争取。' },
      { text: '全部推进，能干多少算多少', performance: 1, effect: { reputation: 1, health: -2 }, result: '一半成了半拉子。' },
      { text: '先干领导关注的', performance: -1, effect: { reputation: -2 }, result: '关注点一变，项目就停。' },
    ],
  },
  {
    title: '土地出让',
    scene: '几块地要出让，市场不好，有人建议你找国企托底。',
    options: [
      { text: '按市场定价，找托底的事不做', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '出让价低了些，但账很干净。' },
      { text: '让国企托一下', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '账面好看了，国企的账留下了。' },
      { text: '找关系好的企业来拿', performance: -3, effect: { reputation: -4, integrity: -5 }, result: '拿地的企业后来出事，牵了出来。' },
    ],
  },
  {
    title: '城市经营',
    scene: '要搞一片新区，但现有建成区还有大量闲置。',
    options: [
      { text: '先盘活存量，新区缓一缓', performance: 3, effect: { reputation: 3, integrity: 1, seniority: 2 }, result: '存量起来了，新区也少了风险。' },
      { text: '新区先启动', performance: 1, effect: { reputation: 1 }, result: '新区起来了，老城更空。' },
      { text: '两头发力', performance: -1, effect: { reputation: -2 }, result: '两头都缺钱。' },
    ],
  },
  {
    title: '园区体制',
    scene: '园区和行政区的职能交叉，一件事要盖好几个章。',
    options: [
      { text: '理顺体制，园区专注经济，社会事务交回属地', performance: 3, effect: { reputation: 3, seniority: 2, network: 1 }, result: '理顺后招商效率明显提高。' },
      { text: '成立协调小组', performance: 1, effect: { reputation: 1 }, result: '小组成了又一个层级。' },
      { text: '维持现状', performance: -1, effect: { reputation: -2 }, result: '企业继续在两头跑。' },
    ],
  },
  {
    title: '招商体制',
    scene: '招商部门各自为政，同一个项目内部互相抢。',
    options: [
      { text: '建统一的项目库和信息共享机制，按产业分工', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '内耗没了，落地率提高。' },
      { text: '谁招到算谁的', performance: 1, effect: { reputation: 1 }, result: '抢得更厉害了。' },
      { text: '收归一个部门统管', performance: -1, effect: { reputation: -2, network: -1 }, result: '统管了，积极性也下去了。' },
    ],
  },
  {
    title: '营商环境',
    scene: '一家外地企业被本地同行挤兑，来找你告状。',
    options: [
      { text: '指定专班核查，依法处理并公开结果', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 1 }, result: '处理完，外地企业反而加大了投资。' },
      { text: '让主管部门去查', performance: 1, effect: { reputation: 1 }, result: '查了，结论是"证据不足"。' },
      { text: '劝外地企业入乡随俗', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '这家企业撤了，还带走了口碑。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '要推乡村振兴，钱有限，是做示范带还是普惠？',
    options: [
      { text: '普惠打底、示范引领，两笔钱分开算', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后既有亮点，面上也变了。' },
      { text: '集中做示范', performance: 1, effect: { reputation: 1 }, result: '示范很漂亮，别的村没动静。' },
      { text: '撒胡椒面', performance: -1, effect: { reputation: -2 }, result: '哪儿都没变样。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '要落实耕地保护和粮食面积，跟地方发展有冲突。',
    options: [
      { text: '先划死红线，再在存量上想办法提高产出', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '面积和产量都完成，也没耽误发展。' },
      { text: '完成任务优先', performance: 1, effect: { reputation: 1 }, result: '任务完成了，产出不高。' },
      { text: '在数字上达标', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '图斑比对时被发现。' },
    ],
  },
  {
    title: '生态环保督察',
    scene: '督察组指出一批问题，有几个是你任内上马的项目。',
    options: [
      { text: '照单认领，该停的停、该改的改，不找理由', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 1 }, result: '整改到位，督察组反馈评价正面。' },
      { text: '边改边说明困难', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '改了一半，说明也没被采纳。' },
      { text: '想办法沟通一下', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '沟通的事被作为典型通报。' },
    ],
  },
  {
    title: '巡视整改',
    scene: '巡视反馈点了一批人和事，其中有几件牵扯较深。',
    options: [
      { text: '逐件查清，该处理处理，同时把制度补上', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '整改扎实，上级给了肯定。' },
      { text: '处理几个轻的', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '处理了，深的水没动。' },
      { text: '保住人，处理事', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '回头看时全部翻出来。' },
    ],
  },
  {
    title: '治安整治',
    scene: '一个领域乱象多年，背后牵扯到一些本地关系。',
    options: [
      { text: '交政法机关依法办，自己不干预个案', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 1 }, result: '整治到位，也没留下干预的口子。' },
      { text: '集中打击一次', performance: 1, effect: { reputation: 1 }, result: '打了一阵，风头过了又回来。' },
      { text: '保住关系，缓一缓', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '乱象闹大了，一起被查。' },
    ],
  },
  {
    title: '信访稳定',
    scene: '一个群体性诉求，人数多、时间久、诉求有合理成分。',
    options: [
      { text: '亲自接访，把合理部分和政策边界一次说清', performance: 3, effect: { reputation: 4, health: -2, seniority: 1 }, result: '签了分批解决协议，人群散了。' },
      { text: '包案到人，稳控为主', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '稳住了，问题还在。' },
      { text: '先压下来', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '压不住，事情上去了。' },
    ],
  },
  {
    title: '安全生产',
    scene: '辖区出了较大事故，有人员伤亡。',
    options: [
      { text: '第一时间到现场，全力救援并按程序上报', performance: 3, effect: { reputation: 4, integrity: 2, health: -3 }, result: '处置得当，问责时也说得清。' },
      { text: '先处置，等清楚情况再报', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '被认定迟报。' },
      { text: '控制消息，先内部处理', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '瞒报被查，从重处理。' },
    ],
  },
  {
    title: '应急体系',
    scene: '几次小险情暴露出应急体系响应慢、职责不清。',
    options: [
      { text: '重构指挥体系，做几次不打招呼的演练', performance: 3, effect: { reputation: 3, seniority: 2, health: -2 }, result: '下一次真出事时，响应快了一倍。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案修订了，没人练。' },
      { text: '加强值班', performance: -1, effect: { reputation: -2 }, result: '值班加强了，还是乱。' },
    ],
  },
  {
    title: '公共卫生体系',
    scene: '一次突发公共卫生事件暴露出基层能力的薄弱。',
    options: [
      { text: '补基层能力和物资体系，把演练做成常态', performance: 3, effect: { reputation: 4, seniority: 2, health: -2 }, result: '下一次应对明显从容。' },
      { text: '建一个指挥中心', performance: 1, effect: { reputation: 1 }, result: '中心建了，基层还是薄弱。' },
      { text: '事后表彰一下', performance: -1, effect: { reputation: -2 }, result: '表彰完了，能力没变。' },
    ],
  },
  {
    title: '教育改革',
    scene: '优质教育资源集中在城区，农村学校空心化。',
    options: [
      { text: '做实质性集团化，教师轮岗落到人头和年限', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后农村学校回流了一批学生。' },
      { text: '硬件先补上', performance: 1, effect: { reputation: 1 }, result: '校舍新了，老师还是留不住。' },
      { text: '合并农村学校', performance: -1, effect: { reputation: -3 }, result: '合了，学生上学更远，家长意见大。' },
    ],
  },
  {
    title: '医疗改革',
    scene: '群众看病还是往外地跑，本地医院留不住病人。',
    options: [
      { text: '做实医共体，把人才和分配机制真正打通', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '两年后县域就诊率明显提高。' },
      { text: '引进设备', performance: 1, effect: { reputation: 1 }, result: '设备来了，会用的医生不够。' },
      { text: '跟外地大医院签合作', performance: -1, effect: { reputation: -1 }, result: '签了，病人还是往外跑。' },
    ],
  },
  {
    title: '社会保障',
    scene: '社保基金收支压力渐显，有几个群体还没覆盖到。',
    options: [
      { text: '先扩面征缴，把该保的保住', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '覆盖面扩大，基金也更稳。' },
      { text: '提高补助标准', performance: 1, effect: { reputation: 1 }, result: '标准提了，缺口更大。' },
      { text: '等上级政策', performance: -1, effect: { reputation: -2 }, result: '等了一年，什么也没变。' },
    ],
  },
  {
    title: '就业优先',
    scene: '一批企业用工减少，同时有一批人找不到活。',
    options: [
      { text: '摸清供需两侧，做定向培训和岗位对接', performance: 3, effect: { reputation: 4, seniority: 1, health: -1 }, result: '匹配率上去，就业形势稳住了。' },
      { text: '开发公益性岗位', performance: 1, effect: { reputation: 1 }, result: '岗位有限，杯水车薪。' },
      { text: '给企业稳岗补贴', performance: -1, effect: { reputation: -1 }, result: '补了，企业还是减员。' },
    ],
  },
  {
    title: '统计工作',
    scene: '几个主要指标掉得厉害，有人建议"做做工作"。',
    options: [
      { text: '照实报，把下滑原因和对策一起报上去', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 1 }, result: '上级认可了态度，还给了支持。' },
      { text: '微调一下', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '微调后越来越难圆。' },
      { text: '布置口径', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计造假被立案，一把手首责。' },
    ],
  },
  {
    title: '审计整改',
    scene: '审计报告里有一笔支出说不清，是前任留下的。',
    options: [
      { text: '如实说明并配合，同时健全制度', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '处理干净，自己也撇清了。' },
      { text: '要求经手人补说明', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '说明补了，还是说不清。' },
      { text: '想办法平掉', performance: -4, effect: { reputation: -5, integrity: -5 }, result: '平账的事，你成了经手人。' },
    ],
  },
  {
    title: '法治建设',
    scene: '一项行政决定被申请复议，可能站不住。',
    options: [
      { text: '请法制部门复查，错的就主动撤销', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '主动纠错反而没影响公信。' },
      { text: '坚持原决定', performance: 1, effect: { reputation: 1 }, result: '被撤销，执行也受影响。' },
      { text: '做对方工作撤回申请', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '撤回的事被对方留了证。' },
    ],
  },
  {
    title: '政务公开',
    scene: '有人申请公开一批信息，其中有你们不太想公开的。',
    options: [
      { text: '依法公开，不能公开的说明法律依据', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '公开后没人再追究。' },
      { text: '能不公开就不公开', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '被复议，还是要公开。' },
      { text: '拖着不答复', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '超期答复被通报。' },
    ],
  },
  {
    title: '数字政府',
    scene: '要上一个大平台，投入不小，各部门系统都是孤岛。',
    options: [
      { text: '先定数据共享的硬规则，再建平台', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '平台真用起来了，重复录入没了。' },
      { text: '先建平台再推共享', performance: 1, effect: { reputation: 1 }, result: '平台建了，数据还是不通。' },
      { text: '各部门各建各的', performance: -2, effect: { reputation: -3 }, result: '又多了几个孤岛。' },
    ],
  },
  {
    title: '政务服务',
    scene: '群众办事还是多头跑，一次没办成。',
    options: [
      { text: '自己暗访一次，把流程重做成一件事一次办', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '改革后跑动次数少了一大半。' },
      { text: '优化窗口设置', performance: 1, effect: { reputation: 1 }, result: '窗口多了，流程没变。' },
      { text: '加大宣传告知', performance: -1, effect: { reputation: -2 }, result: '告知清楚了，还是要跑。' },
    ],
  },
  {
    title: '干部作风',
    scene: '干部队伍里躺平的多，干事的少，追责也追不动。',
    options: [
      { text: '树标杆、给舞台、真容错，同时动几个不干事的', performance: 3, effect: { reputation: 4, network: 3, seniority: 2 }, result: '一年后主动干活的人多起来了。' },
      { text: '加强考核', performance: 1, effect: { reputation: 1 }, result: '考核多了，应付也多了。' },
      { text: '开会批评', performance: -1, effect: { reputation: -2 }, result: '批评完了，还是那样。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你身边一位共事多年的同事被反映有问题。',
    options: [
      { text: '按规定回避，交纪检监察机关依规办理', performance: 3, effect: { reputation: 3, integrity: 4 }, result: '处理干净，也没人说你护短。' },
      { text: '先找他谈一次', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '谈了，反而给了串供的时间。' },
      { text: '出面担保', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '担保的事，把你一起卷进去。' },
    ],
  },
  {
    title: '领导班子',
    scene: '班子里有两位长期不和，已经影响到工作推进。',
    options: [
      { text: '分别谈，把职责和边界重新划清，必要时调整', performance: 3, effect: { reputation: 3, seniority: 2, network: 1 }, result: '调整后班子重新形成合力。' },
      { text: '在会上强调团结', performance: 1, effect: { reputation: 1 }, result: '强调了，私下还是那样。' },
      { text: '各用各的，避免交集', performance: -1, effect: { reputation: -2 }, result: '工作被切成两半。' },
    ],
  },
  {
    title: '上级调研',
    scene: '主要领导要来调研，既要好看也要真实。',
    options: [
      { text: '照实准备，亮点和问题都讲，请求指导', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '领导现场给了支持政策。' },
      { text: '精心准备几个点', performance: 1, effect: { reputation: 1 }, result: '看完了，没留下什么。' },
      { text: '布置一个点', performance: -3, effect: { reputation: -4, integrity: -3 }, result: '领导临时改路线，直接露馅。' },
    ],
  },
  {
    title: '区域协作',
    scene: '邻县想一起做一件跨区域的事，利益怎么分还没谈。',
    options: [
      { text: '先谈成本和收益分担机制，再谈项目', performance: 3, effect: { reputation: 3, network: 3, seniority: 2 }, result: '机制定了，项目推进很顺。' },
      { text: '先签框架', performance: 1, effect: { reputation: 1 }, result: '签了，一谈细节就卡。' },
      { text: '只做对自己有利的部分', performance: -2, effect: { reputation: -3, network: -2 }, result: '对方也不配合了。' },
    ],
  },
  {
    title: '对口支援',
    scene: '要承接一批对口支援任务，本地也有困难。',
    options: [
      { text: '结合双方需要找结合点，做成长期协作', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '协作做实了，两边都有收益。' },
      { text: '按要求完成任务', performance: 1, effect: { reputation: 1 }, result: '任务完成了，没有后劲。' },
      { text: '能少做就少做', performance: -2, effect: { reputation: -3 }, result: '被通报，也失了机会。' },
    ],
  },
  {
    title: '灾后重建',
    scene: '一场灾害过后，重建任务和资金压力都很大。',
    options: [
      { text: '先保障安置，再做规划重建，把标准提上去', performance: 3, effect: { reputation: 5, seniority: 2, health: -3 }, result: '重建后的抗灾能力明显提高。' },
      { text: '按原样恢复', performance: 1, effect: { reputation: 1 }, result: '恢复了，下次还是一样。' },
      { text: '先争取资金再动', performance: -1, effect: { reputation: -2 }, result: '群众在板房里过了一冬。' },
    ],
  },
  {
    title: '舆情危机',
    scene: '一件事发酵成全国性话题，你处在风暴中心。',
    options: [
      { text: '主动发声，说清事实、认错、给时间表', performance: 3, effect: { reputation: 4, health: -3, integrity: 1 }, result: '一周后舆论转向，上级也认可处置。' },
      { text: '等上级统一安排', performance: 1, effect: { reputation: 1 }, result: '等到了安排，话题已经换了几轮。' },
      { text: '找渠道压热度', performance: -4, effect: { reputation: -5, integrity: -4 }, result: '压热度的事本身成了新话题。' },
    ],
  },
  {
    title: '突发事件',
    scene: '凌晨接到报告，辖区内发生重大险情。',
    options: [
      { text: '立即到现场成立指挥部，边救边报', performance: 3, effect: { reputation: 5, health: -3, seniority: 2 }, result: '处置及时，损失降到最低。' },
      { text: '在指挥部远程调度', performance: 1, effect: { reputation: 1 }, result: '调度了，现场缺主心骨。' },
      { text: '等天亮再说', performance: -4, effect: { reputation: -6, integrity: -3 }, result: '错过了最佳处置窗口。' },
    ],
  },
  {
    title: '年底冲刺',
    scene: '年底指标还差一截，下面已经开始想办法了。',
    options: [
      { text: '明确说不许造假，能完成多少算多少', performance: 3, effect: { reputation: 3, integrity: 4 }, result: '指标差了一点，但账是干净的。' },
      { text: '加码压下去', performance: 1, effect: { reputation: 1, health: -1 }, result: '压出了数字，也压出了怨气。' },
      { text: '默许下面想办法', performance: -4, effect: { reputation: -5, integrity: -5 }, result: '年报被人质疑，核查找上门。' },
    ],
  },
  {
    title: '述职评议',
    scene: '要向全委会述职，今年的成绩和失误都很清楚。',
    options: [
      { text: '成绩讲足，问题讲透，明年清单具体', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 1 }, result: '评议结果很好，也立住了威信。' },
      { text: '重点讲成绩', performance: 1, effect: { reputation: 1 }, result: '讲完了，评价一般。' },
      { text: '把问题归咎于客观', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '评议时有人当面提了意见。' },
    ],
  },
  {
    title: '干部任免',
    scene: '一个关键岗位要定人，能力强但风评有争议。',
    options: [
      { text: '把争议查清，能澄清的澄清，不能澄清的不用', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 2 }, result: '澄清后用了，这个人后来干得很好。' },
      { text: '用能力强的', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '用了，议论一直没断。' },
      { text: '用没争议的', performance: -1, effect: { reputation: -1 }, result: '没争议，也没能力。' },
    ],
  },
  {
    title: '重大工程',
    scene: '一个投资很大的工程要上，反对意见认为不划算。',
    options: [
      { text: '做全周期论证，把反对意见写进报告再决策', performance: 3, effect: { reputation: 3, seniority: 3, integrity: 1 }, result: '十年后看，这个工程是值的。' },
      { text: '上会定', performance: 1, effect: { reputation: 1 }, result: '定了，反对的人保留意见。' },
      { text: '先干，边干边看', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '干到一半发现收益远低于预期。' },
    ],
  },
  {
    title: '民生票决',
    scene: '民生实事票决结果出来了，几项花钱多、见效慢。',
    options: [
      { text: '尊重票决结果，分步实施并公开进度', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '几年后这几项成了最有口碑的事。' },
      { text: '调整成见效快的', performance: 1, effect: { reputation: 1 }, result: '见效快，群众不买账。' },
      { text: '先办一部分', performance: -1, effect: { reputation: -2 }, result: '票决的公信力打了折。' },
    ],
  },
  {
    title: '企业纾困',
    scene: '本地一家龙头遇到困难，牵动上下游很多人就业。',
    options: [
      { text: '分清是流动性还是竞争力问题，分类施策', performance: 3, effect: { reputation: 4, network: 2, seniority: 1 }, result: '该救的救回来了，该退的有序退出。' },
      { text: '全力保住', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '保住了，代价很大。' },
      { text: '市场化出清', performance: -1, effect: { reputation: -2 }, result: '出清了，就业压力集中爆发。' },
    ],
  },
  {
    title: '政策落地',
    scene: '一项好政策推了一年，基层还是老样子。',
    options: [
      { text: '查清是能力、动力还是机制问题，对症下药', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '第二年政策真正落了地。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查了，基层应付。' },
      { text: '换一批人', performance: -1, effect: { reputation: -2, network: -1 }, result: '换了人，机制还是那样。' },
    ],
  },
  {
    title: '离任交接',
    scene: '你要离开这个岗位了，手里还有几件没做完的事。',
    options: [
      { text: '逐件写清来龙去脉、风险和下一步，当面交给接任者', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 2 }, result: '离任后口碑还在，接任者年年登门。' },
      { text: '按常规交接', performance: 1, effect: { reputation: 1 }, result: '交接完了，几件事后来爆了。' },
      { text: '挑漂亮的写', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '接任者吃了亏，话说得很难听。' },
    ],
  },
];
