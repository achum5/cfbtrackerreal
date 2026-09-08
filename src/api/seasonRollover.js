// Season rollover — the per-player roster transitions, extracted VERBATIM
// from DynastyContext so they can be exercised by fixture tests that walk a
// dynasty through a full offseason (the zengm "phase function" pattern:
// one pure function per transition, idempotent per player, tested by
// running the real code over a fixture league rather than a re-implementation).
//
// Three transitions live here:
//
//   rollOverRosterAtYearFlip      offseason wk5→6 (Signing Day / year flip)
//                                 class progression + carry-over for every
//                                 team, redshirt-aware on member teams, simple
//                                 aging on CPU teams, auto-graduation of
//                                 exhausted eligibility (console only)
//   appendAutoGraduatedToLeavingStores
//                                 the Players Leaving rows for seniors the
//                                 rule above graduated (append-only)
//   advanceSeasonPlayers          offseason wk8→preseason: recruit conversion,
//                                 encouraged transfers, departures, new-season
//                                 teamsByYear/classByYear stamps for the
//                                 user's team
//
// All three are pure: (dynasty, input) → new values. Nothing here persists.
// The DynastyContext callers own logging, the phase-transition flag and the
// Firestore/IndexedDB write. Every player returned unchanged is the SAME
// object reference the caller passed in — the fast-path save relies on that
// identity to find the changed subset.
//
// Idempotency contract (pinned by src/api/__tests__/seasonRollover.test.js):
// running any of these a second time over its own output is a no-op.
// This is what makes a double advance harmless instead of data-corrupting.

import {
  getPlayersLeaving,
  getEncourageTransfers,
  getDraftResults,
  getPortalTransferClass,
  isPlayerOnRoster,
  getPlayerClassForYear,
  hasRecommitForYear,
  hasUnresolvedDeparture,
  CLASS_PROGRESSION,
} from '../context/DynastyContext'
import { getTidFromAbbr, getOriginalTeamAbbr } from '../data/teamRegistry'
import { isPcAutoDynasty } from '../editions'
import { hasExhaustedEligibility } from '../utils/graduatingSeniors'

/**
 * Offseason wk5→6: progress every player's class into `nextYear` and carry
 * the continuing ones onto next season's roster.
 *
 * @param {object} dynasty
 * @param {object} input
 * @param {number} input.nextYear            the season being entered
 * @param {number} input.previousSeasonYear  the season that just ended
 * @param {number|null} input.teamTid        the commissioner's team
 * @param {object} [input.classConfirmations] pid → boolean ("played 5+ games")
 *   answers collected by the advance modal for players with no games recorded
 * @returns {{ players: object[], autoGraduated: {pid, playerName, tid}[], counts: object }}
 */
