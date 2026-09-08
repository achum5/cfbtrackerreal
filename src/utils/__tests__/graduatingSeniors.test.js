import { describe, it, expect } from 'vitest'
import { hasExhaustedEligibility, pickAutoGraduatingSeniors, classForYear } from '../graduatingSeniors'

// One rule shared by the Players Leaving pre-fill and the season advance.
// Before this, a senior nobody listed was carried into an extra "RS Sr"
// season on member teams, and an RS Sr repeated forever.

const p = (cls, games, extra = {}) => ({
  pid: 1, name: 'Senior Guy',
  classByYear: { 2028: cls },
  statsByYear: games == null ? {} : { 2028: { gamesPlayed: games } },
  ...extra,
})

describe('hasExhaustedEligibility', () => {
  it('RS Sr always graduates, games or not', () => {
    expect(hasExhaustedEligibility(p('RS Sr', null), 2028)).toBe(true)
    expect(hasExhaustedEligibility(p('RS Sr', 0), 2028)).toBe(true)
  })
  it('Sr with 5+ games graduates', () => {
    expect(hasExhaustedEligibility(p('Sr', 5), 2028)).toBe(true)
    expect(hasExhaustedEligibility(p('Sr', 12), 2028)).toBe(true)
  })
  it('Sr with 0-4 games does NOT — that is a redshirt into RS Sr', () => {
    expect(hasExhaustedEligibility(p('Sr', 4), 2028)).toBe(false)
    expect(hasExhaustedEligibility(p('Sr', 0), 2028)).toBe(false)
  })
  it('Sr with unknown games does NOT — never guess a graduation', () => {
    expect(hasExhaustedEligibility(p('Sr', null), 2028)).toBe(false)
  })
  it('underclassmen never graduate by rule', () => {
    for (const c of ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr']) {
      expect(hasExhaustedEligibility(p(c, 12), 2028), c).toBe(false)
    }
  })
  it('reads the class for THAT year, falling back to the top-level class', () => {
    expect(classForYear({ classByYear: { 2027: 'Jr', 2028: 'Sr' }, year: 'Fr' }, 2028)).toBe('Sr')
    expect(classForYear({ year: 'RS Sr' }, 2028)).toBe('RS Sr')
    expect(hasExhaustedEligibility({ year: 'RS Sr' }, 2028)).toBe(true)
  })
  it('accepts string year keys', () => {
    expect(hasExhaustedEligibility({ classByYear: { '2028': 'RS Sr' } }, 2028)).toBe(true)
  })
})

describe('pickAutoGraduatingSeniors', () => {
  it('returns only graduating seniors, name-sorted', () => {
    const roster = [
      { pid: 3, name: 'Zed RSSr', classByYear: { 2028: 'RS Sr' } },
      { pid: 2, name: 'Mid Junior', classByYear: { 2028: 'Jr' }, statsByYear: { 2028: { gamesPlayed: 12 } } },
      { pid: 1, name: 'Abe Senior', classByYear: { 2028: 'Sr' }, statsByYear: { 2028: { gamesPlayed: 9 } } },
    ]
    expect(pickAutoGraduatingSeniors(roster, 2028).map(x => x.name)).toEqual(['Abe Senior', 'Zed RSSr'])
  })
  it('skips honor-only records and open targets', () => {
    const roster = [
      { pid: 1, name: 'Honor', classByYear: { 2028: 'RS Sr' }, isHonorOnly: true },
      { pid: 2, name: 'Target', classByYear: { 2028: 'RS Sr' }, isTarget: true },
    ]
    expect(pickAutoGraduatingSeniors(roster, 2028)).toEqual([])
  })
  it('handles an empty or missing roster', () => {
    expect(pickAutoGraduatingSeniors([], 2028)).toEqual([])
    expect(pickAutoGraduatingSeniors(null, 2028)).toEqual([])
  })
})
