import { describe, it, expect } from 'vitest'
import { buildRecruitOverallsSave, buildRecruitOverallsAttributesSave } from '../recruitOveralls'

const dynasty = {
  currentPhase: 'offseason', currentWeek: 6, currentYear: 2028, // post-flip: class year 2027, freshman year 2028
  players: [
    { pid: 1, name: 'Signee', isRecruit: true, recruitYear: 2027, overallByYear: {} },
    { pid: 2, name: 'Last Year Signee', isRecruit: true, recruitYear: 2026, overallByYear: {} },
    { pid: 3, name: 'Vet', isRecruit: false, overallByYear: {} },
  ],
}

describe('buildRecruitOverallsSave', () => {
  it('updates only this class year’s recruits, into their freshman year', () => {
    const { updates, updatedCount, year } = buildRecruitOverallsSave(dynasty, [
      { name: 'signee', overall: 68, jerseyNumber: '4' },
      { name: 'Last Year Signee', overall: 70 },
      { name: 'Vet', overall: 90 },
    ])
    expect(year).toBe(2027)
    expect(updatedCount).toBe(1)
    const p = updates.players.find(x => x.pid === 1)
    expect(p.overall).toBe(68)
    expect(p.overallByYear).toEqual({ 2028: 68 })
    expect(p.jerseyNumber).toBe('4')
    expect(updates.players.find(x => x.pid === 3).overallByYear).toEqual({})
    expect(updates.recruitOverallsByYear[2027]).toHaveLength(3)
  })
  it('skips a row with no overall', () => {
    const { updatedCount } = buildRecruitOverallsSave(dynasty, [{ name: 'Signee', overall: 0 }])
    expect(updatedCount).toBe(0)
  })
})

describe('buildRecruitOverallsAttributesSave', () => {
  it('merges attributes into the freshman year for the matching recruit only', () => {
    const { updates } = buildRecruitOverallsAttributesSave(dynasty, [{ playerName: 'Signee', overall: 66, attributes: { SPD: 88 } }])
    const p = updates.players.find(x => x.pid === 1)
    expect(p.overallByYear[2028]).toBe(66)
    expect(p.attributesByYear[2028]).toEqual({ SPD: 88 })
    expect(updates.players.find(x => x.pid === 2)).toBe(dynasty.players[1])
  })
})
