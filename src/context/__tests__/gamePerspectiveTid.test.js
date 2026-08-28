import { describe, it, expect } from 'vitest'

// Mirrors the sameTid helper added to DynastyContext for
// getUserGamePerspective. A stored game can carry tids as strings (legacy
// rows, sheet imports) while the tid compared against is a number.
function sameTid(a, b) {
  if (a == null || b == null) return false
  return Number(a) === Number(b)
}

describe('sameTid', () => {
  it('matches across the number/string split', () => {
    expect(sameTid('42', 42)).toBe(true)
    expect(sameTid(42, '42')).toBe(true)
  })

  it('still matches same-typed tids', () => {
    expect(sameTid(42, 42)).toBe(true)
    expect(sameTid('42', '42')).toBe(true)
  })

  it('does not match different teams', () => {
    expect(sameTid(42, 43)).toBe(false)
    expect(sameTid('42', 43)).toBe(false)
  })

  it('never treats an empty slot as tid 0', () => {
    // Number(null) is 0, so a bare Number() compare would make a CFP shell's
    // unfilled opponent slot look like a real team with tid 0.
    expect(sameTid(null, 0)).toBe(false)
    expect(sameTid(undefined, 0)).toBe(false)
    expect(sameTid(0, null)).toBe(false)
  })

  it('matches a real tid 0 against itself', () => {
    expect(sameTid(0, 0)).toBe(true)
    expect(sameTid('0', 0)).toBe(true)
  })
})

// propagateCFPWinner's tie guard: a freshly created CFP game shell is 0-0,
// which passes a null check. Without a tie guard `0 > 0` is false and the
// else-branch handed the bracket slot to team2.
const winnerOf = (s1, s2, t1, t2) => {
  if (s1 === null || s2 === null) return null
  if (s1 === s2) return null
  return s1 > s2 ? t1 : t2
}

describe('CFP winner propagation', () => {
  it('declares no winner for an unscored 0-0 shell', () => {
    expect(winnerOf(0, 0, 'ALA', 'UGA')).toBe(null)
  })

  it('still picks the real winner once scored', () => {
    expect(winnerOf(31, 24, 'ALA', 'UGA')).toBe('ALA')
    expect(winnerOf(24, 31, 'ALA', 'UGA')).toBe('UGA')
  })

  it('waits when a score is missing', () => {
    expect(winnerOf(null, 24, 'ALA', 'UGA')).toBe(null)
  })
})

// Bowl games map onto Top 25 poll slots. week3 was falling through to 17
// (Bowl Week 1), overwriting that week's recorded rank.
const bowlSlot = (bowlWeek) => (bowlWeek === 'week3' ? 19 : bowlWeek === 'week2' ? 18 : 17)

describe('bowl week poll slots', () => {
  it('gives each bowl week its own slot', () => {
    expect(bowlSlot('week1')).toBe(17)
    expect(bowlSlot('week2')).toBe(18)
    expect(bowlSlot('week3')).toBe(19)
  })

  it('defaults an unset bowlWeek to Bowl Week 1', () => {
    expect(bowlSlot(undefined)).toBe(17)
  })
})
