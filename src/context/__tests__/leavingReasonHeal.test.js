import { describe, it, expect } from 'vitest'
import { healMisfiledLeavingReasons } from '../DynastyContext'

const misfiled = (reason, extra = {}) => ({
  pid: 1, name: 'Senior Guy',
  movementByYear: { 2028: { type: 'departure', departure: 'transfer_out', toTid: null, reason, ...extra } },
})

describe('healMisfiledLeavingReasons', () => {
  it('re-files a "Graduation" transfer_out as graduated', () => {
    const d = { players: [misfiled('Graduation')], playersLeavingByYear: { 2028: [{ pid: 1, playerName: 'Senior Guy', reason: 'Graduation' }] } }
    const h = healMisfiledLeavingReasons(d)
    expect(h.players[0].movementByYear[2028]).toEqual({ type: 'departure', departure: 'graduated' })
    expect(h.playersLeavingByYear[2028][0].reason).toBe('Graduating')
  })

  it('re-files an "NFL Draft" transfer_out as pro_draft', () => {
    const h = healMisfiledLeavingReasons({ players: [misfiled('NFL Draft')] })
    expect(h.players[0].movementByYear[2028]).toEqual({ type: 'departure', departure: 'pro_draft', draftRound: null })
  })

  it('leaves a genuine portal reason alone', () => {
    const d = { players: [misfiled('Playing Time')] }
    expect(healMisfiledLeavingReasons(d)).toBe(d)
  })

  it('leaves a transfer_out with a real destination alone even if the reason says graduation', () => {
    // Transfer Destinations later recorded an actual move — a conflict, not a
    // typo. Do not guess.
    const d = { players: [misfiled('Graduation', { toTid: 42 })] }
    expect(healMisfiledLeavingReasons(d)).toBe(d)
  })

  it('leaves a transfer_out with no reason text alone', () => {
    const p = { pid: 2, name: 'X', movementByYear: { 2028: { type: 'departure', departure: 'transfer_out', toTid: null } } }
    const d = { players: [p] }
    expect(healMisfiledLeavingReasons(d)).toBe(d)
  })

  it('is idempotent and does not mutate its input', () => {
    const d = { players: [misfiled('graduated')] }
    const once = healMisfiledLeavingReasons(d)
    expect(healMisfiledLeavingReasons(once)).toBe(once)
    expect(d.players[0].movementByYear[2028].departure).toBe('transfer_out')
  })

  it('is a no-op on a dynasty with no players', () => {
    const d = { players: [] }
    expect(healMisfiledLeavingReasons(d)).toBe(d)
    expect(healMisfiledLeavingReasons(null)).toBeNull()
  })
})
