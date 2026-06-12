/**
 * Approximate Value (AV) — a single per-season production score that
 * spans every position. Modeled on Pro Football Reference's AV
 * (Doug Drinen 2008) but adapted to box-score-only data and the stat
 * fields actually saved in this app's player.statsByYear.
 *
 * KEY DESIGN POINTS:
 *
 * - Pure production. Talent ratings (player.overall) are NOT inputs.
 *   This stat measures what the player did, not how good the game's
 *   attribute system says they could be.
 *
 * - Per-season counting stat. Sum across seasons for career AV. Top
 *   single-season values land in roughly the 15-22 range across all
 *   positions (matching NFL AV's intuitive feel: 15 = great, 22 = HoF
 *   season). Top career values for a 4-year college star land roughly
 *   60-90.
 *
 * - Position-specific. Each position has its own formula keyed on the
 *   stats most associated with their job. QBs are dominated by passing
 *   yards + TD-INT. RBs by rushing volume + scoring. OL by the
 *   pancakes/sacks-allowed counts the box score actually tracks.
 *
 * - Returns are added on top of any position. A WR who also returns
 *   punts gets credit for both. Keeps return-specialist seasons
 *   visible without splitting the player into two records.
 *
 * - Rough calibration was tuned by hand to match NFL AV intuition
 *   (top season ≈ 18-22, replacement starter ≈ 4-6, end-of-bench ≈ 0-2).
 *   Iterate the per-stat weights if specific positions feel under-
 *   or over-weighted in real dynasty data.
 *
 * - 2026-04-29 rebalance: WR/TE was running ~2.5× per-year over QB
 *   and defenders (yards × per-reception × RAC compounded the
 *   credit on the same play). Trimmed receiving yds 0.009→0.006,
 *   td 0.5→0.4, rec 0.05→0.02, RAC 0.0015→0.0006. Bumped QB
 *   yds 0.0035→0.0042, td 0.4→0.45, softened INT −0.5→−0.4.
 *   RB receiving trimmed to match the new WR baseline.
 *
 * - 2026-05-28 defense rebalance: across four seasons of real data,
 *   defenders (LBs especially) topped every season at ~28-30 — well
 *   above the 15-22 target and ~2-4× the top offensive AV. The drivers
 *   were TFL (0.4 → 12 AV for a 30-TFL season), tackle volume, and a
 *   sack/TFL double-count. Trimmed tfl 0.4→0.25, solo 0.10→0.08,
 *   ast 0.05→0.035, int 1.5→1.3 (sacks kept at 1.0). This lands the
 *   best defender ~22-23 (on par with an elite QB) instead of ~30.
 *   Also tightened punting (baseline 38→40, mult 0.05→0.03, in20
 *   0.15→0.12) — a good-not-great punter was cracking the top 10.
 *
 * - 2026-06-11 OL + defense rebalance (validated on a full ~1100-player
 *   dynasty). OL were invisible (pancakes-minus-sacks left a clean full
 *   starter at ~0; top OL season was 1.2). Rebuilt OL around snapsPlayed:
 *   snaps drive a base (full starter → ~10), pancakes add run-block credit,
 *   sacks allowed dock pass-pro — top OL now ~11-12 (90 players valued vs 8).
 *   Defense was still flooding the board (DL 95th-pct 23.5, LB 23.5 vs RB
 *   15.8 / WR 9.1, plus far more defenders). Trimmed volume + events (solo
 *   .08→.05, ast .035→.02, tfl .25→.15, sack 1.0→.8, int 1.3→1.2, pd .3→.28,
 *   ff 1.0→.8, fr .7→.6, def TD 2.0→1.6) and DROPPED the DL ×1.15 boost.
 *   Defense now lands DL/LB ~15-17, DB ~12 — interleaved with offense.
 *
 * - 2026-06-12 OL pass-pro is now a RATE. Sacks allowed are graded per snap
 *   (projected to a full ~850-snap workload) instead of a flat −0.4/sack, so
 *   the same sack count docks a low-snap lineman more than a high-snap starter.
 *   At a full season the dock equals the old flat penalty — starter values are
 *   unchanged; only partial-season linemen shift.
 */

