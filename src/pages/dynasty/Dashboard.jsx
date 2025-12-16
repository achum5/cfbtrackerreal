import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useAuth } from '../../context/AuthContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamLogo } from '../../data/teams'
import { getTeamColors } from '../../data/teamColors'
import ScheduleEntryModal from '../../components/ScheduleEntryModal'
import TeamRatingsModal from '../../components/TeamRatingsModal'
import GameEntryModal from '../../components/GameEntryModal'
import GameDetailModal from '../../components/GameDetailModal'
import ConferenceChampionshipModal from '../../components/ConferenceChampionshipModal'
import CoachingStaffModal from '../../components/CoachingStaffModal'

export default function Dashboard() {
  const { currentDynasty, saveSchedule, saveRoster, saveTeamRatings, saveCoachingStaff, addGame, createGoogleSheetForDynasty, updateDynasty } = useDynasty()
  const { user } = useAuth()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showTeamRatingsModal, setShowTeamRatingsModal] = useState(false)
  const [showCoachingStaffModal, setShowCoachingStaffModal] = useState(false)
  const [showGameModal, setShowGameModal] = useState(false)
  const [showGameDetailModal, setShowGameDetailModal] = useState(false)
  const [showCCModal, setShowCCModal] = useState(false)
  const [editingWeek, setEditingWeek] = useState(null)
  const [editingYear, setEditingYear] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [creatingSheet, setCreatingSheet] = useState(false)

  // Conference Championship states
  const [ccMadeChampionship, setCCMadeChampionship] = useState(null) // null = not answered, true/false = answered
  const [ccOpponent, setCCOpponent] = useState('')
  const [ccOpponentSearch, setCCOpponentSearch] = useState('')
  const [showCCOpponentDropdown, setShowCCOpponentDropdown] = useState(false)
  const [showCCGameModal, setShowCCGameModal] = useState(false)

  // Coordinator firing states (for HC only during CC week)
  const [firingCoordinators, setFiringCoordinators] = useState(null) // null = not asked, false = no, true = yes
  const [coordinatorToFire, setCoordinatorToFire] = useState('') // 'oc', 'dc', or 'both'

  // Restore CC state from saved dynasty data
  useEffect(() => {
    if (currentDynasty?.conferenceChampionshipData) {
      const ccData = currentDynasty.conferenceChampionshipData
      setCCMadeChampionship(ccData.madeChampionship ?? null)
      setCCOpponent(ccData.opponent || '')
      setFiringCoordinators(ccData.firingCoordinators ?? null)
      setCoordinatorToFire(ccData.coordinatorToFire || '')
    } else {
      // Reset when no data
      setCCMadeChampionship(null)
      setCCOpponent('')
      setFiringCoordinators(null)
      setCoordinatorToFire('')
    }
  }, [currentDynasty?.id, currentDynasty?.conferenceChampionshipData])

  if (!currentDynasty) return null

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
    const team = teamAbbreviations[abbr]
    const mascotName = getMascotName(abbr)
    const colors = mascotName ? getTeamColors(mascotName) : null

    if (team) {
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
    console.log('Dashboard handleGameSave called with:', gameData)
    try {
      await addGame(currentDynasty.id, gameData)
      console.log('Game saved successfully')
      console.log('Current dynasty games after save:', currentDynasty.games)
      console.log('Current week:', currentDynasty.currentWeek, 'Current year:', currentDynasty.currentYear)
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
    console.log('CC Game save called with:', gameData)
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

    // If HC with at least one coordinator, must answer firing question
    const hasCoordinators = currentDynasty.coachPosition === 'HC' &&
      (currentDynasty.coachingStaff?.ocName || currentDynasty.coachingStaff?.dcName)
    if (hasCoordinators) {
      return firingCoordinators !== null
    }

    return true
  }

  // Handle coordinator firing answer
  const handleFiringAnswer = async (isFiring) => {
    setFiringCoordinators(isFiring)
    if (!isFiring) {
      // Not firing anyone, save decision
      await updateDynasty(currentDynasty.id, {
        conferenceChampionshipData: {
          ...currentDynasty.conferenceChampionshipData,
          firingCoordinators: false,
          coordinatorToFire: null,
          year: currentDynasty.currentYear
        }
      })
    }
  }

  // Handle coordinator firing selection
  const handleFireCoordinator = async (selection) => {
    setCoordinatorToFire(selection)

    // Save fired coordinator names before clearing
    const firedOCName = (selection === 'oc' || selection === 'both') ? currentDynasty.coachingStaff?.ocName : null
    const firedDCName = (selection === 'dc' || selection === 'both') ? currentDynasty.coachingStaff?.dcName : null

    // Determine which coordinators to clear
    let updatedStaff = { ...currentDynasty.coachingStaff }
    if (selection === 'oc' || selection === 'both') {
      updatedStaff.ocName = null
    }
    if (selection === 'dc' || selection === 'both') {
      updatedStaff.dcName = null
    }

    // Save the firing decision and clear the coordinator(s)
    await updateDynasty(currentDynasty.id, {
      coachingStaff: updatedStaff,
      conferenceChampionshipData: {
        ...currentDynasty.conferenceChampionshipData,
        firingCoordinators: true,
        coordinatorToFire: selection,
        firedOCName,
        firedDCName,
        year: currentDynasty.currentYear
      },
      // Reset coachingStaffEntered so user must re-enter in next preseason
      'preseasonSetup.coachingStaffEntered': false
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

  const handleEnableGoogleSheets = async () => {
    if (!user) {
      alert('Please sign in to enable Google Sheets integration')
      return
    }

    setCreatingSheet(true)
    try {
      await createGoogleSheetForDynasty(currentDynasty.id)
      alert('Google Sheets enabled! Your schedule and roster modals will now use Google Sheets.')
    } catch (error) {
      alert(error.message || 'Failed to create Google Sheet. Check the console for details.')
    } finally {
      setCreatingSheet(false)
    }
  }

  const canAdvanceFromPreseason = () => {
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

  const getPhaseDisplay = (phase) => {
    const phases = {
      preseason: 'Pre-Season',
      regular_season: 'Regular Season',
      postseason: 'Post-Season',
      offseason: 'Off-Season'
    }
    return phases[phase] || phase
  }

  const currentYearGames = currentDynasty.games
    .filter(g => g.year === currentDynasty.currentYear)
    .sort((a, b) => a.week - b.week)

  return (
    <div className="space-y-6">
      {/* Google Sheets Status */}
      {!currentDynasty.googleSheetId && user && (
        <div className="p-4 rounded-lg bg-blue-50 border-2 border-blue-500">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-blue-900">Enable Google Sheets Integration</p>
              <p className="text-sm text-blue-700 mt-1">
                This dynasty was created before Google Sheets integration. Click below to create a Google Sheet for schedule and roster management.
              </p>
              <button
                onClick={handleEnableGoogleSheets}
                disabled={creatingSheet}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm disabled:opacity-50"
              >
                {creatingSheet ? 'Creating Sheet...' : 'Enable Google Sheets'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            className="rounded-lg shadow-lg p-4 flex items-center justify-between"
            style={{
              backgroundColor: teamColors.primary,
              border: `3px solid ${teamColors.secondary}`
            }}
          >
            <div className="flex items-center gap-4">
              {getTeamLogo(currentDynasty.teamName) && (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
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
              <div>
                <h2 className="text-xl font-bold" style={{ color: primaryBgText }}>
                  {currentRank && <span className="mr-2">#{currentRank}</span>}
                  {currentDynasty.teamName}
                </h2>
                <p className="text-sm font-semibold" style={{ color: primaryBgText, opacity: 0.8 }}>
                  {wins}-{losses}{currentDynasty.currentPhase !== 'preseason' && currentDynasty.conference && ` • ${currentDynasty.conference}`}
                </p>
              </div>
            </div>
            {currentDynasty.teamRatings && (
              <div className="flex items-center gap-3">
                <div className="text-center px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>OVR</div>
                  <div className="text-lg font-bold" style={{ color: secondaryBgText }}>{currentDynasty.teamRatings.overall}</div>
                </div>
                <div className="text-center px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>OFF</div>
                  <div className="text-lg font-bold" style={{ color: secondaryBgText }}>{currentDynasty.teamRatings.offense}</div>
                </div>
                <div className="text-center px-3 py-1 rounded" style={{ backgroundColor: teamColors.secondary }}>
                  <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>DEF</div>
                  <div className="text-lg font-bold" style={{ color: secondaryBgText }}>{currentDynasty.teamRatings.defense}</div>
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
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: secondaryBgText }}>
            Pre-Season Setup
          </h3>
          <div className="space-y-3">
            {[
              {
                num: 1,
                title: 'Enter Schedule & Roster',
                done: currentDynasty.preseasonSetup?.scheduleEntered && currentDynasty.preseasonSetup?.rosterEntered,
                scheduleCount: currentDynasty.schedule?.length || 0,
                playerCount: currentDynasty.players?.length || 0,
                action: () => setShowScheduleModal(true),
                actionText: (currentDynasty.preseasonSetup?.scheduleEntered && currentDynasty.preseasonSetup?.rosterEntered) ? 'Edit' : 'Add Data'
              },
              {
                num: 2,
                title: 'Enter Team Ratings',
                done: currentDynasty.preseasonSetup?.teamRatingsEntered,
                teamRatings: currentDynasty.teamRatings,
                action: () => setShowTeamRatingsModal(true),
                actionText: currentDynasty.preseasonSetup?.teamRatingsEntered ? 'Edit' : 'Add Ratings'
              },
              // Only show coaching staff task for Head Coaches
              ...(currentDynasty.coachPosition === 'HC' ? [{
                num: 3,
                title: 'Enter Coordinators',
                done: currentDynasty.preseasonSetup?.coachingStaffEntered,
                coachingStaff: currentDynasty.coachingStaff,
                action: () => setShowCoachingStaffModal(true),
                actionText: currentDynasty.preseasonSetup?.coachingStaffEntered ? 'Edit' : 'Add Staff'
              }] : [])
            ].map(item => {
              // Debug logging
              console.log('Preseason Setup Task:', {
                scheduleEntered: currentDynasty.preseasonSetup?.scheduleEntered,
                rosterEntered: currentDynasty.preseasonSetup?.rosterEntered,
                done: item.done,
                scheduleCount: item.scheduleCount,
                playerCount: item.playerCount
              })

              return (
              <div
                key={item.num}
                className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                  item.done ? 'border-green-200 bg-green-50' : ''
                }`}
                style={!item.done ? {
                  borderColor: `${teamColors.primary}30`,
                  backgroundColor: teamColors.secondary
                } : {}}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.done ? 'bg-green-500 text-white' : ''
                    }`}
                    style={!item.done ? {
                      backgroundColor: `${teamColors.primary}20`,
                      color: teamColors.primary
                    } : {}}
                  >
                    {item.done ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="font-bold text-lg">{item.num}</span>
                    )}
                  </div>
                  <div>
                    <div
                      className="font-semibold"
                      style={{ color: item.done ? '#16a34a' : secondaryBgText }}
                    >
                      {item.title}
                    </div>
                    {(item.scheduleCount > 0 || item.playerCount > 0) && (
                      <div
                        className="text-sm mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.scheduleCount}/12 games • {item.playerCount}/85 players
                        {item.done && <span className="ml-2">✓ Ready</span>}
                      </div>
                    )}
                    {item.teamRatings && (
                      <div
                        className="text-sm mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.teamRatings.overall ? `${item.teamRatings.overall} OVR • ${item.teamRatings.offense} OFF • ${item.teamRatings.defense} DEF` : 'Not entered'}
                        {item.done && <span className="ml-2">✓ Ready</span>}
                      </div>
                    )}
                    {item.coachingStaff !== undefined && (
                      <div
                        className="text-sm mt-1 font-medium"
                        style={{
                          color: item.done ? '#16a34a' : secondaryBgText,
                          opacity: item.done ? 1 : 0.7
                        }}
                      >
                        {item.coachingStaff?.ocName && item.coachingStaff?.dcName
                          ? `OC: ${item.coachingStaff.ocName} • DC: ${item.coachingStaff.dcName}`
                          : 'Not entered'}
                        {item.done && <span className="ml-2">✓ Ready</span>}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={item.action}
                  className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
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
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-xl font-bold mb-4" style={{ color: secondaryBgText }}>
            Conference Championship Week
          </h3>

          {(() => {
            const ccGame = getCCGame()

            // Step 1: Ask if they made the championship
            if (ccMadeChampionship === null) {
              return (
                <div className="space-y-4">
                  <p className="text-lg font-medium" style={{ color: secondaryBgText }}>
                    Did you make the {currentDynasty.conference} Championship?
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleCCAnswer(true)}
                      className="px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: primaryBgText
                      }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleCCAnswer(false)}
                      className="px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
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
                <div className="space-y-4">
                  <div
                    className="flex items-center gap-3 p-4 rounded-lg border-2 border-green-200 bg-green-50"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500 text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-green-700">
                        Conference Championship Week Complete
                      </div>
                    </div>
                  </div>

                  {/* Coordinator firing question for HC */}
                  {hasCoordinators && firingCoordinators === null && (
                    <div className="mt-4">
                      <p className="text-lg font-medium mb-3" style={{ color: secondaryBgText }}>
                        Are you firing any coordinators?
                      </p>
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleFiringAnswer(true)}
                          className="px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
                          style={{
                            backgroundColor: teamColors.primary,
                            color: primaryBgText
                          }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleFiringAnswer(false)}
                          className="px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
                          style={{
                            backgroundColor: teamColors.primary,
                            color: primaryBgText
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If firing, show dropdown */}
                  {hasCoordinators && firingCoordinators === true && !coordinatorToFire && (
                    <div className="mt-4">
                      <p className="text-lg font-medium mb-3" style={{ color: secondaryBgText }}>
                        Who are you firing?
                      </p>
                      <div className="flex flex-col gap-2">
                        {currentDynasty.coachingStaff?.ocName && (
                          <button
                            onClick={() => handleFireCoordinator('oc')}
                            className="w-full px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-left"
                            style={{
                              backgroundColor: teamColors.primary,
                              color: primaryBgText
                            }}
                          >
                            {currentDynasty.coachingStaff.ocName} (OC)
                          </button>
                        )}
                        {currentDynasty.coachingStaff?.dcName && (
                          <button
                            onClick={() => handleFireCoordinator('dc')}
                            className="w-full px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-left"
                            style={{
                              backgroundColor: teamColors.primary,
                              color: primaryBgText
                            }}
                          >
                            {currentDynasty.coachingStaff.dcName} (DC)
                          </button>
                        )}
                        {currentDynasty.coachingStaff?.ocName && currentDynasty.coachingStaff?.dcName && (
                          <button
                            onClick={() => handleFireCoordinator('both')}
                            className="w-full px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-left"
                            style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff'
                            }}
                          >
                            Both
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Show firing result */}
                  {hasCoordinators && firingCoordinators === true && coordinatorToFire && (
                    <div
                      className="mt-4 p-4 rounded-lg border-2"
                      style={{
                        backgroundColor: '#fef2f2',
                        borderColor: '#fca5a5'
                      }}
                    >
                      <p className="font-semibold text-red-700">
                        {coordinatorToFire === 'both' ? 'Fired both coordinators' :
                         coordinatorToFire === 'oc' ? `Fired ${currentDynasty.conferenceChampionshipData?.firedOCName || 'OC'}` :
                         `Fired ${currentDynasty.conferenceChampionshipData?.firedDCName || 'DC'}`}
                      </p>
                    </div>
                  )}

                  {/* Show not firing message */}
                  {hasCoordinators && firingCoordinators === false && (
                    <div
                      className="mt-4 p-4 rounded-lg border-2 border-green-200 bg-green-50"
                    >
                      <p className="font-semibold text-green-700">
                        Keeping current coordinators
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setCCMadeChampionship(null)}
                    className="text-sm underline hover:opacity-70"
                    style={{ color: secondaryBgText, opacity: 0.7 }}
                  >
                    Change answer
                  </button>
                </div>
              )
            }

            // Step 3: They made it - ask who they played (if no opponent yet)
            if (ccMadeChampionship === true && !ccOpponent && !ccGame) {
              return (
                <div className="space-y-4">
                  <p className="text-lg font-medium" style={{ color: secondaryBgText }}>
                    Congratulations! Who did you play in the {currentDynasty.conference} Championship?
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={ccOpponentSearch}
                      onChange={(e) => {
                        setCCOpponentSearch(e.target.value)
                        setShowCCOpponentDropdown(true)
                      }}
                      onFocus={() => setShowCCOpponentDropdown(true)}
                      onBlur={() => {
                        // Delay to allow click on dropdown items
                        setTimeout(() => setShowCCOpponentDropdown(false), 200)
                      }}
                      placeholder="Search for opponent..."
                      className="w-full px-4 py-3 rounded-lg border-2 font-semibold"
                      style={{
                        borderColor: teamColors.primary,
                        backgroundColor: 'white',
                        color: '#1f2937'
                      }}
                    />
                    {showCCOpponentDropdown && (
                      <div
                        className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto border-2"
                        style={{
                          backgroundColor: 'white',
                          borderColor: teamColors.primary
                        }}
                      >
                        {getFilteredTeams().map(([abbr, team]) => {
                          const teamColor = teamAbbreviations[abbr]
                          return (
                            <button
                              key={abbr}
                              onClick={() => handleCCOpponentSelect(abbr)}
                              className="w-full px-4 py-3 text-left hover:opacity-80 transition-opacity flex items-center gap-3"
                              style={{
                                backgroundColor: teamColor?.backgroundColor || '#f3f4f6',
                                color: teamColor?.textColor || '#1f2937'
                              }}
                            >
                              <span className="font-bold">{abbr}</span>
                              <span className="text-sm">{team.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setCCMadeChampionship(null)}
                    className="text-sm underline hover:opacity-70"
                    style={{ color: secondaryBgText, opacity: 0.7 }}
                  >
                    Change answer
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
                <div className="space-y-4">
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                      ccGame ? 'border-green-200 bg-green-50' : ''
                    }`}
                    style={!ccGame ? {
                      borderColor: `${teamColors.primary}30`,
                      backgroundColor: teamColors.secondary
                    } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          ccGame ? 'bg-green-500 text-white' : ''
                        }`}
                        style={!ccGame ? {
                          backgroundColor: `${teamColors.primary}20`,
                          color: teamColors.primary
                        } : {}}
                      >
                        {ccGame ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div
                          className="font-semibold"
                          style={{ color: ccGame ? '#16a34a' : secondaryBgText }}
                        >
                          {currentDynasty.conference} Championship
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm" style={{ color: ccGame ? '#16a34a' : secondaryBgText, opacity: 0.8 }}>
                            vs
                          </span>
                          {opponentLogo && (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
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
                            className="px-2 py-0.5 rounded text-sm font-bold"
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
                            className="text-sm mt-1 font-medium"
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
                      className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
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
                        {/* Coordinator firing question for HC */}
                        {hasCoordinators && firingCoordinators === null && (
                          <div className="mt-4">
                            <p className="text-lg font-medium mb-3" style={{ color: secondaryBgText }}>
                              Are you firing any coordinators?
                            </p>
                            <div className="flex gap-4">
                              <button
                                onClick={() => handleFiringAnswer(true)}
                                className="px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
                                style={{
                                  backgroundColor: teamColors.primary,
                                  color: primaryBgText
                                }}
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => handleFiringAnswer(false)}
                                className="px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
                                style={{
                                  backgroundColor: teamColors.primary,
                                  color: primaryBgText
                                }}
                              >
                                No
                              </button>
                            </div>
                          </div>
                        )}

                        {/* If firing, show dropdown */}
                        {hasCoordinators && firingCoordinators === true && !coordinatorToFire && (
                          <div className="mt-4">
                            <p className="text-lg font-medium mb-3" style={{ color: secondaryBgText }}>
                              Who are you firing?
                            </p>
                            <div className="flex flex-col gap-2">
                              {currentDynasty.coachingStaff?.ocName && (
                                <button
                                  onClick={() => handleFireCoordinator('oc')}
                                  className="w-full px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-left"
                                  style={{
                                    backgroundColor: teamColors.primary,
                                    color: primaryBgText
                                  }}
                                >
                                  {currentDynasty.coachingStaff.ocName} (OC)
                                </button>
                              )}
                              {currentDynasty.coachingStaff?.dcName && (
                                <button
                                  onClick={() => handleFireCoordinator('dc')}
                                  className="w-full px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-left"
                                  style={{
                                    backgroundColor: teamColors.primary,
                                    color: primaryBgText
                                  }}
                                >
                                  {currentDynasty.coachingStaff.dcName} (DC)
                                </button>
                              )}
                              {currentDynasty.coachingStaff?.ocName && currentDynasty.coachingStaff?.dcName && (
                                <button
                                  onClick={() => handleFireCoordinator('both')}
                                  className="w-full px-4 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors text-left"
                                  style={{
                                    backgroundColor: '#ef4444',
                                    color: '#ffffff'
                                  }}
                                >
                                  Both
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Show firing result */}
                        {hasCoordinators && firingCoordinators === true && coordinatorToFire && (
                          <div
                            className="mt-4 p-4 rounded-lg border-2"
                            style={{
                              backgroundColor: '#fef2f2',
                              borderColor: '#fca5a5'
                            }}
                          >
                            <p className="font-semibold text-red-700">
                              {coordinatorToFire === 'both' ? 'Fired both coordinators' :
                               coordinatorToFire === 'oc' ? `Fired ${currentDynasty.conferenceChampionshipData?.firedOCName || 'OC'}` :
                               `Fired ${currentDynasty.conferenceChampionshipData?.firedDCName || 'DC'}`}
                            </p>
                          </div>
                        )}

                        {/* Show not firing message */}
                        {hasCoordinators && firingCoordinators === false && (
                          <div
                            className="mt-4 p-4 rounded-lg border-2 border-green-200 bg-green-50"
                          >
                            <p className="font-semibold text-green-700">
                              Keeping current coordinators
                            </p>
                          </div>
                        )}

                        {/* Advance message - only show when firing decision is complete or not applicable */}
                        {(!hasCoordinators || firingCoordinators !== null) && (
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
                      className="text-sm underline hover:opacity-70"
                      style={{ color: secondaryBgText, opacity: 0.7 }}
                    >
                      Change opponent
                    </button>
                  )}
                </div>
              )
            }
          })()}
        </div>
      ) : currentDynasty.currentPhase === 'postseason' && currentDynasty.currentWeek === 1 && !currentDynasty.conferenceChampionships?.length ? (
        // Show CC Google Sheet when entering postseason and CC data not yet entered
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <h3 className="text-xl font-bold mb-4" style={{ color: secondaryBgText }}>
            Conference Championship Results
          </h3>
          <p className="mb-4" style={{ color: secondaryBgText, opacity: 0.8 }}>
            Before continuing to the playoffs, enter the results of all conference championship games.
          </p>

          <button
            onClick={() => setShowCCModal(true)}
            className="px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
            style={{
              backgroundColor: teamColors.primary,
              color: primaryBgText
            }}
          >
            Enter Conference Championships
          </button>
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
            Current Phase: {getPhaseDisplay(currentDynasty.currentPhase)}
          </h3>
          <p style={{ color: secondaryBgText, opacity: 0.8 }}>
            Click "Advance Week" in the header to progress through your dynasty.
          </p>

          {/* Show saved CC data if in postseason */}
          {currentDynasty.currentPhase === 'postseason' && (() => {
            const ccResults = currentDynasty.conferenceChampionships?.filter(cc => cc.team1 && cc.team2) || []
            const enteredCount = ccResults.length
            const isComplete = enteredCount >= 10

            return (
              <div className="mt-4">
                <div
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                    isComplete ? 'border-green-200 bg-green-50' : ''
                  }`}
                  style={!isComplete ? {
                    borderColor: `${teamColors.primary}30`,
                    backgroundColor: teamColors.secondary
                  } : {}}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isComplete ? 'bg-green-500 text-white' : ''
                      }`}
                      style={!isComplete ? {
                        backgroundColor: `${teamColors.primary}20`,
                        color: teamColors.primary
                      } : {}}
                    >
                      {isComplete ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div
                        className="font-semibold"
                        style={{ color: isComplete ? '#16a34a' : secondaryBgText }}
                      >
                        Conference Championship Results
                      </div>
                      <div
                        className="text-sm mt-1 font-medium"
                        style={{
                          color: isComplete ? '#16a34a' : secondaryBgText,
                          opacity: isComplete ? 1 : 0.7
                        }}
                      >
                        {enteredCount}/10 entered
                        {isComplete && <span className="ml-2">✓ Ready to advance</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCCModal(true)}
                    className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
                    style={{
                      backgroundColor: teamColors.primary,
                      color: primaryBgText
                    }}
                  >
                    {isComplete ? 'View' : 'Enter Results'}
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Schedule Section */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold" style={{ color: secondaryBgText }}>
            {currentDynasty.currentYear} Schedule
          </h2>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: secondaryBgText }}
            title="Edit Schedule"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${playedGame ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
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
                      setShowGameDetailModal(true)
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium w-16" style={{ color: opponentColors.textColor, opacity: 0.9 }}>
                      Week {game.week}
                    </div>
                    <div className="flex items-center gap-3">
                      {game.location === 'home' ? (
                        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{
                          backgroundColor: opponentColors.textColor,
                          color: opponentColors.backgroundColor
                        }}>
                          vs
                        </span>
                      ) : game.location === 'away' ? (
                        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{
                          backgroundColor: opponentColors.textColor,
                          color: opponentColors.backgroundColor
                        }}>
                          @
                        </span>
                      ) : (
                        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{
                          backgroundColor: opponentColors.textColor,
                          color: opponentColors.backgroundColor
                        }}>
                          vs
                        </span>
                      )}
                      {opponentLogo && (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${opponentColors.textColor}`,
                            padding: '3px'
                          }}
                        >
                          <img
                            src={opponentLogo}
                            alt={`${opponentName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {/* Opponent ranking if ranked */}
                        {playedGame?.opponentRank && (
                          <span className="text-xs font-bold" style={{ color: opponentColors.textColor, opacity: 0.7 }}>
                            #{playedGame.opponentRank}
                          </span>
                        )}
                        <span className="font-semibold" style={{ color: opponentColors.textColor }}>
                          {opponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  {playedGame ? (
                    <div className="flex items-center gap-4">
                      <div
                        className="text-lg font-bold px-3 py-1 rounded"
                        style={{
                          backgroundColor: playedGame.result === 'win' ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {playedGame.result === 'win' ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: opponentColors.textColor }}>
                          {playedGame.teamScore} - {playedGame.opponentScore}
                          {/* OT indicator if game went to overtime */}
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
                      className="text-sm font-bold px-3 py-1 rounded"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: getContrastTextColor(teamColors.primary)
                      }}
                    >
                      This Week
                    </div>
                  ) : (
                    <div className="text-sm font-medium" style={{ color: opponentColors.textColor, opacity: 0.7 }}>
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
              const ccMascotName = hasOpponent ? getMascotName(ccOpponentAbbr) : null
              const ccOpponentName = ccMascotName || (hasOpponent ? getTeamNameFromAbbr(ccOpponentAbbr) : 'Opponent Unknown')
              const ccOpponentLogo = ccMascotName ? getTeamLogo(ccMascotName) : null
              const isCurrentCCWeek = currentDynasty.currentPhase === 'conference_championship' && !ccGame

              return (
                <div
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${ccGame ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
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
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium w-16" style={{ color: hasOpponent ? ccOpponentColors.textColor : '#ffffff', opacity: 0.9 }}>
                      {currentDynasty.conference} CC
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold px-2 py-0.5 rounded" style={{
                        backgroundColor: hasOpponent ? ccOpponentColors.textColor : '#ffffff',
                        color: hasOpponent ? ccOpponentColors.backgroundColor : '#6b7280'
                      }}>
                        vs
                      </span>
                      {ccOpponentLogo && (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${ccOpponentColors.textColor}`,
                            padding: '3px'
                          }}
                        >
                          <img
                            src={ccOpponentLogo}
                            alt={`${ccOpponentName} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {/* Opponent ranking if ranked */}
                        {ccGame?.opponentRank && (
                          <span className="text-xs font-bold" style={{ color: ccOpponentColors.textColor, opacity: 0.7 }}>
                            #{ccGame.opponentRank}
                          </span>
                        )}
                        <span className="font-semibold" style={{ color: hasOpponent ? ccOpponentColors.textColor : '#ffffff', fontStyle: hasOpponent ? 'normal' : 'italic' }}>
                          {ccOpponentName}
                        </span>
                      </div>
                    </div>
                  </div>
                  {ccGame ? (
                    <div className="flex items-center gap-4">
                      <div
                        className="text-lg font-bold px-3 py-1 rounded"
                        style={{
                          backgroundColor: ccGame.result === 'win' ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {ccGame.result === 'win' ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: ccOpponentColors.textColor }}>
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
                      className="text-sm font-bold px-3 py-1 rounded"
                      style={{
                        backgroundColor: teamColors.primary,
                        color: getContrastTextColor(teamColors.primary)
                      }}
                    >
                      This Week
                    </div>
                  ) : (
                    <div className="text-sm font-medium" style={{ color: hasOpponent ? ccOpponentColors.textColor : '#ffffff', opacity: 0.7 }}>
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
        onRosterSave={handleRosterSave}
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
    </div>
  )
}
