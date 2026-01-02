/**
 * Universal pWAR v3 (Snaps-Based, True-Play Focus)
 *
 * Computes player Wins Above Replacement across all positions using:
 * 1) Position QualityGrade (0-100, centered at 60)
 * 2) Snaps-based participation/share
 * 3) Unit strength -> adjusted wins betas
 * 4) Replacement baseline q_rep per unit group
 * 5) Separate Return (RET) facet
 */

// ========================================================
// B) CORE HELPERS
// ========================================================

/**
 * Safe division - returns 0 if divisor is <= 0
 */
export function safeDivide(a, b) {
  return b > 0 ? a / b : 0
}

/**
 * Winsorize values at given percentiles within a dataset
 * @param {number[]} values - Array of values to winsorize
 * @param {number} lowPct - Lower percentile (0-1), e.g., 0.05 for 5th percentile
 * @param {number} highPct - Upper percentile (0-1), e.g., 0.95 for 95th percentile
 * @returns {number[]} - Winsorized values
 */
export function winsorize(values, lowPct = 0.05, highPct = 0.95) {
  if (!values || values.length === 0) return values

  const sorted = [...values].sort((a, b) => a - b)
  const lowIdx = Math.floor(sorted.length * lowPct)
  const highIdx = Math.ceil(sorted.length * highPct) - 1
  const lowVal = sorted[Math.max(0, lowIdx)]
  const highVal = sorted[Math.min(sorted.length - 1, highIdx)]

  return values.map(v => Math.max(lowVal, Math.min(highVal, v)))
}

/**
 * Get percentile value from sorted array
 */
export function getPercentile(sortedValues, percentile) {
  if (!sortedValues || sortedValues.length === 0) return 0
  const idx = Math.floor(sortedValues.length * percentile)
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, idx))]
}

/**
 * Empirical Bayes smoothing for rates
 * @param {number} count - Observed count (successes)
 * @param {number} opportunities - Total opportunities
 * @param {number} leagueMean - League average rate
 * @param {number} priorOpp - Prior weight (K)
 * @returns {number} - Smoothed rate
 */
export function smoothRate(count, opportunities, leagueMean, priorOpp) {
  return safeDivide(count + leagueMean * priorOpp, opportunities + priorOpp)
}

/**
 * Calculate z-score
 * @param {number} value - The value to standardize
 * @param {number} mean - Population mean
 * @param {number} stdDev - Population standard deviation
 * @returns {number} - Z-score (0 if stdDev is 0)
 */
export function zScore(value, mean, stdDev) {
  return stdDev > 0 ? (value - mean) / stdDev : 0
}

/**
 * Calculate mean of array
 */
