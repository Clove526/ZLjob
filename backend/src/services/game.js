import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { llmService } from './llm.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

const PERSONALITY_COUNT = 10

function weightedRandom(weights) {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [key, w] of entries) {
    r -= w
    if (r <= 0) return key
  }
  return entries[entries.length - 1][0]
}

function calculateAffinity(answer, personality) {
  const effects = answer.effects || {}
  const traits = personality.traits || {}
  let score = 0
  let count = 0
  for (const [trait, effect] of Object.entries(effects)) {
    const traitValue = traits[trait] || 0.5
    score += effect * traitValue
    count++
  }
  // 平均分 * 权重系数，控制在 -15 到 +15 范围内
  const avgScore = count > 0 ? score / count : 0
  return Math.max(-15, Math.min(15, Math.round(avgScore * 18)))
}

function getRating(totalScore, game) {
  if (game && game.actingValue <= 15) return 'D'
  if (totalScore >= 450) return 'S'
  if (totalScore >= 350) return 'A'
  if (totalScore >= 250) return 'B'
  if (totalScore >= 150) return 'C'
  return 'D'
}

function getAchievementsForGame(game) {
  const unlocked = []
  const scores = game.interviewers.map(i => i.affinity)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const max = Math.max(...scores)
  const min = Math.min(...scores)
  const totalScore = scores.reduce((a, b) => a + b, 0)

  if (avg >= 90) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach1'))
  if (game.choices.every(c => {
    const q = Object.values(QUESTIONS).find(q => q.id === c.questionId)
    if (!q) return false
    const a = q.answers.find(a => a.id === c.answerId)
    return a && a.type === '坦诚型'
  })) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach2'))
  if (game.choices.some(c => {
    const q = Object.values(QUESTIONS).find(q => q.id === c.questionId)
    if (!q) return false
    const a = q.answers.find(a => a.id === c.answerId)
    return a && a.type === '数据驱动型'
  })) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach3'))
  if (game.choices.some(c => {
    const q = Object.values(QUESTIONS).find(q => q.id === c.questionId)
    if (!q) return false
    const a = q.answers.find(a => a.id === c.answerId)
    return a && a.type === '幽默化解型'
  })) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach4'))
  if (totalScore >= 400) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach5'))
  if (min <= 20 && max >= 80) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach6'))
  if (max - min <= 15) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach7'))
  if (game.round === game.maxRounds && game.choices.length >= 1) {
    const lastAnswer = game.choices[game.choices.length - 1]
    const q = Object.values(QUESTIONS).find(q => q.id === lastAnswer.questionId)
    if (q) {
      const a = q.answers.find(a => a.id === lastAnswer.answerId)
      if (a && a.type === '反问型') unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach8'))
    }
  }
  if (game.role === 'freshman' && avg >= 70) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach9'))
  if (game.choices.length >= 1 && game.choices.every(c => {
    const eff = c.effects || []
    return eff.every(e => e.affinityChange >= 0)
  })) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach10'))

  if (game.actingValue >= 80) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach11'))

  const highFatigueCorrect = game.choices.filter(c => {
    const choiceIndex = game.choices.indexOf(c)
    return c.overallScore >= 60
  }).length
  if (highFatigueCorrect >= 3 && game.mentalFatigue >= 60) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach12'))

  const hasComeback = game.choices.length >= 3 &&
    game.choices.slice(0, 3).every(c => (c.overallScore || 0) < 40) &&
    game.choices.slice(-1).some(c => (c.overallScore || 0) >= 70)
  if (hasComeback) unlocked.push(ACHIEVEMENTS.find(a => a.id === 'ach14'))

  return unlocked.filter(Boolean)
}

const ROLE_EFFECTS = {
  freshman: {
    label: '应届生',
    description: '初始好感度加成：注重稳定性和团队协作的面试官对你更有好感',
    affinityBonus: { stability: 8, teamwork: 5 },
  },
  veteran: {
    label: '资深人士',
    description: '初始好感度加成：注重野心和诚实的面试官对你更有好感',
    affinityBonus: { ambition: 8, honesty: 5 },
  },
  career: {
    label: '转行者',
    description: '初始好感度加成：注重诚实和野心的面试官欣赏你的转型勇气',
    affinityBonus: { honesty: 8, ambition: 5 },
  },
}

const EVENTS = [
  {
    id: 'evt1',
    name: '沉默时刻',
    description: '会议室陷入尴尬的沉默，面试官们表情严肃。本回合你的回答效果将受到更严格的评判。',
    effect: 'critical',
    multiplier: 1.5,
  },
  {
    id: 'evt2',
    name: '技术突袭',
    description: '面试官突然抛出一个技术难题，考验你的临场反应。技术型面试官的本回合权重翻倍。',
    effect: 'tech_focus',
    multiplier: 2.0,
  },
  {
    id: 'evt3',
    name: '意外盟友',
    description: '一位面试官似乎对你很有好感，暗中帮你圆场。随机一位面试官本回合好感度变化额外+10。',
    effect: 'ally',
    multiplier: 10,
  },
  {
    id: 'evt4',
    name: '情报泄露',
    description: '你在面试前意外获得了面试官的评价偏好信息！本回合你可以看到各面试官对各类回答的倾向提示。',
    effect: 'info_leak',
    multiplier: 0,
  },
  {
    id: 'evt5',
    name: '电话打断',
    description: '你的手机突然响起！面试官们的目光聚集在你身上，你需要快速应对这个尴尬局面。本回合精神疲劳度额外+10。',
    effect: 'phone_interrupt',
    multiplier: 1,
  },
  {
    id: 'evt6',
    name: 'HR临时加入',
    description: '一位新的面试官被临时叫来参与面试，你需要重新调整策略应对。',
    effect: 'new_face',
    multiplier: 1,
  },
]

const ACHIEVEMENTS = [
  { id: 'ach1', name: '面霸', description: '所有面试官好感度平均达到90以上', icon: '🏆' },
  { id: 'ach2', name: '老实人', description: '全程只使用坦诚型回答', icon: '😇' },
  { id: 'ach3', name: '数据达人', description: '至少使用过一次数据驱动型回答', icon: '📊' },
  { id: 'ach4', name: '幽默大师', description: '至少使用过一次幽默化解型回答', icon: '😂' },
  { id: 'ach5', name: '总分王者', description: '总好感度达到400以上', icon: '👑' },
  { id: 'ach6', name: '绝地求生', description: '最低好感度≤20且最高好感度≥80', icon: '🔥' },
  { id: 'ach7', name: '端水大师', description: '所有面试官最终好感度极差≤15', icon: '⚖️' },
  { id: 'ach8', name: '反客为主', description: '最后一轮使用反问型回答', icon: '🔄' },
  { id: 'ach9', name: '职场新星', description: '以应届生身份拿到平均好感度70以上', icon: '⭐' },
  { id: 'ach10', name: '零失误', description: '所有回答均未降低任何面试官好感度', icon: '💎' },
  { id: 'ach11', name: '影帝', description: '演技值全程保持在80以上', icon: '🎭' },
  { id: 'ach12', name: '心理大师', description: '在精神疲劳度>60时连续回答正确3题', icon: '🧠' },
  { id: 'ach13', name: '隐藏线探索者', description: '触发任意一条隐藏剧情线', icon: '🔍' },
  { id: 'ach14', name: '绝地反击', description: '从最差表现逆袭到最佳结局', icon: '⚡' },
]

const PERSONALITIES = [
  {
    id: 'p1', name: '张总', title: '技术总监',
    description: '严谨务实，看重技术深度和逻辑性',
    traits: { stability: 0.8, honesty: 0.3, ambition: 0.4, teamwork: 0.5 },
    icon: '👨‍💻',
    appearance: '中年男性，短发，戴眼镜，穿着深蓝色条纹西装，白色衬衫，蓝色领带，表情严肃专业',
    gender: 'male',
  },
  {
    id: 'p2', name: '李姐', title: 'HR 主管',
    description: '温和细致，关注求职者的稳定性和团队融入',
    traits: { stability: 0.9, honesty: 0.6, ambition: 0.3, teamwork: 0.8 },
    icon: '👩‍💼',
    appearance: '中年女性，齐肩短发，穿着白色职业衬衫，佩戴简约项链，面带温和微笑，气质亲和',
    gender: 'female',
  },
  {
    id: 'p3', name: '王总', title: '部门经理',
    description: '结果导向，喜欢有野心、有冲劲的人',
    traits: { stability: 0.3, honesty: 0.5, ambition: 0.9, teamwork: 0.4 },
    icon: '👔',
    appearance: '中年男性，短发干练，穿着黑色西装，白色衬衫，蓝色领带，手持钢笔，目光锐利',
    gender: 'male',
  },
  {
    id: 'p4', name: '陈工', title: '架构师',
    description: '沉默寡言但洞察力极强，讨厌虚假包装',
    traits: { stability: 0.7, honesty: 0.9, ambition: 0.3, teamwork: 0.4 },
    icon: '🧑‍🔬',
  },
  {
    id: 'p5', name: '赵姐', title: '产品负责人',
    description: '思维活跃，喜欢有创造力、沟通能力强的人',
    traits: { stability: 0.4, honesty: 0.5, ambition: 0.6, teamwork: 0.7 },
    icon: '‍🎨',
    appearance: '青年女性，长发披肩，穿着简约白色衬衫，佩戴细框眼镜，表情专注，气质知性',
    gender: 'female',
  },
  {
    id: 'p6', name: '刘总', title: 'VP副总裁',
    description: '激进果断，极度看重野心和执行力，对平庸回答零容忍',
    traits: { stability: 0.2, honesty: 0.3, ambition: 1.0, teamwork: 0.3 },
    icon: '👨‍💼',
  },
  {
    id: 'p7', name: '周姐', title: '资深HRBP',
    description: '老练圆滑，擅长通过细节判断真实性格，关注文化与价值观匹配',
    traits: { stability: 0.7, honesty: 0.8, ambition: 0.4, teamwork: 0.7 },
    icon: '👩‍⚖️',
  },
  {
    id: 'p8', name: '吴工', title: '数据科学家',
    description: '理性冷静，一切用数据说话，喜欢量化思维和逻辑推理',
    traits: { stability: 0.6, honesty: 0.7, ambition: 0.5, teamwork: 0.2 },
    icon: '🧑‍🔬',
  },
  {
    id: 'p9', name: '郑总', title: '运营总监',
    description: '务实高效，关注解决问题的实际能力，不喜欢空谈理论',
    traits: { stability: 0.5, honesty: 0.6, ambition: 0.7, teamwork: 0.6 },
    icon: '👨‍💻',
  },
  {
    id: 'p10', name: '冯姐', title: '财务总监',
    description: '严谨保守，极度关注成本效益和风险控制，讨厌不切实际的回答',
    traits: { stability: 0.9, honesty: 0.7, ambition: 0.2, teamwork: 0.4 },
    icon: '👩‍💼',
  },
]

