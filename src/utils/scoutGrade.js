// Scout grade — a single 0–99 score + tier for a scouted recruit/target, from
// the attributes captured via the Targets sheet (player.attributes).
//
// Approach (our own implementation): a weighted average of the archetype's
// defining attributes (weights authored here from football logic, not copied),
// plus modest adjustments for dev trait, star rating, and elite physical
// outliers. The score normalizes over whatever attributes were actually scouted,
// so partial scouting still grades fairly. Any archetype with no weight table
// falls back to a flat average of its scouted attributes.

import { attributeNamesFor, archetypeKey } from './recruitAttributes'

// Relative attribute emphasis per "<bucket>_<archetype>" (0–10 scale; only the
// meaningful attributes are listed — the rest contribute 0). The score divides
// by the summed weight of the attributes a player actually has, so these are
// relative, not required to total anything.
export const SCOUT_WEIGHTS = {
  // ── QB ──
  'QB_Pocket Passer':     { 'Throw Power': 7, 'Short Accuracy': 8, 'Medium Accuracy': 8, 'Deep Accuracy': 7, 'Under Pressure': 6, Awareness: 6, 'Throw On Run': 2, 'Break Sack': 2 },
  'QB_Dual Threat':       { 'Throw Power': 6, 'Short Accuracy': 5, 'Medium Accuracy': 5, 'Deep Accuracy': 4, 'Throw On Run': 7, Speed: 8, Acceleration: 7, 'Break Sack': 3, Awareness: 3 },
  'QB_Backfield Creator': { 'Throw Power': 6, 'Short Accuracy': 7, 'Medium Accuracy': 6, 'Throw On Run': 8, 'Break Sack': 6, Awareness: 5, 'Deep Accuracy': 3, Speed: 3 },
  'QB_Pure Runner':       { Speed: 9, Acceleration: 8, 'Throw On Run': 6, 'Break Sack': 6, 'Throw Power': 4, 'Short Accuracy': 4, Awareness: 3, 'Medium Accuracy': 3 },
  // ── HB ──
  'HB_Elusive Bruiser':     { 'Break Tackle': 8, 'Juke Move': 7, Carrying: 6, Speed: 6, Acceleration: 6, 'Change of Direction': 5, 'BC Vision': 5, 'Spin Move': 4, Awareness: 3 },
  'HB_East/West Playmaker': { Speed: 8, Acceleration: 8, 'Change of Direction': 8, 'Juke Move': 7, 'Spin Move': 5, 'BC Vision': 5, Carrying: 4, Awareness: 3 },
  'HB_Contact Seeker':      { 'Break Tackle': 9, Carrying: 7, 'BC Vision': 6, Awareness: 5, Speed: 4, Acceleration: 4, 'Change of Direction': 3, 'Juke Move': 3 },
  'HB_Backfield Threat':    { Catching: 8, Speed: 7, Acceleration: 6, 'Juke Move': 6, 'BC Vision': 5, 'Change of Direction': 5, 'Break Tackle': 4, Carrying: 4 },
  'HB_North/South Receiver':{ Speed: 7, Catching: 7, Acceleration: 6, Carrying: 6, 'BC Vision': 6, 'Break Tackle': 5, Awareness: 4, 'Change of Direction': 4 },
  'HB_North/South Blocker': { Carrying: 8, 'Break Tackle': 7, 'BC Vision': 6, Awareness: 6, Speed: 4, Acceleration: 4, Catching: 3 },
  // ── WR ──
  'WR_Speedster':            { Speed: 9, Acceleration: 8, 'Deep Route': 7, 'Spectacular Catch': 6, Catching: 6, 'Medium Route': 4, 'Short Route': 3, 'Catch In Traffic': 3 },
  'WR_Route Artist':         { 'Short Route': 8, 'Medium Route': 8, 'Deep Route': 7, Catching: 7, Agility: 6, Awareness: 5, 'Catch In Traffic': 4, Speed: 3 },
  'WR_Elusive Route Runner': { 'Short Route': 8, 'Medium Route': 7, Agility: 8, Speed: 6, Acceleration: 5, Catching: 6, 'Deep Route': 4, Awareness: 4 },
  'WR_Physical Route Runner':{ 'Catch In Traffic': 8, 'Spectacular Catch': 7, Catching: 7, 'Medium Route': 7, 'Short Route': 5, Awareness: 5, 'Deep Route': 4, Speed: 3 },
  'WR_Gritty Possession':    { 'Catch In Traffic': 8, Catching: 8, 'Short Route': 7, 'Medium Route': 6, Awareness: 6, 'Spectacular Catch': 4, Speed: 3 },
  'WR_Contested Specialist': { 'Catch In Traffic': 8, 'Spectacular Catch': 8, Catching: 7, 'Deep Route': 6, Awareness: 5, 'Medium Route': 5, Speed: 3 },
  'WR_Gadget':               { Speed: 8, Acceleration: 7, Agility: 7, Catching: 6, 'Short Route': 5, 'Catch In Traffic': 3, Awareness: 3 },
  // ── TE ──
  'TE_Vertical Threat':      { Speed: 8, Acceleration: 7, 'Deep Route': 7, 'Medium Route': 6, Catching: 7, 'Catch In Traffic': 5, Awareness: 4, Strength: 3 },
  'TE_Pure Possession':      { Catching: 8, 'Catch In Traffic': 8, 'Short Route': 7, 'Medium Route': 6, Awareness: 6, Speed: 3, Strength: 3 },
  'TE_Gritty Possession':    { 'Catch In Traffic': 8, Catching: 6, 'Short Route': 6, Strength: 6, 'Run Block': 5, Awareness: 5, 'Medium Route': 4 },
  'TE_Physical Route Runner':{ 'Catch In Traffic': 8, 'Medium Route': 7, Catching: 7, Strength: 6, 'Short Route': 5, Awareness: 4, Speed: 4 },
  'TE_Pure Blocker':         { 'Run Block': 9, 'Pass Block': 7, Strength: 8, Awareness: 6, Catching: 3, 'Catch In Traffic': 3 },
  // ── OL (OT/OG/C share the profile) ──
  ...['OT', 'OG', 'C'].reduce((o, p) => ({
    ...o,
    [`${p}_Well Rounded`]:  { 'Run Block': 7, 'Pass Block': 7, 'Run Block Power': 5, 'Pass Block Power': 5, 'Run Block Finesse': 4, 'Pass Block Finesse': 4, 'Impact Blocking': 5, Awareness: 6, Agility: 3, Acceleration: 3 },
    [`${p}_Pass Protector`]:{ 'Pass Block': 8, 'Pass Block Power': 7, 'Pass Block Finesse': 7, Awareness: 6, 'Run Block': 4, 'Impact Blocking': 4, Agility: 4 },
    [`${p}_Agile`]:         { 'Run Block Finesse': 8, 'Pass Block Finesse': 8, Agility: 7, Acceleration: 6, 'Run Block': 5, 'Pass Block': 5, Awareness: 5 },
    [`${p}_Raw Strength`]:  { 'Run Block Power': 9, 'Pass Block Power': 8, Strength: 8, 'Impact Blocking': 7, 'Run Block': 5, 'Pass Block': 5, Awareness: 4 },
  }), {}),
  // ── DL (DE/DT share, + DT gap) ──
  ...['DE', 'DT'].reduce((o, p) => ({
    ...o,
    [`${p}_Speed Rusher`]: { 'Finesse Moves': 9, Speed: 8, Acceleration: 8, Pursuit: 6, 'Block Shedding': 4, Tackle: 4, Awareness: 3 },
    [`${p}_Power Rusher`]: { 'Power Moves': 9, Strength: 8, 'Block Shedding': 7, 'Hit Power': 6, Tackle: 5, Pursuit: 3, Awareness: 3 },
    [`${p}_Edge Setter`]:  { 'Block Shedding': 8, Tackle: 8, Strength: 7, 'Hit Power': 6, Awareness: 5, 'Power Moves': 4, Pursuit: 4 },
    [`${p}_Pure Power`]:   { 'Power Moves': 9, Strength: 9, 'Block Shedding': 7, 'Hit Power': 6, Tackle: 4 },
  }), {}),
  'DT_Gap Specialist': { 'Block Shedding': 8, Strength: 8, Tackle: 7, 'Hit Power': 6, Awareness: 5, 'Power Moves': 5, Pursuit: 3 },
  // ── LB (OLB/MIKE share) ──
  ...['OLB', 'MIKE'].reduce((o, p) => ({
    ...o,
    [`${p}_Thumper`]:       { Tackle: 8, 'Hit Power': 8, Strength: 7, Pursuit: 6, 'Play Recognition': 5, Awareness: 4, Speed: 3 },
    [`${p}_Signal Caller`]: { Awareness: 8, 'Play Recognition': 8, Tackle: 6, Pursuit: 6, 'Zone Coverage': 5, 'Hit Power': 4, Speed: 3 },
    [`${p}_Lurker`]:        { Speed: 7, 'Play Recognition': 7, 'Zone Coverage': 7, Pursuit: 6, Acceleration: 6, Awareness: 5, 'Man Coverage': 4, Tackle: 4 },
  }), {}),
  // ── CB ──
  'CB_Boundary':     { 'Man Coverage': 8, Press: 7, Speed: 8, Acceleration: 7, Agility: 5, 'Change of Direction': 5, Awareness: 4, 'Zone Coverage': 3 },
  'CB_Bump and Run': { Press: 9, 'Man Coverage': 8, Acceleration: 6, Speed: 6, Agility: 5, 'Change of Direction': 4, Awareness: 4, Tackle: 3 },
  'CB_Field':        { Speed: 8, Acceleration: 7, 'Change of Direction': 7, Agility: 6, 'Zone Coverage': 6, 'Man Coverage': 6, Awareness: 5, Press: 3 },
  'CB_Zone':         { 'Zone Coverage': 9, Awareness: 7, Speed: 6, Acceleration: 5, 'Change of Direction': 5, 'Man Coverage': 4, Catching: 4, Tackle: 3 },
  // ── S (FS/SS share) ──
  ...['FS', 'SS'].reduce((o, p) => ({
    ...o,
    [`${p}_Box Specialist`]:      { Tackle: 8, Awareness: 7, Speed: 6, 'Man Coverage': 5, Acceleration: 5, Press: 4, 'Change of Direction': 4 },
    [`${p}_Coverage Specialist`]: { 'Man Coverage': 8, 'Zone Coverage': 8, Speed: 7, Acceleration: 6, Catching: 6, 'Change of Direction': 5, Agility: 5, Awareness: 5 },
    [`${p}_Hybrid`]:              { 'Man Coverage': 6, 'Zone Coverage': 6, Tackle: 6, Speed: 6, Awareness: 6, Acceleration: 5, 'Change of Direction': 4, Press: 4 },
  }), {}),
}

