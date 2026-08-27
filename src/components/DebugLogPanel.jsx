import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  isDebugLogEnabled, subscribeDebugLog, getDebugLogEntries,
  clearDebugLog, debugLogAsText,
} from '../utils/debugLog'

// Accounts allowed to see the on-device log panel (Account page carries the
// toggle). Owner/debug accounts only — this is a diagnostic surface, not a
// user feature, and warn/error text can reference internals.
export const DEBUG_LOG_ACCOUNTS = new Set(['alex.guess1999@gmail.com'])

export function canUseDebugLog(user) {
  return !!user?.email && DEBUG_LOG_ACCOUNTS.has(user.email.toLowerCase())
}

// Fixed bottom log strip: collapsed to a one-line pill (level counts), tap to
// expand the recent entries, Copy puts the ENTIRE buffer (with version/url/UA
// header) on the clipboard for pasting into a bug report. Renders nothing at
// all unless the signed-in account is allowlisted AND the Account-page toggle
// is on for this device.
export default function DebugLogPanel() {
  const { user } = useAuth()
  const [, setTick] = useState(0)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => subscribeDebugLog(() => setTick((t) => t + 1)), [])

  if (!canUseDebugLog(user) || !isDebugLogEnabled()) return null

  const entries = getDebugLogEntries()
  const errors = entries.filter((e) => e.level === 'error').length
  const warns = entries.length - errors

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(debugLogAsText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (some in-app browsers) — select-and-copy fallback:
      // put the text in a prompt so the user can copy manually.
      window.prompt('Copy the log text:', debugLogAsText().slice(0, 2000))
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998]" style={{ pointerEvents: 'none' }}>
      {open && (
        <div
          className="mx-auto max-w-3xl max-h-[40vh] overflow-y-auto text-[11px] leading-snug font-mono rounded-t-lg border border-b-0"
          style={{ pointerEvents: 'auto', backgroundColor: 'rgba(10,12,16,0.96)', borderColor: '#333', color: '#ddd' }}
        >
          {entries.length === 0 ? (
            <div className="p-3 opacity-60">No warnings or errors captured yet.</div>
          ) : entries.slice(-120).map((e) => (
            <div key={e.id} className="px-3 py-1 border-b" style={{ borderColor: '#222' }}>
              <span className="opacity-50">{e.at.toISOString().slice(11, 23)}</span>{' '}
              <span style={{ color: e.level === 'error' ? '#f87171' : '#fbbf24' }}>{e.level.toUpperCase()}</span>{' '}
              <span className="whitespace-pre-wrap break-words">{e.text}</span>
            </div>
          ))}
        </div>
      )}
      <div
        className="mx-auto max-w-3xl flex items-center gap-3 px-3 py-1.5 text-xs font-semibold rounded-t-lg"
        style={{ pointerEvents: 'auto', backgroundColor: 'rgba(10,12,16,0.96)', color: '#ddd', border: '1px solid #333', borderBottom: 'none', ...(open ? { borderTop: 'none', borderRadius: 0 } : {}) }}
      >
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-left">
          Logs: {errors} error{errors === 1 ? '' : 's'}, {warns} warning{warns === 1 ? '' : 's'} — tap to {open ? 'hide' : 'view'}
        </button>
        <button type="button" onClick={copyAll} className="px-2 py-0.5 rounded border" style={{ borderColor: '#555' }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={clearDebugLog} className="px-2 py-0.5 rounded border" style={{ borderColor: '#555' }}>
          Clear
        </button>
      </div>
    </div>
  )
}
