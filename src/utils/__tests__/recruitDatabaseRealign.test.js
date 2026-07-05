import { describe, it, expect } from 'vitest'
import { normalizeRecruitDatabaseRow, normalizeRecruitDatabaseRows } from '../recruitDatabaseRealign'

// An already-aligned 16-cell Recruiting Database row (Name..Attributes).
const alignedRow = [
  'Bryce Young', 'HS', 'QB', 'Dual Threat', '☆☆☆☆☆', '1', '', '',
  "6'2\"", '195', 'Shelby', 'NC', 'Gem', 'Elite', 'OHIO', 'AWR 76, SPD 67',
]

describe('normalizeRecruitDatabaseRow — content tail-sort (Fix #2)', () => {
  it('recovers a dropped empty Dev Trait that slid Prev Team + Attributes left', () => {
    // Aligned would be: 12=Gem 13=(blank Dev, dropped) 14=OHIO 15='AWR 76'.
    // Dropping the blank Dev slid everything after it one column LEFT.
    const shifted = [
      'Slid Dev', 'HS', 'WR', 'Speedster', '☆☆☆☆', '5', '', '',
      "6'0\"", '190', 'Naples', 'FL', 'Gem',
      'OHIO',          // 13 (Dev slot) — really the Prev Team
      'AWR 76, SPD 67', // 14 (Prev Team slot) — really the Attributes
    ]
    const r = normalizeRecruitDatabaseRow(shifted)
    expect(r[12]).toBe('Gem')                 // Gem/Bust
    expect(r[13]).toBe('')                     // Dev (recovered blank)
    expect(r[14]).toBe('OHIO')                 // Prev Team
    expect(r[15]).toBe('AWR 76, SPD 67')       // Attributes
  })

  it('recovers attributes sitting in the wrong slot (Prev Team slot, Dev + Prev blank)', () => {
    const shifted = [
      'Wrong Slot', 'HS', 'CB', 'Field', '☆☆☆', '1800', '', '',
      "5'10\"", '175', 'Nashville', 'TN', '',
      'Awareness 88, Speed 91', // 13 — really the Attributes
    ]
    const r = normalizeRecruitDatabaseRow(shifted)
    expect(r[12]).toBe('')
    expect(r[13]).toBe('')
    expect(r[14]).toBe('')
    expect(r[15]).toBe('Awareness 88, Speed 91')
  })

  it('canonicalizes case-insensitive Gem/Dev and keeps a real Prev Team', () => {
    const shifted = [
      'Case Guy', 'HS', 'WR', 'Speedster', '☆☆☆', '900', '', '',
      "6'0\"", '190', 'Miami', 'FL', 'gem',
      'hidden',  // 13 Dev
      'MICH',    // 14 Prev Team
    ]
    const r = normalizeRecruitDatabaseRow(shifted)
    expect(r[12]).toBe('Gem')
    expect(r[13]).toBe('Hidden')
    expect(r[14]).toBe('MICH')
    expect(r[15]).toBe('')
  })
})

describe('normalizeRecruitDatabaseRow — structural height-shift (Fix #1)', () => {
  it('recovers a dropped St Rank + Pos Rank that pushed Height to index 6', () => {
    // Aligned had blank St Rank(6) and blank Pos Rank(7); dropping both slid
    // Height from index 8 to index 6.
    const shifted = [
      'Height Recruit', 'HS', 'QB', 'Pocket Passer', '☆☆☆☆', '15',
      "6'3\"", '215', 'Austin', 'TX', '', 'Hidden', '', 'AWR 71',
    ]
    const r = normalizeRecruitDatabaseRow(shifted)
    expect(r[6]).toBe('')          // State Rank (reinserted blank)
    expect(r[7]).toBe('')          // Pos Rank (reinserted blank)
    expect(r[8]).toBe("6'3\"")     // Height back at index 8
    expect(r[9]).toBe('215')       // Weight
    expect(r[10]).toBe('Austin')
    expect(r[11]).toBe('TX')
    expect(r[13]).toBe('Hidden')   // Dev
    expect(r[15]).toBe('AWR 71')   // Attributes
  })
})

describe('normalizeRecruitDatabaseRow — safety guarantees', () => {
  it('is a NO-OP on an already-aligned row', () => {
    const r = normalizeRecruitDatabaseRow([...alignedRow])
    expect(r).toEqual(alignedRow)
  })

  it('is idempotent (double-apply is stable)', () => {
    const shifted = [
      'Double Apply', 'HS', 'WR', 'Speedster', '☆☆☆☆', '5', '', '',
      "6'0\"", '190', 'Naples', 'FL', 'Gem', 'OHIO', 'AWR 76, SPD 67',
    ]
    const once = normalizeRecruitDatabaseRow(shifted)
    const twice = normalizeRecruitDatabaseRow(once)
    expect(twice).toEqual(once)
  })

  it('BAILS (leaves the row unchanged) when the tail is ambiguous', () => {
    // Two leftover team-ish cells and no Commitment column to absorb one —
    // impossible to place confidently, so the row must pass through untouched.
    const ambiguous = [
      'Ambiguous', 'HS', 'WR', 'Speedster', '☆☆☆', '900', '', '',
      "6'0\"", '190', 'Miami', 'FL', '', '', 'OHIO', 'MICH',
    ]
    const r = normalizeRecruitDatabaseRow(ambiguous)
    expect(r).toEqual(ambiguous)
  })

  it('passes a non-array row straight through', () => {
    expect(normalizeRecruitDatabaseRow(null)).toBe(null)
    expect(normalizeRecruitDatabaseRow('not a row')).toBe('not a row')
  })
})

describe('normalizeRecruitDatabaseRows — grid mapper', () => {
  it('normalizes each row and skips nameless / non-array rows', () => {
    const grid = [
      [
        'Deon Goodin', 'HS', 'QB', 'Dual Threat', '☆☆☆', '1842', '', '',
        "6'0\"", '181', 'Rome', 'GA', 'Gem', 'OHIO', 'Awareness 61, Speed 75',
      ],
      [''],       // nameless — untouched
      ['  '],     // whitespace name — untouched
    ]
    const out = normalizeRecruitDatabaseRows(grid)
    expect(out[0][13]).toBe('')                          // Dev recovered blank
    expect(out[0][14]).toBe('OHIO')                       // Prev Team
    expect(out[0][15]).toBe('Awareness 61, Speed 75')     // Attributes
    expect(out[1]).toEqual([''])
    expect(out[2]).toEqual(['  '])
  })

  it('passes a non-array input straight through', () => {
    expect(normalizeRecruitDatabaseRows(null)).toBe(null)
    expect(normalizeRecruitDatabaseRows(undefined)).toBe(undefined)
  })
})
