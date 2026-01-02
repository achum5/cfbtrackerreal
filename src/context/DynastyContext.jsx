import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import {
  getUserDynasties,
  subscribeToDynasties,
  createDynasty as createDynastyInFirestore,
  updateDynasty as updateDynastyInFirestore,
  deleteDynasty as deleteDynastyFromFirestore,
  migrateLocalStorageData
} from '../services/dynastyService'
import { createDynastySheet, deleteGoogleSheet, writeExistingDataToSheet, createConferencesSheet, readConferencesFromSheet } from '../services/sheetsService'
import { getAbbreviationFromDisplayName, getTeamName } from '../data/teamAbbreviations'
import { getTeamConference } from '../data/conferenceTeams'
import { findMatchingPlayer, getPlayerLastHonorDescription, normalizePlayerName } from '../utils/playerMatching'
import { getFirstRoundSlotId, getSlotIdFromBowlName, getCFPGameId } from '../data/cfpConstants'

const DynastyContext = createContext()

// ============================================================================
// GAME TYPE CONSTANTS - Unified game classification system
// ============================================================================
export const GAME_TYPES = {
  REGULAR: 'regular',
  CONFERENCE_CHAMPIONSHIP: 'conference_championship',
  BOWL: 'bowl',
  CFP_FIRST_ROUND: 'cfp_first_round',
  CFP_QUARTERFINAL: 'cfp_quarterfinal',
  CFP_SEMIFINAL: 'cfp_semifinal',
  CFP_CHAMPIONSHIP: 'cfp_championship'
}

/**
 * Detect game type from existing game flags
 * Used during migration and for backwards compatibility
 */
export function detectGameType(game) {
  if (game.gameType) return game.gameType // Already has type
  if (game.isCFPChampionship) return GAME_TYPES.CFP_CHAMPIONSHIP
  if (game.isCFPSemifinal) return GAME_TYPES.CFP_SEMIFINAL
  if (game.isCFPQuarterfinal) return GAME_TYPES.CFP_QUARTERFINAL
  if (game.isCFPFirstRound) return GAME_TYPES.CFP_FIRST_ROUND
  if (game.isConferenceChampionship) return GAME_TYPES.CONFERENCE_CHAMPIONSHIP
  if (game.isBowlGame) return GAME_TYPES.BOWL
  return GAME_TYPES.REGULAR
}

/**
 * Get games by type from unified games array
 * @param {Object} dynasty - The dynasty object
 * @param {string} gameType - One of GAME_TYPES values
 * @param {number} [year] - Optional year filter
 * @returns {Array} Games matching the type
 */
export function getGamesByType(dynasty, gameType, year = null) {
  if (!dynasty) return []
  const games = dynasty.games || []

  return games.filter(g => {
    const type = detectGameType(g)
    if (type !== gameType) return false
    if (year !== null && Number(g.year) !== Number(year)) return false
    return true
  })
}

/**
 * Get all CFP games for a year (all CFP rounds)
 */
export function getCFPGames(dynasty, year) {
  if (!dynasty) return []
  const games = dynasty.games || []

  return games.filter(g => {
    if (Number(g.year) !== Number(year)) return false
    const type = detectGameType(g)
    return type === GAME_TYPES.CFP_FIRST_ROUND ||
           type === GAME_TYPES.CFP_QUARTERFINAL ||
           type === GAME_TYPES.CFP_SEMIFINAL ||
           type === GAME_TYPES.CFP_CHAMPIONSHIP
  })
}

/**
 * Get a specific game by teams and year (for finding duplicates)
 */
export function findGameByTeams(dynasty, team1, team2, year, gameType = null) {
  if (!dynasty) return null
  const games = dynasty.games || []

  return games.find(g => {
    if (Number(g.year) !== Number(year)) return false

    // Check if teams match (in either order)
    const teamsMatch =
      (g.team1 === team1 && g.team2 === team2) ||
      (g.team1 === team2 && g.team2 === team1) ||
      (g.userTeam === team1 && g.opponent === team2) ||
      (g.userTeam === team2 && g.opponent === team1)

    if (!teamsMatch) return false

    // If gameType specified, check it matches
    if (gameType && detectGameType(g) !== gameType) return false

    return true
  })
}

/**
 * Migrate dynasty to unified game system
 * Converts cfpResultsByYear, bowlGamesByYear, conferenceChampionshipsByYear to games[]
 * Safe to run multiple times (idempotent)
 */
export function migrateToUnifiedGames(dynasty) {
  if (!dynasty) return dynasty

  const existingGames = [...(dynasty.games || [])]
  const migratedGames = []
  const processedKeys = new Set() // Track what we've processed to avoid duplicates

  // Helper to generate a unique key for dedup
  const getGameKey = (year, team1, team2, type) => {
    const teams = [team1, team2].sort().join('-')
    return `${year}-${teams}-${type}`
  }

  // Helper to check if game already exists
  const gameExists = (year, team1, team2, type) => {
    const key = getGameKey(year, team1, team2, type)
    if (processedKeys.has(key)) return true

    // Check in existing games array
    const found = existingGames.find(g => {
      const gType = detectGameType(g)
      if (gType !== type) return false
      if (Number(g.year) !== Number(year)) return false

      const gTeam1 = g.team1 || g.userTeam
      const gTeam2 = g.team2 || g.opponent
      const matchedTeams = [gTeam1, gTeam2].sort().join('-')
      return matchedTeams === [team1, team2].sort().join('-')
    })

    return !!found
  }

  // Process existing games - add gameType if missing
  existingGames.forEach(game => {
    const gameType = detectGameType(game)
    const team1 = game.team1 || game.userTeam
    const team2 = game.team2 || game.opponent
    const key = getGameKey(game.year, team1, team2, gameType)

    migratedGames.push({
      ...game,
      gameType,
      // Normalize team fields
      team1: team1,
      team2: team2
    })
    processedKeys.add(key)
  })

  // Migrate CFP results
  const cfpResults = dynasty.cfpResultsByYear || {}
  Object.entries(cfpResults).forEach(([year, yearData]) => {
    if (!yearData) return

    // First Round
    const firstRound = Array.isArray(yearData.firstRound) ? yearData.firstRound : []
    firstRound.forEach(game => {
      if (!game || !game.team1 || !game.team2) return
      if (gameExists(year, game.team1, game.team2, GAME_TYPES.CFP_FIRST_ROUND)) return

      const key = getGameKey(year, game.team1, game.team2, GAME_TYPES.CFP_FIRST_ROUND)
      processedKeys.add(key)

      migratedGames.push({
        id: game.id || `migrate-cfp-fr-${year}-${game.team1}-${game.team2}`,
        year: Number(year),
        gameType: GAME_TYPES.CFP_FIRST_ROUND,
        team1: game.team1,
        team2: game.team2,
        team1Score: game.team1Score,
        team2Score: game.team2Score,
        winner: game.winner,
        cfpSeed1: game.seed1,
        cfpSeed2: game.seed2,
        isCFPFirstRound: true // Keep legacy flag for backwards compat
      })
    })

    // Quarterfinals
    const quarterfinals = Array.isArray(yearData.quarterfinals) ? yearData.quarterfinals : []
    quarterfinals.forEach(game => {
      if (!game || !game.team1 || !game.team2) return
      if (gameExists(year, game.team1, game.team2, GAME_TYPES.CFP_QUARTERFINAL)) return

      const key = getGameKey(year, game.team1, game.team2, GAME_TYPES.CFP_QUARTERFINAL)
      processedKeys.add(key)

      migratedGames.push({
        id: game.id || `migrate-cfp-qf-${year}-${game.team1}-${game.team2}`,
        year: Number(year),
        gameType: GAME_TYPES.CFP_QUARTERFINAL,
        team1: game.team1,
        team2: game.team2,
        team1Score: game.team1Score,
        team2Score: game.team2Score,
        winner: game.winner,
        bowlName: game.bowlName,
        cfpSeed1: game.seed1,
        cfpSeed2: game.seed2,
        isCFPQuarterfinal: true
      })
    })

    // Semifinals
    const semifinals = Array.isArray(yearData.semifinals) ? yearData.semifinals : []
    semifinals.forEach(game => {
      if (!game || !game.team1 || !game.team2) return
      if (gameExists(year, game.team1, game.team2, GAME_TYPES.CFP_SEMIFINAL)) return

      const key = getGameKey(year, game.team1, game.team2, GAME_TYPES.CFP_SEMIFINAL)
      processedKeys.add(key)

      migratedGames.push({
        id: game.id || `migrate-cfp-sf-${year}-${game.team1}-${game.team2}`,
        year: Number(year),
        gameType: GAME_TYPES.CFP_SEMIFINAL,
        team1: game.team1,
        team2: game.team2,
        team1Score: game.team1Score,
        team2Score: game.team2Score,
        winner: game.winner,
        bowlName: game.bowlName,
        cfpSeed1: game.seed1,
        cfpSeed2: game.seed2,
        isCFPSemifinal: true
      })
    })

    // Championship
    const championship = Array.isArray(yearData.championship) ? yearData.championship : []
    championship.forEach(game => {
      if (!game || !game.team1 || !game.team2) return
      if (gameExists(year, game.team1, game.team2, GAME_TYPES.CFP_CHAMPIONSHIP)) return

      const key = getGameKey(year, game.team1, game.team2, GAME_TYPES.CFP_CHAMPIONSHIP)
      processedKeys.add(key)

      migratedGames.push({
        id: game.id || `migrate-cfp-nc-${year}-${game.team1}-${game.team2}`,
        year: Number(year),
        gameType: GAME_TYPES.CFP_CHAMPIONSHIP,
        team1: game.team1,
        team2: game.team2,
        team1Score: game.team1Score,
        team2Score: game.team2Score,
        winner: game.winner,
        cfpSeed1: game.seed1,
        cfpSeed2: game.seed2,
        isCFPChampionship: true
      })
    })
  })

  // Migrate Bowl results
  const bowlResults = dynasty.bowlGamesByYear || {}
  Object.entries(bowlResults).forEach(([year, yearData]) => {
    if (!yearData) return

    // Process week1 and week2 bowls
    ['week1', 'week2'].forEach(weekKey => {
      const weekGames = Array.isArray(yearData[weekKey]) ? yearData[weekKey] : []
      weekGames.forEach(game => {
        if (!game || !game.team1 || !game.team2) return
        if (!game.bowlName) return // Skip if no bowl name
        if (gameExists(year, game.team1, game.team2, GAME_TYPES.BOWL)) return

        const key = getGameKey(year, game.team1, game.team2, GAME_TYPES.BOWL)
        processedKeys.add(key)

        migratedGames.push({
          id: game.id || `migrate-bowl-${year}-${game.bowlName.replace(/\s+/g, '-')}`,
          year: Number(year),
          gameType: GAME_TYPES.BOWL,
          team1: game.team1,
          team2: game.team2,
          team1Score: game.team1Score,
          team2Score: game.team2Score,
          winner: game.winner,
          bowlName: game.bowlName,
          bowlWeek: weekKey,
          isBowlGame: true
        })
      })
    })
  })

  // Migrate Conference Championship results
  const ccResults = dynasty.conferenceChampionshipsByYear || {}
  Object.entries(ccResults).forEach(([year, yearData]) => {
    if (!yearData) return

    const games = Array.isArray(yearData) ? yearData : []
    games.forEach(game => {
      if (!game || !game.team1 || !game.team2) return
      if (gameExists(year, game.team1, game.team2, GAME_TYPES.CONFERENCE_CHAMPIONSHIP)) return

      const key = getGameKey(year, game.team1, game.team2, GAME_TYPES.CONFERENCE_CHAMPIONSHIP)
      processedKeys.add(key)

      migratedGames.push({
        id: game.id || `migrate-cc-${year}-${game.conference || 'unknown'}`,
        year: Number(year),
        gameType: GAME_TYPES.CONFERENCE_CHAMPIONSHIP,
        team1: game.team1,
        team2: game.team2,
        team1Score: game.team1Score,
        team2Score: game.team2Score,
        winner: game.winner,
        conference: game.conference,
        isConferenceChampionship: true
      })
    })
  })

  return {
    ...dynasty,
    games: migratedGames,
    // Mark as migrated to avoid re-running
    _gamesMigrated: true
  }
}

// ============================================================================
// BOX SCORE STATS AGGREGATION
// Aggregate player stats from game box scores into player.statsByYear
// ============================================================================

/**
 * Box score category definitions
 * Maps box score field names to aggregation strategy
 * 'sum' = add values across games, 'max' = take max (for long plays)
 */
const BOX_SCORE_STATS = {
  passing: {
    sum: ['comp', 'attempts', 'yards', 'tD', 'iNT', 'sacks'],
    max: ['long']
  },
  rushing: {
    sum: ['carries', 'yards', 'tD', 'fumbles', '20+', 'brokenTackles', 'yAC'],
    max: ['long']
  },
  receiving: {
    sum: ['receptions', 'yards', 'tD', 'rAC', 'drops'],
    max: ['long']
  },
  blocking: {
    sum: ['pancakes', 'sacksAllowed']
  },
  defense: {
    sum: ['solo', 'assists', 'tFL', 'sack', 'iNT', 'iNTYards', 'deflections', 'tD', 'fF', 'fR']
  },
  kicking: {
    sum: ['fGM', 'fGA', 'xPM', 'xPA', 'kickoffs', 'touchbacks']
  },
  punting: {
    sum: ['punts', 'yards', 'netYards', 'in20', 'touchbacks'],
    max: ['long']
  },
  kickReturn: {
    sum: ['kR', 'yards', 'tD'],
    max: ['long']
  },
  puntReturn: {
    sum: ['pR', 'yards', 'tD'],
    max: ['long']
  }
}

/**
 * Aggregate box score stats from all games for a specific year into player.statsByYear
 * @param {Object} dynasty - The dynasty object
 * @param {number|string} year - The year to aggregate stats for
 * @param {string} userTeamAbbr - The user's team abbreviation
 * @returns {Array} Updated players array with aggregated stats
 */
export function aggregateBoxScoreStats(dynasty, year, userTeamAbbr) {
  if (!dynasty) return dynasty.players || []

  const yearNum = Number(year)
  const players = dynasty.players || []
  const games = dynasty.games || []

  // Get all user's games with box scores for this year
  const gamesWithBoxScores = games.filter(g => {
    if (Number(g.year) !== yearNum) return false
    if (!g.boxScore) return false
    // Only process games where user was playing (has userTeam or opponent matches)
    return g.userTeam === userTeamAbbr || g.opponent
  })

  // Map to aggregate stats by player name (lowercase for matching)
  const playerStatsMap = new Map()

  gamesWithBoxScores.forEach(game => {
    // Determine which side of box score is user's team
    const isHome = game.location === 'home' || game.location === 'Home' || game.location === 'neutral'
    const userBoxScore = isHome ? game.boxScore.home : game.boxScore.away

    if (!userBoxScore) return

    // Process each stat category
    Object.keys(BOX_SCORE_STATS).forEach(category => {
      const categoryStats = userBoxScore[category]
      if (!Array.isArray(categoryStats)) return

      const aggregationRules = BOX_SCORE_STATS[category]

      categoryStats.forEach(playerRow => {
        const playerName = playerRow.playerName?.toLowerCase().trim()
        if (!playerName) return

        // Initialize player stats if not exists
        if (!playerStatsMap.has(playerName)) {
          playerStatsMap.set(playerName, {
            gamesPlayed: 0,
            snapsPlayed: 0
          })
        }

        const aggStats = playerStatsMap.get(playerName)

        // Initialize category if not exists
        if (!aggStats[category]) {
          aggStats[category] = {}
        }

        // Aggregate sum fields
        if (aggregationRules.sum) {
          aggregationRules.sum.forEach(field => {
            const value = parseFloat(playerRow[field]) || 0
            aggStats[category][field] = (aggStats[category][field] || 0) + value
          })
        }

        // Aggregate max fields (for long plays)
        if (aggregationRules.max) {
          aggregationRules.max.forEach(field => {
            const value = parseFloat(playerRow[field]) || 0
            aggStats[category][field] = Math.max(aggStats[category][field] || 0, value)
          })
        }
      })
    })

    // Track games played for each player who had stats in this game
    const allPlayerNames = new Set()
    Object.values(userBoxScore).forEach(categoryData => {
      if (Array.isArray(categoryData)) {
        categoryData.forEach(row => {
          if (row.playerName) {
            allPlayerNames.add(row.playerName.toLowerCase().trim())
          }
        })
      }
    })

    allPlayerNames.forEach(name => {
      if (playerStatsMap.has(name)) {
        playerStatsMap.get(name).gamesPlayed = (playerStatsMap.get(name).gamesPlayed || 0) + 1
      }
    })
  })

  // Update each player's statsByYear with aggregated stats
  const updatedPlayers = players.map(player => {
    const playerNameLower = player.name?.toLowerCase().trim()
    const aggStats = playerStatsMap.get(playerNameLower)

    if (!aggStats) return player

    const existingStatsByYear = player.statsByYear || {}
    const existingYearStats = existingStatsByYear[yearNum] || {}

    // Merge aggregated stats into existing stats
    // (preserves manually entered stats from DetailedStatsEntryModal)
    const mergedYearStats = { ...existingYearStats }

    // Update gamesPlayed from box scores if available
    if (aggStats.gamesPlayed > 0) {
      mergedYearStats.gamesPlayed = aggStats.gamesPlayed
    }

    // Merge each category's stats
    Object.keys(BOX_SCORE_STATS).forEach(category => {
      if (aggStats[category] && Object.keys(aggStats[category]).length > 0) {
        mergedYearStats[category] = {
          ...(mergedYearStats[category] || {}),
          ...aggStats[category]
        }
      }
    })

    return {
      ...player,
      statsByYear: {
        ...existingStatsByYear,
        [yearNum]: mergedYearStats
      }
    }
  })

  return updatedPlayers
}

