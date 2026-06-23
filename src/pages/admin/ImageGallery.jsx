import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { auth } from '../../config/firebase'

// Admin-only live feed of every image uploaded to R2 across all users.
// The server endpoint (api/admin/list-images) enforces the same admin
// allowlist, so a non-admin who reached this route gets nothing back.

const API_BASE = import.meta.env.VITE_API_BASE || ''

function formatBytes(n) {
  const b = Number(n) || 0
  if (b >= 1024 * 1024 * 1024) return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${b} B`
}

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ImageGallery() {
  const { isAdmin } = useAuth()
  const [state, setState] = useState({ status: 'idle', images: [], count: 0, totalBytes: 0, uploaders: 0, capped: false, error: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Not signed in')
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/api/admin/list-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      })
      if (!res.ok) {
        const info = await res.json().catch(() => ({}))
        throw new Error(info?.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setState({
        status: 'ready',
        images: data.images || [],
        count: data.count || 0,
        totalBytes: data.totalBytes || 0,
        uploaders: data.uploaders || 0,
        capped: !!data.capped,
        error: null,
      })
    } catch (err) {
      setState((s) => ({ ...s, status: 'error', error: err.message || 'Failed to load' }))
    }
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-txt-primary">Image Gallery</h1>
        <p className="text-txt-tertiary mt-2">Not authorized.</p>
      </div>
    )
  }

  const { status, images, count, totalBytes, uploaders, capped, error } = state

  // Group by uploader, preserving the newest-first order within each group.
  const groups = []
  const indexByUid = new Map()
  for (const img of images) {
    let g = indexByUid.get(img.uid)
    if (!g) {
      g = { uid: img.uid, images: [] }
      indexByUid.set(img.uid, g)
      groups.push(g)
    }
    g.images.push(img)
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-16">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Image Gallery</h1>
          <p className="text-sm text-txt-tertiary mt-0.5">
            Every image uploaded to R2, newest first.
          </p>
        </div>
        <button
          onClick={load}
          disabled={status === 'loading'}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary hover:bg-surface-2 disabled:opacity-50"
        >
          {status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-txt-secondary mb-5">
        <span><strong className="text-txt-primary">{count.toLocaleString()}</strong> images</span>
        <span><strong className="text-txt-primary">{uploaders.toLocaleString()}</strong> uploaders</span>
        <span><strong className="text-txt-primary">{formatBytes(totalBytes)}</strong> stored</span>
        {capped && <span className="text-amber-500">Showing the first 5,000 (more exist)</span>}
      </div>

      {status === 'error' && (
        <div className="rounded-lg border border-surface-4 bg-surface-2 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {status === 'ready' && images.length === 0 && (
        <div className="text-center text-txt-tertiary py-16 text-sm">No images uploaded yet.</div>
      )}

      {groups.map((g) => (
        <div key={g.uid} className="mb-8">
          <div className="flex items-center gap-2 mb-2 sticky top-0 z-10 py-1" style={{ background: 'var(--surface-1)' }}>
            <h2 className="text-sm font-semibold text-txt-primary font-mono break-all">{g.uid}</h2>
            <span className="text-xs text-txt-tertiary">({g.images.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {g.images.map((img) => (
              <a
                key={img.key}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-md overflow-hidden border border-surface-4 bg-surface-2 hover:border-surface-5"
                title={`${formatWhen(img.lastModified)} · ${formatBytes(img.size)}`}
              >
                <div className="aspect-video bg-surface-3 overflow-hidden">
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:opacity-90"
                  />
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 text-[10px] text-txt-tertiary">
                  <span>{formatWhen(img.lastModified)}</span>
                  <span>{formatBytes(img.size)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
