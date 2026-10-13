import { describe, it, expect } from 'vitest'
import { classArrivalForTeamYear, playersArrivingForTeamYear } from '../classArrivals'
import {
  isPortalArrivalShell, findRecommitDuplicate, findRecommitOriginal,
  absorbRecommitDuplicate, absorbRecommitDuplicates, latestRecommit, markRecommit,
} from '../portalRecommit'
import { applyCommitRows } from '../applyCommitRows'
import { mergeDuplicatePlayers } from '../playerMerge'

// Shapes taken from a real Kentucky save (2027 offseason, week 6): the 2026
// class page listed 22 players as "Portal Recommit" who had all LEFT through
// the portal, and the one real recommit (Nichols) had a second record.

const UK = 109, BAMA = 1

// Left via the portal in 2026, destination never entered. His record was not
// re-saved after the year flip, so the `team` mirror still says Kentucky.
const leaver = () => ({
  pid: 11, name: 'Jason Patterson', team: 109, year: 'So', entryReason: 'created',
  teamsByYear: { 2026: UK }, classByYear: { 2026: 'So' },
  movementByYear: { 2026: { departure: 'transfer_out', type: 'departure', reason: 'Brand Exposure', toTid: null } },
})

// The real Nichols, marked recommitted in the editor.
const nichols = () => ({
  pid: 9, name: 'Terhyon Nichols', team: 109, year: 'Sr', position: 'CB', state: 'Ohio',
  entryReason: 'created', isPortal: false, stars: null, nationalRank: null,
  teamsByYear: { 2026: UK, 2027: UK }, classByYear: { 2026: 'Jr', 2027: 'Sr' },
  devTraitByYear: { 2026: 'Star' }, overallByYear: { 2026: 81 },
  statsByYear: { 2026: { defense: { soloTkl: 13, int: 1 }, gamesPlayed: 4 } },
  movementByYear: { 2026: { reason: 'Championship Contender', type: 'recommit' } },
})

// The second record the signing-day entry created for him.
const nicholsShell = () => ({
  pid: 234, name: 'Terhyon Nichols', team: 109, year: 'Jr', position: 'CB', state: 'OH',
  isRecruit: true, recruitYear: 2026, isPortal: true, previousTeam: 'Transfer Portal',
  stars: 3, nationalRank: 390, positionRank: 34, stateRank: 17, gemBust: null,
  teamsByYear: { 2027: UK }, classByYear: { 2027: 'Jr' }, devTraitByYear: { 2027: 'Star' },
  positionByYear: { 2027: 'CB' }, statsByYear: { 2027: {} }, overallByYear: {},
  movementByYear: { 2026: { type: 'arrival', arrival: 'transfer_in', fromTid: null } },
  accolades: [],
})

describe('class page: a portal departure is not a recommit', () => {
  it('ignores the stale team mirror (the 22 false recommits)', () => {
    expect(classArrivalForTeamYear(leaver(), UK, 2026, { currentYear: 2027 })).toBeNull()
  })

  it('still counts a real recommit', () => {
    expect(classArrivalForTeamYear(nichols(), UK, 2026, { currentYear: 2027 })).toEqual({ kind: 'recommit', fromTid: null })
  })

  it('the class holds Nichols (recommit + his shell) and no leavers', () => {
    const players = [leaver(), nicholsShell(), nichols()]
    const arrivals = playersArrivingForTeamYear(players, UK, 2026, { currentYear: 2027 })
    expect(arrivals.map(a => `${a.player.pid}:${a.arrival.kind}`).sort()).toEqual(['234:transfer', '9:recommit'])
  })
})

describe('recognizing the second record', () => {
  it('the signing-day pickup is a shell; the real record is not', () => {
    expect(isPortalArrivalShell(nicholsShell(), UK, 2026)).toBe(true)
    expect(isPortalArrivalShell(nichols(), UK, 2026)).toBe(false)
  })

  it('a record with real stats, an honor, or another season is never a shell', () => {
    expect(isPortalArrivalShell({ ...nicholsShell(), statsByYear: { 2027: { defense: { soloTkl: 4 } } } }, UK, 2026)).toBe(false)
    expect(isPortalArrivalShell({ ...nicholsShell(), accolades: [{ year: 2027, award: 'x' }] }, UK, 2026)).toBe(false)
    expect(isPortalArrivalShell({ ...nicholsShell(), teamsByYear: { 2026: BAMA, 2027: UK } }, UK, 2026)).toBe(false)
    expect(isPortalArrivalShell({ ...nicholsShell(), movementByYear: { 2026: { type: 'arrival', arrival: 'transfer_in', fromTid: BAMA } } }, UK, 2026)).toBe(false)
  })

  it('finds the pair both ways, only when unambiguous', () => {
    const players = [nicholsShell(), nichols(), leaver()]
    expect(findRecommitDuplicate(players, nichols(), UK, 2026)?.pid).toBe(234)
    expect(findRecommitOriginal(players, nicholsShell(), UK, 2026)?.pid).toBe(9)
    const twoShells = [...players, { ...nicholsShell(), pid: 300 }]
    expect(findRecommitDuplicate(twoShells, nichols(), UK, 2026)).toBeNull()
  })

  it('a different same-named player is not touched', () => {
    const other = { ...nicholsShell(), name: 'Terrell Nichols' }
    expect(findRecommitDuplicate([other, nichols()], nichols(), UK, 2026)).toBeNull()
  })
})

