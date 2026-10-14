// Classification of Firestore write rejections that need user action.
//
// The one that matters most: a main doc over Firestore's 1 MiB cap. The server
// rejects EVERY update to such a doc — including a single-field bump — with
// code 'invalid-argument', and because every subcollection write batches a
// main-doc lastModified bump in the SAME atomic batch, the whole batch fails
// with it. Net effect for the user: every save of any kind silently dies while
// the optimistic local state keeps showing their data — until a reload, when
// everything since the doc crossed the cap is simply gone. That is the
// "logged the whole season, came back and it was gone except week two" report.
//
// Matching is deliberately on BOTH the code and size-specific message text:
// 'invalid-argument' alone also covers unrelated malformed-data errors, and
// we only want the loud "your dynasty is over the cap" banner for the real
// thing.

/** True when a write rejection means: the main document exceeds the 1 MiB cap. */
export function isDocTooLargeError(err) {
  if (!err) return false
  const code = String(err.code || '')
  const msg = String(err.message || err || '')
  if (!/invalid-argument/i.test(code) && !/INVALID_ARGUMENT/.test(msg)) return false
  return (
    /exceeds the maximum allowed size/i.test(msg) ||
    /longer than \d+ bytes/i.test(msg) ||
    /1048576/.test(msg) ||
    /entity is too big/i.test(msg) ||
    /document is too large/i.test(msg)
  )
}

/**
 * Which document an oversized-write rejection is about. Firestore names it in
 * the message ("Document 'projects/…/documents/dynasties/{id}/seasons/2027'
 * cannot be written because its size (…) exceeds …"); a per-field rejection
 * names the property instead ("The value of property "teams" is longer than
 * … bytes"). Knowing which one matters because the remedies differ: only the
 * MAIN dynasty doc is fixed by "Migrate to Subcollections" — telling a
 * dynasty that already migrated to run it again is a dead end.
 *
 * @returns {null | {
 *   kind: 'main' | 'season' | 'teamShard' | 'subcollection' | 'unknown',
 *   path: string | null, year: number | null, collection: string | null,
 *   property: string | null, bytes: number | null,
 * }} null when the error isn't an oversized-write rejection at all.
 */
export function describeOversizedWrite(err) {
  if (!isDocTooLargeError(err)) return null
  const msg = String(err?.message || err || '')
  const pathMatch = msg.match(/Document '([^']+)'/i)
  const fullPath = pathMatch ? pathMatch[1] : null
  const docPath = fullPath ? fullPath.replace(/^.*?\/documents\//, '') : null
  const sizeMatch = msg.match(/size \(([\d,]+) bytes\)/i)
  const bytes = sizeMatch ? Number(sizeMatch[1].replace(/,/g, '')) : null
  const propMatch = msg.match(/property "([^"]+)"/i)
  const property = propMatch ? propMatch[1] : null
  const out = { kind: 'unknown', path: docPath, year: null, collection: null, property, bytes }
  if (!docPath) return out
  const parts = docPath.split('/')
  // dynasties/{id}
  if (parts.length === 2 && parts[0] === 'dynasties') return { ...out, kind: 'main' }
  // dynasties/{id}/seasons/{year}[/teamShards/{n}]
  if (parts[0] === 'dynasties' && parts[2] === 'seasons') {
    const year = Number(parts[3])
    return {
      ...out,
      kind: parts[4] === 'teamShards' ? 'teamShard' : 'season',
      year: Number.isFinite(year) ? year : null,
      collection: 'seasons',
    }
  }
  if (parts[0] === 'dynasties' && parts.length >= 4) return { ...out, kind: 'subcollection', collection: parts[2] }
  return out
}

/**
 * A commit refused for its TOTAL size (documents plus the index entries they
 * generate), not for any one document. Fixed by splitting the batch, never by
 * shrinking a document.
 */
export function isTransactionTooBigError(err) {
  if (!err) return false
  const msg = String(err.message || err || '')
  return /transaction too big/i.test(msg)
    || /decrease transaction size/i.test(msg)
    || /request payload size exceeds the limit/i.test(msg)
}
