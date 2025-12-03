import { useEffect } from 'react'
import { getTeamColors } from '../data/teamColors'

export function useTeamColors(teamName) {
  const colors = getTeamColors(teamName)

  useEffect(() => {
    if (teamName && colors) {
      // Set CSS custom properties for the team colors
      document.documentElement.style.setProperty('--team-primary', colors.primary)
      document.documentElement.style.setProperty('--team-secondary', colors.secondary)
      if (colors.tertiary) {
        document.documentElement.style.setProperty('--team-tertiary', colors.tertiary)
      }
    }
  }, [teamName, colors])

  return colors
}
