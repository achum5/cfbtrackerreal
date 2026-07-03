import { useCloudSyncStatus } from '../hooks/useCloudSyncStatus'

// A persistent, hard-to-miss banner shown whenever a cloud write hasn't reached
// the server within the stalled window. This is the visible counterpart to the
// silent settleOrProceed grace period: without it, a device whose sync
// connection is wedged (VPN/proxy, flaky network, or a second tab holding the
// single-tab persistence lease) keeps showing "saved" while nothing uploads,
// and the divergence is only discovered on another device. Text-based, no
// decorative icons, per the project UI guidelines.
export default function CloudSyncBanner() {
  const { stalled, stalledCount } = useCloudSyncStatus()
  if (!stalled) return null

  const changes = stalledCount === 1 ? 'A recent change is' : `${stalledCount} recent changes are`

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[9998] px-4 py-3 sm:px-6"
      style={{ margin: 0, backgroundColor: '#7c2d12', borderTop: '1px solid #b45309' }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-sm font-semibold text-amber-50">
          Not synced to the cloud
        </p>
        <p className="text-xs text-amber-100/90 mt-0.5 leading-relaxed">
          {changes} saved on this device but haven&apos;t reached the cloud yet. Keep this
          tab open on a stable connection — turn off any VPN and close extra tracker tabs.
          Don&apos;t clear this browser&apos;s data until it syncs, or those changes could be lost.
        </p>
      </div>
    </div>
  )
}
