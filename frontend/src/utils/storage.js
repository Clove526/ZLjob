const STORAGE_KEY = 'zljob_progression'

const DEFAULT_PROGRESSION = {
  totalReincarnations: 0,
  memoryFragments: 0,
  unlockedTalents: [],
  equippedTalents: [],
  talentSlots: 2,
  bestRating: null,
  totalCardsCollected: 0,
  hiddenEndingsFound: 0,
  totalBossesDefeated: 0,
  gamesPlayed: 0,
}

export function loadProgression() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROGRESSION }
    const data = JSON.parse(raw)
    return { ...DEFAULT_PROGRESSION, ...data }
  } catch {
    return { ...DEFAULT_PROGRESSION }
  }
}

export function saveProgression(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* localStorage full or unavailable */ }
}

export function resetProgression() {
  localStorage.removeItem(STORAGE_KEY)
}

export function addReincarnation(gameResult) {
  const prog = loadProgression()

  // 计算记忆碎片
  const ratingFragments = { S: 5, A: 4, B: 3, C: 2, D: 1 }
  let fragments = ratingFragments[gameResult.rating] || 1
  fragments += (gameResult.cardCount || 0)
  fragments += (gameResult.bossesDefeated || 0)
  if (gameResult.isHiddenEnding) fragments += 3

  prog.totalReincarnations += 1
  prog.gamesPlayed += 1
  prog.memoryFragments += fragments
  prog.totalCardsCollected += (gameResult.cardCount || 0)
  prog.totalBossesDefeated += (gameResult.bossesDefeated || 0)
  if (gameResult.isHiddenEnding) prog.hiddenEndingsFound += 1

  // 更新最佳评级
  const ratingOrder = ['D', 'C', 'B', 'A', 'S']
  const currentIdx = ratingOrder.indexOf(prog.bestRating)
  const newIdx = ratingOrder.indexOf(gameResult.rating)
  if (newIdx > currentIdx) prog.bestRating = gameResult.rating

  // 每5次轮回增加1个天赋槽
  prog.talentSlots = 2 + Math.floor(prog.totalReincarnations / 5)

  saveProgression(prog)
  return { ...prog, fragmentsEarned: fragments }
}

export function unlockTalent(talentId, cost) {
  const prog = loadProgression()
  if (prog.memoryFragments < cost) return null
  if (prog.unlockedTalents.includes(talentId)) return null

  prog.memoryFragments -= cost
  prog.unlockedTalents.push(talentId)
  saveProgression(prog)
  return { ...prog }
}

export function equipTalents(talentIds) {
  const prog = loadProgression()
  const valid = talentIds.filter(id => prog.unlockedTalents.includes(id))
  prog.equippedTalents = valid.slice(0, prog.talentSlots)
  saveProgression(prog)
  return { ...prog }
}
