import { useState } from 'react'
import { teams } from '../data/teams'
import SearchableSelect from './SearchableSelect'

export default function GameEntryModal({ isOpen, onClose, onSave, weekNumber, currentYear }) {
  const [gameData, setGameData] = useState({
    opponent: '',
    location: 'home', // home, away, neutral
    result: '', // win, loss
    teamScore: '',
    opponentScore: '',
    week: weekNumber,
    year: currentYear
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(gameData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Enter Game Result - Week {weekNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Opponent */}
          <div>
            <SearchableSelect
              label="Opponent"
              options={teams}
              value={gameData.opponent}
              onChange={(value) => setGameData({ ...gameData, opponent: value })}
              placeholder="Search for opponent..."
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Game Location <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setGameData({ ...gameData, location: 'home' })}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  gameData.location === 'home'
                    ? 'border-team-primary bg-team-primary/10 text-team-primary'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => setGameData({ ...gameData, location: 'away' })}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  gameData.location === 'away'
                    ? 'border-team-primary bg-team-primary/10 text-team-primary'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Away
              </button>
              <button
                type="button"
                onClick={() => setGameData({ ...gameData, location: 'neutral' })}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  gameData.location === 'neutral'
                    ? 'border-team-primary bg-team-primary/10 text-team-primary'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Neutral
              </button>
            </div>
          </div>

          {/* Result */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Result <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGameData({ ...gameData, result: 'win' })}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  gameData.result === 'win'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Win
              </button>
              <button
                type="button"
                onClick={() => setGameData({ ...gameData, result: 'loss' })}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  gameData.result === 'loss'
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Loss
              </button>
            </div>
          </div>

          {/* Score */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="teamScore" className="block text-sm font-medium text-gray-700 mb-2">
                Your Score <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="teamScore"
                value={gameData.teamScore}
                onChange={(e) => setGameData({ ...gameData, teamScore: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-primary/80 focus:border-transparent"
                min="0"
                required
              />
            </div>
            <div>
              <label htmlFor="opponentScore" className="block text-sm font-medium text-gray-700 mb-2">
                Opponent Score <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="opponentScore"
                value={gameData.opponentScore}
                onChange={(e) => setGameData({ ...gameData, opponentScore: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-primary/80 focus:border-transparent"
                min="0"
                required
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-team-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-team-primary transition-colors"
            >
              Save Game
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
