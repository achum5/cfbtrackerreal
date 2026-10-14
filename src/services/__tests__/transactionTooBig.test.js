import { describe, it, expect, vi, beforeEach } from 'vitest'

// A Firestore stand-in whose commits refuse anything over MAX_WRITES writes
// with the server's real "Transaction too big" rejection — the error a
// full-league dynasty (11,744 players) hit on save.
const state = { committed: [], refused: 0, maxWrites: Infinity }
const tooBig = () => Object.assign(new Error('Transaction too big. Decrease transaction size.'), { code: 'invalid-argument' })

vi.mock('../../config/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('firebase/firestore', () => {
  const names = [
    'collection', 'getDoc', 'getDocFromServer', 'getDocs',
    'getDocsFromCache', 'getDocsFromServer', 'addDoc', 'updateDoc',
    'deleteDoc', 'setDoc', 'query', 'where', 'onSnapshot',
    'deleteField', 'arrayUnion', 'arrayRemove',
    'getCountFromServer', 'orderBy', 'startAfter', 'limit', 'documentId',
  ]
  const stubs = Object.fromEntries(names.map((n) => [n, () => {}]))
  return {
    ...stubs,
    doc: (_db, ...path) => path.join('/'),
    serverTimestamp: () => 'ts',
    waitForPendingWrites: () => Promise.resolve(),
    writeBatch: () => {
      const ops = []
      return {
        set: (ref, data) => ops.push({ op: 'set', ref, data }),
        delete: (ref) => ops.push({ op: 'delete', ref }),
        update: (ref, data) => ops.push({ op: 'update', ref, data }),
        commit: () => {
          if (ops.length > state.maxWrites) { state.refused++; return Promise.reject(tooBig()) }
          state.committed.push(ops)
          return Promise.resolve()
        },
      }
    },
  }
})

const { saveChangedPlayers, saveWeeklyGamesChanges } = await import('../dynastyService')

beforeEach(() => { state.committed = []; state.refused = 0; state.maxWrites = Infinity })

const players = (n) => Array.from({ length: n }, (_, i) => ({ pid: i + 1, name: `P${i + 1}`, attributesByYear: { 2027: { Speed: 80 } } }))
const writesOf = (batches, prefix) => batches.flat().filter(o => o.op === 'set' && String(o.ref).includes(prefix)).map(o => o.ref)

describe('a commit refused as "Transaction too big" is split, never lost', () => {
  it('normal saves still go in one batch', async () => {
    await saveChangedPlayers('dyn', players(5))
    expect(state.refused).toBe(0)
    expect(state.committed).toHaveLength(1)
  })

  it('splits until every piece fits, and every player lands exactly once', async () => {
    state.maxWrites = 4
    await saveChangedPlayers('dyn', players(13))
    expect(state.refused).toBeGreaterThan(0)
    const refs = writesOf(state.committed, '/players/')
    expect(refs).toHaveLength(13)
    expect(new Set(refs).size).toBe(13)
    // The cross-device lastModified bump rides only on the final piece.
    const bumps = state.committed.map(b => b.some(o => o.op === 'update'))
    expect(bumps.filter(Boolean)).toHaveLength(1)
    expect(bumps[bumps.length - 1]).toBe(true)
  })

  it('weekly game slates split the same way, deletes included', async () => {
    state.maxWrites = 3
    const games = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, team1Tid: 1, team2Tid: 2 }))
    await saveWeeklyGamesChanges('dyn', games, ['old1', 'old2'])
    expect(writesOf(state.committed, '/games/')).toHaveLength(7)
    expect(state.committed.flat().filter(o => o.op === 'delete')).toHaveLength(2)
  })

  it('a single write that is still too big surfaces the error', async () => {
    state.maxWrites = 0
    await expect(saveChangedPlayers('dyn', players(1))).rejects.toThrow(/Transaction too big/)
  })
})
