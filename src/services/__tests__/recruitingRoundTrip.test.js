import { describe, it, expect } from 'vitest'
import {
  splitSeasonalUpdateByYear,
  splitYearPatchIntoSeasonAndShards,
  rehydrateSeasonalShapes,
  foldTeamsByYearFieldsFromFlat,
  shardForTeamKey,
  diffSeasonalDeletions,
} from '../seasonSubcollection'

// End-to-end persistence audit for RECRUITING data on a cloud dynasty.
//
// Every recruiting store — commitments, transfer destinations, players
// leaving, recruits — is a *ByTeamYear seasonal field. On the cloud write
// path it is stripped off teams[tid].byYear, split by year, split again by
// team into seasons/{year}/teamShards/{0..7} (added v2026.08.26.0020), and
// merge-written; on read the shards are flattened back onto the season doc,
// rehydrated into the flat field, and folded back onto teams.byYear. Six
// hops. "Recruiting not saving / being weird" reports made this the first
// place to look after the shard change, so this file drives a REALISTIC
// recruiting payload — dual abbr+tid keys (the Dashboard writes both),
// per-week buckets, a re-save adding a bucket, and a removal — through a
// faithful simulation of every hop, including Firestore's recursive
// merge-write semantics, and asserts the data that comes back is the data
// that went in.

