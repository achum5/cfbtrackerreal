import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState } from '../../components/ui'
import { isPlayerOnRoster, getPlayerClassForYear } from '../../context/DynastyContext'
import { finePositionGroup } from '../../data/positionGroups'
import { getTargetStatus } from '../../utils/recruitingTargets'
import { scoutGrade } from '../../utils/scoutGrade'

// Scout Board — your tracked targets ranked by scout grade and weighed against
// your roster's needs. The need per position group is driven by how many players
// you'll have RETURNING there next season (current depth minus graduating
// seniors): thin groups are flagged so the highest-grade targets that ALSO fill
// a need rise to the top of your attention.

const GRADUATING = new Set(['Sr', 'RS Sr', 'Senior'])

const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))

// returning → need level.
const needLevel = (returning) =>
  returning <= 1 ? { key: 'high', label: 'Need', color: '#ef4444', rank: 2 }
  : returning === 2 ? { key: 'med', label: 'Thin', color: '#f59e0b', rank: 1 }
  : { key: 'ok', label: 'Set', color: '#22c55e', rank: 0 }

const statusLabel = (s) =>
  s === 'committed_us' ? 'Committed' : s === 'committed_elsewhere' ? 'Elsewhere' : 'Pursuing'

export default function ScoutBoard({ dynasty, year, userTid, pathPrefix }) {
  const yearN = Number(year)
  const currentYear = Number(dynasty?.currentYear)

  // Roster depth + graduations by fine position group (current roster).
  const needsByGroup = useMemo(() => {
    const out = {}
    for (const p of dynasty?.players || []) {
      if (!isPlayerOnRoster(p, userTid, currentYear, dynasty)) continue
      const g = finePositionGroup(p.position)
      if (!g) continue
      const cls = getPlayerClassForYear(p, currentYear)
      const rec = out[g] || (out[g] = { group: g, depth: 0, graduating: 0 })
      rec.depth += 1
      if (GRADUATING.has(cls)) rec.graduating += 1
    }
    for (const g of Object.values(out)) {
      g.returning = g.depth - g.graduating
      g.need = needLevel(g.returning)
    }
    return out
  }, [dynasty?.players, userTid, currentYear, dynasty])

  // Tracked targets for the class, graded + need-flagged, ranked by grade.
  const ranked = useMemo(() => {
    const rows = []
    for (const p of dynasty?.players || []) {
      if (!p.isTarget || Number(p.targetYear) !== yearN) continue
      const { score, tier } = scoutGrade(p)
      const group = finePositionGroup(p.position)
      const need = group ? needsByGroup[group]?.need : null
      rows.push({ p, score, tier, group, need, status: getTargetStatus(p, userTid) })
    }
    // Graded first (desc), ungraded after (by stars); committed-elsewhere sinks.
    rows.sort((a, b) => {
      const aLost = a.status === 'committed_elsewhere' ? 1 : 0
      const bLost = b.status === 'committed_elsewhere' ? 1 : 0
      if (aLost !== bLost) return aLost - bLost
      const as = a.score == null ? -1 : a.score
      const bs = b.score == null ? -1 : b.score
      if (bs !== as) return bs - as
      return (Number(b.p.stars) || 0) - (Number(a.p.stars) || 0)
    })
    return rows
  }, [dynasty?.players, yearN, userTid, needsByGroup])

  const needGroups = useMemo(
    () => Object.values(needsByGroup).sort((a, b) => b.need.rank - a.need.rank || a.group.localeCompare(b.group)),
    [needsByGroup],
  )

  if (ranked.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No Targets to Scout"
          message="Track prospects on the Targets tab (with scouted attributes) and they'll be ranked here by grade against your roster needs."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Roster needs strip */}
      {needGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-display font-bold uppercase text-txt-secondary text-[12px]" style={{ letterSpacing: '1.5px' }}>Roster Needs</span>
            <span className="text-[11px] text-txt-tertiary">returning next season</span>
            <div className="flex-1 h-px" style={{ background: 'var(--surface-4)' }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {needGroups.map((g) => (
              <span
                key={g.group}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold"
                style={{ backgroundColor: 'var(--surface-2)', border: `1px solid ${g.need.color}55` }}
                title={`${g.group}: ${g.depth} on roster, ${g.graduating} graduating → ${g.returning} returning`}
              >
                <span className="text-txt-primary">{g.group}</span>
                <span className="tabular-nums text-txt-tertiary">{g.returning}</span>
                <span className="uppercase" style={{ color: g.need.color, letterSpacing: '0.04em' }}>{g.need.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ranked targets */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="font-display font-bold uppercase text-txt-secondary text-[12px]" style={{ letterSpacing: '1.5px' }}>Big Board</span>
          <span className="text-[11px] tabular-nums text-txt-tertiary">{ranked.length}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--surface-4)' }} />
        </div>
        <div className="space-y-1">
          {ranked.map((r, i) => {
            const fillsNeed = r.need && r.need.rank > 0 && r.status !== 'committed_elsewhere'
            return (
              <Link
                key={r.p.pid}
                to={`${pathPrefix}/player/${r.p.pid}`}
                className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover:brightness-110"
                style={{ backgroundColor: 'var(--surface-2)', opacity: r.status === 'committed_elsewhere' ? 0.5 : 1 }}
              >
                <span className="w-6 text-right font-display font-black tabular-nums text-txt-tertiary text-[13px] flex-shrink-0">{i + 1}</span>
                {/* Grade */}
                <span
                  className="w-11 text-center font-display font-black tabular-nums text-[16px] flex-shrink-0"
                  style={{ color: r.tier ? r.tier.color : 'var(--text-tertiary)' }}
                  title={r.tier ? r.tier.label : 'Unscouted'}
                >
                  {r.score ?? '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-txt-primary truncate">{r.p.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-txt-tertiary truncate">
                    {r.p.position || 'ATH'}{r.p.archetype ? ` · ${r.p.archetype}` : ''}{Number(r.p.stars) ? ` · ${STAR(r.p.stars)}` : ''}
                  </div>
                </div>
                {fillsNeed && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: r.need.color, border: `1px solid ${r.need.color}`, letterSpacing: '0.06em' }}>
                    {r.need.label}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wide text-txt-tertiary flex-shrink-0 hidden sm:block w-20 text-right">
                  {statusLabel(r.status)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
