import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDynasty, getCurrentSchedule, getCurrentRoster, getCurrentPreseasonSetup, getCurrentTeamRatings, getCurrentCoachingStaff, getCurrentGoogleSheet, findCurrentTeamGame, getCurrentTeamGames } from '../../context/DynastyContext'
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
import PlayersLeavingModal from '../../components/PlayersLeavingModal'
import DraftResultsModal from '../../components/DraftResultsModal'
import TransferDestinationsModal from '../../components/TransferDestinationsModal'
import RecruitingCommitmentsModal from '../../components/RecruitingCommitmentsModal'
import PositionChangesModal from '../../components/PositionChangesModal'
import RecruitingClassRankModal from '../../components/RecruitingClassRankModal'
import TrainingResultsModal from '../../components/TrainingResultsModal'
import EncourageTransfersModal from '../../components/EncourageTransfersModal'
import RecruitOverallsModal from '../../components/RecruitOverallsModal'
import TransferRedshirtModal from '../../components/TransferRedshirtModal'
import { getAllBowlGamesList, isBowlInWeek1, isBowlInWeek2 } from '../../services/sheetsService'

// Helper function to normalize player names for consistent lookup
const normalizePlayerName = (name) => {
  if (!name) return ''
  return name.trim().toLowerCase()
}

