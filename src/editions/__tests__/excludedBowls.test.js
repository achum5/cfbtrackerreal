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
      // Only these two leave; every other cfb26 bowl survives (the Music City
      // Bowl also MOVES weeks in cfb27 — see the week-override block below —
      // so compare membership, not raw length).
      expect(c26.filter(b => !c27.includes(b))).toEqual(
        expect.arrayContaining(DROPPED.filter(b => c26.includes(b))),
      )
      expect(c27).toContain('Alamo Bowl')
    }
  })
  it('defaults to the full catalog when no dynasty is passed', () => {
    expect(getBowlGamesList()).toEqual(getBowlGamesList(cfb26))
  })
  it('neither dropped bowl was ever a Week 2 game, so neither is missing from there', () => {
    for (const bowl of DROPPED) {
      expect(getWeek2BowlGamesList(cfb26)).not.toContain(bowl)
      expect(getWeek2BowlGamesList(cfb27)).not.toContain(bowl)
    }
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

// ── Bowl week overrides ────────────────────────────────────────────────
// CFB 27 plays the Music City Bowl in Bowl Week 1; CFB 26 played it in
// Week 2. The catalog still lists it under Week 2, and the override moves it.
import { getBowlWeekOverrides } from '../index'
import { getBowlGamesWeek2, isBowlInWeek2 } from '../../services/sheetsService'

const MUSIC_CITY = 'Music City Bowl'

describe('bowl week overrides', () => {
  it('only CFB 27 declares one', () => {
    expect(getBowlWeekOverrides(cfb27)).toEqual({ [MUSIC_CITY]: 1 })
    expect(getBowlWeekOverrides(cfb26)).toEqual({})
    expect(getBowlWeekOverrides(null)).toEqual({})
  })

  it('moves the Music City Bowl into Week 1 for CFB 27, out of Week 2', () => {
    expect(getBowlGamesList(cfb27)).toContain(MUSIC_CITY)
    expect(getWeek2BowlGamesList(cfb27)).not.toContain(MUSIC_CITY)
    expect(getBowlGamesWeek2(null, cfb27)).not.toContain(MUSIC_CITY)
  })

  it('leaves CFB 26 and untagged dynasties in Week 2', () => {
    for (const d of [cfb26, untagged, null]) {
      expect(getBowlGamesList(d)).not.toContain(MUSIC_CITY)
      expect(getWeek2BowlGamesList(d)).toContain(MUSIC_CITY)
    }
  })

  it('inserts it alphabetically without disturbing the CFP First Round order', () => {
    const wk1 = getBowlGamesList(cfb27)
    expect(wk1[wk1.indexOf(MUSIC_CITY) - 1]).toBe('Military Bowl')
    expect(wk1[wk1.indexOf(MUSIC_CITY) + 1]).toBe('Myrtle Beach Bowl')
    expect(wk1.filter(b => b.startsWith('CFP First Round'))).toEqual([
      'CFP First Round (#8 vs #9)',
      'CFP First Round (#7 vs #10)',
      'CFP First Round (#6 vs #11)',
      'CFP First Round (#5 vs #12)',
    ])
  })

  it('keeps the slot totals consistent: one leaves Week 2, one joins Week 1', () => {
    // cfb27 Week 1 = catalog 29 - 2 dropped + Music City = 28
    expect(getBowlGamesList(cfb27)).toHaveLength(28)
    expect(getBowlGamesList(cfb26)).toHaveLength(29)
    expect(getWeek2BowlGamesList(cfb27)).toHaveLength(getWeek2BowlGamesList(cfb26).length - 1)
  })

  it('classifies a NEW entry into the week its edition plays it', () => {
    expect(isBowlInWeek1(MUSIC_CITY, cfb27)).toBe(true)
    expect(isBowlInWeek2(MUSIC_CITY, cfb27)).toBe(false)
    expect(isBowlInWeek1(MUSIC_CITY, cfb26)).toBe(false)
    expect(isBowlInWeek2(MUSIC_CITY, cfb26)).toBe(true)
    // No dynasty = catalog behavior.
    expect(isBowlInWeek2(MUSIC_CITY)).toBe(true)
  })

  it('still classifies a dropped bowl, which has no week override', () => {
    expect(isBowlInWeek1('LA Bowl', cfb27)).toBe(true)
  })
})
