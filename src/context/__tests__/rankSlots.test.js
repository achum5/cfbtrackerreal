import { describe, it, expect } from 'vitest'
import { rankSlotForGame, healCfpRankSlots, getTeamRanking, getTeamRankForWeek, RANK_SLOT } from '../DynastyContext'

// One rank-slot numbering for the whole app. Regular weeks key on their
// number; the postseason is 16 (CCG week), 17–20 (Bowl Weeks 1–3, National
// Championship) and 105 (Final Poll). Postseason games store a STRING week
// ('CCG', 'Bowl'), so every reader must go through rankSlotForGame.

describe('rankSlotForGame', () => {
  it('regular-season games key on their numeric week', () => {
    expect(rankSlotForGame({ week: 0 })).toBe(0)
    expect(rankSlotForGame({ week: '7' })).toBe(7)
    expect(rankSlotForGame({ week: 14, gameType: 'regular' })).toBe(14)
  })
  it('postseason games resolve their calendar slot regardless of the string week', () => {
    expect(rankSlotForGame({ week: 'CCG', isConferenceChampionship: true })).toBe(RANK_SLOT.CCG)
    expect(rankSlotForGame({ week: 'Bowl', isBowlGame: true, bowlWeek: 'week1' })).toBe(RANK_SLOT.BOWL1)
    expect(rankSlotForGame({ week: 'Bowl', isBowlGame: true, bowlWeek: 'week2' })).toBe(RANK_SLOT.BOWL2)
    expect(rankSlotForGame({ week: 'Bowl', isBowlGame: true, bowlWeek: 'week3' })).toBe(RANK_SLOT.BOWL3)
    expect(rankSlotForGame({ gameType: 'cfp_first_round' })).toBe(17)
    expect(rankSlotForGame({ gameType: 'cfp_quarterfinal' })).toBe(18)
    expect(rankSlotForGame({ gameType: 'cfp_semifinal' })).toBe(19)
    expect(rankSlotForGame({ gameType: 'cfp_championship' })).toBe(20)
  })
  it('returns null for nothing usable', () => {
    expect(rankSlotForGame(null)).toBeNull()
    expect(rankSlotForGame({ week: 'Bowl' })).toBeNull()
  })
})

describe('healCfpRankSlots', () => {
  const team = (rankByWeek, cfpRankByWeek) => ({ tid: 42, abbr: 'IU', byYear: { 2030: { rankByWeek, ...(cfpRankByWeek ? { cfpRankByWeek } : {}) } } })
  it('folds 101–104 onto 17–20, calendar slot winning when both exist', () => {
    const d = { teams: { 42: team({ 14: 5, 101: 4, 102: 3, 103: 2, 104: 1, 105: 1 }) } }
    const out = healCfpRankSlots(d)
    expect(out.teams[42].byYear[2030].rankByWeek).toEqual({ 14: 5, 17: 4, 18: 3, 19: 2, 20: 1, 105: 1 })
    const both = { teams: { 42: team({ 17: 6, 101: 4 }) } }
    expect(healCfpRankSlots(both).teams[42].byYear[2030].rankByWeek).toEqual({ 17: 6 })
  })
  it('folds cfpRankByWeek too and is a fixed point', () => {
    const d = { teams: { 42: team({ 14: 5 }, { 102: 2 }) } }
    const once = healCfpRankSlots(d)
    expect(once.teams[42].byYear[2030].cfpRankByWeek).toEqual({ 18: 2 })
    expect(once.teams[42].byYear[2030].rankByWeek).toEqual({ 14: 5 })
    expect(healCfpRankSlots(once)).toBe(once)
  })
  it('returns the same object when there is nothing to fold', () => {
    const d = { teams: { 42: team({ 14: 5, 17: 4 }) } }
    expect(healCfpRankSlots(d)).toBe(d)
    expect(healCfpRankSlots({})).toEqual({})
  })
})

describe('getTeamRanking during the postseason', () => {
  const dyn = (rankByWeek, extra = {}) => ({
    currentYear: 2030, currentPhase: 'postseason', currentWeek: 3,
    teams: { 42: { tid: 42, abbr: 'IU', byYear: { 2030: { rankByWeek } } } },
    ...extra,
  })
  it('sees a bowl-week poll (slots 17–20), newest first', () => {
    expect(getTeamRanking(dyn({ 14: 5, 16: 4, 18: 3 }), 42, 2030)).toMatchObject({ rank: 3, week: 18 })
    expect(getTeamRanking(dyn({ 14: 5, 16: 4, 18: 3, 20: 2 }), 42, 2030)).toMatchObject({ rank: 2, week: 20 })
  })
  it('falls back to CCG week when no bowl poll exists yet', () => {
    expect(getTeamRanking(dyn({ 14: 5, 16: 4 }), 42, 2030)).toMatchObject({ rank: 4, week: 16 })
  })
  it('the Final Poll beats every calendar slot', () => {
    expect(getTeamRanking(dyn({ 20: 2, 105: 1 }), 42, 2030)).toMatchObject({ rank: 1, week: 105 })
  })
})

describe('getTeamRankForWeek carry-forward across the postseason', () => {
  const d = { teams: { 42: { tid: 42, abbr: 'IU', byYear: { 2030: { rankByWeek: { 14: 5, 16: 4, 105: 1 } } } } } }
  it('a bowl-week slot inherits the CCG-week poll, never the Final Poll', () => {
    expect(getTeamRankForWeek(d, 42, 2030, 18)).toBe(4)
    expect(getTeamRankForWeek(d, 42, 2030, 20)).toBe(4)
  })
})
