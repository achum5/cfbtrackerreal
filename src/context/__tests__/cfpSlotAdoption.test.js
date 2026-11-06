import { describe, it, expect } from 'vitest'
import { resolveCfpSlotForGame, adoptCfpSlotIdentity, propagateCFPWinner, healCfpSlotDuplicates } from '../DynastyContext'

// Regression tests for the "championship stuck on TBD" chain. The bracket
// addresses every CFP game by SLOT id (cfpsf1-<year>) and propagates winners
// by cfpSlot — but a CFP result saved through the dashboard tiles landed
// under a freeform timestamp id with no cfpSlot. The bracket kept linking to
// its empty shell (editor with no teams), the result never propagated, and
// the NC stayed TBD with both semifinals entered.

// Seeds stored with STRING tids on purpose — the legacy shape that broke
// every strict === lookup.
const dynasty = {
  currentYear: 2028,
  cfpSeedsByYear: {
    2028: [
      { seed: 1, tid: '20' }, { seed: 2, tid: '30' }, { seed: 3, tid: '40' },
      { seed: 4, tid: '10' }, { seed: 5, tid: '50' }, { seed: 12, tid: '60' },
    ],
  },
}

// The user's played semifinal, exactly as the flag-less path stored it:
// gameType only, freeform id, no cfpSlot. Rice (tid 10, seed 4) beat
// Ole Miss (tid 20, seed 1).
const playedSF = {
  id: '1756100000000',
  year: 2028,
  gameType: 'cfp_semifinal',
  team1Tid: 10, team2Tid: 20,
  team1Score: 27, team2Score: 21,
  isPlayed: true,
}

describe('resolveCfpSlotForGame', () => {
  it('resolves a flag-less semifinal to its slot from the participants\' seeds', () => {
    expect(resolveCfpSlotForGame(dynasty, playedSF)).toBe('cfpsf1')
  })

  it('resolves the 2/3 bracket half to cfpsf2', () => {
    const g = { ...playedSF, team1Tid: 30, team2Tid: 40 }
    expect(resolveCfpSlotForGame(dynasty, g)).toBe('cfpsf2')
  })

  it('prefers an explicit cfpSlot when present', () => {
    expect(resolveCfpSlotForGame(dynasty, { ...playedSF, cfpSlot: 'cfpsf2' })).toBe('cfpsf2')
  })

  it('resolves the championship without needing seeds', () => {
    expect(resolveCfpSlotForGame(dynasty, { id: 'x', year: 2028, gameType: 'cfp_championship' })).toBe('cfpnc')
  })

  it('returns null for a regular game', () => {
    expect(resolveCfpSlotForGame(dynasty, { id: 'y', year: 2028, gameType: 'regular', team1Tid: 10, team2Tid: 20 })).toBe(null)
  })
})

