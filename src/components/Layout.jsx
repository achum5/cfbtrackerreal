import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { getTeamLogo } from '../data/teams'
import { getContrastTextColor } from '../utils/colorUtils'
import GameEntryModal from './GameEntryModal'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentDynasty, advanceWeek, addGame } = useDynasty()
  const [showGameModal, setShowGameModal] = useState(false)

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
      currentDynasty.preseasonSetup?.rosterEntered
    )
  }

  const handleAdvanceWeek = () => {
    if (!currentDynasty) return

    if (currentDynasty.currentPhase === 'preseason' && !canAdvanceFromPreseason()) {
      alert('Please complete schedule and roster entry before advancing to the regular season.')
      return
    }

    if (currentDynasty.currentPhase === 'regular_season') {
      setShowGameModal(true)
    } else {
      advanceWeek(currentDynasty.id)
    }
  }

  const handleGameSave = (gameData) => {
    addGame(currentDynasty.id, gameData)
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
        className="shadow-sm"
        style={{ backgroundColor: headerBg }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-3">
              {useTeamTheme && (
                <button
                  onClick={() => window.toggleDynastySidebar?.()}
                  className="p-2 rounded-lg hover:opacity-70 transition-opacity"
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
                      <img
                        src={getTeamLogo(currentDynasty.teamName)}
                        alt={`${currentDynasty.teamName} logo`}
                        className="w-7 h-7 md:w-8 md:h-8 object-contain"
                      />
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
              </>
            ) : (
              <Link
                to="/create"
                className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-white/20 whitespace-nowrap"
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

      {useTeamTheme && (
        <GameEntryModal
          isOpen={showGameModal}
          onClose={() => setShowGameModal(false)}
          onSave={handleGameSave}
          weekNumber={currentDynasty.currentWeek}
          currentYear={currentDynasty.currentYear}
          teamColors={teamColors}
        />
      )}
    </div>
  )
}
