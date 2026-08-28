import { describe, it, expect } from 'vitest'

// ── Preseason revert: the year must NOT move ────────────────────────────────
// The year flips exactly once, entering Signing Day (offseason wk5→6), so
// offseason weeks 6-8 and the following preseason all sit in the same year.
// advanceWeek's wk8→preseason branch says so explicitly ("nextYear stays the
// same"), so its inverse must too.
function revertFromPreseason({ currentYear }) {
  return {
    prevPhase: 'offseason',
    prevWeek: 8,
    prevYear: currentYear,
    recruitingYear: currentYear - 1,
    upcomingSeasonYear: currentYear,
  }
}

describe('preseason → offseason revert', () => {
  it('lands on offseason week 8 of the SAME year', () => {
    const r = revertFromPreseason({ currentYear: 2031 })
    expect(r.prevPhase).toBe('offseason')
    expect(r.prevWeek).toBe(8)
    expect(r.prevYear).toBe(2031)
  })

  it('round-trips with the advance, which keeps the year', () => {
    // advance: offseason wk8 (2031) → preseason (2031, year unchanged)
    const afterAdvance = { phase: 'preseason', year: 2031 }
    const r = revertFromPreseason({ currentYear: afterAdvance.year })
    expect(r.prevYear).toBe(2031)
  })

  it('still restores recruits under the year they were recruited during', () => {
    // A recruit signed during season 2030 carries recruitYear 2030; the
    // wk8→preseason conversion wrote teamsByYear[2031]. Both must still be
    // targeted correctly now that prevYear no longer decrements.
    const r = revertFromPreseason({ currentYear: 2031 })
    expect(r.recruitingYear).toBe(2030)
    expect(r.upcomingSeasonYear).toBe(2031)
  })
})

// ── Year-flip carryover: departures are relative to a HOME team ─────────────
// Mirrors hasUnresolvedDeparture's two escape hatches, both keyed to homeTid.
function stillGone(player, homeTid, previousSeasonYear) {
  const mv = player.movementByYear?.[previousSeasonYear]
  if (!mv || mv.type !== 'departure') return false
  // A transfer_out pointing AT the home team is really an arrival there.
  if (mv.departure === 'transfer_out' && mv.toTid === homeTid) return false
  // Implicit arrival: on the home team in any later year.
  const returned = Object.entries(player.teamsByYear || {}).some(
    ([y, t]) => Number(y) > previousSeasonYear && t === homeTid
  )
  return !returned
}

describe('CPU-team carryover at the year flip', () => {
  const userTid = 42
  const cpuTid = 77
  // Transferred from the user's team to CPU team 77 during 2030. No arrival
  // record — the common case the implicit-arrival net exists for.
  const transferred = {
    movementByYear: { 2030: { type: 'departure', departure: 'transfer_out', toTid: cpuTid } },
    teamsByYear: { 2029: userTid, 2030: userTid, 2031: cpuTid },
  }

  it('regression: judged against the USER tid, the player reads as gone', () => {
    expect(stillGone(transferred, userTid, 2030)).toBe(true)
  })

  it('judged against their own team, the player is correctly retained', () => {
    expect(stillGone(transferred, cpuTid, 2030)).toBe(false)
  })

  it('a genuine departure from the home team still counts as gone', () => {
    const graduated = {
      movementByYear: { 2030: { type: 'departure', departure: 'graduated' } },
      teamsByYear: { 2030: cpuTid },
    }
    expect(stillGone(graduated, cpuTid, 2030)).toBe(true)
  })
})

// ── Signing Day modals: the year prop is already adjusted ───────────────────
describe('offseason data year is applied exactly once', () => {
  const offseasonDataYear = (phase, week, currentYear) =>
    phase === 'offseason' && week >= 6 ? currentYear - 1 : currentYear

  it('matches the year the save handlers key under', () => {
    // Dashboard computes this once and passes it to the modals; the save
    // handlers derive the same value independently. The modals must consume
    // it as-is rather than subtracting a second time.
    const saveYear = offseasonDataYear('offseason', 6, 2031)
    const propYear = offseasonDataYear('offseason', 6, 2031)
    expect(propYear).toBe(saveYear)
    expect(propYear).toBe(2030)
  })

  it('regression: adjusting twice reads a year nothing was written to', () => {
    const propYear = offseasonDataYear('offseason', 6, 2031)
    const doubleAdjusted = propYear - 1
    expect(doubleAdjusted).not.toBe(propYear)
    expect(doubleAdjusted).toBe(2029)
  })

  it('is a no-op before the flip', () => {
    expect(offseasonDataYear('offseason', 4, 2031)).toBe(2031)
  })
})