// ============================================================================
// TEAM-CENTRIC HELPER FUNCTIONS
// These functions get/set data specific to the current team and year
// ============================================================================

/**
 * Get the current team's schedule for the current year
 * Falls back to legacy dynasty.schedule for backwards compatibility
 */
export function getCurrentSchedule(dynasty) {
  if (!dynasty) return []

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const year = dynasty.currentYear

  // Try new team-centric structure first
  const teamYearSchedule = dynasty.schedulesByTeamYear?.[teamAbbr]?.[year]
  if (teamYearSchedule) {
    return teamYearSchedule
  }

  // Only fall back to legacy schedule for the dynasty's first year
  // For subsequent years, return empty (new year = new schedule needed)
  if (year === dynasty.startYear) {
    const legacySchedule = dynasty.schedule || []
    if (legacySchedule.length > 0) {
      const firstEntry = legacySchedule[0]
      // If legacy schedule has userTeam that matches current team, use it
      if (firstEntry.userTeam === teamAbbr || !firstEntry.userTeam) {
        return legacySchedule
      }
    }
  }

  return []
}

/**
 * Get the current team's roster (non-honor-only players for current team)
 * Falls back to legacy filtering for backwards compatibility
 */
export function getCurrentRoster(dynasty) {
  if (!dynasty) return []

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const currentYear = dynasty.currentYear
  const allPlayers = dynasty.players || []

  // Filter players by team (if they have team field) and exclude honor-only, recruits, and players who left
  return allPlayers.filter(p => {
    // Always exclude honor-only players from roster view
    if (p.isHonorOnly) return false

    // Exclude recruits - they haven't enrolled yet (show on recruiting page instead)
    if (p.isRecruit) return false

    // Exclude players who have left the team (graduated, transferred, drafted, etc.)
    if (p.leftTeam) return false

    // CRITICAL: If player has a recruitYear, they don't play until the NEXT year
    // (recruitYear = their recruiting class year, they start playing recruitYear + 1)
    // So if currentYear <= recruitYear, don't show them yet
    // Use Number() to handle string/number type mismatch
    if (p.recruitYear && Number(currentYear) <= Number(p.recruitYear)) return false

    // If player has team field, check it matches current team
    if (p.team) {
      return p.team === teamAbbr
    }

    // Legacy: players without team field belong to current team
    // (This is the backwards-compatible behavior)
    return true
  })
}

/**
 * Get all players including honor-only (for awards, all-americans, etc.)
 */
export function getAllPlayers(dynasty) {
  if (!dynasty) return []
  return dynasty.players || []
}

/**
 * Get games for the current team only
 * IMPORTANT: This filters by userTeam to ensure team-centric data when coach switches teams
 * @param {Object} dynasty - The dynasty object
 * @param {number} [year] - Optional year filter (defaults to all years for current team)
 * @returns {Array} Games played by the current team
 */
export function getCurrentTeamGames(dynasty, year = null) {
  if (!dynasty) return []

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const allGames = dynasty.games || []

  return allGames.filter(g => {
    // CPU games (team1/team2 without userTeam) are not tied to a specific user team
    // Skip games that have team1/team2 but no userTeam - these are CPU vs CPU games
    if (!g.userTeam && g.team1 && g.team2) return false

    // Check if game belongs to current team
    const gameTeam = g.userTeam
    const belongsToCurrentTeam = gameTeam === teamAbbr ||
      gameTeam === dynasty.teamName ||
      (!gameTeam) // Legacy games without userTeam belong to current team if user hasn't switched

    if (!belongsToCurrentTeam) return false

    // Optionally filter by year
    if (year !== null) {
      return Number(g.year) === Number(year)
    }

    return true
  })
}

/**
 * Find a specific game for the current team
 * @param {Object} dynasty - The dynasty object
 * @param {Function} predicate - Filter function (receives game object)
 * @returns {Object|undefined} The matching game or undefined
 */
export function findCurrentTeamGame(dynasty, predicate) {
  const teamGames = getCurrentTeamGames(dynasty)
  return teamGames.find(predicate)
}

/**
 * Get preseason setup flags for current team and year
 */
export function getCurrentPreseasonSetup(dynasty) {
  const defaultSetup = {
    scheduleEntered: false,
    rosterEntered: false,
    teamRatingsEntered: false,
    coachingStaffEntered: false,
    conferencesEntered: false
  }

  if (!dynasty) return defaultSetup

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const year = dynasty.currentYear

  // Try new team-centric structure first
  const teamYearSetup = dynasty.preseasonSetupByTeamYear?.[teamAbbr]?.[year]
  if (teamYearSetup) {
    return teamYearSetup
  }

  // Only fall back to legacy preseasonSetup for the dynasty's first year
  // For subsequent years, return fresh defaults (new year = new preseason setup)
  if (year === dynasty.startYear) {
    return dynasty.preseasonSetup || defaultSetup
  }

  // New year without preseason setup initialized yet - return defaults
  return defaultSetup
}

/**
 * Get team ratings for current team and year
 */
export function getCurrentTeamRatings(dynasty) {
  const defaultRatings = { overall: null, offense: null, defense: null }

  if (!dynasty) return defaultRatings

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const year = dynasty.currentYear

  // Try new team-centric structure first
  const teamYearRatings = dynasty.teamRatingsByTeamYear?.[teamAbbr]?.[year]
  if (teamYearRatings) {
    return teamYearRatings
  }

  // Only fall back to legacy teamRatings for the dynasty's first year
  // For subsequent years, return defaults (new year = new ratings needed)
  if (year === dynasty.startYear) {
    return dynasty.teamRatings || defaultRatings
  }

  return defaultRatings
}

/**
 * Get coaching staff for current team and year
 * Note: Coaching staff carries over from year to year (unlike schedule/ratings)
 */
export function getCurrentCoachingStaff(dynasty) {
  const defaultStaff = { hcName: null, ocName: null, dcName: null }

  if (!dynasty) return defaultStaff

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const year = dynasty.currentYear

  // Try new team-centric structure first
  const teamYearStaff = dynasty.coachingStaffByTeamYear?.[teamAbbr]?.[year]
  if (teamYearStaff) {
    return teamYearStaff
  }

  // For coaching staff, try previous year's staff (staff carries over)
  const previousYearStaff = dynasty.coachingStaffByTeamYear?.[teamAbbr]?.[year - 1]
  if (previousYearStaff) {
    return previousYearStaff
  }

  // Only fall back to legacy coachingStaff for the dynasty's first year
  if (year === dynasty.startYear) {
    return dynasty.coachingStaff || defaultStaff
  }

  return defaultStaff
}

/**
 * Get Google Sheet info for current team
 */
export function getCurrentGoogleSheet(dynasty) {
  if (!dynasty) return { googleSheetId: null, googleSheetUrl: null }

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName

  // Try new team-centric structure first
  const teamSheet = dynasty.googleSheetsByTeam?.[teamAbbr]
  if (teamSheet) {
    return teamSheet
  }

  // Fall back to legacy googleSheet fields
  return {
    googleSheetId: dynasty.googleSheetId || null,
    googleSheetUrl: dynasty.googleSheetUrl || null
  }
}

/**
 * Get recruits for current team and year
 */
export function getCurrentRecruits(dynasty) {
  if (!dynasty) return []

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const year = dynasty.currentYear

  // Try new team-centric structure first
  const teamYearRecruits = dynasty.recruitsByTeamYear?.[teamAbbr]?.[year]
  if (teamYearRecruits) {
    return teamYearRecruits
  }

  // Fall back to legacy recruits (filter by team if they have team field)
  const legacyRecruits = dynasty.recruits || []
  return legacyRecruits.filter(r => !r.team || r.team === teamAbbr)
}

/**
 * Class progression mapping for season advancement
 */
const CLASS_PROGRESSION = {
  'HS': 'Fr',
  // JUCO players: drop the JUCO prefix, keep the class level
  // Their first season on team they play as that class (Fr, So, Jr, Sr)
  'JUCO Fr': 'Fr',
  'JUCO So': 'So',
  'JUCO Jr': 'Jr',
  'JUCO Sr': 'Sr',
  'Fr': 'So',
  'RS Fr': 'RS So',
  'So': 'Jr',
  'RS So': 'RS Jr',
  'Jr': 'Sr',
  'RS Jr': 'RS Sr',
  'Sr': 'RS Sr',
  'RS Sr': 'RS Sr'
}

/**
 * Get players that need class advancement confirmation (null gamesPlayed)
 * Returns array of players who need user to confirm if they played 5+ games
 */
export function getPlayersNeedingClassConfirmation(dynasty) {
  if (!dynasty) return []

  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const year = dynasty.currentYear
  const players = dynasty.players || []
  const playerStats = dynasty.playerStatsByYear?.[year] || []

  // Get active players for current team (not left, not recruits, not honor-only)
  const activePlayers = players.filter(p => {
    if (p.isHonorOnly) return false
    if (p.isRecruit) return false
    // Also exclude players recruited this year (even if isRecruit flag is missing)
    if (p.recruitYear === year) return false
    if (p.leftTeam) return false
    if (p.team && p.team !== teamAbbr) return false
    // Already RS players don't need confirmation (they'll progress normally)
    if (p.year?.startsWith('RS ')) return false
    return true
  })

  // Find players with null/undefined gamesPlayed
  const needsConfirmation = activePlayers.filter(player => {
    const stats = playerStats.find(s => s.pid === player.pid)
    const gamesPlayed = stats?.gamesPlayed
    return gamesPlayed === null || gamesPlayed === undefined
  })

  return needsConfirmation
}

/**
 * Check if user is on a new team (first year coaching this team)
 */
export function isFirstYearOnTeam(dynasty) {
  if (!dynasty) return false

  const currentTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  const previousYearTeam = dynasty.coachTeamByYear?.[dynasty.currentYear]?.team

  // If no previous year record, check if this is the dynasty start year
  if (!previousYearTeam) {
    return dynasty.currentYear !== dynasty.startYear
  }

  return previousYearTeam !== currentTeamAbbr
}

/**
 * Get which team the coach was coaching for a specific year.
 * This is locked in at the start of the season (Week 1) and does NOT change
 * even if the user switches teams during the offseason.
 *
 * Use this for coach career records, player leaderboards, and any stats
 * that need to know "who was the coach coaching this year".
 */
export function getCoachTeamForYear(dynasty, year) {
  if (!dynasty) return null

  // Check the coachTeamByYear structure first
  const coachTeamRecord = dynasty.coachTeamByYear?.[year]
  if (coachTeamRecord) {
    return coachTeamRecord
  }

  // Fallback for years before this feature was implemented:
  // - If it's the current year and we haven't started the season yet, use current team
  // - Otherwise return null (data not available)
  if (year === dynasty.currentYear && dynasty.currentPhase === 'preseason') {
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    return {
      team: teamAbbr,
      teamName: dynasty.teamName,
      position: dynasty.coachPosition || 'HC'
    }
  }

  // For the start year, assume the current team if no record exists
  if (year === dynasty.startYear) {
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    return {
      team: teamAbbr,
      teamName: dynasty.teamName,
      position: dynasty.coachPosition || 'HC'
    }
  }

  return null
}

/**
 * Get all years the coach has coached with their team info
 */
export function getCoachHistory(dynasty) {
  if (!dynasty) return []

  const history = []
  const coachTeamByYear = dynasty.coachTeamByYear || {}

  // Get all years from coachTeamByYear
  for (const [year, record] of Object.entries(coachTeamByYear)) {
    history.push({
      year: parseInt(year),
      ...record
    })
  }

  // Sort by year
  history.sort((a, b) => a.year - b.year)
  return history
}

/**
 * Get the locked coaching staff for a specific year.
 * This is locked in at Week 12 (end of regular season) BEFORE any conference
 * championship firings. Use this for historical views to show who the
 * coordinators were during that season, even if they were fired later.
 *
 * @param dynasty - The dynasty object
 * @param year - The year to get staff for
 * @param teamAbbr - Optional team abbreviation (defaults to coach's team for that year)
 */
export function getLockedCoachingStaff(dynasty, year, teamAbbr = null) {
  if (!dynasty) return { hcName: null, ocName: null, dcName: null }

  // If no team specified, get the coach's team for that year
  if (!teamAbbr) {
    const coachTeam = getCoachTeamForYear(dynasty, year)
    teamAbbr = coachTeam?.team
  }

  if (!teamAbbr) {
    // Fallback to current team
    teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  }

  // Check locked coaching staff first (set at end of Week 12)
  let staff = dynasty.lockedCoachingStaffByYear?.[teamAbbr]?.[year]

  // Fall back to team-centric coaching staff (may have been updated after firings)
  if (!staff) {
    staff = dynasty.coachingStaffByTeamYear?.[teamAbbr]?.[year]
  }

  // ONLY fall back to legacy coaching staff if this is the user's CURRENT team
  // This prevents showing the user's coordinators on other teams' pages
  const userCurrentTeam = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
  if (!staff && teamAbbr === userCurrentTeam) {
    staff = dynasty.coachingStaff || { hcName: null, ocName: null, dcName: null }
  }

  // If still no staff (other team with no data), return empty
  if (!staff) {
    staff = { hcName: null, ocName: null, dcName: null }
  }

  // Check if the user was coaching this team in this year and add their name
  const coachTeamForYear = getCoachTeamForYear(dynasty, year)
  if (coachTeamForYear && coachTeamForYear.team === teamAbbr && dynasty.coachName) {
    staff = { ...staff }
    if (coachTeamForYear.position === 'HC') {
      staff.hcName = dynasty.coachName
    } else if (coachTeamForYear.position === 'OC') {
      staff.ocName = dynasty.coachName
    } else if (coachTeamForYear.position === 'DC') {
      staff.dcName = dynasty.coachName
    }
  }

  return staff
}

export function useDynasty() {
  const context = useContext(DynastyContext)
  if (!context) {
    throw new Error('useDynasty must be used within DynastyProvider')
  }
  return context
}