export function mean(values) {
  if (!values || values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Calculate standard deviation of array
 */
export function stdDev(values) {
  if (!values || values.length < 2) return 0
  const avg = mean(values)
  const squareDiffs = values.map(v => Math.pow(v - avg, 2))
  return Math.sqrt(mean(squareDiffs))
}

/**
 * Calculate weighted percentile
 * @param {Array<{value: number, weight: number}>} items - Items with values and weights
 * @param {number} percentile - Target percentile (0-1)
 * @returns {number} - Weighted percentile value
 */
export function weightedPercentile(items, percentile) {
  if (!items || items.length === 0) return 0

  // Sort by value
  const sorted = [...items].sort((a, b) => a.value - b.value)
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight === 0) return 0

  const targetWeight = totalWeight * percentile
  let cumWeight = 0

  for (const item of sorted) {
    cumWeight += item.weight
    if (cumWeight >= targetWeight) {
      return item.value
    }
  }

  return sorted[sorted.length - 1].value
}

/**
 * Clamp value to range
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Map standardized score to grade (0-100, centered at 60)
 * @param {number} scoreStd - Standardized score
 * @returns {number} - Grade (0-100)
 */
export function scoreToGrade(scoreStd) {
  return clamp(60 + 12 * scoreStd, 0, 100)
}

/**
 * Apply shrinkage to grade based on sample size
 * @param {number} gradeRaw - Raw grade
 * @param {number} opportunities - Player's opportunities
 * @param {number} kPos - Position-specific shrinkage constant
 * @returns {number} - Shrunk grade
 */
export function shrinkGrade(gradeRaw, opportunities, kPos) {
  const shrink = safeDivide(opportunities, opportunities + kPos)
  return 60 + (gradeRaw - 60) * shrink
}

/**
 * Convert QualityGrade to universal quality index q
 * @param {number} qualityGrade - Grade (0-100)
 * @returns {number} - Quality index
 */
export function gradeToQ(qualityGrade) {
  return (qualityGrade - 60) / 12
}

// ========================================================
// C) OPPORTUNITY DEFINITIONS
// ========================================================

/**
 * Get opportunities for a player based on position (for shrinkage)
 */
export function getOpportunities(player, position, teamDropbacks = 0, teamOLSnaps = {}) {
  const stats = player.stats || {}

  switch (position) {
    case 'QB':
      return (stats.attempts || 0) + (stats.sacksTaken || 0)
    case 'HB':
    case 'FB':
      return (stats.carries || 0) + (stats.receptions || 0)
    case 'WR':
    case 'TE':
      return (stats.receptions || 0) + (stats.drops || 0)
    case 'LT':
    case 'LG':
    case 'C':
    case 'RG':
    case 'RT':
      // Pass-block opportunities estimated from snap share
      const totalPosSnaps = teamOLSnaps[position] || 0
      if (totalPosSnaps > 0 && stats.offSnaps > 0) {
        return teamDropbacks * (stats.offSnaps / totalPosSnaps)
      }
      return 0
    case 'LEDG':
    case 'REDG':
    case 'DT':
    case 'SAM':
    case 'MIKE':
    case 'WILL':
    case 'CB':
    case 'FS':
    case 'SS':
      return stats.defSnaps || 0
    case 'K':
      return (stats.fgAttempts || 0) + (stats.xpAttempts || 0)
    case 'P':
      return stats.punts || 0
    default:
      return 0
  }
}

/**
 * Get return opportunities
 */
export function getReturnOpportunities(player) {
  const stats = player.stats || {}
  return (stats.kickReturns || 0) + (stats.puntReturns || 0)
}

// ========================================================
// QUALIFICATION THRESHOLDS
// ========================================================

export const QUALIFICATION_THRESHOLDS = {
  QB: 100,      // dropbacks
  HB: 50,       // touches
  FB: 50,       // touches
  WR: 20,       // catchOpp
  TE: 15,       // catchOpp
  LT: 150, LG: 150, C: 150, RG: 150, RT: 150,  // PBopp
  LEDG: 200, REDG: 200, DT: 200,  // defSnaps
  SAM: 200, MIKE: 200, WILL: 200,  // defSnaps
  CB: 200, FS: 200, SS: 200,       // defSnaps
  K: 10,        // kickOpp
  P: 15,        // punts
  RET: 10       // returns
}

// ========================================================
// SHRINKAGE CONSTANTS (k_pos)
// ========================================================

export const K_POS = {
  QB: 200,
  HB: 80,
  FB: 80,
  WR: 60,
  TE: 50,
  LT: 250, LG: 250, C: 250, RG: 250, RT: 250,
  LEDG: 350, REDG: 350, DT: 350,
  SAM: 275, MIKE: 275, WILL: 275,
  CB: 350, FS: 350, SS: 350,
  K: 25,
  P: 40,
  RET: 30
}

// ========================================================
// SMOOTHING PRIOR CONSTANTS
// ========================================================

export const SMOOTHING_PRIORS = {
  // QB
  qbTdRate: 150,
  qbIntRate: 150,
  qbFumbleRate: 200,
  // HB
  hbBrokenTackles: 80,
  hbExplosive: 120,
  hbTdRate: 120,
  hbFumbleRate: 120,
  // WR/TE
  wrTdRate: 60,
  wrDropRate: 60,
  wrFumbleRate: 80,
  // OL
  olSackRate: 300,
  // Defense
  defSnapsRate: 300,
  defTargetsRate: 60,
  // K
  kBlockedRate: 30,
  // P
  pI20Rate: 50,
  pTbRate: 50,
  pBlockedRate: 50,
  // Returns
  retTdRate: 40
}

// ========================================================
// D) POSITION QUALITYGRADE CALCULATIONS
// ========================================================

/**
 * Calculate league averages for a given stat across qualified players
 */
export function calculateLeagueAverages(players, position, qualThreshold) {
  const qualified = players.filter(p => {
    const opp = getOpportunities(p, position)
    return opp >= qualThreshold
  })

  if (qualified.length === 0) return {}

  const averages = {}

  // Aggregate stats
  const totals = {}
  qualified.forEach(p => {
    const stats = p.stats || {}
    Object.keys(stats).forEach(key => {
      if (typeof stats[key] === 'number') {
        totals[key] = (totals[key] || 0) + stats[key]
      }
    })
  })

  return totals
}

/**
 * Calculate QB QualityGrade using absolute benchmarks
 * When there's insufficient comparison data, use absolute metrics
 * Includes rushing contribution for dual-threat QBs
 */
export function calculateQBGrade(player, leagueStats, allQBs) {
  const stats = player.stats || {}
  const dropbacks = (stats.attempts || 0) + (stats.sacksTaken || 0)

  if (dropbacks < QUALIFICATION_THRESHOLDS.QB) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Raw passing metrics
  const anya = stats.anyA || 0
  const compPct = safeDivide(stats.completions || 0, stats.attempts || 0)
  const tdRate = safeDivide(stats.passingTd || 0, stats.attempts || 0)
  const intRate = safeDivide(stats.interceptions || 0, stats.attempts || 0)

  // Rushing metrics for dual-threat bonus
  const rushYards = stats.rushYards || 0
  const rushTd = stats.rushTd || 0
  const carries = stats.carries || 0
  const rushYpc = safeDivide(rushYards, carries)

  // Get z-scores from qualified population
  const qualifiedQBs = allQBs.filter(qb => {
    const qbDropbacks = (qb.stats?.attempts || 0) + (qb.stats?.sacksTaken || 0)
    return qbDropbacks >= QUALIFICATION_THRESHOLDS.QB
  })

  // If insufficient comparison data (< 3 QBs), use absolute benchmarks
  // Based on typical CFB QB performance ranges
  if (qualifiedQBs.length < 3) {
    // ANY/A benchmarks: Elite ~9+, Great ~7.5, Average ~6, Below Average ~5
    // CompPct benchmarks: Elite ~70%+, Great ~65%, Average ~60%, Below ~55%
    // TD Rate benchmarks: Elite ~7%+, Great ~5%, Average ~4%, Below ~3%
    // INT Rate benchmarks: Elite ~1.5%, Great ~2.5%, Average ~3.5%, Risky ~4.5%+

    let anyaScore = 0
    if (anya >= 9) anyaScore = 2.5
    else if (anya >= 8) anyaScore = 2
    else if (anya >= 7) anyaScore = 1.5
    else if (anya >= 6) anyaScore = 1
    else if (anya >= 5) anyaScore = 0
    else if (anya >= 4) anyaScore = -1
    else anyaScore = -2

    let compScore = 0
    if (compPct >= 0.72) compScore = 2
    else if (compPct >= 0.68) compScore = 1.5
    else if (compPct >= 0.65) compScore = 1
    else if (compPct >= 0.60) compScore = 0.5
    else if (compPct >= 0.55) compScore = 0
    else if (compPct >= 0.50) compScore = -1
    else compScore = -2

    let tdScore = 0
    if (tdRate >= 0.08) tdScore = 2.5
    else if (tdRate >= 0.07) tdScore = 2
    else if (tdRate >= 0.06) tdScore = 1.5
    else if (tdRate >= 0.05) tdScore = 1
    else if (tdRate >= 0.04) tdScore = 0.5
    else if (tdRate >= 0.03) tdScore = 0
    else if (tdRate >= 0.02) tdScore = -1
    else tdScore = -2

    let intScore = 0
    if (intRate <= 0.015) intScore = 2
    else if (intRate <= 0.02) intScore = 1.5
    else if (intRate <= 0.025) intScore = 1
    else if (intRate <= 0.03) intScore = 0.5
    else if (intRate <= 0.035) intScore = 0
    else if (intRate <= 0.045) intScore = -0.5
    else if (intRate <= 0.055) intScore = -1
    else intScore = -2

    // Rushing bonus for dual-threat QBs
    // Rush yards: Elite 1000+, Great 600+, Good 300+, Some 100+
    // Rush TDs: Each TD worth ~0.15 bonus
    let rushScore = 0
    if (rushYards >= 1200) rushScore = 2.5
    else if (rushYards >= 800) rushScore = 2
    else if (rushYards >= 500) rushScore = 1.5
    else if (rushYards >= 300) rushScore = 1
    else if (rushYards >= 150) rushScore = 0.5
    else if (rushYards >= 50) rushScore = 0.25
    else rushScore = 0

    // TD bonus
    rushScore += Math.min(rushTd * 0.12, 1.5) // Cap at 1.5 bonus from TDs

    // YPC bonus/penalty for efficiency
    if (carries >= 30) {
      if (rushYpc >= 7) rushScore += 0.3
      else if (rushYpc >= 5.5) rushScore += 0.15
      else if (rushYpc < 3.5) rushScore -= 0.25
    }

    // Cap total rush score
    rushScore = Math.min(rushScore, 3.0)

    // Weighted composite - passing is primary, rushing is bonus
    // Total weights: 0.45 + 0.10 + 0.20 + 0.15 + 0.10 = 1.0
    const compositeScore = 0.45 * anyaScore + 0.10 * compScore + 0.20 * tdScore + 0.15 * intScore + 0.10 * rushScore
    const qualityGrade = clamp(60 + 12 * compositeScore, 0, 100)
    const q = gradeToQ(qualityGrade)

    return { qualityGrade, q, qualified: true, components: { anyaScore, compScore, tdScore, intScore, rushScore } }
  }

  // League means for smoothing
  const leagueTdRate = safeDivide(leagueStats.passingTd || 0, leagueStats.attempts || 1)
  const leagueIntRate = safeDivide(leagueStats.interceptions || 0, leagueStats.attempts || 1)
  const leagueFumbleRate = safeDivide(leagueStats.fumbles || 0, leagueStats.dropbacks || 1)

  // Smoothed rates
  const smoothedTdRate = smoothRate(stats.passingTd || 0, stats.attempts || 0, leagueTdRate, SMOOTHING_PRIORS.qbTdRate)
  const smoothedIntRate = smoothRate(stats.interceptions || 0, stats.attempts || 0, leagueIntRate, SMOOTHING_PRIORS.qbIntRate)
  const fumbleRate = smoothRate(stats.fumbles || 0, dropbacks, leagueFumbleRate, SMOOTHING_PRIORS.qbFumbleRate)

  // Calculate population stats
  const anyaVals = qualifiedQBs.map(qb => qb.stats?.anyA || 0)
  const compPctVals = qualifiedQBs.map(qb => safeDivide(qb.stats?.completions || 0, qb.stats?.attempts || 0))
  const tdRateVals = qualifiedQBs.map(qb => smoothRate(qb.stats?.passingTd || 0, qb.stats?.attempts || 0, leagueTdRate, SMOOTHING_PRIORS.qbTdRate))
  const intRateVals = qualifiedQBs.map(qb => smoothRate(qb.stats?.interceptions || 0, qb.stats?.attempts || 0, leagueIntRate, SMOOTHING_PRIORS.qbIntRate))
  const fumbleRateVals = qualifiedQBs.map(qb => {
    const db = (qb.stats?.attempts || 0) + (qb.stats?.sacksTaken || 0)
    return smoothRate(qb.stats?.fumbles || 0, db, leagueFumbleRate, SMOOTHING_PRIORS.qbFumbleRate)
  })

  // Winsorize ANYA
  const anyaWinsorized = winsorize(anyaVals)
  const playerAnyaIdx = anyaVals.indexOf(anya)
  const playerAnyaWin = playerAnyaIdx >= 0 ? anyaWinsorized[playerAnyaIdx] : anya

  // Z-scores
  const zAnya = zScore(playerAnyaWin, mean(anyaWinsorized), stdDev(anyaWinsorized))
  const zCompPct = zScore(compPct, mean(compPctVals), stdDev(compPctVals))
  const zTdRate = zScore(smoothedTdRate, mean(tdRateVals), stdDev(tdRateVals))
  const zIntRate = zScore(smoothedIntRate, mean(intRateVals), stdDev(intRateVals))
  const zFumbleRate = zScore(fumbleRate, mean(fumbleRateVals), stdDev(fumbleRateVals))

  // Weighted score (INT and Fumble are BAD, so negative weight)
  const scoreRaw = (
    0.50 * zAnya +
    0.15 * zCompPct +
    0.15 * zTdRate +
    -0.10 * zIntRate +
    -0.10 * zFumbleRate
  )

  // Standardize across all QBs
  const allScores = qualifiedQBs.map((qb, idx) => {
    const qbAnya = anyaWinsorized[idx]
    const qbCompPct = compPctVals[idx]
    const qbTdRate = tdRateVals[idx]
    const qbIntRate = intRateVals[idx]
    const qbFumbleRate = fumbleRateVals[idx]

    return (
      0.50 * zScore(qbAnya, mean(anyaWinsorized), stdDev(anyaWinsorized)) +
      0.15 * zScore(qbCompPct, mean(compPctVals), stdDev(compPctVals)) +
      0.15 * zScore(qbTdRate, mean(tdRateVals), stdDev(tdRateVals)) +
      -0.10 * zScore(qbIntRate, mean(intRateVals), stdDev(intRateVals)) +
      -0.10 * zScore(qbFumbleRate, mean(fumbleRateVals), stdDev(fumbleRateVals))
    )
  })

  const scoreStd = zScore(scoreRaw, mean(allScores), stdDev(allScores))
  const gradeRaw = scoreToGrade(scoreStd)
  const qualityGrade = shrinkGrade(gradeRaw, dropbacks, K_POS.QB)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true, components: { zAnya, zCompPct, zTdRate, zIntRate, zFumbleRate } }
}

/**
 * Calculate HB QualityGrade using absolute benchmarks when needed
 */
