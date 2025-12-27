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
  const allPlayers = dynasty.players || []

  // Filter players by team (if they have team field) and exclude honor-only, recruits, and players who left
  return allPlayers.filter(p => {
    // Always exclude honor-only players from roster view
    if (p.isHonorOnly) return false

    // Exclude recruits - they haven't enrolled yet (show on recruiting page instead)
    if (p.isRecruit) return false

    // Exclude players who have left the team (graduated, transferred, drafted, etc.)
    if (p.leftTeam) return false

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
    // CPU games (team1/team2 matchups) are not tied to a specific user team
    if (g.isCPUGame) return false

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
 * Aggregate box score stats from all games into detailedStatsByYear format.
 * Computes fresh from all box scores each time (no merging to avoid double-counting).
 * This enables the dynasty leaderboards to show stats from individual games.
 */
export function aggregateBoxScoreStats(dynasty) {
  if (!dynasty?.games || !dynasty?.players) return {}

  const games = dynasty.games || []
  const players = dynasty.players || []

  // Create a lookup map from player name to PID
  const playerNameToPid = {}
  players.forEach(p => {
    if (p.name && p.pid) {
      playerNameToPid[p.name] = p.pid
      playerNameToPid[p.name.toLowerCase()] = p.pid
    }
  })

  // Mapping from box score field names to expected detailedStatsByYear field names
  const fieldMappings = {
    passing: {
      tabName: 'Passing',
      fields: {
        comp: 'Completions',
        attempts: 'Attempts',
        yards: 'Yards',
        tD: 'Touchdowns',
        iNT: 'Interceptions'
      }
    },
    rushing: {
      tabName: 'Rushing',
      fields: {
        carries: 'Carries',
        yards: 'Yards',
        tD: 'Touchdowns'
      }
    },
    receiving: {
      tabName: 'Receiving',
      fields: {
        receptions: 'Receptions',
        yards: 'Yards',
        tD: 'Touchdowns'
      }
    },
    defense: {
      tabName: 'Defensive',
      fields: {
        solo: 'Solo Tackles',
        assists: 'Assisted Tackles',
        tFL: 'Tackles for Loss',
        sack: 'Sacks',
        iNT: 'Interceptions',
        iNTYards: 'INT Return Yards',
        tD: 'Defensive TDs',
        deflections: 'Deflections',
        fF: 'Forced Fumbles',
        blocks: 'Blocks',
        safeties: 'Safeties'
      }
    },
    kicking: {
      tabName: 'Kicking',
      fields: {
        xPA: 'XP Attempted',
        xPM: 'XP Made',
        fGA: 'FG Attempted',
        fGM: 'FG Made'
      }
    },
    punting: {
      tabName: 'Punting',
      fields: {
        punts: 'Punts',
        yards: 'Punting Yards'
      }
    },
    kickReturn: {
      tabName: 'Kick Return',
      fields: {
        kR: 'Kickoff Returns',
        yards: 'KR Yardage',
        tD: 'KR Touchdowns'
      }
    },
    puntReturn: {
      tabName: 'Punt Return',
      fields: {
        pR: 'Punt Returns',
        yards: 'PR Yardage',
        tD: 'PR Touchdowns'
      }
    }
  }

  // Aggregate stats from box scores by year -> category -> player
  const result = {}

  games.forEach(game => {
    if (!game.boxScore) return
    const year = game.year
    if (!year) return

    if (!result[year]) result[year] = {}

    // Process both home and away teams (user's team stats are in one of these)
    const teamStats = [
      { side: 'home', data: game.boxScore.home },
      { side: 'away', data: game.boxScore.away }
    ]

    teamStats.forEach(({ data }) => {
      if (!data) return

      Object.entries(fieldMappings).forEach(([boxCategory, mapping]) => {
        const categoryData = data[boxCategory]
        if (!categoryData || !Array.isArray(categoryData)) return

        const tabName = mapping.tabName
        if (!result[year][tabName]) result[year][tabName] = {}

        categoryData.forEach(entry => {
          const playerName = entry.playerName
          if (!playerName) return

          const pid = playerNameToPid[playerName] || playerNameToPid[playerName.toLowerCase()]
          if (!pid) return

          if (!result[year][tabName][pid]) {
            result[year][tabName][pid] = { pid, name: playerName }
          }

          Object.entries(mapping.fields).forEach(([boxField, expectedField]) => {
            const value = entry[boxField]
            if (typeof value === 'number' && !isNaN(value)) {
              result[year][tabName][pid][expectedField] =
                (result[year][tabName][pid][expectedField] || 0) + value
            }
          })
        })
      })
    })
  })

  // Convert from nested objects to arrays
  const finalResult = {}
  Object.entries(result).forEach(([year, categories]) => {
    finalResult[year] = {}
    Object.entries(categories).forEach(([category, playerMap]) => {
      finalResult[year][category] = Object.values(playerMap)
    })
  })

  return finalResult
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
  const lockedStaff = dynasty.lockedCoachingStaffByYear?.[teamAbbr]?.[year]
  if (lockedStaff) {
    return lockedStaff
  }

  // Fall back to team-centric coaching staff (may have been updated after firings)
  const teamYearStaff = dynasty.coachingStaffByTeamYear?.[teamAbbr]?.[year]
  if (teamYearStaff) {
    return teamYearStaff
  }

  // Fall back to legacy coaching staff
  return dynasty.coachingStaff || { hcName: null, ocName: null, dcName: null }
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
          setDynasties(parsed)
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
      setDynasties(firestoreDynasties)
      setLoading(false)

      // Update current dynasty if it's in the list
      if (currentDynasty) {
        const updated = firestoreDynasties.find(d => d.id === currentDynasty.id)
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

  const updateDynasty = async (dynastyId, updates) => {
    const isDev = import.meta.env.VITE_DEV_MODE === 'true'

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

    // If games are being updated, re-aggregate box score stats for leaderboards
    let finalUpdates = { ...updates }
    if (updates.games) {
      // Get the current dynasty data to combine with updated games
      // Try localStorage first (most up-to-date), fall back to state
      const localData = localStorage.getItem('cfb-dynasties')
      const localDynasties = localData ? JSON.parse(localData) : null
      const existingDynasty = localDynasties
        ? localDynasties.find(d => String(d.id) === String(dynastyId))
        : dynasties.find(d => String(d.id) === String(dynastyId))

      if (existingDynasty) {
        // Create a temp dynasty with updated games to aggregate stats
        const tempDynasty = {
          ...existingDynasty,
          games: updates.games
        }
        const aggregatedStats = aggregateBoxScoreStats(tempDynasty)
        if (Object.keys(aggregatedStats).length > 0) {
          finalUpdates.detailedStatsByYear = aggregatedStats
        }
      }
    }

    // Add lastModified timestamp to all updates and sanitize
    const updatesWithTimestamp = removeUndefined({
      ...finalUpdates,
      lastModified: Date.now()
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
    const currentUserTeam = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    if (!cleanGameData.isCPUGame) {
      cleanGameData.userTeam = currentUserTeam
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
        id: gameId,
        updatedAt: new Date().toISOString()
      }
      updatedGames = [...dynasty.games]
      updatedGames[existingGameIndex] = game
    } else {
      // Add new game
      // For CFP games, generate proper slot ID based on game type
      let gameId = Date.now().toString()

      if (cleanGameData.isCFPFirstRound) {
        const cfpSeeds = dynasty.cfpSeedsByYear?.[cleanGameData.year] || []
        const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)
        const userSeed = cfpSeeds.find(s => s.team === userTeamAbbr)?.seed
        const oppSeed = userSeed ? 17 - userSeed : null
        const slotId = getFirstRoundSlotId(userSeed, oppSeed)
        if (slotId) {
          gameId = getCFPGameId(slotId, cleanGameData.year)
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
        createdAt: new Date().toISOString()
      }
      updatedGames = [...(dynasty.games || []), game]
    }

    // Build updates object
    let updates = { games: updatedGames }

    // If this is a CFP game, also update cfpResultsByYear so the bracket updates
    if (cleanGameData.isCFPFirstRound || cleanGameData.isCFPQuarterfinal ||
        cleanGameData.isCFPSemifinal || cleanGameData.isCFPChampionship) {
      const year = cleanGameData.year
      const existingCFPResults = dynasty.cfpResultsByYear || {}
      const yearResults = existingCFPResults[year] || {}

      // Get user's team abbreviation
      const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)

      // Determine winner based on scores
      const userScore = parseInt(cleanGameData.teamScore)
      const oppScore = parseInt(cleanGameData.opponentScore)
      const winner = userScore > oppScore ? userTeamAbbr : cleanGameData.opponent

      // Create the result entry
      const resultEntry = {
        team1: userTeamAbbr,
        team2: cleanGameData.opponent,
        team1Score: userScore,
        team2Score: oppScore,
        winner: winner
      }

      if (cleanGameData.isCFPFirstRound) {
        // Get user's seed to add seed info
        const cfpSeeds = dynasty.cfpSeedsByYear?.[year] || []
        const userSeed = cfpSeeds.find(s => s.team === userTeamAbbr)?.seed
        const oppSeed = userSeed ? 17 - userSeed : null

        resultEntry.seed1 = userSeed
        resultEntry.seed2 = oppSeed

        // Determine slot index based on seed matchup
        // cfpfr1: 5v12 (index 0), cfpfr2: 8v9 (index 1), cfpfr3: 6v11 (index 2), cfpfr4: 7v10 (index 3)
        const slotId = getFirstRoundSlotId(userSeed, oppSeed)
        const slotIndex = slotId ? parseInt(slotId.replace('cfpfr', '')) - 1 : -1

        // Initialize array with 4 slots if needed
        const existingFirstRound = yearResults.firstRound || [null, null, null, null]
        const newFirstRound = [...existingFirstRound]
        // Ensure array has 4 slots
        while (newFirstRound.length < 4) newFirstRound.push(null)
        // Place at correct slot
        if (slotIndex >= 0 && slotIndex < 4) {
          newFirstRound[slotIndex] = resultEntry
        }
        updates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearResults, firstRound: newFirstRound }
        }
      } else if (cleanGameData.isCFPQuarterfinal) {
        // Add bowl name for quarterfinal games (e.g., "Orange Bowl", "Rose Bowl")
        if (cleanGameData.bowlName) {
          resultEntry.bowlName = cleanGameData.bowlName
        }
        // Determine slot index based on bowl name
        // cfpqf1: Sugar (index 0), cfpqf2: Orange (index 1), cfpqf3: Rose (index 2), cfpqf4: Cotton (index 3)
        const slotId = getSlotIdFromBowlName(cleanGameData.bowlName)
        const slotIndex = slotId ? parseInt(slotId.replace('cfpqf', '')) - 1 : -1

        // Initialize array with 4 slots if needed
        const existingQF = yearResults.quarterfinals || [null, null, null, null]
        const newQF = [...existingQF]
        while (newQF.length < 4) newQF.push(null)
        if (slotIndex >= 0 && slotIndex < 4) {
          newQF[slotIndex] = resultEntry
        }
        updates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearResults, quarterfinals: newQF }
        }
      } else if (cleanGameData.isCFPSemifinal) {
        // Add bowl name for semifinal games (Peach Bowl or Fiesta Bowl)
        if (cleanGameData.bowlName) {
          resultEntry.bowlName = cleanGameData.bowlName
        }
        // Determine slot index based on bowl name
        // cfpsf1: Peach (index 0), cfpsf2: Fiesta (index 1)
        const slotId = getSlotIdFromBowlName(cleanGameData.bowlName)
        const slotIndex = slotId ? parseInt(slotId.replace('cfpsf', '')) - 1 : -1

        // Initialize array with 2 slots if needed
        const existingSF = yearResults.semifinals || [null, null]
        const newSF = [...existingSF]
        while (newSF.length < 2) newSF.push(null)
        if (slotIndex >= 0 && slotIndex < 2) {
          newSF[slotIndex] = resultEntry
        }
        updates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearResults, semifinals: newSF }
        }
      } else if (cleanGameData.isCFPChampionship) {
        // Add game name for championship
        if (cleanGameData.bowlName) {
          resultEntry.bowlName = cleanGameData.bowlName
        }
        // Championship is a single game (cfpnc), stored as array with one element for compatibility
        updates.cfpResultsByYear = {
          ...existingCFPResults,
          [year]: { ...yearResults, championship: [resultEntry] }
        }
      }
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

    // Filter out existing CPU bowl games for this year and week to avoid duplicates
    const filteredGames = existingGames.filter(g => {
      // Keep user games
      if (!g.isCPUGame) return true
      // Keep games from different years
      if (Number(g.year) !== Number(year)) return true
      // Keep games from different bowl weeks
      if (g.bowlWeek !== week) return true
      // Remove CPU bowl games from same year/week (will be replaced)
      return false
    })

    // Create game entries for each bowl game
    const newGames = bowlGames
      .filter(bowl => {
        // Only process games with valid data
        if (!bowl.team1 || !bowl.team2) return false
        if (bowl.team1Score === null || bowl.team1Score === undefined) return false
        if (bowl.team2Score === null || bowl.team2Score === undefined) return false
        // Skip user's bowl game (they enter it separately with full details)
        if (bowl.team1 === userTeamAbbr || bowl.team2 === userTeamAbbr) return false
        return true
      })
      .map(bowl => {
        // Determine winner
        const team1Score = parseInt(bowl.team1Score)
        const team2Score = parseInt(bowl.team2Score)
        const winner = team1Score > team2Score ? bowl.team1 : bowl.team2
        const winnerIsTeam1 = winner === bowl.team1

        return {
          id: `bowl-${year}-${bowl.bowlName?.replace(/\s+/g, '-').toLowerCase() || Date.now()}`,
          isCPUGame: true,
          isBowlGame: true,
          bowlName: bowl.bowlName,
          bowlWeek: week,
          year: Number(year),
          week: 'Bowl',
          location: 'neutral',
          // Store both teams' data
          team1: bowl.team1,
          team2: bowl.team2,
          team1Score: team1Score,
          team2Score: team2Score,
          winner: winner,
          // For display purposes (from winner's perspective)
          viewingTeamAbbr: winner,
          opponent: winnerIsTeam1 ? bowl.team2 : bowl.team1,
          teamScore: winnerIsTeam1 ? team1Score : team2Score,
          opponentScore: winnerIsTeam1 ? team2Score : team1Score,
          result: 'win',
          // Preserve any notes/links if they exist
          gameNote: bowl.gameNote || '',
          links: bowl.links || '',
          createdAt: new Date().toISOString()
        }
      })

    const updatedGames = [...filteredGames, ...newGames]

    await updateDynasty(dynastyId, { games: updatedGames })

    console.log(`Saved ${newGames.length} CPU bowl games to games[]`)
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

    // Filter out existing CPU conference championship games for this year to avoid duplicates
    const filteredGames = existingGames.filter(g => {
      // Keep user games
      if (!g.isCPUGame) return true
      // Keep games from different years
      if (Number(g.year) !== Number(year)) return true
      // Keep non-CC games
      if (!g.isConferenceChampionship) return true
      // Remove CPU CC games from same year (will be replaced)
      return false
    })

    // Create game entries for each conference championship game
    const newGames = championships
      .filter(cc => {
        // Only process games with valid data
        if (!cc.team1 || !cc.team2) return false
        if (cc.team1Score === null || cc.team1Score === undefined) return false
        if (cc.team2Score === null || cc.team2Score === undefined) return false
        // Skip user's CC game (they enter it separately with full details)
        if (cc.team1 === userTeamAbbr || cc.team2 === userTeamAbbr) return false
        return true
      })
      .map(cc => {
        // Determine winner
        const team1Score = parseInt(cc.team1Score)
        const team2Score = parseInt(cc.team2Score)
        const winner = team1Score > team2Score ? cc.team1 : cc.team2
        const winnerIsTeam1 = winner === cc.team1

        return {
          id: `cc-${year}-${cc.conference?.replace(/\s+/g, '-').toLowerCase() || Date.now()}`,
          isCPUGame: true,
          isConferenceChampionship: true,
          conference: cc.conference,
          year: Number(year),
          week: 'CCG',
          location: 'neutral',
          // Store both teams' data
          team1: cc.team1,
          team2: cc.team2,
          team1Score: team1Score,
          team2Score: team2Score,
          winner: winner,
          // For display purposes (from winner's perspective)
          viewingTeamAbbr: winner,
          opponent: winnerIsTeam1 ? cc.team2 : cc.team1,
          teamScore: winnerIsTeam1 ? team1Score : team2Score,
          opponentScore: winnerIsTeam1 ? team2Score : team1Score,
          result: 'win',
          // Preserve any notes/links if they exist
          gameNote: cc.gameNote || '',
          links: cc.links || '',
          createdAt: new Date().toISOString()
        }
      })

    const updatedGames = [...filteredGames, ...newGames]

    await updateDynasty(dynastyId, { games: updatedGames })

    console.log(`Saved ${newGames.length} CPU conference championship games to games[]`)
    return newGames
  }

  const advanceWeek = async (dynastyId) => {
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
    } else if (dynasty.currentPhase === 'regular_season' && nextWeek > 12) {
      // After week 12, move to conference championship week
      nextPhase = 'conference_championship'
      nextWeek = 1

      // LOCK IN COACHING STAFF: Save the coordinators at end of regular season
      // This preserves them for historical display even if they're fired in CC week
      const currentTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
      const currentStaff = dynasty.coachingStaff || getCurrentCoachingStaff(dynasty)
      if (currentStaff && (currentStaff.hcName || currentStaff.ocName || currentStaff.dcName)) {
        const existingLockedStaff = dynasty.lockedCoachingStaffByYear || {}
        const teamLockedStaff = existingLockedStaff[currentTeamAbbr] || {}
        additionalUpdates.lockedCoachingStaffByYear = {
          ...existingLockedStaff,
          [currentTeamAbbr]: {
            ...teamLockedStaff,
            [dynasty.currentYear]: { ...currentStaff }
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
          (!g.userTeam && !g.isCPUGame) // Legacy games without userTeam field
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
          // CPU games don't need userTeam (they have team1/team2)
          if (g.isCPUGame) return g
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
    } else if (dynasty.currentPhase === 'offseason' && nextWeek > 7) {
      // SEASON ADVANCEMENT - This is called when user has already confirmed class progressions
      // (or there were no players needing confirmation)
      // The actual advancement logic is in advanceToNewSeason() which should be called
      // with classConfirmations before this point. That function handles:
      // - Applying pending coordinator hires
      // - Setting up coaching staff for new year
      // - Initializing preseason setup flags

      nextPhase = 'preseason'
      nextWeek = 0
      nextYear = dynasty.currentYear + 1

      // Clear CC firing data for the new season
      additionalUpdates.conferenceChampionshipData = null

      // Clear temporary sheet IDs
      additionalUpdates.trainingResultsSheetId = null
      additionalUpdates.playersLeavingSheetId = null
      additionalUpdates.encourageTransfersSheetId = null
      additionalUpdates.recruitOverallsSheetId = null
      additionalUpdates.conferencesSheetId = null
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
   * This handles: marking players as left, class progression, recruit conversion,
   * custom conferences, and detecting first year on team.
   *
   * @param {string} dynastyId - The dynasty ID
   * @param {Object} classConfirmations - Map of {pid: boolean} for players needing confirmation
   *                                      where boolean = true means they played 5+ games
   */
  const advanceToNewSeason = async (dynastyId, classConfirmations = {}) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    const currentYear = dynasty.currentYear
    const nextYear = currentYear + 1
    const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    const players = [...(dynasty.players || [])]
    const playerStats = dynasty.playerStatsByYear?.[currentYear] || []

    // Get players leaving data
    const playersLeavingThisYear = dynasty.playersLeavingByYear?.[currentYear] || []
    const leavingPids = new Set(playersLeavingThisYear.map(p => p.pid))

    // Get encouraged transfers data
    const encouragedTransfers = dynasty.encourageTransfersByTeamYear?.[teamAbbr]?.[currentYear] || []
    const encouragedNames = new Set(encouragedTransfers.map(t => t.name?.toLowerCase().trim()))

    // Get draft results for draft round info
    const draftResults = dynasty.draftResultsByYear?.[currentYear] || []
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

        return {
          ...player,
          leftTeam: true,
          leftYear: currentYear,
          leftReason: reason,
          draftRound: draftInfo?.draftRound || null
        }
      }

      // Check if player is an encouraged transfer
      if (!player.isRecruit && encouragedNames.has(player.name?.toLowerCase().trim())) {
        return {
          ...player,
          leftTeam: true,
          leftYear: currentYear,
          leftReason: 'Encouraged Transfer'
        }
      }

      // Check for RS Sr players not in playersLeaving - auto-graduate them
      if (player.year === 'RS Sr' && !player.isRecruit) {
        return {
          ...player,
          leftTeam: true,
          leftYear: currentYear,
          leftReason: 'Graduating'
        }
      }

      // Convert recruits to active players
      if (player.isRecruit && player.recruitYear === currentYear) {
        return {
          ...player,
          isRecruit: false
          // Keep year class as-is - it was set correctly during recruiting
        }
      }

      // Skip recruits from other years
      if (player.isRecruit) return player

      // Apply class progression
      const stats = playerStats.find(s => s.pid === player.pid)
      let gamesPlayed = stats?.gamesPlayed

      // Use confirmation if provided (for null gamesPlayed cases)
      if ((gamesPlayed === null || gamesPlayed === undefined) && classConfirmations[player.pid] !== undefined) {
        gamesPlayed = classConfirmations[player.pid] ? 5 : 0 // Treat as 5+ or 0
      }

      const isAlreadyRS = player.year?.startsWith('RS ')
      let newYear = player.year

      if (gamesPlayed !== null && gamesPlayed !== undefined) {
        if (gamesPlayed <= 4 && !isAlreadyRS) {
          // Redshirt: add RS prefix
          newYear = 'RS ' + player.year
        } else {
          // Normal progression
          newYear = CLASS_PROGRESSION[player.year] || player.year
        }
      } else {
        // No games data and no confirmation - default to normal progression
        newYear = CLASS_PROGRESSION[player.year] || player.year
      }

      return {
        ...player,
        year: newYear
      }
    })

    // Detect if first year on new team (for preseason roster entry)
    const previousYearTeam = dynasty.coachTeamByYear?.[currentYear]?.team
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
          [nextYear]: currentCoachingStaff
        }
      },
      // Initialize preseason setup for new year using team-centric pattern
      preseasonSetupByTeamYear: {
        ...existingPreseasonSetup,
        [teamAbbr]: {
          ...teamPreseasonSetup,
          [nextYear]: newYearPreseasonSetup
        }
      }
    }

    // Apply custom conferences for next year if set
    if (dynasty.customConferencesByYear?.[nextYear]) {
      updates.customConferences = dynasty.customConferencesByYear[nextYear]
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
        console.log('Cannot revert: at start of dynasty')
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
          !(g.isBowlGame && g.year === year && g.bowlWeek === 1)
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
          !(g.isBowlGame && g.year === year && g.bowlWeek === 2)
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
          !(g.isBowlGame && g.year === year && g.bowlWeek === 3)
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

    // Determine if we should replace or merge
    // For user's team during preseason: replace
    // For other teams: always replace (we're adding their roster fresh)
    const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
    const isUserTeam = teamAbbr === userTeamAbbr
    const isPreseason = dynasty.currentPhase === 'preseason'
    const shouldReplace = !isUserTeam || isPreseason
    const existingPlayers = dynasty.players || []

    // Preserve honor-only players AND players from other teams
    const playersToKeep = existingPlayers.filter(p => {
      // Always keep honor-only players
      if (p.isHonorOnly) return true
      // Keep players from OTHER teams (they have a team field that doesn't match the team being edited)
      if (p.team && p.team !== teamAbbr) return true
      // If we're replacing (other team or preseason), remove this team's roster
      // Otherwise keep everything (merge mode)
      return !shouldReplace
    })

    let finalPlayers
    let newNextPID

    // Find the highest existing PID to continue from
    const maxExistingPID = existingPlayers.reduce((max, p) => Math.max(max, p.pid || 0), 0)
    const startPID = Math.max(maxExistingPID + 1, dynasty.nextPID || 1)

    // Add team field to each new player
    const playersWithPIDs = players.map((player, index) => ({
      ...player,
      pid: startPID + index,
      id: `player-${startPID + index}`,
      team: teamAbbr  // CRITICAL: Tag each player with their team
    }))

    // Combine preserved players with new roster
    finalPlayers = [...playersToKeep, ...playersWithPIDs]
    newNextPID = startPID + players.length

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

    // Update the player in the players array
    const updatedPlayers = (dynasty.players || []).map(player =>
      player.pid === updatedPlayer.pid ? updatedPlayer : player
    )

    // Build the update object
    const updateData = { players: updatedPlayers }

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

    // Create filename with dynasty name and date
    const filename = `${dynasty.teamName.replace(/\s+/g, '_')}_Dynasty_${dynasty.startYear}-${dynasty.currentYear}.json`

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

          // Remove the old ID and lastModified - will be replaced with fresh values
          const { id: oldId, userId: oldUserId, lastModified: oldLastModified, ...cleanDynastyData } = dynastyData

          // Set lastModified to now (import time, not old export time)
          cleanDynastyData.lastModified = Date.now()

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
      const player = {
        pid: nextPID,
        id: `player-${nextPID}`,
        name: newPlayer.name,
        position: newPlayer.position,
        team: newPlayer.team,
        teams: [newPlayer.team],
        isHonorOnly: true, // Not a user's roster player
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
    saveCPUConferenceChampionships,
    advanceWeek,
    advanceToNewSeason,
    revertWeek,
    saveSchedule,
    saveRoster,
    saveTeamRatings,
    saveCoachingStaff,
    updatePlayer,
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
