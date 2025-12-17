import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { bowlLogos, getAllBowlNames } from '../../data/bowlLogos'
import { teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamLogo } from '../../data/teams'
import { getTeamColors } from '../../data/teamColors'

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

export default function BowlHistory() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedBowl, setExpandedBowl] = useState(null)

  if (!currentDynasty) return null

  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  // Get all bowl names sorted alphabetically
  const allBowls = getAllBowlNames()

  // Filter bowls by search
  const filteredBowls = allBowls.filter(bowl => {
    if (searchQuery === '') return true
    return bowl.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Get all bowl game results from the dynasty
  const getBowlResults = (bowlName) => {
    const results = []
    const bowlGamesByYear = currentDynasty.bowlGamesByYear || {}

    // Check each year's bowl games
    Object.entries(bowlGamesByYear).forEach(([year, yearData]) => {
      // Check week 1 bowls
      const week1Games = yearData?.week1 || []
      const week1Match = week1Games.find(g => g.bowlName === bowlName)
      if (week1Match && week1Match.team1 && week1Match.team2) {
        results.push({
          year: parseInt(year),
          ...week1Match,
          week: 'week1'
        })
      }

      // Check week 2 bowls
      const week2Games = yearData?.week2 || []
      const week2Match = week2Games.find(g => g.bowlName === bowlName)
      if (week2Match && week2Match.team1 && week2Match.team2) {
        results.push({
          year: parseInt(year),
          ...week2Match,
          week: 'week2'
        })
      }
    })

    // Sort by year descending (most recent first)
    return results.sort((a, b) => b.year - a.year)
  }

  // Count total bowl games played
  const getTotalBowlGames = () => {
    let total = 0
    const bowlGamesByYear = currentDynasty.bowlGamesByYear || {}
    Object.values(bowlGamesByYear).forEach(yearData => {
      const week1 = (yearData?.week1 || []).filter(g => g.team1 && g.team2).length
      const week2 = (yearData?.week2 || []).filter(g => g.team1 && g.team2).length
      total += week1 + week2
    })
    return total
  }

  // Get winner of a bowl game
  const getWinner = (game) => {
    if (!game.team1Score && game.team1Score !== 0) return null
    if (!game.team2Score && game.team2Score !== 0) return null
    return game.team1Score > game.team2Score ? game.team1 : game.team2
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
        <h1 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
          Bowl History
        </h1>
        <p className="mt-1" style={{ color: secondaryBgText, opacity: 0.8 }}>
          {getTotalBowlGames()} bowl games played across {Object.keys(currentDynasty.bowlGamesByYear || {}).length} seasons
        </p>
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
            placeholder="Search bowl games..."
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
        {searchQuery && (
          <p className="mt-2 text-sm font-semibold" style={{ color: secondaryBgText, opacity: 0.7 }}>
            {filteredBowls.length} bowl{filteredBowls.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Bowl Games List */}
      <div
        className="rounded-lg shadow-lg overflow-hidden"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="divide-y" style={{ borderColor: `${teamColors.primary}30` }}>
          {filteredBowls.map(bowlName => {
            const logo = bowlLogos[bowlName]
            const results = getBowlResults(bowlName)
            const isExpanded = expandedBowl === bowlName

            return (
              <div key={bowlName}>
                {/* Bowl Header */}
                <button
                  onClick={() => setExpandedBowl(isExpanded ? null : bowlName)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-white hover:bg-opacity-50 transition-colors"
                >
                  {/* Bowl Logo */}
                  <div
                    className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: `2px solid ${teamColors.primary}`,
                      padding: '4px'
                    }}
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt={`${bowlName} logo`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl">🏈</span>
                    )}
                  </div>

                  {/* Bowl Name and Stats */}
                  <div className="flex-1 text-left">
                    <div className="font-bold text-lg" style={{ color: teamColors.primary }}>
                      {bowlName}
                    </div>
                    <div className="text-sm" style={{ color: secondaryBgText, opacity: 0.7 }}>
                      {results.length === 0 ? 'No games played' : `${results.length} game${results.length !== 1 ? 's' : ''} played`}
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

                {/* Expanded Results */}
                {isExpanded && results.length > 0 && (
                  <div
                    className="px-4 pb-4 space-y-2"
                    style={{ backgroundColor: `${teamColors.primary}10` }}
                  >
                    {results.map((game, idx) => {
                      const winner = getWinner(game)
                      const team1Info = teamAbbreviations[game.team1]
                      const team2Info = teamAbbreviations[game.team2]
                      const team1Mascot = getMascotName(game.team1)
                      const team2Mascot = getMascotName(game.team2)
                      const team1Logo = team1Mascot ? getTeamLogo(team1Mascot) : null
                      const team2Logo = team2Mascot ? getTeamLogo(team2Mascot) : null
                      const team1Colors = team1Mascot ? getTeamColors(team1Mascot) : { primary: '#666', secondary: '#fff' }
                      const team2Colors = team2Mascot ? getTeamColors(team2Mascot) : { primary: '#666', secondary: '#fff' }

                      return (
                        <Link
                          key={`${game.year}-${idx}`}
                          to={`/dynasty/${id}/team/${winner || game.team1}/${game.year}`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white hover:scale-[1.01] transition-transform"
                          style={{ border: `2px solid ${teamColors.primary}30` }}
                        >
                          {/* Year */}
                          <div
                            className="w-16 text-center font-bold text-lg"
                            style={{ color: teamColors.primary }}
                          >
                            {game.year}
                          </div>

                          {/* Team 1 */}
                          <div className="flex items-center gap-2 flex-1">
                            {team1Logo && (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: `2px solid ${team1Colors.primary}`,
                                  padding: '2px'
                                }}
                              >
                                <img src={team1Logo} alt="" className="w-full h-full object-contain" />
                              </div>
                            )}
                            <span
                              className={`font-semibold ${winner === game.team1 ? '' : 'opacity-60'}`}
                              style={{ color: team1Info?.backgroundColor || '#333' }}
                            >
                              {team1Mascot || game.team1}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="flex items-center gap-2 font-bold">
                            <span
                              className={winner === game.team1 ? 'text-green-600' : 'text-gray-400'}
                            >
                              {game.team1Score}
                            </span>
                            <span className="text-gray-400">-</span>
                            <span
                              className={winner === game.team2 ? 'text-green-600' : 'text-gray-400'}
                            >
                              {game.team2Score}
                            </span>
                          </div>

                          {/* Team 2 */}
                          <div className="flex items-center gap-2 flex-1 justify-end">
                            <span
                              className={`font-semibold ${winner === game.team2 ? '' : 'opacity-60'}`}
                              style={{ color: team2Info?.backgroundColor || '#333' }}
                            >
                              {team2Mascot || game.team2}
                            </span>
                            {team2Logo && (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  border: `2px solid ${team2Colors.primary}`,
                                  padding: '2px'
                                }}
                              >
                                <img src={team2Logo} alt="" className="w-full h-full object-contain" />
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}

                {/* No results message */}
                {isExpanded && results.length === 0 && (
                  <div
                    className="px-4 pb-4 text-center py-6"
                    style={{ backgroundColor: `${teamColors.primary}10` }}
                  >
                    <p style={{ color: secondaryBgText, opacity: 0.6 }}>
                      No games have been played in this bowl yet.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {filteredBowls.length === 0 && (
        <div
          className="rounded-lg shadow-lg p-8 text-center"
          style={{
            backgroundColor: teamColors.secondary,
            border: `3px solid ${teamColors.primary}`
          }}
        >
          <p style={{ color: secondaryBgText, opacity: 0.7 }}>
            No bowls found matching "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  )
}
