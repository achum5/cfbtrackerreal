import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState } from '../../components/ui'
import { isPlayerOnRoster, getPlayerClassForYear } from '../../context/DynastyContext'
import { finePositionGroup } from '../../data/positionGroups'
import { getTargetStatus } from '../../utils/recruitingTargets'
import { scoutGrade, topScoutedAttrs } from '../../utils/scoutGrade'
import { ATTRIBUTE_ABBR } from '../../utils/recruitAttributes'

// Scout Board (the Targets tab): your tracked targets ranked by scout grade and
// weighed against roster needs. Each row surfaces the grade, the player's top
// scouted attributes (or recruit info when unscouted), whether they fill a need,
// and their commitment status.

const GRADUATING = new Set(['Sr', 'RS Sr', 'Senior'])
const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))
const ratingColor = (v) =>
  v >= 90 ? '#22c55e' : v >= 80 ? '#84cc16' : v >= 70 ? '#eab308' : v >= 60 ? '#f97316' : '#ef4444'

// returning next season → need level
const needLevel = (returning) =>
  returning <= 1 ? { key: 'high', label: 'Need', color: '#ef4444', rank: 2 }
  : returning === 2 ? { key: 'med', label: 'Thin', color: '#f59e0b', rank: 1 }
  : { key: 'ok', label: 'Set', color: '#22c55e', rank: 0 }

const statusMeta = (s) =>
  s === 'committed_us' ? { label: 'Committed', color: '#22c55e' }
  : s === 'committed_elsewhere' ? { label: 'Lost', color: 'var(--text-tertiary)' }
  : { label: 'Pursuing', color: '#3b82f6' }

function NeedChip({ g }) {
  const filled = g.need.rank === 2
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold"
      style={filled
        ? { backgroundColor: g.need.color, color: '#0a0a0a' }
        : { backgroundColor: 'var(--surface-2)', border: `1px solid ${g.need.color}55`, color: 'var(--text-primary)' }}
      title={`${g.group}: ${g.depth} on roster, ${g.graduating} graduating → ${g.returning} returning`}
    >
      <span>{g.group}</span>
      <span className="tabular-nums" style={{ opacity: filled ? 0.8 : 0.55 }}>{g.returning}</span>
      <span className="uppercase" style={{ color: filled ? '#0a0a0a' : g.need.color, opacity: filled ? 0.85 : 1, letterSpacing: '0.04em' }}>{g.need.label}</span>
    </span>
  )
}

