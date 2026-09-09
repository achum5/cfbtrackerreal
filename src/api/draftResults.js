// Pure mutation builder for the Draft Results save (offseason, recruiting
// week 1). Extracted verbatim from Dashboard.jsx; behavior pinned by
// __tests__/draftResults.test.js. See transferDestinations.js for rationale.

import { getCurrentTeamAbbr, getTidFromAbbr } from '../data/teamRegistry'
import { findRowPlayerIndex } from '../utils/playerMatching'

const lower = (s) => s?.toLowerCase().trim()
const nameEq = (a, b) => lower(a) === lower(b)

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

  // One resolution per row (case-insensitive name, then the row's pid — see
  // findRowPlayerIndex). The stored row's pid is the player this save
  // actually updated, so later readers (advanceToNewSeason's draft info)
  // never have to re-match by name. Previously the stored pid used an
  // EXACT-case name match while the player update used a case-insensitive
  // one, so a row like "star qb" updated the player but stored pid: null.
  const players = dynasty.players || []
  const rows = draftResults || []
  const resolvedIdx = rows.map(entry => findRowPlayerIndex(players, entry, { nameEq }))
  const resultsWithPids = rows.map((entry, i) => {
    const player = resolvedIdx[i] >= 0 ? players[resolvedIdx[i]] : null
    return {
      playerName: entry.playerName,
      pid: player?.pid ?? null,
      position: entry.position,
      overall: entry.overall,
      draftRound: entry.draftRound,
    }
  })

  const updatedPlayers = [...players]
  for (let i = 0; i < rows.length; i++) {
    const entry = rows[i]
    const playerIndex = resolvedIdx[i]
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