describe('adoptCfpSlotIdentity', () => {
  it('merges a freeform CFP save onto the bracket\'s empty shell', () => {
    const shell = { id: 'cfpsf1-2028', year: 2028, cfpSlot: 'cfpsf1', gameType: 'cfp_semifinal', isCFPSemifinal: true, team1Tid: null, team2Tid: null, bowlName: 'Peach Bowl' }
    const games = [shell, playedSF]
    const { game, updatedGames, structureChanged } = adoptCfpSlotIdentity(dynasty, playedSF, games)

    expect(structureChanged).toBe(true)
    expect(game.id).toBe('cfpsf1-2028')
    expect(game.cfpSlot).toBe('cfpsf1')
    // Result fields win; shell-only fields (bowlName, flag) survive the merge.
    expect(game.team1Tid).toBe(10)
    expect(game.team1Score).toBe(27)
    expect(game.bowlName).toBe('Peach Bowl')
    expect(game.isCFPSemifinal).toBe(true)
    // ONE record left for this semifinal — no freeform stray, no shell dup.
    expect(updatedGames.filter(g => g.id === 'cfpsf1-2028')).toHaveLength(1)
    expect(updatedGames.find(g => g.id === playedSF.id)).toBeUndefined()
  })

  it('adopts the slot identity even with no shell present', () => {
    const { game, updatedGames, structureChanged } = adoptCfpSlotIdentity(dynasty, playedSF, [playedSF])
    expect(structureChanged).toBe(true)
    expect(game.id).toBe('cfpsf1-2028')
    expect(updatedGames).toHaveLength(1)
  })

  it('is a no-op for a game already on its slot identity', () => {
    const onSlot = { ...playedSF, id: 'cfpsf1-2028', cfpSlot: 'cfpsf1' }
    const { structureChanged } = adoptCfpSlotIdentity(dynasty, onSlot, [onSlot])
    expect(structureChanged).toBe(false)
  })

  it('leaves non-CFP games completely alone', () => {
    const regular = { id: 'g9', year: 2028, gameType: 'regular', team1Tid: 10, team2Tid: 20, team1Score: 31, team2Score: 3 }
    const { game, structureChanged } = adoptCfpSlotIdentity(dynasty, regular, [regular])
    expect(structureChanged).toBe(false)
    expect(game.id).toBe('g9')
  })

  it('the adopted semifinal then propagates its winner into the NC shell', () => {
    const ncShell = { id: 'cfpnc-2028', year: 2028, cfpSlot: 'cfpnc', gameType: 'cfp_championship', team1Tid: null, team2Tid: 55 }
    const { game, updatedGames } = adoptCfpSlotIdentity(dynasty, playedSF, [ncShell, playedSF])
    const after = propagateCFPWinner(updatedGames, game)
    const nc = after.find(g => g.id === 'cfpnc-2028')
    // cfpsf1 feeds NC team1 — Rice (tid 10) won, so the TBD slot fills.
    expect(nc.team1Tid).toBe(10)
    expect(nc.team2Tid).toBe(55)
  })
})

// Reproduces the exact shape of a real exported dynasty (Rice 2028, Bowl 3)
// that carried three orphaned CFP records at once: a semifinal whose result
// lived under a freeform id while the bracket linked to an empty shell, plus
// two quarterfinals duplicated with their teams stored in the opposite order.
describe('healCfpSlotDuplicates', () => {
  const seeds2028 = [
    { seed: 1, tid: 59 }, { seed: 2, tid: 23 }, { seed: 3, tid: 34 }, { seed: 4, tid: 84 },
    { seed: 10, tid: 79 }, { seed: 6, tid: 122 },
  ]
  const build = () => ({
    currentYear: 2028,
    cfpSeedsByYear: { 2028: seeds2028 },
    games: [
      // Empty bracket shell — the record the bracket page links to.
      { id: 'cfpsf1-2028', year: 2028, cfpSlot: 'cfpsf1', gameType: 'cfp_semifinal', bowlName: 'Peach Bowl', week: 'Bowl', team1Tid: null, team2Tid: null, team1Score: null, team2Score: null },
      // The user's real Peach Bowl, saved under a freeform id.
      { id: 'cfp-cfp_semifinal-2028-1787606924410', year: 2028, gameType: 'cfp_semifinal', bowlName: 'Peach Bowl', week: 'Bowl', team1Tid: 59, team2Tid: 84, team1Score: null, team2Score: null },
      // Played QF on its slot record.
      { id: 'cfpqf4-2028', year: 2028, cfpSlot: 'cfpqf4', gameType: 'cfp_quarterfinal', bowlName: 'Cotton Bowl', team1Tid: 23, team2Tid: 79, team1Score: 23, team2Score: 31 },
      // Same QF again, freeform, teams+scores in the opposite order.
      { id: 'cfp-cfp_quarterfinal-2028-1787534776331', year: 2028, gameType: 'cfp_quarterfinal', bowlName: 'Cotton Bowl (CFP QF)', team1Tid: 79, team2Tid: 23, team1Score: 31, team2Score: 23 },
    ],
  })

  it('merges the real semifinal onto the bracket shell so the game has teams', () => {
    const out = healCfpSlotDuplicates(build())
    const sf = out.games.filter(g => g.gameType === 'cfp_semifinal')
    expect(sf).toHaveLength(1)
    expect(sf[0].id).toBe('cfpsf1-2028')
    expect(sf[0].team1Tid).toBe(59)
    expect(sf[0].team2Tid).toBe(84)
    expect(sf[0].bowlName).toBe('Peach Bowl')
  })

  it('drops the duplicate quarterfinal without inverting the result', () => {
    const out = healCfpSlotDuplicates(build())
    const qf = out.games.filter(g => g.gameType === 'cfp_quarterfinal')
    expect(qf).toHaveLength(1)
    expect(qf[0].id).toBe('cfpqf4-2028')
    // Ohio State (79) won 31-23 — whichever slot it occupies must carry 31.
    const osu = Number(qf[0].team1Tid) === 79 ? qf[0].team1Score : qf[0].team2Score
    const cu = Number(qf[0].team1Tid) === 79 ? qf[0].team2Score : qf[0].team1Score
    expect(osu).toBe(31)
    expect(cu).toBe(23)
  })

  it('leaves a clean bracket untouched', () => {
    const clean = {
      currentYear: 2028,
      cfpSeedsByYear: { 2028: seeds2028 },
      games: [
        { id: 'cfpsf1-2028', year: 2028, cfpSlot: 'cfpsf1', gameType: 'cfp_semifinal', team1Tid: 59, team2Tid: 84, team1Score: 27, team2Score: 21 },
        { id: 'cfpsf2-2028', year: 2028, cfpSlot: 'cfpsf2', gameType: 'cfp_semifinal', team1Tid: 34, team2Tid: 79, team1Score: 27, team2Score: 21 },
      ],
    }
    expect(healCfpSlotDuplicates(clean)).toBe(clean)
  })

  it('ignores non-CFP games entirely', () => {
    const d = {
      currentYear: 2028,
      games: [
        { id: 'a', year: 2028, gameType: 'regular', team1Tid: 1, team2Tid: 2, team1Score: 7, team2Score: 3 },
        { id: 'b', year: 2028, gameType: 'regular', team1Tid: 1, team2Tid: 2, team1Score: 7, team2Score: 3 },
      ],
    }
    expect(healCfpSlotDuplicates(d)).toBe(d)
  })
})

