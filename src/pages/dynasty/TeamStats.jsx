import { useState, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamLogo } from '../../data/teams'

// Map abbreviation to mascot name for logo lookup
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
  'MZST': 'Missouri State Bears', 'MRSH': 'Marshall Thundering Herd', 'NAVY': 'Navy Midshipmen',
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
  'TENN': 'Tennessee Volunteers', 'TEX': 'Texas Longhorns', 'TXAM': 'Texas A&M Aggies', 'TAMU': 'Texas A&M Aggies',
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
  'MIA': 'Miami Hurricanes', 'MIZ': 'Missouri Tigers', 'OU': 'Oklahoma Sooners', 'GSU': 'Georgia State Panthers',
  'USM': 'Southern Mississippi Golden Eagles', 'RUTG': 'Rutgers Scarlet Knights', 'SHSU': 'Sam Houston State Bearkats',
  'TTU': 'Texas Tech Red Raiders', 'TULN': 'Tulane Green Wave', 'UH': 'Houston Cougars',
  'UL': 'Lafayette Ragin\' Cajuns', 'UT': 'Tennessee Volunteers'
}

const getMascotName = (abbr) => mascotMap[abbr] || null

const getTeamColorsFromAbbr = (abbr) => {
  const team = teamAbbreviations[abbr]
  return {
    primary: team?.backgroundColor || '#4B5563',
    secondary: team?.textColor || '#FFFFFF'
  }
}

