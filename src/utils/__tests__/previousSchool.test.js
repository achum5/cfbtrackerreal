import { describe, it, expect } from 'vitest'
import { applyPreviousSchool, resolvePreviousSchoolTid } from '../previousSchool'

const teams = {
  54: { tid: 54, abbr: 'MASS', name: 'Massachusetts Minutemen', teamName: 'Massachusetts' },
  1: { tid: 1, abbr: 'BAMA', name: 'Alabama Crimson Tide', teamName: 'Alabama' },
  7: { tid: 7, abbr: 'OHIO', name: 'Ohio Bobcats', teamName: 'Ohio' },
}

describe('resolvePreviousSchoolTid', () => {
  it('resolves tids, abbrs, labels and full names; ignores blanks and the placeholder', () => {
    expect(resolvePreviousSchoolTid(1, teams)).toBe(1)
    expect(resolvePreviousSchoolTid('1', teams)).toBe(1)
    expect(resolvePreviousSchoolTid('BAMA', teams)).toBe(1)
    expect(resolvePreviousSchoolTid('Alabama', teams)).toBe(1)
    expect(resolvePreviousSchoolTid('Alabama Crimson Tide', teams)).toBe(1)
    expect(resolvePreviousSchoolTid('', teams)).toBeNull()
    expect(resolvePreviousSchoolTid(null, teams)).toBeNull()
    expect(resolvePreviousSchoolTid('Transfer Portal', teams)).toBeNull()
    expect(resolvePreviousSchoolTid('Mercyhurst', teams)).toBeNull()
  })
  it('never resolves to the team being joined', () => {
    expect(resolvePreviousSchoolTid('Massachusetts', teams, { joiningTid: 54 })).toBeNull()
    expect(resolvePreviousSchoolTid(54, teams, { joiningTid: '54' })).toBeNull()
  })
})

describe('applyPreviousSchool', () => {
  const base = { pid: 9, name: 'Jordan Vega', team: 54, isPortal: true, previousTeam: '', movementByYear: {} }

  it('a real school on a re-save overwrites and reaches the arrival fromTid', () => {
    const before = { ...base, previousTeam: 'Transfer Portal' }
    const next = applyPreviousSchool(before, { previousTeam: 'Alabama', classYear: 2026, teams, joiningTid: 54 })
    expect(next.previousTeam).toBe(1)
    expect(next.movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'transfer_in', fromTid: 1 })
    expect(next.isPortal).toBe(true)
  })

  it('a blank row value keeps the existing school (and normalizes text to a tid)', () => {
    const before = { ...base, previousTeam: 'OHIO', movementByYear: { 2026: { type: 'arrival', arrival: 'transfer_in', fromTid: null } } }
    const next = applyPreviousSchool(before, { previousTeam: '', classYear: 2026, teams, joiningTid: 54 })
    expect(next.previousTeam).toBe(7)
    expect(next.movementByYear[2026].fromTid).toBe(7)
  })

  it('keeps an FCS / unknown school as typed, with an origin-less arrival', () => {
    const next = applyPreviousSchool(base, { previousTeam: 'Mercyhurst', classYear: 2026, teams, joiningTid: 54 })
    expect(next.previousTeam).toBe('Mercyhurst')
    expect(next.movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'transfer_in', fromTid: null })
  })

  it('never writes over a departure or recommit recorded for that year', () => {
    const dep = { ...base, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out' } } }
    expect(applyPreviousSchool(dep, { previousTeam: 'Alabama', classYear: 2026, teams }).movementByYear[2026].type).toBe('departure')
    const rec = { ...base, movementByYear: { 2026: { type: 'recommit' } } }
    expect(applyPreviousSchool(rec, { previousTeam: 'Alabama', classYear: 2026, teams }).movementByYear[2026].type).toBe('recommit')
  })

  it('treats the joining team as no school at all', () => {
    const before = { ...base, previousTeam: 'Massachusetts Minutemen' }
    const next = applyPreviousSchool(before, { previousTeam: '', classYear: 2026, teams, joiningTid: 54 })
    expect(next.movementByYear[2026].fromTid).toBeNull()
  })

  it('returns the same object when nothing changes', () => {
    const settled = { ...base, previousTeam: 1, teamsByYear: { 2026: 1, 2027: 54 }, movementByYear: { 2026: { type: 'arrival', arrival: 'transfer_in', fromTid: 1 } } }
    expect(applyPreviousSchool(settled, { previousTeam: 'Alabama', classYear: 2026, teams, joiningTid: 54 })).toBe(settled)
  })
})

