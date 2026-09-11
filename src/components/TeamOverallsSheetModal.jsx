import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty, getTeamRatingsForYear } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { getTeamNameOptions, getTeamNameAliases, TEAMS } from '../data/teamRegistry'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import SheetModalHeader from './ui/SheetModalHeader'
import SheetModalAIHero from './ui/SheetModalAIHero'
import SheetManualEntry from './ui/SheetManualEntry'
import SheetModalFooter from './ui/SheetModalFooter'
import SheetLoadingHint from './SheetLoadingHint'
import AuthErrorModal from './AuthErrorModal'
import { useAuthErrorHandler } from '../hooks/useAuthErrorHandler'
import LocalDataEntry from './ui/LocalDataEntry'
import { buildAIPrompt } from '../utils/aiPrompt'
import { splitTsv } from '../utils/tsvParse'
import { teamOverallRows, parseTeamOverallRows } from '../utils/teamOverallsRows'
import {
  createTeamOverallsSheet,
  readTeamOverallsFromSheet,
  deleteGoogleSheet,
  getSheetEmbedUrl,
  sheetExists,
} from '../services/sheetsService'
import { getModalColors } from '../utils/colorUtils'

/**
 * TeamOverallsSheetModal — every school's OVR / OFF / DEF for one season, from
 * the preseason to-do "Enter All Team Overalls".
 *
 * This used to be 138 schools of hand-typed number boxes, the longest piece of
 * manual entry left in the app. It is now the same Copy Prompt → AI → Paste
 * grid every other data-entry to-do uses, with the same Google Sheets fallback
 * behind it — both paths pre-filled with what is already stored, both writing
 * only the teams whose ratings actually changed.
 */
const COLUMNS = ['Team', 'OVR', 'OFF', 'DEF']

