import { describe, it, expect } from 'vitest'
import {
  LAST_REGULAR_SEASON_WEEK, REGULAR_SEASON_WEEKS, LEGACY_PHANTOM_WEEK,
  regularSeasonWeekOptions, weeksInUse,
} from '../seasonCalendar'

// EA's calendar: Week 0-14 is the regular season (Army-Navy in Week 14),
// then Conference Championship week. There is no Week 15.

describe('season calendar', () => {
  it('ends the regular season at Week 14', () => {
    expect(LAST_REGULAR_SEASON_WEEK).toBe(14)
    expect(REGULAR_SEASON_WEEKS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(LEGACY_PHANTOM_WEEK).toBe(15)
  })

  it('offers Week 15 in a picker only when legacy data still sits there', () => {
    expect(regularSeasonWeekOptions()).toEqual(REGULAR_SEASON_WEEKS)
    expect(regularSeasonWeekOptions([3, 14])).toEqual(REGULAR_SEASON_WEEKS)
    expect(regularSeasonWeekOptions([15])).toEqual([...REGULAR_SEASON_WEEKS, 15])
    expect(regularSeasonWeekOptions('15')).toEqual([...REGULAR_SEASON_WEEKS, 15])
    expect(regularSeasonWeekOptions(['CCG', undefined, null])).toEqual(REGULAR_SEASON_WEEKS)
  })

  it('collects the numeric weeks a year of games uses, ignoring other years and CCG strings', () => {
    const games = [
      { year: 2030, week: 0 }, { year: 2030, week: '15' }, { year: 2030, week: 'CCG' },
      { year: 2029, week: 15 }, null,
    ]
    expect(weeksInUse(games, 2030).sort((a, b) => a - b)).toEqual([0, 15])
    expect(weeksInUse(games, 2031)).toEqual([])
    expect(weeksInUse(undefined, 2030)).toEqual([])
  })
})

import { lastCompletedWeekSlot, weekSlotLabel, CONF_CHAMP_WEEK_SLOT, BOWL_WEEK_SLOT } from '../seasonCalendar'

describe('lastCompletedWeekSlot — the recap the dashboard surfaces', () => {
  it('regular season: the previous week, including Week 0 at Week 1', () => {
    expect(lastCompletedWeekSlot('regular_season', 0)).toBeNull()
    expect(lastCompletedWeekSlot('regular_season', 1)).toBe(0)
    expect(lastCompletedWeekSlot('regular_season', 14)).toBe(13)
  })
  it('conference championship week: Week 14, never the phantom Week 15', () => {
    expect(lastCompletedWeekSlot('conference_championship', 1)).toBe(14)
  })
  it('postseason: CCG week at Bowl Week 1, then each bowl week, then the title game at the recap week', () => {
    expect(lastCompletedWeekSlot('postseason', 1)).toBe(CONF_CHAMP_WEEK_SLOT)
    expect(lastCompletedWeekSlot('postseason', 2)).toBe(BOWL_WEEK_SLOT[1])
    expect(lastCompletedWeekSlot('postseason', 3)).toBe(BOWL_WEEK_SLOT[2])
    expect(lastCompletedWeekSlot('postseason', 4)).toBe(BOWL_WEEK_SLOT[3])
    expect(lastCompletedWeekSlot('postseason', 5)).toBe(BOWL_WEEK_SLOT[4])
  })
  it('nothing to surface in preseason / offseason or with a bad week', () => {
    expect(lastCompletedWeekSlot('preseason', 0)).toBeNull()
    expect(lastCompletedWeekSlot('offseason', 3)).toBeNull()
    expect(lastCompletedWeekSlot('regular_season', 'x')).toBeNull()
  })
})

describe('weekSlotLabel', () => {
  it('names every slot the way the recap modal and prompts do', () => {
    expect(weekSlotLabel(-1)).toBe('Preseason')
    expect(weekSlotLabel(0)).toBe('Week 0')
    expect(weekSlotLabel(14)).toBe('Week 14')
    expect(weekSlotLabel(16)).toBe('Conference Championship Week')
    expect(weekSlotLabel(17)).toBe('Bowl Week 1')
    expect(weekSlotLabel(19)).toBe('Bowl Week 3 / CFP Semifinals')
    expect(weekSlotLabel(20)).toBe('National Championship')
  })
})
