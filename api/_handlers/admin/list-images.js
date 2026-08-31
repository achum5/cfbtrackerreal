import { AwsClient } from 'aws4fetch';
import { verifyAdmin } from '../../_verifyAuth.js';
import { setCors } from '../../_cors.js';

/**
 * Admin-only: list uploaded images in the R2 bucket for the in-app gallery.
 * Gated to ADMIN_EMAILS (verifyAdmin).
 *
 * Keys are `images/{uid}/{yyyymm}/{uuid}.{ext}`.
 *
 * The bucket is walked METADATA-ONLY (key/size/date — no object bodies), which
 * is what makes accurate totals affordable: a full walk returns counts and
 * bytes for every object, and only the requested page's rows are sent back to
 * the browser. That split is the whole point — the old version capped at 5,000
 * objects AND shipped all 5,000 rows at once, so the totals were wrong and the
 * page was heavy at the same time.
 *
 * Filtering by uploader uses an R2 `prefix` of `images/{uid}/`, so a per-user
 * view lists only that user's objects instead of the whole bucket. That makes
 * the by-user views dramatically cheaper than the all-users view.
 *
 * Modes:
 *   'page'     (default) — stats + one page of image rows
 *   'keysOnly'           — every matching row, compact, for bulk recompress
 */

// Raised from 5,000. The walk is metadata-only, so this bounds worst-case
// latency rather than response size: 200 list calls at 1,000 keys each.
// `truncated` is reported honestly when a bucket exceeds it.
const MAX_OBJECTS = 200000;
const MAX_PAGES = 200;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function r2Env() {
  const {
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_HOST,
  } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_HOST) {
    return null;
  }
  return { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_HOST };
}

// Minimal parse of S3 ListObjectsV2 XML — the format is fixed and simple, so a
// targeted regex sweep is enough (avoids pulling in an XML parser dependency).
function parseListXml(xml) {
  const items = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const key = (block.match(/<Key>([\s\S]*?)<\/Key>/) || [])[1];
    const lastModified = (block.match(/<LastModified>([\s\S]*?)<\/LastModified>/) || [])[1];
    const size = Number((block.match(/<Size>([\s\S]*?)<\/Size>/) || [])[1] || 0);
    if (key) items.push({ key, lastModified, size });
  }
  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/.test(xml);
  const nextToken = (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/) || [])[1] || null;
  return { items, truncated, nextToken };
}

// A uid comes from a key we generated, but it still lands in an R2 prefix, so
// keep it to the shape our own uploader produces rather than interpolating
// arbitrary caller input into the request.
function safeUid(uid) {
  if (typeof uid !== 'string') return null;
  return /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
}

const clampInt = (v, lo, hi, dflt) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
};