// "I played Ohio State and USC but it says I played Texas A&M and Boise."
// Propagation wrote each semifinal winner into the title game's slot even
// after the title game had been played, so re-saving a mis-slotted or
// wrongly entered semifinal swapped the played game's opponent while the
// score, recap and box score still described the real one.
describe('propagateCFPWinner — a played next-round game keeps its teams', () => {
  const STANFORD = 101
  const OHIO_STATE = 79
  const BOISE = 9
  const playedNC = {
    id: 'cfpnc-2031', year: 2031, cfpSlot: 'cfpnc', gameType: 'cfp_championship',
    team1Tid: STANFORD, team2Tid: OHIO_STATE, team1Score: 42, team2Score: 35,
  }
  const sf2 = (winner, loser) => ({
    id: 'cfpsf2-2031', year: 2031, cfpSlot: 'cfpsf2', gameType: 'cfp_semifinal',
    team1Tid: winner, team2Tid: loser, team1Score: 30, team2Score: 20,
  })

  it('does not overwrite a played title game with a different winner', () => {
    const games = [playedNC, sf2(BOISE, 50)]
    const after = propagateCFPWinner(games, games[1])
    expect(after.find(g => g.id === 'cfpnc-2031').team2Tid).toBe(OHIO_STATE)
  })

  it('still fills an unplayed shell, including a 0-0 one', () => {
    for (const shell of [
      { ...playedNC, team2Tid: null, team1Score: null, team2Score: null },
      { ...playedNC, team2Tid: 77, team1Score: 0, team2Score: 0 },
    ]) {
      const games = [shell, sf2(OHIO_STATE, 50)]
      const after = propagateCFPWinner(games, games[1])
      expect(after.find(g => g.id === 'cfpnc-2031').team2Tid).toBe(OHIO_STATE)
    }
  })

  it('fills an empty side of a played game', () => {
    const games = [{ ...playedNC, team2Tid: null }, sf2(OHIO_STATE, 50)]
    const after = propagateCFPWinner(games, games[1])
    expect(after.find(g => g.id === 'cfpnc-2031').team2Tid).toBe(OHIO_STATE)
  })
})
