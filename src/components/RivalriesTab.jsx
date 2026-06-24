import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { usePathPrefix } from '../hooks/usePathPrefix'
import { getContrastTextColor } from '../utils/colorUtils'
import { getTeamLogoByTid } from '../data/teams'
import { getNameFromTid, getColorsFromTid } from '../data/teamRegistry'
import {
  computeRivalryScores,
  computeSeriesRecord,
  groupRivalryEvents,
  rivalryEventLabel,
  getStarTransfersTo,
} from '../utils/rivalryEngine'

// A game counts only once played — a scheduled/upcoming game sits at 0-0.
function isPlayedGame(g) {
  if (!g) return false
  if (g.team1Score == null || g.team2Score == null) return false
  return !!(g.isPlayed || Number(g.team1Score) > 0 || Number(g.team2Score) > 0)
}

// Every completed meeting between the two teams, newest first.
function getMatchups(dynasty, myTid, rivalTid) {
  const a = Number(myTid)
  const b = Number(rivalTid)
  return (dynasty.games || [])
    .filter(g => {
      if (!isPlayedGame(g)) return false
      const t1 = Number(g.team1Tid)
      const t2 = Number(g.team2Tid)
      return (t1 === a && t2 === b) || (t1 === b && t2 === a)
    })
    .sort((x, y) =>
      Number(y.year) - Number(x.year) ||
      (Number(y.week) || 0) - (Number(x.week) || 0)
    )
}

function gameRoundLabel(g) {
  if (g.isCFPChampionship) return 'CFP Championship'
  if (g.isCFPSemifinal) return g.bowlName || 'CFP Semifinal'
  if (g.isCFPQuarterfinal) return g.bowlName || 'CFP Quarterfinal'
  if (g.isCFPFirstRound) return 'CFP First Round'
  if (g.isConferenceChampionship) return `${g.conference || ''} Championship`.trim()
  if (g.bowlName) return g.bowlName
  return g.week != null ? `Week ${g.week}` : 'Regular Season'
}

export default function RivalriesTab({ dynasty, tid }) {
  const navigate = useNavigate()
  const pathPrefix = usePathPrefix()
  const myTid = Number(tid)
  const teams = dynasty.teams || {}
  const myName = getNameFromTid(teams, myTid) || 'Your team'
  const teamPageYear = dynasty.currentYear
  const [openTid, setOpenTid] = useState(null)

  // Rivalry score per opponent, plus the all-time series record.
  const scores = useMemo(() => computeRivalryScores(dynasty, myTid), [dynasty, myTid])

  const rows = useMemo(() => {
    return Object.entries(scores)
      .map(([rivalTid, s]) => {
        const t = Number(rivalTid)
        return {
          tid: t,
          points: s.points,
          events: s.events,
          record: computeSeriesRecord(dynasty, myTid, t),
          name: getNameFromTid(teams, t) || `Team ${t}`,
          logo: getTeamLogoByTid(t, teams),
          colors: getColorsFromTid(teams, t),
        }
      })
      .filter(r => r.points > 0)
      .sort((a, b) =>
        b.points - a.points ||
        b.record.gamesPlayed - a.record.gamesPlayed ||
        a.name.localeCompare(b.name)
      )
  }, [scores, dynasty, myTid, teams])

  if (rows.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-txt-secondary text-sm">
          No rivalries yet. Play games, share a state, swap transfers or coaches with
          another program, and they'll start climbing this list.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const isOpen = openTid === r.tid
          const txt = getContrastTextColor(r.colors.primary)
          return (
            <div key={r.tid} className="rounded-lg overflow-hidden border border-surface-4">
              {/* Row — tinted in the rival's team color */}
              <button
                onClick={() => setOpenTid(isOpen ? null : r.tid)}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left"
                style={{ backgroundColor: r.colors.primary, color: txt }}
              >
                <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-center" style={{ opacity: 0.7 }}>{i + 1}</span>
                <span className="inline-flex items-center justify-center rounded-full bg-white shrink-0 w-9 h-9">
                  {r.logo && <img src={r.logo} alt={r.name} className="w-7 h-7 object-contain" />}
                </span>
                <span className="flex-1 min-w-0 flex items-center">
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); navigate(`${pathPrefix}/team/${r.tid}/${teamPageYear}`) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigate(`${pathPrefix}/team/${r.tid}/${teamPageYear}`) } }}
                    className="text-sm font-semibold leading-none truncate max-w-full hover:underline cursor-pointer"
                  >
                    {r.name}
                  </span>
                </span>
                <span className="shrink-0 flex flex-col items-end leading-none">
                  <span className="text-lg font-extrabold tabular-nums">{r.points}</span>
                  <span className="text-[9px] uppercase tracking-wide" style={{ opacity: 0.7 }}>pts</span>
                </span>
                {/* Dropdown arrow */}
                <svg
                  viewBox="0 0 24 24" width="18" height="18" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Detail — animated expand via grid-rows 0fr → 1fr */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <RivalryDetail dynasty={dynasty} myTid={myTid} myName={myName} rival={r} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Expanded matchup detail: series summary, every meeting, and the score breakdown.