// Adjustments — our own calibration (kept modest so scouted attributes dominate).
const DEV_ADJ = { Elite: 10, Star: 5, Impact: 2, Normal: -5 }
const STAR_ADJ = { 5: 2, 4: 1, 3: 0, 2: -1, 1: -2 }
const PHYS_ATTRS = ['Speed', 'Acceleration', 'Strength', 'Agility', 'Change of Direction']

const hasAnyAttrs = (p) => p?.attributes && Object.keys(p.attributes).some((k) => p.attributes[k] != null && p.attributes[k] !== '')

// Weighted base over the player's scouted attributes (0–99), normalized by the
// summed weight of the attributes present. Falls back to a flat average when
// the archetype has no weight table.
function baseScore(player) {
  const attrs = player.attributes || {}
  const present = Object.keys(attrs).filter((k) => typeof Number(attrs[k]) === 'number' && Number.isFinite(Number(attrs[k])))
  if (!present.length) return null
  const weights = SCOUT_WEIGHTS[archetypeKey(player.position, player.archetype)]
  if (!weights) {
    // No profile — flat average of scouted attributes.
    const sum = present.reduce((a, k) => a + Number(attrs[k]), 0)
    return sum / present.length
  }
  let wSum = 0
  let acc = 0
  for (const k of present) {
    const w = weights[k] || 0
    if (w <= 0) continue
    acc += Number(attrs[k]) * w
    wSum += w
  }
  if (wSum === 0) {
    // The archetype's key attributes weren't among those scouted — flat avg.
    const sum = present.reduce((a, k) => a + Number(attrs[k]), 0)
    return sum / present.length
  }
  return acc / wSum
}

