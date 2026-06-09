import { Link } from 'react-router-dom'
import { getContrastTextColor } from '../../utils/colorUtils'
import { getTeamLogoByTid } from '../../data/teams'

/**
 * GameResultRow — broadcast-style game row themed in the OPPONENT's team color.
 *
 * Replaces the old flat green/red win-loss rows with the CFB-27 aesthetic:
 * the team color washes the row (with the shared highlight/vignette gradient +
 * grain), the W/L sits in a compact neutral chip (green/red letter, not a whole
 * red/green row), and text is contrast-aware. Shared across every game-list
 * modal so they read identically.
 *
 * Props:
 *   color   — opponent primary color (hex). Falls back to a neutral slate.
 *   logo    — opponent logo url (rendered in a white circle)
 *   name    — opponent label, e.g. "vs Georgia Bulldogs" / "@ LSU Tigers"
 *   rank    — optional numeric rank, prepended as "#7 "
 *   result  — 'W' | 'L' | 'T' | null
 *   score   — string, e.g. "38-14"
 *   meta    — small sub-line, e.g. "Week 6 · Away"
 *   to      — optional link target; onClick — optional handler
 */
const RESULT_FG = { W: '#4ade80', L: '#f87171', T: '#fbbf24' }

export default function GameResultRow({
  color = '#3a3d47',
  logo,
  tid,
  teams,
  name,
  rank,
  result,
  score,
  meta,
  to,
  onClick,
  className = '',
}) {
  const txt = getContrastTextColor(color)
  // Accept an explicit logo URL, or resolve one from tid+teams (with the same
  // registry fallbacks the old ScoreRow used) when the caller only has a tid.
  const logoUrl = logo || (tid != null ? getTeamLogoByTid(tid, teams) : null)
  const Container = to ? Link : onClick ? 'button' : 'div'
  const props = to ? { to } : onClick ? { onClick, type: 'button' } : {}

  return (
    <Container
      {...props}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg overflow-hidden cfb-texture w-full text-left transition-all duration-150 ${to || onClick ? 'cursor-pointer hover:brightness-110' : ''} ${className}`.trim()}
      style={{
        backgroundColor: color,
        backgroundImage:
          'linear-gradient(120deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.42) 100%)',
      }}
    >
      {result && (
        <span
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: RESULT_FG[result] || txt }}
        >
          {result}
        </span>
      )}
      {logoUrl && (
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 flex-shrink-0 shadow-sm">
          <img src={logoUrl} alt="" className="w-full h-full object-contain" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: txt }}>
          {rank != null && <span style={{ opacity: 0.7 }}>#{rank} </span>}
          {name}
        </div>
        {meta && (
          <div className="text-[11px] truncate" style={{ color: txt, opacity: 0.72 }}>
            {meta}
          </div>
        )}
      </div>
      {score && (
        <div className="tabular-nums font-bold text-sm flex-shrink-0" style={{ color: txt }}>
          {score}
        </div>
      )}
    </Container>
  )
}
