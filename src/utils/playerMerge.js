// Duplicate-player detection + merge for Danger Zone's "Merge Duplicate
// Players" tool.
//
// Detection groups on normalizePlayerName — the SAME key every honor/award/
// box-score matcher uses — so any two records the app treats as one person
// elsewhere also show up here. It used to group on a bare lowercase+trim,
// which missed pairs whose names differ only invisibly (a non-breaking space,
// a doubled space, a zero-width character, an accent stored two ways): the
// Awards page would link one record, the roster the other, and the merge
// tool reported nothing.
//
// The merge folds every duplicate into the primary (lowest pid). It carries
// the honors (accolades / All-American / All-Conference) and every per-season
// map, not just teams/stats/class/OVR — previously a merge dropped the
// duplicate's awards entirely. A duplicate that is only a portal recommit's
// signing-day pickup is folded in as that recommit (see portalRecommit.js).

import { normalizePlayerName } from './playerMatching'
import { normalizeAwardName } from './playerHeal'
import { recommitCycles, isPortalArrivalShell, absorbRecommitDuplicate } from './portalRecommit'

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v)

export function findDuplicatePlayerGroups(players = []) {
  const byKey = new Map()
  for (const p of players) {
    if (!p?.name) continue
    const key = normalizePlayerName(p.name)
    if (!key) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(p)
  }
  const groups = []
  byKey.forEach((group, key) => {
    if (group.length < 2) return
    // Lowest pid = oldest record = primary.
    const sorted = [...group].sort((a, b) => (a.pid || 999999) - (b.pid || 999999))
    groups.push({ key, name: sorted[0].name, players: sorted })
  })
  return groups
}

// Append `extra` entries to `base` unless one with the same key is already
// there. Never reorders or rewrites the primary's own entries.
function unionBy(base = [], extra = [], keyOf) {
  const out = Array.isArray(base) ? [...base] : []
  const seen = new Set(out.map(keyOf))
  for (const e of (Array.isArray(extra) ? extra : [])) {
    if (!e || typeof e !== 'object') continue
    const k = keyOf(e)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(e)
  }
  return out
}

const accoladeKey = (a) => `${Number(a.year)}|${normalizeAwardName(a.award)}`
const honorKey = (h) => `${Number(h.year)}|${h.designation || 'first'}|${h.position || ''}`

// Per-season maps already handled explicitly in mergeDuplicatePlayers. Every
// OTHER `*ByYear` object (dev trait, jersey, position, archetype, ...) is
// gap-filled from the duplicate.
const EXPLICIT_BY_YEAR = new Set(['teamsByYear', 'statsByYear', 'classByYear', 'overallByYear', 'movementByYear'])

// Scalar profile fields copied from a duplicate only when the primary has none.
const FILL_IF_MISSING = [
  'stars', 'nationalRank', 'stateRank', 'positionRank', 'previousTeam', 'devTrait',
  'archetype', 'height', 'weight', 'pictureUrl', 'jerseyNumber', 'hometown', 'state',
  'recruitYear', 'position',
]

