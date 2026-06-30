import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'

export default function ReportView({ onClose }) {
  const { gameId, result } = useGame()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    setError(null)
    fetch(`/api/game/report/${gameId}`)
      .then(r => r.json().catch(() => ({})))
      .then(data => {
        if (data && !data.error) {
          setReport(data)
        } else {
          setError(data?.error || '报告生成失败')
        }
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || '网络错误')
        setLoading(false)
      })
  }, [gameId])

  const styleAnalysis = report?.styleAnalysis || report?.style_analysis
  const weakPoints = report?.weakPoints || report?.weak_points
  const improvements = report?.improvements || report?.improvement_suggestions
  const industryFit = report?.industryFit || report?.industry_fit
  const overallAssessment = report?.overallAssessment || report?.overall_assessment

  const hasContent = styleAnalysis || industryFit || overallAssessment ||
    (weakPoints && weakPoints.length > 0) ||
    (improvements && improvements.length > 0)

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-panel" onClick={e => e.stopPropagation()}>
        <div className="report-header">
          <h2>🤖 AI 面试复盘报告</h2>
          <span className="report-rating-badge">{result?.ending?.id || '?'} 级</span>
          <button className="report-close-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="report-loading">
            <div className="script-loading-spinner" />
            <p>AI 正在分析你的面试表现...</p>
          </div>
        ) : !hasContent ? (
          <div className="report-error">
            <div className="report-error-icon">😔</div>
            <p className="report-error-title">报告生成失败</p>
            <p className="report-error-msg">{error || 'AI 暂时无法生成报告，请稍后重试'}</p>
            <p className="report-error-hint">提示：确认后端 LLM 服务（如 DeepSeek API Key）已正确配置</p>
          </div>
        ) : (
          <div className="report-body">
            {styleAnalysis && (
              <div className="report-section">
                <div className="report-section-icon">📊</div>
                <div className="report-section-content">
                  <h3>回答风格分析</h3>
                  <p>{styleAnalysis}</p>
                </div>
              </div>
            )}

            {weakPoints && weakPoints.length > 0 && (
              <div className="report-section warning">
                <div className="report-section-icon">⚠️</div>
                <div className="report-section-content">
                  <h3>需要改进的领域</h3>
                  <ul>
                    {weakPoints.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {improvements && improvements.length > 0 && (
              <div className="report-section success">
                <div className="report-section-icon">💡</div>
                <div className="report-section-content">
                  <h3>具体改进建议</h3>
                  <ul>
                    {improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {industryFit && (
              <div className="report-section">
                <div className="report-section-icon">🏢</div>
                <div className="report-section-content">
                  <h3>行业匹配度</h3>
                  <p>{industryFit}</p>
                </div>
              </div>
            )}

            {overallAssessment && (
              <div className="report-section highlight">
                <div className="report-section-icon">🌟</div>
                <div className="report-section-content">
                  <h3>综合评价</h3>
                  <p>{overallAssessment}</p>
                </div>
              </div>
            )}

            {(report?.fallback || error) && (
              <div className="report-fallback-hint">
                <p>💡 配置 DeepSeek API Key 后可获得更详细的 AI 个性化分析</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
