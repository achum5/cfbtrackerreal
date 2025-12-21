import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getTeamLogo } from '../../data/teams'
import { getAbbreviationFromDisplayName, teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamColors } from '../../data/teamColors'
import PlayerEditModal from '../../components/PlayerEditModal'

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
    'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins', 'UGA': 'Georgia Bulldogs',
    'UK': 'Kentucky Wildcats', 'ULL': 'Lafayette Ragin\' Cajuns', 'ULM': 'Monroe Warhawks',
    'UNC': 'North Carolina Tar Heels', 'UNLV': 'UNLV Rebels', 'UNM': 'New Mexico Lobos',
    'UNT': 'North Texas Mean Green', 'USA': 'South Alabama Jaguars', 'USC': 'USC Trojans',
    'USF': 'South Florida Bulls', 'USM': 'Southern Mississippi Golden Eagles',
    'USU': 'Utah State Aggies', 'UTAH': 'Utah Utes', 'UTEP': 'UTEP Miners',
    'UTSA': 'UTSA Roadrunners', 'UVA': 'Virginia Cavaliers', 'VAND': 'Vanderbilt Commodores',
    'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons', 'WASH': 'Washington Huskies',
    'WIS': 'Wisconsin Badgers', 'WKU': 'Western Kentucky Hilltoppers', 'WMU': 'Western Michigan Broncos',
    'WSU': 'Washington State Cougars', 'WVU': 'West Virginia Mountaineers', 'WYO': 'Wyoming Cowboys'
  }
  return mascotMap[abbr] || null
}

