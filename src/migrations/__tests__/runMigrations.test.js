import { describe, it, expect } from 'vitest'
import { runMigrations, currentVersionOf, CURRENT_SCHEMA_VERSION, MIGRATIONS, SCHEMA_VERSION_FIELD } from '../index'

describe('runMigrations', () => {
  it('brings an unversioned dynasty to the current version with one write', () => {
    const d = { id: 'a', name: 'X' }
    const { dynasty, updates, applied } = runMigrations(d)
    expect(dynasty[SCHEMA_VERSION_FIELD]).toBe(CURRENT_SCHEMA_VERSION)
    expect(updates[SCHEMA_VERSION_FIELD]).toBe(CURRENT_SCHEMA_VERSION)
    expect(applied.length).toBe(MIGRATIONS.length)
    // Input is never mutated.
    expect(d[SCHEMA_VERSION_FIELD]).toBeUndefined()
  })

  it('is a no-op (no updates, same reference) when already current', () => {
    const d = { id: 'a', [SCHEMA_VERSION_FIELD]: CURRENT_SCHEMA_VERSION }
    const r = runMigrations(d)
    expect(r.dynasty).toBe(d)
    expect(r.updates).toEqual({})
    expect(r.applied).toEqual([])
  })

  it('is idempotent — running the output again changes nothing', () => {
    const once = runMigrations({ id: 'a' })
    const twice = runMigrations(once.dynasty)
    expect(twice.updates).toEqual({})
    expect(twice.dynasty).toBe(once.dynasty)
  })

  it('never downgrades a dynasty from a newer client', () => {
    const d = { id: 'a', [SCHEMA_VERSION_FIELD]: CURRENT_SCHEMA_VERSION + 5 }
    const r = runMigrations(d)
    expect(r.updates).toEqual({})
    expect(r.dynasty).toBe(d)
  })

  it('treats garbage versions as unversioned', () => {
    expect(currentVersionOf({ [SCHEMA_VERSION_FIELD]: 'abc' })).toBe(0)
    expect(currentVersionOf({ [SCHEMA_VERSION_FIELD]: -3 })).toBe(0)
    expect(currentVersionOf({ [SCHEMA_VERSION_FIELD]: 2.7 })).toBe(2)
    expect(currentVersionOf(null)).toBe(0)
  })

  it('tolerates null/undefined input', () => {
    expect(runMigrations(null)).toEqual({ dynasty: null, updates: {}, applied: [] })
  })

  it('the baseline step changes no data', () => {
    const d = { id: 'a', currentYear: 2030, players: [{ pid: 1 }] }
    const { dynasty, updates } = runMigrations(d)
    const { [SCHEMA_VERSION_FIELD]: _v, ...rest } = updates
    expect(rest).toEqual({})
    expect(dynasty.players).toBe(d.players)
    expect(dynasty.currentYear).toBe(2030)
  })

  it('MIGRATIONS is append-only with strictly increasing versions', () => {
    for (let i = 1; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i].version).toBeGreaterThan(MIGRATIONS[i - 1].version)
    }
    expect(CURRENT_SCHEMA_VERSION).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)
  })
})
