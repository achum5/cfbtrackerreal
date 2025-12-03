import { useState, useRef, useEffect } from 'react'
import { getContrastTextColor } from '../utils/colorUtils'
import { teams } from '../data/teams'

function TeamDropdown({ value, onChange, onClose, teamColors }) {
  const [search, setSearch] = useState(value || '')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const filteredTeams = teams.filter(team =>
    team.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSelect = (team) => {
    onChange(team)
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.min(prev + 1, filteredTeams.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredTeams[highlightedIndex]) {
        handleSelect(filteredTeams[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Tab') {
      if (filteredTeams[highlightedIndex]) {
        handleSelect(filteredTeams[highlightedIndex])
      }
    }
  }

  return (
    <div ref={dropdownRef} className="absolute left-0 top-0 w-full z-50">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setHighlightedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 border-2 rounded-t-lg outline-none"
        style={{ borderColor: teamColors.primary }}
        placeholder="Search teams..."
      />
      <div 
        className="bg-white border-2 border-t-0 rounded-b-lg shadow-lg max-h-48 overflow-y-auto"
        style={{ borderColor: teamColors.primary }}
      >
        {filteredTeams.length === 0 ? (
          <div className="px-3 py-2 text-gray-500 text-sm">No teams found</div>
        ) : (
          filteredTeams.map((team, index) => (
            <div
              key={team}
              onClick={() => handleSelect(team)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === highlightedIndex ? 'text-white' : 'hover:bg-gray-100'
              }`}
              style={index === highlightedIndex ? { backgroundColor: teamColors.primary } : {}}
            >
              {team}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function ScheduleSpreadsheet({ teamColors, currentYear, onSave, onCancel }) {
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  const [rows, setRows] = useState(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      week: i + 1,
      opponent: '',
      location: 'home'
    }))
  )

  const [editingCell, setEditingCell] = useState(null)

  const updateRow = (id, field, value) => {
    setRows(rows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  const handleAddRow = () => {
    const newId = Math.max(...rows.map(r => r.id)) + 1
    setRows([...rows, { id: newId, week: rows.length + 1, opponent: '', location: 'home' }])
  }

  const handleRemoveLastRow = () => {
    if (rows.length > 1) {
      setRows(rows.slice(0, -1))
    }
  }

  const handleSave = () => {
    const validGames = rows.filter(row => row.opponent && row.opponent.trim() !== '')

    if (validGames.length === 0) {
      alert('Please add at least one opponent')
      return
    }

    const schedule = validGames.map(row => ({
      week: row.week,
      opponent: row.opponent.trim(),
      location: row.location
    }))

    onSave(schedule)
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-1" style={{ color: secondaryBgText }}>
          {currentYear} Season Schedule
        </h3>
        <p className="text-sm" style={{ color: secondaryBgText, opacity: 0.7 }}>
          Click on opponent cells to select a team from the list.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden mb-4" style={{ borderColor: `${teamColors.primary}40` }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: teamColors.primary }}>
              <th className="px-4 py-3 text-left text-sm font-semibold w-20" style={{ color: primaryBgText }}>Week</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: primaryBgText }}>Opponent</th>
              <th className="px-4 py-3 text-left text-sm font-semibold w-32" style={{ color: primaryBgText }}>Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr 
                key={row.id} 
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="px-4 py-2 text-sm font-medium text-gray-700">
                  {row.week}
                </td>
                <td className="px-4 py-2 relative">
                  {editingCell === `opponent-${row.id}` ? (
                    <TeamDropdown
                      value={row.opponent}
                      onChange={(team) => updateRow(row.id, 'opponent', team)}
                      onClose={() => setEditingCell(null)}
                      teamColors={teamColors}
                    />
                  ) : (
                    <div
                      onClick={() => setEditingCell(`opponent-${row.id}`)}
                      className="px-3 py-2 rounded cursor-pointer hover:bg-gray-100 min-h-[40px] flex items-center border"
                      style={{ borderColor: row.opponent ? 'transparent' : `${teamColors.primary}30` }}
                    >
                      {row.opponent || <span className="text-gray-400">Click to select team...</span>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={row.location}
                    onChange={(e) => updateRow(row.id, 'location', e.target.value)}
                    className="w-full px-3 py-2 rounded border cursor-pointer bg-white"
                    style={{ borderColor: `${teamColors.primary}30` }}
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleAddRow}
          className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
          style={{
            backgroundColor: `${teamColors.primary}20`,
            color: teamColors.primary
          }}
        >
          + Add Week
        </button>
        <button
          onClick={handleRemoveLastRow}
          className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
          style={{
            backgroundColor: `${secondaryBgText}10`,
            color: secondaryBgText
          }}
          disabled={rows.length <= 1}
        >
          - Remove Week
        </button>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors"
          style={{
            backgroundColor: `${secondaryBgText}20`,
            color: secondaryBgText
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors"
          style={{
            backgroundColor: teamColors.primary,
            color: primaryBgText
          }}
        >
          Save Schedule
        </button>
      </div>
    </div>
  )
}
