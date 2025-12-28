import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getTeamLogo } from '../../data/teams'
import { getAbbreviationFromDisplayName, teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamColors } from '../../data/teamColors'
import PlayerEditModal from '../../components/PlayerEditModal'
import OverallProgressionModal from '../../components/OverallProgressionModal'
import { getPlayerSeasonStatsFromBoxScores, getPlayerGameLog } from '../../utils/boxScoreAggregator'

// Map abbreviation to mascot name for logo lookup
const getMascotName = (abbr) => {
  const mascotMap = {
    'BAMA': 'Alabama Crimson Tide', 'AFA': 'Air Force Falcons', 'AKR': 'Akron Zips',
    'APP': 'Appalachian State Mountaineers', 'ARIZ': 'Arizona Wildcats', 'ARK': 'Arkansas Razorbacks',
    'ARMY': 'Army Black Knights', 'ARST': 'Arkansas State Red Wolves', 'ASU': 'Arizona State Sun Devils',
    'AUB': 'Auburn Tigers', 'BALL': 'Ball State Cardinals', 'BC': 'Boston College Eagles',
    'BGSU': 'Bowling Green Falcons', 'BOIS': 'Boise State Broncos', 'BU': 'Baylor Bears',
    'BUFF': 'Buffalo Bulls', 'BYU': 'Brigham Young Cougars', 'CAL': 'California Golden Bears',
    'CCU': 'Coastal Carolina Chanticleers', 'CHAR': 'Charlotte 49ers', 'CINN': 'Cincinnati Bearcats',
    'CLEM': 'Clemson Tigers', 'CMU': 'Central Michigan Chippewas', 'COLO': 'Colorado Buffaloes',
    'CONN': 'Connecticut Huskies', 'CSU': 'Colorado State Rams', 'DUKE': 'Duke Blue Devils',
    'ECU': 'East Carolina Pirates', 'EMU': 'Eastern Michigan Eagles', 'FAU': 'Florida Atlantic Owls',
    'FIU': 'Florida International Panthers', 'FLA': 'Florida Gators', 'FRES': 'Fresno State Bulldogs',
    'FSU': 'Florida State Seminoles', 'GASO': 'Georgia Southern Eagles', 'GSU': 'Georgia State Panthers',
    'GT': 'Georgia Tech Yellow Jackets', 'HAW': 'Hawaii Rainbow Warriors', 'HOU': 'Houston Cougars',
    'ILL': 'Illinois Fighting Illini', 'IU': 'Indiana Hoosiers', 'IOWA': 'Iowa Hawkeyes',
    'ISU': 'Iowa State Cyclones', 'JKST': 'Jacksonville State Gamecocks', 'JMU': 'James Madison Dukes',
    'KENN': 'Kennesaw State Owls', 'KENT': 'Kent State Golden Flashes', 'KSU': 'Kansas State Wildcats',
    'KU': 'Kansas Jayhawks', 'LIB': 'Liberty Flames', 'LOU': 'Louisville Cardinals',
    'LSU': 'LSU Tigers', 'LT': 'Louisiana Tech Bulldogs', 'M-OH': 'Miami Redhawks',
    'MASS': 'Massachusetts Minutemen', 'MEM': 'Memphis Tigers', 'MIA': 'Miami Hurricanes',
    'MICH': 'Michigan Wolverines', 'MINN': 'Minnesota Golden Gophers', 'MISS': 'Ole Miss Rebels',
    'MIZ': 'Missouri Tigers', 'MRSH': 'Marshall Thundering Herd', 'MRYD': 'Maryland Terrapins',
    'MSST': 'Mississippi State Bulldogs', 'MSU': 'Michigan State Spartans',
    'MTSU': 'Middle Tennessee State Blue Raiders', 'NAVY': 'Navy Midshipmen',
    'NCST': 'North Carolina State Wolfpack', 'ND': 'Notre Dame Fighting Irish',
    'NEB': 'Nebraska Cornhuskers', 'NEV': 'Nevada Wolf Pack', 'NIU': 'Northern Illinois Huskies',
    'NMSU': 'New Mexico State Aggies', 'NU': 'Northwestern Wildcats', 'ODU': 'Old Dominion Monarchs',
    'OHIO': 'Ohio Bobcats', 'OSU': 'Ohio State Buckeyes', 'OKST': 'Oklahoma State Cowboys',
    'ORE': 'Oregon Ducks', 'ORST': 'Oregon State Beavers', 'OU': 'Oklahoma Sooners',
    'PITT': 'Pittsburgh Panthers', 'PSU': 'Penn State Nittany Lions', 'PUR': 'Purdue Boilermakers',
    'RICE': 'Rice Owls', 'RUTG': 'Rutgers Scarlet Knights', 'SCAR': 'South Carolina Gamecocks',
    'SDSU': 'San Diego State Aztecs', 'SHSU': 'Sam Houston State Bearkats', 'SJSU': 'San Jose State Spartans',
    'SMU': 'SMU Mustangs', 'STAN': 'Stanford Cardinal', 'SYR': 'Syracuse Orange',
    'TAMU': 'Texas A&M Aggies', 'TCU': 'TCU Horned Frogs', 'TEM': 'Temple Owls',
    'TENN': 'Tennessee Volunteers', 'TEX': 'Texas Longhorns', 'TLNE': 'Tulane Green Wave',
    'TLSA': 'Tulsa Golden Hurricane', 'TOL': 'Toledo Rockets', 'TROY': 'Troy Trojans',
    'TTU': 'Texas Tech Red Raiders', 'TXST': 'Texas State Bobcats', 'UAB': 'UAB Blazers',
    'UC': 'Cincinnati Bearcats', 'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins', 'UGA': 'Georgia Bulldogs',
    'UK': 'Kentucky Wildcats', 'ULL': 'Lafayette Ragin\' Cajuns', 'ULM': 'Monroe Warhawks',
    'UNC': 'North Carolina Tar Heels', 'UNLV': 'UNLV Rebels', 'UNM': 'New Mexico Lobos',
    'UNT': 'North Texas Mean Green', 'USA': 'South Alabama Jaguars', 'USC': 'USC Trojans',
    'USF': 'South Florida Bulls', 'USM': 'Southern Mississippi Golden Eagles',
    'USU': 'Utah State Aggies', 'UTAH': 'Utah Utes', 'UTEP': 'UTEP Miners',
    'UTSA': 'UTSA Roadrunners', 'UVA': 'Virginia Cavaliers', 'VAND': 'Vanderbilt Commodores',
    'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons', 'WASH': 'Washington Huskies',
    'WIS': 'Wisconsin Badgers', 'WKU': 'Western Kentucky Hilltoppers', 'WMU': 'Western Michigan Broncos',
    'WSU': 'Washington State Cougars', 'WVU': 'West Virginia Mountaineers', 'WYO': 'Wyoming Cowboys',
    'DEL': 'Delaware Fightin\' Blue Hens', 'GAST': 'Georgia State Panthers', 'MZST': 'Missouri State Bears',
    'OKLA': 'Oklahoma Sooners', 'RUT': 'Rutgers Scarlet Knights', 'TUL': 'Tulane Green Wave',
    'TULN': 'Tulane Green Wave', 'TXAM': 'Texas A&M Aggies', 'TXTECH': 'Texas Tech Red Raiders',
    'UF': 'Florida Gators', 'UH': 'Houston Cougars', 'UL': 'Lafayette Ragin\' Cajuns',
    'UM': 'Miami Hurricanes', 'UMD': 'Maryland Terrapins', 'UT': 'Tennessee Volunteers',
    'VAN': 'Vanderbilt Commodores',
    // FCS teams
    'FCSE': 'FCS East Judicials', 'FCSM': 'FCS Midwest Rebels',
    'FCSN': 'FCS Northwest Stallions', 'FCSW': 'FCS West Titans'
  }
  return mascotMap[abbr] || null
}

// Class progression order
const CLASS_ORDER = ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr']

// Determine primary stat category for a position (where G/Snaps should appear)
const getPrimaryStatCategory = (position) => {
  const positionMap = {
    'QB': 'passing',
    'HB': 'rushing', 'FB': 'rushing',
    'WR': 'receiving', 'TE': 'receiving',
    'LT': 'blocking', 'LG': 'blocking', 'C': 'blocking', 'RG': 'blocking', 'RT': 'blocking',
    'LEDG': 'defense', 'REDG': 'defense', 'DT': 'defense',
    'SAM': 'defense', 'MIKE': 'defense', 'WILL': 'defense',
    'CB': 'defense', 'FS': 'defense', 'SS': 'defense',
    'K': 'kicking',
    'P': 'punting'
  }
  return positionMap[position] || 'passing'
}