export function rollOverRosterAtYearFlip(dynasty, { nextYear, previousSeasonYear, teamTid, classConfirmations = {} }) {
  const allPlayers = dynasty.players || []

  // Get Players Leaving list - these players should NOT be carried over
  const playersLeavingList = getPlayersLeaving(dynasty, teamTid, previousSeasonYear)
  const leavingPids = new Set(playersLeavingList.map(p => p.pid).filter(Boolean))
  // Only fall back to NAME matching for leaving entries that have NO pid.
  // Every leaving entry from the modal already carries a pid, so the pid
  // check below is authoritative; matching by name too dropped unrelated
  // returning players who merely shared a name with a departing player
  // (common across a full league's CPU rosters — a graduating "Chris
  // Jackson" would drop a returning freshman "Chris Jackson").
  const leavingNames = new Set(
    playersLeavingList.filter(p => !p.pid).map(p => p.name?.toLowerCase().trim()).filter(Boolean)
  )

  // Every team a member controls is a first-class roster that must
  // progress exactly like the commish's own (redshirt-aware class
  // progression + carry-over), NOT the lighter "simple aging" CPU path.
  // Build the set of member-controlled tids (commish's own team included).
  const memberTidSet = new Set()
  if (teamTid != null) memberTidSet.add(Number(teamTid))
  for (const tids of Object.values(dynasty.memberTeams || {})) {
    for (const t of (Array.isArray(tids) ? tids : [])) {
      const n = Number(t); if (Number.isFinite(n)) memberTidSet.add(n)
    }
  }
  // The member-controlled team this player was on last season, or null
  // (null ⇒ a CPU team, which keeps the lighter simple-aging path).
  const memberTeamOf = (player) => {
    for (const t of memberTidSet) {
      // MUST pass `dynasty` — otherwise a teambuilder-renamed slot or a
      // legacy roster that stored teamsByYear as an abbr STRING fails to
      // resolve (isPlayerOnRoster falls back to the static registry abbr),
      // returns false for every player, and the ENTIRE roster is misrouted
      // to the lossy CPU "simple aging" path (which drops all seniors). That
      // emptied next-year rosters on imported/teambuilder dynasties.
      if (isPlayerOnRoster(player, t, previousSeasonYear, dynasty)) return t
    }
    return null
  }

  // The tid a player was actually on last season, member team or not.
  // isPlayerLeaving/hasUnresolvedDeparture decide "did they leave and
  // never come back" RELATIVE to a home team: a transfer_out whose toTid
  // is that home team is an arrival, and a later teamsByYear entry on
  // that home team is proof they returned. Both tests need the player's
  // OWN team to mean anything — evaluating a CPU-team player against the
  // user's tid makes their transfer to another school look permanently
  // unresolved. Falls back to null (caller then uses the default) when
  // the season's slot is missing or unresolvable.
  const rosterTidOf = (player) => {
    const raw = player.teamsByYear?.[previousSeasonYear]
      ?? player.teamsByYear?.[String(previousSeasonYear)]
    if (raw == null) return null
    if (typeof raw === 'number') return raw
    const resolved = getTidFromAbbr(raw, dynasty)
    return resolved == null ? null : resolved
  }

  // Teambuilder imports have been observed leaving isRecruit:true stuck on
  // players who have multiple seasons of teamsByYear entries — Jay's STONY
  // dynasty had 20 players with isRecruit:true who'd been on the roster
  // since 2027. The skip-recruits guards below would silently drop them
  // every year flip. Treat the flag as stale (i.e. the player is NOT
  // actually a new recruit) when any prior teamsByYear entry exists.
  const isStaleRecruitFlag = (player) => {
    if (!player.isRecruit) return false
    const tby = player.teamsByYear || {}
    for (const yKey of Object.keys(tby)) {
      const y = Number(yKey)
      if (Number.isFinite(y) && y <= previousSeasonYear) return true
    }
    return false
  }

  // Helper to check if player is leaving. The leaving-list checks stay
  // here; the movement-record checks (legacy movements[] + v2
  // movementByYear, incl. prior-year departures with no later return)
  // live in the module-scope hasUnresolvedDeparture so that
  // advanceToNewSeason applies the exact same departure rule — it
  // previously only consulted the leaving list, which is what let
  // movement-recorded departures get carried back onto the roster.
  const isPlayerLeaving = (player, homeTid = teamTid) => {
    // Recommit override runs BEFORE the list checks — a player who
    // recommitted after entering the portal isn't leaving even if a
    // stale leaving-list entry still names them.
    if (hasRecommitForYear(player, previousSeasonYear)) return false

    if (leavingPids.has(player.pid)) return true
    if (player.name && leavingNames.has(player.name.toLowerCase().trim())) return true

    return hasUnresolvedDeparture(player, homeTid, previousSeasonYear, dynasty)
  }

  let carriedOver = 0
  let alreadyHadNextYear = 0
  let notCarriedOver = 0
  const autoGraduated = [] // { pid, playerName, tid } — seniors graduated by rule, not by the list
  let recruitsSkipped = 0
  let otherTeamSkipped = 0
  let honorOnlySkipped = 0


  const processedPlayers = allPlayers.map(player => {
    // Skip honor-only players (historical records)
    if (player.isHonorOnly) {
      honorOnlySkipped++
      return player
    }

    // Skip recruits (they're handled at week 7→8). isStaleRecruitFlag
    // unsticks the flag so imported players who've been on the roster for
    // years aren't treated as never-played recruits.
    if (player.isRecruit && !isStaleRecruitFlag(player)) {
      recruitsSkipped++
      return player
    }

    // Skip players who already have nextYear set (already processed)
    const hasNextYear = player.teamsByYear?.[nextYear] ?? player.teamsByYear?.[String(nextYear)]

    if (hasNextYear) {
      alreadyHadNextYear++
      return player
    }

    // Which member-controlled team was this player on last season?
    // null ⇒ a CPU team → lighter simple-aging path below. Any member
    // team (commish OR another member) → full redshirt-aware path.
    const playerMemberTid = memberTeamOf(player)
    if (playerMemberTid == null) {
      otherTeamSkipped++

      // ========== SIMPLE AGING FOR OTHER TEAM PLAYERS ==========
      // These players aren't on the user's team, so apply simple linear progression
      // No redshirt logic - just advance class and graduate seniors

      // CRITICAL: A CPU-team player who transferred out / entered the
      // portal / graduated / declared for the draft must NOT be carried
      // forward to nextYear on their old team — otherwise they reappear
      // on that roster the next season ("guys off team finding way back
      // on roster"). isPlayerLeaving inspects movementByYear AND legacy
      // movements[] for any departure on or before previousSeasonYear
      // that wasn't followed by an arrival/recommit, so it correctly
      // catches transfers regardless of which team's roster the player
      // was on.
      // Pass the player's OWN team. Without it this defaulted to the
      // user's tid, and every escape hatch in hasUnresolvedDeparture is
      // keyed to the home team — so a player who transferred from the
      // user's team to CPU team B (departure toTid=B, teamsByYear[S]=B,
      // and typically no arrival record, which is what the implicit-
      // arrival net exists for) still read as "gone" a year later and was
      // dropped from B's roster, vanishing from the league entirely one
      // season after the move. The member-team path below already passes
      // its own tid for exactly this reason.
      if (isPlayerLeaving(player, rosterTidOf(player) ?? teamTid)) {
        return player
      }

      // Determine the prior-season class via the canonical progression
      // walker. It handles sparse classByYear (e.g. a transfer whose senior
      // year was never recorded) and returns null once a player walks past
      // Sr — so we no longer rely on the stale top-level player.year, which
      // caused transfers to be advanced into an EXTRA senior season instead
      // of graduating (e.g. a Jr-in-2033 transfer reappearing as a senior in
      // both 2034 and 2035).
      const priorClass = getPlayerClassForYear(player, previousSeasonYear)
      const hasClassHistory = !!(player.classByYear && Object.keys(player.classByYear).length)

      // Graduate (don't carry to nextYear) when eligibility is exhausted, or
      // when the walker already places them past Sr.
      if (priorClass === 'Sr' || priorClass === 'RS Sr' || (priorClass == null && hasClassHistory)) {
        return player
      }

      // Not graduating - advance their class
      const otherTeamClass = priorClass || player.year
      // Defensive: if a CPU player has neither classByYear nor player.year,
      // otherTeamClass is undefined and this would write year/classByYear
      // as undefined. Keep whatever class already exists rather than
      // stamping an undefined over it.
      const newOtherClass = CLASS_PROGRESSION[otherTeamClass] || otherTeamClass || player.year || null

      // Get their current team tid from teamsByYear
      let otherTeamTid = player.teamsByYear?.[previousSeasonYear] ||
                     player.teamsByYear?.[String(previousSeasonYear)] ||
                     player.team
      // Keep teamsByYear tid-pure: if the only source was a legacy abbr
      // string on player.team, resolve it to a tid so we don't leak an abbr
      // into the new season (readers still normalize, but membership by tid
      // is the invariant).
      if (typeof otherTeamTid === 'string' && !/^\d+$/.test(otherTeamTid)) {
        otherTeamTid = getTidFromAbbr(otherTeamTid, dynasty) ?? otherTeamTid
      }

      return {
        ...player,
        year: newOtherClass,
        classByYear: {
          ...(player.classByYear || {}),
          [nextYear]: newOtherClass
        },
        ...(otherTeamTid ? {
          teamsByYear: {
            ...(player.teamsByYear || {}),
            [nextYear]: otherTeamTid
          }
        } : {}),
        ...(player.devTrait ? {
          devTraitByYear: {
            ...(player.devTraitByYear || {}),
            [nextYear]: player.devTrait
          }
        } : {}),
        ...(player.overall ? {
          overallByYear: {
            ...(player.overallByYear || {}),
            [nextYear]: player.overall
          }
        } : {})
      }
    }

    // Check if player is leaving (evaluated against THEIR team)
    if (isPlayerLeaving(player, playerMemberTid)) {
      notCarriedOver++
      // Don't add next year to teamsByYear - player is leaving
      return player
    }

    // ========== AUTO-GRADUATE EXHAUSTED ELIGIBILITY ==========
    // A senior nobody listed in Players Leaving used to be carried into
    // an extra season: CLASS_PROGRESSION sends Sr -> RS Sr, and an RS Sr
    // has nowhere left to go, so they repeated on the roster forever
    // ("how do I remove graduating players from my roster"). The CPU-team
    // path above already graduates by class; this brings member teams in
    // line using the same rule the Players Leaving pre-fill uses (RS Sr
    // always; Sr with 5+ games — 0-4 is a legitimate redshirt and stays
    // on the normal path). Records the departure so every reader sees a
    // graduate, and adds them to the leaving list below.
    // PC dynasties are excluded: their rosters are the save's, and a
    // senior the save still carries (medical year, etc.) must not be
    // dropped by a rule of ours.
    if (!isPcAutoDynasty(dynasty) && hasExhaustedEligibility(player, previousSeasonYear)) {
      notCarriedOver++
      autoGraduated.push({ pid: player.pid, playerName: player.name, tid: playerMemberTid })
      const existingMv = player.movementByYear?.[previousSeasonYear] ?? player.movementByYear?.[String(previousSeasonYear)]
      if (existingMv?.type === 'departure') return player
      return {
        ...player,
        movementByYear: { ...(player.movementByYear || {}), [previousSeasonYear]: { type: 'departure', departure: 'graduated' } },
      }
    }

    // ========== CARRY OVER THIS PLAYER ==========
    carriedOver++

    // Get their class for progression
    const currentClass = player.classByYear?.[previousSeasonYear] || player.classByYear?.[String(previousSeasonYear)] || player.year
    const isAlreadyRS = currentClass?.startsWith('RS ')

    // Get games played to determine redshirt
    const yearStats = player.statsByYear?.[previousSeasonYear] || player.statsByYear?.[String(previousSeasonYear)]
    let gamesPlayed = yearStats?.gamesPlayed

    // Use class confirmation if provided
    if ((gamesPlayed === null || gamesPlayed === undefined) && classConfirmations[player.pid] !== undefined) {
      gamesPlayed = classConfirmations[player.pid] ? 5 : 0
    }

    // Determine new class
    let newClass = currentClass
    if (gamesPlayed !== null && gamesPlayed !== undefined) {
      if (gamesPlayed <= 4 && !isAlreadyRS) {
        newClass = 'RS ' + currentClass // Redshirt
      } else {
        newClass = CLASS_PROGRESSION[currentClass] || currentClass
      }
    } else {
      newClass = CLASS_PROGRESSION[currentClass] || currentClass
    }

    // Add teamsByYear entry for next year and update class + carry forward dev trait and overall
    return {
      ...player,
      year: newClass,
      classByYear: {
        ...(player.classByYear || {}),
        [nextYear]: newClass
      },
      teamsByYear: {
        ...(player.teamsByYear || {}),
        [nextYear]: playerMemberTid
      },
      ...(player.devTrait ? {
        devTraitByYear: {
          ...(player.devTraitByYear || {}),
          [nextYear]: player.devTrait
        }
      } : {}),
      ...(player.overall ? {
        overallByYear: {
          ...(player.overallByYear || {}),
          [nextYear]: player.overall
        }
      } : {})
    }
  })
  return {
    players: processedPlayers,
    autoGraduated,
    counts: { carriedOver, alreadyHadNextYear, notCarriedOver, recruitsSkipped, otherTeamSkipped, honorOnlySkipped },
  }
}

