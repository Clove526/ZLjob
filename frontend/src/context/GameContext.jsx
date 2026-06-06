import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { addReincarnation, loadProgression } from '../utils/storage'

const GameContext = createContext(null)

export const ROLES = [
  { id: 'freshman', label: '🎓 应届生', title: '天才应届生',
    desc: '学习能力强，但经验不足。注重稳定性与团队协作的面试官对你更有好感。',
    color: 'from-cyan-400 to-blue-500' },
  { id: 'veteran', label: '💼 资深人士', title: '行业老兵',
    desc: '经验丰富，专业扎实。注重野心与诚实的面试官对你更有好感。',
    color: 'from-amber-400 to-orange-500' },
  { id: 'career', label: '🔄 转行者', title: '跨界勇士',
    desc: '视角独特，转型勇气可嘉。注重诚实与学习潜力的面试官欣赏你的决心。',
    color: 'from-violet-400 to-fuchsia-500' },
]

export const INTERVIEWER_CONFIGS = {
  p1: { name: '张总', gender: 'male' }, p2: { name: '李姐', gender: 'female' },
  p3: { name: '王总', gender: 'male' }, p4: { name: '陈工', gender: 'male' },
  p5: { name: '赵姐', gender: 'female' }, p6: { name: '刘总', gender: 'male' },
  p7: { name: '周姐', gender: 'female' }, p8: { name: '吴工', gender: 'male' },
  p9: { name: '郑总', gender: 'male' }, p10: { name: '冯姐', gender: 'female' },
}

export const INTRO_SCRIPTS = [
  { speaker: '旁白', icon: '🌙', style: 'narrator',
    text: '上一世，因为不善言辞，我在面试中屡屡碰壁。\n被多家企业拒绝后，我流落街头，过着颠沛流离的生活。\n\n寒风刺骨的冬夜里，我蜷缩在桥洞下，\n望着远处写字楼的灯火，心中满是不甘……',
    delay: 3000 },
  { speaker: '我', icon: '💭', style: 'monologue',
    text: '"如果能重来一次就好了……"\n这是我闭上眼睛前，最后一个念头。',
    delay: 2500 },
  { speaker: '旁白', icon: '✨', style: 'narrator',
    text: '然而，当我再次睁开眼时——\n我发现自己回到了面试当天。\n\n更不可思议的是，我的脑海中多了一份\n……面试官的剧本。',
    delay: 3000 },
  { speaker: '系统提示', icon: '📋', style: 'system',
    text: '【重生系统已激活】\n你获得了查看面试官内心剧本的能力。\n\n提前了解他们的偏好、雷区和关注点，\n用这些信息，重新改写你的命运。',
    delay: 2500 },
  { speaker: '我', icon: '🔥', style: 'monologue-bold',
    text: '这一世，我要拿回属于我的一切。\n\n带着这份剧本，走进那间熟悉的面试会议室……\n我知道，这一次，结局将会不同。',
    delay: 2000 },
]

const BG_IMAGES = {
  title: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Cinematic%20night%20cityscape,%20Chinese%20metropolitan%20skyline%20at%20midnight,%20neon%20lights,%20purple%20blue%20atmospheric%20fog,%20dramatic%20moody,%20visual%20novel%20title%20screen,%20wide%20landscape&image_size=landscape_16_9',
  interview_room: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Dark%20suspenseful%20interview%20room,%20dim%20blue-gray%20lighting,%20minimalist%20office%20with%20long%20conference%20table,%20moody%20atmosphere,%20visual%20novel%20background,%20wide%20landscape&image_size=landscape_16_9',
  lobby: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Dark%20modern%20corporate%20lobby,%20dim%20purple%20ambient%20lighting,%20sleek%20reception%20area,%20moody%20suspenseful,%20visual%20novel%20background,%20wide%20landscape&image_size=landscape_16_9',
  corridor: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Dark%20office%20corridor,%20flickering%20fluorescent%20lights,%20eerie%20atmosphere,%20tense%20mood,%20visual%20novel%20background,%20wide%20landscape&image_size=landscape_16_9',
  success: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Triumphant%20golden%20ending%20scene,%20radiant%20warm%20golden%20light%20flooding%20office,%20sunbeams%20through%20windows,%20celebratory%20atmosphere,%20success%20achievement,%20wide%20landscape&image_size=landscape_16_9',
  fail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Melancholic%20gray%20ending%20scene,%20dimly%20lit%20empty%20office,%20cold%20blue-gray%20atmosphere,%20fading%20light,%20solitary%20mood,%20reflection,%20wide%20landscape&image_size=landscape_16_9',
}