export default function Player() {
  const { id: dynastyId, pid } = useParams()
  const { dynasties, currentDynasty, updatePlayer, deletePlayer, isViewOnly } = useDynasty()
  const pathPrefix = usePathPrefix()
  const navigate = useNavigate()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAccoladeModal, setShowAccoladeModal] = useState(false)
  const [accoladeType, setAccoladeType] = useState(null)
  const [showOverallProgressionModal, setShowOverallProgressionModal] = useState(false)
  const [showGameLogModal, setShowGameLogModal] = useState(false)
  const [expandedGameLogYear, setExpandedGameLogYear] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // In view mode, dynastyId is undefined - just use currentDynasty directly
  const dynasty = dynastyId
    ? (currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId))
    : currentDynasty
  const player = dynasty?.players?.find(p => p.pid === parseInt(pid))

  // Determine the player's team from their team field
  // Falls back to dynasty.teamName only for legacy players without a team field
  const playerTeamAbbr = player?.team
    || player?.teams?.[0]
    || getAbbreviationFromDisplayName(dynasty?.teamName)
    || ''

  // Get the full team name from the abbreviation
  const playerTeamName = getMascotName(playerTeamAbbr)
    || teamAbbreviations[playerTeamAbbr]?.name
    || dynasty?.teamName
    || ''

  // IMPORTANT: All hooks must be called before any early returns
  const teamColors = useTeamColors(playerTeamName)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pid])

  // Early returns AFTER all hooks
  if (!dynasty) {
    return <div className="text-center py-12"><p className="text-gray-600">Dynasty not found</p></div>
  }

  if (!player) {
    return <div className="text-center py-12"><p className="text-gray-600">Player not found</p></div>
  }
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)
  const teamAbbr = playerTeamAbbr

  // Check if player was drafted
  const getDraftInfo = () => {
    const draftResultsByYear = dynasty.draftResultsByYear || {}
    for (const [year, results] of Object.entries(draftResultsByYear)) {
      if (!results) continue
      const draftResult = results.find(r => r.pid === player.pid || r.playerName === player.name)
      if (draftResult) {
        return { year: parseInt(year), ...draftResult }
      }
    }
    return null
  }
  const draftInfo = getDraftInfo()

  // Calculate POW honors
  const calculatePOWHonors = () => {
    const games = dynasty.games || []
    let confOffPOW = 0, confDefPOW = 0, nationalOffPOW = 0, nationalDefPOW = 0
    const confOffPOWGames = [], confDefPOWGames = [], nationalOffPOWGames = [], nationalDefPOWGames = []

    games.forEach(game => {
      if (game.conferencePOW === player.name) { confOffPOW++; confOffPOWGames.push(game) }
      if (game.confDefensePOW === player.name) { confDefPOW++; confDefPOWGames.push(game) }
      if (game.nationalPOW === player.name) { nationalOffPOW++; nationalOffPOWGames.push(game) }
      if (game.natlDefensePOW === player.name) { nationalDefPOW++; nationalDefPOWGames.push(game) }
    })

    // Total counts for backward compatibility
    const confPOW = confOffPOW + confDefPOW
    const nationalPOW = nationalOffPOW + nationalDefPOW
    const confPOWGames = [...confOffPOWGames, ...confDefPOWGames]
    const nationalPOWGames = [...nationalOffPOWGames, ...nationalDefPOWGames]

    return {
      confPOW, nationalPOW, confPOWGames, nationalPOWGames,
      confOffPOW, confDefPOW, nationalOffPOW, nationalDefPOW,
      confOffPOWGames, confDefPOWGames, nationalOffPOWGames, nationalDefPOWGames
    }
  }

  const powHonors = calculatePOWHonors()

  const handleAccoladeClick = (type) => {
    setAccoladeType(type)
    setShowAccoladeModal(true)
  }

  const getTeamNameFromAbbr = (abbr) => teamAbbreviations[abbr]?.name || abbr

  // Get all games where this player has box score stats
  const getPlayerGameLog = () => {
    const games = dynasty.games || []
    const playerName = player.name
    const gameLog = []

    games.forEach(game => {
      // Skip games without box scores or CPU games (different property structure)
      if (!game.boxScore || game.isCPUGame) return

      // Check both home and away box scores for this player
      const statCategories = ['passing', 'rushing', 'receiving', 'defense', 'kicking', 'blocking', 'punting', 'kickReturn', 'puntReturn']
      let playerStats = null
      let foundInTeam = null

      for (const side of ['home', 'away']) {
        if (!game.boxScore[side]) continue
        for (const category of statCategories) {
          const categoryStats = game.boxScore[side][category] || []
          const found = categoryStats.find(s => s.playerName === playerName)
          if (found) {
            playerStats = { ...found, category }
            foundInTeam = side
            break
          }
        }
        if (playerStats) break
      }

      if (playerStats) {
        gameLog.push({
          game,
          stats: playerStats,
          team: foundInTeam
        })
      }
    })

    // Sort by year desc, then week desc
    gameLog.sort((a, b) => {
      if (b.game.year !== a.game.year) return b.game.year - a.game.year
      return (b.game.week || 0) - (a.game.week || 0)
    })

    return gameLog
  }

  const playerGameLog = useMemo(() => getPlayerGameLog(), [dynasty.games, player.name])

  const handlePlayerSave = async (updatedPlayer, yearStats) => {
    await updatePlayer(dynastyId, updatedPlayer, yearStats)
    setShowEditModal(false)
  }

  // Get year-by-year stats for this player
  // Combines stats from box scores (game-by-game) with manually entered season stats
  // Box score stats take priority when available
  const yearByYearStats = useMemo(() => {
    const playerStatsByYear = dynasty.playerStatsByYear || {}
    const detailedStatsByYear = dynasty.detailedStatsByYear || {}
    const playerPid = player.pid

    // Get stats aggregated from box scores
    const boxScoreStats = getPlayerSeasonStatsFromBoxScores(dynasty, player)
    const boxScoreByYear = {}
    boxScoreStats.forEach(bs => {
      boxScoreByYear[bs.year] = bs
    })

    // Get all years that have any data for this player (from any source)
    const allYears = new Set([
      ...Object.keys(playerStatsByYear),
      ...Object.keys(detailedStatsByYear),
      ...Object.keys(boxScoreByYear)
    ])

    const years = []

    // Sort years chronologically
    const sortedYears = Array.from(allYears).sort((a, b) => parseInt(a) - parseInt(b))

    sortedYears.forEach(yearStr => {
      const year = parseInt(yearStr)
      const basicStats = playerStatsByYear[yearStr]?.find(p => p.pid === playerPid)
      const detailedYear = detailedStatsByYear[yearStr] || {}
      const boxStats = boxScoreByYear[year]

      // Find player in each stat category (manual entry)
      const findInTab = (tabName) => detailedYear[tabName]?.find(p =>
        p.name?.toLowerCase().trim() === player.name?.toLowerCase().trim()
      )

      // Helper to check if manual stats have any real values entered (not blank/null)
      // Only override box score data if user actually entered something
      const hasRealValues = (manualStats, fields) => {
        if (!manualStats) return false
        return fields.some(field => {
          const val = manualStats[field]
          return val !== null && val !== undefined && val !== '' && val !== 0
        })
      }

      const manualPassing = findInTab('Passing')
      const manualRushing = findInTab('Rushing')
      const manualReceiving = findInTab('Receiving')
      const manualBlocking = findInTab('Blocking')
      const manualDefensive = findInTab('Defensive')
      const manualKicking = findInTab('Kicking')
      const manualPunting = findInTab('Punting')
      const manualKickReturn = findInTab('Kick Return')
      const manualPuntReturn = findInTab('Punt Return')

      // Check if each category has real entered values (not just blank cells)
      const useManualPassing = hasRealValues(manualPassing, ['Completions', 'Attempts', 'Yards', 'Touchdowns'])
      const useManualRushing = hasRealValues(manualRushing, ['Carries', 'Yards', 'Touchdowns'])
      const useManualReceiving = hasRealValues(manualReceiving, ['Receptions', 'Yards', 'Touchdowns'])
      const useManualBlocking = hasRealValues(manualBlocking, ['Sacks Allowed'])
      const useManualDefensive = hasRealValues(manualDefensive, ['Solo Tackles', 'Assisted Tackles', 'Sacks', 'Interceptions'])
      const useManualKicking = hasRealValues(manualKicking, ['FG Made', 'FG Attempted', 'XP Made', 'XP Attempted'])
      const useManualPunting = hasRealValues(manualPunting, ['Punts', 'Punting Yards'])
      const useManualKickReturn = hasRealValues(manualKickReturn, ['Kickoff Returns', 'KR Yardage'])
      const useManualPuntReturn = hasRealValues(manualPuntReturn, ['Punt Returns', 'PR Yardage'])

      // Check if we have any data for this year
      const hasManualStats = basicStats || manualPassing || manualRushing || manualReceiving ||
        manualBlocking || manualDefensive || manualKicking || manualPunting || manualKickReturn || manualPuntReturn
      const hasBoxStats = boxStats && Object.keys(boxStats).some(k =>
        k !== 'year' && k !== 'gamesPlayed' && k !== 'fromBoxScores' && boxStats[k]
      )

      if (!hasManualStats && !hasBoxStats) return

      // Determine player's class for this year
      // Use basicStats if available, otherwise calculate from current class
      let playerClass = basicStats?.year || '-'
      if (playerClass === '-' && player.year) {
        // If this is the current dynasty year, use current class
        if (year === dynasty.currentYear) {
          playerClass = player.year
        } else {
          // For past years, calculate backwards from current class
          const classIndex = CLASS_ORDER.indexOf(player.year)
          const yearDiff = dynasty.currentYear - year
          if (classIndex >= 0 && classIndex - yearDiff >= 0) {
            playerClass = CLASS_ORDER[classIndex - yearDiff]
          }
        }
      }

      // Build year stats object - prefer detailed stats (manual entry) ONLY if real values entered, otherwise box score
      const yearData = {
        year,
        class: playerClass,
        // Use manual games played if available, otherwise box score
        gamesPlayed: basicStats?.gamesPlayed || boxStats?.gamesPlayed || 0,
        snapsPlayed: basicStats?.snapsPlayed || 0,
        fromBoxScores: !!boxStats && !basicStats,
        // Passing - only use detailed stats if user entered real values
        passing: useManualPassing ? {
          cmp: manualPassing['Completions'] || 0,
          att: manualPassing['Attempts'] || 0,
          yds: manualPassing['Yards'] || 0,
          td: manualPassing['Touchdowns'] || 0,
          int: manualPassing['Interceptions'] || 0,
          lng: manualPassing['Passing Long'] || 0,
          sacks: manualPassing['Sacks Taken'] || 0
        } : boxStats?.passing || null,
        // Rushing - only use detailed stats if user entered real values
        rushing: useManualRushing ? {
          car: manualRushing['Carries'] || 0,
          yds: manualRushing['Yards'] || 0,
          td: manualRushing['Touchdowns'] || 0,
          lng: manualRushing['Rushing Long'] || 0,
          fum: manualRushing['Fumbles'] || 0,
          bt: manualRushing['Broken Tackles'] || 0
        } : boxStats?.rushing || null,
        // Receiving - only use detailed stats if user entered real values
        receiving: useManualReceiving ? {
          rec: manualReceiving['Receptions'] || 0,
          yds: manualReceiving['Yards'] || 0,
          td: manualReceiving['Touchdowns'] || 0,
          lng: manualReceiving['Receiving Long'] || 0,
          drops: manualReceiving['Drops'] || 0
        } : boxStats?.receiving || null,
        // Blocking - only use detailed stats if user entered real values
        blocking: useManualBlocking ? {
          sacksAllowed: manualBlocking['Sacks Allowed'] || 0,
          pancakes: manualBlocking['Pancakes'] || 0
        } : (boxStats?.blocking || (basicStats && basicStats.snapsPlayed > 0 && ['LT', 'LG', 'C', 'RG', 'RT'].includes(basicStats.position || player.position) ? {
          sacksAllowed: 0
        } : null)),
        // Defensive - only use detailed stats if user entered real values
        defensive: useManualDefensive ? {
          solo: manualDefensive['Solo Tackles'] || 0,
          ast: manualDefensive['Assisted Tackles'] || 0,
          tfl: manualDefensive['Tackles for Loss'] || 0,
          sacks: manualDefensive['Sacks'] || 0,
          int: manualDefensive['Interceptions'] || 0,
          intYds: manualDefensive['INT Return Yards'] || 0,
          intTd: manualDefensive['Defensive TDs'] || 0,
          pdef: manualDefensive['Deflections'] || 0,
          ff: manualDefensive['Forced Fumbles'] || 0,
          fr: manualDefensive['Fumble Recoveries'] || 0
        } : boxStats?.defensive || null,
        // Kicking - only use detailed stats if user entered real values
        kicking: useManualKicking ? {
          fgm: manualKicking['FG Made'] || 0,
          fga: manualKicking['FG Attempted'] || 0,
          lng: manualKicking['FG Long'] || 0,
          xpm: manualKicking['XP Made'] || 0,
          xpa: manualKicking['XP Attempted'] || 0
        } : boxStats?.kicking || null,
        // Punting - only use detailed stats if user entered real values
        punting: useManualPunting ? {
          punts: manualPunting['Punts'] || 0,
          yds: manualPunting['Punting Yards'] || 0,
          lng: manualPunting['Punt Long'] || 0,
          in20: manualPunting['Punts Inside 20'] || 0,
          tb: manualPunting['Touchbacks'] || 0
        } : boxStats?.punting || null,
        // Kick Return - only use detailed stats if user entered real values
        kickReturn: useManualKickReturn ? {
          ret: manualKickReturn['Kickoff Returns'] || 0,
          yds: manualKickReturn['KR Yardage'] || 0,
          td: manualKickReturn['KR Touchdowns'] || 0,
          lng: manualKickReturn['KR Long'] || 0
        } : boxStats?.kickReturn || null,
        // Punt Return - only use detailed stats if user entered real values
        puntReturn: useManualPuntReturn ? {
          ret: manualPuntReturn['Punt Returns'] || 0,
          yds: manualPuntReturn['PR Yardage'] || 0,
          td: manualPuntReturn['PR Touchdowns'] || 0,
          lng: manualPuntReturn['PR Long'] || 0
        } : boxStats?.puntReturn || null
      }

      years.push(yearData)
    })

    return years
  }, [dynasty, player])

  // Calculate career totals
  const calculateCareerTotals = (years, statKey, fields) => {
    const totals = {}
    fields.forEach(field => {
      if (field === 'lng') {
        // Take max for long fields
        totals[field] = Math.max(...years.filter(y => y[statKey]).map(y => y[statKey][field] || 0), 0)
      } else {
        // Sum everything else
        totals[field] = years.filter(y => y[statKey]).reduce((sum, y) => sum + (y[statKey][field] || 0), 0)
      }
    })
    return totals
  }

  // Helper to check if a stat object has any meaningful (non-zero) values
  const hasNonZeroStats = (statObj, keys) => {
    if (!statObj) return false
    return keys.some(key => (statObj[key] || 0) > 0)
  }

  // Check which stat categories this player has actual recorded stats for
  const hasStats = {
    passing: yearByYearStats.some(y => y.passing && hasNonZeroStats(y.passing, ['att', 'cmp', 'yds', 'td'])),
    rushing: yearByYearStats.some(y => y.rushing && hasNonZeroStats(y.rushing, ['car', 'yds', 'td'])),
    receiving: yearByYearStats.some(y => y.receiving && hasNonZeroStats(y.receiving, ['rec', 'yds', 'td'])),
    blocking: yearByYearStats.some(y => y.blocking && hasNonZeroStats(y.blocking, ['sacksAllowed', 'pancakes'])),
    defensive: yearByYearStats.some(y => y.defensive && hasNonZeroStats(y.defensive, ['solo', 'ast', 'tfl', 'sacks', 'int', 'pdef', 'ff', 'fr'])),
    kicking: yearByYearStats.some(y => y.kicking && hasNonZeroStats(y.kicking, ['fgm', 'fga', 'xpm', 'xpa'])),
    punting: yearByYearStats.some(y => y.punting && hasNonZeroStats(y.punting, ['punts', 'yds'])),
    kickReturn: yearByYearStats.some(y => y.kickReturn && hasNonZeroStats(y.kickReturn, ['ret', 'yds', 'td'])),
    puntReturn: yearByYearStats.some(y => y.puntReturn && hasNonZeroStats(y.puntReturn, ['ret', 'yds', 'td']))
  }

  // Calculate averages
  const calcPct = (a, b) => b > 0 ? (a / b * 100).toFixed(1) : '0.0'
  const calcAvg = (a, b) => b > 0 ? (a / b).toFixed(1) : '0.0'

  // Career totals for each stat category
  const careerPassing = hasStats.passing ? calculateCareerTotals(yearByYearStats, 'passing', ['cmp', 'att', 'yds', 'td', 'int', 'lng', 'sacks']) : null
  const careerRushing = hasStats.rushing ? calculateCareerTotals(yearByYearStats, 'rushing', ['car', 'yds', 'td', 'lng', 'fum', 'bt']) : null
  const careerReceiving = hasStats.receiving ? calculateCareerTotals(yearByYearStats, 'receiving', ['rec', 'yds', 'td', 'lng', 'drops']) : null
  const careerBlocking = hasStats.blocking ? calculateCareerTotals(yearByYearStats, 'blocking', ['sacksAllowed']) : null
  const careerDefensive = hasStats.defensive ? calculateCareerTotals(yearByYearStats, 'defensive', ['solo', 'ast', 'tfl', 'sacks', 'int', 'intYds', 'intTd', 'pdef', 'ff', 'fr']) : null
  const careerKicking = hasStats.kicking ? calculateCareerTotals(yearByYearStats, 'kicking', ['fgm', 'fga', 'lng', 'xpm', 'xpa']) : null
  const careerPunting = hasStats.punting ? calculateCareerTotals(yearByYearStats, 'punting', ['punts', 'yds', 'lng', 'in20', 'tb']) : null
  const careerKickReturn = hasStats.kickReturn ? calculateCareerTotals(yearByYearStats, 'kickReturn', ['ret', 'yds', 'td', 'lng']) : null
  const careerPuntReturn = hasStats.puntReturn ? calculateCareerTotals(yearByYearStats, 'puntReturn', ['ret', 'yds', 'td', 'lng']) : null

  // Total games and snaps
  const careerGames = yearByYearStats.reduce((sum, y) => sum + (y.gamesPlayed || 0), 0)
  const careerSnaps = yearByYearStats.reduce((sum, y) => sum + (y.snapsPlayed || 0), 0)

  // Get game log for the expanded year
  const gameLog = useMemo(() => {
    if (!expandedGameLogYear || !player?.name) return []
    return getPlayerGameLog(dynasty, player.name, expandedGameLogYear, teamAbbr)
  }, [expandedGameLogYear, dynasty, player?.name, teamAbbr])

  // Helper to toggle game log
  const toggleGameLog = (year) => {
    setExpandedGameLogYear(expandedGameLogYear === year ? null : year)
  }

  // Game log row component
  const renderGameLogRow = (year, colSpan) => {
    if (expandedGameLogYear !== year) return null

    return (
      <tr>
        <td colSpan={colSpan} className="p-0">
          <div className="bg-gray-100 border-t border-b border-gray-300 p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2 uppercase">Game Log - {year}</div>
            {gameLog.length === 0 ? (
              <div className="text-xs text-gray-500 italic">No game data available</div>
            ) : (
              <div className="space-y-1">
                {gameLog.map((game, idx) => {
                  const oppMascot = getMascotName(game.opponent)
                  const oppLogo = oppMascot ? getTeamLogo(oppMascot) : null
                  const isWin = game.result === 'win' || game.result === 'W'
                  return (
                    <Link
                      key={idx}
                      to={`${pathPrefix}/game/${game.gameId}`}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-200 transition-colors"
                    >
                      <span className="text-xs font-medium text-gray-500 w-10">
                        {game.week ? `Wk ${game.week}` : '-'}
                      </span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isWin ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {isWin ? 'W' : 'L'}
                      </span>
                      <span className="text-xs text-gray-600">{game.teamScore}-{game.opponentScore}</span>
                      {oppLogo && <img src={oppLogo} alt="" className="w-4 h-4 object-contain" />}
                      <span className="text-xs font-medium text-gray-700">{oppMascot || game.opponent}</span>
                      {/* Show key stats */}
                      <span className="text-xs text-gray-500 ml-auto">
                        {game.passing && `${game.passing.yards || 0} pass yds`}
                        {game.rushing && `${game.rushing.yards || 0} rush yds`}
                        {game.receiving && `${game.receiving.receptions || 0} rec, ${game.receiving.yards || 0} yds`}
                        {game.defense && `${(game.defense.solo || 0) + (game.defense.assists || 0)} tkl`}
                        {game.kicking && `${game.kicking.fGM || 0}/${game.kicking.fGA || 0} FG`}
                        {game.punting && `${game.punting.punts || 0} punts`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </td>
      </tr>
    )
  }

  // Check if player has any meaningful stats (non-zero games or any stat category with data)
  // Recruits never show stats - they haven't enrolled yet
  const hasMeaningfulStats = !player.isRecruit && (
    careerGames > 0 || careerSnaps > 0 || Object.values(hasStats).some(v => v)
  )

  // Get recruitment info for recruits from the recruiting commitments data
  const getRecruitmentInfo = () => {
    if (!player.isRecruit) return null
    const recruitYear = player.recruitYear || dynasty.currentYear
    const commitments = dynasty.recruitingCommitmentsByTeamYear?.[playerTeamAbbr]?.[recruitYear] || {}

    // Search through all commitment weeks for this player
    for (const [, weekCommits] of Object.entries(commitments)) {
      if (Array.isArray(weekCommits)) {
        const found = weekCommits.find(c => c.name?.toLowerCase().trim() === player.name?.toLowerCase().trim())
        if (found) return found
      }
    }
    return null
  }
  const recruitmentInfo = getRecruitmentInfo()

  return (
    <div className="space-y-6">
      {/* Player Header */}
      <div
        className="rounded-lg shadow-lg p-4 sm:p-6"
        style={{ backgroundColor: teamColors.primary, border: `3px solid ${teamColors.secondary}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {player.pictureUrl && (
              <img
                src={player.pictureUrl}
                alt={player.name}
                className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg border-2 flex-shrink-0"
                style={{ borderColor: teamColors.secondary }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate" style={{ color: primaryText }}>
                  {player.name}
                </h1>
                {playerGameLog.length > 0 && (
                  <button
                    onClick={() => setShowGameLogModal(true)}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
                    style={{ color: primaryText }}
                    title="Game Log"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </button>
                )}
                {!isViewOnly && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
                    style={{ color: primaryText }}
                    title="Edit Player"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {!isViewOnly && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
                    style={{ color: '#EF4444' }}
                    title="Delete Player"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Link
                  to={`${pathPrefix}/team/${teamAbbr}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                  style={{ color: primaryText, opacity: 0.9 }}
                >
                  {getTeamLogo(playerTeamName) && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', padding: '3px' }}>
                      <img src={getTeamLogo(playerTeamName)} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                  {playerTeamName}
                </Link>
                {player.isRecruit && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: teamColors.secondary, color: secondaryText }}
                  >
                    Commitment
                  </span>
                )}
                {player.leftTeam && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: '#6b7280', color: '#ffffff' }}
                  >
                    {player.leftReason === 'Pro Draft' && player.draftRound
                      ? `${player.leftYear} NFL Draft - ${player.draftRound}`
                      : player.leftReason === 'Pro Draft'
                      ? `${player.leftYear} NFL Draft`
                      : player.leftReason === 'Graduating'
                      ? `Graduated (${player.leftYear})`
                      : player.leftReason === 'Transfer' || player.leftReason === 'Encouraged Transfer'
                      ? `Transferred (${player.leftYear})`
                      : ['Playing Style', 'Proximity to Home', 'Championship Contender', 'Program Tradition',
                         'Campus Lifestyle', 'Stadium Atmosphere', 'Pro Potential', 'Brand Exposure',
                         'Academic Prestige', 'Conference Prestige', 'Coach Stability', 'Coach Prestige',
                         'Athletic Facilities'].includes(player.leftReason)
                      ? `Transfer: ${player.leftReason} (${player.leftYear})`
                      : player.leftReason
                      ? `${player.leftReason} (${player.leftYear})`
                      : `Left Team (${player.leftYear})`}
                  </span>
                )}
                {player.transferredTo && (() => {
                  const newTeamName = getMascotName(player.transferredTo) || teamAbbreviations[player.transferredTo]?.name || player.transferredTo
                  const newTeamColors = getTeamColors(newTeamName) || { primary: '#4b5563', secondary: '#6b7280' }
                  const newTeamTextColor = getContrastTextColor(newTeamColors.primary)
                  return (
                    <Link
                      to={`${pathPrefix}/team/${player.transferredTo}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: newTeamColors.primary, color: newTeamTextColor }}
                    >
                      <span>→</span>
                      {getTeamLogo(newTeamName) && (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', padding: '2px' }}>
                          <img src={getTeamLogo(newTeamName)} alt="" className="w-full h-full object-contain" />
                        </div>
                      )}
                      <span>{player.transferredTo}</span>
                    </Link>
                  )
                })()}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: primaryText, opacity: 0.85 }}>
                {player.jerseyNumber != null && player.jerseyNumber !== '' && <span className="font-bold">#{player.jerseyNumber}</span>}
                {player.jerseyNumber != null && player.jerseyNumber !== '' && <span className="opacity-50">|</span>}
                <span className="font-semibold">{player.position}</span>
                {player.archetype && <><span className="opacity-50">|</span><span>{player.archetype}</span></>}
                <span className="opacity-50">|</span>
                <span>{player.year}</span>
                {player.devTrait && <><span className="opacity-50">|</span><span>{player.devTrait}</span></>}
                {(player.height || player.weight) && (
                  <><span className="opacity-50">|</span><span>{player.height}{player.height && player.weight && ', '}{player.weight ? `${player.weight} lbs` : ''}</span></>
                )}
                {(player.hometown || player.state) && (
                  <><span className="opacity-50">|</span><span>{player.hometown}{player.hometown && player.state && ', '}{player.state}</span></>
                )}
              </div>
            </div>
          </div>

          {/* Overall Rating */}
          {player.overall ? (
            <div className="text-center flex-shrink-0">
              <div className="text-xs mb-1" style={{ color: primaryText, opacity: 0.7 }}>OVR</div>
              <button
                onClick={() => setShowOverallProgressionModal(true)}
                className="text-5xl md:text-6xl font-bold hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: primaryText }}
                title="View overall progression"
              >
                {player.overall}
              </button>
            </div>
          ) : (
            <div className="text-center flex-shrink-0">
              <div className="text-xs mb-1" style={{ color: primaryText, opacity: 0.7 }}>OVR</div>
              <div
                className="text-5xl md:text-6xl font-bold"
                style={{ color: primaryText, opacity: 0.3 }}
              >
                —
              </div>
            </div>
          )}
        </div>
      </div>

      {/* POW Accolades */}
      {(powHonors.confPOW > 0 || powHonors.nationalPOW > 0) && (
        <div className="flex flex-wrap gap-2">
          {powHonors.confPOW > 0 && (
            <button
              onClick={() => handleAccoladeClick('confPOW')}
              className="px-4 py-2 rounded-full font-semibold text-sm hover:opacity-80 transition-opacity"
              style={{ backgroundColor: teamColors.primary, color: primaryText }}
            >
              Conference POW {powHonors.confPOW}x
            </button>
          )}
          {powHonors.nationalPOW > 0 && (
            <button
              onClick={() => handleAccoladeClick('nationalPOW')}
              className="px-4 py-2 rounded-full font-semibold text-sm hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#fbbf24', color: '#78350f' }}
            >
              National POW {powHonors.nationalPOW}x
            </button>
          )}
        </div>
      )}

      {/* Career Honors (Awards, All-Americans, All-Conference) */}
      {((player.awards && player.awards.length > 0) ||
        (player.allAmericans && player.allAmericans.length > 0) ||
        (player.allConference && player.allConference.length > 0)) && (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{ backgroundColor: teamColors.secondary, border: `3px solid ${teamColors.primary}` }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: secondaryText }}>Career Honors</h2>

          {/* Awards */}
          {player.awards && player.awards.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: secondaryText, opacity: 0.7 }}>Awards</h3>
              <div className="flex flex-wrap gap-2">
                {player.awards.map((award, idx) => {
                  // Format award name nicely
                  const awardName = award.award
                    ? award.award.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
                    : 'Award'
                  const badgeText = getContrastTextColor(teamColors.primary)
                  return (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: teamColors.primary, color: badgeText }}
                    >
                      <div className="font-bold">{awardName}</div>
                      <div className="text-xs opacity-80">{award.year} • {award.team}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All-Americans */}
          {player.allAmericans && player.allAmericans.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: secondaryText, opacity: 0.7 }}>All-American</h3>
              <div className="flex flex-wrap gap-2">
                {player.allAmericans.map((aa, idx) => {
                  const designation = aa.designation === 'first' ? '1st Team' :
                                      aa.designation === 'second' ? '2nd Team' : 'Freshman'
                  const badgeColor = aa.designation === 'first' ? teamColors.primary :
                                     aa.designation === 'second' ? '#6B7280' : '#3B82F6'
                  const badgeText = getContrastTextColor(badgeColor)
                  return (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: badgeColor, color: badgeText }}
                    >
                      <div className="font-bold">{designation} All-American</div>
                      <div className="text-xs opacity-80">{aa.year} • {aa.position} • {aa.school}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All-Conference */}
          {player.allConference && player.allConference.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: secondaryText, opacity: 0.7 }}>All-Conference</h3>
              <div className="flex flex-wrap gap-2">
                {player.allConference.map((ac, idx) => {
                  const designation = ac.designation === 'first' ? '1st Team' :
                                      ac.designation === 'second' ? '2nd Team' : 'Freshman'
                  const badgeColor = ac.designation === 'first' ? teamColors.primary :
                                     ac.designation === 'second' ? '#6B7280' : '#3B82F6'
                  const badgeText = getContrastTextColor(badgeColor)
                  return (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: badgeColor, color: badgeText }}
                    >
                      <div className="font-bold">{designation} All-Conference</div>
                      <div className="text-xs opacity-80">{ac.year} • {ac.position} • {ac.school}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recruitment Information - Compact display for recruits without stats */}
      {player.isRecruit && !hasMeaningfulStats && recruitmentInfo && (
        <div
          className="rounded-lg shadow px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Recruit Year */}
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ backgroundColor: teamColors.primary, color: primaryText }}
            >
              {player.recruitYear || dynasty.currentYear} Recruit
            </span>
            {/* Stars */}
            {recruitmentInfo.stars && (
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" fill={i < Number(recruitmentInfo.stars) ? '#FFD700' : '#D1D5DB'} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}
            {/* Rankings inline */}
            {recruitmentInfo.nationalRank && (
              <span className="font-semibold" style={{ color: secondaryText }}>
                #{recruitmentInfo.nationalRank} <span style={{ opacity: 0.6 }}>Nat'l</span>
              </span>
            )}
            {recruitmentInfo.positionRank && (
              <span className="font-semibold" style={{ color: secondaryText }}>
                #{recruitmentInfo.positionRank} <span style={{ opacity: 0.6 }}>{player.position}</span>
              </span>
            )}
            {recruitmentInfo.stateRank && (
              <span className="font-semibold" style={{ color: secondaryText }}>
                #{recruitmentInfo.stateRank} <span style={{ opacity: 0.6 }}>{recruitmentInfo.state || player.state}</span>
              </span>
            )}
            {recruitmentInfo.previousTeam && (
              <span style={{ color: secondaryText }}>
                <span style={{ opacity: 0.6 }}>from</span> <span className="font-semibold">{recruitmentInfo.previousTeam}</span>
              </span>
            )}
            {recruitmentInfo.gemBust && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: recruitmentInfo.gemBust.toLowerCase() === 'gem' ? '#10B981' : '#EF4444',
                  color: 'white'
                }}
              >
                {recruitmentInfo.gemBust.toLowerCase() === 'gem' ? '💎 Gem' : '💥 Bust'}
              </span>
            )}
          </div>
          <Link
            to={`${pathPrefix}/recruiting/${playerTeamAbbr}/${player.recruitYear || dynasty.currentYear}`}
            className="text-sm font-medium hover:underline"
            style={{ color: teamColors.primary }}
          >
            View Class →
          </Link>
        </div>
      )}

      {/* Career Statistics - Football Reference Style */}
      {hasMeaningfulStats && (() => {
        const primaryStat = getPrimaryStatCategory(player.position)
        return (
        <div className="space-y-6">
          {/* Passing Table */}
          {hasStats.passing && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Passing</h3>
              </div>
              {(() => {
                const passingYears = yearByYearStats.filter(y => y.passing && hasNonZeroStats(y.passing, ['att', 'cmp', 'yds', 'td']))
                const hasAnySnaps = passingYears.some(y => y.snapsPlayed > 0)
                const showSnapsCol = primaryStat === 'passing' && hasAnySnaps

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                          {primaryStat === 'passing' && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">G</th>}
                          {showSnapsCol && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Snaps</th>}
                          {['Cmp', 'Att', 'Pct', 'Yds', 'Y/A', 'TD', 'Int', 'Lng', 'Sck'].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {passingYears.map((y, idx) => {
                          const mascot = getMascotName(teamAbbr)
                          const logo = mascot ? getTeamLogo(mascot) : null
                          const colSpan = 12 + (primaryStat === 'passing' ? 1 : 0) + (showSnapsCol ? 1 : 0)
                          return (
                            <React.Fragment key={y.year}>
                              <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                                <td
                                  className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                                  onClick={() => toggleGameLog(y.year)}
                                  title="Click to view game log"
                                >
                                  {y.year}
                                  {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                                </td>
                                <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                                <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                                {primaryStat === 'passing' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                                {showSnapsCol && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                                <td className="px-2 py-2 text-right">{y.passing.cmp}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.passing.att}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{calcPct(y.passing.cmp, y.passing.att)}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.passing.yds.toLocaleString()}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.passing.yds, y.passing.att)}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.passing.td}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.passing.int}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.passing.lng}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.passing.sacks}</td>
                              </tr>
                              {renderGameLogRow(y.year, colSpan)}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                          <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                          <td className="px-2 py-2 w-16"></td>
                          <td className="px-2 py-2 w-12"></td>
                          {primaryStat === 'passing' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                          {showSnapsCol && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{careerPassing.cmp}</td>
                          <td className="px-2 py-2 text-right">{careerPassing.att}</td>
                          <td className="px-2 py-2 text-right">{calcPct(careerPassing.cmp, careerPassing.att)}</td>
                          <td className="px-2 py-2 text-right">{careerPassing.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right">{calcAvg(careerPassing.yds, careerPassing.att)}</td>
                          <td className="px-2 py-2 text-right">{careerPassing.td}</td>
                          <td className="px-2 py-2 text-right">{careerPassing.int}</td>
                          <td className="px-2 py-2 text-right">{careerPassing.lng}</td>
                          <td className="px-2 py-2 text-right">{careerPassing.sacks}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Rushing Table */}
          {hasStats.rushing && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Rushing</h3>
              </div>
              {(() => {
                const rushingYears = yearByYearStats.filter(y => y.rushing && hasNonZeroStats(y.rushing, ['car', 'yds', 'td']))
                const hasAnySnaps = rushingYears.some(y => y.snapsPlayed > 0)
                const showSnapsCol = primaryStat === 'rushing' && hasAnySnaps

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                          {primaryStat === 'rushing' && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">G</th>}
                          {showSnapsCol && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Snaps</th>}
                          {['Car', 'Yds', 'Y/C', 'TD', 'Lng', 'Fum', 'BTkl'].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rushingYears.map((y, idx) => {
                          const mascot = getMascotName(teamAbbr)
                          const logo = mascot ? getTeamLogo(mascot) : null
                          const colSpan = 10 + (primaryStat === 'rushing' ? 1 : 0) + (showSnapsCol ? 1 : 0)
                          return (
                            <React.Fragment key={y.year}>
                              <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                                <td
                                  className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                                  onClick={() => toggleGameLog(y.year)}
                                  title="Click to view game log"
                                >
                                  {y.year}
                                  {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                                </td>
                                <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                                <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                                {primaryStat === 'rushing' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                                {showSnapsCol && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                                <td className="px-2 py-2 text-right">{y.rushing.car}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.rushing.yds.toLocaleString()}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.rushing.yds, y.rushing.car)}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.rushing.td}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.rushing.lng}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.rushing.fum}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.rushing.bt}</td>
                              </tr>
                              {renderGameLogRow(y.year, colSpan)}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                          <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                          <td className="px-2 py-2 w-16"></td>
                          <td className="px-2 py-2 w-12"></td>
                          {primaryStat === 'rushing' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                          {showSnapsCol && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{careerRushing.car}</td>
                          <td className="px-2 py-2 text-right">{careerRushing.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right">{calcAvg(careerRushing.yds, careerRushing.car)}</td>
                          <td className="px-2 py-2 text-right">{careerRushing.td}</td>
                          <td className="px-2 py-2 text-right">{careerRushing.lng}</td>
                          <td className="px-2 py-2 text-right">{careerRushing.fum}</td>
                          <td className="px-2 py-2 text-right">{careerRushing.bt}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Receiving Table */}
          {hasStats.receiving && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Receiving</h3>
              </div>
              {(() => {
                // Check if any receiving year has non-zero snaps
                const receivingYears = yearByYearStats.filter(y => y.receiving && hasNonZeroStats(y.receiving, ['rec', 'yds', 'td']))
                const hasAnySnaps = receivingYears.some(y => y.snapsPlayed > 0)
                const showSnapsCol = primaryStat === 'receiving' && hasAnySnaps

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                          {primaryStat === 'receiving' && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">G</th>}
                          {showSnapsCol && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Snaps</th>}
                          {['Rec', 'Yds', 'Y/R', 'TD', 'Lng', 'Drops'].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {receivingYears.map((y, idx) => {
                          const mascot = getMascotName(teamAbbr)
                          const logo = mascot ? getTeamLogo(mascot) : null
                          const colSpan = 9 + (primaryStat === 'receiving' ? 1 : 0) + (showSnapsCol ? 1 : 0)
                          return (
                            <React.Fragment key={y.year}>
                              <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                                <td
                                  className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                                  onClick={() => toggleGameLog(y.year)}
                                  title="Click to view game log"
                                >
                                  {y.year}
                                  {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                                </td>
                                <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                                <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                                {primaryStat === 'receiving' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                                {showSnapsCol && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                                <td className="px-2 py-2 text-right">{y.receiving.rec}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.receiving.yds.toLocaleString()}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.receiving.yds, y.receiving.rec)}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.receiving.td}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.receiving.lng}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.receiving.drops}</td>
                              </tr>
                              {renderGameLogRow(y.year, colSpan)}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                          <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                          <td className="px-2 py-2 w-16"></td>
                          <td className="px-2 py-2 w-12"></td>
                          {primaryStat === 'receiving' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                          {showSnapsCol && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{careerReceiving.rec}</td>
                          <td className="px-2 py-2 text-right">{careerReceiving.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right">{calcAvg(careerReceiving.yds, careerReceiving.rec)}</td>
                          <td className="px-2 py-2 text-right">{careerReceiving.td}</td>
                          <td className="px-2 py-2 text-right">{careerReceiving.lng}</td>
                          <td className="px-2 py-2 text-right">{careerReceiving.drops}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Blocking Table - Only show for TE and OL positions */}
          {hasStats.blocking && ['TE', 'LT', 'LG', 'C', 'RG', 'RT'].includes(player.position?.toUpperCase()) && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Blocking</h3>
              </div>
              {(() => {
                const blockingYears = yearByYearStats.filter(y => y.blocking && hasNonZeroStats(y.blocking, ['sacksAllowed', 'pancakes']))
                const hasAnySnaps = blockingYears.some(y => (y.snapsPlayed || 0) > 0)
                const showSnapsCol = primaryStat === 'blocking' && hasAnySnaps

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                          {primaryStat === 'blocking' && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">G</th>}
                          {showSnapsCol && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Snaps</th>}
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Sacks Allowed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {blockingYears.map((y, idx) => {
                          const mascot = getMascotName(teamAbbr)
                          const logo = mascot ? getTeamLogo(mascot) : null
                          const colSpan = 4 + (primaryStat === 'blocking' ? 1 : 0) + (showSnapsCol ? 1 : 0)
                          return (
                            <React.Fragment key={y.year}>
                              <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                                <td
                                  className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                                  onClick={() => toggleGameLog(y.year)}
                                  title="Click to view game log"
                                >
                                  {y.year}
                                  {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                                </td>
                                <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                                <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                                {primaryStat === 'blocking' && <td className="px-2 py-2 text-right">{y.gamesPlayed || 0}</td>}
                                {showSnapsCol && <td className="px-2 py-2 text-right text-gray-500">{(y.snapsPlayed || 0).toLocaleString()}</td>}
                                <td className="px-2 py-2 text-right font-medium">{y.blocking.sacksAllowed}</td>
                              </tr>
                              {renderGameLogRow(y.year, colSpan)}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                          <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                          <td className="px-2 py-2 w-16"></td>
                          <td className="px-2 py-2 w-12"></td>
                          {primaryStat === 'blocking' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                          {showSnapsCol && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{careerBlocking.sacksAllowed}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Defense Table */}
          {hasStats.defensive && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Defense</h3>
              </div>
              {(() => {
                const defenseYears = yearByYearStats.filter(y => y.defensive && hasNonZeroStats(y.defensive, ['solo', 'ast', 'tfl', 'sacks', 'int', 'pdef', 'ff', 'fr']))
                const hasAnySnaps = defenseYears.some(y => y.snapsPlayed > 0)
                const showSnapsCol = primaryStat === 'defense' && hasAnySnaps

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                          {primaryStat === 'defense' && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">G</th>}
                          {showSnapsCol && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Snaps</th>}
                          {['Solo', 'Ast', 'Tot', 'TFL', 'Sck', 'Int', 'IntYd', 'TD', 'PD', 'FF', 'FR'].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {defenseYears.map((y, idx) => {
                          const mascot = getMascotName(teamAbbr)
                          const logo = mascot ? getTeamLogo(mascot) : null
                          const colSpan = 14 + (primaryStat === 'defense' ? 1 : 0) + (showSnapsCol ? 1 : 0)
                          return (
                            <React.Fragment key={y.year}>
                              <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                                <td
                                  className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                                  onClick={() => toggleGameLog(y.year)}
                                  title="Click to view game log"
                                >
                                  {y.year}
                                  {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                                </td>
                                <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                                <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                                {primaryStat === 'defense' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                                {showSnapsCol && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                                <td className="px-2 py-2 text-right text-gray-500">{y.defensive.solo}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.defensive.ast}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.defensive.solo + y.defensive.ast}</td>
                                <td className="px-2 py-2 text-right">{y.defensive.tfl}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.defensive.sacks}</td>
                                <td className="px-2 py-2 text-right">{y.defensive.int}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.defensive.intYds}</td>
                                <td className="px-2 py-2 text-right">{y.defensive.intTd}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.defensive.pdef}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.defensive.ff}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.defensive.fr}</td>
                              </tr>
                              {renderGameLogRow(y.year, colSpan)}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                          <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                          <td className="px-2 py-2 w-16"></td>
                          <td className="px-2 py-2 w-12"></td>
                          {primaryStat === 'defense' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                          {showSnapsCol && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{careerDefensive.solo}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.ast}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.solo + careerDefensive.ast}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.tfl}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.sacks}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.int}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.intYds}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.intTd}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.pdef}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.ff}</td>
                          <td className="px-2 py-2 text-right">{careerDefensive.fr}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Kicking Table */}
          {hasStats.kicking && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Kicking</h3>
              </div>
              {(() => {
                const kickingYears = yearByYearStats.filter(y => y.kicking && hasNonZeroStats(y.kicking, ['fgm', 'fga', 'xpm', 'xpa']))
                const hasAnySnaps = kickingYears.some(y => y.snapsPlayed > 0)
                const showSnapsCol = primaryStat === 'kicking' && hasAnySnaps

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                          {primaryStat === 'kicking' && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">G</th>}
                          {showSnapsCol && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Snaps</th>}
                          {['FGM', 'FGA', 'FG%', 'Lng', 'XPM', 'XPA', 'XP%'].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {kickingYears.map((y, idx) => {
                          const mascot = getMascotName(teamAbbr)
                          const logo = mascot ? getTeamLogo(mascot) : null
                          const colSpan = 10 + (primaryStat === 'kicking' ? 1 : 0) + (showSnapsCol ? 1 : 0)
                          return (
                            <React.Fragment key={y.year}>
                              <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                                <td
                                  className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                                  onClick={() => toggleGameLog(y.year)}
                                  title="Click to view game log"
                                >
                                  {y.year}
                                  {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                                </td>
                                <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                                <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                                {primaryStat === 'kicking' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                                {showSnapsCol && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                                <td className="px-2 py-2 text-right font-medium">{y.kicking.fgm}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.kicking.fga}</td>
                                <td className="px-2 py-2 text-right">{calcPct(y.kicking.fgm, y.kicking.fga)}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.kicking.lng}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.kicking.xpm}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.kicking.xpa}</td>
                                <td className="px-2 py-2 text-right">{calcPct(y.kicking.xpm, y.kicking.xpa)}</td>
                              </tr>
                              {renderGameLogRow(y.year, colSpan)}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                          <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                          <td className="px-2 py-2 w-16"></td>
                          <td className="px-2 py-2 w-12"></td>
                          {primaryStat === 'kicking' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                          {showSnapsCol && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{careerKicking.fgm}</td>
                          <td className="px-2 py-2 text-right">{careerKicking.fga}</td>
                          <td className="px-2 py-2 text-right">{calcPct(careerKicking.fgm, careerKicking.fga)}</td>
                          <td className="px-2 py-2 text-right">{careerKicking.lng}</td>
                          <td className="px-2 py-2 text-right">{careerKicking.xpm}</td>
                          <td className="px-2 py-2 text-right">{careerKicking.xpa}</td>
                          <td className="px-2 py-2 text-right">{calcPct(careerKicking.xpm, careerKicking.xpa)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Punting Table */}
          {hasStats.punting && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Punting</h3>
              </div>
              {(() => {
                const puntingYears = yearByYearStats.filter(y => y.punting && hasNonZeroStats(y.punting, ['punts', 'yds']))
                const hasAnySnaps = puntingYears.some(y => y.snapsPlayed > 0)
                const showSnapsCol = primaryStat === 'punting' && hasAnySnaps

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                          {primaryStat === 'punting' && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">G</th>}
                          {showSnapsCol && <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">Snaps</th>}
                          {['Punts', 'Yds', 'Avg', 'Lng', 'In20', 'TB'].map((h, i) => (
                            <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {puntingYears.map((y, idx) => {
                          const mascot = getMascotName(teamAbbr)
                          const logo = mascot ? getTeamLogo(mascot) : null
                          const colSpan = 9 + (primaryStat === 'punting' ? 1 : 0) + (showSnapsCol ? 1 : 0)
                          return (
                            <React.Fragment key={y.year}>
                              <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                                <td
                                  className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                                  onClick={() => toggleGameLog(y.year)}
                                  title="Click to view game log"
                                >
                                  {y.year}
                                  {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                                </td>
                                <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                                <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                                {primaryStat === 'punting' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                                {showSnapsCol && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                                <td className="px-2 py-2 text-right">{y.punting.punts}</td>
                                <td className="px-2 py-2 text-right font-medium">{y.punting.yds.toLocaleString()}</td>
                                <td className="px-2 py-2 text-right font-medium">{calcAvg(y.punting.yds, y.punting.punts)}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.punting.lng}</td>
                                <td className="px-2 py-2 text-right">{y.punting.in20}</td>
                                <td className="px-2 py-2 text-right text-gray-500">{y.punting.tb}</td>
                              </tr>
                              {renderGameLogRow(y.year, colSpan)}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                          <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                          <td className="px-2 py-2 w-16"></td>
                          <td className="px-2 py-2 w-12"></td>
                          {primaryStat === 'punting' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                          {showSnapsCol && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{careerPunting.punts}</td>
                          <td className="px-2 py-2 text-right">{careerPunting.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right">{calcAvg(careerPunting.yds, careerPunting.punts)}</td>
                          <td className="px-2 py-2 text-right">{careerPunting.lng}</td>
                          <td className="px-2 py-2 text-right">{careerPunting.in20}</td>
                          <td className="px-2 py-2 text-right">{careerPunting.tb}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Kick Returns Table */}
          {hasStats.kickReturn && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Kick Returns</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                      <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                      <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                      {['Ret', 'Yds', 'Avg', 'TD', 'Lng'].map((h, i) => (
                        <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.kickReturn && hasNonZeroStats(y.kickReturn, ['ret', 'yds', 'td'])).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      const colSpan = 8
                      return (
                        <React.Fragment key={y.year}>
                          <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                            <td
                              className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => toggleGameLog(y.year)}
                              title="Click to view game log"
                            >
                              {y.year}
                              {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                            </td>
                            <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                            <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                            <td className="px-2 py-2 text-right">{y.kickReturn.ret}</td>
                            <td className="px-2 py-2 text-right font-medium">{y.kickReturn.yds}</td>
                            <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.kickReturn.yds, y.kickReturn.ret)}</td>
                            <td className="px-2 py-2 text-right font-medium">{y.kickReturn.td}</td>
                            <td className="px-2 py-2 text-right text-gray-500">{y.kickReturn.lng}</td>
                          </tr>
                          {renderGameLogRow(y.year, colSpan)}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                      <td className="px-2 py-2 w-16"></td>
                      <td className="px-2 py-2 w-12"></td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.ret}</td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.yds}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerKickReturn.yds, careerKickReturn.ret)}</td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.td}</td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.lng}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Punt Returns Table */}
          {hasStats.puntReturn && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Punt Returns</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-14">Year</th>
                      <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-left w-16">Class</th>
                      <th className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-center w-12">Team</th>
                      {['Ret', 'Yds', 'Avg', 'TD', 'Lng'].map((h, i) => (
                        <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.puntReturn && hasNonZeroStats(y.puntReturn, ['ret', 'yds', 'td'])).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      const colSpan = 8
                      return (
                        <React.Fragment key={y.year}>
                          <tr className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${expandedGameLogYear === y.year ? 'bg-blue-50' : ''}`}>
                            <td
                              className="px-2 py-2 font-medium text-gray-900 w-14 cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => toggleGameLog(y.year)}
                              title="Click to view game log"
                            >
                              {y.year}
                              {expandedGameLogYear === y.year && <span className="ml-1 text-xs">▼</span>}
                            </td>
                            <td className="px-2 py-2 text-gray-600 w-16">{y.class}</td>
                            <td className="px-2 py-2 text-center w-12">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                            <td className="px-2 py-2 text-right">{y.puntReturn.ret}</td>
                            <td className="px-2 py-2 text-right font-medium">{y.puntReturn.yds}</td>
                            <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.puntReturn.yds, y.puntReturn.ret)}</td>
                            <td className="px-2 py-2 text-right font-medium">{y.puntReturn.td}</td>
                            <td className="px-2 py-2 text-right text-gray-500">{y.puntReturn.lng}</td>
                          </tr>
                          {renderGameLogRow(y.year, colSpan)}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900 w-14">Career</td>
                      <td className="px-2 py-2 w-16"></td>
                      <td className="px-2 py-2 w-12"></td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.ret}</td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.yds}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerPuntReturn.yds, careerPuntReturn.ret)}</td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.td}</td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.lng}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* Notes & Media */}
      {(player.notes || (player.links && player.links.length > 0)) && (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{ backgroundColor: teamColors.secondary, border: `3px solid ${teamColors.primary}` }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: secondaryText }}>Notes & Media</h2>
          {player.notes && (
            <div className="mb-4">
              <div className="p-4 rounded-lg whitespace-pre-wrap" style={{ backgroundColor: `${teamColors.primary}20`, color: secondaryText }}>
                {player.notes}
              </div>
            </div>
          )}
          {player.links && player.links.length > 0 && (
            <div className="space-y-4">
              {/* Embeddable Media */}
              {player.links.filter(link => link.url).map((link, index) => {
                const url = link.url

                // YouTube embed
                if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed')) {
                  let videoId = null
                  if (url.includes('youtube.com/watch')) {
                    const urlParams = new URLSearchParams(url.split('?')[1])
                    videoId = urlParams.get('v')
                  } else if (url.includes('youtu.be/')) {
                    videoId = url.split('youtu.be/')[1]?.split('?')[0]
                  } else if (url.includes('youtube.com/embed/')) {
                    videoId = url.split('youtube.com/embed/')[1]?.split('?')[0]
                  }

                  if (!videoId) return null

                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title={link.title || 'YouTube video'}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )
                }

                // Streamable embed
                if (url.includes('streamable.com/')) {
                  const videoId = url.split('streamable.com/')[1]?.split('?')[0]
                  if (!videoId) return null

                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src={`https://streamable.com/e/${videoId}`}
                          title={link.title || 'Streamable video'}
                          frameBorder="0"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )
                }

                // Imgur image/video embed (supports .mp4, .gifv, .gif, direct images)
                if (url.includes('imgur.com') || url.includes('i.imgur.com')) {
                  // Direct image links
                  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('i.imgur.com')) {
                    // Convert gifv to mp4
                    const displayUrl = url.replace('.gifv', '.mp4')
                    const isVideo = displayUrl.endsWith('.mp4') || displayUrl.endsWith('.gifv')

                    return (
                      <div key={index} className="rounded-lg overflow-hidden">
                        {link.title && (
                          <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                            {link.title}
                          </div>
                        )}
                        {isVideo ? (
                          <video
                            className="w-full max-h-[500px] object-contain bg-black"
                            src={displayUrl}
                            controls
                            loop
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={displayUrl}
                            alt={link.title || 'Imgur image'}
                            className="w-full max-h-[500px] object-contain"
                          />
                        )}
                      </div>
                    )
                  }

                  // Imgur album or post page - extract ID and use embed
                  const imgurMatch = url.match(/imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]+)/)
                  if (imgurMatch) {
                    const imgurId = imgurMatch[1]
                    return (
                      <div key={index} className="rounded-lg overflow-hidden">
                        {link.title && (
                          <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                            {link.title}
                          </div>
                        )}
                        <blockquote className="imgur-embed-pub" lang="en" data-id={imgurId}>
                          <a href={url} target="_blank" rel="noopener noreferrer">View on Imgur</a>
                        </blockquote>
                        <img
                          src={`https://i.imgur.com/${imgurId}.jpg`}
                          alt={link.title || 'Imgur image'}
                          className="w-full max-h-[500px] object-contain"
                          onError={(e) => {
                            // Try .png if .jpg fails
                            if (e.target.src.endsWith('.jpg')) {
                              e.target.src = `https://i.imgur.com/${imgurId}.png`
                            }
                          }}
                        />
                      </div>
                    )
                  }
                }

                // Twitter/X embed (video clips)
                if (url.includes('twitter.com') || url.includes('x.com')) {
                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 hover:opacity-80 transition-opacity flex items-center gap-2"
                        style={{ backgroundColor: `${teamColors.primary}15`, color: secondaryText }}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span className="font-medium">{link.title || 'View on X/Twitter'}</span>
                      </a>
                    </div>
                  )
                }

                // Direct image URLs (jpg, png, gif, webp)
                if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <img
                        src={url}
                        alt={link.title || 'Image'}
                        className="w-full max-h-[500px] object-contain"
                      />
                    </div>
                  )
                }

                // Direct video URLs (mp4, webm)
                if (url.match(/\.(mp4|webm)$/i)) {
                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <video
                        className="w-full max-h-[500px] object-contain bg-black"
                        src={url}
                        controls
                        playsInline
                      />
                    </div>
                  )
                }

                // Default: Regular link button
                return (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-80 transition-opacity items-center gap-2"
                    style={{ backgroundColor: teamColors.primary, color: primaryText }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {link.title || url}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <PlayerEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        player={player}
        teamColors={teamColors}
        onSave={handlePlayerSave}
        defaultSchool={dynasty.teamName}
        dynasty={dynasty}
      />

      {/* Accolade Games Modal */}
      {showAccoladeModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ margin: 0 }}
          onClick={() => setShowAccoladeModal(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: teamColors.secondary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 border-b sticky top-0"
              style={{ backgroundColor: teamColors.primary, borderColor: teamColors.secondary }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold" style={{ color: primaryText }}>
                    {accoladeType === 'confPOW' ? 'Conference Player of the Week' : 'National Player of the Week'}
                  </h3>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: primaryText, opacity: 0.9 }}>{player.name}</p>
                </div>
                <button onClick={() => setShowAccoladeModal(false)} className="hover:opacity-70" style={{ color: primaryText }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {(accoladeType === 'confPOW' ? powHonors.confPOWGames : powHonors.nationalPOWGames).map((game, index) => {
                const mascotName = getMascotName(game.opponent)
                const opponentName = mascotName || getTeamNameFromAbbr(game.opponent)
                const opponentLogo = mascotName ? getTeamLogo(mascotName) : null
                const opponentColors = getTeamColors(opponentName) || { primary: '#333', secondary: '#fff' }
                const opponentBgColor = teamAbbreviations[game.opponent]?.backgroundColor || opponentColors.primary || '#333'
                const opponentTextColor = teamAbbreviations[game.opponent]?.textColor || getContrastTextColor(opponentBgColor)
                const isWin = game.result === 'win' || game.result === 'W'

                return (
                  <Link
                    key={game.id || index}
                    to={`${pathPrefix}/game/${game.id}`}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-lg border-2 gap-2 sm:gap-0 hover:opacity-90 transition-opacity text-left"
                    style={{ backgroundColor: opponentBgColor, borderColor: isWin ? '#86efac' : '#fca5a5' }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-xs font-medium w-16 sm:w-20 flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.9 }}>
                        {game.year} Wk {game.week}
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: opponentTextColor, color: opponentBgColor }}>
                          {game.location === 'away' ? '@' : 'vs'}
                        </span>
                        {opponentLogo && (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', border: `2px solid ${opponentTextColor}`, padding: '2px' }}>
                            <img src={opponentLogo} alt="" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div className="flex items-center gap-1 min-w-0">
                          {game.opponentRank && <span className="text-xs font-bold flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.7 }}>#{game.opponentRank}</span>}
                          <span className="text-sm font-semibold truncate" style={{ color: opponentTextColor }}>{opponentName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start">
                      <div className="text-sm font-bold px-2 py-0.5 rounded" style={{ backgroundColor: isWin ? '#22c55e' : '#ef4444', color: '#ffffff' }}>
                        {isWin ? 'W' : 'L'}
                      </div>
                      <div className="text-sm font-bold" style={{ color: opponentTextColor }}>{game.teamScore}-{game.opponentScore}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Overall Progression Modal */}
      <OverallProgressionModal
        isOpen={showOverallProgressionModal}
        onClose={() => setShowOverallProgressionModal(false)}
        player={player}
        trainingResultsByYear={currentDynasty?.trainingResultsByYear}
        recruitOverallsByYear={currentDynasty?.recruitOverallsByYear}
        teamColors={teamColors}
        currentYear={currentDynasty?.currentYear}
      />

      {/* Game Log Modal */}
      {showGameLogModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ margin: 0 }}
          onClick={() => setShowGameLogModal(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: teamColors.secondary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 border-b flex-shrink-0"
              style={{ backgroundColor: teamColors.primary, borderColor: teamColors.secondary }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold" style={{ color: primaryText }}>
                    Game Log
                  </h3>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: primaryText, opacity: 0.9 }}>
                    {player.name} - {playerGameLog.length} {playerGameLog.length === 1 ? 'Game' : 'Games'}
                  </p>
                </div>
                <button onClick={() => setShowGameLogModal(false)} className="hover:opacity-70" style={{ color: primaryText }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {playerGameLog.map(({ game, stats }, index) => {
                const mascotName = getMascotName(game.opponent)
                const opponentName = mascotName || getTeamNameFromAbbr(game.opponent)
                const opponentLogo = mascotName ? getTeamLogo(mascotName) : null
                const opponentColors = getTeamColors(opponentName) || { primary: '#333', secondary: '#fff' }
                const opponentBgColor = teamAbbreviations[game.opponent]?.backgroundColor || opponentColors.primary || '#333'
                const opponentTextColor = teamAbbreviations[game.opponent]?.textColor || getContrastTextColor(opponentBgColor)
                const isWin = game.result === 'win' || game.result === 'W'

                // Format stats based on category
                // Keys match camelCase conversion from Google Sheets headers in boxScoreConstants.js
                const formatStats = () => {
                  const { category } = stats
                  // Helper to safely get numeric value from stats (handles strings and empty values)
                  const num = (val) => Number(val) || 0

                  if (category === 'passing') {
                    return `${num(stats.comp)}/${num(stats.attempts)}, ${num(stats.yards)} YDS, ${num(stats.tD)} TD, ${num(stats.iNT)} INT`
                  } else if (category === 'rushing') {
                    return `${num(stats.carries)} CAR, ${num(stats.yards)} YDS, ${num(stats.tD)} TD`
                  } else if (category === 'receiving') {
                    return `${num(stats.receptions)} REC, ${num(stats.yards)} YDS, ${num(stats.tD)} TD`
                  } else if (category === 'defense') {
                    // Keys: solo, assists, tFL, sack, iNT, deflections, fF, fR
                    const tackles = num(stats.solo) + num(stats.assists)
                    return `${tackles} TKL, ${num(stats.sack)} SACK, ${num(stats.iNT)} INT`
                  } else if (category === 'kicking') {
                    // Keys: fGM, fGA, xPM, xPA
                    return `${num(stats.fGM)}/${num(stats.fGA)} FG, ${num(stats.xPM)}/${num(stats.xPA)} XP`
                  } else if (category === 'blocking') {
                    return `${num(stats.pancakes)} Pancakes, ${num(stats.sacksAllowed)} Sacks Allowed`
                  } else if (category === 'punting') {
                    return `${num(stats.punts)} Punts, ${num(stats.yards)} YDS, ${num(stats.in20)} In20`
                  } else if (category === 'kickReturn') {
                    // Keys: kR, yards, tD
                    return `${num(stats.kR)} KR, ${num(stats.yards)} YDS, ${num(stats.tD)} TD`
                  } else if (category === 'puntReturn') {
                    // Keys: pR, yards, tD
                    return `${num(stats.pR)} PR, ${num(stats.yards)} YDS, ${num(stats.tD)} TD`
                  }
                  return ''
                }

                return (
                  <Link
                    key={game.id || index}
                    to={`${pathPrefix}/game/${game.id}`}
                    className="block p-3 rounded-lg border-2 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: opponentBgColor, borderColor: isWin ? '#86efac' : '#fca5a5' }}
                    onClick={() => setShowGameLogModal(false)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-xs font-medium w-16 flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.9 }}>
                          {game.year} Wk {game.week}
                        </div>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: opponentTextColor, color: opponentBgColor }}>
                          {game.location === 'away' ? '@' : 'vs'}
                        </span>
                        {opponentLogo && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', border: `2px solid ${opponentTextColor}`, padding: '2px' }}>
                            <img src={opponentLogo} alt="" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div className="flex items-center gap-1 min-w-0">
                          {game.opponentRank && <span className="text-xs font-bold flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.7 }}>#{game.opponentRank}</span>}
                          <span className="text-sm font-semibold truncate" style={{ color: opponentTextColor }}>{opponentName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: isWin ? '#22c55e' : '#ef4444', color: '#ffffff' }}>
                          {isWin ? 'W' : 'L'}
                        </div>
                        <div className="text-sm font-bold" style={{ color: opponentTextColor }}>{game.teamScore}-{game.opponentScore}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: `${opponentTextColor}20`, color: opponentTextColor }}>
                      {formatStats()}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ margin: 0 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-md w-full p-6"
            style={{ backgroundColor: teamColors.secondary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: teamColors.primary }}>Delete Player?</h3>
                <p className="text-sm" style={{ color: teamColors.primary, opacity: 0.7 }}>This action cannot be undone</p>
              </div>
            </div>

            <p className="mb-6" style={{ color: teamColors.primary }}>
              Are you sure you want to delete <strong>{player.name}</strong>? All stats and data for this player will be permanently removed.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg font-semibold border-2"
                style={{ borderColor: teamColors.primary, color: teamColors.primary, backgroundColor: 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true)
                  try {
                    await deletePlayer(dynasty.id, player.pid)
                    navigate(`${pathPrefix}/roster`)
                  } catch (error) {
                    console.error('Failed to delete player:', error)
                    alert('Failed to delete player. Please try again.')
                  } finally {
                    setIsDeleting(false)
                    setShowDeleteConfirm(false)
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: '#EF4444', color: '#FFFFFF', opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Player'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
