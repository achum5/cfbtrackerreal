import { describe, it, expect } from 'vitest'
import { buildPositionChangesSave } from '../positionChanges'

const UK = 109
const dynasty = {
  currentPhase: 'offseason', currentWeek: 7, currentYear: 2028, currentTid: UK,
  teams: { [UK]: { tid: UK, abbr: 'UK' } },
  positionChangesByYear: { 2026: [] },
  players: [
    { pid: 1, name: 'Mover', position: 'WR', archetype: 'Deep Threat' },
    { pid: 2, name: 'Stayer', position: 'QB', archetype: 'Field General' },
  ],
}
const changes = [
  { playerId: 1, playerName: 'Mover', oldPosition: 'WR', newPosition: 'CB' },
  { playerId: 2, playerName: 'Stayer', oldPosition: 'QB', newPosition: 'QB' }, // no-op
]

describe('buildPositionChangesSave', () => {
  it('records the year (pre-flip season) with the team tid on every row', () => {
    const { year, positionChangesByYear } = buildPositionChangesSave(dynasty, changes)
    expect(year).toBe(2027)
    expect(positionChangesByYear[2027]).toEqual([
      { pid: 1, playerName: 'Mover', oldPosition: 'WR', newPosition: 'CB', team: UK },
      { pid: 2, playerName: 'Stayer', oldPosition: 'QB', newPosition: 'QB', team: UK },
    ])
    expect(positionChangesByYear[2026]).toEqual([])
  })
  it('changedPlayers holds only real changes, with archetype cleared', () => {
    const { changedPlayers } = buildPositionChangesSave(dynasty, changes)
    expect(changedPlayers).toEqual([{ pid: 1, name: 'Mover', position: 'CB', archetype: '' }])
  })
  it('updatedPlayers applies the same change across the full roster and keeps untouched refs', () => {
    const { updatedPlayers } = buildPositionChangesSave(dynasty, changes)
    expect(updatedPlayers[0].position).toBe('CB')
    expect(updatedPlayers[1]).toBe(dynasty.players[1])
  })
})
