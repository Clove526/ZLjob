import { gameService } from '../services/game.js'

const AVATAR_API_URL = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'

// 头像缓存
const avatarCache = new Map()

export async function gameRoutes(app) {
  app.post('/start', async (request, reply) => {
    console.log('[POST /start] body:', JSON.stringify(request.body))
    const { role, equippedTalents } = request.body || {}

    if (!role) {
      console.error('[POST /start] Missing role field')
      return reply.status(400).send({ error: 'Missing required field: role' })
    }

    const gameState = await gameService.createGame(role, equippedTalents || [])

    // 预生成面试官头像 - 使用角色的 appearance 描述
    const interviewers = gameState.interviewers
    const avatarUrls = {}
    
    for (const iv of interviewers) {
      if (!avatarCache.has(iv.id)) {
        const genderLabel = iv.gender === 'female' ? 'female' : 'male'
        const appearanceDesc = iv.appearance || `Chinese ${genderLabel} business person`
        // 生成坐姿商务照，适合面板展示
        const prompt = encodeURIComponent(
          `Professional business photo of ${appearanceDesc}, seated at conference table, corporate boardroom setting, professional lighting, business attire, looking at camera, high quality photography, 4K, realistic style`
        )
        const url = `${AVATAR_API_URL}?prompt=${prompt}&image_size=landscape_4_3`
        avatarCache.set(iv.id, url)
      }
      avatarUrls[iv.id] = avatarCache.get(iv.id)
    }

    return {
      gameId: gameState.id,
      role: gameState.role,
      roleLabel: gameState.roleLabel,
      interviewers: gameState.interviewers,
      currentStage: gameState.currentStage,
      stageInfo: gameState.stageInfo,
      maxRounds: gameState.maxRounds,
      currentQuestion: gameState.currentQuestion,
      events: gameState.events,
      avatarUrls,
      actingValue: gameState.actingValue,
      mentalFatigue: gameState.mentalFatigue,
      focus: gameState.focus,
      playerHP: gameState.playerHP,
      bossHP: gameState.bossHP,
      collectedCards: gameState.collectedCards,
      equippedTalents: gameState.equippedTalents,
      talentState: gameState.talentState,
    }
  })

  app.post('/round', async (request, reply) => {
    const { gameId, questionId, answerId, answerText, strategy, timeSpent, wasPressure } = request.body

    if (!gameId) {
      return reply.status(400).send({ error: 'Missing required field: gameId' })
    }

    // 自由文本模式
    if (answerText) {
      const result = await gameService.processFreeTextRound(gameId, questionId, answerText, { timeSpent, wasPressure })
      return result
    }

    // 选择题模式
    if (!answerId) {
      return reply.status(400).send({ error: 'Missing required field: answerId (or answerText for free-text mode)' })
    }
    const result = await gameService.processRound(gameId, questionId, answerId, strategy)
    return result
  })

  // 「剧本」系统：偷看面试官内心剧本
  app.post('/script', async (request, reply) => {
    const { gameId, questionId } = request.body || {}

    if (!gameId) {
      return reply.status(400).send({ error: 'Missing required field: gameId' })
    }

    try {
      const result = await gameService.processScriptPeek(gameId, questionId)
      return result
    } catch (err) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // 每日 AI 挑战 — 生成今日独特场景
  app.post('/daily', async (request, reply) => {
    const { equippedTalents } = request.body || {}
    try {
      const result = await gameService.createDailyGame(equippedTalents || [])
      // 复用 start 的返回格式
      const avatarUrls = {}
      for (const iv of result.interviewers) {
        if (!avatarCache.has(iv.id)) {
          const genderLabel = iv.gender === 'female' ? 'female' : 'male'
          const appearanceDesc = iv.appearance || `Chinese ${genderLabel} business person`
          const prompt = encodeURIComponent(
            `Professional business photo of ${appearanceDesc}, seated at conference table, corporate boardroom setting, professional lighting, business attire, looking at camera, high quality photography, 4K, realistic style`
          )
          const url = `${AVATAR_API_URL}?prompt=${prompt}&image_size=landscape_4_3`
          avatarCache.set(iv.id, url)
        }
        avatarUrls[iv.id] = avatarCache.get(iv.id)
      }
      return {
        gameId: result.id,
        role: result.role,
        roleLabel: result.roleLabel,
        interviewers: result.interviewers,
        currentStage: result.currentStage,
        stageInfo: result.stageInfo,
        maxRounds: result.maxRounds,
        currentQuestion: result.currentQuestion,
        events: result.events,
        avatarUrls,
        actingValue: result.actingValue,
        mentalFatigue: result.mentalFatigue,
        focus: result.focus,
        playerHP: result.playerHP,
        bossHP: result.bossHP,
        collectedCards: result.collectedCards,
        equippedTalents: result.equippedTalents,
        talentState: result.talentState,
        isDaily: true,
        dailyTheme: result.dailyTheme,
      }
    } catch (err) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // AI 面试复盘报告
  app.get('/report/:gameId', async (request, reply) => {
    const { gameId } = request.params
    try {
      const report = await gameService.generateReport(gameId)
      return report || { error: 'Report unavailable' }
    } catch (err) {
      return reply.status(400).send({ error: err.message })
    }
  })

  app.get('/result/:gameId', async (request, reply) => {
    const { gameId } = request.params
    const result = await gameService.getResult(gameId)
    if (!result) {
      return reply.status(404).send({ error: 'Game not found' })
    }
    return result
  })
}