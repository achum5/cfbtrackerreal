import { describe, it, expect } from 'vitest'
import { parseAttributeRows, serializeAttributeRows, buildAttributesStructure } from '../attributeEntry'

const ROW = ['Alex Guess', 'QB', '90', '12', 'Elite', 'Dual Threat', '250000', 'AWR 92, SPD 84']

describe('parseAttributeRows — the player-card columns', () => {
  it('reads all eight columns', () => {
    expect(parseAttributeRows([ROW])).toEqual([{
      playerName: 'Alex Guess', position: 'QB', overall: 90,
      jerseyNumber: 12, devTrait: 'Elite', archetype: 'Dual Threat', nil: 250000,
      attributes: { Awareness: 92, Speed: 84 },
    }])
  })

  it('leaves the card fields null when those columns are blank', () => {
    const [r] = parseAttributeRows([['Alex Guess', 'QB', '90', '', '', '', '', 'AWR 92']])
    expect(r.jerseyNumber).toBeNull()
    expect(r.devTrait).toBeNull()
    expect(r.archetype).toBeNull()
    expect(r.nil).toBeNull()
    expect(r.attributes).toEqual({ Awareness: 92 })
  })

  it('still reads a four-column paste, where the ratings sat right after OVR', () => {
    const [r] = parseAttributeRows([['Alex Guess', 'QB', '90', 'AWR 92, SPD 84']])
    expect(r.attributes).toEqual({ Awareness: 92, Speed: 84 })
    expect(r.jerseyNumber).toBeNull()
    expect(r.overall).toBe(90)
  })

  it('rejoins ratings the AI tab-separated instead of comma-separating', () => {
    const [r] = parseAttributeRows([[...ROW.slice(0, 7), 'AWR 92', 'SPD 84', 'ACC 86']])
    expect(r.attributes).toEqual({ Awareness: 92, Speed: 84, Acceleration: 86 })
    expect(r.jerseyNumber).toBe(12)
  })

  it('rejoins a legacy row’s tab-separated ratings too', () => {
    const [r] = parseAttributeRows([['Alex Guess', 'QB', '90', 'AWR 92', 'SPD 84']])
    expect(r.attributes).toEqual({ Awareness: 92, Speed: 84 })
    expect(r.devTrait).toBeNull()
  })

  it('keeps a row whose card was captured but whose ratings were not', () => {
    const [r] = parseAttributeRows([['Alex Guess', 'QB', '', '12', 'Star', '', '', '']])
    expect(r.jerseyNumber).toBe(12)
    expect(r.devTrait).toBe('Star')
    expect(r.attributes).toEqual({})
  })

  it('drops a row carrying nothing at all', () => {
    expect(parseAttributeRows([['Alex Guess', 'QB', '', '', '', '', '', '']])).toEqual([])
    expect(parseAttributeRows([['', 'QB', '90']])).toEqual([])
  })

  it('normalizes the card values rather than storing them raw', () => {
    const [r] = parseAttributeRows([['A B', 'QB', '90', '#7', 'elite', 'dual threat', '$250,000', 'AWR 90']])
    expect(r.jerseyNumber).toBe(7)
    expect(r.devTrait).toBe('Elite')
    expect(r.archetype).toBe('Dual Threat')
    expect(r.nil).toBe(250000)
  })

  it('drops values the game does not have', () => {
    const [r] = parseAttributeRows([['A B', 'QB', '90', '100', 'Superstar', 'Cannon Arm', '250K', 'AWR 90']])
    expect(r.jerseyNumber).toBeNull()
    expect(r.devTrait).toBeNull()
    expect(r.archetype).toBeNull()
    expect(r.nil).toBeNull()
  })
})

describe('serializeAttributeRows', () => {
  it('round-trips an entry through the raw textarea shape', () => {
    const entries = parseAttributeRows([ROW])
    expect(parseAttributeRows(serializeAttributeRows(entries).split('\n').map(l => l.split('\t')))).toEqual(entries)
  })

  it('emits all seven tabs even when the card columns are empty', () => {
    const line = serializeAttributeRows([{ playerName: 'A B', position: 'QB', overall: 90, attributes: {} }])
    expect(line.split('\t')).toHaveLength(8)
  })
})

describe('buildAttributesStructure', () => {
  it('asks for eight columns and says where the card fields come from', () => {
    const out = buildAttributesStructure('training')
    expect(out).toContain('OUTPUT 8 TAB-SEPARATED COLUMNS')
    expect(out).toContain('Player<TAB>Position<TAB>OVR<TAB>Jersey #<TAB>Dev Trait<TAB>Archetype<TAB>NIL<TAB>Attributes')
    expect(out).toContain('RIGHT-HAND PLAYER\n              CARD')
    expect(out).toContain('BLUE DIAMOND')
    expect(out).toContain('Exactly 7 tab characters per row')
  })

  it('lists the archetypes by position, not as one flat set', () => {
    const out = buildAttributesStructure('recruits')
    expect(out).toContain('QB: Backfield Creator')
    expect(out).toContain("player's OWN position")
  })
})
