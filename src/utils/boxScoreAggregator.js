// Box Score Aggregator Utility
// Aggregates per-game box score stats into season totals for players

import { getAbbreviationFromDisplayName } from '../data/teamAbbreviations'

/**
 * Aggregate all box score stats for a player across games in a specific year
 * @param {Object} dynasty - The dynasty object containing games
 * @param {string} playerName - The player's name to search for
 * @param {number} year - The year to aggregate stats for
 * @param {string} teamAbbr - The player's team abbreviation
 * @returns {Object} Aggregated stats by category
 */
export function aggregatePlayerBoxScoreStats(dynasty, playerName, year, teamAbbr) {
  if (!dynasty?.games || !playerName) return null

  // Find all games for this year where the user's team played
  // Exclude CPU games - they have different property structure
  const yearGames = dynasty.games.filter(g => {
    const gameYear = Number(g.year)
    if (gameYear !== year) return false
    // Game must have box score data and not be a CPU game
    if (!g.boxScore || g.isCPUGame) return false
    // User's team must be involved (either home or away)
    const userTeam = g.userTeam || teamAbbr
    return g.opponent || g.team1 === userTeam || g.team2 === userTeam
  })

  if (yearGames.length === 0) return null

  // Initialize aggregated stats
  const stats = {
    gamesWithStats: 0,
    passing: null,
    rushing: null,
    receiving: null,
    blocking: null,
    defense: null,
    kicking: null,
    punting: null,
    kickReturn: null,
    puntReturn: null
  }

  // Stat aggregation configs - which fields to sum vs take max
  const statConfigs = {
    passing: {
      sumFields: ['comp', 'attempts', 'yards', 'tD', 'iNT', 'sacks'],
      maxFields: ['long'],
      rateFields: ['qBRating'] // Calculated at the end
    },
    rushing: {
      sumFields: ['carries', 'yards', 'tD', 'fumbles', 'brokenTackles', 'yAC', '20+'],
      maxFields: ['long']
    },
    receiving: {
      sumFields: ['receptions', 'yards', 'tD', 'drops', 'rAC'],
      maxFields: ['long']
    },
    blocking: {
      sumFields: ['sacksAllowed', 'pancakes'],
      maxFields: []
    },
    defense: {
      sumFields: ['solo', 'assists', 'tFL', 'sack', 'iNT', 'iNTYards', 'deflections', 'fF', 'fR', 'fumbleYards', 'blocks', 'safeties', 'tD'],
      maxFields: ['iNTLong']
    },
    kicking: {
      sumFields: ['fGM', 'fGA', 'fGBlock', 'xPM', 'xPA', 'xPB', 'fGM29', 'fGA29', 'fGM39', 'fGA39', 'fGM49', 'fGA49', 'fGM50+', 'fGA50+', 'kickoffs', 'touchbacks'],
      maxFields: ['fGLong']
    },
    punting: {
      sumFields: ['punts', 'yards', 'netYards', 'block', 'in20', 'tB'],
      maxFields: ['long']
    },
    kickReturn: {
      sumFields: ['kR', 'yards', 'tD'],
      maxFields: ['long']
    },
    puntReturn: {
      sumFields: ['pR', 'yards', 'tD'],
      maxFields: ['long']
    }
  }

  // Process each game
  yearGames.forEach(game => {
    const boxScore = game.boxScore
    if (!boxScore) return

    // Determine which side of the box score the player's team is on
    // home = user's team when they're home, away = user's team when they're away
    const isHome = game.location === 'home'
    const teamBoxScore = isHome ? boxScore.home : boxScore.away

    if (!teamBoxScore) return

    let foundInGame = false

    // Process each stat category
    Object.keys(statConfigs).forEach(category => {
      const categoryStats = teamBoxScore[category]
      if (!categoryStats || !Array.isArray(categoryStats)) return

      // Find player in this category
      const playerStats = categoryStats.find(p =>
        p.playerName?.toLowerCase().trim() === playerName.toLowerCase().trim()
      )

      if (!playerStats) return

      foundInGame = true
      const config = statConfigs[category]

      // Initialize category if needed
      if (!stats[category]) {
        stats[category] = {}
        config.sumFields.forEach(f => stats[category][f] = 0)
        config.maxFields.forEach(f => stats[category][f] = 0)
      }

      // Sum fields
      config.sumFields.forEach(field => {
        const value = parseFloat(playerStats[field]) || 0
        stats[category][field] = (stats[category][field] || 0) + value
      })

      // Max fields (for "long" stats)
      config.maxFields.forEach(field => {
        const value = parseFloat(playerStats[field]) || 0
        stats[category][field] = Math.max(stats[category][field] || 0, value)
      })
    })

    if (foundInGame) {
      stats.gamesWithStats++
    }
  })

  // Calculate QB Rating if we have passing stats
  if (stats.passing && stats.passing.attempts > 0) {
    const { comp, attempts, yards, tD, iNT } = stats.passing
    // NFL passer rating formula (simplified)
    const a = Math.max(0, Math.min(2.375, ((comp / attempts) - 0.3) * 5))
    const b = Math.max(0, Math.min(2.375, ((yards / attempts) - 3) * 0.25))
    const c = Math.max(0, Math.min(2.375, (tD / attempts) * 20))
    const d = Math.max(0, Math.min(2.375, 2.375 - ((iNT / attempts) * 25)))
    stats.passing.qBRating = (((a + b + c + d) / 6) * 100).toFixed(1)
  }

  return stats.gamesWithStats > 0 ? stats : null
}

