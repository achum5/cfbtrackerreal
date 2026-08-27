import { describe, it, expect } from 'vitest'
import { conferenceTeams, getTeamConference } from '../conferenceTeams'

// conferenceTeams is the fallback a dynasty with no stored alignment of its
// own resolves against (getTeamConference checks customConferences first,
// and a PC dynasty is rewritten from its save every sync). A wrong entry
// silently misfiles that team's conference standings, CC history, and every
// isConferenceGame check — so the CFB 27 realignment is pinned here rather
// than left to drift a second time. It sat on the 2024-2025 alignment with
// eleven teams in the wrong conference.

const conferenceOf = (abbr) => {
  for (const [conf, abbrs] of Object.entries(conferenceTeams)) {
    if (abbrs.includes(abbr)) return conf
  }
  return null
}

describe('CFB 27 conference alignment', () => {
  it('puts the rebuilt Pac-12 together', () => {
    expect(conferenceTeams['Pac-12'].slice().sort()).toEqual(
      ['BOIS', 'CSU', 'FRES', 'ORST', 'SDSU', 'TXST', 'USU', 'WSU'])
  })

  it.each([
    ['BOIS', 'Pac-12'], ['CSU', 'Pac-12'], ['FRES', 'Pac-12'],
    ['SDSU', 'Pac-12'], ['USU', 'Pac-12'], ['TXST', 'Pac-12'],
    ['MASS', 'MAC'], ['NIU', 'Mountain West'], ['UTEP', 'Mountain West'],
    ['LT', 'Sun Belt'], ['JKST', 'Conference USA'],
  ])('%s is in %s', (abbr, conf) => {
    expect(conferenceOf(abbr)).toBe(conf)
  })

  it('leaves every team in exactly one conference, covering all 138', () => {
    const all = Object.values(conferenceTeams).flat()
    expect(all).toHaveLength(138)
    expect(new Set(all).size).toBe(138)
  })

  it('keeps Notre Dame and UConn as the only independents', () => {
    expect(conferenceTeams['Independent'].slice().sort()).toEqual(['CONN', 'ND'])
  })

  it('still lets a dynasty override the default', () => {
    // customConferences wins, so a realigned dynasty is unaffected by this map.
    expect(getTeamConference('BOIS', { 'Mountain West': ['BOIS'] })).toBe('Mountain West')
    expect(getTeamConference('BOIS', null)).toBe('Pac-12')
  })
})
