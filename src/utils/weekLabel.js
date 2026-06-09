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
