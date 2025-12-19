import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { getTeamColors } from '../data/teamColors'
import { getTeamLogo } from '../data/teams'
import { getConferenceLogo } from '../data/conferenceLogos'
import { getAbbreviationFromDisplayName } from '../data/teamAbbreviations'
import { getTeamConference } from '../data/conferenceTeams'
import { getContrastTextColor } from '../utils/colorUtils'
import ConfirmModal from '../components/ConfirmModal'

// Helper to get team's conference from dynasty data
function getDynastyTeamConference(dynasty) {
  if (!dynasty.teamName) return null

  // Get team abbreviation from display name
  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)
  if (!teamAbbr) return null

  // Check custom conferences first (if user has set them)
  if (dynasty.conferences && Object.keys(dynasty.conferences).length > 0) {
    for (const [confName, teams] of Object.entries(dynasty.conferences)) {
      if (teams.includes(teamAbbr)) {
        return confName
      }
    }
  }

  // Fall back to default conference mapping
  return getTeamConference(teamAbbr)
}

// Helper to format relative time (e.g., "2 hours ago")
function getRelativeTime(timestamp) {
  if (!timestamp) return null

  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  return `${months}mo ago`
}

// Helper to format phase for display
function formatPhase(phase) {
  switch (phase) {
    case 'preseason': return 'Pre-Season'
    case 'regular_season': return 'Regular Season'
    case 'conference_championship': return 'Conference Championships'
    case 'postseason': return 'Playoffs'
    case 'offseason': return 'Off-Season'
    default: return phase
  }
}

// Helper to format week/phase display
function getWeekPhaseDisplay(dynasty) {
  const phase = formatPhase(dynasty.currentPhase)
  if (dynasty.currentPhase === 'preseason' || dynasty.currentPhase === 'conference_championship') {
    return phase
  }
  if (dynasty.currentPhase === 'postseason') {
    return dynasty.currentWeek === 5 ? 'National Championship' : `Bowl Week ${dynasty.currentWeek}`
  }
  return `Week ${dynasty.currentWeek} • ${phase}`
}

