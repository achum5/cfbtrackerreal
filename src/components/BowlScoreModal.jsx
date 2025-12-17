import { useState, useEffect } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { getTeamAbbreviationsList } from '../data/teamAbbreviations'

// CFP game structure by week (updated for 5-week postseason)
const CFP_GAMES_BY_WEEK = {
  3: [
    { id: 'qf1', name: 'CFP Quarterfinal 1' },
    { id: 'qf2', name: 'CFP Quarterfinal 2' },
    { id: 'qf3', name: 'CFP Quarterfinal 3' },
    { id: 'qf4', name: 'CFP Quarterfinal 4' }
  ],
  4: [
    { id: 'sf1', name: 'CFP Semifinal 1' },
    { id: 'sf2', name: 'CFP Semifinal 2' }
  ],
  5: [
    { id: 'championship', name: 'National Championship' }
  ]
}

export default function BowlScoreModal({ isOpen, onClose, onSave, currentYear, currentWeek, teamColors }) {
  const { currentDynasty } = useDynasty()
  const [games, setGames] = useState([])
  const [saving, setSaving] = useState(false)

  const teamAbbrs = getTeamAbbreviationsList()

  // Get the week title
  const getWeekTitle = () => {
    switch (currentWeek) {
      case 3: return 'CFP Quarterfinals'
      case 4: return 'CFP Semifinals'
      case 5: return 'National Championship'
      default: return `Postseason Week ${currentWeek}`
    }
  }

  // Initialize games state when modal opens
  useEffect(() => {
    if (isOpen && currentWeek >= 3 && currentWeek <= 5) {
      const cfpGames = CFP_GAMES_BY_WEEK[currentWeek] || []

      // Check if we have existing data for this week
      const existingData = currentDynasty?.cfpResultsByYear?.[currentYear]?.[`week${currentWeek}`] || []

      // Map games with existing data or empty values
      const initialGames = cfpGames.map(game => {
        const existing = existingData.find(g => g.id === game.id)
        return existing || {
          id: game.id,
          name: game.name,
          team1: '',
          team2: '',
          team1Score: '',
          team2Score: ''
        }
      })

      setGames(initialGames)
    }
  }, [isOpen, currentWeek, currentYear, currentDynasty])

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

  const handleGameChange = (index, field, value) => {
    const updatedGames = [...games]
    updatedGames[index] = {
      ...updatedGames[index],
      [field]: value
    }
    setGames(updatedGames)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Process games to add winner
      const processedGames = games.map(game => ({
        ...game,
        team1Score: game.team1Score ? parseInt(game.team1Score) : null,
        team2Score: game.team2Score ? parseInt(game.team2Score) : null,
        winner: game.team1Score && game.team2Score
          ? (parseInt(game.team1Score) > parseInt(game.team2Score) ? game.team1 : game.team2)
          : null
      }))

      await onSave(processedGames, currentWeek)
      onClose()
    } catch (error) {
      console.error('Error saving CFP results:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={handleClose}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto flex flex-col p-6"
        style={{ backgroundColor: teamColors.secondary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
            {getWeekTitle()}
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

        <div className="space-y-6">
          {games.map((game, index) => (
            <div
              key={game.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: `${teamColors.primary}15` }}
            >
              <h3 className="font-bold mb-3" style={{ color: teamColors.primary }}>
                {game.name}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Team 1 */}
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: teamColors.primary, opacity: 0.8 }}>
                    Team 1
                  </label>
                  <select
                    value={game.team1}
                    onChange={(e) => handleGameChange(index, 'team1', e.target.value)}
                    className="w-full px-3 py-2 rounded font-semibold text-sm"
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary
                    }}
                  >
                    <option value="">Select team...</option>
                    {teamAbbrs.map(abbr => (
                      <option key={abbr} value={abbr}>{abbr}</option>
                    ))}
                  </select>
                </div>

                {/* Team 2 */}
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: teamColors.primary, opacity: 0.8 }}>
                    Team 2
                  </label>
                  <select
                    value={game.team2}
                    onChange={(e) => handleGameChange(index, 'team2', e.target.value)}
                    className="w-full px-3 py-2 rounded font-semibold text-sm"
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary
                    }}
                  >
                    <option value="">Select team...</option>
                    {teamAbbrs.map(abbr => (
                      <option key={abbr} value={abbr}>{abbr}</option>
                    ))}
                  </select>
                </div>

                {/* Team 1 Score */}
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: teamColors.primary, opacity: 0.8 }}>
                    Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={game.team1Score}
                    onChange={(e) => handleGameChange(index, 'team1Score', e.target.value)}
                    className="w-full px-3 py-2 rounded font-semibold text-sm text-center"
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary
                    }}
                    placeholder="0"
                  />
                </div>

                {/* Team 2 Score */}
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: teamColors.primary, opacity: 0.8 }}>
                    Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={game.team2Score}
                    onChange={(e) => handleGameChange(index, 'team2Score', e.target.value)}
                    className="w-full px-3 py-2 rounded font-semibold text-sm text-center"
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.secondary
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
            style={{
              backgroundColor: teamColors.primary,
              color: teamColors.secondary
            }}
          >
            {saving ? 'Saving...' : 'Save Results'}
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors border-2"
            style={{
              backgroundColor: 'transparent',
              borderColor: teamColors.primary,
              color: teamColors.primary
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
