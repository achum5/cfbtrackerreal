// A portal recommit, stored the way the year flip understands it.
//
// The player editor's timeline offered "Entered Portal" as the only portal
// exit, so a recommit was entered as a portal departure followed by a season
// back on the same team. The player page reads that shape as a RECOMMIT, but
// the year flip does not: it treats any departure on the season just ended as
// "leaving" unless the movement is an explicit recommit, and it deliberately
// ignores a pre-filled next-season row as evidence of a return (that guard
// stops departed players from reappearing). So a recommit entered that way
// was dropped from the roster at the advance.
//
// canonicalizeRecommits rewrites that shape to { type: 'recommit' } when the
// player is saved from the editor — the one place the user is looking at the
// "came back to the same team" row and confirming it.

import { normalizePlayerName } from './playerMatching'

const read = (map, y) => (map ? (map[y] ?? map[String(y)]) : undefined)
const sameTid = (a, b) => a != null && b != null && a !== '' && b !== '' && Number(a) === Number(b)

const isPortalExit = (m) => !!m && (
  (m.type === 'departure' && m.departure === 'transfer_out')
  || m.type === 'entered_portal'
  || m.type === 'transferred_out'
)

/**
 * A movement that, for a player on `tid` this season and back there next
 * season, means "entered the portal and came back": an explicit recommit, or
 * a portal exit naming no other school. Graduations and draft departures
 * never qualify. The one definition the class page and the helpers below use.
 */
export function isRecommitMovement(m, tid) {
  if (!m || typeof m !== 'object') return false
  if (m.type === 'recommit' || m.type === 'recommitted') return true
  if (!isPortalExit(m)) return false
  const to = m.toTid ?? m.toTeamTid
  return to == null || to === '' || sameTid(to, tid)
}

/**
 * Pure. Returns the player (or form data) with every "portal exit, then the
 * next season on the same team" movement rewritten as an explicit recommit.
 * A portal exit naming a DIFFERENT destination, graduations, and draft
 * departures are left alone. Same object back when nothing changes.
 */
export function canonicalizeRecommits(player) {
  if (!player?.movementByYear) return player
  const tby = player.teamsByYear || {}
  let next = null
  for (const [yKey, m] of Object.entries(player.movementByYear)) {
    const y = Number(yKey)
    if (!Number.isFinite(y) || !isPortalExit(m)) continue
    const here = read(tby, y)
    if (!sameTid(here, read(tby, y + 1))) continue
    const to = m.toTid ?? m.toTeamTid
    if (to != null && to !== '' && !sameTid(to, here)) continue
    if (!next) next = { ...player.movementByYear }
    next[yKey] = { type: 'recommit', ...(m.reason ? { reason: m.reason } : {}) }
  }
  return next ? { ...player, movementByYear: next } : player
}

// ─── The second record a recommit picks up ─────────────────────────────────
//
// In the game a player who enters the portal and recommits shows up in the
// signing list as a transfer commit. Entered that way, the app had no way to
// know he was already on the roster, so it minted a brand-new "transferred
// in from the portal" record for him — one person, two profiles. The class
// page then showed the new record (no history, no link to his real page), and
// the real one never showed as part of the class.
//
// The shell record is recognized narrowly: it exists ONLY as this cycle's
// portal arrival at the team (no other season, no stats, no honors), and the
// real record has the same name, was on that team in the class year, and left
// it through the portal with no other destination (or was marked recommitted).

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v)

const hasMeaningfulStats = (statsByYear) => {
  if (!isPlainObject(statsByYear)) return false
  for (const yearStats of Object.values(statsByYear)) {
    if (!isPlainObject(yearStats)) continue
    for (const [k, v] of Object.entries(yearStats)) {
      if (isPlainObject(v) && Object.values(v).some(x => Number(x) > 0)) return true
      if (k === 'gamesPlayed' && Number(v) > 0) return true
    }
  }
  return false
}

const isPortalArrival = (m, tid) => {
  if (!m) return false
  const kind = m.type === 'arrival' ? m.arrival : m.type
  if (kind !== 'transfer_in' && kind !== 'portal_in' && kind !== 'transferred_in') return false
  const from = m.fromTid ?? m.fromTeamTid
  return from == null || from === '' || sameTid(from, tid)
}

