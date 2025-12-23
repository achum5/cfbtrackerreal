import { useMemo, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getTeamColors } from '../../data/teamColors'
import { getTeamLogo } from '../../data/teams'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'

// Star display helper
const StarRating = ({ stars, size = 'md' }) => {
  const starCount = Number(stars) || 0
  const sizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={sizes[size]}
          fill={i < starCount ? '#FFD700' : '#D1D5DB'}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// Dev trait badge colors
const getDevTraitStyle = (devTrait) => {
  switch (devTrait?.toLowerCase()) {
    case 'elite':
      return { backgroundColor: '#FCD34D', color: '#78350F' }
    case 'star':
      return { backgroundColor: '#A78BFA', color: '#4C1D95' }
    case 'impact':
      return { backgroundColor: '#60A5FA', color: '#1E3A8A' }
    default:
      return { backgroundColor: '#9CA3AF', color: '#1F2937' }
  }
}

// Gem/Bust badge
const GemBustBadge = ({ value }) => {
  if (!value) return null
  const isGem = value.toLowerCase() === 'gem'
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-bold"
      style={{
        backgroundColor: isGem ? '#10B981' : '#EF4444',
        color: 'white'
      }}
    >
      {isGem ? '💎 Gem' : '💥 Bust'}
    </span>
  )
}

