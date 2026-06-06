import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

const ANIM_DURATION = 200

export default function BookView({ interviewers, events, selectedRole, getRoleIntro, INTERVIEWER_CONFIGS, onConfirm }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [transitionPhase, setTransitionPhase] = useState('idle')
  const [transitionDir, setTransitionDir] = useState('up')
  const [leavingPage, setLeavingPage] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)

  const bookRef = useRef(null)
  const selectorRef = useRef(null)
  const prevBtnRef = useRef(null)
  const nextBtnRef = useRef(null)
  const animTimerRef = useRef(null)

  const profilePages = useMemo(() => {
    if (!interviewers || interviewers.length === 0) return []
    return interviewers.map((iv, idx) => {
      const config = INTERVIEWER_CONFIGS[iv.id] || { gender: 'male' }
      return {
        type: 'profile',
        interviewer: iv,
        gender: config.gender,
        pageNum: idx,
      }
    })
  }, [interviewers, INTERVIEWER_CONFIGS])

  const totalPages = useMemo(() => {
    return profilePages.length + 2
  }, [profilePages.length])



  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (selectorOpen && selectorRef.current) {
      selectorRef.current.focus()
    }
  }, [selectorOpen])

  const canFlipNext = currentPage < totalPages - 1 && transitionPhase === 'idle'
  const canFlipPrev = currentPage > 0 && transitionPhase === 'idle'

  const isAnimating = transitionPhase !== 'idle'

  const startTransition = useCallback((dir, newPage) => {
    if (transitionPhase !== 'idle') return
    setIsLoading(true)
    setLeavingPage(currentPage)
    setTransitionDir(dir)
    setTransitionPhase('leaving')

    animTimerRef.current = setTimeout(() => {
      setCurrentPage(newPage)
      setTransitionPhase('entering')
      setSelectorOpen(false)
      animTimerRef.current = setTimeout(() => {
        setTransitionPhase('idle')
        setLeavingPage(-1)
        setIsLoading(false)
      }, ANIM_DURATION)
    }, ANIM_DURATION)
  }, [currentPage, transitionPhase])

  const goNext = useCallback(() => {
    if (!canFlipNext) return
    startTransition('up', currentPage + 1)
  }, [canFlipNext, currentPage, startTransition])

  const goPrev = useCallback(() => {
    if (!canFlipPrev) return
    startTransition('down', currentPage - 1)
  }, [canFlipPrev, currentPage, startTransition])

  const goToPage = useCallback((page) => {
    if (page === currentPage || transitionPhase !== 'idle') return
    const dir = page > currentPage ? 'up' : 'down'
    startTransition(dir, page)
  }, [currentPage, transitionPhase, startTransition])

  const toggleSelector = useCallback(() => {
    if (transitionPhase !== 'idle') return
    setSelectorOpen(prev => !prev)
  }, [transitionPhase])

  const handleSelectorKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setSelectorOpen(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectorOpen) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, selectorOpen])

  const getPageAnimationClass = useCallback((pageIdx) => {
    if (transitionPhase === 'idle') return ''
    if (transitionPhase === 'leaving') {
      if (pageIdx === leavingPage) {
        return transitionDir === 'up' ? 'anim-slide-out-up' : 'anim-slide-out-down'
      }
      const targetIdx = transitionDir === 'up' ? leavingPage + 1 : leavingPage - 1
      if (pageIdx === targetIdx) {
        return 'anim-prepare-enter'
      }
      return ''
    }
    if (transitionPhase === 'entering') {
      if (pageIdx === currentPage) {
        return transitionDir === 'up' ? 'anim-slide-in-up' : 'anim-slide-in-down'
      }
      if (pageIdx === leavingPage) {
        return transitionDir === 'up' ? 'anim-exited-up' : 'anim-exited-down'
      }
      return ''
    }
    return ''
  }, [transitionPhase, transitionDir, leavingPage, currentPage])

  const getPageStyle = useCallback((pageIdx) => {
    const isCurrent = pageIdx === currentPage
    const isLeaving = pageIdx === leavingPage

    if (transitionPhase === 'idle') {
      if (isCurrent) {
        return { transform: 'translateY(0)', opacity: 1, pointerEvents: 'auto', zIndex: pageIdx + 1 }
      }
      return { opacity: 0, pointerEvents: 'none', zIndex: pageIdx + 1 }
    }

    if (transitionPhase === 'leaving') {
      if (isLeaving) {
        return { transform: 'translateY(0)', opacity: 1, pointerEvents: 'none', zIndex: 100 }
      }
      const targetIdx = transitionDir === 'up' ? leavingPage + 1 : leavingPage - 1
      if (pageIdx === targetIdx) {
        const offset = transitionDir === 'up' ? 40 : -40
        return { transform: `translateY(${offset}px)`, opacity: 0, pointerEvents: 'none', zIndex: 99 }
      }
      return { opacity: 0, pointerEvents: 'none', zIndex: pageIdx + 1 }
    }

    if (transitionPhase === 'entering') {
      if (isCurrent) {
        const startOffset = transitionDir === 'up' ? 40 : -40
        return { transform: `translateY(${startOffset}px)`, opacity: 0, pointerEvents: 'auto', zIndex: 100 }
      }
      if (isLeaving) {
        const exitOffset = transitionDir === 'up' ? -40 : 40
        return { transform: `translateY(${exitOffset}px)`, opacity: 0, pointerEvents: 'none', zIndex: 99 }
      }
      return { opacity: 0, pointerEvents: 'none', zIndex: pageIdx + 1 }
    }

    return { opacity: 0, pointerEvents: 'none', zIndex: pageIdx + 1 }
  }, [transitionPhase, transitionDir, currentPage, leavingPage])

  const getPageContent = useCallback((pageIndex) => {
    if (pageIndex === 0) {
      return {
        type: 'cover',
        title: '面试官剧本',
        subtitle: '绝密档案',
      }
    }
    if (pageIndex === totalPages - 1) {
      return { type: 'back-cover' }
    }
    const profileIndex = pageIndex - 1
    const profile = profilePages[profileIndex]
    if (!profile) return { type: 'empty' }
    return profile
  }, [totalPages, profilePages])

  const handleConfirm = useCallback(() => {
    if (onConfirm) onConfirm()
  }, [onConfirm])

  const getCornerWearStyle = (corner) => {
    const base = {
      content: '""',
      position: 'absolute',
      width: '28px',
      height: '28px',
      pointerEvents: 'none',
      zIndex: 2,
    }
    switch (corner) {
      case 'tl':
        return { ...base, top: 0, left: 0, background: 'radial-gradient(circle at 0 0, rgba(139,90,43,0.15) 0%, transparent 70%)', borderTopLeftRadius: '2px' }
      case 'tr':
        return { ...base, top: 0, right: 0, background: 'radial-gradient(circle at 100% 0, rgba(139,90,43,0.15) 0%, transparent 70%)', borderTopRightRadius: '2px' }
      case 'bl':
        return { ...base, bottom: 0, left: 0, background: 'radial-gradient(circle at 0 100%, rgba(139,90,43,0.18) 0%, transparent 70%)', borderBottomLeftRadius: '2px' }
      case 'br':
        return { ...base, bottom: 0, right: 0, background: 'radial-gradient(circle at 100% 100%, rgba(139,90,43,0.18) 0%, transparent 70%)', borderBottomRightRadius: '2px' }
      default:
        return base
    }
  }

  const pageLabel = (idx) => {
    if (idx === 0) return '封面'
    if (idx === totalPages - 1) return '封底'
    return `第 ${idx} / ${totalPages - 2} 页`
  }

  return (
    <div className="book-scene">
      <div className="book-scene-bg" />
      <div className="book-lamp-effect" />
      <div className="book-container">
        <div className="book-spine-shadow" />
        <div
          ref={bookRef}
          className={`book ${isAnimating ? 'book-animating' : ''}`}
          role="region"
          aria-label="面试官剧本翻书阅读器"
          aria-roledescription="翻书阅读器"
        >
          <div className="book-cover-left" />
          <div className="book-pages-stack">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const content = getPageContent(idx)
              const animClass = getPageAnimationClass(idx)
              const style = getPageStyle(idx)
              const isActive = transitionPhase === 'idle' && idx === currentPage

              if (content.type === 'empty') return null

              return (
                <div
                  key={idx}
                  className={`book-page ${isActive ? 'page-active' : ''} ${content.type === 'cover' ? 'page-cover' : ''} ${content.type === 'back-cover' ? 'page-back-cover' : ''} ${animClass}`}
                  style={style}
                  aria-hidden={!isActive && transitionPhase === 'idle'}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="page-corner-wear tl" style={getCornerWearStyle('tl')} />
                  <div className="page-corner-wear tr" style={getCornerWearStyle('tr')} />
                  <div className="page-corner-wear bl" style={getCornerWearStyle('bl')} />
                  <div className="page-corner-wear br" style={getCornerWearStyle('br')} />

                  <div className="page-foxing" />
                  <div className="page-aging-lines" />

                  {content.type === 'cover' && (
                    <div className="book-cover-content">
                      <div className="cover-ornate-border">
                        <div className="cover-ornate-inner">
                          <div className="cover-decoration top" />
                          <h1 className="cover-title">{content.title}</h1>
                          <div className="cover-divider" />
                          <p className="cover-subtitle">{content.subtitle}</p>
                          <p className="cover-epigraph">"知己知彼，百战不殆"</p>
                          <div className="cover-decoration bottom" />
                          <div className="cover-pages-hint">
                            共 {interviewers.length} 位面试官档案
                          </div>
                        </div>
                      </div>
                      <div className="cover-corner-flourish tl" />
                      <div className="cover-corner-flourish tr" />
                      <div className="cover-corner-flourish bl" />
                      <div className="cover-corner-flourish br" />
                      <div className="cover-spine-edge" />
                    </div>
                  )}

                  {content.type === 'back-cover' && (
                    <div className="book-back-cover-content">
                      <div className="back-cover-ornate">
                        <p className="back-cover-text">你已经掌握了所有面试官的秘密</p>
                        <div className="back-cover-divider" />
                        <p className="back-cover-ready">准备好开始面试了吗？</p>
                        <button className="book-confirm-btn" onClick={handleConfirm} aria-label="进入下一环节">
                          合上剧本，走进会议室
                        </button>
                        <p className="back-cover-hint">轻抚书页 · 命运在此刻转动</p>
                      </div>
                    </div>
                  )}

                  {content.type === 'profile' && content.interviewer && (
                    <div className="page-profile">
                      <div className="page-header">
                        <div className="page-number-badge">{idx}/{totalPages - 2}</div>
                        <h2 className="page-interviewer-name">{content.interviewer.name}</h2>
                        <p className="page-interviewer-title">{content.interviewer.title}</p>
                      </div>
                      <div className="page-body">
                        <p className="page-description">{content.interviewer.description}</p>
                        <div className="page-intel-section">
                          <div className="page-intel-item page-minefield">
                            <span className="intel-icon">⚡</span>
                            <span className="intel-label">雷区</span>
                            <span className="intel-text">
                              {content.interviewer.id === 'p1' || content.interviewer.id === 'p8' ? '讨厌浮夸包装，喜欢真实能力展示' :
                                content.interviewer.id === 'p2' || content.interviewer.id === 'p7' ? '反感不稳定因素，看重长期发展潜力' :
                                content.interviewer.id === 'p3' || content.interviewer.id === 'p6' ? '无法容忍缺乏野心，欣赏有抱负的人' :
                                content.interviewer.id === 'p4' ? '对虚假回答零容忍，重视诚实品质' :
                                content.interviewer.id === 'p5' || content.interviewer.id === 'p9' ? '不喜欢空谈理论，偏好实际案例' :
                                '极度厌恶风险，需要稳定可靠的答案'}
                            </span>
                          </div>
                          <div className="page-intel-item page-strategy">
                            <span className="intel-icon">💡</span>
                            <span className="intel-label">攻略</span>
                            <span className="intel-text">
                              {content.interviewer.id === 'p1' || content.interviewer.id === 'p8' ? '用数据和逻辑说服他，少说空话' :
                                content.interviewer.id === 'p2' || content.interviewer.id === 'p7' ? '强调稳定性和长期发展规划' :
                                content.interviewer.id === 'p3' || content.interviewer.id === 'p6' ? '展示野心和进取心，别太谦虚' :
                                content.interviewer.id === 'p4' ? '坦诚回答，不要试图包装' :
                                content.interviewer.id === 'p5' || content.interviewer.id === 'p9' ? '用具体案例说话，别空谈理论' :
                                '强调你的稳定性和风险控制意识'}
                            </span>
                          </div>
                        </div>
                        {content.interviewer.personality && (
                          <div className="page-traits">
                            <span className="trait-badge">{content.interviewer.personality}</span>
                          </div>
                        )}
                      </div>
                      <div className="page-footer">
                        <div className="page-footer-line" />
                        <span className="page-footer-note">绝密 · 阅后即焚</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="book-binding-line" />
          <div className="book-binding-shadow" />

          <div className="book-page-edge top" />
          <div className="book-page-edge bottom" />
          <div className="book-page-edge front" />

          {events && events.length > 0 && (
            <div className="book-event-ribbon">
              <span className="ribbon-icon">🎲</span>
              <span className="ribbon-text">剧本变数：{events.length} 个事件</span>
            </div>
          )}
        </div>

        <nav className="book-nav" aria-label="页面导航">
          <button
            ref={prevBtnRef}
            className={`book-nav-btn book-nav-prev ${canFlipPrev ? '' : 'disabled'}`}
            onClick={goPrev}
            disabled={!canFlipPrev}
            aria-label="上一页"
            title="上一页 (←)"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="book-nav-indicator-wrapper">
            <button
              className={`book-nav-indicator ${selectorOpen ? 'selector-active' : ''}`}
              onClick={toggleSelector}
              aria-live="polite"
              aria-atomic="true"
              aria-haspopup="listbox"
              aria-expanded={selectorOpen}
              aria-label={`当前页面：${pageLabel(currentPage)}`}
              disabled={isAnimating}
            >
              {pageLabel(currentPage)}
              <svg className="selector-arrow" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {selectorOpen && (
              <div
                className="book-page-selector"
                role="listbox"
                aria-label="选择页码"
                ref={selectorRef}
                tabIndex={-1}
                onKeyDown={handleSelectorKeyDown}
              >
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    className={`selector-option ${idx === currentPage ? 'selected' : ''}`}
                    role="option"
                    aria-selected={idx === currentPage}
                    onClick={() => { goToPage(idx) }}
                  >
                    <span className="selector-option-num">{idx === 0 ? '✦' : idx === totalPages - 1 ? '✧' : idx}</span>
                    <span className="selector-option-label">
                      {idx === 0 ? '封面' : idx === totalPages - 1 ? '封底' : `${idx} / ${totalPages - 2}`}
                    </span>
                    {idx === currentPage && <span className="selector-current-mark">当前</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            ref={nextBtnRef}
            className={`book-nav-btn book-nav-next ${canFlipNext ? '' : 'disabled'}`}
            onClick={goNext}
            disabled={!canFlipNext}
            aria-label="下一页"
            title="下一页 (→)"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </nav>

        <div className="book-nav-footer" aria-live="polite" aria-atomic="true">
          {isAnimating && (
            <span className="book-loading-indicator">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </span>
          )}
          {!isAnimating && currentPage > 0 && currentPage < totalPages - 1 && (
            <span className="book-hint-text">
              使用 ← → 方向键翻页
            </span>
          )}
          {!isAnimating && currentPage === 0 && (
            <span className="book-hint-text">
              翻开剧本，开始了解面试官
            </span>
          )}
          {!isAnimating && currentPage === totalPages - 1 && (
            <span className="book-hint-text">
              阅读完毕，点击按钮开始面试
            </span>
          )}
        </div>

        {selectedRole && (
          <div className="book-role-badge">
            <span className="role-badge-text">{getRoleIntro(selectedRole)}</span>
          </div>
        )}
      </div>
    </div>
  )
}