export function getRoleIntro(role) {
  switch (role) {
    case 'freshman': return '作为天才应届生，你拥有极强的学习能力。这次，你不会再让经验不足成为绊脚石。'
    case 'veteran': return '作为行业老兵，你经验丰富、专业扎实。这一次，你不会再让机会溜走。'
    case 'career': return '作为跨界勇士，你的转型勇气令人钦佩。这一次，你不会再让跨界的标签定义你。'
    default: return ''
  }
}

export function GameProvider({ children }) {
  const [phase, setPhase] = useState('title')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [nextPhase, setNextPhase] = useState(null)
  const [selectedRole, setSelectedRole] = useState(null)
  const [gameId, setGameId] = useState(null)
  const [interviewers, setInterviewers] = useState([])
  const [currentInterviewerIndex, setCurrentInterviewerIndex] = useState(0)
  const [avatarUrls, setAvatarUrls] = useState({})
  const [currentRound, setCurrentRound] = useState(0)
  const [maxRounds, setMaxRounds] = useState(5)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [lastRoundResult, setLastRoundResult] = useState(null)
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)

  const [userAnswer, setUserAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [actingValue, setActingValue] = useState(100)
  const [mentalFatigue, setMentalFatigue] = useState(0)
  const [focus, setFocus] = useState(100)

  const [countdown, setCountdown] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [answerStartTime, setAnswerStartTime] = useState(0)
  const [sceneMood, setSceneMood] = useState('normal')

  const [selectedChoice, setSelectedChoice] = useState(null)
  const [dialogHistory, setDialogHistory] = useState([])
  const [currentSpeaker, setCurrentSpeaker] = useState('interviewer')

  const [sceneDescription, setSceneDescription] = useState(null)
  const [branchNarrative, setBranchNarrative] = useState(null)

  const [battlePhase, setBattlePhase] = useState('preparation')
  const [currentStage, setCurrentStage] = useState('stage1')
  const [stageInfo, setStageInfo] = useState(null)
  const [playerHP, setPlayerHP] = useState(80)
  const [bossHP, setBossHP] = useState({})
  const [collectedCards, setCollectedCards] = useState([])
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [lastScore, setLastScore] = useState(null)
  const [lastDamage, setLastDamage] = useState(0)
  const [lastHpDamage, setLastHpDamage] = useState(0)
  const [newCards, setNewCards] = useState([])
  const [bossDefeated, setBossDefeated] = useState(false)
  const [playerDefeated, setPlayerDefeated] = useState(false)
  const [stageCleared, setStageCleared] = useState(false)
  const [stageClearedName, setStageClearedName] = useState(null)

  const [introStep, setIntroStep] = useState(0)
  const [introText, setIntroText] = useState('')
  const [introCharIndex, setIntroCharIndex] = useState(0)
  const [introPaused, setIntroPaused] = useState(false)

  // 「剧本」偷看系统
  const [suspicion, setSuspicion] = useState(0)
  const [scriptInsight, setScriptInsight] = useState(null)
  const [isPeeking, setIsPeeking] = useState(false)
  const [peekCooldown, setPeekCooldown] = useState(false)
  const [suspicionEffect, setSuspicionEffect] = useState(null)
  const [counterRecon, setCounterRecon] = useState(false)

  // 自由文本模式
  const [freeTextAnswer, setFreeTextAnswer] = useState('')
  const [isFreeTextMode, setFreeTextMode] = useState(false)

  const timerRef = useRef(null)
  const peekTimerRef = useRef(null)

  const getCurrentBackground = () => {
    switch (phase) {
      case 'title': case 'select': return BG_IMAGES.title
      case 'briefing': return BG_IMAGES.lobby
      case 'playing': case 'response':
        if (currentRound <= 1) return BG_IMAGES.lobby
        if (currentRound <= 3) return BG_IMAGES.interview_room
        return BG_IMAGES.corridor
      case 'ending':
        return (result?.ending?.id === 'S' || result?.ending?.id === 'A') ? BG_IMAGES.success : BG_IMAGES.fail
      default: return BG_IMAGES.title
    }
  }

  const transitionToPhase = useCallback((newPhase) => {
    setIsTransitioning(true)
    setNextPhase(newPhase)
    setTimeout(() => { setPhase(newPhase); setNextPhase(null); setIsTransitioning(false) }, 800)
  }, [])

  const startTimerForQuestion = useCallback((question) => {
    if (question?.isPressure) { setSceneMood('pressure'); setCountdown(30); setTimerActive(true); setAnswerStartTime(Date.now()) }
    else { setSceneMood('normal'); setCountdown(0); setTimerActive(false); setAnswerStartTime(Date.now()) }
  }, [])

  useEffect(() => {
    if (!timerActive || countdown <= 0) return
    const interval = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { setTimerActive(false); return 0 } return prev - 1 })
    }, 1000)
    return () => clearInterval(interval)
  }, [timerActive, countdown])

  useEffect(() => {
    if (phase !== 'intro' || introPaused) return
    const script = INTRO_SCRIPTS[introStep]
    if (!script || introCharIndex >= script.text.length) return
    const timer = setTimeout(() => {
      setIntroText(prev => prev + script.text[introCharIndex])
      setIntroCharIndex(prev => prev + 1)
    }, 45)
    return () => clearTimeout(timer)
  }, [phase, introStep, introCharIndex, introPaused])

  useEffect(() => {
    if (phase !== 'intro' || introPaused) return
    const script = INTRO_SCRIPTS[introStep]
    if (!script || introCharIndex < script.text.length) return
    const timer = setTimeout(() => {
      setIntroPaused(true)
      const nextTimer = setTimeout(() => {
        if (introStep < INTRO_SCRIPTS.length - 1) {
          setIntroStep(prev => prev + 1); setIntroCharIndex(0); setIntroText(''); setIntroPaused(false)
        } else { transitionToPhase('briefing') }
      }, script.delay)
      return () => clearTimeout(nextTimer)
    }, 300)
    return () => clearTimeout(timer)
  }, [phase, introStep, introCharIndex, introPaused])

  const handleIntroClick = useCallback(() => {
    const script = INTRO_SCRIPTS[introStep]
    if (!script || introCharIndex >= script.text.length) return
    setIntroText(script.text); setIntroCharIndex(script.text.length)
  }, [introStep, introCharIndex])

  const startGame = useCallback(async (role, equippedTalents = []) => {
    setSelectedRole(role)
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, equippedTalents })
      })
      const data = await res.json()
      setGameId(data.gameId); setInterviewers(data.interviewers || []); setMaxRounds(data.maxRounds)
      setCurrentQuestion(data.currentQuestion); setEvents(data.events || []); setAvatarUrls(data.avatarUrls || {})
      setActingValue(data.actingValue ?? 100); setMentalFatigue(data.mentalFatigue ?? 0); setFocus(data.focus ?? 100)
      setCurrentInterviewerIndex(0)
      setCurrentStage(data.currentStage || 'stage1'); setStageInfo(data.stageInfo || null)
      setPlayerHP(data.playerHP ?? 80); setBossHP(data.bossHP || {})
      setCollectedCards(data.collectedCards || [])
      setSuspicion(0); setScriptInsight(null); setIsPeeking(false); setSuspicionEffect(null)
      setIntroStep(0); setIntroCharIndex(0); setIntroText(''); setIntroPaused(false)
      transitionToPhase('intro')
    } catch (err) { console.error(err) }
  }, [transitionToPhase])

  const confirmBriefing = useCallback(() => {
    transitionToPhase('playing')
    setUserAnswer(''); setSelectedStrategy(null); setBattlePhase('questioning')
    setLastScore(null); setLastDamage(0); setLastHpDamage(0)
    setNewCards([]); setBossDefeated(false); setPlayerDefeated(false)
    setStageCleared(false); setStageClearedName(null)
    if (currentQuestion) startTimerForQuestion(currentQuestion)
  }, [transitionToPhase, currentQuestion, startTimerForQuestion])

  const startDailyChallenge = useCallback(async () => {
    const prog = loadProgression()
    try {
      const res = await fetch('/api/game/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equippedTalents: prog.equippedTalents || [] })
      })
      const data = await res.json()
      setGameId(data.gameId); setInterviewers(data.interviewers || []); setMaxRounds(data.maxRounds)
      setCurrentQuestion(data.currentQuestion); setEvents(data.events || []); setAvatarUrls(data.avatarUrls || {})
      setActingValue(data.actingValue ?? 100); setMentalFatigue(data.mentalFatigue ?? 0); setFocus(data.focus ?? 100)
      setCurrentStage(data.currentStage || 'stage1'); setStageInfo(data.stageInfo || null)
      setPlayerHP(data.playerHP ?? 80); setBossHP(data.bossHP || {})
      setCollectedCards(data.collectedCards || [])
      setSuspicion(0); setScriptInsight(null); setIsPeeking(false); setSuspicionEffect(null); setCounterRecon(false)
      setSelectedRole(data.role)
      setIntroStep(0); setIntroCharIndex(0); setIntroText(''); setIntroPaused(false)
      transitionToPhase('intro')
    } catch (err) { console.error(err) }
  }, [transitionToPhase])

  const selectRoleAndContinue = useCallback((role) => {
    setSelectedRole(role)
    transitionToPhase('reincarnation')
  }, [transitionToPhase])

  const handleStrategySelect = useCallback((strategy) => {
    setSelectedStrategy(strategy)
  }, [])

  const handleChoiceSubmit = useCallback(async (choice) => {
    if (isSubmitting) return
    setIsSubmitting(true); setTimerActive(false)
    const timeSpent = answerStartTime ? Math.floor((Date.now() - answerStartTime) / 1000) : 0
    const strategy = selectedStrategy || 'conservative'

    setBattlePhase('answering')
    setSelectedChoice(choice)
    setCurrentSpeaker('player')

    setTimeout(async () => {
      try {
        const res = await fetch('/api/game/round', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, questionId: currentQuestion.id, answerId: choice.answerId, strategy, timeSpent, wasPressure: currentQuestion?.isPressure })
        })
        const data = await res.json()
        setLastRoundResult(data); setInterviewers(data.interviewers || [])
        if (data.currentInterviewerIndex != null) setCurrentInterviewerIndex(data.currentInterviewerIndex)
        if (data.eventTriggered) setEvents(prev => prev.filter(e => e.id !== data.eventTriggered.id))
        if (data.actingValue != null) setActingValue(data.actingValue)
        if (data.mentalFatigue != null) setMentalFatigue(data.mentalFatigue)
        if (data.focus != null) setFocus(data.focus)
        if (data.sceneDescription) setSceneDescription(data.sceneDescription)
        if (data.branchNarrative) setBranchNarrative(data.branchNarrative)
        if (data.playerHP != null) setPlayerHP(data.playerHP)
        if (data.bossHP) setBossHP(data.bossHP)
        if (data.collectedCards) setCollectedCards(data.collectedCards)
        if (data.score) setLastScore(data.score)
        if (data.damage != null) setLastDamage(data.damage)
        if (data.hpDamage != null) setLastHpDamage(data.hpDamage)
        if (data.newCards) setNewCards(data.newCards)
        if (data.bossDefeated) setBossDefeated(true)
        if (data.playerDefeated) setPlayerDefeated(true)
        if (data.stageCleared) { setStageCleared(true); setStageClearedName(data.stageClearedName) }
        if (data.currentStage) setCurrentStage(data.currentStage)
        if (data.stageInfo) setStageInfo(data.stageInfo)

        setBattlePhase('scoring')

        const respText = Object.values(data.llmResponse || {})[0] || '（沉默...）'
        setDialogHistory(prev => [
          ...prev.slice(-5),
          { speaker: 'player', text: choice.text },
          { speaker: 'interviewer', text: respText },
        ])

        setTimeout(() => {
          setCurrentSpeaker('interviewer')
          setBattlePhase('settled')

          setTimeout(async () => {
            if (data.isFinished) {
              await fetchResult(gameId)
            } else if (data.playerDefeated || data.bossDefeated) {
              if (data.nextQuestion && data.currentStage) {
                setCurrentStage(data.currentStage)
                setStageInfo(data.stageInfo || null)
                setCurrentQuestion(data.nextQuestion)
                setCurrentRound(data.round)
                setSelectedChoice(null)
                setSelectedStrategy(null)
                setCurrentSpeaker('interviewer')
                setBossDefeated(false)
                setPlayerDefeated(false)
                setStageCleared(false)
                setStageClearedName(null)
                setNewCards([])
                setLastScore(null)
                // Boss 击败后进入新关卡的备战阶段
                setBattlePhase(data.bossDefeated ? 'preparation' : 'questioning')
                startTimerForQuestion(data.nextQuestion)
              } else {
                await fetchResult(gameId)
              }
            } else {
              if (data.nextQuestion) {
                setCurrentQuestion(data.nextQuestion)
                setCurrentRound(data.round)
                setSelectedChoice(null)
                setSelectedStrategy(null)
                setCurrentSpeaker('interviewer')
                setNewCards([])
                setLastScore(null)
                setBattlePhase('questioning')
                startTimerForQuestion(data.nextQuestion)
              } else {
                await fetchResult(gameId)
              }
            }
          }, 3000)
        }, 2000)
      } catch (err) { console.error(err) }
      finally { setIsSubmitting(false) }
    }, 800)
  }, [gameId, currentQuestion, isSubmitting, answerStartTime, startTimerForQuestion, selectedStrategy])

  const fetchResult = useCallback(async (gid) => {
    try {
      console.log('[fetchResult] calling result API for:', gid)
      const res = await fetch(`/api/game/result/${gid}`)
      const final = await res.json()
      console.log('[fetchResult] result from server:', JSON.stringify(final, null, 2))
      if (!final) {
        console.error('Failed to fetch game result, got null response')
        return
      }
      // 保存轮回进度
      addReincarnation({
        rating: final.rating,
        cardCount: final.cardCount,
        bossesDefeated: final.bossesDefeated,
        isHiddenEnding: final.isHiddenEnding,
      })
      setResult(final)
      setTimeout(() => transitionToPhase('ending'), 500)
    } catch (err) { console.error(err) }
  }, [transitionToPhase])

  // 自由文本提交
  const handleFreeTextSubmit = useCallback(async () => {
    if (isSubmitting || !freeTextAnswer.trim() || !gameId) return
    setIsSubmitting(true); setTimerActive(false)
    const timeSpent = answerStartTime ? Math.floor((Date.now() - answerStartTime) / 1000) : 0

    setBattlePhase('answering')
    setSelectedChoice({ text: freeTextAnswer, type: '自由文本' })

    try {
      const res = await fetch('/api/game/round', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId, questionId: currentQuestion?.id,
          answerText: freeTextAnswer, timeSpent, wasPressure: currentQuestion?.isPressure
        })
      })
      const data = await res.json()
      setLastRoundResult(data); setInterviewers(data.interviewers || [])
      if (data.eventTriggered) setEvents(prev => prev.filter(e => e.id !== data.eventTriggered.id))
      if (data.actingValue != null) setActingValue(data.actingValue)
      if (data.mentalFatigue != null) setMentalFatigue(data.mentalFatigue)
      if (data.focus != null) setFocus(data.focus)
      if (data.sceneDescription) setSceneDescription(data.sceneDescription)
      if (data.branchNarrative) setBranchNarrative(data.branchNarrative)

      setBattlePhase('scoring')
      setLastScore(data.overallScore >= 75 ? 'Excellent' : data.overallScore >= 55 ? 'Good' : data.overallScore >= 35 ? 'OK' : 'Poor')

      const respText = Object.values(data.llmResponse || {})[0] || data.innerMonologue || '（面试官在记录着什么...）'
      setDialogHistory(prev => [
        ...prev.slice(-5),
        { speaker: 'player', text: freeTextAnswer },
        { speaker: 'interviewer', text: respText },
      ])

      setTimeout(() => {
        setCurrentSpeaker('interviewer')
        setBattlePhase('settled')

        setTimeout(async () => {
          if (data.isFinished) {
            await fetchResult(gameId)
          } else {
            setCurrentQuestion(data.nextQuestion); setCurrentRound(data.round)
            setSelectedChoice(null); setFreeTextAnswer('')
            setCurrentSpeaker('interviewer')
            setBattlePhase('questioning')
            if (data.nextQuestion) startTimerForQuestion(data.nextQuestion)
          }
        }, 3000)
      }, 2000)
    } catch (err) { console.error(err) }
    finally { setIsSubmitting(false); setFreeTextAnswer('') }
  }, [gameId, currentQuestion, isSubmitting, freeTextAnswer, answerStartTime, startTimerForQuestion])

  // 「剧本」偷看
  const handleScriptPeek = useCallback(async () => {
    if (isPeeking || peekCooldown || !gameId) return
    setIsPeeking(true)
    setPeekCooldown(true)
    try {
      const res = await fetch('/api/game/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, questionId: currentQuestion?.id })
      })
      const data = await res.json()
      setScriptInsight(data.insight)
      setSuspicion(data.suspicion)
      setSuspicionEffect(data.suspicionEffect)
      setCounterRecon(data.counterRecon || false)
      if (data.interviewers) {
        setInterviewers(prev => prev.map(iv => {
          const updated = data.interviewers.find(u => u.id === iv.id)
          return updated ? { ...iv, affinity: updated.affinity } : iv
        }))
      }
    } catch (err) {
      console.error('Script peek failed:', err)
    }
  }, [gameId, currentQuestion, isPeeking, peekCooldown])

  const closeScriptPanel = useCallback(() => {
    setIsPeeking(false)
    setScriptInsight(null)
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current)
    peekTimerRef.current = setTimeout(() => setPeekCooldown(false), 5000)
  }, [])

  useEffect(() => {
    return () => { if (peekTimerRef.current) clearTimeout(peekTimerRef.current) }
  }, [])

  const reset = useCallback(() => {
    transitionToPhase('title')
    setSelectedRole(null); setGameId(null); setInterviewers([])
    setCurrentRound(0); setCurrentQuestion(null); setLastRoundResult(null); setResult(null)
    setEvents([]); setUserAnswer(''); setIsSubmitting(false)
    setActingValue(100); setMentalFatigue(0); setFocus(100)
    setCountdown(0); setTimerActive(false); setSceneMood('normal')
    setSceneDescription(null); setBranchNarrative(null)
    setIntroStep(0); setIntroText(''); setIntroCharIndex(0); setIntroPaused(false)
    setSelectedChoice(null); setDialogHistory([]); setCurrentSpeaker('interviewer')
    setSuspicion(0); setScriptInsight(null); setIsPeeking(false); setSuspicionEffect(null); setCounterRecon(false)
  }, [transitionToPhase])

  const value = {
    phase, isTransitioning, nextPhase, selectedRole, gameId,
    interviewers, currentInterviewerIndex, avatarUrls,
    currentRound, maxRounds, currentQuestion, lastRoundResult,
    events, result,
    userAnswer, setUserAnswer, isSubmitting, setIsSubmitting,
    actingValue, mentalFatigue, focus,
    countdown, timerActive, answerStartTime, sceneMood,
    selectedChoice, dialogHistory, currentSpeaker,
    sceneDescription, branchNarrative,
    battlePhase, setBattlePhase, currentStage, stageInfo,
    playerHP, bossHP, collectedCards,
    selectedStrategy, handleStrategySelect,
    lastScore, lastDamage, lastHpDamage, newCards,
    bossDefeated, playerDefeated, stageCleared, stageClearedName,
    introStep, introText, introCharIndex, introPaused,
    suspicion, scriptInsight, isPeeking, peekCooldown, suspicionEffect, counterRecon,
    transitionToPhase, startGame, confirmBriefing, selectRoleAndContinue, startDailyChallenge,
    handleChoiceSubmit, handleIntroClick,
    startTimerForQuestion, handleScriptPeek, closeScriptPanel,
    getCurrentBackground, reset,
    handleFreeTextSubmit, freeTextAnswer, setFreeTextAnswer,
    isFreeTextMode, setFreeTextMode,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
