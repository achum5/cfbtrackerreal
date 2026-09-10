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