// Position groups — used to dispatch to the right formula.
const QB_POS = new Set(['QB'])
const RB_POS = new Set(['HB', 'FB', 'RB'])
const WR_TE_POS = new Set(['WR', 'TE'])
const OL_POS = new Set(['LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG'])
const DL_POS = new Set(['LEDG', 'REDG', 'DT', 'DE', 'DL', 'NT'])
const LB_POS = new Set(['SAM', 'MIKE', 'WILL', 'OLB', 'MLB', 'ILB', 'LB'])
const DB_POS = new Set(['CB', 'FS', 'SS', 'S', 'DB'])
const K_POS = new Set(['K'])
const P_POS = new Set(['P'])

// OL grading constants. Pass protection is graded as a RATE — sacks allowed per
// snap, projected to a full starter's workload — rather than a flat per-sack
// penalty. So a lineman who allows 4 sacks over 850 snaps grades far better than
// one who allows 4 over 300 snaps. At a full ~850-snap season the rate dock
// equals the old flat 0.4/sack, so starter calibration is unchanged.
const OL_STARTER_SNAPS = 850   // ~a full-season starter's snap count
const OL_SNAPS_BASE = 10       // base AV a full-workload starter earns from snaps
const OL_PANCAKE_W = 0.06      // run-block credit per pancake
const OL_SACK_RATE_W = 0.4     // pass-pro dock per (sack/snap × starter snaps)

// ──────────────────────────────────────────────────────────────────
// Position formulas — each takes a player's per-season stats object
// and returns a per-season AV contribution from the position's primary
// role. Calibrated so a top season lands around 15-22.

function qbValue(s) {
  let av = 0
  const p = s.passing
  if (p) {
    av += (p.yds || 0) * 0.0042    // 4000 yds → 16.8
    av += (p.td  || 0) * 0.45      // 30 TD   → 13.5
    av -= (p.int || 0) * 0.4       // 10 INT  → -4
    av -= (p.sacks || 0) * 0.1     // sack penalty
  }
  // Dual-threat bonus
  const r = s.rushing
  if (r) {
    av += (r.yds || 0) * 0.0055    // 600 rush yds → 3.3
    av += (r.td  || 0) * 0.5
    av -= (r.fum || 0) * 0.5
  }
  return Math.max(0, av)
}

function rbValue(s) {
  let av = 0
  const r = s.rushing
  if (r) {
    av += (r.yds || 0) * 0.008     // 2000 yds → 16
    av += (r.td  || 0) * 0.5       // 20 TD   → 10
    av -= (r.fum || 0) * 0.5
    // Bonus signals — contact-breaking and explosive runs
    av += (r.bt  || 0) * 0.05
    av += (r.yac || 0) * 0.0015
    av += (r.twentyPlus || 0) * 0.15
  }
  const c = s.receiving
  if (c) {
    av += (c.yds || 0) * 0.006     // dual-threat backs catch on
    av += (c.td  || 0) * 0.4
    av -= (c.drops || 0) * 0.2
  }
  return Math.max(0, av)
}

function wrTeValue(s) {
  let av = 0
  const c = s.receiving
  if (c) {
    av += (c.yds || 0) * 0.006     // 1500 rec yds → 9
    av += (c.td  || 0) * 0.4       // 15 TD       → 6
    av += (c.rec || 0) * 0.02      // small possession-receiver bonus
    av += (c.rac || 0) * 0.0006    // RAC is a subset of yds — keep small
    av -= (c.drops || 0) * 0.25
  }
  // Trick-play / Wildcat / TE rushing
  const r = s.rushing
  if (r) {
    av += (r.yds || 0) * 0.006
    av += (r.td  || 0) * 0.4
  }
  return Math.max(0, av)
}

