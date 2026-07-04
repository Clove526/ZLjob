import { useGame } from '../context/GameContext'

export default function ScriptPanel() {
  const { scriptInsight, closeScriptPanel, suspicion, counterRecon } = useGame()

  // 错误状态
  if (scriptInsight?._error) {
    return (
      <div className="script-panel-overlay" onClick={closeScriptPanel}>
        <div className="script-panel error" onClick={e => e.stopPropagation()}>
          <div className="script-panel-header">
            <span className="script-panel-title">⚠️ 偷看失败</span>
            <button className="script-panel-close" onClick={closeScriptPanel}>✕</button>
          </div>
          <div className="script-panel-body">
            <p style={{ color: '#fca5a5', fontSize: '1.1rem', textAlign: 'center', padding: '2rem 1rem', lineHeight: 1.7 }}>
              {scriptInsight.message}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: '0.9rem' }}>
              点击空白处关闭
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!scriptInsight) {
    return (
      <div className="script-panel-overlay" onClick={closeScriptPanel}>
        <div className="script-panel" onClick={e => e.stopPropagation()}>
          <div className="script-panel-header">
            <span className="script-panel-title">📖 正在偷看剧本...</span>
            <button className="script-panel-close" onClick={closeScriptPanel}>✕</button>
          </div>
          <div className="script-panel-body">
            <div className="script-loading">
              <div className="script-loading-spinner" />
              <p>正在读取面试官的内心想法...</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                最多等待 30 秒,失败可点 ✕ 关闭后重试
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="script-panel-overlay" onClick={closeScriptPanel}>
      <div className={`script-panel ${scriptInsight._tampered ? 'tampered' : ''}`} onClick={e => e.stopPropagation()}>
        {/* 面板头部 */}
        <div className="script-panel-header">
          <div className="script-panel-title-row">
            <span className="script-panel-icon">📖</span>
            <span className="script-panel-title">面试官内心剧本</span>
            {scriptInsight._tampered && (
              <span className="script-tampered-badge">⚠️ 信息可能被篡改</span>
            )}
          </div>
          <button className="script-panel-close" onClick={closeScriptPanel}>✕</button>
        </div>

        {/* 风险等级 & 嫌疑值 */}
        <div className="script-panel-meta">
          <div className={`script-risk-badge risk-${scriptInsight.riskLevel || 'low'}`}>
            {scriptInsight.riskLevel === 'high' ? '🔴 高风险偷看' : scriptInsight.riskLevel === 'medium' ? '🟡 中等风险' : '🟢 低风险'}
          </div>
          <div className={`script-suspicion-badge ${suspicion >= 80 ? 'critical' : suspicion >= 50 ? 'warning' : ''}`}>
            嫌疑值: {suspicion}/100
          </div>
          {counterRecon && (
            <div className="script-counter-recon-badge">⚠️ 王总在盯着你...</div>
          )}
        </div>

        {/* 剧本内容 */}
        <div className="script-panel-body">
          {/* 面试官内心独白 */}
          <div className="script-section">
            <div className="script-section-label">💭 面试官真实想法</div>
            <div className="script-section-content inner-thought">
              {scriptInsight.innerThought}
            </div>
          </div>

          {/* 隐藏考察维度 */}
          <div className="script-section">
            <div className="script-section-label">🎯 真正的考察维度</div>
            <div className="script-section-content hidden-dimension">
              {scriptInsight.hiddenDimension}
            </div>
          </div>

          {/* 雷区预警 */}
          {scriptInsight.minefields && scriptInsight.minefields.length > 0 && (
            <div className="script-section danger">
              <div className="script-section-label">⚠️ 雷区预警</div>
              <ul className="script-minefields">
                {scriptInsight.minefields.map((m, i) => (
                  <li key={i} className="script-minefield-item">{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 情绪状态 */}
          <div className="script-section">
            <div className="script-section-label">🎭 面试官情绪</div>
            <div className="script-section-content emotional-state">
              {scriptInsight.emotionalState}
            </div>
          </div>

          {/* 推荐策略 */}
          <div className="script-section highlight">
            <div className="script-section-label">💡 推荐策略</div>
            <div className="script-strategy-recommendation">
              <span className={`script-strategy-badge strategy-${scriptInsight.recommendedStrategy}`}>
                {scriptInsight.recommendedStrategy === 'conservative' ? '🛡️ 保守策略' :
                 scriptInsight.recommendedStrategy === 'aggressive' ? '⚔️ 进取策略' :
                 scriptInsight.recommendedStrategy === 'innovative' ? '💡 创新策略' : '👁️ 察言观色'}
              </span>
              <span className="script-strategy-reason">{scriptInsight.strategyReason}</span>
            </div>
          </div>
        </div>

        {/* 底部提示 */}
        <div className="script-panel-footer">
          <p className="script-footer-hint">
            {suspicion >= 80
              ? '🚨 嫌疑值极高！面试官正在注意你，建议立即关闭剧本'
              : suspicion >= 50
              ? '⚠️ 面试官似乎察觉到了什么，谨慎偷看'
              : '💡 点击空白处关闭剧本，继续面试'}
          </p>
        </div>
      </div>
    </div>
  )
}
