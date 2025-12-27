import { useState, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getTeamLogo } from '../../data/teams'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamColors } from '../../data/teamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { useDynasty, getCurrentTeamRatings } from '../../context/DynastyContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
// useTeamColors not needed - using neutral colors for game recap
import { getBowlLogo } from '../../data/bowlLogos'
import { getConferenceLogo } from '../../data/conferenceLogos'
import { getTeamConference } from '../../data/conferenceTeams'
import GameEntryModal from '../../components/GameEntryModal'
import { parseCFPGameId, getCFPRoundInfo, getCFPSlotDisplayName } from '../../data/cfpConstants'
import { STAT_TABS, STAT_TAB_ORDER } from '../../data/boxScoreConstants'

// Map abbreviations to mascot names for logo lookup
function getMascotName(abbr) {
  const mascotMap = {
    'AFA': 'Air Force Falcons', 'AKR': 'Akron Zips', 'BAMA': 'Alabama Crimson Tide',
    'APP': 'Appalachian State Mountaineers', 'ARIZ': 'Arizona Wildcats',
    'ARK': 'Arkansas Razorbacks', 'ARMY': 'Army Black Knights',
    'ARST': 'Arkansas State Red Wolves', 'ASU': 'Arizona State Sun Devils',
    'AUB': 'Auburn Tigers', 'BALL': 'Ball State Cardinals', 'BC': 'Boston College Eagles',
    'BGSU': 'Bowling Green Falcons', 'BOIS': 'Boise State Broncos',
    'BU': 'Baylor Bears', 'BUFF': 'Buffalo Bulls', 'BYU': 'Brigham Young Cougars',
    'CAL': 'California Golden Bears', 'CCU': 'Coastal Carolina Chanticleers',
    'CHAR': 'Charlotte 49ers', 'CLEM': 'Clemson Tigers', 'CMU': 'Central Michigan Chippewas',
    'COLO': 'Colorado Buffaloes', 'CONN': 'Connecticut Huskies', 'CSU': 'Colorado State Rams',
    'DUKE': 'Duke Blue Devils', 'ECU': 'East Carolina Pirates', 'EMU': 'Eastern Michigan Eagles',
    'FIU': 'Florida International Panthers', 'FSU': 'Florida State Seminoles',
    'FAU': 'Florida Atlantic Owls', 'FRES': 'Fresno State Bulldogs',
    'UF': 'Florida Gators', 'GASO': 'Georgia Southern Eagles', 'GAST': 'Georgia State Panthers',
    'GT': 'Georgia Tech Yellow Jackets', 'UGA': 'Georgia Bulldogs',
    'HAW': 'Hawaii Rainbow Warriors', 'HOU': 'Houston Cougars',
    'ILL': 'Illinois Fighting Illini', 'IU': 'Indiana Hoosiers',
    'IOWA': 'Iowa Hawkeyes', 'ISU': 'Iowa State Cyclones',
    'JKST': 'Jacksonville State Gamecocks', 'JMU': 'James Madison Dukes',
    'KU': 'Kansas Jayhawks', 'KSU': 'Kansas State Wildcats',
    'KENT': 'Kent State Golden Flashes', 'UK': 'Kentucky Wildcats',
    'LIB': 'Liberty Flames', 'ULL': 'Lafayette Ragin\' Cajuns',
    'LT': 'Louisiana Tech Bulldogs', 'LOU': 'Louisville Cardinals',
    'LSU': 'LSU Tigers', 'UM': 'Miami Hurricanes', 'M-OH': 'Miami Redhawks',
    'UMD': 'Maryland Terrapins', 'MASS': 'Massachusetts Minutemen',
    'MEM': 'Memphis Tigers', 'MICH': 'Michigan Wolverines',
    'MSU': 'Michigan State Spartans', 'MTSU': 'Middle Tennessee State Blue Raiders',
    'MINN': 'Minnesota Golden Gophers', 'MISS': 'Ole Miss Rebels',
    'MSST': 'Mississippi State Bulldogs', 'MZST': 'Missouri State Bears',
    'MRSH': 'Marshall Thundering Herd', 'NAVY': 'Navy Midshipmen',
    'NEB': 'Nebraska Cornhuskers', 'NEV': 'Nevada Wolf Pack',
    'UNM': 'New Mexico Lobos', 'NMSU': 'New Mexico State Aggies',
    'UNC': 'North Carolina Tar Heels', 'NCST': 'North Carolina State Wolfpack',
    'UNT': 'North Texas Mean Green', 'NU': 'Northwestern Wildcats',
    'ND': 'Notre Dame Fighting Irish', 'NIU': 'Northern Illinois Huskies',
    'OHIO': 'Ohio Bobcats', 'OSU': 'Ohio State Buckeyes',
    'OKLA': 'Oklahoma Sooners', 'OKST': 'Oklahoma State Cowboys',
    'ODU': 'Old Dominion Monarchs', 'ORE': 'Oregon Ducks',
    'ORST': 'Oregon State Beavers', 'PSU': 'Penn State Nittany Lions',
    'PITT': 'Pittsburgh Panthers', 'PUR': 'Purdue Boilermakers',
    'RICE': 'Rice Owls', 'RUT': 'Rutgers Scarlet Knights',
    'SDSU': 'San Diego State Aztecs', 'SJSU': 'San Jose State Spartans',
    'SAM': 'Sam Houston State Bearkats', 'USF': 'South Florida Bulls',
    'SMU': 'SMU Mustangs', 'USC': 'USC Trojans',
    'SCAR': 'South Carolina Gamecocks', 'STAN': 'Stanford Cardinal',
    'SYR': 'Syracuse Orange', 'TCU': 'TCU Horned Frogs',
    'TEM': 'Temple Owls', 'TENN': 'Tennessee Volunteers',
    'TEX': 'Texas Longhorns', 'TXAM': 'Texas A&M Aggies',
    'TXST': 'Texas State Bobcats', 'TXTECH': 'Texas Tech Red Raiders',
    'TOL': 'Toledo Rockets', 'TROY': 'Troy Trojans',
    'TUL': 'Tulane Green Wave', 'TLSA': 'Tulsa Golden Hurricane',
    'UAB': 'UAB Blazers', 'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins',
    'UNLV': 'UNLV Rebels', 'UTEP': 'UTEP Miners',
    'USA': 'South Alabama Jaguars', 'USU': 'Utah State Aggies',
    'UTAH': 'Utah Utes', 'UTSA': 'UTSA Roadrunners',
    'VAN': 'Vanderbilt Commodores', 'UVA': 'Virginia Cavaliers',
    'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons',
    'WASH': 'Washington Huskies', 'WSU': 'Washington State Cougars',
    'WVU': 'West Virginia Mountaineers', 'WMU': 'Western Michigan Broncos',
    'WKU': 'Western Kentucky Hilltoppers', 'WIS': 'Wisconsin Badgers',
    'WYO': 'Wyoming Cowboys',
    'DEL': 'Delaware Fightin\' Blue Hens', 'FLA': 'Florida Gators',
    'KENN': 'Kennesaw State Owls', 'ULM': 'Monroe Warhawks',
    'UC': 'Cincinnati Bearcats', 'RUTG': 'Rutgers Scarlet Knights',
    'SHSU': 'Sam Houston State Bearkats', 'TAMU': 'Texas A&M Aggies',
    'TTU': 'Texas Tech Red Raiders', 'TULN': 'Tulane Green Wave',
    'UH': 'Houston Cougars', 'UL': 'Lafayette Ragin\' Cajuns',
    'UT': 'Tennessee Volunteers', 'MIA': 'Miami Hurricanes',
    'MIZ': 'Missouri Tigers', 'OU': 'Oklahoma Sooners',
    'GSU': 'Georgia State Panthers',
    // FCS teams
    'FCSE': 'FCS East Judicials', 'FCSM': 'FCS Midwest Rebels',
    'FCSN': 'FCS Northwest Stallions', 'FCSW': 'FCS West Titans'
  }
  return mascotMap[abbr] || null
}

