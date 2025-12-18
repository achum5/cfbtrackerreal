import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamConference } from '../../data/conferenceTeams'
import { getConferenceLogo } from '../../data/conferenceLogos'
import { getTeamLogo } from '../../data/teams'
import { bowlLogos } from '../../data/bowlLogos'
import GameDetailModal from '../../components/GameDetailModal'

// Map abbreviation to mascot name for logo lookup
const getMascotName = (abbr) => {
  const mascotMap = {
    'BAMA': 'Alabama Crimson Tide',
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
    'BC': 'Boston College Eagles',
    'BGSU': 'Bowling Green Falcons',
    'BOIS': 'Boise State Broncos',
    'BU': 'Baylor Bears',
    'BUFF': 'Buffalo Bulls',
    'BYU': 'Brigham Young Cougars',
    'CAL': 'California Golden Bears',
    'CCU': 'Coastal Carolina Chanticleers',
    'CHAR': 'Charlotte 49ers',
    'CINN': 'Cincinnati Bearcats',
    'CLEM': 'Clemson Tigers',
    'CMU': 'Central Michigan Chippewas',
    'COLO': 'Colorado Buffaloes',
    'CONN': 'Connecticut Huskies',
    'CSU': 'Colorado State Rams',
    'DEL': 'Delaware Fightin\' Blue Hens',
    'DUKE': 'Duke Blue Devils',
    'ECU': 'East Carolina Pirates',
    'EMU': 'Eastern Michigan Eagles',
    'FAU': 'Florida Atlantic Owls',
    'FIU': 'Florida International Panthers',
    'FLA': 'Florida Gators',
    'FRES': 'Fresno State Bulldogs',
    'FSU': 'Florida State Seminoles',
    'GASO': 'Georgia Southern Eagles',
    'GSU': 'Georgia State Panthers',
    'GT': 'Georgia Tech Yellow Jackets',
    'HAW': 'Hawaii Rainbow Warriors',
    'HOU': 'Houston Cougars',
    'ILL': 'Illinois Fighting Illini',
    'IU': 'Indiana Hoosiers',
    'IOWA': 'Iowa Hawkeyes',
    'ISU': 'Iowa State Cyclones',
    'JKST': 'Jacksonville State Gamecocks',
    'JMU': 'James Madison Dukes',
    'KENN': 'Kennesaw State Owls',
    'KENT': 'Kent State Golden Flashes',
    'KSU': 'Kansas State Wildcats',
    'KU': 'Kansas Jayhawks',
    'LIB': 'Liberty Flames',
    'LOU': 'Louisville Cardinals',
    'LSU': 'LSU Tigers',
    'LT': 'Louisiana Tech Bulldogs',
    'M-OH': 'Miami Redhawks',
    'MASS': 'Massachusetts Minutemen',
    'MEM': 'Memphis Tigers',
    'MIA': 'Miami Hurricanes',
    'MICH': 'Michigan Wolverines',
    'MINN': 'Minnesota Golden Gophers',
    'MISS': 'Ole Miss Rebels',
    'MIZ': 'Missouri Tigers',
    'MRSH': 'Marshall Thundering Herd',
    'MRYD': 'Maryland Terrapins',
    'MSST': 'Mississippi State Bulldogs',
    'MSU': 'Michigan State Spartans',
    'MTSU': 'Middle Tennessee State Blue Raiders',
    'MZST': 'Missouri State Bears',
    'NAVY': 'Navy Midshipmen',
    'NCST': 'North Carolina State Wolfpack',
    'ND': 'Notre Dame Fighting Irish',
    'NEB': 'Nebraska Cornhuskers',
    'NEV': 'Nevada Wolf Pack',
    'NIU': 'Northern Illinois Huskies',
    'NMSU': 'New Mexico State Aggies',
    'NU': 'Northwestern Wildcats',
    'ODU': 'Old Dominion Monarchs',
    'OHIO': 'Ohio Bobcats',
    'OHIO ST': 'Ohio State Buckeyes',
    'OKST': 'Oklahoma State Cowboys',
    'ORE': 'Oregon Ducks',
    'ORST': 'Oregon State Beavers',
    'OSU': 'Ohio State Buckeyes',
    'OU': 'Oklahoma Sooners',
    'PITT': 'Pittsburgh Panthers',
    'PSU': 'Penn State Nittany Lions',
    'PUR': 'Purdue Boilermakers',
    'RICE': 'Rice Owls',
    'RUTG': 'Rutgers Scarlet Knights',
    'SCAR': 'South Carolina Gamecocks',
    'SDSU': 'San Diego State Aztecs',
    'SHSU': 'Sam Houston State Bearkats',
    'SJSU': 'San Jose State Spartans',
    'SMU': 'SMU Mustangs',
    'STAN': 'Stanford Cardinal',
    'SYR': 'Syracuse Orange',
    'TAMU': 'Texas A&M Aggies',
    'TCU': 'TCU Horned Frogs',
    'TEM': 'Temple Owls',
    'TENN': 'Tennessee Volunteers',
    'TEX': 'Texas Longhorns',
    'TLNE': 'Tulane Green Wave',
    'TLSA': 'Tulsa Golden Hurricane',
    'TOL': 'Toledo Rockets',
    'TROY': 'Troy Trojans',
    'TTU': 'Texas Tech Red Raiders',
    'TULN': 'Tulane Green Wave',
    'TXAM': 'Texas A&M Aggies',
    'TXST': 'Texas State Bobcats',
    'UAB': 'UAB Blazers',
    'UC': 'Cincinnati Bearcats',
    'UCF': 'UCF Knights',
    'UCLA': 'UCLA Bruins',
    'UGA': 'Georgia Bulldogs',
    'UH': 'Houston Cougars',
    'UK': 'Kentucky Wildcats',
    'UL': 'Lafayette Ragin\' Cajuns',
    'ULL': 'Lafayette Ragin\' Cajuns',
    'ULM': 'Monroe Warhawks',
    'UMD': 'Maryland Terrapins',
    'UNC': 'North Carolina Tar Heels',
    'UNLV': 'UNLV Rebels',
    'UNM': 'New Mexico Lobos',
    'UNT': 'North Texas Mean Green',
    'USA': 'South Alabama Jaguars',
    'USC': 'USC Trojans',
    'USF': 'South Florida Bulls',
    'USM': 'Southern Mississippi Golden Eagles',
    'USU': 'Utah State Aggies',
    'UT': 'Tennessee Volunteers',
    'UTAH': 'Utah Utes',
    'UTEP': 'UTEP Miners',
    'UTSA': 'UTSA Roadrunners',
    'UVA': 'Virginia Cavaliers',
    'VAN': 'Vanderbilt Commodores',
    'VAND': 'Vanderbilt Commodores',
    'VT': 'Virginia Tech Hokies',
    'WAKE': 'Wake Forest Demon Deacons',
    'WASH': 'Washington Huskies',
    'WIS': 'Wisconsin Badgers',
    'WISC': 'Wisconsin Badgers',
    'WKU': 'Western Kentucky Hilltoppers',
    'WMU': 'Western Michigan Broncos',
    'WSU': 'Washington State Cougars',
    'WVU': 'West Virginia Mountaineers',
    'WYO': 'Wyoming Cowboys'
  }
  return mascotMap[abbr] || null
}

