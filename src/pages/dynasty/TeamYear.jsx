import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useDynasty, getLockedCoachingStaff } from '../../context/DynastyContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
// Team colors are derived from the viewed team, not the user's team
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamConference } from '../../data/conferenceTeams'
import { getConferenceLogo } from '../../data/conferenceLogos'
import { getTeamLogo } from '../../data/teams'
import { bowlLogos } from '../../data/bowlLogos'
import { getCFPGameId, getSlotIdFromBowlName, getCFPSlotDisplayName, getFirstRoundSlotId } from '../../data/cfpConstants'
// GameDetailModal removed - now using game pages
import GameEntryModal from '../../components/GameEntryModal'
import RosterEditModal from '../../components/RosterEditModal'

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
    'UF': 'Florida Gators', 'UM': 'Miami Hurricanes',
    // FCS teams
    'FCSE': 'FCS East Judicials', 'FCSM': 'FCS Midwest Rebels',
    'FCSN': 'FCS Northwest Stallions', 'FCSW': 'FCS West Titans'
  }
  return mascotMap[abbr] || null
}

// Award display names
const AWARD_DISPLAY = {
  heisman: 'Heisman Trophy',
  maxwell: 'Maxwell Award',
  walterCamp: 'Walter Camp Award',
  bearBryantCoachOfTheYear: 'Bear Bryant Coach of the Year',
  daveyObrien: 'Davey O\'Brien Award',
  chuckBednarik: 'Chuck Bednarik Award',
  broncoNagurski: 'Bronco Nagurski Trophy',
  jimThorpe: 'Jim Thorpe Award',
  doakWalker: 'Doak Walker Award',
  fredBiletnikoff: 'Fred Biletnikoff Award',
  lombardi: 'Lombardi Award',
  unitasGoldenArm: 'Unitas Golden Arm Award',
  edgeRusherOfTheYear: 'Edge Rusher of the Year',
  outland: 'Outland Trophy',
  johnMackey: 'John Mackey Award',
  broyles: 'Broyles Award',
  dickButkus: 'Dick Butkus Award',
  rimington: 'Rimington Trophy',
  louGroza: 'Lou Groza Award',
  rayGuy: 'Ray Guy Award',
  returnerOfTheYear: 'Returner of the Year'
}

// Award order for display (same as Awards page)
const AWARD_ORDER = [
  'heisman', 'maxwell', 'walterCamp', 'daveyObrien', 'doakWalker',
  'fredBiletnikoff', 'johnMackey', 'unitasGoldenArm',
  'chuckBednarik', 'broncoNagurski', 'jimThorpe', 'dickButkus', 'edgeRusherOfTheYear',
  'outland', 'lombardi', 'rimington',
  'louGroza', 'rayGuy', 'returnerOfTheYear',
  'bearBryantCoachOfTheYear', 'broyles'
]

