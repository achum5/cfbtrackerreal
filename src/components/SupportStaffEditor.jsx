import { useState } from 'react'
import { parseDp } from '../data/dynastyPointsModel'
import { Button } from './ui'
import pointsIcon from '../assets/blueprint/points.png'

const fmt = (n) => (n == null || n === '' || isNaN(n) ? '—' : Number(n).toLocaleString())

// Shared support-staff editor — the list of game-style cards + the add row.
// Used by both the Blueprint tab section and the preseason modal so the input
// and display can never drift. Presentational + local form state only; the
// parent owns persistence (onAdd / onRemove).
//
//   <SupportStaffEditor supportStaff={[...]} effects={config.effects}
//      onAdd={item => ...} onRemove={idx => ...} isViewOnly={...} />
//
// A staffer = { effect, name?, boost?, cost? }. effect is the type key;
// name is the in-game role name; boost is the magnitude text (e.g. "-15%").
export default function SupportStaffEditor({ supportStaff = [], effects = [], onAdd, onRemove, isViewOnly = false, busy = false }) {
  const [form, setForm] = useState({ effect: '', name: '', boost: '', cost: '' })
  const effectLabel = (key) => effects.find((e) => e.key === key)?.label || key

  const submit = () => {
    if (!form.effect || !onAdd) return
    onAdd({
      effect: form.effect,
      name: form.name.trim() || null,
      boost: form.boost.trim() || null,
      cost: parseDp(form.cost),
    })
    setForm({ effect: '', name: '', boost: '', cost: '' })
  }

  const inputClass = 'w-full bg-surface-2 border border-surface-4 rounded-md px-2.5 h-9 text-sm text-txt-primary'

  return (
    <div className="space-y-4">
      {/* Cards */}
      {supportStaff.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {supportStaff.map((s, idx) => {
            const title = s.name || effectLabel(s.effect)
            const typeUnderTitle = s.name ? effectLabel(s.effect) : '' // avoid repeating when no name
            return (
              <div key={idx} className="rounded-lg p-3 relative" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)' }}>
                {!isViewOnly && (
                  <button
                    type="button"
                    onClick={() => onRemove?.(idx)}
                    disabled={busy}
                    aria-label="Remove"
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-txt-tertiary hover:text-[color:var(--accent-error)] hover:bg-surface-3 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                <div className="text-sm font-bold text-txt-primary truncate pr-6">{title}</div>
                <div className="text-xs mt-0.5 truncate">
                  {s.boost && <span className="font-bold" style={{ color: 'var(--accent-success)' }}>{s.boost}</span>}
                  {s.boost && typeUnderTitle ? ' ' : ''}
                  {typeUnderTitle && <span className="text-txt-secondary">{typeUnderTitle}</span>}
                </div>
                <div className="flex items-center gap-1 mt-2 tabular-nums text-sm font-semibold text-txt-primary">
                  <img src={pointsIcon} alt="" className="w-4 h-4 object-contain" />
                  {fmt(s.cost)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add row — easy input: effect + (optional) name + boost + cost */}
      {!isViewOnly && (
        <div className="rounded-md p-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)' }}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[150px]">
              <label className="label-xs text-txt-tertiary block mb-1.5">Effect</label>
              <select value={form.effect} onChange={(e) => setForm({ ...form, effect: e.target.value })} className={`${inputClass} appearance-none`}>
                <option value="">Select…</option>
                {effects.map((eff) => <option key={eff.key} value={eff.key}>{eff.label}</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="label-xs text-txt-tertiary block mb-1.5">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="optional" className={inputClass} />
            </div>
            <div className="w-20">
              <label className="label-xs text-txt-tertiary block mb-1.5">Boost</label>
              <input value={form.boost} onChange={(e) => setForm({ ...form, boost: e.target.value })} placeholder="-15%" className={inputClass} />
            </div>
            <div className="w-20">
              <label className="label-xs text-txt-tertiary block mb-1.5">Cost</label>
              <input
                type="number"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && form.effect) submit() }}
                className={`${inputClass} text-right tabular-nums`}
              />
            </div>
            <Button variant="primary" onClick={submit} disabled={busy || !form.effect}>Add</Button>
          </div>
        </div>
      )}
    </div>
  )
}
