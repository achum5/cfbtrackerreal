import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState } from '../../components/ui'
import { getTargetStatus } from '../../utils/recruitingTargets'
import { getColorsFromTid } from '../../data/teamRegistry'
import { getTeamLogoByTid, getMascotName } from '../../data/teams'
import { getContrastTextColor } from '../../utils/colorUtils'

// The "Targets" tab on the Recruiting page: the tracked recruiting board (real
// player records with isTarget) for a class year, grouped by funnel status. The
// commitment-tracking flow is unchanged and lives on the sibling "Commitments"
// tab; this view never touches it.

const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))

function TargetCard({ player, userTid, dynastyTeams, pathPrefix }) {
  const status = getTargetStatus(player, userTid) // 'open' | 'committed_us' | 'committed_elsewhere'
  const tid = player.commitmentTid != null ? Number(player.commitmentTid) : null
  const colors = tid != null ? getColorsFromTid(dynastyTeams, tid) : null
  const primary = colors?.primary || 'var(--surface-3)'
  const accent = status === 'open' ? 'var(--surface-4)' : primary
  const txt = tid != null ? getContrastTextColor(primary) : 'var(--text-primary)'
  const logo = tid != null ? getTeamLogoByTid(tid, dynastyTeams) : null
  const teamName = tid != null ? getMascotName(tid, dynastyTeams) : null
  const scouted = player.attributes && Object.keys(player.attributes).length > 0

  const statusLabel =
    status === 'committed_us' ? 'Committed' :
    status === 'committed_elsewhere' ? `→ ${teamName || 'Other'}` :
    'Pursuing'

  return (
    <Link
      to={`${pathPrefix}/player/${player.pid}`}
      className="media-card relative overflow-hidden block transition-transform hover:-translate-y-0.5"
    >
      {/* Status spine in the team / neutral color */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }} />
      <div className="pl-3 pr-2.5 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-display font-bold uppercase text-[10px] px-1.5 py-0.5 rounded text-txt-secondary" style={{ backgroundColor: 'var(--surface-3)', letterSpacing: '0.5px' }}>
            {player.position || '—'}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--accent-warning)' }}>{STAR(player.stars)}</span>
        </div>
        <div className="font-display font-bold leading-tight text-[13px] text-txt-primary truncate">{player.name}</div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10px] uppercase tracking-wide text-txt-tertiary truncate">
            {player.archetype || player.devTrait || ''}
          </span>
          {scouted && (
            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--accent-info)', border: '1px solid var(--accent-info)', letterSpacing: '0.4px' }}>
              Scouted
            </span>
          )}
        </div>
        {/* Status band */}
        <div
          className="mt-2 -mx-2.5 -mb-2.5 px-3 py-1 flex items-center gap-1.5"
          style={{ backgroundColor: status === 'open' ? 'var(--surface-2)' : primary }}
        >
          {logo && <img src={logo} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />}
          <span
            className="text-[10px] font-bold uppercase truncate"
            style={{ color: status === 'open' ? 'var(--text-tertiary)' : txt, letterSpacing: '0.5px' }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

const GROUPS = [
  { key: 'open', label: 'Pursuing' },
  { key: 'committed_us', label: 'Committed to You' },
  { key: 'committed_elsewhere', label: 'Committed Elsewhere' },
]

export default function RecruitingTargetsTab({ dynasty, year, userTid, pathPrefix }) {
  const dynastyTeams = dynasty?.teams || {}
  const yearN = Number(year)

  const grouped = useMemo(() => {
    const out = { open: [], committed_us: [], committed_elsewhere: [] }
    for (const p of dynasty?.players || []) {
      if (!p.isTarget || Number(p.targetYear) !== yearN) continue
      const s = getTargetStatus(p, userTid)
      if (out[s]) out[s].push(p)
    }
    // Sort each group by stars desc, then name
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0) || String(a.name).localeCompare(String(b.name)))
    }
    return out
  }, [dynasty?.players, yearN, userTid])

  const total = grouped.open.length + grouped.committed_us.length + grouped.committed_elsewhere.length

  if (total === 0) {
    return (
      <Card>
        <EmptyState
          title="No Targets Tracked Yet"
          message='Open the recruiting sheet (Edit) and use the "Targets + Attributes" prompt to track prospects you are recruiting — set their Commitment to "(Pursuing)" and they show up here.'
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {GROUPS.map(({ key, label }) => {
        const list = grouped[key]
        if (!list.length) return null
        return (
          <div key={key}>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-display font-bold uppercase text-txt-secondary text-[12px]" style={{ letterSpacing: '1.5px' }}>{label}</span>
              <span className="text-[11px] tabular-nums text-txt-tertiary">{list.length}</span>
              <div className="flex-1 h-px" style={{ background: 'var(--surface-4)' }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {list.map((p) => (
                <TargetCard key={p.pid} player={p} userTid={userTid} dynastyTeams={dynastyTeams} pathPrefix={pathPrefix} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
