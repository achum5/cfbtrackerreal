// Which players have exhausted their eligibility this season.
//
// The rule is the one the old Google Sheet flow already used to pre-fill the
// Players Leaving sheet, and the same games threshold the season advance uses
// to decide a redshirt:
//
//   RS Sr                  -> graduating, always (no more seasons to burn)
//   Sr with 5+ games       -> graduating (played the season; can't redshirt)
//   Sr with 0-4 games      -> NOT graduating (eligible to redshirt into RS Sr)
//   Sr with unknown games  -> NOT graduating (can't tell; leave it to the user)
//
// Why this exists as its own module: the local-paste Players Leaving modal
// never pre-filled seniors (only the Google Sheet path did), and the season
// advance auto-graduated seniors ONLY on the CPU-team path. A member team's
// senior nobody listed was carried into an extra year as "RS Sr", and an RS
// Sr repeated forever — CLASS_PROGRESSION has nowhere to send them. Users
// then asked how to remove graduates from the roster. Both the modal pre-fill
// and the advance now share this one rule so they can't disagree.

export const classForYear = (player, year) =>
  player?.classByYear?.[year] ?? player?.classByYear?.[String(year)] ?? player?.year ?? null

export const gamesPlayedForYear = (player, year) => {
  const stats = player?.statsByYear?.[year] ?? player?.statsByYear?.[String(year)]
  const g = stats?.gamesPlayed
  return g == null ? null : Number(g)
}

export function hasExhaustedEligibility(player, year) {
  if (!player) return false
  const cls = classForYear(player, year)
  if (cls === 'RS Sr') return true
  if (cls === 'Sr') {
    const g = gamesPlayedForYear(player, year)
    return g != null && Number.isFinite(g) && g >= 5
  }
  return false
}

/**
 * The players from an already-filtered roster who are graduating this season,
 * name-sorted. Honor-only records and open recruits are never roster players
 * and are skipped defensively.
 */
export function pickAutoGraduatingSeniors(rosterPlayers, year) {
  return (rosterPlayers || [])
    .filter(p => p && !p.isHonorOnly && !p.isTarget && hasExhaustedEligibility(p, year))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
}
