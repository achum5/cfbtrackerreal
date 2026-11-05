import { describe, it, expect } from 'vitest'
import { getTidFromTeamText } from '../teams'
import { TEAMS } from '../teamRegistry'

// "Ohio St" also offered its mascot-stripped form "ohio", and the first team
// scanned won — Ohio, not Ohio State. Pasted honors were filed under the
// wrong school and conference (and linked to the wrong player record).

const nameOf = (text) => TEAMS[getTidFromTeamText(text)]?.name ?? null

describe('getTidFromTeamText — "St" schools', () => {
  it.each([
    ['Ohio St', 'Ohio State Buckeyes'],
    ['Ohio St.', 'Ohio State Buckeyes'],
    ['Michigan St', 'Michigan State Spartans'],
    ['Florida St', 'Florida State Seminoles'],
    ['Arizona St', 'Arizona State Sun Devils'],
    ['Iowa St', 'Iowa State Cyclones'],
    ['Oregon St', 'Oregon State Beavers'],
    ['Washington St', 'Washington State Cougars'],
    ['Colorado St', 'Colorado State Rams'],
    ['Texas St', 'Texas State Bobcats'],
    ['Arkansas St', 'Arkansas State Red Wolves'],
  ])('%s → %s', (text, name) => {
    expect(nameOf(text)).toBe(name)
  })

  it('the plain school names still resolve to themselves', () => {
    expect(nameOf('Ohio')).toBe('Ohio Bobcats')
    expect(nameOf('Michigan')).toBe('Michigan Wolverines')
    expect(nameOf('Texas Longhorns')).toBe('Texas Longhorns')
    expect(nameOf('Boise St')).toBe(TEAMS[getTidFromTeamText('Boise State')]?.name)
  })

  it('a trailing school qualifier is never stripped into another school', () => {
    expect(nameOf('Florida Intl')).not.toBe('Florida Gators')
  })
})
