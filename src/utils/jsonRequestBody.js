// A fetch body for a large JSON payload, gzipped when the browser can.
//
// The CFB 27 sync sends a league's worth of players to the server in
// batches, and every byte into a Vercel function counts against the plan's
// Fast Origin Transfer allowance — the traffic that paused the whole site in
// Nov 2026. Gzipped, the same batch is a fraction of the size. The server
// (api/_lib/compressedJson.js readJsonBody) recognizes gzip by its magic
// bytes and still accepts plain JSON, so a browser without CompressionStream
// (pre-2023 Safari) keeps working unchanged.
export async function jsonRequestBody(obj) {
  const json = JSON.stringify(obj)
  if (typeof globalThis.CompressionStream === 'undefined' || typeof Blob === 'undefined' || typeof Response === 'undefined') {
    return { body: json, contentType: 'application/json' }
  }
  try {
    const stream = new Blob([json]).stream().pipeThrough(new globalThis.CompressionStream('gzip'))
    const body = await new Response(stream).blob()
    return { body, contentType: 'application/octet-stream' }
  } catch {
    return { body: json, contentType: 'application/json' }
  }
}
