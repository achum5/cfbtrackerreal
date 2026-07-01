import { useState, useMemo, useEffect, useRef } from 'react'
import Button from './Button'
import { useToast } from './Toast'
import { splitTsv } from '../../utils/tsvParse'
import { uploadImage } from '../../utils/imageUpload'

/**
 * LocalDataEntry — the universal "no Google Sheet needed" data-entry panel.
 *
 * This is the DEFAULT ingest path for every sheet/AI modal. The flow, top to
 * bottom, mirrors how the user actually works:
 *
 *   1. Copy AI Prompt              (white button, top)
 *   2. ▾ How to get your data      (collapsed help — screenshot instructions)
 *   3. Paste AI output here  [Paste ▾]   (white Paste button with an attached
 *                              arrow that reveals the raw text box)
 *   4. Editable GRID               (the pasted TSV as a real, gridded table —
 *                              the primary view; edit any cell before import)
 *   5. Import                      (serializes the grid and saves)
 *   …  Use Google Sheet instead    (escape hatch to the legacy Sheets flow)
 *
 * The AI prompts already emit tab-separated values, and `splitTsv` turns a
 * pasted reply into the SAME rows[][] the Google readers consume. The grid is
 * just an editable view of those rows; on import we re-serialize it to TSV so
 * each modal's `onImport(text)` reuses its existing parser. No sheet, no OAuth.
 *
 * Props:
 *   aiPrompt      — string copied by the Copy AI Prompt button.
 *   onImport(text)— async; parse + save the pasted text. Throws on failure.
 *   onUseGoogle   — switch to the Google Sheets flow.
 *   onCancel      — close without importing (optional).
 *   importLabel   — primary button text (default "Import").
 *   busy          — external disable (e.g. a parent save in flight).
 *   instructions  — override the default screenshot how-to copy.
 *   columns       — optional array of header labels. When given, the grid shows
 *                   a header row and a fixed column count; when omitted, the
 *                   column count is inferred from the pasted data.
 *   initialText   — optional TSV to pre-fill the grid with (e.g. the current
 *                   roster), so the modal opens on existing data for mass edits.
 *   imageColumn   — optional header label of a column that accepts a pasted
 *                   image: pasting an image into that cell auto-uploads it and
 *                   drops the resulting URL in the cell (a pasted URL still works).
 *   columnOptions — optional map of header label → allowed values. A value can
 *                   be a string[] (static dropdown) or (row, columns) => string[]
 *                   (dynamic, e.g. archetypes filtered by the row's position).
 *                   Cells in those columns render as a <select> dropdown.
 *   children      — optional extra content rendered above the action row
 *                   (e.g. a rankings-week selector).
 *
 * Grid keyboard nav is Excel-like: Tab moves right (native), Enter moves down.
 */

const DEFAULT_INSTRUCTIONS = `Take screenshots of the data you want to enter here. It doesn't have to be exact, just clear and fully showing. Upload those along with the copied prompt to your AI platform of choice. It will return a TSV output — copy that, then paste it below.`

// Grid (array of rows, each an array of cells) -> TSV text. Trailing empty
// cells are fine: splitTsv trims them and parsers read positionally.
const gridToText = (grid) => grid.map((r) => r.join('\t')).join('\n')

