import { describe, it, expect } from 'vitest'
import { parseNationalCommitRows } from '../NationalCommitsModal'

const existing = [
  { pid: 41, name: 'Marcus Vaughn', position: 'QB', stars: 5, committedTo: 'Alabama' },
]

describe('parseNationalCommitRows', () => {
  it('reads a full row', () => {
    expect(parseNationalCommitRows([['Dane Rios', 'wr', '4', 'Ohio State']], [])).toEqual([
      { pid: null, name: 'Dane Rios', position: 'WR', stars: 4, committedTo: 'Ohio State' },
    ])
  })

  it('re-attaches the pid of a recruit already tracked, so a re-import edits instead of duplicating', () => {
    const [row] = parseNationalCommitRows([['marcus  vaughn', 'QB', '5', 'Georgia']], existing)
    expect(row.pid).toBe(41)
    expect(row.committedTo).toBe('Georgia')
  })

  it('leaves a new name unlinked', () => {
    expect(parseNationalCommitRows([['Someone Else', 'HB', '3', 'LSU']], existing)[0].pid).toBeNull()
  })

  it('strips a star glyph and rejects an out-of-range count', () => {
    expect(parseNationalCommitRows([['A B', 'S', '5★', 'Texas']], [])[0].stars).toBe(5)
    expect(parseNationalCommitRows([['A B', 'S', '9', 'Texas']], [])[0].stars).toBeNull()
    expect(parseNationalCommitRows([['A B', 'S', '', 'Texas']], [])[0].stars).toBeNull()
  })

  it('keeps a row that only has a name, and drops one with none', () => {
    expect(parseNationalCommitRows([['Lone Name']], [])).toEqual([
      { pid: null, name: 'Lone Name', position: '', stars: null, committedTo: '' },
    ])
    expect(parseNationalCommitRows([['   ', 'QB', '4', 'Miami']], [])).toEqual([])
  })

  it('handles an empty paste', () => {
    expect(parseNationalCommitRows([], existing)).toEqual([])
  })
})
