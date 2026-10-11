// 职级 9 · 省部级副职（副部级）
//
// 权力边界：统筹全省一条线。主要工作不再是办具体事，而是定规则、配资源、
// 建机制、抓落实。题目围绕"制度设计与全省尺度的取舍"。
// 50 道。

module.exports = [
  {
    title: '分管领域',
    scene: '分工下来，你分管一条覆盖全省、横跨十几个部门的线。',
    options: [
      { text: '先跑一圈市县，把省情和市情的差距摸清楚', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '半年后出台的政策，落地率明显高。' },
      { text: '先听部门汇报', performance: 1, effect: { reputation: 1 }, result: '听到了省级视角，基层视角没有。' },
      { text: '沿用原有政策框架', performance: -1, effect: { reputation: -2 }, result: '沿用了，问题也沿用了。' },
    ],
  },
  {
    title: '首次常务会',
    scene: '第一次上省政府常务会，议题是你分管领域的。',
    options: [
      { text: '会前把各方意见都谈过，把风险点想全', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '议题一次通过，也没有后遗症。' },
      { text: '会上解释', performance: 1, effect: { reputation: 1 }, result: '解释了，被要求补充论证。' },
      { text: '请主要领导定', performance: -1, effect: { reputation: -2 }, result: '定了，部门心里不服。' },
    ],
  },
  {
    title: '全省布局',
    scene: '一条产业线在全省怎么摆，各市都在争。',
    options: [
      { text: '按资源禀赋和环境容量定布局，配套差异化考核', performance: 3, effect: { reputation: 4, seniority: 4, network: 2 }, result: '五年后没有出现全省性过剩。' },
      { text: '让各市竞争', performance: 1, effect: { reputation: 1 }, result: '竞争的结果是遍地开花、普遍不强。' },
      { text: '集中在省会', performance: -2, effect: { reputation: -3, network: -3 }, result: '别的地方从此不配合。' },
    ],
  },
  {
    title: '政策制定',
    scene: '要出台一项全省性政策，各地情况差别很大。',
    options: [
      { text: '给原则和目标，给地方留足因地制宜的空间', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '政策落地后，各地都找到了自己的做法。' },
      { text: '全省一刀切', performance: 1, effect: { reputation: 1 }, result: '切了，一半地方执行不了。' },
      { text: '写得很原则', performance: -1, effect: { reputation: -2 }, result: '文件发了，没人知道怎么干。' },
    ],
  },
  {
    title: '制度设计',
    scene: '一个老大难问题，根子上是机制没理顺。',
    options: [
      { text: '从权责和激励两头改，把机制先建起来', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '机制一顺，问题自己就少了。' },
      { text: '加大投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，机制还是那样。' },
      { text: '加强考核', performance: -1, effect: { reputation: -2 }, result: '考核多了，数据好看了。' },
    ],
  },
  {
    title: '重大改革',
    scene: '一项改革涉及多方利益，牵一发动全身。',
    options: [
      { text: '先选不同类型的地方试点，再提炼推开', performance: 3, effect: { reputation: 5, seniority: 4, health: -2 }, result: '两年后全面推开，没有大的震荡。' },
      { text: '全省一次推开', performance: 1, effect: { reputation: 1, network: -1 }, result: '推开了，反弹很厉害。' },
      { text: '先出方案', performance: -1, effect: { reputation: -2 }, result: '方案出了一年，没动。' },
    ],
  },
  {
    title: '跨市协调',
    scene: '一件跨市的事，各方都想少出钱多受益。',
    options: [
      { text: '先把成本收益算清，按受益比例定分担', performance: 3, effect: { reputation: 4, network: 4, seniority: 3 }, result: '分担机制一定，事就推得动了。' },
      { text: '省级兜底', performance: 1, effect: { reputation: 1 }, result: '兜了底，地方以后都往上推。' },
      { text: '让各地协商', performance: -1, effect: { reputation: -2 }, result: '协商了两年没结果。' },
    ],
  },
  {
    title: '要素配置',
    scene: '土地、能耗、资金都紧，好项目等不起。',
    options: [
      { text: '建全省统一的要素配置规则和优先级', performance: 3, effect: { reputation: 3, integrity: 3, seniority: 3 }, result: '要素流动起来，好项目不再排队。' },
      { text: '谁急给谁', performance: 1, effect: { reputation: 1 }, result: '给了，事后常有争议。' },
      { text: '平均分配', performance: -2, effect: { reputation: -3 }, result: '谁都不够用。' },
    ],
  },
  {
    title: '重大基础设施',
    scene: '一个跨区域重大工程，投资大、周期长、争议多。',
    options: [
      { text: '做全周期论证，把反对意见写进决策材料', performance: 3, effect: { reputation: 4, seniority: 4, integrity: 1 }, result: '十年后看，这个工程改变了格局。' },
      { text: '分段实施', performance: 1, effect: { reputation: 1 }, result: '分段做了，效益打折。' },
      { text: '先做争议小的', performance: -1, effect: { reputation: -2 }, result: '关键那一段一直卡着。' },
    ],
  },
  {
    title: '产业规划',
    scene: '要定全省的主导产业方向，几个方向都有道理。',
    options: [
      { text: '做扎实的比较研究，收敛到两三个方向长期投入', performance: 3, effect: { reputation: 4, seniority: 4 }, result: '五年后这几个方向真成了气候。' },
      { text: '都列为重点', performance: 1, effect: { reputation: 1 }, result: '重点太多等于没有重点。' },
      { text: '跟着热点走', performance: -2, effect: { reputation: -3 }, result: '热点一过，留下的是过剩。' },
    ],
  },
  {
    title: '科技创新体系',
    scene: '全省创新资源分散，成果转化不畅。',
    options: [
      { text: '重构平台体系，让企业出题、全省答题', performance: 3, effect: { reputation: 4, seniority: 4, network: 2 }, result: '五年后转化率明显提高。' },
      { text: '增加财政投入', performance: 1, effect: { reputation: 1 }, result: '投入涨了，产出分散。' },
      { text: '引进大院大所', performance: -1, effect: { reputation: -2 }, result: '牌子挂了，跟产业没关系。' },
    ],
  },
  {
    title: '人才工作',
    scene: '各地抢人，政策层层加码，效果越来越差。',
    options: [
      { text: '省级统筹，按产业需求定清单，避免内耗', performance: 3, effect: { reputation: 4, seniority: 3, network: 3 }, result: '三年后人才结构与产业更匹配。' },
      { text: '加大补贴力度', performance: 1, effect: { reputation: 1 }, result: '补贴涨了，人还是留不住。' },
      { text: '各地各抢各的', performance: -2, effect: { reputation: -3, network: -2 }, result: '内耗严重，财政白花。' },
    ],
  },
  {
    title: '对外开放',
    scene: '开放平台不少，但能级不高、联动不够。',
    options: [
      { text: '整合平台功能，打通口岸与产业的联系', performance: 3, effect: { reputation: 4, seniority: 3, network: 3 }, result: '三年后外贸结构明显优化。' },
      { text: '再建新平台', performance: 1, effect: { reputation: 1 }, result: '平台更多了，还是散。' },
      { text: '给更多优惠', performance: -1, effect: { reputation: -2 }, result: '优惠给了，能级没提升。' },
    ],
  },
  {
    title: '招商引资',
    scene: '全省招商各自为战，甚至互相挖项目。',
    options: [
      { text: '建全省招商信息平台和流转机制', performance: 3, effect: { reputation: 3, seniority: 3, network: 3 }, result: '内耗没了，落地率提高。' },
      { text: '下达指标', performance: 1, effect: { reputation: 1 }, result: '指标完成了，质量下降。' },
      { text: '谁招到算谁的', performance: -2, effect: { reputation: -3, network: -2 }, result: '挖得更厉害了。' },
    ],
  },
  {
    title: '营商环境',
    scene: '全省营商环境评价靠后，企业反映最集中的是执法不公。',
    options: [
      { text: '从规范执法和兑现承诺两头改，全省统一标准', performance: 3, effect: { reputation: 5, integrity: 3, seniority: 3 }, result: '三年后排名大幅前移。' },
      { text: '出台政策包', performance: 1, effect: { reputation: 1 }, result: '政策包发了，感受没变。' },
      { text: '抓评价应对', performance: -2, effect: { reputation: -3, integrity: -3 }, result: '名次上去了，企业还在跑。' },
    ],
  },
  {
    title: '民营经济',
    scene: '民营投资意愿不足，信心问题是关键。',
    options: [
      { text: '清理拖欠账款和旧账，给稳定预期', performance: 3, effect: { reputation: 5, network: 4, seniority: 3 }, result: '清完之后，投资开始回暖。' },
      { text: '出台扶持政策', performance: 1, effect: { reputation: 1 }, result: '政策出了，信心没回来。' },
      { text: '多开座谈会', performance: -1, effect: { reputation: -2 }, result: '会开了，问题还是那些问题。' },
    ],
  },
  {
    title: '国资国企',
    scene: '省属国企布局分散，主业不聚焦。',
    options: [
      { text: '按功能分类重组，该退的退、该强的强', performance: 3, effect: { reputation: 3, seniority: 4, integrity: 1 }, result: '三年后省属国企整体竞争力提升。' },
      { text: '换一批负责人', performance: 1, effect: { reputation: 1 }, result: '人换了，布局没变。' },
      { text: '继续做大规模', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '规模上去了，效益下来了。' },
    ],
  },
  {
    title: '金融工作',
    scene: '实体经济融资难和资金空转并存。',
    options: [
      { text: '建信用和担保体系，把资金引向实体', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 1 }, result: '三年后融资结构和成本都改善了。' },
      { text: '要求加大投放', performance: 1, effect: { reputation: 1 }, result: '投放涨了，不良也涨了。' },
      { text: '给贴息', performance: -1, effect: { reputation: -2 }, result: '贴息花了，覆盖面很小。' },
    ],
  },
  {
    title: '财政体制',
    scene: '省以下财政体制不顺，基层事权多、财力少。',
    options: [
      { text: '重新划分事权支出责任，把财力下沉', performance: 3, effect: { reputation: 4, seniority: 4, network: 2 }, result: '调整后基层运转明显好转。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '转移支付涨了，机制没变。' },
      { text: '让基层自己想办法', performance: -2, effect: { reputation: -3 }, result: '基层开始想办法弄钱。' },
    ],
  },
  {
    title: '财税体制',
    scene: '要落实一项减税政策，财政减收压力很大。',
    options: [
      { text: '不折不扣落实，同时压一般性支出腾空间', performance: 3, effect: { reputation: 4, integrity: 2, seniority: 2 }, result: '政策落了地，企业有实感。' },
      { text: '落实但留个口子', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '口子一开，企业感受打折。' },
      { text: '先收着，看情况再说', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被督查发现，很被动。' },
    ],
  },
  {
    title: '农业农村',
    scene: '农业大省不强，农民增收乏力。',
    options: [
      { text: '从加工、品牌、联农机制三头一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '五年后几个产业真正立住了。' },
      { text: '加大补贴', performance: 1, effect: { reputation: 1 }, result: '补贴涨了，竞争力没变。' },
      { text: '扩大规模', performance: -1, effect: { reputation: -2 }, result: '规模上去了，价格下来了。' },
    ],
  },
  {
    title: '粮食安全',
    scene: '要扛稳粮食安全责任，与结构调整有张力。',
    options: [
      { text: '保面积保产能，在技术和收益上做文章', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 2 }, result: '面积产量双保，农民收益也上去了。' },
      { text: '下指标', performance: 1, effect: { reputation: 1 }, result: '指标下了，落实打折扣。' },
      { text: '在数字上做文章', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '核查时被发现。' },
    ],
  },
  {
    title: '生态环保',
    scene: '督察反馈了一批问题，有的牵扯到发展模式。',
    options: [
      { text: '照单全收，从结构上转、从源头上治', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 3 }, result: '三年后环境质量明显改善。' },
      { text: '逐个整改', performance: 1, effect: { reputation: 1 }, result: '整改了，还会再出现。' },
      { text: '边改边说明困难', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '被认为整改不坚决。' },
    ],
  },
  {
    title: '双碳工作',
    scene: '降碳目标和能源安全、经济增长相互牵制。',
    options: [
      { text: '先立后破，把新能源和储能先建起来', performance: 3, effect: { reputation: 4, seniority: 4, health: -1 }, result: '五年后能源结构明显优化。' },
      { text: '压高耗能项目', performance: 1, effect: { reputation: 1 }, result: '压了，增长也下来了。' },
      { text: '运动式减碳', performance: -3, effect: { reputation: -5, integrity: -3 }, result: '限电停产，影响很大。' },
    ],
  },
  {
    title: '能源安全',
    scene: '用电高峰缺口大，供应侧一时补不上。',
    options: [
      { text: '供需两侧一起做，先保民生，把需求响应机制建起来', performance: 3, effect: { reputation: 4, seniority: 3, health: -2 }, result: '平稳度峰，没有拉闸限电。' },
      { text: '向上争取指标', performance: 1, effect: { reputation: 1 }, result: '争取到一点，缺口还在。' },
      { text: '有序用电', performance: -2, effect: { reputation: -3 }, result: '限了电，企业意见很大。' },
    ],
  },
  {
    title: '交通运输',
    scene: '综合交通体系有短板，几种方式衔接不畅。',
    options: [
      { text: '从枢纽和衔接入手，把多式联运做起来', performance: 3, effect: { reputation: 3, seniority: 3 }, result: '三年后物流成本明显下降。' },
      { text: '多修路', performance: 1, effect: { reputation: 1 }, result: '路更多了，衔接还是断的。' },
      { text: '先建大项目', performance: -1, effect: { reputation: -2 }, result: '项目建了，用不起来。' },
    ],
  },
  {
    title: '水利建设',
    scene: '水灾害、水资源、水生态三件事都要办。',
    options: [
      { text: '按风险排序，除险加固优先，同步做节水', performance: 3, effect: { reputation: 3, seniority: 2, integrity: 1 }, result: '那年汛期平稳，用水也更稳。' },
      { text: '全面铺开', performance: 1, effect: { reputation: 1 }, result: '铺开了，资金跟不上。' },
      { text: '先做景观', performance: -2, effect: { reputation: -3 }, result: '景观漂亮，隐患还在。' },
    ],
  },
  {
    title: '教育事业',
    scene: '高等教育与产业需求脱节，职业教育认可度低。',
    options: [
      { text: '调整学科专业结构，把产教融合做实', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '五年后毕业生本地就业率明显上升。' },
      { text: '扩大招生规模', performance: 1, effect: { reputation: 1 }, result: '规模上去了，就业更难。' },
      { text: '集中资源办一两所名校', performance: -1, effect: { reputation: -2 }, result: '名校强了，整体没变。' },
    ],
  },
  {
    title: '卫生健康',
    scene: '优质医疗资源集中在大城市，基层薄弱。',
    options: [
      { text: '建国家区域医疗中心，同时强基层、做分级', performance: 3, effect: { reputation: 5, seniority: 3, network: 2 }, result: '五年后外转率明显下降。' },
      { text: '扩建大医院', performance: 1, effect: { reputation: 1 }, result: '大医院更大，基层更弱。' },
      { text: '引进专家', performance: -1, effect: { reputation: -1 }, result: '专家来了又走。' },
    ],
  },
  {
    title: '社会保障',
    scene: '基金可持续压力上升，覆盖面也有缺口。',
    options: [
      { text: '扩面征缴与制度改革并举，把缺口补上', performance: 3, effect: { reputation: 4, seniority: 3, integrity: 1 }, result: '五年后基金运行更稳。' },
      { text: '提高补助', performance: 1, effect: { reputation: 1 }, result: '补助涨了，缺口更大。' },
      { text: '等中央政策', performance: -1, effect: { reputation: -2 }, result: '等了一年，什么也没变。' },
    ],
  },
  {
    title: '就业优先',
    scene: '总量压力和结构性矛盾并存。',
    options: [
      { text: '把培训跟着岗位走，重点群体一对一帮扶', performance: 3, effect: { reputation: 4, seniority: 2, health: -1 }, result: '两年后重点群体就业明显改善。' },
      { text: '扩大培训规模', performance: 1, effect: { reputation: 1 }, result: '培训了很多，用不上。' },
      { text: '开发公益岗', performance: -1, effect: { reputation: -2 }, result: '岗位有限，结构问题没解。' },
    ],
  },
  {
    title: '住房制度',
    scene: '要解决大城市住房突出问题，思路分歧大。',
    options: [
      { text: '租购并举，把保障性供给和租赁规范一起做', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '五年后新市民住房压力明显缓解。' },
      { text: '多建保障房', performance: 1, effect: { reputation: 1 }, result: '建了，位置和配套不理想。' },
      { text: '稳定房价优先', performance: -1, effect: { reputation: -2, integrity: -1 }, result: '房价稳了，居住问题没解。' },
    ],
  },
  {
    title: '文化旅游',
    scene: '文化资源丰富，但转化不足、消费不旺。',
    options: [
      { text: '抓内容和服务，把资源变成产品', performance: 3, effect: { reputation: 3, seniority: 2, network: 2 }, result: '三年后文旅收入结构明显改善。' },
      { text: '加大宣传', performance: 1, effect: { reputation: 1 }, result: '人来了，留不住。' },
      { text: '建大项目', performance: -1, effect: { reputation: -2 }, result: '项目建了，客流撑不住。' },
    ],
  },
  {
    title: '体育事业',
    scene: '竞技与群众体育失衡，场地设施不足。',
    options: [
      { text: '把场地补到群众身边，竞技与普及分开算账', performance: 3, effect: { reputation: 3, seniority: 2 }, result: '五年后经常锻炼人口明显增加。' },
      { text: '集中资源抓竞技', performance: 1, effect: { reputation: 1 }, result: '奖牌有了，群众没受益。' },
      { text: '建大型场馆', performance: -1, effect: { reputation: -2 }, result: '场馆建了，日常闲置。' },
    ],
  },
  {
    title: '社会治理',
    scene: '矛盾集中在基层，化解资源在上面。',
    options: [
      { text: '资源下沉，把化解力量放到一线', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '三年后越级上访明显减少。' },
      { text: '加强排查', performance: 1, effect: { reputation: 1 }, result: '排查了，化解不了。' },
      { text: '稳控为主', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '压住一时，堆得更多。' },
    ],
  },
  {
    title: '平安建设',
    scene: '一类违法犯罪呈组织化趋势，群众反映强烈。',
    options: [
      { text: '依法严打与源头治理结合，交政法机关办、不干预个案', performance: 3, effect: { reputation: 4, integrity: 3, seniority: 2 }, result: '两年后治安形势明显好转。' },
      { text: '集中打击', performance: 1, effect: { reputation: 1 }, result: '打了一阵又回来。' },
      { text: '打打招呼保一下', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '打招呼的事，后患无穷。' },
    ],
  },
  {
    title: '安全生产',
    scene: '这条线事故多发，根子在主体责任不落实。',
    options: [
      { text: '把责任体系、标准体系和排查机制一起立起来', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '三年后事故起数大幅下降。' },
      { text: '开展专项整治', performance: 1, effect: { reputation: 1 }, result: '整治完又回来。' },
      { text: '以追责推动', performance: -1, effect: { reputation: -2, network: -1 }, result: '追责了，开始瞒报。' },
    ],
  },
  {
    title: '应急体系',
    scene: '一次事件暴露出全省应急体系响应慢、协同差。',
    options: [
      { text: '重构指挥和预案体系，搞实战化演练', performance: 3, effect: { reputation: 4, seniority: 3, health: -2 }, result: '下一次实战中响应明显更快。' },
      { text: '修订预案', performance: 1, effect: { reputation: 1 }, result: '预案厚了，没人翻。' },
      { text: '配装备', performance: -1, effect: { reputation: -1 }, result: '装备有了，人不会用。' },
    ],
  },
  {
    title: '防灾减灾',
    scene: '极端天气频发，全省防灾能力参差不齐。',
    options: [
      { text: '按风险区划分类施策，把预警到响应的链条打通', performance: 3, effect: { reputation: 4, seniority: 3, health: -1 }, result: '下一次极端天气损失明显减小。' },
      { text: '加强值班值守', performance: 1, effect: { reputation: 1 }, result: '值班加强了，流程不清。' },
      { text: '事后救灾', performance: -2, effect: { reputation: -3 }, result: '救了灾，损失已经造成。' },
    ],
  },
  {
    title: '信访工作',
    scene: '一批跨地区跨部门的积案，多年没有化解。',
    options: [
      { text: '逐案明确责任主体和时限，公开督办', performance: 3, effect: { reputation: 3, seniority: 2, health: -1 }, result: '两年后积案化解过半。' },
      { text: '交办下去', performance: 1, effect: { reputation: 1 }, result: '交办了，转一圈又回来。' },
      { text: '稳住就行', performance: -2, effect: { reputation: -3, integrity: -2 }, result: '问题越积越多。' },
    ],
  },
  {
    title: '法治建设',
    scene: '全省一批行政行为在复议诉讼中败诉。',
    options: [
      { text: '从败诉案件倒查制度，把程序和裁量规范起来', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 3 }, result: '两年后败诉率大幅下降。' },
      { text: '要求各地重视', performance: 1, effect: { reputation: 1 }, result: '重视了，还是照旧出错。' },
      { text: '协调一下', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '协调的事留下了记录。' },
    ],
  },
  {
    title: '统计工作',
    scene: '有迹象表明个别地方数据不实。',
    options: [
      { text: '立即组织核查，发现一起查处一起', performance: 3, effect: { reputation: 3, integrity: 5, seniority: 2 }, result: '查处之后，全省风气为之一正。' },
      { text: '要求自查自纠', performance: 1, effect: { reputation: 1, integrity: -2 }, result: '自查结果全部合格。' },
      { text: '压着不查', performance: -4, effect: { reputation: -6, integrity: -6 }, result: '被上级督查发现，一并追责。' },
    ],
  },
  {
    title: '审计监督',
    scene: '审计发现一条资金链上有系统性问题。',
    options: [
      { text: '全面整改并建长效机制，结果公开', performance: 3, effect: { reputation: 3, integrity: 4, seniority: 2 }, result: '机制建起来后，同类问题基本消失。' },
      { text: '要求逐个整改', performance: 1, effect: { reputation: 1 }, result: '整改了，还会再犯。' },
      { text: '控制影响范围', performance: -3, effect: { reputation: -4, integrity: -4 }, result: '被公开通报。' },
    ],
  },
  {
    title: '政务服务',
    scene: '全省政务服务标准不一，跨市通办推不动。',
    options: [
      { text: '统一事项标准和平台，先打通高频事项', performance: 3, effect: { reputation: 4, seniority: 3 }, result: '一年后高频事项全部跨市通办。' },
      { text: '各地自建', performance: 1, effect: { reputation: 1 }, result: '各自建了，互不相通。' },
      { text: '先建大厅', performance: -1, effect: { reputation: -1 }, result: '大厅漂亮，流程没变。' },
    ],
  },
  {
    title: '数字建设',
    scene: '要建全省一体化平台，最怕建成空壳。',
    options: [
      { text: '先立共享的硬规矩，从高频场景切入', performance: 3, effect: { reputation: 3, seniority: 4 }, result: '平台真用起来了，应用也多了。' },
      { text: '一次建全', performance: 1, effect: { reputation: 1 }, result: '建完了，没人用。' },
      { text: '先建大屏', performance: -2, effect: { reputation: -3, integrity: -1 }, result: '大屏漂亮，数据不更新。' },
    ],
  },
  {
    title: '督查激励',
    scene: '很多部署落不下去，督查也督查不动。',
    options: [
      { text: '督查与激励并重，把干得好的地方树起来', performance: 3, effect: { reputation: 4, seniority: 3, network: 2 }, result: '一年后落实情况明显好转。' },
      { text: '加强督查', performance: 1, effect: { reputation: 1 }, result: '督查多了，应付也多了。' },
      { text: '通报批评', performance: -1, effect: { reputation: -2, network: -1 }, result: '批评了，还是落不下去。' },
    ],
  },
  {
    title: '区域协调',
    scene: '省内区域差距在拉大，协调机制不灵。',
    options: [
      { text: '分类施策，先补最短板，同时建利益共享机制', performance: 3, effect: { reputation: 4, seniority: 4, network: 3 }, result: '五年后区域差距开始收敛。' },
      { text: '加大转移支付', performance: 1, effect: { reputation: 1 }, result: '钱给了，机制没变。' },
      { text: '让强的带弱的', performance: -1, effect: { reputation: -2 }, result: '带了一阵，没有动力。' },
    ],
  },
  {
    title: '对口支援',
    scene: '对口支援要做实，不能只停留在资金。',
    options: [
      { text: '做成产业协作和人才交流，留下带不走的能力', performance: 3, effect: { reputation: 4, network: 3, seniority: 3 }, result: '几年后对方有了自己的产业。' },
      { text: '按任务完成', performance: 1, effect: { reputation: 1 }, result: '任务完成了，没有后劲。' },
      { text: '给钱了事', performance: -2, effect: { reputation: -3 }, result: '钱给了，能力没留下。' },
    ],
  },
  {
    title: '突发事件',
    scene: '省内发生重大突发事件，多个市受影响。',
    options: [
      { text: '第一时间到一线，靠前指挥，边处置边上报', performance: 3, effect: { reputation: 5, health: -4, seniority: 3, integrity: 2 }, result: '处置有序，损失降到最低。' },
      { text: '在指挥中心调度', performance: 1, effect: { reputation: 1 }, result: '调度了，一线缺主心骨。' },
      { text: '等信息完整再动', performance: -4, effect: { reputation: -6, integrity: -4 }, result: '错过窗口，后果严重。' },
    ],
  },
  {
    title: '廉政建设',
    scene: '你分管的领域资金密集、审批权集中。',
    options: [
      { text: '把流程公开、把权限分散、把留痕做实，自己带头回避', performance: 3, effect: { reputation: 3, integrity: 5, seniority: 3 }, result: '这条线多年没有出问题。' },
      { text: '加强教育提醒', performance: 1, effect: { reputation: 1, integrity: 1 }, result: '提醒了，机制没变。' },
      { text: '相信干部自觉', performance: -3, effect: { reputation: -5, integrity: -5 }, result: '出事时，你是分管领导。' },
    ],
  },
];
