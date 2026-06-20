/**
 * Social Media prompt builder.
 *
 * Produces the copy/paste prompt for the "Generate Social Feed" flow. The AI
 * returns a `cfb-social` fenced block of one-post-per-line records that the
 * parser (socialModel.resolveSocialPosts) turns into stored posts.
 *
 * Scoping matters: the character universe can be 1700+, far too many to list.
 * So the roster section is scoped per week to (a) a sample of national voices
 * and (b) the accounts of the teams actually playing this week. Any team
 * without a listed account is referenced via the beat:<ABBR> / fan:<ABBR>
 * convention and auto-instantiated by the parser.
 */

import { buildGameTagMap, getEffectiveCharacters, DEFAULT_SOCIAL_SETTINGS, DEFAULT_SOCIAL_PLATFORM } from '../data/socialModel'
import { canonicalBoxScore } from './boxScoreHelpers'
import { collapsePatRowsIntoTDs, sortPlaysChronologically } from './scoringPlayOrder'

const NATIONAL_SAMPLE_SIZE = 40

function teamLabel(dynasty, tid, fallbackAbbr) {
  const slot = dynasty?.teams?.[tid] || dynasty?.teams?.[String(tid)]
  const abbr = slot?.abbr || fallbackAbbr || ''
  const name = slot?.name || fallbackAbbr || `Team ${tid}`
  return { abbr, name }
}

function rankPrefix(rank) {
  const r = Number(rank)
  return Number.isFinite(r) && r > 0 && r <= 25 ? `#${r} ` : ''
}

// One human-readable, G-tagged line per game for the data block.
function gameLine(tag, game, dynasty) {
  const t1 = teamLabel(dynasty, game.team1Tid, game.team1)
  const t2 = teamLabel(dynasty, game.team2Tid, game.team2)
  const s1 = Number(game.team1Score)
  const s2 = Number(game.team2Score)
  const winner = s1 === s2 ? null : (s1 > s2 ? t1 : t2)
  let site = ''
  if (game.homeTeamTid == null) site = ' (neutral site)'
  else if (game.homeTeamTid === game.team2Tid) site = ` (at ${t2.abbr})`
  else site = ` (at ${t1.abbr})`
  const ot = game.ot ? ' OT' : ''
  const result = winner ? ` — ${winner.name} win` : ''
  return `[${tag}] ${rankPrefix(game.team1Rank)}${t1.name} (${t1.abbr}) ${s1}, ${rankPrefix(game.team2Rank)}${t2.name} (${t2.abbr}) ${s2}${ot}${site}${result}`
}

function charsForTeam(charactersById, tid) {
  return Object.values(charactersById || {}).filter(c => c && c.teamTid === tid)
}

function nationalSample(charactersById, n) {
  return Object.values(charactersById || {})
    .filter(c => c && c.kind === 'national')
    .sort((a, b) => (Number(b.followerCount) || 0) - (Number(a.followerCount) || 0))
    .slice(0, n)
}

function rosterLine(c) {
  const p = (c.personality || '').trim() || c.role || c.category || 'a college football account'
  return `${c.handle} — ${p}`
}

function playedGamesForWeek(dynasty, yearN, weekN) {
  return (dynasty?.games || []).filter(g => {
    if (Number(g.year) !== yearN || Number(g.week) !== weekN) return false
    const s1 = Number(g.team1Score)
    const s2 = Number(g.team2Score)
    return Number.isFinite(s1) && Number.isFinite(s2) && (s1 > 0 || s2 > 0)
  })
}

/**
 * Reproduce the deterministic TAG -> gameId map for a week. Both the prompt
 * builder and the parser call this (on the same week's games) so posts attach
 * to the right game with nothing stored.
 */
export function socialGameTagMap(dynasty, year, week) {
  const tags = buildGameTagMap(playedGamesForWeek(dynasty, Number(year), Number(week)))
  return Object.fromEntries(tags.map(t => [t.tag, t.gameId]))
}

/**
 * The reusable social section: tagged GAMES block + scoped character roster +
 * the cfb-social output contract. Embedded into the weekly recap prompt and
 * also used by the standalone Generate Social prompt.
 * Returns { section, gameTagMap, gameCount }.
 */
