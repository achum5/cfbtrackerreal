// Match a player to a real CFB 27 portrait by NAME.
//
// The portrait pack's filenames carry the player's name as a separatorless
// Last+First blob:
//
//     nilpp_Unique_SmithJeremiah_8726.webp   ->  key "smithjeremiah", id 8726
//
// scripts/build-portrait-name-index.mjs turns those into
// cfb27PortraitNameIndex.json, keyed by that blob verbatim (squashed and
// lowercased). It CANNOT split the blob back into first/last — there's no
// boundary marker — so the split has to be solved from this side, where the
// player's actual name parts are known.
//
// Hence candidatesFor(): given "Jeremiah Smith" it emits "smithjeremiah" and
// "jeremiahsmith"; given a 3-token name it emits every rotation about each
// split point. One of them matches the pack's convention, and unmatched
// candidates simply miss.
//
// AMBIGUITY: the index already omits any name that maps to more than one
// portrait, so a hit here is unambiguous by construction. A miss returns null
// and the caller leaves the player's photo alone — no photo beats a
// confidently wrong face (the same rule mapPortraitUrl and
// cfb27Portraits/README.md follow).

// MUST match squash() in scripts/build-portrait-name-index.mjs — the index is
// written with that and read with this, so any drift yields zero matches.
export const squashName = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '')

// Suffixes are inconsistently present in the pack's blobs, so every candidate
// is emitted both with and without them.
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

/**
 * Every plausible index key for a player's name.
 *
 * Tokens are recombined at each split point in BOTH orders, so the pack's
 * Last+First convention is matched without this module having to hard-code it
 * (and a First+Last pack would still work). Suffix-stripped variants are
 * appended after the full-name ones so an exact match always wins.
 */
export function candidatesFor(nameOrParts) {
  const { name, firstName, lastName } =
    typeof nameOrParts === 'string' ? { name: nameOrParts } : (nameOrParts || {})

  const out = []
  const push = (v) => { const k = squashName(v); if (k && !out.includes(k)) out.push(k) }

  // Explicit parts are the most reliable signal when the record carries them.
  if (firstName || lastName) {
    push(`${lastName || ''}${firstName || ''}`)
    push(`${firstName || ''}${lastName || ''}`)
  }

  const full = String(name || `${firstName || ''} ${lastName || ''}`).trim()
  if (!full) return out

  const emit = (tokens) => {
    if (tokens.length === 0) return
    push(tokens.join(''))
    for (let i = 1; i < tokens.length; i++) {
      push([...tokens.slice(i), ...tokens.slice(0, i)].join(''))
    }
  }

  const tokens = full.split(/\s+/).filter(Boolean)
  emit(tokens)

  const trimmed = tokens.filter((t) => !SUFFIXES.has(squashName(t)))
  if (trimmed.length && trimmed.length !== tokens.length) emit(trimmed)

  return out
}

/**
 * Resolve a player's name to a portrait id via the index, or null.
 * `index` is the parsed cfb27PortraitNameIndex.json ({ key: id }).
 */
export function portraitIdForName(nameOrParts, index) {
  if (!index) return null
  for (const key of candidatesFor(nameOrParts)) {
    const id = index[key]
    if (id != null) return id
  }
  return null
}
