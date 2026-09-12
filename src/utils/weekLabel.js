// Week-label helpers. The recurring bug these fix: blindly prefixing a week
// value with "W" / "Wk " / "Week " produces nonsense for postseason games whose
// "week" is a string label ("Bowl", "CCG") — e.g. "WBowl", "Wk CCG", "Week Bowl".

const isNumericWeek = (w) => w != null && w !== '' && /^\d+$/.test(String(w).trim())

/**
 * Prefix a NUMERIC week ("6" → "Wk 6") but pass a non-numeric postseason label
 * ("Bowl", "CCG") straight through unprefixed. `prefix` is whatever the call
 * site wants ("W", "Wk ", "Week ").
 */
export function formatWeek(week, prefix = 'Wk ') {
  if (week == null || week === '') return ''
  const s = String(week).trim()
  return isNumericWeek(s) ? `${prefix}${s}` : s
}

/**
 * Canonical short slot label for a game, flag-aware. Postseason games get a
 * clean label from their flags/gameType; everything else falls back to
 * formatWeek(game.week). gameType is compared as a string so this util has no
 * dependency on the heavy DynastyContext module.
 */
export function gameWeekLabel(game, prefix = 'Wk ') {
  if (!game) return ''
  const t = game.gameType
  if (game.isCFPChampionship || t === 'cfp_championship') return 'NatChamp'
  if (game.isCFPSemifinal || t === 'cfp_semifinal') return 'CFP SF'
  if (game.isCFPQuarterfinal || t === 'cfp_quarterfinal') return 'CFP QF'
  if (game.isCFPFirstRound || t === 'cfp_first_round') return 'CFP R1'
  if (game.isConferenceChampionship || t === 'conference_championship') return 'CCG'
  if (game.isBowlGame || t === 'bowl') return game.bowlName || 'Bowl'
  return formatWeek(game.week, prefix)
}

// ── Week 0 is a real week ────────────────────────────────────────────────
//
// Week 0 is the kickoff weekend that opens a season, so a game can genuinely
// carry week === 0. Label sites used to write `week ? `Week ${week}` : …`, and
// 0 is falsy: a Week 0 game fell through to the fallback, so the game page
// headed it "Game", a schedule row read "Postseason", and the AI prompts left
// the week off the game's own line.

/** True when `week` is a real NUMERIC week (0 included). */
export function hasWeek(week) {
  return isNumericWeek(week)
}

/**
 * "Week 0" / "Wk 6" for a numeric week, `fallback` when there is no week at
 * all. A non-numeric postseason label ("Bowl", "CCG") passes through
 * unprefixed, same as formatWeek.
 */
export function weekNumberLabel(week, fallback = '', prefix = 'Week') {
  if (week == null || week === '') return fallback
  const s = String(week).trim()
  return isNumericWeek(s) ? `${prefix} ${Number(s)}` : s
}
