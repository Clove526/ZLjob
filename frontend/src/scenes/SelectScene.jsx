import { ROLES, useGame } from '../context/GameContext'
import CharacterAvatar from '../components/CharacterAvatar'

export default function SelectScene() {
  const { selectRoleAndContinue } = useGame()

  return (
    <div className="character-select">
      <div className="title-background">
        <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Cinematic%20night%20cityscape,%20Chinese%20metropolitan%20skyline%20at%20midnight,%20neon%20lights,%20purple%20blue%20atmospheric%20fog,%20dramatic%20moody,%20visual%20novel%20title%20screen,%20wide%20landscape&image_size=landscape_16_9" alt="" onError={(e) => e.target.style.display = 'none'} />
      </div>
      <h2 className="character-select-title">选择你的重生身份</h2>
      <p className="character-select-subtitle">每位角色都有独特的优势与挑战</p>
      <div className="character-grid">
        {ROLES.map((role, idx) => (
          <div key={role.id} className="character-card" onClick={() => selectRoleAndContinue(role.id)} style={{ animationDelay: `${idx * 0.15}s` }}>
            <div className="character-portrait">
              <CharacterAvatar name={role.title} gender={role.id === 'freshman' ? 'female' : role.id === 'veteran' ? 'male' : 'male'} size="large" />
            </div>
            <div className="character-info">
              <div className="character-name">{role.title}</div>
              <div className="character-role">{role.label.split(' ')[1]}</div>
              <p className="character-desc">{role.desc}</p>
              <div className="character-stats">
                <div className="character-stat"><span className="stat-label">潜力</span><span className="stat-value">{role.id === 'freshman' ? 'S' : role.id === 'veteran' ? 'B' : 'A'}</span></div>
                <div className="character-stat"><span className="stat-label">经验</span><span className="stat-value">{role.id === 'veteran' ? 'S' : role.id === 'career' ? 'B' : 'C'}</span></div>
                <div className="character-stat"><span className="stat-label">适应性</span><span className="stat-value">{role.id === 'career' ? 'S' : role.id === 'freshman' ? 'A' : 'B'}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