/**
 * Get all season stats for a player from box scores
 * Returns data in the format expected by Player.jsx yearByYearStats
 * @param {Object} dynasty - The dynasty object
 * @param {Object} player - The player object
 * @returns {Array} Array of year stats objects
 */
export function getPlayerSeasonStatsFromBoxScores(dynasty, player) {
  if (!dynasty?.games || !player) return []

  const playerName = player.name
  const teamAbbr = player.team

  // Find all years where this player appears in box scores
  // Exclude CPU games - they have different property structure
  const years = new Set()
  dynasty.games.forEach(game => {
    if (!game.boxScore || !game.year || game.isCPUGame) return
    const boxScore = game.boxScore
    const checkCategory = (side) => {
      if (!boxScore[side]) return false
      return Object.values(boxScore[side]).some(category =>
        Array.isArray(category) && category.some(p =>
          p.playerName?.toLowerCase().trim() === playerName.toLowerCase().trim()
        )
      )
    }
    if (checkCategory('home') || checkCategory('away')) {
      years.add(Number(game.year))
    }
  })

  const result = []

  Array.from(years).sort((a, b) => a - b).forEach(year => {
    const aggregated = aggregatePlayerBoxScoreStats(dynasty, playerName, year, teamAbbr)
    if (!aggregated) return

    // Convert to the format expected by Player.jsx
    const yearStats = {
      year,
      gamesPlayed: aggregated.gamesWithStats,
      fromBoxScores: true // Flag to indicate this came from box scores
    }

    // Map aggregated stats to display format
    if (aggregated.passing) {
      yearStats.passing = {
        cmp: aggregated.passing.comp || 0,
        att: aggregated.passing.attempts || 0,
        yds: aggregated.passing.yards || 0,
        td: aggregated.passing.tD || 0,
        int: aggregated.passing.iNT || 0,
        lng: aggregated.passing.long || 0,
        sacks: aggregated.passing.sacks || 0,
        rating: aggregated.passing.qBRating || 0
      }
    }

    if (aggregated.rushing) {
      yearStats.rushing = {
        car: aggregated.rushing.carries || 0,
        yds: aggregated.rushing.yards || 0,
        td: aggregated.rushing.tD || 0,
        lng: aggregated.rushing.long || 0,
        fum: aggregated.rushing.fumbles || 0,
        bt: aggregated.rushing.brokenTackles || 0
      }
    }

    if (aggregated.receiving) {
      yearStats.receiving = {
        rec: aggregated.receiving.receptions || 0,
        yds: aggregated.receiving.yards || 0,
        td: aggregated.receiving.tD || 0,
        lng: aggregated.receiving.long || 0,
        drops: aggregated.receiving.drops || 0
      }
    }

    if (aggregated.blocking) {
      yearStats.blocking = {
        sacksAllowed: aggregated.blocking.sacksAllowed || 0,
        pancakes: aggregated.blocking.pancakes || 0
      }
    }

    if (aggregated.defense) {
      yearStats.defensive = {
        solo: aggregated.defense.solo || 0,
        ast: aggregated.defense.assists || 0,
        tfl: aggregated.defense.tFL || 0,
        sacks: aggregated.defense.sack || 0,
        int: aggregated.defense.iNT || 0,
        intYds: aggregated.defense.iNTYards || 0,
        intTd: aggregated.defense.tD || 0,
        pdef: aggregated.defense.deflections || 0,
        ff: aggregated.defense.fF || 0,
        fr: aggregated.defense.fR || 0
      }
    }

    if (aggregated.kicking) {
      yearStats.kicking = {
        fgm: aggregated.kicking.fGM || 0,
        fga: aggregated.kicking.fGA || 0,
        lng: aggregated.kicking.fGLong || 0,
        xpm: aggregated.kicking.xPM || 0,
        xpa: aggregated.kicking.xPA || 0
      }
    }

    if (aggregated.punting) {
      yearStats.punting = {
        punts: aggregated.punting.punts || 0,
        yds: aggregated.punting.yards || 0,
        lng: aggregated.punting.long || 0,
        in20: aggregated.punting.in20 || 0,
        tb: aggregated.punting.tB || 0
      }
    }

    if (aggregated.kickReturn) {
      yearStats.kickReturn = {
        ret: aggregated.kickReturn.kR || 0,
        yds: aggregated.kickReturn.yards || 0,
        td: aggregated.kickReturn.tD || 0,
        lng: aggregated.kickReturn.long || 0
      }
    }

    if (aggregated.puntReturn) {
      yearStats.puntReturn = {
        ret: aggregated.puntReturn.pR || 0,
        yds: aggregated.puntReturn.yards || 0,
        td: aggregated.puntReturn.tD || 0,
        lng: aggregated.puntReturn.long || 0
      }
    }

    result.push(yearStats)
  })

  return result
}

