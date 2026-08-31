import { describe, it, expect } from 'vitest'
import { TROPHIES, TROPHY_BY_ID } from '../../data/trophies'
import { getRivalryTrophyForTeams } from '../trophyEngine'

// Buffalo = tid 16 ("Buffalo Bulls"), Massachusetts = tid 54 ("Massachusetts
// Minutemen"). The catalog lists rivalry `teams` by mascot-stripped school
// name, so these entries only work if the name resolves — a typo'd school name
// silently yields a trophy that can never be won by anyone.
const BUFFALO = 16
const UMASS = 54

describe('Flagship Cup', () => {
  it('is contested when Buffalo and Massachusetts meet', () => {
    const trophy = getRivalryTrophyForTeams({}, BUFFALO, UMASS)
    expect(trophy?.id).toBe('flagship-cup')
    expect(trophy?.name).toBe('Flagship Cup')
    expect(trophy?.image).toBe('https://i.imgur.com/3MxGWVv.png')
  })

  it('resolves regardless of team order', () => {
    expect(getRivalryTrophyForTeams({}, UMASS, BUFFALO)?.id).toBe('flagship-cup')
  })

  it('is not awarded for unrelated matchups involving either school', () => {
    // Buffalo vs Akron (tid 2 territory) must not pick up the Flagship Cup.
    const other = getRivalryTrophyForTeams({}, BUFFALO, 1)
    expect(other?.id).not.toBe('flagship-cup')
  })

  it('keeps every catalog id unique', () => {
    const ids = TROPHIES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carries the standard rivalry-entry shape', () => {
    const t = TROPHY_BY_ID['flagship-cup']
    expect(t.category).toBe('rivalry')
    expect(t.teams).toEqual(['Buffalo', 'Massachusetts'])
    expect(t.availableIn).toEqual(['Dynasty', 'Road to Glory', 'Play Now'])
    expect(t.history).toBeTruthy()
    expect(t.howToEarn).toBeTruthy()
  })
})
