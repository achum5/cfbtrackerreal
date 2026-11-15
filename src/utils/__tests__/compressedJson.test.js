import { describe, it, expect } from 'vitest'
import zlib from 'zlib'
import { jsonRequestBody } from '../jsonRequestBody'
import { readJsonBody, sendJson } from '../../../api/_lib/compressedJson.js'

// The save-sync payloads travel gzipped to cut Vercel's billed function
// transfer (the overage that paused the site). Both ends must agree, and
// plain JSON must keep working for clients that can't compress.

const players = Array.from({ length: 500 }, (_, i) => ({
  pid: i, name: `Player ${i}`, position: 'WR', overall: 70 + (i % 20),
  attributes: { speed: 90, catching: 85, routeRunning: 80 },
}))

const fakeRes = () => {
  const out = { headers: {}, status: null, body: null, json: null }
  const res = {
    setHeader: (k, v) => { out.headers[k.toLowerCase()] = v },
    status: (s) => { out.status = s; return res },
    send: (b) => { out.body = b; return res },
    json: (o) => { out.json = o; return res },
  }
  return { res, out }
}

describe('gzipped JSON request bodies', () => {
  it('the browser helper gzips, and the server reads it back', async () => {
    const payload = { dynastyId: 'd1', players }
    const { body, contentType } = await jsonRequestBody(payload)
    expect(contentType).toBe('application/octet-stream')
    const buf = Buffer.from(await body.arrayBuffer())
    expect(buf.length).toBeLessThan(JSON.stringify(payload).length / 4)
    expect(readJsonBody({ body: buf })).toEqual(payload)
  })

  it('plain JSON still reads, parsed or raw', () => {
    expect(readJsonBody({ body: { a: 1 } })).toEqual({ a: 1 })
    expect(readJsonBody({ body: Buffer.from('{"a":1}') })).toEqual({ a: 1 })
    expect(readJsonBody({ body: '{"a":1}' })).toEqual({ a: 1 })
    expect(readJsonBody({ body: null })).toEqual({})
  })
})

describe('gzipped JSON responses', () => {
  it('large responses go out gzipped when the client accepts it', () => {
    const { res, out } = fakeRes()
    sendJson({ headers: { 'accept-encoding': 'gzip, deflate, br' } }, res, 200, { players })
    expect(out.status).toBe(200)
    expect(out.headers['content-encoding']).toBe('gzip')
    expect(JSON.parse(zlib.gunzipSync(out.body).toString('utf8'))).toEqual({ players })
  })

  it('small responses, or clients without gzip, get plain JSON', () => {
    const a = fakeRes()
    sendJson({ headers: { 'accept-encoding': 'gzip' } }, a.res, 200, { ok: true })
    expect(a.out.json).toEqual({ ok: true })
    const b = fakeRes()
    sendJson({ headers: {} }, b.res, 200, { players })
    expect(b.out.json).toEqual({ players })
  })
})
