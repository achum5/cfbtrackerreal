// Versioned, persisted dynasty migrations.
//
// This is the zengm pattern (see its connectLeague.ts: LEAGUE_DATABASE_VERSION
// plus one upgradeNN per step, each run exactly once inside a version-change
// transaction) adapted to a dynasty document: an integer `schemaVersion` on
// the dynasty records which steps have already been applied, and runMigrations
// applies only the steps above it, in order, returning the fields they change
// so the caller can persist them along with the new version.
//
// WHY, given applyMigrations already exists in DynastyContext: that function is
// a PURE in-memory transform re-run on every load, and no write path persists
// its flags. That contract is exactly right for read-time repairs (heal a
// malformed record, derive a view) and exactly wrong for anything without a
// fixed point — a week-number shift, a one-time restructure — which re-fires
// per load. The workaround so far has been an out-param that the load sites
// persist by hand (recruitingWeekShifts). This module is the general form of
// that workaround, with the version number doing the "did this run already"
// bookkeeping instead of a bespoke flag per migration.
//
// RULES for a migration `up(dynasty)`:
//   - Pure: return a partial object of top-level fields to MERGE. Never
//     mutate the input. Return {} when nothing needs to change.
//   - Idempotent: a cloud dynasty can be opened on two devices before the
//     version write lands on both, so the same step may run twice against
//     already-migrated data. Re-running must be a no-op.
//   - Cheap fields only: the returned object goes through updateDynasty as a
//     merge. Do NOT return `players` or other subcollection-routed arrays
//     wholesale — that is a full roster write with skip-window implications.
//     Player-record repairs stay read-time heals in applyMigrations.
//   - Append-only list: never edit or reorder a shipped step. Add a new one.
//
// A dynasty carrying a version HIGHER than this client knows (opened by a
// newer deploy first) is left alone: no downgrade, no write.

export const SCHEMA_VERSION_FIELD = 'schemaVersion'

/** @type {Array<{ version: number, name: string, up: (dynasty: object) => object }>} */
export const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline',
    // Establishes the version field with no data change. Every dynasty that
    // predates this module goes 0 -> 1 with a single small write, after which
    // future steps have a stable number to compare against.
    up: () => ({}),
  },
]

export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length
  ? MIGRATIONS[MIGRATIONS.length - 1].version
  : 0

// Guards against a mis-authored list — versions must be strictly increasing
// integers, because "run everything above N" is the whole mechanism.
for (let i = 1; i < MIGRATIONS.length; i++) {
  if (!(MIGRATIONS[i].version > MIGRATIONS[i - 1].version)) {
    throw new Error(`MIGRATIONS must be strictly increasing (index ${i})`)
  }
}

export function currentVersionOf(dynasty) {
  const v = Number(dynasty?.[SCHEMA_VERSION_FIELD])
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/**
 * Apply every pending migration to `dynasty`.
 *
 * @returns {{ dynasty: object, updates: object, applied: string[] }}
 *   dynasty — the input with all changes (and the new version) merged in
 *   updates — ONLY the fields to persist, or {} when nothing ran
 *   applied  — names of the steps that ran, for logging
 */
export function runMigrations(dynasty) {
  if (!dynasty || typeof dynasty !== 'object') return { dynasty, updates: {}, applied: [] }
  const from = currentVersionOf(dynasty)
  if (from >= CURRENT_SCHEMA_VERSION) return { dynasty, updates: {}, applied: [] }

  let working = dynasty
  const updates = {}
  const applied = []
  for (const step of MIGRATIONS) {
    if (step.version <= from) continue
    const delta = step.up(working) || {}
    if (typeof delta !== 'object' || Array.isArray(delta)) {
      throw new Error(`Migration ${step.version} (${step.name}) must return a plain object`)
    }
    if (Object.keys(delta).length) {
      working = { ...working, ...delta }
      Object.assign(updates, delta)
    }
    applied.push(step.name)
  }
  updates[SCHEMA_VERSION_FIELD] = CURRENT_SCHEMA_VERSION
  working = { ...working, [SCHEMA_VERSION_FIELD]: CURRENT_SCHEMA_VERSION }
  return { dynasty: working, updates, applied }
}
