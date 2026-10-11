// 手写扩展事件库。
// 为什么单独放一个文件：data-full.js 由 tools/convert-source-data.js 从源数据机械生成，
// 任何手写内容写进去都会被下一次 `npm run extract:source-data` 覆盖。
//
// 选项基础字段（与源数据一致）：text / performance / effect / result
// 本文件额外支持的字段（由 game/core.js 解释）：
//   minRank   仅当 state.rankIndex >= minRank 时该事件才进入抽选池
//   tag       分类标签，便于统计与测试
//   upgraded  条件强化：state 满足 upgraded.require 时，整条选项替换为更强的版本
//   roll      概率分支：按 chance（可用 attr / perPoint 按属性修正）随机走 success 或 fail
//
// 写作约束：
//   1. 不出现真实人名、真实机构、真实案件；
//   2. 违规选项必须付出可见代价（廉政、口碑、人脉），不做"违规还赢"；
//   3. 不写行贿的具体金额、渠道、话术与操作步骤，只写"诱惑出现"和"代价落地"。
// 场景取自基层与机关日常里出现频率最高的那几类事项。

const EXTRA_COMMON_EVENTS = [
  // ── 基层事务：真实高频 ─────────────────────────────────────────────
  {
    tag: '基层事务',
    minRank: 1,
    title: '上级检查 · 台账留痕',
    scene: '检查组两天后到，办公室通知各站所把近一年台账补齐。有两件事当时办完了却没留档，只剩工作群里的聊天记录能证明。',
    options: [
      { text: '按记录如实补录，并在备注里写明材料来源', performance: 3, effect: { integrity: 2, reputation: 3 }, result: '检查顺利通过，补录说明写得清楚，没有留下新的问题。' },
      { text: '照格式先把材料做齐，来源以后再说', performance: 1, effect: { reputation: 1, seniority: 1 }, result: '材料形式上齐全，但你清楚其中有几处经不起追问。' },
      { text: '说明是当时经办人没交，与自己无关', performance: -1, effect: { reputation: -4, network: -2 }, result: '责任推出去了，但同事从此对你多了一层提防。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 1,
    title: '领导调研 · 接待安排',
    scene: '上级领导临时到镇里调研，办公室问你中午怎么安排。附近只有一家条件不错的饭店。',
    options: [
      { text: '按工作餐标准安排在镇食堂，如实说明', performance: 3, effect: { integrity: 3, reputation: 2 }, result: '领导吃得简单，反而多问了几句实际情况，调研很实在。' },
      { text: '在饭店订一桌，费用走别的科目', performance: -1, effect: { integrity: -5, reputation: 1, wealth: -800 }, result: '场面好看，但账目上多了一笔需要解释的支出。' },
      { text: '让企业老板帮忙安排并买单', performance: -1, effect: { integrity: -7, network: 2 }, result: '饭局是别人结的账，这张人情以后是要还的。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 1,
    title: '群众信访 · 初次接待',
    scene: '一位群众第八次来反映宅基地纠纷，前几次都被告知"再等等"。这次他带着一摞材料，情绪明显上来了。',
    options: [
      { text: '当场把材料过一遍，列出办理节点和责任人', performance: 3, effect: { reputation: 5, network: 2 }, result: '群众看到明确的节点，情绪先稳了下来，事情进入正常办理。' },
      { text: '按流程收下材料，告知等待答复', performance: 1, effect: { seniority: 1 }, result: '材料收下了，但对方临走时的表情说明他并不放心。' },
      { text: '解释权限不在镇里，建议他往上反映', performance: -1, effect: { reputation: -4 }, result: '事情推了出去，但矛盾也往上一级走了一步。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 1,
    title: '周末的急件',
    scene: '周六傍晚，工作群来了通知，要求次日上午报一份汇总表。表里的数据分散在三个站所，只有你能凑齐。',
    options: [
      { text: '当晚逐个沟通，把表准时报上去', performance: 3, effect: { reputation: 3, seniority: 2, health: -2 }, result: '材料按时报出，牵头部门记住了你的配合。' },
      { text: '先报已知部分，注明其余周一补齐', performance: 1, effect: { seniority: 1, reputation: 1 }, result: '表交上去了，但被要求周一再补一次。' },
      { text: '在群里说明周末无法完成，等周一', performance: -1, effect: { reputation: -2, health: 1 }, result: '你保住了周末，也在牵头部门那里留下了一次不配合的记录。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 2,
    title: '跨部门协调 · 谁牵头',
    scene: '一项工作需要三个部门配合，谁都不愿牵头。会开了两次，纪要上仍是"各负其责"。',
    options: [
      { text: '主动牵头，把分工和时限写清楚报上去', performance: 3, effect: { reputation: 4, network: 3, health: -1 }, result: '你接下了最难的部分，但事情第一次有了明确进度。' },
      { text: '建议由分管领导出面协调', performance: 1, effect: { seniority: 2 }, result: '领导出面后事情动了起来，只是你的主动也被记了一笔。' },
      { text: '先按现有分工推进自己能做的部分', performance: 1, effect: { seniority: 1, reputation: -1 }, result: '你完成了自己的那一块，整体进度仍卡在协调上。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '项目验收 · 材料补签',
    scene: '项目要赶在本月完成验收，但有两道关键工序的现场记录缺失。施工方希望先签字，资料随后补。',
    options: [
      { text: '不予签字，要求补齐现场记录后重新验收', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '验收推迟了几天，但程序上没有留下缺口。' },
      { text: '先签字，要求三天内补齐资料', performance: -1, effect: { integrity: -4, network: 2 }, result: '资料后来补上了，但签字那一刻的风险已经留在档案里。' },
      { text: '只签非关键部分，关键工序等记录', performance: 1, effect: { seniority: 2, integrity: 1 }, result: '你把风险压在了可控范围内，双方都接受。' },
      { text: '请分管领导一起到场后再定', performance: 1, effect: { network: 1, seniority: 1 }, result: '决定由集体作出，责任也被分担了。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 2,
    title: '安全生产 · 限期整改',
    scene: '检查发现一家小加工厂消防通道被货物堵住，按规定要停业整改。老板表示订单正紧，停一天损失很大。',
    options: [
      { text: '当场下达整改通知，先清通道再谈复工', performance: 3, effect: { integrity: 3, reputation: 3 }, result: '通道当晚清空，隐患消除，老板也承认自己疏忽。' },
      { text: '给三天期限，期间要求自行整改', performance: 1, effect: { seniority: 1, reputation: -1 }, result: '工厂整改了，但这三天里风险一直存在。' },
      { text: '口头提醒，不走过场开单', performance: -1, effect: { integrity: -5, reputation: -2 }, result: '你给对方留了面子，也给自己留了一个说不清的责任。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '环保督察 · 邻村偷排',
    scene: '环保督察组交办一条线索：邻村一家小作坊夜间偷排。这家作坊的负责人是本地老熟人，和你打过几次交道。',
    options: [
      { text: '按要求核查取证，一视同仁上报', performance: 3, effect: { integrity: 5, reputation: 3, network: -2 }, result: '问题被查实并依法处理，你在熟人圈里落了个"不好说话"。' },
      { text: '先通知对方自行整改，再决定是否上报', performance: -1, effect: { integrity: -5, network: 2 }, result: '作坊停了几天又开工，督察组第二次交办时你解释不清。' },
      { text: '核查后发现情节轻微，如实上报但建议从轻', performance: 1, effect: { integrity: 2, seniority: 1 }, result: '处理依法依规，也把实际情况写进了报告。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '征地补偿 · 标准争议',
    scene: '同一片地被划进两个补偿档次，边界上的几户认为自己被划低了，集体到指挥部要说法。',
    options: [
      { text: '公示测算依据，逐户核对，确有误差立即更正', performance: 3, effect: { integrity: 3, reputation: 5 }, result: '几户的误差被更正，其余人也接受了结果。' },
      { text: '坚持既有方案，解释标准不容更改', performance: 1, effect: { seniority: 1, reputation: -2 }, result: '方案没有改动，但矛盾被压到了后面。' },
      { text: '为求尽快签约，私下承诺个别照顾', performance: -1, effect: { integrity: -6, reputation: 1 }, result: '有人签了，也有人听说了"能私下谈"，反而更不肯签。' },
      { text: '请评估机构重新测算边界地块', performance: 3, effect: { reputation: 3, network: 1, seniority: 1 }, result: '第三方结论让各方都无话可说，签约进度明显加快。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 3,
    title: '媒体来访 · 突发舆情',
    scene: '一位记者突然到镇里，想了解前几天一起纠纷的处理情况，并要求当天给出答复，否则先发稿再核实。',
    options: [
      { text: '如实说明进展和依据，请对方给一天核实时间', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '记者接受了核实安排，报道基本客观，没有引出次生舆情。' },
      { text: '以"需请示"为由不作任何回应', performance: -1, effect: { reputation: -5 }, result: '报道只采用了单方面说法，你随后花了更多力气解释。' },
      { text: '先请宣传部门出面统一口径再回应', performance: 1, effect: { seniority: 2, reputation: 1 }, result: '口径统一了，回应虽慢半拍，但没有说错话。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 4,
    title: '招商引资 · 政策开口子',
    scene: '一家企业表示愿意落户，但要求土地价格和税收返还上给"特殊政策"，并暗示周边地区都给。',
    options: [
      { text: '在现有政策框架内测算，能给多少给多少，说清底线', performance: 3, effect: { integrity: 3, reputation: 3, network: 1 }, result: '企业最终按政策落地，你也没有留下后续要兑现的口头承诺。' },
      { text: '先口头答应下来，把企业签进来再说', performance: -1, effect: { integrity: -6, network: 3 }, result: '项目签了，但那个口头承诺成了以后每年都要面对的麻烦。' },
      { text: '请上级明确政策边界后再谈', performance: 1, effect: { seniority: 2 }, result: '边界清楚了，谈判节奏也慢了下来。' },
    ],
  },
  {
    tag: '基层事务',
    minRank: 4,
    title: '数据口径 · 报表怎么填',
    scene: '年度报表要求上报一项指标，按现有统计口径算出来不好看。有人建议"按预计完成数"填报。',
    options: [
      { text: '按实际数上报，同时附上完成情况和原因说明', performance: 3, effect: { integrity: 4, reputation: 2 }, result: '数字不好看，但说明写得扎实，上级反而认可了你的实事求是。' },
      { text: '按预计完成数填报，反正年底能补上', performance: -1, effect: { integrity: -5, reputation: -1 }, result: '数字好看了，但年底一旦补不上，解释起来更难。' },
      { text: '两个数字都报，由上级决定采用哪个', performance: 1, effect: { seniority: 1, integrity: 1 }, result: '选择权交了出去，责任也随之减轻。' },
    ],
  },

  // ── 两难题：两个选项都有理，也都要付代价 ────────────────────────────
  {
    tag: '两难',
    minRank: 3,
    title: '两难 · 工期与程序',
    scene: '重点项目要赶在雨季前完成主体，施工方提出先开工、后补手续，说"本地项目都是这个节奏"。',
    options: [
      { text: '先保工期，手续边干边补', performance: 1, effect: { network: 3, reputation: 1, integrity: -3 }, result: '工期保住了，但那段手续成了以后每次检查都要解释的部分。' },
      { text: '先补齐手续再开工，工期压力自己扛', performance: 1, effect: { integrity: 3, reputation: -2, network: -1 }, result: '程序上没有瑕疵，工期耽误的责任全部落在你这一侧。' },
    ],
  },
  {
    tag: '两难',
    minRank: 3,
    title: '两难 · 稳定与依法',
    scene: '十几户居民因补偿问题堵住了施工便道，要求当天答复。依法处置会激化情绪，继续协商则影响整体进度。',
    options: [
      { text: '坚持依法依规，明确告知堵路的法律后果', performance: 1, effect: { integrity: 3, reputation: -2, network: -1 }, result: '便道恢复通行，但你在部分群众那里的评价短期下降了。' },
      { text: '先承诺研究诉求，劝离后再逐户做工作', performance: 1, effect: { reputation: 3, network: 2, integrity: -2, seniority: -1 }, result: '人群散了，承诺也记在了群众心里，接下来必须兑现。' },
    ],
  },
  {
    tag: '两难',
    minRank: 5,
    title: '两难 · 老同事的失误',
    scene: '一位共事多年的老同事在项目上出了纰漏，按规定要追责。他私下找你，希望"内部提醒一下就算了"。',
    options: [
      { text: '按规定如实上报，同时帮他梳理补救方案', performance: 1, effect: { integrity: 4, network: -3 }, result: '追责照章进行了，你也尽力把损失压到了最小，但这段交情冷了。' },
      { text: '内部提醒并督促整改，先不上报', performance: 1, effect: { network: 3, integrity: -3 }, result: '问题在内部消化了，但这个处理方式本身成了你以后的把柄。' },
    ],
  },
  {
    tag: '两难',
    minRank: 5,
    title: '两难 · 数字与实情',
    scene: '上级要求上报一项工作进度，实际情况明显低于预期。如实上报会影响全单位评价，虚报则以后要圆。',
    options: [
      { text: '如实上报，并附上原因分析和补救计划', performance: 1, effect: { integrity: 4, reputation: -2 }, result: '单位评价受了影响，但你保住了说真话的底气。' },
      { text: '按目标口径上报，年内想办法补回来', performance: 1, effect: { reputation: 3, integrity: -4 }, result: '数据好看了，接下来每个月都要为这个数字继续找补。' },
    ],
  },

  // ── 复杂题：多方案权衡 ─────────────────────────────────────────────
  {
    tag: '复杂',
    minRank: 4,
    title: '复杂 · 群体诉求处置',
    scene: '二十多户居民因安置问题集体到镇里反映，情绪激动，门外还来了两家媒体。现场需要你立刻拿出处置思路。',
    options: [
      { text: '先安排代表进会议室，逐条记录诉求并当场定节点', performance: 3, effect: { reputation: 5, network: 2 }, result: '人群分批散去，诉求进入书面流程，当天没有失控。' },
      { text: '请分管领导出面接待，自己负责现场秩序', performance: 1, effect: { seniority: 2, reputation: 1 }, result: '领导接了访，现场平稳，但后续落实仍然要靠你。' },
      { text: '以维稳为由先劝返，事后再逐一约谈', performance: -1, effect: { reputation: -4, network: -1 }, result: '人散了，但"被劝返"的说法很快传开，第二次人更多。' },
      { text: '现场核对材料，能当场答复的当场答复', performance: 3, effect: { integrity: 2, reputation: 4, network: 1 }, result: '当场解决了三户的具体问题，其余人看到了诚意。' },
      { text: '先请法律顾问到场，明确政策与法律边界', performance: 1, effect: { integrity: 3, seniority: 1, reputation: 1 }, result: '答复有了依据，节奏放缓但每一步都站得住。' },
    ],
  },
  {
    tag: '复杂',
    minRank: 6,
    title: '复杂 · 重大项目方案',
    scene: '一个上亿元的重点项目要定实施方案，三套方案各有取舍：进度快的成本高，成本低的影响群众，折中方案风险不明。',
    options: [
      { text: '选进度优先方案，抢在节点前形成实物量', performance: 1, effect: { network: 3, reputation: 2, wealth: -3000 }, result: '节点赶上了，但成本压力在后面几年持续存在。' },
      { text: '选成本优先方案，把群众沟通放到前面做', performance: 1, effect: { reputation: 3, network: -1 }, result: '预算控制住了，前期沟通花掉了大量精力。' },
      { text: '委托第三方做风险评估后再决策', performance: 3, effect: { integrity: 2, seniority: 2, reputation: 2 }, result: '评估指出了折中方案的两处隐患，决策变得有依据。' },
      { text: '分阶段实施，先做争议最小的一段', performance: 3, effect: { reputation: 3, network: 1, seniority: 1 }, result: '首段顺利落地，后续推进时阻力小了很多。' },
    ],
  },
  {
    tag: '复杂',
    minRank: 6,
    title: '复杂 · 干部推荐',
    scene: '一个关键岗位要推荐人选，有三个人进入视野：业务最熟的、群众基础最好的、以及老领导打过招呼的。',
    options: [
      { text: '按岗位需要和考察情况推荐业务最熟的人', performance: 3, effect: { integrity: 3, reputation: 2, network: -2 }, result: '人岗匹配，工作接得上，但你得罪了打招呼的那条线。' },
      { text: '推荐群众基础最好的人，稳妥不出错', performance: 1, effect: { reputation: 2, seniority: 1 }, result: '推荐平稳落地，岗位业务磨合期比预期长。' },
      { text: '照顾老领导的面子，推荐打过招呼的人', performance: -1, effect: { network: 3, integrity: -5, reputation: -2 }, result: '人情还上了，但这个岗位的短板很快显现出来。' },
      { text: '把三人材料一并上报，说明各自优劣，由集体研究', performance: 3, effect: { integrity: 2, seniority: 2 }, result: '决定由集体作出，程序上挑不出毛病。' },
    ],
  },

  // ── 人情与规矩：权力寻租的苗头 ─────────────────────────────────────
  {
    tag: '人情规矩',
    minRank: 2,
    title: '婚丧喜庆 · 怎么办',
    scene: '家里办喜事，同事、下属和一些打过交道的企业负责人都表示要来。规模一旦放开，很难收住。',
    options: [
      { text: '按规定报备，只请亲友，明确不收礼金', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '场面简单，事后没有任何需要解释的地方。' },
      { text: '小范围办几桌，熟人随礼不好推', performance: 1, effect: { integrity: -2, network: 2 }, result: '喜事办得体面，但礼金往来在往后几年里陆续需要"还"。' },
      { text: '分几场办，避免一次规模太大', performance: -1, effect: { integrity: -5, reputation: -2 }, result: '规模看上去小了，但拆场次本身就成了议论的话题。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 3,
    title: '老乡请托 · 打个招呼',
    scene: '多年没联系的老乡找到你，说亲戚的一件事"卡在你们那儿"，希望你在会上帮忙说句话。',
    options: [
      { text: '说明办理流程，让对方按正常渠道提交材料', performance: 3, effect: { integrity: 3, reputation: 2, network: -2 }, result: '对方不太高兴，但事情在流程里正常办结了。' },
      { text: '帮忙问一下进度，但不干预结论', performance: 1, effect: { network: 2, integrity: -1 }, result: '进度问清楚了，对方也理解了程序，但你已经欠下一次"问过"的记录。' },
      { text: '在会上明确帮着说话', performance: -1, effect: { integrity: -6, network: 3 }, result: '事办成了，这段人情在本地圈子里传开，来找你的人变多了。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 2,
    title: '公车私用 · 顺路一趟',
    scene: '下班后需要去一趟老家接人，单位车正好停在楼下，司机说"顺路，没人会问"。',
    options: [
      { text: '自行打车前往，不动用公车', performance: 3, effect: { integrity: 2, reputation: 1, wealth: -100 }, result: '多花了一点钱，但没有任何需要解释的地方。' },
      { text: '按程序申请用车并如实登记事由', performance: 1, effect: { seniority: 1, integrity: 1 }, result: '手续补上了，用车的性质就清楚了。' },
      { text: '直接用一次，反正没人知道', performance: -1, effect: { integrity: -4, reputation: -1 }, result: '当天没人问，但车队的行车记录是留着的。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 4,
    title: '下属的节礼',
    scene: '中秋前，一位下属提着两个盒子到办公室，说"就是点土特产，不值钱"。',
    options: [
      { text: '当面谢绝，并说明单位的规定', performance: 3, effect: { integrity: 4, reputation: 2 }, result: '对方略显尴尬，但此后没人再往你办公室送东西。' },
      { text: '收下一盒，回赠等值物品', performance: 1, effect: { integrity: -1, network: 1 }, result: '往来看上去对等，边界却已经模糊了。' },
      { text: '收下，觉得拒绝反而生分', performance: -1, effect: { integrity: -5, network: 2 }, result: '东西收下了，往后再谈工作安排时，你心里多了一层顾虑。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 5,
    title: '老板的饭局',
    scene: '一位长期在本地承接工程的企业负责人约你吃饭，说只是"汇报一下行业情况"，同席还有两位同行。',
    options: [
      { text: '婉拒饭局，约在企业办公室按程序谈工作', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '工作谈得很正式，对方也明白你的边界在哪里。' },
      { text: '赴约但明确由自己结账，不谈具体事项', performance: 1, effect: { network: 2, integrity: -2 }, result: '饭吃了，事情没谈，但同席的人都记住了你和他的关系。' },
      { text: '赴约并让对方安排，顺便听听项目消息', performance: -1, effect: { integrity: -6, network: 3 }, result: '饭桌上听到了不少消息，从此你在项目上很难再做到完全回避。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 4,
    title: '执法 · 放一马',
    scene: '例行检查发现一家小商户有轻微违规，按规定要罚款并记录。店主是本地人，反复说生意难做，希望你通融。',
    options: [
      { text: '依法处理，同时告知整改方式和减轻处罚的渠道', performance: 3, effect: { integrity: 4, reputation: 3 }, result: '处罚执行了，店主也按告知的渠道完成了整改。' },
      { text: '口头警告，要求限期整改，不予记录', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '店主很感激，但同类问题下一次出现时你更难按规矩处理。' },
      { text: '只做记录不处罚，让店主自己看着办', performance: -1, effect: { integrity: -5, reputation: -1 }, result: '事情压下去了，案卷里却留下了一个没有结论的记录。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 5,
    title: '津补贴 · 领导开口',
    scene: '领导提出，今年大家辛苦，能不能想办法在账上"处理"一笔辛苦费出来，由你具体经手。',
    options: [
      { text: '说明政策不允许，建议通过正规激励渠道争取', performance: 3, effect: { integrity: 5, reputation: 2, network: -2 }, result: '钱没有违规发放，领导当时不太高兴，但事后没再提。' },
      { text: '先拖一拖，等领导自己改变主意', performance: 1, effect: { seniority: 1, integrity: 1 }, result: '事情搁置了，你也没有把话说明白。' },
      { text: '按领导意思办，找科目处理', performance: -1, effect: { integrity: -7, network: 3 }, result: '钱发出去了，这笔账从此成了你心里的一根刺。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 5,
    title: '说情 · 为违规者开口',
    scene: '一名干部因违规被核查，他的家人找到你，希望你在会上"帮着说句话"，理由是"他平时人不错"。',
    options: [
      { text: '告知核查的独立性，明确表示不会干预', performance: 3, effect: { integrity: 4, reputation: 2, network: -2 }, result: '你没有介入，核查按程序推进，结论也经得起检验。' },
      { text: '如实反映自己了解的情况，不作评价', performance: 1, effect: { integrity: 2, seniority: 1 }, result: '你提供了客观信息，没有替任何人表态。' },
      { text: '在会上强调他的过往功劳，希望从轻', performance: -1, effect: { integrity: -5, network: 2 }, result: '话说出去了，核查的独立性也因此受到了质疑。' },
    ],
  },
  {
    tag: '人情规矩',
    minRank: 6,
    title: '亲属 · 想接个工程',
    scene: '一位近亲提出想参与本地一个小型工程的投标，说"不用你特殊照顾，只要不给别人递话就行"。',
    options: [
      { text: '明确告知回避要求，建议对方去外地市场发展', performance: 3, effect: { integrity: 4, reputation: 2, network: -2 }, result: '亲戚很不理解，但你的任职范围里没有出现相关企业。' },
      { text: '不插手，但也不阻止对方正常投标', performance: 1, effect: { network: 1, integrity: -2 }, result: '程序上没有你的痕迹，但这个关联关系始终需要说明。' },
      { text: '帮忙打听一下评标情况，让对方心里有底', performance: -1, effect: { integrity: -6, network: 3 }, result: '信息递出去了，从这一刻起你就很难再说自己与此无关。' },
    ],
  },

  // ── 生活作风：厅局级以上（职级 7 起）──────────────────────────────
  {
    tag: '生活作风',
    minRank: 7,
    title: '应酬场合 · 分寸',
    scene: '一场必要的商务应酬上，一位长期合作的商人带来了几位朋友，其中一位对你的工作表现出格外热情的关切，散场后还几次发来信息。',
    options: [
      { text: '保持工作距离，信息一律不回，后续应酬减少单独往来', performance: 3, effect: { integrity: 4, reputation: 2, network: -2 }, result: '往来淡了下来，你在这个圈子里显得不好接近，但也省去了后面的麻烦。' },
      { text: '礼貌回应但守住边界，只谈工作范围的事', performance: 1, effect: { integrity: 1, network: 1 }, result: '关系维持在正常的公务往来上，但你清楚这条线需要一直盯着。' },
      { text: '觉得是正常交往，继续保持私下联系', performance: -1, effect: { integrity: -6, reputation: -3, network: 2 }, result: '联系逐渐频繁，你开始有一些不方便写进日程表的安排。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 7,
    title: '配偶亲属 · 经商与收受',
    scene: '你得知配偶在你分管领域的一家合作企业里领取了一份"顾问费"，对方从未要求过具体工作内容。',
    options: [
      { text: '立即要求退还款项，并向组织如实报告', performance: 3, effect: { integrity: 5, reputation: 2, network: -2 }, result: '款项退回并作了报告，虽然家里为此争执了很久，但事情摆到了明处。' },
      { text: '要求停止领取，已领部分自行处理不再声张', performance: 1, effect: { integrity: -2, reputation: 1 }, result: '领取停止了，但已发生的部分成了你心里一直没放下的事。' },
      { text: '认为配偶的往来与自己无关，不做处理', performance: -1, effect: { integrity: -7, reputation: -3 }, result: '这份"顾问费"此后持续存在，也持续留在了别人的账本上。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 7,
    title: '大额人情往来',
    scene: '一位企业负责人在你家人住院期间送来一笔数额明显超出正常往来范围的"慰问金"，并强调只是心意。',
    options: [
      { text: '当场退回，并按报告个人有关事项的要求处理', performance: 3, effect: { integrity: 5, reputation: 2, network: -2 }, result: '钱退回去了，对方此后与你打交道时规矩了很多。' },
      { text: '金额太大，先收下再找机会以其他方式还回去', performance: 1, effect: { integrity: -3, network: 1 }, result: '钱暂时留下了，什么时候还、怎么还，成了你反复琢磨的事。' },
      { text: '收下，认为人情往来属正常', performance: -1, effect: { integrity: -7, reputation: -2, network: 2 }, result: '这份人情被记在了对方心里，也意味着以后很难拒绝他提出的要求。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 8,
    title: '子女留学 · 有人"赞助"',
    scene: '孩子出国读书的费用压力不小。一位商人朋友主动提出"先垫上，等以后方便再说"，并说明不需要任何手续。',
    options: [
      { text: '明确拒绝，通过自有资金和正规贷款解决', performance: 3, effect: { integrity: 5, reputation: 2, wealth: -5000 }, result: '开支压力实实在在，但孩子的学费每一笔都来得清楚。' },
      { text: '只接受无息借款并写下借据，约定还款计划', performance: 1, effect: { integrity: 1, wealth: 3000, network: 1 }, result: '借据留下了，但你也明白这段关系从此不再是普通朋友。' },
      { text: '接受赞助，认为孩子的事与工作无关', performance: -1, effect: { integrity: -8, reputation: -3, network: 2 }, result: '孩子顺利出了国，这份"赞助"也成了日后最需要解释的一笔往来。' },
    ],
  },
  {
    tag: '生活作风',
    minRank: 8,
    title: '特定关系人被调查',
    scene: '一位与你私交甚密的商人因其他案件被调查，办案人员向你了解情况，并提醒如实说明。',
    options: [
      { text: '如实说明全部往来，包括自己认为不妥的部分', performance: 3, effect: { integrity: 5, reputation: 2, network: -3 }, result: '你把该说的都说了，虽然短期难看，但此后再没有被反复找过。' },
      { text: '只说明公开可见的往来，其余避而不谈', performance: 1, effect: { integrity: -3, network: 1 }, result: '问询结束了，但你知道有几件事并没有讲完。' },
      { text: '尽量淡化关系，称只是工作认识', performance: -1, effect: { integrity: -8, reputation: -4 }, result: '说法与在案材料对不上，随后你需要反复解释同一件事。' },
    ],
  },

  // ── 条件强化：平时积累的属性，决定了你能不能把事直接办成 ────────────
  {
    tag: '条件强化',
    minRank: 1,
    title: '群众办事 · 一次办好',
    scene: '一位老人来办社保关系转移，按规定需要本人再回原单位盖一次章。老人腿脚不便，来回一趟要大半天。',
    options: [
      {
        text: '按流程告知需要补办的手续和办理地点',
        performance: 1,
        effect: { seniority: 1 },
        result: '老人认真记下了流程，但这一趟还是免不了。',
        upgraded: {
          require: { reputation: 65 },
          text: '直接联系原单位线上核验，当场办结（口碑积累足够，对方愿意配合）',
          performance: 3,
          effect: { reputation: 5, network: 2 },
          result: '你一个电话把两个窗口对接上，老人当天就把事办完了。',
        },
      },
      { text: '先收下材料，内部流转后再答复', performance: 1, effect: { seniority: 1 }, result: '材料收下了，办结时间比预期长了两天。' },
      { text: '让老人先自己去原单位问清楚再来', performance: -1, effect: { reputation: -3 }, result: '老人来回跑了三趟，最后在意见簿上留了一段话。' },
    ],
  },
  {
    tag: '条件强化',
    minRank: 4,
    title: '项目协调 · 部门分歧',
    scene: '两个部门在项目时序上互不相让，都要求对方先出方案。协调会开了两次，纪要上仍然没有结论。',
    options: [
      { text: '按程序报请上级裁定', performance: 1, effect: { seniority: 2 }, result: '裁定下来了，但两个部门之间的配合依旧别扭。' },
      {
        text: '分别沟通，寻找彼此可以交换的条件',
        performance: 1,
        effect: { network: 1 },
        result: '双方各退一步，方案勉强定了下来。',
        upgraded: {
          require: { network: 60 },
          text: '把两边分管领导约到一起，当场把时序和资源一次谈定（人脉足够，双方都愿意给面子）',
          performance: 3,
          effect: { network: 4, reputation: 3, seniority: 1 },
          result: '一次会上把时序、人员和经费全部定死，后续再没有反复。',
        },
      },
      { text: '先推动自己能定的那部分', performance: 1, effect: { seniority: 1, reputation: -1 }, result: '你把自己那部分做完了，整体进度仍在等。' },
    ],
  },

  // ── 概率分支：同样的选择，结果要看当时的状态和一点运气 ──────────────
  {
    tag: '概率',
    minRank: 4,
    title: '项目争取 · 向上汇报',
    scene: '一份项目申请要争取上级支持，送审时间很紧。有人建议先托熟人探探口风，再决定汇报口径。',
    options: [
      {
        text: '托熟人先探口风，再定汇报口径',
        performance: 1,
        effect: { network: 1 },
        result: '你把口径调整得更贴近上级关注点，汇报基本顺利。',
        roll: {
          chance: 0.5,
          attr: 'network',
          perPoint: 0.006,
          success: { performance: 3, effect: { network: 3, reputation: 2 }, result: '熟人把关注点说透了，汇报一次通过，项目进入支持名单。' },
          fail: { performance: -1, effect: { reputation: -2, network: -1 }, result: '探口风的事被传了出去，有人质疑你在走门路，汇报反而受阻。' },
        },
      },
      { text: '按标准格式如实报送，不走旁路', performance: 1, effect: { integrity: 2, seniority: 1 }, result: '材料规范，评审按正常节奏推进。' },
      { text: '在材料里把预期收益写得乐观一些', performance: -1, effect: { integrity: -4, reputation: -1 }, result: '材料看上去更有吸引力，但后续考核要按这个口径兑现。' },
    ],
  },
  {
    tag: '概率',
    minRank: 3,
    title: '突发事件 · 现场处置',
    scene: '一处施工围挡被大风刮倒，砸坏了路边车辆。围观群众情绪激动，事故原因一时说不清楚。',
    options: [
      {
        text: '先清理现场、联系车主，再查原因',
        performance: 1,
        effect: { reputation: 1 },
        result: '现场秩序恢复，车主得到了先行赔付的承诺。',
        roll: {
          chance: 0.55,
          attr: 'reputation',
          perPoint: 0.005,
          success: { performance: 3, effect: { reputation: 5, network: 2 }, result: '处置干净利落，围观群众主动帮着维持秩序，没有形成舆情。' },
          fail: { performance: -1, effect: { reputation: -3, health: -1 }, result: '清理过程中双方争执起来，事情拖到晚上才平息。' },
        },
      },
      { text: '先等专业部门到场定性，再对外说明', performance: 1, effect: { seniority: 2 }, result: '责任划分清楚了，但现场多等了两小时。' },
      { text: '先让施工方自行处理，自己维持外围', performance: -1, effect: { reputation: -3, integrity: -1 }, result: '施工方赔付拖沓，车主把矛头转向了管理部门。' },
    ],
  },
  {
    tag: '概率',
    minRank: 6,
    title: '招商谈判 · 条件博弈',
    scene: '与一家企业谈落户条件，对方在用地和配套上反复加码，谈判已经进行到第三轮。',
    options: [
      {
        text: '在政策范围内测算后给出最终方案',
        performance: 1,
        effect: { network: 1 },
        result: '方案报出后，对方表示需要内部研究。',
        roll: {
          chance: 0.5,
          attr: 'seniority',
          perPoint: 0.006,
          success: { performance: 3, effect: { network: 3, reputation: 2, wealth: 2000 }, result: '对方接受了方案并当场签约，项目按计划落地。' },
          fail: { performance: -1, effect: { network: -2, reputation: -1 }, result: '对方以条件不足为由暂缓，项目被另一地争取了过去。' },
        },
      },
      { text: '请上级出面，提高谈判层级', performance: 1, effect: { seniority: 2, network: 1 }, result: '层级提高了，条件谈判重新开始。' },
      { text: '突破政策底线先签下来', performance: -1, effect: { integrity: -6, network: 2 }, result: '企业签了，但那个超出政策的承诺日后需要逐年兑现。' },
    ],
  },
];

// 补齐原版里只有 1 个事件的岗位池（这些池是"重复感"最重的地方）。
const EXTRA_POSITION_EVENTS = {
  grassroots: [
    {
      tag: '岗位·基层',
      title: '基层事项 · 政策宣传进村',
      scene: '一项新政策要求在半个月内让村民知晓。以往靠贴通知，效果一般，这次要求"入户见人"。',
      options: [
        { text: '组织村干部按片入户，用方言讲清关键条款', performance: 3, effect: { reputation: 5, network: 2, health: -1 }, result: '村民真正听懂了政策，后续办理时的往返明显减少。' },
        { text: '按老办法贴通知、发微信群', performance: 1, effect: { seniority: 1 }, result: '通知发出去了，来咨询的人仍然集中最后两天。' },
        { text: '只做一次集中宣讲，完成规定动作', performance: -1, effect: { reputation: -3 }, result: '宣讲搞了，但入户率不达标，复核时被点了名。' },
      ],
    },
    {
      tag: '岗位·基层',
      title: '基层事项 · 困难家庭走访',
      scene: '季度走访名单里有几户情况比较复杂，有人建议"拍照留痕就行，不用久留"。',
      options: [
        { text: '逐户坐下来聊，把实际困难记下来并对接政策', performance: 3, effect: { reputation: 5, integrity: 2 }, result: '两户符合条件却一直没申请的家庭被纳入了救助。' },
        { text: '按名单走完，重点户多留一会儿', performance: 1, effect: { seniority: 1, reputation: 1 }, result: '走访任务完成了，有一户的隐性困难当时没被发现。' },
        { text: '拍照留痕为主，不耽误下村的其他安排', performance: -1, effect: { reputation: -4 }, result: '照片齐了，但走访流于形式，被抽查时答不上具体情况。' },
      ],
    },
    {
      tag: '岗位·基层',
      title: '基层事项 · 窗口排队',
      scene: '便民窗口一位工作人员请假，排队的人越来越多，有人开始抱怨。你正好经过。',
      options: [
        { text: '临时坐到窗口帮忙，同时通知后台增派人手', performance: 3, effect: { reputation: 5, network: 2, health: -1 }, result: '队伍很快短了下来，群众的不满也消了大半。' },
        { text: '联系分管领导协调增派人手', performance: 1, effect: { seniority: 2 }, result: '人手到得稍晚，队伍等了一段时间但秩序没乱。' },
        { text: '记录情况，回到办公室再研究改进', performance: -1, effect: { reputation: -3 }, result: '问题被记下来了，但排队的群众当天并没有得到解决。' },
      ],
    },
  ],
  executive: [
    {
      tag: '岗位·综合',
      title: '岗位专项 · 民生工程推进',
      scene: '两项民生工程同时推进，一项进度落后，群众已有反映；另一项进度正常但资金偏紧。',
      options: [
        { text: '把资源集中到落后工程，先解决群众反映的问题', performance: 3, effect: { reputation: 4, network: 2, seniority: -1 }, result: '落后工程追上了节点，群众反映明显减少。' },
        { text: '两项均衡推进，按原计划调度资金', performance: 1, effect: { seniority: 2 }, result: '两项都在推进，但落后那一项的群众仍在反复询问。' },
        { text: '先保资金偏紧的项目，避免停工', performance: 1, effect: { network: 1, reputation: -1 }, result: '资金链没有断，但群众反映的问题又拖了一个月。' },
      ],
    },
    {
      tag: '岗位·综合',
      title: '岗位专项 · 信访积案化解',
      scene: '一件拖了三年的信访积案交到你手上，前任已调离，卷宗不全，当事人情绪很大。',
      options: [
        { text: '重新逐项核对事实，能查清的先查清，再当面答复', performance: 3, effect: { reputation: 5, integrity: 2, health: -1 }, result: '三年没查清的关键事实被理了出来，当事人接受了处理意见。' },
        { text: '按现有卷宗维持原结论，做好解释工作', performance: 1, effect: { seniority: 1 }, result: '答复作出了，当事人表示仍将向上反映。' },
        { text: '先安抚情绪，承诺研究，暂不作结论', performance: -1, effect: { reputation: -3 }, result: '情绪暂时压住，积案又多拖了一个季度。' },
      ],
    },
    {
      tag: '岗位·综合',
      title: '岗位专项 · 年度预算申报',
      scene: '各部门报上来的预算需求远超可用额度，需要你来压缩，每一项都有人来说"砍不得"。',
      options: [
        { text: '按轻重缓急排序，公开压减标准和依据', performance: 3, effect: { integrity: 3, reputation: 2, network: -2 }, result: '压减结果虽然得罪人，但因为标准公开，争议没有扩大。' },
        { text: '按比例统一压减，不做取舍', performance: 1, effect: { seniority: 2 }, result: '各方都能接受，但重点项目也被平均掉了一部分资源。' },
        { text: '给打招呼的部门多留一些', performance: -1, effect: { network: 3, integrity: -5, reputation: -2 }, result: '关系户满意了，压减方案的公正性却在圈内受到质疑。' },
      ],
    },
  ],
  discipline: [
    {
      tag: '岗位·纪检',
      title: '岗位专项 · 问题线索处置',
      scene: '收到一条反映某单位负责人的问题线索，材料比较零散，反映人要求匿名。',
      options: [
        { text: '按程序初步核实，不惊动被反映人，实事求是得出结论', performance: 3, effect: { integrity: 4, reputation: 2, network: -1 }, result: '核实后既不放过问题，也没有冤枉人，结论经得起复核。' },
        { text: '先谈话提醒，观察后续情况', performance: 1, effect: { integrity: 1, seniority: 1 }, result: '提醒起到了作用，但线索本身没有形成完整结论。' },
        { text: '把线索内容透露给被反映人，让其自行处理', performance: -1, effect: { integrity: -8, reputation: -3 }, result: '消息走漏了，反映人从此不再配合，线索也查不下去了。' },
      ],
    },
    {
      tag: '岗位·纪检',
      title: '岗位专项 · 廉政教育安排',
      scene: '要在本单位组织一次廉政教育，可选择通报案例、观看警示片，或结合本单位实际开展岗位风险排查。',
      options: [
        { text: '结合本单位岗位实际做风险排查，逐岗列出风险点', performance: 3, effect: { integrity: 3, reputation: 2, seniority: 1 }, result: '排查出了几处此前没人注意的风险点，并被明确整改责任。' },
        { text: '按惯例组织观看警示片并签到', performance: 1, effect: { seniority: 1 }, result: '教育按要求完成了，参与者的反应比较平淡。' },
        { text: '临时改为开会传达文件，缩短时间', performance: -1, effect: { reputation: -3, integrity: -1 }, result: '会议开得很短，但"走过场"的评价也传了出去。' },
      ],
    },
  ],
  department: [
    {
      tag: '岗位·部门',
      title: '岗位专项 · 行业专项治理',
      scene: '上级部署本行业专项治理，要求在一个月内完成自查并上报问题清单。自报问题多的单位会被重点跟进。',
      options: [
        { text: '如实上报自查问题，同步提交整改方案', performance: 3, effect: { integrity: 4, reputation: 2 }, result: '清单报得实在，整改也同步推进，后续跟进顺利。' },
        { text: '只报不痛不痒的问题，把主要问题留待后续', performance: -1, effect: { integrity: -5, reputation: -1 }, result: '清单好看了，但专项治理"回头看"时问题集中暴露。' },
        { text: '先报已整改完毕的问题，未完成的列时间表', performance: 1, effect: { integrity: 1, seniority: 1 }, result: '上报与实际进度基本匹配，没有引起额外关注。' },
      ],
    },
    {
      tag: '岗位·部门',
      title: '岗位专项 · 下属单位考核',
      scene: '年度考核要打分，一家单位工作扎实但材料做得差，另一家材料漂亮但实绩平平。',
      options: [
        { text: '以实地核查的实绩为主，材料只作参考', performance: 3, effect: { integrity: 3, reputation: 3 }, result: '打分结果与实际情况相符，基层对这个导向很认可。' },
        { text: '实绩与材料各占一半，综合打分', performance: 1, effect: { seniority: 1 }, result: '两家分数接近，谁都没有明显不满。' },
        { text: '倾向材料完整的那家，避免日后被挑毛病', performance: -1, effect: { integrity: -4, reputation: -2 }, result: '考核结果出来了，但"重材料不重实绩"的说法开始流传。' },
      ],
    },
  ],
  city: [
    {
      tag: '岗位·城市',
      title: '岗位专项 · 城市更新摸底',
      scene: '老城区更新要摸底，涉及上千户居民。全面入户耗时耗力，抽样调查又快但代表性不足。',
      options: [
        { text: '分片全面入户，同步建立一户一档', performance: 3, effect: { reputation: 4, network: 2, health: -2 }, result: '底数清楚了，后续方案调整时少了大量返工。' },
        { text: '先做抽样，再对重点片区入户', performance: 1, effect: { seniority: 2 }, result: '摸底按时完成，个别片区的特殊情况后续才发现。' },
        { text: '调用既有台账数据，不再入户', performance: -1, effect: { reputation: -4 }, result: '效率很高，但数据与现状已经脱节，方案发布后出现争议。' },
      ],
    },
    {
      tag: '岗位·城市',
      title: '岗位专项 · 企业座谈会',
      scene: '企业家座谈会上，几家企业集中反映审批环节多、时间长，希望市里"特事特办"。',
      options: [
        { text: '逐项梳理流程堵点，承诺时限并公开办理标准', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '堵点被逐项拆解，办理时限压缩后，类似反映明显减少。' },
        { text: '记录问题，会后转相关部门研究', performance: 1, effect: { seniority: 2 }, result: '问题转办下去了，企业短期内没有看到变化。' },
        { text: '口头答应个别企业特事特办', performance: -1, effect: { integrity: -5, network: 2 }, result: '个别企业得到了优先，其他企业得知后意见更大。' },
      ],
    },
  ],
  national: [
    {
      tag: '岗位·国家层面',
      title: '岗位专项 · 跨区域协调',
      scene: '两地在同一事项上政策口径不一致，企业往返两地多次仍无法办结，媒体开始关注。',
      options: [
        { text: '牵头建立统一口径并明确办结时限，向社会公开', performance: 3, effect: { integrity: 3, reputation: 4, network: 2 }, result: '口径统一后，企业一次办结，同类问题也有了明确规则。' },
        { text: '协调两地各让一步，个案解决', performance: 1, effect: { network: 2, seniority: 1 }, result: '这一件办结了，但换一家企业仍会遇到同样的问题。' },
        { text: '建议企业按其中一地口径重新申报', performance: -1, effect: { reputation: -4 }, result: '企业被迫重来一遍，舆情进一步发酵。' },
      ],
    },
    {
      tag: '岗位·国家层面',
      title: '岗位专项 · 政策效果评估',
      scene: '一项已实施的政策要求评估效果，基层反映与统计数据存在明显差异。',
      options: [
        { text: '组织实地调研，把基层反映的情况一并写入评估报告', performance: 3, effect: { integrity: 4, reputation: 3 }, result: '报告如实反映了差异，政策后续做了针对性调整。' },
        { text: '以统计数据为主，注明存在地区差异', performance: 1, effect: { seniority: 2 }, result: '报告顺利通过，但基层反映的问题仍未进入决策视野。' },
        { text: '按预期效果口径撰写，避免引起不必要的讨论', performance: -1, effect: { integrity: -6, reputation: -2 }, result: '报告很好看，但政策偏差在后面两年里持续累积。' },
      ],
    },
  ],
  province_lead: [
    {
      tag: '岗位·省级',
      title: '岗位专项 · 重大风险排查',
      scene: '辖区内一项重点领域被排查出多处风险隐患，涉及多个地市，整改需要动真格。',
      options: [
        { text: '挂牌督办，逐项明确责任人和完成时限', performance: 3, effect: { integrity: 4, reputation: 4, network: -2 }, result: '隐患逐项销号，整改情况每月通报，进度真实可见。' },
        { text: '召开专题会议部署，要求各地市自行整改', performance: 1, effect: { seniority: 2 }, result: '会议开了，各地进度不一，部分隐患整改流于形式。' },
        { text: '考虑影响面，先内部提示，不上报不督办', performance: -1, effect: { integrity: -7, reputation: -3 }, result: '风险被暂时压住，一处隐患在半年后演变成事故。' },
      ],
    },
    {
      tag: '岗位·省级',
      title: '岗位专项 · 干部队伍建设',
      scene: '多地反映基层人手紧、任务重，同时存在忙闲不均、借调过多的问题。',
      options: [
        { text: '清理违规借调，重新核定基层编制与任务清单', performance: 3, effect: { integrity: 3, reputation: 4, network: -2 }, result: '借调人员回流，基层力量得到补充，忙闲不均有所缓解。' },
        { text: '要求各地市自行优化，省里定期调度', performance: 1, effect: { seniority: 2 }, result: '调度进行了几轮，问题改善有限。' },
        { text: '维持现状，避免触动各方利益', performance: -1, effect: { reputation: -4, integrity: -2 }, result: '队伍问题继续积累，基层意见越来越大。' },
      ],
    },
  ],
};

module.exports = { EXTRA_COMMON_EVENTS, EXTRA_POSITION_EVENTS };
