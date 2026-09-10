// The in-season calendar, matching EA's: Week 0 through Week 14 is the
// regular season (Army-Navy sits in Week 14), then a dedicated Conference
// Championship week, then bowls / CFP. There is NO Week 15.
//
// Earlier builds modeled a 16-week regular season (0-15), so a few
// dynasties may still hold Week 15 data (a game or schedule row filed there
// by the old advance flow). Readers keep treating that as regular-season
// data; pickers only offer Week 15 when such data exists for the year in
// view, so nothing already saved becomes unreachable.

export const LAST_REGULAR_SEASON_WEEK = 14

export const REGULAR_SEASON_WEEKS = Object.freeze(
  Array.from({ length: LAST_REGULAR_SEASON_WEEK + 1 }, (_, i) => i)
)

/** The pre-fix last week, kept only so legacy data stays reachable. */
export const LEGACY_PHANTOM_WEEK = 15

/**
 * Regular-season weeks to offer in a picker: 0-14, plus 15 when `extra`
 * carries any value equal to 15 (e.g. the week of the game being edited, or
 * the weeks this year's games/schedule already use).
 */
export function regularSeasonWeekOptions(extra = []) {
  const weeks = [...REGULAR_SEASON_WEEKS]
  const hasLegacy = (Array.isArray(extra) ? extra : [extra]).some(w => Number(w) === LEGACY_PHANTOM_WEEK)
  if (hasLegacy) weeks.push(LEGACY_PHANTOM_WEEK)
  return weeks
}

/** Weeks used by regular-season games/schedule rows for a year (numeric only). */
export function weeksInUse(rows, year) {
  const out = new Set()
  for (const r of rows || []) {
    if (!r) continue
    if (year != null && Number(r.year) !== Number(year)) continue
    const w = Number(r.week)
    if (Number.isInteger(w)) out.add(w)
  }
  return [...out]
}

/** Recap / weekly-scores slots for the weeks after the regular season. */
export const CONF_CHAMP_WEEK_SLOT = 16
export const BOWL_WEEK_SLOT = Object.freeze({ 1: 17, 2: 18, 3: 19, 4: 20 })

/**
 * The slot of the week that JUST completed — the recap the dashboard should
 * surface and the one its "last week" to-do generates:
 *   regular season week N  -> N-1  (Week 1 shows the Week 0 recap)
 *   conference championship -> 14  (the last regular-season week)
 *   postseason week N       -> 16 for Bowl Week 1 (CCG week), then 17, 18, 19,
 *                              20 for the Recap week (National Championship)
 * Returns null when there is no completed week (preseason, Week 0, offseason).
 */
export function lastCompletedWeekSlot(phase, currentWeek) {
  const cw = Number(currentWeek)
  if (!Number.isFinite(cw)) return null
  if (phase === 'regular_season') return cw >= 1 ? cw - 1 : null
  if (phase === 'conference_championship') return LAST_REGULAR_SEASON_WEEK
  if (phase === 'postseason') return Math.max(CONF_CHAMP_WEEK_SLOT, CONF_CHAMP_WEEK_SLOT - 1 + cw)
  return null
}

/** Human label for a recap / weekly-scores slot. */
export function weekSlotLabel(slot) {
  const n = Number(slot)
  if (n === -1) return 'Preseason'
  if (n === CONF_CHAMP_WEEK_SLOT) return 'Conference Championship Week'
  if (n === BOWL_WEEK_SLOT[1]) return 'Bowl Week 1'
  if (n === BOWL_WEEK_SLOT[2]) return 'Bowl Week 2'
  if (n === BOWL_WEEK_SLOT[3]) return 'Bowl Week 3 / CFP Semifinals'
  if (n === BOWL_WEEK_SLOT[4]) return 'National Championship'
  return `Week ${slot}`
}