export default function LocalDataEntry({
  aiPrompt,
  onImport,
  onUseGoogle,
  onCancel,
  importLabel = 'Import',
  busy = false,
  instructions = DEFAULT_INSTRUCTIONS,
  columns = null,
  initialText = '',
  imageColumn = null,
  columnOptions = null,
  children = null,
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showText, setShowText] = useState(false)
  const [text, setText] = useState(() => initialText || '')
  const [grid, setGrid] = useState(() => splitTsv(initialText || '')) // rows[][]
  const [importing, setImporting] = useState(false)
  const [uploadingCells, setUploadingCells] = useState(() => new Set())
  // The last initialText we seeded from. Lets us re-seed when the source data
  // arrives/changes (async roster load, year switch) WITHOUT clobbering edits.
  const seededRef = useRef(initialText || '')

  const imageColIndex = (imageColumn && columns?.length) ? columns.indexOf(imageColumn) : -1
  const cellKey = (ri, ci) => `${ri}:${ci}`

  // Re-seed the grid from initialText when it changes, but only while the user
  // hasn't edited away from the last seed (so in-progress edits are never lost).
  useEffect(() => {
    const incoming = initialText || ''
    if (incoming !== seededRef.current && text === seededRef.current) {
      seededRef.current = incoming
      setText(incoming)
      setGrid(splitTsv(incoming))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText])

  // Column count: the schema's if provided, else the widest pasted row, else a
  // sensible 2-column default so the empty starter row still looks like a grid.
  const colCount = useMemo(() => {
    if (columns?.length) return columns.length
    const widest = grid.reduce((m, r) => Math.max(m, r.length), 0)
    return widest || 2
  }, [columns, grid])

  // grid and text are kept in lockstep: whichever the user edits, the other
  // follows, so Import (which uses text) always matches what's on screen.
  const applyText = (t) => {
    setText(t)
    setGrid(splitTsv(t))
  }
  const applyGrid = (g) => {
    setGrid(g)
    setText(gridToText(g))
  }

  const editCell = (ri, ci, value) => {
    const g = grid.map((r) => [...r])
    while (g.length <= ri) g.push([])
    const row = g[ri]
    while (row.length <= ci) row.push('')
    row[ci] = value
    applyGrid(g)
  }

  const addRow = () => applyGrid([...grid, Array(colCount).fill('')])
  const removeRow = (ri) => applyGrid(grid.filter((_, i) => i !== ri))

  // Paste into an image column: if the clipboard holds an image, upload it and
  // drop the URL in the cell. If it's plain text (a URL), fall through to the
  // normal paste so the browser inserts it as-is.
  const handleCellPaste = async (e, ri, ci) => {
    if (ci !== imageColIndex) return
    const dt = e.clipboardData
    const imgFile =
      Array.from(dt?.items || [])
        .filter((it) => it.kind === 'file' && it.type?.startsWith('image/'))
        .map((it) => it.getAsFile())
        .find(Boolean) ||
      Array.from(dt?.files || []).find((f) => f.type?.startsWith('image/'))
    if (!imgFile) return // no image on the clipboard — let the URL paste happen
    e.preventDefault()
    const key = cellKey(ri, ci)
    setUploadingCells((prev) => new Set(prev).add(key))
    try {
      const url = await uploadImage(imgFile)
      editCell(ri, ci, url)
      toast.success('Image uploaded.')
    } catch (err) {
      console.error('Cell image upload failed:', err)
      toast.error(err?.message || 'Image upload failed. Try again or paste a URL.')
    } finally {
      setUploadingCells((prev) => {
        const n = new Set(prev)
        n.delete(key)
        return n
      })
    }
  }

  // Excel-like navigation: Tab moves right (native tab order), Enter moves down
  // the column. At the last row, Enter adds a fresh row and lands in it.
  const cellEls = useRef({})
  const registerCell = (ri, ci, el) => {
    if (el) cellEls.current[cellKey(ri, ci)] = el
    else delete cellEls.current[cellKey(ri, ci)]
  }
  const focusCell = (ri, ci) => {
    const el = cellEls.current[cellKey(ri, ci)]
    if (!el) return false
    el.focus()
    if (typeof el.select === 'function') { try { el.select() } catch { /* selects have no select() */ } }
    return true
  }
  const handleCellKeyDown = (e, ri, ci) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!focusCell(ri + 1, ci)) {
      addRow()
      setTimeout(() => focusCell(ri + 1, ci), 0)
    }
  }

  // Allowed dropdown values for a column, or null for a free-text cell.
  const optionsFor = (ci, row) => {
    if (!columnOptions || !columns?.length) return null
    const spec = columnOptions[columns[ci]]
    if (!spec) return null
    const arr = typeof spec === 'function' ? spec(row, columns) : spec
    return Array.isArray(arr) ? arr : null
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt || '')
    } catch {
      // Clipboard API blocked (iframe / http / permissions) — fall back.
      const ta = document.createElement('textarea')
      ta.value = aiPrompt || ''
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setShowText(true)
      toast.error('Your browser blocks clipboard reads. Tap the arrow and paste into the text box.')
      return
    }
    try {
      const clip = await navigator.clipboard.readText()
      if (!clip || !clip.trim()) {
        toast.error('Clipboard is empty. Copy the AI reply first.')
        return
      }
      applyText(clip) // fills the grid; no need to reveal the raw textarea
    } catch {
      setShowText(true)
      toast.error('Could not read the clipboard. Tap the arrow and paste into the text box.')
    }
  }

  const handleImport = async () => {
    if (!text.trim()) {
      setShowText(true)
      toast.error('Paste the AI output first.')
      return
    }
    setImporting(true)
    try {
      await onImport(text)
      // The parent closes/advances on success; toast there if it wants to.
    } catch (error) {
      console.error('Local import failed:', error)
      toast.error(error?.message || 'Could not import. Check the pasted output and try again.')
    } finally {
      setImporting(false)
    }
  }

  const disabled = busy || importing
  // Always render a grid (never a bare textarea). Empty → one starter row.
  const displayRows = grid.length > 0 ? grid : [Array(colCount).fill('')]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-0.5">
        {/* 1. Copy AI Prompt */}
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={copyPrompt}
            disabled={!aiPrompt}
            className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
          >
            {copied ? 'Copied!' : 'Copy AI Prompt'}
          </button>
        </div>

        {/* 2. Collapsible how-to */}
        <div className="flex-shrink-0 rounded-lg border border-surface-4 bg-surface-2/50">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-txt-secondary hover:text-txt-primary"
          >
            <svg
              className={`w-4 h-4 flex-shrink-0 transition-transform ${showHelp ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            How to get your data
          </button>
          {showHelp && (
            <p className="px-3 pb-3 pt-0 text-xs text-txt-tertiary leading-relaxed">
              {instructions}
            </p>
          )}
        </div>

        {/* 3. Paste AI output + reveal-textarea arrow (both white) */}
        <div className="flex-shrink-0">
          <p className="label-xs text-txt-tertiary mb-1.5" style={{ letterSpacing: '1px' }}>Paste AI output here</p>
          <div className="inline-flex rounded-md overflow-hidden border border-surface-5">
            <button
              type="button"
              onClick={pasteFromClipboard}
              disabled={disabled}
              className="px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
            >
              Paste
            </button>
            <button
              type="button"
              onClick={() => setShowText((v) => !v)}
              title={showText ? 'Hide text box' : 'Show text box'}
              aria-label={showText ? 'Hide text box' : 'Show text box'}
              aria-pressed={showText}
              className="px-2 flex items-center justify-center transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)', borderLeft: '1px solid var(--surface-1)' }}
            >
              <svg className={`w-4 h-4 transition-transform ${showText ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {showText && (
            <textarea
              value={text}
              onChange={(e) => applyText(e.target.value)}
              placeholder="Paste the AI's TSV reply here."
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              rows={6}
              className="mt-2 w-full rounded-md border border-surface-5 bg-surface-2 p-2 text-sm font-mono text-txt-primary resize-y focus:outline-none focus:ring-2 focus:ring-surface-5"
            />
          )}
        </div>

        {/* 4. Editable grid — the primary view. Full gridlines (surface-5), no
            inter-cell gaps. Paste fills it; edits flow back to the text. */}
        <div className="flex-shrink-0 rounded-md border border-surface-5 overflow-x-auto">
          <table className="w-full text-xs tabular border-collapse">
            {columns?.length ? (
              <thead className="bg-surface-2">
                <tr className="text-txt-tertiary">
                  {columns.map((c, i) => (
                    <th key={i} className="px-2 py-1 text-left font-semibold whitespace-nowrap border border-surface-5">{c}</th>
                  ))}
                  <th className="w-6 border border-surface-5" aria-label="Remove" />
                </tr>
              </thead>
            ) : null}
            <tbody>
              {displayRows.map((row, ri) => (
                <tr key={ri}>
                  {Array.from({ length: colCount }).map((_, ci) => {
                    const isImageCol = ci === imageColIndex
                    const uploading = isImageCol && uploadingCells.has(cellKey(ri, ci))
                    const opts = optionsFor(ci, row)
                    const val = row[ci] ?? ''
                    const label = columns?.[ci] ? `${columns[ci]} row ${ri + 1}` : `Row ${ri + 1} column ${ci + 1}`
                    return (
                      <td key={ci} className="border border-surface-5">
                        {uploading ? (
                          <div className="px-2 py-0.5 text-txt-tertiary italic">Uploading…</div>
                        ) : opts ? (
                          <select
                            ref={(el) => registerCell(ri, ci, el)}
                            value={val}
                            onChange={(e) => editCell(ri, ci, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, ri, ci)}
                            aria-label={label}
                            className="w-full bg-transparent text-txt-primary px-2 py-0.5 focus:outline-none focus:bg-surface-3"
                          >
                            <option value=""></option>
                            {/* Keep an off-list current value visible instead of silently blanking it. */}
                            {val && !opts.includes(val) && <option value={val}>{val}</option>}
                            {opts.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            ref={(el) => registerCell(ri, ci, el)}
                            type="text"
                            value={val}
                            placeholder={isImageCol ? 'paste image or URL' : undefined}
                            onChange={(e) => editCell(ri, ci, e.target.value)}
                            onPaste={isImageCol ? (e) => handleCellPaste(e, ri, ci) : undefined}
                            onKeyDown={(e) => handleCellKeyDown(e, ri, ci)}
                            aria-label={label}
                            className="w-full bg-transparent text-txt-primary px-2 py-0.5 focus:outline-none focus:bg-surface-3"
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="w-6 text-center border border-surface-5">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      aria-label="Remove row"
                      className="text-txt-tertiary hover:text-txt-primary"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={colCount + 1} className="px-2 py-1 border border-surface-5">
                  <button
                    type="button"
                    onClick={addRow}
                    className="text-xs font-semibold text-txt-secondary hover:text-txt-primary"
                  >
                    + Add row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {children}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-3">
        <Button variant="ghost" size="sm" onClick={onUseGoogle} disabled={disabled}>Use Google Sheet instead</Button>
        <div className="flex gap-2">
          {onCancel && <Button variant="secondary" size="sm" onClick={onCancel} disabled={disabled}>Cancel</Button>}
          <Button variant="primary" size="sm" onClick={handleImport} disabled={disabled || !text.trim()}>
            {importing ? 'Importing…' : importLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
