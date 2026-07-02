// Data model for the CFB 27 Dynasty Points economy (input-driven tracker).
//
// Shape (PER-TEAM — each team in a multi-team league keeps its own economy):
//   dynasty.dynastyPoints = {
//     byTeam: {
//       [tid]: {
//         byYear: {
//           [year]: {
//             budget: number | null,
//             allocations: { staff, facilities, recruitingNil, rosterNil }, // numbers | null
//             supportStaff: [ { effect, tier, cost } ],                     // optional
//             facilities: { tier, grade, equipment: [ { name, effect, weeks } ] }, // optional
//           }
//         }
//       }
//     }
//   }
//
// LEGACY: earlier builds stored a single dynasty-wide entry at
// `dynasty.dynastyPoints.byYear[year]` with no team dimension, which meant that
// in a multi-team league every team shared one budget/allocation/facilities set
// (editing one team changed all of them). Reads fall back to that top-level
// `byYear` for any team that has no byTeam bucket yet, and the first write for a
// team seeds its bucket from the legacy data — so existing dynasties keep their
// numbers and simply stop sharing once a team is edited.
//
// SINGLE SOURCE OF TRUTH for reading + writing this structure. The active team
// is resolved internally via getCurrentTeamTid(dynasty), so callers keep passing
// just (dynasty, year). Every writer MERGE-PRESERVES the rest of the season
// entry, so independent edits (budget vs allocations vs support staff, possibly
// from different screens) can never clobber each other. Do NOT hand-roll
// `{ ...dp, byTeam: { ...} }` elsewhere — always go through
// patchSeasonEntry / the setters below.

import { getCurrentTeamTid } from './teamRegistry'

// Parse a text/number input to a non-negative number, or null when blank/bad.
export function parseDp(v) {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(/,/g, ''))
  return isNaN(n) || n < 0 ? null : n
}

// ── reads ────────────────────────────────────────────────────────────
export function getDynastyPoints(dynasty) {
  return dynasty?.dynastyPoints ?? {}
}

// Active team key (string) for the viewing user, or null if unresolved.
function activeTeamKey(dynasty) {
  const tid = getCurrentTeamTid(dynasty)
  return tid == null ? null : String(tid)
}

// The active team's bucket: { byYear: {...} }. Falls back to the legacy
// top-level entry for any team that doesn't have its own bucket yet, so
// pre-split dynasties keep showing their data until the team is edited.
function getTeamBucket(dynasty) {
  const dp = getDynastyPoints(dynasty)
  const key = activeTeamKey(dynasty)
  const bucket = key != null ? dp.byTeam?.[key] : null
  if (bucket) return bucket
  if (dp.byYear) return { byYear: dp.byYear } // legacy fallback
  return {}
}

export function getSeasonEntry(dynasty, year) {
  return getTeamBucket(dynasty).byYear?.[String(year)] ?? null
}

export function getSeasonBudget(dynasty, year) {
  const b = getSeasonEntry(dynasty, year)?.budget
  return b == null ? null : b
}

export function getSeasonAllocations(dynasty, year) {
  return getSeasonEntry(dynasty, year)?.allocations ?? {}
}

export function getSupportStaff(dynasty, year) {
  return getSeasonEntry(dynasty, year)?.supportStaff ?? []
}

// True once the user has engaged with support staff for the season (added some,
// or explicitly recorded "none" via setSupportStaff(..., [])). Used to mark the
// preseason to-do done without forcing a non-empty list.
export function isSupportStaffSet(dynasty, year) {
  return Array.isArray(getSeasonEntry(dynasty, year)?.supportStaff)
}

export function supportStaffTotal(dynasty, year) {
  return getSupportStaff(dynasty, year).reduce((sum, s) => sum + (Number(s?.cost) || 0), 0)
}

// Facilities — { tier, grade, equipment: [{ name, effect, weeks }] }. The tier
// is a key into the edition's facilities.tiers catalog (basic…nationalPowerhouse);
// equipment is the list slotted in. carryForward defaults the tier to the most
// recent prior season's tier so the user doesn't re-pick it every year.
export function getFacilities(dynasty, year) {
  return getSeasonEntry(dynasty, year)?.facilities ?? {}
}

export function getFacilityEquipment(dynasty, year) {
  return getFacilities(dynasty, year).equipment ?? []
}

// Most recent facility tier at or before `year` — lets a new season inherit the
// tier without re-entry (facilities persist until an upgrade/downgrade).
export function getCarriedFacilityTier(dynasty, year) {
  const y = Number(year)
  const years = getDynastyPointsYears(dynasty).filter((yr) => yr <= y).reverse()
  for (const yr of years) {
    const t = getSeasonEntry(dynasty, yr)?.facilities?.tier
    if (t) return t
  }
  return null
}

// All years that have a Blueprint entry for the active team, ascending.
export function getDynastyPointsYears(dynasty) {
  return Object.keys(getTeamBucket(dynasty).byYear || {}).map(Number).sort((a, b) => a - b)
}

// ── writes (all merge-preserving; return the next dynastyPoints object) ──
//
// Pass the result straight to updateDynasty(id, { dynastyPoints: <result> }).

export function patchSeasonEntry(dynasty, year, patch) {
  const dp = getDynastyPoints(dynasty)
  const key = String(year)
  const tkey = activeTeamKey(dynasty)

  // No resolvable team (should be rare) — preserve the legacy top-level write so
  // nothing silently drops.
  if (tkey == null) {
    const byYear = dp.byYear ?? {}
    return { ...dp, byYear: { ...byYear, [key]: { ...(byYear[key] ?? {}), ...patch } } }
  }

  const byTeam = dp.byTeam ?? {}
  // Seed a brand-new team bucket from the legacy top-level entry (one-time) so
  // existing data isn't lost the first time a team is edited.
  const existingBucket = byTeam[tkey] ?? (dp.byYear ? { byYear: { ...dp.byYear } } : {})
  const bucketByYear = existingBucket.byYear ?? {}
  return {
    ...dp,
    byTeam: {
      ...byTeam,
      [tkey]: {
        ...existingBucket,
        byYear: { ...bucketByYear, [key]: { ...(bucketByYear[key] ?? {}), ...patch } },
      },
    },
  }
}

export function setSeasonBudget(dynasty, year, budget) {
  return patchSeasonEntry(dynasty, year, { budget })
}

export function setSeasonAllocations(dynasty, year, allocations) {
  return patchSeasonEntry(dynasty, year, { allocations })
}

export function setSupportStaff(dynasty, year, supportStaff) {
  return patchSeasonEntry(dynasty, year, { supportStaff })
}

// Merge-preserving facilities write: patches only the given facilities fields,
// keeping the rest of the facilities object (tier vs equipment vs grade) intact.
export function setFacilities(dynasty, year, facilitiesPatch) {
  const current = getFacilities(dynasty, year)
  return patchSeasonEntry(dynasty, year, { facilities: { ...current, ...facilitiesPatch } })
}
