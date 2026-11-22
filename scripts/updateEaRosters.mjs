#!/usr/bin/env node
// Refreshes the built-in CFB 27 rosters (src/data/cfb27Rosters) from EA's
// public ratings pages when EA has published a newer ratings update.
//
//   npm run rosters:update                    check, and update if EA has something newer
//   npm run rosters:update -- --force         re-pull even if we already have EA's latest
//   npm run rosters:update -- --bump-version  also set MANUAL_BUILD in vite.config.js
//   npm run rosters:update -- --pull 1-base --out <file>
//                                             only download one ratings week (here
//                                             launch) to a file; touches nothing
//
// The last line printed is `RESULT {json}`. Exit codes:
//   0  rosters updated (files written, checks passed)
//   10 nothing new from EA - no files touched
//   1  failed - any roster files it wrote have been put back
//
// EA's pages are fetched one at a time, a second apart, with curl (which
// follows HTTPS_PROXY where Node's fetch does not). Each page embeds 100
// players in its __NEXT_DATA__ script, and always shows EA's newest ratings.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROSTER_DIR = 'src/data/cfb27Rosters'
const PAGE_URL = 'https://www.ea.com/games/ea-sports-college-football/ratings?page='
const argv = process.argv.slice(2)
const flags = new Set(argv)
const argOf = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const finish = (code, result) => {
  console.log('RESULT ' + JSON.stringify(result))
  process.exit(code)
}
const fail = (reason, extra = {}) => finish(1, { status: 'failed', reason, ...extra })

// --- what we ship now ------------------------------------------------------
const readRosters = () =>
  readdirSync(ROSTER_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(ROSTER_DIR, f), 'utf8')))

const pullOnly = argOf('--pull')
const dirty = pullOnly ? '' : execFileSync('git', ['status', '--porcelain', ROSTER_DIR]).toString().trim()
if (dirty) fail(`${ROSTER_DIR} has uncommitted changes; commit or discard them first`)

const before = readRosters()
const counts = new Map()
for (const r of before) counts.set(r.sourceIteration, (counts.get(r.sourceIteration) || 0) + 1)
const current = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null

// Launch ratings are week 0; anything else without a week number can't be
// ordered, so it only has to differ from what we have.
const weekOf = (id) => (id === '1-base' ? 0 : Number(/week-(\d+)/.exec(id || '')?.[1] ?? NaN))

// --- EA --------------------------------------------------------------------
async function fetchPage(n, iteration) {
  let last = ''
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const url = PAGE_URL + n + (iteration ? `&iteration=${encodeURIComponent(iteration)}` : '')
      const html = execFileSync('curl', ['-sS', '--fail', '-m', '45', '-A', 'Mozilla/5.0', url], {
        maxBuffer: 64 * 1024 * 1024,
      }).toString()
      const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
      if (!m) throw new Error('no __NEXT_DATA__ on the page (EA may have changed the site)')
      const rd = JSON.parse(m[1])?.props?.pageProps?.ratingDetails
      if (!rd || !Array.isArray(rd.items)) throw new Error('no ratingDetails.items on the page (EA may have changed the site)')
      return rd
    } catch (e) {
      last = String(e.message || e).split('\n')[0]
      console.warn(`page ${n}: attempt ${attempt} failed - ${last}`)
      await sleep(5000 * attempt)
    }
  }
  fail(`could not read EA ratings page ${n}: ${last}`)
}

// Every player in one ratings week, page by page, a second apart.
async function pullAll(first, iterationId) {
  const total = first.totalItems
  const byId = new Map(first.items.map((p) => [p.id, p]))
  for (let page = 2; byId.size < total; page++) {
    await sleep(1000)
    const rd = await fetchPage(page, pullOnly)
    if (!rd.items.length) break
    for (const p of rd.items) byId.set(p.id, p)
    if (page % 10 === 0) console.log(`  ${byId.size} / ${total}`)
    if (page > 400) break // runaway guard
  }
  const pulled = [...byId.values()]
  const mixed = [...new Set(pulled.map((p) => p.iteration?.id))].filter((id) => id !== iterationId)
  if (mixed.length) fail(`EA switched ratings mid-pull (${iterationId} and ${mixed.join(', ')}); run again`)
  if (pulled.length < total * 0.98) fail(`pulled only ${pulled.length} of ${total} players`)
  return pulled
}

