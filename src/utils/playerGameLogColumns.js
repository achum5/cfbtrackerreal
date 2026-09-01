// Per-game cell definitions for the expanded game log on a player's Stats tab.
//
// The game log renders as rows of the SAME table as the season lines, so each
// stat type's cell list must line up 1:1 with that table's header row after
// the three identity columns (Year/Class/Team). Two of those headers are
// conditional — G shows only for the player's primary stat, Snaps only when
// the dynasty has snap data — so both are passed in explicitly.
//
// Extracted from Player.jsx because the failure mode here is SILENT. Field
// names come from the box score rows (see boxScoreConstants.js headers,
// camelCased), and a wrong one reads as `undefined || 0` and renders a
// confident zero. That is exactly what happened: passing used `att` where the
// data says `attempts`, so Cmp/Att showed "10/0" and Pct, Y/A, TD% and INT%
// were all 0.0 on every game. Nothing failed; it just quietly lied. As a
// module with fixtures built from real box score rows, that class of bug is
// caught by a test instead of by a user.
//
// `null` entries are real columns with no per-game meaning (AV, YDS/G, season
// ratios, Snaps). They still render an empty cell so the grid stays aligned.

const rate = (n, d, digits = 1) => (d ? (n / d).toFixed(digits) : '0.0')
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0')
const n0 = (v) => v || 0

/**
 * Ordered cells for one stat type, matching the season table's columns after
 * Year/Class/Team.
 * @returns {Array<null|{get:(game:object)=>string|number, bold?:boolean}>}
 */
export function getGameLogCells(statType, { hasGamesCol = false, hasSnapsCol = false } = {}) {
  const lead = []
  if (hasGamesCol) lead.push(null)   // G — always 1 for a single game
  lead.push(null)                    // AV — a season-level rating
  const tail = hasSnapsCol ? [null] : []

  switch (statType) {
    case 'passing':
      return [...lead,
        { get: g => `${n0(g.passing?.comp)}/${n0(g.passing?.attempts)}` },
        { get: g => pct(n0(g.passing?.comp), n0(g.passing?.attempts)) },
        { get: g => n0(g.passing?.yards), bold: true },
        { get: g => rate(n0(g.passing?.yards), n0(g.passing?.attempts)) },
        { get: g => n0(g.passing?.tD), bold: true },
        { get: g => pct(n0(g.passing?.tD), n0(g.passing?.attempts)) },
        { get: g => n0(g.passing?.iNT) },
        { get: g => pct(n0(g.passing?.iNT), n0(g.passing?.attempts)) },
        { get: g => `${n0(g.passing?.tD)}:${n0(g.passing?.iNT)}` },
        { get: g => n0(g.passing?.long) },
        null,                                   // Sck — box score has no sacks-taken
        ...tail]
    case 'rushing':
      return [...lead,
        { get: g => n0(g.rushing?.carries) },
        { get: g => n0(g.rushing?.yards), bold: true },
        { get: g => rate(n0(g.rushing?.yards), n0(g.rushing?.carries)) },
        { get: g => n0(g.rushing?.tD), bold: true },
        null,                                   // YDS/G — same as Yds for one game
        { get: g => n0(g.rushing?.yAC) },
        { get: g => n0(g.rushing?.['20+']) },
        { get: g => n0(g.rushing?.long) },
        { get: g => n0(g.rushing?.fumbles) },
        { get: g => n0(g.rushing?.brokenTackles) },
        ...tail]
    case 'receiving':
      return [...lead,
        { get: g => n0(g.receiving?.receptions) },
        { get: g => n0(g.receiving?.yards), bold: true },
        { get: g => rate(n0(g.receiving?.yards), n0(g.receiving?.receptions)) },
        { get: g => n0(g.receiving?.tD), bold: true },
        null,                                   // YDS/G
        { get: g => n0(g.receiving?.rAC) },
        { get: g => n0(g.receiving?.long) },
        { get: g => n0(g.receiving?.drops) },
        ...tail]
    case 'blocking':
      return [...lead,
        { get: g => n0(g.blocking?.sacksAllowed) },
        ...tail]
    case 'defense':
      return [...lead,
        { get: g => n0(g.defense?.solo) },
        { get: g => n0(g.defense?.assists) },
        { get: g => n0(g.defense?.solo) + n0(g.defense?.assists), bold: true },
        { get: g => n0(g.defense?.tFL) },
        { get: g => n0(g.defense?.sack) },
        { get: g => n0(g.defense?.iNT) },
        { get: g => n0(g.defense?.iNTYards) },
        { get: g => n0(g.defense?.tD) },
        { get: g => n0(g.defense?.deflections) },
        { get: g => n0(g.defense?.fF) },
        { get: g => n0(g.defense?.fR) },
        ...tail]
    case 'kicking':
      return [...lead,
        { get: g => n0(g.kicking?.fGM) },
        { get: g => n0(g.kicking?.fGA) },
        { get: g => pct(n0(g.kicking?.fGM), n0(g.kicking?.fGA)) },
        { get: g => n0(g.kicking?.fGLong) },
        { get: g => n0(g.kicking?.xPM) },
        { get: g => n0(g.kicking?.xPA) },
        { get: g => pct(n0(g.kicking?.xPM), n0(g.kicking?.xPA)) },
        ...tail]
    case 'punting':
      return [...lead,
        { get: g => n0(g.punting?.punts) },
        { get: g => n0(g.punting?.yards) },
        { get: g => rate(n0(g.punting?.yards), n0(g.punting?.punts)) },
        { get: g => n0(g.punting?.long) },
        { get: g => n0(g.punting?.in20) },
        { get: g => n0(g.punting?.tB) },
        ...tail]
    case 'kickReturn':
      return [...lead,
        { get: g => n0(g.kickReturn?.kR) },
        { get: g => n0(g.kickReturn?.yards), bold: true },
        { get: g => rate(n0(g.kickReturn?.yards), n0(g.kickReturn?.kR)) },
        { get: g => n0(g.kickReturn?.tD) },
        { get: g => n0(g.kickReturn?.long) },
        ...tail]
    case 'puntReturn':
      return [...lead,
        { get: g => n0(g.puntReturn?.pR) },
        { get: g => n0(g.puntReturn?.yards), bold: true },
        { get: g => rate(n0(g.puntReturn?.yards), n0(g.puntReturn?.pR)) },
        { get: g => n0(g.puntReturn?.tD) },
        { get: g => n0(g.puntReturn?.long) },
        ...tail]
    default:
      return []
  }
}

// Season-table width, in columns, for each stat type BEFORE the two
// conditional ones. Kept next to the cell lists above because the two must
// move together — this is what the runtime alignment check compares against.
export const GAME_LOG_BASE_COLSPAN = {
  passing: 15, rushing: 14, receiving: 12, blocking: 5, defense: 15,
  kicking: 11, punting: 10, kickReturn: 9, puntReturn: 9,
}
