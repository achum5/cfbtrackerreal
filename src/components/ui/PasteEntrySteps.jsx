import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AI_TOOLS } from '../../data/aiTools'

// The unified header for every data-entry modal. A genuine 3-step sequence
// (screenshot & copy -> send to your AI -> paste it back), kept deliberately
// quiet: the white action buttons are the one bold element; the numbers,
// captions, and hairline chevrons stay muted. A small info dot on each step
// toggles a one-line explanation beneath the row.
//
// The row sits in full-width modals and in narrow two-column cards, so it is
// sized to its own box, not the window. Each layout below is tried in turn,
// widest first, and the first one that fits is kept (fitLayout sets it as
// data-layout on the root; the classes key off it):
//   wide     one row, chevrons between steps, full-size buttons
//   compact  one row, no chevrons, smaller buttons
//   tight    one row, captions wrapped to their button's width, "Copy" label
//   stack    one step per line: caption left, button right
// Before this, the row was sized by window breakpoints and scrolled sideways
// when it didn't fit, which clipped buttons in the narrow game editor cards.
const LAYOUTS = ['wide', 'compact', 'tight', 'stack']

const STEP_HINTS = {
  screenshot: 'Take screenshots of the data you want to enter — or record a short video scrolling through it (either way it doesn\'t have to be perfect, just clear and fully showing). Then tap Copy Prompt to copy the instructions.',
  ai: 'Open your AI, paste the copied prompt, and upload your screenshots or video. It replies with a block of data.',
  paste: 'Copy the AI\'s reply, then tap Paste. The grid fills in automatically. Tap the arrow to open a text box if the normal paste doesn\'t work.',
}

const WHITE_BTN = 'h-8 px-2 inline-flex items-center justify-center gap-1 text-xs font-semibold transition-colors disabled:opacity-60 hover:opacity-90 whitespace-nowrap group-data-[layout=wide]/steps:h-9 group-data-[layout=wide]/steps:px-3 group-data-[layout=wide]/steps:gap-1.5 group-data-[layout=wide]/steps:text-sm group-data-[layout=stack]/steps:flex-1'
// The arrow half of a split button.
const ARROW_BTN = 'px-1.5 flex items-center justify-center transition-colors hover:opacity-90 group-data-[layout=wide]/steps:px-2'
// One step: caption over control in a row, side by side when stacked.
const STEP = 'flex flex-col gap-2 group-data-[layout=stack]/steps:flex-row group-data-[layout=stack]/steps:items-center group-data-[layout=stack]/steps:justify-between group-data-[layout=stack]/steps:gap-3'
// A step's control: left-aligned under its caption in a row; stacked, a
// shared minimum width at the right of its line so the three line up.
const CONTROL = 'inline-flex self-start rounded-md overflow-hidden border border-surface-5 group-data-[layout=stack]/steps:self-center group-data-[layout=stack]/steps:flex-shrink-0 group-data-[layout=stack]/steps:min-w-[9.5rem]'
const WHITE_STYLE = { backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }

const InfoIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)

// "Copy Prompt" / "Copy AI Prompt" read "Copy" in the tight layout so all
// three steps fit on one row; labels that don't start with "Copy" pass through.
function CopyLabel({ text }) {
  if (typeof text !== 'string' || !/^Copy\s/.test(text)) return text
  return (
    <>
      <span className="hidden group-data-[layout=tight]/steps:inline">Copy</span>
      <span className="group-data-[layout=tight]/steps:hidden">{text}</span>
    </>
  )
}

// The copy label and "Copied!" share one grid cell, so the button keeps its
// width when the label swaps and the row never re-flows on a click.
function CopyButtonLabel({ text, copied }) {
  return (
    <span className="grid">
      <span className={`[grid-area:1/1] ${copied ? 'invisible' : ''}`}><CopyLabel text={text} /></span>
      <span className={`[grid-area:1/1] ${copied ? '' : 'invisible'}`}>Copied!</span>
    </span>
  )
}

