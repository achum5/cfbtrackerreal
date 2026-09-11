import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty, getTeamRatingsForYear } from '../context/DynastyContext'
import { getTeamNameOptions, getTeamNameAliases, TEAMS } from '../data/teamRegistry'
import { useToast } from './ui/Toast'
import SheetModalHeader from './ui/SheetModalHeader'
import LocalDataEntry from './ui/LocalDataEntry'
import { buildAIPrompt } from '../utils/aiPrompt'
import { splitTsv } from '../utils/tsvParse'
import { teamOverallRows, parseTeamOverallRows } from '../utils/teamOverallsRows'

/**
 * TeamOverallsSheetModal — every school's OVR / OFF / DEF for one season, from
 * the preseason to-do "Enter All Team Overalls".
 *
 * This used to be 138 schools of hand-typed number boxes, the longest piece of
 * manual entry left in the app. It is now the same Copy Prompt → AI → Paste
 * grid every other data-entry to-do uses, pre-filled with what is already
 * stored so a re-open shows prior work and only real edits are written.
 *
 * No Google Sheets path: the list is fixed and self-describing (every row
 * carries its own team name), so the sheet's one advantage — pre-filled,
 * protected columns to align against — buys nothing here.
 */
const COLUMNS = ['Team', 'OVR', 'OFF', 'DEF']

const INSTRUCTIONS = `Screenshot the in-game team list showing each school's ratings — the Teams screen, or team rankings, wherever OVR / OFF / DEF are visible. Scroll through and capture them all; a screen recording works too. Upload that along with the copied prompt to your AI platform of choice. It will return a TSV output — copy that, then paste it below.`

export default function TeamOverallsSheetModal({ isOpen, onClose, year }) {
  const { currentDynasty, saveAllTeamRatings, isViewOnly } = useDynasty()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const teamsSource = currentDynasty?.teams || TEAMS

  // Ratings already stored for the season — used both to pre-fill the grid and,
  // on import, to work out which teams actually changed.
  const ratingsFor = useMemo(() => (tid) => (
    (currentDynasty ? getTeamRatingsForYear(currentDynasty, tid, year) : null) || {}
  ), [currentDynasty, year])

  const initialText = useMemo(() => (
    isOpen
      ? teamOverallRows(teamsSource, ratingsFor).map(r => r.cells.join('\t')).join('\n')
      : ''
  ), [isOpen, teamsSource, ratingsFor])

  const teamNames = useMemo(
    () => getTeamNameOptions(teamsSource, { includeFCS: false }),
    [teamsSource],
  )

  const aiPrompt = useMemo(() => buildAIPrompt({
    title: `${year} Team Overalls`,
    structure: `Output ONE line per FBS team whose ratings you can read. Each line is SELF-DESCRIBING — it carries the team's own name — so there is NO fixed row order and NO pre-filled column to line up against. A partial list is fine: the app keeps whatever you leave out.

The three numbers are the team's ratings on the in-game team list: OVERALL, OFFENSE and DEFENSE. They are 0-99 integers, usually shown side by side on the same row as the school.

═══════════════════════════════════════════════════════════
CRITICAL RULES — read before anything else
═══════════════════════════════════════════════════════════
1. Each line has EXACTLY 4 tab-separated fields: Team<TAB>OVR<TAB>OFF<TAB>DEF.
2. NO header row. NO blank lines. NO commentary, totals, conference labels, or rank numbers INSIDE the data.
3. Team MUST be a name from the TEAM NAMES list at the bottom of this prompt, spelled exactly as it appears there. Never an abbreviation, a nickname, a mascot, or a city.
4. OVR / OFF / DEF are integers 0-99 — no decimals, no commas, no "+/-", no letter grades ("A+" is not a rating). Leave a field BLANK if that number is not visible; the line still carries all 3 tabs.
5. OMIT a team entirely if you cannot read ANY of its three numbers. Do NOT pad the list with blank rows and do NOT guess.
6. Do not output the same team twice.
7. Rank numbers and records ("12-1", "#4") are NOT ratings. If a screen shows a ranking rather than a rating, skip it.

═══════════════════════════════════════════════════════════
PER-LINE OUTPUT (4 tab-separated fields)
═══════════════════════════════════════════════════════════
<Team Name><TAB><OVR><TAB><OFF><TAB><DEF>

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════
=== TEAM OVERALLS ===
Alabama\\t92\\t90\\t93
Georgia\\t91\\t88\\t94
Massachusetts\\t71\\t70\\t72
…one line per team you can read

(Each \\t represents a LITERAL TAB character — use actual tabs, not the text "\\t".)

═══════════════════════════════════════════════════════════
FINAL CHECK before you send
═══════════════════════════════════════════════════════════
[ ] Every line has exactly 3 tab characters (4 fields), trailing tabs included
[ ] Every team name appears in the TEAM NAMES list, spelled the same way
[ ] Every rating is an integer 0-99, or blank
[ ] No rank numbers, no win-loss records, no letter grades
[ ] No team listed twice
[ ] No header row, no commentary INSIDE the data`,
    includeTeamMap: true,
    dynastyTeams: currentDynasty?.teams,
  }), [year, currentDynasty?.teams])

  const handleImport = async (text) => {
    const { changed, unmatched } = parseTeamOverallRows(splitTsv(text), teamsSource, ratingsFor)
    const count = Object.keys(changed).length
    if (unmatched.length > 0) {
      // Named, not counted: the user needs to know WHICH school to fix.
      const shown = unmatched.slice(0, 5).join(', ')
      toast.error(
        `Could not match ${unmatched.length} team name${unmatched.length === 1 ? '' : 's'}: ` +
        `${shown}${unmatched.length > 5 ? '…' : ''}. Fix ${unmatched.length === 1 ? 'it' : 'them'} in the grid and import again.`,
      )
      return
    }
    if (count === 0) {
      toast.success('No rating changes to save.')
      onClose()
      return
    }
    setSaving(true)
    try {
      const result = await saveAllTeamRatings(currentDynasty.id, year, changed)
      toast.success(`Saved ratings for ${result?.saved ?? count} team${count === 1 ? '' : 's'}.`)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !currentDynasty) return null

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
        <SheetModalHeader eyebrow="Preseason" title={`Team Overalls — ${year}`} onClose={onClose} />
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
          <LocalDataEntry
            aiPrompt={aiPrompt}
            onImport={handleImport}
            onCancel={onClose}
            importLabel="Import Team Overalls"
            instructions={INSTRUCTIONS}
            columns={COLUMNS}
            comboboxColumns={{ Team: teamNames }}
            comboboxAliases={getTeamNameAliases(teamsSource)}
            initialText={initialText}
            busy={saving || isViewOnly}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
