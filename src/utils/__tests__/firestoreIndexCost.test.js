import { describe, it, expect } from 'vitest'
import { firestoreIndexEntryBytes, firestoreWriteCost, firestoreDocSize } from '../firestoreSize'
import { isTransactionTooBigError } from '../firestoreErrors'

describe('index-entry cost of a write', () => {
  it('two entries (asc + desc) per leaf value, nested maps included', () => {
    const one = firestoreIndexEntryBytes({ a: 1 })
    expect(one).toBeGreaterThan(0)
    // Every leaf of a nested map is indexed separately.
    expect(firestoreIndexEntryBytes({ m: { x: 1, y: 2, z: 3 } })).toBeGreaterThan(2.5 * one)
  })

  it('one array-contains entry per array element', () => {
    const arr = firestoreIndexEntryBytes({ list: [1, 2, 3, 4] })
    const leaves = firestoreIndexEntryBytes({ m: { a: 1, b: 2, c: 3, d: 4 } })
    expect(arr).toBeLessThan(leaves)
  })

  it('a player with a few seasons of attributes costs many times its own size', () => {
    const attrs = Object.fromEntries(Array.from({ length: 55 }, (_, i) => [`Attr ${i}`, 70]))
    const player = { pid: 1, name: 'Test Player', attributesByYear: { 2026: attrs, 2027: attrs, 2028: attrs } }
    expect(firestoreWriteCost(player)).toBeGreaterThan(5 * firestoreDocSize(player))
  })
})

describe('isTransactionTooBigError', () => {
  it('matches the commit-size rejections, not other errors', () => {
    expect(isTransactionTooBigError({ code: 'invalid-argument', message: 'Transaction too big. Decrease transaction size.' })).toBe(true)
    expect(isTransactionTooBigError(new Error('Request payload size exceeds the limit: 11534336 bytes.'))).toBe(true)
    expect(isTransactionTooBigError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })).toBe(false)
    expect(isTransactionTooBigError(null)).toBe(false)
  })
})
