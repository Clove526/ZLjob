import { GameProvider, useGame } from './context/GameContext'
import BookView from './components/BookView'
import TitleScene from './scenes/TitleScene'
import IntroScene from './scenes/IntroScene'
import SelectScene from './scenes/SelectScene'
import ReincarnationRoom from './scenes/ReincarnationRoom'
import BattleScene from './scenes/BattleScene'
import EndingScene from './scenes/EndingScene'

function GameShell() {
  const {
    phase, isTransitioning, getCurrentBackground,
    interviewers, avatarUrls, events, selectedRole, confirmBriefing,
  } = useGame()

  return (
    <div className="scene-container">
      {isTransitioning && (
        <div className="scene-transition-overlay"><div className="transition-spinner" /></div>
      )}

      <div className="scene-bg">
        <img src={getCurrentBackground()} alt="" loading="lazy" onError={(e) => e.target.style.display = 'none'} />
      </div>
      <div className="bg-grid-pattern" />

      {phase === 'title' && <TitleScene />}
      {phase === 'intro' && <IntroScene />}
      {phase === 'select' && <SelectScene />}
      {phase === 'reincarnation' && <ReincarnationRoom />}

      {phase === 'briefing' && (interviewers || []).length > 0 && (
        <BookView
          interviewers={interviewers}
          avatarUrls={avatarUrls}
          events={events}
          selectedRole={selectedRole}
          INTERVIEWER_CONFIGS={{
            p1: { name: '张总', gender: 'male' }, p2: { name: '李姐', gender: 'female' },
            p3: { name: '王总', gender: 'male' }, p4: { name: '陈工', gender: 'male' },
            p5: { name: '赵姐', gender: 'female' }, p6: { name: '刘总', gender: 'male' },
            p7: { name: '周姐', gender: 'female' }, p8: { name: '吴工', gender: 'male' },
            p9: { name: '郑总', gender: 'male' }, p10: { name: '冯姐', gender: 'female' },
          }}
          getRoleIntro={(role) => {
            switch (role) {
              case 'freshman': return '作为天才应届生，你拥有极强的学习能力。这次，你不会再让经验不足成为绊脚石。'
              case 'veteran': return '作为行业老兵，你经验丰富、专业扎实。这一次，你不会再让机会溜走。'
              case 'career': return '作为跨界勇士，你的转型勇气令人钦佩。这一次，你不会再让跨界的标签定义你。'
              default: return ''
            }
          }}
          onConfirm={confirmBriefing}
        />
      )}

      {phase === 'playing' && <BattleScene />}
      {phase === 'ending' && <EndingScene />}
    </div>
  )
}

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  )
}
