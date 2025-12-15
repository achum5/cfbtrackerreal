import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'

export default function CoachCareer() {
  const { currentDynasty } = useDynasty()

  if (!currentDynasty) return null

  // Calculate career statistics
  const calculateCareerStats = () => {
    const games = currentDynasty.games || []
    const wins = games.filter(g => g.result === 'win').length
    const losses = games.filter(g => g.result === 'loss').length

    // Calculate overall record
    const overallRecord = `${wins}-${losses}`

    // Calculate favorite/underdog records
    const favoriteGames = games.filter(g => g.favoriteStatus === 'favorite')
    const favoriteWins = favoriteGames.filter(g => g.result === 'win').length
    const favoriteLosses = favoriteGames.filter(g => g.result === 'loss').length
    const favoriteRecord = `${favoriteWins}-${favoriteLosses}`

    const underdogGames = games.filter(g => g.favoriteStatus === 'underdog')
    const underdogWins = underdogGames.filter(g => g.result === 'win').length
    const underdogLosses = underdogGames.filter(g => g.result === 'loss').length
    const underdogRecord = `${underdogWins}-${underdogLosses}`

    // Placeholder stats (these would be tracked in dynasty data)
    const confChampionships = 0
    const playoffAppearances = 0
    const nationalChampionships = 0
    const firstTeamAllAmericans = 0
    const heismanWinners = 0
    const firstRoundPicks = 0

    return {
      overallRecord,
      favoriteRecord,
      underdogRecord,
      confChampionships,
      playoffAppearances,
      nationalChampionships,
      firstTeamAllAmericans,
      heismanWinners,
      firstRoundPicks
    }
  }

  const stats = calculateCareerStats()
  const yearRange = currentDynasty.currentYear === currentDynasty.startYear
    ? `${currentDynasty.startYear}`
    : `${currentDynasty.startYear}-${currentDynasty.currentYear}`

  // Get team colors for this specific school
  const teamColors = useTeamColors(currentDynasty.teamName)
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

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
          {currentDynasty.coachPosition || 'HC'} {currentDynasty.coachName} - Career Overview
        </h2>
      </div>

      {/* Team Career Card */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        {/* Team Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-1" style={{ color: primaryText }}>
            {currentDynasty.teamName}
          </h3>
          <div className="flex items-center gap-4 text-sm" style={{ color: primaryText, opacity: 0.8 }}>
            <span className="font-semibold">
              {currentDynasty.coachPosition === 'HC' && 'Head Coach'}
              {currentDynasty.coachPosition === 'OC' && 'Offensive Coordinator'}
              {currentDynasty.coachPosition === 'DC' && 'Defensive Coordinator'}
              {!currentDynasty.coachPosition && 'Head Coach'}
            </span>
            <span>•</span>
            <span>{yearRange}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {/* Overall Record */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              Overall Record
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.overallRecord}
            </div>
          </div>

          {/* As Favorite */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              As Favorite
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.favoriteRecord}
            </div>
          </div>

          {/* As Underdog */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              As Underdog
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.underdogRecord}
            </div>
          </div>

          {/* Conference Championships */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              Conference Championships
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.confChampionships}
            </div>
          </div>

          {/* Playoff Appearances */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              Playoff Appearances
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.playoffAppearances}
            </div>
          </div>

          {/* National Championships */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              National Championships
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.nationalChampionships}
            </div>
          </div>

          {/* First-Team All-Americans */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              First-Team All-Americans
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.firstTeamAllAmericans}
            </div>
          </div>

          {/* Heisman Winners */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              Heisman Winners
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.heismanWinners}
            </div>
          </div>

          {/* First-Round NFL Draft Picks */}
          <div
            className="text-center p-4 rounded-lg border-2"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              1st-Round NFL Picks
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.firstRoundPicks}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="text-xs opacity-60" style={{ color: primaryText }}>
          <p>* Some statistics are not yet tracked and will be updated as features are implemented.</p>
        </div>
      </div>
    </div>
  )
}
