// 跨年故事占用正常季度事项，每年最多推进一次；选择记录独立于最近 18 条履历保存。
// 只保存节点选择和年份，事件内容按选择重建，关闭页面或读档不会换分支。
function choice(id, text, performance, effect, result, quality = 0) {
  return { id, text, performance, effect, result, quality };
}

const STORIES = [
  {
    id: 'school', title: '老旧学校修缮', minRank: 1, maxRank: 6,
    nodes: [
      {
        title: '雨后的教室', delayYears: 0,
        scene: '云岭小学送来几张雨后教室的照片：屋面渗水，旧线路也需要检查。你参与整理修缮建议，学校希望尽快开工，完整摸排却需要时间。预算和施工由主管部门审批实施，这次先决定建议怎样推进。',
        options: [
          choice('survey', '逐间核对问题，再提出整体修缮建议', 1, { reputation: 1, health: -1 }, '你和学校逐间核对，把漏水、线路和使用需求分别记清。建议递交得晚了一些，但每一项都有依据。', 2),
          choice('phased', '先保急需，提出分期修缮方案', 3, { reputation: 1 }, '你把急需处理的部分先送审，余下问题列入下一期计划。眼前的难处缓了下来，后续仍要持续跟进。', 1),
          choice('patch', '先建议局部修补，保留其余问题清单', 1, { health: 1 }, '局部修补建议很快交了出去，屋面问题先得到处理。旧线路和其他教室的问题留在待办清单里。'),
        ],
      },
      {
        title: '调整后的修缮计划', delayYears: 1,
        scene: steps => ({
          survey: '当年逐间核对的清单派上了用场：方案能区分安全修缮和一般改善。如今可用预算收紧，学校请你帮助说明哪些项目应当优先。',
          phased: '当年分期修缮的第一期已经完成，第二期却遇上预算收紧。学校拿着你留下的计划来问，余下教室今年还能不能排上。',
          patch: '当年的局部修补缓解了漏水，待办清单上的其他问题仍在。新一轮预算又收紧，校方希望你协助补充完整依据。',
        })[steps[0].choiceId],
        options: [
          choice('protect', '补齐依据，优先争取必要修缮', 1, { reputation: 2, health: -1 }, '你把现场情况和轻重缓急重新说明，必要修缮得到优先安排，一般改善继续等候。', 2),
          choice('coordinate', '协调错峰施工，先落地可实施的部分', 3, { network: 1 }, '你协调了教学和施工时段，一部分工程顺利推进，余下项目仍需后续接力。', 1),
          choice('defer', '维持现有安排，将余项转交后续年度', 1, { health: 1, reputation: -1 }, '材料按时移交，未完成部分继续留在计划中。校方理解资源有限，但等待比预想的更长。'),
        ],
      },
      {
        title: '交接清单上的空格', delayYears: 1,
        scene: steps => `学校送来了修缮交接材料。${steps[1].choiceId === 'protect' ? '当年优先争取的必要修缮已经完成，接下来要核实实际使用情况。' : '此前分批安排的项目进展不一，已完成与待完成部分需要分清。'}这次的跟进方式，会影响问题是否被带进下一学年。`,
        options: [
          choice('check', '核对师生反馈，推动问题整改后交接', 3, { reputation: 2, health: -1 }, '你把使用反馈交给负责单位，发现的问题整改后才逐项销号，维护联系人也留在了清单上。', 2),
          choice('handover', '完成分段交接，为余项明确接手人员', 1, { network: 1 }, '已完成部分先交接，余项逐一写明接手人。事情还没有全部结束，但后续有人继续负责。', 1),
          choice('paper', '按现有材料移交，由日常维护继续跟进', 1, { health: 1 }, '材料移交完成，零散问题进入日常维护。各项进展分散在不同记录里，后来查找需要多费一些工夫。'),
        ],
      },
      {
        title: '几年后的回信', delayYears: 2,
        scene: steps => schoolOutcome(steps),
        options: steps => {
          const score = qualityOf('school', steps);
          const outcome = schoolOutcome(steps);
          return [
            choice('visit', '回应学校来信，联系经办人员了解近况', score >= 5 ? 3 : 1, { reputation: score >= 5 ? 4 : score >= 3 ? 2 : 0 }, `${outcome}你回应了学校，也把仍需跟进的情况转给当前负责人员。这段修缮经历有了回音。`),
            choice('archive', '整理当年记录，把经验与问题交给接手人', 1, { seniority: 1, reputation: score >= 5 ? 2 : 0 }, `${outcome}你整理了历年的选择与交接资料，让后来者知道这件事是怎样走到今天的。`),
          ];
        },
      },
    ],
  },
  {
    id: 'backlog', title: '积压事项清理', minRank: 1, maxRank: 11,
    nodes: [
      {
        title: '那一柜旧材料', delayYears: 0,
        scene: '一次旧档整理中，几份反复转交的办事材料被找了出来。有的只差补件，有的涉及职责衔接，还有的已经解决却没有及时回访。你参与提出清理办法，眼前的数量和真正的问题未必是一回事。',
        options: [
          choice('triage', '核对当事人诉求，按实际原因分类', 1, { reputation: 1, health: -1 }, '你逐件核对现状，把补件、协调和已办待回访分开。清理数量暂时不多，原因却逐渐清楚。', 2),
          choice('batch', '先处理手续齐全的一批，再啃难题', 3, { reputation: 1 }, '一批事项很快办结，大家看见了进度，几件复杂事项留到了下一轮。', 1),
          choice('route', '先按职责转交，逐件登记去向', 1, { network: 1 }, '材料去向都有了记录，不过一些事项到了接收部门后，仍需要进一步厘清责任。'),
        ],
      },
      {
        title: '又转回来的三份材料', delayYears: 1,
        scene: steps => ({
          triage: '当年分类记录中的跨部门事项仍未全部办妥。你留下的原因说明让争议集中到几个具体环节，不必再从头猜测。',
          batch: '容易办理的事项已经清完，剩下的几份材料恰好都是当年留下的难题。如今它们又回到协调清单上。',
          route: '当年登记转出的三份材料又回来了，各方都有接收记录，却没有人能说明下一步由谁推动。',
        })[steps[0].choiceId],
        options: [
          choice('coordinate', '核清职责衔接，提出共同办理清单', 1, { network: 2, health: -1 }, '你把争议环节逐项写清，相关人员对照职责确定办理顺序，几份旧材料终于有了可执行的下一步。', 2),
          choice('follow', '逐个联系经办人，先推动能解决的环节', 3, { reputation: 1 }, '几处卡点逐渐打通，但衔接仍依赖经办人之间持续联系。', 1),
          choice('explain', '说明目前进度，继续按既有流程转办', 1, { reputation: -1, health: 1 }, '当事人知道了最新进度，程序也继续往前走，但反复衔接的问题没有彻底解决。'),
        ],
      },
      {
        title: '办结之后再问一句', delayYears: 1,
        scene: steps => `台账上的办结数量增加了。${steps[1].choiceId === 'coordinate' ? '共同办理清单正在使用，需要确认它是否真正减少了往返。' : '几个疑难事项终于有了进展，但经办记录和当事人的感受可能还有差距。'}负责汇总的人请你提出回访建议。`,
        options: [
          choice('callback', '逐件核对难点事项，完善交接与回访办法', 3, { reputation: 2, health: -1 }, '回访发现的小问题被及时补上，办理顺序和交接办法也整理成了可继续使用的记录。', 2),
          choice('sample', '先回访典型事项，保留定期抽查安排', 1, { reputation: 1 }, '几件典型事项的反馈不错，余下事项留待后续抽查，回访开始成为固定安排。', 1),
          choice('forms', '整理现有反馈，完成阶段总结', 1, { seniority: 1 }, '阶段总结如期完成。没有主动反馈的事项暂时未再核对，后续情况依赖新的反映。'),
        ],
      },
      {
        title: '办事窗口的变化', delayYears: 1,
        scene: steps => backlogOutcome(steps),
        options: steps => {
          const score = qualityOf('backlog', steps);
          const outcome = backlogOutcome(steps);
          return [
            choice('review', '把回访结果交给现任经办团队', score >= 5 ? 3 : 1, { reputation: score >= 5 ? 4 : score >= 3 ? 2 : 0 }, `${outcome}你把回访结果转交现任团队，这次清理留下的经验和不足都有了明确记录。`),
            choice('record', '留存完整办理经过，供后来者查阅', 1, { seniority: 1 }, `${outcome}那一柜旧材料最终被整理成可追溯的办理经过，你也记住了数字之外的差别。`),
          ];
        },
      },
    ],
  },
  {
    id: 'mentor', title: '青年同事培养', minRank: 3, maxRank: 11,
    nodes: [
      {
        title: '新同事的第一份方案', delayYears: 0,
        scene: '青年同事小林第一次参加你参与指导的专项工作。方案很认真，却没分清问题轻重。他希望得到修改建议，眼前又有一个紧迫的提交期限。',
        options: [
          choice('coach', '讲清判断依据，让他自己重做一遍', 1, { reputation: 1, health: -1 }, '你没有替他直接改完，而是一起理清目标和边界。方案提交慢了一点，小林开始知道为什么这样写。', 2),
          choice('pair', '共同修改关键部分，先完成这次任务', 3, { network: 1 }, '方案顺利交出，小林跟着学了一些方法，独立判断仍需要以后慢慢练。', 1),
          choice('template', '给他成熟范本，让他按格式完成', 1, { health: 1 }, '提交时间保住了，格式也没有问题。不过遇到范本之外的情况，小林仍不知道该如何处理。'),
        ],
      },
      {
        title: '第一次独立协调', delayYears: 1,
        scene: steps => ({
          coach: '当年一起推敲方案的小林带来了自己的协调思路。这次情况更复杂，他希望在明确职责边界后独立试一次。',
          pair: '当年与你共同改方案的小林接到新任务。他能把材料写好，但协调遇到分歧时，仍习惯先等你的判断。',
          template: '当年照范本完成任务的小林遇到了没有现成模板的情况。他列了几种做法，却拿不定主意。',
        })[steps[0].choiceId],
        options: [
          choice('lead', '明确边界与复盘节点，让他独立推进', 1, { network: 1, health: -1 }, '你说明需要请示的边界，让小林在职责内独立协调。过程有磕绊，他也第一次把问题从头跟到尾。', 2),
          choice('together', '共同参加关键协调，再逐步交给他', 3, { reputation: 1 }, '关键节点顺利通过，小林积累了经验，不过最困难的判断仍由你们共同完成。', 1),
          choice('takeover', '由熟悉情况的人接手，让他负责记录', 1, { health: 1 }, '任务进度稳定下来，小林整理了完整记录，却少了一次独立承担的机会。'),
        ],
      },
      {
        title: '总结里该写谁的名字', delayYears: 1,
        scene: steps => `专项工作进入总结阶段。${steps[1].choiceId === 'lead' ? '小林独立跟进的过程和关键判断，都能在记录里找到。' : '几位同事各有分工，需要把协作过程说明白。'}你收到征求意见稿，要为下一轮培养安排提出建议。`,
        options: [
          choice('credit', '如实写明个人贡献，建议按能力承担新任务', 3, { reputation: 2 }, '你把每个人的实际贡献写清，并提出相应的培养建议。小林看到了自己的进步，也知道还有哪些能力需要补足。', 2),
          choice('team', '突出团队合作，建议继续轮岗学习', 1, { network: 1 }, '总结保留了协作经过，后续培养转向轮岗，小林还会接触新的工作环节。', 1),
          choice('retain', '建议继续熟悉现有事务，暂缓增加职责', 1, { health: 1 }, '小林留在熟悉的事务中继续积累，工作稳定下来，新的历练机会暂时少了一些。'),
        ],
      },
      {
        title: '几年后的一次重逢', delayYears: 2,
        scene: steps => mentorOutcome(steps),
        options: steps => {
          const score = qualityOf('mentor', steps);
          const outcome = mentorOutcome(steps);
          return [
            choice('listen', '听他讲这些年的经历，交流新的判断', score >= 5 ? 3 : 1, { network: score >= 5 ? 3 : 1, reputation: score >= 5 ? 2 : 0 }, `${outcome}你们聊起当年那份方案，也聊起后来各自学会的事情。培养的结果终于在时间里显现。`),
            choice('notes', '把共同经历整理成一份工作笔记', 1, { seniority: 1 }, `${outcome}你把这段经历写进笔记，留下怎样教、何时放手，以及哪里还可以做得更好的思考。`),
          ];
        },
      },
    ],
  },
];

