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
        // Mirror a real Chrome browser request as closely as possible.
        // MaxPlaysCFB blocks requests that don't look like browser traffic.
        'Origin': 'https://maxplayscfb.com',
        'Referer': 'https://maxplayscfb.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Dest': 'empty',
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    // Surface the upstream error body so client can show what MaxPlaysCFB said.
    if (!upstream.ok) {
      res.status(upstream.status).json({
        ok: false,
        error: `upstream_${upstream.status}`,
        message: text.replace(/<[^>]+>/g, '').trim().slice(0, 300) || `HTTP ${upstream.status}`,
      });
      return;
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch {
    res.status(502).json({ ok: false, error: 'scoutscore_upstream_unavailable' });
  }
}
