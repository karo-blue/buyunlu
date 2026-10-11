// 职级 8 · 厅局级正职（正厅级）
//
// 权力边界：主政一方或一个厅。定方向、用干部、扛风险，三件事都是你的。
// 题目围绕"一把手的战略定力、用人导向与风险底线"。
// 50 道。

module.exports = [
  {
    title: '主政一方',
    scene: '到任第一件事，是搞清楚这个地方到底处在什么位置。',
    options: [
      { text: '用两个月跑遍所有县区和主要企业，再定调子', performance: 3, effect: { reputation: 5, seniority: 3 }, result: '两个月后的一次讲话，让全市上下心里有了数。' },
      { text: '先听汇报看材料', performance: 1, effect: { reputation: 1 }, result: '材料看完了，还是没有手感。' },
      { text: '沿用前任的路子', performance: -1, effect: { reputation: -2 }, result: '路子沿用下来了，也没有新局。' },
    ],
  },
  {
    title: '首次全会',
    scene: '第一次主持市委全会，要提出一个新的发展思路。',
    options: [
      { text: '多轮征求意见，把思路磨到能落地为止', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '全会通过，干部知道往哪使劲。' },
      { text: '委托起草', performance: 1, effect: { reputation: 1 }, result: '报告念完了，没人记得住。' },
      { text: '提出一个响亮口号', performance: -1, effect: { reputation: -2 }, result: '口号喊了，事还是那些事。' },
    ],
  },
  {
    title: '城市定位',
    scene: '关于城市定位，几种意见争执多年没有结论。',
    options: [
      { text: '做扎实比较研究，把定位收敛到一两条', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '定位收敛后，资源不再分散。' },
      { text: '折中，都写上', performance: 1, effect: { reputation: 1 }, result: '什么都想做，什么都做不深。' },
      { text: '按新提法换个表述', performance: -1, effect: { reputation: -2 }, result: '表述换了，定位还是模糊。' },
    ],
  },
  {
    title: '战略谋划',
    scene: '一件影响未来十年的大事，现在做代价大，不做以后更被动。',
    options: [
      { text: '做全周期论证，早下决心分步推进', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '十年后看，这一步走得很值。' },
      { text: '再研究研究', performance: 1, effect: { reputation: 1 }, result: '研究了两年，窗口关了。' },
      { text: '留给后任', performance: -2, effect: { reputation: -3 }, result: '后任接手时，代价更大。' },
    ],
  },
  {
    title: '经济工作',
    scene: '经济下行压力大，完成目标和保证质量之间有张力。',
    options: [
      { text: '把力气花在市场主体身上，目标能完成多少算多少', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 2 }, result: '当年增速不高，但两年后反超了。' },
      { text: '全力保目标', performance: 1, effect: { reputation: 1, health: -1 }, result: '目标保住了，后劲不足。' },
      { text: '在数字上下功夫', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计核查时，第一责任人是你。' },
    ],
  },
  {
    title: '财政与债务',
    scene: '财政紧平衡，债务又到了集中偿付期。',
    options: [
      { text: '盘资产、压支出、谈展期，把化债当成硬任务', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 3, health: -2 }, result: '三年后风险等级明显下降。' },
      { text: '保运转优先', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '运转保住了，债还在滚。' },
      { text: '借新还旧', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '窟窿越滚越大。' },
    ],
  },
  {
    title: '干部队伍建设',
    scene: '干部队伍年龄结构老化，能挑大梁的不多。',
    options: [
      { text: '建梯队、压担子、真容错，形成正向循环', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '三年后各层级都有能顶事的人。' },
      { text: '外面调一批', performance: 1, effect: { reputation: 1, network: -1 }, result: '调来了，本地的更没劲。' },
      { text: '用老人顶着', performance: -1, effect: { reputation: -2 }, result: '顶了两年，断层更严重。' },
    ],
  },
  {
    title: '选人用人',
    scene: '一批重要岗位要动，有人递话、有人打招呼。',
    options: [
      { text: '把标准立在前，动议全程留痕，打招呼的一律登记', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 3 }, result: '这批人用得服众，往后递话的人少了。' },
      { text: '平衡各方', performance: 1, effect: { reputation: 1 }, result: '平衡了，能力匹配一般。' },
      { text: '用熟悉的', performance: -3, effect: { reputation: -5, integrity: -4, network: -2 }, result: '圈子一成形，风气就坏了。' },
    ],
  },
  {
    title: '政治生态',
    scene: '这个地方前些年出过事，干部心气不高、怕担责。',
    options: [
      { text: '把界限划清、把规矩立明、把干事的撑起来', performance: 3, effect: { reputation: 5, integrity: 3, network: 3, seniority: 3 }, result: '两年后干部敢干事了，出事的反而少了。' },
      { text: '多讲纪律要求', performance: 1, effect: { reputation: 1 }, result: '纪律讲了，还是没人敢干。' },
      { text: '多讲担当', performance: -1, effect: { reputation: -2 }, result: '担当讲了，边界没人知道在哪。' },
    ],
  },
  {
    title: '全面从严治党',
    scene: '主体责任压得不够实，下面有的单位基本没动。',
    options: [
      { text: '自己先领最难的那份责任，逐级约谈压实', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 2 }, result: '一年后责任体系真正转起来了。' },
      { text: '发文件提要求', performance: 1, effect: { reputation: 1 }, result: '文件发了，没人当回事。' },
      { text: '交给纪委', performance: -1, effect: { reputation: -2 }, result: '纪委扛不动主体责任。' },
    ],
  },
  {
    title: '重大项目',
    scene: '一个超大项目在谈，条件里有超出常规的部分。',
    options: [
      { text: '该请示的请示，能把常规部分先落下来', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 2 }, result: '项目落了地，也没有越线。' },
      { text: '先签下来再补', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '签了，超常规的部分成了麻烦。' },
      { text: '破例抢下来', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '项目来了，审计也跟着来了。' },
    ],
  },
  {
    title: '产业布局',
    scene: '各地都想上同一个热门产业，容易一哄而上。',
    options: [
      { text: '按条件和基础定布局，硬约束写进考核', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '三年后没有出现严重同质化。' },
      { text: '让各地竞争', performance: 1, effect: { reputation: 1 }, result: '竞争的结果是普遍过剩。' },
      { text: '集中到一地做', performance: -1, effect: { reputation: -2, network: -2 }, result: '别的地方从此不配合。' },
    ],
  },
  {
    title: '创新驱动',
    scene: '创新资源不足，投入产出比不高。',
    options: [
      { text: '聚焦有限方向，把平台和成果转化机制做实', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '五年后几个方向真正形成了优势。' },
      { text: '全面加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，成果分散。' },
      { text: '引进几个大机构', performance: -1, effect: { reputation: -2 }, result: '机构来了，和本地产业没关系。' },
    ],
  },
  {
    title: '改革开放',
    scene: '一项改革牵动多方利益，推进阻力很大。',
    options: [
      { text: '先试点再推开，把利益调整方案一起做出来', performance: 3, effect: { reputation: 4, seniority: 3, health: -2 }, result: '一年后全面推开，阻力比预想小。' },
      { text: '强力推开', performance: 1, effect: { reputation: 1, network: -1 }, result: '推开了，反弹也来了。' },
      { text: '先放一放', performance: -2, effect: { reputation: -3 }, result: '放了两年，问题更重。' },
    ],
  },
  {
    title: '营商环境',
    scene: '企业和群众反映最集中的，是政策兑现慢、新官不理旧账。',
    options: [
      { text: '专项清理历史欠账，把兑现纳入硬约束', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 2 }, result: '清完之后，投资信心明显回来了。' },
      { text: '出台新的优惠政策', performance: 1, effect: { reputation: 1 }, result: '新政策出了，旧账还是没人认。' },
      { text: '强调诚信', performance: -1, effect: { reputation: -2 }, result: '强调了，欠账还在。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营企业家信心不足，投资意愿下降。',
    options: [
      { text: '开诚布公座谈，解决一批具体问题并公开', performance: 3, effect: { reputation: 5, network: 4, seniority: 2 }, result: '半年后投资开始回暖。' },
      { text: '出台扶持意见', performance: 1, effect: { reputation: 1 }, result: '意见出了，信心没回来。' },
      { text: '多鼓励多表彰', performance: -1, effect: { reputation: -2 }, result: '表彰了，该走的还是走了。' },
    ],
  },
  {
    title: '城市建设',
    scene: '城市框架拉得很大，但公共服务和产业跟不上。',
    options: [
      { text: '收缩战线，把资源集中到有人气的地方', performance: 3, effect: { reputation: 3, seniority: 3, integrity: 1 }, result: '三年后新城终于有了生活气。' },
      { text: '继续拉框架', performance: 1, effect: { reputation: 1 }, result: '框架更大了，人更少了。' },
      { text: '先做地标', performance: -2, effect: { reputation: -3 }, result: '地标立了，债务也上来了。' },
    ],
  },
  {
    title: '城市治理',
    scene: '城市管理长期靠运动式整治，群众不买账。',
    options: [
      { text: '把标准、责任、经费常态固化，让群众参与评价', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后不用再突击，满意率上去了。' },
      { text: '增加执法力量', performance: 1, effect: { reputation: 1 }, result: '人多了，冲突也多了。' },
      { text: '集中整治', performance: -1, effect: { reputation: -2 }, result: '整治完就回潮。' },
    ],
  },
  {
    title: '乡村振兴',
    scene: '城乡差距仍大，农村空心化在加重。',
    options: [
      { text: '以县域为单元统筹，把产业和公共服务一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '三年后一部分人开始回流。' },
      { text: '继续加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制没变。' },
      { text: '做几个示范村', performance: -1, effect: { reputation: -2 }, result: '示范村很漂亮，面上没变。' },
    ],
  },
  {
    title: '生态环境',
    scene: '环境质量改善进入瓶颈，边际效益下降。',
    options: [
      { text: '转向结构和源头治理，把标准钉死', performance: 3, effect: { reputation: 4, seniority: 2, integrity: 1 }, result: '两年后指标又有了明显改善。' },
      { text: '继续末端治理', performance: 1, effect: { reputation: 1 }, result: '治了，改善越来越难。' },
      { text: '等上级给办法', performance: -2, effect: { reputation: -3 }, result: '等了一年，排名下滑。' },
    ],
  },
  {
    title: '流域治理',
    scene: '流域治理要跨市协调，各地投入和收益不对等。',
    options: [
      { text: '推动建立生态补偿，让保护者不吃亏', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '补偿机制落地，上下游一起动了。' },
      { text: '各自完成各自的任务', performance: 1, effect: { reputation: 1 }, result: '各自达标，整体没改善。' },
      { text: '上游先治', performance: -1, effect: { reputation: -2, network: -2 }, result: '上游不愿意，谈不下去。' },
    ],
  },
  {
    title: '民生保障',
    scene: '财政紧张，民生支出却必须保。',
    options: [
      { text: '重新排优先级，把钱花在最需要的人身上', performance: 3, effect: { reputation: 5, integrity: 2, seniority: 2 }, result: '紧日子里基本民生没出问题。' },
      { text: '各项都压一点', performance: 1, effect: { reputation: 1 }, result: '都压了，最困难的受影响最大。' },
      { text: '先保运转', performance: -2, effect: { reputation: -3 }, result: '民生欠账压不住。' },
    ],
  },
  {
    title: '教育事业',
    scene: '群众对教育的焦虑很重，优质资源不足是根本。',
    options: [
      { text: '用几年时间做实质均衡，教师交流落到人', performance: 3, effect: { reputation: 5, seniority: 3, health: -1 }, result: '五年后择校焦虑明显缓解。' },
      { text: '扩大学位供给', performance: 1, effect: { reputation: 1 }, result: '学位够了，质量差距还在。' },
      { text: '抓升学率', performance: -1, effect: { reputation: -2 }, result: '升学率上去了，负担更重。' },
    ],
  },
  {
    title: '医疗卫生',
    scene: '群众看病还是往外地跑，本地能力不足。',
    options: [
      { text: '做强几个重点专科，同时把基层能力建起来', performance: 3, effect: { reputation: 4, seniority: 2, network: 2 }, result: '三年后外转率明显下降。' },
      { text: '建新医院', performance: 1, effect: { reputation: 1 }, result: '楼起来了，人没招到。' },
      { text: '引进名医', performance: -1, effect: { reputation: -1 }, result: '名医来了又走。' },
    ],
  },
  {
    title: '就业与社保',
    scene: '结构性就业矛盾突出，社保基金压力上升。',
    options: [
      { text: '培训和岗位对接一起做，同时扩大社保覆盖面', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后就业形势稳定，基金也更稳。' },
      { text: '开发公益岗', performance: 1, effect: { reputation: 1 }, result: '岗位有限，结构问题没解。' },
      { text: '提高补贴', performance: -1, effect: { reputation: -2 }, result: '补贴涨了，基金更紧。' },
    ],
  },
  {
    title: '住房问题',
    scene: '房价高、租赁乱、保障不足，几头都压着。',
    options: [
      { text: '供给端多渠道发力，把保障对象和标准钉清楚', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '三年后住房矛盾明显缓和。' },
      { text: '调控需求端', performance: 1, effect: { reputation: 1 }, result: '压了一阵，又反弹。' },
      { text: '先保房价稳定', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '房价稳了，居住问题没解。' },
    ],
  },
  {
    title: '社会治理',
    scene: '矛盾纠纷集中在基层，化解能力却在上面。',
    options: [
      { text: '把资源和力量下沉到一线，把化解做在早', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '两年后越级上访明显减少。' },
      { text: '加强排查', performance: 1, effect: { reputation: 1 }, result: '排查了，化解不了。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '压住了一时，堆得更多。' },
    ],
  },
  {
    title: '平安建设',
    scene: '一类案件高发，群众安全感不高。',
    options: [
      { text: '打防结合，把源头治理和系统防控一起做', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '两年后发案率大幅下降。' },
      { text: '集中打击', performance: 1, effect: { reputation: 1 }, result: '打了一阵又回来。' },
      { text: '增加警力', performance: -1, effect: { reputation: -1 }, result: '人加了，机制没变。' },
    ],
  },
  {
    title: '安全生产',
    scene: '辖区发生较大事故，社会影响很大。',
    options: [
      { text: '第一时间到场指挥，全力救援，如实上报', performance: 3, effect: { reputation: 4, integrity: 2, health: -3 }, result: '处置及时，问责时也有说法。' },
      { text: '先处置再上报', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '被认定迟报漏报。' },
      { text: '控制消息', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '瞒报被查，从重追责。' },
    ],
  },
  {
    title: '应急管理',
    scene: '一次极端天气过程，预警已经发了。',
    options: [
      { text: '提前把人撤出来，宁可十防九空', performance: 3, effect: { reputation: 5, health: -2, seniority: 1 }, result: '这次真的出事了，但没有人员伤亡。' },
      { text: '按预案响应', performance: 1, effect: { reputation: 1 }, result: '响应了，还是有薄弱环节。' },
      { text: '看情况再定', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '等到出事，已经撤不出来了。' },
    ],
  },
  {
    title: '信访稳定',
    scene: '一个群体性诉求规模大、持续时间长。',
    options: [
      { text: '亲自接访，把合理部分和政策边界一次讲清', performance: 3, effect: { reputation: 5, health: -2, seniority: 1 }, result: '签了分批方案，人群散了。' },
      { text: '包案稳控', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '稳住了，问题堆着。' },
      { text: '先压', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '压不住，事情上去。' },
    ],
  },
  {
    title: '风险防范',
    scene: '几个领域的风险交织，已经能闻到味道。',
    options: [
      { text: '建风险台账，一领域一方案，早处置', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 3, health: -2 }, result: '风险逐个拆掉，没有发生系统性事件。' },
      { text: '盯住最急的那个', performance: 1, effect: { reputation: 1 }, result: '最急的稳住了，别的爆了。' },
      { text: '等暴露再说', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '风险集中爆发，很被动。' },
    ],
  },
  {
    title: '金融风险',
    scene: '本地一家金融机构风险暴露，可能外溢。',
    options: [
      { text: '立即介入，制定处置方案并稳定预期', performance: 3, effect: { reputation: 4, integrity: 2, health: -3, seniority: 2 }, result: '风险平稳处置，没有外溢。' },
      { text: '要求机构自救', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '自救失败，风险扩大。' },
      { text: '先捂一捂', performance: -4, effect: { reputation: -6, integrity: -5 }, result: '捂不住，引发挤兑。' },
    ],
  },
  {
    title: '房地产风险',
    scene: '多家房企资金链紧张，交付压力大。',
    options: [
      { text: '逐项目建台账，分类施策并公开进度', performance: 3, effect: { reputation: 5, integrity: 3, health: -2, seniority: 2 }, result: '交付率上去，市场信心回来了一半。' },
      { text: '先救大的', performance: 1, effect: { reputation: 1 }, result: '大的稳了，小的爆了。' },
      { text: '等上级政策', performance: -2, effect: { reputation: -3 }, result: '等到政策，已经耽误了半年。' },
    ],
  },
  {
    title: '政府债务',
    scene: '债务率已经接近警戒线，还有项目要上。',
    options: [
      { text: '坚决不上新项目，把财力集中到化债', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 3 }, result: '三年后债务率降到安全区间。' },
      { text: '边化债边建设', performance: 1, effect: { reputation: 1, integrity: -1 }, result: '两头都不够。' },
      { text: '换个方式继续借', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '隐性债务越积越多。' },
    ],
  },
  {
    title: '统计工作',
    scene: '数据不好看，下面有人开始"想办法"。',
    options: [
      { text: '明确划红线，同时把真实情况向上说清', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 2 }, result: '数据虽然难看，但没有人敢再动。' },
      { text: '不表态', performance: 1, effect: { reputation: 1, integrity: -3 }, result: '下面的动作越来越大。' },
      { text: '默许', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '统计造假立案，一把手首责。' },
    ],
  },
  {
    title: '巡视整改',
    scene: '巡视反馈了一批问题，有的牵扯到人。',
    options: [
      { text: '全面认领，逐项查清，人和事一起处理', performance: 3, effect: { reputation: 4, integrity: 4, seniority: 3 }, result: '整改扎实，评价正面。' },
      { text: '先改事，人缓缓', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '事改了，人还在，问题复发。' },
      { text: '保人', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '回头看时一起翻出。' },
    ],
  },
  {
    title: '法治建设',
    scene: '一项行政行为引发争议，可能经不起复议。',
    options: [
      { text: '请法制部门复查，错了就主动纠正', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 1 }, result: '主动纠错，公信没受影响。' },
      { text: '坚持', performance: 1, effect: { reputation: 1 }, result: '被撤销，很被动。' },
      { text: '做工作撤诉', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '撤诉的事留下了痕迹。' },
    ],
  },
  {
    title: '政府职能转变',
    scene: '政府对微观事务介入太深，市场活力不足。',
    options: [
      { text: '列负面清单，该退的坚决退，同时把监管补上', performance: 3, effect: { reputation: 3, seniority: 3, network: 2 }, result: '退到位后，市场反而活了。' },
      { text: '减少审批事项', performance: 1, effect: { reputation: 1 }, result: '事项少了，变相审批还在。' },
      { text: '加强服务', performance: -1, effect: { reputation: -1 }, result: '服务加强了，还是管得多。' },
    ],
  },
  {
    title: '数字政府',
    scene: '要建城市大脑，投入不小，最怕建成摆设。',
    options: [
      { text: '先解决几个真场景，用起来再扩', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '第一批场景见效后，推广很顺。' },
      { text: '一次建全', performance: 1, effect: { reputation: 1 }, result: '建完了，没人用。' },
      { text: '先建大屏', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '大屏很漂亮，数据不更新。' },
    ],
  },
  {
    title: '督查检查',
    scene: '基层反映督查太多，迎检成了主要工作。',
    options: [
      { text: '先从市委市政府自身砍起，合并同类项', performance: 3, effect: { reputation: 4, seniority: 2 }, result: '砍掉四成后，基层松了一口气。' },
      { text: '规范督查程序', performance: 1, effect: { reputation: 1 }, result: '规范了，数量没减。' },
      { text: '照旧', performance: -1, effect: { reputation: -2 }, result: '基层继续应付。' },
    ],
  },
  {
    title: '基层减负',
    scene: '报表、证明、app 打卡，基层不堪其扰。',
    options: [
      { text: '拉清单逐项清理，删掉一半并公开', performance: 3, effect: { reputation: 5, seniority: 2 }, result: '清理后基层腾出了手，干实事的时间多了。' },
      { text: '要求减少', performance: 1, effect: { reputation: 1 }, result: '要求提了，没人真删。' },
      { text: '先统计', performance: -1, effect: { reputation: -2 }, result: '统计本身又成了负担。' },
    ],
  },
  {
    title: '对外合作',
    scene: '一次重要的对外合作，条件谈得差不多，但对方要求排他。',
    options: [
      { text: '不排他，把合作做成开放的', performance: 3, effect: { reputation: 3, integrity: 2, seniority: 2 }, result: '合作成了，别的伙伴也进来了。' },
      { text: '答应排他', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '答应了，被别的伙伴疏远。' },
      { text: '拖着不决', performance: -1, effect: { reputation: -2 }, result: '对方找了别的地方。' },
    ],
  },
  {
    title: '区域协同',
    scene: '都市圈内部各自为政，要素流动不畅。',
    options: [
      { text: '从最容易见效的公共服务一体化切入', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '一体化有了实感，深水区也好谈了。' },
      { text: '先签框架', performance: 1, effect: { reputation: 1 }, result: '签了很多，落不了地。' },
      { text: '只做对自己有利的', performance: -2, effect: { reputation: -3, network: -3 }, result: '别人也不带你了。' },
    ],
  },
  {
    title: '对口合作',
    scene: '对口合作关系要深化，不能只停留在走访。',
    options: [
      { text: '找产业互补点，做成能造血的长期合作', performance: 3, effect: { reputation: 3, network: 3, seniority: 2 }, result: '合作落地，两边都有收益。' },
      { text: '按要求完成任务', performance: 1, effect: { reputation: 1 }, result: '任务完成了，没有后劲。' },
      { text: '给点资金了事', performance: -2, effect: { reputation: -3 }, result: '钱给了，事情没变。' },
    ],
  },
  {
    title: '重大突发事件',
    scene: '辖区发生重大突发事件，情况还在变化。',
    options: [
      { text: '立即到一线成立指挥部，救人优先，同步如实上报', performance: 3, effect: { reputation: 5, health: -4, seniority: 2, integrity: 2 }, result: '处置有序，损失降到最低。' },
      { text: '在指挥中心调度', performance: 1, effect: { reputation: 1 }, result: '调度了，一线缺主心骨。' },
      { text: '等完整信息再动', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '错过窗口，后果严重。' },
    ],
  },
  {
    title: '舆情应对',
    scene: '一件事演变成全国性舆情，矛头指向这座城市。',
    options: [
      { text: '主动发声，说清事实、表明态度、给出时间表', performance: 3, effect: { reputation: 5, health: -3, integrity: 1 }, result: '一周后舆论转向，处置被评为得当。' },
      { text: '等上级口径', performance: 1, effect: { reputation: 1 }, result: '等到了口径，话题已经换了几轮。' },
      { text: '找渠道压热度', performance: -4, effect: { reputation: -6, integrity: -5 }, result: '压热度本身成了新的话题。' },
    ],
  },
  {
    title: '上级调研',
    scene: '上级主要领导要来，点名要听真话。',
    options: [
      { text: '照实汇报，把困难和请求一起说', performance: 3, effect: { reputation: 5, seniority: 3, integrity: 1 }, result: '领导当场给了支持，还记住了这座城市。' },
      { text: '重点汇报成绩', performance: 1, effect: { reputation: 1 }, result: '汇报完了，什么也没争取到。' },
      { text: '精心准备看点', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '领导临时改路线，很难看。' },
    ],
  },
  {
    title: '班子建设',
    scene: '班子整体不错，但有两件事上分歧公开化了。',
    options: [
      { text: '把分歧摆到桌面上，按规则形成决议后一致执行', performance: 3, effect: { reputation: 4, network: 3, seniority: 3 }, result: '分歧处理完，班子更紧密了。' },
      { text: '分别做工作', performance: 1, effect: { reputation: 1 }, result: '工作做了，分歧没消除。' },
      { text: '回避分歧', performance: -1, effect: { reputation: -2 }, result: '分歧越积越深。' },
    ],
  },
  {
    title: '离任交接',
    scene: '要离开这座城市了，有些事还没做完。',
    options: [
      { text: '把没做完的事、埋下的风险一样样交给接任者', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 2 }, result: '离任多年，这里的人还记得你。' },
      { text: '按程序交接', performance: 1, effect: { reputation: 1 }, result: '交接了，几件事后来爆了。' },
      { text: '只讲成绩', performance: -2, effect: { reputation: -4, integrity: -3 }, result: '接任者吃了暗亏，话说得很难听。' },
    ],
  },
];
