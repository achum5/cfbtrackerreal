import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getTeamConference } from '../data/conferenceTeams'
import { isFCSPlaceholderAbbr } from '../data/teamRegistry'
import { getCustomConferencesForYear, getTeamRatingsForYear } from '../context/DynastyContext'
import { getTeamColors } from '../data/teamColors'
import { getContrastTextColor } from '../utils/colorUtils'
import { getSchoolName } from '../data/teams'

// ─── Rounding ─────────────────────────────────────────────────────────────────

function roundToNearest5(n) {
  return Math.round(n / 5) * 5
}

// Sportsbook-clean futures rounding:
// <1000 → nearest 50 | 1000-5000 → nearest 100 | >5000 → nearest 500
function roundOddsToBook(ml) {
  if (ml >= 100000) return 100000
  const sign = ml < 0 ? -1 : 1
  const abs  = Math.abs(ml)
  let rounded
  if (abs < 1000)       rounded = Math.round(abs / 50)  * 50
  else if (abs <= 5000) rounded = Math.round(abs / 100) * 100
  else                  rounded = Math.round(abs / 500) * 500
  rounded = Math.max(110, rounded)
  return sign * rounded
}

// ─── Team data helpers ────────────────────────────────────────────────────────

function getTeamAbbr(dynasty, tid) {
  if (!tid) return 'TBD'
  const t = dynasty.teams?.[tid] || dynasty.teams?.[String(tid)]
  return t?.abbr || `T${tid}`
}

function getTeamName(dynasty, tid) {
  const t = dynasty.teams?.[tid] || dynasty.teams?.[String(tid)]
  return t?.name || getTeamAbbr(dynasty, tid)
}

function getTeamLogo(dynasty, tid) {
  const t = dynasty.teams?.[tid] || dynasty.teams?.[String(tid)]
  return t?.logo || ''
}

// Resolve a team's conference the same way the recap filter does (by tid, with
// the dynasty teams map) so the page-level filter values line up exactly.
function teamConf(dynasty, tid, customConfs) {
  if (tid == null) return null
  try { return getTeamConference(Number(tid), customConfs, dynasty?.teams) } catch { return null }
}

// "3-0 (1-0)" — overall record with conference record in parentheses.
function recordStr(stats, conf) {
  const o = `${stats?.wins ?? 0}-${stats?.losses ?? 0}`
  return conf ? `${o} (${conf.wins ?? 0}-${conf.losses ?? 0})` : o
}

function isFCSTeam(dynasty, tid) {
  if (!tid) return false
  const abbr = getTeamAbbr(dynasty, tid)
  return isFCSPlaceholderAbbr(abbr)
}

// Gather a team's played games (with real scores) within a [minYear, maxYear]
// range, as { year, my, their }. The in-progress week cap (upToWeek) only
// applies to `year` itself — prior seasons are complete. Supports modern
// tid-keyed and legacy user-game (userTid / teamScore) formats. A game counts
// if flagged played OR carrying real (non-zero) scores — the user's own games
// are often stored with the score entered but isPlayed still false.
function teamGamesInRange(dynasty, tid, year, minYear, maxYear, upToWeek = 99) {
  const tidNum = Number(tid)
  const abbr   = getTeamAbbr(dynasty, tid)
  const yearN  = Number(year)
  const seenKey = new Set()
  const out = []

  for (const g of (dynasty.games || [])) {
    const gy = Number(g.year)
    if (gy < minYear || gy > maxYear) continue

    const t1 = Number(g.team1Score), t2 = Number(g.team2Score)
    const u1 = Number(g.teamScore),  u2 = Number(g.opponentScore)
    const realScore = (Number.isFinite(t1) && Number.isFinite(t2) && (t1 > 0 || t2 > 0))
      || (Number.isFinite(u1) && Number.isFinite(u2) && (u1 > 0 || u2 > 0))
    if (!g.isPlayed && !realScore) continue

    const hasScores =
      (g.team1Score !== undefined && g.team2Score !== undefined) ||
      (g.teamScore !== undefined && g.opponentScore !== undefined)
    if (!hasScores) continue

    // The week cap only restricts the in-progress current season.
    if (gy === yearN && g.week != null && Number(g.week) >= Number(upToWeek)) continue

    let my, their
    if (Number(g.team1Tid) === tidNum) { my = Number(g.team1Score) || 0; their = Number(g.team2Score) || 0 }
    else if (Number(g.team2Tid) === tidNum) { my = Number(g.team2Score) || 0; their = Number(g.team1Score) || 0 }
    else if (Number(g.userTid) === tidNum || g.userTeam === abbr) { my = Number(g.teamScore) || 0; their = Number(g.opponentScore) || 0 }
    else if (Number(g.opponentTid) === tidNum || g.opponent === abbr) { my = Number(g.opponentScore) || 0; their = Number(g.teamScore) || 0 }
    else continue

    const key = `${gy}-${g.week ?? 'post'}-${g.gameType || 'regular'}`
    if (seenKey.has(key)) continue
    seenKey.add(key)
    out.push({ year: gy, my, their })
  }
  return out
}

// Current-season record + scoring — used for the displayed record, win-total
// pace, and championship win%.
function calcTeamStats(dynasty, tid, year, upToWeek = 99) {
  const games = teamGamesInRange(dynasty, tid, year, Number(year), Number(year), upToWeek)
  let wins = 0, losses = 0, ptsFor = 0, ptsAgainst = 0
  for (const g of games) {
    if (g.my > g.their) wins++; else losses++
    ptsFor += g.my; ptsAgainst += g.their
  }
  const total = wins + losses
  return {
    wins,
    losses,
    winPct:      total > 0 ? wins / total : 0.5,
    avgFor:      total > 0 ? ptsFor / total : 24,
    avgAgainst:  total > 0 ? ptsAgainst / total : 24,
    avgDiff:     total > 0 ? (ptsFor - ptsAgainst) / total : 0,
    gamesPlayed: total,
  }
}

// Strength + scoring PROFILE over the last few seasons, weighted toward recent
// games (current season ×1, each prior season ×0.6). A far bigger sample than a
// 2–3 game current season, so early-year power / spreads / totals aren't driven
// by one or two blowouts. Drives the power score and the over/under.
const PROFILE_SEASONS = 3
const PROFILE_DECAY   = 0.6

function calcScoringProfile(dynasty, tid, year, upToWeek = 99) {
  const yearN = Number(year)
  const games = teamGamesInRange(dynasty, tid, year, yearN - (PROFILE_SEASONS - 1), yearN, upToWeek)
  let wW = 0, wWins = 0, wFor = 0, wAgainst = 0
  for (const g of games) {
    const w = Math.pow(PROFILE_DECAY, yearN - g.year)
    wW += w
    if (g.my > g.their) wWins += w
    wFor += w * g.my
    wAgainst += w * g.their
  }
  if (wW <= 0) {
    return { winPct: 0.5, avgFor: 24, avgAgainst: 24, avgDiff: 0, sampleGames: 0, rawGames: 0 }
  }
  return {
    winPct:      wWins / wW,
    avgFor:      wFor / wW,
    avgAgainst:  wAgainst / wW,
    avgDiff:     (wFor - wAgainst) / wW,
    sampleGames: wW,
    rawGames:    games.length,
  }
}