export default function TeamStats() {
  const { team: urlTeam, year: urlYear } = useParams()
  const navigate = useNavigate()
  const { currentDynasty } = useDynasty()
  const pathPrefix = usePathPrefix()

  // Modal state
  const [modalData, setModalData] = useState(null) // { title, games }

  // Get current team abbreviation
  const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName)

  // Use URL params or defaults
  const selectedTeam = urlTeam || currentTeamAbbr
  const selectedYear = urlYear ? parseInt(urlYear) : currentDynasty?.currentYear

  // Get team colors for selected team
  const teamColors = getTeamColorsFromAbbr(selectedTeam)
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  // Get team logo and name
  const teamMascot = getMascotName(selectedTeam)
  const teamLogo = teamMascot ? getTeamLogo(teamMascot) : null
  const teamFullName = teamMascot || teamAbbreviations[selectedTeam]?.name || selectedTeam

  if (!currentDynasty) {
    return <div className="p-6">Loading...</div>
  }

  // Get all years with data
  const availableYears = useMemo(() => {
    const years = new Set()
    // Add years from games
    ;(currentDynasty.games || []).forEach(g => {
      if (g.year) years.add(parseInt(g.year))
    })
    // Add current year
    years.add(currentDynasty.currentYear)
    // Add start year
    years.add(currentDynasty.startYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [currentDynasty])

  // Get all teams that have games
  const availableTeams = useMemo(() => {
    const teams = new Set()
    // Add current team
    teams.add(currentTeamAbbr)
    // Add teams from games (user's teams and opponents)
    ;(currentDynasty.games || []).forEach(g => {
      if (g.userTeam) teams.add(g.userTeam)
      if (g.opponent) teams.add(g.opponent)
    })
    // Sort alphabetically by team name
    return Array.from(teams).sort((a, b) => {
      const nameA = getMascotName(a) || a
      const nameB = getMascotName(b) || b
      return nameA.localeCompare(nameB)
    })
  }, [currentDynasty, currentTeamAbbr])

  // Helper functions
  const isWin = (g) => g.result === 'win' || g.result === 'W'
  const isLoss = (g) => g.result === 'loss' || g.result === 'L'

  // Check if game is postseason (conference championship, bowl, or CFP)
  const isPostseasonGame = (g) => {
    return g.isConferenceChampionship || g.bowlName || g.isCFPFirstRound ||
           g.isCFPQuarterfinal || g.isCFPSemifinal || g.isCFPChampionship
  }

  // Calculate stats for selected team and year
  const stats = useMemo(() => {
    const games = (currentDynasty.games || []).filter(g => {
      if (g.isCPUGame) return false
      const gameYear = parseInt(g.year)
      if (gameYear !== selectedYear) return false
      // Check if this game belongs to the selected team
      return g.userTeam === selectedTeam
    })

    const wins = games.filter(isWin).length
    const losses = games.filter(isLoss).length

    // Favorite/Underdog records
    const favoriteGames = games.filter(g => g.favoriteStatus === 'favorite')
    const favoriteWins = favoriteGames.filter(isWin).length
    const favoriteLosses = favoriteGames.filter(isLoss).length

    const underdogGames = games.filter(g => g.favoriteStatus === 'underdog')
    const underdogWins = underdogGames.filter(isWin).length
    const underdogLosses = underdogGames.filter(isLoss).length

    // Postseason games (conference championship, bowls, CFP)
    const postseasonGames = games.filter(isPostseasonGame)
    const postseasonWins = postseasonGames.filter(isWin).length
    const postseasonLosses = postseasonGames.filter(isLoss).length

    // Conference games
    const conferenceGames = games.filter(g => g.isConferenceGame)
    const confWins = conferenceGames.filter(isWin).length
    const confLosses = conferenceGames.filter(isLoss).length

    // Home/Away records
    const homeGames = games.filter(g => g.location === 'Home' || g.location === 'home')
    const homeWins = homeGames.filter(isWin).length
    const homeLosses = homeGames.filter(isLoss).length

    const awayGames = games.filter(g => g.location === 'Road' || g.location === 'Away' || g.location === 'road' || g.location === 'away')
    const awayWins = awayGames.filter(isWin).length
    const awayLosses = awayGames.filter(isLoss).length

    const neutralGames = games.filter(g => g.location === 'Neutral' || g.location === 'neutral')
    const neutralWins = neutralGames.filter(isWin).length
    const neutralLosses = neutralGames.filter(isLoss).length

    return {
      games,
      overall: { wins, losses, record: `${wins}-${losses}` },
      favorite: { wins: favoriteWins, losses: favoriteLosses, record: `${favoriteWins}-${favoriteLosses}`, games: favoriteGames },
      underdog: { wins: underdogWins, losses: underdogLosses, record: `${underdogWins}-${underdogLosses}`, games: underdogGames },
      postseason: { wins: postseasonWins, losses: postseasonLosses, record: `${postseasonWins}-${postseasonLosses}`, games: postseasonGames },
      conference: { wins: confWins, losses: confLosses, record: `${confWins}-${confLosses}`, games: conferenceGames },
      home: { wins: homeWins, losses: homeLosses, record: `${homeWins}-${homeLosses}`, games: homeGames },
      away: { wins: awayWins, losses: awayLosses, record: `${awayWins}-${awayLosses}`, games: awayGames },
      neutral: { wins: neutralWins, losses: neutralLosses, record: `${neutralWins}-${neutralLosses}`, games: neutralGames }
    }
  }, [currentDynasty, selectedTeam, selectedYear])

  // Aggregate team stats from box scores
  const teamStats = useMemo(() => {
    // Offense stats
    let pointsFor = 0
    let totalOffense = 0
    let rushAttempts = 0
    let rushYards = 0
    let rushTds = 0
    let passAttempts = 0
    let passYards = 0
    let passTds = 0
    let firstDowns = 0

    // Defense stats
    let pointsAgainst = 0
    let defTotalYards = 0
    let defPassYards = 0
    let defRushYards = 0
    let defSacks = 0
    let forcedFumbles = 0
    let defInterceptions = 0

    let gamesWithStats = 0

    // First, aggregate from box scores
    stats.games.forEach(game => {
      // Add points from game scores
      pointsFor += game.teamScore || 0
      pointsAgainst += game.opponentScore || 0

      if (!game.boxScore) return

      // Determine which side we are on (home or away) based on location
      const isHome = game.location === 'home' || game.location === 'Home'
      const ourPlayerBoxScore = isHome ? game.boxScore.home : game.boxScore.away

      // Aggregate offense from team stats
      if (game.boxScore.teamStats) {
        const homeAbbr = game.boxScore.teamStats.home?.teamAbbr?.toUpperCase()
        const awayAbbr = game.boxScore.teamStats.away?.teamAbbr?.toUpperCase()

        let ourTeamStats = null
        let oppTeamStats = null

        if (homeAbbr === selectedTeam) {
          ourTeamStats = game.boxScore.teamStats.home
          oppTeamStats = game.boxScore.teamStats.away
        } else if (awayAbbr === selectedTeam) {
          ourTeamStats = game.boxScore.teamStats.away
          oppTeamStats = game.boxScore.teamStats.home
        }

        if (ourTeamStats) {
          gamesWithStats++
          totalOffense += parseFloat(ourTeamStats.totalOffense) || 0
          rushAttempts += parseFloat(ourTeamStats.rushAttempts) || 0
          rushYards += parseFloat(ourTeamStats.rushYards) || 0
          rushTds += parseFloat(ourTeamStats.rushTds) || 0
          passAttempts += parseFloat(ourTeamStats.passAttempts) || 0
          passYards += parseFloat(ourTeamStats.passYards) || 0
          passTds += parseFloat(ourTeamStats.passTds) || 0
          firstDowns += parseFloat(ourTeamStats.firstDowns) || 0
        }

        // Opponent's offense = our defense allowed
        if (oppTeamStats) {
          defTotalYards += parseFloat(oppTeamStats.totalOffense) || 0
          defPassYards += parseFloat(oppTeamStats.passYards) || 0
          defRushYards += parseFloat(oppTeamStats.rushYards) || 0
        }
      }

      // Aggregate defensive player stats (sacks, forced fumbles, interceptions)
      if (ourPlayerBoxScore?.defense && Array.isArray(ourPlayerBoxScore.defense)) {
        ourPlayerBoxScore.defense.forEach(player => {
          defSacks += parseFloat(player.sack) || 0
          forcedFumbles += parseFloat(player.fF) || 0
          defInterceptions += parseFloat(player.iNT) || 0
        })
      }
    })

    // Calculate rate stats using total games played
    const totalGamesPlayed = stats.games.length
    const totalPlays = rushAttempts + passAttempts
    const yardsPerPlay = totalPlays > 0 ? totalOffense / totalPlays : 0
    const passYardsPerGame = totalGamesPlayed > 0 ? passYards / totalGamesPlayed : 0
    const rushYardsPerCarry = rushAttempts > 0 ? rushYards / rushAttempts : 0

    const aggregated = {
      gamesWithStats,
      // Offense
      pointsFor,
      totalOffense,
      yardsPerPlay,
      passYards,
      passYardsPerGame,
      passTds,
      rushYards,
      rushYardsPerCarry,
      rushTds,
      firstDowns,
      // Defense
      pointsAgainst,
      defTotalYards,
      defPassYards,
      defRushYards,
      defSacks,
      forcedFumbles,
      defInterceptions
    }

    // Check for manual override stats from Google Sheet (end-of-season entry)
    const manualStats = currentDynasty.teamStatsByYear?.[selectedYear]

    // Apply manual overrides - only override fields that have real values (not null)
    if (manualStats) {
      const overrideFields = [
        'pointsFor', 'totalOffense', 'yardsPerPlay', 'passYards', 'passYardsPerGame',
        'passTds', 'rushYards', 'rushYardsPerCarry', 'rushTds', 'firstDowns',
        'pointsAgainst', 'defTotalYards', 'defPassYards', 'defRushYards',
        'defSacks', 'forcedFumbles', 'defInterceptions'
      ]

      let hasOverrides = false
      overrideFields.forEach(field => {
        if (manualStats[field] !== null && manualStats[field] !== undefined) {
          aggregated[field] = manualStats[field]
          hasOverrides = true
        }
      })

      if (hasOverrides) {
        aggregated.hasManualOverrides = true
      }
    }

    return aggregated
  }, [currentDynasty, selectedTeam, selectedYear, stats.games])

  const handleTeamChange = (newTeam) => {
    navigate(`${pathPrefix}/team-stats/${newTeam}/${selectedYear}`)
  }

  const handleYearChange = (newYear) => {
    navigate(`${pathPrefix}/team-stats/${selectedTeam}/${newYear}`)
  }

  const openModal = (title, games) => {
    if (games && games.length > 0) {
      setModalData({ title, games: games.sort((a, b) => (a.week || 0) - (b.week || 0)) })
    }
  }

  // Stat card component for records
  const RecordCard = ({ label, value, subtext, games, clickable }) => (
    <div
      className={`text-center p-4 rounded-lg border-2 ${clickable && games?.length > 0 ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      style={{
        backgroundColor: teamColors.secondary,
        borderColor: teamColors.primary
      }}
      onClick={() => clickable && games?.length > 0 && openModal(label, games)}
    >
      <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: secondaryText }}>
        {value}
      </div>
      {subtext && (
        <div className="text-xs mt-1 opacity-60" style={{ color: secondaryText }}>
          {subtext}
        </div>
      )}
      {clickable && games?.length > 0 && (
        <div className="text-xs mt-1" style={{ color: secondaryText, opacity: 0.5 }}>
          Click to view
        </div>
      )}
    </div>
  )

  // Stat card for team stats
  const StatCard = ({ label, value, subtext }) => (
    <div
      className="text-center p-3 rounded-lg"
      style={{ backgroundColor: `${teamColors.primary}20` }}
    >
      <div className="text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.7 }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ color: secondaryText }}>
        {value}
      </div>
      {subtext && (
        <div className="text-xs mt-0.5" style={{ color: secondaryText, opacity: 0.6 }}>
          {subtext}
        </div>
      )}
    </div>
  )

  // Get game week label
  const getGameWeekLabel = (game) => {
    if (game.isCFPChampionship) return 'NCG'
    if (game.isCFPSemifinal) return 'CFP Semi'
    if (game.isCFPQuarterfinal) return 'CFP QF'
    if (game.isCFPFirstRound) return 'CFP R1'
    if (game.bowlName) return 'Bowl'
    if (game.isConferenceChampionship) return 'CCG'
    return `Wk ${game.week}`
  }

  // Calculate per-game averages
  const gamesPlayed = stats.games.length || 1
  const gamesWithStats = teamStats.gamesWithStats || 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Team Logo */}
          {teamLogo && (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: '#FFFFFF',
                border: `3px solid ${teamColors.secondary}`,
                padding: '4px'
              }}
            >
              <img
                src={teamLogo}
                alt={teamFullName}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex-1">
            <h2 className="text-2xl font-bold" style={{ color: primaryText }}>
              {teamFullName}
            </h2>
            <div className="text-lg font-semibold mt-1" style={{ color: primaryText, opacity: 0.8 }}>
              {selectedYear} Season Statistics
            </div>
          </div>

          {/* Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Team Dropdown */}
            <select
              value={selectedTeam}
              onChange={(e) => handleTeamChange(e.target.value)}
              className="px-3 py-2 rounded-lg font-semibold text-sm cursor-pointer"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText,
                border: `2px solid ${teamColors.secondary}`
              }}
            >
              {availableTeams.map(team => (
                <option key={team} value={team}>
                  {getMascotName(team) || team}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-3 py-2 rounded-lg font-semibold text-sm cursor-pointer"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText,
                border: `2px solid ${teamColors.secondary}`
              }}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Season Records */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: primaryText }}>
          Season Records
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <RecordCard label="Overall Record" value={stats.overall.record} />
          <RecordCard
            label="As Favorite"
            value={stats.favorite.record}
            subtext={`${stats.favorite.games.length} games`}
            games={stats.favorite.games}
            clickable
          />
          <RecordCard
            label="As Underdog"
            value={stats.underdog.record}
            subtext={`${stats.underdog.games.length} games`}
            games={stats.underdog.games}
            clickable
          />
          <RecordCard
            label="Postseason"
            value={stats.postseason.record}
            subtext={stats.postseason.games.length > 0 ? `${stats.postseason.games.length} games` : null}
            games={stats.postseason.games}
            clickable
          />
          <RecordCard
            label="Conference"
            value={stats.conference.record}
            games={stats.conference.games}
            clickable
          />
          <RecordCard
            label="Home"
            value={stats.home.record}
            games={stats.home.games}
            clickable
          />
          <RecordCard
            label="Away"
            value={stats.away.record}
            games={stats.away.games}
            clickable
          />
          <RecordCard label="Neutral" value={stats.neutral.record} />
        </div>
      </div>

      {/* Team Statistics */}
      {(teamStats.gamesWithStats > 0 || stats.games.length > 0) && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{ color: secondaryText }}>
              Team Statistics
            </h3>
            <span className="text-sm" style={{ color: secondaryText, opacity: 0.7 }}>
              {gamesPlayed} games played{teamStats.hasManualOverrides ? ' (With Overrides)' : ''}
            </span>
          </div>

          {/* Offense */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: secondaryText, opacity: 0.7 }}>
              Offense
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <StatCard
                label="Points"
                value={teamStats.pointsFor}
                subtext={gamesPlayed > 0 ? `${(teamStats.pointsFor / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Offense Yards"
                value={teamStats.totalOffense.toLocaleString()}
                subtext={gamesPlayed > 0 ? `${(teamStats.totalOffense / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Yards Per Play"
                value={teamStats.yardsPerPlay.toFixed(1)}
              />
              <StatCard
                label="Passing Yards"
                value={teamStats.passYards.toLocaleString()}
                subtext={gamesPlayed > 0 ? `${(teamStats.passYards / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Pass Yds/Game"
                value={teamStats.passYardsPerGame.toFixed(1)}
              />
              <StatCard
                label="Passing TDs"
                value={teamStats.passTds}
                subtext={gamesPlayed > 0 ? `${(teamStats.passTds / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Rushing Yards"
                value={teamStats.rushYards.toLocaleString()}
                subtext={gamesPlayed > 0 ? `${(teamStats.rushYards / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Rush Yds/Carry"
                value={teamStats.rushYardsPerCarry.toFixed(1)}
              />
              <StatCard
                label="Rushing TDs"
                value={teamStats.rushTds}
                subtext={gamesPlayed > 0 ? `${(teamStats.rushTds / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="First Downs"
                value={teamStats.firstDowns}
                subtext={gamesPlayed > 0 ? `${(teamStats.firstDowns / gamesPlayed).toFixed(1)}/G` : null}
              />
            </div>
          </div>

          {/* Defense */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: secondaryText, opacity: 0.7 }}>
              Defense
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <StatCard
                label="Points Allowed"
                value={teamStats.pointsAgainst}
                subtext={gamesPlayed > 0 ? `${(teamStats.pointsAgainst / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Total Yds Allowed"
                value={teamStats.defTotalYards.toLocaleString()}
                subtext={gamesPlayed > 0 ? `${(teamStats.defTotalYards / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Pass Yds Allowed"
                value={teamStats.defPassYards.toLocaleString()}
                subtext={gamesPlayed > 0 ? `${(teamStats.defPassYards / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Rush Yds Allowed"
                value={teamStats.defRushYards.toLocaleString()}
                subtext={gamesPlayed > 0 ? `${(teamStats.defRushYards / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Sacks"
                value={teamStats.defSacks}
                subtext={gamesPlayed > 0 ? `${(teamStats.defSacks / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Forced Fumbles"
                value={teamStats.forcedFumbles}
                subtext={gamesPlayed > 0 ? `${(teamStats.forcedFumbles / gamesPlayed).toFixed(1)}/G` : null}
              />
              <StatCard
                label="Interceptions"
                value={teamStats.defInterceptions}
                subtext={gamesPlayed > 0 ? `${(teamStats.defInterceptions / gamesPlayed).toFixed(1)}/G` : null}
              />
            </div>
          </div>
        </div>
      )}

      {/* Game Log Modal */}
      {modalData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ margin: 0 }}
          onClick={() => setModalData(null)}
        >
          <div
            className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: teamColors.secondary }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ backgroundColor: teamColors.primary }}
            >
              <div className="flex items-center gap-3">
                {teamLogo && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white p-1.5">
                    <img
                      src={teamLogo}
                      alt={teamFullName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold" style={{ color: primaryText }}>
                    {modalData.title}
                  </h3>
                  <p className="text-sm opacity-80" style={{ color: primaryText }}>
                    {modalData.games.length} {modalData.games.length === 1 ? 'Game' : 'Games'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalData(null)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
                style={{ color: primaryText }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Game Log */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {modalData.games.map((game, idx) => {
                  const oppMascot = getMascotName(game.opponent)
                  const oppLogo = oppMascot ? getTeamLogo(oppMascot) : null
                  const won = isWin(game)
                  const lost = isLoss(game)

                  return (
                    <Link
                      key={game.id || idx}
                      to={`${pathPrefix}/game/${game.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: teamColors.primary }}
                      onClick={() => setModalData(null)}
                    >
                      {/* Week */}
                      <div className="w-16 text-center">
                        <div className="text-xs font-semibold" style={{ color: primaryText, opacity: 0.7 }}>
                          {getGameWeekLabel(game)}
                        </div>
                      </div>

                      {/* Result */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{
                          backgroundColor: won ? '#16a34a' : lost ? '#dc2626' : '#6b7280',
                          color: '#FFFFFF'
                        }}
                      >
                        {won ? 'W' : lost ? 'L' : '-'}
                      </div>

                      {/* Location */}
                      <div className="w-8 text-center text-xs font-semibold" style={{ color: primaryText, opacity: 0.7 }}>
                        {game.location === 'Home' || game.location === 'home' ? 'vs' : '@'}
                      </div>

                      {/* Opponent Logo */}
                      {oppLogo && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: '#FFFFFF', padding: '2px' }}
                        >
                          <img src={oppLogo} alt="" className="w-full h-full object-contain" />
                        </div>
                      )}

                      {/* Opponent Name */}
                      <div className="flex-1 font-semibold truncate" style={{ color: primaryText }}>
                        {oppMascot || game.opponent}
                      </div>

                      {/* Score */}
                      <div className="font-bold" style={{ color: primaryText }}>
                        {game.teamScore} - {game.opponentScore}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