function olValue(s) {
  // OL have almost no box-score footprint, so AV is built from two components:
  //   1. Snaps played — the blocking workload (durability + role), the bulk of
  //      an OL's value. A full-workload starter earns OL_SNAPS_BASE here.
  //   2. Sacks allowed PER SNAP — pass protection graded as a rate, not a raw
  //      count. The dock is the sack rate projected to a full starter's snaps,
  //      so the same sacks hurt a low-snap lineman more than a high-snap one.
  //   (+ pancakes for run-block dominance.)
  const snaps = Number(s.snapsPlayed) || 0
  const b = s.blocking || {}
  const pancakes = b.pancakes || 0
  const sacksAllowed = b.sacksAllowed || 0

  // Fallback for seasons with no snaps entered: the legacy raw-count line.
  if (!snaps) return Math.max(0, pancakes * 0.05 - sacksAllowed * 0.5)

  const ratio = Math.min(1, snaps / OL_STARTER_SNAPS)
  const base = ratio * OL_SNAPS_BASE
  // sacks/snap × starter-snaps = "sacks allowed at a full-season workload".
  const sackRateDock = (sacksAllowed / snaps) * OL_STARTER_SNAPS * OL_SACK_RATE_W
  return Math.max(0, base + pancakes * OL_PANCAKE_W - sackRateDock)
}

function defenseValue(s, posGroup) {
  const d = s.defense
  if (!d) return 0

  // Stat weights — sacks and INTs are the headline events; tackles
  // are volume; deflections and forced fumbles are difference-makers
  // worth their own line in the formula.
  let av = 0
  av += (d.solo || d.soloTkl || 0) * 0.05
  av += (d.assists || d.astTkl || 0) * 0.02
  av += (d.tfl || 0) * 0.15
  av += (d.sack || d.sacks || 0) * 0.8
  av += (d.int || 0) * 1.2
  av += (d.deflections || d.pd || 0) * 0.28
  av += (d.ff || 0) * 0.8
  av += (d.fr || 0) * 0.6
  av += (d.td || 0) * 1.6       // defensive scores are big, just not runaway
  av += (d.safeties || 0) * 1.0
  av += (d.blocks  || 0) * 1.0

  // No position-group multiplier anymore — the DL 1.15 boost (plus heavy
  // tackle/TFL volume) was the main reason defenders flooded the leaderboard.
  // posGroup is retained for call-signature stability / future tuning.
  return Math.max(0, av)
}

function kValue(s) {
  const k = s.kicking
  if (!k) return 0
  let av = 0
  av += (k.fgm || 0) * 0.3
  av += (k.xpm || 0) * 0.04
  // 50+ yarders are clutch — extra credit
  av += (k.fgm50 || 0) * 0.4
  av += (k.fgm49 || 0) * 0.05  // 40-49 small bonus
  // Misses count against you
  const fgMisses = Math.max(0, (k.fga || 0) - (k.fgm || 0))
  av -= fgMisses * 0.2
  const xpMisses = Math.max(0, (k.xpa || 0) - (k.xpm || 0))
  av -= xpMisses * 0.3
  // Blocked kicks against
  av -= (k.fgb || 0) * 0.3
  av -= (k.xpb || 0) * 0.3
  return Math.max(0, av)
}

function pValue(s) {
  const p = s.punting
  if (!p) return 0
  const punts = p.punts || 0
  if (punts === 0) return 0
  let av = 0
  // Net punting average above replacement (38 yds is league-average).
  // Reward the count of punts beating that line.
  const netAvg = p.netYds ? (p.netYds / punts) : ((p.yds || 0) / punts)
  av += Math.max(0, netAvg - 40) * punts * 0.03
  // Inside-20 punts are field-position gold
  av += (p.in20 || 0) * 0.12
  // Touchbacks (bad for punters) and blocks (terrible)
  av -= (p.tb || 0) * 0.10
  av -= (p.block || 0) * 0.50
  return Math.max(0, av)
}