function qualityOf(id, steps) {
  const story = STORIES.find(item => item.id === id);
  return steps.slice(0, 3).reduce((score, step, index) => {
    const option = story.nodes[index].options.find(item => item.id === step.choiceId);
    return score + (option ? option.quality : 0);
  }, 0);
}

function schoolOutcome(steps) {
  const score = qualityOf('school', steps);
  if (score >= 5) return '一封师生来信寄到了你手上：修缮后的教室平稳用了几个学年，维护交接也一直有人接续。信里还提到了当年那份逐项落实的清单。';
  if (score >= 3) return '学校传来近况：主要教室已经改善，分期安排的余项仍在陆续完成。师生记得你参与的那些协调，也盼着后续维护继续跟上。';
  return '学校传来一份返修与补办清单：当年留下的零散问题陆续显现，接手人员正在重新梳理。眼前曾经省下的工夫，最终成了后来需要补上的工作。';
}

function backlogOutcome(steps) {
  const score = qualityOf('backlog', steps);
  if (score >= 5) return '回访结果送来了：反复往返的事项明显减少，新接手的人也能照清单找到办理路径。那几位曾反复补材料的办事人，终于说起了事情办成之后的日子。';
  if (score >= 3) return '回访结果显示，多数旧事项已经办妥，少数跨部门问题仍需要专人协调。清理确实有成效，稳定接续的办法还要继续完善。';
  return '回访中又出现了熟悉的材料：一些事项虽然转出或报结，实际困难仍未解决。现任团队决定重新核对，从当事人的诉求开始梳理。';
}

