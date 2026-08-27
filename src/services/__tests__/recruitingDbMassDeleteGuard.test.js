import { describe, it, expect, vi, beforeEach } from 'vitest'

// saveRecruitingDatabaseSubcollection deletes any existing doc missing from
// the list it's given, and every caller sends "the complete current board"
// from React state — while a FAILED board load is caught upstream and
// treated as an empty board. One bad load followed by any edit therefore
// wiped the national board down to whatever was in memory, silently. The
// players and games saves have long had a >50% deletion circuit breaker for
// exactly this stale-state shape; this pins the same guard on the
// recruiting database.

vi.mock('../../config/firebase', () => ({ db: {}, auth: {}, storage: {} }))

const state = { existingDocs: [], deletes: [], sets: [] }

vi.mock('firebase/firestore', () => {
  const fakeRef = (path) => ({ path, id: String(path).split('/').pop() })
  return {
    collection: (_db, ...seg) => fakeRef(seg.join('/')),
    doc: (_db, ...seg) => fakeRef(seg.join('/')),
    getDocs: vi.fn(async () => ({
      docs: state.existingDocs.map((d) => ({ id: d.id, data: () => d.data })),
    })),
    writeBatch: vi.fn(() => ({
      set: (ref, data) => state.sets.push({ path: ref.path, data }),
      delete: (ref) => state.deletes.push(ref.id),
      update: () => {},
      commit: async () => {},
    })),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => null })),
    getDocFromServer: vi.fn(), getDocsFromServer: vi.fn(), getDocsFromCache: vi.fn(),
    addDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), setDoc: vi.fn(),
    query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(), deleteField: vi.fn(), arrayUnion: vi.fn(), arrayRemove: vi.fn(),
    waitForPendingWrites: vi.fn(async () => {}), getCountFromServer: vi.fn(),
    orderBy: vi.fn(), startAfter: vi.fn(), limit: vi.fn(), documentId: vi.fn(),
  }
})

const { saveRecruitingDatabaseSubcollection } = await import('../dynastyService')

const recruit = (pid) => ({ pid, name: `Recruit ${pid}`, position: 'QB', stars: 3 })
const seedExisting = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), data: recruit(i + 1) }))

beforeEach(() => {
  state.existingDocs = []
  state.deletes = []
  state.sets = []
})

describe('saveRecruitingDatabaseSubcollection mass-deletion guard', () => {
  it('blocks the wipe when a stale (near-empty) board is saved over a large one', async () => {
    state.existingDocs = seedExisting(100)
    // A failed load left 3 recruits in memory; the user edits one and saves.
    await saveRecruitingDatabaseSubcollection('dyn-1', [recruit(1), recruit(2), { ...recruit(3), stars: 5 }])
    expect(state.deletes).toHaveLength(0)
    // The edit itself still lands.
    expect(state.sets.some((w) => w.path.endsWith('/3'))).toBe(true)
  })

  it('still performs normal small cleanups on a healthy board', async () => {
    state.existingDocs = seedExisting(100)
    const kept = Array.from({ length: 95 }, (_, i) => recruit(i + 1))
    await saveRecruitingDatabaseSubcollection('dyn-1', kept)
    expect(state.deletes.sort()).toEqual(['100', '96', '97', '98', '99'].sort())
  })

  it('leaves small boards alone (a 10-recruit board can legitimately be emptied)', async () => {
    state.existingDocs = seedExisting(10)
    await saveRecruitingDatabaseSubcollection('dyn-1', [recruit(1)])
    expect(state.deletes).toHaveLength(9)
  })
})