import { materializeTransferOrigin } from '../previousSchool'

describe('origin season on the timeline', () => {
  const teams = {
    54: { tid: 54, abbr: 'MASS', name: 'Massachusetts Minutemen', teamName: 'Massachusetts' },
    130: { tid: 130, abbr: 'WSU', name: 'Washington State Cougars', teamName: 'Washington State' },
    1: { tid: 1, abbr: 'BAMA', name: 'Alabama Crimson Tide', teamName: 'Alabama' },
  }

  it('applyPreviousSchool puts the class year on the origin school when nothing earlier is recorded', () => {
    const p = { pid: 1, isPortal: true, team: 54, teamsByYear: { 2027: 54 }, movementByYear: {} }
    const next = applyPreviousSchool(p, { previousTeam: 'Alabama', classYear: 2026, teams, joiningTid: 54 })
    expect(next.teamsByYear).toEqual({ 2027: 54, 2026: 1 })
    expect(next.movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'transfer_in', fromTid: 1 })
  })

  it('never overwrites a season already on the timeline, nor one that reaches further back', () => {
    const there = { isPortal: true, teamsByYear: { 2026: 7, 2027: 54 } }
    expect(applyPreviousSchool(there, { previousTeam: 'Alabama', classYear: 2026, teams, joiningTid: 54 }).teamsByYear[2026]).toBe(7)
    const earlier = { isPortal: true, teamsByYear: { 2025: 7, 2027: 54 } }
    expect(applyPreviousSchool(earlier, { previousTeam: 'Alabama', classYear: 2026, teams, joiningTid: 54 }).teamsByYear[2026]).toBeUndefined()
  })

  it('the player editor case: Portal = Yes + Previous Team adds the prior season', () => {
    // Caden Pinnick: only a 2027 UMass season; user picked Washington State.
    const p = { pid: 3, name: 'Caden Pinnick', team: 54, isPortal: true, previousTeam: 130, teamsByYear: { 2027: 54 }, movementByYear: {} }
    const next = materializeTransferOrigin(p, { teams, currentYear: 2027 })
    expect(next.teamsByYear).toEqual({ 2027: 54, 2026: 130 })
    expect(next.movementByYear[2026]).toEqual({ type: 'arrival', arrival: 'transfer_in', fromTid: 130 })
    expect(next.previousTeam).toBe(130)
  })

  it('falls back to the current year when the record only carries the team mirror', () => {
    const p = { team: 54, isPortal: true, previousTeam: 'WSU' }
    const next = materializeTransferOrigin(p, { teams, currentYear: 2027 })
    expect(next.teamsByYear).toEqual({ 2026: 130 })
    expect(next.previousTeam).toBe(130)
  })

  it('is a no-op when not a portal player, the school is unknown, or it equals the first season team', () => {
    const notPortal = { isPortal: false, previousTeam: 130, teamsByYear: { 2027: 54 } }
    expect(materializeTransferOrigin(notPortal, { teams })).toBe(notPortal)
    const unknown = { isPortal: true, previousTeam: 'Mercyhurst', teamsByYear: { 2027: 54 } }
    expect(materializeTransferOrigin(unknown, { teams })).toBe(unknown)
    const same = { isPortal: true, previousTeam: 54, teamsByYear: { 2027: 54 } }
    expect(materializeTransferOrigin(same, { teams })).toBe(same)
  })

  it('a hand-edited history already reaching the origin year is left alone', () => {
    const p = { isPortal: true, previousTeam: 1, teamsByYear: { 2026: 1, 2027: 54 }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out' } } }
    const next = materializeTransferOrigin(p, { teams, currentYear: 2027 })
    expect(next.teamsByYear).toEqual({ 2026: 1, 2027: 54 })
    expect(next.movementByYear[2026].type).toBe('departure')
  })
})
