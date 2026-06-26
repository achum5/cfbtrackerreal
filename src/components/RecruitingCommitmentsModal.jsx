import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
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
  sheetExists
} from '../services/sheetsService'
import { teamAbbreviations } from '../data/teamAbbreviations'
import { getModalColors } from '../utils/colorUtils'
import { buildAIPrompt } from '../utils/aiPrompt'
import { ATTRIBUTE_COLUMNS, ATTRIBUTE_ABBR, attributeNamesFor } from '../utils/recruitAttributes'
import SheetLoadingHint from './SheetLoadingHint'

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
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
  const MAX_CREATE_ATTEMPTS = 2
  const auth = useAuthErrorHandler()
  const [isMobile, setIsMobile] = useState(false)

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
    const abbrOf = (tid) => teams[tid]?.abbr || ''
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
  const ATTR_N = ATTRIBUTE_COLUMNS.length
  const startRow = prefillRecruits.length + 2

  // The attribute portion of a scouted row is a fixed, position-INDEPENDENT
  // grid: cell #1 is always Awareness, cell #2 always Speed, etc. The reader
  // maps each cell to its attribute by POSITION, so a value only lands right
  // when it sits in its own numbered cell. AIs reliably get this wrong by
  // packing the ~10 attributes a position shows into the first ~10 cells
  // (e.g. an OL's blocking grades end up under Throw/Accuracy). The numbered
  // master list + a worked OL example below exist purely to stop that.
  const attrNumberedList = ATTRIBUTE_COLUMNS
    .map((n, i) => `${i + 1}. ${n} (${ATTRIBUTE_ABBR[n] || ''})`)
    .join('\n')
  // Worked example for an LG (offensive lineman) — the exact case users hit.
  const olExampleVals = {
    Awareness: 74, 'Run Block': 80, 'Run Block Power': 83, 'Run Block Finesse': 79,
    'Pass Block': 82, 'Pass Block Power': 81, 'Pass Block Finesse': 77, 'Impact Blocking': 80,
    Agility: 84, Acceleration: 78,
  }
  const olCellList = (attributeNamesFor('LG') || [])
    .map((n) => ({ n, idx: ATTRIBUTE_COLUMNS.indexOf(n) }))
    .filter(({ idx }) => idx >= 0)
    .sort((a, b) => a.idx - b.idx)
    .map(({ n, idx }) => `#${idx + 1} ${ATTRIBUTE_ABBR[n] || n}=${olExampleVals[n] ?? ''}`)
    .join(', ')
  const recruitingPrompt = useMemo(() => buildAIPrompt({
    title: `${currentYear} Recruiting: ${recruitingLabel || ''}`.trim(),
    structure: `This sheet has ONE tab: "Commitments". Row 1 is a PROTECTED header. Output ONLY the NEW rows visible in THIS request's screenshots, pasted BELOW the rows already entered; never re-output existing rows.

You may get any of these screenshots. Handle each:
  • A RECRUITING BOARD or weekly COMMIT LIST: output each recruit's columns A–P (recruit info + Commitment). Leave ALL attribute columns blank.
  • A recruit's PLAYER PAGE "Attributes" tab: output that ONE recruit's full row, columns A–P PLUS the ${ATTR_N} attribute columns filled from the tab.
Attributes appear ONLY on the player-page Attributes tab, never on the board. If you only have the board, every attribute stays blank (not every recruit is scouted, and that is expected).

═══════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════
1. Output ONLY data rows for NEW recruits. NEVER output the header row or re-output existing rows.
2. Tab-separated. Columns in EXACT order A→P (then the attribute columns when filling them).
3. One row per recruit; keep screenshot order.
4. NO COMMAS in numbers ("1234", not "1,234"). Integers have no decimal point. No quotes around numbers.
5. BLANK for unknown — never guess, never 0/"-"/"N/A". Blank ≠ zero.
6. Dropdown columns (B, C, D, E, I, L, M, N, O, P) MUST be EXACTLY one of the listed values.
7. Column E (Stars) uses ☆ symbols, NOT digits.
8. Do NOT output the hidden "pid" column, nor the trailing "NIL" column after it — the app fills pid, and NIL is the recruiting-offer column the user enters by hand.

═══════════════════════════════════════════════════════════
COLUMNS A–P  — paste at cell A${startRow} of the "Commitments" tab (first empty row below the ${prefillRecruits.length} already entered)
═══════════════════════════════════════════════════════════
 A Player     | Full name (text)
 B Class      | Dropdown: HS, JUCO Fr, JUCO So, JUCO Jr, Fr, RS Fr, So, RS So, Jr, RS Jr
 C Position   | Dropdown: QB, HB, FB, WR, TE, LT, LG, C, RG, RT, LEDG, REDG, DT, SAM, MIKE, WILL, CB, FS, SS, K, P, ATH
 D Archetype  | Dropdown — exact archetype name (e.g. Pocket Passer, Speedster, Raw Strength, Power Rusher, Man Coverage…)
 E Stars      | ☆  ☆☆  ☆☆☆  ☆☆☆☆  ☆☆☆☆☆   (symbols, blank if unknown)
 F Nat. Rank  | integer        G State Rank | integer        H Pos. Rank | integer
 I Height     | Dropdown: 5'5" … 7'0" (straight quotes)      J Weight | integer lbs
 K Hometown   | text           L State | 2-letter code        M Gem/Bust | Gem, Bust, or blank
 N Dev Trait  | Elite, Star, Impact, Normal
 O Prev Team  | team ABBR (transfers only; blank for HS/JUCO or unknown)
 P Commitment | "Uncommitted" if uncommitted/still being recruited; otherwise the team ABBR they committed to (use YOUR team's abbr if they committed to you). Use ONLY abbreviations from the team mapping below.

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
ATTRIBUTE COLUMNS (Q onward) — fill ONLY from a player-page "Attributes" tab. OPTIONAL.
═══════════════════════════════════════════════════════════
The attribute portion is EXACTLY ${ATTR_N} cells in this FIXED numbered order. Cell #1 is ALWAYS Awareness, cell #2 is ALWAYS Speed, and so on — each cell belongs to ONE specific attribute. It is NOT a position-relative slot:

${attrNumberedList}

HOW TO FILL — read carefully, this is the #1 mistake:
  - DO NOT eyeball the column positions or count tabs by hand — that is how rows end up shifted one or two cells off. Build the row WITH CODE so placement is exact.
  - Use your code tool. Create an array of exactly ${ATTR_N} empty strings. For each attribute you read off the tab, look up its index in the numbered list above (1-based cell number) and set array[cellNumber - 1] = its 0–99 rating. Then join the array with tab characters. Do the SAME for every scouted player. Paste the code's output verbatim — never hand-transcribe it.
  - A player's Attributes tab shows ONLY the ~10 attributes relevant to their position; every other cell stays an empty string.
  - DO NOT pack the ~10 values into the first ~10 cells. The matching cell is usually far from the front — most positions leave 30+ cells blank.
  - Match strictly by attribute NAME → cell number. Never by the order the values appear on the tab.
  - The result is all ${ATTR_N} cells, tab-separated, blanks included. Never drop or collapse trailing blanks.

WORKED EXAMPLE — an LG (offensive lineman). Its tab shows 10 values; they go ONLY in these cells:
  ${olCellList}
  → EVERY other attribute cell stays BLANK. An OL has no Speed/Throw/Accuracy/Route ratings, so those cells are empty.
  WRONG (the exact bug to avoid): writing those ten values into cells #1–#10 in a row — that lands the blocking grades under Speed/Throw Power/Short-Medium-Deep Accuracy.

═══════════════════════════════════════════════════════════
OUTPUT FORMAT (TSV, paste at A${startRow})
═══════════════════════════════════════════════════════════
=== TARGETS — paste at cell A${startRow} of "Commitments" tab ===
Board row (16 fields, A→P):
<Player>\\t<Class>\\t<Position>\\t<Archetype>\\t<Stars>\\t<Nat>\\t<StateRank>\\t<PosRank>\\t<Height>\\t<Weight>\\t<Hometown>\\t<State>\\t<Gem/Bust>\\t<Dev>\\t<PrevTeam>\\t<Commitment>
Scouted row (16 + ${ATTR_N} fields — the 16 A→P fields, then all ${ATTR_N} attribute cells in fixed numbered order, MOST of them blank):
<...A→P...>\\t<cell #1 ${ATTRIBUTE_COLUMNS[0]}>\\t<cell #2 ${ATTRIBUTE_COLUMNS[1]}>\\t…\\t<cell #${ATTR_N} ${ATTRIBUTE_COLUMNS[ATTR_N - 1]}>

═══════════════════════════════════════════════════════════
FINAL CHECK
═══════════════════════════════════════════════════════════
[ ] Board rows have exactly 16 tab-separated fields (15 tabs); fully-scouted rows have 16 + ${ATTR_N} fields
[ ] No header row; no commas in numbers; Stars use ☆ symbols
[ ] B/C/D/E/I/L/M/N/O/P are literal dropdown values
[ ] Column P is "Uncommitted" or a team abbreviation
[ ] Attributes filled ONLY from a player-page Attributes tab; blank when not scouted; pid column never output
[ ] Each scouted value is in its OWN numbered cell (e.g. Run Block → its RBK cell), NOT packed into the first cells; cells for attributes the position lacks are blank`,
    includeTeamMap: true,
    dynastyTeams: currentDynasty?.teams,
    notes: 'Column P (Commitment): "Uncommitted" for uncommitted recruits you are still pursuing, otherwise the team abbreviation the recruit committed to (your own team\'s abbr if they committed to you). Attribute columns are filled ONLY from a recruit\'s player-page "Attributes" tab, never from the recruiting board — leave them blank if the recruit has not been scouted.',
  }), [currentYear, recruitingLabel, currentDynasty?.teams, ATTR_N, startRow, prefillRecruits])

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
          if (auth.handleError(error)) {
            setAuthErrorOccurred(true)
          }
        } finally {
          setCreatingSheet(false)
          creatingSheetRef.current = false
        }
      }
    }

    createSheet()
  }, [isOpen, user, sheetId, creatingSheet, currentDynasty?.id, auth.retryCount, showDeletedNote, currentYear, commitmentKey, prefillRecruits, authErrorOccurred, createAttempts])

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
    }
  }, [isOpen])

  // Clear stale sheet ID when switching between weeks/commitment slots
  useEffect(() => {
    if (isOpen && commitmentKey) {
      setSheetId(null)
    }
  }, [commitmentKey])

  const handleSyncFromSheet = async () => {
    if (!sheetId) return

    setSyncing(true)
    try {
      const recruits = await readRecruitingFromSheet(sheetId, (currentDynasty?.teams || currentDynasty?.customTeams))
      await onSave(recruits)
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
      await onSave(recruits)

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
        <SheetModalHeader eyebrow="Recruiting" title={`Commitments: ${recruitingLabel}`} onClose={handleClose} />

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

        {isLoading ? (
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
