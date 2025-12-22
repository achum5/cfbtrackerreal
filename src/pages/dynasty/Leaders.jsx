import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import { calculateSeasonPWAR } from '../../utils/pwarCalculations'
import { getTeamLogo } from '../../data/teams'
import { teamAbbreviations } from '../../data/teamAbbreviations'

// Category definitions
const CATEGORIES = [
  { value: 'Offense', label: 'Offense', positions: ['QB', 'FB', 'HB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'] },
  { value: 'Defense', label: 'Defense', positions: ['LEDG', 'REDG', 'DT', 'WILL', 'MIKE', 'SAM', 'CB', 'FS', 'SS'] },
  { value: 'Special Teams', label: 'Special Teams', positions: ['K', 'P'] },
  { value: 'QB', label: 'QB', positions: ['QB'] },
  { value: 'FB', label: 'FB', positions: ['FB'] },
  { value: 'HB', label: 'HB', positions: ['HB'] },
  { value: 'WR', label: 'WR', positions: ['WR'] },
  { value: 'TE', label: 'TE', positions: ['TE'] },
  { value: 'LT', label: 'LT', positions: ['LT'] },
  { value: 'LG', label: 'LG', positions: ['LG'] },
  { value: 'C', label: 'C', positions: ['C'] },
  { value: 'RG', label: 'RG', positions: ['RG'] },
  { value: 'RT', label: 'RT', positions: ['RT'] },
  { value: 'LEDG', label: 'LEDG', positions: ['LEDG'] },
  { value: 'REDG', label: 'REDG', positions: ['REDG'] },
  { value: 'DT', label: 'DT', positions: ['DT'] },
  { value: 'WILL', label: 'WILL', positions: ['WILL'] },
  { value: 'MIKE', label: 'MIKE', positions: ['MIKE'] },
  { value: 'SAM', label: 'SAM', positions: ['SAM'] },
  { value: 'CB', label: 'CB', positions: ['CB'] },
  { value: 'FS', label: 'FS', positions: ['FS'] },
  { value: 'SS', label: 'SS', positions: ['SS'] },
  { value: 'K', label: 'K', positions: ['K'] },
  { value: 'P', label: 'P', positions: ['P'] }
]

