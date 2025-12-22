import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamLogo } from '../../data/teams'
import { getTeamColors } from '../../data/teamColors'
import { getConferenceLogo } from '../../data/conferenceLogos'

// Map abbreviation to mascot name for logo lookup
const getMascotName = (abbr) => {
  const mascotMap = {
    'BAMA': 'Alabama Crimson Tide', 'AFA': 'Air Force Falcons', 'AKR': 'Akron Zips',
    'APP': 'Appalachian State Mountaineers', 'ARIZ': 'Arizona Wildcats',
    'ARK': 'Arkansas Razorbacks', 'ARMY': 'Army Black Knights',
    'ARST': 'Arkansas State Red Wolves', 'ASU': 'Arizona State Sun Devils',
    'AUB': 'Auburn Tigers', 'BALL': 'Ball State Cardinals', 'BC': 'Boston College Eagles',
    'BGSU': 'Bowling Green Falcons', 'BOIS': 'Boise State Broncos',
    'BU': 'Baylor Bears', 'BUFF': 'Buffalo Bulls', 'BYU': 'Brigham Young Cougars',
    'CAL': 'California Golden Bears', 'CCU': 'Coastal Carolina Chanticleers',
    'CHAR': 'Charlotte 49ers', 'CLEM': 'Clemson Tigers', 'CMU': 'Central Michigan Chippewas',
    'COLO': 'Colorado Buffaloes', 'CONN': 'Connecticut Huskies', 'CSU': 'Colorado State Rams',
    'DUKE': 'Duke Blue Devils', 'ECU': 'East Carolina Pirates', 'EMU': 'Eastern Michigan Eagles',
    'FIU': 'Florida International Panthers', 'FSU': 'Florida State Seminoles',
    'FAU': 'Florida Atlantic Owls', 'FRES': 'Fresno State Bulldogs',
    'UF': 'Florida Gators', 'GASO': 'Georgia Southern Eagles', 'GAST': 'Georgia State Panthers',
    'GT': 'Georgia Tech Yellow Jackets', 'UGA': 'Georgia Bulldogs',
    'HAW': 'Hawaii Rainbow Warriors', 'HOU': 'Houston Cougars',
    'ILL': 'Illinois Fighting Illini', 'IU': 'Indiana Hoosiers',
    'IOWA': 'Iowa Hawkeyes', 'ISU': 'Iowa State Cyclones',
    'JKST': 'Jacksonville State Gamecocks', 'JMU': 'James Madison Dukes',
    'KU': 'Kansas Jayhawks', 'KSU': 'Kansas State Wildcats',
    'KENT': 'Kent State Golden Flashes', 'UK': 'Kentucky Wildcats',
    'LIB': 'Liberty Flames', 'ULL': 'Lafayette Ragin\' Cajuns',
    'LT': 'Louisiana Tech Bulldogs', 'LOU': 'Louisville Cardinals',
    'LSU': 'LSU Tigers', 'UM': 'Miami Hurricanes', 'M-OH': 'Miami Redhawks',
    'UMD': 'Maryland Terrapins', 'MASS': 'Massachusetts Minutemen',
    'MEM': 'Memphis Tigers', 'MICH': 'Michigan Wolverines',
    'MSU': 'Michigan State Spartans', 'MTSU': 'Middle Tennessee State Blue Raiders',
    'MINN': 'Minnesota Golden Gophers', 'MISS': 'Ole Miss Rebels',
    'MSST': 'Mississippi State Bulldogs', 'MZST': 'Missouri Tigers',
    'MRSH': 'Marshall Thundering Herd', 'NAVY': 'Navy Midshipmen',
    'NEB': 'Nebraska Cornhuskers', 'NEV': 'Nevada Wolf Pack',
    'UNM': 'New Mexico Lobos', 'NMSU': 'New Mexico State Aggies',
    'UNC': 'North Carolina Tar Heels', 'NCST': 'North Carolina State Wolfpack',
    'UNT': 'North Texas Mean Green', 'NU': 'Northwestern Wildcats',
    'ND': 'Notre Dame Fighting Irish', 'NIU': 'Northern Illinois Huskies',
    'OHIO': 'Ohio Bobcats', 'OSU': 'Ohio State Buckeyes',
    'OKLA': 'Oklahoma Sooners', 'OKST': 'Oklahoma State Cowboys',
    'ODU': 'Old Dominion Monarchs', 'ORE': 'Oregon Ducks',
    'ORST': 'Oregon State Beavers', 'PSU': 'Penn State Nittany Lions',
    'PITT': 'Pittsburgh Panthers', 'PUR': 'Purdue Boilermakers',
    'RICE': 'Rice Owls', 'RUT': 'Rutgers Scarlet Knights',
    'SDSU': 'San Diego State Aztecs', 'SJSU': 'San Jose State Spartans',
    'SAM': 'Sam Houston State Bearkats', 'USF': 'South Florida Bulls',
    'SMU': 'SMU Mustangs', 'USC': 'USC Trojans',
    'SCAR': 'South Carolina Gamecocks', 'STAN': 'Stanford Cardinal',
    'SYR': 'Syracuse Orange', 'TCU': 'TCU Horned Frogs',
    'TEM': 'Temple Owls', 'TENN': 'Tennessee Volunteers',
    'TEX': 'Texas Longhorns', 'TXAM': 'Texas A&M Aggies',
    'TXST': 'Texas State Bobcats', 'TXTECH': 'Texas Tech Red Raiders',
    'TOL': 'Toledo Rockets', 'TROY': 'Troy Trojans',
    'TUL': 'Tulane Green Wave', 'TLSA': 'Tulsa Golden Hurricane',
    'UAB': 'UAB Blazers', 'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins',
    'UNLV': 'UNLV Rebels', 'UTEP': 'UTEP Miners',
    'USA': 'South Alabama Jaguars', 'USU': 'Utah State Aggies',
    'UTAH': 'Utah Utes', 'UTSA': 'UTSA Roadrunners',
    'VAN': 'Vanderbilt Commodores', 'UVA': 'Virginia Cavaliers',
    'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons',
    'WASH': 'Washington Huskies', 'WSU': 'Washington State Cougars',
    'WVU': 'West Virginia Mountaineers', 'WMU': 'Western Michigan Broncos',
    'WKU': 'Western Kentucky Hilltoppers', 'WIS': 'Wisconsin Badgers',
    'WYO': 'Wyoming Cowboys',
    'DEL': 'Delaware Fightin\' Blue Hens', 'FLA': 'Florida Gators',
    'KENN': 'Kennesaw State Owls', 'ULM': 'Monroe Warhawks',
    'UC': 'Cincinnati Bearcats', 'RUTG': 'Rutgers Scarlet Knights',
    'SHSU': 'Sam Houston State Bearkats', 'TAMU': 'Texas A&M Aggies',
    'TTU': 'Texas Tech Red Raiders', 'TULN': 'Tulane Green Wave',
    'UH': 'Houston Cougars', 'UL': 'Lafayette Ragin\' Cajuns',
    'UT': 'Tennessee Volunteers', 'MIA': 'Miami Hurricanes',
    'MIZ': 'Missouri Tigers', 'OU': 'Oklahoma Sooners',
    'GSU': 'Georgia State Panthers'
  }
  return mascotMap[abbr] || null
}

