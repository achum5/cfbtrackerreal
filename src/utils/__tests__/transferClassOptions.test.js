import { describe, it, expect } from 'vitest'
import { getPortalTransferClassOptions, getPortalTransferDefaultClass, isKnownTransferClass } from '../transferClassOptions'
import { buildPortalTransferClassSave } from '../../api/classAssignments'

describe('getPortalTransferClassOptions', () => {
  it('a Fr transfer may become RS Fr, So, or RS So', () => {
    expect(getPortalTransferClassOptions('Fr')).toEqual(['RS Fr', 'So', 'RS So'])
  })
  it('So and Jr shift the same way', () => {
    expect(getPortalTransferClassOptions('So')).toEqual(['RS So', 'Jr', 'RS Jr'])
    expect(getPortalTransferClassOptions('Jr')).toEqual(['RS Jr', 'Sr', 'RS Sr'])
  })
  it('an RS label offers the same three answers — the screen never says who has redshirted', () => {
    expect(getPortalTransferClassOptions('RS Fr')).toEqual(['RS Fr', 'So', 'RS So'])
    expect(getPortalTransferClassOptions('RS So')).toEqual(['RS So', 'Jr', 'RS Jr'])
  })
  it('an unknown or terminal label falls back to the freshman set', () => {
    expect(getPortalTransferClassOptions('Sr')).toEqual(['RS Fr', 'So', 'RS So'])
    expect(getPortalTransferClassOptions('')).toEqual(['RS Fr', 'So', 'RS So'])
    expect(getPortalTransferClassOptions(undefined)).toEqual(['RS Fr', 'So', 'RS So'])
  })
  it('never offers the class they came in as (except as the RS variant)', () => {
    for (const cls of ['Fr', 'So', 'Jr']) {
      expect(getPortalTransferClassOptions(cls)).not.toContain(cls)
    }
  })
})

describe('getPortalTransferDefaultClass', () => {
  it('pre-selects the normal progression, keeping an existing redshirt prefix', () => {
    expect(getPortalTransferDefaultClass('Fr')).toBe('So')
    expect(getPortalTransferDefaultClass('So')).toBe('Jr')
    expect(getPortalTransferDefaultClass('Jr')).toBe('Sr')
    expect(getPortalTransferDefaultClass('RS Fr')).toBe('RS So')
    expect(getPortalTransferDefaultClass('RS Jr')).toBe('RS Sr')
  })
  it('is always a legal answer, and blank when there is nothing to progress', () => {
    for (const cls of ['Fr', 'So', 'Jr', 'RS Fr', 'RS So', 'RS Jr']) {
      expect(getPortalTransferClassOptions(cls)).toContain(getPortalTransferDefaultClass(cls))
    }
    expect(getPortalTransferDefaultClass('Sr')).toBe('')
    expect(getPortalTransferDefaultClass('')).toBe('')
  })
  it('isKnownTransferClass marks the labels this flow can progress', () => {
    expect(isKnownTransferClass('Fr')).toBe(true)
    expect(isKnownTransferClass('RS Jr')).toBe(true)
    expect(isKnownTransferClass('Sr')).toBe(false)
    expect(isKnownTransferClass(undefined)).toBe(false)
  })
})

describe('buildPortalTransferClassSave rejects an answer the dropdown never allowed', () => {
  const UK = 109
  const dynasty = (players) => ({
    currentPhase: 'offseason', currentWeek: 6, currentYear: 2028, currentTid: UK,
    teams: { [UK]: { tid: UK, abbr: 'UK', name: 'Kentucky Wildcats', byYear: {} } },
    players,
  })
  const transfer = (over = {}) => ({
    pid: 1, name: 'Portal Guy', isPortal: true, recruitYear: 2027,
    year: 'Fr', classByYear: { 2027: 'Fr' }, ...over,
  })

  it('the incoming class echoed back is ignored, so nobody is frozen a year behind', () => {
    const { updates, updatedCount } = buildPortalTransferClassSave(
      dynasty([transfer()]), [{ playerName: 'Portal Guy', selectedClass: 'Fr' }],
    )
    expect(updatedCount).toBe(0)
    expect(updates.players[0].classByYear[2028]).toBeUndefined()
  })

  it('each legal answer is stamped for the joining year', () => {
    for (const cls of ['RS Fr', 'So', 'RS So']) {
      const { updates, updatedCount } = buildPortalTransferClassSave(
        dynasty([transfer()]), [{ playerName: 'Portal Guy', selectedClass: cls }],
      )
      expect(updatedCount).toBe(1)
      expect(updates.players[0].classByYear[2028]).toBe(cls)
      expect(updates.players[0].year).toBe(cls)
    }
  })

  it('a record with no known incoming class is still saved (nothing to validate against)', () => {
    const { updatedCount } = buildPortalTransferClassSave(
      dynasty([transfer({ year: undefined, classByYear: {} })]),
      [{ playerName: 'Portal Guy', selectedClass: 'RS Jr' }],
    )
    expect(updatedCount).toBe(1)
  })
})
