import { describe, it, expect } from 'vitest'
import { parseTrainingResultsLocal, TRAINING_DEV_TRAITS } from '../sheetsService'

const row = (...cells) => cells

describe('parseTrainingResultsLocal — jersey # and dev trait', () => {
  it('reads all six columns', () => {
    expect(parseTrainingResultsLocal([row('Alex Guess', 'QB', '87', '90', '12', 'Elite')])).toEqual([
      { playerName: 'Alex Guess', position: 'QB', pastOverall: 87, newOverall: 90, jerseyNumber: 12, devTrait: 'Elite' },
    ])
  })

  it('leaves the two new columns null when the player card was not captured', () => {
    const [r] = parseTrainingResultsLocal([row('Alex Guess', 'QB', '87', '90', '', '')])
    expect(r.jerseyNumber).toBeNull()
    expect(r.devTrait).toBeNull()
  })

  it('still parses a four-column row, so an older paste keeps working', () => {
    expect(parseTrainingResultsLocal([row('Alex Guess', 'QB', '87', '90')])).toEqual([
      { playerName: 'Alex Guess', position: 'QB', pastOverall: 87, newOverall: 90, jerseyNumber: null, devTrait: null },
    ])
  })

  it('accepts jersey 0 and strips a leading #', () => {
    expect(parseTrainingResultsLocal([row('A B', 'WR', '70', '72', '0')])[0].jerseyNumber).toBe(0)
    expect(parseTrainingResultsLocal([row('A B', 'WR', '70', '72', '#7')])[0].jerseyNumber).toBe(7)
  })

  it('drops an out-of-range or non-numeric jersey rather than writing it through', () => {
    for (const bad of ['100', '-1', 'twelve', '7.5']) {
      expect(parseTrainingResultsLocal([row('A B', 'WR', '70', '72', bad)])[0].jerseyNumber).toBeNull()
    }
  })

  it('snaps a dev trait onto its canonical casing', () => {
    expect(parseTrainingResultsLocal([row('A B', 'WR', '70', '72', '', 'elite')])[0].devTrait).toBe('Elite')
    expect(parseTrainingResultsLocal([row('A B', 'WR', '70', '72', '', '  STAR ')])[0].devTrait).toBe('Star')
  })

  it('drops an unrecognized dev trait — a typo must not become the player’s trait', () => {
    expect(parseTrainingResultsLocal([row('A B', 'WR', '70', '72', '', 'Superstar')])[0].devTrait).toBeNull()
  })

  it('treats Hidden as a real value, not an absence', () => {
    expect(parseTrainingResultsLocal([row('A B', 'WR', '70', '72', '', 'Hidden')])[0].devTrait).toBe('Hidden')
    expect(TRAINING_DEV_TRAITS).toContain('Hidden')
  })
})
