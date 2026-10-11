// 突发事件库（弹窗式，不占用季度主事项）。
//
// 与 events-extra.js 的区别：
//   events-extra.js  → 日常事项，作为季度的"主事件"被抽到
//   events-burst.js  → 突发事件，在结算完一个季度后按概率"突然弹出"，必须当场表态
//
// 字段说明（在通用字段 text / performance / effect / result 之上）：
//   minRank  仅当 state.rankIndex >= minRank 时才会出现（权力越大，被围猎的概率越高）
//   weight   抽选权重，默认 1；受贿与投资类给较高权重，保证这类事最常见
//   risk     该选项累加的"风险痕迹"（0~12，不在主界面显示具体数值）；允许为负，用于主动说明后降痕
//   roll     概率分支：chance + attr × perPoint，随机走 success / fail
//   bond     结成关系网：{ kind:'fellow'|'protege', weight:1~3, reason:'往来的由头' }
//            fellow = 同船的领导（他出事会牵出你），protege = 经你帮扶的同僚
//   sever    割席：{ count:1, kind:'fellow'|'protege' }，主动与在台上风险最大的那个人切割
//
// 关系网的逻辑：结成的人越多、权重越高，落马风险越大；已落马的人贡献最高（见 game/network.js）。
// 所以"收下好处"这类选项除了当场扣廉政、累加风险痕迹，还会额外结成一个同船的人。
//
// 写作约束（与全项目一致）：
//   1. 不出现真实人名、机构、案件；
//   2. 不写行贿的具体金额、渠道、话术与操作步骤，只写"东西递过来了"和"代价落在了哪"；
//   3. 收下好处的选项一律当场给钱、事后扣廉政并累加风险痕迹，绝不做"违规还赢"。
// 风险痕迹的逻辑：累到 6 以上，后面某年会强制触发"专项倒查"（见 core.js 的 startQuarter）。

