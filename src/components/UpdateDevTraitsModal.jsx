import { useState, useMemo } from 'react'

const DEV_TRAIT_OPTIONS = ['Hidden', 'Normal', 'Impact', 'Star', 'Elite']

// All-local checklist for filling in now-revealed dev traits at National Signing
// Day / Early National Signing Day (Bowl Week 1) — deliberately no AI/Sheets
// involved, just a dropdown per recruit. `players` is this dynasty's own targets
// for the signing class in question (see Dashboard.jsx), each carrying the exact
// same `recentRank` shown in the Database table (computed via the shared
// computeRecentRanks — see Dashboard.jsx) and their current `devTrait`
// (Hidden/blank for anyone not yet revealed). Saving writes the changed values
// straight back onto the real Target records — Thresholds/History pick them up
// automatically on their next read, since both now read the live pool filtered
// to known dev traits only.
export default function UpdateDevTraitsModal({ isOpen, onClose, players = [], onSave, saving = false }) {
  const sorted = useMemo(
    () => [...players].sort((a, b) => (a.recentRank ?? 0) - (b.recentRank ?? 0)),
    [players]
  )
  const [values, setValues] = useState(() => Object.fromEntries(sorted.map(p => [p.pid, p.devTrait || 'Hidden'])))

  if (!isOpen) return null

  const knownCount = Object.values(values).filter(v => v && v !== 'Hidden').length
  const totalCount = sorted.length

  const handleSave = () => {
    const updates = sorted
      .filter(p => (values[p.pid] || 'Hidden') !== (p.devTrait || 'Hidden'))
      .map(p => ({ pid: p.pid, devTrait: values[p.pid] }))
    onSave(updates)
  }

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="card-elevated w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Update Dev Traits"
        onClick={e => e.stopPropagation()}
      >
        {/* Same header / footer chrome as the shared Modal. */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-surface-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-txt-primary m-0">Update Dev Traits</h2>
            <p className="text-sm text-txt-tertiary mt-1 m-0 tabular-nums">
              {knownCount} of {totalCount} known
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-surface-3 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          <p className="text-sm text-txt-secondary leading-relaxed m-0">
            Set each recruit's now-revealed dev trait below. Anyone left on "Hidden" just
            stays that way in the Database — nothing is lost, and they'll count toward
            Thresholds/History the moment you do fill theirs in, whenever that is.
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm text-txt-tertiary text-center py-8 m-0">
              No targets found for this signing class.
            </p>
          ) : (
            <div className="rounded-lg border border-surface-4 divide-y divide-surface-4 overflow-hidden">
              {sorted.map(p => (
                <div key={p.pid} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-xs tabular-nums text-txt-tertiary w-6 flex-shrink-0 text-right">
                    {p.recentRank ?? '—'}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-txt-primary truncate">{p.name}</span>
                  <select
                    value={values[p.pid] || 'Hidden'}
                    onChange={e => setValues(v => ({ ...v, [p.pid]: e.target.value }))}
                    aria-label={`${p.name} dev trait`}
                    className="text-sm bg-surface-2 border border-surface-4 rounded-md px-2 py-1 text-txt-primary focus:outline-none flex-shrink-0"
                  >
                    {DEV_TRAIT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-surface-4 bg-surface-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-refined">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || sorted.length === 0}
            className="btn-refined btn-refined--solid disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
