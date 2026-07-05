import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import { getTeamNameLabel } from '../data/teamRegistry'
import SheetModalHeader from './ui/SheetModalHeader'
import SheetModalAIHero from './ui/SheetModalAIHero'
import SheetManualEntry from './ui/SheetManualEntry'
import SheetModalFooter from './ui/SheetModalFooter'
import AuthErrorModal from './AuthErrorModal'
import { useAuthErrorHandler } from '../hooks/useAuthErrorHandler'
import {
  createRecruitingSheet,
  readRecruitingFromSheet,
  deleteGoogleSheet,
  getSheetEmbedUrl,
  sheetExists,
  refreshRecruitingSheetPrefill
} from '../services/sheetsService'
import { getModalColors } from '../utils/colorUtils'
import { buildAIPrompt } from '../utils/aiPrompt'
import { ATTRIBUTE_COLUMNS, ATTRIBUTE_ABBR } from '../utils/recruitAttributes'
import { normalizeRecruitRows } from '../utils/recruitSheetParse'
import SheetLoadingHint from './SheetLoadingHint'
import LocalDataEntry from './ui/LocalDataEntry'
import { splitTsv } from '../utils/tsvParse'

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

// Header labels for the local-paste grid, in the exact column order the AI
// prompt emits and parseRecruitingRow (utils/recruitSheetParse.js) reads:
// A→P are the commitment fields, Q is the single labeled attributes cell.
// Without these the grid renders a headerless, cramped strip of unlabeled cells.
const RECRUIT_PASTE_COLUMNS = [
  'Name', 'Class', 'Pos', 'Arch', 'Stars', 'Natl Rk', 'St Rk', 'Pos Rk',
  'Height', 'Weight', 'Hometown', 'State', 'Gem/Bust', 'Dev', 'Prev Team',
  'Commit', 'Attributes',
]

// Dropdown options for the paste grid's enumerated columns. Rendered as a
// <select> so the value can only be a valid one (and a pasted "gem"/"hidden"
// snaps onto the canonical casing on the way in). 'Dev' leads with "Hidden" —
// the correct state for a target whose dev trait hasn't been revealed yet.
const RECRUIT_COLUMN_OPTIONS = {
  'Gem/Bust': ['Gem', 'Bust'],
  'Dev': ['Hidden', 'Normal', 'Impact', 'Star', 'Elite'],
}