const BURST_EVENTS = [
  // ── 基层阶段（minRank 2）────────────────────────────────────────────
  // 刚入职手上没有审批权，但"被请托、被请吃饭、被议论"照样躲不开。
  // 这一组的存在是为了让职级 2 的玩家别反复只看到体检报告和老同事病倒。
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '饭桌上被留下陪一场',
    scene: '本来只是去送材料，科长让你留下来一起吃饭。散场时那位老板走在你旁边，把一个信封往你手里塞，说"小伙子辛苦，拿去买条烟"。',
    options: [
      { text: '当场推回去，只当没这回事', effect: { integrity: 3, reputation: 1, network: -1 }, risk: 0, result: '信封被你按了回去，老板笑了笑没再坚持，这顿饭之后他没再单独找过你。' },
      { text: '先收下，回头交给科长处置', effect: { integrity: 1, seniority: 1 }, risk: 0, result: '东西交上去了，科长看了你一眼，什么也没说。' },
      { text: '收下，觉得就是个意思', effect: { integrity: -5, wealth: 2000, network: 1 }, risk: 2, result: '钱不多，但从此那家公司的名字一出现，你都会多看一眼。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 2,
    weight: 2,
    title: '老乡带着东西上门',
    scene: '同乡带着两箱土产找上门，说镇里有个项目马上要发公告，希望你能"帮着问一句"，还说你家里人他都熟。',
    options: [
      { text: '说明流程，让他按公告自己去报名', effect: { integrity: 3, network: -1 }, risk: 0, result: '老乡脸色不太好看，但公告发出后他确实报了名，后来也没再提这事。' },
      { text: '土产收下，事情不表态', effect: { integrity: -2, wealth: 1000, network: 1 }, risk: 2, result: '东西收进了厨房，你心里清楚这不算"没事"。' },
      { text: '答应帮着问一句', effect: { integrity: -5, network: 2 }, risk: 3, result: '你去问了一句，这句话后来被人记了起来。' },
    ],
  },
  {
    tag: '举报',
    minRank: 2,
    weight: 2,
    title: '办公室里的议论',
    scene: '有人在你背后说，你经手的一笔报销占了公家的便宜，说得有鼻子有眼。你知道那不是事实，但话已经传开了。',
    options: [
      { text: '主动找科长说明，把票据摊开', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '票据一张张对完，科长当场把话说清楚了，议论很快就散了。' },
      { text: '不理会，觉得清者自清', effect: { reputation: -1, health: -1 }, risk: 0, result: '你没有解释，话在办公室里多飘了一个月，你听着，只是不接。' },
      { text: '找人去"压一压"这个说法', effect: { integrity: -3, network: 1, reputation: -1 }, risk: 2, result: '议论压下去了，但"他找人打过招呼"又成了新的议论。' },
    ],
  },

  // ── 受贿类：东西递到手上 ───────────────────────────────────────────
  {
    tag: '受贿',
    minRank: 3,
    weight: 3,
    title: '办公室里多了个档案袋',
    scene: '你回到办公室，桌上多了一个没有署名的牛皮纸档案袋。问了一圈，都说没留意是谁放下的。袋子没封口，里面露出一沓现金。',
    options: [
      { text: '原封不动交给办公室登记，并说明情况', effect: { integrity: 5, reputation: 2, network: -1 }, risk: 0, result: '袋子当场登记入库，谁送来的一时查不出，但你的处置留了记录。' },
      { text: '先收着，等弄明白是谁送的再处理', effect: { integrity: -3, wealth: 50000 }, risk: 2, result: '钱进了抽屉，也进了你每天要惦记的一件事。' },
      { text: '收下，觉得是有人"看得起自己"', effect: { integrity: -8, wealth: 50000, network: 1 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '那个没有署名的档案袋' }, result: '钱留下了，从这一刻起，你在某些人眼里就多了一个可以说得上的把柄。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 3,
    title: '装修款已经有人结过了',
    scene: '家里刚装完房子，你去结账，老板笑着说"已经有人替您付过了"，还说这点小事不用放在心上。',
    options: [
      { text: '坚持自己把钱补上，并留好转账记录', effect: { integrity: 4, reputation: 1, wealth: -45000 }, risk: 0, result: '钱你自己付了，虽然多花了一笔，但这笔账从今往后说得清。' },
      { text: '默认接受，觉得是朋友之间的心意', effect: { integrity: -6, wealth: 45000, network: 2 }, risk: 3, result: '房子住得舒坦，但那句"不用放在心上"你一直记着。' },
      { text: '问清楚是谁付的，再做决定', effect: { integrity: 1, network: -1 }, risk: 1, result: '问明白了，答案让你有些为难，你决定先不动这笔钱。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 3,
    weight: 3,
    title: '节前的一箱"特产"',
    scene: '节前，一家有业务往来的公司送来一箱当地特产，箱子底下压着一张购物卡，包装上没有任何字样。',
    options: [
      { text: '整箱原样退回，并说明纪律要求', effect: { integrity: 4, reputation: 2, network: -1 }, risk: 0, result: '东西退回去了，对方脸上不好看，但从此没人再往你这送东西。' },
      { text: '特产留下，把卡退回去', effect: { integrity: 1, reputation: 1 }, risk: 0, result: '卡退了，特产留下了，边界感在这一次算是守住了。' },
      { text: '整箱收下，觉得节日往来很正常', effect: { integrity: -6, wealth: 8000, network: 2 }, risk: 2, result: '东西收了，卡也用了，这份"正常往来"以后每年都会准时出现。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 2,
    title: '给孩子办的卡',
    scene: '一家合作企业的负责人听说你孩子要买辅导资料，顺手递来一张书店卡，说"给孩子买书用，不值钱"。',
    options: [
      { text: '当场谢绝，说明不接受任何形式的卡券', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '对方把卡收了回去，孩子的事你自己买了单。' },
      { text: '收下但如实登记上交', effect: { integrity: 2 }, risk: 0, result: '卡登记上交了，事情走在了明处。' },
      { text: '收下，觉得是给孩子的心意', effect: { integrity: -5, wealth: 5000, network: 1 }, risk: 2, result: '孩子用上了新资料，而你从此很难再对这家企业说得上"公事公办"。' },
    ],
  },

  // ── 投资类：机会送到面前 ───────────────────────────────────────────
  {
    tag: '投资',
    minRank: 4,
    weight: 3,
    title: '一句"内部消息"',
    scene: '饭桌上有人压低声音说，某片区规划很快要调整，现在入手还来得及，"这种机会不会等人"。',
    options: [
      { text: '不参与，并提醒对方泄露规划信息风险很大', effect: { integrity: 4, reputation: 2, network: -1 }, risk: 0, result: '你没有接这个话，也在心里给这个人画了个标记。' },
      {
        text: '用小额资金试一下水',
        effect: { integrity: -3 },
        risk: 2,
        result: '你投了一笔不大的钱，剩下的交给消息本身。',
        roll: {
          chance: 0.45,
          attr: 'network',
          perPoint: 0.004,
          success: { effect: { integrity: -4, wealth: 60000 }, risk: 3, bond: { kind: 'fellow', weight: 1, reason: '那顿饭上一起听消息的人' }, result: '消息坐实，账面浮盈不小，你心里却并不轻松。' },
          fail: { effect: { integrity: -4, wealth: -20000 }, risk: 2, result: '规划调整搁置，钱套在里面，你开始回避当时一起吃饭的人。' },
        },
      },
      { text: '加大投入，趁机会做一笔大的', effect: { integrity: -8, wealth: 120000 }, risk: 5, bond: { kind: 'fellow', weight: 2, reason: '那顿饭上一起听消息的人' }, result: '这一笔赚得不少，但你从此在这个圈子里有了具体的名字。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 3,
    title: '老同学拉你入股',
    scene: '多年不见的老同学找上门，说公司正缺一笔资金周转，请你入股，"只出钱，不用出面，分红按季打给你"。',
    options: [
      { text: '明确拒绝，说明自己不适合参与这类经营', effect: { integrity: 4, reputation: 1, network: -2 }, risk: 0, result: '同学失望而归，但你的名下始终没有出现这家公司。' },
      { text: '让家人以自有资金少量参与', effect: { integrity: -5, wealth: 40000, network: 1 }, risk: 3, result: '股本挂在家人名下，分红也照常到账，关联关系却已经形成。' },
      { text: '自己出资入股并参与分红', effect: { integrity: -8, wealth: 90000, network: 3 }, risk: 5, result: '钱赚到了，可公司拿地、拿项目的时候，你都得想办法避开。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 2,
    title: '"上市就翻倍"的份额',
    scene: '有人拿着一份股权认购协议找你，说这是内部份额，企业很快要上市，翻倍不止，"过了这几天就没了"。',
    options: [
      { text: '不碰，这类口头承诺无法核实', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '份额被别人抢走了，你没有搭进去任何东西。' },
      {
        text: '拿一小笔钱试试',
        effect: { integrity: -2 },
        risk: 2,
        result: '你把钱打了过去，之后只能等消息。',
        roll: {
          chance: 0.4,
          attr: 'seniority',
          perPoint: 0.004,
          success: { effect: { integrity: -3, wealth: 50000 }, risk: 3, result: '那家企业确实有了动静，你的份额翻了倍，也把关系绑得更紧。' },
          fail: { effect: { integrity: -3, wealth: -30000 }, risk: 2, result: '企业上市的计划再无下文，认购协议成了一张废纸。' },
        },
      },
      { text: '多认购一些，机会难得', effect: { integrity: -8, wealth: -100000 }, risk: 5, result: '你把大部分积蓄押了上去，从此每天都要打听那家企业的消息。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 3,
    title: '明显低于市场价的"内部房"',
    scene: '一家开发商找你，说留了几套"内部房源"，价格明显低于周边成交价，只要签个字，不用排队不用摇号。',
    options: [
      { text: '按正常程序公开购买，不拿内部价', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '你按市价买下了一套，虽然多花了钱，但没有欠下任何人情。' },
      { text: '以内部价买下一套自住', effect: { integrity: -6, wealth: 50000, network: 1 }, risk: 3, result: '房子拿到了，差价摆在那里，你很难再对这家开发商的口碑保持中立。' },
      { text: '问清楚差价的来源再决定', effect: { integrity: 1, network: -1 }, risk: 1, result: '对方支支吾吾，你把资料留了下来，先没有签字。' },
    ],
  },
  {
    tag: '投资',
    minRank: 3,
    weight: 3,
    title: '年化很高的"稳赚理财"',
    scene: '有人给你推荐一个理财项目，说背后是熟人操盘，年化收益远超市场水平，"随时可以取"。',
    options: [
      { text: '不参与，收益越高风险越说不清', effect: { integrity: 2, reputation: 1 }, risk: 0, result: '你没有投，项目后来什么时候停的你也没再关注。' },
      {
        text: '投一笔试试能不能随时取',
        effect: { integrity: -1 },
        risk: 1,
        result: '钱投进去的当周，收益确实按天到账。',
        roll: {
          chance: 0.5,
          attr: 'network',
          perPoint: 0.004,
          success: { effect: { integrity: -2, wealth: 40000 }, risk: 2, result: '你把本金和收益都取了出来，及时收手。' },
          fail: { effect: { integrity: -2, wealth: -40000 }, risk: 1, result: '第二周平台就无法提现了，你的本金只剩下一个数字。' },
        },
      },
    ],
  },

  // ── 请托与围猎类 ───────────────────────────────────────────────────
  {
    tag: '围猎',
    minRank: 5,
    weight: 3,
    title: '饭局上要一个"明确答复"',
    scene: '饭局进行到一半，对方把话题收住，当着满桌人的面问你要一个明确答复，说"今天给句痛快话，咱们以后都好办事"。',
    options: [
      { text: '只谈政策口径，不表态', effect: { integrity: 4, reputation: 1, network: -2 }, risk: 0, result: '你把话拉回了政策本身，饭桌上一度冷场，但你没有留下承诺。' },
      { text: '含糊应下，先把场面圆过去', effect: { integrity: -4, network: 2 }, risk: 2, result: '场面圆过去了，可"含糊"在对方那里等于"答应了"。' },
      { text: '当场明确答应下来', effect: { integrity: -8, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '那顿饭桌上你当众给的那句痛快话' }, result: '满桌人都听见了你的答复，这句话以后是要兑现的。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 5,
    weight: 3,
    title: '老领导的电话',
    scene: '一位已经退下来的老领导打来电话，说有个"后辈"的事情卡在你这个环节，希望你关照一下，说得不多，只提了一句"当年我帮过你"。',
    options: [
      { text: '说明办理程序，只能按规则办', effect: { integrity: 4, network: -2 }, risk: 0, result: '你把程序讲清楚了，电话那头沉默了一会儿就挂了。' },
      { text: '按程序办，但不排队、优先往前放', effect: { integrity: -1, network: 2 }, risk: 1, result: '事情办得很快，程序上也说得过去，但你自己知道快在了哪里。' },
      { text: '直接安排下去', effect: { integrity: -7, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '他打来的那个电话' }, result: '事情当天就办妥了，这个人情也从此记在了对方账上。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 6,
    weight: 2,
    title: '一张会所里的照片',
    scene: '一个陌生号码发来一张照片：某次应酬你在会所与人碰杯的侧影。"照片拍得不错，想跟你聊聊。"',
    options: [
      {
        text: '不理会，同时向组织如实说明那次应酬',
        effect: { integrity: 5, reputation: 1, network: -2 },
        risk: 0,
        result: '你把情况先说了出去，照片就此失去了要价的价值。',
        roll: {
          chance: 0.75,
          attr: 'reputation',
          perPoint: 0.003,
          success: { effect: { integrity: 5, reputation: 2 }, risk: 0, result: '先说一步让事情变得简单，对方再没发来第二条消息。' },
          fail: { effect: { integrity: 4, reputation: -3 }, risk: 1, result: '照片还是在圈子里传了一圈，但你因为主动说明，没有被追着问。' },
        },
      },
      { text: '花钱把照片买断', effect: { integrity: -8, wealth: -100000, reputation: -2 }, risk: 5, result: '照片拿回来了，可对方手里还有底片，这件事永远不会真正结束。' },
      { text: '隔岸观火，先不做任何回应', effect: { integrity: -2, reputation: -2 }, risk: 2, result: '你没有回应，照片在半个月后被转到了别人的手机上。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 6,
    weight: 2,
    title: '记者手里那段录音',
    scene: '一位记者打来电话，说手上有一段你在某次内部会议上的录音，问你"要不要先沟通一下"。',
    options: [
      { text: '正面回应，请对方按程序核实公开', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '录音被核实后公开，内容与事实基本一致，你反而获得了正面评价。' },
      { text: '请宣传部门统一衔接', effect: { integrity: 2, seniority: 2 }, risk: 0, result: '回应由专业渠道作出，节奏稳了下来。' },
      { text: '找人"做做工作"把稿子压下去', effect: { integrity: -7, wealth: -50000, reputation: -3 }, risk: 4, result: '稿子没发，可"有人被公关过"的说法比稿子本身传得更快。' },
    ],
  },

  // ── 举报与核查类 ───────────────────────────────────────────────────
  {
    tag: '举报',
    minRank: 4,
    weight: 3,
    title: '一封匿名举报信的副本',
    scene: '你收到一封匿名举报信的副本，内容指向你经手过的一个项目，细节写得不算准确，但看得出是内部人写的。',
    options: [
      { text: '主动说明项目全过程，配合核查', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '材料交上去后，核查很快有了结论，事情没有继续发酵。' },
      { text: '先自己了解是谁写的，再做打算', effect: { integrity: -1, network: -1 }, risk: 1, result: '你花了不少精力去猜写信的人，项目本身的说明反而拖了。' },
      { text: '先压下来，不声张', effect: { integrity: -6, reputation: -2 }, risk: 3, result: '信压住了，但它已经存在，什么时候再出现不由你决定。' },
    ],
  },
  {
    tag: '举报',
    minRank: 5,
    weight: 3,
    title: '来人了解一位商人的情况',
    scene: '两名工作人员到单位了解一位长期在本地经营的企业主的情况，请你说明与他之间的往来。',
    options: [
      { text: '把自己知道的全部如实说明', effect: { integrity: 5, network: -2 }, risk: 0, result: '该说的都说了，之后没有再被反复找过。' },
      { text: '只说明有据可查的公务往来', effect: { integrity: -1 }, risk: 1, result: '说明结束了，但有几顿饭局你没有提。' },
      { text: '淡化关系，称只是工作上的认识', effect: { integrity: -7, reputation: -2 }, risk: 4, result: '说法与已有材料对不上，你随后需要反复解释同一件事。' },
    ],
  },

  // ── 家庭与生活类 ───────────────────────────────────────────────────
  {
    tag: '家庭',
    minRank: 4,
    weight: 2,
    title: '配偶要你签一份担保',
    scene: '配偶想和朋友合伙做一个项目，资金缺口需要你作为担保人签字。对方说得很有把握，但合同上有几处你看不太懂。',
    options: [
      { text: '不签，并把看不懂的条款逐条说明', effect: { integrity: 3, reputation: -1, network: -1 }, risk: 0, result: '家里为此争执了很久，但那份合同最后没有你的名字。' },
      { text: '签字支持，家里的事不该太计较', effect: { integrity: -3, wealth: -60000, network: 1 }, risk: 3, result: '项目推进了一段，后续的资金压力也一并落到了你身上。' },
      { text: '请律师看清楚条款再决定', effect: { integrity: 2 }, risk: 0, result: '律师指出了两处明显的风险条款，家里重新商量了方案。' },
    ],
  },
  {
    tag: '家庭',
    minRank: 5,
    weight: 2,
    title: '"孩子上学的事包在我身上"',
    scene: '有人主动提起你孩子升学的事，说自己和某所学校很熟，"一个电话的事，不用你操心"。',
    options: [
      { text: '婉拒，按正常途径报考', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '孩子按自己的成绩走完了流程，你也没有欠下这份人情。' },
      { text: '接受帮忙，觉得是孩子的事', effect: { integrity: -5, network: 1 }, risk: 3, bond: { kind: 'fellow', weight: 1, reason: '替孩子上学打的那些招呼' }, result: '事情办成了，这份人情却挂在了你身上，迟早要还。' },
    ],
  },

  // ── 结网类：关系就是在这些时刻结下的 ─────────────────────────────────
  // 这一组的作用是把"关系网"从隐含机制变成可感知的选择：
  // 同船的领导、经你帮扶的同僚，都是在这种具体场合里多出来的。
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '分管领导让你去跑一件私事',
    scene: '分管领导把你叫到办公室，说的不是工作：他一位亲戚的手续卡在某个环节，让你"帮忙盯一下"。他没说必须办，只是把茶杯往你这边推了推。',
    options: [
      { text: '问清程序，按正常时限往前排', effect: { integrity: 3, seniority: 1, network: -1 }, risk: 0, result: '你按正常时限办了，不快也不慢。领导没再提这件事。' },
      { text: '当天就办妥，不让领导再问第二遍', effect: { integrity: -4, network: 3, seniority: 2 }, risk: 3, bond: { kind: 'fellow', weight: 2, reason: '他亲戚那件手续是你办的' }, result: '事情办得很干净，从此你在他那里多了一个"能用"的位置。' },
      { text: '推给具体经办人，自己不出面', effect: { seniority: -1, reputation: -1 }, risk: 1, result: '你没有亲自经手，但这件事绕了一圈还是挂着你的名字。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '下属把责任全揽了',
    scene: '一份材料出了问题，上面追下来。你还没开口，科里那个刚来两年的年轻人先站起来说"是我核的，跟其他人没关系"。他知道那份材料最后是你签的字。',
    options: [
      { text: '当场说明签字的是自己，责任不在他', effect: { integrity: 5, reputation: 2, seniority: -1 }, risk: 0, result: '你把责任接了回来，材料重新核了一遍。那个年轻人看你的眼神变了。' },
      { text: '让他先顶着，事后找机会补上', effect: { integrity: -3, network: 2, reputation: -1 }, risk: 2, bond: { kind: 'protege', weight: 2, reason: '他替你顶下的那次责任' }, result: '事情压下去了。后来他在关键时候找过你一次，你没法拒绝。' },
      { text: '顺势把话头转开，交给上面定性', effect: { integrity: -1, reputation: -1 }, risk: 1, result: '最后谁也没被点名，只是那份材料从此没人愿意接。' },
    ],
  },
  {
    tag: '结网',
    minRank: 4,
    weight: 3,
    title: '他想要那个位置',
    scene: '一个跟你做过几个项目的老同事找上门，说某个位置马上要空出来，自己等了很多年，希望你能在上面替他说一句话。他说得很实在："这地方我只信你。"',
    options: [
      { text: '只谈他的实绩，不替任何人打包票', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '你把他的项目清单整理了一份交上去，其余的话一句没多说。' },
      { text: '明确替他说话，把人推上去', effect: { network: 3, reputation: 1 }, risk: 2, bond: { kind: 'protege', weight: 2, reason: '你出面向上面要的那个位置' }, result: '他上了那个位置。从那以后，别人提起他的时候，总会先提一句是谁推的。' },
      { text: '让他自己去找渠道，你不掺和', effect: { network: -2 }, risk: 0, result: '他愣了一下，说了句"打扰了"。这件事之后，你们之间的来往少了很多。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 2,
    title: '老同事被挪到了边上',
    scene: '和你同期进单位的一个人被调去管档案，手上的项目全交了。他来找你，不是抱怨，就是想问问你还缺不缺人手。',
    options: [
      { text: '把手上一个项目分给他做', effect: { reputation: 2, network: 2, seniority: 1 }, risk: 0, bond: { kind: 'protege', weight: 1, reason: '你分给他的那个项目' }, result: '项目进度慢了一点，但他重新有了事做，你也多了一个靠得住的人。' },
      { text: '替他去上面争一次，哪怕争不回来', effect: { integrity: 3, network: 1, reputation: 1 }, risk: 0, bond: { kind: 'protege', weight: 1, reason: '你替他去争过的那一次' }, result: '调动没有改回来，但这件事在同事之间传开了。' },
      { text: '劝他先忍一忍，别在这时候出头', effect: { seniority: 1, network: -1 }, risk: 0, result: '他听了，点点头走了。档案室那边后来一直很安静。' },
    ],
  },

  // ── 身体与意外类 ───────────────────────────────────────────────────
  {
    tag: '意外',
    minRank: 2,
    weight: 3,
    title: '体检报告上的箭头',
    scene: '连续几个月加班后，体检报告上出现了几项异常指标，医生建议尽快复查并调整作息。手上正好有一个不能拖的任务。',
    options: [
      { text: '先去复查，把任务重新安排', effect: { health: 6, seniority: -1 }, risk: 0, result: '复查结果是疲劳导致，休息一段时间后指标回落。' },
      { text: '先把手上的事忙完再说', effect: { health: -7, reputation: 1 }, risk: 0, result: '任务按时完成了，但那份报告被你压在了抽屉最下面。' },
      { text: '请几天假集中休整', effect: { health: 4, reputation: -1 }, risk: 0, result: '几天假让你缓了过来，有些工作也转到了别人手上。' },
    ],
  },
  {
    tag: '意外',
    minRank: 2,
    weight: 2,
    title: '老同事突然病倒',
    scene: '隔壁办公室的老同事在会议上突然晕倒，送医后需要长期休养，他手上的活一时没人接。',
    options: [
      { text: '主动顶上，同时协调其他人分担', effect: { reputation: 4, network: 2, health: -3 }, risk: 0, result: '工作没有断档，你连着忙了一个多月，也累得够呛。' },
      { text: '按程序申请增派人手', effect: { seniority: 2, health: -1 }, risk: 0, result: '人手上补充了，只是走完流程又等了两周。' },
      { text: '把最急的部分先接过来，其余照旧', effect: { reputation: 2, seniority: 1 }, risk: 0, result: '急事没有耽误，剩下的按原来的节奏慢慢推。' },
    ],
  },

  // ── 补充池：让每个职级都有足够多的唯一突发事件 ────────────────────────
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '窗口前的熟人请求',
    scene: '窗口前来了一位熟人，说材料还差一页，想请你先收下再补齐，"都是自己人，别卡得太细"。',
    options: [
      { text: '退回材料，列清补正清单', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '熟人把清单接了过去，补齐材料后重新排队。' },
      { text: '先收件，提醒他尽快补齐', effect: { integrity: -1, reputation: -1 }, risk: 1, result: '材料暂时进了窗口，后续催补让你多费了一番口舌。' },
      { text: '直接替他把缺页补上', effect: { integrity: -4, network: 2 }, risk: 3, result: '事情办得很快，但这次破例被同事看在了眼里。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '临时加塞的请示',
    scene: '同一批材料里，有人把一张请示单压在最上面，说领导已经点过头，只等你先处理。',
    options: [
      { text: '按收件时间重新排队', effect: { integrity: 3, seniority: 1 }, risk: 0, result: '请示回到了应有的位置，后续没有人再催你。' },
      { text: '先登记，等领导正式批示', effect: { integrity: 1, reputation: 1 }, risk: 0, result: '你把口头意思留在了纸面之外，手续按正常节点继续走。' },
      { text: '照着暗示先办下去', effect: { integrity: -4, network: 2 }, risk: 3, result: '事情提前办了，排队顺序却留下了一个解释不清的空档。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 2,
    weight: 3,
    title: '快递盒里的小礼物',
    scene: '你的办公桌旁放着一个没有寄件人的快递盒，里面是日常用品，夹着一张没有署名的卡片。',
    options: [
      { text: '原样封存，交办公室登记', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '快递被登记入册，送件人暂时没有出现。' },
      { text: '只留下用品，卡片退回去', effect: { integrity: 1 }, risk: 0, result: '卡片被你退回，用品也按规定处理了。' },
      { text: '把东西带回家再说', effect: { integrity: -4, wealth: 1200, network: 1 }, risk: 2, result: '盒子进了家门，你也记住了这份没有署名的心意。' },
    ],
  },
  {
    tag: '结网',
    minRank: 2,
    weight: 3,
    title: '同事请你代签',
    scene: '同事临时外出，一份需要核对的材料放到了你面前。他说内容都看过了，只差你先代签一下。',
    options: [
      { text: '等本人回来核对后再签', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '材料晚了一会儿，但每一处签字都找得到责任人。' },
      { text: '只核对关键页后签收', effect: { integrity: -1, seniority: 1 }, risk: 1, result: '材料顺利流转，剩下的细节后来又补核了一遍。' },
      { text: '不看内容，直接替他签字', effect: { integrity: -5, network: 2 }, risk: 3, bond: { kind: 'protege', weight: 1, reason: '你替他签下的那份材料' }, result: '同事回来连声道谢，这个签字却从此挂在你名下。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 2,
    weight: 3,
    title: '下班后的那顿饭',
    scene: '下班后，项目相关的一位联系人约你吃饭，说只是叙旧，却把座位安排在了最方便说话的位置。',
    options: [
      { text: '婉拒邀请，说明工作时间外不便往来', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '你没有赴约，第二天照常按流程处理工作。' },
      { text: '参加但只谈公开信息', effect: { integrity: 1, health: -1 }, risk: 0, result: '饭局没有越过边界，只是你花掉了一个晚上的休息时间。' },
      { text: '顺着话题答应帮忙', effect: { integrity: -4, network: 2 }, risk: 3, result: '你给了一个模糊承诺，对方却把它当成了明确答复。' },
    ],
  },
  {
    tag: '举报',
    minRank: 2,
    weight: 3,
    title: '一份退回的材料',
    scene: '你退回的一份材料被人重新送了回来，批注旁边多了一句："大家都这么办，别让事情卡在你这里。"',
    options: [
      { text: '再次说明依据，并留下退回记录', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '退回理由写清楚了，材料最终按规范补正。' },
      { text: '请同事一起复核再决定', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '复核让事情慢了一点，但责任不再只落在你一个人身上。' },
      { text: '睁一只眼放过去', effect: { integrity: -4, reputation: -1 }, risk: 3, result: '材料流转了，那个缺口却留在了后续核查里。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 3,
    weight: 3,
    title: '会场外的求情',
    scene: '会议结束后，一位项目联系人在门口拦住你，说有个小环节希望你提前关照，别让材料再退回去。',
    options: [
      { text: '告知补正要求，让他回去完善', effect: { integrity: 3, reputation: 1 }, risk: 0, result: '对方拿着清单离开，项目随后按程序补齐。' },
      { text: '口头提醒一次，但不承诺结果', effect: { integrity: -1, network: 1 }, risk: 1, result: '你给了提醒，没有替他越过任何审批节点。' },
      { text: '答应在流程里帮他盯着', effect: { integrity: -4, network: 2 }, risk: 3, bond: { kind: 'fellow', weight: 1, reason: '会场外那次求情' }, result: '这句话被记成了人情，后来每个环节都有人来问进度。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 3,
    weight: 3,
    title: '项目验收前的暗示',
    scene: '验收前夕，合作方把一份精心整理的汇报放到你桌上，暗示只要你在会上多说一句，结果就会顺利很多。',
    options: [
      { text: '按现场事实逐项核验', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '汇报回到数据和现场，验收意见写得清清楚楚。' },
      { text: '只提醒对方补齐佐证材料', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '对方补交了材料，结果由证据本身说话。' },
      { text: '提前替对方打包票', effect: { integrity: -5, network: 2 }, risk: 4, result: '会上话说得太满，后续每个差异都要你出面解释。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '领导让你先看一眼',
    scene: '分管领导把一份还没公开的名单递给你，让你先看看有没有熟悉的人，语气像是随口一问。',
    options: [
      { text: '说明名单尚未公开，原样退回', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '名单回到了领导手里，没有在你这里留下副本。' },
      { text: '只看公开信息能核对的部分', effect: { integrity: 1, seniority: 1 }, risk: 1, result: '你没有发表倾向，最后仍按正式名单办理。' },
      { text: '记住几个名字，提前打招呼', effect: { integrity: -5, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '那份提前看过的名单' }, result: '名单还没公布，人情已经先走了一步。' },
    ],
  },
  {
    tag: '结网',
    minRank: 3,
    weight: 3,
    title: '奖金名单上的空白',
    scene: '年底分配奖励时，一位同事发现自己的名字漏在了名单外，来问你能不能替他说句话。',
    options: [
      { text: '把事实和材料整理后提交', effect: { integrity: 3, reputation: 2, network: 1 }, risk: 0, bond: { kind: 'protege', weight: 1, reason: '你帮他核对奖金名单' }, result: '名单重新核对，他最终拿到了应得的评价。' },
      { text: '建议他按申诉渠道反映', effect: { seniority: 1, reputation: 1 }, risk: 0, result: '他照着渠道提交了申请，事情交给了正式程序。' },
      { text: '答应直接去找人改名单', effect: { integrity: -4, network: 2 }, risk: 3, result: '你答应得很快，之后每次分配他都先来找你。' },
    ],
  },
  {
    tag: '家庭',
    minRank: 4,
    weight: 2,
    title: '家人想换学区房',
    scene: '家人看中一套价格明显偏低的房子，中介说房源和某个项目有关系，办起来会比普通房源快。',
    options: [
      { text: '按公开渠道重新比较房源', effect: { integrity: 3, health: -1 }, risk: 0, result: '家人虽然失望，但买房方案回到了公开市场。' },
      { text: '请专业人士核查产权', effect: { integrity: 2, reputation: 1 }, risk: 0, result: '核查发现几处手续问题，家里及时停了下来。' },
      { text: '接受所谓内部便利', effect: { integrity: -5, wealth: 70000, network: 2 }, risk: 4, result: '房子看似占了便宜，手续和人情却一起压了过来。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 2,
    title: '合作方请你评审',
    scene: '合作方邀请你参加一场内部评审，说专家费只是象征性的，主要是感谢你一直以来的支持。',
    options: [
      { text: '说明身份并退出评审', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '评审换了人，你和合作方之间保持了清楚的边界。' },
      { text: '只提供公开资料，不接受费用', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '你给了公开层面的建议，费用没有进入你的账户。' },
      { text: '接受邀请并领取费用', effect: { integrity: -6, wealth: 40000, network: 2 }, risk: 3, result: '费用到账了，之后对方每次遇到项目都拿这次往来作比较。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 4,
    weight: 2,
    title: '匿名包裹送到家',
    scene: '家门口收到一个没有寄件人的包裹，家人说看起来像是熟悉业务的那家单位送来的。',
    options: [
      { text: '拒收并留下退回记录', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '包裹退回去了，家里人也知道了边界在哪里。' },
      { text: '暂时封存，等核实来源', effect: { integrity: 1, health: -1 }, risk: 1, result: '包裹没有拆开，来源核清后按规定处理。' },
      { text: '拆开留下其中的东西', effect: { integrity: -6, wealth: 40000, network: 2 }, risk: 3, result: '东西留下了，家里也开始担心这份来路不明的便利。' },
    ],
  },
  {
    tag: '投资',
    minRank: 5,
    weight: 2,
    title: '老朋友请你照看生意',
    scene: '老朋友说自己的生意正遇到审批节点，希望你不要直接经手，只要在关键时刻提醒一句。',
    options: [
      { text: '说明回避要求，不参与提醒', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '朋友知道了边界，生意按公开流程继续。' },
      { text: '建议他找正式窗口咨询', effect: { integrity: 2, network: -1 }, risk: 0, result: '你把问题推回了公开渠道，没有留下私人承诺。' },
      { text: '答应帮忙盯住节点', effect: { integrity: -5, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '替朋友照看生意的承诺' }, result: '一句提醒变成了长期牵挂，朋友也开始把你当成固定的通道。' },
    ],
  },
  {
    tag: '举报',
    minRank: 5,
    weight: 2,
    title: '会议纪要被人改过',
    scene: '你复核会议纪要时发现，原本写得很清楚的保留意见被删掉了，修改痕迹却没有留下。',
    options: [
      { text: '按录音和原始材料恢复纪要', effect: { integrity: 5, reputation: 1 }, risk: 0, result: '纪要恢复了原貌，保留意见重新回到了记录里。' },
      { text: '要求所有参会人共同确认', effect: { integrity: 3, seniority: 1 }, risk: 0, result: '大家重新确认，修改过程也被补进了说明。' },
      { text: '顺着修改后的版本签字', effect: { integrity: -5, reputation: -1 }, risk: 4, result: '会议记录看起来更干净，却经不起后来逐字核对。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 6,
    weight: 2,
    title: '接待名单上的空位',
    scene: '一次正式接待的名单上多了一个没有姓名的空位，安排人说是老朋友，等你点头就能进场。',
    options: [
      { text: '要求补齐身份和事由', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '名单补全后才进入会场，接待流程留在了明处。' },
      { text: '让工作人员按规定核验', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '核验花了些时间，但没人能绕过登记。' },
      { text: '默认这个空位有人来坐', effect: { integrity: -6, network: 3 }, risk: 4, bond: { kind: 'fellow', weight: 2, reason: '接待名单上那个没有姓名的空位' }, result: '人进了场，名单却留下了一个迟早要解释的空白。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 6,
    weight: 2,
    title: '一笔没有备注的转账',
    scene: '账户里出现一笔没有备注的转账，金额不大，联系之后对方只说是之前那次饭局的感谢。',
    options: [
      { text: '原路退回并保存记录', effect: { integrity: 5, reputation: 1 }, risk: 0, result: '转账退回去了，饭局和账户之间没有留下模糊地带。' },
      { text: '暂不动账，先查清来源', effect: { integrity: 1, health: -1 }, risk: 1, result: '你把款项留在原处，核实后按规定处理。' },
      { text: '默认收下这份感谢', effect: { integrity: -7, wealth: 50000, network: 2 }, risk: 5, result: '钱留在账上，对方也就有了再次开口的理由。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 7,
    weight: 2,
    title: '项目名单里的名字',
    scene: '项目名单即将定稿，有人请你把一个熟悉的名字放进去，说这个人能力没问题，只差一份推荐。',
    options: [
      { text: '按公开标准逐项打分', effect: { integrity: 4, reputation: 2 }, risk: 0, result: '名单按照评分定稿，推荐不再单独影响结果。' },
      { text: '把推荐意见一并留痕', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '意见进入材料，最终由集体评审决定。' },
      { text: '直接把名字排在前面', effect: { integrity: -7, network: 3 }, risk: 5, bond: { kind: 'protege', weight: 2, reason: '你替他放进项目名单' }, result: '名字进了名单，也让这份推荐变成了往后的牵连。' },
    ],
  },
  {
    tag: '受贿',
    minRank: 7,
    weight: 2,
    title: '办公室门口的车钥匙',
    scene: '办公室门口放着一把车钥匙，来人说只是借你用几天，车就在楼下，不必登记。',
    options: [
      { text: '当场退回并说明纪律要求', effect: { integrity: 5, reputation: 1 }, risk: 0, result: '钥匙被拿走了，门口恢复了平常的安静。' },
      { text: '请办公室统一登记后再说', effect: { integrity: 2, seniority: 1 }, risk: 0, result: '登记没有通过，借用的说法自然也就结束了。' },
      { text: '收下钥匙，先用起来再说', effect: { integrity: -8, network: 3 }, risk: 5, result: '车开走了，谁把钥匙放在门口却成了新的问题。' },
    ],
  },
  {
    tag: '围猎',
    minRank: 8,
    weight: 2,
    title: '一封写给未来的请托',
    scene: '一位熟人送来一封信，说现在不用你办什么，只希望将来有合适机会时记得他的名字。',
    options: [
      { text: '退回信件，只接受正式申请', effect: { integrity: 4, reputation: 1 }, risk: 0, result: '信退回去了，未来的事情仍由公开程序决定。' },
      { text: '收下信件但不作承诺', effect: { integrity: 1, network: -1 }, risk: 1, result: '你没有答应任何事，但这封信仍提醒你保持距离。' },
      { text: '把名字记进自己的安排', effect: { integrity: -7, network: 3 }, risk: 5, bond: { kind: 'fellow', weight: 2, reason: '那封提前递来的请托信' }, result: '事情还没有发生，人情账已经先写下了。' },
    ],
  },
];

// 风险痕迹累到阈值后触发的"专项倒查"。它不是随机事件，而是玩家自己选择的结果。
const REVIEW_EVENT = {
  tag: '倒查',
  title: '专项倒查',
  scene: '此前一些资金往来和项目记录被重新调阅，专项工作组逐项核对当年的签字、发票和说明材料，包括那些当时看起来"已经过去"的事。',
  options: [
    { text: '主动说明并提交完整材料，包括对自己不利的部分', effect: { integrity: 4, reputation: -1, health: -3 }, result: '你把该说的都说了，处理结果比预想的轻，事情到这里基本收尾。' },
    { text: '就有据可查的部分作答，其余不作说明', effect: { integrity: -5, reputation: -3, health: -3 }, result: '材料补齐了，但几处解释不通的地方被记了下来。' },
    {
      text: '先找关系缓和一下',
      effect: { integrity: -6, reputation: -2, health: -2 },
      risk: 2,
      result: '找人这件事本身被查了出来，问题从一个变成了两个。',
      roll: {
        chance: 0.6,
        success: {
          effect: { integrity: -5, reputation: -1, network: 1 },
          result: '有人把话递到了上面，核查的口径松了一扣：几处解释不通的地方按"材料瑕疵"归了档。你以为这件事过去了——递话的人也这么以为，从这天起，你们就绑在了同一条绳上。',
        },
        fail: {
          effect: { integrity: -8, reputation: -4, network: -2, health: -2 },
          result: '话还没递上去，"核查期间四处找人"先被记了下来。问题从一个变成了两个：原来几处解释不通的地方，如今每一条都成了态度问题。',
        },
      },
    },
  ],
};

module.exports = { BURST_EVENTS, REVIEW_EVENT };