export function buildSocialSection(dynasty, year, week) {
  const yearN = Number(year)
  const weekN = Number(week)
  const settings = { ...DEFAULT_SOCIAL_SETTINGS, ...(dynasty?.socialSettings || {}) }
  const platform = { ...DEFAULT_SOCIAL_PLATFORM, ...(dynasty?.socialPlatform || {}) }
  const charactersById = getEffectiveCharacters(dynasty)

  const tagMap = buildGameTagMap(playedGamesForWeek(dynasty, yearN, weekN))
  const gameTagMap = Object.fromEntries(tagMap.map(t => [t.tag, t.gameId]))

  // Scope of games to post about.
  let scopedTags = tagMap
  if (settings.scope === 'user' && dynasty?.currentTid != null) {
    const myTid = Number(dynasty.currentTid)
    scopedTags = tagMap.filter(t => t.game.team1Tid === myTid || t.game.team2Tid === myTid)
  } else if (settings.scope === 'ranked') {
    scopedTags = tagMap.filter(t => rankPrefix(t.game.team1Rank) || rankPrefix(t.game.team2Rank)
      || (dynasty?.currentTid != null && (t.game.team1Tid === Number(dynasty.currentTid) || t.game.team2Tid === Number(dynasty.currentTid))))
  }

  const gameLines = scopedTags.map(t => gameLine(t.tag, t.game, dynasty)).join('\n')

  // Teams playing this week -> their accounts (or the beat/fan convention).
  const teamTids = new Set()
  for (const t of scopedTags) {
    if (t.game.team1Tid != null) teamTids.add(Number(t.game.team1Tid))
    if (t.game.team2Tid != null) teamTids.add(Number(t.game.team2Tid))
  }
  const teamRosterLines = []
  for (const tid of teamTids) {
    const accounts = charsForTeam(charactersById, tid)
    const { abbr, name } = teamLabel(dynasty, tid)
    if (accounts.length > 0) {
      for (const c of accounts) teamRosterLines.push(`${rosterLine(c)} [${abbr}]`)
    } else {
      teamRosterLines.push(`(no listed ${name} accounts — post as beat:${abbr} or fan:${abbr})`)
    }
  }

  const nationalLines = nationalSample(charactersById, NATIONAL_SAMPLE_SIZE).map(rosterLine).join('\n')
  const post = platform.postNoun || 'post'

  const section = `═══════════════════════════════════════════════════════════
SOCIAL POSTS (${platform.name}) — a SECOND output block
═══════════════════════════════════════════════════════════
${platform.name} is a fictional social media platform. Write in-character as the accounts below.
- For EACH game tag, write ${settings.postsPerGame} ${post}s from accounts that would care (the two teams' beat and fan accounts, plus an occasional national voice for notable results).
- Then write ${settings.nationalCount} national ${post}s reacting to the week overall (rankings, playoff race, standout performances).
- Match each account's personality. Keep each ${post} realistic (a sentence or two). Only react to the games/scores shown; invent nothing.

GAMES — use the bracket tag (e.g. G1) to attach a ${post} to that game:
${gameLines || '(no games this week)'}

NATIONAL VOICES (reference by @handle; write in their personality):
${nationalLines || '(none provided)'}

TEAM ACCOUNTS (reference by @handle, or beat:<ABBR> / fan:<ABBR> for any team without a listed account):
${teamRosterLines.join('\n') || '(none)'}

SOCIAL OUTPUT — a separate fenced block, one ${post} per line, exactly:
\`\`\`cfb-social
G1 | @SomeHandle | the post text here
G1 | beat:MIZ | another post about that same game
N | @AnotherHandle | a national take about the week
\`\`\`
LINE GRAMMAR: <scope> | <author> | <text>
- scope: a game tag (G1, G2, ...) to attach to that game, or N for a national post.
- author: an @handle from the lists above, OR beat:<ABBR> / fan:<ABBR> using a team abbreviation from the GAMES block.
- text: the ${post}; everything after the second | is the text, so apostrophes and punctuation are fine.
One ${post} per line. No numbering. No commentary inside the block.`

  return { section, gameTagMap, gameCount: scopedTags.length }
}

// ─── Per-game deep-dive social prompt (game editor) ───────────────────────────

const META_KEYS = new Set(['name', 'playerName', 'position', 'pos', 'pid', 'tid', 'jerseyNumber', 'jersey', 'id', 'team', 'teamTid', 'teamAbbr'])
const num = (v) => Number(v) || 0

