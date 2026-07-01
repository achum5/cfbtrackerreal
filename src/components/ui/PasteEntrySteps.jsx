import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AI_TOOLS, getPreferredAiKey, setPreferredAiKey, getAiTool } from '../../data/aiTools'

// The unified header for every data-entry modal. Three left-to-right steps:
//   1. 📸 + Copy Prompt   — screenshot your data, copy the AI instructions
//   2. → Open <AI> ▾      — jump to the chosen AI (Claude default, remembered)
//   3. → Paste ▾          — paste the AI's reply back in (▾ reveals a text box)
// Each step has an "i" button that toggles a one-line explanation beneath it.

const DEFAULT_HINTS = {
  screenshot: 'Take screenshots of the data you want to enter (they don\'t have to be perfect, just clear and fully showing). Then tap Copy Prompt to copy the instructions for the AI.',
  ai: 'Open your AI of choice, paste the copied prompt, and upload your screenshot(s). It replies with a block of data. Use the arrow to pick a different AI — your choice is saved on this device.',
  paste: 'Copy the AI\'s reply, then tap Paste. The grid fills in automatically. Tap the arrow to open a text box if the normal paste doesn\'t work.',
}

const Arrow = () => (
  <svg className="w-4 h-4 text-txt-tertiary flex-shrink-0 mt-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const InfoButton = ({ active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="What do I do here?"
    aria-pressed={active}
    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors ${
      active ? 'border-surface-5 bg-surface-4 text-txt-primary' : 'border-surface-5 text-txt-tertiary hover:text-txt-primary'
    }`}
    title="What do I do here?"
  >
    i
  </button>
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
  const hint = { ...DEFAULT_HINTS, ...hints }
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

  const whiteBtn = 'px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 hover:opacity-90'
  const whiteStyle = { backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }

  return (
    <div className="flex-shrink-0">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-3">
        {/* Step 1: screenshot + copy prompt */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xl leading-none" role="img" aria-label="Take a screenshot">📸</span>
            <span className="text-txt-tertiary font-bold text-sm">+</span>
            <button
              type="button"
              onClick={copyPrompt}
              disabled={!aiPrompt}
              className={`rounded-md ${whiteBtn}`}
              style={whiteStyle}
            >
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
          <InfoButton active={openInfo === 'screenshot'} onClick={() => toggleInfo('screenshot')} />
        </div>

        <Arrow />

        {/* Step 2: open the chosen AI (dropdown to switch) */}
        <div className="flex flex-col items-center gap-1.5">
          <div ref={aiWrapRef} className="inline-flex rounded-md overflow-hidden border border-surface-5">
            <a
              href={ai.url}
              target="_blank"
              rel="noopener noreferrer"
              className={whiteBtn}
              style={whiteStyle}
            >
              Open {ai.name}
            </a>
            <button
              type="button"
              onClick={() => setAiMenuOpen((v) => !v)}
              aria-label="Choose AI"
              aria-expanded={aiMenuOpen}
              className="px-2 flex items-center justify-center transition-colors hover:opacity-90"
              style={{ ...whiteStyle, borderLeft: '1px solid var(--surface-1)' }}
            >
              <svg className={`w-4 h-4 transition-transform ${aiMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
          <InfoButton active={openInfo === 'ai'} onClick={() => toggleInfo('ai')} />
        </div>

        <Arrow />

        {/* Step 3: paste (▾ reveals a raw text box) */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex rounded-md overflow-hidden border border-surface-5">
            <button
              type="button"
              onClick={onPaste}
              disabled={disabled}
              className={whiteBtn}
              style={whiteStyle}
            >
              Paste
            </button>
            {onToggleText && (
              <button
                type="button"
                onClick={onToggleText}
                title={showText ? 'Hide text box' : 'Show text box'}
                aria-label={showText ? 'Hide text box' : 'Show text box'}
                aria-pressed={showText}
                className="px-2 flex items-center justify-center transition-colors hover:opacity-90"
                style={{ ...whiteStyle, borderLeft: '1px solid var(--surface-1)' }}
              >
                <svg className={`w-4 h-4 transition-transform ${showText ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            )}
          </div>
          <InfoButton active={openInfo === 'paste'} onClick={() => toggleInfo('paste')} />
        </div>
      </div>

      {/* Info panel for the open step */}
      {openInfo && (
        <p className="mt-2 rounded-md border border-surface-4 bg-surface-2/50 px-3 py-2 text-xs text-txt-tertiary leading-relaxed">
          {hint[openInfo]}
        </p>
      )}

      {/* AI picker menu (portaled so it isn't clipped by the modal's overflow) */}
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
              {t.key === aiKey && <span className="text-[10px] uppercase tracking-wider text-txt-tertiary">Default</span>}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
