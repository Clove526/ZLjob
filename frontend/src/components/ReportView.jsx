import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'

export default function ReportView({ onClose }) {
  const { gameId, result } = useGame()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!gameId) return
    fetch(`/api/game/report/${gameId}`)
      .then(r => r.json())
      .then(data => { setReport(data); setLoading(false) })
      .catch(() => { setReport(null); setLoading(false) })
  }, [gameId])

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
        ) : report ? (
          <div className="report-body">
            {/* 风格分析 */}
            <div className="report-section">
              <div className="report-section-icon">📊</div>
              <div className="report-section-content">
                <h3>回答风格分析</h3>
                <p>{report.styleAnalysis}</p>
              </div>
            </div>

            {/* 弱点 */}
            {report.weakPoints && report.weakPoints.length > 0 && (
              <div className="report-section warning">
                <div className="report-section-icon">⚠️</div>
                <div className="report-section-content">
                  <h3>需要改进的领域</h3>
                  <ul>
                    {report.weakPoints.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* 改进建议 */}
            {report.improvements && report.improvements.length > 0 && (
              <div className="report-section success">
                <div className="report-section-icon">💡</div>
                <div className="report-section-content">
                  <h3>具体改进建议</h3>
                  <ul>
                    {report.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* 行业匹配 */}
            <div className="report-section">
              <div className="report-section-icon">🏢</div>
              <div className="report-section-content">
                <h3>行业匹配度</h3>
                <p>{report.industryFit}</p>
              </div>
            </div>

            {/* 综合评价 */}
            <div className="report-section highlight">
              <div className="report-section-icon">🌟</div>
              <div className="report-section-content">
                <h3>综合评价</h3>
                <p>{report.overallAssessment}</p>
              </div>
            </div>

            {report.fallback && (
              <div className="report-fallback-hint">
                <p>💡 配置 DeepSeek API Key 后可获得更详细的 AI 个性化分析</p>
              </div>
            )}
          </div>
        ) : (
          <div className="report-error">
            <p>报告生成失败，请稍后重试</p>
          </div>
        )}
      </div>
    </div>
  )
}