// Power score = (winPct × 40) + (avgPointDiff × 3) from the multi-season
// profile. No team rating is used (it's almost never entered). For a thin
// sample (a brand-new program with little history) regress toward a neutral
// baseline (20 ≈ an even, 0-diff team).
function calcPowerScore(dynasty, tid, year, upToWeek = 99) {
  const prof = calcScoringProfile(dynasty, tid, year, upToWeek)
  const onField = (prof.winPct * 40) + (prof.avgDiff * 3)
  const trust = Math.min(1, prof.sampleGames / 3)
  return onField * trust + 20 * (1 - trust)
}

// Conference games only — same logic as calcTeamStats but filtered to isConferenceGame.
function calcConfStats(dynasty, tid, year, upToWeek = 99) {
  const tidNum = Number(tid)
  const abbr   = getTeamAbbr(dynasty, tid)
  const seenKey = new Set()

  const games = (dynasty.games || []).filter(g => {
    if (Number(g.year) !== Number(year)) return false
    // Count a game if it's flagged played OR carries real (non-zero) scores.
    // The user's OWN games are routinely stored with the final score entered
    // but isPlayed still false — relying on isPlayed alone zeroed out the user
    // team's record and dropped it to a rating-only power estimate.
    const _t1 = Number(g.team1Score), _t2 = Number(g.team2Score)
    const _u1 = Number(g.teamScore),  _u2 = Number(g.opponentScore)
    const _realScore = (Number.isFinite(_t1) && Number.isFinite(_t2) && (_t1 > 0 || _t2 > 0))
      || (Number.isFinite(_u1) && Number.isFinite(_u2) && (_u1 > 0 || _u2 > 0))
    if (!g.isPlayed && !_realScore) return false
    if (!g.isConferenceGame) return false
    const hasScores =
      (g.team1Score !== undefined && g.team2Score !== undefined) ||
      (g.teamScore !== undefined && g.opponentScore !== undefined)
    if (!hasScores) return false
    const inGame =
      Number(g.team1Tid) === tidNum || Number(g.team2Tid) === tidNum ||
      Number(g.userTid) === tidNum  || Number(g.opponentTid) === tidNum ||
      g.userTeam === abbr || g.opponent === abbr ||
      g.team1 === abbr   || g.team2 === abbr
    if (!inGame) return false
    if (g.week != null && Number(g.week) >= Number(upToWeek)) return false
    const key = `${g.week ?? 'post'}-conf`
    if (seenKey.has(key)) return false
    seenKey.add(key)
    return true
  })

  let wins = 0, losses = 0, ptsFor = 0, ptsAgainst = 0
  for (const g of games) {
    let myScore, theirScore
    if      (Number(g.team1Tid) === tidNum) { myScore = Number(g.team1Score)||0; theirScore = Number(g.team2Score)||0 }
    else if (Number(g.team2Tid) === tidNum) { myScore = Number(g.team2Score)||0; theirScore = Number(g.team1Score)||0 }
    else if (Number(g.userTid)  === tidNum || g.userTeam === abbr) { myScore = Number(g.teamScore)||0; theirScore = Number(g.opponentScore)||0 }
    else if (Number(g.opponentTid) === tidNum || g.opponent === abbr) { myScore = Number(g.opponentScore)||0; theirScore = Number(g.teamScore)||0 }
    else continue
    if (myScore > theirScore) wins++; else losses++
    ptsFor += myScore; ptsAgainst += theirScore
  }

  const total = wins + losses
  return {
    wins, losses,
    winPct:      total > 0 ? wins / total : 0.5,
    avgFor:      total > 0 ? ptsFor / total : 24,
    avgAgainst:  total > 0 ? ptsAgainst / total : 24,
    avgDiff:     total > 0 ? (ptsFor - ptsAgainst) / total : 0,
    gamesPlayed: total,
  }
}

// Blended championship score: 60% power + 40% win% (scaled 0-100).
// A 10-0 team will never rank below 8-2 unless power gap is huge.
function calcChampScore(dynasty, tid, year, week) {
  const stats = calcTeamStats(dynasty, tid, year, week ?? 99)
  const ps    = calcPowerScore(dynasty, tid, year, week ?? 99)
  return ps * 0.6 + (stats.winPct * 100) * 0.4
}

// ─── Spread calculation (min-max normalized) ──────────────────────────────────
// Raw power scores can range ±100+, which produces absurd spreads.
// We normalize all team scores to [0,100] first, then divide by 4 to map a
// 20-point normalized gap → 5-point spread, 60-point gap → 15-point spread.
// Home field adds 3. Result is clamped to ±28.

function buildNormSpreadContext(dynasty, year, week) {
  const teams = dynasty?.teams || {}
  const scores = Object.keys(teams)
    .map(Number)
    .filter(tid => {
      if (!teams[tid]?.abbr) return false
      if (isFCSPlaceholderAbbr(teams[tid].abbr)) return false
      return true
    })
    .map(tid => calcPowerScore(dynasty, tid, year, week ?? 99))

  if (scores.length < 2) return { min: 0, max: 100, range: 100 }
  const min   = Math.min(...scores)
  const max   = Math.max(...scores)
  const range = max - min || 1
  return { min, max, range }
}

function normScore(ps, ctx) {
  return ((ps - ctx.min) / ctx.range) * 100
}

// spreadVal > 0 → home favored by that many points. Negative → away favored.
// Home field worth +3, but only at a real home site — neutral-site games get no
// home edge.
function calcNormalizedSpread(homePS, awayPS, normCtx, isNeutral = false) {
  const homeNorm = normScore(homePS, normCtx)
  const awayNorm = normScore(awayPS, normCtx)
  const raw      = (homeNorm - awayNorm) / 4 + (isNeutral ? 0 : 3)
  const clamped  = Math.max(-28, Math.min(28, raw))
  return Math.round(clamped * 2) / 2
}

// Team overall rating for a season, or null if not entered. Used to seed the
// line before any games are played (in the preseason every team's on-field
// power is the flat neutral baseline, so without this the spread is just the
// home-field 3 for everyone).
function teamOvr(dynasty, tid, year) {
  const o = Number(getTeamRatingsForYear(dynasty, Number(tid), year)?.overall)
  return Number.isFinite(o) && o > 0 ? o : null
}

// ~points of spread per point of overall difference. A 25-OVR gap (e.g. a 95
// vs a 70) → ~22.5, which lands near a 25-point line once home field is added.
const OVR_SPREAD_PER = 0.9

