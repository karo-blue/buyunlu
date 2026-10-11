// 职级 4 · 乡科级正职（正科级）
//
// 权力边界：第一次当"一把手"。镇域或部门的事都要你拍板，钱怎么分、人怎么用、
// 风险怎么扛，都是你的题。题目围绕"一把手的取舍与兜底"。
// 50 道。

module.exports = [
  {
    title: '走马上任',
    scene: '到任第一周，桌上堆着三件没解决的事和一份上任留下的清单。',
    options: [
      { text: '先沉下去跑半个月，回来再定盘子', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '半个月后拿出的判断，跟实际对得上。' },
      { text: '先听班子汇报', performance: 1, effect: { reputation: 1 }, result: '听到了一套说法，还有一套没听到。' },
      { text: '上任三把火，先动一件事', performance: -1, effect: { reputation: -2 }, result: '火点了，也没烧到点子上。' },
    ],
  },
  {
    title: '班子磨合',
    scene: '班子里有两位资历比你老，话不太多。',
    options: [
      { text: '逐位上门请教，把职责边界先划清', performance: 3, effect: { reputation: 4, network: 3 }, result: '半年后这两位成了最顶事的人。' },
      { text: '按分工各管各的', performance: 1, effect: { reputation: 1 }, result: '各管各的，遇事还是没人兜。' },
      { text: '用新的人，绕开老的', performance: -2, effect: { reputation: -3, network: -2 }, result: '老的那几位开始袖手旁观。' },
    ],
  },
  {
    title: '全年盘子',
    scene: '要定全年工作盘子，想做的事远多过能做的事。',
    options: [
      { text: '砍到三件，把资源和人都压上去', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '年底三件都成了，上级也认可。' },
      { text: '列十件重点', performance: 1, effect: { reputation: 1, health: -1 }, result: '十件都启动，没一件收口。' },
      { text: '上面要什么做什么', performance: -1, effect: { reputation: -2 }, result: '考核过了，本地什么也没变。' },
    ],
  },
  {
    title: '财政盘子',
    scene: '一年的可用财力定了，刚性支出就占掉大半。',
    options: [
      { text: '重新排优先级，把能缓的缓，把该保的保住', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '紧着过了一年，没欠新账。' },
      { text: '各项都砍一点', performance: 1, effect: { reputation: 1 }, result: '砍完谁都不够用。' },
      { text: '先花，缺口以后再说', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '年底缺口压到了下一任头上。' },
    ],
  },
  {
    title: '人事调整',
    scene: '几个中层岗位空出来了，有人托关系来说情。',
    options: [
      { text: '定标准走程序，结果公示，说情的照退', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 1 }, result: '提上来的人服众，说情的人也没话说。' },
      { text: '平衡各方，各安排一个', performance: 1, effect: { reputation: 1 }, result: '平衡了，岗位和能力对不上。' },
      { text: '按关系亲疏定', performance: -3, effect: { reputation: -4, integrity: -4, network: 1 }, result: '提上来的人撑不住，事砸在你手里。' },
    ],
  },
  {
    title: '班子分工',
    scene: '一件急事，两位副职都说不该自己管。',
    options: [
      { text: '当场明确牵头人并给授权，事后补制度', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '事办了，往后这类事不用再问。' },
      { text: '自己顶上去干', performance: 1, effect: { reputation: 1, health: -2 }, result: '干完了，副职习惯了让你顶。' },
      { text: '让两人协商', performance: -1, effect: { reputation: -2 }, result: '协商了三天，事凉了。' },
    ],
  },
  {
    title: '重大项目',
    scene: '一个能改变镇域格局的项目在谈，条件里有一条你拿不准。',
    options: [
      { text: '把拿不准的那条单独请示，其余照谈', performance: 3, effect: { reputation: 3, seniority: 1, integrity: 1 }, result: '请示有了回音，项目落了地。' },
      { text: '先签下来，边走边补', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '签了，那一条后来成了麻烦。' },
      { text: '为了落地把条件放宽', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '落地了，也留下了后患。' },
    ],
  },
  {
    title: '土地指标',
    scene: '两个项目都要用地，指标只够一个。',
    options: [
      { text: '按产出和带动排序，上会集体定', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '定的那个投产了，另一个也给了说法。' },
      { text: '谁催得急给谁', performance: 1, effect: { reputation: 1 }, result: '给了，另一个项目黄了。' },
      { text: '两个各给一半', performance: -1, effect: { reputation: -2 }, result: '两个都开不了工。' },
    ],
  },
  {
    title: '债务化解',
    scene: '上任留下的一笔欠账到期了，账上没钱。',
    options: [
      { text: '分期谈判，公开还款计划并压缩开支', performance: 3, effect: { reputation: 3, integrity: 2, health: -1 }, result: '对方接受了计划，一年后清了大半。' },
      { text: '先还一部分拖着', performance: 1, effect: { reputation: 1 }, result: '拖了一年，利息又长了一截。' },
      { text: '借新的还旧的', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '窟窿没填，反而更大了。' },
    ],
  },
  {
    title: '招商引资',
    scene: '一家企业想来，开口就要特殊政策。',
    options: [
      { text: '把能给的政策讲清，不能给的说明依据', performance: 3, effect: { reputation: 3, integrity: 2, network: 2 }, result: '企业接受了常规政策，还是来了。' },
      { text: '先答应，想办法变通', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '变通过的口子，后来被人反复引用。' },
      { text: '破例给，先把项目抢到手', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '项目来了，审计时被单独拎出来。' },
    ],
  },
  {
    title: '上任审计',
    scene: '离任审计发现上任留下几笔说不清的支出。',
    options: [
      { text: '如实移送并配合，同时把制度漏洞补上', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '处理完了，你这一任再没出同类问题。' },
      { text: '内部整改，不外传', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '整改了，账还是那本账。' },
      { text: '帮忙把账抹平', performance: -3, effect: { reputation: -4, integrity: -5 }, result: '抹平的事，你自己也进去了。' },
    ],
  },
  {
    title: '信访积案',
    scene: '一件压了五年的积案，当事人每周都来。',
    options: [
      { text: '亲自接，把政策和现实的距离说清并给方案', performance: 3, effect: { reputation: 4, health: -1 }, result: '签了协议，人再没来过。' },
      { text: '安排专人盯', performance: 1, effect: { reputation: 1 }, result: '盯了，事情没进展。' },
      { text: '避而不见', performance: -2, effect: { reputation: -3 }, result: '人跑去了市里。' },
    ],
  },
  {
    title: '安全事故',
    scene: '你辖区里出了一起生产安全事故，有人受伤。',
    options: [
      { text: '第一时间到现场处置并上报，不瞒不拖', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '处置及时，问责时也说得清。' },
      { text: '先处置，视情况再报', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '报晚了，被认定迟报。' },
      { text: '压下来内部处理', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '消息走漏，责任更重。' },
    ],
  },
  {
    title: '突发公共卫生事件',
    scene: '辖区出现不明原因的聚集性病例，消息还没扩散。',
    options: [
      { text: '立即启动预案、上报并划定管控范围', performance: 3, effect: { reputation: 4, integrity: 2, health: -3 }, result: '控制住了，上级的评价是"反应快"。' },
      { text: '先核实再上报', performance: 1, effect: { reputation: 1, health: -1 }, result: '核实完报上去，已经晚了半天。' },
      { text: '先内部稳住，别引起恐慌', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '稳了两天，扩散开了。' },
    ],
  },
  {
    title: '上级考核',
    scene: '考核方案下来了，有几项指标明显不符合本地实际。',
    options: [
      { text: '照实反馈意见并拿出替代口径，同时把能做的做到位', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '意见被部分采纳，考核也没落下。' },
      { text: '照单全收，加码完成', performance: 1, effect: { reputation: 1, health: -2 }, result: '完成了，代价是全年都在应付。' },
      { text: '想办法在数据上达标', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '达标了，抽查时被发现口径有问题。' },
    ],
  },
  {
    title: '镇域规划',
    scene: '要修编镇域规划，各方对用地方向分歧很大。',
    options: [
      { text: '开几轮论证，把分歧摆到桌面上定方向', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '规划通过，五年没大改。' },
      { text: '委托设计院出方案，班子看一下', performance: 1, effect: { reputation: 1 }, result: '方案出来了，执行时处处卡。' },
      { text: '按主要领导的意思定', performance: -1, effect: { reputation: -2 }, result: '定了，落地时被反复推翻。' },
    ],
  },
  {
    title: '干部队伍',
    scene: '整个队伍年龄偏大，几个关键岗位没有后备。',
    options: [
      { text: '建梯队，给年轻人压担子也容错', performance: 3, effect: { reputation: 3, network: 3, seniority: 2 }, result: '两年后关键岗位都有人能顶。' },
      { text: '外面调几个人进来', performance: 1, effect: { reputation: 1 }, result: '调来了，本地的人更没劲了。' },
      { text: '先应付着，用老同志顶', performance: -1, effect: { reputation: -2 }, result: '老同志退了，岗位空了半年。' },
    ],
  },
  {
    title: '部门协调',
    scene: '一件涉及县直好几个部门的事，卡在某个环节三个月。',
    options: [
      { text: '带着方案逐个上门，最后请分管领导开一次协调会', performance: 3, effect: { reputation: 3, network: 3, health: -1 }, result: '会开完，事通了。' },
      { text: '发函催办', performance: 1, effect: { reputation: 1 }, result: '函发了，回函说在研究。' },
      { text: '请上级主要领导压', performance: -1, effect: { reputation: -2, network: -1 }, result: '压成了，往后没人愿意配合。' },
    ],
  },
  {
    title: '村集体收入',
    scene: '一半的村集体收入几乎为零，靠转移支付过日子。',
    options: [
      { text: '逐村盘资源，一村一策找能造血的路子', performance: 3, effect: { reputation: 4, seniority: 2, health: -2 }, result: '两年后有收入的村多了一半。' },
      { text: '选两个基础好的先做', performance: 1, effect: { reputation: 1 }, result: '两个村起来了，别的还是零。' },
      { text: '靠补助维持', performance: -1, effect: { reputation: -2 }, result: '补助一停，又回去了。' },
    ],
  },
  {
    title: '城镇管理',
    scene: '镇区秩序多年没人管，探头和人员的缺口都很大。',
    options: [
      { text: '先划重点区域，把有限的力气压在群众反映最多的地方', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '半年后镇区像样了，投诉降了大半。' },
      { text: '按上级要求配齐再管', performance: 1, effect: { reputation: 1 }, result: '等配齐，一年过去了。' },
      { text: '搞几次集中整治', performance: -1, effect: { reputation: -2 }, result: '整治完就反弹。' },
    ],
  },
  {
    title: '教育资源',
    scene: '镇上的中学教师流失严重，家长开始往外送孩子。',
    options: [
      { text: '摸清流失原因，从待遇和生活条件两头想办法', performance: 3, effect: { reputation: 4, seniority: 1, health: -1 }, result: '留住了大半，第二年回流了几个。' },
      { text: '向上要编制和资金', performance: 1, effect: { reputation: 1 }, result: '要到了一点，缺口还很大。' },
      { text: '做家长工作，别往外送', performance: -2, effect: { reputation: -3 }, result: '家长不听，反而更不信任。' },
    ],
  },
  {
    title: '医疗资源',
    scene: '镇卫生院看不了常见病，群众都往县城跑。',
    options: [
      { text: '跟县里谈对口支援，同时把设备缺口列清楚', performance: 3, effect: { reputation: 4, network: 2 }, result: '支援来了，能看的病多了十几种。' },
      { text: '要求卫生院自己提升', performance: 1, effect: { reputation: 1 }, result: '要求提了，能力没变。' },
      { text: '先放一放，财力不允许', performance: -1, effect: { reputation: -2 }, result: '群众意见更大了。' },
    ],
  },
  {
    title: '饮水安全',
    scene: '几个村的水源检测不达标，改水要动大工程。',
    options: [
      { text: '先上临时供水保障，同时把改水工程立项', performance: 3, effect: { reputation: 4, integrity: 1, health: -2 }, result: '临时措施顶上了，工程也批下来了。' },
      { text: '立项等资金', performance: 1, effect: { reputation: 1 }, result: '等了一年，水还是那样。' },
      { text: '检测结果不外传，先稳住', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '有人自己送检，事情闹大了。' },
    ],
  },
  {
    title: '乡村建设',
    scene: '一笔乡村建设资金到了，是撒胡椒面还是集中做？',
    options: [
      { text: '集中做两个村，做出样子再推', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '两个村成了样板，第二年资金更好争取。' },
      { text: '各村平均分', performance: 1, effect: { reputation: 1 }, result: '分了，哪个村都没变样。' },
      { text: '做在路边容易看见的村', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '路过的领导看见了，群众没受益。' },
    ],
  },
  {
    title: '人居环境',
    scene: '垃圾处理跟不上，几个村开始就地焚烧。',
    options: [
      { text: '重排收运线路，增配点位并定监督办法', performance: 3, effect: { reputation: 3, health: -1 }, result: '半年后基本没有露天焚烧。' },
      { text: '发通知禁止焚烧', performance: 1, effect: { reputation: 1 }, result: '通知发了，夜里照烧。' },
      { text: '罚款了事', performance: -2, effect: { reputation: -3 }, result: '罚了，矛盾也激化了。' },
    ],
  },
  {
    title: '产业升级',
    scene: '镇上的主导产业已经十年没变，利润越来越薄。',
    options: [
      { text: '请人做诊断，先扶持一两家转型做样子', performance: 3, effect: { reputation: 3, network: 2, seniority: 2 }, result: '两家转成功了，跟着转的越来越多。' },
      { text: '号召企业自己创新', performance: 1, effect: { reputation: 1 }, result: '号召了，没人动。' },
      { text: '维持现状，别出事就行', performance: -1, effect: { reputation: -2 }, result: '两年后产业垮了大半。' },
    ],
  },
  {
    title: '电商进村',
    scene: '要推农产品上网，村里没人懂，物流也是问题。',
    options: [
      { text: '先解决物流和品控，再培训一批年轻人', performance: 3, effect: { reputation: 3, network: 2 }, result: '第一年做出一个爆款，第二年带动了几十户。' },
      { text: '先开几个网店', performance: 1, effect: { reputation: 1 }, result: '店开了，没什么单。' },
      { text: '请代运营，花钱买数据', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '数据好看，农户一分没多赚。' },
    ],
  },
  {
    title: '文旅开发',
    scene: '有人看中了本地的老建筑想开发，村民意见不一。',
    options: [
      { text: '先确权和评估，再谈开发方式和收益分配', performance: 3, effect: { reputation: 3, seniority: 1, integrity: 1 }, result: '谈成了，村民年年有分红。' },
      { text: '先签框架协议', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了，确权问题一年都没解决。' },
      { text: '低价整体交给投资人', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '村民闹了三年，项目停摆。' },
    ],
  },
  {
    title: '园区建设',
    scene: '要建一个产业园，起步阶段招商很难。',
    options: [
      { text: '先把配套做起来，宁可慢一点也要引对的企业', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '第二年引来两家链主，园区活了。' },
      { text: '给优惠先把企业填进去', performance: 1, effect: { reputation: 1 }, result: '填满了，产出很低。' },
      { text: '先把厂房建起来', performance: -1, effect: { reputation: -2 }, result: '厂房空了两年。' },
    ],
  },
  {
    title: '企业纾困',
    scene: '一家用工大户资金链断了，几百人要失业。',
    options: [
      { text: '摸清是暂时困难还是根本问题，分别想办法', performance: 3, effect: { reputation: 4, network: 2, health: -1 }, result: '暂时困难的那家救回来了。' },
      { text: '协调贷款续上', performance: 1, effect: { reputation: 1, network: 1 }, result: '续上了，半年后又断。' },
      { text: '不管，让市场决定', performance: -2, effect: { reputation: -3 }, result: '人失业了，镇上一下子多了很多事。' },
    ],
  },
  {
    title: '营商环境',
    scene: '有企业反映办一件事要跑很多趟，还经常找不到人。',
    options: [
      { text: '自己带着材料走一遍流程，把卡点全部改掉', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '跑动次数少了一大半，企业口碑变了。' },
      { text: '要求窗口改进作风', performance: 1, effect: { reputation: 1 }, result: '作风改了，流程还是那样。' },
      { text: '给这家企业开绿色通道', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '这家方便了，别家更不满。' },
    ],
  },
  {
    title: '税费征管',
    scene: '完成任务和涵养税源有点冲突，年底压力很大。',
    options: [
      { text: '依法征管，同时把服务做上去涵养税源', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '当年任务完成，第二年税源还涨了。' },
      { text: '先完成当年任务', performance: 1, effect: { reputation: 1 }, result: '完成了，几家小企业关了门。' },
      { text: '想办法调剂一下', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '调剂的事，审计时躲不过。' },
    ],
  },
  {
    title: '工程项目',
    scene: '一个工程要发包，有人提前来找你打招呼。',
    options: [
      { text: '全程按程序走，打招呼的一律登记备案', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '工程顺利，往后打招呼的人少了。' },
      { text: '不表态，交给分管副职', performance: 1, effect: { reputation: 1 }, result: '副职被缠得没办法。' },
      { text: '照顾一下熟人', performance: -3, effect: { reputation: -4, integrity: -5, network: 1 }, result: '熟人做的工程质量不过关，你说不得。' },
    ],
  },
  {
    title: '招投标',
    scene: '一次开标，有人质疑程序有问题。',
    options: [
      { text: '暂停，请监督部门介入查清再定', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '查清后重新开，没人再说闲话。' },
      { text: '让招标方解释', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '解释了，质疑还在。' },
      { text: '照常定标', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '质疑上去了，被要求复核。' },
    ],
  },
  {
    title: '工程欠款',
    scene: '几个工程队来要钱，账上确实没有。',
    options: [
      { text: '当面说清情况，给出还款计划并签字', performance: 3, effect: { reputation: 3, integrity: 1, health: -1 }, result: '工程队接受了计划，没有闹。' },
      { text: '让财务去谈', performance: 1, effect: { reputation: 1 }, result: '谈了，工程队还是堵门。' },
      { text: '躲着不见', performance: -2, effect: { reputation: -3 }, result: '人堵到了县里。' },
    ],
  },
  {
    title: '生态治理',
    scene: '一家老企业排污不达标，关停会影响几百人就业。',
    options: [
      { text: '给整改期限和技术支持，同步安排就业出路', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '半年后达标了，人也留下了。' },
      { text: '限期整改，不改就关', performance: 1, effect: { reputation: 1 }, result: '整改走过场，一年后还是关了。' },
      { text: '睁只眼闭只眼，先保就业', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被督察发现，企业和人都没了。' },
    ],
  },
  {
    title: '河湖治理',
    scene: '一条河的治理涉及上下游三个乡镇。',
    options: [
      { text: '牵头建联防机制，把责任段和考核统一', performance: 3, effect: { reputation: 3, network: 3, seniority: 1 }, result: '一年后水质明显改善。' },
      { text: '管好自己这一段', performance: 1, effect: { reputation: 1 }, result: '自己这段清了，上游还在排。' },
      { text: '等上级统一部署', performance: -1, effect: { reputation: -2 }, result: '等了一年，问题还在。' },
    ],
  },
  {
    title: '森林防火',
    scene: '进入防火期，护林员人手不够，装备也旧。',
    options: [
      { text: '重新布点，把重点区域盯死并做一次演练', performance: 3, effect: { reputation: 3, health: -2 }, result: '那一季没有火情。' },
      { text: '发通知，加强巡查', performance: 1, effect: { reputation: 1 }, result: '巡查了，还是着了一次小火。' },
      { text: '按去年办', performance: -2, effect: { reputation: -3 }, result: '着了一场大火的边缘。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '有些耕地被撂荒，还有些被挪作他用。',
    options: [
      { text: '逐块摸底，能复耕的复耕，该整改的整改', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '复耕了一大片，也没出群体性事件。' },
      { text: '发通知要求复耕', performance: 1, effect: { reputation: 1 }, result: '通知发了，地还是荒着。' },
      { text: '报个复耕数字交差', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '卫星图斑一比就露了。' },
    ],
  },
  {
    title: '耕地保护',
    scene: '一个项目想占一块基本农田，投资方很有背景。',
    options: [
      { text: '明确不能占，另外帮着找合规地块', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '项目挪了地方，也没得罪人。' },
      { text: '往上请示', performance: 1, effect: { reputation: 1 }, result: '请示了，等了两个月。' },
      { text: '变通一下先占', performance: -3, effect: { reputation: -4, integrity: -5 }, result: '图斑被发现，问责到了你。' },
    ],
  },
  {
    title: '统计工作',
    scene: '几个统计指标不好看，有人建议在口径上想想办法。',
    options: [
      { text: '照实报，把下滑原因和举措一并说明', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '上级反而认可了这份说明。' },
      { text: '按去年的数微调', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '微调了，后面越来越难圆。' },
      { text: '授意改数', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '统计核查时，第一责任人是你。' },
    ],
  },
  {
    title: '舆情应对',
    scene: '一件事在网上传开，说法和事实有出入，外面已经有人在等回应。',
    options: [
      { text: '核清事实后主动说，认错的认错，整改的给时限', performance: 3, effect: { reputation: 4, health: -1 }, result: '回应之后风向转了。' },
      { text: '等上级统一口径', performance: 1, effect: { reputation: 1 }, result: '等到口径时，话题已经换了三轮。' },
      { text: '找人把帖子压下去', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '压了这边，那边又冒出来。' },
    ],
  },
  {
    title: '突发事件',
    scene: '深夜接到报告，辖区一处出现险情，情况不明。',
    options: [
      { text: '立即到现场，边处置边上报', performance: 3, effect: { reputation: 4, health: -3, integrity: 1 }, result: '处置得当，事后被作为正面案例。' },
      { text: '电话指挥，等天亮再去看', performance: 1, effect: { reputation: 1 }, result: '天亮去了，损失已经扩大。' },
      { text: '让下面先处理，有情况再报', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '情况失控，问责名单上有你。' },
    ],
  },
  {
    title: '老干部',
    scene: '几位退休老同志对一项新政策意见很大，联名写了信。',
    options: [
      { text: '上门听，能解释的解释，能解决的解决', performance: 3, effect: { reputation: 3, network: 2 }, result: '信撤了，这几位后来还帮着做别人的工作。' },
      { text: '书面答复', performance: 1, effect: { reputation: 1 }, result: '答复了，意见还在。' },
      { text: '不理会', performance: -2, effect: { reputation: -3, network: -1 }, result: '信寄到了上面。' },
    ],
  },
  {
    title: '换届选举',
    scene: '换届在即，有个岗位竞争激烈，有人活动得很厉害。',
    options: [
      { text: '把规矩讲在前面，全程留痕，违纪的一律查', performance: 3, effect: { reputation: 4, integrity: 3 }, result: '换届风清气正，也被上级表扬。' },
      { text: '平衡安排', performance: 1, effect: { reputation: 1 }, result: '平衡了，落选的人不服。' },
      { text: '睁只眼闭只眼', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '换届后被举报，结果被推翻。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你分管的线上有人出了问题，牵扯到你的一个老部下。',
    options: [
      { text: '照规定回避并配合，同时对线上制度做一次排查', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '处理干净了，往后这条线更规范。' },
      { text: '配合调查，不多说', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '配合了，也没撇清。' },
      { text: '想办法保他', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '保不住，还把自己搭进去。' },
    ],
  },
  {
    title: '家属安排',
    scene: '有合作方提出帮你解决一个家里人的工作问题。',
    options: [
      { text: '明确拒绝并记下来，往后跟这家保持距离', performance: 3, effect: { reputation: 2, integrity: 4 }, result: '拒绝了，这家反而更守规矩。' },
      { text: '婉拒，不记录', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '婉拒了，对方还会再来。' },
      { text: '答应，反正不违规', performance: -3, effect: { reputation: -4, integrity: -5, network: 1 }, result: '这份人情，迟早要还。' },
    ],
  },
  {
    title: '上级检查',
    scene: '一次不打招呼的检查，正好查到你最薄弱的一块。',
    options: [
      { text: '照实说明困难和打算，请求指导', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '检查组给了具体建议，还带了资源。' },
      { text: '尽量解释', performance: 1, effect: { reputation: 1 }, result: '解释了，问题还是被记下来。' },
      { text: '临时补材料挡一下', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '补的材料对不上时间，更难看。' },
    ],
  },
  {
    title: '先进评选',
    scene: '你们单位有资格报一个省级先进，材料你已经看过了。',
    options: [
      { text: '核一遍再报，有一项不实的坚决拿掉', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '报上去评上了，也经得起后来查。' },
      { text: '照材料报', performance: 1, effect: { reputation: 1 }, result: '报了，被公示期举报。' },
      { text: '包装一下再报', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '评上了又被摘牌。' },
    ],
  },
  {
    title: '离任交接',
    scene: '你要调走了，交接清单上有几件事是你任内埋下的。',
    options: [
      { text: '逐项写清来龙去脉和风险点，当面交给接任者', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 1 }, result: '接任的人年年还来找你请教，口碑留在了这里。' },
      { text: '按常规交接', performance: 1, effect: { reputation: 1 }, result: '交接完了，几件事后来爆了雷。' },
      { text: '挑好看的写', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '接任者吃了亏，也把话说出去了。' },
    ],
  },
];
