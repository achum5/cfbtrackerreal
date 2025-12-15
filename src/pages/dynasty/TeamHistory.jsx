import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'

export default function TeamHistory() {
  const { currentDynasty } = useDynasty()

  if (!currentDynasty) return null

  // Get team colors for styling
  const teamColors = useTeamColors(currentDynasty.teamName)
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  // Generate seasons from start year to current year
  const seasons = []
  for (let year = currentDynasty.startYear; year <= currentDynasty.currentYear; year++) {
    // Calculate season stats from games
    const seasonGames = (currentDynasty.games || []).filter(g => g.year === year)
    const wins = seasonGames.filter(g => g.result === 'win').length
    const losses = seasonGames.filter(g => g.result === 'loss').length

    const roleDisplay = currentDynasty.coachPosition === 'HC' ? 'Head Coach'
      : currentDynasty.coachPosition === 'OC' ? 'Offensive Coordinator'
      : currentDynasty.coachPosition === 'DC' ? 'Defensive Coordinator'
      : 'Head Coach'

    seasons.push({
      year,
      role: roleDisplay,
      school: currentDynasty.teamName,
      conference: currentDynasty.conference,
      wins,
      losses,
      confRank: 'N/A',
      cfpBerth: 'N/A',
      natlChamp: 'N/A',

      // Team statistics (placeholders)
      firstDowns: 0,
      firstDownsPerGame: 0,
      offensiveYardsPerGame: 0,
      thirdDownPct: 0,
      fourthDownPct: 0,
      penaltyYardsPerGame: 0,
      redzoneTDPct: 0,
      defRedzoneTDPct: 0,
      pointsPerGame: 0,
      pointsAllowedPerGame: 0,
      marginOfVictory: 0,

      // Leaders (placeholders)
      passingLeader: { name: 'N/A', yards: 0, teamPassYPG: 0 },
      rushingLeader: { name: 'N/A', yards: 0, teamRushYPG: 0 },
      receivingLeader: { name: 'N/A', yards: 0 },
      tackleLeader: { name: 'N/A', tackles: 0 },
      tflLeader: { name: 'N/A', tfls: 0, teamTFLsPerGame: 0 },
      sackLeader: { name: 'N/A', sacks: 0, teamSacksPerGame: 0 },
      intLeader: { name: 'N/A', ints: 0, teamIntsPerGame: 0 }
    })
  }

  // Reverse to show most recent first
  seasons.reverse()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold" style={{ color: primaryText }}>
          {currentDynasty.teamName} - Team History
        </h2>
      </div>

      {/* Season Cards */}
      {seasons.map((season) => (
        <div
          key={season.year}
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          {/* Season Header */}
          <div className="mb-6 pb-4 border-b-2" style={{ borderColor: secondaryText + '40' }}>
            <div className="flex flex-wrap items-center gap-4">
              <h3 className="text-3xl font-bold" style={{ color: primaryText }}>
                {season.year}
              </h3>
              <div className="flex items-center gap-4 text-sm" style={{ color: primaryText, opacity: 0.9 }}>
                <span className="font-semibold">{season.role}</span>
                <span>•</span>
                <span>{season.conference}</span>
                <span>•</span>
                <span className="text-xl font-bold">{season.wins}-{season.losses}</span>
              </div>
            </div>
          </div>

          {/* Season Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <div
              className="text-center p-3 rounded-lg border-2"
              style={{
                backgroundColor: teamColors.secondary,
                borderColor: primaryText
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                Conf. Rank
              </div>
              <div className="text-lg font-bold" style={{ color: secondaryText }}>
                {season.confRank}
              </div>
            </div>

            <div
              className="text-center p-3 rounded-lg border-2"
              style={{
                backgroundColor: teamColors.secondary,
                borderColor: primaryText
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                CFP Berth
              </div>
              <div className="text-lg font-bold" style={{ color: secondaryText }}>
                {season.cfpBerth}
              </div>
            </div>

            <div
              className="text-center p-3 rounded-lg border-2"
              style={{
                backgroundColor: teamColors.secondary,
                borderColor: primaryText
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                Nat'l Champ
              </div>
              <div className="text-lg font-bold" style={{ color: secondaryText }}>
                {season.natlChamp}
              </div>
            </div>

            <div
              className="text-center p-3 rounded-lg border-2"
              style={{
                backgroundColor: teamColors.secondary,
                borderColor: primaryText
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                Points/Game
              </div>
              <div className="text-lg font-bold" style={{ color: secondaryText }}>
                {season.pointsPerGame || '-'}
              </div>
            </div>

            <div
              className="text-center p-3 rounded-lg border-2"
              style={{
                backgroundColor: teamColors.secondary,
                borderColor: primaryText
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                Points Allowed
              </div>
              <div className="text-lg font-bold" style={{ color: secondaryText }}>
                {season.pointsAllowedPerGame || '-'}
              </div>
            </div>

            <div
              className="text-center p-3 rounded-lg border-2"
              style={{
                backgroundColor: teamColors.secondary,
                borderColor: primaryText
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                Margin
              </div>
              <div className="text-lg font-bold" style={{ color: secondaryText }}>
                {season.marginOfVictory > 0 ? `+${season.marginOfVictory}` : season.marginOfVictory || '-'}
              </div>
            </div>
          </div>

          {/* Offensive Stats */}
          <div className="mb-6">
            <h4 className="text-lg font-bold mb-3" style={{ color: primaryText }}>
              Offensive Statistics
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  First Downs
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.firstDowns || '-'}
                </div>
              </div>

              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  First Downs/Game
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.firstDownsPerGame || '-'}
                </div>
              </div>

              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Offensive Yards/Game
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.offensiveYardsPerGame || '-'}
                </div>
              </div>

              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  3rd Down %
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.thirdDownPct ? `${season.thirdDownPct}%` : '-'}
                </div>
              </div>

              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  4th Down %
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.fourthDownPct ? `${season.fourthDownPct}%` : '-'}
                </div>
              </div>

              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Penalty Yds/Game
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.penaltyYardsPerGame || '-'}
                </div>
              </div>

              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Redzone TD %
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.redzoneTDPct ? `${season.redzoneTDPct}%` : '-'}
                </div>
              </div>

              <div
                className="p-3 rounded-lg border"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText + '60'
                }}
              >
                <div className="text-xs mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  DEF Redzone TD %
                </div>
                <div className="font-bold" style={{ color: secondaryText }}>
                  {season.defRedzoneTDPct ? `${season.defRedzoneTDPct}%` : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Statistical Leaders */}
          <div>
            <h4 className="text-lg font-bold mb-3" style={{ color: primaryText }}>
              Statistical Leaders
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Passing Leader */}
              <div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: secondaryText }}>
                  Passing Leader
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.passingLeader.name}
                  </span>
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.passingLeader.yards > 0 ? `${season.passingLeader.yards} yds` : '-'}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Team Pass YPG: {season.passingLeader.teamPassYPG || '-'}
                </div>
              </div>

              {/* Rushing Leader */}
              <div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: secondaryText }}>
                  Rushing Leader
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.rushingLeader.name}
                  </span>
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.rushingLeader.yards > 0 ? `${season.rushingLeader.yards} yds` : '-'}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Team Rush YPG: {season.rushingLeader.teamRushYPG || '-'}
                </div>
              </div>

              {/* Receiving Leader */}
              <div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: secondaryText }}>
                  Receiving Leader
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.receivingLeader.name}
                  </span>
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.receivingLeader.yards > 0 ? `${season.receivingLeader.yards} yds` : '-'}
                  </span>
                </div>
              </div>

              {/* Tackle Leader */}
              <div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: secondaryText }}>
                  Tackle Leader
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.tackleLeader.name}
                  </span>
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.tackleLeader.tackles > 0 ? season.tackleLeader.tackles : '-'}
                  </span>
                </div>
              </div>

              {/* TFL Leader */}
              <div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: secondaryText }}>
                  TFL Leader
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.tflLeader.name}
                  </span>
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.tflLeader.tfls > 0 ? season.tflLeader.tfls : '-'}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Team TFLs/Game: {season.tflLeader.teamTFLsPerGame || '-'}
                </div>
              </div>

              {/* Sack Leader */}
              <div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: secondaryText }}>
                  Sack Leader
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.sackLeader.name}
                  </span>
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.sackLeader.sacks > 0 ? season.sackLeader.sacks : '-'}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Team Sacks/Game: {season.sackLeader.teamSacksPerGame || '-'}
                </div>
              </div>

              {/* INT Leader */}
              <div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: teamColors.secondary,
                  borderColor: primaryText
                }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: secondaryText }}>
                  INT Leader
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.intLeader.name}
                  </span>
                  <span className="font-bold" style={{ color: secondaryText }}>
                    {season.intLeader.ints > 0 ? season.intLeader.ints : '-'}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: secondaryText, opacity: 0.7 }}>
                  Team INTs/Game: {season.intLeader.teamIntsPerGame || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Note about incomplete data */}
          {season.year === currentDynasty.currentYear && (
            <div className="mt-4 text-xs opacity-60" style={{ color: primaryText }}>
              <p>* Season in progress - statistics will update as data is tracked</p>
            </div>
          )}
        </div>
      ))}

      {seasons.length === 0 && (
        <div
          className="rounded-lg shadow-lg p-12 text-center"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <p style={{ color: primaryText, opacity: 0.7 }}>
            No seasons to display yet. Start playing to build your team history!
          </p>
        </div>
      )}
    </div>
  )
}
