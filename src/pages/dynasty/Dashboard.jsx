import { useState } from 'react'
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

export default function Dashboard() {
  const { currentDynasty, saveSchedule, saveRoster, saveTeamRatings, addGame, createGoogleSheetForDynasty } = useDynasty()
  const { user } = useAuth()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showTeamRatingsModal, setShowTeamRatingsModal] = useState(false)
  const [showGameModal, setShowGameModal] = useState(false)
  const [showGameDetailModal, setShowGameDetailModal] = useState(false)
  const [editingWeek, setEditingWeek] = useState(null)
  const [editingYear, setEditingYear] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [creatingSheet, setCreatingSheet] = useState(false)

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
    return (
      currentDynasty.preseasonSetup?.scheduleEntered &&
      currentDynasty.preseasonSetup?.rosterEntered &&
      currentDynasty.preseasonSetup?.teamRatingsEntered
    )
  }

  const getSeasonRecord = () => {
    const seasonGames = currentDynasty.games.filter(
      g => g.year === currentDynasty.currentYear
    )
    const wins = seasonGames.filter(g => g.result === 'win').length
    const losses = seasonGames.filter(g => g.result === 'loss').length
    return `${wins}-${losses}`
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

      {/* Current Season Record */}
      <div
        className="rounded-lg shadow-md p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `2px solid ${teamColors.primary}`
        }}
      >
        <div className="text-sm mb-1" style={{ color: secondaryBgText, opacity: 0.7 }}>
          Current Season Record
        </div>
        <div className="text-3xl font-bold" style={{ color: secondaryBgText }}>
          {getSeasonRecord()}
        </div>
        <div className="text-xs mt-1" style={{ color: secondaryBgText, opacity: 0.6 }}>
          {currentDynasty.currentYear} • {getPhaseDisplay(currentDynasty.currentPhase)}
        </div>
      </div>

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
              }
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
                    {playedGame ? 'View/Edit' : 'Enter Game'}
                  </button>
                </div>
              )
            })()}
          </div>
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
                      : opponentColors.backgroundColor
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
                      <div className="font-semibold" style={{ color: opponentColors.textColor }}>
                        {opponentName}
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
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-medium" style={{ color: opponentColors.textColor, opacity: 0.7 }}>
                      Scheduled
                    </div>
                  )}
                </div>
              )
            })}
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
    </div>
  )
}
