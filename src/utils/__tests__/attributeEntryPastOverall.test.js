import { describe, it, expect } from 'vitest'
import { parseAttributeRows, serializeAttributeRows, buildAttributesStructure } from '../attributeEntry'
import { buildTrainingResultsAttributesSave } from '../../api/trainingResults'

// Training Results' full-attributes grid carries a Past OVR column (the
// overall before the "+N" the game shows) right after OVR. Recruit Overalls
// keeps the 8-column shape.

const T = (s) => s.split('\t')

describe('parseAttributeRows with the Past OVR column', () => {
  it('reads the 9-column row', () => {
    const [r] = parseAttributeRows([T('Caden Pinnick\tQB\t78\t73\t12\tImpact\tDual Threat\t90\tAWR 80, THP 88')], { pastOverall: true })
    expect(r.overall).toBe(78)
    expect(r.pastOverall).toBe(73)
    expect(r.jerseyNumber).toBe(12)
    expect(r.devTrait).toBe('Impact')
    expect(r.archetype).toBe('Dual Threat')
    expect(r.nil).toBe(90)
    expect(r.attributes).toEqual({ Awareness: 80, 'Throw Power': 88 })
  })

  it('still reads an older 8-column paste (ratings at index 7)', () => {
    const [r] = parseAttributeRows([T('Caden Pinnick\tQB\t78\t12\tImpact\tDual Threat\t90\tAWR 80')], { pastOverall: true })
    expect(r.pastOverall).toBeNull()
    expect(r.jerseyNumber).toBe(12)
    expect(r.nil).toBe(90)
    expect(r.attributes).toEqual({ Awareness: 80 })
  })

  it('rejects an implausible Past OVR instead of storing it', () => {
    const [far] = parseAttributeRows([T('A B\tQB\t78\t45\t\t\t\t\tAWR 80')], { pastOverall: true })
    expect(far.pastOverall).toBeNull()
    const [low] = parseAttributeRows([T('A B\tQB\t78\t12\t\t\t\t\tAWR 80')], { pastOverall: true })
    expect(low.pastOverall).toBeNull()
  })

  it('round-trips through serializeAttributeRows', () => {
    const entries = [{ playerName: 'A B', position: 'QB', overall: 78, pastOverall: 73, jerseyNumber: 12, devTrait: 'Impact', archetype: 'Dual Threat', nil: 90, attributes: { Awareness: 80 } }]
    const text = serializeAttributeRows(entries, { pastOverall: true })
    expect(text.split('\t')).toHaveLength(9)
    expect(parseAttributeRows(text.split('\n').map(T), { pastOverall: true })).toEqual(entries)
  })

  it('the recruit variant is unchanged: 8 columns, no pastOverall key', () => {
    const [r] = parseAttributeRows([T('A B\tQB\t78\t12\tImpact\tDual Threat\t90\tAWR 80')])
    expect(r).not.toHaveProperty('pastOverall')
    expect(serializeAttributeRows([r]).split('\t')).toHaveLength(8)
    expect(buildAttributesStructure('recruits')).toContain('OUTPUT 8 TAB-SEPARATED COLUMNS')
    expect(buildAttributesStructure('training')).toContain('OUTPUT 9 TAB-SEPARATED COLUMNS')
    expect(buildAttributesStructure('training')).toContain('Past OVR')
  })
})

describe('buildTrainingResultsAttributesSave back-fills the prior year from Past OVR', () => {
  const dynasty = {
    currentYear: 2027,
    players: [
      { pid: 1, name: 'Portal Arrival', overallByYear: { 2027: 70 } },
      { pid: 2, name: 'Has Prior', overallByYear: { 2026: 61, 2027: 65 } },
    ],
  }
  it('fills an empty prior year and never overwrites a recorded one', () => {
    const { updates } = buildTrainingResultsAttributesSave(dynasty, [
      { playerName: 'Portal Arrival', overall: 78, pastOverall: 73, attributes: { Awareness: 80 } },
      { playerName: 'Has Prior', overall: 68, pastOverall: 99, attributes: {} },
    ])
    const byPid = Object.fromEntries(updates.players.map((p) => [p.pid, p]))
    expect(byPid[1].overallByYear).toEqual({ 2027: 78, 2026: 73 })
    expect(byPid[2].overallByYear).toEqual({ 2026: 61, 2027: 68 })
    expect(updates.trainingResultsByYear[2027][0].pastOverall).toBe(73)
  })
})