function Caption({ num, title, active, onToggle }) {
  // One inline text run (number, title, info dot) so a wrapped caption reads
  // naturally. In the tight layout it takes its step's width — set by the
  // button below it, via w-0 + min-w-full — and wraps, instead of widening the
  // step. Stacked, it fills the line beside its button and wraps there.
  const words = String(title).split(' ')
  const last = words.pop()
  const lead = words.length ? `${words.join(' ')} ` : ''
  return (
    <div className="w-0 min-w-full text-[10px] leading-tight group-data-[layout=wide]/steps:w-auto group-data-[layout=wide]/steps:min-w-0 group-data-[layout=wide]/steps:h-4 group-data-[layout=wide]/steps:whitespace-nowrap group-data-[layout=wide]/steps:text-[11px] group-data-[layout=compact]/steps:w-auto group-data-[layout=compact]/steps:min-w-0 group-data-[layout=compact]/steps:h-4 group-data-[layout=compact]/steps:whitespace-nowrap group-data-[layout=compact]/steps:text-[11px] group-data-[layout=stack]/steps:w-auto group-data-[layout=stack]/steps:min-w-0 group-data-[layout=stack]/steps:flex-1 group-data-[layout=stack]/steps:text-[11px]">
      <span className="font-bold tabular text-txt-secondary mr-1">{num}</span>
      <span className="font-medium text-txt-tertiary">{lead}</span>
      {/* The last word and the info dot never part, so a wrapped caption
          doesn't leave the dot alone on the second line. */}
      <span className="whitespace-nowrap">
        <span className="font-medium text-txt-tertiary">{last}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`What do I do in step ${num}?`}
          aria-pressed={active}
          className={`inline-flex align-[-2px] ml-1 transition-colors ${active ? 'text-txt-primary' : 'text-txt-tertiary/50 hover:text-txt-secondary'}`}
        >
          <InfoIcon className="w-3 h-3 group-data-[layout=wide]/steps:w-3.5 group-data-[layout=wide]/steps:h-3.5" />
        </button>
      </span>
    </div>
  )
}

// Where a portaled dropdown should sit, given its anchor.
//
// Both menus are `position: fixed` and were left-aligned to their anchor, which
// is fine on a wide screen and wrong on a phone: these controls sit at the
// right-hand end of the step row, so a menu wider than the gap ran off the
// screen with its labels unreachable. Anchored left where there is room,
// pushed back inside the viewport where there is not, and never wider than the
// screen.
const GUTTER = 8
const menuStyle = (rect, minWidth, measuredWidth) => {
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth
  const width = Math.max(measuredWidth || 0, minWidth || 0, rect.width)
  const maxLeft = Math.max(GUTTER, vw - width - GUTTER)
  return {
    top: rect.bottom + 2,
    left: Math.min(Math.max(GUTTER, rect.left), maxLeft),
    minWidth,
    maxWidth: `calc(100vw - ${GUTTER * 2}px)`,
  }
}

