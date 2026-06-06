import { useState } from 'react'
import { useGame } from '../context/GameContext'
import ReportView from '../components/ReportView'

const BG_IMAGES = {
  success: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Triumphant%20golden%20ending%20scene,%20radiant%20warm%20golden%20light%20flooding%20office,%20sunbeams%20through%20windows,%20celebratory%20atmosphere,%20success%20achievement,%20wide%20landscape&image_size=landscape_16_9',
  fail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Melancholic%20gray%20ending%20scene,%20dimly%20lit%20empty%20office,%20cold%20blue-gray%20atmosphere,%20fading%20light,%20solitary%20mood,%20reflection,%20wide%20landscape&image_size=landscape_16_9',
}

const RATING_STYLES = { S: 'rating-s', A: 'rating-a', B: 'rating-b', C: 'rating-c', D: 'rating-d' }

export default function EndingScene() {
  const { result, reset } = useGame()
  const [showReport, setShowReport] = useState(false)
  if (!result) return null

  const ending = result.ending || { id: 'D', name: '面试结束', description: '面试已结束。' }
  const cardCount = result.cardCount || 0
  const playerHP = result.playerHP || 0
  const bossesDefeated = result.bossesDefeated || 0
  const stageHistory = result.stageHistory || []

  const isSuccess = ending.id === 'S' || ending.id === 'A'

  return (
    <div className="ending-scene">
      <div className="scene-bg">
        <img src={isSuccess ? BG_IMAGES.success : BG_IMAGES.fail} alt="" onError={(e) => e.target.style.display = 'none'} />
      </div>
      <div className="ending-celebration">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`celebration-particle ${['gold', 'purple', 'cyan'][i % 3]}`}
            style={{ left: `${Math.random() * 100}%`, width: `${4 + Math.random() * 8}px`, height: `${4 + Math.random() * 8}px`, animationDuration: `${8 + Math.random() * 8}s`, animationDelay: `${Math.random() * 5}s` }} />
        ))}
      </div>
      <div className="ending-container">
        <div className="ending-badge"><span className={`ending-rating ${RATING_STYLES[ending.id] || ''}`}>{ending.id}</span></div>
        <h2 className="ending-title">{ending.name || '面试结束'}</h2>
        <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto">
          <p className="ending-description">{ending.description}</p>
          <div className="ending-state-summary">
            <div className="state-summary-item">
              <span className="state-summary-icon">💖</span>
              <div className="state-summary-info">
                <span className="state-summary-label">卡牌收集</span>
                <span className={`state-summary-value ${cardCount >= 4 ? 'text-purple-300' : cardCount >= 2 ? 'text-amber-400' : 'text-red-400'}`}>{cardCount}/5</span>
              </div>
            </div>
            <div className="state-summary-item">
              <span className="state-summary-icon">❤️</span>
              <div className="state-summary-info">
                <span className="state-summary-label">剩余 HP</span>
                <span className={`state-summary-value ${playerHP >= 60 ? 'text-cyan-300' : playerHP >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{playerHP}</span>
              </div>
            </div>
            <div className="state-summary-item">
              <span className="state-summary-icon">🏆</span>
              <div className="state-summary-info">
                <span className="state-summary-label">击败 Boss</span>
                <span className={`state-summary-value ${bossesDefeated >= 3 ? 'text-purple-300' : 'text-amber-400'}`}>{bossesDefeated}/3</span>
              </div>
            </div>
          </div>
        </div>
        <div className="ending-stats-grid">
          {stageHistory.map((stage, idx) => (
            <div key={stage.stageId} className="ending-stat-card" style={{ animationDelay: `${idx * 0.15}s` }}>
              <div className={`stage-boss-status ${stage.cleared ? 'cleared' : ''}`}>
                <span className="stage-boss-icon">{stage.cleared ? '✅' : '❌'}</span>
              </div>
              <span className="stat-card-label">{stage.bossName}</span>
              <span className={`stat-card-value ${stage.cleared ? 'text-green-400' : 'text-red-400'}`}>HP {stage.bossHP}</span>
            </div>
          ))}
        </div>
        <div className="ending-actions">
          <button className="btn-ending-report" onClick={() => setShowReport(true)}>
            🤖 查看 AI 复盘报告
          </button>
          <button className="btn-ending-restart" onClick={reset}>再来一局，换个身份！</button>
        </div>
      </div>
      {showReport && <ReportView onClose={() => setShowReport(false)} />}
    </div>
  )
}
