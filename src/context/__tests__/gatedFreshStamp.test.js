import { describe, it, expect } from 'vitest'

// Mirrors gatedFreshOptions in DynastyContext: the sync stamp must only be
// written when the consumer actually APPLIED the fresh payload. Consumers
// drop a result on purpose (listener-skip window during a local save, or a
// read that started before our own write) by returning false.
function makeGate(stamps) {
  return function gatedFreshOptions(dynastyId, collectionName, rev, onFresh) {
    const key = `${dynastyId}::${collectionName}`
    if (rev > 0 && stamps.get(key) === rev) return {}
    if (!onFresh) return {}
    return {
      onFresh: (fresh, meta) => {
        const applied = onFresh(fresh, meta)
        if (rev > 0 && applied !== false) stamps.set(key, rev)
      },
    }
  }
}

describe('gated fresh-read stamping', () => {
  it('stamps after an applied fresh read, then serves cache-only at that rev', () => {
    const stamps = new Map()
    const gate = makeGate(stamps)
    const opts = gate('d1', 'games', 100, () => { /* applied */ })
    opts.onFresh([], {})
    expect(stamps.get('d1::games')).toBe(100)
    expect(gate('d1', 'games', 100, () => {})).toEqual({})
  })

  it('regression: a DROPPED apply must not stamp — the next fire re-reads', () => {
    // This is the cross-device stale-recap bug: the phone's background read
    // completed, the apply was dropped by the listener-skip window, and the
    // pre-fix stamp still marked games "synced at this rev" — locking the
    // phone into cache-only mode for that rev across reopens.
    const stamps = new Map()
    const gate = makeGate(stamps)
    const opts = gate('d1', 'games', 100, () => false /* dropped */)
    opts.onFresh([], {})
    expect(stamps.has('d1::games')).toBe(false)
    const retry = gate('d1', 'games', 100, () => {})
    expect(typeof retry.onFresh).toBe('function')
  })

  it('a new rev always re-reads even after a stamped one', () => {
    const stamps = new Map()
    const gate = makeGate(stamps)
    gate('d1', 'games', 100, () => {}).onFresh([], {})
    const next = gate('d1', 'games', 101, () => {})
    expect(typeof next.onFresh).toBe('function')
  })

  it('legacy docs with no timestamp (rev 0) never stamp and never gate', () => {
    const stamps = new Map()
    const gate = makeGate(stamps)
    const opts = gate('d1', 'games', 0, () => {})
    opts.onFresh([], {})
    expect(stamps.has('d1::games')).toBe(false)
  })
})