export function calculateHBGrade(player, leagueStats, allHBs) {
  const stats = player.stats || {}
  const touches = (stats.carries || 0) + (stats.receptions || 0)

  if (touches < QUALIFICATION_THRESHOLDS.HB) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  const carries = stats.carries || 0
  if (carries === 0) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Raw efficiency metrics
  const ypc = safeDivide(stats.rushYards || 0, carries)
  const tdRate = safeDivide(stats.rushTd || 0, carries)
  const fumbleRate = safeDivide(stats.fumbles || 0, touches)

  // Get qualified HBs
  const qualifiedHBs = allHBs.filter(hb => {
    const hbTouches = (hb.stats?.carries || 0) + (hb.stats?.receptions || 0)
    return hbTouches >= QUALIFICATION_THRESHOLDS.HB && (hb.stats?.carries || 0) > 0
  })

  // If insufficient comparison data, use absolute benchmarks
  if (qualifiedHBs.length < 3) {
    // YPC benchmarks: Elite 7+, Great 5.5, Average 4.5, Below 3.5
    // TD Rate benchmarks: Elite 8%+, Great 5%, Average 3%, Below 2%
    // Fumble Rate: Elite <1%, Great <2%, Average <3%, Risky >4%

    let ypcScore = 0
    if (ypc >= 7) ypcScore = 2
    else if (ypc >= 5.5) ypcScore = 1
    else if (ypc >= 4.0) ypcScore = 0
    else if (ypc >= 3.0) ypcScore = -1
    else ypcScore = -2

    let tdScore = 0
    if (tdRate >= 0.08) tdScore = 2
    else if (tdRate >= 0.05) tdScore = 1
    else if (tdRate >= 0.03) tdScore = 0
    else if (tdRate >= 0.015) tdScore = -1
    else tdScore = -2

    let fumScore = 0
    if (fumbleRate <= 0.01) fumScore = 2
    else if (fumbleRate <= 0.02) fumScore = 1
    else if (fumbleRate <= 0.035) fumScore = 0
    else if (fumbleRate <= 0.05) fumScore = -1
    else fumScore = -2

    // Weight YPC more heavily
    const compositeScore = 0.60 * ypcScore + 0.25 * tdScore + 0.15 * fumScore
    const qualityGrade = clamp(60 + 12 * compositeScore, 0, 100)
    const q = gradeToQ(qualityGrade)

    return { qualityGrade, q, qualified: true }
  }

  // League means for smoothing
  const leagueBtPc = safeDivide(leagueStats.brokenTackles || 0, leagueStats.carries || 1)
  const leagueExplosive = safeDivide(leagueStats.runs20Plus || 0, leagueStats.carries || 1)
  const leagueTdRate = safeDivide(leagueStats.rushTd || 0, leagueStats.carries || 1)
  const leagueFumbleRate = safeDivide(leagueStats.fumbles || 0, leagueStats.touches || 1)

  // Smoothed rates
  const yacPc = safeDivide(stats.yardsAfterContact || 0, carries)
  const btPc = smoothRate(stats.brokenTackles || 0, carries, leagueBtPc, SMOOTHING_PRIORS.hbBrokenTackles)
  const explosiveRate = smoothRate(stats.runs20Plus || 0, carries, leagueExplosive, SMOOTHING_PRIORS.hbExplosive)
  const smoothedTdRate = smoothRate(stats.rushTd || 0, carries, leagueTdRate, SMOOTHING_PRIORS.hbTdRate)
  const smoothedFumbleRate = smoothRate(stats.fumbles || 0, touches, leagueFumbleRate, SMOOTHING_PRIORS.hbFumbleRate)

  // Calculate population stats
  const ypcVals = winsorize(qualifiedHBs.map(hb => safeDivide(hb.stats?.rushYards || 0, hb.stats?.carries || 1)))
  const yacPcVals = winsorize(qualifiedHBs.map(hb => safeDivide(hb.stats?.yardsAfterContact || 0, hb.stats?.carries || 1)))
  const btPcVals = qualifiedHBs.map(hb => smoothRate(hb.stats?.brokenTackles || 0, hb.stats?.carries || 1, leagueBtPc, SMOOTHING_PRIORS.hbBrokenTackles))
  const explosiveVals = qualifiedHBs.map(hb => smoothRate(hb.stats?.runs20Plus || 0, hb.stats?.carries || 1, leagueExplosive, SMOOTHING_PRIORS.hbExplosive))
  const tdRateVals = qualifiedHBs.map(hb => smoothRate(hb.stats?.rushTd || 0, hb.stats?.carries || 1, leagueTdRate, SMOOTHING_PRIORS.hbTdRate))
  const fumbleRateVals = qualifiedHBs.map(hb => {
    const t = (hb.stats?.carries || 0) + (hb.stats?.receptions || 0)
    return smoothRate(hb.stats?.fumbles || 0, t, leagueFumbleRate, SMOOTHING_PRIORS.hbFumbleRate)
  })

  // Z-scores
  const zYacPc = zScore(yacPc, mean(yacPcVals), stdDev(yacPcVals))
  const zBtPc = zScore(btPc, mean(btPcVals), stdDev(btPcVals))
  const zYpc = zScore(ypc, mean(ypcVals), stdDev(ypcVals))
  const zExplosive = zScore(explosiveRate, mean(explosiveVals), stdDev(explosiveVals))
  const zTdRate = zScore(smoothedTdRate, mean(tdRateVals), stdDev(tdRateVals))
  const zFumbleRate = zScore(smoothedFumbleRate, mean(fumbleRateVals), stdDev(fumbleRateVals))

  // Weighted score
  const scoreRaw = (
    0.25 * zYacPc +
    0.20 * zBtPc +
    0.15 * zYpc +
    0.10 * zExplosive +
    0.10 * zTdRate +
    -0.20 * zFumbleRate
  )

  // Standardize and grade
  const allScores = qualifiedHBs.map((hb, idx) => {
    return (
      0.25 * zScore(yacPcVals[idx], mean(yacPcVals), stdDev(yacPcVals)) +
      0.20 * zScore(btPcVals[idx], mean(btPcVals), stdDev(btPcVals)) +
      0.15 * zScore(ypcVals[idx], mean(ypcVals), stdDev(ypcVals)) +
      0.10 * zScore(explosiveVals[idx], mean(explosiveVals), stdDev(explosiveVals)) +
      0.10 * zScore(tdRateVals[idx], mean(tdRateVals), stdDev(tdRateVals)) +
      -0.20 * zScore(fumbleRateVals[idx], mean(fumbleRateVals), stdDev(fumbleRateVals))
    )
  })

  const scoreStd = zScore(scoreRaw, mean(allScores), stdDev(allScores))
  const gradeRaw = scoreToGrade(scoreStd)
  const qualityGrade = shrinkGrade(gradeRaw, touches, K_POS.HB)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true }
}

/**
 * Calculate WR QualityGrade
 */
export function calculateWRGrade(player, leagueStats, allWRs) {
  const stats = player.stats || {}
  const catchOpp = (stats.receptions || 0) + (stats.drops || 0)

  if (catchOpp < QUALIFICATION_THRESHOLDS.WR) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  const receptions = stats.receptions || 0
  if (receptions === 0) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Raw metrics
  const ypr = safeDivide(stats.recYards || 0, receptions)
  const racPerCatch = safeDivide(stats.runAfterCatch || 0, receptions)

  // League means
  const leagueTdRate = safeDivide(leagueStats.recTd || 0, leagueStats.catchOpp || 1)
  const leagueDropRate = safeDivide(leagueStats.drops || 0, leagueStats.catchOpp || 1)
  const leagueFumbleRate = safeDivide(leagueStats.fumbles || 0, leagueStats.catchOpp || 1)

  // Smoothed rates
  const tdRate = smoothRate(stats.recTd || 0, catchOpp, leagueTdRate, SMOOTHING_PRIORS.wrTdRate)
  const dropRate = smoothRate(stats.drops || 0, catchOpp, leagueDropRate, SMOOTHING_PRIORS.wrDropRate)
  const fumbleRate = smoothRate(stats.fumbles || 0, catchOpp, leagueFumbleRate, SMOOTHING_PRIORS.wrFumbleRate)

  // Get qualified WRs
  const qualifiedWRs = allWRs.filter(wr => {
    const wrCatchOpp = (wr.stats?.receptions || 0) + (wr.stats?.drops || 0)
    return wrCatchOpp >= QUALIFICATION_THRESHOLDS.WR && (wr.stats?.receptions || 0) > 0
  })

  if (qualifiedWRs.length === 0) {
    return { qualityGrade: 60, q: 0, qualified: true }
  }

  // Calculate population stats
  const yprVals = winsorize(qualifiedWRs.map(wr => safeDivide(wr.stats?.recYards || 0, wr.stats?.receptions || 1)))
  const racVals = winsorize(qualifiedWRs.map(wr => safeDivide(wr.stats?.runAfterCatch || 0, wr.stats?.receptions || 1)))
  const tdRateVals = qualifiedWRs.map(wr => {
    const co = (wr.stats?.receptions || 0) + (wr.stats?.drops || 0)
    return smoothRate(wr.stats?.recTd || 0, co, leagueTdRate, SMOOTHING_PRIORS.wrTdRate)
  })
  const dropRateVals = qualifiedWRs.map(wr => {
    const co = (wr.stats?.receptions || 0) + (wr.stats?.drops || 0)
    return smoothRate(wr.stats?.drops || 0, co, leagueDropRate, SMOOTHING_PRIORS.wrDropRate)
  })
  const fumbleRateVals = qualifiedWRs.map(wr => {
    const co = (wr.stats?.receptions || 0) + (wr.stats?.drops || 0)
    return smoothRate(wr.stats?.fumbles || 0, co, leagueFumbleRate, SMOOTHING_PRIORS.wrFumbleRate)
  })

  // Z-scores
  const zYpr = zScore(ypr, mean(yprVals), stdDev(yprVals))
  const zRac = zScore(racPerCatch, mean(racVals), stdDev(racVals))
  const zTdRate = zScore(tdRate, mean(tdRateVals), stdDev(tdRateVals))
  const zDropRate = zScore(dropRate, mean(dropRateVals), stdDev(dropRateVals))
  const zFumbleRate = zScore(fumbleRate, mean(fumbleRateVals), stdDev(fumbleRateVals))

  // Weighted score
  const scoreRaw = (
    0.30 * zYpr +
    0.20 * zRac +
    0.15 * zTdRate +
    -0.25 * zDropRate +
    -0.10 * zFumbleRate
  )

  // Standardize and grade
  const allScores = qualifiedWRs.map((wr, idx) => {
    return (
      0.30 * zScore(yprVals[idx], mean(yprVals), stdDev(yprVals)) +
      0.20 * zScore(racVals[idx], mean(racVals), stdDev(racVals)) +
      0.15 * zScore(tdRateVals[idx], mean(tdRateVals), stdDev(tdRateVals)) +
      -0.25 * zScore(dropRateVals[idx], mean(dropRateVals), stdDev(dropRateVals)) +
      -0.10 * zScore(fumbleRateVals[idx], mean(fumbleRateVals), stdDev(fumbleRateVals))
    )
  })

  const scoreStd = zScore(scoreRaw, mean(allScores), stdDev(allScores))
  const gradeRaw = scoreToGrade(scoreStd)
  const qualityGrade = shrinkGrade(gradeRaw, catchOpp, K_POS.WR)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true }
}

