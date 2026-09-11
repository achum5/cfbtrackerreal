import { describe, it, expect } from 'vitest'
import { parseTrainingResultsLocal, TRAINING_DEV_TRAITS } from '../sheetsService'

const row = (...cells) => cells

describe('parseTrainingResultsLocal — the appended player-card columns', () => {
  it('reads all eight columns', () => {
    expect(parseTrainingResultsLocal([
      row('Alex Guess', 'QB', '87', '90', '12', 'Elite', 'Dual Threat', '250000'),
    ])).toEqual([
      {
        playerName: 'Alex Guess', position: 'QB', pastOverall: 87, newOverall: 90,
        jerseyNumber: 12, devTrait: 'Elite', archetype: 'Dual Threat', nil: 250000,
      },
    ])
  })

  it('leaves the two new columns null when the player card was not captured', () => {
    const [r] = parseTrainingResultsLocal([row('Alex Guess', 'QB', '87', '90', '', '')])
    expect(r.jerseyNumber).toBeNull()
    expect(r.devTrait).toBeNull()
  })

  it('still parses a four-column row, so an older paste keeps working', () => {
    expect(parseTrainingResultsLocal([row('Alex Guess', 'QB', '87', '90')])).toEqual([
      {
        playerName: 'Alex Guess', position: 'QB', pastOverall: 87, newOverall: 90,
        jerseyNumber: null, devTrait: null, archetype: null, nil: null,
      },
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

  it('reads archetype and NIL from the last two columns', () => {
    const [r] = parseTrainingResultsLocal([row('A B', 'QB', '70', '72', '4', 'Star', 'Dual Threat', '250000')])
    expect(r.archetype).toBe('Dual Threat')
    expect(r.nil).toBe(250000)
  })

  it('snaps archetype casing and drops one the game does not have', () => {
    expect(parseTrainingResultsLocal([row('A B', 'QB', '70', '72', '', '', 'dual threat')])[0].archetype).toBe('Dual Threat')
    expect(parseTrainingResultsLocal([row('A B', 'QB', '70', '72', '', '', 'Cannon Arm')])[0].archetype).toBeNull()
  })

  it('strips the currency dressing a screenshot reader carries over', () => {
    expect(parseTrainingResultsLocal([row('A B', 'QB', '70', '72', '', '', '', '$250,000')])[0].nil).toBe(250000)
    expect(parseTrainingResultsLocal([row('A B', 'QB', '70', '72', '', '', '', ' 90000 ')])[0].nil).toBe(90000)
  })

  it('drops shorthand and negative NIL rather than guessing', () => {
    for (const bad of ['250K', '1.2M', '-5', 'n/a']) {
      expect(parseTrainingResultsLocal([row('A B', 'QB', '70', '72', '', '', '', bad)])[0].nil).toBeNull()
    }
  })

  it('keeps a NIL of 0, which is a real amount', () => {
    expect(parseTrainingResultsLocal([row('A B', 'QB', '70', '72', '', '', '', '0')])[0].nil).toBe(0)
  })
})
