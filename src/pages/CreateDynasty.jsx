import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchableSelect from '../components/SearchableSelect'
import ConferenceSelect from '../components/ConferenceSelect'
import { teams } from '../data/teams'
import { useDynasty } from '../context/DynastyContext'
import { getTeamColors } from '../data/teamColors'

export default function CreateDynasty() {
  const navigate = useNavigate()
  const { createDynasty } = useDynasty()
  
  const [formData, setFormData] = useState({
    teamName: '',
    conference: '',
    coachName: '',
    startYear: '2026'
  })

  const selectedTeamColors = formData.teamName 
    ? getTeamColors(formData.teamName) 
    : { primary: '#1f2937', secondary: '#ffffff' }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newDynasty = createDynasty(formData)
    navigate(`/dynasty/${newDynasty.id}`)
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
              className="flex-1 px-6 py-3 rounded-lg font-semibold transition-colors shadow-md hover:opacity-90"
              style={{ 
                backgroundColor: selectedTeamColors.primary,
                color: selectedTeamColors.secondary
              }}
            >
              Create Dynasty
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