/**
 * Calculate TE QualityGrade (similar to WR but with different weights)
 */
export function calculateTEGrade(player, leagueStats, allTEs) {
  const stats = player.stats || {}
  const catchOpp = (stats.receptions || 0) + (stats.drops || 0)

  if (catchOpp < QUALIFICATION_THRESHOLDS.TE) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  const receptions = stats.receptions || 0
  if (receptions === 0) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Same metrics as WR
  const ypr = safeDivide(stats.recYards || 0, receptions)
  const racPerCatch = safeDivide(stats.runAfterCatch || 0, receptions)

  const leagueTdRate = safeDivide(leagueStats.recTd || 0, leagueStats.catchOpp || 1)
  const leagueDropRate = safeDivide(leagueStats.drops || 0, leagueStats.catchOpp || 1)
  const leagueFumbleRate = safeDivide(leagueStats.fumbles || 0, leagueStats.catchOpp || 1)

  const tdRate = smoothRate(stats.recTd || 0, catchOpp, leagueTdRate, SMOOTHING_PRIORS.wrTdRate)
  const dropRate = smoothRate(stats.drops || 0, catchOpp, leagueDropRate, SMOOTHING_PRIORS.wrDropRate)
  const fumbleRate = smoothRate(stats.fumbles || 0, catchOpp, leagueFumbleRate, SMOOTHING_PRIORS.wrFumbleRate)

  const qualifiedTEs = allTEs.filter(te => {
    const teCatchOpp = (te.stats?.receptions || 0) + (te.stats?.drops || 0)
    return teCatchOpp >= QUALIFICATION_THRESHOLDS.TE && (te.stats?.receptions || 0) > 0
  })

  if (qualifiedTEs.length === 0) {
    return { qualityGrade: 60, q: 0, qualified: true }
  }

  const yprVals = winsorize(qualifiedTEs.map(te => safeDivide(te.stats?.recYards || 0, te.stats?.receptions || 1)))
  const racVals = winsorize(qualifiedTEs.map(te => safeDivide(te.stats?.runAfterCatch || 0, te.stats?.receptions || 1)))
  const tdRateVals = qualifiedTEs.map(te => {
    const co = (te.stats?.receptions || 0) + (te.stats?.drops || 0)
    return smoothRate(te.stats?.recTd || 0, co, leagueTdRate, SMOOTHING_PRIORS.wrTdRate)
  })
  const dropRateVals = qualifiedTEs.map(te => {
    const co = (te.stats?.receptions || 0) + (te.stats?.drops || 0)
    return smoothRate(te.stats?.drops || 0, co, leagueDropRate, SMOOTHING_PRIORS.wrDropRate)
  })
  const fumbleRateVals = qualifiedTEs.map(te => {
    const co = (te.stats?.receptions || 0) + (te.stats?.drops || 0)
    return smoothRate(te.stats?.fumbles || 0, co, leagueFumbleRate, SMOOTHING_PRIORS.wrFumbleRate)
  })

  // Z-scores
  const zYpr = zScore(ypr, mean(yprVals), stdDev(yprVals))
  const zRac = zScore(racPerCatch, mean(racVals), stdDev(racVals))
  const zTdRate = zScore(tdRate, mean(tdRateVals), stdDev(tdRateVals))
  const zDropRate = zScore(dropRate, mean(dropRateVals), stdDev(dropRateVals))
  const zFumbleRate = zScore(fumbleRate, mean(fumbleRateVals), stdDev(fumbleRateVals))

  // TE weights (more TD emphasis)
  const scoreRaw = (
    0.25 * zYpr +
    0.15 * zRac +
    0.25 * zTdRate +
    -0.25 * zDropRate +
    -0.10 * zFumbleRate
  )

  const allScores = qualifiedTEs.map((te, idx) => {
    return (
      0.25 * zScore(yprVals[idx], mean(yprVals), stdDev(yprVals)) +
      0.15 * zScore(racVals[idx], mean(racVals), stdDev(racVals)) +
      0.25 * zScore(tdRateVals[idx], mean(tdRateVals), stdDev(tdRateVals)) +
      -0.25 * zScore(dropRateVals[idx], mean(dropRateVals), stdDev(dropRateVals)) +
      -0.10 * zScore(fumbleRateVals[idx], mean(fumbleRateVals), stdDev(fumbleRateVals))
    )
  })

  const scoreStd = zScore(scoreRaw, mean(allScores), stdDev(allScores))
  const gradeRaw = scoreToGrade(scoreStd)
  const qualityGrade = shrinkGrade(gradeRaw, catchOpp, K_POS.TE)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true }
}

/**
 * Calculate OL QualityGrade (Pass Protection only)
 */
export function calculateOLGrade(player, position, teamDropbacks, teamOLSnaps, allOLs) {
  const stats = player.stats || {}
  const totalPosSnaps = teamOLSnaps[position] || 0

  if (totalPosSnaps <= 0 || !stats.offSnaps) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  const pbOpp = teamDropbacks * (stats.offSnaps / totalPosSnaps)

  if (pbOpp < QUALIFICATION_THRESHOLDS[position]) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Calculate league mean sack rate
  const qualifiedOLs = allOLs.filter(ol => {
    const olPosSnaps = teamOLSnaps[ol.position] || 0
    if (olPosSnaps <= 0 || !ol.stats?.offSnaps) return false
    const olPbOpp = teamDropbacks * (ol.stats.offSnaps / olPosSnaps)
    return olPbOpp >= QUALIFICATION_THRESHOLDS[ol.position]
  })

  if (qualifiedOLs.length === 0) {
    return { qualityGrade: 60, q: 0, qualified: true }
  }

  const totalSacks = qualifiedOLs.reduce((sum, ol) => sum + (ol.stats?.sacksAllowed || 0), 0)
  const totalPbOpp = qualifiedOLs.reduce((sum, ol) => {
    const olPosSnaps = teamOLSnaps[ol.position] || 1
    return sum + teamDropbacks * ((ol.stats?.offSnaps || 0) / olPosSnaps)
  }, 0)
  const leagueSackRate = safeDivide(totalSacks, totalPbOpp)

  // Smoothed sack rate for player
  const sackAllowRate = smoothRate(
    stats.sacksAllowed || 0,
    pbOpp,
    leagueSackRate,
    SMOOTHING_PRIORS.olSackRate
  )

  // Calculate all sack rates
  const sackRateVals = qualifiedOLs.map(ol => {
    const olPosSnaps = teamOLSnaps[ol.position] || 1
    const olPbOpp = teamDropbacks * ((ol.stats?.offSnaps || 0) / olPosSnaps)
    return smoothRate(ol.stats?.sacksAllowed || 0, olPbOpp, leagueSackRate, SMOOTHING_PRIORS.olSackRate)
  })

  // Z-score (negative because lower is better)
  const zSackRate = -zScore(sackAllowRate, mean(sackRateVals), stdDev(sackRateVals))

  const scoreStd = zSackRate // Only one component
  const gradeRaw = scoreToGrade(scoreStd)
  const qualityGrade = shrinkGrade(gradeRaw, pbOpp, K_POS[position])
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true }
}

/**
 * Calculate Defense QualityGrade using absolute benchmarks when needed
 */
