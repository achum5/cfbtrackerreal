import { describe, it, expect } from 'vitest'
import { buildDraftResultsSave } from '../draftResults'

const UK = 109
const dynasty = {
  currentYear: 2027, currentTid: UK, teamName: 'Kentucky Wildcats',
  teams: { [UK]: { tid: UK, abbr: 'UK', name: 'Kentucky Wildcats', byYear: {} } },
  players: [
    { pid: 1, name: 'Star QB', movementByYear: { 2027: { type: 'departure', departure: 'transfer_out', toTid: null, reason: null } } },
    { pid: 2, name: 'Backup', movementByYear: {} },
  ],
}

describe('buildDraftResultsSave', () => {
  it('stamps draft year/round and a canonical pro_draft movement, replacing a portal stub', () => {
    const { updates } = buildDraftResultsSave(dynasty, [{ playerName: 'star qb', position: 'QB', overall: 90, draftRound: '1st Round' }])
    const p = updates.players.find(x => x.pid === 1)
    expect(p.draftYear).toBe(2027)
    expect(p.draftRound).toBe('1st Round')
    expect(p.movementByYear[2027]).toEqual({ type: 'departure', departure: 'pro_draft', draftRound: '1st Round' })
    expect(updates.players.find(x => x.pid === 2)).toBe(dynasty.players[1])
  })
  it('stores the pid of the player the save actually updated (case-insensitive, same resolution)', () => {
    const { updates } = buildDraftResultsSave(dynasty, [{ playerName: 'star qb', draftRound: '2nd Round' }])
    expect(updates.draftResultsByTeamYear.UK[2027][0].pid).toBe(1)
    expect(updates.players.find(x => x.pid === 1).draftRound).toBe('2nd Round')
  })
  it('resolves a row by its pid when the name no longer matches, and stores null when nothing matches', () => {
    const { updates } = buildDraftResultsSave(dynasty, [
      { playerName: 'Renamed Guy', pid: 2, draftRound: '3rd Round' },
      { playerName: 'Nobody', draftRound: '4th Round' },
    ])
    expect(updates.players.find(x => x.pid === 2).draftRound).toBe('3rd Round')
    expect(updates.draftResultsByTeamYear.UK[2027].map(r => r.pid)).toEqual([2, null])
  })
  it('writes dual-keyed stores and the team byYear slot', () => {
    const { updates } = buildDraftResultsSave(dynasty, [{ playerName: 'Star QB', draftRound: '1st Round' }])
    expect(updates.draftResultsByTeamYear.UK[2027][0].pid).toBe(1)
    expect(updates.draftResultsByTeamYear[UK][2027][0].pid).toBe(1)
    expect(updates.teams[UK].byYear[2027].draftResults[0].pid).toBe(1)
  })
  it('does not mutate the input', () => {
    const snap = JSON.stringify(dynasty)
    buildDraftResultsSave(dynasty, [{ playerName: 'Star QB', draftRound: '1st Round' }])
    expect(JSON.stringify(dynasty)).toBe(snap)
  })
})
