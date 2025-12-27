import { useState, useEffect, useMemo } from 'react'
import SheetToolbar, { SheetErrorBanner } from './SheetToolbar'
import {
  createGameBoxScoreSheet,
  createScoringSummarySheet,
  readGameBoxScoreFromSheet,
  readScoringSummaryFromSheet,
  deleteGoogleSheet,
  getSingleSheetEmbedUrl
} from '../services/sheetsService'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { getAbbreviationFromDisplayName } from '../data/teamAbbreviations'

/**
 * BoxScoreSheetModal - A reusable modal for box score Google Sheets
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSave: (data) => void - Called with the synced data (stats or scoring summary)
 * - onSheetCreated: (sheetId) => void - Called when a new sheet is created
 * - sheetType: 'homeStats' | 'awayStats' | 'scoring'
 * - existingSheetId: string | null - Existing sheet ID if already created
 * - game: { id, week, year, opponent, location }
 * - teamColors: { primary, secondary }
 */
export default function BoxScoreSheetModal({
  isOpen,
  onClose,
  onSave,
  onSheetCreated,
  sheetType,
  existingSheetId,
  game,
  teamColors
}) {
  const { currentDynasty, updateDynasty } = useDynasty()
  const { user, signOut, refreshSession } = useAuth()

  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [showDeletedNote, setShowDeletedNote] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [useEmbedded, setUseEmbedded] = useState(() => {
    return localStorage.getItem('sheetEmbedPreference') === 'true'
  })
  const [showSessionError, setShowSessionError] = useState(false)
  const [highlightSave, setHighlightSave] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Determine teams based on game location
  const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName) || currentDynasty?.teamName || ''
  const opponentAbbr = game?.opponent || ''
  const isUserHome = game?.location === 'home' || game?.location === 'neutral'

  const homeTeamAbbr = isUserHome ? userTeamAbbr : opponentAbbr
  const awayTeamAbbr = isUserHome ? opponentAbbr : userTeamAbbr
  const homeTeamName = isUserHome ? currentDynasty?.teamName : opponentAbbr
  const awayTeamName = isUserHome ? opponentAbbr : currentDynasty?.teamName

  // Get roster for player dropdowns (only for user's team)
  const roster = useMemo(() => {
    if (!currentDynasty?.players) return []
    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
    return currentDynasty.players
      .filter(p => p.team === teamAbbr && !p.leftTeam)
      .map(p => p.name)
      .sort()
  }, [currentDynasty?.players, currentDynasty?.teamName])

  // Determine title and team info based on sheet type
  const getSheetConfig = () => {
    switch (sheetType) {
      case 'homeStats':
        return {
          title: `${homeTeamAbbr} Player Stats`,
          teamAbbr: homeTeamAbbr,
          teamName: homeTeamName,
          opponentAbbr: awayTeamAbbr,
          isUserTeam: homeTeamAbbr === userTeamAbbr,
          sheetIdKey: 'homeStatsSheetId',
          instructions: 'Enter player statistics for each category tab (Passing, Rushing, Receiving, etc.)',
          columns: 'Passing, Rushing, Receiving, Blocking, Defense, Kicking, Punting, Kick Return, Punt Return'
        }
      case 'awayStats':
        return {
          title: `${awayTeamAbbr} Player Stats`,
          teamAbbr: awayTeamAbbr,
          teamName: awayTeamName,
          opponentAbbr: homeTeamAbbr,
          isUserTeam: awayTeamAbbr === userTeamAbbr,
          sheetIdKey: 'awayStatsSheetId',
          instructions: 'Enter player statistics for each category tab (Passing, Rushing, Receiving, etc.)',
          columns: 'Passing, Rushing, Receiving, Blocking, Defense, Kicking, Punting, Kick Return, Punt Return'
        }
      case 'scoring':
        return {
          title: 'Scoring Summary',
          sheetIdKey: 'scoringSummarySheetId',
          instructions: 'Enter each scoring play with team, scorer, and details',
          columns: 'Team | Scorer | Passer | Score Type | Quarter | Time Left'
        }
      default:
        return { title: 'Stats', sheetIdKey: '', instructions: '', columns: '' }
    }
  }

  const config = getSheetConfig()

  // Highlight save button when user returns to window
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

  // Load existing sheet or create new one
  useEffect(() => {
    const initSheet = async () => {
      if (isOpen && user && !sheetId && !creatingSheet && !showDeletedNote) {
        // Check for existing sheet
        if (existingSheetId) {
          setSheetId(existingSheetId)
          return
        }

        // Create new sheet
        setCreatingSheet(true)
        try {
          const year = game?.year || currentDynasty?.currentYear
          const week = game?.week || 1

          let sheetInfo
          if (sheetType === 'scoring') {
            // Pass roster to home or away based on which is user's team
            const homeRoster = isUserHome ? roster : []
            const awayRoster = isUserHome ? [] : roster
            sheetInfo = await createScoringSummarySheet(
              homeTeamAbbr,
              awayTeamAbbr,
              year,
              week,
              homeRoster,
              awayRoster
            )
          } else {
            sheetInfo = await createGameBoxScoreSheet(
              config.teamName,
              config.teamAbbr,
              config.opponentAbbr,
              year,
              week,
              config.isUserTeam,
              config.isUserTeam ? roster : []
            )
          }

          setSheetId(sheetInfo.spreadsheetId)

          // Notify parent of new sheet ID
          if (onSheetCreated) {
            onSheetCreated(sheetInfo.spreadsheetId)
          }

          // Also try to save to game in dynasty (for existing games)
          await saveSheetIdToGame(sheetInfo.spreadsheetId)
        } catch (error) {
          console.error('Failed to create sheet:', error)
        } finally {
          setCreatingSheet(false)
        }
      }
    }

    initSheet()
  }, [isOpen, user, sheetId, creatingSheet, existingSheetId, retryCount, showDeletedNote])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDeletedNote(false)
    }
  }, [isOpen])

  // Save sheet ID to game in dynasty (for existing games)
  const saveSheetIdToGame = async (newSheetId) => {
    if (!currentDynasty || !game?.id) return

    const games = [...(currentDynasty.games || [])]
    const gameIndex = games.findIndex(g => g.id === game.id)
    if (gameIndex === -1) return // Game doesn't exist yet, parent will handle

    games[gameIndex] = {
      ...games[gameIndex],
      [config.sheetIdKey]: newSheetId
    }

    await updateDynasty(currentDynasty.id, { games })
  }

  // Sync data from sheet
  const handleSyncFromSheet = async () => {
    if (!sheetId) return

    setSyncing(true)
    try {
      let data
      if (sheetType === 'scoring') {
        data = await readScoringSummaryFromSheet(sheetId)
      } else {
        data = await readGameBoxScoreFromSheet(sheetId)
      }
      await onSave(data)
      onClose()
    } catch (error) {
      alert('Failed to sync from Google Sheets. Make sure data is properly formatted.')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  // Sync and delete sheet
  const handleSyncAndDelete = async () => {
    if (!sheetId) return

    setDeletingSheet(true)
    try {
      let data
      if (sheetType === 'scoring') {
        data = await readScoringSummaryFromSheet(sheetId)
      } else {
        data = await readGameBoxScoreFromSheet(sheetId)
      }
      await onSave(data)

      // Move sheet to trash (keep sheet ID stored so user can restore if needed)
      await deleteGoogleSheet(sheetId)

      setSheetId(null)
      setShowDeletedNote(true)
      setTimeout(() => {
        onClose()
      }, 2500)
    } catch (error) {
      console.error('Failed to sync/move to trash:', error)
      alert(`Failed to sync/move to trash: ${error.message || 'Unknown error'}`)
    } finally {
      setDeletingSheet(false)
    }
  }

  // Regenerate sheet
  const handleRegenerateSheet = async () => {
    if (!sheetId) return

    const confirmed = window.confirm('This will delete your current sheet and create a fresh one. Any unsaved data will be lost. Continue?')
    if (!confirmed) return

    setRegenerating(true)
    try {
      await deleteGoogleSheet(sheetId)

      // Clear sheet ID from game
      if (currentDynasty && game?.id) {
        const games = [...(currentDynasty.games || [])]
        const gameIndex = games.findIndex(g => g.id === game.id)
        if (gameIndex !== -1) {
          games[gameIndex] = {
            ...games[gameIndex],
            [config.sheetIdKey]: null
          }
          await updateDynasty(currentDynasty.id, { games })
        }
      }

      setSheetId(null)
      setRetryCount(c => c + 1)
    } catch (error) {
      console.error('Failed to regenerate sheet:', error)
      alert('Failed to regenerate sheet. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  const embedUrl = sheetId ? getSingleSheetEmbedUrl(sheetId) : null
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
              {config.title}
            </h2>
            {sheetType !== 'scoring' && (
              <p className="text-xs mt-1" style={{ color: teamColors.primary, opacity: 0.7 }}>
                Reminder: This is not mandatory to be entered every game. You will have the option to enter all player season stats at the end of the season.
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="hover:opacity-70 ml-4"
            style={{ color: teamColors.primary }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
                Creating {config.title} Sheet...
              </p>
              <p className="text-sm mt-2" style={{ color: teamColors.primary, opacity: 0.7 }}>
                {sheetType === 'scoring' ? 'Setting up scoring summary' : 'Setting up 9 stat category tabs'}
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
                Stats saved to your game.
              </p>
            </div>
          </div>
        ) : sheetId ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Action Buttons - only show at top for embedded view */}
            {useEmbedded && (
              <div className="mb-3">
                <div className="flex gap-2 sm:gap-3 flex-wrap items-center">
                  <button
                    onClick={handleSyncAndDelete}
                    disabled={syncing || deletingSheet}
                    className={`px-3 sm:px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-all text-xs sm:text-sm ${highlightSave ? 'animate-pulse ring-4 ring-offset-2 scale-105' : ''}`}
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary,
                      ringColor: teamColors.primary
                    }}
                  >
                    {deletingSheet ? 'Saving...' : '✓ Save & Move to Trash'}
                  </button>
                  <button
                    onClick={handleSyncFromSheet}
                    disabled={syncing || deletingSheet}
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-xs sm:text-sm border-2"
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
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-xs sm:text-sm border-2 ml-auto"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: '#EF4444',
                      color: '#EF4444'
                    }}
                  >
                    {regenerating ? 'Regenerating...' : 'Start Over'}
                  </button>
                </div>
              </div>
            )}

            {/* Toggle between embedded and new tab */}
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

            {/* Session Error Banner */}
            {showSessionError && (
              <SheetErrorBanner
                teamColors={teamColors}
                onReload={() => setShowSessionError(false)}
                onOpenNewTab={() => window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`, '_blank')}
                onRefreshSession={async () => {
                  const success = await refreshSession()
                  if (success) setShowSessionError(false)
                }}
              />
            )}

            {useEmbedded ? (
              /* Embedded iframe view with toolbar */
              <>
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <SheetToolbar
                    sheetId={sheetId}
                    embedUrl={embedUrl}
                    teamColors={teamColors}
                    title={`${config.title} Google Sheet`}
                    onSessionError={() => setShowSessionError(true)}
                  />
                </div>

                <div className="text-xs mt-2 space-y-1" style={{ color: teamColors.primary, opacity: 0.6 }}>
                  <p><strong>Tabs:</strong> {config.columns}</p>
                  <p>{config.instructions}</p>
                </div>
              </>
            ) : (
              /* Open in new tab view */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                  style={{ backgroundColor: teamColors.primary }}
                >
                  <svg className="w-10 h-10" fill="none" stroke={teamColors.secondary} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                <h3 className="text-xl font-bold mb-3" style={{ color: teamColors.primary }}>
                  Edit in Google Sheets
                </h3>

                <div className="text-left mb-6 max-w-sm">
                  <p className="text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                    Instructions:
                  </p>
                  <ol className="text-sm space-y-1.5" style={{ color: teamColors.primary, opacity: 0.8 }}>
                    <li className="flex gap-2">
                      <span className="font-bold">1.</span>
                      <span>Click the button below to open Google Sheets in a new tab</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold">2.</span>
                      <span>{config.instructions}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold">3.</span>
                      <span>Return to this tab when done</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold">4.</span>
                      <span>Click "Save" below to sync your data</span>
                    </li>
                  </ol>
                </div>

                <a
                  href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 rounded-lg font-bold text-lg hover:opacity-90 transition-colors flex items-center gap-3 mb-6"
                  style={{
                    backgroundColor: '#0F9D58',
                    color: '#FFFFFF'
                  }}
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                    <path d="M7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zm4-8h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6z"/>
                  </svg>
                  Open Google Sheets
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>

                {/* Centered Save Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-center mb-6">
                  <button
                    onClick={handleSyncAndDelete}
                    disabled={syncing || deletingSheet}
                    className={`px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all text-sm ${highlightSave ? 'animate-pulse ring-4 ring-offset-2 scale-105' : ''}`}
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary,
                      ringColor: teamColors.primary
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

                {/* Start Over Button */}
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
                  {regenerating ? 'Regenerating...' : 'Messed up? Start Over with Fresh Sheet'}
                </button>

                <div className="text-xs p-3 rounded-lg max-w-sm" style={{ backgroundColor: `${teamColors.primary}15`, color: teamColors.primary }}>
                  <p className="font-semibold mb-1">Tabs:</p>
                  <p className="opacity-80">{config.columns}</p>
                </div>
              </div>
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
    </div>
  )
}
