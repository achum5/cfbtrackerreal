import { useState, useMemo } from 'react'
import DataGrid from 'react-data-grid'
import 'react-data-grid/lib/styles.css'
import { getContrastTextColor } from '../utils/colorUtils'
import { teams } from '../data/teams'

const LOCATION_OPTIONS = ['home', 'away', 'neutral']

function OpponentEditor({ row, onRowChange, onClose }) {
  const [search, setSearch] = useState(row.opponent || '')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const filteredTeams = teams.filter(team =>
    team.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (team) => {
    onRowChange({ ...row, opponent: team })
    onClose(true)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev =>
        prev < filteredTeams.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredTeams.length > 0) {
        handleSelect(filteredTeams[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose(false)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (filteredTeams.length > 0) {
        handleSelect(filteredTeams[highlightedIndex])
      }
    }
  }

  const handleChange = (e) => {
    setSearch(e.target.value)
    setHighlightedIndex(0) // Reset highlight when typing
  }

  return (
    <div className="relative w-full h-full">
      <input
        type="text"
        className="w-full h-full px-2 outline-none"
        value={search}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder="Type to search teams..."
      />
      {filteredTeams.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 shadow-lg max-h-60 overflow-y-auto z-50">
          {filteredTeams.map((team, index) => (
            <div
              key={team}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === highlightedIndex
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-blue-50'
              }`}
              onClick={() => handleSelect(team)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {team}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ScheduleSpreadsheet({ teamColors, currentYear, onSave, onCancel }) {
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  const [rows, setRows] = useState([
    { id: 1, week: 1, opponent: '', location: 'home' },
    { id: 2, week: 2, opponent: '', location: 'home' },
    { id: 3, week: 3, opponent: '', location: 'home' },
    { id: 4, week: 4, opponent: '', location: 'home' },
    { id: 5, week: 5, opponent: '', location: 'home' },
    { id: 6, week: 6, opponent: '', location: 'home' },
    { id: 7, week: 7, opponent: '', location: 'home' },
    { id: 8, week: 8, opponent: '', location: 'home' },
    { id: 9, week: 9, opponent: '', location: 'home' },
    { id: 10, week: 10, opponent: '', location: 'home' },
    { id: 11, week: 11, opponent: '', location: 'home' },
    { id: 12, week: 12, opponent: '', location: 'home' },
  ])

  const columns = useMemo(() => [
    {
      key: 'week',
      name: 'Week',
      width: 80,
      editable: true,
    },
    {
      key: 'opponent',
      name: 'Opponent',
      editable: true,
      renderEditCell: (props) => (
        <OpponentEditor {...props} />
      )
    },
    {
      key: 'location',
      name: 'Location',
      width: 120,
      editable: true,
      renderEditCell: (props) => {
        return (
          <select
            className="w-full h-full px-2 outline-none"
            value={props.row.location}
            onChange={(e) => props.onRowChange({ ...props.row, location: e.target.value })}
            autoFocus
          >
            <option value="home">Home</option>
            <option value="away">Away</option>
            <option value="neutral">Neutral</option>
          </select>
        )
      }
    },
  ], [])

  const handleRowsChange = (newRows) => {
    setRows(newRows)
  }

  const handleAddRow = () => {
    const newWeek = rows.length + 1
    setRows([...rows, { id: rows.length + 1, week: newWeek, opponent: '', location: 'home' }])
  }

  const handleRemoveLastRow = () => {
    if (rows.length > 1) {
      setRows(rows.slice(0, -1))
    }
  }

  const handleSave = () => {
    // Filter out empty rows
    const validGames = rows.filter(row => row.opponent && row.opponent.trim() !== '')

    if (validGames.length === 0) {
      alert('Please add at least one opponent')
      return
    }

    const schedule = validGames.map(row => ({
      week: parseInt(row.week) || row.id,
      opponent: row.opponent.trim(),
      location: LOCATION_OPTIONS.includes(row.location) ? row.location : 'home'
    }))

    onSave(schedule)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2" style={{ color: secondaryBgText }}>
          {currentYear} Season Schedule
        </h3>
        <p className="text-sm mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>
          Enter opponents for each week. You can paste from Excel/Google Sheets.
        </p>
        <div className="text-xs" style={{ color: secondaryBgText, opacity: 0.7 }}>
          <strong>Tips:</strong> Click cells to edit • Use Tab/Enter to navigate • Copy-paste from spreadsheets works!
        </div>
      </div>

      <div className="flex-1 mb-4" style={{ minHeight: '400px' }}>
        <DataGrid
          columns={columns}
          rows={rows}
          onRowsChange={handleRowsChange}
          className="rdg-light"
          style={{
            height: '400px',
            '--rdg-selection-color': teamColors.primary,
            '--rdg-background-color': '#ffffff',
            '--rdg-header-background-color': teamColors.secondary,
            '--rdg-row-hover-background-color': `${teamColors.primary}15`,
          }}
        />
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
