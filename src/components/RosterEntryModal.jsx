import { useState } from 'react'

const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P']
const years = ['FR', 'SO', 'JR', 'SR']

export default function RosterEntryModal({ isOpen, onClose, onSave }) {
  const [players, setPlayers] = useState([])
  const [currentPlayer, setCurrentPlayer] = useState({
    name: '',
    position: 'QB',
    year: 'FR',
    overall: ''
  })

  const addPlayer = () => {
    if (currentPlayer.name && currentPlayer.overall) {
      setPlayers([...players, { ...currentPlayer, id: Date.now().toString() }])
      setCurrentPlayer({ name: '', position: 'QB', year: 'FR', overall: '' })
    }
  }

  const removePlayer = (id) => {
    setPlayers(players.filter(p => p.id !== id))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (players.length === 0) {
      alert('Please add at least one player')
      return
    }
    onSave(players)
    onClose()
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPlayer()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Enter Roster
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Add key players you want to track throughout the season
            </p>
          </div>
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
          {/* Add Player Form */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Player</h3>
            <div className="grid grid-cols-12 gap-3">
              <input
                type="text"
                placeholder="Player Name"
                value={currentPlayer.name}
                onChange={(e) => setCurrentPlayer({ ...currentPlayer, name: e.target.value })}
                onKeyPress={handleKeyPress}
                className="col-span-4 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-primary/80 focus:border-transparent"
              />
              <select
                value={currentPlayer.position}
                onChange={(e) => setCurrentPlayer({ ...currentPlayer, position: e.target.value })}
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-primary/80 focus:border-transparent"
              >
                {positions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
              <select
                value={currentPlayer.year}
                onChange={(e) => setCurrentPlayer({ ...currentPlayer, year: e.target.value })}
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-primary/80 focus:border-transparent"
              >
                {years.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="OVR"
                value={currentPlayer.overall}
                onChange={(e) => setCurrentPlayer({ ...currentPlayer, overall: e.target.value })}
                onKeyPress={handleKeyPress}
                min="40"
                max="99"
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-primary/80 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addPlayer}
                className="col-span-2 bg-team-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-team-primary transition-colors"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter or click Add to add the player to your roster
            </p>
          </div>

          {/* Players List */}
          {players.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Roster ({players.length} players)
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="font-semibold text-gray-900 min-w-[200px]">
                        {player.name}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="font-medium">{player.position}</span>
                        <span>•</span>
                        <span>{player.year}</span>
                        <span>•</span>
                        <span className="font-semibold">{player.overall} OVR</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePlayer(player.id)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {players.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No players added yet. Add your first player above.
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-team-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-team-primary transition-colors"
              disabled={players.length === 0}
            >
              Save Roster ({players.length} players)
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
