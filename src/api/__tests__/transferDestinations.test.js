import { describe, it, expect } from 'vitest'
import { buildTransferDestinationsSave } from '../transferDestinations'

// Characterization tests: these pin the EXACT output the Dashboard handler
// produced before extraction. A change here is a behavior change and must be
// intentional.

const UK = 109, OSU = 79
const dynasty = {
  currentPhase: 'offseason', currentWeek: 6, currentYear: 2028, // post-flip: sheet year = 2027
  currentTid: UK, teamName: 'Kentucky Wildcats',
  teams: { [UK]: { tid: UK, abbr: 'UK', name: 'Kentucky Wildcats', byYear: {} }, [OSU]: { tid: OSU, abbr: 'OSU', name: 'Ohio State Buckeyes' } },
  players: [
    { pid: 1, name: 'Ben Roberts', team: UK, year: 'Jr', overall: 80, devTrait: 'Star',
      teamsByYear: { 2027: UK }, classByYear: { 2027: 'Jr' }, overallByYear: { 2027: 80 } },
    { pid: 2, name: "D'Andre Smith Jr.", team: UK, year: 'So', teamsByYear: { 2027: UK }, classByYear: { 2027: 'So' } },
  ],
}

describe('buildTransferDestinationsSave', () => {
  it('uses the pre-flip year on Signing Day and moves a transfer to the new team next year', () => {
    const { updates, skippedRows, year } = buildTransferDestinationsSave(dynasty, [{ playerName: 'Ben Roberts', newTeam: 'OSU', newTeamTid: OSU }])
    expect(year).toBe(2027)
    expect(skippedRows).toEqual([])
    const p = updates.players.find(x => x.pid === 1)
    expect(p.team).toBe(OSU)
    expect(p.teamsByYear['2028']).toBe(OSU)
    expect(p.movementByYear[2027]).toEqual({ type: 'departure', departure: 'transfer_out', toTid: OSU })
    // Per-year fields advance into the arrival year.
    expect(p.classByYear['2028']).toBe('Sr')
    expect(p.overallByYear['2028']).toBe(80)
    expect(p.devTraitByYear['2028']).toBe('Star')
  })

  it('treats a destination equal to the current team as a recommit', () => {
    const { updates } = buildTransferDestinationsSave(dynasty, [{ playerName: 'Ben Roberts', newTeam: 'UK', newTeamTid: UK }])
    const p = updates.players.find(x => x.pid === 1)
    expect(p.movementByYear[2027]).toEqual({ type: 'recommit' })
    expect(p.teamsByYear['2028']).toBe(UK)
    expect(p.team).toBe(UK)
  })

  it('matches a punctuation-different name when unambiguous', () => {
    const { updates, skippedRows } = buildTransferDestinationsSave(dynasty, [{ playerName: 'DAndre Smith Jr', newTeam: 'OSU', newTeamTid: OSU }])
    expect(skippedRows).toEqual([])
    expect(updates.players.find(x => x.pid === 2).teamsByYear['2028']).toBe(OSU)
  })

  it('skips and reports an unmatched name and an unresolvable team, touching no player', () => {
    const { updates, skippedRows } = buildTransferDestinationsSave(dynasty, [
      { playerName: 'Nobody Here', newTeam: 'OSU', newTeamTid: OSU },
      { playerName: 'Ben Roberts', newTeam: 'ZZZ', newTeamTid: null },
    ])
    expect(skippedRows).toEqual([
      'Nobody Here (no matching player on the roster)',
      'Ben Roberts (could not match team "ZZZ")',
    ])
    expect(updates.players).toEqual(dynasty.players)
  })

  it('writes the destinations to the dual-keyed store and the team byYear slot', () => {
    const rows = [{ playerName: 'Ben Roberts', newTeam: 'OSU', newTeamTid: OSU }]
    const { updates } = buildTransferDestinationsSave(dynasty, rows)
    expect(updates.transferDestinationsByTeamYear.UK[2027]).toBe(rows)
    expect(updates.transferDestinationsByTeamYear[UK][2027]).toBe(rows)
    expect(updates.teams[UK].byYear[2027].transferDestinations).toBe(rows)
  })

  it('does not mutate the input dynasty', () => {
    const snapshot = JSON.stringify(dynasty)
    buildTransferDestinationsSave(dynasty, [{ playerName: 'Ben Roberts', newTeam: 'OSU', newTeamTid: OSU }])
    expect(JSON.stringify(dynasty)).toBe(snapshot)
  })
})