export default function TeamYear() {
  const { id, teamAbbr, year } = useParams()
  const navigate = useNavigate()
  const { currentDynasty, updateDynasty, addGame, saveRoster, isViewOnly } = useDynasty()
  const pathPrefix = usePathPrefix()
  // Note: We use the viewed team's colors, not the user's team colors
  const selectedYear = parseInt(year)

  // Game state for editing
  const [selectedGame, setSelectedGame] = useState(null)
  const [showCoachingStaffTooltip, setShowCoachingStaffTooltip] = useState(false)

  // Game edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingGameData, setEditingGameData] = useState(null)

  // Roster sorting state
  const [rosterSort, setRosterSort] = useState('position') // 'position', 'overall', 'jerseyNumber', 'name'
  const [rosterSortDir, setRosterSortDir] = useState('asc') // 'asc', 'desc'
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [showRecordTooltip, setShowRecordTooltip] = useState(false)

  if (!currentDynasty) return null

  // Get all teams sorted alphabetically by mascot name
  const allTeams = Object.entries(teamAbbreviations)
    .map(([abbr, info]) => ({
      abbr,
      name: getMascotName(abbr) || info.name,
      sortName: (getMascotName(abbr) || info.name).toLowerCase()
    }))
    .sort((a, b) => a.sortName.localeCompare(b.sortName))

  // Get available years (most recent first)
  const availableYears = []
  for (let y = currentDynasty.currentYear; y >= currentDynasty.startYear; y--) {
    availableYears.push(y)
  }

  // Get team info
  const teamInfo = teamAbbreviations[teamAbbr]
  if (!teamInfo) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: '#f3f4f6',
            border: '3px solid #6b7280'
          }}
        >
          <h1 className="text-2xl font-bold" style={{ color: '#1f2937' }}>
            Team Not Found
          </h1>
          <Link
            to={`${pathPrefix}/teams`}
            className="inline-block mt-4 px-4 py-2 rounded-lg font-semibold"
            style={{
              backgroundColor: '#1f2937',
              color: '#ffffff'
            }}
          >
            Back to Teams
          </Link>
        </div>
      </div>
    )
  }

  // Use viewed team's colors for the page
  const viewedTeamColors = {
    primary: teamInfo.textColor || '#1f2937',
    secondary: teamInfo.backgroundColor || '#f3f4f6'
  }

  const conference = getTeamConference(teamAbbr)
  const conferenceLogo = conference ? getConferenceLogo(conference) : null
  const mascotName = getMascotName(teamAbbr)
  const teamLogo = mascotName ? getTeamLogo(mascotName) : null
  const teamBgText = getContrastTextColor(teamInfo.backgroundColor)
  const teamPrimaryText = getContrastTextColor(teamInfo.textColor)
  const secondaryBgText = getContrastTextColor(viewedTeamColors.secondary)

  // Check if this is the user's team
  const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
  const isUserTeam = teamAbbr === userTeamAbbr

  // Get locked coaching staff for this team/year (preserves coordinators even if fired later)
  const teamCoachingStaff = getLockedCoachingStaff(currentDynasty, selectedYear, teamAbbr)

  // Get games against this team for this specific year (user's games vs this opponent)
  const vsUserGames = (currentDynasty.games || [])
    .filter(g => g.opponent === teamAbbr && g.year === selectedYear)
    .sort((a, b) => a.week - b.week)

  // Get user's team record for this year (if viewing user's team page)
  // Sort by game phase order: regular season (1-14), CC (15), CFP R1 (16), CFP QF (17), CFP SF (18), CFP Champ (19), other bowls (20)
  const getGameSortOrder = (game) => {
    // Regular season games
    if (!game.isConferenceChampionship && !game.isBowlGame && !game.isPlayoff &&
        !game.isCFPFirstRound && !game.isCFPQuarterfinal && !game.isCFPSemifinal && !game.isCFPChampionship) {
      return game.week || 0
    }
    // Conference Championship
    if (game.isConferenceChampionship) return 15
    // CFP games in order
    if (game.isCFPFirstRound) return 16
    if (game.isCFPQuarterfinal) return 17
    if (game.isCFPSemifinal) return 18
    if (game.isCFPChampionship) return 19
    // Other bowl games (non-CFP)
    if (game.isBowlGame) return 20
    // Fallback for other playoff games
    if (game.isPlayoff) return 20 + (game.week || 0)
    return 99
  }
  // Get games for THIS TEAM from games array
  // Includes games where team was the userTeam OR the opponent
  const teamGamesFromArray = (() => {
    const games = currentDynasty.games || []
    const result = []

    games.forEach(g => {
      if (g.isCPUGame) return
      if (Number(g.year) !== Number(selectedYear)) return

      // Games played AS this team
      if (g.userTeam === teamAbbr) {
        result.push(g)
        return
      }

      // Legacy fallback: if no userTeam field and this is the current user's team
      if (!g.userTeam && isUserTeam) {
        result.push(g)
        return
      }

      // Games played AGAINST this team - flip perspective for display only
      if (g.opponent === teamAbbr) {
        // Flip the result
        const flippedResult = g.result === 'win' || g.result === 'W' ? 'loss' :
                              g.result === 'loss' || g.result === 'L' ? 'win' : g.result
        // Flip the location
        const flippedLocation = g.location === 'home' ? 'away' :
                                g.location === 'away' ? 'home' : g.location
        result.push({
          ...g,
          // Keep original ID so game page link works
          _displayOpponent: g.userTeam, // For display: show who they played against
          _displayResult: flippedResult,
          _displayLocation: flippedLocation,
          _displayTeamScore: g.opponentScore,
          _displayOpponentScore: g.teamScore,
          _isFlippedPerspective: true // Flag to identify flipped games
        })
      }
    })

    return result
  })()

  // Also check if there's a bowl game in bowlGamesByYear that should be included
  const yearBowlDataForTeam = currentDynasty.bowlGamesByYear?.[selectedYear] || {}
  const teamBowlFromLegacy = [...(yearBowlDataForTeam.week1 || []), ...(yearBowlDataForTeam.week2 || [])]
    .find(bowl =>
      (bowl.team1 === teamAbbr || bowl.team2 === teamAbbr) &&
      bowl.team1Score !== null && bowl.team2Score !== null &&
      // Don't add if already in games array
      !teamGamesFromArray.some(g => g.isBowlGame && g.bowlName === bowl.bowlName)
    ) || null

  // Convert legacy bowl game to schedule format if found
  const teamBowlGameConverted = teamBowlFromLegacy ? {
    id: teamBowlFromLegacy.id || `bowl-${selectedYear}-${(teamBowlFromLegacy.bowlName || 'bowl').toLowerCase().replace(/\s+/g, '-')}`,
    week: 'Bowl',
    year: selectedYear,
    opponent: teamBowlFromLegacy.team1 === teamAbbr ? teamBowlFromLegacy.team2 : teamBowlFromLegacy.team1,
    location: 'neutral',
    result: (teamBowlFromLegacy.team1 === teamAbbr && teamBowlFromLegacy.team1Score > teamBowlFromLegacy.team2Score) ||
            (teamBowlFromLegacy.team2 === teamAbbr && teamBowlFromLegacy.team2Score > teamBowlFromLegacy.team1Score) ? 'win' : 'loss',
    teamScore: teamBowlFromLegacy.team1 === teamAbbr ? teamBowlFromLegacy.team1Score : teamBowlFromLegacy.team2Score,
    opponentScore: teamBowlFromLegacy.team1 === teamAbbr ? teamBowlFromLegacy.team2Score : teamBowlFromLegacy.team1Score,
    isBowlGame: true,
    bowlName: teamBowlFromLegacy.bowlName
  } : null

  // Combine team's games with legacy bowl game if applicable
  const teamYearGames = [...teamGamesFromArray, ...(teamBowlGameConverted ? [teamBowlGameConverted] : [])]
    .sort((a, b) => getGameSortOrder(a) - getGameSortOrder(b))
  // Check for both 'win'/'loss' and 'W'/'L' formats
  // Use _displayResult for flipped perspective games (opponent team pages)
  const teamWins = teamYearGames.filter(g => {
    const result = g._isFlippedPerspective ? g._displayResult : g.result
    return result === 'win' || result === 'W'
  }).length
  const teamLosses = teamYearGames.filter(g => {
    const result = g._isFlippedPerspective ? g._displayResult : g.result
    return result === 'loss' || result === 'L'
  }).length

  // Get team record from conference standings (for teams without detailed game data)
  const getTeamRecordFromStandings = () => {
    const standingsByYear = currentDynasty.conferenceStandingsByYear || {}
    const yearStandings = standingsByYear[selectedYear] || {}

    // Search all conferences for this team
    for (const confTeams of Object.values(yearStandings)) {
      if (Array.isArray(confTeams)) {
        const teamData = confTeams.find(t => t && t.team === teamAbbr)
        if (teamData) {
          return {
            wins: teamData.wins || 0,
            losses: teamData.losses || 0,
            pointsFor: teamData.pointsFor || 0,
            pointsAgainst: teamData.pointsAgainst || 0
          }
        }
      }
    }
    return null
  }

  const standingsRecord = getTeamRecordFromStandings()

  // Get the last known opponent record from games where this team was the opponent
  // This gives us the most recent record entered by the user during game input
  const getLastKnownOpponentRecord = () => {
    const games = currentDynasty.games || []
    // Find games where this team was the opponent (not the user's team)
    const gamesAsOpponent = games
      .filter(g => !g.isCPUGame && Number(g.year) === Number(selectedYear) && g.opponent === teamAbbr && g.opponentRecord)
      .sort((a, b) => {
        // Sort by week/game order to get the most recent
        const getOrder = (g) => {
          if (g.isConferenceChampionship) return 15
          if (g.isBowlGame) return 16 + (g.bowlWeek || 0)
          if (g.isCFPFirstRound) return 20
          if (g.isCFPQuarterfinal) return 21
          if (g.isCFPSemifinal) return 22
          if (g.isCFPChampionship) return 23
          return g.week || 0
        }
        return getOrder(b) - getOrder(a) // Descending - most recent first
      })

    if (gamesAsOpponent.length === 0) return null

    const lastRecord = gamesAsOpponent[0].opponentRecord
    // Parse "5-2 (3-1)" format
    const recordMatch = lastRecord.match(/(\d+)-(\d+)\s*(?:\((\d+)-(\d+)\))?/)
    if (!recordMatch) return null

    return {
      wins: parseInt(recordMatch[1]),
      losses: parseInt(recordMatch[2]),
      confWins: recordMatch[3] ? parseInt(recordMatch[3]) : null,
      confLosses: recordMatch[4] ? parseInt(recordMatch[4]) : null,
      rawRecord: lastRecord,
      pointsFor: null,
      pointsAgainst: null
    }
  }

  const lastKnownRecord = getLastKnownOpponentRecord()

  // Aggregate team stats from games for this year where this team has boxScore.teamStats
  const getSeasonTeamStats = () => {
    const games = currentDynasty.games || []
    const stats = {
      gamesWithStats: 0,
      firstDowns: 0,
      totalOffense: 0,
      rushAttempts: 0,
      rushYards: 0,
      rushTds: 0,
      completions: 0,
      passAttempts: 0,
      passTds: 0,
      passYards: 0,
      thirdDownConv: 0,
      thirdDownAtt: 0,
      fourthDownConv: 0,
      fourthDownAtt: 0,
      twoPtConv: 0,
      twoPtAtt: 0,
      redZoneTd: 0,
      redZoneFg: 0,
      turnovers: 0,
      fumblesLost: 0,
      interceptions: 0,
      puntRetYards: 0,
      kickRetYards: 0,
      totalYards: 0,
      punts: 0,
      penalties: 0,
      possMinutes: 0,
      possSeconds: 0
    }

    games.forEach(game => {
      // Only count games from this year
      if (Number(game.year) !== selectedYear) return
      if (!game.boxScore?.teamStats) return

      // Check if this team's stats are in the home or away slot
      const homeAbbr = game.boxScore.teamStats.home?.teamAbbr?.toUpperCase()
      const awayAbbr = game.boxScore.teamStats.away?.teamAbbr?.toUpperCase()
      const targetAbbr = teamAbbr.toUpperCase()

      let teamStats = null
      if (homeAbbr === targetAbbr) {
        teamStats = game.boxScore.teamStats.home
      } else if (awayAbbr === targetAbbr) {
        teamStats = game.boxScore.teamStats.away
      }

      if (!teamStats) return

      stats.gamesWithStats++
      stats.firstDowns += teamStats.firstDowns || 0
      stats.totalOffense += teamStats.totalOffense || 0
      stats.rushAttempts += teamStats.rushAttempts || 0
      stats.rushYards += teamStats.rushYards || 0
      stats.rushTds += teamStats.rushTds || 0
      stats.completions += teamStats.completions || 0
      stats.passAttempts += teamStats.passAttempts || 0
      stats.passTds += teamStats.passTds || 0
      stats.passYards += teamStats.passYards || 0
      stats.thirdDownConv += teamStats['3rdDownConv'] || 0
      stats.thirdDownAtt += teamStats['3rdDownAtt'] || 0
      stats.fourthDownConv += teamStats['4thDownConv'] || 0
      stats.fourthDownAtt += teamStats['4thDownAtt'] || 0
      stats.twoPtConv += teamStats['2ptConv'] || 0
      stats.twoPtAtt += teamStats['2ptAtt'] || 0
      stats.redZoneTd += teamStats.redZoneTd || 0
      stats.redZoneFg += teamStats.redZoneFg || 0
      stats.turnovers += teamStats.turnovers || 0
      stats.fumblesLost += teamStats.fumblesLost || 0
      stats.interceptions += teamStats.interceptions || 0
      stats.puntRetYards += teamStats.puntRetYards || 0
      stats.kickRetYards += teamStats.kickRetYards || 0
      stats.totalYards += teamStats.totalYards || 0
      stats.punts += teamStats.punts || 0
      stats.penalties += teamStats.penalties || 0
      stats.possMinutes += teamStats.possMinutes || 0
      stats.possSeconds += teamStats.possSeconds || 0
    })

    return stats
  }

  const seasonStats = getSeasonTeamStats()

  // Determine which record to display
  // Priority: 1. Conference standings (end of year), 2. Last known opponent record, 3. Calculated from games
  const displayRecord = (() => {
    // Conference standings are the most authoritative (end of year data)
    if (standingsRecord) {
      return standingsRecord
    }
    // For opponent teams, use the last known record entered during game input
    if (lastKnownRecord) {
      return lastKnownRecord
    }
    // Fall back to calculating from games (for user's own team pages)
    if (teamYearGames.length > 0) {
      return { wins: teamWins, losses: teamLosses, pointsFor: null, pointsAgainst: null }
    }
    return null
  })()

  // Get team ratings for this year
  const teamRatings = currentDynasty.teamRatingsByTeamYear?.[teamAbbr]?.[selectedYear] || null

  // Get final poll rankings for this team in this year
  const getFinalPollRankings = () => {
    const pollsData = currentDynasty.finalPollsByYear?.[selectedYear]
    if (!pollsData) return null

    const mediaRank = pollsData.media?.find(p => p && p.team === teamAbbr)?.rank
    const coachesRank = pollsData.coaches?.find(p => p && p.team === teamAbbr)?.rank

    if (!mediaRank && !coachesRank) return null

    return {
      media: mediaRank || null,
      coaches: coachesRank || null
    }
  }

  const finalPollRanking = getFinalPollRankings()

  // Get all games array for unified lookups
  const allGamesArray = currentDynasty.games || []

  // Get conference championship data for this team in this year
  // UNIFIED: First check games[] array, then fallback to conferenceChampionshipsByYear
  const ccGamesFromGames = allGamesArray.filter(g =>
    g.isConferenceChampionship && Number(g.year) === selectedYear &&
    (g.team1 === teamAbbr || g.team2 === teamAbbr) &&
    g.team1Score !== null && g.team1Score !== undefined
  )

  // Fallback: Also check conferenceChampionshipsByYear for backward compatibility
  const yearChampionships = currentDynasty.conferenceChampionshipsByYear?.[selectedYear] || []
  const ccGamesFromLegacy = yearChampionships.filter(cc =>
    (cc.team1 === teamAbbr || cc.team2 === teamAbbr) &&
    cc.team1Score !== null && cc.team2Score !== null &&
    // Avoid duplicates - skip if already in games[]
    !ccGamesFromGames.some(g => g.conference === cc.conference)
  )

  // Use games[] version first, then legacy
  const teamCCGame = ccGamesFromGames[0] || ccGamesFromLegacy[0] || null
  const wonCC = teamCCGame?.winner === teamAbbr

  // Get bowl game for this team in this year
  // UNIFIED: First check games[] array, then fallback to bowlGamesByYear
  const bowlGamesFromGames = allGamesArray.filter(g =>
    g.isBowlGame && g.year === selectedYear &&
    (g.team1 === teamAbbr || g.team2 === teamAbbr) &&
    g.team1Score !== null && g.team1Score !== undefined
  )

  // Fallback: Also check bowlGamesByYear for backward compatibility
  const yearBowlData = currentDynasty.bowlGamesByYear?.[selectedYear] || {}
  const bowlGamesFromLegacy = [...(yearBowlData.week1 || []), ...(yearBowlData.week2 || [])]
    .filter(bowl =>
      (bowl.team1 === teamAbbr || bowl.team2 === teamAbbr) &&
      bowl.team1Score !== null && bowl.team2Score !== null &&
      // Avoid duplicates - skip if already in games[]
      !bowlGamesFromGames.some(g => g.bowlName === bowl.bowlName)
    )

  const bowlGames = [...bowlGamesFromGames, ...bowlGamesFromLegacy]
  const teamBowlGame = bowlGames[0] // Just need the first match for this team

  const wonBowl = teamBowlGame && (
    (teamBowlGame.team1 === teamAbbr && teamBowlGame.team1Score > teamBowlGame.team2Score) ||
    (teamBowlGame.team2 === teamAbbr && teamBowlGame.team2Score > teamBowlGame.team1Score)
  )

  // Get CFP results for this team in this year from cfpResultsByYear
  const cfpResults = currentDynasty.cfpResultsByYear?.[selectedYear] || {}
  // Add round information AND slot ID to each game as we combine them
  // Use actual game data (seeds/bowl names) to determine slot ID, not array index
  const allCFPGames = [
    ...(cfpResults.firstRound || []).map(g => ({
      ...g,
      round: 1,
      slotId: getFirstRoundSlotId(g.seed1, g.seed2) || 'cfpfr1'
    })),
    ...(cfpResults.quarterfinals || []).map(g => ({
      ...g,
      round: 2,
      slotId: getSlotIdFromBowlName(g.bowlName) || 'cfpqf1'
    })),
    ...(cfpResults.semifinals || []).map(g => ({
      ...g,
      round: 3,
      slotId: getSlotIdFromBowlName(g.bowlName) || 'cfpsf1'
    })),
    ...(cfpResults.championship ? [{ ...cfpResults.championship, round: 4, slotId: 'cfpnc' }] : [])
  ]

  // Find all CFP games involving this team
  const teamCFPGamesFromResults = allCFPGames.filter(game =>
    (game.team1 === teamAbbr || game.team2 === teamAbbr) &&
    game.team1Score !== null && game.team2Score !== null
  ).sort((a, b) => a.round - b.round)

  // Determine CFP result for this team
  const getCFPResult = () => {
    if (teamCFPGamesFromResults.length === 0) return null

    // Check championship first
    const champGame = (cfpResults.championship || []).find(g =>
      g.team1 === teamAbbr || g.team2 === teamAbbr
    )
    if (champGame) {
      const wonChamp = champGame.winner === teamAbbr
      return wonChamp ? 'champion' : 'lost-championship'
    }

    // Check semifinals
    const sfGame = (cfpResults.semifinals || []).find(g =>
      g.team1 === teamAbbr || g.team2 === teamAbbr
    )
    if (sfGame) {
      const wonSF = sfGame.winner === teamAbbr
      if (!wonSF) return 'lost-semifinal'
    }

    // Check quarterfinals
    const qfGame = (cfpResults.quarterfinals || []).find(g =>
      g.team1 === teamAbbr || g.team2 === teamAbbr
    )
    if (qfGame) {
      const wonQF = qfGame.winner === teamAbbr
      if (!wonQF) return 'lost-quarterfinal'
    }

    // Check first round
    const frGame = (cfpResults.firstRound || []).find(g =>
      g.team1 === teamAbbr || g.team2 === teamAbbr
    )
    if (frGame) {
      const wonFR = frGame.winner === teamAbbr
      if (!wonFR) return 'lost-first-round'
    }

    return null
  }

  const cfpResult = getCFPResult()

  // Legacy: Get CFP games from cfpGamesByYear (older format)
  const cfpGames = currentDynasty.cfpGamesByYear?.[selectedYear] || []
  const teamCFPGames = cfpGames.filter(game =>
    (game.team1 === teamAbbr || game.team2 === teamAbbr) && game.team1Score !== null && game.team2Score !== null
  ).sort((a, b) => (a.round || 0) - (b.round || 0))

  // Find players associated with this team for the selected year
  // PRIMARY: Use teamsByYear[year] - explicit, immutable record of roster membership
  // FALLBACK: Use old calculation logic for backwards compatibility
  const teamPlayers = (currentDynasty.players || []).filter(p => {
    // Exclude honor-only players (players only in system for awards, not on actual roster)
    if (p.isHonorOnly) return false

    // PRIMARY CHECK: If player has teamsByYear record for this year, use it (AUTHORITATIVE)
    // This check must come FIRST before isRecruit - teamsByYear is the source of truth
    // Check both numeric and string keys to handle any data format
    const yearKey = String(selectedYear)
    const numKey = Number(selectedYear)
    const teamForYear = p.teamsByYear?.[yearKey] ?? p.teamsByYear?.[numKey]

    if (teamForYear !== undefined) {
      // Player has explicit roster membership for this year - trust it completely
      return teamForYear === teamAbbr
    }

    // Exclude recruits who don't have explicit teamsByYear entry
    // (they haven't enrolled yet - show on recruiting page instead)
    if (p.isRecruit) return false

    // FALLBACK: Use old calculation logic for backwards compatibility with existing data
    // CRITICAL: If player has a recruitYear, they should NOT appear on rosters for that year or earlier
    if (p.recruitYear && selectedYear <= p.recruitYear) return false

    // Check if player belongs to this team (by team field or legacy logic)
    const playerTeam = p.team
    const belongsToThisTeam = playerTeam === teamAbbr ||
      (!playerTeam && isUserTeam && getAbbreviationFromDisplayName(currentDynasty.teamName) === teamAbbr)

    if (belongsToThisTeam) {
      const playerStartYear = p.recruitYear ? (p.recruitYear + 1) : (p.yearStarted || currentDynasty.startYear)
      const playerEndYear = p.leftTeam ? (p.leftYear || currentDynasty.currentYear) : (p.yearDeparted || currentDynasty.currentYear)
      if (p.leftTeam && selectedYear > p.leftYear) return false
      return selectedYear >= playerStartYear && selectedYear <= playerEndYear
    }

    // For other teams, also show players who transferred from this team
    return p.previousTeam === teamAbbr || p.previousTeam === mascotName
  })

  // Calculate vs user record
  const vsUserWins = vsUserGames.filter(g => g.result === 'W').length
  const vsUserLosses = vsUserGames.filter(g => g.result === 'L').length

  // Sort roster based on current sort settings
  const posOrder = [
    'QB', 'HB', 'FB', 'WR', 'TE',
    'LT', 'LG', 'C', 'RG', 'RT', 'OT', 'OG',
    'LE', 'RE', 'LEDG', 'REDG', 'EDGE', 'DT',
    'LOLB', 'MLB', 'ROLB', 'SAM', 'MIKE', 'WILL', 'OLB', 'LB',
    'CB', 'FS', 'SS', 'S', 'K', 'P'
  ]

  // Class order for sorting (RS Sr is highest/most senior)
  const classOrder = {
    'RS Sr': 0, 'Sr': 1, 'RS Jr': 2, 'Jr': 3,
    'RS So': 4, 'So': 5, 'RS Fr': 6, 'Fr': 7
  }

  // Dev trait order for sorting (Elite is best)
  const devTraitOrder = {
    'Elite': 0, 'Star': 1, 'Impact': 2, 'Normal': 3
  }

  const handleRosterSort = (sortKey) => {
    if (rosterSort === sortKey) {
      // Toggle direction if same key
      setRosterSortDir(rosterSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      // New sort key - set appropriate default direction
      setRosterSort(sortKey)
      // Default to desc for overall and devTrait (best first), asc for class (seniors first)
      setRosterSortDir((sortKey === 'overall' || sortKey === 'devTrait') ? 'desc' : 'asc')
    }
  }

  const handleRosterSave = async (players) => {
    await saveRoster(currentDynasty.id, players, { teamAbbr, year: selectedYear })
    setShowRosterModal(false)
  }

  const sortedTeamPlayers = [...teamPlayers].sort((a, b) => {
    let result = 0
    switch (rosterSort) {
      case 'overall':
        result = (b.overall || 0) - (a.overall || 0)
        break
      case 'jerseyNumber':
        const numA = parseInt(a.jerseyNumber) || 999
        const numB = parseInt(b.jerseyNumber) || 999
        result = numA - numB
        break
      case 'name':
        result = (a.name || '').localeCompare(b.name || '')
        break
      case 'class':
        const classA = classOrder[a.year] ?? 99
        const classB = classOrder[b.year] ?? 99
        result = classA - classB
        break
      case 'devTrait':
        const devA = devTraitOrder[a.devTrait] ?? 99
        const devB = devTraitOrder[b.devTrait] ?? 99
        result = devA - devB
        break
      case 'position':
      default:
        const aPos = posOrder.indexOf(a.position)
        const bPos = posOrder.indexOf(b.position)
        if (aPos !== bPos) {
          result = aPos - bPos
        } else {
          result = (b.overall || 0) - (a.overall || 0)
        }
        break
    }
    return rosterSortDir === 'desc' ? -result : result
  })

  // Handle edit game click - opens GameEntryModal
  const handleEditGame = (game) => {
    const isCPUGame = !!game.viewingTeam // If has viewingTeam, it's a CPU vs CPU game

    if (isCPUGame) {
      // CPU vs CPU game - pass both teams and existing data
      setEditingGameData({
        team1: game.viewingTeamAbbr,
        team2: game.opponent,
        bowlName: game.bowlName || game.gameTitle,
        gameType: game.isBowlGame ? 'bowl' : game.isConferenceChampionship ? 'cc' : 'cfp',
        isUserGame: false,
        existingTeam1Score: game.teamScore,
        existingTeam2Score: game.opponentScore,
        existingGameNote: game.gameNote || '',
        existingLinks: game.links || '',
        gameRef: game.gameRef // Reference to the full game object in games[] for updating
      })
    } else {
      // User's game - pass the full game for editing
      setEditingGameData({
        opponent: game.opponent,
        bowlName: game.bowlName || game.gameTitle,
        existingGame: game,
        isUserGame: true
      })
    }

    setShowEditModal(true)
  }

  // Handle game save from GameEntryModal
  const handleGameSave = async (gameData) => {
    try {
      if (gameData.isCPUGame) {
        // CPU vs CPU game - save to unified games[] array
        const gameType = editingGameData.gameType

        if (gameType === 'bowl') {
          // UNIFIED: Save to games[] array
          const existingGames = currentDynasty.games || []
          const gameRef = editingGameData.gameRef

          // Find the game in games[] by ID or by bowlName + year
          const gameIndex = existingGames.findIndex(g =>
            g.id === gameRef?.id ||
            (g.isBowlGame && g.bowlName === editingGameData.bowlName && g.year === selectedYear)
          )

          if (gameIndex >= 0) {
            const originalGame = existingGames[gameIndex]

            // CRITICAL: Match incoming teams to original team order
            // The editor might show teams in a different order than stored
            const incomingTeam1 = gameData.team1
            const incomingTeam2 = gameData.team2
            const incomingTeam1Score = parseInt(gameData.team1Score)
            const incomingTeam2Score = parseInt(gameData.team2Score)

            // Determine if the incoming team1 matches the original team1 or team2
            const team1MatchesOriginal = incomingTeam1 === originalGame.team1
            const team2MatchesOriginal = incomingTeam2 === originalGame.team1

            // Map scores to original team order
            let originalTeam1Score, originalTeam2Score
            if (team1MatchesOriginal) {
              // Incoming order matches original order
              originalTeam1Score = incomingTeam1Score
              originalTeam2Score = incomingTeam2Score
            } else if (team2MatchesOriginal) {
              // Incoming order is reversed from original
              originalTeam1Score = incomingTeam2Score
              originalTeam2Score = incomingTeam1Score
            } else {
              // Fallback - use incoming order (shouldn't happen)
              originalTeam1Score = incomingTeam1Score
              originalTeam2Score = incomingTeam2Score
            }

            const winner = originalTeam1Score > originalTeam2Score
              ? originalGame.team1 : originalGame.team2
            const winnerIsTeam1 = winner === originalGame.team1

            const updatedGame = {
              ...originalGame,
              team1Score: originalTeam1Score,
              team2Score: originalTeam2Score,
              winner: winner,
              viewingTeamAbbr: winner,
              opponent: winnerIsTeam1 ? originalGame.team2 : originalGame.team1,
              teamScore: winnerIsTeam1 ? originalTeam1Score : originalTeam2Score,
              opponentScore: winnerIsTeam1 ? originalTeam2Score : originalTeam1Score,
              result: 'win',
              gameNote: gameData.gameNote || '',
              links: gameData.links || '',
              updatedAt: new Date().toISOString()
            }

            const updatedGames = [...existingGames]
            updatedGames[gameIndex] = updatedGame
            await updateDynasty(currentDynasty.id, { games: updatedGames })
          }
        } else if (gameType === 'cc') {
          // UNIFIED: Save to games[] array (like bowl games)
          const existingGames = currentDynasty.games || []
          const gameRef = editingGameData.gameRef

          // Find the game in games[] by ID or by conference + year
          const gameIndex = existingGames.findIndex(g =>
            g.id === gameRef?.id ||
            (g.isConferenceChampionship && g.conference === editingGameData.bowlName && Number(g.year) === selectedYear)
          )

          if (gameIndex >= 0) {
            const originalGame = existingGames[gameIndex]

            // CRITICAL: Match incoming teams to original team order
            const incomingTeam1 = gameData.team1
            const incomingTeam2 = gameData.team2
            const incomingTeam1Score = parseInt(gameData.team1Score)
            const incomingTeam2Score = parseInt(gameData.team2Score)

            // Determine if the incoming team1 matches the original team1 or team2
            const team1MatchesOriginal = incomingTeam1 === originalGame.team1
            const team2MatchesOriginal = incomingTeam2 === originalGame.team1

            // Map scores to original team order
            let originalTeam1Score, originalTeam2Score
            if (team1MatchesOriginal) {
              originalTeam1Score = incomingTeam1Score
              originalTeam2Score = incomingTeam2Score
            } else if (team2MatchesOriginal) {
              originalTeam1Score = incomingTeam2Score
              originalTeam2Score = incomingTeam1Score
            } else {
              originalTeam1Score = incomingTeam1Score
              originalTeam2Score = incomingTeam2Score
            }

            const winner = originalTeam1Score > originalTeam2Score
              ? originalGame.team1 : originalGame.team2
            const winnerIsTeam1 = winner === originalGame.team1

            const updatedGame = {
              ...originalGame,
              team1Score: originalTeam1Score,
              team2Score: originalTeam2Score,
              winner: winner,
              viewingTeamAbbr: winner,
              opponent: winnerIsTeam1 ? originalGame.team2 : originalGame.team1,
              teamScore: winnerIsTeam1 ? originalTeam1Score : originalTeam2Score,
              opponentScore: winnerIsTeam1 ? originalTeam2Score : originalTeam1Score,
              result: 'win',
              gameNote: gameData.gameNote || '',
              links: gameData.links || '',
              updatedAt: new Date().toISOString()
            }

            const updatedGames = [...existingGames]
            updatedGames[gameIndex] = updatedGame
            await updateDynasty(currentDynasty.id, { games: updatedGames })
          } else {
            // Fallback: Save to conferenceChampionshipsByYear for legacy data
            const existingByYear = currentDynasty.conferenceChampionshipsByYear || {}
            const existingYear = existingByYear[selectedYear] || []

            const ccIndex = existingYear.findIndex(g =>
              (g.team1 === gameData.team1 && g.team2 === gameData.team2) ||
              (g.team1 === gameData.team2 && g.team2 === gameData.team1)
            )

            const newGame = {
              ...existingYear[ccIndex],
              team1: gameData.team1,
              team2: gameData.team2,
              team1Score: parseInt(gameData.team1Score),
              team2Score: parseInt(gameData.team2Score),
              winner: gameData.winner,
              gameNote: gameData.gameNote || '',
              links: gameData.links || ''
            }

            const newYear = [...existingYear]
            if (ccIndex >= 0) {
              newYear[ccIndex] = newGame
            } else {
              newYear.push(newGame)
            }

            await updateDynasty(currentDynasty.id, {
              conferenceChampionshipsByYear: {
                ...existingByYear,
                [selectedYear]: newYear
              }
            })
          }
        }
        // CFP games would be handled similarly if needed
      } else {
        // User's game - use addGame
        await addGame(currentDynasty.id, {
          ...gameData,
          year: selectedYear
        })
      }

      setShowEditModal(false)
      setEditingGameData(null)
    } catch (error) {
      console.error('Error saving game:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation Row */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
        {/* Left side: History and Stats buttons */}
        <div className="flex items-center gap-2">
          {/* History Link */}
          <Link
            to={`${pathPrefix}/team/${teamAbbr}`}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm sm:text-base"
            style={{
              backgroundColor: teamInfo.backgroundColor,
              color: teamBgText,
              border: `2px solid ${teamBgText}40`
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </Link>

          {/* Stats Button - only show if we have team stats from games for this year */}
          {seasonStats.gamesWithStats > 0 && (
            <Link
              to={`${pathPrefix}/team-stats/${teamAbbr}/${selectedYear}`}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm sm:text-base"
              style={{
                backgroundColor: teamInfo.backgroundColor,
                color: teamBgText,
                border: `2px solid ${teamBgText}40`
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Stats
            </Link>
          )}
        </div>

        {/* Right side: Team and Year dropdowns */}
        <div className="flex items-center gap-2 sm:ml-auto">
          {/* Team Dropdown */}
          <select
            value={teamAbbr}
            onChange={(e) => navigate(`${pathPrefix}/team/${e.target.value}/${selectedYear}`)}
            className="flex-1 sm:flex-none px-2 sm:px-3 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2 text-sm sm:text-base"
            style={{
              backgroundColor: teamInfo.backgroundColor,
              color: teamBgText,
              border: `2px solid ${teamBgText}40`
            }}
          >
            {allTeams.map((team) => (
              <option key={team.abbr} value={team.abbr}>
                {team.name}
              </option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => navigate(`${pathPrefix}/team/${teamAbbr}/${e.target.value}`)}
            className="px-2 sm:px-3 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2 text-sm sm:text-base"
            style={{
              backgroundColor: teamInfo.backgroundColor,
              color: teamBgText,
              border: `2px solid ${teamBgText}40`
            }}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Team Header */}
      <div
        className="rounded-lg shadow-lg p-4 sm:p-6"
        style={{
          backgroundColor: teamInfo.backgroundColor,
          border: `3px solid ${teamInfo.textColor}`
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Mobile: Logo + Ratings + Record Row */}
          <div className="flex items-center justify-between sm:hidden">
            {teamLogo && (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: `3px solid ${teamInfo.textColor}`,
                  padding: '3px'
                }}
              >
                <img
                  src={teamLogo}
                  alt={`${teamInfo.name} logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              {/* Team Ratings (mobile) */}
              {teamRatings && (
                <div className="flex gap-1 bg-black/20 rounded-lg px-2 py-1">
                  <div className="text-center px-2">
                    <div className="text-lg font-bold" style={{ color: teamBgText }}>
                      {teamRatings.overall}
                    </div>
                    <div className="text-[10px] font-semibold uppercase" style={{ color: teamBgText, opacity: 0.7 }}>
                      OVR
                    </div>
                  </div>
                  <div className="text-center px-2 border-l border-white/20">
                    <div className="text-lg font-bold" style={{ color: teamBgText }}>
                      {teamRatings.offense}
                    </div>
                    <div className="text-[10px] font-semibold uppercase" style={{ color: teamBgText, opacity: 0.7 }}>
                      OFF
                    </div>
                  </div>
                  <div className="text-center px-2 border-l border-white/20">
                    <div className="text-lg font-bold" style={{ color: teamBgText }}>
                      {teamRatings.defense}
                    </div>
                    <div className="text-[10px] font-semibold uppercase" style={{ color: teamBgText, opacity: 0.7 }}>
                      DEF
                    </div>
                  </div>
                </div>
              )}
              {/* Season Record (mobile) */}
              {displayRecord && (
                <div
                  className="text-right relative"
                  onMouseEnter={() => setShowRecordTooltip(true)}
                  onMouseLeave={() => setShowRecordTooltip(false)}
                  onClick={() => setShowRecordTooltip(!showRecordTooltip)}
                >
                  <div
                    className="text-2xl font-bold cursor-pointer"
                    style={{ color: teamBgText }}
                  >
                    {displayRecord.wins}-{displayRecord.losses}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: teamBgText, opacity: 0.7 }}>
                    Record
                  </div>
                  {/* Points Tooltip */}
                  {showRecordTooltip && displayRecord.pointsFor !== null && (
                    <div
                      className="absolute right-0 top-full mt-2 p-3 rounded-lg shadow-lg z-50 min-w-36 text-left"
                      style={{
                        backgroundColor: teamInfo.textColor,
                        border: `2px solid ${teamBgText}40`
                      }}
                    >
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span style={{ color: teamPrimaryText, opacity: 0.7 }}>Points For:</span>
                          <span className="font-bold" style={{ color: teamPrimaryText }}>{displayRecord.pointsFor}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span style={{ color: teamPrimaryText, opacity: 0.7 }}>Points Against:</span>
                          <span className="font-bold" style={{ color: teamPrimaryText }}>{displayRecord.pointsAgainst}</span>
                        </div>
                        <div className="flex justify-between gap-4 pt-1 border-t" style={{ borderColor: `${teamPrimaryText}30` }}>
                          <span style={{ color: teamPrimaryText, opacity: 0.7 }}>Diff:</span>
                          <span
                            className="font-bold"
                            style={{
                              color: displayRecord.pointsFor - displayRecord.pointsAgainst > 0
                                ? '#16a34a'
                                : displayRecord.pointsFor - displayRecord.pointsAgainst < 0
                                  ? '#dc2626'
                                  : teamPrimaryText
                            }}
                          >
                            {displayRecord.pointsFor - displayRecord.pointsAgainst > 0 ? '+' : ''}
                            {displayRecord.pointsFor - displayRecord.pointsAgainst}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Desktop: Logo */}
          {teamLogo && (
            <div
              className="hidden sm:flex w-20 h-20 rounded-full items-center justify-center flex-shrink-0"
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
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
              {selectedYear} Season
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Final Poll Ranking Badge */}
              {finalPollRanking && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold"
                  style={{
                    backgroundColor: '#fbbf24',
                    color: '#78350f'
                  }}
                  title={`Final Ranking: ${finalPollRanking.media ? `AP #${finalPollRanking.media}` : ''}${finalPollRanking.media && finalPollRanking.coaches ? ' / ' : ''}${finalPollRanking.coaches ? `Coaches #${finalPollRanking.coaches}` : ''}`}
                >
                  #{finalPollRanking.media || finalPollRanking.coaches}
                </div>
              )}
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate" style={{ color: teamBgText }}>
                {mascotName || teamInfo.name}
              </h1>
              {/* Coaching Staff Info Icon - show for any team/year with coaching staff data */}
              {(teamCoachingStaff?.hcName || teamCoachingStaff?.ocName || teamCoachingStaff?.dcName) && (
                <div className="relative">
                  <button
                    onClick={() => setShowCoachingStaffTooltip(!showCoachingStaffTooltip)}
                    onMouseEnter={() => setShowCoachingStaffTooltip(true)}
                    onMouseLeave={() => setShowCoachingStaffTooltip(false)}
                    className="w-5 h-5 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: `${teamBgText}20`,
                      color: teamBgText
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {/* Coaching Staff Tooltip */}
                  {showCoachingStaffTooltip && (
                    <div
                      className="fixed sm:absolute left-4 right-4 sm:left-0 sm:right-auto top-auto sm:top-full mt-2 p-3 rounded-lg shadow-lg z-50 sm:min-w-48 sm:max-w-64"
                      style={{
                        backgroundColor: teamInfo.textColor,
                        border: `2px solid ${teamBgText}40`
                      }}
                      onMouseEnter={() => setShowCoachingStaffTooltip(true)}
                      onMouseLeave={() => setShowCoachingStaffTooltip(false)}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: teamPrimaryText, opacity: 0.7 }}>
                        {selectedYear} Coaching Staff
                      </div>
                      <div className="space-y-1">
                        {/* Show HC */}
                        {teamCoachingStaff?.hcName && (
                          <div className="text-sm font-semibold truncate" style={{ color: teamPrimaryText }}>
                            HC: {teamCoachingStaff.hcName}
                          </div>
                        )}
                        {/* Show OC */}
                        {teamCoachingStaff?.ocName && (
                          <div className="text-sm font-semibold truncate" style={{ color: teamPrimaryText }}>
                            OC: {teamCoachingStaff.ocName}
                          </div>
                        )}
                        {/* Show DC */}
                        {teamCoachingStaff?.dcName && (
                          <div className="text-sm font-semibold truncate" style={{ color: teamPrimaryText }}>
                            DC: {teamCoachingStaff.dcName}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {conference && (
              <div className="flex items-center gap-2 mt-1">
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
            {/* Postseason Result Badge */}
            {cfpResult === 'champion' && (
              <div
                className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#78350f',
                  boxShadow: '0 2px 8px rgba(251, 191, 36, 0.4)'
                }}
              >
                <img
                  src="https://i.imgur.com/3goz1NK.png"
                  alt="National Champions Trophy"
                  className="w-5 h-5 object-contain"
                />
                National Champions
              </div>
            )}
            {cfpResult === 'lost-championship' && (
              <div
                className="inline-flex items-center gap-1.5 mt-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
                style={{ backgroundColor: '#c0c0c0', color: '#1f2937' }}
              >
                🥈 Championship Game
              </div>
            )}
            {cfpResult === 'lost-semifinal' && (
              <div
                className="inline-flex items-center gap-1.5 mt-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
                style={{ backgroundColor: '#d1d5db', color: '#374151' }}
              >
                Made CFP Semifinals
              </div>
            )}
            {cfpResult === 'lost-quarterfinal' && (
              <div
                className="inline-flex items-center gap-1.5 mt-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
                style={{ backgroundColor: '#e5e7eb', color: '#4b5563' }}
              >
                Made CFP Quarterfinals
              </div>
            )}
            {cfpResult === 'lost-first-round' && (
              <div
                className="inline-flex items-center gap-1.5 mt-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
                style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
              >
                Made CFP First Round
              </div>
            )}
            {/* Bowl Game Result (only if not in CFP) */}
            {!cfpResult && teamBowlGame && (
              <div
                className="inline-flex items-center gap-1.5 mt-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
                style={{
                  backgroundColor: wonBowl ? '#16a34a' : '#dc2626',
                  color: '#ffffff'
                }}
              >
                {bowlLogos[teamBowlGame.bowlName] && (
                  <img
                    src={bowlLogos[teamBowlGame.bowlName]}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                )}
                {wonBowl ? 'Won' : 'Lost'} {teamBowlGame.bowlName}
              </div>
            )}
            {/* Conference Championship Badge - only show for winners */}
            {teamCCGame && wonCC && (
              <div
                className="inline-flex items-center gap-1 sm:gap-2 mt-2 sm:ml-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
                style={{
                  backgroundColor: '#fbbf24',
                  color: '#78350f'
                }}
              >
                {getConferenceLogo(teamCCGame.conference) && (
                  <img
                    src={getConferenceLogo(teamCCGame.conference)}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                )}
                {teamCCGame.conference} Champions
              </div>
            )}
            {/* Bowl Game Badge - only show clickable version if in CFP (otherwise shown above) */}
            {cfpResult && teamBowlGame && (() => {
              const bowlGameId = teamBowlGame.id || `bowl-${selectedYear}-${(teamBowlGame.bowlName || 'bowl').toLowerCase().replace(/\s+/g, '-')}`
              return (
                <Link
                  to={`${pathPrefix}/game/${bowlGameId}`}
                  className="inline-flex items-center gap-1 sm:gap-1.5 mt-2 sm:ml-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                  style={{
                    backgroundColor: wonBowl ? '#16a34a' : '#dc2626',
                    color: '#ffffff'
                  }}
                >
                  {bowlLogos[teamBowlGame.bowlName] && (
                    <img
                      src={bowlLogos[teamBowlGame.bowlName]}
                      alt=""
                      className="w-3 h-3 sm:w-4 sm:h-4 object-contain"
                    />
                  )}
                  <span className="truncate max-w-[120px] sm:max-w-none">{teamBowlGame.bowlName || 'Bowl Game'}{wonBowl ? ' Champion' : ''}</span>
                </Link>
              )
            })()}
          </div>

          {/* Ratings and Record Section (desktop only - mobile shown above) */}
          <div className="hidden sm:flex items-center gap-6">
            {/* Team Ratings (desktop) */}
            {teamRatings && (
              <div className="flex bg-black/20 rounded-lg px-3 py-2">
                <div className="text-center px-3">
                  <div className="text-2xl md:text-3xl font-bold" style={{ color: teamBgText }}>
                    {teamRatings.overall}
                  </div>
                  <div className="text-xs font-semibold uppercase" style={{ color: teamBgText, opacity: 0.7 }}>
                    OVR
                  </div>
                </div>
                <div className="text-center px-3 border-l border-white/20">
                  <div className="text-2xl md:text-3xl font-bold" style={{ color: teamBgText }}>
                    {teamRatings.offense}
                  </div>
                  <div className="text-xs font-semibold uppercase" style={{ color: teamBgText, opacity: 0.7 }}>
                    OFF
                  </div>
                </div>
                <div className="text-center px-3 border-l border-white/20">
                  <div className="text-2xl md:text-3xl font-bold" style={{ color: teamBgText }}>
                    {teamRatings.defense}
                  </div>
                  <div className="text-xs font-semibold uppercase" style={{ color: teamBgText, opacity: 0.7 }}>
                    DEF
                  </div>
                </div>
              </div>
            )}
            {/* Season Record (desktop) */}
            {displayRecord && (
              <div
                className="text-right relative"
                onMouseEnter={() => setShowRecordTooltip(true)}
                onMouseLeave={() => setShowRecordTooltip(false)}
              >
                <div
                  className="text-3xl md:text-4xl font-bold cursor-pointer"
                  style={{ color: teamBgText }}
                >
                  {displayRecord.wins}-{displayRecord.losses}
                </div>
                <div className="text-sm font-semibold" style={{ color: teamBgText, opacity: 0.7 }}>
                  Record
                </div>
                {/* Points Tooltip */}
                {showRecordTooltip && displayRecord.pointsFor !== null && (
                  <div
                    className="absolute right-0 top-full mt-2 p-3 rounded-lg shadow-lg z-50 min-w-44 text-left"
                    style={{
                      backgroundColor: teamInfo.textColor,
                      border: `2px solid ${teamBgText}40`
                    }}
                  >
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between gap-6">
                        <span style={{ color: teamPrimaryText, opacity: 0.7 }}>Points For:</span>
                        <span className="font-bold" style={{ color: teamPrimaryText }}>{displayRecord.pointsFor}</span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span style={{ color: teamPrimaryText, opacity: 0.7 }}>Points Against:</span>
                        <span className="font-bold" style={{ color: teamPrimaryText }}>{displayRecord.pointsAgainst}</span>
                      </div>
                      <div className="flex justify-between gap-6 pt-1.5 border-t" style={{ borderColor: `${teamPrimaryText}30` }}>
                        <span style={{ color: teamPrimaryText, opacity: 0.7 }}>Diff:</span>
                        <span
                          className="font-bold"
                          style={{
                            color: displayRecord.pointsFor - displayRecord.pointsAgainst > 0
                              ? '#16a34a'
                              : displayRecord.pointsFor - displayRecord.pointsAgainst < 0
                                ? '#dc2626'
                                : teamPrimaryText
                          }}
                        >
                          {displayRecord.pointsFor - displayRecord.pointsAgainst > 0 ? '+' : ''}
                          {displayRecord.pointsFor - displayRecord.pointsAgainst}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Award Winners Section */}
      {(() => {
        const yearAwards = currentDynasty.awardsByYear?.[selectedYear] || {}
        const teamAwardWinners = Object.entries(yearAwards)
          .filter(([key, data]) => data.team === teamAbbr)
          .map(([key, data]) => ({
            awardKey: key,
            awardName: AWARD_DISPLAY[key] || key,
            ...data
          }))
          .sort((a, b) => {
            const aIndex = AWARD_ORDER.indexOf(a.awardKey)
            const bIndex = AWARD_ORDER.indexOf(b.awardKey)
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
          })

        if (teamAwardWinners.length === 0) return null

        return (
          <div
            className="rounded-lg shadow-lg overflow-hidden"
            style={{
              backgroundColor: teamInfo.backgroundColor,
              border: `3px solid ${teamInfo.textColor}`
            }}
          >
            <div
              className="px-3 sm:px-4 py-2 sm:py-3"
              style={{ backgroundColor: teamInfo.textColor }}
            >
              <h2 className="text-sm sm:text-lg font-bold" style={{ color: teamPrimaryText }}>
                {selectedYear} Award Winners
              </h2>
            </div>
            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamAwardWinners.map((award) => {
                // Find matching player - check pid first (if stored), then match by name AND team
                let matchingPlayer = null
                if (award.pid) {
                  // Direct pid lookup (most reliable)
                  matchingPlayer = currentDynasty.players?.find(p => p.pid === award.pid)
                }
                if (!matchingPlayer) {
                  // Match by name and team (including honor-only players)
                  matchingPlayer = currentDynasty.players?.find(p => {
                    const nameMatch = p.name?.toLowerCase().trim() === award.player?.toLowerCase().trim()
                    if (!nameMatch) return false
                    // Check if player's team matches (could be in teamsPlayed array or current team abbreviation)
                    const playerTeams = p.teamsPlayed || []
                    const teamMatch = playerTeams.includes(teamAbbr) ||
                                     p.team === teamAbbr ||
                                     p.team === award.team
                    return teamMatch
                  })
                }
                if (!matchingPlayer) {
                  // Fallback: just match by name (for legacy data)
                  matchingPlayer = currentDynasty.players?.find(p =>
                    p.name?.toLowerCase().trim() === award.player?.toLowerCase().trim()
                  )
                }
                const isCoachAward = award.awardKey === 'bearBryantCoachOfTheYear' || award.awardKey === 'broyles'

                return (
                  <div
                    key={award.awardKey}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${teamInfo.textColor}15` }}
                  >
                    <div className="text-xs font-bold mb-1" style={{ color: teamBgText, opacity: 0.7 }}>
                      {award.awardName}
                    </div>
                    {matchingPlayer && !isCoachAward ? (
                      <Link
                        to={`${pathPrefix}/player/${matchingPlayer.pid}`}
                        className="font-bold text-base hover:underline"
                        style={{ color: teamInfo.textColor }}
                      >
                        {award.player}
                      </Link>
                    ) : (
                      <div className="font-bold text-base" style={{ color: teamInfo.textColor }}>
                        {award.player}
                      </div>
                    )}
                    {!isCoachAward && award.position && (
                      <div className="text-xs" style={{ color: teamBgText, opacity: 0.8 }}>
                        {award.position} • {award.class}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Roster Section - User's Team */}
      {isUserTeam && sortedTeamPlayers.length > 0 && (
        <div
          className="rounded-xl shadow-lg overflow-hidden"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            border: `2px solid ${teamInfo.textColor}`
          }}
        >
          <div
            className="px-3 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            style={{ backgroundColor: teamInfo.textColor }}
          >
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <h2 className="text-sm sm:text-lg font-bold" style={{ color: teamPrimaryText }}>
                {selectedYear} Roster
              </h2>
              <span
                className="text-xs sm:text-sm font-semibold px-2 py-0.5 sm:py-1 rounded"
                style={{
                  backgroundColor: teamInfo.backgroundColor,
                  color: teamBgText
                }}
              >
                {sortedTeamPlayers.length} Players
              </span>
              {!isViewOnly && (
                <button
                  onClick={() => setShowRosterModal(true)}
                  className="p-1.5 sm:p-2 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: teamPrimaryText }}
                  title="Edit Roster"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
            {/* Sort Controls */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs font-medium mr-1" style={{ color: teamPrimaryText, opacity: 0.7 }}>Sort:</span>
              {[
                { key: 'position', label: 'Pos' },
                { key: 'overall', label: 'OVR' },
                { key: 'class', label: 'Class' },
                { key: 'devTrait', label: 'Dev' },
                { key: 'jerseyNumber', label: '#' },
                { key: 'name', label: 'Name' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleRosterSort(key)}
                  className="px-2 py-0.5 rounded text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: rosterSort === key ? teamInfo.backgroundColor : `${teamInfo.backgroundColor}50`,
                    color: rosterSort === key ? teamBgText : teamPrimaryText
                  }}
                >
                  {label}
                  {rosterSort === key && (
                    <span className="ml-0.5">{rosterSortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 sm:p-4">
            {/* Mobile: Card Layout */}
            <div className="sm:hidden space-y-2">
              {sortedTeamPlayers.map((player) => (
                <Link
                  key={player.pid}
                  to={`${pathPrefix}/player/${player.pid}`}
                  className="block p-3 rounded-lg shadow-sm active:shadow-none transition-shadow"
                  style={{
                    backgroundColor: `${teamInfo.textColor}08`,
                    borderLeft: `3px solid ${teamInfo.textColor}`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Player Image or Jersey Number */}
                      {player.pictureUrl ? (
                        <div
                          className="w-11 h-11 rounded-full flex-shrink-0 overflow-hidden"
                          style={{ border: `2px solid ${teamInfo.textColor}` }}
                        >
                          <img
                            src={player.pictureUrl}
                            alt={player.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{
                            backgroundColor: teamInfo.textColor,
                            color: teamPrimaryText
                          }}
                        >
                          {player.jerseyNumber || '-'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate" style={{ color: teamInfo.textColor }}>
                          {player.pictureUrl && <span className="mr-1">#{player.jerseyNumber}</span>}
                          {player.name}
                        </div>
                        <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: teamBgText, opacity: 0.8 }}>
                          <span>{player.position}</span>
                          <span>•</span>
                          <span>{player.year}</span>
                          {player.devTrait && player.devTrait !== 'Normal' && (
                            <>
                              <span>•</span>
                              <span>{player.devTrait}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className="text-xl font-bold flex-shrink-0 ml-2"
                      style={{ color: teamBgText }}
                    >
                      {player.overall}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${teamInfo.textColor}40` }}>
                    <th
                      className="text-center py-2 px-2 font-semibold cursor-pointer hover:opacity-80 w-14"
                      style={{ color: teamBgText }}
                      onClick={() => handleRosterSort('jerseyNumber')}
                    >
                      # {rosterSort === 'jerseyNumber' && (rosterSortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-left py-2 px-2 font-semibold cursor-pointer hover:opacity-80"
                      style={{ color: teamBgText }}
                      onClick={() => handleRosterSort('name')}
                    >
                      Player {rosterSort === 'name' && (rosterSortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-center py-2 px-2 font-semibold cursor-pointer hover:opacity-80 w-16"
                      style={{ color: teamBgText }}
                      onClick={() => handleRosterSort('position')}
                    >
                      Pos {rosterSort === 'position' && (rosterSortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-center py-2 px-2 font-semibold cursor-pointer hover:opacity-80 w-16"
                      style={{ color: teamBgText }}
                      onClick={() => handleRosterSort('class')}
                    >
                      Class {rosterSort === 'class' && (rosterSortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-center py-2 px-2 font-semibold cursor-pointer hover:opacity-80 w-16"
                      style={{ color: teamBgText }}
                      onClick={() => handleRosterSort('overall')}
                    >
                      OVR {rosterSort === 'overall' && (rosterSortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-center py-2 px-2 font-semibold cursor-pointer hover:opacity-80 hidden md:table-cell w-20"
                      style={{ color: teamBgText }}
                      onClick={() => handleRosterSort('devTrait')}
                    >
                      Dev {rosterSort === 'devTrait' && (rosterSortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left py-2 px-2 font-semibold hidden lg:table-cell" style={{ color: teamBgText }}>Archetype</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeamPlayers.map((player, idx) => (
                    <tr
                      key={player.pid}
                      className="cursor-pointer transition-all hover:brightness-95"
                      style={{
                        borderBottom: `1px solid ${teamInfo.textColor}15`,
                        backgroundColor: idx % 2 === 1 ? `${teamInfo.textColor}08` : 'transparent'
                      }}
                      onClick={() => navigate(`${pathPrefix}/player/${player.pid}`)}
                    >
                      <td className="py-2 px-2 text-center font-bold" style={{ color: teamBgText }}>
                        {player.jerseyNumber || '-'}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          {/* Player Image */}
                          {player.pictureUrl && (
                            <Link
                              to={`${pathPrefix}/player/${player.pid}`}
                              className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden block"
                              style={{ border: `2px solid ${teamInfo.textColor}` }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={player.pictureUrl}
                                alt={player.name}
                                className="w-full h-full object-cover"
                              />
                            </Link>
                          )}
                          <Link
                            to={`${pathPrefix}/player/${player.pid}`}
                            className="font-semibold hover:underline"
                            style={{ color: teamBgText }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {player.name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold"
                          style={{
                            backgroundColor: `${teamInfo.textColor}20`,
                            color: teamBgText
                          }}
                        >
                          {player.position}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center" style={{ color: teamBgText, opacity: 0.9 }}>
                        {player.year}
                      </td>
                      <td className="py-2 px-2 text-center font-bold" style={{ color: teamBgText }}>
                        {player.overall}
                      </td>
                      <td className="py-2 px-2 text-center hidden md:table-cell">
                        {player.devTrait ? (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              backgroundColor: player.devTrait === 'Elite' ? '#fbbf24' :
                                             player.devTrait === 'Star' ? '#8b5cf6' :
                                             player.devTrait === 'Impact' ? '#3b82f6' : '#9ca3af',
                              color: player.devTrait === 'Elite' ? '#78350f' : '#ffffff'
                            }}
                          >
                            {player.devTrait}
                          </span>
                        ) : (
                          <span style={{ color: teamBgText, opacity: 0.3 }}>-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 hidden lg:table-cell" style={{ color: teamBgText, opacity: 0.8 }}>
                        {player.archetype || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Roster Section for User's Team with No Players for this year */}
      {!isViewOnly && isUserTeam && sortedTeamPlayers.length === 0 && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            border: `3px solid ${teamInfo.textColor}`
          }}
        >
          <div
            className="px-3 sm:px-4 py-2 sm:py-3"
            style={{ backgroundColor: teamInfo.textColor }}
          >
            <h2 className="text-sm sm:text-lg font-bold" style={{ color: teamPrimaryText }}>
              {selectedYear} Roster
            </h2>
          </div>
          <div className="p-4 sm:p-6 text-center">
            <p className="text-sm mb-4" style={{ color: teamBgText, opacity: 0.7 }}>
              No roster data for {selectedYear}
            </p>
            <button
              onClick={() => setShowRosterModal(true)}
              className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: teamInfo.textColor,
                color: teamPrimaryText
              }}
            >
              Add Roster
            </button>
          </div>
        </div>
      )}

      {/* Schedule - shows games played by this team this year */}
      {teamYearGames.length > 0 && (
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
            <h2 className="text-lg font-bold" style={{ color: teamInfo.backgroundColor }}>
              {selectedYear} Schedule
            </h2>
          </div>

          <div className="space-y-2 p-2 sm:p-4">
            {teamYearGames.map((game, index) => {
              // Use display values for flipped games, otherwise use original values
              const displayOpponent = game._isFlippedPerspective ? game._displayOpponent : game.opponent
              const displayResult = game._isFlippedPerspective ? game._displayResult : game.result
              const displayLocation = game._isFlippedPerspective ? game._displayLocation : game.location
              const displayTeamScore = game._isFlippedPerspective ? game._displayTeamScore : game.teamScore
              const displayOpponentScore = game._isFlippedPerspective ? game._displayOpponentScore : game.opponentScore

              const oppMascot = getMascotName(displayOpponent)
              const oppLogo = oppMascot ? getTeamLogo(oppMascot) : null
              const oppColors = teamAbbreviations[displayOpponent] || { backgroundColor: '#6b7280', textColor: '#ffffff' }
              const isWin = displayResult === 'win' || displayResult === 'W'
              const isLoss = displayResult === 'loss' || displayResult === 'L'
              const hasResult = isWin || isLoss

              // Generate proper game ID for CFP games (don't trust stored id which may be "peach"/"fiesta")
              let properGameId = game.id
              if (game.isCFPSemifinal && game.bowlName) {
                const slotId = getSlotIdFromBowlName(game.bowlName)
                if (slotId) properGameId = getCFPGameId(slotId, selectedYear)
              } else if (game.isCFPQuarterfinal && game.bowlName) {
                const slotId = getSlotIdFromBowlName(game.bowlName)
                if (slotId) properGameId = getCFPGameId(slotId, selectedYear)
              } else if (game.isCFPFirstRound) {
                // For first round, use seeds to determine slot
                const cfpSeeds = currentDynasty.cfpSeedsByYear?.[selectedYear] || []
                const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
                const userSeed = cfpSeeds.find(s => s && s.team === userTeamAbbr)?.seed
                const oppSeed = userSeed ? 17 - userSeed : null
                const slotId = getFirstRoundSlotId(userSeed, oppSeed)
                if (slotId) properGameId = getCFPGameId(slotId, selectedYear)
              } else if (game.isCFPChampionship) {
                properGameId = getCFPGameId('cfpnc', selectedYear)
              }

              // Content for the game display
              const gameContent = (
                <>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16" style={{ color: oppColors.textColor, opacity: 0.9 }}>
                      {game.isCFPChampionship ? 'Natty' :
                       game.isCFPSemifinal ? 'CFP SF' :
                       game.isCFPQuarterfinal ? 'CFP QF' :
                       game.isCFPFirstRound ? 'CFP R1' :
                       game.isBowlGame ? 'Bowl' :
                       game.isPlayoff ? 'CFP' :
                       game.isConferenceChampionship ? 'CCG' :
                       `Wk ${game.week}`}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span
                        className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0"
                        style={{
                          backgroundColor: oppColors.textColor,
                          color: oppColors.backgroundColor
                        }}
                      >
                        {displayLocation === 'away' ? '@' : 'vs'}
                      </span>
                      {oppLogo && (
                        <Link
                          to={`${pathPrefix}/team/${displayOpponent}/${selectedYear}`}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${oppColors.textColor}`,
                            padding: '2px'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <img
                            src={oppLogo}
                            alt={`${oppMascot} logo`}
                            className="w-full h-full object-contain"
                          />
                        </Link>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                        {game.opponentRank && (
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: oppColors.textColor, opacity: 0.7 }}>
                            #{game.opponentRank}
                          </span>
                        )}
                        <Link
                          to={`${pathPrefix}/team/${displayOpponent}/${selectedYear}`}
                          className="font-semibold hover:underline text-sm sm:text-base truncate"
                          style={{ color: oppColors.textColor }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {oppMascot || displayOpponent}
                        </Link>
                      </div>
                    </div>
                  </div>
                  {hasResult ? (
                    <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
                      <div
                        className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded"
                        style={{
                          backgroundColor: isWin ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {isWin ? 'W' : 'L'}
                      </div>
                      <div className="text-right min-w-[85px] sm:min-w-[95px]">
                        <div className="font-bold text-sm sm:text-base" style={{ color: oppColors.textColor }}>
                          {displayTeamScore} - {displayOpponentScore}
                          {game.overtimes && game.overtimes.length > 0 && (
                            <span className="ml-1 text-xs opacity-80">
                              {game.overtimes.length > 1 ? `${game.overtimes.length}OT` : 'OT'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-medium self-end sm:self-auto" style={{ color: oppColors.textColor, opacity: 0.7 }}>
                      Scheduled
                    </div>
                  )}
                </>
              )

              // Return the wrapped content
              if (properGameId) {
                return (
                  <Link
                    key={index}
                    to={`${pathPrefix}/game/${properGameId}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 block ${hasResult ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                    style={{
                      backgroundColor: oppColors.backgroundColor,
                      borderColor: isWin ? '#86efac' : isLoss ? '#fca5a5' : oppColors.backgroundColor
                    }}
                  >
                    {gameContent}
                  </Link>
                )
              }

              return (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0"
                  style={{
                    backgroundColor: oppColors.backgroundColor,
                    borderColor: isWin ? '#86efac' : isLoss ? '#fca5a5' : oppColors.backgroundColor
                  }}
                >
                  {gameContent}
                </div>
              )
            })}

            {/* Conference Championship Game - inline in schedule */}
            {(() => {
              // Get the CC game from games array OR from conferenceChampionshipsByYear
              const ccGameFromGames = teamYearGames.find(g => g.isConferenceChampionship)

              // If CC game is already in teamYearGames, skip (it's rendered above)
              if (ccGameFromGames) return null

              // Check if user made the championship from conferenceChampionshipData
              const ccData = currentDynasty.conferenceChampionshipData
              const madeChampionship = ccData?.madeChampionship === true

              // If user didn't make championship or no CC game data, skip
              if (!madeChampionship && !teamCCGame) return null

              // Get opponent from ccData or teamCCGame
              const ccOpponentAbbr = ccData?.opponent || (teamCCGame ? (teamCCGame.team1 === teamAbbr ? teamCCGame.team2 : teamCCGame.team1) : null)
              if (!ccOpponentAbbr) return null

              // Handle both abbreviation and mascot name formats
              const ccOppMascotFromAbbr = getMascotName(ccOpponentAbbr)
              const ccOppMascot = ccOppMascotFromAbbr || (getTeamLogo(ccOpponentAbbr) ? ccOpponentAbbr : null)
              const ccOppLogo = ccOppMascot ? getTeamLogo(ccOppMascot) : null

              // Get opponent colors
              let ccOppColors = teamAbbreviations[ccOpponentAbbr]
              if (typeof ccOppColors === 'string') {
                ccOppColors = teamAbbreviations[ccOppColors]
              }
              ccOppColors = ccOppColors || { backgroundColor: '#6b7280', textColor: '#ffffff' }

              const ccOpponentDisplayName = ccOppMascot || ccOpponentAbbr

              // Determine if we have a result
              const hasResult = teamCCGame && teamCCGame.team1Score !== null && teamCCGame.team2Score !== null
              const isWin = hasResult && wonCC
              const isLoss = hasResult && !wonCC

              // Calculate scores from this team's perspective
              const thisTeamScore = teamCCGame ? (teamCCGame.team1 === teamAbbr ? teamCCGame.team1Score : teamCCGame.team2Score) : null
              const oppScore = teamCCGame ? (teamCCGame.team1 === teamAbbr ? teamCCGame.team2Score : teamCCGame.team1Score) : null

              // Use Link for CC games with results
              const ccGameId = teamCCGame?.id || `cc-${selectedYear}`
              const WrapperComponent = hasResult ? Link : 'div'
              const wrapperProps = hasResult ? {
                to: `${pathPrefix}/game/${ccGameId}`,
                className: 'flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block',
                style: {
                  backgroundColor: ccOppColors.backgroundColor,
                  borderColor: isWin ? '#86efac' : isLoss ? '#fca5a5' : ccOppColors.backgroundColor
                }
              } : {
                className: 'flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0',
                style: {
                  backgroundColor: ccOppColors.backgroundColor,
                  borderColor: ccOppColors.backgroundColor
                }
              }

              return (
                <WrapperComponent {...wrapperProps}>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16" style={{ color: ccOppColors.textColor, opacity: 0.9 }}>
                      CCG
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span
                        className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0"
                        style={{
                          backgroundColor: ccOppColors.textColor,
                          color: ccOppColors.backgroundColor
                        }}
                      >
                        vs
                      </span>
                      {ccOppLogo && (
                        <div
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${ccOppColors.textColor}`,
                            padding: '2px'
                          }}
                        >
                          <img
                            src={ccOppLogo}
                            alt={`${ccOpponentDisplayName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-sm sm:text-base truncate" style={{ color: ccOppColors.textColor }}>
                          {ccOpponentDisplayName}
                        </span>
                        {teamCCGame?.conference && (
                          <span className="text-xs opacity-70 truncate" style={{ color: ccOppColors.textColor }}>
                            {teamCCGame.conference} Championship
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasResult ? (
                    <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
                      <div
                        className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded"
                        style={{
                          backgroundColor: isWin ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {isWin ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm sm:text-base" style={{ color: ccOppColors.textColor }}>
                          {thisTeamScore} - {oppScore}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-medium self-end sm:self-auto" style={{ color: ccOppColors.textColor, opacity: 0.7 }}>
                      Scheduled
                    </div>
                  )}
                </WrapperComponent>
              )
            })()}

            {/* Scheduled Bowl Game - show if bowl is scheduled but not played */}
            {(() => {
              const bowlData = currentDynasty.bowlEligibilityData
              const hasBowlScheduled = bowlData?.eligible === true && bowlData?.bowlGame && bowlData?.opponent
              const bowlGamePlayed = teamYearGames.some(g => g.isBowlGame)

              // Only show if bowl is scheduled but not yet played, and viewing current year
              if (!hasBowlScheduled || bowlGamePlayed || selectedYear !== currentDynasty.currentYear) return null

              const bowlOpponentValue = bowlData.opponent
              // Handle both abbreviation and mascot name formats
              const oppMascotFromAbbr = getMascotName(bowlOpponentValue)
              const oppMascot = oppMascotFromAbbr || (getTeamLogo(bowlOpponentValue) ? bowlOpponentValue : null)
              const oppLogo = oppMascot ? getTeamLogo(oppMascot) : null

              // Get opponent colors - handle both abbreviation and mascot name
              let oppColors = teamAbbreviations[bowlOpponentValue]
              if (typeof oppColors === 'string') {
                // It was a mascot name that returned an abbreviation
                oppColors = teamAbbreviations[oppColors]
              }
              oppColors = oppColors || { backgroundColor: '#6b7280', textColor: '#ffffff' }

              const opponentDisplayName = oppMascot || bowlOpponentValue

              return (
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0"
                  style={{
                    backgroundColor: oppColors.backgroundColor,
                    borderColor: oppColors.backgroundColor
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16" style={{ color: oppColors.textColor, opacity: 0.9 }}>
                      Bowl
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span
                        className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0"
                        style={{
                          backgroundColor: oppColors.textColor,
                          color: oppColors.backgroundColor
                        }}
                      >
                        vs
                      </span>
                      {oppLogo && (
                        <div
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${oppColors.textColor}`,
                            padding: '2px'
                          }}
                        >
                          <img
                            src={oppLogo}
                            alt={`${opponentDisplayName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-sm sm:text-base truncate" style={{ color: oppColors.textColor }}>
                          {opponentDisplayName}
                        </span>
                        <span className="text-xs opacity-70 truncate" style={{ color: oppColors.textColor }}>
                          {bowlData.bowlGame}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm font-medium self-end sm:self-auto" style={{ color: oppColors.textColor, opacity: 0.7 }}>
                    Scheduled
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* CFP Games - only for user's team */}
      {isUserTeam && teamCFPGames.length > 0 && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: viewedTeamColors.secondary,
            border: `3px solid ${viewedTeamColors.primary}`
          }}
        >
          <div
            className="px-3 sm:px-4 py-2 sm:py-3"
            style={{ backgroundColor: viewedTeamColors.primary }}
          >
            <h2 className="text-sm sm:text-lg font-bold" style={{ color: getContrastTextColor(viewedTeamColors.primary) }}>
              College Football Playoff
            </h2>
          </div>

          <div className="divide-y" style={{ borderColor: `${viewedTeamColors.primary}30` }}>
            {teamCFPGames.map((game, index) => {
              const teamWon = (game.team1 === teamAbbr && game.team1Score > game.team2Score) ||
                             (game.team2 === teamAbbr && game.team2Score > game.team1Score)
              const roundNames = { 1: 'First Round', 2: 'Quarterfinal', 3: 'Semifinal', 4: 'National Championship' }
              const roundNamesShort = { 1: 'R1', 2: 'QF', 3: 'SF', 4: 'Natty' }

              return (
                <div key={index} className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <span
                      className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold"
                      style={{
                        backgroundColor: teamWon ? '#16a34a' : '#dc2626',
                        color: '#FFFFFF'
                      }}
                    >
                      {teamWon ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-lg sm:text-xl font-bold" style={{ color: secondaryBgText }}>
                      {game.team1 === teamAbbr
                        ? `${game.team1Score} - ${game.team2Score}`
                        : `${game.team2Score} - ${game.team1Score}`}
                    </span>
                    <span className="text-xs sm:text-sm" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      vs {game.team1 === teamAbbr ? game.team2 : game.team1}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 sm:py-1 rounded"
                      style={{ backgroundColor: `${viewedTeamColors.primary}20`, color: viewedTeamColors.primary }}
                    >
                      <span className="hidden sm:inline">{roundNames[game.round] || `Round ${game.round}`}</span>
                      <span className="sm:hidden">{roundNamesShort[game.round] || `R${game.round}`}</span>
                    </span>
                    {game.round === 4 && teamWon && (
                      <span className="text-xs sm:text-sm font-bold text-yellow-600">🏆 CHAMPS</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Players from Other Teams (Transfers) */}
      {!isUserTeam && teamPlayers.length > 0 && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: viewedTeamColors.secondary,
            border: `3px solid ${viewedTeamColors.primary}`
          }}
        >
          <div
            className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between"
            style={{ backgroundColor: viewedTeamColors.primary }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-lg font-bold" style={{ color: getContrastTextColor(viewedTeamColors.primary) }}>
                {selectedYear} {teamAbbr} Roster
              </h2>
              <span
                className="text-xs sm:text-sm font-semibold px-2 py-0.5 sm:py-1 rounded"
                style={{
                  backgroundColor: viewedTeamColors.secondary,
                  color: secondaryBgText
                }}
              >
                {teamPlayers.length} Players
              </span>
              {!isViewOnly && (
                <button
                  onClick={() => setShowRosterModal(true)}
                  className="p-1.5 sm:p-2 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: getContrastTextColor(viewedTeamColors.primary) }}
                  title="Edit Roster"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="p-2 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {teamPlayers.map((player) => (
                <Link
                  key={player.pid}
                  to={`${pathPrefix}/player/${player.pid}`}
                  className="flex items-center gap-2 sm:gap-3 p-2 rounded hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: `${viewedTeamColors.primary}10` }}
                >
                  {player.jerseyNumber && (
                    <span
                      className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded text-xs sm:text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: viewedTeamColors.primary, color: getContrastTextColor(viewedTeamColors.primary) }}
                    >
                      {player.jerseyNumber}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm truncate" style={{ color: secondaryBgText }}>
                      {player.name}
                    </div>
                    <div className="text-xs" style={{ color: secondaryBgText, opacity: 0.7 }}>
                      {player.position} • {player.overall} OVR • Transfer
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Roster Section for Non-User Teams with No Players */}
      {!isViewOnly && !isUserTeam && teamPlayers.length === 0 && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: viewedTeamColors.secondary,
            border: `3px solid ${viewedTeamColors.primary}`
          }}
        >
          <div
            className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between"
            style={{ backgroundColor: viewedTeamColors.primary }}
          >
            <h2 className="text-sm sm:text-lg font-bold" style={{ color: getContrastTextColor(viewedTeamColors.primary) }}>
              {selectedYear} {teamAbbr} Roster
            </h2>
          </div>
          <div className="p-4 sm:p-6 text-center">
            <p className="text-sm mb-4" style={{ color: secondaryBgText, opacity: 0.7 }}>
              No roster data for {teamAbbr} in {selectedYear}
            </p>
            <button
              onClick={() => setShowRosterModal(true)}
              className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: viewedTeamColors.primary,
                color: getContrastTextColor(viewedTeamColors.primary)
              }}
            >
              Add Roster
            </button>
          </div>
        </div>
      )}

      {/* Game Entry Modal (for editing games) */}
      {showEditModal && editingGameData && (
        <GameEntryModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingGameData(null)
          }}
          onSave={handleGameSave}
          weekNumber={selectedGame?.week || 'Bowl'}
          currentYear={selectedYear}
          teamColors={viewedTeamColors}
          opponent={editingGameData.isUserGame ? editingGameData.opponent : undefined}
          bowlName={editingGameData.bowlName}
          existingGame={editingGameData.isUserGame ? editingGameData.existingGame : null}
          team1={editingGameData.isUserGame ? undefined : editingGameData.team1}
          team2={editingGameData.isUserGame ? undefined : editingGameData.team2}
          existingTeam1Score={editingGameData.existingTeam1Score}
          existingTeam2Score={editingGameData.existingTeam2Score}
          existingGameNote={editingGameData.existingGameNote}
          existingLinks={editingGameData.existingLinks}
        />
      )}

      {/* Roster Edit Modal */}
      <RosterEditModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        onSave={handleRosterSave}
        currentYear={selectedYear}
        teamColors={viewedTeamColors}
        teamAbbr={teamAbbr}
        teamName={mascotName || teamAbbr}
      />
    </div>
  )
}
