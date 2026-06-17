// Player NIL — the ledger field behind the two NIL Blueprint lanes (CFB 27).
//
// One field per player: `player.nilByYear[year]` = the NIL that player gets
// from us that season. It rides the existing year-keyed player maps
// (overallByYear, statsByYear, classByYear…) so there's no parallel store.
//
// The SAME field feeds both lanes; which lane a player counts toward is decided
// by status that year, NOT by where the number is stored:
//   • an open/committed-to-you TARGET for year Y  → Recruiting NIL (acquisition)
//   • a player ON YOUR ROSTER in year Y           → Roster NIL (retention)
//
// We do NOT track "expected NIL" (EA computes that) — only what you committed,
// i.e. what the player actually makes. Pure helpers; persistence is the caller's
// job (updatePlayer for a single-doc write).

// Read a player's NIL for a season (number, or null when unset).
export function getPlayerNil(player, year) {
  const m = player?.nilByYear
  if (!m) return null
  const v = m[String(year)] ?? m[Number(year)]
  return v == null || v === '' ? null : Number(v)
}

// Return a NEW player object with nilByYear[year] set (merge-preserving every
// other season). A null/blank amount clears that season's entry.
export function setPlayerNil(player, year, amount) {
  const nilByYear = { ...(player?.nilByYear || {}) }
  const key = String(year)
  if (amount == null || amount === '' || isNaN(Number(amount))) delete nilByYear[key]
  else nilByYear[key] = Number(amount)
  return { ...player, nilByYear }
}

// Sum NIL across a set of players for a season (the lane total).
export function sumPlayerNil(players, year) {
  return (players || []).reduce((s, p) => s + (getPlayerNil(p, year) || 0), 0)
}

// Recruit → roster carry-forward. When a prospect signs with you, the NIL offer
// you made in their recruiting cycle (classYear) becomes the floor for their
// first roster season (classYear + 1) — "NIL is a long-term commitment." Seeds
// nilByYear[classYear+1] from nilByYear[classYear], but NEVER clobbers a roster
// NIL already recorded for that year. Returns a (possibly new) player object.
export function carryRecruitingNilForward(player, classYear) {
  const cy = Number(classYear)
  const offer = getPlayerNil(player, cy)
  if (offer == null) return player
  const enrollYear = cy + 1
  if (getPlayerNil(player, enrollYear) != null) return player // don't overwrite entered roster NIL
  return setPlayerNil(player, enrollYear, offer)
}
