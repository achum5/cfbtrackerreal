// Pure mutation builder for the Recruiting Class Rank save (Signing Day).
// Extracted verbatim from Dashboard.jsx; pinned by __tests__/recruitingClassRank.test.js.

import { getCurrentTeamAbbr, getTidFromAbbr } from '../data/teamRegistry'

export function buildRecruitingClassRankSave(dynasty, rank) {
  // The year flips ENTERING Signing Day, so from week 6 on the class being
  // ranked belongs to the prior season.
  const isAfterYearFlip = dynasty.currentPhase === 'offseason' && dynasty.currentWeek >= 6
  const year = isAfterYearFlip ? dynasty.currentYear - 1 : dynasty.currentYear
  const teamAbbr = getCurrentTeamAbbr(dynasty) || dynasty.teamName
  const existingRanks = dynasty.recruitingClassRankByTeamYear || {}
  const tid = getTidFromAbbr(teamAbbr, dynasty)

  const updates = {
    recruitingClassRankByTeamYear: {
      ...existingRanks,
      [teamAbbr]: { ...(existingRanks[teamAbbr] || {}), [year]: rank },
      ...(tid ? { [tid]: { ...(existingRanks[tid] || {}), [year]: rank } } : {}),
    },
  }

  if (tid && dynasty.teams) {
    const existingTeams = dynasty.teams
    const existingTeamData = existingTeams[tid] || {}
    const existingByYear = existingTeamData.byYear || {}
    const existingYearData = existingByYear[year] || {}
    updates.teams = {
      ...existingTeams,
      [tid]: {
        ...existingTeamData,
        byYear: { ...existingByYear, [year]: { ...existingYearData, recruitingClassRank: rank } },
      },
    }
  }

  return { updates, year }
}
