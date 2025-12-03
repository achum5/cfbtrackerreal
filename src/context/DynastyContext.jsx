import { createContext, useContext, useState, useEffect } from 'react'

const DynastyContext = createContext()

export function useDynasty() {
  const context = useContext(DynastyContext)
  if (!context) {
    throw new Error('useDynasty must be used within DynastyProvider')
  }
  return context
}

export function DynastyProvider({ children }) {
  const [dynasties, setDynasties] = useState([])
  const [currentDynasty, setCurrentDynasty] = useState(null)

  // Load dynasties from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cfb-dynasties')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setDynasties(parsed)
      } catch (error) {
        console.error('Error loading dynasties:', error)
      }
    }
  }, [])

  // Save dynasties to localStorage whenever they change
  useEffect(() => {
    if (dynasties.length > 0) {
      localStorage.setItem('cfb-dynasties', JSON.stringify(dynasties))
    } else {
      // Clear localStorage if no dynasties remain
      localStorage.removeItem('cfb-dynasties')
    }
  }, [dynasties])

  const createDynasty = (dynastyData) => {
    const newDynasty = {
      id: Date.now().toString(),
      ...dynastyData,
      currentYear: parseInt(dynastyData.startYear),
      currentWeek: 0,
      currentPhase: 'preseason', // preseason, regular_season, postseason, offseason
      createdAt: new Date().toISOString(),
      seasons: [],
      games: [],
      players: [],
      recruits: [],
      schedule: [], // Season schedule
      rankings: [], // Top 25 rankings over time
      preseasonSetup: {
        scheduleEntered: false,
        rosterEntered: false,
        rankingsEntered: false
      }
    }

    setDynasties(prev => [...prev, newDynasty])
    setCurrentDynasty(newDynasty)
    return newDynasty
  }

  const updateDynasty = (dynastyId, updates) => {
    setDynasties(prev =>
      prev.map(d => (d.id === dynastyId ? { ...d, ...updates } : d))
    )
    if (currentDynasty?.id === dynastyId) {
      setCurrentDynasty(prev => ({ ...prev, ...updates }))
    }
  }

  const deleteDynasty = (dynastyId) => {
    setDynasties(prev => prev.filter(d => d.id !== dynastyId))
    if (currentDynasty?.id === dynastyId) {
      setCurrentDynasty(null)
    }
  }

  const selectDynasty = (dynastyId) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    setCurrentDynasty(dynasty || null)
  }

  const addGame = (dynastyId, gameData) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    const game = {
      id: Date.now().toString(),
      ...gameData,
      createdAt: new Date().toISOString()
    }

    const updatedGames = [...dynasty.games, game]
    updateDynasty(dynastyId, { games: updatedGames })
    return game
  }

  const advanceWeek = (dynastyId) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    let nextWeek = dynasty.currentWeek + 1
    let nextPhase = dynasty.currentPhase
    let nextYear = dynasty.currentYear

    // Phase transitions
    if (dynasty.currentPhase === 'preseason' && nextWeek >= 1) {
      // Move to regular season
      nextPhase = 'regular_season'
      nextWeek = 1
    } else if (dynasty.currentPhase === 'regular_season' && nextWeek > 14) {
      // Move to postseason (conference championship week)
      nextPhase = 'postseason'
      nextWeek = 1
    } else if (dynasty.currentPhase === 'postseason' && nextWeek > 4) {
      // Move to offseason after bowls/playoffs
      nextPhase = 'offseason'
      nextWeek = 1
    } else if (dynasty.currentPhase === 'offseason' && nextWeek > 4) {
      // Move to next year's preseason
      nextPhase = 'preseason'
      nextWeek = 0
      nextYear = dynasty.currentYear + 1
    }

    updateDynasty(dynastyId, {
      currentWeek: nextWeek,
      currentPhase: nextPhase,
      currentYear: nextYear
    })
  }

  const saveSchedule = (dynastyId, schedule) => {
    updateDynasty(dynastyId, {
      schedule,
      preseasonSetup: {
        ...(dynasties.find(d => d.id === dynastyId)?.preseasonSetup || {}),
        scheduleEntered: true
      }
    })
  }

  const saveRoster = (dynastyId, players) => {
    updateDynasty(dynastyId, {
      players,
      preseasonSetup: {
        ...(dynasties.find(d => d.id === dynastyId)?.preseasonSetup || {}),
        rosterEntered: true
      }
    })
  }

  const saveRankings = (dynastyId, rankingsData) => {
    const dynasty = dynasties.find(d => d.id === dynastyId)
    if (!dynasty) return

    const updatedRankings = [...dynasty.rankings, rankingsData]
    updateDynasty(dynastyId, {
      rankings: updatedRankings,
      preseasonSetup: {
        ...dynasty.preseasonSetup,
        rankingsEntered: true
      }
    })
  }

  const value = {
    dynasties,
    currentDynasty,
    createDynasty,
    updateDynasty,
    deleteDynasty,
    selectDynasty,
    addGame,
    advanceWeek,
    saveSchedule,
    saveRoster,
    saveRankings
  }

  return (
    <DynastyContext.Provider value={value}>
      {children}
    </DynastyContext.Provider>
  )
}
