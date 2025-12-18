import { useState, useEffect } from 'react'
import { useDynasty } from '../../context/DynastyContext'
import { useParams, Link } from 'react-router-dom'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getTeamLogo } from '../../data/teams'
import { teamAbbreviations } from '../../data/teamAbbreviations'
import { getBowlLogo } from '../../data/bowlGames'
import GameDetailModal from '../../components/GameDetailModal'

// Map abbreviations to mascot names for logo lookup
const mascotMap = {
  'AFA': 'Air Force Falcons', 'AKR': 'Akron Zips', 'APP': 'Appalachian State Mountaineers',
  'ARIZ': 'Arizona Wildcats', 'ARK': 'Arkansas Razorbacks', 'ARMY': 'Army Black Knights',
  'ARST': 'Arkansas State Red Wolves', 'ASU': 'Arizona State Sun Devils', 'AUB': 'Auburn Tigers',
  'BALL': 'Ball State Cardinals', 'BAMA': 'Alabama Crimson Tide', 'BC': 'Boston College Eagles',
  'BGSU': 'Bowling Green Falcons', 'BOIS': 'Boise State Broncos', 'BU': 'Baylor Bears',
  'BUFF': 'Buffalo Bulls', 'BYU': 'Brigham Young Cougars', 'CAL': 'California Golden Bears',
  'CCU': 'Coastal Carolina Chanticleers', 'CHAR': 'Charlotte 49ers', 'CLEM': 'Clemson Tigers',
  'CMU': 'Central Michigan Chippewas', 'COLO': 'Colorado Buffaloes', 'CONN': 'Connecticut Huskies',
  'CSU': 'Colorado State Rams', 'DUKE': 'Duke Blue Devils', 'ECU': 'East Carolina Pirates',
  'EMU': 'Eastern Michigan Eagles', 'FIU': 'Florida International Panthers', 'FSU': 'Florida State Seminoles',
  'FAU': 'Florida Atlantic Owls', 'FRES': 'Fresno State Bulldogs', 'UF': 'Florida Gators',
  'GASO': 'Georgia Southern Eagles', 'GAST': 'Georgia State Panthers', 'GT': 'Georgia Tech Yellow Jackets',
  'UGA': 'Georgia Bulldogs', 'HAW': 'Hawaii Rainbow Warriors', 'HOU': 'Houston Cougars',
  'ILL': 'Illinois Fighting Illini', 'IU': 'Indiana Hoosiers', 'IOWA': 'Iowa Hawkeyes',
  'ISU': 'Iowa State Cyclones', 'JKST': 'Jacksonville State Gamecocks', 'JMU': 'James Madison Dukes',
  'KU': 'Kansas Jayhawks', 'KSU': 'Kansas State Wildcats', 'KENT': 'Kent State Golden Flashes',
  'UK': 'Kentucky Wildcats', 'LIB': 'Liberty Flames', 'ULL': 'Lafayette Ragin\' Cajuns',
  'LT': 'Louisiana Tech Bulldogs', 'LOU': 'Louisville Cardinals', 'LSU': 'LSU Tigers',
  'UM': 'Miami Hurricanes', 'M-OH': 'Miami Redhawks', 'UMD': 'Maryland Terrapins',
  'MASS': 'Massachusetts Minutemen', 'MEM': 'Memphis Tigers', 'MICH': 'Michigan Wolverines',
  'MSU': 'Michigan State Spartans', 'MTSU': 'Middle Tennessee State Blue Raiders',
  'MINN': 'Minnesota Golden Gophers', 'MISS': 'Ole Miss Rebels', 'MSST': 'Mississippi State Bulldogs',
  'MZST': 'Missouri Tigers', 'MRSH': 'Marshall Thundering Herd', 'NAVY': 'Navy Midshipmen',
  'NEB': 'Nebraska Cornhuskers', 'NEV': 'Nevada Wolf Pack', 'UNM': 'New Mexico Lobos',
  'NMSU': 'New Mexico State Aggies', 'UNC': 'North Carolina Tar Heels', 'NCST': 'North Carolina State Wolfpack',
  'UNT': 'North Texas Mean Green', 'NU': 'Northwestern Wildcats', 'ND': 'Notre Dame Fighting Irish',
  'NIU': 'Northern Illinois Huskies', 'OHIO': 'Ohio Bobcats', 'OSU': 'Ohio State Buckeyes',
  'OKLA': 'Oklahoma Sooners', 'OKST': 'Oklahoma State Cowboys', 'ODU': 'Old Dominion Monarchs',
  'ORE': 'Oregon Ducks', 'ORST': 'Oregon State Beavers', 'PSU': 'Penn State Nittany Lions',
  'PITT': 'Pittsburgh Panthers', 'PUR': 'Purdue Boilermakers', 'RICE': 'Rice Owls',
  'RUT': 'Rutgers Scarlet Knights', 'SDSU': 'San Diego State Aztecs', 'SJSU': 'San Jose State Spartans',
  'SAM': 'Sam Houston State Bearkats', 'USF': 'South Florida Bulls', 'SMU': 'SMU Mustangs',
  'USC': 'USC Trojans', 'SCAR': 'South Carolina Gamecocks', 'STAN': 'Stanford Cardinal',
  'SYR': 'Syracuse Orange', 'TCU': 'TCU Horned Frogs', 'TEM': 'Temple Owls',
  'TENN': 'Tennessee Volunteers', 'TEX': 'Texas Longhorns', 'TXAM': 'Texas A&M Aggies',
  'TXST': 'Texas State Bobcats', 'TXTECH': 'Texas Tech Red Raiders', 'TOL': 'Toledo Rockets',
  'TROY': 'Troy Trojans', 'TUL': 'Tulane Green Wave', 'TLSA': 'Tulsa Golden Hurricane',
  'UAB': 'UAB Blazers', 'UCF': 'UCF Knights', 'UCLA': 'UCLA Bruins', 'UNLV': 'UNLV Rebels',
  'UTEP': 'UTEP Miners', 'USA': 'South Alabama Jaguars', 'USU': 'Utah State Aggies',
  'UTAH': 'Utah Utes', 'UTSA': 'UTSA Roadrunners', 'VAN': 'Vanderbilt Commodores',
  'UVA': 'Virginia Cavaliers', 'VT': 'Virginia Tech Hokies', 'WAKE': 'Wake Forest Demon Deacons',
  'WASH': 'Washington Huskies', 'WSU': 'Washington State Cougars', 'WVU': 'West Virginia Mountaineers',
  'WMU': 'Western Michigan Broncos', 'WKU': 'Western Kentucky Hilltoppers', 'WIS': 'Wisconsin Badgers',
  'WYO': 'Wyoming Cowboys', 'DEL': 'Delaware Fightin\' Blue Hens', 'FLA': 'Florida Gators',
  'KENN': 'Kennesaw State Owls', 'ULM': 'Monroe Warhawks', 'UC': 'Cincinnati Bearcats',
  'MIA': 'Miami Hurricanes', 'MIZ': 'Missouri Tigers', 'OU': 'Oklahoma Sooners', 'GSU': 'Georgia State Panthers'
}

