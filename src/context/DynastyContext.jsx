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
import { getAbbreviationFromDisplayName } from '../data/teamAbbreviations'
import { findMatchingPlayer, getPlayerLastHonorDescription, normalizePlayerName } from '../utils/playerMatching'
import { getFirstRoundSlotId, getSlotIdFromBowlName, getCFPGameId } from '../data/cfpConstants'

const DynastyContext = createContext()

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

    // Add lastModified timestamp to all updates and sanitize
    const updatesWithTimestamp = removeUndefined({
      ...updates,
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
      // Update existing game - ensure it has an ID (for legacy games that might not have one)
      const existingGame = dynasty.games[existingGameIndex]
      game = {
        ...existingGame,
        ...cleanGameData,
        id: existingGame.id || Date.now().toString(), // Ensure ID exists
        updatedAt: new Date().toISOString()
      }
      updatedGames = [...dynasty.games]
      updatedGames[existingGameIndex] = game
    } else {
      // Add new game
      game = {
        id: Date.now().toString(),
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
    } else if (dynasty.currentPhase === 'offseason' && nextWeek > 4) {
      nextPhase = 'preseason'
      nextWeek = 0
      nextYear = dynasty.currentYear + 1

      // Apply pending coordinator hires for the new season
      const pendingHires = dynasty.pendingCoordinatorHires
      if (pendingHires) {
        let updatedStaff = { ...dynasty.coachingStaff }
        if (pendingHires.filledOC && pendingHires.newOCName) {
          updatedStaff.ocName = pendingHires.newOCName
        }
        if (pendingHires.filledDC && pendingHires.newDCName) {
          updatedStaff.dcName = pendingHires.newDCName
        }
        additionalUpdates.coachingStaff = updatedStaff
        // Clear the pending hires and CC firing data for the new season
        additionalUpdates.pendingCoordinatorHires = null
        additionalUpdates.conferenceChampionshipData = null
      }
    }

    await updateDynasty(dynastyId, {
      currentWeek: nextWeek,
      currentPhase: nextPhase,
      currentYear: nextYear,
      ...additionalUpdates
    })
  }

  const revertWeek = async (dynastyId) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    let prevWeek = dynasty.currentWeek - 1
    let prevPhase = dynasty.currentPhase
    let prevYear = dynasty.currentYear
    let additionalUpdates = {}

    // Handle phase transitions backwards
    if (dynasty.currentPhase === 'regular_season' && prevWeek < 1) {
      // Go back to preseason
      prevPhase = 'preseason'
      prevWeek = 0
    } else if (dynasty.currentPhase === 'conference_championship' && prevWeek < 1) {
      // Go back to regular season week 12
      prevPhase = 'regular_season'
      prevWeek = 12
    } else if (dynasty.currentPhase === 'postseason' && prevWeek < 1) {
      // Go back to conference championship
      prevPhase = 'conference_championship'
      prevWeek = 1
    } else if (dynasty.currentPhase === 'offseason' && prevWeek < 1) {
      // Go back to postseason week 5 (End of Season Recap)
      prevPhase = 'postseason'
      prevWeek = 5
    } else if (dynasty.currentPhase === 'preseason' && prevWeek < 0) {
      // Go back to previous year's offseason
      prevPhase = 'offseason'
      prevWeek = 4
      prevYear = dynasty.currentYear - 1
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
      // Reverting within offseason - generally no game data to clear
      // But if reverting to postseason week 5, no additional clearing needed
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
      console.error('Dynasties array:', dynasties)
      console.error('ID comparison failed - checking types:')
      dynasties.forEach(d => {
        console.error(`  Dynasty ${d.teamName}: id="${d.id}" (${typeof d.id}) vs looking for "${dynastyId}" (${typeof dynastyId}) - Match: ${String(d.id) === String(dynastyId)}`)
      })
      return
    }


    const scheduleUpdates = isDev || !user
      ? {
          schedule,
          preseasonSetup: {
            ...(dynasty.preseasonSetup || {}),
            scheduleEntered: true
          }
        }
      : {
          schedule,
          'preseasonSetup.scheduleEntered': true  // Firestore dot notation for nested field merge
        }

    await updateDynasty(dynastyId, scheduleUpdates)


    // Verify it was saved
    const verification = localStorage.getItem('cfb-dynasties')
    if (verification) {
      const parsed = JSON.parse(verification)
      const saved = parsed.find(d => String(d.id) === String(dynastyId))
    }

    // VERIFICATION: Check localStorage to confirm schedule was saved
    if (isDev) {
      const saved = localStorage.getItem('cfb-dynasties')
      if (saved) {
        const parsed = JSON.parse(saved)
        const savedDynasty = parsed.find(d => String(d.id) === String(dynastyId))
        if (!savedDynasty?.schedule || savedDynasty.schedule.length === 0) {
          console.error('❌ ERROR: Schedule NOT in localStorage!')
        } else {
        }
      }
    }
  }

  const saveRoster = async (dynastyId, players) => {

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
      console.error('Dynasties array:', dynasties)
      console.error('ID comparison failed - checking types:')
      dynasties.forEach(d => {
        console.error(`  Dynasty ${d.teamName}: id="${d.id}" (${typeof d.id}) vs looking for "${dynastyId}" (${typeof dynastyId}) - Match: ${String(d.id) === String(dynastyId)}`)
      })
      return
    }


    // During preseason, replace roster completely (to avoid duplicates on re-sync)
    // After preseason, merge with existing (for recruiting additions)
    const isPreseason = dynasty.currentPhase === 'preseason'

    let finalPlayers
    let newNextPID

    if (isPreseason) {
      // Preseason: Replace roster entirely, start PIDs from 1
      const playersWithPIDs = players.map((player, index) => ({
        ...player,
        pid: index + 1,
        id: `player-${index + 1}`
      }))
      finalPlayers = playersWithPIDs
      newNextPID = players.length + 1
    } else {
      // Post-preseason: Merge with existing roster
      const nextPID = dynasty.nextPID || 1
      const playersWithPIDs = players.map((player, index) => ({
        ...player,
        pid: nextPID + index,
        id: `player-${nextPID + index}`
      }))
      const existingPlayers = dynasty.players || []
      finalPlayers = [...existingPlayers, ...playersWithPIDs]
      newNextPID = nextPID + players.length
    }

    const rosterUpdates = isDev || !user
      ? {
          players: finalPlayers,
          nextPID: newNextPID,
          preseasonSetup: {
            ...dynasty.preseasonSetup,
            rosterEntered: true
          }
        }
      : {
          players: finalPlayers,
          nextPID: newNextPID,
          'preseasonSetup.rosterEntered': true  // Firestore dot notation for nested field merge
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

    const teamRatingsUpdates = isDev || !user
      ? {
          teamRatings: ratings,
          preseasonSetup: {
            ...dynasty.preseasonSetup,
            teamRatingsEntered: true
          }
        }
      : {
          teamRatings: ratings,
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

    const coachingStaffUpdates = isDev || !user
      ? {
          coachingStaff: staff,
          preseasonSetup: {
            ...dynasty.preseasonSetup,
            coachingStaffEntered: true
          }
        }
      : {
          coachingStaff: staff,
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

          // Remove the old ID - Firestore will generate a new one
          const { id: oldId, userId: oldUserId, ...cleanDynastyData } = dynastyData

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
    let updatedPlayers = existingPlayers.map(p => {
      const update = playersToUpdate.find(u => u.pid === p.pid)
      if (!update) return p

      const updatedPlayer = { ...p }

      // Initialize arrays if needed
      if (!updatedPlayer.awards) updatedPlayer.awards = []
      if (!updatedPlayer.allAmericans) updatedPlayer.allAmericans = []
      if (!updatedPlayer.allConference) updatedPlayer.allConference = []
      if (!updatedPlayer.teams) updatedPlayer.teams = []

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
