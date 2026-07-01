import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty, getCustomConferencesForYear } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import SheetModalHeader from './ui/SheetModalHeader'
import SheetModalAIHero from './ui/SheetModalAIHero'
import SheetManualEntry from './ui/SheetManualEntry'
import SheetModalFooter from './ui/SheetModalFooter'
import AuthErrorModal from './AuthErrorModal'
import { useAuthErrorHandler } from '../hooks/useAuthErrorHandler'
import SheetToolbar from './SheetToolbar'
import {
  createConferencesSheet,
  readConferencesFromSheet,
  deleteGoogleSheet,
  getSheetEmbedUrl,
  sheetExists
} from '../services/sheetsService'
import { getModalColors } from '../utils/colorUtils'
import { buildAIPrompt } from '../utils/aiPrompt'
import SheetLoadingHint from './SheetLoadingHint'
import LocalDataEntry from './ui/LocalDataEntry'
import { splitTsv } from '../utils/tsvParse'

// Simple mobile detection
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export default function ConferencesModal({ isOpen, onClose, onSave, teamColors }) {
  const { currentDynasty, updateDynasty } = useDynasty()
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [syncing, setSyncing] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [showDeletedNote, setShowDeletedNote] = useState(false)
  const auth = useAuthErrorHandler()
  const [isMobile, setIsMobile] = useState(false)
  // Local paste is the DEFAULT; the Google Sheet flow is the opt-in fallback.
  const [useLocal, setUseLocal] = useState(true)

  const [useEmbedded, setUseEmbedded] = useState(() => {
    // Load preference from localStorage
    return localStorage.getItem('sheetEmbedPreference') === 'true'
  })
  const [highlightSave, setHighlightSave] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const aiPrompt = useMemo(() => buildAIPrompt({
    title: `Custom Conferences`,
    structure: `This sheet has ONE TAB PER SEASON YEAR (tab titles like "${currentDynasty?.currentYear || new Date().getFullYear()}", "${(currentDynasty?.currentYear || new Date().getFullYear()) - 1}", etc.). Focus on the "${currentDynasty?.currentYear || new Date().getFullYear()}" tab (the current year).
Each tab has the SAME layout: row 1 is a PROTECTED header of conference names; rows 2-21 are 20 team-slot rows (one cell per conference × column).

Row 1 (PROTECTED) — column headers in alphabetical order, typically these 11 conferences:
ACC | American | Big 12 | Big Ten | Conference USA | Independent | MAC | Mountain West | Pac-12 | SEC | Sun Belt
(If the user has renamed/added/removed conferences, column headers will differ. You must output one column per header in the exact left-to-right order shown in the sheet.)

You fill rows 2-21 (20 rows) with team abbreviations, one team per cell, going top-to-bottom within each conference's column.

═══════════════════════════════════════════════════════════
CRITICAL RULES — read before anything else
═══════════════════════════════════════════════════════════
1. Output ONLY rows 2-21 of data (up to 20 rows). NEVER output row 1 (conference-name headers).
2. Output EXACTLY as many columns as the sheet has conference-name headers, in the exact left-to-right order (default: 11 columns alphabetically).
3. Each line has tab-separated team abbreviations — one cell per conference column. Use an empty field (two consecutive tabs) for conferences whose column has fewer than the current row's index worth of teams.
4. Every team abbreviation must be UPPERCASE from the mapping at the bottom — NEVER full names or nicknames.
5. Every FBS team must appear EXACTLY ONCE across all columns in the block. Duplicates will cause a validation error when the sheet is read back.
6. Each team must be placed in the column matching its real conference.
7. NO COMMAS. No commentary. No header rows. No "N/A", no dashes.
8. Row order within a column: list the teams ALPHABETICALLY BY ABBREVIATION (e.g. for SEC: ARK before AUB before BAMA before FLA before LSU). One team per row, top-to-bottom. The "either is acceptable" wording from older versions is gone — pick alphabetical and stick to it; the validator doesn't care, but a consistent rule prevents the AI from fence-sitting.
9. ONE TSV block total, preceded by the required paste-target label line above the fence (see TSV delivery rules above).

═══════════════════════════════════════════════════════════
TAB "${currentDynasty?.currentYear || new Date().getFullYear()}" — 20 rows × (number of conferences) columns
Paste at cell A2 of the "${currentDynasty?.currentYear || new Date().getFullYear()}" tab
═══════════════════════════════════════════════════════════

Default 11-column layout (your output has 11 tab-separated fields per line):
Col 1 = ACC | Col 2 = American | Col 3 = Big 12 | Col 4 = Big Ten | Col 5 = Conference USA | Col 6 = Independent | Col 7 = MAC | Col 8 = Mountain West | Col 9 = Pac-12 | Col 10 = SEC | Col 11 = Sun Belt

Default conference memberships (current real-world alignment — use these unless the screenshot shows different):
- ACC: BC, CAL, CLEM, DUKE, FSU, GT, LOU, MIA, NCST, UNC, PITT, SMU, SYR, STAN, UVA, VT, WAKE
- American: ARMY, CHAR, ECU, FAU, MEM, NAVY, UNT, RICE, TULN, TLSA, UAB, USF, UTSA
- Big 12: ARIZ, ASU, BU, BYU, UC, COLO, UH, ISU, KU, KSU, OKST, TCU, TTU, UCF, UTAH, WVU
- Big Ten: ILL, IU, IOWA, UMD, MICH, MSU, MINN, NEB, NU, OSU, ORE, PSU, PUR, RUTG, UCLA, USC, WASH, WIS
- Conference USA: FIU, KENN, LIB, LT, MTSU, NMSU, SHSU, UTEP, WKU
- Independent: ND, CONN, MASS
- MAC: AKR, BALL, BGSU, BUFF, CMU, EMU, KENT, M-OH, NIU, OHIO, TOL, WMU
- Mountain West: AFA, BOIS, CSU, FRES, HAW, NEV, SDSU, SJSU, UNLV, USU, WYO
- Pac-12: ORST, WSU
- SEC: BAMA, ARK, AUB, FLA, UGA, UK, LSU, MISS, MSST, MIZ, OU, SCAR, UT, TEX, TAMU, VAN
- Sun Belt: APP, ARST, CCU, GASO, GSU, JMU, JKST, ULM, UL, MRSH, ODU, USA, TXST, TROY

If the screenshot shows a DIFFERENT alignment (custom conferences / realignment year), use what the screenshot shows. Otherwise use the defaults above.

Per-line output (tab-separated, one field per conference column; blank if that column's conference has fewer teams than the current row number):
<ACC team>\\t<American team>\\t<Big 12 team>\\t<Big Ten team>\\t<Conf USA team>\\t<Indep team>\\t<MAC team>\\t<Mtn West team>\\t<Pac-12 team>\\t<SEC team>\\t<Sun Belt team>

Field format for every cell:
- Team abbreviation (strict dropdown) — UPPERCASE from the mapping at the bottom (e.g. BAMA, OSU, UGA). NEVER full names ("Alabama") or nicknames ("Crimson Tide").

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════
=== CONFERENCES — paste at cell A2 of "${currentDynasty?.currentYear || new Date().getFullYear()}" tab ===
<row 2: 11 tab-separated cells, one team per conference column>
<row 3: 11 tab-separated cells>
<row 4: 11 tab-separated cells>
...continue for up to 20 rows...

(Stop before row 21 if no conference has more teams to list. Shorter blocks allowed. Smaller conferences like Independent (3 teams) and Pac-12 (2 teams in the default) will have blank fields in later rows.)

═══════════════════════════════════════════════════════════
FINAL CHECK before you send
═══════════════════════════════════════════════════════════
[ ] Every line has the same number of tab-separated fields = number of conference columns in the sheet (default 11)
[ ] Conference column ORDER matches the header row in the sheet (default: ACC, American, Big 12, Big Ten, Conference USA, Independent, MAC, Mountain West, Pac-12, SEC, Sun Belt)
[ ] Every FBS team appears EXACTLY ONCE across the entire block (no duplicates)
[ ] Every team is placed in its correct conference column
[ ] All team values are UPPERCASE abbreviations from the mapping — no full names, no nicknames
[ ] Empty cells (two consecutive tabs) for conferences with fewer teams than the row index
[ ] No header row, no commas, no commentary INSIDE the data. The paste-target label above the fence is required (see TSV delivery rules above).`,
    includeTeamMap: true,
    dynastyTeams: currentDynasty?.teams,
  }), [currentDynasty?.currentYear, currentDynasty?.teams])

  // LOCAL-PASTE prompt: COMPLETE-DATA CONTRACT. Unlike the Google grid (a
  // fixed 11-column matrix the AI must align cell-by-cell), the local paste is
  // self-describing — each line LEADS with its conference name, one team per
  // line, so there is no column alignment for the AI to get wrong. The save is
  // a WHOLESALE REPLACE of the current year's alignment, so the paste MUST
  // list EVERY FBS team exactly once. `handleLocalImport` reshapes these
  // Conference<TAB>Team lines back into the header+column grid the EXISTING
  // parser (parseConferenceSheetData) consumes, then validateConferenceData
  // THROWS if any FBS team is missing or duplicated — an incomplete paste
  // errors out and never reaches the destructive save.
  const localAiPrompt = useMemo(() => buildAIPrompt({
    title: `Custom Conferences`,
    structure: `Assign EVERY FBS team to a conference. Output ONE line per team: the conference name, a TAB, then the team abbreviation. Each line is SELF-DESCRIBING (it leads with the conference), so there is NO fixed row order and NO column alignment to worry about.

═══════════════════════════════════════════════════════════
COMPLETE DATA IS REQUIRED — READ THIS FIRST
═══════════════════════════════════════════════════════════
This replaces the ENTIRE conference alignment for the current season, so the paste must be COMPLETE:
• EVERY FBS team must appear EXACTLY ONCE. Not a subset, not a screenshot of one conference — the WHOLE alignment.
• A team that is MISSING or listed TWICE will be REJECTED with an error and NOTHING will be saved. There is no partial import.
• If you are unsure which conference a team is in, use its real-world / default conference (listed below) — never drop a team.

═══════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════
1. Each line is EXACTLY 2 tab-separated fields: Conference<TAB>TeamAbbr.
2. Conference (field 1) is the conference NAME spelled exactly as one of: ACC, American, Big 12, Big Ten, Conference USA, Independent, MAC, Mountain West, Pac-12, SEC, Sun Belt (or a custom/renamed conference exactly as it appears in your screenshots).
3. TeamAbbr (field 2) is the team's UPPERCASE abbreviation from the mapping at the bottom — NEVER a full name or nickname.
4. One team per line. Every FBS team appears on exactly one line. No duplicates.
5. NO header row. NO blank lines. NO commas, no commentary, no totals.
6. Order does not matter — you may group by conference or list in any order, because each line names its own conference.

═══════════════════════════════════════════════════════════
DEFAULT CONFERENCE MEMBERSHIPS
═══════════════════════════════════════════════════════════
Use these unless a screenshot shows a different (custom / realigned) alignment. If a screenshot shows realignment, follow the screenshot — but still include EVERY team exactly once.
- ACC: BC, CAL, CLEM, DUKE, FSU, GT, LOU, MIA, NCST, UNC, PITT, SMU, SYR, STAN, UVA, VT, WAKE
- American: ARMY, CHAR, ECU, FAU, MEM, NAVY, UNT, RICE, TULN, TLSA, UAB, USF, UTSA
- Big 12: ARIZ, ASU, BU, BYU, UC, COLO, UH, ISU, KU, KSU, OKST, TCU, TTU, UCF, UTAH, WVU
- Big Ten: ILL, IU, IOWA, UMD, MICH, MSU, MINN, NEB, NU, OSU, ORE, PSU, PUR, RUTG, UCLA, USC, WASH, WIS
- Conference USA: FIU, KENN, LIB, LT, MTSU, NMSU, SHSU, UTEP, WKU
- Independent: ND, CONN, MASS
- MAC: AKR, BALL, BGSU, BUFF, CMU, EMU, KENT, M-OH, NIU, OHIO, TOL, WMU
- Mountain West: AFA, BOIS, CSU, FRES, HAW, NEV, SDSU, SJSU, UNLV, USU, WYO
- Pac-12: ORST, WSU
- SEC: BAMA, ARK, AUB, FLA, UGA, UK, LSU, MISS, MSST, MIZ, OU, SCAR, UT, TEX, TAMU, VAN
- Sun Belt: APP, ARST, CCU, GASO, GSU, JMU, JKST, ULM, UL, MRSH, ODU, USA, TXST, TROY

Every FBS team in the mapping at the bottom of this prompt must appear on exactly one output line.

═══════════════════════════════════════════════════════════
PER-LINE OUTPUT (2 tab-separated fields)
═══════════════════════════════════════════════════════════
<Conference><TAB><Team Abbr>

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════
=== CONFERENCES ===
SEC\\tBAMA
SEC\\tUGA
ACC\\tCLEM
…one line per team, EVERY FBS team exactly once…

═══════════════════════════════════════════════════════════
FINAL CHECK before you send
═══════════════════════════════════════════════════════════
[ ] Every line has exactly 2 tab-separated fields (one tab)
[ ] Field 1 is a conference name, field 2 is an UPPERCASE team abbreviation from the mapping
[ ] EVERY FBS team in the mapping appears — none missing
[ ] No team appears twice
[ ] No header row, no blank lines, no commentary, no commas`,
    includeTeamMap: true,
    dynastyTeams: currentDynasty?.teams,
  }), [currentDynasty?.teams])

  // Local paste import: the AI emits Conference<TAB>TeamAbbr, one team per
  // line. We reshape those pairs back into the header + per-column grid the
  // EXISTING parser (parseConferenceSheetData) reads — row 0 = conference
  // headers, then each column holds that conference's teams top-to-bottom.
  // readConferencesFromSheet(null, teams, { rows }) runs the SAME
  // parse + validate path as the Google flow, so a missing/duplicate team
  // throws in validateConferenceData and LocalDataEntry surfaces the toast —
  // the wholesale saveConferenceAlignment never runs on partial data.
  const handleLocalImport = async (text) => {
    const pairs = splitTsv(text)
    // Group teams by conference name (field 0), preserving first-seen order.
    const byConference = new Map()
    for (const row of pairs) {
      const conf = (row[0] || '').trim()
      const team = (row[1] || '').trim()
      if (!conf || !team) continue
      if (!byConference.has(conf)) byConference.set(conf, [])
      byConference.get(conf).push(team)
    }
    const confNames = [...byConference.keys()]
    // Build the header + column grid: row 0 = conference names, each
    // subsequent row holds one team per column (blank where a column is
    // shorter). This is the EXACT rows[][] shape the Sheets API returns.
    const gridRows = [confNames]
    const maxLen = Math.max(0, ...confNames.map(c => byConference.get(c).length))
    for (let r = 0; r < maxLen; r++) {
      gridRows.push(confNames.map(c => byConference.get(c)[r] ?? ''))
    }
    const conferences = await readConferencesFromSheet(null, (currentDynasty?.teams || currentDynasty?.customTeams), { rows: gridRows })
    await onSave(conferences)
    onClose()
  }

  // Pre-fill the local grid with the CURRENT YEAR's effective alignment.
  // handleLocalImport reads self-describing Conference<TAB>Team pairs (column
  // order: Conference, Team), reshapes them back into the header+column grid
  // parseConferenceSheetData consumes. getCustomConferencesForYear returns the
  // effective { conf: [teamAbbrs] } for the year (inheriting from a prior year
  // when the current one is unset), so emitting one line per team round-trips:
  // every FBS team appears exactly once (validateConferenceData passes) and the
  // parsed alignment matches. If there is no effective alignment, leave the
  // grid blank so the user starts from the default prompt.
  const initialText = useMemo(() => {
    try {
      const year = currentDynasty?.currentYear
      if (!year) return ''
      const effective = getCustomConferencesForYear(currentDynasty, year)
      if (!effective || typeof effective !== 'object') return ''
      const lines = []
      for (const [conference, teams] of Object.entries(effective)) {
        if (!conference || !Array.isArray(teams)) continue
        for (const team of teams) {
          if (!team) continue
          lines.push([conference, String(team).toUpperCase()].join('\t'))
        }
      }
      return lines.join('\n')
    } catch (err) {
      console.error('[ConferencesModal] Error building initialText:', err)
      return ''
    }
  }, [currentDynasty?.currentYear, currentDynasty?.customConferencesByYear, currentDynasty?.customConferences])

  // Ref to prevent concurrent sheet creation (state updates are async, refs are immediate)
  const creatingSheetRef = useRef(false)
  const creationAttemptedRef = useRef(false)
  const lastRetryCountRef = useRef(auth.retryCount)

  // Check for mobile on mount and resize
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

  // Get conference data for sheet creation - memoized to prevent recalculation on every render
  // Uses getCustomConferencesForYear which walks back through years automatically
  const conferenceData = useMemo(() => {
    try {
      const currentYear = currentDynasty?.currentYear
      if (!currentYear) return null

      // Get the effective conferences for the current year (may be inherited from previous year)
      const effectiveConferences = getCustomConferencesForYear(currentDynasty, currentYear)
      if (!effectiveConferences) return null

      // Return as year-keyed object for sheet creation
      // Include all historical years plus current year with effective data
      const byYear = currentDynasty?.customConferencesByYear || {}
      return { ...byYear, [currentYear]: effectiveConferences }
    } catch (error) {
      console.error('[ConferencesModal] Error getting conference data:', error)
      return null
    }
  }, [currentDynasty?.currentYear, currentDynasty?.customConferencesByYear, currentDynasty?.customConferences])

  const getConferencesForSheet = () => conferenceData
  const hasExistingConferences = !!conferenceData

  // Dark theme modal colors
  const modalColors = useMemo(() => getModalColors(teamColors), [teamColors])

  // Create Conferences sheet when modal opens
  useEffect(() => {
    if (auth.retryCount !== lastRetryCountRef.current) {
      lastRetryCountRef.current = auth.retryCount
      creationAttemptedRef.current = false
    }

    const createSheet = async () => {
      // Don't create a Google Sheet while the local paste path is active.
      if (isOpen && !useLocal && user && !sheetId && !creatingSheet && !creatingSheetRef.current && !showDeletedNote && !creationAttemptedRef.current) {
        // Get saved conferences data
        const conferencesByYear = getConferencesForSheet()

        // Check if we have an existing conferences sheet
        const existingSheetId = currentDynasty?.conferencesSheetId
        if (existingSheetId) {
          // If we have saved custom conferences, delete old sheet and create fresh
          // This ensures the sheet always reflects the latest saved data
          if (conferencesByYear) {
            try {
              await deleteGoogleSheet(existingSheetId)
              await updateDynasty(currentDynasty.id, { conferencesSheetId: null, conferencesSheetUrl: null })
            } catch (e) {
              console.log('Could not delete old conferences sheet, creating new one anyway')
            }
          } else {
            // No saved conferences, just use existing sheet
            const stillExists = await sheetExists(existingSheetId)
            if (stillExists) {
              setSheetId(existingSheetId)
              return
            }
            await updateDynasty(currentDynasty.id, { conferencesSheetId: null, conferencesSheetUrl: null })
            // stale sheet (trashed in Drive); fall through to regenerate
          }
        }

        // Set ref immediately to prevent concurrent calls (state updates are async)
        creationAttemptedRef.current = true
        creatingSheetRef.current = true
        setCreatingSheet(true)
        try {
          // Pass all years' custom conferences if available
          const sheetInfo = await createConferencesSheet(
            currentDynasty?.teamName || 'Dynasty',
            currentDynasty?.currentYear || new Date().getFullYear(),
            conferencesByYear,
            currentDynasty?.teams || currentDynasty?.customTeams
          )
          setSheetId(sheetInfo.spreadsheetId)

          // Save sheet ID to dynasty
          await updateDynasty(currentDynasty.id, {
            conferencesSheetId: sheetInfo.spreadsheetId,
            conferencesSheetUrl: sheetInfo.spreadsheetUrl
          })
        } catch (error) {
          console.error('Failed to create conferences sheet:', error)
          // Without this branch the OAuth-expired case silently failed:
          // the modal flipped out of "creating…" with no toast and no
          // re-auth prompt. Route through auth.handleError so the
          // AuthErrorModal fires; fall back to a toast for anything
          // else so the user knows the save didn't go through.
          if (!auth.handleError(error)) {
            toast.error('Failed to create the conferences sheet. Try again or contact support.')
          }
        } finally {
          setCreatingSheet(false)
          creatingSheetRef.current = false
        }
      }
    }

    createSheet()
  }, [isOpen, useLocal, user, sheetId, currentDynasty?.id, auth.retryCount, showDeletedNote])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDeletedNote(false)
      creatingSheetRef.current = false
      creationAttemptedRef.current = false
      setUseLocal(true)
    }
  }, [isOpen])

  const handleSyncFromSheet = async () => {
    if (!sheetId) return

    setSyncing(true)
    try {
      const conferences = await readConferencesFromSheet(sheetId, (currentDynasty?.teams || currentDynasty?.customTeams))
      await onSave(conferences)
      onClose()
    } catch (error) {
      console.error(error)
      if (!auth.handleError(error)) {
        toast.error('Failed to sync from Google Sheets.')
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAndDelete = async () => {
    if (!sheetId) return

    setDeletingSheet(true)
    try {
      const conferences = await readConferencesFromSheet(sheetId, (currentDynasty?.teams || currentDynasty?.customTeams))
      await onSave(conferences)

      await deleteGoogleSheet(sheetId)
      await updateDynasty(currentDynasty.id, { conferencesSheetId: null, conferencesSheetUrl: null })

      setSheetId(null)
      setShowDeletedNote(true)
      setTimeout(() => {
        onClose()
      }, 2500)
    } catch (error) {
      console.error('Failed to sync/move to trash:', error)
      if (!auth.handleError(error)) {
        toast.error(`Failed to sync/move to trash: ${error.message || 'Unknown error'}`)
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
      await updateDynasty(currentDynasty.id, { conferencesSheetId: null, conferencesSheetUrl: null })
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
      title: 'Delete this conferences sheet?',
      message: 'This deletes the Google Sheet without applying any edits. Your dynasty conference alignments stay as-is.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingSheet(true)
    try {
      await deleteGoogleSheet(sheetId)
      await updateDynasty(currentDynasty.id, { conferencesSheetId: null, conferencesSheetUrl: null })
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

  // Don't specify sheet name - let user see all year tabs
  const embedUrl = sheetId ? getSheetEmbedUrl(sheetId) : null
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
        <SheetModalHeader eyebrow="Realignment" title="Custom Conferences" onClose={handleClose} />

        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
        {useLocal && !showDeletedNote ? (
          <LocalDataEntry
            aiPrompt={localAiPrompt}
            onImport={handleLocalImport}
            onUseGoogle={() => setUseLocal(false)}
            onCancel={handleClose}
            importLabel="Import Conferences"
            columns={['Conference', 'Team']}
            initialText={initialText}
            instructions={`This replaces the COMPLETE conference alignment for the current season. It is the WHOLE grid, not a partial screenshot of one conference. Screenshot every conference's full team list (or all of them at once), upload the shots with the copied prompt to your AI, and it returns a TSV listing every team and its conference. Paste that below. If any FBS team is missing or duplicated, the import is rejected and nothing is saved.`}
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
                Creating Conferences Sheet...
              </p>
              <p className="text-sm mt-2 text-txt-secondary">
                {hasExistingConferences
                  ? 'Loading your saved conference alignment'
                  : 'Setting up default EA CFB 26 conference alignment'}
              </p>
              <SheetLoadingHint active={isLoading} />
            </div>
          </div>
        ) : showDeletedNote ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="card p-8 text-center max-w-sm">
              <p className="label-xs text-txt-tertiary mb-2">Status</p>
              <p className="text-xl font-bold text-txt-primary mb-2">Saved &amp; Moved to Trash</p>
              <p className="text-sm text-txt-secondary">Conference alignment saved to your dynasty.</p>
            </div>
          </div>
        ) : sheetId ? (
          <div className="flex-1 flex flex-col overflow-hidden gap-3">
            <SheetModalAIHero
              tagline="Skip the typing. Let AI fill the conferences."
              buttons={[{ label: 'Copy AI Prompt', prompt: aiPrompt }]}
            />
            {isMobile || !useEmbedded ? (
              <SheetManualEntry sheetId={sheetId} />
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 border border-surface-4 rounded-lg">
                <SheetToolbar sheetId={sheetId} embedUrl={embedUrl} teamColors={teamColors} title="Custom Conferences" />
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
        ) : null}
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
