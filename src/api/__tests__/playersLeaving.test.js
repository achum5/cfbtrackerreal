import { describe, it, expect } from 'vitest'
import { buildPlayersLeavingSave } from '../playersLeaving'

const UK = 109
const dynasty = {
  currentPhase: 'offseason', currentWeek: 1, currentYear: 2027, currentTid: UK, teamName: 'Kentucky Wildcats',
  teams: { [UK]: { tid: UK, abbr: 'UK', name: 'Kentucky Wildcats', byYear: {} } },
  playersLeavingByYear: { 2027: [{ pid: 3, playerName: 'Was Leaving', reason: 'Playing Time' }] },
  players: [
    { pid: 1, name: 'Grad Senior', team: UK, movementByYear: {} },
    { pid: 2, name: 'Drafted Guy', team: UK, movementByYear: { 2027: { type: 'departure', departure: 'pro_draft', draftRound: '2nd Round' } } },
    { pid: 3, name: 'Was Leaving', team: UK, movementByYear: { 2027: { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Playing Time' } } },
    { pid: 4, name: "D'Andre Smith Jr.", team: UK, movementByYear: {} },
  ],
}

describe('buildPlayersLeavingSave', () => {
  it('writes canonical movements per reason, normalizing the typed reason', () => {
    const { updates, unmatchedRows } = buildPlayersLeavingSave(dynasty, [
      { playerName: 'Grad Senior', reason: 'Graduation' },
      { playerName: 'DAndre Smith Jr', reason: 'playing time' },
    ])
    expect(unmatchedRows).toEqual([])
    expect(updates.players.find(p => p.pid === 1).movementByYear[2027]).toEqual({ type: 'departure', departure: 'graduated' })
    expect(updates.players.find(p => p.pid === 4).movementByYear[2027]).toEqual({ type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Playing Time' })
    expect(updates.playersLeavingByYear[2027].map(r => r.reason)).toEqual(['Graduating', 'Playing Time'])
  })

  it('does not clobber a drafted player with a generic portal entry', () => {
    const { updates } = buildPlayersLeavingSave(dynasty, [{ playerName: 'Drafted Guy', reason: 'Pro Potential' }])
    expect(updates.players.find(p => p.pid === 2).movementByYear[2027].departure).toBe('pro_draft')
  })

  it('clears the movement of a player removed from the list', () => {
    const { updates } = buildPlayersLeavingSave(dynasty, [{ playerName: 'Grad Senior', reason: 'Graduating' }])
    expect(updates.players.find(p => p.pid === 3).movementByYear[2027]).toBeUndefined()
  })

  it('reports rows that match no roster player and stores them with a null pid', () => {
    const { updates, unmatchedRows } = buildPlayersLeavingSave(dynasty, [{ playerName: 'Ghost Name', reason: 'Graduating' }])
    expect(unmatchedRows).toEqual(['Ghost Name'])
    expect(updates.playersLeavingByYear[2027][0].pid).toBeNull()
  })

  it('writes all three stores dual-keyed', () => {
    const { updates } = buildPlayersLeavingSave(dynasty, [{ playerName: 'Grad Senior', reason: 'Graduating' }])
    expect(updates.playersLeavingByTeamYear.UK[2027]).toHaveLength(1)
    expect(updates.playersLeavingByTeamYear[UK][2027]).toHaveLength(1)
    expect(updates.teams[UK].byYear[2027].playersLeaving).toHaveLength(1)
  })

  it('does not mutate the input dynasty', () => {
    const snap = JSON.stringify(dynasty)
    buildPlayersLeavingSave(dynasty, [{ playerName: 'Grad Senior', reason: 'Graduating' }])
    expect(JSON.stringify(dynasty)).toBe(snap)
  })
})
