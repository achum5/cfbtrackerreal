import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty } from '../context/DynastyContext'
import SheetModalHeader from './ui/SheetModalHeader'
import LocalDataEntry from './ui/LocalDataEntry'
import { buildAIPrompt } from '../utils/aiPrompt'
import { splitTsv } from '../utils/tsvParse'
import { normalizePlayerName } from '../utils/playerMatching'

// National Commits — a free-form "247 Top 100" style tracker: record notable
// recruits from around the country and where they committed, regardless of
// whether they were ever your target. No fixed count — add as many as you want.
//
// Stored on the dynasty as nationalCommitsByYear[year] = [{ pid, name,
// position, stars, committedTo }]. It is intentionally NOT tied to a team or
// to the user's own recruiting board — it's a league-wide watch list.
//
// Entry is the same Copy Prompt → AI → Paste → editable grid flow every other
// commitment screen uses, with one extra column the others don't need: the
// school each recruit committed to. It used to be a bespoke row-of-inputs
// editor, which meant a national top-100 had to be typed in by hand.

const COLUMNS = ['Recruit', 'Pos', 'Stars', 'Committed To']
const COLUMN_OPTIONS = { Stars: ['5', '4', '3', '2', '1'] }

const INSTRUCTIONS = `Screenshot the national commitment list you want to track — a recruiting site's top-100 board, the in-game national signings feed, anything that shows each recruit and where they signed. It doesn't have to be exact, just clear and fully showing. Upload that along with the copied prompt to your AI platform of choice. It will return a TSV output — copy that, then paste it below.`

const serializeRow = (c) => [
  c?.name || '',
  c?.position || '',
  c?.stars != null && c.stars !== '' ? String(c.stars) : '',
  c?.committedTo || '',
].join('\t')

/**
 * Turn pasted grid rows into the save shape, re-attaching the pid of any
 * recruit already tracked under the same name. pid links a ledger row to the
 * real recruit player created for it — losing it on a re-import would spawn a
 * duplicate player instead of editing the existing one.
 */
export function parseNationalCommitRows(rows, existingCommits) {
  const byName = new Map()
  for (const c of existingCommits || []) {
    if (c?.name) byName.set(normalizePlayerName(c.name), c)
  }
  return (rows || [])
    .map((cells) => {
      const name = String(cells[0] ?? '').trim()
      if (!name) return null
      const starsRaw = String(cells[2] ?? '').trim().replace(/[^0-9]/g, '')
      const stars = starsRaw === '' ? null : Number(starsRaw)
      return {
        pid: byName.get(normalizePlayerName(name))?.pid ?? null,
        name,
        position: String(cells[1] ?? '').trim().toUpperCase(),
        stars: Number.isFinite(stars) && stars >= 1 && stars <= 5 ? stars : null,
        committedTo: String(cells[3] ?? '').trim(),
      }
    })
    .filter(Boolean)
}

export default function NationalCommitsModal({ isOpen, onClose, onSave, existingCommits = [], currentYear }) {
  const { currentDynasty } = useDynasty()

  const initialText = useMemo(
    () => (existingCommits || []).filter(c => c?.name).map(serializeRow).join('\n'),
    [existingCommits],
  )

  const aiPrompt = useMemo(() => buildAIPrompt({
    title: `${currentYear ? `${currentYear} ` : ''}National Commits`,
    structure: `Output ONE line per notable recruit in the screenshots, with the school they committed to. Each line is SELF-DESCRIBING — it carries the recruit's own name — so there is NO pre-filled column to line up against and NO fixed row order.

This is a league-wide watch list, not the user's own recruiting class. Include every recruit shown, whoever they signed with.

═══════════════════════════════════════════════════════════
CRITICAL RULES — read before anything else
═══════════════════════════════════════════════════════════
1. Each line has EXACTLY 4 tab-separated fields: Recruit<TAB>Pos<TAB>Stars<TAB>Committed To.
2. NO header row. NO blank lines. NO commentary, totals, rankings, or labels INSIDE the data.
3. Recruit: the full player name exactly as it should appear.
4. Pos: the position abbreviation in caps (QB, HB, WR, TE, OT, DT, EDGE, LB, CB, S, K, P …). Blank if not shown.
5. Stars: a single digit 1-5 — no "★", no "5-star", no decimals. Blank if not shown.
6. Committed To: the school name as shown (e.g. "Alabama", "Ohio State"). Blank if the recruit is still uncommitted.
7. Every line still has all 3 tabs even when a field is blank.

═══════════════════════════════════════════════════════════
PER-LINE OUTPUT (4 tab-separated fields)
═══════════════════════════════════════════════════════════
<Recruit><TAB><Pos><TAB><Stars><TAB><Committed To>

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════
<Recruit>\\t<Pos>\\t<Stars>\\t<Committed To>
<Recruit>\\t<Pos>\\t<Stars>\\t<Committed To>
…one line per recruit shown

(Each \\t represents a LITERAL TAB character — use actual tabs, not the text "\\t".)

═══════════════════════════════════════════════════════════
FINAL CHECK before you send
═══════════════════════════════════════════════════════════
[ ] Every line has exactly 4 tab-separated fields (three tabs)
[ ] Stars are a bare digit 1-5, or blank
[ ] Positions are caps abbreviations
[ ] No header row, no ranking numbers, no commentary INSIDE the data`,
    includeTeamMap: true,
    dynastyTeams: currentDynasty?.teams,
  }), [currentYear, currentDynasty?.teams])

  if (!isOpen) return null

  const handleImport = async (text) => {
    await onSave(parseNationalCommitRows(splitTsv(text), existingCommits))
    onClose()
  }

  // Saving an empty list is what marks the task done in a year with nothing
  // worth tracking. Import is disabled on an empty grid, so that path needs
  // its own control rather than an empty paste.
  const markNone = async () => {
    await onSave([])
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] py-8 px-4 sm:p-4"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="card-elevated w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden sm:max-w-[680px] sm:h-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SheetModalHeader eyebrow="Recruiting" title="National Commits" onClose={onClose} />
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
          <LocalDataEntry
            aiPrompt={aiPrompt}
            onImport={handleImport}
            onCancel={onClose}
            importLabel="Import National Commits"
            instructions={INSTRUCTIONS}
            columns={COLUMNS}
            columnOptions={COLUMN_OPTIONS}
            initialText={initialText}
          >
            {/* Only offered while nothing is tracked yet. Once rows exist the
                task is already done, and this control would delete the recruit
                players those rows created. */}
            {!initialText ? (
              <div className="flex-shrink-0 text-center">
                <button
                  type="button"
                  onClick={markNone}
                  className="text-xs text-txt-tertiary hover:text-txt-secondary transition"
                >
                  …or mark this done with no national commits
                </button>
              </div>
            ) : null}
          </LocalDataEntry>
        </div>
      </div>
    </div>,
    document.body,
  )
}
