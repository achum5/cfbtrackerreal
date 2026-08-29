import { describe, it, expect } from 'vitest'

// Mirrors ConferenceChampionshipHistory's conference resolution. The sync
// tags EVERY game in the save's conference-championship week as a CCG, so a
// fixed annual rivalry landing that week (Army-Navy) reaches this code and
// must not inherit a conference it never played for.
const resolve = (game, confOf) => {
  const explicit = game.conference || null
  if (explicit) return explicit
  const c1 = confOf(game.t1)
  const c2 = confOf(game.t2)
  return (c1 && c1 === c2) ? c1 : null
}
const confOf = (t) => ({ ARMY: 'American', NAVY: null, TULN: 'American', MEM: 'American', UGA: 'SEC', BAMA: 'SEC' }[t] ?? null)

describe('CCG conference resolution', () => {
  it('regression: Army-Navy does not inherit the American', () => {
    // Army realigned into the American, Navy stays independent — the old
    // `confOf(t1) || confOf(t2)` took whichever resolved first and filed
    // this as the American championship.
    expect(resolve({ t1: 'ARMY', t2: 'NAVY' }, confOf)).toBe(null)
  })

  it('resolves a real title game between two same-conference teams', () => {
    expect(resolve({ t1: 'TULN', t2: 'MEM' }, confOf)).toBe('American')
    expect(resolve({ t1: 'UGA', t2: 'BAMA' }, confOf)).toBe('SEC')
  })

  it('prefers an explicitly stored conference — the console entry path', () => {
    // Manual CCG entry always writes game.conference, so console dynasties
    // never depend on the stricter inference below it.
    expect(resolve({ conference: 'Big Ten', t1: 'ARMY', t2: 'NAVY' }, confOf)).toBe('Big Ten')
  })

  it('returns null rather than guessing when the two sides disagree', () => {
    expect(resolve({ t1: 'UGA', t2: 'TULN' }, confOf)).toBe(null)
  })
})
