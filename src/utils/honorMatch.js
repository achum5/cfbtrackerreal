// Shared All-American / All-Conference honor matching.
//
// dynasty.allAmericansByYear[year] = { allAmericans: [...], allConference: [...] }
// stores each honor as a name+school entry (no pid) — this is the sheet-style
// entry shape used by both the manual entry modals AND cfb27SaveSync.js's
// auto-import. Resolving WHICH roster player a given entry belongs to only
// happens at render time via fuzzy name+school matching — the same matcher
// AllAmericans.jsx/AllConference.jsx each keep a local copy of, duplicated
// here so those two (already working) pages don't need to change to pick up
// the new consumers below.
//
// Manually-entered honors additionally get copied onto the player record
// itself (player.allAmericans / player.allConference) by processHonorPlayers
// (DynastyContext.jsx) when saved through the AllAmericans/AllConference
// modals. cfb27 auto-sync (cfb27SaveSync.js) writes straight into
// dynasty.allAmericansByYear and never calls processHonorPlayers, so for
// synced dynasties those per-player arrays stay empty. computeLiveHonorsByPid
// below re-derives the same per-player honor list at render time so pages
// like Player.jsx's Awards tab and TeamYear.jsx's franchise stats show synced
// honors too, without requiring a data migration.

import { isOpenTarget } from './recruitingTargets'
import { normalizePlayerName } from './playerMatching'
import { normalizeAwardName } from './playerHeal'
import { TEAMS } from '../data/teamRegistry'

// normalizePlayerName is called once per (honor entry x roster player) below,
// which runs into the millions on a long dynasty. Cache each player's key on
// the record object, re-deriving only if its name changes.
const playerNameKeyCache = new WeakMap()
const playerNameKey = (p) => {
  const cached = playerNameKeyCache.get(p)
  if (cached && cached.name === p.name) return cached.key
  const key = normalizePlayerName(p.name)
  playerNameKeyCache.set(p, { name: p.name, key })
  return key
}

const cleanPlayerName = (name) => {
  if (!name) return ''
  return name.replace(/^[\s★⭐✦•*·●◆♦▪■\-–—]+/, '').trim()
}

export function matchHonorToPlayer(dynasty, playerName, school, schoolTid = null) {
  if (!playerName || !dynasty?.players) return null

  const normalizedName = normalizePlayerName(cleanPlayerName(playerName))
  const normalizedSchool = school?.toUpperCase()
  const tidNum = schoolTid != null ? Number(schoolTid) : null

  const playerMatchesTid = (p) => {
    if (tidNum == null) return false
    if (typeof p.team === 'number' && Number(p.team) === tidNum) return true
    if (p.teamsByYear) {
      for (const v of Object.values(p.teamsByYear)) {
        if (v != null && Number(v) === tidNum) return true
      }
    }
    if (p.allAmericans?.some(aa => aa.schoolTid != null && Number(aa.schoolTid) === tidNum)) return true
    if (p.allConference?.some(ac => ac.schoolTid != null && Number(ac.schoolTid) === tidNum)) return true
    return false
  }

  const playerMatchesSchool = (p) => {
    if (!normalizedSchool) return false
    if (p.allAmericans?.some(aa => aa.school?.toUpperCase() === normalizedSchool)) return true
    if (p.allConference?.some(ac => ac.school?.toUpperCase() === normalizedSchool)) return true
    const resolveAbbrForTid = (tid) => {
      const t = dynasty?.teams?.[tid] || dynasty?.customTeams?.[tid] || TEAMS[tid]
      return t?.abbr?.toUpperCase() || null
    }
    if (p.team) {
      const playerTeamAbbr = typeof p.team === 'number' ? resolveAbbrForTid(p.team) : p.team.toUpperCase()
      if (playerTeamAbbr === normalizedSchool) return true
    }
    if (p.teamsByYear) {
      for (const tid of Object.values(p.teamsByYear)) {
        if (typeof tid === 'number' && resolveAbbrForTid(tid) === normalizedSchool) return true
        if (typeof tid === 'string' && tid.toUpperCase() === normalizedSchool) return true
      }
    }
    return false
  }

  const nameMatches = dynasty.players.filter(p =>
    p && !isOpenTarget(p) && playerNameKey(p) === normalizedName
  )

  if (nameMatches.length === 0) return null
  if (nameMatches.length === 1) return nameMatches[0]

  const tidMatch = nameMatches.find(p => playerMatchesTid(p))
  if (tidMatch) return tidMatch
  const schoolMatch = nameMatches.find(p => playerMatchesSchool(p))
  if (schoolMatch) return schoolMatch

  return nameMatches[0]
}

