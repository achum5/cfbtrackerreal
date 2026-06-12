import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/ui'
import { usePathPrefix } from '../../hooks/usePathPrefix'
import { getTeamLogoByTid } from '../../data/teams'
import { getColorsFromTid } from '../../data/teamRegistry'
import { getContrastTextColor } from '../../utils/colorUtils'
import { TROPHIES, TROPHY_CATEGORIES, TROPHY_BY_ID, trophiesByCategory } from '../../data/trophies'
import { getEarnedTrophies, earnedYears } from '../../utils/trophyEngine'
import { getPlayerCards } from '../../utils/playerCards'

// The player's "face" — the front image of their first card (prompt-driven
// frontImageUrl or legacy photoUrl). Null when the player has no card.
function getPlayerFace(player) {
  if (!player) return null
  for (const c of getPlayerCards(player)) {
    const url = c.frontImageUrl || c.photoUrl || c.front || c.cardFront
    if (url) return url
  }
  return null
}

// Trophy Room — the case of every trophy this coach has won across their career,
// detected retroactively from their games + the dynasty's award winners. Each
// trophy opens a modal listing the specific games (or players) it was won for.

function yearLabel(years) {
  if (!years.length) return ''
  if (years.length <= 3) return years.join(', ')
  return `${years[0]}–${String(years[years.length - 1]).slice(-2)}`
}

function teamInfo(tid, teams) {
  const t = teams[tid] || {}
  const colors = getColorsFromTid(teams, tid)
  const primary = colors?.primary || 'var(--surface-2)'
  return { abbr: t.abbr || `#${tid}`, logo: getTeamLogoByTid(tid, teams), primary, txt: getContrastTextColor(primary) }
}

// White disc behind a team logo — the app-wide standings/scoreboard treatment.
function LogoChip({ src }) {
  if (!src) return null
  return (
    <span className="w-7 h-7 rounded-full bg-white p-1 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
      <img src={src} alt="" className="w-full h-full object-contain" />
    </span>
  )
}

// The broadcast sheen + vignette overlay (matches ConferenceStandings rows).
const SHEEN = 'linear-gradient(120deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.34) 100%)'
const TEXT_SHADOW = '0 1px 2px rgba(0,0,0,0.35)'

