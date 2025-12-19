import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useAuth } from '../../context/AuthContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamLogo, teams } from '../../data/teams'
import { getTeamColors } from '../../data/teamColors'
import { getTeamConference } from '../../data/conferenceTeams'
import { getConferenceLogo } from '../../data/conferenceLogos'
import SearchableSelect from '../../components/SearchableSelect'
import DropdownSelect from '../../components/DropdownSelect'
import ScheduleEntryModal from '../../components/ScheduleEntryModal'
import RosterEntryModal from '../../components/RosterEntryModal'
import TeamRatingsModal from '../../components/TeamRatingsModal'
import GameEntryModal from '../../components/GameEntryModal'
import GameDetailModal from '../../components/GameDetailModal'
import ConferenceChampionshipModal from '../../components/ConferenceChampionshipModal'
import CoachingStaffModal from '../../components/CoachingStaffModal'
import BowlWeek1Modal from '../../components/BowlWeek1Modal'
import BowlWeek2Modal from '../../components/BowlWeek2Modal'
import BowlScoreModal from '../../components/BowlScoreModal'
import CFPSeedsModal from '../../components/CFPSeedsModal'
import CFPFirstRoundModal from '../../components/CFPFirstRoundModal'
import CFPQuarterfinalsModal from '../../components/CFPQuarterfinalsModal'
import ConferencesModal from '../../components/ConferencesModal'
import { getAllBowlGamesList, isBowlInWeek1, isBowlInWeek2 } from '../../services/sheetsService'

