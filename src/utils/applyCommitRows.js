// The Recruiting page's "apply commit rows to the player list" step, pulled
// out of handleRecruitingSave so it can be exercised in a test. Row shape is
// parseRecruitingRow's output. Three cases per row, unchanged from the page:
//   1. name already on THIS team        → update the record's recruit fields
//   2. name on ANOTHER team's record    → cross-team transfer into this team
//   3. unknown name                     → new recruit record
// Previous school goes through applyPreviousSchool in every case, so a
// school entered on a later re-save reaches BOTH the previousTeam mirror and
// the arrival movement's fromTid — the fields the cards and timeline read.

import { applyPreviousSchool } from './previousSchool'

const CLASS_TO_YEAR = {
  'HS': 'Fr', 'JUCO Fr': 'So', 'JUCO So': 'Jr', 'JUCO Jr': 'Sr',
  'Fr': 'Fr', 'RS Fr': 'RS Fr', 'So': 'So', 'RS So': 'RS So',
  'Jr': 'Jr', 'RS Jr': 'RS Jr', 'Sr': 'Sr', 'RS Sr': 'RS Sr',
}

const normName = (n) => (n || '').toLowerCase().trim()
const onTeam = (p, tid, abbr) =>
  (p.team != null && p.team !== '' && Number(p.team) === Number(tid)) || (abbr && p.team === abbr)

// Recruiting NIL offer (CFB 27+), absence-safe + carried forward as the
// next-season roster floor (never clobbering an entered value).
function nilPatch(row, existing, year) {
  if (row.nil == null || isNaN(Number(row.nil))) return {}
  const prior = existing?.nilByYear || {}
  return {
    nilByYear: {
      ...prior,
      [year]: Number(row.nil),
      [year + 1]: prior[year + 1] ?? prior[String(year + 1)] ?? Number(row.nil),
    },
  }
}

/**
 * @returns {{ players: Array, nextPID: number }} the full next player list
 *   (untouched records keep their identity, so callers can diff by reference)
 */
export function applyCommitRows({ rows, players, selectedTid, teamAbbr, selectedYear, teams, startPID }) {
  const year = Number(selectedYear)
  const existingByName = {}
  const sameTeamByName = {}
  for (const p of players || []) {
    const key = normName(p?.name)
    if (!key) continue
    existingByName[key] = p
    if (onTeam(p, selectedTid, teamAbbr)) sameTeamByName[key] = p
  }

  const updated = [...(players || [])]
  const added = []
  let nextPID = Number(startPID)

  for (const recruit of rows || []) {
    if (!recruit?.name) continue
    const key = normName(recruit.name)
    const sameTeam = sameTeamByName[key]
    const anyTeam = existingByName[key]

    if (sameTeam) {
      const i = updated.findIndex((p) => p.pid === sameTeam.pid)
      if (i === -1) continue
      const cur = updated[i]
      let next = {
        ...cur,
        position: cur.position || recruit.position,
        archetype: cur.archetype || recruit.archetype,
        // Sheet is authoritative: a blank ('') clears the trait; only an
        // omitted field (undefined) keeps the existing one.
        devTrait: recruit.devTrait ?? cur.devTrait,
        height: recruit.height || cur.height,
        weight: recruit.weight || cur.weight,
        hometown: recruit.hometown || cur.hometown,
        state: recruit.state || cur.state,
        stars: recruit.stars ?? cur.stars,
        nationalRank: recruit.nationalRank ?? cur.nationalRank,
        stateRank: recruit.stateRank ?? cur.stateRank,
        positionRank: recruit.positionRank ?? cur.positionRank,
        gemBust: recruit.gemBust || cur.gemBust,
        previousTeam: recruit.previousTeam || cur.previousTeam,
        isPortal: recruit.isPortal ?? cur.isPortal ?? false,
        ...nilPatch(recruit, cur, year),
      }
      if (next.isPortal) {
        next = applyPreviousSchool(next, { previousTeam: recruit.previousTeam, classYear: year, teams, joiningTid: selectedTid })
      }
      updated[i] = next
      continue
    }

    if (anyTeam) {
      const i = updated.findIndex((p) => p.pid === anyTeam.pid)
      if (i === -1) continue
      const cur = updated[i]
      // The school they came FROM. A record already pointing at the team
      // they're committing to has no origin to record — storing it anyway is
      // what made transfers read "FROM <your own school>".
      const rawFrom = cur.team
      const fromTid = rawFrom != null && rawFrom !== '' && Number(rawFrom) !== Number(selectedTid) ? Number(rawFrom) : null
      let next = {
        ...cur,
        team: selectedTid,
        teamsByYear: { ...cur.teamsByYear, [year + 1]: selectedTid },
        movementByYear: {
          ...(cur.movementByYear || {}),
          [year]: { type: 'arrival', arrival: 'transfer_in', fromTid },
        },
        isPortal: true,
        isRecruit: true,
        recruitYear: year,
        devTrait: recruit.devTrait ?? cur.devTrait,
        stars: recruit.stars ?? cur.stars,
        nationalRank: recruit.nationalRank ?? cur.nationalRank,
        stateRank: recruit.stateRank ?? cur.stateRank,
        positionRank: recruit.positionRank ?? cur.positionRank,
        gemBust: recruit.gemBust || cur.gemBust,
        ...nilPatch(recruit, cur, year),
      }
      next = applyPreviousSchool(next, {
        previousTeam: recruit.previousTeam || fromTid || cur.previousTeam,
        classYear: year, teams, joiningTid: selectedTid,
      })
      updated[i] = next
      continue
    }

    const pid = nextPID++
    let fresh = {
      pid,
      id: `player-${pid}`,
      name: recruit.name,
      position: recruit.position || '',
      year: CLASS_TO_YEAR[recruit.class] || 'Fr',
      jerseyNumber: '',
      // Dev traits are often hidden until signing day — leave blank when the
      // user didn't enter one (don't presume Normal).
      devTrait: recruit.devTrait || '',
      archetype: recruit.archetype || '',
      overall: null,
      height: recruit.height || '',
      weight: recruit.weight || 0,
      hometown: recruit.hometown || '',
      state: recruit.state || '',
      team: selectedTid,
      isRecruit: true,
      recruitYear: year,
      teamsByYear: { [year + 1]: selectedTid },
      movementByYear: { [year]: { type: 'arrival', arrival: 'recruit' } },
      stars: recruit.stars || 0,
      nationalRank: recruit.nationalRank || null,
      stateRank: recruit.stateRank || null,
      positionRank: recruit.positionRank || null,
      gemBust: recruit.gemBust || '',
      previousTeam: recruit.previousTeam || '',
      isPortal: recruit.isPortal || false,
      // New signee, so both years start at the offer.
      ...(recruit.nil != null && !isNaN(Number(recruit.nil))
        ? { nilByYear: { [year]: Number(recruit.nil), [year + 1]: Number(recruit.nil) } }
        : {}),
    }
    if (fresh.isPortal) {
      fresh = applyPreviousSchool(fresh, { previousTeam: recruit.previousTeam, classYear: year, teams, joiningTid: selectedTid })
    }
    added.push(fresh)
  }

  return { players: [...updated, ...added], nextPID }
}
