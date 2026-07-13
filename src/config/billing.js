/**
 * Single source of truth for the premium paywall + displayed pricing.
 *
 * ── Launch switch ───────────────────────────────────────────────────────
 * PAYWALL_ENABLED === false  → BETA MODE (the current, default state):
 *   premium is free. Real Stripe checkout UI is hidden everywhere; the
 *   beta-free messaging + the BETA_GRANT_EMAILS self-grant path stay active.
 *   Nobody is charged.
 *
 * PAYWALL_ENABLED === true   → LIVE MODE: real Stripe checkout buttons show
 *   on Home + Account at the price below.
 *
 * ── DISABLED (emergency) ────────────────────────────────────────────────
 * The Stripe checkout flow is NOT wired correctly end-to-end: users were
 * charged (repeatedly, in some cases) without ever receiving premium
 * access. Until the checkout → webhook → premium-grant path is verified
 * live, the paywall is HARD-DISABLED here — we deliberately ignore the
 * VITE_PAYWALL_ENABLED host env var so a stray/leftover Vercel setting
 * can't re-expose a charging button. Premium stays free via the beta
 * self-grant path.
 *
 * To re-enable payments later you must (a) verify the full Stripe flow in
 * production, then (b) restore this to read the env var, and only then set
 * VITE_PAYWALL_ENABLED=true. Do NOT flip this back on blind.
 */
export const PAYWALL_ENABLED = false

// Display strings only — keep in sync with the Stripe price (STRIPE_PRICE_ID).
// Editing these does NOT change what Stripe charges.
export const PREMIUM_PRICE = '$2.99'
export const PREMIUM_PRICE_PER_MO = '$2.99 / mo'