export function calculateDefenseGrade(player, position, leagueStats, allDefenders) {
  const stats = player.stats || {}

  // Derived stats (used regardless of snap data)
  const tackles = (stats.soloTackles || 0) + (stats.assistedTackles || 0)
  const tfl = stats.tacklesForLoss || 0
  const sacks = stats.sacks || 0
  const defInts = stats.defInterceptions || stats.interceptions || 0
  const pdef = stats.deflections || 0
  const ff = stats.forcedFumbles || 0
  const fr = stats.fumbleRecoveries || 0

  // Check if player has any meaningful defensive stats
  const totalDefPlays = tackles + sacks + tfl + defInts + pdef + ff + fr
  if (totalDefPlays < 5) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Estimate games from stats (rough approximation)
  const gamesPlayed = stats.gamesPlayed || Math.ceil(tackles / 5) || 1

  // Use absolute benchmarks based on total season stats
  // Adjusted to be more generous - typical CFB season totals

  // Tackles benchmarks (per season) - more generous thresholds
  let tackleScore = 0
  if (tackles >= 100) tackleScore = 2.5
  else if (tackles >= 80) tackleScore = 2
  else if (tackles >= 60) tackleScore = 1.5
  else if (tackles >= 45) tackleScore = 1
  else if (tackles >= 30) tackleScore = 0.5
  else if (tackles >= 20) tackleScore = 0
  else if (tackles >= 10) tackleScore = -0.25
  else tackleScore = -0.5

  // TFL benchmarks (per season) - more generous
  let tflScore = 0
  if (tfl >= 15) tflScore = 2.5
  else if (tfl >= 12) tflScore = 2
  else if (tfl >= 9) tflScore = 1.5
  else if (tfl >= 6) tflScore = 1
  else if (tfl >= 4) tflScore = 0.5
  else if (tfl >= 2) tflScore = 0
  else if (tfl >= 1) tflScore = -0.25
  else tflScore = -0.5

  // Sacks benchmarks (per season) - more generous
  let sackScore = 0
  if (sacks >= 12) sackScore = 2.5
  else if (sacks >= 9) sackScore = 2
  else if (sacks >= 6) sackScore = 1.5
  else if (sacks >= 4) sackScore = 1
  else if (sacks >= 2) sackScore = 0.5
  else if (sacks >= 1) sackScore = 0
  else if (sacks >= 0.5) sackScore = -0.25
  else sackScore = -0.5

  // Interceptions benchmarks (per season) - any INT is good
  let intScore = 0
  if (defInts >= 6) intScore = 2.5
  else if (defInts >= 5) intScore = 2
  else if (defInts >= 4) intScore = 1.5
  else if (defInts >= 3) intScore = 1
  else if (defInts >= 2) intScore = 0.75
  else if (defInts >= 1) intScore = 0.5
  else intScore = 0  // No penalty for 0 INTs

  // Pass deflections benchmarks (per season) - more generous
  let pdefScore = 0
  if (pdef >= 12) pdefScore = 2
  else if (pdef >= 9) pdefScore = 1.5
  else if (pdef >= 6) pdefScore = 1
  else if (pdef >= 4) pdefScore = 0.5
  else if (pdef >= 2) pdefScore = 0.25
  else if (pdef >= 1) pdefScore = 0
  else pdefScore = -0.25

  // Forced fumbles benchmarks - any FF is good
  let ffScore = 0
  if (ff >= 4) ffScore = 2
  else if (ff >= 3) ffScore = 1.5
  else if (ff >= 2) ffScore = 1
  else if (ff >= 1) ffScore = 0.5
  else ffScore = 0  // No penalty for 0 FF

  // Position-specific weighting
  let compositeScore = 0

  switch (position) {
    case 'LEDG':
    case 'REDG':
      // Edge rushers: sacks and TFL most important
      compositeScore = 0.40 * sackScore + 0.25 * tflScore + 0.15 * ffScore + 0.10 * tackleScore + 0.10 * pdefScore
      break
    case 'DT':
      // Interior DL: TFL and tackles, some sacks
      compositeScore = 0.30 * tflScore + 0.25 * sackScore + 0.25 * tackleScore + 0.10 * ffScore + 0.10 * pdefScore
      break
    case 'SAM':
    case 'WILL':
      // OLB: balanced between pass rush and coverage
      compositeScore = 0.25 * tackleScore + 0.20 * tflScore + 0.15 * sackScore + 0.15 * intScore + 0.15 * pdefScore + 0.10 * ffScore
      break
    case 'MIKE':
      // MLB: tackles most important
      compositeScore = 0.35 * tackleScore + 0.20 * tflScore + 0.10 * sackScore + 0.10 * intScore + 0.10 * pdefScore + 0.15 * ffScore
      break
    case 'CB':
      // Corners: coverage stats most important
      compositeScore = 0.30 * intScore + 0.30 * pdefScore + 0.15 * tackleScore + 0.15 * ffScore + 0.10 * tflScore
      break
    case 'FS':
      // Free safety: ball skills and range
      compositeScore = 0.30 * intScore + 0.25 * pdefScore + 0.20 * tackleScore + 0.15 * ffScore + 0.10 * tflScore
      break
    case 'SS':
      // Strong safety: tackling and ball skills
      compositeScore = 0.25 * tackleScore + 0.20 * intScore + 0.20 * pdefScore + 0.15 * tflScore + 0.10 * sackScore + 0.10 * ffScore
      break
    default:
      // Generic defense
      compositeScore = 0.25 * tackleScore + 0.20 * tflScore + 0.15 * sackScore + 0.15 * intScore + 0.15 * pdefScore + 0.10 * ffScore
  }

  const qualityGrade = clamp(60 + 12 * compositeScore, 0, 100)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true, components: { tackleScore, tflScore, sackScore, intScore, pdefScore, ffScore } }
}

/**
 * Calculate K QualityGrade
 */
export function calculateKickerGrade(player, leagueStats, allKickers) {
  const stats = player.stats || {}
  const kickOpp = (stats.fgAttempts || 0) + (stats.xpAttempts || 0)

  if (kickOpp < QUALIFICATION_THRESHOLDS.K) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // League bucket accuracies
  const mu029 = safeDivide(leagueStats.fgMade029 || 0, leagueStats.fgAtt029 || 1)
  const mu3039 = safeDivide(leagueStats.fgMade3039 || 0, leagueStats.fgAtt3039 || 1)
  const mu4049 = safeDivide(leagueStats.fgMade4049 || 0, leagueStats.fgAtt4049 || 1)
  const mu50p = safeDivide(leagueStats.fgMade50p || 0, leagueStats.fgAtt50p || 1)
  const muXp = safeDivide(leagueStats.xpMade || 0, leagueStats.xpAttempts || 1)

  // Expected makes
  const efg = mu029 * (stats.fgAtt029 || 0) + mu3039 * (stats.fgAtt3039 || 0) +
              mu4049 * (stats.fgAtt4049 || 0) + mu50p * (stats.fgAtt50p || 0)
  const fgAE = (stats.fgMade || 0) - efg
  const xpAE = (stats.xpMade || 0) - muXp * (stats.xpAttempts || 0)

  // Blocked rate
  const leagueBlockedRate = safeDivide(leagueStats.fgBlocked + leagueStats.xpBlocked || 0, leagueStats.kickOpp || 1)
  const blockedRate = smoothRate(
    (stats.fgBlocked || 0) + (stats.xpBlocked || 0),
    kickOpp,
    leagueBlockedRate,
    SMOOTHING_PRIORS.kBlockedRate
  )

  // Get qualified kickers
  const qualifiedK = allKickers.filter(k => {
    const kOpp = (k.stats?.fgAttempts || 0) + (k.stats?.xpAttempts || 0)
    return kOpp >= QUALIFICATION_THRESHOLDS.K
  })

  if (qualifiedK.length === 0) {
    return { qualityGrade: 60, q: 0, qualified: true }
  }

  // Calculate AE values for all kickers
  const fgAEVals = qualifiedK.map(k => {
    const kEfg = mu029 * (k.stats?.fgAtt029 || 0) + mu3039 * (k.stats?.fgAtt3039 || 0) +
                 mu4049 * (k.stats?.fgAtt4049 || 0) + mu50p * (k.stats?.fgAtt50p || 0)
    return (k.stats?.fgMade || 0) - kEfg
  })
  const xpAEVals = qualifiedK.map(k => (k.stats?.xpMade || 0) - muXp * (k.stats?.xpAttempts || 0))
  const blockedVals = qualifiedK.map(k => {
    const kOpp = (k.stats?.fgAttempts || 0) + (k.stats?.xpAttempts || 0)
    return smoothRate((k.stats?.fgBlocked || 0) + (k.stats?.xpBlocked || 0), kOpp, leagueBlockedRate, SMOOTHING_PRIORS.kBlockedRate)
  })

  // Z-scores
  const zFgAE = zScore(fgAE, mean(fgAEVals), stdDev(fgAEVals))
  const zXpAE = zScore(xpAE, mean(xpAEVals), stdDev(xpAEVals))
  const zBlocked = -zScore(blockedRate, mean(blockedVals), stdDev(blockedVals))

  // Weighted score
  const scoreRaw = 0.70 * zFgAE + 0.20 * zXpAE + 0.10 * zBlocked

  const gradeRaw = scoreToGrade(scoreRaw)
  const qualityGrade = shrinkGrade(gradeRaw, kickOpp, K_POS.K)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true }
}

/**
 * Calculate P QualityGrade
 */
export function calculatePunterGrade(player, leagueStats, allPunters) {
  const stats = player.stats || {}
  const punts = stats.punts || 0

  if (punts < QUALIFICATION_THRESHOLDS.P) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Raw metrics
  const netAvg = safeDivide(stats.netPuntYds || 0, punts)

  // League means
  const leagueI20Rate = safeDivide(leagueStats.puntsI20 || 0, leagueStats.punts || 1)
  const leagueTbRate = safeDivide(leagueStats.puntTouchbacks || 0, leagueStats.punts || 1)
  const leagueBlockedRate = safeDivide(leagueStats.puntsBlocked || 0, leagueStats.punts || 1)

  // Smoothed rates
  const i20Rate = smoothRate(stats.puntsI20 || 0, punts, leagueI20Rate, SMOOTHING_PRIORS.pI20Rate)
  const tbRate = smoothRate(stats.puntTouchbacks || 0, punts, leagueTbRate, SMOOTHING_PRIORS.pTbRate)
  const blockedRate = smoothRate(stats.puntsBlocked || 0, punts, leagueBlockedRate, SMOOTHING_PRIORS.pBlockedRate)

  // Get qualified punters
  const qualifiedP = allPunters.filter(p => (p.stats?.punts || 0) >= QUALIFICATION_THRESHOLDS.P)

  if (qualifiedP.length === 0) {
    return { qualityGrade: 60, q: 0, qualified: true }
  }

  // Calculate population values
  const netAvgVals = winsorize(qualifiedP.map(p => safeDivide(p.stats?.netPuntYds || 0, p.stats?.punts || 1)))
  const i20Vals = qualifiedP.map(p => smoothRate(p.stats?.puntsI20 || 0, p.stats?.punts || 1, leagueI20Rate, SMOOTHING_PRIORS.pI20Rate))
  const tbVals = qualifiedP.map(p => smoothRate(p.stats?.puntTouchbacks || 0, p.stats?.punts || 1, leagueTbRate, SMOOTHING_PRIORS.pTbRate))
  const blockedVals = qualifiedP.map(p => smoothRate(p.stats?.puntsBlocked || 0, p.stats?.punts || 1, leagueBlockedRate, SMOOTHING_PRIORS.pBlockedRate))

  // Z-scores
  const zNetAvg = zScore(netAvg, mean(netAvgVals), stdDev(netAvgVals))
  const zI20 = zScore(i20Rate, mean(i20Vals), stdDev(i20Vals))
  const zTb = -zScore(tbRate, mean(tbVals), stdDev(tbVals)) // Bad
  const zBlocked = -zScore(blockedRate, mean(blockedVals), stdDev(blockedVals)) // Bad

  // Weighted score
  const scoreRaw = 0.55 * zNetAvg + 0.25 * zI20 + 0.10 * zTb + 0.10 * zBlocked

  const gradeRaw = scoreToGrade(scoreRaw)
  const qualityGrade = shrinkGrade(gradeRaw, punts, K_POS.P)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true }
}

