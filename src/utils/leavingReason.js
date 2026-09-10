// Canonical Players-Leaving reasons and a normalizer for whatever the user
// actually typed.
//
// The reason arrives as FREE TEXT — a Google Sheet cell, a local TSV paste, or
// an AI-filled prompt — and downstream it is compared with strict `===`
// against 'Graduating' / 'Pro Draft' in a dozen places (Dashboard's save
// handler, rosterModel's v2 conversion, TeamYear/PlayersLeaving labels, the
// Transfer Destinations pre-fill). Anything that fails BOTH comparisons is,
// by design, a transfer-portal reason.
//
// So "Graduation", "graduated", "Grad", "GRADUATING " (trailing space) all
// silently filed a senior into the transfer portal with an unknown
// destination. User report: "When I enter Graduation for reason for leaving
// it enters them into the transfer portal. What am I doing wrong" — nothing;
// the app was matching a label, not a meaning.
//
// Normalize ONCE at ingestion. Every comparer downstream keeps its strict
// check and simply starts receiving canonical strings.

export const LEAVING_REASONS = [
  'Graduating',
  'Pro Draft',
  'Playing Style',
  'Proximity to Home',
  'Championship Contender',
  'Program Tradition',
  'Campus Lifestyle',
  'Stadium Atmosphere',
  'Pro Potential',
  'Brand Exposure',
  'Academic Prestige',
  'Conference Prestige',
  'Coach Stability',
  'Coach Prestige',
  'Athletic Facilities',
  'Playing Time',
  'NIL',
]

export const GRADUATING = 'Graduating'
export const PRO_DRAFT = 'Pro Draft'
export const NIL = 'NIL'

/**
 * The transfer-OUT reasons: everything that isn't graduation or the pro
 * draft. Derived so the portal dropdowns (player editor), the "Transfer: X"
 * chip on the player page and the Players Leaving prompt can't drift out of
 * sync with the canonical list again — adding a reason above is now the
 * only edit needed.
 */
export const PORTAL_REASONS = LEAVING_REASONS.filter(
  (r) => r !== GRADUATING && r !== PRO_DRAFT
)
export const isPortalReason = (r) => PORTAL_REASONS.includes(normalizeLeavingReason(r))

const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const BY_SQUASHED = new Map(LEAVING_REASONS.map((r) => [squash(r), r]))

/**
 * Map a typed reason to its canonical label.
 *
 *  - Any graduation wording → 'Graduating'  (graduation, graduated, grad,
 *    grads, senior, eligibility exhausted…)
 *  - Any draft wording      → 'Pro Draft'   (draft, nfl draft, declared,
 *    declare for draft, nfl…)
 *  - Any NIL wording        → 'NIL'         (N.I.L., nil money, name image
 *    likeness…)
 *  - Any canonical label, case/spacing-insensitively → that label's casing
 *  - Anything else          → trimmed as typed (still a portal reason)
 *  - Blank                  → ''
 */
export function normalizeLeavingReason(raw) {
  const s = squash(raw)
  if (!s) return ''
  const exact = BY_SQUASHED.get(s)
  if (exact) return exact
  if (/^grad/.test(s) || /\bgrad(uat\w*)?\b/.test(s) || /\bsenior\b/.test(s) || /eligib/.test(s) || /exhaust/.test(s)) {
    return GRADUATING
  }
  if (/\bdraft/.test(s) || /\bnfl\b/.test(s) || /\bdeclar/.test(s)) {
    return PRO_DRAFT
  }
  // NIL gets written a dozen ways ("N.I.L.", "nil money", "name image
  // likeness"). squash() already flattened the punctuation, so "n.i.l."
  // arrives as "n i l".
  if (/^n i l\b/.test(s) || /\bnil\b/.test(s) || /name image (and )?likeness/.test(s)) {
    return NIL
  }
  return String(raw).trim()
}

export const isGraduatingReason = (r) => normalizeLeavingReason(r) === GRADUATING
export const isProDraftReason = (r) => normalizeLeavingReason(r) === PRO_DRAFT
