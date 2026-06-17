import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getPlayerNil } from '../data/playerNilModel'
import pointsIcon from '../assets/blueprint/points.png'

const fmt = (n) => (n == null || n === '' || isNaN(n) ? '—' : Number(n).toLocaleString())

// One editable NIL row. Keyed by pid+stored so an external save (which bumps
// the stored value) remounts it with a fresh draft — no useEffect sync needed.
function NilRow({ player, year, meta, dynastyId, onSave, isViewOnly }) {
  const stored = getPlayerNil(player, year)
  const [draft, setDraft] = useState(stored == null ? '' : String(stored))

  const commit = () => {
    const v = draft === '' ? null : Number(draft)
    if (v === stored) return
    if (isNaN(v) && draft !== '') return
    onSave(player, v)
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-3">
      <Link
        to={`/dynasty/${dynastyId}/player/${player.pid}`}
        className="flex-1 min-w-0 text-sm font-semibold text-txt-primary hover:underline truncate"
      >
        {player.name || 'Unnamed'}
      </Link>
      <span className="w-10 flex-shrink-0 text-xs font-bold text-txt-tertiary text-center">{player.position || '—'}</span>
      <span className="w-16 flex-shrink-0 text-xs text-txt-tertiary text-center tabular-nums">{meta}</span>
      <div className="w-24 flex-shrink-0 flex items-center gap-1">
        <img src={pointsIcon} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
        {isViewOnly ? (
          <span className="text-sm tabular-nums text-txt-primary text-right flex-1">{fmt(stored)}</span>
        ) : (
          <input
            type="number"
            min="0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            placeholder="0"
            className="w-full bg-surface-2 border border-surface-4 rounded-md px-2 h-8 text-sm text-txt-primary text-right tabular-nums"
          />
        )}
      </div>
    </div>
  )
}

// Shared NIL spreadsheet — the editable list behind a NIL lane's detail panel.
// `rows` = [{ player, meta }] where meta is the right-aligned secondary cell
// (stars for recruits, OVR for roster). Total is computed by the parent and
// shown in the header so it always equals the lane.
//
//   <NilSheet title="Recruiting NIL" rows={[{player, meta}]} year={Y}
//      dynastyId={id} total={n} metaLabel="Stars" onSave={(p,amt)=>…} />
export default function NilSheet({ title, icon, rows = [], year, dynastyId, total, metaLabel = '', onSave, isViewOnly = false, emptyMessage }) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && <img src={icon} alt="" className="w-6 h-6 rounded-md object-cover" />}
          <span className="font-display font-bold uppercase tracking-wide text-sm text-txt-primary">{title}</span>
        </div>
        <span className="flex items-center gap-1 tabular-nums font-bold text-txt-primary">
          <img src={pointsIcon} alt="" className="w-4 h-4 object-contain" />{fmt(total)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-txt-tertiary py-6 text-center">{emptyMessage}</p>
      ) : (
        <>
          {/* Column header */}
          <div className="flex items-center gap-3 pb-1.5 border-b border-surface-3 label-xs text-txt-tertiary">
            <span className="flex-1 min-w-0">Player</span>
            <span className="w-10 flex-shrink-0 text-center">Pos</span>
            <span className="w-16 flex-shrink-0 text-center">{metaLabel}</span>
            <span className="w-24 flex-shrink-0 text-center">NIL</span>
          </div>
          <div>
            {rows.map(({ player, meta }) => (
              <NilRow
                key={`${player.pid}-${getPlayerNil(player, year) ?? ''}`}
                player={player}
                year={year}
                meta={meta}
                dynastyId={dynastyId}
                onSave={onSave}
                isViewOnly={isViewOnly}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
