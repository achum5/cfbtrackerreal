import { describe, it, expect } from 'vitest'
import {
  rollOverRosterAtYearFlip,
  appendAutoGraduatedToLeavingStores,
  advanceSeasonPlayers,
} from '../seasonRollover'

// Fixture season walk. These tests run the REAL rollover code (extracted
// verbatim from DynastyContext) over a small league and pin what it does.
// The two rules that matter most for console dynasties are pinned first:
//
//   1. A player's class, roster slot and departure are produced exactly once
//      per transition — re-running a transition over its own output changes
//      nothing (the double-advance safety net).
//   2. Every player the pass does not touch is returned as the SAME object,
//      because the fast-path save finds the changed subset by identity.

const USER = 42   // Indiana (tid 42 in the static registry)
const CPU = 77
const PREV = 2030 // season that just ended
const NEXT = 2031 // season being entered

const mk = (pid, name, cls, extra = {}) => ({
  pid, name, position: 'WR', year: cls,
  team: USER,
  teamsByYear: { [PREV]: USER },
  classByYear: { [PREV]: cls },
  ...extra,
})
const games = (n) => ({ statsByYear: { [PREV]: { gamesPlayed: n } } })

function fixture(overrides = {}) {
  return {
    id: 'd1',
    currentYear: PREV, currentPhase: 'offseason', currentWeek: 5,
    currentTid: USER, teamName: 'Indiana Hoosiers',
    teams: {
      [USER]: { tid: USER, abbr: 'IU', name: 'Indiana Hoosiers', byYear: {} },
      [CPU]: { tid: CPU, abbr: 'CPU', name: 'Cpu Team', byYear: {} },
    },
    playersLeavingByYear: {
      [PREV]: [{ pid: 5, playerName: 'Listed Leaver', reason: 'Pro Draft' }],
    },
    players: [
      mk(1, 'Fr Starter', 'Fr', { overall: 70, devTrait: 'Normal', ...games(12) }),
      mk(2, 'Fr Redshirt', 'Fr', games(2)),
      mk(3, 'Senior Played', 'Sr', games(11)),
      mk(4, 'Rs Senior', 'RS Sr', games(12)),
      mk(5, 'Listed Leaver', 'Jr', games(12)),
      { pid: 6, name: 'Cpu Junior', position: 'QB', year: 'Jr', team: CPU,
        teamsByYear: { [PREV]: CPU }, classByYear: { [PREV]: 'Jr' } },
      { pid: 7, name: 'Cpu Senior', position: 'QB', year: 'Sr', team: CPU,
        teamsByYear: { [PREV]: CPU }, classByYear: { [PREV]: 'Sr' } },
      { pid: 8, name: 'New Recruit', position: 'RB', year: 'Fr', isRecruit: true, recruitYear: PREV, team: USER },
      { pid: 9, name: 'Honor Only', isHonorOnly: true, year: 'Sr' },
      { pid: 10, name: 'Stale Flag', position: 'OL', year: 'So', isRecruit: true, team: USER,
        teamsByYear: { 2029: USER, [PREV]: USER }, classByYear: { 2029: 'Fr', [PREV]: 'So' }, ...games(9) },
      { pid: 11, name: 'Transfer Out', position: 'CB', year: 'Jr', team: CPU,
        teamsByYear: { [PREV]: USER, [NEXT]: CPU }, classByYear: { [PREV]: 'Jr', [NEXT]: 'Sr' },
        movementByYear: { [PREV]: { type: 'departure', departure: 'transfer_out', toTid: CPU } } },
      mk(12, 'Encouraged Guy', 'So', games(8)),
    ],
    ...overrides,
  }
}

const flipInput = { nextYear: NEXT, previousSeasonYear: PREV, teamTid: USER, classConfirmations: {} }
const byPid = (players, pid) => players.find(p => p.pid === pid)