export default function Home() {
  const { dynasties, deleteDynasty, importDynasty, exportDynasty, updateDynasty, loading } = useDynasty()

  // Sort dynasties by lastModified (most recent first)
  const sortedDynasties = [...dynasties].sort((a, b) => {
    const aTime = a.lastModified || 0
    const bTime = b.lastModified || 0
    return bTime - aTime
  })
  const [dynastyToDelete, setDynastyToDelete] = useState(null)
  const [showFinalConfirm, setShowFinalConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const hasDynasties = dynasties.length > 0

  const handleDeleteClick = (e, dynasty) => {
    e.preventDefault()
    e.stopPropagation()
    setDynastyToDelete(dynasty)
  }

  const handleConfirmDelete = () => {
    if (dynastyToDelete) {
      // If it's a favorite, require extra confirmation
      if (dynastyToDelete.favorite) {
        setShowFinalConfirm(true)
      } else {
        deleteDynasty(dynastyToDelete.id)
        setDynastyToDelete(null)
      }
    }
  }

  const handleFinalConfirmDelete = () => {
    if (dynastyToDelete && confirmText === dynastyToDelete.teamName) {
      deleteDynasty(dynastyToDelete.id)
      setDynastyToDelete(null)
      setShowFinalConfirm(false)
      setConfirmText('')
    }
  }

  const handleCancelFinalConfirm = () => {
    setShowFinalConfirm(false)
    setConfirmText('')
  }

  const handleExportClick = (e, dynasty) => {
    e.preventDefault()
    e.stopPropagation()
    exportDynasty(dynasty.id)
  }

  const handleFavoriteClick = async (e, dynasty) => {
    e.preventDefault()
    e.stopPropagation()
    await updateDynasty(dynasty.id, { favorite: !dynasty.favorite })
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      await importDynasty(file)
      alert('Dynasty imported successfully!')
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error importing dynasty:', error)
      alert(error.message || 'Failed to import dynasty. Please check the file and try again.')
    } finally {
      setImporting(false)
    }
  }

  // Show loading state while dynasties are being fetched
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16">
          <div className="animate-spin w-12 h-12 border-4 border-gray-300 border-t-gray-800 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading dynasties...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {!hasDynasties ? (
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            CFB Dynasty Tracker
          </h1>
          <div className="flex gap-4 justify-center">
            <Link
              to="/create"
              className="inline-block bg-gray-800 text-white px-8 py-4 rounded-lg font-semibold transition-colors hover:bg-gray-700"
            >
              Create Dynasty
            </Link>
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="inline-block bg-gray-600 text-white px-8 py-4 rounded-lg font-semibold transition-colors hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import Dynasty'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Your Dynasties</h1>
            <div className="flex gap-2">
              <Link
                to="/create"
                className="bg-gray-800 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors hover:bg-gray-700"
              >
                + New
              </Link>
              <button
                onClick={handleImportClick}
                disabled={importing}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="grid gap-3 sm:gap-4">
            {sortedDynasties.map((dynasty) => {
              const colors = getTeamColors(dynasty.teamName)
              const logoUrl = getTeamLogo(dynasty.teamName)
              const relativeTime = getRelativeTime(dynasty.lastModified)
              const weekPhase = getWeekPhaseDisplay(dynasty)
              const conference = getDynastyTeamConference(dynasty)
              const textColor = getContrastTextColor(colors.primary)
              return (
                <div
                  key={dynasty.id}
                  className="rounded-lg p-3 sm:p-5 transition-all hover:scale-[1.01]"
                  style={{
                    backgroundColor: colors.primary,
                    border: `2px solid ${colors.secondary}`
                  }}
                >
                  <Link
                    to={`/dynasty/${dynasty.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {logoUrl && (
                        <div
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${colors.secondary}`,
                            padding: '3px'
                          }}
                        >
                          <img
                            src={logoUrl}
                            alt={`${dynasty.teamName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h2
                          className="text-base sm:text-lg font-bold truncate"
                          style={{ color: textColor }}
                        >
                          {dynasty.teamName}
                        </h2>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {conference && getConferenceLogo(conference) && (
                            <img
                              src={getConferenceLogo(conference)}
                              alt={`${conference} logo`}
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain opacity-80 flex-shrink-0"
                            />
                          )}
                          <p
                            className="text-xs sm:text-sm opacity-80 truncate"
                            style={{ color: textColor }}
                          >
                            {conference ? `${conference} • ` : ''}{dynasty.currentYear}
                          </p>
                        </div>
                        <p
                          className="text-xs mt-0.5 sm:mt-1 opacity-70 truncate"
                          style={{ color: textColor }}
                        >
                          {weekPhase}
                          {relativeTime && <span className="ml-1 sm:ml-2">• {relativeTime}</span>}
                        </p>
                      </div>

                      {/* Action buttons - inline on all sizes */}
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        {/* Favorite button */}
                        <button
                          onClick={(e) => handleFavoriteClick(e, dynasty)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-black hover:bg-opacity-20 transition-colors"
                          style={{ color: textColor }}
                          title={dynasty.favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          {dynasty.favorite ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                        </button>

                        {/* Export button */}
                        <button
                          onClick={(e) => handleExportClick(e, dynasty)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-black hover:bg-opacity-20 transition-colors"
                          style={{ color: textColor }}
                          title="Export Dynasty"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDeleteClick(e, dynasty)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-black hover:bg-opacity-20 transition-colors"
                          style={{ color: textColor }}
                          title="Delete Dynasty"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!dynastyToDelete && !showFinalConfirm}
        onClose={() => setDynastyToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={dynastyToDelete?.favorite ? "Delete Favorited Dynasty?" : "Delete Dynasty?"}
        message={
          dynastyToDelete?.favorite
            ? `WARNING: "${dynastyToDelete?.teamName}" is marked as a favorite! Are you absolutely sure you want to delete this dynasty? This action cannot be undone.`
            : `Are you sure you want to delete the ${dynastyToDelete?.teamName} dynasty? This action cannot be undone.`
        }
        confirmText={dynastyToDelete?.favorite ? "Continue" : "Delete"}
        cancelText="Cancel"
        confirmButtonColor="#ef4444"
      />

      {/* Extra confirmation modal for favorites - requires typing dynasty name */}
      {showFinalConfirm && dynastyToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCancelFinalConfirm}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-red-600 mb-4">
              Final Confirmation Required
            </h2>
            <p className="text-gray-700 mb-4">
              This is a <strong>favorited dynasty</strong>. To confirm deletion, please type the dynasty name exactly:
            </p>
            <p className="text-lg font-bold text-gray-900 mb-4 bg-gray-100 p-2 rounded">
              {dynastyToDelete.teamName}
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type dynasty name here..."
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg mb-4 focus:border-red-500 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleFinalConfirmDelete}
                disabled={confirmText !== dynastyToDelete.teamName}
                className="flex-1 px-4 py-2 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: confirmText === dynastyToDelete.teamName ? '#ef4444' : '#9ca3af' }}
              >
                Permanently Delete
              </button>
              <button
                onClick={handleCancelFinalConfirm}
                className="flex-1 px-4 py-2 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
