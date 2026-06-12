import { describe, it, expect } from 'vitest'
import {
  reconcileRecruitingRows,
  partitionRecruitingRows,
  classifyCommitment,
  isOpenTarget,
  getTargetStatus,
  PURSUING,
} from '../recruitingTargets'

const USER = 10
const YEAR = 2035

const row = (over = {}) => ({ name: 'John Smith', position: 'QB', stars: 4, class: 'HS', ...over })

const run = (rows, players = []) =>
  reconcileRecruitingRows({ rows, players, userTid: USER, classYear: YEAR })

describe('classifyCommitment', () => {
  it('blank ⇒ committed to your team', () => {
    expect(classifyCommitment('', USER)).toEqual({ status: 'committed', commitmentTid: USER })
  })
  it('(Pursuing) ⇒ open', () => {
    expect(classifyCommitment(PURSUING, USER)).toEqual({ status: 'open', commitmentTid: null })
  })
  it('numeric tid ⇒ committed there', () => {
    expect(classifyCommitment('5', USER)).toEqual({ status: 'committed', commitmentTid: 5 })
  })
  it('unresolvable text ⇒ unresolved (kept open)', () => {
    const r = classifyCommitment('Zzz Not A Team', USER, {})
    expect(r.status).toBe('unresolved')
    expect(r.commitmentTid).toBeNull()
  })
})

describe('reconcile — status branching', () => {
  it('blank commitment ⇒ committed-to-you freshman + recruitingCommitments entry', () => {
    const { players, committedToUs } = run([row({ commitment: '' })])
    expect(players).toHaveLength(1)
    const p = players[0]
    expect(p.isTarget).toBe(true)
    expect(p.commitmentTid).toBe(USER)
    expect(p.teamsByYear).toEqual({ [YEAR + 1]: USER })
    expect(p.isRecruit).toBe(true)
    expect(p.recruitYear).toBe(YEAR)
    expect(committedToUs).toHaveLength(1)
    expect(getTargetStatus(p, USER)).toBe('committed_us')
  })

  it('(Pursuing) ⇒ open target, NOT enrolled, NOT isRecruit (B2)', () => {
    const { players, committedToUs } = run([row({ commitment: PURSUING })])
    const p = players[0]
    expect(p.team).toBe(-1)
    expect(p.teamsByYear).toEqual({})
    expect(p.commitmentTid).toBeNull()
    expect(p.isRecruit).toBe(false)
    expect(p.recruitYear).toBeUndefined()
    expect(isOpenTarget(p)).toBe(true)
    expect(committedToUs).toHaveLength(0)
  })

  it('commit elsewhere ⇒ enrolls at OTHER tid, no portal/movement, not in our commitments (B3/M1)', () => {
    const { players, committedToUs } = run([row({ commitment: '5' })])
    const p = players[0]
    expect(p.commitmentTid).toBe(5)
    expect(p.team).toBe(5)
    expect(p.teamsByYear).toEqual({ [YEAR + 1]: 5 })
    expect(p.isRecruit).toBe(true)
    expect(p.movementByYear).toBeUndefined()
    expect(p.isPortal).toBe(false)
    expect(committedToUs).toHaveLength(0)
    expect(getTargetStatus(p, USER)).toBe('committed_elsewhere')
  })
})

