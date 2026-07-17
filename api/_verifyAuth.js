import { adminAuth } from './_firebaseAdmin.js';

/**
 * Verify a Firebase ID token from the Authorization header.
 * Returns the decoded token (uid, email, etc.) on success.
 * Sends a 401 response and returns null on failure — caller should `return`
 * immediately when this returns null.
 *
 * Usage:
 *   const decoded = await verifyAuth(req, res);
 *   if (!decoded) return;
 *   const uid = decoded.uid;
 */
export async function verifyAuth(req, res) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return null;
  }
  const idToken = match[1];

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    console.error('[verifyAuth] Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired auth token' });
    return null;
  }
}

// The Google account(s) permitted to call admin-only endpoints (e.g.
// orphan recovery, anything destructive). Hard-coded here (not env) so
// it's auditable in source. Token email comes from Firebase, not the
// request body, so this can't be spoofed.
export const ADMIN_EMAILS = new Set(['alex.guess1999@gmail.com']);

// Post-beta: the paid launch is live, so the self-grant allowlist is down
// to the permanent free accounts (the owner is covered implicitly via
// ADMIN_EMAILS). Everyone else subscribes through Stripe. Remaining beta
// 30-day grants keep premium until they lapse on their own.
// Grants for these emails are LIFETIME (~100y) — see api/admin/grant-premium.js.
export const BETA_GRANT_EMAILS = new Set([
  'zekemuck@gmail.com',
]);

/**
 * Verify auth AND that the verified email is on the admin allowlist.
 * Sends 401/403 on failure and returns null.
 */
export async function verifyAdmin(req, res) {
  const decoded = await verifyAuth(req, res);
  if (!decoded) return null;
  // Require a VERIFIED email before matching the allowlist. Harmless for
  // Google sign-in (always verified) but prevents a forged unverified
  // email claim from passing the gate if another provider is ever enabled
  // (audit M7).
  if (!decoded.email || decoded.email_verified !== true || !ADMIN_EMAILS.has(decoded.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return decoded;
}

/**
 * Verify auth AND that the verified email is allowed to self-grant a
 * beta premium pass. Admins are implicitly allowed.
 * Sends 401/403 on failure and returns null.
 */
export async function verifyBetaGrant(req, res) {
  const decoded = await verifyAuth(req, res);
  if (!decoded) return null;
  if (decoded.email_verified !== true) {
    res.status(403).json({ error: 'A verified email is required.' });
    return null;
  }
  const email = decoded.email?.toLowerCase();
  if (!email || (!BETA_GRANT_EMAILS.has(email) && !ADMIN_EMAILS.has(email))) {
    res.status(403).json({ error: 'Beta access required. Email the dev to be added to the allowlist.' });
    return null;
  }
  return decoded;
}
