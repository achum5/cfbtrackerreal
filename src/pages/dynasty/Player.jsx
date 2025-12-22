import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getTeamLogo } from '../../data/teams'
import { getAbbreviationFromDisplayName, teamAbbreviations } from '../../data/teamAbbreviations'
import { getTeamColors } from '../../data/teamColors'
import PlayerEditModal from '../../components/PlayerEditModal'

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
    'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins', 'UGA': 'Georgia Bulldogs',
    'UK': 'Kentucky Wildcats', 'ULL': 'Lafayette Ragin\' Cajuns', 'ULM': 'Monroe Warhawks',
    'UNC': 'North Carolina Tar Heels', 'UNLV': 'UNLV Rebels', 'UNM': 'New Mexico Lobos',
    'UNT': 'North Texas Mean Green', 'USA': 'South Alabama Jaguars', 'USC': 'USC Trojans',
    'USF': 'South Florida Bulls', 'USM': 'Southern Mississippi Golden Eagles',
    'USU': 'Utah State Aggies', 'UTAH': 'Utah Utes', 'UTEP': 'UTEP Miners',
    'UTSA': 'UTSA Roadrunners', 'UVA': 'Virginia Cavaliers', 'VAND': 'Vanderbilt Commodores',
    'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons', 'WASH': 'Washington Huskies',
    'WIS': 'Wisconsin Badgers', 'WKU': 'Western Kentucky Hilltoppers', 'WMU': 'Western Michigan Broncos',
    'WSU': 'Washington State Cougars', 'WVU': 'West Virginia Mountaineers', 'WYO': 'Wyoming Cowboys'
  }
  return mascotMap[abbr] || null
}

// Class progression order
const CLASS_ORDER = ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr']

