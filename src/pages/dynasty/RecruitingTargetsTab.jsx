import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState } from '../../components/ui'
import { getTargetStatus } from '../../utils/recruitingTargets'
import { getColorsFromTid } from '../../data/teamRegistry'
import { getContrastTextColor } from '../../utils/colorUtils'
import RecruitCard from '../../components/RecruitCard'

// The "Targets" tab on the Recruiting page: the tracked recruiting board (real
// player records with isTarget) for a class year, grouped by funnel status. Uses
// the SAME RecruitCard as the Commitments tab — identical visuals; the only
// difference is the color: committed records use the (committed) team's colors,
// open targets use a neutral slate. Status is conveyed by the group headers.

// Neutral slate for open targets — no team, so no team color.
const NEUTRAL_BG = '#3a3d47'

function TargetCard({ player, userTid, dynastyTeams, pathPrefix }) {
  const status = getTargetStatus(player, userTid) // 'open' | 'committed_us' | 'committed_elsewhere'
  const tid = status === 'committed_us' ? Number(userTid)
    : status === 'committed_elsewhere' ? Number(player.commitmentTid)
    : null
  const primary = tid != null ? getColorsFromTid(dynastyTeams, tid)?.primary : null
  const bg = primary || NEUTRAL_BG
  const text = getContrastTextColor(bg)

  return (
    <Link to={`${pathPrefix}/player/${player.pid}`} className="block h-full">
      <RecruitCard recruit={player} player={player} bg={bg} text={text} teamsData={dynastyTeams} interactive />
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
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
