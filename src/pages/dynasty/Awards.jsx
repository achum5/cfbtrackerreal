import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teamAbbreviations } from '../../data/teamAbbreviations'
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

// Helper function to normalize player names for URL
const normalizePlayerName = (name) => {
  if (!name) return ''
  return name.trim().toLowerCase()
}

// Award display names and categories
const AWARD_DISPLAY = {
  heisman: { name: 'Heisman Trophy', icon: 'trophy', category: 'player' },
  maxwell: { name: 'Maxwell Award', icon: 'star', category: 'player' },
  walterCamp: { name: 'Walter Camp Award', icon: 'star', category: 'player' },
  bearBryantCoachOfTheYear: { name: 'Bear Bryant Coach of the Year', icon: 'user', category: 'coach' },
  daveyObrien: { name: 'Davey O\'Brien Award', icon: 'football', category: 'offense' },
  chuckBednarik: { name: 'Chuck Bednarik Award', icon: 'shield', category: 'defense' },
  broncoNagurski: { name: 'Bronco Nagurski Trophy', icon: 'shield', category: 'defense' },
  jimThorpe: { name: 'Jim Thorpe Award', icon: 'shield', category: 'defense' },
  doakWalker: { name: 'Doak Walker Award', icon: 'football', category: 'offense' },
  fredBiletnikoff: { name: 'Fred Biletnikoff Award', icon: 'football', category: 'offense' },
  lombardi: { name: 'Lombardi Award', icon: 'star', category: 'lineman' },
  unitasGoldenArm: { name: 'Unitas Golden Arm Award', icon: 'football', category: 'offense' },
  edgeRusherOfTheYear: { name: 'Edge Rusher of the Year', icon: 'shield', category: 'defense' },
  outland: { name: 'Outland Trophy', icon: 'star', category: 'lineman' },
  johnMackey: { name: 'John Mackey Award', icon: 'football', category: 'offense' },
  broyles: { name: 'Broyles Award', icon: 'user', category: 'coach' },
  dickButkus: { name: 'Dick Butkus Award', icon: 'shield', category: 'defense' },
  rimington: { name: 'Rimington Trophy', icon: 'star', category: 'lineman' },
  louGroza: { name: 'Lou Groza Award', icon: 'football', category: 'special' },
  rayGuy: { name: 'Ray Guy Award', icon: 'football', category: 'special' },
  returnerOfTheYear: { name: 'Returner of the Year', icon: 'football', category: 'special' }
}

// Order of awards for display
const AWARD_ORDER = [
  'heisman', 'maxwell', 'walterCamp', 'daveyObrien', 'doakWalker',
  'fredBiletnikoff', 'johnMackey', 'unitasGoldenArm',
  'chuckBednarik', 'broncoNagurski', 'jimThorpe', 'dickButkus', 'edgeRusherOfTheYear',
  'outland', 'lombardi', 'rimington',
  'louGroza', 'rayGuy', 'returnerOfTheYear',
  'bearBryantCoachOfTheYear', 'broyles'
]

