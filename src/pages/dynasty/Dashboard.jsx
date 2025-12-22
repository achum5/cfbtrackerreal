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
// GameDetailModal removed - now using game pages instead
import ConferenceChampionshipModal from '../../components/ConferenceChampionshipModal'
import CoachingStaffModal from '../../components/CoachingStaffModal'
import BowlWeek1Modal from '../../components/BowlWeek1Modal'
import BowlWeek2Modal from '../../components/BowlWeek2Modal'
import BowlScoreModal from '../../components/BowlScoreModal'
import CFPSeedsModal from '../../components/CFPSeedsModal'
import CFPFirstRoundModal from '../../components/CFPFirstRoundModal'
import CFPQuarterfinalsModal from '../../components/CFPQuarterfinalsModal'
import CFPSemifinalsModal from '../../components/CFPSemifinalsModal'
import CFPChampionshipModal from '../../components/CFPChampionshipModal'
import ConferencesModal from '../../components/ConferencesModal'
import StatsEntryModal from '../../components/StatsEntryModal'
import DetailedStatsEntryModal from '../../components/DetailedStatsEntryModal'
import ConferenceStandingsModal from '../../components/ConferenceStandingsModal'
import FinalPollsModal from '../../components/FinalPollsModal'
import TeamStatsModal from '../../components/TeamStatsModal'
import AwardsModal from '../../components/AwardsModal'
import AllAmericansModal from '../../components/AllAmericansModal'
import PlayerMatchConfirmModal from '../../components/PlayerMatchConfirmModal'
import NewJobEditModal from '../../components/NewJobEditModal'
import { getAllBowlGamesList, isBowlInWeek1, isBowlInWeek2 } from '../../services/sheetsService'

// Helper function to normalize player names for consistent lookup
const normalizePlayerName = (name) => {
  if (!name) return ''
  return name.trim().toLowerCase()
}

