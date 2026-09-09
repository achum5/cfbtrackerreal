import { describe, it, expect } from 'vitest'
import { getPlayersNeedingClassConfirmation } from '../DynastyContext'

// Who gets the Signing Day "Played 5+ games?" prompt. Pure and exported;
// pinned so the modal's audience cannot drift silently.

const USER = 42
const Y = 2030
const base = () => ({
  currentYear: Y, currentTid: USER, teamName: 'Indiana Hoosiers',
  teams: { [USER]: { tid: USER, abbr: 'IU', name: 'Indiana Hoosiers' } },
  games: [],
})
const roster = (pid, name, cls, extra = {}) => ({
  pid, name, position: 'WR', year: cls, teamsByYear: { [Y]: USER }, classByYear: { [Y]: cls }, ...extra,
})
const pids = (d) => getPlayersNeedingClassConfirmation(d).map(p => p.pid)

describe('getPlayersNeedingClassConfirmation', () => {
  it('asks about roster players with no recorded games, seniors included', () => {
    const d = { ...base(), players: [roster(1, 'A Fr', 'Fr'), roster(2, 'B Sr', 'Sr'), roster(3, 'C Jr', 'Jr', { statsByYear: { [Y]: { gamesPlayed: 0 } } })] }
    expect(pids(d)).toEqual([1, 2])
  })
  it('skips anyone with a games count, including zero, and string-keyed years', () => {
    const d = { ...base(), players: [roster(1, 'A', 'Fr', { statsByYear: { '2030': { gamesPlayed: 3 } } })] }
    expect(pids(d)).toEqual([])
  })
  it('skips a player who appears in any box score this season, matched loosely by name', () => {
    const d = {
      ...base(),
      games: [{ year: Y, boxScore: { home: { passing: [{ playerName: "D'Andre Smith Jr." }] } } }],
      players: [roster(1, 'Dandre smith jr', 'Fr'), roster(2, 'Nobody', 'Fr')],
    }
    expect(pids(d)).toEqual([2])
  })
  it('ignores box scores from other seasons and reads the byTid shape too', () => {
    const d = {
      ...base(),
      games: [
        { year: Y - 1, boxScore: { home: { passing: [{ playerName: 'Old Year' }] } } },
        { year: Y, boxScore: { byTid: { [USER]: { rushing: [{ playerName: 'By Tid' }] } } } },
      ],
      players: [roster(1, 'Old Year', 'Fr'), roster(2, 'By Tid', 'Fr')],
    }
    expect(pids(d)).toEqual([1])
  })
  it('skips already-redshirted classes (they progress without a question)', () => {
    const d = { ...base(), players: [roster(1, 'A', 'RS Fr'), roster(2, 'B', 'RS Sr'), roster(3, 'C', 'So', { year: 'RS So' })] }
    expect(pids(d)).toEqual([3]) // classByYear wins over the stale top-level year
  })
  it('skips recruits, this cycle\'s signees, honor-only records and off-roster players', () => {
    const d = {
      ...base(),
      players: [
        roster(1, 'Recruit', 'Fr', { isRecruit: true }),
        roster(2, 'Signee', 'Fr', { recruitYear: Y }),
        { pid: 3, name: 'Honor', isHonorOnly: true, year: 'Sr' },
        { pid: 4, name: 'Other Team', year: 'Fr', teamsByYear: { [Y]: 77 }, classByYear: { [Y]: 'Fr' } },
        { pid: 5, name: 'Last Year Only', year: 'Fr', teamsByYear: { [Y - 1]: USER }, classByYear: { [Y - 1]: 'Fr' } },
        roster(6, 'Kept', 'Fr'),
      ],
    }
    expect(pids(d)).toEqual([6])
  })
  it('skips players who departed this season (v2 and legacy records)', () => {
    const d = {
      ...base(),
      players: [
        roster(1, 'Portal', 'Jr', { movementByYear: { [Y]: { type: 'departure', departure: 'transfer_out', toTid: null } } }),
        roster(2, 'Legacy', 'Jr', { movements: [{ type: 'entered_portal', year: Y }] }),
        roster(3, 'Left Last Year', 'Jr', { movementByYear: { [Y - 1]: { type: 'departure', departure: 'graduated' } } }),
      ],
    }
    expect(pids(d)).toEqual([3])
  })
  it('skips players with no class at all', () => {
    const d = { ...base(), players: [{ pid: 1, name: 'No Class', teamsByYear: { [Y]: USER } }] }
    expect(pids(d)).toEqual([])
  })
  it('returns nothing for a missing dynasty', () => {
    expect(getPlayersNeedingClassConfirmation(null)).toEqual([])
  })
})
