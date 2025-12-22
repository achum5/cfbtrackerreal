import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamLogo } from '../../data/teams'

// Map abbreviations to mascot names for logo lookup
const mascotMap = {
  'AFA': 'Air Force Falcons', 'AKR': 'Akron Zips', 'APP': 'Appalachian State Mountaineers',
  'ARIZ': 'Arizona Wildcats', 'ARK': 'Arkansas Razorbacks', 'ARMY': 'Army Black Knights',
  'ARST': 'Arkansas State Red Wolves', 'ASU': 'Arizona State Sun Devils', 'AUB': 'Auburn Tigers',
  'BALL': 'Ball State Cardinals', 'BAMA': 'Alabama Crimson Tide', 'BC': 'Boston College Eagles',
  'BGSU': 'Bowling Green Falcons', 'BOIS': 'Boise State Broncos', 'BU': 'Baylor Bears',
  'BUFF': 'Buffalo Bulls', 'BYU': 'Brigham Young Cougars', 'CAL': 'California Golden Bears',
  'CCU': 'Coastal Carolina Chanticleers', 'CHAR': 'Charlotte 49ers', 'CLEM': 'Clemson Tigers',
  'CMU': 'Central Michigan Chippewas', 'COLO': 'Colorado Buffaloes', 'CONN': 'Connecticut Huskies',
  'CSU': 'Colorado State Rams', 'DUKE': 'Duke Blue Devils', 'ECU': 'East Carolina Pirates',
  'EMU': 'Eastern Michigan Eagles', 'FIU': 'Florida International Panthers', 'FSU': 'Florida State Seminoles',
  'FAU': 'Florida Atlantic Owls', 'FRES': 'Fresno State Bulldogs', 'UF': 'Florida Gators',
  'GASO': 'Georgia Southern Eagles', 'GAST': 'Georgia State Panthers', 'GT': 'Georgia Tech Yellow Jackets',
  'UGA': 'Georgia Bulldogs', 'HAW': 'Hawaii Rainbow Warriors', 'HOU': 'Houston Cougars',
  'ILL': 'Illinois Fighting Illini', 'IU': 'Indiana Hoosiers', 'IOWA': 'Iowa Hawkeyes',
  'ISU': 'Iowa State Cyclones', 'JKST': 'Jacksonville State Gamecocks', 'JMU': 'James Madison Dukes',
  'KU': 'Kansas Jayhawks', 'KSU': 'Kansas State Wildcats', 'KENT': 'Kent State Golden Flashes',
  'UK': 'Kentucky Wildcats', 'LIB': 'Liberty Flames', 'ULL': 'Lafayette Ragin\' Cajuns',
  'LT': 'Louisiana Tech Bulldogs', 'LOU': 'Louisville Cardinals', 'LSU': 'LSU Tigers',
  'UM': 'Miami Hurricanes', 'M-OH': 'Miami Redhawks', 'UMD': 'Maryland Terrapins',
  'MASS': 'Massachusetts Minutemen', 'MEM': 'Memphis Tigers', 'MICH': 'Michigan Wolverines',
  'MSU': 'Michigan State Spartans', 'MTSU': 'Middle Tennessee State Blue Raiders',
  'MINN': 'Minnesota Golden Gophers', 'MISS': 'Ole Miss Rebels', 'MSST': 'Mississippi State Bulldogs',
  'MZST': 'Missouri Tigers', 'MRSH': 'Marshall Thundering Herd', 'NAVY': 'Navy Midshipmen',
  'NEB': 'Nebraska Cornhuskers', 'NEV': 'Nevada Wolf Pack', 'UNM': 'New Mexico Lobos',
  'NMSU': 'New Mexico State Aggies', 'UNC': 'North Carolina Tar Heels', 'NCST': 'North Carolina State Wolfpack',
  'UNT': 'North Texas Mean Green', 'NU': 'Northwestern Wildcats', 'ND': 'Notre Dame Fighting Irish',
  'NIU': 'Northern Illinois Huskies', 'OHIO': 'Ohio Bobcats', 'OSU': 'Ohio State Buckeyes',
  'OKLA': 'Oklahoma Sooners', 'OKST': 'Oklahoma State Cowboys', 'ODU': 'Old Dominion Monarchs',
  'ORE': 'Oregon Ducks', 'ORST': 'Oregon State Beavers', 'PSU': 'Penn State Nittany Lions',
  'PITT': 'Pittsburgh Panthers', 'PUR': 'Purdue Boilermakers', 'RICE': 'Rice Owls',
  'RUT': 'Rutgers Scarlet Knights', 'SDSU': 'San Diego State Aztecs', 'SJSU': 'San Jose State Spartans',
  'SAM': 'Sam Houston State Bearkats', 'USF': 'South Florida Bulls', 'SMU': 'SMU Mustangs',
  'USC': 'USC Trojans', 'SCAR': 'South Carolina Gamecocks', 'STAN': 'Stanford Cardinal',
  'SYR': 'Syracuse Orange', 'TCU': 'TCU Horned Frogs', 'TEM': 'Temple Owls',
  'TENN': 'Tennessee Volunteers', 'TEX': 'Texas Longhorns', 'TXAM': 'Texas A&M Aggies',
  'TXST': 'Texas State Bobcats', 'TXTECH': 'Texas Tech Red Raiders', 'TOL': 'Toledo Rockets',
  'TROY': 'Troy Trojans', 'TUL': 'Tulane Green Wave', 'TLSA': 'Tulsa Golden Hurricane',
  'UAB': 'UAB Blazers', 'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins', 'UNLV': 'UNLV Rebels',
  'UTEP': 'UTEP Miners', 'USA': 'South Alabama Jaguars', 'USU': 'Utah State Aggies',
  'UTAH': 'Utah Utes', 'UTSA': 'UTSA Roadrunners', 'VAN': 'Vanderbilt Commodores',
  'UVA': 'Virginia Cavaliers', 'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons',
  'WASH': 'Washington Huskies', 'WSU': 'Washington State Cougars', 'WVU': 'West Virginia Mountaineers',
  'WMU': 'Western Michigan Broncos', 'WKU': 'Western Kentucky Hilltoppers', 'WIS': 'Wisconsin Badgers',
  'WYO': 'Wyoming Cowboys', 'DEL': 'Delaware Fightin\' Blue Hens', 'FLA': 'Florida Gators',
  'KENN': 'Kennesaw State Owls', 'ULM': 'Monroe Warhawks', 'UC': 'Cincinnati Bearcats',
  'MIA': 'Miami Hurricanes', 'MIZ': 'Missouri Tigers', 'OU': 'Oklahoma Sooners', 'GSU': 'Georgia State Panthers'
}