// A hairline chevron between steps, aligned to the control row (not the
// caption). Wide layout only.
const Chevron = () => (
  <svg className="hidden group-data-[layout=wide]/steps:block self-end mb-2.5 w-4 h-4 text-txt-tertiary/40 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export default function PasteEntrySteps({
  aiPrompt,
  onPaste,
  // Optional "append" paste. When provided, the Paste button's arrow opens a
  // menu with an "Add below current data" choice that appends the clipboard's
  // rows beneath what's already in the grid instead of replacing everything.
  onPasteAppend = null,
  showText = false,
  onToggleText,
  disabled = false,
  hints = {},
  // Caption/label overrides so non-screenshot flows (e.g. AI recaps, which have
  // no screenshot step) can read correctly. Defaults keep the screenshot wording.
  labels = {},
  copyEmoji = '📸',
  // The AI list for step 2. Defaults to the text-prompt tools; pass
  // IMAGE_AI_TOOLS (+ a distinct preferenceKey) for the image-gen flow.
  tools = AI_TOOLS,
  preferenceKey = 'preferredAiTool',
  // Optional element joined to the LEFT of the Copy button (e.g. a settings
  // gear), rendered inside the same bordered group.
  copyLeading = null,
}) {
  const label = { copy: 'Screenshot & copy', ai: 'Send to your AI', paste: 'Paste it back', copyButton: 'Copy Prompt', ...labels }
  // Per-device preferred AI, scoped to `preferenceKey` and validated against
  // `tools` so the text and image pickers remember independent choices.
  const readPref = () => {
    try { const k = localStorage.getItem(preferenceKey); if (k && tools.some((t) => t.key === k)) return k } catch { /* blocked */ }
    return tools[0].key
  }
  const writePref = (k) => { try { localStorage.setItem(preferenceKey, k) } catch { /* noop */ } }
  const resolveTool = (k) => tools.find((t) => t.key === k) || tools[0]
  const [copied, setCopied] = useState(false)
  const [openInfo, setOpenInfo] = useState(null) // 'screenshot' | 'ai' | 'paste' | null
  const [aiKey, setAiKey] = useState(readPref)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [menuRect, setMenuRect] = useState(null)
  const aiWrapRef = useRef(null)
  const [pasteMenuOpen, setPasteMenuOpen] = useState(false)
  const [pasteMenuRect, setPasteMenuRect] = useState(null)
  const pasteWrapRef = useRef(null)
  // Measured widths, so the clamp above uses what the menu actually renders at
  // instead of its declared minimum.
  const [aiMenuWidth, setAiMenuWidth] = useState(0)
  const [pasteMenuWidth, setPasteMenuWidth] = useState(0)
  const measure = (set) => (el) => { if (el) set(el.offsetWidth) }

  // Pick the widest layout that fits the root's width (see LAYOUTS). The row
  // is max-content wide in every one-row layout, so its width is exactly what
  // that layout needs.
  const rootRef = useRef(null)
  const rowRef = useRef(null)
  const fitLayout = useCallback(() => {
    const root = rootRef.current
    const row = rowRef.current
    if (!root || !row) return
    const avail = root.getBoundingClientRect().width
    if (!avail) return // hidden; the resize observer refits once it shows
    for (const layout of LAYOUTS) {
      root.dataset.layout = layout
      if (layout === 'stack' || row.getBoundingClientRect().width <= avail + 0.5) return
    }
  }, [])

  // The Paste arrow becomes a MENU only when an append action is offered
  // (roster-style grids). Without it, the arrow keeps its original single job of
  // toggling the raw text box — so every other modal is unchanged.
  const hasPasteMenu = onPasteAppend != null
  const pasteMenuItems = [
    { key: 'replace', label: 'Replace current data', onSelect: onPaste },
    ...(onPasteAppend ? [{ key: 'append', label: 'Add below current data', onSelect: onPasteAppend }] : []),
    ...(onToggleText ? [{ key: 'text', label: showText ? 'Hide text box' : 'Show text box', onSelect: onToggleText }] : []),
  ]

  const ai = resolveTool(aiKey)

  // Refit when the content changes...
  useLayoutEffect(() => { fitLayout() }, [fitLayout, ai.name, label.copy, label.ai, label.paste, label.copyButton, copyEmoji, copyLeading != null, hasPasteMenu, onToggleText != null])
  // ...and when the box resizes or the web font arrives. The refit waits a
  // frame: changing the layout inside the observer callback would resize the
  // observed box again and trip the observer's loop error.
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    let frame = 0
    let lastWidth = -1
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      if (width === lastWidth) return
      lastWidth = width
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fitLayout)
    })
    ro.observe(root)
    document.fonts?.ready?.then(fitLayout)
    return () => { ro.disconnect(); cancelAnimationFrame(frame) }
  }, [fitLayout])
  const hint = { ...STEP_HINTS, ...hints }
  // When the Paste arrow is a menu (append available), explain both choices —
  // unless the caller supplied its own paste hint.
  if (hasPasteMenu && hints.paste == null) {
    hint.paste = 'Copy the reply, then tap Paste to fill the grid. Use the arrow for more options: add the copied row(s) below what\'s already there (instead of replacing it), or open a text box if the normal paste doesn\'t work.'
  }
  const toggleInfo = (k) => setOpenInfo((cur) => (cur === k ? null : k))

  const copyPrompt = async () => {
    // aiPrompt may be a function so callers can defer an expensive build
    // until the user actually copies (e.g. the week-recap prompt, which
    // scans every team + game and is wasteful to rebuild on every render).
    const text = (typeof aiPrompt === 'function' ? aiPrompt() : aiPrompt) || ''
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
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
    writePref(key)
    setAiMenuOpen(false)
  }

  const repositionPasteMenu = useCallback(() => {
    const el = pasteWrapRef.current
    if (el) setPasteMenuRect(el.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!pasteMenuOpen) return
    repositionPasteMenu()
    const onDoc = (e) => { if (pasteWrapRef.current && !pasteWrapRef.current.contains(e.target)) setPasteMenuOpen(false) }
    const onScroll = () => repositionPasteMenu()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', repositionPasteMenu)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', repositionPasteMenu)
    }
  }, [pasteMenuOpen, repositionPasteMenu])

  return (
    <div ref={rootRef} className="group/steps flex-shrink-0">
      <div ref={rowRef} className="flex flex-row items-end w-max mx-auto gap-2 group-data-[layout=wide]/steps:gap-3 group-data-[layout=compact]/steps:gap-3 group-data-[layout=stack]/steps:flex-col group-data-[layout=stack]/steps:items-stretch group-data-[layout=stack]/steps:w-full">
        {/* Step 1 — screenshot & copy */}
        <div className={STEP}>
          <Caption num="1" title={label.copy} active={openInfo === 'screenshot'} onToggle={() => toggleInfo('screenshot')} />
          <div className={CONTROL}>
            {copyLeading}
            <button type="button" onClick={copyPrompt} disabled={!aiPrompt} className={WHITE_BTN} style={WHITE_STYLE}>
              {copyEmoji && <span className="text-base leading-none" role="img" aria-label="Screenshot">{copyEmoji}</span>}
              <CopyButtonLabel text={label.copyButton} copied={copied} />
            </button>
          </div>
        </div>

        <Chevron />

        {/* Step 2 — send to your AI */}
        <div className={STEP}>
          <Caption num="2" title={label.ai} active={openInfo === 'ai'} onToggle={() => toggleInfo('ai')} />
          <div ref={aiWrapRef} className={CONTROL}>
            <a href={ai.url} target="_blank" rel="noopener noreferrer" className={WHITE_BTN} style={WHITE_STYLE}>
              Open {ai.name}
            </a>
            <button
              type="button"
              onClick={() => setAiMenuOpen((v) => !v)}
              aria-label="Choose a different AI"
              aria-expanded={aiMenuOpen}
              className={ARROW_BTN}
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
        <div className={STEP}>
          <Caption num="3" title={label.paste} active={openInfo === 'paste'} onToggle={() => toggleInfo('paste')} />
          <div ref={pasteWrapRef} className={CONTROL}>
            <button type="button" onClick={onPaste} disabled={disabled} className={WHITE_BTN} style={WHITE_STYLE}>
              Paste
            </button>
            {hasPasteMenu ? (
              <button
                type="button"
                onClick={() => setPasteMenuOpen((v) => !v)}
                title="More paste options"
                aria-label="More paste options"
                aria-expanded={pasteMenuOpen}
                disabled={disabled}
                className={ARROW_BTN}
                style={{ ...WHITE_STYLE, borderLeft: '1px solid var(--surface-1)' }}
              >
                <svg className={`w-4 h-4 transition-transform ${pasteMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            ) : onToggleText && (
              <button
                type="button"
                onClick={onToggleText}
                title={showText ? 'Hide text box' : 'Show text box'}
                aria-label={showText ? 'Hide text box' : 'Show text box'}
                aria-pressed={showText}
                className={ARROW_BTN}
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
        <p className="mt-3 text-xs text-txt-tertiary leading-relaxed max-w-2xl mx-auto text-center group-data-[layout=stack]/steps:text-left">
          {hint[openInfo]}
        </p>
      )}

      {/* AI picker menu — portaled so the modal's overflow can't clip it */}
      {aiMenuOpen && menuRect && createPortal(
        <ul
          ref={measure(setAiMenuWidth)}
          className="fixed z-[10001] max-h-72 overflow-y-auto rounded-md border border-surface-5 bg-surface-2 shadow-xl text-sm py-1"
          style={menuStyle(menuRect, menuRect.width, aiMenuWidth)}
          role="listbox"
        >
          {tools.map((t) => (
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

      {/* Paste-mode menu — portaled so the modal's overflow can't clip it */}
      {pasteMenuOpen && pasteMenuRect && createPortal(
        <ul
          ref={measure(setPasteMenuWidth)}
          className="fixed z-[10001] max-h-72 overflow-y-auto rounded-md border border-surface-5 bg-surface-2 shadow-xl text-sm py-1"
          style={menuStyle(pasteMenuRect, Math.max(pasteMenuRect.width, 180), pasteMenuWidth)}
          role="menu"
        >
          {pasteMenuItems.map((item) => (
            <li
              key={item.key}
              role="menuitem"
              onMouseDown={(e) => { e.preventDefault(); setPasteMenuOpen(false); item.onSelect?.() }}
              className="px-3 py-1.5 cursor-pointer whitespace-nowrap text-txt-secondary hover:text-txt-primary hover:bg-surface-3"
            >
              {item.label}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