// Player rows are grouped { passing, rushing, receiving, defense, kicking },
// each an array whose rows use `playerName` + the sheet's camelCase stat keys.
function formatPlayerRows(boxSide) {
  const lines = []
  if (!boxSide || typeof boxSide !== 'object') return lines
  for (const p of (boxSide.passing || [])) {
    const att = num(p.attempts ?? p.att); const yds = num(p.yards ?? p.yds)
    if (!att && !yds) continue
    const int = num(p.iNT ?? p.int)
    lines.push(`  ${p.playerName} (QB): ${num(p.comp ?? p.completions)}/${att} for ${yds} yds, ${num(p.tD ?? p.td)} TD${int ? `, ${int} INT` : ''}`)
  }
  for (const p of (boxSide.rushing || [])) {
    const car = num(p.carries ?? p.car); const yds = num(p.yards ?? p.yds)
    if (!car && !yds) continue
    const td = num(p.tD ?? p.td)
    lines.push(`  ${p.playerName} (RB): ${car} car, ${yds} yds${td ? `, ${td} TD` : ''}`)
  }
  for (const p of (boxSide.receiving || [])) {
    const rec = num(p.receptions ?? p.rec); const yds = num(p.yards ?? p.yds)
    if (!rec && !yds) continue
    const td = num(p.tD ?? p.td)
    lines.push(`  ${p.playerName} (WR/TE): ${rec} rec, ${yds} yds${td ? `, ${td} TD` : ''}`)
  }
  for (const p of (boxSide.defense || [])) {
    const tkl = num(p.solo) + num(p.assists) + num(p.tackles)
    const sk = num(p.sack); const int = num(p.iNT ?? p.int); const tfl = num(p.tFL ?? p.tfl); const ff = num(p.fF ?? p.ff)
    if (!tkl && !sk && !int && !tfl && !ff) continue
    const parts = []
    if (tkl) parts.push(`${tkl} tkl`)
    if (tfl) parts.push(`${tfl} TFL`)
    if (sk) parts.push(`${sk} sack`)
    if (int) parts.push(`${int} INT`)
    if (ff) parts.push(`${ff} FF`)
    lines.push(`  ${p.playerName} (DEF): ${parts.join(', ')}`)
  }
  for (const p of (boxSide.kicking || [])) {
    const fgm = num(p.fgMade ?? p.fgm); const fga = num(p.fgAtt ?? p.fga)
    if (!fgm && !fga) continue
    lines.push(`  ${p.playerName} (K): ${fgm}/${fga} FG`)
  }
  return lines
}

function dumpTeamStats(ts) {
  if (!ts || typeof ts !== 'object') return ''
  return Object.entries(ts)
    .filter(([k, v]) => !META_KEYS.has(k) && v != null && v !== '')
    .map(([k, v]) => `${k} ${v}`).join(', ')
}

// Scoring summary may be a full play log; keep only actual scoring plays and
// format them (PAT rows collapsed into their TD).
function formatScoringPlays(summary) {
  if (!Array.isArray(summary) || !summary.length) return []
  let plays
  try { plays = sortPlaysChronologically(collapsePatRowsIntoTDs(summary)) } catch { plays = summary }
  const lines = []
  for (const p of plays) {
    const st = (p?.scoreType || '').trim()
    if (!st) continue
    const q = p.quarter ? `Q${p.quarter}` : ''
    const time = p.timeLeft ? ` ${p.timeLeft}` : ''
    const team = (p.team || '').toUpperCase()
    const yds = p.yards ? ` ${p.yards} yd` : ''
    const scorer = p.scorer ? ` ${p.scorer}` : ''
    const from = p.passer ? ` from ${p.passer}` : ''
    const pat = p.patResult ? ` (${p.patResult})` : ''
    lines.push(`  ${q}${time} ${team}:${scorer}${yds} ${st}${from}${pat}`.replace(/\s+/g, ' ').trim())
  }
  return lines
}

function gameDataBlock(dynasty, game) {
  const t1 = teamLabel(dynasty, game.team1Tid, game.team1)
  const t2 = teamLabel(dynasty, game.team2Tid, game.team2)
  const s1 = Number(game.team1Score)
  const s2 = Number(game.team2Score)
  const winner = s1 === s2 ? null : (s1 > s2 ? t1 : t2)
  let site = ''
  if (game.homeTeamTid == null) site = ' (neutral site)'
  else if (game.homeTeamTid === game.team2Tid) site = ` (at ${t2.abbr})`
  else site = ` (at ${t1.abbr})`
  const ot = game.ot ? ' (OT)' : ''

  const lines = [`FINAL: ${rankPrefix(game.team1Rank)}${t1.name} (${t1.abbr}) ${s1}, ${rankPrefix(game.team2Rank)}${t2.name} (${t2.abbr}) ${s2}${ot}${site}${winner ? ` — ${winner.name} win` : ''}`]

  const bs = canonicalBoxScore(game, dynasty?.teams)
  if (bs) {
    for (const [tid, label] of [[game.team1Tid, t1.name], [game.team2Tid, t2.name]]) {
      const entry = bs.byTid?.[tid] ?? bs.byTid?.[String(tid)]
      const players = formatPlayerRows(entry)
      if (players.length) lines.push('', `${label} player stats:`, ...players)
      const ts = dumpTeamStats(bs.teamStatsByTid?.[tid] ?? bs.teamStatsByTid?.[String(tid)])
      if (ts) lines.push(`${label} team totals: ${ts}`)
    }
    const scoring = formatScoringPlays(bs.scoringSummary)
    if (scoring.length) lines.push('', 'Scoring:', ...scoring)
  }
  return lines.join('\n')
}

