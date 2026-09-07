import { describe, it, expect } from 'vitest'
import { buildTrainingResultsSave, buildTrainingResultsAttributesSave } from '../trainingResults'

const UK = 109
const dynasty = {
  currentYear: 2028, currentTid: UK,
  teams: { [UK]: { tid: UK, abbr: 'UK', byYear: {} } },
  players: [
    { pid: 1, name: 'Returner', overall: 70, overallByYear: { 2027: 70 } },
    { pid: 2, name: 'Portal Arrival', overall: 75, overallByYear: {} },
    { pid: 3, name: 'Has Prior', overall: 60, overallByYear: { 2027: 61 } },
  ],
}

describe('buildTrainingResultsSave', () => {
  it('sets the new overall for the year and back-fills the prior year only when empty', () => {
    const { updates, updatedCount } = buildTrainingResultsSave(dynasty, [
      { playerName: 'returner', newOverall: 74, pastOverall: 70 },
      { playerName: 'Portal Arrival', newOverall: 78, pastOverall: 75 },
      { playerName: 'Has Prior', newOverall: 63, pastOverall: 99 }, // must NOT overwrite 61
    ])
    expect(updatedCount).toBe(3)
    const byPid = Object.fromEntries(updates.players.map(p => [p.pid, p]))
    expect(byPid[1].overall).toBe(74)
    expect(byPid[1].overallByYear).toEqual({ 2027: 70, 2028: 74 })
    expect(byPid[2].overallByYear).toEqual({ 2027: 75, 2028: 78 })
    expect(byPid[3].overallByYear).toEqual({ 2027: 61, 2028: 63 })
  })
  it('skips rows with neither a new nor a past overall, and unknown names', () => {
    const { updates, updatedCount } = buildTrainingResultsSave(dynasty, [{ playerName: 'Returner' }, { playerName: 'Nobody', newOverall: 80 }])
    expect(updatedCount).toBe(0)
    expect(updates.players).toEqual(dynasty.players)
  })
  it('stores the results for the year in both stores', () => {
    const rows = [{ playerName: 'Returner', newOverall: 74 }]
    const { updates } = buildTrainingResultsSave(dynasty, rows)
    expect(updates.trainingResultsByYear[2028]).toBe(rows)
    expect(updates.teams[UK].byYear[2028].trainingResults).toBe(rows)
  })
})

describe('buildTrainingResultsAttributesSave', () => {
  it('merges attributes for the year and updates overall when given', () => {
    const d = { ...dynasty, players: [{ pid: 1, name: 'Returner', overall: 70, attributesByYear: { 2028: { SPD: 80 } } }] }
    const { updates } = buildTrainingResultsAttributesSave(d, [{ playerName: 'Returner', overall: 76, attributes: { ACC: 85 } }])
    expect(updates.players[0].overall).toBe(76)
    expect(updates.players[0].overallByYear[2028]).toBe(76)
    expect(updates.players[0].attributesByYear[2028]).toEqual({ SPD: 80, ACC: 85 })
  })
  it('ignores an entry with nothing to apply', () => {
    const { updates } = buildTrainingResultsAttributesSave(dynasty, [{ playerName: 'Returner', attributes: {} }])
    expect(updates.players).toEqual(dynasty.players)
  })
})
