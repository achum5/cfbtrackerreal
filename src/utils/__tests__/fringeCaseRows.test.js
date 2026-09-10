import { describe, it, expect } from 'vitest'
import {
  getFringeCaseClassOptions,
  sortFringeCasePlayers,
  fringeRowsFromPlayers,
  widenFringeRows,
} from '../fringeCaseRows'

const PLAYERS = [
  { name: 'Zeke Warren', position: 'WR', currentClass: 'So', gameCount: 7 },
  { name: 'Adam Blake', position: 'QB', currentClass: 'Fr', gameCount: 5 },
  { name: 'Cy Mills', position: 'LB', currentClass: 'RS Sr', gameCount: 9 },
]

describe('getFringeCaseClassOptions', () => {
  it('offers progress-or-redshirt for the non-redshirt classes', () => {
    expect(getFringeCaseClassOptions('Fr')).toEqual(['So', 'RS Fr'])
    expect(getFringeCaseClassOptions('So')).toEqual(['Jr', 'RS So'])
    expect(getFringeCaseClassOptions('Jr')).toEqual(['Sr', 'RS Jr'])
  })

  it('offers a single answer once the redshirt is spent, and none at RS Sr', () => {
    expect(getFringeCaseClassOptions('RS Fr')).toEqual(['RS So'])
    expect(getFringeCaseClassOptions('RS Jr')).toEqual(['RS Sr'])
    expect(getFringeCaseClassOptions('RS Sr')).toEqual([])
  })

  it('falls back to the bare class for anything unrecognized', () => {
    expect(getFringeCaseClassOptions('')).toEqual(['Fr'])
    expect(getFringeCaseClassOptions(undefined)).toEqual(['Fr'])
  })
})

describe('sortFringeCasePlayers', () => {
  it('orders by last name and leaves the input alone', () => {
    const input = [...PLAYERS]
    expect(sortFringeCasePlayers(input).map(p => p.name)).toEqual([
      'Adam Blake', 'Cy Mills', 'Zeke Warren',
    ])
    expect(input).toEqual(PLAYERS)
  })
})

describe('fringeRowsFromPlayers', () => {
  const sorted = sortFringeCasePlayers(PLAYERS)

  it('opens on every fringe case, defaulted to the progressed class', () => {
    expect(fringeRowsFromPlayers(sorted, undefined)).toEqual([
      ['Adam Blake', 'QB', 'Fr', '5', 'So'],
      ['Cy Mills', 'LB', 'RS Sr', '9', ''],
      ['Zeke Warren', 'WR', 'So', '7', 'Jr'],
    ])
  })

  it('prefers a decision already saved for the year', () => {
    const saved = [{ playerName: 'adam  blake', selectedClass: 'RS Fr' }]
    expect(fringeRowsFromPlayers(sorted, saved)[0]).toEqual(['Adam Blake', 'QB', 'Fr', '5', 'RS Fr'])
  })

  it('is empty when there are no fringe cases', () => {
    expect(fringeRowsFromPlayers([], undefined)).toEqual([])
  })
})

describe('widenFringeRows', () => {
  const sorted = sortFringeCasePlayers(PLAYERS)

  it('re-attaches context to the local prompt name+class shape', () => {
    expect(widenFringeRows([['Zeke Warren', 'RS So']], sorted)).toEqual([
      ['Zeke Warren', 'WR', 'So', '7', 'RS So'],
    ])
  })

  it('matches names case- and space-insensitively', () => {
    expect(widenFringeRows([['  zeke   warren ', 'Jr']], sorted)[0][1]).toBe('WR')
  })

  it('keeps an unknown name rather than dropping the row', () => {
    expect(widenFringeRows([['Nobody Here', 'Jr']], sorted)).toEqual([
      ['Nobody Here', '', '', '', 'Jr'],
    ])
  })

  it('maps the Google prompt class-only column onto the players by position', () => {
    expect(widenFringeRows([['RS Fr'], ['RS Sr'], ['Jr']], sorted)).toEqual([
      ['Adam Blake', 'QB', 'Fr', '5', 'RS Fr'],
      ['Cy Mills', 'LB', 'RS Sr', '9', 'RS Sr'],
      ['Zeke Warren', 'WR', 'So', '7', 'Jr'],
    ])
  })

  it('leaves rows that are already the full width untouched', () => {
    const full = [['Adam Blake', 'QB', 'Fr', '5', 'RS Fr']]
    expect(widenFringeRows(full, sorted)).toEqual(full)
  })

  it('round-trips its own output', () => {
    const seeded = fringeRowsFromPlayers(sorted, undefined)
    expect(widenFringeRows(seeded, sorted)).toEqual(seeded)
  })

  it('passes an empty paste straight through', () => {
    expect(widenFringeRows([], sorted)).toEqual([])
  })
})
