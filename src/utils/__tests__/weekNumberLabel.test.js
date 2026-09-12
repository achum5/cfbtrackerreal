import { describe, it, expect } from 'vitest'
import { weekNumberLabel, hasWeek, formatWeek, gameWeekLabel } from '../weekLabel'

// Week 0 is the kickoff weekend, so a game really can carry week === 0. Every
// label site used `week ? …` and 0 is falsy, so a Week 0 game was headed
// "Game" on the game page, "Postseason" in a schedule row, and left the week
// off its own line in the AI prompts.

describe('hasWeek', () => {
  it('counts 0 as a real week', () => {
    expect(hasWeek(0)).toBe(true)
    expect(hasWeek('0')).toBe(true)
    expect(hasWeek(6)).toBe(true)
  })
  it('rejects absence and non-numeric labels', () => {
    expect(hasWeek(null)).toBe(false)
    expect(hasWeek(undefined)).toBe(false)
    expect(hasWeek('')).toBe(false)
    expect(hasWeek('Bowl')).toBe(false)
    expect(hasWeek('CCG')).toBe(false)
  })
})

describe('weekNumberLabel', () => {
  it('labels week 0 instead of falling through to the fallback', () => {
    expect(weekNumberLabel(0, 'Game')).toBe('Week 0')
    expect(weekNumberLabel('0', 'Game')).toBe('Week 0')
    expect(weekNumberLabel(0, 'Postseason')).toBe('Week 0')
    expect(weekNumberLabel(0, '', 'Wk')).toBe('Wk 0')
  })
  it('labels any other numeric week the same way', () => {
    expect(weekNumberLabel(1, 'Game')).toBe('Week 1')
    expect(weekNumberLabel(12, '', 'Wk')).toBe('Wk 12')
  })
  it('returns the fallback only when there is no week at all', () => {
    expect(weekNumberLabel(null, 'Game')).toBe('Game')
    expect(weekNumberLabel(undefined, 'Game')).toBe('Game')
    expect(weekNumberLabel('', 'Game')).toBe('Game')
    expect(weekNumberLabel(null, '')).toBe('')
  })
  it('passes a postseason label through unprefixed', () => {
    expect(weekNumberLabel('Bowl', 'Game')).toBe('Bowl')
    expect(weekNumberLabel('CCG', '', 'Wk')).toBe('CCG')
  })
})

describe('the existing helpers still behave', () => {
  it('formatWeek prefixes numbers and passes labels through', () => {
    expect(formatWeek(0)).toBe('Wk 0')
    expect(formatWeek(6, 'Week ')).toBe('Week 6')
    expect(formatWeek('Bowl')).toBe('Bowl')
    expect(formatWeek(null)).toBe('')
  })
  it('gameWeekLabel keeps its postseason shortcuts', () => {
    expect(gameWeekLabel({ isCFPChampionship: true })).toBe('NatChamp')
    expect(gameWeekLabel({ gameType: 'conference_championship' })).toBe('CCG')
    expect(gameWeekLabel({ isBowlGame: true, bowlName: 'Rose Bowl' })).toBe('Rose Bowl')
    expect(gameWeekLabel({ week: 0 })).toBe('Wk 0')
  })
})