const INSTRUCTIONS = `Screenshot the in-game team list showing each school's ratings — the Teams screen, or team rankings, wherever OVR / OFF / DEF are visible. Scroll through and capture them all; a screen recording works too. Upload that along with the copied prompt to your AI platform of choice. It will return a TSV output — copy that, then paste it below.`

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export default function TeamOverallsSheetModal({ isOpen, onClose, year, teamColors }) {
  const { currentDynasty, saveAllTeamRatings, updateDynasty, isViewOnly } = useDynasty()
  const { user } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const modalColors = useMemo(() => getModalColors(teamColors), [teamColors])
  const auth = useAuthErrorHandler()

  const [saving, setSaving] = useState(false)
  // Local paste is the DEFAULT; the Google Sheet flow is the opt-in fallback.
  const [useLocal, setUseLocal] = useState(true)
  const [sheetId, setSheetId] = useState(null)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showDeletedNote, setShowDeletedNote] = useState(false)
  const [highlightSave, setHighlightSave] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [useEmbedded, setUseEmbedded] = useState(() => localStorage.getItem('sheetEmbedPreference') === 'true')

  const creatingSheetRef = useRef(false)
  const creationAttemptedRef = useRef(false)
  const lastRetryCountRef = useRef(auth.retryCount)

  const teamsSource = currentDynasty?.teams || TEAMS
  const sheetKey = `teamOverallsSheetId_${year}`

  // Ratings already stored for the season — used to pre-fill both paths and,
  // on import, to work out which teams actually changed.
  const ratingsFor = useMemo(() => (tid) => (
    (currentDynasty ? getTeamRatingsForYear(currentDynasty, tid, year) : null) || {}
  ), [currentDynasty, year])

  const rows = useMemo(
    () => (isOpen ? teamOverallRows(teamsSource, ratingsFor) : []),
    [isOpen, teamsSource, ratingsFor],
  )
  const initialText = useMemo(() => rows.map(r => r.cells.join('\t')).join('\n'), [rows])
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

  // Both paths funnel through here, so a team name resolves and a rating
  // validates the same way whichever one the user picked.
  const applyRows = async (parsedRows, { closeAfter = true } = {}) => {
    const { changed, unmatched } = parseTeamOverallRows(parsedRows, teamsSource, ratingsFor)
    const count = Object.keys(changed).length
    if (unmatched.length > 0) {
      // Named, not counted: the user needs to know WHICH school to fix.
      const shown = unmatched.slice(0, 5).join(', ')
      toast.error(
        `Could not match ${unmatched.length} team name${unmatched.length === 1 ? '' : 's'}: ` +
        `${shown}${unmatched.length > 5 ? '…' : ''}. Fix ${unmatched.length === 1 ? 'it' : 'them'} and try again.`,
      )
      return false
    }
    if (count === 0) {
      toast.success('No rating changes to save.')
      if (closeAfter) onClose()
      return true
    }
    const result = await saveAllTeamRatings(currentDynasty.id, year, changed)
    toast.success(`Saved ratings for ${result?.saved ?? count} team${count === 1 ? '' : 's'}.`)
    if (closeAfter) onClose()
    return true
  }

  const handleLocalImport = async (text) => {
    setSaving(true)
    try {
      await applyRows(splitTsv(text))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    setIsMobile(isMobileDevice())
    const onResize = () => setIsMobile(isMobileDevice())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Nudge the save button when the user comes back from the sheet.
  useEffect(() => {
    if (!isOpen || !sheetId || useEmbedded) return
    const flash = () => { setHighlightSave(true); setTimeout(() => setHighlightSave(false), 5000) }
    const onVisibility = () => { if (document.visibilityState === 'visible') flash() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', flash)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', flash)
    }
  }, [isOpen, sheetId, useEmbedded])

  // Create the sheet only once the user opts into the Google path.
  useEffect(() => {
    if (auth.retryCount !== lastRetryCountRef.current) {
      lastRetryCountRef.current = auth.retryCount
      creationAttemptedRef.current = false
    }
    const createSheet = async () => {
      if (!(isOpen && !useLocal && user && !sheetId && !creatingSheet && !creatingSheetRef.current
            && !showDeletedNote && !creationAttemptedRef.current)) return
      creationAttemptedRef.current = true
      creatingSheetRef.current = true
      setCreatingSheet(true)
      try {
        const existingSheetId = currentDynasty?.[sheetKey]
        if (existingSheetId) {
          if (await sheetExists(existingSheetId)) {
            setSheetId(existingSheetId)
            return
          }
          await updateDynasty(currentDynasty.id, { [sheetKey]: null })
          // stale sheet (trashed in Drive); fall through to regenerate
        }
        const sheetInfo = await createTeamOverallsSheet(
          currentDynasty?.teamName || 'Dynasty',
          year,
          rows.map(r => ({
            team: r.cells[0], overall: r.cells[1], offense: r.cells[2], defense: r.cells[3],
          })),
        )
        setSheetId(sheetInfo.spreadsheetId)
        await updateDynasty(currentDynasty.id, { [sheetKey]: sheetInfo.spreadsheetId })
      } catch (error) {
        console.error('Failed to create team overalls sheet:', error)
        if (!auth.handleError(error)) toast.error('Failed to create the team overalls sheet. Try again.')
      } finally {
        setCreatingSheet(false)
        creatingSheetRef.current = false
      }
    }
    createSheet()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, useLocal, user, sheetId, creatingSheet, currentDynasty?.id, auth.retryCount, showDeletedNote, year, sheetKey])

  useEffect(() => {
    if (!isOpen) {
      setShowDeletedNote(false)
      creatingSheetRef.current = false
      creationAttemptedRef.current = false
      setUseLocal(true)
    }
  }, [isOpen])

  const syncFromSheet = async ({ thenDelete = false } = {}) => {
    if (!sheetId) return
    const setBusy = thenDelete ? setDeletingSheet : setSyncing
    setBusy(true)
    try {
      const applied = await applyRows(await readTeamOverallsFromSheet(sheetId), { closeAfter: !thenDelete })
      if (!applied || !thenDelete) return
      await deleteGoogleSheet(sheetId)
      await updateDynasty(currentDynasty.id, { [sheetKey]: null })
      setSheetId(null)
      setShowDeletedNote(true)
      setTimeout(() => onClose(), 2500)
    } catch (error) {
      console.error('Team overalls sheet sync failed:', error)
      if (!auth.handleError(error)) toast.error('Failed to sync from Google Sheets. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerateSheet = async () => {
    if (!sheetId) return
    const ok = await confirm({
      title: 'Regenerate sheet?',
      message: 'This will delete your current sheet and create a fresh one. Any unsaved data will be lost.',
      confirmLabel: 'Regenerate',
      variant: 'danger',
    })
    if (!ok) return
    setRegenerating(true)
    try {
      await deleteGoogleSheet(sheetId)
      await updateDynasty(currentDynasty.id, { [sheetKey]: null })
      setSheetId(null)
      auth.retry()
    } catch (error) {
      console.error('Failed to regenerate sheet:', error)
      if (!auth.handleError(error)) toast.error('Failed to regenerate sheet. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleDeleteSheetOnly = async () => {
    if (!sheetId || !currentDynasty) return
    const ok = await confirm({
      title: 'Delete this team overalls sheet?',
      message: 'This deletes the Google Sheet without applying any edits. Your saved team ratings stay as-is.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingSheet(true)
    try {
      await deleteGoogleSheet(sheetId)
      await updateDynasty(currentDynasty.id, { [sheetKey]: null })
      setSheetId(null)
      setShowDeletedNote(true)
      setTimeout(() => onClose(), 1800)
    } catch (error) {
      console.error('Failed to delete sheet:', error)
      if (!auth.handleError(error)) toast.error('Failed to delete the sheet. Try again.')
    } finally {
      setDeletingSheet(false)
    }
  }

  if (!isOpen || !currentDynasty) return null

  const embedUrl = sheetId ? getSheetEmbedUrl(sheetId, 'Team Overalls') : null
  const isLoading = creatingSheet

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] py-8 px-4 sm:p-4"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className={`card-elevated w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden ${
          useEmbedded ? 'sm:w-[95vw] sm:h-[95dvh]' : 'sm:max-w-[680px] sm:h-auto'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SheetModalHeader eyebrow="Preseason" title={`Team Overalls — ${year}`} onClose={onClose} />
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
          {useLocal && !showDeletedNote ? (
            <LocalDataEntry
              aiPrompt={aiPrompt}
              onImport={handleLocalImport}
              onUseGoogle={() => setUseLocal(false)}
              onCancel={onClose}
              importLabel="Import Team Overalls"
              instructions={INSTRUCTIONS}
              columns={COLUMNS}
              comboboxColumns={{ Team: teamNames }}
              comboboxAliases={getTeamNameAliases(teamsSource)}
              initialText={initialText}
              busy={saving || isViewOnly}
            />
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div
                  className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
                  style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}
                />
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Creating Team Overalls Sheet...
                </p>
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  Pre-filling every FBS team with its saved ratings
                </p>
                <SheetLoadingHint active={isLoading} />
              </div>
            </div>
          ) : showDeletedNote ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 rounded-lg" style={{ backgroundColor: 'var(--text-primary)' }}>
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke={modalColors.background} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xl font-bold mb-2" style={{ color: modalColors.background }}>
                  Saved &amp; Moved to Trash!
                </p>
                <p className="text-sm" style={{ color: modalColors.background, opacity: 0.9 }}>
                  Team ratings have been saved.
                </p>
              </div>
            </div>
          ) : sheetId ? (
            <div className="flex-1 flex flex-col overflow-hidden gap-3">
              <SheetModalAIHero
                tagline="Skip the typing. Let AI fill in every team's ratings."
                buttons={[{ label: 'Copy AI Prompt', prompt: aiPrompt }]}
              />
              {isMobile || !useEmbedded ? (
                <SheetManualEntry sheetId={sheetId} />
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 border border-surface-4 rounded-lg">
                  <iframe src={embedUrl} className="w-full h-full" title="Team Overalls Sheet" />
                </div>
              )}
              <SheetModalFooter
                syncing={syncing}
                deletingSheet={deletingSheet}
                regenerating={regenerating}
                highlightSave={highlightSave}
                onSaveAndDelete={() => syncFromSheet({ thenDelete: true })}
                onSaveAndKeep={() => syncFromSheet()}
                onDeleteSheetOnly={handleDeleteSheetOnly}
                onRegenerate={handleRegenerateSheet}
                showEmbeddedToggle={!isMobile}
                useEmbedded={useEmbedded}
                onToggleEmbedded={() => {
                  const next = !useEmbedded
                  setUseEmbedded(next)
                  localStorage.setItem('sheetEmbedPreference', next.toString())
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p style={{ color: 'var(--text-primary)' }}>Failed to create sheet. Please try again.</p>
            </div>
          )}
        </div>
      </div>

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
