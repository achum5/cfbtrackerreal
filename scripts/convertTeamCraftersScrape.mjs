#!/usr/bin/env node
// Converts a TeamCrafters roster-update scrape (the browser-console scraper's
// JSON — one entry per team page, players with raw metaText + cell values)
// into src/data/cfb27Rosters/{tid}.json.
//
//   node scripts/convertTeamCraftersScrape.mjs --input tc.json --dry-run
//   node scripts/convertTeamCraftersScrape.mjs --input tc.json
//
// Unlike the EA converter (which found EA still serving launch data and so
// merged additively), a TeamCrafters update scrape IS the updated roster:
// players absent from it were removed by the update, so they are dropped —
// after a name-normalized and surname+position identity check so a nickname
// spelling can't masquerade as a removal.
//
// TeamCrafters team pages carry OVR, dev trait, class/redshirt, jersey,
// height/weight, archetype, abilities, and 8 attributes. The other 44
// attributes aren't published there, so for returning players they carry
// over from the existing (launch) file; brand-new players get just the 8.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = 'src/data/cfb27Rosters'

const args = (() => {
  const out = {}
  const a = process.argv.slice(2)
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--dry-run') { out.dryRun = true; continue }
    if (a[i].startsWith('--')) { out[a[i].slice(2)] = a[i + 1]; i++ }
  }
  return out
})()
if (!args.input) {
  console.error('Usage: node scripts/convertTeamCraftersScrape.mjs --input <scrape.json> [--dry-run] [--label "Freshmen Update 8/27/26"]')
  process.exit(1)
}
const label = args.label || 'Freshmen Update 8/27/26'

// TeamCrafters page names that differ from our cfb27Rosters teamName index.
const TEAM_ALIASES = {
  'california': 'cal',
  'florida atlantic': 'fau',
  'miami (fl)': 'miami',
  'miami (oh)': 'miami (ohio)',
  'middle tennessee': 'middle tennessee state',
  'sacramento state university': 'sacramento state',
  'south florida': 'usf',
  'uconn': 'connecticut',
  'ul–monroe': 'ul monroe', // en dash on their site
  'ul-monroe': 'ul monroe',
}

// In-game position codes -> app codes. LOLB/ROLB verified TWICE now — the
// EA feed cross-tab (~8,900 players) and this scrape against our own
// rosters both give LOLB->SAM / ROLB->WILL unanimously. (The retired
// parseTeamCraftersRoster.mjs had these two swapped.)
const POSITION_MAP = { LE: 'LEDG', RE: 'REDG', MLB: 'MIKE', LOLB: 'SAM', ROLB: 'WILL', NT: 'DT', LS: 'C' }
const CLASS_MAP = { FR: 'Fr', SO: 'So', JR: 'Jr', SR: 'Sr' }

// The 8 attribute columns a team page shows, in our attribute-map names.
const CELL_ATTRS = {
  SPD: 'Speed', STR: 'Strength', AGI: 'Agility', ACC: 'Acceleration',
  COD: 'Change of Direction', INJ: 'Injury', STA: 'Stamina', AWR: 'Awareness',
}

// "Owen Allen" + "FB#2•5'11\" 215lbs•SR•Utility" (name already stripped).
// `*` is TeamCrafters' changed-in-this-update marker; RS may be glued to the
// class. A negative weight is their signed-byte display bug on 350lb+
// linemen — the shown value is exactly (true weight − 512), verified against
// three players' launch weights (382→−130, 375→−137, 367→−145).
const META_RE = /^\*?(QB|HB|FB|WR|TE|LT|LG|C|RG|RT|LE|RE|DT|NT|LOLB|MLB|ROLB|SAM|MIKE|WILL|CB|FS|SS|K|P|LS)#(\d+)•(\d)'(\d+)" (-?\d+)lbs•(FR|SO|JR|SR)(RS)?•(.*)$/

const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')

const scrape = JSON.parse(readFileSync(args.input, 'utf8'))

// teamName -> current roster file
const byName = new Map()
for (const f of readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8'))
  byName.set(j.teamName.toLowerCase().trim(), j)
}
const resolveTeam = (h1) => {
  const k = h1.toLowerCase().trim()
  return byName.get(k) || byName.get(TEAM_ALIASES[k] || '')
}