function GameRow({ inst, teams, pathPrefix }) {
  const g = inst.game
  if (!g) return null
  const tid = Number(inst.tid)
  const isT1 = Number(g.team1Tid) === tid
  const my = isT1 ? g.team1Score : g.team2Score
  const opp = isT1 ? g.team2Score : g.team1Score
  const oppTid = isT1 ? Number(g.team2Tid) : Number(g.team1Tid)
  const me = teamInfo(tid, teams)
  const them = teamInfo(oppTid, teams)
  // Two-tone base: winner's color on the left, opponent's on the right, with a
  // soft blend band centered on the row — then the standard sheen + vignette.
  // `to right` (vertical split, not angled) keeps the transition in one place,
  // and the symmetric 44/56 stops put the blend midpoint exactly at center.
  const split = `linear-gradient(to right, ${me.primary} 0%, ${me.primary} 44%, ${them.primary} 56%, ${them.primary} 100%)`
  const body = (
    <div
      className="cfb-texture overflow-hidden relative flex items-center gap-2 sm:gap-3 py-2.5 px-3 sm:px-4 rounded-xl"
      style={{ backgroundColor: me.primary, backgroundImage: `${SHEEN}, ${split}` }}
    >
      <span className="text-[11px] font-bold tabular-nums w-9 flex-shrink-0" style={{ color: me.txt, opacity: 0.8, textShadow: TEXT_SHADOW }}>{inst.year}</span>
      {/* my team — hugs the left */}
      <div className="flex items-center gap-2 flex-1 min-w-0" style={{ color: me.txt }}>
        <LogoChip src={me.logo} />
        <span className="text-[13px] font-bold truncate" style={{ textShadow: TEXT_SHADOW }}>{me.abbr}</span>
      </div>
      {/* final score — centered scorebug, winner emphasized */}
      <div className="flex items-baseline gap-1 flex-shrink-0 font-display tabular-nums px-1" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
        <span className="text-[18px] font-black leading-none">{my ?? '–'}</span>
        <span className="text-[12px] leading-none" style={{ opacity: 0.6 }}>–</span>
        <span className="text-[15px] font-bold leading-none" style={{ opacity: 0.78 }}>{opp ?? '–'}</span>
      </div>
      {/* opponent — hugs the right */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end" style={{ color: them.txt }}>
        <span className="text-[13px] font-bold truncate" style={{ textShadow: TEXT_SHADOW }}>{them.abbr}</span>
        <LogoChip src={them.logo} />
      </div>
      {/* counterweight to the year badge so the score stays dead-center
          (and the gradient's center blend lines up with it). */}
      <span className="w-9 flex-shrink-0" aria-hidden="true" />
    </div>
  )
  return g.id ? <Link to={`${pathPrefix}/game/${g.id}`} className="block transition-opacity hover:opacity-90">{body}</Link> : body
}

function AwardRow({ inst, teams, pathPrefix, face }) {
  const t = teamInfo(Number(inst.awardTid), teams)
  const body = (
    <div
      className="cfb-texture overflow-hidden relative flex items-center gap-3 py-2.5 px-3 sm:px-4 rounded-xl"
      style={{ backgroundColor: t.primary, backgroundImage: SHEEN, color: t.txt }}
    >
      <span className="text-[11px] font-bold tabular-nums w-9 flex-shrink-0" style={{ opacity: 0.8, textShadow: TEXT_SHADOW }}>{inst.year}</span>
      {face
        ? <img src={face} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ objectPosition: '50% 22%', backgroundColor: 'rgba(0,0,0,0.25)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        : <LogoChip src={t.logo} />}
      <span className="text-[13px] font-bold flex-1 truncate" style={{ textShadow: TEXT_SHADOW }}>{inst.player || 'Unknown'}</span>
      {inst.position && <span className="text-[11px] font-bold flex-shrink-0" style={{ opacity: 0.85, letterSpacing: '0.05em', textShadow: TEXT_SHADOW }}>{inst.position}</span>}
    </div>
  )
  return inst.pid != null ? <Link to={`${pathPrefix}/player/${inst.pid}`} className="block transition-opacity hover:opacity-90">{body}</Link> : body
}

export default function CoachTrophyRoom({ dynasty, stints }) {
  const pathPrefix = usePathPrefix()
  const teams = dynasty?.teams || {}
  const earned = useMemo(() => getEarnedTrophies(dynasty, stints), [dynasty, stints])
  const [selectedId, setSelectedId] = useState(null)
  const [catalogOpen, setCatalogOpen] = useState(false)

  // pid → player face (card image), for the award rows.
  const faceByPid = useMemo(() => {
    const map = {}
    for (const p of dynasty?.players || []) {
      if (p?.pid == null) continue
      const face = getPlayerFace(p)
      if (face) map[p.pid] = face
    }
    return map
  }, [dynasty?.players])

  const groups = useMemo(() => (
    Object.keys(TROPHY_CATEGORIES)
      .map((cat) => ({
        cat,
        label: TROPHY_CATEGORIES[cat],
        items: trophiesByCategory(cat)
          .filter((t) => earned[t.id])
          .map((t) => ({ trophy: t, years: earnedYears(earned[t.id]) })),
      }))
      .filter((g) => g.items.length)
  ), [earned])

  const wonCount = Object.keys(earned).length
  const selTrophy = selectedId ? TROPHY_BY_ID[selectedId] : null
  const selInstances = selectedId
    ? [...(earned[selectedId] || [])].sort((a, b) => Number(a.year) - Number(b.year))
    : []

  return (
    <section className="media-card overflow-hidden reveal">
      <div className="px-5 sm:px-6 py-4 flex items-end justify-between gap-3 border-b" style={{ borderColor: 'var(--surface-4)' }}>
        <div>
          <div className="label-sm text-txt-tertiary mb-1">Career</div>
          <h2 className="font-display font-black uppercase leading-none text-txt-primary" style={{ fontSize: 'clamp(22px,4vw,34px)', letterSpacing: '-0.01em' }}>
            Trophy Room
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="text-right flex-shrink-0 group focus:outline-none"
          title="View all trophies"
        >
          <div className="font-display font-black tabular-nums leading-none text-txt-primary group-hover:opacity-80 transition-opacity" style={{ fontSize: '26px' }}>{wonCount}</div>
          <div className="label-xs text-txt-tertiary group-hover:text-txt-secondary transition-colors" style={{ letterSpacing: '1px' }}>of {TROPHIES.length} won</div>
        </button>
      </div>

      <div className="px-5 sm:px-6 py-5">
        {groups.length === 0 ? (
          <p className="text-txt-tertiary text-sm py-4 text-center">No trophies won yet — conference titles, bowls, rivalry games, the Playoff, and your players' awards will show up here as you win them.</p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.cat}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-display font-bold uppercase text-txt-secondary text-[12px]" style={{ letterSpacing: '1.5px' }}>{g.label}</span>
                  <span className="text-[11px] tabular-nums text-txt-tertiary">{g.items.length}</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--surface-4)' }} />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                  {g.items.map(({ trophy, years }) => (
                    <button
                      key={trophy.id}
                      type="button"
                      onClick={() => setSelectedId(trophy.id)}
                      className="flex flex-col items-center text-center group focus:outline-none"
                      title={`${trophy.name} — ${years.join(', ')}`}
                    >
                      <div className="relative w-full flex items-center justify-center transition-transform group-hover:-translate-y-0.5" style={{ height: '88px' }}>
                        <img
                          src={trophy.image}
                          alt={trophy.name}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain"
                          style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))' }}
                        />
                        {years.length > 1 && (
                          <span className="absolute -top-1 -right-1 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}>
                            ×{years.length}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-[10px] font-semibold text-txt-secondary leading-tight line-clamp-2 group-hover:text-txt-primary">
                        {trophy.name.replace(/ Trophy$/, '')}
                      </div>
                      <div className="text-[9px] text-txt-tertiary tabular-nums leading-tight mt-0.5">{yearLabel(years)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {catalogOpen && (
        <Modal
          isOpen
          onClose={() => setCatalogOpen(false)}
          size="full"
          title={(
            <span className="flex items-baseline gap-2">
              <span>Trophy Case</span>
              <span className="text-txt-tertiary text-base font-bold tabular-nums">{wonCount} / {TROPHIES.length}</span>
            </span>
          )}
        >
          <div className="space-y-6">
            {Object.keys(TROPHY_CATEGORIES).map((cat) => {
              const items = trophiesByCategory(cat)
              if (!items.length) return null
              const wonInCat = items.filter((t) => earned[t.id]).length
              return (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-display font-bold uppercase text-txt-secondary text-[12px]" style={{ letterSpacing: '1.5px' }}>{TROPHY_CATEGORIES[cat]}</span>
                    <span className="text-[11px] tabular-nums text-txt-tertiary">{wonInCat}/{items.length}</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--surface-4)' }} />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                    {items.map((trophy) => {
                      const won = !!earned[trophy.id]
                      const years = won ? earnedYears(earned[trophy.id]) : []
                      const inner = (
                        <>
                          <div className="relative w-full flex items-center justify-center" style={{ height: '72px' }}>
                            <img
                              src={trophy.image}
                              alt={trophy.name}
                              loading="lazy"
                              className="max-h-full max-w-full object-contain"
                              style={won
                                ? { filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))' }
                                : { filter: 'grayscale(1) brightness(0.5)', opacity: 0.4 }}
                            />
                            {won && years.length > 1 && (
                              <span className="absolute -top-1 -right-1 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}>
                                ×{years.length}
                              </span>
                            )}
                          </div>
                          <div className={`mt-1.5 text-[10px] font-semibold leading-tight line-clamp-2 ${won ? 'text-txt-secondary' : 'text-txt-tertiary'}`} style={won ? {} : { opacity: 0.65 }}>
                            {trophy.name.replace(/ Trophy$/, '')}
                          </div>
                          <div className="text-[9px] tabular-nums leading-tight mt-0.5" style={{ color: won ? 'var(--text-tertiary)' : 'var(--surface-4)' }}>
                            {won ? yearLabel(years) : 'Locked'}
                          </div>
                        </>
                      )
                      return won ? (
                        <button
                          key={trophy.id}
                          type="button"
                          onClick={() => setSelectedId(trophy.id)}
                          className="flex flex-col items-center text-center group focus:outline-none transition-transform hover:-translate-y-0.5"
                          title={`${trophy.name} — ${years.join(', ')}`}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div key={trophy.id} className="flex flex-col items-center text-center cursor-default" title={`${trophy.name} — not yet won`}>
                          {inner}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {selTrophy && (
        <Modal
          isOpen
          onClose={() => setSelectedId(null)}
          size="md"
          title={(
            <span className="flex items-center gap-3">
              <img src={selTrophy.image} alt="" className="h-10 w-9 object-contain flex-shrink-0" style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))' }} />
              <span>{selTrophy.name}</span>
            </span>
          )}
        >
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {selInstances.map((inst, i) => (
              selTrophy.category === 'award'
                ? <AwardRow key={i} inst={inst} teams={teams} pathPrefix={pathPrefix} face={inst.pid != null ? faceByPid[inst.pid] : null} />
                : <GameRow key={i} inst={inst} teams={teams} pathPrefix={pathPrefix} />
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}
