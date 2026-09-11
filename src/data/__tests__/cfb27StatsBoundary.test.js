import { describe, it, expect } from 'vitest'
import {
  boxScoreHasContent,
  lastRegularSeasonWeekWithBoxScore,
  buildBoxScoresForUserGames,
} from '../cfb27SaveSync'

// Regression tests for a real report: on a CFB 27 save-file dynasty,
// "scores, rankings, recruiting all sync — player stat lines never do."
//
// Root cause, confirmed against that user's save: the game writes a week's
// stat slots only when the week ADVANCES. The save's current week had 57
// played games with scores and not one resolvable stat slot across all 138
// teams; every earlier week resolved. The sync set dynasty.currentWeek to
// that week and then sent it to the server as "already synced through", so
// each sync fetched only the one week whose stats did not exist yet and
// skipped forever the week that had just materialized.

const USER = 7
const OPP = 9

const filled = () => ({
  byTid: { [USER]: { passing: [{ playerName: 'A. Guess', comp: 20, attempts: 30, yards: 250, tD: 2, iNT: 0, long: 40 }] }, [OPP]: {} },
  teamStatsByTid: {},
})
const empty = () => ({ byTid: { [USER]: {}, [OPP]: {} }, teamStatsByTid: {} })
const emptyCategories = () => ({
  byTid: { [USER]: { passing: [], rushing: [], receiving: [] }, [OPP]: { passing: [] } },
  teamStatsByTid: {},
})

const userGame = (week, boxScore, extra = {}) => ({
  year: 2026, week, gameType: 'regular', team1Tid: USER, team2Tid: OPP, boxScore, ...extra,
})

describe('boxScoreHasContent', () => {
  it('is true for a player stat line or for team stats', () => {
    expect(boxScoreHasContent(filled())).toBe(true)
    expect(boxScoreHasContent({ byTid: {}, teamStatsByTid: { [USER]: { totalYards: 400 } } })).toBe(true)
  })

  it('is false for the statless shape a mid-week sync produces', () => {
    expect(boxScoreHasContent(empty())).toBe(false)
    expect(boxScoreHasContent(emptyCategories())).toBe(false)
    expect(boxScoreHasContent(null)).toBe(false)
    expect(boxScoreHasContent(undefined)).toBe(false)
  })
})

describe('lastRegularSeasonWeekWithBoxScore', () => {
  it('returns the latest week the user’s game actually holds stats for', () => {
    const dynasty = { games: [userGame(1, filled()), userGame(2, filled()), userGame(3, filled())] }
    expect(lastRegularSeasonWeekWithBoxScore(dynasty, { userTid: USER, year: 2026 })).toBe(3)
  })

  it('returns null with nothing stored — the server then fetches every played week', () => {
    const dynasty = { games: [userGame(1, undefined), userGame(2, null)] }
    expect(lastRegularSeasonWeekWithBoxScore(dynasty, { userTid: USER, year: 2026 })).toBeNull()
    expect(lastRegularSeasonWeekWithBoxScore({ games: [] }, { userTid: USER, year: 2026 })).toBeNull()
    expect(lastRegularSeasonWeekWithBoxScore({}, { userTid: USER, year: 2026 })).toBeNull()
  })

  it('does not count an empty box score — the week the dynasty sits at stays fetchable', () => {
    const dynasty = { games: [userGame(1, filled()), userGame(2, filled()), userGame(3, empty())] }
    expect(lastRegularSeasonWeekWithBoxScore(dynasty, { userTid: USER, year: 2026 })).toBe(2)
  })

  it('ignores a bye: the boundary is the latest stored week, gaps or not', () => {
    // No week-2 game at all; week 3 stored.
    const dynasty = { games: [userGame(1, filled()), userGame(3, filled())] }
    expect(lastRegularSeasonWeekWithBoxScore(dynasty, { userTid: USER, year: 2026 })).toBe(3)
  })

  it('ignores other years, other teams, and the conference championship', () => {
    const dynasty = {
      games: [
        userGame(1, filled()),
        userGame(9, filled(), { year: 2025 }),
        { year: 2026, week: 11, gameType: 'regular', team1Tid: 3, team2Tid: 4, boxScore: filled() },
        userGame(16, filled(), { gameType: 'conference_championship', isConferenceChampionship: true }),
      ],
    }
    expect(lastRegularSeasonWeekWithBoxScore(dynasty, { userTid: USER, year: 2026 })).toBe(1)
  })

  it('tolerates string tids and years, as stored records sometimes carry', () => {
    const dynasty = { games: [{ year: '2026', week: '4', gameType: 'regular', team1Tid: '7', team2Tid: 9, boxScore: filled() }] }
    expect(lastRegularSeasonWeekWithBoxScore(dynasty, { userTid: '7', year: '2026' })).toBe(4)
  })
})

describe('buildBoxScoresForUserGames', () => {
  const RAW = new Map([[100, USER], [200, OPP]])
  const TEAMS = { [USER]: { abbr: 'UMASS' }, [OPP]: { abbr: 'ECU' } }
  const game = (week) => ({
    week, weekType: 'RegularSeason', status: 'HomeWon',
    homeTeamId: 100, awayTeamId: 200, homeTeam: 'Massachusetts', awayTeam: 'East Carolina',
  })
  const passer = { team_id: 100, source: 'offensive', first_name: 'Alex', last_name: 'Guess', raw: { PASSATTEMPTS: 30, PASSCOMPLETED: 20, PASSYARDS: 250, PASSTDS: 2, PASSINTS: 0, PASSLONGEST: 40 } }

  it('emits a week with stats and leaves out a played week whose slots are still empty', () => {
    const parsed = {
      season: { conferenceChampionshipWeek: 15 },
      games: [game(5), game(6)],
      gameStats: {
        computedWeeks: [5, 6],
        teamStatsByWeek: { 5: {}, 6: {} },
        playerStatsByWeek: { 5: [passer], 6: [] },
      },
    }
    const out = buildBoxScoresForUserGames(parsed, RAW, TEAMS, USER)
    expect(Object.keys(out)).toEqual(['5'])
    expect(out[5].byTid[USER].passing[0].playerName).toBe('Alex Guess')
  })

  it('still skips a week the server did not compute this sync', () => {
    const parsed = {
      season: { conferenceChampionshipWeek: 15 },
      games: [game(5)],
      gameStats: { computedWeeks: [6], teamStatsByWeek: {}, playerStatsByWeek: { 5: [passer] } },
    }
    expect(buildBoxScoresForUserGames(parsed, RAW, TEAMS, USER)).toEqual({})
  })
})
