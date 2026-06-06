import { useState } from 'react'
import { useGame } from '../context/GameContext'
import CharacterAvatar from '../components/CharacterAvatar'
import ScriptPanel from '../components/ScriptPanel'

const RATING_STYLES = { S: 'rating-s', A: 'rating-a', B: 'rating-b', C: 'rating-c', D: 'rating-d' }

function generateChoices(question) {
  if (!question || !question.answers) return []
  return question.answers.slice(0, 4).map((answer, idx) => ({
    id: ['a', 'b', 'c', 'd'][idx],
    type: answer.type,
    text: answer.content,
    answerId: answer.id,
  }))
}

export default function BattleScene() {
  const {
    interviewers, avatarUrls, currentQuestion, timerActive, countdown,
    battlePhase, setBattlePhase, stageInfo, currentStage, bossHP,
    playerHP, collectedCards, selectedStrategy, handleStrategySelect,
    handleChoiceSubmit, selectedChoice, lastScore, lastDamage, lastHpDamage,
    newCards, stageCleared, stageClearedName, playerDefeated,
    lastRoundResult, isSubmitting,
    suspicion, suspicionEffect, handleScriptPeek, isPeeking, peekCooldown,
    handleFreeTextSubmit, freeTextAnswer, setFreeTextAnswer, isFreeTextMode, setFreeTextMode,
  } = useGame()

  // Show loading state while transitioning between questions or stages
  if (!currentQuestion && (battlePhase === 'questioning' || battlePhase === 'preparation')) {
    return (
      <div className="battle-loading">
        <div className="loading-spinner" />
        <p>加载中...</p>
      </div>
    )
  }

  if (!currentQuestion) return null

  return (
    <div className="boss-battle-layout">
      {/* 顶部状态栏 */}
      <div className="battle-top-bar">
        <div className="battle-stage-info">
          <span className="battle-stage-badge">{stageInfo?.bossName || '面试挑战'}</span>
          <span className="battle-stage-title">{stageInfo?.bossTitle || ''}</span>
        </div>
        {/* 嫌疑值指示器 */}
        <div className="battle-suspicion-indicator" title="嫌疑值：偷看剧本会积累嫌疑，过高会被识破！">
          <span className={`suspicion-icon ${suspicion >= 80 ? 'danger' : suspicion >= 50 ? 'warn' : ''}`}>
            {suspicion >= 80 ? '⚠️' : suspicion >= 50 ? '👁️' : '🔍'}
          </span>
          <div className="suspicion-bar-mini">
            <div className={`suspicion-fill ${suspicion >= 80 ? 'critical' : suspicion >= 50 ? 'warning' : 'safe'}`}
              style={{ width: `${suspicion}%` }} />
          </div>
          <span className={`suspicion-value ${suspicion >= 80 ? 'text-red-400' : suspicion >= 50 ? 'text-amber-400' : 'text-gray-400'}`}>
            {suspicion}/100
          </span>
        </div>
        <div className="battle-card-progress">
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} className={`battle-card-slot ${collectedCards.length > i ? 'collected' : ''}`}>
              {collectedCards.length > i ? '🃏' : '◇'}
            </span>
          ))}
          <span className="battle-card-count">{collectedCards.length}/5</span>
        </div>
      </div>

      {/* HP 条区域 */}
      <div className="battle-hp-area">
        <div className="battle-hp-row">
          <div className="battle-hp-label">
            <span className="battle-boss-icon">👹</span>
            <span className="battle-hp-name">{stageInfo?.bossName || 'Boss'}</span>
          </div>
          <div className="battle-hp-bar-container">
            <div className="battle-hp-bar">
              <div className="battle-hp-fill boss"
                style={{ width: `${stageInfo ? ((bossHP[currentStage] || 0) / stageInfo.initialHP) * 100 : 0}%` }} />
            </div>
            <span className="battle-hp-value">{bossHP[currentStage] || 0}/{stageInfo?.initialHP || 80}</span>
          </div>
        </div>
        <div className="battle-hp-row">
          <div className="battle-hp-label">
            <span className="battle-player-icon">🧑</span>
            <span className="battle-hp-name">你</span>
          </div>
          <div className="battle-hp-bar-container">
            <div className="battle-hp-bar">
              <div className="battle-hp-fill player" style={{ width: `${playerHP}%` }} />
            </div>
            <span className="battle-hp-value">{playerHP}/100</span>
          </div>
        </div>
      </div>

      {/* 对战主区域 */}
      <div className="battle-main-area">
        {/* 备战阶段 */}
        {battlePhase === 'preparation' && (
          <div className="battle-preparation">
            <div className="battle-boss-enter">
              <div className="battle-boss-avatar">
                {(interviewers || []).find(iv => iv.id === stageInfo?.interviewerId) && (
                  <CharacterAvatar
                    name={(interviewers || []).find(iv => iv.id === stageInfo.interviewerId).name}
                    gender={(interviewers || []).find(iv => iv.id === stageInfo.interviewerId).gender || 'male'}
                    customUrl={avatarUrls[stageInfo.interviewerId]}
                    interviewerId={stageInfo.interviewerId}
                    size="large"
                  />
                )}
              </div>
              <h2 className="battle-stage-name">{stageInfo?.bossName || ''}</h2>
              <p className="battle-stage-subtitle">{stageInfo?.bossTitle || ''}</p>
              <p className="battle-stage-desc">"{interviewers.find(iv => iv.id === stageInfo?.interviewerId)?.description || ''}"</p>
              <button className="battle-start-btn" onClick={() => setBattlePhase('questioning')}>开始应战</button>
            </div>
          </div>
        )}

        {/* 提问 + 策略选择 */}
        {battlePhase === 'questioning' && (
          <div className="battle-question-area">
            <div className="battle-question-box">
              <div className="battle-question-label">{currentQuestion.category}</div>
              <p className="battle-question-text">"{currentQuestion.question_text}"</p>
              {currentQuestion.isPressure && <div className="battle-pressure-tag">🔥 压力问题</div>}
              {timerActive && countdown > 0 && (
                <span className={`battle-timer ${countdown <= 10 ? 'urgent' : ''}`}>⏱ {countdown}s</span>
              )}
            </div>

            {/* 剧本碎片提示 + 偷看按钮 */}
            <div className="battle-script-area">
              {currentQuestion.hints && currentQuestion.hints.length > 0 && (
                <div className="battle-script-fragment">
                  <span className="script-fragment-icon">📜</span>
                  <span className="script-fragment-text">剧本提示：{currentQuestion.hints[0]}</span>
                </div>
              )}
              {/* 偷看剧本按钮 */}
              <button
                className={`battle-peek-btn ${isPeeking ? 'active' : ''} ${peekCooldown ? 'cooldown' : ''} ${suspicion >= 80 ? 'dangerous' : ''}`}
                onClick={handleScriptPeek}
                disabled={isPeeking || peekCooldown}
                title={suspicion >= 80 ? '⚠️ 嫌疑值过高，小心被识破！' : suspicion >= 50 ? '面试官开始注意你了...' : '偷看面试官的内心剧本'}
              >
                <span className="peek-btn-icon">{isPeeking ? '📖' : '🔮'}</span>
                <span className="peek-btn-label">
                  {isPeeking ? '查看中...' : peekCooldown ? '冷却中...' : '偷看剧本'}
                </span>
                {suspicionEffect === 'critical' && <span className="peek-btn-warn">⚠️ 危险</span>}
              </button>
            </div>

            {/* 嫌疑值警告 */}
            {suspicionEffect === 'warning' && (
              <div className="battle-suspicion-warn">
                <span>⚠️ 面试官似乎注意到了什么...</span>
              </div>
            )}
            {suspicionEffect === 'critical' && (
              <div className="battle-suspicion-warn critical">
                <span>🚨 面试官在盯着你！再偷看可能会被当场识破！</span>
              </div>
            )}

            {/* 答题模式切换 */}
            <div className="battle-mode-toggle">
              <button
                className={`mode-toggle-btn ${!isFreeTextMode ? 'active' : ''}`}
                onClick={() => setFreeTextMode(false)}
              >📋 选择题</button>
              <button
                className={`mode-toggle-btn ${isFreeTextMode ? 'active' : ''}`}
                onClick={() => setFreeTextMode(true)}
              >✍️ AI 自由回答</button>
            </div>

            {/* 选择题模式 */}
            {!isFreeTextMode && (
              <>
                <div className="battle-strategy-bar">
                  {[
                    { id: 'conservative', label: '保守策略', icon: '🛡️', desc: '稳扎稳打，HP损失减半' },
                    { id: 'aggressive', label: '进取策略', icon: '⚔️', desc: '主动出击，伤害+20%' },
                    { id: 'innovative', label: '创新策略', icon: '💡', desc: '出奇制胜，伤害+50%但风险高' },
                    { id: 'perceptive', label: '察言观色', icon: '👁️', desc: '见招拆招，根据状态调整' },
                  ].map(s => (
                    <button
                      key={s.id}
                      className={`battle-strategy-btn ${selectedStrategy === s.id ? 'active' : ''}`}
                      onClick={() => handleStrategySelect(s.id)}
                    >
                      <span className="strategy-icon">{s.icon}</span>
                      <span className="strategy-label">{s.label}</span>
                      <span className="strategy-desc">{s.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="battle-answer-list">
                  {generateChoices(currentQuestion).map((choice, idx) => (
                    <button
                      key={choice.id}
                      className={`battle-answer-btn ${!selectedStrategy ? 'disabled' : ''}`}
                      onClick={() => selectedStrategy && handleChoiceSubmit(choice)}
                      style={{ animationDelay: `${idx * 0.08}s` }}
                    >
                      <span className="battle-answer-id">{choice.id.toUpperCase()}.</span>
                      <span className="battle-answer-text">{choice.text}</span>
                      <span className="battle-answer-type">{choice.type}</span>
                    </button>
                  ))}
                </div>
                {!selectedStrategy && (
                  <p className="battle-strategy-hint">请先选择一种应对策略</p>
                )}
              </>
            )}

            {/* 自由文本 AI 模式 */}
            {isFreeTextMode && (
              <div className="battle-freetext-area">
                <div className="freetext-hint">
                  <span>🤖 AI 将分析你的回答并给出评估。试着像真实面试一样表达自己。</span>
                </div>
                <textarea
                  className="freetext-input"
                  value={freeTextAnswer}
                  onChange={(e) => setFreeTextAnswer(e.target.value)}
                  placeholder="输入你的回答...&#10;&#10;例如：我认为我最大的缺点是有时过于关注细节，导致项目进度受影响。但我已经通过时间管理工具在改进这一点..."
                  rows={4}
                  disabled={isSubmitting}
                />
                <button
                  className="freetext-submit-btn"
                  onClick={handleFreeTextSubmit}
                  disabled={isSubmitting || !freeTextAnswer.trim()}
                >
                  {isSubmitting ? '⏳ AI 分析中...' : '🚀 提交回答'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 回答中 */}
        {battlePhase === 'answering' && selectedChoice && (
          <div className="battle-answering">
            <div className="battle-damage-anim">
              <div className="battle-player-response-bubble">
                <p className="battle-response-label">{isFreeTextMode ? '你的 AI 自由回答' : '你的回答'}</p>
                <p className="battle-response-text">"{selectedChoice.text}"</p>
                {isFreeTextMode && <p className="battle-response-ai-hint">🤖 AI 正在分析你的回答...</p>}
              </div>
            </div>
          </div>
        )}

        {/* 评分动画 */}
        {battlePhase === 'scoring' && lastScore && (
          <div className="battle-scoring">
            <div className={`battle-score-popup ${lastScore.toLowerCase()}`}>
              <span className="battle-score-label">{lastScore === 'Excellent' ? '⭐ 完美！' : lastScore === 'Good' ? '👍 不错！' : lastScore === 'OK' ? '👌 还行' : '💔 糟糕'}</span>
              {lastDamage > 0 && <span className="battle-damage-text">Boss 受到 <strong>-{lastDamage}</strong> 点伤害！</span>}
              {lastDamage <= 0 && <span className="battle-damage-text bad">Boss 回复了 <strong>{Math.abs(lastDamage)}</strong> 点HP</span>}
              {lastHpDamage > 0 && <span className="battle-hp-damage">你受到 <strong>-{lastHpDamage}</strong> 点伤害</span>}
              {lastRoundResult?.analysis && (
                <div className="battle-ai-analysis"><span>🤖 {lastRoundResult.analysis}</span></div>
              )}
              {lastRoundResult?.overallScore != null && (
                <div className="battle-ai-score">AI 评分: {lastRoundResult.overallScore}/100</div>
              )}
              {stageCleared && (
                <div className="battle-stage-cleared"><span>🎉 {stageClearedName} 通关！</span></div>
              )}
              {playerDefeated && (
                <div className="battle-player-defeated"><span>💀 你的 HP 归零了...面试失败</span></div>
              )}
            </div>
            <div className="battle-cards-earned">
              {newCards.map(cardId => {
                const card = [{id:'c1',name:'技术之证'},{id:'c2',name:'沟通之证'},{id:'c3',name:'逻辑之证'},{id:'c4',name:'坚韧之证'},{id:'c5',name:'协作之证'}].find(c => c.id === cardId)
                return card ? <span key={cardId} className="battle-card-earned">🃏 获得卡牌：{card.name}</span> : null
              })}
            </div>
          </div>
        )}

        {/* 结算：面试官评价 */}
        {battlePhase === 'settled' && lastRoundResult && (
          <div className="battle-settled">
            <div className="battle-llm-response">
              <p className="battle-llm-text">
                {Object.values(lastRoundResult.llmResponse || {})[0] || lastRoundResult.innerMonologue || '（面试官在记录着什么...）'}
              </p>
            </div>
            {lastRoundResult.analysis && (
              <div className="battle-llm-analysis">
                <p>{lastRoundResult.analysis}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 剧本面板 */}
      {isPeeking && <ScriptPanel />}
    </div>
  )
}