/**
 * Get per-game stats breakdown for a player in a specific year
 * @param {Object} dynasty - The dynasty object
 * @param {string} playerName - The player's name
 * @param {number} year - The year to get game log for
 * @param {string} teamAbbr - The player's team abbreviation
 * @returns {Array} Array of per-game stats
 */
export function getPlayerGameLog(dynasty, playerName, year, teamAbbr) {
  if (!dynasty?.games || !playerName) return []

  // Get all games for this year that have box scores
  // Exclude CPU games - they have team1/team2 instead of opponent/teamScore structure
  const yearGames = dynasty.games.filter(g =>
    Number(g.year) === year && g.boxScore && !g.isCPUGame
  ).sort((a, b) => {
    const weekA = a.week || 0
    const weekB = b.week || 0
    return weekA - weekB
  })

  const gameLog = []
  const categories = ['passing', 'rushing', 'receiving', 'blocking', 'defense', 'kicking', 'punting', 'kickReturn', 'puntReturn']

  yearGames.forEach(game => {
    const boxScore = game.boxScore
    if (!boxScore) return

    // Search BOTH home and away box scores for this player
    // This handles all cases: user's team, opponent team, any team
    let playerFoundIn = null // 'home' or 'away'
    let playerStats = {}

    for (const side of ['home', 'away']) {
      if (!boxScore[side]) continue

      categories.forEach(category => {
        const categoryStats = boxScore[side][category]
        if (!categoryStats || !Array.isArray(categoryStats)) return

        const found = categoryStats.find(p =>
          p.playerName?.toLowerCase().trim() === playerName.toLowerCase().trim()
        )

        if (found) {
          playerFoundIn = side
          playerStats[category] = { ...found }
        }
      })

      if (playerFoundIn) break // Found player, stop searching
    }

    if (!playerFoundIn) return // Player not in this game

    // Determine game details from player's perspective
    // If player is in 'home' box score and user was home, OR player is in 'away' and user was away -> same team as user
    const isHome = game.location === 'home' || game.location === 'Home'
    const playerOnUserSide = (playerFoundIn === 'home' && isHome) || (playerFoundIn === 'away' && !isHome)

    let opponent, playerTeamScore, playerOpponentScore, playerResult

    if (playerOnUserSide) {
      // Player is on user's team
      opponent = game.opponent
      playerTeamScore = game.teamScore
      playerOpponentScore = game.opponentScore
      playerResult = game.result
    } else {
      // Player is on opponent's team
      opponent = game.userTeam || getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
      playerTeamScore = game.opponentScore
      playerOpponentScore = game.teamScore
      // Invert result
      if (game.result === 'W' || game.result === 'win') {
        playerResult = 'L'
      } else if (game.result === 'L' || game.result === 'loss') {
        playerResult = 'W'
      } else {
        playerResult = game.result
      }
    }

    gameLog.push({
      gameId: game.id,
      week: game.week,
      opponent,
      result: playerResult,
      teamScore: playerTeamScore,
      opponentScore: playerOpponentScore,
      ...playerStats
    })
  })

  return gameLog
}
