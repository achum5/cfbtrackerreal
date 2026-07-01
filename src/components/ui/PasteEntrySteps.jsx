import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AI_TOOLS, getPreferredAiKey, setPreferredAiKey, getAiTool } from '../../data/aiTools'

// The unified header for every data-entry modal — a framed, numbered 3-step
// flow so the workflow reads at a glance:
//   1. Screenshot & copy   📸 + Copy Prompt
//   2. Send to your AI      Open <AI> (dropdown to switch; choice remembered)
//   3. Paste it back        Paste (▾ reveals a raw text box)
// Each step title carries an "i" that toggles a one-line explanation below.

const STEP_HINTS = {
  screenshot: 'Take screenshots of the data you want to enter (they don\'t have to be perfect, just clear and fully showing). Then tap Copy Prompt to copy the instructions.',
  ai: 'Open your AI, paste the copied prompt, and upload your screenshot(s). It replies with a block of data. Use the arrow to switch assistants — your choice is saved on this device.',
  paste: 'Copy the AI\'s reply, then tap Paste. The grid fills in automatically. Tap the arrow to open a text box if the normal paste doesn\'t work.',
}

const WHITE_BTN = 'px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 hover:opacity-90'
const WHITE_STYLE = { backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }

const Chevron = () => (
  <div className="hidden sm:flex items-center self-stretch text-txt-tertiary/70" aria-hidden="true">
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  </div>
)

function Step({ num, title, infoKey, openInfo, onToggle, children }) {
  const active = openInfo === infoKey
  return (
    <div className="flex-1 min-w-[150px] flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold bg-surface-4 text-txt-secondary flex-shrink-0">{num}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-txt-tertiary truncate">{title}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`What do I do in step ${num}?`}
          aria-pressed={active}
          className={`ml-auto flex-shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
            active ? 'border-surface-5 bg-surface-4 text-txt-primary' : 'border-surface-5 text-txt-tertiary hover:text-txt-primary'
          }`}
        >
          i
        </button>
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  )
}

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
    <div className="flex-shrink-0 rounded-xl border border-surface-4 bg-surface-2/40 px-3 py-3">
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-2">
        {/* Step 1 — screenshot + copy prompt */}
        <Step num={1} title="Screenshot & copy" infoKey="screenshot" openInfo={openInfo} onToggle={() => toggleInfo('screenshot')}>
          <div className="flex items-center gap-1.5">
            <span
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-surface-3 border border-surface-4 flex-shrink-0"
              role="img"
              aria-label="Screenshot"
            >
              📸
            </span>
            <span className="text-txt-tertiary font-bold">+</span>
            <button type="button" onClick={copyPrompt} disabled={!aiPrompt} className={`rounded-md ${WHITE_BTN}`} style={WHITE_STYLE}>
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
        </Step>

        <Chevron />

        {/* Step 2 — open the chosen AI */}
        <Step num={2} title="Send to your AI" infoKey="ai" openInfo={openInfo} onToggle={() => toggleInfo('ai')}>
          <div ref={aiWrapRef} className="inline-flex rounded-md overflow-hidden border border-surface-5">
            <a href={ai.url} target="_blank" rel="noopener noreferrer" className={WHITE_BTN} style={WHITE_STYLE}>
              Open {ai.name}
            </a>
            <button
              type="button"
              onClick={() => setAiMenuOpen((v) => !v)}
              aria-label="Choose a different AI"
              aria-expanded={aiMenuOpen}
              className="px-2 flex items-center justify-center transition-colors hover:opacity-90"
              style={{ ...WHITE_STYLE, borderLeft: '1px solid var(--surface-1)' }}
            >
              <svg className={`w-4 h-4 transition-transform ${aiMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </Step>

        <Chevron />

        {/* Step 3 — paste it back */}
        <Step num={3} title="Paste it back" infoKey="paste" openInfo={openInfo} onToggle={() => toggleInfo('paste')}>
          <div className="inline-flex rounded-md overflow-hidden border border-surface-5">
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
                className="px-2 flex items-center justify-center transition-colors hover:opacity-90"
                style={{ ...WHITE_STYLE, borderLeft: '1px solid var(--surface-1)' }}
              >
                <svg className={`w-4 h-4 transition-transform ${showText ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            )}
          </div>
        </Step>
      </div>

      {/* Info panel for the open step */}
      {openInfo && (
        <p className="mt-3 rounded-lg border border-surface-4 bg-surface-1/60 px-3 py-2 text-xs text-txt-secondary leading-relaxed">
          <span className="font-semibold text-txt-primary">
            {openInfo === 'screenshot' ? 'Step 1. ' : openInfo === 'ai' ? 'Step 2. ' : 'Step 3. '}
          </span>
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
