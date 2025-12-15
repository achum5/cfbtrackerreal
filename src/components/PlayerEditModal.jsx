import { useState, useEffect } from 'react'
import { getContrastTextColor } from '../utils/colorUtils'

export default function PlayerEditModal({ isOpen, onClose, player, teamColors, onSave }) {
  const [formData, setFormData] = useState({})

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (player && isOpen) {
      setFormData({
        // Basic Info
        name: player.name || '',
        position: player.position || '',
        school: player.school || '',
        year: player.year || '',
        devTrait: player.devTrait || 'Normal',
        overall: player.overall || 0,

        // Biographical & Recruiting
        yearStarted: player.yearStarted || '',
        stars: player.stars || 0,
        positionRank: player.positionRank || 0,
        stateRank: player.stateRank || 0,
        nationalRank: player.nationalRank || 0,

        // Development
        gemBust: player.gemBust || '',
        overallProgression: player.overallProgression || 0,
        overallRatingChange: player.overallRatingChange || 0,

        // Game Logs
        snapsPlayed: player.snapsPlayed || 0,
        gamesPlayed: player.gamesPlayed || 0,
        gamesStarted: player.gamesStarted || 0,

        // Departure
        yearDeparted: player.yearDeparted || '',
        yearsInSchool: player.yearsInSchool || 0,
        draftRound: player.draftRound || '',

        // Accolades
        confPOW: player.confPOW || 0,
        nationalPOW: player.nationalPOW || 0,
        allConf1st: player.allConf1st || 0,
        allConf2nd: player.allConf2nd || 0,
        allConfFr: player.allConfFr || 0,
        allAm1st: player.allAm1st || 0,
        allAm2nd: player.allAm2nd || 0,
        allAmFr: player.allAmFr || 0,

        // Passing Stats - all fields including calculated
        passing_completions: player.passing?.completions || 0,
        passing_attempts: player.passing?.attempts || 0,
        passing_completionPct: player.passing?.completionPct || 0,
        passing_yards: player.passing?.yards || 0,
        passing_touchdowns: player.passing?.touchdowns || 0,
        passing_tdPct: player.passing?.tdPct || 0,
        passing_interceptions: player.passing?.interceptions || 0,
        passing_intPct: player.passing?.intPct || 0,
        passing_tdIntRatio: player.passing?.tdIntRatio || 0,
        passing_yardsPerAttempt: player.passing?.yardsPerAttempt || 0,
        passing_netYardsPerAttempt: player.passing?.netYardsPerAttempt || 0,
        passing_adjNetYardsPerAttempt: player.passing?.adjNetYardsPerAttempt || 0,
        passing_yardsPerGame: player.passing?.yardsPerGame || 0,
        passing_passerRating: player.passing?.passerRating || 0,
        passing_passingLong: player.passing?.passingLong || 0,
        passing_sacksTaken: player.passing?.sacksTaken || 0,
        passing_sackPct: player.passing?.sackPct || 0,

        // Rushing Stats - all fields including calculated
        rushing_carries: player.rushing?.carries || 0,
        rushing_yards: player.rushing?.yards || 0,
        rushing_yardsPerCarry: player.rushing?.yardsPerCarry || 0,
        rushing_touchdowns: player.rushing?.touchdowns || 0,
        rushing_yardsPerGame: player.rushing?.yardsPerGame || 0,
        rushing_runs20Plus: player.rushing?.runs20Plus || 0,
        rushing_brokenTackles: player.rushing?.brokenTackles || 0,
        rushing_yardsAfterContact: player.rushing?.yardsAfterContact || 0,
        rushing_rushingLong: player.rushing?.rushingLong || 0,
        rushing_fumbles: player.rushing?.fumbles || 0,
        rushing_fumblePct: player.rushing?.fumblePct || 0,

        // Receiving Stats - all fields including calculated
        receiving_receptions: player.receiving?.receptions || 0,
        receiving_yards: player.receiving?.yards || 0,
        receiving_yardsPerCatch: player.receiving?.yardsPerCatch || 0,
        receiving_touchdowns: player.receiving?.touchdowns || 0,
        receiving_yardsPerGame: player.receiving?.yardsPerGame || 0,
        receiving_receivingLong: player.receiving?.receivingLong || 0,
        receiving_runAfterCatch: player.receiving?.runAfterCatch || 0,
        receiving_racAverage: player.receiving?.racAverage || 0,
        receiving_drops: player.receiving?.drops || 0,

        // Blocking
        blocking_sacksAllowed: player.blocking?.sacksAllowed || 0,

        // Defensive Stats - all fields including calculated
        defensive_soloTackles: player.defensive?.soloTackles || 0,
        defensive_assistedTackles: player.defensive?.assistedTackles || 0,
        defensive_totalTackles: player.defensive?.totalTackles || 0,
        defensive_tacklesForLoss: player.defensive?.tacklesForLoss || 0,
        defensive_sacks: player.defensive?.sacks || 0,
        defensive_interceptions: player.defensive?.interceptions || 0,
        defensive_intReturnYards: player.defensive?.intReturnYards || 0,
        defensive_avgIntReturn: player.defensive?.avgIntReturn || 0,
        defensive_intLong: player.defensive?.intLong || 0,
        defensive_defensiveTDs: player.defensive?.defensiveTDs || 0,
        defensive_deflections: player.defensive?.deflections || 0,
        defensive_catchesAllowed: player.defensive?.catchesAllowed || 0,
        defensive_forcedFumbles: player.defensive?.forcedFumbles || 0,
        defensive_fumbleRecoveries: player.defensive?.fumbleRecoveries || 0,
        defensive_fumbleReturnYards: player.defensive?.fumbleReturnYards || 0,
        defensive_blocks: player.defensive?.blocks || 0,
        defensive_safeties: player.defensive?.safeties || 0,

        // Kicking Stats - all fields including calculated
        kicking_fgMade: player.kicking?.fgMade || 0,
        kicking_fgAttempted: player.kicking?.fgAttempted || 0,
        kicking_fgPct: player.kicking?.fgPct || 0,
        kicking_fgLong: player.kicking?.fgLong || 0,
        kicking_xpMade: player.kicking?.xpMade || 0,
        kicking_xpAttempted: player.kicking?.xpAttempted || 0,
        kicking_xpPct: player.kicking?.xpPct || 0,
        kicking_fg0_29Made: player.kicking?.fg0_29Made || 0,
        kicking_fg0_29Attempted: player.kicking?.fg0_29Attempted || 0,
        kicking_fg30_39Made: player.kicking?.fg30_39Made || 0,
        kicking_fg30_39Attempted: player.kicking?.fg30_39Attempted || 0,
        kicking_fg40_49Made: player.kicking?.fg40_49Made || 0,
        kicking_fg40_49Attempted: player.kicking?.fg40_49Attempted || 0,
        kicking_fg50PlusMade: player.kicking?.fg50PlusMade || 0,
        kicking_fg50PlusAttempted: player.kicking?.fg50PlusAttempted || 0,
        kicking_kickoffs: player.kicking?.kickoffs || 0,
        kicking_touchbacks: player.kicking?.touchbacks || 0,
        kicking_touchbackPct: player.kicking?.touchbackPct || 0,
        kicking_fgBlocked: player.kicking?.fgBlocked || 0,
        kicking_xpBlocked: player.kicking?.xpBlocked || 0,

        // Punting Stats - all fields including calculated
        punting_punts: player.punting?.punts || 0,
        punting_puntingYards: player.punting?.puntingYards || 0,
        punting_yardsPerPunt: player.punting?.yardsPerPunt || 0,
        punting_netPuntingYards: player.punting?.netPuntingYards || 0,
        punting_netYardsPerPunt: player.punting?.netYardsPerPunt || 0,
        punting_puntsInside20: player.punting?.puntsInside20 || 0,
        punting_touchbacks: player.punting?.touchbacks || 0,
        punting_puntLong: player.punting?.puntLong || 0,
        punting_puntsBlocked: player.punting?.puntsBlocked || 0,

        // Kick Return Stats - all fields including calculated
        kickReturn_returns: player.kickReturn?.returns || 0,
        kickReturn_returnYardage: player.kickReturn?.returnYardage || 0,
        kickReturn_returnAverage: player.kickReturn?.returnAverage || 0,
        kickReturn_touchdowns: player.kickReturn?.touchdowns || 0,
        kickReturn_returnLong: player.kickReturn?.returnLong || 0,

        // Punt Return Stats - all fields including calculated
        puntReturn_returns: player.puntReturn?.returns || 0,
        puntReturn_returnYardage: player.puntReturn?.returnYardage || 0,
        puntReturn_returnAverage: player.puntReturn?.returnAverage || 0,
        puntReturn_touchdowns: player.puntReturn?.touchdowns || 0,
        puntReturn_returnLong: player.puntReturn?.returnLong || 0,

        // Scrimmage Stats - all fields including calculated
        scrimmage_plays: player.scrimmage?.plays || 0,
        scrimmage_yards: player.scrimmage?.yards || 0,
        scrimmage_yardsPerPlay: player.scrimmage?.yardsPerPlay || 0,
        scrimmage_touchdowns: player.scrimmage?.touchdowns || 0,
        scrimmage_yardsPerGame: player.scrimmage?.yardsPerGame || 0,

        // Total Stats - all fields including calculated
        total_plays: player.total?.plays || 0,
        total_yardage: player.total?.yardage || 0,
        total_yardsPerPlay: player.total?.yardsPerPlay || 0,
        total_touchdowns: player.total?.touchdowns || 0,
        total_yardsPerGame: player.total?.yardsPerGame || 0
      })
    }
  }, [player, isOpen])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Helper to parse number or 0
    const num = (val) => parseFloat(val) || 0

    // Restructure the flat form data into nested structure
    const updatedPlayer = {
      ...player,
      name: formData.name,
      position: formData.position,
      school: formData.school,
      year: formData.year,
      devTrait: formData.devTrait,
      overall: num(formData.overall),

      yearStarted: formData.yearStarted,
      stars: num(formData.stars),
      positionRank: num(formData.positionRank),
      stateRank: num(formData.stateRank),
      nationalRank: num(formData.nationalRank),

      gemBust: formData.gemBust,
      overallProgression: formData.overallProgression,
      overallRatingChange: formData.overallRatingChange,

      snapsPlayed: num(formData.snapsPlayed),
      gamesPlayed: num(formData.gamesPlayed),
      gamesStarted: num(formData.gamesStarted),

      yearDeparted: formData.yearDeparted,
      yearsInSchool: num(formData.yearsInSchool),
      draftRound: formData.draftRound,

      confPOW: num(formData.confPOW),
      nationalPOW: num(formData.nationalPOW),
      allConf1st: num(formData.allConf1st),
      allConf2nd: num(formData.allConf2nd),
      allConfFr: num(formData.allConfFr),
      allAm1st: num(formData.allAm1st),
      allAm2nd: num(formData.allAm2nd),
      allAmFr: num(formData.allAmFr),

      passing: {
        completions: num(formData.passing_completions),
        attempts: num(formData.passing_attempts),
        completionPct: num(formData.passing_completionPct),
        yards: num(formData.passing_yards),
        touchdowns: num(formData.passing_touchdowns),
        tdPct: num(formData.passing_tdPct),
        interceptions: num(formData.passing_interceptions),
        intPct: num(formData.passing_intPct),
        tdIntRatio: num(formData.passing_tdIntRatio),
        yardsPerAttempt: num(formData.passing_yardsPerAttempt),
        netYardsPerAttempt: num(formData.passing_netYardsPerAttempt),
        adjNetYardsPerAttempt: num(formData.passing_adjNetYardsPerAttempt),
        yardsPerGame: num(formData.passing_yardsPerGame),
        passerRating: num(formData.passing_passerRating),
        passingLong: num(formData.passing_passingLong),
        sacksTaken: num(formData.passing_sacksTaken),
        sackPct: num(formData.passing_sackPct)
      },

      rushing: {
        carries: num(formData.rushing_carries),
        yards: num(formData.rushing_yards),
        yardsPerCarry: num(formData.rushing_yardsPerCarry),
        touchdowns: num(formData.rushing_touchdowns),
        yardsPerGame: num(formData.rushing_yardsPerGame),
        runs20Plus: num(formData.rushing_runs20Plus),
        brokenTackles: num(formData.rushing_brokenTackles),
        yardsAfterContact: num(formData.rushing_yardsAfterContact),
        rushingLong: num(formData.rushing_rushingLong),
        fumbles: num(formData.rushing_fumbles),
        fumblePct: num(formData.rushing_fumblePct)
      },

      receiving: {
        receptions: num(formData.receiving_receptions),
        yards: num(formData.receiving_yards),
        yardsPerCatch: num(formData.receiving_yardsPerCatch),
        touchdowns: num(formData.receiving_touchdowns),
        yardsPerGame: num(formData.receiving_yardsPerGame),
        receivingLong: num(formData.receiving_receivingLong),
        runAfterCatch: num(formData.receiving_runAfterCatch),
        racAverage: num(formData.receiving_racAverage),
        drops: num(formData.receiving_drops)
      },

      blocking: {
        sacksAllowed: num(formData.blocking_sacksAllowed)
      },

      defensive: {
        soloTackles: num(formData.defensive_soloTackles),
        assistedTackles: num(formData.defensive_assistedTackles),
        totalTackles: num(formData.defensive_totalTackles),
        tacklesForLoss: num(formData.defensive_tacklesForLoss),
        sacks: num(formData.defensive_sacks),
        interceptions: num(formData.defensive_interceptions),
        intReturnYards: num(formData.defensive_intReturnYards),
        avgIntReturn: num(formData.defensive_avgIntReturn),
        intLong: num(formData.defensive_intLong),
        defensiveTDs: num(formData.defensive_defensiveTDs),
        deflections: num(formData.defensive_deflections),
        catchesAllowed: num(formData.defensive_catchesAllowed),
        forcedFumbles: num(formData.defensive_forcedFumbles),
        fumbleRecoveries: num(formData.defensive_fumbleRecoveries),
        fumbleReturnYards: num(formData.defensive_fumbleReturnYards),
        blocks: num(formData.defensive_blocks),
        safeties: num(formData.defensive_safeties)
      },

      kicking: {
        fgMade: num(formData.kicking_fgMade),
        fgAttempted: num(formData.kicking_fgAttempted),
        fgPct: num(formData.kicking_fgPct),
        fgLong: num(formData.kicking_fgLong),
        xpMade: num(formData.kicking_xpMade),
        xpAttempted: num(formData.kicking_xpAttempted),
        xpPct: num(formData.kicking_xpPct),
        fg0_29Made: num(formData.kicking_fg0_29Made),
        fg0_29Attempted: num(formData.kicking_fg0_29Attempted),
        fg30_39Made: num(formData.kicking_fg30_39Made),
        fg30_39Attempted: num(formData.kicking_fg30_39Attempted),
        fg40_49Made: num(formData.kicking_fg40_49Made),
        fg40_49Attempted: num(formData.kicking_fg40_49Attempted),
        fg50PlusMade: num(formData.kicking_fg50PlusMade),
        fg50PlusAttempted: num(formData.kicking_fg50PlusAttempted),
        kickoffs: num(formData.kicking_kickoffs),
        touchbacks: num(formData.kicking_touchbacks),
        touchbackPct: num(formData.kicking_touchbackPct),
        fgBlocked: num(formData.kicking_fgBlocked),
        xpBlocked: num(formData.kicking_xpBlocked)
      },

      punting: {
        punts: num(formData.punting_punts),
        puntingYards: num(formData.punting_puntingYards),
        yardsPerPunt: num(formData.punting_yardsPerPunt),
        netPuntingYards: num(formData.punting_netPuntingYards),
        netYardsPerPunt: num(formData.punting_netYardsPerPunt),
        puntsInside20: num(formData.punting_puntsInside20),
        touchbacks: num(formData.punting_touchbacks),
        puntLong: num(formData.punting_puntLong),
        puntsBlocked: num(formData.punting_puntsBlocked)
      },

      kickReturn: {
        returns: num(formData.kickReturn_returns),
        returnYardage: num(formData.kickReturn_returnYardage),
        returnAverage: num(formData.kickReturn_returnAverage),
        touchdowns: num(formData.kickReturn_touchdowns),
        returnLong: num(formData.kickReturn_returnLong)
      },

      puntReturn: {
        returns: num(formData.puntReturn_returns),
        returnYardage: num(formData.puntReturn_returnYardage),
        returnAverage: num(formData.puntReturn_returnAverage),
        touchdowns: num(formData.puntReturn_touchdowns),
        returnLong: num(formData.puntReturn_returnLong)
      },

      scrimmage: {
        plays: num(formData.scrimmage_plays),
        yards: num(formData.scrimmage_yards),
        yardsPerPlay: num(formData.scrimmage_yardsPerPlay),
        touchdowns: num(formData.scrimmage_touchdowns),
        yardsPerGame: num(formData.scrimmage_yardsPerGame)
      },

      total: {
        plays: num(formData.total_plays),
        yardage: num(formData.total_yardage),
        yardsPerPlay: num(formData.total_yardsPerPlay),
        touchdowns: num(formData.total_touchdowns),
        yardsPerGame: num(formData.total_yardsPerGame)
      }
    }

    onSave(updatedPlayer)
  }

  if (!isOpen) return null

  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  const InputField = ({ label, name, type = "number", step = "any", className = "" }) => (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.8 }}>
        {label}
      </label>
      <input
        type={type}
        step={step}
        name={name}
        value={formData[name] ?? ''}
        onChange={handleChange}
        className="w-full px-3 py-2 border-2 rounded-lg"
        style={{
          borderColor: teamColors.primary,
          backgroundColor: '#ffffff'
        }}
      />
    </div>
  )

  return (
    <div
      className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: teamColors.primary }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 z-10 p-6 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.secondary }}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold" style={{ color: primaryText }}>
                Edit Player
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                style={{ color: primaryText }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <InputField label="Name" name="name" type="text" />

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.8 }}>
                    Position
                  </label>
                  <select
                    name="position"
                    value={formData.position ?? ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border-2 rounded-lg"
                    style={{
                      borderColor: teamColors.primary,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">Select Position</option>
                    {['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS', 'K', 'P'].map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <InputField label="School" name="school" type="text" />

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.8 }}>
                    Class
                  </label>
                  <select
                    name="year"
                    value={formData.year ?? ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border-2 rounded-lg"
                    style={{
                      borderColor: teamColors.primary,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">Select Class</option>
                    {['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr'].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.8 }}>
                    Dev Trait
                  </label>
                  <select
                    name="devTrait"
                    value={formData.devTrait ?? 'Normal'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border-2 rounded-lg"
                    style={{
                      borderColor: teamColors.primary,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {['Elite', 'Star', 'Impact', 'Normal'].map(trait => (
                      <option key={trait} value={trait}>{trait}</option>
                    ))}
                  </select>
                </div>

                <InputField label="Overall Rating" name="overall" />
              </div>
            </div>

            {/* Biographical & Recruiting */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Recruiting Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <InputField label="Year Started" name="yearStarted" type="text" />
                <InputField label="Stars" name="stars" />
                <InputField label="Position Rank" name="positionRank" />
                <InputField label="State Rank" name="stateRank" />
                <InputField label="National Rank" name="nationalRank" />
              </div>
            </div>

            {/* Development */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Development</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: secondaryText, opacity: 0.8 }}>
                    Gem / Bust
                  </label>
                  <select
                    name="gemBust"
                    value={formData.gemBust ?? ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border-2 rounded-lg"
                    style={{
                      borderColor: teamColors.primary,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">Neither</option>
                    <option value="Gem">Gem</option>
                    <option value="Bust">Bust</option>
                  </select>
                </div>
                <InputField label="Overall Progression" name="overallProgression" type="text" />
                <InputField label="Overall Rating Change" name="overallRatingChange" type="text" />
              </div>
            </div>

            {/* Game Logs */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Game Logs</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField label="Snaps Played" name="snapsPlayed" />
                <InputField label="Games Played" name="gamesPlayed" />
                <InputField label="Games Started" name="gamesStarted" />
              </div>
            </div>

            {/* Departure Information */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Departure Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField label="Year Departed" name="yearDeparted" type="text" />
                <InputField label="Years in School" name="yearsInSchool" />
                <InputField label="Draft Round" name="draftRound" type="text" />
              </div>
            </div>

            {/* Accolades */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Accolades</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField label="Conf POW" name="confPOW" />
                <InputField label="Nat'l POW" name="nationalPOW" />
                <InputField label="All-Conf 1st" name="allConf1st" />
                <InputField label="All-Conf 2nd" name="allConf2nd" />
                <InputField label="All-Conf Fr" name="allConfFr" />
                <InputField label="All-Am 1st" name="allAm1st" />
                <InputField label="All-Am 2nd" name="allAm2nd" />
                <InputField label="All-Am Fr" name="allAmFr" />
              </div>
            </div>

            {/* Passing Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Passing Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <InputField label="Completions" name="passing_completions" />
                <InputField label="Attempts" name="passing_attempts" />
                <InputField label="Completion %" name="passing_completionPct" />
                <InputField label="Yards" name="passing_yards" />
                <InputField label="Touchdowns" name="passing_touchdowns" />
                <InputField label="TD %" name="passing_tdPct" />
                <InputField label="Interceptions" name="passing_interceptions" />
                <InputField label="INT %" name="passing_intPct" />
                <InputField label="TD/INT Ratio" name="passing_tdIntRatio" />
                <InputField label="Yards/Attempt" name="passing_yardsPerAttempt" />
                <InputField label="Net Yards/Att" name="passing_netYardsPerAttempt" />
                <InputField label="Adj Net Yards/Att" name="passing_adjNetYardsPerAttempt" />
                <InputField label="Yards/Game" name="passing_yardsPerGame" />
                <InputField label="Passer Rating" name="passing_passerRating" />
                <InputField label="Passing Long" name="passing_passingLong" />
                <InputField label="Sacks Taken" name="passing_sacksTaken" />
                <InputField label="Sack %" name="passing_sackPct" />
              </div>
            </div>

            {/* Rushing Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Rushing Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <InputField label="Carries" name="rushing_carries" />
                <InputField label="Yards" name="rushing_yards" />
                <InputField label="Yards/Carry" name="rushing_yardsPerCarry" />
                <InputField label="Touchdowns" name="rushing_touchdowns" />
                <InputField label="Yards/Game" name="rushing_yardsPerGame" />
                <InputField label="20+ Yard Runs" name="rushing_runs20Plus" />
                <InputField label="Broken Tackles" name="rushing_brokenTackles" />
                <InputField label="Yards After Contact" name="rushing_yardsAfterContact" />
                <InputField label="Rushing Long" name="rushing_rushingLong" />
                <InputField label="Fumbles" name="rushing_fumbles" />
                <InputField label="Fumble %" name="rushing_fumblePct" />
              </div>
            </div>

            {/* Receiving Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Receiving Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <InputField label="Receptions" name="receiving_receptions" />
                <InputField label="Yards" name="receiving_yards" />
                <InputField label="Yards/Catch" name="receiving_yardsPerCatch" />
                <InputField label="Touchdowns" name="receiving_touchdowns" />
                <InputField label="Yards/Game" name="receiving_yardsPerGame" />
                <InputField label="Receiving Long" name="receiving_receivingLong" />
                <InputField label="Run After Catch" name="receiving_runAfterCatch" />
                <InputField label="RAC Average" name="receiving_racAverage" />
                <InputField label="Drops" name="receiving_drops" />
              </div>
            </div>

            {/* Blocking */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Blocking</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField label="Sacks Allowed" name="blocking_sacksAllowed" />
              </div>
            </div>

            {/* Defensive Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Defensive Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <InputField label="Solo Tackles" name="defensive_soloTackles" />
                <InputField label="Assisted Tackles" name="defensive_assistedTackles" />
                <InputField label="Total Tackles" name="defensive_totalTackles" />
                <InputField label="Tackles for Loss" name="defensive_tacklesForLoss" />
                <InputField label="Sacks" name="defensive_sacks" />
                <InputField label="Interceptions" name="defensive_interceptions" />
                <InputField label="INT Return Yards" name="defensive_intReturnYards" />
                <InputField label="Avg INT Return" name="defensive_avgIntReturn" />
                <InputField label="INT Long" name="defensive_intLong" />
                <InputField label="Defensive TDs" name="defensive_defensiveTDs" />
                <InputField label="Deflections" name="defensive_deflections" />
                <InputField label="Catches Allowed" name="defensive_catchesAllowed" />
                <InputField label="Forced Fumbles" name="defensive_forcedFumbles" />
                <InputField label="Fumble Recoveries" name="defensive_fumbleRecoveries" />
                <InputField label="Fumble Return Yards" name="defensive_fumbleReturnYards" />
                <InputField label="Blocks" name="defensive_blocks" />
                <InputField label="Safeties" name="defensive_safeties" />
              </div>
            </div>

            {/* Kicking Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Kicking Statistics</h3>
              <div className="space-y-4">
                <h4 className="text-sm font-bold" style={{ color: secondaryText }}>Overall</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <InputField label="FG Made" name="kicking_fgMade" />
                  <InputField label="FG Attempted" name="kicking_fgAttempted" />
                  <InputField label="FG %" name="kicking_fgPct" />
                  <InputField label="FG Long" name="kicking_fgLong" />
                  <InputField label="XP Made" name="kicking_xpMade" />
                  <InputField label="XP Attempted" name="kicking_xpAttempted" />
                  <InputField label="XP %" name="kicking_xpPct" />
                </div>
                <h4 className="text-sm font-bold" style={{ color: secondaryText }}>By Distance</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InputField label="FG 0-29 Made" name="kicking_fg0_29Made" />
                  <InputField label="FG 0-29 Att" name="kicking_fg0_29Attempted" />
                  <InputField label="FG 30-39 Made" name="kicking_fg30_39Made" />
                  <InputField label="FG 30-39 Att" name="kicking_fg30_39Attempted" />
                  <InputField label="FG 40-49 Made" name="kicking_fg40_49Made" />
                  <InputField label="FG 40-49 Att" name="kicking_fg40_49Attempted" />
                  <InputField label="FG 50+ Made" name="kicking_fg50PlusMade" />
                  <InputField label="FG 50+ Att" name="kicking_fg50PlusAttempted" />
                </div>
                <h4 className="text-sm font-bold" style={{ color: secondaryText }}>Kickoffs</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InputField label="Kickoffs" name="kicking_kickoffs" />
                  <InputField label="Touchbacks" name="kicking_touchbacks" />
                  <InputField label="Touchback %" name="kicking_touchbackPct" />
                  <InputField label="FG Blocked" name="kicking_fgBlocked" />
                  <InputField label="XP Blocked" name="kicking_xpBlocked" />
                </div>
              </div>
            </div>

            {/* Punting Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Punting Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <InputField label="Punts" name="punting_punts" />
                <InputField label="Punting Yards" name="punting_puntingYards" />
                <InputField label="Yards/Punt" name="punting_yardsPerPunt" />
                <InputField label="Net Punting Yards" name="punting_netPuntingYards" />
                <InputField label="Net Yards/Punt" name="punting_netYardsPerPunt" />
                <InputField label="Punts Inside 20" name="punting_puntsInside20" />
                <InputField label="Touchbacks" name="punting_touchbacks" />
                <InputField label="Punt Long" name="punting_puntLong" />
                <InputField label="Punts Blocked" name="punting_puntsBlocked" />
              </div>
            </div>

            {/* Kick Return Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Kick Return Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <InputField label="Returns" name="kickReturn_returns" />
                <InputField label="Return Yardage" name="kickReturn_returnYardage" />
                <InputField label="Return Average" name="kickReturn_returnAverage" />
                <InputField label="Touchdowns" name="kickReturn_touchdowns" />
                <InputField label="Return Long" name="kickReturn_returnLong" />
              </div>
            </div>

            {/* Punt Return Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Punt Return Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <InputField label="Returns" name="puntReturn_returns" />
                <InputField label="Return Yardage" name="puntReturn_returnYardage" />
                <InputField label="Return Average" name="puntReturn_returnAverage" />
                <InputField label="Touchdowns" name="puntReturn_touchdowns" />
                <InputField label="Return Long" name="puntReturn_returnLong" />
              </div>
            </div>

            {/* Scrimmage Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Scrimmage Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <InputField label="Plays" name="scrimmage_plays" />
                <InputField label="Yards" name="scrimmage_yards" />
                <InputField label="Yards/Play" name="scrimmage_yardsPerPlay" />
                <InputField label="Touchdowns" name="scrimmage_touchdowns" />
                <InputField label="Yards/Game" name="scrimmage_yardsPerGame" />
              </div>
            </div>

            {/* Total Stats */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: secondaryText }}>Total Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <InputField label="Plays" name="total_plays" />
                <InputField label="Yardage" name="total_yardage" />
                <InputField label="Yards/Play" name="total_yardsPerPlay" />
                <InputField label="Touchdowns" name="total_touchdowns" />
                <InputField label="Yards/Game" name="total_yardsPerGame" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 p-6 border-t-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.secondary }}>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: 'transparent',
                  border: `2px solid ${teamColors.secondary}`,
                  color: primaryText
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: teamColors.secondary,
                  color: secondaryText
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