export default function Leaders() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  const [selectedCategory, setSelectedCategory] = useState('Offense')

  if (!currentDynasty) return null

  // Get all years in the dynasty
  const years = useMemo(() => {
    const startYear = currentDynasty.startYear || currentDynasty.currentYear
    const endYear = currentDynasty.currentYear
    const yrs = []
    for (let y = startYear; y <= endYear; y++) {
      yrs.push(y)
    }
    return yrs
  }, [currentDynasty.startYear, currentDynasty.currentYear])

  // Calculate pWAR for all years and aggregate by player
  const allPlayersWithPWAR = useMemo(() => {
    const playerMap = new Map() // pid -> { player data, yearPwars: { year: pwar }, totalPwar }

    years.forEach(year => {
      const yearPlayers = calculateSeasonPWAR(currentDynasty, year)
      yearPlayers.forEach(player => {
        const pid = player.pid
        if (!pid) return

        if (!playerMap.has(pid)) {
          playerMap.set(pid, {
            pid: player.pid,
            name: player.name,
            position: player.position,
            team: player.team || currentDynasty.teamName,
            yearPwars: {},
            years: [],
            totalPwar: 0,
            qualityGrade: 0,
            gradeCount: 0
          })
        }

        const existing = playerMap.get(pid)
        if (player.pwar !== 0 || player.qualified) {
          existing.yearPwars[year] = player.pwar
          if (!existing.years.includes(year)) {
            existing.years.push(year)
          }
          existing.totalPwar += player.pwar
          if (player.qualified) {
            existing.qualityGrade += player.qualityGrade
            existing.gradeCount++
          }
        }
      })
    })

    // Convert to array and calculate averages
    return Array.from(playerMap.values()).map(p => ({
      ...p,
      avgGrade: p.gradeCount > 0 ? p.qualityGrade / p.gradeCount : 60,
      yearsDisplay: p.years.length > 0 ?
        (p.years.length === 1 ? p.years[0].toString() : `${Math.min(...p.years)}-${Math.max(...p.years)}`)
        : ''
    }))
  }, [currentDynasty, years])

  // Filter by selected category
  const filteredPlayers = useMemo(() => {
    const category = CATEGORIES.find(c => c.value === selectedCategory)
    if (!category) return []

    return allPlayersWithPWAR
      .filter(p => category.positions.includes(p.position) && p.years.length > 0)
      .sort((a, b) => b.totalPwar - a.totalPwar)
  }, [allPlayersWithPWAR, selectedCategory])

  // Get team logo helper
  const getPlayerTeamLogo = (teamName) => {
    return getTeamLogo(teamName)
  }

  // pWAR color based on value
  const getPWARColor = (pwar) => {
    if (pwar >= 2) return '#22c55e' // green
    if (pwar >= 1) return '#84cc16' // lime
    if (pwar >= 0) return '#eab308' // yellow
    if (pwar >= -0.5) return '#f97316' // orange
    return '#ef4444' // red
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-lg shadow-lg p-4 sm:p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold" style={{ color: secondaryBgText }}>
            pWAR Leaderboard
          </h2>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 rounded-lg font-medium text-sm"
            style={{
              backgroundColor: teamColors.primary,
              color: primaryBgText,
              border: 'none'
            }}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Players Table */}
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12">
            <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
              No Players Found
            </h3>
            <p style={{ color: secondaryBgText, opacity: 0.8 }} className="max-w-md mx-auto text-sm">
              No players with pWAR data found for {selectedCategory}.
              Add player statistics to see pWAR rankings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `2px solid ${teamColors.primary}` }}>
                  <th className="text-left py-3 px-2 text-xs sm:text-sm font-bold" style={{ color: secondaryBgText }}>
                    Player
                  </th>
                  <th className="text-center py-3 px-2 text-xs sm:text-sm font-bold" style={{ color: secondaryBgText }}>
                    Position
                  </th>
                  <th className="text-left py-3 px-2 text-xs sm:text-sm font-bold" style={{ color: secondaryBgText }}>
                    School
                  </th>
                  <th className="text-center py-3 px-2 text-xs sm:text-sm font-bold" style={{ color: secondaryBgText }}>
                    Year(s)
                  </th>
                  <th className="text-center py-3 px-2 text-xs sm:text-sm font-bold" style={{ color: secondaryBgText }}>
                    pWAR
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player, idx) => {
                  const teamLogo = getPlayerTeamLogo(player.team)

                  return (
                    <tr
                      key={player.pid || idx}
                      style={{ borderBottom: `1px solid ${teamColors.primary}30` }}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold w-6 text-center"
                            style={{ color: secondaryBgText, opacity: 0.6 }}
                          >
                            {idx + 1}
                          </span>
                          <Link
                            to={`/dynasty/${id}/player/${player.pid}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: teamColors.primary }}
                          >
                            {player.name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                          style={{
                            backgroundColor: teamColors.primary,
                            color: primaryBgText
                          }}
                        >
                          {player.position}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {teamLogo && (
                            <img
                              src={teamLogo}
                              alt={player.team}
                              className="w-5 h-5 object-contain"
                            />
                          )}
                          <span className="text-xs sm:text-sm" style={{ color: secondaryBgText }}>
                            {player.team}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-xs sm:text-sm" style={{ color: secondaryBgText }}>
                        {player.yearsDisplay}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className="inline-block min-w-[3.5rem] text-center py-1 px-2 rounded text-sm font-black"
                          style={{
                            backgroundColor: getPWARColor(player.totalPwar),
                            color: '#fff'
                          }}
                        >
                          {player.totalPwar > 0 ? '+' : ''}{player.totalPwar.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
