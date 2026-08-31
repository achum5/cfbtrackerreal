import { describe, it, expect } from 'vitest'
import { healStrandedTransferDestinations } from '../DynastyContext'

// Regression tests for the pre-2026-08-27 transfer-destinations strand:
// a row whose team text failed tid resolution wrote teamsByYear[nextYear] =
// null, making the player invisible on EVERY roster (reported as "transfers
// not showing up on their new teams"). The save-time fix only stops new
// strands; this heal re-applies the user's own stored sheet rows to repair
// data damaged by earlier imports.

// Deterministic resolver so the tests don't depend on the live registry:
// numbers pass through, 'OSU' resolves, everything else fails.
const resolve = (v) => {
  if (typeof v === 'number') return v
  if (v === 'OSU') return 79
  return null
}

const strandedPlayer = (over = {}) => ({
  pid: 1,
  name: "D'Marcus Smith Jr.",
  teamsByYear: { 2027: 42, 2028: null },
  movementByYear: { 2027: { type: 'departure', departure: 'transfer_out', toTid: null } },
  team: 42,
  ...over,
})

const dynastyWith = (players, dests) => ({
  players,
  transferDestinationsByTeamYear: dests,
})

describe('healStrandedTransferDestinations', () => {
  it('re-homes a null slot from the stored row when the team now resolves', () => {
    const d = dynastyWith(
      [strandedPlayer()],
      { UK: { 2027: [{ playerName: "D'Marcus Smith Jr.", newTeam: 'OSU', newTeamTid: null }] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    const p = healed.players[0]
    expect(p.teamsByYear[2028]).toBe(79)
    expect(p.team).toBe(79)
    expect(p.movementByYear['2027'].toTid).toBe(79)
    // Untouched year survives
    expect(p.teamsByYear[2027]).toBe(42)
  })

  it('prefers the stored newTeamTid over re-resolving text', () => {
    const d = dynastyWith(
      [strandedPlayer()],
      { UK: { 2027: [{ playerName: "D'Marcus Smith Jr.", newTeam: 'UNRESOLVABLE', newTeamTid: 79 }] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    expect(healed.players[0].teamsByYear[2028]).toBe(79)
  })

  it('matches the sheet name punctuation/spacing-blind', () => {
    const d = dynastyWith(
      [strandedPlayer()],
      // Sheet had no apostrophe/period — the exact mismatch that skipped rows.
      { UK: { 2027: [{ playerName: 'DMarcus Smith Jr', newTeam: 'OSU' }] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    expect(healed.players[0].teamsByYear[2028]).toBe(79)
  })

  it('dual-keyed duplicate rows (abbr + tid keys) agree and still heal', () => {
    const row = { playerName: "D'Marcus Smith Jr.", newTeam: 'OSU' }
    const d = dynastyWith(
      [strandedPlayer()],
      { UK: { 2027: [row] }, 42: { 2027: [row] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    expect(healed.players[0].teamsByYear[2028]).toBe(79)
  })

  it('leaves the player alone when matching rows conflict on destination', () => {
    const d = dynastyWith(
      [strandedPlayer()],
      { UK: { 2027: [
        { playerName: "D'Marcus Smith Jr.", newTeam: 'OSU' },
        { playerName: "D'Marcus Smith Jr.", newTeamTid: 99 },
      ] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    expect(healed).toBe(d) // untouched — no partial guesses
  })

  it('leaves the player alone when the team still cannot resolve', () => {
    const d = dynastyWith(
      [strandedPlayer()],
      { UK: { 2027: [{ playerName: "D'Marcus Smith Jr.", newTeam: 'STILL BROKEN' }] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    expect(healed).toBe(d)
    expect(healed.players[0].teamsByYear[2028]).toBeNull()
  })

  it('never touches players without a literal null slot', () => {
    const clean = {
      pid: 2, name: 'Clean Guy', team: 42,
      teamsByYear: { 2027: 42, 2028: 42 },
    }
    const d = dynastyWith(
      [clean],
      { UK: { 2027: [{ playerName: 'Clean Guy', newTeam: 'OSU' }] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    expect(healed).toBe(d)
  })

  it('is a no-op (same reference) for dynasties with no stored destination rows', () => {
    const d = { players: [strandedPlayer()] }
    expect(healStrandedTransferDestinations(d, resolve)).toBe(d)
  })

  it('is idempotent — healing a healed dynasty changes nothing', () => {
    const d = dynastyWith(
      [strandedPlayer()],
      { UK: { 2027: [{ playerName: "D'Marcus Smith Jr.", newTeam: 'OSU' }] } },
    )
    const once = healStrandedTransferDestinations(d, resolve)
    const twice = healStrandedTransferDestinations(once, resolve)
    expect(twice).toBe(once)
  })

  it('does not mutate the input dynasty', () => {
    const d = dynastyWith(
      [strandedPlayer()],
      { UK: { 2027: [{ playerName: "D'Marcus Smith Jr.", newTeam: 'OSU' }] } },
    )
    healStrandedTransferDestinations(d, resolve)
    expect(d.players[0].teamsByYear[2028]).toBeNull()
    expect(d.players[0].movementByYear[2027].toTid).toBeNull()
  })

  it('completes the half-written movement only when it matches the strand shape', () => {
    const d = dynastyWith(
      [strandedPlayer({ movementByYear: { 2027: { type: 'recommit' } } })],
      { UK: { 2027: [{ playerName: "D'Marcus Smith Jr.", newTeam: 'OSU' }] } },
    )
    const healed = healStrandedTransferDestinations(d, resolve)
    expect(healed.players[0].teamsByYear[2028]).toBe(79)
    // Unrelated movement untouched
    expect(healed.players[0].movementByYear[2027]).toEqual({ type: 'recommit' })
  })
})
