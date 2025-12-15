import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { getTeamLogo } from '../data/teams'
import { getContrastTextColor } from '../utils/colorUtils'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentDynasty, advanceWeek } = useDynasty()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const teamColors = useTeamColors(currentDynasty?.teamName)

  const isDynastyPage = location.pathname.startsWith('/dynasty/')
  const useTeamTheme = isDynastyPage && currentDynasty

  const headerBg = useTeamTheme ? teamColors.primary : '#1f2937'
  const headerText = useTeamTheme ? getContrastTextColor(teamColors.primary) : '#f9fafb'
  const buttonBg = useTeamTheme ? teamColors.secondary : '#f9fafb'
  const buttonText = useTeamTheme ? getContrastTextColor(teamColors.secondary) : '#1f2937'

  const getPhaseDisplay = (phase) => {
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      postseason: 'Post-Season',
      offseason: 'Off-Season'
    }
    return phases[phase] || phase
  }

  const canAdvanceFromPreseason = () => {
    if (!currentDynasty) return false
    return (
      currentDynasty.preseasonSetup?.scheduleEntered &&
      currentDynasty.preseasonSetup?.rosterEntered &&
      currentDynasty.preseasonSetup?.teamRatingsEntered
    )
  }

  const handleAdvanceWeek = () => {
    if (!currentDynasty) return

    console.log('=== ADVANCE WEEK CHECK ===')
    console.log('Current phase:', currentDynasty.currentPhase)
    console.log('preseasonSetup:', currentDynasty.preseasonSetup)
    console.log('scheduleEntered:', currentDynasty.preseasonSetup?.scheduleEntered)
    console.log('rosterEntered:', currentDynasty.preseasonSetup?.rosterEntered)
    console.log('Can advance:', canAdvanceFromPreseason())
    console.log('Schedule length:', currentDynasty.schedule?.length)
    console.log('Players length:', currentDynasty.players?.length)

    if (currentDynasty.currentPhase === 'preseason' && !canAdvanceFromPreseason()) {
      alert('Please complete schedule, roster, and team ratings before advancing to the regular season.')
      return
    }

    // In regular season, check if current week's game has been entered
    if (currentDynasty.currentPhase === 'regular_season') {
      const currentWeekGame = currentDynasty.games?.find(
        g => g.week === currentDynasty.currentWeek && g.year === currentDynasty.currentYear
      )

      if (!currentWeekGame) {
        alert(`Please enter the Week ${currentDynasty.currentWeek} game before advancing.`)
        return
      }
    }

    advanceWeek(currentDynasty.id)
  }


  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: useTeamTheme ? teamColors.primary : '#f3f4f6'
      }}
    >
      <header
        className="sticky top-0 z-50 shadow-sm"
        style={{ backgroundColor: headerBg }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-3">
              {useTeamTheme && (
                <button
                  onClick={() => window.toggleDynastySidebar?.()}
                  className="md:hidden p-2 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: headerText }}
                  aria-label="Toggle sidebar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}

              <Link
                to="/"
                className="text-xl font-bold whitespace-nowrap"
                style={{ color: headerText }}
              >
                CFB Dynasty Tracker
              </Link>
            </div>

            {useTeamTheme ? (
              <>
                <div className="flex items-center gap-2 md:gap-4 flex-1 justify-center">
                  {/* Team Logo and Name */}
                  <div className="flex items-center gap-2 md:gap-3">
                    {getTeamLogo(currentDynasty.teamName) && (
                      <div
                        className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: `2px solid ${teamColors.secondary}`,
                          padding: '3px'
                        }}
                      >
                        <img
                          src={getTeamLogo(currentDynasty.teamName)}
                          alt={`${currentDynasty.teamName} logo`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <span className="font-bold text-lg hidden md:inline" style={{ color: headerText }}>
                      {currentDynasty.teamName}
                    </span>
                  </div>

                  {/* Separator - hidden on mobile */}
                  <span className="hidden md:inline" style={{ color: headerText, opacity: 0.5 }}>•</span>

                  {/* Year - hidden on mobile */}
                  <div className="hidden md:flex items-center gap-2">
                    <span className="font-semibold" style={{ color: headerText }}>
                      {currentDynasty.currentYear}
                    </span>
                  </div>

                  {/* Separator - hidden on mobile */}
                  <span className="hidden md:inline" style={{ color: headerText, opacity: 0.5 }}>•</span>

                  {/* Phase and Week */}
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="font-medium text-sm md:text-base" style={{ color: headerText }}>
                      {getPhaseDisplay(currentDynasty.currentPhase)}
                    </span>
                    <span className="text-xs md:text-sm hidden md:inline" style={{ color: headerText, opacity: 0.8 }}>
                      Week {currentDynasty.currentWeek}
                    </span>
                  </div>
                </div>

                {/* Advance Week Button - right side */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAdvanceWeek}
                    className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-semibold hover:opacity-90 transition-colors shadow-sm text-xs md:text-sm whitespace-nowrap"
                    style={{
                      backgroundColor: buttonBg,
                      color: buttonText
                    }}
                  >
                    Advance<span className="hidden sm:inline"> Week</span>
                  </button>
                  {user && (
                    <button
                      onClick={handleSignOut}
                      className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                      style={{ color: headerText }}
                      title="Sign out"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-white/20 whitespace-nowrap"
                    style={{ color: headerText }}
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-white/20 whitespace-nowrap"
                    style={{ color: headerText }}
                  >
                    Sign In
                  </Link>
                )}
              </div>
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