function mentorOutcome(steps) {
  const score = qualityOf('mentor', steps);
  if (score >= 5) return '一次工作交流中，你再次遇见小林。他已经能独立负责复杂事项，还在带新同事。他说起当年的那份方案和后来的历练：从反复确认到自己作出判断，走过的每一步都没有白费。';
  if (score >= 3) return '再次见到小林时，他已经成为团队里可靠的协作者。熟悉的事务处理得很稳，遇到新的难题，他仍会主动找人一起商量。';
  return '再次见到小林时，他把熟悉的事务做得很细，但遇到没有范本的问题，仍习惯等待别人拍板。你想起当年几次赶时间的选择，培养需要的空间终究没能凭空长出来。';
}

function optionsOf(node, steps) {
  return typeof node.options === 'function' ? node.options(steps) : node.options;
}

function normalizeProgress(raw, year) {
  const progress = {};
  STORIES.forEach(story => {
    const source = raw && raw[story.id];
    if (!Array.isArray(source)) return;
    const steps = [];
    for (let index = 0; index < Math.min(source.length, story.nodes.length); index += 1) {
      const step = source[index];
      const node = story.nodes[index];
      const selectedYear = Number(step && step.year);
      if (!step || !Number.isInteger(selectedYear) || selectedYear < 1 || selectedYear > year) break;
      if (index && selectedYear < steps[index - 1].year + node.delayYears) break;
      if (!optionsOf(node, steps).some(option => option.id === step.choiceId)) break;
      steps.push({ year: selectedYear, choiceId: step.choiceId });
    }
    if (steps.length) progress[story.id] = steps;
  });
  return progress;
}

