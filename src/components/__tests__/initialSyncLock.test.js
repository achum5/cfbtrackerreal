import { describe, it, expect } from 'vitest'
import { hasPcDynastySynced } from '../../editions'

// Mirrors Layout's needsInitialSync. The lock hides the ENTIRE dynasty area,
// so it must fire only on positive evidence that a PC dynasty has never
// synced — never merely because data hasn't loaded.
const needsInitialSync = (d, { isCfb27Auto, pcDataPending }) => {
  const rosterKnown = Array.isArray(d?.players) && d.players.length > 0
  return isCfb27Auto && !pcDataPending && rosterKnown && !hasPcDynastySynced(d)
}
const PC = { isCfb27Auto: true, pcDataPending: false }

describe('initial-sync lock', () => {
  it('locks a genuinely fresh PC dynasty (seeded roster, no sync fingerprint)', () => {
    const fresh = { players: [{ pid: 1, name: 'Seeded Guy' }] }
    expect(needsInitialSync(fresh, PC)).toBe(true)
  })

  it('does not lock once any player carries the sync fingerprint', () => {
    const synced = { players: [{ pid: 1, cfb27AssetName: 'asset_123' }] }
    expect(needsInitialSync(synced, PC)).toBe(false)
  })

  it('does not lock when the flag is set even with no fingerprints', () => {
    const flagged = { cfb27SyncCompletedOnce: true, players: [{ pid: 1 }] }
    expect(needsInitialSync(flagged, PC)).toBe(false)
  })

  it('regression: never locks on an UNLOADED roster', () => {
    // players live in a subcollection; unloaded reads as [] i.e. "never
    // synced". pcDataPending goes false the moment the 20s watchdog expires
    // — exactly the slow/wedged case it exists for — so this would have
    // locked an established dynasty behind a "run your first sync" screen.
    const stillLoading = { players: [] }
    expect(needsInitialSync(stillLoading, PC)).toBe(false)
    expect(needsInitialSync({}, PC)).toBe(false)
  })

  it('never locks a console dynasty', () => {
    const console = { players: [{ pid: 1 }] }
    expect(needsInitialSync(console, { isCfb27Auto: false, pcDataPending: false })).toBe(false)
  })

  it('does not lock while data is still confirmed-pending', () => {
    const fresh = { players: [{ pid: 1 }] }
    expect(needsInitialSync(fresh, { isCfb27Auto: true, pcDataPending: true })).toBe(false)
  })
})
