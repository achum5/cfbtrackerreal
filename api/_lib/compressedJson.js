import zlib from 'zlib';

// Gzip in both directions for the big CFB 27 save-sync payloads.
//
// Vercel bills (and on the Hobby plan, caps) "Fast Origin Transfer": every
// byte that goes into or comes out of a serverless function. A PC sync moved
// a full league's players as plain JSON — up to ~16,000 records in requests
// to bulk-seed/save-sync-players and back out of save-parse — and that
// traffic paused the whole deployment in Nov 2026 once the month's free
// allowance ran out. This JSON compresses roughly 5-10x, so sending it
// gzipped cuts the transfer by about that much with no change to what the
// handlers do with it.

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

/**
 * The JSON body of a request, whichever way the client sent it. The browser
 * sends a gzipped body as application/octet-stream (src/utils/jsonRequestBody.js),
 * which the platform hands over as raw bytes; a client without
 * CompressionStream sends plain application/json, which arrives already
 * parsed. Gzip is recognized by its magic bytes, so nothing depends on a
 * custom header surviving the trip.
 */
export function readJsonBody(req) {
  const body = req.body;
  if (body == null || body === '') return {};
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    const buf = Buffer.from(body);
    if (buf.length === 0) return {};
    const raw = buf[0] === GZIP_MAGIC_0 && buf[1] === GZIP_MAGIC_1 ? zlib.gunzipSync(buf) : buf;
    return JSON.parse(raw.toString('utf8'));
  }
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

/**
 * Send `obj` as JSON, gzipped when the client accepts it (every browser
 * does; fetch decompresses transparently) and it's big enough to matter.
 */
export function sendJson(req, res, status, obj) {
  const json = JSON.stringify(obj);
  const acceptsGzip = /\bgzip\b/i.test(req.headers?.['accept-encoding'] || '');
  if (!acceptsGzip || json.length < 2048) return res.status(status).json(obj);
  const gz = zlib.gzipSync(json);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Vary', 'Accept-Encoding');
  return res.status(status).send(gz);
}
