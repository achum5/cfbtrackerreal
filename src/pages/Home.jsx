import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { getTeamColors } from '../data/teamColors'
import { getTeamLogo } from '../data/teams'
import { getConferenceLogo } from '../data/conferenceLogos'
import ConfirmModal from '../components/ConfirmModal'

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
  return `Week ${dynasty.currentWeek} • ${phase}`
}

export default function Home() {
  const { dynasties, deleteDynasty, importDynasty } = useDynasty()

  // Sort dynasties by lastModified (most recent first)
  const sortedDynasties = [...dynasties].sort((a, b) => {
    const aTime = a.lastModified || 0
    const bTime = b.lastModified || 0
    return bTime - aTime
  })
  const [dynastyToDelete, setDynastyToDelete] = useState(null)
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
      deleteDynasty(dynastyToDelete.id)
      setDynastyToDelete(null)
    }
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

          <div className="grid gap-4">
            {sortedDynasties.map((dynasty) => {
              const colors = getTeamColors(dynasty.teamName)
              const logoUrl = getTeamLogo(dynasty.teamName)
              const relativeTime = getRelativeTime(dynasty.lastModified)
              const weekPhase = getWeekPhaseDisplay(dynasty)
              return (
                <div
                  key={dynasty.id}
                  className="relative rounded-lg p-5 transition-all hover:scale-[1.01]"
                  style={{
                    backgroundColor: colors.primary,
                    border: `2px solid ${colors.secondary}`
                  }}
                >
                  <Link
                    to={`/dynasty/${dynasty.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4">
                      {logoUrl && (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${colors.secondary}`,
                            padding: '4px'
                          }}
                        >
                          <img
                            src={logoUrl}
                            alt={`${dynasty.teamName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h2
                          className="text-lg font-bold"
                          style={{ color: colors.secondary }}
                        >
                          {dynasty.teamName}
                        </h2>
                        <div className="flex items-center gap-2">
                          {getConferenceLogo(dynasty.conference) && (
                            <img
                              src={getConferenceLogo(dynasty.conference)}
                              alt={`${dynasty.conference} logo`}
                              className="w-4 h-4 object-contain opacity-80"
                            />
                          )}
                          <p
                            className="text-sm opacity-80"
                            style={{ color: colors.secondary }}
                          >
                            {dynasty.conference} • {dynasty.currentYear}
                          </p>
                        </div>
                        <p
                          className="text-xs mt-1 opacity-70"
                          style={{ color: colors.secondary }}
                        >
                          {weekPhase}
                          {relativeTime && <span className="ml-2">• {relativeTime}</span>}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteClick(e, dynasty)}
                    className="absolute top-3 right-3 p-2 rounded-lg hover:bg-black hover:bg-opacity-20 transition-colors"
                    style={{ color: colors.secondary }}
                    title="Delete Dynasty"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!dynastyToDelete}
        onClose={() => setDynastyToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Dynasty?"
        message={`Are you sure you want to delete the ${dynastyToDelete?.teamName} dynasty? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="#ef4444"
      />
    </div>
  )
}
