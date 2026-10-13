// Pure mutation builders for the two Signing Day class-assignment saves
// (Portal Transfer Class, Fringe Case Class). Extracted verbatim from
// Dashboard.jsx so the component only does I/O. See transferDestinations.js
// for the rationale; behavior is pinned by __tests__/classAssignments.test.js.

import { getUserTeamTid } from '../data/teamRegistry'
import {
  isPlayerOnRoster,
  getPlayerClassForYear,
  getPlayersLeaving,
  hasRecommitForYear,
  hasUnresolvedDeparture,
} from '../context/DynastyContext'
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

// ─── Fringe Case Class ─────────────────────────────────────────────────────
//
// Who the step is about: the team's players from the season just played who
// are COMING BACK, were a non-redshirted underclassman (Fr / So / Jr) that
// season, and played 5–9 games — the band where the game may or may not have
// spent their redshirt. One definition for the Dashboard row's count, the
// modal's grid and the save, so the three can't disagree.
//
// "Coming back" uses the year flip's own leaving rule (the Players Leaving
// list, then any unresolved departure in the movement records; a recommit
// always stays), and once the flip has run, a season on next year's roster.
// The list used to take anyone on last season's roster: players who'd left
// through the portal or graduated showed up as juniors with "Sr" pre-filled,
// and saving stamped a new-season class onto them.

const FRINGE_CLASSES = new Set(['Fr', 'So', 'Jr'])

/** On `tid`'s roster in `year` and not leaving it for `year + 1`. */
export function isReturningRosterPlayer(dynasty, player, tid, year) {
  if (!player || player.isHonorOnly || tid == null) return false
  if (!isPlayerOnRoster(player, tid, year, dynasty)) return false
  const y = Number(year)
  if (!hasRecommitForYear(player, y)) {
    const leaving = getPlayersLeaving(dynasty, tid, y) || []
    if (leaving.some(l => l?.pid != null && String(l.pid) === String(player.pid))) return false
    if (leaving.some(l => l?.pid == null && l?.name && nameEq(l.name, player.name))) return false
    if (hasUnresolvedDeparture(player, tid, y, dynasty)) return false
  }
  const next = player.teamsByYear?.[y + 1] ?? player.teamsByYear?.[String(y + 1)]
  if (next != null && next !== '' && Number(next) !== Number(tid)) return false
  // After the flip, next season's roster is the record of who came back.
  const flipped = Number(dynasty?.currentYear) > y
  if (flipped && (next == null || next === '')) return false
  return true
}

/** The player's class DURING `year` — never the current-class mirror after the flip. */
function seasonClass(dynasty, player, year) {
  const resolved = getPlayerClassForYear(player, year)
  if (resolved) return resolved
  // Before the flip the mirror is still this season's class; after it, it's
  // next season's, so it can't stand in.
  return Number(dynasty?.currentYear) === Number(year) ? (player.year || null) : null
}

/**
 * The fringe cases for `tid`'s `year` season, shaped for the modal:
 * { pid, name, position, currentClass, gameCount }.
 */
export function getFringeCasePlayers(dynasty, tid, year) {
  const out = []
  for (const player of dynasty?.players || []) {
    if (!isReturningRosterPlayer(dynasty, player, tid, year)) continue
    const currentClass = seasonClass(dynasty, player, year)
    if (!FRINGE_CLASSES.has(currentClass)) continue
    const stats = player.statsByYear?.[year] ?? player.statsByYear?.[String(year)]
    const gamesPlayed = Number(stats?.gamesPlayed) || 0
    if (gamesPlayed < 5 || gamesPlayed > 9) continue
    out.push({ pid: player.pid, name: player.name, position: player.position, currentClass, gameCount: gamesPlayed })
  }
  return out
}

/**
 * Fringe Case Class save: stamps each row's class for the joining year on the
 * matching player — only a returning player from the user's roster that
 * season, so a pasted row can't land on a departed player or a same-named
 * player on another team. Unmatched rows are still stored, just not applied.
 * @returns {{ updates: object, updatedCount: number, year: number }}
 */
export function buildFringeCaseClassSave(dynasty, classSelections) {
  const { year, joiningYear } = signingYears(dynasty)
  const userTid = getUserTeamTid(dynasty)
  const updatedPlayers = [...(dynasty.players || [])]
  let updatedCount = 0
  const rows = classSelections || []
  const storedRows = [...rows]
  const predicate = (p) => isReturningRosterPlayer(dynasty, p, userTid, year)

  for (let i = 0; i < rows.length; i++) {
    const selection = rows[i]
    const playerIndex = findRowPlayerIndex(updatedPlayers, selection, { nameEq, predicate })
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