/**
 * Players Leaving rows for seniors graduated by rule (not by the user's
 * list), for the season that just ended. Append-only and dual-keyed
 * (abbr + tid) exactly like handlePlayersLeavingSave. Returns the partial
 * dynasty update ({} when nothing to add).
 */
export function appendAutoGraduatedToLeavingStores(dynasty, autoGraduated, previousSeasonYear) {
  const updates = {}
  if (!autoGraduated || autoGraduated.length === 0) return updates
  const yr = previousSeasonYear
  const yearRows = dynasty.playersLeavingByYear?.[yr] || dynasty.playersLeavingByYear?.[String(yr)] || []
  const listedPids = new Set(yearRows.map(r => r?.pid).filter(v => v != null))
  const newRows = autoGraduated
    .filter(g => !listedPids.has(g.pid))
    .map(g => ({ playerName: g.playerName, pid: g.pid, reason: 'Graduating' }))
  if (newRows.length > 0) {
    updates.playersLeavingByYear = {
      ...(dynasty.playersLeavingByYear || {}),
      [yr]: [...yearRows, ...newRows],
    }
    // Team-centric store, dual-keyed (abbr + tid) like handlePlayersLeavingSave.
    const byTeamYear = { ...(dynasty.playersLeavingByTeamYear || {}) }
    const byTid = new Map()
    for (const g of autoGraduated) {
      if (g.tid == null) continue
      if (!byTid.has(g.tid)) byTid.set(g.tid, [])
      byTid.get(g.tid).push(g)
    }
    for (const [tidKey, grads] of byTid) {
      const abbr = dynasty.teams?.[tidKey]?.abbr || getOriginalTeamAbbr(tidKey)
      for (const key of [abbr, tidKey].filter(k => k != null)) {
        const cur = byTeamYear[key]?.[yr] || []
        const have = new Set(cur.map(r => r?.pid).filter(v => v != null))
        const add = grads.filter(g => !have.has(g.pid)).map(g => ({ playerName: g.playerName, pid: g.pid, reason: 'Graduating' }))
        if (add.length === 0) continue
        byTeamYear[key] = { ...(byTeamYear[key] || {}), [yr]: [...cur, ...add] }
      }
    }
    updates.playersLeavingByTeamYear = byTeamYear
  }
  return updates
}

