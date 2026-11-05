import { describe, it, expect, vi } from 'vitest'

vi.mock('../../config/firebase', () => ({ db: {}, auth: {}, storage: {} }))

import {
  allAmericanPasteRows,
  normalizeAllAmericanPosition,
  readAllAmericansOnlyFromSheet,
  parseAllConferenceLocal,
  normalizePastedConference,
} from '../sheetsService'
import { normalizeHonorDesignation } from '../../utils/allConferenceRealign'
import { splitTsv } from '../../utils/tsvParse'

// Pastes that used to import as an EMPTY list, which the save then wrote over
// the year's honors — "every time I do it, it disappears."

const SLOTS = ['QB', 'HB', 'HB', 'WR', 'WR', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'CB', 'FS', 'SS', 'K', 'P']
const skeleton = SLOTS.map((p) => [p, '', '', '', p, '', '', '', p, '', '', ''].join('\t')).join('\n')
const reply = [
  'QB\tJohn Smith\tKentucky\tSR\tQB\tBob Jones\tAlabama\tJR\tQB\tTim Young\tGeorgia\tFR',
  'HB\tMike Brown\tLSU\tJR\tHB\tSam Lee\tTexas\tSO\tHB\tJoe King\tOhio State\tFR',
].join('\n')
const importAA = (text) => readAllAmericansOnlyFromSheet(null, 2027, null, { rows: [[], [], [], ...allAmericanPasteRows(splitTsv(text))] })

describe('All-Americans paste', () => {
  it('a reply pasted below the pre-filled position rows is read', async () => {
    const { allAmericans } = await importAA(`${skeleton}\n${reply}`)
    expect(allAmericans.map((e) => e.player)).toEqual(['John Smith', 'Bob Jones', 'Tim Young', 'Mike Brown', 'Sam Lee', 'Joe King'])
  })
  it('a header row is skipped, not saved as a player', async () => {
    const header = 'Position\tFirst Player\tFirst Team\tFirst Class\tPosition\tSecond Player\tSecond Team\tSecond Class\tPosition\tFreshman Player\tFreshman Team\tFreshman Class'
    const { allAmericans } = await importAA(`${header}\n${reply}`)
    expect(allAmericans.some((e) => /player/i.test(e.player))).toBe(false)
    expect(allAmericans).toHaveLength(6)
  })
  it('positions are stored as slot labels so the editor can show them again', () => {
    expect(normalizeAllAmericanPosition(' qb ', 0)).toBe('QB')
    expect(normalizeAllAmericanPosition('RB', 1)).toBe('HB')
    expect(normalizeAllAmericanPosition('LB', 16)).toBe('SAM')
    expect(normalizeAllAmericanPosition('EDGE', 12)).toBe('LEDG')
    expect(normalizeAllAmericanPosition('', 24)).toBe('P')
  })
})

describe('All-Conference paste', () => {
  it('reads the designation spellings AIs and the game use', () => {
    expect(['First', '1st Team', '1st-Team', 'All-SEC First Team', 'Team 1', '1'].map(normalizeHonorDesignation)).toEqual(Array(6).fill('first'))
    expect(['Second', '2nd Team', '2nd-Team', 'Team 2', '2'].map(normalizeHonorDesignation)).toEqual(Array(5).fill('second'))
    expect(['Freshman', 'Freshman All-SEC', 'All-Freshman', 'Frosh', 'FR', 'Fr.'].map(normalizeHonorDesignation)).toEqual(Array(6).fill('freshman'))
    expect(normalizeHonorDesignation('Freshwater')).toBe(null)
    expect(normalizeHonorDesignation('QB')).toBe(null)
  })
  it('keys rows by the app\'s conference names', () => {
    expect(['Big 10', 'B1G', 'big ten', 'Big Ten Conference'].map(normalizePastedConference)).toEqual(Array(4).fill('Big Ten'))
    expect(['AAC', 'American Athletic'].map(normalizePastedConference)).toEqual(['American', 'American'])
    expect(['MWC', 'Southeastern Conference', 'sec'].map(normalizePastedConference)).toEqual(['Mountain West', 'SEC', 'SEC'])
    expect(normalizePastedConference('My Custom League')).toBe('My Custom League')
  })
  it('a "1st Team" / "Big 10" paste keeps every row', () => {
    const rows = splitTsv([
      'SEC\t1st Team\tQB\tJohn Smith\tKentucky\tSR',
      'Big 10\t2nd Team\tHB\tJoe King\tOhio State\tFR',
      'SEC\tAll-Freshman\tWR\tAl Green\tLSU\tFR',
    ].join('\n'))
    const { allConference, allConferenceByConference } = parseAllConferenceLocal(rows)
    expect(allConference).toHaveLength(3)
    expect(Object.keys(allConferenceByConference).sort()).toEqual(['Big Ten', 'SEC'])
    expect(allConference.map((e) => e.designation)).toEqual(['first', 'freshman', 'second'])
  })
})
