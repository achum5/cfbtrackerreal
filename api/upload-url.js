import { AwsClient } from 'aws4fetch';
import { verifyAuth } from './_verifyAuth.js';

/**
 * Mint a short-lived presigned PUT URL so the browser can upload an image
 * DIRECTLY to Cloudflare R2 (the bytes never pass through this function).
 *
 * Flow:
 *   1. Client compresses the image to webp and calls this endpoint with a
 *      Firebase ID token + the blob's contentType/size.
 *   2. We verify the token, validate the type/size, and sign a PUT URL
 *      scoped to images/{uid}/{yyyymm}/{uuid}.{ext}.
 *   3. Client PUTs the blob straight to R2 using the returned URL + headers.
 *   4. Client stores `publicUrl` (served from the R2 public host via the
 *      Cloudflare CDN — free egress, edge-cached).
 *
 * Why presigned URLs and not a proxy upload: keeps R2 credentials server-only,
 * dodges Vercel's request-body size limit, and costs zero Vercel bandwidth.
 *
 * Auth: every upload requires a valid Firebase token. The uid is baked into
 * the object key so uploads are traceable and per-user cleanup stays possible.
 *
 * Returns 501 (not a hard error) when R2 env vars are absent, so the client
 * can gracefully fall back to the legacy imgbb path during rollout.
 */

// Browser origins allowed to call this endpoint. Dev points VITE_API_BASE at
// production, so the dev origin must be allowed here for CORS preflight to pass.
// Local dev can run on Vite (localhost) or in a cloud IDE (Firebase Studio /
// Cloud Workstations), whose origin has a dynamic hostname — matched by suffix.
// Auth is the real gate (every call needs a valid Firebase token), so allowing
// these dev origins for CORS is safe.
const ALLOWED_ORIGINS = new Set([
  'https://dynastytracker.app',
  'https://www.dynastytracker.app',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
]);

const ALLOWED_ORIGIN_SUFFIXES = ['.cloudworkstations.dev', '.gitpod.io', '.app.github.dev'];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

// Only image types we actually produce/accept. webp is the common case
// (compressImageBlob re-encodes to webp); the rest cover gif passthrough
// and the occasional un-recompressed jpeg/png.
const EXT_BY_TYPE = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
};

const MAX_BYTES = 32 * 1024 * 1024;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function setCors(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_HOST
  );
}

function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  );
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Not configured yet → tell the client to fall back rather than alarm.
  if (!r2Configured()) {
    return res.status(501).json({ error: 'R2 storage not configured' });
  }

  const decoded = await verifyAuth(req, res);
  if (!decoded) return; // verifyAuth already sent 401
  const uid = decoded.uid;

  const { contentType, size } = req.body || {};
  const ext = EXT_BY_TYPE[String(contentType || '').toLowerCase()];
  if (!ext) {
    return res.status(400).json({ error: `Unsupported image content type: ${contentType}` });
  }
  if (size != null && (typeof size !== 'number' || !(size > 0) || size > MAX_BYTES)) {
    return res.status(400).json({ error: `Invalid size (max ${MAX_BYTES} bytes)` });
  }

  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const key = `images/${uid}/${yyyymm}/${newId()}.${ext}`;

  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  // Sign a bare PUT (host only). We intentionally do NOT sign Content-Type or
  // Cache-Control: R2 still stores them as object metadata when sent on the
  // PUT, and leaving them out of the signature avoids brittle header-match
  // failures (a 1-char mismatch would otherwise 403 the whole upload).
  // Expiry is set via the X-Amz-Expires query param (aws4fetch reads it from
  // the URL, not from an option). 5 minutes: enough for a slow upload, short
  // enough to limit the window if a signed URL leaks.
  const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}?X-Amz-Expires=300`;
  const signed = await client.sign(
    new Request(endpoint, { method: 'PUT' }),
    { aws: { signQuery: true } }
  );

  const publicUrl = `https://${process.env.R2_PUBLIC_HOST}/${key}`;

  return res.status(200).json({
    uploadUrl: signed.url,
    publicUrl,
    key,
    // The client must send these on the PUT so the stored object carries the
    // right content-type and a long cache lifetime (repeat views skip origin).
    headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
  });
}
