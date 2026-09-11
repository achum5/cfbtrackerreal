// Pure mutation builders for Training Results (offseason week 7) — the
// overall-only sheet and the full-attribute (CFB 27) import. Extracted
// verbatim from Dashboard.jsx; pinned by __tests__/trainingResults.test.js.

import { getUserTeamTid } from '../data/teamRegistry'
import { normalizePlayerName, findRowPlayerIndex, withRowPid } from '../utils/playerMatching'

const nameEq = (a, b) => normalizePlayerName(a) === normalizePlayerName(b)

export function buildTrainingResultsSave(dynasty, results) {
  const year = dynasty.currentYear
  const prevYear = year - 1
  const updatedPlayers = [...(dynasty.players || [])]
  let updatedCount = 0
  const rows = results || []
  const storedRows = [...rows]

  for (let i = 0; i < rows.length; i++) {
    const result = rows[i]
    const playerIndex = findRowPlayerIndex(updatedPlayers, result, { nameEq })
    if (playerIndex === -1) continue
    storedRows[i] = withRowPid(result, updatedPlayers[playerIndex])
    const hasJersey = result.jerseyNumber != null && result.jerseyNumber !== ''
    const hasDevTrait = !!result.devTrait
    if (!result.newOverall && result.pastOverall == null && !hasJersey && !hasDevTrait) continue

    const player = updatedPlayers[playerIndex]
    const nextOverallByYear = { ...(player.overallByYear || {}) }
    if (result.newOverall) nextOverallByYear[year] = result.newOverall
    // Back-fill the prior year only when empty — fills the gap for a portal
    // arrival whose old-team OVR was never recorded here, never overwrites.
    if (
      result.pastOverall != null &&
      nextOverallByYear[prevYear] == null &&
      nextOverallByYear[String(prevYear)] == null
    ) {
      nextOverallByYear[prevYear] = result.pastOverall
    }

    // Jersey # and dev trait ride along on the same row — both are read off
    // the player card beside the training screen, so collecting them here
    // saves a second pass over the roster. Dev trait mirrors how overall is
    // stored: the flat field is "current", devTraitByYear is the record, and
    // the per-year readers fall back to the flat one.
    updatedPlayers[playerIndex] = {
      ...player,
      ...(result.newOverall ? { overall: result.newOverall } : {}),
      overallByYear: nextOverallByYear,
      ...(hasJersey ? { jerseyNumber: String(result.jerseyNumber) } : {}),
      ...(hasDevTrait
        ? {
            devTrait: result.devTrait,
            devTraitByYear: { ...(player.devTraitByYear || {}), [year]: result.devTrait },
          }
        : {}),
    }
    updatedCount++
  }

  const existingResults = dynasty.trainingResultsByYear || {}
  const userTid = getUserTeamTid(dynasty)
  const updates = {
    players: updatedPlayers,
    trainingResultsByYear: { ...existingResults, [year]: storedRows },
  }
  if (userTid && dynasty.teams) {
    const existingTeams = dynasty.teams
    const existingTeamData = existingTeams[userTid] || {}
    const existingByYear = existingTeamData.byYear || {}
    const existingYearData = existingByYear[year] || {}
    updates.teams = {
      ...existingTeams,
      [userTid]: {
        ...existingTeamData,
        byYear: { ...existingByYear, [year]: { ...existingYearData, trainingResults: storedRows } },
      },
    }
  }
  return { updates, updatedCount, year }
}

export function buildTrainingResultsAttributesSave(dynasty, entries) {
  const year = dynasty.currentYear
  const updatedPlayers = [...(dynasty.players || [])]
  // Same ledger the overall-only path writes, and the same reason: the week-7
  // to-do reads trainingResultsByYear to decide whether Training Results is
  // done, so without it a Full Attributes import left the task red.
  const storedRows = []
  for (const entry of entries || []) {
    const playerIndex = findRowPlayerIndex(updatedPlayers, entry, { nameEq })
    if (playerIndex === -1) continue
    const player = updatedPlayers[playerIndex]
    const hasAttrs = entry.attributes && Object.keys(entry.attributes).length > 0
    if (entry.overall == null && !hasAttrs) continue
    const next = { ...player }
    if (entry.overall != null) {
      next.overall = entry.overall
      next.overallByYear = { ...(player.overallByYear || {}), [year]: entry.overall }
    }
    if (hasAttrs) {
      const existingAttrs = player.attributesByYear?.[year] || player.attributesByYear?.[String(year)] || {}
      next.attributesByYear = { ...(player.attributesByYear || {}), [year]: { ...existingAttrs, ...entry.attributes } }
    }
    updatedPlayers[playerIndex] = next
    // Ratings stay on the player; the ledger row keeps only identity + the new
    // overall, under the same key name the sheet path stores.
    storedRows.push(withRowPid({
      playerName: entry.playerName ?? entry.name ?? player.name,
      position: entry.position ?? player.position ?? '',
      newOverall: entry.overall ?? null,
    }, player))
  }
  const updates = { players: updatedPlayers }
  // An import that matched nobody leaves the ledger alone: writing [] would
  // un-complete a task the user had already finished the other way. Both
  // copies move together — getTrainingResults reads the team-year mirror
  // FIRST, so writing one without the other would serve a stale list.
  if (storedRows.length > 0) {
    updates.trainingResultsByYear = { ...(dynasty.trainingResultsByYear || {}), [year]: storedRows }
    const userTid = getUserTeamTid(dynasty)
    if (userTid && dynasty.teams) {
      const existingTeams = dynasty.teams
      const existingTeamData = existingTeams[userTid] || {}
      const existingByYear = existingTeamData.byYear || {}
      const existingYearData = existingByYear[year] || {}
      updates.teams = {
        ...existingTeams,
        [userTid]: {
          ...existingTeamData,
          byYear: { ...existingByYear, [year]: { ...existingYearData, trainingResults: storedRows } },
        },
      }
    }
  }
  return { updates, year }
}
