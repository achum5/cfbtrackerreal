#!/usr/bin/env node
// Rebuilds the CFB 27 rosters for every EA ratings week from raw pulls:
//   src/data/cfb27Rosters/{tid}.json              the newest week, in full
//   src/data/cfb27RosterWeeks/{week}.patch.json   turns the next week's rosters
//                                                 into this week's
//   src/data/cfb27RosterWeeks/index.json          the weeks, oldest first
//
// The weekly updater keeps these current on its own; this is for starting
// over (or after changing how rosters are built). Pull each week first:
//   node scripts/updateEaRosters.mjs --pull 1-base --out <dir>/1-base.json
//   node scripts/updateEaRosters.mjs --pull cfb-ratings-week-1 --out <dir>/cfb-ratings-week-1.json
//   ...
// then:
//   node scripts/rebuildEaRosterHistory.mjs --weeks-dir <dir>
//
// Every week takes its fill-in players from the launch list (see --fill in
// convertEaRatings.mjs), and dev traits, archetypes and abilities from the
// current files. The result is checked by rebuilding every week from the
// patches and comparing it with that week's own conversion.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { diffRoster, applyRosterPatch, rosterKey } from '../src/data/rosterPatch.js'

const ROSTER_DIR = 'src/data/cfb27Rosters'
const WEEKS_DIR = 'src/data/cfb27RosterWeeks'
const argv = process.argv.slice(2)
const weeksDir = argv[argv.indexOf('--weeks-dir') + 1]
if (!argv.includes('--weeks-dir') || !weeksDir) {
  console.error('Usage: node scripts/rebuildEaRosterHistory.mjs --weeks-dir <dir of raw weekly pulls>')
  process.exit(1)
}

const weekNum = (id) => (id === '1-base' ? 0 : Number(/week-(\d+)$/.exec(id)?.[1]))
const ids = readdirSync(weeksDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((id) => Number.isFinite(weekNum(id)))
  .sort((a, b) => weekNum(a) - weekNum(b))
if (ids[0] !== '1-base') {
  console.error(`${weeksDir} needs 1-base.json (the launch ratings) - every week's fill-ins come from it`)
  process.exit(1)
}
console.log(`weeks: ${ids.join(', ')}`)

const readDir = (dir) => {
  const out = new Map()
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    out.set(j.tid, j)
  }
  return out
}

// 1. Convert every week into its own folder.
const work = mkdtempSync(join(tmpdir(), 'ea-history-'))
const launch = join(weeksDir, '1-base.json')
const rosters = new Map()
const labels = new Map()
for (const id of ids) {
  const out = join(work, id)
  mkdirSync(out)
  execFileSync('node', ['scripts/convertEaRatings.mjs', '--input', join(weeksDir, `${id}.json`), '--fill', launch, '--out-dir', out], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const teams = readDir(out)
  rosters.set(id, teams)
  labels.set(id, [...teams.values()][0]?.source?.match(/\((.*)\)$/)?.[1] || id)
  const players = [...teams.values()].reduce((s, t) => s + t.players.length, 0)
  console.log(`  ${id}: ${teams.size} teams, ${players} players`)
}

// 2. Patches, newest back to launch.
const latest = ids[ids.length - 1]
const patches = new Map()
for (let i = ids.length - 2; i >= 0; i--) {
  const newer = rosters.get(ids[i + 1])
  const older = rosters.get(ids[i])
  const teams = {}
  for (const tid of new Set([...newer.keys(), ...older.keys()])) {
    const patch = diffRoster(newer.get(tid)?.players || [], older.get(tid)?.players || [])
    if (Object.keys(patch).length) teams[tid] = patch
  }
  patches.set(ids[i], { iteration: ids[i], label: labels.get(ids[i]), from: ids[i + 1], teams })
}

// 3. Check: every week rebuilt from the newest plus its patches matches.
const canon = (players) => JSON.stringify([...players].map((p) => [rosterKey(p), p]).sort((a, b) => (a[0] < b[0] ? -1 : 1)))
let current = new Map([...rosters.get(latest)].map(([tid, t]) => [tid, t.players]))
for (let i = ids.length - 2; i >= 0; i--) {
  const patch = patches.get(ids[i])
  const next = new Map()
  for (const [tid, players] of current) next.set(tid, applyRosterPatch(players, patch.teams[tid]))
  for (const [tid, t] of rosters.get(ids[i])) {
    if (canon(next.get(tid) || []) !== canon(t.players)) {
      console.error(`MISMATCH: ${ids[i]} team ${tid} rebuilt from patches differs from its conversion`)
      process.exit(1)
    }
  }
  current = next
}
console.log('check: every week rebuilds exactly from the patches')

// 4. Write.
for (const f of readdirSync(ROSTER_DIR).filter((f) => f.endsWith('.json'))) rmSync(join(ROSTER_DIR, f))
for (const [tid, t] of rosters.get(latest)) writeFileSync(join(ROSTER_DIR, `${tid}.json`), JSON.stringify(t))
if (existsSync(WEEKS_DIR)) rmSync(WEEKS_DIR, { recursive: true })
mkdirSync(WEEKS_DIR)
let bytes = 0
for (const [id, patch] of patches) {
  const json = JSON.stringify(patch)
  bytes += json.length
  writeFileSync(join(WEEKS_DIR, `${id}.patch.json`), json)
}
writeFileSync(
  join(WEEKS_DIR, 'index.json'),
  JSON.stringify({ latest, weeks: ids.map((id) => ({ id, label: labels.get(id) })) }, null, 2) + '\n',
)
console.log(`wrote ${rosters.get(latest).size} team files (${latest}) and ${patches.size} patches (${(bytes / 1e6).toFixed(1)} MB)`)
rmSync(work, { recursive: true })