export default function Dashboard() {
  const { currentDynasty, saveSchedule, saveRoster, saveTeamRatings, saveCoachingStaff, saveConferences, addGame, updateDynasty } = useDynasty()
  const { user } = useAuth()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [showTeamRatingsModal, setShowTeamRatingsModal] = useState(false)
  const [showCoachingStaffModal, setShowCoachingStaffModal] = useState(false)
  const [showGameModal, setShowGameModal] = useState(false)
  const [showGameDetailModal, setShowGameDetailModal] = useState(false)
  const [showCCModal, setShowCCModal] = useState(false)
  const [showBowlWeek1Modal, setShowBowlWeek1Modal] = useState(false)
  const [showBowlWeek2Modal, setShowBowlWeek2Modal] = useState(false)
  const [showBowlScoreModal, setShowBowlScoreModal] = useState(false)
  const [showBowlGameModal, setShowBowlGameModal] = useState(false)
  const [showCFPSeedsModal, setShowCFPSeedsModal] = useState(false)
  const [showCFPFirstRoundModal, setShowCFPFirstRoundModal] = useState(false)
  const [showCFPQuarterfinalsModal, setShowCFPQuarterfinalsModal] = useState(false)
  const [showConferencesModal, setShowConferencesModal] = useState(false)

  // Bowl eligibility states
  const [bowlEligible, setBowlEligible] = useState(null) // null = not answered, true/false = answered
  const [selectedBowl, setSelectedBowl] = useState('')
  const [bowlOpponent, setBowlOpponent] = useState('')
  const [bowlOpponentSearch, setBowlOpponentSearch] = useState('')
  const [showBowlOpponentDropdown, setShowBowlOpponentDropdown] = useState(false)
  const [editingWeek, setEditingWeek] = useState(null)
  const [editingYear, setEditingYear] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)

  // Conference Championship states
  const [ccMadeChampionship, setCCMadeChampionship] = useState(null) // null = not answered, true/false = answered
  const [ccOpponent, setCCOpponent] = useState('')
  const [ccOpponentSearch, setCCOpponentSearch] = useState('')
  const [showCCOpponentDropdown, setShowCCOpponentDropdown] = useState(false)
  const [showCCGameModal, setShowCCGameModal] = useState(false)

  // Coordinator firing states (for HC only during CC week)
  const [firingCoordinators, setFiringCoordinators] = useState(null) // null = not asked, false = no, true = yes
  const [coordinatorToFire, setCoordinatorToFire] = useState('') // 'oc', 'dc', or 'both'

  // New job states (for Bowl Week 1)
  const [takingNewJob, setTakingNewJob] = useState(null) // null = not answered, true/false = answered
  const [newJobTeam, setNewJobTeam] = useState('')
  const [newJobPosition, setNewJobPosition] = useState('')
  const [newJobTeamSearch, setNewJobTeamSearch] = useState('')
  const [showNewJobTeamDropdown, setShowNewJobTeamDropdown] = useState(false)

  // Restore CC state from saved dynasty data
  useEffect(() => {
    if (currentDynasty?.conferenceChampionshipData) {
      const ccData = currentDynasty.conferenceChampionshipData
      setCCMadeChampionship(ccData.madeChampionship ?? null)
      setCCOpponent(ccData.opponent || '')
      // Restore pending firing selection
      const pending = ccData.pendingFiring
      if (pending !== undefined) {
        setCoordinatorToFire(pending)
        setFiringCoordinators(pending !== 'none' && pending !== '')
      } else {
        setFiringCoordinators(null)
        setCoordinatorToFire('')
      }
    } else {
      // Reset when no data
      setCCMadeChampionship(null)
      setCCOpponent('')
      setFiringCoordinators(null)
      setCoordinatorToFire('')
    }
  }, [currentDynasty?.id, currentDynasty?.conferenceChampionshipData])

  // Restore bowl eligibility state from saved dynasty data
  useEffect(() => {
    if (currentDynasty?.bowlEligibilityData) {
      const bowlData = currentDynasty.bowlEligibilityData
      setBowlEligible(bowlData.eligible ?? null)
      setSelectedBowl(bowlData.bowlGame || '')
      setBowlOpponent(bowlData.opponent || '')
    } else {
      // Reset when no data
      setBowlEligible(null)
      setSelectedBowl('')
      setBowlOpponent('')
    }
  }, [currentDynasty?.id, currentDynasty?.bowlEligibilityData])

  // Restore new job state from saved dynasty data
  // If user declined in a previous week, reset so they can be asked again
  useEffect(() => {
    if (currentDynasty?.newJobData) {
      const jobData = currentDynasty.newJobData

      // If user declined but in a different week, reset the question
      if (jobData.takingNewJob === false && jobData.declinedInWeek !== currentDynasty.currentWeek) {
        setTakingNewJob(null)
        setNewJobTeam('')
        setNewJobPosition('')
      } else {
        setTakingNewJob(jobData.takingNewJob ?? null)
        setNewJobTeam(jobData.team || '')
        setNewJobPosition(jobData.position || '')
      }
    } else {
      // Reset when no data
      setTakingNewJob(null)
      setNewJobTeam('')
      setNewJobPosition('')
    }
  }, [currentDynasty?.id, currentDynasty?.newJobData, currentDynasty?.currentWeek])

  if (!currentDynasty) return null

  // Get the user's team conference (from custom conferences or default)
  const getUserTeamConference = () => {
    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
    if (!teamAbbr) return null

    // Check custom conferences first
    if (currentDynasty.conferences && Object.keys(currentDynasty.conferences).length > 0) {
      for (const [confName, teams] of Object.entries(currentDynasty.conferences)) {
        if (teams.includes(teamAbbr)) {
          return confName
        }
      }
    }

    // Fall back to default conference mapping
    return getTeamConference(teamAbbr)
  }

  const userTeamConference = getUserTeamConference()

  const getTeamNameFromAbbr = (abbr) => {
    return teamAbbreviations[abbr]?.name || abbr
  }

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
      'MZST': 'Missouri State Bears',
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
      // Additional/alternative abbreviations
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

  const getOpponentColors = (abbr) => {
    let team = teamAbbreviations[abbr]

    // If team is a string, it means abbr was a mascot name and we got back the abbreviation
    // Look up again with the actual abbreviation
    if (typeof team === 'string') {
      team = teamAbbreviations[team]
    }

    const mascotName = getMascotName(abbr)
    const colors = mascotName ? getTeamColors(mascotName) : null

    if (team && typeof team === 'object') {
      return {
        backgroundColor: team.backgroundColor,
        textColor: team.textColor,
        secondaryColor: colors?.secondary || team.textColor
      }
    }
    // Fallback to white background with dark text
    return {
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      secondaryColor: '#1f2937'
    }
  }

  const handleScheduleSave = async (schedule) => {
    await saveSchedule(currentDynasty.id, schedule)
  }

  const handleRosterSave = async (players) => {
    await saveRoster(currentDynasty.id, players)
  }

  const handleTeamRatingsSave = async (ratings) => {
    await saveTeamRatings(currentDynasty.id, ratings)
  }

  const handleCoachingStaffSave = async (staff) => {
    await saveCoachingStaff(currentDynasty.id, staff)
  }

  const handleGameSave = async (gameData) => {
    try {
      // Check if this is a CFP First Round game (editingWeek is set to 'CFP First Round')
      const isCFPFirstRound = editingWeek === 'CFP First Round'
      await addGame(currentDynasty.id, {
        ...gameData,
        ...(isCFPFirstRound && { isCFPFirstRound: true })
      })
      // Close the modal after successful save
      setShowGameModal(false)
      setEditingWeek(null)
      setEditingYear(null)
    } catch (error) {
      console.error('Error in handleGameSave:', error)
      alert('Failed to save game. Please try again.')
      throw error
    }
  }

  // Handle CC championship answer
  const handleCCAnswer = async (madeChampionship) => {
    setCCMadeChampionship(madeChampionship)
    // Save to dynasty
    await updateDynasty(currentDynasty.id, {
      conferenceChampionshipData: {
        ...currentDynasty.conferenceChampionshipData,
        madeChampionship,
        year: currentDynasty.currentYear
      }
    })
  }

  // Handle CC opponent selection
  const handleCCOpponentSelect = async (opponent) => {
    setCCOpponent(opponent)
    setCCOpponentSearch('')
    setShowCCOpponentDropdown(false)
    // Save to dynasty
    await updateDynasty(currentDynasty.id, {
      conferenceChampionshipData: {
        ...currentDynasty.conferenceChampionshipData,
        opponent,
        year: currentDynasty.currentYear
      }
    })
  }

  // Handle CC game save
  const handleCCGameSave = async (gameData) => {
    try {
      // Add the game with special flag for conference championship
      await addGame(currentDynasty.id, {
        ...gameData,
        isConferenceChampionship: true
      })
      // Update CC data with game played flag
      await updateDynasty(currentDynasty.id, {
        conferenceChampionshipData: {
          ...currentDynasty.conferenceChampionshipData,
          gamePlayed: true,
          year: currentDynasty.currentYear
        }
      })
      setShowCCGameModal(false)
    } catch (error) {
      console.error('Error saving CC game:', error)
      alert('Failed to save game. Please try again.')
      throw error
    }
  }

  // Handle user's bowl game save
  const handleBowlGameSave = async (gameData) => {
    try {
      // Get the bowl week from the selected bowl
      const bowlWeek = currentDynasty.bowlEligibilityData?.bowlGame
        ? (isBowlInWeek1(currentDynasty.bowlEligibilityData.bowlGame) ? 1 : 2)
        : 1
      // Add the game with special flag for bowl game
      await addGame(currentDynasty.id, {
        ...gameData,
        isBowlGame: true,
        bowlName: currentDynasty.bowlEligibilityData?.bowlGame || selectedBowl,
        bowlWeek: bowlWeek
      })
      setShowBowlGameModal(false)
    } catch (error) {
      console.error('Error saving bowl game:', error)
      alert('Failed to save game. Please try again.')
      throw error
    }
  }

  // Check if user can advance from CC week
  const canAdvanceFromCC = () => {
    // First check CC game/championship status
    let ccComplete = false
    if (ccMadeChampionship === false) {
      ccComplete = true
    } else if (ccMadeChampionship === true) {
      const ccGame = currentDynasty.games?.find(
        g => g.isConferenceChampionship && g.year === currentDynasty.currentYear
      )
      ccComplete = !!ccGame
    }

    if (!ccComplete) return false

    // If HC with at least one coordinator, must make firing selection
    const hasCoordinators = currentDynasty.coachPosition === 'HC' &&
      (currentDynasty.coachingStaff?.ocName || currentDynasty.coachingStaff?.dcName)
    if (hasCoordinators) {
      // Must have made a selection (including 'none')
      return coordinatorToFire !== ''
    }

    return true
  }

  // Handle coordinator firing dropdown selection
  // Only saves to pendingFiring - actual firing happens on advance
  const handleFiringSelection = async (selection) => {
    setCoordinatorToFire(selection)
    setFiringCoordinators(selection !== 'none')

    // Save pending firing decision (actual firing happens on advance week)
    await updateDynasty(currentDynasty.id, {
      conferenceChampionshipData: {
        ...currentDynasty.conferenceChampionshipData,
        pendingFiring: selection, // 'none', 'oc', 'dc', or 'both'
        year: currentDynasty.currentYear
      }
    })
  }

  // Get CC game if played
  const getCCGame = () => {
    return currentDynasty.games?.find(
      g => g.isConferenceChampionship && g.year === currentDynasty.currentYear
    )
  }

  // Filter teams for CC opponent dropdown
  const getFilteredTeams = () => {
    const search = ccOpponentSearch.toLowerCase()
    const allTeams = Object.entries(teamAbbreviations)

    if (!search) {
      // Show all teams sorted alphabetically by name when no search
      return allTeams.sort((a, b) => a[1].name.localeCompare(b[1].name))
    }

    return allTeams
      .filter(([abbr, team]) =>
        abbr.toLowerCase().includes(search) ||
        team.name.toLowerCase().includes(search)
      )
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
  }

  const canAdvanceFromPreseason = () => {
    // Note: conferencesEntered is NOT required - default conferences are always valid
    // The task shows as optional/incomplete until user customizes, but doesn't block advancement
    const baseRequirements =
      currentDynasty.preseasonSetup?.scheduleEntered &&
      currentDynasty.preseasonSetup?.rosterEntered &&
      currentDynasty.preseasonSetup?.teamRatingsEntered

    // If user is Head Coach, they must also enter coaching staff (coordinators)
    if (currentDynasty.coachPosition === 'HC') {
      return baseRequirements && currentDynasty.preseasonSetup?.coachingStaffEntered
    }

    return baseRequirements
  }

  const getPhaseDisplay = (phase, week) => {
    if (phase === 'postseason') {
      return `Bowl Week ${week}`
    }
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      offseason: 'Off-Season'
    }
    return phases[phase] || phase
  }

  const currentYearGames = currentDynasty.games
    .filter(g => g.year === currentDynasty.currentYear)
    .sort((a, b) => a.week - b.week)

  return (
    <div className="space-y-6">
      {/* Note: Google Sheets are now created lazily when user opens entry modals */}

      {/* New Job Banner - show when user is taking a new job */}
      {takingNewJob === true && newJobTeam && newJobPosition && (() => {
        // newJobTeam is already the full display name (e.g., "Delaware Fightin' Blue Hens")
        const newTeamLogo = getTeamLogo(newJobTeam)
        const newTeamColors = getTeamColors(newJobTeam) || { primary: '#333', secondary: '#fff' }
        const newTeamPrimaryText = getContrastTextColor(newTeamColors.primary)

        return (
          <div
            className="rounded-lg shadow-lg p-4 flex items-center gap-4"
            style={{
              backgroundColor: newTeamColors.primary,
              border: `3px solid ${newTeamColors.secondary}`
            }}
          >
            {newTeamLogo && (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: `2px solid ${newTeamColors.secondary}`,
                  padding: '3px'
                }}
              >
                <img
                  src={newTeamLogo}
                  alt="New team logo"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: newTeamPrimaryText, opacity: 0.7 }}>
                Taking New Job
              </div>
              <div className="text-lg font-bold" style={{ color: newTeamPrimaryText }}>
                {newJobPosition === 'HC' ? 'Head Coach' : newJobPosition === 'OC' ? 'Offensive Coordinator' : 'Defensive Coordinator'} - {teamAbbreviations[newJobTeam]?.name || newJobTeam}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Team Info Header */}
      {(() => {
        // Calculate team record from current year games
        const wins = currentYearGames.filter(g => g.result === 'win').length
        const losses = currentYearGames.filter(g => g.result === 'loss').length
        // Get rank from the most recent game (if unranked, userRank will be null/undefined)
        const lastGame = currentYearGames.length > 0 ? currentYearGames[currentYearGames.length - 1] : null
        const currentRank = lastGame?.userRank

        return (
          <div
            className="rounded-lg shadow-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            style={{
              backgroundColor: teamColors.primary,
              border: `3px solid ${teamColors.secondary}`
            }}
          >
            <Link
              to={`/dynasty/${currentDynasty.id}/team/${getAbbreviationFromDisplayName(currentDynasty.teamName)}/${currentDynasty.currentYear}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0"
            >
              {getTeamLogo(currentDynasty.teamName) && (
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${teamColors.secondary}`,
                    padding: '3px'
                  }}
                >
                  <img
                    src={getTeamLogo(currentDynasty.teamName)}
                    alt={`${currentDynasty.teamName} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-bold truncate" style={{ color: primaryBgText }}>
                  {currentRank && <span className="mr-1 sm:mr-2">#{currentRank}</span>}
                  {currentDynasty.teamName}
                </h2>
                <p className="text-xs sm:text-sm font-semibold" style={{ color: primaryBgText, opacity: 0.8 }}>
                  {wins}-{losses}{currentDynasty.currentPhase !== 'preseason' && currentDynasty.conference && ` • ${currentDynasty.conference}`}
                </p>
              </div>
            </Link>
            {currentDynasty.teamRatings && (
              <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start">
                <div className="text-center px-2 sm:px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>OVR</div>
                  <div className="text-sm sm:text-lg font-bold" style={{ color: secondaryBgText }}>{currentDynasty.teamRatings.overall}</div>
                </div>
                <div className="text-center px-2 sm:px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>OFF</div>
                  <div className="text-sm sm:text-lg font-bold" style={{ color: secondaryBgText }}>{currentDynasty.teamRatings.offense}</div>
                </div>
                <div className="text-center px-2 sm:px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>DEF</div>
                  <div className="text-sm sm:text-lg font-bold" style={{ color: secondaryBgText }}>{currentDynasty.teamRatings.defense}</div>
                </div>
                <button
                  onClick={() => setShowTeamRatingsModal(true)}
                  className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: primaryBgText }}
                  title="Edit Team Ratings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Phase-Specific Content */}
      {currentDynasty.currentPhase === 'preseason' ? (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
            Pre-Season Setup
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {[
              {
                num: 1,
                title: 'Enter Schedule',
                done: currentDynasty.preseasonSetup?.scheduleEntered,
                scheduleCount: currentDynasty.schedule?.length || 0,
                action: () => setShowScheduleModal(true),
                actionText: currentDynasty.preseasonSetup?.scheduleEntered ? 'Edit' : 'Enter'
              },
              {
                num: 2,
                title: 'Enter Roster',
                done: currentDynasty.preseasonSetup?.rosterEntered,
                playerCount: currentDynasty.players?.length || 0,
                action: () => setShowRosterModal(true),
                actionText: currentDynasty.preseasonSetup?.rosterEntered ? 'Edit' : 'Enter'
              },
              {
                num: 3,
                title: 'Enter Team Ratings',
                done: currentDynasty.preseasonSetup?.teamRatingsEntered,
                teamRatings: currentDynasty.teamRatings,
                action: () => setShowTeamRatingsModal(true),
                actionText: currentDynasty.preseasonSetup?.teamRatingsEntered ? 'Edit' : 'Add Ratings'
              },
              {
                num: 4,
                title: 'Custom Conferences',
                done: currentDynasty.preseasonSetup?.conferencesEntered,
                conferences: currentDynasty.customConferences,
                action: () => setShowConferencesModal(true),
                actionText: currentDynasty.preseasonSetup?.conferencesEntered ? 'Edit' : 'Set Up'
              },
              // Only show coaching staff task for Head Coaches
              ...(currentDynasty.coachPosition === 'HC' ? [{
                num: 5,
                title: 'Enter Coordinators',
                done: currentDynasty.preseasonSetup?.coachingStaffEntered,
                coachingStaff: currentDynasty.coachingStaff,
                action: () => setShowCoachingStaffModal(true),
                actionText: currentDynasty.preseasonSetup?.coachingStaffEntered ? 'Edit' : 'Add Staff'
              }] : [])
            ].map(item => {
              return (
              <div
                key={item.num}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 ${
                  item.done ? 'border-green-200 bg-green-50' : ''
                }`}
                style={!item.done ? {
                  borderColor: `${teamColors.primary}30`,
                  backgroundColor: teamColors.secondary
                } : {}}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.done ? 'bg-green-500 text-white' : ''
                    }`}
                    style={!item.done ? {
                      backgroundColor: `${teamColors.primary}20`,
                      color: teamColors.primary
                    } : {}}
                  >
                    {item.done ? (
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="font-bold text-sm sm:text-lg">{item.num}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-semibold text-sm sm:text-base"
                      style={{ color: item.done ? '#16a34a' : secondaryBgText }}
                    >
                      {item.title}
                    </div>
                    {item.scheduleCount !== undefined && (
                      <div
                        className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.scheduleCount}/12 games
                        {item.done && <span className="ml-1 sm:ml-2">✓ Ready</span>}
                      </div>
                    )}
                    {item.playerCount !== undefined && (
                      <div
                        className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.playerCount}/85 players
                        {item.done && <span className="ml-1 sm:ml-2">✓ Ready</span>}
                      </div>
                    )}
                    {item.teamRatings && (
                      <div
                        className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.teamRatings.overall ? `${item.teamRatings.overall} OVR • ${item.teamRatings.offense} OFF • ${item.teamRatings.defense} DEF` : 'Not entered'}
                        {item.done && <span className="ml-1 sm:ml-2">✓ Ready</span>}
                      </div>
                    )}
                    {item.coachingStaff !== undefined && (
                      <div
                        className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium truncate"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.coachingStaff?.ocName && item.coachingStaff?.dcName
                          ? `OC: ${item.coachingStaff.ocName} • DC: ${item.coachingStaff.dcName}`
                          : 'Not entered'}
                        {item.done && <span className="ml-1 sm:ml-2">✓ Ready</span>}
                      </div>
                    )}
                    {item.conferences !== undefined && (
                      <div
                        className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.conferences
                          ? `${Object.keys(item.conferences).length} conferences configured`
                          : 'Default EA CFB 26 alignment'}
                        {item.done && <span className="ml-1 sm:ml-2">✓ Ready</span>}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={item.action}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                  style={item.optional && !item.done ? {
                    backgroundColor: `${secondaryBgText}20`,
                    color: secondaryBgText
                  } : {
                    backgroundColor: teamColors.primary,
                    color: primaryBgText
                  }}
                >
                  {item.actionText}
                </button>
              </div>
            )
            })}
          </div>

          {canAdvanceFromPreseason() && (
            <div
              className="mt-6 p-4 rounded-lg border-2"
              style={{
                backgroundColor: `${teamColors.primary}10`,
                borderColor: teamColors.primary
              }}
            >
              <p className="text-sm font-medium" style={{ color: teamColors.primary }}>
                ✓ Pre-season setup complete! Click "Advance Week" in the header to start the season.
              </p>
            </div>
          )}
        </div>
      ) : currentDynasty.currentPhase === 'regular_season' ? (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: secondaryBgText }}>
            {currentDynasty.currentYear} Regular Season
          </h3>
          <div className="space-y-3">
            {(() => {
              const scheduledGame = currentDynasty.schedule?.find(g => Number(g.week) === Number(currentDynasty.currentWeek))
              const playedGame = currentDynasty.games?.find(
                g => Number(g.week) === Number(currentDynasty.currentWeek) && Number(g.year) === Number(currentDynasty.currentYear)
              )
              const mascotName = scheduledGame ? getMascotName(scheduledGame.opponent) : null
              const opponentName = mascotName || (scheduledGame ? getTeamNameFromAbbr(scheduledGame.opponent) : 'TBD')

              return (
                <div
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                    playedGame ? 'border-green-200 bg-green-50' : ''
                  }`}
                  style={!playedGame ? {
                    borderColor: `${teamColors.primary}30`,
                    backgroundColor: teamColors.secondary
                  } : {}}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        playedGame ? 'bg-green-500 text-white' : ''
                      }`}
                      style={!playedGame ? {
                        backgroundColor: `${teamColors.primary}20`,
                        color: teamColors.primary
                      } : {}}
                    >
                      {playedGame ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="font-bold text-lg">{currentDynasty.currentWeek}</span>
                      )}
                    </div>
                    <div>
                      <div
                        className="font-semibold"
                        style={{ color: playedGame ? '#16a34a' : secondaryBgText }}
                      >
                        Week {currentDynasty.currentWeek} {scheduledGame ? (scheduledGame.location === 'away' ? '@' : 'vs') : ''} {opponentName}
                      </div>
                      {playedGame && (
                        <div
                          className="text-sm mt-1 font-medium"
                          style={{ color: '#16a34a' }}
                        >
                          {playedGame.result === 'win' ? 'W' : 'L'} {playedGame.teamScore}-{playedGame.opponentScore}
                          <span className="ml-2">✓ Complete</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGameModal(true)}
                    className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                    style={{
                      backgroundColor: teamColors.primary,
                      color: primaryBgText
                    }}
                  >
                    {playedGame ? 'Edit' : 'Enter Game'}
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      ) : currentDynasty.currentPhase === 'conference_championship' ? (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
            Conference Championship Week
          </h3>

          {(() => {
            const ccGame = getCCGame()

            // Step 1: Ask if they made the championship
            if (ccMadeChampionship === null) {
              return (
                <div className="space-y-3 sm:space-y-4">
                  <p className="text-base sm:text-lg font-medium" style={{ color: secondaryBgText }}>
                    Did you make the {userTeamConference} Championship?
                  </p>
                  <div className="flex gap-3 sm:gap-4">
                    <button
                      onClick={() => handleCCAnswer(true)}
                      className="flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm sm:text-base"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: primaryBgText
                      }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleCCAnswer(false)}
                      className="flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm sm:text-base"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: primaryBgText
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>
              )
            }

            // Step 2: If they said No, show completion message and coordinator firing question
            if (ccMadeChampionship === false) {
              const hasCoordinators = currentDynasty.coachPosition === 'HC' &&
                (currentDynasty.coachingStaff?.ocName || currentDynasty.coachingStaff?.dcName)

              return (
                <div className="space-y-3 sm:space-y-4">
                  <div
                    className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-green-200 bg-green-50"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-green-500 text-white flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-semibold text-green-700">
                        Conference Championship Week Complete
                      </div>
                    </div>
                  </div>

                  {/* Coordinator firing dropdown for HC */}
                  {hasCoordinators && (
                    <div className="mt-3 sm:mt-4">
                      <p className="text-base sm:text-lg font-medium mb-2 sm:mb-3" style={{ color: secondaryBgText }}>
                        Coordinator Changes
                      </p>
                      <select
                        value={coordinatorToFire}
                        onChange={(e) => handleFiringSelection(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold cursor-pointer text-sm sm:text-base"
                        style={{
                          backgroundColor: teamColors.primary,
                          color: primaryBgText
                        }}
                      >
                        <option value="">Select an option...</option>
                        <option value="none">Keep both coordinators</option>
                        {currentDynasty.coachingStaff?.ocName && (
                          <option value="oc">Fire {currentDynasty.coachingStaff.ocName} (OC)</option>
                        )}
                        {currentDynasty.coachingStaff?.dcName && (
                          <option value="dc">Fire {currentDynasty.coachingStaff.dcName} (DC)</option>
                        )}
                        {currentDynasty.coachingStaff?.ocName && currentDynasty.coachingStaff?.dcName && (
                          <option value="both">Fire Both</option>
                        )}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      setCCMadeChampionship(null)
                      setCCOpponent('')
                      // Clear saved opponent data so it doesn't auto-restore
                      await updateDynasty(currentDynasty.id, {
                        conferenceChampionshipData: {
                          ...currentDynasty.conferenceChampionshipData,
                          opponent: null
                        }
                      })
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                    style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                  >
                    Edit
                  </button>
                </div>
              )
            }

            // Step 3: They made it - ask who they played (if no opponent yet)
            if (ccMadeChampionship === true && !ccOpponent && !ccGame) {
              return (
                <div className="space-y-3 sm:space-y-4">
                  <p className="text-base sm:text-lg font-medium" style={{ color: secondaryBgText }}>
                    Congratulations! Who did you play in the {currentDynasty.conference} Championship?
                  </p>
                  <SearchableSelect
                    options={teams}
                    value=""
                    onChange={(teamName) => {
                      const abbr = getAbbreviationFromDisplayName(teamName)
                      if (abbr) {
                        handleCCOpponentSelect(abbr)
                      }
                    }}
                    placeholder="Search for opponent..."
                    teamColors={teamColors}
                  />
                  <button
                    onClick={async () => {
                      setCCMadeChampionship(null)
                      setCCOpponent('')
                      // Clear saved opponent data so it doesn't auto-restore
                      await updateDynasty(currentDynasty.id, {
                        conferenceChampionshipData: {
                          ...currentDynasty.conferenceChampionshipData,
                          opponent: null
                        }
                      })
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                    style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                  >
                    Edit
                  </button>
                </div>
              )
            }

            // Step 4: Opponent selected - show game entry or result
            if (ccMadeChampionship === true && (ccOpponent || ccGame)) {
              const opponentAbbr = ccGame?.opponent || ccOpponent
              const opponentColors = getOpponentColors(opponentAbbr)
              const opponentName = getMascotName(opponentAbbr) || getTeamNameFromAbbr(opponentAbbr)
              const opponentLogo = getMascotName(opponentAbbr) ? getTeamLogo(getMascotName(opponentAbbr)) : null

              return (
                <div className="space-y-3 sm:space-y-4">
                  <div
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                      ccGame ? 'border-green-200 bg-green-50' : ''
                    }`}
                    style={!ccGame ? {
                      borderColor: `${teamColors.primary}30`,
                      backgroundColor: teamColors.secondary
                    } : {}}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          ccGame ? 'bg-green-500 text-white' : ''
                        }`}
                        style={!ccGame ? {
                          backgroundColor: '#FFFFFF',
                          padding: '2px'
                        } : {}}
                      >
                        {ccGame ? (
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          getConferenceLogo(userTeamConference) ? (
                            <img
                              src={getConferenceLogo(userTeamConference)}
                              alt={`${userTeamConference} logo`}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                          )
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-sm sm:text-base font-semibold"
                          style={{ color: ccGame ? '#16a34a' : secondaryBgText }}
                        >
                          {userTeamConference} Championship Game
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                          <span className="text-xs sm:text-sm" style={{ color: ccGame ? '#16a34a' : secondaryBgText, opacity: 0.8 }}>
                            vs
                          </span>
                          {opponentLogo && (
                            <div
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: `1px solid ${opponentColors.textColor}`,
                                padding: '2px'
                              }}
                            >
                              <img
                                src={opponentLogo}
                                alt={`${opponentName} logo`}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <span
                            className="px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm font-bold truncate max-w-[150px] sm:max-w-none"
                            style={{
                              backgroundColor: opponentColors.backgroundColor,
                              color: opponentColors.textColor
                            }}
                          >
                            {opponentName}
                          </span>
                        </div>
                        {ccGame && (
                          <div
                            className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium"
                            style={{ color: '#16a34a' }}
                          >
                            {ccGame.result === 'win' ? 'W' : 'L'} {ccGame.teamScore}-{ccGame.opponentScore}
                            <span className="ml-2">✓ Complete</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCCGameModal(true)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm self-end sm:self-auto"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: primaryBgText
                      }}
                    >
                      {ccGame ? 'Edit' : 'Enter Game'}
                    </button>
                  </div>

                  {ccGame && (() => {
                    const hasCoordinators = currentDynasty.coachPosition === 'HC' &&
                      (currentDynasty.coachingStaff?.ocName || currentDynasty.coachingStaff?.dcName)

                    return (
                      <>
                        {/* Coordinator firing dropdown for HC */}
                        {hasCoordinators && (
                          <div className="mt-4">
                            <p className="text-lg font-medium mb-3" style={{ color: secondaryBgText }}>
                              Coordinator Changes
                            </p>
                            <select
                              value={coordinatorToFire}
                              onChange={(e) => handleFiringSelection(e.target.value)}
                              className="w-full px-4 py-3 rounded-lg font-semibold cursor-pointer"
                              style={{
                                backgroundColor: teamColors.primary,
                                color: primaryBgText
                              }}
                            >
                              <option value="">Select an option...</option>
                              <option value="none">Keep both coordinators</option>
                              {currentDynasty.coachingStaff?.ocName && (
                                <option value="oc">Fire {currentDynasty.coachingStaff.ocName} (OC)</option>
                              )}
                              {currentDynasty.coachingStaff?.dcName && (
                                <option value="dc">Fire {currentDynasty.coachingStaff.dcName} (DC)</option>
                              )}
                              {currentDynasty.coachingStaff?.ocName && currentDynasty.coachingStaff?.dcName && (
                                <option value="both">Fire Both</option>
                              )}
                            </select>
                          </div>
                        )}

                        {/* Advance message - only show when firing decision is complete or not applicable */}
                        {(!hasCoordinators || coordinatorToFire !== '') && (
                          <div
                            className="p-4 rounded-lg border-2"
                            style={{
                              backgroundColor: `${teamColors.primary}10`,
                              borderColor: teamColors.primary
                            }}
                          >
                            <p className="text-sm font-medium" style={{ color: teamColors.primary }}>
                              ✓ Conference Championship complete! Click "Advance Week" in the header to continue to the playoffs.
                            </p>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {!ccGame && (
                    <button
                      onClick={() => {
                        setCCOpponent('')
                        setCCMadeChampionship(null)
                      }}
                      className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                      style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              )
            }
          })()}
        </div>
      ) : currentDynasty.currentPhase === 'postseason' ? (
        // Postseason / Bowl Weeks
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          {(() => {
            const week = currentDynasty.currentWeek
            const hasCCData = currentDynasty.conferenceChampionships?.length > 0
            const hasCFPSeedsData = currentDynasty.cfpSeedsByYear?.[currentDynasty.currentYear]?.length > 0
            const hasCFPFirstRoundData = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.firstRound?.length > 0
            const hasBowlWeek1Data = currentDynasty.bowlGamesByYear?.[currentDynasty.currentYear]?.week1?.length > 0
            const hasBowlWeek2Data = currentDynasty.bowlGamesByYear?.[currentDynasty.currentYear]?.week2?.length > 0
            const userBowlGame = currentDynasty.games?.find(g => g.isBowlGame && g.year === currentDynasty.currentYear)
            const userCFPFirstRoundGame = currentDynasty.games?.find(g => g.isCFPFirstRound && g.year === currentDynasty.currentYear)
            const userBowlIsWeek1 = selectedBowl && isBowlInWeek1(selectedBowl)
            const userBowlIsWeek2 = selectedBowl && isBowlInWeek2(selectedBowl)

            // Filter team dropdown for bowl opponent
            const filteredBowlTeams = bowlOpponentSearch
              ? Object.entries(teamAbbreviations)
                  .filter(([abbr, data]) =>
                    abbr.toLowerCase().includes(bowlOpponentSearch.toLowerCase()) ||
                    data.name.toLowerCase().includes(bowlOpponentSearch.toLowerCase())
                  )
                  .slice(0, 8)
              : Object.entries(teamAbbreviations).slice(0, 8)

            // All bowl games for dropdown (CFP options removed - handled automatically)
            const allBowlGames = getAllBowlGamesList()

            // Check if user's team is in the CFP
            const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
            const cfpSeeds = currentDynasty.cfpSeedsByYear?.[currentDynasty.currentYear] || []
            const userCFPSeed = cfpSeeds.find(s => s.team === userTeamAbbr)?.seed || null

            // Calculate CFP first round opponent (5v12, 6v11, 7v10, 8v9)
            const getCFPFirstRoundOpponent = (seed) => {
              if (!seed || seed < 5 || seed > 12) return null
              const opponentSeed = 17 - seed // 5->12, 6->11, 7->10, 8->9
              return cfpSeeds.find(s => s.seed === opponentSeed)?.team || null
            }

            const userCFPOpponent = getCFPFirstRoundOpponent(userCFPSeed)
            const userHasCFPBye = userCFPSeed && userCFPSeed <= 4
            const userInCFPFirstRound = userCFPSeed && userCFPSeed >= 5 && userCFPSeed <= 12

            // Week 1: CC data, bowl eligibility question, then bowl results
            if (week === 1) {
              return (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                    Bowl Week 1
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Task 1: CC Results */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasCCData ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasCCData ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasCCData ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasCCData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasCCData ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasCCData ? '#16a34a' : secondaryBgText }}>
                            Conference Championship Results
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasCCData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasCCData ? '✓ Results entered' : '10 conference championships'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCCModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasCCData ? 'Edit' : 'Enter'}
                      </button>
                    </div>

                    {/* Task 2: CFP Seeds */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasCFPSeedsData ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasCFPSeedsData ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasCFPSeedsData ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasCFPSeedsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasCFPSeedsData ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">2</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasCFPSeedsData ? '#16a34a' : secondaryBgText }}>
                            CFP Seeds (1-12)
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasCFPSeedsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasCFPSeedsData ? '✓ Seeds entered' : '12 playoff teams'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCFPSeedsModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasCFPSeedsData ? 'Edit' : 'Enter'}
                      </button>
                    </div>

                    {/* Task 3: Bowl/CFP Status */}
                    {(() => {
                      const bowlTaskComplete = hasCFPSeedsData && (userHasCFPBye || userInCFPFirstRound || (bowlEligible !== null && (bowlEligible === false || (bowlEligible && selectedBowl && bowlOpponent))))
                      const showBowlEditButton = !userCFPSeed && bowlEligible !== null && (bowlEligible === false || (bowlEligible && selectedBowl && bowlOpponent))

                      return (
                        <div
                          className={`p-3 sm:p-4 rounded-lg border-2 ${bowlTaskComplete ? 'border-green-200 bg-green-50' : ''}`}
                          style={!bowlTaskComplete ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 ${!bowlTaskComplete || (!hasCFPSeedsData || bowlEligible === null || (!userCFPSeed && bowlEligible && (!selectedBowl || !bowlOpponent))) ? 'mb-3' : ''}`}>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bowlTaskComplete ? 'bg-green-500 text-white' : ''}`}
                                style={!bowlTaskComplete ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                              >
                                {bowlTaskComplete ? (
                                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : <span className="font-bold text-sm sm:text-base">3</span>}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base font-semibold" style={{ color: bowlTaskComplete ? '#16a34a' : secondaryBgText }}>
                                  {userCFPSeed ? 'Your CFP Game' : 'Your Bowl Game'}
                                </div>
                                {/* Show status text inline when complete */}
                                {userHasCFPBye && (
                                  <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                    ✓ #{userCFPSeed} Seed - Bye to Quarterfinals (Week 2)
                                  </div>
                                )}
                                {userInCFPFirstRound && (
                                  <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                    ✓ #{userCFPSeed} Seed vs #{17 - userCFPSeed} {getMascotName(userCFPOpponent)}
                                  </div>
                                )}
                                {!userCFPSeed && bowlEligible === false && (
                                  <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                    ✓ Not bowl eligible this year
                                  </div>
                                )}
                                {!userCFPSeed && bowlEligible && selectedBowl && bowlOpponent && (
                                  <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                    ✓ {selectedBowl} vs {bowlOpponent}
                                    {userBowlIsWeek2 && <span className="ml-2 opacity-70">(plays in Week 2)</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Edit button in header when bowl selection is complete */}
                            {showBowlEditButton && (
                              <button
                                onClick={async () => {
                                  setBowlEligible(null)
                                  setSelectedBowl('')
                                  setBowlOpponent('')
                                  // Remove any existing bowl game from games array
                                  const existingBowlGame = currentDynasty.games?.find(g => g.isBowlGame && g.year === currentDynasty.currentYear)
                                  const updatedGames = existingBowlGame
                                    ? currentDynasty.games.filter(g => !(g.isBowlGame && g.year === currentDynasty.currentYear))
                                    : currentDynasty.games
                                  await updateDynasty(currentDynasty.id, {
                                    bowlEligibilityData: null,
                                    games: updatedGames
                                  })
                                }}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Edit
                              </button>
                            )}
                          </div>

                          {/* Content area for incomplete states */}
                          {!hasCFPSeedsData && (
                            <div className="ml-13 pl-10">
                              <p className="text-sm" style={{ color: secondaryBgText, opacity: 0.7 }}>
                                Enter CFP Seeds first
                              </p>
                            </div>
                          )}
                          {hasCFPSeedsData && !userCFPSeed && bowlEligible === null && (
                            <div className="ml-13 pl-10">
                              <p className="mb-3" style={{ color: secondaryBgText, opacity: 0.8 }}>Did you make a bowl game?</p>
                              <div className="flex gap-3">
                                <button
                                  onClick={async () => {
                                    setBowlEligible(true)
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityData: { eligible: true, bowlGame: '', opponent: '' }
                                    })
                                  }}
                                  className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={async () => {
                                    setBowlEligible(false)
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityData: { eligible: false, bowlGame: null, opponent: null }
                                    })
                                  }}
                                  className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          )}
                          {hasCFPSeedsData && !userCFPSeed && bowlEligible === true && !selectedBowl && (
                            <div className="ml-13 pl-10">
                              <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>Which bowl game?</p>
                              <div className="max-w-xs">
                                <DropdownSelect
                                  options={allBowlGames}
                                  value={selectedBowl}
                                  onChange={async (bowl) => {
                                    setSelectedBowl(bowl)
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityData: { ...currentDynasty.bowlEligibilityData, eligible: true, bowlGame: bowl }
                                    })
                                  }}
                                  placeholder="Search bowls..."
                                  teamColors={teamColors}
                                />
                              </div>
                            </div>
                          )}
                          {hasCFPSeedsData && !userCFPSeed && bowlEligible === true && selectedBowl && !bowlOpponent && (
                            <div className="ml-13 pl-10">
                              <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>Playing in: <strong>{selectedBowl}</strong></p>
                              <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>Who is your opponent?</p>
                              <div className="max-w-xs">
                                <SearchableSelect
                                  options={teams}
                                  value={bowlOpponent}
                                  onChange={async (value) => {
                                    setBowlOpponent(value)
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityData: { ...currentDynasty.bowlEligibilityData, opponent: value }
                                    })
                                  }}
                                  placeholder="Search for opponent..."
                                  teamColors={teamColors}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Task 4: Enter YOUR CFP First Round Game (if seeded 5-12) */}
                    {hasCFPSeedsData && userInCFPFirstRound && (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          userCFPFirstRoundGame ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!userCFPFirstRoundGame ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              userCFPFirstRoundGame ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!userCFPFirstRoundGame ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {userCFPFirstRoundGame ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">4</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: userCFPFirstRoundGame ? '#16a34a' : secondaryBgText }}>
                              Enter Your CFP First Round Game
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: userCFPFirstRoundGame ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {userCFPFirstRoundGame ? `✓ ${userCFPFirstRoundGame.result === 'W' ? 'Won' : 'Lost'} ${userCFPFirstRoundGame.teamScore}-${userCFPFirstRoundGame.opponentScore}` : `#${userCFPSeed} vs #${17 - userCFPSeed} ${getMascotName(userCFPOpponent)}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            // Set up for CFP First Round game entry
                            setEditingWeek('CFP First Round')
                            setEditingYear(currentDynasty.currentYear)
                            setShowGameModal(true)
                          }}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          {userCFPFirstRoundGame ? 'Edit' : 'Enter'}
                        </button>
                      </div>
                    )}

                    {/* Task 4b: Enter YOUR Bowl Game (if Week 1 bowl, non-CFP team) */}
                    {hasCFPSeedsData && !userCFPSeed && bowlEligible && selectedBowl && bowlOpponent && userBowlIsWeek1 && (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          userBowlGame ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!userBowlGame ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              userBowlGame ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!userBowlGame ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {userBowlGame ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">4</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: userBowlGame ? '#16a34a' : secondaryBgText }}>
                              Enter Your {selectedBowl} Game
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: userBowlGame ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {userBowlGame ? `✓ ${userBowlGame.result === 'W' ? 'Won' : 'Lost'} ${userBowlGame.teamScore}-${userBowlGame.opponentScore}` : `vs ${bowlOpponent}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowBowlGameModal(true)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          {userBowlGame ? 'Edit' : 'Enter'}
                        </button>
                      </div>
                    )}

                    {/* Task: Taking a New Job? */}
                    <div
                      className={`p-3 sm:p-4 rounded-lg border-2 ${
                        takingNewJob !== null ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={takingNewJob === null ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 ${takingNewJob === null || (takingNewJob === true && (!newJobTeam || !newJobPosition)) ? 'mb-3' : ''}`}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              takingNewJob !== null ? 'bg-green-500 text-white' : ''
                            }`}
                            style={takingNewJob === null ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {takingNewJob !== null ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">5</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: takingNewJob !== null ? '#16a34a' : secondaryBgText }}>
                              Taking a New Job? (Bowl Week 1)
                            </div>
                            {takingNewJob === true && newJobTeam && newJobPosition && (
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                ✓ {newJobPosition} at {teamAbbreviations[newJobTeam]?.name || newJobTeam}
                              </div>
                            )}
                            {takingNewJob === false && (
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                ✓ Staying with current team
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Edit button in header when complete */}
                        {(takingNewJob === false || (takingNewJob === true && newJobTeam && newJobPosition)) && (
                          <button
                            onClick={async () => {
                              setTakingNewJob(null)
                              setNewJobTeam('')
                              setNewJobPosition('')
                              await updateDynasty(currentDynasty.id, {
                                newJobData: null
                              })
                            }}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {takingNewJob === null && (
                        <div className="ml-13 pl-10">
                          <div className="flex gap-3">
                            <button
                              onClick={async () => {
                                setTakingNewJob(true)
                                await updateDynasty(currentDynasty.id, {
                                  newJobData: { takingNewJob: true, team: '', position: '' }
                                })
                              }}
                              className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={async () => {
                                setTakingNewJob(false)
                                await updateDynasty(currentDynasty.id, {
                                  newJobData: { takingNewJob: false, team: null, position: null, declinedInWeek: currentDynasty.currentWeek }
                                })
                              }}
                              className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}
                      {takingNewJob === true && !newJobTeam && (
                        <div className="ml-13 pl-10">
                          <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>Which team?</p>
                          <div className="max-w-xs">
                            <SearchableSelect
                              options={teams}
                              value={newJobTeam}
                              onChange={async (value) => {
                                setNewJobTeam(value)
                                await updateDynasty(currentDynasty.id, {
                                  newJobData: { ...currentDynasty.newJobData, team: value }
                                })
                              }}
                              placeholder="Search for team..."
                              teamColors={teamColors}
                            />
                          </div>
                        </div>
                      )}
                      {takingNewJob === true && newJobTeam && !newJobPosition && (
                        <div className="ml-13 pl-10">
                          <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>
                            New team: <strong>{teamAbbreviations[newJobTeam]?.name || newJobTeam}</strong>
                          </p>
                          <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>What position?</p>
                          <div className="flex gap-2 flex-wrap">
                            {['HC', 'OC', 'DC'].map(pos => (
                              <button
                                key={pos}
                                onClick={async () => {
                                  setNewJobPosition(pos)
                                  await updateDynasty(currentDynasty.id, {
                                    newJobData: { ...currentDynasty.newJobData, position: pos }
                                  })
                                }}
                                className="px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                {pos === 'HC' ? 'Head Coach' : pos === 'OC' ? 'Offensive Coordinator' : 'Defensive Coordinator'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </>
              )
            }

            // Week 2: Week 1 Bowl Results (incl. CFP First Round) + User's bowl game (if Week 2 bowl) + Week 2 bowl results
            if (week === 2) {
              return (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                    Bowl Week 2
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Task 1: Enter Week 1 Bowl Results (includes CFP First Round) */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasBowlWeek1Data ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasBowlWeek1Data ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasBowlWeek1Data ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasBowlWeek1Data ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasBowlWeek1Data ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasBowlWeek1Data ? '#16a34a' : secondaryBgText }}>
                            Week 1 Bowl Results
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasBowlWeek1Data ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasBowlWeek1Data ? '✓ Results entered' : '30 bowl games (incl. CFP First Round)'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowBowlWeek1Modal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasBowlWeek1Data ? 'Edit' : 'Enter'}
                      </button>
                    </div>

                    {/* Task 2: Enter YOUR Bowl Game (if Week 2 bowl) */}
                    {bowlEligible && selectedBowl && bowlOpponent && userBowlIsWeek2 && (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          userBowlGame ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!userBowlGame ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              userBowlGame ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!userBowlGame ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {userBowlGame ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">2</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: userBowlGame ? '#16a34a' : secondaryBgText }}>
                              Enter Your {selectedBowl} Game
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: userBowlGame ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {userBowlGame ? `✓ ${userBowlGame.result === 'W' ? 'Won' : 'Lost'} ${userBowlGame.teamScore}-${userBowlGame.opponentScore}` : `vs ${bowlOpponent}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowBowlGameModal(true)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          {userBowlGame ? 'Edit' : 'Enter'}
                        </button>
                      </div>
                    )}

                    {/* Task: Taking a New Job? (appears every bowl week until accepted) */}
                    {(() => {
                      // Task number is 2 if no Week 2 bowl game showing, 3 if showing
                      const newJobTaskNum = (bowlEligible && selectedBowl && bowlOpponent && userBowlIsWeek2) ? 3 : 2
                      return (
                    <div
                      className={`p-3 sm:p-4 rounded-lg border-2 ${
                        takingNewJob !== null ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={takingNewJob === null ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 ${takingNewJob === null || (takingNewJob === true && (!newJobTeam || !newJobPosition)) ? 'mb-3' : ''}`}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              takingNewJob !== null ? 'bg-green-500 text-white' : ''
                            }`}
                            style={takingNewJob === null ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {takingNewJob !== null ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">{newJobTaskNum}</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: takingNewJob !== null ? '#16a34a' : secondaryBgText }}>
                              Taking a New Job? (Bowl Week 2)
                            </div>
                            {takingNewJob === true && newJobTeam && newJobPosition && (
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                ✓ {newJobPosition} at {teamAbbreviations[newJobTeam]?.name || newJobTeam}
                              </div>
                            )}
                            {takingNewJob === false && (
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                ✓ Staying with current team
                              </div>
                            )}
                          </div>
                        </div>
                        {(takingNewJob === false || (takingNewJob === true && newJobTeam && newJobPosition)) && (
                          <button
                            onClick={async () => {
                              setTakingNewJob(null)
                              setNewJobTeam('')
                              setNewJobPosition('')
                              await updateDynasty(currentDynasty.id, {
                                newJobData: null
                              })
                            }}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {takingNewJob === null && (
                        <div className="ml-13 pl-10">
                          <div className="flex gap-3">
                            <button
                              onClick={async () => {
                                setTakingNewJob(true)
                                await updateDynasty(currentDynasty.id, {
                                  newJobData: { takingNewJob: true, team: '', position: '' }
                                })
                              }}
                              className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={async () => {
                                setTakingNewJob(false)
                                await updateDynasty(currentDynasty.id, {
                                  newJobData: { takingNewJob: false, team: null, position: null, declinedInWeek: currentDynasty.currentWeek }
                                })
                              }}
                              className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}
                      {takingNewJob === true && !newJobTeam && (
                        <div className="ml-13 pl-10">
                          <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>Which team?</p>
                          <div className="max-w-xs">
                            <SearchableSelect
                              options={teams}
                              value={newJobTeam}
                              onChange={async (value) => {
                                setNewJobTeam(value)
                                await updateDynasty(currentDynasty.id, {
                                  newJobData: { ...currentDynasty.newJobData, team: value }
                                })
                              }}
                              placeholder="Search for team..."
                              teamColors={teamColors}
                            />
                          </div>
                        </div>
                      )}
                      {takingNewJob === true && newJobTeam && !newJobPosition && (
                        <div className="ml-13 pl-10">
                          <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>
                            New team: <strong>{teamAbbreviations[newJobTeam]?.name || newJobTeam}</strong>
                          </p>
                          <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>What position?</p>
                          <div className="flex gap-2 flex-wrap">
                            {['HC', 'OC', 'DC'].map(pos => (
                              <button
                                key={pos}
                                onClick={async () => {
                                  setNewJobPosition(pos)
                                  await updateDynasty(currentDynasty.id, {
                                    newJobData: { ...currentDynasty.newJobData, position: pos }
                                  })
                                }}
                                className="px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                {pos === 'HC' ? 'Head Coach' : pos === 'OC' ? 'Offensive Coordinator' : 'Defensive Coordinator'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                      )
                    })()}

                  </div>
                </>
              )
            }

            // Weeks 3-5: CFP rounds (Quarterfinals, Semifinals, Championship)
            const weekTitles = { 3: 'CFP Quarterfinals', 4: 'CFP Semifinals', 5: 'National Championship' }
            const weekGames = { 3: '4 games', 4: '2 games', 5: '1 game' }
            const cfpData = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.[`week${week}`] || []
            const hasCFPData = cfpData.length > 0

            return (
              <>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                  Bowl Week {week}
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {/* Week 2 Bowl Results - only show in Week 3 */}
                  {week === 3 && (
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasBowlWeek2Data ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasBowlWeek2Data ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasBowlWeek2Data ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasBowlWeek2Data ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasBowlWeek2Data ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasBowlWeek2Data ? '#16a34a' : secondaryBgText }}>
                            Week 2 Bowl Results
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasBowlWeek2Data ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasBowlWeek2Data ? '✓ Results entered' : '12 bowl games (incl. CFP Quarterfinals)'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowBowlWeek2Modal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasBowlWeek2Data ? 'Edit' : 'Enter'}
                      </button>
                    </div>
                  )}

                  {/* CFP Round - only show for weeks 4 and 5 (CFP QF is part of Bowl Week 2 results) */}
                  {week !== 3 && (
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasCFPData ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasCFPData ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasCFPData ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasCFPData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasCFPData ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasCFPData ? '#16a34a' : secondaryBgText }}>
                            {weekTitles[week]}
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasCFPData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasCFPData ? '✓ Results entered' : weekGames[week]}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowBowlScoreModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasCFPData ? 'Edit' : 'Enter'}
                      </button>
                    </div>
                  )}

                  {/* Task: Taking a New Job? (appears every bowl week until accepted) */}
                  <div
                    className={`p-3 sm:p-4 rounded-lg border-2 ${
                      takingNewJob !== null ? 'border-green-200 bg-green-50' : ''
                    }`}
                    style={takingNewJob === null ? { borderColor: `${teamColors.primary}30` } : {}}
                  >
                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 ${takingNewJob === null || (takingNewJob === true && (!newJobTeam || !newJobPosition)) ? 'mb-3' : ''}`}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            takingNewJob !== null ? 'bg-green-500 text-white' : ''
                          }`}
                          style={takingNewJob === null ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {takingNewJob !== null ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">2</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: takingNewJob !== null ? '#16a34a' : secondaryBgText }}>
                            Taking a New Job? (Bowl Week {week})
                          </div>
                          {takingNewJob === true && newJobTeam && newJobPosition && (
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                              ✓ {newJobPosition} at {teamAbbreviations[newJobTeam]?.name || newJobTeam}
                            </div>
                          )}
                          {takingNewJob === false && (
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                              ✓ Staying with current team
                            </div>
                          )}
                        </div>
                      </div>
                      {(takingNewJob === false || (takingNewJob === true && newJobTeam && newJobPosition)) && (
                        <button
                          onClick={async () => {
                            setTakingNewJob(null)
                            setNewJobTeam('')
                            setNewJobPosition('')
                            await updateDynasty(currentDynasty.id, {
                              newJobData: null
                            })
                          }}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {takingNewJob === null && (
                      <div className="ml-13 pl-10">
                        <div className="flex gap-3">
                          <button
                            onClick={async () => {
                              setTakingNewJob(true)
                              await updateDynasty(currentDynasty.id, {
                                newJobData: { takingNewJob: true, team: '', position: '' }
                              })
                            }}
                            className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={async () => {
                              setTakingNewJob(false)
                              await updateDynasty(currentDynasty.id, {
                                newJobData: { takingNewJob: false, team: null, position: null, declinedInWeek: currentDynasty.currentWeek }
                              })
                            }}
                            className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}
                    {takingNewJob === true && !newJobTeam && (
                      <div className="ml-13 pl-10">
                        <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>Which team?</p>
                        <div className="max-w-xs">
                          <SearchableSelect
                            options={teams}
                            value={newJobTeam}
                            onChange={async (value) => {
                              setNewJobTeam(value)
                              await updateDynasty(currentDynasty.id, {
                                newJobData: { ...currentDynasty.newJobData, team: value }
                              })
                            }}
                            placeholder="Search for team..."
                            teamColors={teamColors}
                          />
                        </div>
                      </div>
                    )}
                    {takingNewJob === true && newJobTeam && !newJobPosition && (
                      <div className="ml-13 pl-10">
                        <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>
                          New team: <strong>{teamAbbreviations[newJobTeam]?.name || newJobTeam}</strong>
                        </p>
                        <p className="mb-2" style={{ color: secondaryBgText, opacity: 0.8 }}>What position?</p>
                        <div className="flex gap-2 flex-wrap">
                          {['HC', 'OC', 'DC'].map(pos => (
                            <button
                              key={pos}
                              onClick={async () => {
                                setNewJobPosition(pos)
                                await updateDynasty(currentDynasty.id, {
                                  newJobData: { ...currentDynasty.newJobData, position: pos }
                                })
                              }}
                              className="px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              {pos === 'HC' ? 'Head Coach' : pos === 'OC' ? 'Offensive Coordinator' : 'Defensive Coordinator'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      ) : (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: secondaryBgText }}>
            Current Phase: {getPhaseDisplay(currentDynasty.currentPhase, currentDynasty.currentWeek)}
          </h3>
          <p style={{ color: secondaryBgText, opacity: 0.8 }}>
            Click "Advance Week" in the header to progress through your dynasty.
          </p>
        </div>
      )}

      {/* Schedule Section */}
      <div
        className="rounded-lg shadow-lg p-4 sm:p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold" style={{ color: secondaryBgText }}>
            {currentDynasty.currentYear} Schedule
          </h2>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="p-1.5 sm:p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: secondaryBgText }}
            title="Edit Schedule"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

{currentDynasty.schedule && currentDynasty.schedule.length > 0 ? (
          <div className="space-y-2">
            {currentDynasty.schedule.map((game, index) => {
              const playedGame = currentYearGames.find(g => Number(g.week) === Number(game.week))
              const opponentColors = getOpponentColors(game.opponent)
              const mascotName = getMascotName(game.opponent)
              const opponentName = mascotName || getTeamNameFromAbbr(game.opponent) // Use mascot name if available
              const opponentLogo = mascotName ? getTeamLogo(mascotName) : null
              const isCurrentWeek = currentDynasty.currentPhase === 'regular_season' &&
                Number(game.week) === Number(currentDynasty.currentWeek) && !playedGame

              return (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: opponentColors.backgroundColor,
                    borderColor: playedGame
                      ? playedGame.result === 'win'
                        ? '#86efac'
                        : '#fca5a5'
                      : isCurrentWeek
                        ? teamColors.primary
                        : opponentColors.backgroundColor,
                    boxShadow: isCurrentWeek ? `0 0 0 3px ${teamColors.primary}40, 0 4px 12px ${teamColors.primary}30` : 'none'
                  }}
                  onClick={() => {
                    if (playedGame) {
                      setSelectedGame(playedGame)
                    } else {
                      // Create a scheduled game object for viewing
                      setSelectedGame({
                        week: game.week,
                        opponent: game.opponent,
                        location: game.location,
                        year: currentDynasty.currentYear,
                        scheduled: true // Flag to indicate this is just scheduled, not played
                      })
                    }
                    setShowGameDetailModal(true)
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16 flex-shrink-0" style={{ color: opponentColors.textColor, opacity: 0.9 }}>
                      Wk {game.week}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0" style={{
                        backgroundColor: opponentColors.textColor,
                        color: opponentColors.backgroundColor
                      }}>
                        {game.location === 'away' ? '@' : 'vs'}
                      </span>
                      {opponentLogo && (
                        <div
                          className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${opponentColors.textColor}`,
                            padding: '2px'
                          }}
                        >
                          <img
                            src={opponentLogo}
                            alt={`${opponentName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        {playedGame?.opponentRank && (
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: opponentColors.textColor, opacity: 0.7 }}>
                            #{playedGame.opponentRank}
                          </span>
                        )}
                        <span className="text-sm sm:text-base font-semibold truncate" style={{ color: opponentColors.textColor }}>
                          {opponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  {playedGame ? (
                    <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-start">
                      <div
                        className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded"
                        style={{
                          backgroundColor: playedGame.result === 'win' ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {playedGame.result === 'win' ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="text-sm sm:text-base font-bold" style={{ color: opponentColors.textColor }}>
                          {playedGame.teamScore} - {playedGame.opponentScore}
                          {playedGame.overtimes && playedGame.overtimes.length > 0 && (
                            <span className="ml-1 text-xs opacity-80">
                              {playedGame.overtimes.length > 1 ? `${playedGame.overtimes.length}OT` : 'OT'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isCurrentWeek ? (
                    <div
                      className="text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded self-end sm:self-auto"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: getContrastTextColor(teamColors.primary)
                      }}
                    >
                      This Week
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-medium self-end sm:self-auto" style={{ color: opponentColors.textColor, opacity: 0.7 }}>
                      Scheduled
                    </div>
                  )}
                </div>
              )
            })}

            {/* Conference Championship Game - shows when user made the championship */}
            {(ccMadeChampionship === true || currentDynasty.conferenceChampionshipData?.madeChampionship === true) && (() => {
              const ccGame = getCCGame()
              const ccOpponentAbbr = ccGame?.opponent || ccOpponent || currentDynasty.conferenceChampionshipData?.opponent
              const hasOpponent = !!ccOpponentAbbr
              const ccOpponentColors = hasOpponent ? getOpponentColors(ccOpponentAbbr) : { backgroundColor: '#6b7280', textColor: '#ffffff' }
              // ccOpponentAbbr could be an abbreviation OR a mascot name
              // If getMascotName returns null, check if the input itself is a mascot name (has a logo)
              const ccMascotFromAbbr = hasOpponent ? getMascotName(ccOpponentAbbr) : null
              const ccMascotName = ccMascotFromAbbr || (hasOpponent && getTeamLogo(ccOpponentAbbr) ? ccOpponentAbbr : null)
              const ccOpponentName = ccMascotName || (hasOpponent ? getTeamNameFromAbbr(ccOpponentAbbr) : 'Opponent Unknown')
              const ccOpponentLogo = ccMascotName ? getTeamLogo(ccMascotName) : null
              const isCurrentCCWeek = currentDynasty.currentPhase === 'conference_championship' && !ccGame

              return (
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 ${ccGame ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                  style={{
                    backgroundColor: hasOpponent ? ccOpponentColors.backgroundColor : '#6b7280',
                    borderColor: ccGame
                      ? ccGame.result === 'win'
                        ? '#86efac'
                        : '#fca5a5'
                      : isCurrentCCWeek
                        ? teamColors.primary
                        : hasOpponent ? ccOpponentColors.backgroundColor : '#6b7280',
                    boxShadow: isCurrentCCWeek ? `0 0 0 3px ${teamColors.primary}40, 0 4px 12px ${teamColors.primary}30` : 'none'
                  }}
                  onClick={() => {
                    if (ccGame) {
                      setSelectedGame(ccGame)
                      setShowGameDetailModal(true)
                    }
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16 flex-shrink-0" style={{ color: hasOpponent ? ccOpponentColors.textColor : '#ffffff', opacity: 0.9 }}>
                      {currentDynasty.conference} CC
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0" style={{
                        backgroundColor: hasOpponent ? ccOpponentColors.textColor : '#ffffff',
                        color: hasOpponent ? ccOpponentColors.backgroundColor : '#6b7280'
                      }}>
                        vs
                      </span>
                      {ccOpponentLogo && (
                        <div
                          className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${ccOpponentColors.textColor}`,
                            padding: '2px'
                          }}
                        >
                          <img
                            src={ccOpponentLogo}
                            alt={`${ccOpponentName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        {/* Opponent ranking if ranked */}
                        {ccGame?.opponentRank && (
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: ccOpponentColors.textColor, opacity: 0.7 }}>
                            #{ccGame.opponentRank}
                          </span>
                        )}
                        <span className="text-sm sm:text-base font-semibold truncate" style={{ color: hasOpponent ? ccOpponentColors.textColor : '#ffffff', fontStyle: hasOpponent ? 'normal' : 'italic' }}>
                          {ccOpponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  {ccGame ? (
                    <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-start">
                      <div
                        className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded"
                        style={{
                          backgroundColor: ccGame.result === 'win' ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {ccGame.result === 'win' ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="text-sm sm:text-base font-bold" style={{ color: ccOpponentColors.textColor }}>
                          {ccGame.teamScore} - {ccGame.opponentScore}
                          {/* OT indicator if game went to overtime */}
                          {ccGame.overtimes && ccGame.overtimes.length > 0 && (
                            <span className="ml-1 text-xs opacity-80">
                              {ccGame.overtimes.length > 1 ? `${ccGame.overtimes.length}OT` : 'OT'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isCurrentCCWeek ? (
                    <div
                      className="text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded self-end sm:self-auto"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: getContrastTextColor(teamColors.primary)
                      }}
                    >
                      This Week
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-medium self-end sm:self-auto" style={{ color: hasOpponent ? ccOpponentColors.textColor : '#ffffff', opacity: 0.7 }}>
                      Scheduled
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Bowl Game - shows when user has a bowl game */}
            {(() => {
              const userBowlGameData = currentDynasty.games?.find(g => g.isBowlGame && g.year === currentDynasty.currentYear)
              const bowlData = currentDynasty.bowlEligibilityData
              const hasBowlEligibility = bowlData?.eligible === true && bowlData?.bowlGame && bowlData?.opponent

              // Only show if user has a bowl game (either played or scheduled via eligibility)
              if (!userBowlGameData && !hasBowlEligibility) return null

              const bowlOpponentAbbr = userBowlGameData?.opponent || bowlData?.opponent
              const bowlGameName = userBowlGameData?.bowlName || bowlData?.bowlGame
              const hasOpponent = !!bowlOpponentAbbr
              const bowlOpponentColors = hasOpponent ? getOpponentColors(bowlOpponentAbbr) : { backgroundColor: '#6b7280', textColor: '#ffffff' }
              // bowlOpponentAbbr could be an abbreviation OR a mascot name
              // If getMascotName returns null, check if the input itself is a mascot name (has a logo)
              const mascotFromAbbr = hasOpponent ? getMascotName(bowlOpponentAbbr) : null
              const bowlMascotName = mascotFromAbbr || (hasOpponent && getTeamLogo(bowlOpponentAbbr) ? bowlOpponentAbbr : null)
              const bowlOpponentName = bowlMascotName || (hasOpponent ? getTeamNameFromAbbr(bowlOpponentAbbr) : 'Opponent Unknown')
              const bowlOpponentLogo = bowlMascotName ? getTeamLogo(bowlMascotName) : null

              return (
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 ${userBowlGameData ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                  style={{
                    backgroundColor: hasOpponent ? bowlOpponentColors.backgroundColor : '#6b7280',
                    borderColor: userBowlGameData
                      ? userBowlGameData.result === 'win'
                        ? '#86efac'
                        : '#fca5a5'
                      : hasOpponent ? bowlOpponentColors.backgroundColor : '#6b7280'
                  }}
                  onClick={() => {
                    if (userBowlGameData) {
                      setSelectedGame(userBowlGameData)
                      setShowGameDetailModal(true)
                    }
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16 flex-shrink-0" style={{ color: hasOpponent ? bowlOpponentColors.textColor : '#ffffff', opacity: 0.9 }}>
                      Bowl
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0" style={{
                        backgroundColor: hasOpponent ? bowlOpponentColors.textColor : '#ffffff',
                        color: hasOpponent ? bowlOpponentColors.backgroundColor : '#6b7280'
                      }}>
                        vs
                      </span>
                      {bowlOpponentLogo && (
                        <div
                          className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${bowlOpponentColors.textColor}`,
                            padding: '2px'
                          }}
                        >
                          <img
                            src={bowlOpponentLogo}
                            alt={`${bowlOpponentName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2">
                          {userBowlGameData?.opponentRank && (
                            <span className="text-xs font-bold flex-shrink-0" style={{ color: bowlOpponentColors.textColor, opacity: 0.7 }}>
                              #{userBowlGameData.opponentRank}
                            </span>
                          )}
                          <span className="text-sm sm:text-base font-semibold truncate" style={{ color: hasOpponent ? bowlOpponentColors.textColor : '#ffffff' }}>
                            {bowlOpponentName}
                          </span>
                        </div>
                        <span className="text-xs opacity-70 truncate" style={{ color: hasOpponent ? bowlOpponentColors.textColor : '#ffffff' }}>
                          {bowlGameName}
                        </span>
                      </div>
                    </div>
                  </div>
                  {userBowlGameData ? (
                    <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
                      <div
                        className="text-xs sm:text-sm font-bold px-2 py-1 rounded"
                        style={{
                          backgroundColor: userBowlGameData.result === 'win' ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {userBowlGameData.result === 'win' ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="text-sm sm:text-base font-bold" style={{ color: bowlOpponentColors.textColor }}>
                          {userBowlGameData.teamScore} - {userBowlGameData.opponentScore}
                          {userBowlGameData.overtimes && userBowlGameData.overtimes.length > 0 && (
                            <span className="ml-1 text-xs opacity-80">
                              {userBowlGameData.overtimes.length > 1 ? `${userBowlGameData.overtimes.length}OT` : 'OT'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-medium self-end sm:self-auto" style={{ color: hasOpponent ? bowlOpponentColors.textColor : '#ffffff', opacity: 0.7 }}>
                      Scheduled
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        ) : (
          <div className="text-center py-12">
            <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
              No Schedule Yet
            </h3>
            <p style={{ color: secondaryBgText, opacity: 0.8 }}>
              Add your season schedule to get started.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ScheduleEntryModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSave={handleScheduleSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      <RosterEntryModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        onSave={handleRosterSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      <TeamRatingsModal
        isOpen={showTeamRatingsModal}
        onClose={() => setShowTeamRatingsModal(false)}
        onSave={handleTeamRatingsSave}
        teamColors={teamColors}
        currentRatings={currentDynasty.teamRatings}
      />

      <CoachingStaffModal
        isOpen={showCoachingStaffModal}
        onClose={() => setShowCoachingStaffModal(false)}
        onSave={handleCoachingStaffSave}
        teamColors={teamColors}
        currentStaff={currentDynasty.coachingStaff}
      />

      <GameEntryModal
        isOpen={showGameModal}
        onClose={() => {
          setShowGameModal(false)
          setEditingWeek(null)
          setEditingYear(null)
        }}
        onSave={handleGameSave}
        weekNumber={editingWeek || currentDynasty.currentWeek}
        currentYear={editingYear || currentDynasty.currentYear}
        teamColors={teamColors}
      />

      <GameDetailModal
        isOpen={showGameDetailModal}
        onClose={() => {
          setShowGameDetailModal(false)
          setSelectedGame(null)
        }}
        onEdit={(game) => {
          setEditingWeek(game.week)
          setEditingYear(game.year)
          setShowGameDetailModal(false)
          setShowGameModal(true)
        }}
        game={selectedGame}
        userTeam={currentDynasty.teamName}
        teamColors={teamColors}
      />

      <ConferenceChampionshipModal
        isOpen={showCCModal}
        onClose={() => setShowCCModal(false)}
        onSave={async (championships) => {
          // Store championships by year to preserve history
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.conferenceChampionshipsByYear || {}
          await updateDynasty(currentDynasty.id, {
            conferenceChampionships: championships, // Keep current year for display
            conferenceChampionshipsByYear: {
              ...existingByYear,
              [year]: championships
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* CC Game Entry Modal - reuses GameEntryModal but for championship game */}
      <GameEntryModal
        isOpen={showCCGameModal}
        onClose={() => setShowCCGameModal(false)}
        onSave={handleCCGameSave}
        weekNumber="CC"
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
        opponent={ccOpponent}
        isConferenceChampionship={true}
        existingGame={getCCGame()}
      />

      {/* User's Bowl Game Entry Modal */}
      <GameEntryModal
        isOpen={showBowlGameModal}
        onClose={() => setShowBowlGameModal(false)}
        onSave={handleBowlGameSave}
        weekNumber="Bowl"
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
        opponent={currentDynasty.bowlEligibilityData?.opponent || bowlOpponent}
        existingGame={currentDynasty.games?.find(g => g.isBowlGame && g.year === currentDynasty.currentYear)}
        bowlName={currentDynasty.bowlEligibilityData?.bowlGame || selectedBowl}
      />

      {/* Bowl Week 1 Modal */}
      <BowlWeek1Modal
        isOpen={showBowlWeek1Modal}
        onClose={() => setShowBowlWeek1Modal(false)}
        onSave={async (bowlGames) => {
          const year = currentDynasty.currentYear

          // Separate CFP First Round games from regular bowl games
          const cfpFirstRoundGames = bowlGames.filter(g => g.bowlName?.startsWith('CFP First Round'))
          const regularBowlGames = bowlGames.filter(g => !g.bowlName?.startsWith('CFP First Round'))

          // Transform CFP First Round games to match expected format
          const cfpFirstRound = cfpFirstRoundGames.map(game => {
            // Extract seed numbers from bowl name like "CFP First Round (#5 vs #12)"
            const seedMatch = game.bowlName?.match(/#(\d+) vs #(\d+)/)
            const seed1 = seedMatch ? parseInt(seedMatch[1]) : null
            const seed2 = seedMatch ? parseInt(seedMatch[2]) : null
            return {
              seed1,
              seed2,
              team1: game.team1,
              team2: game.team2,
              team1Score: game.team1Score,
              team2Score: game.team2Score,
              winner: game.winner
            }
          })

          const existingBowlByYear = currentDynasty.bowlGamesByYear || {}
          const existingBowlYearData = existingBowlByYear[year] || {}
          const existingCFPByYear = currentDynasty.cfpResultsByYear || {}
          const existingCFPYearData = existingCFPByYear[year] || {}

          await updateDynasty(currentDynasty.id, {
            bowlGamesByYear: {
              ...existingBowlByYear,
              [year]: {
                ...existingBowlYearData,
                week1: regularBowlGames
              }
            },
            cfpResultsByYear: {
              ...existingCFPByYear,
              [year]: {
                ...existingCFPYearData,
                firstRound: cfpFirstRound
              }
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Bowl Week 2 Modal */}
      <BowlWeek2Modal
        isOpen={showBowlWeek2Modal}
        onClose={() => setShowBowlWeek2Modal(false)}
        onSave={async (bowlGames) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.bowlGamesByYear || {}
          const existingYearData = existingByYear[year] || {}
          await updateDynasty(currentDynasty.id, {
            bowlGamesByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                week2: bowlGames
              }
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* CFP Seeds Modal */}
      <CFPSeedsModal
        isOpen={showCFPSeedsModal}
        onClose={() => setShowCFPSeedsModal(false)}
        onSave={async (seeds) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.cfpSeedsByYear || {}
          await updateDynasty(currentDynasty.id, {
            cfpSeedsByYear: {
              ...existingByYear,
              [year]: seeds
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* CFP First Round Modal */}
      <CFPFirstRoundModal
        isOpen={showCFPFirstRoundModal}
        onClose={() => setShowCFPFirstRoundModal(false)}
        onSave={async (games) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}
          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                firstRound: games
              }
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Bowl Score Modal (CFP Weeks 4-5) */}
      <BowlScoreModal
        isOpen={showBowlScoreModal}
        onClose={() => setShowBowlScoreModal(false)}
        onSave={async (cfpGames, week) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}
          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                [`week${week}`]: cfpGames
              }
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        currentWeek={currentDynasty.currentWeek}
        teamColors={teamColors}
      />

      {/* CFP Quarterfinals Modal (Week 3) */}
      <CFPQuarterfinalsModal
        isOpen={showCFPQuarterfinalsModal}
        onClose={() => setShowCFPQuarterfinalsModal(false)}
        onSave={async (cfpGames) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}
          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                week3: cfpGames
              }
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Conferences Modal */}
      <ConferencesModal
        isOpen={showConferencesModal}
        onClose={() => setShowConferencesModal(false)}
        onSave={async (conferences) => {
          const isDev = import.meta.env.VITE_DEV_MODE === 'true'
          if (isDev || !user) {
            // Dev mode
            await updateDynasty(currentDynasty.id, {
              customConferences: conferences,
              preseasonSetup: {
                ...currentDynasty.preseasonSetup,
                conferencesEntered: true
              }
            })
          } else {
            // Production mode - use dot notation
            await updateDynasty(currentDynasty.id, {
              customConferences: conferences,
              'preseasonSetup.conferencesEntered': true
            })
          }
        }}
        teamColors={teamColors}
      />
    </div>
  )
}
