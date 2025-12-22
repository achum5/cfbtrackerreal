import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'

// Position groups for filtering
const POSITION_GROUPS = {
  'All': [],
  'Offense': ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'],
  'Defense': ['LEDG', 'REDG', 'DT', 'SAM', 'MIKE', 'WILL', 'CB', 'FS', 'SS'],
  'Special Teams': ['K', 'P'],
  'QB': ['QB'],
  'RB': ['HB', 'FB'],
  'WR': ['WR'],
  'TE': ['TE'],
  'OL': ['LT', 'LG', 'C', 'RG', 'RT'],
  'DL': ['LEDG', 'REDG', 'DT'],
  'LB': ['SAM', 'MIKE', 'WILL'],
  'DB': ['CB', 'FS', 'SS'],
  'K/P': ['K', 'P']
}

// Dev trait badge colors
const DEV_TRAIT_COLORS = {
  'Elite': { bg: '#EAB308', text: '#000000' },
  'Star': { bg: '#8B5CF6', text: '#FFFFFF' },
  'Impact': { bg: '#3B82F6', text: '#FFFFFF' },
  'Normal': { bg: '#6B7280', text: '#FFFFFF' }
}

export default function Players() {
  const { id } = useParams()
  const { currentDynasty } = useDynasty()
  const teamColors = useTeamColors(currentDynasty?.teamName)
  const [searchQuery, setSearchQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState('All')
  const [sortBy, setSortBy] = useState('overall')
  const [sortOrder, setSortOrder] = useState('desc')

  if (!currentDynasty) return null

  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  // Get all players from dynasty
  const allPlayers = currentDynasty.players || []

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    let result = [...allPlayers]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(player => {
        const name = (player.name || '').toLowerCase()
        const position = (player.position || '').toLowerCase()
        const hometown = (player.hometown || '').toLowerCase()
        const state = (player.state || '').toLowerCase()
        const jerseyNumber = (player.jerseyNumber || '').toString()
        const archetype = (player.archetype || '').toLowerCase()

        return name.includes(query) ||
               position.includes(query) ||
               hometown.includes(query) ||
               state.includes(query) ||
               jerseyNumber === query ||
               archetype.includes(query)
      })
    }

    // Apply position filter
    if (positionFilter !== 'All') {
      const positions = POSITION_GROUPS[positionFilter] || []
      if (positions.length > 0) {
        result = result.filter(player => positions.includes(player.position))
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal

      switch (sortBy) {
        case 'name':
          aVal = (a.name || '').toLowerCase()
          bVal = (b.name || '').toLowerCase()
          break
        case 'position':
          aVal = a.position || ''
          bVal = b.position || ''
          break
        case 'year':
          const yearOrder = ['Fr', 'RS Fr', 'So', 'RS So', 'Jr', 'RS Jr', 'Sr', 'RS Sr']
          aVal = yearOrder.indexOf(a.year)
          bVal = yearOrder.indexOf(b.year)
          break
        case 'overall':
          aVal = a.overall || 0
          bVal = b.overall || 0
          break
        case 'devTrait':
          const devOrder = ['Elite', 'Star', 'Impact', 'Normal']
          aVal = devOrder.indexOf(a.devTrait)
          bVal = devOrder.indexOf(b.devTrait)
          break
        default:
          aVal = a.overall || 0
          bVal = b.overall || 0
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    return result
  }, [allPlayers, searchQuery, positionFilter, sortBy, sortOrder])

  // Toggle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder(column === 'name' ? 'asc' : 'desc')
    }
  }

  // Sort indicator
  const SortIndicator = ({ column }) => {
    if (sortBy !== column) return null
    return (
      <span className="ml-1">
        {sortOrder === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Filters */}
      <div
        className="rounded-lg shadow-lg p-4"
        style={{ backgroundColor: teamColors.secondary }}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
            All Players
            <span className="ml-2 text-sm font-normal" style={{ color: secondaryBgText, opacity: 0.7 }}>
              ({filteredPlayers.length} {filteredPlayers.length === 1 ? 'player' : 'players'})
            </span>
          </h1>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: `${secondaryBgText}10`,
                  color: secondaryBgText,
                  border: `2px solid ${teamColors.primary}40`
                }}
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                fill="none"
                stroke={secondaryBgText}
                style={{ opacity: 0.5 }}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-70"
                  style={{ color: secondaryBgText, opacity: 0.5 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Position Filter */}
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="px-4 py-2 rounded-lg font-semibold cursor-pointer focus:outline-none focus:ring-2"
              style={{
                backgroundColor: teamColors.primary,
                color: primaryBgText,
                border: `2px solid ${primaryBgText}40`
              }}
            >
              {Object.keys(POSITION_GROUPS).map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Players Table */}
      {filteredPlayers.length > 0 ? (
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{ backgroundColor: teamColors.secondary }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: teamColors.primary }}>
                  <th
                    className="px-4 py-3 text-left font-bold cursor-pointer hover:opacity-80"
                    style={{ color: primaryBgText }}
                    onClick={() => handleSort('name')}
                  >
                    Player <SortIndicator column="name" />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-bold cursor-pointer hover:opacity-80"
                    style={{ color: primaryBgText }}
                    onClick={() => handleSort('position')}
                  >
                    Pos <SortIndicator column="position" />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-bold cursor-pointer hover:opacity-80"
                    style={{ color: primaryBgText }}
                    onClick={() => handleSort('year')}
                  >
                    Year <SortIndicator column="year" />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-bold cursor-pointer hover:opacity-80"
                    style={{ color: primaryBgText }}
                    onClick={() => handleSort('overall')}
                  >
                    OVR <SortIndicator column="overall" />
                  </th>
                  <th
                    className="px-4 py-3 text-center font-bold cursor-pointer hover:opacity-80"
                    style={{ color: primaryBgText }}
                    onClick={() => handleSort('devTrait')}
                  >
                    Dev <SortIndicator column="devTrait" />
                  </th>
                  <th
                    className="px-4 py-3 text-left font-bold hidden md:table-cell"
                    style={{ color: primaryBgText }}
                  >
                    Archetype
                  </th>
                  <th
                    className="px-4 py-3 text-left font-bold hidden lg:table-cell"
                    style={{ color: primaryBgText }}
                  >
                    Hometown
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player, idx) => {
                  const devColors = DEV_TRAIT_COLORS[player.devTrait] || DEV_TRAIT_COLORS['Normal']
                  const isEven = idx % 2 === 0

                  return (
                    <tr
                      key={player.pid || player.id || idx}
                      className="border-b transition-colors hover:opacity-90"
                      style={{
                        borderColor: `${secondaryBgText}10`,
                        backgroundColor: isEven ? 'transparent' : `${secondaryBgText}05`
                      }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/dynasty/${id}/player/${player.pid}`}
                          className="font-semibold hover:underline flex items-center gap-2"
                          style={{ color: teamColors.primary }}
                        >
                          {player.jerseyNumber && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${teamColors.primary}20`, color: secondaryBgText }}
                            >
                              #{player.jerseyNumber}
                            </span>
                          )}
                          {player.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center font-medium" style={{ color: secondaryBgText }}>
                        {player.position}
                      </td>
                      <td className="px-4 py-3 text-center" style={{ color: secondaryBgText }}>
                        {player.year}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-block px-2 py-1 rounded font-bold text-sm"
                          style={{
                            backgroundColor: teamColors.primary,
                            color: primaryBgText
                          }}
                        >
                          {player.overall}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: devColors.bg,
                            color: devColors.text
                          }}
                        >
                          {player.devTrait}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm" style={{ color: secondaryBgText, opacity: 0.8 }}>
                        {player.archetype || '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm" style={{ color: secondaryBgText, opacity: 0.8 }}>
                        {player.hometown && player.state
                          ? `${player.hometown}, ${player.state}`
                          : player.hometown || player.state || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg shadow-lg p-8 text-center"
          style={{ backgroundColor: teamColors.secondary }}
        >
          {allPlayers.length === 0 ? (
            <>
              <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
                No Players Yet
              </h3>
              <p style={{ color: secondaryBgText, opacity: 0.8 }} className="max-w-md mx-auto">
                Complete your preseason setup and enter your roster to see players here.
              </p>
            </>
          ) : (
            <>
              <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
                No Players Found
              </h3>
              <p style={{ color: secondaryBgText, opacity: 0.8 }} className="max-w-md mx-auto">
                No players match your search criteria. Try adjusting your filters.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setPositionFilter('All'); }}
                className="mt-4 px-4 py-2 rounded-lg font-semibold transition-colors hover:opacity-80"
                style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
              >
                Clear Filters
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
