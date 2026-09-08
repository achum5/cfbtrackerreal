// Largest deficit FACED vs largest deficit OVERCOME.
//
// The game-recap prompt used to compute one number — the largest margin a
// team ever trailed by — and label it "Largest deficit overcome". For the
// winning team those happen to be the same number (they ended ahead, so
// every deficit they faced was erased). For the LOSING team it is simply
// false: Massachusetts trailed Toledo 14-6 at the final whistle and the
// prompt announced "Largest deficit overcome by Massachusetts Minutemen:
// 8 points". The writing model either repeats that as a comeback that
// never happened, or notices the contradiction and discards the whole
// GAME FLOW block.
//
// A deficit is OVERCOME only once the team gets back to level or ahead.
// Trailing at the end means the current deficit was never overcome, no
// matter how large it grew.

/**
 * @param {Array<{t1:number,t2:number}>} snapshots running score after each
 *   scoring play, in chronological order
 * @returns {{t1Faced:number, t1Overcome:number, t2Faced:number, t2Overcome:number}}
 */
export function computeDeficits(snapshots) {
  let t1Faced = 0, t2Faced = 0
  let t1Overcome = 0, t2Overcome = 0
  // The deficit accumulated during the CURRENT trailing run — only banked
  // as "overcome" if the run ends with the team level or ahead.
  let t1Run = 0, t2Run = 0

  for (const { t1, t2 } of snapshots || []) {
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) continue
    if (t1 < t2) {
      const d = t2 - t1
      t1Faced = Math.max(t1Faced, d)
      t1Run = Math.max(t1Run, d)
    } else {
      // Level or ahead: whatever they had been trailing by is now erased.
      t1Overcome = Math.max(t1Overcome, t1Run)
      t1Run = 0
    }
    if (t2 < t1) {
      const d = t1 - t2
      t2Faced = Math.max(t2Faced, d)
      t2Run = Math.max(t2Run, d)
    } else {
      t2Overcome = Math.max(t2Overcome, t2Run)
      t2Run = 0
    }
  }
  // Any run still open at the final whistle was never overcome — deliberately
  // not banked.
  return { t1Faced, t1Overcome, t2Faced, t2Overcome }
}

/** The prompt line for one team, stating both facts without contradiction. */
export function describeDeficit(name, faced, overcome) {
  if (faced === 0) return `${name} never trailed in this game.`
  const pts = (n) => `${n} point${n === 1 ? '' : 's'}`
  if (overcome === 0) {
    return `${name} trailed by as much as ${pts(faced)} and NEVER got back to even — ${name} overcame no deficit in this game.`
  }
  if (overcome === faced) {
    return `${name} trailed by as much as ${pts(faced)} and erased all of it (got back to level or ahead at some point).`
  }
  return `${name} trailed by as much as ${pts(faced)}; the largest deficit ${name} actually erased was ${pts(overcome)}.`
}
