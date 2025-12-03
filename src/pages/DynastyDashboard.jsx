import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { getTeamLogo } from '../data/teams'
import { getConferenceLogo } from '../data/conferenceLogos'
import GameEntryModal from '../components/GameEntryModal'
import ScheduleEntryModal from '../components/ScheduleEntryModal'
import RosterEntryModal from '../components/RosterEntryModal'
import RankingsEntryModal from '../components/RankingsEntryModal'

export default function DynastyDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    dynasties,
    currentDynasty,
    selectDynasty,
    addGame,
    advanceWeek,
    saveSchedule,
    saveRoster,
    saveRankings
  } = useDynasty()
  const [showGameModal, setShowGameModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [showRankingsModal, setShowRankingsModal] = useState(false)

  const teamColors = useTeamColors(currentDynasty?.teamName)

  useEffect(() => {
    if (id && (!currentDynasty || currentDynasty.id !== id)) {
      selectDynasty(id)
    }
  }, [id, currentDynasty, selectDynasty])

  useEffect(() => {
    if (dynasties.length > 0 && !currentDynasty) {
      navigate('/')
    }
  }, [dynasties, currentDynasty, navigate])

  if (!currentDynasty) {
    return (
      <div className="max-w-7xl mx-auto">
        <div 
          className="rounded-lg shadow-md p-8 text-center"
          style={{ backgroundColor: teamColors.secondary }}
        >
          <p style={{ color: teamColors.primary }}>Loading dynasty...</p>
        </div>
      </div>
    )
  }

  const getPhaseDisplay = (phase) => {
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      postseason: 'Post-Season',
      offseason: 'Off-Season'
    }
    return phases[phase] || phase
  }

  const handleAdvanceWeek = () => {
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

  const getSeasonRecord = () => {
    const seasonGames = currentDynasty.games.filter(
      g => g.year === currentDynasty.currentYear
    )
    const wins = seasonGames.filter(g => g.result === 'win').length
    const losses = seasonGames.filter(g => g.result === 'loss').length
    return `${wins}-${losses}`
  }

  const getAllTimeRecord = () => {
    const wins = currentDynasty.games.filter(g => g.result === 'win').length
    const losses = currentDynasty.games.filter(g => g.result === 'loss').length
    return `${wins}-${losses}`
  }

  const handleScheduleSave = (schedule) => {
    saveSchedule(currentDynasty.id, schedule)
  }

  const handleRosterSave = (players) => {
    saveRoster(currentDynasty.id, players)
  }

  const handleRankingsSave = (rankingsData) => {
    saveRankings(currentDynasty.id, rankingsData)
  }

  const canAdvanceFromPreseason = () => {
    return (
      currentDynasty.preseasonSetup?.scheduleEntered &&
      currentDynasty.preseasonSetup?.rosterEntered
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 transition-colors hover:opacity-80"
          style={{ color: teamColors.secondary }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>

      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {getTeamLogo(currentDynasty.teamName) && (
              <img
                src={getTeamLogo(currentDynasty.teamName)}
                alt={`${currentDynasty.teamName} logo`}
                className="w-20 h-20 object-contain"
              />
            )}
            <div>
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: teamColors.primary }}
              >
                {currentDynasty.teamName}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  {getConferenceLogo(currentDynasty.conference) && (
                    <img
                      src={getConferenceLogo(currentDynasty.conference)}
                      alt={`${currentDynasty.conference} logo`}
                      className="w-5 h-5 object-contain"
                    />
                  )}
                  <span className="font-medium">{currentDynasty.conference}</span>
                </div>
                <span>•</span>
                <span>Coach {currentDynasty.coachName}</span>
                <span>•</span>
                <span>{currentDynasty.currentYear} Season</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Current Year</div>
            <div
              className="text-2xl font-bold"
              style={{ color: teamColors.primary }}
            >
              {currentDynasty.currentYear}
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          background: `linear-gradient(135deg, ${teamColors.primary} 0%, ${teamColors.primary}cc 100%)`,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div style={{ color: teamColors.secondary, opacity: 0.8 }} className="text-sm mb-1">Current Phase</div>
            <div className="text-3xl font-bold mb-2" style={{ color: teamColors.secondary }}>
              {getPhaseDisplay(currentDynasty.currentPhase)}
            </div>
            <div style={{ color: teamColors.secondary, opacity: 0.8 }}>
              Week {currentDynasty.currentWeek} • {currentDynasty.currentYear}
            </div>
          </div>
          <button
            onClick={handleAdvanceWeek}
            className="px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors shadow-md"
            style={{ 
              backgroundColor: teamColors.secondary,
              color: teamColors.primary
            }}
          >
            Advance Week
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {[
          { label: 'Overall Record', value: getAllTimeRecord(), sub: 'All-Time' },
          { label: 'Season Record', value: getSeasonRecord(), sub: currentDynasty.currentYear },
          { label: 'National Titles', value: '0', sub: 'Championships' },
          { label: 'Conference Titles', value: '0', sub: currentDynasty.conference }
        ].map((stat, i) => (
          <div 
            key={i}
            className="rounded-lg shadow-md p-6"
            style={{ 
              backgroundColor: teamColors.secondary,
              border: `2px solid ${teamColors.primary}30`
            }}
          >
            <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: teamColors.primary }}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div 
        className="rounded-lg shadow-lg overflow-hidden"
        style={{ 
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div style={{ borderBottom: `2px solid ${teamColors.primary}20` }}>
          <nav className="flex">
            <button
              className="px-6 py-4 text-sm font-medium border-b-4"
              style={{ 
                borderColor: teamColors.primary, 
                color: teamColors.primary,
                backgroundColor: `${teamColors.primary}10`
              }}
            >
              Overview
            </button>
            {['Schedule', 'Roster', 'Recruiting', 'Stats', 'History'].map(tab => (
              <button 
                key={tab}
                className="px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-4 border-transparent hover:border-gray-300"
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {currentDynasty.currentPhase === 'preseason' ? (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: teamColors.primary }}>
                Pre-Season Setup
              </h3>
              <p className="text-gray-600 mb-6">
                Complete these tasks to prepare for the season:
              </p>
              <div className="space-y-3">
                {[
                  { 
                    num: 1, 
                    title: 'Enter Season Schedule', 
                    desc: 'Add all opponents for the regular season',
                    done: currentDynasty.preseasonSetup?.scheduleEntered,
                    action: () => setShowScheduleModal(true),
                    actionText: currentDynasty.preseasonSetup?.scheduleEntered ? 'Edit' : 'Add Schedule'
                  },
                  {
                    num: 2,
                    title: 'Enter Roster',
                    desc: 'Add key players to track this season',
                    done: currentDynasty.preseasonSetup?.rosterEntered,
                    action: () => setShowRosterModal(true),
                    actionText: currentDynasty.preseasonSetup?.rosterEntered ? 'Edit' : 'Add Roster'
                  },
                  {
                    num: 3,
                    title: 'Enter Top 25 Rankings',
                    desc: 'Track national rankings throughout the season',
                    done: currentDynasty.preseasonSetup?.rankingsEntered,
                    action: () => setShowRankingsModal(true),
                    actionText: currentDynasty.preseasonSetup?.rankingsEntered ? 'Edit' : 'Add Rankings',
                    optional: true
                  }
                ].map(item => (
                  <div 
                    key={item.num}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                      item.done ? 'border-green-200 bg-green-50' : ''
                    }`}
                    style={!item.done ? { 
                      borderColor: `${teamColors.primary}30`,
                      backgroundColor: teamColors.secondary
                    } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          item.done ? 'bg-green-500 text-white' : ''
                        }`}
                        style={!item.done ? { 
                          backgroundColor: `${teamColors.primary}20`,
                          color: teamColors.primary
                        } : {}}
                      >
                        {item.done ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="font-bold">{item.num}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {item.title}
                          {item.optional && <span className="text-gray-500 text-sm ml-2">(Optional)</span>}
                        </div>
                        <div className="text-sm text-gray-600">{item.desc}</div>
                      </div>
                    </div>
                    <button
                      onClick={item.action}
                      className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                      style={item.optional && !item.done ? {
                        backgroundColor: '#f3f4f6',
                        color: '#374151'
                      } : {
                        backgroundColor: teamColors.primary,
                        color: teamColors.secondary
                      }}
                    >
                      {item.actionText}
                    </button>
                  </div>
                ))}
              </div>

              {canAdvanceFromPreseason() && (
                <div 
                  className="mt-6 p-4 rounded-lg border-2"
                  style={{ 
                    backgroundColor: `${teamColors.primary}10`,
                    borderColor: teamColors.primary
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: teamColors.primary }}>
                    ✓ Pre-season setup complete! Click "Advance Week" to start the season.
                  </p>
                </div>
              )}
            </div>
          ) : currentDynasty.games.length === 0 ? (
            <div className="text-center py-12">
              <div style={{ color: teamColors.primary, opacity: 0.5 }} className="mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: teamColors.primary }}>
                Ready to Start Your Dynasty!
              </h3>
              <p className="text-gray-600 mb-6">
                Click "Advance Week" to start your first game.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: teamColors.primary }}>
                Season Schedule & Results
              </h3>
              <div className="space-y-2">
                {currentDynasty.games
                  .filter(g => g.year === currentDynasty.currentYear)
                  .sort((a, b) => a.week - b.week)
                  .map((game) => (
                    <div
                      key={game.id}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                        game.result === 'win'
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-gray-600 w-16">
                          Week {game.week}
                        </div>
                        <div className="flex items-center gap-2">
                          {game.location === 'away' && (
                            <span className="text-gray-500 text-sm">@</span>
                          )}
                          {game.location === 'neutral' && (
                            <span className="text-gray-500 text-sm">vs</span>
                          )}
                          <div className="font-semibold text-gray-900">
                            {game.opponent}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`text-lg font-bold ${
                          game.result === 'win' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {game.result === 'win' ? 'W' : 'L'}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            {game.teamScore} - {game.opponentScore}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <GameEntryModal
        isOpen={showGameModal}
        onClose={() => setShowGameModal(false)}
        onSave={handleGameSave}
        weekNumber={currentDynasty.currentWeek}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      <ScheduleEntryModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSave={handleScheduleSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      <RosterEntryModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        onSave={handleRosterSave}
        teamColors={teamColors}
      />

      <RankingsEntryModal
        isOpen={showRankingsModal}
        onClose={() => setShowRankingsModal(false)}
        onSave={handleRankingsSave}
        currentYear={currentDynasty.currentYear}
        currentWeek={currentDynasty.currentWeek}
        teamColors={teamColors}
      />
    </div>
  )
}
