import { describe, it, expect } from 'vitest'
import { PER_YEAR_FIELDS, PER_TEAM_YEAR_FIELDS, isSeasonalField } from '../seasonSubcollection'

describe('seasonal field routing', () => {
  it('routes lockedCoachingStaffByYear as per-TEAM-year, matching its writers', () => {
    // Written as { [teamAbbr]: { [year]: staff } } by advanceWeek and read
    // back through lookupByTeamYear. On PER_YEAR_FIELDS the splitter ran
    // Number(teamAbbr) over the top level, got NaN, and silently discarded
    // the whole write — then the legacy migration deleted the main-doc copy.
    expect(PER_TEAM_YEAR_FIELDS).toContain('lockedCoachingStaffByYear')
    expect(PER_YEAR_FIELDS).not.toContain('lockedCoachingStaffByYear')
  })

  it('routes playoffPreviewByYear so it cannot grow on the main doc', () => {
    // Multi-KB of generated preview prose per season, previously on neither
    // list — the same unbounded per-year shape that has hit the 1 MiB cap.
    expect(PER_YEAR_FIELDS).toContain('playoffPreviewByYear')
  })

  it('never lists a field on both routing lists', () => {
    const both = PER_YEAR_FIELDS.filter(f => PER_TEAM_YEAR_FIELDS.includes(f))
    expect(both).toEqual([])
  })

  it('treats both repaired fields as seasonal', () => {
    expect(isSeasonalField('lockedCoachingStaffByYear')).toBe(true)
    expect(isSeasonalField('playoffPreviewByYear')).toBe(true)
  })
})
