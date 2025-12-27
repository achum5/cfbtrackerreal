import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getContrastTextColor } from '../utils/colorUtils'
import { useDynasty } from '../context/DynastyContext'
import { getAbbreviationFromDisplayName } from '../data/teamAbbreviations'
import { getTeamConference } from '../data/conferenceTeams'
import ShareDynastyModal from './ShareDynastyModal'

export default function Sidebar({ isOpen, onClose, dynastyId, teamColors, currentYear }) {
  const location = useLocation()
  const { currentDynasty, exportDynasty } = useDynasty()
  const [showShareModal, setShowShareModal] = useState(false)
  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  // Get current team abbreviation for recruiting link
  const teamAbbr = getAbbreviationFromDisplayName(currentDynasty?.teamName) || currentDynasty?.teamName || ''

  // Get user's conference for all-conference link
  const userConference = getTeamConference(teamAbbr) || 'SEC'
  const conferenceUrlParam = encodeURIComponent(userConference.replace(/\s+/g, '-'))

  const handleExport = () => {
    try {
      exportDynasty(dynastyId)
    } catch (error) {
      console.error('Error exporting dynasty:', error)
      alert('Failed to export dynasty. Please try again.')
    }
  }

  const navItems = [
    { name: 'Dashboard', path: `/dynasty/${dynastyId}` },
    { name: 'Coach Career', path: `/dynasty/${dynastyId}/coach-career` },
    { name: 'Leaderboard', path: `/dynasty/${dynastyId}/dynasty-records` },
    { name: 'Recruiting', path: `/dynasty/${dynastyId}/recruiting/${teamAbbr}/${currentYear}` },
    { name: 'Awards', path: `/dynasty/${dynastyId}/awards` },
    { name: 'All-Americans', path: `/dynasty/${dynastyId}/all-americans` },
    { name: 'All-Conference', path: `/dynasty/${dynastyId}/all-conference/${currentYear}/${conferenceUrlParam}` },
    { name: 'CFP Bracket', path: `/dynasty/${dynastyId}/cfp-bracket` },
    { name: 'Bowl History', path: `/dynasty/${dynastyId}/bowl-history` },
    { name: 'CC History', path: `/dynasty/${dynastyId}/conference-championship-history` },
    { name: 'Conf. Standings', path: `/dynasty/${dynastyId}/conference-standings` },
    { name: 'Top 25', path: `/dynasty/${dynastyId}/rankings` },
    { name: 'All Teams', path: `/dynasty/${dynastyId}/teams` },
    { name: 'All Players', path: `/dynasty/${dynastyId}/players` }
  ]

  const isActive = (path) => {
    if (path === `/dynasty/${dynastyId}`) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onMouseDown={onClose}
        />
      )}

      {/* Sidebar - Fixed on left edge, full height on mobile, below header on desktop */}
      <aside
        className={`fixed left-0 z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 w-56 shadow-lg overflow-y-auto top-0 h-full lg:top-[64px] lg:h-[calc(100vh-64px)]`}
        style={{ backgroundColor: teamColors.secondary }}
      >
        {/* Close button - mobile only */}
        <div className="lg:hidden flex items-center p-4 border-b" style={{ borderColor: `${secondaryBgText}20` }}>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:opacity-70"
            style={{ color: secondaryBgText }}
            aria-label="Close sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-4 pt-4 pb-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={onClose}
                  className={`block px-4 py-2.5 rounded-lg font-medium transition-all ${
                    active ? 'shadow-md' : 'hover:opacity-70'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: teamColors.primary,
                          color: primaryBgText
                        }
                      : {
                          color: secondaryBgText,
                          opacity: 0.8
                        }
                  }
                >
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Download Backup Button */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: `${secondaryBgText}20` }}>
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all hover:opacity-70"
              style={{
                color: secondaryBgText,
                opacity: 0.8,
                backgroundColor: 'transparent',
                border: `2px solid ${teamColors.primary}`
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Backup</span>
            </button>

            {/* Share Dynasty Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all hover:opacity-70 mt-2"
              style={{
                color: secondaryBgText,
                opacity: 0.8,
                backgroundColor: 'transparent',
                border: `2px solid ${teamColors.primary}`
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share Dynasty</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Share Dynasty Modal */}
      <ShareDynastyModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        teamColors={teamColors}
      />
    </>
  )
}