/**
 * Re-derive every player's All-American / All-Conference honors straight from
 * dynasty.allAmericansByYear, keyed by pid. Computed in one pass (each honor
 * entry matched once) so it's cheap to call once per page and reuse across a
 * whole roster, rather than re-matching per player.
 *
 * @returns {Map<string, {allAmericans: Array, allConference: Array}>}
 */
export function computeLiveHonorsByPid(dynasty) {
  const byPid = new Map()
  const byYear = dynasty?.allAmericansByYear
  if (!byYear) return byPid

  const addHonor = (pid, type, year, entry) => {
    if (!byPid.has(pid)) byPid.set(pid, { allAmericans: [], allConference: [] })
    byPid.get(pid)[type].push({
      year: Number(year),
      designation: entry.designation,
      position: entry.position,
      school: entry.school,
      class: entry.class,
    })
  }

  for (const [year, data] of Object.entries(byYear)) {
    for (const entry of (data?.allAmericans || [])) {
      const matched = matchHonorToPlayer(dynasty, entry.player, entry.school, entry.schoolTid)
      if (matched?.pid) addHonor(matched.pid, 'allAmericans', year, entry)
    }
    for (const entry of (data?.allConference || [])) {
      const matched = matchHonorToPlayer(dynasty, entry.player, entry.school, entry.schoolTid)
      if (matched?.pid) addHonor(matched.pid, 'allConference', year, entry)
    }
  }

  return byPid
}

// Merge a player's own stored honor array (populated by the manual-entry
// modal flow via processHonorPlayers) with the live-derived one (covers
// cfb27 auto-sync, which never writes to the player record) — deduped by
// year+designation+position so a player edited through both paths doesn't
// show a doubled-up row.
export function mergeHonorLists(stored = [], live = []) {
  const key = (h) => `${h.year}-${h.designation}-${h.position}`
  const seen = new Set(stored.map(key))
  const merged = [...stored]
  for (const h of live) {
    const k = key(h)
    if (!seen.has(k)) {
      seen.add(k)
      merged.push(h)
    }
  }
  return merged
}

// Coach awards go to a head coach / coordinator, never a roster player.
const COACH_AWARD_KEYS = new Set(['bearBryantCoachOfTheYear', 'broyles'])

/**
 * Re-derive every player's major awards (Heisman, Nagurski, Butkus, ...)
 * straight from dynasty.awardsByYear, keyed by pid — the award-side twin of
 * computeLiveHonorsByPid.
 *
 * player.accolades is only written when awards are saved through the Awards
 * modal (processHonorPlayers). cfb27 auto-sync writes awardsByYear directly
 * and never touches the player, so a synced award showed on the Awards page
 * but on no profile. A stored accolade stays authoritative: an award already
 * recorded on ANY player's accolades for that season is left alone here, so
 * a "different player" decision made in the modal is never second-guessed.
 *
 * @returns {Map<number, Array<{year:number, award:string, team?:string, position?:string, class?:string}>>}
 */
export function computeLiveAwardsByPid(dynasty) {
  const byPid = new Map()
  const byYear = dynasty?.awardsByYear
  if (!byYear || !Array.isArray(dynasty?.players)) return byPid

  const claimed = new Set()
  for (const p of dynasty.players) {
    for (const a of (Array.isArray(p?.accolades) ? p.accolades : [])) {
      const key = normalizeAwardName(a?.award)
      if (key && a?.year != null) claimed.add(`${Number(a.year)}|${key}`)
    }
  }

  for (const [year, awards] of Object.entries(byYear)) {
    const yr = Number(year)
    if (!Number.isFinite(yr) || !awards || typeof awards !== 'object') continue
    for (const [rawKey, entry] of Object.entries(awards)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      if (typeof entry.player !== 'string' || !entry.player.trim()) continue
      const award = normalizeAwardName(rawKey)
      if (!award || COACH_AWARD_KEYS.has(award)) continue
      if (claimed.has(`${yr}|${award}`)) continue
      const matched = matchHonorToPlayer(dynasty, entry.player, entry.team, entry.tid ?? null)
      if (!matched?.pid) continue
      if (!byPid.has(matched.pid)) byPid.set(matched.pid, [])
      byPid.get(matched.pid).push({
        year: yr,
        award,
        team: entry.team,
        position: entry.position,
        class: entry.class,
      })
    }
  }

  return byPid
}

// A player's stored accolades plus the live-derived ones, one row per
// season+award (labels and legacy keys collapse via normalizeAwardName).
export function mergeAccoladeLists(stored = [], live = []) {
  const key = (a) => `${Number(a?.year)}|${normalizeAwardName(a?.award)}`
  const merged = Array.isArray(stored) ? [...stored] : []
  const seen = new Set(merged.map(key))
  for (const a of (Array.isArray(live) ? live : [])) {
    const k = key(a)
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(a)
  }
  return merged
}
