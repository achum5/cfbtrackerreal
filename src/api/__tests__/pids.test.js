import { describe, it, expect } from 'vitest'
import { maxExistingPid, nextFreePid, allocatePids, pidAllocator } from '../pids'

describe('nextFreePid', () => {
  it('is one past the highest existing pid when the high-water mark is behind', () => {
    expect(nextFreePid({ nextPID: 3, players: [{ pid: 10 }, { pid: 4 }] })).toBe(11)
  })
  it('honors a higher persisted high-water mark (ids minted elsewhere, not yet visible)', () => {
    expect(nextFreePid({ nextPID: 50, players: [{ pid: 10 }] })).toBe(50)
  })
  it('never reuses a pid after a gap — the processHonorPlayers bug', () => {
    // 3 players but pids up to 40; length+1 would have minted 4, a duplicate.
    const d = { players: [{ pid: 4 }, { pid: 39 }, { pid: 40 }] }
    expect(nextFreePid(d)).toBe(41)
  })
  it('starts at 1 for an empty dynasty and ignores garbage', () => {
    expect(nextFreePid({})).toBe(1)
    expect(nextFreePid({ nextPID: 'x', players: [{ pid: 'abc' }, { pid: null }, {}] })).toBe(1)
    expect(nextFreePid({ nextPID: 2.9, players: [] })).toBe(2)
  })
  it('maxExistingPid tolerates string pids', () => {
    expect(maxExistingPid([{ pid: '7' }, { pid: 3 }])).toBe(7)
  })
})

describe('allocatePids', () => {
  it('mints consecutive ids and returns the mark one past the last', () => {
    const { pids, nextPID } = allocatePids({ nextPID: 5, players: [{ pid: 9 }] }, 3)
    expect(pids).toEqual([10, 11, 12])
    expect(nextPID).toBe(13)
  })
  it('zero count mints nothing and leaves the mark at the free pid', () => {
    expect(allocatePids({ players: [{ pid: 2 }] }, 0)).toEqual({ pids: [], nextPID: 3 })
  })
})

describe('pidAllocator', () => {
  it('increments per call and exposes the mark to persist', () => {
    const a = pidAllocator({ nextPID: 1, players: [{ pid: 6 }] })
    expect(a.next()).toBe(7)
    expect(a.next()).toBe(8)
    expect(a.nextPID).toBe(9)
  })
})