export default function RecruitingCommitmentsModal({
  isOpen,
  onClose,
  onSave,
  currentYear,
  currentPhase,
  currentWeek,
  commitmentKey,
  recruitingLabel,
  existingCommitments = [],
  teamColors
}) {
  const { currentDynasty, updateDynasty } = useDynasty()
  const { user } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const modalColors = useMemo(() => getModalColors(teamColors), [teamColors])
  const [syncing, setSyncing] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [showDeletedNote, setShowDeletedNote] = useState(false)
  const [createAttempts, setCreateAttempts] = useState(0)
  const [authErrorOccurred, setAuthErrorOccurred] = useState(false)
  // Single attempt per open. A FAILED creation must NOT auto-retry — the old
  // value of 2 let a non-auth failure re-fire (creatingSheet is in the effect
  // deps) and spawn a second orphan Google Sheet. An explicit retry (re-auth
  // bumps auth.retryCount, which resets the flags) re-arms one more.
  const MAX_CREATE_ATTEMPTS = 1
  const auth = useAuthErrorHandler()
  const [isMobile, setIsMobile] = useState(false)
  // Local paste is the DEFAULT; the Google Sheet flow is the opt-in fallback.
  const [useLocal, setUseLocal] = useState(true)

  const [useEmbedded, setUseEmbedded] = useState(() => {
    return localStorage.getItem('sheetEmbedPreference') === 'true'
  })
  const [highlightSave, setHighlightSave] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Prefill set = every commit PLUS every tracked target for this class, deduped
  // by pid. Targets carry their current Commitment status + attributes so the
  // board survives the weekly Save & Delete (the sheet is disposable; the player
  // records are the source of truth). Committed-to-you records show YOUR team's
  // abbr in the Commitment column (clearer than blank, and reads back the same).
  // Defined before the prompts so they can point the AI at the right paste row.
  const prefillRecruits = useMemo(() => {
    const players = currentDynasty?.players || []
    const teams = currentDynasty?.teams || {}
    const userTid = Number(currentDynasty?.currentTid)
    const abbrOf = (tid) => getTeamNameLabel(teams, tid) || teams[tid]?.abbr || ''
    const userAbbr = abbrOf(userTid)
    const byPid = new Map()
    for (const p of players) {
      if (!p?.isTarget || Number(p.targetYear) !== Number(currentYear)) continue
      const commitment = p.commitmentTid == null
        ? 'Uncommitted'
        : (Number(p.commitmentTid) === userTid ? userAbbr : abbrOf(p.commitmentTid))
      byPid.set(p.pid, {
        name: p.name, class: p.class, position: p.position, archetype: p.archetype,
        stars: p.stars, nationalRank: p.nationalRank, stateRank: p.stateRank, positionRank: p.positionRank,
        height: p.height, weight: p.weight, hometown: p.hometown, state: p.state,
        gemBust: p.gemBust, devTrait: p.devTrait, previousTeam: p.previousTeam,
        commitment, attributes: p.attributes || null, pid: p.pid,
      })
    }
    // Add plain commits that aren't already represented by a tracked target.
    // These live in recruitingCommitments, so they're commits to YOUR team —
    // stamp the Commitment column with your abbr (was blank before).
    let anon = 0
    for (const c of existingCommitments) {
      if (c?.pid != null && byPid.has(c.pid)) continue
      byPid.set(c?.pid != null ? c.pid : `c-${anon++}`, { ...c, commitment: c.commitment || userAbbr })
    }
    return [...byPid.values()]
  }, [currentDynasty?.players, currentDynasty?.teams, currentDynasty?.currentTid, existingCommitments, currentYear])

  // ── Recruiting prompt (single, unified) ──────────────────────────────────
  // ONE prompt covers every recruiting screenshot: a board, a weekly commit
  // list, or a recruit's player-page "Attributes" tab. It outputs the standard
  // A–P row, classifies the Commitment column (a team abbr if committed, the
  // literal "Uncommitted" if still being recruited), and OPTIONALLY fills the
  // per-attribute columns when a player-page Attributes tab is shown. The
  // commit-only and target-tracking flows were two prompts before; they only
  // ever differed by the attribute columns and the "Uncommitted" sentinel, so
  // the superset prompt does both. (A BLANK Commitment still means "committed
  // to your team" for back-compat — see classifyCommitment.)
  const startRow = prefillRecruits.length + 2

  // Recognized attribute names + their short codes. The AI may use either when
  // filling the single Attributes cell; the app reads them back by name/code.
  const attrNameRef = ATTRIBUTE_COLUMNS.map(n => `${n} (${ATTRIBUTE_ABBR[n] || n})`).join(', ')
  const recruitingPrompt = useMemo(() => buildAIPrompt({
    title: `${currentYear} Recruiting: ${recruitingLabel || ''}`.trim(),
    structure: `This sheet has ONE tab: "Commitments". Row 1 is a PROTECTED header. Output ONLY the NEW rows visible in THIS request's screenshots, pasted BELOW the rows already entered; never re-output existing rows.

You may get any of these screenshots. Handle each:
  • A RECRUITING BOARD or weekly COMMIT LIST: output each recruit's columns A–P (recruit info + Commitment). Leave the Attributes cell (Q) blank.
  • A recruit's PLAYER PAGE "Attributes" tab: output that ONE recruit's row, columns A–P PLUS the single Attributes cell (Q) filled from the tab.
Attributes appear ONLY on the player-page Attributes tab, never on the board. If you only have the board, the Attributes cell stays blank (not every recruit is scouted, and that is expected).

═══════════════════════════════════════════════════════════
USE CODE EXECUTION (MANDATORY)
═══════════════════════════════════════════════════════════
Column-shift — Commitment leaking into Prev Team, Attributes leaking into
Commitment — is the #1 failure mode for this sheet. It happens when an empty
cell (HS recruits have a blank Dev Trait and Prev Team) is collapsed by hand
instead of emitted as a true empty field, sliding every later column left.

MANDATORY: use Python to build and emit every row. The csv module guarantees
EXACTLY 16 tab characters per row no matter how many fields are blank — making
column-shift structurally impossible.

COLS = [
    'player', 'class', 'position', 'archetype', 'stars', 'nat_rank',
    'state_rank', 'pos_rank', 'height', 'weight', 'hometown', 'state',
    'gem_bust', 'dev_trait', 'prev_team', 'commitment', 'attributes'
]  # 17 fields → csv.writer always emits 16 tabs

Step 1 — parse every NEW recruit from the screenshots into a Python list of
dicts. EVERY dict must have ALL 17 keys; use '' (empty string) for any blank
field. A typical HS recruit has dev_trait='' and prev_team='' — the code still
emits the tabs. 'attributes' is '' unless this is a player-page Attributes tab.
Example dict (HS recruit off the board, not scouted):
  {'player':'Deon Goodin','class':'HS','position':'QB','archetype':'Dual Threat',
   'stars':'☆☆☆','nat_rank':'1842','state_rank':'156','pos_rank':'119',
   'height':'6\\'0"','weight':'181','hometown':'Rome','state':'GA',
   'gem_bust':'','dev_trait':'','prev_team':'','commitment':'Uncommitted',
   'attributes':''}

Step 2 — emit with csv.writer (NOT f-strings or manual tab-join):
  import csv, io
  buf = io.StringIO()
  w = csv.writer(buf, delimiter='\\t', lineterminator='\\n',
                 quoting=csv.QUOTE_NONE, escapechar='\\\\')
  for r in recruits:
      w.writerow([r[c] for c in COLS])
  print(buf.getvalue(), end='')

WHY THIS IS NON-NEGOTIABLE: csv.writer always emits len(COLS)−1 = 16 tabs. An
empty string between two delimiters is still a delimiter — the column slot is
preserved, so Commitment stays in its slot and Attributes stays in its slot.
Manually padding tabs by eye is where the bug lives; the code eliminates it.

If code execution is unavailable: write each row as a 17-element Python list
literal and assert len(row) == 17 BEFORE joining with tabs — never join until
the list is confirmed complete.

═══════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════
1. Output ONLY data rows for NEW recruits. NEVER output the header row or re-output existing rows.
2. Tab-separated. Columns in EXACT order A→P, then ALWAYS the Attributes cell Q (blank when not scouted).
3. One row per recruit; keep screenshot order.
4. NO COMMAS in numbers ("1234", not "1,234"). Integers have no decimal point. No quotes around numbers.
5. BLANK for unknown — never guess, never 0/"-"/"N/A". Blank ≠ zero.
5a. EVERY row MUST have ALL 17 fields (A→P plus the Q Attributes cell) = 16 tabs,
    even when fields are blank. The code in USE CODE EXECUTION guarantees this;
    do NOT hand-trim empty cells.
6. Dropdown columns (B, C, D, E, I, L, M, N, O, P) MUST be EXACTLY one of the listed values.
7. Column E (Stars) uses ☆ symbols, NOT digits.
8. Do NOT output the hidden "pid" column, nor the trailing "NIL" column after it — the app fills pid, and NIL is the recruiting-offer column the user enters by hand.
9. NAMES IN NORMAL CASE. Column A (Player) and Column K (Hometown) are Title Case, never ALL CAPS — the screenshots use an all-caps font, but output "Jaylen Carter" / "Baton Rouge", not "JAYLEN CARTER" / "BATON ROUGE". Preserve real internal capitals (McDaniel, O'Brien, DeShawn).

═══════════════════════════════════════════════════════════
COLUMNS A–P
═══════════════════════════════════════════════════════════
 A Player     | Full player name in NORMAL Title Case — "Jaylen Carter", never "JAYLEN CARTER". The in-game screenshots print names in an ALL-CAPS font; do NOT copy that casing. Capitalize only the first letter of each name part, and preserve genuine internal capitals (e.g. McDaniel, O'Brien, DeShawn, TJ).
 B Class      | Dropdown: HS, JUCO Fr, JUCO So, JUCO Jr, Fr, RS Fr, So, RS So, Jr, RS Jr
 C Position   | Dropdown: QB, HB, FB, WR, TE, LT, LG, C, RG, RT, LEDG, REDG, DT, SAM, MIKE, WILL, CB, FS, SS, K, P, ATH
 D Archetype  | Dropdown — exact archetype name (e.g. Pocket Passer, Speedster, Raw Strength, Power Rusher, Man Coverage…)
 E Stars      | ☆  ☆☆  ☆☆☆  ☆☆☆☆  ☆☆☆☆☆   (symbols, blank if unknown)
 F Nat. Rank  | integer        G State Rank | integer        H Pos. Rank | integer
 I Height     | Dropdown: 5'5" … 7'0" (straight quotes)      J Weight | integer lbs
 K Hometown   | text           L State | 2-letter code        M Gem/Bust | Gem, Bust, or blank
 N Dev Trait  | Elite, Star, Impact, Normal, Hidden (Hidden = trait not yet revealed; do not guess — use Hidden when trait is unknown)
 O Prev Team  | team ABBR (transfers only; blank for HS/JUCO or unknown)
 P Commitment | "Uncommitted" if uncommitted/still being recruited; otherwise the team NAME they committed to (use YOUR team's name if they committed to you). Use ONLY team names from the TEAM NAMES list below.

═══════════════════════════════════════════════════════════
ENUMERATED DROPDOWN VALUES (use EXACTLY — case-sensitive)
═══════════════════════════════════════════════════════════
Archetype (D) — 44 values:
  Backfield Creator, Dual Threat, Pocket Passer, Pure Runner, Backfield Threat, Contact Seeker, East/West Playmaker, Elusive Bruiser, North/South Receiver, North/South Blocker, Blocking, Utility, Contested Specialist, Elusive Route Runner, Gadget, Gritty Possession, Physical Route Runner, Route Artist, Speedster, Possession, Pure Blocker, Pure Possession, Vertical Threat, Agile, Pass Protector, Raw Strength, Ground and Pound, Well Rounded, Edge Setter, Gap Specialist, Power Rusher, Pure Power, Speed Rusher, Lurker, Signal Caller, Thumper, Boundary, Bump and Run, Field, Zone, Box Specialist, Coverage Specialist, Hybrid, Accurate, Power
Height (I) — use a straight ASCII quote " (not curly):
  5'5", 5'6", 5'7", 5'8", 5'9", 5'10", 5'11", 6'0", 6'1", 6'2", 6'3", 6'4", 6'5", 6'6", 6'7", 6'8", 6'9", 6'10", 6'11", 7'0"
State (L) — 2-letter US codes:
  AK, AL, AR, AZ, CA, CO, CT, DC, DE, FL, GA, HI, IA, ID, IL, IN, KS, KY, LA, MA, MD, ME, MI, MN, MO, MS, MT, NC, ND, NE, NH, NJ, NM, NV, NY, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VA, VT, WA, WI, WV, WY

═══════════════════════════════════════════════════════════
ATTRIBUTES — column Q, a SINGLE cell. Fill ONLY from a player-page "Attributes" tab. OPTIONAL.
═══════════════════════════════════════════════════════════
Attributes go in ONE cell (column Q), NOT in separate columns. For each attribute, write its NAME (or its short code) then its 0–99 rating, separated by a space, with the pairs separated by commas.

ONLY-WITH-A-NUMBER RULE (important): on the Attributes tab, a scouted attribute
shows a NUMBER; an un-scouted one shows only a progress BAR with NO number.
Include an attribute in the Q cell ONLY when a number is visible next to it.
SKIP every attribute that has no number — do NOT write its name at all. A name
with no rating is useless to the app and clutters the cell.

  EXAMPLE — a QB tab shows: Awareness 61, Throw On Run 75, Throw Power (bar, no number),
  Under Pressure (bar, no number), Short Accuracy 72, Break Sack (bar), Medium Accuracy 77,
  Speed (bar), Deep Accuracy 75, Acceleration (bar) →
  the Q cell is ONLY the ones with numbers:  Awareness 61, Throw On Run 75, Short Accuracy 72, Medium Accuracy 77, Deep Accuracy 75

  EXAMPLE — a lightly-scouted WR tab shows only Speed 86 and Medium Route 69 with numbers (everything else is a bare bar) →
  the Q cell is:  Speed 86, Medium Route 69

Rules for the Q cell:
  - Read each attribute off the tab; copy "<name> <rating>" ONLY when a rating number is shown. Order does not matter; the app places each value by its name.
  - Use the attribute name EXACTLY as it appears, or its short code. Recognized names (code): ${attrNameRef}
  - One Q cell per scouted player. If NO attribute shows a number (or the recruit was not opened to their Attributes tab), leave the Q cell blank.

═══════════════════════════════════════════════════════════
OUTPUT FORMAT (TSV)
═══════════════════════════════════════════════════════════
=== TARGETS ===
Every row has 17 fields (A→P, then the Q Attributes cell) = 16 tabs. Q is blank when not scouted:
<Player>\\t<Class>\\t<Position>\\t<Archetype>\\t<Stars>\\t<Nat>\\t<StateRank>\\t<PosRank>\\t<Height>\\t<Weight>\\t<Hometown>\\t<State>\\t<Gem/Bust>\\t<Dev>\\t<PrevTeam>\\t<Commitment>\\t<Attributes or blank>

═══════════════════════════════════════════════════════════
FINAL CHECK
═══════════════════════════════════════════════════════════
[ ] Built via csv.writer (or a length-17 asserted list) so EVERY row has exactly 17 fields = 16 tabs — no column-shift
[ ] No header row; no commas in numbers; Stars use ☆ symbols
[ ] B/C/D/E/I/L/M/N/O/P are literal dropdown values
[ ] Column P is "Uncommitted" or a team name
[ ] The Q cell holds ONLY "<name> <rating>" pairs where a NUMBER was shown (bar-only attributes omitted); blank when not scouted; pid/NIL never output`,
    includeTeamMap: true,
    dynastyTeams: currentDynasty?.teams,
    notes: 'Column P (Commitment): "Uncommitted" for uncommitted recruits you are still pursuing, otherwise the team abbreviation the recruit committed to (your own team\'s abbr if they committed to you). The single Attributes cell (Q) is filled ONLY from a recruit\'s player-page "Attributes" tab, never from the recruiting board — leave it blank if the recruit has not been scouted.',
  }), [currentYear, recruitingLabel, currentDynasty?.teams, startRow, prefillRecruits])

  // Ref to prevent concurrent sheet creation (state updates are async, refs are immediate)
  const creatingSheetRef = useRef(false)

  useEffect(() => {
    setIsMobile(isMobileDevice())
    const handleResize = () => setIsMobile(isMobileDevice())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Highlight save button when user returns to the window
  useEffect(() => {
    if (!isOpen || !sheetId || useEmbedded) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setHighlightSave(true)
        setTimeout(() => setHighlightSave(false), 5000)
      }
    }

    const handleFocus = () => {
      setHighlightSave(true)
      setTimeout(() => setHighlightSave(false), 5000)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isOpen, sheetId, useEmbedded])

  // Create recruiting sheet when modal opens
  useEffect(() => {
    const createSheet = async () => {
      // Don't touch Google auth/creation while the local paste path is active.
      if (useLocal) return
      if (authErrorOccurred || createAttempts >= MAX_CREATE_ATTEMPTS) return
      if (isOpen && user && !sheetId && !creatingSheet && !creatingSheetRef.current && !showDeletedNote && commitmentKey) {
        // Set ref immediately to prevent concurrent calls (state updates are async)
        creatingSheetRef.current = true
        setCreatingSheet(true)
        try {
          // Check for existing sheet for this phase/week
          const sheetKey = `recruitingSheet_${currentYear}_${commitmentKey}`
          const existingSheetId = currentDynasty?.[sheetKey]
          if (existingSheetId) {
            const stillExists = await sheetExists(existingSheetId)
            if (stillExists) {
              // The sheet was created (and prefilled) once for this phase/week.
              // Recruits added since through the local/in-app entry paths never
              // touched it, so re-push the current set before showing it — else
              // it displays a stale subset (the classic "app has 3, sheet shows 1").
              await refreshRecruitingSheetPrefill(existingSheetId, prefillRecruits, currentDynasty?.teams || null, currentYear)
              setSheetId(existingSheetId)
              return
            }
            await updateDynasty(currentDynasty.id, { [sheetKey]: null })
            // stale sheet (trashed in Drive); fall through to regenerate
          }

          const sheetInfo = await createRecruitingSheet(
            currentDynasty?.teamName || 'Dynasty',
            currentYear,
            currentDynasty?.teams || null,
            prefillRecruits // commits + tracked targets (status + attributes), deduped by pid
          )
          setSheetId(sheetInfo.spreadsheetId)

          // Save sheet ID to dynasty
          await updateDynasty(currentDynasty.id, {
            [sheetKey]: sheetInfo.spreadsheetId
          })
        } catch (error) {
          console.error('Failed to create recruiting sheet:', error)
          setCreateAttempts(prev => prev + 1)
          // Auth errors open the re-auth modal. Anything else gets surfaced as
          // a toast so the user isn't stuck — and the effect does NOT loop back
          // to create another sheet.
          if (auth.handleError(error)) {
            setAuthErrorOccurred(true)
          } else {
            toast.error(auth.describeError(error, 'create the recruiting sheet'))
          }
        } finally {
          setCreatingSheet(false)
          creatingSheetRef.current = false
        }
      }
    }

    createSheet()
  }, [isOpen, useLocal, user, sheetId, creatingSheet, currentDynasty?.id, auth.retryCount, showDeletedNote, currentYear, commitmentKey, prefillRecruits, authErrorOccurred, createAttempts])

  // When the user re-authenticates (retryCount bumps via the AuthErrorModal's
  // Refresh), clear the blocking flags so the sheet-creation effect above
  // retries with the fresh token — instead of staying stuck on "Failed to
  // create sheet" until the user manually closes and reopens this modal.
  useEffect(() => {
    if (auth.retryCount > 0) {
      setAuthErrorOccurred(false)
      setCreateAttempts(0)
    }
  }, [auth.retryCount])

  // Reset state when modal closes or commitmentKey changes
  useEffect(() => {
    if (!isOpen) {
      setShowDeletedNote(false)
      setCreateAttempts(0)
      setAuthErrorOccurred(false)
      setSheetId(null)
      creatingSheetRef.current = false
      setUseLocal(true)
    }
  }, [isOpen])

  // Clear stale sheet ID when switching between weeks/commitment slots
  useEffect(() => {
    if (isOpen && commitmentKey) {
      setSheetId(null)
    }
  }, [commitmentKey])

  // Local paste import: the AI emits one self-contained row per NEW recruit
  // (columns A→P, plus optional Q), each keyed by player name — exactly what
  // the parser reads. onSave reconciles by name/pid against existing players
  // (a merge, not a replace), so pasting only the new rows is correct and
  // matches the prompt ("output ONLY the NEW rows"). No pre-filled columns and
  // no positional alignment, so no normalization.
  const handleLocalImport = async (text) => {
    const recruits = await readRecruitingFromSheet(null, (currentDynasty?.teams || currentDynasty?.customTeams), { rows: splitTsv(text) })
    // Paste sends ONLY the new rows — merge them onto the existing class.
    await onSave(recruits, { mode: 'append' })
    onClose()
  }

  const handleSyncFromSheet = async () => {
    if (!sheetId) return

    setSyncing(true)
    try {
      const recruits = await readRecruitingFromSheet(sheetId, (currentDynasty?.teams || currentDynasty?.customTeams))
      // The sheet is prefilled with the full class, so it's authoritative.
      await onSave(recruits, { mode: 'replace' })
      onClose()
    } catch (error) {
      console.error(error)
      if (!auth.handleError(error)) {
        toast.error('Failed to sync from Google Sheets. Make sure data is properly formatted.')
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAndDelete = async () => {
    if (!sheetId) return

    setDeletingSheet(true)
    try {
      const recruits = await readRecruitingFromSheet(sheetId, (currentDynasty?.teams || currentDynasty?.customTeams))
      // The sheet is prefilled with the full class, so it's authoritative.
      await onSave(recruits, { mode: 'replace' })

      // Move sheet to trash (keep sheet ID stored so user can restore if needed)
      await deleteGoogleSheet(sheetId)

      setSheetId(null)
      setShowDeletedNote(true)
      setTimeout(() => {
        onClose()
      }, 2500)
    } catch (error) {
      console.error('Error in handleSyncAndDelete:', error)
      if (!auth.handleError(error)) {
        toast.error(`Failed to sync/delete: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setDeletingSheet(false)
    }
  }

  const handleRegenerateSheet = async () => {
    if (!sheetId) return

    const confirmed = await confirm({
      title: 'Regenerate sheet?',
      message: "This will delete your current sheet and create a fresh one. Any unsaved data will be lost.",
      confirmLabel: 'Regenerate',
      variant: 'danger',
    })
    if (!confirmed) return

    setRegenerating(true)
    try {
      await deleteGoogleSheet(sheetId)
      const sheetKey = `recruitingSheet_${currentYear}_${commitmentKey}`
      await updateDynasty(currentDynasty.id, { [sheetKey]: null })
      setSheetId(null)
      auth.retry()
    } catch (error) {
      console.error('Failed to regenerate sheet:', error)
      if (!auth.handleError(error)) {
        toast.error('Failed to regenerate sheet. Please try again.')
      }
    } finally {
      setRegenerating(false)
    }
  }

  const handleDeleteSheetOnly = async () => {
    if (!sheetId || !currentDynasty) return
    const ok = await confirm({
      title: 'Delete this recruiting commitments sheet?',
      message: 'This deletes the Google Sheet without applying any edits. Your dynasty recruiting commitments stay as-is.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingSheet(true)
    try {
      await deleteGoogleSheet(sheetId)
      const sheetKey = `recruitingSheet_${currentYear}_${commitmentKey}`
      await updateDynasty(currentDynasty.id, { [sheetKey]: null })
      setSheetId(null)
      setShowDeletedNote(true)
      setTimeout(() => onClose(), 1800)
    } catch (error) {
      console.error('Failed to delete sheet:', error)
      if (!auth.handleError(error)) {
        toast.error('Failed to delete the sheet. Try again.')
      }
    } finally {
      setDeletingSheet(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  const embedUrl = sheetId ? getSheetEmbedUrl(sheetId, 'Commitments') : null
  const isLoading = creatingSheet

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] py-8 px-4 sm:p-4"
      style={{ margin: 0 }}
      onMouseDown={handleClose}
    >
      <div
        className={`card-elevated w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden ${
          useEmbedded
            ? 'sm:w-[95vw] sm:h-[95dvh]'
            : 'sm:max-w-[680px] sm:h-auto'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SheetModalHeader eyebrow="Recruiting" title={recruitingLabel} onClose={handleClose} />

        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
        {currentPhase !== 'offseason' && (
          <div className="mb-4 p-3 rounded-lg text-sm text-txt-primary" style={{ backgroundColor: 'var(--surface-3)' }}>
            <strong>Note:</strong> Weekly commitment entry is optional. You can also enter all commitments during Signing Day in the offseason.
            {prefillRecruits.length > 0 && (
              <span className="block mt-1">
                Your existing commitments and tracked targets ({prefillRecruits.length}) are pre-filled in the sheet.
              </span>
            )}
          </div>
        )}

        {useLocal && !showDeletedNote ? (
          <LocalDataEntry
            aiPrompt={recruitingPrompt}
            onImport={handleLocalImport}
            onUseGoogle={() => setUseLocal(false)}
            onCancel={handleClose}
            importLabel="Import Recruits"
            columns={RECRUIT_PASTE_COLUMNS}
            columnOptions={RECRUIT_COLUMN_OPTIONS}
            normalizeRows={normalizeRecruitRows}
          />
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div
                className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
                style={{
                  borderColor: 'var(--text-primary)',
                  borderTopColor: 'transparent'
                }}
              />
              <p className="text-lg font-semibold text-txt-primary">
                Creating Recruiting Sheet...
              </p>
              <p className="text-sm mt-2 text-txt-secondary">
                Setting up dropdowns and formatting
              </p>
              <SheetLoadingHint active={isLoading} />
            </div>
          </div>
        ) : showDeletedNote ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="card p-8 text-center max-w-sm">
              <p className="label-xs text-txt-tertiary mb-2">Status</p>
              <p className="text-xl font-bold text-txt-primary mb-2">Saved &amp; Moved to Trash</p>
              <p className="text-sm text-txt-secondary">Recruiting commitments saved to your dynasty.</p>
            </div>
          </div>
        ) : sheetId ? (
          <div className="flex-1 flex flex-col overflow-hidden gap-3">
            <SheetModalAIHero
              tagline="Skip the typing. Let AI read your recruiting screenshots (board, commit list, or a recruit's Attributes tab) and fill the sheet."
              buttons={[
                { label: 'Fill with AI', prompt: recruitingPrompt },
              ]}
            />
            {isMobile || !useEmbedded ? (
              <SheetManualEntry sheetId={sheetId} />
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 border border-surface-4 rounded-lg">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  title="Recruiting Commitments Sheet"
                />
              </div>
            )}
            <SheetModalFooter
              syncing={syncing}
              deletingSheet={deletingSheet}
              regenerating={regenerating}
              highlightSave={highlightSave}
              onSaveAndDelete={handleSyncAndDelete}
              onSaveAndKeep={handleSyncFromSheet}
              onDeleteSheetOnly={handleDeleteSheetOnly}
              onRegenerate={handleRegenerateSheet}
              showEmbeddedToggle={!isMobile}
              useEmbedded={useEmbedded}
              onToggleEmbedded={() => { const newValue = !useEmbedded; setUseEmbedded(newValue); localStorage.setItem('sheetEmbedPreference', newValue.toString()); }}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-txt-primary">Failed to create sheet. Please try again.</p>
          </div>
        )}
        </div>
      </div>

      {/* Auth Error Modal */}
      <AuthErrorModal
        isOpen={auth.showAuthError}
        onClose={auth.closeAuthError}
        onRefresh={auth.retry}
        teamColors={teamColors}
      />
    </div>,
    document.body,
  )
}
