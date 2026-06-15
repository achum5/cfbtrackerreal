// Scout learning — a self-calibrating layer over the static scout grades.
//
// Real scouting departments get better by checking old evaluations against how
// players actually turned out. We do the same, grounded in THIS dynasty's
// history: every prospect we scouted (has attributes) who has since enrolled
// with a known initial OVR becomes one observation of predicted-vs-actual.
// From those observations we learn, with heavy regularization so small samples
// barely move anything:
//   • position & archetype offsets — which groups we systematically mis-rank
//     (measured RELATIVE to the field, so the freshman-OVR level gap doesn't
//     collapse the grade scale),
//   • per-archetype attribute weights — which traits actually predicted success,
//     nudged toward the data and clamped near the authored priors,
//   • hidden-dev priors — how dev traits actually revealed by star rating.
//
// The result feeds back into computeScoutScore()/gradeBreakdown() via the model
// object, so grades sharpen as more of your classes graduate.

import { archetypeKey } from './recruitAttributes'
import { SCOUT_WEIGHTS, DEV_ADJ, computeScoutScore, hasAnyAttrs } from './scoutGrade'

// Regularization knobs — deliberately conservative so the model is honest on
// the small samples a single dynasty produces.
const MIN_TOTAL = 6        // below this, report-only (apply no corrections)
const K_POS = 8            // shrinkage pseudo-count for position offsets
const K_ARCH = 6           //   …and archetype offsets
const CLAMP_POS = 6        // max |position offset|
const CLAMP_ARCH = 5       // max |archetype offset|
const MIN_ARCH_WEIGHTS = 10 // samples needed before we tune an archetype's weights
const W_ETA = 0.35         // attribute-weight learning rate
const W_COV_SCALE = 60     // covariance normaliser for the tanh squashing
const W_CLAMP_LO = 0.5     // a learned weight can't drop below 50% of its prior
const W_CLAMP_HI = 1.6     //   …or rise above 160%
const MIN_DEV_SAMPLES = 3  // per-star samples before we trust a learned dev prior

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const knownDev = (p) => (p?.devTrait && DEV_ADJ[p.devTrait] != null ? p.devTrait : null)

// A scouted player's actual initial OVR — the rating the season they enrolled.
// Prefers overallByYear[recruitYear+1]; otherwise the earliest recorded OVR.
export function initialOvr(player) {
  const oby = player?.overallByYear
  if (oby && typeof oby === 'object') {
    const enrollYr = Number(player.recruitYear) + 1
    const direct = oby[enrollYr] ?? oby[String(enrollYr)]
    if (Number.isFinite(Number(direct)) && Number(direct) > 0) return Number(direct)
    const years = Object.keys(oby).map(Number).filter((y) => Number.isFinite(y)).sort((a, b) => a - b)
    for (const y of years) {
      const v = Number(oby[y] ?? oby[String(y)])
      if (Number.isFinite(v) && v > 0) return v
    }
  }
  return null
}

/**
 * Build the list of predicted-vs-actual observations from a roster.
 * @returns {Array<{ pid, bucket, key, stars, attributes, predicted, actual, revealedDev, year }>}
 */
export function harvestScoutObservations(players) {
  const out = []
  for (const p of players || []) {
    if (!hasAnyAttrs(p)) continue           // must have been scouted
    if (p.isTarget && (p.commitmentTid == null)) continue // open target, hasn't enrolled
    const actual = initialOvr(p)
    if (actual == null) continue
    const predicted = computeScoutScore(p)  // raw, uncalibrated
    if (predicted == null) continue
    const key = archetypeKey(p.position, p.archetype)
    out.push({
      pid: p.pid,
      bucket: key.split('_')[0],
      key,
      stars: parseInt(p.stars, 10) || 3,
      attributes: p.attributes || {},
      predicted,
      actual,
      revealedDev: knownDev(p),
      year: Number(p.recruitYear) || null,
    })
  }
  return out
}

// Group-offset learning, shrunk toward zero by sample count and clamped. `resid`
// maps each observation to its current residual; returns { key: offset }.
function learnOffsets(obs, keyOf, residOf, K, clampTo) {
  const groups = {}
  obs.forEach((o, i) => {
    const g = keyOf(o)
    ;(groups[g] || (groups[g] = [])).push(residOf(o, i))
  })
  const out = {}
  for (const [g, rs] of Object.entries(groups)) {
    const raw = mean(rs) * (rs.length / (rs.length + K)) // shrink toward 0
    const v = clamp(raw, -clampTo, clampTo)
    if (Math.abs(v) >= 0.5) out[g] = v
  }
  return out
}

/**
 * Build the calibration model from observations.
 * @returns {{
 *   active, n, perYear, levelGap, residualMAE:{before,after,gainPct},
 *   positionOffset, archetypeOffset, learnedWeights, devPriors, topCorrections
 * }}
 */
