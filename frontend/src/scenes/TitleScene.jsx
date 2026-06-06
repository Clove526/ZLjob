import { useGame } from '../context/GameContext'

export default function TitleScene() {
  const { transitionToPhase, startDailyChallenge } = useGame()

  return (
    <div className="title-scene">
      <div className="title-background">
        <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Cinematic%20night%20cityscape,%20Chinese%20metropolitan%20skyline%20at%20midnight,%20neon%20lights,%20purple%20blue%20atmospheric%20fog,%20dramatic%20moody,%20visual%20novel%20title%20screen,%20wide%20landscape&image_size=landscape_16_9" alt="" onError={(e) => e.target.style.display = 'none'} />
      </div>
      <div className="title-particles">
        {['particle--purple', 'particle--cyan', 'particle--rose', 'particle--purple', 'particle--cyan', 'particle--rose', 'particle--purple', 'particle--cyan'].map((cls, i) => (
          <div key={i} className={`particle ${cls}`} />
        ))}
      </div>
      <div className="title-content">
        <div className="title-logo">
          <h1 className="title-main">重生之我偷看了面试官的剧本</h1>
          <p className="title-subtitle">开局一本剧本，胜负全看演技</p>
        </div>
        <div className="title-decoration-line" />
        <div className="title-actions">
          <button className="title-btn-start" onClick={() => transitionToPhase('select')}><span>▶ 开始游戏</span></button>
          <button className="title-btn-start daily" onClick={startDailyChallenge}><span>🔥 每日挑战</span></button>
          <button className="title-btn-start" style={{ opacity: 0.6 }}><span>📖 成就图鉴</span></button>
        </div>
      </div>
      <div className="title-version">v2.0 · Visual Novel Experience</div>
    </div>
  )
}
