// 职级 2 · 四级主任科员（独立承办一块业务）
//
// 权力边界：开始单独牵头一个小专项、负责一条线上的台账和材料，能经办、
// 能督办，但拍板权还在副科级手里。题目围绕"一件事由你从头跟到尾"。
// 50 道。

module.exports = [
  {
    title: '起草通知',
    scene: '分管领导要你起草一份专项整治通知，只给了口头要求，没有给成稿参考。',
    options: [
      { text: '先问清范围、时限和报送口径，再动笔', performance: 3, effect: { reputation: 4, seniority: 1 }, result: '初稿一次过，领导只改了两个词。' },
      { text: '照以往同类通知改一版交上去', performance: 1, effect: { reputation: 1 }, result: '能用，但被退回来补了两处口径。' },
      { text: '等别的科室先出稿，再照着套', performance: -1, effect: { reputation: -2 }, result: '稿子交晚了，催办电话先到了。' },
    ],
  },
  {
    title: '汇总报表',
    scene: '八个村居的进度表陆续报上来，格式五花八门，有几个数字明显对不上。',
    options: [
      { text: '逐村打电话核口径，统一后再汇总', performance: 3, effect: { reputation: 4, health: -2 }, result: '汇总表一次通过，后面复查没返工。' },
      { text: '按多数格式整理，异常值标灰备注', performance: 1, effect: { reputation: 1 }, result: '交上去了，备注被追问了两次。' },
      { text: '把明显对不上的改成能对齐的数', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '表好看了，抽查那天对不上账。' },
    ],
  },
  {
    title: '陪同检查',
    scene: '上级检查组明天到，领导让你全程陪同并做记录。',
    options: [
      { text: '提前走一遍点位，把台账和现场对上', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '检查组问的每一处都能当场翻出来。' },
      { text: '按通知清单准备，跟着走完流程', performance: 1, effect: { reputation: 1 }, result: '没出岔子，也没什么亮点。' },
      { text: '临时把台账补齐，先把检查应付过去', performance: -1, effect: { reputation: -2, integrity: -2 }, result: '补的痕迹太新，被当场指出来。' },
    ],
  },
  {
    title: '专项摸排',
    scene: '要在两周内摸清辖区内的自建房情况，没人手，只能你自己跑。',
    options: [
      { text: '分片排期，白天入户晚上录表', performance: 3, effect: { reputation: 4, health: -3 }, result: '按期交账，底数清楚到每一栋。' },
      { text: '请各村自己报，你汇总', performance: 1, effect: { reputation: 1 }, result: '数据来了，但几处明显漏报。' },
      { text: '按去年数据改个日期报上去', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '抽查时一户新增的没人知道。' },
    ],
  },
  {
    title: '接访记录',
    scene: '一位老人来反映低保问题，说了四十分钟，重点散在各处。',
    options: [
      { text: '边听边记，复述一遍要点请他确认', performance: 3, effect: { reputation: 4 }, result: '诉求清楚了，转办单当天就出去了。' },
      { text: '记下主要诉求，细节略过', performance: 1, effect: { reputation: 1 }, result: '单子转出去了，被退回补了一次材料。' },
      { text: '劝他先回去，等材料齐了再来', performance: -1, effect: { reputation: -3 }, result: '老人又跑了两趟，情绪越来越大。' },
    ],
  },
  {
    title: '会议纪要',
    scene: '一个多小时的协调会，各方吵了三轮，最后才勉强有个结论。',
    options: [
      { text: '按议题分块记，结论和责任人单独列出', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '纪要当天发出，没人来扯皮。' },
      { text: '记下最后结论', performance: 1, effect: { reputation: 1 }, result: '结论有了，过程没人认。' },
      { text: '只记领导最后说的几句', performance: -1, effect: { reputation: -2 }, result: '两个部门都说自己没答应过。' },
    ],
  },
  {
    title: '政策宣讲',
    scene: '要去村里讲一轮新出的补贴政策，听众大多是上了年纪的人。',
    options: [
      { text: '做成一页纸的问答，逐条念完再答疑', performance: 3, effect: { reputation: 4, health: -1 }, result: '散场后被围住问了半小时，都是真问题。' },
      { text: '照文件念一遍', performance: 1, effect: { reputation: 1 }, result: '念完了，大部分人没听懂。' },
      { text: '把材料发下去让大家自己看', performance: -1, effect: { reputation: -2 }, result: '材料被折成纸飞机带回了家。' },
    ],
  },
  {
    title: '入户走访',
    scene: '一户人家连着三次没开门，台账上标着"已联系"。',
    options: [
      { text: '找邻居问清作息，改个时间去', performance: 3, effect: { reputation: 4, health: -1 }, result: '第四次见着人了，实际情况和台账不一样。' },
      { text: '按台账记为已走访', performance: 1, effect: { reputation: 1 }, result: '进度条满了，问题还压着。' },
      { text: '直接勾掉这户，不再联系', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '后来这户的事闹到了镇里。' },
    ],
  },
  {
    title: '数据核对',
    scene: '两个系统里同一批人的信息不一致，一边多出三十来条。',
    options: [
      { text: '逐条比对，把差异列成清单交上去', performance: 3, effect: { reputation: 3, health: -2 }, result: '差异清单成了后面清洗的依据。' },
      { text: '以新系统为准，旧的先放着', performance: 1, effect: { reputation: 1 }, result: '暂时一致了，来源说不清。' },
      { text: '把旧的删掉，只留新的', performance: -1, effect: { reputation: -2, integrity: -2 }, result: '删掉的那批里有人还在享受待遇。' },
    ],
  },
  {
    title: '报送材料',
    scene: '一份材料明天上午必须到，你今晚才发现缺一个盖章页。',
    options: [
      { text: '连夜联系盖章的人，第二天一早补上', performance: 3, effect: { reputation: 3, health: -2 }, result: '材料按时到了，章也齐。' },
      { text: '先报电子版，纸质后补', performance: 1, effect: { reputation: 1 }, result: '收下了，被提醒了一句。' },
      { text: '自己把章的位置处理一下', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '这件事后来成了说不清的一笔。' },
    ],
  },
  {
    title: '组织培训',
    scene: '要给村里的经办人做一次业务培训，来的人水平参差。',
    options: [
      { text: '分成基础和提高两段，各讲各的', performance: 3, effect: { reputation: 4, network: 1, health: -1 }, result: '两边都说听明白了，课后加了群。' },
      { text: '统一讲一遍通用内容', performance: 1, effect: { reputation: 1 }, result: '讲完了，一半人觉得太浅。' },
      { text: '放一段录像代替讲课', performance: -1, effect: { reputation: -2 }, result: '人走了大半。' },
    ],
  },
  {
    title: '督办进度',
    scene: '三件事交给了三个单位，到期的只有一件报了进度。',
    options: [
      { text: '逐个打电话问，把卡点记下来往上反映', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '卡点到了领导桌上，两件动了。' },
      { text: '发催办通知，等回复', performance: 1, effect: { reputation: 1 }, result: '回复来了，都是"正在推进"。' },
      { text: '把没报的写成已完成', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '月底核查时三件都还没动。' },
    ],
  },
  {
    title: '答复建议',
    scene: '收到一份人大代表建议，涉及的事不在你这条线上。',
    options: [
      { text: '先收下登记，查清归口后转办并回执', performance: 3, effect: { reputation: 3, network: 1 }, result: '代表收到回执，后面还专门来问过进展。' },
      { text: '告诉对方找别的科室', performance: 1, effect: { reputation: 1 }, result: '对方又跑去别的科室问了一圈。' },
      { text: '先压着，等有人来问再说', performance: -2, effect: { reputation: -3 }, result: '答复期过了，被通报了。' },
    ],
  },
  {
    title: '档案移交',
    scene: '一位老同事要调走，他手上的档案要交给你。',
    options: [
      { text: '按目录逐卷清点，缺的当场列清单', performance: 3, effect: { reputation: 3, seniority: 1, health: -1 }, result: '交接单签了字，后面没人再来找麻烦。' },
      { text: '大致数一下箱数就签字', performance: 1, effect: { reputation: 1 }, result: '签了，半年后发现少了两卷。' },
      { text: '让他自己处理，你不管', performance: -2, effect: { reputation: -3 }, result: '档案堆在过道，谁走过都看一眼。' },
    ],
  },
  {
    title: '现场核查',
    scene: '有人举报一处场地违规使用，照片拍得含糊。',
    options: [
      { text: '约上相关方一起去现场，当场做笔录', performance: 3, effect: { reputation: 4, integrity: 1 }, result: '事实清楚了，举报属实一半。' },
      { text: '自己单独去看一眼', performance: 1, effect: { reputation: 1 }, result: '看了，但双方说法对不上。' },
      { text: '按照片认定，不再去现场', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '认定错了，对方拿着证据来申诉。' },
    ],
  },
  {
    title: '民意收集',
    scene: '要在小区里收一轮意见，白天大部分人不在家。',
    options: [
      { text: '晚上和周末再跑两轮，线上线下都开', performance: 3, effect: { reputation: 4, health: -2 }, result: '收回的份数是上一轮的三倍。' },
      { text: '白天跑一轮，收到多少算多少', performance: 1, effect: { reputation: 1 }, result: '样本基本是在家的老人。' },
      { text: '找几个熟面孔填一填', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '意见高度雷同，一眼就看得出来。' },
    ],
  },
  {
    title: '物资登记',
    scene: '一批救灾物资到了，签收单和实物对不上。',
    options: [
      { text: '当场重数，差异写在签收单上', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '差异当场说清，后面没人背锅。' },
      { text: '照单签收，回头再查', performance: 1, effect: { reputation: 1 }, result: '签了，之后再查就查不清了。' },
      { text: '按单签收，多出来的先留着', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '留着的东西后来成了麻烦。' },
    ],
  },
  {
    title: '值班安排',
    scene: '节假日值班表排出来了，两个人的时间撞了。',
    options: [
      { text: '先问清各自难处，再协调对调', performance: 3, effect: { reputation: 3, network: 1 }, result: '两人都满意，表也排好了。' },
      { text: '按原表执行，让他们自己解决', performance: 1, effect: { reputation: 1 }, result: '解决了，但有人有意见。' },
      { text: '把自己排上去顶两班', performance: 1, effect: { reputation: 2, health: -3 }, result: '班顶下来了，假期也没了。' },
    ],
  },
  {
    title: '情况说明',
    scene: '上级要一份情况说明，事情的经过你只参与了一段。',
    options: [
      { text: '只写自己经手的部分，其余注明由谁补充', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '说明立得住，补充也有人认。' },
      { text: '把听到的都写进去', performance: 1, effect: { reputation: 1 }, result: '写完了，有两处被人否认。' },
      { text: '推给别人去写', performance: -1, effect: { reputation: -2 }, result: '交上去晚了，还被人说成是不配合。' },
    ],
  },
  {
    title: '典型材料',
    scene: '领导要报一个先进典型，手上有两个人选都还行。',
    options: [
      { text: '按实绩比对，把两个都报上去让上面选', performance: 3, effect: { reputation: 3, network: 1 }, result: '两个都入了围，都没得罪。' },
      { text: '报跟自己熟的那个', performance: 1, effect: { reputation: 1, network: 1 }, result: '报上去了，另一个人有想法。' },
      { text: '把材料编得漂亮些', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '实地核验时事迹对不上。' },
    ],
  },
  {
    title: '台账更新',
    scene: '台账三个月没更新，很多情况已经变了。',
    options: [
      { text: '从头核一遍，变更的都留痕', performance: 3, effect: { reputation: 3, health: -2 }, result: '台账重新能用，后面省了很多事。' },
      { text: '把明显变的改一改', performance: 1, effect: { reputation: 1 }, result: '表面跟上了，细节还是旧的。' },
      { text: '沿用旧台账，等检查再说', performance: -2, effect: { reputation: -3 }, result: '检查那天翻出一堆过期信息。' },
    ],
  },
  {
    title: '协调会',
    scene: '两个单位为一件事的归属扯了很久，会是你召集的。',
    options: [
      { text: '先摆职责依据，再把分歧点收敛成一个问题', performance: 3, effect: { reputation: 4, network: 2 }, result: '会开了一半就定了，双方都签了字。' },
      { text: '让双方各说各的，会后汇总', performance: 1, effect: { reputation: 1 }, result: '会散了，分歧还在。' },
      { text: '按领导的意思直接定', performance: -1, effect: { reputation: -2 }, result: '定了，被推的一方一直不服。' },
    ],
  },
  {
    title: '整改销号',
    scene: '一个问题挂了半年，整改报告交了三版。',
    options: [
      { text: '去现场看整改到底落地没有', performance: 3, effect: { reputation: 4, integrity: 1 }, result: '实地一看，报告里写的根本没做。' },
      { text: '看报告齐不齐，齐了就销', performance: 1, effect: { reputation: 1 }, result: '销号了，问题还在那儿。' },
      { text: '先销了免得挂账', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '复查时被翻出来，账算到你头上。' },
    ],
  },
  {
    title: '摸底调查',
    scene: '要在不惊动太多人的前提下摸清一件事的真实情况。',
    options: [
      { text: '分头找不同的人侧面问，交叉印证', performance: 3, effect: { reputation: 3, health: -1 }, result: '几个说法能对上，基本摸清了。' },
      { text: '直接找当事人问', performance: 1, effect: { reputation: 1 }, result: '问到了一套说法，没法印证。' },
      { text: '听一个人的说法就下结论', performance: -2, effect: { reputation: -3 }, result: '结论偏了，后面很难改口。' },
    ],
  },
  {
    title: '宣传稿',
    scene: '本单位的一件事被上面点名要报个稿子。',
    options: [
      { text: '写清做了什么、谁在办、下一步是什么', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '稿子发了，还被转了一次。' },
      { text: '套模板写一版', performance: 1, effect: { reputation: 1 }, result: '发了，没什么水花。' },
      { text: '把没做的事也写进去', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '有人拿着稿子来问什么时候兑现。' },
    ],
  },
  {
    title: '群众回访',
    scene: '三个月前办结的一件事，要回访当事人。',
    options: [
      { text: '问清办完后的实际情况，不满意的再跟进', performance: 3, effect: { reputation: 4 }, result: '回访出两个新问题，都补办了。' },
      { text: '打个电话确认办结', performance: 1, effect: { reputation: 1 }, result: '确认了，挂了电话。' },
      { text: '照台账填满意', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '抽查回访时当事人说根本没人联系过。' },
    ],
  },
  {
    title: '界线纠纷',
    scene: '两户人家为一道地界吵起来了，都说是自己的。',
    options: [
      { text: '找老台账和老邻居一起到现场指界', performance: 3, effect: { reputation: 4, health: -1 }, result: '界指清楚了，两家都认。' },
      { text: '让村里自己去调解', performance: 1, effect: { reputation: 1 }, result: '调解了，但没留下书面东西。' },
      { text: '按关系近的一方说', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '另一方不服，事情越闹越大。' },
    ],
  },
  {
    title: '帮扶走访',
    scene: '一户帮扶对象今年收入没起来，孩子还在上学。',
    options: [
      { text: '问清卡在哪，帮着对接一个能解决的口子', performance: 3, effect: { reputation: 4, network: 1 }, result: '下半年这户有了稳定来源。' },
      { text: '照例走访，记录情况', performance: 1, effect: { reputation: 1 }, result: '记录是完整的，情况没变。' },
      { text: '把收入填高一点让数据好看', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '复核时一问就露了。' },
    ],
  },
  {
    title: '应急值守',
    scene: '夜里接到预警，要求半小时内到岗。',
    options: [
      { text: '立刻到岗，先把点位和风险点过一遍', performance: 3, effect: { reputation: 3, health: -2 }, result: '一夜无事，第二天的交接也清楚。' },
      { text: '按时到岗，等通知', performance: 1, effect: { reputation: 1, health: -1 }, result: '到岗了，但没主动做什么。' },
      { text: '电话里说在路上了，人没去', performance: -3, effect: { reputation: -4, integrity: -3 }, result: '查岗时那半小时怎么都说不清。' },
    ],
  },
  {
    title: '台账自查',
    scene: '上面要求先自查，再抽查。自查表要自己填。',
    options: [
      { text: '照实填，把问题也写进去', performance: 3, effect: { reputation: 3, integrity: 2 }, result: '抽查没挑出新的毛病，反而被说自查实。' },
      { text: '填成基本合格', performance: 1, effect: { reputation: 1 }, result: '合格了，问题还压着。' },
      { text: '全部填合格', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '抽查一项一项被打回来。' },
    ],
  },
  {
    title: '领导交办',
    scene: '领导口头交办了一件事，没说时限也没说标准。',
    options: [
      { text: '当场确认时限、标准和要不要留痕', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '办完一次到位，领导没再追问。' },
      { text: '按自己的理解办完回报', performance: 1, effect: { reputation: 1 }, result: '办了，方向偏了一点点。' },
      { text: '等领导再想起这件事', performance: -2, effect: { reputation: -3 }, result: '领导想起时，事已经过了窗口期。' },
    ],
  },
  {
    title: '数据口径',
    scene: '同一个指标，两个部门报上来的数差了一截。',
    options: [
      { text: '把两边的口径摊开对，找出差在哪一步', performance: 3, effect: { reputation: 3, health: -1 }, result: '口径统一了，往后不用再扯。' },
      { text: '取一个中间数报上去', performance: 1, effect: { reputation: 1 }, result: '报了，两个部门都不认。' },
      { text: '按对自己有利的那个报', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被问到来源时答不上来。' },
    ],
  },
  {
    title: '材料把关',
    scene: '下级报上来一份材料，里面有几处说法你没有依据确认。',
    options: [
      { text: '退回要求补依据，没有依据的表述删掉', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '材料干净了，后面经得起问。' },
      { text: '改动几处明显的错就报', performance: 1, effect: { reputation: 1 }, result: '报了，被追问了两处。' },
      { text: '照报，反正上面也不一定看', performance: -1, effect: { reputation: -2 }, result: '上面看了，还专门打电话来问。' },
    ],
  },
  {
    title: '现场会',
    scene: '要在你负责的这个点开一个现场会，来的人不少。',
    options: [
      { text: '提前演练动线，把讲解交给最熟的人', performance: 3, effect: { reputation: 4, health: -2 }, result: '会开得顺，点位被记进了典型。' },
      { text: '按流程走一遍', performance: 1, effect: { reputation: 1 }, result: '开完了，没留下什么印象。' },
      { text: '临时布置一下现场', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '有人提前一天来看过，看出来了。' },
    ],
  },
  {
    title: '走访台账',
    scene: '一季度的走访台账要归档，里面有几次是同事代填的。',
    options: [
      { text: '标注代填人并补齐走访记录', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '台账经得起翻，代填也说得清。' },
      { text: '补几个签名归档', performance: 1, effect: { reputation: 1 }, result: '归档了，记录还是空的。' },
      { text: '照原样归档', performance: -1, effect: { reputation: -2 }, result: '抽查时被问到那几次走访的细节。' },
    ],
  },
  {
    title: '舆情线索',
    scene: '有人在群里发了一段视频，说的跟实际情况有出入。',
    options: [
      { text: '核清事实后公开说明，能改的马上改', performance: 3, effect: { reputation: 4 }, result: '视频下面有人替你回了话。' },
      { text: '私下联系发帖人删掉', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '删了，但已经有人存了。' },
      { text: '不理，等热度过去', performance: -2, effect: { reputation: -3 }, result: '热度没过去，反而上了别的平台。' },
    ],
  },
  {
    title: '年度总结',
    scene: '要写本科室的年度总结，成绩不多，事情不少。',
    options: [
      { text: '按事列，把没做成的也写进去并说明原因', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '念完没人挑刺，第二年好要资源。' },
      { text: '把做过的事堆上去', performance: 1, effect: { reputation: 1 }, result: '厚厚一叠，没人看完。' },
      { text: '照去年的改改数字', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '有几个数据跟别处对不上。' },
    ],
  },
  {
    title: '业务轮训',
    scene: '有一个去上级跟班学习的名额，要去三个月。',
    options: [
      { text: '把手上的事交接清楚再去，回来写份报告', performance: 3, effect: { reputation: 3, network: 2, seniority: 1 }, result: '学成回来，认识了一批人。' },
      { text: '去，走前简单交代一下', performance: 1, effect: { reputation: 1, network: 1 }, result: '回来了，交接处留了个尾巴。' },
      { text: '不去，手上的事离不开', performance: 1, effect: { reputation: 1 }, result: '事没耽误，机会给了别人。' },
    ],
  },
  {
    title: '交叉检查',
    scene: '要去别的乡镇交叉检查，那边有人跟你认识。',
    options: [
      { text: '按清单查，熟人那块查得更细', performance: 3, effect: { reputation: 4, integrity: 1 }, result: '查出的问题对方认了，没伤情面。' },
      { text: '按清单查', performance: 1, effect: { reputation: 1 }, result: '查完了，没什么发现。' },
      { text: '熟人那块跳过', performance: -2, effect: { reputation: -2, integrity: -2 }, result: '后来那边出事，牵到这次检查。' },
    ],
  },
  {
    title: '帮办代办',
    scene: '一位行动不便的人要办一件事，按规定得本人到场。',
    options: [
      { text: '问清能否上门核验，按程序办', performance: 3, effect: { reputation: 4 }, result: '上门办成了，对方托人送来一封感谢信。' },
      { text: '让他找人代办', performance: 1, effect: { reputation: 1 }, result: '办成了，绕了一圈。' },
      { text: '让他自己想办法来', performance: -2, effect: { reputation: -3 }, result: '事拖了两个月才办。' },
    ],
  },
  {
    title: '流程优化',
    scene: '一个事项要盖四个章，群众来回跑三趟。',
    options: [
      { text: '量一遍各环节耗时，写份简化建议报上去', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '建议被采纳了两项，跑动少了一趟。' },
      { text: '口头上跟领导提一句', performance: 1, effect: { reputation: 1 }, result: '提了，没有下文。' },
      { text: '照旧办，不惹麻烦', performance: -1, effect: { reputation: -2 }, result: '投诉量一直没下来。' },
    ],
  },
  {
    title: '遗留问题',
    scene: '一件事拖了三年，经手的人换了两茬，材料只剩半份。',
    options: [
      { text: '把能找到的都拼起来，列清卡点再报', performance: 3, effect: { reputation: 4, health: -2 }, result: '卡点清楚了，事情重新启动。' },
      { text: '从头重新走一遍流程', performance: 1, effect: { reputation: 1, health: -1 }, result: '走了，但三年的问题又要三年。' },
      { text: '按历史遗留挂起来', performance: -1, effect: { reputation: -2 }, result: '又挂了一年，人又找上来了。' },
    ],
  },
  {
    title: '基层座谈',
    scene: '要开一场座谈会，来的都是村里的人。',
    options: [
      { text: '先给提纲，让人人都能说上三句', performance: 3, effect: { reputation: 3, network: 1 }, result: '会开得活，收集到不少真问题。' },
      { text: '让村干部先讲', performance: 1, effect: { reputation: 1 }, result: '讲完了，别人没怎么开口。' },
      { text: '念一通报就散会', performance: -1, effect: { reputation: -2 }, result: '下次再召集，来的人少了一半。' },
    ],
  },
  {
    title: '政策答疑',
    scene: '有人问的政策你只听过名字，细节不清楚。',
    options: [
      { text: '记下问题，查清文件后回电话', performance: 3, effect: { reputation: 4 }, result: '第二天回了电话，对方很意外。' },
      { text: '按大体理解说个方向', performance: 1, effect: { reputation: 1 }, result: '方向没大错，细节要再来问。' },
      { text: '说不在你这块，让他去问别人', performance: -1, effect: { reputation: -2 }, result: '他问了三家，回来还是找到你。' },
    ],
  },
  {
    title: '台账归档',
    scene: '一年的台账要归档，有几本记得很潦草。',
    options: [
      { text: '趁还记得补清楚再归档', performance: 3, effect: { reputation: 3, health: -1 }, result: '第二年翻出来，一查就到。' },
      { text: '照原样归档', performance: 1, effect: { reputation: 1 }, result: '归了，第二年看不懂。' },
      { text: '重抄一本干净的', performance: -1, effect: { reputation: -2, integrity: -2 }, result: '抄本和原件对不上，反而是个问题。' },
    ],
  },
  {
    title: '进度通报',
    scene: '要出一期进度通报，有几个单位排在最后。',
    options: [
      { text: '照实排名，同时写清落后原因和下一步', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '通报发出去，落后的那几家动起来了。' },
      { text: '只写进度不排名', performance: 1, effect: { reputation: 1 }, result: '通报发了，没人当回事。' },
      { text: '把熟人单位往前排', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '排名被人拿去对比，很难解释。' },
    ],
  },
  {
    title: '典型推荐',
    scene: '要推荐一个人去上面交流，两个人条件相当。',
    options: [
      { text: '列条件公开比，让几个人一起评', performance: 3, effect: { reputation: 3, network: 1 }, result: '评出来的那个大家都服。' },
      { text: '领导定', performance: 1, effect: { reputation: 1 }, result: '定了，另一个人来问过。' },
      { text: '推荐跟自己走得近的', performance: -1, effect: { reputation: -2, network: 1 }, result: '推荐成了，但有人背后议论。' },
    ],
  },
  {
    title: '联合排查',
    scene: '几个部门一起排查，各自的清单不一样。',
    options: [
      { text: '先把清单并成一份，再去现场', performance: 3, effect: { reputation: 3, network: 2, health: -1 }, result: '一次跑完，后面不用再约。' },
      { text: '各查各的，最后汇总', performance: 1, effect: { reputation: 1 }, result: '去了三趟同一户人家。' },
      { text: '只查自己这块', performance: -1, effect: { reputation: -1 }, result: '查完了，别的部门又来敲门。' },
    ],
  },
  {
    title: '问卷统计',
    scene: '收回几百份问卷，有几份填得明显不用心。',
    options: [
      { text: '按规则判无效，作废份数写进说明', performance: 3, effect: { reputation: 3, integrity: 1 }, result: '结果站得住，被拿去用了。' },
      { text: '全部计入', performance: 1, effect: { reputation: 1 }, result: '统计完了，几项结果很怪。' },
      { text: '把不合适的答案删掉再统计', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '结果好看，但没有依据。' },
    ],
  },
  {
    title: '交接准备',
    scene: '你可能要调去新的岗位，手上的事要交出去。',
    options: [
      { text: '写一份交接清单，逐项带着接手人过一遍', performance: 3, effect: { reputation: 3, seniority: 1, network: 1 }, result: '走得很干净，新岗位的消息也来得快。' },
      { text: '把材料整理好放着', performance: 1, effect: { reputation: 1 }, result: '接手人翻了半天才理出头绪。' },
      { text: '先不管，等真调再说', performance: -1, effect: { reputation: -2 }, result: '调令来得突然，交接乱了一周。' },
    ],
  },
];