const unmapped = scrape.filter((t) => !resolveTeam(t.h1))
if (unmapped.length) {
  console.error('Aborting — unmapped TeamCrafters teams:')
  unmapped.forEach((t) => console.error(`  ${t.teamId}  ${t.h1}`))
  process.exit(1)
}

let parseFails = 0
let updated = 0, added = 0, dropped = 0, ovrChanged = 0, wrote = 0
const report = []

for (const t of scrape) {
  const current = resolveTeam(t.h1)
  const prior = new Map(current.players.map((p) => [nameKey(p.name), p]))
  const priorByLastPos = new Map(current.players.map((p) => [`${nameKey(p.lastName)}|${p.position}`, p]))

  const nextPlayers = []
  const seenPriorKeys = new Set()
  for (const p of t.players) {
    const rest = p.metaText.startsWith(p.name) ? p.metaText.slice(p.name.length) : null
    const m = rest && rest.match(META_RE)
    if (!m) { parseFails++; continue }
    // TeamCrafters suffixes a * onto players changed by this update — it's a
    // UI marker, not part of the name, and it appears inside the link text
    // itself for some players.
    const cleanName = p.name.replace(/\*+$/, '').trim()
    const [, rawPos, jersey, ft, inch, rawWt, rawClass, rs, archetype] = m
    const position = POSITION_MAP[rawPos] || rawPos
    const weightNum = Number(rawWt)
    const weight = weightNum < 0 ? weightNum + 512 : weightNum

    const idx = Object.fromEntries(p.headers.map((h, i) => [h, i - 1])) // cells exclude the Player column
    const cell = (h) => (idx[h] != null && idx[h] >= 0 ? p.cells[idx[h]] : undefined)
    const overall = Number(cell('OVR'))
    const devTrait = cell('Dev') || ''

    const attributes = {}
    for (const [h, ourName] of Object.entries(CELL_ATTRS)) {
      const v = Number(cell(h))
      if (Number.isFinite(v)) attributes[ourName] = v
    }

    // Identity: normalized full name, else unambiguous surname+position.
    const parts = cleanName.split(/\s+/)
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : cleanName
    let existing = prior.get(nameKey(cleanName)) || priorByLastPos.get(`${nameKey(lastName)}|${position}`) || null
    if (existing && seenPriorKeys.has(nameKey(existing.name))) existing = null
    if (existing) seenPriorKeys.add(nameKey(existing.name))

    const record = {
      name: cleanName,
      firstName: parts[0] || '',
      lastName,
      position,
      jerseyNumber: jersey,
      height: `${ft}'${inch}"`,
      weight,
      class: CLASS_MAP[rawClass],
      archetype: archetype.trim(),
      devTrait,
      overall: Number.isFinite(overall) ? overall : 0,
      hometown: existing?.hometown || '',
      state: existing?.state || '',
      redshirt: rs ? 'Redshirted' : (existing?.redshirt || 'Eligible'),
      abilities: p.abilities || [],
      // The 44 attributes the team page doesn't show carry over from the
      // player's launch record; the 8 it does show are authoritative.
      attributes: { ...(existing?.attributes || {}), ...attributes },
    }

    if (existing) {
      updated++
      if (existing.overall !== record.overall) ovrChanged++
    } else {
      added++
    }
    nextPlayers.push(record)
  }

  dropped += current.players.filter((p) => !seenPriorKeys.has(nameKey(p.name))).length
  nextPlayers.sort((a, b) => b.overall - a.overall)
  report.push({ tid: current.tid, teamName: current.teamName, before: current.players.length, after: nextPlayers.length })

  if (!args.dryRun) {
    writeFileSync(join(OUT_DIR, `${current.tid}.json`), JSON.stringify({
      tid: current.tid,
      teamName: current.teamName,
      source: `TeamCrafters (${label})`,
      players: nextPlayers,
    }))
    wrote++
  }
}

const before = report.reduce((s, r) => s + r.before, 0)
const after = report.reduce((s, r) => s + r.after, 0)
console.log(`teams: ${report.length}   players: ${before} -> ${after}`)
console.log(`matched+updated: ${updated} (${ovrChanged} with changed OVR)   new: ${added}   removed by update: ${dropped}   parse failures: ${parseFails}`)
const biggest = [...report].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, 8)
biggest.forEach((r) => console.log(`  tid ${r.tid} ${r.teamName}: ${r.before} -> ${r.after}`))
console.log(args.dryRun ? '\nDRY RUN - nothing written.' : `\nwrote ${wrote} files to ${OUT_DIR}`)
