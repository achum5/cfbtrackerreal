// Normalizers for the four player-card fields the entry sheets collect
// alongside an overall: jersey number, dev trait, archetype and NIL.
//
// They live here rather than beside one reader because the same four fields are
// now read by four paths — the Training Results sheet and its local paste, and
// the Recruit Overalls sheet and its local paste — and a value that parses one
// way in one path and another way in the next is the sort of drift that only
// shows up as a wrong number on a player page months later.
//
// All four return null for anything they cannot read. Null means "leave what
// the app already has": the player card shows ONE player at a time, so most
// rows legitimately arrive with these blank, and a guess is worse than a blank.

import { ALL_ARCHETYPES } from '../data/rosterOptions'

// Dev trait values, in the order the game reveals them. "Hidden" is a real
// value — the trait has not been revealed yet — not a stand-in for "unknown".
export const DEV_TRAIT_VALUES = ['Hidden', 'Normal', 'Impact', 'Star', 'Elite']

/** Jersey # → an integer 0-99, or null. Tolerates a leading "#". */
export function parseJerseyNumber(raw) {
  const s = String(raw ?? '').trim().replace(/^#/, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null
}

/** Dev trait → one of DEV_TRAIT_VALUES (case-insensitive), or null. */
export function normalizeDevTrait(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return null
  return DEV_TRAIT_VALUES.find(v => v.toLowerCase() === s.toLowerCase()) || null
}

/**
 * Archetype → one of the game's archetypes (case-insensitive), or null.
 *
 * Deliberately NOT filtered by the row's position: a position change and an
 * archetype change land together often enough that rejecting the pair would be
 * worse than accepting one that looks odd next to its position.
 */
export function normalizeArchetype(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return null
  return ALL_ARCHETYPES.find(v => v.toLowerCase() === s.toLowerCase()) || null
}

/**
 * NIL → a non-negative integer, or null.
 *
 * Strips the "$" and thousands separators a screenshot-reading model carries
 * over. Shorthand ("250K", "1.2M") is dropped rather than expanded — the
 * multiplier would be a guess, and an order-of-magnitude error in a NIL figure
 * is not a small one.
 */
export function parseNilAmount(raw) {
  const s = String(raw ?? '').trim().replace(/[$,\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}
