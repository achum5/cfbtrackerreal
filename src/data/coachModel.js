// Coach entity model — cid-keyed NPC coaches (coordinators + head coaches).
//
// Mirrors the player model: a stable `cid` identity + per-season records.
// This is the rich layer ON TOP of the legacy name-only coaching staff
// (teams[tid].byYear[year].coachingStaff.{hcName,ocName,dcName}); those
// name fields stay in sync via a bridge so existing pages/recaps keep
// working. `cid` is for tracked NPC coaches — human members stay on `uid`
// (coachCareer / memberCoachingStaff).
//
// Shape:
//   dynasty.coaches[cid] = {
//     cid, name, archetype?, abilities?: string[], notes?,
//     status: 'active' | 'departed', departedYear?: number|null,
//     byYear: { [year]: { teamTid, role, level, salary, hiredVia } }
//   }
//   role:     'HC' | 'OC' | 'DC'
//   salary:   Dynasty Points earned that season (CFB 27)
//   hiredVia: 'carousel' | 'free_agent' | 'retained' | 'promoted'

export const COACH_ROLES = ['HC', 'OC', 'DC']

export const COACH_ROLE_LABELS = {
  HC: 'Head Coach',
  OC: 'Offensive Coordinator',
  DC: 'Defensive Coordinator',
}

export const HIRED_VIA_OPTIONS = [
  { key: 'carousel', label: 'Coaching Carousel' },
  { key: 'free_agent', label: 'Free Agent' },
  { key: 'retained', label: 'Retained' },
  { key: 'promoted', label: 'Promoted' },
]

// Short, stable coach id. App-runtime only (Math.random is fine here).
export function generateCid() {
  const rand = Math.random().toString(36).slice(2, 8)
  const stamp = Date.now().toString(36).slice(-4)
  return `c_${rand}${stamp}`
}

// ── reads ────────────────────────────────────────────────────────────

export function getCoaches(dynasty) {
  return dynasty?.coaches || {}
}

export function getCoach(dynasty, cid) {
  return dynasty?.coaches?.[cid] || null
}

// Every coach with a record on a given team in a given year, as
// { coach, record }. Useful for a team's staff list.
export function getStaffForTeamYear(dynasty, tid, year) {
  const coaches = getCoaches(dynasty)
  const tidNum = Number(tid)
  const yearKey = String(year)
  const out = []
  for (const coach of Object.values(coaches)) {
    const record = coach?.byYear?.[yearKey]
    if (record && Number(record.teamTid) === tidNum) out.push({ coach, record })
  }
  // Stable role order: HC, OC, DC, then anything else.
  return out.sort((a, b) => COACH_ROLES.indexOf(a.record.role) - COACH_ROLES.indexOf(b.record.role))
}

// The coach filling a specific role on a team in a year (first match).
export function getCoachByRole(dynasty, tid, year, role) {
  return getStaffForTeamYear(dynasty, tid, year).find((s) => s.record.role === role) || null
}

// Career roll-up derived from byYear — no stored duplication.
export function getCoachCareer(coach) {
  const byYear = coach?.byYear || {}
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)
  const totalSalary = years.reduce((sum, y) => sum + (Number(byYear[String(y)].salary) || 0), 0)
  const teams = [...new Set(years.map((y) => byYear[String(y)].teamTid))]
  const current = years.length ? byYear[String(years[years.length - 1])] : null
  return { years, seasons: years.length, totalSalary, teams, current }
}

// ── writes (pure: produce the next object, caller persists) ──────────

export function upsertCoach(coaches, coach) {
  return { ...(coaches || {}), [coach.cid]: coach }
}

export function deleteCoach(coaches, cid) {
  const next = { ...(coaches || {}) }
  delete next[cid]
  return next
}

// Merge a single season's fields into a coach's byYear map.
export function setCoachSeason(coach, year, record) {
  const yearKey = String(year)
  return {
    ...coach,
    byYear: {
      ...(coach.byYear || {}),
      [yearKey]: { ...(coach.byYear?.[yearKey] || {}), ...record },
    },
  }
}

export function removeCoachSeason(coach, year) {
  const yearKey = String(year)
  const nextByYear = { ...(coach.byYear || {}) }
  delete nextByYear[yearKey]
  return { ...coach, byYear: nextByYear }
}

// ── legacy name bridge ───────────────────────────────────────────────
//
// The team header popup + Dashboard read legacy name-only fields
// (teams[tid].byYear[year].coachingStaff.{hcName,ocName,dcName}). These
// helpers keep those names in sync with the cid coaches so the tracked
// coordinators surface everywhere the old names do.

