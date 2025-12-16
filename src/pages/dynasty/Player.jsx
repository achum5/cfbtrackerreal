import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import PlayerEditModal from '../../components/PlayerEditModal'

export default function Player() {
  const { id: dynastyId, pid } = useParams()
  const { dynasties, currentDynasty, updatePlayer } = useDynasty()
  const [showEditModal, setShowEditModal] = useState(false)

  // Scroll to top when player page loads or changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pid])

  // Find the dynasty and player
  const dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)
  const player = dynasty?.players?.find(p => p.pid === parseInt(pid))

  if (!dynasty) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Dynasty not found</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Player not found</p>
      </div>
    )
  }

  const teamColors = useTeamColors(dynasty.teamName)
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  // Calculate Player of the Week honors from games
  const calculatePOWHonors = () => {
    const games = dynasty.games || []
    let confPOW = 0
    let nationalPOW = 0

    games.forEach(game => {
      if (game.conferencePOW === player.name) {
        confPOW++
      }
      if (game.nationalPOW === player.name) {
        nationalPOW++
      }
    })

    return { confPOW, nationalPOW }
  }

  const powHonors = calculatePOWHonors()

  const handlePlayerSave = async (updatedPlayer) => {
    await updatePlayer(dynastyId, updatedPlayer)
    setShowEditModal(false)
  }

  // Player data with placeholders
  const playerData = {
    // Biographical
    name: player.name,
    position: player.position,
    school: dynasty.teamName,

    // Recruiting
    yearStarted: 'N/A',
    stars: 0,
    positionRank: 0,
    stateRank: 0,
    nationalRank: 0,

    // Development
    devTrait: player.devTrait || 'Normal',
    gemBust: 'N/A',
    overallProgression: 0,
    overallRatingChange: 0,
    overallRating: player.overall,

    // Game Logs
    snapsPlayed: 0,
    gamesPlayed: 0,
    gamesStarted: 0,

    // Departure
    yearDeparted: 'N/A',
    yearsInSchool: 0,
    draftRound: 'N/A',

    // Accolades
    confPOW: powHonors.confPOW,
    nationalPOW: powHonors.nationalPOW,
    allConf1st: 0,
    allConf2nd: 0,
    allConfFr: 0,
    allAm1st: 0,
    allAm2nd: 0,
    allAmFr: 0,

    // Passing
    passing: {
      completions: 0, attempts: 0, completionPct: 0,
      yards: 0, touchdowns: 0, tdPct: 0,
      interceptions: 0, intPct: 0, tdIntRatio: 0,
      yardsPerAttempt: 0, netYardsPerAttempt: 0, adjNetYardsPerAttempt: 0,
      yardsPerGame: 0, passerRating: 0,
      passingLong: 0, sacksTaken: 0, sackPct: 0
    },

    // Rushing
    rushing: {
      carries: 0, yards: 0, yardsPerCarry: 0,
      touchdowns: 0, yardsPerGame: 0,
      runs20Plus: 0, brokenTackles: 0,
      yardsAfterContact: 0, rushingLong: 0,
      fumbles: 0, fumblePct: 0
    },

    // Receiving
    receiving: {
      receptions: 0, yards: 0, yardsPerCatch: 0,
      touchdowns: 0, yardsPerGame: 0,
      receivingLong: 0, runAfterCatch: 0,
      racAverage: 0, drops: 0
    },

    // Blocking
    blocking: {
      sacksAllowed: 0
    },

    // Defensive
    defensive: {
      soloTackles: 0, assistedTackles: 0, totalTackles: 0,
      tacklesForLoss: 0, sacks: 0,
      interceptions: 0, intReturnYards: 0,
      avgIntReturn: 0, intLong: 0,
      defensiveTDs: 0, deflections: 0,
      catchesAllowed: 0, forcedFumbles: 0,
      fumbleRecoveries: 0, fumbleReturnYards: 0,
      blocks: 0, safeties: 0
    },

    // Kicking
    kicking: {
      fgMade: 0, fgAttempted: 0, fgPct: 0, fgLong: 0,
      xpMade: 0, xpAttempted: 0, xpPct: 0,
      fg0_29Made: 0, fg0_29Attempted: 0,
      fg30_39Made: 0, fg30_39Attempted: 0,
      fg40_49Made: 0, fg40_49Attempted: 0,
      fg50PlusMade: 0, fg50PlusAttempted: 0,
      kickoffs: 0, touchbacks: 0, touchbackPct: 0,
      fgBlocked: 0, xpBlocked: 0
    },

    // Punting
    punting: {
      punts: 0, puntingYards: 0, yardsPerPunt: 0,
      netPuntingYards: 0, netYardsPerPunt: 0,
      puntsInside20: 0, touchbacks: 0,
      puntLong: 0, puntsBlocked: 0
    },

    // Kick Return
    kickReturn: {
      returns: 0, returnYardage: 0, returnAverage: 0,
      touchdowns: 0, returnLong: 0
    },

    // Punt Return
    puntReturn: {
      returns: 0, returnYardage: 0, returnAverage: 0,
      touchdowns: 0, returnLong: 0
    },

    // Scrimmage
    scrimmage: {
      plays: 0, yards: 0, yardsPerPlay: 0,
      touchdowns: 0, yardsPerGame: 0
    },

    // Total
    total: {
      plays: 0, yardage: 0, yardsPerPlay: 0,
      touchdowns: 0, yardsPerGame: 0
    }
  }

  // Helper function to determine which stat sections to show based on position
  const getStatSections = (position) => {
    const pos = position.toUpperCase()

    // Quarterbacks
    if (pos === 'QB') {
      return {
        passing: true,
        rushing: true,
        receiving: false,
        blocking: false,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: true,
        total: true
      }
    }

    // Running Backs
    if (pos === 'HB' || pos === 'FB') {
      return {
        passing: false,
        rushing: true,
        receiving: true,
        blocking: true,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: true,
        puntReturn: true,
        scrimmage: true,
        total: true
      }
    }

    // Receivers
    if (pos === 'WR' || pos === 'TE') {
      return {
        passing: false,
        rushing: true,
        receiving: true,
        blocking: true,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: true,
        puntReturn: true,
        scrimmage: true,
        total: true
      }
    }

    // Offensive Line
    if (['LT', 'LG', 'C', 'RG', 'RT'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: true,
        defensive: false,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Defensive Line & Edge
    if (['DT', 'LEDG', 'REDG'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: true,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Linebackers
    if (['SAM', 'MIKE', 'WILL'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: true,
        kicking: false,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Defensive Backs
    if (['CB', 'FS', 'SS'].includes(pos)) {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: true,
        kicking: false,
        punting: false,
        kickReturn: true,
        puntReturn: true,
        scrimmage: false,
        total: false
      }
    }

    // Kicker
    if (pos === 'K') {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: false,
        kicking: true,
        punting: false,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Punter
    if (pos === 'P') {
      return {
        passing: false,
        rushing: false,
        receiving: false,
        blocking: false,
        defensive: false,
        kicking: false,
        punting: true,
        kickReturn: false,
        puntReturn: false,
        scrimmage: false,
        total: false
      }
    }

    // Default - show all
    return {
      passing: true,
      rushing: true,
      receiving: true,
      blocking: true,
      defensive: true,
      kicking: true,
      punting: true,
      kickReturn: true,
      puntReturn: true,
      scrimmage: true,
      total: true
    }
  }

  const statSections = getStatSections(playerData.position)

  // Helper component for stat display
  const StatBox = ({ label, value, small = false }) => (
    <div
      className={`p-3 rounded-lg border ${small ? '' : 'text-center'}`}
      style={{
        backgroundColor: teamColors.secondary,
        borderColor: primaryText + '60'
      }}
    >
      <div className={`text-xs mb-1 ${small ? '' : 'font-semibold'}`} style={{ color: secondaryText, opacity: 0.7 }}>
        {label}
      </div>
      <div className={`${small ? 'text-sm' : 'text-lg'} font-bold`} style={{ color: secondaryText }}>
        {value !== null && value !== undefined ? value : '-'}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Player Header */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ color: primaryText }}>
                {playerData.name}
              </h1>
              <div className="flex items-center gap-4 text-lg" style={{ color: primaryText, opacity: 0.9 }}>
                <span className="font-semibold">{playerData.position}</span>
                <span>•</span>
                <span>{player.year}</span>
                <span>•</span>
                <span>{playerData.school}</span>
              </div>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: primaryText }}
              title="Edit Player"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
          <div className="text-center">
            <div className="text-sm mb-1" style={{ color: primaryText, opacity: 0.7 }}>
              Overall Rating
            </div>
            <div
              className="text-6xl font-bold"
              style={{ color: teamColors.secondary }}
            >
              {playerData.overallRating}
            </div>
          </div>
        </div>
      </div>

      {/* Biographical & Recruiting */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
          Biographical & Recruiting Information
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatBox label="Year Started" value={playerData.yearStarted} />
          <StatBox label="Stars" value={playerData.stars > 0 ? `${playerData.stars}★` : 'N/A'} />
          <StatBox label="Position Rank" value={playerData.positionRank > 0 ? `#${playerData.positionRank}` : 'N/A'} />
          <StatBox label="State Rank" value={playerData.stateRank > 0 ? `#${playerData.stateRank}` : 'N/A'} />
          <StatBox label="National Rank" value={playerData.nationalRank > 0 ? `#${playerData.nationalRank}` : 'N/A'} />
        </div>
      </div>

      {/* Development & Game Logs */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
          Development & Game Logs
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <StatBox label="Dev Trait" value={playerData.devTrait} />
          <StatBox label="Gem / Bust" value={playerData.gemBust} />
          <StatBox label="Overall Progression" value={playerData.overallProgression > 0 ? `+${playerData.overallProgression}` : playerData.overallProgression || 0} />
          <StatBox label="Rating Change" value={playerData.overallRatingChange > 0 ? `+${playerData.overallRatingChange}` : playerData.overallRatingChange || 0} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBox label="Snaps Played" value={playerData.snapsPlayed} />
          <StatBox label="Games Played" value={playerData.gamesPlayed} />
          <StatBox label="Games Started" value={playerData.gamesStarted} />
        </div>
      </div>

      {/* Departure Information */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
          Departure Information
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBox label="Year Departed" value={playerData.yearDeparted} />
          <StatBox label="Years in School" value={playerData.yearsInSchool > 0 ? playerData.yearsInSchool : 'N/A'} />
          <StatBox label="Draft Round" value={playerData.draftRound} />
        </div>
      </div>

      {/* Accolades */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
          Accolades
        </h2>
        <div className="flex flex-wrap gap-2">
          {playerData.confPOW > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              Conference Player of the Week {playerData.confPOW}x
            </div>
          )}
          {playerData.nationalPOW > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              National Player of the Week {playerData.nationalPOW}x
            </div>
          )}
          {playerData.allConf1st > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-Conference 1st Team {playerData.allConf1st}x
            </div>
          )}
          {playerData.allConf2nd > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-Conference 2nd Team {playerData.allConf2nd}x
            </div>
          )}
          {playerData.allConfFr > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-Conference Freshman Team {playerData.allConfFr}x
            </div>
          )}
          {playerData.allAm1st > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-American 1st Team {playerData.allAm1st}x
            </div>
          )}
          {playerData.allAm2nd > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-American 2nd Team {playerData.allAm2nd}x
            </div>
          )}
          {playerData.allAmFr > 0 && (
            <div
              className="px-4 py-2 rounded-full font-semibold"
              style={{
                backgroundColor: teamColors.secondary,
                color: secondaryText
              }}
            >
              All-American Freshman Team {playerData.allAmFr}x
            </div>
          )}
          {playerData.confPOW === 0 && playerData.nationalPOW === 0 &&
           playerData.allConf1st === 0 && playerData.allConf2nd === 0 && playerData.allConfFr === 0 &&
           playerData.allAm1st === 0 && playerData.allAm2nd === 0 && playerData.allAmFr === 0 && (
            <div className="text-sm" style={{ color: primaryText, opacity: 0.6 }}>
              No accolades yet
            </div>
          )}
        </div>
      </div>

      {/* Passing Statistics */}
      {statSections.passing && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Passing Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatBox label="Completions" value={playerData.passing.completions} small />
          <StatBox label="Attempts" value={playerData.passing.attempts} small />
          <StatBox label="Completion %" value={playerData.passing.completionPct > 0 ? `${playerData.passing.completionPct}%` : '-'} small />
          <StatBox label="Yards" value={playerData.passing.yards} small />
          <StatBox label="Touchdowns" value={playerData.passing.touchdowns} small />
          <StatBox label="TD %" value={playerData.passing.tdPct > 0 ? `${playerData.passing.tdPct}%` : '-'} small />
          <StatBox label="Interceptions" value={playerData.passing.interceptions} small />
          <StatBox label="INT %" value={playerData.passing.intPct > 0 ? `${playerData.passing.intPct}%` : '-'} small />
          <StatBox label="TD/INT Ratio" value={playerData.passing.tdIntRatio > 0 ? playerData.passing.tdIntRatio.toFixed(2) : '-'} small />
          <StatBox label="Yards/Attempt" value={playerData.passing.yardsPerAttempt > 0 ? playerData.passing.yardsPerAttempt.toFixed(1) : '-'} small />
          <StatBox label="Net Yards/Attempt" value={playerData.passing.netYardsPerAttempt > 0 ? playerData.passing.netYardsPerAttempt.toFixed(1) : '-'} small />
          <StatBox label="Adj Net Yards/Attempt" value={playerData.passing.adjNetYardsPerAttempt > 0 ? playerData.passing.adjNetYardsPerAttempt.toFixed(1) : '-'} small />
          <StatBox label="Yards/Game" value={playerData.passing.yardsPerGame > 0 ? playerData.passing.yardsPerGame.toFixed(1) : '-'} small />
          <StatBox label="Passer Rating" value={playerData.passing.passerRating > 0 ? playerData.passing.passerRating.toFixed(1) : '-'} small />
          <StatBox label="Passing Long" value={playerData.passing.passingLong} small />
          <StatBox label="Sacks Taken" value={playerData.passing.sacksTaken} small />
          <StatBox label="Sack %" value={playerData.passing.sackPct > 0 ? `${playerData.passing.sackPct}%` : '-'} small />
        </div>
        </div>
      )}

      {/* Rushing Statistics */}
      {statSections.rushing && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Rushing Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatBox label="Carries" value={playerData.rushing.carries} small />
          <StatBox label="Yards" value={playerData.rushing.yards} small />
          <StatBox label="Yards/Carry" value={playerData.rushing.yardsPerCarry > 0 ? playerData.rushing.yardsPerCarry.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.rushing.touchdowns} small />
          <StatBox label="Yards/Game" value={playerData.rushing.yardsPerGame > 0 ? playerData.rushing.yardsPerGame.toFixed(1) : '-'} small />
          <StatBox label="20+ Yard Runs" value={playerData.rushing.runs20Plus} small />
          <StatBox label="Broken Tackles" value={playerData.rushing.brokenTackles} small />
          <StatBox label="Yards After Contact" value={playerData.rushing.yardsAfterContact} small />
          <StatBox label="Rushing Long" value={playerData.rushing.rushingLong} small />
          <StatBox label="Fumbles" value={playerData.rushing.fumbles} small />
          <StatBox label="Fumble %" value={playerData.rushing.fumblePct > 0 ? `${playerData.rushing.fumblePct}%` : '-'} small />
        </div>
        </div>
      )}

      {/* Receiving Statistics */}
      {statSections.receiving && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Receiving Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatBox label="Receptions" value={playerData.receiving.receptions} small />
          <StatBox label="Yards" value={playerData.receiving.yards} small />
          <StatBox label="Yards/Catch" value={playerData.receiving.yardsPerCatch > 0 ? playerData.receiving.yardsPerCatch.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.receiving.touchdowns} small />
          <StatBox label="Yards/Game" value={playerData.receiving.yardsPerGame > 0 ? playerData.receiving.yardsPerGame.toFixed(1) : '-'} small />
          <StatBox label="Receiving Long" value={playerData.receiving.receivingLong} small />
          <StatBox label="Run After Catch" value={playerData.receiving.runAfterCatch} small />
          <StatBox label="RAC Average" value={playerData.receiving.racAverage > 0 ? playerData.receiving.racAverage.toFixed(1) : '-'} small />
          <StatBox label="Drops" value={playerData.receiving.drops} small />
        </div>
        </div>
      )}

      {/* Blocking */}
      {statSections.blocking && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Blocking
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatBox label="Sacks Allowed" value={playerData.blocking.sacksAllowed} />
          </div>
        </div>
      )}

      {/* Defensive Statistics */}
      {statSections.defensive && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Defensive Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <StatBox label="Solo Tackles" value={playerData.defensive.soloTackles} small />
          <StatBox label="Assisted Tackles" value={playerData.defensive.assistedTackles} small />
          <StatBox label="Total Tackles" value={playerData.defensive.totalTackles} small />
          <StatBox label="Tackles for Loss" value={playerData.defensive.tacklesForLoss} small />
          <StatBox label="Sacks" value={playerData.defensive.sacks} small />
          <StatBox label="Interceptions" value={playerData.defensive.interceptions} small />
          <StatBox label="INT Return Yards" value={playerData.defensive.intReturnYards} small />
          <StatBox label="Avg INT Return" value={playerData.defensive.avgIntReturn > 0 ? playerData.defensive.avgIntReturn.toFixed(1) : '-'} small />
          <StatBox label="INT Long" value={playerData.defensive.intLong} small />
          <StatBox label="Defensive TDs" value={playerData.defensive.defensiveTDs} small />
          <StatBox label="Deflections" value={playerData.defensive.deflections} small />
          <StatBox label="Catches Allowed" value={playerData.defensive.catchesAllowed} small />
          <StatBox label="Forced Fumbles" value={playerData.defensive.forcedFumbles} small />
          <StatBox label="Fumble Recoveries" value={playerData.defensive.fumbleRecoveries} small />
          <StatBox label="Fumble Return Yards" value={playerData.defensive.fumbleReturnYards} small />
          <StatBox label="Blocks" value={playerData.defensive.blocks} small />
          <StatBox label="Safeties" value={playerData.defensive.safeties} small />
        </div>
        </div>
      )}

      {/* Kicking Statistics */}
      {statSections.kicking && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Kicking Statistics
          </h2>

        <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Overall</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          <StatBox label="Field Goals Made" value={playerData.kicking.fgMade} small />
          <StatBox label="Field Goals Attempted" value={playerData.kicking.fgAttempted} small />
          <StatBox label="Field Goal %" value={playerData.kicking.fgPct > 0 ? `${playerData.kicking.fgPct}%` : '-'} small />
          <StatBox label="Field Goal Long" value={playerData.kicking.fgLong} small />
          <StatBox label="Extra Points Made" value={playerData.kicking.xpMade} small />
          <StatBox label="Extra Points Attempted" value={playerData.kicking.xpAttempted} small />
          <StatBox label="Extra Point %" value={playerData.kicking.xpPct > 0 ? `${playerData.kicking.xpPct}%` : '-'} small />
        </div>

        <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>By Distance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatBox label="FG 0-29 (Made/Att)" value={`${playerData.kicking.fg0_29Made}/${playerData.kicking.fg0_29Attempted}`} small />
          <StatBox label="FG 30-39 (Made/Att)" value={`${playerData.kicking.fg30_39Made}/${playerData.kicking.fg30_39Attempted}`} small />
          <StatBox label="FG 40-49 (Made/Att)" value={`${playerData.kicking.fg40_49Made}/${playerData.kicking.fg40_49Attempted}`} small />
          <StatBox label="FG 50+ (Made/Att)" value={`${playerData.kicking.fg50PlusMade}/${playerData.kicking.fg50PlusAttempted}`} small />
        </div>

        <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Kickoffs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatBox label="Kickoffs" value={playerData.kicking.kickoffs} small />
          <StatBox label="Touchbacks" value={playerData.kicking.touchbacks} small />
          <StatBox label="Touchback %" value={playerData.kicking.touchbackPct > 0 ? `${playerData.kicking.touchbackPct}%` : '-'} small />
          <StatBox label="FG Blocked" value={playerData.kicking.fgBlocked} small />
          <StatBox label="XP Blocked" value={playerData.kicking.xpBlocked} small />
        </div>
        </div>
      )}

      {/* Punting Statistics */}
      {statSections.punting && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Punting Statistics
          </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatBox label="Punts" value={playerData.punting.punts} small />
          <StatBox label="Punting Yards" value={playerData.punting.puntingYards} small />
          <StatBox label="Yards/Punt" value={playerData.punting.yardsPerPunt > 0 ? playerData.punting.yardsPerPunt.toFixed(1) : '-'} small />
          <StatBox label="Net Punting Yards" value={playerData.punting.netPuntingYards} small />
          <StatBox label="Net Yards/Punt" value={playerData.punting.netYardsPerPunt > 0 ? playerData.punting.netYardsPerPunt.toFixed(1) : '-'} small />
          <StatBox label="Punts Inside 20" value={playerData.punting.puntsInside20} small />
          <StatBox label="Touchbacks" value={playerData.punting.touchbacks} small />
          <StatBox label="Punt Long" value={playerData.punting.puntLong} small />
          <StatBox label="Punts Blocked" value={playerData.punting.puntsBlocked} small />
        </div>
        </div>
      )}

      {/* Return Statistics */}
      {(statSections.kickReturn || statSections.puntReturn) && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Return Statistics
          </h2>

          {statSections.kickReturn && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Kick Returns</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <StatBox label="Returns" value={playerData.kickReturn.returns} small />
          <StatBox label="Return Yardage" value={playerData.kickReturn.returnYardage} small />
          <StatBox label="Return Average" value={playerData.kickReturn.returnAverage > 0 ? playerData.kickReturn.returnAverage.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.kickReturn.touchdowns} small />
          <StatBox label="Return Long" value={playerData.kickReturn.returnLong} small />
        </div>
            </>
          )}

          {statSections.puntReturn && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Punt Returns</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatBox label="Returns" value={playerData.puntReturn.returns} small />
                <StatBox label="Return Yardage" value={playerData.puntReturn.returnYardage} small />
                <StatBox label="Return Average" value={playerData.puntReturn.returnAverage > 0 ? playerData.puntReturn.returnAverage.toFixed(1) : '-'} small />
                <StatBox label="Touchdowns" value={playerData.puntReturn.touchdowns} small />
                <StatBox label="Return Long" value={playerData.puntReturn.returnLong} small />
              </div>
            </>
          )}
        </div>
      )}

      {/* Scrimmage & Total Statistics */}
      {(statSections.scrimmage || statSections.total) && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.primary,
            border: `3px solid ${teamColors.secondary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: primaryText }}>
            Scrimmage & Total Statistics
          </h2>

          {statSections.scrimmage && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Scrimmage</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <StatBox label="Plays" value={playerData.scrimmage.plays} small />
          <StatBox label="Yards" value={playerData.scrimmage.yards} small />
          <StatBox label="Yards/Play" value={playerData.scrimmage.yardsPerPlay > 0 ? playerData.scrimmage.yardsPerPlay.toFixed(1) : '-'} small />
          <StatBox label="Touchdowns" value={playerData.scrimmage.touchdowns} small />
          <StatBox label="Yards/Game" value={playerData.scrimmage.yardsPerGame > 0 ? playerData.scrimmage.yardsPerGame.toFixed(1) : '-'} small />
        </div>
            </>
          )}

          {statSections.total && (
            <>
              <h3 className="text-lg font-bold mb-3" style={{ color: primaryText, opacity: 0.9 }}>Total</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatBox label="Plays" value={playerData.total.plays} small />
                <StatBox label="Yardage" value={playerData.total.yardage} small />
                <StatBox label="Yards/Play" value={playerData.total.yardsPerPlay > 0 ? playerData.total.yardsPerPlay.toFixed(1) : '-'} small />
                <StatBox label="Touchdowns" value={playerData.total.touchdowns} small />
                <StatBox label="Yards/Game" value={playerData.total.yardsPerGame > 0 ? playerData.total.yardsPerGame.toFixed(1) : '-'} small />
              </div>
            </>
          )}
        </div>
      )}

      {/* Note */}
      <div
        className="rounded-lg shadow-lg p-6 text-center"
        style={{
          backgroundColor: teamColors.primary,
          border: `3px solid ${teamColors.secondary}`
        }}
      >
        <p className="text-sm" style={{ color: primaryText, opacity: 0.6 }}>
          * Most statistics are not yet tracked and will be updated as features are implemented.
        </p>
      </div>

      {/* Edit Modal */}
      <PlayerEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        player={player}
        teamColors={teamColors}
        onSave={handlePlayerSave}
        defaultSchool={dynasty.teamName}
      />
    </div>
  )
}
