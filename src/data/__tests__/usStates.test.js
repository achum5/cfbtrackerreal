import { describe, it, expect } from 'vitest'
import { US_STATES, STATE_CODES, stateName, normalizeStateCode, sameState, stateCodesLine } from '../usStates'

describe('usStates', () => {
  it('covers the 50 states, DC, and the international sentinel', () => {
    expect(STATE_CODES).toHaveLength(52)
    expect(STATE_CODES).toContain('DC')
    expect(STATE_CODES).toContain('Non-US')
    expect(new Set(STATE_CODES).size).toBe(52)
  })

  it('passes a code through untouched', () => {
    expect(normalizeStateCode('GA')).toBe('GA')
    expect(normalizeStateCode('ga')).toBe('GA')
    expect(normalizeStateCode(' Ga ')).toBe('GA')
  })

  it('converts a full name, which is what an AI reply tends to write', () => {
    expect(normalizeStateCode('Georgia')).toBe('GA')
    expect(normalizeStateCode('new york')).toBe('NY')
    expect(normalizeStateCode('NORTH CAROLINA')).toBe('NC')
  })

  it('handles the save file’s CamelCase, no-space spelling', () => {
    expect(normalizeStateCode('NewHampshire')).toBe('NH')
    expect(normalizeStateCode('DistrictOfColumbia')).toBe('DC')
  })

  it('keeps international players marked instead of blanking them', () => {
    expect(normalizeStateCode('NonUS')).toBe('Non-US')
    expect(normalizeStateCode('Non-US')).toBe('Non-US')
    expect(normalizeStateCode('International')).toBe('Non-US')
  })

  it('returns blank for anything that is not a state', () => {
    for (const bad of ['', null, undefined, 'Atlantis', 'XX', 'N/A', 'Ontario']) {
      expect(normalizeStateCode(bad)).toBe('')
    }
  })

  it('gives a display name for a code and leaves an unknown alone', () => {
    expect(stateName('GA')).toBe('Georgia')
    expect(stateName('DC')).toBe('Washington, D.C.')
    expect(stateName('Non-US')).toBe('Non-US')
    expect(stateName('ZZ')).toBe('ZZ')
  })

  it('matches two spellings of the same place', () => {
    expect(sameState('Georgia', 'GA')).toBe(true)
    expect(sameState('NewYork', 'new york')).toBe(true)
    expect(sameState('GA', 'FL')).toBe(false)
    expect(sameState('', '')).toBe(false)
  })

  it('renders a prompt line that matches the list the dropdowns offer', () => {
    expect(stateCodesLine().split(' | ')).toEqual(STATE_CODES)
    expect(stateCodesLine()).toContain('Non-US')
  })

  it('has a name for every code', () => {
    expect(US_STATES.every(s => s.code && s.name)).toBe(true)
  })
})
