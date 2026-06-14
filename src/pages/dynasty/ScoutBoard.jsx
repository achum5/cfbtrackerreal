import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, Button } from '../../components/ui'
import { proxyImageUrl } from '../../utils/imageProxy'
import { isPlayerOnRoster, getPlayerClassForYear } from '../../context/DynastyContext'
import { finePositionGroup } from '../../data/positionGroups'
import { getTargetStatus } from '../../utils/recruitingTargets'
import { scoutGrade, topScoutedAttrs } from '../../utils/scoutGrade'
import { ATTRIBUTE_ABBR } from '../../utils/recruitAttributes'

// Scout Board (the Targets tab): tracked targets ranked by scout grade against
// roster needs — styled to the app's records-leaderboard pattern (one media-card,
// hairline-divided rows, restrained color).

const GRADUATING = new Set(['Sr', 'RS Sr', 'Senior'])
const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))

const needLevel = (returning) =>
  returning <= 1 ? { label: 'Need', color: 'var(--accent-error)', rank: 2 }
  : returning === 2 ? { label: 'Thin', color: 'var(--accent-warning)', rank: 1 }
  : { label: null, color: 'var(--text-tertiary)', rank: 0 }

const statusLabel = (s) => (s === 'committed_us' ? 'Committed' : s === 'committed_elsewhere' ? 'Lost' : 'Pursuing')

// Gold / silver / bronze for the podium, plain text otherwise — the app's
// leaderboard rank convention.
const rankColor = (n) =>
  n === 1 ? 'var(--accent-warning)'
  : n === 2 ? 'rgba(192, 192, 192, 0.95)'
  : n === 3 ? 'rgba(205, 127, 50, 0.95)'
  : 'var(--text-tertiary)'