function RivalryDetail({ dynasty, myTid, rival }) {
  const navigate = useNavigate()
  const pathPrefix = usePathPrefix()
  const [showTransfers, setShowTransfers] = useState(false)
  const myName = getNameFromTid(dynasty.teams, myTid) || 'Your team'
  const transfers = useMemo(
    () => getStarTransfersTo(dynasty, myTid, rival.tid),
    [dynasty, myTid, rival.tid]
  )
  const matchups = useMemo(() => getMatchups(dynasty, myTid, rival.tid), [dynasty, myTid, rival.tid])
  const breakdown = useMemo(() => groupRivalryEvents(rival.events), [rival.events])

  // Point totals across the series, from our perspective.
  let myPts = 0, theirPts = 0
  const games = matchups.map(g => {
    const t1 = Number(g.team1Tid)
    const mine = t1 === myTid ? Number(g.team1Score) : Number(g.team2Score)
    const theirs = t1 === myTid ? Number(g.team2Score) : Number(g.team1Score)
    myPts += mine
    theirs != null && (theirPts += theirs)
    const result = mine > theirs ? 'W' : theirs > mine ? 'L' : 'T'
    return { g, mine, theirs, result }
  })
  const diff = myPts - theirPts
  const { wins, losses } = rival.record
  const tied = wins === losses
  const leaderName = wins > losses ? myName : rival.name
  const hi = Math.max(wins, losses)
  const lo = Math.min(wins, losses)

  return (
    <div className="px-3 sm:px-4 py-4 bg-surface-1/60 border-t border-surface-4">
      {/* Series summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
        <span className="text-sm font-semibold text-txt-primary">
          {tied ? `Series tied ${wins}-${losses}` : `${leaderName} leads ${hi}-${lo}`}
        </span>
      </div>

      {/* Matchup history */}
      {games.length > 0 ? (
        <div className="rounded-lg border border-surface-4 overflow-hidden mb-3">
          {games.map(({ g, mine, theirs, result }) => (
            <button
              key={g.id}
              onClick={() => navigate(`${pathPrefix}/game/${g.id}`)}
              className="w-full flex items-center gap-3 px-3 py-1.5 text-xs text-left border-b border-surface-4 last:border-b-0 hover:bg-surface-2/60 transition-colors"
            >
              <span className="w-10 shrink-0 font-semibold text-txt-secondary tabular-nums">{g.year}</span>
              <span className="w-28 shrink-0 text-txt-muted truncate">{gameRoundLabel(g)}</span>
              <span
                className={`shrink-0 w-4 font-bold ${result === 'W' ? 'text-emerald-400' : result === 'L' ? 'text-red-400' : 'text-txt-muted'}`}
              >
                {result}
              </span>
              <span className="tabular-nums text-txt-secondary">{mine}-{theirs}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-txt-muted mb-3">No games played yet.</p>
      )}

      {/* Score breakdown */}
      <div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {breakdown.map(b => {
            const clickable = b.type === 'transfer_star' && transfers.length > 0
            const label = (
              <>
                {rivalryEventLabel(b.type)}
                {b.count > 1 ? ` ×${b.count}` : ''}
                <span className="font-semibold text-txt-secondary tabular-nums"> +{b.points}</span>
              </>
            )
            return clickable ? (
              <button
                key={b.type}
                onClick={() => setShowTransfers(true)}
                className="text-xs text-txt-secondary underline decoration-dotted underline-offset-2 hover:text-txt-primary"
              >
                {label}
              </button>
            ) : (
              <span key={b.type} className="text-xs text-txt-tertiary">{label}</span>
            )
          })}
        </div>
      </div>

      {showTransfers && (
        <TransferModal
          rivalName={rival.name}
          transfers={transfers}
          onClose={() => setShowTransfers(false)}
        />
      )}
    </div>
  )
}

// Modal listing the star players who transferred to this rival.
function TransferModal({ rivalName, transfers, onClose }) {
  const navigate = useNavigate()
  const pathPrefix = usePathPrefix()
  const openPlayer = (pid) => {
    if (pid == null) return
    onClose()
    navigate(`${pathPrefix}/player/${pid}`)
  }
  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-1 border border-surface-4 rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="px-4 py-3 border-b border-surface-4 flex items-center justify-between gap-2">
          <h2 className="font-bold text-txt-primary m-0 text-sm">Transferred to {rivalName}</h2>
          <button onClick={onClose} className="text-txt-tertiary hover:text-txt-primary text-lg leading-none px-1">×</button>
        </div>
        <div className="overflow-y-auto divide-y divide-surface-4">
          {transfers.map((p, idx) => (
            <button
              key={`${p.pid ?? p.name}-${p.year}-${idx}`}
              onClick={() => openPlayer(p.pid)}
              disabled={p.pid == null}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors enabled:hover:bg-surface-2/60 disabled:cursor-default"
            >
              <span className="inline-flex items-center justify-center rounded-full bg-surface-3 overflow-hidden shrink-0 w-10 h-10">
                {p.pictureUrl
                  ? <img src={p.pictureUrl} alt={p.name} className="w-full h-full object-cover" />
                  : <span className="text-[10px] font-bold text-txt-muted">{p.position || '—'}</span>}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-txt-primary truncate">{p.name}</span>
                <span className="block text-[11px] text-txt-tertiary">
                  {p.position ? `${p.position} · ` : ''}{p.year}{p.ovr ? ` · ${p.ovr} OVR` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
