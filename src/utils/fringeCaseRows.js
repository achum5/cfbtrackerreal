// Row shaping for the Fringe Case Class Assignment local-paste grid.
//
// The grid mirrors the Google Sheet's five columns — Player, Pos, current
// class, Games, updated class — because those first four are the context the
// decision rests on (5-9 games played is the entire reason a player is on the
// list). Only the last column is actually being answered.
//
// Two shapes have to survive a paste:
//   • the local prompt's PlayerName<TAB>NewClass
//   • the Google prompt's bare column of classes, one line per pre-filled row
// Both are narrower than the grid, and a paste REPLACES the grid — so without
// widening them first, pasting would wipe the very names the screen exists to
// show.

import { getSortableLastName } from './playerNames'
import { normalizePlayerName } from './playerMatching'

// What a fringe case may become: progress to the next class, or spend the
// redshirt and stay put with an "RS" prefix. Some classes have only one legal
// answer, and "RS Sr" has none (they graduate). The Google Sheet enforces this
// exact set with per-row data validation; the local grid uses it for the same
// dropdown, and the AI prompt quotes it per player.
const PROGRESSION = {
  'Fr': ['So', 'RS Fr'],
  'So': ['Jr', 'RS So'],
  'Jr': ['Sr', 'RS Jr'],
  'Sr': ['RS Sr'],
  'RS Fr': ['RS So'],
  'RS So': ['RS Jr'],
  'RS Jr': ['RS Sr'],
  'RS Sr': [],
}

/** Allowed updated-class values for a player currently at `currentClass`. */
export function getFringeCaseClassOptions(currentClass) {
  const known = PROGRESSION[currentClass]
  if (known) return known
  return [currentClass?.replace('RS ', '') || 'Fr']
}

// Same normalization the downstream save matches on (buildFringeCaseClassSave
// → findRowPlayerIndex), so a name that survives one survives the other.
const normName = (n) => normalizePlayerName(String(n || ''))

const gamesOf = (p) => {
  const g = p?.gameCount ?? p?.gamesPlayed
  return g == null || g === '' ? '' : String(g)
}

const classOf = (p) => p?.currentClass || p?.year || ''

/** Position / current class / games for a player, as grid cells B, C, D. */
const contextCells = (p) => [p?.position || '', classOf(p), gamesOf(p)]

/** Fringe cases in the order the Google Sheet lays them out (by last name). */
export function sortFringeCasePlayers(players) {
  return [...(players || [])].sort((a, b) =>
    getSortableLastName(a.name).localeCompare(getSortableLastName(b.name)))
}

/**
 * The grid's opening contents: every fringe case, one per row, with a starting
 * pick for the updated class. The pick prefers a selection already saved for
 * the year (so re-opening shows prior decisions) and otherwise defaults to the
 * progressed class — the same default the Google Sheet pre-selects.
 *
 * @param sortedPlayers players already through sortFringeCasePlayers
 * @param savedRows     dynasty.fringeCaseClassByYear[year], or undefined
 */
export function fringeRowsFromPlayers(sortedPlayers, savedRows) {
  const savedByName = new Map()
  for (const row of savedRows || []) {
    if (row?.playerName) savedByName.set(normName(row.playerName), row)
  }
  return (sortedPlayers || []).map((p) => {
    const cls = classOf(p)
    const match = savedByName.get(normName(p.name))
    const selected = match?.selectedClass || getFringeCaseClassOptions(cls)[0] || ''
    return [p.name || '', ...contextCells(p), selected]
  })
}

/**
 * Widen a pasted grid back to five columns. Rows already that wide are left
 * exactly as they are.
 *
 * A paste of single-cell rows is read as the Google prompt's class-only
 * column and mapped BY POSITION onto `sortedPlayers`; anything else is read as
 * name-led and matched by name. A two-cell row keeps its second cell as the
 * class; other narrow shapes are ambiguous, so they keep only the name and
 * drop out of the save (the parser needs both a name and a class).
 */
export function widenFringeRows(rows, sortedPlayers) {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  const players = sortedPlayers || []
  const classOnly = rows.every((cells) => cells.length === 1) && rows.length <= players.length
  if (classOnly) {
    return rows.map((cells, i) => {
      const p = players[i]
      return [p?.name || '', ...contextCells(p), String(cells[0] || '').trim()]
    })
  }
  const byName = new Map(players.map((p) => [normName(p.name), p]))
  return rows.map((cells) => {
    if (cells.length >= 5) return cells
    const name = String(cells[0] || '').trim()
    if (cells.length !== 2) return [name, '', '', '', '']
    return [name, ...contextCells(byName.get(normName(name))), String(cells[1] || '').trim()]
  })
}