export default function Player() {
  const { id: dynastyId, pid } = useParams()
  const { dynasties, currentDynasty, updatePlayer } = useDynasty()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAccoladeModal, setShowAccoladeModal] = useState(false)
  const [accoladeType, setAccoladeType] = useState(null) // 'confPOW' or 'nationalPOW'

  // Scroll to top when player page loads or changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pid])

  // Find the dynasty and player
  const dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)
  const player = dynasty?.players?.find(p => p.pid === parseInt(pid))

  if (!dynasty) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Dynasty not found</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Player not found</p>
      </div>
    )
  }

  const teamColors = useTeamColors(dynasty.teamName)
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  // Calculate Player of the Week honors from games
  const calculatePOWHonors = () => {
    const games = dynasty.games || []
    let confPOW = 0
    let nationalPOW = 0
    const confPOWGames = []
    const nationalPOWGames = []

    games.forEach(game => {
      if (game.conferencePOW === player.name) {
        confPOW++
        confPOWGames.push(game)
      }
      if (game.nationalPOW === player.name) {
        nationalPOW++
        nationalPOWGames.push(game)
      }
    })

    return { confPOW, nationalPOW, confPOWGames, nationalPOWGames }
  }

  const powHonors = calculatePOWHonors()

  // Handle clicking on an accolade badge
  const handleAccoladeClick = (type) => {
    setAccoladeType(type)
    setShowAccoladeModal(true)
  }

  // Get team name from abbreviation
  const getTeamNameFromAbbr = (abbr) => {
    return teamAbbreviations[abbr]?.name || abbr
  }

  const handlePlayerSave = async (updatedPlayer) => {
    await updatePlayer(dynastyId, updatedPlayer)
    setShowEditModal(false)
  }

  // Get player stats from detailedStatsByYear - aggregate across all years
  const getPlayerDetailedStats = () => {
    const detailedStatsByYear = dynasty.detailedStatsByYear || {}
    const playerPid = player.pid

    // Initialize aggregated stats
    const stats = {
      passing: null,
      rushing: null,
      receiving: null,
      blocking: null,
      defensive: null,
      kicking: null,
      punting: null,
      kickReturn: null,
      puntReturn: null
    }

    // Helper to find player in a tab's data by PID
    const findPlayerInTab = (tabData) => {
      if (!tabData || !Array.isArray(tabData)) return null
      return tabData.find(p => p.pid === playerPid)
    }

    // Aggregate stats across all years
    Object.keys(detailedStatsByYear).forEach(year => {
      const yearData = detailedStatsByYear[year]
      if (!yearData) return

      // Passing
      const passingData = findPlayerInTab(yearData.Passing)
      if (passingData) {
        if (!stats.passing) stats.passing = { completions: 0, attempts: 0, yards: 0, touchdowns: 0, interceptions: 0, netYardsPerAttempt: 0, adjNetYardsPerAttempt: 0 }
        stats.passing.completions += passingData['Completions'] || 0
        stats.passing.attempts += passingData['Attempts'] || 0
        stats.passing.yards += passingData['Yards'] || 0
        stats.passing.touchdowns += passingData['Touchdowns'] || 0
        stats.passing.interceptions += passingData['Interceptions'] || 0
        // These are averages, take from most recent year with data
        if (passingData['Net Yards/Attempt']) stats.passing.netYardsPerAttempt = passingData['Net Yards/Attempt']
        if (passingData['Adjusted Net Yards/Attempt']) stats.passing.adjNetYardsPerAttempt = passingData['Adjusted Net Yards/Attempt']
      }

      // Rushing
      const rushingData = findPlayerInTab(yearData.Rushing)
      if (rushingData) {
        if (!stats.rushing) stats.rushing = { carries: 0, yards: 0, touchdowns: 0, runs20Plus: 0, brokenTackles: 0, yardsAfterContact: 0, rushingLong: 0, fumbles: 0 }
        stats.rushing.carries += rushingData['Carries'] || 0
        stats.rushing.yards += rushingData['Yards'] || 0
        stats.rushing.touchdowns += rushingData['Touchdowns'] || 0
        stats.rushing.runs20Plus += rushingData['20+ Yard Runs'] || 0
        stats.rushing.brokenTackles += rushingData['Broken Tackles'] || 0
        stats.rushing.yardsAfterContact += rushingData['Yards After Contact'] || 0
        stats.rushing.rushingLong = Math.max(stats.rushing.rushingLong, rushingData['Rushing Long'] || 0)
        stats.rushing.fumbles += rushingData['Fumbles'] || 0
      }

      // Receiving
      const receivingData = findPlayerInTab(yearData.Receiving)
      if (receivingData) {
        if (!stats.receiving) stats.receiving = { receptions: 0, yards: 0, touchdowns: 0, receivingLong: 0, runAfterCatch: 0, drops: 0 }
        stats.receiving.receptions += receivingData['Receptions'] || 0
        stats.receiving.yards += receivingData['Yards'] || 0
        stats.receiving.touchdowns += receivingData['Touchdowns'] || 0
        stats.receiving.receivingLong = Math.max(stats.receiving.receivingLong, receivingData['Receiving Long'] || 0)
        stats.receiving.runAfterCatch += receivingData['Run After Catch'] || 0
        stats.receiving.drops += receivingData['Drops'] || 0
      }

      // Blocking
      const blockingData = findPlayerInTab(yearData.Blocking)
      if (blockingData) {
        if (!stats.blocking) stats.blocking = { sacksAllowed: 0 }
        stats.blocking.sacksAllowed += blockingData['Sacks Allowed'] || 0
      }

      // Defensive
      const defensiveData = findPlayerInTab(yearData.Defensive)
      if (defensiveData) {
        if (!stats.defensive) stats.defensive = { soloTackles: 0, assistedTackles: 0, tacklesForLoss: 0, sacks: 0, interceptions: 0, intReturnYards: 0, intLong: 0, defensiveTDs: 0, deflections: 0, catchesAllowed: 0, forcedFumbles: 0, fumbleRecoveries: 0, fumbleReturnYards: 0, blocks: 0, safeties: 0 }
        stats.defensive.soloTackles += defensiveData['Solo Tackles'] || 0
        stats.defensive.assistedTackles += defensiveData['Assisted Tackles'] || 0
        stats.defensive.tacklesForLoss += defensiveData['Tackles for Loss'] || 0
        stats.defensive.sacks += defensiveData['Sacks'] || 0
        stats.defensive.interceptions += defensiveData['Interceptions'] || 0
        stats.defensive.intReturnYards += defensiveData['INT Return Yards'] || 0
        stats.defensive.intLong = Math.max(stats.defensive.intLong, defensiveData['INT Long'] || 0)
        stats.defensive.defensiveTDs += defensiveData['Defensive TDs'] || 0
        stats.defensive.deflections += defensiveData['Deflections'] || 0
        stats.defensive.catchesAllowed += defensiveData['Catches Allowed'] || 0
        stats.defensive.forcedFumbles += defensiveData['Forced Fumbles'] || 0
        stats.defensive.fumbleRecoveries += defensiveData['Fumble Recoveries'] || 0
        stats.defensive.fumbleReturnYards += defensiveData['Fumble Return Yards'] || 0
        stats.defensive.blocks += defensiveData['Blocks'] || 0
        stats.defensive.safeties += defensiveData['Safeties'] || 0
      }

      // Kicking
      const kickingData = findPlayerInTab(yearData.Kicking)
      if (kickingData) {
        if (!stats.kicking) stats.kicking = { fgMade: 0, fgAttempted: 0, fgLong: 0, xpMade: 0, xpAttempted: 0, fg0_29Made: 0, fg0_29Attempted: 0, fg30_39Made: 0, fg30_39Attempted: 0, fg40_49Made: 0, fg40_49Attempted: 0, fg50PlusMade: 0, fg50PlusAttempted: 0, kickoffs: 0, touchbacks: 0, fgBlocked: 0, xpBlocked: 0 }
        stats.kicking.fgMade += kickingData['FG Made'] || 0
        stats.kicking.fgAttempted += kickingData['FG Attempted'] || 0
        stats.kicking.fgLong = Math.max(stats.kicking.fgLong, kickingData['FG Long'] || 0)
        stats.kicking.xpMade += kickingData['XP Made'] || 0
        stats.kicking.xpAttempted += kickingData['XP Attempted'] || 0
        stats.kicking.fg0_29Made += kickingData['FG Made (0-29)'] || 0
        stats.kicking.fg0_29Attempted += kickingData['FG Att (0-29)'] || 0
        stats.kicking.fg30_39Made += kickingData['FG Made (30-39)'] || 0
        stats.kicking.fg30_39Attempted += kickingData['FG Att (30-39)'] || 0
        stats.kicking.fg40_49Made += kickingData['FG Made (40-49)'] || 0
        stats.kicking.fg40_49Attempted += kickingData['FG Att (40-49)'] || 0
        stats.kicking.fg50PlusMade += kickingData['FG Made (50+)'] || 0
        stats.kicking.fg50PlusAttempted += kickingData['FG Att (50+)'] || 0
        stats.kicking.kickoffs += kickingData['Kickoffs'] || 0
        stats.kicking.touchbacks += kickingData['Touchbacks'] || 0
        stats.kicking.fgBlocked += kickingData['FG Blocked'] || 0
        stats.kicking.xpBlocked += kickingData['XP Blocked'] || 0
      }

      // Punting
      const puntingData = findPlayerInTab(yearData.Punting)
      if (puntingData) {
        if (!stats.punting) stats.punting = { punts: 0, puntingYards: 0, netPuntingYards: 0, puntsInside20: 0, touchbacks: 0, puntLong: 0, puntsBlocked: 0 }
        stats.punting.punts += puntingData['Punts'] || 0
        stats.punting.puntingYards += puntingData['Punting Yards'] || 0
        stats.punting.netPuntingYards += puntingData['Net Punting Yards'] || 0
        stats.punting.puntsInside20 += puntingData['Punts Inside 20'] || 0
        stats.punting.touchbacks += puntingData['Touchbacks'] || 0
        stats.punting.puntLong = Math.max(stats.punting.puntLong, puntingData['Punt Long'] || 0)
        stats.punting.puntsBlocked += puntingData['Punts Blocked'] || 0
      }

      // Kick Return
      const kickReturnData = findPlayerInTab(yearData['Kick Return'])
      if (kickReturnData) {
        if (!stats.kickReturn) stats.kickReturn = { returns: 0, returnYardage: 0, touchdowns: 0, returnLong: 0 }
        stats.kickReturn.returns += kickReturnData['Kickoff Returns'] || 0
        stats.kickReturn.returnYardage += kickReturnData['KR Yardage'] || 0
        stats.kickReturn.touchdowns += kickReturnData['KR Touchdowns'] || 0
        stats.kickReturn.returnLong = Math.max(stats.kickReturn.returnLong, kickReturnData['KR Long'] || 0)
      }

      // Punt Return
      const puntReturnData = findPlayerInTab(yearData['Punt Return'])
      if (puntReturnData) {
        if (!stats.puntReturn) stats.puntReturn = { returns: 0, returnYardage: 0, touchdowns: 0, returnLong: 0 }
        stats.puntReturn.returns += puntReturnData['Punt Returns'] || 0
        stats.puntReturn.returnYardage += puntReturnData['PR Yardage'] || 0
        stats.puntReturn.touchdowns += puntReturnData['PR Touchdowns'] || 0
        stats.puntReturn.returnLong = Math.max(stats.puntReturn.returnLong, puntReturnData['PR Long'] || 0)
      }
    })

    return stats
  }

  const detailedStats = getPlayerDetailedStats()

  // Calculate derived stats
  const calcPct = (made, att) => att > 0 ? Math.round((made / att) * 1000) / 10 : 0
  const calcAvg = (total, count) => count > 0 ? Math.round((total / count) * 10) / 10 : 0
  const calcRatio = (a, b) => b > 0 ? Math.round((a / b) * 100) / 100 : 0

  // Player data with real stats from detailedStatsByYear
  const playerData = {
    // Biographical
    name: player.name,
    position: player.position,
    archetype: player.archetype || '',
    school: dynasty.teamName,

    // Physical
    height: player.height || '',
    weight: player.weight || null,

    // Hometown
    hometown: player.hometown || '',
    state: player.state || '',

    // Transfer info
    previousTeam: player.previousTeam || '',

    // Recruiting
    yearStarted: player.yearStarted || 'N/A',
    stars: player.stars || 0,
    positionRank: player.positionRank || 0,
    stateRank: player.stateRank || 0,
    nationalRank: player.nationalRank || 0,

    // Development
    devTrait: player.devTrait || 'Normal',
    gemBust: player.gemBust || 'N/A',
    overallProgression: player.overallProgression || 0,
    overallRatingChange: player.overallRatingChange || 0,
    overallRating: player.overall,

    // Game Logs
    snapsPlayed: player.snapsPlayed || 0,
    gamesPlayed: player.gamesPlayed || 0,
    gamesStarted: player.gamesStarted || 0,

    // Departure
    yearDeparted: player.yearDeparted || 'N/A',
    yearsInSchool: player.yearsInSchool || 0,
    draftRound: player.draftRound || 'N/A',

    // Accolades
    confPOW: powHonors.confPOW,
    nationalPOW: powHonors.nationalPOW,
    allConf1st: 0,
    allConf2nd: 0,
    allConfFr: 0,
    allAm1st: 0,
    allAm2nd: 0,
    allAmFr: 0,

    // Passing - from detailed stats
    passing: detailedStats.passing ? {
      completions: detailedStats.passing.completions,
      attempts: detailedStats.passing.attempts,
      completionPct: calcPct(detailedStats.passing.completions, detailedStats.passing.attempts),
      yards: detailedStats.passing.yards,
      touchdowns: detailedStats.passing.touchdowns,
      tdPct: calcPct(detailedStats.passing.touchdowns, detailedStats.passing.attempts),
      interceptions: detailedStats.passing.interceptions,
      intPct: calcPct(detailedStats.passing.interceptions, detailedStats.passing.attempts),
      tdIntRatio: calcRatio(detailedStats.passing.touchdowns, detailedStats.passing.interceptions),
      yardsPerAttempt: calcAvg(detailedStats.passing.yards, detailedStats.passing.attempts),
      netYardsPerAttempt: detailedStats.passing.netYardsPerAttempt || 0,
      adjNetYardsPerAttempt: detailedStats.passing.adjNetYardsPerAttempt || 0,
      yardsPerGame: 0, // Would need games played
      passerRating: 0, // Complex calculation
      passingLong: 0,
      sacksTaken: 0,
      sackPct: 0
    } : {
      completions: 0, attempts: 0, completionPct: 0,
      yards: 0, touchdowns: 0, tdPct: 0,
      interceptions: 0, intPct: 0, tdIntRatio: 0,
      yardsPerAttempt: 0, netYardsPerAttempt: 0, adjNetYardsPerAttempt: 0,
      yardsPerGame: 0, passerRating: 0,
      passingLong: 0, sacksTaken: 0, sackPct: 0
    },

    // Rushing - from detailed stats
    rushing: detailedStats.rushing ? {
      carries: detailedStats.rushing.carries,
      yards: detailedStats.rushing.yards,
      yardsPerCarry: calcAvg(detailedStats.rushing.yards, detailedStats.rushing.carries),
      touchdowns: detailedStats.rushing.touchdowns,
      yardsPerGame: 0, // Would need games played
      runs20Plus: detailedStats.rushing.runs20Plus,
      brokenTackles: detailedStats.rushing.brokenTackles,
      yardsAfterContact: detailedStats.rushing.yardsAfterContact,
      rushingLong: detailedStats.rushing.rushingLong,
      fumbles: detailedStats.rushing.fumbles,
      fumblePct: calcPct(detailedStats.rushing.fumbles, detailedStats.rushing.carries)
    } : {
      carries: 0, yards: 0, yardsPerCarry: 0,
      touchdowns: 0, yardsPerGame: 0,
      runs20Plus: 0, brokenTackles: 0,
      yardsAfterContact: 0, rushingLong: 0,
      fumbles: 0, fumblePct: 0
    },

    // Receiving - from detailed stats
    receiving: detailedStats.receiving ? {
      receptions: detailedStats.receiving.receptions,
      yards: detailedStats.receiving.yards,
      yardsPerCatch: calcAvg(detailedStats.receiving.yards, detailedStats.receiving.receptions),
      touchdowns: detailedStats.receiving.touchdowns,
      yardsPerGame: 0, // Would need games played
      receivingLong: detailedStats.receiving.receivingLong,
      runAfterCatch: detailedStats.receiving.runAfterCatch,
      racAverage: calcAvg(detailedStats.receiving.runAfterCatch, detailedStats.receiving.receptions),
      drops: detailedStats.receiving.drops
    } : {
      receptions: 0, yards: 0, yardsPerCatch: 0,
      touchdowns: 0, yardsPerGame: 0,
      receivingLong: 0, runAfterCatch: 0,
      racAverage: 0, drops: 0
    },

    // Blocking - from detailed stats
    blocking: detailedStats.blocking ? {
      sacksAllowed: detailedStats.blocking.sacksAllowed
    } : {
      sacksAllowed: 0
    },

    // Defensive - from detailed stats
    defensive: detailedStats.defensive ? {
      soloTackles: detailedStats.defensive.soloTackles,
      assistedTackles: detailedStats.defensive.assistedTackles,
      totalTackles: detailedStats.defensive.soloTackles + detailedStats.defensive.assistedTackles,
      tacklesForLoss: detailedStats.defensive.tacklesForLoss,
      sacks: detailedStats.defensive.sacks,
      interceptions: detailedStats.defensive.interceptions,
      intReturnYards: detailedStats.defensive.intReturnYards,
      avgIntReturn: calcAvg(detailedStats.defensive.intReturnYards, detailedStats.defensive.interceptions),
      intLong: detailedStats.defensive.intLong,
      defensiveTDs: detailedStats.defensive.defensiveTDs,
      deflections: detailedStats.defensive.deflections,
      catchesAllowed: detailedStats.defensive.catchesAllowed,
      forcedFumbles: detailedStats.defensive.forcedFumbles,
      fumbleRecoveries: detailedStats.defensive.fumbleRecoveries,
      fumbleReturnYards: detailedStats.defensive.fumbleReturnYards,
      blocks: detailedStats.defensive.blocks,
      safeties: detailedStats.defensive.safeties
    } : {
      soloTackles: 0, assistedTackles: 0, totalTackles: 0,
      tacklesForLoss: 0, sacks: 0,
      interceptions: 0, intReturnYards: 0,
      avgIntReturn: 0, intLong: 0,
      defensiveTDs: 0, deflections: 0,
      catchesAllowed: 0, forcedFumbles: 0,
      fumbleRecoveries: 0, fumbleReturnYards: 0,
      blocks: 0, safeties: 0
    },

    // Kicking - from detailed stats
    kicking: detailedStats.kicking ? {
      fgMade: detailedStats.kicking.fgMade,
      fgAttempted: detailedStats.kicking.fgAttempted,
      fgPct: calcPct(detailedStats.kicking.fgMade, detailedStats.kicking.fgAttempted),
      fgLong: detailedStats.kicking.fgLong,
      xpMade: detailedStats.kicking.xpMade,
      xpAttempted: detailedStats.kicking.xpAttempted,
      xpPct: calcPct(detailedStats.kicking.xpMade, detailedStats.kicking.xpAttempted),
      fg0_29Made: detailedStats.kicking.fg0_29Made,
      fg0_29Attempted: detailedStats.kicking.fg0_29Attempted,
      fg30_39Made: detailedStats.kicking.fg30_39Made,
      fg30_39Attempted: detailedStats.kicking.fg30_39Attempted,
      fg40_49Made: detailedStats.kicking.fg40_49Made,
      fg40_49Attempted: detailedStats.kicking.fg40_49Attempted,
      fg50PlusMade: detailedStats.kicking.fg50PlusMade,
      fg50PlusAttempted: detailedStats.kicking.fg50PlusAttempted,
      kickoffs: detailedStats.kicking.kickoffs,
      touchbacks: detailedStats.kicking.touchbacks,
      touchbackPct: calcPct(detailedStats.kicking.touchbacks, detailedStats.kicking.kickoffs),
      fgBlocked: detailedStats.kicking.fgBlocked,
      xpBlocked: detailedStats.kicking.xpBlocked
    } : {
      fgMade: 0, fgAttempted: 0, fgPct: 0, fgLong: 0,
      xpMade: 0, xpAttempted: 0, xpPct: 0,
      fg0_29Made: 0, fg0_29Attempted: 0,
      fg30_39Made: 0, fg30_39Attempted: 0,
      fg40_49Made: 0, fg40_49Attempted: 0,
      fg50PlusMade: 0, fg50PlusAttempted: 0,
      kickoffs: 0, touchbacks: 0, touchbackPct: 0,
      fgBlocked: 0, xpBlocked: 0
    },

    // Punting - from detailed stats
    punting: detailedStats.punting ? {
      punts: detailedStats.punting.punts,
      puntingYards: detailedStats.punting.puntingYards,
      yardsPerPunt: calcAvg(detailedStats.punting.puntingYards, detailedStats.punting.punts),
      netPuntingYards: detailedStats.punting.netPuntingYards,
      netYardsPerPunt: calcAvg(detailedStats.punting.netPuntingYards, detailedStats.punting.punts),
      puntsInside20: detailedStats.punting.puntsInside20,
      touchbacks: detailedStats.punting.touchbacks,
      puntLong: detailedStats.punting.puntLong,
      puntsBlocked: detailedStats.punting.puntsBlocked
    } : {
      punts: 0, puntingYards: 0, yardsPerPunt: 0,
      netPuntingYards: 0, netYardsPerPunt: 0,
      puntsInside20: 0, touchbacks: 0,
      puntLong: 0, puntsBlocked: 0
    },

    // Kick Return - from detailed stats
    kickReturn: detailedStats.kickReturn ? {
      returns: detailedStats.kickReturn.returns,
      returnYardage: detailedStats.kickReturn.returnYardage,
      returnAverage: calcAvg(detailedStats.kickReturn.returnYardage, detailedStats.kickReturn.returns),
      touchdowns: detailedStats.kickReturn.touchdowns,
      returnLong: detailedStats.kickReturn.returnLong
    } : {
      returns: 0, returnYardage: 0, returnAverage: 0,
      touchdowns: 0, returnLong: 0
    },

    // Punt Return - from detailed stats
    puntReturn: detailedStats.puntReturn ? {
      returns: detailedStats.puntReturn.returns,
      returnYardage: detailedStats.puntReturn.returnYardage,
      returnAverage: calcAvg(detailedStats.puntReturn.returnYardage, detailedStats.puntReturn.returns),
      touchdowns: detailedStats.puntReturn.touchdowns,
      returnLong: detailedStats.puntReturn.returnLong
    } : {
      returns: 0, returnYardage: 0, returnAverage: 0,
      touchdowns: 0, returnLong: 0
    },

    // Scrimmage - calculated from rushing + receiving
    scrimmage: {
      plays: (detailedStats.rushing?.carries || 0) + (detailedStats.receiving?.receptions || 0),
      yards: (detailedStats.rushing?.yards || 0) + (detailedStats.receiving?.yards || 0),
      yardsPerPlay: calcAvg(
        (detailedStats.rushing?.yards || 0) + (detailedStats.receiving?.yards || 0),
        (detailedStats.rushing?.carries || 0) + (detailedStats.receiving?.receptions || 0)
      ),
      touchdowns: (detailedStats.rushing?.touchdowns || 0) + (detailedStats.receiving?.touchdowns || 0),
      yardsPerGame: 0 // Would need games played
    },

    // Total - calculated from all offensive stats + returns
    total: {
      plays: (detailedStats.rushing?.carries || 0) + (detailedStats.receiving?.receptions || 0) + (detailedStats.kickReturn?.returns || 0) + (detailedStats.puntReturn?.returns || 0),
      yardage: (detailedStats.rushing?.yards || 0) + (detailedStats.receiving?.yards || 0) + (detailedStats.kickReturn?.returnYardage || 0) + (detailedStats.puntReturn?.returnYardage || 0),
      yardsPerPlay: calcAvg(
        (detailedStats.rushing?.yards || 0) + (detailedStats.receiving?.yards || 0) + (detailedStats.kickReturn?.returnYardage || 0) + (detailedStats.puntReturn?.returnYardage || 0),
        (detailedStats.rushing?.carries || 0) + (detailedStats.receiving?.receptions || 0) + (detailedStats.kickReturn?.returns || 0) + (detailedStats.puntReturn?.returns || 0)
      ),
      touchdowns: (detailedStats.rushing?.touchdowns || 0) + (detailedStats.receiving?.touchdowns || 0) + (detailedStats.kickReturn?.touchdowns || 0) + (detailedStats.puntReturn?.touchdowns || 0),
      yardsPerGame: 0 // Would need games played
    }
  }

  // Helper function to determine which stat sections to show based on position
  const getStatSections = (position) => {
    const pos = position.toUpperCase()

    // Quarterbacks
    if (pos === 'QB') {
      return {
        passing: true,
        rushing: true,
        receiving: false,
        blocking: false,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: true,
        total: true
      }
    }

    // Running Backs
    if (pos === 'HB' || pos === 'FB') {
      return {
        passing: false,
        rushing: true,
        receiving: true,
        blocking: true,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: true,
        puntReturn: true,
        scrimmage: true,
        total: true
      }
    }

    // Receivers
    if (pos === 'WR' || pos === 'TE') {
      return {
        passing: false,
        rushing: true,
        receiving: true,
        blocking: true,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: true,
        puntReturn: true,
        scrimmage: true,
        total: true
      }
    }

    // Offensive Line
    if (['LT', 'LG', 'C', 'RG', 'RT'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: true,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Defensive Line & Edge
    if (['DT', 'LEDG', 'REDG'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: true,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Linebackers
    if (['SAM', 'MIKE', 'WILL'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: true,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Defensive Backs
    if (['CB', 'FS', 'SS'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: true,
        kicking: false,
        punting: false,
        kickReturn: true,
        puntReturn: true,
        scrimmage: false,
        total: false
      }
    }

    // Kicker
    if (pos === 'K') {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: false,
        kicking: true,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Punter
    if (pos === 'P') {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: false,
        kicking: false,
        punting: true,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Default - show all
    return {
      passing: true,
      rushing: true,
      receiving: true,
      blocking: true,
      defensive: true,
      kicking: true,
      punting: true,
      kickReturn: true,
      puntReturn: true,
      scrimmage: true,
      total: true
    }
  }

  const statSections = getStatSections(playerData.position)

  // Helper component for stat display
  const StatBox = ({ label, value, small = false }) => (
    <div
      className={`p-3 rounded-lg border ${small ? '' : 'text-center'}`}
      style={{
        backgroundColor: teamColors.secondary,
        borderColor: primaryText + '60'
      }}
    >
      <div className={`text-xs mb-1 ${small ? '' : 'font-semibold'}`} style={{ color: secondaryText, opacity: 0.7 }}>
        {label}
      </div>
      <div className={`${small ? 'text-sm' : 'text-lg'} font-bold`} style={{ color: secondaryText }}>
        {value !== null && value !== undefined ? value : '-'}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Player Header - ESPN Style */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Player Picture - only show if image uploaded */}
            {player.pictureUrl && (
              <img
                src={player.pictureUrl}
                alt={playerData.name}
                className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg border-2 flex-shrink-0"
                style={{ borderColor: teamColors.secondary }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}

            <div className="flex-1">
              {/* Name and Edit Button */}
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold" style={{ color: primaryText }}>
                  {playerData.name}
                </h1>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: primaryText }}
                  title="Edit Player"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>

              {/* Team Link */}
              <Link
                to={`/dynasty/${dynastyId}/team/${getAbbreviationFromDisplayName(playerData.school)}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline mb-3"
                style={{ color: primaryText, opacity: 0.9 }}
              >
                {getTeamLogo(playerData.school) && (
                  <img
                    src={getTeamLogo(playerData.school)}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                )}
                {playerData.school}
              </Link>

              {/* Compact Info Line */}
              <div
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                style={{ color: primaryText, opacity: 0.85 }}
              >
                {player.jerseyNumber && <span className="font-bold">#{player.jerseyNumber}</span>}
                {player.jerseyNumber && <span className="opacity-50">|</span>}
                <span className="font-semibold">{playerData.position}</span>
                {playerData.archetype && (
                  <>
                    <span className="opacity-50">|</span>
                    <span>{playerData.archetype}</span>
                  </>
                )}
                <span className="opacity-50">|</span>
                <span>{player.year}</span>
                {(playerData.height || playerData.weight) && (
                  <>
                    <span className="opacity-50">|</span>
                    <span>
                      {playerData.height}{playerData.height && playerData.weight && ', '}{playerData.weight ? `${playerData.weight} lbs` : ''}
                    </span>
                  </>
                )}
                {(playerData.hometown || playerData.state) && (
                  <>
                    <span className="opacity-50">|</span>
                    <span>
                      {playerData.hometown}{playerData.hometown && playerData.state && ', '}{playerData.state}
                    </span>
                  </>
                )}
                {playerData.previousTeam && (
                  <>
                    <span className="opacity-50">|</span>
                    <span className="italic">Transfer from {playerData.previousTeam}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Overall Rating */}
          <div className="text-center flex-shrink-0">
            <div className="text-xs mb-1" style={{ color: primaryText, opacity: 0.7 }}>
              OVR
            </div>
            <div
              className="text-5xl md:text-6xl font-bold"
              style={{ color: teamColors.secondary }}
            >
              {playerData.overallRating}
            </div>
          </div>
        </div>
      </div>

      {/* Recruiting Information - only show if any recruiting data exists */}
      {(playerData.yearStarted !== 'N/A' || playerData.stars > 0 || playerData.positionRank > 0 || playerData.stateRank > 0 || playerData.nationalRank > 0) && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Recruiting Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatBox label="Recruitment Year" value={playerData.yearStarted} />
            <StatBox label="Stars" value={playerData.stars > 0 ? `${playerData.stars}★` : 'N/A'} />
            <StatBox label="Position Rank" value={playerData.positionRank > 0 ? `#${playerData.positionRank}` : 'N/A'} />
            <StatBox label="State Rank" value={playerData.stateRank > 0 ? `#${playerData.stateRank}` : 'N/A'} />
            <StatBox label="National Rank" value={playerData.nationalRank > 0 ? `#${playerData.nationalRank}` : 'N/A'} />
          </div>
        </div>
      )}

      {/* Development & Game Logs */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
          Development & Game Logs
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <StatBox label="Dev Trait" value={playerData.devTrait} />
          <StatBox label="Gem / Bust" value={playerData.gemBust} />
          <StatBox label="Overall Progression" value={playerData.overallProgression > 0 ? `+${playerData.overallProgression}` : playerData.overallProgression || 0} />
          <StatBox label="Rating Change" value={playerData.overallRatingChange > 0 ? `+${playerData.overallRatingChange}` : playerData.overallRatingChange || 0} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBox label="Snaps Played" value={playerData.snapsPlayed} />
          <StatBox label="Games Played" value={playerData.gamesPlayed} />
          <StatBox label="Games Started" value={playerData.gamesStarted} />
        </div>
      </div>

      {/* Departure Information */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
          Departure Information
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBox label="Year Departed" value={playerData.yearDeparted} />
          <StatBox label="Years in School" value={playerData.yearsInSchool > 0 ? playerData.yearsInSchool : 'N/A'} />
          <StatBox label="Draft Round" value={playerData.draftRound} />
        </div>
      </div>

      {/* Accolades */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
          Accolades
        </h2>
        <div className="flex flex-wrap gap-2">
          {playerData.confPOW > 0 && (
            <button
              onClick={() => handleAccoladeClick('confPOW')}
              className="px-4 py-2 rounded-full font-semibold hover:opacity-80 transition-opacity cursor-pointer"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              Conference Player of the Week {playerData.confPOW}x
            </button>
          )}
          {playerData.nationalPOW > 0 && (
            <button
              onClick={() => handleAccoladeClick('nationalPOW')}
              className="px-4 py-2 rounded-full font-semibold hover:opacity-80 transition-opacity cursor-pointer"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              National Player of the Week {playerData.nationalPOW}x
            </button>
          )}
          {playerData.allConf1st > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-Conference 1st Team {playerData.allConf1st}x
            </div>
          )}
          {playerData.allConf2nd > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-Conference 2nd Team {playerData.allConf2nd}x
            </div>
          )}
          {playerData.allConfFr > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-Conference Freshman Team {playerData.allConfFr}x
            </div>
          )}
          {playerData.allAm1st > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-American 1st Team {playerData.allAm1st}x
            </div>
          )}
          {playerData.allAm2nd > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-American 2nd Team {playerData.allAm2nd}x
            </div>
          )}
          {playerData.allAmFr > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-American Freshman Team {playerData.allAmFr}x
            </div>
          )}
          {playerData.confPOW === 0 && playerData.nationalPOW === 0 &&
           playerData.allConf1st === 0 && playerData.allConf2nd === 0 && playerData.allConfFr === 0 &&
           playerData.allAm1st === 0 && playerData.allAm2nd === 0 && playerData.allAmFr === 0 && (
            <div className="text-sm" style={{ color: primaryText, opacity: 0.6 }}>
              No accolades yet
            </div>
          )}
        </div>
      </div>

      {/* Passing Statistics */}
      {statSections.passing && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Passing Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatBox label="Completions" value={playerData.passing.completions} small />
          <StatBox label="Attempts" value={playerData.passing.attempts} small />
          <StatBox label="Completion %" value={playerData.passing.completionPct > 0 ? `${playerData.passing.completionPct}%` : '-'} small />
          <StatBox label="Yards" value={playerData.passing.yards} small />
          <StatBox label="Touchdowns" value={playerData.passing.touchdowns} small />
          <StatBox label="TD %" value={playerData.passing.tdPct > 0 ? `${playerData.passing.tdPct}%` : '-'} small />
          <StatBox label="Interceptions" value={playerData.passing.interceptions} small />
          <StatBox label="INT %" value={playerData.passing.intPct > 0 ? `${playerData.passing.intPct}%` : '-'} small />
          <StatBox label="TD/INT Ratio" value={playerData.passing.tdIntRatio > 0 ? playerData.passing.tdIntRatio.toFixed(2) : '-'} small />
          <StatBox label="Yards/Attempt" value={playerData.passing.yardsPerAttempt > 0 ? playerData.passing.yardsPerAttempt.toFixed(1) : '-'} small />
          <StatBox label="Net Yards/Attempt" value={playerData.passing.netYardsPerAttempt > 0 ? playerData.passing.netYardsPerAttempt.toFixed(1) : '-'} small />
          <StatBox label="Adj Net Yards/Attempt" value={playerData.passing.adjNetYardsPerAttempt > 0 ? playerData.passing.adjNetYardsPerAttempt.toFixed(1) : '-'} small />
          <StatBox label="Yards/Game" value={playerData.passing.yardsPerGame > 0 ? playerData.passing.yardsPerGame.toFixed(1) : '-'} small />
          <StatBox label="Passer Rating" value={playerData.passing.passerRating > 0 ? playerData.passing.passerRating.toFixed(1) : '-'} small />
          <StatBox label="Passing Long" value={playerData.passing.passingLong} small />
          <StatBox label="Sacks Taken" value={playerData.passing.sacksTaken} small />
          <StatBox label="Sack %" value={playerData.passing.sackPct > 0 ? `${playerData.passing.sackPct}%` : '-'} small />
        </div>
        </div>
      )}

      {/* Rushing Statistics */}
      {statSections.rushing && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Rushing Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatBox label="Carries" value={playerData.rushing.carries} small />
          <StatBox label="Yards" value={playerData.rushing.yards} small />
          <StatBox label="Yards/Carry" value={playerData.rushing.yardsPerCarry > 0 ? playerData.rushing.yardsPerCarry.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.rushing.touchdowns} small />
          <StatBox label="Yards/Game" value={playerData.rushing.yardsPerGame > 0 ? playerData.rushing.yardsPerGame.toFixed(1) : '-'} small />
          <StatBox label="20+ Yard Runs" value={playerData.rushing.runs20Plus} small />
          <StatBox label="Broken Tackles" value={playerData.rushing.brokenTackles} small />
          <StatBox label="Yards After Contact" value={playerData.rushing.yardsAfterContact} small />
          <StatBox label="Rushing Long" value={playerData.rushing.rushingLong} small />
          <StatBox label="Fumbles" value={playerData.rushing.fumbles} small />
          <StatBox label="Fumble %" value={playerData.rushing.fumblePct > 0 ? `${playerData.rushing.fumblePct}%` : '-'} small />
        </div>
        </div>
      )}

      {/* Receiving Statistics */}
      {statSections.receiving && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Receiving Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatBox label="Receptions" value={playerData.receiving.receptions} small />
          <StatBox label="Yards" value={playerData.receiving.yards} small />
          <StatBox label="Yards/Catch" value={playerData.receiving.yardsPerCatch > 0 ? playerData.receiving.yardsPerCatch.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.receiving.touchdowns} small />
          <StatBox label="Yards/Game" value={playerData.receiving.yardsPerGame > 0 ? playerData.receiving.yardsPerGame.toFixed(1) : '-'} small />
          <StatBox label="Receiving Long" value={playerData.receiving.receivingLong} small />
          <StatBox label="Run After Catch" value={playerData.receiving.runAfterCatch} small />
          <StatBox label="RAC Average" value={playerData.receiving.racAverage > 0 ? playerData.receiving.racAverage.toFixed(1) : '-'} small />
          <StatBox label="Drops" value={playerData.receiving.drops} small />
        </div>
        </div>
      )}

      {/* Blocking */}
      {statSections.blocking && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Blocking
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatBox label="Sacks Allowed" value={playerData.blocking.sacksAllowed} />
          </div>
        </div>
      )}

      {/* Defensive Statistics */}
      {statSections.defensive && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Defensive Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatBox label="Solo Tackles" value={playerData.defensive.soloTackles} small />
          <StatBox label="Assisted Tackles" value={playerData.defensive.assistedTackles} small />
          <StatBox label="Total Tackles" value={playerData.defensive.totalTackles} small />
          <StatBox label="Tackles for Loss" value={playerData.defensive.tacklesForLoss} small />
          <StatBox label="Sacks" value={playerData.defensive.sacks} small />
          <StatBox label="Interceptions" value={playerData.defensive.interceptions} small />
          <StatBox label="INT Return Yards" value={playerData.defensive.intReturnYards} small />
          <StatBox label="Avg INT Return" value={playerData.defensive.avgIntReturn > 0 ? playerData.defensive.avgIntReturn.toFixed(1) : '-'} small />
          <StatBox label="INT Long" value={playerData.defensive.intLong} small />
          <StatBox label="Defensive TDs" value={playerData.defensive.defensiveTDs} small />
          <StatBox label="Deflections" value={playerData.defensive.deflections} small />
          <StatBox label="Catches Allowed" value={playerData.defensive.catchesAllowed} small />
          <StatBox label="Forced Fumbles" value={playerData.defensive.forcedFumbles} small />
          <StatBox label="Fumble Recoveries" value={playerData.defensive.fumbleRecoveries} small />
          <StatBox label="Fumble Return Yards" value={playerData.defensive.fumbleReturnYards} small />
          <StatBox label="Blocks" value={playerData.defensive.blocks} small />
          <StatBox label="Safeties" value={playerData.defensive.safeties} small />
        </div>
        </div>
      )}

      {/* Kicking Statistics */}
      {statSections.kicking && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Kicking Statistics
          </h2>

        <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Overall</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          <StatBox label="Field Goals Made" value={playerData.kicking.fgMade} small />
          <StatBox label="Field Goals Attempted" value={playerData.kicking.fgAttempted} small />
          <StatBox label="Field Goal %" value={playerData.kicking.fgPct > 0 ? `${playerData.kicking.fgPct}%` : '-'} small />
          <StatBox label="Field Goal Long" value={playerData.kicking.fgLong} small />
          <StatBox label="Extra Points Made" value={playerData.kicking.xpMade} small />
          <StatBox label="Extra Points Attempted" value={playerData.kicking.xpAttempted} small />
          <StatBox label="Extra Point %" value={playerData.kicking.xpPct > 0 ? `${playerData.kicking.xpPct}%` : '-'} small />
        </div>

        <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>By Distance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatBox label="FG 0-29 (Made/Att)" value={`${playerData.kicking.fg0_29Made}/${playerData.kicking.fg0_29Attempted}`} small />
          <StatBox label="FG 30-39 (Made/Att)" value={`${playerData.kicking.fg30_39Made}/${playerData.kicking.fg30_39Attempted}`} small />
          <StatBox label="FG 40-49 (Made/Att)" value={`${playerData.kicking.fg40_49Made}/${playerData.kicking.fg40_49Attempted}`} small />
          <StatBox label="FG 50+ (Made/Att)" value={`${playerData.kicking.fg50PlusMade}/${playerData.kicking.fg50PlusAttempted}`} small />
        </div>

        <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Kickoffs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatBox label="Kickoffs" value={playerData.kicking.kickoffs} small />
          <StatBox label="Touchbacks" value={playerData.kicking.touchbacks} small />
          <StatBox label="Touchback %" value={playerData.kicking.touchbackPct > 0 ? `${playerData.kicking.touchbackPct}%` : '-'} small />
          <StatBox label="FG Blocked" value={playerData.kicking.fgBlocked} small />
          <StatBox label="XP Blocked" value={playerData.kicking.xpBlocked} small />
        </div>
        </div>
      )}

      {/* Punting Statistics */}
      {statSections.punting && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Punting Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatBox label="Punts" value={playerData.punting.punts} small />
          <StatBox label="Punting Yards" value={playerData.punting.puntingYards} small />
          <StatBox label="Yards/Punt" value={playerData.punting.yardsPerPunt > 0 ? playerData.punting.yardsPerPunt.toFixed(1) : '-'} small />
          <StatBox label="Net Punting Yards" value={playerData.punting.netPuntingYards} small />
          <StatBox label="Net Yards/Punt" value={playerData.punting.netYardsPerPunt > 0 ? playerData.punting.netYardsPerPunt.toFixed(1) : '-'} small />
          <StatBox label="Punts Inside 20" value={playerData.punting.puntsInside20} small />
          <StatBox label="Touchbacks" value={playerData.punting.touchbacks} small />
          <StatBox label="Punt Long" value={playerData.punting.puntLong} small />
          <StatBox label="Punts Blocked" value={playerData.punting.puntsBlocked} small />
        </div>
        </div>
      )}

      {/* Return Statistics */}
      {(statSections.kickReturn || statSections.puntReturn) && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Return Statistics
          </h2>

          {statSections.kickReturn && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Kick Returns</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <StatBox label="Returns" value={playerData.kickReturn.returns} small />
          <StatBox label="Return Yardage" value={playerData.kickReturn.returnYardage} small />
          <StatBox label="Return Average" value={playerData.kickReturn.returnAverage > 0 ? playerData.kickReturn.returnAverage.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.kickReturn.touchdowns} small />
          <StatBox label="Return Long" value={playerData.kickReturn.returnLong} small />
        </div>
            </>
          )}

          {statSections.puntReturn && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Punt Returns</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatBox label="Returns" value={playerData.puntReturn.returns} small />
                <StatBox label="Return Yardage" value={playerData.puntReturn.returnYardage} small />
                <StatBox label="Return Average" value={playerData.puntReturn.returnAverage > 0 ? playerData.puntReturn.returnAverage.toFixed(1) : '-'} small />
                <StatBox label="Touchdowns" value={playerData.puntReturn.touchdowns} small />
                <StatBox label="Return Long" value={playerData.puntReturn.returnLong} small />
              </div>
            </>
          )}
        </div>
      )}

      {/* Scrimmage & Total Statistics */}
      {(statSections.scrimmage || statSections.total) && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Scrimmage & Total Statistics
          </h2>

          {statSections.scrimmage && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Scrimmage</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <StatBox label="Plays" value={playerData.scrimmage.plays} small />
          <StatBox label="Yards" value={playerData.scrimmage.yards} small />
          <StatBox label="Yards/Play" value={playerData.scrimmage.yardsPerPlay > 0 ? playerData.scrimmage.yardsPerPlay.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.scrimmage.touchdowns} small />
          <StatBox label="Yards/Game" value={playerData.scrimmage.yardsPerGame > 0 ? playerData.scrimmage.yardsPerGame.toFixed(1) : '-'} small />
        </div>
            </>
          )}

          {statSections.total && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Total</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatBox label="Plays" value={playerData.total.plays} small />
                <StatBox label="Yardage" value={playerData.total.yardage} small />
                <StatBox label="Yards/Play" value={playerData.total.yardsPerPlay > 0 ? playerData.total.yardsPerPlay.toFixed(1) : '-'} small />
                <StatBox label="Touchdowns" value={playerData.total.touchdowns} small />
                <StatBox label="Yards/Game" value={playerData.total.yardsPerGame > 0 ? playerData.total.yardsPerGame.toFixed(1) : '-'} small />
              </div>
            </>
          )}
        </div>
      )}

      {/* Notes & Media */}
      {(player.notes || (player.links && player.links.length > 0)) && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Notes & Media
          </h2>

          {/* Notes */}
          {player.notes && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2" style={{ color: primaryText, opacity: 0.7 }}>Notes</h3>
              <div
                className="p-4 rounded-lg whitespace-pre-wrap"
                style={{ backgroundColor: teamColors.secondary, color: secondaryText }}
              >
                {player.notes}
              </div>
            </div>
          )}

          {/* Links */}
          {player.links && player.links.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: primaryText, opacity: 0.7 }}>Links & Media</h3>
              <div className="flex flex-wrap gap-2">
                {player.links.map((link, index) => (
                  link.url && (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-80 transition-opacity flex items-center gap-2"
                      style={{ backgroundColor: teamColors.secondary, color: secondaryText }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {link.title || link.url}
                    </a>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div
        className="rounded-lg shadow-lg p-6 text-center"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <p className="text-sm" style={{ color: primaryText, opacity: 0.6 }}>
          * Most statistics are not yet tracked and will be updated as features are implemented.
        </p>
      </div>

      {/* Edit Modal */}
      <PlayerEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        player={player}
        teamColors={teamColors}
        onSave={handlePlayerSave}
        defaultSchool={dynasty.teamName}
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
                  <p className="text-sm font-semibold mt-0.5" style={{ color: primaryText, opacity: 0.9 }}>
                    {player.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowAccoladeModal(false)}
                  className="hover:opacity-70"
                  style={{ color: primaryText }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs sm:text-sm mt-2" style={{ color: primaryText, opacity: 0.7 }}>
                Click a game to view details
              </p>
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
                    to={`/dynasty/${dynastyId}/game/${game.id}`}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-lg border-2 gap-2 sm:gap-0 hover:opacity-90 transition-opacity text-left"
                    style={{
                      backgroundColor: opponentBgColor,
                      borderColor: isWin ? '#86efac' : '#fca5a5'
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-xs font-medium w-16 sm:w-20 flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.9 }}>
                        {game.year} Wk {game.week}
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{
                          backgroundColor: opponentTextColor,
                          color: opponentBgColor
                        }}>
                          {game.location === 'away' ? '@' : 'vs'}
                        </span>
                        {opponentLogo && (
                          <div
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: `2px solid ${opponentTextColor}`,
                              padding: '2px'
                            }}
                          >
                            <img
                              src={opponentLogo}
                              alt={`${opponentName} logo`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1 min-w-0">
                          {game.opponentRank && (
                            <span className="text-xs font-bold flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.7 }}>
                              #{game.opponentRank}
                            </span>
                          )}
                          <span className="text-sm font-semibold truncate" style={{ color: opponentTextColor }}>
                            {opponentName}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start">
                      <div
                        className="text-sm font-bold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: isWin ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {isWin ? 'W' : 'L'}
                      </div>
                      <div className="text-sm font-bold" style={{ color: opponentTextColor }}>
                        {game.teamScore}-{game.opponentScore}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