const first = await fetchPage(1, pullOnly)
const latest = first.items[0]?.iteration
if (pullOnly) {
  if (latest?.id !== pullOnly) fail(`EA served ${latest?.id} when asked for ${pullOnly}`)
  const out = argOf('--out') || `ea-cfb-ratings-${pullOnly}.json`
  const items = await pullAll(first, pullOnly)
  writeFileSync(out, JSON.stringify(items))
  finish(0, { status: 'pulled', iteration: pullOnly, label: latest.label, players: items.length, out })
}
if (!latest?.id) fail('EA page 1 has no players with an iteration id')
console.log(`EA's newest ratings: ${latest.id} (${latest.label}); we ship: ${current}`)

if (!flags.has('--force')) {
  if (latest.id === current) finish(10, { status: 'no-update', current, latest: latest.id })
  if (weekOf(latest.id) < weekOf(current)) {
    finish(10, { status: 'no-update', current, latest: latest.id, note: 'EA is showing older ratings than we ship' })
  }
}

const pulled = await pullAll(first, latest.id)

const work = mkdtempSync(join(tmpdir(), 'ea-ratings-'))
const input = join(work, `ea-cfb-ratings-${latest.id}.json`)
const summaryPath = join(work, 'summary.json')
writeFileSync(input, JSON.stringify(pulled))
console.log(`pulled ${pulled.length} players -> ${input}`)

// --- convert + check -------------------------------------------------------
const restore = () => execFileSync('git', ['checkout', '--', ROSTER_DIR])
try {
  execFileSync('node', ['scripts/convertEaRatings.mjs', '--input', input, '--summary', summaryPath], { stdio: 'inherit' })
} catch {
  restore()
  fail('the converter stopped (see its output above, e.g. an EA team it could not match)')
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
const after = readRosters()
const weights = after.flatMap((r) => r.players.map((p) => p.weight)).filter(Number.isFinite).sort((a, b) => a - b)
const medianWeight = weights[Math.floor(weights.length / 2)]
const problems = []
if (summary.teams < 130) problems.push(`only ${summary.teams} teams matched`)
if (summary.overCap.length) problems.push(`over 85 players: ${summary.overCap.map((t) => `${t.teamName} ${t.players}`).join(', ')}`)
if (summary.after < summary.before * 0.95) problems.push(`players fell from ${summary.before} to ${summary.after}`)
if (summary.minTeam < 60) problems.push(`a team dropped to ${summary.minTeam} players`)
if (!(medianWeight >= 180 && medianWeight <= 260)) problems.push(`median weight is ${medianWeight} lbs`)
if (problems.length) {
  restore()
  fail('the new rosters failed checks, nothing kept: ' + problems.join('; '))
}

// --- what changed ----------------------------------------------------------
const keyOf = (p) => (p.eaId != null ? `ea:${p.eaId}` : `n:${String(p.name).toLowerCase().replace(/[^a-z]/g, '')}`)
const nameKey = (p) => `n:${String(p.name).toLowerCase().replace(/[^a-z]/g, '')}`
let added = 0
let removed = 0
let moved = 0
let rerated = 0
const beforeByTid = new Map(before.map((r) => [r.tid, r.players]))
for (const r of after) {
  const old = beforeByTid.get(r.tid) || []
  const oldIdx = new Map()
  for (const p of old) {
    oldIdx.set(keyOf(p), p)
    oldIdx.set(nameKey(p), p)
  }
  const seen = new Set()
  for (const p of r.players) {
    const q = oldIdx.get(keyOf(p)) || oldIdx.get(nameKey(p))
    if (!q) { added++; continue }
    seen.add(q)
    if (q.position !== p.position) moved++
    if (q.overall !== p.overall) rerated++
  }
  removed += old.filter((q) => !seen.has(q)).length
}

let version = null
if (flags.has('--bump-version')) {
  const today = new Date().toISOString().slice(0, 10)
  const headDay = execFileSync('git', ['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d'], {
    env: { ...process.env, TZ: 'UTC' },
  }).toString().trim()
  const cfg = readFileSync('vite.config.js', 'utf8')
  const cur = /const MANUAL_BUILD = '(\d+)'/.exec(cfg)?.[1]
  if (!cur) fail('could not find MANUAL_BUILD in vite.config.js')
  const next = headDay === today ? String(Number(cur) + 1).padStart(4, '0') : '0001'
  writeFileSync('vite.config.js', cfg.replace(/const MANUAL_BUILD = '\d+'/, `const MANUAL_BUILD = '${next}'`))
  version = `${today.replace(/-/g, '.')}.${next}`
}

finish(0, {
  status: 'updated',
  from: current,
  to: latest.id,
  label: latest.label,
  teams: summary.teams,
  players: { before: summary.before, after: summary.after },
  added,
  removed,
  positionChanges: moved,
  ratingChanges: rerated,
  version,
})
