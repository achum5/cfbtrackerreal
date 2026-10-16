import { describe, it, expect } from 'vitest'
import { readableTextOn, getContrastRatio, getContrastTextColor } from '../colorUtils'

describe('readableTextOn', () => {
  it('keeps a readable secondary color (two-tone look survives)', () => {
    // Kentucky: white on royal blue
    expect(readableTextOn('#0033a0', '#ffffff')).toBe('#ffffff')
  })

  it('falls back to black/white when the pair is unreadable', () => {
    // Tulane: light blue on dark green, ~2:1
    const out = readableTextOn('#005837', '#0082ba')
    expect(out).not.toBe('#0082ba')
    expect(getContrastRatio('#005837', out)).toBeGreaterThanOrEqual(3)
  })

  it('tolerates missing or malformed colors', () => {
    expect(readableTextOn(undefined, '#ffffff')).toBe('#ffffff')
    expect(readableTextOn('#005837', undefined)).toBe('#ffffff')
    expect(readableTextOn('red', null)).toBe('#ffffff')
  })
})

describe('getContrastTextColor light/dark cutoff', () => {
  it('gives dark text on mid-light tans/golds (Tulsa)', () => {
    expect(getContrastTextColor('#c5b783')).toBe('#000000')
  })
  it('keeps brand-standard white on Tennessee orange and Carolina blue', () => {
    expect(getContrastTextColor('#FF8200')).toBe('#ffffff')
    expect(getContrastTextColor('#7BAFD4')).toBe('#ffffff')
  })
  it('dark text on maize, white on navy', () => {
    expect(getContrastTextColor('#ffcb05')).toBe('#000000')
    expect(getContrastTextColor('#0033a0')).toBe('#ffffff')
  })
})
