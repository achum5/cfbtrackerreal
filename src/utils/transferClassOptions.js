// Class progression for an incoming PORTAL TRANSFER — the single source both
// the Google Sheet's per-row validation and the local grid's per-row dropdown
// read, and the same list the save validates an answer against.
//
// The recruiting screen labels a transfer with the class they held during the
// recruiting year, and that label does not say whether they have burned a
// redshirt. So a transfer listed "Fr" could enter next season as any of:
//   RS Fr  — they sat out the season just played
//   So     — they played it and progress normally
//   RS So  — they had already redshirted in an earlier season
// which is why the RS prefix is stripped before choosing the option set: all
// three answers stay available whatever the screen said.

const PROGRESSED = { Fr: 'So', So: 'Jr', Jr: 'Sr' }

const baseOf = (incomingClass) =>
  String(incomingClass ?? '').trim().replace(/^RS\s+/i, '')

/** The legal "updated class" answers for a transfer who came in at this class. */
export function getPortalTransferClassOptions(incomingClass) {
  const base = baseOf(incomingClass)
  const progressed = PROGRESSED[base]
  // An unrecognized label (blank, "Sr", something custom) falls back to the
  // freshman set, matching how the sheet has always behaved.
  if (!progressed) return ['RS Fr', 'So', 'RS So']
  return [`RS ${base}`, progressed, `RS ${progressed}`]
}

/**
 * The answer most transfers need: the normal one-year progression, keeping a
 * redshirt prefix the label already carried. Always one of the options above,
 * so it is a safe pre-selection the user still overrides for anyone who sat
 * out. Empty when the incoming class has no progression (unknown, or Sr).
 */
export function getPortalTransferDefaultClass(incomingClass) {
  const raw = String(incomingClass ?? '').trim()
  const progressed = PROGRESSED[baseOf(raw)]
  if (!progressed) return ''
  return /^RS\s+/i.test(raw) ? `RS ${progressed}` : progressed
}

/** True when `incomingClass` is a label this flow knows how to progress. */
export function isKnownTransferClass(incomingClass) {
  return PROGRESSED[baseOf(incomingClass)] != null
}
