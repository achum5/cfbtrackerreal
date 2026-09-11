import { describe, it, expect } from 'vitest'
import { assignCoachToRole, findCoachesByName } from '../coachModel'

// Inline staff edit from the team page popover: a slot on any team-year gets
// a new name. Unknown name → new NPC profile; known name (after the user
// confirms "same coach") → reuse that profile; the previous holder is vacated.

const npc = (cid, name, byYear) => ({ cid, name, controlledBy: null, status: 'active', departedYear: null, byYear })

const base = () => ({
  c_oc: npc('c_oc', 'Mike Denbrock', { 2027: { teamTid: 42, role: 'OC' } }),
  c_dc: npc('c_dc', 'Glenn Schumann', { 2026: { teamTid: 42, role: 'DC' }, 2027: { teamTid: 42, role: 'DC' } }),
  c_elsewhere: npc('c_elsewhere', 'Joe Brady', { 2027: { teamTid: 7, role: 'OC' } }),
  c_user: { cid: 'c_user', name: 'Coach Chum', controlledBy: 'U1', status: 'active', departedYear: null, byYear: { 2027: { teamTid: 42, role: 'HC' } } },
})

describe('findCoachesByName', () => {
  it('matches case/whitespace-insensitively and skips controlled coaches and the excluded cid', () => {
    const coaches = base()
    expect(findCoachesByName(coaches, '  joe BRADY ').map((c) => c.cid)).toEqual(['c_elsewhere'])
    expect(findCoachesByName(coaches, 'Coach Chum')).toEqual([])
    expect(findCoachesByName(coaches, 'Mike Denbrock', { excludeCid: 'c_oc' })).toEqual([])
    expect(findCoachesByName(coaches, '')).toEqual([])
  })
})

describe('assignCoachToRole', () => {
  it('mints a new NPC coach for an unknown name and vacates the previous holder', () => {
    const res = assignCoachToRole(base(), { tid: 42, year: 2027, role: 'OC', name: 'New Guy' })
    expect(res.changed).toBe(true)
    expect(res.vacated).toEqual([])
    const created = res.coaches[res.cid]
    expect(created.name).toBe('New Guy')
    expect(created.controlledBy).toBeNull()
    expect(created.byYear['2027']).toMatchObject({ teamTid: 42, role: 'OC' })
    // The old OC only had this one season, so the empty NPC entity is dropped.
    expect(res.coaches.c_oc).toBeUndefined()
  })

  it('keeps a vacated coach who still has other seasons', () => {
    const res = assignCoachToRole(base(), { tid: 42, year: 2027, role: 'DC', name: 'Someone Else' })
    expect(res.coaches.c_dc).toBeDefined()
    expect(res.coaches.c_dc.byYear['2027']).toBeUndefined()
    expect(res.coaches.c_dc.byYear['2026']).toMatchObject({ teamTid: 42, role: 'DC' })
  })

  it('reuses the confirmed coach and reports the placement they left that year', () => {
    const res = assignCoachToRole(base(), { tid: 42, year: 2027, role: 'OC', name: 'Joe Brady', reuseCid: 'c_elsewhere' })
    expect(res.changed).toBe(true)
    expect(res.cid).toBe('c_elsewhere')
    expect(res.coaches.c_elsewhere.byYear['2027']).toMatchObject({ teamTid: 42, role: 'OC' })
    expect(res.vacated).toEqual([{ tid: 7, year: 2027, role: 'OC' }])
    // No second "Joe Brady" profile was minted.
    expect(Object.values(res.coaches).filter((c) => c.name === 'Joe Brady')).toHaveLength(1)
  })

  it('reuse of a departed coach reactivates them', () => {
    const coaches = base()
    coaches.c_elsewhere = { ...coaches.c_elsewhere, status: 'departed', departedYear: 2026, byYear: { 2025: { teamTid: 7, role: 'OC' } } }
    const res = assignCoachToRole(coaches, { tid: 42, year: 2027, role: 'OC', name: 'Joe Brady', reuseCid: 'c_elsewhere' })
    expect(res.coaches.c_elsewhere.status).toBe('active')
    expect(res.coaches.c_elsewhere.departedYear).toBeNull()
    expect(res.vacated).toEqual([])
  })

  it('never rewrites a slot held by a user-controlled coach', () => {
    const before = base()
    const res = assignCoachToRole(before, { tid: 42, year: 2027, role: 'HC', name: 'Impostor' })
    expect(res.changed).toBe(false)
    expect(res.cid).toBe('c_user')
    expect(res.coaches).toBe(before)
  })

  it('ignores a reuseCid that points at a controlled coach and mints instead', () => {
    const res = assignCoachToRole(base(), { tid: 7, year: 2027, role: 'HC', name: 'Coach Chum', reuseCid: 'c_user' })
    expect(res.changed).toBe(true)
    expect(res.cid).not.toBe('c_user')
    expect(res.coaches.c_user.byYear['2027']).toMatchObject({ teamTid: 42, role: 'HC' })
  })

  it('is a no-op for the same name, a blank name, or a bad role', () => {
    const before = base()
    expect(assignCoachToRole(before, { tid: 42, year: 2027, role: 'OC', name: ' mike denbrock ' }).changed).toBe(false)
    expect(assignCoachToRole(before, { tid: 42, year: 2027, role: 'OC', name: '   ' }).changed).toBe(false)
    expect(assignCoachToRole(before, { tid: 42, year: 2027, role: 'QB', name: 'X' }).changed).toBe(false)
    expect(assignCoachToRole(before, { tid: 'abc', year: 2027, role: 'OC', name: 'X' }).changed).toBe(false)
  })

  it('fills an empty slot on a CPU team-year without touching anyone else', () => {
    const before = base()
    const res = assignCoachToRole(before, { tid: 99, year: 2028, role: 'HC', name: 'Fresh Hire' })
    expect(res.changed).toBe(true)
    expect(Object.keys(res.coaches)).toHaveLength(Object.keys(before).length + 1)
    expect(res.coaches[res.cid].byYear['2028']).toMatchObject({ teamTid: 99, role: 'HC' })
  })
})
