import { describe, it, expect } from 'vitest'
import { findRowPlayerIndex, withRowPid, normalizePlayerName } from '../playerMatching'

const nameEq = (a, b) => normalizePlayerName(a) === normalizePlayerName(b)
const players = [
  { pid: 1, name: 'Alpha One' },
  { pid: 2, name: 'Twin Name' },
  { pid: 3, name: 'Twin Name' },
  { pid: 4, name: 'Recruit', isRecruit: true },
]

describe('findRowPlayerIndex', () => {
  it('a unique name match wins, even over a different pid on the row', () => {
    expect(findRowPlayerIndex(players, { playerName: 'alpha one' }, { nameEq })).toBe(0)
    expect(findRowPlayerIndex(players, { playerName: 'Alpha One', pid: 2 }, { nameEq })).toBe(0)
  })
  it('falls back to the pid when the name matches nobody', () => {
    expect(findRowPlayerIndex(players, { playerName: 'Renamed', pid: 1 }, { nameEq })).toBe(0)
    expect(findRowPlayerIndex(players, { name: 'Renamed', pid: '1' }, { nameEq })).toBe(0)
  })
  it('uses the pid to disambiguate duplicate names, else the first match', () => {
    expect(findRowPlayerIndex(players, { playerName: 'Twin Name', pid: 3 }, { nameEq })).toBe(2)
    expect(findRowPlayerIndex(players, { playerName: 'Twin Name' }, { nameEq })).toBe(1)
    expect(findRowPlayerIndex(players, { playerName: 'Twin Name', pid: 999 }, { nameEq })).toBe(1)
  })
  it('applies the predicate to both name and pid lookups', () => {
    const predicate = (p) => !!p.isRecruit
    expect(findRowPlayerIndex(players, { playerName: 'Alpha One' }, { nameEq, predicate })).toBe(-1)
    expect(findRowPlayerIndex(players, { playerName: 'x', pid: 1 }, { nameEq, predicate })).toBe(-1)
    expect(findRowPlayerIndex(players, { playerName: 'x', pid: 4 }, { nameEq, predicate })).toBe(3)
  })
  it('returns -1 for nothing, and tolerates bad input', () => {
    expect(findRowPlayerIndex(players, { playerName: 'Nobody' }, { nameEq })).toBe(-1)
    expect(findRowPlayerIndex(players, {}, { nameEq })).toBe(-1)
    expect(findRowPlayerIndex(null, { playerName: 'Alpha One' }, { nameEq })).toBe(-1)
    expect(findRowPlayerIndex([null, ...players], { playerName: 'Alpha One' }, { nameEq })).toBe(1)
  })
})

describe('withRowPid', () => {
  it('stamps the pid, and returns the same row when it is already right or there is no player', () => {
    const row = { playerName: 'A' }
    expect(withRowPid(row, { pid: 1 })).toEqual({ playerName: 'A', pid: 1 })
    const stamped = { playerName: 'A', pid: 1 }
    expect(withRowPid(stamped, { pid: 1 })).toBe(stamped)
    expect(withRowPid(stamped, { pid: '1' })).toBe(stamped)
    expect(withRowPid(row, null)).toBe(row)
    expect(withRowPid(row, { pid: null })).toBe(row)
  })
})
