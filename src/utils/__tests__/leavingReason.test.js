import { describe, it, expect } from 'vitest'
import { normalizeLeavingReason, LEAVING_REASONS } from '../leavingReason'

// User report: "When I enter Graduation for reason for leaving it enters them
// into the transfer portal." Downstream compares with strict === against
// 'Graduating' / 'Pro Draft'; anything that misses both is a portal reason.

describe('normalizeLeavingReason', () => {
  it('maps every graduation spelling to Graduating', () => {
    for (const v of ['Graduation', 'graduation', 'Graduated', 'graduate', 'Grad', 'GRADS', ' Graduating ', 'Senior', 'Eligibility exhausted', 'exhausted eligibility'])
      expect(normalizeLeavingReason(v), v).toBe('Graduating')
  })

  it('maps every draft spelling to Pro Draft', () => {
    for (const v of ['Pro Draft', 'pro draft', 'NFL Draft', 'Draft', 'draft', 'NFL', 'Declared', 'Declare for draft', 'declared for the nfl draft'])
      expect(normalizeLeavingReason(v), v).toBe('Pro Draft')
  })

  it('returns the canonical casing for any of the 16 labels', () => {
    for (const r of LEAVING_REASONS) {
      expect(normalizeLeavingReason(r.toLowerCase())).toBe(r)
      expect(normalizeLeavingReason(r.toUpperCase())).toBe(r)
      expect(normalizeLeavingReason(`  ${r}  `)).toBe(r)
    }
  })

  it('leaves an unrecognized reason as typed (still a portal reason)', () => {
    expect(normalizeLeavingReason('Wanted a change')).toBe('Wanted a change')
  })

  it('does not turn a real portal reason into a departure', () => {
    // "Pro Potential" contains "pro" but must not become Pro Draft.
    expect(normalizeLeavingReason('Pro Potential')).toBe('Pro Potential')
    // "Academic Prestige" / "Coach Prestige" must not match graduation.
    expect(normalizeLeavingReason('Academic Prestige')).toBe('Academic Prestige')
  })

  it('returns empty for blank input', () => {
    expect(normalizeLeavingReason('')).toBe('')
    expect(normalizeLeavingReason(null)).toBe('')
    expect(normalizeLeavingReason(undefined)).toBe('')
  })
})
