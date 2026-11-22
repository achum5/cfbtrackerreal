import { describe, it, expect } from 'vitest'
import {
  buildDefaultRosterPlayers,
  buildAllDefaultRosterPlayers,
  getCfb27RosterWeeks,
  CFB27_LATEST_ROSTER_WEEK,
} from '../defaultRosterLoader'

const TEMPLE = 95

describe('CFB 27 roster updates', () => {
  it('lists launch first and the newest week last', () => {
    const weeks = getCfb27RosterWeeks()
    expect(weeks[0].id).toBe('1-base')
    expect(weeks[weeks.length - 1].id).toBe(CFB27_LATEST_ROSTER_WEEK)
  })

  it("rebuilds Temple's launch roster from the newest week's files", async () => {
    const launch = await buildDefaultRosterPlayers(TEMPLE, 2026, 1, 'cfb27', { rosterWeek: '1-base' })
    const byName = Object.fromEntries(launch.map((p) => [p.name, p]))
    expect(launch).toHaveLength(85)
    // EA's launch list: Watkins at left guard, Terry at left tackle, and the
    // generic fullback EA's weekly lists stop showing.
    expect(byName['John Watkins'].position).toBe('LG')
    expect(byName['Kevin Terry'].position).toBe('LT')
    expect(byName['Bryant Wallace']).toMatchObject({ position: 'FB', overall: 61 })
    // pids stay contiguous from startPID.
    expect(launch.map((p) => p.pid)).toEqual(launch.map((_, i) => i + 1))
  })

  it('uses the newest week when none is chosen', async () => {
    const none = await buildDefaultRosterPlayers(TEMPLE, 2026, 1, 'cfb27')
    const latest = await buildDefaultRosterPlayers(TEMPLE, 2026, 1, 'cfb27', { rosterWeek: CFB27_LATEST_ROSTER_WEEK })
    expect(none).toEqual(latest)
  })

  it('refuses an unknown week rather than handing back the newest', async () => {
    await expect(buildDefaultRosterPlayers(TEMPLE, 2026, 1, 'cfb27', { rosterWeek: 'cfb-ratings-week-99' })).rejects.toThrow(/Unknown/)
  })

  it('applies the chosen week to every team in a whole-country seed', async () => {
    const teams = { [TEMPLE]: { name: 'Temple' }, 1: { name: 'Air Force' } }
    const players = await buildAllDefaultRosterPlayers(teams, 2026, 1, 'cfb27', { rosterWeek: '1-base' })
    const temple = players.filter((p) => p.team === TEMPLE)
    expect(temple.find((p) => p.name === 'Bryant Wallace')?.position).toBe('FB')
    expect(players.some((p) => p.team === 1)).toBe(true)
  })
})
