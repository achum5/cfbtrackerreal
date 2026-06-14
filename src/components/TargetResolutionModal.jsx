import { useMemo, useState } from 'react'
import { Modal, Button } from './ui'
import { getMascotName } from '../data/teams'

// In-app resolution of open recruiting targets (spec §5 / Phase 4). Lists the
// class's open targets; per target the user commits to their own team or picks
// another school. On Apply it hands a { pid: commitmentTid } map back to the
// Recruiting page, which writes the same fields the sheet reconciler does — so
// the two paths are interchangeable. Leaving a target untouched keeps it open.

const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))

export default function TargetResolutionModal({ isOpen, onClose, targets = [], dynastyTeams, userTid, onResolve }) {
  // res[pid] = { kind: 'me' | 'elsewhere', tid }  (absent = leave open)
  const [res, setRes] = useState({})
  const [saving, setSaving] = useState(false)

  const teamOptions = useMemo(() => {
    const out = []
    for (const [tid, t] of Object.entries(dynastyTeams || {})) {
      const n = Number(tid)
      if (!Number.isFinite(n) || n === Number(userTid)) continue
      out.push({ tid: n, name: t?.name || getMascotName(n, dynastyTeams) || `#${tid}` })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [dynastyTeams, userTid])

  const set = (pid, value) => setRes(prev => {
    const next = { ...prev }
    if (value == null) delete next[pid]
    else next[pid] = value
    return next
  })

  // Resolutions that are actually actionable (committed somewhere).
  const resolutions = useMemo(() => {
    const map = {}
    for (const [pid, r] of Object.entries(res)) {
      if (r?.kind === 'me') map[pid] = Number(userTid)
      else if (r?.kind === 'elsewhere' && r.tid != null) map[pid] = Number(r.tid)
    }
    return map
  }, [res, userTid])

  const count = Object.keys(resolutions).length

  const apply = async () => {
    if (!count || saving) return
    setSaving(true)
    try {
      await onResolve(resolutions)
      setRes({})
      onClose?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Resolve Targets"
      size="lg"
      hideClose={saving}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={apply} disabled={saving || !count}>
            {saving ? 'Saving…' : count ? `Commit ${count}` : 'Commit'}
          </Button>
        </>
      )}
    >
      {targets.length === 0 ? (
        <p className="text-txt-tertiary text-sm py-6 text-center">No open targets to resolve.</p>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {targets.map((t) => {
            const r = res[t.pid]
            const isMe = r?.kind === 'me'
            return (
              <div key={t.pid} className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-txt-primary truncate">{t.name}</div>
                  <div className="text-[11px] text-txt-tertiary">
                    {t.position || '—'}{Number(t.stars) > 0 ? ` · ${STAR(t.stars)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => set(t.pid, isMe ? null : { kind: 'me', tid: null })}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors"
                    style={isMe
                      ? { backgroundColor: 'var(--accent-success)', color: '#fff' }
                      : { backgroundColor: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                  >
                    Commit to me
                  </button>
                  <select
                    value={r?.kind === 'elsewhere' ? (r.tid ?? '') : ''}
                    onChange={(e) => set(t.pid, e.target.value ? { kind: 'elsewhere', tid: Number(e.target.value) } : null)}
                    className="text-[11px] px-2 py-1 rounded-md text-txt-primary focus:outline-none cursor-pointer"
                    style={{ backgroundColor: 'var(--surface-3)', border: '1px solid var(--surface-4)', maxWidth: '150px' }}
                  >
                    <option value="">Elsewhere…</option>
                    {teamOptions.map((o) => (
                      <option key={o.tid} value={o.tid}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