export default function Dashboard() {
  const { currentDynasty, saveSchedule, saveRoster, saveTeamRatings, saveCoachingStaff, saveConferences, addGame, saveCPUBowlGames, saveCPUConferenceChampionships, updateDynasty, processHonorPlayers, isViewOnly } = useDynasty()
  const { user } = useAuth()
  const { id: dynastyId, shareCode } = useParams()
  const teamColors = useTeamColors(currentDynasty?.teamName)

  // Build path prefix for links based on view mode
  const pathPrefix = isViewOnly ? `/view/${shareCode}` : `/dynasty/${dynastyId}`
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  // Use team-centric helper functions for all team-specific data
  const teamSchedule = getCurrentSchedule(currentDynasty)
  const teamRoster = getCurrentRoster(currentDynasty)
  const teamPreseasonSetup = getCurrentPreseasonSetup(currentDynasty)
  const teamRatings = getCurrentTeamRatings(currentDynasty)
  const teamCoachingStaff = getCurrentCoachingStaff(currentDynasty)
  const teamGoogleSheet = getCurrentGoogleSheet(currentDynasty)

  // Aggregate team stats from box scores for pre-filling the Team Stats sheet
  const aggregatedTeamStats = useMemo(() => {
    if (!currentDynasty?.games) return {}

    const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
    const year = currentDynasty.currentYear

    // Offense stats
    let pointsFor = 0
    let totalOffense = 0
    let rushAttempts = 0
    let rushYards = 0
    let rushTds = 0
    let passAttempts = 0
    let passYards = 0
    let passTds = 0
    let firstDowns = 0

    // Defense stats
    let pointsAgainst = 0
    let defTotalYards = 0
    let defPassYards = 0
    let defRushYards = 0
    let defSacks = 0
    let forcedFumbles = 0
    let defInterceptions = 0

    let gamesWithStats = 0

    currentDynasty.games.forEach(game => {
      // Skip CPU games (have team1/team2 but no userTeam)
      if (!game.userTeam && game.team1 && game.team2) return
      if (parseInt(game.year) !== year) return
      if (game.userTeam !== currentTeamAbbr) return

      // Always count points from game scores
      pointsFor += game.teamScore || 0
      pointsAgainst += game.opponentScore || 0

      if (!game.boxScore) return

      // Determine which side we are on (home or away) based on location
      const isHome = game.location === 'home' || game.location === 'Home'

      // Get our player box score (for defensive stats like sacks, INTs)
      const ourPlayerBoxScore = isHome ? game.boxScore.home : game.boxScore.away

      // Aggregate offense from team stats
      if (game.boxScore.teamStats) {
        const homeAbbr = game.boxScore.teamStats.home?.teamAbbr?.toUpperCase()
        const awayAbbr = game.boxScore.teamStats.away?.teamAbbr?.toUpperCase()

        let ourTeamStats = null
        let oppTeamStats = null

        if (homeAbbr === currentTeamAbbr) {
          ourTeamStats = game.boxScore.teamStats.home
          oppTeamStats = game.boxScore.teamStats.away
        } else if (awayAbbr === currentTeamAbbr) {
          ourTeamStats = game.boxScore.teamStats.away
          oppTeamStats = game.boxScore.teamStats.home
        }

        if (ourTeamStats) {
          gamesWithStats++
          totalOffense += parseFloat(ourTeamStats.totalOffense) || 0
          rushAttempts += parseFloat(ourTeamStats.rushAttempts) || 0
          rushYards += parseFloat(ourTeamStats.rushYards) || 0
          rushTds += parseFloat(ourTeamStats.rushTds) || 0
          passAttempts += parseFloat(ourTeamStats.passAttempts) || 0
          passYards += parseFloat(ourTeamStats.passYards) || 0
          passTds += parseFloat(ourTeamStats.passTds) || 0
          firstDowns += parseFloat(ourTeamStats.firstDowns) || 0
        }

        // Opponent's offense = our defense allowed
        if (oppTeamStats) {
          defTotalYards += parseFloat(oppTeamStats.totalOffense) || 0
          defPassYards += parseFloat(oppTeamStats.passYards) || 0
          defRushYards += parseFloat(oppTeamStats.rushYards) || 0
        }
      }

      // Aggregate defensive player stats (sacks, forced fumbles, interceptions)
      if (ourPlayerBoxScore?.defense && Array.isArray(ourPlayerBoxScore.defense)) {
        ourPlayerBoxScore.defense.forEach(player => {
          defSacks += parseFloat(player.sack) || 0
          forcedFumbles += parseFloat(player.fF) || 0
          defInterceptions += parseFloat(player.iNT) || 0
        })
      }
    })

    // Count total games played (for per-game calculations)
    // Exclude CPU games (have team1/team2 but no userTeam)
    const totalGamesPlayed = currentDynasty.games.filter(game =>
      game.userTeam && // Has userTeam = user game
      parseInt(game.year) === year &&
      game.userTeam === currentTeamAbbr
    ).length

    if (totalGamesPlayed === 0) return {}

    // Calculate rate stats using total games played
    const totalPlays = rushAttempts + passAttempts
    const yardsPerPlay = totalPlays > 0 ? totalOffense / totalPlays : 0
    const passYardsPerGame = totalGamesPlayed > 0 ? passYards / totalGamesPlayed : 0
    const rushYardsPerCarry = rushAttempts > 0 ? rushYards / rushAttempts : 0

    return {
      // Offense
      pointsFor,
      totalOffense,
      yardsPerPlay,
      passYards,
      passYardsPerGame,
      passTds,
      rushYards,
      rushYardsPerCarry,
      rushTds,
      firstDowns,
      // Defense
      pointsAgainst,
      defTotalYards,
      defPassYards,
      defRushYards,
      defSacks,
      forcedFumbles,
      defInterceptions,
      // Meta
      gamesWithStats
    }
  }, [currentDynasty?.games, currentDynasty?.teamName, currentDynasty?.currentYear])

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
  const [showPlayersLeavingModal, setShowPlayersLeavingModal] = useState(false)
  const [showDraftResultsModal, setShowDraftResultsModal] = useState(false)
  const [showTransferDestinationsModal, setShowTransferDestinationsModal] = useState(false)
  const [showRecruitingModal, setShowRecruitingModal] = useState(false)
  const [showPositionChangesModal, setShowPositionChangesModal] = useState(false)
  const [showRecruitingClassRankModal, setShowRecruitingClassRankModal] = useState(false)
  const [showTrainingResultsModal, setShowTrainingResultsModal] = useState(false)
  const [showEncourageTransfersModal, setShowEncourageTransfersModal] = useState(false)
  const [showOffseasonConferencesModal, setShowOffseasonConferencesModal] = useState(false)
  const [showRecruitOverallsModal, setShowRecruitOverallsModal] = useState(false)
  const [showTransferRedshirtModal, setShowTransferRedshirtModal] = useState(false)

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

  // View-only badge component for showing when editing is disabled
  const ViewOnlyBadge = () => (
    <span
      className="px-3 py-1.5 rounded-lg text-xs font-medium"
      style={{ backgroundColor: `${secondaryBgText}15`, color: secondaryBgText, opacity: 0.7 }}
    >
      View Only
    </span>
  )

  // Restore CC state from saved dynasty data (year-specific)
  useEffect(() => {
    const year = currentDynasty?.currentYear
    const ccData = currentDynasty?.conferenceChampionshipDataByYear?.[year]
    if (ccData) {
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
      // Reset when no data for this year
      setCCMadeChampionship(null)
      setCCOpponent('')
      setFiringCoordinators(null)
      setCoordinatorToFire('')
    }
  }, [currentDynasty?.id, currentDynasty?.currentYear, currentDynasty?.conferenceChampionshipDataByYear])

  // Restore bowl eligibility state from saved dynasty data (year-specific)
  useEffect(() => {
    const year = currentDynasty?.currentYear
    const bowlData = currentDynasty?.bowlEligibilityDataByYear?.[year]
    if (bowlData) {
      setBowlEligible(bowlData.eligible ?? null)
      setSelectedBowl(bowlData.bowlGame || '')
      setBowlOpponent(bowlData.opponent || '')
    } else {
      // Reset when no data for this year
      setBowlEligible(null)
      setSelectedBowl('')
      setBowlOpponent('')
    }
  }, [currentDynasty?.id, currentDynasty?.currentYear, currentDynasty?.bowlEligibilityDataByYear])

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
      'GSU': 'Georgia State Panthers',
      'USM': 'Southern Mississippi Golden Eagles',
      // FCS teams
      'FCSE': 'FCS East Judicials',
      'FCSM': 'FCS Midwest Rebels',
      'FCSN': 'FCS Northwest Stallions',
      'FCSW': 'FCS West Titans'
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
    // Save to dynasty using year-specific storage
    const year = currentDynasty.currentYear
    const existingByYear = currentDynasty.conferenceChampionshipDataByYear || {}
    await updateDynasty(currentDynasty.id, {
      conferenceChampionshipDataByYear: {
        ...existingByYear,
        [year]: { ...(existingByYear[year] || {}), madeChampionship }
      }
    })
  }

  // Handle CC opponent selection
  const handleCCOpponentSelect = async (opponent) => {
    setCCOpponent(opponent)
    setCCOpponentSearch('')
    setShowCCOpponentDropdown(false)
    // Save to dynasty using year-specific storage
    const year = currentDynasty.currentYear
    const existingByYear = currentDynasty.conferenceChampionshipDataByYear || {}
    await updateDynasty(currentDynasty.id, {
      conferenceChampionshipDataByYear: {
        ...existingByYear,
        [year]: { ...(existingByYear[year] || {}), opponent }
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
      // Update CC data with game played flag using year-specific storage
      const year = currentDynasty.currentYear
      const existingByYear = currentDynasty.conferenceChampionshipDataByYear || {}
      await updateDynasty(currentDynasty.id, {
        conferenceChampionshipDataByYear: {
          ...existingByYear,
          [year]: { ...(existingByYear[year] || {}), gamePlayed: true }
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
      // Get bowl data from year-specific storage
      const year = currentDynasty.currentYear
      const bowlData = currentDynasty.bowlEligibilityDataByYear?.[year] || {}
      // Get the bowl week from the selected bowl
      const bowlWeek = bowlData.bowlGame
        ? (isBowlInWeek1(bowlData.bowlGame) ? 1 : 2)
        : 1
      // Add the game with special flag for bowl game
      await addGame(currentDynasty.id, {
        ...gameData,
        isBowlGame: true,
        bowlName: bowlData.bowlGame || selectedBowl,
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
      const ccGame = findCurrentTeamGame(currentDynasty,
        g => g.isConferenceChampionship && g.year === currentDynasty.currentYear
      )
      ccComplete = !!ccGame
    }

    if (!ccComplete) return false

    // If HC with at least one coordinator, must make firing selection
    const hasCoordinators = currentDynasty.coachPosition === 'HC' &&
      (teamCoachingStaff?.ocName || teamCoachingStaff?.dcName)
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

    // Save pending firing decision using year-specific storage
    const year = currentDynasty.currentYear
    const existingByYear = currentDynasty.conferenceChampionshipDataByYear || {}
    await updateDynasty(currentDynasty.id, {
      conferenceChampionshipDataByYear: {
        ...existingByYear,
        [year]: { ...(existingByYear[year] || {}), pendingFiring: selection }
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
    // Transform allConference to be grouped by conference
    const transformedData = { ...data }
    if (data.allConference && data.allConference.length > 0) {
      const allConferenceByConference = {}
      data.allConference.forEach(entry => {
        // Determine conference from the player's school
        const conference = getTeamConference(entry.school) || 'Unknown'
        if (!allConferenceByConference[conference]) {
          allConferenceByConference[conference] = []
        }
        allConferenceByConference[conference].push(entry)
      })
      transformedData.allConferenceByConference = allConferenceByConference
      // Keep original allConference for backwards compatibility
    }

    const existingByYear = currentDynasty.allAmericansByYear || {}
    await updateDynasty(currentDynasty.id, {
      allAmericansByYear: {
        ...existingByYear,
        [year]: transformedData
      }
    })
  }

  // Handle players leaving data save (Offseason)
  const handlePlayersLeavingSave = async (playersLeaving) => {
    const year = currentDynasty.currentYear
    const existingByYear = currentDynasty.playersLeavingByYear || {}

    // Map player names to PIDs for tracking
    const playersWithPids = playersLeaving.map(entry => {
      const player = currentDynasty.players?.find(p => p.name === entry.playerName)
      return {
        playerName: entry.playerName,
        pid: player?.pid || null,
        reason: entry.reason
      }
    })

    await updateDynasty(currentDynasty.id, {
      playersLeavingByYear: {
        ...existingByYear,
        [year]: playersWithPids
      }
    })
  }

  // Handle draft results save (Offseason - Recruiting Week 1)
  const handleDraftResultsSave = async (draftResults) => {
    const year = currentDynasty.currentYear
    const existingByYear = currentDynasty.draftResultsByYear || {}

    // Map player names to PIDs and store draft info
    const resultsWithPids = draftResults.map(entry => {
      const player = currentDynasty.players?.find(p => p.name === entry.playerName)
      return {
        playerName: entry.playerName,
        pid: player?.pid || null,
        position: entry.position,
        overall: entry.overall,
        draftRound: entry.draftRound
      }
    })

    await updateDynasty(currentDynasty.id, {
      draftResultsByYear: {
        ...existingByYear,
        [year]: resultsWithPids
      }
    })
  }

  // Handle transfer destinations save (Offseason - Recruiting Week 1)
  const handleTransferDestinationsSave = async (destinations) => {
    const year = currentDynasty.currentYear
    const existingByYear = currentDynasty.transferDestinationsByYear || {}

    // Update player records with their new team
    const updatedPlayers = [...(currentDynasty.players || [])]

    destinations.forEach(dest => {
      const playerIndex = updatedPlayers.findIndex(p =>
        p.name?.toLowerCase().trim() === dest.playerName?.toLowerCase().trim()
      )
      if (playerIndex !== -1) {
        // Update the player's transferredTo field (keeps stats with original team)
        updatedPlayers[playerIndex] = {
          ...updatedPlayers[playerIndex],
          transferredTo: dest.newTeam
        }
      }
    })

    await updateDynasty(currentDynasty.id, {
      transferDestinationsByYear: {
        ...existingByYear,
        [year]: destinations
      },
      players: updatedPlayers
    })
  }

  // Handle recruiting class rank save (National Signing Day)
  const handleRecruitingClassRankSave = async (rank) => {
    const year = currentDynasty.currentYear
    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
    const existingRanks = currentDynasty.recruitingClassRankByTeamYear || {}

    await updateDynasty(currentDynasty.id, {
      recruitingClassRankByTeamYear: {
        ...existingRanks,
        [teamAbbr]: {
          ...(existingRanks[teamAbbr] || {}),
          [year]: rank
        }
      }
    })
  }

  // Handle position changes save (National Signing Day)
  const handlePositionChangesSave = async (changes) => {
    const year = currentDynasty.currentYear
    const existingChangesAll = currentDynasty.positionChangesByYear || {}
    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName

    // Update player positions in the players array for any NEW changes
    const updatedPlayers = [...(currentDynasty.players || [])]
    changes.forEach(change => {
      const playerIndex = updatedPlayers.findIndex(p => p.pid === change.playerId)
      if (playerIndex !== -1) {
        // Only update if the position is different from current
        if (updatedPlayers[playerIndex].position !== change.newPosition) {
          updatedPlayers[playerIndex] = {
            ...updatedPlayers[playerIndex],
            position: change.newPosition,
            archetype: '' // Clear archetype since it's position-specific
          }
        }
      }
    })

    // Store the changes for history (replace entire year's changes)
    const changesRecord = changes.map(c => ({
      pid: c.playerId,
      playerName: c.playerName,
      oldPosition: c.oldPosition,
      newPosition: c.newPosition,
      team: teamAbbr
    }))

    await updateDynasty(currentDynasty.id, {
      players: updatedPlayers,
      positionChangesByYear: {
        ...existingChangesAll,
        [year]: changesRecord // Replace, don't append
      }
    })
  }

  // Handle transfer redshirt status save (National Signing Day)
  const handleTransferRedshirtSave = async (transfers) => {
    const year = currentDynasty.currentYear
    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName

    // Update player classes for those marked as redshirted
    // e.g., Fr -> RS Fr, So -> RS So, Jr -> RS Jr
    const updatedPlayers = [...(currentDynasty.players || [])]
    const classUpgrade = {
      'Fr': 'RS Fr',
      'So': 'RS So',
      'Jr': 'RS Jr',
      'Sr': 'RS Sr'
    }

    let updatedCount = 0
    transfers.forEach(transfer => {
      if (!transfer.wasRedshirted) return // Skip if not redshirted

      // Find player by name (case-insensitive match) and team
      const playerIndex = updatedPlayers.findIndex(p =>
        normalizePlayerName(p.name) === normalizePlayerName(transfer.playerName) &&
        p.team === teamAbbr &&
        p.isPortal // Only update portal transfers
      )

      if (playerIndex !== -1) {
        const player = updatedPlayers[playerIndex]
        const currentClass = player.year
        // Only upgrade if current class is non-RS
        if (classUpgrade[currentClass]) {
          updatedPlayers[playerIndex] = {
            ...player,
            year: classUpgrade[currentClass]
          }
          updatedCount++
        }
      }
    })

    // Store the transfer redshirt data for this year (team-centric)
    const existingByTeamYear = currentDynasty.transferRedshirtByTeamYear || {}
    const existingForTeam = existingByTeamYear[teamAbbr] || {}

    await updateDynasty(currentDynasty.id, {
      players: updatedPlayers,
      transferRedshirtByTeamYear: {
        ...existingByTeamYear,
        [teamAbbr]: {
          ...existingForTeam,
          [year]: transfers.filter(t => t.wasRedshirted).map(t => t.playerName)
        }
      }
    })
  }

  // Handle training results save (Offseason Week 6)
  const handleTrainingResultsSave = async (results) => {
    const year = currentDynasty.currentYear

    // Update player overalls in the players array
    const updatedPlayers = [...(currentDynasty.players || [])]
    let updatedCount = 0

    results.forEach(result => {
      // Find player by name (case-insensitive match)
      const playerIndex = updatedPlayers.findIndex(p =>
        normalizePlayerName(p.name) === normalizePlayerName(result.playerName)
      )
      if (playerIndex !== -1 && result.newOverall) {
        updatedPlayers[playerIndex] = {
          ...updatedPlayers[playerIndex],
          overall: result.newOverall
        }
        updatedCount++
      }
    })

    // Store training results for history
    const existingResults = currentDynasty.trainingResultsByYear || {}

    await updateDynasty(currentDynasty.id, {
      players: updatedPlayers,
      trainingResultsByYear: {
        ...existingResults,
        [year]: results
      }
    })

    console.log(`Updated ${updatedCount} player overalls from training results`)
  }

  // Handle recruiting class overalls save
  const handleRecruitOverallsSave = async (results) => {
    const year = currentDynasty.currentYear

    // Update recruit overalls and jersey numbers in the players array
    const updatedPlayers = [...(currentDynasty.players || [])]
    let updatedCount = 0

    results.forEach(result => {
      // Find player by name (case-insensitive match) among recruits
      const playerIndex = updatedPlayers.findIndex(p =>
        p.isRecruit &&
        p.recruitYear === year &&
        normalizePlayerName(p.name) === normalizePlayerName(result.name)
      )
      if (playerIndex !== -1 && result.overall) {
        updatedPlayers[playerIndex] = {
          ...updatedPlayers[playerIndex],
          overall: result.overall,
          ...(result.jerseyNumber && { jerseyNumber: result.jerseyNumber })
        }
        updatedCount++
      }
    })

    // Store recruit overalls for history
    const existingResults = currentDynasty.recruitOverallsByYear || {}

    await updateDynasty(currentDynasty.id, {
      players: updatedPlayers,
      recruitOverallsByYear: {
        ...existingResults,
        [year]: results
      }
    })

    console.log(`Updated ${updatedCount} recruit overalls`)
  }

  // Get the commitment key based on phase and week
  const getCommitmentKey = () => {
    const phase = currentDynasty.currentPhase
    const week = currentDynasty.currentWeek

    if (phase === 'preseason') {
      return 'preseason'
    } else if (phase === 'regular_season') {
      return `regular_${week}`
    } else if (phase === 'conference_championship') {
      return 'conf_champ'
    } else if (phase === 'postseason') {
      // Postseason weeks 1-4 = Bowl weeks 1-4
      return `bowl_${week}`
    } else if (phase === 'offseason' && week >= 2 && week <= 5) {
      return `signing_${week - 1}` // Week 2 = Recruiting Week 1, etc.
    }
    return null
  }

  // Handle recruiting commitments save - TEAM-CENTRIC
  const handleRecruitingCommitmentsSave = async (recruits) => {
    const year = currentDynasty.currentYear
    const commitmentKey = getCommitmentKey()
    if (!commitmentKey) return

    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName

    // Use TEAM-CENTRIC structure: recruitingCommitmentsByTeamYear[teamAbbr][year][commitmentKey]
    const existingByTeamYear = currentDynasty.recruitingCommitmentsByTeamYear || {}
    const existingForTeam = existingByTeamYear[teamAbbr] || {}
    const existingForYear = existingForTeam[year] || {}

    // Get existing players and recruits to find max PID
    const existingPlayers = currentDynasty.players || []
    const maxExistingPID = existingPlayers.reduce((max, p) => Math.max(max, p.pid || 0), 0)
    let nextPID = Math.max(maxExistingPID + 1, currentDynasty.nextPID || 1)

    // BULLETPROOF: Collect ALL existing player names (not just recruits) to prevent ANY duplicates
    const existingPlayerNames = new Set()
    existingPlayers.forEach(p => {
      if (p.name) existingPlayerNames.add(p.name.toLowerCase().trim())
    })

    // Track players who left (leftTeam: true) - they can "return" via portal
    const leftPlayersMap = new Map()
    existingPlayers.forEach(p => {
      if (p.name && p.leftTeam) {
        leftPlayersMap.set(p.name.toLowerCase().trim(), p)
      }
    })

    // Get existing recruits from OTHER weeks (not the current commitment key) to avoid duplicating
    const commitmentsForTeamYear = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[year] || {}
    const existingRecruitNames = new Set()

    // Only collect names from OTHER commitment keys (not the current one being saved)
    Object.entries(commitmentsForTeamYear).forEach(([key, weekCommitments]) => {
      if (key !== commitmentKey && Array.isArray(weekCommitments)) {
        weekCommitments.forEach(r => {
          if (r.name) existingRecruitNames.add(r.name.toLowerCase().trim())
        })
      }
    })

    // Find recruits that are RETURNING players (they left but are coming back via portal)
    const returningPlayerRecruits = recruits.filter(r => {
      if (!r.name) return false
      const nameLower = r.name.toLowerCase().trim()
      // Must be a portal transfer AND match a player who left
      return r.isPortal && leftPlayersMap.has(nameLower)
    })

    // Find NEW recruits - MUST pass ALL checks:
    // 1. Not already in the players array (prevents duplicating existing roster) - UNLESS they left
    // 2. Not already in OTHER weeks' commitments (prevents cross-week duplicates)
    const newRecruits = recruits.filter(r => {
      if (!r.name) return false
      const nameLower = r.name.toLowerCase().trim()
      // Skip if this is a returning player (handled separately)
      if (r.isPortal && leftPlayersMap.has(nameLower)) return false
      // Reject if already exists as an ACTIVE player (not one who left)
      if (existingPlayerNames.has(nameLower) && !leftPlayersMap.has(nameLower)) return false
      // Reject if already in other weeks' commitments
      if (existingRecruitNames.has(nameLower)) return false
      return true
    })

    // Create player entries for new recruits
    const newPlayers = newRecruits.map(recruit => {
      const pid = nextPID++

      // Convert recruit class to player year (they'll be this class when they enroll)
      const classToYear = {
        'HS': 'Fr',
        'JUCO Fr': 'So',      // JUCO freshmen enter as sophomores
        'JUCO So': 'Jr',      // JUCO sophomores enter as juniors
        'JUCO Jr': 'Sr',      // JUCO juniors enter as seniors
        'Fr': 'Fr',
        'RS Fr': 'RS Fr',
        'So': 'So',
        'RS So': 'RS So',
        'Jr': 'Jr',
        'RS Jr': 'RS Jr',
        'Sr': 'Sr',
        'RS Sr': 'RS Sr'
      }

      return {
        pid,
        id: `player-${pid}`,
        name: recruit.name,
        position: recruit.position || '',
        year: classToYear[recruit.class] || 'Fr',
        jerseyNumber: '',
        devTrait: recruit.devTrait || 'Normal',
        archetype: recruit.archetype || '',
        overall: null, // Recruits don't have OVR until they enroll
        height: recruit.height || '',
        weight: recruit.weight || 0,
        hometown: recruit.hometown || '',
        state: recruit.state || '',
        team: teamAbbr, // CRITICAL: Tag player with team
        isRecruit: true,
        recruitYear: year, // The recruiting class year (they play NEXT year)
        // IMMUTABLE roster history - recruits will be on team starting NEXT year
        teamsByYear: { [year + 1]: teamAbbr },
        stars: recruit.stars || 0,
        nationalRank: recruit.nationalRank || null,
        stateRank: recruit.stateRank || null,
        positionRank: recruit.positionRank || null,
        gemBust: recruit.gemBust || '',
        previousTeam: recruit.previousTeam || '',
        isPortal: recruit.isPortal || false // Track if transfer portal player
      }
    })

    // Update returning players - players who left but are coming back via portal
    // This clears their leftTeam flag and updates their team assignment
    let playersWithReturning = existingPlayers
    if (returningPlayerRecruits.length > 0) {
      const returningNames = new Set(returningPlayerRecruits.map(r => r.name.toLowerCase().trim()))
      playersWithReturning = existingPlayers.map(p => {
        if (p.name && returningNames.has(p.name.toLowerCase().trim())) {
          // Find the matching recruit data to get updated info
          const recruitData = returningPlayerRecruits.find(
            r => r.name.toLowerCase().trim() === p.name.toLowerCase().trim()
          )
          return {
            ...p,
            leftTeam: false, // Clear the left flag - they're back!
            team: teamAbbr, // Update team assignment
            teamsByYear: {
              ...p.teamsByYear,
              [year + 1]: teamAbbr // Add them to next year's roster
            },
            isRecruit: true, // Mark as recruit until season starts
            recruitYear: year,
            isPortal: true,
            // Update any new info from the recruit entry
            ...(recruitData?.position && { position: recruitData.position }),
            ...(recruitData?.devTrait && { devTrait: recruitData.devTrait }),
            ...(recruitData?.stars && { stars: recruitData.stars })
          }
        }
        return p
      })
      console.log(`[Recruiting] ${returningPlayerRecruits.length} player(s) returning via portal:`,
        returningPlayerRecruits.map(r => r.name).join(', '))
    }

    // Store recruits for this phase/week AND add new players
    const updatedPlayers = [...playersWithReturning, ...newPlayers]

    // Save if there are new recruits OR returning players for this week
    const allCommittedRecruits = [...newRecruits, ...returningPlayerRecruits]
    if (allCommittedRecruits.length > 0) {
      // Store in TEAM-CENTRIC structure - store all commits for this commitment key
      await updateDynasty(currentDynasty.id, {
        recruitingCommitmentsByTeamYear: {
          ...existingByTeamYear,
          [teamAbbr]: {
            ...existingForTeam,
            [year]: {
              ...existingForYear,
              [commitmentKey]: allCommittedRecruits
            }
          }
        },
        players: updatedPlayers,
        nextPID: nextPID
      })
    }
  }

  // Handle marking no commitments for the week - TEAM-CENTRIC
  const handleNoCommitments = async () => {
    const year = currentDynasty.currentYear
    const commitmentKey = getCommitmentKey()
    if (!commitmentKey) return

    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName

    // Use TEAM-CENTRIC structure
    const existingByTeamYear = currentDynasty.recruitingCommitmentsByTeamYear || {}
    const existingForTeam = existingByTeamYear[teamAbbr] || {}
    const existingForYear = existingForTeam[year] || {}

    // Store empty array to mark as completed
    await updateDynasty(currentDynasty.id, {
      recruitingCommitmentsByTeamYear: {
        ...existingByTeamYear,
        [teamAbbr]: {
          ...existingForTeam,
          [year]: {
            ...existingForYear,
            [commitmentKey]: []
          }
        }
      }
    })
  }

  // Get all previous commitments for the current team/year (to pre-populate sheet) - TEAM-CENTRIC
  const getAllPreviousCommitments = () => {
    const year = currentDynasty.currentYear
    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName

    // Use TEAM-CENTRIC structure
    const commitmentsForTeamYear = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[year] || {}
    const allCommitments = []

    // Collect all commitments from all weeks/phases
    Object.values(commitmentsForTeamYear).forEach(weekCommitments => {
      if (Array.isArray(weekCommitments)) {
        allCommitments.push(...weekCommitments)
      }
    })

    return allCommitments
  }

  // Get the display label for recruiting modal
  const getRecruitingLabel = () => {
    const phase = currentDynasty.currentPhase
    const week = currentDynasty.currentWeek

    if (phase === 'preseason') {
      return 'Preseason'
    } else if (phase === 'regular_season') {
      return `Week ${week}`
    } else if (phase === 'conference_championship') {
      return 'Conference Championship Week'
    } else if (phase === 'postseason') {
      if (week === 4) return 'National Championship Week'
      if (week === 5) return 'End of Season'
      return `Bowl Week ${week}`
    } else if (phase === 'offseason' && week >= 2 && week <= 5) {
      if (week === 5) return 'National Signing Day'
      return `Recruiting Week ${week - 1}`
    }
    return 'Recruiting'
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
          // Transform allConference to be grouped by conference
          const transformedData = { ...rawData }
          if (rawData.allConference && rawData.allConference.length > 0) {
            const allConferenceByConference = {}
            rawData.allConference.forEach(entry => {
              const conference = getTeamConference(entry.school) || 'Unknown'
              if (!allConferenceByConference[conference]) {
                allConferenceByConference[conference] = []
              }
              allConferenceByConference[conference].push(entry)
            })
            transformedData.allConferenceByConference = allConferenceByConference
          }

          const existingByYear = currentDynasty.allAmericansByYear || {}
          await updateDynasty(currentDynasty.id, {
            allAmericansByYear: {
              ...existingByYear,
              [year]: transformedData
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
    return findCurrentTeamGame(currentDynasty,
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
    // Use team-centric preseason setup
    const baseRequirements =
      teamPreseasonSetup?.scheduleEntered &&
      teamPreseasonSetup?.rosterEntered &&
      teamPreseasonSetup?.teamRatingsEntered

    // Coaching staff only required in first year of dynasty or first year on new team
    // After that, coordinators are managed through offseason firing/hiring flow
    const isFirstYear = Number(currentDynasty.currentYear) === Number(currentDynasty.startYear)
    const isFirstYearOnTeam = currentDynasty.isFirstYearOnCurrentTeam
    if (currentDynasty.coachPosition === 'HC' && (isFirstYear || isFirstYearOnTeam)) {
      return baseRequirements && teamPreseasonSetup?.coachingStaffEntered
    }

    return baseRequirements
  }

  const getPhaseDisplay = (phase, week) => {
    if (phase === 'postseason') {
      if (week === 5) return 'End of Season Recap'
      return week === 4 ? 'National Championship' : `Bowl Week ${week}`
    }
    if (phase === 'offseason') {
      if (week === 1) return 'Players Leaving'
      if (week === 5) return 'National Signing Day'
      if (week === 6) return 'Training Camp'
      if (week === 7) return 'Offseason'
      if (week >= 2 && week <= 4) return `Recruiting Week ${week - 1} of 4`
      return 'Off-Season'
    }
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      offseason: 'Off-Season'
    }
    return phases[phase] || phase
  }

  // Get user games for current year (games with userTeam set, not CPU games)
  const currentYearGames = (currentDynasty.games || [])
    .filter(g => Number(g.year) === Number(currentDynasty.currentYear) && g.userTeam)
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
              to={`${pathPrefix}/team/${getAbbreviationFromDisplayName(currentDynasty.teamName)}/${currentDynasty.currentYear}`}
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
            {teamRatings && (
              <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start">
                <div className="text-center px-2 sm:px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>OVR</div>
                  <div className="text-sm sm:text-lg font-bold" style={{ color: secondaryBgText }}>{teamRatings.overall}</div>
                </div>
                <div className="text-center px-2 sm:px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>OFF</div>
                  <div className="text-sm sm:text-lg font-bold" style={{ color: secondaryBgText }}>{teamRatings.offense}</div>
                </div>
                <div className="text-center px-2 sm:px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>DEF</div>
                  <div className="text-sm sm:text-lg font-bold" style={{ color: secondaryBgText }}>{teamRatings.defense}</div>
                </div>
                {!isViewOnly && (
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
                )}

                {/* Coaching Staff Popup (HC only) */}
                {!isViewOnly && currentDynasty.coachPosition === 'HC' && teamCoachingStaff && (
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
                              const ocName = teamCoachingStaff?.ocName
                              const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                              const firedOCName = ccDataForYear.firedOCName
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
                              const dcName = teamCoachingStaff?.dcName
                              const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                              const firedDCName = ccDataForYear.firedDCName
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
                            {!teamCoachingStaff?.ocName && !teamCoachingStaff?.dcName && (() => {
                              const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                              return !ccDataForYear.firedOCName && !ccDataForYear.firedDCName
                            })() && (
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
                done: teamPreseasonSetup?.scheduleEntered,
                scheduleCount: teamSchedule?.length || 0,
                action: () => setShowScheduleModal(true),
                actionText: teamPreseasonSetup?.scheduleEntered ? 'Edit' : 'Enter'
              },
              // Only show roster entry in first year of dynasty OR if user switched teams
              ...((Number(currentDynasty.currentYear) === Number(currentDynasty.startYear) || currentDynasty.isFirstYearOnCurrentTeam) ? [{
                num: 2,
                title: 'Enter Roster',
                done: teamPreseasonSetup?.rosterEntered,
                playerCount: teamRoster.length,
                action: () => setShowRosterModal(true),
                actionText: teamPreseasonSetup?.rosterEntered ? 'Edit' : 'Enter'
              }] : []),
              {
                num: (Number(currentDynasty.currentYear) === Number(currentDynasty.startYear) || currentDynasty.isFirstYearOnCurrentTeam) ? 3 : 2,
                title: 'Enter Team Ratings',
                done: teamPreseasonSetup?.teamRatingsEntered,
                teamRatings: teamRatings,
                action: () => setShowTeamRatingsModal(true),
                actionText: teamPreseasonSetup?.teamRatingsEntered ? 'Edit' : 'Add Ratings'
              },
              // Only show Custom Conferences in first year of dynasty (not in subsequent years)
              ...(() => {
                const isFirstYear = Number(currentDynasty.currentYear) === Number(currentDynasty.startYear)
                const hasRoster = isFirstYear || currentDynasty.isFirstYearOnCurrentTeam
                if (!isFirstYear) return []
                return [{
                  num: hasRoster ? 4 : 3,
                  title: 'Custom Conferences',
                  done: teamPreseasonSetup?.conferencesEntered,
                  conferences: currentDynasty.customConferences,
                  action: () => setShowConferencesModal(true),
                  actionText: teamPreseasonSetup?.conferencesEntered ? 'Edit' : 'Set Up'
                }]
              })(),
              // Only show coaching staff task for Head Coaches in first year of dynasty
              // (or first year on a new team). After that, coordinators are managed
              // through offseason firing/hiring flow and carry over automatically.
              ...(() => {
                if (currentDynasty.coachPosition !== 'HC') return []
                const isFirstYear = Number(currentDynasty.currentYear) === Number(currentDynasty.startYear)
                const isFirstYearOnTeam = currentDynasty.isFirstYearOnCurrentTeam
                // Only show in first year of dynasty or first year on a new team
                if (!isFirstYear && !isFirstYearOnTeam) return []
                const hasRoster = isFirstYear || isFirstYearOnTeam
                // Calculate task number based on what's shown before it
                let num = 2 // After schedule
                if (hasRoster) num++ // After roster
                num++ // After team ratings
                if (isFirstYear) num++ // After custom conferences
                return [{
                  num,
                  title: 'Enter Coordinators',
                  done: teamPreseasonSetup?.coachingStaffEntered,
                  coachingStaff: teamCoachingStaff,
                  action: () => setShowCoachingStaffModal(true),
                  actionText: teamPreseasonSetup?.coachingStaffEntered ? 'Edit' : 'Add Staff'
                }]
              })(),
              // Optional: Recruiting Commitments - TEAM-CENTRIC
              (() => {
                const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
                const preseasonCommitments = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear]?.['preseason']
                const isFirstYear = Number(currentDynasty.currentYear) === Number(currentDynasty.startYear)
                const isFirstYearOnTeam = currentDynasty.isFirstYearOnCurrentTeam
                const hasRoster = isFirstYear || isFirstYearOnTeam
                // Calculate task number
                let num = 2 // After schedule
                if (hasRoster) num++ // After roster
                num++ // After team ratings
                if (isFirstYear) num++ // After custom conferences
                // Only add coordinator increment if coordinators task is shown (HC + first year or first year on team)
                if (currentDynasty.coachPosition === 'HC' && (isFirstYear || isFirstYearOnTeam)) num++ // After coordinators
                return {
                  num,
                  title: 'Any commitments this week?',
                  isRecruiting: true,
                  done: preseasonCommitments !== undefined,
                  commitmentsCount: preseasonCommitments?.length || 0,
                  action: () => setShowRecruitingModal(true),
                  actionText: preseasonCommitments !== undefined ? 'Edit' : 'Yes',
                  optional: true
                }
              })()
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
                    {item.isRecruiting && (
                      <div
                        className="text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.done
                          ? item.commitmentsCount > 0
                            ? `✓ ${item.commitmentsCount} commitment${item.commitmentsCount !== 1 ? 's' : ''} recorded`
                            : '✓ No commitments this week'
                          : 'Record any early recruiting commitments'}
                      </div>
                    )}
                  </div>
                </div>
                {isViewOnly ? <ViewOnlyBadge /> : (
                  item.isRecruiting && !item.done ? (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleNoCommitments}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                        style={{
                          backgroundColor: teamColors.primary,
                          color: primaryBgText
                        }}
                      >
                        No
                      </button>
                      <button
                        onClick={item.action}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                        style={{
                          backgroundColor: teamColors.primary,
                          color: primaryBgText
                        }}
                      >
                        Yes
                      </button>
                    </div>
                  ) : (
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
                  )
                )}
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
            {currentDynasty.currentYear} Regular Season - Week {currentDynasty.currentWeek}
          </h3>
          <div className="space-y-3">
            {(() => {
              const scheduledGame = teamSchedule?.find(g => Number(g.week) === Number(currentDynasty.currentWeek))
              const playedGame = findCurrentTeamGame(currentDynasty,
                g => Number(g.week) === Number(currentDynasty.currentWeek) && Number(g.year) === Number(currentDynasty.currentYear)
              )
              const mascotName = scheduledGame ? getMascotName(scheduledGame.opponent) : null
              const opponentName = mascotName || (scheduledGame ? getTeamNameFromAbbr(scheduledGame.opponent) : 'TBD')

              // Check for recruiting commitments this week - TEAM-CENTRIC
              const commitmentKey = `regular_${currentDynasty.currentWeek}`
              const teamAbbrForCommitments = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
              const commitmentsForTeamYear = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbrForCommitments]?.[currentDynasty.currentYear] || {}
              const commitmentsForWeek = commitmentsForTeamYear[commitmentKey]
              const hasCommitmentsData = commitmentsForWeek !== undefined
              const commitmentsCount = commitmentsForWeek?.length || 0

              return (
                <>
                  {/* Task 1: Game Entry */}
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
                          <span className="font-bold text-lg">1</span>
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
                    {isViewOnly ? <ViewOnlyBadge /> : (
                      <button
                        onClick={() => {
                          setEditingGame(playedGame)
                          setShowGameModal(true)
                        }}
                        className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                        style={{
                          backgroundColor: teamColors.primary,
                          color: primaryBgText
                        }}
                      >
                        {playedGame ? 'Edit' : 'Enter Game'}
                      </button>
                    )}
                  </div>

                  {/* Task 2: Recruiting Commitments */}
                  <div
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                      hasCommitmentsData ? 'border-green-200 bg-green-50' : ''
                    }`}
                    style={!hasCommitmentsData ? { borderColor: `${teamColors.primary}30` } : {}}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          hasCommitmentsData ? 'bg-green-500 text-white' : ''
                        }`}
                        style={!hasCommitmentsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                      >
                        {hasCommitmentsData ? (
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : <span className="font-bold text-sm sm:text-base">2</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-semibold" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText }}>
                          {hasCommitmentsData ? 'Recruiting Commitments' : 'Any commitments this week?'}
                        </div>
                        <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                          {hasCommitmentsData
                            ? commitmentsCount > 0
                              ? `✓ ${commitmentsCount} commitment${commitmentsCount !== 1 ? 's' : ''} recorded`
                              : '✓ No commitments this week'
                            : 'Record any recruiting commitments for this week'}
                        </div>
                      </div>
                    </div>
                    {isViewOnly ? <ViewOnlyBadge /> : (
                      !hasCommitmentsData ? (
                        <div className="flex gap-2 self-end sm:self-auto">
                          <button
                            onClick={handleNoCommitments}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            No
                          </button>
                          <button
                            onClick={() => setShowRecruitingModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            Yes
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRecruitingModal(true)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          Edit
                        </button>
                      )
                    )}
                  </div>
                </>
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
              (teamCoachingStaff?.ocName || teamCoachingStaff?.dcName)
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
                    ) : isViewOnly ? (
                      <ViewOnlyBadge />
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
                          const year = currentDynasty.currentYear
                          const existingByYear = currentDynasty.conferenceChampionshipDataByYear || {}
                          const currentCCData = existingByYear[year] || {}
                          await updateDynasty(currentDynasty.id, {
                            conferenceChampionshipDataByYear: {
                              ...existingByYear,
                              [year]: { ...currentCCData, madeChampionship: null, opponent: null }
                            }
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
                            coordinatorToFire === 'oc' ? `Firing ${teamCoachingStaff?.ocName} (OC)` :
                            coordinatorToFire === 'dc' ? `Firing ${teamCoachingStaff?.dcName} (DC)` :
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
                      {teamCoachingStaff?.ocName && (
                        <option value="oc">Fire {teamCoachingStaff.ocName} (OC)</option>
                      )}
                      {teamCoachingStaff?.dcName && (
                        <option value="dc">Fire {teamCoachingStaff.dcName} (DC)</option>
                      )}
                      {teamCoachingStaff?.ocName && teamCoachingStaff?.dcName && (
                        <option value="both">Fire Both</option>
                      )}
                    </select>
                  </div>
                )}

                {/* Task 3: Recruiting Commitments */}
                {(() => {
                  const commitmentKey = getCommitmentKey()
                  const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
                  const ccCommitments = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear]?.[commitmentKey]
                  const hasCommitmentsData = ccCommitments !== undefined
                  const commitmentsCount = ccCommitments?.length || 0
                  const taskNum = hasCoordinators ? 3 : 2

                  return (
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasCommitmentsData ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasCommitmentsData ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                            hasCommitmentsData ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasCommitmentsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasCommitmentsData ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : taskNum}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText }}>
                            {hasCommitmentsData ? 'Recruiting Commitments' : 'Any commitments this week?'}
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasCommitmentsData
                              ? commitmentsCount > 0
                                ? `✓ ${commitmentsCount} commitment${commitmentsCount !== 1 ? 's' : ''} recorded`
                                : '✓ No commitments this week'
                              : 'Record any recruiting commitments'}
                          </div>
                        </div>
                      </div>
                      {isViewOnly ? <ViewOnlyBadge /> : (
                        !hasCommitmentsData ? (
                          <div className="flex gap-2 self-end sm:self-auto">
                            <button
                              onClick={handleNoCommitments}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              No
                            </button>
                            <button
                              onClick={() => setShowRecruitingModal(true)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Yes
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowRecruitingModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            Edit
                          </button>
                        )
                      )}
                    </div>
                  )
                })()}
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
            const currentYear = currentDynasty.currentYear
            // Read from year-specific storage to prevent data carrying over between seasons
            const ccGames = currentDynasty.conferenceChampionshipsByYear?.[currentYear] || []
            const hasCCData = ccGames.length > 0
            // Count entered CC games (games with both scores)
            const ccGamesWithScores = ccGames.filter(g => g && g.team1Score !== undefined && g.team1Score !== null && g.team2Score !== undefined && g.team2Score !== null).length
            // Read conference championship data from year-specific storage
            const ccData = currentDynasty.conferenceChampionshipDataByYear?.[currentYear] || {}
            const totalCCGames = ccData.madeChampionship === true ? 9 : 10

            const hasCFPSeedsData = currentDynasty.cfpSeedsByYear?.[currentDynasty.currentYear]?.length > 0
            const hasCFPFirstRoundData = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.firstRound?.length > 0
            const hasBowlWeek1Data = currentDynasty.bowlGamesByYear?.[currentDynasty.currentYear]?.week1?.length > 0
            // Bowl Week 2 sheet saves regular bowl games to week2 - check only this
            // (User's QF game from game modal goes to cfpResultsByYear.quarterfinals but that's separate)
            const hasBowlWeek2Data = currentDynasty.bowlGamesByYear?.[currentDynasty.currentYear]?.week2?.length > 0

            // Count entered games for Week 1 (26 regular bowls + 4 CFP First Round = 30 total)
            const bowlWeek1Games = currentDynasty.bowlGamesByYear?.[currentDynasty.currentYear]?.week1 || []
            const cfpFirstRoundGames = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.firstRound || []
            const enteredBowlWeek1 = bowlWeek1Games.filter(g => g && g.team1Score !== undefined && g.team1Score !== null && g.team2Score !== undefined && g.team2Score !== null).length
            const enteredCFPFirstRound = cfpFirstRoundGames.filter(g => g && g.team1Score !== undefined && g.team1Score !== null && g.team2Score !== undefined && g.team2Score !== null).length
            const totalEnteredWeek1 = enteredBowlWeek1 + enteredCFPFirstRound

            // Count entered games for Week 2 (8 regular bowls + 4 CFP Quarterfinals = 12 total)
            const bowlWeek2Games = currentDynasty.bowlGamesByYear?.[currentDynasty.currentYear]?.week2 || []
            const cfpQuarterfinalGames = currentDynasty.cfpResultsByYear?.[currentDynasty.currentYear]?.quarterfinals || []
            const enteredBowlWeek2 = bowlWeek2Games.filter(g => g && g.team1Score !== undefined && g.team1Score !== null && g.team2Score !== undefined && g.team2Score !== null).length
            const enteredCFPQuarterfinals = cfpQuarterfinalGames.filter(g => g && g.team1Score !== undefined && g.team1Score !== null && g.team2Score !== undefined && g.team2Score !== null).length
            const totalEnteredWeek2 = enteredBowlWeek2 + enteredCFPQuarterfinals
            const userBowlGame = findCurrentTeamGame(currentDynasty, g => g.isBowlGame && g.year === currentDynasty.currentYear)
            const userCFPFirstRoundGame = findCurrentTeamGame(currentDynasty, g => g.isCFPFirstRound && g.year === currentDynasty.currentYear)
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
            const userCFPQuarterfinalGame = findCurrentTeamGame(currentDynasty, g => g.isCFPQuarterfinal && g.year === currentDynasty.currentYear)
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
            const userCFPSemifinalGame = findCurrentTeamGame(currentDynasty, g => g.isCFPSemifinal && g.year === currentDynasty.currentYear)
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
            const userCFPChampionshipGame = findCurrentTeamGame(currentDynasty, g => g.isCFPChampionship && g.year === currentDynasty.currentYear)
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
                            {ccGamesWithScores === totalCCGames ? `✓ All ${totalCCGames} games entered` : `${ccGamesWithScores}/${totalCCGames} games entered`}
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
                      // Edit button only shows when CFP seeds are entered AND bowl eligibility has been answered
                      const showBowlEditButton = hasCFPSeedsData && !userCFPSeed && bowlEligible !== null && (bowlEligible === false || (bowlEligible && selectedBowl && bowlOpponent))

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
                                {hasCFPSeedsData && !userCFPSeed && bowlEligible === false && (
                                  <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.9 }}>
                                    ✓ Not bowl eligible this year
                                  </div>
                                )}
                                {hasCFPSeedsData && !userCFPSeed && bowlEligible && selectedBowl && bowlOpponent && (
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
                                  // Remove any existing bowl game from games array (team-centric)
                                  const existingBowlGame = findCurrentTeamGame(currentDynasty, g => g.isBowlGame && g.year === currentDynasty.currentYear)
                                  const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
                                  const updatedGames = existingBowlGame
                                    ? currentDynasty.games.filter(g => !(g.isBowlGame && g.year === currentDynasty.currentYear && (g.userTeam === currentTeamAbbr || !g.userTeam)))
                                    : currentDynasty.games
                                  // Clear year-specific bowl eligibility data
                                  const existingByYear = currentDynasty.bowlEligibilityDataByYear || {}
                                  const { [currentYear]: _, ...restByYear } = existingByYear
                                  await updateDynasty(currentDynasty.id, {
                                    bowlEligibilityDataByYear: restByYear,
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
                                    const existingByYear = currentDynasty.bowlEligibilityDataByYear || {}
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityDataByYear: {
                                        ...existingByYear,
                                        [currentYear]: { eligible: true, bowlGame: '', opponent: '' }
                                      }
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
                                    const existingByYear = currentDynasty.bowlEligibilityDataByYear || {}
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityDataByYear: {
                                        ...existingByYear,
                                        [currentYear]: { eligible: false, bowlGame: null, opponent: null }
                                      }
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
                                    const existingByYear = currentDynasty.bowlEligibilityDataByYear || {}
                                    const currentBowlData = existingByYear[currentYear] || {}
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityDataByYear: {
                                        ...existingByYear,
                                        [currentYear]: { ...currentBowlData, eligible: true, bowlGame: bowl }
                                      }
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
                                    const existingByYear = currentDynasty.bowlEligibilityDataByYear || {}
                                    const currentBowlData = existingByYear[currentYear] || {}
                                    await updateDynasty(currentDynasty.id, {
                                      bowlEligibilityDataByYear: {
                                        ...existingByYear,
                                        [currentYear]: { ...currentBowlData, opponent: value }
                                      }
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
                            setEditingGame(userCFPFirstRoundGame)
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

                    {/* Task: Recruiting Commitments (Bowl Week 1) */}
                    {(() => {
                      const commitmentKey = getCommitmentKey()
                      const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
                      const weekCommitments = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear]?.[commitmentKey]
                      const hasCommitmentsData = weekCommitments !== undefined
                      const commitmentsCount = weekCommitments?.length || 0
                      // Task number: after Taking a New Job (which is task 5)
                      const taskNum = 6

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasCommitmentsData ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasCommitmentsData ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                                hasCommitmentsData ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasCommitmentsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasCommitmentsData ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : taskNum}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText }}>
                                {hasCommitmentsData ? 'Recruiting Commitments' : 'Any commitments this week?'}
                              </div>
                              <div className="text-xs sm:text-sm mt-0.5" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                {hasCommitmentsData
                                  ? commitmentsCount > 0
                                    ? `✓ ${commitmentsCount} commitment${commitmentsCount !== 1 ? 's' : ''} recorded`
                                    : '✓ No commitments this week'
                                  : 'Record any recruiting commitments'}
                              </div>
                            </div>
                          </div>
                          {!hasCommitmentsData ? (
                            <div className="flex gap-2 self-end sm:self-auto">
                              <button
                                onClick={handleNoCommitments}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                No
                              </button>
                              <button
                                onClick={() => setShowRecruitingModal(true)}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Yes
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowRecruitingModal(true)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )
                    })()}

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
                            {totalEnteredWeek1 === 30 ? '✓ All 30 games entered' : `${totalEnteredWeek1}/30 games entered (incl. CFP First Round)`}
                          </div>
                        </div>
                      </div>
                      {isViewOnly ? <ViewOnlyBadge /> : (
                        <button
                          onClick={() => setShowBowlWeek1Modal(true)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          {hasBowlWeek1Data ? 'Edit' : 'Enter'}
                        </button>
                      )}
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
                        {isViewOnly ? <ViewOnlyBadge /> : (
                          <button
                            onClick={() => setShowBowlGameModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {userBowlGame ? 'Edit' : 'Enter'}
                          </button>
                        )}
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
                            setEditingGame(userCFPQuarterfinalGame)
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
                    {currentDynasty.coachPosition === 'HC' && (() => {
                      const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                      return ccDataForYear.firedOCName || ccDataForYear.firedDCName
                    })() &&
                    (() => {
                      const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                      const firedOC = ccDataForYear.firedOCName
                      const firedDC = ccDataForYear.firedDCName
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

                    {/* Task: Recruiting Commitments (Bowl Week 2) */}
                    {(() => {
                      const commitmentKey = getCommitmentKey()
                      const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
                      const weekCommitments = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear]?.[commitmentKey]
                      const hasCommitmentsData = weekCommitments !== undefined
                      const commitmentsCount = weekCommitments?.length || 0
                      // Task number: starts at base, increments based on visible tasks
                      let taskNum = 2
                      if (bowlEligible && selectedBowl && bowlOpponent && userBowlIsWeek2) taskNum++
                      if (userInCFPQuarterfinal && hasBowlWeek1Data) taskNum++
                      taskNum++ // After "Taking a New Job" task
                      const ccDataForTaskNum = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                      if (currentDynasty.coachPosition === 'HC' && (ccDataForTaskNum.firedOCName || ccDataForTaskNum.firedDCName)) taskNum++ // After coordinator hire task

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasCommitmentsData ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasCommitmentsData ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                                hasCommitmentsData ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasCommitmentsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasCommitmentsData ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : taskNum}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText }}>
                                {hasCommitmentsData ? 'Recruiting Commitments' : 'Any commitments this week?'}
                              </div>
                              <div className="text-xs sm:text-sm mt-0.5" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                {hasCommitmentsData
                                  ? commitmentsCount > 0
                                    ? `✓ ${commitmentsCount} commitment${commitmentsCount !== 1 ? 's' : ''} recorded`
                                    : '✓ No commitments this week'
                                  : 'Record any recruiting commitments'}
                              </div>
                            </div>
                          </div>
                          {!hasCommitmentsData ? (
                            <div className="flex gap-2 self-end sm:self-auto">
                              <button
                                onClick={handleNoCommitments}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                No
                              </button>
                              <button
                                onClick={() => setShowRecruitingModal(true)}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                              >
                                Yes
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowRecruitingModal(true)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Edit
                            </button>
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
                      // Check if the Google Sheet was actually created, not just if data exists from box scores
                      const hasStatsSheet = !!currentDynasty?.statsEntrySheetId
                      const playerCount = currentDynasty?.playerStatsByYear?.[currentDynasty.currentYear]?.length || 0
                      const taskNumber = !userInCFPChampionship ? 2 : 1

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasStatsSheet ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasStatsSheet ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasStatsSheet ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasStatsSheet ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasStatsSheet ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">{taskNumber}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasStatsSheet ? '#16a34a' : secondaryBgText }}>
                                Player Stats Entry
                              </div>
                              {hasStatsSheet && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  ✓ Stats entered for {playerCount} players
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setShowStatsEntryModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasStatsSheet ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task: Detailed Stats Entry */}
                    {(() => {
                      // Check if the Google Sheets were actually created
                      const hasStatsSheet = !!currentDynasty?.statsEntrySheetId
                      const hasDetailedStatsSheet = !!currentDynasty?.detailedStatsSheetId
                      const taskNumber = !userInCFPChampionship ? 3 : 2
                      const isLocked = !hasStatsSheet

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasDetailedStatsSheet ? 'border-green-200 bg-green-50' : ''
                          } ${isLocked ? 'opacity-50' : ''}`}
                          style={!hasDetailedStatsSheet ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasDetailedStatsSheet ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasDetailedStatsSheet ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasDetailedStatsSheet ? (
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
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasDetailedStatsSheet ? '#16a34a' : secondaryBgText }}>
                                Detailed Stats Entry
                              </div>
                              {(hasDetailedStatsSheet || isLocked) && (
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasDetailedStatsSheet ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                  {hasDetailedStatsSheet
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
                            {hasDetailedStatsSheet ? 'Edit' : 'Enter'}
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
                            {totalEnteredWeek2 === 12 ? '✓ All 12 games entered' : `${totalEnteredWeek2}/12 games entered (incl. CFP Quarterfinals)`}
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
                          setEditingGame(userCFPSemifinalGame)
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
                    // Count games that actually have scores entered
                    const sfGamesWithScores = sfData.filter(g => g && g.team1Score !== undefined && g.team1Score !== null && g.team2Score !== undefined && g.team2Score !== null).length
                    const allSFComplete = sfGamesWithScores >= 2

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
                            {allSFComplete ? '✓ All 2 games entered' : `${sfGamesWithScores}/2 games entered`}
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
                          setEditingGame(userCFPChampionshipGame)
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
                  {currentDynasty.coachPosition === 'HC' && (() => {
                    const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                    return ccDataForYear.firedOCName || ccDataForYear.firedDCName
                  })() &&
                  (() => {
                    const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                    const firedOC = ccDataForYear.firedOCName
                    const firedDC = ccDataForYear.firedDCName
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

                  {/* Task: Recruiting Commitments (Bowl Weeks 3-4) */}
                  {(() => {
                    const commitmentKey = getCommitmentKey()
                    const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
                    const weekCommitments = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear]?.[commitmentKey]
                    const hasCommitmentsData = weekCommitments !== undefined
                    const commitmentsCount = weekCommitments?.length || 0
                    // Task number depends on week and other visible tasks
                    let taskNum = week === 3 ? 2 : 2
                    if (week === 3 && userInCFPSemifinal && hasBowlWeek2Data) taskNum++ // After user SF game
                    if (week === 4) {
                      // After SF results task
                      taskNum++
                      if (userInCFPChampionship) taskNum++ // After user Championship game
                    }
                    taskNum++ // After "Taking a New Job" task
                    const ccDataForTaskNum = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
                    if (currentDynasty.coachPosition === 'HC' && (ccDataForTaskNum.firedOCName || ccDataForTaskNum.firedDCName)) taskNum++ // After coordinator hire task

                    return (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          hasCommitmentsData ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!hasCommitmentsData ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                              hasCommitmentsData ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!hasCommitmentsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {hasCommitmentsData ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : taskNum}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText }}>
                              {hasCommitmentsData ? 'Recruiting Commitments' : 'Any commitments this week?'}
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {hasCommitmentsData
                                ? commitmentsCount > 0
                                  ? `✓ ${commitmentsCount} commitment${commitmentsCount !== 1 ? 's' : ''} recorded`
                                  : '✓ No commitments this week'
                                : 'Record any recruiting commitments'}
                            </div>
                          </div>
                        </div>
                        {!hasCommitmentsData ? (
                          <div className="flex gap-2 self-end sm:self-auto">
                            <button
                              onClick={handleNoCommitments}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              No
                            </button>
                            <button
                              onClick={() => setShowRecruitingModal(true)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Yes
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowRecruitingModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </>
            )
          })()}
        </div>
      ) : currentDynasty.currentPhase === 'offseason' ? (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          {(() => {
            const week = currentDynasty.currentWeek

            // Offseason Week 1: Players Leaving
            if (week === 1) {
              // Check if user switched teams - if so, skip Players Leaving
              const previousTeamAbbr = currentDynasty.coachTeamByYear?.[currentDynasty.currentYear]?.team
              const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
              const switchedTeams = previousTeamAbbr && currentTeamAbbr && previousTeamAbbr !== currentTeamAbbr

              const hasPlayersLeavingData = currentDynasty?.playersLeavingByYear?.[currentDynasty.currentYear]?.length > 0
              const playersLeavingCount = currentDynasty?.playersLeavingByYear?.[currentDynasty.currentYear]?.length || 0

              // If user switched teams, show a different UI
              if (switchedTeams) {
                return (
                  <>
                    <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                      New Team - No Players Leaving
                    </h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 border-green-200 bg-green-50"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: '#16a34a' }}>
                              Skipped - New Team
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                              You switched teams, so there are no departing players to track
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )
              }

              return (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                    Players Leaving
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Task: Enter Players Leaving */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasPlayersLeavingData ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasPlayersLeavingData ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasPlayersLeavingData ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasPlayersLeavingData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasPlayersLeavingData ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasPlayersLeavingData ? '#16a34a' : secondaryBgText }}>
                            Players Leaving
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasPlayersLeavingData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasPlayersLeavingData
                              ? `✓ ${playersLeavingCount} player${playersLeavingCount !== 1 ? 's' : ''} leaving`
                              : 'Graduating seniors, transfers, early declarations'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPlayersLeavingModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasPlayersLeavingData ? 'Edit' : 'Enter'}
                      </button>
                    </div>
                  </div>
                </>
              )
            }

            // Offseason Weeks 2-5: Recruiting Weeks
            if (week >= 2 && week <= 5) {
              const recruitingWeekNum = week - 1 // Week 2 = Recruiting Week 1, Week 3 = Recruiting Week 2, etc.

              // Check for draft declarees (only relevant in Recruiting Week 1)
              const playersLeavingThisYear = currentDynasty?.playersLeavingByYear?.[currentDynasty.currentYear] || []
              const draftDeclarees = playersLeavingThisYear.filter(p => p.reason === 'Pro Draft')
              const hasDraftDeclarees = draftDeclarees.length > 0
              const hasDraftResultsData = currentDynasty?.draftResultsByYear?.[currentDynasty.currentYear]?.length > 0
              const draftResultsCount = currentDynasty?.draftResultsByYear?.[currentDynasty.currentYear]?.length || 0

              // Check recruiting commitments for this week - TEAM-CENTRIC with signing_ key
              const teamAbbrForCommitments = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
              const recruitingCommitmentsForTeamYear = currentDynasty?.recruitingCommitmentsByTeamYear?.[teamAbbrForCommitments]?.[currentDynasty.currentYear] || {}
              const commitmentsForWeek = recruitingCommitmentsForTeamYear[`signing_${recruitingWeekNum}`]
              const hasCommitmentsData = commitmentsForWeek !== undefined // undefined = not answered, [] = no commitments, array with items = has commitments
              const commitmentsCount = commitmentsForWeek?.length || 0

              return (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                    {recruitingWeekNum === 4 ? 'National Signing Day' : `Recruiting Week ${recruitingWeekNum} of 4`}
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Task 1: Recruiting Commitments */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasCommitmentsData ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasCommitmentsData ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasCommitmentsData ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasCommitmentsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasCommitmentsData ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText }}>
                            {hasCommitmentsData
                              ? (recruitingWeekNum === 4 ? 'Signing Day' : 'Recruiting Commitments')
                              : (recruitingWeekNum === 4 ? 'Signing Day' : 'Any commitments this week?')}
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasCommitmentsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasCommitmentsData
                              ? commitmentsCount > 0
                                ? `✓ ${commitmentsCount} commitment${commitmentsCount !== 1 ? 's' : ''} recorded`
                                : '✓ No commitments this week'
                              : (recruitingWeekNum === 4 ? 'Enter your final recruiting class' : 'Record any recruiting commitments for this week')}
                          </div>
                        </div>
                      </div>
                      {!hasCommitmentsData ? (
                        recruitingWeekNum === 4 ? (
                          <button
                            onClick={() => setShowRecruitingModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            Open
                          </button>
                        ) : (
                          <div className="flex gap-2 self-end sm:self-auto">
                            <button
                              onClick={handleNoCommitments}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              No
                            </button>
                            <button
                              onClick={() => setShowRecruitingModal(true)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              Yes
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          onClick={() => setShowRecruitingModal(true)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {/* Task 2: Draft Results (only in Recruiting Week 1) */}
                    {recruitingWeekNum === 1 && (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          hasDraftResultsData || !hasDraftDeclarees ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!(hasDraftResultsData || !hasDraftDeclarees) ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              hasDraftResultsData || !hasDraftDeclarees ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!(hasDraftResultsData || !hasDraftDeclarees) ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {hasDraftResultsData || !hasDraftDeclarees ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">2</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: hasDraftResultsData || !hasDraftDeclarees ? '#16a34a' : secondaryBgText }}>
                              Draft Results
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasDraftResultsData || !hasDraftDeclarees ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {!hasDraftDeclarees
                                ? '✓ No players declared for the draft'
                                : hasDraftResultsData
                                  ? `✓ ${draftResultsCount} player${draftResultsCount !== 1 ? 's' : ''} drafted`
                                  : `${draftDeclarees.length} player${draftDeclarees.length !== 1 ? 's' : ''} declared for the draft`}
                            </div>
                          </div>
                        </div>
                        {hasDraftDeclarees && (
                          <button
                            onClick={() => setShowDraftResultsModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasDraftResultsData ? 'Edit' : 'Enter'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Task 3: Transfer Destinations (only in Recruiting Week 1) */}
                    {recruitingWeekNum === 1 && (() => {
                      // Get transferring players
                      const transferReasons = [
                        'Playing Style', 'Proximity to Home', 'Championship Contender',
                        'Program Tradition', 'Campus Lifestyle', 'Stadium Atmosphere',
                        'Pro Potential', 'Academics', 'Playing Time', 'Scheme Fit'
                      ]
                      const transfers = playersLeavingThisYear.filter(p =>
                        transferReasons.some(reason => p.reason?.includes(reason) || p.reason?.includes('Transfer'))
                      )
                      const hasTransfers = transfers.length > 0
                      const hasTransferDestinationsData = currentDynasty?.transferDestinationsByYear?.[currentDynasty.currentYear]?.length > 0
                      const transferDestinationsCount = currentDynasty?.transferDestinationsByYear?.[currentDynasty.currentYear]?.length || 0

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasTransferDestinationsData || !hasTransfers ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!(hasTransferDestinationsData || !hasTransfers) ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasTransferDestinationsData || !hasTransfers ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!(hasTransferDestinationsData || !hasTransfers) ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasTransferDestinationsData || !hasTransfers ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">3</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasTransferDestinationsData || !hasTransfers ? '#16a34a' : secondaryBgText }}>
                                Transfer Destinations
                              </div>
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasTransferDestinationsData || !hasTransfers ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                {!hasTransfers
                                  ? '✓ No outgoing transfers'
                                  : hasTransferDestinationsData
                                    ? `✓ ${transferDestinationsCount} transfer${transferDestinationsCount !== 1 ? 's' : ''} tracked`
                                    : `Track where ${transfers.length} transfer${transfers.length !== 1 ? 's' : ''} committed`}
                              </div>
                            </div>
                          </div>
                          {hasTransfers && (
                            <button
                              onClick={() => setShowTransferDestinationsModal(true)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                              style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                            >
                              {hasTransferDestinationsData ? 'Edit' : 'Enter'}
                            </button>
                          )}
                        </div>
                      )
                    })()}

                    {/* Task 2: Recruiting Class Rank (only on National Signing Day) */}
                    {recruitingWeekNum === 4 && (() => {
                      const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
                      const classRank = currentDynasty.recruitingClassRankByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear]
                      const hasClassRank = !!classRank

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasClassRank ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasClassRank ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasClassRank ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasClassRank ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasClassRank ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">2</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasClassRank ? '#16a34a' : secondaryBgText }}>
                                Recruiting Class Rank
                              </div>
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasClassRank ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                {hasClassRank
                                  ? `✓ Ranked #${classRank} nationally`
                                  : 'Enter national recruiting class ranking'}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowRecruitingClassRankModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasClassRank ? 'Edit' : 'Enter'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task 3: Transfer Redshirt Status (only on National Signing Day) */}
                    {recruitingWeekNum === 4 && (() => {
                      // Check if user switched teams this offseason
                      const previousTeamAbbr = currentDynasty.coachTeamByYear?.[currentDynasty.currentYear]?.team
                      const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
                      const switchedTeams = previousTeamAbbr && currentTeamAbbr && previousTeamAbbr !== currentTeamAbbr

                      // Get portal transfers from this year's recruiting class
                      const year = currentDynasty.currentYear
                      const portalTransfers = (currentDynasty.players || []).filter(p =>
                        p.team === currentTeamAbbr &&
                        p.recruitYear === year &&
                        p.isPortal &&
                        // Only show non-RS classes (Fr, So, Jr, Sr) - already RS classes don't need this
                        ['Fr', 'So', 'Jr', 'Sr'].includes(p.year)
                      )
                      const hasPortalTransfers = portalTransfers.length > 0

                      // Check if transfer redshirt data has been entered
                      const transferRedshirtData = currentDynasty.transferRedshirtByTeamYear?.[currentTeamAbbr]?.[year]
                      const hasTransferRedshirtData = transferRedshirtData !== undefined

                      // If user switched teams or no portal transfers, show skipped state
                      if (switchedTeams || !hasPortalTransfers) {
                        return (
                          <div
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 border-green-200 bg-green-50"
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base font-semibold" style={{ color: '#16a34a' }}>
                                  Transfer Redshirt Status - Skipped
                                </div>
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  {switchedTeams ? 'New team - no transfers to update' : 'No portal transfers this class'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      }

                      const redshirtedCount = transferRedshirtData?.length || 0

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasTransferRedshirtData ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasTransferRedshirtData ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasTransferRedshirtData ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasTransferRedshirtData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasTransferRedshirtData ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">3</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasTransferRedshirtData ? '#16a34a' : secondaryBgText }}>
                                Transfer Redshirt Status
                              </div>
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasTransferRedshirtData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                {hasTransferRedshirtData
                                  ? redshirtedCount > 0
                                    ? `✓ ${redshirtedCount} transfer${redshirtedCount !== 1 ? 's' : ''} marked as previously redshirted`
                                    : '✓ No transfers were previously redshirted'
                                  : `Mark which of ${portalTransfers.length} portal transfer${portalTransfers.length !== 1 ? 's' : ''} were redshirted`}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowTransferRedshirtModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasTransferRedshirtData ? 'Edit' : 'Open'}
                          </button>
                        </div>
                      )
                    })()}

                    {/* Task 4: Position Changes (only on National Signing Day) */}
                    {recruitingWeekNum === 4 && (() => {
                      // Check if user switched teams this offseason
                      const previousTeamAbbr = currentDynasty.coachTeamByYear?.[currentDynasty.currentYear]?.team
                      const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
                      const switchedTeams = previousTeamAbbr && currentTeamAbbr && previousTeamAbbr !== currentTeamAbbr

                      // If user switched teams, show skipped state
                      if (switchedTeams) {
                        return (
                          <div
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 border-green-200 bg-green-50"
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base font-semibold" style={{ color: '#16a34a' }}>
                                  Position Changes - Skipped
                                </div>
                                <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                                  Will enter new roster during preseason
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      }

                      const positionChangesThisYear = currentDynasty.positionChangesByYear?.[currentDynasty.currentYear] || []
                      const hasPositionChanges = positionChangesThisYear.length > 0

                      return (
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                            hasPositionChanges ? 'border-green-200 bg-green-50' : ''
                          }`}
                          style={!hasPositionChanges ? { borderColor: `${teamColors.primary}30` } : {}}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasPositionChanges ? 'bg-green-500 text-white' : ''
                              }`}
                              style={!hasPositionChanges ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                            >
                              {hasPositionChanges ? (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : <span className="font-bold text-sm sm:text-base">4</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-semibold" style={{ color: hasPositionChanges ? '#16a34a' : secondaryBgText }}>
                                Position Changes
                              </div>
                              <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasPositionChanges ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                                {hasPositionChanges
                                  ? `✓ ${positionChangesThisYear.length} position change${positionChangesThisYear.length !== 1 ? 's' : ''} recorded`
                                  : 'Update player positions'}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowPositionChangesModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {hasPositionChanges ? 'Edit' : 'Open'}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                </>
              )
            }

            // Offseason Week 6: Training Camp
            if (week === 6) {
              // Check if user switched teams this offseason
              const previousTeamAbbr = currentDynasty.coachTeamByYear?.[currentDynasty.currentYear]?.team
              const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
              const switchedTeams = previousTeamAbbr && currentTeamAbbr && previousTeamAbbr !== currentTeamAbbr

              // If user switched teams, show skipped state
              if (switchedTeams) {
                return (
                  <>
                    <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                      Training Camp
                    </h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 border-green-200 bg-green-50"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: '#16a34a' }}>
                              Training Results - Skipped
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: '#16a34a', opacity: 0.7 }}>
                              Will enter new roster during preseason
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )
              }

              // Calculate which players should be in training results:
              // - Current roster players who are NOT in playersLeavingByYear
              // - PLUS any portal transfers from recruiting commitments
              const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
              const playersLeavingThisYear = currentDynasty?.playersLeavingByYear?.[currentDynasty.currentYear] || []
              const leavingPids = new Set(playersLeavingThisYear.map(p => p.pid))

              // Get returning players (not leaving) - use teamRoster which filters by team and excludes recruits
              const returningPlayers = teamRoster.filter(p => !leavingPids.has(p.pid))

              // Get portal transfers from recruiting commitments
              const recruitingCommitments = currentDynasty?.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear] || {}
              const portalTransfers = []
              Object.values(recruitingCommitments).forEach(weekCommitments => {
                if (Array.isArray(weekCommitments)) {
                  weekCommitments.forEach(c => {
                    if (c.isPortal) {
                      portalTransfers.push({
                        name: c.name,
                        position: c.position,
                        overall: c.overall || 0,
                        pid: c.pid || `portal-${c.name}` // Use pid if available
                      })
                    }
                  })
                }
              })

              // Combine returning players and portal transfers
              const trainingPlayers = [...returningPlayers, ...portalTransfers]

              const hasTrainingResultsData = currentDynasty?.trainingResultsByYear?.[currentDynasty.currentYear]?.length > 0
              const trainingResultsCount = currentDynasty?.trainingResultsByYear?.[currentDynasty.currentYear]?.length || 0

              // Get recruits for Recruiting Class Overalls task
              // These are HS and JUCO players from this recruiting year (exclude portal)
              const allPlayers = currentDynasty?.players || []
              const recruitingClassPlayers = allPlayers.filter(p =>
                p.isRecruit &&
                p.recruitYear === currentDynasty.currentYear &&
                (!p.team || p.team === teamAbbr) &&
                !p.isPortal && !p.previousTeam // Exclude transfer portal players
              )
              const hasRecruitOverallsData = currentDynasty?.recruitOverallsByYear?.[currentDynasty.currentYear]?.length > 0
              const recruitOverallsCount = currentDynasty?.recruitOverallsByYear?.[currentDynasty.currentYear]?.length || 0

              return (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                    Training Camp
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Task 1: Training Results */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasTrainingResultsData ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasTrainingResultsData ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasTrainingResultsData ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasTrainingResultsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasTrainingResultsData ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasTrainingResultsData ? '#16a34a' : secondaryBgText }}>
                            Training Results
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasTrainingResultsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasTrainingResultsData
                              ? `✓ ${trainingResultsCount} player overall${trainingResultsCount !== 1 ? 's' : ''} updated`
                              : `Enter new overalls for ${trainingPlayers.length} players`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowTrainingResultsModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasTrainingResultsData ? 'Edit' : 'Enter'}
                      </button>
                    </div>

                    {/* Task 2: Recruiting Class Overalls */}
                    {recruitingClassPlayers.length > 0 && (
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                          hasRecruitOverallsData ? 'border-green-200 bg-green-50' : ''
                        }`}
                        style={!hasRecruitOverallsData ? { borderColor: `${teamColors.primary}30` } : {}}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              hasRecruitOverallsData ? 'bg-green-500 text-white' : ''
                            }`}
                            style={!hasRecruitOverallsData ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                          >
                            {hasRecruitOverallsData ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : <span className="font-bold text-sm sm:text-base">2</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-semibold" style={{ color: hasRecruitOverallsData ? '#16a34a' : secondaryBgText }}>
                              Recruiting Class Overalls
                            </div>
                            <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasRecruitOverallsData ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                              {hasRecruitOverallsData
                                ? `✓ ${recruitOverallsCount} recruit overall${recruitOverallsCount !== 1 ? 's' : ''} entered`
                                : `Enter overalls for ${recruitingClassPlayers.length} recruit${recruitingClassPlayers.length !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowRecruitOverallsModal(true)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                          style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                        >
                          {hasRecruitOverallsData ? 'Edit' : 'Enter'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )
            }

            // Offseason Week 7: Offseason (Custom Conferences & Encourage Transfers)
            if (week === 7) {
              const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
              const nextYear = currentDynasty.currentYear + 1

              // Check if conferences have been set for next year
              const hasNextYearConferences = currentDynasty?.customConferencesByYear?.[nextYear] != null

              // Check if encourage transfers has been completed
              const hasEncourageTransfers = currentDynasty?.encourageTransfersByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear] != null
              const encourageTransfersCount = currentDynasty?.encourageTransfersByTeamYear?.[teamAbbr]?.[currentDynasty.currentYear]?.length || 0

              return (
                <>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                    Offseason
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* Task 1: Custom Conferences */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasNextYearConferences ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasNextYearConferences ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasNextYearConferences ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasNextYearConferences ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasNextYearConferences ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">1</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasNextYearConferences ? '#16a34a' : secondaryBgText }}>
                            Custom Conferences
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasNextYearConferences ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasNextYearConferences
                              ? `✓ Conference alignment set for ${nextYear}`
                              : `Set conference alignment for ${nextYear} season`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowOffseasonConferencesModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasNextYearConferences ? 'Edit' : 'Set'}
                      </button>
                    </div>

                    {/* Task 2: Encourage Transfers */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border-2 gap-3 sm:gap-0 ${
                        hasEncourageTransfers ? 'border-green-200 bg-green-50' : ''
                      }`}
                      style={!hasEncourageTransfers ? { borderColor: `${teamColors.primary}30` } : {}}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasEncourageTransfers ? 'bg-green-500 text-white' : ''
                          }`}
                          style={!hasEncourageTransfers ? { backgroundColor: `${teamColors.primary}20`, color: teamColors.primary } : {}}
                        >
                          {hasEncourageTransfers ? (
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : <span className="font-bold text-sm sm:text-base">2</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold" style={{ color: hasEncourageTransfers ? '#16a34a' : secondaryBgText }}>
                            Encourage Transfers
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: hasEncourageTransfers ? '#16a34a' : secondaryBgText, opacity: 0.7 }}>
                            {hasEncourageTransfers
                              ? `✓ ${encourageTransfersCount} player${encourageTransfersCount !== 1 ? 's' : ''} encouraged to transfer`
                              : 'Mark players to encourage to transfer'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowEncourageTransfersModal(true)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:opacity-90 text-sm self-end sm:self-auto"
                        style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                      >
                        {hasEncourageTransfers ? 'Edit' : 'Enter'}
                      </button>
                    </div>
                  </div>
                </>
              )
            }

            // Fallback for any other weeks
            return (
              <>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: secondaryBgText }}>
                  Off-Season Week {week}
                </h3>
                <p className="text-sm" style={{ color: secondaryBgText, opacity: 0.7 }}>
                  Click "Advance Week" to continue to the next season.
                </p>
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

{teamSchedule && teamSchedule.length > 0 ? (
          <div className="space-y-2">
            {teamSchedule.map((game, index) => {
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
                      <div className="text-right min-w-[85px] sm:min-w-[95px]">
                        <div className="text-sm sm:text-base font-bold" style={{ color: opponentColors.textColor }}>
                          {Math.max(playedGame.teamScore, playedGame.opponentScore)} - {Math.min(playedGame.teamScore, playedGame.opponentScore)}
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
                    to={`${pathPrefix}/game/${playedGame.id}`}
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
            {(() => {
              const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
              return ccMadeChampionship === true || ccDataForYear.madeChampionship === true
            })() && (() => {
              const ccGame = getCCGame()
              const ccDataForYear = currentDynasty.conferenceChampionshipDataByYear?.[currentDynasty.currentYear] || {}
              const ccOpponentAbbr = ccGame?.opponent || ccOpponent || ccDataForYear.opponent
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
                      <div className="text-right min-w-[85px] sm:min-w-[95px]">
                        <div className="text-sm sm:text-base font-bold" style={{ color: ccOpponentColors.textColor }}>
                          {Math.max(ccGame.teamScore, ccGame.opponentScore)} - {Math.min(ccGame.teamScore, ccGame.opponentScore)}
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
                    to={`${pathPrefix}/game/${gameId}`}
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
              const userBowlGameData = findCurrentTeamGame(currentDynasty, g => g.isBowlGame && g.year === currentDynasty.currentYear)
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
                      <div className="text-right min-w-[85px] sm:min-w-[95px]">
                        <div className="text-sm sm:text-base font-bold" style={{ color: bowlOpponentColors.textColor }}>
                          {Math.max(userBowlGameData.teamScore, userBowlGameData.opponentScore)} - {Math.min(userBowlGameData.teamScore, userBowlGameData.opponentScore)}
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
                    to={`${pathPrefix}/game/${gameId}`}
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
              const cfpFirstRoundGame = findCurrentTeamGame(currentDynasty, g => g.isCFPFirstRound && g.year === currentDynasty.currentYear)
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
                  to={`${pathPrefix}/game/${cfpFirstRoundGame.id}`}
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
                        {Math.max(cfpFirstRoundGame.teamScore, cfpFirstRoundGame.opponentScore)} - {Math.min(cfpFirstRoundGame.teamScore, cfpFirstRoundGame.opponentScore)}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })()}

            {/* CFP Quarterfinal Game - shows when user played in Quarterfinal */}
            {(() => {
              const cfpQFGame = findCurrentTeamGame(currentDynasty, g => g.isCFPQuarterfinal && g.year === currentDynasty.currentYear)
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
                  to={`${pathPrefix}/game/${cfpQFGame.id}`}
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
                        {Math.max(cfpQFGame.teamScore, cfpQFGame.opponentScore)} - {Math.min(cfpQFGame.teamScore, cfpQFGame.opponentScore)}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })()}

            {/* CFP Semifinal Game - shows when user played in Semifinal */}
            {(() => {
              const cfpSFGame = findCurrentTeamGame(currentDynasty, g => g.isCFPSemifinal && g.year === currentDynasty.currentYear)
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
                  to={`${pathPrefix}/game/${cfpSFGame.id}`}
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
                        {Math.max(cfpSFGame.teamScore, cfpSFGame.opponentScore)} - {Math.min(cfpSFGame.teamScore, cfpSFGame.opponentScore)}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })()}

            {/* CFP Championship Game - shows when user played in Championship */}
            {(() => {
              const cfpChampGame = findCurrentTeamGame(currentDynasty, g => g.isCFPChampionship && g.year === currentDynasty.currentYear)
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
                  to={`${pathPrefix}/game/${cfpChampGame.id}`}
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
                        {Math.max(cfpChampGame.teamScore, cfpChampGame.opponentScore)} - {Math.min(cfpChampGame.teamScore, cfpChampGame.opponentScore)}
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
        currentRatings={teamRatings}
      />

      <CoachingStaffModal
        isOpen={showCoachingStaffModal}
        onClose={() => setShowCoachingStaffModal(false)}
        onSave={handleCoachingStaffSave}
        teamColors={teamColors}
        currentStaff={teamCoachingStaff}
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
          setEditingGame(null)
        }}
        onSave={handleGameSave}
        weekNumber={editingWeek || currentDynasty.currentWeek}
        currentYear={editingYear || currentDynasty.currentYear}
        teamColors={teamColors}
        opponent={editingOpponent}
        bowlName={editingBowlName}
        existingGame={editingGame}
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
        opponent={currentDynasty.bowlEligibilityDataByYear?.[currentDynasty.currentYear]?.opponent || bowlOpponent}
        existingGame={findCurrentTeamGame(currentDynasty, g => g.isBowlGame && g.year === currentDynasty.currentYear)}
        bowlName={currentDynasty.bowlEligibilityDataByYear?.[currentDynasty.currentYear]?.bowlGame || selectedBowl}
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
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
            )
            // Check if user's game is already in the new data from the sheet
            const userGameInSheet = sanitizedBowlGames.some(g =>
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
            )
            // Merge: keep user's game if it exists and wasn't in the sheet
            const mergedBowlGames = userExistingBowlGame && !userGameInSheet
              ? [...sanitizedBowlGames, userExistingBowlGame]
              : sanitizedBowlGames

            // Find user's existing CFP First Round game (if any)
            const existingFirstRound = existingCFPYearData.firstRound || []
            const userExistingCFPGame = existingFirstRound.find(g =>
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
            )
            // Check if user's CFP game is already in the new data from the sheet
            const userCFPGameInSheet = cfpFirstRound.some(g =>
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
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
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
            )
            // Check if user's game is already in the new data from the sheet
            const userGameInSheet = sanitizedBowlGames.some(g =>
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
            )
            // Merge: keep user's game if it exists and wasn't in the sheet
            const mergedBowlGames = userExistingBowlGame && !userGameInSheet
              ? [...sanitizedBowlGames, userExistingBowlGame]
              : sanitizedBowlGames

            // Find user's existing CFP Quarterfinal game (if any)
            const existingQuarterfinals = existingCFPYearData.quarterfinals || []
            const userExistingCFPGame = existingQuarterfinals.find(g =>
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
            )
            // Check if user's CFP game is already in the new data from the sheet
            const userCFPGameInSheet = cfpQuarterfinals.some(g =>
              g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
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
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
          )
          const userGameInSheet = games.some(g =>
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
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
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
          )
          const userGameInSheet = cfpGames.some(g =>
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
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
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
          )
          const userGameInSheet = cfpGames.some(g =>
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
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
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
          )
          const userGameInSheet = cfpGames.some(g =>
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
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
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
          )
          const userGameInSheet = cfpGames.some(g =>
            g && (g.team1 === userTeamAbbr || g.team2 === userTeamAbbr)
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
          const teamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName) || currentDynasty.teamName
          const year = currentDynasty.currentYear
          if (isDev || !user) {
            // Dev mode - update both legacy and team-centric structures
            const existingPreseasonSetupByTeamYear = currentDynasty.preseasonSetupByTeamYear || {}
            const teamSetups = existingPreseasonSetupByTeamYear[teamAbbr] || {}
            const currentSetup = teamSetups[year] || currentDynasty.preseasonSetup || {}
            await updateDynasty(currentDynasty.id, {
              customConferences: conferences,
              preseasonSetupByTeamYear: {
                ...existingPreseasonSetupByTeamYear,
                [teamAbbr]: {
                  ...teamSetups,
                  [year]: {
                    ...currentSetup,
                    conferencesEntered: true
                  }
                }
              },
              preseasonSetup: {
                ...currentDynasty.preseasonSetup,
                conferencesEntered: true
              }
            })
          } else {
            // Production mode - use dot notation
            await updateDynasty(currentDynasty.id, {
              customConferences: conferences,
              [`preseasonSetupByTeamYear.${teamAbbr}.${year}.conferencesEntered`]: true,
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
        aggregatedStats={aggregatedTeamStats}
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

      {/* Players Leaving Modal (Offseason Week 1) */}
      <PlayersLeavingModal
        isOpen={showPlayersLeavingModal}
        onClose={() => setShowPlayersLeavingModal(false)}
        onSave={handlePlayersLeavingSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Draft Results Modal (Recruiting Week 1) */}
      <DraftResultsModal
        isOpen={showDraftResultsModal}
        onClose={() => setShowDraftResultsModal(false)}
        onSave={handleDraftResultsSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Transfer Destinations Modal (Recruiting Week 1) */}
      <TransferDestinationsModal
        isOpen={showTransferDestinationsModal}
        onClose={() => setShowTransferDestinationsModal(false)}
        onSave={handleTransferDestinationsSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />

      {/* Recruiting Commitments Modal (All phases) */}
      <RecruitingCommitmentsModal
        isOpen={showRecruitingModal}
        onClose={() => setShowRecruitingModal(false)}
        onSave={handleRecruitingCommitmentsSave}
        currentYear={currentDynasty.currentYear}
        currentPhase={currentDynasty.currentPhase}
        currentWeek={currentDynasty.currentWeek}
        commitmentKey={getCommitmentKey()}
        recruitingLabel={getRecruitingLabel()}
        existingCommitments={getAllPreviousCommitments()}
        teamColors={teamColors}
      />

      {/* Position Changes Modal (National Signing Day) */}
      <PositionChangesModal
        isOpen={showPositionChangesModal}
        onClose={() => setShowPositionChangesModal(false)}
        onSave={handlePositionChangesSave}
        players={currentDynasty?.players || []}
        existingChanges={currentDynasty?.positionChangesByYear?.[currentDynasty?.currentYear] || []}
        teamColors={teamColors}
      />

      {/* Transfer Redshirt Status Modal (National Signing Day) */}
      <TransferRedshirtModal
        isOpen={showTransferRedshirtModal}
        onClose={() => setShowTransferRedshirtModal(false)}
        onSave={handleTransferRedshirtSave}
        currentYear={currentDynasty?.currentYear}
        portalTransfers={(() => {
          // Get portal transfers from this year's recruiting class
          const teamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName)
          const year = currentDynasty?.currentYear
          return (currentDynasty?.players || []).filter(p =>
            p.team === teamAbbr &&
            p.recruitYear === year &&
            p.isPortal &&
            // Only show non-RS classes (Fr, So, Jr, Sr) - already RS classes don't need this
            ['Fr', 'So', 'Jr', 'Sr'].includes(p.year)
          )
        })()}
        teamColors={teamColors}
      />

      {/* Recruiting Class Rank Modal (National Signing Day) */}
      <RecruitingClassRankModal
        isOpen={showRecruitingClassRankModal}
        onClose={() => setShowRecruitingClassRankModal(false)}
        onSave={handleRecruitingClassRankSave}
        currentRank={currentDynasty?.recruitingClassRankByTeamYear?.[getAbbreviationFromDisplayName(currentDynasty?.teamName)]?.[currentDynasty?.currentYear]}
        teamColors={teamColors}
      />

      {/* Training Results Modal (Training Camp - Offseason Week 6) */}
      <TrainingResultsModal
        isOpen={showTrainingResultsModal}
        onClose={() => setShowTrainingResultsModal(false)}
        onSave={handleTrainingResultsSave}
        currentYear={currentDynasty?.currentYear}
        teamColors={teamColors}
        players={(() => {
          // Calculate training players: returning players + portal transfers
          const teamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName)
          const playersLeavingThisYear = currentDynasty?.playersLeavingByYear?.[currentDynasty?.currentYear] || []
          const leavingPids = new Set(playersLeavingThisYear.map(p => p.pid))

          // Get returning players (not leaving) - use teamRoster which filters by team and excludes recruits
          const returningPlayers = teamRoster.filter(p => !leavingPids.has(p.pid))

          // Get portal transfers from recruiting commitments
          const recruitingCommitments = currentDynasty?.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty?.currentYear] || {}
          const portalTransfers = []
          Object.values(recruitingCommitments).forEach(weekCommitments => {
            if (Array.isArray(weekCommitments)) {
              weekCommitments.forEach(c => {
                if (c.isPortal) {
                  portalTransfers.push({
                    name: c.name,
                    position: c.position,
                    overall: c.overall || 0,
                    pid: c.pid || `portal-${c.name}`
                  })
                }
              })
            }
          })

          return [...returningPlayers, ...portalTransfers]
        })()}
      />

      {/* Recruit Overalls Modal (Training Camp - Offseason Week 6) */}
      <RecruitOverallsModal
        isOpen={showRecruitOverallsModal}
        onClose={() => setShowRecruitOverallsModal(false)}
        onSave={handleRecruitOverallsSave}
        currentYear={currentDynasty?.currentYear}
        teamColors={teamColors}
        recruits={(() => {
          // Get recruits for current year (HS and JUCO only - exclude transfer portal)
          const teamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName)
          const allPlayers = currentDynasty?.players || []
          return allPlayers.filter(p =>
            p.isRecruit &&
            p.recruitYear === currentDynasty?.currentYear &&
            (!p.team || p.team === teamAbbr) &&
            !p.isPortal && !p.previousTeam // Exclude transfer portal players
          )
        })()}
      />

      {/* Encourage Transfers Modal (Offseason Week 7) */}
      <EncourageTransfersModal
        isOpen={showEncourageTransfersModal}
        onClose={() => setShowEncourageTransfersModal(false)}
        onSave={async (transferPlayers) => {
          const teamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName)
          const year = currentDynasty?.currentYear
          const isDev = import.meta.env.VITE_DEV_MODE === 'true'

          if (isDev || !user) {
            // Dev mode - store encouraged transfers using team-centric pattern
            const existingByTeamYear = currentDynasty?.encourageTransfersByTeamYear || {}
            const teamTransfers = existingByTeamYear[teamAbbr] || {}
            await updateDynasty(currentDynasty.id, {
              encourageTransfersByTeamYear: {
                ...existingByTeamYear,
                [teamAbbr]: {
                  ...teamTransfers,
                  [year]: transferPlayers
                }
              }
            })
          } else {
            // Production mode - use dot notation for Firestore
            await updateDynasty(currentDynasty.id, {
              [`encourageTransfersByTeamYear.${teamAbbr}.${year}`]: transferPlayers
            })
          }
        }}
        currentYear={currentDynasty?.currentYear}
        teamColors={teamColors}
        players={(() => {
          // Players for encourage transfers: current roster after training results
          const teamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName)
          const playersLeavingThisYear = currentDynasty?.playersLeavingByYear?.[currentDynasty?.currentYear] || []
          const leavingPids = new Set(playersLeavingThisYear.map(p => p.pid))

          // Get returning players (not leaving)
          const returningPlayers = teamRoster.filter(p => !leavingPids.has(p.pid))

          // Get portal transfers from recruiting commitments
          const recruitingCommitments = currentDynasty?.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[currentDynasty?.currentYear] || {}
          const portalTransfers = []
          Object.values(recruitingCommitments).forEach(weekCommitments => {
            if (Array.isArray(weekCommitments)) {
              weekCommitments.forEach(c => {
                if (c.isPortal) {
                  portalTransfers.push({
                    name: c.name,
                    position: c.position,
                    overall: c.overall || 0,
                    pid: c.pid || `portal-${c.name}`
                  })
                }
              })
            }
          })

          return [...returningPlayers, ...portalTransfers]
        })()}
      />

      {/* Offseason Conferences Modal (Offseason Week 7) - applies to NEXT season */}
      <ConferencesModal
        isOpen={showOffseasonConferencesModal}
        onClose={() => setShowOffseasonConferencesModal(false)}
        onSave={async (conferences) => {
          const nextYear = currentDynasty.currentYear + 1
          const isDev = import.meta.env.VITE_DEV_MODE === 'true'
          if (isDev || !user) {
            // Dev mode - save conferences for next year
            const existingByYear = currentDynasty?.customConferencesByYear || {}
            await updateDynasty(currentDynasty.id, {
              customConferencesByYear: {
                ...existingByYear,
                [nextYear]: conferences
              }
            })
          } else {
            // Production mode - use dot notation for Firestore
            await updateDynasty(currentDynasty.id, {
              [`customConferencesByYear.${nextYear}`]: conferences
            })
          }
        }}
        teamColors={teamColors}
      />
    </div>
  )
}
