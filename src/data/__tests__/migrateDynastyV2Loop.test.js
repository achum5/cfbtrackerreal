import { describe, it, expect } from 'vitest'
import { needsV2Migration, migrateDynastyToV2, isCleanButUnstamped } from '../migrateDynastyV2'

// User report: "I keep getting this message every time I login, I have
// saved a backup and hit migrate a few times too." The detector never
// consulted the _schemaVersion stamp migration writes, and two of its rules
// match normal v2 states, so a migrated dynasty re-prompted forever.

// A player whose `team` mirror points at NEXT season's school — exactly what
// the Transfer Destinations save writes at Signing Day. Normal, not legacy.
const driftPlayer = {
  pid: 1, name: 'Portal Guy', position: 'WR', overall: 80,
  team: 99,
  teamsByYear: { 2027: 42, 2028: 99 },
  classByYear: { 2027: 'Jr', 2028: 'Sr' },
  year: 'Jr',
}
// An honor-only record from an awards import. Also normal.
const ghost = { pid: 2, name: 'Award Name', accolades: { 2027: [{ award: 'Heisman' }] } }

describe('needsV2Migration', () => {
  it('never re-prompts a stamped dynasty, even with drift or ghosts present', () => {
    expect(needsV2Migration({ _schemaVersion: 2, currentYear: 2027, players: [driftPlayer, ghost] })).toBe(false)
  })
  it('still flags an UNSTAMPED dynasty with legacy debt', () => {
    const legacy = { pid: 3, name: 'Old', movements: [{ type: 'graduated', year: 2026 }] }
    expect(needsV2Migration({ currentYear: 2027, players: [legacy] })).toBe(true)
  })
  it('isCleanButUnstamped is false once stamped', () => {
    expect(isCleanButUnstamped({ _schemaVersion: 2, players: [] })).toBe(false)
  })
})

describe('migrateDynastyToV2 output passes its own detector', () => {
  const fixtures = {
    drift: driftPlayer,
    legacyMovements: { pid: 4, name: 'A', position: 'QB', overall: 70, movements: [{ type: 'graduated', year: 2026 }], teamsByYear: { 2026: 42 } },
    stringKeys: { pid: 5, name: 'B', position: 'RB', overall: 70, teamsByYear: { '2027': 42 }, classByYear: { '2027': 'So' } },
    emptyTeam: { pid: 6, name: 'C', position: 'TE', overall: 70, teamsByYear: { 2027: 42, 2028: '' } },
    teamHistory: { pid: 7, name: 'D', position: 'LB', overall: 70, teamHistory: [{ teamTid: 42, fromYear: 2026, toYear: 2027 }], teamsByYear: { 2027: 42 } },
    legacyScalars: { pid: 8, name: 'E', position: 'CB', overall: 70, teamsByYear: { 2027: 42 }, leavingYear: 2027, leavingReason: 'Graduating', entryYear: 2024 },
  }
  for (const [label, player] of Object.entries(fixtures)) {
    it(`round-trips a ${label} player to a clean, stamped record`, () => {
      const { dynasty } = migrateDynastyToV2({ currentYear: 2027, players: [player] })
      expect(dynasty._schemaVersion).toBe(2)
      expect(needsV2Migration(dynasty)).toBe(false)
      // And the detector is satisfied on the player content itself, not just
      // the stamp — strip it to prove the mirrors were actually resynced.
      const unstamped = { ...dynasty, _schemaVersion: undefined }
      expect(needsV2Migration(unstamped)).toBe(false)
    })
  }

  it('resyncs the team mirror to the current year, not next season', () => {
    const { dynasty } = migrateDynastyToV2({ currentYear: 2027, players: [driftPlayer] })
    expect(dynasty.players[0].team).toBe(42)
    expect(dynasty.players[0].year).toBe('Jr')
    // Next season's membership is preserved, not trimmed — a transfer is not terminal.
    expect(dynasty.players[0].teamsByYear[2028]).toBe(99)
  })

  it('drops honor-only ghosts', () => {
    const { dynasty, report } = migrateDynastyToV2({ currentYear: 2027, players: [ghost] })
    expect(dynasty.players).toEqual([])
    expect(report.honorOnlyGhostsDropped).toBe(1)
  })
})
