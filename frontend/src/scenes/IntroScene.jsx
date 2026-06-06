import { INTRO_SCRIPTS, useGame } from '../context/GameContext'

export default function IntroScene() {
  const { introStep, introText, introCharIndex, handleIntroClick } = useGame()

  return (
    <div className="intro-scene" onClick={handleIntroClick}>
      <div className="scene-bg-overlay" />
      <div className="intro-container">
        <div className="intro-progress">
          {INTRO_SCRIPTS.map((_, idx) => (
            <div key={idx} className={`intro-progress-dot ${idx < introStep ? 'done' : idx === introStep ? 'active' : ''}`} />
          ))}
        </div>
        <div className="intro-text-area">
          {(() => {
            const script = INTRO_SCRIPTS[introStep]
            if (!script) return null
            const styleClass = { narrator: 'intro-narrator', monologue: 'intro-monologue', system: 'intro-system', 'monologue-bold': 'intro-monologue-bold' }[script.style] || 'intro-narrator'
            return (
              <div className={`intro-text-block ${styleClass}`}>
                <div className="intro-speaker-badge">
                  <span className="intro-speaker-icon">{script.icon}</span>
                  <span className="intro-speaker-name">{script.speaker}</span>
                </div>
                <p className="intro-text-content">
                  {introText.split('\n').map((line, i) => (
                    <span key={i}>{line}{i < introText.split('\n').length - 1 && <br />}</span>
                  ))}
                  {introCharIndex < script.text.length && <span className="intro-cursor" />}
                </p>
              </div>
            )
          })()}
        </div>
        <div className="intro-hint">点击屏幕加速</div>
      </div>
    </div>
  )
}
