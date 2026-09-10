import { describe, it, expect } from 'vitest'
import { buildAIPrompt } from '../aiPrompt'

const base = { title: 'Test Task', structure: 'Output one line per player.' }

describe('buildAIPrompt targets', () => {
  it('names every target player and counts them', () => {
    const out = buildAIPrompt({
      ...base,
      targets: [
        { name: 'Caden Pinnick', position: 'WR', class: 'So', jerseyNumber: 7 },
        { name: 'Dash Beierly', position: 'QB' },
      ],
    })
    expect(out).toContain('#7 Caden Pinnick (WR, So)')
    expect(out).toContain('Dash Beierly (QB)')
    expect(out).toContain('2 players')
  })

  it('says the list is closed, so the model does not infer the set from the screen', () => {
    const out = buildAIPrompt({ ...base, targets: [{ name: 'Solo Guy' }] })
    expect(out).toContain('COMPLETE, CLOSED list')
    expect(out).toMatch(/Output rows for players on this list ONLY/)
    expect(out).toContain('1 player')
    expect(out).not.toContain('1 players')
  })

  it('keeps the caller order, since some prompts align output by row position', () => {
    const out = buildAIPrompt({
      ...base,
      targets: [{ name: 'Zeke Warren' }, { name: 'Adam Blake' }],
    })
    expect(out.indexOf('Zeke Warren')).toBeLessThan(out.indexOf('Adam Blake'))
  })

  it('appends the note and honors a custom label', () => {
    const out = buildAIPrompt({
      ...base,
      targets: [{ name: 'A B' }],
      targetsLabel: 'THE PORTAL TRANSFERS',
      targetsNote: 'Row order matches the sheet.',
    })
    expect(out).toContain('THE PORTAL TRANSFERS — 1 player')
    expect(out).toContain('Row order matches the sheet.')
  })

  it('omits the block entirely when there are no targets', () => {
    for (const targets of [undefined, [], [{ name: '' }]]) {
      expect(buildAIPrompt({ ...base, targets })).not.toContain('CLOSED list')
    }
  })

  it('keeps the roster block separate — it is still explicitly not a whitelist', () => {
    const out = buildAIPrompt({
      ...base,
      targets: [{ name: 'Target Guy' }],
      roster: [{ name: 'Bench Guy' }],
    })
    expect(out).toContain('COMPLETE, CLOSED list')
    expect(out).toContain('TIEBREAKER for ABBREVIATED names only')
    expect(out.indexOf('CLOSED list')).toBeLessThan(out.indexOf('TIEBREAKER'))
  })
})
