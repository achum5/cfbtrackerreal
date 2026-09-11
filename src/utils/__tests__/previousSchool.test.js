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
    const settled = { ...base, previousTeam: 1, movementByYear: { 2026: { type: 'arrival', arrival: 'transfer_in', fromTid: 1 } } }
    expect(applyPreviousSchool(settled, { previousTeam: 'Alabama', classYear: 2026, teams, joiningTid: 54 })).toBe(settled)
  })
})
