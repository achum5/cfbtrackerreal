import { Link, useParams, useNavigate } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'
import { getTeamConference } from '../../data/conferenceTeams'
import { getConferenceLogo } from '../../data/conferenceLogos'
import { getTeamLogo } from '../../data/teams'

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

// Extract just the school name from full mascot name
const getSchoolName = (mascotName) => {
  if (!mascotName) return ''

  // Two-word mascots that need to be removed
  const twoWordMascots = [
    'Crimson Tide', 'Golden Bears', 'Sun Devils', 'Red Wolves', 'Black Knights',
    'Blue Devils', 'Fighting Illini', 'Yellow Jackets', 'Fighting Irish', 'Nittany Lions',
    'Scarlet Knights', 'Golden Eagles', 'Demon Deacons', 'Horned Frogs', 'Green Wave',
    'Golden Hurricane', 'Mean Green', 'Tar Heels', 'Golden Gophers', 'Golden Flashes',
    'Blue Raiders', 'Wolf Pack', "Ragin' Cajuns", 'Rainbow Warriors'
  ]

  for (const mascot of twoWordMascots) {
    if (mascotName.endsWith(mascot)) {
      return mascotName.replace(` ${mascot}`, '')
    }
  }

  // Default: remove last word (single-word mascot)
  const words = mascotName.split(' ')
  if (words.length > 1) {
    return words.slice(0, -1).join(' ')
  }
  return mascotName
}

