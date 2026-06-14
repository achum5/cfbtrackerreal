// Pure parser for one recruiting-sheet row → recruit object.
//
// Extracted from readRecruitingFromSheet so the column layout is unit-testable
// without the Google Sheets API. Columns A–O (0–14) are the EXISTING commitment
// fields and are parsed identically to the legacy reader — a legacy commitments
// sheet (no P+) round-trips byte-for-byte. The Targets feature appends:
//   P  (15)                 Commitment  — '' = your team, 'Uncommitted' = open, team = there
//   Q.. (16 … 16+N-1)       one column per NAMED attribute (ATTRIBUTE_COLUMNS order)
//   next col                pid         — hidden, for stable pid-first reconciliation
//
// Each attribute is its own named column (not a position-relative slot), so the
// reader maps column → attribute by fixed position in ATTRIBUTE_COLUMNS. A
// blank/absent column (legacy sheet) yields commitment:'' (→ committed to you),
// attributes:null, pid:undefined.

import { ATTRIBUTE_COLUMNS } from './recruitAttributes'

export const COMMITMENT_COL = 15
export const ATTR_COL_START = 16
export const ATTR_COL_END = ATTR_COL_START + ATTRIBUTE_COLUMNS.length // exclusive
export const PID_COL = ATTR_COL_END
// Total column count A..pid (used to size the sheet grid).
export const TOTAL_COLS = PID_COL + 1

// Convert a 0-based column index to an A1 letter (0→A, 26→AA, 58→BG).
function colLetter(idx) {
  let s = ''
  for (let n = idx + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  }
  return s
}

// Read range wide enough for A..pid and tall enough for a full season of targets.
export const RECRUITING_READ_RANGE = `Commitments!A2:${colLetter(PID_COL)}600`

const NON_PORTAL_CLASSES = ['HS', 'JUCO Fr', 'JUCO So', 'JUCO Jr']

const starsSymbolToNumber = (s) => (s ? (String(s).match(/☆/g) || []).length : 0)
const trim = (v) => (v != null ? String(v).trim() : '')
const intOrNull = (v) => (v ? parseInt(v, 10) : null)

function parseAttributes(row) {
  const out = {}
  for (let i = 0; i < ATTRIBUTE_COLUMNS.length; i++) {
    const raw = row[ATTR_COL_START + i]
    if (raw == null || String(raw).trim() === '') continue
    const n = Number(String(raw).trim())
    if (Number.isFinite(n)) out[ATTRIBUTE_COLUMNS[i]] = n
  }
  return Object.keys(out).length ? out : null
}

export function parseRecruitingRow(row) {
  if (!row || !trim(row[0])) return null
  const recruitClass = trim(row[1]) || 'HS'
  const pidRaw = row[PID_COL]
  return {
    // ── existing A–O fields (parsed exactly as the legacy reader) ──
    name: trim(row[0]),
    class: recruitClass,
    position: trim(row[2]),
    archetype: trim(row[3]),
    stars: starsSymbolToNumber(row[4]),
    nationalRank: intOrNull(row[5]),
    stateRank: intOrNull(row[6]),
    positionRank: intOrNull(row[7]),
    height: trim(row[8]),
    weight: intOrNull(row[9]),
    hometown: trim(row[10]),
    state: trim(row[11]),
    gemBust: trim(row[12]),
    devTrait: trim(row[13]), // blank stays blank — dev traits are hidden until signing day
    previousTeam: trim(row[14]),
    isPortal: !NON_PORTAL_CLASSES.includes(recruitClass),
    // ── Targets extension (harmless on a legacy sheet) ──
    commitment: trim(row[COMMITMENT_COL]),
    attributes: parseAttributes(row),
    pid: trim(pidRaw) !== '' ? Number(trim(pidRaw)) : undefined,
  }
}

export function parseRecruitingRows(rows) {
  return (rows || []).map(parseRecruitingRow).filter(Boolean)
}
