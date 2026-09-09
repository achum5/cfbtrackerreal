import { describe, it, expect } from 'vitest'
import { rollOverRosterAtYearFlip, revertRosterYearFlip } from '../seasonRollover'

// Round trip: the offseason wk5→6 year flip followed by revertWeek's wk6→5
// inverse must land every player back where they started. This runs the
// REAL pair over a fixture. Where the pair is NOT symmetric today, the test
// pins the current outcome under a "KNOWN GAP" name so any fix is a
// deliberate flip of the expectation rather than a silent drift.

const USER = 42
const CPU = 77
const PREV = 2030
const NEXT = 2031

const mk = (pid, name, cls, extra = {}) => ({
  pid, name, position: 'WR', year: cls, team: USER,
  teamsByYear: { [PREV]: USER }, classByYear: { [PREV]: cls }, ...extra,
})
const games = (n) => ({ statsByYear: { [PREV]: { gamesPlayed: n } } })

const fixture = () => ({
  id: 'd1', currentYear: PREV, currentPhase: 'offseason', currentWeek: 5,
  currentTid: USER, teamName: 'Indiana Hoosiers',
  teams: {
    [USER]: { tid: USER, abbr: 'IU', name: 'Indiana Hoosiers', byYear: {} },
    [CPU]: { tid: CPU, abbr: 'CPU', name: 'Cpu Team', byYear: {} },
  },
  playersLeavingByYear: { [PREV]: [{ pid: 5, playerName: 'Listed Leaver', reason: 'Pro Draft' }] },
  players: [
    mk(1, 'Fr Starter', 'Fr', { overall: 70, devTrait: 'Normal', overallByYear: { [PREV]: 70 }, devTraitByYear: { [PREV]: 'Normal' }, ...games(12) }),
    mk(2, 'Fr Redshirt', 'Fr', games(2)),
    mk(3, 'Senior Played', 'Sr', games(11)),
    mk(4, 'Rs Senior', 'RS Sr', games(12)),
    mk(5, 'Listed Leaver', 'Jr', games(12)),
    { pid: 6, name: 'Cpu Junior', position: 'QB', year: 'Jr', team: CPU, teamsByYear: { [PREV]: CPU }, classByYear: { [PREV]: 'Jr' } },
    { pid: 7, name: 'Cpu Senior', position: 'QB', year: 'Sr', team: CPU, teamsByYear: { [PREV]: CPU }, classByYear: { [PREV]: 'Sr' } },
    { pid: 8, name: 'New Recruit', position: 'RB', year: 'Fr', isRecruit: true, recruitYear: PREV, team: USER },
    { pid: 9, name: 'Honor Only', isHonorOnly: true, year: 'Sr' },
    { pid: 10, name: 'Stale Flag', position: 'OL', year: 'So', isRecruit: true, team: USER,
      teamsByYear: { 2029: USER, [PREV]: USER }, classByYear: { 2029: 'Fr', [PREV]: 'So' }, ...games(9) },
    { pid: 11, name: 'Transfer Out', position: 'CB', year: 'Jr', team: CPU,
      teamsByYear: { [PREV]: USER, [NEXT]: CPU }, classByYear: { [PREV]: 'Jr', [NEXT]: 'Sr' },
      movementByYear: { [PREV]: { type: 'departure', departure: 'transfer_out', toTid: CPU } } },
  ],
})

// Compare only what the pair is responsible for, and treat an empty map the
// same as an absent one (the revert deletes keys; it does not delete maps).
const view = (p) => {
  const map = (m) => (m && Object.keys(m).length ? m : undefined)
  return {
    year: p.year,
    teamsByYear: map(p.teamsByYear),
    classByYear: map(p.classByYear),
    overallByYear: map(p.overallByYear),
    devTraitByYear: map(p.devTraitByYear),
    movementByYear: map(p.movementByYear),
    isRecruit: p.isRecruit,
  }
}
const byPid = (ps, pid) => ps.find(p => p.pid === pid)

