import { describe, it, expect } from 'vitest'
import { normalizePlayerName } from '../playerMatching'
import { findDuplicatePlayerGroups, mergeDuplicatePlayers } from '../playerMerge'
import { computeLiveAwardsByPid, mergeAccoladeLists, matchHonorToPlayer } from '../honorMatch'

const STANFORD = 107

describe('normalizePlayerName — names that look identical compare equal', () => {
  const same = (a, b) => expect(normalizePlayerName(a)).toBe(normalizePlayerName(b))

  it('non-breaking and doubled spaces', () => {
    same('Santiago Sendejo', 'Santiago Sendejo')
    same('Santiago Sendejo', 'Santiago  Sendejo')
    same('Santiago Sendejo', ' Santiago Sendejo\t')
  })

  it('zero-width, BOM, soft hyphen and control characters', () => {
    same('Santiago Sendejo', 'Santiago Sende​jo')
    same('Santiago Sendejo', '﻿Santiago Sendejo')
    same('Santiago Sendejo', 'Santiago Sen­dejo')
    same('Santiago Sendejo', 'Santiago Sendejo\u0000')
  })

  it('tabs/newlines still separate first and last name', () => {
    expect(normalizePlayerName('Santiago\tSendejo')).toBe('santiago sendejo')
    expect(normalizePlayerName('Santiago\nSendejo')).toBe('santiago sendejo')
  })

  it('accents, either precomposed or combining', () => {
    same('José Ruiz', 'Jose Ruiz')
    same('José Ruiz', 'José Ruiz')
  })

  it('curly apostrophes and Cyrillic look-alike letters', () => {
    same('D’Andre Swift', "D'Andre Swift")
    same('Sаntiago Sendejo', 'Santiago Sendejo')
  })

  it('keeps existing punctuation rules and still tells different names apart', () => {
    same('John Smith Jr.', 'John Smith Jr')
    same('Smith, Jr', 'Smith Jr')
    expect(normalizePlayerName('Mike Smith')).not.toBe(normalizePlayerName('Mike Smyth'))
    expect(normalizePlayerName('')).toBe('')
    expect(normalizePlayerName(null)).toBe('')
  })
})

describe('findDuplicatePlayerGroups', () => {
  it('groups a pair whose names differ only invisibly (the Danger Zone miss)', () => {
    const players = [
      { pid: 12, name: 'Santiago Sendejo', teamsByYear: { 2027: STANFORD } },
      { pid: 900, name: 'Santiago Sendejo', teamsByYear: { 2030: STANFORD } },
      { pid: 13, name: 'Somebody Else' },
    ]
    const groups = findDuplicatePlayerGroups(players)
    expect(groups).toHaveLength(1)
    expect(groups[0].players.map(p => p.pid)).toEqual([12, 900])
    // Display name is the real record's name, not the comparison key.
    expect(groups[0].name).toBe('Santiago Sendejo')
  })

  it('returns nothing when every name is unique', () => {
    expect(findDuplicatePlayerGroups([{ pid: 1, name: 'A B' }, { pid: 2, name: 'C D' }, { pid: 3 }])).toEqual([])
  })
})