function returnValue(s) {
  let av = 0
  const kr = s.kickReturn
  if (kr) {
    av += (kr.yds || 0) * 0.005
    av += (kr.td  || 0) * 1.5
  }
  const pr = s.puntReturn
  if (pr) {
    av += (pr.yds || 0) * 0.008  // PR yds harder to come by
    av += (pr.td  || 0) * 1.5
  }
  return Math.max(0, av)
}

// ──────────────────────────────────────────────────────────────────
// Public API

/**
 * Compute Approximate Value for one season.
 *
 * @param {object} yearStats — player.statsByYear[year]
 * @param {string} position — player position for this year
 * @param {object} [opts]
 * @param {boolean} [opts.breakdown] — when true, return
 *     `{ total, parts }` instead of just total. `parts` is an object
 *     of role label → numeric contribution. Use for debugging /
 *     transparency (the "show your work" view).
 * @returns {number | { total: number, parts: object }}
 */
export function computeSeasonAV(yearStats, position, opts = {}) {
  if (!yearStats) return opts.breakdown ? { total: 0, parts: {} } : 0

  const pos = (position || '').toUpperCase()
  const parts = {}

  if (QB_POS.has(pos))         parts.qb = qbValue(yearStats)
  else if (RB_POS.has(pos))    parts.rb = rbValue(yearStats)
  else if (WR_TE_POS.has(pos)) parts.wrTe = wrTeValue(yearStats)
  else if (OL_POS.has(pos))    parts.ol = olValue(yearStats)
  else if (DL_POS.has(pos))    parts.dl = defenseValue(yearStats, 'DL')
  else if (LB_POS.has(pos))    parts.lb = defenseValue(yearStats, 'LB')
  else if (DB_POS.has(pos))    parts.db = defenseValue(yearStats, 'DB')
  else if (K_POS.has(pos))     parts.k = kValue(yearStats)
  else if (P_POS.has(pos))     parts.p = pValue(yearStats)
  // Unknown position — fall back to scanning all categories
  else {
    parts.qb = qbValue(yearStats)
    parts.rb = rbValue(yearStats)
    parts.wrTe = wrTeValue(yearStats)
    parts.ol = olValue(yearStats)
    parts.lb = defenseValue(yearStats, 'LB')
    parts.k = kValue(yearStats)
    parts.p = pValue(yearStats)
  }

  // Returns are added on top of the primary-position role so a WR
  // who returns punts gets credit for both.
  const ret = returnValue(yearStats)
  if (ret > 0) parts.returns = ret

  // Sum and round once — accumulating then rounding avoids the
  // 0.1 + 0.2 = 0.30000000000000004 noise.
  const sum = Object.values(parts).reduce((a, b) => a + b, 0)
  const total = Math.round(sum * 10) / 10

  if (opts.breakdown) {
    // Round each part for nicer console.table display.
    const niceParts = {}
    Object.entries(parts).forEach(([k, v]) => {
      if (v > 0) niceParts[k] = Math.round(v * 10) / 10
    })
    return { total, parts: niceParts }
  }
  return total
}

/**
 * Per-stat breakdown of a season's AV — the individual stat line items
 * (with their raw counts) that build the score, mirroring the position
 * formula weights above. This is the "show your work" view.
 *
 * `total` is the authoritative computeSeasonAV value (per-position
 * max(0) clamp applied) so it always matches the leaderboard, even in
 * the rare case where negative line items would otherwise undershoot.
 *
 * @param {object} yearStats — player.statsByYear[year]
 * @param {string} position — player position for this year
 * @returns {{ total: number, items: Array<{label:string, detail:string, value:number}> }}
 */
