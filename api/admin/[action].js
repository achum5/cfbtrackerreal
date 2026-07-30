// Single serverless function fronting every /api/admin/* endpoint.
//
// Collapsed from four separate files for the same reason as api/cfb27/
// [action].js: Vercel counts FILES under /api as serverless functions and the
// Hobby plan caps a deployment at 12. A dynamic route counts as one function
// regardless of how many actions it serves.
//
// URLs are UNCHANGED — /api/admin/grant-premium, /api/admin/list-images,
// /api/admin/recover-orphan and /api/admin/reupload-url all still resolve
// exactly as before, because [action] matches the same path segment the old
// per-file routes did. No client change was needed for these.
//
// The real handlers live in api/_handlers/admin/. Anything under /api whose
// path starts with `_` is not deployed as a function.
//
// Each handler keeps its OWN authorization (verifyAdmin / verifyBetaGrant) —
// this dispatcher intentionally performs no auth, so the admin allowlist is
// enforced in exactly one place per endpoint and can't be weakened by a
// dispatcher-level shortcut.
import grantPremium from '../_handlers/admin/grant-premium.js'
import listImages from '../_handlers/admin/list-images.js'
import recoverOrphan from '../_handlers/admin/recover-orphan.js'
import reuploadUrl from '../_handlers/admin/reupload-url.js'

const ROUTES = {
  'grant-premium': grantPremium,
  'list-images': listImages,
  'recover-orphan': recoverOrphan,
  'reupload-url': reuploadUrl,
}

export default async function handler(req, res) {
  const raw = req.query?.action
  const action = Array.isArray(raw) ? raw[0] : raw

  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : null
  if (!route) {
    res.status(404).json({ error: 'Unknown endpoint' })
    return
  }
  return route(req, res)
}