/**
 * Calculate Return QualityGrade
 */
export function calculateReturnGrade(player, leagueStats, allReturners) {
  const stats = player.stats || {}
  const kr = stats.kickReturns || 0
  const pr = stats.puntReturns || 0
  const returnOpp = kr + pr

  if (returnOpp < QUALIFICATION_THRESHOLDS.RET) {
    return { qualityGrade: 60, q: 0, qualified: false }
  }

  // Raw metrics
  const krAvg = safeDivide(stats.krYards || 0, kr)
  const prAvg = safeDivide(stats.prYards || 0, pr)

  // League means
  const leagueKrTdRate = safeDivide(leagueStats.krTd || 0, leagueStats.kickReturns || 1)
  const leaguePrTdRate = safeDivide(leagueStats.prTd || 0, leagueStats.puntReturns || 1)

  // Smoothed rates
  const krTdRate = kr > 0 ? smoothRate(stats.krTd || 0, kr, leagueKrTdRate, SMOOTHING_PRIORS.retTdRate) : 0
  const prTdRate = pr > 0 ? smoothRate(stats.prTd || 0, pr, leaguePrTdRate, SMOOTHING_PRIORS.retTdRate) : 0

  // Get qualified returners
  const qualifiedRet = allReturners.filter(r => {
    const rOpp = (r.stats?.kickReturns || 0) + (r.stats?.puntReturns || 0)
    return rOpp >= QUALIFICATION_THRESHOLDS.RET
  })

  if (qualifiedRet.length === 0) {
    return { qualityGrade: 60, q: 0, qualified: true }
  }

  // Calculate population values
  const krAvgVals = winsorize(qualifiedRet.filter(r => (r.stats?.kickReturns || 0) > 0).map(r => safeDivide(r.stats?.krYards || 0, r.stats?.kickReturns || 1)))
  const prAvgVals = winsorize(qualifiedRet.filter(r => (r.stats?.puntReturns || 0) > 0).map(r => safeDivide(r.stats?.prYards || 0, r.stats?.puntReturns || 1)))
  const krTdVals = qualifiedRet.filter(r => (r.stats?.kickReturns || 0) > 0).map(r => smoothRate(r.stats?.krTd || 0, r.stats?.kickReturns || 1, leagueKrTdRate, SMOOTHING_PRIORS.retTdRate))
  const prTdVals = qualifiedRet.filter(r => (r.stats?.puntReturns || 0) > 0).map(r => smoothRate(r.stats?.prTd || 0, r.stats?.puntReturns || 1, leaguePrTdRate, SMOOTHING_PRIORS.retTdRate))

  // Z-scores (only for return types the player has)
  let scoreRaw = 0
  let totalWeight = 0

  if (kr > 0 && krAvgVals.length > 0) {
    const zKrAvg = zScore(krAvg, mean(krAvgVals), stdDev(krAvgVals))
    const zKrTd = krTdVals.length > 0 ? zScore(krTdRate, mean(krTdVals), stdDev(krTdVals)) : 0
    scoreRaw += 0.40 * zKrAvg + 0.20 * zKrTd
    totalWeight += 0.60
  }

  if (pr > 0 && prAvgVals.length > 0) {
    const zPrAvg = zScore(prAvg, mean(prAvgVals), stdDev(prAvgVals))
    const zPrTd = prTdVals.length > 0 ? zScore(prTdRate, mean(prTdVals), stdDev(prTdVals)) : 0
    scoreRaw += 0.30 * zPrAvg + 0.10 * zPrTd
    totalWeight += 0.40
  }

  // Normalize if not using full weight
  if (totalWeight > 0 && totalWeight < 1) {
    scoreRaw = scoreRaw / totalWeight
  }

  const gradeRaw = scoreToGrade(scoreRaw)
  const qualityGrade = shrinkGrade(gradeRaw, returnOpp, K_POS.RET)
  const q = gradeToQ(qualityGrade)

  return { qualityGrade, q, qualified: true }
}

// ========================================================
// E) TEAM ADJUSTED WINS
// ========================================================

/**
 * Calculate adjusted win value for a single game
 * @param {number} pointsFor - Team's points
 * @param {number} pointsAgainst - Opponent's points
 * @returns {number} - 0, 0.5, or 1
 */
export function calculateAdjustedWin(pointsFor, pointsAgainst) {
  const margin = pointsFor - pointsAgainst
  if (margin >= 9) return 1.0
  if (margin <= -9) return 0.0
  return 0.5
}

/**
 * Calculate team's adjusted wins for a season
 */
export function calculateTeamAdjustedWins(games) {
  return games.reduce((sum, game) => {
    return sum + calculateAdjustedWin(game.teamScore || 0, game.opponentScore || 0)
  }, 0)
}

// ========================================================
// F) UNIT GROUPS
// ========================================================

export const UNIT_GROUPS = {
  QB: ['QB'],
  SKILL: ['HB', 'FB', 'WR', 'TE'],
  OL: ['LT', 'LG', 'C', 'RG', 'RT'],
  DL: ['LEDG', 'REDG', 'DT'],
  LB: ['SAM', 'MIKE', 'WILL'],
  DB: ['CB', 'FS', 'SS'],
  K: ['K'],
  P: ['P'],
  RET: [] // Special: any player with returns > 0
}

/**
 * Get unit group for a position
 */
export function getUnitGroup(position) {
  for (const [group, positions] of Object.entries(UNIT_GROUPS)) {
    if (positions.includes(position)) return group
  }
  return null
}

// ========================================================
// G) DEFAULT BETAS (Fallback if insufficient data)
// These represent wins generated per unit of "normalized volume" at average+ quality
// ========================================================

export const DEFAULT_BETAS = {
  QB: 1.8,      // QBs have highest impact - elite QB worth ~3-4 wins
  SKILL: 1.0,   // Skill players (HB, WR, TE) - elite back/receiver worth ~1.5-2 wins
  OL: 0.6,      // OL collectively important but individual less so
  DL: 0.7,      // Pass rushers - elite edge worth ~1.5 wins
  LB: 0.6,      // Linebackers - high tackle volume
  DB: 0.7,      // Coverage players - ball hawks valuable
  K: 0.2,       // Kickers can swing close games
  P: 0.15,      // Field position
  RET: 0.25     // Return game
}

// ========================================================
// EXPECTED STARTER VOLUME (for normalizing share to ~1.0)
// These represent typical full-season starter volume
// ========================================================

export const EXPECTED_VOLUME = {
  QB_DROPBACKS: 450,      // ~32 dropbacks/game × 14 games
  HB_TOUCHES: 180,        // ~13 touches/game × 14 games (primary back)
  WR_TARGETS: 90,         // ~6.5 targets/game × 14 games (WR1)
  TE_TARGETS: 50,         // ~3.5 targets/game × 14 games
  OL_PASS_BLOCKS: 400,    // ~28/game × 14 games
  DEF_SNAPS: 550,         // ~40 snaps/game × 14 games (lower for higher shares)
  KICK_OPP: 50,           // ~3.5/game × 14 games (FG + XP attempts)
  PUNTS: 45,              // ~3/game × 14 games
  RETURNS: 25             // ~1.8/game × 14 games (KR + PR)
}

// ========================================================
// H) REPLACEMENT BASELINES
// ========================================================

export const DEFAULT_Q_REP = -0.75  // Replacement level - gives more players positive WAR

/**
 * Calculate replacement baseline q for a unit group
 * @param {Array} players - All players in the group
 * @param {string} group - Unit group name
 * @returns {number} - Replacement-level q (clamped to [-1.5, -0.3])
 */
export function calculateReplacementQ(players, group) {
  if (!players || players.length === 0) return DEFAULT_Q_REP

  // Get weighted q values
  const items = players
    .filter(p => p.qualified && p.share > 0)
    .map(p => ({ value: p.q, weight: p.share }))

  if (items.length === 0) return DEFAULT_Q_REP

  // 20th percentile
  const qRep = weightedPercentile(items, 0.20)

  // Clamp to reasonable range
  return clamp(qRep, -1.0, -0.25)
}

// ========================================================
// I) FINAL pWAR CALCULATION
// ========================================================

/**
 * Calculate pWAR for a single player
 * @param {Object} player - Player with grades and shares
 * @param {Object} betas - Unit group betas
 * @param {Object} qReps - Replacement q by group
 * @returns {number} - pWAR value
 */
export function calculatePlayerPWAR(player, betas, qReps) {
  let pwar = 0

  // Main position contribution
  const mainGroup = getUnitGroup(player.position)
  if (mainGroup && player.share > 0) {
    const beta = betas[mainGroup] || DEFAULT_BETAS[mainGroup] || 1.0
    const qRep = qReps[mainGroup] ?? DEFAULT_Q_REP
    pwar += beta * player.share * (player.q - qRep)
  }

  // Return contribution (separate facet)
  if (player.returnShare > 0 && player.qReturn !== undefined) {
    const beta = betas.RET || DEFAULT_BETAS.RET
    const qRep = qReps.RET ?? DEFAULT_Q_REP
    pwar += beta * player.returnShare * (player.qReturn - qRep)
  }

  return pwar
}