export function DynastyProvider({ children }) {
  const { user } = useAuth()
  const [dynasties, setDynasties] = useState([])
  const [currentDynasty, setCurrentDynasty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [migrated, setMigrated] = useState(false)

  // Helper to apply game migration to dynasties
  const applyGameMigration = (dynastyList) => {
    return dynastyList.map(dynasty => {
      // Skip if already migrated
      if (dynasty._gamesMigrated) return dynasty
      return migrateToUnifiedGames(dynasty)
    })
  }

  // Load dynasties when user changes
  useEffect(() => {
    // In dev mode, use localStorage fallback (even without user)
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    if (isDev) {
      // Load from localStorage in dev mode
      const saved = localStorage.getItem('cfb-dynasties')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Apply game migration to all dynasties
          const migratedDynasties = applyGameMigration(parsed)
          setDynasties(migratedDynasties)
        } catch (error) {
          console.error('Error loading dynasties:', error)
        }
      }
      setLoading(false)
      return
    }

    // Production mode - require user
    if (!user) {
      setDynasties([])
      setCurrentDynasty(null)
      setLoading(false)
      return
    }

    // Migrate localStorage data on first load
    const migrateData = async () => {
      if (!migrated) {
        try {
          await migrateLocalStorageData(user.uid)
          setMigrated(true)
        } catch (error) {
          console.error('Migration error:', error)
        }
      }
    }
    migrateData()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToDynasties(user.uid, (firestoreDynasties) => {
      // Apply game migration to all dynasties from Firestore
      const migratedDynasties = applyGameMigration(firestoreDynasties)
      setDynasties(migratedDynasties)
      setLoading(false)

      // Update current dynasty if it's in the list
      if (currentDynasty) {
        const updated = migratedDynasties.find(d => d.id === currentDynasty.id)
        if (updated) {
          setCurrentDynasty(updated)
        } else {
          setCurrentDynasty(null)
        }
      }
    })

    return () => unsubscribe()
  }, [user, migrated, currentDynasty?.id])

  // Save to localStorage in dev mode
  useEffect(() => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'

    // Don't save during initial load
    if (loading) return

    if (isDev && dynasties.length > 0) {
      localStorage.setItem('cfb-dynasties', JSON.stringify(dynasties))
    }
    // Note: We don't remove from localStorage when empty to avoid accidental data loss
  }, [dynasties, loading])

  const createDynasty = async (dynastyData) => {
    const newDynastyData = {
      ...dynastyData,
      currentYear: parseInt(dynastyData.startYear),
      currentWeek: 0,
      currentPhase: 'preseason',
      seasons: [],
      games: [],
      players: [],
      recruits: [],
      schedule: [],
      rankings: [],
      nextPID: 1, // Initialize player ID counter
      preseasonSetup: {
        scheduleEntered: false,
        rosterEntered: false,
        teamRatingsEntered: false,
        coachingStaffEntered: false,
        conferencesEntered: false  // Shows as incomplete, but defaults are valid if user skips
      },
      teamRatings: {
        overall: null,
        offense: null,
        defense: null
      },
      coachingStaff: {
        hcName: null,
        ocName: null,
        dcName: null
      }
    }

    const isDev = import.meta.env.VITE_DEV_MODE === 'true'

    // Note: Google Sheet is created lazily when user opens Schedule Entry modal
    // This avoids creating sheets that may never be used

    if (isDev || !user) {
      // Dev mode: use localStorage
      const newDynasty = {
        id: Date.now().toString(),
        ...newDynastyData,
        createdAt: new Date().toISOString(),
        lastModified: Date.now()
      }

      // Immediately save to localStorage before updating state
      const existingDynasties = dynasties
      const updatedDynasties = [...existingDynasties, newDynasty]
      localStorage.setItem('cfb-dynasties', JSON.stringify(updatedDynasties))

      setDynasties(updatedDynasties)
      setCurrentDynasty(newDynasty)
      return newDynasty
    }

    // Production: use Firestore
    try {
      const newDynasty = await createDynastyInFirestore(user.uid, {
        ...newDynastyData,
        lastModified: Date.now()
      })
      setCurrentDynasty(newDynasty)
      return newDynasty
    } catch (error) {
      console.error('Error creating dynasty:', error)
      throw error
    }
  }

  const updateDynasty = async (dynastyId, updates, options = {}) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    const { skipLastModified = false } = options

    // Helper to recursively remove undefined values (Firestore doesn't accept undefined)
    const removeUndefined = (obj) => {
      if (obj === null || obj === undefined) return obj
      if (Array.isArray(obj)) {
        return obj.map(item => removeUndefined(item))
      }
      if (typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, removeUndefined(v)])
        )
      }
      return obj
    }

    // BULLETPROOF: If updating players array, remove any duplicates by PID
    // This prevents duplicate players from ever being saved
    let sanitizedUpdates = { ...updates }
    if (sanitizedUpdates.players && Array.isArray(sanitizedUpdates.players)) {
      const seenPIDs = new Set()
      const seenNames = new Set()
      sanitizedUpdates.players = sanitizedUpdates.players.filter(player => {
        // Skip if no player object
        if (!player) return false

        // Check for duplicate PID
        if (player.pid != null) {
          if (seenPIDs.has(player.pid)) {
            console.warn(`Duplicate player PID detected and removed: ${player.pid} (${player.name})`)
            return false
          }
          seenPIDs.add(player.pid)
        }

        // Also check for duplicate names (same name + same team + same year class = likely duplicate)
        const nameKey = `${(player.name || '').toLowerCase().trim()}_${player.team || ''}_${player.year || ''}`
        if (player.name && seenNames.has(nameKey)) {
          console.warn(`Duplicate player name/team/class detected and removed: ${player.name}`)
          return false
        }
        if (player.name) seenNames.add(nameKey)

        return true
      })
    }

    // Add lastModified timestamp to updates (unless skipLastModified is true)
    const updatesWithTimestamp = removeUndefined({
      ...sanitizedUpdates,
      ...(skipLastModified ? {} : { lastModified: Date.now() })
    })

    if (isDev || !user) {
      // Dev mode: update local state

      // CRITICAL FIX: Read from localStorage to get the absolute latest data
      // This prevents race conditions when multiple updates happen in quick succession
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties

      const updated = currentDynasties.map(d => (String(d.id) === String(dynastyId) ? { ...d, ...updatesWithTimestamp } : d))

      // Immediately save to localStorage
      localStorage.setItem('cfb-dynasties', JSON.stringify(updated))

      setDynasties(updated)

      // CRITICAL FIX: Update currentDynasty with the full updated object from the array
      // instead of just merging updates (which can miss nested object changes)
      if (String(currentDynasty?.id) === String(dynastyId)) {
        const updatedDynasty = updated.find(d => String(d.id) === String(dynastyId))
        setCurrentDynasty(updatedDynasty)
      }
      return
    }

    // Production: update Firestore
    try {
      await updateDynastyInFirestore(dynastyId, updatesWithTimestamp)
      // Real-time listener will update local state
    } catch (error) {
      console.error('Error updating dynasty:', error)
      throw error
    }
  }

  const deleteDynasty = async (dynastyId) => {

    const isDev = import.meta.env.VITE_DEV_MODE === 'true'

    if (isDev || !user) {
      // Dev mode: delete from local state
      const updated = dynasties.filter(d => {
        const match = String(d.id) !== String(dynastyId)
        return match
      })


      // Immediately save to localStorage
      if (updated.length > 0) {
        localStorage.setItem('cfb-dynasties', JSON.stringify(updated))
      } else {
        localStorage.removeItem('cfb-dynasties')
      }

      setDynasties(updated)

      if (String(currentDynasty?.id) === String(dynastyId)) {
        setCurrentDynasty(null)
      }
      return
    }

    // Production: delete from Firestore
    try {
      await deleteDynastyFromFirestore(dynastyId)
      if (String(currentDynasty?.id) === String(dynastyId)) {
        setCurrentDynasty(null)
      }
    } catch (error) {
      console.error('❌ Error deleting dynasty from Firestore:', error)
      throw error
    }
  }

  const selectDynasty = (dynastyId) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    setCurrentDynasty(dynasty || null)
  }

  const addGame = async (dynastyId, gameData) => {
    // Helper to recursively remove undefined values (Firestore doesn't accept undefined)
    const removeUndefined = (obj) => {
      if (obj === null || obj === undefined) return obj
      if (Array.isArray(obj)) {
        return obj.map(item => removeUndefined(item))
      }
      if (typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, removeUndefined(v)])
        )
      }
      return obj
    }

    // Clean the gameData of any undefined values
    const cleanGameData = removeUndefined(gameData)

    // CRITICAL: Read from localStorage to get the latest data
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    // CRITICAL: Always store the actual team abbreviation for user games
    // This ensures games are correctly attributed when user switches teams
    // CPU games are identified by having team1/team2 but no userTeam
    const currentUserTeam = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    const isCPUGame = cleanGameData.team1 && cleanGameData.team2 && !cleanGameData.userTeam
    if (!isCPUGame) {
      cleanGameData.userTeam = currentUserTeam
    }

    // UNIFIED GAME TYPES: Set gameType field based on game flags
    // This ensures all games (user and CPU) have consistent gameType for filtering
    if (!cleanGameData.gameType) {
      if (cleanGameData.isCFPChampionship) {
        cleanGameData.gameType = GAME_TYPES.CFP_CHAMPIONSHIP
      } else if (cleanGameData.isCFPSemifinal) {
        cleanGameData.gameType = GAME_TYPES.CFP_SEMIFINAL
      } else if (cleanGameData.isCFPQuarterfinal) {
        cleanGameData.gameType = GAME_TYPES.CFP_QUARTERFINAL
      } else if (cleanGameData.isCFPFirstRound) {
        cleanGameData.gameType = GAME_TYPES.CFP_FIRST_ROUND
      } else if (cleanGameData.isBowlGame) {
        cleanGameData.gameType = GAME_TYPES.BOWL
      } else if (cleanGameData.isConferenceChampionship) {
        cleanGameData.gameType = GAME_TYPES.CONFERENCE_CHAMPIONSHIP
      } else {
        cleanGameData.gameType = GAME_TYPES.REGULAR
      }
    }

    // UNIFIED CFP FORMAT: For CFP games, always set unified team1/team2/winner fields
    // This ensures bracket reads games[] directly without needing to normalize user vs CPU formats
    const isCFPGame = cleanGameData.isCFPFirstRound || cleanGameData.isCFPQuarterfinal ||
                      cleanGameData.isCFPSemifinal || cleanGameData.isCFPChampionship

    if (isCFPGame && !isCPUGame) {
      const userTeamAbbr = cleanGameData.userTeam || currentUserTeam
      const opponentAbbr = cleanGameData.opponent
      const userScore = parseInt(cleanGameData.teamScore)
      const oppScore = parseInt(cleanGameData.opponentScore)
      const userWon = cleanGameData.result === 'win' || cleanGameData.result === 'W'

      // For First Round, determine seeds and ensure higher seed is team1
      if (cleanGameData.isCFPFirstRound) {
        const cfpSeeds = dynasty.cfpSeedsByYear?.[cleanGameData.year] || []
        const userSeed = cfpSeeds.find(s => s.team === userTeamAbbr)?.seed
        const oppSeed = cfpSeeds.find(s => s.team === opponentAbbr)?.seed || (userSeed ? 17 - userSeed : null)

        // Higher seed (lower number) should be team1 (home team)
        if (userSeed && oppSeed && userSeed > oppSeed) {
          // Opponent has higher seed - they are team1 (home)
          cleanGameData.team1 = opponentAbbr
          cleanGameData.team2 = userTeamAbbr
          cleanGameData.team1Score = oppScore
          cleanGameData.team2Score = userScore
          cleanGameData.seed1 = oppSeed
          cleanGameData.seed2 = userSeed
          cleanGameData.winner = userWon ? userTeamAbbr : opponentAbbr
        } else {
          // User has higher seed - they are team1 (home)
          cleanGameData.team1 = userTeamAbbr
          cleanGameData.team2 = opponentAbbr
          cleanGameData.team1Score = userScore
          cleanGameData.team2Score = oppScore
          cleanGameData.seed1 = userSeed
          cleanGameData.seed2 = oppSeed
          cleanGameData.winner = userWon ? userTeamAbbr : opponentAbbr
        }
      } else {
        // For QF/SF/Championship, user is always team1
        cleanGameData.team1 = userTeamAbbr
        cleanGameData.team2 = opponentAbbr
        cleanGameData.team1Score = userScore
        cleanGameData.team2Score = oppScore
        cleanGameData.winner = userWon ? userTeamAbbr : opponentAbbr
      }
    }

    // Check if game already exists for this week/year
    // Special handling for CC games, bowl games, and CFP games
    let existingGameIndex
    if (cleanGameData.isConferenceChampionship) {
      existingGameIndex = dynasty.games?.findIndex(
        g => g.isConferenceChampionship && Number(g.year) === Number(cleanGameData.year)
      )
    } else if (cleanGameData.isBowlGame) {
      existingGameIndex = dynasty.games?.findIndex(
        g => g.isBowlGame && Number(g.year) === Number(cleanGameData.year)
      )
    } else if (cleanGameData.isCFPFirstRound) {
      existingGameIndex = dynasty.games?.findIndex(
        g => g.isCFPFirstRound && Number(g.year) === Number(cleanGameData.year)
      )
    } else if (cleanGameData.isCFPQuarterfinal) {
      existingGameIndex = dynasty.games?.findIndex(
        g => g.isCFPQuarterfinal && Number(g.year) === Number(cleanGameData.year)
      )
    } else if (cleanGameData.isCFPSemifinal) {
      existingGameIndex = dynasty.games?.findIndex(
        g => g.isCFPSemifinal && Number(g.year) === Number(cleanGameData.year)
      )
    } else if (cleanGameData.isCFPChampionship) {
      existingGameIndex = dynasty.games?.findIndex(
        g => g.isCFPChampionship && Number(g.year) === Number(cleanGameData.year)
      )
    } else {
      existingGameIndex = dynasty.games?.findIndex(
        g => Number(g.week) === Number(cleanGameData.week) && Number(g.year) === Number(cleanGameData.year)
      )
    }

    let updatedGames
    let game

    if (existingGameIndex !== -1 && existingGameIndex !== undefined) {
      // Update existing game - ensure it has proper ID (especially for CFP games)
      const existingGame = dynasty.games[existingGameIndex]

      // For CFP games, ensure proper slot ID format
      let gameId = existingGame.id || Date.now().toString()
      let cfpSeedData = {} // To store seed info for CFP First Round games

      // Check if this is a CFP game that needs ID correction
      if (cleanGameData.isCFPFirstRound || existingGame.isCFPFirstRound) {
        const cfpSeeds = dynasty.cfpSeedsByYear?.[cleanGameData.year || existingGame.year] || []
        const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)
        const userSeed = cfpSeeds.find(s => s.team === userTeamAbbr)?.seed
        const oppSeed = userSeed ? 17 - userSeed : null
        const slotId = getFirstRoundSlotId(userSeed, oppSeed)
        if (slotId) {
          gameId = getCFPGameId(slotId, cleanGameData.year || existingGame.year)
        }
        // CRITICAL: Add seed data so bracket can find this game
        if (userSeed && oppSeed) {
          cfpSeedData = {
            cfpSeed1: userSeed,
            cfpSeed2: oppSeed,
            seed1: userSeed,
            seed2: oppSeed,
            gameType: 'cfp_first_round'
          }
        }
      } else if ((cleanGameData.isCFPQuarterfinal || existingGame.isCFPQuarterfinal) && (cleanGameData.bowlName || existingGame.bowlName)) {
        const slotId = getSlotIdFromBowlName(cleanGameData.bowlName || existingGame.bowlName)
        if (slotId) {
          gameId = getCFPGameId(slotId, cleanGameData.year || existingGame.year)
        }
      } else if ((cleanGameData.isCFPSemifinal || existingGame.isCFPSemifinal) && (cleanGameData.bowlName || existingGame.bowlName)) {
        const slotId = getSlotIdFromBowlName(cleanGameData.bowlName || existingGame.bowlName)
        if (slotId) {
          gameId = getCFPGameId(slotId, cleanGameData.year || existingGame.year)
        }
      } else if (cleanGameData.isCFPChampionship || existingGame.isCFPChampionship) {
        gameId = getCFPGameId('cfpnc', cleanGameData.year || existingGame.year)
      }

      game = {
        ...existingGame,
        ...cleanGameData,
        ...cfpSeedData, // Include CFP seed data for bracket matching
        id: gameId,
        updatedAt: new Date().toISOString()
      }
      updatedGames = [...dynasty.games]
      updatedGames[existingGameIndex] = game
    } else {
      // Add new game
      // For CFP games, generate proper slot ID based on game type
      let gameId = Date.now().toString()
      let cfpSeedData = {} // To store seed info for CFP First Round games

      if (cleanGameData.isCFPFirstRound) {
        const cfpSeeds = dynasty.cfpSeedsByYear?.[cleanGameData.year] || []
        const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)
        const userSeed = cfpSeeds.find(s => s.team === userTeamAbbr)?.seed
        const oppSeed = userSeed ? 17 - userSeed : null
        const slotId = getFirstRoundSlotId(userSeed, oppSeed)
        if (slotId) {
          gameId = getCFPGameId(slotId, cleanGameData.year)
        }
        // CRITICAL: Add seed data so bracket can find this game
        if (userSeed && oppSeed) {
          cfpSeedData = {
            cfpSeed1: userSeed,
            cfpSeed2: oppSeed,
            seed1: userSeed,
            seed2: oppSeed,
            gameType: 'cfp_first_round'
          }
        }
      } else if (cleanGameData.isCFPQuarterfinal && cleanGameData.bowlName) {
        const slotId = getSlotIdFromBowlName(cleanGameData.bowlName)
        if (slotId) {
          gameId = getCFPGameId(slotId, cleanGameData.year)
        }
      } else if (cleanGameData.isCFPSemifinal && cleanGameData.bowlName) {
        const slotId = getSlotIdFromBowlName(cleanGameData.bowlName)
        if (slotId) {
          gameId = getCFPGameId(slotId, cleanGameData.year)
        }
      } else if (cleanGameData.isCFPChampionship) {
        gameId = getCFPGameId('cfpnc', cleanGameData.year)
      }

      game = {
        id: gameId,
        ...cleanGameData,
        ...cfpSeedData, // Include CFP seed data for bracket matching
        createdAt: new Date().toISOString()
      }
      updatedGames = [...(dynasty.games || []), game]
    }

    // Build updates object - games[] is the single source of truth for CFP games
    // cfpResultsByYear is deprecated and only kept for reading legacy data
    const updates = { games: updatedGames }

    // If game has box score, aggregate stats to player.statsByYear
    // This ensures TeamStats page can read player stats from a single source
    if (cleanGameData.boxScore) {
      const updatedDynasty = { ...dynasty, games: updatedGames }
      const updatedPlayers = aggregateBoxScoreStats(
        updatedDynasty,
        cleanGameData.year || dynasty.currentYear,
        currentUserTeam
      )
      updates.players = updatedPlayers
    }

    await updateDynasty(dynastyId, updates)

    return game
  }

  // Add or update CPU bowl games as proper game entries in the games[] array
  // This ensures ALL games (user and CPU) are stored uniformly
  const saveCPUBowlGames = async (dynastyId, bowlGames, year, week = 'week1') => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)
    const existingGames = dynasty.games || []

    // Filter out existing bowl games for this year and week to avoid duplicates
    // (Both CPU and user bowl games entered via the modal will be replaced)
    const filteredGames = existingGames.filter(g => {
      // Keep games from different years
      if (Number(g.year) !== Number(year)) return true
      // Keep non-bowl games
      if (!g.isBowlGame) return true
      // Keep games from different bowl weeks
      if (g.bowlWeek !== week) return true
      // Remove bowl games from same year/week (will be replaced with fresh data)
      return false
    })

    // Create game entries for each bowl game
    const newGames = bowlGames
      .filter(bowl => {
        // Only process games with valid data
        if (!bowl.team1 || !bowl.team2) return false
        if (bowl.team1Score === null || bowl.team1Score === undefined) return false
        if (bowl.team2Score === null || bowl.team2Score === undefined) return false
        return true
      })
      .map(bowl => {
        // Determine winner
        const team1Score = parseInt(bowl.team1Score)
        const team2Score = parseInt(bowl.team2Score)
        const winner = team1Score > team2Score ? bowl.team1 : bowl.team2
        const winnerIsTeam1 = winner === bowl.team1

        // Check if this is the user's bowl game
        const isUserBowlGame = bowl.team1 === userTeamAbbr || bowl.team2 === userTeamAbbr

        return {
          id: `bowl-${year}-${bowl.bowlName?.replace(/\s+/g, '-').toLowerCase() || Date.now()}`,
          // No isCPUGame flag - CPU games identified by absence of userTeam
          isBowlGame: true,
          bowlName: bowl.bowlName,
          bowlWeek: week,
          year: Number(year),
          week: 'Bowl',
          location: 'neutral',
          gameType: GAME_TYPES.BOWL,
          // Store both teams' data
          team1: bowl.team1,
          team2: bowl.team2,
          team1Score: team1Score,
          team2Score: team2Score,
          winner: winner,
          // For user's game, set userTeam properly; CPU games have no userTeam
          ...(isUserBowlGame && { userTeam: userTeamAbbr }),
          // For display purposes
          viewingTeamAbbr: isUserBowlGame ? userTeamAbbr : winner,
          opponent: isUserBowlGame
            ? (bowl.team1 === userTeamAbbr ? bowl.team2 : bowl.team1)
            : (winnerIsTeam1 ? bowl.team2 : bowl.team1),
          teamScore: isUserBowlGame
            ? (bowl.team1 === userTeamAbbr ? team1Score : team2Score)
            : (winnerIsTeam1 ? team1Score : team2Score),
          opponentScore: isUserBowlGame
            ? (bowl.team1 === userTeamAbbr ? team2Score : team1Score)
            : (winnerIsTeam1 ? team2Score : team1Score),
          result: isUserBowlGame
            ? (winner === userTeamAbbr ? 'win' : 'loss')
            : 'win',
          // Preserve any notes/links if they exist
          gameNote: bowl.gameNote || '',
          links: bowl.links || '',
          createdAt: new Date().toISOString()
        }
      })

    const updatedGames = [...filteredGames, ...newGames]

    await updateDynasty(dynastyId, { games: updatedGames })

    return newGames
  }

  // Save CFP games in unified format to games[] array
  // Handles all rounds: First Round, Quarterfinals, Semifinals, Championship
  // This is the single source of truth for CFP games - does NOT write to cfpResultsByYear
  const saveCFPGames = async (dynastyId, gamesData, year, roundType) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)
    const existingGames = dynasty.games || []

    // Determine which legacy flag to check based on round type
    const legacyFlagMap = {
      [GAME_TYPES.CFP_FIRST_ROUND]: 'isCFPFirstRound',
      [GAME_TYPES.CFP_QUARTERFINAL]: 'isCFPQuarterfinal',
      [GAME_TYPES.CFP_SEMIFINAL]: 'isCFPSemifinal',
      [GAME_TYPES.CFP_CHAMPIONSHIP]: 'isCFPChampionship'
    }
    const legacyFlag = legacyFlagMap[roundType]

    // Filter out existing games of this type for this year
    // BUT preserve user's game if it was entered separately (has userTeam field)
    const filteredGames = existingGames.filter(g => {
      const isThisRoundType = g.gameType === roundType || g[legacyFlag]
      const isThisYear = Number(g.year) === Number(year)
      if (isThisRoundType && isThisYear) {
        // Keep user's game - it will be merged/updated below if also in gamesData
        return g.userTeam === userTeamAbbr
      }
      return true
    })

    // Build new games array
    const newGames = []

    for (const gameData of gamesData) {
      // Skip incomplete games
      if (!gameData.team1 || !gameData.team2) continue
      if (gameData.team1Score === null || gameData.team1Score === undefined) continue
      if (gameData.team2Score === null || gameData.team2Score === undefined) continue

      // Determine slot ID based on round type
      let slotId
      if (roundType === GAME_TYPES.CFP_FIRST_ROUND) {
        slotId = getFirstRoundSlotId(gameData.seed1, gameData.seed2)
      } else {
        slotId = getSlotIdFromBowlName(gameData.bowlName)
      }

      const gameId = slotId ? getCFPGameId(slotId, year) : `cfp-${roundType}-${year}-${Date.now()}`

      // Check if this is user's game
      const isUserGame = gameData.team1 === userTeamAbbr || gameData.team2 === userTeamAbbr

      // Determine winner
      const team1Score = parseInt(gameData.team1Score)
      const team2Score = parseInt(gameData.team2Score)
      const winner = gameData.winner || (team1Score > team2Score ? gameData.team1 : gameData.team2)

      const unifiedGame = {
        id: gameId,
        year: Number(year),
        gameType: roundType,
        team1: gameData.team1,
        team2: gameData.team2,
        team1Score: team1Score,
        team2Score: team2Score,
        winner: winner,
        seed1: gameData.seed1,
        seed2: gameData.seed2,
        bowlName: gameData.bowlName,
        // User team identification
        ...(isUserGame && { userTeam: userTeamAbbr }),
        // Legacy compatibility fields
        ...(isUserGame && {
          opponent: gameData.team1 === userTeamAbbr ? gameData.team2 : gameData.team1,
          teamScore: gameData.team1 === userTeamAbbr ? team1Score : team2Score,
          opponentScore: gameData.team1 === userTeamAbbr ? team2Score : team1Score,
          result: winner === userTeamAbbr ? 'win' : 'loss'
        }),
        // Legacy flags
        [legacyFlag]: true,
        createdAt: new Date().toISOString()
      }

      // Check if this game already exists (user's game preserved above)
      const existingIndex = filteredGames.findIndex(g => g.id === gameId)
      if (existingIndex >= 0) {
        // Update existing game
        filteredGames[existingIndex] = { ...filteredGames[existingIndex], ...unifiedGame }
      } else {
        newGames.push(unifiedGame)
      }
    }

    const updatedGames = [...filteredGames, ...newGames]

    await updateDynasty(dynastyId, { games: updatedGames })

    return newGames
  }

  // Add or update CPU conference championship games as proper game entries in the games[] array
  // This ensures ALL games (user and CPU) are stored uniformly
  const saveCPUConferenceChampionships = async (dynastyId, championships, year) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)
    const existingGames = dynasty.games || []

    // Filter out existing conference championship games for this year to avoid duplicates
    // (Both CPU and user CC games entered via the modal will be replaced)
    const filteredGames = existingGames.filter(g => {
      // Keep games from different years
      if (Number(g.year) !== Number(year)) return true
      // Keep non-CC games
      if (!g.isConferenceChampionship) return true
      // Remove CC games from same year (will be replaced with fresh data)
      return false
    })

    // Create game entries for each conference championship game
    const newGames = championships
      .filter(cc => {
        // Only process games with valid data
        if (!cc.team1 || !cc.team2) return false
        if (cc.team1Score === null || cc.team1Score === undefined) return false
        if (cc.team2Score === null || cc.team2Score === undefined) return false
        return true
      })
      .map(cc => {
        // Determine winner
        const team1Score = parseInt(cc.team1Score)
        const team2Score = parseInt(cc.team2Score)
        const winner = team1Score > team2Score ? cc.team1 : cc.team2
        const winnerIsTeam1 = winner === cc.team1

        // Check if this is the user's CC game
        const isUserCCGame = cc.team1 === userTeamAbbr || cc.team2 === userTeamAbbr

        return {
          id: `cc-${year}-${cc.conference?.replace(/\s+/g, '-').toLowerCase() || Date.now()}`,
          // No isCPUGame flag - CPU games identified by absence of userTeam
          isConferenceChampionship: true,
          conference: cc.conference,
          year: Number(year),
          week: 'CCG',
          location: 'neutral',
          gameType: GAME_TYPES.CONFERENCE_CHAMPIONSHIP,
          // Store both teams' data
          team1: cc.team1,
          team2: cc.team2,
          team1Score: team1Score,
          team2Score: team2Score,
          winner: winner,
          // For user's game, set userTeam properly; CPU games have no userTeam
          ...(isUserCCGame && { userTeam: userTeamAbbr }),
          // For display purposes
          viewingTeamAbbr: isUserCCGame ? userTeamAbbr : winner,
          opponent: isUserCCGame
            ? (cc.team1 === userTeamAbbr ? cc.team2 : cc.team1)
            : (winnerIsTeam1 ? cc.team2 : cc.team1),
          teamScore: isUserCCGame
            ? (cc.team1 === userTeamAbbr ? team1Score : team2Score)
            : (winnerIsTeam1 ? team1Score : team2Score),
          opponentScore: isUserCCGame
            ? (cc.team1 === userTeamAbbr ? team2Score : team1Score)
            : (winnerIsTeam1 ? team2Score : team1Score),
          result: isUserCCGame
            ? (winner === userTeamAbbr ? 'win' : 'loss')
            : 'win',
          // Preserve any notes/links if they exist
          gameNote: cc.gameNote || '',
          links: cc.links || '',
          createdAt: new Date().toISOString()
        }
      })

    const updatedGames = [...filteredGames, ...newGames]

    await updateDynasty(dynastyId, { games: updatedGames })

    return newGames
  }

  const advanceWeek = async (dynastyId, classConfirmations = {}) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    let nextWeek = dynasty.currentWeek + 1
    let nextPhase = dynasty.currentPhase
    let nextYear = dynasty.currentYear
    let additionalUpdates = {}

    // Phase transitions
    if (dynasty.currentPhase === 'preseason' && nextWeek >= 1) {
      nextPhase = 'regular_season'
      nextWeek = 1

      // COACH HISTORY: Record which team the coach is coaching this year
      // This is locked in at season start and does NOT change even if user switches teams later
      const coachTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
      const existingCoachTeamByYear = dynasty.coachTeamByYear || {}
      additionalUpdates.coachTeamByYear = {
        ...existingCoachTeamByYear,
        [dynasty.currentYear]: {
          team: coachTeamAbbr,
          teamName: dynasty.teamName,
          position: dynasty.coachPosition || 'HC',
          conference: dynasty.conference
        }
      }

      // Delete Google Sheet when advancing from preseason
      if (dynasty.googleSheetId) {
        try {
          await deleteGoogleSheet(dynasty.googleSheetId)
          additionalUpdates.googleSheetId = null
          additionalUpdates.googleSheetUrl = null
        } catch (error) {
          console.error('Failed to delete Google Sheet:', error)
          // Continue anyway - don't block advancing
          additionalUpdates.googleSheetId = null
          additionalUpdates.googleSheetUrl = null
        }
      }
      // Clear other preseason sheet IDs
      additionalUpdates.scheduleSheetId = null
      additionalUpdates.rosterSheetId = null
      additionalUpdates.rosterEditSheetId = null
    } else if (dynasty.currentPhase === 'regular_season' && nextWeek > 12) {
      // After week 12, move to conference championship week
      nextPhase = 'conference_championship'
      nextWeek = 1

      // LOCK IN COACHING STAFF: Save the full coaching staff at end of regular season
      // This preserves them for historical display even if they're fired in CC week
      // Also includes the user's position so their name shows in historical views
      const currentTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
      const currentStaff = dynasty.coachingStaff || getCurrentCoachingStaff(dynasty)

      // Build complete staff including user's position
      const completeStaff = { ...currentStaff }
      if (dynasty.coachName && dynasty.coachPosition) {
        if (dynasty.coachPosition === 'HC') {
          completeStaff.hcName = dynasty.coachName
        } else if (dynasty.coachPosition === 'OC') {
          completeStaff.ocName = dynasty.coachName
        } else if (dynasty.coachPosition === 'DC') {
          completeStaff.dcName = dynasty.coachName
        }
      }

      if (completeStaff.hcName || completeStaff.ocName || completeStaff.dcName) {
        const existingLockedStaff = dynasty.lockedCoachingStaffByYear || {}
        const teamLockedStaff = existingLockedStaff[currentTeamAbbr] || {}
        additionalUpdates.lockedCoachingStaffByYear = {
          ...existingLockedStaff,
          [currentTeamAbbr]: {
            ...teamLockedStaff,
            [dynasty.currentYear]: { ...completeStaff }
          }
        }
      }
    } else if (dynasty.currentPhase === 'conference_championship' && nextWeek > 1) {
      // After conference championship, move to postseason (playoffs)
      nextPhase = 'postseason'
      nextWeek = 1

      // Execute pending coordinator firing if any
      const pendingFiring = dynasty.conferenceChampionshipData?.pendingFiring
      if (pendingFiring && pendingFiring !== 'none') {
        const firedOCName = (pendingFiring === 'oc' || pendingFiring === 'both') ? dynasty.coachingStaff?.ocName : null
        const firedDCName = (pendingFiring === 'dc' || pendingFiring === 'both') ? dynasty.coachingStaff?.dcName : null

        let updatedStaff = { ...dynasty.coachingStaff }
        if (pendingFiring === 'oc' || pendingFiring === 'both') {
          updatedStaff.ocName = null
        }
        if (pendingFiring === 'dc' || pendingFiring === 'both') {
          updatedStaff.dcName = null
        }

        additionalUpdates.coachingStaff = updatedStaff
        additionalUpdates.conferenceChampionshipData = {
          ...dynasty.conferenceChampionshipData,
          firingCoordinators: true,
          coordinatorToFire: pendingFiring,
          firedOCName,
          firedDCName
        }
        // Reset coachingStaffEntered so user must re-enter in next preseason
        additionalUpdates['preseasonSetup.coachingStaffEntered'] = false
      }
    } else if (dynasty.currentPhase === 'postseason' && nextWeek > 5) {
      // After Week 5 (End of Season Recap), move to offseason
      nextPhase = 'offseason'
      nextWeek = 1

      // Apply new job if user accepted one during postseason
      const newJobData = dynasty.newJobData
      if (newJobData?.takingNewJob && newJobData.team && newJobData.position) {
        // Get the full team name from abbreviation
        const newTeamName = getTeamName(newJobData.team)
        const newConference = getTeamConference(newJobData.team)

        // REVERT SUPPORT: Save previous job data so we can restore on revert
        additionalUpdates.previousJobData = {
          teamName: dynasty.teamName,
          coachPosition: dynasty.coachPosition || 'HC',
          conference: dynasty.conference,
          schedule: dynasty.schedule,
          teamRatings: dynasty.teamRatings,
          coachingStaff: dynasty.coachingStaff,
          googleSheetId: dynasty.googleSheetId,
          googleSheetUrl: dynasty.googleSheetUrl,
          preseasonSetup: dynasty.preseasonSetup,
          newJobData: newJobData // Save the accepted job offer to restore on revert
        }

        // Calculate record at current team for this stint
        const currentTeamGames = (dynasty.games || []).filter(g =>
          g.userTeam === dynasty.teamName ||
          g.userTeam === getAbbreviationFromDisplayName(dynasty.teamName) ||
          (!g.userTeam && !g.team1 && !g.team2) // Legacy games without userTeam (not CPU games which have team1/team2)
        )
        const currentStintGames = currentTeamGames.filter(g => {
          // Get the start year of the current stint
          const existingHistory = dynasty.coachingHistory || []
          const stintStartYear = existingHistory.length > 0
            ? existingHistory[existingHistory.length - 1].endYear + 1
            : dynasty.startYear
          return Number(g.year) >= stintStartYear
        })
        const stintWins = currentStintGames.filter(g => g.result === 'win').length
        const stintLosses = currentStintGames.filter(g => g.result === 'loss').length

        // Determine start year of current stint
        const existingHistory = dynasty.coachingHistory || []
        const stintStartYear = existingHistory.length > 0
          ? existingHistory[existingHistory.length - 1].endYear + 1
          : dynasty.startYear

        // Add current team to coaching history
        const updatedCoachingHistory = [
          ...existingHistory,
          {
            teamName: dynasty.teamName,
            conference: dynasty.conference,
            position: dynasty.coachPosition || 'HC',
            startYear: stintStartYear,
            endYear: dynasty.currentYear,
            wins: stintWins,
            losses: stintLosses
          }
        ]
        additionalUpdates.coachingHistory = updatedCoachingHistory

        // Update to new team
        additionalUpdates.teamName = newTeamName
        additionalUpdates.coachPosition = newJobData.position
        additionalUpdates.conference = newConference || ''

        // TEAM-CENTRIC FIX: Tag all legacy players (without team field) with their current team
        // before switching. This ensures they stay associated with their original team.
        const currentTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
        const existingPlayers = dynasty.players || []
        const taggedPlayers = existingPlayers.map(p => {
          // If player already has team field, keep it
          if (p.team) return p
          // If honor-only player, don't tag with team (they're tracked separately)
          if (p.isHonorOnly) return p
          // Tag legacy roster player with their current team
          return { ...p, team: currentTeamAbbr }
        })
        additionalUpdates.players = taggedPlayers

        // TEAM-CENTRIC FIX: Tag all legacy games (without userTeam field) with their team
        // before switching. This ensures games stay with the team that played them.
        const existingGames = dynasty.games || []
        const taggedGames = existingGames.map(g => {
          // If game already has userTeam field, keep it
          if (g.userTeam) return g
          // CPU games don't need userTeam - they're identified by having team1/team2 but no userTeam
          if (g.team1 && g.team2) return g
          // Tag legacy user game with the current team
          return { ...g, userTeam: currentTeamAbbr }
        })
        additionalUpdates.games = taggedGames

        // TEAM-CENTRIC FIX: Store current schedule in team-centric structure before clearing
        const currentSchedule = dynasty.schedule || []
        if (currentSchedule.length > 0) {
          const existingSchedulesByTeamYear = dynasty.schedulesByTeamYear || {}
          const teamSchedules = existingSchedulesByTeamYear[currentTeamAbbr] || {}
          additionalUpdates.schedulesByTeamYear = {
            ...existingSchedulesByTeamYear,
            [currentTeamAbbr]: {
              ...teamSchedules,
              [dynasty.currentYear]: currentSchedule
            }
          }
        }

        // TEAM-CENTRIC FIX: Store current teamRatings in team-centric structure before clearing
        const currentRatings = dynasty.teamRatings
        if (currentRatings && (currentRatings.overall || currentRatings.offense || currentRatings.defense)) {
          const existingTeamRatingsByTeamYear = dynasty.teamRatingsByTeamYear || {}
          const teamRatingsForTeam = existingTeamRatingsByTeamYear[currentTeamAbbr] || {}
          additionalUpdates.teamRatingsByTeamYear = {
            ...existingTeamRatingsByTeamYear,
            [currentTeamAbbr]: {
              ...teamRatingsForTeam,
              [dynasty.currentYear]: currentRatings
            }
          }
        }

        // TEAM-CENTRIC FIX: Store current coachingStaff in team-centric structure before clearing
        const currentStaff = dynasty.coachingStaff
        if (currentStaff && (currentStaff.hcName || currentStaff.ocName || currentStaff.dcName)) {
          const existingCoachingStaffByTeamYear = dynasty.coachingStaffByTeamYear || {}
          const coachingStaffForTeam = existingCoachingStaffByTeamYear[currentTeamAbbr] || {}
          additionalUpdates.coachingStaffByTeamYear = {
            ...existingCoachingStaffByTeamYear,
            [currentTeamAbbr]: {
              ...coachingStaffForTeam,
              [dynasty.currentYear]: currentStaff
            }
          }
        }

        // TEAM-CENTRIC FIX: Store current Google Sheet in team-centric structure before clearing
        if (dynasty.googleSheetId) {
          const existingGoogleSheetsByTeam = dynasty.googleSheetsByTeam || {}
          additionalUpdates.googleSheetsByTeam = {
            ...existingGoogleSheetsByTeam,
            [currentTeamAbbr]: {
              googleSheetId: dynasty.googleSheetId,
              googleSheetUrl: dynasty.googleSheetUrl
            }
          }
        }

        // Clear legacy structures for backwards compatibility
        additionalUpdates.schedule = []
        additionalUpdates.teamRatings = null
        additionalUpdates.coachingStaff = null
        additionalUpdates.googleSheetId = null
        additionalUpdates.googleSheetUrl = null
        additionalUpdates.playersLeavingSheetId = null

        // Reset preseason setup flags for the new team (legacy structure)
        additionalUpdates.preseasonSetup = {
          scheduleEntered: false,
          rosterEntered: false,
          teamRatingsEntered: false,
          coachingStaffEntered: false
        }

        // Clear newJobData
        additionalUpdates.newJobData = null
      }
    } else if (dynasty.currentPhase === 'offseason' && dynasty.currentWeek === 1 && nextWeek === 2) {
      // Advancing FROM offseason week 1 TO week 2
      // Clear previousJobData - user has committed to the new team
      if (dynasty.previousJobData) {
        additionalUpdates.previousJobData = null
      }
    } else if (dynasty.currentPhase === 'offseason' && dynasty.currentWeek === 5 && nextWeek === 6) {
      // YEAR FLIP - Happens when entering Signing Day (week 6)
      // The year changes here so that team pages for the new year become available
      nextYear = dynasty.currentYear + 1

      // CLASS PROGRESSION - Also happens at year flip
      // Progress all players' classes based on games played in the previous season
      const previousSeasonYear = dynasty.currentYear // The year that just ended
      const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName

      // Helper to get data by year (handles both string and numeric keys)
      const getByYearLocal = (obj, year) => obj?.[year] ?? obj?.[String(year)] ?? obj?.[Number(year)]

      const playerStats = getByYearLocal(dynasty.playerStatsByYear, previousSeasonYear) || []
      const players = dynasty.players || []

      // Progress each player's class
      const progressedPlayers = players.map(player => {
        // Skip honor-only players
        if (player.isHonorOnly) return player

        // Skip players from other teams
        if (player.team && player.team !== teamAbbr) return player

        // Skip players already marked as left
        if (player.leftTeam) return player

        // Skip recruits (they get converted when advanceToNewSeason runs)
        if (player.isRecruit) return player

        // Get games played for this player
        const stats = playerStats.find(s => s.pid === player.pid)
        let gamesPlayed = stats?.gamesPlayed ?? player.statsByYear?.[previousSeasonYear]?.gamesPlayed

        // Use confirmation if provided (for null gamesPlayed cases)
        if ((gamesPlayed === null || gamesPlayed === undefined) && classConfirmations[player.pid] !== undefined) {
          gamesPlayed = classConfirmations[player.pid] ? 5 : 0 // Treat as 5+ or 0
        }

        const isAlreadyRS = player.year?.startsWith('RS ')
        let newYear = player.year

        // Apply class progression based on games played
        if (gamesPlayed !== null && gamesPlayed !== undefined) {
          if (gamesPlayed <= 4 && !isAlreadyRS) {
            // Redshirt: add RS prefix (played 4 or fewer games)
            newYear = 'RS ' + player.year
          } else {
            // Normal progression
            newYear = CLASS_PROGRESSION[player.year] || player.year
          }
        } else {
          // No games data - default to normal progression
          newYear = CLASS_PROGRESSION[player.year] || player.year
        }

        // Return updated player if class changed
        if (newYear !== player.year) {
          return {
            ...player,
            year: newYear,
            classByYear: {
              ...(player.classByYear || {}),
              [nextYear]: newYear
            }
          }
        }
        return player
      })

      additionalUpdates.players = progressedPlayers
      // Mark that class progression has been done for this year
      additionalUpdates.classProgressionDoneForYear = nextYear
    } else if (dynasty.currentPhase === 'offseason' && nextWeek > 7) {
      // SEASON ADVANCEMENT to preseason - year already flipped when entering Signing Day
      // Just transition to preseason phase, no year change needed

      nextPhase = 'preseason'
      nextWeek = 0
      // nextYear stays the same (already set when entering week 6)

      // Clear CC firing data for the new season
      additionalUpdates.conferenceChampionshipData = null

      // Clear temporary sheet IDs from offseason
      additionalUpdates.trainingResultsSheetId = null
      additionalUpdates.playersLeavingSheetId = null
      additionalUpdates.encourageTransfersSheetId = null
      additionalUpdates.recruitOverallsSheetId = null
      additionalUpdates.conferencesSheetId = null
      additionalUpdates.portalTransferClassSheetId = null
      additionalUpdates.fringeCaseClassSheetId = null
      additionalUpdates.transferDestinationsSheetId = null
      additionalUpdates.draftResultsSheetId = null
    }

    await updateDynasty(dynastyId, {
      currentWeek: nextWeek,
      currentPhase: nextPhase,
      currentYear: nextYear,
      ...additionalUpdates
    })
  }

  /**
   * Advance to new season with full player processing
   * This handles: marking players as left, recruit conversion,
   * custom conferences, and detecting first year on team.
   *
   * NOTE: Class progression happens at Signing Day (offseason week 6), NOT here.
   * This function only updates teamsByYear and classByYear tracking for the new season.
   *
   * @param {string} dynastyId - The dynasty ID
   */
  const advanceToNewSeason = async (dynastyId) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    // IMPORTANT: Year flip happened when entering Signing Day (week 6).
    // At this point, dynasty.currentYear is already the NEW season year (e.g., 2027).
    // All offseason data (playersLeaving, playerStats, recruits, etc.) is stored under the PREVIOUS year (2026).
    const previousSeasonYear = Number(dynasty.currentYear) - 1  // The season that just ended (e.g., 2026)
    const currentSeasonYear = Number(dynasty.currentYear)       // The upcoming season (e.g., 2027)
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    const players = [...(dynasty.players || [])]

    // Helper to get data by year (handles both string and numeric keys)
    const getByYear = (obj, year) => obj?.[year] ?? obj?.[String(year)] ?? obj?.[Number(year)]

    const playerStats = getByYear(dynasty.playerStatsByYear, previousSeasonYear) || []

    // Get players leaving data (stored under previous season year)
    // CRITICAL: Check both string and numeric keys to handle any data format
    const playersLeavingThisYear = getByYear(dynasty.playersLeavingByYear, previousSeasonYear) || []
    const leavingPids = new Set(playersLeavingThisYear.map(p => p.pid).filter(Boolean))

    // Get encouraged transfers data (stored under previous season year)
    const encouragedTransfersForTeam = dynasty.encourageTransfersByTeamYear?.[teamAbbr]
    const encouragedTransfers = getByYear(encouragedTransfersForTeam, previousSeasonYear) || []
    const encouragedNames = new Set(encouragedTransfers.map(t => t.name?.toLowerCase().trim()))

    // Get draft results for draft round info (stored under previous season year)
    const draftResults = getByYear(dynasty.draftResultsByYear, previousSeasonYear) || []
    const draftByPid = {}
    draftResults.forEach(d => {
      if (d.pid) draftByPid[d.pid] = d
    })

    // Process each player
    const updatedPlayers = players.map(player => {
      // Skip honor-only players
      if (player.isHonorOnly) return player

      // Skip players from other teams
      if (player.team && player.team !== teamAbbr) return player

      // Skip players already marked as left
      if (player.leftTeam) return player

      // Check if player is leaving (from Players Leaving sheet)
      if (leavingPids.has(player.pid)) {
        const leavingEntry = playersLeavingThisYear.find(p => p.pid === player.pid)
        const reason = leavingEntry?.reason || 'Unknown'
        const draftInfo = draftByPid[player.pid]

        // If player transferred to another team, update their team
        if (player.transferredTo && !['Graduating', 'Pro Draft'].includes(reason)) {
          return {
            ...player,
            team: player.transferredTo,
            previousTeam: teamAbbr,
            leftTeam: false, // Not "left" - just transferred
            leftYear: null,
            leftReason: null,
            leavingYear: null,
            leavingReason: null,
            transferredTo: null,
            teamsByYear: {
              ...(player.teamsByYear || {}),
              [currentSeasonYear]: player.transferredTo
            }
          }
        }

        // Player is leaving (graduating or pro draft) - do NOT add current season year to teamsByYear
        return {
          ...player,
          leftTeam: true,
          leftYear: previousSeasonYear,
          leftReason: reason,
          draftRound: draftInfo?.draftRound || null,
          leavingYear: null, // Clear pending departure
          leavingReason: null,
          transferredTo: null
        }
      }

      // Check if player has leavingYear set on their record (retroactive marking)
      // Use Number() to handle string/number type mismatch
      if (Number(player.leavingYear) === previousSeasonYear && player.leavingReason) {
        const draftInfo = draftByPid[player.pid]

        // If player transferred to another team, update their team
        if (player.transferredTo && !['Graduating', 'Pro Draft'].includes(player.leavingReason)) {
          return {
            ...player,
            team: player.transferredTo,
            previousTeam: teamAbbr,
            leftTeam: false, // Not "left" - just transferred
            leftYear: null,
            leftReason: null,
            leavingYear: null,
            leavingReason: null,
            transferredTo: null,
            teamsByYear: {
              ...(player.teamsByYear || {}),
              [currentSeasonYear]: player.transferredTo
            }
          }
        }

        // Player is leaving (graduating or pro draft) - do NOT add current season year to teamsByYear
        return {
          ...player,
          leftTeam: true,
          leftYear: previousSeasonYear,
          leftReason: player.leavingReason,
          draftRound: draftInfo?.draftRound || null,
          leavingYear: null, // Clear pending departure
          leavingReason: null,
          transferredTo: null
        }
      }

      // Check if player is an encouraged transfer
      if (!player.isRecruit && encouragedNames.has(player.name?.toLowerCase().trim())) {
        // Player is leaving - do NOT add current season year to teamsByYear
        return {
          ...player,
          leftTeam: true,
          leftYear: previousSeasonYear,
          leftReason: 'Encouraged Transfer'
        }
      }

      // Check for RS Sr players not in playersLeaving - auto-graduate them
      // IMPORTANT: Only auto-graduate if they were ALREADY RS Sr in the previous season
      // (before Signing Day class progression). Players who just became RS Sr should play next season.
      const previousSeasonClass = player.classByYear?.[previousSeasonYear]
      if (previousSeasonClass === 'RS Sr' && !player.isRecruit) {
        // Player is leaving - do NOT add current season year to teamsByYear
        return {
          ...player,
          leftTeam: true,
          leftYear: previousSeasonYear,
          leftReason: 'Graduating'
        }
      }

      // Convert recruits to active players (recruits have recruitYear from the previous season's recruiting cycle)
      // Use Number() to handle string/number type mismatch
      if (player.isRecruit && Number(player.recruitYear) === previousSeasonYear) {
        let newYear

        // Check if this is a portal transfer with a manually assigned class
        if (player.isPortal) {
          const portalClassSelections = getByYear(dynasty.portalTransferClassByYear, previousSeasonYear) || []
          const classSelection = portalClassSelections.find(s =>
            s.playerName?.toLowerCase().trim() === player.name?.toLowerCase().trim()
          )
          if (classSelection?.selectedClass) {
            // Use the manually assigned class
            newYear = classSelection.selectedClass
          } else {
            // Portal transfer without manual selection: year is already set correctly
            // by classToYear mapping (Jr stays Jr, Sr stays Sr, etc.)
            newYear = player.year
          }
        } else {
          // HS/JUCO recruits: year is already set correctly by classToYear mapping
          // When recruited: HS recruits have year='Fr', JUCO Fr have year='So', etc.
          // No progression needed - just use the existing value
          newYear = player.year
        }

        return {
          ...player,
          isRecruit: false,
          year: newYear,
          // Track class for this season
          classByYear: {
            ...(player.classByYear || {}),
            [currentSeasonYear]: newYear
          }
        }
      }

      // Skip recruits from other years
      if (player.isRecruit) return player

      // Class progression already happened at Signing Day (offseason week 6)
      // Here we just need to add teamsByYear and classByYear tracking for the new season

      // CRITICAL: Add current season year to teamsByYear for players continuing on the team
      // This creates the immutable roster history record
      const updatedTeamsByYear = {
        ...(player.teamsByYear || {}),
        [currentSeasonYear]: teamAbbr
      }

      // Track class for this season (use existing player.year which was already updated at Signing Day)
      const updatedClassByYear = {
        ...(player.classByYear || {}),
        [currentSeasonYear]: player.year
      }

      return {
        ...player,
        teamsByYear: updatedTeamsByYear,
        classByYear: updatedClassByYear
      }
    })

    // Detect if first year on new team (for preseason roster entry)
    const previousYearTeam = dynasty.coachTeamByYear?.[previousSeasonYear]?.team
    const isFirstYearOnTeam = previousYearTeam !== teamAbbr

    // Get current coaching staff and apply any pending hires from offseason
    let currentCoachingStaff = { ...dynasty.coachingStaff } || { hcName: null, ocName: null, dcName: null }
    const pendingHires = dynasty.pendingCoordinatorHires
    if (pendingHires) {
      if (pendingHires.filledOC && pendingHires.newOCName) {
        currentCoachingStaff.ocName = pendingHires.newOCName
      }
      if (pendingHires.filledDC && pendingHires.newDCName) {
        currentCoachingStaff.dcName = pendingHires.newDCName
      }
    }

    // Initialize empty preseason setup for the new year
    // In subsequent years (not first year on team), we don't need roster entry
    // Schedule and team ratings always need to be re-entered each year
    // Coaching staff carries over from previous year (auto-filled)
    const existingPreseasonSetup = dynasty.preseasonSetupByTeamYear || {}
    const teamPreseasonSetup = existingPreseasonSetup[teamAbbr] || {}

    const newYearPreseasonSetup = {
      scheduleEntered: false,
      rosterEntered: !isFirstYearOnTeam, // Skip roster entry if continuing with same team
      teamRatingsEntered: false,
      coachingStaffEntered: !isFirstYearOnTeam, // Auto-filled if continuing with same team
      conferencesEntered: true // Conferences were set in offseason week 7
    }

    // Store coaching staff for new year (carries over from previous year)
    const existingCoachingStaffByTeamYear = dynasty.coachingStaffByTeamYear || {}
    const teamCoachingStaff = existingCoachingStaffByTeamYear[teamAbbr] || {}

    // Prepare updates
    const updates = {
      players: updatedPlayers,
      isFirstYearOnCurrentTeam: isFirstYearOnTeam,
      // Update main coaching staff with any pending hires
      coachingStaff: currentCoachingStaff,
      // Clear pending hires since we've applied them
      pendingCoordinatorHires: null,
      // Store coaching staff for new year using team-centric pattern
      coachingStaffByTeamYear: {
        ...existingCoachingStaffByTeamYear,
        [teamAbbr]: {
          ...teamCoachingStaff,
          [currentSeasonYear]: currentCoachingStaff
        }
      },
      // Initialize preseason setup for new year using team-centric pattern
      preseasonSetupByTeamYear: {
        ...existingPreseasonSetup,
        [teamAbbr]: {
          ...teamPreseasonSetup,
          [currentSeasonYear]: newYearPreseasonSetup
        }
      }
    }

    // Apply custom conferences for next year if set
    if (dynasty.customConferencesByYear?.[currentSeasonYear]) {
      updates.customConferences = dynasty.customConferencesByYear[currentSeasonYear]
    }

    await updateDynasty(dynastyId, updates)
  }

  const revertWeek = async (dynastyId) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    const { currentPhase, currentWeek, currentYear, startYear } = dynasty
    let prevWeek = currentWeek
    let prevPhase = currentPhase
    let prevYear = currentYear
    let additionalUpdates = {}

    // Phase structure:
    // - Preseason: Week 0
    // - Regular Season: Weeks 1-12
    // - Conference Championship: Week 1
    // - Postseason: Weeks 1-5
    // - Offseason: Weeks 1-7

    // Determine the previous phase/week based on current state
    if (currentPhase === 'preseason') {
      // Preseason Week 0 → Previous Year's Offseason Week 7
      if (currentYear <= startYear) {
        // Can't go back before the dynasty started
        // Cannot revert: at start of dynasty
        return
      }
      prevPhase = 'offseason'
      prevWeek = 7
      prevYear = currentYear - 1
    } else if (currentPhase === 'regular_season') {
      if (currentWeek <= 1) {
        // Regular Season Week 1 → Preseason Week 0
        prevPhase = 'preseason'
        prevWeek = 0
      } else {
        // Regular Season Week N → Regular Season Week N-1
        prevWeek = currentWeek - 1
      }
    } else if (currentPhase === 'conference_championship') {
      // Conference Championship Week 1 → Regular Season Week 12
      prevPhase = 'regular_season'
      prevWeek = 12
    } else if (currentPhase === 'postseason') {
      if (currentWeek <= 1) {
        // Postseason Week 1 → Conference Championship Week 1
        prevPhase = 'conference_championship'
        prevWeek = 1
      } else {
        // Postseason Week N → Postseason Week N-1
        prevWeek = currentWeek - 1
      }
    } else if (currentPhase === 'offseason') {
      if (currentWeek <= 1) {
        // Offseason Week 1 → Postseason Week 5
        prevPhase = 'postseason'
        prevWeek = 5
      } else {
        // Offseason Week N → Offseason Week N-1
        prevWeek = currentWeek - 1
      }
    } else {
      console.error('Unknown phase:', currentPhase)
      return
    }

    // Remove game data from the week we're reverting from
    let updatedGames = [...(dynasty.games || [])]
    const year = dynasty.currentYear

    if (dynasty.currentPhase === 'regular_season') {
      // Remove regular season game for current week
      updatedGames = updatedGames.filter(g =>
        !(g.week === dynasty.currentWeek && g.year === year && !g.isConferenceChampionship)
      )
    } else if (dynasty.currentPhase === 'conference_championship') {
      // Remove CC game from games array
      updatedGames = updatedGames.filter(g =>
        !(g.isConferenceChampionship && g.year === year)
      )

      // Restore fired coordinators if any were fired during this CC phase
      const ccData = dynasty.conferenceChampionshipData
      if (ccData && ccData.year === year) {
        // Restore coordinator names that were fired
        if (ccData.firedOCName || ccData.firedDCName) {
          const restoredStaff = { ...dynasty.coachingStaff }
          if (ccData.firedOCName) {
            restoredStaff.ocName = ccData.firedOCName
          }
          if (ccData.firedDCName) {
            restoredStaff.dcName = ccData.firedDCName
          }
          additionalUpdates.coachingStaff = restoredStaff
          // Restore the coachingStaffEntered flag since we're restoring the coordinators
          additionalUpdates['preseasonSetup.coachingStaffEntered'] = true
        }
      }

      // Clear all CC data
      additionalUpdates.conferenceChampionshipData = null
      // Clear CC sheet ID
      additionalUpdates.conferenceChampionshipSheetId = null
    } else if (dynasty.currentPhase === 'postseason') {
      // Postseason has 4 weeks:
      // Week 1: Bowl Week 1 + CFP First Round (seeds 5-12)
      // Week 2: Bowl Week 2 + CFP Quarterfinals (seeds 1-4 enter)
      // Week 3: Bowl Week 3 + CFP Semifinals
      // Week 4: National Championship

      const existingBowlGames = dynasty.bowlGamesByYear || {}
      const yearBowlGames = existingBowlGames[year] || {}
      const existingCFPResults = dynasty.cfpResultsByYear || {}
      const yearCFPResults = existingCFPResults[year] || {}

      if (dynasty.currentWeek === 1) {
        // Reverting FROM Week 1 TO Conference Championship phase
        // Clear ALL Bowl Week 1 data

        // Remove user's CFP First Round game and bowl game from games array
        updatedGames = updatedGames.filter(g =>
          !(g.isCFPFirstRound && g.year === year) &&
          !(g.isBowlGame && g.year === year && g.bowlWeek === 'week1')
        )

        // Clear conference championships data
        additionalUpdates.conferenceChampionships = null
        const existingCCByYear = dynasty.conferenceChampionshipsByYear || {}
        additionalUpdates.conferenceChampionshipsByYear = { ...existingCCByYear, [year]: null }

        // Clear CFP Seeds for current year
        const existingCFPSeeds = dynasty.cfpSeedsByYear || {}
        additionalUpdates.cfpSeedsByYear = { ...existingCFPSeeds, [year]: null }

        // Clear bowl eligibility data
        additionalUpdates.bowlEligibilityData = null

        // Clear new job data
        additionalUpdates.newJobData = null

        // Clear Bowl Week 1 results
        additionalUpdates.bowlGamesByYear = {
          ...existingBowlGames,
          [year]: { ...yearBowlGames, week1: null }
        }

        // Clear CFP First Round results
        additionalUpdates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearCFPResults, firstRound: null }
        }

        // Clear all sheet IDs for this phase
        additionalUpdates.bowlWeek1SheetId = null
        additionalUpdates.cfpSeedsSheetId = null
        additionalUpdates.cfpFirstRoundSheetId = null

      } else if (dynasty.currentWeek === 2) {
        // Reverting FROM Week 2 TO Week 1
        // Clear Week 2 data (Bowl Week 2 + CFP Quarterfinals)

        // Remove user's CFP Quarterfinal game and bowl game from games array
        updatedGames = updatedGames.filter(g =>
          !(g.isCFPQuarterfinal && g.year === year) &&
          !(g.isBowlGame && g.year === year && g.bowlWeek === 'week2')
        )

        // Clear Bowl Week 2 results
        additionalUpdates.bowlGamesByYear = {
          ...existingBowlGames,
          [year]: { ...yearBowlGames, week2: null }
        }

        // Clear CFP Quarterfinal results
        additionalUpdates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearCFPResults, quarterfinals: null }
        }

        // Clear all sheet IDs for this phase
        additionalUpdates.bowlWeek2SheetId = null
        additionalUpdates.cfpQuarterfinalsSheetId = null

      } else if (dynasty.currentWeek === 3) {
        // Reverting FROM Week 3 TO Week 2
        // Clear Week 3 data (Bowl Week 3 + CFP Semifinals)

        // Remove user's CFP Semifinal game and bowl game from games array
        updatedGames = updatedGames.filter(g =>
          !(g.isCFPSemifinal && g.year === year) &&
          !(g.isBowlGame && g.year === year && g.bowlWeek === 'week3')
        )

        // Clear Bowl Week 3 results (if exists)
        additionalUpdates.bowlGamesByYear = {
          ...existingBowlGames,
          [year]: { ...yearBowlGames, week3: null }
        }

        // Clear CFP Semifinal results
        additionalUpdates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearCFPResults, semifinals: null }
        }

        // Clear all sheet IDs for this phase (if they exist)
        additionalUpdates.bowlWeek3SheetId = null
        additionalUpdates.cfpSemifinalsSheetId = null

      } else if (dynasty.currentWeek === 4) {
        // Reverting FROM Week 4 TO Week 3
        // Clear Week 4 data (National Championship)

        // Remove user's CFP Championship game from games array
        updatedGames = updatedGames.filter(g =>
          !(g.isCFPChampionship && g.year === year)
        )

        // Clear CFP Championship results
        additionalUpdates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearCFPResults, championship: null }
        }

        // Clear sheet ID (if exists)
        additionalUpdates.cfpChampionshipSheetId = null
      } else if (dynasty.currentWeek === 5) {
        // Reverting FROM Week 5 TO Week 4
        // Week 5 (End of Season Recap) - only clears championship data
        // that was entered by users who weren't in the championship

        // Clear CFP Championship results (if entered during recap week)
        additionalUpdates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearCFPResults, championship: null }
        }
      }
    } else if (dynasty.currentPhase === 'offseason') {
      // Reverting within offseason
      if (dynasty.currentWeek === 1 && prevPhase === 'postseason') {
        // Reverting FROM offseason week 1 TO postseason week 5
        // If user switched teams, restore the previous team
        const previousJobData = dynasty.previousJobData
        if (previousJobData) {
          // Restore the old team
          additionalUpdates.teamName = previousJobData.teamName
          additionalUpdates.coachPosition = previousJobData.coachPosition
          additionalUpdates.conference = previousJobData.conference
          additionalUpdates.schedule = previousJobData.schedule
          additionalUpdates.teamRatings = previousJobData.teamRatings
          additionalUpdates.coachingStaff = previousJobData.coachingStaff
          additionalUpdates.googleSheetId = previousJobData.googleSheetId
          additionalUpdates.googleSheetUrl = previousJobData.googleSheetUrl
          additionalUpdates.preseasonSetup = previousJobData.preseasonSetup
          // Restore the accepted job offer so it shows again
          additionalUpdates.newJobData = previousJobData.newJobData
          // Remove the last entry from coaching history (the stint we just added)
          const existingHistory = dynasty.coachingHistory || []
          if (existingHistory.length > 0) {
            additionalUpdates.coachingHistory = existingHistory.slice(0, -1)
          }
          // Clear previousJobData since we've restored it
          additionalUpdates.previousJobData = null
        }
      }
    }

    await updateDynasty(dynastyId, {
      currentWeek: prevWeek,
      currentPhase: prevPhase,
      currentYear: prevYear,
      games: updatedGames,
      ...additionalUpdates
    })
  }

  const saveSchedule = async (dynastyId, schedule) => {
    // CRITICAL: Read from localStorage to get the latest data
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    // Get current team abbreviation and year for team-centric storage
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    const year = dynasty.currentYear

    // Build team-centric schedule storage
    const existingSchedulesByTeamYear = dynasty.schedulesByTeamYear || {}
    const teamSchedules = existingSchedulesByTeamYear[teamAbbr] || {}

    // Build team-centric preseason setup storage
    const existingPreseasonSetupByTeamYear = dynasty.preseasonSetupByTeamYear || {}
    const teamSetups = existingPreseasonSetupByTeamYear[teamAbbr] || {}
    const currentSetup = teamSetups[year] || dynasty.preseasonSetup || {}

    const scheduleUpdates = isDev || !user
      ? {
          // Store in team-centric structure
          schedulesByTeamYear: {
            ...existingSchedulesByTeamYear,
            [teamAbbr]: {
              ...teamSchedules,
              [year]: schedule
            }
          },
          // Also update legacy schedule for backwards compatibility
          schedule,
          // Update team-centric preseason setup
          preseasonSetupByTeamYear: {
            ...existingPreseasonSetupByTeamYear,
            [teamAbbr]: {
              ...teamSetups,
              [year]: {
                ...currentSetup,
                scheduleEntered: true
              }
            }
          },
          // Also update legacy preseason setup
          preseasonSetup: {
            ...(dynasty.preseasonSetup || {}),
            scheduleEntered: true
          }
        }
      : {
          // Firestore: use dot notation for nested updates
          [`schedulesByTeamYear.${teamAbbr}.${year}`]: schedule,
          schedule,
          [`preseasonSetupByTeamYear.${teamAbbr}.${year}.scheduleEntered`]: true,
          'preseasonSetup.scheduleEntered': true
        }

    await updateDynasty(dynastyId, scheduleUpdates)
  }

  const saveRoster = async (dynastyId, players, options = {}) => {
    // CRITICAL: Read from localStorage to get the latest data (including any recent schedule save)
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    // Get team abbreviation - use provided teamAbbr or fall back to user's current team
    const teamAbbr = options.teamAbbr || getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    // Get year - use provided year or fall back to current year
    const year = options.year || dynasty.currentYear

    // ALWAYS use merge mode - never delete existing players that aren't in the sheet
    // This prevents accidental data loss if the sheet has fewer players than expected
    const existingPlayers = dynasty.players || []

    // Keep all players that are NOT on the team being edited
    // Players on the team being edited will be handled via name matching below
    const playersToKeep = existingPlayers.filter(p => {
      // Always keep honor-only players
      if (p.isHonorOnly) return true
      // Keep players from OTHER teams
      if (p.team && p.team !== teamAbbr) return true
      // Keep players with no team field (legacy data)
      if (!p.team) return true
      // For this team's players: they'll be updated via name matching if in sheet,
      // or preserved below if not in sheet
      return false
    })

    // Also preserve existing team players who are NOT in the incoming sheet data
    // This prevents accidental deletion of players who were filtered out of the sheet
    const incomingNames = new Set(players.map(p => (p.name || '').toLowerCase().trim()).filter(n => n))
    const teamPlayersNotInSheet = existingPlayers.filter(p => {
      if (p.isHonorOnly) return false // Already in playersToKeep
      if (p.team !== teamAbbr) return false // Not this team
      const nameLower = (p.name || '').toLowerCase().trim()
      // Keep if this player is NOT in the incoming sheet data
      return nameLower && !incomingNames.has(nameLower)
    })

    let finalPlayers
    let newNextPID

    // Find the highest existing PID to continue from
    const maxExistingPID = existingPlayers.reduce((max, p) => Math.max(max, p.pid || 0), 0)
    const startPID = Math.max(maxExistingPID + 1, dynasty.nextPID || 1)

    // Create a map of existing players by name for matching
    const existingPlayersByName = {}
    existingPlayers.forEach(p => {
      if (p.name && p.team === teamAbbr) {
        existingPlayersByName[p.name.toLowerCase().trim()] = p
      }
    })

    // Add team field and yearStarted to each player
    // For existing players (matched by name), preserve their original data
    // For new players, set yearStarted to the current editing year
    let nextPIDCounter = startPID
    const playersWithPIDs = players.map((player) => {
      const nameLower = (player.name || '').toLowerCase().trim()
      const existingPlayer = existingPlayersByName[nameLower]

      // For new players, assign a new PID
      let pid, id
      if (existingPlayer) {
        pid = existingPlayer.pid
        id = existingPlayer.id
      } else {
        pid = nextPIDCounter++
        id = `player-${pid}`
      }

      // For existing players, START with existing data and only update SPECIFIC editable fields from sheet
      // This prevents accidentally overwriting critical metadata with undefined values
      if (existingPlayer) {
        // CRITICAL: Set teamsByYear[year] = teamAbbr to record this player was on this team this year
        // This is the IMMUTABLE record that determines roster membership for past seasons
        // BUT: Skip adding the year if player is marked as leaving before this year
        const isLeavingBeforeThisYear = existingPlayer.leavingYear && existingPlayer.leavingYear < year
        const hasAlreadyLeft = existingPlayer.leftTeam === true
        const shouldAddToTeamsByYear = !isLeavingBeforeThisYear && !hasAlreadyLeft

        const updatedTeamsByYear = shouldAddToTeamsByYear
          ? {
              ...(existingPlayer.teamsByYear || {}),
              [year]: teamAbbr
            }
          : existingPlayer.teamsByYear || {}

        // Track player class for this season
        const playerClass = player.year || existingPlayer.year
        const updatedClassByYear = {
          ...(existingPlayer.classByYear || {}),
          [year]: playerClass
        }

        return {
          // Start with ALL existing player data (preserves everything by default)
          ...existingPlayer,
          // Update ONLY the fields that are editable via Google Sheet
          // These are the columns: First Name, Last Name, Position, Class, Dev Trait, Jersey #, Archetype, Overall, Height, Weight, Hometown, State, Image URL
          firstName: player.firstName ?? existingPlayer.firstName,
          lastName: player.lastName ?? existingPlayer.lastName,
          name: player.name || existingPlayer.name,
          position: player.position || existingPlayer.position,
          year: player.year || existingPlayer.year, // class (Fr, So, Jr, Sr, etc.)
          devTrait: player.devTrait || existingPlayer.devTrait,
          jerseyNumber: player.jerseyNumber ?? existingPlayer.jerseyNumber,
          archetype: player.archetype ?? existingPlayer.archetype,
          overall: player.overall ?? existingPlayer.overall,
          height: player.height ?? existingPlayer.height,
          weight: player.weight ?? existingPlayer.weight,
          hometown: player.hometown ?? existingPlayer.hometown,
          state: player.state ?? existingPlayer.state,
          pictureUrl: player.pictureUrl ?? existingPlayer.pictureUrl,
          // Ensure pid/id/team are correct
          pid,
          id,
          team: teamAbbr,
          // IMMUTABLE roster history - records which team player was on each year
          teamsByYear: updatedTeamsByYear,
          // IMMUTABLE class history - records what class player was each year
          classByYear: updatedClassByYear
          // ALL other fields (recruitYear, yearStarted, isRecruit, isPortal, stars, etc.)
          // are automatically preserved from ...existingPlayer and NOT overwritten
        }
      }

      // For NEW players (no name match), use sheet data with required fields
      return {
        ...player,
        pid,
        id,
        team: teamAbbr,
        yearStarted: player.yearStarted || year,
        // IMMUTABLE roster history - this player is on this team this year
        teamsByYear: { [year]: teamAbbr },
        // IMMUTABLE class history - record this player's class for this year
        classByYear: { [year]: player.year }
      }
    })

    // Get the PIDs of players being updated from the sheet
    const updatedPIDs = new Set(playersWithPIDs.map(p => p.pid))

    // Filter out players from playersToKeep that are being replaced by sheet data
    // This prevents duplicates when the same player appears in both playersToKeep and playersWithPIDs
    const filteredPlayersToKeep = playersToKeep.filter(p => !updatedPIDs.has(p.pid))

    // Filter out teamPlayersNotInSheet that somehow got a matching PID (edge case)
    const filteredTeamPlayersNotInSheet = teamPlayersNotInSheet.filter(p => !updatedPIDs.has(p.pid))

    // Combine: other teams + honor-only + team players not in sheet + sheet players
    // This ensures we never lose players just because they weren't in the sheet
    finalPlayers = [...filteredPlayersToKeep, ...filteredTeamPlayersNotInSheet, ...playersWithPIDs]
    newNextPID = nextPIDCounter  // Use the counter which only incremented for new players

    // Build team-centric preseason setup storage
    const existingPreseasonSetupByTeamYear = dynasty.preseasonSetupByTeamYear || {}
    const teamSetups = existingPreseasonSetupByTeamYear[teamAbbr] || {}
    const currentSetup = teamSetups[year] || dynasty.preseasonSetup || {}

    const rosterUpdates = isDev || !user
      ? {
          players: finalPlayers,
          nextPID: newNextPID,
          // Update team-centric preseason setup
          preseasonSetupByTeamYear: {
            ...existingPreseasonSetupByTeamYear,
            [teamAbbr]: {
              ...teamSetups,
              [year]: {
                ...currentSetup,
                rosterEntered: true
              }
            }
          },
          // Also update legacy preseason setup
          preseasonSetup: {
            ...dynasty.preseasonSetup,
            rosterEntered: true
          }
        }
      : {
          players: finalPlayers,
          nextPID: newNextPID,
          [`preseasonSetupByTeamYear.${teamAbbr}.${year}.rosterEntered`]: true,
          'preseasonSetup.rosterEntered': true
        }

    await updateDynasty(dynastyId, rosterUpdates)
  }

  const saveTeamRatings = async (dynastyId, ratings) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    // Get current team abbreviation and year for team-centric storage
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    const year = dynasty.currentYear

    // Build team-centric preseason setup storage
    const existingPreseasonSetupByTeamYear = dynasty.preseasonSetupByTeamYear || {}
    const teamSetups = existingPreseasonSetupByTeamYear[teamAbbr] || {}
    const currentSetup = teamSetups[year] || dynasty.preseasonSetup || {}

    // Build team-centric ratings storage
    const existingTeamRatingsByTeamYear = dynasty.teamRatingsByTeamYear || {}
    const teamRatingsForTeam = existingTeamRatingsByTeamYear[teamAbbr] || {}

    const teamRatingsUpdates = isDev || !user
      ? {
          // Store in team-centric structure
          teamRatingsByTeamYear: {
            ...existingTeamRatingsByTeamYear,
            [teamAbbr]: {
              ...teamRatingsForTeam,
              [year]: ratings
            }
          },
          // Also update legacy for backwards compatibility
          teamRatings: ratings,
          preseasonSetupByTeamYear: {
            ...existingPreseasonSetupByTeamYear,
            [teamAbbr]: {
              ...teamSetups,
              [year]: {
                ...currentSetup,
                teamRatingsEntered: true
              }
            }
          },
          preseasonSetup: {
            ...dynasty.preseasonSetup,
            teamRatingsEntered: true
          }
        }
      : {
          [`teamRatingsByTeamYear.${teamAbbr}.${year}`]: ratings,
          teamRatings: ratings,
          [`preseasonSetupByTeamYear.${teamAbbr}.${year}.teamRatingsEntered`]: true,
          'preseasonSetup.teamRatingsEntered': true
        }

    await updateDynasty(dynastyId, teamRatingsUpdates)
  }

  // Save team year info (record, conference) for any team/year combination
  const saveTeamYearInfo = async (dynastyId, teamAbbr, year, info) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    const updates = {}

    // Handle record update
    if (info.wins !== undefined && info.losses !== undefined) {
      const existingRecords = dynasty.teamRecordsByTeamYear || {}
      const teamRecords = existingRecords[teamAbbr] || {}

      if (isDev || !user) {
        updates.teamRecordsByTeamYear = {
          ...existingRecords,
          [teamAbbr]: {
            ...teamRecords,
            [year]: { wins: info.wins, losses: info.losses }
          }
        }
      } else {
        updates[`teamRecordsByTeamYear.${teamAbbr}.${year}`] = { wins: info.wins, losses: info.losses }
      }
    }

    // Handle conference update
    if (info.conference !== undefined) {
      const existingConferences = dynasty.conferenceByTeamYear || {}
      const teamConferences = existingConferences[teamAbbr] || {}

      if (isDev || !user) {
        updates.conferenceByTeamYear = {
          ...existingConferences,
          [teamAbbr]: {
            ...teamConferences,
            [year]: info.conference
          }
        }
      } else {
        updates[`conferenceByTeamYear.${teamAbbr}.${year}`] = info.conference
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateDynasty(dynastyId, updates)
    }
  }

  const saveCoachingStaff = async (dynastyId, staff) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    // Get current team abbreviation and year for team-centric storage
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    const year = dynasty.currentYear

    // Build team-centric preseason setup storage
    const existingPreseasonSetupByTeamYear = dynasty.preseasonSetupByTeamYear || {}
    const teamSetups = existingPreseasonSetupByTeamYear[teamAbbr] || {}
    const currentSetup = teamSetups[year] || dynasty.preseasonSetup || {}

    // Build team-centric coaching staff storage
    const existingCoachingStaffByTeamYear = dynasty.coachingStaffByTeamYear || {}
    const coachingStaffForTeam = existingCoachingStaffByTeamYear[teamAbbr] || {}

    const coachingStaffUpdates = isDev || !user
      ? {
          // Store in team-centric structure
          coachingStaffByTeamYear: {
            ...existingCoachingStaffByTeamYear,
            [teamAbbr]: {
              ...coachingStaffForTeam,
              [year]: staff
            }
          },
          // Also update legacy for backwards compatibility
          coachingStaff: staff,
          preseasonSetupByTeamYear: {
            ...existingPreseasonSetupByTeamYear,
            [teamAbbr]: {
              ...teamSetups,
              [year]: {
                ...currentSetup,
                coachingStaffEntered: true
              }
            }
          },
          preseasonSetup: {
            ...dynasty.preseasonSetup,
            coachingStaffEntered: true
          }
        }
      : {
          [`coachingStaffByTeamYear.${teamAbbr}.${year}`]: staff,
          coachingStaff: staff,
          [`preseasonSetupByTeamYear.${teamAbbr}.${year}.coachingStaffEntered`]: true,
          'preseasonSetup.coachingStaffEntered': true
        }

    await updateDynasty(dynastyId, coachingStaffUpdates)
  }

  const updatePlayer = async (dynastyId, updatedPlayer, yearStats = null) => {

    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    // Find the original player to check if name changed
    const originalPlayer = (dynasty.players || []).find(p => p.pid === updatedPlayer.pid)
    const oldName = originalPlayer?.name
    const newName = updatedPlayer.name
    const nameChanged = oldName && newName && oldName !== newName

    // Update the player in the players array
    const updatedPlayers = (dynasty.players || []).map(player =>
      player.pid === updatedPlayer.pid ? updatedPlayer : player
    )

    // Build the update object
    const updateData = { players: updatedPlayers }

    // If name changed, update all box scores in all games
    if (nameChanged) {
      const updatedGames = (dynasty.games || []).map(game => {
        if (!game.boxScore) return game

        // Helper to update player names in a stat category
        const updateStatCategory = (stats) => {
          if (!Array.isArray(stats)) return stats
          return stats.map(row => {
            if (row.playerName === oldName) {
              return { ...row, playerName: newName }
            }
            return row
          })
        }

        // Update both home and away box scores
        const updatedBoxScore = { ...game.boxScore }

        if (updatedBoxScore.home) {
          updatedBoxScore.home = { ...updatedBoxScore.home }
          Object.keys(updatedBoxScore.home).forEach(category => {
            updatedBoxScore.home[category] = updateStatCategory(updatedBoxScore.home[category])
          })
        }

        if (updatedBoxScore.away) {
          updatedBoxScore.away = { ...updatedBoxScore.away }
          Object.keys(updatedBoxScore.away).forEach(category => {
            updatedBoxScore.away[category] = updateStatCategory(updatedBoxScore.away[category])
          })
        }

        // Also update scoring summary if it contains the player's name
        if (Array.isArray(updatedBoxScore.scoringSummary)) {
          updatedBoxScore.scoringSummary = updatedBoxScore.scoringSummary.map(play => {
            const updated = { ...play }
            if (updated.scorer === oldName) updated.scorer = newName
            if (updated.passer === oldName) updated.passer = newName
            if (updated.patNotes === oldName) updated.patNotes = newName
            return updated
          })
        }

        return { ...game, boxScore: updatedBoxScore }
      })

      updateData.games = updatedGames

      // Also update player name in playerStatsByYear and detailedStatsByYear
      if (dynasty.playerStatsByYear) {
        const updatedPlayerStatsByYear = JSON.parse(JSON.stringify(dynasty.playerStatsByYear))
        Object.keys(updatedPlayerStatsByYear).forEach(year => {
          if (Array.isArray(updatedPlayerStatsByYear[year])) {
            updatedPlayerStatsByYear[year] = updatedPlayerStatsByYear[year].map(entry => {
              if (entry.name === oldName || entry.pid === updatedPlayer.pid) {
                return { ...entry, name: newName }
              }
              return entry
            })
          }
        })
        updateData.playerStatsByYear = updatedPlayerStatsByYear
      }

      if (dynasty.detailedStatsByYear) {
        const updatedDetailedStatsByYear = JSON.parse(JSON.stringify(dynasty.detailedStatsByYear))
        Object.keys(updatedDetailedStatsByYear).forEach(year => {
          const yearData = updatedDetailedStatsByYear[year]
          if (yearData && typeof yearData === 'object') {
            Object.keys(yearData).forEach(category => {
              if (Array.isArray(yearData[category])) {
                yearData[category] = yearData[category].map(entry => {
                  if (entry.name === oldName || entry.pid === updatedPlayer.pid) {
                    return { ...entry, name: newName }
                  }
                  return entry
                })
              }
            })
          }
        })
        updateData.detailedStatsByYear = updatedDetailedStatsByYear
      }
    }

    // If yearStats is provided, update playerStatsByYear and detailedStatsByYear
    if (yearStats && yearStats.year) {
      const year = yearStats.year.toString()
      const pid = updatedPlayer.pid

      // Update playerStatsByYear (games/snaps)
      const playerStatsByYear = JSON.parse(JSON.stringify(dynasty.playerStatsByYear || {}))
      if (!playerStatsByYear[year]) playerStatsByYear[year] = []

      // Find or create entry for this player
      const existingIdx = playerStatsByYear[year].findIndex(p => p.pid === pid)
      const playerEntry = {
        pid,
        name: updatedPlayer.name,
        position: updatedPlayer.position,
        year: updatedPlayer.year,
        gamesPlayed: yearStats.gamesPlayed || 0,
        snapsPlayed: yearStats.snapsPlayed || 0
      }

      if (existingIdx >= 0) {
        playerStatsByYear[year][existingIdx] = { ...playerStatsByYear[year][existingIdx], ...playerEntry }
      } else {
        playerStatsByYear[year].push(playerEntry)
      }
      updateData.playerStatsByYear = playerStatsByYear

      // Update detailedStatsByYear
      const detailedStatsByYear = JSON.parse(JSON.stringify(dynasty.detailedStatsByYear || {}))
      if (!detailedStatsByYear[year]) detailedStatsByYear[year] = {}

      // Helper to update a category
      const updateCategory = (stats, sheetCategoryName) => {
        if (!detailedStatsByYear[year][sheetCategoryName]) {
          detailedStatsByYear[year][sheetCategoryName] = []
        }

        const catData = detailedStatsByYear[year][sheetCategoryName]
        const existingCatIdx = catData.findIndex(p => p.pid === pid)

        // Build entry with pid and name
        const entry = { pid, name: updatedPlayer.name, ...stats }

        if (existingCatIdx >= 0) {
          catData[existingCatIdx] = { ...catData[existingCatIdx], ...entry }
        } else {
          catData.push(entry)
        }
      }

      // Update each category if it has data
      if (yearStats.passing) updateCategory(yearStats.passing, 'Passing')
      if (yearStats.rushing) updateCategory(yearStats.rushing, 'Rushing')
      if (yearStats.receiving) updateCategory(yearStats.receiving, 'Receiving')
      if (yearStats.blocking) updateCategory(yearStats.blocking, 'Blocking')
      if (yearStats.defensive) updateCategory(yearStats.defensive, 'Defensive')
      if (yearStats.kicking) updateCategory(yearStats.kicking, 'Kicking')
      if (yearStats.punting) updateCategory(yearStats.punting, 'Punting')
      if (yearStats.kickReturn) updateCategory(yearStats.kickReturn, 'Kick Return')
      if (yearStats.puntReturn) updateCategory(yearStats.puntReturn, 'Punt Return')

      updateData.detailedStatsByYear = detailedStatsByYear
    }

    await updateDynasty(dynastyId, updateData)
  }

  // Delete a player from the dynasty
  const deletePlayer = async (dynastyId, playerPid) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      return
    }

    // Remove the player from the players array
    const updatedPlayers = (dynasty.players || []).filter(player => player.pid !== playerPid)

    await updateDynasty(dynastyId, { players: updatedPlayers })
  }

  const createGoogleSheetForDynasty = async (dynastyId) => {
    if (!user) {
      throw new Error('You must be signed in to create Google Sheets')
    }


    // Use currentDynasty if IDs match, otherwise search in array
    let dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)

    if (!dynasty) {
      console.error('Dynasty not found. ID:', dynastyId)
      throw new Error('Dynasty not found')
    }

    if (dynasty.googleSheetId) {
      throw new Error('This dynasty already has a Google Sheet')
    }


    try {
      const sheetInfo = await createDynastySheet(
        dynasty.teamName,
        dynasty.coachName,
        dynasty.startYear
      )


      await updateDynasty(dynastyId, {
        googleSheetId: sheetInfo.spreadsheetId,
        googleSheetUrl: sheetInfo.spreadsheetUrl
      })

      return sheetInfo
    } catch (error) {
      console.error('❌ Failed to create Google Sheet:', error)
      throw error
    }
  }

  // Create a temporary Google Sheet pre-filled with existing data for editing
  const createTempSheetWithData = async (dynastyId) => {
    if (!user) {
      throw new Error('You must be signed in to create Google Sheets')
    }

    let dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)

    if (!dynasty) {
      throw new Error('Dynasty not found')
    }


    try {
      // Create a new sheet
      const sheetInfo = await createDynastySheet(
        dynasty.teamName,
        dynasty.coachName,
        dynasty.currentYear
      )


      // Get user team abbreviation
      const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)

      // Write existing schedule and roster data to the sheet
      await writeExistingDataToSheet(
        sheetInfo.spreadsheetId,
        dynasty.schedule,
        dynasty.players,
        userTeamAbbr
      )


      // Update dynasty with temporary sheet ID (will be deleted after save)
      await updateDynasty(dynastyId, {
        googleSheetId: sheetInfo.spreadsheetId,
        googleSheetUrl: sheetInfo.spreadsheetUrl
      })

      return sheetInfo
    } catch (error) {
      console.error('❌ Failed to create temporary sheet:', error)
      throw error
    }
  }

  // Delete the Google Sheet and clear references from dynasty
  const deleteSheetAndClearRefs = async (dynastyId) => {
    let dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)

    if (!dynasty || !dynasty.googleSheetId) {
      return
    }

    try {
      await deleteGoogleSheet(dynasty.googleSheetId)
    } catch (error) {
      console.error('Failed to delete sheet:', error)
    }

    // Clear references regardless of deletion success
    await updateDynasty(dynastyId, {
      googleSheetId: null,
      googleSheetUrl: null
    })
  }

  // Create a Conferences Google Sheet for a dynasty
  const createConferencesSheetForDynasty = async (dynastyId) => {
    if (!user) {
      throw new Error('You must be signed in to create Google Sheets')
    }

    let dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)

    if (!dynasty) {
      throw new Error('Dynasty not found')
    }

    if (dynasty.conferencesSheetId) {
      throw new Error('This dynasty already has a Conferences Sheet')
    }


    try {
      const sheetInfo = await createConferencesSheet(
        dynasty.teamName,
        dynasty.currentYear
      )


      await updateDynasty(dynastyId, {
        conferencesSheetId: sheetInfo.spreadsheetId,
        conferencesSheetUrl: sheetInfo.spreadsheetUrl
      })

      return sheetInfo
    } catch (error) {
      console.error('❌ Failed to create Conferences Sheet:', error)
      throw error
    }
  }

  // Save conferences data from sheet to dynasty
  const saveConferences = async (dynastyId, conferencesSheetId) => {
    if (!user) {
      throw new Error('You must be signed in to sync conferences')
    }

    let dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)

    if (!dynasty) {
      throw new Error('Dynasty not found')
    }

    try {
      // Read conferences from Google Sheet
      const conferences = await readConferencesFromSheet(conferencesSheetId)

      // Save to dynasty
      const isDev = import.meta.env.VITE_DEV_MODE === 'true'

      if (isDev || !user) {
        // Dev mode: Use localStorage with spread operator
        const currentData = localStorage.getItem('cfb-dynasties')
        const currentDynasties = currentData ? JSON.parse(currentData) : []
        const dynastyToUpdate = currentDynasties.find(d => d.id === dynastyId)
        if (dynastyToUpdate) {
          dynastyToUpdate.customConferences = conferences
          dynastyToUpdate.preseasonSetup = {
            ...dynastyToUpdate.preseasonSetup,
            conferencesEntered: true
          }
          dynastyToUpdate.lastModified = Date.now()
          localStorage.setItem('cfb-dynasties', JSON.stringify(currentDynasties))
          setDynasties(currentDynasties)
          if (currentDynasty?.id === dynastyId) {
            setCurrentDynasty(dynastyToUpdate)
          }
        }
      } else {
        // Production mode: Use Firestore dot notation
        await updateDynastyInFirestore(dynastyId, {
          customConferences: conferences,
          'preseasonSetup.conferencesEntered': true,
          lastModified: Date.now()
        })
      }

      return conferences
    } catch (error) {
      console.error('Error saving conferences:', error)
      throw error
    }
  }

  const exportDynasty = (dynastyId) => {

    // Find the dynasty to export
    const dynasty = dynasties.find(d => String(d.id) === String(dynastyId))

    if (!dynasty) {
      console.error('Dynasty not found:', dynastyId)
      throw new Error('Dynasty not found')
    }

    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(dynasty, null, 2)

    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    // Get team abbreviation
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName.replace(/\s+/g, '')

    // Format phase for filename
    const phaseNames = {
      'preseason': 'Preseason',
      'regular_season': 'Week' + dynasty.currentWeek,
      'conference_championship': 'ConfChamp',
      'postseason': 'Bowl' + dynasty.currentWeek,
      'offseason': 'Offseason' + dynasty.currentWeek
    }
    const phasePart = phaseNames[dynasty.currentPhase] || dynasty.currentPhase

    // Create filename with team, year, and phase
    const filename = `${teamAbbr}_${dynasty.currentYear}_${phasePart}.json`

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

  }

  const importDynasty = async (jsonFile) => {

    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = async (e) => {
        try {
          // Parse the JSON file
          const dynastyData = JSON.parse(e.target.result)

          // Remove fields that would link this to the original dynasty
          // This ensures the imported dynasty is a completely separate entity
          const {
            id: oldId,
            userId: oldUserId,
            lastModified: oldLastModified,
            createdAt: oldCreatedAt,
            shareCode: oldShareCode,
            isPublic: oldIsPublic,
            googleSheetsByTeam: oldGoogleSheets,
            ...cleanDynastyData
          } = dynastyData

          // Set timestamps to now (import time, not old export time)
          const now = Date.now()
          cleanDynastyData.lastModified = now
          cleanDynastyData.createdAt = now

          // Ensure the imported dynasty starts as private with no share code
          cleanDynastyData.isPublic = false

          // Save the dynasty using createDynasty logic
          const isDev = import.meta.env.VITE_DEV_MODE === 'true'

          if (isDev || !user) {
            // Dev mode: localStorage - needs an ID
            const newId = Date.now().toString()
            const importedDynasty = {
              ...cleanDynastyData,
              id: newId
            }
            const currentData = localStorage.getItem('cfb-dynasties')
            const currentDynasties = currentData ? JSON.parse(currentData) : []
            const updatedDynasties = [...currentDynasties, importedDynasty]
            localStorage.setItem('cfb-dynasties', JSON.stringify(updatedDynasties))
            setDynasties(updatedDynasties)
          } else {
            // Production mode: Firestore - let Firestore generate the ID
            const result = await createDynastyInFirestore(user.uid, cleanDynastyData)
          }

          resolve(cleanDynastyData)
        } catch (error) {
          console.error('Error importing dynasty:', error)
          // Return the actual error message for better debugging
          reject(new Error(error.message || 'Invalid JSON file or corrupted dynasty data'))
        }
      }

      reader.onerror = () => {
        reject(new Error('Error reading file'))
      }

      reader.readAsText(jsonFile)
    })
  }

  /**
   * Process honor entries (awards, all-americans, all-conference) and link to existing players or create new ones.
   *
   * @param {string} dynastyId
   * @param {string} honorType - 'awards', 'allAmericans', or 'allConference'
   * @param {Array} entries - Array of honor entries
   * @param {number} year - Year of the honors
   * @param {Array} transferDecisions - Array of { entryIndex, isSamePlayer } for resolved transfer confirmations
   * @returns {Object} { success, needsConfirmation, confirmations, message }
   */
  const processHonorPlayers = async (dynastyId, honorType, entries, year, transferDecisions = []) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'
    let dynasty

    if (isDev || !user) {
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      dynasty = currentDynasties.find(d => String(d.id) === String(dynastyId))
    } else {
      dynasty = String(currentDynasty?.id) === String(dynastyId)
        ? currentDynasty
        : dynasties.find(d => String(d.id) === String(dynastyId))
    }

    if (!dynasty) {
      return { success: false, message: 'Dynasty not found' }
    }

    const existingPlayers = [...(dynasty.players || [])]
    let nextPID = dynasty.nextPID || (existingPlayers.length + 1)

    // Track which entries need confirmation
    const confirmations = []

    // Track updates to make
    const playersToUpdate = [] // { pid, updates }
    const playersToCreate = [] // New player objects

    // Create a map of transfer decisions by entry index
    const decisionMap = {}
    transferDecisions.forEach(d => {
      decisionMap[d.entryIndex] = d.isSamePlayer
    })

    // Process each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      // Skip entries without a name
      if (!entry.player && !entry.name) continue

      const playerName = entry.player || entry.name
      // For allAmericans/allConference, school is the team; entry.team is the category label
      const playerTeam = (entry.school || entry.team || '').toUpperCase()
      const playerPosition = entry.position || ''

      // Find matching player
      const match = findMatchingPlayer(playerName, playerTeam, year, existingPlayers)

      if (match.matchType === 'exact') {
        // Auto-link to existing player
        playersToUpdate.push({
          pid: match.player.pid,
          honorType,
          entry: { ...entry, year },
          addTeam: playerTeam
        })
      } else if (match.matchType === 'transfer') {
        // Check if we have a decision for this entry
        if (decisionMap[i] !== undefined) {
          if (decisionMap[i]) {
            // User confirmed same player - link to existing
            playersToUpdate.push({
              pid: match.player.pid,
              honorType,
              entry: { ...entry, year },
              addTeam: playerTeam
            })
          } else {
            // User said different player - create new
            playersToCreate.push({
              name: playerName,
              position: playerPosition,
              team: playerTeam,
              honorType,
              entry: { ...entry, year }
            })
          }
        } else {
          // Need confirmation from user
          const lastHonor = getPlayerLastHonorDescription(match.player)
          confirmations.push({
            entryIndex: i,
            entry: { ...entry, year, honorType: getHonorDescription(honorType, entry) },
            player: match.player,
            existingTeams: match.existingTeams,
            existingYears: match.existingYears,
            lastHonor
          })
        }
      } else {
        // No match - create new player
        playersToCreate.push({
          name: playerName,
          position: playerPosition,
          team: playerTeam,
          honorType,
          entry: { ...entry, year }
        })
      }
    }

    // If there are confirmations needed, return them
    if (confirmations.length > 0) {
      return {
        success: false,
        needsConfirmation: true,
        confirmations,
        message: `${confirmations.length} player(s) may be transfers and need confirmation`
      }
    }

    // Apply updates to existing players
    // Use filter instead of find to get ALL updates for each player (e.g., multiple awards)
    let updatedPlayers = existingPlayers.map(p => {
      const updates = playersToUpdate.filter(u => u.pid === p.pid)
      if (updates.length === 0) return p

      const updatedPlayer = { ...p }

      // Initialize arrays if needed
      if (!updatedPlayer.awards) updatedPlayer.awards = []
      if (!updatedPlayer.allAmericans) updatedPlayer.allAmericans = []
      if (!updatedPlayer.allConference) updatedPlayer.allConference = []
      if (!updatedPlayer.teams) updatedPlayer.teams = []

      // Process each update for this player
      for (const update of updates) {
        // Add team if not already present
        if (update.addTeam && !updatedPlayer.teams.includes(update.addTeam)) {
          updatedPlayer.teams.push(update.addTeam)
        }

        // Add honor entry based on type
        if (update.honorType === 'awards') {
          // Check for duplicate
          const isDupe = updatedPlayer.awards.some(a =>
            a.year === update.entry.year && a.award === update.entry.award
          )
          if (!isDupe) {
            updatedPlayer.awards.push({
              year: update.entry.year,
              award: update.entry.award || update.entry.awardKey,
              team: update.entry.team,
              position: update.entry.position,
              class: update.entry.class
            })
          }
        } else if (update.honorType === 'allAmericans') {
          const isDupe = updatedPlayer.allAmericans.some(a =>
            a.year === update.entry.year &&
            a.designation === update.entry.designation &&
            a.position === update.entry.position
          )
          if (!isDupe) {
            updatedPlayer.allAmericans.push({
              year: update.entry.year,
              designation: update.entry.designation,
              position: update.entry.position,
              school: update.entry.school,
              class: update.entry.class
            })
          }
        } else if (update.honorType === 'allConference') {
          const isDupe = updatedPlayer.allConference.some(a =>
            a.year === update.entry.year &&
            a.designation === update.entry.designation &&
            a.position === update.entry.position
          )
          if (!isDupe) {
            updatedPlayer.allConference.push({
              year: update.entry.year,
              designation: update.entry.designation,
              position: update.entry.position,
              school: update.entry.school,
              class: update.entry.class
            })
          }
        }
      }

      return updatedPlayer
    })

    // Create new players
    for (const newPlayer of playersToCreate) {
      // Get the year from the entry for teamsByYear
      const entryYear = newPlayer.entry?.year || dynasty.currentYear
      const player = {
        pid: nextPID,
        id: `player-${nextPID}`,
        name: newPlayer.name,
        position: newPlayer.position,
        team: newPlayer.team,
        teams: [newPlayer.team],
        isHonorOnly: true, // Not a user's roster player
        // IMMUTABLE roster history - record which team they were on for this award year
        teamsByYear: { [entryYear]: newPlayer.team },
        awards: [],
        allAmericans: [],
        allConference: []
      }

      // Add the honor entry
      if (newPlayer.honorType === 'awards') {
        player.awards.push({
          year: newPlayer.entry.year,
          award: newPlayer.entry.award || newPlayer.entry.awardKey,
          team: newPlayer.entry.team,
          position: newPlayer.entry.position,
          class: newPlayer.entry.class
        })
      } else if (newPlayer.honorType === 'allAmericans') {
        player.allAmericans.push({
          year: newPlayer.entry.year,
          designation: newPlayer.entry.designation,
          position: newPlayer.entry.position,
          school: newPlayer.entry.school,
          class: newPlayer.entry.class
        })
      } else if (newPlayer.honorType === 'allConference') {
        player.allConference.push({
          year: newPlayer.entry.year,
          designation: newPlayer.entry.designation,
          position: newPlayer.entry.position,
          school: newPlayer.entry.school,
          class: newPlayer.entry.class
        })
      }

      updatedPlayers.push(player)
      nextPID++
    }

    // Save updated players
    await updateDynasty(dynastyId, {
      players: updatedPlayers,
      nextPID
    })

    return {
      success: true,
      needsConfirmation: false,
      message: `Processed ${playersToUpdate.length} existing players and created ${playersToCreate.length} new players`
    }
  }

  // Helper to get honor description for confirmation modal
  const getHonorDescription = (honorType, entry) => {
    if (honorType === 'awards') {
      return entry.award || 'Award'
    } else if (honorType === 'allAmericans') {
      const designation = entry.designation === 'first' ? '1st Team' :
                          entry.designation === 'second' ? '2nd Team' : 'Freshman'
      return `${designation} All-American`
    } else if (honorType === 'allConference') {
      const designation = entry.designation === 'first' ? '1st Team' :
                          entry.designation === 'second' ? '2nd Team' : 'Freshman'
      return `${designation} All-Conference`
    }
    return 'Honor'
  }

  const value = {
    dynasties,
    currentDynasty,
    loading,
    createDynasty,
    updateDynasty,
    deleteDynasty,
    selectDynasty,
    addGame,
    saveCPUBowlGames,
    saveCFPGames,
    saveCPUConferenceChampionships,
    advanceWeek,
    advanceToNewSeason,
    revertWeek,
    saveSchedule,
    saveRoster,
    saveTeamRatings,
    saveTeamYearInfo,
    saveCoachingStaff,
    updatePlayer,
    deletePlayer,
    createGoogleSheetForDynasty,
    createTempSheetWithData,
    deleteSheetAndClearRefs,
    createConferencesSheetForDynasty,
    saveConferences,
    exportDynasty,
    importDynasty,
    processHonorPlayers
  }

  return (
    <DynastyContext.Provider value={value}>
      {children}
    </DynastyContext.Provider>
  )
}

export default DynastyContext
