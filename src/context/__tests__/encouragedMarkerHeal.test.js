import { describe, it, expect } from 'vitest'
import { healDuplicateEncouragedMarkers } from '../DynastyContext'

const MARKER = { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Encouraged Transfer' }
const USER = 42

describe('healDuplicateEncouragedMarkers', () => {
  it('drops the new-season copy when the ended-season copy is present and the player is off the roster', () => {
    const d = { players: [{ pid: 1, teamsByYear: { 2030: USER }, movementByYear: { 2030: { ...MARKER }, 2031: { ...MARKER } } }] }
    const out = healDuplicateEncouragedMarkers(d)
    expect(out.players[0].movementByYear).toEqual({ 2030: MARKER })
    expect(out).not.toBe(d)
  })

  it('handles string keys', () => {
    const d = { players: [{ pid: 1, teamsByYear: { '2030': USER }, movementByYear: { '2030': { ...MARKER }, '2031': { ...MARKER } } }] }
    expect(healDuplicateEncouragedMarkers(d).players[0].movementByYear).toEqual({ '2030': MARKER })
  })

  it('is a fixed point (idempotent, same reference when nothing to do)', () => {
    const d = { players: [{ pid: 1, teamsByYear: { 2030: USER }, movementByYear: { 2030: { ...MARKER }, 2031: { ...MARKER } } }] }
    const once = healDuplicateEncouragedMarkers(d)
    const twice = healDuplicateEncouragedMarkers(once)
    expect(twice).toBe(once)
    expect(twice.players[0]).toBe(once.players[0])
  })

  it('leaves a lone marker alone under either key', () => {
    for (const y of [2030, 2031]) {
      const d = { players: [{ pid: 1, teamsByYear: { 2030: USER }, movementByYear: { [y]: { ...MARKER } } }] }
      expect(healDuplicateEncouragedMarkers(d)).toBe(d)
    }
  })

  it('keeps the later entry when the player actually played that later season', () => {
    const d = { players: [{ pid: 1, teamsByYear: { 2030: USER, 2031: 77 }, movementByYear: { 2030: { ...MARKER }, 2031: { ...MARKER } } }] }
    expect(healDuplicateEncouragedMarkers(d)).toBe(d)
  })

  it('never touches entries that are not the exact marker (destination set, other reason, other shape)', () => {
    const cases = [
      { 2030: { ...MARKER }, 2031: { ...MARKER, toTid: 77 } },
      { 2030: { ...MARKER }, 2031: { ...MARKER, reason: 'Playing Time' } },
      { 2030: { ...MARKER, toTid: 77 }, 2031: { ...MARKER } },
      { 2030: { type: 'departure', departure: 'graduated' }, 2031: { ...MARKER } },
    ]
    for (const movementByYear of cases) {
      const d = { players: [{ pid: 1, teamsByYear: { 2030: USER }, movementByYear }] }
      expect(healDuplicateEncouragedMarkers(d)).toBe(d)
    }
  })

  it('tolerates missing or malformed players', () => {
    expect(healDuplicateEncouragedMarkers({})).toEqual({})
    const d = { players: [null, { pid: 2 }, { pid: 3, movementByYear: 'bad' }] }
    expect(healDuplicateEncouragedMarkers(d)).toBe(d)
  })
})
