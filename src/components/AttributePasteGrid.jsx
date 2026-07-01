import { useState, useEffect, useRef } from 'react'
import Button from './ui/Button'
import { useToast } from './ui/Toast'
import { splitTsv } from '../utils/tsvParse'
import { parseAttributeRows, serializeAttributeRows } from '../utils/attributeEntry'

// Local, Google-free FULL-ATTRIBUTE entry for Training Results / Recruit
// Overalls. One row per player: Player, Position, OVR, and the whole rating set
// as a single comma-separated "CODE value" cell (kept compact instead of ~50
// columns). The grid is the source of truth; the raw TSV textarea (behind the
// arrow) stays in sync both ways. Paste fills it, existing ratings pre-fill it,
// Import hands [{ playerName, position, overall, attributes }] to the parent.

export default function AttributePasteGrid({
  players,        // roster/recruit list to pre-fill from
  year,           // season key for overallByYear / attributesByYear
  aiPrompt,
  onImport,
  onClose,
  onUseGoogle,
  hint = 'Paste the AI reply here. One line per player: name, position, OVR, then the ratings cell.',
}) {
  const { toast } = useToast()
  const [grid, setGrid] = useState([])
  const [rawText, setRawText] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)
  const [importing, setImporting] = useState(false)
  const prefilledRef = useRef(false)

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

  // Pre-fill from ratings already stored on each player for this season, so
  // reopening shows them (editable) and the AI only needs to fill blanks.
  useEffect(() => {
    if (prefilledRef.current) return
    prefilledRef.current = true
    const y = Number(year)
    const entries = (players || []).map((p) => {
      const ovr = p?.overallByYear?.[y] ?? p?.overallByYear?.[String(y)] ?? p?.overall ?? null
      const attrs = p?.attributesByYear?.[y] || p?.attributesByYear?.[String(y)] || {}
      return { playerName: p?.name || '', position: p?.position || '', overall: ovr, attributes: { ...attrs } }
    }).filter((e) => e.playerName)
    setGrid(entries)
    setRawText(serializeAttributeRows(entries))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncFromGrid = (g) => {
    setGrid(g)
    setRawText(serializeAttributeRows(g))
  }

  const applyRawText = (text) => {
    setRawText(text)
    setGrid(parseAttributeRows(splitTsv(text)))
  }

  const editCell = (rowIdx, field, value) => {
    const g = grid.map((row, i) => (i === rowIdx ? { ...row, [field]: value } : row))
    setGrid(g)
    setRawText(serializeAttributeRows(g))
  }

  // Edit the raw attributes cell for one row -> reparse just that cell.
  const editAttrsCell = (rowIdx, cellText) => {
    const parsed = parseAttributeRows(splitTsv(`x\t\t\t${cellText}`))
    const attributes = parsed[0]?.attributes || {}
    const g = grid.map((row, i) => (i === rowIdx ? { ...row, attributes, _attrsText: cellText } : row))
    setGrid(g)
    setRawText(serializeAttributeRows(g))
  }

  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setShowRaw(true)
      toast.error('Your browser blocks clipboard reads. Tap the arrow and paste into the text box.')
      return
    }
    try {
      const text = await navigator.clipboard.readText()
      if (!text || !text.trim()) {
        toast.error('Clipboard is empty. Copy the AI reply first.')
        return
      }
      applyRawText(text)
    } catch {
      setShowRaw(true)
      toast.error('Could not read the clipboard. Tap the arrow and paste into the text box.')
    }
  }

  const attrCount = (attrs) => (attrs ? Object.keys(attrs).length : 0)
  const attrsCellText = (row) => row._attrsText ?? serializeAttributeRows([row]).split('\t').slice(3).join('\t')

  // Keep rows that carry real data (OVR or at least one attribute).
  const buildEntries = () =>
    grid
      .map((r) => ({
        playerName: (r.playerName ?? '').toString().trim(),
        position: (r.position ?? '').toString().trim(),
        overall: r.overall === '' || r.overall == null ? null : Number(r.overall),
        attributes: r.attributes || {},
      }))
      .filter((e) => e.playerName && (e.overall != null || attrCount(e.attributes) > 0))

  const handleImport = async () => {
    const entries = buildEntries()
    if (entries.length === 0) {
      toast.error('Paste or enter at least one player first.')
      return
    }
    setImporting(true)
    try {
      await onImport(entries)
      toast.success('Attributes imported.')
      onClose()
    } catch (error) {
      console.error('Attribute paste import failed:', error)
      toast.error('Could not import the ratings. Check the values and try again.')
    } finally {
      setImporting(false)
    }
  }

  const hasAny = grid.some((r) => (r.playerName ?? '') !== '' && (r.overall != null || attrCount(r.attributes) > 0))

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-3">
      {/* 1. Copy AI Prompt */}
      {aiPrompt && (
        <button
          type="button"
          onClick={copyPrompt}
          className="flex-shrink-0 w-full px-4 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-[0.99]"
          style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
        >
          {copied ? 'Copied!' : 'Copy AI Prompt'}
        </button>
      )}

      {/* 2. Collapsible how-to */}
      <div className="flex-shrink-0 rounded-lg border border-surface-4 bg-surface-2/50">
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-txt-secondary hover:text-txt-primary"
        >
          <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${showHelp ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
          How to get your data
        </button>
        {showHelp && (
          <p className="px-3 pb-3 pt-0 text-xs text-txt-tertiary leading-relaxed">
            Take screenshots of the data you want to enter. It doesn't have to be exact, just clear and fully showing. Upload those along with the copied prompt to your AI platform of choice. It will return a TSV output — copy it, then paste below (the grid fills in automatically; edit any cell before importing).
          </p>
        )}
      </div>

      {/* 3. Paste AI output + reveal-textarea arrow (both white) */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <div className="inline-flex rounded-md overflow-hidden border border-surface-5">
          <Button variant="primary" size="sm" onClick={pasteFromClipboard} className="rounded-none">Paste</Button>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            title={showRaw ? 'Hide text box' : 'Show text box'}
            aria-label={showRaw ? 'Hide text box' : 'Show text box'}
            aria-pressed={showRaw}
            className="px-2 flex items-center justify-center transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)', borderLeft: '1px solid var(--surface-1)' }}
          >
            <svg className={`w-4 h-4 transition-transform ${showRaw ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {showRaw && (
        <textarea
          value={rawText}
          onChange={(e) => applyRawText(e.target.value)}
          placeholder={hint}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          rows={6}
          className="flex-shrink-0 w-full rounded-md border border-surface-5 bg-surface-2 p-2 text-sm font-mono text-txt-primary resize-y focus:outline-none focus:ring-2 focus:ring-surface-5"
        />
      )}

      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-surface-5">
        <table className="w-full text-xs tabular border-collapse">
          <thead className="sticky top-0 bg-surface-2 z-10">
            <tr className="text-txt-tertiary">
              <th className="px-2 py-1 text-left font-semibold whitespace-nowrap border border-surface-5">Player</th>
              <th className="px-2 py-1 text-left font-semibold whitespace-nowrap border border-surface-5">Pos</th>
              <th className="px-2 py-1 text-right font-semibold whitespace-nowrap border border-surface-5">OVR</th>
              <th className="px-2 py-1 text-left font-semibold whitespace-nowrap border border-surface-5">Attributes</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, i) => (
              <tr key={i}>
                <td className="min-w-[8rem] border border-surface-5">
                  <input
                    type="text"
                    value={row.playerName ?? ''}
                    onChange={(e) => editCell(i, 'playerName', e.target.value)}
                    aria-label={`Player ${i + 1}`}
                    className="w-full bg-transparent text-txt-primary px-2 py-0.5 focus:outline-none focus:bg-surface-3"
                  />
                </td>
                <td className="w-14 border border-surface-5">
                  <input
                    type="text"
                    value={row.position ?? ''}
                    onChange={(e) => editCell(i, 'position', e.target.value)}
                    aria-label={`Position ${i + 1}`}
                    className="w-full bg-transparent text-txt-primary px-2 py-0.5 focus:outline-none focus:bg-surface-3"
                  />
                </td>
                <td className="w-14 border border-surface-5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.overall ?? ''}
                    onChange={(e) => editCell(i, 'overall', e.target.value)}
                    aria-label={`Overall ${i + 1}`}
                    className="w-full bg-transparent text-right tabular text-txt-primary px-2 py-0.5 focus:outline-none focus:bg-surface-3"
                  />
                </td>
                <td className="min-w-[16rem] border border-surface-5">
                  <input
                    type="text"
                    value={attrsCellText(row)}
                    onChange={(e) => editAttrsCell(i, e.target.value)}
                    aria-label={`Attributes ${i + 1}`}
                    placeholder="AWR 88, SPD 90, …"
                    className="w-full bg-transparent text-txt-primary px-2 py-0.5 font-mono focus:outline-none focus:bg-surface-3"
                  />
                </td>
              </tr>
            ))}
            {grid.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-txt-tertiary border border-surface-5">
                  Paste the AI reply to fill ratings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {onUseGoogle
          ? <Button variant="ghost" size="sm" onClick={onUseGoogle}>Use Google Sheet instead</Button>
          : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleImport} disabled={importing || !hasAny}>
            {importing ? 'Importing…' : 'Import Ratings'}
          </Button>
        </div>
      </div>
    </div>
  )
}
