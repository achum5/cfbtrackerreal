// Surname handling for sorting and display.
//
// A plain `split(' ').pop()` treats a generational suffix as the surname, so
// "AJ Azuakolam Jr." sorts under J and "Michael Robinson II" under I. On a
// roster list that silently interleaves suffixed players into the wrong
// letter — reported as the site's roster "not matching" the game's, when the
// two held identical players in different order.
export const NAME_SUFFIXES = new Set(['jr.', 'jr', 'sr.', 'sr', 'ii', 'iii', 'iv', 'v'])

/**
 * Split a full name into [lastName, firstName], keeping a trailing
 * Jr./Sr./II/III/IV/V attached to the surname it belongs to.
 *
 *   "AJ Azuakolam Jr."      -> ['Azuakolam Jr.', 'AJ']
 *   "Justin Williams-Thomas"-> ['Williams-Thomas', 'Justin']
 *   "Prince"                -> ['Prince', '']
 *
 * A name that is ONLY a surname and a suffix ("Smith Jr") keeps both as the
 * surname rather than sorting under the suffix and leaving a blank name.
 */
export function splitLastFirst(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ['', '']
  if (parts.length === 1) return [parts[0], '']
  let cut = parts.length - 1
  if (NAME_SUFFIXES.has(parts[cut].toLowerCase()) && cut >= 1) cut -= 1
  return [parts.slice(cut).join(' '), parts.slice(0, cut).join(' ')]
}

/** Surname for display, suffix retained. */
export function getDisplayLastName(fullName) {
  return splitLastFirst(fullName)[0]
}

/** Case-folded surname for sort keys. */
export function getSortableLastName(fullName) {
  return splitLastFirst(fullName)[0].toLowerCase()
}
