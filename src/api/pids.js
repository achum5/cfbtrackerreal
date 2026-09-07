// The one place a player id comes from.
//
// zengm hands every store an auto-increment key (players: pid, games: gid) so
// an id is never computed by a caller. We have no database allocating keys —
// dynasty.players is an array, and 38 sites across six files were each doing
// their own `Math.max(...pids) + 1` (one of them, processHonorPlayers, was not
// even doing that: `nextPID || players.length + 1`, which reissues a pid the
// moment a deletion or a merge leaves a gap). Every "the wrong player got the
// movement" bug is downstream of two records sharing a pid.
//
// This module is the single formula. It is deliberately the SAME formula the
// majority of sites already used, so adopting it is behavior-preserving:
//
//     nextFreePid = max( max(existing pids) + 1, dynasty.nextPID || 1 )
//
// dynasty.nextPID is a persisted high-water mark. Callers that mint ids must
// persist the returned nextPID alongside the new players so the mark only
// ever climbs — that is what keeps two devices from re-minting the same
// range after the first one's write lands. (A transactional counter for
// simultaneous writes in a shared league is a later, I/O-level step; the
// high-water mark plus a shared formula closes the common case now.)

export function maxExistingPid(players) {
  let max = 0
  for (const p of players || []) {
    const n = Number(p?.pid)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

/** The next pid that is safe to mint for this dynasty. */
export function nextFreePid(dynasty, players = dynasty?.players) {
  const floor = Number(dynasty?.nextPID)
  return Math.max(maxExistingPid(players) + 1, Number.isFinite(floor) && floor > 0 ? Math.floor(floor) : 1)
}

/**
 * Mint `count` consecutive pids. Returns them plus the high-water mark to
 * persist (`nextPID`), which is one past the last minted id.
 */
export function allocatePids(dynasty, count, players = dynasty?.players) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  const start = nextFreePid(dynasty, players)
  const pids = Array.from({ length: n }, (_, i) => start + i)
  return { pids, nextPID: start + n }
}

/**
 * Incremental form for loops that don't know the count up front:
 *   const alloc = pidAllocator(dynasty); const pid = alloc.next(); ... alloc.nextPID
 */
export function pidAllocator(dynasty, players = dynasty?.players) {
  let cursor = nextFreePid(dynasty, players)
  return {
    next: () => cursor++,
    get nextPID() { return cursor },
  }
}
