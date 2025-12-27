import { getContrastTextColor } from '../utils/colorUtils'

// Class progression order (for calculating class by year)
const CLASS_ORDER = ['Fr', 'So', 'Jr', 'Sr']
const RS_CLASS_ORDER = ['RS Fr', 'RS So', 'RS Jr', 'RS Sr']

export default function OverallProgressionModal({ isOpen, onClose, player, trainingResultsByYear, recruitOverallsByYear, teamColors, currentYear }) {
  if (!isOpen || !player) return null

  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  // Calculate what class a player was in a given year based on their current class and current year
  const getClassForYear = (targetYear) => {
    if (!player.year || !currentYear) return null

    const yearDiff = currentYear - targetYear
    const currentClass = player.year

    // Check if player uses redshirt progression
    const isRedshirt = currentClass.startsWith('RS ')
    const baseClass = isRedshirt ? currentClass.replace('RS ', '') : currentClass

    // Find current position in class order
    const classOrder = isRedshirt ? RS_CLASS_ORDER : CLASS_ORDER
    const baseOrder = CLASS_ORDER
    const currentIdx = baseOrder.indexOf(baseClass)

    if (currentIdx === -1) return currentClass

    // Calculate target class index
    const targetIdx = currentIdx - yearDiff

    if (targetIdx < 0) return 'Fr' // Before they started
    if (targetIdx >= baseOrder.length) return baseOrder[baseOrder.length - 1]

    // Return the class, maintaining RS prefix if applicable
    const targetBaseClass = baseOrder[targetIdx]
    return isRedshirt ? `RS ${targetBaseClass}` : targetBaseClass
  }

  // Build progression history from training results
  const buildProgressionHistory = () => {
    const history = []
    const playerName = player.name?.toLowerCase().trim()

    if (!playerName) return history

    // Check recruit overalls first (when they joined)
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
          history.push({
            year: yearNum,
            playerClass: getClassForYear(yearNum) || 'Fr',
            overall: match.overall,
            type: 'recruit'
          })
        }
      }
    }

    // Check training results for each year
    // Training happens in offseason: currentOverall is for that year, newOverall is for next year
    if (trainingResultsByYear) {
      const sortedYears = Object.keys(trainingResultsByYear).sort((a, b) => parseInt(a) - parseInt(b))
      for (const year of sortedYears) {
        const results = trainingResultsByYear[year] || []
        const match = results.find(r =>
          r.playerName?.toLowerCase().trim() === playerName
        )
        if (match) {
          const yearNum = parseInt(year)

          // The currentOverall is what they were during that year
          if (match.currentOverall && history.length === 0) {
            history.push({
              year: yearNum,
              playerClass: getClassForYear(yearNum) || player.year,
              overall: match.currentOverall,
              type: 'season'
            })
          }

          // The newOverall is what they'll be for the NEXT year (training happens in offseason)
          if (match.newOverall) {
            const nextYear = yearNum + 1
            history.push({
              year: nextYear,
              playerClass: getClassForYear(nextYear) || player.year,
              overall: match.newOverall,
              type: 'season'
            })
          }
        }
      }
    }

    // If we have no history but player has an overall, show current
    if (history.length === 0 && player.overall) {
      history.push({
        year: currentYear || null,
        playerClass: player.year,
        overall: player.overall,
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
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-md p-6"
        style={{ backgroundColor: teamColors.secondary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: secondaryText }}>
            Overall Progression
          </h2>
          <button
            onClick={onClose}
            className="hover:opacity-70"
            style={{ color: secondaryText }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="text-lg font-semibold" style={{ color: secondaryText }}>{player.name}</div>
          <div className="text-sm" style={{ color: secondaryText, opacity: 0.7 }}>
            {player.position} • {player.year}
          </div>
        </div>

        {progression.length > 0 ? (
          <div className="space-y-3">
            {progression.map((entry, idx) => {
              const prevOverall = idx > 0 ? progression[idx - 1].overall : null
              const change = prevOverall !== null ? entry.overall - prevOverall : null

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: teamColors.primary }}
                >
                  <div style={{ color: primaryText }}>
                    <div className="font-bold text-lg">{entry.year || 'Current'}</div>
                    {entry.playerClass && (
                      <div className="text-sm opacity-80">{entry.playerClass}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold" style={{ color: primaryText }}>
                      {entry.overall}
                    </div>
                    {change !== null && change !== 0 && (
                      <div
                        className="text-sm font-semibold px-2 py-1 rounded"
                        style={{
                          backgroundColor: change > 0 ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {change > 0 ? '+' : ''}{change}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Total change summary */}
            {overallChange !== null && overallChange !== 0 && (
              <div
                className="mt-4 p-3 rounded-lg text-center"
                style={{
                  backgroundColor: overallChange > 0 ? '#22c55e' : '#ef4444',
                  color: '#ffffff'
                }}
              >
                <div className="text-sm">Total Change</div>
                <div className="text-2xl font-bold">
                  {overallChange > 0 ? '+' : ''}{overallChange}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="text-center py-8"
            style={{ color: secondaryText, opacity: 0.7 }}
          >
            No progression history available
          </div>
        )}
      </div>
    </div>
  )
}
