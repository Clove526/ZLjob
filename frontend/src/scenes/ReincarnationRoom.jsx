import { useState, useMemo } from 'react'
import { useGame } from '../context/GameContext'
import { loadProgression, unlockTalent, equipTalents } from '../utils/storage'
import { TALENTS } from '../data/talents'

export default function ReincarnationRoom() {
  const { selectedRole, startGame } = useGame()
  const [prog, setProg] = useState(() => loadProgression())
  const [equipped, setEquipped] = useState(() => prog.equippedTalents || [])
  const [message, setMessage] = useState(null)

  const maxSlots = prog.talentSlots

  const handleUnlock = (talent) => {
    if (prog.unlockedTalents.includes(talent.id)) return
    if (prog.memoryFragments < talent.cost) {
      setMessage({ type: 'error', text: `记忆碎片不足！需要 ${talent.cost} 个碎片` })
      return
    }
    const updated = unlockTalent(talent.id, talent.cost)
    if (updated) {
      setProg(updated)
      setMessage({ type: 'success', text: `解锁天赋「${talent.name}」！` })
    }
  }

  const handleToggleEquip = (talentId) => {
    let next
    if (equipped.includes(talentId)) {
      next = equipped.filter(id => id !== talentId)
    } else {
      if (equipped.length >= maxSlots) {
        setMessage({ type: 'error', text: `天赋槽位已满（${maxSlots}个）！每5次轮回增加1个槽位` })
        return
      }
      next = [...equipped, talentId]
    }
    setEquipped(next)
  }

  const handleEnterGame = () => {
    equipTalents(equipped)
    startGame(selectedRole, equipped)
  }

  const handleSkip = () => {
    startGame(selectedRole, [])
  }

  // 轮回次数对应的叙事文本
  const reincarnationText = useMemo(() => {
    const count = prog.totalReincarnations
    if (count === 0) return '初次踏入轮回空间，你感到一阵眩晕。命运的丝线在此交织...'
    if (count < 3) return `第${count}次回到这里。前世的记忆碎片在脑海中闪烁，你知道这次会做得更好。`
    if (count < 5) return `已经是第${count}次了。轮回空间的气息越来越熟悉，你甚至开始期待每次回到这里。`
    if (count < 10) return `第${count}次重生。你已经记不清经历了多少次面试，但每一次都让你更接近真相。`
    return `第${count}次...你已经超越了普通轮回者的范畴。隐藏的真相碎片开始在你的脑海中拼凑成形。`
  }, [prog.totalReincarnations])

  return (
    <div className="reincarnation-room">
      <div className="reincarnation-bg">
        <div className="reincarnation-stars" />
        <div className="reincarnation-vortex" />
      </div>

      <div className="reincarnation-container">
        {/* 标题 */}
        <div className="reincarnation-header">
          <h1 className="reincarnation-title">🔄 轮回空间</h1>
          <p className="reincarnation-subtitle">在命运的缝隙中，选择此生的天赋</p>
        </div>

        {/* 叙事 */}
        <div className="reincarnation-narrative">
          <p>{reincarnationText}</p>
        </div>

        {/* 状态概览 */}
        <div className="reincarnation-stats">
          <div className="reincarnation-stat">
            <span className="rstat-icon">🔄</span>
            <span className="rstat-value">{prog.totalReincarnations}</span>
            <span className="rstat-label">轮回次数</span>
          </div>
          <div className="reincarnation-stat">
            <span className="rstat-icon">💎</span>
            <span className="rstat-value">{prog.memoryFragments}</span>
            <span className="rstat-label">记忆碎片</span>
          </div>
          <div className="reincarnation-stat">
            <span className="rstat-icon">🏆</span>
            <span className="rstat-value">{prog.bestRating || '—'}</span>
            <span className="rstat-label">最佳评级</span>
          </div>
          <div className="reincarnation-stat">
            <span className="rstat-icon">🎴</span>
            <span className="rstat-value">{prog.totalCardsCollected}</span>
            <span className="rstat-label">累计卡牌</span>
          </div>
        </div>

        {/* 天赋选择 */}
        <div className="reincarnation-talents-section">
          <div className="reincarnation-section-header">
            <h2>✨ 轮回天赋</h2>
            <span className="reincarnation-slots-info">
              已装备 {equipped.length}/{maxSlots} 个槽位
              {prog.totalReincarnations >= 5 && prog.totalReincarnations % 5 < 3 && (
                <span className="slot-upgrade-hint">（再轮回 {5 - prog.totalReincarnations % 5} 次解锁新槽位）</span>
              )}
            </span>
          </div>

          {message && (
            <div className={`reincarnation-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="reincarnation-talent-grid">
            {TALENTS.map(talent => {
              const isUnlocked = prog.unlockedTalents.includes(talent.id)
              const isEquipped = equipped.includes(talent.id)
              return (
                <div
                  key={talent.id}
                  className={`reincarnation-talent-card ${isUnlocked ? 'unlocked' : 'locked'} ${isEquipped ? 'equipped' : ''}`}
                >
                  <div className="talent-card-header">
                    <span className="talent-icon">{talent.icon}</span>
                    <span className="talent-name">{talent.name}</span>
                    {isEquipped && <span className="talent-equipped-badge">已装备</span>}
                  </div>
                  <p className="talent-desc">{talent.description}</p>
                  <div className="talent-actions">
                    {!isUnlocked ? (
                      <button
                        className={`talent-btn unlock-btn ${prog.memoryFragments < talent.cost ? 'cant-afford' : ''}`}
                        onClick={() => handleUnlock(talent)}
                      >
                        💎 {talent.cost} 解锁
                      </button>
                    ) : (
                      <button
                        className={`talent-btn equip-btn ${isEquipped ? 'unequip' : ''}`}
                        onClick={() => handleToggleEquip(talent.id)}
                      >
                        {isEquipped ? '卸下' : '装备'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 行动按钮 */}
        <div className="reincarnation-actions">
          <button className="reincarnation-btn enter" onClick={handleEnterGame}>
            🔮 带着天赋进入面试
          </button>
          <button className="reincarnation-btn skip" onClick={handleSkip}>
            跳过天赋选择，直接开始
          </button>
        </div>

        {/* 提示 */}
        {prog.totalReincarnations === 0 && (
          <div className="reincarnation-first-hint">
            <p>💡 完成首次面试后将获得「记忆碎片」，可用于解锁和装备天赋，强化下一世的面试能力。</p>
          </div>
        )}
      </div>
    </div>
  )
}