export default function TeamYear() {
  const { id, teamAbbr, year } = useParams()
  const navigate = useNavigate()
  const { currentDynasty } = useDynasty()
  const userTeamColors = useTeamColors(currentDynasty?.teamName)
  const selectedYear = parseInt(year)

  // Game detail modal state
  const [selectedGame, setSelectedGame] = useState(null)
  const [showGameDetailModal, setShowGameDetailModal] = useState(false)
  const [showCoachingStaffTooltip, setShowCoachingStaffTooltip] = useState(false)

  if (!currentDynasty) return null

  // Get all teams sorted alphabetically by mascot name
  const allTeams = Object.entries(teamAbbreviations)
    .map(([abbr, info]) => ({
      abbr,
      name: getMascotName(abbr) || info.name,
      sortName: (getMascotName(abbr) || info.name).toLowerCase()
    }))
    .sort((a, b) => a.sortName.localeCompare(b.sortName))

  // Get available years (from dynasty start year to current year)
  const availableYears = []
  for (let y = currentDynasty.startYear; y <= currentDynasty.currentYear; y++) {
    availableYears.push(y)
  }

  // Get team info
  const teamInfo = teamAbbreviations[teamAbbr]
  if (!teamInfo) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: userTeamColors.secondary,
            border: `3px solid ${userTeamColors.primary}`
          }}
        >
          <h1 className="text-2xl font-bold" style={{ color: userTeamColors.primary }}>
            Team Not Found
          </h1>
          <Link
            to={`/dynasty/${id}/teams`}
            className="inline-block mt-4 px-4 py-2 rounded-lg font-semibold"
            style={{
              backgroundColor: userTeamColors.primary,
              color: getContrastTextColor(userTeamColors.primary)
            }}
          >
            Back to Teams
          </Link>
        </div>
      </div>
    )
  }

  const conference = getTeamConference(teamAbbr)
  const conferenceLogo = conference ? getConferenceLogo(conference) : null
  const mascotName = getMascotName(teamAbbr)
  const teamLogo = mascotName ? getTeamLogo(mascotName) : null
  const teamBgText = getContrastTextColor(teamInfo.backgroundColor)
  const teamPrimaryText = getContrastTextColor(teamInfo.textColor)
  const secondaryBgText = getContrastTextColor(userTeamColors.secondary)

  // Check if this is the user's team
  const userTeamAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
  const isUserTeam = teamAbbr === userTeamAbbr

  // Get games against this team for this specific year (user's games vs this opponent)
  const vsUserGames = (currentDynasty.games || [])
    .filter(g => g.opponent === teamAbbr && g.year === selectedYear)
    .sort((a, b) => a.week - b.week)

  // Get user's team record for this year (if viewing user's team page)
  const userYearGames = isUserTeam
    ? (currentDynasty.games || []).filter(g => g.year === selectedYear).sort((a, b) => a.week - b.week)
    : []
  // Check for both 'win'/'loss' and 'W'/'L' formats
  const userWins = userYearGames.filter(g => g.result === 'win' || g.result === 'W').length
  const userLosses = userYearGames.filter(g => g.result === 'loss' || g.result === 'L').length

  // Get conference championship data for this team in this year
  const yearChampionships = currentDynasty.conferenceChampionshipsByYear?.[selectedYear] || []
  const teamCCGame = yearChampionships.find(cc =>
    (cc.team1 === teamAbbr || cc.team2 === teamAbbr) && cc.team1Score !== null && cc.team2Score !== null
  )
  const wonCC = teamCCGame?.winner === teamAbbr

  // Get bowl game for this team in this year
  // bowlGamesByYear[year] is an object with week1 and week2 arrays
  const yearBowlData = currentDynasty.bowlGamesByYear?.[selectedYear] || {}
  const bowlGames = [...(yearBowlData.week1 || []), ...(yearBowlData.week2 || [])]
  const teamBowlGame = bowlGames.find(bowl =>
    (bowl.team1 === teamAbbr || bowl.team2 === teamAbbr) && bowl.team1Score !== null && bowl.team2Score !== null
  )
  const wonBowl = teamBowlGame && (
    (teamBowlGame.team1 === teamAbbr && teamBowlGame.team1Score > teamBowlGame.team2Score) ||
    (teamBowlGame.team2 === teamAbbr && teamBowlGame.team2Score > teamBowlGame.team1Score)
  )

  // Get CFP games for this team in this year
  const cfpGames = currentDynasty.cfpGamesByYear?.[selectedYear] || []
  const teamCFPGames = cfpGames.filter(game =>
    (game.team1 === teamAbbr || game.team2 === teamAbbr) && game.team1Score !== null && game.team2Score !== null
  ).sort((a, b) => (a.round || 0) - (b.round || 0))

  // Find players associated with this team
  // 1. Current players on this team (if user's team matches)
  // 2. Players who transferred from this team
  // 3. Players with yearStarted matching this year from this team
  const teamPlayers = (currentDynasty.players || []).filter(p => {
    // If this is the user's team, show current roster for that year
    if (isUserTeam) {
      // Show players who were on roster during this year
      const playerStartYear = p.yearStarted || currentDynasty.startYear
      const playerEndYear = p.yearDeparted || currentDynasty.currentYear
      return selectedYear >= playerStartYear && selectedYear <= playerEndYear
    }
    // For other teams, show players who transferred from this team
    return p.previousTeam === teamAbbr || p.previousTeam === mascotName
  })

  // Calculate vs user record
  const vsUserWins = vsUserGames.filter(g => g.result === 'W').length
  const vsUserLosses = vsUserGames.filter(g => g.result === 'L').length

  // Build unified game list for non-user teams
  // Includes: games vs user, CC game, bowl game, CFP games
  const buildTeamGameLog = () => {
    const allGames = []

    // Add games vs user (regular season games)
    vsUserGames.forEach(game => {
      const userAbbr = getAbbreviationFromDisplayName(currentDynasty.teamName)
      const userWon = game.result === 'win' || game.result === 'W'
      allGames.push({
        type: 'regular',
        week: game.week,
        opponent: userAbbr,
        opponentRank: game.userRank,
        thisTeamWon: !userWon,
        thisTeamScore: game.opponentScore,
        opponentScore: game.teamScore,
        location: game.location === 'home' ? 'away' : game.location === 'away' ? 'home' : 'neutral',
        overtimes: game.overtimes,
        originalGame: game,
        sortOrder: game.week
      })
    })

    // Add conference championship game
    if (teamCCGame) {
      const isTeam1 = teamCCGame.team1 === teamAbbr
      const opponent = isTeam1 ? teamCCGame.team2 : teamCCGame.team1
      const thisTeamScore = isTeam1 ? teamCCGame.team1Score : teamCCGame.team2Score
      const oppScore = isTeam1 ? teamCCGame.team2Score : teamCCGame.team1Score
      allGames.push({
        type: 'cc',
        week: 'CCG',
        conference: teamCCGame.conference,
        opponent: opponent,
        opponentRank: null,
        thisTeamWon: wonCC,
        thisTeamScore: thisTeamScore,
        opponentScore: oppScore,
        location: 'neutral',
        sortOrder: 100,
        // Create game object for modal (from this team's perspective)
        gameForModal: {
          opponent: opponent,
          teamScore: thisTeamScore,
          opponentScore: oppScore,
          result: wonCC ? 'win' : 'loss',
          year: selectedYear,
          week: 'CCG',
          location: 'neutral',
          isConferenceChampionship: true,
          gameTitle: `${teamCCGame.conference} Championship Game`,
          // For CPU vs CPU games, specify the viewing team
          viewingTeam: mascotName || teamInfo.name,
          viewingTeamAbbr: teamAbbr
        }
      })
    }

    // Add CFP games
    teamCFPGames.forEach((game, idx) => {
      const isTeam1 = game.team1 === teamAbbr
      const opponent = isTeam1 ? game.team2 : game.team1
      const thisTeamWon = (isTeam1 && game.team1Score > game.team2Score) ||
                          (!isTeam1 && game.team2Score > game.team1Score)
      const roundNames = { 1: 'CFP R1', 2: 'CFP QF', 3: 'CFP SF', 4: 'Natty' }
      const roundFullNames = { 1: 'First Round', 2: 'Quarterfinal', 3: 'Semifinal', 4: 'National Championship' }
      const thisTeamScore = isTeam1 ? game.team1Score : game.team2Score
      const oppScore = isTeam1 ? game.team2Score : game.team1Score
      allGames.push({
        type: 'cfp',
        week: roundNames[game.round] || `CFP ${game.round}`,
        round: game.round,
        opponent: opponent,
        opponentRank: null,
        thisTeamWon: thisTeamWon,
        thisTeamScore: thisTeamScore,
        opponentScore: oppScore,
        location: 'neutral',
        sortOrder: 100 + (game.round || idx),
        gameForModal: {
          opponent: opponent,
          teamScore: thisTeamScore,
          opponentScore: oppScore,
          result: thisTeamWon ? 'win' : 'loss',
          year: selectedYear,
          week: roundNames[game.round] || `CFP ${game.round}`,
          location: 'neutral',
          isPlayoff: true,
          gameTitle: `College Football Playoff - ${roundFullNames[game.round] || `Round ${game.round}`}`,
          viewingTeam: mascotName || teamInfo.name,
          viewingTeamAbbr: teamAbbr
        }
      })
    })

    // Add bowl game
    if (teamBowlGame) {
      const isTeam1 = teamBowlGame.team1 === teamAbbr
      const opponent = isTeam1 ? teamBowlGame.team2 : teamBowlGame.team1
      const thisTeamScore = isTeam1 ? teamBowlGame.team1Score : teamBowlGame.team2Score
      const oppScore = isTeam1 ? teamBowlGame.team2Score : teamBowlGame.team1Score
      allGames.push({
        type: 'bowl',
        week: 'Bowl',
        bowlName: teamBowlGame.bowlName,
        opponent: opponent,
        opponentRank: null,
        thisTeamWon: wonBowl,
        thisTeamScore: thisTeamScore,
        opponentScore: oppScore,
        location: 'neutral',
        sortOrder: 200,
        gameForModal: {
          opponent: opponent,
          teamScore: thisTeamScore,
          opponentScore: oppScore,
          result: wonBowl ? 'win' : 'loss',
          year: selectedYear,
          week: 'Bowl',
          location: 'neutral',
          isBowlGame: true,
          gameTitle: teamBowlGame.bowlName || 'Bowl Game',
          viewingTeam: mascotName || teamInfo.name,
          viewingTeamAbbr: teamAbbr
        }
      })
    }

    // Sort by sortOrder
    return allGames.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const teamGameLog = !isUserTeam ? buildTeamGameLog() : []

  return (
    <div className="space-y-6">
      {/* Navigation Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Back Link */}
        <Link
          to={`/dynasty/${id}/team/${teamAbbr}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            color: teamInfo.textColor
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {mascotName || teamAbbr} History
        </Link>

        <div className="flex items-center gap-2 ml-auto">
          {/* Team Dropdown */}
          <select
            value={teamAbbr}
            onChange={(e) => navigate(`/dynasty/${id}/team/${e.target.value}/${selectedYear}`)}
            className="px-3 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2"
            style={{
              backgroundColor: teamInfo.backgroundColor,
              color: teamBgText,
              border: `2px solid ${teamBgText}40`
            }}
          >
            {allTeams.map((team) => (
              <option key={team.abbr} value={team.abbr}>
                {team.name}
              </option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => navigate(`/dynasty/${id}/team/${teamAbbr}/${e.target.value}`)}
            className="px-3 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2"
            style={{
              backgroundColor: teamInfo.backgroundColor,
              color: teamBgText,
              border: `2px solid ${teamBgText}40`
            }}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Team Header */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamInfo.backgroundColor,
          border: `3px solid ${teamInfo.textColor}`
        }}
      >
        <div className="flex items-center gap-4">
          {teamLogo && (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: '#FFFFFF',
                border: `3px solid ${teamInfo.textColor}`,
                padding: '4px'
              }}
            >
              <img
                src={teamLogo}
                alt={`${teamInfo.name} logo`}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
              {selectedYear} Season
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: teamBgText }}>
                {mascotName || teamInfo.name}
              </h1>
              {/* Coaching Staff Info Icon - only for user's team in current year */}
              {isUserTeam && selectedYear === currentDynasty.currentYear && (currentDynasty.coachName || currentDynasty.coachingStaff?.ocName || currentDynasty.coachingStaff?.dcName) && (
                <div className="relative">
                  <button
                    onClick={() => setShowCoachingStaffTooltip(!showCoachingStaffTooltip)}
                    onMouseEnter={() => setShowCoachingStaffTooltip(true)}
                    onMouseLeave={() => setShowCoachingStaffTooltip(false)}
                    className="w-5 h-5 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: `${teamBgText}20`,
                      color: teamBgText
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {/* Coaching Staff Tooltip */}
                  {showCoachingStaffTooltip && (
                    <div
                      className="absolute left-0 top-full mt-2 p-3 rounded-lg shadow-lg z-50 min-w-48"
                      style={{
                        backgroundColor: teamInfo.textColor,
                        border: `2px solid ${teamBgText}40`
                      }}
                      onMouseEnter={() => setShowCoachingStaffTooltip(true)}
                      onMouseLeave={() => setShowCoachingStaffTooltip(false)}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: teamPrimaryText, opacity: 0.7 }}>
                        Coaching Staff
                      </div>
                      <div className="space-y-1">
                        {/* Show user as their position */}
                        {currentDynasty.coachPosition === 'HC' && currentDynasty.coachName && (
                          <div className="text-sm font-semibold flex items-center gap-2" style={{ color: teamPrimaryText }}>
                            <span>HC:</span>
                            <span>{currentDynasty.coachName}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: teamInfo.backgroundColor, color: teamBgText }}>(You)</span>
                          </div>
                        )}
                        {currentDynasty.coachPosition === 'OC' && currentDynasty.coachName && (
                          <div className="text-sm font-semibold flex items-center gap-2" style={{ color: teamPrimaryText }}>
                            <span>OC:</span>
                            <span>{currentDynasty.coachName}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: teamInfo.backgroundColor, color: teamBgText }}>(You)</span>
                          </div>
                        )}
                        {currentDynasty.coachPosition === 'DC' && currentDynasty.coachName && (
                          <div className="text-sm font-semibold flex items-center gap-2" style={{ color: teamPrimaryText }}>
                            <span>DC:</span>
                            <span>{currentDynasty.coachName}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: teamInfo.backgroundColor, color: teamBgText }}>(You)</span>
                          </div>
                        )}
                        {/* Show other coaches from coachingStaff */}
                        {currentDynasty.coachingStaff?.hcName && currentDynasty.coachPosition !== 'HC' && (
                          <div className="text-sm font-semibold" style={{ color: teamPrimaryText }}>
                            HC: {currentDynasty.coachingStaff.hcName}
                          </div>
                        )}
                        {currentDynasty.coachingStaff?.ocName && currentDynasty.coachPosition !== 'OC' && (
                          <div className="text-sm font-semibold" style={{ color: teamPrimaryText }}>
                            OC: {currentDynasty.coachingStaff.ocName}
                          </div>
                        )}
                        {currentDynasty.coachingStaff?.dcName && currentDynasty.coachPosition !== 'DC' && (
                          <div className="text-sm font-semibold" style={{ color: teamPrimaryText }}>
                            DC: {currentDynasty.coachingStaff.dcName}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {conference && (
              <div className="flex items-center gap-2 mt-1">
                {conferenceLogo && (
                  <img
                    src={conferenceLogo}
                    alt={`${conference} logo`}
                    className="w-5 h-5 object-contain"
                  />
                )}
                <span className="text-sm font-semibold" style={{ color: teamBgText, opacity: 0.8 }}>
                  {conference}
                </span>
              </div>
            )}
            {/* Conference Championship Badge */}
            {teamCCGame && (
              <div
                className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: wonCC ? '#fbbf24' : '#9ca3af',
                  color: wonCC ? '#78350f' : '#1f2937'
                }}
              >
                {wonCC ? '🏆' : '🥈'} {teamCCGame.conference} {wonCC ? 'Champions' : 'Runner-Up'}
              </div>
            )}
            {/* Bowl Game Badge */}
            {teamBowlGame && (
              <button
                onClick={() => {
                  const isTeam1 = teamBowlGame.team1 === teamAbbr
                  const opponent = isTeam1 ? teamBowlGame.team2 : teamBowlGame.team1
                  const thisTeamScore = isTeam1 ? teamBowlGame.team1Score : teamBowlGame.team2Score
                  const oppScore = isTeam1 ? teamBowlGame.team2Score : teamBowlGame.team1Score
                  setSelectedGame({
                    opponent: opponent,
                    teamScore: thisTeamScore,
                    opponentScore: oppScore,
                    result: wonBowl ? 'win' : 'loss',
                    year: selectedYear,
                    week: 'Bowl',
                    location: 'neutral',
                    isBowlGame: true,
                    gameTitle: teamBowlGame.bowlName || 'Bowl Game',
                    viewingTeam: mascotName || teamInfo.name,
                    viewingTeamAbbr: teamAbbr
                  })
                  setShowGameDetailModal(true)
                }}
                className="inline-flex items-center gap-1.5 mt-2 ml-2 px-3 py-1 rounded-full text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                style={{
                  backgroundColor: wonBowl ? '#16a34a' : '#dc2626',
                  color: '#ffffff'
                }}
              >
                {bowlLogos[teamBowlGame.bowlName] && (
                  <img
                    src={bowlLogos[teamBowlGame.bowlName]}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                )}
                {teamBowlGame.bowlName || 'Bowl Game'}{wonBowl ? ' Champion' : ''}
              </button>
            )}
          </div>

          {/* Season Record (if user's team) */}
          {isUserTeam && userYearGames.length > 0 && (
            <div className="text-right">
              <div
                className="text-3xl md:text-4xl font-bold"
                style={{ color: teamBgText }}
              >
                {userWins}-{userLosses}
              </div>
              <div className="text-sm font-semibold" style={{ color: teamBgText, opacity: 0.7 }}>
                Record
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game Log (if user's team) - Exact Dashboard Style */}
      {isUserTeam && userYearGames.length > 0 && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            border: `3px solid ${teamInfo.textColor}`
          }}
        >
          <div
            className="px-4 py-3"
            style={{ backgroundColor: teamInfo.textColor }}
          >
            <h2 className="text-lg font-bold" style={{ color: teamInfo.backgroundColor }}>
              {selectedYear} Schedule
            </h2>
          </div>

          <div className="space-y-2 p-4">
            {userYearGames.map((game, index) => {
              const oppMascot = getMascotName(game.opponent)
              const oppLogo = oppMascot ? getTeamLogo(oppMascot) : null
              const oppColors = teamAbbreviations[game.opponent] || { backgroundColor: '#6b7280', textColor: '#ffffff' }
              const isWin = game.result === 'win' || game.result === 'W'
              const isLoss = game.result === 'loss' || game.result === 'L'
              const hasResult = isWin || isLoss

              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${hasResult ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                  style={{
                    backgroundColor: oppColors.backgroundColor,
                    borderColor: isWin ? '#86efac' : isLoss ? '#fca5a5' : oppColors.backgroundColor
                  }}
                  onClick={() => {
                    if (hasResult) {
                      setSelectedGame(game)
                      setShowGameDetailModal(true)
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium w-16" style={{ color: oppColors.textColor, opacity: 0.9 }}>
                      {game.isBowlGame ? 'Bowl' : game.isPlayoff ? 'CFP' : game.isConferenceChampionship ? 'CCG' : `Week ${game.week}`}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-sm font-bold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: oppColors.textColor,
                          color: oppColors.backgroundColor
                        }}
                      >
                        {game.location === 'away' ? '@' : 'vs'}
                      </span>
                      {oppLogo && (
                        <Link
                          to={`/dynasty/${id}/team/${game.opponent}/${selectedYear}`}
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${oppColors.textColor}`,
                            padding: '3px'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <img
                            src={oppLogo}
                            alt={`${oppMascot} logo`}
                            className="w-full h-full object-contain"
                          />
                        </Link>
                      )}
                      <div className="flex items-center gap-2">
                        {game.opponentRank && (
                          <span className="text-xs font-bold" style={{ color: oppColors.textColor, opacity: 0.7 }}>
                            #{game.opponentRank}
                          </span>
                        )}
                        <Link
                          to={`/dynasty/${id}/team/${game.opponent}/${selectedYear}`}
                          className="font-semibold hover:underline"
                          style={{ color: oppColors.textColor }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {oppMascot || game.opponent}
                        </Link>
                      </div>
                    </div>
                  </div>
                  {hasResult ? (
                    <div className="flex items-center gap-4">
                      <div
                        className="text-lg font-bold px-3 py-1 rounded"
                        style={{
                          backgroundColor: isWin ? '#22c55e' : '#ef4444',
                          color: '#ffffff'
                        }}
                      >
                        {isWin ? 'W' : 'L'}
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: oppColors.textColor }}>
                          {game.teamScore} - {game.opponentScore}
                          {game.overtimes && game.overtimes.length > 0 && (
                            <span className="ml-1 text-xs opacity-80">
                              {game.overtimes.length > 1 ? `${game.overtimes.length}OT` : 'OT'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-medium" style={{ color: oppColors.textColor, opacity: 0.7 }}>
                      Scheduled
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Conference Championship Game - only for user's team (non-user teams show in unified game log) */}
      {isUserTeam && teamCCGame && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: userTeamColors.secondary,
            border: `3px solid ${wonCC ? '#16a34a' : '#dc2626'}`
          }}
        >
          <div
            className="px-4 py-3"
            style={{ backgroundColor: wonCC ? '#16a34a' : '#dc2626' }}
          >
            <h2 className="text-lg font-bold text-white">
              {teamCCGame.conference} Championship {wonCC ? '- CHAMPION' : ''}
            </h2>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-4">
              <span
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: wonCC ? '#16a34a' : '#dc2626',
                  color: '#FFFFFF'
                }}
              >
                {wonCC ? 'WIN' : 'LOSS'}
              </span>
              <span className="text-xl font-bold" style={{ color: secondaryBgText }}>
                {teamCCGame.team1 === teamAbbr
                  ? `${teamCCGame.team1Score} - ${teamCCGame.team2Score}`
                  : `${teamCCGame.team2Score} - ${teamCCGame.team1Score}`}
              </span>
              <span className="text-sm" style={{ color: secondaryBgText, opacity: 0.8 }}>
                vs {teamCCGame.team1 === teamAbbr ? teamCCGame.team2 : teamCCGame.team1}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CFP Games - only for user's team */}
      {isUserTeam && teamCFPGames.length > 0 && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: userTeamColors.secondary,
            border: `3px solid ${userTeamColors.primary}`
          }}
        >
          <div
            className="px-4 py-3"
            style={{ backgroundColor: userTeamColors.primary }}
          >
            <h2 className="text-lg font-bold" style={{ color: getContrastTextColor(userTeamColors.primary) }}>
              College Football Playoff
            </h2>
          </div>

          <div className="divide-y" style={{ borderColor: `${userTeamColors.primary}30` }}>
            {teamCFPGames.map((game, index) => {
              const teamWon = (game.team1 === teamAbbr && game.team1Score > game.team2Score) ||
                             (game.team2 === teamAbbr && game.team2Score > game.team1Score)
              const roundNames = { 1: 'First Round', 2: 'Quarterfinal', 3: 'Semifinal', 4: 'National Championship' }

              return (
                <div key={index} className="p-4">
                  <div className="flex items-center gap-4">
                    <span
                      className="px-3 py-1 rounded-full text-sm font-bold"
                      style={{
                        backgroundColor: teamWon ? '#16a34a' : '#dc2626',
                        color: '#FFFFFF'
                      }}
                    >
                      {teamWon ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-xl font-bold" style={{ color: secondaryBgText }}>
                      {game.team1 === teamAbbr
                        ? `${game.team1Score} - ${game.team2Score}`
                        : `${game.team2Score} - ${game.team1Score}`}
                    </span>
                    <span className="text-sm" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      vs {game.team1 === teamAbbr ? game.team2 : game.team1}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded"
                      style={{ backgroundColor: `${userTeamColors.primary}20`, color: userTeamColors.primary }}
                    >
                      {roundNames[game.round] || `Round ${game.round}`}
                    </span>
                    {game.round === 4 && teamWon && (
                      <span className="text-sm font-bold text-yellow-600">NATIONAL CHAMPION</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bowl Game - only for user's team */}
      {isUserTeam && teamBowlGame && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: userTeamColors.secondary,
            border: `3px solid ${wonBowl ? '#16a34a' : '#dc2626'}`
          }}
        >
          <div
            className="px-4 py-3"
            style={{ backgroundColor: wonBowl ? '#16a34a' : '#dc2626' }}
          >
            <h2 className="text-lg font-bold text-white">
              {teamBowlGame.bowlName || 'Bowl Game'}{wonBowl ? ' Champion' : ''}
            </h2>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-4">
              <span
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: wonBowl ? '#16a34a' : '#dc2626',
                  color: '#FFFFFF'
                }}
              >
                {wonBowl ? 'WIN' : 'LOSS'}
              </span>
              <span className="text-xl font-bold" style={{ color: secondaryBgText }}>
                {teamBowlGame.team1 === teamAbbr
                  ? `${teamBowlGame.team1Score} - ${teamBowlGame.team2Score}`
                  : `${teamBowlGame.team2Score} - ${teamBowlGame.team1Score}`}
              </span>
              <span className="text-sm" style={{ color: secondaryBgText, opacity: 0.8 }}>
                vs {teamBowlGame.team1 === teamAbbr ? teamBowlGame.team2 : teamBowlGame.team1}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Game Log for non-user teams - unified view of all games */}
      {!isUserTeam && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            border: `3px solid ${teamInfo.textColor}`
          }}
        >
          <div
            className="px-4 py-3"
            style={{ backgroundColor: teamInfo.textColor }}
          >
            <h2 className="text-lg font-bold" style={{ color: teamInfo.backgroundColor }}>
              {selectedYear} Game Log
            </h2>
          </div>

          <div className="p-4">
            {teamGameLog.length > 0 ? (
              <div className="space-y-2">
                {teamGameLog.map((game, index) => {
                  const oppMascot = getMascotName(game.opponent)
                  const oppLogo = oppMascot ? getTeamLogo(oppMascot) : null
                  const oppColors = teamAbbreviations[game.opponent] || { backgroundColor: '#6b7280', textColor: '#ffffff' }

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{
                        backgroundColor: oppColors.backgroundColor,
                        borderColor: game.thisTeamWon ? '#86efac' : '#fca5a5'
                      }}
                      onClick={() => {
                        // Open modal for any game with data
                        if (game.originalGame) {
                          setSelectedGame(game.originalGame)
                          setShowGameDetailModal(true)
                        } else if (game.gameForModal) {
                          setSelectedGame(game.gameForModal)
                          setShowGameDetailModal(true)
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium w-16" style={{ color: oppColors.textColor, opacity: 0.9 }}>
                          {typeof game.week === 'number' ? `Week ${game.week}` : game.week}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className="text-sm font-bold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: oppColors.textColor,
                              color: oppColors.backgroundColor
                            }}
                          >
                            {game.location === 'away' ? '@' : 'vs'}
                          </span>
                          {oppLogo && (
                            <Link
                              to={`/dynasty/${id}/team/${game.opponent}/${selectedYear}`}
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: `2px solid ${oppColors.textColor}`,
                                padding: '3px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={oppLogo}
                                alt={`${oppMascot} logo`}
                                className="w-full h-full object-contain"
                              />
                            </Link>
                          )}
                          <div className="flex items-center gap-2">
                            {game.opponentRank && (
                              <span className="text-xs font-bold" style={{ color: oppColors.textColor, opacity: 0.7 }}>
                                #{game.opponentRank}
                              </span>
                            )}
                            <Link
                              to={`/dynasty/${id}/team/${game.opponent}/${selectedYear}`}
                              className="font-semibold hover:underline"
                              style={{ color: oppColors.textColor }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {oppMascot || game.opponent}
                            </Link>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div
                          className="text-lg font-bold px-3 py-1 rounded"
                          style={{
                            backgroundColor: game.thisTeamWon ? '#22c55e' : '#ef4444',
                            color: '#ffffff'
                          }}
                        >
                          {game.thisTeamWon ? 'W' : 'L'}
                        </div>
                        <div className="text-right">
                          <div className="font-bold" style={{ color: oppColors.textColor }}>
                            {game.thisTeamScore} - {game.opponentScore}
                            {game.overtimes && game.overtimes.length > 0 && (
                              <span className="ml-1 text-xs opacity-80">
                                {game.overtimes.length > 1 ? `${game.overtimes.length}OT` : 'OT'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center py-4" style={{ color: teamBgText, opacity: 0.7 }}>
                No games recorded for {selectedYear}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Players */}
      {teamPlayers.length > 0 && (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: isUserTeam ? teamInfo.backgroundColor : userTeamColors.secondary,
            border: `3px solid ${isUserTeam ? teamInfo.textColor : userTeamColors.primary}`
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: isUserTeam ? teamInfo.textColor : userTeamColors.primary }}
          >
            <h2 className="text-lg font-bold" style={{ color: isUserTeam ? teamPrimaryText : getContrastTextColor(userTeamColors.primary) }}>
              {isUserTeam ? `${selectedYear} Roster` : `Players from ${mascotName || teamAbbr}`}
            </h2>
            <span
              className="text-sm font-semibold px-2 py-1 rounded"
              style={{
                backgroundColor: isUserTeam ? teamInfo.backgroundColor : userTeamColors.secondary,
                color: isUserTeam ? teamBgText : secondaryBgText
              }}
            >
              {teamPlayers.length} Players
            </span>
          </div>

          <div className="p-4">
            {isUserTeam ? (
              // Full roster table for user's team
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${teamInfo.textColor}40` }}>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: teamBgText }}>#</th>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: teamBgText }}>Name</th>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: teamBgText }}>Pos</th>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: teamBgText }}>Year</th>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: teamBgText }}>OVR</th>
                      <th className="text-left py-2 px-2 font-semibold hidden sm:table-cell" style={{ color: teamBgText }}>Dev</th>
                      <th className="text-left py-2 px-2 font-semibold hidden md:table-cell" style={{ color: teamBgText }}>Archetype</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPlayers
                      .sort((a, b) => {
                        // Sort by position group, then by overall
                        const posOrder = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS', 'K', 'P']
                        const aPos = posOrder.indexOf(a.position)
                        const bPos = posOrder.indexOf(b.position)
                        if (aPos !== bPos) return aPos - bPos
                        return (b.overall || 0) - (a.overall || 0)
                      })
                      .map((player) => (
                        <tr
                          key={player.pid}
                          className="hover:opacity-80 cursor-pointer"
                          style={{ borderBottom: `1px solid ${teamInfo.textColor}20` }}
                          onClick={() => window.location.href = `/dynasty/${id}/player/${player.pid}`}
                        >
                          <td className="py-2 px-2 font-bold" style={{ color: teamBgText }}>
                            {player.jerseyNumber || '-'}
                          </td>
                          <td className="py-2 px-2">
                            <Link
                              to={`/dynasty/${id}/player/${player.pid}`}
                              className="font-semibold hover:underline"
                              style={{ color: teamBgText }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {player.name}
                            </Link>
                          </td>
                          <td className="py-2 px-2 font-semibold" style={{ color: teamBgText }}>
                            {player.position}
                          </td>
                          <td className="py-2 px-2" style={{ color: teamBgText }}>
                            {player.year}
                          </td>
                          <td className="py-2 px-2 font-bold" style={{ color: teamBgText }}>
                            {player.overall}
                          </td>
                          <td className="py-2 px-2 hidden sm:table-cell" style={{ color: teamBgText, opacity: 0.8 }}>
                            {player.devTrait || '-'}
                          </td>
                          <td className="py-2 px-2 hidden md:table-cell" style={{ color: teamBgText, opacity: 0.8 }}>
                            {player.archetype || '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Grid view for transfers from other teams
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {teamPlayers.map((player) => (
                  <Link
                    key={player.pid}
                    to={`/dynasty/${id}/player/${player.pid}`}
                    className="flex items-center gap-3 p-2 rounded hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: `${userTeamColors.primary}10` }}
                  >
                    {player.jerseyNumber && (
                      <span
                        className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
                        style={{ backgroundColor: userTeamColors.primary, color: getContrastTextColor(userTeamColors.primary) }}
                      >
                        {player.jerseyNumber}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate" style={{ color: secondaryBgText }}>
                        {player.name}
                      </div>
                      <div className="text-xs" style={{ color: secondaryBgText, opacity: 0.7 }}>
                        {player.position} • {player.overall} OVR • Transfer
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Detail Modal */}
      <GameDetailModal
        isOpen={showGameDetailModal}
        onClose={() => {
          setShowGameDetailModal(false)
          setSelectedGame(null)
        }}
        game={selectedGame}
        userTeam={currentDynasty.teamName}
        teamColors={userTeamColors}
      />
    </div>
  )
}