// ========================================================
// MAIN CALCULATION FUNCTION
// ========================================================

/**
 * Build a unified stats object for a player from the dynasty's data structures
 * @param {Object} dynasty - Dynasty object
 * @param {number} year - Year to get stats for
 * @param {number} pid - Player ID
 * @param {string} playerPosition - Player's position from roster
 * @returns {Object} - Unified stats object
 */
function buildPlayerStats(dynasty, year, pid, playerPosition) {
  // Find the player
  const player = dynasty.players?.find(p => p.pid === pid || String(p.pid) === String(pid))
  if (!player) return null

  // Get stats from player.statsByYear (check both number and string keys)
  const yearStats = player.statsByYear?.[year] || player.statsByYear?.[String(year)] || {}

  // Extract category stats (internal format)
  const passing = yearStats.passing || {}
  const rushing = yearStats.rushing || {}
  const receiving = yearStats.receiving || {}
  const blocking = yearStats.blocking || {}
  const defensive = yearStats.defense || {}
  const kicking = yearStats.kicking || {}
  const punting = yearStats.punting || {}
  const kickReturn = yearStats.kickReturn || {}
  const puntReturn = yearStats.puntReturn || {}

  // Build unified stats object - snaps are always recorded in the game
  const snapsPlayed = yearStats.snapsPlayed || 0

  // Determine if this player is offense or defense based on their position
  const position = playerPosition || player.position || ''
  const offensivePositions = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT']
  const defensivePositions = ['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS']
  const isOffense = offensivePositions.includes(position)
  const isDefense = defensivePositions.includes(position)

  const stats = {
    // Basic stats
    gamesPlayed: yearStats.gamesPlayed || 0,
    offSnaps: isOffense ? snapsPlayed : 0, // Only count offense snaps for offensive players
    defSnaps: isDefense ? snapsPlayed : 0, // Only count defense snaps for defensive players

    // Passing stats (internal format: cmp, att, yds, td, int, sacks)
    completions: passing.cmp || 0,
    attempts: passing.att || 0,
    passingYards: passing.yds || 0,
    passingTd: passing.td || 0,
    interceptions: passing.int || 0,
    sacksTaken: passing.sacks || 0,
    // Compute ANY/A: (pass yards + 20*pass TD - 45*INT - sack yards) / (attempts + sacks)
    anyA: (() => {
      const att = passing.att || 0
      const sacks = passing.sacks || 0
      if (att + sacks === 0) return 0
      const yds = passing.yds || 0
      const td = passing.td || 0
      const ints = passing.int || 0
      return (yds + 20 * td - 45 * ints) / (att + sacks)
    })(),

    // Rushing stats (internal format: car, yds, td, fum)
    carries: rushing.car || 0,
    rushYards: rushing.yds || 0,
    rushTd: rushing.td || 0,
    brokenTackles: 0, // Not tracked in internal format
    fumbles: rushing.fum || 0,
    runs20Plus: 0, // Not tracked in current stats
    yardsAfterContact: 0, // Not tracked in current stats

    // Receiving stats (internal format: rec, yds, td, drops)
    receptions: receiving.rec || 0,
    recYards: receiving.yds || 0,
    recTd: receiving.td || 0,
    drops: receiving.drops || 0,
    runAfterCatch: 0, // Not tracked

    // Blocking stats (internal format: sacksAllowed)
    sacksAllowed: blocking.sacksAllowed || 0,

    // Defensive stats (internal format: soloTkl, astTkl, tfl, sacks, int, pd, ff, fr, td, sfty)
    soloTackles: defensive.soloTkl || 0,
    assistedTackles: defensive.astTkl || 0,
    tacklesForLoss: defensive.tfl || 0,
    sacks: defensive.sacks || 0,
    deflections: defensive.pd || 0,
    forcedFumbles: defensive.ff || 0,
    fumbleRecoveries: defensive.fr || 0,
    defInterceptions: defensive.int || 0,
    catchesAllowed: 0, // Not tracked
    blocks: 0, // Not tracked
    safeties: defensive.sfty || 0,

    // Kicking stats (internal format: fgm, fga, xpm, xpa, lng)
    fgMade: kicking.fgm || 0,
    fgAttempts: kicking.fga || 0,
    xpMade: kicking.xpm || 0,
    xpAttempts: kicking.xpa || 0,
    fgBlocked: 0, // Not tracked
    xpBlocked: 0, // Not tracked
    // Distance buckets not tracked, so estimate based on total
    fgMade029: 0,
    fgAtt029: 0,
    fgMade3039: 0,
    fgAtt3039: 0,
    fgMade4049: 0,
    fgAtt4049: 0,
    fgMade50p: 0,
    fgAtt50p: 0,

    // Punting stats (internal format: punts, yds, lng, in20, tb)
    punts: punting.punts || 0,
    puntYards: punting.yds || 0,
    netPuntYds: punting.yds || 0, // Approximate with gross
    puntsI20: punting.in20 || 0,
    puntTouchbacks: punting.tb || 0,
    puntsBlocked: 0, // Not tracked

    // Return stats (internal format: ret, yds, td, lng)
    kickReturns: kickReturn.ret || 0,
    krYards: kickReturn.yds || 0,
    krTd: kickReturn.td || 0,
    puntReturns: puntReturn.ret || 0,
    prYards: puntReturn.yds || 0,
    prTd: puntReturn.td || 0
  }

  return stats
}

/**
 * Check if player has any meaningful stats for the year
 */
function playerHasStats(dynasty, year, pid) {
  // Find the player
  const player = dynasty.players?.find(p => p.pid === pid || String(p.pid) === String(pid))
  if (!player) return false

  // Check player.statsByYear (check both number and string keys)
  const yearStats = player.statsByYear?.[year] || player.statsByYear?.[String(year)]
  if (!yearStats) return false

  // Check if there's any actual data
  const hasBasicStats = yearStats.gamesPlayed > 0 || yearStats.snapsPlayed > 0
  const hasCategories = ['passing', 'rushing', 'receiving', 'blocking', 'defense', 'kicking', 'punting', 'kickReturn', 'puntReturn']
    .some(cat => yearStats[cat] && Object.keys(yearStats[cat]).length > 0)

  return hasBasicStats || hasCategories
}

/**
 * Calculate pWAR for all players in a dynasty season
 * @param {Object} dynasty - Dynasty object with players and games
 * @param {number} year - Year to calculate for
 * @returns {Array} - Players with pWAR data
 */
