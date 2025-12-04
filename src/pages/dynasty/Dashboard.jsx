import { useState } from 'react'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import ScheduleEntryModal from '../../components/ScheduleEntryModal'
import RosterEntryModal from '../../components/RosterEntryModal'

export default function Dashboard() {
  const { currentDynasty, saveSchedule, saveRoster } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRosterModal, setShowRosterModal] = useState(false)

  if (!currentDynasty) return null

  const handleScheduleSave = (schedule) => {
    saveSchedule(currentDynasty.id, schedule)
  }

  const handleRosterSave = (players) => {
    saveRoster(currentDynasty.id, players)
  }

  const canAdvanceFromPreseason = () => {
    return (
      currentDynasty.preseasonSetup?.scheduleEntered &&
      currentDynasty.preseasonSetup?.rosterEntered
    )
  }

  const getSeasonRecord = () => {
    const seasonGames = currentDynasty.games.filter(
      g => g.year === currentDynasty.currentYear
    )
    const wins = seasonGames.filter(g => g.result === 'win').length
    const losses = seasonGames.filter(g => g.result === 'loss').length
    return `${wins}-${losses}`
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

  const currentYearGames = currentDynasty.games
    .filter(g => g.year === currentDynasty.currentYear)
    .sort((a, b) => a.week - b.week)

  return (
    <div className="space-y-6">
      {/* Current Season Record */}
      <div
        className="rounded-lg shadow-md p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `2px solid ${teamColors.primary}`
        }}
      >
        <div className="text-sm mb-1" style={{ color: secondaryBgText, opacity: 0.7 }}>
          Current Season Record
        </div>
        <div className="text-3xl font-bold" style={{ color: secondaryBgText }}>
          {getSeasonRecord()}
        </div>
        <div className="text-xs mt-1" style={{ color: secondaryBgText, opacity: 0.6 }}>
          {currentDynasty.currentYear} • {getPhaseDisplay(currentDynasty.currentPhase)}
        </div>
      </div>

      {/* Phase-Specific Content */}
      {currentDynasty.currentPhase === 'preseason' ? (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: secondaryBgText }}>
            Pre-Season Setup
          </h3>
          <div className="space-y-3">
            {[
              {
                num: 1,
                title: 'Enter Season Schedule',
                done: currentDynasty.preseasonSetup?.scheduleEntered,
                action: () => setShowScheduleModal(true),
                actionText: currentDynasty.preseasonSetup?.scheduleEntered ? 'Edit' : 'Add Schedule'
              },
              {
                num: 2,
                title: 'Enter Roster',
                done: currentDynasty.preseasonSetup?.rosterEntered,
                action: () => setShowRosterModal(true),
                actionText: currentDynasty.preseasonSetup?.rosterEntered ? 'Edit' : 'Add Roster'
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
                    <div className="font-semibold" style={{ color: secondaryBgText }}>
                      {item.title}
                    </div>
                  </div>
                </div>
                <button
                  onClick={item.action}
                  className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                  style={item.optional && !item.done ? {
                    backgroundColor: `${secondaryBgText}20`,
                    color: secondaryBgText
                  } : {
                    backgroundColor: teamColors.primary,
                    color: primaryBgText
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
                ✓ Pre-season setup complete! Click "Advance Week" in the header to start the season.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: secondaryBgText }}>
            Current Phase: {getPhaseDisplay(currentDynasty.currentPhase)}
          </h3>
          <p style={{ color: secondaryBgText, opacity: 0.8 }}>
            Click "Advance Week" in the header to progress through your dynasty.
          </p>
        </div>
      )}

      {/* Schedule Section */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: secondaryBgText }}>
            {currentDynasty.currentYear} Schedule
          </h2>
          {currentDynasty.currentPhase === 'preseason' && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
              style={{
                backgroundColor: teamColors.primary,
                color: primaryBgText
              }}
            >
              {currentDynasty.preseasonSetup?.scheduleEntered ? 'Edit Schedule' : 'Add Schedule'}
            </button>
          )}
        </div>

{currentDynasty.schedule && currentDynasty.schedule.length > 0 ? (
          <div className="space-y-2">
            {currentDynasty.schedule.map((game, index) => {
              const playedGame = currentYearGames.find(g => g.week === game.week)

              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                    playedGame
                      ? playedGame.result === 'win'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium w-16" style={{ color: secondaryBgText, opacity: 0.7 }}>
                      Week {game.week}
                    </div>
                    <div className="flex items-center gap-2">
                      {game.location === 'away' && (
                        <span className="text-sm" style={{ color: secondaryBgText, opacity: 0.6 }}>@</span>
                      )}
                      {game.location === 'neutral' && (
                        <span className="text-sm" style={{ color: secondaryBgText, opacity: 0.6 }}>vs</span>
                      )}
                      <div className="font-semibold" style={{ color: secondaryBgText }}>
                        {game.opponent}
                      </div>
                    </div>
                  </div>
                  {playedGame ? (
                    <div className="flex items-center gap-4">
                      <div className={`text-lg font-bold ${
                        playedGame.result === 'win' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {playedGame.result === 'win' ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: secondaryBgText }}>
                          {playedGame.teamScore} - {playedGame.opponentScore}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: secondaryBgText, opacity: 0.5 }}>
                      Scheduled
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
              No Schedule Yet
            </h3>
            <p style={{ color: secondaryBgText, opacity: 0.8 }}>
              Add your season schedule to get started.
            </p>
          </div>
        )}
      </div>

      {/* Roster Section */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: secondaryBgText }}>
            Current Roster
          </h2>
          {currentDynasty.currentPhase === 'preseason' && (
            <button
              onClick={() => setShowRosterModal(true)}
              className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
              style={{
                backgroundColor: teamColors.primary,
                color: primaryBgText
              }}
            >
              {currentDynasty.preseasonSetup?.rosterEntered ? 'Edit Roster' : 'Add Roster'}
            </button>
          )}
        </div>

{currentDynasty.players && currentDynasty.players.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2" style={{ borderColor: teamColors.primary }}>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Name</th>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Position</th>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Year</th>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Overall</th>
                </tr>
              </thead>
              <tbody>
                {currentDynasty.players.map((player) => (
                  <tr key={player.id} className="border-b border-gray-200">
                    <td className="py-2 px-3 font-semibold" style={{ color: secondaryBgText }}>
                      {player.name}
                    </td>
                    <td className="py-2 px-3" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      {player.position}
                    </td>
                    <td className="py-2 px-3" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      {player.year}
                    </td>
                    <td className="py-2 px-3 font-bold" style={{ color: secondaryBgText }}>
                      {player.overall}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
              No Players Yet
            </h3>
            <p style={{ color: secondaryBgText, opacity: 0.8 }}>
              Add players to your roster to track them throughout the season.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
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
    </div>
  )
}
