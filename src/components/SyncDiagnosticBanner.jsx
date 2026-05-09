import { useState } from 'react'
import { useDynasty } from '../context/DynastyContext'

/**
 * SyncDiagnosticBanner
 *
 * Surface for the background save-verification path in DynastyContext.
 * When the cloud fast-path's verifyMainDocTeamsWrite call detects that
 * the server didn't accept a write (or only accepted it after the
 * forced retry), it sets dynastyContext.syncDiagnostic to a small
 * JSON object. This banner picks that up and renders a fixed-position
 * card with a Copy button so a beta tester can grab the payload and
 * paste it back to support, instead of having to dig in the dev
 * console.
 *
 * Mounted once at the layout root so it overlays whichever page the
 * user is on when the verification eventually completes.
 */
export default function SyncDiagnosticBanner() {
  const { syncDiagnostic, dismissSyncDiagnostic } = useDynasty()
  const [copied, setCopied] = useState(false)

  if (!syncDiagnostic) return null

  const isError = syncDiagnostic.severity !== 'warning'
  const accent = isError ? 'var(--accent-error)' : 'var(--accent-warning)'

  const payload = JSON.stringify(syncDiagnostic, null, 2)

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
      } else {
        // Fallback for very old environments — non-async path.
        const ta = document.createElement('textarea')
        ta.value = payload
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.warn('[SyncDiagnosticBanner] clipboard write failed:', e)
    }
  }

  const headline = isError
    ? "Sync didn't fully land"
    : 'Sync needed a retry'

  const summary = isError
    ? "Your save is on this device but the server may not have accepted it. Tap Copy and send the diagnostic to the dev so we can see what happened."
    : 'Your save did land on the server, but only after a forced retry. Sending this diagnostic helps us pinpoint why the first write was dropped.'

  return (
    <div
      className="fixed bottom-4 right-4 z-[10001] max-w-md w-[calc(100%-2rem)]"
      role="status"
      aria-live="polite"
    >
      <div
        className="card-elevated p-4 flex flex-col gap-3"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label-xs mb-0.5" style={{ color: accent }}>
              {isError ? 'Sync error' : 'Sync warning'}
            </div>
            <div className="text-sm font-bold text-txt-primary">{headline}</div>
          </div>
          <button
            onClick={dismissSyncDiagnostic}
            className="text-txt-tertiary hover:text-txt-primary text-xl leading-none px-2 -mt-1"
            aria-label="Dismiss diagnostic"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-txt-secondary">{summary}</p>

        <pre
          className="text-xs text-txt-secondary bg-surface-2 rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap break-words"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {payload}
        </pre>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
          >
            {copied ? 'Copied!' : 'Copy diagnostic'}
          </button>
          <button
            onClick={dismissSyncDiagnostic}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-surface-4 text-txt-secondary hover:text-txt-primary hover:border-surface-5"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
