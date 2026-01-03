import { getContrastTextColor } from '../utils/colorUtils'

export default function OverallProgressionModal({ isOpen, onClose, player, trainingResultsByYear, recruitOverallsByYear, teamColors, currentYear }) {
  if (!isOpen || !player) return null

  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  // Build progression history from training results and recruit overalls
  const buildProgressionHistory = () => {
    const history = []
    const playerName = player.name?.toLowerCase().trim()

    if (!playerName) return history

    // Track which years we've added to avoid duplicates
    const addedYears = new Set()

    // Check recruit overalls first (when they joined - this is their first overall)
    if (recruitOverallsByYear) {
      const sortedYears = Object.keys(recruitOverallsByYear).sort((a, b) => parseInt(a) - parseInt(b))
      for (const year of sortedYears) {
        const results = recruitOverallsByYear[year] || []
        const match = results.find(r =>
          (r.playerName?.toLowerCase().trim() === playerName) ||
          (r.name?.toLowerCase().trim() === playerName)
        )
        if (match && match.overall) {
          const yearNum = parseInt(year)
          // Use player.classByYear for accurate class, fallback to calculation only if not available
          const playerClass = player.classByYear?.[yearNum] || player.classByYear?.[String(yearNum)] || 'Fr'
          history.push({
            year: yearNum,
            playerClass,
            overall: parseInt(match.overall),
            type: 'recruit'
          })
          addedYears.add(yearNum)
        }
      }
    }

    // Check training results for each year
    // Training happens in offseason: pastOverall is for that year, newOverall is for next year
    if (trainingResultsByYear) {
      const sortedYears = Object.keys(trainingResultsByYear).sort((a, b) => parseInt(a) - parseInt(b))
      for (const year of sortedYears) {
        const results = trainingResultsByYear[year] || []
        const match = results.find(r =>
          r.playerName?.toLowerCase().trim() === playerName
        )
        if (match) {
          const yearNum = parseInt(year)

          // The pastOverall is what they were during that year (before training)
          // Only add if we don't already have this year from recruit overalls
          if (match.pastOverall && !addedYears.has(yearNum)) {
            const playerClass = player.classByYear?.[yearNum] || player.classByYear?.[String(yearNum)] || player.year
            history.push({
              year: yearNum,
              playerClass,
              overall: parseInt(match.pastOverall),
              type: 'season'
            })
            addedYears.add(yearNum)
          }

          // The newOverall is what they'll be for the NEXT year (training happens in offseason)
          if (match.newOverall) {
            const nextYear = yearNum + 1
            if (!addedYears.has(nextYear)) {
              const playerClass = player.classByYear?.[nextYear] || player.classByYear?.[String(nextYear)] || player.year
              history.push({
                year: nextYear,
                playerClass,
                overall: parseInt(match.newOverall),
                type: 'season'
              })
              addedYears.add(nextYear)
            }
          }
        }
      }
    }

    // Sort by year to ensure correct order
    history.sort((a, b) => a.year - b.year)

    // If we have no history but player has an overall, show current
    if (history.length === 0 && player.overall) {
      history.push({
        year: currentYear || null,
        playerClass: player.year,
        overall: parseInt(player.overall),
        type: 'current'
      })
    }

    return history
  }

  const progression = buildProgressionHistory()

  // Calculate total change
  const getOverallChange = () => {
    if (progression.length < 2) return null
    const first = progression[0].overall
    const last = progression[progression.length - 1].overall
    return last - first
  }

  const overallChange = getOverallChange()

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: teamColors.primary }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: primaryText }}>
              {player.name}
            </h2>
            <div className="text-sm opacity-80" style={{ color: primaryText }}>
              {player.position} • Overall Progression
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
        <div
          className="p-4"
          style={{ backgroundColor: teamColors.secondary }}
        >
          {progression.length > 0 ? (
            <div className="space-y-2">
              {progression.map((entry, idx) => {
                const prevOverall = idx > 0 ? progression[idx - 1].overall : null
                const change = prevOverall !== null ? entry.overall - prevOverall : null

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: teamColors.primary }}
                  >
                    {/* Year & Class */}
                    <div className="w-20 flex-shrink-0" style={{ color: primaryText }}>
                      <div className="text-xl font-bold">{entry.year || 'Current'}</div>
                      {entry.playerClass && (
                        <div className="text-xs opacity-70">{entry.playerClass}</div>
                      )}
                    </div>

                    {/* Progress Bar Visual */}
                    <div className="flex-1 relative">
                      <div
                        className="h-8 rounded-lg flex items-center justify-end px-3"
                        style={{
                          width: `${Math.max(40, (entry.overall / 99) * 100)}%`,
                          backgroundColor: entry.overall >= 85 ? '#22c55e' :
                                          entry.overall >= 75 ? '#3b82f6' :
                                          entry.overall >= 65 ? '#f59e0b' : '#ef4444',
                          transition: 'width 0.3s ease'
                        }}
                      >
                        <span className="text-white font-bold text-lg">{entry.overall}</span>
                      </div>
                    </div>

                    {/* Change Badge */}
                    <div className="w-12 flex-shrink-0 text-right">
                      {change !== null && change !== 0 && (
                        <span
                          className="inline-block text-sm font-bold px-2 py-1 rounded-lg"
                          style={{
                            backgroundColor: change > 0 ? '#22c55e' : '#ef4444',
                            color: '#ffffff'
                          }}
                        >
                          {change > 0 ? '+' : ''}{change}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Total change summary */}
              {overallChange !== null && overallChange !== 0 && progression.length > 1 && (
                <div
                  className="mt-3 p-4 rounded-xl text-center"
                  style={{
                    backgroundColor: overallChange > 0 ? '#22c55e' : '#ef4444',
                    color: '#ffffff'
                  }}
                >
                  <div className="flex items-center justify-center gap-4">
                    <div>
                      <div className="text-xs opacity-80">Started</div>
                      <div className="text-2xl font-bold">{progression[0].overall}</div>
                    </div>
                    <div className="text-2xl">→</div>
                    <div>
                      <div className="text-xs opacity-80">Now</div>
                      <div className="text-2xl font-bold">{progression[progression.length - 1].overall}</div>
                    </div>
                    <div className="border-l border-white/30 pl-4 ml-2">
                      <div className="text-xs opacity-80">Change</div>
                      <div className="text-2xl font-bold">
                        {overallChange > 0 ? '+' : ''}{overallChange}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="text-center py-8 rounded-xl"
              style={{ backgroundColor: teamColors.primary, color: primaryText, opacity: 0.7 }}
            >
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
