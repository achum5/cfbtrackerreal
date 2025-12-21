import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getTeamLogo } from '../../data/teams'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamColors } from '../../data/teamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getBowlLogo } from '../../data/bowlLogos'
import { getConferenceLogo } from '../../data/conferenceLogos'
import { getTeamConference } from '../../data/conferenceTeams'
import GameEntryModal from '../../components/GameEntryModal'

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
    'MSST': 'Mississippi State Bulldogs', 'MZST': 'Missouri Tigers',
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
    'GSU': 'Georgia State Panthers'
  }
  return mascotMap[abbr] || null
}

export default function Game() {
  const { id, gameId } = useParams()
  const navigate = useNavigate()
  const { currentDynasty, updateDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)

  const [showEditModal, setShowEditModal] = useState(false)

  // Find the game by ID in the games[] array
  // Also handle fallback IDs like cc-{year}, bowl-{year}-{name}, etc.
  const findGame = () => {
    if (!currentDynasty?.games) return null

    // Direct ID lookup
    let found = currentDynasty.games.find(g => g.id === gameId)
    if (found) return found

    // Handle fallback ID patterns
    // cc-{year} pattern for conference championships (user's team)
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
          year: year,
          isConferenceChampionship: true,
          isCPUGame: true,
          gameTitle: `${ccGame.conference} Championship`
        }
      }
    }

    // bowl-{year}-{name} pattern for bowl games
    const bowlMatch = gameId.match(/^bowl-(\d+)-(.+)$/)
    if (bowlMatch) {
      const year = parseInt(bowlMatch[1])
      const bowlSlug = bowlMatch[2]
      // First check games[] array
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
            year: year,
            isBowlGame: true,
            isCPUGame: true,
            viewingTeamAbbr: winner,
            gameTitle: bowlGame.bowlName
          }
        }
      }
    }

    // cfp-{year}-firstround pattern
    const cfpFRMatch = gameId.match(/^cfp-(\d+)-firstround$/)
    if (cfpFRMatch) {
      const year = parseInt(cfpFRMatch[1])
      found = currentDynasty.games.find(g => g.isCFPFirstRound && Number(g.year) === year)
      if (found) return found
    }

    // cfp-{year}-quarterfinal pattern
    const cfpQFMatch = gameId.match(/^cfp-(\d+)-quarterfinal$/)
    if (cfpQFMatch) {
      const year = parseInt(cfpQFMatch[1])
      found = currentDynasty.games.find(g => g.isCFPQuarterfinal && Number(g.year) === year)
      if (found) return found
    }

    // cfp-{year}-semifinal pattern
    const cfpSFMatch = gameId.match(/^cfp-(\d+)-semifinal$/)
    if (cfpSFMatch) {
      const year = parseInt(cfpSFMatch[1])
      found = currentDynasty.games.find(g => g.isCFPSemifinal && Number(g.year) === year)
      if (found) return found
    }

    // cfp-{year}-championship pattern
    const cfpChampMatch = gameId.match(/^cfp-(\d+)-championship$/)
    if (cfpChampMatch) {
      const year = parseInt(cfpChampMatch[1])
      found = currentDynasty.games.find(g => g.isCFPChampionship && Number(g.year) === year)
      if (found) return found
    }

    // cfp-{year}-{bowl-slug} pattern for CFP games by bowl name
    const cfpBowlMatch = gameId.match(/^cfp-(\d+)-(.+)$/)
    if (cfpBowlMatch) {
      const year = parseInt(cfpBowlMatch[1])
      const bowlSlug = cfpBowlMatch[2]

      const qfBowls = ['sugar-bowl', 'orange-bowl', 'rose-bowl', 'cotton-bowl']
      const sfBowls = ['peach-bowl', 'fiesta-bowl']

      const cfpResults = currentDynasty.cfpResultsByYear?.[year] || {}

      if (qfBowls.includes(bowlSlug)) {
        const bowlName = bowlSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        const qfGame = (cfpResults.quarterfinals || []).find(g => g.bowlName === bowlName)
        if (qfGame) {
          return {
            ...qfGame,
            year: year,
            isCFPQuarterfinal: true,
            isBowlGame: true,
            isPlayoff: true,
            isCPUGame: true,
            gameTitle: bowlName
          }
        }
      } else if (sfBowls.includes(bowlSlug)) {
        const bowlName = bowlSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        const sfGame = (cfpResults.semifinals || []).find(g => g.bowlName === bowlName)
        if (sfGame) {
          return {
            ...sfGame,
            year: year,
            isCFPSemifinal: true,
            isBowlGame: true,
            isPlayoff: true,
            isCPUGame: true,
            gameTitle: bowlName
          }
        }
      } else if (bowlSlug === 'national-championship') {
        const champGame = cfpResults.championship
        if (champGame) {
          return {
            ...champGame,
            year: year,
            isCFPChampionship: true,
            isBowlGame: true,
            isPlayoff: true,
            isCPUGame: true,
            gameTitle: 'National Championship'
          }
        }
      } else if (bowlSlug === 'first-round') {
        const frGame = (cfpResults.firstRound || [])[0]
        if (frGame) {
          return {
            ...frGame,
            year: year,
            isCFPFirstRound: true,
            isBowlGame: true,
            isPlayoff: true,
            isCPUGame: true,
            gameTitle: 'CFP First Round'
          }
        }
      }
    }

    // cfp-{year}-round{round} pattern (generic CFP round pattern)
    const cfpRoundMatch = gameId.match(/^cfp-(\d+)-round(\d+)$/)
    if (cfpRoundMatch) {
      const year = parseInt(cfpRoundMatch[1])
      const round = parseInt(cfpRoundMatch[2])
      const cfpResults = currentDynasty.cfpResultsByYear?.[year] || {}
      const roundArrays = {
        1: cfpResults.firstRound || [],
        2: cfpResults.quarterfinals || [],
        3: cfpResults.semifinals || [],
        4: cfpResults.championship ? [cfpResults.championship] : []
      }
      const roundGames = roundArrays[round] || []
      if (roundGames.length > 0) {
        return roundGames[0]
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

  // Get team info for display
  const displayTeamLogo = getTeamLogo(displayTeam)
  const displayTeamColors = isCPUGame
    ? (getMascotName(displayTeamAbbr) ? getTeamColors(getMascotName(displayTeamAbbr)) : teamColors)
    : teamColors

  const opponentLogo = getTeamLogo(opponent) || getTeamLogo(getMascotName(opponentAbbr))
  const opponentColors = getMascotName(opponentAbbr)
    ? getTeamColors(getMascotName(opponentAbbr))
    : { primary: '#666', secondary: '#fff' }

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

      if (gameIndex < 0) {
        console.error('Game not found in games array')
        return
      }

      const originalGame = existingGames[gameIndex]

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
          team1Score: finalTeam1Score,
          team2Score: finalTeam2Score,
          winner: winner,
          viewingTeamAbbr: winner,
          opponent: winnerIsTeam1 ? originalGame.team2 : originalGame.team1,
          teamScore: winnerIsTeam1 ? finalTeam1Score : finalTeam2Score,
          opponentScore: winnerIsTeam1 ? finalTeam2Score : finalTeam1Score,
          result: 'win',
          gameNote: gameData.gameNote || '',
          links: gameData.links || '',
          updatedAt: new Date().toISOString()
        }
      } else {
        updatedGame = {
          ...originalGame,
          ...gameData,
          id: originalGame.id,
          updatedAt: new Date().toISOString()
        }
      }

      const updatedGames = [...existingGames]
      updatedGames[gameIndex] = updatedGame
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: teamColors.primary, color: getContrastTextColor(teamColors.primary) }}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          onClick={() => setShowEditModal(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
      </div>

      {/* Main Scoreboard Card */}
      <div className="rounded-2xl overflow-hidden shadow-xl">
        {/* Header with game info */}
        <div
          className="px-4 py-3 sm:px-6 sm:py-4 text-center relative"
          style={{ background: `linear-gradient(135deg, ${displayTeamColors.primary} 0%, ${opponentColors.primary} 100%)` }}
        >
          {eventLogo && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-lg p-1.5 shadow-lg hidden sm:flex items-center justify-center">
              <img src={eventLogo} alt="Event logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="text-white">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{gameTitle}</div>
            <div className="text-xs sm:text-sm opacity-90 mt-0.5">{gameSubtitle}</div>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-black/30 rounded-full">
            <span className="text-white text-xs sm:text-sm font-bold tracking-wider">FINAL</span>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {/* Left Team */}
            <div className="flex-1 text-center">
              <Link to={`/dynasty/${id}/team/${leftData.abbr}/${game.year}`} className="group inline-block">
                <div className="relative">
                  {leftData.rank && (
                    <div className="absolute -top-2 -left-2 sm:-top-3 sm:-left-3 w-6 h-6 sm:w-8 sm:h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg z-10">
                      <span className="text-xs sm:text-sm font-bold text-gray-900">{leftData.rank}</span>
                    </div>
                  )}
                  <div
                    className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 mx-auto rounded-full flex items-center justify-center p-3 sm:p-4 group-hover:scale-105 transition-transform shadow-xl"
                    style={{ backgroundColor: leftData.colors.primary }}
                  >
                    {leftData.logo && (
                      <img src={leftData.logo} alt={leftData.name} className="w-full h-full object-contain drop-shadow-lg" />
                    )}
                  </div>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-white font-bold text-sm sm:text-lg md:text-xl group-hover:underline truncate px-2">
                    {leftData.name}
                  </div>
                  {leftData.record && (
                    <div className="text-gray-400 text-xs sm:text-sm mt-0.5">{leftData.record}</div>
                  )}
                </div>
              </Link>
              <div className={`text-5xl sm:text-6xl md:text-8xl font-black mt-3 sm:mt-4 tabular-nums ${leftData.isWinner ? 'text-white' : 'text-gray-500'}`}>
                {leftData.score}
              </div>
              {leftData.isWinner && (
                <div className="mt-2 inline-flex items-center px-3 py-1 sm:px-4 sm:py-1.5 bg-green-500 rounded-full">
                  <span className="text-white text-xs sm:text-sm font-bold">WIN</span>
                </div>
              )}
            </div>

            {/* VS Divider */}
            <div className="flex-shrink-0 px-2 sm:px-6">
              <div className="w-px h-24 sm:h-32 md:h-40 bg-gray-600 mx-auto relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-700 px-2 py-1 sm:px-3 sm:py-2 rounded">
                  <span className="text-gray-400 text-xs sm:text-sm font-bold">VS</span>
                </div>
              </div>
            </div>

            {/* Right Team */}
            <div className="flex-1 text-center">
              <Link to={`/dynasty/${id}/team/${rightData.abbr}/${game.year}`} className="group inline-block">
                <div className="relative">
                  {rightData.rank && (
                    <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-8 sm:h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg z-10">
                      <span className="text-xs sm:text-sm font-bold text-gray-900">{rightData.rank}</span>
                    </div>
                  )}
                  <div
                    className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 mx-auto rounded-full flex items-center justify-center p-3 sm:p-4 group-hover:scale-105 transition-transform shadow-xl"
                    style={{ backgroundColor: rightData.colors.primary }}
                  >
                    {rightData.logo && (
                      <img src={rightData.logo} alt={rightData.name} className="w-full h-full object-contain drop-shadow-lg" />
                    )}
                  </div>
                </div>
                <div className="mt-3 sm:mt-4">
                  <div className="text-white font-bold text-sm sm:text-lg md:text-xl group-hover:underline truncate px-2">
                    {rightData.name}
                  </div>
                  {rightData.record && (
                    <div className="text-gray-400 text-xs sm:text-sm mt-0.5">{rightData.record}</div>
                  )}
                </div>
              </Link>
              <div className={`text-5xl sm:text-6xl md:text-8xl font-black mt-3 sm:mt-4 tabular-nums ${rightData.isWinner ? 'text-white' : 'text-gray-500'}`}>
                {rightData.score}
              </div>
              {rightData.isWinner && (
                <div className="mt-2 inline-flex items-center px-3 py-1 sm:px-4 sm:py-1.5 bg-green-500 rounded-full">
                  <span className="text-white text-xs sm:text-sm font-bold">WIN</span>
                </div>
              )}
            </div>
          </div>

          {/* Overtime indicator */}
          {game.overtimes && game.overtimes.length > 0 && (
            <div className="text-center mt-4">
              <span className="text-yellow-400 text-sm font-bold">
                {game.overtimes.length > 1 ? `${game.overtimes.length}OT` : 'OVERTIME'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Quarter by Quarter Scores */}
        {game.quarters && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100" style={{ backgroundColor: `${teamColors.primary}10` }}>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Scoring Summary</h3>
            </div>
            <div className="p-3 sm:p-4 overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left pb-2 font-semibold">Team</th>
                    <th className="text-center pb-2 w-10 font-semibold">1</th>
                    <th className="text-center pb-2 w-10 font-semibold">2</th>
                    <th className="text-center pb-2 w-10 font-semibold">3</th>
                    <th className="text-center pb-2 w-10 font-semibold">4</th>
                    {game.overtimes?.map((_, i) => (
                      <th key={i} className="text-center pb-2 w-10 font-semibold">OT</th>
                    ))}
                    <th className="text-center pb-2 w-12 font-semibold">T</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[leftData, rightData].map((team, idx) => {
                    const quarterKey = (idx === 0 ? leftTeam : rightTeam) === 'user' ? 'team' : 'opponent'
                    return (
                      <tr key={idx} className={idx === 0 ? 'border-b border-gray-100' : ''}>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center p-0.5"
                              style={{ backgroundColor: team.colors.primary }}
                            >
                              {team.logo && <img src={team.logo} alt="" className="w-full h-full object-contain" />}
                            </div>
                            <span className="font-semibold text-gray-800 truncate max-w-[100px] sm:max-w-none">{team.name}</span>
                          </div>
                        </td>
                        {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                          <td key={q} className="text-center py-2 text-gray-600">{game.quarters[quarterKey]?.[q] ?? 0}</td>
                        ))}
                        {game.overtimes?.map((ot, i) => (
                          <td key={i} className="text-center py-2 text-gray-600">{ot[quarterKey] ?? 0}</td>
                        ))}
                        <td className={`text-center py-2 font-bold ${team.isWinner ? 'text-green-600' : 'text-gray-800'}`}>
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

        {/* Team Ratings - only for user games with opponent ratings */}
        {!isCPUGame && (game.opponentOverall || game.opponentOffense || game.opponentDefense) && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100" style={{ backgroundColor: `${teamColors.primary}10` }}>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Team Ratings</h3>
            </div>
            <div className="p-3 sm:p-4">
              <div className="space-y-3">
                {[leftData, rightData].map((team, idx) => {
                  const isOpponent = (idx === 0 ? leftTeam : rightTeam) !== 'user'
                  const ratings = isOpponent
                    ? { ovr: game.opponentOverall, off: game.opponentOffense, def: game.opponentDefense }
                    : { ovr: currentDynasty.teamRatings?.overall, off: currentDynasty.teamRatings?.offense, def: currentDynasty.teamRatings?.defense }

                  if (!ratings.ovr && !ratings.off && !ratings.def) return null

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center p-1 flex-shrink-0"
                        style={{ backgroundColor: team.colors.primary }}
                      >
                        {team.logo && <img src={team.logo} alt="" className="w-full h-full object-contain" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{team.name}</div>
                        <div className="flex gap-3 mt-1">
                          {ratings.ovr && (
                            <div className="text-xs">
                              <span className="text-gray-500">OVR</span>
                              <span className="ml-1 font-bold text-gray-800">{ratings.ovr}</span>
                            </div>
                          )}
                          {ratings.off && (
                            <div className="text-xs">
                              <span className="text-gray-500">OFF</span>
                              <span className="ml-1 font-bold text-gray-800">{ratings.off}</span>
                            </div>
                          )}
                          {ratings.def && (
                            <div className="text-xs">
                              <span className="text-gray-500">DEF</span>
                              <span className="ml-1 font-bold text-gray-800">{ratings.def}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Player of the Week Honors - only for user games */}
        {!isCPUGame && (game.conferencePOW || game.nationalPOW) && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100" style={{ backgroundColor: `${teamColors.primary}10` }}>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Player of the Week</h3>
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {game.conferencePOW && (
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${teamColors.primary}08` }}>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: teamColors.primary }}
                    >
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 font-medium">Conference POW</div>
                      {getPlayerPID(game.conferencePOW) ? (
                        <Link
                          to={`/dynasty/${id}/player/${getPlayerPID(game.conferencePOW)}`}
                          className="font-bold hover:underline truncate block"
                          style={{ color: teamColors.primary }}
                        >
                          {game.conferencePOW}
                        </Link>
                      ) : (
                        <div className="font-bold truncate" style={{ color: teamColors.primary }}>
                          {game.conferencePOW}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {game.nationalPOW && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-yellow-400">
                      <svg className="w-5 h-5 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-yellow-700 font-medium">National POW</div>
                      {getPlayerPID(game.nationalPOW) ? (
                        <Link
                          to={`/dynasty/${id}/player/${getPlayerPID(game.nationalPOW)}`}
                          className="font-bold text-yellow-800 hover:underline truncate block"
                        >
                          {game.nationalPOW}
                        </Link>
                      ) : (
                        <div className="font-bold text-yellow-800 truncate">{game.nationalPOW}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Game Notes */}
        {game.gameNote && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100" style={{ backgroundColor: `${teamColors.primary}10` }}>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Game Notes</h3>
            </div>
            <div className="p-3 sm:p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{game.gameNote}</p>
            </div>
          </div>
        )}
      </div>

      {/* Media Links */}
      {links.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100" style={{ backgroundColor: `${teamColors.primary}10` }}>
            <h3 className="font-bold text-gray-800 text-sm sm:text-base">Media & Links</h3>
          </div>
          <div className="p-3 sm:p-4 space-y-4">
            {links.map((link, index) => {
              const youtubeEmbedUrl = isYouTubeLink(link) ? getYouTubeEmbedUrl(link) : null

              if (youtubeEmbedUrl) {
                return (
                  <div key={index} className="rounded-lg overflow-hidden shadow-md aspect-video">
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
                  <div key={index} className="rounded-lg overflow-hidden shadow-md">
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
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                    <span className="text-sm text-blue-600 group-hover:underline break-all flex-1">{link}</span>
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
        weekNumber={game.week}
        currentYear={game.year}
        teamColors={teamColors}
        opponent={isCPUGame ? null : game.opponent}
        location={game.location}
        existingTeamScore={isCPUGame ? game.team1Score : game.teamScore}
        existingOpponentScore={isCPUGame ? game.team2Score : game.opponentScore}
        existingGameNote={game.gameNote}
        existingLinks={game.links}
        existingQuarters={game.quarters}
        existingOvertimes={game.overtimes}
        existingOpponentRecord={game.opponentRecord}
        existingOpponentRatings={{
          overall: game.opponentOverall,
          offense: game.opponentOffense,
          defense: game.opponentDefense
        }}
        existingConferencePOW={game.conferencePOW}
        existingNationalPOW={game.nationalPOW}
        existingOpponentRank={game.opponentRank}
        existingUserRank={game.userRank}
        existingIsConferenceGame={game.isConferenceGame}
        isCPUGame={isCPUGame}
        team1={isCPUGame ? game.team1 : null}
        team2={isCPUGame ? game.team2 : null}
        bowlName={game.bowlName || game.conference}
      />
    </div>
  )
}
