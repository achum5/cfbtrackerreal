// A team's recruiting class, read off the PLAYER RECORDS instead of only the
// recruitingCommitments store: every player who ARRIVED at `tid` for the
// season after `classYear` — as a recruit, a portal transfer, or a JUCO
// transfer. This is what lets a player the user hand-edited into
// "transferred in from Alabama, 2026" show up in the 2026 class even though
// no commitment row was ever entered for them.
//
// A player counts when their roster team for classYear+1 is `tid` AND they
// were not already on `tid` in classYear, AND one of:
//   • movementByYear[classYear] is an arrival of kind recruit/transfer_in/juco
//     (legacy 'recruited' / 'portal_in' / 'transferred_in' / 'juco_in' too);
//   • their roster team in classYear was a DIFFERENT school (a departure
//     entry or just the timeline) → transfer, origin = that school;
//   • they have no prior season but were recorded as this class's recruit
//     (recruitYear === classYear with a recruit flag), or their first season
//     is classYear+1 with entryReason transfer_in / juco_in.
// Walk-ons and 'created' roster seeds never count.

import { getPlayerTid, getMovement } from '../data/rosterModel'

const sameTid = (a, b) => a != null && b != null && a !== '' && b !== '' && Number(a) === Number(b)

// Roster tid for a year: stint-based teamHistory first (the stint editor's
// source of truth), then teamsByYear / the current-year `team` mirror.
export function rosterTidForYear(player, year, { currentYear } = {}) {
  const y = Number(year)
  if (Array.isArray(player?.teamHistory)) {
    for (const stint of player.teamHistory) {
      const from = Number(stint?.fromYear)
      const to = stint?.toYear == null || stint?.toYear === '' ? Infinity : Number(stint.toYear)
      const t = stint?.teamTid ?? stint?.tid
      if (Number.isFinite(from) && y >= from && y <= to && t != null && t !== '') return Number(t)
    }
  }
  const v = getPlayerTid(player, y, { currentYear })
  return v == null || v === '' ? null : v
}

function arrivalKind(mv) {
  if (!mv || typeof mv !== 'object') return null
  if (mv.type === 'arrival') {
    if (mv.arrival === 'recruit') return 'recruit'
    if (mv.arrival === 'transfer_in') return 'transfer'
    if (mv.arrival === 'juco') return 'juco'
    return null // walk_on / created / anything else
  }
  switch (mv.type) {
    case 'recruited': return 'recruit'
    case 'portal_in':
    case 'transferred_in': return 'transfer'
    case 'juco_in': return 'juco'
    default: return null
  }
}

function firstRosterYear(player) {
  const years = []
  for (const k of Object.keys(player?.teamsByYear || {})) {
    const n = Number(k)
    if (Number.isFinite(n)) years.push(n)
  }
  for (const stint of Array.isArray(player?.teamHistory) ? player.teamHistory : []) {
    const n = Number(stint?.fromYear)
    if (Number.isFinite(n)) years.push(n)
  }
  return years.length ? Math.min(...years) : null
}

/**
 * How `player` joined `tid`'s classYear class, or null if they didn't.
 * @returns {{ kind: 'recruit'|'transfer'|'juco', fromTid: number|null } | null}
 */
export function classArrivalForTeamYear(player, tid, classYear, { currentYear } = {}) {
  if (!player || tid == null || player.isHonorOnly) return null
  const yearNum = Number(classYear)
  if (!Number.isFinite(yearNum)) return null
  const enrollYear = yearNum + 1
  if (!sameTid(rosterTidForYear(player, enrollYear, { currentYear }), tid)) return null
  const priorTid = rosterTidForYear(player, yearNum, { currentYear })
  if (sameTid(priorTid, tid)) return null // returning player, not a class member

  const mv = getMovement(player, yearNum)
  const kind = arrivalKind(mv)
  if (kind) {
    const fromTid = kind === 'recruit' ? null : (mv.fromTid ?? mv.fromTeamTid ?? priorTid ?? null)
    return { kind, fromTid: fromTid != null ? Number(fromTid) : null }
  }
  if (mv && mv.type !== 'departure' && !(typeof mv.type === 'string' && /portal|transfer|encouraged/.test(mv.type))) {
    // Some other recorded movement that season (a walk-on, 'created' seed…)
    return null
  }
  if (priorTid != null) return { kind: 'transfer', fromTid: Number(priorTid) }

  // No prior season on record.
  if (Number(player.recruitYear) === yearNum && (player.isRecruit || player.commitmentTid != null)) {
    return player.isPortal ? { kind: 'transfer', fromTid: null } : { kind: 'recruit', fromTid: null }
  }
  if (firstRosterYear(player) === enrollYear) {
    if (player.entryReason === 'transfer_in') return { kind: 'transfer', fromTid: null }
    if (player.entryReason === 'juco_in') return { kind: 'juco', fromTid: null }
  }
  return null
}

/** Every player in `players` who arrived for `tid`'s classYear class. */
export function playersArrivingForTeamYear(players, tid, classYear, opts = {}) {
  const out = []
  for (const p of players || []) {
    const arrival = classArrivalForTeamYear(p, tid, classYear, opts)
    if (arrival) out.push({ player: p, arrival })
  }
  return out
}
