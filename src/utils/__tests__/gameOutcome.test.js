import { describe, it, expect } from 'vitest'
import { resolveOutcome, describeResult, describeHistoryRow } from '../gameOutcome'

describe('resolveOutcome', () => {
  it('resolves a normal win either way', () => {
    expect(resolveOutcome(28, 14)).toEqual({ isTie: false, team1Won: true, team2Won: false, winnerIsTeam1: true })
    expect(resolveOutcome(14, 28)).toEqual({ isTie: false, team1Won: false, team2Won: true, winnerIsTeam1: false })
  })
  it('reports a tie as a tie, not a team-2 win', () => {
    // The bug: `team1Score > team2Score` being false was read as "team 2 won".
    expect(resolveOutcome(21, 21)).toEqual({ isTie: true, team1Won: false, team2Won: false, winnerIsTeam1: null })
  })
  it('treats a 0-0 game as a tie', () => {
    expect(resolveOutcome(0, 0).isTie).toBe(true)
  })
  it('claims no winner for a MISSING score rather than inventing a shutout', () => {
    // Number(null) and Number('') are both 0, so a missing score would
    // otherwise resolve to a real 14-0 result for an unplayed game.
    for (const bad of [null, undefined, '', NaN]) {
      const r = resolveOutcome(bad, 14)
      expect(r.winnerIsTeam1, String(bad)).toBeNull()
      expect(r.isTie, String(bad)).toBe(false)
      expect(r.team2Won, String(bad)).toBe(false)
    }
    expect(resolveOutcome(undefined, undefined).isTie).toBe(false)
  })

  it('does not treat two missing scores as a 0-0 tie', () => {
    expect(resolveOutcome(null, null).isTie).toBe(false)
  })
  it('accepts numeric strings', () => {
    expect(resolveOutcome('28', '14').team1Won).toBe(true)
    expect(resolveOutcome('21', '21').isTie).toBe(true)
  })
})

describe('describeResult', () => {
  it('names the winner for a decided game', () => {
    expect(describeResult('Kentucky', 45, 'Louisville', 27)).toBe('Kentucky defeated Louisville 45-27')
    expect(describeResult('Kentucky', 27, 'Louisville', 45)).toBe('Louisville defeated Kentucky 45-27')
  })
  it('falls back to a neutral matchup line when a score is missing', () => {
    expect(describeResult('Kentucky', null, 'Louisville', 27)).toBe('Kentucky vs Louisville')
  })
  it('never says "defeated" for a tie', () => {
    const s = describeResult('Kentucky', 21, 'Louisville', 21)
    expect(s).toBe('Kentucky and Louisville tied 21-21')
    expect(s).not.toMatch(/defeated/)
  })
})

describe('describeHistoryRow', () => {
  it('uses def. for a decided game and marks a tie', () => {
    expect(describeHistoryRow('UK', 45, 'UL', 27)).toBe('UK def. UL 45-27')
    expect(describeHistoryRow('UK', 21, 'UL', 21)).toBe('UK 21, UL 21 (tie)')
  })
})
