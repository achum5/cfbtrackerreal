import { describe, it, expect } from 'vitest'
import { inspectSaveHeader, explainUnreadableSave, describeSaveHeader } from '../../../api/_lib/cfb27Extract/lib/saveHeader.cjs'

// A real user got "Failed to parse save: Cannot read properties of undefined
// (reading 'year')" — madden-franchise's fall-through year lookup on a file
// whose header it couldn't classify. These fixtures are synthetic headers
// built to the same byte offsets the library reads.

const header = (patch = {}) => {
  const b = Buffer.alloc(0x100)
  // compressed franchise: NOT "FrTk", NOT zlib 78 9c
  b[0] = 0x01; b[1] = 0x02
  // college 'C' at 0x22, year marker '7' at 0x2b (college position)
  b[0x22] = 0x43
  b[0x2b] = 0x37
  // schema 468.2 (the bundled C27 schema)
  b.writeUInt32LE(468, 0x3e)
  b.writeUInt32LE(2, 0x42)
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'schemaMajor') b.writeUInt32LE(v, 0x3e)
    else b[Number(k)] = v
  }
  return b
}

describe('inspectSaveHeader', () => {
  it('recognizes a well-formed CFB 27 dynasty save', () => {
    const info = inspectSaveHeader(header(), 10 * 1024 * 1024)
    expect(info.looksLikeCfb27Save).toBe(true)
    expect(info.year).toBe(27)
    expect(info.isCollege).toBe(true)
    expect(info.schemaMajor).toBe(468)
    expect(info.reason).toBeNull()
  })

  it("flags the library's crash case: no year marker + schema number over 999", () => {
    // Exactly the bytes that make schemaMax.find(...) return undefined.
    const info = inspectSaveHeader(header({ 0x2b: 0x00, 0x22: 0x00, schemaMajor: 123456 }), 9e6)
    expect(info.looksLikeCfb27Save).toBe(false)
    expect(info.retryWithOverrides).toBe(false)
    expect(info.reason).toBe('implausible-schema')
    expect(explainUnreadableSave(info)).toMatch(/upload was cut short|wrong file/)
  })

  it('offers an override retry when the marker is missing but the schema is sane', () => {
    const info = inspectSaveHeader(header({ 0x2b: 0x00, 0x22: 0x00 }), 9e6)
    expect(info.looksLikeCfb27Save).toBe(false)
    expect(info.retryWithOverrides).toBe(true)
    expect(info.reason).toBe('no-year-marker')
  })

  it('names a ZIP for what it is', () => {
    const z = Buffer.alloc(0x100); z[0] = 0x50; z[1] = 0x4b; z[2] = 0x03; z[3] = 0x04
    const info = inspectSaveHeader(z, 5e6)
    expect(info.knownKind).toBe('a ZIP archive')
    expect(explainUnreadableSave(info)).toMatch(/ZIP archive/)
  })

  it('names a text/JSON file for what it is', () => {
    const t = Buffer.from('{"dynasty": "backup export"}'.padEnd(0x100, ' '))
    const info = inspectSaveHeader(t, 300000)
    expect(info.knownKind).toBe('a text file')
  })

  it('treats an uncompressed FrTk file as a different layout', () => {
    const f = Buffer.alloc(0x100); f[0] = 0x46; f[1] = 0x72; f[2] = 0x54; f[3] = 0x6b
    const info = inspectSaveHeader(f, 5e6)
    expect(info.compressed).toBe(false)
    expect(explainUnreadableSave(info)).toMatch(/different EA file layout/)
  })

  it('rejects a truncated upload', () => {
    const info = inspectSaveHeader(Buffer.alloc(10), 10)
    expect(info.reason).toBe('too-small')
    expect(explainUnreadableSave(info)).toMatch(/only 10 bytes/)
  })

  it('always tells the user which file to pick', () => {
    for (const info of [inspectSaveHeader(Buffer.alloc(10), 10), inspectSaveHeader(header({ schemaMajor: 5000, 0x2b: 0 }), 9e6)]) {
      expect(explainUnreadableSave(info)).toMatch(/DYNASTY-/)
    }
  })

  it('describeSaveHeader is a single log line with the key facts', () => {
    const line = describeSaveHeader(inspectSaveHeader(header(), 9e6))
    expect(line).toMatch(/schema=468\.2/)
    expect(line).not.toMatch(/\n/)
  })
})
