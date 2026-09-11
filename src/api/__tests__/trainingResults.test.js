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
    const rows = [{ playerName: 'Returner', newOverall: 74 }, { playerName: 'Nobody', newOverall: 50 }]
    const { updates } = buildTrainingResultsSave(dynasty, rows)
    // Resolved rows are stored with their pid; unresolved rows are stored untouched.
    expect(updates.trainingResultsByYear[2028]).toEqual([{ ...rows[0], pid: 1 }, rows[1]])
    expect(updates.teams[UK].byYear[2028].trainingResults[1]).toBe(rows[1])
  })
  it('resolves a row by pid when the name no longer matches', () => {
    const { updates, updatedCount } = buildTrainingResultsSave(dynasty, [{ playerName: 'Ret.', pid: 1, newOverall: 80 }])
    expect(updatedCount).toBe(1)
    expect(updates.players.find(x => x.pid === 1).overall).toBe(80)
    const attrs = buildTrainingResultsAttributesSave(dynasty, [{ playerName: 'Ret.', pid: 1, overall: 81 }])
    expect(attrs.updates.players.find(x => x.pid === 1).overall).toBe(81)
  })
})

describe('buildTrainingResultsSave — jersey # and dev trait', () => {
  it('applies both, storing dev trait per year the way overall is stored', () => {
    const { updates } = buildTrainingResultsSave(dynasty, [
      { playerName: 'Returner', newOverall: 74, jerseyNumber: 12, devTrait: 'Elite' },
    ])
    const p = updates.players.find(x => x.pid === 1)
    expect(p.jerseyNumber).toBe('12')
    expect(p.devTrait).toBe('Elite')
    expect(p.devTraitByYear[2028]).toBe('Elite')
  })

  it('keeps jersey 0, which is a real number', () => {
    const { updates } = buildTrainingResultsSave(dynasty, [
      { playerName: 'Returner', newOverall: 74, jerseyNumber: 0 },
    ])
    expect(updates.players.find(x => x.pid === 1).jerseyNumber).toBe('0')
  })

  it('leaves the existing values alone when the card was not captured', () => {
    const d = {
      ...dynasty,
      players: [{ pid: 1, name: 'Returner', overall: 70, jerseyNumber: '9', devTrait: 'Star' }],
    }
    const { updates } = buildTrainingResultsSave(d, [
      { playerName: 'Returner', newOverall: 74, jerseyNumber: null, devTrait: null },
    ])
    expect(updates.players[0].jerseyNumber).toBe('9')
    expect(updates.players[0].devTrait).toBe('Star')
    expect(updates.players[0].devTraitByYear).toBeUndefined()
  })

  it('counts a row that carries only a jersey or only a trait', () => {
    expect(buildTrainingResultsSave(dynasty, [{ playerName: 'Returner', jerseyNumber: 3 }]).updatedCount).toBe(1)
    expect(buildTrainingResultsSave(dynasty, [{ playerName: 'Returner', devTrait: 'Impact' }]).updatedCount).toBe(1)
    expect(buildTrainingResultsSave(dynasty, [{ playerName: 'Returner' }]).updatedCount).toBe(0)
  })

  it('applies archetype flat and NIL per season', () => {
    const { updates } = buildTrainingResultsSave(dynasty, [
      { playerName: 'Returner', newOverall: 74, archetype: 'Dual Threat', nil: 250000 },
    ])
    const p = updates.players.find(x => x.pid === 1)
    expect(p.archetype).toBe('Dual Threat')
    expect(p.nilByYear).toEqual({ 2028: 250000 })
  })

  it('keeps a NIL of 0 and leaves other seasons alone', () => {
    const d = { ...dynasty, players: [{ pid: 1, name: 'Returner', overall: 70, nilByYear: { 2027: 5000 } }] }
    const { updates } = buildTrainingResultsSave(d, [{ playerName: 'Returner', newOverall: 74, nil: 0 }])
    expect(updates.players[0].nilByYear).toEqual({ 2027: 5000, 2028: 0 })
  })

  it('counts a row carrying only an archetype or only a NIL', () => {
    expect(buildTrainingResultsSave(dynasty, [{ playerName: 'Returner', archetype: 'Lurker' }]).updatedCount).toBe(1)
    expect(buildTrainingResultsSave(dynasty, [{ playerName: 'Returner', nil: 1000 }]).updatedCount).toBe(1)
  })

  it('merges the year into an existing devTraitByYear rather than replacing it', () => {
    const d = {
      ...dynasty,
      players: [{ pid: 1, name: 'Returner', overall: 70, devTraitByYear: { 2027: 'Normal' } }],
    }
    const { updates } = buildTrainingResultsSave(d, [
      { playerName: 'Returner', newOverall: 74, devTrait: 'Star' },
    ])
    expect(updates.players[0].devTraitByYear).toEqual({ 2027: 'Normal', 2028: 'Star' })
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
    expect(updates.trainingResultsByYear).toBeUndefined()
    expect(updates.teams).toBeUndefined()
  })

  // The week-7 to-do reads trainingResultsByYear, and getTrainingResults reads
  // the team-year mirror FIRST — so the Full Attributes path writes both, or
  // the task stays red and the mirror serves a stale list.
  it('records the completion ledger and the team-year mirror together', () => {
    const { updates } = buildTrainingResultsAttributesSave(dynasty, [
      { playerName: 'returner', position: 'QB', overall: 74, attributes: { ACC: 85 } },
    ])
    const row = { playerName: 'returner', position: 'QB', newOverall: 74, pid: 1 }
    expect(updates.trainingResultsByYear[2028]).toEqual([row])
    expect(updates.teams[UK].byYear[2028].trainingResults).toEqual([row])
  })

  it('keeps the ratings off the ledger row', () => {
    const { updates } = buildTrainingResultsAttributesSave(dynasty, [
      { playerName: 'Returner', overall: 74, attributes: { ACC: 85, SPD: 90 } },
    ])
    expect(updates.trainingResultsByYear[2028][0].attributes).toBeUndefined()
  })

  it('leaves an existing ledger alone when the import matched nobody', () => {
    const withLedger = { ...dynasty, trainingResultsByYear: { 2028: [{ playerName: 'Returner', newOverall: 72 }] } }
    const { updates } = buildTrainingResultsAttributesSave(withLedger, [{ playerName: 'Ghost', overall: 74 }])
    expect(updates.trainingResultsByYear).toBeUndefined()
  })
})