describe('rollOverRosterAtYearFlip (offseason wk5→6)', () => {
  const d = fixture()
  const out = rollOverRosterAtYearFlip(d, flipInput)
  const P = out.players

  it('keeps array order and length', () => {
    expect(P.map(p => p.pid)).toEqual(d.players.map(p => p.pid))
  })

  it('progresses a freshman who played into a sophomore and carries dev/overall forward', () => {
    const p = byPid(P, 1)
    expect(p.year).toBe('So')
    expect(p.classByYear[NEXT]).toBe('So')
    expect(p.teamsByYear[NEXT]).toBe(USER)
    expect(p.overallByYear[NEXT]).toBe(70)
    expect(p.devTraitByYear[NEXT]).toBe('Normal')
  })

  it('redshirts a freshman with 4 or fewer games', () => {
    expect(byPid(P, 2).classByYear[NEXT]).toBe('RS Fr')
    expect(byPid(P, 2).teamsByYear[NEXT]).toBe(USER)
  })

  it('auto-graduates a senior who played and an RS senior, without a roster slot next year', () => {
    for (const pid of [3, 4]) {
      const p = byPid(P, pid)
      expect(p.movementByYear[PREV]).toEqual({ type: 'departure', departure: 'graduated' })
      expect(p.teamsByYear[NEXT]).toBeUndefined()
      expect(p.classByYear[NEXT]).toBeUndefined()
    }
    expect(out.autoGraduated.map(g => g.pid).sort()).toEqual([3, 4])
    expect(out.autoGraduated[0]).toEqual({ pid: 3, playerName: 'Senior Played', tid: USER })
  })

  it('leaves a Players Leaving entry untouched (same reference) and off next season', () => {
    expect(byPid(P, 5)).toBe(byPid(d.players, 5))
  })

  it('ages a CPU-team junior into a senior on the same CPU team', () => {
    const p = byPid(P, 6)
    expect(p.year).toBe('Sr')
    expect(p.classByYear[NEXT]).toBe('Sr')
    expect(p.teamsByYear[NEXT]).toBe(CPU)
  })

  it('drops a CPU-team senior without touching the record', () => {
    expect(byPid(P, 7)).toBe(byPid(d.players, 7))
  })

  it('skips this cycle\'s recruits and honor-only records (same reference)', () => {
    expect(byPid(P, 8)).toBe(byPid(d.players, 8))
    expect(byPid(P, 9)).toBe(byPid(d.players, 9))
  })

  it('treats a stale isRecruit flag on a multi-year player as a roster player', () => {
    const p = byPid(P, 10)
    expect(p.classByYear[NEXT]).toBe('Jr')
    expect(p.teamsByYear[NEXT]).toBe(USER)
  })

  it('does not re-process a player who already has next season (transfer destination)', () => {
    expect(byPid(P, 11)).toBe(byPid(d.players, 11))
  })

  it('reports counts that add up to the roster', () => {
    const c = out.counts
    expect(c.carriedOver).toBe(4)        // 1, 2, 10, 12
    expect(c.notCarriedOver).toBe(3)     // 5 (listed), 3, 4 (rule)
    expect(c.alreadyHadNextYear).toBe(1) // 11
    expect(c.recruitsSkipped).toBe(1)    // 8
    expect(c.honorOnlySkipped).toBe(1)   // 9
    expect(c.otherTeamSkipped).toBe(2)   // 6, 7
  })

  it('is idempotent: a second flip over its own output changes nothing', () => {
    const again = rollOverRosterAtYearFlip({ ...d, players: P }, flipInput)
    expect(again.players).toEqual(P)
    again.players.forEach((p, i) => expect(p).toBe(P[i]))
    expect(again.autoGraduated).toEqual([])
    expect(again.counts.alreadyHadNextYear).toBe(6) // 1, 2, 10, 12 + 11 + the CPU junior
  })

  it('uses a class confirmation when no games are recorded', () => {
    const noStats = fixture({ players: [mk(20, 'Unknown Games', 'Fr')] })
    const rs = rollOverRosterAtYearFlip(noStats, { ...flipInput, classConfirmations: { 20: false } })
    expect(byPid(rs.players, 20).classByYear[NEXT]).toBe('RS Fr')
    const played = rollOverRosterAtYearFlip(noStats, { ...flipInput, classConfirmations: { 20: true } })
    expect(byPid(played.players, 20).classByYear[NEXT]).toBe('So')
  })

  it('graduates a senior with no recorded games when the user confirms they played', () => {
    const noStats = fixture({ players: [mk(21, 'Unknown Senior', 'Sr')] })
    const played = rollOverRosterAtYearFlip(noStats, { ...flipInput, classConfirmations: { 21: true } })
    const p = byPid(played.players, 21)
    expect(p.movementByYear[PREV]).toEqual({ type: 'departure', departure: 'graduated' })
    expect(p.teamsByYear[NEXT]).toBeUndefined()
    expect(played.autoGraduated.map(g => g.pid)).toEqual([21])
    // Confirmed NOT played: a legitimate redshirt into RS Sr, as before.
    const sat = rollOverRosterAtYearFlip(noStats, { ...flipInput, classConfirmations: { 21: false } })
    expect(byPid(sat.players, 21).classByYear[NEXT]).toBe('RS Sr')
    expect(byPid(sat.players, 21).teamsByYear[NEXT]).toBe(USER)
    expect(sat.autoGraduated).toEqual([])
  })

  it('does NOT auto-graduate on a PC dynasty (the save owns the roster)', () => {
    const pc = fixture({ gameEdition: 'cfb27', platform: 'pc' })
    const r = rollOverRosterAtYearFlip(pc, flipInput)
    expect(r.autoGraduated).toEqual([])
    expect(byPid(r.players, 3).teamsByYear[NEXT]).toBe(USER)
  })

  it('still auto-graduates on a console CFB27 dynasty', () => {
    const console27 = fixture({ gameEdition: 'cfb27' })
    const r = rollOverRosterAtYearFlip(console27, flipInput)
    expect(r.autoGraduated.map(g => g.pid).sort()).toEqual([3, 4])
  })
})

