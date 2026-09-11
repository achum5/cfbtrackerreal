import { useState, useEffect, useRef, useMemo } from 'react'
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
  createPortalTransferClassSheet,
  readPortalTransferClassFromSheet,
  deleteGoogleSheet,
  getSheetEmbedUrl,
  sheetExists
} from '../services/sheetsService'
import { getModalColors } from '../utils/colorUtils'
import { buildAIPrompt } from '../utils/aiPrompt'
import SheetLoadingHint from './SheetLoadingHint'
import LocalDataEntry from './ui/LocalDataEntry'
import { splitTsv } from '../utils/tsvParse'
import { getPortalTransferClassOptions, getPortalTransferDefaultClass } from '../utils/transferClassOptions'

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export default function PortalTransferClassModal({ isOpen, onClose, onSave, currentYear, teamColors, portalTransfers }) {
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
  // bumps auth.retryCount, which resets the flags below) re-arms one more.
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

  const aiPrompt = useMemo(() => {
    // Must match the sort order used in createPortalTransferClassSheet so the
    // row numbers in this prompt align with the actual sheet rows.
    const POSITION_ORDER = [
      'QB','HB','FB','WR','TE',
      'LT','LG','C','RG','RT','OT','OG',
      'LE','RE','LEDG','REDG','EDGE','DT',
      'LOLB','MLB','ROLB','SAM','MIKE','WILL','OLB','LB',
      'CB','FS','SS','S','K','P',
    ]
    const sortedTransfers = [...(portalTransfers || [])].sort((a, b) => {
      const ai = POSITION_ORDER.indexOf(a.position)
      const bi = POSITION_ORDER.indexOf(b.position)
      const posA = ai !== -1 ? ai : 999
      const posB = bi !== -1 ? bi : 999
      if (posA !== posB) return posA - posB
      return (a.name || '').localeCompare(b.name || '')
    })

    const playerRows = sortedTransfers.length === 0
      ? '  (no portal transfers)'
      : sortedTransfers.map((t, i) =>
          `  Row ${i + 2}: ${t.name} ${t.position}`
        ).join('\n')

    const n = sortedTransfers.length

    return buildAIPrompt({
      title: `${currentYear} Portal Transfer Class Assignment`,
      structure: `This sheet has ONE tab: "Portal Transfers". It has 4 columns: A = Player, B = Position, C = "${currentYear} Recruitment Class", D = "Updated ${currentYear + 1} Class". Row 1 is the protected header row. Columns A, B, C are PRE-FILLED and PROTECTED — do NOT output them. Column D is the only editable column.

═══════════════════════════════════════════════════════════
YOUR JOB: ONE VALUE PER PLAYER — THE UPDATED CLASS
═══════════════════════════════════════════════════════════
For each player listed below, find their name in the roster screenshots and
read the YEAR column value, then translate it using this mapping for column D:

     Game shows → Output
     FR         → Fr
     FR(RS)     → RS Fr
     SO         → So
     SO(RS)     → RS So
     JR         → Jr
     JR(RS)     → RS Jr
     SR         → Sr
     SR(RS)     → RS Sr

BLANK if you can't see it for that player — do NOT guess. A blank line still
holds that player's row slot.

No other logic. No redshirt calculations. Just read what's on screen.

═══════════════════════════════════════════════════════════
THE EXACT PLAYERS IN THE SHEET — in sheet row order
═══════════════════════════════════════════════════════════
${playerRows}

═══════════════════════════════════════════════════════════
CRITICAL OUTPUT RULES
═══════════════════════════════════════════════════════════
1. Output ONLY column D — one player per line, ONE value per line, NO tabs.
2. Output EXACTLY ${n} line${n !== 1 ? 's' : ''} in the order above. Do not add or remove lines.
3. Exact casing: "Fr", "So", "Jr", "Sr", "RS Fr", "RS So", "RS Jr", "RS Sr" — one space between "RS" and the class. NOT "RSFr", NOT "Rs Fr".
4. A blank is fine — if you can't see a player's class, emit an EMPTY line so every later player stays on their own row.
5. Do NOT output jersey numbers or any other column.
6. No header row, no commentary INSIDE the data.

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════
=== PORTAL TRANSFERS ===
<class for Row 2 player>
<class for Row 3 player>
…exactly ${n} line${n !== 1 ? 's' : ''}

═══════════════════════════════════════════════════════════
FINAL CHECK before you send
═══════════════════════════════════════════════════════════
[ ] Exactly ${n} line${n !== 1 ? 's' : ''} — one per player listed above
[ ] One value per line, no tabs, no extra columns
[ ] Every non-blank class is a direct translation of the YEAR column from the screenshots or video
[ ] Exact casing: "RS Fr" not "RSFr" or "Rs Fr"
[ ] No jersey numbers, no commentary INSIDE the data`,
    })
  }, [currentYear, portalTransfers])

  // LOCAL-PASTE prompt: self-describing rows, no pre-filled column to align
  // against. The AI emits ONE line per portal transfer, as
  // PlayerName<TAB>Class — so a paste carries its own identity and the save
  // matches by name (omitted players are unchanged).
  const localAiPrompt = useMemo(() => buildAIPrompt({
    title: `${currentYear} Portal Transfer Class Assignment`,
    // The portal class for the year is already entered — these are exactly
    // the players whose class is in question. Without the list the model has
    // to infer the transfers from a roster screen that carries no transfer
    // indicator, which is not something a screenshot can answer.
    targets: (portalTransfers || []).map(t => ({
      name: t.name,
      position: t.position,
      class: t.incomingClass,
      jerseyNumber: t.jerseyNumber,
    })),
    targetsLabel: `THE PORTAL TRANSFERS TO ASSIGN A ${currentYear + 1} CLASS`,
    targetsNote: `The class shown in parentheses after each name is their ${currentYear} class as the app has it — the value you are UPDATING, not the answer.`,
    structure: `Output ONE line per portal transfer whose updated ${currentYear + 1} class you can read. Each line is SELF-DESCRIBING — it carries the player's own name — so there is NO pre-filled column to line up against and NO fixed row order.

For each portal transfer, read the YEAR column value from the roster
screenshots and translate it using this mapping:

     Game shows → Output
     FR         → Fr
     FR(RS)     → RS Fr
     SO         → So
     SO(RS)     → RS So
     JR         → Jr
     JR(RS)     → RS Jr
     SR         → Sr
     SR(RS)     → RS Sr

═══════════════════════════════════════════════════════════
CRITICAL RULES — read before anything else
═══════════════════════════════════════════════════════════
1. Each line has EXACTLY 2 tab-separated fields: PlayerName<TAB>Class.
2. NO header row. NO blank lines. NO commentary, totals, or labels INSIDE the data.
3. OMIT any portal transfer whose class you cannot read — do NOT pad, do NOT guess. A player with no line is left unchanged.
4. The order does not matter — each line stands on its own.
5. PlayerName: the full player name exactly as it should appear.
6. Class MUST be one of these EXACT strings: Fr | So | Jr | Sr | RS Fr | RS So | RS Jr | RS Sr — Title Case, "RS" uppercase, exactly one space. NOT "RSFr", NOT "Rs Fr".
7. Do NOT output jersey numbers or any other column.

═══════════════════════════════════════════════════════════
PER-LINE OUTPUT (2 tab-separated fields)
═══════════════════════════════════════════════════════════
<Player Name><TAB><Class>

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════
=== PORTAL TRANSFERS ===
<Player Name>\\t<Class>
<Player Name>\\t<Class>
…one line per portal transfer; omit any you cannot read

(Each \\t represents a LITERAL TAB character — use actual tabs, not the text "\\t".)

═══════════════════════════════════════════════════════════
FINAL CHECK before you send
═══════════════════════════════════════════════════════════
[ ] Every line has exactly 2 tab-separated fields (one tab)
[ ] Every Class value is one of: Fr, So, Jr, Sr, RS Fr, RS So, RS Jr, RS Sr (exact casing, single space)
[ ] No jersey numbers, no extra columns
[ ] Every name is one from the list above — no extra players
[ ] No blank lines, no header row, no commentary INSIDE the data`,
  }), [currentYear, portalTransfers])

  // Pre-fill the local grid with each portal transfer's existing class so the
  // modal opens ready to edit. The local import reshapes each pasted row as
  // [name, '', '', class, ''], and the parser requires a name and a class — so
  // we emit "PlayerName<TAB>Class" per transfer. Jersey numbers are NOT part
  // of this screen: the third column pushed the table wider than the modal on
  // a phone, and a portal transfer's number is entered on the player anyway.
  // Prefer any already-saved selection for this year; otherwise fall back to
  // the transfer's incoming class (the same value the Google sheet pre-fills).
  // Round-trip safe: re-importing unchanged reproduces the saved selections.
  // The `currentYear` prop is ALREADY the data year — Dashboard passes
  // offseasonDataYear, which has applied the post-Signing-Day flip
  // adjustment, and handlePortalTransferClassSave saves under that same
  // year. Adjusting a second time here read portalTransferClassByYear one
  // season too early, so saved class selections never round-tripped and a
  // re-import silently reverted the user's corrections.
  // The same per-row dropdown the sheet enforces: a transfer's options depend
  // on the class they came in as, so the grid resolves that from the player's
  // NAME in the first cell rather than offering all eight classes.
  const localColumnOptions = useMemo(() => {
    const classByName = new Map(
      (portalTransfers || [])
        .filter(t => t?.name)
        .map(t => [t.name.toLowerCase().trim(), t.incomingClass]),
    )
    return {
      Class: (row) => getPortalTransferClassOptions(
        classByName.get(String(row?.[0] ?? '').toLowerCase().trim()),
      ),
    }
  }, [portalTransfers])

  const initialText = useMemo(() => {
    const dataYear = Number(currentYear)
    const saved = currentDynasty?.portalTransferClassByYear?.[dataYear] || []
    const savedByName = new Map()
    for (const s of saved) {
      if (s?.playerName) savedByName.set(s.playerName.toLowerCase().trim(), s)
    }
    return (portalTransfers || [])
      .map(t => {
        if (!t.name) return null
        const match = savedByName.get((t.name || '').toLowerCase().trim())
        // A saved answer wins; otherwise pre-select the normal progression —
        // never the incoming class, which is not one of the legal options and
        // would save as "no progression at all" if imported untouched.
        const cls = match?.selectedClass || getPortalTransferDefaultClass(t.incomingClass)
        return `${t.name}\t${cls}`
      })
      .filter(Boolean)
      .join('\n')
  }, [portalTransfers, currentDynasty?.portalTransferClassByYear, currentDynasty?.currentPhase, currentDynasty?.currentWeek, currentYear])

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

  // Year-specific sheet key (like recruiting sheets) for proper persistence
  const sheetKey = `portalTransferClassSheetId_${currentYear}`

  // Create portal transfer class sheet when modal opens
  useEffect(() => {
    const createSheet = async () => {
      if (authErrorOccurred || createAttempts >= MAX_CREATE_ATTEMPTS) return
      // Don't create a Google Sheet while the local paste path is active.
      if (isOpen && !useLocal && user && !sheetId && !creatingSheet && !creatingSheetRef.current && !showDeletedNote) {
        // Set ref immediately to prevent concurrent calls (state updates are async)
        creatingSheetRef.current = true
        setCreatingSheet(true)
        try {
          // Check if we have an existing sheet for this year
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

          const sheetInfo = await createPortalTransferClassSheet(
            currentDynasty?.teamName || 'Dynasty',
            currentYear,
            portalTransfers || []
          )
          setSheetId(sheetInfo.spreadsheetId)

          // Save sheet ID to dynasty with year-specific key
          await updateDynasty(currentDynasty.id, {
            [sheetKey]: sheetInfo.spreadsheetId
          })
        } catch (error) {
          console.error('Failed to create portal transfer class sheet:', error)
          setCreateAttempts(prev => prev + 1)
          // Auth errors open the re-auth modal. Anything else gets surfaced as
          // a toast so the user isn't stuck — and the effect does NOT loop back
          // to create another sheet.
          if (auth.handleError(error)) {
            setAuthErrorOccurred(true)
          } else {
            toast.error(auth.describeError(error, 'create the portal transfer class sheet'))
          }
        } finally {
          setCreatingSheet(false)
          creatingSheetRef.current = false
        }
      }
    }

    createSheet()
  }, [isOpen, useLocal, user, sheetId, creatingSheet, currentDynasty?.id, auth.retryCount, showDeletedNote, portalTransfers, currentYear, sheetKey, authErrorOccurred, createAttempts])

  // When the user re-authenticates (retryCount bumps via the AuthErrorModal's
  // Refresh), clear the blocking flags so the create effect retries with the
  // fresh token — otherwise authErrorOccurred stays true and the modal is stuck
  // until the user manually closes and reopens it.
  useEffect(() => {
    if (auth.retryCount > 0) {
      setAuthErrorOccurred(false)
      setCreateAttempts(0)
    }
  }, [auth.retryCount])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDeletedNote(false)
      setCreateAttempts(0)
      setAuthErrorOccurred(false)
      creatingSheetRef.current = false
      setUseLocal(true)
    }
  }, [isOpen])

  // Local paste import: the AI emits PlayerName<TAB>Class rows. The parser
  // reads name=row[0], class=row[3], jersey=row[4], so reshape each pasted
  // [name, class] pair into the parser's 5-column layout with the jersey slot
  // left blank — blank parses to null and the save then leaves the player's
  // existing number alone.
  // Downstream save matches by name, so omitting unchanged players is correct.
  const handleLocalImport = async (text) => {
    const rows = splitTsv(text).map(c => [c[0], '', '', (c[1] ?? ''), ''])
    const classSelections = await readPortalTransferClassFromSheet(null, (currentDynasty?.teams || currentDynasty?.customTeams), { rows })
    await onSave(classSelections)
    onClose()
  }

  const handleSyncFromSheet = async () => {
    if (!sheetId) return

    setSyncing(true)
    try {
      const classSelections = await readPortalTransferClassFromSheet(sheetId, (currentDynasty?.teams || currentDynasty?.customTeams))
      await onSave(classSelections)
      onClose()
    } catch (error) {
      console.error(error)
      if (!auth.handleError(error)) {
        toast.error('Failed to sync from Google Sheets. Make sure all players have a class selected.')
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAndDelete = async () => {
    if (!sheetId) return

    setDeletingSheet(true)
    try {
      const classSelections = await readPortalTransferClassFromSheet(sheetId, (currentDynasty?.teams || currentDynasty?.customTeams))
      await onSave(classSelections)

      // Move sheet to trash
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
      title: 'Delete this portal transfer class sheet?',
      message: 'This deletes the Google Sheet without applying any edits. Your dynasty portal transfer class assignments stay as-is.',
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

  const embedUrl = sheetId ? getSheetEmbedUrl(sheetId, 'Portal Transfers') : null
  const isLoading = creatingSheet

  return (
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
        <SheetModalHeader eyebrow="Transfer Portal" title="Portal Transfer Class" onClose={handleClose} />
        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">

        {useLocal && !showDeletedNote ? (
          <LocalDataEntry
            aiPrompt={localAiPrompt}
            onImport={handleLocalImport}
            onUseGoogle={() => setUseLocal(false)}
            onCancel={handleClose}
            importLabel="Import Portal Transfer Classes"
            columns={['Player', 'Class']}
            columnOptions={localColumnOptions}
            initialText={initialText}
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
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Creating Portal Transfer Class Sheet...
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                Pre-filling portal transfers with class options
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
                Saved & Moved to Trash!
              </p>
              <p className="text-sm" style={{ color: modalColors.background, opacity: 0.9 }}>
                Portal transfer classes have been assigned.
              </p>
            </div>
          </div>
        ) : sheetId ? (
          <div className="flex-1 flex flex-col overflow-hidden gap-3">
            <SheetModalAIHero
              tagline="Skip the typing. Let AI fill the transfer portal class."
              buttons={[{ label: 'Copy AI Prompt', prompt: aiPrompt }]}
            />
            {isMobile || !useEmbedded ? (
              <SheetManualEntry sheetId={sheetId} />
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 border border-surface-4 rounded-lg">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  title="Portal Transfer Class Sheet"
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
            <p style={{ color: 'var(--text-primary)' }}>Failed to create sheet. Please try again.</p>
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
    </div>
  )
}