function Row({ r, rank, pathPrefix }) {
  const { p, score, tier } = r
  const lost = r.status === 'committed_elsewhere'
  const top = score != null ? topScoutedAttrs(p, 4) : []
  const isFirst = rank === 1

  // Sub-line: top scouted attributes if graded, else recruit info.
  let subline = ''
  if (top.length) {
    subline = top.map((a) => `${ATTRIBUTE_ABBR[a.name] || a.name} ${a.value}`).join('   ')
  } else {
    const m = []
    if (p.nationalRank) m.push(`#${p.nationalRank} Nat`)
    const htwt = [p.height, p.weight ? `${p.weight} lbs` : null].filter(Boolean).join(', ')
    if (htwt) m.push(htwt)
    if (p.hometown) m.push(`${p.hometown}${p.state ? `, ${p.state}` : ''}`)
    subline = m.join('   ')
  }

  return (
    <Link
      to={`${pathPrefix}/player/${p.pid}`}
      className="flex items-center gap-3 sm:gap-3.5 hover:bg-surface-2 transition-colors"
      style={{ padding: isFirst ? '14px 16px' : '11px 16px', borderTop: rank > 1 ? '1px solid var(--surface-4)' : 'none', opacity: lost ? 0.5 : 1 }}
    >
      <span
        className="w-6 text-right tabular-nums font-display flex-shrink-0 leading-none"
        style={{ fontSize: isFirst ? '1.45rem' : '1.05rem', fontWeight: isFirst ? 900 : 700, color: rankColor(rank) }}
      >
        {rank}
      </span>

      <div className={`flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden ${isFirst ? 'w-11 h-11' : 'w-9 h-9'}`} style={{ backgroundColor: 'var(--surface-3)' }}>
        {p.pictureUrl
          ? <img src={proxyImageUrl(p.pictureUrl, 200)} alt="" className="w-full h-full object-cover" />
          : <span className="text-[10px] font-black uppercase text-txt-secondary" style={{ letterSpacing: '0.04em' }}>{(p.position || 'ATH').slice(0, 3)}</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-txt-primary truncate">{p.name}</span>
          {Number(p.stars) > 0 && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--accent-warning)' }}>{STAR(p.stars)}</span>}
        </div>
        <div className="text-[11px] text-txt-tertiary truncate mt-0.5" style={{ letterSpacing: '0.3px' }}>
          <span className="uppercase">{p.position || 'ATH'}{p.archetype ? ` · ${p.archetype}` : ''}</span>
          {subline && <span className="text-txt-secondary tabular-nums">{'   '}{subline}</span>}
        </div>
      </div>

      <div className="text-right flex-shrink-0 hidden sm:block w-20">
        {r.need && r.need.rank > 0 && !lost && (
          <div className="text-[10px] font-bold uppercase leading-none" style={{ color: r.need.color, letterSpacing: '0.5px' }}>{r.need.label}</div>
        )}
        <div className="text-[10px] uppercase text-txt-tertiary leading-none mt-1" style={{ letterSpacing: '0.5px' }}>{statusLabel(r.status)}</div>
      </div>

      <div className="text-right flex-shrink-0 w-12">
        <div
          className="tabular-nums font-display leading-none"
          style={{ fontSize: isFirst ? '1.85rem' : '1.4rem', fontWeight: isFirst ? 900 : 800, color: tier ? tier.color : 'var(--text-tertiary)' }}
          title={tier ? `${score} — ${tier.label}` : 'Unscouted'}
        >
          {score ?? '—'}
        </div>
        {tier && <div className="text-[8px] font-bold uppercase tracking-wide mt-0.5" style={{ color: tier.color, opacity: 0.85 }}>{tier.label}</div>}
      </div>
    </Link>
  )
}

export default function ScoutBoard({ dynasty, year, userTid, pathPrefix, onResolveTargets = null, resolveCount = 0 }) {
  const yearN = Number(year)
  const currentYear = Number(dynasty?.currentYear)

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

  const needGroups = useMemo(
    () => Object.values(needsByGroup).sort((a, b) => b.need.rank - a.need.rank || a.group.localeCompare(b.group)),
    [needsByGroup],
  )
  const thinCount = needGroups.filter((g) => g.need.rank > 0).length

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
    <div className="space-y-5">
      {/* Roster needs */}
      {needGroups.length > 0 && (
        <section className="media-card overflow-hidden">
          <div className="px-4 sm:px-5 py-3 flex items-end justify-between gap-3 border-b" style={{ borderColor: 'var(--surface-4)' }}>
            <div>
              <div className="label-xs text-txt-tertiary mb-0.5" style={{ letterSpacing: '1px' }}>Returning next season</div>
              <h3 className="font-display font-black uppercase leading-none text-txt-primary" style={{ fontSize: '15px', letterSpacing: '0.02em' }}>Roster Needs</h3>
            </div>
            {thinCount > 0 && (
              <span className="text-[11px] font-bold uppercase tabular-nums" style={{ color: 'var(--accent-error)', letterSpacing: '0.5px' }}>{thinCount} thin</span>
            )}
          </div>
          <div className="px-4 sm:px-5 py-3 flex flex-wrap gap-x-4 gap-y-2">
            {needGroups.map((g) => (
              <span key={g.group} className="inline-flex items-baseline gap-1.5 text-[12px]" title={`${g.depth} on roster, ${g.graduating} graduating`}>
                <span className="font-bold uppercase text-txt-secondary" style={{ letterSpacing: '0.4px' }}>{g.group}</span>
                <span className="tabular-nums font-display font-black text-txt-primary">{g.returning}</span>
                {g.need.label && (
                  <span className="text-[10px] font-bold uppercase" style={{ color: g.need.color, letterSpacing: '0.5px' }}>{g.need.label}</span>
                )}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Big board */}
      <section className="media-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b" style={{ borderColor: 'var(--surface-4)' }}>
          <div>
            <div className="label-xs text-txt-tertiary mb-0.5" style={{ letterSpacing: '1px' }}>Ranked by scout grade · {ranked.length} target{ranked.length === 1 ? '' : 's'}</div>
            <h3 className="font-display font-black uppercase leading-none text-txt-primary" style={{ fontSize: '15px', letterSpacing: '0.02em' }}>Big Board</h3>
          </div>
          {onResolveTargets && (
            <Button variant="secondary" size="sm" onClick={onResolveTargets}>Resolve ({resolveCount})</Button>
          )}
        </div>
        <div>
          {ranked.map((r, i) => <Row key={r.p.pid} r={r} rank={i + 1} pathPrefix={pathPrefix} />)}
        </div>
      </section>
    </div>
  )
}
