import { Link, useLocation } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { getTeamLogo } from '../data/teams'

export default function Layout({ children, onAdvanceWeek }) {
  const location = useLocation()
  const { currentDynasty } = useDynasty()

  const teamColors = useTeamColors(currentDynasty?.teamName)

  const isDynastyPage = location.pathname.startsWith('/dynasty/')
  const useTeamTheme = isDynastyPage && currentDynasty

  const headerBg = useTeamTheme ? teamColors.primary : '#1f2937'
  const headerText = useTeamTheme ? teamColors.secondary : '#f9fafb'

  const getPhaseDisplay = (phase) => {
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      postseason: 'Post-Season',
      offseason: 'Off-Season'
    }
    return phases[phase] || phase
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: useTeamTheme ? teamColors.primary : '#f3f4f6'
      }}
    >
      <header
        className="shadow-sm"
        style={{ backgroundColor: headerBg }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <Link
              to="/"
              className="text-xl font-bold"
              style={{ color: headerText }}
            >
              CFB Dynasty Tracker
            </Link>

            {isDynastyPage && currentDynasty && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  {getTeamLogo(currentDynasty.teamName) && (
                    <img
                      src={getTeamLogo(currentDynasty.teamName)}
                      alt={`${currentDynasty.teamName} logo`}
                      className="w-10 h-10 object-contain"
                    />
                  )}
                  <div>
                    <div className="font-bold text-lg" style={{ color: headerText }}>
                      {currentDynasty.teamName}
                    </div>
                    <div className="text-xs opacity-80" style={{ color: headerText }}>
                      {currentDynasty.currentYear} • {getPhaseDisplay(currentDynasty.currentPhase)} • Week {currentDynasty.currentWeek}
                    </div>
                  </div>
                </div>

                {onAdvanceWeek && (
                  <button
                    onClick={onAdvanceWeek}
                    className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm shadow-md"
                    style={{
                      backgroundColor: teamColors.secondary,
                      color: teamColors.primary
                    }}
                  >
                    Advance Week
                  </button>
                )}
              </div>
            )}

            {!isDynastyPage && (
              <Link
                to="/create"
                className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-white/20"
                style={{ color: headerText }}
              >
                + New
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
