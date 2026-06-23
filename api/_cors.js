// Shared CORS handling for browser-callable API routes.
//
// Local dev points VITE_API_BASE at production, so dev origins must be allowed
// here for the cross-origin preflight to pass. Dev can run on Vite (localhost)
// or in a cloud IDE (Firebase Studio / Cloud Workstations, Gitpod, Codespaces)
// whose hostname is dynamic — those are matched by suffix. The Firebase auth
// token is the real gate on every endpoint; these allowances only relax the
// browser's CORS check, they don't grant any access on their own.

const ALLOWED_ORIGINS = new Set([
  'https://dynastytracker.app',
  'https://www.dynastytracker.app',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
]);

const ALLOWED_ORIGIN_SUFFIXES = ['.cloudworkstations.dev', '.gitpod.io', '.app.github.dev'];

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

export function setCors(req, res, methods = 'POST, OPTIONS') {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}
