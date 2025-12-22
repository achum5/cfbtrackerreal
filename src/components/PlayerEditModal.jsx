import { useState, useEffect } from 'react'
import { getContrastTextColor } from '../utils/colorUtils'
import { teams } from '../data/teams'

export default function PlayerEditModal({ isOpen, onClose, player, teamColors, onSave, defaultSchool, dynasty }) {
  const [formData, setFormData] = useState({})
  const [expandedSections, setExpandedSections] = useState([])
  const [selectedStatsYear, setSelectedStatsYear] = useState(null)

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

  // Get available years for stats (years this player has data, plus current year)
  const getAvailableYears = () => {
    if (!dynasty) return []
    const yearsSet = new Set()

    // Add current dynasty year
    if (dynasty.currentYear) yearsSet.add(dynasty.currentYear)

    // Add years from playerStatsByYear where this player has data
    const playerStats = dynasty.playerStatsByYear || {}
    Object.keys(playerStats).forEach(year => {
      const hasPlayer = playerStats[year]?.some(p => p.pid === player?.pid)
      if (hasPlayer) yearsSet.add(parseInt(year))
    })

    // Add years from detailedStatsByYear where this player has data
    const detailedStats = dynasty.detailedStatsByYear || {}
    Object.keys(detailedStats).forEach(year => {
      const yearData = detailedStats[year] || {}
      const hasData = Object.values(yearData).some(category =>
        Array.isArray(category) && category.some(p => p.pid === player?.pid)
      )
      if (hasData) yearsSet.add(parseInt(year))
    })

    return Array.from(yearsSet).sort((a, b) => b - a) // Most recent first
  }

  // Helper to get stats for a specific year
  const getYearStats = (year) => {
    const detailedStats = dynasty?.detailedStatsByYear || {}
    const playerStats = dynasty?.playerStatsByYear || {}
    const playerPid = player?.pid
    const yearStr = year?.toString()

    // Get basic stats (games, snaps)
    const basicStats = playerStats[yearStr]?.find(p => p.pid === playerPid) || {}

    // Helper to get category stats
    const getCategoryStats = (tabName, fieldMap) => {
      const result = {}
      Object.keys(fieldMap).forEach(key => result[key] = 0)

      const yearData = detailedStats[yearStr]?.[tabName] || []
      const playerData = yearData.find(p => p.pid === playerPid)
      if (playerData) {
        Object.entries(fieldMap).forEach(([key, sheetField]) => {
          result[key] = playerData[sheetField] || 0
        })
      }
      return result
    }

    const passing = getCategoryStats('Passing', {
      completions: 'Completions', attempts: 'Attempts', yards: 'Yards',
      touchdowns: 'Touchdowns', interceptions: 'Interceptions',
      passingLong: 'Passing Long', sacksTaken: 'Sacks Taken'
    })
    const rushing = getCategoryStats('Rushing', {
      carries: 'Carries', yards: 'Yards', touchdowns: 'Touchdowns',
      rushingLong: 'Rushing Long', fumbles: 'Fumbles', brokenTackles: 'Broken Tackles'
    })
    const receiving = getCategoryStats('Receiving', {
      receptions: 'Receptions', yards: 'Yards', touchdowns: 'Touchdowns',
      receivingLong: 'Receiving Long', drops: 'Drops'
    })
    const blocking = getCategoryStats('Blocking', { sacksAllowed: 'Sacks Allowed' })
    const defensive = getCategoryStats('Defensive', {
      soloTackles: 'Solo Tackles', assistedTackles: 'Assisted Tackles',
      tacklesForLoss: 'Tackles for Loss', sacks: 'Sacks', interceptions: 'Interceptions',
      intReturnYards: 'INT Return Yards', defensiveTDs: 'Defensive TDs',
      deflections: 'Deflections', forcedFumbles: 'Forced Fumbles', fumbleRecoveries: 'Fumble Recoveries'
    })
    const kicking = getCategoryStats('Kicking', {
      fgMade: 'FG Made', fgAttempted: 'FG Attempted', fgLong: 'FG Long',
      xpMade: 'XP Made', xpAttempted: 'XP Attempted'
    })
    const punting = getCategoryStats('Punting', {
      punts: 'Punts', puntingYards: 'Punting Yards',
      puntsInside20: 'Punts Inside 20', puntLong: 'Punt Long'
    })
    const kickReturn = getCategoryStats('Kick Return', {
      returns: 'Kickoff Returns', returnYardage: 'KR Yardage',
      touchdowns: 'KR Touchdowns', returnLong: 'KR Long'
    })
    const puntReturn = getCategoryStats('Punt Return', {
      returns: 'Punt Returns', returnYardage: 'PR Yardage',
      touchdowns: 'PR Touchdowns', returnLong: 'PR Long'
    })

    return {
      gamesPlayed: basicStats.gamesPlayed || 0,
      snapsPlayed: basicStats.snapsPlayed || 0,
      passing, rushing, receiving, blocking, defensive, kicking, punting, kickReturn, puntReturn
    }
  }

  // Initialize form data when modal opens
  useEffect(() => {
    if (player && isOpen) {
      // Set default selected year to current dynasty year
      const years = getAvailableYears()
      const defaultYear = dynasty?.currentYear || years[0]
      setSelectedStatsYear(defaultYear)

      // Get stats for the default year
      const yearStats = getYearStats(defaultYear)

      setFormData({
        // Basic Info
        pictureUrl: player.pictureUrl || '',
        name: player.name || '',
        position: player.position || '',
        archetype: player.archetype || '',
        school: player.school || defaultSchool || '',
        year: player.year || '',
        devTrait: player.devTrait || 'Normal',
        overall: player.overall || 0,
        jerseyNumber: player.jerseyNumber || '',

        // Physical
        height: player.height || '',
        weight: player.weight || '',
        hometown: player.hometown || '',
        state: player.state || '',
        previousTeam: player.previousTeam || '',

        // Recruiting
        yearStarted: player.yearStarted || '',
        stars: player.stars || 0,
        positionRank: player.positionRank || 0,
        stateRank: player.stateRank || 0,
        nationalRank: player.nationalRank || 0,

        // Development
        gemBust: player.gemBust || '',
        overallProgression: player.overallProgression || 0,
        overallRatingChange: player.overallRatingChange || 0,

        // Game Logs (for selected year)
        snapsPlayed: yearStats.snapsPlayed,
        gamesPlayed: yearStats.gamesPlayed,

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

        // Stats for selected year
        passing_completions: yearStats.passing.completions,
        passing_attempts: yearStats.passing.attempts,
        passing_yards: yearStats.passing.yards,
        passing_touchdowns: yearStats.passing.touchdowns,
        passing_interceptions: yearStats.passing.interceptions,
        passing_passingLong: yearStats.passing.passingLong,
        passing_sacksTaken: yearStats.passing.sacksTaken,

        rushing_carries: yearStats.rushing.carries,
        rushing_yards: yearStats.rushing.yards,
        rushing_touchdowns: yearStats.rushing.touchdowns,
        rushing_rushingLong: yearStats.rushing.rushingLong,
        rushing_fumbles: yearStats.rushing.fumbles,
        rushing_brokenTackles: yearStats.rushing.brokenTackles,

        receiving_receptions: yearStats.receiving.receptions,
        receiving_yards: yearStats.receiving.yards,
        receiving_touchdowns: yearStats.receiving.touchdowns,
        receiving_receivingLong: yearStats.receiving.receivingLong,
        receiving_drops: yearStats.receiving.drops,

        blocking_sacksAllowed: yearStats.blocking.sacksAllowed,

        defensive_soloTackles: yearStats.defensive.soloTackles,
        defensive_assistedTackles: yearStats.defensive.assistedTackles,
        defensive_tacklesForLoss: yearStats.defensive.tacklesForLoss,
        defensive_sacks: yearStats.defensive.sacks,
        defensive_interceptions: yearStats.defensive.interceptions,
        defensive_intReturnYards: yearStats.defensive.intReturnYards,
        defensive_defensiveTDs: yearStats.defensive.defensiveTDs,
        defensive_deflections: yearStats.defensive.deflections,
        defensive_forcedFumbles: yearStats.defensive.forcedFumbles,
        defensive_fumbleRecoveries: yearStats.defensive.fumbleRecoveries,

        kicking_fgMade: yearStats.kicking.fgMade,
        kicking_fgAttempted: yearStats.kicking.fgAttempted,
        kicking_fgLong: yearStats.kicking.fgLong,
        kicking_xpMade: yearStats.kicking.xpMade,
        kicking_xpAttempted: yearStats.kicking.xpAttempted,

        punting_punts: yearStats.punting.punts,
        punting_puntingYards: yearStats.punting.puntingYards,
        punting_puntsInside20: yearStats.punting.puntsInside20,
        punting_puntLong: yearStats.punting.puntLong,

        kickReturn_returns: yearStats.kickReturn.returns,
        kickReturn_returnYardage: yearStats.kickReturn.returnYardage,
        kickReturn_touchdowns: yearStats.kickReturn.touchdowns,
        kickReturn_returnLong: yearStats.kickReturn.returnLong,

        puntReturn_returns: yearStats.puntReturn.returns,
        puntReturn_returnYardage: yearStats.puntReturn.returnYardage,
        puntReturn_touchdowns: yearStats.puntReturn.touchdowns,
        puntReturn_returnLong: yearStats.puntReturn.returnLong,

        // Notes & Media
        notes: player.notes || '',
        links: player.links || []
      })

      // Start with all sections collapsed
      setExpandedSections([])
    }
  }, [player, isOpen, defaultSchool, dynasty])

  // Update stats when selected year changes
  const handleYearChange = (newYear) => {
    setSelectedStatsYear(newYear)
    const yearStats = getYearStats(newYear)

    setFormData(prev => ({
      ...prev,
      // Update game logs for selected year
      snapsPlayed: yearStats.snapsPlayed,
      gamesPlayed: yearStats.gamesPlayed,

      // Update stats for selected year
      passing_completions: yearStats.passing.completions,
      passing_attempts: yearStats.passing.attempts,
      passing_yards: yearStats.passing.yards,
      passing_touchdowns: yearStats.passing.touchdowns,
      passing_interceptions: yearStats.passing.interceptions,
      passing_passingLong: yearStats.passing.passingLong,
      passing_sacksTaken: yearStats.passing.sacksTaken,

      rushing_carries: yearStats.rushing.carries,
      rushing_yards: yearStats.rushing.yards,
      rushing_touchdowns: yearStats.rushing.touchdowns,
      rushing_rushingLong: yearStats.rushing.rushingLong,
      rushing_fumbles: yearStats.rushing.fumbles,
      rushing_brokenTackles: yearStats.rushing.brokenTackles,

      receiving_receptions: yearStats.receiving.receptions,
      receiving_yards: yearStats.receiving.yards,
      receiving_touchdowns: yearStats.receiving.touchdowns,
      receiving_receivingLong: yearStats.receiving.receivingLong,
      receiving_drops: yearStats.receiving.drops,

      blocking_sacksAllowed: yearStats.blocking.sacksAllowed,

      defensive_soloTackles: yearStats.defensive.soloTackles,
      defensive_assistedTackles: yearStats.defensive.assistedTackles,
      defensive_tacklesForLoss: yearStats.defensive.tacklesForLoss,
      defensive_sacks: yearStats.defensive.sacks,
      defensive_interceptions: yearStats.defensive.interceptions,
      defensive_intReturnYards: yearStats.defensive.intReturnYards,
      defensive_defensiveTDs: yearStats.defensive.defensiveTDs,
      defensive_deflections: yearStats.defensive.deflections,
      defensive_forcedFumbles: yearStats.defensive.forcedFumbles,
      defensive_fumbleRecoveries: yearStats.defensive.fumbleRecoveries,

      kicking_fgMade: yearStats.kicking.fgMade,
      kicking_fgAttempted: yearStats.kicking.fgAttempted,
      kicking_fgLong: yearStats.kicking.fgLong,
      kicking_xpMade: yearStats.kicking.xpMade,
      kicking_xpAttempted: yearStats.kicking.xpAttempted,

      punting_punts: yearStats.punting.punts,
      punting_puntingYards: yearStats.punting.puntingYards,
      punting_puntsInside20: yearStats.punting.puntsInside20,
      punting_puntLong: yearStats.punting.puntLong,

      kickReturn_returns: yearStats.kickReturn.returns,
      kickReturn_returnYardage: yearStats.kickReturn.returnYardage,
      kickReturn_touchdowns: yearStats.kickReturn.touchdowns,
      kickReturn_returnLong: yearStats.kickReturn.returnLong,

      puntReturn_returns: yearStats.puntReturn.returns,
      puntReturn_returnYardage: yearStats.puntReturn.returnYardage,
      puntReturn_touchdowns: yearStats.puntReturn.touchdowns,
      puntReturn_returnLong: yearStats.puntReturn.returnLong
    }))
  }

  const availableYears = getAvailableYears()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const toggleSection = (section) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const num = (val) => parseFloat(val) || 0

    // Build stats for the selected year
    const yearStats = {
      year: selectedStatsYear,
      gamesPlayed: num(formData.gamesPlayed),
      snapsPlayed: num(formData.snapsPlayed),
      passing: {
        'Completions': num(formData.passing_completions),
        'Attempts': num(formData.passing_attempts),
        'Yards': num(formData.passing_yards),
        'Touchdowns': num(formData.passing_touchdowns),
        'Interceptions': num(formData.passing_interceptions),
        'Passing Long': num(formData.passing_passingLong),
        'Sacks Taken': num(formData.passing_sacksTaken)
      },
      rushing: {
        'Carries': num(formData.rushing_carries),
        'Yards': num(formData.rushing_yards),
        'Touchdowns': num(formData.rushing_touchdowns),
        'Rushing Long': num(formData.rushing_rushingLong),
        'Fumbles': num(formData.rushing_fumbles),
        'Broken Tackles': num(formData.rushing_brokenTackles)
      },
      receiving: {
        'Receptions': num(formData.receiving_receptions),
        'Yards': num(formData.receiving_yards),
        'Touchdowns': num(formData.receiving_touchdowns),
        'Receiving Long': num(formData.receiving_receivingLong),
        'Drops': num(formData.receiving_drops)
      },
      blocking: {
        'Sacks Allowed': num(formData.blocking_sacksAllowed)
      },
      defensive: {
        'Solo Tackles': num(formData.defensive_soloTackles),
        'Assisted Tackles': num(formData.defensive_assistedTackles),
        'Tackles for Loss': num(formData.defensive_tacklesForLoss),
        'Sacks': num(formData.defensive_sacks),
        'Interceptions': num(formData.defensive_interceptions),
        'INT Return Yards': num(formData.defensive_intReturnYards),
        'Defensive TDs': num(formData.defensive_defensiveTDs),
        'Deflections': num(formData.defensive_deflections),
        'Forced Fumbles': num(formData.defensive_forcedFumbles),
        'Fumble Recoveries': num(formData.defensive_fumbleRecoveries)
      },
      kicking: {
        'FG Made': num(formData.kicking_fgMade),
        'FG Attempted': num(formData.kicking_fgAttempted),
        'FG Long': num(formData.kicking_fgLong),
        'XP Made': num(formData.kicking_xpMade),
        'XP Attempted': num(formData.kicking_xpAttempted)
      },
      punting: {
        'Punts': num(formData.punting_punts),
        'Punting Yards': num(formData.punting_puntingYards),
        'Punts Inside 20': num(formData.punting_puntsInside20),
        'Punt Long': num(formData.punting_puntLong)
      },
      kickReturn: {
        'Kickoff Returns': num(formData.kickReturn_returns),
        'KR Yardage': num(formData.kickReturn_returnYardage),
        'KR Touchdowns': num(formData.kickReturn_touchdowns),
        'KR Long': num(formData.kickReturn_returnLong)
      },
      puntReturn: {
        'Punt Returns': num(formData.puntReturn_returns),
        'PR Yardage': num(formData.puntReturn_returnYardage),
        'PR Touchdowns': num(formData.puntReturn_touchdowns),
        'PR Long': num(formData.puntReturn_returnLong)
      }
    }

    const updatedPlayer = {
      ...player,
      pictureUrl: formData.pictureUrl,
      name: formData.name,
      position: formData.position,
      archetype: formData.archetype,
      school: formData.school,
      year: formData.year,
      devTrait: formData.devTrait,
      overall: num(formData.overall),
      jerseyNumber: formData.jerseyNumber,
      height: formData.height,
      weight: formData.weight ? num(formData.weight) : null,
      hometown: formData.hometown,
      state: formData.state,
      previousTeam: formData.previousTeam,
      yearStarted: formData.yearStarted,
      stars: num(formData.stars),
      positionRank: num(formData.positionRank),
      stateRank: num(formData.stateRank),
      nationalRank: num(formData.nationalRank),
      gemBust: formData.gemBust,
      overallProgression: formData.overallProgression,
      overallRatingChange: formData.overallRatingChange,
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
      notes: formData.notes,
      links: formData.links
    }

    // Pass both player info and year-specific stats
    onSave(updatedPlayer, yearStats)
  }

  if (!isOpen) return null

  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  // Collapsible Section Component
  const Section = ({ id, title, icon, children, defaultExpanded = false }) => {
    const isExpanded = expandedSections.includes(id)
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="w-full px-4 py-3 flex items-center justify-between transition-colors"
          style={{ backgroundColor: isExpanded ? teamColors.primary : `${teamColors.primary}15` }}
        >
          <div className="flex items-center gap-3">
            <span style={{ color: isExpanded ? primaryText : teamColors.primary }}>{icon}</span>
            <span className="font-bold" style={{ color: isExpanded ? primaryText : teamColors.primary }}>{title}</span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke={isExpanded ? primaryText : teamColors.primary}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isExpanded && (
          <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  // Clean Input Component
  const Input = ({ label, name, type = "number", placeholder = "", wide = false }) => (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-xs font-medium mb-1.5" style={{ color: secondaryText, opacity: 0.7 }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={formData[name] ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border-2 text-sm focus:outline-none focus:ring-2 transition-all"
        style={{
          borderColor: `${teamColors.primary}40`,
          backgroundColor: '#ffffff',
          color: '#1f2937'
        }}
      />
    </div>
  )

  // Clean Select Component
  const Select = ({ label, name, options, placeholder = "Select...", wide = false }) => (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-xs font-medium mb-1.5" style={{ color: secondaryText, opacity: 0.7 }}>
        {label}
      </label>
      <select
        name={name}
        value={formData[name] ?? ''}
        onChange={handleChange}
        className="w-full px-3 py-2.5 rounded-lg border-2 text-sm focus:outline-none focus:ring-2 transition-all appearance-none bg-white"
        style={{
          borderColor: `${teamColors.primary}40`,
          color: '#1f2937',
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
          paddingRight: '2.5rem'
        }}
      >
        <option value="">{placeholder}</option>
        {Array.isArray(options) ? options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        )) : Object.entries(options).map(([group, opts]) => (
          <optgroup key={group} label={group}>
            {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )

  const positions = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS', 'K', 'P']
  const classes = ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr']
  const devTraits = ['Elite', 'Star', 'Impact', 'Normal']
  const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']

  const archetypes = {
    'Quarterbacks': ['Backfield Creator', 'Dual Threat', 'Pocket Passer', 'Pure Runner'],
    'Halfbacks': ['Backfield Threat', 'East/West Playmaker', 'Elusive Bruiser', 'North/South Receiver', 'North/South Blocker'],
    'Fullbacks': ['Blocking', 'Utility'],
    'Wide Receivers': ['Contested Specialist', 'Elusive Route Runner', 'Gadget', 'Gritty Possession', 'Physical Route Runner', 'Route Artist', 'Speedster'],
    'Tight Ends': ['Gritty Possession', 'Physical Route Runner', 'Possession', 'Pure Blocker', 'Vertical Threat'],
    'Offensive Line': ['Agile', 'Pass Protector', 'Raw Strength', 'Ground and Pound', 'Well Rounded'],
    'Defensive Line': ['Edge Setter', 'Gap Specialist', 'Power Rusher', 'Pure Power', 'Speed Rusher'],
    'Linebackers': ['Lurker', 'Signal Caller', 'Thumper'],
    'Cornerbacks': ['Boundary', 'Field', 'Zone'],
    'Safeties': ['Box Specialist', 'Coverage Specialist', 'Hybrid'],
    'Kickers & Punters': ['Accurate', 'Power']
  }

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] py-8 px-4 sm:p-4 overflow-y-auto"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-3xl my-auto flex flex-col"
        style={{ backgroundColor: teamColors.secondary, maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex flex-col max-h-full overflow-hidden">
          {/* Header */}
          <div
            className="px-4 sm:px-6 py-4 flex-shrink-0"
            style={{ backgroundColor: teamColors.primary }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {formData.pictureUrl ? (
                  <img
                    src={formData.pictureUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2"
                    style={{ borderColor: teamColors.secondary }}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${teamColors.secondary}30` }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke={primaryText} viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold" style={{ color: primaryText }}>
                    {formData.name || 'Edit Player'}
                  </h2>
                  <p className="text-sm opacity-80" style={{ color: primaryText }}>
                    {formData.position && `${formData.position} • `}{formData.overall ? `${formData.overall} OVR` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: primaryText }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Year Selector in Header */}
            <div
              className="mt-3 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              style={{ backgroundColor: `${teamColors.secondary}20` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: primaryText }}>Editing:</span>
                <select
                  value={selectedStatsYear || ''}
                  onChange={(e) => handleYearChange(parseInt(e.target.value))}
                  className="px-3 py-1.5 rounded-lg font-bold text-sm"
                  style={{ backgroundColor: teamColors.secondary, color: secondaryText }}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year} Season</option>
                  ))}
                </select>
              </div>
              <p className="text-xs" style={{ color: primaryText, opacity: 0.8 }}>
                Stats & awards apply to this season.
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* Basic Information */}
            <Section
              id="basic"
              title="Basic Information"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            >
              <div className="space-y-4">
                {/* Picture URL */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: secondaryText, opacity: 0.7 }}>
                    Picture URL
                  </label>
                  <input
                    type="text"
                    name="pictureUrl"
                    value={formData.pictureUrl ?? ''}
                    onChange={handleChange}
                    placeholder="https://i.imgur.com/..."
                    className="w-full px-3 py-2.5 rounded-lg border-2 text-sm"
                    style={{ borderColor: `${teamColors.primary}40`, backgroundColor: '#ffffff' }}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input label="Name" name="name" type="text" wide />
                  <Input label="Jersey #" name="jerseyNumber" type="text" />
                  <Input label="Overall" name="overall" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select label="Position" name="position" options={positions} />
                  <Select label="Archetype" name="archetype" options={archetypes} />
                  <Select label="Class" name="year" options={classes} />
                  <Select label="Dev Trait" name="devTrait" options={devTraits} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input label="Height" name="height" type="text" placeholder="6'2&quot;" />
                  <Input label="Weight" name="weight" placeholder="220" />
                  <Input label="Hometown" name="hometown" type="text" />
                  <Select label="State" name="state" options={states} />
                </div>
              </div>
            </Section>

            {/* Recruiting & Development */}
            <Section
              id="recruiting"
              title="Recruiting & Development"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Input label="Recruit Year" name="yearStarted" type="text" placeholder="2024" />
                  <Input label="Stars" name="stars" />
                  <Input label="Pos Rank" name="positionRank" />
                  <Input label="State Rank" name="stateRank" />
                  <Input label="Nat'l Rank" name="nationalRank" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select label="Gem/Bust" name="gemBust" options={['', 'Gem', 'Bust']} placeholder="Neither" />
                  <Input label="OVR Progression" name="overallProgression" type="text" />
                  <Input label="OVR Change" name="overallRatingChange" type="text" />
                  <Input label="Transfer From" name="previousTeam" type="text" />
                </div>
              </div>
            </Section>

            {/* Accolades */}
            <Section
              id="accolades"
              title="Accolades"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Conf POW" name="confPOW" />
                <Input label="Nat'l POW" name="nationalPOW" />
                <Input label="All-Conf 1st" name="allConf1st" />
                <Input label="All-Conf 2nd" name="allConf2nd" />
                <Input label="All-Am 1st" name="allAm1st" />
                <Input label="All-Am 2nd" name="allAm2nd" />
                <Input label="Fr All-Conf" name="allConfFr" />
                <Input label="Fr All-Am" name="allAmFr" />
              </div>
            </Section>

            {/* Game Log for Selected Year */}
            <Section
              id="gamelog"
              title={`Game Log (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            >
              <div className="grid grid-cols-2 gap-3">
                <Input label="Games Played" name="gamesPlayed" />
                <Input label="Snaps Played" name="snapsPlayed" />
              </div>
            </Section>

            {/* Passing Stats */}
            <Section
              id="passing"
              title={`Passing (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Completions" name="passing_completions" />
                <Input label="Attempts" name="passing_attempts" />
                <Input label="Yards" name="passing_yards" />
                <Input label="TDs" name="passing_touchdowns" />
                <Input label="INTs" name="passing_interceptions" />
                <Input label="Long" name="passing_passingLong" />
                <Input label="Sacks" name="passing_sacksTaken" />
              </div>
            </Section>

            {/* Rushing Stats */}
            <Section
              id="rushing"
              title={`Rushing (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Input label="Carries" name="rushing_carries" />
                <Input label="Yards" name="rushing_yards" />
                <Input label="TDs" name="rushing_touchdowns" />
                <Input label="Long" name="rushing_rushingLong" />
                <Input label="Fumbles" name="rushing_fumbles" />
                <Input label="Broken Tackles" name="rushing_brokenTackles" />
              </div>
            </Section>

            {/* Receiving Stats */}
            <Section
              id="receiving"
              title={`Receiving (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Input label="Receptions" name="receiving_receptions" />
                <Input label="Yards" name="receiving_yards" />
                <Input label="TDs" name="receiving_touchdowns" />
                <Input label="Long" name="receiving_receivingLong" />
                <Input label="Drops" name="receiving_drops" />
              </div>
            </Section>

            {/* Blocking Stats */}
            <Section
              id="blocking"
              title={`Blocking (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
            >
              <div className="grid grid-cols-2 gap-3">
                <Input label="Sacks Allowed" name="blocking_sacksAllowed" />
              </div>
            </Section>

            {/* Defensive Stats */}
            <Section
              id="defensive"
              title={`Defense (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Solo Tackles" name="defensive_soloTackles" />
                <Input label="Asst Tackles" name="defensive_assistedTackles" />
                <Input label="TFL" name="defensive_tacklesForLoss" />
                <Input label="Sacks" name="defensive_sacks" />
                <Input label="INTs" name="defensive_interceptions" />
                <Input label="INT Yards" name="defensive_intReturnYards" />
                <Input label="Def TDs" name="defensive_defensiveTDs" />
                <Input label="Pass Def" name="defensive_deflections" />
                <Input label="Forced Fum" name="defensive_forcedFumbles" />
                <Input label="Fum Rec" name="defensive_fumbleRecoveries" />
              </div>
            </Section>

            {/* Kicking Stats */}
            <Section
              id="kicking"
              title={`Kicking (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Input label="FG Made" name="kicking_fgMade" />
                <Input label="FG Att" name="kicking_fgAttempted" />
                <Input label="FG Long" name="kicking_fgLong" />
                <Input label="XP Made" name="kicking_xpMade" />
                <Input label="XP Att" name="kicking_xpAttempted" />
              </div>
            </Section>

            {/* Punting Stats */}
            <Section
              id="punting"
              title={`Punting (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Punts" name="punting_punts" />
                <Input label="Yards" name="punting_puntingYards" />
                <Input label="Inside 20" name="punting_puntsInside20" />
                <Input label="Long" name="punting_puntLong" />
              </div>
            </Section>

            {/* Return Stats */}
            <Section
              id="returns"
              title={`Returns (${selectedStatsYear})`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
            >
              <div className="space-y-3">
                <p className="text-xs font-medium" style={{ color: secondaryText, opacity: 0.6 }}>Kick Returns</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input label="Returns" name="kickReturn_returns" />
                  <Input label="Yards" name="kickReturn_returnYardage" />
                  <Input label="TDs" name="kickReturn_touchdowns" />
                  <Input label="Long" name="kickReturn_returnLong" />
                </div>
                <p className="text-xs font-medium pt-2" style={{ color: secondaryText, opacity: 0.6 }}>Punt Returns</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input label="Returns" name="puntReturn_returns" />
                  <Input label="Yards" name="puntReturn_returnYardage" />
                  <Input label="TDs" name="puntReturn_touchdowns" />
                  <Input label="Long" name="puntReturn_returnLong" />
                </div>
              </div>
            </Section>

            {/* Notes */}
            <Section
              id="notes"
              title="Notes & Media"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: secondaryText, opacity: 0.7 }}>
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes ?? ''}
                    onChange={handleChange}
                    placeholder="Add notes about this player..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border-2 text-sm resize-y"
                    style={{ borderColor: `${teamColors.primary}40`, backgroundColor: '#ffffff' }}
                  />
                </div>

                {/* Links */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: secondaryText, opacity: 0.7 }}>
                    Links
                  </label>
                  {formData.links?.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {formData.links.map((link, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={link.title || ''}
                            onChange={(e) => {
                              const newLinks = [...formData.links]
                              newLinks[index] = { ...newLinks[index], title: e.target.value }
                              setFormData(prev => ({ ...prev, links: newLinks }))
                            }}
                            placeholder="Title"
                            className="flex-1 px-3 py-2 rounded-lg border-2 text-sm"
                            style={{ borderColor: `${teamColors.primary}40`, backgroundColor: '#ffffff' }}
                          />
                          <input
                            type="text"
                            value={link.url || ''}
                            onChange={(e) => {
                              const newLinks = [...formData.links]
                              newLinks[index] = { ...newLinks[index], url: e.target.value }
                              setFormData(prev => ({ ...prev, links: newLinks }))
                            }}
                            placeholder="URL"
                            className="flex-[2] px-3 py-2 rounded-lg border-2 text-sm"
                            style={{ borderColor: `${teamColors.primary}40`, backgroundColor: '#ffffff' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newLinks = formData.links.filter((_, i) => i !== index)
                              setFormData(prev => ({ ...prev, links: newLinks }))
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const newLinks = [...(formData.links || []), { title: '', url: '' }]
                      setFormData(prev => ({ ...prev, links: newLinks }))
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ backgroundColor: `${teamColors.primary}20`, color: teamColors.primary }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Link
                  </button>
                </div>
              </div>
            </Section>

          </div>

          {/* Footer */}
          <div
            className="px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t"
            style={{ backgroundColor: teamColors.secondary, borderColor: `${teamColors.primary}20` }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
              style={{ color: secondaryText, backgroundColor: `${teamColors.primary}15` }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
              style={{ backgroundColor: teamColors.primary, color: primaryText }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
