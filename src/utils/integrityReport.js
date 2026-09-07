// Read-only dynasty integrity report.
//
// zengm ships debug tools that walk the league and report what's wrong
// (worker/core/debug). Ours is the same idea for a dynasty document: every
// check here is a data shape that has produced a real user report in this
// codebase, so running this before a season flip, or on a backup someone
// sends in, surfaces the problem before the symptom does.
//
// Pure and side-effect free. Returns { sections: [{ key, title, count,
// severity, items: [string] }], summary }. Items are capped per section so a
// 9,000-player dynasty can't produce a wall of text; `count` is always the
// full number.

import { PER_YEAR_FIELDS, PER_TEAM_YEAR_FIELDS } from '../services/seasonSubcollection'
import { normalizeLeavingReason } from './leavingReason'

const MAX_ITEMS = 25
const isYearKey = (k) => Number.isFinite(Number(k)) && Number(k) > 1900 && Number(k) < 2200
const label = (p) => `${p?.name || '(unnamed)'} [pid ${p?.pid ?? '?'}]`

function section(key, title, severity, items, count = items.length) {
  return { key, title, severity, count, items: items.slice(0, MAX_ITEMS) }
}

export function buildIntegrityReport(dynasty) {
  const players = Array.isArray(dynasty?.players) ? dynasty.players : []
  const currentYear = Number(dynasty?.currentYear)
  const sections = []

  // 1. Duplicate pids — the root of "the wrong player got the movement".
  {
    const seen = new Map()
    const dupes = []
    for (const p of players) {
      if (p?.pid == null) continue
      const k = String(p.pid)
      if (seen.has(k)) dupes.push(`pid ${k}: "${seen.get(k)}" and "${p.name}"`)
      else seen.set(k, p.name)
    }
    const noPid = players.filter(p => p && p.pid == null).length
    const items = [...dupes]
    if (noPid) items.unshift(`${noPid} player record(s) with no pid at all`)
    sections.push(section('duplicatePids', 'Duplicate or missing player ids', 'error', items, dupes.length + (noPid ? 1 : 0)))
  }

  // 2. Null roster slots — the pre-08-27 transfer strand (player on NO team).
  {
    const items = []
    for (const p of players) {
      for (const [y, v] of Object.entries(p?.teamsByYear || {})) {
        if (v === null) items.push(`${label(p)} teamsByYear[${y}] is null`)
      }
    }
    sections.push(section('nullRosterSlots', 'Players stranded on no team (null roster year)', 'error', items))
  }

  // 3. Non-numeric year keys — the seasonal router silently DISCARDS these on write.
  {
    const items = []
    const maps = ['teamsByYear', 'classByYear', 'overallByYear', 'devTraitByYear', 'movementByYear', 'statsByYear', 'attributesByYear']
    for (const p of players) {
      for (const m of maps) {
        for (const k of Object.keys(p?.[m] || {})) {
          if (!isYearKey(k)) items.push(`${label(p)} ${m} has key "${k}"`)
        }
      }
    }
    for (const f of PER_YEAR_FIELDS) {
      for (const k of Object.keys(dynasty?.[f] || {})) {
        if (!isYearKey(k)) items.push(`dynasty.${f} has key "${k}"`)
      }
    }
    for (const f of PER_TEAM_YEAR_FIELDS) {
      for (const [teamKey, byYear] of Object.entries(dynasty?.[f] || {})) {
        for (const k of Object.keys(byYear || {})) {
          if (!isYearKey(k)) items.push(`dynasty.${f}[${teamKey}] has key "${k}"`)
        }
      }
    }
    sections.push(section('badYearKeys', 'Non-year keys in per-year data (dropped silently on save)', 'error', items))
  }

  // 4. Generic portal stubs — a departure with no destination and no reason.
  {
    const items = []
    for (const p of players) {
      for (const [y, m] of Object.entries(p?.movementByYear || {})) {
        if (m?.type === 'departure' && m.departure === 'transfer_out' && m.toTid == null && !m.reason) {
          items.push(`${label(p)} ${y}: in the portal, no destination, no reason`)
        }
      }
    }
    sections.push(section('portalStubs', 'Portal entries with no destination or reason', 'warn', items))
  }

  // 5. Mirror drift — top-level team/class/overall disagree with this year's map.
  if (Number.isFinite(currentYear)) {
    const items = []
    for (const p of players) {
      const t = p?.teamsByYear?.[currentYear] ?? p?.teamsByYear?.[String(currentYear)]
      if (t != null && p.team != null && Number(t) !== Number(p.team)) items.push(`${label(p)} team=${p.team} but teamsByYear[${currentYear}]=${t}`)
      const c = p?.classByYear?.[currentYear] ?? p?.classByYear?.[String(currentYear)]
      if (c && p.year && String(c) !== String(p.year)) items.push(`${label(p)} year=${p.year} but classByYear[${currentYear}]=${c}`)
    }
    sections.push(section('mirrorDrift', `Top-level fields out of sync with ${currentYear} maps`, 'warn', items))
  }

  // 6. Leaving rows that never matched a player (saved with a null pid).
  {
    const items = []
    for (const [y, rows] of Object.entries(dynasty?.playersLeavingByYear || {})) {
      for (const r of rows || []) {
        if (r && r.pid == null) items.push(`${y}: "${r.playerName}" (${r.reason || 'no reason'}) matched no roster player`)
        else if (r && r.reason && normalizeLeavingReason(r.reason) !== r.reason) items.push(`${y}: "${r.playerName}" reason "${r.reason}" is not canonical`)
      }
    }
    sections.push(section('leavingRows', 'Players Leaving rows that did not apply', 'warn', items))
  }

  // 7. Duplicate games — same season, week, type, and team pair.
  {
    const games = Array.isArray(dynasty?.games) ? dynasty.games : []
    const seen = new Map()
    const items = []
    for (const g of games) {
      if (!g || g.team1Tid == null || g.team2Tid == null) continue
      const a = Number(g.team1Tid), b = Number(g.team2Tid)
      const pair = a < b ? `${a}-${b}` : `${b}-${a}`
      const k = `${g.year}|${g.week}|${g.gameType || 'regular'}|${pair}`
      if (seen.has(k)) items.push(`${g.year} wk ${g.week} ${g.gameType || 'regular'} ${pair}: ids ${seen.get(k)} and ${g.id}`)
      else seen.set(k, g.id)
    }
    sections.push(section('duplicateGames', 'Duplicate games (same week, type, and matchup)', 'error', items))
  }

  // 8. Roster players this year with no class recorded for this year.
  if (Number.isFinite(currentYear)) {
    const userTid = Number(dynasty?.currentTid)
    const items = []
    for (const p of players) {
      const t = p?.teamsByYear?.[currentYear] ?? p?.teamsByYear?.[String(currentYear)]
      if (t == null || Number(t) !== userTid) continue
      const c = p?.classByYear?.[currentYear] ?? p?.classByYear?.[String(currentYear)]
      if (!c && !p.year) items.push(`${label(p)} on the roster with no class`)
    }
    sections.push(section('noClass', `${currentYear} roster players with no class`, 'info', items))
  }

  const errors = sections.filter(s => s.severity === 'error' && s.count > 0).reduce((n, s) => n + s.count, 0)
  const warns = sections.filter(s => s.severity === 'warn' && s.count > 0).reduce((n, s) => n + s.count, 0)
  return {
    sections,
    summary: { players: players.length, games: Array.isArray(dynasty?.games) ? dynasty.games.length : 0, errors, warnings: warns, currentYear: Number.isFinite(currentYear) ? currentYear : null },
  }
}

/** Plain-text rendering for the Copy button / support emails. */
export function formatIntegrityReport(report, dynastyName = '') {
  const lines = []
  lines.push(`Integrity report${dynastyName ? ` — ${dynastyName}` : ''}`)
  lines.push(`players=${report.summary.players} games=${report.summary.games} year=${report.summary.currentYear ?? '?'} errors=${report.summary.errors} warnings=${report.summary.warnings}`)
  for (const s of report.sections) {
    lines.push('')
    lines.push(`[${s.severity.toUpperCase()}] ${s.title}: ${s.count}`)
    for (const it of s.items) lines.push(`  - ${it}`)
    if (s.count > s.items.length) lines.push(`  … and ${s.count - s.items.length} more`)
  }
  return lines.join('\n')
}
