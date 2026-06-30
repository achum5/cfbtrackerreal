/**
 * TeamSwitcher — fixed bottom-right floating select for users who
 * "control" multiple teams in the current dynasty (commish + co-
 * commishes who shepherd teams for users without premium).
 *
 * Picks from the user's `userTeams` array (sourced from
 * `dynasty.memberTeams[uid]`) and writes the choice via
 * `setActiveTeam`. The DynastyContext override layer re-stamps
 * `currentTid` for every consumer when this changes.
 *
 * Hidden when the user has 0 or 1 teams (nothing to switch).
 */

import { useDynasty } from '../context/DynastyContext'
import { getTeamLogoByTid } from '../data/teams'

export default function TeamSwitcher() {
  const { currentDynasty, userTeams, activeUserTid, setActiveTeam } = useDynasty()
  if (!currentDynasty || !userTeams || userTeams.length < 2) return null

  const teamsSource = currentDynasty.teams || {}
  const activeTeam = activeUserTid != null ? teamsSource[activeUserTid] : null
  const activeLogo = activeUserTid != null ? getTeamLogoByTid(activeUserTid, teamsSource) : null

  return (
    <div
      className="fixed z-40 select-none"
      style={{
        right: '1rem',
        // Sit above the news ticker (~48px tall + safe-area).
        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 0.5rem)',
      }}
    >
      <label className="relative flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg bg-surface-2 border border-surface-4 shadow-lg hover:bg-surface-3 transition-colors cursor-pointer">
        {activeLogo && (
          <img src={activeLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
        )}
        <span className="text-xs font-semibold text-txt-primary truncate max-w-[160px]">
          {activeTeam?.name || `Team ${activeUserTid}`}
        </span>
        <svg className="w-4 h-4 text-txt-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {/* The native select overlays the whole chip invisibly — it still
            opens the dropdown on tap, but doesn't render its selected
            option text, which was showing the team name a second time. */}
        <select
          value={activeUserTid ?? ''}
          onChange={e => {
            const tid = Number(e.target.value)
            if (Number.isFinite(tid)) setActiveTeam(tid)
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Switch active team"
        >
          {userTeams.map(tid => {
            const t = teamsSource[tid]
            return (
              <option key={tid} value={tid}>
                {t?.name || `Team ${tid}`}
              </option>
            )
          })}
        </select>
      </label>
    </div>
  )
}
