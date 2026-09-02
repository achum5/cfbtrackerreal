import { describe, it, expect } from 'vitest'
import { findRosterPlayerByName } from '../playerMatching'

const roster = [
  { pid: 1, name: "D'Andre Smith Jr." },
  { pid: 2, name: 'Kayden Dixon-Wyatt' },
  { pid: 3, name: 'John Smith' },
  { pid: 4, name: 'John  Smith' }, // double space — normalizes to the same as pid 3
]

describe('findRosterPlayerByName', () => {
  it('exact normalized match wins', () => {
    expect(findRosterPlayerByName(roster, "d'andre smith jr")?.pid).toBe(1)
  })
  it('falls back to a punctuation-blind match', () => {
    expect(findRosterPlayerByName(roster, 'DAndre Smith Jr')?.pid).toBe(1)
    expect(findRosterPlayerByName(roster, 'Kayden Dixon Wyatt')?.pid).toBe(2)
  })
  it('exact match returns the first exact candidate rather than failing on a loose tie', () => {
    // pids 3 and 4 normalize identically; exact path still resolves.
    expect(findRosterPlayerByName(roster, 'John Smith')?.pid).toBe(3)
  })
  it('refuses an ambiguous loose match', () => {
    const r = [{ pid: 1, name: 'A.J. Brown' }, { pid: 2, name: 'AJ Brown' }]
    // Both loose-key to "ajbrown"; "a j brown" matches neither exactly.
    expect(findRosterPlayerByName(r, 'a j brown')).toBeNull()
  })
  it('returns null for no match, blank name, or empty roster', () => {
    expect(findRosterPlayerByName(roster, 'Nobody')).toBeNull()
    expect(findRosterPlayerByName(roster, '')).toBeNull()
    expect(findRosterPlayerByName([], 'John Smith')).toBeNull()
  })
})