// The line for one matchup. When BOTH teams have an overall entered, the spread
// blends an overall-difference component with on-field results — the overall
// carries it in the preseason and fades out as real games accumulate (by ~6
// games it's purely on-field). Teams without both overalls keep the pure
// on-field line (unchanged behavior). Positive → home favored.
function calcSpread(dynasty, homeTid, awayTid, year, week, normCtx, isNeutral = false) {
  const onField = (normScore(calcPowerScore(dynasty, homeTid, year, week), normCtx)
                 - normScore(calcPowerScore(dynasty, awayTid, year, week), normCtx)) / 4
  const homeField = isNeutral ? 0 : 3

  const hOvr = teamOvr(dynasty, homeTid, year)
  const aOvr = teamOvr(dynasty, awayTid, year)

  let core = onField
  if (hOvr != null && aOvr != null) {
    const ovrComponent = (hOvr - aOvr) * OVR_SPREAD_PER
    const played = Math.min(
      calcScoringProfile(dynasty, homeTid, year, week).sampleGames,
      calcScoringProfile(dynasty, awayTid, year, week).sampleGames,
    )
    const w = Math.min(1, played / 6) // 0 preseason (pure overall) → 1 by ~6 games (pure on-field)
    core = ovrComponent * (1 - w) + onField * w
  }

  const clamped = Math.max(-28, Math.min(28, core + homeField))
  return Math.round(clamped * 2) / 2
}

// ─── Spread → Moneyline (reference table with linear interpolation) ───────────
// Each entry: [spread, favML, dogML]
const SPREAD_ML_TABLE = [
  [0,    -110,  -110],
  [1.5,  -130,   110],
  [3,    -160,   140],
  [4,    -180,   155],
  [5,    -200,   170],
  [6,    -220,   185],
  [7,    -275,   230],
  [10,   -350,   290],
  [14,   -550,   420],
  [17,   -800,   580],
  [21,  -1200,   750],
]

// absSp = absolute value of the spread (always >= 0)
function spreadToML(absSp) {
  if (absSp < 0.5) return { favML: -110, dogML: -110 }

  for (let i = 0; i < SPREAD_ML_TABLE.length - 1; i++) {
    const [lo, loFav, loDog] = SPREAD_ML_TABLE[i]
    const [hi, hiFav, hiDog] = SPREAD_ML_TABLE[i + 1]
    if (absSp >= lo && absSp <= hi) {
      const t = (absSp - lo) / (hi - lo)
      const rawFav = loFav + t * (hiFav - loFav)
      const rawDog = loDog + t * (hiDog - loDog)
      return {
        favML: Math.min(roundToNearest5(rawFav), -105),
        dogML: Math.max(roundToNearest5(rawDog), 105),
      }
    }
  }

  // Beyond 21+
  return { favML: -1200, dogML: 750 }
}

// ─── Total (Over/Under) ───────────────────────────────────────────────────────
// Each team's expected points = its offense blended with the OPPONENT's defense
// (avgFor vs the other team's avgAgainst). Summing both season offenses instead
// double-counts scoring and ignores defense, which balloons totals (e.g. two
// 45-ppg offenses → a 95 total). Round to nearest 0.5; key round numbers
// (45, 50, 55…) get shaded -115/-105.
function calcTotal(dynasty, tid1, tid2, year, week) {
  const s1 = calcScoringProfile(dynasty, tid1, year, week)
  const s2 = calcScoringProfile(dynasty, tid2, year, week)
  const exp1 = (s1.avgFor + s2.avgAgainst) / 2 // tid1 offense vs tid2 defense
  const exp2 = (s2.avgFor + s1.avgAgainst) / 2 // tid2 offense vs tid1 defense
  const combined = (exp1 + exp2) * 1.03        // light book shade toward the over
  const raw = combined > 20 ? combined : 48
  const total = Math.round(raw * 2) / 2

  const isKeyNum = total % 5 === 0 && total >= 40
  return {
    total,
    overVig: isKeyNum ? -115 : -110,
    underVig: isKeyNum ? -105 : -110,
  }
}

// ─── Probability → American odds ─────────────────────────────────────────────
// Sportsbook-clean rounding. Underdogs floored at +110 and capped at maxDog.
function probToAmerican(p, opts = {}) {
  const { leaderFloor = -300, maxDog = 50000 } = opts
  // Clamp p: never ≥ 1 (the vig multiplier can push a heavy favorite's implied
  // prob above 1, which flips the sign of the favorite formula and mispriced it
  // as a +2800 longshot), and never 0. This is the bug behind the broken conf
  // championship board.
  const cp = Math.min(Math.max(p, 1e-6), 0.985)
  if (cp > 0.5) {
    const ml = -(cp / (1 - cp)) * 100
    return Math.max(roundOddsToBook(ml), leaderFloor) // clamp leader
  }
  const ml = ((1 - cp) / cp) * 100
  return Math.min(Math.max(roundOddsToBook(ml), 110), maxDog)
}

function fmt(ml) {
  return ml >= 0 ? `+${ml}` : `${ml}`
}

// ─── Futures engine (softmax + sportsbook rounding) ──────────────────────────
const VIG = 1.045

function softmaxOdds(rows, scoreKey, opts = {}) {
  const { topN = Infinity, outsiderOdds = 50000, leaderFloor = -300, temp = 10 } = opts
  if (rows.length === 0) return []

  // Higher temp = softer spread (used for small fields like one conference,
  // where teams are closer in strength and shouldn't collapse to one favorite).
  const expScores = rows.map(r => Math.exp(r[scoreKey] / temp))
  const totalExp  = expScores.reduce((a, b) => a + b, 0)

  const withProb = rows.map((r, i) => ({
    ...r,
    rawProb:  expScores[i] / totalExp,
    vigProb:  (expScores[i] / totalExp) * VIG,
  }))

  // Sort best → worst so topN cut applies correctly
  withProb.sort((a, b) => b.vigProb - a.vigProb)

  const result = withProb.map((r, i) => ({
    ...r,
    odds: i < topN
      ? probToAmerican(r.vigProb, { leaderFloor })
      : outsiderOdds,
  }))

  // Clamp leader floor
  if (result[0] && result[0].odds < leaderFloor) {
    result[0] = { ...result[0], odds: leaderFloor }
  }

  return result
}

// National championship board — blended 60/40 score, top 25 get real odds.
function buildNatlChampBoard(dynasty, year, week) {
  const teams = dynasty.teams || {}
  const tids  = Object.keys(teams).map(Number).filter(tid => {
    if (!teams[tid]?.abbr) return false
    if (isFCSPlaceholderAbbr(teams[tid].abbr)) return false
    return true
  })
  if (tids.length === 0) return []

  const rows = tids.map(tid => {
    const stats = calcTeamStats(dynasty, tid, year, week ?? 99)
    const conf  = calcConfStats(dynasty, tid, year, week ?? 99)
    const ps    = calcPowerScore(dynasty, tid, year, week ?? 99)
    const cs    = calcChampScore(dynasty, tid, year, week)
    return { tid, team: teams[tid], stats, conf, ps, cs }
  })

  return softmaxOdds(rows, 'cs', { topN: 25, outsiderOdds: 50000, leaderFloor: -300 })
}

