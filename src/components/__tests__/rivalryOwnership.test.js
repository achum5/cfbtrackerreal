import { describe, it, expect } from 'vitest'

// Mirrors RivalriesTab's ownership split. dynasty.rivalries is one FLAT
// array shared by every team; saveRivalries replaces it wholesale.
const ownerOf = (r, currentTid) => (r.tid != null ? Number(r.tid) : Number(currentTid))
const mineOf = (all, myTid, currentTid) =>
  all.filter(r => Number.isFinite(Number(r.rivalTid)) && ownerOf(r, currentTid) === myTid)
const othersOf = (all, myTid, currentTid) =>
  all.filter(r => !Number.isFinite(Number(r.rivalTid)) || ownerOf(r, currentTid) !== myTid)

const CURRENT = 54
const all = [
  { id: 'a', tid: 54, rivalTid: 85 },   // user's own
  { id: 'b', tid: 90, rivalTid: 91 },   // another team's
  { id: 'c', rivalTid: 12 },            // legacy, untagged -> user's
  { id: 'd', tid: 90 },                 // malformed: no rivalTid at all
                                        // (note: rivalTid null would read as team 0 —
                                        // Number(null) is 0 and passes isFinite. That
                                        // predates ownership and is unchanged here.)
]

describe('rivalry ownership', () => {
  it('shows only the viewed team\'s rivalries', () => {
    expect(mineOf(all, 54, CURRENT).map(r => r.id)).toEqual(['a', 'c'])
    expect(mineOf(all, 90, CURRENT).map(r => r.id)).toEqual(['b'])
  })

  it('regression: a mutation preserves every other team\'s entries', () => {
    // saveRivalries replaces the array wholesale — handing it only the
    // viewed team's list deleted the rest of the league's rivalries.
    const myTid = 54
    const mine = mineOf(all, myTid, CURRENT)
    const others = othersOf(all, myTid, CURRENT)
    const afterDelete = [...others, ...mine.filter(r => r.id !== 'a')]
    expect(afterDelete.map(r => r.id).sort()).toEqual(['b', 'c', 'd'])
    expect(afterDelete.find(r => r.id === 'b')).toBeTruthy()
  })

  it('every entry is owned by exactly one side — never dropped, never duplicated', () => {
    for (const myTid of [54, 90, 7]) {
      const mine = mineOf(all, myTid, CURRENT)
      const others = othersOf(all, myTid, CURRENT)
      expect(mine.length + others.length).toBe(all.length)
      const ids = [...mine, ...others].map(r => r.id).sort()
      expect(ids).toEqual(['a', 'b', 'c', 'd'])
    }
  })

  it('keeps malformed rows rather than silently pruning them on save', () => {
    expect(othersOf(all, 90, CURRENT).map(r => r.id)).toContain('d')
  })
})
