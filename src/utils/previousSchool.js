// Previous school for a portal transfer — ONE place that decides how a
// "Prev Team" value from a sheet/grid row lands on the player record.
//
// Two fields carry it, and every save path used to pick a different one:
//   player.previousTeam              display mirror: a tid when the school
//                                    resolves, else the raw text (FCS, typo…)
//   player.movementByYear[classYear] the durable identity: an arrival with
//                                    { arrival: 'transfer_in', fromTid }
// The recruit card and the player timeline both read fromTid first, so a
// school that only ever reached `previousTeam` (as text) — or never reached
// the player record at all because the code path happened to skip it — is
// what made "I entered every transfer's previous school and they all still
// say Transfer Portal". Route every path through applyPreviousSchool.

import { resolveTid, getTidFromAbbr } from '../data/teamRegistry'

// Generic label older imports stored when no school was known. Never a
// school; never overwrites anything.
export const PORTAL_PLACEHOLDER = 'Transfer Portal'

const isPlaceholder = (v) => typeof v === 'string' && v.trim().toLowerCase() === PORTAL_PLACEHOLDER.toLowerCase()

/**
 * Resolve a Prev Team value (tid, abbr, label, or full name) to a tid, or null.
 * The team the recruit is JOINING is never a valid origin — a value that
 * resolves to it (the old Commitment-read-as-Prev-Team bug) reads as unknown.
 */
export function resolvePreviousSchoolTid(value, teams, { joiningTid = null } = {}) {
  if (value == null || value === '' || isPlaceholder(value)) return null
  let tid = null
  if (typeof value === 'number' && Number.isFinite(value)) tid = value
  else if (typeof value === 'string' && /^\d+$/.test(value.trim())) tid = Number(value.trim())
  else if (typeof value === 'string') {
    tid = resolveTid(value.trim(), teams) ?? getTidFromAbbr(value.trim(), teams)
  }
  if (tid == null || !Number.isFinite(Number(tid))) return null
  if (joiningTid != null && Number(tid) === Number(joiningTid)) return null
  return Number(tid)
}

/**
 * Write a row's previous school onto a player record.
 *
 *   • A REAL school in the row (resolves to a tid, or is non-placeholder text)
 *     always wins — this is the correction path when a user goes back and
 *     fills in the schools they skipped the first time.
 *   • A blank / placeholder row value keeps whatever the record already has.
 *   • The arrival movement for classYear gets fromTid when the school
 *     resolved. Only a missing entry or an existing ARRIVAL is written; a
 *     departure or recommit already recorded for that year (a hand-edited
 *     timeline, a returning player) is left exactly as it is.
 *   • The season BEFORE enrollment (classYear itself) is put on the origin
 *     school's roster when the player has no season that year or earlier —
 *     the timeline is the source of truth for where a player was, so a
 *     transfer "from Washington State" means a 2026 season at Washington
 *     State, exactly as if the user had added that row by hand.
 *
 * Pure; returns the next player object (the same object when nothing changes).
 */
export function applyPreviousSchool(player, { previousTeam, classYear, teams, joiningTid = null }) {
  if (!player) return player
  const yearNum = Number(classYear)
  const rowText = typeof previousTeam === 'string' ? previousTeam.trim() : previousTeam
  const rowHasSchool = rowText != null && rowText !== '' && !isPlaceholder(rowText)
  const tid = resolvePreviousSchoolTid(rowHasSchool ? rowText : player.previousTeam, teams, { joiningTid })

  let next = player
  if (rowHasSchool) {
    const stored = tid != null ? tid : rowText
    if (next.previousTeam !== stored) next = { ...next, previousTeam: stored }
  } else if (tid != null && next.previousTeam !== tid) {
    // Existing text that resolves — normalize the mirror to the tid so the
    // player page's "Portal from …" chip (which reads a tid) shows it too.
    next = { ...next, previousTeam: tid }
  }
  if (next.isPortal !== true) next = { ...next, isPortal: true }

  if (Number.isFinite(yearNum) && tid != null) {
    next = placeOriginSeason(next, yearNum, tid)
  }

  if (Number.isFinite(yearNum)) {
    const mby = next.movementByYear || {}
    const existing = mby[yearNum] ?? mby[String(yearNum)]
    if (!existing || existing.type === 'arrival') {
      const current = existing || null
      const wantFrom = tid ?? current?.fromTid ?? null
      if (!current || current.arrival !== 'transfer_in' || (current.fromTid ?? null) !== wantFrom) {
        const cleaned = { ...mby }
        delete cleaned[String(yearNum)]
        next = {
          ...next,
          movementByYear: { ...cleaned, [yearNum]: { ...(current || {}), type: 'arrival', arrival: 'transfer_in', fromTid: wantFrom } },
        }
      }
    }
  }
  return next
}

// Earliest season on the record (teamsByYear keys + stint starts), or null.
function firstSeasonYear(player) {
  const years = []
  for (const k of Object.keys(player?.teamsByYear || {})) {
    const v = player.teamsByYear[k]
    const n = Number(k)
    if (Number.isFinite(n) && v != null && v !== '') years.push(n)
  }
  for (const st of Array.isArray(player?.teamHistory) ? player.teamHistory : []) {
    const n = Number(st?.fromYear)
    if (Number.isFinite(n)) years.push(n)
  }
  return years.length ? Math.min(...years) : null
}

// Put `originYear` on `tid`'s roster when nothing earlier is recorded. Never
// overwrites a season already there, never touches a player whose history
// already reaches back past originYear (their origin is on the timeline).
function placeOriginSeason(player, originYear, tid) {
  const tby = player.teamsByYear || {}
  const existing = tby[originYear] ?? tby[String(originYear)]
  if (existing != null && existing !== '') return player
  const first = firstSeasonYear(player)
  if (first != null && first <= originYear) return player
  return { ...player, teamsByYear: { ...tby, [originYear]: Number(tid) } }
}

/**
 * The player-editor counterpart of applyPreviousSchool: the user set Portal
 * Transfer = Yes and picked a Previous Team, so the season before their first
 * recorded one belongs to that school. Derives the year from the record
 * itself (first season − 1; the current year when the record only carries the
 * `team` mirror). No-op unless the school resolves and differs from the first
 * season's team.
 */
export function materializeTransferOrigin(player, { teams, currentYear = null } = {}) {
  if (!player || player.isPortal !== true) return player
  const tid = resolvePreviousSchoolTid(player.previousTeam, teams)
  if (tid == null) return player
  let first = firstSeasonYear(player)
  if (first == null && currentYear != null && player.team != null && player.team !== '' && Number(player.team) !== -1) {
    first = Number(currentYear)
  }
  if (first == null || !Number.isFinite(first)) return player
  const firstTid = player.teamsByYear?.[first] ?? player.teamsByYear?.[String(first)] ?? player.team
  if (firstTid != null && Number(firstTid) === Number(tid)) return player
  return applyPreviousSchool(player, { previousTeam: tid, classYear: first - 1, teams, joiningTid: firstTid })
}