describe('mergeDuplicatePlayers', () => {
  const primary = {
    pid: 12,
    name: 'Santiago Sendejo',
    position: 'SAM',
    teamsByYear: { 2027: STANFORD, 2028: STANFORD, 2029: STANFORD, 2030: STANFORD },
    classByYear: { 2027: 'Fr', 2028: 'So', 2029: 'Jr', 2030: 'Sr' },
    devTraitByYear: { 2029: 'Star' },
    statsByYear: { 2029: { defense: { tackles: 90 } } },
    accolades: [
      { year: 2028, award: 'broncoNagurski' },
      { year: 2028, award: 'dickButkus' },
    ],
    allAmericans: [{ year: 2029, designation: 'first', position: 'SAM' }],
    allConference: [],
  }
  const dup = {
    pid: 900,
    name: 'Santiago Sendejo',
    position: 'SAM',
    teamsByYear: { 2030: STANFORD },
    classByYear: { 2030: 'Sr' },
    devTraitByYear: { 2029: 'Normal', 2030: 'Elite' },
    statsByYear: { 2030: { defense: { tackles: 101 } } },
    accolades: [
      { year: 2030, award: 'Chuck Bednarik Award' },
      { year: 2028, award: 'Bronco Nagurski Trophy' }, // same as primary's, label form
    ],
    allAmericans: [
      { year: 2029, designation: 'first', position: 'SAM' },
      { year: 2030, designation: 'first', position: 'SAM' },
    ],
    allConference: [{ year: 2030, designation: 'first', position: 'SAM' }],
    pictureUrl: 'https://example.com/p.png',
  }

  it('carries the duplicate\'s awards and honors instead of dropping them', () => {
    const m = mergeDuplicatePlayers(primary, [dup])
    expect(m.pid).toBe(12)
    expect(m.accolades.map(a => `${a.year}:${a.award}`)).toEqual([
      '2028:broncoNagurski', '2028:dickButkus', '2030:Chuck Bednarik Award',
    ])
    expect(m.allAmericans.map(h => h.year)).toEqual([2029, 2030])
    expect(m.allConference.map(h => h.year)).toEqual([2030])
  })

  it('merges stats per season and gap-fills other per-season maps', () => {
    const m = mergeDuplicatePlayers(primary, [dup])
    expect(m.statsByYear[2029].defense.tackles).toBe(90)
    expect(m.statsByYear[2030].defense.tackles).toBe(101)
    // Primary's season stays; the season it lacked is filled.
    expect(m.devTraitByYear).toEqual({ 2029: 'Star', 2030: 'Elite' })
    expect(m.teamsByYear[2027]).toBe(STANFORD)
    expect(m.pictureUrl).toBe('https://example.com/p.png')
  })

  it('does not mutate the inputs', () => {
    const before = JSON.stringify(primary)
    mergeDuplicatePlayers(primary, [dup])
    expect(JSON.stringify(primary)).toBe(before)
  })
})

describe('computeLiveAwardsByPid — synced awards reach the profile', () => {
  const base = () => ({
    teams: { [STANFORD]: { abbr: 'STAN' } },
    players: [
      { pid: 12, name: 'Santiago Sendejo', teamsByYear: { 2030: STANFORD }, accolades: [{ year: 2028, award: 'dickButkus' }] },
      { pid: 40, name: 'Other Guy', teamsByYear: { 2030: 5 } },
    ],
    awardsByYear: {
      2030: {
        chuckBednarik: { player: 'Santiago Sendejo', position: 'SAM', team: 'STAN' },
        broncoNagurski: { player: 'Santiago Sendejo', position: 'SAM', team: 'STAN' },
        dickButkus: { player: 'Santiago Sendejo', position: 'SAM', team: 'STAN' },
        bearBryantCoachOfTheYear: { player: 'Santiago Sendejo', team: 'STAN' },
        heisman: { player: 'Nobody On Roster', team: 'STAN' },
      },
    },
  })

  it('attaches each player award to the matching roster player', () => {
    const live = computeLiveAwardsByPid(base())
    const awards = (live.get(12) || []).map(a => `${a.year}:${a.award}`).sort()
    expect(awards).toEqual(['2030:broncoNagurski', '2030:chuckBednarik', '2030:dickButkus'])
    expect(live.has(40)).toBe(false)
  })

  it('never hands a coach award to a player', () => {
    const live = computeLiveAwardsByPid(base())
    expect((live.get(12) || []).some(a => a.award === 'bearBryantCoachOfTheYear')).toBe(false)
  })

  it('leaves an award alone once any player has it stored for that season', () => {
    const d = base()
    d.players.push({ pid: 77, name: 'Santiago Sendejo', teamsByYear: { 2030: 9 }, accolades: [{ year: 2030, award: 'Chuck Bednarik Award' }] })
    const live = computeLiveAwardsByPid(d)
    expect((live.get(12) || []).some(a => a.award === 'chuckBednarik')).toBe(false)
  })

  it('merges with stored accolades without doubling label vs key rows', () => {
    const merged = mergeAccoladeLists(
      [{ year: 2030, award: 'Dick Butkus Award' }],
      [{ year: 2030, award: 'dickButkus' }, { year: 2030, award: 'chuckBednarik' }]
    )
    expect(merged).toHaveLength(2)
  })

  it('honor matcher sees through invisible name differences', () => {
    const d = base()
    expect(matchHonorToPlayer(d, 'Santiago​ Sendejo', 'STAN', STANFORD)?.pid).toBe(12)
  })
})
