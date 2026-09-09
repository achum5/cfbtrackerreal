import { describe, it, expect } from 'vitest'
import { hasUnresolvedDeparture, hasRecommitForYear } from '../DynastyContext'

// Direct characterization of the single source of truth for "this player
// left and never came back". Both the year flip and the new-season pass
// call this; before now the only test re-implemented it.

const HOME = 42
const OTHER = 77
const Y = 2030
const dynasty = { teams: { [HOME]: { tid: HOME, abbr: 'IU' }, [OTHER]: { tid: OTHER, abbr: 'CPU' } } }
const dep = (departure, extra = {}) => ({ type: 'departure', departure, ...extra })

describe('hasRecommitForYear', () => {
  it('reads v2 recommit shapes for that year only', () => {
    expect(hasRecommitForYear({ movementByYear: { [Y]: { type: 'recommit' } } }, Y)).toBe(true)
    expect(hasRecommitForYear({ movementByYear: { '2030': { type: 'recommitted' } } }, Y)).toBe(true)
    expect(hasRecommitForYear({ movementByYear: { [Y - 1]: { type: 'recommit' } } }, Y)).toBe(false)
    expect(hasRecommitForYear({ movementByYear: { [Y]: dep('transfer_out') } }, Y)).toBe(false)
  })
  it('reads legacy movements[] with a matching year', () => {
    expect(hasRecommitForYear({ movements: [{ type: 'recommitted', year: '2030' }] }, Y)).toBe(true)
    expect(hasRecommitForYear({ movements: [{ type: 'recommit', year: 2029 }] }, Y)).toBe(false)
    expect(hasRecommitForYear({}, Y)).toBe(false)
  })
})

describe('hasUnresolvedDeparture — the season that just ended', () => {
  it('no records: not departed', () => {
    expect(hasUnresolvedDeparture({ teamsByYear: { [Y]: HOME } }, HOME, Y, dynasty)).toBe(false)
  })
  it('every canonical v2 departure shape counts', () => {
    for (const d of ['transfer_out', 'graduated', 'pro_draft']) {
      expect(hasUnresolvedDeparture({ movementByYear: { [Y]: dep(d) } }, HOME, Y, dynasty), d).toBe(true)
    }
  })
  it('legacy v2 type names count; a bare "transfer" is an ARRIVAL and does not', () => {
    for (const t of ['entered_portal', 'transferred_out', 'graduated', 'declared_for_draft', 'encouraged_to_transfer']) {
      expect(hasUnresolvedDeparture({ movementByYear: { [Y]: { type: t } } }, HOME, Y, dynasty), t).toBe(true)
    }
    expect(hasUnresolvedDeparture({ movementByYear: { [Y]: { type: 'transfer' } } }, HOME, Y, dynasty)).toBe(false)
  })
  it('legacy movements[] departures count, keyed by year', () => {
    expect(hasUnresolvedDeparture({ movements: [{ type: 'entered_portal', year: '2030' }] }, HOME, Y, dynasty)).toBe(true)
    expect(hasUnresolvedDeparture({ movements: [{ type: 'transfer', year: 2030 }] }, HOME, Y, dynasty)).toBe(false)
    expect(hasUnresolvedDeparture({ movements: [{ type: 'graduated', year: 2029 }] }, HOME, Y, dynasty)).toBe(true) // prior-year rule below
  })
  it('a recommit in the same year overrides any departure', () => {
    const p = { movementByYear: { [Y]: dep('transfer_out') }, movements: [{ type: 'recommitted', year: Y }] }
    expect(hasUnresolvedDeparture(p, HOME, Y, dynasty)).toBe(false)
  })
})

describe('hasUnresolvedDeparture — departures in earlier years', () => {
  it('a departure two years ago with no return still counts', () => {
    const p = { movementByYear: { [Y - 2]: dep('transfer_out', { toTid: OTHER }) }, teamsByYear: { [Y - 2]: HOME } }
    expect(hasUnresolvedDeparture(p, HOME, Y, dynasty)).toBe(true)
  })
  it('a later explicit arrival, recommit or arrival shape clears it', () => {
    const base = { movementByYear: { [Y - 2]: dep('transfer_out', { toTid: OTHER }) } }
    expect(hasUnresolvedDeparture({ movementByYear: { ...base.movementByYear, [Y - 1]: { type: 'arrival' } } }, HOME, Y, dynasty)).toBe(false)
    expect(hasUnresolvedDeparture({ movementByYear: { ...base.movementByYear, [Y - 1]: { type: 'recommit' } } }, HOME, Y, dynasty)).toBe(false)
    expect(hasUnresolvedDeparture({ movementByYear: { ...base.movementByYear, [Y - 1]: { arrival: 'transfer_in' } } }, HOME, Y, dynasty)).toBe(false)
    expect(hasUnresolvedDeparture({ ...base, movements: [{ type: 'portal_in', year: Y - 1 }] }, HOME, Y, dynasty)).toBe(false)
  })
  it('being on the home team in a later teamsByYear year is an implicit return', () => {
    const p = { movementByYear: { [Y - 2]: dep('transfer_out', { toTid: OTHER }) }, teamsByYear: { [Y - 2]: HOME, [Y - 1]: HOME } }
    expect(hasUnresolvedDeparture(p, HOME, Y, dynasty)).toBe(false)
    // …unless that year is the one being excluded (a pre-seeded new-season slot).
    const seeded = { movementByYear: { [Y - 1]: dep('graduated') }, teamsByYear: { [Y - 1]: HOME, [Y + 1]: HOME } }
    expect(hasUnresolvedDeparture(seeded, HOME, Y, dynasty)).toBe(false)
    expect(hasUnresolvedDeparture(seeded, HOME, Y, dynasty, { excludeTeamsByYearYear: Y + 1 })).toBe(true)
  })
  it('a later teamsByYear year on a DIFFERENT team is not a return', () => {
    const p = { movementByYear: { [Y - 2]: dep('transfer_out', { toTid: OTHER }) }, teamsByYear: { [Y - 2]: HOME, [Y - 1]: OTHER } }
    expect(hasUnresolvedDeparture(p, HOME, Y, dynasty)).toBe(true)
  })
  it('a transfer_out whose destination IS the home team is an arrival, tid or abbr', () => {
    expect(hasUnresolvedDeparture({ movementByYear: { [Y - 1]: dep('transfer_out', { toTid: HOME }) } }, HOME, Y, dynasty)).toBe(false)
    expect(hasUnresolvedDeparture({ movementByYear: { [Y - 1]: dep('transfer_out', { toTid: 'IU' }) } }, HOME, Y, dynasty)).toBe(false)
    // Evaluated against the OTHER team, the same record is a real departure.
    expect(hasUnresolvedDeparture({ movementByYear: { [Y - 1]: dep('transfer_out', { toTid: HOME }) } }, OTHER, Y, dynasty)).toBe(true)
  })
  it('a departure AFTER the season that just ended is ignored', () => {
    const p = { movementByYear: { [Y + 1]: dep('graduated') }, teamsByYear: { [Y]: HOME } }
    expect(hasUnresolvedDeparture(p, HOME, Y, dynasty)).toBe(false)
  })
  it('legacy abbr strings in teamsByYear resolve for the implicit-return check', () => {
    const p = { movementByYear: { [Y - 2]: dep('transfer_out', { toTid: OTHER }) }, teamsByYear: { [Y - 2]: 'IU', [Y - 1]: 'IU' } }
    expect(hasUnresolvedDeparture(p, HOME, Y, dynasty)).toBe(false)
  })
})
