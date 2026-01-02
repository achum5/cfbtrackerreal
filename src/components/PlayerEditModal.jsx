import { useState, useEffect, useRef } from 'react'
import { getContrastTextColor } from '../utils/colorUtils'
import { aggregatePlayerBoxScoreStats } from '../utils/boxScoreAggregator'
import { getTeamAbbreviationsList } from '../data/teamAbbreviations'

export default function PlayerEditModal({ isOpen, onClose, player, teamColors, onSave, defaultSchool, dynasty }) {
  const [formData, setFormData] = useState({})
  const [expandedSections, setExpandedSections] = useState([])
  const [selectedStatsYear, setSelectedStatsYear] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showQuickImageModal, setShowQuickImageModal] = useState(false)
  const fileInputRef = useRef(null)
  const quickFileInputRef = useRef(null)

  // Upload image to ImgBB
  const uploadToImgBB = async (file) => {
    // Try env var first, fallback to hardcoded key for Replit compatibility
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY || '1369fa0365731b13c5330a26fedf569c'
    if (!apiKey) {
      alert('Image upload not configured. Please add VITE_IMGBB_API_KEY to environment variables.')
      return null
    }

    const formDataUpload = new FormData()
    formDataUpload.append('image', file)
    formDataUpload.append('key', apiKey)

    try {
      setUploading(true)
      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formDataUpload
      })
      const data = await response.json()

      if (data.success) {
        return data.data.url
      } else {
        alert('Failed to upload image: ' + (data.error?.message || 'Unknown error'))
        return null
      }
    } catch (error) {
      alert('Failed to upload image: ' + error.message)
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 32MB for ImgBB)
    if (file.size > 32 * 1024 * 1024) {
      alert('Image must be less than 32MB')
      return
    }

    const url = await uploadToImgBB(file)
    if (url) {
      setFormData(prev => ({ ...prev, pictureUrl: url }))
    }

    // Reset file input so same file can be selected again
    e.target.value = ''
  }

  // Handle paste event for image upload
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        // Validate file size (max 32MB for ImgBB)
        if (file.size > 32 * 1024 * 1024) {
          alert('Image must be less than 32MB')
          return
        }

        const url = await uploadToImgBB(file)
        if (url) {
          setFormData(prev => ({ ...prev, pictureUrl: url }))
        }
        return
      }
    }
  }

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

    // Add years from player's own statsByYear
    if (player?.statsByYear) {
      Object.keys(player.statsByYear).forEach(year => {
        yearsSet.add(parseInt(year))
      })
    }

    // Add years from box scores where this player appears
    if (dynasty.games && player?.name) {
      dynasty.games.forEach(game => {
        if (!game.boxScore || !game.year) return
        const checkCategory = (side) => {
          if (!game.boxScore[side]) return false
          return Object.values(game.boxScore[side]).some(category =>
            Array.isArray(category) && category.some(p =>
              p.playerName?.toLowerCase().trim() === player.name.toLowerCase().trim()
            )
          )
        }
        if (checkCategory('home') || checkCategory('away')) {
          yearsSet.add(Number(game.year))
        }
      })
    }

    return Array.from(yearsSet).sort((a, b) => b - a) // Most recent first
  }

  // Helper to get stats for a specific year
  // Combines box score aggregated stats with player.statsByYear, preferring box score data
  const getYearStats = (year) => {
    const yearStr = year?.toString()

    // Get player's stored stats for this year (internal format)
    const playerYearStats = player?.statsByYear?.[year] || player?.statsByYear?.[yearStr] || {}

    // Get aggregated box score stats for this player/year
    // Pass player object to enable teamsByYear filtering (prevents showing opponent stats)
    const boxStats = player?.name && dynasty
      ? aggregatePlayerBoxScoreStats(dynasty, player.name, year, player.team, player)
      : null

    // Helper to get category stats from player.statsByYear (internal format)
    const getCategoryStats = (internalCatName, fieldMap) => {
      const result = {}
      Object.keys(fieldMap).forEach(key => result[key] = 0)

      const categoryData = playerYearStats[internalCatName]
      if (categoryData) {
        Object.entries(fieldMap).forEach(([formKey, internalKey]) => {
          result[formKey] = categoryData[internalKey] || 0
        })
      }
      return result
    }

    // Get stats from player.statsByYear (internal format keys)
    const manualPassing = getCategoryStats('passing', {
      completions: 'cmp', attempts: 'att', yards: 'yds',
      touchdowns: 'td', interceptions: 'int',
      passingLong: 'lng', sacksTaken: 'sacks'
    })
    const manualRushing = getCategoryStats('rushing', {
      carries: 'car', yards: 'yds', touchdowns: 'td',
      rushingLong: 'lng', fumbles: 'fum', brokenTackles: 'bt'
    })
    const manualReceiving = getCategoryStats('receiving', {
      receptions: 'rec', yards: 'yds', touchdowns: 'td',
      receivingLong: 'lng', drops: 'drops'
    })
    const manualBlocking = getCategoryStats('blocking', { sacksAllowed: 'sacksAllowed', pancakes: 'pancakes' })
    const manualDefensive = getCategoryStats('defense', {
      soloTackles: 'soloTkl', assistedTackles: 'astTkl',
      tacklesForLoss: 'tfl', sacks: 'sacks', interceptions: 'int',
      intReturnYards: 'intYds', defensiveTDs: 'td',
      deflections: 'pd', forcedFumbles: 'ff', fumbleRecoveries: 'fr'
    })
    const manualKicking = getCategoryStats('kicking', {
      fgMade: 'fgm', fgAttempted: 'fga', fgLong: 'lng',
      xpMade: 'xpm', xpAttempted: 'xpa'
    })
    const manualPunting = getCategoryStats('punting', {
      punts: 'punts', puntingYards: 'yds',
      puntsInside20: 'in20', puntLong: 'lng'
    })
    const manualKickReturn = getCategoryStats('kickReturn', {
      returns: 'ret', returnYardage: 'yds',
      touchdowns: 'td', returnLong: 'lng'
    })
    const manualPuntReturn = getCategoryStats('puntReturn', {
      returns: 'ret', returnYardage: 'yds',
      touchdowns: 'td', returnLong: 'lng'
    })

    // Merge box score stats with manual stats (box score takes priority)
    // Convert box score format to the format expected by the form
    const passing = boxStats?.passing ? {
      completions: boxStats.passing.comp || 0,
      attempts: boxStats.passing.attempts || 0,
      yards: boxStats.passing.yards || 0,
      touchdowns: boxStats.passing.tD || 0,
      interceptions: boxStats.passing.iNT || 0,
      passingLong: boxStats.passing.long || 0,
      sacksTaken: boxStats.passing.sacks || 0
    } : manualPassing

    const rushing = boxStats?.rushing ? {
      carries: boxStats.rushing.carries || 0,
      yards: boxStats.rushing.yards || 0,
      touchdowns: boxStats.rushing.tD || 0,
      rushingLong: boxStats.rushing.long || 0,
      fumbles: boxStats.rushing.fumbles || 0,
      brokenTackles: boxStats.rushing.brokenTackles || 0
    } : manualRushing

    const receiving = boxStats?.receiving ? {
      receptions: boxStats.receiving.receptions || 0,
      yards: boxStats.receiving.yards || 0,
      touchdowns: boxStats.receiving.tD || 0,
      receivingLong: boxStats.receiving.long || 0,
      drops: boxStats.receiving.drops || 0
    } : manualReceiving

    const blocking = boxStats?.blocking ? {
      sacksAllowed: boxStats.blocking.sacksAllowed || 0,
      pancakes: boxStats.blocking.pancakes || 0
    } : manualBlocking

    const defensive = boxStats?.defense ? {
      soloTackles: boxStats.defense.solo || 0,
      assistedTackles: boxStats.defense.assists || 0,
      tacklesForLoss: boxStats.defense.tFL || 0,
      sacks: boxStats.defense.sack || 0,
      interceptions: boxStats.defense.iNT || 0,
      intReturnYards: boxStats.defense.iNTYards || 0,
      defensiveTDs: boxStats.defense.tD || 0,
      deflections: boxStats.defense.deflections || 0,
      forcedFumbles: boxStats.defense.fF || 0,
      fumbleRecoveries: boxStats.defense.fR || 0
    } : manualDefensive

    const kicking = boxStats?.kicking ? {
      fgMade: boxStats.kicking.fGM || 0,
      fgAttempted: boxStats.kicking.fGA || 0,
      fgLong: boxStats.kicking.fGLong || 0,
      xpMade: boxStats.kicking.xPM || 0,
      xpAttempted: boxStats.kicking.xPA || 0
    } : manualKicking

    const punting = boxStats?.punting ? {
      punts: boxStats.punting.punts || 0,
      puntingYards: boxStats.punting.yards || 0,
      puntsInside20: boxStats.punting.in20 || 0,
      puntLong: boxStats.punting.long || 0
    } : manualPunting

    const kickReturn = boxStats?.kickReturn ? {
      returns: boxStats.kickReturn.kR || 0,
      returnYardage: boxStats.kickReturn.yards || 0,
      touchdowns: boxStats.kickReturn.tD || 0,
      returnLong: boxStats.kickReturn.long || 0
    } : manualKickReturn

    const puntReturn = boxStats?.puntReturn ? {
      returns: boxStats.puntReturn.pR || 0,
      returnYardage: boxStats.puntReturn.yards || 0,
      touchdowns: boxStats.puntReturn.tD || 0,
      returnLong: boxStats.puntReturn.long || 0
    } : manualPuntReturn

    return {
      gamesPlayed: boxStats?.gamesWithStats || playerYearStats.gamesPlayed || 0,
      snapsPlayed: playerYearStats.snapsPlayed || 0,
      fromBoxScores: !!boxStats,
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

      // Helper to split name into first and last
      const splitName = (fullName) => {
        if (!fullName) return { firstName: '', lastName: '' }
        const parts = fullName.trim().split(/\s+/)
        if (parts.length === 1) return { firstName: parts[0], lastName: '' }
        return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
      }
      const { firstName: derivedFirst, lastName: derivedLast } = splitName(player.name)

      // Check if player is in playersLeavingByYear (for backwards compatibility)
      let leavingYearFromList = player.leavingYear || ''
      let leavingReasonFromList = player.leavingReason || ''
      if (!leavingYearFromList && dynasty?.playersLeavingByYear) {
        // Search all years for this player
        Object.entries(dynasty.playersLeavingByYear).forEach(([year, players]) => {
          const found = players?.find(p => p.pid === player.pid || p.playerName === player.name)
          if (found) {
            leavingYearFromList = parseInt(year)
            leavingReasonFromList = found.reason || ''
          }
        })
      }

      // Check if player has a transfer destination (from player record or transferDestinationsByYear)
      let transferDestination = player.transferredTo || ''
      if (!transferDestination && dynasty?.transferDestinationsByYear) {
        Object.values(dynasty.transferDestinationsByYear).forEach(destinations => {
          const found = destinations?.find(d =>
            d.playerName?.toLowerCase().trim() === player.name?.toLowerCase().trim()
          )
          if (found?.newTeam) {
            transferDestination = found.newTeam
          }
        })
      }

      setFormData({
        // Basic Info
        pictureUrl: player.pictureUrl || '',
        firstName: player.firstName || derivedFirst || '',
        lastName: player.lastName || derivedLast || '',
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
        recruitYear: player.recruitYear || '',
        stars: player.stars || 0,
        positionRank: player.positionRank || 0,
        stateRank: player.stateRank || 0,
        nationalRank: player.nationalRank || 0,

        // Development
        gemBust: player.gemBust || '',
        overallProgression: player.overallProgression || 0,
        overallRatingChange: player.overallRatingChange || 0,

        // Player Status Flags
        isRecruit: player.isRecruit || false,
        isPortal: player.isPortal || false,

        // Game Logs (for selected year)
        snapsPlayed: yearStats.snapsPlayed,
        gamesPlayed: yearStats.gamesPlayed,

        // Pending Departure (before season advances) - check player record OR playersLeavingByYear
        leavingYear: leavingYearFromList,
        leavingReason: leavingReasonFromList,
        transferredTo: transferDestination,

        // Departure (after season advances)
        leftTeam: player.leftTeam || false,
        yearDeparted: player.yearDeparted || '',
        yearsInSchool: player.yearsInSchool || 0,
        leftReason: player.leftReason || '',
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
        links: player.links || [],

        // Roster History - which team this player was on each year
        teamsByYear: player.teamsByYear || {},
        // Class History - what class this player was each year
        classByYear: player.classByYear || {}
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

    // Build stats for the selected year (using INTERNAL format keys)
    const yearStats = {
      year: selectedStatsYear,
      gamesPlayed: num(formData.gamesPlayed),
      snapsPlayed: num(formData.snapsPlayed),
      passing: {
        cmp: num(formData.passing_completions),
        att: num(formData.passing_attempts),
        yds: num(formData.passing_yards),
        td: num(formData.passing_touchdowns),
        int: num(formData.passing_interceptions),
        lng: num(formData.passing_passingLong),
        sacks: num(formData.passing_sacksTaken)
      },
      rushing: {
        car: num(formData.rushing_carries),
        yds: num(formData.rushing_yards),
        td: num(formData.rushing_touchdowns),
        lng: num(formData.rushing_rushingLong),
        fum: num(formData.rushing_fumbles),
        bt: num(formData.rushing_brokenTackles)
      },
      receiving: {
        rec: num(formData.receiving_receptions),
        yds: num(formData.receiving_yards),
        td: num(formData.receiving_touchdowns),
        lng: num(formData.receiving_receivingLong),
        drops: num(formData.receiving_drops)
      },
      blocking: {
        sacksAllowed: num(formData.blocking_sacksAllowed),
        pancakes: num(formData.blocking_pancakes)
      },
      defense: {
        soloTkl: num(formData.defensive_soloTackles),
        astTkl: num(formData.defensive_assistedTackles),
        tfl: num(formData.defensive_tacklesForLoss),
        sacks: num(formData.defensive_sacks),
        int: num(formData.defensive_interceptions),
        intYds: num(formData.defensive_intReturnYards),
        td: num(formData.defensive_defensiveTDs),
        pd: num(formData.defensive_deflections),
        ff: num(formData.defensive_forcedFumbles),
        fr: num(formData.defensive_fumbleRecoveries)
      },
      kicking: {
        fgm: num(formData.kicking_fgMade),
        fga: num(formData.kicking_fgAttempted),
        lng: num(formData.kicking_fgLong),
        xpm: num(formData.kicking_xpMade),
        xpa: num(formData.kicking_xpAttempted)
      },
      punting: {
        punts: num(formData.punting_punts),
        yds: num(formData.punting_puntingYards),
        in20: num(formData.punting_puntsInside20),
        lng: num(formData.punting_puntLong)
      },
      kickReturn: {
        ret: num(formData.kickReturn_returns),
        yds: num(formData.kickReturn_returnYardage),
        td: num(formData.kickReturn_touchdowns),
        lng: num(formData.kickReturn_returnLong)
      },
      puntReturn: {
        ret: num(formData.puntReturn_returns),
        yds: num(formData.puntReturn_returnYardage),
        td: num(formData.puntReturn_touchdowns),
        lng: num(formData.puntReturn_returnLong)
      }
    }

    const updatedPlayer = {
      ...player,
      pictureUrl: formData.pictureUrl,
      firstName: formData.firstName,
      lastName: formData.lastName,
      name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim(),
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
      recruitYear: formData.recruitYear ? num(formData.recruitYear) : null,
      stars: num(formData.stars),
      positionRank: num(formData.positionRank),
      stateRank: num(formData.stateRank),
      nationalRank: num(formData.nationalRank),
      gemBust: formData.gemBust,
      overallProgression: formData.overallProgression,
      overallRatingChange: formData.overallRatingChange,
      leavingYear: formData.leavingYear ? num(formData.leavingYear) : null,
      leavingReason: formData.leavingReason,
      transferredTo: formData.transferredTo || null,
      leftTeam: formData.leftTeam,
      yearDeparted: formData.yearDeparted,
      yearsInSchool: num(formData.yearsInSchool),
      leftReason: formData.leftReason,
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
      links: formData.links,
      // Roster History - which team this player was on each year
      teamsByYear: formData.teamsByYear,
      // Class History - what class this player was each year
      classByYear: formData.classByYear,
      // Status flags
      isRecruit: formData.isRecruit,
      isPortal: formData.isPortal
    }

    // Pass both player info and year-specific stats
    onSave(updatedPlayer, yearStats)
  }

  if (!isOpen) return null

  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)

  const positions = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS', 'K', 'P']
  const classes = ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr']
  const devTraits = ['Elite', 'Star', 'Impact', 'Normal']
  const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']

  const archetypeOptions = [
    'Backfield Creator', 'Dual Threat', 'Pocket Passer', 'Pure Runner',
    'Backfield Threat', 'East/West Playmaker', 'Elusive Bruiser', 'North/South Receiver', 'North/South Blocker',
    'Blocking', 'Utility',
    'Contested Specialist', 'Elusive Route Runner', 'Gadget', 'Gritty Possession', 'Physical Route Runner', 'Route Artist', 'Speedster',
    'Possession', 'Pure Blocker', 'Pure Possession', 'Vertical Threat',
    'Agile', 'Pass Protector', 'Raw Strength', 'Ground and Pound', 'Well Rounded',
    'Edge Setter', 'Gap Specialist', 'Power Rusher', 'Pure Power', 'Speed Rusher',
    'Lurker', 'Signal Caller', 'Thumper',
    'Boundary', 'Bump and Run', 'Field', 'Zone',
    'Box Specialist', 'Coverage Specialist', 'Hybrid',
    'Accurate', 'Power'
  ]

  const inputStyle = {
    borderColor: `${teamColors.primary}40`,
    backgroundColor: '#ffffff',
    color: '#1f2937'
  }

  const labelStyle = { color: secondaryText, opacity: 0.7 }

  // Check if section is expanded
  const isExpanded = (id) => expandedSections.includes(id)

  // Render a collapsible section header
  const renderSectionHeader = (id, title) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full px-4 py-3 flex items-center justify-between transition-colors rounded-lg"
      style={{ backgroundColor: isExpanded(id) ? teamColors.primary : `${teamColors.primary}15` }}
    >
      <span className="font-bold" style={{ color: isExpanded(id) ? primaryText : teamColors.primary }}>{title}</span>
      <svg
        className={`w-5 h-5 transition-transform ${isExpanded(id) ? 'rotate-180' : ''}`}
        fill="none"
        stroke={isExpanded(id) ? primaryText : teamColors.primary}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] py-8 px-4 sm:p-4 overflow-y-auto"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-3xl my-auto flex flex-col"
        style={{ backgroundColor: teamColors.secondary, maxHeight: 'calc(100vh - 4rem)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex flex-col max-h-full overflow-hidden">
          {/* Header */}
          <div
            className="px-4 sm:px-6 py-4 flex-shrink-0"
            style={{ backgroundColor: teamColors.primary }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Clickable image/placeholder for quick upload */}
                <button
                  type="button"
                  onClick={() => setShowQuickImageModal(true)}
                  className="relative group"
                  title="Click to add/change photo"
                >
                  {formData.pictureUrl ? (
                    <img
                      src={formData.pictureUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover border-2 group-hover:opacity-80 transition-opacity"
                      style={{ borderColor: teamColors.secondary }}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center group-hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: `${teamColors.secondary}30` }}
                    >
                      <svg className="w-6 h-6" fill="none" stroke={primaryText} viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                  )}
                  {/* Camera overlay icon - only show when no image */}
                  {!formData.pictureUrl && (
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: teamColors.secondary }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke={secondaryText} viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </div>
                  )}
                </button>
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
                <span className="text-sm font-medium" style={{ color: primaryText }}>Stats Year:</span>
                <select
                  value={selectedStatsYear || ''}
                  onChange={(e) => handleYearChange(parseInt(e.target.value))}
                  className="px-3 py-1.5 rounded-lg font-bold text-sm"
                  style={{ backgroundColor: teamColors.secondary, color: secondaryText }}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs" style={{ color: primaryText, opacity: 0.8 }}>
                Stats apply to selected season
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* Basic Information */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('basic', 'Basic Information')}
              {isExpanded('basic') && (
                <div className="p-4 space-y-4" style={{ backgroundColor: teamColors.secondary }}>
                  {/* Player Picture */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Player Picture</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="pictureUrl"
                        value={formData.pictureUrl ?? ''}
                        onChange={handleChange}
                        onPaste={handlePaste}
                        placeholder="Paste image here (Ctrl+V) or enter URL..."
                        className="flex-1 px-3 py-2.5 rounded-lg border-2 text-sm"
                        style={inputStyle}
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-3 py-2.5 rounded-lg border-2 text-sm font-medium flex items-center gap-1.5 whitespace-nowrap"
                        style={{
                          backgroundColor: teamColors.primary,
                          color: getContrastTextColor(teamColors.primary),
                          borderColor: teamColors.primary,
                          opacity: uploading ? 0.7 : 1,
                          cursor: uploading ? 'wait' : 'pointer'
                        }}
                      >
                        {uploading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Upload
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>First Name</label>
                      <input type="text" name="firstName" value={formData.firstName ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Last Name</label>
                      <input type="text" name="lastName" value={formData.lastName ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Jersey #</label>
                      <input type="text" name="jerseyNumber" value={formData.jerseyNumber ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Overall</label>
                      <input type="text" name="overall" value={formData.overall ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Position</label>
                      <select name="position" value={formData.position ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                        <option value="">Select...</option>
                        {positions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Archetype</label>
                      <select name="archetype" value={formData.archetype ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                        <option value="">Select...</option>
                        {archetypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Class</label>
                      <select name="year" value={formData.year ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                        <option value="">Select...</option>
                        {classes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Dev Trait</label>
                      <select name="devTrait" value={formData.devTrait ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                        <option value="">Select...</option>
                        {devTraits.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Height</label>
                      <input type="text" name="height" value={formData.height ?? ''} onChange={handleChange} placeholder="6'2&quot;" className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Weight</label>
                      <input type="text" name="weight" value={formData.weight ?? ''} onChange={handleChange} placeholder="220" className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Hometown</label>
                      <input type="text" name="hometown" value={formData.hometown ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>State</label>
                      <select name="state" value={formData.state ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                        <option value="">Select...</option>
                        {states.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recruiting & Development */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('recruiting', 'Recruiting & Development')}
              {isExpanded('recruiting') && (
                <div className="p-4 space-y-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Class Year</label>
                      <input type="text" name="recruitYear" value={formData.recruitYear ?? ''} onChange={handleChange} placeholder="2025" className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Stars</label>
                      <input type="text" name="stars" value={formData.stars ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Pos Rank</label>
                      <input type="text" name="positionRank" value={formData.positionRank ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>State Rank</label>
                      <input type="text" name="stateRank" value={formData.stateRank ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nat'l Rank</label>
                      <input type="text" name="nationalRank" value={formData.nationalRank ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Gem/Bust</label>
                      <select name="gemBust" value={formData.gemBust ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                        <option value="">Neither</option>
                        <option value="Gem">Gem</option>
                        <option value="Bust">Bust</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>OVR Progression</label>
                      <input type="text" name="overallProgression" value={formData.overallProgression ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>OVR Change</label>
                      <input type="text" name="overallRatingChange" value={formData.overallRatingChange ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Transfer From</label>
                      <input type="text" name="previousTeam" value={formData.previousTeam ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                  <div className="flex gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isRecruit"
                        checked={formData.isRecruit || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, isRecruit: e.target.checked }))}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm" style={labelStyle}>Is Recruit (not yet enrolled)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isPortal"
                        checked={formData.isPortal || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, isPortal: e.target.checked }))}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm" style={labelStyle}>Is Portal Transfer</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Accolades */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('accolades', 'Accolades')}
              {isExpanded('accolades') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Conf POW</label>
                      <input type="text" name="confPOW" value={formData.confPOW ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nat'l POW</label>
                      <input type="text" name="nationalPOW" value={formData.nationalPOW ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>All-Conf 1st</label>
                      <input type="text" name="allConf1st" value={formData.allConf1st ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>All-Conf 2nd</label>
                      <input type="text" name="allConf2nd" value={formData.allConf2nd ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>All-Am 1st</label>
                      <input type="text" name="allAm1st" value={formData.allAm1st ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>All-Am 2nd</label>
                      <input type="text" name="allAm2nd" value={formData.allAm2nd ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Fr All-Conf</label>
                      <input type="text" name="allConfFr" value={formData.allConfFr ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Fr All-Am</label>
                      <input type="text" name="allAmFr" value={formData.allAmFr ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Departure */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('departure', 'Departure')}
              {isExpanded('departure') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  {/* Show different UI based on whether player has already left */}
                  {formData.leftTeam ? (
                    /* Player has already left - show summary with edit options */
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>
                            Player Has Left Team
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                            Not on active roster
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, leftTeam: false, leftReason: '', yearDeparted: '' }))}
                          className="text-xs px-2 py-1 rounded hover:bg-red-200 transition-colors"
                          style={{ color: '#dc2626' }}
                        >
                          Undo
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Year Left</label>
                          <input type="text" name="yearDeparted" value={formData.yearDeparted ?? ''} onChange={handleChange} placeholder="2026" className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Reason</label>
                          <select name="leftReason" value={formData.leftReason ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                            <option value="">Select...</option>
                            <option value="Graduating">Graduating</option>
                            <option value="Pro Draft">Pro Draft</option>
                            <option value="Playing Style">Transfer - Playing Style</option>
                            <option value="Playing Time">Transfer - Playing Time</option>
                            <option value="Proximity to Home">Transfer - Proximity to Home</option>
                            <option value="Championship Contender">Transfer - Championship Contender</option>
                            <option value="Program Tradition">Transfer - Program Tradition</option>
                            <option value="Campus Lifestyle">Transfer - Campus Lifestyle</option>
                            <option value="Stadium Atmosphere">Transfer - Stadium Atmosphere</option>
                            <option value="Pro Potential">Transfer - Pro Potential</option>
                            <option value="Brand Exposure">Transfer - Brand Exposure</option>
                            <option value="Academic Prestige">Transfer - Academic Prestige</option>
                            <option value="Conference Prestige">Transfer - Conference Prestige</option>
                            <option value="Coach Stability">Transfer - Coach Stability</option>
                            <option value="Coach Prestige">Transfer - Coach Prestige</option>
                            <option value="Athletic Facilities">Transfer - Athletic Facilities</option>
                          </select>
                        </div>
                      </div>
                      {/* Show Transferred To for transfers, Draft Round for Pro Draft */}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {formData.leftReason && !['Graduating', 'Pro Draft'].includes(formData.leftReason) && (
                          <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Transferred To</label>
                            <select name="transferredTo" value={formData.transferredTo ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                              <option value="">Select team...</option>
                              {getTeamAbbreviationsList().map(abbr => (
                                <option key={abbr} value={abbr}>{abbr}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {formData.leftReason === 'Pro Draft' && (
                          <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Draft Round</label>
                            <select name="draftRound" value={formData.draftRound ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                              <option value="">Select...</option>
                              <option value="1st Round">1st Round</option>
                              <option value="2nd Round">2nd Round</option>
                              <option value="3rd Round">3rd Round</option>
                              <option value="4th Round">4th Round</option>
                              <option value="5th Round">5th Round</option>
                              <option value="6th Round">6th Round</option>
                              <option value="7th Round">7th Round</option>
                              <option value="Undrafted">Undrafted</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Player still on team - show Mark as Leaving option */
                    <div className="p-3 rounded-lg" style={{ backgroundColor: formData.leavingYear ? 'rgba(251, 146, 60, 0.15)' : 'rgba(0,0,0,0.05)' }}>
                      <div className="text-xs font-semibold mb-2" style={{ color: formData.leavingYear ? '#ea580c' : teamColors.primaryText }}>
                        Mark as Leaving
                      </div>
                      <p className="text-xs mb-3" style={{ color: secondaryText, opacity: 0.7 }}>
                        Set the year and reason if this player is leaving. They will appear in Transfer Destinations and be removed from the roster when you advance to the next season.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Leaving Year</label>
                          <input
                            type="text"
                            name="leavingYear"
                            value={formData.leavingYear ?? ''}
                            onChange={handleChange}
                            placeholder={dynasty?.currentYear?.toString() || '2025'}
                            className="w-full px-3 py-2.5 rounded-lg border-2 text-sm"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Reason</label>
                          <select name="leavingReason" value={formData.leavingReason ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                            <option value="">Select...</option>
                            <option value="Graduating">Graduating</option>
                            <option value="Pro Draft">Pro Draft</option>
                            <option value="Playing Style">Transfer - Playing Style</option>
                            <option value="Playing Time">Transfer - Playing Time</option>
                            <option value="Proximity to Home">Transfer - Proximity to Home</option>
                            <option value="Championship Contender">Transfer - Championship Contender</option>
                            <option value="Program Tradition">Transfer - Program Tradition</option>
                            <option value="Campus Lifestyle">Transfer - Campus Lifestyle</option>
                            <option value="Stadium Atmosphere">Transfer - Stadium Atmosphere</option>
                            <option value="Pro Potential">Transfer - Pro Potential</option>
                            <option value="Brand Exposure">Transfer - Brand Exposure</option>
                            <option value="Academic Prestige">Transfer - Academic Prestige</option>
                            <option value="Conference Prestige">Transfer - Conference Prestige</option>
                            <option value="Coach Stability">Transfer - Coach Stability</option>
                            <option value="Coach Prestige">Transfer - Coach Prestige</option>
                            <option value="Athletic Facilities">Transfer - Athletic Facilities</option>
                          </select>
                        </div>
                      </div>
                      {/* Show Transferred To for transfer reasons */}
                      {formData.leavingReason && !['Graduating', 'Pro Draft'].includes(formData.leavingReason) && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Transferred To</label>
                          <select name="transferredTo" value={formData.transferredTo ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle}>
                            <option value="">Select team...</option>
                            {getTeamAbbreviationsList().map(abbr => (
                              <option key={abbr} value={abbr}>{abbr}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {formData.leavingYear && formData.leavingReason && (
                        <div className="mt-2 text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 inline-block">
                          Will leave after {formData.leavingYear} season
                          {formData.transferredTo && ` → ${formData.transferredTo}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Roster History - which team this player was on each season */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('rosterHistory', 'Roster History')}
              {isExpanded('rosterHistory') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <p className="text-xs mb-3" style={{ color: secondaryText, opacity: 0.7 }}>
                    Edit which team and class this player was for each season. This determines roster membership and class history.
                  </p>
                  <div className="space-y-2">
                    {/* Show existing years */}
                    {Object.entries(formData.teamsByYear || {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([year, team]) => (
                      <div key={year} className="flex items-center gap-2">
                        <span className="text-sm font-medium w-12" style={{ color: secondaryText }}>{year}</span>
                        <select
                          value={team || ''}
                          onChange={(e) => {
                            const newTeamsByYear = { ...formData.teamsByYear }
                            if (e.target.value) {
                              newTeamsByYear[year] = e.target.value
                            } else {
                              delete newTeamsByYear[year]
                            }
                            setFormData(prev => ({ ...prev, teamsByYear: newTeamsByYear }))
                          }}
                          className="flex-1 px-2 py-2 rounded-lg border-2 text-sm"
                          style={inputStyle}
                        >
                          <option value="">(Not on roster)</option>
                          {getTeamAbbreviationsList().map(abbr => (
                            <option key={abbr} value={abbr}>{abbr}</option>
                          ))}
                        </select>
                        <select
                          value={formData.classByYear?.[year] || ''}
                          onChange={(e) => {
                            const newClassByYear = { ...formData.classByYear }
                            if (e.target.value) {
                              newClassByYear[year] = e.target.value
                            } else {
                              delete newClassByYear[year]
                            }
                            setFormData(prev => ({ ...prev, classByYear: newClassByYear }))
                          }}
                          className="w-20 px-2 py-2 rounded-lg border-2 text-sm"
                          style={inputStyle}
                        >
                          <option value="">Class</option>
                          {classes.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const newTeamsByYear = { ...formData.teamsByYear }
                            const newClassByYear = { ...formData.classByYear }
                            delete newTeamsByYear[year]
                            delete newClassByYear[year]
                            setFormData(prev => ({ ...prev, teamsByYear: newTeamsByYear, classByYear: newClassByYear }))
                          }}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: '#EF4444', color: '#fff' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {/* Add new year */}
                    <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: `${teamColors.primary}30` }}>
                      <input
                        type="number"
                        placeholder="Year"
                        className="w-16 px-2 py-2 rounded-lg border-2 text-sm"
                        style={inputStyle}
                        id="newRosterYear"
                      />
                      <select
                        className="flex-1 px-2 py-2 rounded-lg border-2 text-sm"
                        style={inputStyle}
                        id="newRosterTeam"
                      >
                        <option value="">Team...</option>
                        {getTeamAbbreviationsList().map(abbr => (
                          <option key={abbr} value={abbr}>{abbr}</option>
                        ))}
                      </select>
                      <select
                        className="w-20 px-2 py-2 rounded-lg border-2 text-sm"
                        style={inputStyle}
                        id="newRosterClass"
                      >
                        <option value="">Class</option>
                        {classes.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const yearInput = document.getElementById('newRosterYear')
                          const teamSelect = document.getElementById('newRosterTeam')
                          const classSelect = document.getElementById('newRosterClass')
                          const year = yearInput?.value
                          const team = teamSelect?.value
                          const playerClass = classSelect?.value
                          if (year && team) {
                            setFormData(prev => ({
                              ...prev,
                              teamsByYear: { ...prev.teamsByYear, [year]: team },
                              classByYear: playerClass ? { ...prev.classByYear, [year]: playerClass } : prev.classByYear
                            }))
                            yearInput.value = ''
                            teamSelect.value = ''
                            classSelect.value = ''
                          }
                        }}
                        className="px-3 py-2 rounded-lg text-sm font-medium"
                        style={{ backgroundColor: teamColors.primary, color: primaryText }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Game Log */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('gamelog', `Game Log (${selectedStatsYear})`)}
              {isExpanded('gamelog') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Games Played</label>
                      <input type="text" name="gamesPlayed" value={formData.gamesPlayed ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Snaps Played</label>
                      <input type="text" name="snapsPlayed" value={formData.snapsPlayed ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Passing Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('passing', `Passing (${selectedStatsYear})`)}
              {isExpanded('passing') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Completions</label>
                      <input type="text" name="passing_completions" value={formData.passing_completions ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Attempts</label>
                      <input type="text" name="passing_attempts" value={formData.passing_attempts ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Yards</label>
                      <input type="text" name="passing_yards" value={formData.passing_yards ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>TDs</label>
                      <input type="text" name="passing_touchdowns" value={formData.passing_touchdowns ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>INTs</label>
                      <input type="text" name="passing_interceptions" value={formData.passing_interceptions ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Long</label>
                      <input type="text" name="passing_passingLong" value={formData.passing_passingLong ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Sacks</label>
                      <input type="text" name="passing_sacksTaken" value={formData.passing_sacksTaken ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rushing Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('rushing', `Rushing (${selectedStatsYear})`)}
              {isExpanded('rushing') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Carries</label>
                      <input type="text" name="rushing_carries" value={formData.rushing_carries ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Yards</label>
                      <input type="text" name="rushing_yards" value={formData.rushing_yards ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>TDs</label>
                      <input type="text" name="rushing_touchdowns" value={formData.rushing_touchdowns ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Long</label>
                      <input type="text" name="rushing_rushingLong" value={formData.rushing_rushingLong ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Fumbles</label>
                      <input type="text" name="rushing_fumbles" value={formData.rushing_fumbles ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Broken Tackles</label>
                      <input type="text" name="rushing_brokenTackles" value={formData.rushing_brokenTackles ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Receiving Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('receiving', `Receiving (${selectedStatsYear})`)}
              {isExpanded('receiving') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Receptions</label>
                      <input type="text" name="receiving_receptions" value={formData.receiving_receptions ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Yards</label>
                      <input type="text" name="receiving_yards" value={formData.receiving_yards ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>TDs</label>
                      <input type="text" name="receiving_touchdowns" value={formData.receiving_touchdowns ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Long</label>
                      <input type="text" name="receiving_receivingLong" value={formData.receiving_receivingLong ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Drops</label>
                      <input type="text" name="receiving_drops" value={formData.receiving_drops ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Blocking Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('blocking', `Blocking (${selectedStatsYear})`)}
              {isExpanded('blocking') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Sacks Allowed</label>
                      <input type="text" name="blocking_sacksAllowed" value={formData.blocking_sacksAllowed ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Defensive Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('defensive', `Defense (${selectedStatsYear})`)}
              {isExpanded('defensive') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Solo Tackles</label>
                      <input type="text" name="defensive_soloTackles" value={formData.defensive_soloTackles ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Asst Tackles</label>
                      <input type="text" name="defensive_assistedTackles" value={formData.defensive_assistedTackles ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>TFL</label>
                      <input type="text" name="defensive_tacklesForLoss" value={formData.defensive_tacklesForLoss ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Sacks</label>
                      <input type="text" name="defensive_sacks" value={formData.defensive_sacks ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>INTs</label>
                      <input type="text" name="defensive_interceptions" value={formData.defensive_interceptions ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>INT Yards</label>
                      <input type="text" name="defensive_intReturnYards" value={formData.defensive_intReturnYards ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Def TDs</label>
                      <input type="text" name="defensive_defensiveTDs" value={formData.defensive_defensiveTDs ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Pass Def</label>
                      <input type="text" name="defensive_deflections" value={formData.defensive_deflections ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Forced Fum</label>
                      <input type="text" name="defensive_forcedFumbles" value={formData.defensive_forcedFumbles ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Fum Rec</label>
                      <input type="text" name="defensive_fumbleRecoveries" value={formData.defensive_fumbleRecoveries ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Kicking Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('kicking', `Kicking (${selectedStatsYear})`)}
              {isExpanded('kicking') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>FG Made</label>
                      <input type="text" name="kicking_fgMade" value={formData.kicking_fgMade ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>FG Att</label>
                      <input type="text" name="kicking_fgAttempted" value={formData.kicking_fgAttempted ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>FG Long</label>
                      <input type="text" name="kicking_fgLong" value={formData.kicking_fgLong ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>XP Made</label>
                      <input type="text" name="kicking_xpMade" value={formData.kicking_xpMade ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>XP Att</label>
                      <input type="text" name="kicking_xpAttempted" value={formData.kicking_xpAttempted ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Punting Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('punting', `Punting (${selectedStatsYear})`)}
              {isExpanded('punting') && (
                <div className="p-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Punts</label>
                      <input type="text" name="punting_punts" value={formData.punting_punts ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Yards</label>
                      <input type="text" name="punting_puntingYards" value={formData.punting_puntingYards ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Inside 20</label>
                      <input type="text" name="punting_puntsInside20" value={formData.punting_puntsInside20 ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Long</label>
                      <input type="text" name="punting_puntLong" value={formData.punting_puntLong ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Returns Stats */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('returns', `Returns (${selectedStatsYear})`)}
              {isExpanded('returns') && (
                <div className="p-4 space-y-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div>
                    <p className="text-xs font-medium mb-2" style={labelStyle}>Kick Returns</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Returns</label>
                        <input type="text" name="kickReturn_returns" value={formData.kickReturn_returns ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Yards</label>
                        <input type="text" name="kickReturn_returnYardage" value={formData.kickReturn_returnYardage ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>TDs</label>
                        <input type="text" name="kickReturn_touchdowns" value={formData.kickReturn_touchdowns ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Long</label>
                        <input type="text" name="kickReturn_returnLong" value={formData.kickReturn_returnLong ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-2" style={labelStyle}>Punt Returns</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Returns</label>
                        <input type="text" name="puntReturn_returns" value={formData.puntReturn_returns ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Yards</label>
                        <input type="text" name="puntReturn_returnYardage" value={formData.puntReturn_returnYardage ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>TDs</label>
                        <input type="text" name="puntReturn_touchdowns" value={formData.puntReturn_touchdowns ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Long</label>
                        <input type="text" name="puntReturn_returnLong" value={formData.puntReturn_returnLong ?? ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border-2 text-sm" style={inputStyle} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes & Media */}
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${teamColors.primary}` }}>
              {renderSectionHeader('notes', 'Notes & Media')}
              {isExpanded('notes') && (
                <div className="p-4 space-y-4" style={{ backgroundColor: teamColors.secondary }}>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes ?? ''}
                      onChange={handleChange}
                      placeholder="Add notes about this player..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border-2 text-sm resize-y"
                      style={inputStyle}
                    />
                  </div>

                  {/* Links */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={labelStyle}>Links</label>
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
                              style={inputStyle}
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
                              style={inputStyle}
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
              )}
            </div>

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

      {/* Quick Image Upload Modal */}
      {showQuickImageModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4"
          style={{ margin: 0 }}
          onClick={() => setShowQuickImageModal(false)}
        >
          <div
            className="rounded-xl max-w-sm w-full overflow-hidden shadow-2xl"
            style={{ backgroundColor: teamColors.secondary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4" style={{ backgroundColor: teamColors.primary }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold" style={{ color: primaryText }}>
                  {formData.pictureUrl ? 'Change Photo' : 'Add Photo'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuickImageModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10"
                  style={{ color: primaryText }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Current image preview */}
              {formData.pictureUrl && (
                <div className="flex justify-center">
                  <img
                    src={formData.pictureUrl}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-4"
                    style={{ borderColor: teamColors.primary }}
                  />
                </div>
              )}

              {/* Paste area */}
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-text"
                style={{ borderColor: teamColors.primary }}
                tabIndex={0}
                onPaste={async (e) => {
                  const items = e.clipboardData?.items
                  if (!items) return
                  for (const item of items) {
                    if (item.type.startsWith('image/')) {
                      e.preventDefault()
                      const file = item.getAsFile()
                      if (file) {
                        const url = await uploadToImgBB(file)
                        if (url) {
                          setFormData(prev => ({ ...prev, pictureUrl: url }))
                          setShowQuickImageModal(false)
                        }
                      }
                      return
                    }
                  }
                }}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin h-8 w-8" style={{ color: teamColors.primary }} viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: secondaryText }}>Uploading...</p>
                  </div>
                ) : (
                  <>
                    <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke={teamColors.primary} viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
                    </svg>
                    <p className="text-sm font-medium mb-1" style={{ color: secondaryText }}>
                      Click here and paste image (Ctrl+V)
                    </p>
                    <p className="text-xs" style={{ color: secondaryText, opacity: 0.7 }}>
                      Works with screenshots & copied images
                    </p>
                  </>
                )}
              </div>

              {/* Or divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: `${teamColors.primary}30` }} />
                <span className="text-xs font-medium" style={{ color: secondaryText, opacity: 0.7 }}>or</span>
                <div className="flex-1 h-px" style={{ backgroundColor: `${teamColors.primary}30` }} />
              </div>

              {/* File upload button */}
              <input
                type="file"
                ref={quickFileInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (!file.type.startsWith('image/')) {
                    alert('Please select an image file')
                    return
                  }
                  if (file.size > 32 * 1024 * 1024) {
                    alert('Image must be less than 32MB')
                    return
                  }
                  const url = await uploadToImgBB(file)
                  if (url) {
                    setFormData(prev => ({ ...prev, pictureUrl: url }))
                    setShowQuickImageModal(false)
                  }
                  e.target.value = ''
                }}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => quickFileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                style={{
                  backgroundColor: teamColors.primary,
                  color: primaryText,
                  opacity: uploading ? 0.7 : 1
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Choose from Device
              </button>

              {/* Remove photo button if exists */}
              {formData.pictureUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, pictureUrl: '' }))
                    setShowQuickImageModal(false)
                  }}
                  className="w-full py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