// Conference championship board — conference record weighted, scoped to one conf.
function buildConfChampBoard(dynasty, year, week, confTeamAbbrs) {
  if (!confTeamAbbrs || confTeamAbbrs.length === 0) return []
  const teams  = dynasty.teams || {}
  const abbrSet = new Set(confTeamAbbrs.map(a => a.toUpperCase()))

  const tids = Object.keys(teams).map(Number).filter(tid => {
    if (!teams[tid]?.abbr) return false
    if (isFCSPlaceholderAbbr(teams[tid].abbr)) return false
    return abbrSet.has((teams[tid].abbr || '').toUpperCase())
  })

  if (tids.length === 0) return []

  const rows = tids.map(tid => {
    const overall = calcTeamStats(dynasty, tid, year, week ?? 99)
    const conf    = calcConfStats(dynasty, tid, year, week ?? 99)
    const ps      = calcPowerScore(dynasty, tid, year, week ?? 99)
    // Power-dominant. Conference record nudges it, but its weight ramps up with
    // conference games played — so one early conf win can't give a team a +25
    // head start and run away with the whole board (the old winPct*50 term did
    // exactly that, leaving every other team floored at +50000).
    const confTrust = Math.min(1, conf.gamesPlayed / 4)
    const confEdge  = ((conf.winPct - 0.5) * 60 + conf.avgDiff * 1.5) * confTrust
    return { tid, team: teams[tid], stats: overall, conf, ps, cs: ps + confEdge }
  })

  // Softer temperature: a single conference is ~16 teams of similar strength,
  // so the field should spread out rather than collapse onto one favorite.
  return softmaxOdds(rows, 'cs', { topN: Infinity, leaderFloor: -300, temp: 20 })
}

// ─── Win totals with pace-based drift ────────────────────────────────────────
const SEASON_GAMES = 12

function calcWinTotal(dynasty, tid, year) {
  const stats = calcTeamStats(dynasty, tid, year)
  // Season win line from power score via an expected per-game win rate (power
  // 20 ≈ a .500 / 6-win team). The old `(ps-20)/12` mapping was too steep and
  // pegged every strong team at the 12 cap; this lands even elite teams around
  // 10–11 with a realistic spread underneath.
  const ps        = calcPowerScore(dynasty, tid, year)
  const expWinPct = Math.max(0.05, Math.min(0.95, 0.5 + (ps - 20) / 210))
  let baseTotal   = expWinPct * SEASON_GAMES
  baseTotal       = Math.max(2, Math.min(12, baseTotal))
  const total     = Math.round(baseTotal * 2) / 2

  let overML = -110, underML = -110

  if (stats.gamesPlayed > 0) {
    const pace = (stats.wins / stats.gamesPlayed) * SEASON_GAMES
    const gap  = pace - total

    if (gap >= 2)      { overML = -160; underML = 135  }
    else if (gap >= 1) { overML = -130; underML = 108  }
    else if (gap <= -2){ underML = -160; overML = 135  }
    else if (gap <= -1){ underML = -130; overML = 108  }
  }

  return {
    total,
    overML,
    underML,
    wins: stats.wins,
    losses: stats.losses,
    gamesPlayed: stats.gamesPlayed,
  }
}

// ─── Debug: copyable computation breakdown for THIS game ─────────────────────
// Produces a plain-text report showing exactly how the spread, moneyline,
// total, win totals, and championship inputs are derived for this matchup.
// Mirrors the live model (calcPowerScore / calcNormalizedSpread / spreadToML /
// calcTotal) step by step so the numbers can be audited.
function buildDebugText(dynasty, game) {
  const year = game?.year
  const week = game?.week
  const tid1 = Number(game.team1Tid)
  const tid2 = Number(game.team2Tid)
  const isNeutral = game.homeTeamTid == null
  const homeTid = game.homeTeamTid != null ? Number(game.homeTeamTid) : tid1
  const awayTid = homeTid === tid1 ? tid2 : tid1

  const normCtx = buildNormSpreadContext(dynasty, year, week)
  const L = []
  const p = (s = '') => L.push(s)
  const sgn = (n) => (n >= 0 ? '+' : '') + n.toFixed(1)

  p('SPORTSBOOK DEBUG')
  p(`${getTeamAbbr(dynasty, awayTid)} @ ${getTeamAbbr(dynasty, homeTid)}${isNeutral ? '  (neutral site)' : ''}`)
  p(`${dynasty.leagueName || 'CFB'} · ${year} Season · Week ${week ?? 'Post'}`)
  p('')
  p(`NORMALIZATION CONTEXT  (non-FCS teams, through week ${week})`)
  p(`  min power = ${normCtx.min.toFixed(2)}   max = ${normCtx.max.toFixed(2)}   range = ${normCtx.range.toFixed(2)}`)
  p('')

  const block = (tid, role) => {
    const abbr    = getTeamAbbr(dynasty, tid)
    const cur     = calcTeamStats(dynasty, tid, year, week)
    const prof    = calcScoringProfile(dynasty, tid, year, week)
    const onField = (prof.winPct * 40) + (prof.avgDiff * 3)
    const ps      = calcPowerScore(dynasty, tid, year, week)
    const norm    = normScore(ps, normCtx)
    const trust   = Math.min(1, prof.sampleGames / 3)
    p(`${role}: ${abbr}  (${cur.wins}-${cur.losses} this season)`)
    p(`  profile sample: ${prof.rawGames} games over last ${PROFILE_SEASONS} seasons (recency-weighted = ${prof.sampleGames.toFixed(1)})`)
    p(`  weighted: win% ${prof.winPct.toFixed(3)}   pts for/g ${prof.avgFor.toFixed(1)}   pts against/g ${prof.avgAgainst.toFixed(1)}   avg diff ${sgn(prof.avgDiff)}`)
    p(`  on-field power = winPct*40 + avgDiff*3 = ${prof.winPct.toFixed(3)}*40 + ${prof.avgDiff.toFixed(1)}*3 = ${onField.toFixed(2)}`)
    if (trust < 1) {
      p(`  thin sample -> regress toward neutral 20 (trust = ${trust.toFixed(2)})`)
      p(`    power = onField*${trust.toFixed(2)} + 20*${(1 - trust).toFixed(2)} = ${ps.toFixed(2)}`)
    } else {
      p(`  power = ${ps.toFixed(2)}`)
    }
    p(`  normalized = (power - min) / range * 100 = ${norm.toFixed(2)}`)
    p('')
    return { abbr, cur, prof, ps, norm }
  }

  const home = block(homeTid, 'HOME')
  const away = block(awayTid, 'AWAY')

  // Spread (mirrors calcSpread: overall-diff blended with on-field results,
  // +3 home edge, none at neutral sites).
  const hfa         = isNeutral ? 0 : 3
  const hOvr        = teamOvr(dynasty, homeTid, year)
  const aOvr        = teamOvr(dynasty, awayTid, year)
  const onFieldEdge = (home.norm - away.norm) / 4
  const finalSpread = calcSpread(dynasty, homeTid, awayTid, year, week, normCtx, isNeutral)
  const absSp       = Math.abs(finalSpread)
  const homeFav     = finalSpread > 0
  const { favML, dogML } = spreadToML(absSp)

  p('SPREAD')
  if (hOvr != null && aOvr != null) {
    const played = Math.min(home.prof.sampleGames, away.prof.sampleGames)
    const w      = Math.min(1, played / 6)
    const ovrEdge = (hOvr - aOvr) * OVR_SPREAD_PER
    p(`  both teams rated -> overall drives it early, on-field takes over as games play`)
    p(`  overall edge = (${hOvr} - ${aOvr}) * ${OVR_SPREAD_PER} = ${ovrEdge.toFixed(2)}`)
    p(`  on-field edge = (${home.norm.toFixed(2)} - ${away.norm.toFixed(2)})/4 = ${onFieldEdge.toFixed(2)}`)
    p(`  blend (games played min ${played.toFixed(1)} -> weight ${w.toFixed(2)} on-field) + homeField(${hfa})`)
  } else {
    p(`  raw = (homeNorm - awayNorm)/4 + homeField(${hfa})${isNeutral ? '  [neutral site: no home edge]' : ''}`)
    p(`      = (${home.norm.toFixed(2)} - ${away.norm.toFixed(2)})/4 + ${hfa}`)
  }
  p(`  clamp[-28,28], round 0.5 -> ${finalSpread}`)
  p(`  ${finalSpread === 0 ? 'pick\'em' : `${(homeFav ? home.abbr : away.abbr)} favored by ${absSp}`}`)
  p('')

  p('MONEYLINE  (spread->ML table, interpolated)')
  p(`  favorite ${favML}   underdog ${dogML}`)
  p(`  ${home.abbr} ${homeFav ? favML : dogML}    ${away.abbr} ${homeFav ? dogML : favML}`)
  p('')

  const t = calcTotal(dynasty, homeTid, awayTid, year, week)
  const expHome = (home.prof.avgFor + away.prof.avgAgainst) / 2
  const expAway = (away.prof.avgFor + home.prof.avgAgainst) / 2
  p('TOTAL  (each offense vs the other defense, weighted profiles)')
  p(`  ${home.abbr} exp = (off ${home.prof.avgFor.toFixed(1)} + ${away.abbr} def ${away.prof.avgAgainst.toFixed(1)}) / 2 = ${expHome.toFixed(1)}`)
  p(`  ${away.abbr} exp = (off ${away.prof.avgFor.toFixed(1)} + ${home.abbr} def ${home.prof.avgAgainst.toFixed(1)}) / 2 = ${expAway.toFixed(1)}`)
  p(`  total = (${expHome.toFixed(1)} + ${expAway.toFixed(1)}) * 1.03 = ${((expHome + expAway) * 1.03).toFixed(2)} -> O ${t.total} (${t.overVig})  U ${t.total} (${t.underVig})`)
  p('')

  p('WIN TOTALS')
  for (const [tid, abbr] of [[homeTid, home.abbr], [awayTid, away.abbr]]) {
    const wt = calcWinTotal(dynasty, tid, year)
    p(`  ${abbr}: line ${wt.total}  (over ${wt.overML} / under ${wt.underML})  [${wt.wins}-${wt.losses} so far]`)
  }
  p('')

  p('CHAMPIONSHIP INPUT  (champ score = power*0.6 + currentWin%*100*0.4)')
  for (const info of [home, away]) {
    const cs = info.ps * 0.6 + info.cur.winPct * 100 * 0.4
    p(`  ${info.abbr}: ${info.ps.toFixed(2)}*0.6 + ${(info.cur.winPct * 100).toFixed(1)}*0.4 = ${cs.toFixed(2)}`)
  }

  return L.join('\n')
}

