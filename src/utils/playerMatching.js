/**
 * Player Matching Utility
 *
 * Handles matching new honor entries (awards, all-americans, all-conference)
 * to existing players in the players[] array.
 *
 * Rules:
 * - Same name + Same team + ≤5 seasons apart = Auto-link (same player)
 * - Same name + Different team + ≤5 seasons apart = Needs confirmation (probable transfer)
 * - Same name + ≥6 seasons apart = New player (impossible to be same due to eligibility rules)
 */

import { getTidFromAbbr } from '../data/teamRegistry'

// Characters that render as nothing (zero-width space/joiners, BOM, word
// joiner, soft hyphen, bidi marks) plus the non-whitespace control
// characters. Tabs/newlines are left alone — they collapse to one space
// below, keeping first and last name apart. A name pasted from a web page, a
// spreadsheet, or an AI response can carry one of these invisibly; the two
// copies then look identical on screen while comparing unequal, which is how
// one player split into two profiles that the duplicate scan couldn't see.
const INVISIBLE_CHARS = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g

// Cyrillic/Greek letters that are drawn identically to Latin ones. OCR and
// AI-transcribed rosters occasionally emit them mid-name.
const LOOKALIKE_LETTERS = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y',
  '\u0445': 'x', '\u0456': 'i', '\u0458': 'j', '\u0455': 's', '\u04BB': 'h', '\u0501': 'd',
  '\u0410': 'a', '\u0412': 'b', '\u0415': 'e', '\u041A': 'k', '\u041C': 'm', '\u041D': 'h',
  '\u041E': 'o', '\u0420': 'p', '\u0421': 'c', '\u0422': 't', '\u0425': 'x', '\u0406': 'i',
  '\u0408': 'j', '\u0405': 's',
  '\u03BF': 'o', '\u0391': 'a', '\u0392': 'b', '\u0395': 'e', '\u0396': 'z', '\u0397': 'h',
  '\u0399': 'i', '\u039A': 'k', '\u039C': 'm', '\u039D': 'n', '\u039F': 'o', '\u03A1': 'p',
  '\u03A4': 't', '\u03A5': 'y', '\u03A7': 'x',
}
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE_LETTERS).join('')}]`, 'g')

// Normalize player name for comparison - handles whitespace, case, and special characters
//
// Comparison-only (always lowercased — never used for display), so it can be
// aggressive about punctuation that varies between data sources. Periods and
// commas are dropped so a suffix entered as "Jr." matches "Jr" (and "A.J."
// matches "AJ"). Without this, a box-score row for "John Smith Jr" failed to
// attach to a roster "John Smith Jr." — the stats silently didn't log — and,
// conversely, inconsistent suffixes could split one player into two.
export const normalizePlayerName = (name) => {
  if (!name) return ''
  return String(name)
    .replace(INVISIBLE_CHARS, '')
    .replace(LOOKALIKE_RE, ch => LOOKALIKE_LETTERS[ch])
    // Split accented letters into base + combining mark, then drop the mark,
    // so "José" == "Jose" and a precomposed é == an e followed by U+0301.
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g, "'") // Curly/prime/backtick apostrophes to straight
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')              // Curly quotes to straight
    .replace(/[\u2010-\u2015\u2212]/g, '-')                          // Unicode dashes to hyphen
    .replace(/\./g, '')          // Drop periods so "Jr." == "Jr" and "A.J." == "AJ"
    .replace(/,/g, ' ')          // Comma to space so "Smith, Jr" == "Smith Jr"
    .replace(/\s+/g, ' ')        // Collapse whitespace (incl. NBSP and gaps left above)
    .trim()
}

// Normalize any team ref (tid number, tid-as-string, abbr, or full name) to a
// NUMERIC tid for comparison. Matching honors↔players on tid (not abbr) avoids
// false matches when two teams share an abbr, and correctly matches legacy rows
// that stored an OLD abbr from before a teambuilder rename — the abbr string may
// have drifted, but the tid is stable.
// Pass dynastyTeams so a teambuilder team's renamed abbr/name resolves to the
// live tid. Returns null when the ref can't be resolved to a tid.
const normalizeTeamForComparison = (team, dynastyTeams = null) => {
  if (!team && team !== 0) return null

  // getTidFromAbbr already handles tid (number), tid-as-string, abbr (dynasty
  // first, then static + EA aliases) and full-name fallback in one path.
  const tid = getTidFromAbbr(team, dynastyTeams)
  return tid != null ? tid : null
}

// Get all years a player has records for (from all honor types and roster)
const getPlayerYears = (player) => {
  const years = new Set()

  // From teamsByYear (primary roster tracking) - most important!
  if (player.teamsByYear) {
    Object.keys(player.teamsByYear).forEach(y => years.add(Number(y)))
  }

  // From accolades (new format) and awards (legacy)
  if (player.accolades) {
    player.accolades.forEach(a => years.add(a.year))
  }
  if (player.awards) {
    player.awards.forEach(a => years.add(a.year))
  }

  // From all-americans
  if (player.allAmericans) {
    player.allAmericans.forEach(a => years.add(a.year))
  }

  // From all-conference
  if (player.allConference) {
    player.allConference.forEach(a => years.add(a.year))
  }

  // From roster year (legacy field)
  if (player.rosterYear) {
    years.add(player.rosterYear)
  }

  return Array.from(years).sort((a, b) => a - b)
}

// Get all teams a player has been associated with (normalized to abbreviations)
const getPlayerTeams = (player, dynastyTeams = null) => {
  const teams = new Set()

  // From teamsByYear (primary roster tracking) - most important!
  if (player.teamsByYear) {
    Object.values(player.teamsByYear).forEach(t => {
      if (t) teams.add(normalizeTeamForComparison(t, dynastyTeams))
    })
  }

  // Primary team from roster (could be full name like "Kentucky Wildcats")
  if (player.team) {
    teams.add(normalizeTeamForComparison(player.team, dynastyTeams))
  }

  // Teams from honors (usually abbreviations like "UK")
  if (player.accolades) {
    player.accolades.forEach(a => {
      if (a.team) teams.add(normalizeTeamForComparison(a.team, dynastyTeams))
    })
  }
  if (player.awards) {
    player.awards.forEach(a => {
      if (a.team) teams.add(normalizeTeamForComparison(a.team, dynastyTeams))
    })
  }

  if (player.allAmericans) {
    player.allAmericans.forEach(a => {
      if (a.school) teams.add(normalizeTeamForComparison(a.school, dynastyTeams))
    })
  }

  if (player.allConference) {
    player.allConference.forEach(a => {
      if (a.school) teams.add(normalizeTeamForComparison(a.school, dynastyTeams))
    })
  }

  // From teams array if it exists
  if (player.teams) {
    player.teams.forEach(t => teams.add(normalizeTeamForComparison(t, dynastyTeams)))
  }

  // Set now holds numeric tids; drop any unresolved (null) entries so an
  // unknown team can never collide-match another unknown team.
  return Array.from(teams).filter(t => t != null)
}

// Check if a year is within 5 seasons of any year in the player's history
const isWithinEligibilityWindow = (newYear, existingYears) => {
  if (existingYears.length === 0) return false

  for (const year of existingYears) {
    const diff = Math.abs(newYear - year)
    if (diff <= 5) return true
  }

  return false
}

/**
 * Find a matching player for a new honor entry
 *
 * @param {string} name - Player name from honor entry
 * @param {string} team - Team abbreviation from honor entry
 * @param {number} year - Year of the honor
 * @param {Array} players - Existing players array
 * @param {Object} dynastyTeams - dynasty.teams for resolving teambuilder abbrs
 * @returns {Object} { player, matchType: 'exact' | 'transfer' | 'new', existingTeams, existingYears }
 */
export const findMatchingPlayer = (name, team, year, players, dynastyTeams = null) => {
  if (!name || !players) {
    return { player: null, matchType: 'new', existingTeams: [], existingYears: [] }
  }

  const normalizedName = normalizePlayerName(name)
  const normalizedTeam = normalizeTeamForComparison(team, dynastyTeams)

  // Find all players with matching name
  const nameMatches = players.filter(p =>
    normalizePlayerName(p.name) === normalizedName
  )

  if (nameMatches.length === 0) {
    return { player: null, matchType: 'new', existingTeams: [], existingYears: [] }
  }

  // For each name match, check year and team
  for (const player of nameMatches) {
    const existingYears = getPlayerYears(player)
    const existingTeams = getPlayerTeams(player, dynastyTeams)

    // Check if within eligibility window (5 seasons)
    if (isWithinEligibilityWindow(year, existingYears)) {
      // Same team = exact match (auto-link). Compare by tid; guard null so an
      // unresolved incoming team never matches an unresolved existing entry.
      if (normalizedTeam != null && existingTeams.includes(normalizedTeam)) {
        return {
          player,
          matchType: 'exact',
          existingTeams,
          existingYears
        }
      }

      // Different team but within window = probable transfer (needs confirmation)
      return {
        player,
        matchType: 'transfer',
        existingTeams,
        existingYears
      }
    }
  }

  // Name matches but all are outside eligibility window = new player
  return { player: null, matchType: 'new', existingTeams: [], existingYears: [] }
}

/**
 * Process a batch of honor entries and determine matches
 *
 * @param {Array} entries - Array of honor entries with { name, team, year, ... }
 * @param {Array} players - Existing players array
 * @returns {Object} { autoLink: [], needsConfirmation: [], newPlayers: [] }
 */
export const processHonorEntries = (entries, players) => {
  const results = {
    autoLink: [],        // Exact matches - auto-link to existing player
    needsConfirmation: [], // Transfer candidates - need user confirmation
    newPlayers: []       // No match found - create new player
  }

  for (const entry of entries) {
    const { name, team, year } = entry
    const match = findMatchingPlayer(name, team, year, players)

    if (match.matchType === 'exact') {
      results.autoLink.push({ entry, player: match.player })
    } else if (match.matchType === 'transfer') {
      results.needsConfirmation.push({
        entry,
        player: match.player,
        existingTeams: match.existingTeams,
        existingYears: match.existingYears
      })
    } else {
      results.newPlayers.push({ entry })
    }
  }

  return results
}

/**
 * Get a descriptive string of a player's most recent honor
 * Used for the confirmation popup
 */
export const getPlayerLastHonorDescription = (player) => {
  const allHonors = []

  // Check accolades (new format) and awards (legacy)
  if (player.accolades) {
    player.accolades.forEach(a => {
      allHonors.push({
        year: a.year,
        description: `${a.award} winner`,
        team: a.team
      })
    })
  }
  if (player.awards) {
    player.awards.forEach(a => {
      allHonors.push({
        year: a.year,
        description: `${a.award} winner`,
        team: a.team
      })
    })
  }

  if (player.allAmericans) {
    player.allAmericans.forEach(a => {
      const designation = a.designation === 'first' ? '1st Team' :
                          a.designation === 'second' ? '2nd Team' : 'Freshman'
      allHonors.push({
        year: a.year,
        description: `${designation} All-American (${a.position})`,
        team: a.school
      })
    })
  }

  if (player.allConference) {
    player.allConference.forEach(a => {
      const designation = a.designation === 'first' ? '1st Team' :
                          a.designation === 'second' ? '2nd Team' : 'Freshman'
      allHonors.push({
        year: a.year,
        description: `${designation} All-Conference (${a.position})`,
        team: a.school
      })
    })
  }

  // Sort by year descending and get most recent
  allHonors.sort((a, b) => b.year - a.year)

  if (allHonors.length > 0) {
    const recent = allHonors[0]
    return { ...recent }
  }

  // Fallback if only roster data
  if (player.team) {
    return {
      year: player.rosterYear || 'Unknown',
      description: `${player.position || 'Player'}`,
      team: player.team
    }
  }

  return null
}

// Punctuation/spacing-blind key — comparison only. Looser than
// normalizePlayerName: drops EVERYTHING non-alphanumeric so "D'Marcus" ==
// "DMarcus", "Smith-Jones" == "Smith Jones", and a stray double space or
// apostrophe variant can't split a roster player from the row naming him.
const looseNameKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Find the roster player a typed/pasted name refers to.
 *
 * Exact normalized match first (the previous behavior). If that misses, fall
 * back to a punctuation/spacing-blind match — applied ONLY when it is
 * unambiguous, so a loose key shared by two players never picks one at random.
 *
 * Returns null when nothing matches. Callers that used to silently skip a
 * null should surface it instead: the Players Leaving save wrote a row with a
 * null pid and no movement, which left the player looking untouched (still in
 * the portal from an earlier stub, still "not a grad") with no indication the
 * row had failed to apply.
 */
export const findRosterPlayerByName = (players, name) => {
  if (!name || !Array.isArray(players) || players.length === 0) return null
  const norm = normalizePlayerName(name)
  if (norm) {
    const exact = players.find(p => normalizePlayerName(p?.name) === norm)
    if (exact) return exact
  }
  const key = looseNameKey(name)
  if (!key) return null
  const loose = players.filter(p => looseNameKey(p?.name) === key)
  return loose.length === 1 ? loose[0] : null
}

/**
 * Resolve an offseason sheet row ({ playerName | name, pid? }) to an index
 * into `players`, id-anchored where the row carries a pid.
 *
 * Rows are pasted text, so they arrive with a name only; every save stamps
 * the resolved pid onto the stored row, and later readers (the season
 * advance, re-saves) resolve that pid first. Resolution order preserves
 * today's name behavior exactly and only ADDS pid where names fail:
 *
 *   1. exactly one player matches by name (per `nameEq`)  -> that player
 *   2. the row's pid matches a player                      -> that player
 *      (this is also how duplicate names are disambiguated)
 *   3. several players match by name                       -> the first
 *   4. otherwise                                           -> -1
 *
 * `predicate` narrows the candidate players (e.g. this cycle's recruits)
 * and applies to both name and pid lookups.
 */
export function findRowPlayerIndex(players, row, { nameEq, predicate } = {}) {
  const list = Array.isArray(players) ? players : []
  const ok = (p) => !!p && (!predicate || predicate(p))
  const rowName = row?.playerName ?? row?.name
  const nameMatches = []
  if (rowName != null && typeof nameEq === 'function') {
    list.forEach((p, i) => { if (ok(p) && nameEq(p.name, rowName)) nameMatches.push(i) })
  }
  if (nameMatches.length === 1) return nameMatches[0]
  if (row?.pid != null) {
    const byPid = list.findIndex(p => ok(p) && p.pid != null && String(p.pid) === String(row.pid))
    if (byPid !== -1) return byPid
  }
  return nameMatches.length > 0 ? nameMatches[0] : -1
}

/** Stamp the resolved player's pid onto a stored row (same object when already right). */
export const withRowPid = (row, player) =>
  (!player || player.pid == null || String(row?.pid) === String(player.pid)) ? row : { ...row, pid: player.pid }
