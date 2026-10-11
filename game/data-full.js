// Generated mechanically from source/main.lua. Keep source data authoritative.
const RANKS = [
  {
    "name": "二级科员",
    "short": "二级科员",
    "dutyType": "职级序列",
    "years": 0,
    "age": 22,
    "review": 60,
    "reputation": 0,
    "network": 0,
    "achievement": 0,
    "faultLimit": 99
  },
  {
    "name": "四级主任科员",
    "short": "四级主任科员",
    "dutyType": "职级序列",
    "years": 1,
    "age": 23,
    "review": 62,
    "reputation": 32,
    "network": 16,
    "achievement": 1,
    "faultLimit": 3
  },
  {
    "name": "乡科级副职（副科级）",
    "short": "副科级",
    "dutyType": "领导职务",
    "years": 2,
    "age": 24,
    "review": 64,
    "reputation": 38,
    "network": 22,
    "achievement": 2,
    "faultLimit": 3
  },
  {
    "name": "乡科级正职（正科级）",
    "short": "正科级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 26,
    "review": 66,
    "reputation": 45,
    "network": 30,
    "achievement": 4,
    "faultLimit": 3
  },
  {
    "name": "县处级副职（副处级）",
    "short": "副处级",
    "dutyType": "领导职务",
    "years": 4,
    "age": 29,
    "review": 68,
    "reputation": 52,
    "network": 38,
    "achievement": 6,
    "faultLimit": 2
  },
  {
    "name": "县处级正职（正处级）",
    "short": "正处级",
    "dutyType": "领导职务",
    "years": 5,
    "age": 33,
    "review": 70,
    "reputation": 60,
    "network": 47,
    "achievement": 8,
    "faultLimit": 2
  },
  {
    "name": "厅局级副职（副厅级）",
    "short": "副厅级",
    "dutyType": "领导职务",
    "years": 6,
    "age": 38,
    "review": 72,
    "reputation": 68,
    "network": 56,
    "achievement": 10,
    "faultLimit": 2
  },
  {
    "name": "厅局级正职（正厅级）",
    "short": "正厅级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 44,
    "review": 74,
    "reputation": 73,
    "network": 62,
    "achievement": 12,
    "faultLimit": 1
  },
  {
    "name": "省部级副职（副部级）",
    "short": "副部级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 50,
    "retirementAge": 63,
    "review": 76,
    "reputation": 78,
    "network": 68,
    "achievement": 14,
    "faultLimit": 1
  },
  {
    "name": "省部级正职（正部级）",
    "short": "正部级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 55,
    "retirementAge": 65,
    "review": 78,
    "reputation": 83,
    "network": 74,
    "achievement": 16,
    "faultLimit": 1
  },
  {
    "name": "国家级副职（副国级）",
    "short": "副国级",
    "dutyType": "领导职务",
    "years": 3,
    "age": 60,
    "review": 80,
    "reputation": 88,
    "network": 80,
    "achievement": 18,
    "faultLimit": 0
  }
];
const POSITION_OPTIONS = {
  "3": [
    {
      "group": "镇党委副书记岗位",
      "name": "镇党委专职副书记",
      "level": "副科级",
      "description": "协助党委书记抓党的建设、基层治理和综合协调，不兼任政府主官。",
      "effect": {
        "network": 3,
        "seniority": 2,
        "reputation": 1
      }
    },
    {
      "group": "镇党委副书记岗位",
      "name": "镇党委副书记、政法委书记",
      "level": "副科级",
      "description": "负责平安建设、信访维稳、矛盾化解和政法协调工作。",
      "effect": {
        "network": 2,
        "integrity": 2,
        "reputation": 2,
        "health": -1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、组织委员",
      "level": "副科级",
      "description": "负责基层党组织、干部管理、党员教育和人才工作。",
      "effect": {
        "network": 3,
        "seniority": 2,
        "integrity": 1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、派出所所长",
      "level": "副科级配置",
      "description": "负责辖区治安、公共安全和基层警务协同，通常具有公安机关任职经历。",
      "minIntegrity": 80,
      "effect": {
        "network": 3,
        "integrity": 2,
        "health": -2
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、宣传委员",
      "level": "副科级",
      "description": "负责宣传思想、意识形态、精神文明和公共文化工作。",
      "effect": {
        "reputation": 3,
        "network": 1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、统战委员",
      "level": "副科级",
      "description": "负责统一战线、民族宗教、商会和乡贤联络工作。",
      "effect": {
        "network": 4,
        "reputation": 1
      }
    },
    {
      "group": "镇党委委员岗位",
      "name": "镇党委委员、人武部部长",
      "level": "副科级",
      "description": "负责基层武装、民兵预备役、征兵和国防动员工作。",
      "effect": {
        "seniority": 3,
        "integrity": 2,
        "health": -1
      }
    },
    {
      "group": "镇纪委和政府岗位",
      "name": "镇党委委员、纪委书记",
      "level": "副科级",
      "description": "负责镇纪委工作、监督执纪、廉政教育和作风建设。",
      "minIntegrity": 75,
      "effect": {
        "integrity": 4,
        "reputation": 1
      }
    },
    {
      "group": "镇纪委和政府岗位",
      "name": "副镇长（明确分管领域）",
      "level": "副科级",
      "description": "根据分工负责农业农村、民政、项目建设或安全生产等领域。",
      "effect": {
        "reputation": 2,
        "seniority": 2
      }
    }
  ],
  "4": [
    {
      "group": "乡镇党政主官",
      "name": "镇党委书记",
      "level": "正科级",
      "description": "主持镇党委全面工作，统筹党建、发展、治理和干部队伍建设。",
      "effect": {
        "reputation": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "group": "乡镇党政主官",
      "name": "镇党委副书记、镇长",
      "level": "正科级",
      "description": "主持镇政府全面工作，在镇党委领导下统筹经济运行、民生和行政事务。",
      "effect": {
        "seniority": 4,
        "network": 2,
        "health": -2
      }
    },
    {
      "group": "县直正科岗位",
      "name": "县委办公室常务副主任",
      "level": "正科级",
      "description": "负责县委机关日常运转、文稿、信息和督查协调。",
      "effect": {
        "seniority": 3,
        "network": 3
      }
    },
    {
      "group": "县直正科岗位",
      "name": "县政府办公室主任",
      "level": "正科级",
      "description": "主持县政府办公室日常工作，承担综合协调、政务和督查职责。",
      "effect": {
        "seniority": 3,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "县政府部门正职",
      "name": "县民政局局长",
      "level": "正科级",
      "description": "主持民政工作，负责社会救助、养老服务和基层政权建设。",
      "effect": {
        "reputation": 4,
        "integrity": 1
      }
    },
    {
      "group": "县政府部门正职",
      "name": "县工业和信息化局局长",
      "level": "正科级",
      "description": "负责工业运行、企业服务、数字化和产业协调。",
      "effect": {
        "network": 3,
        "seniority": 3
      }
    },
    {
      "group": "县政府部门正职",
      "name": "县水利局局长",
      "level": "正科级",
      "description": "负责水利建设、防汛抗旱和水资源管理。",
      "effect": {
        "reputation": 3,
        "seniority": 2,
        "health": -1
      }
    },
    {
      "group": "驻县和企事业岗位",
      "name": "县税务局主要负责人",
      "level": "正科级配置",
      "description": "属于垂直管理系统，负责税费征管服务和部门协同。",
      "minIntegrity": 75,
      "effect": {
        "integrity": 3,
        "seniority": 2
      }
    },
    {
      "group": "驻县和企事业岗位",
      "name": "县烟草专卖局主要负责人",
      "level": "正科级配置",
      "description": "属于行业垂直管理单位，并非县政府组成部门。",
      "effect": {
        "network": 3,
        "reputation": 2
      }
    },
    {
      "group": "驻县和企事业岗位",
      "name": "县供电企业主要负责人",
      "level": "正科级相当岗位",
      "description": "属于供电企业管理岗位，并非公务员行政职务。",
      "effect": {
        "network": 3,
        "reputation": 2
      }
    }
  ],
  "5": [
    {
      "group": "重点镇高配岗位",
      "name": "县委常委、重点镇党委书记",
      "level": "副处级高配",
      "description": "经济强镇、人口大镇或城关重镇的特殊高配岗位；是否进入县委常委由地方机构设置决定。",
      "minAchievements": 8,
      "effect": {
        "reputation": 4,
        "network": 4,
        "seniority": 2,
        "health": -2
      }
    },
    {
      "group": "县委副书记岗位",
      "name": "县委专职副书记",
      "level": "副处级",
      "description": "协助县委书记抓党的建设、干部队伍和县委日常协调。",
      "minAchievements": 8,
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    },
    {
      "group": "县委副书记岗位",
      "name": "县委副书记、政法委书记",
      "level": "副处级",
      "description": "统筹政法、平安建设、信访和基层社会治理工作。",
      "minAchievements": 8,
      "minIntegrity": 75,
      "effect": {
        "network": 3,
        "integrity": 3,
        "reputation": 2,
        "health": -1
      }
    },
    {
      "group": "县委常委岗位",
      "name": "县委常委、组织部部长",
      "level": "副处级",
      "description": "负责县域干部队伍、基层组织建设和人才工作。",
      "minAchievements": 8,
      "minIntegrity": 75,
      "effect": {
        "network": 4,
        "seniority": 3,
        "integrity": 1
      }
    },
    {
      "group": "县委常委岗位",
      "name": "县委常委、宣传部部长",
      "level": "副处级",
      "description": "负责宣传思想、意识形态、新闻舆情和文化建设。",
      "minAchievements": 8,
      "effect": {
        "reputation": 4,
        "network": 2
      }
    },
    {
      "group": "县委常委岗位",
      "name": "县委常委、县委办公室主任",
      "level": "副处级",
      "description": "负责县委机关运转、重大文稿、督查和综合协调。",
      "minAchievements": 8,
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县委常委、县政府党组副书记、常务副县长",
      "level": "副处级",
      "description": "协助县长负责县政府常务工作，通常分管发改、财政、应急和重大项目。",
      "minAchievements": 8,
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、副县长（分管农业农村）",
      "level": "副处级",
      "description": "分管农业农村、乡村振兴、水利和相关重点项目。",
      "effect": {
        "reputation": 3,
        "network": 2,
        "health": -1
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、副县长（分管民政教育）",
      "level": "副处级",
      "description": "分管民政、教育、卫生健康和社会事业。",
      "effect": {
        "reputation": 4,
        "integrity": 1,
        "health": -1
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、副县长、公安局局长",
      "level": "副处级",
      "description": "分管公安、司法和公共安全，并主持县公安局全面工作。",
      "minIntegrity": 80,
      "effect": {
        "network": 3,
        "integrity": 3,
        "health": -2
      }
    },
    {
      "group": "县政府领导岗位",
      "name": "县政府党组成员、县政府办公室主任",
      "level": "副处级高配",
      "description": "特殊高配安排，参与县政府班子工作并主持县政府办公室。",
      "minAchievements": 8,
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    }
  ],
  "6": [
    {
      "group": "县级党政主官",
      "name": "县委书记",
      "level": "正处级",
      "description": "主持县委全面工作，对县域发展、党的建设和基层治理负总责。",
      "minAchievements": 10,
      "effect": {
        "reputation": 5,
        "network": 4,
        "health": -2
      }
    },
    {
      "group": "县级党政主官",
      "name": "县政府党组书记、县长（县委副书记）",
      "level": "正处级",
      "description": "主持县政府全面工作，并以县委副书记身份参与县委领导。",
      "minAchievements": 9,
      "effect": {
        "seniority": 5,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "市级党政机关正处岗位",
      "name": "四线城市市委副秘书长",
      "level": "正处级",
      "description": "协助市委领导处理综合协调、督查和重要文稿等工作。",
      "effect": {
        "seniority": 3,
        "network": 3
      }
    },
    {
      "group": "市级党政机关正处岗位",
      "name": "四线城市市政府副秘书长",
      "level": "正处级",
      "description": "协助市政府领导开展综合协调、政务督查和重点事项调度。",
      "effect": {
        "seniority": 3,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "市级部门正职",
      "name": "四线城市市直部门主要负责人",
      "level": "正处级",
      "description": "主持市级政府组成部门或市级党委工作部门的全面工作。",
      "effect": {
        "seniority": 3,
        "network": 2,
        "reputation": 2
      }
    },
    {
      "group": "市级部门正职",
      "name": "四线城市市政府办公室主任",
      "level": "正处级",
      "description": "主持市政府办公室工作，承担全市政府系统综合协调。",
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -1
      }
    },
    {
      "group": "市辖区党政主官",
      "name": "市辖区委书记",
      "level": "正处级",
      "description": "主持市辖区党委全面工作，统筹城区党建、发展和治理。",
      "minAchievements": 10,
      "effect": {
        "reputation": 4,
        "network": 4,
        "health": -2
      }
    },
    {
      "group": "市辖区党政主官",
      "name": "市辖区政府党组书记、区长（区委副书记）",
      "level": "正处级",
      "description": "主持市辖区政府全面工作，并以区委副书记身份参与区委领导。",
      "minAchievements": 9,
      "effect": {
        "seniority": 4,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委副书记、政法委书记",
      "level": "正处级岗位",
      "description": "负责城区政法、信访、平安建设和社会治理工作。",
      "minAchievements": 8,
      "effect": {
        "network": 3,
        "integrity": 2,
        "reputation": 2
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委常委、组织部部长",
      "level": "正处级岗位",
      "description": "负责城区干部队伍、基层组织和人才工作。",
      "minAchievements": 8,
      "effect": {
        "network": 4,
        "seniority": 2,
        "integrity": 1
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委常委、宣传部部长",
      "level": "正处级岗位",
      "description": "负责城区宣传思想、意识形态和文化建设工作。",
      "minAchievements": 8,
      "effect": {
        "reputation": 4,
        "network": 2
      }
    },
    {
      "group": "市辖区党委岗位",
      "name": "市辖区委常委、区委办公室主任",
      "level": "正处级岗位",
      "description": "负责城区党委机关运转、文稿、督查和综合协调。",
      "minAchievements": 8,
      "effect": {
        "seniority": 3,
        "network": 3
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府党组副书记、常务副区长",
      "level": "正处级岗位",
      "description": "协助区长负责政府常务工作，分管发改、财政、应急和重点项目。",
      "minAchievements": 8,
      "effect": {
        "seniority": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府党组成员、副区长（分管民生）",
      "level": "正处级岗位",
      "description": "分管教育、民政、卫生健康、住房等公共服务领域。",
      "effect": {
        "reputation": 3,
        "health": -1
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府党组成员、副区长、公安分局局长",
      "level": "正处级岗位",
      "description": "分管公共安全并主持城区公安分局全面工作，通常需要公安系统经历。",
      "minIntegrity": 80,
      "effect": {
        "network": 3,
        "integrity": 3,
        "health": -2
      }
    },
    {
      "group": "市辖区政府岗位",
      "name": "市辖区政府办公室主任",
      "level": "正处级岗位",
      "description": "主持区政府办公室日常工作，负责政务运转和综合协调。",
      "effect": {
        "seniority": 3,
        "network": 2,
        "health": -1
      }
    }
  ],
  "7": [
    {
      "group": "县级主官高配",
      "name": "市委常委、县委书记",
      "level": "副厅级高配",
      "description": "少数重要县（市、区）的特殊高配岗位，兼任设区市市委常委。",
      "minAchievements": 14,
      "effect": {
        "reputation": 5,
        "network": 5,
        "health": -2
      }
    },
    {
      "group": "市政府领导岗位",
      "name": "四线城市副市长（分管民生）",
      "level": "副厅级",
      "description": "分管教育、民政、卫生健康、住房等公共服务。",
      "effect": {
        "reputation": 4,
        "seniority": 2,
        "health": -1
      }
    },
    {
      "group": "市政府领导岗位",
      "name": "四线城市副市长（分管产业）",
      "level": "副厅级",
      "description": "分管工业、招商、园区、能源和重大项目。",
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    },
    {
      "group": "市委常委岗位",
      "name": "市委常委、组织部部长",
      "level": "副厅级",
      "description": "负责全市干部队伍、基层组织建设和人才工作。",
      "minAchievements": 12,
      "effect": {
        "network": 4,
        "seniority": 3,
        "integrity": 1
      }
    },
    {
      "group": "市委常委岗位",
      "name": "市委常委、纪委书记",
      "level": "副厅级",
      "description": "负责监督执纪和党风廉政建设。",
      "minAchievements": 12,
      "minIntegrity": 80,
      "effect": {
        "integrity": 5,
        "reputation": 2
      }
    },
    {
      "group": "市委常委岗位",
      "name": "市委常委、宣传部部长",
      "level": "副厅级",
      "description": "负责全市宣传思想、意识形态和文化建设。",
      "minAchievements": 12,
      "effect": {
        "reputation": 4,
        "network": 2
      }
    }
  ],
  "8": [
    {
      "group": "市级党政主官",
      "name": "四线城市市委书记",
      "level": "正厅级",
      "description": "主持城市党委全面工作与发展布局。",
      "minAchievements": 14,
      "effect": {
        "reputation": 4,
        "network": 4,
        "health": -2
      }
    },
    {
      "group": "市级党政主官",
      "name": "四线城市市长",
      "level": "正厅级",
      "description": "主持市政府全面工作与公共服务。",
      "minAchievements": 13,
      "effect": {
        "seniority": 4,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "市委领导岗位",
      "name": "市委副书记",
      "level": "正厅级",
      "description": "协助市委书记统筹党建、干部和综合协调。",
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -1
      }
    },
    {
      "group": "省政府组成部门正职",
      "name": "省公安厅党委书记、厅长",
      "level": "正厅级",
      "description": "主持省公安厅全面工作，统筹全省公共安全、社会治安和公安队伍建设。",
      "minAchievements": 14,
      "minIntegrity": 85,
      "effect": {
        "integrity": 4,
        "network": 4,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "group": "省直部门正职",
      "name": "省直部门主要负责人",
      "level": "正厅级",
      "description": "主持省级部门行业管理与政策落实。",
      "effect": {
        "network": 3,
        "seniority": 3
      }
    },
    {
      "group": "省直部门领导岗位",
      "name": "省直部门党组副书记",
      "level": "正厅级配置",
      "description": "协助主要负责人推进省级部门重点工作。",
      "effect": {
        "network": 3,
        "integrity": 2
      }
    }
  ],
  "9": [
    {
      "name": "副省长（分管民生）",
      "description": "协助分管省域公共服务和社会事业。",
      "effect": {
        "network": 3,
        "reputation": 3,
        "health": -2
      }
    },
    {
      "name": "副省长（分管产业）",
      "description": "协助分管产业发展、重大项目和区域协调。",
      "effect": {
        "network": 4,
        "seniority": 3,
        "health": -2
      }
    },
    {
      "name": "省委常委、组织部部长",
      "description": "参与省级重大决策，负责干部和组织工作。",
      "minAchievements": 16,
      "effect": {
        "network": 5,
        "seniority": 3,
        "integrity": 1
      }
    },
    {
      "name": "省委常委、宣传部部长",
      "description": "负责省级宣传思想和文化建设。",
      "minAchievements": 16,
      "effect": {
        "reputation": 5,
        "network": 3
      }
    },
    {
      "name": "国家部委副职",
      "description": "分管国家部委专项工作与政策执行。",
      "effect": {
        "network": 3,
        "seniority": 2
      }
    }
  ],
  "10": [
    {
      "name": "省级主要负责人",
      "description": "主持省级党委或政府全面工作。",
      "minAchievements": 18,
      "effect": {
        "reputation": 5,
        "network": 4,
        "health": -2
      }
    },
    {
      "name": "省委副书记",
      "description": "协助主要负责人统筹省级党建和发展工作。",
      "minAchievements": 17,
      "effect": {
        "network": 5,
        "seniority": 4,
        "health": -2
      }
    },
    {
      "name": "国家部委主要负责人",
      "description": "主持国家部委全面工作和行业发展。",
      "effect": {
        "seniority": 4,
        "network": 2,
        "health": -1
      }
    },
    {
      "name": "国家部委党组副书记",
      "description": "协助主要负责人推进国家层面重点任务。",
      "effect": {
        "network": 4,
        "integrity": 2
      }
    }
  ],
  "11": [
    {
      "name": "国家级重要领导岗位",
      "description": "参与国家层面的重要决策与综合协调。",
      "effect": {
        "reputation": 4,
        "network": 3,
        "health": -2
      }
    },
    {
      "name": "国家机构副职",
      "description": "承担国家机构重要领导与统筹职责。",
      "effect": {
        "seniority": 4,
        "integrity": 2,
        "health": -1
      }
    },
    {
      "name": "国家级综合协调岗位",
      "description": "承担跨部门、跨区域的综合协调任务。",
      "effect": {
        "network": 5,
        "seniority": 3,
        "health": -2
      }
    }
  ]
};
const EVENTS = [
  {
    "title": "汛期排查",
    "scene": "连续降雨后，村干部报告一处山塘水位异常。镇里需要有人带队巡查。",
    "options": [
      {
        "text": "立即排查并建立闭环整改台账",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "health": -2,
          "network": 2
        },
        "result": "隐患被及时处置，完整台账也为后续巡查提供了依据。"
      },
      {
        "text": "协调村级力量先设置警示区域",
        "performance": 1,
        "effect": {
          "network": 3,
          "reputation": 1
        },
        "result": "现场得到基本控制，后续仍需持续跟进。"
      },
      {
        "text": "仅转发通知，等待村里自行处理",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "信息传达了，但处置不够主动，你在复盘中作出改进。"
      }
    ]
  },
  {
    "title": "群众办事",
    "scene": "一位老人来便民服务中心咨询社保事项，材料缺了一份，老人显得有些着急。",
    "options": [
      {
        "text": "核对材料并联系村级代办员协助",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "network": 2
        },
        "result": "老人顺利完成办理，窗口与村级代办衔接也更加顺畅。"
      },
      {
        "text": "耐心列出补充材料和办理步骤",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "解释清晰规范，老人知道了下一步该怎么做。"
      },
      {
        "text": "简单告知材料不全，让其下次再来",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "health": 1
        },
        "result": "流程没有出错，但服务温度和主动性不足。"
      }
    ]
  },
  {
    "title": "产业走访",
    "scene": "本地合作社准备扩大规模，希望镇里帮助对接技术和销售渠道。",
    "options": [
      {
        "text": "调研经营情况并对接专业部门",
        "performance": 3,
        "effect": {
          "network": 5,
          "reputation": 3,
          "wealth": 1000
        },
        "result": "专业服务精准落地，合作社的发展计划更稳健。"
      },
      {
        "text": "整理需求后提供公开政策清单",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "合作社获得了实用信息，开始按流程准备材料。"
      },
      {
        "text": "口头答应支持但没有继续跟进",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "network": -1
        },
        "result": "事项推进缓慢，你认识到承诺必须配套落实。"
      }
    ]
  },
  {
    "title": "年度材料",
    "scene": "临近年末，几项重点工作需要汇总。时间紧，但数据质量比速度更重要。",
    "options": [
      {
        "text": "逐项核验数据并按时提交",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "health": -2,
          "seniority": 2
        },
        "result": "材料经得起复核，年度工作留下了可靠底稿。"
      },
      {
        "text": "与同事分工汇总并统一口径",
        "performance": 1,
        "effect": {
          "network": 3,
          "reputation": 2
        },
        "result": "材料按时完成，协作流程也更加顺畅。"
      },
      {
        "text": "沿用旧数据，只修改日期和标题",
        "performance": -1,
        "effect": {
          "reputation": -3,
          "integrity": -1
        },
        "result": "复核时发现了偏差，你及时更正并吸取教训。"
      }
    ]
  },
  {
    "title": "基层调研",
    "scene": "镇里准备更新公共服务设施，需要听取不同村组的真实意见。",
    "options": [
      {
        "text": "分类走访并形成需求优先级清单",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "health": -2,
          "seniority": 2
        },
        "result": "一手信息让方案更加贴近实际，有限资金也用在了关键处。"
      },
      {
        "text": "召开代表座谈会集中收集建议",
        "performance": 1,
        "effect": {
          "network": 3,
          "reputation": 2
        },
        "result": "座谈高效完成，收集到了主要共性需求。"
      },
      {
        "text": "直接参考往年方案进行调整",
        "performance": -1,
        "effect": {
          "health": 1,
          "reputation": -2
        },
        "result": "方案推进较快，但部分新需求没有被及时发现。"
      }
    ]
  },
  {
    "title": "同事协作",
    "scene": "一项跨部门任务临时调整分工，新同事对流程还不熟悉。",
    "options": [
      {
        "text": "共享模板并共同检查关键节点",
        "performance": 3,
        "effect": {
          "network": 5,
          "reputation": 2
        },
        "result": "新同事迅速进入状态，团队按时高质量完成任务。"
      },
      {
        "text": "完成自己的部分并提醒截止时间",
        "performance": 1,
        "effect": {
          "seniority": 1,
          "integrity": 1
        },
        "result": "本职任务稳妥完成，整体进度基本可控。"
      },
      {
        "text": "只顾自己的部分，不回应协作请求",
        "performance": -1,
        "effect": {
          "network": -3,
          "reputation": -1
        },
        "result": "跨部门衔接出现延误，你开始重视主动沟通。"
      }
    ]
  },
  {
    "title": "矛盾调解",
    "scene": "两个村民因宅基地边界产生争议，双方情绪激动，希望镇里帮助协调。",
    "options": [
      {
        "text": "查阅资料、现场测量并组织协商",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "integrity": 2,
          "health": -2
        },
        "result": "事实依据清晰，双方最终达成了书面调解意见。"
      },
      {
        "text": "先分别听取诉求，再约定集中协商",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "network": 1
        },
        "result": "双方情绪得到缓和，为后续处理创造了条件。"
      },
      {
        "text": "让双方自行商量，暂不介入",
        "performance": -1,
        "effect": {
          "reputation": -3
        },
        "result": "矛盾没有及时化解，你随后补做了走访和协调。"
      }
    ]
  },
  {
    "title": "项目验收",
    "scene": "一项村级道路改造工程准备验收，现场仍有少量细节需要完善。",
    "options": [
      {
        "text": "按清单逐项核验并限期整改",
        "performance": 3,
        "effect": {
          "integrity": 4,
          "reputation": 3,
          "health": -1
        },
        "result": "整改完成后项目顺利验收，工程质量得到保障。"
      },
      {
        "text": "记录问题并安排后续复查",
        "performance": 1,
        "effect": {
          "integrity": 2,
          "seniority": 1
        },
        "result": "验收程序稳步推进，遗留问题进入跟踪台账。"
      },
      {
        "text": "认为问题不大，直接签字通过",
        "performance": -1,
        "effect": {
          "integrity": -4,
          "reputation": -2
        },
        "result": "复查发现遗漏，你主动纠正并重新完善流程。"
      }
    ]
  },
  {
    "title": "森林防火",
    "scene": "清明临近，连续干燥天气使森林火险等级升高，重点区域需要加强巡防。",
    "options": [
      {
        "text": "划分网格、安排巡查并宣传替代祭扫",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "network": 3,
          "health": -2
        },
        "result": "巡防和宣传同步开展，重点时段保持了安全平稳。"
      },
      {
        "text": "在主要入口增设提醒和值守",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "health": -1
        },
        "result": "关键区域得到管控，基本完成了防火任务。"
      },
      {
        "text": "只在工作群转发防火通知",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "宣传覆盖有限，你随后补充了线下巡查。"
      }
    ]
  },
  {
    "title": "校园周边治理",
    "scene": "群众反映学校放学时段车辆拥堵，存在一定安全隐患。",
    "options": [
      {
        "text": "联合学校和交管力量制定分流方案",
        "performance": 3,
        "effect": {
          "network": 4,
          "reputation": 4
        },
        "result": "错峰、引导和临时停车区同步启用，秩序明显改善。"
      },
      {
        "text": "安排志愿者在高峰时段引导",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "network": 1
        },
        "result": "拥堵有所缓解，后续还需完善长效方案。"
      },
      {
        "text": "认为只是短时拥堵，暂不处理",
        "performance": -1,
        "effect": {
          "reputation": -3
        },
        "result": "问题持续存在，你随后重新组织了现场调研。"
      }
    ]
  },
  {
    "title": "困难家庭走访",
    "scene": "入冬前，镇里需要核实一户困难家庭的生活保障和住房安全情况。",
    "options": [
      {
        "text": "入户核实并协调多项保障政策",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "network": 2,
          "health": -1
        },
        "result": "保障措施精准落实，家庭的过冬问题得到妥善解决。"
      },
      {
        "text": "电话核实情况并提醒准备材料",
        "performance": 1,
        "effect": {
          "reputation": 1,
          "seniority": 1
        },
        "result": "基本情况得到确认，后续进入常规办理流程。"
      },
      {
        "text": "仅依据旧台账直接上报",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "integrity": -1
        },
        "result": "信息更新不够及时，你随后完成了补充核查。"
      }
    ]
  },
  {
    "title": "政务公开",
    "scene": "一项惠民项目即将启动，需要向群众公开办理条件、流程和监督方式。",
    "options": [
      {
        "text": "制作清晰指南并线上线下同步公开",
        "performance": 3,
        "effect": {
          "integrity": 3,
          "reputation": 4,
          "network": 1
        },
        "result": "群众获取信息更加便利，项目推进公开透明。"
      },
      {
        "text": "在公开栏张贴正式通知",
        "performance": 1,
        "effect": {
          "integrity": 2,
          "reputation": 1
        },
        "result": "公开程序规范完成，主要信息得到发布。"
      },
      {
        "text": "等群众来咨询时再逐一解释",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "信息触达不足，你随后补充了公开渠道。"
      }
    ]
  },
  {
    "title": "季度例会",
    "scene": "季度工作例会上，各村居汇报了近期进展，其中一项民生事项需要协调解决。",
    "options": [
      {
        "text": "梳理问题清单并明确责任时限",
        "performance": 3,
        "effect": {
          "seniority": 2,
          "reputation": 3
        },
        "result": "问题被逐项分解，后续责任和时间节点清晰可查。"
      },
      {
        "text": "记录重点事项，会后分别沟通",
        "performance": 1,
        "effect": {
          "network": 2,
          "reputation": 1
        },
        "result": "会议顺利结束，重点事项进入跟踪范围。"
      },
      {
        "text": "只听取汇报，不形成后续安排",
        "performance": -1,
        "effect": {
          "reputation": -2,
          "seniority": -1
        },
        "result": "问题缺少闭环，你在复盘中补充了跟踪机制。"
      }
    ]
  },
  {
    "title": "政策宣传",
    "scene": "一项新的公共服务政策开始实施，需要让群众了解申请条件和办理流程。",
    "options": [
      {
        "text": "制作易懂说明并开展现场答疑",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "network": 2
        },
        "result": "群众准确理解政策，咨询和办理更加顺畅。"
      },
      {
        "text": "按统一模板发布公告",
        "performance": 1,
        "effect": {
          "integrity": 1,
          "reputation": 1
        },
        "result": "公告规范发布，基本完成了政策告知。"
      },
      {
        "text": "等群众自行查找政策原文",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "政策触达不够充分，你随后补做了说明。"
      }
    ]
  },
  {
    "title": "季度复盘",
    "scene": "季度工作进入复盘阶段，需要从完成情况、群众反馈和后续安排三个方面总结。",
    "options": [
      {
        "text": "用数据和案例形成改进清单",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "reputation": 2
        },
        "result": "复盘不回避问题，也为下一季度留下了可执行的改进事项。"
      },
      {
        "text": "按任务完成情况整理总结",
        "performance": 1,
        "effect": {
          "seniority": 1
        },
        "result": "总结按时提交，基本反映了季度工作进展。"
      },
      {
        "text": "只罗列成绩，不记录困难",
        "performance": -1,
        "effect": {
          "integrity": -1,
          "reputation": -1
        },
        "result": "总结不够完整，你补充了风险和困难记录。"
      }
    ]
  },
  {
    "title": "应急值守",
    "scene": "节假日前后工作安排较多，值守和信息报送需要保持准确、及时。",
    "options": [
      {
        "text": "提前排班并核对联络和值守流程",
        "performance": 3,
        "effect": {
          "integrity": 3,
          "network": 2,
          "health": -1
        },
        "result": "值守衔接顺畅，信息报送保持及时准确。"
      },
      {
        "text": "按要求安排人员轮流值守",
        "performance": 1,
        "effect": {
          "integrity": 1,
          "seniority": 1
        },
        "result": "值守任务正常完成，基本满足工作要求。"
      },
      {
        "text": "临近假期才临时通知",
        "performance": -1,
        "effect": {
          "network": -2,
          "reputation": -1
        },
        "result": "安排较为被动，你随后完善了值守预案。"
      }
    ]
  }
];
const POSITION_EVENTS = {
  "grassroots": {
    "title": "基层事项 · 乡镇日常服务",
    "scene": "你在基层窗口接到群众关于社保、低保或证明材料的咨询，需要在不增加群众跑腿的前提下讲清流程。",
    "options": [
      {
        "text": "核对材料并联系村级代办员协助",
        "performance": 3,
        "effect": {
          "reputation": 5,
          "network": 2
        },
        "result": "群众顺利完成办理，窗口与村级代办衔接更加顺畅。"
      },
      {
        "text": "耐心列出补充材料和办理步骤",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "解释清晰规范，群众知道了下一步办理路径。"
      },
      {
        "text": "简单告知材料不全，让群众下次再来",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "流程没有出错，但服务主动性不足。"
      }
    ]
  },
  "discipline": {
    "title": "岗位专项 · 监督规范",
    "scene": "你在当前岗位任职期间，发现一项内部流程记录不够完整，需要规范整改。",
    "options": [
      {
        "text": "核实情况、完善制度并组织警示教育",
        "performance": 3,
        "effect": {
          "integrity": 4,
          "reputation": 2
        },
        "result": "问题被规范整改，制度执行和廉政教育同步加强。"
      },
      {
        "text": "提醒相关人员补齐记录",
        "performance": 1,
        "effect": {
          "integrity": 2
        },
        "result": "记录得到补充，基本完成了规范要求。"
      },
      {
        "text": "认为影响不大，暂不处理",
        "performance": -1,
        "effect": {
          "integrity": -3,
          "reputation": -1
        },
        "result": "后续检查暴露了问题，你及时补做整改。"
      }
    ]
  },
  "organization": {
    "title": "岗位专项 · 队伍建设",
    "scene": "基层队伍需要补充年轻力量，你负责完善培养和岗位实践方案。",
    "options": [
      {
        "text": "调研需求并建立公开培养计划",
        "performance": 3,
        "effect": {
          "network": 4,
          "seniority": 2
        },
        "result": "培养计划公开务实，年轻干部获得了清晰成长路径。"
      },
      {
        "text": "沿用现有轮岗方案并定期复盘",
        "performance": 1,
        "effect": {
          "network": 2,
          "seniority": 1
        },
        "result": "轮岗工作平稳推进，基本达到培养目的。"
      },
      {
        "text": "只安排临时任务，没有长期计划",
        "performance": -1,
        "effect": {
          "network": -2,
          "reputation": -1
        },
        "result": "培养效果不够稳定，你随后补充了长期方案。"
      }
    ]
  },
  "executive": {
    "title": "岗位专项 · 综合治理",
    "scene": "辖区内多项民生工程同时推进，需要你统筹进度、质量和群众沟通。",
    "options": [
      {
        "text": "建立联合调度机制并公开进度",
        "performance": 3,
        "effect": {
          "reputation": 4,
          "network": 3,
          "health": -1
        },
        "result": "项目协同高效，群众能够及时了解工程安排。"
      },
      {
        "text": "按项目分别推进并定期汇总",
        "performance": 1,
        "effect": {
          "seniority": 2,
          "reputation": 1
        },
        "result": "各项目基本按计划推进，协调成本略高。"
      },
      {
        "text": "优先追求进度，暂缓群众沟通",
        "performance": -1,
        "effect": {
          "reputation": -3,
          "health": 1
        },
        "result": "沟通不足产生了误解，你随后进行了集中说明。"
      }
    ]
  },
  "department": {
    "title": "岗位专项 · 行业管理",
    "scene": "上级部署一项行业专项行动，需要结合本地实际制定可执行方案。",
    "options": [
      {
        "text": "开展数据分析并细化责任清单",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "reputation": 2
        },
        "result": "方案目标清晰、责任明确，专项行动取得实效。"
      },
      {
        "text": "参照上级方案调整后执行",
        "performance": 1,
        "effect": {
          "seniority": 1,
          "integrity": 1
        },
        "result": "任务规范推进，完成了主要工作要求。"
      },
      {
        "text": "直接照搬方案，不做本地评估",
        "performance": -1,
        "effect": {
          "reputation": -2
        },
        "result": "部分措施不够适用，你随后进行了针对性修订。"
      }
    ]
  },
  "city": {
    "title": "岗位专项 · 城市统筹",
    "scene": "城市发展面临产业、交通和公共服务协同问题，需要形成跨区域统筹方案。",
    "options": [
      {
        "text": "组织多部门调研并分阶段推进",
        "performance": 3,
        "effect": {
          "network": 4,
          "reputation": 3,
          "health": -1
        },
        "result": "统筹方案兼顾发展与民生，阶段目标稳步落地。"
      },
      {
        "text": "先解决最迫切的单项问题",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "seniority": 1
        },
        "result": "重点问题得到缓解，系统方案仍需继续完善。"
      },
      {
        "text": "各部门自行推进，减少协调环节",
        "performance": -1,
        "effect": {
          "network": -3,
          "reputation": -1
        },
        "result": "部门间出现衔接偏差，你重新建立了协调机制。"
      }
    ]
  },
  "national": {
    "title": "岗位专项 · 跨区域协调",
    "scene": "一项跨区域公共服务政策需要统筹不同地区的实际情况和实施节奏。",
    "options": [
      {
        "text": "充分论证并设置分层实施机制",
        "performance": 3,
        "effect": {
          "integrity": 3,
          "network": 4,
          "seniority": 2
        },
        "result": "政策兼顾统一目标与地区差异，实施过程平稳有序。"
      },
      {
        "text": "先行试点，再根据反馈优化",
        "performance": 1,
        "effect": {
          "seniority": 2,
          "reputation": 1
        },
        "result": "试点积累了经验，为后续推广提供了参考。"
      },
      {
        "text": "统一要求立即实施，不留调整空间",
        "performance": -1,
        "effect": {
          "reputation": -3,
          "network": -2
        },
        "result": "部分地区执行困难，你随后增加了配套措施。"
      }
    ]
  },
  "county_party": {
    "title": "岗位专项 · 县委班子运转",
    "scene": "你在当前岗位分管县委系统工作，县域重点任务进入集中推进阶段。既要落实县委决策，也要处理班子协同和基层反馈。",
    "options": [
      {
        "text": "把重点任务拆解到部门和乡镇，建立督查闭环",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "network": 4,
          "reputation": 3
        },
        "result": "县委决策被细化为可检查的节点，部门和乡镇的责任边界更加清晰。"
      },
      {
        "text": "先抓住最紧迫的两项任务，再逐步铺开",
        "performance": 1,
        "effect": {
          "seniority": 2,
          "reputation": 2
        },
        "result": "重点任务得到推进，但仍需要补充统筹安排。"
      },
      {
        "text": "只转发会议要求，不跟踪基层落实",
        "performance": -1,
        "effect": {
          "network": -3,
          "reputation": -2
        },
        "result": "要求传达到了基层，但执行效果缺少反馈和校正。"
      }
    ]
  },
  "county_government": {
    "title": "岗位专项 · 县政府综合调度",
    "scene": "县政府近期同时面临产业项目、财政约束和民生诉求，需要在现有资源下排出轻重缓急。",
    "options": [
      {
        "text": "统筹财政承受能力，公开项目时序和责任分工",
        "performance": 3,
        "effect": {
          "seniority": 3,
          "reputation": 4,
          "integrity": 2
        },
        "result": "项目安排更加稳妥，财政边界和群众预期都得到较好平衡。"
      },
      {
        "text": "先保障刚性民生支出，再协调重点项目",
        "performance": 1,
        "effect": {
          "reputation": 2,
          "integrity": 1
        },
        "result": "基本民生得到保障，部分项目需要延后安排。"
      },
      {
        "text": "只追求项目数量，暂不测算后续支出",
        "performance": -1,
        "effect": {
          "integrity": -3,
          "reputation": -2
        },
        "result": "项目推进较快，但后续资金和运维压力开始显现。"
      }
    ]
  }
};
const ADDITIONAL_POSITION_EVENTS = {
  "discipline": [
    {
      "title": "岗位专项 · 纪检监督岗位 · 年度重点工作",
      "scene": "你负责的监督事项进入年度检查阶段，需要兼顾线索核查、制度执行和干部教育。",
      "options": [
        {
          "text": "围绕监督执纪规范化开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "监督执纪规范化得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进监督执纪规范化，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "监督执纪规范化基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理监督执纪规范化的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "监督执纪规范化留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 纪检监督岗位 · 阶段性风险处置",
      "scene": "一项重点工程即将验收，监督部门要求提前介入，防止程序和资金使用留下漏洞。",
      "options": [
        {
          "text": "围绕重点领域廉政风险排查开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重点领域廉政风险排查得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重点领域廉政风险排查，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重点领域廉政风险排查基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重点领域廉政风险排查的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重点领域廉政风险排查留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "organization": [
    {
      "title": "岗位专项 · 组织人事岗位 · 年度重点工作",
      "scene": "县乡干部队伍进入年度考察期，需要把平时表现、群众评价和岗位需求结合起来。",
      "options": [
        {
          "text": "围绕干部考察和日常监督开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "干部考察和日常监督得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进干部考察和日常监督，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "干部考察和日常监督基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理干部考察和日常监督的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "干部考察和日常监督留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 组织人事岗位 · 阶段性风险处置",
      "scene": "一批年轻干部即将进入重点岗位，培养方案需要避免只重使用、不重跟踪。",
      "options": [
        {
          "text": "围绕年轻干部培养和轮岗开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "年轻干部培养和轮岗得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进年轻干部培养和轮岗，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "年轻干部培养和轮岗基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理年轻干部培养和轮岗的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "年轻干部培养和轮岗留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_party": [
    {
      "title": "岗位专项 · 镇党委书记 · 年度重点工作",
      "scene": "作为镇党委书记，你需要把县委部署转化为符合本镇实际的年度重点任务。",
      "options": [
        {
          "text": "围绕党委会集体决策开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "党委会集体决策得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进党委会集体决策，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "党委会集体决策基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理党委会集体决策的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "党委会集体决策留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委书记 · 阶段性风险处置",
      "scene": "本镇产业基础、人口规模和财政承受能力各不相同，县里要求拿出差异化发展方案。",
      "options": [
        {
          "text": "围绕镇域产业和基层党建统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇域产业和基层党建统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇域产业和基层党建统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇域产业和基层党建统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇域产业和基层党建统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇域产业和基层党建统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_government": [
    {
      "title": "岗位专项 · 镇党委副书记、镇长 · 年度重点工作",
      "scene": "镇政府同时收到民生服务、项目建设和安全生产三类任务，现有人员无法平均用力。",
      "options": [
        {
          "text": "围绕镇政府行政调度开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇政府行政调度得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇政府行政调度，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇政府行政调度基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇政府行政调度的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇政府行政调度留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委副书记、镇长 · 阶段性风险处置",
      "scene": "一项公共设施项目进入论证，项目有民生价值，但后续运维费用可能超出镇级财力。",
      "options": [
        {
          "text": "围绕镇级财政和公共服务平衡开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇级财政和公共服务平衡得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇级财政和公共服务平衡，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇级财政和公共服务平衡基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇级财政和公共服务平衡的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇级财政和公共服务平衡留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_security": [
    {
      "title": "岗位专项 · 镇党委副书记、政法委书记 · 年度重点工作",
      "scene": "辖区出现多起邻里纠纷和信访苗头，镇党委要求把风险化解在基层。",
      "options": [
        {
          "text": "围绕镇域矛盾排查化解开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "镇域矛盾排查化解得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进镇域矛盾排查化解，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "镇域矛盾排查化解基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理镇域矛盾排查化解的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "镇域矛盾排查化解留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委副书记、政法委书记 · 阶段性风险处置",
      "scene": "重点人员服务管理和基层公共安全工作进入集中排查阶段，需要多部门协同。",
      "options": [
        {
          "text": "围绕重点人员服务管理和基层平安建设开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重点人员服务管理和基层平安建设得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重点人员服务管理和基层平安建设，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重点人员服务管理和基层平安建设基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重点人员服务管理和基层平安建设的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重点人员服务管理和基层平安建设留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "town_organization": [
    {
      "title": "岗位专项 · 镇党委委员、组织宣传统战岗位 · 年度重点工作",
      "scene": "镇里需要调整村级班子并培养后备干部，既要看实绩，也要听取党员群众意见。",
      "options": [
        {
          "text": "围绕村级班子考察和党员教育开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "村级班子考察和党员教育得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进村级班子考察和党员教育，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "村级班子考察和党员教育基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理村级班子考察和党员教育的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "村级班子考察和党员教育留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 镇党委委员、组织宣传统战岗位 · 阶段性风险处置",
      "scene": "一项惠民政策即将实施，需要向群众讲清政策边界，也要做好乡贤和各界人士沟通。",
      "options": [
        {
          "text": "围绕基层宣传思想与统战联络开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "基层宣传思想与统战联络得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进基层宣传思想与统战联络，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "基层宣传思想与统战联络基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理基层宣传思想与统战联络的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "基层宣传思想与统战联络留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "military": [
    {
      "title": "岗位专项 · 基层武装岗位 · 年度重点工作",
      "scene": "征兵宣传、民兵整组和应急支援任务同期展开，需要核准基层底数。",
      "options": [
        {
          "text": "围绕征兵和民兵整组开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "征兵和民兵整组得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进征兵和民兵整组，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "征兵和民兵整组基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理征兵和民兵整组的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "征兵和民兵整组留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 基层武装岗位 · 阶段性风险处置",
      "scene": "极端天气预警发布，镇级应急力量和民兵队伍需要做好支援准备。",
      "options": [
        {
          "text": "围绕军地应急支援和国防动员开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "军地应急支援和国防动员得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进军地应急支援和国防动员，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "军地应急支援和国防动员基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理军地应急支援和国防动员的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "军地应急支援和国防动员留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "public_security": [
    {
      "title": "岗位专项 · 公安基层领导岗位 · 年度重点工作",
      "scene": "辖区进入人员流动高峰，派出所需要把治安防控、纠纷排查和应急值守一体推进。",
      "options": [
        {
          "text": "围绕重点时段治安防控开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重点时段治安防控得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重点时段治安防控，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重点时段治安防控基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重点时段治安防控的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重点时段治安防控留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 公安基层领导岗位 · 阶段性风险处置",
      "scene": "县域重大活动临近，人员流动、交通组织和重点场所安保需要提前研判。",
      "options": [
        {
          "text": "围绕重大活动安保和矛盾风险研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重大活动安保和矛盾风险研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重大活动安保和矛盾风险研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重大活动安保和矛盾风险研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重大活动安保和矛盾风险研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重大活动安保和矛盾风险研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "province_security": [
    {
      "title": "岗位专项 · 省公安厅党委书记、厅长 · 年度重点工作",
      "scene": "全省治安、交通、网络和公共安全风险进入集中研判期，需要统一部署警务资源。",
      "options": [
        {
          "text": "围绕全省公共安全形势研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "全省公共安全形势研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进全省公共安全形势研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "全省公共安全形势研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理全省公共安全形势研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "全省公共安全形势研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 省公安厅党委书记、厅长 · 阶段性风险处置",
      "scene": "多个地市上报相互关联的重大警情，需要省公安厅统筹指挥、依法处置并做好部门协同。",
      "options": [
        {
          "text": "围绕跨市重大案件和应急指挥协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "跨市重大案件和应急指挥协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进跨市重大案件和应急指挥协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "跨市重大案件和应急指挥协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理跨市重大案件和应急指挥协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "跨市重大案件和应急指挥协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_party_lead": [
    {
      "title": "岗位专项 · 县委书记 · 年度重点工作",
      "scene": "县域改革发展进入关键期，县委班子对一项重大任务存在不同意见，需要把握方向、凝聚共识。",
      "options": [
        {
          "text": "围绕县委常委会集体决策开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县委常委会集体决策得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县委常委会集体决策，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县委常委会集体决策基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县委常委会集体决策的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县委常委会集体决策留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委书记 · 阶段性风险处置",
      "scene": "县域招商项目承诺较多，但生态、财政和用地约束都需要正面回应。",
      "options": [
        {
          "text": "围绕县域发展底线和班子建设开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域发展底线和班子建设得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域发展底线和班子建设，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域发展底线和班子建设基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域发展底线和班子建设的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域发展底线和班子建设留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_government_lead": [
    {
      "title": "岗位专项 · 县政府党组书记、县长 · 年度重点工作",
      "scene": "县财政收入承压，但教育、医疗和困难群众保障支出不能简单压减。",
      "options": [
        {
          "text": "围绕县政府财政统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县政府财政统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县政府财政统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县政府财政统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县政府财政统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县政府财政统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县政府党组书记、县长 · 阶段性风险处置",
      "scene": "强对流天气预警发布，交通、供电、学校和乡镇都需要提前做好应急安排。",
      "options": [
        {
          "text": "围绕县域应急指挥和民生保障开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域应急指挥和民生保障得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域应急指挥和民生保障，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域应急指挥和民生保障基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域应急指挥和民生保障的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域应急指挥和民生保障留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_security": [
    {
      "title": "岗位专项 · 县委副书记、政法委书记 · 年度重点工作",
      "scene": "县域信访、矛盾纠纷和基层治理事项相互交织，需要建立县乡联动机制。",
      "options": [
        {
          "text": "围绕县域社会治理联动开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域社会治理联动得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域社会治理联动，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域社会治理联动基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域社会治理联动的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域社会治理联动留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委副书记、政法委书记 · 阶段性风险处置",
      "scene": "县域重大活动临近，公安、交通、应急和乡镇需要形成联合安保方案。",
      "options": [
        {
          "text": "围绕重大活动公共安全保障开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重大活动公共安全保障得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重大活动公共安全保障，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重大活动公共安全保障基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重大活动公共安全保障的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重大活动公共安全保障留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_organization": [
    {
      "title": "岗位专项 · 县委常委、组织部部长 · 年度重点工作",
      "scene": "县域干部交流和年度考察进入集中研判阶段，需要把干部实绩、群众评价和岗位需要结合起来。",
      "options": [
        {
          "text": "围绕县管干部分类研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县管干部分类研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县管干部分类研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县管干部分类研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县管干部分类研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县管干部分类研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委常委、组织部部长 · 阶段性风险处置",
      "scene": "村级班子换届准备同步推进，既要核实现实表现，也要做好风险提示和后续培养。",
      "options": [
        {
          "text": "围绕村级班子换届准备和人才工作开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "村级班子换届准备和人才工作得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进村级班子换届准备和人才工作，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "村级班子换届准备和人才工作基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理村级班子换届准备和人才工作的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "村级班子换届准备和人才工作留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_propaganda": [
    {
      "title": "岗位专项 · 县委常委、宣传部部长 · 年度重点工作",
      "scene": "一项民生政策发布后，网络和热线出现不同声音，群众对政策边界存在误解。",
      "options": [
        {
          "text": "围绕县域政策发布和舆情回应开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域政策发布和舆情回应得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域政策发布和舆情回应，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域政策发布和舆情回应基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域政策发布和舆情回应的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域政策发布和舆情回应留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委常委、宣传部部长 · 阶段性风险处置",
      "scene": "县域公共文化和宣传阵地需要年度建设，既要有内容，也要有规范管理。",
      "options": [
        {
          "text": "围绕意识形态阵地和公共文化建设开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "意识形态阵地和公共文化建设得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进意识形态阵地和公共文化建设，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "意识形态阵地和公共文化建设基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理意识形态阵地和公共文化建设的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "意识形态阵地和公共文化建设留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_office": [
    {
      "title": "岗位专项 · 县委常委、县委办公室主任 · 年度重点工作",
      "scene": "县委会议确定了多项重点任务，部分乡镇反馈任务交叉、口径不一，督查需要从材料检查转向解决问题。",
      "options": [
        {
          "text": "围绕县委重点任务督查开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县委重点任务督查得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县委重点任务督查，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县委重点任务督查基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县委重点任务督查的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县委重点任务督查留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委常委、县委办公室主任 · 阶段性风险处置",
      "scene": "年度重要会议和综合文稿集中交办，时间紧、协作部门多，需要统一口径和审核流程。",
      "options": [
        {
          "text": "围绕重大文稿和综合协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "重大文稿和综合协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进重大文稿和综合协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "重大文稿和综合协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理重大文稿和综合协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "重大文稿和综合协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_party": [
    {
      "title": "岗位专项 · 县委班子岗位 · 年度重点工作",
      "scene": "县级党委系统需要把上级部署分解到部门、乡镇和基层组织，确保责任链条不悬空。",
      "options": [
        {
          "text": "围绕县级重点任务分解开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县级重点任务分解得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县级重点任务分解，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县级重点任务分解基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县级重点任务分解的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县级重点任务分解留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县委班子岗位 · 阶段性风险处置",
      "scene": "县域重点工作进入集中推进期，班子成员之间需要在分工基础上加强协同。",
      "options": [
        {
          "text": "围绕县域干部班子协同开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域干部班子协同得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域干部班子协同，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域干部班子协同基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域干部班子协同的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域干部班子协同留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "county_government": [
    {
      "title": "岗位专项 · 县政府领导岗位 · 年度重点工作",
      "scene": "县政府近期同时面临产业项目、财政约束和民生诉求，需要在现有资源下排出轻重缓急。",
      "options": [
        {
          "text": "围绕县域项目和财政调度开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县域项目和财政调度得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县域项目和财政调度，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县域项目和财政调度基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县域项目和财政调度的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县域项目和财政调度留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 县政府领导岗位 · 阶段性风险处置",
      "scene": "多个县政府组成部门上报年度计划，部分事项存在交叉，需要明确牵头和配合关系。",
      "options": [
        {
          "text": "围绕县政府组成部门协同开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "县政府组成部门协同得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进县政府组成部门协同，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "县政府组成部门协同基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理县政府组成部门协同的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "县政府组成部门协同留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "district_lead": [
    {
      "title": "岗位专项 · 市辖区党政主官 · 年度重点工作",
      "scene": "作为市辖区党政主官，你需要在城市更新、基层治理和财政约束之间作出统筹安排。",
      "options": [
        {
          "text": "围绕城区更新和财政承受能力开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "城区更新和财政承受能力得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进城区更新和财政承受能力，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "城区更新和财政承受能力基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理城区更新和财政承受能力的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "城区更新和财政承受能力留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市辖区党政主官 · 阶段性风险处置",
      "scene": "城区人口和公共服务需求持续变化，街道、社区和区直部门需要形成治理合力。",
      "options": [
        {
          "text": "围绕市辖区基层治理统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "市辖区基层治理统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进市辖区基层治理统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "市辖区基层治理统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理市辖区基层治理统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "市辖区基层治理统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "district": [
    {
      "title": "岗位专项 · 市辖区班子岗位 · 年度重点工作",
      "scene": "街道、社区和区直部门对一项公共服务改革存在不同理解，需要把政策要求落到基层末梢。",
      "options": [
        {
          "text": "围绕街道社区治理协同开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "街道社区治理协同得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进街道社区治理协同，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "街道社区治理协同基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理街道社区治理协同的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "街道社区治理协同留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市辖区班子岗位 · 阶段性风险处置",
      "scene": "一项城区公共服务改革进入试点阶段，需要平衡街道执行、社区反馈和部门资源。",
      "options": [
        {
          "text": "围绕城区公共服务改革落地开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "城区公共服务改革落地得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进城区公共服务改革落地，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "城区公共服务改革落地基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理城区公共服务改革落地的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "城区公共服务改革落地留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "city_lead": [
    {
      "title": "岗位专项 · 市委市政府领导岗位 · 年度重点工作",
      "scene": "城市面临产业升级、债务约束和公共服务提质等多重任务，需要确定年度主攻方向。",
      "options": [
        {
          "text": "围绕城市发展战略取舍开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "城市发展战略取舍得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进城市发展战略取舍，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "城市发展战略取舍基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理城市发展战略取舍的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "城市发展战略取舍留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市委市政府领导岗位 · 阶段性风险处置",
      "scene": "多个区县上报的风险事项相互关联，市级部门需要从单点处置转向跨区域协同。",
      "options": [
        {
          "text": "围绕市级跨区域风险研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "市级跨区域风险研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进市级跨区域风险研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "市级跨区域风险研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理市级跨区域风险研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "市级跨区域风险研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "city_party": [
    {
      "title": "岗位专项 · 市委常委岗位 · 年度重点工作",
      "scene": "市级干部队伍和基层组织建设进入集中研判阶段，需要把各区县班子运行情况纳入分析。",
      "options": [
        {
          "text": "围绕全市干部队伍研判开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "全市干部队伍研判得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进全市干部队伍研判，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "全市干部队伍研判基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理全市干部队伍研判的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "全市干部队伍研判留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 市委常委岗位 · 阶段性风险处置",
      "scene": "市委确定了跨区县重点任务，多个部门和区县反馈口径不一，需要加强督查协调。",
      "options": [
        {
          "text": "围绕市委重点工作督查协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "市委重点工作督查协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进市委重点工作督查协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "市委重点工作督查协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理市委重点工作督查协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "市委重点工作督查协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "province_lead": [
    {
      "title": "岗位专项 · 省级领导岗位 · 年度重点工作",
      "scene": "省域经济、区域协同和公共服务均衡发展需要统筹推进，部门之间对资源配置存在不同意见。",
      "options": [
        {
          "text": "围绕省域战略协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "省域战略协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进省域战略协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "省域战略协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理省域战略协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "省域战略协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 省级领导岗位 · 阶段性风险处置",
      "scene": "部分地区出现财政、产业和公共安全风险交织的情况，需要建立省域风险会商机制。",
      "options": [
        {
          "text": "围绕区域均衡和重大风险防控开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "区域均衡和重大风险防控得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进区域均衡和重大风险防控，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "区域均衡和重大风险防控基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理区域均衡和重大风险防控的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "区域均衡和重大风险防控留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ],
  "national": [
    {
      "title": "岗位专项 · 国家层面领导岗位 · 年度重点工作",
      "scene": "一项国家层面的重大政策需要兼顾总体目标、地方差异和风险防控，多个部门正在提出意见。",
      "options": [
        {
          "text": "围绕国家政策统筹开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "国家政策统筹得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进国家政策统筹，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "国家政策统筹基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理国家政策统筹的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "国家政策统筹留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    },
    {
      "title": "岗位专项 · 国家层面领导岗位 · 阶段性风险处置",
      "scene": "跨区域重大事项需要统一政策边界，同时为地方差异和动态调整留下规范空间。",
      "options": [
        {
          "text": "围绕跨区域重大风险协调开展调研，建立责任和时限闭环",
          "performance": 3,
          "effect": {
            "reputation": 4,
            "network": 3,
            "seniority": 2
          },
          "result": "跨区域重大风险协调得到系统推进，责任边界和后续节点清晰可查。"
        },
        {
          "text": "按常规程序推进跨区域重大风险协调，定期汇总进度",
          "performance": 1,
          "effect": {
            "seniority": 1,
            "reputation": 1
          },
          "result": "跨区域重大风险协调基本按计划推进，但仍有部分细节需要继续完善。"
        },
        {
          "text": "只看短期指标，暂不处理跨区域重大风险协调的长期风险",
          "performance": -1,
          "effect": {
            "reputation": -3,
            "integrity": -2
          },
          "result": "跨区域重大风险协调留下后续隐患，你在复盘中补做了风险处置。"
        }
      ]
    }
  ]
};
const INVESTIGATION_EVENT = {
  "title": "监督核查",
  "scene": "纪检监督部门对你任职期间的工作流程、项目记录和个人事项开展例行核查。这是规范监督程序，请认真配合。",
  "options": [
    {
      "text": "主动配合并完整提供规范材料",
      "performance": 3,
      "effect": {
        "integrity": 4,
        "reputation": 2,
        "health": -1
      },
      "result": "材料完整、程序规范，核查顺利结束，你的廉政表现得到认可。"
    },
    {
      "text": "按要求补充材料并说明情况",
      "performance": 1,
      "effect": {
        "integrity": 1,
        "health": -2
      },
      "result": "你及时补齐了记录，核查按程序结束。"
    },
    {
      "text": "拖延提供材料且沟通态度消极",
      "performance": -1,
      "effect": {
        "integrity": -8,
        "reputation": -4,
        "health": -2
      },
      "result": "你的配合不够及时，年度廉政评价受到影响。"
    }
  ]
};
const COMPENSATION_BY_RANK = {
  "1": {
    "salary": 64000,
    "providentFund": 13000,
    "annuity": 5000
  },
  "2": {
    "salary": 70000,
    "providentFund": 15000,
    "annuity": 6000
  },
  "3": {
    "salary": 82000,
    "providentFund": 19000,
    "annuity": 7500
  },
  "4": {
    "salary": 94000,
    "providentFund": 23000,
    "annuity": 9000
  },
  "5": {
    "salary": 110000,
    "providentFund": 28000,
    "annuity": 11500
  },
  "6": {
    "salary": 128000,
    "providentFund": 34000,
    "annuity": 14000
  },
  "7": {
    "salary": 148000,
    "providentFund": 41000,
    "annuity": 17000
  },
  "8": {
    "salary": 172000,
    "providentFund": 49000,
    "annuity": 20500
  },
  "9": {
    "salary": 202000,
    "providentFund": 59000,
    "annuity": 25000
  },
  "10": {
    "salary": 236000,
    "providentFund": 70000,
    "annuity": 30000
  },
  "11": {
    "salary": 276000,
    "providentFund": 83000,
    "annuity": 36000
  }
};
const HOUSES = [
  { name: '云汀单身公寓', price: 250000, years: 8 },
  { name: '云汀小户型', price: 350000, years: 10 },
  { name: '云汀家庭两居', price: 500000, years: 10 },
  { name: '云汀改善型三居', price: 700000, years: 12 },
  { name: '云汀城区品质住宅', price: 1000000, years: 15 },
];
const CARS = [
  { name: '二手代步车', price: 50000, years: 2 },
  { name: '实用代步车', price: 80000, years: 3 },
  { name: '新能源家用车', price: 120000, years: 4 },
  { name: '舒适家用车', price: 180000, years: 4 },
  { name: '商务型车辆', price: 280000, years: 5 },
];
module.exports = { RANKS, POSITION_OPTIONS, EVENTS, POSITION_EVENTS, ADDITIONAL_POSITION_EVENTS, INVESTIGATION_EVENT, COMPENSATION_BY_RANK, HOUSES, CARS };
