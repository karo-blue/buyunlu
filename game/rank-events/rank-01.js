// 职级 1 · 二级科员（22 岁起，云岭镇基层岗位）
//
// 权力边界：没有审批权、没有签字权。能做的是窗口、入户、台账、报表、会务、值守。
// 所以这一级的题目全部围绕「把一件小事办到什么程度」，不涉及资金分配与人事安排。
// 50 道。

module.exports = [
  {
    title: '窗口咨询',
    scene: '有群众来窗口问社保转移怎么办，材料没带齐，情绪已经有点急。',
    options: [
      { text: '先安抚，列出缺少的材料并约好补交方式', performance: 3, effect: { reputation: 4, network: 1 }, result: '对方带着清单走了，第二天补齐办完，窗口少了半个钟头的争执。' },
      { text: '照规定告知材料不齐，请其下次再来', performance: 1, effect: { reputation: 1 }, result: '流程没出错，但对方还要再跑一趟。' },
      { text: '让他先去找村里问清楚再来', performance: -1, effect: { reputation: -2 }, result: '事情被推出去了，第二天镇里接到投诉电话。' },
    ],
  },
  {
    title: '材料核验',
    scene: '一批申请材料堆在桌上，有几份复印件看不清关键信息。',
    options: [
      { text: '逐份核对，把模糊的挑出来退回重报', performance: 3, effect: { reputation: 3, health: -2 }, result: '多花了两小时，但这一批没留下隐患。' },
      { text: '按能看清的部分录入，模糊的先放着', performance: 1, effect: { reputation: 1 }, result: '进度没耽误，后面可能要返工。' },
      { text: '照单全收，先录进去再说', performance: -1, effect: { reputation: -2 }, result: '录入很快，复核时被退回来重做。' },
    ],
  },
  {
    title: '档案整理',
    scene: '档案柜里三年的材料混在一起，上级要求本周完成清理。',
    options: [
      { text: '按年份和类别重新编号，补一份目录', performance: 3, effect: { reputation: 3, seniority: 1, health: -2 }, result: '后来谁找材料都能一翻就到。' },
      { text: '分堆归位，能找到就行', performance: 1, effect: { reputation: 1 }, result: '表面整齐了，目录还是没有。' },
      { text: '把柜子塞满，先应付检查', performance: -1, effect: { reputation: -2 }, result: '检查那天打开柜门，纸掉了半地。' },
    ],
  },
  {
    title: '数据录入',
    scene: '系统要录两百多条台账数据，格式要求很细。',
    options: [
      { text: '先录十条确认格式，再批量推进', performance: 3, effect: { reputation: 3, health: -1 }, result: '一次通过，没有返工。' },
      { text: '边录边改，遇到报错再处理', performance: 1, effect: { reputation: 1, health: -1 }, result: '磕磕绊绊做完了。' },
      { text: '照抄旧表，格式对不对先不管', performance: -1, effect: { reputation: -2 }, result: '系统报了一屏错，全部退回。' },
    ],
  },
  {
    title: '会议记录',
    scene: '镇里开调度会，领导讲话快，让你做记录。',
    options: [
      { text: '记录决议、责任人和时限，会后当天整理发出', performance: 3, effect: { reputation: 3, network: 2 }, result: '这份纪要后来成了督办的依据。' },
      { text: '记下主要意思，会后整理', performance: 1, effect: { reputation: 1 }, result: '纪要能用，但责任人和时限都模糊。' },
      { text: '只记个大概，反正有录音', performance: -1, effect: { reputation: -2 }, result: '会后没人知道谁该干什么。' },
    ],
  },
  {
    title: '下乡入户',
    scene: '要摸清几户人家的实际困难，路不好走，天还下着雨。',
    options: [
      { text: '一户一户走到，把情况记进本子', performance: 3, effect: { reputation: 4, health: -2 }, result: '摸上来的情况比报表准得多。' },
      { text: '找村干部集中问一遍', performance: 1, effect: { network: 2 }, result: '效率高，但细节有出入。' },
      { text: '照去年的名单报上去', performance: -1, effect: { reputation: -2 }, result: '有几户的情况早就变了。' },
    ],
  },
  {
    title: '迎检准备',
    scene: '上级下周来检查，需要准备台账和现场。',
    options: [
      { text: '对照清单逐项自查，缺的补齐', performance: 3, effect: { reputation: 3, health: -2 }, result: '检查组问什么都能答上来。' },
      { text: '把已有的材料整理摆好', performance: 1, effect: { reputation: 1 }, result: '表面过得去，问深了答不出。' },
      { text: '临时补几份材料凑数', performance: -1, effect: { reputation: -3, integrity: -1 }, result: '日期对不上，被当场指出。' },
    ],
  },
  {
    title: '值班值守',
    scene: '节假日轮到你值班，夜里接到一条情况报告。',
    options: [
      { text: '先核实再按流程上报，全程记时间', performance: 3, effect: { reputation: 3, health: -2 }, result: '情况处置得当，记录也完整。' },
      { text: '记下来，等天亮交给带班领导', performance: 1, effect: { reputation: 1 }, result: '没出事，但响应慢了半拍。' },
      { text: '觉得不严重，先睡一觉再说', performance: -2, effect: { reputation: -3 }, result: '第二天事态扩大，没人知道你早就接到过。' },
    ],
  },
  {
    title: '纠纷协管',
    scene: '两户人家为排水沟吵起来，村干部让你去看看。',
    options: [
      { text: '先分开听双方说，再找老辈人一起商量', performance: 3, effect: { reputation: 4, network: 2 }, result: '沟怎么挖定下来了，两家都认。' },
      { text: '各劝两句，让他们自己谈', performance: 1, effect: { reputation: 1 }, result: '当天没再吵，问题还在。' },
      { text: '说这不是你的事，让他们去司法所', performance: -1, effect: { reputation: -2 }, result: '两家的梁子结得更深了。' },
    ],
  },
  {
    title: '统计报表',
    scene: '月底要报一张表，几个村的数据还没收齐。',
    options: [
      { text: '逐个打电话催，核对后再填报', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '表报上去一次通过。' },
      { text: '用上月数据加估算先报', performance: 0, effect: { reputation: -1, integrity: -1 }, result: '数字看起来完整，其实对不上。' },
      { text: '等齐了再说，先不报', performance: -2, effect: { reputation: -2 }, result: '被催了两次，通报里点了名。' },
    ],
  },
  {
    title: '政策宣讲',
    scene: '要向村民讲一项新出的补贴政策，很多人听不懂。',
    options: [
      { text: '用本地方言讲，举身边的例子', performance: 3, effect: { reputation: 4, network: 1 }, result: '当场就有七八户问怎么申请。' },
      { text: '照文件念一遍，发宣传单', performance: 1, effect: { reputation: 1 }, result: '来的人听了，回去还是说不清。' },
      { text: '把宣传单贴出去就算完成', performance: -1, effect: { reputation: -2 }, result: '一个月后问起，几乎没人知道。' },
    ],
  },
  {
    title: '台账建立',
    scene: '一项工作要求建立专门台账，以前没人做过。',
    options: [
      { text: '先定字段和口径，再逐条登记', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '后来别的村都来借这份台账当样板。' },
      { text: '按上级给的模板照填', performance: 1, effect: { reputation: 1 }, result: '能交差，但查起来不方便。' },
      { text: '随便建个表，凑够条数', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '抽查时口径对不上，全部返工。' },
    ],
  },
  {
    title: '业务培训',
    scene: '县里组织业务培训，名额紧，正好轮到你。',
    options: [
      { text: '带着问题去，回来整理成要点分享', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '同事照着你那份要点少走了弯路。' },
      { text: '认真听完，做好笔记', performance: 1, effect: { seniority: 1 }, result: '自己懂了，别人还是不会。' },
      { text: '借机休息两天，签到就走', performance: -2, effect: { reputation: -3, seniority: -1 }, result: '回来什么也说不出，还被记了缺勤。' },
    ],
  },
  {
    title: '陪同调研',
    scene: '上级来镇里调研，安排你跟着做记录、带路。',
    options: [
      { text: '提前踩点，把路线和情况摸清', performance: 3, effect: { reputation: 3, network: 3 }, result: '调研很顺，领导记住了你的名字。' },
      { text: '跟着走，问到再答', performance: 1, effect: { network: 1 }, result: '没出岔子，也没留下印象。' },
      { text: '找机会躲开，少点麻烦', performance: -1, effect: { reputation: -2 }, result: '临时被问到时答不上来。' },
    ],
  },
  {
    title: '热线来电',
    scene: '服务热线转来一件投诉，指向你负责的片区。',
    options: [
      { text: '当天联系当事人，核实后给出答复时限', performance: 3, effect: { reputation: 4, health: -1 }, result: '对方在回访里说了满意。' },
      { text: '按流程登记，转给相关站所', performance: 1, effect: { reputation: 1 }, result: '件转出去了，结果没人跟。' },
      { text: '觉得是小事，压着不回', performance: -2, effect: { reputation: -3 }, result: '当事人又打了一次，这次打到县里。' },
    ],
  },
  {
    title: '来访登记',
    scene: '一位老人来反映待遇问题，说话不太清楚。',
    options: [
      { text: '慢慢听，帮他查档案再解释', performance: 3, effect: { reputation: 4, health: -1 }, result: '老人听明白了，临走一直道谢。' },
      { text: '按规定让他去对应窗口', performance: 1, effect: { reputation: 1 }, result: '流程没错，老人还要再跑。' },
      { text: '说这不归你管，让他下次来', performance: -2, effect: { reputation: -3 }, result: '老人在走廊坐了半天。' },
    ],
  },
  {
    title: '低保复核',
    scene: '低保户年度复核，有一户的情况和申报时不太一样。',
    options: [
      { text: '上门核实，如实记录变化', performance: 3, effect: { reputation: 3, integrity: 1, health: -1 }, result: '调整得及时，没人说闲话。' },
      { text: '照去年的名单报', performance: 0, effect: { reputation: -1 }, result: '报上去了，心里一直不踏实。' },
      { text: '按人情照顾一下，不改', performance: -2, effect: { reputation: -2, integrity: -3 }, result: '公示期间被人举报，核查组来了。' },
    ],
  },
  {
    title: '社保代办',
    scene: '几位老人不会用手机做认证，子女又不在身边。',
    options: [
      { text: '约个时间上门帮着办', performance: 3, effect: { reputation: 4, network: 1, health: -1 }, result: '几位老人的认证当天就办完了。' },
      { text: '在窗口留个指引，让他们找人帮忙', performance: 1, effect: { reputation: 1 }, result: '能办的多半还是没办成。' },
      { text: '告诉他们自己想办法', performance: -2, effect: { reputation: -3 }, result: '有人因为没认证停了待遇。' },
    ],
  },
  {
    title: '汛期值守',
    scene: '连日降雨，一处低洼路段开始积水。',
    options: [
      { text: '连夜巡查，设警示并上报', performance: 3, effect: { reputation: 4, health: -3 }, result: '夜里没人误入，第二天排水也及时。' },
      { text: '白天去看一趟，记进记录', performance: 1, effect: { reputation: 1 }, result: '没出事，但夜里那段没人管。' },
      { text: '等雨停了再说', performance: -2, effect: { reputation: -3 }, result: '有车半夜陷在水里。' },
    ],
  },
  {
    title: '防火宣传',
    scene: '进入森林防火期，要进村入户做宣传。',
    options: [
      { text: '挨户讲，重点盯住几个常上山的人', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '整个防火期没起火情。' },
      { text: '贴标语、放广播', performance: 1, effect: { reputation: 1 }, result: '形式有了，效果说不清。' },
      { text: '把宣传品发下去就算完成', performance: -1, effect: { reputation: -2 }, result: '有人在山上烧荒，差点出事。' },
    ],
  },
  {
    title: '走访慰问',
    scene: '节前要走访几户困难家庭，名单是上面给的。',
    options: [
      { text: '提前了解每家情况，问到具体难处', performance: 3, effect: { reputation: 4, network: 2 }, result: '走访之后，有两户的事被真正推动了。' },
      { text: '按名单走一遍，送到就走', performance: 1, effect: { reputation: 1 }, result: '任务完成了，情况还是老样子。' },
      { text: '让人代签代领，节省时间', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '有人根本没收到，事后被查出来。' },
    ],
  },
  {
    title: '信息报送',
    scene: '镇里要求每天报送一条工作信息。',
    options: [
      { text: '挑当天真解决问题的事写', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '有两条被县里采用了。' },
      { text: '把做过的事记流水账', performance: 1, effect: { reputation: 1 }, result: '报了，没人看。' },
      { text: '抄昨天的改个日期', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被编辑一眼看出，退回重写。' },
    ],
  },
  {
    title: '保密自查',
    scene: '要求对办公电脑和文件做一次保密自查。',
    options: [
      { text: '逐台核对，把不该留的清理掉', performance: 3, effect: { reputation: 2, integrity: 1, health: -1 }, result: '自查报告写得很实，抽查也没问题。' },
      { text: '填表交差', performance: 1, effect: { reputation: 1 }, result: '表交了，问题还在。' },
      { text: '把材料拷回家继续做', performance: -2, effect: { reputation: -2, integrity: -3 }, result: '被提醒了一次，写了情况说明。' },
    ],
  },
  {
    title: '差旅报销',
    scene: '下乡一趟回来要报销，票据有点乱。',
    options: [
      { text: '按实际逐张整理，多退少补', performance: 3, effect: { reputation: 2, integrity: 1 }, result: '报销一次过，财务印象很好。' },
      { text: '凑齐票据交上去', performance: 1, effect: { reputation: 1 }, result: '报下来了，明细说不清。' },
      { text: '顺手把私事的花销夹进去', performance: -2, effect: { reputation: -3, integrity: -4 }, result: '财务核对时问了一句，你答不上来。' },
    ],
  },
  {
    title: '档案数字化',
    scene: '要把纸质档案扫描录入系统，量很大。',
    options: [
      { text: '先做试点，定标准再铺开', performance: 3, effect: { reputation: 3, seniority: 1, health: -2 }, result: '后来扫描件的质量一直很稳。' },
      { text: '按顺序扫，能看清就行', performance: 1, effect: { reputation: 1, health: -1 }, result: '扫完了，有一批模糊的没发现。' },
      { text: '随便扫几页充数', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '抽查发现缺页，全部重来。' },
    ],
  },
  {
    title: '证明开具',
    scene: '有人来开一份证明，内容涉及你没核实过的情况。',
    options: [
      { text: '先核实，能开才开', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '开出去的每一份都经得起问。' },
      { text: '按他说的写，让他自己负责', performance: 0, effect: { reputation: -1, integrity: -1 }, result: '证明是开了，风险留给了自己。' },
      { text: '碍于情面直接盖章', performance: -2, effect: { reputation: -3, integrity: -4 }, result: '后来这份证明被追着问了很久。' },
    ],
  },
  {
    title: '信访件登记',
    scene: '收到一封信访件，措辞激烈，指向的是邻村的事。',
    options: [
      { text: '按规定登记、转送，并告知受理情况', performance: 3, effect: { reputation: 3, network: 1 }, result: '件进了流程，对方不再反复来信。' },
      { text: '登记后放着，等领导安排', performance: 1, effect: { reputation: 1 }, result: '件压在桌上，期限一天天过。' },
      { text: '觉得是老上访户，不登记', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '期限过了才被发现，挨了批评。' },
    ],
  },
  {
    title: '数据核对',
    scene: '两张表里同一项数字对不上，差得还不小。',
    options: [
      { text: '回原始凭证逐条核，找出差在哪', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '差在口径上，顺手把口径统一了。' },
      { text: '按多数那张表填报', performance: 1, effect: { reputation: 1 }, result: '报上去了，错误也一起报上去了。' },
      { text: '随手改一个数字让它对上', performance: -2, effect: { reputation: -3, integrity: -4 }, result: '后来被复查发现，说不清为什么改。' },
    ],
  },
  {
    title: '会务保障',
    scene: '明天有个重要会议，会场还没布置。',
    options: [
      { text: '提前踩点，设备、材料、座次都过一遍', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '会议很顺，没有人临时找东西。' },
      { text: '按要求摆好，材料放桌上', performance: 1, effect: { reputation: 1 }, result: '能开会，中间出了点小状况。' },
      { text: '等会前半小时再说', performance: -2, effect: { reputation: -3 }, result: '话筒没试，开场就卡了十分钟。' },
    ],
  },
  {
    title: '督查整改',
    scene: '上次督查指出的问题，整改期限快到了。',
    options: [
      { text: '逐条对照，改完一个销一个', performance: 3, effect: { reputation: 3, integrity: 1, health: -1 }, result: '复查时全部销号。' },
      { text: '改了容易的，难的先拖着', performance: 1, effect: { reputation: 1 }, result: '报上去说在推进，其实没动。' },
      { text: '补一份整改报告了事', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '复查组一到现场就明白了。' },
    ],
  },
  {
    title: '材料报送时限',
    scene: '一份材料要求今天下班前报，你手上还有别的事。',
    options: [
      { text: '先排好优先级，按时交一版完整的', performance: 3, effect: { reputation: 3, health: -1 }, result: '按时报上，质量也没打折。' },
      { text: '先交个初稿说明情况', performance: 1, effect: { reputation: 1 }, result: '没超时，但被退回来改。' },
      { text: '拖到明天再说', performance: -2, effect: { reputation: -3 }, result: '通报里点了你的名字。' },
    ],
  },
  {
    title: '节假日值班',
    scene: '轮到你值三天班，家里有点事。',
    options: [
      { text: '按规定完成交接，做好记录再走', performance: 3, effect: { reputation: 3, network: 1 }, result: '交接清清楚楚，没出空档。' },
      { text: '找人替一下，口头说一声', performance: 1, effect: { reputation: 1 }, result: '没出事，但交接没留痕。' },
      { text: '不来也不说', performance: -3, effect: { reputation: -4, integrity: -2 }, result: '查岗发现空岗，写了书面检查。' },
    ],
  },
  {
    title: '反诈宣传',
    scene: '村里接连有人接到诈骗电话，要入户做提醒。',
    options: [
      { text: '结合真实案例讲套路，重点盯独居老人', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '当月拦下了两起正在进行的转账。' },
      { text: '发宣传页，群里转一下', performance: 1, effect: { reputation: 1 }, result: '宣传覆盖了，效果说不准。' },
      { text: '等出了事再处理', performance: -2, effect: { reputation: -3 }, result: '有一户真的被骗了，来找你哭。' },
    ],
  },
  {
    title: '人居环境',
    scene: '村道两边堆着柴草和旧物，整治要求下来了。',
    options: [
      { text: '先跟村民商量堆放点，再动手清', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '路通了，也没跟人结怨。' },
      { text: '限期清理，到期统一清走', performance: 1, effect: { reputation: 1 }, result: '清干净了，有人背后骂。' },
      { text: '只清主路，别的看不见就不管', performance: -1, effect: { reputation: -2 }, result: '检查走的是另一条路，被拍了照。' },
    ],
  },
  {
    title: '户厕改造',
    scene: '几户人家的厕所要改，有人不愿意动工。',
    options: [
      { text: '先做一户样板，让邻居自己看效果', performance: 3, effect: { reputation: 4, network: 2 }, result: '看完样板，剩下几户主动报了名。' },
      { text: '挨家做工作，讲政策', performance: 1, effect: { reputation: 1, network: 1 }, result: '动员了一半。' },
      { text: '报个完成数，先应付', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '验收时户数对不上。' },
    ],
  },
  {
    title: '饮水安全',
    scene: '有村民反映自家井水有异味。',
    options: [
      { text: '当天取样送检，暂时安排替代水源', performance: 3, effect: { reputation: 4, health: -1 }, result: '结果出来得快，人也喝上了放心水。' },
      { text: '记录下来，向上反映', performance: 1, effect: { reputation: 1 }, result: '反映上去了，等了一阵。' },
      { text: '说可能是天气原因，再看看', performance: -2, effect: { reputation: -3 }, result: '后来有几个人闹肚子，事情闹大了。' },
    ],
  },
  {
    title: '道路隐患',
    scene: '一段村路被雨水冲出缺口，还没断交。',
    options: [
      { text: '先设警示、报修，再盯修复', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '修好了，期间没人出事。' },
      { text: '报给养护部门就完事', performance: 1, effect: { reputation: 1 }, result: '报了，修得慢。' },
      { text: '等它彻底断了再报', performance: -2, effect: { reputation: -3 }, result: '有摩托车夜间摔了进去。' },
    ],
  },
  {
    title: '助学申报',
    scene: '一户人家的孩子考上学校，助学金申报材料交不上来。',
    options: [
      { text: '上门帮着准备材料，赶在截止前报出', performance: 3, effect: { reputation: 4, network: 1 }, result: '孩子按时拿到了资助。' },
      { text: '告诉他们流程和截止日期', performance: 1, effect: { reputation: 1 }, result: '能不能办成看他们自己。' },
      { text: '错过就算了，明年再说', performance: -2, effect: { reputation: -3 }, result: '那一年这户的压力很大。' },
    ],
  },
  {
    title: '退役军人服务',
    scene: '一位退役军人来问优待证怎么办理。',
    options: [
      { text: '帮着查清流程，一次告知所需材料', performance: 3, effect: { reputation: 3, network: 2 }, result: '一次办成，他还带了几个人来问。' },
      { text: '告诉他去县里问', performance: 1, effect: { reputation: 1 }, result: '他跑了一趟县城。' },
      { text: '说不清楚，让他等通知', performance: -2, effect: { reputation: -3 }, result: '他在镇里等了半天。' },
    ],
  },
  {
    title: '留守老人',
    scene: '片区里几位老人长期独居，天冷了。',
    options: [
      { text: '排个名单，定期上门看看', performance: 3, effect: { reputation: 4, network: 1, health: -1 }, result: '有一次及时发现老人摔了跤。' },
      { text: '电话问一轮', performance: 1, effect: { reputation: 1 }, result: '都接了，都说没事。' },
      { text: '没人反映就不用管', performance: -2, effect: { reputation: -3 }, result: '开春才发现有一户出了事。' },
    ],
  },
  {
    title: '春耕备耕',
    scene: '要摸清农资需求和渠道，季节不等人。',
    options: [
      { text: '逐村统计，提前对接供应', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '没出现断供，也没人哄抬。' },
      { text: '让各村自己报需求', performance: 1, effect: { reputation: 1 }, result: '报上来的数不太准。' },
      { text: '等农户来问再说', performance: -1, effect: { reputation: -2 }, result: '开春那阵子天天有人上门问。' },
    ],
  },
  {
    title: '禁烧巡查',
    scene: '秸秆禁烧期，你在田埂上转。',
    options: [
      { text: '分片盯守，重点时段不离开', performance: 3, effect: { reputation: 3, health: -2 }, result: '整个期间没有火点。' },
      { text: '按路线巡一圈', performance: 1, effect: { reputation: 1, health: -1 }, result: '巡了，但晚间那阵没人。' },
      { text: '在岗点坐着等', performance: -2, effect: { reputation: -3 }, result: '卫星拍到了火点，通报到镇。' },
    ],
  },
  {
    title: '河长巡河',
    scene: '你负责的那段河道最近有人倒垃圾。',
    options: [
      { text: '沿线排查，找源头并设围挡', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '倒垃圾的口子被堵住了。' },
      { text: '把垃圾清了', performance: 1, effect: { reputation: 1, health: -1 }, result: '清完没两天又满了。' },
      { text: '巡河台账照填，问题不写', performance: -2, effect: { reputation: -2, integrity: -2 }, result: '上级巡河时一眼看见了。' },
    ],
  },
  {
    title: '自建房排查',
    scene: '要对自建房做安全排查，有几户不配合。',
    options: [
      { text: '讲清是为他们好，逐户看结构', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '查出两处隐患，及时加固。' },
      { text: '院外看一眼就登记', performance: 1, effect: { reputation: 1 }, result: '表填完了，隐患没发现。' },
      { text: '照着户口本填表交差', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '抽查发现根本没入户。' },
    ],
  },
  {
    title: '地灾点巡查',
    scene: '雨季后要盯住一个地灾隐患点。',
    options: [
      { text: '雨前雨中雨后各看一次，留记录', performance: 3, effect: { reputation: 3, health: -2 }, result: '发现裂缝变化，提前撤了人。' },
      { text: '每周看一次', performance: 1, effect: { reputation: 1 }, result: '没出事，记录也稀。' },
      { text: '电话问监测员', performance: -1, effect: { reputation: -2 }, result: '有一次裂缝变化是村民先发现的。' },
    ],
  },
  {
    title: '医保征缴',
    scene: '到了医保集中缴费期，还有几户没交。',
    options: [
      { text: '上门讲清断保后果，帮着代缴', performance: 3, effect: { reputation: 4, network: 1 }, result: '片区参保率排在前面。' },
      { text: '广播通知，等他们来', performance: 1, effect: { reputation: 1 }, result: '交了一部分。' },
      { text: '报个数字上去', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '有人住院才发现没参保。' },
    ],
  },
  {
    title: '养老认证',
    scene: '一批老人的待遇资格要认证，多数不会用手机。',
    options: [
      { text: '集中一天在村部帮办', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '一天办完大半，剩下的上门。' },
      { text: '让家属帮着认证', performance: 1, effect: { reputation: 1 }, result: '有家属在外地的还是没办。' },
      { text: '没认证就暂停，按规定办', performance: -1, effect: { reputation: -2 }, result: '有几位老人的待遇停了，意见很大。' },
    ],
  },
  {
    title: '就业帮扶',
    scene: '几个返乡的人找不到活干，来找你打听。',
    options: [
      { text: '摸清技能，对接用工信息和培训', performance: 3, effect: { reputation: 3, network: 2 }, result: '有几个人很快上了岗。' },
      { text: '把招工信息贴在公示栏', performance: 1, effect: { reputation: 1 }, result: '看到了多少算多少。' },
      { text: '让他们自己上网找', performance: -1, effect: { reputation: -2 }, result: '来问过的人后来不来了。' },
    ],
  },
  {
    title: '农家书屋',
    scene: '农家书屋长期没人来，书落了一层灰。',
    options: [
      { text: '按村民需要调整书，固定开放时间', performance: 3, effect: { reputation: 3, network: 1, health: -1 }, result: '慢慢有孩子和老人来看书了。' },
      { text: '打扫干净，把门打开', performance: 1, effect: { reputation: 1 }, result: '开了，还是没人来。' },
      { text: '锁着，等检查时再开', performance: -1, effect: { reputation: -2 }, result: '检查那天钥匙找不到了。' },
    ],
  },
  {
    title: '村务公开',
    scene: '村务公开栏内容很久没更新，有人拍照发了群。',
    options: [
      { text: '逐项核账后更新，并说明每一笔', performance: 3, effect: { reputation: 4, integrity: 1, health: -1 }, result: '群里那股气消了，反而有人点赞。' },
      { text: '把新内容贴上去', performance: 1, effect: { reputation: 1 }, result: '更新了，没人再问。' },
      { text: '把旧的内容撕掉，先空着', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '空栏子被拍下来，问的人更多了。' },
    ],
  },
];