// Departing players pick up their Draft Results round/pick. Returns the SAME
// player object when nothing would change so a re-run stays a no-op for the
// identity-based fast-path save.
function withDraftInfo(player, draftInfo) {
  const draftRound = draftInfo?.draftRound || player.draftRound || null
  const draftPick = draftInfo?.draftPick || player.draftPick || null
  if (player.draftRound === draftRound && player.draftPick === draftPick) return player
  return { ...player, draftRound, draftPick }
}

const ENCOURAGED_MARKER = Object.freeze({
  type: 'departure',
  departure: 'transfer_out',
  toTid: null,
  reason: 'Encouraged Transfer',
})
const isEncouragedMarker = (m) => !!m
  && m.type === ENCOURAGED_MARKER.type
  && m.departure === ENCOURAGED_MARKER.departure
  && m.toTid == null
  && m.reason === ENCOURAGED_MARKER.reason

/**
 * Offseason wk8→preseason: the user's-team pass. Converts this cycle's
 * recruits, records encouraged transfers, honors departures, and stamps
 * the new season onto every continuing player. Class progression already
 * happened at the year flip; this only adds the new-season tracking.
 *
 * @param {object} dynasty  currentYear is ALREADY the new season
 * @param {object} input
 * @param {number} input.previousSeasonYear
 * @param {number} input.currentSeasonYear
 * @param {number|null} input.teamTid
 * @param {string} input.teamAbbr  legacy lookups only (portal class sheet)
 * @returns {{ players: object[] }}
 */