describe('appendAutoGraduatedToLeavingStores', () => {
  const d = fixture()
  const { autoGraduated } = rollOverRosterAtYearFlip(d, flipInput)
  const updates = appendAutoGraduatedToLeavingStores(d, autoGraduated, PREV)

  it('appends Graduating rows after the user\'s own rows, in both stores, dual-keyed', () => {
    expect(updates.playersLeavingByYear[PREV].map(r => r.pid)).toEqual([5, 3, 4])
    expect(updates.playersLeavingByYear[PREV][1]).toEqual({ playerName: 'Senior Played', pid: 3, reason: 'Graduating' })
    expect(updates.playersLeavingByTeamYear.IU[PREV].map(r => r.pid)).toEqual([3, 4])
    expect(updates.playersLeavingByTeamYear[USER][PREV].map(r => r.pid)).toEqual([3, 4])
  })

  it('is append-only and idempotent', () => {
    const merged = { ...d, ...updates }
    expect(appendAutoGraduatedToLeavingStores(merged, autoGraduated, PREV)).toEqual({})
    expect(appendAutoGraduatedToLeavingStores(d, [], PREV)).toEqual({})
  })
})

describe('advanceSeasonPlayers (offseason wk8→preseason)', () => {
  // State after the flip, with the year already moved and this cycle's
  // Encourage Transfers rows saved under the new season.
  const flipped = fixture()
  const afterFlip = rollOverRosterAtYearFlip(flipped, flipInput).players
  const d = {
    ...flipped,
    currentYear: NEXT, currentWeek: 8,
    players: afterFlip,
    teams: {
      ...flipped.teams,
      [USER]: { ...flipped.teams[USER], byYear: { [NEXT]: { encourageTransfers: [{ name: 'Encouraged Guy', position: 'WR' }] } } },
    },
  }
  const input = { previousSeasonYear: PREV, currentSeasonYear: NEXT, teamTid: USER, teamAbbr: 'IU' }
  const out = advanceSeasonPlayers(d, input)
  const P = out.players

  it('converts this cycle\'s recruit onto the new-season roster', () => {
    const p = byPid(P, 8)
    expect(p.isRecruit).toBe(false)
    expect(p.teamsByYear[NEXT]).toBe(USER)
    expect(p.classByYear[NEXT]).toBe('Fr')
  })

  it('leaves carried-over players exactly as the flip left them (same reference)', () => {
    for (const pid of [1, 2, 10]) {
      const before = byPid(afterFlip, pid)
      const after = byPid(P, pid)
      expect(after.teamsByYear[NEXT]).toBe(USER)
      expect(after.isRecruit).toBe(false)
      // Only the team/isRecruit normalisation is written; nothing else moves.
      expect({ ...after, team: before.team, isRecruit: before.isRecruit }).toEqual(before)
    }
  })

  it('finalises a transfer destination: team becomes the new tid', () => {
    const p = byPid(P, 11)
    expect(p.team).toBe(CPU)
    expect(p.teamsByYear[NEXT]).toBe(CPU)
  })

  it('records an encouraged transfer under the season that just ended and removes next season\'s slot', () => {
    const p = byPid(P, 12)
    expect(p.teamsByYear[NEXT]).toBeUndefined()
    expect(p.movementByYear[PREV]).toEqual({
      type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Encouraged Transfer',
    })
  })

  it('is a no-op for an encouraged player the save already recorded canonically (same reference)', () => {
    const pre = byPid(afterFlip, 12)
    const already = {
      ...pre,
      teamsByYear: { [PREV]: USER },
      movementByYear: { [PREV]: { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Encouraged Transfer' } },
    }
    const r = advanceSeasonPlayers({ ...d, players: [already] }, input)
    expect(r.players[0]).toBe(already)
  })

  it('keeps graduated seniors and listed leavers off the new season', () => {
    for (const pid of [3, 4, 5]) {
      expect(byPid(P, pid).teamsByYear[NEXT]).toBeUndefined()
    }
  })

  it('does not touch honor-only or CPU-team records (same reference)', () => {
    for (const pid of [6, 7, 9]) expect(byPid(P, pid)).toBe(byPid(afterFlip, pid))
  })

  it('is idempotent: a second pass over its own output changes nothing', () => {
    const again = advanceSeasonPlayers({ ...d, players: P }, input)
    expect(again.players).toEqual(P)
    again.players.forEach((p, i) => expect(p).toBe(P[i]))
  })
})

describe('two-season walk', () => {
  it('chains classes and departures correctly across consecutive offseasons', () => {
    let d = fixture()
    // 2030 → 2031
    d = { ...d, currentYear: NEXT, players: rollOverRosterAtYearFlip(d, flipInput).players }
    d = { ...d, players: advanceSeasonPlayers(d, { previousSeasonYear: PREV, currentSeasonYear: NEXT, teamTid: USER, teamAbbr: 'IU' }).players }
    // 2031 → 2032 (no games recorded for 2031: straight progression, no redshirts)
    const Y2 = NEXT + 1
    const flip2 = rollOverRosterAtYearFlip(d, { nextYear: Y2, previousSeasonYear: NEXT, teamTid: USER, classConfirmations: {} })
    d = { ...d, currentYear: Y2, players: flip2.players }
    d = { ...d, players: advanceSeasonPlayers(d, { previousSeasonYear: NEXT, currentSeasonYear: Y2, teamTid: USER, teamAbbr: 'IU' }).players }

    const P = d.players
    expect(byPid(P, 1).classByYear[Y2]).toBe('Jr')
    expect(byPid(P, 2).classByYear[Y2]).toBe('RS So')
    expect(byPid(P, 8).classByYear[Y2]).toBe('So')      // last cycle's recruit is now a sophomore
    expect(byPid(P, 10).classByYear[Y2]).toBe('Sr')
    // Graduates never come back.
    for (const pid of [3, 4, 5]) expect(byPid(P, pid).teamsByYear[Y2]).toBeUndefined()
    // The CPU junior became a senior in 2031 and is dropped for 2032.
    expect(byPid(P, 6).teamsByYear[Y2]).toBeUndefined()
    // The transfer aged on his new team, then graduated from it.
    expect(byPid(P, 11).teamsByYear[NEXT]).toBe(CPU)
    expect(byPid(P, 11).teamsByYear[Y2]).toBeUndefined()
    // The user's-team roster for 2032 is exactly the five continuing players.
    const roster = P.filter(p => p.teamsByYear?.[Y2] === USER).map(p => p.pid).sort((a, b) => a - b)
    expect(roster).toEqual([1, 2, 8, 10, 12])
    expect(flip2.autoGraduated).toEqual([])
  })
})
