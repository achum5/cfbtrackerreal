import { describe, it, expect } from 'vitest'
import { buildIntegrityReport, formatIntegrityReport } from '../integrityReport'

const by = (r, key) => r.sections.find(s => s.key === key)

describe('buildIntegrityReport', () => {
  it('flags duplicate and missing pids', () => {
    const r = buildIntegrityReport({ players: [{ pid: 1, name: 'A' }, { pid: 1, name: 'B' }, { name: 'NoPid' }] })
    const s = by(r, 'duplicatePids')
    expect(s.count).toBe(2)
    expect(s.items.join('\n')).toMatch(/pid 1: "A" and "B"/)
    expect(s.items.join('\n')).toMatch(/1 player record\(s\) with no pid/)
    expect(r.summary.errors).toBeGreaterThan(0)
  })
  it('flags null roster slots and non-year keys', () => {
    const r = buildIntegrityReport({
      players: [{ pid: 1, name: 'A', teamsByYear: { 2027: 42, 2028: null, undefined: 5 } }],
      playersLeavingByYear: { NaN: [] },
    })
    expect(by(r, 'nullRosterSlots').count).toBe(1)
    const keys = by(r, 'badYearKeys')
    expect(keys.count).toBe(2)
    expect(keys.items.join('\n')).toMatch(/teamsByYear has key "undefined"/)
    expect(keys.items.join('\n')).toMatch(/dynasty.playersLeavingByYear has key "NaN"/)
  })
  it('flags portal stubs but not reasoned or resolved transfers', () => {
    const r = buildIntegrityReport({ players: [
      { pid: 1, name: 'Stub', movementByYear: { 2027: { type: 'departure', departure: 'transfer_out', toTid: null, reason: null } } },
      { pid: 2, name: 'Reasoned', movementByYear: { 2027: { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Playing Time' } } },
      { pid: 3, name: 'Resolved', movementByYear: { 2027: { type: 'departure', departure: 'transfer_out', toTid: 9 } } },
    ] })
    expect(by(r, 'portalStubs').count).toBe(1)
  })
  it('flags mirror drift for the current year only', () => {
    const r = buildIntegrityReport({ currentYear: 2028, players: [
      { pid: 1, name: 'Drift', team: 99, year: 'Jr', teamsByYear: { 2028: 42 }, classByYear: { 2028: 'Sr' } },
      { pid: 2, name: 'Fine', team: 42, year: 'Sr', teamsByYear: { 2028: 42 }, classByYear: { 2028: 'Sr' } },
    ] })
    expect(by(r, 'mirrorDrift').count).toBe(2)
  })
  it('flags leaving rows with null pid or a non-canonical reason', () => {
    const r = buildIntegrityReport({ playersLeavingByYear: { 2027: [
      { pid: null, playerName: 'Ghost', reason: 'Graduating' },
      { pid: 3, playerName: 'Typo', reason: 'Graduation' },
      { pid: 4, playerName: 'Ok', reason: 'Pro Draft' },
    ] } })
    expect(by(r, 'leavingRows').count).toBe(2)
  })
  it('flags duplicate games by matchup regardless of team order', () => {
    const r = buildIntegrityReport({ games: [
      { id: 'a', year: 2027, week: 3, team1Tid: 1, team2Tid: 2 },
      { id: 'b', year: 2027, week: 3, team1Tid: 2, team2Tid: 1 },
      { id: 'c', year: 2027, week: 4, team1Tid: 1, team2Tid: 2 },
    ] })
    expect(by(r, 'duplicateGames').count).toBe(1)
  })
  it('caps items but reports the full count', () => {
    const players = Array.from({ length: 40 }, (_, i) => ({ pid: i + 1, name: `P${i}`, teamsByYear: { 2028: null } }))
    const s = by(buildIntegrityReport({ players }), 'nullRosterSlots')
    expect(s.count).toBe(40)
    expect(s.items.length).toBe(25)
    expect(formatIntegrityReport({ sections: [s], summary: { players: 40, games: 0, errors: 40, warnings: 0, currentYear: null } })).toMatch(/and 15 more/)
  })
  it('is clean on a healthy dynasty', () => {
    const r = buildIntegrityReport({ currentYear: 2028, currentTid: 42, players: [{ pid: 1, name: 'A', team: 42, year: 'Sr', teamsByYear: { 2028: 42 }, classByYear: { 2028: 'Sr' } }], games: [] })
    expect(r.summary.errors).toBe(0)
    expect(r.summary.warnings).toBe(0)
  })
  it('tolerates a null dynasty', () => {
    expect(buildIntegrityReport(null).summary.players).toBe(0)
  })
})
