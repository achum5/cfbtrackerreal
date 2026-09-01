import { describe, it, expect } from 'vitest'
import { getGameLogCells, GAME_LOG_BASE_COLSPAN } from '../playerGameLogColumns'

// Fixtures are REAL box score rows lifted from an exported dynasty, not
// hand-invented shapes. That matters: the bug these tests exist to catch is a
// field name that does not exist in the data, which reads as `undefined || 0`
// and renders a confident zero rather than failing.
const GAME = {
  passing: { playerName: 'X', qBRating: 144.6, comp: 26, attempts: 44, yards: 291, tD: 4, iNT: 0, long: 27 },
  rushing: { playerName: 'X', carries: 17, yards: 82, tD: 1, fumbles: 0, brokenTackles: 3, yAC: 42, '20+': 1, long: 26 },
  receiving: { playerName: 'X', receptions: 9, yards: 105, tD: 0, rAC: 29, drops: 0, long: 16 },
  blocking: { playerName: 'X', pancakes: null, sacksAllowed: 2 },
  defense: { playerName: 'X', solo: 6, assists: 2, tFL: 0, sack: 0, iNT: 0, iNTYards: 0, iNTLong: 0, deflections: 1, fF: 0, fR: 0, tD: 0 },
  kicking: { playerName: 'X', fGM: 0, fGA: 0, fGLong: 0, xPM: 4, xPA: 4 },
  punting: { playerName: 'X', punts: 8, yards: 315, netYards: 39.4, in20: 1, tB: 0, long: 59 },
  kickReturn: { playerName: 'X', kR: 2, yards: 56, long: 32, tD: 0 },
  puntReturn: { playerName: 'X', pR: 3, yards: 41, long: 20, tD: 0 },
}

const values = (statType, opts) =>
  getGameLogCells(statType, opts).map(c => (c ? c.get(GAME) : null))

describe('column count matches the season table', () => {
  // A mismatch shears the whole grid sideways with no error, so every
  // combination of the two conditional columns is checked.
  const conditional = ['passing', 'rushing', 'receiving', 'blocking', 'defense', 'kicking', 'punting']
  for (const st of conditional) {
    for (const hasGamesCol of [false, true]) {
      for (const hasSnapsCol of [false, true]) {
        it(`${st} (G:${hasGamesCol} Snaps:${hasSnapsCol})`, () => {
          const cells = getGameLogCells(st, { hasGamesCol, hasSnapsCol })
          const colSpan = GAME_LOG_BASE_COLSPAN[st] + (hasGamesCol ? 1 : 0) + (hasSnapsCol ? 1 : 0)
          expect(cells.length + 3).toBe(colSpan)
        })
      }
    }
  }
  for (const st of ['kickReturn', 'puntReturn']) {
    it(`${st} (no conditional columns)`, () => {
      expect(getGameLogCells(st).length + 3).toBe(GAME_LOG_BASE_COLSPAN[st])
    })
  }
})

describe('passing', () => {
  it('reads attempts from `attempts`, not `att`', () => {
    // The reported bug: Cmp/Att rendered "26/0" and every rate was 0.0.
    const v = values('passing')
    expect(v[1]).toBe('26/44')
    expect(v[2]).toBe('59.1')       // Pct
    expect(v[4]).toBe('6.6')        // Y/A
  })
  it('computes the rate columns off real attempts', () => {
    const v = values('passing')
    expect(v[6]).toBe('9.1')        // TD%
    expect(v[8]).toBe('0.0')        // INT%
    expect(v[9]).toBe('4:0')        // TD:INT
  })
  it('survives a game with zero attempts without dividing by zero', () => {
    const empty = { passing: { comp: 0, attempts: 0, yards: 0, tD: 0, iNT: 0, long: 0 } }
    const v = getGameLogCells('passing').map(c => (c ? c.get(empty) : null))
    expect(v[1]).toBe('0/0')
    expect(v[2]).toBe('0.0')
  })
})

describe('rushing', () => {
  it('reads broken tackles from `brokenTackles`, not `bT`', () => {
    expect(values('rushing').at(-1)).toBe(3)
  })
  it('fills YAC and 20+ from the box score', () => {
    const v = values('rushing')
    expect(v[6]).toBe(42)   // YAC
    expect(v[7]).toBe(1)    // 20+
  })
})

describe('other categories read their real fields', () => {
  it('receiving fills RAC', () => {
    expect(values('receiving')[6]).toBe(29)
  })
  it('defense totals tackles and fills IntYd/TD/FR', () => {
    const v = values('defense')
    expect(v[3]).toBe(8)    // Tot = solo + assists
    expect(v[7]).toBe(0)    // IntYd
    expect(v[8]).toBe(0)    // TD
    expect(v[11]).toBe(0)   // FR
  })
  it('punting average matches the stored net average', () => {
    // 315 / 8 = 39.4, which is exactly what the row carries as netYards.
    expect(values('punting')[3]).toBe('39.4')
  })
  it('kicking computes XP% without dividing by zero on 0 FGA', () => {
    const v = values('kicking')
    expect(v[3]).toBe('0.0')   // FG% with 0 attempts
    expect(v[7]).toBe('100.0') // XP%
  })
  it('returns read kR and pR respectively', () => {
    expect(values('kickReturn')[1]).toBe(2)
    expect(values('puntReturn')[1]).toBe(3)
  })
})

describe('blank cells', () => {
  it('keeps AV blank and adds G/Snaps blanks when those columns exist', () => {
    const withBoth = getGameLogCells('receiving', { hasGamesCol: true, hasSnapsCol: true })
    expect(withBoth[0]).toBeNull()        // G
    expect(withBoth[1]).toBeNull()        // AV
    expect(withBoth.at(-1)).toBeNull()    // Snaps
  })
  it('returns nothing for an unknown stat type', () => {
    expect(getGameLogCells('nonsense')).toEqual([])
  })
})
