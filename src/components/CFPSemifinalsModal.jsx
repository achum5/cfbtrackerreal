import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty, getGamesByType, GAME_TYPES } from '../context/DynastyContext'
import { TEAMS, getGameTeamInfo, getTeamNameLabel, getTeamNameOptions, getTeamNameAliases } from '../data/teamRegistry'
import { getTidFromTeamText } from '../data/teams'
import { useToast } from './ui/Toast'
import { DEFAULT_BOWL_CONFIG } from '../data/cfpConstants'
import SheetModalHeader from './ui/SheetModalHeader'
import LocalDataEntry from './ui/LocalDataEntry'
import { buildAIPrompt } from '../utils/aiPrompt'
import { splitTsv } from '../utils/tsvParse'

// CFP Semifinals results — the same Copy prompt → Open your AI → Paste grid
// flow every other results modal uses (see CFPQuarterfinalsModal). The two
// matchups are derived from the quarterfinal winners and pre-filled into a
// fixed two-row grid (one row per semifinal bowl), so the user only fills in
// the scores — by pasting the AI's lines or typing straight into the grid.

// Semifinal structure - USE SLOT IDs for QF lookup (bowl names are configurable!)
// SF1 (cfpsf1): cfpqf1 winner vs cfpqf2 winner (1/4 bracket side)
// SF2 (cfpsf2): cfpqf3 winner vs cfpqf4 winner (2/3 bracket side)
// Bowl names come from user's config (sf1 and sf2 keys), not hardcoded
const SEMIFINAL_STRUCTURE = [
  {
    id: 'sf1',
    slotId: 'cfpsf1',
    configKey: 'sf1',
    defaultBowlName: 'Peach Bowl',
    qfSlot1: 'cfpqf1', // #1 seed's QF
    qfSlot2: 'cfpqf2'  // #4 seed's QF
  },
  {
    id: 'sf2',
    slotId: 'cfpsf2',
    configKey: 'sf2',
    defaultBowlName: 'Fiesta Bowl',
    qfSlot1: 'cfpqf3', // #3 seed's QF
    qfSlot2: 'cfpqf4'  // #2 seed's QF
  }
]

const SF_COLUMNS = ['Team 1', 'Team 2', 'Team 1 Score', 'Team 2 Score', 'Winner']