// Robust logo lookup that tries multiple methods
function getTeamLogoRobust(teamInput) {
  if (!teamInput) return null

  // 1. Try direct lookup (if teamInput is already a full mascot name)
  let logo = getTeamLogo(teamInput)
  if (logo) return logo

  // 2. Try as abbreviation via getMascotName
  const mascotName = getMascotName(teamInput)
  if (mascotName) {
    logo = getTeamLogo(mascotName)
    if (logo) return logo
  }

  // 3. Try uppercase abbreviation (handle case sensitivity)
  const upperInput = teamInput.toUpperCase()
  if (upperInput !== teamInput) {
    const mascotNameUpper = getMascotName(upperInput)
    if (mascotNameUpper) {
      logo = getTeamLogo(mascotNameUpper)
      if (logo) return logo
    }
  }

  // 4. Try looking up in teamAbbreviations map directly
  const teamData = teamAbbreviations[teamInput] || teamAbbreviations[upperInput]
  if (teamData?.name) {
    logo = getTeamLogo(teamData.name)
    if (logo) return logo
  }

  return null
}

// Robust color lookup that tries multiple methods
function getTeamColorsRobust(teamInput) {
  if (!teamInput) return null

  // 1. Try direct lookup (if teamInput is already a full mascot name)
  let colors = getTeamColors(teamInput)
  if (colors) return colors

  // 2. Try as abbreviation via getMascotName
  const mascotName = getMascotName(teamInput)
  if (mascotName) {
    colors = getTeamColors(mascotName)
    if (colors) return colors
  }

  // 3. Try uppercase abbreviation (handle case sensitivity)
  const upperInput = teamInput.toUpperCase()
  if (upperInput !== teamInput) {
    const mascotNameUpper = getMascotName(upperInput)
    if (mascotNameUpper) {
      colors = getTeamColors(mascotNameUpper)
      if (colors) return colors
    }
  }

  // 4. Try looking up in teamAbbreviations map directly
  const teamData = teamAbbreviations[teamInput] || teamAbbreviations[upperInput]
  if (teamData?.name) {
    colors = getTeamColors(teamData.name)
    if (colors) return colors
  }

  return null
}

// Default neutral colors for game recap pages
const defaultColors = {
  primary: '#1f2937',    // Gray-800
  secondary: '#f3f4f6'   // Gray-100
}

