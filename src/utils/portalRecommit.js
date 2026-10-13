// A portal recommit, stored the way the year flip understands it.
//
// The player editor's timeline offered "Entered Portal" as the only portal
// exit, so a recommit was entered as a portal departure followed by a season
// back on the same team. The player page reads that shape as a RECOMMIT, but
// the year flip does not: it treats any departure on the season just ended as
// "leaving" unless the movement is an explicit recommit, and it deliberately
// ignores a pre-filled next-season row as evidence of a return (that guard
// stops departed players from reappearing). So a recommit entered that way
// was dropped from the roster at the advance.
//
// canonicalizeRecommits rewrites that shape to { type: 'recommit' } when the
// player is saved from the editor — the one place the user is looking at the
// "came back to the same team" row and confirming it.

const read = (map, y) => (map ? (map[y] ?? map[String(y)]) : undefined)
const sameTid = (a, b) => a != null && b != null && a !== '' && b !== '' && Number(a) === Number(b)

const isPortalExit = (m) => !!m && (
  (m.type === 'departure' && m.departure === 'transfer_out')
  || m.type === 'entered_portal'
  || m.type === 'transferred_out'
)

/**
 * Pure. Returns the player (or form data) with every "portal exit, then the
 * next season on the same team" movement rewritten as an explicit recommit.
 * A portal exit naming a DIFFERENT destination, graduations, and draft
 * departures are left alone. Same object back when nothing changes.
 */
export function canonicalizeRecommits(player) {
  if (!player?.movementByYear) return player
  const tby = player.teamsByYear || {}
  let next = null
  for (const [yKey, m] of Object.entries(player.movementByYear)) {
    const y = Number(yKey)
    if (!Number.isFinite(y) || !isPortalExit(m)) continue
    const here = read(tby, y)
    if (!sameTid(here, read(tby, y + 1))) continue
    const to = m.toTid ?? m.toTeamTid
    if (to != null && to !== '' && !sameTid(to, here)) continue
    if (!next) next = { ...player.movementByYear }
    next[yKey] = { type: 'recommit', ...(m.reason ? { reason: m.reason } : {}) }
  }
  return next ? { ...player, movementByYear: next } : player
}
