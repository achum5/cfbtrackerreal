import { describe, it, expect } from 'vitest'
import { titleForPath, composeTitle, SITE_NAME } from '../pageTitle'

describe('titleForPath', () => {
  it('names dynasty sections and the dynasty', () => {
    expect(titleForPath('/dynasty/abc/rankings/2035', 'Kentucky Wildcats'))
      .toBe(`Top 25 – Kentucky Wildcats – ${SITE_NAME}`)
    expect(titleForPath('/dynasty/abc', 'Kentucky Wildcats'))
      .toBe(`Dashboard – Kentucky Wildcats – ${SITE_NAME}`)
    expect(titleForPath('/dynasty/abc/', 'Kentucky Wildcats'))
      .toBe(`Dashboard – Kentucky Wildcats – ${SITE_NAME}`)
  })

  it('leaves player, team and game pages to set their own title', () => {
    expect(titleForPath('/dynasty/abc/player/12', 'Kentucky Wildcats')).toBeNull()
    expect(titleForPath('/dynasty/abc/team/109/2035', 'Kentucky Wildcats')).toBeNull()
    expect(titleForPath('/dynasty/abc/game/g-1', 'Kentucky Wildcats')).toBeNull()
    expect(titleForPath('/dynasty/abc/game/g-1/edit', 'Kentucky Wildcats'))
      .toBe(`Edit Game – Kentucky Wildcats – ${SITE_NAME}`)
    expect(titleForPath('/dynasty/abc/game/new', 'Kentucky Wildcats'))
      .toBe(`New Game – Kentucky Wildcats – ${SITE_NAME}`)
    expect(titleForPath('/view/code/player/12')).toBeNull()
  })

  it('handles top-level and unknown paths', () => {
    expect(titleForPath('/')).toBe(`My Dynasties – ${SITE_NAME}`)
    expect(titleForPath('/contact')).toBe(`Contact – ${SITE_NAME}`)
    expect(titleForPath('/somewhere-else')).toBe(SITE_NAME)
    expect(titleForPath('/dynasty/abc/unknown-section')).toBe(SITE_NAME)
  })

  it('composeTitle skips empty parts', () => {
    expect(composeTitle('Frank Hall', null, '')).toBe(`Frank Hall – ${SITE_NAME}`)
  })
})
