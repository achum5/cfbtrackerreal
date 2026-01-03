import { useState } from 'react'
import { getContrastTextColor } from '../utils/colorUtils'

// Class progression order for calculating expected class
const CLASS_ORDER = ['Fr', 'So', 'Jr', 'Sr', 'RS Sr']
const RS_CLASS_ORDER = ['RS Fr', 'RS So', 'RS Jr', 'RS Sr']

function getExpectedClass(baseClass, baseYear, targetYear) {
  const yearDiff = targetYear - baseYear
  if (yearDiff === 0) return baseClass

  const isRS = baseClass?.startsWith('RS ')
  const order = isRS ? RS_CLASS_ORDER : CLASS_ORDER
  const baseIndex = order.indexOf(baseClass)

  if (baseIndex === -1) return baseClass // Unknown class, return as-is

  const targetIndex = Math.min(baseIndex + yearDiff, order.length - 1)
  return order[targetIndex]
}

export default function OverallProgressionModal({
  isOpen,
  onClose,
  player,
  trainingResultsByYear,
  recruitOverallsByYear,
  teamColors,
  currentYear,
  onSave // New prop for saving changes
}) {
  const [editingYear, setEditingYear] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isOpen || !player) return null

  const primaryText = getContrastTextColor(teamColors.primary)

  // Build progression history from multiple sources
  const buildProgressionHistory = () => {
    const history = []
    const playerName = player.name?.toLowerCase().trim()
    const addedYears = new Set()

    if (!playerName) return history

    // PRIMARY SOURCE: player.overallByYear (new canonical storage)
    if (player.overallByYear) {
      Object.entries(player.overallByYear).forEach(([year, overall]) => {
        const yearNum = parseInt(year)
        if (!isNaN(yearNum) && overall) {
          history.push({
            year: yearNum,
            overall: parseInt(overall),
            source: 'overallByYear'
          })
          addedYears.add(yearNum)
        }
      })
    }

    // FALLBACK: Check recruit overalls
    if (recruitOverallsByYear) {
      const sortedYears = Object.keys(recruitOverallsByYear).sort((a, b) => parseInt(a) - parseInt(b))
      for (const year of sortedYears) {
        const yearNum = parseInt(year)
        if (addedYears.has(yearNum)) continue

        const results = recruitOverallsByYear[year] || []
        const match = results.find(r =>
          (r.playerName?.toLowerCase().trim() === playerName) ||
          (r.name?.toLowerCase().trim() === playerName)
        )
        if (match && match.overall) {
          history.push({
            year: yearNum,
            overall: parseInt(match.overall),
            source: 'recruitOveralls'
          })
          addedYears.add(yearNum)
        }
      }
    }

    // FALLBACK: Check training results
    if (trainingResultsByYear) {
      const sortedYears = Object.keys(trainingResultsByYear).sort((a, b) => parseInt(a) - parseInt(b))
      for (const year of sortedYears) {
        const results = trainingResultsByYear[year] || []
        const match = results.find(r =>
          r.playerName?.toLowerCase().trim() === playerName
        )
        if (match) {
          const yearNum = parseInt(year)

          if (match.pastOverall && !addedYears.has(yearNum)) {
            history.push({
              year: yearNum,
              overall: parseInt(match.pastOverall),
              source: 'trainingResults'
            })
            addedYears.add(yearNum)
          }

          if (match.newOverall) {
            const nextYear = yearNum + 1
            if (!addedYears.has(nextYear)) {
              history.push({
                year: nextYear,
                overall: parseInt(match.newOverall),
                source: 'trainingResults'
              })
              addedYears.add(nextYear)
            }
          }
        }
      }
    }

    // Sort by year
    history.sort((a, b) => a.year - b.year)

    // If no history but player has overall, show current
    if (history.length === 0 && player.overall) {
      history.push({
        year: currentYear || new Date().getFullYear(),
        overall: parseInt(player.overall),
        source: 'current'
      })
    }

    // Calculate classes based on progression from first known class
    const firstKnownYear = history.length > 0 ? history[0].year : null
    const baseClass = firstKnownYear
      ? (player.classByYear?.[firstKnownYear] || player.classByYear?.[String(firstKnownYear)] || player.year)
      : player.year

    history.forEach(entry => {
      // Try to get from classByYear first
      const storedClass = player.classByYear?.[entry.year] || player.classByYear?.[String(entry.year)]
      if (storedClass) {
        entry.playerClass = storedClass
      } else if (firstKnownYear) {
        // Calculate expected class based on progression
        entry.playerClass = getExpectedClass(baseClass, firstKnownYear, entry.year)
      } else {
        entry.playerClass = player.year
      }
    })

    return history
  }

  const progression = buildProgressionHistory()

  const getOverallChange = () => {
    if (progression.length < 2) return null
    return progression[progression.length - 1].overall - progression[0].overall
  }

  const overallChange = getOverallChange()
  const startOverall = progression.length > 0 ? progression[0].overall : null
  const currentOverall = progression.length > 0 ? progression[progression.length - 1].overall : null

  const getOverallColor = (ovr) => {
    if (ovr >= 85) return '#22c55e'
    if (ovr >= 75) return '#3b82f6'
    if (ovr >= 65) return '#f59e0b'
    return '#ef4444'
  }

  const handleEdit = (year, overall) => {
    setEditingYear(year)
    setEditValue(String(overall))
  }

  const handleSave = async () => {
    if (!onSave || editingYear === null) return

    const newOverall = parseInt(editValue)
    if (isNaN(newOverall) || newOverall < 1 || newOverall > 99) return

    setSaving(true)
    try {
      // Build the new overallByYear object
      const newOverallByYear = { ...(player.overallByYear || {}) }
      newOverallByYear[editingYear] = newOverall

      // Also update current overall if editing current year
      const updates = { overallByYear: newOverallByYear }
      if (editingYear === currentYear) {
        updates.overall = newOverall
      }

      await onSave(player, updates)
      setEditingYear(null)
      setEditValue('')
    } catch (err) {
      console.error('Failed to save overall:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingYear(null)
    setEditValue('')
  }

  const handleAddYear = async (year) => {
    if (!onSave) return

    // Find the closest year's overall as a starting point
    let defaultOverall = player.overall || 70
    const closestEntry = progression.find(p => p.year === year - 1) || progression.find(p => p.year === year + 1)
    if (closestEntry) defaultOverall = closestEntry.overall

    handleEdit(year, defaultOverall)
  }

  // Check for gaps in years that could be added
  const getAddableYears = () => {
    if (progression.length === 0) return []
    const years = progression.map(p => p.year)
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years, currentYear)
    const addable = []
    for (let y = minYear; y <= maxYear; y++) {
      if (!years.includes(y)) addable.push(y)
    }
    return addable
  }

  const addableYears = getAddableYears()

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: teamColors.primary }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-lg"
              style={{ backgroundColor: getOverallColor(currentOverall) }}
            >
              {currentOverall || '—'}
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: primaryText }}>
                {player.name}
              </h2>
              <div className="text-sm opacity-80" style={{ color: primaryText }}>
                {player.position} • {player.year}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
            style={{ color: primaryText }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {progression.length > 1 ? (
            <>
              {/* Summary Card */}
              <div className="flex items-center justify-between mb-5 p-4 rounded-xl bg-gray-50">
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Start</div>
                  <div className="text-3xl font-bold" style={{ color: getOverallColor(startOverall) }}>
                    {startOverall}
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center px-4">
                  <div className="flex-1 h-1 rounded-full bg-gray-200 relative mx-2">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: '100%',
                        background: `linear-gradient(to right, ${getOverallColor(startOverall)}, ${getOverallColor(currentOverall)})`
                      }}
                    />
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Now</div>
                  <div className="text-3xl font-bold" style={{ color: getOverallColor(currentOverall) }}>
                    {currentOverall}
                  </div>
                </div>
                <div
                  className="ml-4 px-3 py-2 rounded-lg font-bold text-lg"
                  style={{
                    backgroundColor: overallChange > 0 ? '#dcfce7' : overallChange < 0 ? '#fee2e2' : '#f3f4f6',
                    color: overallChange > 0 ? '#16a34a' : overallChange < 0 ? '#dc2626' : '#6b7280'
                  }}
                >
                  {overallChange > 0 ? '+' : ''}{overallChange}
                </div>
              </div>

              {/* Timeline */}
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Progression History</div>
              <div className="space-y-0">
                {progression.map((entry, idx) => {
                  const prevOverall = idx > 0 ? progression[idx - 1].overall : null
                  const change = prevOverall !== null ? entry.overall - prevOverall : null
                  const isLast = idx === progression.length - 1
                  const isEditing = editingYear === entry.year

                  return (
                    <div key={idx} className="flex items-stretch">
                      {/* Timeline Line */}
                      <div className="flex flex-col items-center mr-4">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow"
                          style={{ backgroundColor: getOverallColor(entry.overall) }}
                        />
                        {!isLast && (
                          <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-4`}>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-semibold text-gray-900">{entry.year}</div>
                              <div className="text-sm text-gray-500">{entry.playerClass}</div>
                            </div>
                            <div className="flex-1" />
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-16 px-2 py-1 text-center text-lg font-bold border-2 border-blue-500 rounded-lg"
                              autoFocus
                            />
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1.5 rounded-lg bg-gray-300 text-gray-700 hover:bg-gray-400"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <div>
                              <div className="font-semibold text-gray-900">{entry.year}</div>
                              <div className="text-sm text-gray-500">{entry.playerClass}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xl font-bold"
                                style={{ color: getOverallColor(entry.overall) }}
                              >
                                {entry.overall}
                              </span>
                              {change !== null && change !== 0 && (
                                <span
                                  className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: change > 0 ? '#dcfce7' : '#fee2e2',
                                    color: change > 0 ? '#16a34a' : '#dc2626'
                                  }}
                                >
                                  {change > 0 ? '+' : ''}{change}
                                </span>
                              )}
                              {onSave && (
                                <button
                                  onClick={() => handleEdit(entry.year, entry.overall)}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-opacity"
                                  title="Edit overall"
                                >
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add missing years */}
              {onSave && addableYears.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">Add missing year:</div>
                  <div className="flex flex-wrap gap-2">
                    {addableYears.map(year => (
                      <button
                        key={year}
                        onClick={() => handleAddYear(year)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
                      >
                        + {year}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : progression.length === 1 ? (
            <div className="text-center py-6">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-3xl text-white shadow-lg mx-auto mb-3 relative group cursor-pointer"
                style={{ backgroundColor: getOverallColor(progression[0].overall) }}
                onClick={() => onSave && handleEdit(progression[0].year, progression[0].overall)}
              >
                {editingYear === progression[0].year ? (
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-16 text-center text-2xl font-bold bg-transparent text-white border-b-2 border-white"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    {progression[0].overall}
                    {onSave && (
                      <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                    )}
                  </>
                )}
              </div>
              {editingYear === progression[0].year && (
                <div className="flex justify-center gap-2 mb-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1 rounded-lg bg-gray-300 text-gray-700 text-sm hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="text-gray-600">
                {progression[0].year ? `${progression[0].playerClass} • ${progression[0].year}` : progression[0].playerClass}
              </div>
              <div className="text-sm text-gray-400 mt-2">
                {onSave ? 'Click to edit • ' : ''}No progression history yet
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              No progression history available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
