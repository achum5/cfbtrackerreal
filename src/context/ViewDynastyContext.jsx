import { createContext, useContext, useState, useEffect } from 'react'
import { getPublicDynastyByShareCode } from '../services/dynastyService'
import { getAbbreviationFromDisplayName } from '../data/teamAbbreviations'
import DynastyContext from './DynastyContext'

const ViewDynastyContext = createContext()

/**
 * Universal hook that works in both regular and view-only modes
 * Use this in components that need to work in both contexts
 */
export function useDynastyCompat() {
  const viewContext = useContext(ViewDynastyContext)

  // If we're in view mode, use the view context
  if (viewContext) {
    return viewContext
  }

  // Otherwise, try to use the regular dynasty context
  // This will throw if not in a DynastyProvider, which is expected
  try {
    const dynastyContext = useDynastyContext()
    return {
      ...dynastyContext,
      isViewOnly: false
    }
  } catch (e) {
    // Not in any context
    return null
  }
}

/**
 * ViewDynastyProvider - Provides read-only dynasty data for public viewing
 * This is a simplified version of DynastyProvider that doesn't require authentication
 */
export function ViewDynastyProvider({ shareCode, children }) {
  const [dynasty, setDynasty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadDynasty = async () => {
      if (!shareCode) {
        setError('No share code provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const dynastyData = await getPublicDynastyByShareCode(shareCode)

        if (!dynastyData) {
          setError('Dynasty not found or sharing is disabled')
        } else {
          setDynasty(dynastyData)
        }
      } catch (err) {
        console.error('Error loading public dynasty:', err)
        setError('Failed to load dynasty')
      } finally {
        setLoading(false)
      }
    }

    loadDynasty()
  }, [shareCode])

  // Read-only context value
  const value = {
    // Dynasty data (read-only)
    currentDynasty: dynasty,
    dynasties: dynasty ? [dynasty] : [],
    loading,
    error,

    // View-only flag - components can check this to hide edit buttons
    isViewOnly: true,

    // No-op functions for compatibility (these do nothing in view mode)
    updateDynasty: async () => {
      console.warn('Cannot update dynasty in view-only mode')
    },
    addGame: async () => {
      console.warn('Cannot add game in view-only mode')
    },
    saveSchedule: async () => {
      console.warn('Cannot save schedule in view-only mode')
    },
    saveRoster: async () => {
      console.warn('Cannot save roster in view-only mode')
    },

    // Helper functions that work in view mode
    getCurrentSchedule: () => {
      if (!dynasty) return []
      const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
      const year = dynasty.currentYear
      return dynasty.schedulesByTeamYear?.[teamAbbr]?.[year] || dynasty.schedule || []
    },

    getCurrentRoster: () => {
      if (!dynasty) return []
      const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName) || dynasty.teamName
      return (dynasty.players || []).filter(p => {
        if (p.isHonorOnly) return false
        if (p.isRecruit) return false
        if (p.leftTeam) return false
        if (p.team) return p.team === teamAbbr
        return true
      })
    }
  }

  return (
    <ViewDynastyContext.Provider value={value}>
      {/* Also provide DynastyContext so useDynasty() works in view mode */}
      <DynastyContext.Provider value={value}>
        {children}
      </DynastyContext.Provider>
    </ViewDynastyContext.Provider>
  )
}

export function useViewDynasty() {
  const context = useContext(ViewDynastyContext)
  if (!context) {
    throw new Error('useViewDynasty must be used within a ViewDynastyProvider')
  }
  return context
}

export default ViewDynastyContext
