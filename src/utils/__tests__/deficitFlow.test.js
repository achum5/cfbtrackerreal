import { describe, it, expect } from 'vitest'
import { computeDeficits, describeDeficit } from '../deficitFlow'

// Running score after each scoring play.
const seq = (...pairs) => pairs.map(([t1, t2]) => ({ t1, t2 }))

describe('computeDeficits', () => {
  it('reports 0 overcome for a team that trailed at the final whistle', () => {
    // The reported bug: UMass 6, Toledo 14 — UMass led early, then lost.
    const r = computeDeficits(seq([3, 0], [6, 0], [6, 7], [6, 14]))
    expect(r.t1Faced).toBe(8)
    expect(r.t1Overcome).toBe(0)
    expect(r.t2Faced).toBe(6)
    expect(r.t2Overcome).toBe(6) // Toledo erased its own 6-point hole
  })

  it('credits a winner with the deficit it erased', () => {
    const r = computeDeficits(seq([0, 14], [7, 14], [14, 14], [21, 14]))
    expect(r.t1Faced).toBe(14)
    expect(r.t1Overcome).toBe(14)
  })

  it('counts getting back to a TIE as overcoming, even if the team later loses', () => {
    const r = computeDeficits(seq([0, 7], [7, 7], [7, 21]))
    expect(r.t1Faced).toBe(14)
    expect(r.t1Overcome).toBe(7)
  })

  it('keeps the largest ERASED run when a team falls behind twice', () => {
    // Down 10, erased; then down 3 at the end, not erased.
    const r = computeDeficits(seq([0, 10], [10, 10], [10, 13]))
    expect(r.t1Faced).toBe(10)
    expect(r.t1Overcome).toBe(10)
  })

  it('reports never-trailed as zero on both counts', () => {
    const r = computeDeficits(seq([7, 0], [14, 0], [21, 3]))
    expect(r.t1Faced).toBe(0)
    expect(r.t1Overcome).toBe(0)
  })

  it('handles a tie game and empty/garbage input', () => {
    const tie = computeDeficits(seq([0, 7], [7, 7]))
    expect(tie.t1Overcome).toBe(7)
    expect(computeDeficits([])).toEqual({ t1Faced: 0, t1Overcome: 0, t2Faced: 0, t2Overcome: 0 })
    expect(computeDeficits(null)).toEqual({ t1Faced: 0, t1Overcome: 0, t2Faced: 0, t2Overcome: 0 })
    expect(computeDeficits([{ t1: NaN, t2: 3 }]).t1Faced).toBe(0)
  })
})

describe('describeDeficit', () => {
  it('says plainly when nothing was overcome', () => {
    expect(describeDeficit('UMass', 8, 0)).toMatch(/NEVER got back to even/)
    expect(describeDeficit('UMass', 8, 0)).toMatch(/overcame no deficit/)
  })
  it('says never trailed when the team never trailed', () => {
    expect(describeDeficit('Toledo', 0, 0)).toBe('Toledo never trailed in this game.')
  })
  it('distinguishes a fully erased deficit from a partly erased one', () => {
    expect(describeDeficit('X', 14, 14)).toMatch(/erased all of it/)
    expect(describeDeficit('X', 14, 7)).toMatch(/actually erased was 7 points/)
  })
  it('uses the singular for one point', () => {
    expect(describeDeficit('X', 1, 0)).toMatch(/1 point /)
  })
})
