// 扩展随机事件库：每个事件只在一段人生故事里出现一次，由 core.js 的 burstHistory 去重。
// 这些是虚构的日常工作场景；财富效果统一使用 wealth，由 core.applyEffect 映射到现金账户。
//
// 为什么不再用"主题 × 变体"批量生成：生成出来的几十条事件共用同一组三选项，
// 玩家很快就会觉得"选来选去就那几样"。突发事件的价值恰恰在于"意料之外"，
// 所以这一批全部手写，并且刻意让选项结构彼此不同：
//   有的两条是两难、有的四条要排序、有的带概率分支（roll）、
//   有的平时攒的属性够高才有第三条路（upgraded）、有的会结网（bond）或割席（sever）。
//
// 受贿类事件的风险痕迹不手写死：core.resolveBurst 会按
// 「每 1 万元意外收入 ≈ +1 点往来痕迹（至少 1 点、封顶 10；结下关系网的再 +1）」
// 统一重算，保证"拿多少东西、冒多大风险"永远成正比，并在结果里当场写出这笔账。
// 手写的 risk 只在"没进账"的选项上生效（退还、主动说明、自掏腰包补上）。

// ── 手写突发事件（结构刻意彼此不同）─────────────────────────────────
const HAND_WRITTEN_BURST_EVENTS = [
  {
    tag: '围猎', minRank: 3, weight: 3,
    title: '加油卡里的余额',
    scene: '司机把一张加油卡放到你桌上，说是几个老板凑钱办的，里头余额不低。"公车私车都是一个加法，查不出来。"',
    options: [
      { text: '退回加油卡，并让车队核查同类卡', effect: { integrity: 4, reputation: 1, network: -1 }, risk: 0, result: '卡退了回去，车队顺手清了一遍，这种卡从此在车队里绝迹。' },
      { text: '只用公车该用的那一部分，余额退回', effect: { integrity: -1 }, risk: 1, result: '卡用了一半退了一半，账面上说得过去，你自己知道边界挪了多少。' },
      { text: '收下，家里人加油也方便', effect: { integrity: -6, wealth: 6000, network: 1 }, risk: 1, result: '加油卡进了钱包，每次掏出来，你都会想起那句"查不出来"。' },
    ],
  },
  {
    tag: '受贿', minRank: 4, weight: 3,
    title: '低于市价的二手房',
    scene: '一套二手房源以明显低于市价的价格"只卖给有缘人"。房主你认识——正是你分管领域里一家企业的负责人。',
    options: [
      {
        text: '婉拒，让中介按正常市场渠道挂牌',
        effect: { integrity: 3, reputation: 1 },
        risk: 0,
        result: '房子你另找了，多花了钱，也少了一个说不清的邻居。',
        upgraded: {
          require: { integrity: 80 },
          text: '当面讲清纪律要求，请对方收回这套房的人情',
          performance: 0,
          effect: { integrity: 5, reputation: 2, network: -2 },
          result: '你把话说得很透，对方愣了一下，此后对你规矩了很多。平时攒下的廉洁名声，让你连拒绝都可以拒绝得体面。',
        },
      },
      { text: '让亲属出面去看房', effect: { integrity: -4, network: 2 }, risk: 3, result: '房子最后没买，但"亲属去看过房"这件事本身已经传了出去。' },
      { text: '收下这份"优惠"', effect: { integrity: -9, wealth: 80000, network: 2 }, risk: 11, bond: { kind: 'fellow', weight: 2, reason: '那套只卖给有缘人的房子' }, result: '差价足够装一次修。你也清楚，从过户那天起，这套房子就一直停在别人的账本上。' },
    ],
  },
  {
    tag: '投资', minRank: 3, weight: 3,
    title: '老同学的原始股',
    scene: '老同学的公司"马上要上一轮融资"，给你留了一份原始股份额。"稳赚，就看你敢不敢要。"',
    options: [
      { text: '明确拒绝，不碰分管领域的任何股权', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '老同学骂你不识抬举，电话挂得很难看，但你晚上睡得很沉。' },
      {
        text: '让配偶出面代持，自己不露面',
        effect: { integrity: -6, wealth: 40000, network: 2 },
        risk: 5,
        result: '代持协议签得很隐蔽，但融资材料上的联系人是瞒不住的。',
        roll: {
          chance: 0.45,
          attr: 'integrity',
          perPoint: 0.004,
          success: { effect: { wealth: 40000 }, result: '这轮融资顺利完成，账面浮盈。你每次看到那笔钱，都会下意识地锁上抽屉。' },
          fail: { effect: { integrity: -3, reputation: -2 }, result: '监管问询函里点到了"亲属代持"四个字，你连夜把股份转了出去，割在了最低点。' },
        },
      },
      { text: '介绍给毫不相干的亲戚，自己分文不沾', effect: { integrity: -2, network: 1 }, risk: 1, result: '亲戚赚没赚不知道，但你至少可以如实说：自己没有一股。' },
    ],
  },
  {
    tag: '意外', minRank: 2, weight: 2,
    title: '凌晨两点的挡墙垮塌',
    scene: '电话把你叫醒：辖区一处挡墙被夜雨冲垮，压坏了下方停放的三辆车，所幸无人伤亡。已经有媒体在往现场赶。',
    options: [
      {
        text: '立即赶赴现场，先撤人设警戒，再处理车辆',
        effect: { reputation: 4, health: -2 },
        risk: 0,
        result: '你到的时候雨还没停，警戒线拉起来之后，第二波垮塌落在了空车里。',
        roll: {
          chance: 0.6,
          attr: 'reputation',
          perPoint: 0.005,
          success: { effect: { reputation: 3, network: 2 }, result: '现场处置的视频被居民自发传开，评论区第一次全是表扬。' },
          fail: { effect: { reputation: -1, health: -1 }, result: '忙到天亮，车主对定损流程仍有怨言，你在现场站了整整六个小时。' },
        },
      },
      { text: '电话调度应急条线处理，自己盯到天亮', effect: { seniority: 2, health: -1 }, risk: 0, result: '处置没有断档，只是第二天复盘会上，"主要领导未到现场"被记录在案。' },
      { text: '让值班人员先到场顶着', effect: { reputation: -3, network: -1 }, risk: 1, result: '值班员处理得不算差，但"凌晨找不到领导"这句话传得比垮塌本身还快。' },
      { text: '等天亮再说，夜间处置容易出乱子', effect: { reputation: -5, integrity: -2 }, risk: 2, result: '天亮时第二波垮塌来了，所幸夜里没人靠近。这个侥幸没有写进汇报，却写进了你的心里。' },
    ],
  },
  {
    tag: '结网', minRank: 5, weight: 2,
    title: '老领导的孩子想进来',
    scene: '退休的老领导托人带话：小儿子想到你单位的二级机构，"条件都够，就差个机会"。',
    options: [
      { text: '一律走公开招聘，一个字不多说', effect: { integrity: 4, reputation: 2, network: -2 }, risk: 0, result: '孩子没进面试。老领导从此不再给你打电话，但招聘公告谁都挑不出毛病。' },
      { text: '让他正常报名，你按规定回避', effect: { integrity: -2, network: 2 }, risk: 2, result: '你确实回避了，可谁都知道面试的人当年是谁提拔的。' },
      { text: '打招呼安排进二级机构', effect: { integrity: -8, network: 3, reputation: -2 }, risk: 6, bond: { kind: 'protege', weight: 2, reason: '老领导的儿子进了二级机构' }, result: '人进来了，能力也还行。只是从这天起，你在老领导面前再也说不了"不"。' },
    ],
  },
  {
    tag: '两难', minRank: 4, weight: 2,
    title: '检查组来的前一晚',
    scene: '明天上午检查组到。晚上十点，分管领导让你"把今天下午的会议纪要补一下"——那场会实际上没有开成。',
    options: [
      { text: '不补，如实向检查组说明会议未召开', effect: { integrity: 5, reputation: -2, network: -2 }, risk: 0, result: '检查组把"会议未实际召开"写进了反馈，也把"如实说明"写进了评价。领导的脸很难看。' },
      { text: '补纪要，注明系事后补记并请参会人确认', effect: { integrity: 1, seniority: 1 }, risk: 1, result: '纪要里多了一行小字。程序上能对过去，但那场会终究是没有开。' },
      { text: '补一份"开过"的纪要，把人叫回来补签', effect: { integrity: -5, network: 2 }, risk: 3, result: '十个人在同一个晚上补签了同一份纪要，每个人的签名时间都那么整齐。' },
    ],
  },
  {
    tag: '受贿', minRank: 4, weight: 3,
    title: '住院时的信封',
    scene: '家人住院，一位管理服务对象赶到医院探望，留下一个厚信封，说"给病人买点营养品"，放下就走。',
    options: [
      { text: '追出去当场退还', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '你在电梯口追上了他。他红着脸收回去，此后再没来探过病。' },
      { text: '交护士站代管并做记录', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '信封在护士站放了一周，最后由单位按程序退回。病友们都夸你规矩。' },
      { text: '收下，住院正是用钱的时候', effect: { integrity: -6, wealth: 45000, network: 1 }, risk: 3, result: '营养品买了很多，账单也付得起。出院那天，你把那个信封的来路想了很久。' },
    ],
  },
  {
    tag: '家庭', minRank: 3, weight: 2,
    title: '配偶想去你分管的领域上班',
    scene: '配偶提出辞掉现在的工作，去你分管领域的一家民企做管理岗，收入翻倍，"专业完全对口"。',
    options: [
      { text: '明确反对，要求避开你的分管领域', effect: { integrity: 3, affection: -2 }, risk: 0, result: '家里冷战了一周，最后配偶去了别的行业。收入没翻倍，饭桌上的话却多了。' },
      { text: '建议去外地或无关行业，帮着一起改简历', effect: { integrity: 1, affection: 1, reputation: 1 }, risk: 0, result: '简历改到深夜，新工作离钱远了一点，离你近了一点。' },
      { text: '不干涉，让她自己决定', effect: { integrity: -5, affection: 2, network: 1 }, risk: 3, result: '入职那天起，你的每一次签字都自动带上了她的名字。' },
    ],
  },
  {
    tag: '围猎', minRank: 6, weight: 3,
    title: '会所里的"同学会"',
    scene: '一场以"母校情谊"为名的聚会。到了才发现，同桌大半是你分管领域的企业负责人，买单的人没有人认识。',
    options: [
      { text: '当场离席，事后向办公室报备', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '你起身时全桌安静了几秒。第二天报备记录写得清清楚楚，那场饭后来被查过，你是桌上唯一干净的。' },
      { text: '坐一会儿，坚持把单抢过来自己付', effect: { integrity: -1, network: 1 }, risk: 1, result: '单是你买的，但照片是别人拍的。饭桌上谁跟谁是什么关系，几周后你想不全了。' },
      { text: '尽兴而归', effect: { integrity: -7, network: 3, reputation: -2 }, risk: 5, bond: { kind: 'fellow', weight: 2, reason: '那场说不清谁买单的聚会' }, result: '那晚加了五个微信。后来每一个都在不同的时候，让你"方便的时候关照一下"。' },
    ],
  },
  {
    tag: '结网', minRank: 7, weight: 1,
    title: '风口上的老同事',
    scene: '一位老同事上周被有关部门带走。被带走前，他曾托你"照看他名下的一家公司"；今天，他的家属又找到了你。',
    options: [
      { text: '向组织如实报告这两次接触，并配合说明', effect: { integrity: 5, reputation: 2, network: -3 }, risk: -1, sever: { count: 1, kind: 'fellow' }, result: '你把两次接触的时间地点原原本本讲清楚，主动切断了和他关联的所有往来。材料交上去那天，你睡了这个月第一个整觉。' },
      { text: '只说工作往来，不提那次托付', effect: { integrity: -4, network: 1 }, risk: 4, result: '问询结束了。但"没提托付"这件事，从此成了你和档案之间的一根刺。' },
      { text: '帮家属打招呼，让公司"平稳过渡"', effect: { integrity: -8, network: 3 }, risk: 7, bond: { kind: 'fellow', weight: 2, reason: '替被带走的人照看公司' }, result: '公司真的平稳了。你也成了那份案卷里下一个被约谈的名字。' },
      { text: '不接触也不报告，就当不知道', effect: { integrity: -2, reputation: -1 }, risk: 2, result: '家属又来过两次，你都没见。沉默不是证据，但你比谁都清楚它是什么。' },
    ],
  },
  {
    tag: '两难', minRank: 9, weight: 3,
    title: '名单上那个有反映的人',
    scene: '讨论干部任免时，你手里那份名单上有一个名字被反复提起：能干事，也确实有人反映。主要领导问你："这个人，你怎么看？"',
    options: [
      { text: '如实说明反映内容，建议暂缓', effect: { integrity: 5, reputation: 2, network: -2 }, risk: 0, result: '你把反映的内容和核查进度都摆了出来。名单暂时压住了，会上没人反对，也没人附和。' },
      { text: '只谈实绩，不提反映', effect: { integrity: -2, network: 2 }, risk: 2, result: '你讲了半小时他的项目。表决通过了，会后有个人拍了拍你的肩膀，你没看清是谁。' },
      { text: '明确表态可以用，出了问题我负责', effect: { integrity: -6, network: 3, reputation: -1 }, risk: 5, bond: { kind: 'protege', weight: 3, reason: '你在任免会上替他担了保' }, result: '他上了。你那句"我负责"被会议记录原原本本地记了下来，往后每一次出事，都会有人翻到这一页。' },
      { text: '建议先核查清楚，再上会讨论', effect: { integrity: 3, seniority: 1 }, risk: 0, result: '事情往后推了一个月。核查结论出来时，问题已经不是问题了。' },
    ],
  },
  {
    tag: '围猎', minRank: 10, weight: 3,
    title: '孩子留学那笔钱的来路',
    scene: '孩子拿到了境外学校的录取通知，学费不是小数目。一位"老朋友"主动提出帮忙："钱我先垫上，等你方便再说。"',
    options: [
      { text: '婉拒，按家庭实际能力选学校', effect: { integrity: 5, reputation: 2, affection: -2 }, risk: 0, result: '孩子去了另一所学校，学费低了一半。开学那天他发的朋友圈，你看了很多遍。' },
      {
        text: '接受垫付，日后再还',
        effect: { integrity: -8, wealth: 400000, network: 3 },
        risk: 6,
        bond: { kind: 'fellow', weight: 3, reason: '替你垫付的那笔学费' },
        result: '钱到账了，孩子出了国。你算过一遍，按你的工资，这笔钱要还到退休以后——对方却从没提过还的事。',
        roll: {
          chance: 0.4,
          attr: 'integrity',
          perPoint: 0.004,
          success: { effect: { integrity: 2 }, result: '你在第二年硬是把这笔钱凑齐还了回去，对方收下时脸色很难看，从此不再来往。' },
          fail: { effect: { integrity: -4 }, result: '"方便再说"这四个字，后来被翻译成了一件又一件具体的事。' },
        },
      },
      { text: '向组织报告这一情况', effect: { integrity: 4, reputation: 1, network: -3 }, risk: -1, sever: { count: 1, kind: 'fellow' }, result: '你把这通电话的时间、内容和对方姓名都写了下来交上去。此后这类电话再没打来过第二个。' },
    ],
  },
  {
    tag: '结网', minRank: 8, weight: 3,
    title: '那个几十亿的项目要不要上',
    scene: '一个体量极大的项目等你拍方向。论证材料很漂亮，反对意见只有一句：这地方十年内可能用不了这么大的量。',
    options: [
      {
        text: '先做独立评估，再决定要不要上',
        effect: { integrity: 3, reputation: 1 },
        risk: 0,
        result: '评估跑了半年，规模压掉了三分之一。批下来的那天，没有人再提那句反对意见。',
        upgraded: {
          require: { seniority: 60 },
          text: '顶住压力，按压缩后的方案上报',
          effect: { integrity: 5, reputation: 3, seniority: 2 },
          result: '你在会上把十年用不了这么大量的那句话原样说了出来。会后有老同事说你"不像从前了"，你说是，从前没坐在这个位置上。',
        },
      },
      { text: '按原方案上报，先把项目拿下来', effect: { reputation: 2, seniority: 2, network: 2 }, risk: 2, result: '项目批了下来，开工那天场面很大。三年后产能利用率的数字，你每次开会都尽量不去看。' },
      { text: '顺着上面的意思办，不提反对意见', effect: { integrity: -4, network: 3, seniority: 1 }, risk: 3, result: '你什么都没说，也就等于说了。这个项目的每一道审批上都有你的名字。' },
    ],
  },
  {
    tag: '受贿', minRank: 6, weight: 3,
    title: '招标文件里那串技术参数',
    scene: '一份招标文件送到你桌上，技术参数细得反常，几乎只对应一家企业。起草人是你的老部下，他说这是"沿用上一版的模板"。',
    options: [
      { text: '退回重写，参数改成通用指标', effect: { integrity: 4, reputation: 2, network: -1 }, risk: 0, result: '文件退回去了，来了四家投标。中标价比上一次低了两成。' },
      { text: '只要求在公告里补充说明条款', effect: { integrity: -1, seniority: 1 }, risk: 1, result: '补充条款写得很漂亮，但懂行的人一眼就看得出参数是谁写的。' },
      { text: '照签，不追问参数的来源', effect: { integrity: -7, wealth: 60000, network: 2 }, risk: 7, bond: { kind: 'fellow', weight: 2, reason: '那串只对应一家的参数' }, result: '你签了字。开标结果和一个月前有人跟你提过的一模一样。' },
      { text: '把这件事交给纪检和审计去核', effect: { integrity: 3, reputation: 1, network: -2 }, risk: 0, result: '核查期间招标暂停了三周。老部下从此见你就绕着走。' },
    ],
  },
  {
    tag: '意外', minRank: 5, weight: 2,
    title: '你拍板的那条路出了事故',
    scene: '你力排众议推的那条路，通车不到半年，一段路基沉降，一辆车侧翻，两人受伤。记者已经在现场。',
    options: [
      {
        text: '先救人、先封路，当晚就把初步原因公开',
        effect: { reputation: 2, integrity: 2, health: -2 },
        risk: 0,
        result: '你在现场待到天亮。通报里写清了"设计时对地质情况估计不足"，也写了责任单位。',
        roll: {
          chance: 0.55,
          attr: 'reputation',
          perPoint: 0.005,
          success: { effect: { reputation: 3, seniority: 1 }, result: '事故处置和原因公开都算及时，事故调查组的结论里没有出现你的名字。' },
          fail: { effect: { reputation: -2 }, result: '通报发了，但"抢工期"的说法已经在网上传开，你被叫去说明了两次。' },
        },
      },
      { text: '先内部查清责任，再统一口径', effect: { reputation: -2, seniority: 1 }, risk: 1, result: '口径统一了，通报晚了三天。三天里的猜测，比事故本身更难收拾。' },
      { text: '把责任压给施工单位，自己不出面', effect: { integrity: -5, reputation: -3, network: 1 }, risk: 3, result: '施工单位承担了全部责任。那个项目经理后来托人带话，说他还留着当年催进度的所有会议纪要。' },
    ],
  },
  {
    tag: '举报', minRank: 3, weight: 2,
    title: '有人在外面用你的名字办事',
    scene: '一个陌生号码打来："我们是某某公司的，和您单位王主任合作很久了。"你单位根本没有姓王的主任，但对方一口一个"您那边"。',
    options: [
      { text: '当场说明身份并报警备案', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '备案回执你留了一份。后来那家公司真的出过事，你这份回执救了你一次。' },
      { text: '通过单位正式发函要求对方澄清', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '函发出去了，对方回了一封措辞谨慎的说明，从此再没打来过。' },
      { text: '不理会，反正不是自己', effect: { integrity: -3, reputation: -2 }, risk: 2, result: '你挂了电话。半年后有人拿着那段通话记录来问你："这个王主任，是不是就是你？"' },
    ],
  },
  {
    tag: '家庭', minRank: 2, weight: 2,
    title: '驻村最后一年的考核表',
    scene: '驻村满两年，考核表上要填"办成了哪几件事"。你手上的台账很薄，但村口那条路确实修起来了，只是还没验收。',
    options: [
      { text: '如实填写，附上未完工的说明', effect: { integrity: 3, reputation: 1, seniority: -1 }, risk: 0, result: '考核结果是"称职"，不是"优秀"。回城那天，村支书一直把你送到路口。' },
      { text: '把别的村的项目算进自己的台账', effect: { integrity: -4, reputation: 2, seniority: 2 }, risk: 2, result: '表交上去评了优秀。后来有人去那条路上看过一次，问的不是路修得好不好，是台账上写的是谁修的。' },
      { text: '请村里出一份证明，把在建工程写清楚', effect: { integrity: 2, reputation: 1 }, risk: 0, result: '证明材料附在表后，验收通过那年你已经调走了，村里还是把消息发给了你。' },
    ],
  },
  {
    tag: '意外', minRank: 4, weight: 2,
    title: '体检报告上的那个阴影',
    scene: '体检报告上有一个小结节，医生建议三个月后复查。同一周，你手上有两个项目要在三个月内落地。',
    options: [
      { text: '按医生说的去复查，工作重新排', effect: { health: 5, reputation: -1, seniority: -1 }, risk: 0, result: '复查结果是良性。你把两个项目中的一个交了出去，进度慢了，人还在。' },
      { text: '先忙完这三个月', effect: { health: -6, seniority: 2, reputation: 1 }, risk: 0, result: '项目按时落地了。三个月后你去医院，医生说："怎么现在才来。"' },
    ],
  },
  {
    tag: '两难', minRank: 11, weight: 3,
    title: '巡视组请你去谈一次话',
    scene: '巡视组进驻的第三周，通知你"去谈一谈"。提纲里一半是你分管过的项目，另一半是几个你很久没有联系的名字。',
    options: [
      { text: '如实说明，能提供的材料当场交出去', effect: { integrity: 5, reputation: 2, network: -3 }, risk: -1, sever: { count: 1, kind: 'fellow' }, result: '谈了整整一下午。你走的时候，桌面上的材料比来时厚了一倍。此后你被叫去谈过两次，谈的都是同一批事，答案没有变过。' },
      { text: '只谈项目本身，回避与那几个人的往来', effect: { integrity: -5, network: 1 }, risk: 4, result: '你把每个项目的来龙去脉讲得很细。问到那几个人时，你说"工作上有过接触"。这句话被原样记了下来。' },
      { text: '请组织给时间准备，约定下周再谈', effect: { seniority: 1, reputation: -1 }, risk: 1, result: '一周里你把十年间的批示翻了一遍。再谈时你说得清楚，只是这份清楚来得太晚了些。' },
      { text: '托人递话，请上面把范围收一收', effect: { integrity: -8, network: 2 }, risk: 6, result: '递话的人回了一句"知道了"。谈话范围确实小了一点，但"有人递过话"这件事，比原来的问题更难解释。' },
    ],
  },
  {
    tag: '受贿', minRank: 8, weight: 4, largeBribe: true,
    title: '工程顾问费的银行卡',
    scene: '一个重大工程通过评审后，项目方送来一张所谓“顾问费”银行卡，暗示这只是对你长期协调工作的感谢。',
    options: [
      { text: '当场拒绝并将接触情况书面报备', effect: { integrity: 5, reputation: 2, network: -2 }, risk: -1, result: '银行卡没有离开会议室，书面报备当天入档。项目方此后不再试探你的边界。' },
      { text: '让办公室暂时代收，等项目结束再处理', effect: { integrity: -4, network: 2 }, risk: 4, result: '卡没有进你的口袋，却在办公室保险柜里停了很久。谁都说不清这算拒绝还是等待。' },
      { text: '收下所谓顾问费', effect: { integrity: -16, wealth: 800000, network: 3 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '工程通过后的顾问费银行卡' }, result: '钱到账后，对方没有再提感谢，只把下一项工程的材料送到了你桌上。' },
    ],
  },
  {
    tag: '受贿', minRank: 9, weight: 4, largeBribe: true,
    title: '境外考察后的收益凭证',
    scene: '一次境外考察结束后，中间人拿出一份收益凭证，称这是合作方预留的“长期回报”，不需要你投入本金。',
    options: [
      { text: '拒收并要求全团补交利益冲突说明', effect: { integrity: 5, reputation: 2, network: -2 }, risk: -1, result: '凭证被退回，所有人补签了说明。有人埋怨你把事情闹大，也没人再敢把这类东西递过来。' },
      { text: '只退回自己的那份，不追问其他人', effect: { integrity: 1, reputation: -1 }, risk: 1, result: '你自己的账面干净了，但这次考察留下的问题没有真正查清。' },
      { text: '接受这份长期回报', effect: { integrity: -18, wealth: 1500000, network: 3 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '境外考察后的收益凭证' }, result: '收益很快兑现。合作方再来时，谈的已经不是感谢，而是需要你拍板的具体事项。' },
    ],
  },
  {
    tag: '受贿', minRank: 10, weight: 4, largeBribe: true,
    title: '旧城改造的感谢份额',
    scene: '旧城改造方案落定后，一名关联方表示给你留了一份无需出资的项目收益份额，说所有手续都由他们处理。',
    options: [
      { text: '明确拒绝，并提请重新核查关联方资格', effect: { integrity: 6, reputation: 3, network: -3 }, risk: -1, result: '核查让项目晚了一个月，也排除了一家关系说不清的公司。你的名字没有出现在任何收益文件上。' },
      { text: '不签字，但默许家人继续接触', effect: { integrity: -8, network: 2 }, risk: 6, result: '你没有签字，家人的接触记录却一条不少。项目每推进一步，这些记录就更重一点。' },
      { text: '接受无需出资的收益份额', effect: { integrity: -22, wealth: 3000000, network: 4 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '旧城改造里的感谢份额' }, result: '第一笔收益到账时，你已经无法再声称自己只是正常推动项目。' },
    ],
  },
  {
    tag: '受贿', minRank: 11, weight: 5, largeBribe: true,
    title: '重大项目落定后的代持协议',
    scene: '重大项目最终落定，一位多年往来的负责人送来一份代持协议，称这是最后一次感谢，此后彼此两清。',
    options: [
      { text: '拒绝签署，主动提交协议并申请回避后续事项', effect: { integrity: 6, reputation: 3, network: -4 }, risk: -2, result: '协议成为调查项目方的线索。你退出了后续决策，却保住了此前所有决定的清白。' },
      { text: '烧掉协议，当作从未见过', effect: { integrity: -10, reputation: -2 }, risk: 7, result: '纸烧掉了，对方手里的副本还在。你没有拿钱，却把主动权留给了别人。' },
      { text: '签下代持协议', effect: { integrity: -28, wealth: 5000000, network: 4 }, risk: 10, bond: { kind: 'fellow', weight: 3, reason: '重大项目落定后的代持协议' }, result: '协议签完，对方只说了一句“以后就是自己人”。所谓两清，从这一刻变成了彻底绑在一起。' },
    ],
  },
];

// 不再使用"主题 × 变体"批量生成——那批事件共用同一组三选项，
// 玩家很快就会觉得"选来选去就那几样"。这一批全部手写。
const RICH_BURST_EVENTS = HAND_WRITTEN_BURST_EVENTS;

module.exports = { RICH_BURST_EVENTS };