export function advanceSeasonPlayers(dynasty, { previousSeasonYear, currentSeasonYear, teamTid, teamAbbr }) {
  const players = dynasty.players || []
  const getByYear = (obj, year) => obj?.[year] ?? obj?.[String(year)] ?? obj?.[Number(year)]

  // Get players leaving data (stored under previous season year)
  const playersLeavingThisYear = getPlayersLeaving(dynasty, teamTid, previousSeasonYear)
  const leavingPids = new Set(playersLeavingThisYear.map(p => p.pid).filter(Boolean))

  // Get encouraged transfers data (stored under current season year - after year flip)
  const encouragedTransfers = getEncourageTransfers(dynasty, teamTid, currentSeasonYear)
  const encouragedNames = new Set(encouragedTransfers.map(t => t.name?.toLowerCase().trim()))

  // Get draft results for draft round info (stored under previous season year)
  const draftResults = getDraftResults(dynasty, teamTid, previousSeasonYear)
  const draftByPid = {}
  draftResults.forEach(d => {
    if (d.pid) draftByPid[d.pid] = d
  })

  // Helper to check if a teamsByYear value matches the current team (handles tid or abbr)
  const isTeamMatch = (value) => {
    if (!value || !teamTid) return false
    if (typeof value === 'number') return value === teamTid
    // Legacy: if stored as abbr string, convert to tid and compare
    return getTidFromAbbr(value, dynasty) === teamTid
  }

  // Process each player
  const updatedPlayers = players.map(player => {
    // Skip honor-only players
    if (player.isHonorOnly) return player

    // Skip players from other teams (use teamsByYear for previous season as primary check)
    // CRITICAL: Handle both tid (number) and legacy abbr (string) in teamsByYear values
    const playerTeamPrevSeason = player.teamsByYear?.[previousSeasonYear] ?? player.teamsByYear?.[String(previousSeasonYear)]
    if (playerTeamPrevSeason && !isTeamMatch(playerTeamPrevSeason)) return player
    // Also check player.team field (could be tid or abbr)
    const playerTeamFieldTid = typeof player.team === 'number' ? player.team : getTidFromAbbr(player.team, dynasty)
    if (!playerTeamPrevSeason && player.team && playerTeamFieldTid !== teamTid) return player

    // Check if player has any FUTURE year on this team (indicates they should still be on the team)
    const hasFutureYearOnTeam = Object.entries(player.teamsByYear || {}).some(([yearKey, team]) => {
      const year = Number(yearKey)
      return isTeamMatch(team) && year > previousSeasonYear
    })

    // CRITICAL: Skip players who weren't on the team last season (they already left in a prior year)
    // This prevents departed players from being re-added to the roster
    // Exception: recruits are handled separately below
    // Exception: if they have a future year on this team, they should be processed (data was incomplete)
    if (!playerTeamPrevSeason && !player.isRecruit && !hasFutureYearOnTeam) return player

    // Check if player is an encouraged transfer FIRST (before any early returns)
    // They don't get teamsByYear[newYear] - their career with this team ends
    // CRITICAL: Must REMOVE teamsByYear[currentSeasonYear] if it was set by saveRoster earlier
    // The encourageTransfersByTeamYear data is the source of truth for Career Timeline display
    const playerNameLower = player.name?.toLowerCase().trim()
    if (!player.isRecruit && encouragedNames.has(playerNameLower)) {
      // Already recorded (a re-run, or the Encourage Transfers save wrote
      // the canonical marker itself): nothing to do — keep the reference.
      const tby = player.teamsByYear || {}
      const hasNewSeasonSlot = tby[currentSeasonYear] != null || tby[String(currentSeasonYear)] != null
      const existingMv = player.movementByYear?.[previousSeasonYear] ?? player.movementByYear?.[String(previousSeasonYear)]
      if (!hasNewSeasonSlot && isEncouragedMarker(existingMv)) return player
      // Remove current season year from teamsByYear (may have been set by earlier roster operations)
      const updatedTeamsByYear = { ...tby }
      delete updatedTeamsByYear[currentSeasonYear]
      delete updatedTeamsByYear[String(currentSeasonYear)]
      return {
        ...player,
        teamsByYear: updatedTeamsByYear,
        movementByYear: {
          ...(player.movementByYear || {}),
          // Canonical v2 — legacy 'encouraged_to_transfer' was being
          // converted to this exact shape by syncDerivedFieldsFromV2 on
          // every save. Write it directly to skip the round-trip.
          [previousSeasonYear]: { ...ENCOURAGED_MARKER },
        }
      }
    }

    // Skip players who already have a team for the current season (already processed or transferred)
    const existingTeamForCurrentSeason = player.teamsByYear?.[currentSeasonYear] ?? player.teamsByYear?.[String(currentSeasonYear)]
    if (existingTeamForCurrentSeason) {
      // …unless the slot points at OUR team and the player has an
      // unresolved departure record. saveRoster/imports can seed the
      // new-season slot before the advance runs, which used to make a
      // departed player look "already processed" and keep them on the
      // roster. Strip the seeded year instead — same treatment the
      // encouraged-transfer branch above applies. (A slot pointing at a
      // DIFFERENT team is a Transfer Destination and stays untouched;
      // recommits return false from hasUnresolvedDeparture and are kept.)
      if (isTeamMatch(existingTeamForCurrentSeason) &&
          hasUnresolvedDeparture(player, teamTid, previousSeasonYear, dynasty,
            { excludeTeamsByYearYear: currentSeasonYear })) {
        const cleanedTeamsByYear = { ...(player.teamsByYear || {}) }
        delete cleanedTeamsByYear[currentSeasonYear]
        delete cleanedTeamsByYear[String(currentSeasonYear)]
        return withDraftInfo({ ...player, teamsByYear: cleanedTeamsByYear }, draftByPid[player.pid])
      }
      // Player already has a team for next season (set by Transfer Destinations or recommit)
      // Clear isRecruit if applicable (handles recommit players who have teamsByYear set but still have isRecruit: true)
      // Normalize to tid — teamsByYear can hold a legacy abbr string, but
      // player.team is canonically a tid (number). Writing the abbr through
      // would propagate stale data into a field downstream code treats as tid.
      const existingTeamTid = typeof existingTeamForCurrentSeason === 'number'
        ? existingTeamForCurrentSeason
        : getTidFromAbbr(existingTeamForCurrentSeason, dynasty) || existingTeamForCurrentSeason
      // Already normalised (a re-run): keep the reference.
      if (player.team === existingTeamTid && player.isRecruit === false) return player
      return {
        ...player,
        team: existingTeamTid,
        isRecruit: false  // Always clear - if they have a team for this season, they're not a recruit
      }
    }

    // Check if player is leaving (from Players Leaving sheet)
    if (leavingPids.has(player.pid)) {
      // Player is departing - do NOT add current season year to teamsByYear
      // movements[] was already added in handlePlayersLeavingSave/handleTransferDestinationsSave
      // Just add draft info if applicable
      return withDraftInfo(player, draftByPid[player.pid])
    }

    // Check for RS Sr players not in playersLeaving - auto-graduate them.
    // IMPORTANT: Only auto-graduate if they were ALREADY RS Sr in the
    // previous season (before Signing Day class progression). Players
    // who just became RS Sr should play next season.
    //
    // Movement is written to canonical v2 movementByYear directly. The
    // legacy movements[] array is stripped by syncDerivedFieldsFromV2 on
    // every save, so the previous parallel write was dead code AND used
    // a non-canonical shape that the heal then converted on save.
    const previousSeasonClass = player.classByYear?.[previousSeasonYear]
    // A stale isRecruit:true flag (see "Skip recruits from other years"
    // below) would otherwise prevent an actual RS Sr from being marked
    // graduated.
    const hasPriorTeamYearForGrad = Object.keys(player.teamsByYear || {}).some(k => {
      const y = Number(k)
      return Number.isFinite(y) && y <= previousSeasonYear
    })
    const isGenuineRecruit = player.isRecruit && !hasPriorTeamYearForGrad
    // Auto-graduate BOTH exhausted-eligibility shapes — matching the CPU-team
    // path, which already graduates Sr and RS Sr alike. Previously only
    // RS Sr auto-graduated here, so a plain Sr not marked in Players Leaving
    // was carried into the new season and CLASS_PROGRESSION advanced them to
    // 'RS Sr' — the "my graduated seniors show as redshirts and I can't get
    // them off my roster" bug. A genuine 5th-year return (redshirt senior
    // resolved via the Fringe Case Class flow, which stamps an explicit
    // class for the NEW season) still plays: that stamp skips this gate.
    const resolvedNextClass = player.classByYear?.[currentSeasonYear]
      ?? player.classByYear?.[String(currentSeasonYear)]
    const eligibilityExhausted = previousSeasonClass === 'RS Sr'
      || (previousSeasonClass === 'Sr' && resolvedNextClass == null)
    if (eligibilityExhausted && !isGenuineRecruit) {
      const existingForYear = player.movementByYear?.[previousSeasonYear]
        || player.movementByYear?.[String(previousSeasonYear)]
      const alreadyGraduated = existingForYear?.type === 'departure'
        && existingForYear?.departure === 'graduated'
      if (alreadyGraduated) return player
      return {
        ...player,
        movementByYear: {
          ...(player.movementByYear || {}),
          [previousSeasonYear]: { type: 'departure', departure: 'graduated' }
        }
      }
    }

    // Convert recruits to active players (recruits have recruitYear from the previous season's recruiting cycle)
    // Use Number() to handle string/number type mismatch
    if (player.isRecruit && Number(player.recruitYear) === previousSeasonYear) {
      let newYear

      // Check if this is a portal transfer with a manually assigned class (team-aware with fallback)
      if (player.isPortal) {
        const portalClassSelectionsObj = getPortalTransferClass(dynasty, teamAbbr, previousSeasonYear)
        const portalClassSelections = Array.isArray(portalClassSelectionsObj) ? portalClassSelectionsObj : []
        const classSelection = portalClassSelections.find(s =>
          s.playerName?.toLowerCase().trim() === player.name?.toLowerCase().trim()
        )
        if (classSelection?.selectedClass) {
          // Use the manually assigned class
          newYear = classSelection.selectedClass
        } else {
          // Portal transfer without manual selection: year is already set correctly
          // by classToYear mapping (Jr stays Jr, Sr stays Sr, etc.)
          newYear = player.year
        }
      } else {
        // HS/JUCO recruits: year is already set correctly by classToYear mapping
        // When recruited: HS recruits have year='Fr', JUCO Fr have year='So', etc.
        // No progression needed - just use the existing value
        newYear = player.year
      }

      return {
        ...player,
        isRecruit: false,
        year: newYear,
        // Track class for this season
        classByYear: {
          ...(player.classByYear || {}),
          [currentSeasonYear]: newYear
        },
        // CRITICAL: Set teamsByYear for the new season so roster filtering works
        // ALWAYS use tid (number) - NEVER abbreviation
        teamsByYear: {
          ...(player.teamsByYear || {}),
          [currentSeasonYear]: teamTid
        }
      }
    }

    // Skip recruits from other years. Treat isRecruit:true as stale (and
    // fall through to the normal carry-over block) when the player already
    // has prior-year teamsByYear entries — those aren't actually new
    // recruits, just imported players whose flag never got cleared. See
    // matching guard in the wk5→6 progression loop above.
    const hasPriorTeamYear = Object.keys(player.teamsByYear || {}).some(k => {
      const y = Number(k)
      return Number.isFinite(y) && y <= previousSeasonYear
    })
    if (player.isRecruit && !hasPriorTeamYear) return player

    // PRIMARY departure guard: honor movement-record departures before
    // carrying anyone forward. Departures recorded ONLY in movement
    // records — a Draft Results round for a player never pre-flagged
    // "Pro Draft" on the leaving sheet, a transfer/graduation marked in
    // the player editor, a prior-year departure — never make it into
    // leavingPids above. The Signing Day carryover already withholds
    // these players via its movementByYear check; without the SAME rule
    // here, this fall-through carry re-added them to the new season
    // ("players who would have left ended up just coming back").
    if (hasUnresolvedDeparture(player, teamTid, previousSeasonYear, dynasty,
          { excludeTeamsByYearYear: currentSeasonYear })) {
      return withDraftInfo(player, draftByPid[player.pid])
    }

    // Class progression already happened at Signing Day (offseason week 6)
    // Here we just need to add teamsByYear and classByYear tracking for the new season

    // CRITICAL: Add current season year to teamsByYear for players continuing on the team
    // This creates the immutable roster history record
    // ALWAYS use tid (number) - NEVER abbreviation
    const updatedTeamsByYear = {
      ...(player.teamsByYear || {}),
      [currentSeasonYear]: teamTid
    }

    // Track class for this season (use existing player.year which was already updated at Signing Day)
    const updatedClassByYear = {
      ...(player.classByYear || {}),
      [currentSeasonYear]: player.year
    }

    return {
      ...player,
      teamsByYear: updatedTeamsByYear,
      classByYear: updatedClassByYear,
      ...(player.devTrait ? {
        devTraitByYear: {
          ...(player.devTraitByYear || {}),
          [currentSeasonYear]: player.devTrait
        }
      } : {}),
      ...(player.overall ? {
        overallByYear: {
          ...(player.overallByYear || {}),
          [currentSeasonYear]: player.overall
        }
      } : {})
    }
  })
  return { players: updatedPlayers }
}
