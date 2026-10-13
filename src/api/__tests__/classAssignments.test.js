import { describe, it, expect } from 'vitest'
import { buildPortalTransferClassSave, buildFringeCaseClassSave, getFringeCasePlayers } from '../classAssignments'

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

// Signing Day (offseason week 6) of the 2028 cycle: the season just played is
// 2027 and the year flip has already built the 2028 roster.
const fringeBase = () => ({
  currentPhase: 'offseason', currentWeek: 6, currentYear: 2028, currentTid: UK,
  teams: { [UK]: { tid: UK, abbr: 'UK', name: 'Kentucky Wildcats', byYear: { 2027: { playersLeaving: [{ pid: 13, name: 'Listed Leaver' }] } } } },
  players: [
    { pid: 10, name: 'Returning Frosh', position: 'WR', teamsByYear: { 2027: UK, 2028: UK }, classByYear: { 2027: 'Fr', 2028: 'So' }, statsByYear: { 2027: { gamesPlayed: 7 } } },
    { pid: 11, name: 'Portal Leaver', position: 'CB', team: UK, year: 'Jr', teamsByYear: { 2027: UK }, classByYear: { 2027: 'Jr' }, statsByYear: { 2027: { gamesPlayed: 8 } },
      movementByYear: { 2027: { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Playing Time' } } },
    { pid: 12, name: 'Graduated Senior', position: 'LB', team: UK, year: 'Jr', teamsByYear: { 2026: UK, 2027: UK }, classByYear: { 2026: 'Jr' }, statsByYear: { 2027: { gamesPlayed: 6 } },
      movementByYear: { 2027: { type: 'departure', departure: 'graduated' } } },
    { pid: 13, name: 'Listed Leaver', position: 'DT', teamsByYear: { 2027: UK, 2028: UK }, classByYear: { 2027: 'So', 2028: 'Jr' }, statsByYear: { 2027: { gamesPlayed: 5 } } },
    { pid: 14, name: 'Recommit Guy', position: 'HB', teamsByYear: { 2027: UK, 2028: UK }, classByYear: { 2027: 'So', 2028: 'Jr' }, statsByYear: { 2027: { gamesPlayed: 9 } },
      movementByYear: { 2027: { type: 'recommit', reason: 'Playing Time' } } },
    { pid: 15, name: 'Bench Guy', position: 'TE', teamsByYear: { 2027: UK, 2028: UK }, classByYear: { 2027: 'Fr', 2028: 'RS Fr' }, statsByYear: { 2027: { gamesPlayed: 3 } } },
    { pid: 16, name: 'Returning Frosh', position: 'QB', teamsByYear: { 2027: 5, 2028: 5 }, classByYear: { 2027: 'Fr' }, statsByYear: { 2027: { gamesPlayed: 7 } } },
  ],
})

describe('getFringeCasePlayers', () => {
  it('lists only returning Fr/So/Jr from the season just played with 5-9 games', () => {
    const list = getFringeCasePlayers(fringeBase(), UK, 2027)
    expect(list.map(p => p.pid).sort()).toEqual([10, 14])
    expect(list.find(p => p.pid === 10)).toEqual({ pid: 10, name: 'Returning Frosh', position: 'WR', currentClass: 'Fr', gameCount: 7 })
  })

  it('a player who left through the portal is not a fringe case', () => {
    expect(getFringeCasePlayers(fringeBase(), UK, 2027).some(p => p.pid === 11)).toBe(false)
  })

  it('a senior whose current-class field still reads "Jr" is read as the senior he was', () => {
    // Before the flip, no departure recorded yet: only the class decides.
    const d = { ...fringeBase(), currentWeek: 4, currentYear: 2027 }
    d.players = d.players.map(p => p.pid === 12 ? { ...p, movementByYear: {} } : p)
    expect(getFringeCasePlayers(d, UK, 2027).some(p => p.pid === 12)).toBe(false)
  })

  it('the Players Leaving list removes a player even without a movement record', () => {
    const d = { ...fringeBase(), currentWeek: 4, currentYear: 2027 }
    expect(getFringeCasePlayers(d, UK, 2027).some(p => p.pid === 13)).toBe(false)
  })

  it('after the flip, a player missing from next season\'s roster is not listed', () => {
    const d = fringeBase()
    d.players = d.players.map(p => p.pid === 10 ? { ...p, teamsByYear: { 2027: UK } } : p)
    expect(getFringeCasePlayers(d, UK, 2027).some(p => p.pid === 10)).toBe(false)
  })
})

describe('buildFringeCaseClassSave', () => {
  it('stamps the joining year on the returning roster player the row names', () => {
    const { updates, updatedCount } = buildFringeCaseClassSave(fringeBase(), [{ playerName: 'returning frosh', selectedClass: 'RS Fr' }])
    expect(updatedCount).toBe(1)
    const p = updates.players.find(x => x.pid === 10)
    expect(p.year).toBe('RS Fr')
    expect(p.classByYear[2028]).toBe('RS Fr')
    // The same-named player on another team is untouched.
    expect(updates.players.find(x => x.pid === 16).classByYear[2028]).toBeUndefined()
    expect(updates.fringeCaseClassSheetId).toBeNull()
    expect(updates.fringeCaseClassByYear[2027]).toHaveLength(1)
  })
  it('never stamps a class onto a player who left (row kept, not applied)', () => {
    const { updates, updatedCount } = buildFringeCaseClassSave(fringeBase(), [
      { playerName: 'Portal Leaver', selectedClass: 'Sr' },
      { playerName: 'Graduated Senior', selectedClass: 'Sr' },
    ])
    expect(updatedCount).toBe(0)
    expect(updates.players.find(x => x.pid === 11).classByYear[2028]).toBeUndefined()
    expect(updates.players.find(x => x.pid === 12).classByYear[2028]).toBeUndefined()
    expect(updates.fringeCaseClassByYear[2027]).toHaveLength(2)
  })
  it('ignores rows without a selected class', () => {
    const { updatedCount } = buildFringeCaseClassSave(fringeBase(), [{ playerName: 'Returning Frosh', selectedClass: '' }])
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
    const fringe = buildFringeCaseClassSave(fringeBase(), [{ playerName: 'Returning Frosh', selectedClass: 'So' }])
    expect(fringe.updates.fringeCaseClassByYear[2027][0].pid).toBe(10)
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