describe('folding the shell into the real record', () => {
  it('keeps his history, takes the recruiting ranks into portalRecruitByYear', () => {
    const merged = absorbRecommitDuplicate(nichols(), nicholsShell(), { tid: UK, classYear: 2026 })
    expect(merged.pid).toBe(9)
    expect(merged.movementByYear[2026]).toEqual({ type: 'recommit', reason: 'Championship Contender' })
    expect(merged.portalRecruitByYear[2026]).toEqual({ stars: 3, nationalRank: 390, positionRank: 34, stateRank: 17 })
    // His own values win; gaps fill from the shell.
    expect(merged.classByYear).toEqual({ 2026: 'Jr', 2027: 'Sr' })
    expect(merged.devTraitByYear).toEqual({ 2026: 'Star', 2027: 'Star' })
    expect(merged.statsByYear[2026].defense.soloTkl).toBe(13)
    // Never turns him into a high-school recruit or a "from Transfer Portal" transfer.
    expect(merged.stars).toBeNull()
    expect(merged.previousTeam).toBeUndefined()
    expect(merged.isRecruit).toBeUndefined()
  })

  it('editor save: explicit recommits only', () => {
    const players = [nicholsShell(), nichols()]
    const { player, absorbedPids } = absorbRecommitDuplicates(nichols(), players, { explicitOnly: true })
    expect(absorbedPids).toEqual([234])
    expect(player.portalRecruitByYear[2026].nationalRank).toBe(390)

    const stillInPortal = { ...nichols(), teamsByYear: { 2026: UK }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out', toTid: null } } }
    expect(absorbRecommitDuplicates(stillInPortal, players, { explicitOnly: true }).absorbedPids).toEqual([])
  })

  it('Danger Zone merge folds the shell in as the recommit', () => {
    const merged = mergeDuplicatePlayers(nichols(), [nicholsShell()])
    expect(merged.classByYear[2027]).toBe('Sr')
    expect(merged.movementByYear[2026].type).toBe('recommit')
    expect(merged.portalRecruitByYear[2026].stars).toBe(3)
  })

  it('latestRecommit feeds the player page strip', () => {
    const merged = absorbRecommitDuplicate(nichols(), nicholsShell(), { tid: UK, classYear: 2026 })
    expect(latestRecommit(merged)).toEqual({ classYear: 2026, tid: UK, profile: { stars: 3, nationalRank: 390, positionRank: 34, stateRank: 17 } })
    expect(latestRecommit(leaver())).toBeNull()
    expect(latestRecommit(nichols())).toEqual({ classYear: 2026, tid: UK, profile: {} })
  })

  it('markRecommit adds the next season when the flip dropped him', () => {
    const dropped = { ...nichols(), teamsByYear: { 2026: UK }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out', toTid: null } } }
    const next = markRecommit(dropped, { tid: UK, classYear: 2026, recruit: { stars: 3, nationalRank: 0 } })
    expect(next.teamsByYear).toEqual({ 2026: UK, 2027: UK })
    expect(next.portalRecruitByYear[2026]).toEqual({ stars: 3 })
  })
})

describe('signing-day entry of a recommit', () => {
  const row = { name: 'Terhyon Nichols', position: 'CB', class: 'Jr', isPortal: true, previousTeam: 'Transfer Portal', stars: 3, nationalRank: 390, positionRank: 34, stateRank: 17 }
  const inPortal = () => ({ ...nichols(), team: null, teamsByYear: { 2026: UK }, movementByYear: { 2026: { type: 'departure', departure: 'transfer_out', toTid: null, reason: 'Championship Contender' } } })

  it('records the recommit on his own record instead of creating a second one', () => {
    const out = applyCommitRows({ rows: [row], players: [inPortal(), leaver()], selectedTid: UK, teamAbbr: 'UK', selectedYear: 2026, teams: {}, startPID: 500 })
    expect(out.players).toHaveLength(2)
    expect(out.nextPID).toBe(500)
    expect(out.removedPids).toEqual([])
    const n = out.players.find(p => p.pid === 9)
    expect(n.movementByYear[2026]).toEqual({ type: 'recommit', reason: 'Championship Contender' })
    expect(n.teamsByYear[2027]).toBe(UK)
    expect(n.portalRecruitByYear[2026]).toEqual({ stars: 3, nationalRank: 390, positionRank: 34, stateRank: 17 })
  })

  it('folds away a shell an earlier save created', () => {
    const out = applyCommitRows({ rows: [row], players: [nicholsShell(), inPortal()], selectedTid: UK, teamAbbr: 'UK', selectedYear: 2026, teams: {}, startPID: 500 })
    expect(out.removedPids).toEqual([234])
    expect(out.players.map(p => p.pid)).toEqual([9])
  })

  it('a high-school row never takes the recommit path', () => {
    const hs = { ...row, class: 'HS', isPortal: false }
    const out = applyCommitRows({ rows: [hs], players: [inPortal()], selectedTid: UK, teamAbbr: 'UK', selectedYear: 2026, teams: {}, startPID: 500 })
    const n = out.players.find(p => p.pid === 9)
    expect(n.movementByYear[2026].type).not.toBe('recommit')
    expect(n.portalRecruitByYear).toBeUndefined()
  })

  it('a portal row for a player who never left is unchanged behavior', () => {
    const transfer = { name: 'New Guy', class: 'So', isPortal: true, previousTeam: '' }
    const out = applyCommitRows({ rows: [transfer], players: [nichols()], selectedTid: UK, teamAbbr: 'UK', selectedYear: 2026, teams: {}, startPID: 500 })
    expect(out.players.map(p => p.pid)).toEqual([9, 500])
  })
})
