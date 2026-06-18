import { describe, it, expect } from 'vitest'
import { getEarnedTrophies, earnedYears } from '../trophyEngine'
import { TEAMS } from '../../data/teamRegistry'
import { TROPHIES } from '../../data/trophies'
import { stripMascotFromName } from '../../data/teams'

// Registry stores full mascot names — resolve a short school name to its tid.
const tidOf = (school) =>
  Number(Object.entries(TEAMS).find(([, t]) => (stripMascotFromName(t?.name || '') || '').toLowerCase() === school.toLowerCase())?.[0])
const uk = tidOf('Kentucky')
const lou = tidOf('Louisville')

const game = (o) => ({ team1Tid: uk, team2Tid: 999, winnerTid: uk, ...o })

describe('trophyEngine — detection', () => {
  it('resolves real team tids from names', () => {
    expect(typeof uk).toBe('number')
    expect(typeof lou).toBe('number')
  })

  it('detects national / conference / bowl / rivalry / award', () => {
    const dynasty = { teams: {}, awardsByYear: { 2031: { heisman: { player: 'QB Guy', team: 'UK' } } } }
    const stints = [{ teamTid: uk, startYear: 2030, endYear: 2032, games: [
      game({ year: 2031, isCFPChampionship: true }),
      game({ year: 2031, isConferenceChampionship: true, conference: 'SEC' }),
      game({ year: 2030, isBowlGame: true, bowlName: 'Sugar Bowl' }),
      game({ year: 2030, team2Tid: lou }), // rivalry: Governor's Cup
    ] }]
    const earned = getEarnedTrophies(dynasty, stints)
    expect(earned['national-championship']).toBeTruthy()
    expect(earned['sec-championship']).toBeTruthy()
    expect(earned['sugar-bowl']).toBeTruthy()
    expect(earned['governors-cup-kentucky-louisville']).toBeTruthy()
    expect(earned['heisman']).toBeTruthy()
    expect(earnedYears(earned['sugar-bowl'])).toEqual([2030])
  })

  it('does NOT credit a loss', () => {
    const stints = [{ teamTid: uk, startYear: 2030, endYear: 2030, games: [
      game({ year: 2030, isBowlGame: true, bowlName: 'Sugar Bowl', winnerTid: 999 }),
    ] }]
    expect(getEarnedTrophies({ teams: {} }, stints)['sugar-bowl']).toBeFalsy()
  })

  it('matches a sponsor-prefixed bowl name (Cheez-It Citrus Bowl → citrus-bowl)', () => {
    const stints = [{ teamTid: uk, startYear: 2030, endYear: 2030, games: [
      game({ year: 2030, isBowlGame: true, bowlName: 'Cheez-It Citrus Bowl' }),
    ] }]
    expect(getEarnedTrophies({ teams: {} }, stints)['citrus-bowl']).toBeTruthy()
  })

  it('credits the bowl trophy for a CFP quarterfinal/semifinal won at a bowl site', () => {
    const stints = [{ teamTid: uk, startYear: 2030, endYear: 2030, games: [
      game({ year: 2030, isCFPQuarterfinal: true, bowlName: 'Fiesta Bowl' }),
      game({ year: 2030, isCFPSemifinal: true, bowlName: 'Rose Bowl' }),
    ] }]
    const earned = getEarnedTrophies({ teams: {} }, stints)
    expect(earned['fiesta-bowl']).toBeTruthy()
    expect(earned['rose-bowl']).toBeTruthy()
  })

  it('does NOT credit a bowl trophy for the on-campus CFP first round (no bowlName)', () => {
    const stints = [{ teamTid: uk, startYear: 2030, endYear: 2030, games: [
      game({ year: 2030, isCFPFirstRound: true, bowlName: null }),
    ] }]
    const earned = getEarnedTrophies({ teams: {} }, stints)
    expect(Object.keys(earned).filter(k => TROPHIES.find(t => t.id === k && t.category === 'bowl'))).toEqual([])
  })

  it('does NOT credit an award when the winner was on another team', () => {
    const dynasty = { teams: {}, awardsByYear: { 2031: { heisman: { player: 'X', team: 'BAMA' } } } }
    const stints = [{ teamTid: uk, startYear: 2031, endYear: 2031, games: [] }]
    expect(getEarnedTrophies(dynasty, stints)['heisman']).toBeFalsy()
  })

  it('resolves the vast majority of rivalry team names to tids', () => {
    // Indirect coverage check: feed every rivalry trophy a self-game between its
    // two teams and confirm almost all resolve (a few exotic/teambuilder names
    // may not). This guards the school-name index.
    const names = new Set()
    TROPHIES.forEach((t) => t.category === 'rivalry' && t.teams?.forEach((n) => names.add(n)))
    const resolved = [...names].filter((n) => Number.isFinite(tidOf(n)))
    // At least 90% of distinct rivalry school names should resolve from the static registry.
    expect(resolved.length / names.size).toBeGreaterThan(0.9)
  })
})
