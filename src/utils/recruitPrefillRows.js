// Serialize the recruits a commitments modal already knows about into the
// 17-column TSV the local paste grid renders — the same set, in the same
// column order, that refreshRecruitingSheetPrefill writes into the Google
// Sheet. Both entry modes now open on the existing class instead of a blank
// row, so "Edit" is an edit rather than a re-type.
//
// Only the 17 VISIBLE columns are emitted (A→P plus the single Attributes
// cell). The sheet's hidden pid / NIL / Updated columns have no cell in the
// grid, so the import reconciles by name exactly as the AI-paste flow always
// has.

import { ATTRIBUTE_COLUMNS, ATTRIBUTE_ABBR } from './recruitAttributes'
import { normalizeStateCode } from '../data/usStates'
import { getTeamNameLabel, getTidFromAbbr } from '../data/teamRegistry'

const str = (v) => (v == null ? '' : String(v))
const num = (v) => (v == null || v === '' || Number(v) === 0 ? '' : String(v))

// Stars round-trip as ☆ symbols — that's what STAR_RATINGS offers in the
// grid's dropdown and what the parser reads back.
function starsToSymbols(n) {
  const count = Math.max(0, Math.min(5, Math.round(Number(n) || 0)))
  return '☆'.repeat(count)
}

// Prev Team is a combobox of full team NAMES, so resolve whatever the record
// holds (a tid, an abbr, or a name) to the live label. Anything that doesn't
// resolve is passed through untouched rather than dropped — an FCS or
// hand-typed school stays visible and re-saves as it was.
export function previousTeamLabel(value, teams) {
  if (value == null || value === '') return ''
  const tid = getTidFromAbbr(value, teams)
  if (tid != null) return getTeamNameLabel(teams, tid) || String(value)
  return String(value)
}

function attributesCell(attributes) {
  if (!attributes || typeof attributes !== 'object') return ''
  return ATTRIBUTE_COLUMNS
    .filter((name) => attributes[name] != null && attributes[name] !== '')
    .map((name) => `${ATTRIBUTE_ABBR[name] || name} ${attributes[name]}`)
    .join(', ')
}

/** One prefill record → the grid's 17 cells, in RECRUIT_PASTE_COLUMNS order. */
export function recruitPrefillRow(r, teams) {
  return [
    str(r?.name),
    str(r?.class) || 'HS',
    str(r?.position),
    str(r?.archetype),
    starsToSymbols(r?.stars),
    num(r?.nationalRank),
    num(r?.stateRank),
    num(r?.positionRank),
    str(r?.height),
    num(r?.weight),
    str(r?.hometown),
    normalizeStateCode(r?.state) || '',
    str(r?.gemBust),
    str(r?.devTrait),
    previousTeamLabel(r?.previousTeam, teams),
    str(r?.commitment),
    attributesCell(r?.attributes),
  ]
}

/** The whole prefill set as the TSV LocalDataEntry seeds its grid from. */
export function recruitPrefillTsv(recruits, teams) {
  if (!Array.isArray(recruits) || recruits.length === 0) return ''
  return recruits
    .filter((r) => r && str(r.name).trim())
    .map((r) => recruitPrefillRow(r, teams).join('\t'))
    .join('\n')
}

/**
 * Every spelling of the team a commitments sheet is being filled for — label,
 * full name, short name and abbr. Fed to the row parser so a lone team cell in
 * the tail is read as the Commitment rather than as the recruit's Prev Team.
 */
export function commitTeamNames(teams, tid) {
  const team = tid != null ? teams?.[tid] : null
  const out = []
  const push = (v) => { if (v) out.push(String(v)) }
  push(getTeamNameLabel(teams, tid))
  push(team?.name)
  push(team?.teamName)
  push(team?.abbr)
  for (const a of team?.aliases || []) push(a)
  return out
}
