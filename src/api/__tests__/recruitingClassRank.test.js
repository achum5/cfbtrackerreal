import { describe, it, expect } from 'vitest'
import { buildRecruitingClassRankSave } from '../recruitingClassRank'

const UK = 109
const base = { currentTid: UK, teamName: 'Kentucky Wildcats', teams: { [UK]: { tid: UK, abbr: 'UK', name: 'Kentucky Wildcats', byYear: {} } } }

describe('buildRecruitingClassRankSave', () => {
  it('uses the prior season from Signing Day on', () => {
    const { updates, year } = buildRecruitingClassRankSave({ ...base, currentPhase: 'offseason', currentWeek: 6, currentYear: 2028 }, 12)
    expect(year).toBe(2027)
    expect(updates.recruitingClassRankByTeamYear.UK[2027]).toBe(12)
    expect(updates.recruitingClassRankByTeamYear[UK][2027]).toBe(12)
    expect(updates.teams[UK].byYear[2027].recruitingClassRank).toBe(12)
  })
  it('uses the current season before the flip', () => {
    const { year } = buildRecruitingClassRankSave({ ...base, currentPhase: 'offseason', currentWeek: 3, currentYear: 2027 }, 5)
    expect(year).toBe(2027)
  })
  it('preserves other years and teams in the map', () => {
    const d = { ...base, currentPhase: 'regular_season', currentWeek: 1, currentYear: 2027, recruitingClassRankByTeamYear: { UK: { 2026: 30 }, OSU: { 2026: 1 } } }
    const { updates } = buildRecruitingClassRankSave(d, 9)
    expect(updates.recruitingClassRankByTeamYear.UK).toEqual({ 2026: 30, 2027: 9 })
    expect(updates.recruitingClassRankByTeamYear.OSU).toEqual({ 2026: 1 })
  })
})
