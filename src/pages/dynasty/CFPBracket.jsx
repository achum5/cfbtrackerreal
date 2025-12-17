import { useDynasty } from '../../context/DynastyContext'
import { useParams } from 'react-router-dom'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { teams } from '../../data/teams'
import { getAbbreviationFromDisplayName, teamAbbreviations } from '../../data/teamAbbreviations'

// Get mascot name from team abbreviation
const getMascotName = (abbr) => {
  if (!abbr) return null
  const teamInfo = teamAbbreviations[abbr]
  if (!teamInfo) return null
  // Find the team in teams array that matches the name
  const team = teams.find(t => t.name === teamInfo.name)
  return team?.name || teamInfo.name
}

export default function CFPBracket() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  if (!currentDynasty) {
    return <div className="p-6">Loading...</div>
  }

  const currentYear = currentDynasty.currentYear
  const cfpSeeds = currentDynasty.cfpSeedsByYear?.[currentYear] || []
  const cfpResults = currentDynasty.cfpResultsByYear?.[currentYear] || {}
  const firstRound = cfpResults.firstRound || []
  const quarterfinals = cfpResults.week3 || []
  const semifinals = cfpResults.week4 || []
  const championship = cfpResults.week5 || []

  // Get team by seed
  const getTeamBySeed = (seed) => {
    const seedData = cfpSeeds.find(s => s.seed === seed)
    return seedData?.team || null
  }

  // Get first round winner (5v12, 6v11, 7v10, 8v9)
  const getFirstRoundWinner = (higherSeed, lowerSeed) => {
    // Higher seed is 5,6,7,8 and lower is 12,11,10,9
    const game = firstRound.find(g => {
      const team1 = g.team1
      const team2 = g.team2
      const team1Seed = cfpSeeds.find(s => s.team === team1)?.seed
      const team2Seed = cfpSeeds.find(s => s.team === team2)?.seed
      return (team1Seed === higherSeed && team2Seed === lowerSeed) ||
             (team1Seed === lowerSeed && team2Seed === higherSeed)
    })
    if (!game || !game.team1Score || !game.team2Score) return null
    return parseInt(game.team1Score) > parseInt(game.team2Score) ? game.team1 : game.team2
  }

  // Get quarterfinal winner
  const getQuarterfinalWinner = (gameId) => {
    const game = quarterfinals.find(g => g.id === gameId)
    if (!game || !game.team1Score || !game.team2Score) return null
    return parseInt(game.team1Score) > parseInt(game.team2Score) ? game.team1 : game.team2
  }

  // Get semifinal winner
  const getSemifinalWinner = (gameId) => {
    const game = semifinals.find(g => g.id === gameId)
    if (!game || !game.team1Score || !game.team2Score) return null
    return parseInt(game.team1Score) > parseInt(game.team2Score) ? game.team1 : game.team2
  }

  // Get championship winner
  const getChampionshipWinner = () => {
    const game = championship.find(g => g.id === 'championship')
    if (!game || !game.team1Score || !game.team2Score) return null
    return parseInt(game.team1Score) > parseInt(game.team2Score) ? game.team1 : game.team2
  }

  // Calculate who advances to each round
  const firstRoundWinners = {
    '5v12': getFirstRoundWinner(5, 12),
    '6v11': getFirstRoundWinner(6, 11),
    '7v10': getFirstRoundWinner(7, 10),
    '8v9': getFirstRoundWinner(8, 9)
  }

  const qfWinners = {
    qf1: getQuarterfinalWinner('qf1'), // #1 vs 8/9 winner
    qf2: getQuarterfinalWinner('qf2'), // #4 vs 5/12 winner
    qf3: getQuarterfinalWinner('qf3'), // #3 vs 6/11 winner
    qf4: getQuarterfinalWinner('qf4')  // #2 vs 7/10 winner
  }

  const sfWinners = {
    sf1: getSemifinalWinner('sf1'), // qf1 vs qf2 winner
    sf2: getSemifinalWinner('sf2')  // qf3 vs qf4 winner
  }

  const champion = getChampionshipWinner()

  // Team slot component
  const TeamSlot = ({ team, seed, isWinner = false, showSeed = true, size = 'normal' }) => {
    if (!team) {
      return (
        <div
          className={`flex items-center gap-2 ${size === 'small' ? 'p-1.5' : 'p-2'} rounded border-2 border-dashed`}
          style={{ borderColor: `${teamColors.primary}40`, backgroundColor: `${teamColors.primary}10` }}
        >
          {showSeed && seed && <span className="text-xs font-bold opacity-50" style={{ color: secondaryBgText }}>#{seed}</span>}
          <span className={`${size === 'small' ? 'text-xs' : 'text-sm'} opacity-50`} style={{ color: secondaryBgText }}>TBD</span>
        </div>
      )
    }

    const teamData = teamAbbreviations[team]
    const mascotName = getMascotName(team) || teamData?.name || team
    const bgColor = teamData?.backgroundColor || teamColors.primary
    const textColor = getContrastTextColor(bgColor)

    return (
      <div
        className={`flex items-center gap-2 ${size === 'small' ? 'p-1.5' : 'p-2'} rounded shadow-sm ${isWinner ? 'ring-2 ring-yellow-400' : ''}`}
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        {showSeed && seed && <span className={`${size === 'small' ? 'text-xs' : 'text-sm'} font-bold opacity-80`}>#{seed}</span>}
        <img
          src={`/logos/${mascotName.toLowerCase().replace(/[^a-z]/g, '')}.png`}
          alt=""
          className={`${size === 'small' ? 'w-4 h-4' : 'w-5 h-5'} object-contain`}
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <span className={`${size === 'small' ? 'text-xs' : 'text-sm'} font-semibold truncate`}>{team}</span>
        {isWinner && <span className="text-yellow-300">W</span>}
      </div>
    )
  }

  // Matchup component
  const Matchup = ({ team1, team2, seed1, seed2, winner, showSeeds = true, title, size = 'normal' }) => {
    return (
      <div className={`flex flex-col ${size === 'small' ? 'gap-0.5' : 'gap-1'}`}>
        {title && <div className="text-xs font-semibold mb-1 opacity-70" style={{ color: secondaryBgText }}>{title}</div>}
        <TeamSlot team={team1} seed={seed1} isWinner={winner === team1} showSeed={showSeeds} size={size} />
        <TeamSlot team={team2} seed={seed2} isWinner={winner === team2} showSeed={showSeeds} size={size} />
      </div>
    )
  }

  // If no seeds entered yet
  if (cfpSeeds.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6" style={{ color: secondaryBgText }}>
          {currentYear} CFP Bracket
        </h1>
        <div
          className="p-8 rounded-lg text-center"
          style={{ backgroundColor: `${teamColors.primary}10`, borderColor: `${teamColors.primary}30`, border: '2px dashed' }}
        >
          <p className="text-lg mb-2" style={{ color: secondaryBgText }}>CFP Seeds Not Yet Entered</p>
          <p className="opacity-70" style={{ color: secondaryBgText }}>
            Enter CFP seeds in Bowl Week 1 to see the bracket
          </p>
        </div>
      </div>
    )
  }

  // Build the bracket layout
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: secondaryBgText }}>
        {currentYear} CFP Bracket
      </h1>

      {/* Champion Display */}
      {champion && (
        <div className="mb-8 text-center">
          <div className="inline-block p-4 rounded-lg shadow-lg" style={{ backgroundColor: teamColors.primary }}>
            <div className="text-lg font-bold mb-2" style={{ color: primaryBgText }}>National Champion</div>
            <TeamSlot team={champion} showSeed={false} isWinner={true} />
          </div>
        </div>
      )}

      {/* Bracket Grid - Horizontal Layout */}
      <div className="overflow-x-auto">
        <div className="min-w-[1000px] flex gap-4 items-center justify-between">

          {/* First Round (Left Side) */}
          <div className="flex flex-col gap-4 w-44">
            <h3 className="text-sm font-bold text-center pb-2 border-b" style={{ color: secondaryBgText, borderColor: `${teamColors.primary}30` }}>
              First Round
            </h3>
            <Matchup
              team1={getTeamBySeed(5)}
              team2={getTeamBySeed(12)}
              seed1={5}
              seed2={12}
              winner={firstRoundWinners['5v12']}
              title="At #5 Seed"
              size="small"
            />
            <Matchup
              team1={getTeamBySeed(8)}
              team2={getTeamBySeed(9)}
              seed1={8}
              seed2={9}
              winner={firstRoundWinners['8v9']}
              title="At #8 Seed"
              size="small"
            />
            <Matchup
              team1={getTeamBySeed(6)}
              team2={getTeamBySeed(11)}
              seed1={6}
              seed2={11}
              winner={firstRoundWinners['6v11']}
              title="At #6 Seed"
              size="small"
            />
            <Matchup
              team1={getTeamBySeed(7)}
              team2={getTeamBySeed(10)}
              seed1={7}
              seed2={10}
              winner={firstRoundWinners['7v10']}
              title="At #7 Seed"
              size="small"
            />
          </div>

          {/* Quarterfinals */}
          <div className="flex flex-col gap-4 w-44">
            <h3 className="text-sm font-bold text-center pb-2 border-b" style={{ color: secondaryBgText, borderColor: `${teamColors.primary}30` }}>
              Quarterfinals
            </h3>
            {/* QF1: #1 vs 8/9 winner (Fiesta or Peach) */}
            <Matchup
              team1={getTeamBySeed(1)}
              team2={firstRoundWinners['8v9']}
              seed1={1}
              winner={qfWinners.qf1}
              showSeeds={false}
              title="#1 vs 8/9 Winner"
              size="small"
            />
            {/* QF2: #4 vs 5/12 winner */}
            <Matchup
              team1={getTeamBySeed(4)}
              team2={firstRoundWinners['5v12']}
              seed1={4}
              winner={qfWinners.qf2}
              showSeeds={false}
              title="#4 vs 5/12 Winner"
              size="small"
            />
            {/* QF3: #3 vs 6/11 winner */}
            <Matchup
              team1={getTeamBySeed(3)}
              team2={firstRoundWinners['6v11']}
              seed1={3}
              winner={qfWinners.qf3}
              showSeeds={false}
              title="#3 vs 6/11 Winner"
              size="small"
            />
            {/* QF4: #2 vs 7/10 winner */}
            <Matchup
              team1={getTeamBySeed(2)}
              team2={firstRoundWinners['7v10']}
              seed1={2}
              winner={qfWinners.qf4}
              showSeeds={false}
              title="#2 vs 7/10 Winner"
              size="small"
            />
          </div>

          {/* Semifinals */}
          <div className="flex flex-col gap-8 w-44">
            <h3 className="text-sm font-bold text-center pb-2 border-b" style={{ color: secondaryBgText, borderColor: `${teamColors.primary}30` }}>
              Semifinals
            </h3>
            {/* SF1: QF1 winner vs QF2 winner */}
            <Matchup
              team1={qfWinners.qf1}
              team2={qfWinners.qf2}
              winner={sfWinners.sf1}
              showSeeds={false}
              title="QF1 vs QF2"
              size="small"
            />
            {/* SF2: QF3 winner vs QF4 winner */}
            <Matchup
              team1={qfWinners.qf3}
              team2={qfWinners.qf4}
              winner={sfWinners.sf2}
              showSeeds={false}
              title="QF3 vs QF4"
              size="small"
            />
          </div>

          {/* Championship */}
          <div className="flex flex-col gap-4 w-44">
            <h3 className="text-sm font-bold text-center pb-2 border-b" style={{ color: secondaryBgText, borderColor: `${teamColors.primary}30` }}>
              Championship
            </h3>
            <Matchup
              team1={sfWinners.sf1}
              team2={sfWinners.sf2}
              winner={champion}
              showSeeds={false}
              title="National Championship"
            />
          </div>

        </div>
      </div>

      {/* Seeds List */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4" style={{ color: secondaryBgText }}>
          {currentYear} CFP Seeds
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {cfpSeeds.sort((a, b) => a.seed - b.seed).map(({ seed, team }) => (
            <TeamSlot key={seed} team={team} seed={seed} showSeed={true} />
          ))}
        </div>
        <div className="mt-4 text-sm opacity-70" style={{ color: secondaryBgText }}>
          <p>Seeds 1-4 receive first-round byes and host quarterfinal games</p>
          <p>Seeds 5-12 play first-round games at higher seed's home stadium</p>
        </div>
      </div>
    </div>
  )
}
