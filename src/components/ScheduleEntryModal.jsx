import { useState } from 'react'
import { teams } from '../data/teams'
import SearchableSelect from './SearchableSelect'

export default function ScheduleEntryModal({ isOpen, onClose, onSave, currentYear }) {
  const [schedule, setSchedule] = useState(
    Array.from({ length: 12 }, (_, i) => ({
      week: i + 1,
      opponent: '',
      location: 'home'
    }))
  )

  const addWeek = () => {
    if (schedule.length < 14) {
      setSchedule([
        ...schedule,
        { week: schedule.length + 1, opponent: '', location: 'home' }
      ])
    }
  }

  const removeWeek = (index) => {
    if (schedule.length > 1) {
      const newSchedule = schedule.filter((_, i) => i !== index)
      // Renumber weeks
      newSchedule.forEach((game, i) => {
        game.week = i + 1
      })
      setSchedule(newSchedule)
    }
  }

  const updateGame = (index, field, value) => {
    const newSchedule = [...schedule]
    newSchedule[index][field] = value
    setSchedule(newSchedule)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Validate all games have opponents
    const allFilled = schedule.every(game => game.opponent)
    if (!allFilled) {
      alert('Please select an opponent for all games')
      return
    }
    onSave(schedule)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Enter {currentYear} Season Schedule
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Add all opponents for the regular season (12-14 games)
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {schedule.map((game, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-20 text-sm font-medium text-gray-700">
                Week {game.week}
              </div>

              <div className="flex-1">
                <SearchableSelect
                  options={teams}
                  value={game.opponent}
                  onChange={(value) => updateGame(index, 'opponent', value)}
                  placeholder="Select opponent..."
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateGame(index, 'location', 'home')}
                  className={`px-3 py-2 rounded border-2 text-sm font-medium transition-colors ${
                    game.location === 'home'
                      ? 'border-team-primary bg-team-primary/10 text-team-primary'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => updateGame(index, 'location', 'away')}
                  className={`px-3 py-2 rounded border-2 text-sm font-medium transition-colors ${
                    game.location === 'away'
                      ? 'border-team-primary bg-team-primary/10 text-team-primary'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Away
                </button>
                <button
                  type="button"
                  onClick={() => updateGame(index, 'location', 'neutral')}
                  className={`px-3 py-2 rounded border-2 text-sm font-medium transition-colors ${
                    game.location === 'neutral'
                      ? 'border-team-primary bg-team-primary/10 text-team-primary'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Neutral
                </button>
              </div>

              {schedule.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWeek(index)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {schedule.length < 14 && (
            <button
              type="button"
              onClick={addWeek}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-team-primary/80 hover:text-team-primary transition-colors"
            >
              + Add Week {schedule.length + 1}
            </button>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-team-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-team-primary transition-colors"
            >
              Save Schedule
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
