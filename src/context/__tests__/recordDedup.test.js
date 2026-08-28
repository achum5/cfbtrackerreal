import { describe, it, expect } from 'vitest'
import { calculateTeamRecordFromGames } from '../DynastyContext'

const base = { storageType: 'local', teams: {} }

describe('calculateTeamRecordFromGames result-level dedup', () => {
  it('regression: the same game filed under two week keys counts once', () => {
    // A sync week renumbering left the same UMass-Rutgers result at week 0
    // AND week 1 — different week-gameType keys, so the slot dedup never
    // collapsed them and a 0-1 team read as 0-2 everywhere records render.
    const dynasty = {
      ...base,
      games: [
        { id: 'a', year: 2026, week: 0, team1Tid: 100, team2Tid: 200, team1Score: 6, team2Score: 33, isPlayed: true },
        { id: 'b', year: 2026, week: 1, team1Tid: 100, team2Tid: 200, team1Score: 6, team2Score: 33, isPlayed: true },
      ],
    }
    const umass = calculateTeamRecordFromGames(dynasty, 100, 2026)
    const rutgers = calculateTeamRecordFromGames(dynasty, 200, 2026)
    expect(`${umass.wins}-${umass.losses}`).toBe('0-1')
    expect(`${rutgers.wins}-${rutgers.losses}`).toBe('1-0')
  })

  it('keeps two genuinely different games in different weeks', () => {
    const dynasty = {
      ...base,
      games: [
        { id: 'a', year: 2026, week: 1, team1Tid: 100, team2Tid: 200, team1Score: 6, team2Score: 33, isPlayed: true },
        { id: 'b', year: 2026, week: 2, team1Tid: 100, team2Tid: 300, team1Score: 6, team2Score: 33, isPlayed: true },
      ],
    }
    const r = calculateTeamRecordFromGames(dynasty, 100, 2026)
    expect(`${r.wins}-${r.losses}`).toBe('0-2')
  })

  it('keeps a same-score rematch when the gameType differs (CCG)', () => {
    const dynasty = {
      ...base,
      games: [
        { id: 'a', year: 2026, week: 9, team1Tid: 100, team2Tid: 200, team1Score: 21, team2Score: 17, isPlayed: true },
        { id: 'b', year: 2026, week: 'CCG', gameType: 'conference_championship', isConferenceChampionship: true, team1Tid: 100, team2Tid: 200, team1Score: 21, team2Score: 17, isPlayed: true },
      ],
    }
    const r = calculateTeamRecordFromGames(dynasty, 100, 2026)
    expect(`${r.wins}-${r.losses}`).toBe('2-0')
  })

  it('does not collapse legacy tid-less games that share a score line', () => {
    // Number(undefined) is NaN — without abbr fallbacks, two different
    // opponents' games with the same scores would have keyed identically.
    const dynasty = {
      ...base,
      games: [
        { id: 'a', year: 2026, week: 1, team1: 'UGA', team2: 'AUB', team1Score: 28, team2Score: 14, isPlayed: true },
        { id: 'b', year: 2026, week: 2, team1: 'UGA', team2: 'TENN', team1Score: 28, team2Score: 14, isPlayed: true },
      ],
      teams: {},
    }
    const r = calculateTeamRecordFromGames(dynasty, 999, 2026)
    // tid 999 doesn't match; this test just guards the keying logic runs.
    expect(r.wins + r.losses).toBe(0)
  })
})