export function mergeDuplicatePlayers(primary, duplicates = []) {
  let merged = { ...primary }

  for (const dup of duplicates) {
    if (!dup) continue
    // A portal recommit entered on the signing-day list as a transfer: the
    // duplicate is only that cycle's pickup. Fold it in as the recommit it
    // is rather than overlaying its "transferred in" season on his record.
    const cycle = recommitCycles(merged).find(c => isPortalArrivalShell(dup, c.tid, c.classYear))
    if (cycle) {
      merged = absorbRecommitDuplicate(merged, dup, cycle)
      continue
    }
    // Merge teamsByYear
    if (dup.teamsByYear) {
      merged.teamsByYear = { ...merged.teamsByYear, ...dup.teamsByYear }
    }
    // Merge statsByYear: deep-merge per year so different categories in the
    // same season (e.g. primary has passing, duplicate has rushing) are
    // both preserved instead of one side winning wholesale.
    if (dup.statsByYear) {
      const mergedStatsByYear = { ...(merged.statsByYear || {}) }
      Object.entries(dup.statsByYear).forEach(([year, dupYearStats]) => {
        const existingYearStats = mergedStatsByYear[year] || {}
        const mergedYearStats = { ...existingYearStats }
        Object.entries(dupYearStats || {}).forEach(([category, dupCatStats]) => {
          if (isPlainObject(dupCatStats)) {
            mergedYearStats[category] = {
              ...(existingYearStats[category] || {}),
              ...dupCatStats
            }
          } else if (mergedYearStats[category] === undefined) {
            mergedYearStats[category] = dupCatStats
          }
        })
        mergedStatsByYear[year] = mergedYearStats
      })
      merged.statsByYear = mergedStatsByYear
    }
    // Merge classByYear
    if (dup.classByYear) {
      merged.classByYear = { ...merged.classByYear, ...dup.classByYear }
    }
    // Merge overallByYear
    if (dup.overallByYear) {
      merged.overallByYear = { ...merged.overallByYear, ...dup.overallByYear }
    }
    // Merge movements — prefer the canonical movementByYear map.
    // Year-by-year merge: dup wins only when merged is empty for
    // that year, so we don't clobber a known-good entry with a
    // legacy stub. syncDerivedFieldsFromV2 strips the legacy
    // movements[] array on save, so writing it here is dead;
    // merging movementByYear is the actual single-source-of-truth.
    if (isPlainObject(dup.movementByYear)) {
      const mergedByYear = { ...(merged.movementByYear || {}) }
      for (const [yr, mv] of Object.entries(dup.movementByYear)) {
        if (mv && !mergedByYear[yr] && !mergedByYear[String(yr)]) {
          mergedByYear[yr] = mv
        }
      }
      merged.movementByYear = mergedByYear
    }
    // Every other per-season map: fill only the seasons the primary lacks.
    for (const [field, map] of Object.entries(dup)) {
      if (!field.endsWith('ByYear') || EXPLICIT_BY_YEAR.has(field) || !isPlainObject(map)) continue
      const base = isPlainObject(merged[field]) ? { ...merged[field] } : {}
      for (const [yr, v] of Object.entries(map)) {
        if (v == null || v === '') continue
        if (base[yr] == null || base[yr] === '') base[yr] = v
      }
      merged[field] = base
    }
    // Keep highest overall rating
    if (dup.overall && (!merged.overall || dup.overall > merged.overall)) {
      merged.overall = dup.overall
    }
    // Honors — award trophies, All-American, All-Conference.
    if (Array.isArray(dup.accolades) && dup.accolades.length) {
      merged.accolades = unionBy(merged.accolades, dup.accolades, accoladeKey)
    }
    if (Array.isArray(dup.allAmericans) && dup.allAmericans.length) {
      merged.allAmericans = unionBy(merged.allAmericans, dup.allAmericans, honorKey)
    }
    if (Array.isArray(dup.allConference) && dup.allConference.length) {
      merged.allConference = unionBy(merged.allConference, dup.allConference, honorKey)
    }
    if (dup.honors) {
      const existingHonors = merged.honors || []
      const existingHonorKeys = new Set(existingHonors.map(h => `${h.year}-${h.honorType}`))
      const newHonors = dup.honors.filter(h => !existingHonorKeys.has(`${h.year}-${h.honorType}`))
      merged.honors = [...existingHonors, ...newHonors]
    }
    // Keep any profile info that might be missing
    for (const field of FILL_IF_MISSING) {
      if ((merged[field] == null || merged[field] === '') && dup[field] != null && dup[field] !== '') {
        merged[field] = dup[field]
      }
    }
  }

  // Sort movements by year
  if (Array.isArray(merged.movements)) {
    merged.movements = [...merged.movements].sort((a, b) => (a.year || 0) - (b.year || 0))
  }

  return merged
}
