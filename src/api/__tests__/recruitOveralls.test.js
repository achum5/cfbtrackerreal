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

describe('id-anchored rows', () => {
  it('resolves by pid when the name drifted, still only within this class year', () => {
    const { updates, updatedCount } = buildRecruitOverallsSave(dynasty, [
      { name: 'Signee (WR)', pid: 1, overall: 71 },
      { name: 'Last Year Signee', pid: 2, overall: 70 }, // wrong class year: pid does not bypass the predicate
    ])
    expect(updatedCount).toBe(1)
    expect(updates.players.find(x => x.pid === 1).overall).toBe(71)
    expect(updates.players.find(x => x.pid === 2)).toBe(dynasty.players[1])
    expect(updates.recruitOverallsByYear[2027][0].pid).toBe(1)
    expect(updates.recruitOverallsByYear[2027][1]).toEqual({ name: 'Last Year Signee', pid: 2, overall: 70 })
  })
  it('stamps the resolved pid onto rows matched by name', () => {
    const { updates } = buildRecruitOverallsSave(dynasty, [{ name: 'signee', overall: 68 }])
    expect(updates.recruitOverallsByYear[2027]).toEqual([{ name: 'signee', overall: 68, pid: 1 }])
    const attrs = buildRecruitOverallsAttributesSave(dynasty, [{ playerName: 'Nope', pid: 1, overall: 69 }])
    expect(attrs.updates.players.find(x => x.pid === 1).overall).toBe(69)
  })
})