export function explainSeasonAV(yearStats, position) {
  const s = yearStats || {}
  const pos = (position || '').toUpperCase()
  const items = []
  const push = (label, detail, value) => {
    if (value) items.push({ label, detail, value: Math.round(value * 100) / 100 })
  }

  if (QB_POS.has(pos)) {
    const p = s.passing, r = s.rushing
    if (p) {
      push('Passing yards', `${p.yds || 0} yds`, (p.yds || 0) * 0.0042)
      push('Passing TDs', `${p.td || 0} TD`, (p.td || 0) * 0.45)
      push('Interceptions', `${p.int || 0} INT`, -(p.int || 0) * 0.4)
      push('Sacks taken', `${p.sacks || 0}`, -(p.sacks || 0) * 0.1)
    }
    if (r) {
      push('Rushing yards', `${r.yds || 0} yds`, (r.yds || 0) * 0.0055)
      push('Rushing TDs', `${r.td || 0} TD`, (r.td || 0) * 0.5)
      push('Fumbles', `${r.fum || 0}`, -(r.fum || 0) * 0.5)
    }
  } else if (RB_POS.has(pos)) {
    const r = s.rushing, c = s.receiving
    if (r) {
      push('Rushing yards', `${r.yds || 0} yds`, (r.yds || 0) * 0.008)
      push('Rushing TDs', `${r.td || 0} TD`, (r.td || 0) * 0.5)
      push('Fumbles', `${r.fum || 0}`, -(r.fum || 0) * 0.5)
      push('Broken tackles', `${r.bt || 0}`, (r.bt || 0) * 0.05)
      push('Yards after contact', `${r.yac || 0}`, (r.yac || 0) * 0.0015)
      push('20+ yard runs', `${r.twentyPlus || 0}`, (r.twentyPlus || 0) * 0.15)
    }
    if (c) {
      push('Receiving yards', `${c.yds || 0} yds`, (c.yds || 0) * 0.006)
      push('Receiving TDs', `${c.td || 0} TD`, (c.td || 0) * 0.4)
      push('Drops', `${c.drops || 0}`, -(c.drops || 0) * 0.2)
    }
  } else if (WR_TE_POS.has(pos)) {
    const c = s.receiving, r = s.rushing
    if (c) {
      push('Receiving yards', `${c.yds || 0} yds`, (c.yds || 0) * 0.006)
      push('Receiving TDs', `${c.td || 0} TD`, (c.td || 0) * 0.4)
      push('Receptions', `${c.rec || 0}`, (c.rec || 0) * 0.02)
      push('Yards after catch', `${c.rac || 0}`, (c.rac || 0) * 0.0006)
      push('Drops', `${c.drops || 0}`, -(c.drops || 0) * 0.25)
    }
    if (r) {
      push('Rushing yards', `${r.yds || 0} yds`, (r.yds || 0) * 0.006)
      push('Rushing TDs', `${r.td || 0} TD`, (r.td || 0) * 0.4)
    }
  } else if (OL_POS.has(pos)) {
    const snaps = Number(s.snapsPlayed) || 0
    const b = s.blocking
    if (snaps) {
      const ratio = Math.min(1, snaps / OL_STARTER_SNAPS)
      push('Snaps played', `${snaps} snaps`, ratio * OL_SNAPS_BASE)
      if (b) {
        const sacksAllowed = b.sacksAllowed || 0
        const ratePct = ((sacksAllowed / snaps) * 100).toFixed(2)
        push('Pancakes', `${b.pancakes || 0}`, (b.pancakes || 0) * OL_PANCAKE_W)
        push('Sacks allowed', `${sacksAllowed} on ${snaps} snaps (${ratePct}%/snap)`, -(sacksAllowed / snaps) * OL_STARTER_SNAPS * OL_SACK_RATE_W)
      }
    } else if (b) {
      push('Pancakes', `${b.pancakes || 0}`, (b.pancakes || 0) * 0.05)
      push('Sacks allowed', `${b.sacksAllowed || 0}`, -(b.sacksAllowed || 0) * 0.5)
    }
  } else if (DL_POS.has(pos) || LB_POS.has(pos) || DB_POS.has(pos)) {
    const d = s.defense
    if (d) {
      const solo = d.solo || d.soloTkl || 0
      const ast = d.assists || d.astTkl || 0
      push('Tackles', `${solo} solo, ${ast} ast`, solo * 0.05 + ast * 0.02)
      push('Tackles for loss', `${d.tfl || 0}`, (d.tfl || 0) * 0.15)
      push('Sacks', `${d.sack || d.sacks || 0}`, (d.sack || d.sacks || 0) * 0.8)
      push('Interceptions', `${d.int || 0}`, (d.int || 0) * 1.2)
      push('Pass deflections', `${d.deflections || d.pd || 0}`, (d.deflections || d.pd || 0) * 0.28)
      push('Forced fumbles', `${d.ff || 0}`, (d.ff || 0) * 0.8)
      push('Fumble recoveries', `${d.fr || 0}`, (d.fr || 0) * 0.6)
      push('Defensive TDs', `${d.td || 0}`, (d.td || 0) * 1.6)
      push('Safeties', `${d.safeties || 0}`, (d.safeties || 0) * 1.0)
      push('Blocked kicks', `${d.blocks || 0}`, (d.blocks || 0) * 1.0)
    }
  } else if (K_POS.has(pos)) {
    const k = s.kicking
    if (k) {
      push('Field goals', `${k.fgm || 0} FGM`, (k.fgm || 0) * 0.3)
      push('Extra points', `${k.xpm || 0} XPM`, (k.xpm || 0) * 0.04)
      push('50+ yd FGs', `${k.fgm50 || 0}`, (k.fgm50 || 0) * 0.4)
      push('40-49 yd FGs', `${k.fgm49 || 0}`, (k.fgm49 || 0) * 0.05)
      const fgMiss = Math.max(0, (k.fga || 0) - (k.fgm || 0))
      push('Missed FGs', `${fgMiss}`, -fgMiss * 0.2)
      const xpMiss = Math.max(0, (k.xpa || 0) - (k.xpm || 0))
      push('Missed XPs', `${xpMiss}`, -xpMiss * 0.3)
      push('Blocked FGs', `${k.fgb || 0}`, -(k.fgb || 0) * 0.3)
      push('Blocked XPs', `${k.xpb || 0}`, -(k.xpb || 0) * 0.3)
    }
  } else if (P_POS.has(pos)) {
    const p = s.punting
    const punts = p?.punts || 0
    if (p && punts > 0) {
      const netAvg = p.netYds ? (p.netYds / punts) : ((p.yds || 0) / punts)
      push('Net avg over 40', `${netAvg.toFixed(1)} net, ${punts} punts`, Math.max(0, netAvg - 40) * punts * 0.03)
      push('Inside-20 punts', `${p.in20 || 0}`, (p.in20 || 0) * 0.12)
      push('Touchbacks', `${p.tb || 0}`, -(p.tb || 0) * 0.10)
      push('Blocked punts', `${p.block || 0}`, -(p.block || 0) * 0.50)
    }
  }

  // Returns add on top of any position.
  const kr = s.kickReturn, pr = s.puntReturn
  if (kr) {
    push('Kick return yards', `${kr.yds || 0} yds`, (kr.yds || 0) * 0.005)
    push('Kick return TDs', `${kr.td || 0} TD`, (kr.td || 0) * 1.5)
  }
  if (pr) {
    push('Punt return yards', `${pr.yds || 0} yds`, (pr.yds || 0) * 0.008)
    push('Punt return TDs', `${pr.td || 0} TD`, (pr.td || 0) * 1.5)
  }

  items.sort((a, b) => b.value - a.value)
  return { total: computeSeasonAV(yearStats, position), items }
}

/**
 * Compute career Approximate Value — sum of per-season AVs.
 *
 * @param {object} player — player record with statsByYear
 * @returns {number}
 */
export function computeCareerAV(player) {
  if (!player?.statsByYear) return 0
  let total = 0
  Object.entries(player.statsByYear).forEach(([yearStr, yearStats]) => {
    if (!yearStats) return
    const year = parseInt(yearStr)
    // Position can drift across seasons (rare in CFB, but possible).
    // Prefer positionByYear if maintained, otherwise use the player's
    // current position.
    const positionForYear = player.positionByYear?.[year]
      || player.positionByYear?.[yearStr]
      || player.position
    total += computeSeasonAV(yearStats, positionForYear)
  })
  return Math.round(total * 10) / 10
}
