import OpenAI from 'openai'

const apiKey = process.env.LLM_API_KEY
const baseURL = process.env.LLM_BASE_URL || 'https://api.deepseek.com'
const model = process.env.LLM_MODEL || 'deepseek-chat'

let client = null
if (apiKey) {
  client = new OpenAI({ apiKey, baseURL })
}

export const llmService = {
  isAvailable() {
    return client !== null
  },

  async chat(prompt, options = {}) {
    if (!client) throw new Error('LLM client not available')

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
      })

      return response.choices[0]?.message?.content || ''
    } catch (err) {
      console.error('LLM chat failed:', err.message)
      throw err
    }
  },

  // VN风格：生成场景描述
  async generateSceneDescription(round, question, interviewers, playerState, isPressure) {
    if (!client) return null

    const systemPrompt = `你是一个视觉小说场景描述生成器。请生成一段沉浸式的面试场景描述文字，用于视觉小说游戏的场景展示。

要求：
1. 文字简洁有力（30-80字），营造悬疑/紧张的氛围
2. 描述环境细节：光线、声音、气氛、人物微表情
3. 根据回合数调整氛围：前期轻松→中期紧张→后期压迫
4. 不要包含对话内容，只描述场景
5. 使用第二人称"你"的视角`

    const atmosphere = round <= 1 ? '轻松但略带紧张' : round <= 3 ? '紧张严肃' : '压抑紧迫'

    const userPrompt = `【当前场景】
回合：${round}
问题：${question}
氛围要求：${atmosphere}
${isPressure ? '⚡ 压力面试环节，气氛格外紧张' : ''}

【面试官】
${interviewers.map(i => `- ${i.name}(${i.title})，当前好感度${i.affinity}/100，${i.affinity >= 70 ? '面带微笑' : i.affinity >= 40 ? '表情严肃' : '眉头紧锁'}`).join('\n')}

【玩家状态】
演技值：${playerState.actingValue}/100
精神疲劳度：${playerState.mentalFatigue}/100

请生成一段场景描述：`

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 120,
      })
      return response.choices[0]?.message?.content || null
    } catch (err) {
      console.error('Scene generation failed:', err.message)
      return null
    }
  },

  // VN风格：根据选择生成剧情分支描述
  async generateBranchNarrative(question, choice, interviewers, playerState) {
    if (!client) return null

    const systemPrompt = `你是一个视觉小说剧情分支生成器。根据玩家的选择，生成一段剧情分支描述，让玩家感受到选择的影响。

要求：
1. 文字精炼（40-100字），营造悬念和紧张感
2. 描述面试官们的反应和环境变化
3. 暗示这个选择可能带来的后果
4. 使用悬疑/心理博弈的叙事风格
5. 不要直接说"好感度增加/减少"，要用场景和表情暗示`

    const userPrompt = `【场景】
问题：${question}
玩家选择：${choice}
回答策略：${choice.type || '未知'}

【面试官状态】
${interviewers.map(i => `- ${i.name}(${i.title})，好感度${i.affinity}/100`).join('\n')}

【玩家状态】
演技值：${playerState.actingValue}/100
精神疲劳度：${playerState.mentalFatigue}/100

请生成剧情分支描述：`

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 150,
      })
      return response.choices[0]?.message?.content || null
    } catch (err) {
      console.error('Branch narrative generation failed:', err.message)
      return null
    }
  },

  // 「剧本」系统：AI动态生成实时剧本洞察
  async generateScriptInsight(question, currentInterviewer, playerState, historySummary) {
    if (!client) return null

    const systemPrompt = `你是一个视觉小说游戏的"剧本"生成器。在游戏中，玩家拥有偷看"面试官内心剧本"的超能力。

你需要生成面试官对当前问题的【真实内心想法】，这些是面试官嘴上不会说但心里在想的内容。

要求：
1. 内心独白要犀利、有洞察力，揭示面试官的隐藏意图
2. 雷区预警要具体——标注回答中必须避开的敏感词或话题
3. 隐藏考察维度——揭示面试官真正在考察什么（和表面上问的不一样）
4. 策略推荐要基于面试官性格和当前局势
5. 文字要简洁，每个字段控制在规定字数内
6. 用中文输出，保持悬疑/紧张的视觉小说风格
7. 信息要有"偷看禁书"的感觉——像是玩家不该知道但确实知道了的秘密`

    const userPrompt = `【当前问题】
题目：${question.question_text}
类别：${question.category}
${question.isPressure ? '⚡ 这是压力面试题！' : ''}

【当前面试官 - Boss】
姓名：${currentInterviewer.name}
职位：${currentInterviewer.title}
性格：${currentInterviewer.description}
特质：${JSON.stringify(currentInterviewer.traits || {})}
当前好感度：${currentInterviewer.affinity}/100

【玩家状态】
演技值：${playerState.actingValue}/100
精神疲劳度：${playerState.mentalFatigue}/100
专注度：${playerState.focus}/100
嫌疑值：${playerState.suspicion}/100（越高越容易被识破偷看行为）

【历史摘要】
${historySummary || '这是第一个问题，尚无历史记录。'}

请以JSON格式返回（不要任何其他文字）：
{
  "innerThought": "面试官的真实内心独白（30-60字），揭示TA听到这个问题时的隐藏想法和评判标准",
  "hiddenDimension": "面试官真正在考察什么（15-30字），和表面问题的差异",
  "minefields": ["雷区1：具体需要避开的关键词或话题", "雷区2：...", "雷区3：..."],
  "emotionalState": "面试官当前情绪状态描述（10-20字）",
  "recommendedStrategy": "推荐策略：保守/进取/创新/察言观色 中的一个",
  "strategyReason": "推荐该策略的简短理由（15-30字）",
  "riskLevel": "high/medium/low - 当前问题偷看的风险等级"
}`

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 600,
      })

      const content = response.choices[0]?.message?.content || ''
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
      return JSON.parse(cleaned)
    } catch (err) {
      console.error('Script insight generation failed:', err.message)
      return null
    }
  },

  // AI 面试复盘报告
  async generateReport(gameData) {
    if (!client) return null

    const systemPrompt = `你是一位资深职业规划师和面试教练。请根据求职者的面试表现数据，生成一份专业的面试复盘报告。

要求：
1. 分析回答风格和策略偏好
2. 指出弱点和需要改进的地方
3. 给出具体可操作的改进建议
4. 评估适合的行业/公司类型
5. 语言专业但不失鼓励性
6. 每个部分控制在2-3句话，简洁有力
7. 返回JSON格式`

    const answerSummary = (gameData.choices || []).map((c, i) => {
      const qText = c.questionText || `Q${i + 1}`
      const score = c.overallScore || c.rawScore || '?'
      const strategy = c.strategy || c.strategyType || '?'
      return `第${i + 1}题「${qText}」: 评分${score}/100，策略${strategy}`
    }).join('\n')

    const userPrompt = `【面试结果】
评级：${gameData.rating || '?'}
收集卡牌：${gameData.cardCount || 0}/5
击败Boss：${gameData.bossesDefeated || 0}/3
剩余HP：${gameData.playerHP || 0}

【回答记录】
${answerSummary || '无回答记录'}

【面试官最终好感度】
${(gameData.interviewers || []).map(i => `- ${i.name}: ${i.affinity}/100`).join('\n')}

请以JSON格式返回（不要其他文字）：
{
  "styleAnalysis": "回答风格分析（2-3句话）：你的主要策略倾向、语言特点、优势领域",
  "weakPoints": ["弱点1", "弱点2", "弱点3"],
  "improvements": ["具体改进建议1", "具体改进建议2", "具体改进建议3"],
  "industryFit": "适合的公司类型和行业方向（1-2句话）",
  "overallAssessment": "综合评价（2-3句话，鼓励性结尾）"
}`

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      })
      const content = response.choices[0]?.message?.content || ''
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
      return JSON.parse(cleaned)
    } catch (err) {
      console.error('Report generation failed:', err.message)
      return null
    }
  },

  async generateResponse(question, chosenAnswer, interviewers) {
    if (!client) return null

    const prompt = interviewers.map(i =>
      `【面试官档案】
- 姓名：${i.name}
- 角色：${i.title}
- 性格特征：${i.description}
- 当前好感度：${i.affinity}/100`
    ).join('\n')

    const systemPrompt = `你是一个面试模拟游戏的AI引擎。请根据以下面试官的性格和当前好感度，模拟他们对求职者回答的反应。

关键规则：
1. 每位面试官必须结合自己的性格特征给出回应
2. 回应要有个性差异：不同性格的面试官对同一回答的反应不同
3. 语言风格要符合角色设定（技术主管要专业犀利，HR要温和细致）
4. 每位面试官回应控制在30-60字，口语化，第一人称
5. 好感度高的面试官回应更友善，好感度低的更挑剔`

    const userPrompt = `${prompt}

【当前面试题】
${question.question_text}

【求职者的回答】
类型：${chosenAnswer.type}
回答内容：${chosenAnswer.content}

请模拟以上三位面试官，每人给出30-60字的回应。按面试官姓名分行输出，格式如：
张总：回应内容
李姐：回应内容
王总：回应内容`

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      })

      const content = response.choices[0]?.message?.content || ''
      const responses = {}
      for (const interviewer of interviewers) {
        const regex = new RegExp(`${interviewer.name}[:：]([^\\n]+)`)
        const match = content.match(regex)
        if (match) {
          responses[interviewer.id] = match[1].trim()
        }
      }
      return responses
    } catch (err) {
      console.error('LLM call failed:', err.message)
      return null
    }
  },
}