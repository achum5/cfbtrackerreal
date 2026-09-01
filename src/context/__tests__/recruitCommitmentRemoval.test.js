import { describe, it, expect } from 'vitest'
import { buildRecruitingCommitmentRemoval, getRecruitingCommitments } from '../DynastyContext'

// A user marked a recruit as committed by mistake and had no way to undo it:
// handleRemoveCommit and its confirm dialog existed, but nothing ever set the
// state that opens the dialog, so the whole path was unreachable. These cover
// the logic behind the button now wired up on the Commitments cards.

const TID = 42
const dynastyWith = (commitments) => ({
  teams: { [TID]: { abbr: 'UK', name: 'Kentucky Wildcats' } },
  recruitingCommitmentsByTeamYear: { [TID]: { 2030: commitments } },
})

const read = (updates, dynasty) => {
  const merged = { ...dynasty, ...updates }
  return getRecruitingCommitments(merged, TID, 2030)
}

describe('buildRecruitingCommitmentRemoval', () => {
  it('removes a committed recruit by pid', () => {
    const d = dynastyWith({ edit: [{ pid: 7, name: 'Ben Roberts' }, { pid: 8, name: 'Other Guy' }] })
    const out = read(buildRecruitingCommitmentRemoval(d, { tid: TID, year: 2030, pid: 7, name: 'Ben Roberts' }), d)
    expect(out.edit.map(r => r.pid)).toEqual([8])
  })

  it('removes a hand-entered commitment that has no pid, by name', () => {
    // The case that matters most — a commitment typed straight onto the board
    // never got a player record, so there is no pid to match on.
    const d = dynastyWith({ edit: [{ name: 'Ben Roberts' }, { name: 'Other Guy' }] })
    const out = read(buildRecruitingCommitmentRemoval(d, { tid: TID, year: 2030, pid: null, name: 'Ben Roberts' }), d)
    expect(out.edit.map(r => r.name)).toEqual(['Other Guy'])
  })

  it('clears the recruit out of EVERY bucket, not just edit', () => {
    // A committed recruit can sit in the edit bucket and any per-week signing
    // bucket at once; filtering only `edit` would leave them on the board.
    const d = dynastyWith({
      edit: [{ pid: 7, name: 'Ben Roberts' }],
      signing_1: [{ pid: 7, name: 'Ben Roberts' }],
      signing_day: [{ pid: 7, name: 'Ben Roberts' }, { pid: 9, name: 'Keep Me' }],
    })
    const out = read(buildRecruitingCommitmentRemoval(d, { tid: TID, year: 2030, pid: 7, name: 'Ben Roberts' }), d)
    expect(out.edit).toEqual([])
    expect(out.signing_1).toEqual([])
    expect(out.signing_day.map(r => r.pid)).toEqual([9])
  })

  it('matches names case- and whitespace-insensitively', () => {
    const d = dynastyWith({ edit: [{ name: '  ben roberts ' }] })
    const out = read(buildRecruitingCommitmentRemoval(d, { tid: TID, year: 2030, pid: null, name: 'Ben Roberts' }), d)
    expect(out.edit).toEqual([])
  })

  it('leaves everyone else untouched when nothing matches', () => {
    const d = dynastyWith({ edit: [{ pid: 8, name: 'Other Guy' }] })
    const out = read(buildRecruitingCommitmentRemoval(d, { tid: TID, year: 2030, pid: 7, name: 'Ben Roberts' }), d)
    expect(out.edit.map(r => r.pid)).toEqual([8])
  })

  it('never removes by a blank name (would wipe unnamed rows)', () => {
    const d = dynastyWith({ edit: [{ name: '' }, { pid: 8, name: 'Other Guy' }] })
    const out = read(buildRecruitingCommitmentRemoval(d, { tid: TID, year: 2030, pid: null, name: '' }), d)
    expect(out.edit.length).toBe(2)
  })
})
