import { describe, it, expect } from 'vitest'
import { getExcludedBowlGames, isBowlAvailable } from '../index'
import {
  getBowlGamesList, getWeek1BowlGamesList, getWeek2BowlGamesList,
  getAllBowlGamesList, isBowlInWeek1,
} from '../../services/sheetsService'

// CFB 27 dropped the GameAbove Sports Bowl and the LA Bowl. They stay in the
// catalog (name, logo, trophy) and are still valid for CFB 26 dynasties, so
// the exclusion lives in the edition bundle and only filters the PICKERS.

const DROPPED = ['GameAbove Sports Bowl', 'LA Bowl']
const cfb27 = { gameEdition: 'cfb27' }
const cfb26 = { gameEdition: 'cfb26' }
const untagged = {}

describe('getExcludedBowlGames', () => {
  it('drops the two bowls for CFB 27 only', () => {
    expect(getExcludedBowlGames(cfb27)).toEqual(DROPPED)
    expect(getExcludedBowlGames(cfb26)).toEqual([])
  })
  it('an untagged (legacy) dynasty keeps every bowl', () => {
    expect(getExcludedBowlGames(untagged)).toEqual([])
    expect(getExcludedBowlGames(null)).toEqual([])
    expect(getExcludedBowlGames({ gameEdition: 'nonsense' })).toEqual([])
  })
  it('isBowlAvailable mirrors it', () => {
    expect(isBowlAvailable(cfb27, 'LA Bowl')).toBe(false)
    expect(isBowlAvailable(cfb27, 'Alamo Bowl')).toBe(true)
    expect(isBowlAvailable(cfb26, 'LA Bowl')).toBe(true)
  })
})

describe('bowl pickers', () => {
  it('hide both bowls for CFB 27 and keep them for CFB 26', () => {
    for (const get of [getBowlGamesList, getWeek1BowlGamesList, getAllBowlGamesList]) {
      const c27 = get(cfb27)
      const c26 = get(cfb26)
      for (const bowl of DROPPED) {
        expect(c27, `${get.name} cfb27`).not.toContain(bowl)
        expect(c26, `${get.name} cfb26`).toContain(bowl)
      }
      expect(c26.length - c27.length).toBe(2)
      expect(c27).toContain('Alamo Bowl')
    }
  })
  it('defaults to the full catalog when no dynasty is passed', () => {
    expect(getBowlGamesList()).toEqual(getBowlGamesList(cfb26))
  })
  it('leaves Week 2 untouched — neither bowl was ever a Week 2 game', () => {
    expect(getWeek2BowlGamesList(cfb27)).toEqual(getWeek2BowlGamesList(cfb26))
  })
  it('keeps the CFP First Round slots in the Week 1 list', () => {
    expect(getBowlGamesList(cfb27).filter(b => b.startsWith('CFP First Round'))).toHaveLength(4)
  })
})

describe('classifiers stay unfiltered', () => {
  it('still resolve a dropped bowl a dynasty already saved', () => {
    for (const bowl of DROPPED) expect(isBowlInWeek1(bowl)).toBe(true)
  })
})