// ─── Shared line rendering (Game Lines board + single-game Odds) ─────────────

// Build the line + result for one game, deterministically from data through its
// own week. `normCtx` is the league power normalization for that week.
function buildMatchup(dynasty, g, year, week, normCtx) {
  const tid1      = Number(g.team1Tid)
  const tid2      = Number(g.team2Tid)
  const isNeutral = g.homeTeamTid == null
  const homeTid   = g.homeTeamTid != null ? Number(g.homeTeamTid) : tid1
  const awayTid   = homeTid === tid1 ? tid2 : tid1

  const spreadVal = calcSpread(dynasty, homeTid, awayTid, year, week, normCtx, isNeutral)
  const absSp = Math.abs(spreadVal)
  const { favML, dogML } = spreadToML(absSp)
  const homeFav = spreadVal > 0

  const homeSpreadDisplay = spreadVal === 0 ? 'PK' : homeFav ? fmt(-absSp) : fmt(absSp)
  const awaySpreadDisplay = spreadVal === 0 ? 'PK' : homeFav ? fmt(absSp) : fmt(-absSp)
  const homeML = homeFav ? favML : dogML
  const awayML = homeFav ? dogML : favML
  const totalData = calcTotal(dynasty, homeTid, awayTid, year, week)

  const homeScore = Number(homeTid === tid1 ? g.team1Score : g.team2Score)
  const awayScore = Number(awayTid === tid1 ? g.team1Score : g.team2Score)
  const isPlayed = (g.isPlayed || Number(g.team1Score) > 0 || Number(g.team2Score) > 0)
    && Number.isFinite(homeScore) && Number.isFinite(awayScore)

  let result = null
  if (isPlayed) {
    const margin = homeScore - awayScore
    const cover = margin + (homeFav ? -absSp : absSp)
    const combined = homeScore + awayScore
    result = {
      spread: cover > 0 ? 'home' : cover < 0 ? 'away' : 'push',
      ml: margin > 0 ? 'home' : margin < 0 ? 'away' : 'push',
      total: combined > totalData.total ? 'over' : combined < totalData.total ? 'under' : 'push',
    }
  }

  return {
    id: g.id,
    homeTid, awayTid, isNeutral, isPlayed, homeScore, awayScore, result,
    homeName: getTeamName(dynasty, homeTid),
    awayName: getTeamName(dynasty, awayTid),
    homeSchool: getSchoolName(homeTid, dynasty?.teams) || getTeamAbbr(dynasty, homeTid),
    awaySchool: getSchoolName(awayTid, dynasty?.teams) || getTeamAbbr(dynasty, awayTid),
    homeAbbr: getTeamAbbr(dynasty, homeTid),
    awayAbbr: getTeamAbbr(dynasty, awayTid),
    homeLogo: getTeamLogo(dynasty, homeTid),
    awayLogo: getTeamLogo(dynasty, awayTid),
    homeSpreadDisplay, awaySpreadDisplay,
    homeFav, awayFav: !homeFav && spreadVal !== 0,
    homeML, awayML, totalData,
  }
}

// One odds box. Green-tinted + bold when this is the side that hit; the favorite
// otherwise gets primary text, the dog muted.
function OddsCell({ value, vig, hit }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-2 border-l border-surface-4"
      style={hit ? { background: 'color-mix(in srgb, var(--accent-success) 20%, transparent)' } : undefined}
    >
      {/* All odds render at the same weight/brightness — only a winning bet
          (hit) turns green. The favorite is NOT emphasized over the dog. */}
      <div
        className="tabular-nums text-xs"
        style={hit
          ? { color: 'var(--accent-success)', fontWeight: 800 }
          : { color: 'var(--text-primary)', fontWeight: 600 }}
      >
        {value}
      </div>
      {vig != null && <div className="text-txt-muted text-[10px] tabular-nums">{vig}</div>}
    </div>
  )
}

