import { setCors } from './_cors.js';

// Proxy to MaxPlaysCFB's ScoutScore percentile API. Used (with permission) so
// the browser can fetch recruit benchmarks without a cross-origin CORS dance,
// and so the upstream URL / request shape stays server-side. No auth required:
// the payload is just public recruit ratings, no user data.
const UPSTREAM = 'https://maxplayscfb.com/api/recruit-percentiles/preview';

// Forward only the fields ScoutScore expects, coerced to safe types. Never pass
// arbitrary client JSON straight through to the upstream service.
function buildUpstreamBody(b) {
  const attributes = {};
  if (b && typeof b.attributes === 'object' && b.attributes) {
    for (const [k, v] of Object.entries(b.attributes)) {
      const n = Number(v);
      if (typeof k === 'string' && Number.isFinite(n)) attributes[k] = n;
    }
  }
  return {
    position: typeof b?.position === 'string' ? b.position : '',
    star: b?.star == null ? null : Number(b.star),
    gemStatus: typeof b?.gemStatus === 'string' ? b.gemStatus : '',
    archetype: typeof b?.archetype === 'string' ? b.archetype : '',
    devTrait: typeof b?.devTrait === 'string' && b.devTrait ? b.devTrait : null,
    isAthlete: !!b?.isAthlete,
    attributes,
    usedImageUpload: false,
    confirmedOutlierKeys: [],
  };
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }

  try {
    let raw = req.body || {};
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
    const body = buildUpstreamBody(raw);
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        // Mirror what a real browser request looks like. Without these,
        // MaxPlaysCFB's server treats the Vercel server-to-server hop as an
        // unknown/bot caller and returns 403.
        'Origin': 'https://maxplayscfb.com',
        'Referer': 'https://maxplayscfb.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch {
    res.status(502).json({ ok: false, error: 'scoutscore_upstream_unavailable' });
  }
}
