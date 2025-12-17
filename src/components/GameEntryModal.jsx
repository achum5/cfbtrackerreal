import { useState, useEffect, useRef } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { getTeamLogo } from '../data/teams'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../data/teamAbbreviations'
import { getTeamConference } from '../data/conferenceTeams'

export default function GameEntryModal({ isOpen, onClose, onSave, weekNumber, currentYear, teamColors, opponent: passedOpponent, isConferenceChampionship, existingGame: passedExistingGame, bowlName }) {
  const { currentDynasty } = useDynasty()

  // CRITICAL FIX: If in regular season but weekNumber is 0, use week 1
  // This handles cases where dynasty phase transitioned but week didn't update correctly
  const actualWeekNumber = isConferenceChampionship ? 'CC' : (currentDynasty?.currentPhase === 'regular_season' && weekNumber === 0 ? 1 : weekNumber)

  // Find the scheduled game for this week (not for CC games)
  const scheduledGame = isConferenceChampionship ? null : currentDynasty?.schedule?.find(g => g.week === actualWeekNumber)

  // Map abbreviations to mascot names for logo lookup
  const getMascotName = (abbr) => {
    const mascotMap = {
      'AFA': 'Air Force Falcons',
      'AKR': 'Akron Zips',
      'APP': 'Appalachian State Mountaineers',
      'ARIZ': 'Arizona Wildcats',
      'ARK': 'Arkansas Razorbacks',
      'ARMY': 'Army Black Knights',
      'ARST': 'Arkansas State Red Wolves',
      'ASU': 'Arizona State Sun Devils',
      'AUB': 'Auburn Tigers',
      'BALL': 'Ball State Cardinals',
      'BAMA': 'Alabama Crimson Tide',
      'BC': 'Boston College Eagles',
      'BGSU': 'Bowling Green Falcons',
      'BOIS': 'Boise State Broncos',
      'BU': 'Baylor Bears',
      'BUFF': 'Buffalo Bulls',
      'BYU': 'Brigham Young Cougars',
      'CAL': 'California Golden Bears',
      'CCU': 'Coastal Carolina Chanticleers',
      'CHAR': 'Charlotte 49ers',
      'CLEM': 'Clemson Tigers',
      'CMU': 'Central Michigan Chippewas',
      'COLO': 'Colorado Buffaloes',
      'CONN': 'Connecticut Huskies',
      'CSU': 'Colorado State Rams',
      'DUKE': 'Duke Blue Devils',
      'ECU': 'East Carolina Pirates',
      'EMU': 'Eastern Michigan Eagles',
      'FIU': 'Florida International Panthers',
      'FSU': 'Florida State Seminoles',
      'FAU': 'Florida Atlantic Owls',
      'FRES': 'Fresno State Bulldogs',
      'UF': 'Florida Gators',
      'GASO': 'Georgia Southern Eagles',
      'GAST': 'Georgia State Panthers',
      'GT': 'Georgia Tech Yellow Jackets',
      'UGA': 'Georgia Bulldogs',
      'HAW': 'Hawaii Rainbow Warriors',
      'HOU': 'Houston Cougars',
      'ILL': 'Illinois Fighting Illini',
      'IU': 'Indiana Hoosiers',
      'IOWA': 'Iowa Hawkeyes',
      'ISU': 'Iowa State Cyclones',
      'JKST': 'Jacksonville State Gamecocks',
      'JMU': 'James Madison Dukes',
      'KU': 'Kansas Jayhawks',
      'KSU': 'Kansas State Wildcats',
      'KENT': 'Kent State Golden Flashes',
      'UK': 'Kentucky Wildcats',
      'LIB': 'Liberty Flames',
      'ULL': 'Lafayette Ragin\' Cajuns',
      'LT': 'Louisiana Tech Bulldogs',
      'LOU': 'Louisville Cardinals',
      'LSU': 'LSU Tigers',
      'UM': 'Miami Hurricanes',
      'M-OH': 'Miami Redhawks',
      'UMD': 'Maryland Terrapins',
      'MASS': 'Massachusetts Minutemen',
      'MEM': 'Memphis Tigers',
      'MICH': 'Michigan Wolverines',
      'MSU': 'Michigan State Spartans',
      'MTSU': 'Middle Tennessee State Blue Raiders',
      'MINN': 'Minnesota Golden Gophers',
      'MISS': 'Ole Miss Rebels',
      'MSST': 'Mississippi State Bulldogs',
      'MZST': 'Missouri Tigers',
      'MRSH': 'Marshall Thundering Herd',
      'NAVY': 'Navy Midshipmen',
      'NEB': 'Nebraska Cornhuskers',
      'NEV': 'Nevada Wolf Pack',
      'UNM': 'New Mexico Lobos',
      'NMSU': 'New Mexico State Aggies',
      'UNC': 'North Carolina Tar Heels',
      'NCST': 'North Carolina State Wolfpack',
      'UNT': 'North Texas Mean Green',
      'NU': 'Northwestern Wildcats',
      'ND': 'Notre Dame Fighting Irish',
      'NIU': 'Northern Illinois Huskies',
      'OHIO': 'Ohio Bobcats',
      'OSU': 'Ohio State Buckeyes',
      'OKLA': 'Oklahoma Sooners',
      'OKST': 'Oklahoma State Cowboys',
      'ODU': 'Old Dominion Monarchs',
      'ORE': 'Oregon Ducks',
      'ORST': 'Oregon State Beavers',
      'PSU': 'Penn State Nittany Lions',
      'PITT': 'Pittsburgh Panthers',
      'PUR': 'Purdue Boilermakers',
      'RICE': 'Rice Owls',
      'RUT': 'Rutgers Scarlet Knights',
      'SDSU': 'San Diego State Aztecs',
      'SJSU': 'San Jose State Spartans',
      'SAM': 'Sam Houston State Bearkats',
      'USF': 'South Florida Bulls',
      'SMU': 'SMU Mustangs',
      'USC': 'USC Trojans',
      'SCAR': 'South Carolina Gamecocks',
      'STAN': 'Stanford Cardinal',
      'SYR': 'Syracuse Orange',
      'TCU': 'TCU Horned Frogs',
      'TEM': 'Temple Owls',
      'TENN': 'Tennessee Volunteers',
      'TEX': 'Texas Longhorns',
      'TXAM': 'Texas A&M Aggies',
      'TXST': 'Texas State Bobcats',
      'TXTECH': 'Texas Tech Red Raiders',
      'TOL': 'Toledo Rockets',
      'TROY': 'Troy Trojans',
      'TUL': 'Tulane Green Wave',
      'TLSA': 'Tulsa Golden Hurricane',
      'UAB': 'UAB Blazers',
      'UCF': 'UCF Knights',
      'UCLA': 'UCLA Bruins',
      'UNLV': 'UNLV Rebels',
      'UTEP': 'UTEP Miners',
      'USA': 'South Alabama Jaguars',
      'USU': 'Utah State Aggies',
      'UTAH': 'Utah Utes',
      'UTSA': 'UTSA Roadrunners',
      'VAN': 'Vanderbilt Commodores',
      'UVA': 'Virginia Cavaliers',
      'VT': 'Virginia Tech Hokies',
      'WAKE': 'Wake Forest Demon Deacons',
      'WASH': 'Washington Huskies',
      'WSU': 'Washington State Cougars',
      'WVU': 'West Virginia Mountaineers',
      'WMU': 'Western Michigan Broncos',
      'WKU': 'Western Kentucky Hilltoppers',
      'WIS': 'Wisconsin Badgers',
      'WYO': 'Wyoming Cowboys',
      'DEL': 'Delaware Fightin\' Blue Hens',
      'FLA': 'Florida Gators',
      'KENN': 'Kennesaw State Owls',
      'ULM': 'Monroe Warhawks',
      'UC': 'Cincinnati Bearcats',
      'RUTG': 'Rutgers Scarlet Knights',
      'SHSU': 'Sam Houston State Bearkats',
      'TAMU': 'Texas A&M Aggies',
      'TTU': 'Texas Tech Red Raiders',
      'TULN': 'Tulane Green Wave',
      'UH': 'Houston Cougars',
      'UL': 'Lafayette Ragin\' Cajuns',
      'UT': 'Tennessee Volunteers',
      'MIA': 'Miami Hurricanes',
      'MIZ': 'Missouri Tigers',
      'OU': 'Oklahoma Sooners',
      'GSU': 'Georgia State Panthers'
    }
    return mascotMap[abbr] || null
  }

  const getOpponentTeamName = (abbr) => {
    return teamAbbreviations[abbr]?.name || abbr
  }

  const [gameData, setGameData] = useState({
    opponent: scheduledGame?.opponent || '',
    location: scheduledGame?.location || 'home',
    teamScore: '',
    opponentScore: '',
    isConferenceGame: false,
    userRank: '',
    opponentRank: '',
    opponentOverall: '',
    opponentOffense: '',
    opponentDefense: '',
    opponentRecord: '',
    gameNote: '',
    week: actualWeekNumber,
    year: currentYear,
    quarters: {
      team: { Q1: '', Q2: '', Q3: '', Q4: '' },
      opponent: { Q1: '', Q2: '', Q3: '', Q4: '' }
    },
    overtimes: []
  })

  const [links, setLinks] = useState(['']) // Array of link strings
  const [conferencePOW, setConferencePOW] = useState('') // Player name for conference POW
  const [nationalPOW, setNationalPOW] = useState('') // Player name for national POW
  const [confPOWSearch, setConfPOWSearch] = useState('')
  const [natlPOWSearch, setNatlPOWSearch] = useState('')
  const [confPOWOpen, setConfPOWOpen] = useState(false)
  const [natlPOWOpen, setNatlPOWOpen] = useState(false)
  const [confPOWHighlight, setConfPOWHighlight] = useState(0)
  const [natlPOWHighlight, setNatlPOWHighlight] = useState(0)
  const [confPOWDropUp, setConfPOWDropUp] = useState(false)
  const [natlPOWDropUp, setNatlPOWDropUp] = useState(false)

  const confPOWRef = useRef(null)
  const natlPOWRef = useRef(null)
  const confPOWDropdownRef = useRef(null)
  const natlPOWDropdownRef = useRef(null)
  const formRef = useRef(null)

  // Get list of player names for selection
  const playerNames = (currentDynasty?.players || [])
    .map(p => p.name)
    .sort()

  // Filter players based on search
  const filteredConfPlayers = playerNames.filter(name =>
    name.toLowerCase().includes(confPOWSearch.toLowerCase())
  )
  const filteredNatlPlayers = playerNames.filter(name =>
    name.toLowerCase().includes(natlPOWSearch.toLowerCase())
  )

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (confPOWDropdownRef.current && !confPOWDropdownRef.current.contains(event.target)) {
        setConfPOWOpen(false)
      }
      if (natlPOWDropdownRef.current && !natlPOWDropdownRef.current.contains(event.target)) {
        setNatlPOWOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset highlight when search changes
  useEffect(() => {
    setConfPOWHighlight(0)
  }, [confPOWSearch])

  useEffect(() => {
    setNatlPOWHighlight(0)
  }, [natlPOWSearch])

  // Check if dropdown should open upward
  const checkDropdownPosition = (inputRef, setDropUp) => {
    if (!inputRef.current) return

    const inputRect = inputRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - inputRect.bottom
    const spaceAbove = inputRect.top
    const dropdownHeight = 240 // max-h-60 = 15rem = 240px

    // If not enough space below but more space above, drop up
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      setDropUp(true)
    } else {
      setDropUp(false)
    }
  }

  // Player selection handlers
  const handleConfPOWSelect = (playerName) => {
    setConferencePOW(playerName)
    setConfPOWSearch('')
    setConfPOWOpen(false)
  }

  const handleNatlPOWSelect = (playerName) => {
    setNationalPOW(playerName)
    setNatlPOWSearch('')
    setNatlPOWOpen(false)
  }

  const handleConfPOWKeyDown = (e) => {
    if (!confPOWOpen && (e.key === 'Enter' || e.key === 'ArrowDown')) {
      e.preventDefault()
      setConfPOWOpen(true)
      return
    }

    if (!confPOWOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        e.stopPropagation()
        setConfPOWHighlight(prev =>
          prev < filteredConfPlayers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        e.stopPropagation()
        setConfPOWHighlight(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        e.stopPropagation()
        if (filteredConfPlayers[confPOWHighlight]) {
          handleConfPOWSelect(filteredConfPlayers[confPOWHighlight])
        }
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setConfPOWOpen(false)
        setConfPOWSearch('')
        break
      case 'Tab':
        // Allow Tab to work normally but close the dropdown
        setConfPOWOpen(false)
        break
      default:
        break
    }
  }

  const handleNatlPOWKeyDown = (e) => {
    if (!natlPOWOpen && (e.key === 'Enter' || e.key === 'ArrowDown')) {
      e.preventDefault()
      setNatlPOWOpen(true)
      return
    }

    if (!natlPOWOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        e.stopPropagation()
        setNatlPOWHighlight(prev =>
          prev < filteredNatlPlayers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        e.stopPropagation()
        setNatlPOWHighlight(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        e.stopPropagation()
        if (filteredNatlPlayers[natlPOWHighlight]) {
          handleNatlPOWSelect(filteredNatlPlayers[natlPOWHighlight])
        }
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setNatlPOWOpen(false)
        setNatlPOWSearch('')
        break
      case 'Tab':
        // Allow Tab to work normally but close the dropdown
        setNatlPOWOpen(false)
        break
      default:
        break
    }
  }

  // Check if any quarter has been filled
  const hasQuarterScores = () => {
    const { team, opponent } = gameData.quarters
    return Object.values(team).some(v => v !== '') || Object.values(opponent).some(v => v !== '')
  }

  // Auto-sum quarter scores
  const calculateTotalFromQuarters = (side, quarters = gameData.quarters, overtimes = gameData.overtimes) => {
    let total = 0
    Object.values(quarters[side]).forEach(score => {
      if (score !== '') total += parseInt(score) || 0
    })

    // Add overtime scores for this side
    overtimes.forEach(ot => {
      const score = ot[side]
      if (score !== '') total += parseInt(score) || 0
    })

    return total
  }

  // Handle quarter score change
  const handleQuarterChange = (side, quarter, value) => {
    const newQuarters = {
      ...gameData.quarters,
      [side]: {
        ...gameData.quarters[side],
        [quarter]: value
      }
    }

    const newGameData = {
      ...gameData,
      quarters: newQuarters
    }

    // Auto-calculate totals if quarters are being used
    if (hasQuarterScores() || value !== '') {
      newGameData.teamScore = calculateTotalFromQuarters('team', newQuarters, gameData.overtimes).toString()
      newGameData.opponentScore = calculateTotalFromQuarters('opponent', newQuarters, gameData.overtimes).toString()
    }

    setGameData(newGameData)

    // Auto-add OT1 if all quarters are filled and scores are tied
    const allQuartersFilled =
      newQuarters.team.Q1 !== '' && newQuarters.team.Q2 !== '' &&
      newQuarters.team.Q3 !== '' && newQuarters.team.Q4 !== '' &&
      newQuarters.opponent.Q1 !== '' && newQuarters.opponent.Q2 !== '' &&
      newQuarters.opponent.Q3 !== '' && newQuarters.opponent.Q4 !== ''

    if (allQuartersFilled && gameData.overtimes.length === 0) {
      const teamTotal = calculateTotalFromQuarters('team', newQuarters, [])
      const opponentTotal = calculateTotalFromQuarters('opponent', newQuarters, [])

      if (teamTotal === opponentTotal) {
        setTimeout(() => {
          setGameData(prev => ({
            ...prev,
            overtimes: [{ team: '', opponent: '' }]
          }))
        }, 100)
      }
    }
  }

  // Handle overtime score change
  const handleOvertimeChange = (index, side, value) => {
    const newOvertimes = [...gameData.overtimes]
    newOvertimes[index] = {
      ...newOvertimes[index],
      [side]: value
    }

    const newGameData = {
      ...gameData,
      overtimes: newOvertimes
    }

    // Auto-calculate totals
    newGameData.teamScore = calculateTotalFromQuarters('team', gameData.quarters, newOvertimes).toString()
    newGameData.opponentScore = calculateTotalFromQuarters('opponent', gameData.quarters, newOvertimes).toString()

    setGameData(newGameData)

    // Auto-add next OT if this OT is filled and scores are still tied
    const currentOT = newOvertimes[index]
    if (currentOT.team !== '' && currentOT.opponent !== '') {
      const teamTotal = calculateTotalFromQuarters('team', gameData.quarters, newOvertimes)
      const opponentTotal = calculateTotalFromQuarters('opponent', gameData.quarters, newOvertimes)

      if (teamTotal === opponentTotal && index === newOvertimes.length - 1) {
        setTimeout(() => {
          setGameData(prev => ({
            ...prev,
            overtimes: [...prev.overtimes, { team: '', opponent: '' }]
          }))
        }, 100)
      }
    }
  }


  // Load existing game data or scheduled game data when modal opens
  useEffect(() => {
    if (isOpen) {
      // Check if there's an existing game for this week (or use passed existing game for CC)
      const existingGame = passedExistingGame || (isConferenceChampionship
        ? currentDynasty?.games?.find(g => g.isConferenceChampionship && g.year === currentYear)
        : currentDynasty?.games?.find(g => g.week === actualWeekNumber && g.year === currentYear))

      if (existingGame) {
        // Load existing game data for editing
        setGameData({
          opponent: existingGame.opponent || '',
          location: existingGame.location || 'home',
          teamScore: existingGame.teamScore?.toString() || '',
          opponentScore: existingGame.opponentScore?.toString() || '',
          isConferenceGame: existingGame.isConferenceGame || isConferenceChampionship || false,
          userRank: existingGame.userRank?.toString() || '',
          opponentRank: existingGame.opponentRank?.toString() || '',
          opponentOverall: existingGame.opponentOverall?.toString() || '',
          opponentOffense: existingGame.opponentOffense?.toString() || '',
          opponentDefense: existingGame.opponentDefense?.toString() || '',
          opponentRecord: existingGame.opponentRecord || '',
          gameNote: existingGame.gameNote || '',
          week: actualWeekNumber,
          year: currentYear,
          quarters: existingGame.quarters || {
            team: { Q1: '', Q2: '', Q3: '', Q4: '' },
            opponent: { Q1: '', Q2: '', Q3: '', Q4: '' }
          },
          overtimes: existingGame.overtimes || []
        })

        // Load links
        if (existingGame.links) {
          const linkArray = existingGame.links.split(',').map(link => link.trim()).filter(link => link)
          setLinks(linkArray.length > 0 ? [...linkArray, ''] : [''])
        } else {
          setLinks([''])
        }

        // Load Player of the Week selections
        setConferencePOW(existingGame.conferencePOW || '')
        setNationalPOW(existingGame.nationalPOW || '')
        setConfPOWSearch('')
        setNatlPOWSearch('')
        setConfPOWOpen(false)
        setNatlPOWOpen(false)
      } else if (scheduledGame || isConferenceChampionship) {
        // New game - load from schedule or CC opponent
        setGameData(prev => ({
          ...prev,
          opponent: passedOpponent || scheduledGame?.opponent || '',
          location: isConferenceChampionship ? 'neutral' : (scheduledGame?.location || 'home'),
          teamScore: '',
          opponentScore: '',
          isConferenceGame: isConferenceChampionship || false,
          userRank: '',
          opponentRank: '',
          opponentOverall: '',
          opponentOffense: '',
          opponentDefense: '',
          opponentRecord: '',
          gameNote: '',
          quarters: {
            team: { Q1: '', Q2: '', Q3: '', Q4: '' },
            opponent: { Q1: '', Q2: '', Q3: '', Q4: '' }
          },
          overtimes: []
        }))
        setLinks([''])
        setConferencePOW('')
        setNationalPOW('')
        setConfPOWSearch('')
        setNatlPOWSearch('')
        setConfPOWOpen(false)
        setNatlPOWOpen(false)
      }
    }
  }, [isOpen, scheduledGame, actualWeekNumber, currentYear, currentDynasty?.games, isConferenceChampionship, passedOpponent, passedExistingGame])

  const handleLinkChange = (index, value) => {
    const newLinks = [...links]
    newLinks[index] = value

    // Add a new empty field if this is the last one and has content
    if (index === links.length - 1 && value.trim() !== '') {
      newLinks.push('')
    }

    setLinks(newLinks)
  }

  const handleRecordChange = (e) => {
    const input = e.target.value
    // Remove all non-digit characters
    const digits = input.replace(/\D/g, '')

    // Limit to 4 digits
    const limitedDigits = digits.slice(0, 4)

    // Format based on how many digits we have
    let formatted = ''
    if (limitedDigits.length > 0) {
      formatted = limitedDigits[0]
      if (limitedDigits.length > 1) {
        formatted += '-' + limitedDigits[1]
        if (limitedDigits.length > 2) {
          formatted += ' (' + limitedDigits[2]
          if (limitedDigits.length > 3) {
            formatted += '-' + limitedDigits[3] + ')'
          }
        }
      }
    }

    setGameData({ ...gameData, opponentRecord: formatted })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    console.log('handleSubmit called with gameData:', gameData)

    // Validate required fields
    if (!gameData.teamScore || !gameData.opponentScore) {
      alert('Please enter both team scores')
      return
    }

    // Convert numeric fields and validate
    const teamScore = parseInt(gameData.teamScore)
    const opponentScore = parseInt(gameData.opponentScore)

    if (isNaN(teamScore) || isNaN(opponentScore)) {
      alert('Please enter valid numeric scores')
      return
    }

    // Validate opponent record if provided
    if (gameData.opponentRecord && gameData.opponentRecord.trim() !== '') {
      const recordMatch = gameData.opponentRecord.match(/(\d+)-(\d+)\s*\((\d+)-(\d+)\)/)
      if (recordMatch) {
        const overallWins = parseInt(recordMatch[1])
        const overallLosses = parseInt(recordMatch[2])
        const confWins = parseInt(recordMatch[3])
        const confLosses = parseInt(recordMatch[4])

        const totalGames = overallWins + overallLosses
        const confGames = confWins + confLosses

        if (confGames > totalGames) {
          alert('Invalid record: Conference games (' + confGames + ') cannot exceed overall games (' + totalGames + ')')
          return
        }
      }
    }

    // Filter out empty links and join them
    const filteredLinks = links.filter(link => link.trim() !== '').join(', ')

    // Auto-calculate result based on scores
    const result = teamScore > opponentScore ? 'win' : 'loss'

    // Auto-calculate favorite/underdog status
    const calculateFavoriteStatus = () => {
      const userRank = gameData.userRank ? parseInt(gameData.userRank) : null
      const opponentRank = gameData.opponentRank ? parseInt(gameData.opponentRank) : null
      const userOverall = currentDynasty?.teamRatings?.overall ? parseInt(currentDynasty.teamRatings.overall) : null
      const opponentOverall = gameData.opponentOverall ? parseInt(gameData.opponentOverall) : null
      const isHomeTeam = gameData.location === 'home'
      const isNeutral = gameData.location === 'neutral'

      // If neutral site, no home advantage
      const homeAdvantageOverall = isNeutral ? 0 : 3
      const homeAdvantageRanking = isNeutral ? 0 : 5

      // Case 1: One ranked, one unranked - ranked team is favorite
      if (userRank && !opponentRank) {
        // User is ranked, opponent is not
        // Apply home advantage to ranking if opponent is home
        const adjustedUserRank = isHomeTeam ? userRank - homeAdvantageRanking : userRank
        return adjustedUserRank <= 25 ? 'favorite' : 'underdog' // If still ranked after adjustment, favorite
      } else if (!userRank && opponentRank) {
        // Opponent is ranked, user is not
        // Apply home advantage to ranking if user is home
        const adjustedOpponentRank = isHomeTeam ? opponentRank + homeAdvantageRanking : opponentRank
        return adjustedOpponentRank > 25 ? 'favorite' : 'underdog' // If opponent falls out of rankings, user is favorite
      }

      // Case 2: Both ranked - use rankings (lower is better)
      if (userRank && opponentRank) {
        const adjustedUserRank = isHomeTeam ? userRank - homeAdvantageRanking : userRank
        const adjustedOpponentRank = isHomeTeam ? opponentRank : opponentRank - homeAdvantageRanking

        if (adjustedUserRank < adjustedOpponentRank) {
          return 'favorite'
        } else if (adjustedUserRank > adjustedOpponentRank) {
          return 'underdog'
        } else {
          // Tie - home team wins
          return isHomeTeam ? 'favorite' : 'underdog'
        }
      }

      // Case 3: Both unranked - use overall ratings
      if (userOverall && opponentOverall) {
        const adjustedUserOverall = isHomeTeam ? userOverall + homeAdvantageOverall : userOverall
        const adjustedOpponentOverall = isHomeTeam ? opponentOverall : opponentOverall + homeAdvantageOverall

        if (adjustedUserOverall > adjustedOpponentOverall) {
          return 'favorite'
        } else if (adjustedUserOverall < adjustedOpponentOverall) {
          return 'underdog'
        } else {
          // Tie - home team wins
          return isHomeTeam ? 'favorite' : 'underdog'
        }
      }

      // Default: if we can't determine, return null
      return null
    }

    const favoriteStatus = calculateFavoriteStatus()

    // Auto-detect if this is a conference game
    const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName)
    const opponentAbbr = gameData.opponent || scheduledGame?.opponent
    const userConference = getTeamConference(userTeamAbbr)
    const opponentConference = getTeamConference(opponentAbbr)

    // Conference game if both teams are in the same conference (and not independents)
    // Conference Championship games are always conference games
    const isConferenceGame = isConferenceChampionship ||
      (userConference && opponentConference &&
       userConference === opponentConference &&
       userConference !== 'Independent')

    const processedData = {
      ...gameData,
      week: actualWeekNumber,  // Use actualWeekNumber instead of gameData.week
      links: filteredLinks,
      result: result,
      teamScore: teamScore,
      opponentScore: opponentScore,
      userRank: gameData.userRank ? parseInt(gameData.userRank) : null,
      opponentRank: gameData.opponentRank ? parseInt(gameData.opponentRank) : null,
      opponentOverall: gameData.opponentOverall ? parseInt(gameData.opponentOverall) : null,
      opponentOffense: gameData.opponentOffense ? parseInt(gameData.opponentOffense) : null,
      opponentDefense: gameData.opponentDefense ? parseInt(gameData.opponentDefense) : null,
      conferencePOW: conferencePOW || null,
      nationalPOW: nationalPOW || null,
      favoriteStatus: favoriteStatus,
      isConferenceGame: isConferenceGame
    }

    console.log('Calling onSave with processedData:', processedData)

    try {
      await onSave(processedData)
      console.log('onSave completed successfully')

      // Reset form
      setGameData({
        opponent: '',
        location: 'home',
        teamScore: '',
        opponentScore: '',
        isConferenceGame: false,
        userRank: '',
        opponentRank: '',
        opponentOverall: '',
        opponentOffense: '',
        opponentDefense: '',
        opponentRecord: '',
        gameNote: '',
        week: actualWeekNumber,
        year: currentYear,
        quarters: {
          team: { Q1: '', Q2: '', Q3: '', Q4: '' },
          opponent: { Q1: '', Q2: '', Q3: '', Q4: '' }
        },
        overtimes: []
      })
      setLinks([''])
      setConferencePOW('')
      setNationalPOW('')
      setConfPOWSearch('')
      setNatlPOWSearch('')
      setConfPOWOpen(false)
      setNatlPOWOpen(false)
      // Note: onClose() is called by parent's handleGameSave, don't call here to avoid race conditions
    } catch (error) {
      console.error('Error saving game:', error)
      alert('Error saving game. Please try again.')
      return
    }
  }

  // DEV: Random fill function for quick testing
  const handleRandomFill = () => {
    const randomScore = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

    // Generate random quarter scores
    const q1Team = randomScore(0, 14)
    const q2Team = randomScore(0, 21)
    const q3Team = randomScore(0, 14)
    const q4Team = randomScore(0, 21)
    const q1Opp = randomScore(0, 14)
    const q2Opp = randomScore(0, 21)
    const q3Opp = randomScore(0, 14)
    const q4Opp = randomScore(0, 21)

    const teamTotal = q1Team + q2Team + q3Team + q4Team
    const oppTotal = q1Opp + q2Opp + q3Opp + q4Opp

    // Make sure it's not a tie (would require OT handling)
    const finalTeamScore = teamTotal === oppTotal ? teamTotal + 7 : teamTotal

    // Generate random opponent record
    const oppWins = randomScore(0, 11)
    const oppLosses = randomScore(0, 11 - oppWins)
    const confWins = randomScore(0, Math.min(oppWins, 8))
    const confLosses = randomScore(0, Math.min(oppLosses, 8 - confWins))
    const opponentRecord = `${oppWins}-${oppLosses} (${confWins}-${confLosses})`

    // Random national rankings (sometimes ranked, sometimes not)
    const userRank = Math.random() > 0.5 ? randomScore(1, 25).toString() : ''
    const oppRank = Math.random() > 0.6 ? randomScore(1, 25).toString() : ''

    setGameData(prev => ({
      ...prev,
      quarters: {
        team: { Q1: q1Team.toString(), Q2: q2Team.toString(), Q3: q3Team.toString(), Q4: q4Team.toString() },
        opponent: { Q1: q1Opp.toString(), Q2: q2Opp.toString(), Q3: q3Opp.toString(), Q4: q4Opp.toString() }
      },
      teamScore: finalTeamScore.toString(),
      opponentScore: oppTotal.toString(),
      userRank: userRank,
      opponentRank: oppRank,
      opponentOverall: randomScore(70, 95).toString(),
      opponentOffense: randomScore(70, 95).toString(),
      opponentDefense: randomScore(70, 95).toString(),
      opponentRecord: opponentRecord
    }))

    // Random player of the week (50% chance each)
    if (playerNames.length > 0) {
      const randomPlayer = () => playerNames[randomScore(0, playerNames.length - 1)]
      if (Math.random() > 0.5) {
        setConferencePOW(randomPlayer())
      }
      if (Math.random() > 0.7) { // National is rarer
        setNationalPOW(randomPlayer())
      }
    }

    // Auto-submit after state updates
    setTimeout(() => {
      formRef.current?.requestSubmit()
    }, 100)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto"
        style={{ backgroundColor: teamColors.secondary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 px-6 py-4 flex items-center justify-between border-b-2 z-10"
          style={{
            backgroundColor: teamColors.secondary,
            borderColor: teamColors.primary
          }}
        >
          <div>
            <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
              {isConferenceChampionship
                ? `${currentDynasty?.conference || 'Conference'} Championship`
                : bowlName
                  ? `${bowlName} Game Entry`
                  : `Week ${actualWeekNumber} Game Entry`}
            </h2>
            {(scheduledGame || isConferenceChampionship) && (
              <p className="text-sm mt-1" style={{ color: teamColors.primary, opacity: 0.7 }}>
                {isConferenceChampionship ? 'vs' : (scheduledGame?.location === 'away' ? '@' : 'vs')} {passedOpponent || scheduledGame?.opponent}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* DEV: Random Fill Button */}
            <button
              type="button"
              onClick={handleRandomFill}
              className="px-3 py-1 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: '#f59e0b',
                color: '#000'
              }}
              title="DEV: Fill with random data"
            >
              Random Fill
            </button>
            <button
              onClick={onClose}
              className="hover:opacity-70"
              style={{ color: teamColors.primary }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Score Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: teamColors.primary }}>
              Final Score
            </h3>

            {/* Quarter by Quarter Scoring */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3" style={{ color: teamColors.primary }}>
                Quarter by Quarter Scoring (Optional)
              </h4>

              <div className="space-y-2">
                {(() => {
                  // Determine team order based on location
                  const opponentAbbr = gameData.opponent || passedOpponent || scheduledGame?.opponent
                  const opponentMascotName = opponentAbbr ? getMascotName(opponentAbbr) : null
                  const opponentDisplayName = opponentMascotName || (opponentAbbr ? getOpponentTeamName(opponentAbbr) : 'Opponent')
                  const userTeamName = currentDynasty?.teamName || 'You'

                  // Get team logos
                  const userTeamLogo = getTeamLogo(userTeamName)
                  const opponentLogo = opponentMascotName ? getTeamLogo(opponentMascotName) : null

                  // Away team on top, home team on bottom
                  const isUserAway = gameData.location === 'away'
                  const topTeam = isUserAway
                    ? { name: userTeamName, key: 'team', colors: teamColors, logo: userTeamLogo }
                    : { name: opponentDisplayName, key: 'opponent', colors: { primary: '#666' }, logo: opponentLogo }
                  const bottomTeam = isUserAway
                    ? { name: opponentDisplayName, key: 'opponent', colors: { primary: '#666' }, logo: opponentLogo }
                    : { name: userTeamName, key: 'team', colors: teamColors, logo: userTeamLogo }

                  return (
                    <>
                      {/* Headers */}
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: `50px repeat(${4 + gameData.overtimes.length}, 60px) 70px` }}>
                        <div className="text-xs font-semibold text-gray-600"></div>
                        <div className="text-xs font-semibold text-gray-600 text-center">Q1</div>
                        <div className="text-xs font-semibold text-gray-600 text-center">Q2</div>
                        <div className="text-xs font-semibold text-gray-600 text-center">Q3</div>
                        <div className="text-xs font-semibold text-gray-600 text-center">Q4</div>
                        {gameData.overtimes.map((_, i) => (
                          <div key={i} className="text-xs font-semibold text-gray-600 text-center">
                            OT{i + 1}
                          </div>
                        ))}
                        <div className="text-xs font-semibold text-gray-600 text-center">
                          Total <span className="text-red-500">*</span>
                        </div>
                      </div>

                      {/* Quarter Inputs - Alternating between teams */}
                      <div className="grid gap-2" style={{ gridTemplateColumns: `50px repeat(${4 + gameData.overtimes.length}, 60px) 70px` }}>
                        {/* Team Logos Column */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-center h-[34px]">
                            {topTeam.logo ? (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: `2px solid ${topTeam.colors.primary}`,
                                  padding: '2px'
                                }}
                              >
                                <img
                                  src={topTeam.logo}
                                  alt={topTeam.name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-gray-600">{topTeam.name}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-center h-[34px]">
                            {bottomTeam.logo ? (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: `2px solid ${bottomTeam.colors.primary}`,
                                  padding: '2px'
                                }}
                              >
                                <img
                                  src={bottomTeam.logo}
                                  alt={bottomTeam.name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-gray-600">{bottomTeam.name}</div>
                            )}
                          </div>
                        </div>

                        {/* Q1 Column */}
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={gameData.quarters[topTeam.key].Q1}
                            onChange={(e) => handleQuarterChange(topTeam.key, 'Q1', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault()
                                document.querySelector(`input[data-team="${bottomTeam.key}"][data-quarter="Q1"]`)?.focus()
                              }
                            }}
                            data-team={topTeam.key}
                            data-quarter="Q1"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: topTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                          <input
                            type="number"
                            value={gameData.quarters[bottomTeam.key].Q1}
                            onChange={(e) => handleQuarterChange(bottomTeam.key, 'Q1', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault()
                                document.querySelector(`input[data-team="${topTeam.key}"][data-quarter="Q2"]`)?.focus()
                              }
                            }}
                            data-team={bottomTeam.key}
                            data-quarter="Q1"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: bottomTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                        </div>

                        {/* Q2 Column */}
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={gameData.quarters[topTeam.key].Q2}
                            onChange={(e) => handleQuarterChange(topTeam.key, 'Q2', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault()
                                document.querySelector(`input[data-team="${bottomTeam.key}"][data-quarter="Q2"]`)?.focus()
                              }
                            }}
                            data-team={topTeam.key}
                            data-quarter="Q2"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: topTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                          <input
                            type="number"
                            value={gameData.quarters[bottomTeam.key].Q2}
                            onChange={(e) => handleQuarterChange(bottomTeam.key, 'Q2', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault()
                                document.querySelector(`input[data-team="${topTeam.key}"][data-quarter="Q3"]`)?.focus()
                              }
                            }}
                            data-team={bottomTeam.key}
                            data-quarter="Q2"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: bottomTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                        </div>

                        {/* Q3 Column */}
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={gameData.quarters[topTeam.key].Q3}
                            onChange={(e) => handleQuarterChange(topTeam.key, 'Q3', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault()
                                document.querySelector(`input[data-team="${bottomTeam.key}"][data-quarter="Q3"]`)?.focus()
                              }
                            }}
                            data-team={topTeam.key}
                            data-quarter="Q3"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: topTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                          <input
                            type="number"
                            value={gameData.quarters[bottomTeam.key].Q3}
                            onChange={(e) => handleQuarterChange(bottomTeam.key, 'Q3', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault()
                                document.querySelector(`input[data-team="${topTeam.key}"][data-quarter="Q4"]`)?.focus()
                              }
                            }}
                            data-team={bottomTeam.key}
                            data-quarter="Q3"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: bottomTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                        </div>

                        {/* Q4 Column */}
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={gameData.quarters[topTeam.key].Q4}
                            onChange={(e) => handleQuarterChange(topTeam.key, 'Q4', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey) {
                                e.preventDefault()
                                document.querySelector(`input[data-team="${bottomTeam.key}"][data-quarter="Q4"]`)?.focus()
                              }
                            }}
                            data-team={topTeam.key}
                            data-quarter="Q4"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: topTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                          <input
                            type="number"
                            value={gameData.quarters[bottomTeam.key].Q4}
                            onChange={(e) => handleQuarterChange(bottomTeam.key, 'Q4', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey && gameData.overtimes.length > 0) {
                                e.preventDefault()
                                setTimeout(() => {
                                  document.querySelector(`input[data-team="${topTeam.key}"][data-ot="0"]`)?.focus()
                                }, 100)
                              }
                            }}
                            data-team={bottomTeam.key}
                            data-quarter="Q4"
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                            style={{ borderColor: bottomTeam.colors.primary }}
                            min="0"
                            placeholder="0"
                          />
                        </div>

                        {/* OT Columns */}
                        {gameData.overtimes.map((ot, otIdx) => (
                          <div key={otIdx} className="space-y-2">
                            <input
                              type="number"
                              value={ot[topTeam.key]}
                              onChange={(e) => handleOvertimeChange(otIdx, topTeam.key, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab' && !e.shiftKey) {
                                  e.preventDefault()
                                  document.querySelector(`input[data-team="${bottomTeam.key}"][data-ot="${otIdx}"]`)?.focus()
                                }
                              }}
                              data-team={topTeam.key}
                              data-ot={otIdx}
                              className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                              style={{ borderColor: topTeam.colors.primary }}
                              min="0"
                              placeholder="0"
                            />
                            <input
                              type="number"
                              value={ot[bottomTeam.key]}
                              onChange={(e) => handleOvertimeChange(otIdx, bottomTeam.key, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab' && !e.shiftKey && otIdx < gameData.overtimes.length - 1) {
                                  e.preventDefault()
                                  setTimeout(() => {
                                    document.querySelector(`input[data-team="${topTeam.key}"][data-ot="${otIdx + 1}"]`)?.focus()
                                  }, 100)
                                }
                              }}
                              data-team={bottomTeam.key}
                              data-ot={otIdx}
                              className="w-full px-2 py-1 border-2 rounded text-center text-sm"
                              style={{ borderColor: bottomTeam.colors.primary }}
                              min="0"
                              placeholder="0"
                            />
                          </div>
                        ))}

                        {/* Total Column */}
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={topTeam.key === 'team' ? gameData.teamScore : gameData.opponentScore}
                            onChange={(e) => !hasQuarterScores() && setGameData({
                              ...gameData,
                              [topTeam.key === 'team' ? 'teamScore' : 'opponentScore']: e.target.value
                            })}
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm font-bold"
                            style={{ borderColor: topTeam.colors.primary }}
                            min="0"
                            readOnly={hasQuarterScores()}
                            disabled={hasQuarterScores()}
                            required
                          />
                          <input
                            type="number"
                            value={bottomTeam.key === 'team' ? gameData.teamScore : gameData.opponentScore}
                            onChange={(e) => !hasQuarterScores() && setGameData({
                              ...gameData,
                              [bottomTeam.key === 'team' ? 'teamScore' : 'opponentScore']: e.target.value
                            })}
                            className="w-full px-2 py-1 border-2 rounded text-center text-sm font-bold"
                            style={{ borderColor: bottomTeam.colors.primary }}
                            min="0"
                            readOnly={hasQuarterScores()}
                            disabled={hasQuarterScores()}
                            required
                          />
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Rankings Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: teamColors.primary }}>
                National Rankings
              </h3>
              <p className="text-xs mt-1" style={{ color: teamColors.primary, opacity: 0.6 }}>
                Leave blank if unranked
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                  Your National Rank
                </label>
                <input
                  type="number"
                  value={gameData.userRank}
                  onChange={(e) => setGameData({ ...gameData, userRank: e.target.value })}
                  className="w-full px-4 py-2 border-2 rounded-lg"
                  style={{ borderColor: teamColors.primary }}
                  min="1"
                  max="133"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                  Opponent National Rank
                </label>
                <input
                  type="number"
                  value={gameData.opponentRank}
                  onChange={(e) => setGameData({ ...gameData, opponentRank: e.target.value })}
                  className="w-full px-4 py-2 border-2 rounded-lg"
                  style={{ borderColor: teamColors.primary }}
                  min="1"
                  max="133"
                />
              </div>
            </div>
          </div>

          {/* Opponent Team Ratings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {(() => {
                const opponentAbbr = gameData.opponent || scheduledGame?.opponent
                const opponentMascotName = opponentAbbr ? getMascotName(opponentAbbr) : null
                const opponentDisplayName = opponentMascotName || (opponentAbbr ? getOpponentTeamName(opponentAbbr) : 'Opponent')
                const opponentLogo = opponentMascotName ? getTeamLogo(opponentMascotName) : null
                const opponentColors = opponentAbbr ? teamAbbreviations[opponentAbbr] : null

                return (
                  <>
                    {opponentLogo && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: `2px solid ${opponentColors?.textColor || teamColors.primary}`,
                          padding: '2px'
                        }}
                      >
                        <img
                          src={opponentLogo}
                          alt={`${opponentDisplayName} logo`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <h3 className="text-lg font-semibold" style={{ color: teamColors.primary }}>
                      {opponentDisplayName} Team Ratings
                    </h3>
                  </>
                )
              })()}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                  Overall
                </label>
                <input
                  type="number"
                  value={gameData.opponentOverall}
                  onChange={(e) => setGameData({ ...gameData, opponentOverall: e.target.value })}
                  className="w-full px-4 py-2 border-2 rounded-lg"
                  style={{ borderColor: teamColors.primary }}
                  min="0"
                  max="99"
                  placeholder="85"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                  Offense
                </label>
                <input
                  type="number"
                  value={gameData.opponentOffense}
                  onChange={(e) => setGameData({ ...gameData, opponentOffense: e.target.value })}
                  className="w-full px-4 py-2 border-2 rounded-lg"
                  style={{ borderColor: teamColors.primary }}
                  min="0"
                  max="99"
                  placeholder="87"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                  Defense
                </label>
                <input
                  type="number"
                  value={gameData.opponentDefense}
                  onChange={(e) => setGameData({ ...gameData, opponentDefense: e.target.value })}
                  className="w-full px-4 py-2 border-2 rounded-lg"
                  style={{ borderColor: teamColors.primary }}
                  min="0"
                  max="99"
                  placeholder="83"
                />
              </div>
            </div>
          </div>

          {/* Opponent Record Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: teamColors.primary }}>
              Opponent Record
            </h3>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                Record (Overall & Conference)
              </label>
              <input
                type="text"
                value={gameData.opponentRecord}
                onChange={handleRecordChange}
                className="w-full px-4 py-2 border-2 rounded-lg text-lg font-mono"
                style={{ borderColor: teamColors.primary }}
                placeholder="Type 4 digits (e.g., 5231 → 5-2 (3-1))"
              />
              <p className="text-xs mt-1 text-gray-500 text-center">
                Format: Overall-Record (Conference-Record)
              </p>
            </div>
          </div>

          {/* Player of the Week Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: teamColors.primary }}>
              Player of the Week Honors
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Conference POW */}
              <div className="relative" ref={confPOWDropdownRef}>
                <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                  Conference Player of the Week
                </label>
                <div className="relative">
                  <input
                    ref={confPOWRef}
                    type="text"
                    value={conferencePOW || confPOWSearch}
                    onChange={(e) => {
                      setConfPOWSearch(e.target.value)
                      setConfPOWOpen(true)
                      if (conferencePOW) setConferencePOW('')
                      setTimeout(() => checkDropdownPosition(confPOWRef, setConfPOWDropUp), 0)
                    }}
                    onFocus={() => {
                      setConfPOWOpen(true)
                      setTimeout(() => checkDropdownPosition(confPOWRef, setConfPOWDropUp), 0)
                    }}
                    onBlur={() => {
                      // Small delay to allow dropdown click events to fire first
                      setTimeout(() => setConfPOWOpen(false), 150)
                    }}
                    onKeyDown={handleConfPOWKeyDown}
                    className="w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:outline-none transition-colors"
                    style={{
                      borderColor: teamColors.primary,
                      paddingRight: '2.75rem'
                    }}
                    placeholder="Search or select player..."
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                      className={`w-5 h-5 transition-transform ${confPOWOpen ? 'rotate-180' : ''}`}
                      style={{ color: teamColors.primary }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {confPOWOpen && filteredConfPlayers.length > 0 && (
                  <div
                    className={`absolute z-10 w-full bg-white border-2 rounded-lg shadow-lg max-h-60 overflow-auto ${
                      confPOWDropUp ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}
                    style={{ borderColor: `${teamColors.primary}40` }}
                  >
                    {filteredConfPlayers.map((name, index) => (
                      <div
                        key={name}
                        onClick={() => handleConfPOWSelect(name)}
                        onMouseEnter={() => setConfPOWHighlight(index)}
                        className="px-4 py-2 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: index === confPOWHighlight ? `${teamColors.primary}20` : 'white',
                          color: index === confPOWHighlight ? teamColors.primary : 'inherit',
                          fontWeight: conferencePOW === name ? 'bold' : 'normal'
                        }}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}

                {confPOWOpen && confPOWSearch && filteredConfPlayers.length === 0 && (
                  <div
                    className={`absolute z-10 w-full bg-white border-2 rounded-lg shadow-lg p-4 text-center text-gray-500 ${
                      confPOWDropUp ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}
                    style={{ borderColor: `${teamColors.primary}40` }}
                  >
                    No players found matching "{confPOWSearch}"
                  </div>
                )}
              </div>

              {/* National POW */}
              <div className="relative" ref={natlPOWDropdownRef}>
                <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                  National Player of the Week
                </label>
                <div className="relative">
                  <input
                    ref={natlPOWRef}
                    type="text"
                    value={nationalPOW || natlPOWSearch}
                    onChange={(e) => {
                      setNatlPOWSearch(e.target.value)
                      setNatlPOWOpen(true)
                      if (nationalPOW) setNationalPOW('')
                      setTimeout(() => checkDropdownPosition(natlPOWRef, setNatlPOWDropUp), 0)
                    }}
                    onFocus={() => {
                      setNatlPOWOpen(true)
                      setTimeout(() => checkDropdownPosition(natlPOWRef, setNatlPOWDropUp), 0)
                    }}
                    onBlur={() => {
                      // Small delay to allow dropdown click events to fire first
                      setTimeout(() => setNatlPOWOpen(false), 150)
                    }}
                    onKeyDown={handleNatlPOWKeyDown}
                    className="w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:outline-none transition-colors"
                    style={{
                      borderColor: teamColors.primary,
                      paddingRight: '2.75rem'
                    }}
                    placeholder="Search or select player..."
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                      className={`w-5 h-5 transition-transform ${natlPOWOpen ? 'rotate-180' : ''}`}
                      style={{ color: teamColors.primary }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {natlPOWOpen && filteredNatlPlayers.length > 0 && (
                  <div
                    className={`absolute z-10 w-full bg-white border-2 rounded-lg shadow-lg max-h-60 overflow-auto ${
                      natlPOWDropUp ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}
                    style={{ borderColor: `${teamColors.primary}40` }}
                  >
                    {filteredNatlPlayers.map((name, index) => (
                      <div
                        key={name}
                        onClick={() => handleNatlPOWSelect(name)}
                        onMouseEnter={() => setNatlPOWHighlight(index)}
                        className="px-4 py-2 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: index === natlPOWHighlight ? `${teamColors.primary}20` : 'white',
                          color: index === natlPOWHighlight ? teamColors.primary : 'inherit',
                          fontWeight: nationalPOW === name ? 'bold' : 'normal'
                        }}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}

                {natlPOWOpen && natlPOWSearch && filteredNatlPlayers.length === 0 && (
                  <div
                    className={`absolute z-10 w-full bg-white border-2 rounded-lg shadow-lg p-4 text-center text-gray-500 ${
                      natlPOWDropUp ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}
                    style={{ borderColor: `${teamColors.primary}40` }}
                  >
                    No players found matching "{natlPOWSearch}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Game Note Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: teamColors.primary }}>
              Game Notes & Media
            </h3>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                Game Notes
              </label>
              <textarea
                value={gameData.gameNote}
                onChange={(e) => setGameData({ ...gameData, gameNote: e.target.value })}
                className="w-full px-4 py-2 border-2 rounded-lg"
                style={{ borderColor: teamColors.primary }}
                rows="3"
                placeholder="Add notes about the game (key plays, injuries, etc.)..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
                Links (YouTube, Imgur, etc.)
              </label>
              <div className="space-y-2">
                {links.map((link, index) => (
                  <input
                    key={index}
                    type="text"
                    value={link}
                    onChange={(e) => handleLinkChange(index, e.target.value)}
                    className="w-full px-4 py-2 border-2 rounded-lg"
                    style={{ borderColor: teamColors.primary }}
                    placeholder={index === 0 ? "Paste YouTube or image link..." : "Add another link..."}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t-2" style={{ borderColor: teamColors.primary }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-lg font-semibold border-2 hover:opacity-90 transition-colors"
              style={{
                borderColor: teamColors.primary,
                color: teamColors.primary,
                backgroundColor: teamColors.secondary
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
              style={{
                backgroundColor: teamColors.primary,
                color: teamColors.secondary
              }}
            >
              Save Game
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
