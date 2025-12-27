import { Link, useLocation, useParams } from 'react-router-dom'
import { getContrastTextColor } from '../utils/colorUtils'
import { getAbbreviationFromDisplayName } from '../data/teamAbbreviations'
import { getTeamConference } from '../data/conferenceTeams'
import { getMascotName, getTeamLogo } from '../data/teams'

export default function ViewSidebar({ isOpen, onClose, dynasty, teamColors }) {
  const location = useLocation()
  const { shareCode } = useParams()
  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  // Get current team abbreviation
  const teamAbbr = getAbbreviationFromDisplayName(dynasty?.teamName) || dynasty?.teamName || ''
  const currentYear = dynasty?.currentYear || new Date().getFullYear()

  // Get user's conference for all-conference link
  const userConference = getTeamConference(teamAbbr) || 'SEC'
  const conferenceUrlParam = encodeURIComponent(userConference.replace(/\s+/g, '-'))

  const navItems = [
    { name: 'Dashboard', path: `/view/${shareCode}` },
    { name: 'Coach Career', path: `/view/${shareCode}/coach-career` },
    { name: 'Leaderboard', path: `/view/${shareCode}/dynasty-records` },
    { name: 'Recruiting', path: `/view/${shareCode}/recruiting/${teamAbbr}/${currentYear}` },
    { name: 'Awards', path: `/view/${shareCode}/awards` },
    { name: 'All-Americans', path: `/view/${shareCode}/all-americans` },
    { name: 'All-Conference', path: `/view/${shareCode}/all-conference/${currentYear}/${conferenceUrlParam}` },
    { name: 'CFP Bracket', path: `/view/${shareCode}/cfp-bracket` },
    { name: 'Bowl History', path: `/view/${shareCode}/bowl-history` },
    { name: 'CC History', path: `/view/${shareCode}/conference-championship-history` },
    { name: 'Conf. Standings', path: `/view/${shareCode}/conference-standings` },
    { name: 'Top 25', path: `/view/${shareCode}/rankings` },
    { name: 'All Teams', path: `/view/${shareCode}/teams` },
    { name: 'All Players', path: `/view/${shareCode}/players` }
  ]

  const isActive = (path) => {
    if (path === `/view/${shareCode}`) {
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

      {/* Sidebar */}
      <aside
        className={`fixed left-0 z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 w-56 shadow-lg overflow-y-auto top-0 h-full`}
        style={{ backgroundColor: teamColors.secondary }}
      >
        {/* Header with team info */}
        <div
          className="p-4 border-b flex items-center gap-3"
          style={{ borderColor: `${secondaryBgText}20`, backgroundColor: teamColors.primary }}
        >
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:opacity-70"
            style={{ color: primaryBgText }}
            aria-label="Close sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={getTeamLogo(getMascotName(dynasty?.teamName) || dynasty?.teamName)}
            alt={dynasty?.teamName}
            className="w-10 h-10 object-contain hidden lg:block"
          />
          <div className="hidden lg:block">
            <div className="font-bold text-sm" style={{ color: primaryBgText }}>
              {getMascotName(dynasty?.teamName) || dynasty?.teamName}
            </div>
            <div className="text-xs opacity-80" style={{ color: primaryBgText }}>
              {dynasty?.currentYear} Season
            </div>
          </div>
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

          {/* Create Your Own Dynasty CTA */}
          <div className="mt-6 pt-4 border-t" style={{ borderColor: `${secondaryBgText}20` }}>
            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: teamColors.primary,
                color: primaryBgText
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Your Dynasty</span>
            </Link>
          </div>
        </nav>
      </aside>
    </>
  )
}
