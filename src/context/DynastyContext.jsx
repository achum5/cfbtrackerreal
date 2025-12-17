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
      console.log('Loading dynasties from localStorage (dev mode)')
      // Load from localStorage in dev mode
      const saved = localStorage.getItem('cfb-dynasties')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          console.log('Loaded', parsed.length, 'dynasties from localStorage')

          // VERIFICATION: Check if schedules are present
          parsed.forEach(d => {
            console.log(`Dynasty ${d.teamName}: schedule =`, d.schedule?.length || 0, 'games, players =', d.players?.length || 0, 'players')
          })

          setDynasties(parsed)
        } catch (error) {
          console.error('Error loading dynasties:', error)
        }
      } else {
        console.log('No dynasties found in localStorage')
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
    console.log('Setting up real-time listener for user:', user.uid)
    const unsubscribe = subscribeToDynasties(user.uid, (firestoreDynasties) => {
      console.log('🔄 Real-time listener fired! Received', firestoreDynasties.length, 'dynasties from Firestore')
      console.log('Dynasty IDs from Firestore:', firestoreDynasties.map(d => d.id))
      setDynasties(firestoreDynasties)
      setLoading(false)

      // Update current dynasty if it's in the list
      if (currentDynasty) {
        const updated = firestoreDynasties.find(d => d.id === currentDynasty.id)
        if (updated) {
          setCurrentDynasty(updated)
          console.log('Current dynasty updated from listener')
        } else {
          console.log('Current dynasty not found in Firestore list, clearing it')
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

    console.log('localStorage save effect triggered:', { isDev, dynastyCount: dynasties.length })
    if (isDev && dynasties.length > 0) {
      console.log('Saving', dynasties.length, 'dynasties to localStorage')
      localStorage.setItem('cfb-dynasties', JSON.stringify(dynasties))
      console.log('Saved to localStorage successfully')
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
        coachingStaffEntered: false
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

    // Try to create Google Sheet (works in both dev and production if user is authenticated)
    let sheetInfo = null
    if (user) {
      console.log('User authenticated, attempting to create Google Sheet...')
      console.log('User access token available:', !!user.accessToken)
      try {
        sheetInfo = await createDynastySheet(
          dynastyData.teamName,
          dynastyData.coachName,
          dynastyData.startYear
        )
        console.log('✅ Google Sheet created successfully:', sheetInfo)
      } catch (sheetError) {
        console.error('❌ Failed to create Google Sheet:', sheetError)
        console.error('Error details:', sheetError.message)
        // Continue without sheet - user can still use custom spreadsheets
      }
    } else {
      console.log('⚠️ User not authenticated - skipping Google Sheet creation')
      console.log('To use Google Sheets integration, please sign in with Google')
    }

    // Add sheet info to dynasty data
    const dynastyWithSheet = {
      ...newDynastyData,
      ...(sheetInfo && {
        googleSheetId: sheetInfo.spreadsheetId,
        googleSheetUrl: sheetInfo.spreadsheetUrl
      })
    }

    if (isDev || !user) {
      // Dev mode: use localStorage (but with sheet info if available)
      const newDynasty = {
        id: Date.now().toString(),
        ...dynastyWithSheet,
        createdAt: new Date().toISOString(),
        lastModified: Date.now()
      }
      console.log('Creating dynasty in dev mode:', newDynasty)

      // Immediately save to localStorage before updating state
      const existingDynasties = dynasties
      const updatedDynasties = [...existingDynasties, newDynasty]
      console.log('Saving to localStorage immediately:', updatedDynasties.length, 'dynasties')
      localStorage.setItem('cfb-dynasties', JSON.stringify(updatedDynasties))

      setDynasties(updatedDynasties)
      setCurrentDynasty(newDynasty)
      return newDynasty
    }

    // Production: use Firestore
    try {
      const newDynasty = await createDynastyInFirestore(user.uid, {
        ...dynastyWithSheet,
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
    console.log('updateDynasty called:', { dynastyId, isDev, hasUser: !!user, updates: Object.keys(updates) })

    // Add lastModified timestamp to all updates
    const updatesWithTimestamp = {
      ...updates,
      lastModified: Date.now()
    }

    if (isDev || !user) {
      // Dev mode: update local state
      console.log('Updating dynasty in dev mode')

      // CRITICAL FIX: Read from localStorage to get the absolute latest data
      // This prevents race conditions when multiple updates happen in quick succession
      const currentData = localStorage.getItem('cfb-dynasties')
      const currentDynasties = currentData ? JSON.parse(currentData) : dynasties
      console.log('Reading latest data from localStorage, found', currentDynasties.length, 'dynasties')

      const updated = currentDynasties.map(d => (String(d.id) === String(dynastyId) ? { ...d, ...updatesWithTimestamp } : d))
      console.log('Dynasties after update:', updated)

      // Immediately save to localStorage
      console.log('Saving updated dynasties to localStorage immediately')
      localStorage.setItem('cfb-dynasties', JSON.stringify(updated))

      setDynasties(updated)

      // CRITICAL FIX: Update currentDynasty with the full updated object from the array
      // instead of just merging updates (which can miss nested object changes)
      if (String(currentDynasty?.id) === String(dynastyId)) {
        const updatedDynasty = updated.find(d => String(d.id) === String(dynastyId))
        console.log('Updating currentDynasty with full object:', updatedDynasty?.preseasonSetup)
        setCurrentDynasty(updatedDynasty)
      }
      console.log('Dynasty updated in local state and localStorage')
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
    console.log('deleteDynasty called with ID:', dynastyId)
    console.log('Current dynasties count:', dynasties.length)
    console.log('Dynasty IDs:', dynasties.map(d => ({ id: d.id, type: typeof d.id })))

    const isDev = import.meta.env.VITE_DEV_MODE === 'true'

    if (isDev || !user) {
      // Dev mode: delete from local state
      console.log('Using dev mode delete')
      const updated = dynasties.filter(d => {
        const match = String(d.id) !== String(dynastyId)
        console.log(`Comparing ${d.id} (${typeof d.id}) !== ${dynastyId} (${typeof dynastyId}): ${match}`)
        return match
      })

      console.log('Dynasties after filter:', updated.length)

      // Immediately save to localStorage
      if (updated.length > 0) {
        localStorage.setItem('cfb-dynasties', JSON.stringify(updated))
        console.log('Saved to localStorage')
      } else {
        localStorage.removeItem('cfb-dynasties')
        console.log('Removed from localStorage (empty)')
      }

      setDynasties(updated)
      console.log('State updated')

      if (String(currentDynasty?.id) === String(dynastyId)) {
        setCurrentDynasty(null)
        console.log('Current dynasty cleared')
      }
      return
    }

    // Production: delete from Firestore
    console.log('Using production mode delete (Firestore)')
    try {
      console.log('Calling deleteDynastyFromFirestore with ID:', dynastyId)
      await deleteDynastyFromFirestore(dynastyId)
      console.log('Firestore delete successful')
      if (String(currentDynasty?.id) === String(dynastyId)) {
        setCurrentDynasty(null)
        console.log('Current dynasty cleared')
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
    console.log('========== ADD GAME START ==========')
    console.log('addGame: Saving game for week', gameData.week, 'year', gameData.year)
    console.log('Full gameData:', JSON.stringify(gameData, null, 2))

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
    const existingGameIndex = dynasty.games?.findIndex(
      g => Number(g.week) === Number(gameData.week) && Number(g.year) === Number(gameData.year)
    )

    let updatedGames
    let game

    if (existingGameIndex !== -1 && existingGameIndex !== undefined) {
      // Update existing game
      console.log('Updating existing game')
      game = {
        ...dynasty.games[existingGameIndex],
        ...gameData,
        updatedAt: new Date().toISOString()
      }
      updatedGames = [...dynasty.games]
      updatedGames[existingGameIndex] = game
    } else {
      // Add new game
      console.log('Adding new game')
      game = {
        id: Date.now().toString(),
        ...gameData,
        createdAt: new Date().toISOString()
      }
      updatedGames = [...(dynasty.games || []), game]
    }

    console.log('Saved game with week:', game.week, 'year:', game.year)
    console.log('Final game object:', JSON.stringify(game, null, 2))
    console.log('Total games in array:', updatedGames.length)

    await updateDynasty(dynastyId, { games: updatedGames })
    console.log('========== ADD GAME COMPLETE ==========')

    return game
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
          console.log('🗑️ Deleting Google Sheet after preseason...')
          await deleteGoogleSheet(dynasty.googleSheetId)
          additionalUpdates.googleSheetId = null
          additionalUpdates.googleSheetUrl = null
          console.log('✅ Google Sheet deleted successfully')
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
        console.log('🔥 Firing coordinator(s):', pendingFiring, { firedOCName, firedDCName })
      }
    } else if (dynasty.currentPhase === 'postseason' && nextWeek > 5) {
      nextPhase = 'offseason'
      nextWeek = 1
    } else if (dynasty.currentPhase === 'offseason' && nextWeek > 4) {
      nextPhase = 'preseason'
      nextWeek = 0
      nextYear = dynasty.currentYear + 1
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
      // Go back to postseason week 5
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

    if (dynasty.currentPhase === 'regular_season') {
      // Remove regular season game for current week
      updatedGames = updatedGames.filter(g =>
        !(g.week === dynasty.currentWeek && g.year === dynasty.currentYear && !g.isConferenceChampionship)
      )
    } else if (dynasty.currentPhase === 'conference_championship') {
      // Remove CC game and CC data
      updatedGames = updatedGames.filter(g =>
        !(g.isConferenceChampionship && g.year === dynasty.currentYear)
      )

      // Restore fired coordinators if any were fired during this CC phase
      const ccData = dynasty.conferenceChampionshipData
      if (ccData && ccData.year === dynasty.currentYear) {
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

      additionalUpdates.conferenceChampionshipData = null
    } else if (dynasty.currentPhase === 'postseason') {
      // Remove postseason game for current week
      updatedGames = updatedGames.filter(g =>
        !(g.week === dynasty.currentWeek && g.year === dynasty.currentYear && g.isPostseason)
      )
      // If reverting to CC phase, clear CC results
      if (prevPhase === 'conference_championship') {
        additionalUpdates.conferenceChampionships = null
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
    console.log('saveSchedule called:', { dynastyId, schedule })
    console.log('Available dynasties:', dynasties.map(d => ({ id: d.id, idType: typeof d.id, name: d.teamName })))
    console.log('Looking for ID:', dynastyId, 'Type:', typeof dynastyId)
    console.log('Current dynasty:', currentDynasty?.id, currentDynasty?.teamName)

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

    console.log('Saving schedule to dynasty:', dynasty.teamName)
    console.log('Current preseasonSetup BEFORE schedule save:', dynasty.preseasonSetup)
    console.log('Schedule being saved:', schedule)

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
    console.log('Schedule updates object:', scheduleUpdates)

    await updateDynasty(dynastyId, scheduleUpdates)

    console.log('Schedule saved successfully')
    console.log('After schedule save, reading back from localStorage...')

    // Verify it was saved
    const verification = localStorage.getItem('cfb-dynasties')
    if (verification) {
      const parsed = JSON.parse(verification)
      const saved = parsed.find(d => String(d.id) === String(dynastyId))
      console.log('VERIFICATION - preseasonSetup after schedule save:', saved?.preseasonSetup)
    }

    // VERIFICATION: Check localStorage to confirm schedule was saved
    if (isDev) {
      const saved = localStorage.getItem('cfb-dynasties')
      if (saved) {
        const parsed = JSON.parse(saved)
        const savedDynasty = parsed.find(d => String(d.id) === String(dynastyId))
        console.log('✅ VERIFICATION - Dynasty in localStorage:', savedDynasty?.teamName)
        console.log('✅ VERIFICATION - Schedule in localStorage:', savedDynasty?.schedule)
        if (!savedDynasty?.schedule || savedDynasty.schedule.length === 0) {
          console.error('❌ ERROR: Schedule NOT in localStorage!')
        } else {
          console.log(`✅ SUCCESS: ${savedDynasty.schedule.length} games saved to localStorage`)
        }
      }
    }
  }

  const saveRoster = async (dynastyId, players) => {
    console.log('saveRoster called:', { dynastyId, playerCount: players.length })
    console.log('Available dynasties:', dynasties.map(d => ({ id: d.id, idType: typeof d.id, name: d.teamName })))
    console.log('Looking for ID:', dynastyId, 'Type:', typeof dynastyId)
    console.log('Current dynasty:', currentDynasty?.id, currentDynasty?.teamName)

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

    console.log('Saving roster to dynasty:', dynasty.teamName, 'Phase:', dynasty.currentPhase)
    console.log('Current preseasonSetup BEFORE roster save:', dynasty.preseasonSetup)
    console.log('Will merge to create:', { ...dynasty.preseasonSetup, rosterEntered: true })

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
      console.log('Preseason mode: Replaced roster with', finalPlayers.length, 'players, nextPID:', newNextPID)
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
      console.log('Post-preseason mode: Merged roster, total players:', finalPlayers.length, 'nextPID:', newNextPID)
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
    console.log('Roster saved successfully')
    console.log('Final preseasonSetup after roster save:', {
      ...dynasty.preseasonSetup,
      rosterEntered: true
    })
  }

  const saveTeamRatings = async (dynastyId, ratings) => {
    console.log('saveTeamRatings called:', { dynastyId, ratings })

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
    console.log('Team ratings saved successfully')
  }

  const saveCoachingStaff = async (dynastyId, staff) => {
    console.log('saveCoachingStaff called:', { dynastyId, staff })

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
    console.log('Coaching staff saved successfully')
  }

  const updatePlayer = async (dynastyId, updatedPlayer) => {
    console.log('updatePlayer called:', { dynastyId, playerId: updatedPlayer.pid })

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

    await updateDynasty(dynastyId, { players: updatedPlayers })
    console.log('Player updated successfully')
  }

  const createGoogleSheetForDynasty = async (dynastyId) => {
    if (!user) {
      throw new Error('You must be signed in to create Google Sheets')
    }

    console.log('Looking for dynasty:', dynastyId)
    console.log('Available dynasties:', dynasties.map(d => ({ id: d.id, name: d.teamName })))
    console.log('Current dynasty:', currentDynasty?.id, currentDynasty?.teamName)

    // Use currentDynasty if IDs match, otherwise search in array
    let dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)

    if (!dynasty) {
      console.error('Dynasty not found. ID:', dynastyId)
      throw new Error('Dynasty not found')
    }

    if (dynasty.googleSheetId) {
      throw new Error('This dynasty already has a Google Sheet')
    }

    console.log('Creating Google Sheet for dynasty:', dynasty.teamName)

    try {
      const sheetInfo = await createDynastySheet(
        dynasty.teamName,
        dynasty.coachName,
        dynasty.startYear
      )

      console.log('✅ Google Sheet created:', sheetInfo)

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

    console.log('📝 Creating temporary Google Sheet with existing data...')

    try {
      // Create a new sheet
      const sheetInfo = await createDynastySheet(
        dynasty.teamName,
        dynasty.coachName,
        dynasty.currentYear
      )

      console.log('✅ Temporary sheet created:', sheetInfo.spreadsheetId)

      // Get user team abbreviation
      const userTeamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)

      // Write existing schedule and roster data to the sheet
      await writeExistingDataToSheet(
        sheetInfo.spreadsheetId,
        dynasty.schedule,
        dynasty.players,
        userTeamAbbr
      )

      console.log('✅ Existing data written to sheet')

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
      console.log('🗑️ Deleting Google Sheet...')
      await deleteGoogleSheet(dynasty.googleSheetId)
      console.log('✅ Sheet deleted')
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

    console.log('Creating Conferences Sheet for dynasty:', dynasty.teamName)

    try {
      const sheetInfo = await createConferencesSheet(
        dynasty.teamName,
        dynasty.currentYear
      )

      console.log('✅ Conferences Sheet created:', sheetInfo)

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
      console.log('Read conferences from sheet:', conferences)

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

      console.log('Conferences saved successfully')
      return conferences
    } catch (error) {
      console.error('Error saving conferences:', error)
      throw error
    }
  }

  const exportDynasty = (dynastyId) => {
    console.log('exportDynasty called:', { dynastyId })

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

    console.log('Dynasty exported successfully:', filename)
  }

  const importDynasty = async (jsonFile) => {
    console.log('importDynasty called')

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
            console.log('Dynasty imported to localStorage with new ID:', newId)
          } else {
            // Production mode: Firestore - let Firestore generate the ID
            console.log('Importing to Firestore...')
            const result = await createDynastyInFirestore(user.uid, cleanDynastyData)
            console.log('Dynasty imported to Firestore with ID:', result.id)
          }

          console.log('Dynasty imported successfully')
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

  const value = {
    dynasties,
    currentDynasty,
    loading,
    createDynasty,
    updateDynasty,
    deleteDynasty,
    selectDynasty,
    addGame,
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
    importDynasty
  }

  return (
    <DynastyContext.Provider value={value}>
      {children}
    </DynastyContext.Provider>
  )
}
