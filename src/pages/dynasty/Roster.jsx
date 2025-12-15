import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useTeamColors } from '../../hooks/useTeamColors'
import { getContrastTextColor } from '../../utils/colorUtils'
import RosterEntryModal from '../../components/RosterEntryModal'

export default function Roster() {
  const { currentDynasty, saveRoster } = useDynasty()
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState('All')

  if (!currentDynasty) return null

  const teamColors = useTeamColors(currentDynasty.teamName)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)
  const primaryBgText = getContrastTextColor(teamColors.primary)

  // Position groups for tabs
  const positionTabs = [
    'All',
    'QB',
    'HB',
    'FB',
    'WR',
    'TE',
    'LT',
    'LG',
    'C',
    'RG',
    'RT',
    'LEDG',
    'REDG',
    'DT',
    'SAM',
    'MIKE',
    'WILL',
    'CB',
    'FS',
    'SS',
    'K',
    'P'
  ]

  // Filter players by selected position
  const filteredPlayers = selectedPosition === 'All'
    ? currentDynasty.players || []
    : (currentDynasty.players || []).filter(player => player.position === selectedPosition)

  const handleRosterSave = async (players) => {
    await saveRoster(currentDynasty.id, players)
    setShowRosterModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: secondaryBgText }}>
            {currentDynasty.currentYear} Roster
          </h2>
          <button
            onClick={() => setShowRosterModal(true)}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: secondaryBgText }}
            title="Edit Roster"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Position Tabs */}
      <div
        className="rounded-lg shadow-lg p-4"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        <div className="flex flex-wrap gap-2">
          {positionTabs.map((position) => (
            <button
              key={position}
              onClick={() => setSelectedPosition(position)}
              className="px-4 py-2 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: selectedPosition === position ? teamColors.primary : 'transparent',
                color: selectedPosition === position ? primaryBgText : secondaryBgText,
                border: selectedPosition === position ? 'none' : `2px solid ${teamColors.primary}`,
                opacity: selectedPosition === position ? 1 : 0.7
              }}
            >
              {position}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div
        className="rounded-lg shadow-lg p-6"
        style={{
          backgroundColor: teamColors.secondary,
          border: `3px solid ${teamColors.primary}`
        }}
      >
        {filteredPlayers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2" style={{ borderColor: teamColors.primary }}>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Name</th>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Position</th>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Class</th>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Dev Trait</th>
                  <th className="text-left py-2 px-3" style={{ color: secondaryBgText }}>Overall</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="border-b border-gray-200 hover:bg-black hover:bg-opacity-5 transition-colors">
                    <td className="py-2 px-3 font-semibold" style={{ color: secondaryBgText }}>
                      <Link
                        to={`/dynasty/${currentDynasty.id}/player/${player.pid}`}
                        className="hover:underline"
                        style={{ color: teamColors.primary }}
                      >
                        {player.name}
                      </Link>
                    </td>
                    <td className="py-2 px-3" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      {player.position}
                    </td>
                    <td className="py-2 px-3" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      {player.year}
                    </td>
                    <td className="py-2 px-3" style={{ color: secondaryBgText, opacity: 0.8 }}>
                      {player.devTrait || 'Normal'}
                    </td>
                    <td className="py-2 px-3 font-bold" style={{ color: secondaryBgText }}>
                      {player.overall}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div style={{ color: secondaryBgText, opacity: 0.5 }} className="mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: secondaryBgText }}>
              {selectedPosition === 'All' ? 'No Players Yet' : `No ${selectedPosition} Players`}
            </h3>
            <p style={{ color: secondaryBgText, opacity: 0.8 }}>
              {selectedPosition === 'All'
                ? 'Add players to your roster to track them throughout the season.'
                : `No players at the ${selectedPosition} position.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Roster Entry Modal */}
      <RosterEntryModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        onSave={handleRosterSave}
        currentYear={currentDynasty.currentYear}
        teamColors={teamColors}
      />
    </div>
  )
}
