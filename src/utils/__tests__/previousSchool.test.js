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

import { previousSeasonClass } from '../previousSchool'

describe('origin season carries class, dev trait and pre-gain overall', () => {
  const teams = {
    54: { tid: 54, abbr: 'MASS', name: 'Massachusetts Minutemen', teamName: 'Massachusetts' },
    130: { tid: 130, abbr: 'WSU', name: 'Washington State Cougars', teamName: 'Washington State' },
  }

  it('previousSeasonClass steps back one year, and a redshirt tag simply comes off', () => {
    expect(previousSeasonClass('RS So')).toBe('So')
    expect(previousSeasonClass('RS Fr')).toBe('Fr')
    expect(previousSeasonClass('RS Sr')).toBe('Sr')
    expect(previousSeasonClass('So')).toBe('Fr')
    expect(previousSeasonClass('Jr')).toBe('So')
    expect(previousSeasonClass('Sr')).toBe('Jr')
    expect(previousSeasonClass('Fr')).toBeNull()
    expect(previousSeasonClass('HS')).toBeNull()
    expect(previousSeasonClass('')).toBeNull()
  })

  it('Caden: RS So Impact 78 with a +5 in Training Results → 2026 at WSU as So, Impact, 73', () => {
    const p = {
      pid: 3, name: 'Caden Pinnick', team: 54, isPortal: true, previousTeam: 130,
      year: 'RS So', devTrait: 'Impact',
      teamsByYear: { 2027: 54 }, classByYear: { 2027: 'RS So' }, devTraitByYear: { 2027: 'Impact' },
      overallByYear: { 2027: 78 }, movementByYear: {},
    }
    const ledger = { 2027: [{ pid: 3, playerName: 'Caden Pinnick', newOverall: 78, pastOverall: 73 }] }
    const next = materializeTransferOrigin(p, { teams, currentYear: 2027, trainingLedger: ledger })
    expect(next.teamsByYear).toEqual({ 2027: 54, 2026: 130 })
    expect(next.classByYear).toEqual({ 2027: 'RS So', 2026: 'So' })
    expect(next.devTraitByYear).toEqual({ 2027: 'Impact', 2026: 'Impact' })
    expect(next.overallByYear).toEqual({ 2027: 78, 2026: 73 })
  })

  it('fills the blanks on an origin season that already exists, never overwriting a value', () => {
    // The season row was added earlier with nothing on it.
    const p = {
      pid: 3, name: 'Caden Pinnick', team: 54, isPortal: true, previousTeam: 130,
      year: 'RS So', devTrait: 'Impact',
      teamsByYear: { 2026: 130, 2027: 54 }, classByYear: { 2027: 'RS So' }, devTraitByYear: { 2026: 'Star', 2027: 'Impact' },
      overallByYear: { 2027: 78 },
    }
    const ledger = { 2027: [{ playerName: 'caden pinnick', newOverall: 78, pastOverall: 73 }] }
    const next = materializeTransferOrigin(p, { teams, currentYear: 2027, trainingLedger: ledger })
    expect(next.classByYear[2026]).toBe('So')
    expect(next.devTraitByYear[2026]).toBe('Star')
    expect(next.overallByYear[2026]).toBe(73)
  })

  it('leaves class/overall alone when the prior class is unknowable or the ledger has no gain', () => {
    const fr = { team: 54, isPortal: true, previousTeam: 130, year: 'Fr', teamsByYear: { 2027: 54 } }
    const next = materializeTransferOrigin(fr, { teams, currentYear: 2027 })
    expect(next.teamsByYear[2026]).toBe(130)
    expect(next.classByYear?.[2026]).toBeUndefined()
    expect(next.overallByYear?.[2026]).toBeUndefined()
  })

  it('applyPreviousSchool takes pastOverall straight from a sheet row', () => {
    const p = { isPortal: true, team: 54, year: 'Jr', devTrait: 'Star', teamsByYear: { 2027: 54 } }
    const next = applyPreviousSchool(p, { previousTeam: 'WSU', classYear: 2026, teams, joiningTid: 54, pastOverall: 70 })
    expect(next.overallByYear).toEqual({ 2026: 70 })
    expect(next.classByYear).toEqual({ 2026: 'So' })
    expect(next.devTraitByYear).toEqual({ 2026: 'Star' })
  })
})
