// Pure mutation builders for Training Results (offseason week 7) — the
// overall-only sheet and the full-attribute (CFB 27) import. Extracted
// verbatim from Dashboard.jsx; pinned by __tests__/trainingResults.test.js.

import { getUserTeamTid } from '../data/teamRegistry'
import { setPlayerNil } from '../data/playerNilModel'
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
    const card = cardFields(result)
    if (!result.newOverall && result.pastOverall == null && !card.any) continue

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

    // The four player-card fields go through the same helpers the
    // full-attribute path uses, so the two entry routes write them identically.
    const next = applyCardFields({
      ...player,
      ...(result.newOverall ? { overall: result.newOverall } : {}),
      overallByYear: nextOverallByYear,
    }, card, year)
    updatedPlayers[playerIndex] = card.nil != null ? setPlayerNil(next, year, card.nil) : next
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

/**
 * The four fields that come off the in-game player card, shared by the
 * overall-only and full-attribute paths so both write them identically.
 * A null means "not captured" and leaves the player's existing value alone.
 */
export function cardFields(row) {
  const jerseyNumber = row?.jerseyNumber != null && row.jerseyNumber !== '' ? row.jerseyNumber : null
  const devTrait = row?.devTrait || null
  const archetype = row?.archetype || null
  const nil = row?.nil != null && row.nil !== '' ? row.nil : null
  return {
    jerseyNumber, devTrait, archetype, nil,
    any: jerseyNumber != null || !!devTrait || !!archetype || nil != null,
  }
}

/** Mutate `next` (already a copy) with whatever the card supplied. */
export function applyCardFields(next, card, year) {
  if (card.jerseyNumber != null) next.jerseyNumber = String(card.jerseyNumber)
  if (card.devTrait) {
    next.devTrait = card.devTrait
    next.devTraitByYear = { ...(next.devTraitByYear || {}), [year]: card.devTrait }
  }
  if (card.archetype) next.archetype = card.archetype
  return next
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
    const card = cardFields(entry)
    if (entry.overall == null && !hasAttrs && !card.any) continue
    const next = { ...player }
    if (entry.overall != null) {
      next.overall = entry.overall
      next.overallByYear = { ...(player.overallByYear || {}), [year]: entry.overall }
    }
    // Past OVR (the overall before the "+N") back-fills the prior year only
    // when empty — same rule as the overall-only path: fills a portal
    // arrival's old-team overall, never overwrites a recorded one.
    const prevYear = year - 1
    const past = Number(entry.pastOverall)
    if (Number.isFinite(past) && entry.pastOverall != null && entry.pastOverall !== '') {
      const oby = next.overallByYear || player.overallByYear || {}
      if (oby[prevYear] == null && oby[String(prevYear)] == null) {
        next.overallByYear = { ...oby, [prevYear]: past }
      }
    }
    if (hasAttrs) {
      const existingAttrs = player.attributesByYear?.[year] || player.attributesByYear?.[String(year)] || {}
      next.attributesByYear = { ...(player.attributesByYear || {}), [year]: { ...existingAttrs, ...entry.attributes } }
    }
    applyCardFields(next, card, year)
    updatedPlayers[playerIndex] = card.nil != null ? setPlayerNil(next, year, card.nil) : next
    // Ratings stay on the player; the ledger row keeps only identity + the new
    // overall, under the same key name the sheet path stores.
    storedRows.push(withRowPid({
      playerName: entry.playerName ?? entry.name ?? player.name,
      position: entry.position ?? player.position ?? '',
      newOverall: entry.overall ?? null,
      ...(Number.isFinite(past) && entry.pastOverall != null && entry.pastOverall !== '' ? { pastOverall: past } : {}),
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
