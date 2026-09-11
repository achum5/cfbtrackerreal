// Pure mutation builders for the two Signing Day class-assignment saves
// (Portal Transfer Class, Fringe Case Class). Extracted verbatim from
// Dashboard.jsx so the component only does I/O. See transferDestinations.js
// for the rationale; behavior is pinned by __tests__/classAssignments.test.js.

import { getUserTeamTid } from '../data/teamRegistry'
import { normalizePlayerName, findRowPlayerIndex, withRowPid } from '../utils/playerMatching'
import { getPortalTransferClassOptions, isKnownTransferClass } from '../utils/transferClassOptions'

const nameEq = (a, b) => normalizePlayerName(a) === normalizePlayerName(b)

const signingYears = (dynasty) => {
  const isAfterYearFlip = dynasty.currentPhase === 'offseason' && dynasty.currentWeek >= 6
  const year = isAfterYearFlip ? dynasty.currentYear - 1 : dynasty.currentYear
  const joiningYear = isAfterYearFlip ? dynasty.currentYear : year + 1
  return { year, joiningYear }
}

const withTeamYearPatch = (dynasty, updates, year, field, value) => {
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
        byYear: { ...existingByYear, [year]: { ...existingYearData, [field]: value } },
      },
    }
  }
  return updates
}

/**
 * Portal Transfer Class: matches portal recruits of this class year by name
 * and stamps their class (and optional jersey number) for the joining year.
 * @returns {{ updates: object, updatedCount: number, year: number }}
 */
export function buildPortalTransferClassSave(dynasty, classSelections) {
  const { year, joiningYear } = signingYears(dynasty)
  const updatedPlayers = [...(dynasty.players || [])]
  let updatedCount = 0
  const isThisCyclesPortal = (p) => p.isPortal && p.recruitYear === year
  const rows = classSelections || []
  const storedRows = [...rows]

  for (let i = 0; i < rows.length; i++) {
    const selection = rows[i]
    const playerIndex = findRowPlayerIndex(updatedPlayers, selection, { nameEq, predicate: isThisCyclesPortal })
    if (playerIndex === -1) continue
    storedRows[i] = withRowPid(selection, updatedPlayers[playerIndex])
    if (!selection.selectedClass) continue
    const player = updatedPlayers[playerIndex]
    // The answer must be one this transfer could actually give. An AI paste
    // that echoed the incoming class back ("Fr" for a Fr transfer) would
    // otherwise be stamped as next season's class and freeze them a year
    // behind — the dropdown never allows it, so neither does the save.
    const incomingClass = player.classByYear?.[year] ?? player.classByYear?.[String(year)] ?? player.year
    if (isKnownTransferClass(incomingClass) &&
        !getPortalTransferClassOptions(incomingClass).includes(selection.selectedClass)) continue
    const existingClassByYear = player.classByYear || {}
    const next = {
      ...player,
      year: selection.selectedClass,
      classByYear: { ...existingClassByYear, [joiningYear]: selection.selectedClass },
    }
    const j = selection.jerseyNumber
    if (j != null && j !== '' && Number.isFinite(Number(j))) {
      next.jerseyNumber = String(Number(j))
    }
    updatedPlayers[playerIndex] = next
    updatedCount++
  }

  const existingSelections = dynasty.portalTransferClassByYear || {}
  const updates = {
    players: updatedPlayers,
    portalTransferClassByYear: { ...existingSelections, [year]: storedRows },
    [`portalTransferClassSheetId_${year}`]: null,
  }
  withTeamYearPatch(dynasty, updates, year, 'portalTransferClass', storedRows)
  return { updates, updatedCount, year }
}

/**
 * Fringe Case Class: matches ANY player by name and stamps the class for the
 * joining year. (Deliberately not restricted to recruits — that is the
 * existing behavior.)
 * @returns {{ updates: object, updatedCount: number, year: number }}
 */
export function buildFringeCaseClassSave(dynasty, classSelections) {
  const { year, joiningYear } = signingYears(dynasty)
  const updatedPlayers = [...(dynasty.players || [])]
  let updatedCount = 0
  const rows = classSelections || []
  const storedRows = [...rows]

  for (let i = 0; i < rows.length; i++) {
    const selection = rows[i]
    const playerIndex = findRowPlayerIndex(updatedPlayers, selection, { nameEq })
    if (playerIndex === -1) continue
    storedRows[i] = withRowPid(selection, updatedPlayers[playerIndex])
    if (!selection.selectedClass) continue
    const existingClassByYear = updatedPlayers[playerIndex].classByYear || {}
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      year: selection.selectedClass,
      classByYear: { ...existingClassByYear, [joiningYear]: selection.selectedClass },
    }
    updatedCount++
  }

  const existingSelections = dynasty.fringeCaseClassByYear || {}
  const updates = {
    players: updatedPlayers,
    fringeCaseClassByYear: { ...existingSelections, [year]: storedRows },
    fringeCaseClassSheetId: null,
  }
  withTeamYearPatch(dynasty, updates, year, 'fringeCaseClass', storedRows)
  return { updates, updatedCount, year }
}
