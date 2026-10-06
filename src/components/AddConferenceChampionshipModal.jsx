import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getTeamLogoByTid, stripMascotFromName } from '../data/teams'

/**
 * Pick the opponent for a conference championship game that was never
 * entered — a past season's title game, usually. The dashboard only offers
 * this during the current season's championship week, so once that week has
 * gone by there was no way back in. The team page opens this, and on pick the
 * caller hands off to the same game editor the dashboard uses.
 *
 * The conference's own teams are listed first as tappable rows; typing
 * searches every team, for a dynasty whose conference map is incomplete.
 *
 * Props:
 *   isOpen, onClose
 *   teams            dynasty.teams (tid-keyed)
 *   tid              the team whose title game this is (excluded from the list)
 *   year, conference shown in the header
 *   conferenceTids   tids of the conference that season ([] → search all)
 *   onPick(oppTid)
 */
export default function AddConferenceChampionshipModal({
  isOpen, onClose, teams, tid, year, conference, conferenceTids = [], onPick,
}) {
  const [query, setQuery] = useState('')
  // A logo that fails to load falls back to the abbreviation instead of a
  // broken-image icon.
  const [brokenLogos, setBrokenLogos] = useState(() => new Set())
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const allTeams = useMemo(() => (
    Object.entries(teams || {})
      .map(([k, t]) => ({ tid: Number(k), name: t?.name || t?.abbr || '', abbr: t?.abbr || '' }))
      .filter((t) => Number.isFinite(t.tid) && t.tid !== Number(tid) && t.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [teams, tid])

  const confSet = useMemo(() => new Set((conferenceTids || []).map(Number)), [conferenceTids])
  const confTeams = useMemo(() => allTeams.filter((t) => confSet.has(t.tid)), [allTeams, confSet])

  const q = query.trim().toLowerCase()
  const searching = q.length > 0 || confTeams.length === 0
  const list = searching
    ? allTeams.filter((t) => !q || t.name.toLowerCase().includes(q) || t.abbr.toLowerCase().includes(q))
    : confTeams

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 modal-backdrop-in"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="card-elevated w-full max-w-md max-h-[calc(100dvh-4rem)] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${conference} Championship`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-surface-4">
          <div className="min-w-0">
            <p className="label-xs text-txt-tertiary">{year} Postseason</p>
            <h2 className="text-lg font-bold text-txt-primary tracking-tight leading-snug">{conference} Championship</h2>
            <p className="text-xs text-txt-tertiary mt-0.5">Who was the opponent?</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-txt-tertiary hover:text-txt-primary transition-colors p-1.5 -mr-1.5 rounded-md hover:bg-surface-2 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-3 pb-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all teams"
            className="w-full px-3 py-2 text-sm rounded-md border border-surface-4 bg-surface-2 text-txt-primary focus:outline-none focus:border-surface-5"
            autoComplete="off"
          />
        </div>

        {!searching && (
          <p className="px-5 pb-1 label-xs text-txt-tertiary">{conference}</p>
        )}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {list.length === 0 ? (
            <p className="text-sm text-txt-tertiary text-center py-8">No teams match.</p>
          ) : (
            <ul>
              {list.map((t) => {
                const logo = brokenLogos.has(t.tid) ? null : getTeamLogoByTid(t.tid, teams)
                return (
                  <li key={t.tid}>
                    <button
                      type="button"
                      onClick={() => onPick(t.tid)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-2 active:bg-surface-3 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 ring-1 ring-black/10">
                        {logo
                          ? <img src={logo} alt="" className="w-6 h-6 object-contain" onError={() => setBrokenLogos(prev => new Set(prev).add(t.tid))} />
                          : <span className="text-[10px] font-bold text-gray-700">{t.abbr}</span>}
                      </span>
                      <span className="text-sm font-semibold text-txt-primary truncate">{stripMascotFromName(t.name) || t.name}</span>
                      <svg className="w-4 h-4 ml-auto text-txt-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
