import { describe, it, expect } from 'vitest'
import { reconcileOwnerCoachWithSeasonRecord, carryForwardControlledCoaches, deriveMemberTeamsIndex } from '../coachModel'

// The FSU → Wyoming → "back to FSU in year 4" report. coachTeamByYear holds
// the team each season was actually played as; the owner's coach entity is
// what the dashboard's current team is derived from and what the year flip
// copies forward. When the entity lacks or misstates a season, the flip
// carries an older team into the new year.

const FSU = 36, WYO = 132
const ownerCoach = (byYear) => ({ cid: 'c_own', name: 'Michael', controlledBy: 'U1', status: 'active', departedYear: null, byYear })
const dyn = (byYear, extra = {}) => ({
  userId: 'U1',
  currentYear: 2028,
  coachTeamByYear: {
    2025: { tid: FSU, team: 'FSU', position: 'HC' },
    2026: { tid: FSU, team: 'FSU', position: 'HC' },
    2027: { tid: WYO, team: 'WYO', position: 'HC' },
  },
  coaches: { c_own: ownerCoach(byYear) },
  ...extra,
})

describe('reconcileOwnerCoachWithSeasonRecord', () => {
  it('fills a season the coach entity is missing from the record', () => {
    const { coaches, changed } = reconcileOwnerCoachWithSeasonRecord(dyn({ 2025: { teamTid: FSU, role: 'HC' }, 2026: { teamTid: FSU, role: 'HC' } }))
    expect(changed).toBe(true)
    expect(coaches.c_own.byYear['2027']).toEqual({ teamTid: WYO, role: 'HC' })
  })

  it('the year flip then carries Wyoming forward, not FSU', () => {
    const d = dyn({ 2025: { teamTid: FSU, role: 'HC' }, 2026: { teamTid: FSU, role: 'HC' } })
    // Without the reconcile: the flip resurrects FSU.
    expect(carryForwardControlledCoaches(d.coaches, 2028).c_own.byYear['2028'].teamTid).toBe(FSU)
    // With it: Wyoming.
    const { coaches } = reconcileOwnerCoachWithSeasonRecord(d)
    const carried = carryForwardControlledCoaches(coaches, 2028)
    expect(carried.c_own.byYear['2028'].teamTid).toBe(WYO)
    expect(deriveMemberTeamsIndex({ ...d, coaches: carried })).toEqual({ U1: [WYO] })
  })

  it('heals a save the flip already got wrong: a carried-forward year is re-copied from the corrected season', () => {
    // Year 4 was carried from FSU (no hiredVia) because year 3 was missing.
    const d = dyn({ 2025: { teamTid: FSU, role: 'HC' }, 2026: { teamTid: FSU, role: 'HC' }, 2028: { teamTid: FSU, role: 'HC' } })
    const { coaches, changed } = reconcileOwnerCoachWithSeasonRecord(d)
    expect(changed).toBe(true)
    expect(coaches.c_own.byYear['2027'].teamTid).toBe(WYO)
    expect(coaches.c_own.byYear['2028'].teamTid).toBe(WYO)
    expect(deriveMemberTeamsIndex({ ...d, coaches })).toEqual({ U1: [WYO] })
  })

  it('corrects a carried-forward season that disagrees with the record', () => {
    const d = dyn({ 2025: { teamTid: FSU, role: 'HC' }, 2026: { teamTid: FSU, role: 'HC' }, 2027: { teamTid: FSU, role: 'HC' } })
    const { coaches } = reconcileOwnerCoachWithSeasonRecord(d)
    expect(coaches.c_own.byYear['2027'].teamTid).toBe(WYO)
  })

  it('never overwrites an explicit job acceptance', () => {
    // The user accepted a job for 2028 (hiredVia set) — that stands even
    // though there is no 2028 record yet and 2027 says Wyoming.
    const d = dyn({ 2025: { teamTid: FSU, role: 'HC' }, 2026: { teamTid: FSU, role: 'HC' }, 2027: { teamTid: WYO, role: 'HC' }, 2028: { teamTid: 1, role: 'HC', hiredVia: 'carousel' } })
    const { coaches, changed } = reconcileOwnerCoachWithSeasonRecord(d)
    expect(changed).toBe(false)
    expect(coaches.c_own.byYear['2028'].teamTid).toBe(1)
    // …and a recorded season whose coach entry is an explicit hire stays.
    const d2 = dyn({ 2027: { teamTid: FSU, role: 'HC', hiredVia: 'carousel' } })
    expect(reconcileOwnerCoachWithSeasonRecord(d2).coaches.c_own.byYear['2027'].teamTid).toBe(FSU)
  })

  it('is a no-op when everything already agrees, returning the same map', () => {
    const d = dyn({ 2025: { teamTid: FSU, role: 'HC' }, 2026: { teamTid: FSU, role: 'HC' }, 2027: { teamTid: WYO, role: 'HC' }, 2028: { teamTid: WYO, role: 'HC' } })
    const { coaches, changed } = reconcileOwnerCoachWithSeasonRecord(d)
    expect(changed).toBe(false)
    expect(coaches).toBe(d.coaches)
  })

  it('leaves other members\' coaches and uncontrolled coaches alone', () => {
    const d = dyn({ 2025: { teamTid: FSU, role: 'HC' } }, {
      coaches: {
        c_own: ownerCoach({ 2025: { teamTid: FSU, role: 'HC' } }),
        c_buddy: { cid: 'c_buddy', name: 'Buddy', controlledBy: 'U2', byYear: { 2027: { teamTid: 5, role: 'HC' } } },
        c_npc: { cid: 'c_npc', name: 'NPC', controlledBy: null, byYear: { 2027: { teamTid: 9, role: 'OC' } } },
      },
    })
    const { coaches } = reconcileOwnerCoachWithSeasonRecord(d)
    expect(coaches.c_buddy).toBe(d.coaches.c_buddy)
    expect(coaches.c_npc).toBe(d.coaches.c_npc)
    expect(coaches.c_own.byYear['2027'].teamTid).toBe(WYO)
  })

  it('does nothing without an owner or a record', () => {
    expect(reconcileOwnerCoachWithSeasonRecord({ coaches: {} }).changed).toBe(false)
    expect(reconcileOwnerCoachWithSeasonRecord({ userId: 'U1', coaches: { c_own: ownerCoach({}) } }).changed).toBe(false)
    expect(reconcileOwnerCoachWithSeasonRecord(null).changed).toBe(false)
  })
})
