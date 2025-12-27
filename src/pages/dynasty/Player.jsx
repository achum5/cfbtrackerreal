import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getTeamLogo } from '../../data/teams'
import { getAbbreviationFromDisplayName, teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamColors } from '../../data/teamColors'
import PlayerEditModal from '../../components/PlayerEditModal'
import OverallProgressionModal from '../../components/OverallProgressionModal'

// Map abbreviation to mascot name for logo lookup
const getMascotName = (abbr) => {
  const mascotMap = {
    'BAMA': 'Alabama Crimson Tide', 'AFA': 'Air Force Falcons', 'AKR': 'Akron Zips',
    'APP': 'Appalachian State Mountaineers', 'ARIZ': 'Arizona Wildcats', 'ARK': 'Arkansas Razorbacks',
    'ARMY': 'Army Black Knights', 'ARST': 'Arkansas State Red Wolves', 'ASU': 'Arizona State Sun Devils',
    'AUB': 'Auburn Tigers', 'BALL': 'Ball State Cardinals', 'BC': 'Boston College Eagles',
    'BGSU': 'Bowling Green Falcons', 'BOIS': 'Boise State Broncos', 'BU': 'Baylor Bears',
    'BUFF': 'Buffalo Bulls', 'BYU': 'Brigham Young Cougars', 'CAL': 'California Golden Bears',
    'CCU': 'Coastal Carolina Chanticleers', 'CHAR': 'Charlotte 49ers', 'CINN': 'Cincinnati Bearcats',
    'CLEM': 'Clemson Tigers', 'CMU': 'Central Michigan Chippewas', 'COLO': 'Colorado Buffaloes',
    'CONN': 'Connecticut Huskies', 'CSU': 'Colorado State Rams', 'DUKE': 'Duke Blue Devils',
    'ECU': 'East Carolina Pirates', 'EMU': 'Eastern Michigan Eagles', 'FAU': 'Florida Atlantic Owls',
    'FIU': 'Florida International Panthers', 'FLA': 'Florida Gators', 'FRES': 'Fresno State Bulldogs',
    'FSU': 'Florida State Seminoles', 'GASO': 'Georgia Southern Eagles', 'GSU': 'Georgia State Panthers',
    'GT': 'Georgia Tech Yellow Jackets', 'HAW': 'Hawaii Rainbow Warriors', 'HOU': 'Houston Cougars',
    'ILL': 'Illinois Fighting Illini', 'IU': 'Indiana Hoosiers', 'IOWA': 'Iowa Hawkeyes',
    'ISU': 'Iowa State Cyclones', 'JKST': 'Jacksonville State Gamecocks', 'JMU': 'James Madison Dukes',
    'KENN': 'Kennesaw State Owls', 'KENT': 'Kent State Golden Flashes', 'KSU': 'Kansas State Wildcats',
    'KU': 'Kansas Jayhawks', 'LIB': 'Liberty Flames', 'LOU': 'Louisville Cardinals',
    'LSU': 'LSU Tigers', 'LT': 'Louisiana Tech Bulldogs', 'M-OH': 'Miami Redhawks',
    'MASS': 'Massachusetts Minutemen', 'MEM': 'Memphis Tigers', 'MIA': 'Miami Hurricanes',
    'MICH': 'Michigan Wolverines', 'MINN': 'Minnesota Golden Gophers', 'MISS': 'Ole Miss Rebels',
    'MIZ': 'Missouri Tigers', 'MRSH': 'Marshall Thundering Herd', 'MRYD': 'Maryland Terrapins',
    'MSST': 'Mississippi State Bulldogs', 'MSU': 'Michigan State Spartans',
    'MTSU': 'Middle Tennessee State Blue Raiders', 'NAVY': 'Navy Midshipmen',
    'NCST': 'North Carolina State Wolfpack', 'ND': 'Notre Dame Fighting Irish',
    'NEB': 'Nebraska Cornhuskers', 'NEV': 'Nevada Wolf Pack', 'NIU': 'Northern Illinois Huskies',
    'NMSU': 'New Mexico State Aggies', 'NU': 'Northwestern Wildcats', 'ODU': 'Old Dominion Monarchs',
    'OHIO': 'Ohio Bobcats', 'OSU': 'Ohio State Buckeyes', 'OKST': 'Oklahoma State Cowboys',
    'ORE': 'Oregon Ducks', 'ORST': 'Oregon State Beavers', 'OU': 'Oklahoma Sooners',
    'PITT': 'Pittsburgh Panthers', 'PSU': 'Penn State Nittany Lions', 'PUR': 'Purdue Boilermakers',
    'RICE': 'Rice Owls', 'RUTG': 'Rutgers Scarlet Knights', 'SCAR': 'South Carolina Gamecocks',
    'SDSU': 'San Diego State Aztecs', 'SHSU': 'Sam Houston State Bearkats', 'SJSU': 'San Jose State Spartans',
    'SMU': 'SMU Mustangs', 'STAN': 'Stanford Cardinal', 'SYR': 'Syracuse Orange',
    'TAMU': 'Texas A&M Aggies', 'TCU': 'TCU Horned Frogs', 'TEM': 'Temple Owls',
    'TENN': 'Tennessee Volunteers', 'TEX': 'Texas Longhorns', 'TLNE': 'Tulane Green Wave',
    'TLSA': 'Tulsa Golden Hurricane', 'TOL': 'Toledo Rockets', 'TROY': 'Troy Trojans',
    'TTU': 'Texas Tech Red Raiders', 'TXST': 'Texas State Bobcats', 'UAB': 'UAB Blazers',
    'UC': 'Cincinnati Bearcats', 'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins', 'UGA': 'Georgia Bulldogs',
    'UK': 'Kentucky Wildcats', 'ULL': 'Lafayette Ragin\' Cajuns', 'ULM': 'Monroe Warhawks',
    'UNC': 'North Carolina Tar Heels', 'UNLV': 'UNLV Rebels', 'UNM': 'New Mexico Lobos',
    'UNT': 'North Texas Mean Green', 'USA': 'South Alabama Jaguars', 'USC': 'USC Trojans',
    'USF': 'South Florida Bulls', 'USM': 'Southern Mississippi Golden Eagles',
    'USU': 'Utah State Aggies', 'UTAH': 'Utah Utes', 'UTEP': 'UTEP Miners',
    'UTSA': 'UTSA Roadrunners', 'UVA': 'Virginia Cavaliers', 'VAND': 'Vanderbilt Commodores',
    'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons', 'WASH': 'Washington Huskies',
    'WIS': 'Wisconsin Badgers', 'WKU': 'Western Kentucky Hilltoppers', 'WMU': 'Western Michigan Broncos',
    'WSU': 'Washington State Cougars', 'WVU': 'West Virginia Mountaineers', 'WYO': 'Wyoming Cowboys',
    'DEL': 'Delaware Fightin\' Blue Hens', 'GAST': 'Georgia State Panthers', 'MZST': 'Missouri State Bears',
    'OKLA': 'Oklahoma Sooners', 'RUT': 'Rutgers Scarlet Knights', 'TUL': 'Tulane Green Wave',
    'TULN': 'Tulane Green Wave', 'TXAM': 'Texas A&M Aggies', 'TXTECH': 'Texas Tech Red Raiders',
    'UF': 'Florida Gators', 'UH': 'Houston Cougars', 'UL': 'Lafayette Ragin\' Cajuns',
    'UM': 'Miami Hurricanes', 'UMD': 'Maryland Terrapins', 'UT': 'Tennessee Volunteers',
    'VAN': 'Vanderbilt Commodores',
    // FCS teams
    'FCSE': 'FCS East Judicials', 'FCSM': 'FCS Midwest Rebels',
    'FCSN': 'FCS Northwest Stallions', 'FCSW': 'FCS West Titans'
  }
  return mascotMap[abbr] || null
}

