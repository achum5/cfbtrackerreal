// Merge one conference's freshly-entered preseason picks into the year's flat
// preseason list without touching any other conference's picks.
//
// allConferencePreseason is ONE list per year across every conference (the
// page filters it by each entry's team conference at read time), so a save
// from the SEC's page must replace only the SEC's rows. Replacing the whole
// list would wipe every other conference's preseason picks each time one
// conference was entered.
//
// `belongsToConference(entry)` is supplied by the caller — conference
// membership is tid-derived and dynasty/year-aware, which this module has no
// business knowing about.
export function mergePreseasonForConference(existing, incoming, belongsToConference) {
  const kept = (Array.isArray(existing) ? existing : []).filter(e => !belongsToConference(e))
  return [...kept, ...(Array.isArray(incoming) ? incoming : [])]
}

// Whether `year`'s season has been played out, so its honors are the FINAL
// ones. The year flips entering offseason week 6 (Signing Day), so the
// current year still means the season just played through offseason week 5.
//
// The All-Americans and All-Conference pages use this to pick their default
// view for a year with nothing entered yet. They used to default every empty
// year to Preseason, and showed no Final/Preseason switch until something was
// saved, so "Add All-Americans" on a past season silently filed the list as
// preseason predictions — never credited to the players, and missing from
// the Final view.
export function isSeasonFinished(dynasty, year) {
  const y = Number(year)
  const current = Number(dynasty?.currentYear)
  if (!Number.isFinite(y) || !Number.isFinite(current)) return false
  if (y < current) return true
  if (y > current) return false
  const phase = dynasty?.currentPhase
  if (phase === 'postseason') return true
  return phase === 'offseason' && Number(dynasty?.currentWeek) < 6
}