/** Tag map for a single game's posts (parser reproduces this). */
export function gameSocialTagMap(game) {
  return { G1: game?.id ?? null }
}

/**
 * The reusable per-game social section: deep game data + roster + the
 * cfb-social output contract (scope always G1). Embedded into the game recap
 * prompt and used by the standalone game social prompt.
 */
export function buildGameSocialSection(dynasty, game, count = 8) {
  const platform = { ...DEFAULT_SOCIAL_PLATFORM, ...(dynasty?.socialPlatform || {}) }
  const charactersById = getEffectiveCharacters(dynasty)
  const post = platform.postNoun || 'post'
  const t1 = teamLabel(dynasty, game.team1Tid, game.team1)
  const t2 = teamLabel(dynasty, game.team2Tid, game.team2)

  const teamRosterLines = []
  for (const [tid, name, abbr] of [[game.team1Tid, t1.name, t1.abbr], [game.team2Tid, t2.name, t2.abbr]]) {
    const accounts = charsForTeam(charactersById, Number(tid))
    if (accounts.length) for (const c of accounts) teamRosterLines.push(`${rosterLine(c)} [${abbr}]`)
    else teamRosterLines.push(`(no listed ${name} accounts — post as beat:${abbr} or fan:${abbr})`)
  }
  const nationalLines = nationalSample(charactersById, NATIONAL_SAMPLE_SIZE).map(rosterLine).join('\n')

  return `═══════════════════════════════════════════════════════════
SOCIAL POSTS (${platform.name}) — a SECOND output block
═══════════════════════════════════════════════════════════
${platform.name} is a fictional social media platform. Write in-character as the accounts below.
- Write ${count} ${post}s about this game. Mix the two teams' beat and fan accounts with a few national voices.
- DIG INTO THE DETAIL: reference specific players, stat lines, and scoring plays from the GAME DATA below. Invent nothing.
- Match each account's personality. Vary tone and length; keep each ${post} realistic.

GAME DATA:
${gameDataBlock(dynasty, game)}

NATIONAL VOICES (reference by @handle; write in their personality):
${nationalLines || '(none provided)'}

TEAM ACCOUNTS (reference by @handle, or beat:<ABBR> / fan:<ABBR>):
${teamRosterLines.join('\n')}

SOCIAL OUTPUT — a separate fenced block, one ${post} per line, exactly:
\`\`\`cfb-social
G1 | @SomeHandle | the post text here
G1 | beat:${t1.abbr} | another post about the game
\`\`\`
LINE GRAMMAR: <scope> | <author> | <text>
- scope: always G1 (every ${post} is about this game).
- author: an @handle from the lists above, OR beat:<ABBR> / fan:<ABBR> using ${t1.abbr} or ${t2.abbr}.
- text: the ${post}; everything after the second | is the text.
One ${post} per line. No numbering, no commentary inside the block.`
}

/**
 * Standalone deep-dive social prompt for ONE game (game social modal).
 * Returns { prompt, gameTagMap }.
 */
export function buildGameSocialPrompt(dynasty, game, { count = 8 } = {}) {
  const platform = { ...DEFAULT_SOCIAL_PLATFORM, ...(dynasty?.socialPlatform || {}) }
  const prompt = `You are generating ${platform.name} posts about ONE college football game.

${buildGameSocialSection(dynasty, game, count)}

Output ONLY the cfb-social fenced block. No preamble, no commentary.`
  return { prompt, gameTagMap: gameSocialTagMap(game) }
}

/**
 * Standalone social prompt for the heavy-run fallback button.
 * Returns { prompt, gameTagMap, gameCount }.
 */
export function buildSocialPrompt(dynasty, year, week) {
  const platform = { ...DEFAULT_SOCIAL_PLATFORM, ...(dynasty?.socialPlatform || {}) }
  const { section, gameTagMap, gameCount } = buildSocialSection(dynasty, year, week)
  const prompt = `You are generating ${platform.name} posts reacting to a week of college football results.

${section}

Output ONLY the cfb-social fenced block above. No preamble, no commentary.`
  return { prompt, gameTagMap, gameCount }
}
