// Row shaping for the "Enter All Team Overalls" preseason sheet.
//
// Every other data-entry to-do is the same three steps — copy a prompt, hand an
// AI your screenshots, paste the reply into an editable grid. This one used to
// be 138 schools of hand-typed number boxes, which is the single longest piece
// of manual entry left in the app. These helpers are what let it use the same
// grid as everything else.
//
// Rows are [Team, OVR, OFF, DEF] and are matched BY TEAM NAME, so paste order
// does not matter and a partial paste is fine.

import { getTeamNameLabel, getTidFromTeamName, getTidFromAbbr, resolveTid, TEAMS } from '../data/teamRegistry'

/** A rating cell → an integer 0-99, or null for blank/unreadable. */
export function parseRating(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null
}

/**
 * Resolve whatever the Team cell holds to a tid: the canonical label, a raw
 * team name, an abbreviation, or a name that only the alias table knows.
 * Returns null when nothing matches — the row is then reported, not guessed at.
 */
export function resolveTeamCell(cell, teams) {
  const text = String(cell ?? '').trim()
  if (!text) return null
  const src = (teams && Object.keys(teams).length) ? teams : TEAMS
  const tid =
    getTidFromTeamName(text, src) ??
    getTidFromAbbr(text, src) ??
    resolveTid(text, src)
  return tid == null ? null : Number(tid)
}

/**
 * The grid's opening contents: one row per FBS team, alphabetical, pre-filled
 * with the ratings already stored for the year. Alphabetical rather than
 * grouped by conference because the grid is a flat table with no group
 * headings, and the save matches by name anyway.
 *
 * @param teams      dynasty.teams (or the static registry)
 * @param ratingsFor (tid) => { overall, offense, defense } for the year
 */
export function teamOverallRows(teams, ratingsFor) {
  const src = (teams && Object.keys(teams).length) ? teams : TEAMS
  return Object.values(src)
    .filter(t => t && t.name && !t.isFCS)
    .map(t => {
      const label = getTeamNameLabel(src, t.tid) || t.name
      const r = ratingsFor?.(t.tid) || {}
      const cell = (v) => (v == null || v === '' ? '' : String(v))
      return { tid: t.tid, cells: [label, cell(r.overall), cell(r.offense), cell(r.defense)] }
    })
    .sort((a, b) => a.cells[0].localeCompare(b.cells[0]))
}

/**
 * Pasted rows → the { [tid]: {overall, offense, defense} } map the bulk save
 * takes, keeping ONLY teams whose values actually differ from what is stored.
 *
 * The grid opens pre-filled with all 138 teams, so importing it unchanged would
 * otherwise rewrite every school's ratings on every save — a large write for no
 * change, on a document that is already size-sensitive.
 *
 * @returns { changed, unmatched, blank } — unmatched names are surfaced to the
 *   user rather than dropped silently, since a typo'd school is invisible
 *   otherwise.
 */
export function parseTeamOverallRows(rows, teams, ratingsFor) {
  const changed = {}
  const unmatched = []
  let blank = 0
  const seen = new Set()
  for (const row of rows || []) {
    const name = String(row?.[0] ?? '').trim()
    if (!name) continue
    // A header line pasted along with the data.
    if (name.toLowerCase() === 'team') continue
    const tid = resolveTeamCell(name, teams)
    if (tid == null) {
      unmatched.push(name)
      continue
    }
    const next = {
      overall: parseRating(row?.[1]),
      offense: parseRating(row?.[2]),
      defense: parseRating(row?.[3]),
    }
    if (next.overall == null && next.offense == null && next.defense == null) {
      blank++
      continue
    }
    // A team listed twice: the last row wins, the way a later edit would.
    seen.add(tid)
    const existing = ratingsFor?.(tid) || {}
    const same =
      next.overall === (existing.overall ?? null) &&
      next.offense === (existing.offense ?? null) &&
      next.defense === (existing.defense ?? null)
    if (same) {
      delete changed[tid]
      continue
    }
    changed[tid] = next
  }
  return { changed, unmatched, blank }
}
