import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'

export default function Recruiting() {
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
          Recruiting History
        </h2>

        <div className="text-center py-12">
          <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
            Recruiting History Coming Soon
          </h3>
          <p style={{ color: secondaryBgText, opacity: 0.8 }} className="max-w-md mx-auto">
            Track recruiting classes by year with rankings, star ratings, and recruit details.
          </p>
        </div>
      </div>
    </div>
  )
}
