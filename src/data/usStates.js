// US states — ONE list, one normalizer.
//
// The app's canonical form is the 2-letter uppercase code, plus the sentinel
// 'Non-US'. Every dropdown, every Google-Sheets validation and every AI prompt
// already demanded that, but nothing ENFORCED it: the sheet and paste parsers
// only trimmed, so a reply that wrote "Georgia" instead of "GA" was stored
// verbatim. A full name then breaks things quietly downstream —
//
//   • the Players by State page filters on exact uppercase equality, so the
//     player vanishes from their own state,
//   • the bio line links to /players/state/Georgia, which resolves to nothing,
//   • the CFB 27 save sync treats a state mismatch as a hard veto, so the
//     player stops matching their save-file row (and their portrait),
//   • the recruit card prints the value into a chip sized for two characters.
//
// So the fix is normalization at every WRITE, from this one table. The
// five duplicate copies of the code list that used to live in PlayerEdit,
// PlayerEditModal, sheetsService, RecruitCard and PlayersByState now all read
// from here.

export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington, D.C.' },
  // Not a state — the sentinel for an international player. It is a real,
  // selectable value in every dropdown, so it belongs in the same list.
  { code: 'Non-US', name: 'Non-US' },
]

/** Every canonical value, in dropdown order. */
export const STATE_CODES = US_STATES.map(s => s.code)

/** Full display name for a code ('GA' → 'Georgia'); unknown codes pass through. */
export function stateName(code) {
  const c = String(code ?? '').trim()
  if (!c) return ''
  const hit = US_STATES.find(s => s.code.toLowerCase() === c.toLowerCase())
  return hit ? hit.name : c
}

// Lookup keyed on letters only, so "New York", "new york", "NewYork" and
// "NEW-YORK" all land on the same entry. The CFB 27 save writes CamelCase with
// no spaces ("NewHampshire"), a pasted AI reply writes spaces, and a human
// might write either.
const squash = (v) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '')
const BY_SQUASHED = new Map()
for (const { code, name } of US_STATES) {
  BY_SQUASHED.set(squash(code), code)
  BY_SQUASHED.set(squash(name), code)
}
// Spellings that reach us from somewhere but are not the canonical name.
for (const [alias, code] of [
  ['districtofcolumbia', 'DC'], ['washingtondc', 'DC'], ['dc', 'DC'],
  ['nonus', 'Non-US'], ['international', 'Non-US'], ['foreign', 'Non-US'],
  ['outsideus', 'Non-US'], ['na', ''],
]) {
  if (code) BY_SQUASHED.set(alias, code)
}

/**
 * Any spelling of a state → the canonical code, or '' when it isn't one.
 *
 * Returns '' rather than the input for anything unrecognized: a value that is
 * not a state is worse than no value, because it survives into the state page,
 * the save-file match and the recruit card, where it silently fails to match.
 * Blank is the app's normal "unknown", and the UI already handles it.
 */
export function normalizeStateCode(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return BY_SQUASHED.get(squash(raw)) || ''
}

/**
 * The state column's allowed values, for a prompt. Generated from the same list
 * the dropdowns and the parsers use, so the three cannot drift — the prompts
 * used to hard-code 51 codes while the dropdown offered 52, leaving no way for
 * an AI to mark an international player.
 */
export function stateCodesLine() {
  return STATE_CODES.join(' | ')
}

/** True when two state values mean the same place, whatever their spelling. */
export function sameState(a, b) {
  const na = normalizeStateCode(a)
  const nb = normalizeStateCode(b)
  return !!na && na === nb
}