// Conference order for display
const CONFERENCE_ORDER = [
  'ACC',
  'American',
  'Big 12',
  'Big Ten',
  'Conference USA',
  'MAC',
  'Mountain West',
  'Pac-12',
  'SEC',
  'Sun Belt'
]

export default function ConferenceStandings() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const [selectedYear, setSelectedYear] = useState(null)
  const [expandedConference, setExpandedConference] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  if (!currentDynasty) return null

  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  // Get available years from standings data
  const standingsByYear = currentDynasty.conferenceStandingsByYear || {}
  const availableYears = Object.keys(standingsByYear)
    .map(y => parseInt(y))
    .sort((a, b) => b - a) // Most recent first

  // Default to most recent year or current year
  const displayYear = selectedYear || availableYears[0] || currentDynasty.currentYear

  // Get standings for selected year
  const yearStandings = standingsByYear[displayYear] || {}

  // Filter conferences by search
  const filteredConferences = CONFERENCE_ORDER.filter(conf => {
    if (searchQuery === '') return true
    return conf.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Get total teams with standings
  const getTotalTeams = () => {
    let total = 0
    Object.values(yearStandings).forEach(teams => {
      if (Array.isArray(teams)) {
        total += teams.length
      }
    })
    return total
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
              Conference Standings
            </h1>
            <p className="mt-1" style={{ color: secondaryBgText, opacity: 0.8 }}>
              {Object.keys(yearStandings).length > 0
                ? `${getTotalTeams()} teams across ${Object.keys(yearStandings).length} conferences`
                : 'No standings data available for this year'}
            </p>
          </div>

          {/* Year Selector */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                className="font-semibold text-sm"
                style={{ color: secondaryBgText }}
              >
                Year:
              </label>
              <select
                value={displayYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 rounded-lg font-bold text-lg border-2"
                style={{
                  borderColor: teamColors.primary,
                  color: teamColors.primary,
                  backgroundColor: 'white'
                }}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div
        className="rounded-lg shadow-lg p-4"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
            fill="none"
            stroke={teamColors.primary}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conferences..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border-2 font-semibold text-lg"
            style={{
              borderColor: teamColors.primary,
              backgroundColor: 'white'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:opacity-70"
              style={{ color: teamColors.primary }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Conference Standings List */}
      {Object.keys(yearStandings).length > 0 ? (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <div className="divide-y" style={{ borderColor: `${teamColors.primary}30` }}>
            {filteredConferences.map(conferenceName => {
              const teams = yearStandings[conferenceName] || []
              const isExpanded = expandedConference === conferenceName
              const hasData = teams.length > 0

              if (!hasData && searchQuery) return null

              return (
                <div key={conferenceName}>
                  {/* Conference Header */}
                  <button
                    onClick={() => setExpandedConference(isExpanded ? null : conferenceName)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white hover:bg-opacity-50 transition-colors"
                  >
                    {/* Conference Logo */}
                    <div
                      className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center bg-white p-1"
                      style={{
                        border: `2px solid ${teamColors.primary}`
                      }}
                    >
                      {getConferenceLogo(conferenceName) ? (
                        <img
                          src={getConferenceLogo(conferenceName)}
                          alt={`${conferenceName} logo`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span
                          className="text-2xl font-bold"
                          style={{ color: teamColors.primary }}
                        >
                          {conferenceName.charAt(0)}
                        </span>
                      )}
                    </div>

                    {/* Conference Name and Stats */}
                    <div className="flex-1 text-left">
                      <div className="font-bold text-lg" style={{ color: teamColors.primary }}>
                        {conferenceName}
                      </div>
                      <div className="text-sm" style={{ color: secondaryBgText, opacity: 0.7 }}>
                        {hasData ? `${teams.length} teams` : 'No standings data'}
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <div style={{ color: teamColors.primary }}>
                      <svg
                        className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Standings Table */}
                  {isExpanded && hasData && (
                    <div
                      className="px-4 pb-4"
                      style={{ backgroundColor: `${teamColors.primary}10` }}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr
                              className="text-xs uppercase tracking-wider"
                              style={{ color: teamColors.primary }}
                            >
                              <th className="py-2 px-2 text-left w-10">#</th>
                              <th className="py-2 px-2 text-left">Team</th>
                              <th className="py-2 px-2 text-center w-12">W</th>
                              <th className="py-2 px-2 text-center w-12">L</th>
                              <th className="py-2 px-2 text-center w-16 hidden sm:table-cell">PF</th>
                              <th className="py-2 px-2 text-center w-16 hidden sm:table-cell">PA</th>
                              <th className="py-2 px-2 text-center w-16 hidden sm:table-cell">Diff</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teams
                              .sort((a, b) => (a.rank || 0) - (b.rank || 0))
                              .map((team, idx) => {
                                const teamAbbr = team.team
                                const mascotName = getMascotName(teamAbbr)
                                const logo = mascotName ? getTeamLogo(mascotName) : null
                                const colors = mascotName ? getTeamColors(mascotName) : { primary: '#666', secondary: '#fff' }
                                const pointDiff = (team.pointsFor || 0) - (team.pointsAgainst || 0)

                                return (
                                  <tr
                                    key={teamAbbr || idx}
                                    className="bg-white border-b last:border-b-0 hover:bg-gray-50"
                                    style={{ borderColor: `${teamColors.primary}20` }}
                                  >
                                    <td className="py-2 px-2">
                                      <span
                                        className="font-bold"
                                        style={{ color: teamColors.primary }}
                                      >
                                        {team.rank || idx + 1}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2">
                                      <Link
                                        to={`/dynasty/${id}/team/${teamAbbr}`}
                                        className="flex items-center gap-2 hover:opacity-80"
                                      >
                                        {logo && (
                                          <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{
                                              backgroundColor: '#FFFFFF',
                                              border: `2px solid ${colors.primary}`,
                                              padding: '2px'
                                            }}
                                          >
                                            <img src={logo} alt="" className="w-full h-full object-contain" />
                                          </div>
                                        )}
                                        <span
                                          className="font-semibold truncate"
                                          style={{ color: colors.primary }}
                                        >
                                          {mascotName || teamAbbr}
                                        </span>
                                      </Link>
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold text-green-600">
                                      {team.wins || 0}
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold text-red-600">
                                      {team.losses || 0}
                                    </td>
                                    <td className="py-2 px-2 text-center font-medium text-gray-600 hidden sm:table-cell">
                                      {team.pointsFor || 0}
                                    </td>
                                    <td className="py-2 px-2 text-center font-medium text-gray-600 hidden sm:table-cell">
                                      {team.pointsAgainst || 0}
                                    </td>
                                    <td
                                      className="py-2 px-2 text-center font-bold hidden sm:table-cell"
                                      style={{
                                        color: pointDiff > 0 ? '#16a34a' : pointDiff < 0 ? '#dc2626' : '#6b7280'
                                      }}
                                    >
                                      {pointDiff > 0 ? '+' : ''}{pointDiff}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* No data message */}
                  {isExpanded && !hasData && (
                    <div
                      className="px-4 pb-4 text-center py-6"
                      style={{ backgroundColor: `${teamColors.primary}10` }}
                    >
                      <p style={{ color: secondaryBgText, opacity: 0.6 }}>
                        No standings data for this conference in {displayYear}.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg shadow-lg p-8 text-center"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke={teamColors.primary}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-semibold mb-2" style={{ color: teamColors.primary }}>
            No Conference Standings Data
          </p>
          <p style={{ color: secondaryBgText, opacity: 0.7 }}>
            Conference standings will appear here after you enter them during the End of Season Recap.
          </p>
        </div>
      )}

      {filteredConferences.length === 0 && searchQuery && (
        <div
          className="rounded-lg shadow-lg p-8 text-center"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <p style={{ color: secondaryBgText, opacity: 0.7 }}>
            No conferences found matching "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  )
}
