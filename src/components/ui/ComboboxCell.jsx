import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'

// A single grid cell that behaves like a Google-Sheets data-validation dropdown:
// free-type text, a filtered list of matching options appears below, arrows move
// the highlight, and Enter/Tab accept the highlighted match (or the sole match if
// only one is left). The list is portaled to <body> and positioned at the input
// so it isn't clipped by the grid's overflow. A typed value that isn't in the
// list is still kept (no silent data loss) — the list is an aid, not a hard gate.
export default function ComboboxCell({
  value,
  options,
  onChange,
  onEnterDown,   // called after Enter commits — moves focus to the cell below
  inputRef,      // ref callback so the grid can focus this cell for keyboard nav
  ariaLabel,
  placeholder,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(null) // null => showing `value`; string => actively typing
  const [highlight, setHighlight] = useState(0)
  const [rect, setRect] = useState(null)
  const localRef = useRef(null)

  const setRefs = useCallback((el) => {
    localRef.current = el
    if (typeof inputRef === 'function') inputRef(el)
  }, [inputRef])

  const text = query == null ? (value ?? '') : query

  // Filter: exact-prefix matches first (what "type CLE -> CLEM" expects), then
  // any substring. Empty query shows everything.
  const matches = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase()
    if (!q) return options
    const starts = [], contains = []
    for (const o of options) {
      const lo = o.toLowerCase()
      if (lo.startsWith(q)) starts.push(o)
      else if (lo.includes(q)) contains.push(o)
    }
    return [...starts, ...contains]
  }, [options, query])

  const reposition = useCallback(() => {
    const el = localRef.current
    if (el) setRect(el.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!open) return
    reposition()
    const onScroll = () => reposition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, reposition])

  const commit = (v) => {
    onChange(v)
    setQuery(null)
    setOpen(false)
  }

  // The option Enter/Tab would accept: the highlighted one, or the sole match.
  const activeMatch = () => {
    if (matches.length === 1) return matches[0]
    if (open && matches[highlight]) return matches[highlight]
    return null
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const m = activeMatch()
      commit(m != null ? m : text)
      onEnterDown?.()
    } else if (e.key === 'Tab') {
      // Accept the sole/highlighted match, then let Tab move right (no preventDefault).
      const m = activeMatch()
      if (m != null && m !== text) onChange(m)
      setQuery(null)
      setOpen(false)
    } else if (e.key === 'Escape') {
      setQuery(null)
      setOpen(false)
    }
  }

  return (
    <>
      <input
        ref={setRefs}
        type="text"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0) }}
        onFocus={() => { setOpen(true); reposition() }}
        onBlur={() => {
          // Give a click on an option time to register before closing.
          setTimeout(() => { setOpen(false); setQuery(null) }, 120)
        }}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent text-txt-primary px-2 py-0.5 focus:outline-none focus:bg-surface-3"
      />
      {open && rect && matches.length > 0 && createPortal(
        <ul
          className="fixed z-[10001] max-h-56 overflow-y-auto rounded-md border border-surface-5 bg-surface-2 shadow-xl text-xs py-1"
          style={{ top: rect.bottom + 2, left: rect.left, minWidth: Math.max(rect.width, 120) }}
          role="listbox"
        >
          {matches.slice(0, 60).map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={i === highlight}
              // onMouseDown (not onClick) so it fires before the input's blur.
              onMouseDown={(e) => { e.preventDefault(); commit(o) }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-1 cursor-pointer whitespace-nowrap ${i === highlight ? 'bg-surface-4 text-txt-primary' : 'text-txt-secondary'}`}
            >
              {o}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}
