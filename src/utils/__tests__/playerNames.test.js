import { describe, it, expect } from 'vitest'
import { splitLastFirst, getDisplayLastName, getSortableLastName } from '../playerNames'

// Roster lists sort by surname. Taking the last whitespace token as the
// surname files a suffixed player under the suffix — "AJ Azuakolam Jr."
// under J, "Michael Robinson II" under I — so suffixed players scatter into
// the wrong letters. That surfaced as a user reporting the site's roster
// "not matching" the game's when the two held byte-identical players in a
// different order.

describe('splitLastFirst', () => {
  it('keeps a generational suffix attached to the surname', () => {
    expect(splitLastFirst('AJ Azuakolam Jr.')).toEqual(['Azuakolam Jr.', 'AJ'])
    expect(splitLastFirst('Tim Baldwin Jr')).toEqual(['Baldwin Jr', 'Tim'])
    expect(splitLastFirst('Michael Robinson II')).toEqual(['Robinson II', 'Michael'])
    expect(splitLastFirst('William Watson III')).toEqual(['Watson III', 'William'])
  })

  it('leaves ordinary and hyphenated names alone', () => {
    expect(splitLastFirst('Reece Adkins')).toEqual(['Adkins', 'Reece'])
    expect(splitLastFirst('Justin Williams-Thomas')).toEqual(['Williams-Thomas', 'Justin'])
    expect(splitLastFirst('T.Y. Harding')).toEqual(['Harding', 'T.Y.'])
  })

  it('handles a single-token name and empty input', () => {
    expect(splitLastFirst('Prince')).toEqual(['Prince', ''])
    expect(splitLastFirst('')).toEqual(['', ''])
    expect(splitLastFirst(null)).toEqual(['', ''])
  })

  it('keeps both tokens as the surname when a name is only surname + suffix', () => {
    // Sorting "Smith Jr" under J while blanking the first name would be
    // worse than treating the whole thing as the surname.
    expect(splitLastFirst('Smith Jr')).toEqual(['Smith Jr', ''])
  })

  it('collapses irregular whitespace', () => {
    expect(splitLastFirst('  AJ   Azuakolam   Jr. ')).toEqual(['Azuakolam Jr.', 'AJ'])
  })
})

describe('surname sort order', () => {
  it('files suffixed players under their real surname', () => {
    const roster = [
      'Owen Anderson', 'AJ Azuakolam Jr.', 'Tim Baldwin Jr', 'Jimmie Bartow',
      'Michael Robinson II', 'Isaiah Reed', 'William Watson III', 'Corey Warner',
    ]
    const sorted = [...roster].sort((a, b) =>
      getSortableLastName(a).localeCompare(getSortableLastName(b)))
    expect(sorted).toEqual([
      'Owen Anderson', 'AJ Azuakolam Jr.', 'Tim Baldwin Jr', 'Jimmie Bartow',
      'Isaiah Reed', 'Michael Robinson II', 'Corey Warner', 'William Watson III',
    ])
  })

  it('is what the naive last-token split gets wrong', () => {
    const naive = (n) => n.trim().split(/\s+/).pop().toLowerCase()
    expect(naive('AJ Azuakolam Jr.')).toBe('jr.')
    expect(getSortableLastName('AJ Azuakolam Jr.')).toBe('azuakolam jr.')
  })
})

describe('getDisplayLastName', () => {
  it('shows the surname with its suffix', () => {
    expect(getDisplayLastName('AJ Azuakolam Jr.')).toBe('Azuakolam Jr.')
    expect(getDisplayLastName('Reece Adkins')).toBe('Adkins')
  })
})