export default function Dashboard() {
  const { currentDynasty, saveSchedule, saveRoster, saveTeamRatings, saveCoachingStaff, saveConferences, addGame, saveCPUBowlGames, saveCPUConferenceChampionships, updateDynasty, processHonorPlayers } = useDynasty()
  const { user } = useAuth()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [showTeamRatingsModal, setShowTeamRatingsModal] = useState(false)
  const [showCoachingStaffModal, setShowCoachingStaffModal] = useState(false)
  const [showGameModal, setShowGameModal] = useState(false)
  // showGameDetailModal removed - now using game pages instead
  const [showCCModal, setShowCCModal] = useState(false)
  const [showBowlWeek1Modal, setShowBowlWeek1Modal] = useState(false)
  const [showBowlWeek2Modal, setShowBowlWeek2Modal] = useState(false)
  const [showBowlScoreModal, setShowBowlScoreModal] = useState(false)
  const [showBowlGameModal, setShowBowlGameModal] = useState(false)
  const [showCFPSeedsModal, setShowCFPSeedsModal] = useState(false)
  const [showCFPFirstRoundModal, setShowCFPFirstRoundModal] = useState(false)
  const [showCFPQuarterfinalsModal, setShowCFPQuarterfinalsModal] = useState(false)
  const [showCFPSemifinalsModal, setShowCFPSemifinalsModal] = useState(false)
  const [showCFPChampionshipModal, setShowCFPChampionshipModal] = useState(false)
  const [showConferencesModal, setShowConferencesModal] = useState(false)
  const [showStatsEntryModal, setShowStatsEntryModal] = useState(false)
  const [showDetailedStatsModal, setShowDetailedStatsModal] = useState(false)
  const [showConferenceStandingsModal, setShowConferenceStandingsModal] = useState(false)
  const [showFinalPollsModal, setShowFinalPollsModal] = useState(false)
  const [showTeamStatsModal, setShowTeamStatsModal] = useState(false)
  const [showAwardsModal, setShowAwardsModal] = useState(false)
  const [showAllAmericansModal, setShowAllAmericansModal] = useState(false)
  const [showCoachingStaffPopup, setShowCoachingStaffPopup] = useState(false)
  const [suppressPopupHover, setSuppressPopupHover] = useState(false) // Prevents hover popup after layout shifts
  const [showNewJobEditModal, setShowNewJobEditModal] = useState(false)

  // Player match confirmation states
  const [showPlayerMatchConfirm, setShowPlayerMatchConfirm] = useState(false)
  const [playerMatchConfirmation, setPlayerMatchConfirmation] = useState(null)
  const [pendingHonorData, setPendingHonorData] = useState(null) // { honorType, entries, year, confirmations, transferDecisions }
  const [currentConfirmIndex, setCurrentConfirmIndex] = useState(0)

  // Bowl eligibility states
  const [bowlEligible, setBowlEligible] = useState(null) // null = not answered, true/false = answered
  const [selectedBowl, setSelectedBowl] = useState('')
  const [bowlOpponent, setBowlOpponent] = useState('')
  const [bowlOpponentSearch, setBowlOpponentSearch] = useState('')
  const [showBowlOpponentDropdown, setShowBowlOpponentDropdown] = useState(false)
  const [editingWeek, setEditingWeek] = useState(null)
  const [editingYear, setEditingYear] = useState(null)
  const [editingOpponent, setEditingOpponent] = useState(null)
  const [editingGame, setEditingGame] = useState(null)
  const [editingBowlName, setEditingBowlName] = useState(null)
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

  // Coordinator hiring states (for Bowl Week 2+ after firing)
  const [filledOCVacancy, setFilledOCVacancy] = useState(null) // null = not asked, true/false = answered
  const [filledDCVacancy, setFilledDCVacancy] = useState(null) // null = not asked, true/false = answered
  const [newOCName, setNewOCName] = useState('')
  const [newDCName, setNewDCName] = useState('')

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

  // Restore coordinator hiring state from saved dynasty data
  useEffect(() => {
    if (currentDynasty?.pendingCoordinatorHires) {
      const hireData = currentDynasty.pendingCoordinatorHires
      setFilledOCVacancy(hireData.filledOC ?? null)
      setFilledDCVacancy(hireData.filledDC ?? null)
      setNewOCName(hireData.newOCName || '')
      setNewDCName(hireData.newDCName || '')
    } else {
      setFilledOCVacancy(null)
      setFilledDCVacancy(null)
      setNewOCName('')
      setNewDCName('')
    }
  }, [currentDynasty?.id, currentDynasty?.pendingCoordinatorHires])

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

    // If still not found, try to get abbreviation from display name (for full mascot names)
    if (!team || typeof team !== 'object') {
      const actualAbbr = getAbbreviationFromDisplayName(abbr)
      if (actualAbbr) {
        team = teamAbbreviations[actualAbbr]
      }
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

  const handleNewJobSave = async (jobData) => {
    // Update local state
    setTakingNewJob(jobData.takingNewJob)
    setNewJobTeam(jobData.team || '')
    setNewJobPosition(jobData.position || '')

    // Save to dynasty
    if (jobData.takingNewJob === false) {
      await updateDynasty(currentDynasty.id, {
        newJobData: {
          takingNewJob: false,
          team: null,
          position: null,
          declinedInWeek: currentDynasty.currentWeek
        }
      })
    } else {
      await updateDynasty(currentDynasty.id, {
        newJobData: {
          takingNewJob: true,
          team: jobData.team,
          position: jobData.position
        }
      })
    }
  }

  const handleGameSave = async (gameData) => {
    try {
      // Check if this is a CFP game (editingWeek is set to 'CFP First Round', 'CFP Quarterfinal', etc.)
      const isCFPFirstRound = editingWeek === 'CFP First Round'
      const isCFPQuarterfinal = editingWeek === 'CFP Quarterfinal'
      const isCFPSemifinal = editingWeek === 'CFP Semifinal'
      const isCFPChampionship = editingWeek === 'CFP Championship'
      await addGame(currentDynasty.id, {
        ...gameData,
        ...(isCFPFirstRound && { isCFPFirstRound: true }),
        ...(isCFPQuarterfinal && { isCFPQuarterfinal: true }),
        ...(isCFPSemifinal && { isCFPSemifinal: true }),
        ...(isCFPChampionship && { isCFPChampionship: true })
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
      // Helper to remove undefined values (Firestore doesn't accept undefined)
      const removeUndefined = (obj) => {
        return Object.fromEntries(
          Object.entries(obj).filter(([_, v]) => v !== undefined)
        )
      }

      // Add the game with special flag for conference championship
      // Use userTeamConference which is computed from team data, not currentDynasty.conference which may not be set
      const conferenceForGame = userTeamConference || currentDynasty.conference || ''
      await addGame(currentDynasty.id, removeUndefined({
        ...gameData,
        isConferenceChampionship: true,
        conference: conferenceForGame,
        gameTitle: `${conferenceForGame || 'Conference'} Championship Game`
      }))
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

  // Handle awards data save with player matching
  const handleAwardsSave = async (awards) => {
    const year = currentDynasty.currentYear

    // Convert awards object to array format for processing
    const entries = Object.entries(awards).map(([awardKey, data]) => ({
      ...data,
      award: awardKey,
      name: data.player
    })).filter(e => e.player) // Only entries with a player name

    // Process honors - this will find/create players
    const result = await processHonorPlayers(
      currentDynasty.id,
      'awards',
      entries,
      year,
      [] // No transfer decisions yet
    )

    if (result.needsConfirmation) {
      // Store pending data and show first confirmation
      setPendingHonorData({
        honorType: 'awards',
        entries,
        year,
        rawData: awards, // Keep original for awardsByYear
        confirmations: result.confirmations,
        transferDecisions: []
      })
      setCurrentConfirmIndex(0)
      setPlayerMatchConfirmation(result.confirmations[0])
      setShowPlayerMatchConfirm(true)
    } else {
      // No confirmations needed - just save the awards data
      const existingByYear = currentDynasty.awardsByYear || {}
      await updateDynasty(currentDynasty.id, {
        awardsByYear: {
          ...existingByYear,
          [year]: awards
        }
      })
    }
  }

  // Handle all-americans/all-conference data save with player matching
  const handleAllAmericansSave = async (data) => {
    const year = currentDynasty.currentYear

    // Combine all entries for processing
    const allEntries = []

    // All-Americans
    if (data.allAmericans) {
      data.allAmericans.forEach(entry => {
        allEntries.push({
          ...entry,
          name: entry.player,
          honorCategory: 'allAmericans'
        })
      })
    }

    // All-Conference
    if (data.allConference) {
      data.allConference.forEach(entry => {
        allEntries.push({
          ...entry,
          name: entry.player,
          honorCategory: 'allConference'
        })
      })
    }

    // Process All-Americans first
    const aaEntries = allEntries.filter(e => e.honorCategory === 'allAmericans')
    const acEntries = allEntries.filter(e => e.honorCategory === 'allConference')

    // Start with All-Americans
    if (aaEntries.length > 0) {
      const result = await processHonorPlayers(
        currentDynasty.id,
        'allAmericans',
        aaEntries,
        year,
        []
      )

      if (result.needsConfirmation) {
        setPendingHonorData({
          honorType: 'allAmericans',
          entries: aaEntries,
          year,
          rawData: data,
          confirmations: result.confirmations,
          transferDecisions: [],
          // Track remaining to process
          remainingAC: acEntries
        })
        setCurrentConfirmIndex(0)
        setPlayerMatchConfirmation(result.confirmations[0])
        setShowPlayerMatchConfirm(true)
        return
      }
    }

    // Process All-Conference
    if (acEntries.length > 0) {
      const result = await processHonorPlayers(
        currentDynasty.id,
        'allConference',
        acEntries,
        year,
        []
      )

      if (result.needsConfirmation) {
        setPendingHonorData({
          honorType: 'allConference',
          entries: acEntries,
          year,
          rawData: data,
          confirmations: result.confirmations,
          transferDecisions: []
        })
        setCurrentConfirmIndex(0)
        setPlayerMatchConfirmation(result.confirmations[0])
        setShowPlayerMatchConfirm(true)
        return
      }
    }

    // No confirmations needed - save the data
    const existingByYear = currentDynasty.allAmericansByYear || {}
    await updateDynasty(currentDynasty.id, {
      allAmericansByYear: {
        ...existingByYear,
        [year]: data
      }
    })
  }

  // Handle player match confirmation response
  const handlePlayerMatchConfirm = async (isSamePlayer) => {
    const { honorType, entries, year, confirmations, transferDecisions, rawData, remainingAC } = pendingHonorData
    const currentConfirm = confirmations[currentConfirmIndex]

    // Add this decision
    const newDecisions = [
      ...transferDecisions,
      { entryIndex: currentConfirm.entryIndex, isSamePlayer }
    ]

    // Check if there are more confirmations for this batch
    if (currentConfirmIndex < confirmations.length - 1) {
      // Show next confirmation
      const nextIndex = currentConfirmIndex + 1
      setCurrentConfirmIndex(nextIndex)
      setPlayerMatchConfirmation(confirmations[nextIndex])
      setPendingHonorData({ ...pendingHonorData, transferDecisions: newDecisions })
    } else {
      // All confirmations done for this batch - process with decisions
      setShowPlayerMatchConfirm(false)

      const result = await processHonorPlayers(
        currentDynasty.id,
        honorType,
        entries,
        year,
        newDecisions
      )

      if (result.success) {
        // If this was allAmericans and we have remaining allConference to process
        if (honorType === 'allAmericans' && remainingAC && remainingAC.length > 0) {
          const acResult = await processHonorPlayers(
            currentDynasty.id,
            'allConference',
            remainingAC,
            year,
            []
          )

          if (acResult.needsConfirmation) {
            setPendingHonorData({
              honorType: 'allConference',
              entries: remainingAC,
              year,
              rawData,
              confirmations: acResult.confirmations,
              transferDecisions: []
            })
            setCurrentConfirmIndex(0)
            setPlayerMatchConfirmation(acResult.confirmations[0])
            setShowPlayerMatchConfirm(true)
            return
          }
        }

        // All done - save the raw data to the appropriate year structure
        if (honorType === 'awards') {
          const existingByYear = currentDynasty.awardsByYear || {}
          await updateDynasty(currentDynasty.id, {
            awardsByYear: {
              ...existingByYear,
              [year]: rawData
            }
          })
        } else {
          const existingByYear = currentDynasty.allAmericansByYear || {}
          await updateDynasty(currentDynasty.id, {
            allAmericansByYear: {
              ...existingByYear,
              [year]: rawData
            }
          })
        }
      }

      // Reset state
      setPendingHonorData(null)
      setCurrentConfirmIndex(0)
      setPlayerMatchConfirmation(null)
    }
  }

  // Cancel player match confirmation - cancel the whole save operation
  const handlePlayerMatchCancel = () => {
    setShowPlayerMatchConfirm(false)
    setPendingHonorData(null)
    setCurrentConfirmIndex(0)
    setPlayerMatchConfirmation(null)
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
      if (week === 5) return 'End of Season Recap'
      return week === 4 ? 'National Championship' : `Bowl Week ${week}`
    }
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      offseason: 'Off-Season'
    }
    return phases[phase] || phase
  }

  const currentYearGames = (currentDynasty.games || [])
    .filter(g => Number(g.year) === Number(currentDynasty.currentYear) && !g.isCPUGame)
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
            <button
              onClick={() => setShowNewJobEditModal(true)}
              className="p-2 rounded-lg hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ backgroundColor: newTeamColors.secondary, color: getContrastTextColor(newTeamColors.secondary) }}
              title="Edit new job selection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
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

                {/* Coaching Staff Popup (HC only) */}
                {currentDynasty.coachPosition === 'HC' && currentDynasty.coachingStaff && (
                  <div className="relative">
                    <button
                      onClick={() => setShowCoachingStaffPopup(!showCoachingStaffPopup)}
                      onMouseEnter={() => !suppressPopupHover && setShowCoachingStaffPopup(true)}
                      className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                      style={{ color: primaryBgText }}
                      title="Coaching Staff"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>

                    {showCoachingStaffPopup && (
                      <>
                        {/* Backdrop for mobile click-away */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowCoachingStaffPopup(false)}
                        />
                        <div
                          className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl shadow-xl overflow-hidden"
                          style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
                          onMouseEnter={() => !suppressPopupHover && setShowCoachingStaffPopup(true)}
                          onMouseLeave={() => setShowCoachingStaffPopup(false)}
                        >
                          <div className="px-4 py-3 border-b" style={{ borderColor: `${secondaryBgText}20`, backgroundColor: teamColors.primary }}>
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-sm uppercase tracking-wide" style={{ color: primaryBgText }}>
                                Coaching Staff
                              </h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowCoachingStaffPopup(false)
                                  setShowCoachingStaffModal(true)
                                }}
                                className="p-1 rounded hover:opacity-70 transition-opacity"
                                style={{ color: primaryBgText }}
                                title="Edit Coaching Staff"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            {/* Offensive Coordinator */}
                            {(() => {
                              const ocName = currentDynasty.coachingStaff?.ocName
                              const firedOCName = currentDynasty.conferenceChampionshipData?.firedOCName
                              const displayName = ocName || firedOCName
                              const isFired = !ocName && firedOCName

                              return displayName ? (
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: isFired ? '#ef444420' : `${secondaryBgText}15` }}
                                  >
                                    <span className="text-xs font-bold" style={{ color: isFired ? '#ef4444' : secondaryBgText }}>OC</span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[10px] uppercase font-medium" style={{ color: secondaryBgText, opacity: 0.6 }}>
                                      Offensive Coordinator
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold truncate ${isFired ? 'line-through opacity-60' : ''}`} style={{ color: secondaryBgText }}>
                                        {displayName}
                                      </span>
                                      {isFired && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                                          FIRED
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : null
                            })()}

                            {/* Defensive Coordinator */}
                            {(() => {
                              const dcName = currentDynasty.coachingStaff?.dcName
                              const firedDCName = currentDynasty.conferenceChampionshipData?.firedDCName
                              const displayName = dcName || firedDCName
                              const isFired = !dcName && firedDCName

                              return displayName ? (
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: isFired ? '#ef444420' : `${secondaryBgText}15` }}
                                  >
                                    <span className="text-xs font-bold" style={{ color: isFired ? '#ef4444' : secondaryBgText }}>DC</span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[10px] uppercase font-medium" style={{ color: secondaryBgText, opacity: 0.6 }}>
                                      Defensive Coordinator
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold truncate ${isFired ? 'line-through opacity-60' : ''}`} style={{ color: secondaryBgText }}>
                                        {displayName}
                                      </span>
                                      {isFired && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                                          FIRED
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : null
                            })()}

                            {/* Show message if no coordinators at all */}
                            {!currentDynasty.coachingStaff?.ocName && !currentDynasty.coachingStaff?.dcName &&
                             !currentDynasty.conferenceChampionshipData?.firedOCName && !currentDynasty.conferenceChampionshipData?.firedDCName && (
                              <div className="text-center py-2 text-sm" style={{ color: secondaryBgText, opacity: 0.6 }}>
                                No coordinators entered
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
            const hasCoordinators = currentDynasty.coachPosition === 'HC' &&
              (currentDynasty.coachingStaff?.ocName || currentDynasty.coachingStaff?.dcName)
            const coordinatorTaskComplete = coordinatorToFire !== ''

            // Determine CC task status
            const ccTaskComplete = ccMadeChampionship === false || ccGame

            return (
              <div className="space-y-3 sm:space-y-4">
                {/* Task 1: Conference Championship */}
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                    ccTaskComplete ? 'border-green-200 bg-green-50' : ''
                  }`}
                  style={!ccTaskComplete ? { borderColor: `${teamColors.primary}30` } : {}}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                        ccTaskComplete ? 'bg-green-500 text-white' : ''
                      }`}
                      style={!ccTaskComplete ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                    >
                      {ccTaskComplete ? (
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : '1'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm sm:text-base font-semibold" style={{ color: ccTaskComplete ? '#16a34a' : secondaryBgText }}>
                        {userTeamConference} Championship
                      </div>
                      <div className="text-xs sm:text-sm mt-0.5" style={{ color: ccTaskComplete ? '#16a34a' : secondaryBgText, opacity: ccTaskComplete ? 1 : 0.7 }}>
                        {ccMadeChampionship === null ? 'Did you make the championship?' :
                         ccMadeChampionship === false ? 'Did not make championship' :
                         ccGame ? `${ccGame.result === 'win' ? 'W' : 'L'} ${ccGame.teamScore}-${ccGame.opponentScore} vs ${getMascotName(ccGame.opponent) || ccGame.opponent}` :
                         ccOpponent ? `vs ${getMascotName(ccOpponent) || ccOpponent}` : 'Enter game result'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto">
                    {ccMadeChampionship === null ? (
                      <>
                        <button
                          onClick={() => handleCCAnswer(true)}
                          className="px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleCCAnswer(false)}
                          className="px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          No
                        </button>
                      </>
                    ) : ccMadeChampionship === true && !ccOpponent && !ccGame ? (
                      <div className="flex items-center gap-2">
                        <SearchableSelect
                          options={teams}
                          value=""
                          onChange={(teamName) => {
                            const abbr = getAbbreviationFromDisplayName(teamName)
                            if (abbr) handleCCOpponentSelect(abbr)
                          }}
                          placeholder="Select opponent..."
                          teamColors={teamColors}
                        />
                      </div>
                    ) : ccMadeChampionship === true && (ccOpponent || ccGame) ? (
                      <button
                        onClick={() => setShowCCGameModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {ccGame ? 'Edit' : 'Enter Game'}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          setCCMadeChampionship(null)
                          setCCOpponent('')
                          await updateDynasty(currentDynasty.id, {
                            conferenceChampionshipData: { ...currentDynasty.conferenceChampionshipData, madeChampionship: null, opponent: null }
                          })
                        }}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Task 2: Coordinator Changes (always visible for HC with coordinators) */}
                {hasCoordinators && (
                  <div
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                      coordinatorTaskComplete ? 'border-green-200 bg-green-50' : ''
                    }`}
                    style={!coordinatorTaskComplete ? { borderColor: `${teamColors.primary}30` } : {}}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                          coordinatorTaskComplete ? 'bg-green-500 text-white' : ''
                        }`}
                        style={!coordinatorTaskComplete ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                      >
                        {coordinatorTaskComplete ? (
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : '2'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm sm:text-base font-semibold" style={{ color: coordinatorTaskComplete ? '#16a34a' : secondaryBgText }}>
                          Coordinator Changes
                        </div>
                        <div className="text-xs sm:text-sm mt-0.5" style={{ color: coordinatorTaskComplete ? '#16a34a' : secondaryBgText, opacity: coordinatorTaskComplete ? 1 : 0.7 }}>
                          {coordinatorTaskComplete ? (
                            coordinatorToFire === 'none' ? 'Keeping both coordinators' :
                            coordinatorToFire === 'oc' ? `Firing ${currentDynasty.coachingStaff?.ocName} (OC)` :
                            coordinatorToFire === 'dc' ? `Firing ${currentDynasty.coachingStaff?.dcName} (DC)` :
                            coordinatorToFire === 'both' ? 'Firing both coordinators' : ''
                          ) : 'Fire any coordinators?'}
                        </div>
                      </div>
                    </div>
                    <select
                      value={coordinatorToFire}
                      onChange={(e) => handleFiringSelection(e.target.value)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold cursor-pointer text-sm self-end sm:self-auto"
                      style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                    >
                      <option value="">Select...</option>
                      <option value="none">Keep both</option>
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
              </div>
            )
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
            // Bowl Week 2 sheet saves regular bowl games to week2 - check only this
            // (User's QF game from game modal goes to cfpResultsByYear.quarterfinals but that's separate)
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

            // CFP Quarterfinals tracking
            const userCFPQuarterfinalGame = currentDynasty.games?.find(g => g.isCFPQuarterfinal && g.year === currentDynasty.currentYear)
            const firstRoundResults = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.firstRound || []

            // User is in QF if they have a bye (seed 1-4) OR won their First Round game (seed 5-12)
            // Note: result can be 'W' or 'win' depending on how game was saved
            const userWonFirstRound = userCFPFirstRoundGame?.result === 'W' || userCFPFirstRoundGame?.result === 'win'
            const userInCFPQuarterfinal = userHasCFPBye || (userInCFPFirstRound && userWonFirstRound)

            // Calculate QF opponent based on bracket matchups
            // Sugar Bowl: #4 vs 5/12 winner, Orange Bowl: #1 vs 8/9 winner
            // Rose Bowl: #3 vs 6/11 winner, Cotton Bowl: #2 vs 7/10 winner
            const getCFPQuarterfinalOpponent = () => {
              if (!userInCFPQuarterfinal) return null

              // QF matchup structure
              const qfMatchups = {
                1: { opponentSeeds: [8, 9] },   // #1 vs 8/9 winner (Orange Bowl)
                2: { opponentSeeds: [7, 10] },  // #2 vs 7/10 winner (Cotton Bowl)
                3: { opponentSeeds: [6, 11] },  // #3 vs 6/11 winner (Rose Bowl)
                4: { opponentSeeds: [5, 12] },  // #4 vs 5/12 winner (Sugar Bowl)
                5: { hostSeed: 4 }, 12: { hostSeed: 4 },  // 5/12 winner plays #4
                6: { hostSeed: 3 }, 11: { hostSeed: 3 },  // 6/11 winner plays #3
                7: { hostSeed: 2 }, 10: { hostSeed: 2 },  // 7/10 winner plays #2
                8: { hostSeed: 1 }, 9: { hostSeed: 1 }    // 8/9 winner plays #1
              }

              if (userHasCFPBye) {
                // Seeds 1-4: opponent is the First Round winner
                const matchup = qfMatchups[userCFPSeed]
                const [seedA, seedB] = matchup.opponentSeeds
                const firstRoundGame = firstRoundResults.find(g =>
                  (g.seed1 === seedA && g.seed2 === seedB) || (g.seed1 === seedB && g.seed2 === seedA)
                )
                return firstRoundGame?.winner || null
              } else if (userWonFirstRound) {
                // Seeds 5-12 who won: opponent is the bye team (host seed)
                const hostSeed = qfMatchups[userCFPSeed]?.hostSeed
                return hostSeed ? cfpSeeds.find(s => s.seed === hostSeed)?.team : null
              }
              return null
            }

            const userQFOpponent = getCFPQuarterfinalOpponent()

            // Get the bowl name for user's QF game
            const getUserQFBowlName = () => {
              if (!userInCFPQuarterfinal) return null
              const bowlBySeed = {
                1: 'Orange Bowl', 8: 'Orange Bowl', 9: 'Orange Bowl',
                2: 'Cotton Bowl', 7: 'Cotton Bowl', 10: 'Cotton Bowl',
                3: 'Rose Bowl', 6: 'Rose Bowl', 11: 'Rose Bowl',
                4: 'Sugar Bowl', 5: 'Sugar Bowl', 12: 'Sugar Bowl'
              }
              return bowlBySeed[userCFPSeed] || null
            }

            const userQFBowlName = getUserQFBowlName()

            // CFP Semifinals tracking
            const userCFPSemifinalGame = currentDynasty.games?.find(g => g.isCFPSemifinal && g.year === currentDynasty.currentYear)
            // Note: result can be 'W' or 'win' depending on how game was saved
            const userWonQuarterfinal = userCFPQuarterfinalGame?.result === 'W' || userCFPQuarterfinalGame?.result === 'win'
            const userInCFPSemifinal = userInCFPQuarterfinal && userWonQuarterfinal

            // Get quarterfinal results to calculate SF opponent
            const quarterfinalResults = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.quarterfinals || []

            // Calculate SF opponent based on QF results
            // Peach Bowl: Orange Bowl winner (1/8/9) vs Sugar Bowl winner (4/5/12)
            // Fiesta Bowl: Cotton Bowl winner (2/7/10) vs Rose Bowl winner (3/6/11)
            const getCFPSemifinalOpponent = () => {
              if (!userInCFPSemifinal) return null

              // Determine which SF the user is in based on their seed
              // Seeds 1,8,9 play in Orange Bowl -> Peach Bowl SF
              // Seeds 4,5,12 play in Sugar Bowl -> Peach Bowl SF
              // Seeds 2,7,10 play in Cotton Bowl -> Fiesta Bowl SF
              // Seeds 3,6,11 play in Rose Bowl -> Fiesta Bowl SF
              const peachBowlSeeds = [1, 8, 9, 4, 5, 12]
              const fiestaBowlSeeds = [2, 7, 10, 3, 6, 11]

              const userInPeachBowl = peachBowlSeeds.includes(userCFPSeed)

              if (userInPeachBowl) {
                // User's opponent is the winner from the other QF in Peach Bowl
                // If user was in Orange (1/8/9), opponent is Sugar winner (4/5/12)
                // If user was in Sugar (4/5/12), opponent is Orange winner (1/8/9)
                const orangeSeeds = [1, 8, 9]
                const sugarSeeds = [4, 5, 12]
                const opponentBowlSeeds = orangeSeeds.includes(userCFPSeed) ? sugarSeeds : orangeSeeds
                const opponentQFGame = quarterfinalResults.find(g => {
                  const team1Seed = cfpSeeds.find(s => s.team === g.team1)?.seed
                  const team2Seed = cfpSeeds.find(s => s.team === g.team2)?.seed
                  return opponentBowlSeeds.includes(team1Seed) || opponentBowlSeeds.includes(team2Seed)
                })
                return opponentQFGame?.winner || null
              } else {
                // User's opponent is the winner from the other QF in Fiesta Bowl
                // If user was in Cotton (2/7/10), opponent is Rose winner (3/6/11)
                // If user was in Rose (3/6/11), opponent is Cotton winner (2/7/10)
                const cottonSeeds = [2, 7, 10]
                const roseSeeds = [3, 6, 11]
                const opponentBowlSeeds = cottonSeeds.includes(userCFPSeed) ? roseSeeds : cottonSeeds
                const opponentQFGame = quarterfinalResults.find(g => {
                  const team1Seed = cfpSeeds.find(s => s.team === g.team1)?.seed
                  const team2Seed = cfpSeeds.find(s => s.team === g.team2)?.seed
                  return opponentBowlSeeds.includes(team1Seed) || opponentBowlSeeds.includes(team2Seed)
                })
                return opponentQFGame?.winner || null
              }
            }

            const userSFOpponent = getCFPSemifinalOpponent()

            // Get the bowl name for user's SF game
            const getUserSFBowlName = () => {
              if (!userInCFPSemifinal) return null
              const peachBowlSeeds = [1, 8, 9, 4, 5, 12]
              return peachBowlSeeds.includes(userCFPSeed) ? 'Peach Bowl' : 'Fiesta Bowl'
            }

            const userSFBowlName = getUserSFBowlName()

            // CFP Championship tracking
            const userCFPChampionshipGame = currentDynasty.games?.find(g => g.isCFPChampionship && g.year === currentDynasty.currentYear)
            // Note: result can be 'W' or 'win' depending on how game was saved
            const userWonSemifinal = userCFPSemifinalGame?.result === 'W' || userCFPSemifinalGame?.result === 'win'
            const userInCFPChampionship = userInCFPSemifinal && userWonSemifinal

            // Get semifinal results to calculate Championship opponent
            const semifinalResults = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.semifinals || []

            // Calculate Championship opponent from SF results
            const getCFPChampionshipOpponent = () => {
              if (!userInCFPChampionship) return null

              // User's opponent is the winner of the other semifinal
              const peachBowlSeeds = [1, 8, 9, 4, 5, 12]
              const userInPeachBowl = peachBowlSeeds.includes(userCFPSeed)

              // Find the SF game the user was NOT in
              const opponentSF = semifinalResults.find(g => {
                const team1Seed = cfpSeeds.find(s => s.team === g.team1)?.seed
                const team2Seed = cfpSeeds.find(s => s.team === g.team2)?.seed
                const gameInPeachBowl = peachBowlSeeds.includes(team1Seed) || peachBowlSeeds.includes(team2Seed)
                // If user was in Peach, opponent is from Fiesta (not in Peach)
                return userInPeachBowl ? !gameInPeachBowl : gameInPeachBowl
              })
              return opponentSF?.winner || null
            }

            const userChampOpponent = getCFPChampionshipOpponent()

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
                            {hasCCData ? '✓ Results entered' : `${currentDynasty.conferenceChampionshipData?.madeChampionship === true ? '9' : '10'} conference championships`}
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
                              {userCFPFirstRoundGame ? `✓ ${userCFPFirstRoundGame.result === 'W' || userCFPFirstRoundGame.result === 'win' ? 'Won' : 'Lost'} ${userCFPFirstRoundGame.teamScore}-${userCFPFirstRoundGame.opponentScore}` : `#${userCFPSeed} vs #${17 - userCFPSeed} ${getMascotName(userCFPOpponent)}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            // Set up for CFP First Round game entry
                            setEditingWeek('CFP First Round')
                            setEditingYear(currentDynasty.currentYear)
                            setEditingOpponent(userCFPOpponent)
                            setEditingBowlName('CFP First Round')
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
                              {userBowlGame ? `✓ ${userBowlGame.result === 'W' || userBowlGame.result === 'win' ? 'Won' : 'Lost'} ${userBowlGame.teamScore}-${userBowlGame.opponentScore}` : `vs ${bowlOpponent}`}
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
                              {userBowlGame ? `✓ ${userBowlGame.result === 'W' || userBowlGame.result === 'win' ? 'Won' : 'Lost'} ${userBowlGame.teamScore}-${userBowlGame.opponentScore}` : `vs ${bowlOpponent}`}
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

                    {/* Task: Enter YOUR CFP Quarterfinal Game (if in CFP and advancing to QF) */}
                    {userInCFPQuarterfinal && hasBowlWeek1Data && (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          userCFPQuarterfinalGame ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!userCFPQuarterfinalGame ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              userCFPQuarterfinalGame ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!userCFPQuarterfinalGame ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {userCFPQuarterfinalGame ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">{(bowlEligible && selectedBowl && bowlOpponent && userBowlIsWeek2) ? 3 : 2}</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: userCFPQuarterfinalGame ? '#16a34a' : secondaryBgText }}>
                              Enter Your {userQFBowlName} Game (CFP QF)
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: userCFPQuarterfinalGame ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {userCFPQuarterfinalGame
                                ? `✓ ${userCFPQuarterfinalGame.result === 'W' || userCFPQuarterfinalGame.result === 'win' ? 'Won' : 'Lost'} ${userCFPQuarterfinalGame.teamScore}-${userCFPQuarterfinalGame.opponentScore}`
                                : `#${userCFPSeed} vs ${userQFOpponent ? getMascotName(userQFOpponent) : 'TBD'}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingWeek('CFP Quarterfinal')
                            setEditingYear(currentDynasty.currentYear)
                            setEditingOpponent(userQFOpponent)
                            setEditingBowlName(userQFBowlName)
                            setShowGameModal(true)
                          }}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          {userCFPQuarterfinalGame ? 'Edit' : 'Enter'}
                        </button>
                      </div>
                    )}

                    {/* Task: Taking a New Job? (appears every bowl week until accepted) */}
                    {(() => {
                      // Task number depends on how many tasks are showing above
                      let newJobTaskNum = 2
                      if (bowlEligible && selectedBowl && bowlOpponent && userBowlIsWeek2) newJobTaskNum++
                      if (userInCFPQuarterfinal && hasBowlWeek1Data) newJobTaskNum++
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

                    {/* Task: Fill Coordinator Vacancy (appears in Bowl Week 2+ if coordinator was fired) */}
                    {currentDynasty.coachPosition === 'HC' &&
                     (currentDynasty.conferenceChampionshipData?.firedOCName || currentDynasty.conferenceChampionshipData?.firedDCName) &&
                    (() => {
                      const firedOC = currentDynasty.conferenceChampionshipData?.firedOCName
                      const firedDC = currentDynasty.conferenceChampionshipData?.firedDCName
                      // Only mark as done if vacancy is actually filled (user said Yes and entered name)
                      const ocFilled = !firedOC || (filledOCVacancy === true && newOCName)
                      const dcFilled = !firedDC || (filledDCVacancy === true && newDCName)
                      const allFilled = ocFilled && dcFilled
                      // Task is "answered" but not filled - user said "Not Yet"
                      const ocAnswered = !firedOC || filledOCVacancy !== null
                      const dcAnswered = !firedDC || filledDCVacancy !== null
                      const allAnswered = ocAnswered && dcAnswered

                      // If all positions are filled, don't show this task at all
                      if (allFilled) return null

                      // Calculate task number
                      let taskNum = 2 // Base: after Week 1 results
                      if (bowlEligible && selectedBowl && bowlOpponent && userBowlIsWeek2) taskNum++ // User bowl game
                      taskNum++ // After "Taking a New Job?"

                      return (
                        <div
                          className="p-3 sm:p-4 rounded-lg border-2"
                          style={{ borderColor: `${teamColors.primary}30` }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${teamColors.primary}20`, color: teamColors.primary }}
                              >
                                <span className="font-bold text-sm sm:text-base">{taskNum}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base font-semibold" style={{ color: secondaryBgText }}>
                                  Fill Coordinator {firedOC && firedDC ? 'Vacancies' : 'Vacancy'}
                                </div>
                                {/* Show status if user answered but vacancy not filled */}
                                {allAnswered && !allFilled && (
                                  <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: secondaryBgText, opacity: 0.7 }}>
                                    {firedOC && (ocFilled ? `✓ OC: ${newOCName}` : 'OC: Not filled yet')}
                                    {firedOC && firedDC && ' • '}
                                    {firedDC && (dcFilled ? `✓ DC: ${newDCName}` : 'DC: Not filled yet')}
                                  </div>
                                )}
                              </div>
                            </div>
                            {allAnswered && !allFilled && (
                              <button
                                onClick={async () => {
                                  setFilledOCVacancy(null)
                                  setFilledDCVacancy(null)
                                  setNewOCName('')
                                  setNewDCName('')
                                  await updateDynasty(currentDynasty.id, { pendingCoordinatorHires: null })
                                }}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Edit
                              </button>
                            )}
                          </div>

                          {/* OC Vacancy Questions */}
                          {firedOC && filledOCVacancy === null && (
                            <div className="ml-13 pl-10 mt-3">
                              <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                                You fired {firedOC} (OC). Has the position been filled?
                              </p>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setFilledOCVacancy(true)}
                                  className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={async () => {
                                    setFilledOCVacancy(false)
                                    await updateDynasty(currentDynasty.id, {
                                      pendingCoordinatorHires: {
                                        ...currentDynasty.pendingCoordinatorHires,
                                        filledOC: false,
                                        newOCName: null
                                      }
                                    })
                                  }}
                                  className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  Not Yet
                                </button>
                              </div>
                            </div>
                          )}

                          {/* OC Name Input */}
                          {firedOC && filledOCVacancy === true && !newOCName && (
                            <div className="ml-13 pl-10 mt-3">
                              <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                                Enter new OC name:
                              </p>
                              <div className="flex gap-2 max-w-sm">
                                <input
                                  type="text"
                                  id="new-oc-name"
                                  className="flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none"
                                  style={{ borderColor: teamColors.primary }}
                                  placeholder="New OC name..."
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                      const name = e.target.value.trim()
                                      setNewOCName(name)
                                      await updateDynasty(currentDynasty.id, {
                                        pendingCoordinatorHires: {
                                          ...currentDynasty.pendingCoordinatorHires,
                                          filledOC: true,
                                          newOCName: name
                                        }
                                      })
                                    }
                                  }}
                                />
                                <button
                                  onClick={async () => {
                                    const input = document.getElementById('new-oc-name')
                                    if (input?.value.trim()) {
                                      const name = input.value.trim()
                                      setNewOCName(name)
                                      await updateDynasty(currentDynasty.id, {
                                        pendingCoordinatorHires: {
                                          ...currentDynasty.pendingCoordinatorHires,
                                          filledOC: true,
                                          newOCName: name
                                        }
                                      })
                                    }
                                  }}
                                  className="px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}

                          {/* DC Vacancy Questions (only show after OC is done) */}
                          {firedDC && ocAnswered && filledDCVacancy === null && (
                            <div className="ml-13 pl-10 mt-3">
                              <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                                You fired {firedDC} (DC). Has the position been filled?
                              </p>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setFilledDCVacancy(true)}
                                  className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={async () => {
                                    setFilledDCVacancy(false)
                                    await updateDynasty(currentDynasty.id, {
                                      pendingCoordinatorHires: {
                                        ...currentDynasty.pendingCoordinatorHires,
                                        filledDC: false,
                                        newDCName: null
                                      }
                                    })
                                  }}
                                  className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  Not Yet
                                </button>
                              </div>
                            </div>
                          )}

                          {/* DC Name Input */}
                          {firedDC && ocAnswered && filledDCVacancy === true && !newDCName && (
                            <div className="ml-13 pl-10 mt-3">
                              <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                                Enter new DC name:
                              </p>
                              <div className="flex gap-2 max-w-sm">
                                <input
                                  type="text"
                                  id="new-dc-name"
                                  className="flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none"
                                  style={{ borderColor: teamColors.primary }}
                                  placeholder="New DC name..."
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                      const name = e.target.value.trim()
                                      setNewDCName(name)
                                      await updateDynasty(currentDynasty.id, {
                                        pendingCoordinatorHires: {
                                          ...currentDynasty.pendingCoordinatorHires,
                                          filledDC: true,
                                          newDCName: name
                                        }
                                      })
                                    }
                                  }}
                                />
                                <button
                                  onClick={async () => {
                                    const input = document.getElementById('new-dc-name')
                                    if (input?.value.trim()) {
                                      const name = input.value.trim()
                                      setNewDCName(name)
                                      await updateDynasty(currentDynasty.id, {
                                        pendingCoordinatorHires: {
                                          ...currentDynasty.pendingCoordinatorHires,
                                          filledDC: true,
                                          newDCName: name
                                        }
                                      })
                                    }
                                  }}
                                  className="px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                                  style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                                >
                                  Save
                                </button>
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

            // Week 5: End of Season Recap - Enter championship result if user wasn't in it
            if (week === 5) {
              const champData = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.championship || []
              const hasChampData = champData.length > 0

              return (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                    End of Season Recap
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Task: Enter National Championship Result (only if user was NOT in championship) */}
                    {!userInCFPChampionship && (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          hasChampData ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!hasChampData ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              hasChampData ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!hasChampData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {hasChampData ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">1</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: hasChampData ? '#16a34a' : secondaryBgText }}>
                              National Championship Result
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasChampData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {hasChampData
                                ? `✓ ${champData[0]?.winner || 'Result entered'}`
                                : 'Enter the championship game result'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowCFPChampionshipModal(true)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          {hasChampData ? 'Edit' : 'Enter'}
                        </button>
                      </div>
                    )}

                    {/* Task: Player Stats Entry */}
                    {(() => {
                      const hasStatsData = currentDynasty?.playerStatsByYear?.[currentDynasty.currentYear]?.length > 0
                      const taskNumber = !userInCFPChampionship ? 2 : 1

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasStatsData ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasStatsData ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasStatsData ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasStatsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasStatsData ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasStatsData ? '#16a34a' : secondaryBgText }}>
                                Player Stats Entry
                              </div>
                              {hasStatsData && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  ✓ Stats entered for {currentDynasty?.playerStatsByYear?.[currentDynasty.currentYear]?.length || 0} players
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowStatsEntryModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasStatsData ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task: Detailed Stats Entry */}
                    {(() => {
                      const hasStatsData = currentDynasty?.playerStatsByYear?.[currentDynasty.currentYear]?.length > 0
                      const hasDetailedStats = currentDynasty?.detailedStatsByYear?.[currentDynasty.currentYear] &&
                        Object.keys(currentDynasty.detailedStatsByYear[currentDynasty.currentYear]).length > 0
                      const taskNumber = !userInCFPChampionship ? 3 : 2
                      const isLocked = !hasStatsData

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasDetailedStats ? 'border-green-200 bg-green-50' : ''
                          } ${isLocked ? 'opacity-50' : ''}`}
                          style={!hasDetailedStats ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasDetailedStats ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasDetailedStats ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasDetailedStats ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : isLocked ? (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasDetailedStats ? '#16a34a' : secondaryBgText }}>
                                Detailed Stats Entry
                              </div>
                              {(hasDetailedStats || isLocked) && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasDetailedStats ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                  {hasDetailedStats
                                    ? '✓ Detailed stats entered across all categories'
                                    : 'Complete Player Stats Entry first'}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => !isLocked && setShowDetailedStatsModal(true)}
                            disabled={isLocked}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-sm self-end sm:self-auto ${isLocked ? 'cursor-not-allowed' : 'hover:opacity-90'}`}
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText, opacity: isLocked ? 0.5 : 1 }}
                          >
                            {hasDetailedStats ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task: Conference Standings Entry */}
                    {(() => {
                      const hasStandingsData = currentDynasty?.conferenceStandingsByYear?.[currentDynasty.currentYear] &&
                        Object.keys(currentDynasty.conferenceStandingsByYear[currentDynasty.currentYear]).length > 0
                      const taskNumber = !userInCFPChampionship ? 4 : 3

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasStandingsData ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasStandingsData ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasStandingsData ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasStandingsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasStandingsData ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasStandingsData ? '#16a34a' : secondaryBgText }}>
                                Conference Standings
                              </div>
                              {hasStandingsData && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  ✓ Standings entered for {Object.keys(currentDynasty.conferenceStandingsByYear[currentDynasty.currentYear]).length} conferences
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowConferenceStandingsModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasStandingsData ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task: Final Top 25 Polls Entry */}
                    {(() => {
                      const hasPollsData = currentDynasty?.finalPollsByYear?.[currentDynasty.currentYear] &&
                        (currentDynasty.finalPollsByYear[currentDynasty.currentYear].media?.length > 0 ||
                         currentDynasty.finalPollsByYear[currentDynasty.currentYear].coaches?.length > 0)
                      const taskNumber = !userInCFPChampionship ? 5 : 4

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasPollsData ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasPollsData ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasPollsData ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasPollsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasPollsData ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasPollsData ? '#16a34a' : secondaryBgText }}>
                                Final Top 25 Polls
                              </div>
                              {hasPollsData && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  ✓ Final Media and Coaches Poll rankings entered
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowFinalPollsModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasPollsData ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task: Team Statistics Entry */}
                    {(() => {
                      const hasTeamStats = currentDynasty?.teamStatsByYear?.[currentDynasty.currentYear] &&
                        Object.keys(currentDynasty.teamStatsByYear[currentDynasty.currentYear]).length > 0
                      const taskNumber = !userInCFPChampionship ? 6 : 5

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasTeamStats ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasTeamStats ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasTeamStats ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasTeamStats ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasTeamStats ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasTeamStats ? '#16a34a' : secondaryBgText }}>
                                Team Statistics
                              </div>
                              {hasTeamStats && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  ✓ Team statistics entered
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowTeamStatsModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasTeamStats ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task: Season Awards Entry */}
                    {(() => {
                      const hasAwards = currentDynasty?.awardsByYear?.[currentDynasty.currentYear] &&
                        Object.keys(currentDynasty.awardsByYear[currentDynasty.currentYear]).length > 0
                      const taskNumber = !userInCFPChampionship ? 7 : 6

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasAwards ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasAwards ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasAwards ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasAwards ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasAwards ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasAwards ? '#16a34a' : secondaryBgText }}>
                                Season Awards
                              </div>
                              {hasAwards && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  ✓ {Object.keys(currentDynasty.awardsByYear[currentDynasty.currentYear]).length} awards entered
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowAwardsModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasAwards ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task: All-Americans & All-Conference Entry */}
                    {(() => {
                      const hasAllAmericans = currentDynasty?.allAmericansByYear?.[currentDynasty.currentYear] &&
                        ((currentDynasty.allAmericansByYear[currentDynasty.currentYear].allAmericans?.length > 0) ||
                         (currentDynasty.allAmericansByYear[currentDynasty.currentYear].allConference?.length > 0))
                      const taskNumber = !userInCFPChampionship ? 8 : 7

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasAllAmericans ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasAllAmericans ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasAllAmericans ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasAllAmericans ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasAllAmericans ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasAllAmericans ? '#16a34a' : secondaryBgText }}>
                                All-Americans & All-Conference
                              </div>
                              {hasAllAmericans && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  ✓ All-Americans and All-Conference selections entered
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowAllAmericansModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasAllAmericans ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                  </div>
                </>
              )
            }

            // Weeks 3-4: CFP rounds (Semifinals, Championship)
            // Note: CFP Semifinals CPU games are only entered in Week 4 (Championship week)
            // User's own SF game is entered in Week 3 via the dedicated task

            return (
              <>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                  {week === 5 ? 'End of Season Recap' : week === 4 ? 'National Championship' : `Bowl Week ${week}`}
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

                  {/* Task: Enter YOUR CFP Semifinal Game (Week 3 only, if user is in SF AND Bowl Week 2 data entered) */}
                  {week === 3 && userInCFPSemifinal && hasBowlWeek2Data && (
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        userCFPSemifinalGame ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!userCFPSemifinalGame ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            userCFPSemifinalGame ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!userCFPSemifinalGame ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {userCFPSemifinalGame ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: userCFPSemifinalGame ? '#16a34a' : secondaryBgText }}>
                            Enter Your CFP Semifinal Game
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: userCFPSemifinalGame ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {userCFPSemifinalGame
                              ? `✓ ${userCFPSemifinalGame.result === 'W' || userCFPSemifinalGame.result === 'win' ? 'Won' : 'Lost'} ${userCFPSemifinalGame.teamScore}-${userCFPSemifinalGame.opponentScore}`
                              : `${userSFBowlName || 'CFP Semifinal'} vs ${userSFOpponent ? getMascotName(userSFOpponent) || userSFOpponent : 'TBD'}`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingWeek('CFP Semifinal')
                          setEditingYear(currentDynasty.currentYear)
                          setEditingOpponent(userSFOpponent)
                          setEditingBowlName(userSFBowlName || 'CFP Semifinal')
                          setShowGameModal(true)
                        }}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {userCFPSemifinalGame ? 'Edit' : 'Enter'}
                      </button>
                    </div>
                  )}

                  {/* Week 4 (National Championship) Task Order:
                      - If user IS in Championship:
                        1. Enter the OTHER SF game (CPU vs CPU) to determine opponent
                        2. Enter user's Championship game
                      - If user is NOT in Championship:
                        1. Enter both SF games (both CPU vs CPU)
                  */}

                  {/* CFP Semifinals - FIRST task in Week 4 to determine Championship matchup */}
                  {week === 4 && (() => {
                    const sfData = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.semifinals || []
                    // Need BOTH SF games (2 total) to determine Championship matchup
                    // If user was in SF, their game is already in there from Week 3
                    const allSFComplete = sfData.length >= 2
                    // Calculate how many more games needed
                    const gamesEntered = sfData.length
                    const gamesRemaining = 2 - gamesEntered
                    const sfGamesNeeded = gamesRemaining === 1
                      ? '1 game remaining (to determine your opponent)'
                      : gamesRemaining === 2
                        ? '2 games'
                        : ''

                    return (
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        allSFComplete ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!allSFComplete ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            allSFComplete ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!allSFComplete ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {allSFComplete ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: allSFComplete ? '#16a34a' : secondaryBgText }}>
                            CFP Semifinal Results
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: allSFComplete ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {allSFComplete ? '✓ Results entered' : sfGamesNeeded}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCFPSemifinalsModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {allSFComplete ? 'Edit' : 'Enter'}
                      </button>
                    </div>
                    )
                  })()}

                  {/* Task: Enter YOUR CFP Championship Game (Week 4 only, if user is in Championship) */}
                  {/* This comes AFTER the SF results so we know the opponent */}
                  {week === 4 && userInCFPChampionship && (() => {
                    const sfData = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.semifinals || []
                    // Need BOTH SF games to determine Championship opponent
                    const allSFComplete = sfData.length >= 2

                    return (
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        userCFPChampionshipGame ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!userCFPChampionshipGame ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            userCFPChampionshipGame ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!userCFPChampionshipGame ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {userCFPChampionshipGame ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">2</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: userCFPChampionshipGame ? '#16a34a' : secondaryBgText }}>
                            Enter Your National Championship Game
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: userCFPChampionshipGame ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {userCFPChampionshipGame
                              ? `✓ ${userCFPChampionshipGame.result === 'W' || userCFPChampionshipGame.result === 'win' ? 'Won' : 'Lost'} ${userCFPChampionshipGame.teamScore}-${userCFPChampionshipGame.opponentScore}`
                              : allSFComplete
                                ? `National Championship vs ${userChampOpponent ? getMascotName(userChampOpponent) || userChampOpponent : 'TBD'}`
                                : 'Enter SF results first to determine opponent'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingWeek('CFP Championship')
                          setEditingYear(currentDynasty.currentYear)
                          setEditingOpponent(userChampOpponent)
                          setEditingBowlName('National Championship')
                          setShowGameModal(true)
                        }}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {userCFPChampionshipGame ? 'Edit' : 'Enter'}
                      </button>
                    </div>
                    )
                  })()}

                  {/* CFP Championship - REMOVED FROM WEEK 4 for non-championship users */}
                  {/* Users who are NOT in the championship will enter this result in Week 5 (End of Season Recap) */}

                  {/* Task: Taking a New Job? (appears in bowl weeks 1-3, not in week 4/championship) */}
                  {week !== 4 && (
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
                  )}

                  {/* Task: Fill Coordinator Vacancy (appears in Bowl Week 3-5 if coordinator was fired) */}
                  {currentDynasty.coachPosition === 'HC' &&
                   (currentDynasty.conferenceChampionshipData?.firedOCName || currentDynasty.conferenceChampionshipData?.firedDCName) &&
                  (() => {
                    const firedOC = currentDynasty.conferenceChampionshipData?.firedOCName
                    const firedDC = currentDynasty.conferenceChampionshipData?.firedDCName
                    // Only mark as done if vacancy is actually filled (user said Yes and entered name)
                    const ocFilled = !firedOC || (filledOCVacancy === true && newOCName)
                    const dcFilled = !firedDC || (filledDCVacancy === true && newDCName)
                    const allFilled = ocFilled && dcFilled
                    // Task is "answered" but not filled - user said "Not Yet"
                    const ocAnswered = !firedOC || filledOCVacancy !== null
                    const dcAnswered = !firedDC || filledDCVacancy !== null
                    const allAnswered = ocAnswered && dcAnswered

                    // If all positions are filled, don't show this task at all
                    if (allFilled) return null

                    return (
                      <div
                        className="p-3 sm:p-4 rounded-lg border-2"
                        style={{ borderColor: `${teamColors.primary}30` }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${teamColors.primary}20`, color: teamColors.primary }}
                            >
                              <span className="font-bold text-sm sm:text-base">3</span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: secondaryBgText }}>
                                Fill Coordinator {firedOC && firedDC ? 'Vacancies' : 'Vacancy'}
                              </div>
                              {/* Show status if user answered but vacancy not filled */}
                              {allAnswered && !allFilled && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: secondaryBgText, opacity: 0.7 }}>
                                  {firedOC && (ocFilled ? `✓ OC: ${newOCName}` : 'OC: Not filled yet')}
                                  {firedOC && firedDC && ' • '}
                                  {firedDC && (dcFilled ? `✓ DC: ${newDCName}` : 'DC: Not filled yet')}
                                </div>
                              )}
                            </div>
                          </div>
                          {allAnswered && !allFilled && (
                            <button
                              onClick={async () => {
                                setFilledOCVacancy(null)
                                setFilledDCVacancy(null)
                                setNewOCName('')
                                setNewDCName('')
                                await updateDynasty(currentDynasty.id, { pendingCoordinatorHires: null })
                              }}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {/* OC Vacancy Questions */}
                        {firedOC && filledOCVacancy === null && (
                          <div className="ml-13 pl-10 mt-3">
                            <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                              You fired {firedOC} (OC). Has the position been filled?
                            </p>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setFilledOCVacancy(true)}
                                className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Yes
                              </button>
                              <button
                                onClick={async () => {
                                  setFilledOCVacancy(false)
                                  await updateDynasty(currentDynasty.id, {
                                    pendingCoordinatorHires: {
                                      ...currentDynasty.pendingCoordinatorHires,
                                      filledOC: false,
                                      newOCName: null
                                    }
                                  })
                                }}
                                className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Not Yet
                              </button>
                            </div>
                          </div>
                        )}

                        {/* OC Name Input */}
                        {firedOC && filledOCVacancy === true && !newOCName && (
                          <div className="ml-13 pl-10 mt-3">
                            <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                              Enter new OC name:
                            </p>
                            <div className="flex gap-2 max-w-sm">
                              <input
                                type="text"
                                id="new-oc-name-week35"
                                className="flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none"
                                style={{ borderColor: teamColors.primary }}
                                placeholder="New OC name..."
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && e.target.value.trim()) {
                                    const name = e.target.value.trim()
                                    setNewOCName(name)
                                    await updateDynasty(currentDynasty.id, {
                                      pendingCoordinatorHires: {
                                        ...currentDynasty.pendingCoordinatorHires,
                                        filledOC: true,
                                        newOCName: name
                                      }
                                    })
                                  }
                                }}
                              />
                              <button
                                onClick={async () => {
                                  const input = document.getElementById('new-oc-name-week35')
                                  if (input?.value.trim()) {
                                    const name = input.value.trim()
                                    setNewOCName(name)
                                    await updateDynasty(currentDynasty.id, {
                                      pendingCoordinatorHires: {
                                        ...currentDynasty.pendingCoordinatorHires,
                                        filledOC: true,
                                        newOCName: name
                                      }
                                    })
                                  }
                                }}
                                className="px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}

                        {/* DC Vacancy Questions */}
                        {firedDC && ocAnswered && filledDCVacancy === null && (
                          <div className="ml-13 pl-10 mt-3">
                            <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                              You fired {firedDC} (DC). Has the position been filled?
                            </p>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setFilledDCVacancy(true)}
                                className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Yes
                              </button>
                              <button
                                onClick={async () => {
                                  setFilledDCVacancy(false)
                                  await updateDynasty(currentDynasty.id, {
                                    pendingCoordinatorHires: {
                                      ...currentDynasty.pendingCoordinatorHires,
                                      filledDC: false,
                                      newDCName: null
                                    }
                                  })
                                }}
                                className="px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Not Yet
                              </button>
                            </div>
                          </div>
                        )}

                        {/* DC Name Input */}
                        {firedDC && ocAnswered && filledDCVacancy === true && !newDCName && (
                          <div className="ml-13 pl-10 mt-3">
                            <p className="mb-2 font-medium" style={{ color: secondaryBgText }}>
                              Enter new DC name:
                            </p>
                            <div className="flex gap-2 max-w-sm">
                              <input
                                type="text"
                                id="new-dc-name-week35"
                                className="flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none"
                                style={{ borderColor: teamColors.primary }}
                                placeholder="New DC name..."
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && e.target.value.trim()) {
                                    const name = e.target.value.trim()
                                    setNewDCName(name)
                                    await updateDynasty(currentDynasty.id, {
                                      pendingCoordinatorHires: {
                                        ...currentDynasty.pendingCoordinatorHires,
                                        filledDC: true,
                                        newDCName: name
                                      }
                                    })
                                  }
                                }}
                              />
                              <button
                                onClick={async () => {
                                  const input = document.getElementById('new-dc-name-week35')
                                  if (input?.value.trim()) {
                                    const name = input.value.trim()
                                    setNewDCName(name)
                                    await updateDynasty(currentDynasty.id, {
                                      pendingCoordinatorHires: {
                                        ...currentDynasty.pendingCoordinatorHires,
                                        filledDC: true,
                                        newDCName: name
                                      }
                                    })
                                  }
                                }}
                                className="px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
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

              // Use Link for played games, div for scheduled games
              const gameContent = (
                <>
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
                </>
              )

              const wrapperStyle = {
                backgroundColor: opponentColors.backgroundColor,
                borderColor: playedGame
                  ? playedGame.result === 'win'
                    ? '#86efac'
                    : '#fca5a5'
                  : isCurrentWeek
                    ? teamColors.primary
                    : opponentColors.backgroundColor,
                boxShadow: isCurrentWeek ? `0 0 0 3px ${teamColors.primary}40, 0 4px 12px ${teamColors.primary}30` : 'none'
              }

              // Link to game page for played games, div for scheduled games
              if (playedGame?.id) {
                return (
                  <Link
                    key={index}
                    to={`/dynasty/${currentDynasty.id}/game/${playedGame.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block"
                    style={wrapperStyle}
                  >
                    {gameContent}
                  </Link>
                )
              }

              return (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0"
                  style={wrapperStyle}
                >
                  {gameContent}
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

              const ccWrapperStyle = {
                backgroundColor: hasOpponent ? ccOpponentColors.backgroundColor : '#6b7280',
                borderColor: ccGame
                  ? ccGame.result === 'win'
                    ? '#86efac'
                    : '#fca5a5'
                  : isCurrentCCWeek
                    ? teamColors.primary
                    : hasOpponent ? ccOpponentColors.backgroundColor : '#6b7280',
                boxShadow: isCurrentCCWeek ? `0 0 0 3px ${teamColors.primary}40, 0 4px 12px ${teamColors.primary}30` : 'none'
              }

              const ccContent = (
                <>
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
                </>
              )

              // Link to game page for played CC games
              if (ccGame) {
                // Use game ID or generate a fallback based on type and year
                const gameId = ccGame.id || `cc-${currentDynasty.currentYear}`
                return (
                  <Link
                    to={`/dynasty/${currentDynasty.id}/game/${gameId}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block"
                    style={ccWrapperStyle}
                  >
                    {ccContent}
                  </Link>
                )
              }

              return (
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0"
                  style={ccWrapperStyle}
                >
                  {ccContent}
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

              const bowlWrapperStyle = {
                backgroundColor: hasOpponent ? bowlOpponentColors.backgroundColor : '#6b7280',
                borderColor: userBowlGameData
                  ? userBowlGameData.result === 'win'
                    ? '#86efac'
                    : '#fca5a5'
                  : hasOpponent ? bowlOpponentColors.backgroundColor : '#6b7280'
              }

              const bowlContent = (
                <>
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
                </>
              )

              // Link to game page for played bowl games
              if (userBowlGameData) {
                // Use game ID or generate a fallback based on bowl name and year
                const bowlSlug = userBowlGameData.bowlName?.replace(/\s+/g, '-').toLowerCase() || 'bowl'
                const gameId = userBowlGameData.id || `bowl-${currentDynasty.currentYear}-${bowlSlug}`
                return (
                  <Link
                    to={`/dynasty/${currentDynasty.id}/game/${gameId}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block"
                    style={bowlWrapperStyle}
                  >
                    {bowlContent}
                  </Link>
                )
              }

              return (
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0"
                  style={bowlWrapperStyle}
                >
                  {bowlContent}
                </div>
              )
            })()}

            {/* CFP First Round Game - shows when user played in First Round */}
            {(() => {
              const cfpFirstRoundGame = currentDynasty.games?.find(g => g.isCFPFirstRound && g.year === currentDynasty.currentYear)
              if (!cfpFirstRoundGame) return null

              const cfpOpponentAbbr = cfpFirstRoundGame.opponent
              const hasOpponent = !!cfpOpponentAbbr
              const cfpOpponentColors = hasOpponent ? getOpponentColors(cfpOpponentAbbr) : { backgroundColor: '#6b7280', textColor: '#ffffff' }
              const mascotFromAbbr = hasOpponent ? getMascotName(cfpOpponentAbbr) : null
              const cfpMascotName = mascotFromAbbr || (hasOpponent && getTeamLogo(cfpOpponentAbbr) ? cfpOpponentAbbr : null)
              const cfpOpponentName = cfpMascotName || (hasOpponent ? getTeamNameFromAbbr(cfpOpponentAbbr) : 'Opponent Unknown')
              const cfpOpponentLogo = cfpMascotName ? getTeamLogo(cfpMascotName) : null

              // Link to game page for CFP First Round
              return (
                <Link
                  to={`/dynasty/${currentDynasty.id}/game/${cfpFirstRoundGame.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block"
                  style={{
                    backgroundColor: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280',
                    borderColor: cfpFirstRoundGame.result === 'W' || cfpFirstRoundGame.result === 'win' ? '#86efac' : '#fca5a5'
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16 flex-shrink-0" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff', opacity: 0.9 }}>
                      CFP R1
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0" style={{
                        backgroundColor: hasOpponent ? cfpOpponentColors.textColor : '#ffffff',
                        color: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280'
                      }}>
                        vs
                      </span>
                      {cfpOpponentLogo && (
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', border: `2px solid ${cfpOpponentColors.textColor}`, padding: '2px' }}>
                          <img src={cfpOpponentLogo} alt={`${cfpOpponentName} logo`} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <span className="text-sm sm:text-base font-semibold truncate" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                          {cfpOpponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-start">
                    <div className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded" style={{ backgroundColor: cfpFirstRoundGame.result === 'W' || cfpFirstRoundGame.result === 'win' ? '#22c55e' : '#ef4444', color: '#ffffff' }}>
                      {cfpFirstRoundGame.result === 'W' || cfpFirstRoundGame.result === 'win' ? 'W' : 'L'}
                    </div>
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-bold" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                        {cfpFirstRoundGame.teamScore} - {cfpFirstRoundGame.opponentScore}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })()}

            {/* CFP Quarterfinal Game - shows when user played in Quarterfinal */}
            {(() => {
              const cfpQFGame = currentDynasty.games?.find(g => g.isCFPQuarterfinal && g.year === currentDynasty.currentYear)
              if (!cfpQFGame) return null

              const cfpOpponentAbbr = cfpQFGame.opponent
              const hasOpponent = !!cfpOpponentAbbr
              const cfpOpponentColors = hasOpponent ? getOpponentColors(cfpOpponentAbbr) : { backgroundColor: '#6b7280', textColor: '#ffffff' }
              const mascotFromAbbr = hasOpponent ? getMascotName(cfpOpponentAbbr) : null
              const cfpMascotName = mascotFromAbbr || (hasOpponent && getTeamLogo(cfpOpponentAbbr) ? cfpOpponentAbbr : null)
              const cfpOpponentName = cfpMascotName || (hasOpponent ? getTeamNameFromAbbr(cfpOpponentAbbr) : 'Opponent Unknown')
              const cfpOpponentLogo = cfpMascotName ? getTeamLogo(cfpMascotName) : null
              const bowlName = cfpQFGame.bowlName || 'CFP QF'

              // Link to game page for CFP Quarterfinal
              return (
                <Link
                  to={`/dynasty/${currentDynasty.id}/game/${cfpQFGame.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block"
                  style={{
                    backgroundColor: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280',
                    borderColor: cfpQFGame.result === 'W' || cfpQFGame.result === 'win' ? '#86efac' : '#fca5a5'
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16 flex-shrink-0" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff', opacity: 0.9 }}>
                      CFP QF
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0" style={{
                        backgroundColor: hasOpponent ? cfpOpponentColors.textColor : '#ffffff',
                        color: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280'
                      }}>
                        vs
                      </span>
                      {cfpOpponentLogo && (
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', border: `2px solid ${cfpOpponentColors.textColor}`, padding: '2px' }}>
                          <img src={cfpOpponentLogo} alt={`${cfpOpponentName} logo`} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <span className="text-sm sm:text-base font-semibold truncate" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                          {cfpOpponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-start">
                    <div className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded" style={{ backgroundColor: cfpQFGame.result === 'W' || cfpQFGame.result === 'win' ? '#22c55e' : '#ef4444', color: '#ffffff' }}>
                      {cfpQFGame.result === 'W' || cfpQFGame.result === 'win' ? 'W' : 'L'}
                    </div>
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-bold" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                        {cfpQFGame.teamScore} - {cfpQFGame.opponentScore}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })()}

            {/* CFP Semifinal Game - shows when user played in Semifinal */}
            {(() => {
              const cfpSFGame = currentDynasty.games?.find(g => g.isCFPSemifinal && g.year === currentDynasty.currentYear)
              if (!cfpSFGame) return null

              const cfpOpponentAbbr = cfpSFGame.opponent
              const hasOpponent = !!cfpOpponentAbbr
              const cfpOpponentColors = hasOpponent ? getOpponentColors(cfpOpponentAbbr) : { backgroundColor: '#6b7280', textColor: '#ffffff' }
              const mascotFromAbbr = hasOpponent ? getMascotName(cfpOpponentAbbr) : null
              const cfpMascotName = mascotFromAbbr || (hasOpponent && getTeamLogo(cfpOpponentAbbr) ? cfpOpponentAbbr : null)
              const cfpOpponentName = cfpMascotName || (hasOpponent ? getTeamNameFromAbbr(cfpOpponentAbbr) : 'Opponent Unknown')
              const cfpOpponentLogo = cfpMascotName ? getTeamLogo(cfpMascotName) : null

              // Link to game page for CFP Semifinal
              return (
                <Link
                  to={`/dynasty/${currentDynasty.id}/game/${cfpSFGame.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block"
                  style={{
                    backgroundColor: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280',
                    borderColor: cfpSFGame.result === 'W' || cfpSFGame.result === 'win' ? '#86efac' : '#fca5a5'
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16 flex-shrink-0" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff', opacity: 0.9 }}>
                      CFP SF
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0" style={{
                        backgroundColor: hasOpponent ? cfpOpponentColors.textColor : '#ffffff',
                        color: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280'
                      }}>
                        vs
                      </span>
                      {cfpOpponentLogo && (
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', border: `2px solid ${cfpOpponentColors.textColor}`, padding: '2px' }}>
                          <img src={cfpOpponentLogo} alt={`${cfpOpponentName} logo`} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <span className="text-sm sm:text-base font-semibold truncate" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                          {cfpOpponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-start">
                    <div className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded" style={{ backgroundColor: cfpSFGame.result === 'W' || cfpSFGame.result === 'win' ? '#22c55e' : '#ef4444', color: '#ffffff' }}>
                      {cfpSFGame.result === 'W' || cfpSFGame.result === 'win' ? 'W' : 'L'}
                    </div>
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-bold" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                        {cfpSFGame.teamScore} - {cfpSFGame.opponentScore}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })()}

            {/* CFP Championship Game - shows when user played in Championship */}
            {(() => {
              const cfpChampGame = currentDynasty.games?.find(g => g.isCFPChampionship && g.year === currentDynasty.currentYear)
              if (!cfpChampGame) return null

              const cfpOpponentAbbr = cfpChampGame.opponent
              const hasOpponent = !!cfpOpponentAbbr
              const cfpOpponentColors = hasOpponent ? getOpponentColors(cfpOpponentAbbr) : { backgroundColor: '#6b7280', textColor: '#ffffff' }
              const mascotFromAbbr = hasOpponent ? getMascotName(cfpOpponentAbbr) : null
              const cfpMascotName = mascotFromAbbr || (hasOpponent && getTeamLogo(cfpOpponentAbbr) ? cfpOpponentAbbr : null)
              const cfpOpponentName = cfpMascotName || (hasOpponent ? getTeamNameFromAbbr(cfpOpponentAbbr) : 'Opponent Unknown')
              const cfpOpponentLogo = cfpMascotName ? getTeamLogo(cfpMascotName) : null

              // Link to game page for CFP Championship
              return (
                <Link
                  to={`/dynasty/${currentDynasty.id}/game/${cfpChampGame.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border-2 gap-2 sm:gap-0 cursor-pointer hover:opacity-90 transition-opacity block"
                  style={{
                    backgroundColor: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280',
                    borderColor: cfpChampGame.result === 'W' || cfpChampGame.result === 'win' ? '#86efac' : '#fca5a5'
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm font-medium w-12 sm:w-16 flex-shrink-0" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff', opacity: 0.9 }}>
                      Natl
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0" style={{
                        backgroundColor: hasOpponent ? cfpOpponentColors.textColor : '#ffffff',
                        color: hasOpponent ? cfpOpponentColors.backgroundColor : '#6b7280'
                      }}>
                        vs
                      </span>
                      {cfpOpponentLogo && (
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', border: `2px solid ${cfpOpponentColors.textColor}`, padding: '2px' }}>
                          <img src={cfpOpponentLogo} alt={`${cfpOpponentName} logo`} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <span className="text-sm sm:text-base font-semibold truncate" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                          {cfpOpponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-start">
                    <div className="text-sm sm:text-lg font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded" style={{ backgroundColor: cfpChampGame.result === 'W' || cfpChampGame.result === 'win' ? '#22c55e' : '#ef4444', color: '#ffffff' }}>
                      {cfpChampGame.result === 'W' || cfpChampGame.result === 'win' ? 'W' : 'L'}
                    </div>
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-bold" style={{ color: hasOpponent ? cfpOpponentColors.textColor : '#ffffff' }}>
                        {cfpChampGame.teamScore} - {cfpChampGame.opponentScore}
                      </div>
                    </div>
                  </div>
                </Link>
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

      <NewJobEditModal
        isOpen={showNewJobEditModal}
        onClose={() => setShowNewJobEditModal(false)}
        onSave={handleNewJobSave}
        teamColors={teamColors}
        currentJobData={currentDynasty.newJobData}
      />

      <GameEntryModal
        isOpen={showGameModal}
        onClose={() => {
          setShowGameModal(false)
          setEditingWeek(null)
          setEditingYear(null)
          setEditingOpponent(null)
          setEditingBowlName(null)
        }}
        onSave={handleGameSave}
        weekNumber={editingWeek || currentDynasty.currentWeek}
        currentYear={editingYear || currentDynasty.currentYear}
        teamColors={teamColors}
        opponent={editingOpponent}
        bowlName={editingBowlName}
      />

      {/* GameDetailModal removed - now using game pages instead */}

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
          // UNIFIED: Also save CPU CC games to games[] array for consistent game recap experience
          await saveCPUConferenceChampionships(currentDynasty.id, championships, year)
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
          try {
            const year = currentDynasty.currentYear
            const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)

            // Helper to sanitize game data for Firestore (replace null/undefined with valid defaults)
            const sanitizeGame = (game) => ({
              bowlName: game.bowlName || '',
              team1: game.team1 || '',
              team2: game.team2 || '',
              team1Score: typeof game.team1Score === 'number' ? game.team1Score : null,
              team2Score: typeof game.team2Score === 'number' ? game.team2Score : null,
              winner: game.winner || null
            })

            // Filter games that have at least one score entered (games that were played)
            const gamesWithScores = bowlGames.filter(g =>
              g.team1Score !== null && g.team1Score !== undefined &&
              g.team2Score !== null && g.team2Score !== undefined
            )

            // Separate CFP First Round games from regular bowl games
            const cfpFirstRoundGames = gamesWithScores.filter(g => g.bowlName?.startsWith('CFP First Round'))
            const regularBowlGames = gamesWithScores.filter(g => !g.bowlName?.startsWith('CFP First Round'))

            // Transform CFP First Round games to match expected format
            const cfpFirstRound = cfpFirstRoundGames.map(game => {
              const sanitized = sanitizeGame(game)
              // Extract seed numbers from bowl name like "CFP First Round (#5 vs #12)"
              const seedMatch = game.bowlName?.match(/#(\d+) vs #(\d+)/)
              const seed1 = seedMatch ? parseInt(seedMatch[1]) : null
              const seed2 = seedMatch ? parseInt(seedMatch[2]) : null
              return {
                seed1,
                seed2,
                team1: sanitized.team1,
                team2: sanitized.team2,
                team1Score: sanitized.team1Score,
                team2Score: sanitized.team2Score,
                winner: sanitized.winner
              }
            })

            // Sanitize regular bowl games
            const sanitizedBowlGames = regularBowlGames.map(sanitizeGame)

            const existingBowlByYear = currentDynasty.bowlGamesByYear || {}
            const existingBowlYearData = existingBowlByYear[year] || {}
            const existingCFPByYear = currentDynasty.cfpResultsByYear || {}
            const existingCFPYearData = existingCFPByYear[year] || {}

            // CRITICAL FIX: Preserve user's games that were entered separately and excluded from the sheet
            // Find user's existing Week 1 bowl game (if any)
            const existingWeek1Games = existingBowlYearData.week1 || []
            const userExistingBowlGame = existingWeek1Games.find(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Check if user's game is already in the new data from the sheet
            const userGameInSheet = sanitizedBowlGames.some(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Merge: keep user's game if it exists and wasn't in the sheet
            const mergedBowlGames = userExistingBowlGame && !userGameInSheet
              ? [...sanitizedBowlGames, userExistingBowlGame]
              : sanitizedBowlGames

            // Find user's existing CFP First Round game (if any)
            const existingFirstRound = existingCFPYearData.firstRound || []
            const userExistingCFPGame = existingFirstRound.find(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Check if user's CFP game is already in the new data from the sheet
            const userCFPGameInSheet = cfpFirstRound.some(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Merge: keep user's CFP game if it exists and wasn't in the sheet
            const mergedCFPFirstRound = userExistingCFPGame && !userCFPGameInSheet
              ? [...cfpFirstRound, userExistingCFPGame]
              : cfpFirstRound

            console.log('Bowl Week 1 - Saving data:', {
              regularBowlGames: mergedBowlGames.length,
              cfpFirstRound: mergedCFPFirstRound.length,
              preservedUserBowlGame: userExistingBowlGame && !userGameInSheet,
              preservedUserCFPGame: userExistingCFPGame && !userCFPGameInSheet
            })

            await updateDynasty(currentDynasty.id, {
              bowlGamesByYear: {
                ...existingBowlByYear,
                [year]: {
                  ...existingBowlYearData,
                  week1: mergedBowlGames
                }
              },
              cfpResultsByYear: {
                ...existingCFPByYear,
                [year]: {
                  ...existingCFPYearData,
                  firstRound: mergedCFPFirstRound
                }
              }
            })

            // UNIFIED GAME STORAGE: Create proper game entries for all CPU bowl games
            // This ensures bowl games are stored the same way as user games
            await saveCPUBowlGames(currentDynasty.id, mergedBowlGames, year, 'week1')
            console.log('Bowl Week 1 - Save successful (including unified game entries)')
          } catch (error) {
            console.error('Bowl Week 1 - Save failed:', error)
            throw error
          }
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Bowl Week 2 Modal */}
      <BowlWeek2Modal
        isOpen={showBowlWeek2Modal}
        onClose={() => setShowBowlWeek2Modal(false)}
        onSave={async (bowlGames) => {
          try {
            const year = currentDynasty.currentYear
            const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)

            // Helper to sanitize game data for Firestore (replace null/undefined with valid defaults)
            const sanitizeGame = (game) => ({
              bowlName: game.bowlName || '',
              team1: game.team1 || '',
              team2: game.team2 || '',
              team1Score: typeof game.team1Score === 'number' ? game.team1Score : null,
              team2Score: typeof game.team2Score === 'number' ? game.team2Score : null,
              winner: game.winner || null
            })

            // Filter games that have scores entered (games that were played)
            const gamesWithScores = bowlGames.filter(g =>
              g.team1Score !== null && g.team1Score !== undefined &&
              g.team2Score !== null && g.team2Score !== undefined
            )

            console.log('Bowl Week 2 - Games from sheet:', bowlGames.length)
            console.log('Bowl Week 2 - Games with scores:', gamesWithScores.length)

            // Separate CFP Quarterfinal games from regular bowl games
            const cfpQuarterfinalGames = gamesWithScores.filter(game =>
              game.bowlName?.includes('CFP QF') || game.bowlName?.includes('CFP Quarterfinal')
            )
            const regularBowlGames = gamesWithScores.filter(game =>
              !game.bowlName?.includes('CFP QF') && !game.bowlName?.includes('CFP Quarterfinal')
            )

            console.log('Bowl Week 2 - CFP QF games:', cfpQuarterfinalGames.length)
            console.log('Bowl Week 2 - Regular bowl games:', regularBowlGames.length)

            // Map CFP Quarterfinal games to structured format with bowl info
            const cfpQuarterfinals = cfpQuarterfinalGames.map(game => {
              const sanitized = sanitizeGame(game)
              // Extract bowl name (e.g., "Cotton Bowl" from "Cotton Bowl (CFP QF)")
              const bowlMatch = game.bowlName?.match(/^(.+?)\s*\(CFP/)
              const bowlName = bowlMatch ? bowlMatch[1].trim() : sanitized.bowlName
              return {
                bowlName,
                team1: sanitized.team1,
                team2: sanitized.team2,
                team1Score: sanitized.team1Score,
                team2Score: sanitized.team2Score,
                winner: sanitized.winner
              }
            })

            // Sanitize regular bowl games
            const sanitizedBowlGames = regularBowlGames.map(sanitizeGame)

            const existingBowlByYear = currentDynasty.bowlGamesByYear || {}
            const existingBowlYearData = existingBowlByYear[year] || {}
            const existingCFPByYear = currentDynasty.cfpResultsByYear || {}
            const existingCFPYearData = existingCFPByYear[year] || {}

            // CRITICAL FIX: Preserve user's games that were entered separately and excluded from the sheet
            // Find user's existing Week 2 bowl game (if any)
            const existingWeek2Games = existingBowlYearData.week2 || []
            const userExistingBowlGame = existingWeek2Games.find(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Check if user's game is already in the new data from the sheet
            const userGameInSheet = sanitizedBowlGames.some(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Merge: keep user's game if it exists and wasn't in the sheet
            const mergedBowlGames = userExistingBowlGame && !userGameInSheet
              ? [...sanitizedBowlGames, userExistingBowlGame]
              : sanitizedBowlGames

            // Find user's existing CFP Quarterfinal game (if any)
            const existingQuarterfinals = existingCFPYearData.quarterfinals || []
            const userExistingCFPGame = existingQuarterfinals.find(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Check if user's CFP game is already in the new data from the sheet
            const userCFPGameInSheet = cfpQuarterfinals.some(g =>
              g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
            )
            // Merge: keep user's CFP game if it exists and wasn't in the sheet
            const mergedCFPQuarterfinals = userExistingCFPGame && !userCFPGameInSheet
              ? [...cfpQuarterfinals, userExistingCFPGame]
              : cfpQuarterfinals

            console.log('Bowl Week 2 - Saving:', {
              regularBowlGames: mergedBowlGames.length,
              cfpQuarterfinals: mergedCFPQuarterfinals.length,
              cfpQuarterfinalsData: mergedCFPQuarterfinals,
              preservedUserBowlGame: userExistingBowlGame && !userGameInSheet,
              preservedUserCFPGame: userExistingCFPGame && !userCFPGameInSheet
            })

            await updateDynasty(currentDynasty.id, {
              bowlGamesByYear: {
                ...existingBowlByYear,
                [year]: {
                  ...existingBowlYearData,
                  week2: mergedBowlGames
                }
              },
              cfpResultsByYear: {
                ...existingCFPByYear,
                [year]: {
                  ...existingCFPYearData,
                  quarterfinals: mergedCFPQuarterfinals
                }
              }
            })

            // UNIFIED GAME STORAGE: Create proper game entries for all CPU bowl games
            await saveCPUBowlGames(currentDynasty.id, mergedBowlGames, year, 'week2')
            console.log('Bowl Week 2 - Save successful (including unified game entries)')
          } catch (error) {
            console.error('Bowl Week 2 - Save failed:', error)
            throw error
          }
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
          const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}

          // CRITICAL FIX: Preserve user's game that was entered separately
          const existingFirstRound = existingYearData.firstRound || []
          const userExistingGame = existingFirstRound.find(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const userGameInSheet = games.some(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const mergedGames = userExistingGame && !userGameInSheet
            ? [...games, userExistingGame]
            : games

          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                firstRound: mergedGames
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
          const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}

          // CRITICAL FIX: Preserve user's game that was entered separately
          const weekKey = `week${week}`
          const existingWeekGames = existingYearData[weekKey] || []
          const userExistingGame = existingWeekGames.find(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const userGameInSheet = cfpGames.some(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const mergedCFPGames = userExistingGame && !userGameInSheet
            ? [...cfpGames, userExistingGame]
            : cfpGames

          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                [weekKey]: mergedCFPGames
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
          const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}

          // CRITICAL FIX: Preserve user's game that was entered separately
          const existingQuarterfinals = existingYearData.quarterfinals || []
          const userExistingGame = existingQuarterfinals.find(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const userGameInSheet = cfpGames.some(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const mergedCFPGames = userExistingGame && !userGameInSheet
            ? [...cfpGames, userExistingGame]
            : cfpGames

          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                quarterfinals: mergedCFPGames
              }
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* CFP Semifinals Modal (Week 4) */}
      <CFPSemifinalsModal
        isOpen={showCFPSemifinalsModal}
        onClose={() => setShowCFPSemifinalsModal(false)}
        userTeamAbbr={getAbbreviationFromDisplayName(currentDynasty.teamName)}
        onSave={async (cfpGames) => {
          const year = currentDynasty.currentYear
          const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}

          // CRITICAL FIX: Preserve user's game that was entered separately
          const existingSemifinals = existingYearData.semifinals || []
          const userExistingGame = existingSemifinals.find(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const userGameInSheet = cfpGames.some(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const mergedCFPGames = userExistingGame && !userGameInSheet
            ? [...cfpGames, userExistingGame]
            : cfpGames

          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                semifinals: mergedCFPGames
              }
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* CFP Championship Modal (Week 5) */}
      <CFPChampionshipModal
        isOpen={showCFPChampionshipModal}
        onClose={() => setShowCFPChampionshipModal(false)}
        onSave={async (cfpGames) => {
          const year = currentDynasty.currentYear
          const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
          const existingByYear = currentDynasty.cfpResultsByYear || {}
          const existingYearData = existingByYear[year] || {}

          // CRITICAL FIX: Preserve user's game that was entered separately
          const existingChampionship = existingYearData.championship || []
          const userExistingGame = existingChampionship.find(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const userGameInSheet = cfpGames.some(g =>
            g.team1 === userTeamAbbr || g.team2 === userTeamAbbr
          )
          const mergedCFPGames = userExistingGame && !userGameInSheet
            ? [...cfpGames, userExistingGame]
            : cfpGames

          await updateDynasty(currentDynasty.id, {
            cfpResultsByYear: {
              ...existingByYear,
              [year]: {
                ...existingYearData,
                championship: mergedCFPGames
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

      {/* Stats Entry Modal (End of Season Recap) */}
      <StatsEntryModal
        isOpen={showStatsEntryModal}
        onClose={() => setShowStatsEntryModal(false)}
        onSave={async (stats) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.playerStatsByYear || {}
          await updateDynasty(currentDynasty.id, {
            playerStatsByYear: {
              ...existingByYear,
              [year]: stats
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Detailed Stats Entry Modal (End of Season Recap) */}
      <DetailedStatsEntryModal
        isOpen={showDetailedStatsModal}
        onClose={() => setShowDetailedStatsModal(false)}
        onSave={async (detailedStats) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.detailedStatsByYear || {}
          await updateDynasty(currentDynasty.id, {
            detailedStatsByYear: {
              ...existingByYear,
              [year]: detailedStats
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Conference Standings Entry Modal (End of Season Recap) */}
      <ConferenceStandingsModal
        isOpen={showConferenceStandingsModal}
        onClose={() => setShowConferenceStandingsModal(false)}
        onSave={async (standings) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.conferenceStandingsByYear || {}
          await updateDynasty(currentDynasty.id, {
            conferenceStandingsByYear: {
              ...existingByYear,
              [year]: standings
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Final Polls Entry Modal (End of Season Recap) */}
      <FinalPollsModal
        isOpen={showFinalPollsModal}
        onClose={() => setShowFinalPollsModal(false)}
        onSave={async (polls) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.finalPollsByYear || {}
          await updateDynasty(currentDynasty.id, {
            finalPollsByYear: {
              ...existingByYear,
              [year]: polls
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Team Stats Entry Modal (End of Season Recap) */}
      <TeamStatsModal
        isOpen={showTeamStatsModal}
        onClose={() => setShowTeamStatsModal(false)}
        onSave={async (stats) => {
          const year = currentDynasty.currentYear
          const existingByYear = currentDynasty.teamStatsByYear || {}
          await updateDynasty(currentDynasty.id, {
            teamStatsByYear: {
              ...existingByYear,
              [year]: stats
            }
          })
        }}
        currentYear={currentDynasty.currentYear}
        teamName={currentDynasty.teamName}
        teamColors={teamColors}
      />

      {/* Awards Entry Modal (End of Season Recap) */}
      <AwardsModal
        isOpen={showAwardsModal}
        onClose={() => setShowAwardsModal(false)}
        onSave={handleAwardsSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* All-Americans & All-Conference Entry Modal (End of Season Recap) */}
      <AllAmericansModal
        isOpen={showAllAmericansModal}
        onClose={() => setShowAllAmericansModal(false)}
        onSave={handleAllAmericansSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Player Match Confirmation Modal (for potential transfers) */}
      <PlayerMatchConfirmModal
        isOpen={showPlayerMatchConfirm}
        confirmation={playerMatchConfirmation}
        dynastyId={currentDynasty?.id}
        teamColors={teamColors}
        onConfirm={handlePlayerMatchConfirm}
        onCancel={handlePlayerMatchCancel}
      />
    </div>
  )
}
