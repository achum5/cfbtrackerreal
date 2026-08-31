import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import uniqueIds from '../cfb27UniquePortraitIds.json'
import genericKeys from '../cfb27GenericPortraitKeys.json'
import { mapPortraitUrl } from '../cfb27SaveImport'

// mapPortraitUrl bails out with '' when there's no `window` (it builds an
// absolute URL off the portrait host, falling back to the page origin). The
// suite runs in plain Node, so stub the minimum it reads — otherwise every
// assertion below passes vacuously against '' and proves nothing.
const hadWindow = 'window' in globalThis
beforeAll(() => {
  if (!hadWindow) globalThis.window = { location: { origin: 'https://test.local' } }
})
afterAll(() => {
  if (!hadWindow) delete globalThis.window
})

// The manifests are the GATE: mapPortraitUrl returns '' for any id not listed,
// so a portrait can be sitting on the CDN and still never render. These guard
// the properties that make the gate trustworthy after a pack update.

describe('CFB27 portrait manifests', () => {
  it('contains no duplicate unique ids', () => {
    // The pre-08-31 manifest carried 15 duplicates (335, 4022, 19338, ...),
    // which is what made the union arithmetic look like data loss when the
    // new pack was merged in. Distinct-by-construction from here on.
    expect(new Set(uniqueIds).size).toBe(uniqueIds.length)
  })

  it('contains no duplicate generic keys', () => {
    expect(new Set(genericKeys).size).toBe(genericKeys.length)
  })

  it('stays sorted ascending so diffs stay readable', () => {
    expect(uniqueIds.every((v, i) => i === 0 || uniqueIds[i - 1] <= v)).toBe(true)
  })

  it('resolves an id carried over from the original pack', () => {
    expect(mapPortraitUrl('Unique_SomePlayer_335')).toContain('/unique/335.webp')
  })

  it('resolves ids added by the 08-31-26 pack', () => {
    // Sampled from the 1,476 ids that pack introduced — these are exactly the
    // ones that would silently fall back to a team logo if the manifest
    // update were ever reverted or partially applied.
    for (const id of [769, 4704, 4892, 6653, 8595]) {
      expect(uniqueIds).toContain(id)
      expect(mapPortraitUrl(`Unique_SomePlayer_${id}`)).toContain(`/unique/${id}.webp`)
    }
  })

  it('returns empty for an id that is not in the manifest', () => {
    expect(mapPortraitUrl('Unique_NotReal_99999999')).toBe('')
  })
})
