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
 *     State, exactly as if the user had added that row by hand — carrying
 *     the previous class, the same dev trait, and the pre-gain overall when
 *     Training Results supplied one (`pastOverall`).
 *
 * Pure; returns the next player object (the same object when nothing changes).
 */
export function applyPreviousSchool(player, { previousTeam, classYear, teams, joiningTid = null, pastOverall = null }) {
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
    next = placeOriginSeason(next, yearNum, tid, { pastOverall })
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

// The class a player held the season BEFORE the one they hold now. A
// redshirt tag means the redshirt was taken that prior season — an RS So was
// a (true) So the year before — so the tag simply comes off; otherwise the
// class steps back one year. Null when there is no prior college season
// (Fr, HS, JUCO) or the class is unknown.
export function previousSeasonClass(cls) {
  const c = String(cls ?? '').trim()
  if (!c) return null
  if (/^RS\s+/i.test(c)) return c.replace(/^RS\s+/i, '')
  return { So: 'Fr', Jr: 'So', Sr: 'Jr' }[c] || null
}

const readYear = (map, y) => (map ? (map[y] ?? map[String(y)]) : undefined)
const isBlank = (v) => v == null || v === ''

// Put `originYear` on `tid`'s roster when nothing earlier is recorded, then
// fill in what that season must have looked like from the season after it:
// the previous class, the same dev trait, and (when Training Results
// captured a "+N" for the player) the overall before the gain. Never
// overwrites a season, class, trait or overall already there, and never
// touches a player whose history already reaches back past originYear.
function placeOriginSeason(player, originYear, tid, { pastOverall = null } = {}) {
  let next = player
  const tby = next.teamsByYear || {}
  const existing = readYear(tby, originYear)
  if (isBlank(existing)) {
    const first = firstSeasonYear(next)
    if (first != null && first <= originYear) return next
    next = { ...next, teamsByYear: { ...tby, [originYear]: Number(tid) } }
  } else if (Number(existing) !== Number(tid)) {
    return next
  }

  const nextYear = originYear + 1
  if (isBlank(readYear(next.classByYear, originYear))) {
    const cls = previousSeasonClass(readYear(next.classByYear, nextYear) ?? next.year)
    if (cls) next = { ...next, classByYear: { ...(next.classByYear || {}), [originYear]: cls } }
  }
  if (isBlank(readYear(next.devTraitByYear, originYear))) {
    const dev = readYear(next.devTraitByYear, nextYear) ?? next.devTrait
    if (dev) next = { ...next, devTraitByYear: { ...(next.devTraitByYear || {}), [originYear]: dev } }
  }
  const past = Number(pastOverall)
  if (Number.isFinite(past) && past >= 40 && past <= 99 && isBlank(readYear(next.overallByYear, originYear))) {
    next = { ...next, overallByYear: { ...(next.overallByYear || {}), [originYear]: past } }
  }
  return next
}

// The Past OVR Training Results recorded for this player in `year`, if any —
// the ledger row is what holds the "+N" the game showed.
function ledgerPastOverall(trainingLedger, year, player) {
  const rows = trainingLedger?.[year] ?? trainingLedger?.[String(year)]
  if (!Array.isArray(rows) || !player) return null
  const norm = (n) => String(n ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const row = rows.find((r) => r && (
    (r.pid != null && player.pid != null && String(r.pid) === String(player.pid)) ||
    (r.playerName && norm(r.playerName) === norm(player.name))
  ))
  const v = Number(row?.pastOverall)
  return Number.isFinite(v) ? v : null
}

/**
 * The player-editor counterpart of applyPreviousSchool: the user set Portal
 * Transfer = Yes and picked a Previous Team, so the season before their first
 * recorded one belongs to that school. Derives the year from the record
 * itself (first season − 1; the current year when the record only carries the
 * `team` mirror). No-op unless the school resolves and differs from the first
 * season's team.
 */
export function materializeTransferOrigin(player, { teams, currentYear = null, trainingLedger = null } = {}) {
  if (!player || player.isPortal !== true) return player
  const tid = resolvePreviousSchoolTid(player.previousTeam, teams)
  if (tid == null) return player
  let first = firstSeasonYear(player)
  if (first == null && currentYear != null && player.team != null && player.team !== '' && Number(player.team) !== -1) {
    first = Number(currentYear)
  }
  if (first == null || !Number.isFinite(first)) return player
  const firstTid = player.teamsByYear?.[first] ?? player.teamsByYear?.[String(first)] ?? player.team
  // Either the origin season is still missing (first − 1), or it was already
  // added and is the earliest season on record — in which case only its
  // blanks (class, dev trait, pre-gain overall) are filled in.
  const originAlreadyFirst = firstTid != null && Number(firstTid) === Number(tid)
  const originYear = originAlreadyFirst ? first : first - 1
  const joiningYear = originYear + 1
  const joiningTid = player.teamsByYear?.[joiningYear] ?? player.teamsByYear?.[String(joiningYear)] ?? player.team
  // A "previous team" that is simply the team they're on is not an origin.
  if (originAlreadyFirst && (joiningTid == null || Number(joiningTid) === Number(tid))) return player
  const pastOverall = ledgerPastOverall(trainingLedger, joiningYear, player)
  return applyPreviousSchool(player, { previousTeam: tid, classYear: originYear, teams, joiningTid, pastOverall })
}