export default function CFPSemifinalsModal({ isOpen, onClose, onSave, currentYear, teamColors, userTeamAbbr }) {
  const { currentDynasty } = useDynasty()
  const { toast } = useToast()
  const [games, setGames] = useState([])
  const [saving, setSaving] = useState(false)
  // teamColors is accepted for API parity with the other results modals; the
  // shared entry shell is neutral, like the quarterfinals modal.
  void teamColors

  // Get seed by tid
  const getSeedByTid = (tid) => {
    const cfpSeeds = currentDynasty?.cfpSeedsByYear?.[currentYear] || []
    const seedEntry = cfpSeeds.find(s => s.tid === tid)
    return seedEntry?.seed || null
  }

  // Initialize games with auto-filled teams from quarterfinal results
  useEffect(() => {
    if (isOpen) {
      // Read from games[] array (unified source of truth)
      const qfResults = getGamesByType(currentDynasty, GAME_TYPES.CFP_QUARTERFINAL, currentYear)
      const existingSemis = getGamesByType(currentDynasty, GAME_TYPES.CFP_SEMIFINAL, currentYear)

      // ALSO look for any QF games from all games that have scores (might not be in shells)
      const allGames = currentDynasty?.games || []
      const allQFGamesWithScores = allGames.filter(g =>
        g && Number(g.year) === Number(currentYear) &&
        (g.isCFPQuarterfinal || g.gameType === 'cfp_quarterfinal' || (g.week === 'Bowl 2' && g.cfpSlot?.startsWith('cfpqf'))) &&
        g.team1Score !== undefined && g.team1Score !== null && g.team1Score !== ''
      )
      console.log('[CFPSemifinalsModal] All QF games with scores:', allQFGamesWithScores.map(g => ({
        id: g.id, cfpSlot: g.cfpSlot, team1Tid: g.team1Tid, team2Tid: g.team2Tid, team1Score: g.team1Score, team2Score: g.team2Score
      })))

      // Merge: prefer games with scores
      const qfResultsEnhanced = [...qfResults]
      allQFGamesWithScores.forEach(g => {
        if (!qfResultsEnhanced.find(r => r.id === g.id)) {
          qfResultsEnhanced.push(g)
        }
      })

      // Get bowl configuration for correct bowl names
      const bowlConfig = currentDynasty?.cfpBowlConfigByYear?.[currentYear] || {}

      // Fallback to cfpResultsByYear for backwards compatibility with old data
      const legacyQFResults = currentDynasty?.cfpResultsByYear?.[currentYear]?.quarterfinals || []
      const legacySemis = currentDynasty?.cfpResultsByYear?.[currentYear]?.semifinals || []

      // Find user's CFP Semifinal game from games[] (unified format has team1Score)
      // Get user tid for tid-based lookup
      const userTid = currentDynasty?.currentTid
      const userSFGame = existingSemis.find(g =>
        // Prefer tid-based match for teambuilder support
        (userTid && (g.userTid === userTid || g.team1Tid === userTid || g.team2Tid === userTid)) ||
        // Fallback to abbr for legacy data
        g.userTeam === userTeamAbbr
      ) ||
        currentDynasty?.games?.find(g => {
          if (Number(g.year) !== Number(currentYear)) return false
          if (g.teamScore === undefined || g.teamScore === null || g.teamScore === '') return false
          // Check if it's a CFP semifinal
          if (g.isCFPSemifinal) return true
          return false
        })

      // Helper to get winner from a game (handles both legacy and unified formats)
      const teams = currentDynasty?.teams || TEAMS
      const getGameWinner = (game) => {
        if (!game) return ''
        // Prefer the tid-derived NAME (tid-rooted); fall back to any stored string.
        if (game.winnerTid) {
          return getTeamNameLabel(teams, game.winnerTid) || getGameTeamInfo(teams, game.winnerTid)?.abbr || ''
        }
        if (game.winner) return game.winner
        // Fallback: compute from scores - MUST have actual score values (not null/undefined/'')
        const score1 = game.team1Score
        const score2 = game.team2Score
        const hasValidScores = score1 !== undefined && score1 !== null && score1 !== '' &&
                               score2 !== undefined && score2 !== null && score2 !== ''
        if (hasValidScores) {
          const t1 = (game.team1Tid ? getTeamNameLabel(teams, game.team1Tid) : null) || (game.team1Tid ? getGameTeamInfo(teams, game.team1Tid)?.abbr : null) || game.team1 || ''
          const t2 = (game.team2Tid ? getTeamNameLabel(teams, game.team2Tid) : null) || (game.team2Tid ? getGameTeamInfo(teams, game.team2Tid)?.abbr : null) || game.team2 || ''
          const winner = Number(score1) > Number(score2) ? t1 : t2
          console.log(`[getGameWinner] ${game.id}: t1Tid=${game.team1Tid}→${t1}, t2Tid=${game.team2Tid}→${t2}, scores=${score1}-${score2}, winner=${winner}`)
          return winner
        }
        // No valid scores - return empty (TBD)
        console.log(`[getGameWinner] ${game.id}: No valid scores (team1Score=${score1}, team2Score=${score2}), returning empty`)
        return ''
      }

      // Helper to get team abbreviation from a game
      const getTeamAbbr = (game, isTeam1) => {
        if (!game) return ''
        const tidField = isTeam1 ? 'team1Tid' : 'team2Tid'
        const legacyField = isTeam1 ? 'team1' : 'team2'
        if (game[tidField]) {
          const teamInfo = getGameTeamInfo(teams, game[tidField])
          return teamInfo?.abbr || game[legacyField] || ''
        }
        return game[legacyField] || ''
      }

      // Map QF slots to bye seeds for reliable lookup
      const qfSlotToByeSeed = { cfpqf1: 1, cfpqf2: 4, cfpqf3: 3, cfpqf4: 2 }
      const cfpSeeds = currentDynasty?.cfpSeedsByYear?.[currentYear] || []

      // BULLETPROOF: Find QF game by slot ID - cfpSlot or game ID is the ONLY reliable identifier
      // Bowl names are NOT used for lookups - they're only for display
      const findQFGameBySlot = (slotId) => {
        const byeSeed = qfSlotToByeSeed[slotId]

        // PRIMARY: Look for a game with this cfpSlot that HAS scores
        const bySlotWithScores = qfResultsEnhanced.find(g => g && g.cfpSlot === slotId &&
          g.team1Score !== undefined && g.team1Score !== null && g.team1Score !== '')
        if (bySlotWithScores) {
          console.log(`[findQFGameBySlot] ${slotId}: Found by cfpSlot WITH scores`, {
            gameId: bySlotWithScores.id, team1Score: bySlotWithScores.team1Score, team2Score: bySlotWithScores.team2Score
          })
          return bySlotWithScores
        }

        // SECONDARY: Look for game by expected ID pattern (e.g., cfpqf1-2029)
        const expectedGameId = `${slotId}-${currentYear}`
        const byIdWithScores = qfResultsEnhanced.find(g => g && g.id === expectedGameId &&
          g.team1Score !== undefined && g.team1Score !== null && g.team1Score !== '')
        if (byIdWithScores) {
          console.log(`[findQFGameBySlot] ${slotId}: Found by game ID ${expectedGameId} WITH scores`)
          return byIdWithScores
        }

        // TERTIARY: Find by bye seed team - ONLY check team1Tid (bye seed should be in team1 position)
        if (byeSeed) {
          const byeSeedEntry = cfpSeeds.find(s => s.seed === byeSeed)
          if (byeSeedEntry?.tid) {
            // Look for QF game where bye seed team is in team1 position (correct structure)
            const withScores = qfResultsEnhanced.find(g => {
              if (!g || g.team1Score === undefined || g.team1Score === null || g.team1Score === '') return false
              // Bye seed should be team1Tid in QF games
              return g.team1Tid === byeSeedEntry.tid
            })
            if (withScores) {
              console.log(`[findQFGameBySlot] ${slotId}: Found by bye seed ${byeSeed} (tid=${byeSeedEntry.tid}) WITH scores`, {
                gameId: withScores.id
              })
              return withScores
            }
          }
        }

        // FALLBACK: Look for shell without scores (for display purposes)
        const bySlot = qfResultsEnhanced.find(g => g && g.cfpSlot === slotId)
        if (bySlot) {
          console.log(`[findQFGameBySlot] ${slotId}: Found shell by cfpSlot (no scores)`, { gameId: bySlot.id })
          return bySlot
        }

        // Also check by game ID pattern for shells
        const byId = qfResultsEnhanced.find(g => g && g.id === expectedGameId)
        if (byId) {
          console.log(`[findQFGameBySlot] ${slotId}: Found shell by game ID (no scores)`, { gameId: byId.id })
          return byId
        }

        console.log(`[findQFGameBySlot] ${slotId}: No game found!`)
        return null
      }

      // Log QF results in readable format
      console.log('[CFPSemifinalsModal] QF Results (enhanced):')
      qfResultsEnhanced.forEach((g, i) => {
        console.log(`  QF[${i}]: id=${g?.id}, cfpSlot=${g?.cfpSlot}, bowl=${g?.bowlName}, t1=${g?.team1Tid}(${g?.team1}), t2=${g?.team2Tid}(${g?.team2}), scores=${g?.team1Score}-${g?.team2Score}, winner=${g?.winner}`)
      })
      console.log('[CFPSemifinalsModal] CFP Seeds (bye seeds 1-4):')
      cfpSeeds.filter(s => s.seed <= 4).forEach(s => {
        console.log(`  Seed ${s.seed}: ${s.team} (tid=${s.tid})`)
      })
      console.log('[CFPSemifinalsModal] Existing Semis:', existingSemis.map(g => ({
        id: g?.id, cfpSlot: g?.cfpSlot, bowlName: g?.bowlName,
        team1Tid: g?.team1Tid, team2Tid: g?.team2Tid
      })))

      const initialGames = SEMIFINAL_STRUCTURE.map((sf, index) => {
        // Get bowl name from user's config, fallback to default
        const bowlName = bowlConfig[sf.configKey] || sf.defaultBowlName

        // CRITICAL: Find QF games by SLOT ID using bye seed matching
        // This ensures we get the correct game regardless of bowl configuration
        const qf1 = findQFGameBySlot(sf.qfSlot1)
        const qf2 = findQFGameBySlot(sf.qfSlot2)

        console.log(`[CFPSemifinalsModal] ${sf.id} (${bowlName}):`, {
          qfSlot1: sf.qfSlot1, qfSlot2: sf.qfSlot2,
          qf1: qf1 ? { id: qf1.id, cfpSlot: qf1.cfpSlot, team1Tid: qf1.team1Tid, team2Tid: qf1.team2Tid, winner: qf1.winner } : null,
          qf2: qf2 ? { id: qf2.id, cfpSlot: qf2.cfpSlot, team1Tid: qf2.team1Tid, team2Tid: qf2.team2Tid, winner: qf2.winner } : null
        })

        // Check if we have existing semifinal data - try by slot first, then bowl name
        const existing = existingSemis.find(g => g && g.cfpSlot === sf.slotId) ||
                         existingSemis.find(g => g && g.bowlName === bowlName) ||
                         legacySemis.find(g => g && g.bowlName === bowlName)

        // Get teams from QF winners, with fallbacks to SF shell data
        const qf1Winner = getGameWinner(qf1)
        const qf2Winner = getGameWinner(qf2)

        // Get winner TIDs from QF games (for rendering)
        const getQFWinnerTid = (qfGame) => {
          if (!qfGame) return null
          if (qfGame.winnerTid) return qfGame.winnerTid
          // Compute from scores
          if (qfGame.team1Score !== undefined && qfGame.team2Score !== undefined) {
            return Number(qfGame.team1Score) > Number(qfGame.team2Score) ? qfGame.team1Tid : qfGame.team2Tid
          }
          return null
        }

        let team1 = qf1Winner
        let team2 = qf2Winner
        let team1Tid = getQFWinnerTid(qf1)
        let team2Tid = getQFWinnerTid(qf2)

        // Fallback 1: If no QF winners, check existing SF shell's team tids (from propagation)
        if (!team1Tid && existing?.team1Tid) {
          team1Tid = existing.team1Tid
          const t1Info = getGameTeamInfo(teams, team1Tid)
          team1 = t1Info?.abbr || ''
          console.log(`[CFPSemifinalsModal] ${sf.id} team1 from shell tid:`, team1Tid, '→', team1)
        }
        if (!team2Tid && existing?.team2Tid) {
          team2Tid = existing.team2Tid
          const t2Info = getGameTeamInfo(teams, team2Tid)
          team2 = t2Info?.abbr || ''
          console.log(`[CFPSemifinalsModal] ${sf.id} team2 from shell tid:`, team2Tid, '→', team2)
        }

        // Fallback 2: Check legacy abbr fields on existing shell
        if (!team1 && existing) team1 = getTeamAbbr(existing, true)
        if (!team2 && existing) team2 = getTeamAbbr(existing, false)

        console.log(`[CFPSemifinalsModal] ${sf.id} teams:`, { qf1Winner, qf2Winner, team1, team2, team1Tid, team2Tid })

        // Check if user's team is in this game. Tid-first so a renamed
        // teambuilder team is still classified as the user's game even
        // when the abbr displayed in this slot has drifted.
        const userTidNum = userTid != null ? Number(userTid) : null
        const userInThisGame = (
          (userTidNum != null && (Number(team1Tid) === userTidNum || Number(team2Tid) === userTidNum)) ||
          (userTeamAbbr && (team1 === userTeamAbbr || team2 === userTeamAbbr))
        )

        // If user is in this game
        if (userInThisGame) {
          // Tid wins, then abbr fallback. team1Tid/team2Tid are the
          // canonical identifiers for this slot.
          const userIsTeam1 = (userTidNum != null && Number(team1Tid) === userTidNum)
            ? true
            : (userTidNum != null && Number(team2Tid) === userTidNum)
              ? false
              : (team1 === userTeamAbbr)

          // PRIORITY: Check user's game from games[] array (source of truth)
          // Handle both unified format (team1Score) and legacy format (teamScore)
          if (userSFGame) {
            let userScore, oppScore
            if (userSFGame.team1Score !== undefined && userSFGame.team1Score !== '') {
              // Unified format. Prefer tid match for which side is the user;
              // abbr match only when tids aren't both available.
              const sfT1Tid = userSFGame.team1Tid != null ? Number(userSFGame.team1Tid) : null
              const sfT2Tid = userSFGame.team2Tid != null ? Number(userSFGame.team2Tid) : null
              const userIsSFTeam1 = (userTidNum != null && sfT1Tid === userTidNum)
                ? true
                : (userTidNum != null && sfT2Tid === userTidNum)
                  ? false
                  : (userSFGame.userTeam === userSFGame.team1)
              userScore = userIsSFTeam1 ? userSFGame.team1Score : userSFGame.team2Score
              oppScore = userIsSFTeam1 ? userSFGame.team2Score : userSFGame.team1Score
            } else if (userSFGame.teamScore !== undefined && userSFGame.teamScore !== '') {
              // Legacy format - scores are in teamScore/opponentScore
              userScore = userSFGame.teamScore
              oppScore = userSFGame.opponentScore
            }

            if (userScore !== undefined) {
              return {
                id: sf.id,
                bowlName,
                slotId: sf.slotId,
                team1,
                team2,
                team1Tid,
                team2Tid,
                team1Score: userIsTeam1 ? userScore : oppScore,
                team2Score: userIsTeam1 ? oppScore : userScore,
                userGame: true // Flag to indicate this is user's game - NOT EDITABLE
              }
            }
          }

          // Fallback: Check existing semifinal data from games[] or cfpResultsByYear
          const hasExistingScores = existing?.team1Score !== undefined && existing?.team1Score !== '' &&
                                    existing?.team2Score !== undefined && existing?.team2Score !== ''
          if (hasExistingScores) {
            return {
              id: sf.id,
              bowlName,
              slotId: sf.slotId,
              team1,
              team2,
              team1Tid,
              team2Tid,
              team1Score: existing.team1Score,
              team2Score: existing.team2Score,
              userGame: true
            }
          }

          // User's game exists but not yet entered
          return {
            id: sf.id,
            bowlName,
            slotId: sf.slotId,
            team1,
            team2,
            team1Tid,
            team2Tid,
            team1Score: '',
            team2Score: '',
            userGame: true,
            userGamePending: true
          }
        }

        // CPU vs CPU game - use existing data or empty
        return {
          id: sf.id,
          bowlName,
          slotId: sf.slotId,
          team1,
          team2,
          team1Tid,  // Include tid for rendering
          team2Tid,  // Include tid for rendering
          team1Score: existing?.team1Score ?? '',
          team2Score: existing?.team2Score ?? ''
        }
      })

      setGames(initialGames)
    }
  }, [isOpen, currentYear, currentDynasty, userTeamAbbr])

  const teams = currentDynasty?.teams || TEAMS
  // Team-name options for the grid's team cells — same label builder the
  // pre-fill uses, so a pre-filled cell matches an option.
  const teamNameOptions = useMemo(() => getTeamNameOptions(currentDynasty?.teams, { includeFCS: false }), [currentDynasty?.teams])
  const comboboxColumns = useMemo(() => ({ 'Team 1': teamNameOptions, 'Team 2': teamNameOptions, 'Winner': teamNameOptions }), [teamNameOptions])

  const labelFor = (tid, abbr) => (tid != null ? (getTeamNameLabel(teams, tid) || getGameTeamInfo(teams, tid)?.abbr) : null) || abbr || ''
  const rowLabels = useMemo(() => games.map(g => g.bowlName), [games])

  // Pre-fill: one index-led row per semifinal (the grid is labeled by bowl,
  // so LocalDataEntry keys rows by index, not line position).
  const initialText = useMemo(() => games.map((g, i) => {
    const t1 = labelFor(g.team1Tid, g.team1)
    const t2 = labelFor(g.team2Tid, g.team2)
    const s1 = g.team1Score === '' || g.team1Score == null ? '' : String(g.team1Score)
    const s2 = g.team2Score === '' || g.team2Score == null ? '' : String(g.team2Score)
    const winner = s1 !== '' && s2 !== '' ? (Number(s1) > Number(s2) ? t1 : t2) : ''
    return [i, t1, t2, s1, s2, winner].join('\t')
  }).join('\n'), [games, teams])

  const localAiPrompt = useMemo(() => {
    const matchups = games.map((g, i) => {
      const t1 = labelFor(g.team1Tid, g.team1) || 'TBD'
      const t2 = labelFor(g.team2Tid, g.team2) || 'TBD'
      return `  Line ${i + 1} — ${g.bowlName}: ${t1} vs ${t2}${g.userGame ? '  (your game — already entered through the game editor; leave its scores as shown)' : ''}`
    }).join('\n')
    return buildAIPrompt({
      title: `${currentYear} CFP Semifinals Results`,
      structure: `Output EXACTLY ${games.length} lines, ONE per semifinal, in this FIXED order (line N is that semifinal — there is NO bowl-name column and NO other identifier):
${matchups}

═══════════════════════════════════════════════════════════
CRITICAL RULES — read before anything else
═══════════════════════════════════════════════════════════
1. Each line has EXACTLY 5 tab-separated fields: Team1<TAB>Team2<TAB>Team1Score<TAB>Team2Score<TAB>Winner.
2. NO header row. NO blank lines. NO bowl name. NO commentary, totals, or labels INSIDE the data.
3. ROW ORDER IS FIXED — line 1 is the first semifinal listed above, line 2 the second. Never reorder, never add or drop a line.
4. Team1 and Team2 are the teams listed above for that line, as team names from the list at the bottom — NEVER an abbreviation, nickname, mascot, or city. Keep them in the order shown.
5. Team1Score / Team2Score are integers. No commas, no decimals, no "pts".
6. Winner = whichever of Team1 / Team2 has the HIGHER score. If the game hasn't been played or the score isn't visible, leave Team1Score, Team2Score and Winner BLANK (still keep all 5 fields / 4 tabs) — never guess.

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════════════════════════════════
=== CFP SEMIFINALS ===
<Team1>\\t<Team2>\\t<Team1Score>\\t<Team2Score>\\t<Winner>
<Team1>\\t<Team2>\\t<Team1Score>\\t<Team2Score>\\t<Winner>

(Each \\t above represents a LITERAL TAB character — use actual tab characters, not the text "\\t".)

═══════════════════════════════════════════════════════════
FINAL CHECK before you send
═══════════════════════════════════════════════════════════
[ ] Exactly ${games.length} lines, in the order listed above
[ ] Every line has exactly 5 tab-separated fields (four tabs)
[ ] Team names are from the list — no abbreviations
[ ] Scores are integers; Winner matches the higher score (or all three blank if unplayed)`,
      includeTeamMap: true,
      dynastyTeams: currentDynasty?.teams,
    })
  }, [games, currentYear, currentDynasty?.teams, teams])

  // Grid rows arrive index-led ("<i>\tTeam1\tTeam2\tS1\tS2\tWinner"). A row
  // with both scores updates that semifinal; a row without scores leaves it
  // unchanged (same "omit = untouched" rule as the quarterfinals). The user's
  // own game keeps the values it was opened with — it is entered through the
  // game editor, exactly as before this modal used the shared flow.
  const handleLocalImport = async (text) => {
    const rows = splitTsv(text)
    const byIndex = new Map()
    for (const cells of rows) {
      const i = Number(cells[0])
      if (Number.isInteger(i) && i >= 0 && i < games.length) byIndex.set(i, cells.slice(1))
    }

    const userPending = games.find(g => g.userGame && g.userGamePending)
    if (userPending) {
      toast.error('Please play and enter your semifinal game first before saving results.')
      return
    }

    const resolveTeam = (textValue, fallbackTid, fallbackAbbr) => {
      const t = String(textValue || '').trim()
      if (!t) return { tid: fallbackTid ?? null, abbr: fallbackAbbr || '' }
      const tid = getTidFromTeamText(t, teams)
      if (tid != null) return { tid: Number(tid), abbr: getGameTeamInfo(teams, tid)?.abbr || t }
      return { tid: fallbackTid ?? null, abbr: fallbackAbbr || t }
    }

    const processed = []
    games.forEach((game, i) => {
      if (game.userGame) {
        const s1 = parseInt(game.team1Score, 10); const s2 = parseInt(game.team2Score, 10)
        if (!Number.isFinite(s1) || !Number.isFinite(s2)) return
        processed.push({ ...game, team1Score: s1, team2Score: s2, winner: s1 > s2 ? game.team1 : game.team2, seed1: getSeedByTid(game.team1Tid), seed2: getSeedByTid(game.team2Tid) })
        return
      }
      const cells = byIndex.get(i)
      if (!cells) return
      const [t1Text, t2Text, s1Text, s2Text] = cells
      const s1 = parseInt(String(s1Text ?? '').trim(), 10)
      const s2 = parseInt(String(s2Text ?? '').trim(), 10)
      if (!Number.isFinite(s1) || !Number.isFinite(s2)) return
      const t1 = resolveTeam(t1Text, game.team1Tid, game.team1)
      const t2 = resolveTeam(t2Text, game.team2Tid, game.team2)
      if (!t1.abbr || !t2.abbr) return
      processed.push({
        ...game,
        team1: t1.abbr, team2: t2.abbr, team1Tid: t1.tid, team2Tid: t2.tid,
        team1Score: s1, team2Score: s2,
        winner: s1 > s2 ? t1.abbr : t2.abbr,
        seed1: getSeedByTid(t1.tid), seed2: getSeedByTid(t2.tid),
      })
    })

    if (processed.length === 0) {
      toast.error('No semifinal scores to import — fill in both scores for at least one game.')
      return
    }

    setSaving(true)
    try {
      await onSave(processed)
      onClose()
    } catch (error) {
      console.error('Error saving CFP Semifinals results:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] py-8 px-4 sm:p-4 modal-backdrop-in"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="card-elevated w-full max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden sm:max-w-[680px] sm:h-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SheetModalHeader eyebrow="College Football Playoff" title={`${currentYear} CFP Semifinals`} onClose={onClose} />

        <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
          <LocalDataEntry
            aiPrompt={localAiPrompt}
            onImport={handleLocalImport}
            onCancel={onClose}
            importLabel="Import CFP Semifinals"
            busy={saving}
            initialText={initialText}
            rowLabels={rowLabels}
            rowLabelHeader="Semifinal"
            columns={SF_COLUMNS}
            comboboxColumns={comboboxColumns}
            comboboxAliases={getTeamNameAliases(currentDynasty?.teams)}
            instructions="Screenshot the CFP semifinal results. Both matchups are already filled in below from the quarterfinal winners — the AI (or you, straight in the grid) only needs the scores."
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
