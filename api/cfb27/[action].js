// Single serverless function fronting every CFB 27 save-sync endpoint.
//
// WHY ONE FUNCTION INSTEAD OF FOUR FILES: Vercel counts FILES under /api as
// serverless functions, and the Hobby plan caps a deployment at 12. This
// project was already sitting at exactly 12, so adding the four CFB 27
// endpoints as their own files pushed the deployment to 16 and it failed at
// the "Deploying outputs" step (the build itself succeeds, which makes it
// look like a code error — it isn't). A dynamic route counts as ONE function
// no matter how many actions it serves, so all four live here.
//
// The real handlers live in api/_handlers/cfb27/. Anything under /api whose
// path starts with `_` is NOT deployed as a function — it's ordinary code
// that gets bundled into whatever imports it. That's what makes this work.
//
// Routes served (unchanged in shape, just nested one level deeper than the
// old flat `/api/cfb27-*` names):
//   POST /api/cfb27/save-upload-url    → presigned R2 PUT for the save file
//   POST /api/cfb27/save-parse         → server-side binary parse of the save
//   POST /api/cfb27/bulk-seed-players  → Admin-SDK bulk write, new dynasty
//   POST /api/cfb27/save-sync-players  → Admin-SDK bulk write, existing dynasty
//
// Each handler still does its OWN auth (verifyPremium) and CORS — this file
// deliberately adds no auth of its own, so there's exactly one place per
// endpoint where access is decided and no chance of a dispatcher-level
// shortcut silently weakening it.
import saveUploadUrl from '../_handlers/cfb27/save-upload-url.js'
import saveParse from '../_handlers/cfb27/save-parse.js'
import bulkSeedPlayers from '../_handlers/cfb27/bulk-seed-players.js'
import saveSyncPlayers from '../_handlers/cfb27/save-sync-players.js'

const ROUTES = {
  'save-upload-url': saveUploadUrl,
  'save-parse': saveParse,
  'bulk-seed-players': bulkSeedPlayers,
  'save-sync-players': saveSyncPlayers,
}

export default async function handler(req, res) {
  // `action` is the [action] path segment. Vercel gives it as a string, but
  // hands back an array if the segment repeats — normalize both.
  const raw = req.query?.action
  const action = Array.isArray(raw) ? raw[0] : raw

  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : null
  if (!route) {
    res.status(404).json({ error: 'Unknown endpoint' })
    return
  }
  return route(req, res)
}
