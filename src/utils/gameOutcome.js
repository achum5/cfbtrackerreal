// Resolving who won a game — including when nobody did.
//
// The recap prompt derived every winner from a single boolean,
// `team1Won = team1Score > team2Score`, and then treated `false` as "team 2
// won". For a TIE that is silently wrong in the same way "largest deficit
// overcome" was: the number is real, the label asserts something the data
// doesn't support. A 21-21 game produced the prompt's headline result line
// "Team B defeated Team A 21-21", a head-to-head row "Team B def. Team A
// 21-21", and — when team 1 was the rated favorite — "This qualifies as an
// UPSET". Meanwhile the GAME FLOW block, which does handle ties, reported
// the same game as tied. The model is handed a contradiction and either
// repeats the false claim or discards the block.
//
// Ties are reachable: the app accepts any entered score, and the codebase
// already guards for them elsewhere (propagateCFPWinner, record math,
// describeLead). This is the one place that didn't.

/**
 * @returns {{ isTie: boolean, team1Won: boolean, team2Won: boolean,
 *   winnerIsTeam1: boolean|null }} winnerIsTeam1 is null for a tie.
 */
export function resolveOutcome(team1Score, team2Score) {
  // Deliberately strict about what counts as a score. Number(null) is 0 and
  // Number('') is 0, so a MISSING score would otherwise read as a real
  // shutout — an unplayed game would resolve to "Team B defeated Team A
  // 14-0". Only actual numbers and numeric strings are scores.
  const toScore = (v) => {
    if (v === null || v === undefined || v === '') return NaN
    if (typeof v === 'boolean') return NaN
    return Number(v)
  }
  const a = toScore(team1Score)
  const b = toScore(team2Score)
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { isTie: false, team1Won: false, team2Won: false, winnerIsTeam1: null }
  }
  if (a === b) return { isTie: true, team1Won: false, team2Won: false, winnerIsTeam1: null }
  const t1 = a > b
  return { isTie: false, team1Won: t1, team2Won: !t1, winnerIsTeam1: t1 }
}

/**
 * One sentence stating the result, correct for a tie.
 * "Kentucky defeated Louisville 45-27" / "Kentucky and Louisville tied 21-21"
 */
export function describeResult(team1Name, team1Score, team2Name, team2Score) {
  const { isTie, winnerIsTeam1 } = resolveOutcome(team1Score, team2Score)
  if (isTie) return `${team1Name} and ${team2Name} tied ${Number(team1Score)}-${Number(team2Score)}`
  if (winnerIsTeam1 == null) return `${team1Name} vs ${team2Name}`
  const [wn, ws, ln, ls] = winnerIsTeam1
    ? [team1Name, team1Score, team2Name, team2Score]
    : [team2Name, team2Score, team1Name, team1Score]
  return `${wn} defeated ${ln} ${ws}-${ls}`
}

/** Short form for a history row: "Kentucky def. Louisville 45-27" / "Kentucky 21, Louisville 21 (tie)" */
export function describeHistoryRow(team1Name, team1Score, team2Name, team2Score) {
  const { isTie, winnerIsTeam1 } = resolveOutcome(team1Score, team2Score)
  if (isTie) return `${team1Name} ${Number(team1Score)}, ${team2Name} ${Number(team2Score)} (tie)`
  if (winnerIsTeam1 == null) return `${team1Name} vs ${team2Name}`
  const [wn, ws, ln, ls] = winnerIsTeam1
    ? [team1Name, team1Score, team2Name, team2Score]
    : [team2Name, team2Score, team1Name, team1Score]
  return `${wn} def. ${ln} ${ws}-${ls}`
}