// Accepts an ISO date or a plain yyyy-mm-dd. Returns epoch ms, or null.
function parseDate(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const env = r2Env();
  if (!env) return res.status(501).json({ error: 'R2 storage not configured' });

  const decoded = await verifyAdmin(req, res);
  if (!decoded) return; // verifyAdmin already sent 401/403

  const body = req.body || {};
  const mode = body.mode === 'keysOnly' ? 'keysOnly' : 'page';
  const uid = safeUid(body.uid);
  const sort = ['newest', 'oldest', 'largest', 'smallest'].includes(body.sort) ? body.sort : 'newest';
  const page = clampInt(body.page, 1, 1000000, 1);
  const pageSize = clampInt(body.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const minBytes = Math.max(0, Math.floor(Number(body.minSizeKB) || 0) * 1024);
  const maxBytes = Number(body.maxSizeKB) > 0 ? Math.floor(Number(body.maxSizeKB)) * 1024 : Infinity;
  const beforeMs = parseDate(body.before);
  const afterMs = parseDate(body.after);

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;

  // Narrow the LIST itself when a single uploader is requested — R2 only
  // returns that user's objects, so a by-user view costs a fraction of the
  // all-users walk instead of the same amount plus client-side filtering.
  const prefix = uid ? `images/${uid}/` : 'images/';

  const all = [];
  let token = null;
  let truncated = false;

  try {
    for (let p = 0; p < MAX_PAGES; p++) {
      const params = new URLSearchParams({ 'list-type': '2', prefix, 'max-keys': '1000' });
      if (token) params.set('continuation-token', token);

      const resp = await client.fetch(`${base}?${params.toString()}`, { method: 'GET' });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('[list-images] R2 list failed', resp.status, text.slice(0, 300));
        return res.status(502).json({ error: `R2 list failed (${resp.status})` });
      }

      const parsed = parseListXml(await resp.text());
      all.push(...parsed.items);

      if (all.length >= MAX_OBJECTS) { truncated = true; break; }
      if (!parsed.truncated || !parsed.nextToken) break;
      token = parsed.nextToken;
      if (p === MAX_PAGES - 1) truncated = true;
    }
  } catch (e) {
    console.error('[list-images] error:', e.message);
    return res.status(500).json({ error: 'Failed to list images' });
  }

  // ── Overall totals: the whole walked set, BEFORE any filter. This is what
  // the header reports, so "total images / total space" means the bucket (or
  // the selected uploader's whole set), never just what's on screen.
  const uploaderMap = new Map();
  let overallBytes = 0;
  for (const o of all) {
    overallBytes += o.size || 0;
    const u = o.key.split('/')[1] || 'unknown';
    const agg = uploaderMap.get(u) || { uid: u, count: 0, bytes: 0 };
    agg.count += 1;
    agg.bytes += o.size || 0;
    uploaderMap.set(u, agg);
  }
  const uploaders = [...uploaderMap.values()].sort((a, b) => b.bytes - a.bytes);

  // ── Filters (everything except uploader, which the prefix already applied)
  const filtered = all.filter((o) => {
    const size = o.size || 0;
    if (size < minBytes || size > maxBytes) return false;
    if (beforeMs != null || afterMs != null) {
      const t = new Date(o.lastModified).getTime();
      if (!Number.isFinite(t)) return false;
      if (beforeMs != null && t >= beforeMs) return false;
      if (afterMs != null && t < afterMs) return false;
    }
    return true;
  });

  const cmp = {
    newest: (a, b) => new Date(b.lastModified) - new Date(a.lastModified),
    oldest: (a, b) => new Date(a.lastModified) - new Date(b.lastModified),
    largest: (a, b) => (b.size || 0) - (a.size || 0),
    smallest: (a, b) => (a.size || 0) - (b.size || 0),
  }[sort];
  filtered.sort(cmp);

  const filteredBytes = filtered.reduce((s, o) => s + (o.size || 0), 0);
  const toRow = (o) => ({
    key: o.key,
    url: `https://${env.R2_PUBLIC_HOST}/${o.key}`,
    size: o.size,
    lastModified: o.lastModified,
    uid: o.key.split('/')[1] || 'unknown',
  });

  // keysOnly: the caller is about to act on the WHOLE matching set (bulk
  // recompress), so it needs every row, not a page. Same rows, no pagination.
  if (mode === 'keysOnly') {
    return res.status(200).json({
      images: filtered.map(toRow),
      filtered: { count: filtered.length, bytes: filteredBytes },
      overall: { count: all.length, bytes: overallBytes, uploaders: uploaderMap.size },
      truncated,
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return res.status(200).json({
    images: slice.map(toRow),
    page: safePage,
    pageSize,
    totalPages,
    rangeStart: filtered.length === 0 ? 0 : start + 1,
    rangeEnd: start + slice.length,
    filtered: { count: filtered.length, bytes: filteredBytes },
    overall: { count: all.length, bytes: overallBytes, uploaders: uploaderMap.size },
    uploaders,
    truncated,
  });
}
