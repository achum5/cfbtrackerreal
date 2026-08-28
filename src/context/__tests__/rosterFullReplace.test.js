import { describe, it, expect } from 'vitest'

// Mirrors saveRoster's fullRoster handling of team players missing from the
// imported sheet. Merge mode preserves them untouched; a full-roster import
// drops this year's membership (record and history stay); exhausted seniors
// keep the graduation stamping either way.
function preserveMissingPlayer(p, { year, fullRoster, sheetSize }) {
  const fullRosterReplace = fullRoster === true && sheetSize >= 30
  const prevY = year - 1
  const clsPrev = p.classByYear?.[prevY]
  const exhausted = clsPrev === 'Sr' || clsPrev === 'RS Sr'
  const dropYear = (pl) => {
    const t = { ...(pl.teamsByYear || {}) }; delete t[year]
    const c = { ...(pl.classByYear || {}) }; delete c[year]
    return { ...pl, teamsByYear: t, classByYear: c }
  }
  if (!exhausted && fullRosterReplace && p.teamsByYear?.[year] != null) return dropYear(p)
  if (!exhausted) return p
  if (p.teamsByYear?.[year] == null) return p
  return { ...dropYear(p), movementByYear: { ...(p.movementByYear || {}), [prevY]: { type: 'departure', departure: 'graduated' } } }
}

const YEAR = 2027
const transferSoph = {
  pid: 1, name: 'Gone Guy',
  teamsByYear: { 2026: 42, [YEAR]: 42 },
  classByYear: { 2026: 'Fr', [YEAR]: 'So' },
}

describe('full-roster import removal semantics', () => {
  it('regression: a non-senior missing from a full import loses this year\'s membership', () => {
    // "Every time I import a roster it keeps adding old players back" — the
    // merge preserved a departed underclassman WITH teamsByYear[year], so he
    // rejoined the roster on every full import.
    const out = preserveMissingPlayer(transferSoph, { year: YEAR, fullRoster: true, sheetSize: 70 })
    expect(out.teamsByYear[YEAR]).toBeUndefined()
    expect(out.teamsByYear[2026]).toBe(42) // career history intact
    expect(out.movementByYear).toBeUndefined() // no fabricated reason
  })

  it('merge mode (no flag) still preserves them — partial-sheet safety', () => {
    const out = preserveMissingPlayer(transferSoph, { year: YEAR, fullRoster: false, sheetSize: 70 })
    expect(out.teamsByYear[YEAR]).toBe(42)
  })

  it('a tiny malformed paste cannot empty the roster even with the flag', () => {
    const out = preserveMissingPlayer(transferSoph, { year: YEAR, fullRoster: true, sheetSize: 4 })
    expect(out.teamsByYear[YEAR]).toBe(42)
  })

  it('an exhausted senior still gets the graduation stamping', () => {
    const senior = {
      pid: 2, name: 'Done Dan',
      teamsByYear: { 2026: 42, [YEAR]: 42 },
      classByYear: { 2026: 'RS Sr', [YEAR]: 'RS Sr' },
    }
    const out = preserveMissingPlayer(senior, { year: YEAR, fullRoster: true, sheetSize: 70 })
    expect(out.teamsByYear[YEAR]).toBeUndefined()
    expect(out.movementByYear[2026]).toEqual({ type: 'departure', departure: 'graduated' })
  })
})
