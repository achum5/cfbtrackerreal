import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, Button } from '../../components/ui'
import { proxyImageUrl } from '../../utils/imageProxy'
import { isPlayerOnRoster, getPlayerClassForYear } from '../../context/DynastyContext'
import { finePositionGroup } from '../../data/positionGroups'
import { getTargetStatus } from '../../utils/recruitingTargets'
import { scoutGrade, topScoutedAttrs, scoutLetter, scoutDossier, dossierParagraphs, gradeBreakdown, inferPlayStyle, schemeFits } from '../../utils/scoutGrade'
import { ATTRIBUTE_COLUMNS, ATTRIBUTE_ABBR } from '../../utils/recruitAttributes'

// Scout Board (the Targets tab): tracked targets ranked by scout grade against
// roster needs. Styled to match the rest of the app — list rows like the
// commitments view, restrained/neutral text, an expandable scouting drawer per
// player, and a roster-needs strip that tucks away behind the header.

const GRADUATING = new Set(['Sr', 'RS Sr', 'Senior'])
const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))

// Per-position depth targets (returning next season): below `start` you can't
// field your starters (Need); below `min` you're under ideal depth (Thin). Keyed
// to finePositionGroup names; unknown groups use DEFAULT_DEPTH.
const POS_DEPTH = {
  QB: { min: 2, start: 1 }, RB: { min: 4, start: 2 }, FB: { min: 1, start: 1 }, WR: { min: 6, start: 3 }, TE: { min: 3, start: 1 },
  OT: { min: 4, start: 2 }, OG: { min: 4, start: 2 }, C: { min: 2, start: 1 },
  EDGE: { min: 4, start: 2 }, DT: { min: 4, start: 2 },
  OLB: { min: 3, start: 2 }, MIKE: { min: 2, start: 1 }, ILB: { min: 2, start: 1 }, LB: { min: 3, start: 2 },
  CB: { min: 5, start: 3 }, SAFETY: { min: 4, start: 2 }, FS: { min: 2, start: 1 }, SS: { min: 2, start: 1 },
  K: { min: 1, start: 1 }, P: { min: 1, start: 1 }, LS: { min: 1, start: 1 }, ATH: { min: 0, start: 0 },
}
const DEFAULT_DEPTH = { min: 3, start: 2 }
const needLevel = (returning, group) => {
  const d = POS_DEPTH[group] || DEFAULT_DEPTH
  if (returning < d.start) return { label: 'Need', rank: 2 }
  if (returning < d.min) return { label: 'Thin', rank: 1 }
  return { label: null, rank: 0 }
}