describe('reconcile — matching & dedup', () => {
  it('pid match updates the existing record, no duplicate', () => {
    const existing = run([row({ commitment: PURSUING })]).players
    const pid = existing[0].pid
    const { players } = run([row({ pid, stars: 5, commitment: PURSUING })], existing)
    expect(players).toHaveLength(1)
    expect(players[0].stars).toBe(5)
  })

  it('name fallback merges an existing OPEN target in the same class (case-insensitive)', () => {
    const existing = run([row({ name: 'John Smith', commitment: PURSUING })]).players
    const { players } = run([row({ name: 'john smith', stars: 3, commitment: PURSUING })], existing)
    expect(players).toHaveLength(1)
    expect(players[0].stars).toBe(3)
  })

  it('does NOT hijack a rostered same-name player — creates a new record instead (B1)', () => {
    const rostered = {
      pid: 1, name: 'John Smith', team: 7, teamsByYear: { [YEAR]: 7 },
      isTarget: false, position: 'WR',
    }
    const { players } = run([row({ name: 'John Smith', commitment: '' })], [rostered])
    expect(players).toHaveLength(2)
    const original = players.find((p) => p.pid === 1)
    expect(original.team).toBe(7) // untouched
    expect(original.teamsByYear).toEqual({ [YEAR]: 7 })
    expect(original.movementByYear).toBeUndefined()
    expect(original.isTarget).toBe(false)
    const created = players.find((p) => p.pid !== 1)
    expect(created.isTarget).toBe(true)
    expect(created.commitmentTid).toBe(USER)
  })

  it('open → committed transition flips status on the same record (no duplicate)', () => {
    const open = run([row({ commitment: PURSUING })]).players
    const { players, committedToUs } = run([row({ commitment: '' })], open)
    expect(players).toHaveLength(1)
    const p = players[0]
    expect(p.commitmentTid).toBe(USER)
    expect(p.teamsByYear).toEqual({ [YEAR + 1]: USER })
    expect(p.isRecruit).toBe(true)
    expect(p.isTarget).toBe(true) // stays on the board
    expect(committedToUs).toHaveLength(1)
  })

  it('does not mutate the input players array', () => {
    const input = [{ pid: 1, name: 'Existing', isTarget: false, team: 3, teamsByYear: { [YEAR]: 3 } }]
    const snapshot = JSON.stringify(input)
    run([row({ commitment: PURSUING })], input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('partition — routing (commit-only flow stays untouched)', () => {
  const part = (rows, players = []) =>
    partitionRecruitingRows(rows, { players, userTid: USER, classYear: YEAR })

  it('all blank commitments, no targets ⇒ every row is a commit row, in order', () => {
    const rows = [row({ name: 'A', commitment: '' }), row({ name: 'B', commitment: '' })]
    const { targetRows, commitRows } = part(rows)
    expect(targetRows).toHaveLength(0)
    expect(commitRows.map((r) => r.name)).toEqual(['A', 'B'])
  })

  it('(Pursuing) and commit-elsewhere route to targetRows; your-team stays a commit', () => {
    const rows = [
      row({ name: 'Open', commitment: PURSUING }),
      row({ name: 'Elsewhere', commitment: '5' }),
      row({ name: 'Mine', commitment: '' }),
    ]
    const { targetRows, commitRows } = part(rows)
    expect(targetRows.map((r) => r.name)).toEqual(['Open', 'Elsewhere'])
    expect(commitRows.map((r) => r.name)).toEqual(['Mine'])
  })

  it('a your-team commit that MATCHES an existing target routes to targetRows (clean flip, not transfer)', () => {
    const existingTarget = { pid: 1, name: 'Flip Me', isTarget: true, targetYear: YEAR, team: -1, teamsByYear: {} }
    const { targetRows, commitRows } = part([row({ name: 'flip me', commitment: '' })], [existingTarget])
    expect(targetRows).toHaveLength(1)
    expect(commitRows).toHaveLength(0)
  })

  it('pid match to an existing target routes to targetRows', () => {
    const existingTarget = { pid: 9, name: 'X', isTarget: true, targetYear: YEAR, teamsByYear: {} }
    const { targetRows } = part([row({ pid: 9, name: 'Totally Different', commitment: '' })], [existingTarget])
    expect(targetRows).toHaveLength(1)
  })
})

describe('reconcile — attributes', () => {
  it('passes attributes through and merges across saves', () => {
    const first = run([row({ commitment: PURSUING, attributes: { 'Throw Power': 88 } })]).players
    expect(first[0].attributes).toEqual({ 'Throw Power': 88 })

    const pid = first[0].pid
    const second = run(
      [row({ pid, commitment: PURSUING, attributes: { Awareness: 70 } })],
      first,
    ).players
    expect(second[0].attributes).toEqual({ 'Throw Power': 88, Awareness: 70 })

    // a row with no attributes keeps what was already captured
    const third = run([row({ pid, commitment: PURSUING })], second).players
    expect(third[0].attributes).toEqual({ 'Throw Power': 88, Awareness: 70 })
  })
})