const QUESTIONS = {
  q1: {
    id: 'q1', category: '缺点类', question_text: '请谈谈你最大的缺点是什么？',
    hints: [
      "💡 实际案例：'我有时在项目紧急时容易过度投入细节，导致整体进度受影响。我正在学习使用时间盒管理法来控制这个问题。'",
      " 数据支撑：'根据过去两次绩效评估的反馈，我在跨部门沟通效率上有提升空间。通过有意识地使用 RACI 矩阵，我的项目协作评分从 3.2 提升到了 4.1。'",
      "⚠️ 避免过于空泛的回答，如'我最大的缺点是太完美主义'",
      "✨ 好的回答会展示真实的缺点+改进措施"
    ],
    answers: [
      { id: 'a1', type: '坦诚型', content: '我有时在项目紧急时容易过度投入细节，导致整体进度受影响。我正在学习使用时间盒管理法来控制这个问题。', effects: { stability: 0.3, honesty: 1.0, ambition: 0.2, teamwork: 0.1 } },
      { id: 'a2', type: '包装型', content: '我最大的缺点是过于追求完美，有时会花太多时间在细节上。', effects: { stability: -0.2, honesty: -0.8, ambition: 0.3, teamwork: 0.0 } },
      { id: 'a3', type: '反问型', content: '我觉得与其说缺点，不如说我在某些方面还有成长空间。比如数据分析能力，我正在通过在线课程提升。您对这个岗位在这方面的要求有多高？', effects: { stability: 0.1, honesty: 0.5, ambition: 0.6, teamwork: 0.2 } },
      { id: 'a4', type: '数据驱动型', content: '根据我过去两次绩效评估的反馈，我在跨部门沟通效率上有提升空间。通过有意识地使用RACI矩阵，我的项目协作评分在半年内从3.2提升到了4.1。', effects: { stability: 0.5, honesty: 0.7, ambition: 0.4, teamwork: 0.3 } },
      { id: 'a5', type: '幽默化解型', content: '我最大的缺点可能是——咖啡喝太多？认真说，我确实有时太急于推进项目，正在学习什么时候该踩刹车而不是踩油门。', effects: { stability: -0.1, honesty: 0.2, ambition: 0.1, teamwork: 0.6 } },
    ],
  },
  q2: {
    id: 'q2', category: '离职原因类', question_text: '你为什么离开上一家公司？', isPressure: true,
    hints: [
      "💡 保持积极态度，不要过多抱怨前公司",
      "🎯 重点说明你对新机会的向往而非对旧环境的不满",
      "⚠️ 避免提及薪资作为主要原因",
      "✨ 好的回答会展示职业规划的连贯性"
    ],
    answers: [
      { id: 'b1', type: '坦诚型', content: '上一家公司业务方向调整，我的岗位被裁撤了。虽然拿了一笔补偿金，但我觉得主动寻找新机会比原地等待更好。', effects: { stability: 0.4, honesty: 0.9, ambition: 0.5, teamwork: 0.2 } },
      { id: 'b2', type: '包装型', content: '我想寻找一个更大的平台来发挥我的能力，上一家公司的发展空间已经不能满足我的成长需求了。', effects: { stability: -0.3, honesty: -0.5, ambition: 0.7, teamwork: 0.1 } },
      { id: 'b3', type: '反问型', content: '主要原因是我想在技术栈上有所转型，从传统开发转向云原生方向。请问贵公司目前在云原生技术栈上的投入如何？', effects: { stability: 0.2, honesty: 0.6, ambition: 0.8, teamwork: 0.1 } },
      { id: 'b4', type: '数据驱动型', content: '我在上家公司待了4年，期间主导了3个中大型项目上线。但去年公司研发预算缩减了40%，技术升级路径变得不明朗，因此我决定寻找技术投入更稳定的平台。', effects: { stability: 0.6, honesty: 0.7, ambition: 0.3, teamwork: 0.2 } },
      { id: 'b5', type: '幽默化解型', content: '说来话长——我们公司的茶水间从胶囊咖啡换成了速溶，我就知道是时候看看外面的世界了。开个玩笑，其实是业务调整后我的方向跟个人规划有些不匹配了。', effects: { stability: 0.0, honesty: 0.1, ambition: 0.2, teamwork: 0.5 } },
    ],
  },
  q3: {
    id: 'q3', category: '职业规划类', question_text: '你未来三年的职业规划是什么？',
    hints: [
      "💡 规划要具体且有阶段性目标",
      "🎯 展示你对行业和岗位的理解深度",
      "⚠️ 避免过于宏大或不切实际的规划",
      "✨ 好的回答会结合个人能力与公司发展"
    ],
    answers: [
      { id: 'c1', type: '坦诚型', content: '我希望第一年完全融入团队，掌握核心业务；第二年独立主导中小型项目；第三年往架构方向积累更多经验。', effects: { stability: 0.7, honesty: 0.8, ambition: 0.6, teamwork: 0.5 } },
      { id: 'c2', type: '包装型', content: '我希望三年内成为团队的技术骨干，带领团队攻克技术难题，为公司创造更大价值。', effects: { stability: 0.2, honesty: -0.3, ambition: 0.7, teamwork: 0.4 } },
      { id: 'c3', type: '反问型', content: '我的规划是短期深耕技术，中长期结合业务理解往技术管理发展。不过这也取决于公司的晋升通道，能请您介绍一下贵公司的技术晋升体系吗？', effects: { stability: 0.4, honesty: 0.5, ambition: 0.8, teamwork: 0.5 } },
      { id: 'c4', type: '数据驱动型', content: '过去两年我完成了3个认证、主导了2个里程碑项目。未来三年我设定了阶段性目标：第一年成为领域专家，第二年具备架构设计能力，第三年能够带领5人以上团队交付成果。', effects: { stability: 0.6, honesty: 0.6, ambition: 0.7, teamwork: 0.4 } },
      { id: 'c5', type: '幽默化解型', content: '短期目标是别让您后悔今天面了我，中期目标是让您觉得当初招到我真是赚到了，长期目标——到时候我再跟您更新第三个版本的计划。', effects: { stability: 0.1, honesty: 0.2, ambition: 0.3, teamwork: 0.7 } },
    ],
  },
  q4: {
    id: 'q4', category: '薪资期望类', question_text: '你对薪资待遇有什么期望？', isPressure: true,
    hints: [
      "💡 提前做好市场调研，了解行业标准",
      "🎯 给出一个合理的范围而不是具体数字",
      "⚠️ 不要一开始就报出过低或过高的数字",
      "✨ 好的回答会展示你对自身价值的清晰认知"
    ],
    answers: [
      { id: 'd1', type: '坦诚型', content: '我目前的薪资是年薪30万左右，根据市场行情和这个岗位的要求，我希望能有20%-30%的增长。当然我也愿意综合考虑整体的福利和发展空间。', effects: { stability: 0.5, honesty: 0.8, ambition: 0.6, teamwork: 0.3 } },
      { id: 'd2', type: '包装型', content: '我更看重这个平台的发展机会，薪资方面我相信公司会根据我的能力给出公正的待遇。', effects: { stability: 0.1, honesty: -0.6, ambition: 0.3, teamwork: 0.2 } },
      { id: 'd3', type: '反问型', content: '我对薪资的期望是基于市场行情和我的经验水平来定的。在谈具体数字之前，我想先了解一下这个岗位的薪资结构和绩效考核方式，方便我做更合理的判断。', effects: { stability: 0.3, honesty: 0.4, ambition: 0.7, teamwork: 0.4 } },
      { id: 'd4', type: '数据驱动型', content: '我调研了过去3个月市场上同级别岗位的薪资范围，大概在35-45万之间。结合我5年的经验、带过3个项目团队，以及持有2个专业认证，我期望的合理范围是38-42万。', effects: { stability: 0.6, honesty: 0.7, ambition: 0.5, teamwork: 0.3 } },
      { id: 'd5', type: '幽默化解型', content: '我希望薪资能让我在交完房租后还敢看一眼火锅店的菜单。说正经的，我做了市场调研，期望范围在合理区间内，不过如果公司食堂好吃的话，我可以适当打折。', effects: { stability: 0.0, honesty: 0.1, ambition: 0.1, teamwork: 0.6 } },
    ],
  },
  q5: {
    id: 'q5', category: '团队冲突类', question_text: '如果你和同事在技术方案上产生严重分歧，你会怎么处理？',
    hints: [
      "💡 强调沟通和数据驱动的决策方式",
      "🎯 展示你的情商和协作能力",
      "⚠️ 避免表现出过于强势或妥协的态度",
      "✨ 好的回答会展示解决问题的方法论"
    ],
    answers: [
      { id: 'e1', type: '坦诚型', content: '我会先充分听取对方的观点，理解他的出发点。然后用数据和原型来验证两种方案的优劣，而不是靠争论来分出高下。如果仍无法达成一致，我会提请团队做技术评审。', effects: { stability: 0.6, honesty: 0.7, ambition: 0.3, teamwork: 0.8 } },
      { id: 'e2', type: '包装型', content: '我通常能够很好地处理分歧，因为我一向以团队目标为重，不会让个人情绪影响判断。', effects: { stability: 0.2, honesty: -0.3, ambition: 0.2, teamwork: 0.5 } },
      { id: 'e3', type: '反问型', content: '我认为技术分歧是好事，说明团队在认真思考。我通常会先确认我们在目标上是否一致，然后再讨论实现路径。贵团队在处理技术方案分歧时一般用什么样的决策机制？', effects: { stability: 0.4, honesty: 0.5, ambition: 0.4, teamwork: 0.7 } },
      { id: 'e4', type: '数据驱动型', content: '我会将两种方案的关键指标（性能、成本、维护复杂度、上线周期）用评分卡量化对比。比如可量化的维度有响应时间、开发人天、故障率等，基于数据而不是观点来做决策。', effects: { stability: 0.7, honesty: 0.6, ambition: 0.4, teamwork: 0.5 } },
      { id: 'e5', type: '幽默化解型', content: '如果分歧不致命，我会提议打一局桌游来决定——赢的人选方案。不过认真的，我会拉上团队一起做个简单的优劣势分析，用事实说话，而不是用嗓门。', effects: { stability: 0.1, honesty: 0.3, ambition: 0.1, teamwork: 0.8 } },
    ],
  },
  q6: {
    id: 'q6', category: '压力应对类', question_text: '你如何应对工作中的高压和 deadline 压力？', isPressure: true,
    hints: [
      "💡 展示你的时间管理和任务拆解能力",
      "🎯 强调你在压力下保持冷静的方法",
      "⚠️ 避免说'我从不感到压力'",
      "✨ 好的回答会展示具体的管理工具和策略"
    ],
    answers: [
      { id: 'f1', type: '坦诚型', content: '面对高压我会先拆解任务优先级，把大目标分解成可执行的小步骤。如果确实超出负荷，我会及时向上反馈而不是硬撑。', effects: { stability: 0.7, honesty: 0.8, ambition: 0.3, teamwork: 0.4 } },
      { id: 'f2', type: '包装型', content: '我抗压能力很强，越有压力我越有动力，从来不会因为 deadline 而影响工作质量。', effects: { stability: -0.2, honesty: -0.6, ambition: 0.6, teamwork: 0.1 } },
      { id: 'f3', type: '反问型', content: '我会用番茄工作法来管理精力，确保高压下仍能保持高效输出。对了，贵团队通常在项目冲刺阶段是如何管理压力和分配任务的呢？', effects: { stability: 0.4, honesty: 0.4, ambition: 0.5, teamwork: 0.4 } },
      { id: 'f4', type: '数据驱动型', content: '在上一家公司，我负责的项目有3次紧急上线，我通过WBS分解将任务粒度控制在4小时以内，配合每日站会同步进度，最终3次都按时交付，延期率为0。', effects: { stability: 0.8, honesty: 0.6, ambition: 0.4, teamwork: 0.4 } },
      { id: 'f5', type: '幽默化解型', content: '我的秘诀是——把 deadline 在心里提前三天，这样最后三天我其实是在放假。严肃地说，合理规划和提前沟通是我对抗压力的法宝。', effects: { stability: 0.2, honesty: 0.2, ambition: 0.2, teamwork: 0.6 } },
    ],
  },
  q7: {
    id: 'q7', category: '项目经验类', question_text: '请分享一个你最有成就感的项目。',
    hints: [
      "💡 使用STAR法则：情境、任务、行动、结果",
      "🎯 重点突出你的个人贡献而非团队成果",
      "⚠️ 避免过于空泛的描述，要有具体数据支撑",
      "✨ 好的回答会展示解决问题的思路和成长"
    ],
    answers: [
      { id: 'g1', type: '坦诚型', content: '最有成就感的是我参与开发的一个内部工单系统，虽然技术难度不算高，但它将团队的处理效率提升了60%。看到大家真实地用上了我的成果，那种感觉很棒。', effects: { stability: 0.5, honesty: 0.8, ambition: 0.4, teamwork: 0.6 } },
      { id: 'g2', type: '包装型', content: '我曾主导过一个千万级用户量的平台重构项目，从架构设计到上线全链路把控，最终项目获得了公司年度技术创新奖。', effects: { stability: -0.1, honesty: -0.5, ambition: 0.8, teamwork: 0.3 } },
      { id: 'g3', type: '反问型', content: '我最自豪的是一个性能优化项目，将系统核心接口的延迟从800ms降到了50ms。这个过程中我学到了很多。贵公司目前在性能优化方面有什么样的技术挑战？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.7, teamwork: 0.4 } },
      { id: 'g4', type: '数据驱动型', content: '去年我主导的订单系统重构项目，上线后系统可用性从99.5%提升到99.99%，QPS提升3倍，年度故障次数从12次降为0次，直接节省运维成本约40万/年。', effects: { stability: 0.6, honesty: 0.7, ambition: 0.6, teamwork: 0.3 } },
      { id: 'g5', type: '幽默化解型', content: '最有成就感的项目是我写的一个自动生成日报的脚本——从此我们团队每天省下了半小时，从此告别了手动编日报的痛苦。有时候解决小痛点的快乐不亚于做大项目。', effects: { stability: 0.1, honesty: 0.3, ambition: 0.2, teamwork: 0.7 } },
    ],
  },
  q8: {
    id: 'q8', category: '失败经历类', question_text: '请分享一次你印象深刻的失败经历。', isPressure: true,
    hints: [
      "💡 真诚地面对失败，不要回避或美化",
      "🎯 重点放在你从中学到的教训和改进措施",
      "⚠️ 避免把失败归咎于外部因素或他人",
      "✨ 好的回答会展示反思能力和成长型思维"
    ],
    answers: [
      { id: 'h1', type: '坦诚型', content: '我曾因为低估了项目复杂度导致延期交付，从那以后我学会了在做计划时留出缓冲时间，并且养成定期复盘的习惯来避免重蹈覆辙。', effects: { stability: 0.6, honesty: 1.0, ambition: 0.2, teamwork: 0.3 } },
      { id: 'h2', type: '包装型', content: '我很少失败，如果非要说的话，有一次因为追求完美导致上线时间比预期晚了一周，但最终质量非常高。', effects: { stability: -0.3, honesty: -0.9, ambition: 0.3, teamwork: 0.0 } },
      { id: 'h3', type: '反问型', content: '我在早期职业生涯中做过一个错误的技术选型，导致后期维护成本很高。这个教训让我学会了在做技术决策前充分调研和做POC验证。您认为做技术选型时最重要的考量因素是什么？', effects: { stability: 0.2, honesty: 0.6, ambition: 0.5, teamwork: 0.3 } },
      { id: 'h4', type: '数据驱动型', content: '有一次我主导的A/B测试因为样本量计算错误，导致结论无效，浪费了3周工时。之后我专门学习了统计知识，后续12次A/B测试全部一次性通过验收。', effects: { stability: 0.5, honesty: 0.8, ambition: 0.4, teamwork: 0.3 } },
      { id: 'h5', type: '幽默化解型', content: '我曾把测试数据库的配置发到了生产环境——幸好发现得早，只造成了5分钟的轻微异常。从那以后我写了个部署前置检查脚本，我的外号也从"事故哥"变成了"脚本侠"。', effects: { stability: 0.0, honesty: 0.4, ambition: 0.1, teamwork: 0.6 } },
    ],
  },
  q9: {
    id: 'q9', category: '优点类', question_text: '你认为自己最突出的优点是什么？',
    hints: [
      "💡 选择与岗位要求匹配的优点来强调",
      "🎯 用具体的例子来证明这个优点",
      "⚠️ 避免过于自夸或列举过多优点",
      "✨ 好的回答会展示自我认知和岗位匹配度"
    ],
    answers: [
      { id: 'i1', type: '坦诚型', content: '我的最大优点是对问题有很强的拆解能力，无论多复杂的任务，我都能把它分解成可执行的小步骤，并且推动落地。', effects: { stability: 0.6, honesty: 0.8, ambition: 0.4, teamwork: 0.5 } },
      { id: 'i2', type: '包装型', content: '我各方面能力都比较均衡，无论是技术、沟通还是管理，我都能胜任。', effects: { stability: 0.1, honesty: -0.4, ambition: 0.5, teamwork: 0.3 } },
      { id: 'i3', type: '反问型', content: '我的强项是快速学习新技术并在实际项目中落地。比如我之前用三周时间从零学会了Flutter并交付了一个MVP。贵团队目前主要使用哪些技术栈？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.7, teamwork: 0.4 } },
      { id: 'i4', type: '数据驱动型', content: '在上一次360度评估中，我在"问题解决"维度获得了4.8/5.0的评分，团队反馈我能在复杂问题中找到关键路径。过去一年我主导解决的P0级故障有7起，平均恢复时间比团队均值快35%。', effects: { stability: 0.5, honesty: 0.7, ambition: 0.5, teamwork: 0.3 } },
      { id: 'i5', type: '幽默化解型', content: '我最擅长把枯燥的事儿变有趣——比如我会把Code Review写成段子，大家都抢着帮我review代码。正经说，我觉得自己的沟通能力和技术能力的组合还算不错。', effects: { stability: 0.1, honesty: 0.3, ambition: 0.2, teamwork: 0.8 } },
    ],
  },
  q10: {
    id: 'q10', category: '行业理解类', question_text: '你如何看待我们这个行业当前的发展趋势？',
    hints: [
      "💡 展示你对行业的持续关注和学习",
      "🎯 结合技术趋势和业务场景进行分析",
      "⚠️ 避免过于泛泛而谈或堆砌流行词",
      "✨ 好的回答会展示深度思考和独特见解"
    ],
    answers: [
      { id: 'j1', type: '坦诚型', content: '我观察到AI和大模型正在深刻改变行业格局，但我觉得核心还是如何将技术与实际业务场景结合。我目前正在学习相关技术，希望能在实际项目中应用。', effects: { stability: 0.4, honesty: 0.7, ambition: 0.6, teamwork: 0.3 } },
      { id: 'j2', type: '包装型', content: '我认为行业正在快速向智能化转型，我一直在密切关注前沿技术动态，并且已经将这些技术应用到我的工作中。', effects: { stability: 0.0, honesty: -0.5, ambition: 0.7, teamwork: 0.2 } },
      { id: 'j3', type: '反问型', content: '我觉得行业目前正在经历从增量到存量的转变，降本增效成了主旋律。不过挑战中也孕育着机会。贵公司在这个趋势下是如何调整技术战略的呢？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.7, teamwork: 0.4 } },
      { id: 'j4', type: '数据驱动型', content: '根据近半年的行业报告，AI相关岗位需求增长了120%，但供给增长只有60%。同时企业端在降本增效上的投入同比增加了45%。我认为掌握AI工具能力将成为未来的基础要求。', effects: { stability: 0.5, honesty: 0.7, ambition: 0.6, teamwork: 0.3 } },
      { id: 'j5', type: '幽默化解型', content: '趋势就是——每个公司都在说要拥抱AI，就像前几年每个公司都在说要上云一样。我觉得保持技术敏锐度很重要，但更重要的是搞清楚什么才是真正能解决问题的技术。', effects: { stability: 0.1, honesty: 0.4, ambition: 0.3, teamwork: 0.5 } },
    ],
  },
  q11: {
    id: 'q11', category: '学习能力类', question_text: '你平时是如何学习新技术的？',
    hints: [
      "💡 展示系统性的学习方法论",
      "🎯 强调实践驱动的学习方式",
      "⚠️ 避免只列举学习资源而不展示学习成果",
      "✨ 好的回答会展示持续学习的习惯和成果"
    ],
    answers: [
      { id: 'k1', type: '坦诚型', content: '我通常会先通过官方文档建立整体认知，然后做一个小的demo项目来实践。如果遇到瓶颈会去社区求助或者请教同事。', effects: { stability: 0.5, honesty: 0.8, ambition: 0.4, teamwork: 0.5 } },
      { id: 'k2', type: '包装型', content: '我学习能力很强，新技术我一般看看文档就能上手，在工作中我经常是团队里第一个掌握新技术的人。', effects: { stability: 0.1, honesty: -0.4, ambition: 0.6, teamwork: 0.2 } },
      { id: 'k3', type: '反问型', content: '我倾向于通过实际项目来驱动学习，边做边学效率最高。当然也会定期阅读技术博客和参加技术分享。贵团队一般会为新技术的学习提供什么样的支持？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.6, teamwork: 0.5 } },
      { id: 'k4', type: '数据驱动型', content: '去年我给自己定了一个目标：每季度系统学习一项新技术。完成了4门在线课程、读了3本技术书籍、输出了12篇技术笔记，并且将其中2项技术用到了工作中。', effects: { stability: 0.6, honesty: 0.7, ambition: 0.5, teamwork: 0.3 } },
      { id: 'k5', type: '幽默化解型', content: '我的学习路径是：遇到问题→搜索→解决问题→忘记→再遇到→这次认真学一下。开玩笑，现在我会系统性地做学习计划和知识沉淀了。', effects: { stability: 0.1, honesty: 0.3, ambition: 0.2, teamwork: 0.6 } },
    ],
  },
  q12: {
    id: 'q12', category: '加班态度类', question_text: '你对加班怎么看？', isPressure: true,
    hints: [
      "💡 展示理性和平衡的态度",
      "🎯 区分必要加班和无效加班",
      "⚠️ 避免过于极端的回答（完全接受或完全拒绝）",
      "✨ 好的回答会展示对工作效率的重视"
    ],
    answers: [
      { id: 'l1', type: '坦诚型', content: '我理解项目紧急时加班是必要的，但我不提倡无效加班。如果是项目需要，我会全力配合；如果是效率问题，我更倾向于优化工作方式而不是靠堆时间。', effects: { stability: 0.5, honesty: 0.9, ambition: 0.3, teamwork: 0.5 } },
      { id: 'l2', type: '包装型', content: '我没有问题，年轻就应该多拼一拼，我随时可以为项目奉献时间。', effects: { stability: -0.2, honesty: -0.6, ambition: 0.7, teamwork: 0.3 } },
      { id: 'l3', type: '反问型', content: '我觉得关键不是加不加班，而是工作目标是否清晰。如果加班能带来更好的产出，我不排斥。请问贵团队通常什么情况下需要加班，频率大概如何？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.5, teamwork: 0.4 } },
      { id: 'l4', type: '数据驱动型', content: '在上家公司，我所在团队的平均加班时长是每月20小时，而我通过优化自动化流程，将个人平均加班控制在8小时以内，同时保持了绩效在前25%。', effects: { stability: 0.7, honesty: 0.7, ambition: 0.4, teamwork: 0.4 } },
      { id: 'l5', type: '幽默化解型', content: '我的态度是：加班可以，但别让加班成为常态，不然我怕我会和我的工位产生感情。该拼的时候绝不退缩，但我也相信高效的8小时胜过低效的12小时。', effects: { stability: 0.1, honesty: 0.3, ambition: 0.2, teamwork: 0.6 } },
    ],
  },
  q13: {
    id: 'q13', category: '团队角色类', question_text: '你在团队中通常扮演什么样的角色？',
    hints: [
      "💡 根据实际情况选择最贴切的角色描述",
      "🎯 用具体事例来支撑你的角色定位",
      "⚠️ 避免过度夸大自己的作用或角色",
      "✨ 好的回答会展示团队协作意识和自我认知"
    ],
    answers: [
      { id: 'm1', type: '坦诚型', content: '我通常扮演的是"推动者"的角色，擅长把讨论转化为行动计划，并督促大家按时间节点推进。当然有时候也会充当组内的"文档小能手"。', effects: { stability: 0.5, honesty: 0.7, ambition: 0.5, teamwork: 0.7 } },
      { id: 'm2', type: '包装型', content: '我在团队中既是技术核心也是领导者，大家遇到问题都会来找我，我也总能给出解决方案。', effects: { stability: -0.1, honesty: -0.5, ambition: 0.7, teamwork: 0.3 } },
      { id: 'm3', type: '反问型', content: '我适应能力比较强，会根据团队需要灵活切换角色。有时候是技术攻坚、有时候是协调者。贵团队目前最需要什么样角色的人来补位呢？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.5, teamwork: 0.7 } },
      { id: 'm4', type: '数据驱动型', content: '在最近3个项目中，我分别担任过技术负责人（1次）、核心开发（1次）、Code Review负责人（1次）。团队对我的评价是"能兜底、善协作"，代码Review通过率98%。', effects: { stability: 0.6, honesty: 0.6, ambition: 0.4, teamwork: 0.6 } },
      { id: 'm5', type: '幽默化解型', content: '我是团队里的"万能胶"——哪里缺人补哪里。前端不行我上，后端忙不过来我帮忙，文档没人写我来。开玩笑的，其实我的专长在后端，但我不介意在需要的时候多做一些。', effects: { stability: 0.1, honesty: 0.3, ambition: 0.2, teamwork: 0.9 } },
    ],
  },
  q14: {
    id: 'q14', category: '创新类', question_text: '你有没有过一些创新的想法或者改进措施？',
    hints: [
      "💡 创新不一定是大项目，小改进也很有价值",
      "🎯 重点展示发现问题和解决问题的能力",
      "⚠️ 避免空谈想法而没有实际落地案例",
      "✨ 好的回答会展示主动思考和持续改进的意识"
    ],
    answers: [
      { id: 'n1', type: '坦诚型', content: '我之前提出了一个自动化测试流程改进方案，将回归测试时间从2天缩短到了4小时。不是什么惊天动地的创新，但确实解决了团队的一个实际痛点。', effects: { stability: 0.5, honesty: 0.8, ambition: 0.5, teamwork: 0.5 } },
      { id: 'n2', type: '包装型', content: '我有过很多创新想法，我曾经提出过一个全公司的技术架构改革方案，得到了管理层的高度认可。', effects: { stability: -0.2, honesty: -0.6, ambition: 0.8, teamwork: 0.2 } },
      { id: 'n3', type: '反问型', content: '我做过一个持续集成的优化方案，将构建速度提升了70%。创新不一定是要发明什么新东西，能在现有基础上持续改进也是一种创新。贵公司在这方面有什么鼓励创新的机制吗？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.7, teamwork: 0.4 } },
      { id: 'n4', type: '数据驱动型', content: '去年我提出并落地了3项流程改进：CI/CD流水线优化（构建时间缩短60%）、日志监控体系升级（故障定位时间从2小时降到15分钟）、以及技术文档自动化（文档编写效率提升80%）。', effects: { stability: 0.6, honesty: 0.7, ambition: 0.6, teamwork: 0.4 } },
      { id: 'n5', type: '幽默化解型', content: '我发明了"周五下午不改代码"定律——别笑，自从我们执行了这个规则，线上故障率在周五下降了90%。正经说，我确实有一些流程改进方面的实践，比如自动化了一些重复性工作。', effects: { stability: 0.0, honesty: 0.3, ambition: 0.3, teamwork: 0.7 } },
    ],
  },
  q15: {
    id: 'q15', category: '价值观类', question_text: '你在选择一家公司时最看重什么？',
    hints: [
      "💡 选择与该公司文化相契合的价值观来强调",
      "🎯 展示你对公司的了解和认同感",
      "⚠️ 避免只谈论薪资福利等表面因素",
      "✨ 好的回答会展示长期发展的考虑和文化匹配度"
    ],
    answers: [
      { id: 'o1', type: '坦诚型', content: '我最看重的是技术和业务的匹配度，以及团队的技术氛围。我希望在一个能持续成长、同事之间愿意互相分享的环境里工作。', effects: { stability: 0.5, honesty: 0.8, ambition: 0.5, teamwork: 0.7 } },
      { id: 'o2', type: '包装型', content: '我最看重公司的愿景和价值观，我希望加入一个能改变世界的公司，和优秀的人一起做有意义的事。', effects: { stability: 0.0, honesty: -0.5, ambition: 0.6, teamwork: 0.3 } },
      { id: 'o3', type: '反问型', content: '我比较关注三个维度：技术成长空间、团队氛围、以及公司对技术创新的投入力度。能请您介绍一下贵公司在技术建设方面的规划和团队文化吗？', effects: { stability: 0.3, honesty: 0.5, ambition: 0.6, teamwork: 0.6 } },
      { id: 'o4', type: '数据驱动型', content: '根据我的择业评估模型，我关注五个维度：技术栈匹配度（权重30%）、成长空间（25%）、薪酬福利（20%）、团队氛围（15%）、通勤时间（10%）。按此标准，贵公司在技术栈和发展空间上都很有吸引力。', effects: { stability: 0.6, honesty: 0.6, ambition: 0.5, teamwork: 0.4 } },
      { id: 'o5', type: '幽默化解型', content: '我选公司的标准其实跟选餐厅差不多：菜好吃（业务有意思）、环境好（团队氛围好）、能吃饱（薪资到位）。来之前我做了功课，贵公司在三个方面口碑都不错。', effects: { stability: 0.1, honesty: 0.3, ambition: 0.2, teamwork: 0.7 } },
    ],
  },
}

const ENDINGS = [
  {
    id: 'e1', name: '完美录用',
    description: '三位面试官对你都非常满意！你的回答精准地契合了每个人的期待。HR觉得你稳定可靠，技术主管认可你的专业深度，部门经理欣赏你的进取心。恭喜你，拿到了最优offer！',
    conditions: { minScore: 75 },
  },
  {
    id: 'e2', name: '超高薪资',
    description: '你的表现彻底征服了所有面试官，他们对你的评价之高前所未有！公司决定为你破例提供高于标准的薪资 package，这是对顶级人才的认可。',
    conditions: { avgScore: 90, minScore: 75 },
  },
  {
    id: 'e3', name: '技术认可',
    description: '技术主管对你青睐有加，但HR对你的稳定性有些疑虑。虽然拿到了offer，但薪资谈判时可能没有太多优势。建议入职后用实力证明自己。',
    conditions: { maxScore: 80, minScore: 40 },
  },
  {
    id: 'e4', name: '内推其他部门',
    description: '虽然你与当前岗位的面试官们气场不太合，但有一位面试官非常欣赏你的特质，认为你更适合公司的另一个部门。对方愿意帮你内推，也算是一个不错的机会！',
    conditions: { maxScore: 75, minScore: 20, hasExtremeLow: true },
  },
  {
    id: 'e5', name: '勉强通过',
    description: '面试官们对你的评价褒贬不一。虽然最终拿到了offer，但大家都觉得你还需要更多考察。试用期可能会比较艰难，建议入职后快速证明自己。',
    conditions: { avgScore: 45 },
  },
  {
    id: 'e6', name: '备用候选',
    description: '你的表现中规中矩，没有特别亮眼但也无明显失误。公司决定把你列入备用候选名单，如果有更合适的人选可能就没有机会了。建议主动跟进表达诚意。',
    conditions: { avgScore: 30 },
  },
  {
    id: 'e7', name: '实习生offer',
    description: '面试官认为你虽然目前能力与岗位要求还有差距，但你的学习态度和潜力值得培养。公司愿意提供一个实习生的岗位，表现优秀可以转正。',
    conditions: { avgScore: 15 },
  },
  {
    id: 'e8', name: '遗憾淘汰',
    description: '你的回答触犯了多位面试官的雷区。技术主管觉得你不够扎实，HR觉得你不稳定。这次面试以失败告终，但每次失败都是成长的机会，加油！',
    conditions: { avgScore: 0 },
  },
  {
    id: 'e9', name: '💀 被识破了！',
    description: '你的演技值已经耗尽！面试官们早已看穿了你的"剧本"——你的紧张、你的伪装、你的每一个精心设计的回答在专业面试官面前都无所遁形。张总皱眉摇头，李姐露出意味深长的微笑。这场面试以最尴尬的方式收场...',
    conditions: { hidden: true, actingBreakdown: true },
  },
  {
    id: 'e10', name: '🔥 绝地反击！',
    description: '没人看好你，但你偏偏做到了！前几个回合的表现堪称灾难，却在最后一轮给出了教科书级别的回答。面试官们面面相觑，这个候选人到底是运气还是实力？不管怎样，他们决定给你一个机会。隐藏成就解锁！',
    conditions: { hidden: true, comeback: true },
  },
  {
    id: 'e11', name: '🌸 黑莲花',
    description: '你的策略让面试官们产生了极端的分歧——有人对你青睐有加，有人对你深恶痛绝。这种两极分化的反应说明你是个极具争议的候选人。也许公司确实有适合你的位置，但不是所有人都欢迎你。',
    conditions: { hidden: true, extremeSplit: true },
  },
]

const STAGE_MAPPING = {
  stage1: {
    name: '第1关 · 指引者·李姐',
    interviewerId: 'p2',
    bossName: '指引者·李姐',
    bossTitle: 'HR 导师',
    initialHP: 45,
    categories: ['缺点类', '离职原因类', '职业规划类', '薪资期望类', '加班态度类', '价值观类'],
  },
  stage2: {
    name: '第2关 · 技术法师·张总',
    interviewerId: 'p1',
    bossName: '技术法师·张总',
    bossTitle: '技术导师',
    initialHP: 55,
    categories: ['项目经验类', '学习能力类', '创新类', '行业理解类'],
  },
  stage3: {
    name: '第3关 · 暗影裁决·王总',
    interviewerId: 'p3',
    bossName: '暗影裁决·王总',
    bossTitle: '总监Boss',
    initialHP: 65,
    categories: ['团队冲突类', '压力应对类', '失败经历类', '优点类', '团队角色类'],
  },
}

const STAGE_ORDER = ['stage1', 'stage2', 'stage3']

const CARDS = [
  { id: 'c1', name: '技术之证', icon: '🃏', description: '第2关获得，展现技术深度', condition: (roundData, analysis) => analysis?.strategyType === '数据驱动型' || analysis?.overallScore >= 70 },
  { id: 'c2', name: '沟通之证', icon: '🃏', description: '展现清晰的表达和沟通能力', condition: (roundData, analysis) => analysis?.strategyType === '反问型' || analysis?.overallScore >= 65 },
  { id: 'c3', name: '逻辑之证', icon: '🃏', description: '展现结构化思维和逻辑推理', condition: (roundData, analysis) => analysis?.strategyType === '坦诚型' && analysis?.overallScore >= 60 },
  { id: 'c4', name: '坚韧之证', icon: '🃏', description: '在压力问题中表现出色', condition: (roundData, analysis) => roundData?.isPressure && analysis?.overallScore >= 65 },
  { id: 'c5', name: '协作之证', icon: '🃏', description: '展现团队意识和协作精神', condition: (roundData, analysis) => analysis?.strategyType === '幽默化解型' || analysis?.overallScore >= 60 },
]

const ENDING_RANKINGS = [
  { id: 'S', name: 'S级 · 完美录用', minCards: 5, minHP: 50, description: '高级职位Offer + 隐藏剧情解锁！赵姐出现祝贺，原来她是最终的隐藏考官。' },
  { id: 'A', name: 'A级 · 成功录用', minCards: 4, minHP: 30, description: '理想职位Offer！面试官们对你赞赏有加。' },
  { id: 'B', name: 'B级 · 有条件录用', minCards: 3, minHP: 10, description: '职位降级或试用期延长。面试官觉得你有潜力但还需要培养。' },
  { id: 'C', name: 'C级 · 待定', minCards: 1, minHP: 0, description: '进入备选名单，需要补试。你的表现中规中矩。' },
  { id: 'D', name: 'D级 · 未通过', minCards: 0, minHP: -1, description: '面试失败。你的HP归零，面试被提前终止...但重生者永不放弃！' },
]

export const gameService = {
  async createGame(role = 'freshman', equippedTalents = []) {
    // 三关 Boss 映射
    const stageBossIds = STAGE_ORDER.map(s => STAGE_MAPPING[s].interviewerId)
    
    let allPersonalities
    if (supabase) {
      const { data } = await supabase
        .from('interviewer_personalities')
        .select('*')
      allPersonalities = data
    } else {
      allPersonalities = PERSONALITIES
    }

    if (!allPersonalities || allPersonalities.length === 0) {
      allPersonalities = PERSONALITIES
    }

    // 选择三关 Boss，加上 p5(赵姐)作为隐藏角色
    const selectedIds = [...stageBossIds, 'p5']
    const selected = selectedIds
      .map(id => allPersonalities.find(p => p.id === id))
      .filter(Boolean)
      .map(p => {
        let baseAffinity = 50
        const roleEffect = ROLE_EFFECTS[role]
        if (roleEffect) {
          const bonus = roleEffect.affinityBonus
          for (const [trait, value] of Object.entries(bonus)) {
            baseAffinity += Math.round((p.traits[trait] || 0.5) * value)
          }
        }
        return {
          ...p,
          affinity: Math.max(20, Math.min(80, baseAffinity)),
        }
      })

    // 按关卡类别分配题目，每关 3-4 题
    const stageQuestions = {}
    for (const stageId of STAGE_ORDER) {
      const stage = STAGE_MAPPING[stageId]
      const matchingQuestions = Object.values(QUESTIONS)
        .filter(q => stage.categories.includes(q.category))
        .sort(() => Math.random() - 0.5)
      stageQuestions[stageId] = matchingQuestions.slice(0, 3)
    }

    // 所有关卡题目按顺序排列
    const allStageQuestions = STAGE_ORDER.flatMap(sId => stageQuestions[sId])

    const eventCount = Math.random() < 0.5 ? 1 : 2
    const shuffledEvents = [...EVENTS].sort(() => Math.random() - 0.5)
    const boundEvents = shuffledEvents.slice(0, eventCount).map(e => ({
      ...e,
      triggered: false,
    }))

    const gameId = crypto.randomUUID()

    // 初始化各关卡 Boss HP
    const bossHP = {}
    for (const stageId of STAGE_ORDER) {
      bossHP[stageId] = STAGE_MAPPING[stageId].initialHP
    }

    const game = {
      id: gameId,
      role,
      roleLabel: ROLE_EFFECTS[role]?.label || '应届生',
      interviewers: selected,
      currentInterviewerIndex: 0,
      currentStage: 'stage1',
      stageQuestions,
      stageOrder: STAGE_ORDER,
      round: 0,
      maxRounds: allStageQuestions.length,
      questions: allStageQuestions.map(q => q.id),
      choices: [],
      events: boundEvents,
      status: 'playing',
      actingValue: 100,
      mentalFatigue: 0,
      focus: 100,
      playerHP: 100,
      bossHP,
      collectedCards: [],
      strategyHistory: [],
      suspicion: 0,
      scriptUsageCount: 0,
      lastScriptUse: -1,
      scriptHistory: [],
      equippedTalents,
      talentState: {
        deathDefied: false,
        freePeeksUsed: 0,
      },
    }

    // 应用天赋效果
    const TALENT_EFFECTS = {
      t3: (g) => { g.suspicion = Math.max(0, g.suspicion - 10) },
      t4: (g) => {
        const hrBoss = g.interviewers.find(i => i.id === 'p2')
        if (hrBoss) hrBoss.affinity = Math.min(100, hrBoss.affinity + 15)
      },
    }
    for (const tid of equippedTalents) {
      const apply = TALENT_EFFECTS[tid]
      if (apply) apply(game)
    }

    games.set(gameId, game)

    const firstQuestionId = game.questions[0]
    const currentQuestion = allStageQuestions.find(q => q.id === firstQuestionId)

    return {
      id: gameId,
      role,
      roleLabel: game.roleLabel,
      interviewers: selected,
      currentStage: 'stage1',
      stageInfo: STAGE_MAPPING.stage1,
      maxRounds: game.maxRounds,
      actingValue: game.actingValue,
      mentalFatigue: game.mentalFatigue,
      focus: game.focus,
      playerHP: game.playerHP,
      bossHP: game.bossHP,
      collectedCards: game.collectedCards,
      equippedTalents: game.equippedTalents,
      talentState: game.talentState,
      currentQuestion: currentQuestion ? {
        id: currentQuestion.id,
        category: currentQuestion.category,
        question_text: currentQuestion.question_text,
        isPressure: currentQuestion.isPressure || false,
        answers: currentQuestion.answers.map(a => ({
          id: a.id,
          type: a.type,
          content: a.content,
        })),
        hints: currentQuestion.hints || [],
      } : null,
      events: boundEvents.map(e => ({ id: e.id, name: e.name, description: e.description })),
    }
  },

  async processRound(gameId, questionId, answerId, strategy = 'conservative') {
    const game = games.get(gameId)
    if (!game || game.status !== 'playing') {
      throw new Error('Game not found or already finished')
    }

    const currentQuestionId = game.questions[game.round]
    if (questionId && questionId !== currentQuestionId) {
      throw new Error('Question order mismatch: expected ' + currentQuestionId)
    }

    let question, answers
    if (supabase) {
      const { data: qData } = await supabase.from('questions').select('*').eq('id', currentQuestionId).single()
      const { data: aData } = await supabase.from('answers').select('*').eq('question_id', currentQuestionId)
      question = qData
      answers = aData
    } else {
      const q = QUESTIONS[currentQuestionId]
      question = q
      answers = q.answers
    }

    const chosenAnswer = answers.find(a => a.id === answerId)
    if (!chosenAnswer) throw new Error('Invalid answer')

    // 确定当前关卡
    let currentStageId = game.currentStage
    const stage = STAGE_MAPPING[currentStageId]
    const bossInterviewer = game.interviewers.find(i => i.id === stage.interviewerId)
    const skillCheckMod = stage.categories.includes(question.category) ? 1.2 : 0.8

    const activeEvent = game.events.length > 0 && game.round === 0
      ? game.events[0]
      : game.events.length > 1 && game.round === Math.floor(game.maxRounds / 2)
        ? game.events[1]
        : null

    // 策略倍率
    const STRATEGY_MULTIPLIERS = {
      conservative: { damage: 0.7, hpProtection: 0.5, riskLabel: '稳扎稳打' },
      aggressive: { damage: 1.2, hpProtection: 1.0, riskLabel: '主动出击' },
      innovative: { damage: 1.5, hpProtection: 1.0, riskLabel: '出奇制胜' },
      perceptive: { damage: 1.0, hpProtection: 0.8, riskLabel: '见招拆招' },
    }
    const stratConfig = STRATEGY_MULTIPLIERS[strategy] || STRATEGY_MULTIPLIERS.conservative

    // 计算好感度变化
    const roundEffects = game.interviewers.map((interviewer, index) => {
      let affinityChange = calculateAffinity(chosenAnswer, interviewer)

      if (activeEvent && activeEvent.id === 'evt1') {
        affinityChange = Math.round(affinityChange * 1.5)
      }
      if (activeEvent && activeEvent.id === 'evt2') {
        const techAffinity = interviewer.traits.stability + interviewer.traits.honesty
        if (techAffinity >= 1.2) {
          affinityChange = Math.round(affinityChange * 2)
        }
      }

      return { interviewerId: interviewer.id, name: interviewer.name, affinityChange }
    })

    // 计算回答质量评分 (0-100)
    const bossEffect = roundEffects.find(e => e.interviewerId === stage.interviewerId)
    let rawScore = Math.max(0, Math.min(100, 50 + (bossEffect?.affinityChange || 0) * 2))

    // 天赋加成：t1 技术类问题 +10%
    if (game.equippedTalents.includes('t1')) {
      const techCategories = ['项目经验类', '学习能力类', '创新类', '行业理解类']
      if (techCategories.includes(question.category)) {
        rawScore = Math.min(100, Math.round(rawScore * 1.1))
      }
    }
    // 天赋加成：t8 幽默化解型 +15%
    if (game.equippedTalents.includes('t8') && chosenAnswer.type === '幽默化解型') {
      rawScore = Math.min(100, Math.round(rawScore * 1.15))
    }
    const isExcellent = rawScore >= 75
    const isGood = rawScore >= 55
    const isOk = rawScore >= 35
    const scoreLabel = isExcellent ? 'Excellent' : isGood ? 'Good' : isOk ? 'OK' : 'Poor'

    // 计算伤害
    let baseDamage = 0
    if (isExcellent) baseDamage = 20 + Math.floor(Math.random() * 8)  // 20-27
    else if (isGood) baseDamage = 12 + Math.floor(Math.random() * 6)  // 12-17
    else if (isOk) baseDamage = 6 + Math.floor(Math.random() * 4)     // 6-9
    else baseDamage = -3

    // 成功判定（用于策略风险）
    const success = rawScore >= 40
    const damage = success
      ? Math.round(baseDamage * stratConfig.damage * skillCheckMod)
      : Math.round((baseDamage - 5) * stratConfig.damage)

    const hpDamage = success
      ? 0
      : Math.round((10 + Math.floor(Math.random() * 6)) * (success ? 0 : stratConfig.hpProtection))

    // 更新 Boss HP（伤害不能使HP低于0）
    const currentBossHP = game.bossHP[currentStageId] || 0
    const newBossHP = Math.max(0, currentBossHP - damage)
    game.bossHP[currentStageId] = newBossHP

    // 更新玩家 HP
    let newPlayerHP = Math.max(0, Math.min(100, game.playerHP - hpDamage + (isExcellent ? 5 : 0)))
    // 天赋 t2「死前的觉悟」：HP 归零时保留 1 点
    if (newPlayerHP <= 0 && game.equippedTalents.includes('t2') && !game.talentState.deathDefied) {
      newPlayerHP = 1
      game.talentState.deathDefied = true
    }
    game.playerHP = newPlayerHP

    // 更新好感度
    for (const effect of roundEffects) {
      const interviewer = game.interviewers.find(i => i.id === effect.interviewerId)
      if (interviewer) {
        interviewer.affinity = Math.max(0, Math.min(100, interviewer.affinity + effect.affinityChange))
      }
    }

    // AI 评价生成
    let llmResponse = null
    if (llmService.isAvailable()) {
      try {
        llmResponse = await llmService.generateResponse(question, chosenAnswer, game.interviewers)
      } catch (err) {
        console.error('LLM response failed:', err.message)
      }
    }

    // 卡牌收集判定
    const newCards = []
    for (const card of CARDS) {
      if (game.collectedCards.includes(card.id)) continue
      const roundData = { isPressure: question.isPressure || false }
      const analysis = { strategyType: chosenAnswer.type || '', overallScore: rawScore }
      if (card.condition(roundData, analysis)) {
        newCards.push(card.id)
        game.collectedCards.push(card.id)
      }
    }

    game.strategyHistory.push({ round: game.round, strategy, answerId, score: scoreLabel, damage, hpDamage })

    game.round += 1

    // 检查关卡是否通关
    const bossDefeated = newBossHP <= 0
    let stageCleared = false
    let stageClearedName = null

    if (bossDefeated) {
      stageCleared = true
      stageClearedName = stage.name
      const stageIndex = STAGE_ORDER.indexOf(currentStageId)
      if (stageIndex >= 0 && stageIndex < STAGE_ORDER.length - 1) {
        game.currentStage = STAGE_ORDER[stageIndex + 1]
      } else {
        // 所有关卡通关
        game.status = 'finished'
      }
    }

    // 检查玩家是否失败
    const playerDefeated = newPlayerHP <= 0
    if (playerDefeated) {
      game.status = 'finished'
    }

    // 检查是否所有题目已用完
    if (!game.status || game.status !== 'finished') {
      if (game.round >= game.maxRounds) {
        game.status = 'finished'
      }
    }

    game.choices.push({
      round: game.round,
      questionId: currentQuestionId,
      answerId,
      strategy,
      effects: roundEffects,
      eventTriggered: activeEvent ? { id: activeEvent.id, name: activeEvent.name } : null,
      llmResponse,
      score: scoreLabel,
      rawScore,
      damage,
      hpDamage,
      collectedCards: newCards,
    })

    const isFinished = game.status === 'finished'
    let nextQuestion = null
    let nextQuestionStage = currentStageId

    if (!isFinished && !bossDefeated) {
      const nextQuestionId = game.questions[game.round]
      if (nextQuestionId) {
        const nq = QUESTIONS[nextQuestionId]
        if (nq) {
          nextQuestion = {
            id: nq.id,
            category: nq.category,
            question_text: nq.question_text,
            isPressure: nq.isPressure || false,
            answers: nq.answers.map(a => ({
              id: a.id, type: a.type, content: a.content,
            })),
            hints: nq.hints || [],
          }
        }
      }
    }

    // 如果 Boss 被打败，准备下一个关卡的第一个问题
    if (bossDefeated && !isFinished) {
      const nextStageId = game.currentStage
      const nextStageQuestions = game.stageQuestions[nextStageId] || []
      if (nextStageQuestions.length > 0) {
        const nq = nextStageQuestions[0]
        nextQuestion = {
          id: nq.id, category: nq.category, question_text: nq.question_text,
          isPressure: nq.isPressure || false,
          answers: nq.answers.map(a => ({ id: a.id, type: a.type, content: a.content })),
          hints: nq.hints || [],
        }
        nextQuestionStage = nextStageId
      }
    }

    return {
      round: game.round,
      maxRounds: game.maxRounds,
      currentStage: game.currentStage,
      stageInfo: STAGE_MAPPING[game.currentStage] || null,
      effects: roundEffects,
      interviewers: game.interviewers,
      currentInterviewerIndex: game.currentInterviewerIndex,
      llmResponse,
      eventTriggered: activeEvent ? { id: activeEvent.id, name: activeEvent.name, description: activeEvent.description } : null,
      isFinished,
      playerHP: game.playerHP,
      bossHP: game.bossHP,
      collectedCards: game.collectedCards,
      newCards,
      score: scoreLabel,
      rawScore,
      damage,
      hpDamage,
      strategy: stratConfig.riskLabel,
      bossDefeated,
      stageCleared,
      stageClearedName,
      playerDefeated,
      nextQuestionStage: bossDefeated ? game.currentStage : nextQuestionStage,
      nextQuestion,
      equippedTalents: game.equippedTalents,
      talentState: game.talentState,
      deathDefied: game.talentState.deathDefied,
    }
  },

  async processFreeTextRound(gameId, questionId, answerText, { timeSpent = 0, wasPressure = false } = {}) {
    const game = games.get(gameId)
    if (!game || game.status !== 'playing') {
      throw new Error('Game not found or already finished')
    }

    const currentQuestionId = game.questions[game.round]
    if (questionId && questionId !== currentQuestionId) {
      throw new Error('Question order mismatch: expected ' + currentQuestionId)
    }

    let currentQuestion
    if (supabase) {
      const { data: qData } = await supabase.from('questions').select('*').eq('id', currentQuestionId).single()
      currentQuestion = qData
    } else {
      currentQuestion = QUESTIONS[currentQuestionId]
    }

    if (!currentQuestion) throw new Error('Question not found')

    const isPressureQuestion = currentQuestion.isPressure || wasPressure
    const interviewers = game.interviewers

    // AI生成场景描述
    let sceneDescription = null
    if (llmService.isAvailable()) {
      try {
        sceneDescription = await llmService.generateSceneDescription(
          game.round + 1,
          currentQuestion.question_text,
          interviewers,
          { actingValue: game.actingValue, mentalFatigue: game.mentalFatigue },
          isPressureQuestion
        )
      } catch (err) {
        console.error('Scene description generation failed:', err.message)
      }
    }

    const analysisPrompt = `你是一位专业的面试评估AI。请分析以下面试回答。

【当前问题】
${currentQuestion.question_text}
【问题类别】${currentQuestion.category}
${isPressureQuestion ? '\n【注意】这是一个压力问题！面试官在考察临场反应能力。' : ''}

【用户当前状态】
- 演技值: ${game.actingValue}/100 (越高代表演技越好)
- 精神疲劳度: ${game.mentalFatigue}/100 (越高代表越疲劳)

【用户回答】
${answerText}

【${interviewers.length}位面试官性格特征】
${interviewers.map(iv => `- ${iv.name}(${iv.title}): ${iv.description} 性格特点:${Object.entries(iv.traits || {}).map(([k,v]) => `${k}:${v}`).join(', ')}`).join('\n')}

请以JSON格式返回分析结果（不要其他文字）：
{
  "analysis": "简要分析用户回答的质量和特点（2-3句话），包含对演技表现的评价",
  "effects": [
    {"interviewerId": "面试官ID", "affinityChange": 数值(-20到+20), "reason": "该面试官对此回答的具体反应"}
  ],
  "strategyType": "判断用户使用的主要策略类型(坦诚型/包装型/反问型/数据驱动型/幽默化解型)",
  "overallScore": 0-100的综合评分,
  "innerMonologue": "一段面试官的内心独白或环境氛围描述(20-40字)"
}

注意：
- affinityChange应该是合理的数值，基于面试官性格和回答匹配度
- 不同面试官可能对同一回答有完全不同的反应
- overallScore应该反映回答的整体质量
- 如果演技值较低（<50），面试官更容易识破不真实的回答`

    let analysisResult
    try {
      const analysisResponse = await llmService.chat(analysisPrompt, { temperature: 0.7 })
      const cleanedResponse = analysisResponse.replace(/```json\n?|\n?```/g, '').trim()
      analysisResult = JSON.parse(cleanedResponse)
    } catch (err) {
      console.error('LLM analysis failed:', err.message)
      analysisResult = {
        analysis: '无法完成智能分析，使用默认评分',
        effects: interviewers.map(iv => ({
          interviewerId: iv.id,
          affinityChange: 0,
          reason: '系统默认评分'
        })),
        strategyType: '未知',
        overallScore: 50,
        innerMonologue: '面试官们交换了一个眼神，似乎在评估你的回答。'
      }
    }

    const overallScore = analysisResult.overallScore || 50
    const effectsArray = (analysisResult.effects || []).map(effect => ({
      interviewerId: effect.interviewerId,
      affinityChange: Math.max(-20, Math.min(20, effect.affinityChange || 0)),
      reason: effect.reason || ''
    }))

    for (const effect of effectsArray) {
      const interviewer = game.interviewers.find(i => i.id === effect.interviewerId)
      if (interviewer) {
        interviewer.affinity = Math.max(0, Math.min(100, interviewer.affinity + effect.affinityChange))
      }
    }

    const actingCost = isPressureQuestion ? 15 : 8
    const actingRestore = overallScore >= 70 ? 5 : overallScore <= 30 ? -10 : 0
    game.actingValue = Math.max(5, Math.min(100, game.actingValue - actingCost + actingRestore))

    const fatigueGain = isPressureQuestion ? 15 : 8
    const fatigueRecovery = overallScore >= 70 ? -3 : 0
    game.mentalFatigue = Math.max(0, Math.min(100, game.mentalFatigue + fatigueGain + fatigueRecovery))

    game.focus = Math.max(10, Math.min(100, game.focus - 5))

    // === 自由文本模式:根据 AI overallScore 扣减 Boss HP(与选择题模式一致) ===
    const currentStageId = game.currentStage
    const stage = STAGE_MAPPING[currentStageId]
    const isExcellent = overallScore >= 75
    const isGood = overallScore >= 55
    const isOk = overallScore >= 35
    const scoreLabel = isExcellent ? 'Excellent' : isGood ? 'Good' : isOk ? 'OK' : 'Poor'

    let baseDamage = 0
    if (isExcellent) baseDamage = 20 + Math.floor(Math.random() * 8)  // 20-27
    else if (isGood) baseDamage = 12 + Math.floor(Math.random() * 6)  // 12-17
    else if (isOk) baseDamage = 6 + Math.floor(Math.random() * 4)     // 6-9
    else baseDamage = -3  // 差回答:boss 回血

    const damage = baseDamage
    const currentBossHP = game.bossHP[currentStageId] || 0
    const newBossHP = Math.max(0, currentBossHP - damage)
    game.bossHP[currentStageId] = newBossHP

    // 玩家 HP:压力问题或高精神疲劳时小幅扣血
    let hpDamage = 0
    if (isPressureQuestion) hpDamage = 5
    if (game.mentalFatigue >= 80) hpDamage += 3

    let newPlayerHP = Math.max(0, Math.min(100, game.playerHP - hpDamage + (isExcellent ? 5 : 0)))
    if (newPlayerHP <= 0 && game.equippedTalents.includes('t2') && !game.talentState.deathDefied) {
      newPlayerHP = 1
      game.talentState.deathDefied = true
    }
    game.playerHP = newPlayerHP

    // 检查 Boss 是否被击败 / 关卡通关
    const bossDefeated = newBossHP <= 0
    let stageCleared = false
    let stageClearedName = null
    if (bossDefeated && stage) {
      stageCleared = true
      stageClearedName = stage.name
      const stageIndex = STAGE_ORDER.indexOf(currentStageId)
      if (stageIndex >= 0 && stageIndex < STAGE_ORDER.length - 1) {
        game.currentStage = STAGE_ORDER[stageIndex + 1]
      }
    }
    const playerDefeated = newPlayerHP <= 0

    // 卡牌收集判定
    const newCards = []
    for (const card of CARDS) {
      if (game.collectedCards.includes(card.id)) continue
      const roundData = { isPressure: isPressureQuestion }
      const analysis = { strategyType: analysisResult.strategyType || '', overallScore }
      if (card.condition(roundData, analysis)) {
        newCards.push(card.id)
        game.collectedCards.push(card.id)
      }
    }

    game.strategyHistory.push({ round: game.round, strategy: 'free_text', answerId: 'free_text', score: scoreLabel, damage, hpDamage })

    const mockAnswerForResponse = {
      id: 'free_text',
      type: analysisResult.strategyType || '自由文本',
      content: answerText,
    }

    let llmResponsesMap = {}
    if (llmService.isAvailable()) {
      try {
        const response = await llmService.generateResponse(currentQuestion, mockAnswerForResponse, game.interviewers)
        if (response && typeof response === 'object') {
          llmResponsesMap = response
        } else if (typeof response === 'string') {
          llmResponsesMap = { default: response }
        }
      } catch (err) {
        console.error('LLM response generation failed:', err.message)
        llmResponsesMap = { default: '感谢您的分享，我们继续下一题。' }
      }
    }

    game.round += 1
    game.choices.push({
      round: game.round,
      questionId: currentQuestionId,
      answerId: 'free_text',
      answerText,
      effects: effectsArray,
      eventTriggered: null,
      llmResponse: llmResponsesMap,
      analysis: analysisResult.analysis,
      strategyType: analysisResult.strategyType,
      overallScore,
      isPressure: isPressureQuestion,
      timeSpent,
      actingChange: -(actingCost) + actingRestore,
      damage,
      hpDamage,
      score: scoreLabel,
      collectedCards: newCards,
    })

    // 完成判定:轮数耗尽 / 玩家失败 / 所有 Boss 已被击败
    const isAllBossesDefeated = STAGE_ORDER.every(sId => (game.bossHP[sId] || 0) <= 0)
    const isFinished = game.round >= game.maxRounds || playerDefeated || isAllBossesDefeated
    if (isFinished) {
      game.status = 'finished'
    }

    // AI生成剧情分支描述
    let branchNarrative = null
    if (llmService.isAvailable() && !isFinished) {
      try {
        branchNarrative = await llmService.generateBranchNarrative(
          currentQuestion.question_text,
          answerText,
          interviewers,
          { actingValue: game.actingValue, mentalFatigue: game.mentalFatigue }
        )
      } catch (err) {
        console.error('Branch narrative generation failed:', err.message)
      }
    }

    let nextQuestionObj = null
    let nextQuestionStage = currentStageId
    if (!isFinished && !bossDefeated) {
      const nextQuestionId = game.questions[game.round]
      const nq = QUESTIONS[nextQuestionId]
      if (nq) {
        nextQuestionObj = {
          id: nq.id,
          category: nq.category,
          question_text: nq.question_text,
          isPressure: nq.isPressure || false,
          answers: nq.answers.map(a => ({
            id: a.id,
            type: a.type,
            content: a.content,
          })),
          hints: nq.hints || [],
        }
      }
    }

    // Boss 击败后,加载下一关卡的第一题
    if (bossDefeated && !isFinished) {
      const nextStageId = game.currentStage
      const nextStageQuestions = game.stageQuestions[nextStageId] || []
      if (nextStageQuestions.length > 0) {
        const nq = nextStageQuestions[0]
        nextQuestionObj = {
          id: nq.id,
          category: nq.category,
          question_text: nq.question_text,
          isPressure: nq.isPressure || false,
          answers: nq.answers.map(a => ({ id: a.id, type: a.type, content: a.content })),
          hints: nq.hints || [],
        }
        nextQuestionStage = nextStageId
      }
    }

    return {
      round: game.round,
      maxRounds: game.maxRounds,
      currentStage: game.currentStage,
      stageInfo: STAGE_MAPPING[game.currentStage] || null,
      effects: effectsArray,
      interviewers: game.interviewers,
      llmResponse: llmResponsesMap,
      eventTriggered: null,
      isFinished,
      playerHP: game.playerHP,
      bossHP: game.bossHP,
      collectedCards: game.collectedCards,
      newCards,
      score: scoreLabel,
      rawScore: overallScore,
      damage,
      hpDamage,
      bossDefeated,
      stageCleared,
      stageClearedName,
      playerDefeated,
      nextQuestionStage: bossDefeated ? game.currentStage : nextQuestionStage,
      nextQuestion: nextQuestionObj,
      equippedTalents: game.equippedTalents,
      talentState: game.talentState,
      deathDefied: game.talentState.deathDefied,
      analysis: analysisResult.analysis,
      strategyType: analysisResult.strategyType,
      overallScore,
      actingValue: game.actingValue,
      mentalFatigue: game.mentalFatigue,
      focus: game.focus,
      innerMonologue: analysisResult.innerMonologue || null,
      isPressure: isPressureQuestion,
      sceneDescription,
      branchNarrative,
    }
  },

  async processScriptPeek(gameId, questionId) {
    const game = games.get(gameId)
    if (!game || game.status !== 'playing') {
      throw new Error('Game not found or already finished')
    }

    const currentStageId = game.currentStage
    const stage = STAGE_MAPPING[currentStageId]
    const currentInterviewer = game.interviewers.find(i => i.id === stage.interviewerId)
    if (!currentInterviewer) throw new Error('Current interviewer not found')

    // 找到当前题目
    const currentQuestionId = questionId || game.questions[game.round]
    const question = QUESTIONS[currentQuestionId]
    if (!question) throw new Error('Question not found')

    // 计算偷看风险等级
    const roundProgress = game.round / game.maxRounds
    const isPressure = question.isPressure || false
    const isStage3 = currentStageId === 'stage3'
    let riskLevel = 'low'
    if (isStage3) riskLevel = 'high'
    else if (isPressure) riskLevel = 'medium'
    else if (roundProgress > 0.6) riskLevel = 'medium'

    // 基础嫌疑增加值
    const baseSuspicionGain = { low: 5, medium: 8, high: 12 }[riskLevel]
    // 连续偷看惩罚：连续使用剧本额外增加嫌疑
    const consecutivePenalty = game.lastScriptUse === game.round ? 3 : 0
    let suspicionGain = baseSuspicionGain + consecutivePenalty
    // 天赋 t6「轮回之眼」：第一次偷看免费
    if (game.equippedTalents.includes('t6') && game.talentState.freePeeksUsed < 1) {
      suspicionGain = 0
      game.talentState.freePeeksUsed += 1
    }

    // BOSS关(第3关王总)有概率反侦察：生成误导信息
    const counterRecon = isStage3 && Math.random() < 0.3

    // 更新嫌疑值
    game.suspicion = Math.min(100, game.suspicion + suspicionGain)
    game.scriptUsageCount += 1
    game.lastScriptUse = game.round

    // 生成剧本洞察
    let insight = null
    if (llmService.isAvailable()) {
      try {
        const playerState = {
          actingValue: game.actingValue,
          mentalFatigue: game.mentalFatigue,
          focus: game.focus,
          suspicion: game.suspicion,
        }

        // 构建历史摘要
        const historyParts = game.choices.slice(-3).map((c) => {
          const q = QUESTIONS[c.questionId]
          return `第${c.round}轮: 问题="${q?.question_text || '?'}" 评分=${c.overallScore || c.rawScore || '?'} 策略=${c.strategy || c.strategyType || '?'}`
        })
        const historySummary = historyParts.length > 0
          ? historyParts.join('\n')
          : '尚无回答记录'

        insight = await llmService.generateScriptInsight(
          question,
          currentInterviewer,
          playerState,
          historySummary
        )
      } catch (err) {
        console.error('Script insight generation failed:', err.message)
      }
    }

    // 如果 LLM 不可用或失败，使用预设的备用洞察
    if (!insight) {
      insight = {
        innerThought: `${currentInterviewer.name}表面在听你回答，实际上在评估你的${question.category}相关能力。`,
        hiddenDimension: `表面上问${question.category}，实际在考察你的临场应变和思维深度`,
        minefields: ['避免空洞无物的套话', '避免过度自夸', '避免回避问题核心'],
        emotionalState: currentInterviewer.affinity >= 60 ? '态度友好，期待回答' : '态度审慎，仔细观察',
        recommendedStrategy: 'perceptive',
        strategyReason: '察言观色能最大限度利用剧本信息',
        riskLevel: riskLevel,
      }
    }

    // BOSS关反侦察：随机篡改一条信息
    if (counterRecon) {
      const tamperTypes = ['innerThought', 'recommendedStrategy', 'minefields']
      const tamper = tamperTypes[Math.floor(Math.random() * tamperTypes.length)]
      if (tamper === 'innerThought') {
        insight.innerThought = insight.innerThought.replace(
          /评估|考察|关注/g,
          '似乎不太在意'
        ) + '（但这可能是误导...）'
        insight._tampered = true
      } else if (tamper === 'recommendedStrategy') {
        const strategies = ['conservative', 'aggressive', 'innovative', 'perceptive']
        const wrong = strategies.filter(s => s !== insight.recommendedStrategy)
        insight.recommendedStrategy = wrong[Math.floor(Math.random() * wrong.length)]
        insight.strategyReason = '（王总的视线让你有些不安...这个推荐可靠吗？）'
        insight._tampered = true
      } else if (tamper === 'minefields' && insight.minefields) {
        insight.minefields = insight.minefields.map(m => m.replace(/避免|不要|注意/g, '可以'))
        insight._tampered = true
      }
    }

    // 记录偷看行为
    game.scriptHistory.push({
      round: game.round,
      questionId: currentQuestionId,
      riskLevel,
      suspicionGain,
      counterRecon,
      timestamp: Date.now(),
    })

    // 嫌疑值效果描述
    let suspicionEffect = null
    if (game.suspicion >= 100) {
      suspicionEffect = 'critical'
    } else if (game.suspicion >= 80) {
      suspicionEffect = 'warning'
    } else if (game.suspicion >= 50) {
      suspicionEffect = 'noticed'
    }

    return {
      insight,
      suspicion: game.suspicion,
      suspicionGain,
      suspicionEffect,
      riskLevel,
      counterRecon,
      interviewers: game.interviewers.map(i => ({
        id: i.id,
        name: i.name,
        affinity: i.affinity,
      })),
      playerState: {
        actingValue: game.actingValue,
        mentalFatigue: game.mentalFatigue,
        focus: game.focus,
      },
      talentState: game.talentState,
      deathDefied: game.talentState.deathDefied,
    }
  },

  async createDailyGame(equippedTalents = []) {
    // 用日期作为种子生成每日固定场景
    const today = new Date()
    const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()

    // 确定性随机选择角色
    const roles = ['freshman', 'veteran', 'career']
    const role = roles[dateSeed % roles.length]

    // 确定性选择面试官组合
    const allIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']
    const shuffledIds = [...allIds].sort((a, b) => {
      const ha = (a.charCodeAt(1) + dateSeed) % 10
      const hb = (b.charCodeAt(1) + dateSeed) % 10
      return ha - hb
    })

    // 选择：3个stage boss + 1个隐藏角色（避免重复）
    const stageBossIds = [shuffledIds[0], shuffledIds[1], shuffledIds[2]].filter(id => id !== 'p5')
    // 如果过滤后不足3个，补充其他ID
    if (stageBossIds.length < 3) {
      const remaining = allIds.filter(id => !stageBossIds.includes(id) && id !== 'p5')
      stageBossIds.push(...remaining.slice(0, 3 - stageBossIds.length))
    }
    const selectedIds = [...stageBossIds, 'p5']
    const allPersonalities = PERSONALITIES

    const roleEffect = ROLE_EFFECTS[role]
    const selected = selectedIds
      .map(id => allPersonalities.find(p => p.id === id))
      .filter(Boolean)
      .map(p => {
        let baseAffinity = 50
        if (roleEffect) {
          const bonus = roleEffect.affinityBonus
          for (const [trait, value] of Object.entries(bonus)) {
            baseAffinity += Math.round((p.traits[trait] || 0.5) * value)
          }
        }
        return { ...p, affinity: Math.max(20, Math.min(80, baseAffinity)) }
      })

    // 构建关卡映射（每日 BOSS 不同）
    const dailyStageMapping = {}
    for (let si = 0; si < STAGE_ORDER.length; si++) {
      const sId = STAGE_ORDER[si]
      const origStage = STAGE_MAPPING[sId]
      const dailyBoss = selected[si] || selected[0]
      dailyStageMapping[sId] = {
        ...origStage,
        interviewerId: dailyBoss.id,
        bossName: origStage.bossName.replace(/·.+$/, `·${dailyBoss.name}`),
      }
    }

    // 按关-卡类别分配题目
    const stageQuestions = {}
    for (const stageId of STAGE_ORDER) {
      const stage = STAGE_MAPPING[stageId]
      const matchingQuestions = Object.values(QUESTIONS)
        .filter(q => stage.categories.includes(q.category))
        .sort(() => {
          const seed = dateSeed + stageId.charCodeAt(stageId.length - 1)
          return ((seed * 9301 + 49297) % 233280) / 233280 - 0.5
        })
      stageQuestions[stageId] = matchingQuestions.slice(0, 3)
    }

    const allStageQuestions = STAGE_ORDER.flatMap(sId => stageQuestions[sId])

    // 每日事件
    const eventCount = dateSeed % 3 === 0 ? 2 : 1
    const shuffledEvents = [...EVENTS].sort(() => {
      const seed = dateSeed + 7
      return ((seed * 9301 + 49297) % 233280) / 233280 - 0.5
    })
    const boundEvents = shuffledEvents.slice(0, eventCount).map(e => ({ ...e, triggered: false }))

    const gameId = crypto.randomUUID()
    const bossHP = {}
    for (const stageId of STAGE_ORDER) {
      bossHP[stageId] = STAGE_MAPPING[stageId].initialHP
    }

    const dailyThemes = [
      'AI 大模型行业专场', '互联网大厂高压面试', '外企文化适应面试',
      '创业公司多面手面试', '远程办公团队面试', '金融科技风控面试',
      '新能源汽车行业面试', '游戏行业创意面试',
    ]
    const dailyTheme = dailyThemes[dateSeed % dailyThemes.length]

    const game = {
      id: gameId, role, roleLabel: ROLE_EFFECTS[role]?.label || '应届生',
      interviewers: selected,
      currentInterviewerIndex: 0,
      currentStage: 'stage1',
      stageQuestions,
      stageOrder: STAGE_ORDER,
      round: 0,
      maxRounds: allStageQuestions.length,
      questions: allStageQuestions.map(q => q.id),
      choices: [],
      events: boundEvents,
      status: 'playing',
      actingValue: 100, mentalFatigue: 0, focus: 100,
      playerHP: 100, bossHP,
      collectedCards: [], strategyHistory: [],
      suspicion: 0, scriptUsageCount: 0, lastScriptUse: -1, scriptHistory: [],
      equippedTalents,
      talentState: { deathDefied: false, freePeeksUsed: 0 },
      isDaily: true, dailyStageMapping, dailyTheme,
    }

    // 应用天赋
    const TALENT_EFFECTS = {
      t3: (g) => { g.suspicion = Math.max(0, g.suspicion - 10) },
      t4: (g) => {
        const hrBoss = g.interviewers.find((_, idx) => idx === 0)
        if (hrBoss) hrBoss.affinity = Math.min(100, hrBoss.affinity + 15)
      },
    }
    for (const tid of equippedTalents) {
      const apply = TALENT_EFFECTS[tid]
      if (apply) apply(game)
    }

    games.set(gameId, game)

    const firstQuestionId = game.questions[0]
    const currentQuestion = allStageQuestions.find(q => q.id === firstQuestionId)

    return {
      id: gameId, role, roleLabel: game.roleLabel,
      interviewers: selected,
      currentStage: 'stage1',
      stageInfo: dailyStageMapping.stage1 || STAGE_MAPPING.stage1,
      maxRounds: game.maxRounds,
      actingValue: game.actingValue, mentalFatigue: game.mentalFatigue, focus: game.focus,
      playerHP: game.playerHP, bossHP: game.bossHP,
      collectedCards: game.collectedCards,
      equippedTalents: game.equippedTalents, talentState: game.talentState,
      dailyTheme: game.dailyTheme,
      currentQuestion: currentQuestion ? {
        id: currentQuestion.id, category: currentQuestion.category,
        question_text: currentQuestion.question_text,
        isPressure: currentQuestion.isPressure || false,
        answers: currentQuestion.answers.map(a => ({ id: a.id, type: a.type, content: a.content })),
        hints: currentQuestion.hints || [],
      } : null,
      events: boundEvents.map(e => ({ id: e.id, name: e.name, description: e.description })),
    }
  },

  async generateReport(gameId) {
    const game = games.get(gameId)
    if (!game) throw new Error('Game not found')

    const cardCount = game.collectedCards.length
    const bossesDefeated = STAGE_ORDER.filter(sId => (game.bossHP[sId] || 0) <= 0).length
    const totalScore = game.interviewers.reduce((sum, i) => sum + i.affinity, 0)
    const avgScore = game.interviewers.length > 0 ? totalScore / game.interviewers.length : 0

    let rating = 'D'
    if (avgScore >= 90) rating = 'S'
    else if (avgScore >= 75) rating = 'A'
    else if (avgScore >= 60) rating = 'B'
    else if (avgScore >= 40) rating = 'C'

    const gameData = {
      rating,
      cardCount,
      bossesDefeated,
      playerHP: game.playerHP,
      interviewers: game.interviewers,
      choices: game.choices.map(c => ({
        questionText: (QUESTIONS[c.questionId] || {}).question_text || '',
        overallScore: c.overallScore || c.rawScore,
        strategy: c.strategy || c.strategyType,
      })),
    }

    // 基础统计信息（不依赖LLM，作为最终兜底）
    const baseStats = {
      styleAnalysis: `本次面试你完成了 ${gameData.choices.length} 道题，击败 ${gameData.bossesDefeated}/3 位 Boss，收集 ${gameData.cardCount}/5 张能力卡牌，最终评级 ${gameData.rating}。`,
      weakPoints: gameData.choices.length > 0
        ? ['回答策略相对单一，可尝试更多元的应对方式', '与面试官的互动深度有待加强', '整体表现中规中矩，缺乏亮点记忆点']
        : ['本次面试未完成足够多的题目，建议增加练习量'],
      improvements: [
        '多关注面试官的隐性考察点，针对性地组织回答',
        '结合具体案例和数据，让回答更有说服力',
        '练习时尝试不同策略组合，积累多元应对经验',
      ],
      industryFit: gameData.bossesDefeated >= 2 ? '综合能力较好，可尝试中大型企业的标准面试流程' : '建议多积累实战经验，提升综合面试能力',
      overallAssessment: `本次模拟面试综合评级为 ${gameData.rating} 级${gameData.bossesDefeated >= 3 ? '，成功击败所有 Boss，表现优异' : '，仍有提升空间'}。坚持练习，必有所成！`,
      fallback: true,
    }

    if (!llmService.isAvailable()) {
      console.log('[Report] LLM not available, returning base stats')
      return baseStats
    }

    try {
      const llmReport = await llmService.generateReport(gameData)
      // LLM可能返回 null 或部分字段缺失
      if (!llmReport) {
        console.warn('[Report] LLM returned null, using base stats')
        return baseStats
      }
      // 合并LLM结果和基础统计，确保每个字段都有值
      return {
        styleAnalysis: llmReport.styleAnalysis || llmReport.style_analysis || baseStats.styleAnalysis,
        weakPoints: (llmReport.weakPoints || llmReport.weak_points || baseStats.weakPoints).slice(0, 5),
        improvements: (llmReport.improvements || llmReport.improvement_suggestions || baseStats.improvements).slice(0, 5),
        industryFit: llmReport.industryFit || llmReport.industry_fit || baseStats.industryFit,
        overallAssessment: llmReport.overallAssessment || llmReport.overall_assessment || baseStats.overallAssessment,
        fallback: false,
      }
    } catch (err) {
      console.error('[Report] generation failed:', err.message)
      console.error(err.stack)
      return {
        ...baseStats,
        styleAnalysis: `${baseStats.styleAnalysis}（AI 详细分析暂时不可用：${err.message}）`,
        weakPoints: [...baseStats.weakPoints, '系统错误：' + err.message],
      }
    }
  },

  async getResult(gameId) {
    const game = games.get(gameId)
    if (!game) { console.error(`[getResult] game ${gameId} not found`); return null }

    const stageOrder = game.stageOrder || STAGE_ORDER
    const bossHP = game.bossHP || {}

    console.log('[getResult] DEBUG:', {
      gameId: game.id,
      status: game.status,
      stageOrder,
      bossHP,
      collectedCards: game.collectedCards,
      collectedCardsLength: game.collectedCards?.length || 0,
      stageOrderType: typeof game.stageOrder,
      bossHPType: typeof game.bossHP,
    })

    stageOrder.forEach(sId => {
      console.log(`  [getResult] stage ${sId}: bossHP=${bossHP[sId]}, cleared=${(bossHP[sId] || 0) <= 0}`)
    })

    const cardCount = game.collectedCards?.length || 0
    const playerHP = game.playerHP || 0

    // 基于卡牌收集数和玩家 HP 判定结局
    let matchedEnding = null
    for (const rank of ENDING_RANKINGS) {
      if (cardCount >= rank.minCards && playerHP >= rank.minHP) {
        matchedEnding = rank
        break
      }
    }

    if (!matchedEnding) {
      matchedEnding = ENDING_RANKINGS[ENDING_RANKINGS.length - 1]
    }

    return {
      gameId: game.id,
      role: game.role,
      roleLabel: game.roleLabel,
      interviewers: game.interviewers,
      choices: game.choices,
      events: game.events,
      playerHP: playerHP,
      bossHP: bossHP,
      collectedCards: game.collectedCards || [],
      cardCount,
      stageHistory: stageOrder.map(sId => ({
        stageId: sId,
        bossName: STAGE_MAPPING[sId]?.bossName || '未知Boss',
        bossHP: bossHP[sId] || 0,
        cleared: (bossHP[sId] || 0) <= 0,
      })),
      ending: matchedEnding,
      isHiddenEnding: cardCount >= 5,
      rating: matchedEnding.id,
      bossesDefeated: stageOrder.filter(sId => (bossHP[sId] || 0) <= 0).length,
      equippedTalents: game.equippedTalents || [],
      talentState: game.talentState || {},
      deathDefied: game.talentState?.deathDefied || false,
    }
  },
}

const games = new Map()