function eventFor(state) {
  if (!state || state.ended || state.pendingInterrogation || state.fallDetail || state.quarter < 2) return null;
  const progress = normalizeProgress(state.storyProgress, state.year);
  const lastYear = Math.max(0, ...Object.values(progress).map(steps => steps[steps.length - 1].year));
  if (lastYear >= state.year) return null;
  // 一次只展开一条；等待回访的年份仍然正常处理原有季度事项。
  const active = STORIES.find(story => progress[story.id] && progress[story.id].length < story.nodes.length);
  const story = active || STORIES.find(item => !progress[item.id] && state.rankIndex >= item.minRank && state.rankIndex <= item.maxRank);
  if (!story) return null;
  const steps = progress[story.id] || [];
  const node = story.nodes[steps.length];
  if (steps.length && state.year < steps[steps.length - 1].year + node.delayYears) return null;
  const scene = typeof node.scene === 'function' ? node.scene(steps) : node.scene;
  const memory = steps.length ? `${steps[0].year}年开始的往事。上次在${steps[steps.length - 1].year}年，你选择了「${optionsOf(story.nodes[steps.length - 1], steps.slice(0, -1)).find(option => option.id === steps[steps.length - 1].choiceId).text}」。\n\n` : '';
  const tip = steps.length === story.nodes.length - 1 ? '这是这段经历的最后一次回访，结果将保留在履历记录中。' : '本次选择会记入这段经历，后续按年份继续。';
  return {
    storyId: story.id, storyStep: steps.length, storyYear: state.year,
    title: `跨年故事 · ${story.title}（${steps.length + 1}/${story.nodes.length}）`,
    scene: `${node.title}\n\n${memory}${scene}\n\n${tip}`,
    options: optionsOf(node, steps).map(option => Object.assign({}, option, { effect: Object.assign({}, option.effect) })),
  };
}

