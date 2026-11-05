import { describe, it, expect } from 'vitest'
import { mergePreseasonForConference, isSeasonFinished } from '../preseasonHonors'

const conf = (c) => (e) => e.conf === c

describe('mergePreseasonForConference', () => {
  it('replaces only the saved conference and keeps the others', () => {
    const existing = [{ player: 'S1', conf: 'SEC' }, { player: 'B1', conf: 'Big Ten' }]
    const out = mergePreseasonForConference(existing, [{ player: 'S2', conf: 'SEC' }], conf('SEC'))
    expect(out).toEqual([{ player: 'B1', conf: 'Big Ten' }, { player: 'S2', conf: 'SEC' }])
  })
  it('clearing a conference removes its rows and nothing else', () => {
    const existing = [{ player: 'S1', conf: 'SEC' }, { player: 'B1', conf: 'Big Ten' }]
    expect(mergePreseasonForConference(existing, [], conf('SEC'))).toEqual([{ player: 'B1', conf: 'Big Ten' }])
  })
  it('tolerates a missing existing list', () => {
    expect(mergePreseasonForConference(undefined, [{ player: 'S1', conf: 'SEC' }], conf('SEC'))).toEqual([{ player: 'S1', conf: 'SEC' }])
  })
})

describe('isSeasonFinished', () => {
  const at = (currentYear, currentPhase, currentWeek) => ({ currentYear, currentPhase, currentWeek })
  it('a past season is finished', () => {
    expect(isSeasonFinished(at(2027, 'regular_season', 4), 2026)).toBe(true)
    expect(isSeasonFinished(at(2027, 'preseason', 0), '2026')).toBe(true)
  })
  it('the current season is finished from the postseason until the year flips', () => {
    expect(isSeasonFinished(at(2027, 'preseason', 0), 2027)).toBe(false)
    expect(isSeasonFinished(at(2027, 'regular_season', 12), 2027)).toBe(false)
    expect(isSeasonFinished(at(2027, 'postseason', 5), 2027)).toBe(true)
    expect(isSeasonFinished(at(2027, 'offseason', 5), 2027)).toBe(true)
  })
  it('after the year flip the new current year has not been played', () => {
    expect(isSeasonFinished(at(2028, 'offseason', 6), 2028)).toBe(false)
    expect(isSeasonFinished(at(2028, 'offseason', 6), 2027)).toBe(true)
  })
  it('a future year is not finished', () => {
    expect(isSeasonFinished(at(2027, 'postseason', 5), 2028)).toBe(false)
  })
})
