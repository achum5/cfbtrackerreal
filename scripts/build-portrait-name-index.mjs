#!/usr/bin/env node
/**
 * Build a global player-NAME -> portrait-id index from a raw CFB 27 portrait
 * pack dump.
 *
 * WHY THIS EXISTS: the console portrait path (src/data/cfb27Portraits/) maps
 * names to faces for the bundled LAUNCH rosters only, and it needs a PC save
 * or a PC dynasty export to generate. But the pack's own filenames already
 * carry the player name:
 *
 *     nilpp_Unique_SmithJeremiah_8726.webp
 *                  ^^^^^^^^^^^^^ ^^^^
 *                  Last+First    portrait id
 *
 * so the name -> face link can be built from the pack by itself, covering
 * every real player in the game rather than just one season's rosters.
 *
 * THE SPLIT PROBLEM: the blob has no separator, so "SmithJeremiah" cannot be
 * split back into "Smith" + "Jeremiah" — there's no way to know where the
 * boundary falls. This index therefore stores the blob AS-IS (squashed and
 * lowercased) and leaves candidate generation to the lookup side, which knows
 * the player's actual name parts and can try every split point. See
 * portraitIdForName() in src/data/portraitNameMatch.js.
 *
 * AMBIGUITY IS DROPPED, NOT GUESSED. Across ~22,000 real players, duplicate
 * Last+First combinations are guaranteed. A key that resolves to more than one
 * portrait id is omitted from the index entirely, so it can never match. That
 * follows the standing rule in this codebase (see mapPortraitUrl's header and
 * cfb27Portraits/README.md): showing no photo is better than confidently
 * showing a different person's face.
 *
 * Usage:
 *   node scripts/build-portrait-name-index.mjs <extracted-pack-dir>          # dry run
 *   node scripts/build-portrait-name-index.mjs <extracted-pack-dir> --write
 *
 * Options:
 *   --out <file>   output path (default: src/data/cfb27PortraitNameIndex.json,
 *                  or ./cfb27PortraitNameIndex.json with no repo present)
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')

// Same standalone-friendliness as prepare-portrait-pack.mjs: this is genuinely
// useful from a machine that has the pack and this file but no clone.
const hasRepo = await fs.access(path.join(REPO, 'src/data')).then(() => true).catch(() => false)

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d }

const srcDir = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out')
const write = flag('--write')
const outPath = path.resolve(
  opt('--out', hasRepo ? path.join(REPO, 'src/data/cfb27PortraitNameIndex.json') : 'cfb27PortraitNameIndex.json'),
)

if (!srcDir) {
  console.error('Usage: node scripts/build-portrait-name-index.mjs <extracted-pack-dir> [--write] [--out file]')
  process.exit(1)
}

const PREFIX = /^(nilpp|nilp|cfb27)[_-]/i
const UNIQUE = /^Unique_(.*)_(\d+)$/i
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg'])

// MUST match squashName() in src/data/portraitNameMatch.js — the index is
// written with this and read back with that, so any drift silently yields
// zero matches.
const squash = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '')

async function walk(dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, out)
    else out.push(full)
  }
  return out
}

const abs = path.resolve(srcDir)
console.log(`Scanning ${abs}…`)
let files
try {
  files = await walk(abs)
} catch (e) {
  console.error(`Could not read ${abs}: ${e.message}`)
  process.exit(1)
}

// key -> Set of portrait ids. A Set (not a single value) so genuine ambiguity
// is detectable instead of being silently resolved by last-write-wins.
const byName = new Map()
let uniqueFiles = 0
let unparsed = 0

for (const full of files) {
  const ext = path.extname(full).toLowerCase()
  if (!IMAGE_EXT.has(ext)) continue
  const stem = path.basename(full, ext).replace(PREFIX, '')
  const m = stem.match(UNIQUE)
  // Generic_ portraits are procedural looks with no person attached — they
  // carry no name and are irrelevant to name matching.
  if (!m) { if (!/^Generic_/i.test(stem)) unparsed++; continue }
  uniqueFiles++
  const key = squash(m[1])
  if (!key) continue
  const id = Number(m[2])
  if (!byName.has(key)) byName.set(key, new Set())
  byName.get(key).add(id)
}

const index = {}
const ambiguous = []
for (const [key, ids] of byName) {
  if (ids.size === 1) index[key] = [...ids][0]
  else ambiguous.push({ key, ids: [...ids] })
}

const keys = Object.keys(index).sort()
const sorted = {}
for (const k of keys) sorted[k] = index[k]

console.log(`\n  unique-portrait files : ${uniqueFiles.toLocaleString()}`)
console.log(`  distinct name keys    : ${byName.size.toLocaleString()}`)
console.log(`  USABLE (unambiguous)  : ${keys.length.toLocaleString()}`)
console.log(`  dropped as ambiguous  : ${ambiguous.length.toLocaleString()} name(s) -> ${ambiguous.reduce((n, a) => n + a.ids.length, 0).toLocaleString()} portraits`)
if (unparsed) console.log(`  unrecognized filenames: ${unparsed.toLocaleString()} (skipped)`)

if (ambiguous.length) {
  console.log('\nSample ambiguous names (dropped — these would be a coin flip):')
  for (const a of ambiguous.slice(0, 10)) console.log(`  ${a.key} -> ${a.ids.join(', ')}`)
}
console.log('\nSample index entries:')
for (const k of keys.slice(0, 8)) console.log(`  ${k} -> ${sorted[k]}`)

if (!write) {
  console.log('\nDry run — nothing written. Re-run with --write to emit the index.')
} else {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, JSON.stringify(sorted))
  const { size } = await fs.stat(outPath)
  console.log(`\nWrote ${outPath} (${(size / 1024).toFixed(0)} KB, ${keys.length.toLocaleString()} entries)`)
  if (!hasRepo) console.log('No repo detected — send this file back to be committed.')
}