const ROLE_TO_NAME_FIELD = { HC: 'hcName', OC: 'ocName', DC: 'dcName' }

// Derive the legacy {hcName,ocName,dcName} for a team-year from cid coaches.
// Only roles that have a cid coach are included — so existing manually-typed
// names for other roles are left untouched. Pass clearRoles to explicitly
// null out a role that no longer has any cid coach (used on removal).
export function deriveCoachingStaffNames(coaches, tid, year, { clearRoles = [] } = {}) {
  const yearKey = String(year)
  const tidNum = Number(tid)
  const names = {}
  for (const coach of Object.values(coaches || {})) {
    const rec = coach?.byYear?.[yearKey]
    if (!rec || Number(rec.teamTid) !== tidNum) continue
    const field = ROLE_TO_NAME_FIELD[rec.role]
    if (field && !(field in names)) names[field] = coach.name || null
  }
  for (const role of clearRoles) {
    const field = ROLE_TO_NAME_FIELD[role]
    if (field && !(field in names)) names[field] = null
  }
  return names
}

// Merge derived names into a teams object's coachingStaff for a team-year,
// returning the next teams object (non-destructive on untouched fields).
export function applyCoachingStaffNames(teams, tid, year, names) {
  const yearKey = String(year)
  const team = teams?.[tid] || {}
  const byYear = team.byYear || {}
  const yearData = byYear[yearKey] || {}
  return {
    ...(teams || {}),
    [tid]: {
      ...team,
      byYear: {
        ...byYear,
        [yearKey]: {
          ...yearData,
          coachingStaff: { ...(yearData.coachingStaff || {}), ...names },
        },
      },
    },
  }
}

// ── migration ────────────────────────────────────────────────────────
//
// Turn legacy name-only coordinators (teams[tid].byYear[year].coachingStaff
// .{ocName,dcName}, across every team-season) into cid coaches carrying
// their year-by-year team + role history. HC is intentionally skipped — on
// the user's team that's the user (uid), not an NPC cid. Salaries were never
// recorded historically, so they start null. Idempotent: a role already
// filled by a cid coach for a team-year is left alone, so re-running is safe.

const normName = (n) => (n || '').trim().toLowerCase()

function roleFilledByCid(coaches, tid, year, role) {
  const tidNum = Number(tid)
  const yearKey = String(year)
  return Object.values(coaches).some((c) => {
    const r = c?.byYear?.[yearKey]
    return r && Number(r.teamTid) === tidNum && r.role === role
  })
}

export function migrateLegacyCoachesToCids(dynasty) {
  const teams = dynasty?.teams || {}
  const coaches = { ...(dynasty?.coaches || {}) }
  const byName = new Map()
  for (const c of Object.values(coaches)) {
    if (c?.name) byName.set(normName(c.name), c.cid)
  }
  let created = 0
  let seasonsAdded = 0
  const roleFields = [['OC', 'ocName'], ['DC', 'dcName']]

  for (const [tid, team] of Object.entries(teams)) {
    const byYear = team?.byYear || {}
    for (const [year, yearData] of Object.entries(byYear)) {
      const cs = yearData?.coachingStaff
      if (!cs) continue
      for (const [role, field] of roleFields) {
        const name = (cs[field] || '').trim()
        if (!name) continue
        // Don't clobber a role already tracked via a cid coach.
        if (roleFilledByCid(coaches, tid, year, role)) continue
        let cid = byName.get(normName(name))
        if (!cid) {
          cid = generateCid()
          coaches[cid] = { cid, name, status: 'active', departedYear: null, byYear: {} }
          byName.set(normName(name), cid)
          created++
        }
        if (!coaches[cid].byYear?.[String(year)]) {
          coaches[cid] = setCoachSeason(coaches[cid], year, {
            teamTid: Number(tid),
            role,
            level: null,
            salary: null,
          })
          seasonsAdded++
        }
      }
    }
  }
  return { coaches, created, seasonsAdded }
}

// Build a brand-new coach with a first-season record.
export function makeCoach({ name, year, teamTid, role, level, salary, hiredVia, archetype }) {
  const cid = generateCid()
  return {
    cid,
    name: (name || '').trim(),
    ...(archetype ? { archetype } : {}),
    status: 'active',
    departedYear: null,
    byYear: {
      [String(year)]: {
        teamTid: teamTid != null ? Number(teamTid) : null,
        role: role || 'OC',
        level: level != null && level !== '' ? Number(level) : null,
        salary: salary != null && salary !== '' ? Number(salary) : null,
        ...(hiredVia ? { hiredVia } : {}),
      },
    },
  }
}
