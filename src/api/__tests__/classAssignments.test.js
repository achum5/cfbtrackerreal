import { describe, it, expect } from 'vitest'
import { buildPortalTransferClassSave, buildFringeCaseClassSave } from '../classAssignments'

const UK = 109
const base = {
  currentPhase: 'offseason', currentWeek: 6, currentYear: 2028, currentTid: UK,
  teams: { [UK]: { tid: UK, abbr: 'UK', name: 'Kentucky Wildcats', byYear: {} } },
  players: [
    { pid: 1, name: 'Portal Guy', isPortal: true, recruitYear: 2027, classByYear: {} },
    { pid: 2, name: 'HS Kid', isRecruit: true, recruitYear: 2027, classByYear: {} },
    { pid: 3, name: 'Old Portal', isPortal: true, recruitYear: 2026, classByYear: {} },
  ],
}

describe('buildPortalTransferClassSave', () => {
  it('stamps the joining-year class only on portal recruits of this class year', () => {
    const { updates, updatedCount, year } = buildPortalTransferClassSave(base, [
      { playerName: 'Portal Guy', selectedClass: 'RS Jr', jerseyNumber: '7' },
      { playerName: 'HS Kid', selectedClass: 'Fr' },        // not portal
      { playerName: 'Old Portal', selectedClass: 'Sr' },    // wrong class year
    ])
    expect(year).toBe(2027)
    expect(updatedCount).toBe(1)
    const p = updates.players.find(x => x.pid === 1)
    expect(p.year).toBe('RS Jr')
    expect(p.classByYear[2028]).toBe('RS Jr')
    expect(p.jerseyNumber).toBe('7')
    expect(updates.players.find(x => x.pid === 2).classByYear).toEqual({})
  })
  it('leaves the jersey alone for a blank cell and clears the year-specific sheet id', () => {
    const d = { ...base, players: [{ ...base.players[0], jerseyNumber: '12' }] }
    const { updates } = buildPortalTransferClassSave(d, [{ playerName: 'Portal Guy', selectedClass: 'Jr', jerseyNumber: '' }])
    expect(updates.players[0].jerseyNumber).toBe('12')
    expect(updates.portalTransferClassSheetId_2027).toBeNull()
    expect(updates.teams[UK].byYear[2027].portalTransferClass).toHaveLength(1)
  })
})

describe('buildFringeCaseClassSave', () => {
  it('matches any player by name and stamps the joining year', () => {
    const { updates, updatedCount } = buildFringeCaseClassSave(base, [{ playerName: 'hs kid', selectedClass: 'RS Fr' }])
    expect(updatedCount).toBe(1)
    const p = updates.players.find(x => x.pid === 2)
    expect(p.year).toBe('RS Fr')
    expect(p.classByYear[2028]).toBe('RS Fr')
    expect(updates.fringeCaseClassSheetId).toBeNull()
    expect(updates.fringeCaseClassByYear[2027]).toHaveLength(1)
  })
  it('ignores rows without a selected class', () => {
    const { updatedCount } = buildFringeCaseClassSave(base, [{ playerName: 'HS Kid', selectedClass: '' }])
    expect(updatedCount).toBe(0)
  })
})

describe('id-anchored rows', () => {
  it('stamps the resolved pid onto stored portal and fringe selections', () => {
    const portal = buildPortalTransferClassSave(base, [{ playerName: 'portal guy', selectedClass: 'Jr' }, { playerName: 'Nobody', selectedClass: 'Fr' }])
    expect(portal.updates.portalTransferClassByYear[2027]).toEqual([
      { playerName: 'portal guy', selectedClass: 'Jr', pid: 1 },
      { playerName: 'Nobody', selectedClass: 'Fr' },
    ])
    expect(portal.updates.teams[UK].byYear[2027].portalTransferClass[0].pid).toBe(1)
    const fringe = buildFringeCaseClassSave(base, [{ playerName: 'HS Kid', selectedClass: 'So' }])
    expect(fringe.updates.fringeCaseClassByYear[2027][0].pid).toBe(2)
  })
  it('resolves by pid when the name drifted, still only among this cycle\'s portal recruits', () => {
    const { updates, updatedCount } = buildPortalTransferClassSave(base, [
      { playerName: 'P. Guy', pid: 1, selectedClass: 'RS So' },
      { playerName: 'O. Portal', pid: 3, selectedClass: 'Sr' }, // wrong class year
    ])
    expect(updatedCount).toBe(1)
    expect(updates.players.find(x => x.pid === 1).classByYear[2028]).toBe('RS So')
    expect(updates.players.find(x => x.pid === 3)).toBe(base.players[2])
  })
})

