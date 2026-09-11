import { describe, it, expect } from 'vitest'
import { applyCommitRows } from '../applyCommitRows'
import { parseRecruitingRow } from '../recruitSheetParse'

// The user's exact report: the class was saved once with blank previous
// schools, then re-saved from the prefilled grid with the schools filled in —
// and every transfer still read "Transfer Portal".

const teams = {
  54: { tid: 54, abbr: 'MASS', name: 'Massachusetts Minutemen', teamName: 'Massachusetts' },
  1: { tid: 1, abbr: 'BAMA', name: 'Alabama Crimson Tide', teamName: 'Alabama' },
}
const OPTS = { commitTeamNames: ['Massachusetts', 'Massachusetts Minutemen', 'MASS'] }
const row = (prev, commit = 'Massachusetts') => parseRecruitingRow([
  'Aubrey Walker', 'RS Fr', 'WR', 'Speedster', '☆☆☆', '412', '20', '55',
  "6'1\"", '190', 'Mobile', 'AL', '', 'Normal', prev, commit, '',
], OPTS)

const save = (rows, players) => applyCommitRows({
  rows, players, selectedTid: 54, teamAbbr: 'MASS', selectedYear: 2026, teams, startPID: 100,
})

describe('applyCommitRows — previous school survives the round trip', () => {
  it('first save with no school: a portal recruit with an origin-less arrival', () => {
    const { players, nextPID } = save([row('')], [])
    expect(players).toHaveLength(1)
    const p = players[0]
    expect(p.pid).toBe(100)
    expect(nextPID).toBe(101)
    expect(p.isPortal).toBe(true)
    expect(p.previousTeam).toBe('')
    expect(p.teamsByYear).toEqual({ 2027: 54 })
    expect(p.movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'transfer_in', fromTid: null })
  })

  it('re-save from the prefilled grid with the school filled in updates the SAME record', () => {
    const first = save([row('')], []).players
    const { players } = save([row('Alabama')], first)
    expect(players).toHaveLength(1)
    const p = players[0]
    expect(p.pid).toBe(100)
    expect(p.previousTeam).toBe(1)
    expect(p.movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'transfer_in', fromTid: 1 })
  })

  it('matches the existing record even when its team is stored as a numeric string', () => {
    const first = save([row('')], []).players.map((p) => ({ ...p, team: '54' }))
    const { players } = save([row('Alabama Crimson Tide')], first)
    expect(players).toHaveLength(1)
    expect(players[0].previousTeam).toBe(1)
    // Not mis-read as a cross-team transfer FROM the user's own team.
    expect(players[0].movementByYear[2026].fromTid).toBe(1)
  })

  it('a later blank re-save keeps the school already entered', () => {
    const first = save([row('Alabama')], []).players
    const { players } = save([row('')], first)
    expect(players[0].previousTeam).toBe(1)
    expect(players[0].movementByYear[2026].fromTid).toBe(1)
  })

  it('a genuine cross-team transfer records the old team as the origin', () => {
    const onBama = [{ pid: 5, name: 'Aubrey Walker', team: 1, teamsByYear: { 2026: 1 }, previousTeam: '' }]
    const { players } = save([row('')], onBama)
    const p = players[0]
    expect(p.team).toBe(54)
    expect(p.teamsByYear[2027]).toBe(54)
    expect(p.movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'transfer_in', fromTid: 1 })
    expect(p.previousTeam).toBe(1)
  })

  it('an HS recruit gets a recruit arrival and no previous school', () => {
    const hs = parseRecruitingRow(['Deon Goodin', 'HS', 'QB', 'Dual Threat', '☆☆☆', '', '', '', '', '', 'Rome', 'GA', '', '', '', 'Massachusetts', ''], OPTS)
    const { players } = save([hs], [])
    expect(players[0].isPortal).toBe(false)
    expect(players[0].previousTeam).toBe('')
    expect(players[0].movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'recruit' })
  })

  it('leaves untouched records by reference so callers can diff', () => {
    const other = { pid: 1, name: 'Someone Else', team: 54 }
    const { players } = save([row('Alabama')], [other])
    expect(players[0]).toBe(other)
  })
})
