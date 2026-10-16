import { describe, it, expect } from 'vitest'
import { getTeamRankForWeek, getTeamRanking, applyGameRanksToTeams, isShadowedPollRank } from '../DynastyContext'

// Regression tests for "my team is always ranked #19, our preseason ranking,
// despite being unranked in every weekly poll".
//
// Poll saves write ranks only for the teams IN the poll; they never mark the
// teams that fell out. The per-week lookup carried a team's last entry
// forward, so a team ranked in the preseason poll kept that rank all season.
// The game editor pre-filled it, and saving the game wrote it back into that
// week's poll as a phantom duplicate.

const YEAR = 2028
const ECU = 1 // the user's team: #19 preseason, then out of the poll
const UTAH = 2 // the real #19 in the weekly polls

// A full 25-team poll for `week`: tids 100.. fill every rank except the ones
// given explicitly in `fixed` ({ tid: rank }).
const buildTeams = (polls) => {
  const teams = {}
  const put = (tid, week, rank) => {
    teams[tid] = teams[tid] || { abbr: `T${tid}`, byYear: { [YEAR]: { rankByWeek: {} } } }
    teams[tid].byYear[YEAR].rankByWeek[week] = rank
  }
  for (const [week, fixed] of Object.entries(polls)) {
    const taken = new Set(Object.values(fixed))
    for (const [tid, rank] of Object.entries(fixed)) put(Number(tid), Number(week), rank)
    let filler = 100
    for (let r = 1; r <= 25; r++) {
      if (taken.has(r)) continue
      put(filler++, Number(week), r)
    }
  }
  return teams
}

const dynasty = (teams, games = []) => ({ currentYear: YEAR, currentPhase: 'regular_season', currentWeek: 4, teams, games })

describe('getTeamRankForWeek — a newer poll replaces an older rank', () => {
  const teams = buildTeams({
    0: { [ECU]: 19 },
    1: { [UTAH]: 19 },
    2: { [UTAH]: 19 },
    3: { [UTAH]: 19 },
  })

  it('the preseason rank still applies to the preseason week', () => {
    expect(getTeamRankForWeek(dynasty(teams), ECU, YEAR, 0)).toBe(19)
  })

  it('a team missing from a later full poll is unranked, not stuck at its preseason rank', () => {
    expect(getTeamRankForWeek(dynasty(teams), ECU, YEAR, 1)).toBe(null)
    expect(getTeamRankForWeek(dynasty(teams), ECU, YEAR, 3)).toBe(null)
    // Week 4 has no poll yet: the latest poll (week 3) is the one that stands.
    expect(getTeamRankForWeek(dynasty(teams), ECU, YEAR, 4)).toBe(null)
  })

  it('teams in the polls are unaffected', () => {
    expect(getTeamRankForWeek(dynasty(teams), UTAH, YEAR, 3)).toBe(19)
    expect(getTeamRankForWeek(dynasty(teams), UTAH, YEAR, 4)).toBe(19)
  })

  it('with no newer poll, a rank still carries forward', () => {
    const preOnly = buildTeams({ 0: { [ECU]: 19 } })
    expect(getTeamRankForWeek(dynasty(preOnly), ECU, YEAR, 3)).toBe(19)
  })

  it('a week holding only a couple of game-save ranks is not a poll', () => {
    const t = buildTeams({ 1: { [UTAH]: 19 } })
    // A single game save wrote two ranks into week 2.
    t[500] = { abbr: 'X', byYear: { [YEAR]: { rankByWeek: { 2: 7 } } } }
    t[501] = { abbr: 'Y', byYear: { [YEAR]: { rankByWeek: { 2: 9 } } } }
    expect(getTeamRankForWeek(dynasty(t), UTAH, YEAR, 2)).toBe(19)
    expect(getTeamRankForWeek(dynasty(t), UTAH, YEAR, 3)).toBe(19)
  })
})

describe('phantom duplicates written by a game save', () => {
  // ECU's game saves wrote #19 into weeks 1-3, where Utah is the poll's #19.
  const teams = buildTeams({
    0: { [ECU]: 19 },
    1: { [UTAH]: 19 },
    2: { [UTAH]: 19 },
    3: { [UTAH]: 19 },
  })
  for (const w of [1, 2, 3]) teams[ECU].byYear[YEAR].rankByWeek[w] = 19
  const games = [1, 2, 3].map(w => ({
    id: `g${w}`, year: YEAR, week: w, team1Tid: ECU, team2Tid: 300 + w, team1Rank: 19, team2Rank: null,
  }))
  const d = dynasty(teams, games)

  it('the game-written duplicate loses to the poll entry', () => {
    expect(isShadowedPollRank(d, ECU, YEAR, 3, 19)).toBe(true)
    expect(isShadowedPollRank(d, UTAH, YEAR, 3, 19)).toBe(false)
    expect(getTeamRankForWeek(d, ECU, YEAR, 3)).toBe(null)
    expect(getTeamRankForWeek(d, ECU, YEAR, 4)).toBe(null)
    expect(getTeamRankForWeek(d, UTAH, YEAR, 3)).toBe(19)
  })

  it('the team page rank ignores it too', () => {
    const d3 = { ...d, currentWeek: 3 }
    expect(getTeamRanking(d3, ECU, YEAR)).toBe(null)
    expect(getTeamRanking(d3, UTAH, YEAR)?.rank).toBe(19)
  })
})

describe('applyGameRanksToTeams — no new phantoms', () => {
  const teams = buildTeams({ 0: { [ECU]: 19 }, 4: { [UTAH]: 19 } })

  it('skips a rank another team already holds in that week\'s poll', () => {
    const next = applyGameRanksToTeams(dynasty(teams), {
      year: YEAR, week: 4, team1Tid: ECU, team2Tid: 999, team1Rank: 19, team2Rank: null,
    })
    expect(next[ECU].byYear[YEAR].rankByWeek[4]).toBeUndefined()
  })

  it('still writes ranks for a week without a poll', () => {
    const next = applyGameRanksToTeams(dynasty(teams), {
      year: YEAR, week: 5, team1Tid: ECU, team2Tid: 999, team1Rank: 12, team2Rank: null,
    })
    expect(next[ECU].byYear[YEAR].rankByWeek[5]).toBe(12)
  })
})
