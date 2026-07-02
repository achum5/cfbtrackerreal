import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AI_TOOLS, getPreferredAiKey, setPreferredAiKey, getAiTool } from '../../data/aiTools'

// The unified header for every data-entry modal. A genuine 3-step sequence
// (screenshot & copy -> send to your AI -> paste it back), kept deliberately
// quiet: the white action buttons are the one bold element; the numbers,
// captions, and hairline chevrons stay muted. A small info dot on each step
// toggles a one-line explanation beneath the row.

const STEP_HINTS = {
  screenshot: 'Take screenshots of the data you want to enter (they don\'t have to be perfect, just clear and fully showing). Then tap Copy Prompt to copy the instructions.',
  ai: 'Open your AI, paste the copied prompt, and upload your screenshot(s). It replies with a block of data.',
  paste: 'Copy the AI\'s reply, then tap Paste. The grid fills in automatically. Tap the arrow to open a text box if the normal paste doesn\'t work.',
}

const WHITE_BTN = 'h-8 sm:h-9 px-2 sm:px-3 inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-60 hover:opacity-90 whitespace-nowrap'
const WHITE_STYLE = { backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }

const InfoIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)

function Caption({ num, title, active, onToggle }) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 h-4">
      <span className="text-[10px] sm:text-[11px] font-bold tabular text-txt-secondary">{num}</span>
      <span className="text-[10px] sm:text-[11px] font-medium text-txt-tertiary whitespace-nowrap">{title}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`What do I do in step ${num}?`}
        aria-pressed={active}
        className={`transition-colors ${active ? 'text-txt-primary' : 'text-txt-tertiary/50 hover:text-txt-secondary'}`}
      >
        <InfoIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      </button>
    </div>
  )
}

// A hairline chevron between steps, aligned to the control row (not the caption).
const Chevron = () => (
  <svg className="hidden min-[380px]:block self-end mb-2 sm:mb-2.5 w-3 h-3 sm:w-4 sm:h-4 text-txt-tertiary/40 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export default function PasteEntrySteps({
  aiPrompt,
  onPaste,
  showText = false,
  onToggleText,
  disabled = false,
  hints = {},
}) {
  const [copied, setCopied] = useState(false)
  const [openInfo, setOpenInfo] = useState(null) // 'screenshot' | 'ai' | 'paste' | null
  const [aiKey, setAiKey] = useState(() => getPreferredAiKey())
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [menuRect, setMenuRect] = useState(null)
  const aiWrapRef = useRef(null)

  const ai = getAiTool(aiKey)
  const hint = { ...STEP_HINTS, ...hints }
  const toggleInfo = (k) => setOpenInfo((cur) => (cur === k ? null : k))

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt || '')
    } catch {
      const ta = document.createElement('textarea')
      ta.value = aiPrompt || ''
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const repositionMenu = useCallback(() => {
    const el = aiWrapRef.current
    if (el) setMenuRect(el.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!aiMenuOpen) return
    repositionMenu()
    const onDoc = (e) => { if (aiWrapRef.current && !aiWrapRef.current.contains(e.target)) setAiMenuOpen(false) }
    const onScroll = () => repositionMenu()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', repositionMenu)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', repositionMenu)
    }
  }, [aiMenuOpen, repositionMenu])

  const pickAi = (key) => {
    setAiKey(key)
    setPreferredAiKey(key)
    setAiMenuOpen(false)
  }

  return (
    <div className="flex-shrink-0">
      <div className="flex flex-row items-end justify-center gap-1.5 sm:gap-3">
        {/* Step 1 — screenshot & copy */}
        <div className="flex flex-col gap-2">
          <Caption num="1" title="Screenshot & copy" active={openInfo === 'screenshot'} onToggle={() => toggleInfo('screenshot')} />
          <button type="button" onClick={copyPrompt} disabled={!aiPrompt} className={`rounded-md ${WHITE_BTN}`} style={WHITE_STYLE}>
            <span className="text-base leading-none" role="img" aria-label="Screenshot">📸</span>
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>

        <Chevron />

        {/* Step 2 — send to your AI */}
        <div className="flex flex-col gap-2">
          <Caption num="2" title="Send to your AI" active={openInfo === 'ai'} onToggle={() => toggleInfo('ai')} />
          <div ref={aiWrapRef} className="inline-flex self-start rounded-md overflow-hidden border border-surface-5">
            <a href={ai.url} target="_blank" rel="noopener noreferrer" className={WHITE_BTN} style={WHITE_STYLE}>
              Open {ai.name}
            </a>
            <button
              type="button"
              onClick={() => setAiMenuOpen((v) => !v)}
              aria-label="Choose a different AI"
              aria-expanded={aiMenuOpen}
              className="px-1.5 sm:px-2 flex items-center justify-center transition-colors hover:opacity-90"
              style={{ ...WHITE_STYLE, borderLeft: '1px solid var(--surface-1)' }}
            >
              <svg className={`w-4 h-4 transition-transform ${aiMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        <Chevron />

        {/* Step 3 — paste it back */}
        <div className="flex flex-col gap-2">
          <Caption num="3" title="Paste it back" active={openInfo === 'paste'} onToggle={() => toggleInfo('paste')} />
          <div className="inline-flex self-start rounded-md overflow-hidden border border-surface-5">
            <button type="button" onClick={onPaste} disabled={disabled} className={WHITE_BTN} style={WHITE_STYLE}>
              Paste
            </button>
            {onToggleText && (
              <button
                type="button"
                onClick={onToggleText}
                title={showText ? 'Hide text box' : 'Show text box'}
                aria-label={showText ? 'Hide text box' : 'Show text box'}
                aria-pressed={showText}
                className="px-1.5 sm:px-2 flex items-center justify-center transition-colors hover:opacity-90"
                style={{ ...WHITE_STYLE, borderLeft: '1px solid var(--surface-1)' }}
              >
                <svg className={`w-4 h-4 transition-transform ${showText ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info line for the open step */}
      {openInfo && (
        <p className="mt-3 text-xs text-txt-tertiary leading-relaxed max-w-2xl mx-auto text-center">
          {hint[openInfo]}
        </p>
      )}

      {/* AI picker menu — portaled so the modal's overflow can't clip it */}
      {aiMenuOpen && menuRect && createPortal(
        <ul
          className="fixed z-[10001] max-h-72 overflow-y-auto rounded-md border border-surface-5 bg-surface-2 shadow-xl text-sm py-1"
          style={{ top: menuRect.bottom + 2, left: menuRect.left, minWidth: menuRect.width }}
          role="listbox"
        >
          {AI_TOOLS.map((t) => (
            <li
              key={t.key}
              role="option"
              aria-selected={t.key === aiKey}
              onMouseDown={(e) => { e.preventDefault(); pickAi(t.key) }}
              className={`px-3 py-1.5 cursor-pointer whitespace-nowrap flex items-center justify-between gap-3 ${t.key === aiKey ? 'text-txt-primary' : 'text-txt-secondary hover:text-txt-primary hover:bg-surface-3'}`}
            >
              {t.name}
              {t.key === aiKey && <span className="text-[10px] uppercase tracking-wider text-txt-tertiary">Chosen</span>}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
