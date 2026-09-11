import { describe, it, expect } from 'vitest'
import { parseRecruitingRow, normalizeRecruitRows } from '../recruitSheetParse'
import { recruitPrefillRow, recruitPrefillTsv, commitTeamNames, previousTeamLabel } from '../recruitPrefillRows'

// Regression guard for "every portal commit says FROM <my own school>".
// The AI leaves Prev Team blank whenever the origin school isn't on screen, so
// a transfer's row reaches realignTail with exactly ONE team-ish cell — the
// user's own team, sitting in Commitment. The old single-cell rule handed that
// cell to Prev Team on any non-HS class, wiping the real origin school and
// making the recruit card resolve the user's own logo.

const OPTS = { commitTeamNames: ['Massachusetts', 'Massachusetts Minutemen', 'MASS', 'UMass'] }

// A→P plus the Attributes cell, with Prev Team (14) left blank by the AI.
const transferRow = (prev, commit) => ([
  'Jordan Vega', 'Jr', 'WR', 'Speedster', '☆☆☆☆', '312', '18', '41',
  "6'1\"", '195', 'Toledo', 'OH', '', 'Normal', prev, commit, '',
])

describe('realignTail — a lone team cell that names the committing team', () => {
  it('reads as the Commitment, not the Prev Team', () => {
    const r = parseRecruitingRow(transferRow('', 'Massachusetts Minutemen'), OPTS)
    expect(r.previousTeam).toBe('')
    expect(r.commitment).toBe('Massachusetts Minutemen')
  })

  it('matches regardless of spacing or case (an abbr works too)', () => {
    expect(parseRecruitingRow(transferRow('', 'umass'), OPTS).previousTeam).toBe('')
    expect(parseRecruitingRow(transferRow('', 'MASS'), OPTS).commitment).toBe('MASS')
  })

  it('still treats another school as the transfer Prev Team', () => {
    const r = parseRecruitingRow(transferRow('', 'Ohio Bobcats'), OPTS)
    expect(r.previousTeam).toBe('Ohio Bobcats')
    expect(r.commitment).toBe('')
  })

  it('keeps both when the AI fills both columns', () => {
    const r = parseRecruitingRow(transferRow('Ohio Bobcats', 'Massachusetts Minutemen'), OPTS)
    expect(r.previousTeam).toBe('Ohio Bobcats')
    expect(r.commitment).toBe('Massachusetts Minutemen')
  })

  it('drops a Prev Team that just echoes the Commitment', () => {
    const r = parseRecruitingRow(transferRow('Ohio Bobcats', 'Ohio Bobcats'), OPTS)
    expect(r.previousTeam).toBe('')
    expect(r.commitment).toBe('Ohio Bobcats')
  })

  it('leaves an HS row alone — its lone team cell was always the Commitment', () => {
    const hs = ['Deon Goodin', 'HS', 'QB', 'Dual Threat', '☆☆☆', '1842', '156', '119',
      "6'0\"", '181', 'Rome', 'GA', '', '', '', 'Massachusetts Minutemen', '']
    const r = parseRecruitingRow(hs, OPTS)
    expect(r.previousTeam).toBe('')
    expect(r.commitment).toBe('Massachusetts Minutemen')
  })

  it('behaves exactly as before when no commit team is supplied', () => {
    const r = parseRecruitingRow(transferRow('', 'Massachusetts Minutemen'))
    expect(r.previousTeam).toBe('Massachusetts Minutemen')
  })

  it('corrects the grid preview the same way it corrects the import', () => {
    const [row] = normalizeRecruitRows([transferRow('', 'Massachusetts Minutemen')], OPTS)
    expect(row[14]).toBe('')
    expect(row[15]).toBe('Massachusetts Minutemen')
  })
})

describe('recruitPrefillRow / recruitPrefillTsv', () => {
  const teams = {
    54: { tid: 54, abbr: 'MASS', name: 'Massachusetts Minutemen', teamName: 'Massachusetts' },
    7: { tid: 7, abbr: 'OHIO', name: 'Ohio Bobcats', teamName: 'Ohio' },
  }
  const rec = {
    name: 'Jordan Vega', class: 'Jr', position: 'WR', archetype: 'Speedster', stars: 4,
    nationalRank: 312, stateRank: 18, positionRank: 41, height: "6'1\"", weight: 195,
    hometown: 'Toledo', state: 'Ohio', gemBust: 'Gem', devTrait: 'Normal',
    previousTeam: 7, commitment: 'Massachusetts Minutemen',
    attributes: { Speed: 92, Awareness: 71 },
  }

  it('emits 17 cells in the grid column order', () => {
    const row = recruitPrefillRow(rec, teams)
    expect(row).toHaveLength(17)
    expect(row[0]).toBe('Jordan Vega')
    expect(row[4]).toBe('☆☆☆☆')
    expect(row[11]).toBe('OH')            // full state name normalized to a code
    expect(row[14]).toBe('Ohio')          // tid resolved to the combobox's label
    expect(row[15]).toBe('Massachusetts Minutemen')
    expect(row[16]).toContain('92')
  })

  it('round-trips through the parser back to the same values', () => {
    const r = parseRecruitingRow(recruitPrefillRow(rec, teams), { commitTeamNames: commitTeamNames(teams, 54) })
    expect(r.name).toBe('Jordan Vega')
    expect(r.stars).toBe(4)
    expect(r.state).toBe('OH')
    expect(r.previousTeam).toBe('Ohio')
    expect(r.commitment).toBe('Massachusetts Minutemen')
    expect(r.attributes).toEqual({ Speed: 92, Awareness: 71 })
  })

  it('keeps an unresolvable previous school as typed', () => {
    expect(previousTeamLabel('Mercyhurst', teams)).toBe('Mercyhurst')
    expect(previousTeamLabel('', teams)).toBe('')
    expect(previousTeamLabel(null, teams)).toBe('')
  })

  it('returns empty TSV for an empty prefill set and skips nameless rows', () => {
    expect(recruitPrefillTsv([], teams)).toBe('')
    expect(recruitPrefillTsv(null, teams)).toBe('')
    expect(recruitPrefillTsv([{ name: '  ' }, rec], teams).split('\n')).toHaveLength(1)
  })

  it('collects every spelling of the committing team', () => {
    const names = commitTeamNames(teams, 54)
    expect(names).toContain('Massachusetts Minutemen')
    expect(names).toContain('MASS')
    expect(commitTeamNames(teams, 999)).toEqual([])
  })
})