describe('year flip round trip (wk5→6 then wk6→5)', () => {
  const original = fixture()
  const flipped = rollOverRosterAtYearFlip(original, { nextYear: NEXT, previousSeasonYear: PREV, teamTid: USER, classConfirmations: {} }).players
  const reverted = revertRosterYearFlip(
    { ...original, currentYear: NEXT, players: flipped },
    { newSeasonYear: NEXT, previousSeasonYear: PREV, teamTid: USER, teamAbbr: 'IU' },
  ).players

  it('keeps array order and length through both passes', () => {
    expect(reverted.map(p => p.pid)).toEqual(original.players.map(p => p.pid))
  })

  it('restores carried-over players (progressed and redshirted) exactly', () => {
    for (const pid of [1, 2]) {
      expect(view(byPid(reverted, pid))).toEqual(view(byPid(original.players, pid)))
    }
  })

  it('restores rule-graduated seniors: departure removed, class restored', () => {
    for (const pid of [3, 4]) {
      expect(view(byPid(reverted, pid))).toEqual(view(byPid(original.players, pid)))
    }
  })

  it('leaves a listed leaver, a CPU senior, a recruit and an honor-only record untouched (same reference)', () => {
    for (const pid of [5, 7, 8, 9]) {
      expect(byPid(reverted, pid)).toBe(byPid(original.players, pid))
    }
  })

  it('restores a CPU-team player the flip aged', () => {
    expect(view(byPid(reverted, 6))).toEqual(view(byPid(original.players, 6)))
  })

  it('KNOWN GAP: a stale isRecruit flag is advanced by the flip but skipped by the revert', () => {
    // The flip treats isRecruit:true with prior-year roster entries as a
    // roster player (isStaleRecruitFlag); the revert checks the bare flag
    // and returns the player unchanged. Net effect after a round trip: the
    // player keeps next season's class/roster stamps. Harmless for a
    // re-advance (the flip skips players that already have next year), but
    // the pre-flip UI shows the advanced class until then.
    const p = byPid(reverted, 10)
    expect(p).toBe(byPid(flipped, 10))
    expect(p.classByYear[NEXT]).toBe('Jr')
    expect(p.teamsByYear[NEXT]).toBe(USER)
  })

  it('KNOWN GAP: a pre-existing transfer destination for next season is wiped by the revert', () => {
    // The flip never touched this player (already had next season). The
    // revert sees classByYear[NEXT] and strips BOTH next-season stamps
    // anyway, so the Transfer Destinations entry (teamsByYear[NEXT]=CPU,
    // classByYear[NEXT]='Sr') is lost. The movement record survives.
    const before = byPid(original.players, 11)
    const after = byPid(reverted, 11)
    expect(byPid(flipped, 11)).toBe(before)
    expect(after.teamsByYear[NEXT]).toBeUndefined()
    expect(after.classByYear[NEXT]).toBeUndefined()
    expect(after.movementByYear).toEqual(before.movementByYear)
    expect(after.year).toBe('Jr')
  })

  it('KNOWN GAP: a second revert wipes a user-recorded transfer_out for a player with no next-season entries', () => {
    // The revert has two branches. The main one (player HAS a next-season
    // stamp) only clears movements the advance itself writes (graduated,
    // pro_draft, encouraged). The other (player has NO next-season stamp)
    // uses a broader list that includes the bare v2 type 'departure', so a
    // transfer_out with a real destination — written by the user, not the
    // advance — is deleted too. The same branch runs on a FIRST revert for
    // any departed player who never had a next-season slot (a Players
    // Leaving "Transfer" entered before Signing Day), losing that record
    // from the career timeline until the sheet is re-saved. The roster
    // itself stays correct because the leaving list is still honored.
    const again = revertRosterYearFlip(
      { ...original, currentYear: NEXT, players: reverted },
      { newSeasonYear: NEXT, previousSeasonYear: PREV, teamTid: USER, teamAbbr: 'IU' },
    ).players
    const others = (ps) => ps.filter(p => p.pid !== 11)
    expect(others(again)).toEqual(others(reverted))
    expect(byPid(reverted, 11).movementByYear[PREV]).toEqual({ type: 'departure', departure: 'transfer_out', toTid: CPU })
    expect(byPid(again, 11).movementByYear).toEqual({})
  })

  it('a first revert already wipes a pre-flip portal entry that had no destination', () => {
    // Same branch, first pass: Players Leaving "Transfer" written before the
    // flip (transfer_out, toTid null), player not carried, no next-season
    // stamps. Pinned so a fix is a deliberate change.
    const portal = { pid: 20, name: 'Portal Guy', year: 'Jr', team: USER,
      teamsByYear: { [PREV]: USER }, classByYear: { [PREV]: 'Jr' },
      movementByYear: { [PREV]: { type: 'departure', departure: 'transfer_out', toTid: null } } }
    const d = { ...fixture(), players: [portal] }
    const f = rollOverRosterAtYearFlip(d, { nextYear: NEXT, previousSeasonYear: PREV, teamTid: USER, classConfirmations: {} }).players
    expect(f[0]).toBe(portal)
    const r = revertRosterYearFlip({ ...d, currentYear: NEXT, players: f }, { newSeasonYear: NEXT, previousSeasonYear: PREV, teamTid: USER, teamAbbr: 'IU' }).players
    expect(r[0].movementByYear).toEqual({})
  })
})