/** A record that is nothing but `tid`'s portal pickup for the classYear cycle. */
export function isPortalArrivalShell(p, tid, classYear) {
  if (!p || tid == null) return false
  const y = Number(classYear)
  const enroll = y + 1
  const years = Object.entries(p.teamsByYear || {}).filter(([, v]) => v != null && v !== '')
  if (years.length !== 1 || Number(years[0][0]) !== enroll || !sameTid(years[0][1], tid)) return false
  for (const st of Array.isArray(p.teamHistory) ? p.teamHistory : []) {
    if (!sameTid(st?.teamTid ?? st?.tid, tid) || Number(st?.fromYear) < enroll) return false
  }
  const moves = Object.entries(p.movementByYear || {}).filter(([, m]) => m)
  if (moves.length > 1) return false
  if (moves.length === 1) {
    if (Number(moves[0][0]) !== y || !isPortalArrival(moves[0][1], tid)) return false
  } else if (!(p.isPortal === true && Number(p.recruitYear) === y)) {
    return false
  }
  if (hasMeaningfulStats(p.statsByYear)) return false
  if ((p.accolades || []).length || (p.allAmericans || []).length || (p.allConference || []).length) return false
  return true
}

/**
 * The real record of a player who left `tid` through the portal in classYear
 * and is (or may be) coming back: on `tid` that season, a recommit or a
 * portal exit naming no other school, and not on another team next season.
 */
export function isRecommitCandidate(p, tid, classYear) {
  if (!p || tid == null) return false
  const y = Number(classYear)
  if (!sameTid(read(p.teamsByYear, y), tid)) return false
  const next = read(p.teamsByYear, y + 1)
  if (next != null && next !== '' && !sameTid(next, tid)) return false
  return isRecommitMovement(read(p.movementByYear, y), tid)
}

/** The one shell record duplicating `original`'s classYear recommit, or null. */
export function findRecommitDuplicate(players, original, tid, classYear) {
  if (!original?.name || !isRecommitCandidate(original, tid, classYear)) return null
  const key = normalizePlayerName(original.name)
  const matches = (players || []).filter(p =>
    p && p.pid !== original.pid && normalizePlayerName(p.name) === key && isPortalArrivalShell(p, tid, classYear)
  )
  return matches.length === 1 ? matches[0] : null
}

/** Every classYear in which `player` recommitted to (or left through the portal from) a team. */
export function recommitCycles(player) {
  const out = []
  for (const [yKey, m] of Object.entries(player?.movementByYear || {})) {
    const y = Number(yKey)
    if (!Number.isFinite(y) || !m) continue
    const tid = read(player.teamsByYear, y)
    if (tid == null || tid === '') continue
    if (isRecommitCandidate(player, tid, y)) out.push({ classYear: y, tid: Number(tid) })
  }
  return out
}

// Recruiting profile fields the game shows for a portal commit.
const RECRUIT_FIELDS = ['stars', 'nationalRank', 'positionRank', 'stateRank', 'gemBust']
const FILL_IF_MISSING = ['height', 'weight', 'hometown', 'state', 'archetype', 'pictureUrl', 'jerseyNumber', 'devTrait', 'position']
const blank = (v) => v == null || v === ''

const isRankValue = (f, v) => !blank(v) && !(f !== 'gemBust' && Number(v) === 0)

/**
 * Record `original` as recommitting to `tid` in the classYear cycle, with the
 * recruiting profile he was listed under (`recruit`: stars / ranks / gemBust,
 * e.g. the commit row or the shell record). Pure; the recruit profile lives in
 * portalRecruitByYear[classYear] so it never overwrites his original
 * high-school recruiting data. recruitWins: the incoming values replace the
 * stored ones (a fresh commit row); otherwise they only fill gaps, so a
 * profile already edited in the player editor is never overwritten.
 */
export function markRecommit(original, { tid, classYear, recruit = null, recruitWins = true }) {
  const y = Number(classYear)
  const prev = read(original.movementByYear, y)
  const reason = prev?.reason
  const next = {
    ...original,
    movementByYear: {
      ...(original.movementByYear || {}),
      [y]: { type: 'recommit', ...(reason ? { reason } : {}) },
    },
  }
  if (blank(read(original.teamsByYear, y + 1))) {
    next.teamsByYear = { ...(original.teamsByYear || {}), [y + 1]: Number(tid) }
  }
  if (recruit) {
    const profile = { ...(read(original.portalRecruitByYear, y) || {}) }
    for (const f of RECRUIT_FIELDS) {
      const v = recruit[f]
      if (!isRankValue(f, v)) continue
      if (recruitWins || !isRankValue(f, profile[f])) profile[f] = v
    }
    if (Object.keys(profile).length) {
      next.portalRecruitByYear = { ...(original.portalRecruitByYear || {}), [y]: profile }
    }
  }
  return next
}

/**
 * Fold the shell `dup` into `original` as a classYear recommit to `tid`: the
 * movement becomes a recommit, the shell's recruiting profile moves to
 * portalRecruitByYear, and any per-season value the original lacks (dev
 * trait, OVR, attributes for the coming season...) is filled from the shell.
 * The original's own values always win. Pure.
 */
