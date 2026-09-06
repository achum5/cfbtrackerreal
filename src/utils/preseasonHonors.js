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
