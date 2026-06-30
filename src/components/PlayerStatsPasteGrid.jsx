import { useState, useEffect, useMemo, useRef } from 'react'
import Button from './ui/Button'
import { useToast } from './ui/Toast'
import { splitTsv } from '../utils/tsvParse'
import {
  parseUnifiedBoxScoreRows,
  serializeUnifiedBoxScoreToTsv,
  getUnifiedBoxScoreSections,
} from '../services/sheetsService'
import { getPlayerStatsForTid } from '../utils/boxScoreHelpers'

// Local, Google-free player-stats entry. Same shape as the Team Stats grid but
// MULTI-SECTION with DYNAMIC rows: one editable table per stat category
// (Passing, Rushing, …), each with the category's own headers and as many
// player rows as the user needs. The grid is the source of truth; the raw TSV
// textarea (behind the arrow) stays in sync both ways. Paste fills it, existing
// stats pre-fill it, Import hands the same boxScore shape the sheet reader
// produces to the parent's onSave.

const coerce = (v) => {
  const s = (v ?? '').toString().trim()
  if (s === '') return null
  return isNaN(Number(s)) ? s : Number(s)
}

export default function PlayerStatsPasteGrid({
  game,
  targetTid,
  teamAbbr,
  teamLogo,
  dynastyTeams,
  aiPrompt,
  onImport,
  onClose,
  onUseGoogle,
}) {
  const { toast } = useToast()
  const sections = useMemo(() => getUnifiedBoxScoreSections(), [])

  // grid: { [sectionKey]: [ { playerName, [fieldKey]: value } ] }
  const emptyGrid = () => sections.reduce((acc, s) => { acc[s.key] = []; return acc }, {})
  const [grid, setGrid] = useState(emptyGrid)
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

  // Normalize any boxScore into a grid with every section present.
  const toGrid = (boxScore) =>
    sections.reduce((acc, s) => {
      acc[s.key] = (boxScore?.[s.key] || []).map((e) => ({ ...e }))
      return acc
    }, {})

  // Pre-fill from stats already saved for this team, so reopening shows them
  // (editable) instead of blank. Once per mount so edits are never clobbered.
  useEffect(() => {
    if (prefilledRef.current) return
    prefilledRef.current = true
    const existing = getPlayerStatsForTid(game, targetTid, dynastyTeams)
    if (!existing) return
    const g = toGrid(existing)
    setGrid(g)
    setRawText(serializeUnifiedBoxScoreToTsv(g))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncFromGrid = (g) => {
    setGrid(g)
    setRawText(serializeUnifiedBoxScoreToTsv(g))
  }

  const applyRawText = (text) => {
    setRawText(text)
    setGrid(toGrid(parseUnifiedBoxScoreRows(splitTsv(text))))
  }

  const editCell = (sectionKey, rowIdx, fieldKey, value) => {
    const g = { ...grid, [sectionKey]: grid[sectionKey].map((row, i) => (i === rowIdx ? { ...row, [fieldKey]: value } : row)) }
    syncFromGrid(g)
  }

  const addRow = (sectionKey) => {
    syncFromGrid({ ...grid, [sectionKey]: [...grid[sectionKey], { playerName: '' }] })
  }

  const removeRow = (sectionKey, rowIdx) => {
    syncFromGrid({ ...grid, [sectionKey]: grid[sectionKey].filter((_, i) => i !== rowIdx) })
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

  // Build the import boxScore: coerce values, drop fully-empty rows.
  const buildBoxScore = () =>
    sections.reduce((acc, s) => {
      acc[s.key] = (grid[s.key] || [])
        .map((row) => {
          const entry = { playerName: (row.playerName ?? '').toString().trim() }
          s.fieldKeys.forEach((fk, idx) => {
            if (idx === 0) return
            entry[fk] = coerce(row[fk])
          })
          return entry
        })
        .filter((e) => e.playerName !== '' || s.fieldKeys.some((fk, idx) => idx > 0 && e[fk] != null))
      return acc
    }, {})

  const handleImport = async () => {
    const boxScore = buildBoxScore()
    const total = sections.reduce((n, s) => n + (boxScore[s.key]?.length || 0), 0)
    if (total === 0) {
      toast.error('Paste or enter at least one player first.')
      return
    }
    setImporting(true)
    try {
      await onImport(boxScore)
      toast.success('Player stats imported.')
      onClose()
    } catch (error) {
      console.error('Player stats paste import failed:', error)
      toast.error('Could not import the stats. Check the values and try again.')
    } finally {
      setImporting(false)
    }
  }

  const hasAny = sections.some((s) => (grid[s.key] || []).some((r) => (r.playerName ?? '') !== '' || s.fieldKeys.some((fk, idx) => idx > 0 && (r[fk] ?? '') !== '')))

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-3">
      {/* 1. Copy AI Prompt */}
      {aiPrompt && (
        <button
          type="button"
          onClick={copyPrompt}
          className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-[0.99]"
          style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
        >
          {copied ? 'Copied!' : 'Copy AI Prompt'}
        </button>
      )}

      {/* 2. Collapsible how-to */}
      <div className="rounded-lg border border-surface-4 bg-surface-2/50">
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
            Take screenshots of the stats you want to enter. It doesn't have to be exact, just clear and fully showing. Upload those along with the copied prompt to your AI platform of choice. It will return a TSV output — copy it, then paste below (the grid fills in automatically; edit any cell before importing).
          </p>
        )}
      </div>

      {/* 3. Paste AI output + reveal-textarea arrow (both white) */}
      <div className="flex items-center gap-2">
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
        <div className="ml-auto flex items-center gap-1.5 text-xs tabular text-txt-tertiary">
          {teamLogo
            ? <img src={teamLogo} alt={teamAbbr} title={teamAbbr} className="h-5 w-5 object-contain" />
            : <span className="font-semibold">{teamAbbr}</span>}
        </div>
      </div>

      {showRaw && (
        <textarea
          value={rawText}
          onChange={(e) => applyRawText(e.target.value)}
          placeholder="Paste the AI's reply here. Each category has a banner, a header row, then one line per player."
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          rows={5}
          className="w-full rounded-md border border-surface-5 bg-surface-2 p-2 text-sm font-mono text-txt-primary resize-y focus:outline-none focus:ring-2 focus:ring-surface-5"
        />
      )}

      {/* One editable table per category, dynamic player rows. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
        {sections.map((s) => (
          <div key={s.key} className="rounded-md border border-surface-4">
            <div className="px-2 py-1 label-xs text-txt-secondary bg-surface-2 rounded-t-md">{s.title}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular">
                <thead>
                  <tr className="text-txt-tertiary">
                    {s.headers.map((h, idx) => (
                      <th key={h} className={`px-1.5 py-1 font-semibold whitespace-nowrap ${idx === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                    <th className="px-1 py-1 w-6" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {(grid[s.key] || []).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-t border-surface-3">
                      {s.fieldKeys.map((fk, idx) => (
                        <td key={fk} className={idx === 0 ? 'px-1 py-0.5 min-w-[7rem]' : 'px-1 py-0.5 w-14'}>
                          <input
                            type="text"
                            inputMode={idx === 0 ? 'text' : 'decimal'}
                            value={row[fk] ?? ''}
                            onChange={(e) => editCell(s.key, rowIdx, fk, e.target.value)}
                            aria-label={`${s.title} ${s.headers[idx]} row ${rowIdx + 1}`}
                            className={`w-full bg-transparent tabular text-txt-primary rounded px-1 py-0.5 focus:outline-none focus:bg-surface-2 focus:ring-1 focus:ring-surface-5 ${idx === 0 ? 'text-left' : 'text-right'}`}
                          />
                        </td>
                      ))}
                      <td className="px-1 py-0.5 w-6 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(s.key, rowIdx)}
                          aria-label="Remove player"
                          className="text-txt-tertiary hover:text-txt-primary"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={s.headers.length + 1} className="px-1.5 py-1">
                      <button
                        type="button"
                        onClick={() => addRow(s.key)}
                        className="text-xs font-semibold text-txt-secondary hover:text-txt-primary"
                      >
                        + Add player
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onUseGoogle}>Use Google Sheet instead</Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleImport} disabled={importing || !hasAny}>
            {importing ? 'Importing…' : 'Import Stats'}
          </Button>
        </div>
      </div>
    </div>
  )
}
