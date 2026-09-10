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