function TargetRow({ r, rank, pathPrefix }) {
  const { p, score, tier } = r
  const lost = r.status === 'committed_elsewhere'
  const top = score != null ? topScoutedAttrs(p, 4) : []
  const st = statusMeta(r.status)

  const meta = []
  if (p.nationalRank) meta.push(`#${p.nationalRank} Nat`)
  if (p.positionRank) meta.push(`#${p.positionRank} ${p.position || 'Pos'}`)
  const htwt = [p.height, p.weight ? `${p.weight} lbs` : null].filter(Boolean).join(', ')
  if (htwt) meta.push(htwt)
  if (p.hometown) meta.push(`${p.hometown}${p.state ? `, ${p.state}` : ''}`)

  return (
    <Link
      to={`${pathPrefix}/player/${p.pid}`}
      className="flex items-stretch rounded-xl overflow-hidden transition-all duration-150 hover:brightness-110"
      style={{ backgroundColor: 'var(--surface-2)', opacity: lost ? 0.55 : 1, boxShadow: '0 1px 0 rgba(0,0,0,0.25)' }}
    >
      {/* tier accent rail */}
      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: tier ? tier.color : 'var(--surface-4)' }} />
      <div className="flex items-center gap-3 sm:gap-4 py-2.5 pl-3 pr-3 sm:pr-4 flex-1 min-w-0">
        <span className="w-5 text-right font-display font-black tabular-nums text-txt-tertiary text-[13px] flex-shrink-0">{rank}</span>

        {/* grade block */}
        <div className="flex flex-col items-center justify-center w-12 flex-shrink-0">
          <span className="font-display font-black tabular-nums leading-none" style={{ fontSize: '24px', color: tier ? tier.color : 'var(--text-tertiary)' }}>
            {score ?? '—'}
          </span>
          {tier
            ? <span className="text-[8px] font-bold uppercase tracking-wide mt-0.5" style={{ color: tier.color, opacity: 0.85 }}>{tier.label}</span>
            : <span className="text-[8px] font-bold uppercase tracking-wide mt-0.5 text-txt-tertiary">Unscouted</span>}
        </div>

        {/* identity + scouting info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-bold text-txt-primary truncate">{p.name}</span>
            {Number(p.stars) > 0 && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--accent-warning)' }}>{STAR(p.stars)}</span>}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-txt-tertiary truncate">
            {p.position || 'ATH'}{p.archetype ? ` · ${p.archetype}` : ''}
          </div>
          {top.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {top.map((a) => (
                <span key={a.name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums" style={{ backgroundColor: 'var(--surface-3)' }} title={a.name}>
                  <span className="text-txt-tertiary">{ATTRIBUTE_ABBR[a.name] || a.name}</span>
                  <span style={{ color: ratingColor(a.value) }}>{a.value}</span>
                </span>
              ))}
            </div>
          ) : meta.length > 0 ? (
            <div className="text-[10px] text-txt-tertiary truncate mt-1">{meta.join('  ·  ')}</div>
          ) : null}
        </div>

        {/* need + status */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {r.need && r.need.rank > 0 && !lost && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: r.need.color, border: `1px solid ${r.need.color}`, letterSpacing: '0.06em' }}>
              {r.need.label}
            </span>
          )}
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: st.color, letterSpacing: '0.04em' }}>{st.label}</span>
        </div>
      </div>
    </Link>
  )
}

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

  const ranked = useMemo(() => {
    const rows = []
    for (const p of dynasty?.players || []) {
      if (!p.isTarget || Number(p.targetYear) !== yearN) continue
      const { score, tier } = scoutGrade(p)
      const group = finePositionGroup(p.position)
      const need = group ? needsByGroup[group]?.need : null
      rows.push({ p, score, tier, group, need, status: getTargetStatus(p, userTid) })
    }
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

  // Needs first (Need → Thin → Set), then alphabetical.
  const needGroups = useMemo(
    () => Object.values(needsByGroup).sort((a, b) => b.need.rank - a.need.rank || a.group.localeCompare(b.group)),
    [needsByGroup],
  )
  const topNeeds = needGroups.filter((g) => g.need.rank > 0)

  if (ranked.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No Targets to Scout"
          message="Track prospects via the recruiting sheet (set their Commitment to “Uncommitted” and fill in attributes), and they'll be ranked here by grade against your roster needs."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Roster needs */}
      {needGroups.length > 0 && (
        <div>
          <div className="flex items-baseline gap-3 mb-2.5">
            <span className="font-display font-black uppercase text-txt-primary text-[13px]" style={{ letterSpacing: '1.5px' }}>Roster Needs</span>
            <span className="text-[11px] text-txt-tertiary">
              {topNeeds.length ? `${topNeeds.length} thin spot${topNeeds.length === 1 ? '' : 's'} · returning next season` : 'returning next season'}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--surface-4)' }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {needGroups.map((g) => <NeedChip key={g.group} g={g} />)}
          </div>
        </div>
      )}

      {/* Big board */}
      <div>
        <div className="flex items-baseline gap-3 mb-2.5">
          <span className="font-display font-black uppercase text-txt-primary text-[13px]" style={{ letterSpacing: '1.5px' }}>Big Board</span>
          <span className="text-[11px] tabular-nums text-txt-tertiary">{ranked.length} target{ranked.length === 1 ? '' : 's'}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--surface-4)' }} />
        </div>
        <div className="space-y-1.5">
          {ranked.map((r, i) => <TargetRow key={r.p.pid} r={r} rank={i + 1} pathPrefix={pathPrefix} />)}
        </div>
      </div>
    </div>
  )
}
