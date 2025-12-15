import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { getTeamColors } from '../data/teamColors'
import { getTeamLogo } from '../data/teams'
import { getConferenceLogo } from '../data/conferenceLogos'
import ConfirmModal from '../components/ConfirmModal'

export default function Home() {
  const { dynasties, deleteDynasty } = useDynasty()
  const [dynastyToDelete, setDynastyToDelete] = useState(null)
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

  return (
    <div className="max-w-4xl mx-auto">
      {!hasDynasties ? (
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            CFB Dynasty Tracker
          </h1>
          <Link
            to="/create"
            className="inline-block bg-gray-800 text-white px-8 py-4 rounded-lg font-semibold transition-colors hover:bg-gray-700"
          >
            Create Dynasty
          </Link>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Your Dynasties</h1>
            <Link
              to="/create"
              className="bg-gray-800 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors hover:bg-gray-700"
            >
              + New
            </Link>
          </div>

          <div className="grid gap-4">
            {dynasties.map((dynasty) => {
              const colors = getTeamColors(dynasty.teamName)
              const logoUrl = getTeamLogo(dynasty.teamName)
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
                      <div>
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
