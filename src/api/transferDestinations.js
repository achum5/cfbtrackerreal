// Pure mutation builder for the Transfer Destinations save (Signing Day).
//
// Extracted verbatim from Dashboard.jsx's handleTransferDestinationsSave as the
// first step of moving every write out of components and behind one boundary
// (zengm's worker/api: the UI calls a typed function, it never assembles a
// write itself). This function takes the dynasty and the parsed sheet rows and
// returns the exact `updates` object the handler used to pass to
// updateDynasty, plus the rows it could not apply. The component keeps only
// the I/O: await updateDynasty(...), then toast.
//
// Behavior is pinned by __tests__/transferDestinations.test.js. Change the
// tests deliberately when changing behavior; do not let them drift.

import { getCurrentTeamTid, getCurrentTeamAbbr, getTidFromAbbr } from '../data/teamRegistry'
import { getPlayerClassForYear, CLASS_PROGRESSION } from '../context/DynastyContext'

const looseKey = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * @param {object} dynasty
 * @param {Array<{playerName:string, newTeam?:string, newTeamTid?:number|null}>} destinations
 * @returns {{ updates: object, skippedRows: string[], year: number }}
 */
export function buildTransferDestinationsSave(dynasty, destinations) {
  // On Signing Day (week 6) or later, the year has already flipped, so use previous year
  const isAfterYearFlip = dynasty.currentPhase === 'offseason' && dynasty.currentWeek >= 6
  const year = isAfterYearFlip ? dynasty.currentYear - 1 : dynasty.currentYear
  const nextYear = year + 1
  const teamTid = getCurrentTeamTid(dynasty)
  const teamAbbr = getCurrentTeamAbbr(dynasty) || dynasty.teamName
  const existingByTeamYear = dynasty.transferDestinationsByTeamYear || {}

  const updatedPlayers = [...(dynasty.players || [])]
  const skippedRows = []

  for (const dest of destinations || []) {
    let playerIndex = updatedPlayers.findIndex(p =>
      p.name?.toLowerCase().trim() === dest.playerName?.toLowerCase().trim()
    )
    if (playerIndex === -1 && dest.playerName) {
      const matches = updatedPlayers
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => looseKey(p.name) === looseKey(dest.playerName))
      if (matches.length === 1) playerIndex = matches[0].i
    }
    if (playerIndex === -1) {
      if (dest.playerName) skippedRows.push(dest.playerName + ' (no matching player on the roster)')
      continue
    }
    if (!dest.newTeam) continue

    const player = updatedPlayers[playerIndex]
    let oldTeamTid = player.team
    if (typeof oldTeamTid === 'string') {
      oldTeamTid = getTidFromAbbr(oldTeamTid, dynasty) || teamTid
    }
    if (!oldTeamTid) oldTeamTid = teamTid

    let newTeamTid = dest.newTeamTid ?? dest.newTeam
    if (typeof newTeamTid === 'string') {
      newTeamTid = getTidFromAbbr(newTeamTid, dynasty)
    }
    if (newTeamTid == null) {
      skippedRows.push(dest.playerName + ' (could not match team "' + dest.newTeam + '")')
      continue
    }

    const isRecommit = newTeamTid === oldTeamTid || newTeamTid === teamTid

    const priorClass = getPlayerClassForYear(player, Number(year)) || player.year
    const advancedClass = CLASS_PROGRESSION[priorClass] || priorClass
    const carriedOverall = player.overallByYear?.[String(year)] ?? player.overallByYear?.[Number(year)] ?? player.overall
    const carriedDev = player.devTraitByYear?.[String(year)] ?? player.devTraitByYear?.[Number(year)] ?? player.devTrait
    const advanceByYear = {
      ...(advancedClass ? { classByYear: { ...(player.classByYear || {}), [String(nextYear)]: advancedClass } } : {}),
      ...(carriedOverall != null ? { overallByYear: { ...(player.overallByYear || {}), [String(nextYear)]: carriedOverall } } : {}),
      ...(carriedDev ? { devTraitByYear: { ...(player.devTraitByYear || {}), [String(nextYear)]: carriedDev } } : {}),
    }

    if (isRecommit) {
      const updatedMovementByYear = { ...(player.movementByYear || {}) }
      updatedMovementByYear[Number(year)] = { type: 'recommit' }
      updatedPlayers[playerIndex] = {
        ...player,
        movementByYear: updatedMovementByYear,
        teamsByYear: { ...(player.teamsByYear || {}), [String(nextYear)]: oldTeamTid },
        ...advanceByYear,
      }
    } else {
      updatedPlayers[playerIndex] = {
        ...player,
        team: newTeamTid,
        movementByYear: {
          ...(player.movementByYear || {}),
          [Number(year)]: { type: 'departure', departure: 'transfer_out', toTid: newTeamTid },
        },
        teamsByYear: { ...(player.teamsByYear || {}), [String(nextYear)]: newTeamTid },
        ...advanceByYear,
      }
    }
  }

  const tid = getTidFromAbbr(teamAbbr, dynasty)

  const updates = {
    transferDestinationsByTeamYear: {
      ...existingByTeamYear,
      [teamAbbr]: { ...(existingByTeamYear[teamAbbr] || {}), [year]: destinations },
      ...(tid ? { [tid]: { ...(existingByTeamYear[tid] || {}), [year]: destinations } } : {}),
    },
    players: updatedPlayers,
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
        byYear: { ...existingByYear, [year]: { ...existingYearData, transferDestinations: destinations } },
      },
    }
  }

  return { updates, skippedRows, year }
}
