// Full-attribute entry for Training Results and Recruit Overalls (CFB 27).
//
// The Overall-only flows ask the AI for one number per player. This adds an
// "all ratings" variant: the AI emits the player's COMPLETE attribute set in a
// single compact cell ("AWR 88, SPD 90, ACC 91, …"), alongside Position + OVR.
// One cell per player (rather than ~50 columns) keeps the paste grid and the
// AI output manageable, and reuses parseAttributes() — which already accepts
// both the short codes below and full attribute names.
//
// Shape produced per row:
//   Player<TAB>Position<TAB>OVR<TAB>Jersey #<TAB>Dev Trait<TAB>Archetype<TAB>NIL<TAB>Attributes
//   parseAttributeRows(splitTsv(text))
//     -> [{ playerName, position, overall, jerseyNumber, devTrait, archetype,
//           nil, attributes }]
// The Training Results variant ({ pastOverall: true }) carries one more
// column right after OVR — Past OVR, the overall BEFORE the "+N" the game
// shows — so a transfer's pre-arrival overall lands on their prior season:
//   Player<TAB>Position<TAB>OVR<TAB>Past OVR<TAB>Jersey #<TAB>Dev Trait<TAB>Archetype<TAB>NIL<TAB>Attributes
//
// The four player-card fields sit BEFORE the attributes cell, not after it:
// the cell is "everything from here to the end of the row", so that anything
// the AI tab-separated inside the ratings is rejoined rather than lost. A field
// placed after it would be swallowed by that rule.
import { ATTRIBUTE_ABBR, GAME_ATTRIBUTE_ORDER } from './recruitAttributes'
import { parseAttributes } from './recruitSheetParse'
import {
  DEV_TRAIT_VALUES,
  parseJerseyNumber,
  normalizeDevTrait,
  normalizeArchetype,
  parseNilAmount,
} from './playerFieldNormalize'
import { archetypePromptBlock } from '../data/rosterOptions'
import { NIL_FIELD_HINT } from './aiPrompt'

// "SPD=Speed, ACC=Acceleration, …" legend in the game's roster-table order, so
// the AI knows which code maps to which rating AND emits them in the same order
// the user reads off-screen (easier to cross-check against the roster).
export const ATTRIBUTE_PROMPT_LEGEND = GAME_ATTRIBUTE_ORDER
  .map((name) => `${ATTRIBUTE_ABBR[name] || name}=${name}`)
  .join(', ')

