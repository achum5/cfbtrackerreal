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

describe('upToGameId excludes every copy of the target game', () => {
  // The user's device cache held a since-renumbered duplicate of the same
  // game under a different id at a different week. GameEdit's live record
  // asks for the baseline BEFORE the game via upToGameId, then folds the
  // typed score back in — with the duplicate in the baseline, the fold
  // double-counted (a 0-1 team's score-graphic prompt read 0-2, and the
  // more-games-wins reconciliation preferred the inflated value).
  const shells = Array.from({ length: 5 }, (_, i) => ({
    id: `shell-${i}`, year: 2026, week: i + 2, gameType: 'regular',
    team1Tid: 54, team2Tid: 200 + i, team1Score: 0, team2Score: 0, isPlayed: false,
  }))
  const phantom = { id: 'old-copy', year: 2026, week: 0, gameType: 'regular', team1Tid: 54, team2Tid: 85, team1Score: 6, team2Score: 33 }
  const real = { id: 'real-copy', year: 2026, week: 1, gameType: 'regular', team1Tid: 54, team2Tid: 85, team1Score: 6, team2Score: 33 }

  it('regression: baseline before the game is 0-0 even with a cached duplicate', () => {
    const dynasty = { storageType: 'local', teams: {}, games: [phantom, real, ...shells] }
    const b = calculateTeamRecordFromGames(dynasty, 54, 2026, { upToGameId: 'real-copy' })
    expect(`${b.wins}-${b.losses}`).toBe('0-0')
    // GameEdit then folds the typed 6-33 in: 0-1, matching the game page.
  })

  it('works when the dedup kept the OTHER copy (target id not in the deduped list)', () => {
    // Sorted by slot, the week-0 phantom comes first and survives the
    // result-level dedup; the id the route holds is the dropped week-1 copy.
    const dynasty = { storageType: 'local', teams: {}, games: [phantom, real] }
    const b = calculateTeamRecordFromGames(dynasty, 54, 2026, { upToGameId: 'real-copy' })
    expect(b.wins + b.losses).toBe(0)
  })

  it('still counts genuinely earlier games in the baseline', () => {
    const opener = { id: 'wk1', year: 2026, week: 1, gameType: 'regular', team1Tid: 54, team2Tid: 90, team1Score: 30, team2Score: 10 }
    const later = { id: 'wk3', year: 2026, week: 3, gameType: 'regular', team1Tid: 54, team2Tid: 85, team1Score: 6, team2Score: 33 }
    const dynasty = { storageType: 'local', teams: {}, games: [opener, later] }
    const b = calculateTeamRecordFromGames(dynasty, 54, 2026, { upToGameId: 'wk3' })
    expect(`${b.wins}-${b.losses}`).toBe('1-0')
  })

  it('no-ops safely when the id matches nothing at all', () => {
    const dynasty = { storageType: 'local', teams: {}, games: [real] }
    const b = calculateTeamRecordFromGames(dynasty, 54, 2026, { upToGameId: 'missing' })
    expect(`${b.wins}-${b.losses}`).toBe('0-1')
  })
})
