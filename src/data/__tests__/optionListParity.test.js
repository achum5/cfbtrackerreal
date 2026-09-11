import { describe, it, expect } from 'vitest'
import { ALL_ARCHETYPES, HEIGHTS, POSITIONS, CLASSES, DEV_TRAITS } from '../rosterOptions'
import { STATE_CODES } from '../usStates'

// The Google sheet and the local grid each offer dropdowns for the same
// columns, and for a while each kept its own copy of the values. Four copies
// of the archetype list, two of the heights, five of the state codes. These
// guard the shape of the shared lists the two paths now both read from — a
// silent edit to one of them is a silent change to both entry routes.
describe('shared option lists', () => {
  it('has one archetype list, deduped, covering every position group', () => {
    expect(ALL_ARCHETYPES.length).toBe(45)
    expect(new Set(ALL_ARCHETYPES).size).toBe(ALL_ARCHETYPES.length)
    for (const v of ['Dual Threat', 'Physical Route Runner', 'Lurker', 'Accurate']) {
      expect(ALL_ARCHETYPES).toContain(v)
    }
  })

  it('has the twenty in-game heights, with straight quotes', () => {
    expect(HEIGHTS).toHaveLength(20)
    expect(HEIGHTS[0]).toBe('5\'5"')
    expect(HEIGHTS.at(-1)).toBe('7\'0"')
    expect(HEIGHTS.some(h => h.includes('’') || h.includes('”'))).toBe(false)
  })

  it('keeps the state list at 52, with the international sentinel', () => {
    expect(STATE_CODES).toHaveLength(52)
    expect(STATE_CODES).toContain('Non-US')
  })

  it('keeps the other roster lists intact', () => {
    expect(POSITIONS).toHaveLength(21)
    expect(CLASSES).toEqual(['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr'])
    expect(DEV_TRAITS).toEqual(['Normal', 'Impact', 'Star', 'Elite'])
  })
})