// Class progression order
const CLASS_ORDER = ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr']

// Determine primary stat category for a position (where G/Snaps should appear)
const getPrimaryStatCategory = (position) => {
  const positionMap = {
    'QB': 'passing',
    'HB': 'rushing', 'FB': 'rushing',
    'WR': 'receiving', 'TE': 'receiving',
    'LT': 'blocking', 'LG': 'blocking', 'C': 'blocking', 'RG': 'blocking', 'RT': 'blocking',
    'LEDG': 'defense', 'REDG': 'defense', 'DT': 'defense',
    'SAM': 'defense', 'MIKE': 'defense', 'WILL': 'defense',
    'CB': 'defense', 'FS': 'defense', 'SS': 'defense',
    'K': 'kicking',
    'P': 'punting'
  }
  return positionMap[position] || 'passing'
}

export default function Player() {
  const { id: dynastyId, pid } = useParams()
  const { dynasties, currentDynasty, updatePlayer } = useDynasty()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAccoladeModal, setShowAccoladeModal] = useState(false)
  const [accoladeType, setAccoladeType] = useState(null)
  const [showOverallProgressionModal, setShowOverallProgressionModal] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pid])

  const dynasty = currentDynasty?.id === dynastyId ? currentDynasty : dynasties.find(d => d.id === dynastyId)
  const player = dynasty?.players?.find(p => p.pid === parseInt(pid))

  if (!dynasty) {
    return <div className="text-center py-12"><p className="text-gray-600">Dynasty not found</p></div>
  }

  if (!player) {
    return <div className="text-center py-12"><p className="text-gray-600">Player not found</p></div>
  }

  // Determine the player's team from their team field
  // Falls back to dynasty.teamName only for legacy players without a team field
  const playerTeamAbbr = player.team
    || player.teams?.[0]
    || getAbbreviationFromDisplayName(dynasty.teamName)

  // Get the full team name from the abbreviation
  const playerTeamName = getMascotName(playerTeamAbbr)
    || teamAbbreviations[playerTeamAbbr]?.name
    || dynasty.teamName

  const teamColors = useTeamColors(playerTeamName)
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)
  const teamAbbr = playerTeamAbbr

  // Check if player was drafted
  const getDraftInfo = () => {
    const draftResultsByYear = dynasty.draftResultsByYear || {}
    for (const [year, results] of Object.entries(draftResultsByYear)) {
      if (!results) continue
      const draftResult = results.find(r => r.pid === player.pid || r.playerName === player.name)
      if (draftResult) {
        return { year: parseInt(year), ...draftResult }
      }
    }
    return null
  }
  const draftInfo = getDraftInfo()

  // Calculate POW honors
  const calculatePOWHonors = () => {
    const games = dynasty.games || []
    let confPOW = 0, nationalPOW = 0
    const confPOWGames = [], nationalPOWGames = []

    games.forEach(game => {
      if (game.conferencePOW === player.name) { confPOW++; confPOWGames.push(game) }
      if (game.nationalPOW === player.name) { nationalPOW++; nationalPOWGames.push(game) }
    })

    return { confPOW, nationalPOW, confPOWGames, nationalPOWGames }
  }

  const powHonors = calculatePOWHonors()

  const handleAccoladeClick = (type) => {
    setAccoladeType(type)
    setShowAccoladeModal(true)
  }

  const getTeamNameFromAbbr = (abbr) => teamAbbreviations[abbr]?.name || abbr

  const handlePlayerSave = async (updatedPlayer, yearStats) => {
    await updatePlayer(dynastyId, updatedPlayer, yearStats)
    setShowEditModal(false)
  }

  // Get year-by-year stats for this player
  const getYearByYearStats = () => {
    const playerStatsByYear = dynasty.playerStatsByYear || {}
    const detailedStatsByYear = dynasty.detailedStatsByYear || {}
    const playerPid = player.pid
    const years = []

    // Get all years that have any data for this player
    const allYears = new Set([
      ...Object.keys(playerStatsByYear),
      ...Object.keys(detailedStatsByYear)
    ])

    // Sort years chronologically
    const sortedYears = Array.from(allYears).sort((a, b) => parseInt(a) - parseInt(b))

    sortedYears.forEach(year => {
      const basicStats = playerStatsByYear[year]?.find(p => p.pid === playerPid)
      const detailedYear = detailedStatsByYear[year] || {}

      // Find player in each stat category
      const findInTab = (tabName) => detailedYear[tabName]?.find(p => p.pid === playerPid)

      const passing = findInTab('Passing')
      const rushing = findInTab('Rushing')
      const receiving = findInTab('Receiving')
      const blocking = findInTab('Blocking')
      const defensive = findInTab('Defensive')
      const kicking = findInTab('Kicking')
      const punting = findInTab('Punting')
      const kickReturn = findInTab('Kick Return')
      const puntReturn = findInTab('Punt Return')

      // Only add year if player has any data
      if (basicStats || passing || rushing || receiving || blocking || defensive || kicking || punting || kickReturn || puntReturn) {
        years.push({
          year: parseInt(year),
          class: basicStats?.year || '-',
          gamesPlayed: basicStats?.gamesPlayed || 0,
          snapsPlayed: basicStats?.snapsPlayed || 0,
          passing: passing ? {
            cmp: passing['Completions'] || 0,
            att: passing['Attempts'] || 0,
            yds: passing['Yards'] || 0,
            td: passing['Touchdowns'] || 0,
            int: passing['Interceptions'] || 0,
            lng: passing['Passing Long'] || 0,
            sacks: passing['Sacks Taken'] || 0
          } : null,
          rushing: rushing ? {
            car: rushing['Carries'] || 0,
            yds: rushing['Yards'] || 0,
            td: rushing['Touchdowns'] || 0,
            lng: rushing['Rushing Long'] || 0,
            fum: rushing['Fumbles'] || 0,
            bt: rushing['Broken Tackles'] || 0
          } : null,
          receiving: receiving ? {
            rec: receiving['Receptions'] || 0,
            yds: receiving['Yards'] || 0,
            td: receiving['Touchdowns'] || 0,
            lng: receiving['Receiving Long'] || 0,
            drops: receiving['Drops'] || 0
          } : null,
          blocking: blocking ? {
            sacksAllowed: blocking['Sacks Allowed'] || 0
          } : (basicStats && basicStats.snapsPlayed > 0 && ['LT', 'LG', 'C', 'RG', 'RT'].includes(basicStats.position || player.position) ? {
            sacksAllowed: 0
          } : null),
          defensive: defensive ? {
            solo: defensive['Solo Tackles'] || 0,
            ast: defensive['Assisted Tackles'] || 0,
            tfl: defensive['Tackles for Loss'] || 0,
            sacks: defensive['Sacks'] || 0,
            int: defensive['Interceptions'] || 0,
            intYds: defensive['INT Return Yards'] || 0,
            intTd: defensive['Defensive TDs'] || 0,
            pdef: defensive['Deflections'] || 0,
            ff: defensive['Forced Fumbles'] || 0,
            fr: defensive['Fumble Recoveries'] || 0
          } : null,
          kicking: kicking ? {
            fgm: kicking['FG Made'] || 0,
            fga: kicking['FG Attempted'] || 0,
            lng: kicking['FG Long'] || 0,
            xpm: kicking['XP Made'] || 0,
            xpa: kicking['XP Attempted'] || 0
          } : null,
          punting: punting ? {
            punts: punting['Punts'] || 0,
            yds: punting['Punting Yards'] || 0,
            lng: punting['Punt Long'] || 0,
            in20: punting['Punts Inside 20'] || 0,
            tb: punting['Touchbacks'] || 0
          } : null,
          kickReturn: kickReturn ? {
            ret: kickReturn['Kickoff Returns'] || 0,
            yds: kickReturn['KR Yardage'] || 0,
            td: kickReturn['KR Touchdowns'] || 0,
            lng: kickReturn['KR Long'] || 0
          } : null,
          puntReturn: puntReturn ? {
            ret: puntReturn['Punt Returns'] || 0,
            yds: puntReturn['PR Yardage'] || 0,
            td: puntReturn['PR Touchdowns'] || 0,
            lng: puntReturn['PR Long'] || 0
          } : null
        })
      }
    })

    return years
  }

  const yearByYearStats = getYearByYearStats()

  // Calculate career totals
  const calculateCareerTotals = (years, statKey, fields) => {
    const totals = {}
    fields.forEach(field => {
      if (field === 'lng') {
        // Take max for long fields
        totals[field] = Math.max(...years.filter(y => y[statKey]).map(y => y[statKey][field] || 0), 0)
      } else {
        // Sum everything else
        totals[field] = years.filter(y => y[statKey]).reduce((sum, y) => sum + (y[statKey][field] || 0), 0)
      }
    })
    return totals
  }

  // Check which stat categories this player has data for
  const hasStats = {
    passing: yearByYearStats.some(y => y.passing),
    rushing: yearByYearStats.some(y => y.rushing),
    receiving: yearByYearStats.some(y => y.receiving),
    blocking: yearByYearStats.some(y => y.blocking),
    defensive: yearByYearStats.some(y => y.defensive),
    kicking: yearByYearStats.some(y => y.kicking),
    punting: yearByYearStats.some(y => y.punting),
    kickReturn: yearByYearStats.some(y => y.kickReturn),
    puntReturn: yearByYearStats.some(y => y.puntReturn)
  }

  // Calculate averages
  const calcPct = (a, b) => b > 0 ? (a / b * 100).toFixed(1) : '0.0'
  const calcAvg = (a, b) => b > 0 ? (a / b).toFixed(1) : '0.0'

  // Career totals for each stat category
  const careerPassing = hasStats.passing ? calculateCareerTotals(yearByYearStats, 'passing', ['cmp', 'att', 'yds', 'td', 'int', 'lng', 'sacks']) : null
  const careerRushing = hasStats.rushing ? calculateCareerTotals(yearByYearStats, 'rushing', ['car', 'yds', 'td', 'lng', 'fum', 'bt']) : null
  const careerReceiving = hasStats.receiving ? calculateCareerTotals(yearByYearStats, 'receiving', ['rec', 'yds', 'td', 'lng', 'drops']) : null
  const careerBlocking = hasStats.blocking ? calculateCareerTotals(yearByYearStats, 'blocking', ['sacksAllowed']) : null
  const careerDefensive = hasStats.defensive ? calculateCareerTotals(yearByYearStats, 'defensive', ['solo', 'ast', 'tfl', 'sacks', 'int', 'intYds', 'intTd', 'pdef', 'ff', 'fr']) : null
  const careerKicking = hasStats.kicking ? calculateCareerTotals(yearByYearStats, 'kicking', ['fgm', 'fga', 'lng', 'xpm', 'xpa']) : null
  const careerPunting = hasStats.punting ? calculateCareerTotals(yearByYearStats, 'punting', ['punts', 'yds', 'lng', 'in20', 'tb']) : null
  const careerKickReturn = hasStats.kickReturn ? calculateCareerTotals(yearByYearStats, 'kickReturn', ['ret', 'yds', 'td', 'lng']) : null
  const careerPuntReturn = hasStats.puntReturn ? calculateCareerTotals(yearByYearStats, 'puntReturn', ['ret', 'yds', 'td', 'lng']) : null

  // Total games and snaps
  const careerGames = yearByYearStats.reduce((sum, y) => sum + (y.gamesPlayed || 0), 0)
  const careerSnaps = yearByYearStats.reduce((sum, y) => sum + (y.snapsPlayed || 0), 0)

  // Check if player has any meaningful stats (non-zero games or any stat category with data)
  // Recruits never show stats - they haven't enrolled yet
  const hasMeaningfulStats = !player.isRecruit && (
    careerGames > 0 || careerSnaps > 0 || Object.values(hasStats).some(v => v)
  )

  // Get recruitment info for recruits from the recruiting commitments data
  const getRecruitmentInfo = () => {
    if (!player.isRecruit) return null
    const recruitYear = player.recruitYear || dynasty.currentYear
    const commitments = dynasty.recruitingCommitmentsByTeamYear?.[playerTeamAbbr]?.[recruitYear] || {}

    // Search through all commitment weeks for this player
    for (const [, weekCommits] of Object.entries(commitments)) {
      if (Array.isArray(weekCommits)) {
        const found = weekCommits.find(c => c.name?.toLowerCase().trim() === player.name?.toLowerCase().trim())
        if (found) return found
      }
    }
    return null
  }
  const recruitmentInfo = getRecruitmentInfo()

  return (
    <div className="space-y-6">
      {/* Player Header */}
      <div
        className="rounded-lg shadow-lg p-4 sm:p-6"
        style={{ backgroundColor: teamColors.primary, border: `3px solid ${teamColors.secondary}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {player.pictureUrl && (
              <img
                src={player.pictureUrl}
                alt={player.name}
                className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg border-2 flex-shrink-0"
                style={{ borderColor: teamColors.secondary }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate" style={{ color: primaryText }}>
                  {player.name}
                </h1>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-1.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
                  style={{ color: primaryText }}
                  title="Edit Player"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Link
                  to={`/dynasty/${dynastyId}/team/${teamAbbr}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                  style={{ color: primaryText, opacity: 0.9 }}
                >
                  {getTeamLogo(playerTeamName) && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', padding: '3px' }}>
                      <img src={getTeamLogo(playerTeamName)} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                  {playerTeamName}
                </Link>
                {player.isRecruit && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: teamColors.secondary, color: secondaryText }}
                  >
                    Commitment
                  </span>
                )}
                {player.leftTeam && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: '#6b7280', color: '#ffffff' }}
                  >
                    {player.leftReason === 'Pro Draft' && player.draftRound
                      ? `${player.leftYear} NFL Draft - Round ${player.draftRound}`
                      : player.leftReason === 'Pro Draft'
                      ? `${player.leftYear} NFL Draft`
                      : player.leftReason === 'Graduating'
                      ? `Graduated (${player.leftYear})`
                      : player.leftReason === 'Transfer' || player.leftReason === 'Encouraged Transfer'
                      ? `Transferred (${player.leftYear})`
                      : player.leftReason
                      ? `${player.leftReason} (${player.leftYear})`
                      : `Left Team (${player.leftYear})`}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: primaryText, opacity: 0.85 }}>
                {player.jerseyNumber != null && player.jerseyNumber !== '' && <span className="font-bold">#{player.jerseyNumber}</span>}
                {player.jerseyNumber != null && player.jerseyNumber !== '' && <span className="opacity-50">|</span>}
                <span className="font-semibold">{player.position}</span>
                {player.archetype && <><span className="opacity-50">|</span><span>{player.archetype}</span></>}
                <span className="opacity-50">|</span>
                <span>{player.year}</span>
                {player.devTrait && <><span className="opacity-50">|</span><span>{player.devTrait}</span></>}
                {(player.height || player.weight) && (
                  <><span className="opacity-50">|</span><span>{player.height}{player.height && player.weight && ', '}{player.weight ? `${player.weight} lbs` : ''}</span></>
                )}
                {(player.hometown || player.state) && (
                  <><span className="opacity-50">|</span><span>{player.hometown}{player.hometown && player.state && ', '}{player.state}</span></>
                )}
              </div>
            </div>
          </div>

          {/* Overall Rating */}
          {player.overall ? (
            <div className="text-center flex-shrink-0">
              <div className="text-xs mb-1" style={{ color: primaryText, opacity: 0.7 }}>OVR</div>
              <button
                onClick={() => setShowOverallProgressionModal(true)}
                className="text-5xl md:text-6xl font-bold hover:opacity-80 transition-opacity cursor-pointer"
                style={{ color: teamColors.secondary }}
                title="View overall progression"
              >
                {player.overall}
              </button>
            </div>
          ) : (
            <div className="text-center flex-shrink-0">
              <div className="text-xs mb-1" style={{ color: primaryText, opacity: 0.7 }}>OVR</div>
              <div
                className="text-5xl md:text-6xl font-bold"
                style={{ color: teamColors.secondary, opacity: 0.3 }}
              >
                —
              </div>
            </div>
          )}
        </div>
      </div>

      {/* POW Accolades */}
      {(powHonors.confPOW > 0 || powHonors.nationalPOW > 0) && (
        <div className="flex flex-wrap gap-2">
          {powHonors.confPOW > 0 && (
            <button
              onClick={() => handleAccoladeClick('confPOW')}
              className="px-4 py-2 rounded-full font-semibold text-sm hover:opacity-80 transition-opacity"
              style={{ backgroundColor: teamColors.primary, color: primaryText }}
            >
              Conference POW {powHonors.confPOW}x
            </button>
          )}
          {powHonors.nationalPOW > 0 && (
            <button
              onClick={() => handleAccoladeClick('nationalPOW')}
              className="px-4 py-2 rounded-full font-semibold text-sm hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#fbbf24', color: '#78350f' }}
            >
              National POW {powHonors.nationalPOW}x
            </button>
          )}
        </div>
      )}

      {/* Career Honors (Awards, All-Americans, All-Conference) */}
      {((player.awards && player.awards.length > 0) ||
        (player.allAmericans && player.allAmericans.length > 0) ||
        (player.allConference && player.allConference.length > 0)) && (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{ backgroundColor: teamColors.secondary, border: `3px solid ${teamColors.primary}` }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: secondaryText }}>Career Honors</h2>

          {/* Awards */}
          {player.awards && player.awards.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: secondaryText, opacity: 0.7 }}>Awards</h3>
              <div className="flex flex-wrap gap-2">
                {player.awards.map((award, idx) => {
                  // Format award name nicely
                  const awardName = award.award
                    ? award.award.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
                    : 'Award'
                  const badgeText = getContrastTextColor(teamColors.primary)
                  return (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: teamColors.primary, color: badgeText }}
                    >
                      <div className="font-bold">{awardName}</div>
                      <div className="text-xs opacity-80">{award.year} • {award.team}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All-Americans */}
          {player.allAmericans && player.allAmericans.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: secondaryText, opacity: 0.7 }}>All-American</h3>
              <div className="flex flex-wrap gap-2">
                {player.allAmericans.map((aa, idx) => {
                  const designation = aa.designation === 'first' ? '1st Team' :
                                      aa.designation === 'second' ? '2nd Team' : 'Freshman'
                  const badgeColor = aa.designation === 'first' ? teamColors.primary :
                                     aa.designation === 'second' ? '#6B7280' : '#3B82F6'
                  const badgeText = getContrastTextColor(badgeColor)
                  return (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: badgeColor, color: badgeText }}
                    >
                      <div className="font-bold">{designation} All-American</div>
                      <div className="text-xs opacity-80">{aa.year} • {aa.position} • {aa.school}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All-Conference */}
          {player.allConference && player.allConference.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: secondaryText, opacity: 0.7 }}>All-Conference</h3>
              <div className="flex flex-wrap gap-2">
                {player.allConference.map((ac, idx) => {
                  const designation = ac.designation === 'first' ? '1st Team' :
                                      ac.designation === 'second' ? '2nd Team' : 'Freshman'
                  const badgeColor = ac.designation === 'first' ? teamColors.primary :
                                     ac.designation === 'second' ? '#6B7280' : '#3B82F6'
                  const badgeText = getContrastTextColor(badgeColor)
                  return (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: badgeColor, color: badgeText }}
                    >
                      <div className="font-bold">{designation} All-Conference</div>
                      <div className="text-xs opacity-80">{ac.year} • {ac.position} • {ac.school}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draft Status */}
      {draftInfo && (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{ backgroundColor: teamColors.secondary, border: `3px solid ${teamColors.primary}` }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: secondaryText }}>Pro Career</h2>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: teamColors.primary }}
            >
              <svg className="w-8 h-8" fill="none" stroke={primaryText} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: secondaryText }}>
                {draftInfo.draftRound === 'Undrafted' ? 'Undrafted' : `${draftInfo.draftRound} Pick`}
              </div>
              <div className="text-sm" style={{ color: secondaryText, opacity: 0.8 }}>
                {draftInfo.year} NFL Draft
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recruitment Information - Compact display for recruits without stats */}
      {player.isRecruit && !hasMeaningfulStats && recruitmentInfo && (
        <div
          className="rounded-lg shadow px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ backgroundColor: teamColors.secondary, border: `2px solid ${teamColors.primary}` }}
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Recruit Year */}
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ backgroundColor: teamColors.primary, color: primaryText }}
            >
              {player.recruitYear || dynasty.currentYear} Recruit
            </span>
            {/* Stars */}
            {recruitmentInfo.stars && (
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" fill={i < Number(recruitmentInfo.stars) ? '#FFD700' : '#D1D5DB'} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}
            {/* Rankings inline */}
            {recruitmentInfo.nationalRank && (
              <span className="font-semibold" style={{ color: secondaryText }}>
                #{recruitmentInfo.nationalRank} <span style={{ opacity: 0.6 }}>Nat'l</span>
              </span>
            )}
            {recruitmentInfo.positionRank && (
              <span className="font-semibold" style={{ color: secondaryText }}>
                #{recruitmentInfo.positionRank} <span style={{ opacity: 0.6 }}>{player.position}</span>
              </span>
            )}
            {recruitmentInfo.stateRank && (
              <span className="font-semibold" style={{ color: secondaryText }}>
                #{recruitmentInfo.stateRank} <span style={{ opacity: 0.6 }}>{recruitmentInfo.state || player.state}</span>
              </span>
            )}
            {recruitmentInfo.previousTeam && (
              <span style={{ color: secondaryText }}>
                <span style={{ opacity: 0.6 }}>from</span> <span className="font-semibold">{recruitmentInfo.previousTeam}</span>
              </span>
            )}
            {recruitmentInfo.gemBust && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: recruitmentInfo.gemBust.toLowerCase() === 'gem' ? '#10B981' : '#EF4444',
                  color: 'white'
                }}
              >
                {recruitmentInfo.gemBust.toLowerCase() === 'gem' ? '💎 Gem' : '💥 Bust'}
              </span>
            )}
          </div>
          <Link
            to={`/dynasty/${dynastyId}/recruiting/${playerTeamAbbr}/${player.recruitYear || dynasty.currentYear}`}
            className="text-sm font-medium hover:underline"
            style={{ color: teamColors.primary }}
          >
            View Class →
          </Link>
        </div>
      )}

      {/* Career Statistics - Football Reference Style */}
      {hasMeaningfulStats && (() => {
        const primaryStat = getPrimaryStatCategory(player.position)
        return (
        <div className="space-y-6">
          {/* Passing Table */}
          {hasStats.passing && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Passing</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', ...(primaryStat === 'passing' ? ['G', 'Snaps'] : []), 'Cmp', 'Att', 'Pct', 'Yds', 'Y/A', 'TD', 'Int', 'Lng', 'Sck'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.passing).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          {primaryStat === 'passing' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                          {primaryStat === 'passing' && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{y.passing.cmp}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.passing.att}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{calcPct(y.passing.cmp, y.passing.att)}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.passing.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.passing.yds, y.passing.att)}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.passing.td}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.passing.int}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.passing.lng}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.passing.sacks}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      {primaryStat === 'passing' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                      {primaryStat === 'passing' && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                      <td className="px-2 py-2 text-right">{careerPassing.cmp}</td>
                      <td className="px-2 py-2 text-right">{careerPassing.att}</td>
                      <td className="px-2 py-2 text-right">{calcPct(careerPassing.cmp, careerPassing.att)}</td>
                      <td className="px-2 py-2 text-right">{careerPassing.yds.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerPassing.yds, careerPassing.att)}</td>
                      <td className="px-2 py-2 text-right">{careerPassing.td}</td>
                      <td className="px-2 py-2 text-right">{careerPassing.int}</td>
                      <td className="px-2 py-2 text-right">{careerPassing.lng}</td>
                      <td className="px-2 py-2 text-right">{careerPassing.sacks}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Rushing Table */}
          {hasStats.rushing && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Rushing</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', ...(primaryStat === 'rushing' ? ['G', 'Snaps'] : []), 'Car', 'Yds', 'Y/C', 'TD', 'Lng', 'Fum', 'BTkl'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.rushing).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          {primaryStat === 'rushing' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                          {primaryStat === 'rushing' && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{y.rushing.car}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.rushing.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.rushing.yds, y.rushing.car)}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.rushing.td}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.rushing.lng}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.rushing.fum}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.rushing.bt}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      {primaryStat === 'rushing' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                      {primaryStat === 'rushing' && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                      <td className="px-2 py-2 text-right">{careerRushing.car}</td>
                      <td className="px-2 py-2 text-right">{careerRushing.yds.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerRushing.yds, careerRushing.car)}</td>
                      <td className="px-2 py-2 text-right">{careerRushing.td}</td>
                      <td className="px-2 py-2 text-right">{careerRushing.lng}</td>
                      <td className="px-2 py-2 text-right">{careerRushing.fum}</td>
                      <td className="px-2 py-2 text-right">{careerRushing.bt}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Receiving Table */}
          {hasStats.receiving && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Receiving</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', ...(primaryStat === 'receiving' ? ['G', 'Snaps'] : []), 'Rec', 'Yds', 'Y/R', 'TD', 'Lng', 'Drops'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.receiving).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          {primaryStat === 'receiving' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                          {primaryStat === 'receiving' && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{y.receiving.rec}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.receiving.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.receiving.yds, y.receiving.rec)}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.receiving.td}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.receiving.lng}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.receiving.drops}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      {primaryStat === 'receiving' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                      {primaryStat === 'receiving' && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                      <td className="px-2 py-2 text-right">{careerReceiving.rec}</td>
                      <td className="px-2 py-2 text-right">{careerReceiving.yds.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerReceiving.yds, careerReceiving.rec)}</td>
                      <td className="px-2 py-2 text-right">{careerReceiving.td}</td>
                      <td className="px-2 py-2 text-right">{careerReceiving.lng}</td>
                      <td className="px-2 py-2 text-right">{careerReceiving.drops}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Blocking Table */}
          {hasStats.blocking && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Blocking</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', ...(primaryStat === 'blocking' ? ['G', 'Snaps'] : []), 'Sacks Allowed'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.blocking).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          {primaryStat === 'blocking' && <td className="px-2 py-2 text-right">{y.gamesPlayed || 0}</td>}
                          {primaryStat === 'blocking' && <td className="px-2 py-2 text-right text-gray-500">{(y.snapsPlayed || 0).toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right font-medium">{y.blocking.sacksAllowed}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      {primaryStat === 'blocking' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                      {primaryStat === 'blocking' && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                      <td className="px-2 py-2 text-right">{careerBlocking.sacksAllowed}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Defense Table */}
          {hasStats.defensive && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Defense</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', ...(primaryStat === 'defense' ? ['G', 'Snaps'] : []), 'Solo', 'Ast', 'Tot', 'TFL', 'Sck', 'Int', 'IntYd', 'TD', 'PD', 'FF', 'FR'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.defensive).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          {primaryStat === 'defense' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                          {primaryStat === 'defense' && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right text-gray-500">{y.defensive.solo}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.defensive.ast}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.defensive.solo + y.defensive.ast}</td>
                          <td className="px-2 py-2 text-right">{y.defensive.tfl}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.defensive.sacks}</td>
                          <td className="px-2 py-2 text-right">{y.defensive.int}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.defensive.intYds}</td>
                          <td className="px-2 py-2 text-right">{y.defensive.intTd}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.defensive.pdef}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.defensive.ff}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.defensive.fr}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      {primaryStat === 'defense' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                      {primaryStat === 'defense' && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                      <td className="px-2 py-2 text-right">{careerDefensive.solo}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.ast}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.solo + careerDefensive.ast}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.tfl}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.sacks}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.int}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.intYds}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.intTd}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.pdef}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.ff}</td>
                      <td className="px-2 py-2 text-right">{careerDefensive.fr}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Kicking Table */}
          {hasStats.kicking && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Kicking</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', ...(primaryStat === 'kicking' ? ['G', 'Snaps'] : []), 'FGM', 'FGA', 'FG%', 'Lng', 'XPM', 'XPA', 'XP%'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.kicking).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          {primaryStat === 'kicking' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                          {primaryStat === 'kicking' && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right font-medium">{y.kicking.fgm}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.kicking.fga}</td>
                          <td className="px-2 py-2 text-right">{calcPct(y.kicking.fgm, y.kicking.fga)}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.kicking.lng}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.kicking.xpm}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.kicking.xpa}</td>
                          <td className="px-2 py-2 text-right">{calcPct(y.kicking.xpm, y.kicking.xpa)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      {primaryStat === 'kicking' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                      {primaryStat === 'kicking' && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                      <td className="px-2 py-2 text-right">{careerKicking.fgm}</td>
                      <td className="px-2 py-2 text-right">{careerKicking.fga}</td>
                      <td className="px-2 py-2 text-right">{calcPct(careerKicking.fgm, careerKicking.fga)}</td>
                      <td className="px-2 py-2 text-right">{careerKicking.lng}</td>
                      <td className="px-2 py-2 text-right">{careerKicking.xpm}</td>
                      <td className="px-2 py-2 text-right">{careerKicking.xpa}</td>
                      <td className="px-2 py-2 text-right">{calcPct(careerKicking.xpm, careerKicking.xpa)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Punting Table */}
          {hasStats.punting && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Punting</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', ...(primaryStat === 'punting' ? ['G', 'Snaps'] : []), 'Punts', 'Yds', 'Avg', 'Lng', 'In20', 'TB'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.punting).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          {primaryStat === 'punting' && <td className="px-2 py-2 text-right">{y.gamesPlayed}</td>}
                          {primaryStat === 'punting' && <td className="px-2 py-2 text-right text-gray-500">{y.snapsPlayed.toLocaleString()}</td>}
                          <td className="px-2 py-2 text-right">{y.punting.punts}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.punting.yds.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right font-medium">{calcAvg(y.punting.yds, y.punting.punts)}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.punting.lng}</td>
                          <td className="px-2 py-2 text-right">{y.punting.in20}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.punting.tb}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      {primaryStat === 'punting' && <td className="px-2 py-2 text-right">{careerGames}</td>}
                      {primaryStat === 'punting' && <td className="px-2 py-2 text-right">{careerSnaps.toLocaleString()}</td>}
                      <td className="px-2 py-2 text-right">{careerPunting.punts}</td>
                      <td className="px-2 py-2 text-right">{careerPunting.yds.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerPunting.yds, careerPunting.punts)}</td>
                      <td className="px-2 py-2 text-right">{careerPunting.lng}</td>
                      <td className="px-2 py-2 text-right">{careerPunting.in20}</td>
                      <td className="px-2 py-2 text-right">{careerPunting.tb}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Kick Returns Table */}
          {hasStats.kickReturn && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Kick Returns</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', 'Ret', 'Yds', 'Avg', 'TD', 'Lng'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.kickReturn).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          <td className="px-2 py-2 text-right">{y.kickReturn.ret}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.kickReturn.yds}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.kickReturn.yds, y.kickReturn.ret)}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.kickReturn.td}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.kickReturn.lng}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.ret}</td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.yds}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerKickReturn.yds, careerKickReturn.ret)}</td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.td}</td>
                      <td className="px-2 py-2 text-right">{careerKickReturn.lng}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Punt Returns Table */}
          {hasStats.puntReturn && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b-2" style={{ backgroundColor: teamColors.primary, borderColor: teamColors.primary }}>
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: primaryText }}>Punt Returns</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Year', 'Class', 'Team', 'Ret', 'Yds', 'Avg', 'TD', 'Lng'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 text-xs font-semibold text-gray-600 uppercase ${i < 2 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearByYearStats.filter(y => y.puntReturn).map((y, idx) => {
                      const mascot = getMascotName(teamAbbr)
                      const logo = mascot ? getTeamLogo(mascot) : null
                      return (
                        <tr key={y.year} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-2 font-medium text-gray-900">{y.year}</td>
                          <td className="px-2 py-2 text-gray-600">{y.class}</td>
                          <td className="px-2 py-2 text-center">{logo ? <img src={logo} alt={teamAbbr} className="w-5 h-5 object-contain inline-block" /> : teamAbbr}</td>
                          <td className="px-2 py-2 text-right">{y.puntReturn.ret}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.puntReturn.yds}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{calcAvg(y.puntReturn.yds, y.puntReturn.ret)}</td>
                          <td className="px-2 py-2 text-right font-medium">{y.puntReturn.td}</td>
                          <td className="px-2 py-2 text-right text-gray-500">{y.puntReturn.lng}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold border-t-2" style={{ borderColor: teamColors.primary }}>
                      <td className="px-2 py-2 text-gray-900">Career</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.ret}</td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.yds}</td>
                      <td className="px-2 py-2 text-right">{calcAvg(careerPuntReturn.yds, careerPuntReturn.ret)}</td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.td}</td>
                      <td className="px-2 py-2 text-right">{careerPuntReturn.lng}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* Notes & Media */}
      {(player.notes || (player.links && player.links.length > 0)) && (
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6"
          style={{ backgroundColor: teamColors.secondary, border: `3px solid ${teamColors.primary}` }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: secondaryText }}>Notes & Media</h2>
          {player.notes && (
            <div className="mb-4">
              <div className="p-4 rounded-lg whitespace-pre-wrap" style={{ backgroundColor: `${teamColors.primary}20`, color: secondaryText }}>
                {player.notes}
              </div>
            </div>
          )}
          {player.links && player.links.length > 0 && (
            <div className="space-y-4">
              {/* Embeddable Media */}
              {player.links.filter(link => link.url).map((link, index) => {
                const url = link.url

                // YouTube embed
                if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed')) {
                  let videoId = null
                  if (url.includes('youtube.com/watch')) {
                    const urlParams = new URLSearchParams(url.split('?')[1])
                    videoId = urlParams.get('v')
                  } else if (url.includes('youtu.be/')) {
                    videoId = url.split('youtu.be/')[1]?.split('?')[0]
                  } else if (url.includes('youtube.com/embed/')) {
                    videoId = url.split('youtube.com/embed/')[1]?.split('?')[0]
                  }

                  if (!videoId) return null

                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title={link.title || 'YouTube video'}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )
                }

                // Streamable embed
                if (url.includes('streamable.com/')) {
                  const videoId = url.split('streamable.com/')[1]?.split('?')[0]
                  if (!videoId) return null

                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src={`https://streamable.com/e/${videoId}`}
                          title={link.title || 'Streamable video'}
                          frameBorder="0"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )
                }

                // Imgur image/video embed (supports .mp4, .gifv, .gif, direct images)
                if (url.includes('imgur.com') || url.includes('i.imgur.com')) {
                  // Direct image links
                  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('i.imgur.com')) {
                    // Convert gifv to mp4
                    const displayUrl = url.replace('.gifv', '.mp4')
                    const isVideo = displayUrl.endsWith('.mp4') || displayUrl.endsWith('.gifv')

                    return (
                      <div key={index} className="rounded-lg overflow-hidden">
                        {link.title && (
                          <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                            {link.title}
                          </div>
                        )}
                        {isVideo ? (
                          <video
                            className="w-full max-h-[500px] object-contain bg-black"
                            src={displayUrl}
                            controls
                            loop
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={displayUrl}
                            alt={link.title || 'Imgur image'}
                            className="w-full max-h-[500px] object-contain"
                          />
                        )}
                      </div>
                    )
                  }

                  // Imgur album or post page - extract ID and use embed
                  const imgurMatch = url.match(/imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]+)/)
                  if (imgurMatch) {
                    const imgurId = imgurMatch[1]
                    return (
                      <div key={index} className="rounded-lg overflow-hidden">
                        {link.title && (
                          <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                            {link.title}
                          </div>
                        )}
                        <blockquote className="imgur-embed-pub" lang="en" data-id={imgurId}>
                          <a href={url} target="_blank" rel="noopener noreferrer">View on Imgur</a>
                        </blockquote>
                        <img
                          src={`https://i.imgur.com/${imgurId}.jpg`}
                          alt={link.title || 'Imgur image'}
                          className="w-full max-h-[500px] object-contain"
                          onError={(e) => {
                            // Try .png if .jpg fails
                            if (e.target.src.endsWith('.jpg')) {
                              e.target.src = `https://i.imgur.com/${imgurId}.png`
                            }
                          }}
                        />
                      </div>
                    )
                  }
                }

                // Twitter/X embed (video clips)
                if (url.includes('twitter.com') || url.includes('x.com')) {
                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 hover:opacity-80 transition-opacity flex items-center gap-2"
                        style={{ backgroundColor: `${teamColors.primary}15`, color: secondaryText }}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span className="font-medium">{link.title || 'View on X/Twitter'}</span>
                      </a>
                    </div>
                  )
                }

                // Direct image URLs (jpg, png, gif, webp)
                if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <img
                        src={url}
                        alt={link.title || 'Image'}
                        className="w-full max-h-[500px] object-contain"
                      />
                    </div>
                  )
                }

                // Direct video URLs (mp4, webm)
                if (url.match(/\.(mp4|webm)$/i)) {
                  return (
                    <div key={index} className="rounded-lg overflow-hidden">
                      {link.title && (
                        <div className="px-3 py-2 text-sm font-semibold" style={{ backgroundColor: teamColors.primary, color: primaryText }}>
                          {link.title}
                        </div>
                      )}
                      <video
                        className="w-full max-h-[500px] object-contain bg-black"
                        src={url}
                        controls
                        playsInline
                      />
                    </div>
                  )
                }

                // Default: Regular link button
                return (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-80 transition-opacity items-center gap-2"
                    style={{ backgroundColor: teamColors.primary, color: primaryText }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {link.title || url}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <PlayerEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        player={player}
        teamColors={teamColors}
        onSave={handlePlayerSave}
        defaultSchool={dynasty.teamName}
        dynasty={dynasty}
      />

      {/* Accolade Games Modal */}
      {showAccoladeModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          style={{ margin: 0 }}
          onClick={() => setShowAccoladeModal(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: teamColors.secondary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 border-b sticky top-0"
              style={{ backgroundColor: teamColors.primary, borderColor: teamColors.secondary }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold" style={{ color: primaryText }}>
                    {accoladeType === 'confPOW' ? 'Conference Player of the Week' : 'National Player of the Week'}
                  </h3>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: primaryText, opacity: 0.9 }}>{player.name}</p>
                </div>
                <button onClick={() => setShowAccoladeModal(false)} className="hover:opacity-70" style={{ color: primaryText }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {(accoladeType === 'confPOW' ? powHonors.confPOWGames : powHonors.nationalPOWGames).map((game, index) => {
                const mascotName = getMascotName(game.opponent)
                const opponentName = mascotName || getTeamNameFromAbbr(game.opponent)
                const opponentLogo = mascotName ? getTeamLogo(mascotName) : null
                const opponentColors = getTeamColors(opponentName) || { primary: '#333', secondary: '#fff' }
                const opponentBgColor = teamAbbreviations[game.opponent]?.backgroundColor || opponentColors.primary || '#333'
                const opponentTextColor = teamAbbreviations[game.opponent]?.textColor || getContrastTextColor(opponentBgColor)
                const isWin = game.result === 'win' || game.result === 'W'

                return (
                  <Link
                    key={game.id || index}
                    to={`/dynasty/${dynastyId}/game/${game.id}`}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-lg border-2 gap-2 sm:gap-0 hover:opacity-90 transition-opacity text-left"
                    style={{ backgroundColor: opponentBgColor, borderColor: isWin ? '#86efac' : '#fca5a5' }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-xs font-medium w-16 sm:w-20 flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.9 }}>
                        {game.year} Wk {game.week}
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: opponentTextColor, color: opponentBgColor }}>
                          {game.location === 'away' ? '@' : 'vs'}
                        </span>
                        {opponentLogo && (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF', border: `2px solid ${opponentTextColor}`, padding: '2px' }}>
                            <img src={opponentLogo} alt="" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div className="flex items-center gap-1 min-w-0">
                          {game.opponentRank && <span className="text-xs font-bold flex-shrink-0" style={{ color: opponentTextColor, opacity: 0.7 }}>#{game.opponentRank}</span>}
                          <span className="text-sm font-semibold truncate" style={{ color: opponentTextColor }}>{opponentName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start">
                      <div className="text-sm font-bold px-2 py-0.5 rounded" style={{ backgroundColor: isWin ? '#22c55e' : '#ef4444', color: '#ffffff' }}>
                        {isWin ? 'W' : 'L'}
                      </div>
                      <div className="text-sm font-bold" style={{ color: opponentTextColor }}>{game.teamScore}-{game.opponentScore}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Overall Progression Modal */}
      <OverallProgressionModal
        isOpen={showOverallProgressionModal}
        onClose={() => setShowOverallProgressionModal(false)}
        player={player}
        trainingResultsByYear={currentDynasty?.trainingResultsByYear}
        recruitOverallsByYear={currentDynasty?.recruitOverallsByYear}
        teamColors={teamColors}
        currentYear={currentDynasty?.currentYear}
      />
    </div>
  )
}
