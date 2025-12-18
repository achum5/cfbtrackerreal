import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { useAuth } from '../context/AuthContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { getTeamLogo } from '../data/teams'
import { getContrastTextColor } from '../utils/colorUtils'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentDynasty, advanceWeek, revertWeek } = useDynasty()
  const { user, signOut } = useAuth()
  const [showWeekDropdown, setShowWeekDropdown] = useState(false)

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
  const isCFPBracketPage = location.pathname.includes('/cfp-bracket')

  const headerBg = useTeamTheme ? teamColors.primary : '#1f2937'
  const headerText = useTeamTheme ? getContrastTextColor(teamColors.primary) : '#f9fafb'
  const buttonBg = useTeamTheme ? teamColors.secondary : '#f9fafb'
  const buttonText = useTeamTheme ? getContrastTextColor(teamColors.secondary) : '#1f2937'

  const getPhaseDisplay = (phase, week) => {
    if (phase === 'postseason') {
      return `Bowl Week ${week}`
    }
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      conference_championship: 'Conference Championships',
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

    // In conference championship phase, check if user has answered the question
    if (currentDynasty.currentPhase === 'conference_championship') {
      const ccData = currentDynasty.conferenceChampionshipData
      // If they haven't answered whether they made the championship yet
      if (ccData?.madeChampionship === undefined || ccData?.madeChampionship === null) {
        alert('Please answer whether you made the conference championship before advancing.')
        return
      }
      // If they made the championship, check if they entered the game
      if (ccData?.madeChampionship === true) {
        const ccGame = currentDynasty.games?.find(
          g => g.isConferenceChampionship && g.year === currentDynasty.currentYear
        )
        if (!ccGame) {
          alert('Please enter your conference championship game before advancing.')
          return
        }
      }
    }

    // In postseason, check if all 10 CC results have been entered
    if (currentDynasty.currentPhase === 'postseason') {
      const ccResults = currentDynasty.conferenceChampionships?.filter(cc => cc.team1 && cc.team2) || []
      const enteredCount = ccResults.length

      if (enteredCount < 10) {
        const confirmAdvance = window.confirm(
          `You have only entered ${enteredCount}/10 Conference Championship results. Are you sure you want to advance?`
        )
        if (!confirmAdvance) {
          return
        }
      }
    }

    advanceWeek(currentDynasty.id)
    setShowWeekDropdown(false)
  }

  const handleRevertWeek = () => {
    if (!currentDynasty) return

    // Confirm before reverting
    const confirmMessage = currentDynasty.currentPhase === 'preseason' && currentDynasty.currentWeek === 0
      ? 'This will revert to the previous year\'s offseason. Any data from this preseason will be lost. Continue?'
      : 'This will go back one week and remove any game data from the current week. Continue?'

    if (!window.confirm(confirmMessage)) {
      setShowWeekDropdown(false)
      return
    }

    revertWeek(currentDynasty.id)
    setShowWeekDropdown(false)
  }


  // Page background - CFP Bracket gets dark gray, otherwise team primary
  const pageBg = isCFPBracketPage ? '#374151' : (useTeamTheme ? teamColors.primary : '#f3f4f6')

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: pageBg }}
    >
      <header
        className="sticky top-0 z-50 shadow-sm"
        style={{
          backgroundColor: headerBg,
          borderBottom: useTeamTheme ? `3px solid ${teamColors.secondary}` : '3px solid #374151'
        }}
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
                      {getPhaseDisplay(currentDynasty.currentPhase, currentDynasty.currentWeek)}
                    </span>
                    {currentDynasty.currentPhase !== 'postseason' && (
                      <span className="text-xs md:text-sm hidden md:inline" style={{ color: headerText, opacity: 0.8 }}>
                        Week {currentDynasty.currentWeek}
                      </span>
                    )}
                  </div>
                </div>

                {/* Advance Week Button with Dropdown - right side */}
                <div className="relative flex items-center gap-2">
                  <div className="flex">
                    <button
                      onClick={handleAdvanceWeek}
                      className="px-3 md:px-4 py-1.5 md:py-2 rounded-l-lg font-semibold hover:opacity-90 transition-colors shadow-sm text-xs md:text-sm whitespace-nowrap"
                      style={{
                        backgroundColor: buttonBg,
                        color: buttonText
                      }}
                    >
                      Advance<span className="hidden sm:inline"> Week</span>
                    </button>
                    <button
                      onClick={() => setShowWeekDropdown(!showWeekDropdown)}
                      className="px-2 py-1.5 md:py-2 rounded-r-lg font-semibold hover:opacity-90 transition-colors shadow-sm border-l"
                      style={{
                        backgroundColor: buttonBg,
                        color: buttonText,
                        borderColor: `${buttonText}30`
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  {showWeekDropdown && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowWeekDropdown(false)}
                      />
                      <div
                        className="absolute right-0 top-full mt-1 w-36 rounded-lg shadow-lg z-50 overflow-hidden"
                        style={{ backgroundColor: buttonBg }}
                      >
                        <button
                          onClick={handleRevertWeek}
                          className="w-full px-4 py-2 text-left text-sm font-semibold hover:opacity-80 transition-opacity flex items-center gap-2"
                          style={{ color: buttonText }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                          </svg>
                          Revert Week
                        </button>
                      </div>
                    </>
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

      <main className={`flex-1 px-4 py-6 ${isDynastyPage ? '' : 'container mx-auto'}`}>
        {children}
      </main>
    </div>
  )
}