const Chevron = ({ open }) => (
  <svg
    className="w-3.5 h-3.5 flex-shrink-0 transition-transform text-txt-tertiary"
    style={{ transform: open ? 'rotate(180deg)' : 'none' }}
    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

function Row({ r, rank, pathPrefix, playStyle }) {
  const { p, score, tier, need, status } = r
  const [open, setOpen] = useState(false)
  const lost = status === 'committed_elsewhere'
  const committed = status === 'committed_us'
  const top = score != null ? topScoutedAttrs(p, 3) : []
  const depth = Number.isFinite(r.returning) ? { group: r.group || p.position, returning: r.returning, rank: need?.rank ?? 0 } : null
  const paragraphs = open ? dossierParagraphs(scoutDossier(p, playStyle, depth)) : []
  const breakdown = open ? gradeBreakdown(p) : null
  const attrEntries = ATTRIBUTE_COLUMNS
    .filter((name) => p.attributes?.[name] != null && p.attributes[name] !== '')
    .map((name) => ({ name, abbr: ATTRIBUTE_ABBR[name] || name, value: Number(p.attributes[name]) }))

  // Sub-line: top scouted attributes if graded, else recruit bio.
  let subline = ''
  if (top.length) {
    subline = top.map((a) => `${ATTRIBUTE_ABBR[a.name] || a.name} ${a.value}`).join('   ')
  } else {
    const m = []
    if (p.nationalRank) m.push(`#${p.nationalRank} Nat`)
    const htwt = [p.height, p.weight ? `${p.weight} lbs` : null].filter(Boolean).join(', ')
    if (htwt) m.push(htwt)
    subline = m.join('   ')
  }

  // Expanded meta (bio + ranks) shown beneath the attributes grid.
  const meta = []
  if (p.hometown) meta.push(`${p.hometown}${p.state ? `, ${p.state}` : ''}`)
  if (p.nationalRank) meta.push(`#${p.nationalRank} National`)
  if (p.positionRank) meta.push(`#${p.positionRank} ${p.position || 'POS'}`)
  if (p.stateRank && p.state) meta.push(`#${p.stateRank} ${p.state}`)

  const fmtAdj = (v) => (v > 0 ? `+${v}` : `${v}`)

  return (
    <div style={{ borderTop: rank > 1 ? '1px solid var(--surface-4)' : 'none', opacity: lost ? 0.55 : 1 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 sm:gap-3.5 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
      >
        <span className="w-5 text-right tabular-nums font-display flex-shrink-0 leading-none text-txt-secondary" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
          {rank}
        </span>

        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--surface-3)' }}>
          {p.pictureUrl
            ? <img src={proxyImageUrl(p.pictureUrl, 200)} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px] font-black uppercase text-txt-secondary" style={{ letterSpacing: '0.04em' }}>{(p.position || 'ATH').slice(0, 3)}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-txt-primary truncate">{p.name}</span>
            {Number(p.stars) > 0 && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--accent-warning)' }}>{STAR(p.stars)}</span>}
            {committed && <span className="text-[9px] font-bold uppercase text-txt-tertiary tracking-wide flex-shrink-0">· Committed</span>}
            {lost && <span className="text-[9px] font-bold uppercase text-txt-tertiary tracking-wide flex-shrink-0">· Lost</span>}
          </div>
          <div className="text-[11px] text-txt-tertiary truncate mt-0.5" style={{ letterSpacing: '0.3px' }}>
            <span className="uppercase">{p.position || 'ATH'}{p.archetype ? ` · ${p.archetype}` : ''}</span>
            {subline && <span className="text-txt-secondary tabular-nums">{'   '}{subline}</span>}
          </div>
        </div>

        <div className="text-right flex-shrink-0 w-12">
          <div className="font-display leading-none text-txt-primary" style={{ fontSize: '1.55rem', fontWeight: 800 }} title={tier ? tier.label : 'Unscouted'}>
            {score != null ? scoutLetter(score) : '—'}
          </div>
        </div>

        <Chevron open={open} />
      </button>

      {open && (
        <div className="px-4 pb-5 pt-1 sm:pl-[4.5rem] space-y-4">
          {/* Scouting report — flowing paragraphs */}
          {paragraphs.length > 0 && (
            <div className="space-y-2.5">
              <div className="label-xs text-txt-tertiary" style={{ letterSpacing: '1px' }}>Scouting Report</div>
              {paragraphs.map((para, i) => (
                <p key={i} className="text-[12px] leading-relaxed text-txt-secondary">{para}</p>
              ))}
            </div>
          )}

          {/* How the grade is determined */}
          {breakdown && (
            <div className="rounded-md p-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)' }}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="label-xs text-txt-tertiary" style={{ letterSpacing: '1px' }}>How this grade is built</span>
                <span className="text-[12px] tabular-nums text-txt-secondary">
                  {breakdown.letter} <span className="text-txt-primary font-bold">{breakdown.score}</span> overall
                </span>
              </div>
              <div className="space-y-1">
                {breakdown.adjustments.map((a) => (
                  <div key={a.label} className="flex items-baseline gap-2 text-[11px]">
                    <span className="text-txt-secondary w-40 flex-shrink-0">{a.label}</span>
                    <span className="tabular-nums font-bold text-txt-primary w-9 text-right flex-shrink-0">{a.kind === 'base' ? a.value : fmtAdj(a.value)}</span>
                    <span className="text-txt-tertiary truncate">{a.note}</span>
                  </div>
                ))}
              </div>
              {breakdown.factors.length > 0 && breakdown.usesWeights && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--surface-4)' }}>
                  <div className="label-xs text-txt-tertiary mb-1.5" style={{ letterSpacing: '1px' }}>Attributes driving the base (by weight)</div>
                  <div className="flex flex-col gap-1.5">
                    {breakdown.factors.map((f) => (
                      <div key={f.name} className="flex items-center gap-2 text-[11px]">
                        <span className="text-txt-secondary w-32 flex-shrink-0 truncate">{f.name}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-4)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round(f.share * 100)}%`, backgroundColor: 'var(--text-tertiary)' }} />
                        </div>
                        <span className="tabular-nums text-txt-tertiary w-8 text-right flex-shrink-0">{Math.round(f.share * 100)}%</span>
                        <span className="tabular-nums font-bold text-txt-primary w-7 text-right flex-shrink-0">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full scouted-attributes grid */}
          {attrEntries.length > 0 && (
            <div>
              <div className="label-xs text-txt-tertiary mb-2" style={{ letterSpacing: '1px' }}>Scouted Attributes</div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-2 gap-y-2.5">
                {attrEntries.map((e) => (
                  <div key={e.name} className="text-center" title={e.name}>
                    <div className="font-display font-black tabular-nums leading-none text-txt-primary" style={{ fontSize: '15px' }}>{e.value}</div>
                    <div className="text-[8px] font-bold uppercase tracking-wide text-txt-tertiary mt-0.5">{e.abbr}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {meta.length > 0 && (
            <div className="text-[11px] text-txt-tertiary tabular-nums">{meta.join('   ·   ')}</div>
          )}

          <Link
            to={`${pathPrefix}/player/${p.pid}`}
            className="inline-block text-[11px] font-bold uppercase tracking-wide text-txt-secondary hover:text-txt-primary"
            style={{ letterSpacing: '0.5px' }}
          >
            View full profile →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function ScoutBoard({ dynasty, year, userTid, pathPrefix, onResolveTargets = null, resolveCount = 0 }) {
  const yearN = Number(year)
  const currentYear = Number(dynasty?.currentYear)
  const [needsOpen, setNeedsOpen] = useState(false)

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
      g.need = needLevel(g.returning, g.group)
    }
    return out
  }, [dynasty?.players, userTid, currentYear, dynasty])

  // Team offensive identity (from pass/rush yards) → per-target scheme fit.
  const playStyle = useMemo(() => {
    const roster = (dynasty?.players || []).filter((p) => isPlayerOnRoster(p, userTid, currentYear, dynasty))
    return inferPlayStyle(roster, currentYear)
  }, [dynasty?.players, userTid, currentYear, dynasty])

  const ranked = useMemo(() => {
    const rows = []
    for (const p of dynasty?.players || []) {
      if (!p.isTarget || Number(p.targetYear) !== yearN) continue
      const { score, tier } = scoutGrade(p)
      const group = finePositionGroup(p.position)
      const need = group ? needsByGroup[group]?.need : null
      const returning = group ? needsByGroup[group]?.returning : null
      rows.push({ p, score, tier, group, need, returning, fits: schemeFits(p.archetype, playStyle), status: getTargetStatus(p, userTid) })
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
  }, [dynasty?.players, yearN, userTid, needsByGroup, playStyle])

  const needGroups = useMemo(
    () => Object.values(needsByGroup).sort((a, b) => b.need.rank - a.need.rank || a.group.localeCompare(b.group)),
    [needsByGroup],
  )

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
    <div className="space-y-4">
      {/* Roster needs — collapsed by default, tucks behind the header line. */}
      {needGroups.length > 0 && (
        <section className="media-card overflow-hidden">
          <button
            type="button"
            onClick={() => setNeedsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 hover:bg-surface-2 transition-colors text-left"
          >
            <span className="font-display font-black uppercase leading-none text-txt-primary" style={{ fontSize: '13px', letterSpacing: '0.02em' }}>Roster Needs</span>
            <Chevron open={needsOpen} />
          </button>
          {needsOpen && (
            <div className="px-4 sm:px-5 pb-3 pt-1 flex flex-wrap gap-x-4 gap-y-2 border-t" style={{ borderColor: 'var(--surface-4)' }}>
              {needGroups.map((g) => (
                <span key={g.group} className="inline-flex items-baseline gap-1.5 text-[12px]" title={`${g.depth} on roster, ${g.graduating} graduating`}>
                  <span className="font-bold uppercase text-txt-secondary" style={{ letterSpacing: '0.4px' }}>{g.group}</span>
                  <span className="tabular-nums font-display font-black text-txt-primary">{g.returning}</span>
                  {g.need.label && (
                    <span className="text-[10px] font-bold uppercase text-txt-tertiary" style={{ letterSpacing: '0.5px' }}>{g.need.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Big board */}
      <section className="media-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b" style={{ borderColor: 'var(--surface-4)' }}>
          <h3 className="font-display font-black uppercase leading-none text-txt-primary" style={{ fontSize: '15px', letterSpacing: '0.02em' }}>Big Board</h3>
          {onResolveTargets && (
            <Button variant="secondary" size="sm" onClick={onResolveTargets}>New commits? ({resolveCount})</Button>
          )}
        </div>
        <div>
          {ranked.map((r, i) => <Row key={r.p.pid} r={r} rank={i + 1} pathPrefix={pathPrefix} playStyle={playStyle} />)}
        </div>
      </section>
    </div>
  )
}
