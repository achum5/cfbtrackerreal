// Pure mutation builders for Recruit Overalls (Signing Day) — the
// overall/jersey sheet and the full-attribute (CFB 27) import. Extracted
// verbatim from Dashboard.jsx; pinned by __tests__/recruitOveralls.test.js.

import { normalizePlayerName } from '../utils/playerMatching'

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

  for (const result of results || []) {
    const playerIndex = updatedPlayers.findIndex(p =>
      p.isRecruit &&
      p.recruitYear === year &&
      normalizePlayerName(p.name) === normalizePlayerName(result.name)
    )
    if (playerIndex === -1 || !result.overall) continue
    const existingOverallByYear = updatedPlayers[playerIndex].overallByYear || {}
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      overall: result.overall,
      overallByYear: { ...existingOverallByYear, [freshmanYear]: result.overall },
      ...(result.jerseyNumber && { jerseyNumber: result.jerseyNumber }),
    }
    updatedCount++
  }

  const existingResults = dynasty.recruitOverallsByYear || {}
  return {
    updates: {
      players: updatedPlayers,
      recruitOverallsByYear: { ...existingResults, [year]: results },
    },
    updatedCount,
    year,
  }
}

export function buildRecruitOverallsAttributesSave(dynasty, entries) {
  const { year, freshmanYear } = recruitYears(dynasty)
  const updatedPlayers = [...(dynasty.players || [])]
  for (const entry of entries || []) {
    const playerIndex = updatedPlayers.findIndex(p =>
      p.isRecruit && p.recruitYear === year &&
      normalizePlayerName(p.name) === normalizePlayerName(entry.playerName)
    )
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
  }
  return { updates: { players: updatedPlayers }, year }
}
