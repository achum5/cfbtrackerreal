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

// ── Generic stubs, repaired from the leaving list ───────────────────────────
// Before 2026-08-27, re-saving Players Leaving clobbered graduates to the
// generic stub { transfer_out, toTid: null, reason: null }. No reason text
// survives on the movement, but playersLeavingByYear still records the
// user's intent. The original heal needed classByYear[year] === 'Sr', which
// console dynasties often never record — these stubs then sat as "Transfer
// Portal" forever.
const stub = (over = {}) => ({
  pid: 7, name: "D'Andre Smith Jr.",
  movementByYear: { 2028: { type: 'departure', departure: 'transfer_out', toTid: null, reason: null } },
  ...over,
})

describe('healMisfiledLeavingReasons — generic stubs + leaving list', () => {
  it('re-files a stub as graduated when the leaving row for that year says Graduating (by pid)', () => {
    const d = { players: [stub()], playersLeavingByYear: { 2028: [{ pid: 7, playerName: "D'Andre Smith Jr.", reason: 'Graduating' }] } }
    const h = healMisfiledLeavingReasons(d)
    expect(h.players[0].movementByYear[2028]).toEqual({ type: 'departure', departure: 'graduated' })
  })

  it('matches by normalized name when the row has no pid (the silent null-pid save)', () => {
    const d = { players: [stub()], playersLeavingByYear: { 2028: [{ pid: null, playerName: 'DAndre Smith Jr', reason: 'Graduating' }] } }
    const h = healMisfiledLeavingReasons(d)
    expect(h.players[0].movementByYear[2028].departure).toBe('graduated')
  })

  it('re-files a stub as pro_draft when the row says Pro Draft', () => {
    const d = { players: [stub()], playersLeavingByYear: { 2028: [{ pid: 7, playerName: 'x', reason: 'Pro Draft' }] } }
    expect(healMisfiledLeavingReasons(d).players[0].movementByYear[2028].departure).toBe('pro_draft')
  })

  it('does not need classByYear to be Sr', () => {
    const d = { players: [stub({ classByYear: {} })], playersLeavingByYear: { 2028: [{ pid: 7, playerName: 'x', reason: 'Graduating' }] } }
    expect(healMisfiledLeavingReasons(d).players[0].movementByYear[2028].departure).toBe('graduated')
  })

  it('leaves a stub alone when the leaving row is a real portal reason', () => {
    const d = { players: [stub()], playersLeavingByYear: { 2028: [{ pid: 7, playerName: 'x', reason: 'Playing Time' }] } }
    expect(healMisfiledLeavingReasons(d)).toBe(d)
  })

  it('leaves a stub alone when the leaving row is for a DIFFERENT year', () => {
    const d = { players: [stub()], playersLeavingByYear: { 2027: [{ pid: 7, playerName: 'x', reason: 'Graduating' }] } }
    expect(healMisfiledLeavingReasons(d)).toBe(d)
  })

  it('leaves a movement with a genuine portal reason alone even if a row says Graduating', () => {
    const p = stub({ movementByYear: { 2028: { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Playing Time' } } })
    const d = { players: [p], playersLeavingByYear: { 2028: [{ pid: 7, playerName: 'x', reason: 'Graduating' }] } }
    expect(healMisfiledLeavingReasons(d)).toBe(d)
  })
})
