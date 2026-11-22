import { describe, it, expect } from 'vitest'
import { diffRoster, applyRosterPatch, rosterKey } from '../rosterPatch'

const player = (eaId, overrides = {}) => ({
  eaId,
  name: `Player ${eaId}`,
  position: 'WR',
  jerseyNumber: '1',
  overall: 70,
  attributes: { Speed: 90, Catching: 80 },
  ...overrides,
})

const byKey = (list) => Object.fromEntries(list.map((p) => [rosterKey(p), p]))

describe('rosterPatch', () => {
  it('turns the newer roster back into the older one exactly', () => {
    const older = [
      player(1, { overall: 80, position: 'TE', attributes: { Speed: 85, Catching: 82 } }),
      player(2),
      player(3, { eaUnlisted: true }),
      { name: 'Legacy Walkon', position: 'K', overall: 55 },
    ]
    const newer = [
      player(1, { overall: 83, position: 'WR', attributes: { Speed: 86, Catching: 82, Release: 70 } }),
      player(2),
      player(4, { overall: 60 }),
      { name: 'Legacy Walkon', position: 'K', overall: 55 },
    ]
    const patch = diffRoster(newer, older)
    expect(patch.remove).toEqual(['ea:4'])
    expect(patch.add.map((p) => p.eaId)).toEqual([3])
    expect(patch.change).toEqual([['ea:1', { position: 'TE', overall: 80, attributes: { Speed: 85, Release: null } }]])

    const rebuilt = applyRosterPatch(newer, patch)
    expect(byKey(rebuilt)).toEqual(byKey(older))
  })

  it('removes a field the older roster did not have', () => {
    const older = [player(5)]
    const newer = [player(5, { eaUnlisted: true })]
    const rebuilt = applyRosterPatch(newer, diffRoster(newer, older))
    expect(rebuilt[0]).toEqual(older[0])
    expect('eaUnlisted' in rebuilt[0]).toBe(false)
  })

  it('returns an empty patch for identical rosters and leaves players untouched', () => {
    const list = [player(1), player(2, { overall: 90 })]
    expect(diffRoster(list, list)).toEqual({})
    expect(applyRosterPatch(list, undefined)).toBe(list)
  })

  it('applies a chain of weekly patches newest first', () => {
    const week1 = [player(1, { overall: 70 }), player(2, { overall: 65 })]
    const week2 = [player(1, { overall: 74 }), player(2, { overall: 65 }), player(9, { overall: 60 })]
    const week3 = [player(1, { overall: 77 }), player(9, { overall: 62 })]
    const chain = [diffRoster(week3, week2), diffRoster(week2, week1)]
    const rebuilt = chain.reduce((list, patch) => applyRosterPatch(list, patch), week3)
    expect(byKey(rebuilt)).toEqual(byKey(week1))
    // Best first, like the bundled files.
    expect(rebuilt.map((p) => p.overall)).toEqual([70, 65])
  })
})