export default function Game() {
  const { id, gameId } = useParams()
  const navigate = useNavigate()
  const { currentDynasty, updateDynasty } = useDynasty()
  const pathPrefix = usePathPrefix()
  // Get team-centric team ratings
  const teamRatings = getCurrentTeamRatings(currentDynasty)
  // Use neutral colors for game recap pages instead of user's team colors
  const teamColors = defaultColors

  const [showEditModal, setShowEditModal] = useState(false)
  const [activeStatTab, setActiveStatTab] = useState('passing')

  // Find the game by ID in the games[] array
  // Supports direct ID lookup and pattern-based fallbacks
  const findGame = () => {
    if (!currentDynasty?.games) return null

    // 1. Direct ID lookup - this is the primary method
    // Works for regular games and CFP games with new slot IDs (cfpfr1-2025, cfpqf1-2025, etc.)
    let found = currentDynasty.games.find(g => g.id === gameId)
    if (found) return found

    // 2. NEW: CFP Slot ID pattern (cfpfr1-2025, cfpqf2-2025, cfpsf1-2025, cfpnc-2025)
    const cfpParsed = parseCFPGameId(gameId)
    if (cfpParsed) {
      const { slotId, year } = cfpParsed
      const roundInfo = getCFPRoundInfo(slotId)
      const displayName = getCFPSlotDisplayName(slotId)

      // Define bowl name mappings
      const qfBowlNames = {
        cfpqf1: 'Sugar Bowl',
        cfpqf2: 'Orange Bowl',
        cfpqf3: 'Rose Bowl',
        cfpqf4: 'Cotton Bowl'
      }
      const sfBowlNames = {
        cfpsf1: 'Peach Bowl',
        cfpsf2: 'Fiesta Bowl'
      }
      const frSeedMatchups = {
        cfpfr1: [5, 12],
        cfpfr2: [8, 9],
        cfpfr3: [6, 11],
        cfpfr4: [7, 10]
      }

      // FIRST: Check games[] array for user's game with matching CFP properties
      // User's CFP games are stored with unique IDs but have isCFPQuarterfinal, bowlName, etc.
      if (slotId.startsWith('cfpfr')) {
        const [seed1, seed2] = frSeedMatchups[slotId] || []
        found = currentDynasty.games.find(g =>
          g.isCFPFirstRound && Number(g.year) === year &&
          ((g.seed1 === seed1 && g.seed2 === seed2) || (g.seed1 === seed2 && g.seed2 === seed1))
        )
        if (found) return found
      } else if (slotId.startsWith('cfpqf')) {
        const targetBowl = qfBowlNames[slotId]
        found = currentDynasty.games.find(g =>
          g.isCFPQuarterfinal && Number(g.year) === year && g.bowlName === targetBowl
        )
        if (found) return found
      } else if (slotId.startsWith('cfpsf')) {
        const targetBowl = sfBowlNames[slotId]
        found = currentDynasty.games.find(g =>
          g.isCFPSemifinal && Number(g.year) === year && g.bowlName === targetBowl
        )
        if (found) return found
      } else if (slotId === 'cfpnc') {
        found = currentDynasty.games.find(g =>
          g.isCFPChampionship && Number(g.year) === year
        )
        if (found) return found
      }

      // FALLBACK: Check cfpResultsByYear for CPU vs CPU games
      const cfpResults = currentDynasty.cfpResultsByYear?.[year] || {}
      let cfpGame = null

      if (slotId.startsWith('cfpfr')) {
        const [seed1, seed2] = frSeedMatchups[slotId] || []
        const frGames = cfpResults.firstRound || []
        cfpGame = frGames.find(g => g && (
          (g.seed1 === seed1 && g.seed2 === seed2) ||
          (g.seed1 === seed2 && g.seed2 === seed1)
        ))
      } else if (slotId.startsWith('cfpqf')) {
        const targetBowl = qfBowlNames[slotId]
        const qfGames = cfpResults.quarterfinals || []
        cfpGame = qfGames.find(g => g && g.bowlName === targetBowl)
      } else if (slotId.startsWith('cfpsf')) {
        const targetBowl = sfBowlNames[slotId]
        const sfGames = cfpResults.semifinals || []
        cfpGame = sfGames.find(g => g && g.bowlName === targetBowl)
      } else if (slotId === 'cfpnc') {
        const champArray = cfpResults.championship || []
        cfpGame = Array.isArray(champArray) ? champArray[0] : champArray
      }

      if (cfpGame) {
        const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
        const isUserGame = cfpGame.team1 === userTeamAbbr || cfpGame.team2 === userTeamAbbr
        return {
          ...cfpGame,
          id: gameId,
          year,
          isPlayoff: true,
          isCPUGame: !isUserGame,
          gameTitle: displayName,
          bowlName: displayName,
          ...roundInfo
        }
      }
    }

    // 3. Conference championship patterns
    // cc-{year} pattern for user's team conference championship
    const ccMatch = gameId.match(/^cc-(\d+)$/)
    if (ccMatch) {
      const year = parseInt(ccMatch[1])
      found = currentDynasty.games.find(g => g.isConferenceChampionship && Number(g.year) === year)
      if (found) return found
    }

    // cc-{year}-{conference-slug} pattern for any conference championship
    const ccConfMatch = gameId.match(/^cc-(\d+)-(.+)$/)
    if (ccConfMatch) {
      const year = parseInt(ccConfMatch[1])
      const confSlug = ccConfMatch[2]
      found = currentDynasty.games.find(g =>
        g.isConferenceChampionship && Number(g.year) === year &&
        g.conference?.toLowerCase().replace(/\s+/g, '-') === confSlug
      )
      if (found) return found
      const ccByYear = currentDynasty.conferenceChampionshipsByYear?.[year] || []
      const ccGame = ccByYear.find(g =>
        g.conference?.toLowerCase().replace(/\s+/g, '-') === confSlug
      )
      if (ccGame) {
        return {
          ...ccGame,
          id: gameId,
          year: year,
          isConferenceChampionship: true,
          isCPUGame: true,
          gameTitle: `${ccGame.conference} Championship`
        }
      }
    }

    // 4. bowl-{year}-{name} pattern for non-CFP bowl games
    const bowlMatch = gameId.match(/^bowl-(\d+)-(.+)$/)
    if (bowlMatch) {
      const year = parseInt(bowlMatch[1])
      const bowlSlug = bowlMatch[2]
      found = currentDynasty.games.find(g =>
        g.isBowlGame && Number(g.year) === year &&
        g.bowlName?.replace(/\s+/g, '-').toLowerCase() === bowlSlug
      )
      if (found) return found

      // Fallback: Check bowlGamesByYear for legacy data
      const bowlGamesByYear = currentDynasty.bowlGamesByYear || {}
      const yearData = bowlGamesByYear[year]
      if (yearData) {
        const allWeekGames = [...(yearData.week1 || []), ...(yearData.week2 || []), ...(yearData.week3 || [])]
        const bowlGame = allWeekGames.find(g =>
          g.bowlName?.replace(/\s+/g, '-').toLowerCase() === bowlSlug &&
          g.team1 && g.team2 && g.team1Score != null
        )
        if (bowlGame) {
          const winner = bowlGame.team1Score > bowlGame.team2Score ? bowlGame.team1 : bowlGame.team2
          return {
            ...bowlGame,
            id: gameId,
            year: year,
            isBowlGame: true,
            isCPUGame: true,
            viewingTeamAbbr: winner,
            gameTitle: bowlGame.bowlName
          }
        }
      }
    }

    return null
  }

  const game = findGame()

  if (!currentDynasty) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading dynasty...</div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: teamColors.primary, color: getContrastTextColor(teamColors.primary) }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="text-center py-12">
          <div className="text-xl font-bold text-gray-600">Game not found</div>
          <div className="text-gray-500 mt-2">Game ID: {gameId}</div>
        </div>
      </div>
    )
  }

  const userTeam = currentDynasty.teamName
  const userTeamAbbr = getAbbreviationFromDisplayName(userTeam)

  // Check if this is a CPU vs CPU game
  const isCPUGame = game.isCPUGame || (game.team1 && game.team2 && game.team1 !== userTeamAbbr && game.team2 !== userTeamAbbr)

  // For CPU games, determine viewing perspective
  let displayTeam, displayTeamAbbr, opponent, opponentAbbr
  if (isCPUGame) {
    displayTeamAbbr = game.viewingTeamAbbr || game.team1
    displayTeam = getMascotName(displayTeamAbbr) || displayTeamAbbr
    opponentAbbr = displayTeamAbbr === game.team1 ? game.team2 : game.team1
    opponent = getMascotName(opponentAbbr) || opponentAbbr
  } else {
    displayTeam = userTeam
    displayTeamAbbr = userTeamAbbr
    opponentAbbr = game.opponent
    opponent = getMascotName(game.opponent) || game.opponent
  }

  // Get team info for display - use robust lookups to handle various team name formats
  const displayTeamLogo = getTeamLogoRobust(displayTeam) || getTeamLogoRobust(displayTeamAbbr)
  const displayTeamColors = getTeamColorsRobust(displayTeam) || getTeamColorsRobust(displayTeamAbbr) || { primary: '#666', secondary: '#fff' }

  const opponentLogo = getTeamLogoRobust(opponent) || getTeamLogoRobust(opponentAbbr)
  const opponentColors = getTeamColorsRobust(opponent) || getTeamColorsRobust(opponentAbbr) || { primary: '#666', secondary: '#fff' }

  // Determine scores
  let userScore, opponentScore, userWon
  if (isCPUGame) {
    const isTeam1Display = displayTeamAbbr === game.team1
    userScore = isTeam1Display ? game.team1Score : game.team2Score
    opponentScore = isTeam1Display ? game.team2Score : game.team1Score
    userWon = userScore > opponentScore
  } else {
    userScore = game.teamScore
    opponentScore = game.opponentScore
    userWon = game.result === 'win' || game.result === 'W'
  }

  // Helper function to get player PID by name
  const getPlayerPID = (playerName) => {
    const player = currentDynasty?.players?.find(p => p.name === playerName)
    return player?.pid
  }

  // Calculate user's record up to and including this game
  const calculateUserRecord = () => {
    if (isCPUGame) return null

    const allGames = currentDynasty?.games || []
    const yearGames = allGames.filter(g => Number(g.year) === Number(game.year) && !g.isCPUGame)

    const getGameOrder = (g) => {
      if (typeof g.week === 'number' && g.week >= 1 && g.week <= 14 &&
          !g.isConferenceChampionship && !g.isBowlGame &&
          !g.isCFPFirstRound && !g.isCFPQuarterfinal && !g.isCFPSemifinal && !g.isCFPChampionship) {
        return g.week
      }
      if (g.isConferenceChampionship) return 15
      if (g.isBowlGame && !g.isCFPFirstRound && !g.isCFPQuarterfinal && !g.isCFPSemifinal && !g.isCFPChampionship) {
        return 16 + (g.bowlWeek || 0)
      }
      if (g.isCFPFirstRound) return 20
      if (g.isCFPQuarterfinal) return 21
      if (g.isCFPSemifinal) return 22
      if (g.isCFPChampionship) return 23
      return g.week || 0
    }

    const currentGameOrder = getGameOrder(game)
    const gamesUpToThis = yearGames.filter(g => getGameOrder(g) <= currentGameOrder)

    const wins = gamesUpToThis.filter(g => g.result === 'win' || g.result === 'W').length
    const losses = gamesUpToThis.filter(g => g.result === 'loss' || g.result === 'L').length

    const confGames = gamesUpToThis.filter(g => g.isConferenceGame && !g.isConferenceChampionship)
    const confWins = confGames.filter(g => g.result === 'win' || g.result === 'W').length
    const confLosses = confGames.filter(g => g.result === 'loss' || g.result === 'L').length

    return {
      overall: `${wins}-${losses}`,
      conference: `${confWins}-${confLosses}`
    }
  }

  const userRecord = calculateUserRecord()

  // Parse links
  const parseLinks = (linksString) => {
    if (!linksString) return []
    return linksString.split(',').map(link => link.trim()).filter(link => link)
  }
  const links = parseLinks(game.links)

  const isYouTubeLink = (url) => url.includes('youtube.com') || url.includes('youtu.be')
  const getYouTubeEmbedUrl = (url) => {
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    return videoIdMatch ? `https://www.youtube.com/embed/${videoIdMatch[1]}` : null
  }
  const isImageLink = (url) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('imgur.com')

  // Determine team positions (away vs home)
  const location = game.location || 'neutral'
  const leftTeam = location === 'home' ? 'opponent' : 'user'
  const rightTeam = location === 'home' ? 'user' : 'opponent'

  // Handle game save from modal
  const handleGameSave = async (gameData) => {
    try {
      const existingGames = currentDynasty.games || []
      const gameIndex = existingGames.findIndex(g => g.id === gameId)

      // Use the game from games[] if found, otherwise use the constructed game object
      // This handles games loaded from cfpResultsByYear, bowlGamesByYear, etc.
      const originalGame = gameIndex >= 0 ? existingGames[gameIndex] : game
      const isNewGame = gameIndex < 0

      let updatedGame
      if (isCPUGame) {
        const incomingTeam1 = gameData.team1
        const incomingTeam1Score = parseInt(gameData.team1Score)
        const incomingTeam2Score = parseInt(gameData.team2Score)

        const team1MatchesOriginal = incomingTeam1 === originalGame.team1

        let finalTeam1Score, finalTeam2Score
        if (team1MatchesOriginal) {
          finalTeam1Score = incomingTeam1Score
          finalTeam2Score = incomingTeam2Score
        } else {
          finalTeam1Score = incomingTeam2Score
          finalTeam2Score = incomingTeam1Score
        }

        const winner = finalTeam1Score > finalTeam2Score ? originalGame.team1 : originalGame.team2
        const winnerIsTeam1 = winner === originalGame.team1

        updatedGame = {
          ...originalGame,
          id: gameId,  // Ensure ID is set
          team1Score: finalTeam1Score,
          team2Score: finalTeam2Score,
          winner: winner,
          // Preserve original viewingTeamAbbr or default to team1 to prevent display flip
          viewingTeamAbbr: originalGame.viewingTeamAbbr || originalGame.team1,
          gameNote: gameData.gameNote || '',
          links: gameData.links || '',
          quarters: gameData.quarters,
          overtimes: gameData.overtimes,
          // Include rankings for CPU games
          userRank: gameData.userRank,
          opponentRank: gameData.opponentRank,
          updatedAt: new Date().toISOString()
        }
      } else {
        updatedGame = {
          ...originalGame,
          ...gameData,
          id: gameId,  // Ensure ID is set
          updatedAt: new Date().toISOString()
        }
      }

      let updatedGames
      if (isNewGame) {
        // Game was constructed from fallback data - add to games array
        updatedGames = [...existingGames, updatedGame]
      } else {
        // Game exists in array - update in place
        updatedGames = [...existingGames]
        updatedGames[gameIndex] = updatedGame
      }

      await updateDynasty(currentDynasty.id, { games: updatedGames })

      setShowEditModal(false)
    } catch (error) {
      console.error('Error saving game:', error)
    }
  }

  // Get game title
  let gameTitle = ''
  let gameSubtitle = ''
  if (game.isConferenceChampionship) {
    gameTitle = `${game.conference || ''} Championship`
    gameSubtitle = `${game.year} Conference Championship Game`
  } else if (game.isCFPChampionship) {
    gameTitle = 'National Championship'
    gameSubtitle = `${game.year} College Football Playoff`
  } else if (game.isCFPSemifinal) {
    gameTitle = game.bowlName || 'CFP Semifinal'
    gameSubtitle = `${game.year} College Football Playoff Semifinal`
  } else if (game.isCFPQuarterfinal) {
    gameTitle = game.bowlName || 'CFP Quarterfinal'
    gameSubtitle = `${game.year} College Football Playoff Quarterfinal`
  } else if (game.isCFPFirstRound) {
    gameTitle = 'CFP First Round'
    gameSubtitle = `${game.year} College Football Playoff`
  } else if (game.bowlName) {
    gameTitle = game.bowlName
    gameSubtitle = `${game.year} Bowl Season`
  } else {
    gameTitle = typeof game.week === 'number' ? `Week ${game.week}` : (game.week || 'Game')
    gameSubtitle = `${game.year} ${location === 'home' ? 'Home' : location === 'away' ? 'Away' : 'Neutral Site'}`
  }

  // Get logos
  const confName = game.conference || currentDynasty?.conference || (userTeamAbbr ? getTeamConference(userTeamAbbr) : null)
  const bowlLogo = game.bowlName ? getBowlLogo(game.bowlName) : null
  const confLogo = game.isConferenceChampionship && confName ? getConferenceLogo(confName) : null
  const eventLogo = bowlLogo || confLogo

  // Get rankings
  const leftRank = leftTeam === 'user' ? game.userRank : game.opponentRank
  const rightRank = rightTeam === 'user' ? game.userRank : game.opponentRank

  // Team data for rendering
  const getTeamData = (side) => {
    const isDisplayTeam = side === 'user'
    return {
      name: isDisplayTeam ? displayTeam : opponent,
      abbr: isDisplayTeam ? displayTeamAbbr : opponentAbbr,
      logo: isDisplayTeam ? displayTeamLogo : opponentLogo,
      colors: isDisplayTeam ? displayTeamColors : opponentColors,
      score: isDisplayTeam ? userScore : opponentScore,
      isWinner: isDisplayTeam ? userWon : !userWon,
      rank: side === leftTeam ? leftRank : rightRank,
      record: isDisplayTeam && !isCPUGame && userRecord ? `${userRecord.overall} (${userRecord.conference})` : (isDisplayTeam ? null : game.opponentRecord)
    }
  }

  const leftData = getTeamData(leftTeam)
  const rightData = getTeamData(rightTeam)

  // Winner takes more of the gradient with smooth blend - winner gets 70%, blend zone in middle
  const leftWon = leftData.isWinner
  const headerGradient = leftWon
    ? `linear-gradient(90deg, ${leftData.colors.primary} 0%, ${leftData.colors.primary} 55%, ${rightData.colors.primary} 85%, ${rightData.colors.primary} 100%)`
    : `linear-gradient(90deg, ${leftData.colors.primary} 0%, ${leftData.colors.primary} 15%, ${rightData.colors.primary} 45%, ${rightData.colors.primary} 100%)`

  return (
    <div className="space-y-4">
      {/* Compact Header Bar */}
      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg">
        {/* Top bar with game info and navigation */}
        <div
          className="px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between"
          style={{ background: headerGradient }}
        >
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs sm:text-sm bg-black/20 text-white hover:bg-black/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {eventLogo && (
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white rounded p-0.5 shadow">
                <img src={eventLogo} alt="Event" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="text-white text-center">
              <div className="text-sm sm:text-base font-bold">{gameTitle}</div>
              <div className="text-[10px] sm:text-xs opacity-80">{gameSubtitle}</div>
            </div>
          </div>

          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs sm:text-sm bg-black/20 text-white hover:bg-black/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>

        {/* Compact Scoreboard */}
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Left Team */}
            <Link to={`${pathPrefix}/team/${leftData.abbr}/${game.year}`} className="group flex-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center p-1.5 sm:p-2 group-hover:scale-105 transition-transform shadow-lg flex-shrink-0 bg-white"
                >
                  {leftData.logo && (
                    <img src={leftData.logo} alt={leftData.name} className="w-full h-full object-contain" />
                  )}
                </div>
                <div>
                  <div className="text-white font-bold text-xs sm:text-sm md:text-base group-hover:underline">
                    <span className="sm:hidden">{leftData.rank ? `#${leftData.rank} ` : ''}{leftData.abbr}</span>
                    <span className="hidden sm:inline">{leftData.rank ? `#${leftData.rank} ` : ''}{leftData.name}</span>
                  </div>
                  {leftData.record && (
                    <div className="text-gray-400 text-[10px] sm:text-xs">{leftData.record}</div>
                  )}
                </div>
              </div>
            </Link>

            {/* Scores */}
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="text-center">
                <div className={`text-3xl sm:text-4xl md:text-5xl font-black tabular-nums ${leftData.isWinner ? 'text-white' : 'text-gray-500'}`}>
                  {leftData.score}
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-gray-500 text-xs font-medium">FINAL</span>
                {game.overtimes && game.overtimes.length > 0 && (
                  <span className="text-yellow-400 text-[10px] font-bold">
                    {game.overtimes.length > 1 ? `${game.overtimes.length}OT` : 'OT'}
                  </span>
                )}
              </div>

              <div className="text-center">
                <div className={`text-3xl sm:text-4xl md:text-5xl font-black tabular-nums ${rightData.isWinner ? 'text-white' : 'text-gray-500'}`}>
                  {rightData.score}
                </div>
              </div>
            </div>

            {/* Right Team */}
            <Link to={`${pathPrefix}/team/${rightData.abbr}/${game.year}`} className="group flex-1">
              <div className="flex items-center justify-end gap-2 sm:gap-3">
                <div className="text-right">
                  <div className="text-white font-bold text-xs sm:text-sm md:text-base group-hover:underline">
                    <span className="sm:hidden">{rightData.rank ? `#${rightData.rank} ` : ''}{rightData.abbr}</span>
                    <span className="hidden sm:inline">{rightData.rank ? `#${rightData.rank} ` : ''}{rightData.name}</span>
                  </div>
                  {rightData.record && (
                    <div className="text-gray-400 text-[10px] sm:text-xs">{rightData.record}</div>
                  )}
                </div>
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center p-1.5 sm:p-2 group-hover:scale-105 transition-transform shadow-lg flex-shrink-0 bg-white"
                >
                  {rightData.logo && (
                    <img src={rightData.logo} alt={rightData.name} className="w-full h-full object-contain" />
                  )}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Scoring Summary - Dark theme continuation */}
      {game.quarters && (() => {
        const t = game.quarters.team || {}
        const o = game.quarters.opponent || {}
        const hasData = [t.Q1, t.Q2, t.Q3, t.Q4, o.Q1, o.Q2, o.Q3, o.Q4].some(
          v => v !== undefined && v !== '' && v !== null
        )
        return hasData
      })() && (
        <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold">Team</th>
                  <th className="text-center py-3 px-2 sm:px-3 font-semibold">1st</th>
                  <th className="text-center py-3 px-2 sm:px-3 font-semibold">2nd</th>
                  <th className="text-center py-3 px-2 sm:px-3 font-semibold">3rd</th>
                  <th className="text-center py-3 px-2 sm:px-3 font-semibold">4th</th>
                  {game.overtimes?.map((_, i) => (
                    <th key={i} className="text-center py-3 px-2 sm:px-3 font-semibold">OT{i > 0 ? i + 1 : ''}</th>
                  ))}
                  <th className="text-center py-3 px-3 sm:px-4 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[leftData, rightData].map((team, idx) => {
                  const quarterKey = (idx === 0 ? leftTeam : rightTeam) === 'user' ? 'team' : 'opponent'
                  return (
                    <tr key={idx} className={idx === 0 ? 'border-b border-gray-700' : ''}>
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center p-1 flex-shrink-0 bg-white"
                          >
                            {team.logo && <img src={team.logo} alt="" className="w-full h-full object-contain" />}
                          </div>
                          <span className={`font-bold ${team.isWinner ? 'text-white' : 'text-gray-400'}`}>
                            <span className="sm:hidden">{team.abbr}</span>
                            <span className="hidden sm:inline">{team.name}</span>
                          </span>
                        </div>
                      </td>
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                        <td key={q} className="text-center py-3 px-2 sm:px-3 text-gray-300 font-medium">{game.quarters[quarterKey]?.[q] ?? '-'}</td>
                      ))}
                      {game.overtimes?.map((ot, i) => (
                        <td key={i} className="text-center py-3 px-2 sm:px-3 text-yellow-400 font-medium">{ot[quarterKey] ?? '-'}</td>
                      ))}
                      <td className={`text-center py-3 px-3 sm:px-4 font-black text-lg sm:text-xl ${team.isWinner ? 'text-white' : 'text-gray-500'}`}>
                        {team.score}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Box Score Section */}
      {game.boxScore && (
        <div className="space-y-6">
          {/* Box Score Stats */}
          <div className="rounded-xl overflow-hidden shadow-lg bg-gray-900">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="font-bold text-white text-sm uppercase tracking-wide">
                Box Score
              </h3>
            </div>

            {/* Stat Category Tabs */}
            <div className="flex border-b border-gray-700 overflow-x-auto">
              {STAT_TAB_ORDER.map(key => {
                const tab = STAT_TABS[key]
                const hasData = (game.boxScore.home?.[key]?.length > 0) || (game.boxScore.away?.[key]?.length > 0)
                if (!hasData) return null
                return (
                  <button
                    key={key}
                    onClick={() => setActiveStatTab(key)}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeStatTab === key
                        ? 'text-white border-b-2 border-white bg-gray-800'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {tab.title}
                  </button>
                )
              })}
            </div>

            {/* Stats Table */}
            <div className="p-4 overflow-x-auto">
              {STAT_TABS[activeStatTab] && (
                <div className="space-y-6">
                  {/* Home Team Stats - rightData is home team (right side = home) */}
                  {game.boxScore.home?.[activeStatTab]?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <img
                          src={getTeamLogo(getMascotName(rightData.abbr) || rightData.abbr)}
                          alt={rightData.name}
                          className="w-6 h-6 object-contain"
                        />
                        <span className="text-white font-semibold">{rightData.name}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 text-left">
                            {STAT_TABS[activeStatTab].headers.map((header, idx) => (
                              <th key={idx} className={`py-2 px-2 font-medium ${idx === 0 ? '' : 'text-center'}`}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {game.boxScore.home[activeStatTab].map((row, idx) => (
                            <tr key={idx} className="border-t border-gray-800">
                              {STAT_TABS[activeStatTab].headers.map((header, colIdx) => {
                                const key = colIdx === 0 ? 'playerName' : header.replace(/\s+/g, '').replace(/^./, c => c.toLowerCase())
                                const value = row[key] ?? '-'
                                const playerPID = colIdx === 0 ? getPlayerPID(value) : null
                                return (
                                  <td key={colIdx} className={`py-2 px-2 text-white ${colIdx === 0 ? '' : 'text-center'}`}>
                                    {colIdx === 0 && playerPID ? (
                                      <Link to={`${pathPrefix}/player/${playerPID}`} className="hover:underline hover:text-blue-300">
                                        {value}
                                      </Link>
                                    ) : value}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Away Team Stats - leftData is away team (left side = away) */}
                  {game.boxScore.away?.[activeStatTab]?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <img
                          src={getTeamLogo(getMascotName(leftData.abbr) || leftData.abbr)}
                          alt={leftData.name}
                          className="w-6 h-6 object-contain"
                        />
                        <span className="text-white font-semibold">{leftData.name}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 text-left">
                            {STAT_TABS[activeStatTab].headers.map((header, idx) => (
                              <th key={idx} className={`py-2 px-2 font-medium ${idx === 0 ? '' : 'text-center'}`}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {game.boxScore.away[activeStatTab].map((row, idx) => (
                            <tr key={idx} className="border-t border-gray-800">
                              {STAT_TABS[activeStatTab].headers.map((header, colIdx) => {
                                const key = colIdx === 0 ? 'playerName' : header.replace(/\s+/g, '').replace(/^./, c => c.toLowerCase())
                                const value = row[key] ?? '-'
                                const playerPID = colIdx === 0 ? getPlayerPID(value) : null
                                return (
                                  <td key={colIdx} className={`py-2 px-2 text-white ${colIdx === 0 ? '' : 'text-center'}`}>
                                    {colIdx === 0 && playerPID ? (
                                      <Link to={`${pathPrefix}/player/${playerPID}`} className="hover:underline hover:text-blue-300">
                                        {value}
                                      </Link>
                                    ) : value}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Scoring Summary */}
          {game.boxScore.scoringSummary?.length > 0 && (() => {
            // Calculate points for a play
            const getPlayPoints = (play) => {
              const scoreType = play.scoreType || ''
              const patResult = play.patResult || ''

              // TD-based plays
              if (scoreType.includes('TD')) {
                let points = 6
                if (patResult.includes('Made XP')) points += 1
                else if (patResult.includes('Converted 2PT')) points += 2
                return points
              }
              // Field goal
              if (scoreType === 'Field Goal') return 3
              // Safety
              if (scoreType === 'Safety') return 2

              return 0
            }

            // Calculate running scores
            let leftScore = 0
            let rightScore = 0
            const playsWithScores = game.boxScore.scoringSummary.map((play) => {
              const points = getPlayPoints(play)
              const isLeftTeam = play.team?.toUpperCase() === leftData.abbr?.toUpperCase()
              if (isLeftTeam) {
                leftScore += points
              } else {
                rightScore += points
              }
              return { ...play, runningLeftScore: leftScore, runningRightScore: rightScore }
            })

            return (
              <div className="rounded-xl overflow-hidden shadow-lg bg-gray-900">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">
                    Scoring Plays
                  </h3>
                </div>
                <div className="divide-y divide-gray-800/50">
                  {playsWithScores.map((play, idx) => {
                    const playTeamColors = getTeamColorsRobust(play.team) || { primary: '#666', secondary: '#333' }
                    const scorerPID = getPlayerPID(play.scorer)
                    const passerPID = play.passer ? getPlayerPID(play.passer) : null
                    const contrastColor = getContrastTextColor(playTeamColors.primary)
                    const isLeftTeam = play.team?.toUpperCase() === leftData.abbr?.toUpperCase()
                    return (
                      <div
                        key={idx}
                        className="flex items-stretch"
                      >
                        {/* Team color bar on left */}
                        <div
                          className="w-1.5 flex-shrink-0"
                          style={{ backgroundColor: playTeamColors.primary }}
                        />
                        {/* Main content with team-colored background */}
                        <div
                          className="flex-1 flex items-center gap-3 px-4 py-3"
                          style={{
                            background: `linear-gradient(90deg, ${playTeamColors.primary}25 0%, ${playTeamColors.primary}08 50%, transparent 100%)`
                          }}
                        >
                          {/* Team logo */}
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-800/50">
                            <img
                              src={getTeamLogo(getMascotName(play.team) || play.team)}
                              alt={play.team}
                              className="w-7 h-7 object-contain"
                            />
                          </div>
                          {/* Play details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="font-bold text-sm"
                                style={{ color: playTeamColors.primary }}
                              >
                                {getMascotName(play.team) || play.team}
                              </span>
                              <span className="text-gray-400 text-sm">
                                {play.scoreType}
                                {play.yards && ` (${play.yards} yds)`}
                              </span>
                              {play.patResult && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  play.patResult.includes('Made') || play.patResult.includes('Converted')
                                    ? 'bg-green-500/30 text-green-300'
                                    : 'bg-red-500/30 text-red-300'
                                }`}>
                                  {play.patResult}
                                </span>
                              )}
                            </div>
                            <div className="text-gray-300 text-xs mt-1">
                              {scorerPID ? (
                                <Link to={`${pathPrefix}/player/${scorerPID}`} className="font-medium hover:underline hover:text-blue-300">
                                  {play.scorer}
                                </Link>
                              ) : <span className="font-medium">{play.scorer}</span>}
                              {play.passer && (
                                <>
                                  {' from '}
                                  {passerPID ? (
                                    <Link to={`${pathPrefix}/player/${passerPID}`} className="font-medium hover:underline hover:text-blue-300">
                                      {play.passer}
                                    </Link>
                                  ) : <span className="font-medium">{play.passer}</span>}
                                </>
                              )}
                              {play.patNotes && (
                                <span className="text-gray-400 ml-2">({play.patNotes})</span>
                              )}
                            </div>
                          </div>
                          {/* Running Score */}
                          <div className="flex items-center gap-1 flex-shrink-0 mr-3">
                            <span className={`text-lg font-black tabular-nums ${isLeftTeam ? 'text-white' : 'text-gray-400'}`}>
                              {play.runningLeftScore}
                            </span>
                            <span className="text-gray-500 text-sm">-</span>
                            <span className={`text-lg font-black tabular-nums ${!isLeftTeam ? 'text-white' : 'text-gray-400'}`}>
                              {play.runningRightScore}
                            </span>
                          </div>
                          {/* Quarter and time */}
                          <div className="text-right flex-shrink-0">
                            <div
                              className="text-xs font-bold px-2 py-0.5 rounded"
                              style={{ backgroundColor: playTeamColors.primary + '40', color: 'white' }}
                            >
                              Q{play.quarter}
                            </div>
                            <div className="text-gray-400 text-xs mt-1 font-mono">{play.timeLeft}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Game Details Section */}
      {(!isCPUGame && (game.opponentOverall || game.opponentOffense || game.opponentDefense || game.conferencePOW || game.confDefensePOW || game.nationalPOW || game.natlDefensePOW)) || game.gameNote ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Team Matchup Card */}
          {!isCPUGame && (game.opponentOverall || game.opponentOffense || game.opponentDefense) && (
            <div className="lg:col-span-5 rounded-xl overflow-hidden shadow-lg" style={{ background: `linear-gradient(135deg, ${leftData.colors.primary}15 0%, ${rightData.colors.primary}15 100%)` }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: `${leftData.colors.primary}30` }}>
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Team Ratings
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {[leftData, rightData].map((team, idx) => {
                  const isOpponent = (idx === 0 ? leftTeam : rightTeam) !== 'user'
                  const ratings = isOpponent
                    ? { ovr: game.opponentOverall, off: game.opponentOffense, def: game.opponentDefense }
                    : { ovr: teamRatings?.overall, off: teamRatings?.offense, def: teamRatings?.defense }

                  if (!ratings.ovr && !ratings.off && !ratings.def) return null

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5 shadow-md flex-shrink-0 bg-white"
                      >
                        {team.logo && <img src={team.logo} alt="" className="w-full h-full object-contain" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-800 text-sm truncate">{team.name}</div>
                        <div className="flex gap-3 mt-1">
                          {ratings.ovr && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 font-medium">OVR</span>
                              <span className="font-black text-gray-800">{ratings.ovr}</span>
                            </div>
                          )}
                          {ratings.off && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 font-medium">OFF</span>
                              <span className="font-bold text-green-600">{ratings.off}</span>
                            </div>
                          )}
                          {ratings.def && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 font-medium">DEF</span>
                              <span className="font-bold text-red-600">{ratings.def}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Player of the Week */}
          {!isCPUGame && (game.conferencePOW || game.confDefensePOW || game.nationalPOW || game.natlDefensePOW) && (
            <div className="lg:col-span-4 rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-gray-900 to-gray-800">
              <div className="px-4 py-3 border-b border-gray-700">
                <h3 className="font-bold text-white text-sm uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Player of the Week
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Conference POW Section */}
                {(game.conferencePOW || game.confDefensePOW) && (
                  <div
                    className="p-3 rounded-lg"
                    style={{ background: `linear-gradient(135deg, ${teamColors.primary}40 0%, ${teamColors.primary}20 100%)` }}
                  >
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Conference</div>
                    <div className="space-y-2">
                      {game.conferencePOW && (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: teamColors.primary }}
                          >
                            <svg className="w-3.5 h-3.5" fill={getContrastTextColor(teamColors.primary)} viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-gray-500 uppercase">Offensive</div>
                            {getPlayerPID(game.conferencePOW) ? (
                              <Link
                                to={`${pathPrefix}/player/${getPlayerPID(game.conferencePOW)}`}
                                className="font-bold text-white text-sm hover:underline truncate block"
                              >
                                {game.conferencePOW}
                              </Link>
                            ) : (
                              <div className="font-bold text-white text-sm truncate">{game.conferencePOW}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {game.confDefensePOW && (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: teamColors.secondary }}
                          >
                            <svg className="w-3.5 h-3.5" fill={getContrastTextColor(teamColors.secondary)} viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-gray-500 uppercase">Defensive</div>
                            {getPlayerPID(game.confDefensePOW) ? (
                              <Link
                                to={`${pathPrefix}/player/${getPlayerPID(game.confDefensePOW)}`}
                                className="font-bold text-white text-sm hover:underline truncate block"
                              >
                                {game.confDefensePOW}
                              </Link>
                            ) : (
                              <div className="font-bold text-white text-sm truncate">{game.confDefensePOW}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* National POW Section */}
                {(game.nationalPOW || game.natlDefensePOW) && (
                  <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-500/30 to-yellow-400/20 border border-yellow-500/30">
                    <div className="text-[10px] text-yellow-300 uppercase font-bold tracking-wider mb-2">National</div>
                    <div className="space-y-2">
                      {game.nationalPOW && (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-yellow-400 shadow-lg shadow-yellow-400/30">
                            <svg className="w-3.5 h-3.5 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-yellow-400/70 uppercase">Offensive</div>
                            {getPlayerPID(game.nationalPOW) ? (
                              <Link
                                to={`${pathPrefix}/player/${getPlayerPID(game.nationalPOW)}`}
                                className="font-bold text-yellow-300 text-sm hover:underline truncate block"
                              >
                                {game.nationalPOW}
                              </Link>
                            ) : (
                              <div className="font-bold text-yellow-300 text-sm truncate">{game.nationalPOW}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {game.natlDefensePOW && (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-yellow-600 shadow-lg shadow-yellow-600/30">
                            <svg className="w-3.5 h-3.5 text-yellow-100" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-yellow-400/70 uppercase">Defensive</div>
                            {getPlayerPID(game.natlDefensePOW) ? (
                              <Link
                                to={`${pathPrefix}/player/${getPlayerPID(game.natlDefensePOW)}`}
                                className="font-bold text-yellow-300 text-sm hover:underline truncate block"
                              >
                                {game.natlDefensePOW}
                              </Link>
                            ) : (
                              <div className="font-bold text-yellow-300 text-sm truncate">{game.natlDefensePOW}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Game Notes */}
          {game.gameNote && (
            <div
              className={`rounded-xl overflow-hidden shadow-lg ${
                (!isCPUGame && (game.opponentOverall || game.conferencePOW || game.confDefensePOW || game.nationalPOW || game.natlDefensePOW))
                  ? 'lg:col-span-3'
                  : 'lg:col-span-12'
              }`}
              style={{ backgroundColor: displayTeamColors.primary }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: `${getContrastTextColor(displayTeamColors.primary)}20` }}>
                <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2" style={{ color: getContrastTextColor(displayTeamColors.primary) }}>
                  <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Game Notes
                </h3>
              </div>
              <div className="p-4">
                <p
                  className="text-sm whitespace-pre-wrap leading-relaxed"
                  style={{ color: getContrastTextColor(displayTeamColors.primary), opacity: 0.9 }}
                >
                  {game.gameNote}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Media Section */}
      {links.length > 0 && (
        <div className="rounded-xl overflow-hidden shadow-lg bg-gray-900">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="font-bold text-white text-sm uppercase tracking-wide flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Media
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {links.map((link, index) => {
              const youtubeEmbedUrl = isYouTubeLink(link) ? getYouTubeEmbedUrl(link) : null

              if (youtubeEmbedUrl) {
                return (
                  <div key={index} className="rounded-xl overflow-hidden shadow-lg aspect-video ring-1 ring-gray-700">
                    <iframe
                      width="100%"
                      height="100%"
                      src={youtubeEmbedUrl}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    ></iframe>
                  </div>
                )
              } else if (isImageLink(link)) {
                return (
                  <div key={index} className="rounded-xl overflow-hidden shadow-lg ring-1 ring-gray-700">
                    <img src={link} alt={`Game media ${index + 1}`} className="w-full h-auto" />
                  </div>
                )
              } else {
                return (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl hover:bg-gray-750 transition-colors group ring-1 ring-gray-700"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: teamColors.primary }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke={getContrastTextColor(teamColors.primary)} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-300 group-hover:text-white break-all flex-1 transition-colors">{link}</span>
                    <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                )
              }
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <GameEntryModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleGameSave}
        teamColors={teamColors}
        existingGame={game}
      />
    </div>
  )
}
