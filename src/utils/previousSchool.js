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
