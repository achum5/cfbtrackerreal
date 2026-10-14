// Firestore's DOCUMENTED per-document size formula — see
// https://firebase.google.com/docs/firestore/storage-size — computes what
// Firestore actually charges for a document. This differs meaningfully from
// a plain JSON.stringify().length for data shaped like a box score (hundreds
// of small numeric fields): Firestore charges a FIXED per-value cost for
// every field regardless of how short its JSON text representation is (an
// integer costs 8 bytes whether it's `1` or `1000000`), plus a per-field-name
// and per-document/per-map overhead that JSON.stringify has no equivalent
// for. A batch estimated via JSON.stringify can look comfortably under
// budget while Firestore's real accounting disagrees — confirmed in
// production: an 8 MiB stringify-based estimate still failed against the
// real ~11 MiB request cap. Using this exact formula instead of a guessed
// multiplier is what actually closes that gap, rather than just widening a
// margin around an estimate of unknown accuracy.
// `seen` guards against a circular reference recursing forever (a real
// document graph never legitimately contains one — Firestore itself can't
// store one — but a bug that introduces one client-side used to silently
// abort the OLD JSON.stringify-based estimate entirely, which skipped the
// size guard right when it mattered most). A cycle just stops re-counting
// the repeated object instead of throwing, so the estimate degrades
// gracefully rather than either crashing or under/over-counting wildly.
export function firestoreValueSize(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return 1
  const type = typeof value
  if (type === 'boolean') return 1
  if (type === 'number') return 8
  if (type === 'string') return new TextEncoder().encode(value).length + 1
  if (Array.isArray(value)) {
    if (seen.has(value)) return 0
    seen.add(value)
    return value.reduce((sum, v) => sum + firestoreValueSize(v, seen), 0) + 16
  }
  if (value instanceof Date) return 8
  if (type === 'object') {
    // Firestore Timestamp-like objects (has toDate()) cost the same as a date.
    if (typeof value.toDate === 'function') return 8
    if (seen.has(value)) return 0
    seen.add(value)
    let sum = 16
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue
      sum += new TextEncoder().encode(key).length + 1 + firestoreValueSize(v, seen)
    }
    return sum
  }
  // Never let an estimate throw on something unexpected (e.g. a function
  // slipping through) — fall back to a rough proxy rather than crash.
  try { return new TextEncoder().encode(JSON.stringify(value)).length } catch { return 0 }
}

/**
 * Full per-document size Firestore charges: 32 bytes fixed document
 * overhead plus every top-level field's name + value size. Use this (not
 * JSON.stringify().length) anywhere a byte estimate feeds a Firestore size
 * decision — per-document cap checks, batch-chunking budgets, etc.
 */
export function firestoreDocSize(docData) {
  let sum = 32
  for (const [key, value] of Object.entries(docData || {})) {
    if (value === undefined) continue
    sum += new TextEncoder().encode(key).length + 1 + firestoreValueSize(value)
  }
  return sum
}

// ─── Index entries ───────────────────────────────────────────────────────────
//
// A commit is also charged for the index entries its writes generate, and
// under Firestore's default automatic indexing that dwarfs the documents
// themselves for our data: every leaf value of every map gets an ascending
// AND a descending single-field entry, every array element an array-contains
// entry, and each entry costs about the document name + the field path + the
// value + 32 bytes. A player record carrying a few seasons of attributes and
// stats writes several times its own size in index entries — which is how a
// 450-player batch of ~1 KB records came back "Transaction too big" on a
// full-league dynasty (11,744 players) whose largest document was nowhere
// near the 1 MiB cap.

const utf8 = (s) => new TextEncoder().encode(String(s)).length
// Typical `dynasties/{20-char id}/{collection}/{id}` document name, counted
// the way Firestore sizes names (each segment + 1, plus 16).
const DEFAULT_DOC_NAME_BYTES = 64

/**
 * Estimated bytes of single-field index entries Firestore writes for one
 * document under default indexing. An over-estimate by design — it's a batch
 * budget, and fields exempted from indexing are counted anyway.
 */
export function firestoreIndexEntryBytes(docData, docNameBytes = DEFAULT_DOC_NAME_BYTES) {
  let total = 0
  const entry = (pathBytes, valueBytes) => docNameBytes + pathBytes + valueBytes + 32
  const walk = (value, pathBytes, seen) => {
    if (value === undefined) return
    if (Array.isArray(value)) {
      if (seen.has(value)) return
      seen.add(value)
      for (const el of value) total += entry(pathBytes, firestoreValueSize(el))
      return
    }
    if (value && typeof value === 'object' && !(value instanceof Date) && typeof value.toDate !== 'function') {
      if (seen.has(value)) return
      seen.add(value)
      for (const [k, v] of Object.entries(value)) walk(v, pathBytes + utf8(k) + 1, seen)
      return
    }
    total += 2 * entry(pathBytes, firestoreValueSize(value))
  }
  const seen = new WeakSet()
  for (const [k, v] of Object.entries(docData || {})) walk(v, utf8(k) + 1, seen)
  return total
}

/** What one document write costs a commit: the document plus its index entries. */
export function firestoreWriteCost(docData) {
  return firestoreDocSize(docData) + firestoreIndexEntryBytes(docData)
}
