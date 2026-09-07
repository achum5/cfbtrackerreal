// Pure mutation builder for the Draft Results save (offseason, recruiting
// week 1). Extracted verbatim from Dashboard.jsx; behavior pinned by
// __tests__/draftResults.test.js. See transferDestinations.js for rationale.

import { getCurrentTeamAbbr, getTidFromAbbr } from '../data/teamRegistry'

/**
 * @param {object} dynasty
 * @param {Array<{playerName:string, position?:string, overall?:number, draftRound?:string}>} draftResults
 * @returns {{ updates: object, year: number }}
 */
export function buildDraftResultsSave(dynasty, draftResults) {
  const year = dynasty.currentYear
  const teamAbbr = getCurrentTeamAbbr(dynasty) || dynasty.teamName
  const existingByTeamYear = dynasty.draftResultsByTeamYear || {}
  const tid = getTidFromAbbr(teamAbbr, dynasty)

  // Exact-name match here is the original behavior (kept: the sheet is
  // pre-filled from roster names, so mismatches are rare and a loose match
  // risks stamping a draft on a same-named teammate).
  const resultsWithPids = (draftResults || []).map(entry => {
    const player = dynasty.players?.find(p => p.name === entry.playerName)
    return {
      playerName: entry.playerName,
      pid: player?.pid || null,
      position: entry.position,
      overall: entry.overall,
      draftRound: entry.draftRound,
    }
  })

  const updatedPlayers = [...(dynasty.players || [])]
  for (const entry of draftResults || []) {
    const playerIndex = updatedPlayers.findIndex(p =>
      p.name?.toLowerCase().trim() === entry.playerName?.toLowerCase().trim()
    )
    if (playerIndex === -1) continue
    const player = updatedPlayers[playerIndex]
    updatedPlayers[playerIndex] = {
      ...player,
      draftYear: year,
      draftRound: entry.draftRound,
      movementByYear: {
        ...(player.movementByYear || {}),
        [year]: { type: 'departure', departure: 'pro_draft', draftRound: entry.draftRound || null },
      },
    }
  }

  const updates = {
    players: updatedPlayers,
    draftResultsByTeamYear: {
      ...existingByTeamYear,
      [teamAbbr]: { ...(existingByTeamYear[teamAbbr] || {}), [year]: resultsWithPids },
      ...(tid ? { [tid]: { ...(existingByTeamYear[tid] || {}), [year]: resultsWithPids } } : {}),
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
        byYear: { ...existingByYear, [year]: { ...existingYearData, draftResults: resultsWithPids } },
      },
    }
  }

  return { updates, year }
}
