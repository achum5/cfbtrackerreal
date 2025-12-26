import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamConference } from '../../data/conferenceTeams'
import { getConferenceLogo } from '../../data/conferenceLogos'
import { getTeamLogo } from '../../data/teams'

// Map abbreviation to mascot name for logo lookup
const getMascotName = (abbr) => {
  const mascotMap = {
    'BAMA': 'Alabama Crimson Tide',
    'AFA': 'Air Force Falcons',
    'AKR': 'Akron Zips',
    'APP': 'Appalachian State Mountaineers',
    'ARIZ': 'Arizona Wildcats',
    'ARK': 'Arkansas Razorbacks',
    'ARMY': 'Army Black Knights',
    'ARST': 'Arkansas State Red Wolves',
    'ASU': 'Arizona State Sun Devils',
    'AUB': 'Auburn Tigers',
    'BALL': 'Ball State Cardinals',
    'BC': 'Boston College Eagles',
    'BGSU': 'Bowling Green Falcons',
    'BOIS': 'Boise State Broncos',
    'BU': 'Baylor Bears',
    'BUFF': 'Buffalo Bulls',
    'BYU': 'Brigham Young Cougars',
    'CAL': 'California Golden Bears',
    'CCU': 'Coastal Carolina Chanticleers',
    'CHAR': 'Charlotte 49ers',
    'CINN': 'Cincinnati Bearcats',
    'CLEM': 'Clemson Tigers',
    'CMU': 'Central Michigan Chippewas',
    'COLO': 'Colorado Buffaloes',
    'CONN': 'Connecticut Huskies',
    'CSU': 'Colorado State Rams',
    'DEL': 'Delaware Fightin\' Blue Hens',
    'DUKE': 'Duke Blue Devils',
    'ECU': 'East Carolina Pirates',
    'EMU': 'Eastern Michigan Eagles',
    'FAU': 'Florida Atlantic Owls',
    'FIU': 'Florida International Panthers',
    'FLA': 'Florida Gators',
    'FRES': 'Fresno State Bulldogs',
    'FSU': 'Florida State Seminoles',
    'GASO': 'Georgia Southern Eagles',
    'GSU': 'Georgia State Panthers',
    'GT': 'Georgia Tech Yellow Jackets',
    'HAW': 'Hawaii Rainbow Warriors',
    'HOU': 'Houston Cougars',
    'ILL': 'Illinois Fighting Illini',
    'IU': 'Indiana Hoosiers',
    'IOWA': 'Iowa Hawkeyes',
    'ISU': 'Iowa State Cyclones',
    'JKST': 'Jacksonville State Gamecocks',
    'JMU': 'James Madison Dukes',
    'KENN': 'Kennesaw State Owls',
    'KENT': 'Kent State Golden Flashes',
    'KSU': 'Kansas State Wildcats',
    'KU': 'Kansas Jayhawks',
    'LIB': 'Liberty Flames',
    'LOU': 'Louisville Cardinals',
    'LSU': 'LSU Tigers',
    'LT': 'Louisiana Tech Bulldogs',
    'M-OH': 'Miami Redhawks',
    'MASS': 'Massachusetts Minutemen',
    'MEM': 'Memphis Tigers',
    'MIA': 'Miami Hurricanes',
    'MICH': 'Michigan Wolverines',
    'MINN': 'Minnesota Golden Gophers',
    'MISS': 'Ole Miss Rebels',
    'MIZ': 'Missouri Tigers',
    'MRSH': 'Marshall Thundering Herd',
    'MRYD': 'Maryland Terrapins',
    'MSST': 'Mississippi State Bulldogs',
    'MSU': 'Michigan State Spartans',
    'MTSU': 'Middle Tennessee State Blue Raiders',
    'MZST': 'Missouri State Bears',
    'NAVY': 'Navy Midshipmen',
    'NCST': 'North Carolina State Wolfpack',
    'ND': 'Notre Dame Fighting Irish',
    'NEB': 'Nebraska Cornhuskers',
    'NEV': 'Nevada Wolf Pack',
    'NIU': 'Northern Illinois Huskies',
    'NMSU': 'New Mexico State Aggies',
    'NU': 'Northwestern Wildcats',
    'ODU': 'Old Dominion Monarchs',
    'OHIO': 'Ohio Bobcats',
    'OHIO ST': 'Ohio State Buckeyes',
    'OKST': 'Oklahoma State Cowboys',
    'ORE': 'Oregon Ducks',
    'ORST': 'Oregon State Beavers',
    'OSU': 'Ohio State Buckeyes',
    'OU': 'Oklahoma Sooners',
    'PITT': 'Pittsburgh Panthers',
    'PSU': 'Penn State Nittany Lions',
    'PUR': 'Purdue Boilermakers',
    'RICE': 'Rice Owls',
    'RUTG': 'Rutgers Scarlet Knights',
    'SCAR': 'South Carolina Gamecocks',
    'SDSU': 'San Diego State Aztecs',
    'SHSU': 'Sam Houston State Bearkats',
    'SJSU': 'San Jose State Spartans',
    'SMU': 'SMU Mustangs',
    'STAN': 'Stanford Cardinal',
    'SYR': 'Syracuse Orange',
    'TAMU': 'Texas A&M Aggies',
    'TCU': 'TCU Horned Frogs',
    'TEM': 'Temple Owls',
    'TENN': 'Tennessee Volunteers',
    'TEX': 'Texas Longhorns',
    'TLNE': 'Tulane Green Wave',
    'TLSA': 'Tulsa Golden Hurricane',
    'TOL': 'Toledo Rockets',
    'TROY': 'Troy Trojans',
    'TTU': 'Texas Tech Red Raiders',
    'TULN': 'Tulane Green Wave',
    'TXAM': 'Texas A&M Aggies',
    'TXST': 'Texas State Bobcats',
    'UAB': 'UAB Blazers',
    'UC': 'Cincinnati Bearcats',
    'UCF': 'UCF Knights',
    'UCLA': 'UCLA Bruins',
    'UGA': 'Georgia Bulldogs',
    'UH': 'Houston Cougars',
    'UK': 'Kentucky Wildcats',
    'UL': 'Lafayette Ragin\' Cajuns',
    'ULL': 'Lafayette Ragin\' Cajuns',
    'ULM': 'Monroe Warhawks',
    'UMD': 'Maryland Terrapins',
    'UNC': 'North Carolina Tar Heels',
    'UNLV': 'UNLV Rebels',
    'UNM': 'New Mexico Lobos',
    'UNT': 'North Texas Mean Green',
    'USA': 'South Alabama Jaguars',
    'USC': 'USC Trojans',
    'USF': 'South Florida Bulls',
    'USM': 'Southern Mississippi Golden Eagles',
    'USU': 'Utah State Aggies',
    'UT': 'Tennessee Volunteers',
    'UTAH': 'Utah Utes',
    'UTEP': 'UTEP Miners',
    'UTSA': 'UTSA Roadrunners',
    'UVA': 'Virginia Cavaliers',
    'VAN': 'Vanderbilt Commodores',
    'VAND': 'Vanderbilt Commodores',
    'VT': 'Virginia Tech Hokies',
    'WAKE': 'Wake Forest Demon Deacons',
    'WASH': 'Washington Huskies',
    'WIS': 'Wisconsin Badgers',
    'WISC': 'Wisconsin Badgers',
    'WKU': 'Western Kentucky Hilltoppers',
    'WMU': 'Western Michigan Broncos',
    'WSU': 'Washington State Cougars',
    'WVU': 'West Virginia Mountaineers',
    'WYO': 'Wyoming Cowboys',
    'GAST': 'Georgia State Panthers', 'OKLA': 'Oklahoma Sooners', 'RUT': 'Rutgers Scarlet Knights',
    'SAM': 'Sam Houston State Bearkats', 'TUL': 'Tulane Green Wave', 'TXTECH': 'Texas Tech Red Raiders',
    'UF': 'Florida Gators', 'UM': 'Miami Hurricanes', 'USM': 'Southern Mississippi Golden Eagles',
    // FCS teams
    'FCSE': 'FCS East Judicials',
    'FCSM': 'FCS Midwest Rebels',
    'FCSN': 'FCS Northwest Stallions',
    'FCSW': 'FCS West Titans'
  }
  return mascotMap[abbr] || null
}

