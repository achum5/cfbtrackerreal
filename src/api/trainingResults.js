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
    if (!result.newOverall && result.pastOverall == null) continue

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

    updatedPlayers[playerIndex] = {
      ...player,
      ...(result.newOverall ? { overall: result.newOverall } : {}),
      overallByYear: nextOverallByYear,
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
  }
  return { updates: { players: updatedPlayers }, year }
}
