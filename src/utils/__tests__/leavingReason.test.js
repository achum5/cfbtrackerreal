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

// ── NIL ────────────────────────────────────────────────────────────────
// Added as a transfer-out reason. It is a PORTAL reason, so it must never
// normalize to Graduating / Pro Draft and must survive the round trip that
// files a departure as a transfer rather than a graduation.
import { PORTAL_REASONS, isPortalReason, isGraduatingReason, isProDraftReason, NIL } from '../leavingReason'

describe('NIL as a transfer-out reason', () => {
  it('is a canonical reason and a portal reason, not graduation or the draft', () => {
    expect(LEAVING_REASONS).toContain('NIL')
    expect(PORTAL_REASONS).toContain('NIL')
    expect(NIL).toBe('NIL')
    expect(isGraduatingReason('NIL')).toBe(false)
    expect(isProDraftReason('NIL')).toBe(false)
    expect(isPortalReason('NIL')).toBe(true)
  })

  it('normalizes the ways people actually write it', () => {
    for (const raw of ['NIL', 'nil', ' Nil ', 'n.i.l.', 'N.I.L', 'nil money', 'NIL Money', 'name image likeness', 'Name, Image and Likeness']) {
      expect(normalizeLeavingReason(raw), raw).toBe('NIL')
    }
  })

  it('does not swallow unrelated reasons', () => {
    expect(normalizeLeavingReason('Playing Time')).toBe('Playing Time')
    expect(normalizeLeavingReason('Graduation')).toBe('Graduating')
    expect(normalizeLeavingReason('declared')).toBe('Pro Draft')
    // "nil" as a bare substring of another word must not match.
    expect(normalizeLeavingReason('Wilmington')).toBe('Wilmington')
  })

  it('PORTAL_REASONS is the canonical list minus graduation and the draft', () => {
    expect(PORTAL_REASONS).toEqual(LEAVING_REASONS.filter(r => r !== 'Graduating' && r !== 'Pro Draft'))
    expect(PORTAL_REASONS).not.toContain('Graduating')
    expect(PORTAL_REASONS).not.toContain('Pro Draft')
    // The player page's "Transfer: X" chip reads this list; Playing Time was
    // missing from the hand-maintained copy it replaced.
    expect(PORTAL_REASONS).toContain('Playing Time')
  })
})
