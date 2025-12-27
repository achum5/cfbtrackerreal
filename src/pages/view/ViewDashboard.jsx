import { Link, useParams } from 'react-router-dom'
import { useViewDynasty } from '../../context/ViewDynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getMascotName, getTeamLogo } from '../../data/teams'
import { getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamConference } from '../../data/conferenceTeams'
import {
  getCurrentSchedule,
  getCurrentRoster,
  getCurrentTeamGames,
  findCurrentTeamGame
} from '../../context/DynastyContext'

export default function ViewDashboard() {
  const { shareCode } = useParams()
  const { currentDynasty } = useViewDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)

  if (!currentDynasty) {
    return null
  }

  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
  const mascotName = getMascotName(currentDynasty.teamName) || currentDynasty.teamName
  const conference = getTeamConference(teamAbbr) || currentDynasty.conference || ''

  // Get schedule and games for current year
  const schedule = getCurrentSchedule(currentDynasty)
  const roster = getCurrentRoster(currentDynasty)
  const currentYearGames = getCurrentTeamGames(currentDynasty, currentDynasty.currentYear)

  // Calculate record
  const wins = currentYearGames.filter(g => g.result === 'win' || g.result === 'W').length
  const losses = currentYearGames.filter(g => g.result === 'loss' || g.result === 'L').length

  // Get team ratings
  const teamRatings = currentDynasty.teamRatingsByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear] ||
    currentDynasty.teamRatings || {}

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Team Header */}
      <div
        className="rounded-xl p-6 mb-6 shadow-lg"
        style={{ backgroundColor: teamColors.primary }}
      >
        <div className="flex items-center gap-4">
          <img
            src={getTeamLogo(mascotName)}
            alt={mascotName}
            className="w-20 h-20 object-contain"
          />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: primaryBgText }}>
              {mascotName}
            </h1>
            <p className="text-lg opacity-80" style={{ color: primaryBgText }}>
              {conference} | {currentDynasty.currentYear} Season
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: primaryBgText }}>
              {wins}-{losses}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg p-4 text-center" style={{ backgroundColor: teamColors.secondary }}>
          <div className="text-3xl font-bold" style={{ color: teamColors.primary }}>
            {teamRatings.overall || '-'}
          </div>
          <div className="text-sm" style={{ color: secondaryBgText }}>Overall</div>
        </div>
        <div className="rounded-lg p-4 text-center" style={{ backgroundColor: teamColors.secondary }}>
          <div className="text-3xl font-bold" style={{ color: teamColors.primary }}>
            {teamRatings.offense || '-'}
          </div>
          <div className="text-sm" style={{ color: secondaryBgText }}>Offense</div>
        </div>
        <div className="rounded-lg p-4 text-center" style={{ backgroundColor: teamColors.secondary }}>
          <div className="text-3xl font-bold" style={{ color: teamColors.primary }}>
            {teamRatings.defense || '-'}
          </div>
          <div className="text-sm" style={{ color: secondaryBgText }}>Defense</div>
        </div>
        <div className="rounded-lg p-4 text-center" style={{ backgroundColor: teamColors.secondary }}>
          <div className="text-3xl font-bold" style={{ color: teamColors.primary }}>
            {roster.length}
          </div>
          <div className="text-sm" style={{ color: secondaryBgText }}>Players</div>
        </div>
      </div>

      {/* Schedule Section */}
      <div className="rounded-xl overflow-hidden shadow-lg mb-6" style={{ backgroundColor: teamColors.secondary }}>
        <div className="p-4 border-b" style={{ borderColor: `${secondaryBgText}20` }}>
          <h2 className="text-xl font-bold" style={{ color: teamColors.primary }}>
            {currentDynasty.currentYear} Schedule
          </h2>
        </div>
        <div className="divide-y" style={{ borderColor: `${secondaryBgText}10` }}>
          {schedule.length > 0 ? (
            schedule.map((game, idx) => {
              const playedGame = currentYearGames.find(g => Number(g.week) === Number(game.week))
              const opponentMascot = getMascotName(game.opponent) || game.opponent
              const opponentLogo = getTeamLogo(opponentMascot)

              return (
                <div key={idx} className="p-3 flex items-center gap-3">
                  <div className="w-8 text-center text-sm font-medium" style={{ color: secondaryBgText }}>
                    W{game.week}
                  </div>
                  <img src={opponentLogo} alt={game.opponent} className="w-8 h-8 object-contain" />
                  <div className="flex-1">
                    <span className="text-xs opacity-60 mr-1" style={{ color: secondaryBgText }}>
                      {game.site === 'Home' ? 'vs' : game.site === 'Neutral' ? 'vs' : '@'}
                    </span>
                    <span className="font-medium" style={{ color: secondaryBgText }}>
                      {opponentMascot}
                    </span>
                  </div>
                  {playedGame ? (
                    <Link
                      to={`/view/${shareCode}/game/${playedGame.id}`}
                      className="px-3 py-1 rounded-lg text-sm font-bold"
                      style={{
                        backgroundColor: playedGame.result === 'win' || playedGame.result === 'W'
                          ? '#22c55e'
                          : '#ef4444',
                        color: 'white'
                      }}
                    >
                      {playedGame.result === 'win' || playedGame.result === 'W' ? 'W' : 'L'} {playedGame.teamScore}-{playedGame.opponentScore}
                    </Link>
                  ) : (
                    <span className="text-sm opacity-50" style={{ color: secondaryBgText }}>
                      -
                    </span>
                  )}
                </div>
              )
            })
          ) : (
            <div className="p-6 text-center" style={{ color: secondaryBgText }}>
              No schedule entered yet
            </div>
          )}
        </div>
      </div>

      {/* Coaching History */}
      {currentDynasty.coachingHistory && currentDynasty.coachingHistory.length > 0 && (
        <div className="rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: teamColors.secondary }}>
          <div className="p-4 border-b" style={{ borderColor: `${secondaryBgText}20` }}>
            <h2 className="text-xl font-bold" style={{ color: teamColors.primary }}>
              Coaching History
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {currentDynasty.coachingHistory.map((stint, idx) => {
                const stintMascot = getMascotName(stint.teamName) || stint.teamName
                const stintLogo = getTeamLogo(stintMascot)
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-black/10">
                    <img src={stintLogo} alt={stint.teamName} className="w-10 h-10 object-contain" />
                    <div className="flex-1">
                      <div className="font-bold" style={{ color: secondaryBgText }}>
                        {stintMascot}
                      </div>
                      <div className="text-sm opacity-70" style={{ color: secondaryBgText }}>
                        {stint.startYear} - {stint.endYear} | {stint.wins}-{stint.losses}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        {[
          { name: 'Coach Career', path: 'coach-career', icon: '👨‍🏫' },
          { name: 'All Players', path: 'players', icon: '🏈' },
          { name: 'All Teams', path: 'teams', icon: '🏟️' },
          { name: 'Awards', path: 'awards', icon: '🏆' },
          { name: 'Records', path: 'dynasty-records', icon: '📊' },
          { name: 'CFP Bracket', path: 'cfp-bracket', icon: '🎯' }
        ].map(item => (
          <Link
            key={item.name}
            to={`/view/${shareCode}/${item.path}`}
            className="p-4 rounded-xl text-center hover:opacity-90 transition-opacity"
            style={{ backgroundColor: teamColors.secondary }}
          >
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="font-semibold" style={{ color: secondaryBgText }}>
              {item.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
