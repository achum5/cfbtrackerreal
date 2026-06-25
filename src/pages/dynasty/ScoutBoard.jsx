import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, EmptyState, Button } from '../../components/ui'
import { proxyImageUrl } from '../../utils/imageProxy'
import { getTargetStatus } from '../../utils/recruitingTargets'
import { getScoutScoresFor, headlinePercentile, ordinal } from '../../utils/scoutScore'
import ScoutScorePanel from '../../components/ScoutScorePanel'

// Scout Board (the Targets tab): tracked recruiting targets benchmarked by
// MaxPlaysCFB ScoutScore. Each row shows the recruit's ScoutScore overall
// percentile; the board ranks by it, and expanding a row reveals the full
// ScoutScore breakdown (overall + group + per-attribute percentiles).

const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))

const Chevron = ({ open }) => (
  <svg
    className="w-3.5 h-3.5 flex-shrink-0 transition-transform text-txt-tertiary"
    style={{ transform: open ? 'rotate(180deg)' : 'none' }}
    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

function pctColor(pct) {
  if (pct == null) return 'var(--text-muted)'
  if (pct >= 75) return 'var(--accent-success, #34d399)'
  if (pct >= 40) return 'var(--text-secondary)'
  return 'var(--accent-danger, #f87171)'
}

function Row({ r, rank, pathPrefix, scoutResult, scoring }) {
  const { p, status } = r
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const lost = status === 'committed_elsewhere'
  const committed = status === 'committed_us'

  // Sub-line: the recruit's national / position / state recruiting ranks.
  const ranks = []
  if (p.nationalRank) ranks.push({ v: p.nationalRank, l: 'Nat' })
  if (p.positionRank) ranks.push({ v: p.positionRank, l: p.position || 'Pos' })
  if (p.stateRank && p.state) ranks.push({ v: p.stateRank, l: p.state })

  const pct = scoutResult?.ok ? headlinePercentile(scoutResult.data) : null
  const badge = scoutResult ? (pct != null ? ordinal(pct) : '—') : (scoring ? '··' : '—')

  return (
    <div style={{ borderTop: rank > 1 ? '1px solid var(--surface-4)' : 'none', opacity: lost ? 0.55 : 1 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 sm:gap-3.5 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
      >
        <span className="w-5 text-right tabular-nums font-display flex-shrink-0 leading-none text-txt-tertiary" style={{ fontSize: '1rem', fontWeight: 700 }}>
          {rank}
        </span>

        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border" style={{ backgroundColor: 'var(--surface-3)', borderColor: 'var(--surface-4)' }}>
          {p.pictureUrl
            ? <img src={proxyImageUrl(p.pictureUrl, 200)} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px] font-black uppercase text-txt-secondary" style={{ letterSpacing: '0.04em' }}>{(p.position || 'ATH').slice(0, 3)}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); navigate(`${pathPrefix}/player/${p.pid}`) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigate(`${pathPrefix}/player/${p.pid}`) } }}
              className="text-[15px] font-bold text-txt-primary truncate hover:underline cursor-pointer"
            >
              {p.name}
            </span>
            {Number(p.stars) > 0 && <span className="text-[10px] flex-shrink-0 tracking-tight" style={{ color: 'var(--accent-warning)' }}>{STAR(p.stars)}</span>}
            {committed && <span className="text-[9px] font-bold uppercase text-txt-tertiary tracking-wide flex-shrink-0">· Committed</span>}
            {lost && <span className="text-[9px] font-bold uppercase text-txt-tertiary tracking-wide flex-shrink-0">· Lost</span>}
          </div>
          <div className="flex items-baseline gap-x-3 truncate mt-1 text-[11px]" style={{ letterSpacing: '0.3px' }}>
            <span className="uppercase text-txt-secondary font-semibold flex-shrink-0">{p.position || 'ATH'}</span>
            {p.archetype && <span className="uppercase text-txt-tertiary flex-shrink-0">{p.archetype}</span>}
            {ranks.length > 0 && (
              <span className="inline-flex items-baseline gap-x-2.5 tabular-nums min-w-0 truncate">
                {ranks.map((rk) => (
                  <span key={rk.l} className="inline-flex items-baseline gap-1">
                    <span className="font-bold text-txt-secondary">#{rk.v}</span>
                    <span className="text-txt-tertiary uppercase">{rk.l}</span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* ScoutScore overall percentile */}
        <div className="text-right flex-shrink-0 w-12">
          <div className="font-display leading-none tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: pctColor(pct) }} title="ScoutScore overall percentile">
            {badge}
          </div>
        </div>

        <Chevron open={open} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 sm:pl-[4.5rem] sm:pr-6">
          <ScoutScorePanel recruit={p} />
        </div>
      )}
    </div>
  )
}

export default function ScoutBoard({ dynasty, year, userTid, pathPrefix, onResolveTargets = null, resolveCount = 0 }) {
  const yearN = Number(year)
  const [sortBy, setSortBy] = useState('scoutscore')

  // The tracked targets for this recruiting year.
  const targets = useMemo(() => {
    const out = []
    for (const p of dynasty?.players || []) {
      if (!p.isTarget || Number(p.targetYear) !== yearN) continue
      out.push({ p, status: getTargetStatus(p, userTid) })
    }
    return out
  }, [dynasty?.players, yearN, userTid])

  // Benchmark every target through ScoutScore (cached, concurrency-capped).
  const [scores, setScores] = useState(() => new Map())
  const [scoring, setScoring] = useState(false)

  useEffect(() => {
    let alive = true
    if (targets.length === 0) { setScores(new Map()); return }
    setScoring(true)
    getScoutScoresFor(targets.map((t) => t.p)).then((map) => {
      if (!alive) return
      setScores(map)
      setScoring(false)
    })
    return () => { alive = false }
  }, [targets])

  // Rank by the chosen sort (committed-elsewhere always sink to the bottom).
  const ranked = useMemo(() => {
    const rows = [...targets]
    const pctOf = (pid) => {
      const res = scores.get(pid)
      return res?.ok ? headlinePercentile(res.data) : null
    }
    const natOf = (p) => {
      const n = Number(p.nationalRank)
      return Number.isFinite(n) && n > 0 ? n : Infinity
    }
    rows.sort((a, b) => {
      const aLost = a.status === 'committed_elsewhere' ? 1 : 0
      const bLost = b.status === 'committed_elsewhere' ? 1 : 0
      if (aLost !== bLost) return aLost - bLost
      if (sortBy === 'national') {
        const an = natOf(a.p)
        const bn = natOf(b.p)
        if (an !== bn) return an - bn
      }
      const av = pctOf(a.p.pid) ?? -1
      const bv = pctOf(b.p.pid) ?? -1
      if (bv !== av) return bv - av
      return (Number(b.p.stars) || 0) - (Number(a.p.stars) || 0)
    })
    return rows
  }, [targets, scores, sortBy])

  if (targets.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No Targets to Scout"
          message="Track prospects via the recruiting sheet (set their Commitment to “Uncommitted” and fill in attributes), and they'll be ranked here by ScoutScore."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <section className="media-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b" style={{ borderColor: 'var(--surface-4)' }}>
          <h3 className="font-display font-black uppercase leading-none text-txt-primary" style={{ fontSize: '15px', letterSpacing: '0.02em' }}>Big Board</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="flex items-center gap-1.5 text-[11px] text-txt-tertiary">
              <span className="uppercase tracking-wide hidden sm:inline">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                title="Sort targets"
                className="text-[11px] bg-surface-2 border border-surface-4 rounded-md px-2 py-1 text-txt-secondary hover:text-txt-primary focus:outline-none focus:border-surface-5"
              >
                <option value="scoutscore">ScoutScore</option>
                <option value="national">National Rank</option>
              </select>
            </label>
            {onResolveTargets && (
              <Button variant="secondary" size="sm" onClick={onResolveTargets}>New commits? ({resolveCount})</Button>
            )}
          </div>
        </div>
        <div>
          {ranked.map((r, i) => (
            <Row key={r.p.pid} r={r} rank={i + 1} pathPrefix={pathPrefix} scoutResult={scores.get(r.p.pid)} scoring={scoring} />
          ))}
        </div>
      </section>
    </div>
  )
}