export default function Awards() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const [selectedYear, setSelectedYear] = useState(null)

  if (!currentDynasty) return null

  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  // Get available years with awards
  const awardsByYear = currentDynasty.awardsByYear || {}
  const availableYears = Object.keys(awardsByYear)
    .map(y => parseInt(y))
    .sort((a, b) => b - a)

  // Set default year to most recent
  const displayYear = selectedYear || (availableYears.length > 0 ? availableYears[0] : currentDynasty.currentYear)
  const yearAwards = awardsByYear[displayYear] || {}

  // No awards yet
  if (availableYears.length === 0) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-lg shadow-lg p-8 text-center"
          style={{ backgroundColor: teamColors.secondary }}
        >
          <h1 className="text-2xl font-bold mb-4" style={{ color: teamColors.primary }}>
            Season Awards
          </h1>
          <p className="text-lg" style={{ color: secondaryBgText, opacity: 0.7 }}>
            No awards recorded yet. Complete a season and enter awards to see them here.
          </p>
        </div>
      </div>
    )
  }

  // Helper function to find player by name
  const findPlayerByName = (playerName) => {
    if (!playerName || !currentDynasty.players) return null
    const normalizedName = normalizePlayerName(playerName)
    return currentDynasty.players.find(p =>
      normalizePlayerName(p.name) === normalizedName
    )
  }

  // Render award card
  const AwardCard = ({ awardKey, awardData }) => {
    const display = AWARD_DISPLAY[awardKey] || { name: awardKey, icon: 'star', category: 'player' }
    const teamInfo = teamAbbreviations[awardData.team] || {}
    const mascotName = getMascotName(awardData.team)
    const teamLogo = mascotName ? getTeamLogo(mascotName) : null
    const bgColor = teamInfo.backgroundColor || '#6B7280'
    const textColor = getContrastTextColor(bgColor)
    const isCoachAward = display.category === 'coach'
    const matchingPlayer = !isCoachAward ? findPlayerByName(awardData.player) : null
    const hasPlayerPage = !!matchingPlayer

    return (
      <div
        className="rounded-lg overflow-hidden shadow-md"
        style={{ backgroundColor: bgColor }}
      >
        {/* Award Header */}
        <div
          className="px-4 py-2 flex items-center gap-2"
          style={{ backgroundColor: `${textColor}15` }}
        >
          {display.icon === 'trophy' && (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#EAB308' }}>
              <path d="M5 3h14a1 1 0 011 1v3c0 2.21-1.79 4-4 4h-1v2h1a1 1 0 011 1v6a1 1 0 01-1 1H8a1 1 0 01-1-1v-6a1 1 0 011-1h1v-2H8c-2.21 0-4-1.79-4-4V4a1 1 0 011-1z"/>
            </svg>
          )}
          {display.icon !== 'trophy' && (
            <svg className="w-5 h-5" fill="none" stroke={textColor} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
          <span className="font-bold text-sm" style={{ color: textColor }}>{display.name}</span>
        </div>

        {/* Winner Info */}
        <div className="p-4 flex items-center gap-3">
          {/* Team Logo */}
          {teamLogo && (
            <Link
              to={`/dynasty/${id}/team/${awardData.team}`}
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform"
              style={{ backgroundColor: '#FFFFFF', padding: '2px' }}
            >
              <img
                src={teamLogo}
                alt={`${awardData.team} logo`}
                className="w-full h-full object-contain"
              />
            </Link>
          )}

          {/* Player/Coach Info */}
          <div className="flex-1 min-w-0">
            {hasPlayerPage ? (
              <Link
                to={`/dynasty/${id}/player/${matchingPlayer.pid}`}
                className="font-bold text-lg truncate block hover:underline"
                style={{ color: textColor }}
              >
                {awardData.player}
              </Link>
            ) : (
              <div className="font-bold text-lg truncate" style={{ color: textColor }}>
                {awardData.player}
              </div>
            )}
            {!isCoachAward && awardData.position && (
              <div className="text-sm" style={{ color: textColor, opacity: 0.8 }}>
                {awardData.position} • {awardData.class}
              </div>
            )}
            <Link
              to={`/dynasty/${id}/team/${awardData.team}`}
              className="text-sm hover:underline"
              style={{ color: textColor, opacity: 0.7 }}
            >
              {mascotName || teamInfo.name || awardData.team}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Group awards by category
  const categories = {
    player: { title: 'Player of the Year', awards: [] },
    offense: { title: 'Offensive Awards', awards: [] },
    defense: { title: 'Defensive Awards', awards: [] },
    lineman: { title: 'Lineman Awards', awards: [] },
    special: { title: 'Special Teams', awards: [] },
    coach: { title: 'Coaching Awards', awards: [] }
  }

  AWARD_ORDER.forEach(key => {
    if (yearAwards[key]) {
      const category = AWARD_DISPLAY[key]?.category || 'player'
      if (categories[category]) {
        categories[category].awards.push({ key, data: yearAwards[key] })
      }
    }
  })

  return (
    <div className="space-y-6">
      {/* Header with Year Selector */}
      <div
        className="rounded-lg shadow-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ backgroundColor: teamColors.secondary }}
      >
        <h1 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
          Season Awards
        </h1>

        <select
          value={displayYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2"
          style={{
            backgroundColor: teamColors.primary,
            color: primaryBgText,
            border: `2px solid ${primaryBgText}40`
          }}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year} Season
            </option>
          ))}
        </select>
      </div>

      {/* Awards by Category */}
      {Object.entries(categories).map(([categoryKey, category]) => {
        if (category.awards.length === 0) return null

        return (
          <div key={categoryKey}>
            <h2
              className="text-xl font-bold mb-4 px-2"
              style={{ color: secondaryBgText }}
            >
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.awards.map(({ key, data }) => (
                <AwardCard key={key} awardKey={key} awardData={data} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
