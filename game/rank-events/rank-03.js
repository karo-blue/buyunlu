// 职级 3 · 乡科级副职（副科级）
//
// 权力边界：第一次有了"自己分管的一条线"。能拍线条线内的小事，能分几个人的
// 工，能在会上表态，但钱和人的最终决定还要往上走。题目围绕"分管线上的取舍"。
// 50 道。

module.exports = [
  {
    title: '分管条线',
    scene: '班子分工定了，你分到一条基础最差、历史欠账最多的线。',
    options: [
      { text: '先把欠账列成清单，分三年往下推', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '清单交上去，第一年就清了两项。' },
      { text: '先抓最显眼的一项', performance: 1, effect: { reputation: 1 }, result: '那一项做出来了，别的没动。' },
      { text: '抱怨分工不公，消极接手', performance: -2, effect: { reputation: -3 }, result: '班子会上被点了一次名。' },
    ],
  },
  {
    title: '包村工作',
    scene: '你包的那个村班子不太齐，书记和主任各说各话。',
    options: [
      { text: '分别谈一次，把职责划清楚再开联席会', performance: 3, effect: { reputation: 4, network: 2 }, result: '两个月后这个村能自己开会了。' },
      { text: '谁找你就听谁的', performance: 1, effect: { reputation: 1 }, result: '两边都觉得你站对面。' },
      { text: '只找书记，主任那边不管', performance: -1, effect: { reputation: -2 }, result: '主任开始绕开你往上报。' },
    ],
  },
  {
    title: '条线例会',
    scene: '第一次开条线例会，来了七个人，一半在玩手机。',
    options: [
      { text: '定死规矩：每人三分钟，先讲卡点', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '第三次例会，会短了一半，问题多了。' },
      { text: '照流程念一遍通报', performance: 1, effect: { reputation: 1 }, result: '念完了，散会。' },
      { text: '发火训一顿', performance: -1, effect: { reputation: -2 }, result: '会后没人再跟你说实话。' },
    ],
  },
  {
    title: '项目落地',
    scene: '一个项目批下来了，选址卡在两户人家的地上。',
    options: [
      { text: '逐户谈清补偿和安置，谈不拢就调规划', performance: 3, effect: { reputation: 4, health: -2 }, result: '一户谈成，一户调了红线，项目按期开。' },
      { text: '请村里出面施压', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了，但留下两个上访隐患。' },
      { text: '先开工，边干边谈', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '工地被堵了三天。' },
    ],
  },
  {
    title: '站所协调',
    scene: '一件跨站所的事，两个站所都说是对方的。',
    options: [
      { text: '把职责文件摆出来，当场划清牵头和配合', performance: 3, effect: { reputation: 3, network: 2 }, result: '事办了，往后这类事有先例可循。' },
      { text: '各打五十大板，一人一半', performance: 1, effect: { reputation: 1 }, result: '办了，两边都不太情愿。' },
      { text: '压给资历浅的那个', performance: -1, effect: { reputation: -2 }, result: '办砸了，也寒了人心。' },
    ],
  },
  {
    title: '矛盾调处',
    scene: '两家人因为排水沟打了架，一方住了院。',
    options: [
      { text: '先看伤情和现场，再分开调解并留书面协议', performance: 3, effect: { reputation: 4, health: -1 }, result: '协议签了，第二年没再闹。' },
      { text: '叫双方坐下来谈一次', performance: 1, effect: { reputation: 1 }, result: '谈崩了，各自回家。' },
      { text: '让派出所处理，你不管', performance: -1, effect: { reputation: -2 }, result: '处理完了，仇还在。' },
    ],
  },
  {
    title: '防汛值守',
    scene: '暴雨预警，你分管的两个村有地质灾害点。',
    options: [
      { text: '提前把人撤到安置点，通宵盯点', performance: 3, effect: { reputation: 4, health: -3 }, result: '半夜滑坡，没有人员伤亡。' },
      { text: '按预案电话通知到村', performance: 1, effect: { reputation: 1, health: -1 }, result: '通知到了，撤没撤不清楚。' },
      { text: '等雨大了再说', performance: -3, effect: { reputation: -4, integrity: -2 }, result: '路断了，人被围在里面。' },
    ],
  },
  {
    title: '安全生产',
    scene: '排查发现一处作坊有隐患，老板是你一个熟人。',
    options: [
      { text: '照样下整改，限期复查，熟人也不例外', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '改了，全镇都知道这次是动真格。' },
      { text: '口头提醒，不下文书', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '提醒了，隐患还在。' },
      { text: '打个招呼让他先歇两天', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '两天后出了事，招呼的事瞒不住。' },
    ],
  },
  {
    title: '资金分配建议',
    scene: '一笔资金要在你这条线上分，四个村都想要。',
    options: [
      { text: '按项目成熟度和需求排序，公开评分', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 1 }, result: '评分结果贴出去，没人不服。' },
      { text: '平均分配', performance: 1, effect: { reputation: 1 }, result: '谁都没意见，谁都不够用。' },
      { text: '给跟自己关系好的村多分', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '别村的干部开始在会上说话带刺。' },
    ],
  },
  {
    title: '人员分工',
    scene: '你手上有五个人，一个能干但不好管，两个老实但慢。',
    options: [
      { text: '按事配人，难事给能干的，流程活给细心的', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '半年后这五个人都能独当一面。' },
      { text: '平均分摊', performance: 1, effect: { reputation: 1 }, result: '活干完了，能干的那个憋着一肚子气。' },
      { text: '只把活派给两个老实的', performance: -1, effect: { reputation: -2 }, result: '老实人累倒了，能干的闲着。' },
    ],
  },
  {
    title: '迎检准备',
    scene: '后天上面来检查，你这条线的台账有两处对不上。',
    options: [
      { text: '连夜核清楚，能补的补，补不上的写说明', performance: 3, effect: { reputation: 3, health: -2 }, result: '检查组翻了说明，反而没再追问。' },
      { text: '把对不上的部分抽掉', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '抽掉了，检查组问起这一块没有东西。' },
      { text: '临时造一版台账', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '造的那版跟系统里的对不上。' },
    ],
  },
  {
    title: '信访件办理',
    scene: '一件缠访三年的案子转到你手上，前几任都判过。',
    options: [
      { text: '重新听一遍诉求，把真问题和情绪分开', performance: 3, effect: { reputation: 4, health: -2 }, result: '真问题是当年一处没落实的政策，补上了。' },
      { text: '照前任结论答复', performance: 1, effect: { reputation: 1 }, result: '答复了，人还在跑。' },
      { text: '劝他别再跑了，跑也没用', performance: -2, effect: { reputation: -3 }, result: '他跑去了上面。' },
    ],
  },
  {
    title: '招商接待',
    scene: '一家企业要来看地，看中的那块地另有规划。',
    options: [
      { text: '如实说明规划，另推两块符合条件的地', performance: 3, effect: { reputation: 3, network: 2 }, result: '企业在另一块地上落了脚。' },
      { text: '先答应下来，回头想办法调规划', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '规划调不动，企业白跑一趟。' },
      { text: '含糊带过，先把人留下', performance: -1, effect: { reputation: -2 }, result: '签约时才发现地用不了。' },
    ],
  },
  {
    title: '土地流转',
    scene: '一片地要流转出去，有十几户不愿意。',
    options: [
      { text: '逐户问清顾虑，能解决的先解决', performance: 3, effect: { reputation: 4, health: -2 }, result: '顾虑解决了九户，剩下几户另划了地块。' },
      { text: '请村里做工作', performance: 1, effect: { reputation: 1 }, result: '签了一部分，剩下的僵着。' },
      { text: '少数服从多数，硬推', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '推成了，也推出了上访。' },
    ],
  },
  {
    title: '村两委换届',
    scene: '换届在即，有个村的书记想连任，但群众反映不小。',
    options: [
      { text: '按程序考察，把反映的问题查清再说', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '查清了，反映的问题一半属实，换了人。' },
      { text: '先稳住，让他干完这届', performance: 1, effect: { reputation: 1 }, result: '稳住了，反映还在继续。' },
      { text: '保他连任，免得乱', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '选上去三个月，问题被人举报上去。' },
    ],
  },
  {
    title: '惠民政策落地',
    scene: '一项惠民政策下来了，符合条件的人比预想的多。',
    options: [
      { text: '重新摸底公示，按程序扩面或排队', performance: 3, effect: { reputation: 4 }, result: '公示后没人闹，分批也说得通。' },
      { text: '按原名单办，多的先登记', performance: 1, effect: { reputation: 1 }, result: '办了，登记的那批人来问了几次。' },
      { text: '悄悄多报几个名额', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '核对时发现名单里有人不符合条件。' },
    ],
  },
  {
    title: '突发舆情',
    scene: '一段关于你分管条线的视频在网上传开了，说得很重。',
    options: [
      { text: '两小时内核清事实，公开回应并给出整改时间表', performance: 3, effect: { reputation: 4, health: -1 }, result: '回应及时，风评反而转了。' },
      { text: '等上面统一口径', performance: 1, effect: { reputation: 1 }, result: '等到了口径，热度已经过去三轮。' },
      { text: '说是造谣，不做别的', performance: -2, effect: { reputation: -3 }, result: '造谣的说法没人信，反而引来更多追问。' },
    ],
  },
  {
    title: '横向协调',
    scene: '一件急事需要别的部门配合，对方说要走流程。',
    options: [
      { text: '带着材料上门，当面说清紧急程度并留函', performance: 3, effect: { reputation: 3, network: 2 }, result: '对方特事特办，还欠了你一个人情。' },
      { text: '发函等回复', performance: 1, effect: { reputation: 1 }, result: '回复来了，窗口期已经过了。' },
      { text: '找上级压对方', performance: -1, effect: { reputation: -2, network: -1 }, result: '压成了，往后这条路就断了。' },
    ],
  },
  {
    title: '条线考核',
    scene: '你这条线在镇里排名靠后，有几个指标根本不归你管。',
    options: [
      { text: '把指标来源摊开，能认的认，不能认的写清理由', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '第二年考核口径调整了，排名也上来了。' },
      { text: '全盘接受，回去加码', performance: 1, effect: { reputation: 1, health: -1 }, result: '加码了，指标还是上不去。' },
      { text: '私下找人改数据', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '改的那几个数，第二年成了别人的把柄。' },
    ],
  },
  {
    title: '下属失误',
    scene: '你手下的一个人把一份材料报错了，影响已经出去了。',
    options: [
      { text: '先补救，再查流程漏洞，责任你自己先担', performance: 3, effect: { reputation: 4, network: 2 }, result: '补救及时，那个人往后格外卖力。' },
      { text: '让他自己去说明', performance: 1, effect: { reputation: 1 }, result: '他说明了，上面觉得你在甩锅。' },
      { text: '当众批评，撇清关系', performance: -1, effect: { reputation: -2, network: -2 }, result: '人心散了，没人再愿意接急活。' },
    ],
  },
  {
    title: '会议决策',
    scene: '一件事要在会上定，你心里有倾向，但有个反对意见说得也在理。',
    options: [
      { text: '把两种方案摆开比，让班子一起定', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '最后选了反对的那版，效果比你的好。' },
      { text: '坚持自己的方案', performance: 1, effect: { reputation: 1 }, result: '定了，执行中磕磕绊绊。' },
      { text: '看一把手眼色再表态', performance: -1, effect: { reputation: -2 }, result: '表态晚了，两边都不讨好。' },
    ],
  },
  {
    title: '请示汇报',
    scene: '一件有风险的事，你可以自己定，也可以往上请示。',
    options: [
      { text: '带着两个方案和风险点去请示', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '领导当场定了，还说你想得周全。' },
      { text: '口头问一句，没留痕', performance: 1, effect: { reputation: 1 }, result: '问了，后面出事说不清是谁定的。' },
      { text: '自己定，不请示', performance: -2, effect: { reputation: -2, integrity: -1 }, result: '出了事，责任全在你。' },
    ],
  },
  {
    title: '村级财务',
    scene: '有个村的账目被村民质疑，票据不全。',
    options: [
      { text: '请第三方清账，结果公示', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '清完公示，质疑消了，也查出两笔要退。' },
      { text: '让村里自己解释', performance: 1, effect: { reputation: 1 }, result: '解释了，村民不信。' },
      { text: '把账压下来不让看', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '压不住，人直接反映到了上面。' },
    ],
  },
  {
    title: '道路修缮',
    scene: '一段村道要修，钱只够修一半。',
    options: [
      { text: '按通行量排序，先修最要紧那半并公示', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '公示后没人闹，第二年续上了。' },
      { text: '平均分成两段各修一点', performance: 1, effect: { reputation: 1 }, result: '两段都是断头路。' },
      { text: '修靠近自己包村的那段', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '另外一个村的干部在会上直接问了。' },
    ],
  },
  {
    title: '饮水工程',
    scene: '一个组的自来水时有时无，已经反映半年。',
    options: [
      { text: '顺着管道一段段查，找到漏点再改', performance: 3, effect: { reputation: 4, health: -2 }, result: '漏点在一个老接口上，换了就通了。' },
      { text: '请施工队来看一次', performance: 1, effect: { reputation: 1 }, result: '来看了，说要整体改造。' },
      { text: '记下来报明年计划', performance: -1, effect: { reputation: -2 }, result: '又一年，水还是时有时无。' },
    ],
  },
  {
    title: '产业项目',
    scene: '一个产业项目落地一年，效益跟当初说的不一样。',
    options: [
      { text: '实地核算收益和带动户数，该调整的调整', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '调整了经营模式，第二年真见到了收益。' },
      { text: '按原方案继续推', performance: 1, effect: { reputation: 1 }, result: '推了，带动力一直上不去。' },
      { text: '把数据做上去交差', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '核查时农户一句实话就戳破了。' },
    ],
  },
  {
    title: '劳务纠纷',
    scene: '一个工地十几个人没拿到工钱，堵在镇政府门口。',
    options: [
      { text: '当场登记欠薪明细，约谈施工方并给时限', performance: 3, effect: { reputation: 4, health: -1 }, result: '期限内付了七成，剩下的签了还款计划。' },
      { text: '劝散，让他们走程序', performance: 1, effect: { reputation: 1 }, result: '散了，第二天又来了。' },
      { text: '让施工方自己处理', performance: -2, effect: { reputation: -3 }, result: '施工方跑了，人找到了上面。' },
    ],
  },
  {
    title: '校园安全',
    scene: '有家长反映校门口上下学时很乱，出过一次险情。',
    options: [
      { text: '现场蹲一周，摸清车流再定分流方案', performance: 3, effect: { reputation: 4, health: -1 }, result: '划了临时停车区和护学岗，险情没再发生。' },
      { text: '让学校加强管理', performance: 1, effect: { reputation: 1 }, result: '学校管了，路还是那条路。' },
      { text: '加个告示牌', performance: -1, effect: { reputation: -2 }, result: '牌子立了，没人看。' },
    ],
  },
  {
    title: '集市秩序',
    scene: '集市占道经营多年，一管就吵，不管就堵。',
    options: [
      { text: '先划出摆卖区，给一段过渡期再管', performance: 3, effect: { reputation: 3, health: -1 }, result: '过渡期后路通了，摊主也有地方。' },
      { text: '集中整治一次', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '整治完三天，又回去了。' },
      { text: '随它去，反正年年如此', performance: -1, effect: { reputation: -2 }, result: '一起因占道引发的碰撞上了新闻。' },
    ],
  },
  {
    title: '违建处置',
    scene: '一户人家加盖了两层，手续没有。',
    options: [
      { text: '先认定性质，按程序下达文书并说明理由', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '程序走完，对方自己拆了。' },
      { text: '口头叫他停', performance: 1, effect: { reputation: 1 }, result: '停了两天，又接着盖。' },
      { text: '睁只眼闭只眼', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '隔壁照着样也盖起来了。' },
    ],
  },
  {
    title: '上级调研',
    scene: '上级领导要来调研，指名要看一个点。',
    options: [
      { text: '照实准备，亮点和问题都讲', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '领导当场问了问题，后面给了支持。' },
      { text: '只准备亮点', performance: 1, effect: { reputation: 1 }, result: '看完了，领导说"不错"。' },
      { text: '临时布置一个点', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '领导临时改了路线，看到了真实情况。' },
    ],
  },
  {
    title: '干部谈心',
    scene: '你手下一个年轻人最近状态很差，活总出错。',
    options: [
      { text: '单独聊一次，问清是事还是人', performance: 3, effect: { reputation: 3, network: 2 }, result: '是家里的事，调了两天休，状态回来了。' },
      { text: '在会上点一下', performance: 1, effect: { reputation: 1 }, result: '他更沉默了。' },
      { text: '把他的活分给别人', performance: -1, effect: { reputation: -2, network: -1 }, result: '他觉得被架空了。' },
    ],
  },
  {
    title: '条线台账',
    scene: '你这条线的台账有三个版本，谁也说不清哪个是准的。',
    options: [
      { text: '定一个来源，其他两个停用并说明', performance: 3, effect: { reputation: 2, seniority: 1, health: -1 }, result: '往后只有一个口径，省了很多口舌。' },
      { text: '保留三个，用时再比', performance: 1, effect: { reputation: 1 }, result: '每次汇报都要先对一遍。' },
      { text: '让下面自己定', performance: -1, effect: { reputation: -2 }, result: '越用越乱。' },
    ],
  },
  {
    title: '联合执法',
    scene: '要搞一次联合执法，涉及三个部门，时间紧。',
    options: [
      { text: '先开个碰头会定分工和边界，再统一行动', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '一次到位，没有越权也没有空档。' },
      { text: '各自行动，现场汇合', performance: 1, effect: { reputation: 1 }, result: '现场乱了一阵。' },
      { text: '抢在别人前面先动', performance: -1, effect: { reputation: -2, network: -1 }, result: '越了界，被叫停。' },
    ],
  },
  {
    title: '群众大会',
    scene: '要在村里开一场群众大会，议题有争议。',
    options: [
      { text: '会前先跟几个有威望的人通个气，会上让人说话', performance: 3, effect: { reputation: 4, network: 1 }, result: '会开到很晚，但方案定了。' },
      { text: '会上宣布方案', performance: 1, effect: { reputation: 1 }, result: '宣布完了，会后议论纷纷。' },
      { text: '不开，贴个公告', performance: -1, effect: { reputation: -2 }, result: '公告被人撕了。' },
    ],
  },
  {
    title: '财政评审',
    scene: '一个项目的预算报上来，明显偏高。',
    options: [
      { text: '请评审一项项过，砍掉没有依据的部分', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '审下来少了一大块，也没人闹。' },
      { text: '大致砍一点', performance: 1, effect: { reputation: 1 }, result: '砍了，剩下的还是偏高。' },
      { text: '照批，反正不是自己的钱', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '审计时这一项被单独点出来。' },
    ],
  },
  {
    title: '帮扶车间',
    scene: '一个帮扶车间开工半年，来干活的人越来越少。',
    options: [
      { text: '问清为什么不来，是工钱、时间还是活不合适', performance: 3, effect: { reputation: 4 }, result: '是接送孩子的时间冲突，调了班次就回来了。' },
      { text: '让村里动员人来', performance: 1, effect: { reputation: 1 }, result: '来了两天又走了。' },
      { text: '把在册人数报上去就行', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '抽查那天车间里只有三个人。' },
    ],
  },
  {
    title: '养老服务',
    scene: '几个自然村的老人吃饭成问题，食堂只覆盖了一半。',
    options: [
      { text: '按距离划片，远的设配送点', performance: 3, effect: { reputation: 4, health: -1 }, result: '最后一个村也吃上了热饭。' },
      { text: '先覆盖条件好的村', performance: 1, effect: { reputation: 1 }, result: '覆盖了一半，最远的还是没人管。' },
      { text: '发点物资代替', performance: -1, effect: { reputation: -2 }, result: '物资发了，老人不会做。' },
    ],
  },
  {
    title: '卫生整治',
    scene: '卫生评比排名靠后，突击搞过几次都没用。',
    options: [
      { text: '定长效机制，把路段责任分到人', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '三个月后名次进了中游，也没再反弹。' },
      { text: '再突击一次', performance: 1, effect: { reputation: 1, health: -1 }, result: '这次名次上去了，下月又掉。' },
      { text: '把考核标准改宽松些', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '标准改了，问题还在，被人看出来。' },
    ],
  },
  {
    title: '应急演练',
    scene: '要组织一次应急演练，往年都是走个形式。',
    options: [
      { text: '不预告，随机拉一次，事后复盘', performance: 3, effect: { reputation: 4, health: -1 }, result: '暴露了五个问题，逐一改掉。' },
      { text: '按脚本走一遍', performance: 1, effect: { reputation: 1 }, result: '走得很顺，什么也没测出来。' },
      { text: '拍几张照片交差', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '真出事时没人知道该干什么。' },
    ],
  },
  {
    title: '人大代表联络',
    scene: '一位代表提了一件比较尖锐的事，正是你分管的。',
    options: [
      { text: '当面听，能办的列时限，不能办的说清为什么', performance: 3, effect: { reputation: 3, network: 2 }, result: '代表后来在会上替你说了话。' },
      { text: '书面答复', performance: 1, effect: { reputation: 1 }, result: '答复了，代表不满意。' },
      { text: '拖着不答复', performance: -2, effect: { reputation: -3 }, result: '建议在会上被再提了一次。' },
    ],
  },
  {
    title: '村庄规划',
    scene: '要做村庄规划，村民想要的和规划规范冲突。',
    options: [
      { text: '把规范讲透，在允许的范围内尽量满足', performance: 3, effect: { reputation: 4, health: -1 }, result: '规划通过了，也没伤感情。' },
      { text: '按规范做，不做解释', performance: 1, effect: { reputation: 1 }, result: '规划批了，村民不认。' },
      { text: '按村民说的做，先报上去', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '报上去被打回三次。' },
    ],
  },
  {
    title: '用电保障',
    scene: '夏天用电高峰，一个片区老跳闸。',
    options: [
      { text: '请供电所一起查线路，定改造时序', performance: 3, effect: { reputation: 3, network: 1 }, result: '改造完了，那年夏天没再跳。' },
      { text: '报修一次', performance: 1, effect: { reputation: 1 }, result: '修了，过几天又跳。' },
      { text: '让村民少开空调', performance: -2, effect: { reputation: -3 }, result: '这句话被人发到了群里。' },
    ],
  },
  {
    title: '农产品滞销',
    scene: '一个村的果子熟了卖不出去，眼看要烂在地里。',
    options: [
      { text: '对接渠道、办采摘，同时摸清明年怎么防', performance: 3, effect: { reputation: 4, network: 2, health: -2 }, result: '卖掉大半，第二年签了订单。' },
      { text: '发动机关干部买一点', performance: 1, effect: { reputation: 1 }, result: '买了一点，杯水车薪。' },
      { text: '上报等支持', performance: -1, effect: { reputation: -2 }, result: '支持来的时候果子已经落了。' },
    ],
  },
  {
    title: '工程验收',
    scene: '一个小工程要验收，有几处做法和图纸不一样。',
    options: [
      { text: '逐项对照，不一致的要求整改后复验', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '整改完再验，这一年没出质量问题。' },
      { text: '大差不差就签', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了，半年后那几处出了问题。' },
      { text: '照签，反正有监理', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '出事后监理拿出了签字页。' },
    ],
  },
  {
    title: '条线总结',
    scene: '年底要交条线总结，成绩有几项，问题也不少。',
    options: [
      { text: '成绩写足，问题写实，明年打算写清', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '这份总结被拿去当范本。' },
      { text: '只写成绩', performance: 1, effect: { reputation: 1 }, result: '读了没人记住。' },
      { text: '把别人的成绩算进来', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '会上有人当场更正。' },
    ],
  },
  {
    title: '邻镇协作',
    scene: '一条跨界的水渠，两个镇各管一段，谁都不肯先动。',
    options: [
      { text: '主动约对方碰头，把责任段和投资比例谈清', performance: 3, effect: { reputation: 3, network: 2 }, result: '谈成了，那年的灌溉没出问题。' },
      { text: '各修各的那段', performance: 1, effect: { reputation: 1 }, result: '修了，接口处还是断的。' },
      { text: '拖，等上面来协调', performance: -1, effect: { reputation: -2 }, result: '上面协调时，两边都被说了。' },
    ],
  },
  {
    title: '纪律提醒',
    scene: '有人在你分管的环节上塞了东西，说是"一点心意"。',
    options: [
      { text: '当场退回并说明规矩，事后在条线会上讲一次', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '退了，往后这条线再没人敢提。' },
      { text: '退回去，不声张', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '退了，但对方还会再试。' },
      { text: '收下，就这一次', performance: -3, effect: { reputation: -4, integrity: -5, network: 1 }, result: '有了第一次，第二次就不好拒了。' },
    ],
  },
  {
    title: '年后开局',
    scene: '新的一年条线任务下来了，比去年还重。',
    options: [
      { text: '按轻重缓急排三档，明确哪几件必须做成', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '年底三件都成了，别的也没落下。' },
      { text: '摊下去，大家分', performance: 1, effect: { reputation: 1 }, result: '分了，年底样样都差一点。' },
      { text: '先做容易出彩的', performance: -1, effect: { reputation: -2 }, result: '出彩了，硬骨头留到了最后。' },
    ],
  },
  {
    title: '提拔谈话',
    scene: '组织上找你谈话，问你愿不愿意去更远的一个镇。',
    options: [
      { text: '问清岗位职责和组织考虑，当场表态服从', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '去了，一年后成了正科的候选人。' },
      { text: '表示想去，但想留在本地', performance: 1, effect: { reputation: 1 }, result: '留下了，也在名单上划了一下。' },
      { text: '托人打听能不能换个近的地方', performance: -2, effect: { reputation: -3 }, result: '消息传到组织那里，印象打了折。' },
    ],
  },
];