const getShortName = (abbr) => {
  if (!abbr) return 'TBD'
  const teamInfo = teamAbbreviations[abbr]
  if (!teamInfo) return abbr
  let name = teamInfo.name
  if (name.includes('University of ')) {
    name = name.replace('University of ', '').split(',')[0].trim()
  } else if (name.includes(' University')) {
    name = name.replace(' University', '').split(',')[0].trim()
  }
  return name
}

export default function CFPBracket() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const [selectedGame, setSelectedGame] = useState(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [selectedYear, setSelectedYear] = useState(null)

  // Track window width for responsive scaling
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Set initial selected year when dynasty loads
  useEffect(() => {
    if (currentDynasty && selectedYear === null) {
      setSelectedYear(currentDynasty.currentYear)
    }
  }, [currentDynasty, selectedYear])

  if (!currentDynasty) {
    return <div className="p-6">Loading...</div>
  }

  // Get available years that have CFP seeds data
  const availableYears = Object.keys(currentDynasty.cfpSeedsByYear || {})
    .map(y => parseInt(y))
    .sort((a, b) => b - a) // Most recent first

  // If no CFP data exists yet, show current year
  if (availableYears.length === 0) {
    availableYears.push(currentDynasty.currentYear)
  }

  const displayYear = selectedYear || currentDynasty.currentYear
  const cfpSeeds = currentDynasty.cfpSeedsByYear?.[displayYear] || []
  const textColor = getContrastTextColor(teamColors.primary)

  const getTeamBySeed = (seed) => cfpSeeds.find(s => s.seed === seed)?.team || null

  // Get First Round results
  const cfpResults = currentDynasty.cfpResultsByYear?.[displayYear] || {}
  const firstRoundResults = cfpResults.firstRound || []

  // Helper to get First Round winner by matchup seeds
  const getFirstRoundWinner = (seed1, seed2) => {
    const game = firstRoundResults.find(g =>
      (g.seed1 === seed1 && g.seed2 === seed2) || (g.seed1 === seed2 && g.seed2 === seed1)
    )
    return game?.winner || null
  }

  // Helper to get the seed of the First Round winner
  const getWinnerSeed = (seed1, seed2) => {
    const game = firstRoundResults.find(g =>
      (g.seed1 === seed1 && g.seed2 === seed2) || (g.seed1 === seed2 && g.seed2 === seed1)
    )
    if (!game?.winner) return null
    if (game.team1 === game.winner) return game.seed1
    if (game.team2 === game.winner) return game.seed2
    return null
  }

  // Helper to get First Round game data
  const getFirstRoundGame = (seed1, seed2) => {
    return firstRoundResults.find(g =>
      (g.seed1 === seed1 && g.seed2 === seed2) || (g.seed1 === seed2 && g.seed2 === seed1)
    ) || null
  }

  // Sizing constants (scaled up for larger bracket)
  const SLOT_HEIGHT = 70
  const SLOT_GAP = 12
  const MATCHUP_HEIGHT = SLOT_HEIGHT * 2 + SLOT_GAP // 152px
  const SLOT_WIDTH = 300
  const CONNECTOR_GAP = 60 // Gap between columns for connector lines

  // Team slot component
  const TeamSlot = ({ team, seed, score, isWinner }) => {
    const teamData = team ? teamAbbreviations[team] : null
    const bgColor = teamData?.backgroundColor || '#4B5563'
    const txtColor = teamData?.textColor || '#D1D5DB'
    const mascotName = team ? mascotMap[team] : null
    const logo = mascotName ? getTeamLogo(mascotName) : null

    return (
      <div
        className="flex items-center gap-3 px-4 rounded border"
        style={{
          backgroundColor: bgColor,
          width: `${SLOT_WIDTH}px`,
          height: `${SLOT_HEIGHT}px`,
          borderColor: team ? 'transparent' : '#6B7280',
          opacity: score !== undefined && !isWinner ? 0.6 : 1
        }}
      >
        <span className="text-lg font-bold w-8 opacity-70" style={{ color: txtColor }}>
          {team ? seed : ''}
        </span>
        {logo && <img src={logo} alt="" className="w-10 h-10 object-contain" />}
        {team ? (
          <Link
            to={`/dynasty/${id}/team/${team}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xl font-semibold truncate hover:underline flex-1"
            style={{ color: txtColor }}
          >
            {getShortName(team)}
          </Link>
        ) : (
          <span className="text-xl font-semibold truncate flex-1" style={{ color: txtColor }}>
            TBD
          </span>
        )}
        {score !== undefined && (
          <span className="text-xl font-bold ml-auto" style={{ color: txtColor }}>
            {score}
          </span>
        )}
      </div>
    )
  }

  // Matchup component - two team slots stacked
  const Matchup = ({ team1, team2, seed1, seed2, style, onClick, round, bowl, gameData }) => {
    // Map scores correctly based on which team is which
    // gameData has team1/team2 which may be in different order than visual display
    let score1, score2
    if (gameData) {
      // Find which gameData team matches the visual team1/team2
      if (gameData.team1 === team1) {
        score1 = gameData.team1Score
        score2 = gameData.team2Score
      } else if (gameData.team2 === team1) {
        score1 = gameData.team2Score
        score2 = gameData.team1Score
      } else {
        // Fallback to default order
        score1 = gameData.team1Score
        score2 = gameData.team2Score
      }
    }
    const winner = gameData?.winner

    return (
      <div
        className="absolute flex flex-col cursor-pointer hover:opacity-90 transition-opacity"
        style={{ gap: `${SLOT_GAP}px`, ...style }}
        onClick={() => onClick && onClick({ team1, team2, seed1, seed2, round, bowl, gameData })}
      >
        <TeamSlot team={team1} seed={seed1} score={score1} isWinner={winner === team1} />
        <TeamSlot team={team2} seed={seed2} score={score2} isWinner={winner === team2} />
      </div>
    )
  }

  // Horizontal line
  const HLine = ({ top, left, width }) => (
    <div
      className="absolute"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: '2px',
        backgroundColor: `${teamColors.secondary}60`
      }}
    />
  )

  // Vertical line
  const VLine = ({ top, left, height }) => (
    <div
      className="absolute"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: '2px',
        height: `${height}px`,
        backgroundColor: `${teamColors.secondary}60`
      }}
    />
  )

  // No seeds entered
  if (cfpSeeds.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="https://i.imgur.com/ZKD9dQJ.png" alt="CFP Logo" className="h-10" />
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {displayYear} CFP Bracket
          </h1>
        </div>
        <div
          className="p-8 rounded-lg text-center border-2 border-dashed"
          style={{ borderColor: `${teamColors.secondary}50`, backgroundColor: `${teamColors.primary}20` }}
        >
          <p className="text-lg mb-2" style={{ color: textColor }}>CFP Seeds Not Yet Entered</p>
          <p className="opacity-70" style={{ color: textColor }}>
            Enter CFP seeds in Bowl Week 1 to see the bracket
          </p>
        </div>
      </div>
    )
  }

  // Get all seeds
  const s1 = getTeamBySeed(1), s2 = getTeamBySeed(2), s3 = getTeamBySeed(3), s4 = getTeamBySeed(4)
  const s5 = getTeamBySeed(5), s6 = getTeamBySeed(6), s7 = getTeamBySeed(7), s8 = getTeamBySeed(8)
  const s9 = getTeamBySeed(9), s10 = getTeamBySeed(10), s11 = getTeamBySeed(11), s12 = getTeamBySeed(12)

  // Column positions (left edge of each column)
  const COL1 = 0 // First Round matchups
  const COL2 = SLOT_WIDTH + CONNECTOR_GAP // Quarterfinals
  const COL3 = COL2 + SLOT_WIDTH + CONNECTOR_GAP // Semifinals
  const COL4 = COL3 + SLOT_WIDTH + CONNECTOR_GAP // Championship

  // Vertical positions - work backwards from championship
  // We want even spacing that creates a clean bracket look

  // First Round spacing
  const R1_GAP = 36 // Gap between First Round matchups
  const R1_START = 50 // Top of first matchup

  // First Round matchup positions (4 matchups)
  const R1_M1 = R1_START
  const R1_M2 = R1_M1 + MATCHUP_HEIGHT + R1_GAP
  const R1_M3 = R1_M2 + MATCHUP_HEIGHT + R1_GAP
  const R1_M4 = R1_M3 + MATCHUP_HEIGHT + R1_GAP

  // First Round centers (output lines come from center of each matchup)
  const R1_M1_CENTER = R1_M1 + MATCHUP_HEIGHT / 2
  const R1_M2_CENTER = R1_M2 + MATCHUP_HEIGHT / 2
  const R1_M3_CENTER = R1_M3 + MATCHUP_HEIGHT / 2
  const R1_M4_CENTER = R1_M4 + MATCHUP_HEIGHT / 2

  // Quarterfinals - position each QF so its top slot center aligns with corresponding FR output
  // QF top slot center = QF_TOP + SLOT_HEIGHT/2
  // We want QF top slot center = R1 center, so QF_TOP = R1_CENTER - SLOT_HEIGHT/2
  const QF_M1 = R1_M1_CENTER - SLOT_HEIGHT / 2
  const QF_M2 = R1_M2_CENTER - SLOT_HEIGHT / 2
  const QF_M3 = R1_M3_CENTER - SLOT_HEIGHT / 2
  const QF_M4 = R1_M4_CENTER - SLOT_HEIGHT / 2

  // QF centers
  const QF_M1_CENTER = QF_M1 + MATCHUP_HEIGHT / 2
  const QF_M2_CENTER = QF_M2 + MATCHUP_HEIGHT / 2
  const QF_M3_CENTER = QF_M3 + MATCHUP_HEIGHT / 2
  const QF_M4_CENTER = QF_M4 + MATCHUP_HEIGHT / 2

  // Semifinals - centered between their two feeding QF matchups
  const SF_M1 = (QF_M1_CENTER + QF_M2_CENTER) / 2 - MATCHUP_HEIGHT / 2
  const SF_M2 = (QF_M3_CENTER + QF_M4_CENTER) / 2 - MATCHUP_HEIGHT / 2

  // SF centers
  const SF_M1_CENTER = SF_M1 + MATCHUP_HEIGHT / 2
  const SF_M2_CENTER = SF_M2 + MATCHUP_HEIGHT / 2

  // Championship - centered between the two semifinals
  const CHAMP = (SF_M1_CENTER + SF_M2_CENTER) / 2 - MATCHUP_HEIGHT / 2
  const CHAMP_CENTER = CHAMP + MATCHUP_HEIGHT / 2

  // Connector X positions
  const CONN_X1 = SLOT_WIDTH // End of First Round slots, start of connectors
  const CONN_X2 = COL2 + SLOT_WIDTH // End of QF slots
  const CONN_X3 = COL3 + SLOT_WIDTH // End of SF slots

  // Vertical connector X positions (midway in the gap)
  const VCONN_X2 = CONN_X2 + CONNECTOR_GAP / 2 // Between QF and SF
  const VCONN_X3 = CONN_X3 + CONNECTOR_GAP / 2 // Between SF and CHAMP

  const BRACKET_HEIGHT = R1_M4 + MATCHUP_HEIGHT + 160
  const BRACKET_WIDTH = COL4 + SLOT_WIDTH + 40

  // Calculate scale for mobile - fit bracket to viewport width with padding
  const PADDING = 32 // 16px on each side
  const availableWidth = windowWidth - PADDING
  const scale = availableWidth < BRACKET_WIDTH ? availableWidth / BRACKET_WIDTH : 1
  const scaledHeight = BRACKET_HEIGHT * scale
  const scaledWidth = BRACKET_WIDTH * scale

  // Handle matchup click - find the game data if it exists
  const handleMatchupClick = (matchupInfo) => {
    const { team1, team2, seed1, seed2, round, bowl, gameData } = matchupInfo

    // Check if we have gameData from First Round results
    if (gameData && gameData.winner) {
      // Show game recap with scores using CFP modal style
      setSelectedGame({
        team1: gameData.team1,
        team2: gameData.team2,
        team1Score: gameData.team1Score,
        team2Score: gameData.team2Score,
        winner: gameData.winner,
        seed1: gameData.seed1,
        seed2: gameData.seed2,
        round,
        bowl,
        year: displayYear,
        gameTitle: bowl || round,
        isPlayoff: true,
        isPreview: true, // Use preview modal style for consistent look
        hasScore: true   // Flag to show scores in the preview modal
      })
      return
    }

    // Look for existing game in cfpGames (for later rounds)
    const cfpGames = currentDynasty.cfpGamesByYear?.[displayYear] || []
    const existingGame = cfpGames.find(g =>
      g.round === round &&
      ((g.team1 === team1 && g.team2 === team2) || (g.team1 === team2 && g.team2 === team1))
    )

    if (existingGame) {
      // Convert to GameDetailModal format
      setSelectedGame({
        ...existingGame,
        opponent: existingGame.team1 === currentDynasty.teamName ? existingGame.team2 : existingGame.team1,
        teamScore: existingGame.team1 === currentDynasty.teamName ? existingGame.team1Score : existingGame.team2Score,
        opponentScore: existingGame.team1 === currentDynasty.teamName ? existingGame.team2Score : existingGame.team1Score,
        result: existingGame.winner === currentDynasty.teamName ? 'win' : 'loss',
        location: 'neutral',
        year: displayYear,
        week: round,
        gameTitle: bowl || round,
        isPlayoff: true
      })
    } else {
      // Show matchup preview (no game played yet)
      setSelectedGame({
        team1,
        team2,
        seed1,
        seed2,
        round,
        bowl,
        year: displayYear,
        gameTitle: bowl || round,
        isPlayoff: true,
        isPreview: true,
        opponent: team1 || team2,
        location: 'neutral'
      })
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-center gap-3 md:gap-6 mb-6 md:mb-10">
        <img src="https://i.imgur.com/ZKD9dQJ.png" alt="CFP Logo" className="h-10 md:h-20" />
        <h1 className="text-xl md:text-4xl font-bold" style={{ color: textColor }}>
          <select
            value={displayYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-transparent font-bold cursor-pointer hover:opacity-80 transition-opacity appearance-none pr-1"
            style={{
              color: textColor,
              outline: 'none',
              borderBottom: `2px solid ${textColor}40`
            }}
          >
            {availableYears.map(year => (
              <option key={year} value={year} style={{ color: '#000' }}>{year}</option>
            ))}
          </select>
          {' '}College Football Playoff
        </h1>
      </div>

      {/* Scaled Bracket Container */}
      <div className="flex justify-center" style={{ height: `${scaledHeight + 40}px` }}>
        <div
          style={{
            width: `${BRACKET_WIDTH}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center'
          }}
        >
          {/* Round Labels */}
          <div className="flex mb-6 text-xl font-bold" style={{ color: textColor }}>
            <div style={{ width: `${SLOT_WIDTH}px`, marginLeft: `${COL1}px` }} className="text-center">First Round</div>
            <div style={{ width: `${SLOT_WIDTH}px`, marginLeft: `${CONNECTOR_GAP}px` }} className="text-center">Quarterfinals</div>
            <div style={{ width: `${SLOT_WIDTH}px`, marginLeft: `${CONNECTOR_GAP}px` }} className="text-center">Semifinals</div>
            <div style={{ width: `${SLOT_WIDTH}px`, marginLeft: `${CONNECTOR_GAP}px` }} className="text-center">Championship</div>
          </div>

          {/* Bracket Area */}
          <div className="relative" style={{ height: `${BRACKET_HEIGHT}px`, width: `${BRACKET_WIDTH}px` }}>

            {/* ===== FIRST ROUND ===== */}
            <Matchup team1={s12} team2={s5} seed1={12} seed2={5} style={{ top: R1_M1, left: COL1 }} onClick={handleMatchupClick} round="First Round" gameData={getFirstRoundGame(5, 12)} />
            <Matchup team1={s9} team2={s8} seed1={9} seed2={8} style={{ top: R1_M2, left: COL1 }} onClick={handleMatchupClick} round="First Round" gameData={getFirstRoundGame(8, 9)} />
            <Matchup team1={s11} team2={s6} seed1={11} seed2={6} style={{ top: R1_M3, left: COL1 }} onClick={handleMatchupClick} round="First Round" gameData={getFirstRoundGame(6, 11)} />
            <Matchup team1={s10} team2={s7} seed1={10} seed2={7} style={{ top: R1_M4, left: COL1 }} onClick={handleMatchupClick} round="First Round" gameData={getFirstRoundGame(7, 10)} />

            {/* First Round → QF connectors (bracket from 2 teams to 1 output) */}
            {/* R1_M1: 12 vs 5 → QF top slot */}
            <HLine top={R1_M1 + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <HLine top={R1_M1 + SLOT_HEIGHT + SLOT_GAP + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <VLine top={R1_M1 + SLOT_HEIGHT / 2} left={CONN_X1 + CONNECTOR_GAP / 2} height={SLOT_HEIGHT + SLOT_GAP} />
            <HLine top={R1_M1_CENTER} left={CONN_X1 + CONNECTOR_GAP / 2} width={CONNECTOR_GAP / 2} />

            {/* R1_M2: 9 vs 8 → QF top slot */}
            <HLine top={R1_M2 + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <HLine top={R1_M2 + SLOT_HEIGHT + SLOT_GAP + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <VLine top={R1_M2 + SLOT_HEIGHT / 2} left={CONN_X1 + CONNECTOR_GAP / 2} height={SLOT_HEIGHT + SLOT_GAP} />
            <HLine top={R1_M2_CENTER} left={CONN_X1 + CONNECTOR_GAP / 2} width={CONNECTOR_GAP / 2} />

            {/* R1_M3: 11 vs 6 → QF top slot */}
            <HLine top={R1_M3 + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <HLine top={R1_M3 + SLOT_HEIGHT + SLOT_GAP + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <VLine top={R1_M3 + SLOT_HEIGHT / 2} left={CONN_X1 + CONNECTOR_GAP / 2} height={SLOT_HEIGHT + SLOT_GAP} />
            <HLine top={R1_M3_CENTER} left={CONN_X1 + CONNECTOR_GAP / 2} width={CONNECTOR_GAP / 2} />

            {/* R1_M4: 10 vs 7 → QF top slot */}
            <HLine top={R1_M4 + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <HLine top={R1_M4 + SLOT_HEIGHT + SLOT_GAP + SLOT_HEIGHT / 2} left={CONN_X1} width={CONNECTOR_GAP / 2} />
            <VLine top={R1_M4 + SLOT_HEIGHT / 2} left={CONN_X1 + CONNECTOR_GAP / 2} height={SLOT_HEIGHT + SLOT_GAP} />
            <HLine top={R1_M4_CENTER} left={CONN_X1 + CONNECTOR_GAP / 2} width={CONNECTOR_GAP / 2} />

            {/* ===== QUARTERFINALS ===== */}
            {/* 5 vs 12 winner plays #4 seed */}
            <Matchup team1={getFirstRoundWinner(5, 12)} team2={s4} seed1={getWinnerSeed(5, 12)} seed2={4} style={{ top: QF_M1, left: COL2 }} onClick={handleMatchupClick} round="Quarterfinal" bowl="Sugar Bowl" />
            {/* 8 vs 9 winner plays #1 seed */}
            <Matchup team1={getFirstRoundWinner(8, 9)} team2={s1} seed1={getWinnerSeed(8, 9)} seed2={1} style={{ top: QF_M2, left: COL2 }} onClick={handleMatchupClick} round="Quarterfinal" bowl="Orange Bowl" />
            {/* 6 vs 11 winner plays #3 seed */}
            <Matchup team1={getFirstRoundWinner(6, 11)} team2={s3} seed1={getWinnerSeed(6, 11)} seed2={3} style={{ top: QF_M3, left: COL2 }} onClick={handleMatchupClick} round="Quarterfinal" bowl="Rose Bowl" />
            {/* 7 vs 10 winner plays #2 seed */}
            <Matchup team1={getFirstRoundWinner(7, 10)} team2={s2} seed1={getWinnerSeed(7, 10)} seed2={2} style={{ top: QF_M4, left: COL2 }} onClick={handleMatchupClick} round="Quarterfinal" bowl="Cotton Bowl" />

            {/* QF Bowl Logos - positioned on right side, centered between both team slots */}
            <img
              src={getBowlLogo('Sugar Bowl')}
              alt="Sugar Bowl"
              className="absolute w-14 h-14 object-contain z-10"
              style={{ top: QF_M1 + MATCHUP_HEIGHT / 2 - 28, left: COL2 + SLOT_WIDTH - 10 }}
            />
            <img
              src={getBowlLogo('Orange Bowl')}
              alt="Orange Bowl"
              className="absolute w-14 h-14 object-contain z-10"
              style={{ top: QF_M2 + MATCHUP_HEIGHT / 2 - 28, left: COL2 + SLOT_WIDTH - 10 }}
            />
            <img
              src={getBowlLogo('Rose Bowl')}
              alt="Rose Bowl"
              className="absolute w-14 h-14 object-contain z-10"
              style={{ top: QF_M3 + MATCHUP_HEIGHT / 2 - 28, left: COL2 + SLOT_WIDTH - 10 }}
            />
            <img
              src={getBowlLogo('Cotton Bowl')}
              alt="Cotton Bowl"
              className="absolute w-14 h-14 object-contain z-10"
              style={{ top: QF_M4 + MATCHUP_HEIGHT / 2 - 28, left: COL2 + SLOT_WIDTH - 10 }}
            />

            {/* QF → SF connectors */}
            {/* QF1 + QF2 feed into SF1 */}
            <HLine top={QF_M1_CENTER} left={CONN_X2} width={VCONN_X2 - CONN_X2} />
            <HLine top={QF_M2_CENTER} left={CONN_X2} width={VCONN_X2 - CONN_X2} />
            <VLine top={QF_M1_CENTER} left={VCONN_X2} height={QF_M2_CENTER - QF_M1_CENTER} />
            <HLine top={SF_M1_CENTER} left={VCONN_X2} width={COL3 - VCONN_X2} />

            {/* QF3 + QF4 feed into SF2 */}
            <HLine top={QF_M3_CENTER} left={CONN_X2} width={VCONN_X2 - CONN_X2} />
            <HLine top={QF_M4_CENTER} left={CONN_X2} width={VCONN_X2 - CONN_X2} />
            <VLine top={QF_M3_CENTER} left={VCONN_X2} height={QF_M4_CENTER - QF_M3_CENTER} />
            <HLine top={SF_M2_CENTER} left={VCONN_X2} width={COL3 - VCONN_X2} />

            {/* ===== SEMIFINALS ===== */}
            <Matchup team1={null} team2={null} seed1={null} seed2={null} style={{ top: SF_M1, left: COL3 }} onClick={handleMatchupClick} round="Semifinal" bowl="Peach Bowl" />
            <Matchup team1={null} team2={null} seed1={null} seed2={null} style={{ top: SF_M2, left: COL3 }} onClick={handleMatchupClick} round="Semifinal" bowl="Fiesta Bowl" />

            {/* SF Bowl Logos */}
            <img
              src={getBowlLogo('Peach Bowl')}
              alt="Peach Bowl"
              className="absolute w-14 h-14 object-contain z-10"
              style={{ top: SF_M1 + MATCHUP_HEIGHT / 2 - 28, left: COL3 + SLOT_WIDTH - 10 }}
            />
            <img
              src={getBowlLogo('Fiesta Bowl')}
              alt="Fiesta Bowl"
              className="absolute w-14 h-14 object-contain z-10"
              style={{ top: SF_M2 + MATCHUP_HEIGHT / 2 - 28, left: COL3 + SLOT_WIDTH - 10 }}
            />

            {/* SF → Championship connectors */}
            <HLine top={SF_M1_CENTER} left={CONN_X3} width={VCONN_X3 - CONN_X3} />
            <HLine top={SF_M2_CENTER} left={CONN_X3} width={VCONN_X3 - CONN_X3} />
            <VLine top={SF_M1_CENTER} left={VCONN_X3} height={SF_M2_CENTER - SF_M1_CENTER} />
            <HLine top={CHAMP_CENTER} left={VCONN_X3} width={COL4 - VCONN_X3} />

            {/* ===== CHAMPIONSHIP ===== */}
            <Matchup team1={null} team2={null} seed1={null} seed2={null} style={{ top: CHAMP, left: COL4 }} onClick={handleMatchupClick} round="Championship" bowl="National Championship" />

            {/* Trophy */}
            <div className="absolute text-center" style={{ top: CHAMP + MATCHUP_HEIGHT + 30, left: COL4, width: `${SLOT_WIDTH}px` }}>
              <img src="https://i.imgur.com/3goz1NK.png" alt="CFP Trophy" className="h-32 mx-auto mb-3" />
              <div className="text-lg font-bold" style={{ color: textColor }}>National Champion</div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Preview Modal (for unplayed games) */}
      {selectedGame?.isPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          onClick={() => setSelectedGame(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="p-6"
              style={{ backgroundColor: teamColors.primary }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedGame.bowl && getBowlLogo(selectedGame.bowl) && (
                    <div className="w-14 h-14 flex-shrink-0 bg-white rounded-lg p-1 flex items-center justify-center">
                      <img
                        src={getBowlLogo(selectedGame.bowl)}
                        alt={`${selectedGame.bowl} logo`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="text-white">
                    <Link
                      to={`/dynasty/${id}/cfp-bracket`}
                      onClick={() => setSelectedGame(null)}
                      className="text-xl font-bold hover:underline"
                    >
                      {selectedGame.year} CFP {selectedGame.round}
                    </Link>
                    {selectedGame.bowl && selectedGame.round !== 'First Round' && (
                      <div className="text-sm opacity-80">{selectedGame.bowl}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGame(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Matchup Preview */}
            <div className="p-8">
              <div className="flex items-center justify-center gap-6">
                {/* Team 1 */}
                <div className="text-center flex-1">
                  {selectedGame.team1 ? (
                    <>
                      <Link
                        to={`/dynasty/${id}/team/${selectedGame.team1}`}
                        onClick={() => setSelectedGame(null)}
                        className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3 hover:scale-105 transition-transform bg-white border-2 ${selectedGame.hasScore && selectedGame.winner !== selectedGame.team1 ? 'opacity-50' : ''}`}
                        style={{ borderColor: teamAbbreviations[selectedGame.team1]?.backgroundColor || '#666' }}
                      >
                        {mascotMap[selectedGame.team1] && getTeamLogo(mascotMap[selectedGame.team1]) && (
                          <img src={getTeamLogo(mascotMap[selectedGame.team1])} alt="" className="w-14 h-14 object-contain" />
                        )}
                      </Link>
                      <div className="text-xs text-gray-500 mb-1">#{selectedGame.seed1} Seed</div>
                      <Link
                        to={`/dynasty/${id}/team/${selectedGame.team1}`}
                        onClick={() => setSelectedGame(null)}
                        className={`font-bold text-lg hover:underline ${selectedGame.hasScore && selectedGame.winner !== selectedGame.team1 ? 'opacity-50' : ''}`}
                        style={{ color: teamAbbreviations[selectedGame.team1]?.backgroundColor || '#333' }}
                      >
                        {getShortName(selectedGame.team1)}
                      </Link>
                      {selectedGame.hasScore && (
                        <div className={`text-3xl font-bold mt-2 ${selectedGame.winner === selectedGame.team1 ? 'text-green-600' : 'text-gray-400'}`}>
                          {selectedGame.team1Score}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3 bg-gray-200 border-2 border-gray-300">
                        <span className="text-gray-400 text-2xl font-bold">?</span>
                      </div>
                      <div className="font-bold text-lg text-gray-400">TBD</div>
                    </>
                  )}
                </div>

                {/* VS or Score Separator */}
                {selectedGame.hasScore ? (
                  <div className="text-xl font-bold text-gray-400">-</div>
                ) : (
                  <div className="text-2xl font-bold text-gray-400">VS</div>
                )}

                {/* Team 2 */}
                <div className="text-center flex-1">
                  {selectedGame.team2 ? (
                    <>
                      <Link
                        to={`/dynasty/${id}/team/${selectedGame.team2}`}
                        onClick={() => setSelectedGame(null)}
                        className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3 hover:scale-105 transition-transform bg-white border-2 ${selectedGame.hasScore && selectedGame.winner !== selectedGame.team2 ? 'opacity-50' : ''}`}
                        style={{ borderColor: teamAbbreviations[selectedGame.team2]?.backgroundColor || '#666' }}
                      >
                        {mascotMap[selectedGame.team2] && getTeamLogo(mascotMap[selectedGame.team2]) && (
                          <img src={getTeamLogo(mascotMap[selectedGame.team2])} alt="" className="w-14 h-14 object-contain" />
                        )}
                      </Link>
                      <div className="text-xs text-gray-500 mb-1">#{selectedGame.seed2} Seed</div>
                      <Link
                        to={`/dynasty/${id}/team/${selectedGame.team2}`}
                        onClick={() => setSelectedGame(null)}
                        className={`font-bold text-lg hover:underline ${selectedGame.hasScore && selectedGame.winner !== selectedGame.team2 ? 'opacity-50' : ''}`}
                        style={{ color: teamAbbreviations[selectedGame.team2]?.backgroundColor || '#333' }}
                      >
                        {getShortName(selectedGame.team2)}
                      </Link>
                      {selectedGame.hasScore && (
                        <div className={`text-3xl font-bold mt-2 ${selectedGame.winner === selectedGame.team2 ? 'text-green-600' : 'text-gray-400'}`}>
                          {selectedGame.team2Score}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3 bg-gray-200 border-2 border-gray-300">
                        <span className="text-gray-400 text-2xl font-bold">?</span>
                      </div>
                      <div className="font-bold text-lg text-gray-400">TBD</div>
                    </>
                  )}
                </div>
              </div>

              {selectedGame.hasScore ? (
                <div className="mt-6 text-center">
                  <span
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: teamAbbreviations[selectedGame.winner]?.backgroundColor || '#22c55e',
                      color: teamAbbreviations[selectedGame.winner]?.textColor || '#fff'
                    }}
                  >
                    🏆 {getShortName(selectedGame.winner)} wins!
                  </span>
                </div>
              ) : (
                <div className="mt-6 text-center text-gray-500 text-sm">
                  Game not yet played
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Detail Modal (for played games) */}
      {selectedGame && !selectedGame.isPreview && (
        <GameDetailModal
          isOpen={true}
          onClose={() => setSelectedGame(null)}
          game={selectedGame}
          userTeam={currentDynasty.teamName}
          teamColors={teamColors}
        />
      )}
    </div>
  )
}