// Firestore setDoc(..., { merge: true }): maps merge recursively, arrays and
// primitives replace, and a deleteField() sentinel removes the key. The
// sentinel here mirrors how the real one behaves for this purpose.
const DELETE = { __delete__: true }
const isDelete = (v) => v && typeof v === 'object' && v.__delete__ === true
function mergeDoc(existing, patch) {
  const out = { ...(existing || {}) }
  for (const [k, v] of Object.entries(patch || {})) {
    if (isDelete(v)) { delete out[k]; continue }
    if (v && typeof v === 'object' && !Array.isArray(v) &&
        out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = mergeDoc(out[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

// One simulated dynasty's Firestore state: seasons/{year} + its shard docs.
function makeStore() {
  const seasons = {} // year -> doc data
  const shards = {}  // year -> shardIndex -> doc data
  return {
    write(byYear) {
      for (const [yearKey, patch] of Object.entries(byYear)) {
        const { seasonDocPatch, shardPatches } = splitYearPatchIntoSeasonAndShards(Number(yearKey), patch)
        seasons[yearKey] = mergeDoc(seasons[yearKey], seasonDocPatch)
        for (const [idx, shardData] of Object.entries(shardPatches)) {
          if (!shards[yearKey]) shards[yearKey] = {}
          shards[yearKey][idx] = mergeDoc(shards[yearKey][idx], shardData)
        }
      }
    },
    read() {
      // mergeShardsIntoSeasonDocs equivalent: shard fields overlay the
      // season doc's own per-team maps, then rehydrate.
      const docs = Object.entries(seasons).map(([yearKey, base]) => {
        const merged = { ...base }
        for (const shardData of Object.values(shards[yearKey] || {})) {
          for (const [field, teamMap] of Object.entries(shardData)) {
            merged[field] = { ...(merged[field] || {}), ...teamMap }
          }
        }
        return { id: yearKey, data: () => merged }
      })
      return rehydrateSeasonalShapes(docs)
    },
  }
}

const WEEK1 = [{ pid: 900, name: 'Five Star QB', position: 'QB', stars: 5 }]
const WEEK3 = [{ pid: 901, name: 'Sleeper LB', position: 'MIKE', stars: 3 }]
const EDIT = [{ pid: 902, name: 'Paste Import WR', position: 'WR', stars: 4 }]

describe('recruiting data round-trip through seasons/teamShards', () => {
  it('a dual-keyed commitments save (abbr + tid, the Dashboard shape) survives all six hops', () => {
    const store = makeStore()
    // Exactly what handleRecruitingCommitmentsSave produces: the same
    // buckets under BOTH the abbr key and the tid key.
    const byYear = splitSeasonalUpdateByYear({
      recruitingCommitmentsByTeamYear: {
        UMASS: { 2026: { signing_1: WEEK1 } },
        54: { 2026: { signing_1: WEEK1 } },
      },
    })
    store.write(byYear)
    const back = store.read()
    expect(back.recruitingCommitmentsByTeamYear.UMASS[2026].signing_1).toEqual(WEEK1)
    expect(back.recruitingCommitmentsByTeamYear[54][2026].signing_1).toEqual(WEEK1)
  })

  it('a later week re-save ADDS its bucket without wiping earlier weeks', () => {
    const store = makeStore()
    store.write(splitSeasonalUpdateByYear({
      recruitingCommitmentsByTeamYear: { 54: { 2026: { signing_1: WEEK1 } } },
    }))
    // The sanctioned writer unions existing buckets in before saving, but the
    // merge-write must ALSO not clobber siblings if a raced write arrives
    // with only its own bucket.
    store.write(splitSeasonalUpdateByYear({
      recruitingCommitmentsByTeamYear: { 54: { 2026: { signing_3: WEEK3, edit: EDIT } } },
    }))
    const back = store.read()
    expect(back.recruitingCommitmentsByTeamYear[54][2026]).toEqual({
      signing_1: WEEK1, signing_3: WEEK3, edit: EDIT,
    })
  })

  it('transfer destinations and players leaving ride the same path intact', () => {
    const store = makeStore()
    const dests = [{ playerName: 'Portal Guy', newTeam: 'ORE', newTeamTid: 76 }]
    const leaving = [{ pid: 1, name: 'Departing Sr', reason: 'Graduating' }]
    store.write(splitSeasonalUpdateByYear({
      transferDestinationsByTeamYear: { 54: { 2026: dests } },
      playersLeavingByTeamYear: { 54: { 2026: leaving } },
    }))
    const back = store.read()
    expect(back.transferDestinationsByTeamYear[54][2026]).toEqual(dests)
    expect(back.playersLeavingByTeamYear[54][2026]).toEqual(leaving)
  })

  it('re-saving a week with fewer recruits truly shrinks it (arrays replace, not merge)', () => {
    const store = makeStore()
    store.write(splitSeasonalUpdateByYear({
      recruitingCommitmentsByTeamYear: { 54: { 2026: { signing_1: [...WEEK1, ...WEEK3] } } },
    }))
    store.write(splitSeasonalUpdateByYear({
      recruitingCommitmentsByTeamYear: { 54: { 2026: { signing_1: WEEK1 } } },
    }))
    const back = store.read()
    expect(back.recruitingCommitmentsByTeamYear[54][2026].signing_1).toEqual(WEEK1)
  })

  it('diffSeasonalDeletions routes a removed team-year to the SAME shard its data lives in', () => {
    const prev = { 54: { 2026: { signing_1: WEEK1 } }, UMASS: { 2026: { signing_1: WEEK1 } } }
    const del = diffSeasonalDeletions('recruitingCommitmentsByTeamYear', prev, {})
    // Sentinels must exist for both keys and target the shard the write used —
    // a sentinel landing in a different shard would delete nothing and the
    // "removed" data would resurface on the next read.
    const { shardPatches } = splitYearPatchIntoSeasonAndShards(2026, del[2026])
    for (const key of ['54', 'UMASS']) {
      const shard = shardForTeamKey(key)
      expect(shardPatches[shard].recruitingCommitmentsByTeam[key]).toBeDefined()
    }
  })

  it('rehydrated flat fields fold back onto teams.byYear for the union read', () => {
    const store = makeStore()
    store.write(splitSeasonalUpdateByYear({
      recruitingCommitmentsByTeamYear: { 54: { 2026: { signing_1: WEEK1 } } },
    }))
    const flat = store.read()
    const dynasty = foldTeamsByYearFieldsFromFlat({
      _teamsByYearFlatMigratedAt: '2026-01-01T00:00:00.000Z',
      teams: { 54: { tid: 54, abbr: 'UMASS', name: 'UMass', byYear: {} } },
      ...flat,
    })
    expect(dynasty.teams[54].byYear[2026].recruitingCommitments.signing_1).toEqual(WEEK1)
  })
})

// leagueDraftResultsByYear holds every drafted player in the LEAGUE, one
// full class per season, forever — the same unbounded shape that pushed a
// real dynasty's season doc past 1 MiB and that retired allCoachesByYear.
// It has to route to the seasons subcollection like its per-team sibling
// draftResultsByYear, not sit on the main doc.
describe('leagueDraftResultsByYear routing', () => {
  it('is season-scoped, like draftResultsByYear', async () => {
    const { isSeasonalField } = await import('../seasonSubcollection')
    expect(isSeasonalField('draftResultsByYear')).toBe(true)
    expect(isSeasonalField('leagueDraftResultsByYear')).toBe(true)
  })

  it('round-trips a league draft class through a season doc', () => {
    const store = makeStore()
    const picks = [
      { pid: 1, name: 'First Rounder', teamTid: 72, round: 1, position: 'QB' },
      { pid: 2, name: 'Late Flier', teamTid: 54, round: 7, position: 'CB' },
    ]
    store.write(splitSeasonalUpdateByYear({ leagueDraftResultsByYear: { 2026: picks } }))
    expect(store.read().leagueDraftResultsByYear[2026]).toEqual(picks)
  })

  it('a later season adds rather than replacing an earlier class', () => {
    const store = makeStore()
    const y26 = [{ pid: 1, name: 'Class of 26', round: 1 }]
    const y27 = [{ pid: 2, name: 'Class of 27', round: 2 }]
    store.write(splitSeasonalUpdateByYear({ leagueDraftResultsByYear: { 2026: y26 } }))
    store.write(splitSeasonalUpdateByYear({ leagueDraftResultsByYear: { 2027: y27 } }))
    const back = store.read()
    expect(back.leagueDraftResultsByYear[2026]).toEqual(y26)
    expect(back.leagueDraftResultsByYear[2027]).toEqual(y27)
  })
})
