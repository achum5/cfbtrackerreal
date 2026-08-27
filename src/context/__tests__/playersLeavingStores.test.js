import { describe, it, expect } from 'vitest'
import { getPlayersLeaving, lookupByTeamYear } from '../DynastyContext'

// Players Leaving lives in THREE stores that must be written together:
//   1. teams[tid].byYear[year].playersLeaving   <- getPlayersLeaving reads this FIRST
//   2. playersLeavingByTeamYear, dual-keyed abbr AND tid
//      (lookupByTeamYear checks the TID key before the abbr key)
//   3. playersLeavingByYear[year]               <- legacy fallback
//
// handlePlayersLeavingSave (the console-entry flow) writes all three. When
// CFB27 sync began writing the same store it wrote only #3 and the abbr half
// of #2 — correct on a dynasty that had never entered Players Leaving by
// hand, but on one that had, both higher-priority reads still returned the
// stale manual value and the synced projection was invisible. These pin the
// precedence that makes a partial write fail silently.

const SYNCED = [{ pid: 1, name: 'Synced Departure', reason: 'Transfer' }]
const STALE = [{ pid: 99, name: 'Stale Manual Entry', reason: 'Graduating' }]

const dynasty = ({ teamsByYear, byTeamYear, byYear }) => ({
  currentYear: 2026,
  teams: {
    54: { tid: 54, abbr: 'UMASS', name: 'UMass', byYear: teamsByYear || {} },
  },
  playersLeavingByTeamYear: byTeamYear || {},
  playersLeavingByYear: byYear || {},
})

describe('getPlayersLeaving store precedence', () => {
  it('reads the per-tid teams store ahead of both flat stores', () => {
    const d = dynasty({
      teamsByYear: { 2026: { playersLeaving: STALE } },
      byTeamYear: { UMASS: { 2026: SYNCED }, 54: { 2026: SYNCED } },
      byYear: { 2026: SYNCED },
    })
    // A writer that skips the teams store cannot dislodge a stale value here.
    expect(getPlayersLeaving(d, 54, 2026)).toEqual(STALE)
  })

  it('prefers the tid key over the abbr key within playersLeavingByTeamYear', () => {
    const d = dynasty({ byTeamYear: { UMASS: { 2026: SYNCED }, 54: { 2026: STALE } } })
    expect(lookupByTeamYear(d.playersLeavingByTeamYear, d, 54, 2026)).toEqual(STALE)
  })

  it('returns the synced value once all three stores agree', () => {
    const d = dynasty({
      teamsByYear: { 2026: { playersLeaving: SYNCED } },
      byTeamYear: { UMASS: { 2026: SYNCED }, 54: { 2026: SYNCED } },
      byYear: { 2026: SYNCED },
    })
    expect(getPlayersLeaving(d, 54, 2026)).toEqual(SYNCED)
    expect(lookupByTeamYear(d.playersLeavingByTeamYear, d, 54, 2026)).toEqual(SYNCED)
  })

  it('falls back to the year-only store when neither team-scoped store has it', () => {
    const d = dynasty({ byYear: { 2026: SYNCED } })
    expect(getPlayersLeaving(d, 54, 2026)).toEqual(SYNCED)
  })

  it('resolves by abbr as well as tid', () => {
    const d = dynasty({ byTeamYear: { UMASS: { 2026: SYNCED } } })
    expect(getPlayersLeaving(d, 'UMASS', 2026)).toEqual(SYNCED)
  })
})