const coerceNum = (v) => {
  const s = (v ?? '').toString().trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// The shared "Sheet structure" block for buildAIPrompt's all-attributes variant.
// `kind` tailors the wording: 'training' (post-training roster ratings) or
// 'recruits' (signed recruits' ratings). The AI outputs 4 columns; column 4 is
// the whole rating set as one comma-separated cell of "CODE value" pairs.
// Built once — the position/archetype table is static.
const ARCHETYPES_BY_POSITION_BLOCK = archetypePromptBlock()

export function buildAttributesStructure(kind = 'training') {
  const who = kind === 'recruits'
    ? 'every recruit in the list above'
    : 'every player in the list above'
  const ovrSource = kind === 'recruits'
    ? "the recruit's projected/known Overall"
    : "the player's CURRENT overall AFTER training (the OVR shown in the screenshot)"
  const withPast = kind !== 'recruits'
  const colCount = withPast ? 9 : 8
  const header = withPast
    ? 'Player<TAB>Position<TAB>OVR<TAB>Past OVR<TAB>Jersey #<TAB>Dev Trait<TAB>Archetype<TAB>NIL<TAB>Attributes'
    : 'Player<TAB>Position<TAB>OVR<TAB>Jersey #<TAB>Dev Trait<TAB>Archetype<TAB>NIL<TAB>Attributes'
  const pastLine = withPast
    ? `
• Past OVR  — the overall BEFORE training: OVR minus the green gain shown
              beside it. "78 (+5)" → OVR 78, Past OVR 73. No gain shown → the
              same number as OVR. Blank only when OVR itself is not visible.`
    : ''
  const example = withPast
    ? `Alex Guess	QB	90	88	12	Elite	Dual Threat	250000	AWR 92, SPD 84, ACC 86, STR 78, THP 95, SAC 90, MAC 88, DAC 86
Jaylen Miller	HB	82	82					AWR 80, SPD 93, ACC 94, CAR 90, BTK 85, JKM 88, BCV 84, CTH 70`
    : `Alex Guess	QB	90	12	Elite	Dual Threat	250000	AWR 92, SPD 84, ACC 86, STR 78, THP 95, SAC 90, MAC 88, DAC 86
Jaylen Miller	HB	82					AWR 80, SPD 93, ACC 94, CAR 90, BTK 85, JKM 88, BCV 84, CTH 70`
  return `The user pastes your output straight into the app; it matches rows by PLAYER NAME, so row order does not matter. Output ONE row for ${who}.

OUTPUT ${colCount} TAB-SEPARATED COLUMNS per row:
  ${header}

• Player    — FULL name from the list above (never abbreviated). Match EA's
              abbreviated screenshot names (e.g. "A. Guess") to the full name.
• Position  — the listed position string exactly (QB, HB, WR, TE, LT, …).
• OVR       — ${ovrSource}. Integer 40–99. Blank only if not visible anywhere.${pastLine}
• Jersey #  — the number shown with the player's name on the RIGHT-HAND PLAYER
              CARD. Integer 0–99, no "#". Blank when that card is not shown.
• Dev Trait — at the BOTTOM of the same card. EXACTLY one of:
              ${DEV_TRAIT_VALUES.join(' | ')}. "Hidden" is a real value, used
              when the game has not revealed the trait yet — it is NOT a
              stand-in for "I can't see it". Blank when the card is not shown.
• Archetype — the style label beside the position on the same card. It must be
              one of the values in the ARCHETYPES list below — ANY of them,
              whatever the player's position. Blank when the card is not shown.
• NIL       — ${NIL_FIELD_HINT}
• Attributes — the player's ENTIRE rating set as ONE cell: comma-separated
              "CODE value" pairs using the codes below, in this order. Include
              EVERY rating the player has a value for in the screenshots or video; skip a
              rating only when it is genuinely not shown. Example cell:
              "AWR 84, SPD 91, ACC 92, STR 70, AGI 90, COD 88, CTH 95, …"

The card on the right shows ONE player at a time, so Jersey #, Dev Trait,
Archetype and NIL are filled in only for the players whose card the user
actually captured. That is expected — leave them blank for everyone else and
still output the row. A blank is correct and costs nothing; the app keeps what
it already has. A guess does not.

═══════════════════════════════════════════════════════════
ARCHETYPES — the values the Archetype column may take
═══════════════════════════════════════════════════════════
${ARCHETYPES_BY_POSITION_BLOCK}

The grouping above is for reading convenience only — it is NOT a restriction.
The game hands out archetypes across position lines, so a tight end whose card
reads "Physical Route Runner" is a real player, not a misread. Record what the
card says, from ANY row of that list. Leave Archetype blank only when the card
is not shown, or when its label appears nowhere in the list at all.

Attribute codes (CODE=Name):
${ATTRIBUTE_PROMPT_LEGEND}

RULES:
1. Exactly ${colCount - 1} tab characters per row (${colCount} columns), INCLUDING rows whose middle
   columns are blank — the empty columns still need their tabs. The Attributes
   cell itself uses COMMAS between pairs — never tabs — so it stays one cell.
2. Inside the Attributes cell: "CODE value" pairs, ratings are integers 0–99, no
   "+/-" gain deltas, no parentheses, no units. If a screenshot shows "84 (+1)",
   record 84.
3. One row per player in the list above. Use the FULL name from that list.
4. NEVER GUESS. Omit a rating, or leave a column blank, when it isn't visible.

REQUIRED OUTPUT FORMAT — one fenced \`\`\`tsv block, nothing else (see TSV delivery rules above):
\`\`\`tsv
${example}
...
\`\`\`

(The second row is a player whose card was not captured: four blank columns,
four tabs, ratings still present.)`
}

// Parse splitTsv() rows from an all-attributes paste into entry objects.
// Keeps only rows that look like real data (a name plus an OVR or parseable
// attributes), so a stray prose/label line can't become a junk player.
// Where the attributes cell starts. Normally column 7, after the four
// player-card fields — but a paste produced before those existed puts the
// ratings straight after OVR, in column 3. Told apart by CONTENT: parseAttributes
// only returns something for real attribute vocabulary, so a jersey number, a
// dev trait or a blank never reads as a ratings cell.
// With the Training Results Past OVR column on, the ratings start at 8 — but
// a paste made before that column existed still starts them at 7, and is
// told apart the same way (real ratings vocabulary at index 7).
const attributesStartIndex = (row, withPast) => {
  if (parseAttributes(row?.[3])) return 3
  if (!withPast) return 7
  return parseAttributes(row?.[7]) ? 7 : 8
}

// Past OVR must be a plausible pre-training overall: 40–99 and within 20 of
// the OVR beside it. Anything else (a jersey number that slid into the slot
// from an older 8-column paste, say) reads as not captured.
const plausiblePast = (v, overall) => {
  const n = coerceNum(v)
  if (n == null || n < 40 || n > 99) return null
  if (overall != null && Math.abs(overall - n) > 20) return null
  return n
}

export function parseAttributeRows(rows, { pastOverall: withPast = false } = {}) {
  const out = []
  for (const row of rows || []) {
    const playerName = (row?.[0] ?? '').toString().trim()
    if (!playerName) continue
    const position = (row?.[1] ?? '').toString().trim()
    const overall = coerceNum(row?.[2])
    const attrStart = attributesStartIndex(row, withPast)
    // The four player-card fields, absent from a legacy row; shifted one
    // right when the Past OVR column is present.
    const cardAt = attrStart === 8 ? 4 : 3
    const pastOverall = attrStart === 8 ? plausiblePast(row?.[3], overall) : null
    const jerseyNumber = attrStart === 3 ? null : parseJerseyNumber(row?.[cardAt])
    const devTrait = attrStart === 3 ? null : normalizeDevTrait(row?.[cardAt + 1])
    const archetype = attrStart === 3 ? null : normalizeArchetype(row?.[cardAt + 2])
    const nil = attrStart === 3 ? null : parseNilAmount(row?.[cardAt + 3])
    // Attributes live in ONE cell (comma-separated pairs). If the AI used TABS
    // between pairs instead of commas, splitTsv scatters them into later
    // columns; rejoin everything from the start index on so no trailing ratings
    // are silently lost.
    const attrCell = Array.isArray(row)
      ? row.slice(attrStart).map((c) => String(c ?? '').trim()).filter(Boolean).join(', ')
      : row?.[attrStart]
    const attributes = parseAttributes(attrCell)
    // A row is real data if it carries ANY of the fields, not just ratings —
    // a player whose card was captured but whose ratings were not still has a
    // jersey number worth keeping.
    if (overall == null && !attributes && jerseyNumber == null && !devTrait && !archetype && nil == null) continue
    out.push({
      playerName, position, overall,
      ...(withPast ? { pastOverall } : {}),
      jerseyNumber, devTrait, archetype, nil, attributes: attributes || {},
    })
  }
  return out
}

// Serialize an entry list back to the 8-column TSV (for the paste grid's raw
// textarea round-trip). Attributes render as "CODE value" pairs in canonical order.
const blank = (v) => (v == null || v === '' ? '' : String(v))
export function serializeAttributeRows(entries, { pastOverall: withPast = false } = {}) {
  return (entries || [])
    .map((e) => {
      const attrs = e.attributes || {}
      const cell = GAME_ATTRIBUTE_ORDER
        .filter((name) => attrs[name] != null && attrs[name] !== '')
        .map((name) => `${ATTRIBUTE_ABBR[name] || name} ${attrs[name]}`)
        .join(', ')
      return [
        e.playerName || '',
        e.position || '',
        blank(e.overall),
        ...(withPast ? [blank(e.pastOverall)] : []),
        blank(e.jerseyNumber),
        blank(e.devTrait),
        blank(e.archetype),
        blank(e.nil),
        cell,
      ].join('\t')
    })
    .join('\n')
}
