import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'

export default function TeamHistory() {
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  if (!currentDynasty) return null

  return (
    <div className="space-y-6">
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-6" style={{ color: secondaryBgText }}>
          Team History
        </h2>

        <div className="text-center py-12">
          <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
            Team History Coming Soon
          </h3>
          <p style={{ color: secondaryBgText, opacity: 0.8 }} className="max-w-md mx-auto">
            View every season coached with this program including records, achievements, and season statistics.
          </p>
        </div>
      </div>
    </div>
  )
}
