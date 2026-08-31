#!/usr/bin/env node
/**
 * Turn a raw CFB 27 portrait-pack dump into the layout the app actually reads,
 * and regenerate the manifests that decide which portraits it will look up.
 *
 * The pack ships as a flat folder of files named like
 *
 *     nilpp_Unique_RobertsBen_4212.webp
 *     nilpp_Generic_WR_Black_02.webp
 *
 * but mapPortraitUrl (src/data/cfb27SaveImport.js) resolves a player's
 * GenericHeadAssetName to a PATH:
 *
 *     Unique_<anything>_4212  ->  /cfb27-portraits/unique/4212.webp
 *     Generic_<key>           ->  /cfb27-portraits/generic/<key>.webp
 *
 * so the descriptive name and the vendor prefix have to be stripped and the
 * files foldered before upload. Nothing downstream ever sees the original
 * filename — only the trailing id (unique) or the key (generic) carries
 * meaning.
 *
 * It also rewrites the two manifests. Those are the gate: mapPortraitUrl
 * returns '' for any id NOT in them, so a portrait can be sitting on the CDN
 * and still never render. Regenerating from what this run actually produced
 * keeps the manifest and the bucket describing the same set.
 *
 * Usage:
 *   node scripts/prepare-portrait-pack.mjs <extracted-pack-dir>            # dry run
 *   node scripts/prepare-portrait-pack.mjs <extracted-pack-dir> --write    # do it
 *
 * Options:
 *   --out <dir>       output root (default: public/cfb27-portraits)
 *   --copy            copy instead of hardlink (slower, doubles disk use)
 *   --no-manifest     skip rewriting src/data/*PortraitIds.json
 *
 * Dry run by default because the write step moves tens of thousands of files.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')

// The manifests live in the repo, but this script is genuinely useful from a
// machine that only has the pack and a copy of this file (a Steam Deck with no
// clone, say). When src/data isn't there, fall back to writing the manifests
// beside the output and say so, rather than failing at the very end after
// placing tens of thousands of files.
const hasRepo = await fs.access(path.join(REPO, 'src/data/cfb27UniquePortraitIds.json'))
  .then(() => true).catch(() => false)

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const opt = (name, dflt) => {
  const i = argv.indexOf(name)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt
}

const srcDir = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out')
const outRoot = path.resolve(REPO, opt('--out', 'public/cfb27-portraits'))
const write = flag('--write')
const useCopy = flag('--copy')
const doManifest = !flag('--no-manifest')

if (!srcDir) {
  console.error('Usage: node scripts/prepare-portrait-pack.mjs <extracted-pack-dir> [--write] [--out dir] [--copy]')
  process.exit(1)
}

// Vendor prefixes seen on pack dumps. Stripped before parsing so the asset
// name matches what the save file reports.
const PREFIX = /^(nilpp|nilp|cfb27)[_-]/i

// Unique portraits are keyed ONLY by the trailing number — the name in the
// middle is descriptive and is not what the save file matches on.
const UNIQUE = /^Unique_.*?_(\d+)$/i
// Generic portraits are keyed by everything after `Generic_`, verbatim.
const GENERIC = /^Generic_(.+)$/i

const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg'])

async function walk(dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, out)
    else out.push(full)
  }
  return out
}

const main = async () => {
  const abs = path.resolve(srcDir)
  console.log(`Scanning ${abs}…`)
  let files
  try {
    files = await walk(abs)
  } catch (e) {
    console.error(`Could not read ${abs}: ${e.message}`)
    process.exit(1)
  }

  const uniques = new Map()   // id -> source path
  const generics = new Map()  // key -> source path
  const collisions = []
  const unparsed = []

  for (const full of files) {
    const ext = path.extname(full).toLowerCase()
    if (!IMAGE_EXT.has(ext)) continue
    const stem = path.basename(full, ext).replace(PREFIX, '')

    const u = stem.match(UNIQUE)
    if (u) {
      const id = String(Number(u[1]))
      // Two files claiming the same id would silently overwrite each other on
      // the CDN, so surface it rather than letting last-write-wins decide.
      if (uniques.has(id)) collisions.push({ kind: 'unique', id, a: uniques.get(id), b: full })
      else uniques.set(id, full)
      continue
    }

    const g = stem.match(GENERIC)
    if (g) {
      const key = g[1]
      if (generics.has(key)) collisions.push({ kind: 'generic', id: key, a: generics.get(key), b: full })
      else generics.set(key, full)
      continue
    }

    unparsed.push(full)
  }

  console.log(`\n  unique portraits : ${uniques.size.toLocaleString()}`)
  console.log(`  generic portraits: ${generics.size.toLocaleString()}`)
  if (collisions.length) console.log(`  COLLISIONS       : ${collisions.length} (same id twice — see below)`)
  if (unparsed.length) console.log(`  unrecognized     : ${unparsed.length} (skipped)`)

  if (collisions.length) {
    console.log('\nCollisions (first 10):')
    for (const c of collisions.slice(0, 10)) {
      console.log(`  ${c.kind} ${c.id}\n    ${path.basename(c.a)}\n    ${path.basename(c.b)}`)
    }
  }
  if (unparsed.length) {
    console.log('\nUnrecognized filenames (first 10):')
    for (const f of unparsed.slice(0, 10)) console.log(`  ${path.basename(f)}`)
  }

  // Compare against the manifests currently in the repo, so the run reports
  // what this pack actually ADDS rather than just how big it is.
  const manifestDir = hasRepo ? path.join(REPO, 'src/data') : outRoot
  const manifestPath = (f) => path.join(manifestDir, f)
  const readJson = async (f) => {
    try { return JSON.parse(await fs.readFile(manifestPath(f), 'utf8')) } catch { return [] }
  }
  const prevUnique = new Set((await readJson('cfb27UniquePortraitIds.json')).map(Number))
  const prevGeneric = new Set(await readJson('cfb27GenericPortraitKeys.json'))

  const newUnique = [...uniques.keys()].map(Number).filter((n) => !prevUnique.has(n))
  const newGeneric = [...generics.keys()].filter((k) => !prevGeneric.has(k))
  const goneUnique = [...prevUnique].filter((n) => !uniques.has(String(n)))

  console.log(`\n  new unique ids   : ${newUnique.length.toLocaleString()}`)
  console.log(`  new generic keys : ${newGeneric.length.toLocaleString()}`)
  if (goneUnique.length) {
    console.log(`  in manifest but NOT in this pack: ${goneUnique.length.toLocaleString()}`)
    console.log('    (kept in the manifest — those files may already be on the CDN from an earlier upload)')
  }

  if (!write) {
    console.log('\nDry run — nothing written. Re-run with --write to build the folder.')
    return
  }

  // Hardlink by default: same inode, so staging 667 MB costs no extra disk and
  // finishes in seconds. Falls back to a copy across filesystems.
  const place = async (from, to) => {
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rm(to, { force: true })
    if (useCopy) return fs.copyFile(from, to)
    try { await fs.link(from, to) } catch { await fs.copyFile(from, to) }
  }

  console.log(`\nWriting to ${outRoot} …`)
  let done = 0
  for (const [id, from] of uniques) {
    await place(from, path.join(outRoot, 'unique', `${id}.webp`))
    if (++done % 2000 === 0) console.log(`  ${done.toLocaleString()}…`)
  }
  for (const [key, from] of generics) {
    await place(from, path.join(outRoot, 'generic', `${key}.webp`))
    if (++done % 2000 === 0) console.log(`  ${done.toLocaleString()}…`)
  }
  console.log(`  ${done.toLocaleString()} files placed.`)

  if (doManifest) {
    // Union with the existing manifest, never a replacement: an id already on
    // the CDN from a previous upload but absent from this pack must keep
    // resolving. Dropping it would blank portraits that currently work.
    const mergedUnique = [...new Set([...prevUnique, ...[...uniques.keys()].map(Number)])].sort((a, b) => a - b)
    const mergedGeneric = [...new Set([...prevGeneric, ...generics.keys()])].sort()
    await fs.writeFile(manifestPath('cfb27UniquePortraitIds.json'), JSON.stringify(mergedUnique))
    await fs.writeFile(manifestPath('cfb27GenericPortraitKeys.json'), JSON.stringify(mergedGeneric))
    console.log(`\nManifests updated (${manifestDir}):`)
    console.log(`  cfb27UniquePortraitIds.json  ${prevUnique.size.toLocaleString()} -> ${mergedUnique.length.toLocaleString()}`)
    console.log(`  cfb27GenericPortraitKeys.json ${prevGeneric.size.toLocaleString()} -> ${mergedGeneric.length.toLocaleString()}`)
  }

  console.log(`
Next:
  1. Upload — note the DOUBLED path, it is not a typo (see
     docs/CFB27_PORTRAIT_CDN_SETUP.md):

       rclone copy ${path.relative(REPO, outRoot)} r2remote:cfb27-portraits/cfb27-portraits \\
         --progress --transfers=32 --checkers=32

     rclone only sends new/changed files, so re-running after a partial
     upload is cheap.

  2. Spot-check one of the NEW ids (expect 200, not 404):

       curl -I https://<your-portrait-host>/cfb27-portraits/unique/${newUnique[0] ?? [...uniques.keys()][0]}.webp

  3. ${hasRepo
    ? 'Commit the two manifest JSONs from src/data/.'
    : `Send the two manifest JSONs written to ${manifestDir} back to the repo\n     (they are ~250 KB total) so they can be committed.`}
     They are the gate — a portrait sitting on the CDN but missing from the
     manifest never renders.
`)
}

main().catch((e) => { console.error(e); process.exit(1) })
