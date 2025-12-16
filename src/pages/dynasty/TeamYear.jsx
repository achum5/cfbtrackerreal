import { Link, useParams } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations } from '../../data/teamAbbreviations'
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

export default function TeamYear() {
  const { id, teamAbbr, year } = useParams()
  const { currentDynasty } = useDynasty()
  const userTeamColors = useTeamColors(currentDynasty?.teamName)
  const selectedYear = parseInt(year)

  if (!currentDynasty) return null

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
  const secondaryBgText = getContrastTextColor(userTeamColors.secondary)

  // Get games against this team for this specific year
  const yearGames = (currentDynasty.games || [])
    .filter(g => g.opponent === teamAbbr && g.year === selectedYear)
    .sort((a, b) => a.week - b.week)

  // Calculate record for this year
  const wins = yearGames.filter(g => g.result === 'W').length
  const losses = yearGames.filter(g => g.result === 'L').length
  const totalPointsFor = yearGames.reduce((sum, g) => sum + (g.teamScore || 0), 0)
  const totalPointsAgainst = yearGames.reduce((sum, g) => sum + (g.opponentScore || 0), 0)

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to={`/dynasty/${id}/team/${teamAbbr}`}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
        style={{
          backgroundColor: userTeamColors.secondary,
          color: userTeamColors.primary
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {mascotName || teamAbbr} History
      </Link>

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
              className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
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
            <h1 className="text-2xl font-bold" style={{ color: teamBgText }}>
              vs {mascotName || teamInfo.name}
            </h1>
            {conference && (
              <div className="flex items-center gap-2 mt-1">
                {conferenceLogo && (
                  <img
                    src={conferenceLogo}
                    alt={`${conference} logo`}
                    className="w-4 h-4 object-contain"
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

      {/* Season Record Summary */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: userTeamColors.secondary,
          border: `3px solid ${userTeamColors.primary}`
        }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: userTeamColors.primary }}>
          {selectedYear} Record vs {mascotName || teamAbbr}
        </h2>

        {yearGames.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div
                className="text-3xl font-bold"
                style={{
                  color: wins > losses ? '#16a34a' : losses > wins ? '#dc2626' : userTeamColors.primary
                }}
              >
                {wins}-{losses}
              </div>
              <div className="text-sm font-semibold" style={{ color: secondaryBgText, opacity: 0.7 }}>
                Record
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: userTeamColors.primary }}>
                {yearGames.length}
              </div>
              <div className="text-sm font-semibold" style={{ color: secondaryBgText, opacity: 0.7 }}>
                Games
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: userTeamColors.primary }}>
                {totalPointsFor}
              </div>
              <div className="text-sm font-semibold" style={{ color: secondaryBgText, opacity: 0.7 }}>
                Points For
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: userTeamColors.primary }}>
                {totalPointsAgainst}
              </div>
              <div className="text-sm font-semibold" style={{ color: secondaryBgText, opacity: 0.7 }}>
                Points Against
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center py-4" style={{ color: secondaryBgText, opacity: 0.7 }}>
            No games played against {mascotName || teamInfo.name} in {selectedYear}.
          </p>
        )}
      </div>

      {/* Game Details */}
      {yearGames.length > 0 && (
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
              Game Details
            </h2>
          </div>

          <div className="divide-y" style={{ borderColor: `${userTeamColors.primary}30` }}>
            {yearGames.map((game, index) => (
              <div
                key={index}
                className="p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-3 py-1 rounded-full text-sm font-bold"
                        style={{
                          backgroundColor: game.result === 'W' ? '#16a34a' : '#dc2626',
                          color: '#FFFFFF'
                        }}
                      >
                        {game.result === 'W' ? 'WIN' : 'LOSS'}
                      </span>
                      <span className="text-xl font-bold" style={{ color: secondaryBgText }}>
                        {game.teamScore} - {game.opponentScore}
                      </span>
                      {game.isOT && (
                        <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: userTeamColors.primary, color: getContrastTextColor(userTeamColors.primary) }}>
                          OT
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      <span className="font-semibold">
                        {game.isConferenceChampionship ? 'Conference Championship' :
                         game.isPlayoff ? 'Playoff' :
                         game.isBowlGame ? 'Bowl Game' :
                         `Week ${game.week}`}
                      </span>
                      <span>
                        {game.location === 'home' ? 'Home' : game.location === 'away' ? 'Away' : 'Neutral'}
                      </span>
                      {game.opponentRank && (
                        <span className="font-bold" style={{ color: userTeamColors.primary }}>
                          #{game.opponentRank} {teamAbbr}
                        </span>
                      )}
                      {game.isConferenceGame && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `${userTeamColors.primary}20`, color: userTeamColors.primary }}>
                          Conference Game
                        </span>
                      )}
                    </div>

                    {game.opponentRecord && (
                      <div className="text-xs mt-2" style={{ color: secondaryBgText, opacity: 0.6 }}>
                        Opponent's Record: {game.opponentRecord}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
