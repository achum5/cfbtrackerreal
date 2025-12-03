import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'

export default function Stats() {
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  if (!currentDynasty) return null

  const getSeasonRecord = () => {
    const seasonGames = currentDynasty.games.filter(
      g => g.year === currentDynasty.currentYear
    )
    const wins = seasonGames.filter(g => g.result === 'win').length
    const losses = seasonGames.filter(g => g.result === 'loss').length
    return { wins, losses, total: `${wins}-${losses}` }
  }

  const getAllTimeRecord = () => {
    const wins = currentDynasty.games.filter(g => g.result === 'win').length
    const losses = currentDynasty.games.filter(g => g.result === 'loss').length
    return { wins, losses, total: `${wins}-${losses}` }
  }

  const seasonRecord = getSeasonRecord()
  const allTimeRecord = getAllTimeRecord()

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-6">
        {[
          { label: 'Overall Record', value: allTimeRecord.total, sub: 'All-Time' },
          { label: 'Season Record', value: seasonRecord.total, sub: currentDynasty.currentYear },
          { label: 'National Titles', value: '0', sub: 'Championships' },
          { label: 'Conference Titles', value: '0', sub: currentDynasty.conference }
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-lg shadow-md p-6"
            style={{
              backgroundColor: teamColors.secondary,
              border: `2px solid ${teamColors.primary}`
            }}
          >
            <div className="text-sm mb-1" style={{ color: secondaryBgText, opacity: 0.7 }}>{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: secondaryBgText }}>{stat.value}</div>
            <div className="text-xs mt-1" style={{ color: secondaryBgText, opacity: 0.6 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-6" style={{ color: secondaryBgText }}>
          Detailed Statistics
        </h2>

        <div className="text-center py-12">
          <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
            More Stats Coming Soon
          </h3>
          <p style={{ color: secondaryBgText, opacity: 0.8 }}>
            Detailed team and player statistics will be available here.
          </p>
        </div>
      </div>
    </div>
  )
}
