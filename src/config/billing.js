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
 * It reads the host env var VITE_PAYWALL_ENABLED, so you can flip it at
 * launch from Vercel WITHOUT a code change (set VITE_PAYWALL_ENABLED=true).
 * Unset/anything-but-"true" keeps beta mode. The Stripe plumbing
 * (upgradeToPremium → /api/create-checkout-session → webhook) is already
 * live and unchanged by this flag — the flag only controls which UI shows.
 *
 * ── Launch checklist (when you flip this on) ────────────────────────────
 *   1. In Stripe, create the $2.99/mo recurring price; point STRIPE_PRICE_ID
 *      (host env) at it. The price below is DISPLAY ONLY — it does not change
 *      what Stripe charges.
 *   2. Confirm host env: STRIPE_SECRET_KEY, STRIPE_PRICE_ID,
 *      STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL, and the Stripe webhook
 *      endpoint (/api/webhook) is registered with live keys.
 *   3. Set VITE_PAYWALL_ENABLED=true (or flip PAYWALL_ENABLED here).
 *   4. Empty BETA_GRANT_EMAILS in src/pages/Account.jsx AND api/_verifyAuth.js
 *      (keep them in sync) so non-admins can no longer self-grant free premium.
 *      Existing beta grants keep premium until their 30-day period ends.
 */
export const PAYWALL_ENABLED = import.meta.env.VITE_PAYWALL_ENABLED === 'true'

// Display strings only — keep in sync with the Stripe price (STRIPE_PRICE_ID).
// Editing these does NOT change what Stripe charges.
export const PREMIUM_PRICE = '$2.99'
export const PREMIUM_PRICE_PER_MO = '$2.99 / mo'
