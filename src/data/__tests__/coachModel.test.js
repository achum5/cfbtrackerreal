import { describe, it, expect } from 'vitest'
import { synthOwnerCoachFromCoachTeamByYear } from '../coachModel'
import { getEarnedTrophies } from '../../utils/trophyEngine'

// Regression guard for the "Trophy Room comes up blank after winning a bowl"
// bug (Delaware save, 2026-07-05). Root cause: a coaching-carousel dynasty where
// every coach entity had controlledBy:null, so the owner had NO selectable coach
// and their coachingHistory was empty — even though coachTeamByYear correctly
// recorded they coached tid 26 both seasons and the bowl game was a clean
// tid-based win. The fix synthesizes the owner's coach from coachTeamByYear.

describe('synthOwnerCoachFromCoachTeamByYear', () => {
  const dynasty = {
    userId: 'U1',
    coachTeamByYear: {
      2026: { tid: 26, team: 'DEL', position: 'HC' },
      2027: { tid: 26, team: 'DEL', position: 'HC' },
    },
    memberLabels: { U1: 'Coach Flacco' },
  }

  it('builds the owner coach byYear from coachTeamByYear (strictly tid-based)', () => {
    const c = synthOwnerCoachFromCoachTeamByYear(dynasty)
    expect(c).toBeTruthy()
    expect(c.controlledBy).toBe('U1')
    expect(c.byYear['2026'].teamTid).toBe(26)
    expect(c.byYear['2027'].teamTid).toBe(26)
    expect(c.name).toBe('Coach Flacco')
    expect(c._synthesized).toBe(true)
  })

  it('tolerates numeric / teamTid entry shapes', () => {
    const c = synthOwnerCoachFromCoachTeamByYear({ userId: 'U', coachTeamByYear: { 2030: 42, 2031: { teamTid: 7 } } })
    expect(c.byYear['2030'].teamTid).toBe(42)
    expect(c.byYear['2031'].teamTid).toBe(7)
  })

  it('returns null when there is no owner or no usable coachTeamByYear', () => {
    expect(synthOwnerCoachFromCoachTeamByYear(null)).toBeNull()
    expect(synthOwnerCoachFromCoachTeamByYear({ userId: 'U1' })).toBeNull()
    expect(synthOwnerCoachFromCoachTeamByYear({ coachTeamByYear: { 2026: { tid: 26 } } })).toBeNull() // no userId
    expect(synthOwnerCoachFromCoachTeamByYear({ userId: 'U1', coachTeamByYear: { 2026: { team: 'DEL' } } })).toBeNull() // no tid
  })

  it('end-to-end: the synthesized owner coach yields the completed-season bowl trophy', () => {
    const c = synthOwnerCoachFromCoachTeamByYear(dynasty)
    const tid = c.byYear['2026'].teamTid
    // The exact Delaware game: a clean tid-based Boca Raton Bowl win in 2026.
    const bowl = {
      year: 2026, gameType: 'bowl', isBowlGame: true, bowlName: 'Boca Raton Bowl',
      team1Tid: tid, team2Tid: 44, team1Score: 21, team2Score: 7, winnerTid: tid,
    }
    const stints = [{ teamTid: tid, startYear: 2026, endYear: 2027, games: [bowl] }]
    const earned = getEarnedTrophies({ ...dynasty, teams: {} }, stints)
    expect(earned['boca-raton-bowl']).toBeTruthy()
    expect(earned['boca-raton-bowl'][0].year).toBe(2026)
  })
})

import { materializeOwnerCoach } from '../coachModel'

// The "I didn't spot the name-your-coach box and I'm in year 6" report: the
// owner's coach can be rebuilt from coachTeamByYear with every season intact.
describe('materializeOwnerCoach', () => {
  const dynasty = {
    userId: 'U1',
    coachTeamByYear: {
      2026: { tid: 54, team: 'MASS', position: 'HC' },
      2027: { tid: 54, team: 'MASS', position: 'HC' },
      2028: { tid: 54, team: 'MASS', position: 'HC' },
    },
  }

  it('builds a real, controlled coach carrying every recorded season', () => {
    const c = materializeOwnerCoach(dynasty)
    expect(c).toBeTruthy()
    expect(c.cid).toMatch(/^c_/)
    expect(c.controlledBy).toBe('U1')
    expect(c._synthesized).toBeUndefined()
    expect(Object.keys(c.byYear)).toEqual(['2026', '2027', '2028'])
    expect(c.byYear['2028']).toEqual({ teamTid: 54, role: 'HC' })
  })

  it('names it from the argument, then memberLabels, else leaves it blank to fill in', () => {
    expect(materializeOwnerCoach(dynasty, { name: ' G S ' }).name).toBe('G S')
    expect(materializeOwnerCoach({ ...dynasty, memberLabels: { U1: 'Coach G' } }).name).toBe('Coach G')
    expect(materializeOwnerCoach(dynasty).name).toBe('')
  })

  it('returns null when there is nothing to rebuild from', () => {
    expect(materializeOwnerCoach({ userId: 'U1' })).toBeNull()
    expect(materializeOwnerCoach({ coachTeamByYear: dynasty.coachTeamByYear })).toBeNull()
  })

  it('mints a fresh cid every time', () => {
    expect(materializeOwnerCoach(dynasty).cid).not.toBe(materializeOwnerCoach(dynasty).cid)
  })
})