// Extract just the school name from full mascot name
const getSchoolName = (mascotName) => {
  if (!mascotName) return ''

  // Two-word mascots that need to be removed
  const twoWordMascots = [
    'Crimson Tide', 'Golden Bears', 'Sun Devils', 'Red Wolves', 'Black Knights',
    'Blue Devils', 'Fighting Illini', 'Yellow Jackets', 'Fighting Irish', 'Nittany Lions',
    'Scarlet Knights', 'Golden Eagles', 'Demon Deacons', 'Horned Frogs', 'Green Wave',
    'Golden Hurricane', 'Mean Green', 'Tar Heels', 'Golden Gophers', 'Golden Flashes',
    'Blue Raiders', 'Wolf Pack', "Ragin' Cajuns", 'Rainbow Warriors'
  ]

  for (const mascot of twoWordMascots) {
    if (mascotName.endsWith(mascot)) {
      return mascotName.replace(` ${mascot}`, '')
    }
  }

  // Default: remove last word (single-word mascot)
  const words = mascotName.split(' ')
  if (words.length > 1) {
    return words.slice(0, -1).join(' ')
  }
  return mascotName
}

export default function Team() {
  const { id, teamAbbr } = useParams()
  const navigate = useNavigate()
  const { currentDynasty } = useDynasty()
  const [showGamesModal, setShowGamesModal] = useState(false)

  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [teamAbbr])

  if (!currentDynasty) return null

  // Get all teams sorted alphabetically by mascot name
  const allTeams = Object.entries(teamAbbreviations)
    .map(([abbr, info]) => {
      const fullName = getMascotName(abbr) || info.name
      return {
        abbr,
        name: fullName,
        shortName: getSchoolName(fullName),
        sortName: fullName.toLowerCase()
      }
    })
    .sort((a, b) => a.sortName.localeCompare(b.sortName))

  // Get team info
  const teamInfo = teamAbbreviations[teamAbbr]
  if (!teamInfo) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-lg shadow-lg p-6 bg-gray-100 border-2 border-gray-400"
        >
          <h1 className="text-2xl font-bold text-gray-700">
            Team Not Found
          </h1>
          <p className="mt-2 text-gray-600">
            The team "{teamAbbr}" was not found.
          </p>
          <Link
            to={`/dynasty/${id}/teams`}
            className="inline-block mt-4 px-4 py-2 rounded-lg font-semibold bg-gray-700 text-white hover:bg-gray-800"
          >
            Back to Teams
          </Link>
        </div>
      </div>
    )
  }

  const conference = getTeamConference(teamAbbr)
  const conferenceLogo = conference ? getConferenceLogo(conference) : null
  const mascotName = getMascotName(teamAbbr)
  const teamLogo = mascotName ? getTeamLogo(mascotName) : null
  const teamBgText = getContrastTextColor(teamInfo.backgroundColor)
  const teamPrimaryText = getContrastTextColor(teamInfo.textColor)

  // Get user's team abbreviation
  const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)

  // Get all games against this team (only user's games, not CPU vs CPU bowl games)
  const gamesAgainst = (currentDynasty.games || [])
    .filter(g => {
      // Must be against the team we're viewing
      if (g.opponent !== teamAbbr) return false

      // If userTeam field exists, verify it matches the dynasty's team
      if (g.userTeam && g.userTeam !== userTeamAbbr && g.userTeam !== currentDynasty.teamName) {
        return false
      }

      // Exclude CPU vs CPU games (games that have isCPUGame flag or don't have user team involvement)
      if (g.isCPUGame) return false

      return true
    })

  // Calculate all-time record vs this team
  const allTimeWins = gamesAgainst.filter(g => g.result === 'W').length
  const allTimeLosses = gamesAgainst.filter(g => g.result === 'L').length
  const winPctVs = gamesAgainst.length > 0
    ? ((allTimeWins / gamesAgainst.length) * 100).toFixed(1)
    : null

  // Calculate conference titles dynamically from conferenceChampionshipsByYear
  const conferenceTitles = Object.values(currentDynasty.conferenceChampionshipsByYear || {})
    .flat()
    .filter(cc => cc.winner === teamAbbr)
    .length

  // Get all dynasty years (defined early for use in getFinalRanking)
  const startYear = currentDynasty.startYear
  const currentYear = currentDynasty.currentYear

  // Get final media poll ranking for this team (most recent completed year)
  const getFinalRanking = () => {
    const finalPolls = currentDynasty.finalPollsByYear || {}
    // Check each year from most recent to oldest
    for (let year = currentYear; year >= startYear; year--) {
      const yearPolls = finalPolls[year]
      if (yearPolls?.media) {
        const teamRanking = yearPolls.media.find(p => p && p.team === teamAbbr)
        if (teamRanking) {
          return { rank: teamRanking.rank, year }
        }
      }
    }
    return null
  }

  const finalRanking = getFinalRanking()

  // Calculate AP Top 25 finishes dynamically from finalPollsByYear
  const getApTop25Finishes = () => {
    const finalPolls = currentDynasty.finalPollsByYear || {}
    let count = 0
    Object.values(finalPolls).forEach(yearPolls => {
      if (yearPolls?.media) {
        const isRanked = yearPolls.media.some(p => p.team === teamAbbr)
        if (isRanked) count++
      }
    })
    return count
  }

  const apTop25Finishes = getApTop25Finishes()

  // Calculate bowl wins dynamically from bowlGamesByYear
  const getBowlWinsForTeam = () => {
    const bowlWins = []
    const bowlGamesByYear = currentDynasty.bowlGamesByYear || {}

    Object.entries(bowlGamesByYear).forEach(([year, yearData]) => {
      const allBowls = [...(yearData?.week1 || []), ...(yearData?.week2 || [])]
      allBowls.forEach(bowl => {
        if (!bowl.team1 || !bowl.team2 || bowl.team1Score === null || bowl.team2Score === null) return

        const isTeam1 = bowl.team1 === teamAbbr
        const isTeam2 = bowl.team2 === teamAbbr
        if (!isTeam1 && !isTeam2) return

        const teamWon = (isTeam1 && bowl.team1Score > bowl.team2Score) ||
                        (isTeam2 && bowl.team2Score > bowl.team1Score)

        if (teamWon) {
          bowlWins.push({
            year: parseInt(year),
            bowlName: bowl.bowlName
          })
        }
      })
    })

    return bowlWins
  }

  const bowlWins = getBowlWinsForTeam()

  // Calculate "Games As" - games where user played AS this team
  const getGamesAsTeam = () => {
    const games = currentDynasty.games || []
    return games.filter(g => {
      if (g.isCPUGame) return false
      // Check if this game was played by the team we're viewing
      if (g.userTeam === teamAbbr) return true
      // Legacy fallback: if no userTeam and this is the current user's team
      if (!g.userTeam && teamAbbr === userTeamAbbr) return true
      return false
    })
  }

  const gamesAsTeam = getGamesAsTeam()
  const gamesAsWins = gamesAsTeam.filter(g => g.result === 'W' || g.result === 'win').length
  const gamesAsLosses = gamesAsTeam.filter(g => g.result === 'L' || g.result === 'loss').length
  const winPctAs = gamesAsTeam.length > 0
    ? ((gamesAsWins / gamesAsTeam.length) * 100).toFixed(1)
    : null

  // Calculate CFP Appearances - years where this team was seeded in CFP
  const getCFPAppearances = () => {
    const cfpSeeds = currentDynasty.cfpSeedsByYear || {}
    let count = 0
    Object.values(cfpSeeds).forEach(yearSeeds => {
      if (Array.isArray(yearSeeds)) {
        const isSeeded = yearSeeds.some(s => s.team === teamAbbr)
        if (isSeeded) count++
      }
    })
    return count
  }

  const cfpAppearances = getCFPAppearances()

  // Calculate National Titles - years where this team won the CFP Championship
  const getNationalTitles = () => {
    const cfpResults = currentDynasty.cfpResultsByYear || {}
    let count = 0
    Object.values(cfpResults).forEach(yearResults => {
      // Check championship array for winner
      const championship = yearResults?.championship
      if (Array.isArray(championship) && championship.length > 0) {
        if (championship[0]?.winner === teamAbbr) count++
      }
    })
    return count
  }

  const nationalTitles = getNationalTitles()

  // Calculate All-Americans count - first-team All-Americans for this team
  const getAllAmericansCount = () => {
    const players = currentDynasty.players || []
    let count = 0
    players.forEach(player => {
      // Check if player belongs to this team
      const playerTeam = player.team || (player.isHonorOnly ? null : userTeamAbbr)
      if (playerTeam !== teamAbbr && !player.teams?.includes(teamAbbr)) return

      // Count first-team All-American awards
      const allAmericans = player.allAmericans || []
      allAmericans.forEach(aa => {
        if (aa.team === '1st Team' || aa.team === 'First Team') count++
      })
    })
    return count
  }

  const allAmericansCount = getAllAmericansCount()

  // Get bowl result for a specific year (returns { bowlName, won } or null)
  const getBowlResultForYear = (year) => {
    const yearData = currentDynasty.bowlGamesByYear?.[year]
    if (!yearData) return null

    const allBowls = [...(yearData?.week1 || []), ...(yearData?.week2 || [])]
    const teamBowl = allBowls.find(bowl =>
      (bowl.team1 === teamAbbr || bowl.team2 === teamAbbr) &&
      bowl.team1Score !== null && bowl.team2Score !== null
    )

    if (!teamBowl) return null

    const isTeam1 = teamBowl.team1 === teamAbbr
    const won = (isTeam1 && teamBowl.team1Score > teamBowl.team2Score) ||
                (!isTeam1 && teamBowl.team2Score > teamBowl.team1Score)

    return {
      bowlName: teamBowl.bowlName,
      won
    }
  }

  // Build years array
  const years = []
  for (let year = startYear; year <= currentYear; year++) {
    years.push(year)
  }

  // Get team record from conference standings for a specific year
  const getTeamRecordFromStandings = (year) => {
    const standingsByYear = currentDynasty.conferenceStandingsByYear || {}
    const yearStandings = standingsByYear[year] || {}

    for (const confTeams of Object.values(yearStandings)) {
      if (Array.isArray(confTeams)) {
        const teamData = confTeams.find(t => t && t.team === teamAbbr)
        if (teamData) {
          return {
            wins: teamData.wins || 0,
            losses: teamData.losses || 0
          }
        }
      }
    }
    return null
  }

  // Check if team won conference championship in a year
  const getConferenceChampionshipForYear = (year) => {
    const yearChampionships = currentDynasty.conferenceChampionshipsByYear?.[year] || []
    const teamCC = yearChampionships.find(cc =>
      cc && (cc.team1 === teamAbbr || cc.team2 === teamAbbr) &&
      cc.winner === teamAbbr
    )
    return teamCC ? teamCC.conference : null
  }

  // Check if team was in CFP this year and where they were eliminated
  const getCFPResultForYear = (year) => {
    const cfpSeeds = currentDynasty.cfpSeedsByYear?.[year] || []
    const teamSeed = cfpSeeds.find(s => s && s.team === teamAbbr)
    if (!teamSeed) return null

    const cfpResults = currentDynasty.cfpResultsByYear?.[year] || {}

    // Check for national championship win
    const championship = cfpResults.championship?.[0]
    if (championship && championship.winner === teamAbbr) {
      return { type: 'champion', seed: teamSeed.seed }
    }

    // Check if lost in championship game
    if (championship && (championship.team1 === teamAbbr || championship.team2 === teamAbbr)) {
      return { type: 'lost', round: 'Champ', seed: teamSeed.seed }
    }

    // Check if lost in semifinals
    const semifinals = cfpResults.semifinals || []
    const sfGame = semifinals.find(g => g && (g.team1 === teamAbbr || g.team2 === teamAbbr))
    if (sfGame && sfGame.winner && sfGame.winner !== teamAbbr) {
      return { type: 'lost', round: 'SF', seed: teamSeed.seed }
    }

    // Check if lost in quarterfinals
    const quarterfinals = cfpResults.quarterfinals || []
    const qfGame = quarterfinals.find(g => g && (g.team1 === teamAbbr || g.team2 === teamAbbr))
    if (qfGame && qfGame.winner && qfGame.winner !== teamAbbr) {
      return { type: 'lost', round: 'QF', seed: teamSeed.seed }
    }

    // Check if lost in first round (seeds 5-12 play first round)
    const firstRound = cfpResults.firstRound || []
    const r1Game = firstRound.find(g => g && (g.team1 === teamAbbr || g.team2 === teamAbbr))
    if (r1Game && r1Game.winner && r1Game.winner !== teamAbbr) {
      return { type: 'lost', round: 'R1', seed: teamSeed.seed }
    }

    // Team is in CFP but results not yet entered
    return { type: 'pending', seed: teamSeed.seed }
  }

  // Get final ranking for a specific year
  const getFinalRankingForYear = (year) => {
    const pollsData = currentDynasty.finalPollsByYear?.[year]
    if (!pollsData?.media) return null
    const teamRank = pollsData.media.find(p => p && p.team === teamAbbr)
    return teamRank?.rank || null
  }

  // Calculate record for each year from conference standings
  const yearRecords = years.map(year => {
    const standingsRecord = getTeamRecordFromStandings(year)
    const bowlResult = getBowlResultForYear(year)
    const ccWin = getConferenceChampionshipForYear(year)
    const cfpResult = getCFPResultForYear(year)
    const finalRank = getFinalRankingForYear(year)

    return {
      year,
      wins: standingsRecord?.wins || 0,
      losses: standingsRecord?.losses || 0,
      hasRecord: !!standingsRecord,
      bowlResult,
      ccWin,
      cfpResult,
      finalRank
    }
  })

  // Find best and worst years (only years with records)
  const yearsWithRecords = yearRecords.filter(yr => yr.hasRecord)
  let bestYear = null
  let worstYear = null

  if (yearsWithRecords.length > 0) {
    bestYear = yearsWithRecords.reduce((best, curr) => {
      if (curr.wins > best.wins) return curr
      if (curr.wins === best.wins && curr.losses < best.losses) return curr
      return best
    })

    worstYear = yearsWithRecords.reduce((worst, curr) => {
      if (curr.losses > worst.losses) return curr
      if (curr.losses === worst.losses && curr.wins < worst.wins) return curr
      return worst
    })
  }

  // Calculate vs user record (for Your History section)
  const vsUserYearRecords = years.map(year => {
    const yearGames = gamesAgainst.filter(g => g.year === year)
    const wins = yearGames.filter(g => g.result === 'W').length
    const losses = yearGames.filter(g => g.result === 'L').length
    return { year, wins, losses, hasGames: yearGames.length > 0 }
  })
  const vsUserYearsWithGames = vsUserYearRecords.filter(yr => yr.hasGames)

  // Stat cell component
  const StatCell = ({ label, value, subValue }) => (
    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: `${teamBgText}10` }}>
      <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ color: teamBgText }}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
          {subValue}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Navigation Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Team Dropdown */}
        <select
          value={teamAbbr}
          onChange={(e) => navigate(`/dynasty/${id}/team/${e.target.value}`)}
          className="px-3 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2 ml-auto"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            color: teamBgText,
            border: `2px solid ${teamBgText}40`
          }}
        >
          {allTeams.map((team) => (
            <option key={team.abbr} value={team.abbr}>
              {team.shortName}
            </option>
          ))}
        </select>
      </div>

      {/* Team Header */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamInfo.backgroundColor,
          border: `3px solid ${teamInfo.textColor}`
        }}
      >
        <div className="flex items-center gap-4">
          {teamLogo && (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: '#FFFFFF',
                border: `3px solid ${teamInfo.textColor}`,
                padding: '4px'
              }}
            >
              <img
                src={teamLogo}
                alt={`${teamInfo.name} logo`}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
              Team History
            </p>
            <h1 className="text-2xl font-bold" style={{ color: teamBgText }}>
              {finalRanking && (
                <span className="text-yellow-400 mr-2">#{finalRanking.rank}</span>
              )}
              {mascotName || teamInfo.name}
            </h1>
            {conference && (
              <div className="flex items-center gap-2 mt-2">
                {conferenceLogo && (
                  <img
                    src={conferenceLogo}
                    alt={`${conference} logo`}
                    className="w-5 h-5 object-contain"
                  />
                )}
                <span className="text-sm font-semibold" style={{ color: teamBgText, opacity: 0.8 }}>
                  {conference}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Season-by-Season History - Moved to top */}
      <div
        className="rounded-lg shadow-lg overflow-hidden"
        style={{
          backgroundColor: teamInfo.backgroundColor,
          border: `3px solid ${teamInfo.textColor}`
        }}
      >
        <div
          className="px-4 py-3"
          style={{ backgroundColor: teamInfo.textColor }}
        >
          <h2 className="text-lg font-bold" style={{ color: teamPrimaryText }}>
            Season-by-Season History
          </h2>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {yearRecords.map((yr) => {
            const isNationalChamp = yr.cfpResult?.type === 'champion'
            const madePlayoff = yr.cfpResult && yr.cfpResult.type !== 'pending'
            const hasAchievement = yr.ccWin || isNationalChamp

            return (
              <Link
                key={yr.year}
                to={`/dynasty/${id}/team/${teamAbbr}/${yr.year}`}
                className="p-4 rounded-lg text-center transition-transform hover:scale-[1.02]"
                style={{
                  backgroundColor: isNationalChamp
                    ? '#fbbf2420'
                    : hasAchievement
                      ? `${teamInfo.textColor}15`
                      : yr.hasRecord
                        ? `${teamBgText}15`
                        : `${teamBgText}05`,
                  border: isNationalChamp
                    ? '2px solid #fbbf24'
                    : hasAchievement
                      ? `2px solid ${teamInfo.textColor}`
                      : `2px solid ${yr.hasRecord ? `${teamBgText}40` : `${teamBgText}20`}`
                }}
              >
                {/* Year with optional ranking */}
                <div className="text-lg font-bold" style={{ color: teamBgText }}>
                  {yr.finalRank && (
                    <span className="text-yellow-500 mr-1">#{yr.finalRank}</span>
                  )}
                  {yr.year}
                </div>

                {/* Record */}
                <div
                  className="text-2xl font-bold mt-1"
                  style={{ color: yr.hasRecord ? teamBgText : `${teamBgText}50` }}
                >
                  {yr.hasRecord ? `${yr.wins}-${yr.losses}` : '--'}
                </div>

                {/* Achievements */}
                <div className="mt-2 space-y-1">
                  {/* National Champion */}
                  {isNationalChamp && (
                    <div
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{ backgroundColor: '#fbbf24', color: '#78350f' }}
                    >
                      National Champion
                    </div>
                  )}

                  {/* Conference Champion (not national champ) */}
                  {yr.ccWin && !isNationalChamp && (
                    <div
                      className="text-xs font-semibold px-2 py-1 rounded"
                      style={{ backgroundColor: teamInfo.textColor, color: teamPrimaryText }}
                    >
                      {yr.ccWin} Champs
                    </div>
                  )}

                  {/* CFP Result - show round eliminated (not champion) */}
                  {yr.cfpResult && yr.cfpResult.type === 'lost' && (
                    <div
                      className="text-xs font-semibold px-2 py-1 rounded"
                      style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}
                    >
                      CFP {yr.cfpResult.round}
                    </div>
                  )}

                  {/* Bowl Game - only show if NOT in CFP and played a bowl */}
                  {yr.bowlResult && !madePlayoff && !isNationalChamp && (
                    <div
                      className="text-xs font-semibold px-2 py-1 rounded"
                      style={{
                        backgroundColor: yr.bowlResult.won ? '#16a34a' : '#6b728080',
                        color: '#FFFFFF'
                      }}
                    >
                      {yr.bowlResult.bowlName}
                    </div>
                  )}
                </div>

                {/* No data message */}
                {!yr.hasRecord && !yr.bowlResult && !yr.ccWin && !yr.cfpResult && (
                  <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                    No data
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Team Accomplishments */}
      <div
        className="rounded-lg shadow-lg overflow-hidden"
        style={{
          backgroundColor: teamInfo.backgroundColor,
          border: `3px solid ${teamInfo.textColor}`
        }}
      >
        <div
          className="px-4 py-3"
          style={{ backgroundColor: teamInfo.textColor }}
        >
          <h2 className="text-lg font-bold" style={{ color: teamPrimaryText }}>
            Team Accomplishments
          </h2>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCell
              label="AP Top 25"
              value={apTop25Finishes}
              subValue="Finishes"
            />
            <StatCell
              label="Conf Titles"
              value={conferenceTitles}
            />
            <StatCell
              label="Bowl Wins"
              value={bowlWins.length}
            />
            <StatCell
              label="CFP Apps"
              value={cfpAppearances}
            />
            <StatCell
              label="Natl Titles"
              value={nationalTitles}
            />
            <StatCell
              label="All-Americans"
              value={allAmericansCount}
              subValue="1st Team"
            />
          </div>
        </div>
      </div>

      {/* User History with Team */}
      <div
        className="rounded-lg shadow-lg overflow-hidden"
        style={{
          backgroundColor: teamInfo.backgroundColor,
          border: `3px solid ${teamInfo.textColor}`
        }}
      >
        <div
          className="px-4 py-3"
          style={{ backgroundColor: teamInfo.textColor }}
        >
          <h2 className="text-lg font-bold" style={{ color: teamPrimaryText }}>
            Your History
          </h2>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Games As */}
            <div
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: `${teamBgText}10` }}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                Games As
              </div>
              <div className="text-3xl font-bold" style={{ color: gamesAsTeam.length > 0 ? teamBgText : `${teamBgText}50` }}>
                {gamesAsTeam.length || '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                {gamesAsWins}-{gamesAsLosses} record
              </div>
            </div>

            {/* Win % As */}
            <div
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: `${teamBgText}10` }}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                Win % As
              </div>
              <div
                className="text-3xl font-bold"
                style={{
                  color: winPctAs
                    ? parseFloat(winPctAs) >= 50 ? '#16a34a' : '#dc2626'
                    : `${teamBgText}50`
                }}
              >
                {winPctAs ? `${winPctAs}%` : '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                {gamesAsWins}-{gamesAsLosses} record
              </div>
            </div>

            {/* User vs Team */}
            <button
              onClick={() => gamesAgainst.length > 0 && setShowGamesModal(true)}
              className={`p-4 rounded-lg text-center transition-all ${gamesAgainst.length > 0 ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}
              style={{ backgroundColor: `${teamBgText}10` }}
              disabled={gamesAgainst.length === 0}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                User vs {teamAbbr}
              </div>
              <div className="text-3xl font-bold" style={{ color: gamesAgainst.length > 0 ? teamBgText : `${teamBgText}50` }}>
                {gamesAgainst.length || '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                {allTimeWins}-{allTimeLosses} record
              </div>
            </button>

            {/* Win % Vs */}
            <div
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: `${teamBgText}10` }}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                Win % Vs
              </div>
              <div
                className="text-3xl font-bold"
                style={{
                  color: winPctVs
                    ? parseFloat(winPctVs) >= 50 ? '#16a34a' : '#dc2626'
                    : `${teamBgText}50`
                }}
              >
                {winPctVs ? `${winPctVs}%` : '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                {allTimeWins}-{allTimeLosses} record
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Games Against Modal */}
      {showGamesModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowGamesModal(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
            style={{
              backgroundColor: teamInfo.backgroundColor,
              border: `3px solid ${teamInfo.textColor}`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: teamInfo.textColor }}
            >
              <div className="flex items-center gap-3">
                {teamLogo && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#FFFFFF', padding: '2px' }}
                  >
                    <img
                      src={teamLogo}
                      alt={`${teamAbbr} logo`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <h2 className="text-lg font-bold" style={{ color: teamPrimaryText }}>
                  User vs {teamAbbr}
                </h2>
              </div>
              <button
                onClick={() => setShowGamesModal(false)}
                className="p-1 rounded hover:bg-black/10 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke={teamPrimaryText} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Record Summary */}
              <div
                className="text-center p-4 rounded-lg mb-4"
                style={{ backgroundColor: `${teamBgText}15` }}
              >
                <div className="text-3xl font-bold" style={{ color: teamBgText }}>
                  {allTimeWins}-{allTimeLosses}
                </div>
                <div className="text-sm" style={{ color: teamBgText, opacity: 0.7 }}>
                  All-Time Record ({winPctVs}%)
                </div>
              </div>

              {/* Games List */}
              <div className="space-y-2">
                {gamesAgainst
                  .sort((a, b) => {
                    // Sort by year desc, then week desc
                    if (b.year !== a.year) return b.year - a.year
                    return (b.week || 0) - (a.week || 0)
                  })
                  .map((game, idx) => {
                    const isWin = game.result === 'W'

                    return (
                      <Link
                        key={game.id || idx}
                        to={`/dynasty/${id}/game/${game.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:scale-[1.01] transition-transform"
                        style={{
                          backgroundColor: isWin ? '#16a34a15' : '#dc262615',
                          border: `2px solid ${isWin ? '#16a34a40' : '#dc262640'}`
                        }}
                        onClick={() => setShowGamesModal(false)}
                      >
                        <div className="flex items-center gap-3">
                          {/* W/L Badge */}
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                            style={{
                              backgroundColor: isWin ? '#16a34a' : '#dc2626',
                              color: '#FFFFFF'
                            }}
                          >
                            {game.result}
                          </div>
                          <div>
                            <div className="font-semibold" style={{ color: teamBgText }}>
                              {game.year} {game.week ? `Week ${game.week}` : game.bowlName || ''}
                            </div>
                            <div className="text-sm" style={{ color: teamBgText, opacity: 0.7 }}>
                              {game.location === 'home' ? 'vs' : game.location === 'away' ? '@' : 'vs'} {teamAbbr}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg" style={{ color: teamBgText }}>
                            {game.teamScore}-{game.opponentScore}
                          </div>
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
