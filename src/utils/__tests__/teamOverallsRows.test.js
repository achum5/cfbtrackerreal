import { describe, it, expect } from 'vitest'
import { parseRating, resolveTeamCell, teamOverallRows, parseTeamOverallRows } from '../teamOverallsRows'

const TEAMS = {
  1: { tid: 1, name: 'Alabama', abbr: 'BAMA' },
  2: { tid: 2, name: 'Georgia', abbr: 'UGA' },
  3: { tid: 3, name: 'Massachusetts', abbr: 'UMASS' },
  9: { tid: 9, name: 'Some FCS School', abbr: 'FCS1', isFCS: true },
}
const stored = { 1: { overall: 90, offense: 91, defense: 88 } }
const ratingsFor = (tid) => stored[tid] || {}

describe('parseRating', () => {
  it('keeps an integer in range, including 0', () => {
    expect(parseRating('90')).toBe(90)
    expect(parseRating(' 0 ')).toBe(0)
    expect(parseRating(99)).toBe(99)
  })
  it('rejects anything else rather than guessing', () => {
    for (const bad of ['', null, undefined, '100', '-1', '88.5', 'A+', 'n/a']) {
      expect(parseRating(bad)).toBeNull()
    }
  })
})

describe('resolveTeamCell', () => {
  it('resolves a team name and an abbreviation', () => {
    expect(resolveTeamCell('Alabama', TEAMS)).toBe(1)
    expect(resolveTeamCell('UGA', TEAMS)).toBe(2)
  })
  it('returns null for a school it cannot place', () => {
    expect(resolveTeamCell('Hogwarts', TEAMS)).toBeNull()
    expect(resolveTeamCell('', TEAMS)).toBeNull()
  })
})

describe('teamOverallRows', () => {
  const rows = teamOverallRows(TEAMS, ratingsFor)

  it('opens on every FBS team, alphabetically, and leaves FCS out', () => {
    expect(rows.map(r => r.cells[0])).toEqual(['Alabama', 'Georgia', 'Massachusetts'])
  })

  it('pre-fills the ratings already stored, and blanks the rest', () => {
    expect(rows[0].cells).toEqual(['Alabama', '90', '91', '88'])
    expect(rows[1].cells).toEqual(['Georgia', '', '', ''])
  })
})

describe('parseTeamOverallRows', () => {
  it('keeps only the teams whose values actually changed', () => {
    const { changed } = parseTeamOverallRows([
      ['Alabama', '90', '91', '88'],   // unchanged
      ['Georgia', '87', '85', '89'],   // new
    ], TEAMS, ratingsFor)
    expect(changed).toEqual({ 2: { overall: 87, offense: 85, defense: 89 } })
  })

  it('counts a re-import of the untouched grid as no change at all', () => {
    const rows = teamOverallRows(TEAMS, ratingsFor).map(r => r.cells)
    const { changed, blank } = parseTeamOverallRows(rows, TEAMS, ratingsFor)
    expect(changed).toEqual({})
    expect(blank).toBe(2)
  })

  it('reports a school it could not place instead of dropping it', () => {
    const { changed, unmatched } = parseTeamOverallRows([['Hogwarts', '99', '', '']], TEAMS, ratingsFor)
    expect(changed).toEqual({})
    expect(unmatched).toEqual(['Hogwarts'])
  })

  it('accepts a row with only an overall', () => {
    const { changed } = parseTeamOverallRows([['Georgia', '87']], TEAMS, ratingsFor)
    expect(changed).toEqual({ 2: { overall: 87, offense: null, defense: null } })
  })

  it('skips a pasted header row', () => {
    const { changed, unmatched } = parseTeamOverallRows([
      ['Team', 'OVR', 'OFF', 'DEF'],
      ['Georgia', '87', '', ''],
    ], TEAMS, ratingsFor)
    expect(unmatched).toEqual([])
    expect(Object.keys(changed)).toEqual(['2'])
  })

  it('lets a later duplicate row win, the way a later edit would', () => {
    const { changed } = parseTeamOverallRows([
      ['Georgia', '80', '', ''],
      ['Georgia', '87', '', ''],
    ], TEAMS, ratingsFor)
    expect(changed[2].overall).toBe(87)
  })

  it('drops a team back out when a later row restores its stored values', () => {
    const { changed } = parseTeamOverallRows([
      ['Alabama', '70', '70', '70'],
      ['Alabama', '90', '91', '88'],
    ], TEAMS, ratingsFor)
    expect(changed).toEqual({})
  })

  it('handles an empty paste', () => {
    expect(parseTeamOverallRows([], TEAMS, ratingsFor)).toEqual({ changed: {}, unmatched: [], blank: 0 })
  })
})