export function absorbRecommitDuplicate(original, dup, { tid, classYear }) {
  let merged = markRecommit(original, { tid, classYear, recruit: dup, recruitWins: false })
  for (const [field, map] of Object.entries(dup || {})) {
    if (!field.endsWith('ByYear') || !isPlainObject(map)) continue
    if (field === 'teamsByYear' || field === 'movementByYear' || field === 'statsByYear') continue
    const base = isPlainObject(merged[field]) ? { ...merged[field] } : {}
    let changed = false
    for (const [yr, v] of Object.entries(map)) {
      if (blank(v) || !blank(base[yr])) continue
      base[yr] = v
      changed = true
    }
    if (changed) merged = { ...merged, [field]: base }
  }
  for (const f of FILL_IF_MISSING) {
    if (blank(merged[f]) && !blank(dup?.[f])) merged = { ...merged, [f]: dup[f] }
  }
  return merged
}

/**
 * Absorb every shell duplicate of `player`'s recommits found in `players`.
 * explicitOnly limits it to seasons already marked as a recommit (the player
 * editor's case — a plain portal exit there is left as the user entered it).
 * @returns {{ player: object, absorbedPids: number[] }}
 */
export function absorbRecommitDuplicates(player, players, { explicitOnly = false } = {}) {
  let out = player
  const absorbedPids = []
  for (const { classYear, tid } of recommitCycles(player)) {
    const m = read(player.movementByYear, classYear)
    if (explicitOnly && m?.type !== 'recommit' && m?.type !== 'recommitted') continue
    const dup = findRecommitDuplicate(players, out, tid, classYear)
    if (!dup) continue
    out = absorbRecommitDuplicate(out, dup, { tid, classYear })
    absorbedPids.push(dup.pid)
  }
  return { player: out, absorbedPids }
}

// An explicit recommit to `tid` in classYear, with the next season back there.
export function isExplicitRecommit(p, tid, classYear) {
  const y = Number(classYear)
  const m = read(p?.movementByYear, y)
  if (!m || (m.type !== 'recommit' && m.type !== 'recommitted')) return false
  const here = read(p.teamsByYear, y)
  return sameTid(here, tid) && sameTid(read(p.teamsByYear, y + 1), tid)
}

/**
 * The real record behind a shell pickup: the one same-named player marked as
 * recommitting to `tid` in classYear. Null unless `shell` is a shell and
 * exactly one such player exists.
 */
export function findRecommitOriginal(players, shell, tid, classYear) {
  if (!shell?.name || !isPortalArrivalShell(shell, tid, classYear)) return null
  const key = normalizePlayerName(shell.name)
  const matches = (players || []).filter(p =>
    p && p.pid !== shell.pid && normalizePlayerName(p.name) === key && isExplicitRecommit(p, tid, classYear)
  )
  return matches.length === 1 ? matches[0] : null
}

/**
 * The recommit a player belongs to a recruiting class through, newest first:
 * { classYear, tid, profile } — profile is portalRecruitByYear[classYear]
 * (may be empty). Only explicit recommits whose next season is back on the
 * same team count.
 */
export function latestRecommit(player) {
  const cycles = []
  for (const yKey of Object.keys(player?.movementByYear || {})) {
    const y = Number(yKey)
    if (!Number.isFinite(y)) continue
    const tid = read(player.teamsByYear, y)
    if (!isExplicitRecommit(player, tid, y)) continue
    cycles.push({ classYear: y, tid: Number(tid), profile: read(player.portalRecruitByYear, y) || {} })
  }
  cycles.sort((a, b) => b.classYear - a.classYear)
  return cycles[0] || null
}

/**
 * The recruiting profile (stars / ranks / gemBust) a player was re-recruited
 * under for his classYear recommit to `tid`. The ONE read the class card, the
 * player page and the editor share, so the three can't disagree. Each field
 * comes from the first source that has it:
 *   1. his record's portalRecruitByYear[classYear] (where every save path
 *      now writes it);
 *   2. a signing-day pickup record not yet folded into him;
 *   3. his top-level recruiting fields, when they were stamped as this
 *      cycle's portal signing (recruitYear === classYear, isPortal) — how the
 *      Dashboard's signing-day save recorded a recommit before it used (1).
 */
export function recommitRecruitProfile(player, players, tid, classYear) {
  const stored = read(player?.portalRecruitByYear, classYear) || {}
  const shell = findRecommitDuplicate(players, player, tid, classYear)
  const legacy = (player?.isPortal === true && Number(player?.recruitYear) === Number(classYear)) ? player : null
  const out = {}
  for (const f of RECRUIT_FIELDS) {
    const v = [stored[f], shell?.[f], legacy?.[f]].find(x => isRankValue(f, x))
    if (v !== undefined) out[f] = v
  }
  return out
}
