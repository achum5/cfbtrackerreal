import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchableSelect from '../components/SearchableSelect'
import ConferenceSelect from '../components/ConferenceSelect'
import { teams } from '../data/teams'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { getTeamColors } from '../data/teamColors'

export default function CreateDynasty() {
  const navigate = useNavigate()
  const { createDynasty } = useDynasty()
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    teamName: '',
    conference: '',
    coachName: '',
    coachPosition: 'HC',
    startYear: '2026'
  })
  const [creating, setCreating] = useState(false)

  const selectedTeamColors = formData.teamName 
    ? getTeamColors(formData.teamName) 
    : { primary: '#1f2937', secondary: '#ffffff' }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCreating(true)

    try {
      const newDynasty = await createDynasty(formData)
      console.log('Dynasty created:', newDynasty)
      navigate(`/dynasty/${newDynasty.id}`)
    } catch (error) {
      console.error('Failed to create dynasty:', error)
      alert(`Failed to create dynasty: ${error.message}`)
      setCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div 
        className="rounded-lg shadow-lg p-8 transition-colors duration-300"
        style={{ 
          backgroundColor: selectedTeamColors.secondary,
          border: `3px solid ${selectedTeamColors.primary}`
        }}
      >
        <h1
          className="text-3xl font-bold mb-6 transition-colors duration-300"
          style={{ color: selectedTeamColors.primary }}
        >
          Create New Dynasty
        </h1>

        {user ? (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border-2 border-green-500">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-green-900">Google Sheets Integration Enabled</p>
                <p className="text-sm text-green-700 mt-1">
                  Your dynasty will automatically create a Google Sheet for schedule and roster management.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 border-2 border-yellow-500">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-yellow-900">Sign in for Google Sheets</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Sign in with Google to enable automatic Google Sheets creation for your dynasty. Otherwise, you'll use the built-in spreadsheet.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <SearchableSelect
              label="Team Name"
              options={teams}
              value={formData.teamName}
              onChange={(value) => setFormData({ ...formData, teamName: value })}
              placeholder="Search for your team..."
              required
              teamColors={selectedTeamColors}
            />
          </div>

          <div>
            <ConferenceSelect
              label="Conference"
              value={formData.conference}
              onChange={(value) => setFormData({ ...formData, conference: value })}
              required
              teamColors={selectedTeamColors}
            />
          </div>

          <div>
            <label
              htmlFor="coachName"
              className="block text-sm font-medium mb-2 transition-colors duration-300"
              style={{ color: selectedTeamColors.primary }}
            >
              Coach Name
            </label>
            <input
              type="text"
              id="coachName"
              name="coachName"
              value={formData.coachName}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:outline-none transition-colors"
              style={{
                borderColor: `${selectedTeamColors.primary}40`
              }}
              placeholder="Coach Smith"
              required
            />
          </div>

          <div>
            <label
              htmlFor="coachPosition"
              className="block text-sm font-medium mb-2 transition-colors duration-300"
              style={{ color: selectedTeamColors.primary }}
            >
              Coaching Position
            </label>
            <select
              id="coachPosition"
              name="coachPosition"
              value={formData.coachPosition}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:outline-none transition-colors bg-white"
              style={{
                borderColor: `${selectedTeamColors.primary}40`
              }}
              required
            >
              <option value="HC">Head Coach (HC)</option>
              <option value="OC">Offensive Coordinator (OC)</option>
              <option value="DC">Defensive Coordinator (DC)</option>
            </select>
          </div>

          <div>
            <label 
              htmlFor="startYear" 
              className="block text-sm font-medium mb-2 transition-colors duration-300"
              style={{ color: selectedTeamColors.primary }}
            >
              Starting Year
            </label>
            <input
              type="number"
              id="startYear"
              name="startYear"
              value={formData.startYear}
              onChange={handleChange}
              min="2024"
              max="2099"
              className="w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:outline-none transition-colors"
              style={{ 
                borderColor: `${selectedTeamColors.primary}40`
              }}
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-6 py-3 rounded-lg font-semibold transition-colors shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: selectedTeamColors.primary,
                color: selectedTeamColors.secondary
              }}
            >
              {creating ? 'Creating Dynasty...' : 'Create Dynasty'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 border-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              style={{ 
                borderColor: selectedTeamColors.primary,
                color: selectedTeamColors.primary
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