function resolveChoice(state, event, option) {
  const current = eventFor(state);
  if (!current || current.storyId !== event.storyId || current.storyStep !== event.storyStep || current.storyYear !== event.storyYear) return null;
  // 页面会打乱选项顺序，必须按 id 记录，不能把屏幕上的第几个当作分支编号。
  const chosen = current.options.find(item => item.id === option.id);
  if (!chosen) return null;
  const progress = normalizeProgress(state.storyProgress, state.year);
  const steps = progress[event.storyId] || [];
  steps.push({ year: state.year, choiceId: chosen.id });
  progress[event.storyId] = steps;
  state.storyProgress = progress;
  const story = STORIES.find(item => item.id === event.storyId);
  const next = story.nodes[steps.length];
  const followUp = next ? `这段经历将在${state.year + next.delayYears}年起继续跟进。` : `「${story.title}」已完成，可在履历记录中回看。`;
  return Object.assign({}, chosen, { result: `${chosen.result}\n${followUp}` });
}

function summary(state) {
  const progress = normalizeProgress(state.storyProgress, state.year);
  return STORIES.filter(story => progress[story.id]).map(story => {
    const steps = progress[story.id];
    const completed = steps.length === story.nodes.length;
    const status = completed ? '已完成' : state.ended ? `人生已结束，停在${steps.length}/4` : `已推进${steps.length}/4`;
    const lines = steps.map((step, index) => {
      const option = optionsOf(story.nodes[index], steps.slice(0, index)).find(item => item.id === step.choiceId);
      return `${step.year}年：${story.nodes[index].title}——${option.text}${completed && index === steps.length - 1 ? `\n${option.result}` : ''}`;
    });
    if (!completed && !state.ended) lines.push(`后续：${steps[steps.length - 1].year + story.nodes[steps.length].delayYears}年起跟进。`);
    return `${story.title}（${status}）\n${lines.join('\n')}`;
  }).join('\n\n');
}

function outcomes(state) {
  const progress = normalizeProgress(state.storyProgress, state.year);
  return STORIES.map(story => {
    const steps = progress[story.id] || [];
    return { id: story.id, title: story.title, completed: steps.length === story.nodes.length, quality: qualityOf(story.id, steps) };
  });
}

module.exports = { normalizeProgress, eventFor, resolveChoice, summary, outcomes };