function LinesHeader() {
  return (
    <div className="grid grid-cols-[1fr_repeat(3,64px)] border-b border-surface-4 text-txt-muted">
      <div />
      <div className="text-center text-[10px] font-semibold uppercase tracking-wide py-1.5 border-l border-surface-4">Spread</div>
      <div className="text-center text-[10px] font-semibold uppercase tracking-wide py-1.5 border-l border-surface-4">ML</div>
      <div className="text-center text-[10px] font-semibold uppercase tracking-wide py-1.5 border-l border-surface-4">Total</div>
    </div>
  )
}

function TeamRow({ logo, name, score, isPlayed, isWinner, fav, spread, ml, ou, total, vigOver, vigUnder, spreadHit, mlHit, totalHit, top }) {
  return (
    <div className={`grid grid-cols-[1fr_repeat(3,64px)] items-stretch ${top ? '' : 'border-t border-surface-3'}`}>
      <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
        {logo
          ? <img src={logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
          : <span className="w-6 h-6 flex-shrink-0" />}
        <span className={`text-[13px] truncate ${isPlayed && isWinner ? 'text-txt-primary font-bold' : isPlayed ? 'text-txt-secondary font-semibold' : 'text-txt-primary font-semibold'}`}>{name}</span>
        {isPlayed && (
          <span
            className="ml-auto pl-2 font-display tabular-nums text-lg flex-shrink-0"
            style={{ color: isWinner ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: isWinner ? 900 : 700 }}
          >{score}</span>
        )}
      </div>
      <OddsCell value={spread} vig="-110" hit={spreadHit} />
      <OddsCell value={fmt(ml)} hit={mlHit} />
      <OddsCell value={`${ou} ${total}`} vig={ou === 'O' ? vigOver : vigUnder} hit={totalHit} />
    </div>
  )
}

// The two team rows for one matchup. Each market (spread / ML / total) lights up
// independently for the side that hit it. `compact` uses the shorter SCHOOL name
// (e.g. "Western Kentucky" instead of "Western Kentucky Hilltoppers") for the
// multi-column grid.
function MatchupRows({ m, compact }) {
  const r = m.result
  return (
    <div>
      <TeamRow
        top logo={m.awayLogo} name={compact ? m.awaySchool : m.awayName} score={m.awayScore} isPlayed={m.isPlayed}
        isWinner={r?.ml === 'away'} fav={m.awayFav} spread={m.awaySpreadDisplay} ml={m.awayML}
        ou="O" total={m.totalData.total} vigOver={fmt(m.totalData.overVig)} vigUnder={fmt(m.totalData.underVig)}
        spreadHit={r?.spread === 'away'} mlHit={r?.ml === 'away'} totalHit={r?.total === 'over'}
      />
      <TeamRow
        logo={m.homeLogo} name={compact ? m.homeSchool : m.homeName} score={m.homeScore} isPlayed={m.isPlayed}
        isWinner={r?.ml === 'home'} fav={m.homeFav} spread={m.homeSpreadDisplay} ml={m.homeML}
        ou="U" total={m.totalData.total} vigOver={fmt(m.totalData.overVig)} vigUnder={fmt(m.totalData.underVig)}
        spreadHit={r?.spread === 'home'} mlHit={r?.ml === 'home'} totalHit={r?.total === 'under'}
      />
    </div>
  )
}

// ─── Sub-panel: Game Lines ────────────────────────────────────────────────────

function GameLinesPanel({ dynasty, game, pathPrefix, gameFilter }) {
  const year = game?.year
  const week = game?.week

  const matchups = useMemo(() => {
    if (!dynasty?.games || week == null) return []
    const normCtx = buildNormSpreadContext(dynasty, year, week)
    return dynasty.games
      .filter(g => {
        if (Number(g.year) !== Number(year)) return false
        if (g.week == null || Number(g.week) !== Number(week)) return false
        if (isFCSTeam(dynasty, g.team1Tid) || isFCSTeam(dynasty, g.team2Tid)) return false
        // Page-level filter (all / top25 / rivalries / conference) — same as Scores.
        if (gameFilter && !gameFilter(g)) return false
        return true
      })
      .map(g => buildMatchup(dynasty, g, year, week, normCtx))
  }, [dynasty, year, week, gameFilter])

  if (week == null) {
    return <p className="text-txt-tertiary text-sm px-4 py-6 text-center">Game lines are available for regular season games only.</p>
  }
  if (matchups.length === 0) {
    return <p className="text-txt-tertiary text-sm px-4 py-6 text-center">No matchups found for Week {week}.</p>
  }

  return (
    <div className="px-2 sm:px-3 pb-3 pt-2">
      {/* Responsive multi-column grid — each card is self-contained (its own
          Spread/ML/Total header) so it reads correctly in any column. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
        {matchups.map(m => {
          const card = (
            <div className="rounded-lg border border-surface-4 overflow-hidden bg-surface-1 hover:bg-surface-2/50 transition-colors shadow-sm h-full">
              <LinesHeader />
              <MatchupRows m={m} compact />
            </div>
          )
          return pathPrefix && m.id
            ? <Link key={m.id} to={`${pathPrefix}/game/${m.id}`} className="block">{card}</Link>
            : <div key={m.id}>{card}</div>
        })}
      </div>
    </div>
  )
}

// ─── Shared odds row list ─────────────────────────────────────────────────────

// One futures row — logo + Team Name + record → odds, matching the Game Lines
// card style. Linkable to the team's page.
// One futures row in the Top-25 leaderboard treatment: full team-color
// background, logo in a white circle, school name in the contrast color, then
// record + odds on the right. Linkable to the team page.
function FutureRow({ row, dynasty, year, pathPrefix, rank, record, oddsFor, top }) {
  const tid     = row.tid
  const teams   = dynasty?.teams
  const mascot  = getTeamName(dynasty, tid)
  const school  = getSchoolName(tid, teams) || mascot
  const logo    = getTeamLogo(dynasty, tid)
  const colors  = (mascot ? getTeamColors(mascot, teams) : null) || { primary: '#3a3d47' }
  const primary = colors.primary || '#3a3d47'
  const txt     = getContrastTextColor(primary, colors.secondary)

  const inner = (
    <div
      className="group relative flex items-center gap-3 px-3 sm:px-4 py-2.5 overflow-hidden transition-all hover:brightness-110"
      style={{
        borderTop: top ? 'none' : '1px solid rgba(0,0,0,0.3)',
        backgroundColor: primary,
        backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.34) 100%)',
      }}
    >
      {rank != null && (
        <span className="w-5 text-right font-display font-black tabular-nums flex-shrink-0 leading-none"
          style={{ color: txt, opacity: 0.8, fontSize: 15, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>{rank}</span>
      )}
      <div className="rounded-full bg-white flex items-center justify-center p-1 flex-shrink-0 shadow-sm" style={{ width: 34, height: 34 }}>
        {logo
          ? <img src={logo} alt="" className="w-full h-full object-contain" />
          : <span className="font-display font-black text-xs" style={{ color: primary }}>{(getTeamAbbr(dynasty, tid) || '?').charAt(0)}</span>}
      </div>
      <span className="flex-1 min-w-0 truncate font-display font-bold uppercase tracking-tight leading-none"
        style={{ color: txt, fontSize: '0.95rem', letterSpacing: '0.01em', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{school}</span>
      {record && (
        <span className="tabular-nums flex-shrink-0 font-display font-semibold"
          style={{ color: txt, opacity: 0.85, fontSize: 12, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>{record}</span>
      )}
      <span className="flex-shrink-0 pl-1">{oddsFor(row, txt)}</span>
    </div>
  )
  return pathPrefix
    ? <Link to={`${pathPrefix}/team/${tid}/${year}`} className="block">{inner}</Link>
    : inner
}

function FuturesList({ rows, dynasty, year, pathPrefix, ranked = true, recordFor, oddsFor }) {
  if (!rows.length) {
    return <p className="text-txt-tertiary text-sm px-4 py-6 text-center">No team data available.</p>
  }
  return (
    <div className="rounded-xl overflow-hidden border border-surface-4 shadow-sm">
      {rows.map((r, i) => (
        <FutureRow
          key={r.tid}
          row={r}
          dynasty={dynasty}
          year={year}
          pathPrefix={pathPrefix}
          rank={ranked ? i + 1 : null}
          record={recordFor ? recordFor(r) : null}
          oddsFor={oddsFor}
          top={i === 0}
        />
      ))}
    </div>
  )
}

// Futures price (e.g. +1100) drawn in the row's contrast color, bold.
function championOdds(odds, txt) {
  if (odds >= 100000) return <span className="font-display text-[11px] font-bold" style={{ color: txt, opacity: 0.6 }}>ELIM</span>
  return (
    <span
      className="inline-flex items-center justify-center rounded-md px-3 py-1.5 font-display tabular-nums text-sm font-black"
      style={{ color: txt, minWidth: 66, background: 'rgba(0,0,0,0.26)', border: '1px solid rgba(255,255,255,0.16)', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
    >
      {fmt(odds)}
    </span>
  )
}

// Conference sub-filter pills (shown only when the page-level filter is All FBS).
function ConfPills({ confs, active, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {confs.map(c => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors ${
            c === active ? 'text-txt-primary bg-surface-3' : 'text-txt-tertiary hover:text-txt-primary hover:bg-surface-3'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

// ─── Sub-panel: National Championship ────────────────────────────────────────

function NatlChampPanel({ dynasty, game, pathPrefix, teamFilter }) {
  const year = game?.year
  const week = game?.week ?? 17

  const rows = useMemo(() => {
    let r = buildNatlChampBoard(dynasty, year, week)
    if (teamFilter) r = r.filter(x => teamFilter(x.tid))
    return r
  }, [dynasty, year, week, teamFilter])

  return (
    <div className="px-2 sm:px-3 py-3">
      <FuturesList
        rows={rows} dynasty={dynasty} year={year} pathPrefix={pathPrefix}
        recordFor={r => recordStr(r.stats, r.conf)}
        oddsFor={(r, txt) => championOdds(r.odds, txt)}
      />
    </div>
  )
}

// ─── Sub-panel: Conference Championship ──────────────────────────────────────

// Independents don't play for a conference title, so they have no champ board.
export function isChampConference(c) {
  return !!c && !/independ/i.test(String(c))
}

function ConfChampPanel({ dynasty, game, pathPrefix, customConfs, controlledConf }) {
  const year  = game?.year
  const week  = game?.week ?? 17
  const teams = dynasty?.teams || {}

  const conferences = useMemo(() => {
    const confSet = new Set()
    Object.keys(teams).forEach(tid => {
      const abbr = teams[tid]?.abbr
      if (!abbr || isFCSPlaceholderAbbr(abbr)) return
      const c = teamConf(dynasty, tid, customConfs)
      if (c && isChampConference(c)) confSet.add(c)
    })
    return Array.from(confSet).sort()
  }, [dynasty, teams, customConfs])

  const [activeConf, setActiveConf] = useState('')
  // The conference comes from the page header (controlledConf); fall back to the
  // in-panel pills only if the parent doesn't drive it.
  const conf = controlledConf
    || (conferences.includes(activeConf) ? activeConf : (conferences[0] || ''))
  const showPills = !controlledConf

  const confTeams = useMemo(() => {
    if (!conf) return []
    return Object.keys(teams).map(Number)
      .filter(tid => {
        const abbr = teams[tid]?.abbr
        if (!abbr || isFCSPlaceholderAbbr(abbr)) return false
        return teamConf(dynasty, tid, customConfs) === conf
      })
      .map(tid => teams[tid]?.abbr).filter(Boolean)
  }, [dynasty, conf, teams, customConfs])

  const rows = useMemo(
    () => buildConfChampBoard(dynasty, year, week, confTeams),
    [dynasty, year, week, confTeams]
  )

  if (conferences.length === 0) {
    return <p className="text-txt-tertiary text-sm px-4 py-6 text-center">No conference data available.</p>
  }
  // Page filter set to Independent (or similar): there's no championship to price.
  if (!isChampConference(conf)) {
    return <p className="text-txt-tertiary text-sm px-4 py-6 text-center">Independents don&apos;t play for a conference championship.</p>
  }

  return (
    <div className="px-2 sm:px-3 py-3">
      {showPills && <ConfPills confs={conferences} active={conf} onPick={setActiveConf} />}
      <FuturesList
        rows={rows} dynasty={dynasty} year={year} pathPrefix={pathPrefix}
        recordFor={r => recordStr(r.stats, r.conf)}
        oddsFor={(r, txt) => championOdds(r.odds, txt)}
      />
    </div>
  )
}

// ─── Sub-panel: Win Totals ────────────────────────────────────────────────────

function WinTotalsPanel({ dynasty, game, pathPrefix, customConfs, teamFilter, controlledConf }) {
  const year  = game?.year
  const teams = dynasty?.teams || {}
  const [internalConf, setInternalConf] = useState('ALL')
  // Conference comes from the page header (controlledConf, with an ALL option);
  // fall back to in-panel pills only if the parent doesn't drive it.
  const activeConf = controlledConf || internalConf

  const allConfs = useMemo(() => {
    const confs = new Set()
    Object.keys(teams).forEach(tid => {
      const c = teamConf(dynasty, tid, customConfs)
      if (c) confs.add(c)
    })
    return ['ALL', ...Array.from(confs).sort()]
  }, [dynasty, teams, customConfs])

  const rows = useMemo(() =>
    Object.keys(teams).map(Number)
      .filter(tid => teams[tid]?.abbr && !isFCSPlaceholderAbbr(teams[tid].abbr))
      .filter(tid => activeConf === 'ALL' || teamConf(dynasty, tid, customConfs) === activeConf)
      .filter(tid => !teamFilter || teamFilter(tid))
      .map(tid => ({ tid, ...calcWinTotal(dynasty, tid, year), conf: calcConfStats(dynasty, tid, year) }))
      .sort((a, b) => b.total - a.total || a.tid - b.tid),
    [dynasty, year, teams, activeConf, customConfs, teamFilter]
  )

  return (
    <div className="px-2 sm:px-3 py-3">
      {!controlledConf && allConfs.length > 1 && (
        <ConfPills confs={allConfs} active={activeConf} onPick={setInternalConf} />
      )}
      <FuturesList
        ranked={false}
        rows={rows} dynasty={dynasty} year={year} pathPrefix={pathPrefix}
        recordFor={r => recordStr({ wins: r.wins, losses: r.losses }, r.conf)}
        oddsFor={(r, txt) => {
          const overFav = r.overML < r.underML
          // Two stacked O / U bet buttons (favored side emphasized), like the
          // Game Lines total cell — readable as pressable odds boxes.
          const Box = ({ label, ml, fav }) => (
            <span
              className="flex items-baseline justify-between gap-2 rounded-md px-2.5 py-1 tabular-nums whitespace-nowrap"
              style={{ color: txt, width: 108, background: `rgba(0,0,0,${fav ? 0.34 : 0.2})`, border: `1px solid rgba(255,255,255,${fav ? 0.26 : 0.12})`, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              <span className="font-display font-bold text-xs">{label} {r.total}</span>
              <span className="font-display font-black text-xs" style={{ opacity: fav ? 1 : 0.85 }}>{fmt(ml)}</span>
            </span>
          )
          return (
            <span className="flex flex-col gap-1 items-end">
              <Box label="O" ml={r.overML} fav={overFav} />
              <Box label="U" ml={r.underML} fav={!overFav} />
            </span>
          )
        }}
      />
    </div>
  )
}

// ─── Single-game odds (used on the Game page) ────────────────────────────────
// Shows ONLY this game's line — spread, moneyline, total. The line is computed
// deterministically from data through the game's own week (upToWeek), so a
// resulted game always reflects its true pre-game line with no stored state.
// Once the game is played it highlights which side hit in each market.
export function GameOdds({ dynasty, game }) {
  const year = game?.year
  const week = game?.week

  const m = useMemo(() => {
    if (!dynasty || !game || week == null) return null
    const normCtx = buildNormSpreadContext(dynasty, year, week)
    return buildMatchup(dynasty, game, year, week, normCtx)
  }, [dynasty, game?.id, game?.team1Tid, game?.team2Tid, game?.homeTeamTid, game?.team1Score, game?.team2Score, year, week])

  if (!dynasty || !game) return null
  if (week == null || !m) {
    return (
      <div className="max-w-lg mx-auto rounded-xl border border-surface-4 overflow-hidden p-6 text-center text-sm text-txt-tertiary" style={{ background: 'var(--surface-1)' }}>
        Betting lines are available for regular season games only.
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto rounded-xl border border-surface-4 overflow-hidden" style={{ background: 'var(--surface-1)' }}>
      <LinesHeader />
      <MatchupRows m={m} />
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export const SPORTSBOOK_TABS = [
  { value: 'lines',        label: 'Game Lines' },
  { value: 'championship', label: 'Natl Championship' },
  { value: 'cfp',          label: 'Conf. Champ' },
  { value: 'wintotals',    label: 'Win Totals' },
]

export default function SportsbookPanel({ dynasty, game, pathPrefix, hideHeader = false, subTab, onSubTabChange, gameFilter = null, teamFilter = null, confChampConf = null, winTotalConf = null }) {
  const [internalTab, setInternalTab] = useState('lines')
  const [copied, setCopied] = useState(false)

  // Resolve custom conferences once for all sub-panels + the page-level filter.
  const customConfs = useMemo(() => {
    try { return getCustomConferencesForYear(dynasty, game?.year) }
    catch { return null }
  }, [dynasty, game?.year])

  // Controlled mode: the parent (e.g. Around the Country) renders the sub-tabs
  // itself — as a second row under its own header — and drives the selection.
  const controlled = subTab != null
  const sbTab = controlled ? subTab : internalTab
  const setSbTab = controlled ? (onSubTabChange || (() => {})) : setInternalTab

  if (!dynasty || !game) return null

  const copyDebug = async () => {
    try {
      await navigator.clipboard.writeText(buildDebugText(dynasty, game))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (rare) — fall back to a prompt the user can copy from.
      window.prompt('Copy the sportsbook debug output:', buildDebugText(dynasty, game))
    }
  }

  const year       = game.year
  const leagueName = dynasty.leagueName || 'CFB'

  const tabs = SPORTSBOOK_TABS

  return (
    <div
      className={`${sbTab === 'lines' ? 'w-full' : 'max-w-lg'} mx-auto ${hideHeader ? 'overflow-hidden' : 'mt-4 rounded-xl border border-surface-4 overflow-hidden'}`}
      style={hideHeader ? undefined : { background: 'var(--surface-1)' }}
    >
      {/* Header — hidden when embedded (e.g. the Around the Country page, where
          the sub-tabs read as a second row under that page's own tabs). */}
      {!hideHeader && (
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-surface-4">
          <div className="min-w-0">
            <h2 className="font-bold text-txt-primary m-0 text-sm">Sportsbook</h2>
            <p className="text-txt-tertiary text-xs mt-0.5 m-0">
              {leagueName} · {year} Season · Week {game.week ?? 'Post'}
            </p>
          </div>
          {/* Dev-only: copies a full step-by-step breakdown of how this game's
              spread / ML / total / futures are computed. */}
          {import.meta.env.DEV && game?.id && (
            <button
              onClick={copyDebug}
              className="text-[10px] px-2 py-1 rounded border border-surface-4 text-txt-muted hover:text-txt-secondary transition-colors"
              title="Copy how this game's odds are computed"
            >
              {copied ? 'Copied' : 'Copy Debug'}
            </button>
          )}
        </div>
      )}

      {/* Sub-tabs — only rendered here when NOT controlled by a parent header. */}
      {!controlled && (
        <div className="flex items-center overflow-x-auto no-scrollbar border-b border-surface-4">
          {tabs.map(tab => {
            const active = sbTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setSbTab(tab.value)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors whitespace-nowrap border-b-2 ${
                  active
                    ? 'text-txt-primary bg-surface-2'
                    : 'text-txt-tertiary hover:text-txt-primary hover:bg-surface-2/50 border-transparent'
                }`}
                style={active ? { borderBottomColor: 'var(--text-primary)' } : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {sbTab === 'lines'        && <GameLinesPanel   dynasty={dynasty} game={game} pathPrefix={pathPrefix} gameFilter={gameFilter} />}
      {sbTab === 'championship' && <NatlChampPanel   dynasty={dynasty} game={game} pathPrefix={pathPrefix} teamFilter={teamFilter} />}
      {sbTab === 'cfp'          && <ConfChampPanel   dynasty={dynasty} game={game} pathPrefix={pathPrefix} customConfs={customConfs} controlledConf={confChampConf} />}
      {sbTab === 'wintotals'    && <WinTotalsPanel   dynasty={dynasty} game={game} pathPrefix={pathPrefix} customConfs={customConfs} teamFilter={teamFilter} controlledConf={winTotalConf} />}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-surface-4 text-[10px] text-txt-muted text-center">
        Simulated odds for entertainment only · Not real wagering
      </div>
    </div>
  )
}
