// Pure mutation builder for the Players Leaving save (offseason week 1).
// Extracted verbatim from Dashboard.jsx's handlePlayersLeavingSave; the
// component keeps only the I/O (updateDynasty + toast). See
// transferDestinations.js for the rationale. Behavior is pinned by
// __tests__/playersLeaving.test.js.

import { getCurrentTeamTid, getCurrentTeamAbbr, getTidFromAbbr } from '../data/teamRegistry'
import { normalizeLeavingReason } from '../utils/leavingReason'
import { findRosterPlayerByName } from '../utils/playerMatching'

/**
 * @param {object} dynasty
 * @param {Array<{playerName:string, reason:string}>} playersLeaving
 * @returns {{ updates: object, unmatchedRows: string[], year: number }}
 */
export function buildPlayersLeavingSave(dynasty, playersLeaving) {
  const year = dynasty.currentYear

  const unmatchedRows = []
  const playersWithPids = (playersLeaving || []).map(entry => {
    const player = findRosterPlayerByName(dynasty.players, entry.playerName)
    if (!player && entry.playerName) unmatchedRows.push(entry.playerName)
    return {
      playerName: entry.playerName,
      pid: player?.pid || null,
      reason: normalizeLeavingReason(entry.reason),
    }
  })

  const leavingPids = new Set(playersWithPids.map(p => p.pid).filter(Boolean))
  const reasonByPid = {}
  for (const p of playersWithPids) if (p.pid) reasonByPid[p.pid] = p.reason

  const teamTid = getCurrentTeamTid(dynasty)
  const teamAbbr = getCurrentTeamAbbr(dynasty) || dynasty.teamName

  const previousLeavingPids = new Set(
    (dynasty.playersLeavingByYear?.[year] || []).map(p => p.pid).filter(Boolean)
  )

  const updatedPlayers = (dynasty.players || []).map(player => {
    if (leavingPids.has(player.pid)) {
      const reason = reasonByPid[player.pid] || 'Unknown'
      // Every reason other than Graduating / Pro Draft means "entered the
      // portal", destination unknown until Transfer Destinations fills it in.
      const movementByYearEntry = reason === 'Pro Draft'
        ? { type: 'departure', departure: 'pro_draft' }
        : reason === 'Graduating'
          ? { type: 'departure', departure: 'graduated' }
          : { type: 'departure', departure: 'transfer_out', toTid: null, reason }

      // Preserve a more specific recorded outcome (drafted / graduated) —
      // re-saving the sheet must not knock a drafted player back into the
      // portal.
      const existingMovement = player.movementByYear?.[Number(year)] ?? player.movementByYear?.[String(year)]
      const isMoreSpecific = existingMovement
        && existingMovement.type === 'departure'
        && (existingMovement.departure === 'pro_draft' || existingMovement.departure === 'graduated')
      const isWritingGenericTransferOut = movementByYearEntry.departure === 'transfer_out' && movementByYearEntry.toTid == null
      if (isMoreSpecific && isWritingGenericTransferOut) return player

      return {
        ...player,
        movementByYear: { ...(player.movementByYear || {}), [Number(year)]: movementByYearEntry },
      }
    }
    if (previousLeavingPids.has(player.pid)) {
      // Previously marked leaving this year, not any more: clear the entry.
      const updatedMovementByYear = { ...(player.movementByYear || {}) }
      delete updatedMovementByYear[Number(year)]
      delete updatedMovementByYear[String(year)]
      return { ...player, movementByYear: updatedMovementByYear }
    }
    return player
  })

  const existingByTeamYear = dynasty.playersLeavingByTeamYear || {}
  const existingByYear = dynasty.playersLeavingByYear || {}
  const tid = getTidFromAbbr(teamAbbr, dynasty)

  const updates = {
    playersLeavingByYear: { ...existingByYear, [year]: playersWithPids },
    playersLeavingByTeamYear: {
      ...existingByTeamYear,
      [teamAbbr]: { ...(existingByTeamYear[teamAbbr] || {}), [year]: playersWithPids },
      ...(tid ? { [tid]: { ...(existingByTeamYear[tid] || {}), [year]: playersWithPids } } : {}),
    },
    players: updatedPlayers,
  }

  if (tid && dynasty.teams) {
    const existingTeams = dynasty.teams
    const existingTeamData = existingTeams[tid] || {}
    const existingTeamByYear = existingTeamData.byYear || {}
    const existingYearData = existingTeamByYear[year] || {}
    updates.teams = {
      ...existingTeams,
      [tid]: {
        ...existingTeamData,
        byYear: { ...existingTeamByYear, [year]: { ...existingYearData, playersLeaving: playersWithPids } },
      },
    }
  }

  // teamTid is resolved for parity with the original handler (it was only
  // used to fall back an abbr-typed player.team, which the movement write no
  // longer needs). Kept out of the return to avoid implying it matters.
  void teamTid
  return { updates, unmatchedRows, year }
}
