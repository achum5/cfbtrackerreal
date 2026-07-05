import { useEffect, useState, useMemo } from 'react'
import { getScoutScore, ordinal, defaultLensKey } from '../utils/scoutScore'
import { useDynasty } from '../context/DynastyContext'
import { getEditionKey } from '../editions'

// Percentile → accent color. A smooth red → amber → green ramp aligned to the
// tier thresholds below, so the ring, chips, and heat tiles all read one scale.
function pctColor(pct) {
  if (pct == null) return 'var(--text-muted)'
  if (pct >= 90) return '#34d399' // Elite
  if (pct >= 75) return '#86d472' // Excellent
  if (pct >= 60) return '#c3d24a' // Above average
  if (pct >= 40) return '#f2c14e' // Average
  if (pct >= 25) return '#ef9a5b' // Below average
  return '#ec6a6a'                 // Poor
}

// Same color at a given alpha, for glows and tints. Non-hex (the null/no-data
// case) fades to transparent so a missing value never paints a solid fill.
function withAlpha(color, a) {
  if (typeof color !== 'string' || !color.startsWith('#')) return 'transparent'
  const n = parseInt(color.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Qualitative tier for the headline percentile.
function tierLabel(pct) {
  if (pct == null) return '—'
  if (pct >= 90) return 'Elite'
  if (pct >= 75) return 'Excellent'
  if (pct >= 60) return 'Above average'
  if (pct >= 40) return 'Average'
  if (pct >= 25) return 'Below average'
  return 'Poor'
}

// Compact circular percentile gauge — crisp tier-colored arc over a track, the
// ordinal in the display face, a soft glow from a whole-SVG drop-shadow.
function Gauge({ pct }) {
  const r = 30, c = 40
  const circ = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct ?? 0))
  const dash = (p / 100) * circ
  const color = pctColor(pct)
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0" style={{ filter: `drop-shadow(0 0 4px ${withAlpha(color, 0.45)})` }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-4)" strokeWidth="6.5" />
      <circle
        cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="6.5" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      />
      <text x={c} y={c - 1} textAnchor="middle" style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, fill: 'var(--text-primary)' }}>
        {pct == null ? '—' : ordinal(pct)}
      </text>
      <text x={c} y={c + 12} textAnchor="middle" style={{ fontSize: '6.5px', letterSpacing: '1.5px', fill: 'var(--text-muted)' }}>
        PCTILE
      </text>
    </svg>
  )
}

