// 职级 5 · 县处级副职（副处级）
//
// 权力边界：分管若干个部门，对一条战线负总责。人、钱、项目都有建议权，
// 但要上常委会定。题目围绕"协调部门、扛住条线、在多方之间找平衡"。
// 50 道。

module.exports = [
  {
    title: '分管分工',
    scene: '常委会定了分工，你分到一条跨七八个部门、历史问题最多的线。',
    options: [
      { text: '先逐个部门走访摸底，画一张问题地图', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两个月后你比很多部门一把手更清楚底数。' },
      { text: '先开一次分管部门会议', performance: 1, effect: { reputation: 1 }, result: '会开了，各部门各说各话。' },
      { text: '先抓最容易出成绩的一块', performance: -1, effect: { reputation: -2 }, result: '成绩有了，别的部门更不服。' },
    ],
  },
  {
    title: '首次议题',
    scene: '你第一次上常委会汇报议题，材料是部门准备的。',
    options: [
      { text: '自己把关键数据核一遍，能答的都答上来', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '会上被追问时都对答如流。' },
      { text: '照着材料念', performance: 1, effect: { reputation: 1 }, result: '念完了，被问住两次。' },
      { text: '让部门负责人陪着答', performance: -1, effect: { reputation: -2 }, result: '别人觉得你没吃透。' },
    ],
  },
  {
    title: '部门一把手',
    scene: '一个部门的一把手资历很老，对你的部署阳奉阴违。',
    options: [
      { text: '单独谈，把分歧摆开，能用则用，不能用则调整', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '谈开了，这位后来成了最得力的。' },
      { text: '绕开他，直接找副职', performance: 1, effect: { reputation: 1 }, result: '事办了，正职更不配合。' },
      { text: '当众批评', performance: -2, effect: { reputation: -3, network: -2 }, result: '结了梁子，往后事事卡你。' },
    ],
  },
  {
    title: '条线考核',
    scene: '你这条线在市里排名倒数，几个部门互相推。',
    options: [
      { text: '把指标拆到部门，签订责任书并按月调度', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '一年后名次进了中游。' },
      { text: '开会强调', performance: 1, effect: { reputation: 1 }, result: '强调了，排名还是那样。' },
      { text: '把责任推给一个部门', performance: -2, effect: { reputation: -3, network: -2 }, result: '那家部门从此撂挑子。' },
    ],
  },
  {
    title: '专项债项目',
    scene: '一批专项债项目要报，前期成熟度参差不齐。',
    options: [
      { text: '成熟度不够的坚决不报，报上去的全程盯', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '报上去的全都开工了，第二年额度更大。' },
      { text: '都报上去，先争额度', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '额度来了，一半开不了工。' },
      { text: '包装几个凑数', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '资金闲置被通报。' },
    ],
  },
  {
    title: '民生实事',
    scene: '要遴选年度民生实事，票选出来的几项都不好办。',
    options: [
      { text: '按票选结果定，把难处和时序一并公开', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '群众看到进度，难办也有人理解。' },
      { text: '挑容易办的办', performance: 1, effect: { reputation: 1 }, result: '办完了，票选的那几项没人提。' },
      { text: '改成自己想做的', performance: -2, effect: { reputation: -3 }, result: '群众发现票选的事没影。' },
    ],
  },
  {
    title: '安全生产条线',
    scene: '你分管的线上一年内出了两起事故，都是小事故。',
    options: [
      { text: '逐起复盘，把共性问题做成制度', performance: 3, effect: { reputation: 3, integrity: 1, seniority: 1 }, result: '往后两年这条线零事故。' },
      { text: '每次都严肃处理', performance: 1, effect: { reputation: 1 }, result: '处理了，事故还在出。' },
      { text: '要求下面别再报上来', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '第三起出了人命，瞒报一起查。' },
    ],
  },
  {
    title: '信访联席',
    scene: '一个跨部门的信访积案，牵扯三个单位、两届班子。',
    options: [
      { text: '牵头联席，把政策口径统一后一次性答复', performance: 3, effect: { reputation: 4, health: -2 }, result: '答复后签了息访协议。' },
      { text: '指定牵头部门', performance: 1, effect: { reputation: 1 }, result: '牵头单位推不动别的部门。' },
      { text: '批给信访局办', performance: -1, effect: { reputation: -2 }, result: '信访局没权推部门，案子压着。' },
    ],
  },
  {
    title: '舆情处置',
    scene: '一件事上了热搜，涉及你分管的两个部门。',
    options: [
      { text: '第一时间核清事实，统一发声并同步整改', performance: 3, effect: { reputation: 4, health: -2 }, result: '两天内平息，还被评为处置得当。' },
      { text: '让宣传部门统一口径', performance: 1, effect: { reputation: 1 }, result: '口径出了，事实还没查清。' },
      { text: '先删帖', performance: -3, effect: { reputation: -4, integrity: -3 }, result: '删了反而引来二次传播。' },
    ],
  },
  {
    title: '招商签约',
    scene: '一场签约活动马上要办，有几个项目其实还没谈实。',
    options: [
      { text: '只签落得了地的，没谈实的改成果对接', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '签的三个全部开工，第二年对方又来了。' },
      { text: '照原计划签', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '签了五个，落地一个。' },
      { text: '多签几个撑场面', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '签约额被上级拿出来比对，很难看。' },
    ],
  },
  {
    title: '园区升级',
    scene: '园区要提档升级，但土地、能耗、环保都有硬约束。',
    options: [
      { text: '先做存量盘活，把低效用地腾出来', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '腾出的地引来两家好企业。' },
      { text: '向上争取新增指标', performance: 1, effect: { reputation: 1 }, result: '指标批了一点，不够用。' },
      { text: '先把项目塞进去再补手续', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '手续补不上，企业被责令停产。' },
    ],
  },
  {
    title: '营商环境',
    scene: '测评结果出来了，你们排在后面，企业反映最集中的是办事慢。',
    options: [
      { text: '带队暗访，把每个卡点改掉并对社会公布', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '第二年测评前进了十几位。' },
      { text: '要求各部门自查自纠', performance: 1, effect: { reputation: 1 }, result: '自查报告都写"已整改"。' },
      { text: '把测评指标研究透了再应对', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '分数上去了，企业还是跑。' },
    ],
  },
  {
    title: '教育改革',
    scene: '要推一项教育改革，家长和老师都强烈反弹。',
    options: [
      { text: '开听证，把方案调整后再推，并设过渡期', performance: 3, effect: { reputation: 4, health: -2 }, result: '调整后的方案推行顺利。' },
      { text: '按原方案推', performance: 1, effect: { reputation: 1 }, result: '推了，投诉不断。' },
      { text: '暂缓，等别的地方先试', performance: -1, effect: { reputation: -2 }, result: '等了一年，机会没了。' },
    ],
  },
  {
    title: '医共体建设',
    scene: '要建紧密型医共体，几家医院各怀心思。',
    options: [
      { text: '先把利益分配和人事权谈清，再签协议', performance: 3, effect: { reputation: 3, network: 2, seniority: 2 }, result: '医共体真转起来了，基层就诊率上去了。' },
      { text: '先挂牌', performance: 1, effect: { reputation: 1 }, result: '牌挂了，各干各的。' },
      { text: '行政命令强行合并', performance: -2, effect: { reputation: -3, network: -2 }, result: '合了，骨干医生走了几个。' },
    ],
  },
  {
    title: '交通攻坚',
    scene: '一条断头路打通要拆几十户，资金也只够一半。',
    options: [
      { text: '分期实施，先打通关键一段并同步安置', performance: 3, effect: { reputation: 3, seniority: 1, health: -2 }, result: '第一段打通后，第二段的阻力小了很多。' },
      { text: '等资金齐了再动', performance: 1, effect: { reputation: 1 }, result: '等了两年，路还是断的。' },
      { text: '先拆，安置以后说', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '拆迁户堵路，项目停摆。' },
    ],
  },
  {
    title: '水利设施',
    scene: '几座小型水库年久失修，汛期前必须处理。',
    options: [
      { text: '逐库鉴定，能除险的除险，该降等的分流', performance: 3, effect: { reputation: 3, integrity: 1, health: -2 }, result: '那一年汛期平稳度过了。' },
      { text: '全部申报除险加固', performance: 1, effect: { reputation: 1 }, result: '批下来的只有一半。' },
      { text: '加固一下看得见的地方', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '汛期出险，责任追到你头上。' },
    ],
  },
  {
    title: '城市更新',
    scene: '一片老城区要改造，居民意见分成两派。',
    options: [
      { text: '逐栋征询，把方案做成可选项让居民选', performance: 3, effect: { reputation: 4, health: -2 }, result: '签约率超过了预期。' },
      { text: '统一按一个方案推', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '推了一半卡住了。' },
      { text: '先拆再说', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '强拆引发舆情，项目被叫停。' },
    ],
  },
  {
    title: '房地产风险',
    scene: '一个项目资金链断了，购房人开始聚集。',
    options: [
      { text: '成立专班，摸清资金缺口并引入纾困方案', performance: 3, effect: { reputation: 4, health: -2, seniority: 1 }, result: '项目复工，交付有了时间表。' },
      { text: '约谈开发商，要求限期解决', performance: 1, effect: { reputation: 1 }, result: '约谈了，开发商没钱。' },
      { text: '先稳住人，等上面政策', performance: -2, effect: { reputation: -3 }, result: '人越聚越多，事情往上捅。' },
    ],
  },
  {
    title: '保交楼',
    scene: '几个楼盘要保交付，监管账户里的钱不够。',
    options: [
      { text: '逐盘核定缺口，分类施策并公开进度', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '当年交付了两个盘，购房人情绪稳了。' },
      { text: '分批推进，先交最容易的', performance: 1, effect: { reputation: 1 }, result: '容易的交了，难的还在闹。' },
      { text: '挪用别处的资金先垫', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '挪用的钱被查出，问题更大。' },
    ],
  },
  {
    title: '农民工工资',
    scene: '年底了，几个项目的工资还没着落。',
    options: [
      { text: '提前排查，设专户和台账，出问题的当天介入', performance: 3, effect: { reputation: 4, health: -1 }, result: '那年没有发生群体性讨薪。' },
      { text: '等讨薪了再处理', performance: 1, effect: { reputation: 1 }, result: '处理了几起，很被动。' },
      { text: '让企业自己解决', performance: -2, effect: { reputation: -3 }, result: '人堵了政府大门。' },
    ],
  },
  {
    title: '社区治理',
    scene: '社区工作人员少、事项多，一年换了好几个人。',
    options: [
      { text: '厘清社区职责清单，把不该社区扛的收回去', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '减负后人留住了，服务也上来了。' },
      { text: '增加人手', performance: 1, effect: { reputation: 1 }, result: '加了两三个，还是不够。' },
      { text: '要求社区克服困难', performance: -2, effect: { reputation: -3 }, result: '又走了两个人。' },
    ],
  },
  {
    title: '双拥工作',
    scene: '要创建双拥模范城，标准细、时间紧。',
    options: [
      { text: '把任务分到部门并解决几个实际问题', performance: 3, effect: { reputation: 3, network: 2 }, result: '创建成功，也真解决了几件难事。' },
      { text: '按指标准备材料', performance: 1, effect: { reputation: 1 }, result: '材料齐了，测评一般。' },
      { text: '集中突击补材料', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '补的材料经不起实地看。' },
    ],
  },
  {
    title: '统计督查',
    scene: '统计督查组要来，有人提醒你几个指标要"注意"。',
    options: [
      { text: '如实准备，把口径和依据都摆出来', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '督查组没提出问题。' },
      { text: '让统计部门把关', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '把关了，有两个指标还是被问。' },
      { text: '安排口径', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '督查发现数据异常，立案调查。' },
    ],
  },
  {
    title: '审计整改',
    scene: '审计报告指出十几个问题，有几个是你任内定的。',
    options: [
      { text: '逐条建台账，能改的立即改，改不了的说明原因', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '整改销号率最高，被通报表扬。' },
      { text: '要求部门各自整改', performance: 1, effect: { reputation: 1 }, result: '报上来的整改多半是纸面的。' },
      { text: '能拖就拖', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '回头看时被点名。' },
    ],
  },
  {
    title: '巡视反馈',
    scene: '巡视反馈意见下来了，有几条直接点到你分管领域。',
    options: [
      { text: '认账领账，自己牵头最难的那条', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '最难那条啃下来了，评价很好。' },
      { text: '照单分解给部门', performance: 1, effect: { reputation: 1 }, result: '分解了，进度很慢。' },
      { text: '对点到的几条作解释', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被认为整改态度不端正。' },
    ],
  },
  {
    title: '整改台账',
    scene: '整改台账报上去了，实际上有三项只是纸面整改。',
    options: [
      { text: '把三项撤下来重做，如实报进度', performance: 3, effect: { reputation: 3, integrity: 3 }, result: '重做后通过了验收。' },
      { text: '维持现状', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '验收时被抽查出来。' },
      { text: '补几份佐证材料', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '佐证经不起实地核验。' },
    ],
  },
  {
    title: '干部考察',
    scene: '一批干部要考察，其中一个人争议很大。',
    options: [
      { text: '扩大谈话范围，把争议点查清写进材料', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '材料扎实，后来的使用也没出问题。' },
      { text: '按程序走一遍', performance: 1, effect: { reputation: 1 }, result: '走了，争议没写进去。' },
      { text: '按主要领导的倾向写', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '提上去的人出事，材料被翻出来。' },
    ],
  },
  {
    title: '人才引进',
    scene: '要引进一批紧缺人才，编制和待遇都有压力。',
    options: [
      { text: '先摸清到底缺什么，再定精准的引才清单', performance: 3, effect: { reputation: 3, network: 2, seniority: 2 }, result: '引来的人正好用得上，也留得住。' },
      { text: '按上级指标招', performance: 1, effect: { reputation: 1 }, result: '招来了，一半用不上。' },
      { text: '先给待遇把人招来', performance: -1, effect: { reputation: -2 }, result: '人来了没有舞台，两年走了大半。' },
    ],
  },
  {
    title: '编制管理',
    scene: '几个部门都要编，编制池早就没有余量。',
    options: [
      { text: '盘活存量，把闲置编制收回来统筹', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '收回一批，重点岗位都补上了。' },
      { text: '谁要得急给谁', performance: 1, effect: { reputation: 1 }, result: '给了，别的部门闹。' },
      { text: '先借用，编制以后说', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '借用越借越多，清理时很难办。' },
    ],
  },
  {
    title: '基层减负',
    scene: '乡镇反映报表多、会议多、督查多，减不下来。',
    options: [
      { text: '先砍自己分管线的报表和会议', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '带头砍了三成，别的线也跟着动。' },
      { text: '发文件要求减', performance: 1, effect: { reputation: 1 }, result: '文件发了，报表更多了一份。' },
      { text: '先统计一下有多少', performance: -1, effect: { reputation: -2 }, result: '统计本身又成了一项负担。' },
    ],
  },
  {
    title: '会议改革',
    scene: '一周要开七八个会，很多是陪会。',
    options: [
      { text: '合并同类项，能开短的绝不开长，陪会一律取消', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '会议少了四成，干部拍手。' },
      { text: '控制会议时长', performance: 1, effect: { reputation: 1 }, result: '短了，但会还是那么多。' },
      { text: '照旧', performance: -1, effect: { reputation: -2 }, result: '下面开始找人代会。' },
    ],
  },
  {
    title: '督查检查',
    scene: '上级一次督查要准备十几种材料，基层叫苦。',
    options: [
      { text: '向上反映重复督查问题，内部先合并成一次', performance: 3, effect: { reputation: 3, integrity: 1, seniority: 1 }, result: '上面采纳了建议，督查精简了。' },
      { text: '要求基层照常准备', performance: 1, effect: { reputation: 1 }, result: '准备了，怨气很大。' },
      { text: '派人下去代做准备', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '督查组问细节时答不上来。' },
    ],
  },
  {
    title: '文件把关',
    scene: '一份要下发的文件，里面有两条要求基层根本做不到。',
    options: [
      { text: '把这两条拿掉，加上配套保障措施', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '文件执行率明显提高。' },
      { text: '照发', performance: 1, effect: { reputation: 1 }, result: '发了，基层应付。' },
      { text: '加一句"确保"强化要求', performance: -1, effect: { reputation: -2 }, result: '确保之后还是做不到。' },
    ],
  },
  {
    title: '政策落地',
    scene: '一项好政策下来半年，符合条件的没几个享受到。',
    options: [
      { text: '查卡在哪一环，改成主动推送、免申即享', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '覆盖面一下子上去了。' },
      { text: '加大宣传', performance: 1, effect: { reputation: 1 }, result: '宣传了，来办的人还是不多。' },
      { text: '指标分解下去', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '为了完成指标开始凑数。' },
    ],
  },
  {
    title: '部门推诿',
    scene: '一件事两个部门都说是对方的，已经卡了一个月。',
    options: [
      { text: '查职责依据当场拍板，并把边界写进备忘录', performance: 3, effect: { reputation: 3, network: 1, seniority: 1 }, result: '事办了，往后同类事有章可循。' },
      { text: '各打五十大板', performance: 1, effect: { reputation: 1 }, result: '两边都不服。' },
      { text: '上报等主要领导定', performance: -1, effect: { reputation: -2 }, result: '被说成是协调能力不行。' },
    ],
  },
  {
    title: '突发事件现场',
    scene: '你分管的领域出了事，你在外地出差。',
    options: [
      { text: '立即往回赶，途中远程部署并指定现场负责人', performance: 3, effect: { reputation: 4, health: -2 }, result: '到现场时处置已经有序展开。' },
      { text: '远程指挥', performance: 1, effect: { reputation: 1 }, result: '指挥了，现场有点乱。' },
      { text: '按日程走完再回', performance: -3, effect: { reputation: -5, integrity: -2 }, result: '缺席被写进了通报。' },
    ],
  },
  {
    title: '防汛抗旱',
    scene: '一边是汛情，一边是几个乡镇喊旱，两头都要应付。',
    options: [
      { text: '分片调度，按实时情况动态调整', performance: 3, effect: { reputation: 3, health: -2, seniority: 1 }, result: '两头都没出大问题。' },
      { text: '按预案执行', performance: 1, effect: { reputation: 1 }, result: '预案跟不上变化。' },
      { text: '先保重点区域', performance: -1, effect: { reputation: -2 }, result: '非重点区域的意见很大。' },
    ],
  },
  {
    title: '森林防火',
    scene: '防火期刚到，就有人野外用火引发火情。',
    options: [
      { text: '一线蹲守，把责任落实到山头地块', performance: 3, effect: { reputation: 3, health: -2 }, result: '那一季火情明显下降。' },
      { text: '通报批评并追责', performance: 1, effect: { reputation: 1 }, result: '追责了，第二个火点又起。' },
      { text: '要求加强宣传', performance: -1, effect: { reputation: -2 }, result: '宣传做了，火照着。' },
    ],
  },
  {
    title: '食品药品',
    scene: '抽检发现一批不合格产品，涉及本地好几家商户。',
    options: [
      { text: '全部下架溯源，公开结果并做一次专项整治', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '整治后合格率明显上升。' },
      { text: '处罚涉事商户', performance: 1, effect: { reputation: 1 }, result: '罚了，源头还在。' },
      { text: '先不公开，避免影响', performance: -3, effect: { reputation: -5, integrity: -4 }, result: '消息走漏，信任危机。' },
    ],
  },
  {
    title: '特种设备',
    scene: '排查发现一批设备超期未检，集中在几家单位。',
    options: [
      { text: '立即停用整改，检验合格才能恢复', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '整改期间零事故。' },
      { text: '限期整改', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '限期内只改了一部分。' },
      { text: '先运行，边用边检', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '出了事故，责任在你。' },
    ],
  },
  {
    title: '校园餐',
    scene: '有家长反映学校餐食质量差，还发了照片。',
    options: [
      { text: '不打招呼去查，把供应链和账目一起查清', performance: 3, effect: { reputation: 4, integrity: 2 }, result: '查实后换了供应商，家长群安静了。' },
      { text: '要求学校整改', performance: 1, effect: { reputation: 1 }, result: '整改了表面，账目没动。' },
      { text: '说是个案', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '更多家长站出来说话。' },
    ],
  },
  {
    title: '养老体系',
    scene: '老龄化程度高，机构养老一床难求，居家养老没人管。',
    options: [
      { text: '以居家为主建三级网络，机构只兜底最需要的', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '覆盖率上去，成本也可控。' },
      { text: '多建机构', performance: 1, effect: { reputation: 1 }, result: '建了，床位空着一半。' },
      { text: '发补贴', performance: -1, effect: { reputation: -2 }, result: '补贴发了，服务还是没有。' },
    ],
  },
  {
    title: '儿童关爱',
    scene: '排查出一批留守儿童监护缺失，没人专门管。',
    options: [
      { text: '建台账并落实一对一帮扶，定期上门', performance: 3, effect: { reputation: 4, health: -1 }, result: '一年后再排查，情况明显改善。' },
      { text: '建台账', performance: 1, effect: { reputation: 1 }, result: '台账有了，没人跟进。' },
      { text: '交给村里', performance: -1, effect: { reputation: -2 }, result: '村里没人手，还是那样。' },
    ],
  },
  {
    title: '残疾人服务',
    scene: '残疾人证办了，但配套服务跟不上。',
    options: [
      { text: '把服务清单做出来，一项项落实到承办单位', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '清单落地，投诉少了很多。' },
      { text: '增加补贴', performance: 1, effect: { reputation: 1 }, result: '补贴加了，服务还是没有。' },
      { text: '先放一放', performance: -2, effect: { reputation: -3 }, result: '有人写信反映到上面。' },
    ],
  },
  {
    title: '文化阵地',
    scene: '建好的文化设施使用率很低，都锁着门。',
    options: [
      { text: '问清群众要什么，调整开放时间并配活动', performance: 3, effect: { reputation: 3, network: 1 }, result: '半年后这里成了最热闹的地方。' },
      { text: '要求提高使用率', performance: 1, effect: { reputation: 1 }, result: '数字上去了，人没多。' },
      { text: '再建新的', performance: -1, effect: { reputation: -2 }, result: '新的也锁着门。' },
    ],
  },
  {
    title: '体育设施',
    scene: '一批健身器材装了两年，坏的坏、丢的丢。',
    options: [
      { text: '定管护责任到村到人，建报修渠道', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '完好率上去了，投诉没了。' },
      { text: '统一更换一批', performance: 1, effect: { reputation: 1 }, result: '换了，两年后还是那样。' },
      { text: '不管', performance: -1, effect: { reputation: -2 }, result: '有人受伤后找上门。' },
    ],
  },
  {
    title: '文明创建',
    scene: '创建迎检在即，平时欠账多，突击又容易出事。',
    options: [
      { text: '把创建变成日常机制，先解决几个真问题', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '迎检过了，群众也看到了变化。' },
      { text: '突击整治', performance: 1, effect: { reputation: 1, health: -1 }, result: '过了，检查一走又回去。' },
      { text: '材料做漂亮', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '实地测评直接露馅。' },
    ],
  },
  {
    title: '网络问政',
    scene: '网络问政平台上积压了一批件，有几件点了你们单位。',
    options: [
      { text: '逐件回复并公开办理结果，把共性问题改掉', performance: 3, effect: { reputation: 4, health: -1 }, result: '回复率上去后，新件反而少了。' },
      { text: '要求各单位限期回复', performance: 1, effect: { reputation: 1 }, result: '回复了，很多是套话。' },
      { text: '挑着回', performance: -2, effect: { reputation: -3 }, result: '没回的被人截图传播。' },
    ],
  },
  {
    title: '项目评审',
    scene: '一次项目评审，专家意见分歧很大。',
    options: [
      { text: '让分歧充分表达，按规则和多数意见定并记入档案', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 1 }, result: '评审结果经得起复查。' },
      { text: '采纳资历最深那位', performance: 1, effect: { reputation: 1 }, result: '定了，其他专家有意见。' },
      { text: '按自己的倾向引导', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '后来项目出问题，评审记录被翻出。' },
    ],
  },
  {
    title: '年底述职',
    scene: '要述职了，成绩有几项，失误也有两项。',
    options: [
      { text: '成绩讲够，失误讲透，明年打算具体', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 1 }, result: '这份述职被评价为"实在"。' },
      { text: '只讲成绩', performance: 1, effect: { reputation: 1 }, result: '讲完了，没什么印象。' },
      { text: '把失误推给客观原因', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '大家都知道那两件事是怎么回事。' },
    ],
  },
];