function physBonus(player) {
  const attrs = player.attributes || {}
  let b = 0
  for (const k of PHYS_ATTRS) {
    const v = Number(attrs[k]) || 0
    if (v >= 95) b += 2
    else if (v >= 90) b += 1
  }
  return Math.min(b, 6)
}

function devAdj(player) {
  const d = player.devTrait
  if (d && DEV_ADJ[d] != null) return DEV_ADJ[d]
  // Hidden / unknown dev — estimate conservatively from stars.
  const stars = parseInt(player.stars, 10) || 3
  return ({ 5: 7, 4: 4, 3: 1, 2: -2, 1: -4 })[stars] ?? 1
}

/**
 * Full scout score for a player, or null if they have no scouted attributes.
 * @returns {number|null} 0–99
 */
export function computeScoutScore(player) {
  if (!hasAnyAttrs(player)) return null
  const base = baseScore(player)
  if (base == null) return null
  const raw = base + devAdj(player) + (STAR_ADJ[parseInt(player.stars, 10)] ?? 0) + physBonus(player)
  return Math.max(0, Math.min(99, Math.round(raw)))
}

// Tier bands (our calibration).
export const SCOUT_TIERS = [
  { key: 'elite',   label: 'Elite',   min: 88, color: '#22c55e' },
  { key: 'premium', label: 'Premium', min: 81, color: '#3b82f6' },
  { key: 'core',    label: 'Core',    min: 74, color: '#eab308' },
  { key: 'depth',   label: 'Depth',   min: 0,  color: '#f97316' },
]

export function scoutTier(score) {
  if (score == null) return null
  return SCOUT_TIERS.find((t) => score >= t.min) || SCOUT_TIERS[SCOUT_TIERS.length - 1]
}

/**
 * Convenience: { score, tier } for a player (tier is the SCOUT_TIERS entry).
 */
export function scoutGrade(player) {
  const score = computeScoutScore(player)
  return { score, tier: scoutTier(score) }
}

// The player's top scouted attributes by this archetype's emphasis (for display).
export function topScoutedAttrs(player, n = 3) {
  const attrs = player.attributes || {}
  const weights = SCOUT_WEIGHTS[archetypeKey(player.position, player.archetype)] || {}
  const names = attributeNamesFor(player.position, player.archetype) || Object.keys(attrs)
  return names
    .filter((name) => attrs[name] != null && attrs[name] !== '')
    .map((name) => ({ name, value: Number(attrs[name]), weight: weights[name] || 0 }))
    .sort((a, b) => (b.weight - a.weight) || (b.value - a.value))
    .slice(0, n)
}
