import { useState, useEffect } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { teamAbbreviations } from '../data/teamAbbreviations'
import { getTeamLogo } from '../data/teams'
import { getBowlLogo } from '../data/bowlGames'

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
  'MZST': 'Missouri State Bears', 'MRSH': 'Marshall Thundering Herd', 'NAVY': 'Navy Midshipmen',
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

// Semifinal bowl structure
// Peach Bowl: Sugar Bowl winner vs Orange Bowl winner
// Fiesta Bowl: Rose Bowl winner vs Cotton Bowl winner
const SEMIFINAL_GAMES = [
  {
    id: 'peach',
    bowlName: 'Peach Bowl',
    qfBowl1: 'Sugar Bowl',
    qfBowl2: 'Orange Bowl'
  },
  {
    id: 'fiesta',
    bowlName: 'Fiesta Bowl',
    qfBowl1: 'Rose Bowl',
    qfBowl2: 'Cotton Bowl'
  }
]

export default function CFPSemifinalsModal({ isOpen, onClose, onSave, currentYear, teamColors, userTeamAbbr }) {
  const { currentDynasty } = useDynasty()
  const [games, setGames] = useState([])
  const [saving, setSaving] = useState(false)
  const [userGameIndex, setUserGameIndex] = useState(-1) // Index of user's game (if any)

  // Get seed by team
  const getSeedByTeam = (team) => {
    const cfpSeeds = currentDynasty?.cfpSeedsByYear?.[currentYear] || []
    const seedEntry = cfpSeeds.find(s => s.team === team)
    return seedEntry?.seed || null
  }

  // Get team info for display
  const getTeamInfo = (abbr) => {
    if (!abbr) return null
    const teamData = teamAbbreviations[abbr]
    const mascotName = mascotMap[abbr]
    const logo = mascotName ? getTeamLogo(mascotName) : null

    // Extract just the school name (remove mascot suffix)
    // e.g., "Kentucky Wildcats" -> "Kentucky", "Duke Blue Devils" -> "Duke"
    const getSchoolName = (fullName) => {
      if (!fullName) return abbr
      // Common multi-word mascots to remove
      const mascots = [
        'Fightin\' Blue Hens', 'Blue Devils', 'Yellow Jackets', 'Golden Gophers',
        'Horned Frogs', 'Red Raiders', 'Green Wave', 'Golden Hurricane', 'Mean Green',
        'Demon Deacons', 'Fighting Irish', 'Fighting Illini', 'Golden Flashes',
        'Ragin\' Cajuns', 'Black Knights', 'Blue Raiders', 'Golden Bears', 'Scarlet Knights',
        'Nittany Lions', 'Crimson Tide', 'Sun Devils', 'Red Wolves', 'Thundering Herd',
        'Rainbow Warriors', 'Wolf Pack', 'Tar Heels', 'Running Rebels'
      ]
      for (const mascot of mascots) {
        if (fullName.endsWith(mascot)) {
          return fullName.replace(mascot, '').trim()
        }
      }
      // Default: remove last word (single-word mascot)
      const words = fullName.split(' ')
      return words.length > 1 ? words.slice(0, -1).join(' ') : fullName
    }

    return {
      abbr,
      name: getSchoolName(mascotName) || teamData?.name || abbr,
      fullMascot: mascotName,
      backgroundColor: teamData?.backgroundColor || '#4B5563',
      textColor: teamData?.textColor || '#FFFFFF',
      logo,
      seed: getSeedByTeam(abbr)
    }
  }

  // Initialize games with auto-filled teams from quarterfinal results
  useEffect(() => {
    if (isOpen) {
      const qfResults = currentDynasty?.cfpResultsByYear?.[currentYear]?.quarterfinals || []
      const existingSemis = currentDynasty?.cfpResultsByYear?.[currentYear]?.semifinals || []

      // Find user's CFP Semifinal game from their games[] array (source of truth)
      const userSFGame = currentDynasty?.games?.find(g => {
        if (Number(g.year) !== Number(currentYear)) return false
        if (g.teamScore === undefined || g.teamScore === null || g.teamScore === '') return false
        // Check if it's a CFP semifinal
        if (g.isCFPSemifinal) return true
        if (g.bowlName === 'Peach Bowl' || g.bowlName === 'Fiesta Bowl') return true
        return false
      })

      const initialGames = SEMIFINAL_GAMES.map((sf, index) => {
        // Get winners from quarterfinals
        const qf1 = qfResults.find(g => g.bowlName === sf.qfBowl1)
        const qf2 = qfResults.find(g => g.bowlName === sf.qfBowl2)

        // Check if we have existing semifinal data
        const existing = existingSemis.find(g => g.bowlName === sf.bowlName)

        // Determine teams - from existing data or quarterfinal winners
        const team1 = existing?.team1 || qf1?.winner || ''
        const team2 = existing?.team2 || qf2?.winner || ''

        // Check if user's team is in this game
        const userInThisGame = userTeamAbbr && (team1 === userTeamAbbr || team2 === userTeamAbbr)

        // If user is in this game
        if (userInThisGame) {
          const userIsTeam1 = team1 === userTeamAbbr

          // PRIORITY: Check user's games[] array first (source of truth)
          if (userSFGame && userSFGame.teamScore !== undefined && userSFGame.teamScore !== '') {
            // User's game from games[] array - this is the live/updated score
            return {
              id: sf.id,
              bowlName: sf.bowlName,
              team1,
              team2,
              team1Score: userIsTeam1 ? userSFGame.teamScore : userSFGame.opponentScore,
              team2Score: userIsTeam1 ? userSFGame.opponentScore : userSFGame.teamScore,
              qfBowl1: sf.qfBowl1,
              qfBowl2: sf.qfBowl2,
              userGame: true // Flag to indicate this is user's game - NOT EDITABLE
            }
          }

          // Fallback: Check cfpResultsByYear.semifinals (might be stale but better than nothing)
          const hasExistingScores = existing?.team1Score !== undefined && existing?.team1Score !== '' &&
                                    existing?.team2Score !== undefined && existing?.team2Score !== ''
          if (hasExistingScores) {
            return {
              id: sf.id,
              bowlName: sf.bowlName,
              team1,
              team2,
              team1Score: existing.team1Score,
              team2Score: existing.team2Score,
              qfBowl1: sf.qfBowl1,
              qfBowl2: sf.qfBowl2,
              userGame: true
            }
          }

          // User's game exists but not yet entered
          return {
            id: sf.id,
            bowlName: sf.bowlName,
            team1,
            team2,
            team1Score: '',
            team2Score: '',
            qfBowl1: sf.qfBowl1,
            qfBowl2: sf.qfBowl2,
            userGame: true,
            userGamePending: true
          }
        }

        // CPU vs CPU game - use existing data or empty
        return {
          id: sf.id,
          bowlName: sf.bowlName,
          team1,
          team2,
          team1Score: existing?.team1Score ?? '',
          team2Score: existing?.team2Score ?? '',
          qfBowl1: sf.qfBowl1,
          qfBowl2: sf.qfBowl2
        }
      })

      // Track which game index is the user's
      const userIdx = initialGames.findIndex(g => g.userGame)
      setUserGameIndex(userIdx)

      setGames(initialGames)
    }
  }, [isOpen, currentYear, currentDynasty, userTeamAbbr])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleScoreChange = (gameIndex, field, value) => {
    const updatedGames = [...games]
    updatedGames[gameIndex] = {
      ...updatedGames[gameIndex],
      [field]: value
    }
    setGames(updatedGames)
  }

  const handleSave = async () => {
    // Check if user's game is pending (not yet played)
    const userPendingGame = games.find(g => g.userGame && g.userGamePending)
    if (userPendingGame) {
      alert('Please play and enter your semifinal game first before saving results.')
      return
    }

    // Validate all games have scores
    const allComplete = games.every(g =>
      g.team1 && g.team2 && g.team1Score !== '' && g.team2Score !== ''
    )

    if (!allComplete) {
      alert('Please enter scores for all games')
      return
    }

    setSaving(true)
    try {
      // Process games to add winner and seeds
      const processedGames = games.map(game => ({
        ...game,
        team1Score: parseInt(game.team1Score),
        team2Score: parseInt(game.team2Score),
        winner: parseInt(game.team1Score) > parseInt(game.team2Score) ? game.team1 : game.team2,
        seed1: getSeedByTeam(game.team1),
        seed2: getSeedByTeam(game.team2)
      }))

      await onSave(processedGames)
      onClose()
    } catch (error) {
      console.error('Error saving CFP Semifinals results:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] py-8 px-4 sm:p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-3xl max-h-[calc(100vh-4rem)] sm:max-h-[90vh] overflow-auto"
        style={{ backgroundColor: '#1a1a2e' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-5 rounded-t-xl"
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  CFP Semifinals
                </h2>
                <p className="text-white/80 text-sm mt-0.5">
                  {currentYear} College Football Playoff
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Games */}
        <div className="p-6 space-y-6">
          {games.map((game, index) => {
            const team1Info = getTeamInfo(game.team1)
            const team2Info = getTeamInfo(game.team2)
            const bowlLogo = getBowlLogo(game.bowlName)

            return (
              <div
                key={game.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #16213e 0%, #1a1a2e 100%)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                }}
              >
                {/* Bowl Header */}
                <div
                  className="px-5 py-4 flex items-center gap-4"
                  style={{
                    background: game.userGame
                      ? 'linear-gradient(90deg, rgba(34,197,94,0.2) 0%, rgba(22,163,74,0.2) 100%)'
                      : 'linear-gradient(90deg, rgba(30,58,95,0.3) 0%, rgba(15,39,68,0.3) 100%)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {bowlLogo && (
                    <div className="w-12 h-12 bg-white rounded-lg p-1.5 flex items-center justify-center flex-shrink-0">
                      <img
                        src={bowlLogo}
                        alt={game.bowlName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white flex-1">
                    {game.bowlName}
                  </h3>
                  {game.userGame && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      game.userGamePending ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                      {game.userGamePending ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {game.userGamePending ? 'PENDING' : 'YOUR GAME'}
                    </span>
                  )}
                </div>

                {/* Teams */}
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Team 1 */}
                    <div className="flex-1">
                      {team1Info ? (
                        <div
                          className="rounded-xl p-4 flex items-center gap-3"
                          style={{
                            backgroundColor: team1Info.backgroundColor,
                            boxShadow: `0 4px 20px ${team1Info.backgroundColor}40`
                          }}
                        >
                          {team1Info.logo && (
                            <div className="w-14 h-14 bg-white rounded-full p-1.5 flex items-center justify-center flex-shrink-0">
                              <img
                                src={team1Info.logo}
                                alt={team1Info.fullMascot}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold opacity-70" style={{ color: team1Info.textColor }}>
                              #{team1Info.seed} Seed
                            </div>
                            <div className="text-lg font-bold truncate" style={{ color: team1Info.textColor }}>
                              {team1Info.name}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl p-4 bg-gray-700 text-gray-400 text-center">
                          <span className="text-lg font-semibold">TBD</span>
                          <p className="text-xs mt-1">Awaiting {game.qfBowl1} result</p>
                        </div>
                      )}
                    </div>

                    {/* Scores */}
                    <div className="flex items-center gap-2">
                      {game.userGame && game.userGamePending ? (
                        /* User game not yet entered - show pending message */
                        <div className="px-4 py-3 rounded-xl bg-amber-500/20 border-2 border-amber-500/50 text-center">
                          <div className="text-amber-400 text-sm font-semibold">Enter via Game Entry</div>
                          <div className="text-amber-400/70 text-xs mt-0.5">Play this game first</div>
                        </div>
                      ) : game.userGame ? (
                        /* User game entered - display scores as text (read-only from games array) */
                        <>
                          <div
                            className="w-16 h-16 flex items-center justify-center text-2xl font-bold rounded-xl border-2"
                            style={{
                              backgroundColor: team1Info?.backgroundColor || '#374151',
                              color: team1Info?.textColor || '#fff',
                              borderColor: 'rgba(34,197,94,0.6)'
                            }}
                          >
                            {game.team1Score}
                          </div>
                          <div className="text-white/40 text-xl font-bold px-2">-</div>
                          <div
                            className="w-16 h-16 flex items-center justify-center text-2xl font-bold rounded-xl border-2"
                            style={{
                              backgroundColor: team2Info?.backgroundColor || '#374151',
                              color: team2Info?.textColor || '#fff',
                              borderColor: 'rgba(34,197,94,0.6)'
                            }}
                          >
                            {game.team2Score}
                          </div>
                        </>
                      ) : (
                        /* CPU game - editable inputs */
                        <>
                          <input
                            type="number"
                            min="0"
                            value={game.team1Score}
                            onChange={(e) => handleScoreChange(index, 'team1Score', e.target.value)}
                            className="w-16 h-16 text-center text-2xl font-bold rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                            style={{
                              backgroundColor: team1Info?.backgroundColor || '#374151',
                              color: team1Info?.textColor || '#fff',
                              borderColor: 'rgba(255,255,255,0.2)'
                            }}
                            placeholder="0"
                            disabled={!game.team1}
                          />
                          <div className="text-white/40 text-xl font-bold px-2">-</div>
                          <input
                            type="number"
                            min="0"
                            value={game.team2Score}
                            onChange={(e) => handleScoreChange(index, 'team2Score', e.target.value)}
                            className="w-16 h-16 text-center text-2xl font-bold rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                            style={{
                              backgroundColor: team2Info?.backgroundColor || '#374151',
                              color: team2Info?.textColor || '#fff',
                              borderColor: 'rgba(255,255,255,0.2)'
                            }}
                            placeholder="0"
                            disabled={!game.team2}
                          />
                        </>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="flex-1">
                      {team2Info ? (
                        <div
                          className="rounded-xl p-4 flex items-center gap-3 flex-row-reverse"
                          style={{
                            backgroundColor: team2Info.backgroundColor,
                            boxShadow: `0 4px 20px ${team2Info.backgroundColor}40`
                          }}
                        >
                          {team2Info.logo && (
                            <div className="w-14 h-14 bg-white rounded-full p-1.5 flex items-center justify-center flex-shrink-0">
                              <img
                                src={team2Info.logo}
                                alt={team2Info.fullMascot}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 text-right">
                            <div className="text-xs font-semibold opacity-70" style={{ color: team2Info.textColor }}>
                              #{team2Info.seed} Seed
                            </div>
                            <div className="text-lg font-bold truncate" style={{ color: team2Info.textColor }}>
                              {team2Info.name}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl p-4 bg-gray-700 text-gray-400 text-center">
                          <span className="text-lg font-semibold">TBD</span>
                          <p className="text-xs mt-1">Awaiting {game.qfBowl2} result</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 bg-[#1a1a2e] border-t border-white/10">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || games.some(g => !g.team1 || !g.team2)}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
                boxShadow: '0 4px 15px rgba(30,58,95,0.4)'
              }}
            >
              {saving ? 'Saving...' : 'Save Results'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-white/80 hover:text-white transition-colors border border-white/20 hover:border-white/40"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