export default function Recruiting() {
  const { currentDynasty } = useDynasty()
  const { teamAbbr: urlTeamAbbr, year: urlYear } = useParams()
  const navigate = useNavigate()

  // Get current team abbreviation (for redirect if no URL params)
  const currentTeamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName) || currentDynasty?.teamName

  // Use URL params if provided, otherwise use current team/year
  const teamAbbr = urlTeamAbbr || currentTeamAbbr
  const selectedYear = urlYear ? Number(urlYear) : currentDynasty?.currentYear

  // Get team info for display
  const teamData = teamAbbreviations[teamAbbr]
  const teamFullName = teamData?.name || teamAbbr
  const teamLogo = getTeamLogo(teamFullName)

  // Use the viewed team's colors (pass full team name, not abbreviation)
  const viewedTeamColors = getTeamColors(teamFullName)
  const teamColors = viewedTeamColors || { primary: '#1F2937', secondary: '#F3F4F6' }
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  // Redirect to team-specific URL if on base /recruiting route
  useEffect(() => {
    if (!urlTeamAbbr && currentTeamAbbr && currentDynasty?.currentYear) {
      navigate(`/dynasty/${currentDynasty.id}/recruiting/${currentTeamAbbr}/${currentDynasty.currentYear}`, { replace: true })
    }
  }, [urlTeamAbbr, currentTeamAbbr, currentDynasty?.id, currentDynasty?.currentYear, navigate])

  // Get all years with recruiting commitments for this team - TEAM-CENTRIC
  const availableYears = useMemo(() => {
    if (!currentDynasty?.recruitingCommitmentsByTeamYear?.[teamAbbr]) return []
    return Object.keys(currentDynasty.recruitingCommitmentsByTeamYear[teamAbbr])
      .map(Number)
      .sort((a, b) => b - a) // Most recent first
  }, [currentDynasty?.recruitingCommitmentsByTeamYear, teamAbbr])

  // Handle year change - navigate to new URL
  const handleYearChange = (newYear) => {
    navigate(`/dynasty/${currentDynasty.id}/recruiting/${teamAbbr}/${newYear}`)
  }

  if (!currentDynasty) return null

  // Get all commitments for selected year - TEAM-CENTRIC
  const commitmentsForYear = currentDynasty.recruitingCommitmentsByTeamYear?.[teamAbbr]?.[selectedYear] || {}
  const allCommitments = useMemo(() => {
    const commitments = []
    Object.entries(commitmentsForYear).forEach(([key, weekCommitments]) => {
      if (Array.isArray(weekCommitments)) {
        weekCommitments.forEach(commit => {
          commitments.push({ ...commit, commitmentWeek: key })
        })
      }
    })
    // Sort by national rank (lowest/best first), unranked players at the end
    return commitments.sort((a, b) => {
      const rankA = Number(a.nationalRank) || 9999
      const rankB = Number(b.nationalRank) || 9999
      if (rankA !== rankB) return rankA - rankB
      // If same rank (or both unranked), sort by stars
      const starsA = Number(a.stars) || 0
      const starsB = Number(b.stars) || 0
      return starsB - starsA
    })
  }, [commitmentsForYear])

  // Calculate class stats
  const classStats = useMemo(() => {
    const fiveStars = allCommitments.filter(c => Number(c.stars) === 5).length
    const fourStars = allCommitments.filter(c => Number(c.stars) === 4).length
    const threeStars = allCommitments.filter(c => Number(c.stars) === 3).length
    const avgStars = allCommitments.length > 0
      ? (allCommitments.reduce((sum, c) => sum + (Number(c.stars) || 0), 0) / allCommitments.length).toFixed(2)
      : 0
    const transfers = allCommitments.filter(c => c.previousTeam).length
    const highSchool = allCommitments.filter(c => c.class === 'HS' || !c.previousTeam).length

    return { fiveStars, fourStars, threeStars, avgStars, transfers, highSchool, total: allCommitments.length }
  }, [allCommitments])

  // Get player by name to link to player page - filter by team
  const findPlayerByName = (name) => {
    if (!name) return null
    return currentDynasty.players?.find(p =>
      p.name?.toLowerCase().trim() === name.toLowerCase().trim() &&
      p.isRecruit &&
      p.team === teamAbbr
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Team Logo and Year Selector */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* Team Logo and Title */}
          <div className="flex items-center gap-4">
            {teamLogo && (
              <img
                src={teamLogo}
                alt={teamFullName}
                className="w-16 h-16 object-contain"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold" style={{ color: secondaryBgText }}>
                {teamFullName}
              </h2>
              <p className="text-sm font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>
                {selectedYear} Recruiting Class
              </p>
            </div>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: secondaryBgText }}>
              Season:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border-2 font-semibold"
              style={{
                borderColor: teamColors.primary,
                backgroundColor: teamColors.secondary,
                color: secondaryBgText
              }}
            >
              {availableYears.length > 0 ? (
                availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))
              ) : (
                <option value={selectedYear}>{selectedYear}</option>
              )}
            </select>
          </div>
        </div>

        {/* Class Stats Summary */}
        {allCommitments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${teamColors.primary}15` }}>
              <div className="text-2xl font-bold" style={{ color: teamColors.primary }}>{classStats.total}</div>
              <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>Total</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#FEF3C720' }}>
              <div className="text-2xl font-bold" style={{ color: '#B45309' }}>{classStats.fiveStars}</div>
              <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>5-Star</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#E0E7FF20' }}>
              <div className="text-2xl font-bold" style={{ color: '#4338CA' }}>{classStats.fourStars}</div>
              <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>4-Star</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#DBEAFE20' }}>
              <div className="text-2xl font-bold" style={{ color: '#1D4ED8' }}>{classStats.threeStars}</div>
              <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>3-Star</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#FCD34D20' }}>
              <div className="text-2xl font-bold" style={{ color: '#B45309' }}>{classStats.avgStars}</div>
              <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>Avg Stars</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#10B98120' }}>
              <div className="text-2xl font-bold" style={{ color: '#047857' }}>{classStats.highSchool}</div>
              <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>HS Recruits</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: '#8B5CF620' }}>
              <div className="text-2xl font-bold" style={{ color: '#6D28D9' }}>{classStats.transfers}</div>
              <div className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>Transfers</div>
            </div>
          </div>
        )}

        {/* Recruit Cards */}
        {allCommitments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allCommitments.map((recruit, index) => {
              const player = findPlayerByName(recruit.name)
              const transferTeamColors = recruit.previousTeam ? getTeamColors(recruit.previousTeam) : null
              const transferTeamLogo = recruit.previousTeam ? getTeamLogo(
                teamAbbreviations[recruit.previousTeam]?.name || recruit.previousTeam
              ) : null

              const cardContent = (
                <div
                  className="p-4 rounded-lg border-2 hover:shadow-lg transition-shadow"
                  style={{
                    borderColor: `${teamColors.primary}40`,
                    backgroundColor: teamColors.secondary
                  }}
                >
                  {/* Header: Picture, Name, Position, Stars */}
                  <div className="flex items-start gap-3 mb-3">
                    {/* Player Picture (if exists) */}
                    {player?.pictureUrl && (
                      <img
                        src={player.pictureUrl}
                        alt={recruit.name}
                        className="w-14 h-14 object-cover rounded-lg border-2 flex-shrink-0"
                        style={{ borderColor: teamColors.primary }}
                      />
                    )}

                    <div className="flex-1 min-w-0 flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-bold text-lg truncate"
                          style={{ color: player ? teamColors.primary : secondaryBgText }}
                        >
                          {recruit.name || 'Unknown'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-bold"
                            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
                          >
                            {recruit.position || 'ATH'}
                          </span>
                          <span className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>
                            {recruit.class || 'HS'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StarRating stars={recruit.stars} />
                        {recruit.nationalRank && (
                          <span className="text-xs font-medium" style={{ color: secondaryBgText, opacity: 0.7 }}>
                            #{recruit.nationalRank} Nat'l
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    {recruit.archetype && (
                      <div>
                        <span style={{ color: secondaryBgText, opacity: 0.6 }}>Type: </span>
                        <span className="font-medium" style={{ color: secondaryBgText }}>{recruit.archetype}</span>
                      </div>
                    )}
                    {(recruit.height || recruit.weight) && (
                      <div>
                        <span style={{ color: secondaryBgText, opacity: 0.6 }}>Size: </span>
                        <span className="font-medium" style={{ color: secondaryBgText }}>
                          {recruit.height}{recruit.weight ? `, ${recruit.weight} lbs` : ''}
                        </span>
                      </div>
                    )}
                    {(recruit.hometown || recruit.state) && (
                      <div className="col-span-2">
                        <span style={{ color: secondaryBgText, opacity: 0.6 }}>From: </span>
                        <span className="font-medium" style={{ color: secondaryBgText }}>
                          {recruit.hometown}{recruit.state ? `, ${recruit.state}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Rankings Row */}
                  {(recruit.stateRank || recruit.positionRank) && (
                    <div className="flex gap-3 text-xs mb-3" style={{ color: secondaryBgText, opacity: 0.7 }}>
                      {recruit.stateRank && <span>#{recruit.stateRank} in State</span>}
                      {recruit.positionRank && <span>#{recruit.positionRank} {recruit.position}</span>}
                    </div>
                  )}

                  {/* Bottom Row: Dev Trait, Gem/Bust, Transfer */}
                  <div className="flex items-center flex-wrap gap-2">
                    {recruit.devTrait && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={getDevTraitStyle(recruit.devTrait)}
                      >
                        {recruit.devTrait}
                      </span>
                    )}
                    <GemBustBadge value={recruit.gemBust} />
                    {recruit.previousTeam && (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: transferTeamColors?.primary || '#6B7280',
                          color: getContrastTextColor(transferTeamColors?.primary || '#6B7280')
                        }}
                      >
                        {transferTeamLogo && (
                          <img src={transferTeamLogo} alt="" className="w-3 h-3" />
                        )}
                        <span>From {recruit.previousTeam}</span>
                      </div>
                    )}
                  </div>
                </div>
              )

              // Wrap in Link if player exists
              return player ? (
                <Link
                  key={`${recruit.name}-${index}`}
                  to={`/dynasty/${currentDynasty.id}/player/${player.pid}`}
                  className="block"
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={`${recruit.name}-${index}`}>
                  {cardContent}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
              No Commitments Yet
            </h3>
            <p style={{ color: secondaryBgText, opacity: 0.8 }} className="max-w-md mx-auto">
              {selectedYear === currentDynasty.currentYear
                ? 'Record recruiting commitments during preseason, regular season, or signing day.'
                : `No recruiting data recorded for the ${selectedYear} class.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
