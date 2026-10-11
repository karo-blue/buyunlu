// 职级 7 · 厅局级副职（副厅级）
//
// 权力边界：管一条战线，协调若干个部门甚至若干个地方。不大直接办具体事，
// 但要让体系转起来。题目围绕"跨部门协调、制度设计与尺度把握"。
// 50 道。

module.exports = [
  {
    title: '分管战线',
    scene: '分工下来，你分管一条跨十几个部门、上下都盯着看的战线。',
    options: [
      { text: '先摸清这条线的历史沿革和关键堵点', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '三个月后你说的每句话都很准。' },
      { text: '先开分管部门会', performance: 1, effect: { reputation: 1 }, result: '会开了，各家报了各自的说法。' },
      { text: '先抓一项最容易见效的', performance: -1, effect: { reputation: -2 }, result: '见效了，主线没人认领。' },
    ],
  },
  {
    title: '首次常务会',
    scene: '第一次上政府常务会，你的议题被几个部门提了意见。',
    options: [
      { text: '会前逐个沟通，把分歧解决在上会之前', performance: 3, effect: { reputation: 4, network: 2, seniority: 2 }, result: '议题一次通过。' },
      { text: '会上逐条解释', performance: 1, effect: { reputation: 1 }, result: '解释了，被要求再论证。' },
      { text: '请主要领导支持', performance: -1, effect: { reputation: -2 }, result: '通过了，部门心里不服。' },
    ],
  },
  {
    title: '部门协同',
    scene: '一件事涉及七八个部门，开了三次会还是推不动。',
    options: [
      { text: '建专班，定牵头、定节点、定考核，你亲自周调度', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两个月后事情有了实质进展。' },
      { text: '再开一次协调会', performance: 1, effect: { reputation: 1 }, result: '会开了，还是各说各话。' },
      { text: '报给主要领导', performance: -1, effect: { reputation: -2, network: -1 }, result: '被说成是协调能力不够。' },
    ],
  },
  {
    title: '跨区域协调',
    scene: '一条产业链跨三个市，各地都想把环节留在本地。',
    options: [
      { text: '推动建立利益分享机制，按环节分工', performance: 3, effect: { reputation: 4, network: 4, seniority: 2 }, result: '三地签了协议，链条真正打通。' },
      { text: '各地各干各的', performance: 1, effect: { reputation: 1 }, result: '重复建设，谁都没做大。' },
      { text: '让条件最好的那个先做', performance: -1, effect: { reputation: -2, network: -2 }, result: '另外两地从此不配合。' },
    ],
  },
  {
    title: '行业规划',
    scene: '要编一个行业五年规划，各方诉求差别很大。',
    options: [
      { text: '开门做规划，多轮论证后锁定几个硬指标', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '规划落地率高，五年没大改。' },
      { text: '委托机构做', performance: 1, effect: { reputation: 1 }, result: '做出来了，没人认。' },
      { text: '把各方诉求都写进去', performance: -1, effect: { reputation: -2 }, result: '规划成了清单，没有重点。' },
    ],
  },
  {
    title: '产业集群',
    scene: '一个产业集群大而不强，配套都在外地。',
    options: [
      { text: '找准缺失环节定向补链，同时做公共服务平台', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '三年后本地配套率翻了一倍。' },
      { text: '引进龙头企业', performance: 1, effect: { reputation: 1 }, result: '龙头来了，配套还是在外地。' },
      { text: '给补贴留住企业', performance: -1, effect: { reputation: -2 }, result: '补贴一停就想走。' },
    ],
  },
  {
    title: '项目调度',
    scene: '一批重点项目进度滞后，原因各不相同。',
    options: [
      { text: '逐个过堂，分出卡审批、卡资金、卡征拆三类分别解决', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '半年后开工率明显提升。' },
      { text: '通报排名', performance: 1, effect: { reputation: 1 }, result: '通报了，进度没变。' },
      { text: '约谈落后的', performance: -1, effect: { reputation: -2, network: -1 }, result: '约谈了，问题还是那些问题。' },
    ],
  },
  {
    title: '要素保障',
    scene: '土地、能耗、环境容量都紧，好项目落不了地。',
    options: [
      { text: '盘活存量、腾出指标，优先保真正的好项目', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '有限的要素用在了刀刃上。' },
      { text: '向上争取', performance: 1, effect: { reputation: 1 }, result: '争取到一点，僧多粥少。' },
      { text: '谁急给谁', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '好项目还是落不了。' },
    ],
  },
  {
    title: '营商环境',
    scene: '评价下来，企业反映最强烈的是政策不稳定、执法随意。',
    options: [
      { text: '推政策稳定性和执法规范化，设投诉直通渠道', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 2 }, result: '第二年评价名次大幅前移。' },
      { text: '出台一批优惠', performance: 1, effect: { reputation: 1 }, result: '优惠出了，根本问题没解决。' },
      { text: '做评价应对', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '名次上去了，企业还是在跑。' },
    ],
  },
  {
    title: '科技创新',
    scene: '研发投入上不去，成果转化也不畅。',
    options: [
      { text: '从需求侧切入，让企业出题、院所答题、政府搭台', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '转化率明显提高，投入也跟着涨。' },
      { text: '增加财政投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，产出没跟。' },
      { text: '引进几家研究院', performance: -1, effect: { reputation: -2 }, result: '院牌挂了，没有实。' },
    ],
  },
  {
    title: '数字化转型',
    scene: '企业想转不敢转，不知道从哪下手。',
    options: [
      { text: '做一批样板线，把改造方案和成本收益公开出来', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '样板出来后，跟进的企业排起了队。' },
      { text: '给改造补贴', performance: 1, effect: { reputation: 1 }, result: '补贴花了，改造流于形式。' },
      { text: '发文号召', performance: -1, effect: { reputation: -2 }, result: '号召了，没人动。' },
    ],
  },
  {
    title: '产业基金',
    scene: '要设一支产业基金，怎么选管理人、怎么容错都是问题。',
    options: [
      { text: '公开遴选管理人，明确容亏率和退出机制', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '基金运作规范，也真投出了项目。' },
      { text: '指定一家熟悉的机构', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '指定了，后续很难监管。' },
      { text: '要求保本', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '保本条款下没人敢投好项目。' },
    ],
  },
  {
    title: '国企改革',
    scene: '几家国企主业不清、亏损多年，人也多。',
    options: [
      { text: '一企一策定主业，该退的退，人妥善安置', performance: 3, effect: { reputation: 3, seniority: 2, health: -2 }, result: '两年后整体扭亏。' },
      { text: '换一批班子', performance: 1, effect: { reputation: 1 }, result: '班子换了，机制没动。' },
      { text: '先输血保稳定', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '血输完，还是亏。' },
    ],
  },
  {
    title: '金融风险',
    scene: '一家本地金融机构出现风险苗头。',
    options: [
      { text: '早识别早介入，制定处置方案并稳住储户情绪', performance: 3, effect: { reputation: 4, integrity: 2, health: -2 }, result: '风险平稳化解，没发生挤兑。' },
      { text: '要求机构自己化解', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '拖了半年，风险扩大。' },
      { text: '先压住消息', performance: -4, effect: { reputation: -6, integrity: -5 }, result: '消息走漏引发挤兑。' },
    ],
  },
  {
    title: '地方金融',
    scene: '中小微企业融资难，银行不敢贷。',
    options: [
      { text: '建信息共享和风险分担机制，把信用体系做起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '一年后融资规模和成本都改善了。' },
      { text: '要求银行放贷', performance: 1, effect: { reputation: 1 }, result: '放了一批，不良也上来了。' },
      { text: '财政贴息', performance: -1, effect: { reputation: -1 }, result: '贴息花了，覆盖面很小。' },
    ],
  },
  {
    title: '企业上市',
    scene: '要推企业上市，几家条件差距很大。',
    options: [
      { text: '分层培育，先解决规范性问题再谈进度', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '三年内上市了三家，也没有造假。' },
      { text: '给奖励冲刺', performance: 1, effect: { reputation: 1 }, result: '冲了一阵，撤材料了。' },
      { text: '包装一下先报', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '现场检查出问题，被立案。' },
    ],
  },
  {
    title: '外贸外资',
    scene: '外贸订单下滑，外资也有观望情绪。',
    options: [
      { text: '帮企业拓市场、稳订单，同时解决外资的实际困难', performance: 3, effect: { reputation: 4, network: 3, seniority: 1 }, result: '那年外贸份额反而涨了。' },
      { text: '出台扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，落到企业手里慢。' },
      { text: '等形势好转', performance: -2, effect: { reputation: -3 }, result: '等来了更多企业外迁。' },
    ],
  },
  {
    title: '开发区',
    scene: '几个开发区同质化严重，都在抢同一类项目。',
    options: [
      { text: '明确各自主导产业，建立项目流转和利益分享机制', performance: 3, effect: { reputation: 3, seniority: 3, network: 2 }, result: '错位发展后整体招商效果好很多。' },
      { text: '谁有能力谁上', performance: 1, effect: { reputation: 1 }, result: '强的更强，弱的空转。' },
      { text: '合并几个区', performance: -1, effect: { reputation: -2, network: -1 }, result: '合了，人心散了。' },
    ],
  },
  {
    title: '口岸建设',
    scene: '口岸通关效率排在后面，企业意见大。',
    options: [
      { text: '逐环节测时间，能并的并、能提前的提前', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '通关时间缩短，货运量上来了。' },
      { text: '增加人力和窗口', performance: 1, effect: { reputation: 1 }, result: '人加了，环节还是那么多。' },
      { text: '要求企业适应', performance: -2, effect: { reputation: -3 }, result: '企业开始走别的口岸。' },
    ],
  },
  {
    title: '交通网络',
    scene: '一条通道对区域格局很关键，但投资大、回收慢。',
    options: [
      { text: '做全周期论证，把不可量化的社会效益也摆出来', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '项目获批，十年后看是对的。' },
      { text: '先做一段', performance: 1, effect: { reputation: 1 }, result: '一段通了，效益有限。' },
      { text: '等条件成熟', performance: -1, effect: { reputation: -2 }, result: '邻市先建了，格局变了。' },
    ],
  },
  {
    title: '能源保障',
    scene: '用电高峰缺口明显，同时还要完成节能目标。',
    options: [
      { text: '供给侧和需求侧一起做，先保民生和重点', performance: 3, effect: { reputation: 4, health: -2, seniority: 2 }, result: '平稳度过高峰，也没拉闸限电。' },
      { text: '向上争取指标', performance: 1, effect: { reputation: 1 }, result: '争取到一点，缺口还在。' },
      { text: '有序用电', performance: -1, effect: { reputation: -2 }, result: '限了电，企业意见很大。' },
    ],
  },
  {
    title: '节能降碳',
    scene: '节能降碳目标压下来，跟增长目标有冲突。',
    options: [
      { text: '在存量改造上找空间，用技术和管理换指标', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '目标完成，增长也没掉。' },
      { text: '压项目', performance: 1, effect: { reputation: 1 }, result: '压了，增长也下来了。' },
      { text: '在核算上想办法', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '核算方法被上级纠正。' },
    ],
  },
  {
    title: '生态治理',
    scene: '一项治理任务涉及上下游、左右岸，标准不统一。',
    options: [
      { text: '推动统一标准、统一监测、联合执法', performance: 3, effect: { reputation: 4, network: 3, seniority: 2 }, result: '治理效果出来了，也没有互相扯皮。' },
      { text: '各自完成任务', performance: 1, effect: { reputation: 1 }, result: '各自达标，整体没改善。' },
      { text: '先治自己这段', performance: -1, effect: { reputation: -2 }, result: '治了，上游还在排。' },
    ],
  },
  {
    title: '流域治理',
    scene: '一条河的治理要动很多主体的利益。',
    options: [
      { text: '把责任清单和补偿机制一起建起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '三年后水质稳定达标。' },
      { text: '上工程', performance: 1, effect: { reputation: 1 }, result: '工程上了，源头没管住。' },
      { text: '先做景观', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '岸上漂亮，水里还是那样。' },
    ],
  },
  {
    title: '城市建设',
    scene: '城市扩张很快，但公共服务跟不上。',
    options: [
      { text: '把公共服务跟人口分布一起规划，缺什么补什么', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '三年后新区真正有人气。' },
      { text: '先把骨架拉开', performance: 1, effect: { reputation: 1 }, result: '路修了，人没来。' },
      { text: '先做地标', performance: -2, effect: { reputation: -3 }, result: '地标有了，生活不便。' },
    ],
  },
  {
    title: '城市管理',
    scene: '城市管理长期靠突击，一松就回潮。',
    options: [
      { text: '把标准、责任、经费一起定下来，做常态化', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '一年后不用再突击了。' },
      { text: '增加执法力量', performance: 1, effect: { reputation: 1 }, result: '人多了，矛盾也多了。' },
      { text: '搞集中行动', performance: -1, effect: { reputation: -2 }, result: '行动结束就回潮。' },
    ],
  },
  {
    title: '住房保障',
    scene: '新市民和青年人的住房问题突出。',
    options: [
      { text: '多渠道供给，把保障对象和标准先划清楚', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后保障覆盖面明显扩大。' },
      { text: '多建保障房', performance: 1, effect: { reputation: 1 }, result: '建了，位置和配套不理想。' },
      { text: '发补贴', performance: -1, effect: { reputation: -2 }, result: '补贴发了，房源没增加。' },
    ],
  },
  {
    title: '房地产市场',
    scene: '市场下行，库存高企，房企资金紧张。',
    options: [
      { text: '控增量、去库存、防风险三件事一起抓', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '两年后市场趋于平稳。' },
      { text: '出台刺激政策', performance: 1, effect: { reputation: 1 }, result: '刺激了一阵，又回去了。' },
      { text: '托市', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '托市留下的账，后面很难还。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '乡村振兴推进几年，产业同质化、留不住人。',
    options: [
      { text: '按资源禀赋分区分类，把联农带农机制做实', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后多数村有了稳定来源。' },
      { text: '继续投基础设施', performance: 1, effect: { reputation: 1 }, result: '设施好了，人还是往外走。' },
      { text: '做示范点', performance: -1, effect: { reputation: -2 }, result: '点很漂亮，面上没变。' },
    ],
  },
  {
    title: '现代农业',
    scene: '农业大而不强，产业链短，品牌没有。',
    options: [
      { text: '从加工和品牌两头入手，把利益联结做起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '三年后几个区域品牌真正立住了。' },
      { text: '扩大种植规模', performance: 1, effect: { reputation: 1 }, result: '规模上去了，价格下来了。' },
      { text: '给补贴', performance: -1, effect: { reputation: -2 }, result: '补贴一停就回去。' },
    ],
  },
  {
    title: '水利建设',
    scene: '防洪和灌溉都有欠账，一次投入很大。',
    options: [
      { text: '按风险排序，先除险再提升', performance: 3, effect: { reputation: 3, seniority: 1, integrity: 1 }, result: '那年汛期没有出险情。' },
      { text: '全面铺开', performance: 1, effect: { reputation: 1 }, result: '铺开了，资金跟不上。' },
      { text: '先做看得见的', performance: -2, effect: { reputation: -3 }, result: '看得见的做了，隐患还在。' },
    ],
  },
  {
    title: '就业工作',
    scene: '结构性矛盾突出，有人没活干、有活没人干。',
    options: [
      { text: '把培训跟着岗位走，跟企业一起定课程', performance: 3, effect: { reputation: 4, seniority: 1, network: 2 }, result: '匹配率上去，企业也不再喊缺工。' },
      { text: '扩大培训规模', performance: 1, effect: { reputation: 1 }, result: '培训了很多，用不上。' },
      { text: '开发公益岗', performance: -1, effect: { reputation: -2 }, result: '岗位有限，也解决不了结构问题。' },
    ],
  },
  {
    title: '教育事业',
    scene: '优质教育资源集中，择校热降不下来。',
    options: [
      { text: '做实质均衡，校长教师交流落到人和年限', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '三年后择校热明显降温。' },
      { text: '扩大优质校规模', performance: 1, effect: { reputation: 1 }, result: '规模大了，质量稀释。' },
      { text: '严格就近入学', performance: -1, effect: { reputation: -2 }, result: '择校转到别的通道。' },
    ],
  },
  {
    title: '卫生健康',
    scene: '分级诊疗推不动，大医院人满为患。',
    options: [
      { text: '做强基层能力，同时用医保支付引导分流', performance: 3, effect: { reputation: 3, seniority: 2, network: 1 }, result: '两年后基层就诊占比上去了。' },
      { text: '扩建大医院', performance: 1, effect: { reputation: 1 }, result: '扩了，还是人满。' },
      { text: '限制大医院门诊', performance: -2, effect: { reputation: -3 }, result: '限制了，群众意见很大。' },
    ],
  },
  {
    title: '养老服务',
    scene: '养老供需错配，机构空置和居家无人管并存。',
    options: [
      { text: '以居家社区为主建网络，机构兜底最刚需的', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '三年后服务体系成型。' },
      { text: '增加机构床位', performance: 1, effect: { reputation: 1 }, result: '床位多了，空着一半。' },
      { text: '提高补贴', performance: -1, effect: { reputation: -2 }, result: '补贴提高了，服务还是缺。' },
    ],
  },
  {
    title: '文化旅游',
    scene: '资源不错，但留不住人、消费上不去。',
    options: [
      { text: '先解决体验和公共服务，再做内容', performance: 3, effect: { reputation: 4, seniority: 1, network: 1 }, result: '两年后过夜游客翻了一倍。' },
      { text: '加大宣传', performance: 1, effect: { reputation: 1 }, result: '人来了，体验差，没回头客。' },
      { text: '建大项目', performance: -1, effect: { reputation: -2 }, result: '项目建了，客流撑不住。' },
    ],
  },
  {
    title: '体育事业',
    scene: '群众健身场地不足，赛事经济也没做起来。',
    options: [
      { text: '盘活存量空间，先把身边的场地补上', performance: 3, effect: { reputation: 3, seniority: 1 }, result: '一年后人均场地面积明显提高。' },
      { text: '建大型场馆', performance: 1, effect: { reputation: 1 }, result: '场馆建了，日常利用率低。' },
      { text: '办几场赛事', performance: -1, effect: { reputation: -1 }, result: '赛事办了，没留下东西。' },
    ],
  },
  {
    title: '市场监管',
    scene: '监管力量有限，市场主体多，风险点分散。',
    options: [
      { text: '做信用分级分类监管，把力量压在高风险上', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '监管效能提升，企业干扰减少。' },
      { text: '增加检查频次', performance: 1, effect: { reputation: 1 }, result: '检查多了，企业叫苦，风险没降。' },
      { text: '出了事再查', performance: -2, effect: { reputation: -3 }, result: '出了事，已经晚了。' },
    ],
  },
  {
    title: '知识产权',
    scene: '企业创新能力上来了，但保护和运用跟不上。',
    options: [
      { text: '建快速协同保护和运营体系，帮企业把专利用起来', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '两年后质押融资和许可都起来了。' },
      { text: '打击侵权', performance: 1, effect: { reputation: 1 }, result: '打了，运用还是空白。' },
      { text: '给申请补贴', performance: -1, effect: { reputation: -2 }, result: '专利数量涨了，质量下降。' },
    ],
  },
  {
    title: '安全生产',
    scene: '这条战线的安全基础薄弱，事故时有发生。',
    options: [
      { text: '把责任体系、标准和隐患排查机制一起建起来', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后事故起数明显下降。' },
      { text: '开展专项整治', performance: 1, effect: { reputation: 1 }, result: '整治完又回来。' },
      { text: '追责为主', performance: -1, effect: { reputation: -2, network: -1 }, result: '追责了，基层开始瞒报。' },
    ],
  },
  {
    title: '应急管理',
    scene: '几起事件暴露出预案脱节、演练走过场。',
    options: [
      { text: '重构预案体系，搞不设脚本的实战演练', performance: 3, effect: { reputation: 4, seniority: 2, health: -2 }, result: '下一次实战中响应快了很多。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案厚了一倍，没人会翻。' },
      { text: '配齐装备', performance: -1, effect: { reputation: -1 }, result: '装备有了，人不会用。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '一次灾害预警发出去了，基层响应却慢半拍。',
    options: [
      { text: '把预警到响应的每一步都明确到人和时间', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '下一次预警响应及时，损失很小。' },
      { text: '加强值班', performance: 1, effect: { reputation: 1 }, result: '值班加强了，流程还是不清。' },
      { text: '事后总结', performance: -1, effect: { reputation: -2 }, result: '总结写了，下次还是慢。' },
    ],
  },
  {
    title: '信访工作',
    scene: '一批积案跨部门跨年份，谁都说不该自己办。',
    options: [
      { text: '逐案明确牵头和责任，公开办理时限', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '一年后积案化解了一多半。' },
      { text: '交办下去', performance: 1, effect: { reputation: 1 }, result: '交办了，转了一圈又回来。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '人稳住了，问题堆得更多。' },
    ],
  },
  {
    title: '法治政府',
    scene: '几个行政诉讼案件接连败诉，暴露出程序问题。',
    options: [
      { text: '从败诉案件倒查制度漏洞，把程序规范立起来', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 2 }, result: '第二年败诉率大幅下降。' },
      { text: '要求部门重视', performance: 1, effect: { reputation: 1 }, result: '重视了，还是照旧出错。' },
      { text: '协调法院', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '协调的事被记录下来。' },
    ],
  },
  {
    title: '统计审计',
    scene: '审计指出这条战线有几项资金使用不规范。',
    options: [
      { text: '逐项整改并建制度，主动公开整改结果', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 1 }, result: '整改通过后，后续审计问题少了。' },
      { text: '要求部门整改', performance: 1, effect: { reputation: 1 }, result: '整改报告交了，问题还在。' },
      { text: '说明客观原因', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被认为整改不实。' },
    ],
  },
  {
    title: '政务服务',
    scene: '一件事要跑好几个部门，网上办不通。',
    options: [
      { text: '以"一件事"为单元重构流程，打通数据', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '改革后跑动次数少了一大半。' },
      { text: '增加网上事项', performance: 1, effect: { reputation: 1 }, result: '网上能办了，还是要跑。' },
      { text: '优化大厅', performance: -1, effect: { reputation: -1 }, result: '大厅漂亮了，流程没变。' },
    ],
  },
  {
    title: '数据资源',
    scene: '数据散在各处，想用的时候拿不到。',
    options: [
      { text: '先立共享的硬规矩和责任制，再建平台', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '数据真跑起来了，应用也多了。' },
      { text: '建一个大数据平台', performance: 1, effect: { reputation: 1 }, result: '平台建了，数据还是不进。' },
      { text: '各部门自建', performance: -2, effect: { reputation: -3 }, result: '又多了几个烟囱。' },
    ],
  },
  {
    title: '督查落实',
    scene: '很多部署落不下去，督查一遍又一遍。',
    options: [
      { text: '查清是能力、资源还是动力问题，分别解决', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '半年后落实情况明显好转。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '廉政风险',
    scene: '你分管的领域资金密集、审批集中，风险点多。',
    options: [
      { text: '把流程公开、把权限分散、把留痕做实', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 2 }, result: '这条线两年没有出问题。' },
      { text: '加强教育提醒', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '提醒了，机制没变。' },
      { text: '相信干部', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '出事时，你是分管领导。' },
    ],
  },
  {
    title: '述职述廉',
    scene: '要述职述廉，这一年有亮点也有两件没做好的事。',
    options: [
      { text: '亮点讲够，问题讲透，廉政部分写实', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 2 }, result: '评议很好，问题也没被追问。' },
      { text: '全面讲成绩', performance: 1, effect: { reputation: 1 }, result: '讲完了，没什么印象。' },
      { text: '廉政部分套话', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被要求补充说明。' },
    ],
  },
];
