import { useEffect, useState } from 'react'
import { useCloudSyncStatus } from '../hooks/useCloudSyncStatus'

// A persistent, hard-to-miss banner shown while the browser is genuinely
// OFFLINE. This is the visible counterpart to the silent settleOrProceed
// grace period: offline writes are durably queued by persistentLocalCache and
// still show "saved", but they only exist on THIS device until it reconnects —
// closing the browser forever, clearing site data, or switching devices before
// then loses them. Text-based, no decorative icons, per the project UI
// guidelines.
//
// NOTE: the earlier version of this banner keyed off stalled server ACKS and
// false-positived badly (a wedged WebChannel stops acks even though writes
// are safe and still syncing), so it was disabled. navigator.onLine cannot
// false-positive that way: offline is offline. The stalled-ack detection
// stays suppressed; the cloudSyncStatus store is kept for a future revisit.
// Which save was too big, in words, and what fixes it. Only the MAIN dynasty
// doc is fixed by "Migrate to Subcollections"; telling a dynasty that's
// already migrated to run it again is a dead end (a user with a 133 KB main
// doc got exactly that advice). Everything else names the record that's over
// the cap and asks for the storage report, which lists every season doc's size.
function oversizedCopy(oversized, subcollectionsMigrated) {
  const kind = oversized?.kind || 'unknown'
  const isMainDoc = kind === 'main' || (kind === 'unknown' && !subcollectionsMigrated)
  if (isMainDoc) {
    return {
      what: 'This dynasty\u2019s core save has grown past Firestore\u2019s 1\u00a0MB limit, so the server is rejecting every save',
      fix: 'Fix: open Admin Tools (Danger Zone) and run \u201cMigrate to Subcollections\u201d, then re-check this page.',
    }
  }
  const record = (kind === 'season' || kind === 'teamShard')
    ? `the ${oversized.year ?? ''} season record`.replace('  ', ' ')
    : kind === 'subcollection'
      ? `a record in ${oversized.collection}`
      : 'one of this dynasty\u2019s records'
  return {
    what: `Saves that touch ${record} are being rejected because it has grown past Firestore\u2019s 1\u00a0MB limit`,
    fix: 'Your main save is fine, so \u201cMigrate to Subcollections\u201d won\u2019t help here. Open Admin Tools (Danger Zone), run \u201cAnalyze Storage Size\u201d, and send the report (screenshot or copy) to support.',
  }
}

export default function CloudSyncBanner({ subcollectionsMigrated = false }) {
  // The stalled-ack signal stays deliberately unused (see note above) — but
  // lastError.docTooLarge is a different animal: it's a definitive SERVER
  // REJECTION, not a maybe-wedged connection, so it cannot false-positive the
  // way stalled did. It means every save is being refused while the UI keeps
  // showing the user's data locally — the exact silent-loss mode behind the
  // "logged a whole season, reloaded, it was gone" report. Loud is correct.
  const status = useCloudSyncStatus()
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (status?.lastError?.docTooLarge) {
    const copy = oversizedCopy(status.lastError.oversized, subcollectionsMigrated)
    const path = status.lastError.oversized?.path
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed bottom-0 left-0 right-0 z-[9998] px-4 py-3 sm:px-6"
        style={{ margin: 0, backgroundColor: '#7f1d1d', borderTop: '1px solid #dc2626' }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold text-red-50">
            Your saves are NOT reaching the cloud
          </p>
          <p className="text-xs text-red-100/90 mt-0.5 leading-relaxed">
            {copy.what} — changes look saved on this device but will be lost on reload.{' '}
            {copy.fix} This banner clears on the first save that reaches the cloud.
          </p>
          {path && (
            <p className="text-[11px] text-red-100/70 mt-1 font-mono break-all">{path}</p>
          )}
        </div>
      </div>
    )
  }

  // Any OTHER definitive server rejection. Same reasoning as docTooLarge —
  // a rejection cannot false-positive the way stalled acks did — but without
  // a known remedy we surface the raw error class instead. This existed as
  // data (cloudSyncStatus captures every rejection) but rendered nowhere, so
  // a rejected save looked identical to a successful one until the optimistic
  // state rolled back seconds later ("synced, then everything snapped back").
  if (status?.lastError && !status.lastError.docTooLarge) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed bottom-0 left-0 right-0 z-[9998] px-4 py-3 sm:px-6"
        style={{ margin: 0, backgroundColor: '#7f1d1d', borderTop: '1px solid #dc2626' }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold text-red-50">
            A save was rejected by the cloud and did NOT sync
          </p>
          <p className="text-xs text-red-100/90 mt-0.5 leading-relaxed">
            The server refused the last save
            {status.lastError.label ? ` (${status.lastError.label})` : ''}:{' '}
            <span className="font-mono">{String(status.lastError.message).slice(0, 400)}</span>.
            Changes may look saved on this device but will revert. Screenshot this
            banner and report it — this clears on the next save that succeeds.
          </p>
        </div>
      </div>
    )
  }

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[9998] px-4 py-3 sm:px-6"
      style={{ margin: 0, backgroundColor: '#7c2d12', borderTop: '1px solid #b45309' }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-sm font-semibold text-amber-50">
          You&apos;re offline
        </p>
        <p className="text-xs text-amber-100/90 mt-0.5 leading-relaxed">
          Changes are being saved on this device and will sync to the cloud when
          your connection returns. Until then they exist only here — don&apos;t clear
          this browser&apos;s data, and reconnect before switching devices.
        </p>
      </div>
    </div>
  )
}