const getMascotName = (abbr) => mascotMap[abbr] || null

const getOpponentColors = (abbr) => {
  const team = teamAbbreviations[abbr]
  return {
    backgroundColor: team?.backgroundColor || '#4B5563',
    textColor: team?.textColor || '#FFFFFF'
  }
}

export default function CoachCareer() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const [showFavoriteTooltip, setShowFavoriteTooltip] = useState(false)
  const [showGamesModal, setShowGamesModal] = useState(false)
  const [gamesModalType, setGamesModalType] = useState(null) // 'favorite' or 'underdog'

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showGamesModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showGamesModal])

  if (!currentDynasty) return null

  // Calculate career statistics
  const calculateCareerStats = () => {
    // Filter to only user's games (exclude CPU vs CPU games)
    const games = (currentDynasty.games || []).filter(g => !g.isCPUGame)

    // Helper to check for win (handles both 'win' and 'W' formats)
    const isWin = (g) => g.result === 'win' || g.result === 'W'
    const isLoss = (g) => g.result === 'loss' || g.result === 'L'

    const wins = games.filter(isWin).length
    const losses = games.filter(isLoss).length

    // Calculate overall record
    const overallRecord = `${wins}-${losses}`

    // Calculate favorite/underdog records
    const favoriteGames = games.filter(g => g.favoriteStatus === 'favorite')
    const favoriteWins = favoriteGames.filter(isWin).length
    const favoriteLosses = favoriteGames.filter(isLoss).length
    const favoriteRecord = `${favoriteWins}-${favoriteLosses}`

    const underdogGames = games.filter(g => g.favoriteStatus === 'underdog')
    const underdogWins = underdogGames.filter(isWin).length
    const underdogLosses = underdogGames.filter(isLoss).length
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
      favoriteGames,
      underdogGames,
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

  // Get games for the modal
  const getGamesForModal = () => {
    if (gamesModalType === 'favorite') {
      return stats.favoriteGames
    } else if (gamesModalType === 'underdog') {
      return stats.underdogGames
    }
    return []
  }

  // Sort games by year (descending) then week (ascending)
  const sortedGames = getGamesForModal().sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return (a.week || 0) - (b.week || 0)
  })

  // Group games by year for display
  const gamesByYear = sortedGames.reduce((acc, game) => {
    const year = game.year || 'Unknown'
    if (!acc[year]) acc[year] = []
    acc[year].push(game)
    return acc
  }, {})

  const openGamesModal = (type) => {
    setGamesModalType(type)
    setShowGamesModal(true)
  }

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

          {/* As Favorite - Clickable */}
          <div
            className="text-center p-4 rounded-lg border-2 relative cursor-pointer hover:scale-105 transition-transform"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
            onClick={() => openGamesModal('favorite')}
          >
            <div className="text-xs font-semibold mb-1 flex items-center justify-center gap-1" style={{ color: secondaryText, opacity: 0.7 }}>
              As Favorite
              <button
                className="w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center hover:opacity-80 cursor-help"
                style={{ backgroundColor: primaryText, color: teamColors.primary }}
                onMouseEnter={(e) => { e.stopPropagation(); setShowFavoriteTooltip(true) }}
                onMouseLeave={(e) => { e.stopPropagation(); setShowFavoriteTooltip(false) }}
                onClick={(e) => { e.stopPropagation(); setShowFavoriteTooltip(!showFavoriteTooltip) }}
              >
                ?
              </button>
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.favoriteRecord}
            </div>
            <div className="text-xs mt-1 opacity-60" style={{ color: secondaryText }}>
              Click to view games
            </div>
            {/* Tooltip */}
            {showFavoriteTooltip && (
              <div
                className="absolute z-50 p-3 rounded-lg shadow-lg text-left text-xs w-64 -translate-x-1/2 left-1/2"
                style={{
                  backgroundColor: teamColors.primary,
                  color: primaryText,
                  top: '100%',
                  marginTop: '8px'
                }}
              >
                <div className="font-bold mb-1">How is this calculated?</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Ranked vs unranked: ranked team is favorite</li>
                  <li>Both ranked: lower rank is favorite</li>
                  <li>Both unranked: higher overall rating is favorite</li>
                  <li>Home team gets +5 ranking or +3 overall boost</li>
                </ul>
              </div>
            )}
          </div>

          {/* As Underdog - Clickable */}
          <div
            className="text-center p-4 rounded-lg border-2 cursor-pointer hover:scale-105 transition-transform"
            style={{
              backgroundColor: teamColors.secondary,
              borderColor: primaryText
            }}
            onClick={() => openGamesModal('underdog')}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
              As Underdog
            </div>
            <div className="text-2xl font-bold" style={{ color: secondaryText }}>
              {stats.underdogRecord}
            </div>
            <div className="text-xs mt-1 opacity-60" style={{ color: secondaryText }}>
              Click to view games
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

      {/* Games Modal */}
      {showGamesModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ margin: 0 }}
          onClick={() => setShowGamesModal(false)}
        >
          <div
            className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: teamColors.secondary }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ backgroundColor: teamColors.primary }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: primaryText }}>
                  Games as {gamesModalType === 'favorite' ? 'Favorite' : 'Underdog'}
                </h3>
                <p className="text-sm mt-0.5 opacity-80" style={{ color: primaryText }}>
                  {sortedGames.length} game{sortedGames.length !== 1 ? 's' : ''} •
                  {gamesModalType === 'favorite' ? ` ${stats.favoriteRecord}` : ` ${stats.underdogRecord}`}
                </p>
              </div>
              <button
                onClick={() => setShowGamesModal(false)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
                style={{ color: primaryText }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {sortedGames.length === 0 ? (
                <div className="text-center py-12 opacity-60" style={{ color: secondaryText }}>
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                  </svg>
                  <p className="text-lg font-semibold">No games yet</p>
                  <p className="text-sm mt-1">Games will appear here as you play them</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(gamesByYear).map(([year, yearGames]) => (
                    <div key={year}>
                      {/* Year Header - scrolls with content */}
                      <div
                        className="px-3 py-2 rounded-lg mb-2 font-bold text-sm"
                        style={{ backgroundColor: teamColors.primary, color: primaryText }}
                      >
                        {year} Season
                      </div>

                      {/* Games for this year */}
                      <div className="space-y-2">
                        {yearGames.map((game, index) => {
                          const opponentColors = getOpponentColors(game.opponent)
                          const mascotName = getMascotName(game.opponent)
                          const opponentName = mascotName || teamAbbreviations[game.opponent]?.name || game.opponent
                          const opponentLogo = mascotName ? getTeamLogo(mascotName) : null
                          const isWin = game.result === 'win' || game.result === 'W'

                          return (
                            <Link
                              key={`${year}-${game.week}-${index}`}
                              to={`/dynasty/${id}/game/${game.id}`}
                              className="flex items-center justify-between p-3 rounded-lg border-2 hover:opacity-90 transition-opacity"
                              style={{
                                backgroundColor: opponentColors.backgroundColor,
                                borderColor: isWin ? '#86efac' : '#fca5a5'
                              }}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Week */}
                                <div
                                  className="text-xs font-medium w-14 flex-shrink-0 opacity-80"
                                  style={{ color: opponentColors.textColor }}
                                >
                                  {game.isConferenceChampionship ? 'CC' :
                                   game.isBowlGame ? 'Bowl' :
                                   game.isPlayoff ? 'CFP' :
                                   `Wk ${game.week}`}
                                </div>

                                {/* Location Badge */}
                                <span
                                  className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                                  style={{
                                    backgroundColor: opponentColors.textColor,
                                    color: opponentColors.backgroundColor
                                  }}
                                >
                                  {game.location === 'away' ? '@' : 'vs'}
                                </span>

                                {/* Team Logo */}
                                {opponentLogo && (
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{
                                      backgroundColor: '#FFFFFF',
                                      border: `2px solid ${opponentColors.textColor}`,
                                      padding: '2px'
                                    }}
                                  >
                                    <img
                                      src={opponentLogo}
                                      alt={opponentName}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                )}

                                {/* Opponent Info */}
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {game.opponentRank && (
                                    <span
                                      className="text-xs font-bold opacity-70 flex-shrink-0"
                                      style={{ color: opponentColors.textColor }}
                                    >
                                      #{game.opponentRank}
                                    </span>
                                  )}
                                  <span
                                    className="font-semibold truncate"
                                    style={{ color: opponentColors.textColor }}
                                  >
                                    {opponentName}
                                  </span>
                                </div>
                              </div>

                              {/* Result */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span
                                  className="text-xs font-bold px-2 py-1 rounded"
                                  style={{
                                    backgroundColor: isWin ? '#16a34a' : '#dc2626',
                                    color: '#FFFFFF'
                                  }}
                                >
                                  {isWin ? 'W' : 'L'}
                                </span>
                                <span
                                  className="font-bold text-sm"
                                  style={{ color: opponentColors.textColor }}
                                >
                                  {game.teamScore}-{game.opponentScore}
                                </span>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="px-6 py-4 border-t flex-shrink-0"
              style={{ borderColor: `${secondaryText}20` }}
            >
              <button
                onClick={() => setShowGamesModal(false)}
                className="w-full py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
                style={{ backgroundColor: teamColors.primary, color: primaryText }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
