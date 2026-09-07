// Pure part of the Position Changes save (Signing Day / Training Camp).
//
// The component keeps the I/O split that was already there: on cloud it
// writes each changed player as its own doc (updatePlayer) and then the
// year record; locally it writes players + record in one updateDynasty.
// Both branches consume the values built here, so the decision of WHAT
// changes is in one tested place. Pinned by __tests__/positionChanges.test.js.

import { getCurrentTeamTid } from '../data/teamRegistry'

/**
 * @returns {{
 *   year: number,
 *   positionChangesByYear: object,   // full map to persist
 *   changedPlayers: object[],        // only players whose position actually changes, updated
 *   updatedPlayers: object[],        // full roster with changes applied (local-storage write)
 * }}
 */
export function buildPositionChangesSave(dynasty, changes) {
  const isAfterYearFlip = dynasty.currentPhase === 'offseason' && dynasty.currentWeek >= 6
  const year = isAfterYearFlip ? dynasty.currentYear - 1 : dynasty.currentYear
  const existingChangesAll = dynasty.positionChangesByYear || {}
  const teamTid = getCurrentTeamTid(dynasty)

  const changesRecord = (changes || []).map(c => ({
    pid: c.playerId,
    playerName: c.playerName,
    oldPosition: c.oldPosition,
    newPosition: c.newPosition,
    team: teamTid,
  }))
  const positionChangesByYear = { ...existingChangesAll, [year]: changesRecord }

  const players = dynasty.players || []
  const changedPlayers = (changes || [])
    .map(c => {
      const p = players.find(pl => pl.pid === c.playerId)
      if (!p || p.position === c.newPosition) return null
      return { ...p, position: c.newPosition, archetype: '' }
    })
    .filter(Boolean)

  const updatedPlayers = players.map(p => {
    const change = (changes || []).find(c => c.playerId === p.pid)
    if (!change || p.position === change.newPosition) return p
    return { ...p, position: change.newPosition, archetype: '' }
  })

  return { year, positionChangesByYear, changedPlayers, updatedPlayers }
}