export default function Player() {
  const { id: dynastyId, pid } = useParams()
  const { dynasties, currentDynasty, updatePlayer } = useDynasty()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAccoladeModal, setShowAccoladeModal] = useState(false)
  const [accoladeType, setAccoladeType] = useState(null)

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

  const teamColors = useTeamColors(dynasty.teamName)
  const primaryText = getContrastTextColor(teamColors.primary)
  const secondaryText = getContrastTextColor(teamColors.secondary)
  const teamAbbr = getAbbreviationFromDisplayName(dynasty.teamName)

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

  const handlePlayerSave = async (updatedPlayer) => {
    await updatePlayer(dynastyId, updatedPlayer)
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
          } : null,
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

  // Stat table component
  const StatTable = ({ title, headers, years, statKey, renderRow, renderCareer }) => {
    if (!years.some(y => y[statKey])) return null

    return (
      <div className="mb-6 overflow-x-auto">
        <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>{title}</h3>
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr style={{ backgroundColor: teamColors.primary }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-2 py-2 font-bold text-xs uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}
                  style={{ color: primaryText, borderBottom: `2px solid ${teamColors.secondary}` }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.filter(y => y[statKey]).map((yearData, idx) => (
              <tr
                key={yearData.year}
                className={idx % 2 === 0 ? '' : 'bg-opacity-50'}
                style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}
              >
                {renderRow(yearData)}
              </tr>
            ))}
            {/* Career totals row */}
            <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
              {renderCareer()}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // Helper for table cells
  const Td = ({ children, align = 'right', bold = false }) => (
    <td className={`px-2 py-1.5 ${align === 'left' ? 'text-left' : 'text-right'} ${bold ? 'font-bold' : ''}`}>
      {children}
    </td>
  )

  const TdCareer = ({ children, align = 'right' }) => (
    <td className={`px-2 py-2 ${align === 'left' ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>
      {children}
    </td>
  )

  // Calculate averages
  const calcPct = (a, b) => b > 0 ? (a / b * 100).toFixed(1) : '0.0'
  const calcAvg = (a, b) => b > 0 ? (a / b).toFixed(1) : '0.0'

  // Career totals for each stat category
  const careerPassing = hasStats.passing ? calculateCareerTotals(yearByYearStats, 'passing', ['cmp', 'att', 'yds', 'td', 'int', 'lng', 'sacks']) : null
  const careerRushing = hasStats.rushing ? calculateCareerTotals(yearByYearStats, 'rushing', ['car', 'yds', 'td', 'lng', 'fum', 'bt']) : null
  const careerReceiving = hasStats.receiving ? calculateCareerTotals(yearByYearStats, 'receiving', ['rec', 'yds', 'td', 'lng', 'drops']) : null
  const careerDefensive = hasStats.defensive ? calculateCareerTotals(yearByYearStats, 'defensive', ['solo', 'ast', 'tfl', 'sacks', 'int', 'intYds', 'intTd', 'pdef', 'ff', 'fr']) : null
  const careerKicking = hasStats.kicking ? calculateCareerTotals(yearByYearStats, 'kicking', ['fgm', 'fga', 'lng', 'xpm', 'xpa']) : null
  const careerPunting = hasStats.punting ? calculateCareerTotals(yearByYearStats, 'punting', ['punts', 'yds', 'lng', 'in20', 'tb']) : null
  const careerKickReturn = hasStats.kickReturn ? calculateCareerTotals(yearByYearStats, 'kickReturn', ['ret', 'yds', 'td', 'lng']) : null
  const careerPuntReturn = hasStats.puntReturn ? calculateCareerTotals(yearByYearStats, 'puntReturn', ['ret', 'yds', 'td', 'lng']) : null

  // Total games and snaps
  const careerGames = yearByYearStats.reduce((sum, y) => sum + (y.gamesPlayed || 0), 0)
  const careerSnaps = yearByYearStats.reduce((sum, y) => sum + (y.snapsPlayed || 0), 0)

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

              <Link
                to={`/dynasty/${dynastyId}/team/${teamAbbr}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline mb-2"
                style={{ color: primaryText, opacity: 0.9 }}
              >
                {getTeamLogo(dynasty.teamName) && (
                  <img src={getTeamLogo(dynasty.teamName)} alt="" className="w-4 h-4 object-contain" />
                )}
                {dynasty.teamName}
              </Link>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: primaryText, opacity: 0.85 }}>
                {player.jerseyNumber && <span className="font-bold">#{player.jerseyNumber}</span>}
                {player.jerseyNumber && <span className="opacity-50">|</span>}
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

          <div className="text-center flex-shrink-0">
            <div className="text-xs mb-1" style={{ color: primaryText, opacity: 0.7 }}>OVR</div>
            <div className="text-5xl md:text-6xl font-bold" style={{ color: teamColors.secondary }}>
              {player.overall}
            </div>
          </div>
        </div>
      </div>

      {/* Accolades */}
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

      {/* Stats Tables */}
      <div
        className="rounded-lg shadow-lg p-4 sm:p-6"
        style={{ backgroundColor: teamColors.secondary, border: `3px solid ${teamColors.primary}` }}
      >
        {yearByYearStats.length === 0 ? (
          <div className="text-center py-8" style={{ color: secondaryText, opacity: 0.6 }}>
            No statistics recorded yet. Enter stats via the Season Stats or Detailed Stats entry on the Dashboard.
          </div>
        ) : (
          <>
            {/* Games & Snaps Table */}
            <div className="mb-6 overflow-x-auto">
              <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Games & Snaps</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: teamColors.primary }}>
                    <th className="px-3 py-2 text-left font-bold text-xs uppercase" style={{ color: primaryText }}>Year</th>
                    <th className="px-3 py-2 text-left font-bold text-xs uppercase" style={{ color: primaryText }}>Class</th>
                    <th className="px-3 py-2 text-left font-bold text-xs uppercase" style={{ color: primaryText }}>Team</th>
                    <th className="px-3 py-2 text-right font-bold text-xs uppercase" style={{ color: primaryText }}>GP</th>
                    <th className="px-3 py-2 text-right font-bold text-xs uppercase" style={{ color: primaryText }}>Snaps</th>
                  </tr>
                </thead>
                <tbody>
                  {yearByYearStats.map((y, idx) => (
                    <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                      <Td align="left" bold>{y.year}</Td>
                      <Td align="left">{y.class}</Td>
                      <Td align="left">{teamAbbr}</Td>
                      <Td>{y.gamesPlayed}</Td>
                      <Td>{y.snapsPlayed}</Td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                    <TdCareer align="left">Career</TdCareer>
                    <TdCareer align="left"></TdCareer>
                    <TdCareer align="left">{teamAbbr}</TdCareer>
                    <TdCareer>{careerGames}</TdCareer>
                    <TdCareer>{careerSnaps}</TdCareer>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Passing Table */}
            {hasStats.passing && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Passing</h3>
                <table className="w-full text-sm border-collapse min-w-[700px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'Cmp', 'Att', 'Pct', 'Yds', 'Y/A', 'TD', 'Int', 'Lng', 'Sck'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.passing).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.passing.cmp}</Td>
                        <Td>{y.passing.att}</Td>
                        <Td>{calcPct(y.passing.cmp, y.passing.att)}%</Td>
                        <Td>{y.passing.yds}</Td>
                        <Td>{calcAvg(y.passing.yds, y.passing.att)}</Td>
                        <Td>{y.passing.td}</Td>
                        <Td>{y.passing.int}</Td>
                        <Td>{y.passing.lng}</Td>
                        <Td>{y.passing.sacks}</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerPassing.cmp}</TdCareer>
                      <TdCareer>{careerPassing.att}</TdCareer>
                      <TdCareer>{calcPct(careerPassing.cmp, careerPassing.att)}%</TdCareer>
                      <TdCareer>{careerPassing.yds}</TdCareer>
                      <TdCareer>{calcAvg(careerPassing.yds, careerPassing.att)}</TdCareer>
                      <TdCareer>{careerPassing.td}</TdCareer>
                      <TdCareer>{careerPassing.int}</TdCareer>
                      <TdCareer>{careerPassing.lng}</TdCareer>
                      <TdCareer>{careerPassing.sacks}</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Rushing Table */}
            {hasStats.rushing && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Rushing</h3>
                <table className="w-full text-sm border-collapse min-w-[600px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'Car', 'Yds', 'Y/C', 'TD', 'Lng', 'Fum', 'BT'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.rushing).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.rushing.car}</Td>
                        <Td>{y.rushing.yds}</Td>
                        <Td>{calcAvg(y.rushing.yds, y.rushing.car)}</Td>
                        <Td>{y.rushing.td}</Td>
                        <Td>{y.rushing.lng}</Td>
                        <Td>{y.rushing.fum}</Td>
                        <Td>{y.rushing.bt}</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerRushing.car}</TdCareer>
                      <TdCareer>{careerRushing.yds}</TdCareer>
                      <TdCareer>{calcAvg(careerRushing.yds, careerRushing.car)}</TdCareer>
                      <TdCareer>{careerRushing.td}</TdCareer>
                      <TdCareer>{careerRushing.lng}</TdCareer>
                      <TdCareer>{careerRushing.fum}</TdCareer>
                      <TdCareer>{careerRushing.bt}</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Receiving Table */}
            {hasStats.receiving && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Receiving</h3>
                <table className="w-full text-sm border-collapse min-w-[550px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'Rec', 'Yds', 'Y/R', 'TD', 'Lng', 'Drops'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.receiving).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.receiving.rec}</Td>
                        <Td>{y.receiving.yds}</Td>
                        <Td>{calcAvg(y.receiving.yds, y.receiving.rec)}</Td>
                        <Td>{y.receiving.td}</Td>
                        <Td>{y.receiving.lng}</Td>
                        <Td>{y.receiving.drops}</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerReceiving.rec}</TdCareer>
                      <TdCareer>{careerReceiving.yds}</TdCareer>
                      <TdCareer>{calcAvg(careerReceiving.yds, careerReceiving.rec)}</TdCareer>
                      <TdCareer>{careerReceiving.td}</TdCareer>
                      <TdCareer>{careerReceiving.lng}</TdCareer>
                      <TdCareer>{careerReceiving.drops}</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Defense Table */}
            {hasStats.defensive && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Defense</h3>
                <table className="w-full text-sm border-collapse min-w-[800px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'Solo', 'Ast', 'Tot', 'TFL', 'Sck', 'Int', 'IntYd', 'TD', 'PD', 'FF', 'FR'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.defensive).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.defensive.solo}</Td>
                        <Td>{y.defensive.ast}</Td>
                        <Td>{y.defensive.solo + y.defensive.ast}</Td>
                        <Td>{y.defensive.tfl}</Td>
                        <Td>{y.defensive.sacks}</Td>
                        <Td>{y.defensive.int}</Td>
                        <Td>{y.defensive.intYds}</Td>
                        <Td>{y.defensive.intTd}</Td>
                        <Td>{y.defensive.pdef}</Td>
                        <Td>{y.defensive.ff}</Td>
                        <Td>{y.defensive.fr}</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerDefensive.solo}</TdCareer>
                      <TdCareer>{careerDefensive.ast}</TdCareer>
                      <TdCareer>{careerDefensive.solo + careerDefensive.ast}</TdCareer>
                      <TdCareer>{careerDefensive.tfl}</TdCareer>
                      <TdCareer>{careerDefensive.sacks}</TdCareer>
                      <TdCareer>{careerDefensive.int}</TdCareer>
                      <TdCareer>{careerDefensive.intYds}</TdCareer>
                      <TdCareer>{careerDefensive.intTd}</TdCareer>
                      <TdCareer>{careerDefensive.pdef}</TdCareer>
                      <TdCareer>{careerDefensive.ff}</TdCareer>
                      <TdCareer>{careerDefensive.fr}</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Kicking Table */}
            {hasStats.kicking && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Kicking</h3>
                <table className="w-full text-sm border-collapse min-w-[550px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'FGM', 'FGA', 'FG%', 'Lng', 'XPM', 'XPA', 'XP%'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.kicking).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.kicking.fgm}</Td>
                        <Td>{y.kicking.fga}</Td>
                        <Td>{calcPct(y.kicking.fgm, y.kicking.fga)}%</Td>
                        <Td>{y.kicking.lng}</Td>
                        <Td>{y.kicking.xpm}</Td>
                        <Td>{y.kicking.xpa}</Td>
                        <Td>{calcPct(y.kicking.xpm, y.kicking.xpa)}%</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerKicking.fgm}</TdCareer>
                      <TdCareer>{careerKicking.fga}</TdCareer>
                      <TdCareer>{calcPct(careerKicking.fgm, careerKicking.fga)}%</TdCareer>
                      <TdCareer>{careerKicking.lng}</TdCareer>
                      <TdCareer>{careerKicking.xpm}</TdCareer>
                      <TdCareer>{careerKicking.xpa}</TdCareer>
                      <TdCareer>{calcPct(careerKicking.xpm, careerKicking.xpa)}%</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Punting Table */}
            {hasStats.punting && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Punting</h3>
                <table className="w-full text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'Punts', 'Yds', 'Avg', 'Lng', 'In20', 'TB'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.punting).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.punting.punts}</Td>
                        <Td>{y.punting.yds}</Td>
                        <Td>{calcAvg(y.punting.yds, y.punting.punts)}</Td>
                        <Td>{y.punting.lng}</Td>
                        <Td>{y.punting.in20}</Td>
                        <Td>{y.punting.tb}</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerPunting.punts}</TdCareer>
                      <TdCareer>{careerPunting.yds}</TdCareer>
                      <TdCareer>{calcAvg(careerPunting.yds, careerPunting.punts)}</TdCareer>
                      <TdCareer>{careerPunting.lng}</TdCareer>
                      <TdCareer>{careerPunting.in20}</TdCareer>
                      <TdCareer>{careerPunting.tb}</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Kick Returns Table */}
            {hasStats.kickReturn && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Kick Returns</h3>
                <table className="w-full text-sm border-collapse min-w-[450px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'Ret', 'Yds', 'Avg', 'TD', 'Lng'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.kickReturn).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.kickReturn.ret}</Td>
                        <Td>{y.kickReturn.yds}</Td>
                        <Td>{calcAvg(y.kickReturn.yds, y.kickReturn.ret)}</Td>
                        <Td>{y.kickReturn.td}</Td>
                        <Td>{y.kickReturn.lng}</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerKickReturn.ret}</TdCareer>
                      <TdCareer>{careerKickReturn.yds}</TdCareer>
                      <TdCareer>{calcAvg(careerKickReturn.yds, careerKickReturn.ret)}</TdCareer>
                      <TdCareer>{careerKickReturn.td}</TdCareer>
                      <TdCareer>{careerKickReturn.lng}</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Punt Returns Table */}
            {hasStats.puntReturn && (
              <div className="mb-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-2" style={{ color: secondaryText }}>Punt Returns</h3>
                <table className="w-full text-sm border-collapse min-w-[450px]">
                  <thead>
                    <tr style={{ backgroundColor: teamColors.primary }}>
                      {['Year', 'Class', 'Ret', 'Yds', 'Avg', 'TD', 'Lng'].map((h, i) => (
                        <th key={i} className={`px-2 py-2 font-bold text-xs uppercase ${i < 2 ? 'text-left' : 'text-right'}`} style={{ color: primaryText }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearByYearStats.filter(y => y.puntReturn).map((y, idx) => (
                      <tr key={y.year} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : `${teamColors.primary}15` }}>
                        <Td align="left" bold>{y.year}</Td>
                        <Td align="left">{y.class}</Td>
                        <Td>{y.puntReturn.ret}</Td>
                        <Td>{y.puntReturn.yds}</Td>
                        <Td>{calcAvg(y.puntReturn.yds, y.puntReturn.ret)}</Td>
                        <Td>{y.puntReturn.td}</Td>
                        <Td>{y.puntReturn.lng}</Td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: teamColors.primary, fontWeight: 'bold' }}>
                      <TdCareer align="left">Career</TdCareer>
                      <TdCareer align="left"></TdCareer>
                      <TdCareer>{careerPuntReturn.ret}</TdCareer>
                      <TdCareer>{careerPuntReturn.yds}</TdCareer>
                      <TdCareer>{calcAvg(careerPuntReturn.yds, careerPuntReturn.ret)}</TdCareer>
                      <TdCareer>{careerPuntReturn.td}</TdCareer>
                      <TdCareer>{careerPuntReturn.lng}</TdCareer>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

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
            <div className="flex flex-wrap gap-2">
              {player.links.map((link, index) => link.url && (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-80 transition-opacity flex items-center gap-2"
                  style={{ backgroundColor: teamColors.primary, color: primaryText }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {link.title || link.url}
                </a>
              ))}
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
    </div>
  )
}