// Inline ScoutScore result for a single recruit. Self-fetching (cached), so it
// renders the same whether on the Scout Board card or a player page.
export default function ScoutScorePanel({ recruit }) {
  const { currentDynasty } = useDynasty()
  const sourceGame = getEditionKey(currentDynasty)
  const [state, setState] = useState({ status: 'loading', data: null, reason: null })
  const [lens, setLens] = useState(null)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading', data: null, reason: null })
    setLens(null)
    getScoutScore(recruit, sourceGame).then((r) => {
      if (!alive) return
      if (!r.ok) { setState({ status: 'error', data: null, reason: r.reason }); return }
      setState({ status: 'done', data: r.data, reason: null })
      setLens(defaultLensKey(r.data))
    })
    return () => { alive = false }
  }, [recruit, sourceGame])

  const data = state.data
  const lenses = (data?.availableLenses || []).filter((l) => l.eligible)
  const activeLens = lens || lenses[0]?.key
  const lensMeta = lenses.find((l) => l.key === activeLens)
  const overall = data?.overallSummaries?.[activeLens]

  // Attributes grouped by category, each sorted by percentile descending. Group
  // order follows the order categories first appear in the stat list — this is
  // the canonical top-to-bottom order the summary cards mirror left-to-right.
  const groupedStats = useMemo(() => {
    const m = new Map()
    for (const s of data?.statResults || []) {
      const k = s.groupLabel || 'Other'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(s)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (b.lenses?.[activeLens]?.percentile ?? -1) - (a.lenses?.[activeLens]?.percentile ?? -1))
    }
    return [...m.entries()]
  }, [data, activeLens])

  // Summary cards ordered to match the per-attribute sections below.
  const groups = useMemo(() => {
    const available = (data?.groupSummaries?.[activeLens] || []).filter((g) => g.available)
    const order = groupedStats.map(([label]) => label)
    const idx = (label) => { const i = order.indexOf(label); return i < 0 ? 999 : i }
    return [...available].sort((a, b) => idx(a.label) - idx(b.label))
  }, [data, activeLens, groupedStats])

  const overallPct = overall?.percentile

  return (
    <div className="max-w-3xl mx-auto">
      {state.status === 'loading' && (
        <p className="text-sm text-txt-secondary py-6 text-center animate-pulse">Benchmarking against the ScoutScore database…</p>
      )}
      {state.status === 'error' && (
        <p className="text-sm text-txt-secondary py-4 text-center">{state.reason}</p>
      )}

      {state.status === 'done' && (<>
      {/* Lens selector — segmented pills */}
      {lenses.length > 1 && (
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl mb-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)' }}>
          {lenses.map((l) => (
            <button
              key={l.key}
              onClick={() => setLens(l.key)}
              title={l.scopeLabel}
              className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors ${
                l.key === activeLens ? 'bg-surface-4 text-txt-primary font-semibold' : 'text-txt-tertiary hover:text-txt-primary'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* Hero — ring + tier verdict on the left, per-group percentile chips
          filling the right so the row never reads empty. */}
      <div
        className="relative overflow-hidden rounded-xl border border-surface-4 px-4 py-3 mb-4"
        style={{ background: `radial-gradient(120% 140% at 12% -30%, ${withAlpha(pctColor(overallPct), 0.16)}, transparent 55%), linear-gradient(180deg, var(--surface-2), var(--surface-1))` }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Gauge pct={overallPct} />
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-txt-muted">Overall Percentile</div>
              <div className="font-display font-black leading-none mt-1" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 1.9rem)', color: pctColor(overallPct) }}>{tierLabel(overallPct)}</div>
              {lensMeta && (
                <div className="text-[10px] text-txt-tertiary mt-1.5 truncate">
                  vs {lensMeta.recruitCount?.toLocaleString()} {lensMeta.scopeLabel}
                </div>
              )}
            </div>
          </div>
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 flex-1 justify-end min-w-0">
              {groups.map((g) => {
                const gc = pctColor(g.percentile)
                return (
                  <div
                    key={g.groupKey}
                    className="rounded-lg px-2.5 py-1.5 flex items-center gap-2 min-w-[6.5rem]"
                    style={{ backgroundColor: withAlpha(gc, 0.1), border: `1px solid ${withAlpha(gc, 0.28)}` }}
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-txt-tertiary truncate">{g.label}</span>
                    <span className="font-display font-black tabular-nums leading-none ml-auto" style={{ fontSize: '0.95rem', color: gc }}>{ordinal(g.percentile)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Attributes — a dense heat grid per category. Each tile is tinted by its
          own percentile so strengths and weaknesses read at a glance, with the
          raw value and percentile stacked. No full-width bars. */}
      <div className="space-y-4">
        {groupedStats.map(([groupLabel, stats]) => (
          <div key={groupLabel}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-txt-muted">{groupLabel}</span>
              <span className="h-px flex-1" style={{ backgroundColor: 'var(--surface-4)' }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {stats.map((s) => {
                const p = s.lenses?.[activeLens]?.percentile
                const c = pctColor(p)
                return (
                  <div
                    key={s.statKey}
                    className="rounded-lg px-2.5 py-2"
                    style={{ backgroundColor: withAlpha(c, 0.09), border: `1px solid ${withAlpha(c, 0.22)}` }}
                  >
                    <div className="text-[10px] text-txt-secondary truncate" title={s.label}>{s.label}</div>
                    <div className="flex items-baseline justify-between gap-2 mt-1.5">
                      <span className="font-display font-black tabular-nums text-txt-primary leading-none" style={{ fontSize: '1.15rem' }}>{s.value}</span>
                      <span className="font-display font-bold tabular-nums leading-none" style={{ fontSize: '0.92rem', color: c }}>{ordinal(p) || '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      </>)}

      {/* Attribution */}
      <div className="mt-4 pt-3 border-t border-surface-4 text-[10px] text-txt-muted text-center">
        Benchmarks &amp; projections by{' '}
        <a href="https://maxplayscfb.com/tools/" target="_blank" rel="noopener noreferrer" className="text-txt-tertiary hover:text-txt-primary underline">
          MaxPlaysCFB
        </a>
      </div>
    </div>
  )
}