export function buildScoutCalibration(obs) {
  const n = obs.length
  const empty = {
    active: false, n, perYear: {}, levelGap: 0,
    residualMAE: { before: 0, after: 0, gainPct: 0 },
    positionOffset: {}, archetypeOffset: {}, learnedWeights: {}, devPriors: {}, topCorrections: [],
  }
  if (n === 0) return empty

  const mP = mean(obs.map((o) => o.predicted))
  const mA = mean(obs.map((o) => o.actual))
  const levelGap = mP - mA // info only: how far our grades sit above initial OVR

  // Centered residual: how much a player out/under-performed his grade, with the
  // global level removed so corrections capture RELATIVE mis-ranking only.
  const r = obs.map((o) => (o.actual - mA) - (o.predicted - mP))
  const beforeMAE = mean(r.map(Math.abs))

  // Per-year counts (for the "is it improving" readout).
  const perYear = {}
  obs.forEach((o, i) => {
    const y = o.year ?? 'unknown'
    const rec = perYear[y] || (perYear[y] = { n: 0, absResidSum: 0 })
    rec.n += 1
    rec.absResidSum += Math.abs(r[i])
  })
  for (const rec of Object.values(perYear)) rec.mae = rec.n ? rec.absResidSum / rec.n : 0

  if (n < MIN_TOTAL) {
    return { ...empty, perYear, levelGap, residualMAE: { before: beforeMAE, after: beforeMAE, gainPct: 0 } }
  }

  // 1) Position offsets from the centered residual.
  const positionOffset = learnOffsets(obs, (o) => o.bucket, (_o, i) => r[i], K_POS, CLAMP_POS)
  // 2) Archetype offsets from what the position offset didn't explain.
  const archetypeOffset = learnOffsets(
    obs, (o) => o.key,
    (o, i) => r[i] - (positionOffset[o.bucket] || 0),
    K_ARCH, CLAMP_ARCH,
  )

  // 3) Per-archetype attribute-weight tuning, on the residual the offsets leave.
  const learnedWeights = {}
  const byKey = {}
  obs.forEach((o, i) => (byKey[o.key] || (byKey[o.key] = [])).push(i))
  for (const [key, idxs] of Object.entries(byKey)) {
    const prior = SCOUT_WEIGHTS[key]
    if (!prior || idxs.length < MIN_ARCH_WEIGHTS) continue
    const resid3 = idxs.map((i) => r[i] - (positionOffset[obs[i].bucket] || 0) - (archetypeOffset[key] || 0))
    const tuned = {}
    let changed = false
    for (const [attr, w] of Object.entries(prior)) {
      if (w <= 0) { tuned[attr] = w; continue }
      const xs = idxs.map((i) => Number(obs[i].attributes?.[attr]))
      const valid = xs.map((x, j) => [x, resid3[j]]).filter(([x]) => Number.isFinite(x))
      if (valid.length < MIN_ARCH_WEIGHTS) { tuned[attr] = w; continue }
      const mx = mean(valid.map(([x]) => x))
      // Covariance of this attribute with how players beat/missed their grade:
      // positive → trait was under-weighted → raise it.
      const cov = mean(valid.map(([x, rr]) => (x - mx) * rr))
      const factor = clamp(1 + W_ETA * Math.tanh(cov / W_COV_SCALE), W_CLAMP_LO, W_CLAMP_HI)
      tuned[attr] = w * factor
      if (Math.abs(factor - 1) > 0.02) changed = true
    }
    if (changed) learnedWeights[key] = tuned
  }

  // 4) Hidden-dev priors — what dev traits actually revealed, by star rating.
  const devPriors = {}
  const byStar = {}
  for (const o of obs) {
    if (!o.revealedDev) continue
    ;(byStar[o.stars] || (byStar[o.stars] = [])).push(DEV_ADJ[o.revealedDev])
  }
  for (const [star, adjs] of Object.entries(byStar)) {
    if (adjs.length < MIN_DEV_SAMPLES) continue
    devPriors[star] = Math.round(mean(adjs) * 10) / 10
  }

  const model = { active: true, n, perYear, levelGap, positionOffset, archetypeOffset, learnedWeights, devPriors }

  // After-correction residual MAE: re-grade each player with the model, recenter,
  // and measure — a fair "did the learning reduce ranking error" number.
  const calPred = obs.map((o) => {
    // Reconstruct the player enough to re-grade with the model.
    const fake = { position: o.bucket, archetype: o.key.slice(o.bucket.length + 1), attributes: o.attributes, stars: o.stars, devTrait: o.revealedDev }
    const s = computeScoutScore(fake, model)
    return s == null ? o.predicted : s
  })
  const mCal = mean(calPred)
  const rAfter = obs.map((o, i) => (o.actual - mA) - (calPred[i] - mCal))
  const afterMAE = mean(rAfter.map(Math.abs))
  const gainPct = beforeMAE > 0 ? Math.round(((beforeMAE - afterMAE) / beforeMAE) * 100) : 0

  // Most significant learned corrections, for display.
  const topCorrections = [
    ...Object.entries(positionOffset).map(([g, v]) => ({ label: g, value: v, scope: 'position' })),
    ...Object.entries(archetypeOffset).map(([g, v]) => ({ label: g.replace('_', ' '), value: v, scope: 'archetype' })),
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5)

  return { ...model, residualMAE: { before: beforeMAE, after: afterMAE, gainPct }, topCorrections }
}

/** Convenience: harvest + build in one call from a roster. */
export function scoutCalibration(players) {
  return buildScoutCalibration(harvestScoutObservations(players))
}
