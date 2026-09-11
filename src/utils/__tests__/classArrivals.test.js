import { describe, it, expect } from 'vitest'
import { classArrivalForTeamYear, playersArrivingForTeamYear, rosterTidForYear } from '../classArrivals'

// Class membership read off the player record. The motivating case: a player
// hand-edited on the timeline to have played 2026 at Alabama, entered the
// portal, and joined UMass for 2027 — with no commitment row ever entered.

const UMASS = 54, BAMA = 1

describe('classArrivalForTeamYear', () => {
  it('hand-edited timeline transfer (departure at the old school) is in the class', () => {
    const p = {
      pid: 1, name: 'Aubrey Walker',
      teamsByYear: { 2026: BAMA, 2027: UMASS },
      movementByYear: { 2026: { type: 'departure', departure: 'transfer_out' } },
    }
    expect(classArrivalForTeamYear(p, UMASS, 2026)).toEqual({ kind: 'transfer', fromTid: BAMA })
    expect(classArrivalForTeamYear(p, BAMA, 2026)).toBeNull()
    expect(classArrivalForTeamYear(p, UMASS, 2027)).toBeNull()
  })

  it('explicit arrivals: recruit, transfer_in (with fromTid), juco', () => {
    const recruit = { teamsByYear: { 2027: UMASS }, movementByYear: { 2026: { type: 'arrival', arrival: 'recruit' } } }
    const transfer = { teamsByYear: { 2027: UMASS }, movementByYear: { 2026: { type: 'arrival', arrival: 'transfer_in', fromTid: BAMA } } }
    const juco = { teamsByYear: { 2027: UMASS }, movementByYear: { 2026: { type: 'arrival', arrival: 'juco' } } }
    expect(classArrivalForTeamYear(recruit, UMASS, 2026)).toEqual({ kind: 'recruit', fromTid: null })
    expect(classArrivalForTeamYear(transfer, UMASS, 2026)).toEqual({ kind: 'transfer', fromTid: BAMA })
    expect(classArrivalForTeamYear(juco, UMASS, 2026)).toEqual({ kind: 'juco', fromTid: null })
  })

  it('legacy movement types are understood', () => {
    const p = { teamsByYear: { 2027: UMASS }, movementByYear: { 2026: { type: 'portal_in', fromTid: BAMA } } }
    expect(classArrivalForTeamYear(p, UMASS, 2026)).toEqual({ kind: 'transfer', fromTid: BAMA })
  })

  it('walk-ons, created seeds and returning players are not class members', () => {
    const walkOn = { teamsByYear: { 2027: UMASS }, movementByYear: { 2026: { type: 'arrival', arrival: 'walk_on' } } }
    const seeded = { teamsByYear: { 2027: UMASS }, entryReason: 'created' }
    const returning = { teamsByYear: { 2026: UMASS, 2027: UMASS } }
    const recommit = { teamsByYear: { 2026: UMASS, 2027: UMASS }, movementByYear: { 2026: { type: 'recommit' } } }
    expect(classArrivalForTeamYear(walkOn, UMASS, 2026)).toBeNull()
    expect(classArrivalForTeamYear(seeded, UMASS, 2026)).toBeNull()
    expect(classArrivalForTeamYear(returning, UMASS, 2026)).toBeNull()
    expect(classArrivalForTeamYear(recommit, UMASS, 2026)).toBeNull()
  })

  it('a recruit record with no seasons yet counts via recruitYear', () => {
    const p = { isRecruit: true, recruitYear: 2026, teamsByYear: { 2027: UMASS } }
    expect(classArrivalForTeamYear(p, UMASS, 2026)).toEqual({ kind: 'recruit', fromTid: null })
    const portal = { ...p, isPortal: true }
    expect(classArrivalForTeamYear(portal, UMASS, 2026)).toEqual({ kind: 'transfer', fromTid: null })
  })

  it('entryReason transfer_in on a first-season record counts, recruited does not (no recruitYear)', () => {
    const t = { teamsByYear: { 2027: UMASS }, entryReason: 'transfer_in' }
    const r = { teamsByYear: { 2027: UMASS }, entryReason: 'recruited' }
    expect(classArrivalForTeamYear(t, UMASS, 2026)).toEqual({ kind: 'transfer', fromTid: null })
    expect(classArrivalForTeamYear(r, UMASS, 2026)).toBeNull()
  })

  it('reads stint-based teamHistory and the current-year team mirror', () => {
    const stints = { teamHistory: [{ teamTid: BAMA, fromYear: 2025, toYear: 2026 }, { teamTid: UMASS, fromYear: 2027, toYear: null }] }
    expect(rosterTidForYear(stints, 2026)).toBe(BAMA)
    expect(rosterTidForYear(stints, 2028)).toBe(UMASS)
    expect(classArrivalForTeamYear(stints, UMASS, 2026)).toEqual({ kind: 'transfer', fromTid: BAMA })
    const mirrorOnly = { team: UMASS, isRecruit: true, recruitYear: 2026 }
    expect(classArrivalForTeamYear(mirrorOnly, UMASS, 2026, { currentYear: 2027 })).toEqual({ kind: 'recruit', fromTid: null })
    expect(classArrivalForTeamYear(mirrorOnly, UMASS, 2026, { currentYear: 2028 })).toBeNull()
  })

  it('playersArrivingForTeamYear skips honor-only and nulls', () => {
    const players = [
      null,
      { isHonorOnly: true, teamsByYear: { 2027: UMASS }, movementByYear: { 2026: { type: 'arrival', arrival: 'recruit' } } },
      { pid: 2, teamsByYear: { 2027: UMASS }, movementByYear: { 2026: { type: 'arrival', arrival: 'recruit' } } },
    ]
    expect(playersArrivingForTeamYear(players, UMASS, 2026).map((x) => x.player.pid)).toEqual([2])
  })
})
