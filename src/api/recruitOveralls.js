// Pure mutation builders for Recruit Overalls (Signing Day) — the
// overall/jersey sheet and the full-attribute (CFB 27) import. Extracted
// verbatim from Dashboard.jsx; pinned by __tests__/recruitOveralls.test.js.

import { normalizePlayerName, findRowPlayerIndex, withRowPid } from '../utils/playerMatching'

const nameEq = (a, b) => normalizePlayerName(a) === normalizePlayerName(b)

const recruitYears = (dynasty) => {
  const isAfterYearFlip = dynasty.currentPhase === 'offseason' && dynasty.currentWeek >= 6
  const year = isAfterYearFlip ? dynasty.currentYear - 1 : dynasty.currentYear
  // Recruits join in the year AFTER recruitment (freshman year)
  const freshmanYear = isAfterYearFlip ? dynasty.currentYear : year + 1
  return { year, freshmanYear }
}

export function buildRecruitOverallsSave(dynasty, results) {
  const { year, freshmanYear } = recruitYears(dynasty)
  const updatedPlayers = [...(dynasty.players || [])]
  let updatedCount = 0
  const isThisCyclesRecruit = (p) => p.isRecruit && p.recruitYear === year
  const rows = results || []
  const storedRows = [...rows]

  for (let i = 0; i < rows.length; i++) {
    const result = rows[i]
    const playerIndex = findRowPlayerIndex(updatedPlayers, result, { nameEq, predicate: isThisCyclesRecruit })
    if (playerIndex === -1) continue
    storedRows[i] = withRowPid(result, updatedPlayers[playerIndex])
    // Archetype rides the same row: it is on the depth-chart player card the
    // user is already reading the overall off, and a signing-day correction is
    // the last chance to fix one the recruiting board got wrong.
    if (!result.overall && !result.archetype) continue
    const existingOverallByYear = updatedPlayers[playerIndex].overallByYear || {}
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      ...(result.overall
        ? {
            overall: result.overall,
            overallByYear: { ...existingOverallByYear, [freshmanYear]: result.overall },
          }
        : {}),
      ...(result.jerseyNumber && { jerseyNumber: result.jerseyNumber }),
      ...(result.archetype ? { archetype: result.archetype } : {}),
    }
    updatedCount++
  }

  const existingResults = dynasty.recruitOverallsByYear || {}
  return {
    updates: {
      players: updatedPlayers,
      recruitOverallsByYear: { ...existingResults, [year]: storedRows },
    },
    updatedCount,
    year,
  }
}

export function buildRecruitOverallsAttributesSave(dynasty, entries) {
  const { year, freshmanYear } = recruitYears(dynasty)
  const updatedPlayers = [...(dynasty.players || [])]
  const isThisCyclesRecruit = (p) => p.isRecruit && p.recruitYear === year
  // recruitOverallsByYear is the ledger the Signing Day to-do reads to decide
  // whether Incoming Freshmen Overalls is done. The overall-only path writes
  // it; this one did not, so entering the class through Full Attributes
  // updated every recruit and still left the task sitting there red.
  const storedRows = []
  for (const entry of entries || []) {
    const playerIndex = findRowPlayerIndex(updatedPlayers, entry, { nameEq, predicate: isThisCyclesRecruit })
    if (playerIndex === -1) continue
    const player = updatedPlayers[playerIndex]
    const hasAttrs = entry.attributes && Object.keys(entry.attributes).length > 0
    if (entry.overall == null && !hasAttrs) continue
    const next = { ...player }
    if (entry.overall != null) {
      next.overall = entry.overall
      next.overallByYear = { ...(player.overallByYear || {}), [freshmanYear]: entry.overall }
    }
    if (hasAttrs) {
      const existingAttrs = player.attributesByYear?.[freshmanYear] || player.attributesByYear?.[String(freshmanYear)] || {}
      next.attributesByYear = { ...(player.attributesByYear || {}), [freshmanYear]: { ...existingAttrs, ...entry.attributes } }
    }
    updatedPlayers[playerIndex] = next
    // The ratings themselves stay on the player — copying a full set per
    // recruit into the season doc is the bloat the per-season subcollection
    // exists to avoid — so the ledger row keeps only what identifies it.
    storedRows.push(withRowPid({
      playerName: entry.playerName ?? entry.name ?? player.name,
      position: entry.position ?? player.position ?? '',
      overall: entry.overall ?? null,
    }, player))
  }
  const updates = { players: updatedPlayers }
  // An import that matched nobody leaves the ledger alone: writing [] would
  // un-complete a task the user had already finished the other way.
  if (storedRows.length > 0) {
    updates.recruitOverallsByYear = { ...(dynasty.recruitOverallsByYear || {}), [year]: storedRows }
  }
  return { updates, year }
}
