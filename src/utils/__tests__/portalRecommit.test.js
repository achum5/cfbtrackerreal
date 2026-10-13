import { describe, it, expect } from 'vitest'
import { canonicalizeRecommits } from '../portalRecommit'

const KY = 109, BAMA = 1

describe('canonicalizeRecommits', () => {
  it('rewrites a portal exit followed by the same team as an explicit recommit, keeping the reason', () => {
    const p = {
      teamsByYear: { 2026: KY, 2027: KY },
      movementByYear: { 2026: { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Playing Time' } },
    }
    expect(canonicalizeRecommits(p).movementByYear[2026]).toEqual({ type: 'recommit', reason: 'Playing Time' })
  })

  it('accepts a destination that names the same team, and legacy portal types', () => {
    const toSelf = { teamsByYear: { 2026: KY, 2027: KY }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out', toTid: KY } } }
    expect(canonicalizeRecommits(toSelf).movementByYear[2026]).toEqual({ type: 'recommit' })
    const legacy = { teamsByYear: { 2026: KY, 2027: '109' }, movementByYear: { 2026: { type: 'entered_portal' } } }
    expect(canonicalizeRecommits(legacy).movementByYear[2026].type).toBe('recommit')
  })

  it('leaves real departures alone', () => {
    const transferred = { teamsByYear: { 2026: KY, 2027: BAMA }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out', toTid: BAMA } } }
    expect(canonicalizeRecommits(transferred)).toBe(transferred)
    const gone = { teamsByYear: { 2026: KY }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out' } } }
    expect(canonicalizeRecommits(gone)).toBe(gone)
    const grad = { teamsByYear: { 2026: KY, 2027: KY }, movementByYear: { 2026: { type: 'departure', departure: 'graduated' } } }
    expect(canonicalizeRecommits(grad)).toBe(grad)
    const elsewhere = { teamsByYear: { 2026: KY, 2027: KY }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out', toTid: BAMA } } }
    expect(canonicalizeRecommits(elsewhere)).toBe(elsewhere)
  })

  it('is a no-op for an existing recommit or no movements', () => {
    const p = { teamsByYear: { 2026: KY, 2027: KY }, movementByYear: { 2026: { type: 'recommit' } } }
    expect(canonicalizeRecommits(p)).toBe(p)
    const none = { teamsByYear: { 2026: KY } }
    expect(canonicalizeRecommits(none)).toBe(none)
  })
})
