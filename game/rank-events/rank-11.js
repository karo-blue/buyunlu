// 职级 11 · 国家级副职（副国级）
//
// 权力边界：顶层统筹。主要工作是制度供给、全局平衡和重大政策的取舍。
// 不再有"办成一件事"，只有"让整个系统长期朝哪个方向走"。
// 题目围绕"全局权衡、制度设计与长期主义"。
// 50 道。

module.exports = [
  {
    title: '顶层设计',
    scene: '一项制度设计要定稿，几种方案各有利弊，影响面都很大。',
    options: [
      { text: '多方案比选并做小范围试算，把不可逆的部分单独论证', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 1 }, result: '制度落地后运行平稳，十年没大改。' },
      { text: '采纳主流意见', performance: 1, effect: { reputation: 1 }, result: '定了，执行中不断打补丁。' },
      { text: '取一个折中版本', performance: -1, effect: { reputation: -2 }, result: '折中的结果是谁都不满意。' },
    ],
  },
  {
    title: '全局平衡',
    scene: '东部要效率、西部要公平，双方都拿着充分的理由。',
    options: [
      { text: '建立可量化的平衡规则，让取舍有依据', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '规则一定，争论就变成了执行。' },
      { text: '照顾弱势一方', performance: 1, effect: { reputation: 1 }, result: '公平兼顾了，效率下来了。' },
      { text: '谁呼声高给谁', performance: -2, effect: { reputation: -3, network: -2 }, result: '两边都不满意。' },
    ],
  },
  {
    title: '重大政策',
    scene: '一项重大政策要出台，短期有阵痛、长期看必要。',
    options: [
      { text: '把阵痛期和配套安排一起设计好再推出', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '政策推出后平稳落地，三年见效。' },
      { text: '先推出再看', performance: 1, effect: { reputation: 1 }, result: '推出了，阵痛期很难熬。' },
      { text: '等条件成熟', performance: -2, effect: { reputation: -3 }, result: '等了几年，问题更重。' },
    ],
  },
  {
    title: '制度供给',
    scene: '一个领域长期靠文件和运动推动，缺的是制度。',
    options: [
      { text: '把权责、激励、约束一起写进制度', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '制度一立，运动式的推动就少了。' },
      { text: '再发一个文件', performance: 1, effect: { reputation: 1 }, result: '文件发了，还是老样子。' },
      { text: '加强督促', performance: -1, effect: { reputation: -2 }, result: '督促一阵好一阵。' },
    ],
  },
  {
    title: '国家战略',
    scene: '一个国家级战略要定方向，若干路径都讲得通。',
    options: [
      { text: '做长周期推演，把不可逆的选择单独标识', performance: 3, effect: { reputation: 5, seniority: 5 }, result: '十年后看，方向选对了。' },
      { text: '采纳多数专家意见', performance: 1, effect: { reputation: 1 }, result: '定了，争议还在。' },
      { text: '跟着热点', performance: -2, effect: { reputation: -3 }, result: '热点一过，留下沉没成本。' },
    ],
  },
  {
    title: '中长期规划',
    scene: '规划编制中，各方都想把自己的事写进去。',
    options: [
      { text: '按战略优先级收敛，写进去的必须有指标和路径', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '规划落地率高，五年后对照看很准。' },
      { text: '尽量兼顾', performance: 1, effect: { reputation: 1 }, result: '兼顾的结果是重点模糊。' },
      { text: '把目标写得高一些', performance: -1, effect: { reputation: -2 }, result: '目标很高，完成不了。' },
    ],
  },
  {
    title: '区域战略',
    scene: '几大区域战略并行，需要防止碎片化。',
    options: [
      { text: '明确各自功能定位，建立跨区域协调机制', performance: 3, effect: { reputation: 4, seniority: 5, network: 4 }, result: '五年后区域格局协同明显。' },
      { text: '各推各的', performance: 1, effect: { reputation: 1 }, result: '战略很多，合力没有。' },
      { text: '资源整合到一起', performance: -1, effect: { reputation: -2, network: -2 }, result: '整合了，地方的积极性没了。' },
    ],
  },
  {
    title: '产业安全',
    scene: '若干关键环节对外依赖度高，存在被"卡"的风险。',
    options: [
      { text: '分级分类梳理，对真正卡脖子的集中力量、长期投入', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 1 }, result: '十年后关键环节基本可控。' },
      { text: '全面自主', performance: 1, effect: { reputation: 1 }, result: '摊子铺太大，进展缓慢。' },
      { text: '继续买', performance: -3, effect: { reputation: -5, integrity: -2 }, result: '断供时非常被动。' },
    ],
  },
  {
    title: '科技自立',
    scene: '基础研究薄弱，投入周期长、见效慢。',
    options: [
      { text: '建立稳定支持机制，让科研人员能坐十年冷板凳', performance: 3, effect: { reputation: 5, seniority: 5 }, result: '十年后基础研究的底子明显厚了。' },
      { text: '加大项目投入', performance: 1, effect: { reputation: 1 }, result: '项目多了，还是追热点。' },
      { text: '引进消化', performance: -1, effect: { reputation: -2 }, result: '引进了，核心还是没拿到。' },
    ],
  },
  {
    title: '人才体系',
    scene: '人才评价和使用机制僵化，评价导向偏颇。',
    options: [
      { text: '分类评价、破"唯"，把舞台和待遇给真正做事的人', performance: 3, effect: { reputation: 4, seniority: 4, network: 3 }, result: '五年后人才活力明显释放。' },
      { text: '提高待遇', performance: 1, effect: { reputation: 1 }, result: '待遇涨了，导向没变。' },
      { text: '增加头衔', performance: -1, effect: { reputation: -2 }, result: '头衔多了，做事的没多。' },
    ],
  },
  {
    title: '创新体系',
    scene: '产学研脱节，科研成果和产业需求对不上。',
    options: [
      { text: '让企业真正成为出题人和出资人，改革评价与分配', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后转化率和产业支撑明显提升。' },
      { text: '建更多平台', performance: 1, effect: { reputation: 1 }, result: '平台更多了，还是各干各的。' },
      { text: '加大奖励', performance: -1, effect: { reputation: -1 }, result: '奖励发了，机制没动。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '要在资源约束下长期保住粮食安全。',
    options: [
      { text: '保耕地、推技术、稳收益三件事一起抓', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 2 }, result: '十年后产能和收益都稳住了。' },
      { text: '提高收购价', performance: 1, effect: { reputation: 1 }, result: '价格提了，成本也上来了。' },
      { text: '靠进口调剂', performance: -3, effect: { reputation: -5, integrity: -2 }, result: '国际市场一波动就很被动。' },
    ],
  },
  {
    title: '能源安全',
    scene: '能源保供、低碳转型、成本控制三头挤压。',
    options: [
      { text: '先立后破，构建多元供应体系再推进转型', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '十年后供应稳、结构也优了。' },
      { text: '保供优先', performance: 1, effect: { reputation: 1 }, result: '保住了，转型滞后。' },
      { text: '转型优先', performance: -2, effect: { reputation: -3 }, result: '转型快了，供应吃紧。' },
    ],
  },
  {
    title: '产业链供应链',
    scene: '产业链出现外迁迹象，同时也有升级的窗口。',
    options: [
      { text: '区分可转移和必须留住的，用升级对冲外迁', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '五年后链条整体向上走了一级。' },
      { text: '用成本优势留住', performance: 1, effect: { reputation: 1 }, result: '留住了低端，高端没起来。' },
      { text: '限制流出', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '限制反而加速了转移。' },
    ],
  },
  {
    title: '金融稳定',
    scene: '几个领域的风险有联动迹象。',
    options: [
      { text: '建立跨部门监测和处置机制，早识别早干预', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 4, health: -2 }, result: '风险被逐个拆掉，没有发生系统性事件。' },
      { text: '盯住最急的', performance: 1, effect: { reputation: 1 }, result: '最急的稳住了，别的爆了。' },
      { text: '等暴露了再处置', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '风险集中爆发，代价巨大。' },
    ],
  },
  {
    title: '财政体制',
    scene: '中央与地方、地方各级之间的财政关系需要理顺。',
    options: [
      { text: '先划清事权与支出责任，再匹配财力', performance: 3, effect: { reputation: 4, seniority: 5, network: 3 }, result: '体制理顺后，基层运转明显改善。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '钱给了，机制没变。' },
      { text: '维持现状', performance: -2, effect: { reputation: -3 }, result: '矛盾继续积累。' },
    ],
  },
  {
    title: '税收制度',
    scene: '要推进一项税制改革，牵动各方利益。',
    options: [
      { text: '先立法后实施，给过渡期和明确预期', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '改革平稳落地，预期稳定。' },
      { text: '先试点', performance: 1, effect: { reputation: 1 }, result: '试点了很久，没推开。' },
      { text: '一步到位', performance: -2, effect: { reputation: -3, network: -2 }, result: '震动太大，执行走样。' },
    ],
  },
  {
    title: '对外开放',
    scene: '外部环境变化，开放的节奏和方式需要重新设计。',
    options: [
      { text: '稳步扩大制度型开放，同时把安全边界划清', performance: 3, effect: { reputation: 5, seniority: 5, network: 4 }, result: '五年后开放质量明显提升。' },
      { text: '加大优惠力度', performance: 1, effect: { reputation: 1 }, result: '优惠给了，规则没变。' },
      { text: '收缩防守', performance: -2, effect: { reputation: -3, network: -3 }, result: '收缩之后，机会也少了。' },
    ],
  },
  {
    title: '对外经贸',
    scene: '外部需求走弱，贸易结构也需要调整。',
    options: [
      { text: '拓市场、调结构，同时把通关和融资等服务做实', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '三年后贸易结构和韧性都改善了。' },
      { text: '加大出口补贴', performance: 1, effect: { reputation: 1 }, result: '补贴给了，结构没变。' },
      { text: '等外部回暖', performance: -2, effect: { reputation: -3 }, result: '等来了更多订单转移。' },
    ],
  },
  {
    title: '营商环境',
    scene: '经营主体信心不足，制度性成本偏高。',
    options: [
      { text: '从法律和制度层面稳定预期，把制度性成本降下来', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 3 }, result: '三年后主体数量和投资意愿都回升。' },
      { text: '出台一批扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，信心没回来。' },
      { text: '多开会多鼓励', performance: -1, effect: { reputation: -2 }, result: '会开了，问题还在。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营经济预期不稳，需要制度性回应。',
    options: [
      { text: '把平等保护和产权保护做实，清理一批存量问题', performance: 3, effect: { reputation: 5, network: 5, seniority: 4, integrity: 2 }, result: '两年后民间投资明显回暖。' },
      { text: '出台支持意见', performance: 1, effect: { reputation: 1 }, result: '意见出了，预期没稳。' },
      { text: '多宣传多表彰', performance: -1, effect: { reputation: -2 }, result: '表彰了，该观望的还是观望。' },
    ],
  },
  {
    title: '国资国企',
    scene: '国资布局与新时代要求不完全匹配。',
    options: [
      { text: '按功能分类，向关键领域集中，同时把机制转起来', performance: 3, effect: { reputation: 3, seniority: 5, integrity: 1 }, result: '五年后国资的战略支撑作用明显增强。' },
      { text: '继续做大', performance: 1, effect: { reputation: 1 }, result: '规模上去了，效率没变。' },
      { text: '全面退出竞争性领域', performance: -1, effect: { reputation: -2, network: -1 }, result: '退了，战略支撑也弱了。' },
    ],
  },
  {
    title: '统一大市场',
    scene: '地方保护和区域壁垒仍然存在。',
    options: [
      { text: '从制度上立规矩，清理一批妨碍公平的做法', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 3 }, result: '三年后要素流动明显顺畅。' },
      { text: '发通知要求清理', performance: 1, effect: { reputation: 1 }, result: '通知发了，壁垒还在。' },
      { text: '先做个案协调', performance: -1, effect: { reputation: -2 }, result: '个案协调不完。' },
    ],
  },
  {
    title: '市场竞争',
    scene: '一些领域出现不正当竞争和集中度过高的苗头。',
    options: [
      { text: '完善规则并依法监管，同时给各类主体公平机会', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 3 }, result: '三年后市场秩序明显改善。' },
      { text: '加强处罚', performance: 1, effect: { reputation: 1 }, result: '罚了，规则还是模糊。' },
      { text: '扶大做强', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '集中度更高，创新反而少了。' },
    ],
  },
  {
    title: '要素市场化',
    scene: '土地、劳动力、资本、技术等要素配置仍有扭曲。',
    options: [
      { text: '逐项破题，把价格形成和流动机制建起来', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 1 }, result: '五年后要素配置效率明显提高。' },
      { text: '先做最容易的一项', performance: 1, effect: { reputation: 1 }, result: '做了一项，别的还是扭曲。' },
      { text: '维持行政配置', performance: -2, effect: { reputation: -3 }, result: '扭曲继续，效率损失。' },
    ],
  },
  {
    title: '价格机制',
    scene: '一些关键领域的价格没有反映成本和稀缺程度。',
    options: [
      { text: '分步理顺，同时给困难群体兜底', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '理顺后资源配置改善，也没有引发波动。' },
      { text: '一步放开', performance: 1, effect: { reputation: 1, network: -1 }, result: '放开了，短期波动很大。' },
      { text: '继续管着', performance: -1, effect: { reputation: -2 }, result: '管着，短缺和浪费并存。' },
    ],
  },
  {
    title: '就业优先',
    scene: '结构性矛盾突出，新技术又在改变岗位结构。',
    options: [
      { text: '培训体系跟着产业走，同时织密重点群体帮扶网', performance: 3, effect: { reputation: 4, seniority: 4, health: -1 }, result: '三年后结构性矛盾明显缓解。' },
      { text: '扩大岗位供给', performance: 1, effect: { reputation: 1 }, result: '岗位多了，还是不匹配。' },
      { text: '靠增长自然解决', performance: -1, effect: { reputation: -2 }, result: '增长了，结构性失业还在。' },
    ],
  },
  {
    title: '社会保障',
    scene: '人口结构变化给社会保障体系带来长期压力。',
    options: [
      { text: '做長期精算，把制度参数调整和多层次体系一起推', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '十年后体系可持续明显增强。' },
      { text: '提高当期待遇', performance: 1, effect: { reputation: 1 }, result: '待遇涨了，压力更大。' },
      { text: '逐年打补丁', performance: -1, effect: { reputation: -2 }, result: '补丁越打越乱。' },
    ],
  },
  {
    title: '教育强国',
    scene: '教育体系与人口变化、产业需求都不匹配。',
    options: [
      { text: '跟着需求和人口趋势调整结构，把质量放在规模前面', performance: 3, effect: { reputation: 4, seniority: 5, health: -2 }, result: '十年后人力资源与需求更匹配。' },
      { text: '继续扩招', performance: 1, effect: { reputation: 1 }, result: '规模上去了，就业更难。' },
      { text: '集中资源办顶尖', performance: -1, effect: { reputation: -2 }, result: '顶尖强了，整体没变。' },
    ],
  },
  {
    title: '健康中国',
    scene: '医疗资源分布不均，慢性病负担上升。',
    options: [
      { text: '把重心下沉到预防和基层，同时保留攻坚能力', performance: 3, effect: { reputation: 5, seniority: 5, health: -2 }, result: '十年后主要健康指标明显改善。' },
      { text: '增加医疗供给', performance: 1, effect: { reputation: 1 }, result: '供给涨了，预防还是薄弱。' },
      { text: '提高报销比例', performance: -1, effect: { reputation: -1 }, result: '报得多了，基金更紧。' },
    ],
  },
  {
    title: '人口发展',
    scene: '人口结构变化带来一系列长期影响。',
    options: [
      { text: '从生育支持、养育成本、老龄服务系统施策', performance: 3, effect: { reputation: 4, seniority: 5, health: -2 }, result: '十年后结构性压力有所缓解。' },
      { text: '给生育补贴', performance: 1, effect: { reputation: 1 }, result: '补贴给了，效果有限。' },
      { text: '先看看趋势', performance: -2, effect: { reputation: -3 }, result: '看着看着，窗口期过了。' },
    ],
  },
  {
    title: '住房制度',
    scene: '住房问题关系民生与风险，两端都要顾。',
    options: [
      { text: '建立多主体供给、多渠道保障的制度框架', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '十年后住房矛盾与风险都明显缓解。' },
      { text: '扩大保障性供给', performance: 1, effect: { reputation: 1 }, result: '供给有了，机制没理顺。' },
      { text: '稳定市场优先', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '市场稳了，结构问题还在。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '城乡差距长期存在，需要长效机制。',
    options: [
      { text: '以县域为单元，把产业、服务和要素流动一起做', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '十年后城乡差距明显收敛。' },
      { text: '继续加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制没变。' },
      { text: '做一批示范', performance: -1, effect: { reputation: -2 }, result: '示范很漂亮，面上没变。' },
    ],
  },
  {
    title: '城乡融合',
    scene: '要素向城市单向流动的局面没有根本改变。',
    options: [
      { text: '打通双向流动的制度通道，让进城和返乡都顺畅', performance: 3, effect: { reputation: 4, seniority: 5, network: 2 }, result: '五年后要素双向流动开始形成。' },
      { text: '鼓励进城落户', performance: 1, effect: { reputation: 1 }, result: '人进了城，农村更空。' },
      { text: '限制流动', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '限制的结果是谁都不满意。' },
    ],
  },
  {
    title: '生态文明',
    scene: '生态保护与发展的关系需要制度性安排。',
    options: [
      { text: '把红线、补偿、考核三件事一起做成制度', performance: 3, effect: { reputation: 5, seniority: 5, integrity: 3 }, result: '十年后保护与发展真正协调起来。' },
      { text: '加强督察', performance: 1, effect: { reputation: 1 }, result: '督察了，反弹还在。' },
      { text: '以项目推动', performance: -1, effect: { reputation: -2 }, result: '项目完了，机制没留下。' },
    ],
  },
  {
    title: '双碳目标',
    scene: '降碳目标与能源安全、经济增长存在张力。',
    options: [
      { text: '先立后破，把市场机制和核算体系先建起来', performance: 3, effect: { reputation: 5, seniority: 5, health: -2, integrity: 1 }, result: '十年后转型平稳，也守住了安全。' },
      { text: '层层分解压下去', performance: 1, effect: { reputation: 1, network: -1 }, result: '压下去了，出现了运动式减碳。' },
      { text: '顺其自然', performance: -2, effect: { reputation: -3 }, result: '十年后目标差距很大。' },
    ],
  },
  {
    title: '资源节约',
    scene: '资源利用效率不高，浪费与短缺并存。',
    options: [
      { text: '建立全流程的节约制度和循环利用体系', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '五年后利用效率明显提高。' },
      { text: '开展节约行动', performance: 1, effect: { reputation: 1 }, result: '行动一阵，之后照旧。' },
      { text: '靠价格调节', performance: -1, effect: { reputation: -1 }, result: '价格手段单一，效果有限。' },
    ],
  },
  {
    title: '流域治理',
    scene: '大江大河的治理涉及上下游、左右岸、干支流。',
    options: [
      { text: '建立统一规划、统一标准、联合调度的机制', performance: 3, effect: { reputation: 4, seniority: 5, network: 4 }, result: '十年后流域生态明显恢复。' },
      { text: '分段治理', performance: 1, effect: { reputation: 1 }, result: '各段达标，整体没变。' },
      { text: '先治重点段', performance: -1, effect: { reputation: -2 }, result: '重点段好了，别的还在恶化。' },
    ],
  },
  {
    title: '基础设施',
    scene: '基础设施网络需要整体优化，重复建设和短板并存。',
    options: [
      { text: '按网络效益统筹规划，把衔接和集约放在前面', performance: 3, effect: { reputation: 3, seniority: 5, integrity: 1 }, result: '十年后网络效率明显提高。' },
      { text: '各地按需建设', performance: 1, effect: { reputation: 1 }, result: '建了不少，衔接不畅。' },
      { text: '多上项目', performance: -2, effect: { reputation: -3 }, result: '重复建设，债务积累。' },
    ],
  },
  {
    title: '数字建设',
    scene: '数字化转型纵深推进，数据要素的价值还没释放。',
    options: [
      { text: '先把产权、流通、安全的制度建起来再谈应用', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '五年后数据要素市场真正运转起来。' },
      { text: '大规模建平台', performance: 1, effect: { reputation: 1 }, result: '平台建了，数据不流通。' },
      { text: '先抓安全', performance: -1, effect: { reputation: -2 }, result: '安全抓了，应用停摆。' },
    ],
  },
  {
    title: '统计制度',
    scene: '统计数据的真实性和口径一致性存在问题。',
    options: [
      { text: '改革核算制度并严肃查处造假，把真实性立起来', performance: 3, effect: { reputation: 4, integrity: 6, seniority: 4 }, result: '三年后数据质量明显提升。' },
      { text: '加强核查', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '核查了，源头没改。' },
      { text: '口径统一就行', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '口径统一了，真实性没解决。' },
    ],
  },
  {
    title: '法治建设',
    scene: '一些领域的法律供给滞后于实践。',
    options: [
      { text: '加快立法并严格执法，把权力关进制度的笼子', performance: 3, effect: { reputation: 4, integrity: 5, seniority: 5 }, result: '五年后法治环境明显改善。' },
      { text: '先出规范性文件', performance: 1, effect: { reputation: 1 }, result: '文件出了，效力不足。' },
      { text: '靠政策调节', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '政策多变，预期不稳。' },
    ],
  },
  {
    title: '社会治理',
    scene: '社会结构深刻变化，治理体系需要相应调整。',
    options: [
      { text: '把重心下沉到基层，同时用法治和自治做支撑', performance: 3, effect: { reputation: 4, seniority: 5 }, result: '五年后基层治理能力明显增强。' },
      { text: '加强管控', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '管控加强了，活力下降。' },
      { text: '靠投入解决', performance: -1, effect: { reputation: -2 }, result: '投入涨了，机制没变。' },
    ],
  },
  {
    title: '公共安全',
    scene: '公共安全形势复杂，新风险不断出现。',
    options: [
      { text: '建立风险监测预警和协同处置体系，把防线前移', performance: 3, effect: { reputation: 4, seniority: 4, health: -2 }, result: '五年后重大公共安全事件明显减少。' },
      { text: '出了事再处置', performance: 1, effect: { reputation: 1 }, result: '处置及时，损失已经造成。' },
      { text: '加强安保', performance: -1, effect: { reputation: -1 }, result: '安保加强了，源头没管。' },
    ],
  },
  {
    title: '应急体系',
    scene: '巨灾情景下的应急能力还有明显短板。',
    options: [
      { text: '按最不利情景做预案并实战演练，建区域协同机制', performance: 3, effect: { reputation: 5, seniority: 5, health: -3 }, result: '下一次巨灾中，响应和协同明显改善。' },
      { text: '完善预案文本', performance: 1, effect: { reputation: 1 }, result: '文本完善了，没练过。' },
      { text: '增加储备', performance: -1, effect: { reputation: -1 }, result: '储备有了，调不动。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '极端天气常态化，需要新的防灾思路。',
    options: [
      { text: '把韧性理念纳入规划和建设标准', performance: 3, effect: { reputation: 4, seniority: 5, health: -1 }, result: '十年后城市和区域的韧性明显增强。' },
      { text: '加强工程建设', performance: 1, effect: { reputation: 1 }, result: '工程建了，标准不统一。' },
      { text: '加强救灾', performance: -1, effect: { reputation: -2 }, result: '救灾及时，损失已经造成。' },
    ],
  },
  {
    title: '风险防范',
    scene: '多重风险交织，需要系统性的防范框架。',
    options: [
      { text: '建风险台账和处置预案，压实各方责任', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 5, health: -2 }, result: '风险逐个化解，没有发生系统性事件。' },
      { text: '盯住最紧迫的', performance: 1, effect: { reputation: 1 }, result: '最紧的稳了，别的爆了。' },
      { text: '等风险暴露', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '风险集中爆发，代价巨大。' },
    ],
  },
  {
    title: '调查研究',
    scene: '一项政策在文件上很完美，基层反映完全不是那么回事。',
    options: [
      { text: '自己下去看，不带陪同、不看安排好的点', performance: 3, effect: { reputation: 5, seniority: 4, integrity: 2, health: -2 }, result: '看到了真相，政策做了重大调整。' },
      { text: '开座谈会听意见', performance: 1, effect: { reputation: 1 }, result: '听到了想听的话。' },
      { text: '要求下面报情况', performance: -2, effect: { reputation: -3 }, result: '报上来的情况很全面，也很假。' },
    ],
  },
  {
    title: '督查落实',
    scene: '很多决策在最后一公里变形走样。',
    options: [
      { text: '从制度上减少层级、明确责任、公开结果', performance: 3, effect: { reputation: 4, seniority: 5, integrity: 2 }, result: '两年后落实情况明显改善。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你所在的位置，意味着无数双眼睛和无数种试探。',
    options: [
      { text: '把制度笼子扎紧，自己主动回避和报备，从不例外', performance: 3, effect: { reputation: 4, integrity: 6, seniority: 4 }, result: '多年以后回看，这一条护住了你。' },
      { text: '严格要求自己', performance: 1, effect: { reputation: 1, integrity: 2 }, result: '自己严了，身边没管住。' },
      { text: '相信身边人', performance: -5, effect: { reputation: -6, integrity: -6 }, result: '出事时，是从身边开的口子。' },
    ],
  },
];