export function calculateSeasonPWAR(dynasty, year) {
  if (!dynasty?.players) return []

  // Get players for this year (with stats)
  const players = dynasty.players.filter(p => {
    return playerHasStats(dynasty, year, p.pid) && !p.isHonorOnly
  }).map(p => ({
    pid: p.pid,
    name: p.name,
    position: p.position,
    team: dynasty.teamName,
    stats: buildPlayerStats(dynasty, year, p.pid, p.position)
  }))

  if (players.length === 0) return []

  // Calculate team-level stats
  const teamDropbacks = players
    .filter(p => p.position === 'QB')
    .reduce((sum, p) => sum + (p.stats.attempts || 0) + (p.stats.sacksTaken || 0), 0)

  // Calculate OL snap totals by position
  const teamOLSnaps = {}
  const olPositions = ['LT', 'LG', 'C', 'RG', 'RT']
  olPositions.forEach(pos => {
    teamOLSnaps[pos] = players
      .filter(p => p.position === pos)
      .reduce((sum, p) => sum + (p.stats.offSnaps || 0), 0)
  })

  // Calculate total snaps for share calculation
  const totalOffSnaps = players.reduce((sum, p) => sum + (p.stats.offSnaps || 0), 0)
  const totalDefSnaps = players.reduce((sum, p) => sum + (p.stats.defSnaps || 0), 0)
  const totalKickOpp = players.reduce((sum, p) => sum + (p.stats.fgAttempts || 0) + (p.stats.xpAttempts || 0), 0)
  const totalPunts = players.reduce((sum, p) => sum + (p.stats.punts || 0), 0)
  const totalReturns = players.reduce((sum, p) => sum + (p.stats.kickReturns || 0) + (p.stats.puntReturns || 0), 0)

  // Aggregate league stats (from this team only - in a full implementation, this would be across all teams)
  const leagueStats = {
    // QB
    attempts: players.filter(p => p.position === 'QB').reduce((s, p) => s + (p.stats.attempts || 0), 0),
    passingTd: players.filter(p => p.position === 'QB').reduce((s, p) => s + (p.stats.passingTd || 0), 0),
    interceptions: players.filter(p => p.position === 'QB').reduce((s, p) => s + (p.stats.interceptions || 0), 0),
    dropbacks: teamDropbacks,
    // HB
    carries: players.reduce((s, p) => s + (p.stats.carries || 0), 0),
    rushYards: players.reduce((s, p) => s + (p.stats.rushYards || 0), 0),
    rushTd: players.reduce((s, p) => s + (p.stats.rushTd || 0), 0),
    brokenTackles: players.reduce((s, p) => s + (p.stats.brokenTackles || 0), 0),
    runs20Plus: players.reduce((s, p) => s + (p.stats.runs20Plus || 0), 0),
    touches: players.reduce((s, p) => s + (p.stats.carries || 0) + (p.stats.receptions || 0), 0),
    fumbles: players.reduce((s, p) => s + (p.stats.fumbles || 0), 0),
    // Receiving
    receptions: players.reduce((s, p) => s + (p.stats.receptions || 0), 0),
    recYards: players.reduce((s, p) => s + (p.stats.recYards || 0), 0),
    recTd: players.reduce((s, p) => s + (p.stats.recTd || 0), 0),
    drops: players.reduce((s, p) => s + (p.stats.drops || 0), 0),
    catchOpp: players.reduce((s, p) => s + (p.stats.receptions || 0) + (p.stats.drops || 0), 0),
    // Kicking
    fgMade029: players.reduce((s, p) => s + (p.stats.fgMade029 || 0), 0),
    fgAtt029: players.reduce((s, p) => s + (p.stats.fgAtt029 || 0), 0),
    fgMade3039: players.reduce((s, p) => s + (p.stats.fgMade3039 || 0), 0),
    fgAtt3039: players.reduce((s, p) => s + (p.stats.fgAtt3039 || 0), 0),
    fgMade4049: players.reduce((s, p) => s + (p.stats.fgMade4049 || 0), 0),
    fgAtt4049: players.reduce((s, p) => s + (p.stats.fgAtt4049 || 0), 0),
    fgMade50p: players.reduce((s, p) => s + (p.stats.fgMade50p || 0), 0),
    fgAtt50p: players.reduce((s, p) => s + (p.stats.fgAtt50p || 0), 0),
    xpMade: players.reduce((s, p) => s + (p.stats.xpMade || 0), 0),
    xpAttempts: players.reduce((s, p) => s + (p.stats.xpAttempts || 0), 0),
    fgBlocked: players.reduce((s, p) => s + (p.stats.fgBlocked || 0), 0),
    xpBlocked: players.reduce((s, p) => s + (p.stats.xpBlocked || 0), 0),
    kickOpp: totalKickOpp,
    // Punting
    punts: totalPunts,
    netPuntYds: players.reduce((s, p) => s + (p.stats.netPuntYds || 0), 0),
    puntsI20: players.reduce((s, p) => s + (p.stats.puntsI20 || 0), 0),
    puntTouchbacks: players.reduce((s, p) => s + (p.stats.puntTouchbacks || 0), 0),
    puntsBlocked: players.reduce((s, p) => s + (p.stats.puntsBlocked || 0), 0),
    // Returns
    kickReturns: players.reduce((s, p) => s + (p.stats.kickReturns || 0), 0),
    krYards: players.reduce((s, p) => s + (p.stats.krYards || 0), 0),
    krTd: players.reduce((s, p) => s + (p.stats.krTd || 0), 0),
    puntReturns: players.reduce((s, p) => s + (p.stats.puntReturns || 0), 0),
    prYards: players.reduce((s, p) => s + (p.stats.prYards || 0), 0),
    prTd: players.reduce((s, p) => s + (p.stats.prTd || 0), 0)
  }

  // Group players by position
  const playersByPosition = {}
  players.forEach(p => {
    if (!playersByPosition[p.position]) playersByPosition[p.position] = []
    playersByPosition[p.position].push(p)
  })

  // Calculate grades for each player
  const playersWithGrades = players.map(player => {
    let gradeResult = { qualityGrade: 60, q: 0, qualified: false }

    switch (player.position) {
      case 'QB':
        gradeResult = calculateQBGrade(player, leagueStats, playersByPosition['QB'] || [])
        break
      case 'HB':
      case 'FB':
        gradeResult = calculateHBGrade(player, leagueStats, [...(playersByPosition['HB'] || []), ...(playersByPosition['FB'] || [])])
        break
      case 'WR':
        gradeResult = calculateWRGrade(player, leagueStats, playersByPosition['WR'] || [])
        break
      case 'TE':
        gradeResult = calculateTEGrade(player, leagueStats, playersByPosition['TE'] || [])
        break
      case 'LT':
      case 'LG':
      case 'C':
      case 'RG':
      case 'RT':
        gradeResult = calculateOLGrade(player, player.position, teamDropbacks, teamOLSnaps,
          [...(playersByPosition['LT'] || []), ...(playersByPosition['LG'] || []),
           ...(playersByPosition['C'] || []), ...(playersByPosition['RG'] || []),
           ...(playersByPosition['RT'] || [])])
        break
      case 'LEDG':
      case 'REDG':
      case 'DT':
      case 'SAM':
      case 'MIKE':
      case 'WILL':
      case 'CB':
      case 'FS':
      case 'SS':
        gradeResult = calculateDefenseGrade(player, player.position, leagueStats, players.filter(p =>
          ['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'].includes(p.position)))
        break
      case 'K':
        gradeResult = calculateKickerGrade(player, leagueStats, playersByPosition['K'] || [])
        break
      case 'P':
        gradeResult = calculatePunterGrade(player, leagueStats, playersByPosition['P'] || [])
        break
    }

    // Calculate return grade if applicable
    const returnOpp = (player.stats.kickReturns || 0) + (player.stats.puntReturns || 0)
    let returnGradeResult = { qualityGrade: 60, q: 0, qualified: false }
    if (returnOpp >= QUALIFICATION_THRESHOLDS.RET) {
      returnGradeResult = calculateReturnGrade(player, leagueStats, players.filter(p =>
        (p.stats.kickReturns || 0) + (p.stats.puntReturns || 0) > 0))
    }

    // Calculate volume-based share (normalized to expected starter volume)
    // A full-time starter should have share ≈ 1.0
    const unitGroup = getUnitGroup(player.position)
    let share = 0

    if (player.position === 'QB') {
      // QB share based on dropbacks normalized to expected volume
      const dropbacks = (player.stats.attempts || 0) + (player.stats.sacksTaken || 0)
      share = dropbacks / EXPECTED_VOLUME.QB_DROPBACKS
    } else if (player.position === 'HB' || player.position === 'FB') {
      // RB share based on touches
      const touches = (player.stats.carries || 0) + (player.stats.receptions || 0)
      share = touches / EXPECTED_VOLUME.HB_TOUCHES
    } else if (player.position === 'WR') {
      // WR share based on targets (receptions + drops)
      const targets = (player.stats.receptions || 0) + (player.stats.drops || 0)
      share = targets / EXPECTED_VOLUME.WR_TARGETS
    } else if (player.position === 'TE') {
      // TE share based on targets
      const targets = (player.stats.receptions || 0) + (player.stats.drops || 0)
      share = targets / EXPECTED_VOLUME.TE_TARGETS
    } else if (unitGroup === 'OL') {
      // OL share based on pass blocking opportunities
      const pbOpp = teamDropbacks > 0 && teamOLSnaps[player.position] > 0
        ? teamDropbacks * ((player.stats.offSnaps || 0) / teamOLSnaps[player.position])
        : 0
      share = pbOpp / EXPECTED_VOLUME.OL_PASS_BLOCKS
    } else if (['DL', 'LB', 'DB'].includes(unitGroup)) {
      // Defense share based on defensive snaps
      // If defSnaps is 0/missing, estimate from games played or defensive stats
      let defVolume = player.stats.defSnaps || 0

      if (defVolume === 0) {
        // Fallback 1: Use games played × estimated snaps per game
        const gamesPlayed = player.stats.gamesPlayed || 0
        if (gamesPlayed > 0) {
          defVolume = gamesPlayed * 50 // Estimate ~50 defensive snaps per game for starters
        }
      }

      if (defVolume === 0) {
        // Fallback 2: Use total defensive involvement as volume proxy
        // Scale tackles/plays to approximate snap count
        const totalTackles = (player.stats.soloTackles || 0) + (player.stats.assistedTackles || 0)
        const sacks = player.stats.sacks || 0
        const tfl = player.stats.tacklesForLoss || 0
        const ints = player.stats.defInterceptions || 0
        const pdef = player.stats.deflections || 0
        const ff = player.stats.forcedFumbles || 0

        // Rough estimation: scale defensive plays to approximate snap involvement
        // Weight impactful plays more heavily
        const defPlays = totalTackles + sacks * 3 + tfl * 1.5 + ints * 4 + pdef * 1.5 + ff * 3
        if (defPlays > 0) {
          defVolume = defPlays * 12 // Higher scale factor for better differentiation
        }
      }

      share = defVolume / EXPECTED_VOLUME.DEF_SNAPS
    } else if (unitGroup === 'K') {
      // Kicker share based on kick opportunities
      const kickOpp = (player.stats.fgAttempts || 0) + (player.stats.xpAttempts || 0)
      share = kickOpp / EXPECTED_VOLUME.KICK_OPP
    } else if (unitGroup === 'P') {
      // Punter share based on punts
      share = (player.stats.punts || 0) / EXPECTED_VOLUME.PUNTS
    }

    // Cap share at 2.0 (200% of expected starter volume) to allow high-volume players
    share = Math.min(share, 2.0)

    // Return share also normalized to expected volume, capped
    const returnShare = Math.min(returnOpp / EXPECTED_VOLUME.RETURNS, 1.5)

    return {
      ...player,
      qualityGrade: gradeResult.qualityGrade,
      q: gradeResult.q,
      qualified: gradeResult.qualified,
      returnQualityGrade: returnGradeResult.qualityGrade,
      qReturn: returnGradeResult.q,
      returnQualified: returnGradeResult.qualified,
      share,
      returnShare,
      unitGroup
    }
  })

  // Calculate replacement baselines per group
  const qReps = {}
  Object.keys(UNIT_GROUPS).forEach(group => {
    const groupPlayers = playersWithGrades.filter(p => p.unitGroup === group || (group === 'RET' && p.returnShare > 0))
    qReps[group] = calculateReplacementQ(
      group === 'RET'
        ? groupPlayers.map(p => ({ qualified: p.returnQualified, share: p.returnShare, q: p.qReturn }))
        : groupPlayers,
      group
    )
  })

  // Calculate pWAR for each player
  const playersWithPWAR = playersWithGrades.map(player => {
    const pwar = calculatePlayerPWAR(player, DEFAULT_BETAS, qReps)
    return {
      ...player,
      pwar: Math.round(pwar * 100) / 100 // Round to 2 decimal places
    }
  })

  // Sort by pWAR descending
  return playersWithPWAR.sort((a, b) => b.pwar - a.pwar)
}
