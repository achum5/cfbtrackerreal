import { useState, useEffect, useRef } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import AuthErrorModal from './AuthErrorModal'
import SheetToolbar from './SheetToolbar'
import {
  createDetailedStatsSheet,
  readDetailedStatsFromSheet,
  deleteGoogleSheet,
  getSheetEmbedUrl
} from '../services/sheetsService'
import { aggregatePlayerBoxScoreStats } from '../utils/boxScoreAggregator'

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export default function DetailedStatsEntryModal({
  isOpen,
  onClose,
  onSave,
  currentYear,
  teamColors,
  // Optional props for team override (used by TeamStats page)
  teamAbbr: overrideTeamAbbr,
  teamName: overrideTeamName
}) {
  const { currentDynasty } = useDynasty()
  const { user, signOut, refreshSession } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [showDeletedNote, setShowDeletedNote] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [showAuthError, setShowAuthError] = useState(false)
  const [authErrorOccurred, setAuthErrorOccurred] = useState(false) // Prevents retry loops on auth errors
  const [createAttempts, setCreateAttempts] = useState(0) // Tracks creation attempts
  const MAX_CREATE_ATTEMPTS = 2 // Maximum retries for sheet creation
  const [useEmbedded, setUseEmbedded] = useState(() => {
    // Load preference from localStorage
    return localStorage.getItem('sheetEmbedPreference') === 'true'
  })
  const [highlightSave, setHighlightSave] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Create detailed stats sheet when modal opens - ALWAYS create fresh to reflect current player data
  useEffect(() => {
    const createSheet = async () => {
      // Don't retry if auth error occurred or max attempts reached
      if (authErrorOccurred || createAttempts >= MAX_CREATE_ATTEMPTS) return

      if (isOpen && user && !sheetId && !creatingSheet && !creatingSheetRef.current && !showDeletedNote) {
        // ALWAYS create a fresh sheet - never reuse old sheets
        // This ensures the sheet reflects current player data (user may have edited players directly)

        // Set ref immediately to prevent concurrent calls (state updates are async)
        creatingSheetRef.current = true
        setCreatingSheet(true)
        try {
          // Get current team abbreviation - use override if provided
          const { getAbbreviationFromDisplayName } = await import('../data/teamAbbreviations')
          const userTeamAbbr = overrideTeamAbbr || getAbbreviationFromDisplayName(currentDynasty?.teamName)
          const dynastyTeamName = overrideTeamName || currentDynasty?.teamName
          const startYear = currentDynasty?.startYear || currentYear

          // Get the full roster for this team and year
          const allPlayers = currentDynasty?.players || []
          const currentRoster = allPlayers.filter(player => {
            // Exclude honor-only players
            if (player.isHonorOnly) return false

            // PRIMARY CHECK: If player has teamsByYear record for this year, use it
            const yearKey = String(currentYear)
            const numKey = Number(currentYear)
            const teamForYear = player.teamsByYear?.[yearKey] ?? player.teamsByYear?.[numKey]

            if (teamForYear !== undefined) {
              return teamForYear === userTeamAbbr
            }

            // Exclude recruits who don't have explicit teamsByYear entry
            if (player.isRecruit) return false

            // FALLBACK: Legacy logic for backwards compatibility
            if (player.recruitYear && currentYear <= player.recruitYear) return false
            if (player.team !== userTeamAbbr) return false

            const playerStartYear = player.recruitYear ? (player.recruitYear + 1) : (player.yearStarted || startYear)
            if (player.leftTeam && currentYear > player.leftYear) return false

            return currentYear >= playerStartYear
          })

          // Get existing stats to pre-fill gamesPlayed/snapsPlayed
          // Check player.statsByYear first, then fall back to box score aggregation
          const playersWithSnaps = currentRoster.map(player => {
            const playerYearStats = player.statsByYear?.[currentYear]
              || player.statsByYear?.[String(currentYear)]
              || player.statsByYear?.[Number(currentYear)]

            // If no manual stats, try to get games from box score aggregation
            let gamesPlayed = playerYearStats?.gamesPlayed
            let snapsPlayed = playerYearStats?.snapsPlayed

            // Fall back to box scores if no manual gamesPlayed set
            if (gamesPlayed == null && player.name && currentDynasty) {
              const boxScoreStats = aggregatePlayerBoxScoreStats(currentDynasty, player.name, currentYear, userTeamAbbr, player)
              if (boxScoreStats?.gamesWithStats > 0) {
                gamesPlayed = boxScoreStats.gamesWithStats
              }
            }

            return {
              ...player,
              gamesPlayed: gamesPlayed ?? null,
              snapsPlayed: snapsPlayed ?? null
            }
          })

          // Get existing detailed stats to pre-fill the sheet
          // Reads from player.statsByYear first, then merges with box score data
          let aggregatedStats = {}

          // Build aggregatedStats from stored data AND box scores
          playersWithSnaps.forEach(player => {
            if (!player.name) return

            const playerYearStats = player.statsByYear?.[currentYear]
              || player.statsByYear?.[String(currentYear)]
              || player.statsByYear?.[Number(currentYear)]

            // Get box score aggregated stats
            const boxScoreStats = aggregatePlayerBoxScoreStats(currentDynasty, player.name, currentYear, userTeamAbbr, player)

            const playerStats = {}

            // Categories mapping: internal name -> box score category name
            const categories = ['passing', 'rushing', 'receiving', 'blocking', 'defense', 'kicking', 'punting', 'kickReturn', 'puntReturn']

            categories.forEach(cat => {
              // First check player.statsByYear (manual/saved stats)
              if (playerYearStats?.[cat]) {
                playerStats[cat] = playerYearStats[cat]
              }
              // Fall back to box score aggregated stats if no manual stats
              else if (boxScoreStats?.[cat]) {
                playerStats[cat] = boxScoreStats[cat]
              }
            })

            if (Object.keys(playerStats).length > 0) {
              aggregatedStats[player.name] = playerStats
            }
          })

          const sheetInfo = await createDetailedStatsSheet(
            dynastyTeamName || 'Dynasty',
            currentYear,
            playersWithSnaps,
            aggregatedStats
          )

          setSheetId(sheetInfo.spreadsheetId)
          // NOTE: We do NOT save the sheet ID to dynasty - each open creates a fresh sheet
        } catch (error) {
          console.error('Error creating detailed stats sheet:', error)
          setCreateAttempts(prev => prev + 1)

          // Check for OAuth/auth errors - stop retrying and show error modal
          if (error.message?.includes('OAuth') || error.message?.includes('access token') || error.message?.includes('expired') || error.message?.includes('authentication') || error.message?.includes('token')) {
            setAuthErrorOccurred(true)
            setShowAuthError(true)
          }
        } finally {
          setCreatingSheet(false)
          creatingSheetRef.current = false
        }
      }
    }
    createSheet()
  }, [isOpen, user, sheetId, creatingSheet, showDeletedNote, currentDynasty?.id, currentYear, retryCount, overrideTeamAbbr, overrideTeamName, authErrorOccurred, createAttempts])

  // Reset state when modal closes - clear sheetId so a fresh sheet is created next time
  useEffect(() => {
    if (!isOpen) {
      setSheetId(null)
      setShowDeletedNote(false)
      creatingSheetRef.current = false
      setAuthErrorOccurred(false)
      setCreateAttempts(0)
      setShowAuthError(false)
    }
  }, [isOpen])

  const handleSyncFromSheet = async () => {
    if (!sheetId) return

    setSyncing(true)
    try {
      const detailedStats = await readDetailedStatsFromSheet(sheetId)
      await onSave(detailedStats)
      onClose()
    } catch (error) {
      console.error(error)
      if (error.message?.includes('OAuth') || error.message?.includes('access token')) {
        setShowAuthError(true)
      } else {
        alert('Failed to sync from Google Sheets. Make sure data is properly formatted.')
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAndDelete = async () => {
    if (!sheetId) return

    setDeletingSheet(true)
    try {
      const detailedStats = await readDetailedStatsFromSheet(sheetId)
      await onSave(detailedStats)

      // Move sheet to trash (keep sheet ID stored so user can restore if needed)
      await deleteGoogleSheet(sheetId)

      setSheetId(null)
      setShowDeletedNote(true)
      setTimeout(() => {
        onClose()
      }, 2500)
    } catch (error) {
      console.error('Error in handleSyncAndDelete:', error)
      if (error.message?.includes('OAuth') || error.message?.includes('access token')) {
        setShowAuthError(true)
      } else {
        alert(`Failed to sync/delete: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setDeletingSheet(false)
    }
  }

  const handleRegenerateSheet = async () => {
    if (!sheetId) return
    const confirmed = window.confirm('This will delete your current sheet and create a fresh one. Any unsaved data will be lost. Continue?')
    if (!confirmed) return
    setRegenerating(true)
    try {
      await deleteGoogleSheet(sheetId)
      setSheetId(null)
      setRetryCount(c => c + 1)
    } catch (error) {
      console.error('Failed to regenerate sheet:', error)
      if (error.message?.includes('OAuth') || error.message?.includes('access token')) {
        setShowAuthError(true)
      } else {
        alert('Failed to regenerate sheet. Please try again.')
      }
    } finally {
      setRegenerating(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  const embedUrl = sheetId ? getSheetEmbedUrl(sheetId, 'Passing') : null
  const isLoading = creatingSheet

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] py-8 px-4 sm:p-4"
      style={{ margin: 0 }}
      onMouseDown={handleClose}
    >
      <div
        className="rounded-lg shadow-xl w-full sm:w-[95vw] max-h-[calc(100vh-4rem)] sm:h-[95vh] flex flex-col p-4 sm:p-6"
        style={{ backgroundColor: teamColors.secondary }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
            {currentYear} Detailed Stats Entry
          </h2>
          <button
            onClick={handleClose}
            className="hover:opacity-70"
            style={{ color: teamColors.primary }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Helper tip */}
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: `${teamColors.primary}15`, color: teamColors.primary }}>
          <span className="font-semibold">Tip:</span> Make sure you've completed GP/Snaps Entry first. In CFB 26, sort your stats by Snaps Played, then go through each category tab - the order will match and make entry quick!
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div
                className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
                style={{
                  borderColor: teamColors.primary,
                  borderTopColor: 'transparent'
                }}
              />
              <p className="text-lg font-semibold" style={{ color: teamColors.primary }}>
                Creating Detailed Stats Sheet...
              </p>
              <p className="text-sm mt-2" style={{ color: teamColors.primary, opacity: 0.7 }}>
                Setting up 9 stat category tabs
              </p>
            </div>
          </div>
        ) : showDeletedNote ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 rounded-lg" style={{ backgroundColor: teamColors.primary }}>
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke={teamColors.secondary} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xl font-bold mb-2" style={{ color: teamColors.secondary }}>
                Saved & Moved to Trash!
              </p>
              <p className="text-sm" style={{ color: teamColors.secondary, opacity: 0.9 }}>
                Detailed stats saved to your dynasty.
              </p>
            </div>
          </div>
        ) : sheetId ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Action Buttons - only show at top for embedded view */}
            {!isMobile && useEmbedded && (
              <div className="mb-3">
                <div className="flex gap-3 flex-wrap items-center">
                  <button
                    onClick={handleSyncAndDelete}
                    disabled={syncing || deletingSheet}
                    className={`px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-all text-sm ${highlightSave ? 'animate-pulse ring-4 ring-offset-2 scale-105' : ''}`}
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary
                    }}
                  >
                    {deletingSheet ? 'Saving...' : '✓ Save & Move to Trash'}
                  </button>
                  <button
                    onClick={handleSyncFromSheet}
                    disabled={syncing || deletingSheet}
                    className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm border-2"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: teamColors.primary,
                      color: teamColors.primary
                    }}
                  >
                    {syncing ? 'Syncing...' : 'Save & Keep Sheet'}
                  </button>
                  <button
                    onClick={handleRegenerateSheet}
                    disabled={syncing || deletingSheet || regenerating}
                    className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm border-2 ml-auto"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: '#EF4444',
                      color: '#EF4444'
                    }}
                  >
                    {regenerating ? 'Regenerating...' : 'Regenerate sheet'}
                  </button>
                  {highlightSave && (
                    <span className="text-xs font-medium animate-bounce" style={{ color: teamColors.primary }}>

                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Toggle between embedded and new tab */}
            {!isMobile && (
              <div className="flex items-center justify-end mb-2">
                <button
                  onClick={() => {
                    const newValue = !useEmbedded
                    setUseEmbedded(newValue)
                    localStorage.setItem('sheetEmbedPreference', newValue.toString())
                  }}
                  className="text-xs px-3 py-1 rounded-full border transition-colors"
                  style={{
                    borderColor: teamColors.primary,
                    color: teamColors.primary,
                    backgroundColor: 'transparent'
                  }}
                >
                  {useEmbedded ? '← Back to default view' : 'Try embedded view (beta)'}
                </button>
              </div>
            )}

            {isMobile || !useEmbedded ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: teamColors.primary }}>
                  <svg className="w-10 h-10" fill="none" stroke={teamColors.secondary} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: teamColors.primary }}>Edit in Google Sheets</h3>
                <div className="text-left mb-6 max-w-md">
                  <p className="text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>Instructions:</p>
                  <ol className="text-sm space-y-1.5" style={{ color: teamColors.primary, opacity: 0.8 }}>
                    <li className="flex gap-2"><span className="font-bold">1.</span><span>Tap the button below to open Google Sheets</span></li>
                    <li className="flex gap-2"><span className="font-bold">2.</span><span>Enter stats in each of the 9 tabs (Passing, Rushing, etc.)</span></li>
                    <li className="flex gap-2"><span className="font-bold">3.</span><span>Return to this app when done</span></li>
                    <li className="flex gap-2"><span className="font-bold">4.</span><span>Tap "Save" below to sync results</span></li>
                  </ol>
                  <p className="text-xs mt-3" style={{ color: teamColors.primary, opacity: 0.6 }}>
                    Tabs: Passing, Rushing, Receiving, Blocking, Defensive, Kicking, Punting, Kick Return, Punt Return
                  </p>
                  <div className="text-xs mt-3 p-2 rounded-lg" style={{ backgroundColor: `${teamColors.primary}15`, color: teamColors.primary }}>
                    <p className="font-semibold">Tip:</p>
                    <p style={{ opacity: 0.85 }}>Sort by Snaps Played in your EA CFB 25 game stats and each tab will match up perfectly.</p>
                  </div>
                </div>
                <a href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-lg font-bold text-lg hover:opacity-90 transition-colors flex items-center gap-2 mb-6" style={{ backgroundColor: '#0F9D58', color: '#FFFFFF' }}>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/><path d="M7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zm4-8h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6z"/></svg>
                  Open Google Sheets
                </a>

                {/* Centered Save Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-center mb-4">
                  <button
                    onClick={handleSyncAndDelete}
                    disabled={syncing || deletingSheet}
                    className={`px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all text-sm ${highlightSave ? 'animate-pulse ring-4 ring-offset-2 scale-105' : ''}`}
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary
                    }}
                  >
                    {deletingSheet ? 'Saving...' : '✓ Save & Move to Trash'}
                  </button>
                  <button
                    onClick={handleSyncFromSheet}
                    disabled={syncing || deletingSheet}
                    className="px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm border-2"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: teamColors.primary,
                      color: teamColors.primary
                    }}
                  >
                    {syncing ? 'Syncing...' : 'Save & Keep Sheet'}
                  </button>
                </div>
                <button
                  onClick={handleRegenerateSheet}
                  disabled={syncing || deletingSheet || regenerating}
                  className="text-xs px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-colors border mb-4"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: '#EF4444',
                    color: '#EF4444'
                  }}
                >
                  {regenerating ? 'Regenerating...' : 'Messed up? Regenerate sheet'}
                </button>
                {highlightSave && (
                  <span className="text-sm font-medium animate-bounce mb-4" style={{ color: teamColors.primary }}>

                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <SheetToolbar
                    sheetId={sheetId}
                    embedUrl={embedUrl}
                    teamColors={teamColors}
                    title="Detailed Stats Google Sheet"
                    onSessionError={() => setShowAuthError(true)}
                  />
                </div>
                <div className="text-xs mt-2 space-y-1" style={{ color: teamColors.primary, opacity: 0.6 }}>
                  <p><strong>Tabs:</strong> Passing, Rushing, Receiving, Blocking, Defensive, Kicking, Punting, Kick Return, Punt Return</p>
                  <p>Name and Snaps columns are protected. Enter stats in each category tab.</p>
                  <p><strong>Tip:</strong> Sort by Snaps Played in your EA CFB 25 game stats and each tab will match up perfectly.</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg mb-4" style={{ color: teamColors.primary }}>
                Your session has expired. Click below to refresh.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={async () => {
                    setRefreshing(true)
                    try {
                      const success = await refreshSession()
                      if (success) {
                        // Trigger sheet creation retry
                        setRetryCount(c => c + 1)
                      }
                    } catch (e) {
                      console.error('Refresh failed:', e)
                    }
                    setRefreshing(false)
                  }}
                  disabled={refreshing}
                  className="px-4 py-2 rounded font-semibold transition-colors"
                  style={{
                    backgroundColor: teamColors.primary,
                    color: teamColors.primaryText || '#fff',
                    opacity: refreshing ? 0.7 : 1
                  }}
                >
                  {refreshing ? 'Refreshing...' : 'Refresh Session'}
                </button>
                <button
                  onClick={signOut}
                  className="px-4 py-2 rounded font-semibold transition-colors border"
                  style={{
                    borderColor: teamColors.primary,
                    color: teamColors.primary,
                    backgroundColor: 'transparent'
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auth Error Modal */}
      <AuthErrorModal
        isOpen={showAuthError}
        onClose={() => setShowAuthError(false)}
        teamColors={teamColors}
      />
    </div>
  )
}
