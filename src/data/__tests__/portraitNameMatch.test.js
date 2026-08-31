import { describe, it, expect } from 'vitest'
import { squashName, candidatesFor, portraitIdForName } from '../portraitNameMatch'

// The pack names files Last+First with no separator, so the split has to be
// solved from the player side. These lock down that the real observed formats
// resolve, and that ambiguity never turns into a guess.
const INDEX = {
  smithjeremiah: 8726,   // Unique_SmithJeremiah_8726
  robertsben: 4212,      // nilpp_Unique_RobertsBen_4212
  dixonwyattkayden: 555, // hyphenated surname
  gordonbrent: 777,      // pack omitted the "Jr."
}

describe('squashName', () => {
  it('strips case, punctuation, spacing and accents', () => {
    expect(squashName("D'Marcus Smith-Jones Jr.")).toBe('dmarcussmithjonesjr')
    expect(squashName('José Álvarez')).toBe('josealvarez')
  })
})

describe('candidatesFor', () => {
  it('emits both orderings for a two-part name', () => {
    const c = candidatesFor('Jeremiah Smith')
    expect(c).toContain('smithjeremiah')
    expect(c).toContain('jeremiahsmith')
  })

  it('uses explicit name parts when present', () => {
    expect(candidatesFor({ firstName: 'Ben', lastName: 'Roberts' })).toContain('robertsben')
  })

  it('emits a suffix-stripped variant as a fallback', () => {
    const c = candidatesFor('Brent Gordon Jr.')
    expect(c).toContain('gordonbrent')
    // ...but the full-name form is tried first, so an exact pack match wins.
    expect(c.indexOf('gordonjrbrent')).toBeLessThan(c.indexOf('gordonbrent'))
  })
})

describe('portraitIdForName', () => {
  it('matches the pack Last+First convention from a plain full name', () => {
    expect(portraitIdForName('Jeremiah Smith', INDEX)).toBe(8726)
    expect(portraitIdForName('Ben Roberts', INDEX)).toBe(4212)
  })

  it('matches a hyphenated surname', () => {
    expect(portraitIdForName('Kayden Dixon-Wyatt', INDEX)).toBe(555)
  })

  it('matches when the roster carries a suffix the pack omits', () => {
    expect(portraitIdForName('Brent Gordon Jr.', INDEX)).toBe(777)
  })

  it('returns null for a name not in the index', () => {
    expect(portraitIdForName('Nobody Here', INDEX)).toBeNull()
  })

  it('returns null with no index rather than throwing', () => {
    expect(portraitIdForName('Jeremiah Smith', null)).toBeNull()
  })

  it('never invents a match for a blank name', () => {
    expect(portraitIdForName('', INDEX)).toBeNull()
    expect(portraitIdForName({ firstName: '', lastName: '' }, INDEX)).toBeNull()
  })
})
