// Pre-flight inspection of a CFB 27 save file's header.
//
// WHY: madden-franchise detects the game/year from a few header bytes. When a
// compressed file carries none of the year markers it knows, it falls through
// to `schemaMax.find(s => s.max >= major).year` with `major` read from byte
// 0x3e — and if that number is over 999 (a non-save, a truncated upload, or a
// game build that moved the header), `find` returns undefined and the user
// sees "Cannot read properties of undefined (reading 'year')". That message
// reached a real user through the contact form. Nothing about it says what
// to do.
//
// This mirrors the library's own byte checks (kept deliberately literal so
// they can be compared side by side with its getFileType/getGameYear/
// getGameType) to classify the file BEFORE the library touches it, so the
// error can say what the file actually is and what to pick instead. It also
// reports whether a failed open is worth retrying with the library's
// gameYearOverride/gameTypeOverride — the case where the file is plainly a
// compressed franchise save with a sane schema number but the year marker
// isn't where the library expects.

const KNOWN_KINDS = [
  { bytes: [0x50, 0x4b, 0x03, 0x04], kind: 'a ZIP archive' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], kind: 'a PNG image' },
  { bytes: [0xff, 0xd8, 0xff], kind: 'a JPEG image' },
  { bytes: [0x25, 0x50, 0x44, 0x46], kind: 'a PDF' },
  { bytes: [0x1f, 0x8b], kind: 'a gzip file' },
]

function startsWith(buf, bytes) {
  if (!buf || buf.length < bytes.length) return false
  for (let i = 0; i < bytes.length; i++) if (buf[i] !== bytes[i]) return false
  return true
}

function looksTextual(buf) {
  const n = Math.min(buf.length, 64)
  if (n === 0) return false
  let printable = 0
  for (let i = 0; i < n; i++) {
    const b = buf[i]
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b < 0x7f)) printable++
  }
  return printable / n > 0.95
}

/**
 * @param {Buffer} buf - at least the first 0x46 bytes of the file (whole file is fine)
 * @param {number} [totalSize] - full file size when `buf` is only a prefix
 */
function inspectSaveHeader(buf, totalSize) {
  const size = Number.isFinite(totalSize) ? totalSize : (buf ? buf.length : 0)
  const info = {
    size,
    headHex: buf ? Array.from(buf.subarray(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ') : '',
    compressed: null,
    format: null,
    year: null,
    isCollege: false,
    schemaMajor: null,
    schemaMinor: null,
    knownKind: null,
    looksLikeCfb27Save: false,
    retryWithOverrides: false,
    reason: null,
  }
  if (!buf || buf.length < 0x46) {
    info.reason = 'too-small'
    return info
  }

  for (const k of KNOWN_KINDS) {
    if (startsWith(buf, k.bytes)) { info.knownKind = k.kind; break }
  }

  // Library: isCompressed = first 4 bytes !== "FrTk"
  info.compressed = !startsWith(buf, [0x46, 0x72, 0x54, 0x6b])
  // Library: compressed + zlib header 78 9c => franchise-common (FTC), else franchise.
  if (info.compressed) {
    info.format = startsWith(buf, [0x78, 0x9c]) ? 'franchise-common' : 'franchise'
  } else {
    info.format = size > 0x895440 ? 'franchise' : 'franchise-common'
  }

  if (info.compressed && info.format === 'franchise') {
    // Library's C27/M27 year marker: '7' (0x37) at 0x2a (Madden) or 0x2b (College).
    if (buf[0x2a] === 0x37 || buf[0x2b] === 0x37) info.year = 27
    // Library's college check: 'C' at 0x22, or the year marker sitting one byte later.
    info.isCollege = buf[0x22] === 0x43 || (buf[0x2b] === 0x37 && buf[0x2a] !== 0x37)
    info.schemaMajor = buf.readUInt32LE(0x3e)
    info.schemaMinor = buf.readUInt32LE(0x42)
  }

  const schemaPlausible = info.schemaMajor != null && info.schemaMajor > 0 && info.schemaMajor <= 999
  info.looksLikeCfb27Save = !!(info.compressed && info.format === 'franchise' && info.year === 27 && info.isCollege && schemaPlausible)
  // A compressed franchise file with a sane schema number but no recognizable
  // year marker: the library WILL crash on it (see header), but forcing
  // year/type and letting it resolve the schema by number usually works.
  info.retryWithOverrides = !!(info.compressed && info.format === 'franchise' && !info.looksLikeCfb27Save && schemaPlausible)

  // Text-file classification is a heuristic over the first 64 bytes, so it
  // only applies once the real header checks have failed — a genuine save
  // whose name string happens to make the prefix look printable must never
  // be called a text file.
  if (!info.knownKind && !info.looksLikeCfb27Save && !info.retryWithOverrides && looksTextual(buf)) {
    info.knownKind = 'a text file'
  }

  if (info.knownKind) info.reason = 'known-other-kind'
  else if (!info.compressed) info.reason = 'uncompressed'
  else if (info.format === 'franchise-common') info.reason = 'franchise-common'
  else if (!schemaPlausible) info.reason = 'implausible-schema'
  else if (!info.looksLikeCfb27Save) info.reason = 'no-year-marker'
  return info
}

const fmtMB = (n) => `${(n / (1024 * 1024)).toFixed(1)} MB`

/** One-line technical summary for server logs. */
function describeSaveHeader(info) {
  return `size=${info.size} (${fmtMB(info.size)}) head=[${info.headHex}] compressed=${info.compressed} format=${info.format} year=${info.year} college=${info.isCollege} schema=${info.schemaMajor}.${info.schemaMinor} kind=${info.knownKind || '-'} reason=${info.reason || '-'}`
}

const PICK_HINT = 'Pick the file whose name starts with DYNASTY- from Documents\\EA SPORTS College Football 27\\settings on your PC (a real save is usually 8-12 MB).'

/** User-facing explanation for a file the library cannot read. */
function explainUnreadableSave(info, libraryMessage) {
  const tail = libraryMessage ? ` (parser said: ${libraryMessage})` : ''
  if (info.reason === 'too-small') {
    return `That upload is only ${info.size} bytes, so it isn't a complete save file. ${PICK_HINT}`
  }
  if (info.knownKind) {
    return `That file is ${info.knownKind}, not a CFB 27 dynasty save. ${PICK_HINT}`
  }
  if (info.reason === 'uncompressed' || info.reason === 'franchise-common') {
    return `That file isn't a CFB 27 dynasty save (it has a different EA file layout). ${PICK_HINT}`
  }
  if (info.reason === 'implausible-schema') {
    return `That file doesn't have a CFB 27 save header (${fmtMB(info.size)}). It may be the wrong file, or the upload was cut short — try uploading it again. ${PICK_HINT}${tail}`
  }
  return `Couldn't read this save. It looks like a CFB 27 save, but its version isn't one the parser recognizes yet — if the game just updated, this is expected until the parser is updated. Please send the footer version and the save file name to support.${tail}`
}

module.exports = { inspectSaveHeader, describeSaveHeader, explainUnreadableSave }