export default function Team() {
  const { id, teamAbbr } = useParams()
  const navigate = useNavigate()
  const { currentDynasty } = useDynasty()

  if (!currentDynasty) return null

  // Get all teams sorted alphabetically by mascot name
  const allTeams = Object.entries(teamAbbreviations)
    .map(([abbr, info]) => {
      const fullName = getMascotName(abbr) || info.name
      return {
        abbr,
        name: fullName,
        shortName: getSchoolName(fullName),
        sortName: fullName.toLowerCase()
      }
    })
    .sort((a, b) => a.sortName.localeCompare(b.sortName))

  // Get team info
  const teamInfo = teamAbbreviations[teamAbbr]
  if (!teamInfo) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-lg shadow-lg p-6 bg-gray-100 border-2 border-gray-400"
        >
          <h1 className="text-2xl font-bold text-gray-700">
            Team Not Found
          </h1>
          <p className="mt-2 text-gray-600">
            The team "{teamAbbr}" was not found.
          </p>
          <Link
            to={`/dynasty/${id}/teams`}
            className="inline-block mt-4 px-4 py-2 rounded-lg font-semibold bg-gray-700 text-white hover:bg-gray-800"
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

  // Get all games against this team
  const gamesAgainst = (currentDynasty.games || [])
    .filter(g => g.opponent === teamAbbr)

  // Calculate all-time record vs this team
  const allTimeWins = gamesAgainst.filter(g => g.result === 'W').length
  const allTimeLosses = gamesAgainst.filter(g => g.result === 'L').length
  const winPctVs = gamesAgainst.length > 0
    ? ((allTimeWins / gamesAgainst.length) * 100).toFixed(1)
    : null

  // Get team history data for this opponent (stored in dynasty)
  const teamHistoryData = currentDynasty.teamHistories?.[teamAbbr] || {}

  // Calculate conference titles dynamically from conferenceChampionshipsByYear
  const conferenceTitles = Object.values(currentDynasty.conferenceChampionshipsByYear || {})
    .flat()
    .filter(cc => cc.winner === teamAbbr)
    .length

  // Calculate bowl wins dynamically from bowlGamesByYear
  const getBowlWinsForTeam = () => {
    const bowlWins = []
    const bowlGamesByYear = currentDynasty.bowlGamesByYear || {}

    Object.entries(bowlGamesByYear).forEach(([year, yearData]) => {
      const allBowls = [...(yearData?.week1 || []), ...(yearData?.week2 || [])]
      allBowls.forEach(bowl => {
        if (!bowl.team1 || !bowl.team2 || bowl.team1Score === null || bowl.team2Score === null) return

        const isTeam1 = bowl.team1 === teamAbbr
        const isTeam2 = bowl.team2 === teamAbbr
        if (!isTeam1 && !isTeam2) return

        const teamWon = (isTeam1 && bowl.team1Score > bowl.team2Score) ||
                        (isTeam2 && bowl.team2Score > bowl.team1Score)

        if (teamWon) {
          bowlWins.push({
            year: parseInt(year),
            bowlName: bowl.bowlName
          })
        }
      })
    })

    return bowlWins
  }

  const bowlWins = getBowlWinsForTeam()

  // Get bowl result for a specific year (returns { bowlName, won } or null)
  const getBowlResultForYear = (year) => {
    const yearData = currentDynasty.bowlGamesByYear?.[year]
    if (!yearData) return null

    const allBowls = [...(yearData?.week1 || []), ...(yearData?.week2 || [])]
    const teamBowl = allBowls.find(bowl =>
      (bowl.team1 === teamAbbr || bowl.team2 === teamAbbr) &&
      bowl.team1Score !== null && bowl.team2Score !== null
    )

    if (!teamBowl) return null

    const isTeam1 = teamBowl.team1 === teamAbbr
    const won = (isTeam1 && teamBowl.team1Score > teamBowl.team2Score) ||
                (!isTeam1 && teamBowl.team2Score > teamBowl.team1Score)

    return {
      bowlName: teamBowl.bowlName,
      won
    }
  }

  // Get all dynasty years
  const startYear = currentDynasty.startYear
  const currentYear = currentDynasty.currentYear
  const years = []
  for (let year = startYear; year <= currentYear; year++) {
    years.push(year)
  }

  // Calculate record for each year
  const yearRecords = years.map(year => {
    const yearGames = gamesAgainst.filter(g => g.year === year)
    const wins = yearGames.filter(g => g.result === 'W').length
    const losses = yearGames.filter(g => g.result === 'L').length
    return {
      year,
      wins,
      losses,
      games: yearGames.length,
      hasGames: yearGames.length > 0
    }
  })

  // Find best and worst years (only years with games)
  const yearsWithGames = yearRecords.filter(yr => yr.hasGames)
  let bestYear = null
  let worstYear = null

  if (yearsWithGames.length > 0) {
    bestYear = yearsWithGames.reduce((best, curr) => {
      if (curr.wins > best.wins) return curr
      if (curr.wins === best.wins && curr.losses < best.losses) return curr
      return best
    })

    worstYear = yearsWithGames.reduce((worst, curr) => {
      if (curr.losses > worst.losses) return curr
      if (curr.losses === worst.losses && curr.wins < worst.wins) return curr
      return worst
    })
  }

  // Stat cell component
  const StatCell = ({ label, value, subValue }) => (
    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: `${teamBgText}10` }}>
      <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ color: teamBgText }}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
          {subValue}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Navigation Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Back Link */}
        <Link
          to={`/dynasty/${id}/teams`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            color: teamBgText,
            border: `2px solid ${teamBgText}40`
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          History
        </Link>

        {/* Team Dropdown */}
        <select
          value={teamAbbr}
          onChange={(e) => navigate(`/dynasty/${id}/team/${e.target.value}`)}
          className="px-3 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2 ml-auto"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            color: teamBgText,
            border: `2px solid ${teamBgText}40`
          }}
        >
          {allTeams.map((team) => (
            <option key={team.abbr} value={team.abbr}>
              {team.shortName}
            </option>
          ))}
        </select>
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
              Team History
            </p>
            <h1 className="text-2xl font-bold" style={{ color: teamBgText }}>
              {mascotName || teamInfo.name}
            </h1>
            {conference && (
              <div className="flex items-center gap-2 mt-2">
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
          </div>
        </div>
      </div>

      {/* Team Accomplishments */}
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
          <h2 className="text-lg font-bold" style={{ color: teamPrimaryText }}>
            Team Accomplishments
          </h2>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCell
              label="AP Top 25"
              value={teamHistoryData.apTop25Finishes || 0}
              subValue="Finishes"
            />
            <StatCell
              label="Conf Titles"
              value={conferenceTitles}
            />
            <StatCell
              label="Bowl Wins"
              value={bowlWins.length}
            />
            <StatCell
              label="CFP Apps"
              value={teamHistoryData.cfpAppearances || 0}
            />
            <StatCell
              label="Natl Titles"
              value={teamHistoryData.nationalTitles || 0}
            />
            <StatCell
              label="All-Americans"
              value={teamHistoryData.allAmericans || 0}
              subValue="1st Team"
            />
          </div>
        </div>
      </div>

      {/* User History with Team */}
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
          <h2 className="text-lg font-bold" style={{ color: teamPrimaryText }}>
            Your History
          </h2>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Games As */}
            <div
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: `${teamBgText}10` }}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                Games As
              </div>
              <div className="text-3xl font-bold" style={{ color: teamBgText }}>
                {teamHistoryData.gamesAs || '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                as {teamAbbr}
              </div>
            </div>

            {/* Win % As */}
            <div
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: `${teamBgText}10` }}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                Win % As
              </div>
              <div className="text-3xl font-bold" style={{ color: teamBgText }}>
                {teamHistoryData.winPctAs ? `${teamHistoryData.winPctAs}%` : '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                as {teamAbbr}
              </div>
            </div>

            {/* Games Vs */}
            <div
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: `${teamBgText}10` }}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                Games Vs
              </div>
              <div className="text-3xl font-bold" style={{ color: gamesAgainst.length > 0 ? teamBgText : `${teamBgText}50` }}>
                {gamesAgainst.length || '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                vs {teamAbbr}
              </div>
            </div>

            {/* Win % Vs */}
            <div
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: `${teamBgText}10` }}
            >
              <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: teamBgText, opacity: 0.7 }}>
                Win % Vs
              </div>
              <div
                className="text-3xl font-bold"
                style={{
                  color: winPctVs
                    ? parseFloat(winPctVs) >= 50 ? '#16a34a' : '#dc2626'
                    : `${teamBgText}50`
                }}
              >
                {winPctVs ? `${winPctVs}%` : '--'}
              </div>
              <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                {allTimeWins}-{allTimeLosses} record
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Head-to-Head Summary */}
      {gamesAgainst.length > 0 && (
        <div
          className="rounded-lg shadow-lg p-6"
          style={{
            backgroundColor: teamInfo.backgroundColor,
            border: `3px solid ${teamInfo.textColor}`
          }}
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: teamBgText }}>
            Head-to-Head Record
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* All-Time Record */}
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: `${teamBgText}10` }}>
              <div className="text-4xl font-bold" style={{ color: teamBgText }}>
                {allTimeWins}-{allTimeLosses}
              </div>
              <div className="text-sm font-semibold mt-1" style={{ color: teamBgText, opacity: 0.7 }}>
                All-Time Record
              </div>
            </div>

            {/* Best Year */}
            {bestYear && (
              <Link
                to={`/dynasty/${id}/team/${teamAbbr}/${bestYear.year}`}
                className="text-center p-4 rounded-lg hover:scale-[1.02] transition-transform"
                style={{ backgroundColor: '#16a34a20' }}
              >
                <div className="text-4xl font-bold" style={{ color: '#16a34a' }}>
                  {bestYear.wins}-{bestYear.losses}
                </div>
                <div className="text-sm font-semibold mt-1" style={{ color: teamBgText, opacity: 0.7 }}>
                  Best Year ({bestYear.year})
                </div>
              </Link>
            )}

            {/* Worst Year */}
            {worstYear && worstYear.year !== bestYear?.year && (
              <Link
                to={`/dynasty/${id}/team/${teamAbbr}/${worstYear.year}`}
                className="text-center p-4 rounded-lg hover:scale-[1.02] transition-transform"
                style={{ backgroundColor: '#dc262620' }}
              >
                <div className="text-4xl font-bold" style={{ color: '#dc2626' }}>
                  {worstYear.wins}-{worstYear.losses}
                </div>
                <div className="text-sm font-semibold mt-1" style={{ color: teamBgText, opacity: 0.7 }}>
                  Worst Year ({worstYear.year})
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Year-by-Year Breakdown */}
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
          <h2 className="text-lg font-bold" style={{ color: teamPrimaryText }}>
            Season-by-Season vs {teamAbbr}
          </h2>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {yearRecords.map(({ year, wins, losses, hasGames }) => {
            const bowlResult = getBowlResultForYear(year)

            return (
              <Link
                key={year}
                to={`/dynasty/${id}/team/${teamAbbr}/${year}`}
                className={`p-4 rounded-lg text-center transition-transform hover:scale-[1.02]`}
                style={{
                  backgroundColor: bowlResult?.won ? '#16a34a15' : hasGames ? `${teamBgText}15` : `${teamBgText}05`,
                  border: bowlResult?.won
                    ? '2px solid #16a34a'
                    : `2px solid ${hasGames ? `${teamBgText}40` : `${teamBgText}20`}`
                }}
              >
                <div className="text-lg font-bold" style={{ color: teamBgText }}>
                  {year}
                </div>
                <div
                  className="text-2xl font-bold mt-1"
                  style={{
                    color: hasGames
                      ? wins > losses ? '#16a34a' : losses > wins ? '#dc2626' : teamBgText
                      : `${teamBgText}50`
                  }}
                >
                  {hasGames ? `${wins}-${losses}` : '--'}
                </div>
                {bowlResult && (
                  <div
                    className="text-xs mt-2 font-semibold px-2 py-1 rounded"
                    style={{
                      backgroundColor: bowlResult.won ? '#16a34a' : '#dc2626',
                      color: '#FFFFFF'
                    }}
                  >
                    {bowlResult.bowlName}{bowlResult.won ? ' Champion' : ''}
                  </div>
                )}
                {!hasGames && !bowlResult && (
                  <div className="text-xs mt-1" style={{ color: teamBgText, opacity: 0.6 }}>
                    No games
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
