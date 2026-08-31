import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { auth } from '../../config/firebase'
import { compressImageBlob } from '../../utils/imageUpload'

// Admin-only view of every image uploaded to R2 across all users.
// The server endpoint (api/admin/list-images) enforces the same admin
// allowlist, so a non-admin who reached this route gets nothing back.
//
// The server walks the bucket metadata-only and returns accurate totals plus a
// single page of rows, so the counts describe the whole bucket while the DOM
// only ever holds one page.

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

const DEFAULT_SETTINGS = {
  quality: 0.72,   // WebP quality — matches the upload-time default
  maxDim: 1600,    // max image dimension in px — matches the upload-time default
}

const QUALITY_PRESETS = [
  { label: 'Low (0.70)', value: 0.70 },
  { label: 'Default (0.72)', value: 0.72 },
  { label: 'Medium (0.80)', value: 0.80 },
  { label: 'High (0.90)', value: 0.90 },
  { label: 'Max (0.95)', value: 0.95 },
]

const MAX_DIM_PRESETS = [
  { label: '1280 px', value: 1280 },
  { label: '1600 px (default)', value: 1600 },
  { label: '1920 px', value: 1920 },
  { label: '2560 px', value: 2560 },
]

const PAGE_SIZES = [50, 100, 200, 500]

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'largest', label: 'Largest first' },
  { value: 'smallest', label: 'Smallest first' },
]

const MIN_SIZE_PRESETS = [
  { label: 'Any size', value: 0 },
  { label: 'Over 100 KB', value: 100 },
  { label: 'Over 500 KB', value: 500 },
  { label: 'Over 1 MB', value: 1024 },
  { label: 'Over 2 MB', value: 2048 },
]

const selectCls = 'bg-surface-2 border border-surface-4 rounded-md px-2 py-1.5 text-sm text-txt-primary'
const btnCls = 'px-3 py-1.5 rounded-md text-sm font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent'

export default function ImageGallery() {
  const { isAdmin } = useAuth()

  // ---- Query state (what we ask the server for) ----
  const [query, setQuery] = useState({
    uid: '',           // '' = all uploaders
    sort: 'newest',
    page: 1,
    pageSize: 100,
    minSizeKB: 0,
    before: '',        // yyyy-mm-dd — uploaded strictly before this date
  })
  const setQ = (patch) => setQuery((q) => ({
    ...q,
    ...patch,
    // Any change other than paging returns to page 1, or you land on an
    // out-of-range page of a set you just narrowed.
    page: patch.page != null ? patch.page : 1,
  }))

  const [state, setState] = useState({
    status: 'idle',
    images: [],
    page: 1, pageSize: 100, totalPages: 1, rangeStart: 0, rangeEnd: 0,
    filtered: { count: 0, bytes: 0 },
    overall: { count: 0, bytes: 0, uploaders: 0 },
    uploaders: [],
    truncated: false,
    error: null,
  })

  const requestBody = useCallback((extra = {}) => ({
    uid: query.uid || undefined,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
    minSizeKB: query.minSizeKB || undefined,
    before: query.before || undefined,
    ...extra,
  }), [query])

  // Guards against an older in-flight request finishing last and overwriting a
  // newer one's results — easy to trigger by clicking through pages quickly.
  const reqSeq = useRef(0)
  // The uploader list only comes back on the all-users walk. Held in a ref so
  // `load` can carry it forward without depending on the state it also sets,
  // which would otherwise re-create the callback on every load and re-fire the
  // effect that calls it.
  const uploadersRef = useRef([])

  const load = useCallback(async () => {
    const seq = ++reqSeq.current
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Not signed in')
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/api/admin/list-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody()),
      })
      if (!res.ok) {
        const info = await res.json().catch(() => ({}))
        throw new Error(info?.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      if (seq !== reqSeq.current) return // a newer request already won
      const nextUploaders = (data.uploaders && data.uploaders.length) ? data.uploaders : uploadersRef.current
      uploadersRef.current = nextUploaders
      setState({
        status: 'ready',
        images: data.images || [],
        page: data.page || 1,
        pageSize: data.pageSize || query.pageSize,
        totalPages: data.totalPages || 1,
        rangeStart: data.rangeStart || 0,
        rangeEnd: data.rangeEnd || 0,
        filtered: data.filtered || { count: 0, bytes: 0 },
        overall: data.overall || { count: 0, bytes: 0, uploaders: 0 },
        // The uploader list is only meaningful for the all-users walk; keep the
        // previous one when a per-user view returns just that user.
        uploaders: nextUploaders,
        truncated: !!data.truncated,
        error: null,
      })
    } catch (err) {
      if (seq !== reqSeq.current) return
      setState((s) => ({ ...s, status: 'error', error: err.message || 'Failed to load' }))
    }
  }, [requestBody, query.pageSize])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  // ---- Settings ----
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const setSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }))

  // ---- Recompression ----
  const [recompress, setRecompress] = useState({ running: false, done: 0, total: 0, savedBytes: 0, skipped: 0, failed: 0 })
  const cancelRef = useRef(false)
  const [imgStatus, setImgStatus] = useState({})

  // ---- Multi-select (Ctrl+click / Shift+click), scoped to the current page ----
  const [selected, setSelected] = useState(() => new Set())
  const anchorRef = useRef(null)
  useEffect(() => { setSelected(new Set()); anchorRef.current = null }, [state.page, state.pageSize, query.uid, query.sort, query.minSizeKB, query.before])

  // ---- Full-screen viewer ----
  const [lightbox, setLightbox] = useState(null)
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const recompressOneImg = useCallback(async (img, opts = {}) => {
    const quality = opts.quality ?? settings.quality
    const maxDim = opts.maxDim ?? settings.maxDim

    const resp = await fetch(img.url, { cache: 'no-store' })
    if (!resp.ok) throw new Error(`fetch ${resp.status}`)
    const blob = await resp.blob()

    const out = await compressImageBlob(blob, { quality, maxDim })

    // Only overwrite if meaningfully smaller
    if (!out || out.size >= img.size * 0.9) return { saved: 0, skipped: true }

    const user = auth.currentUser
    if (!user) throw new Error('Not signed in')
    const token = await user.getIdToken()
    const presign = await fetch(`${API_BASE}/api/admin/reupload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key: img.key, contentType: out.type || 'image/webp' }),
    })
    if (!presign.ok) {
      const info = await presign.json().catch(() => ({}))
      throw new Error(info?.error || `presign ${presign.status}`)
    }
    const { uploadUrl, headers } = await presign.json()
    const put = await fetch(uploadUrl, { method: 'PUT', body: out, headers })
    if (!put.ok) throw new Error(`put ${put.status}`)
    return { saved: img.size - out.size, skipped: false }
  }, [settings.quality, settings.maxDim])

  // Shared worker pool for every bulk run.
  const runBatch = useCallback(async (list, { trackPerImage }) => {
    cancelRef.current = false
    setRecompress({ running: true, done: 0, total: list.length, savedBytes: 0, skipped: 0, failed: 0 })
    let next = 0, done = 0, savedBytes = 0, skipped = 0, failed = 0
    const CONCURRENCY = 2
    const worker = async () => {
      for (;;) {
        if (cancelRef.current) return
        const i = next++
        if (i >= list.length) return
        const img = list[i]
        if (trackPerImage) setImgStatus((s) => ({ ...s, [img.key]: 'running' }))
        try {
          const r = await recompressOneImg(img)
          if (r.skipped) skipped++
          savedBytes += r.saved || 0
          if (trackPerImage) setImgStatus((s) => ({ ...s, [img.key]: r.skipped ? 'skipped' : `done:${r.saved}` }))
        } catch {
          failed++
          if (trackPerImage) setImgStatus((s) => ({ ...s, [img.key]: 'failed' }))
        }
        done++
        setRecompress({ running: true, done, total: list.length, savedBytes, skipped, failed })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
    setRecompress((s) => ({ ...s, running: false }))
    load()
  }, [recompressOneImg, load])

  const compressSingle = useCallback(async (img) => {
    setImgStatus((s) => ({ ...s, [img.key]: 'running' }))
    try {
      const r = await recompressOneImg(img)
      setImgStatus((s) => ({ ...s, [img.key]: r.skipped ? 'skipped' : `done:${r.saved}` }))
    } catch {
      setImgStatus((s) => ({ ...s, [img.key]: 'failed' }))
    }
  }, [recompressOneImg])

  // Bulk over EVERY image matching the current filters, not just this page —
  // fetches the full matching key list first so the run isn't silently
  // limited to what happens to be on screen.
  const compressMatching = useCallback(async () => {
    if (recompress.running) return
    const parts = []
    if (query.uid) parts.push(`uploader ${query.uid}`)
    if (query.minSizeKB) parts.push(`over ${formatBytes(query.minSizeKB * 1024)}`)
    if (query.before) parts.push(`uploaded before ${query.before}`)
    const scope = parts.length ? parts.join(', ') : 'all uploaders, all sizes, all dates'

    if (!window.confirm(
      `Recompress every image matching:\n  ${scope}\n\n` +
      `That's ${state.filtered.count.toLocaleString()} images (${formatBytes(state.filtered.bytes)}) across all pages, not just this one.\n\n` +
      `Each is overwritten in place at quality=${settings.quality}, max ${settings.maxDim}px. URLs stay the same — nothing in your dynasties breaks.`
    )) return

    setState((s) => ({ ...s, status: 'loading' }))
    let list = []
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Not signed in')
      const token = await user.getIdToken()
      const res = await fetch(`${API_BASE}/api/admin/list-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody({ mode: 'keysOnly' })),
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      list = (await res.json()).images || []
    } catch (err) {
      setState((s) => ({ ...s, status: 'error', error: err.message || 'Failed to collect images' }))
      return
    }
    setState((s) => ({ ...s, status: 'ready' }))
    await runBatch(list, { trackPerImage: false })
  }, [recompress.running, query, state.filtered, settings, requestBody, runBatch])

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-txt-primary">Image Gallery</h1>
        <p className="text-txt-tertiary mt-2">Not authorized.</p>
      </div>
    )
  }

  const { status, images, page, totalPages, rangeStart, rangeEnd, filtered, overall, uploaders, truncated, error } = state

  const orderedKeys = images.map((i) => i.key)
  const imgByKey = new Map(images.map((i) => [i.key, i]))
  const selectedImgs = [...selected].map((k) => imgByKey.get(k)).filter(Boolean)
  const selectedBytes = selectedImgs.reduce((s, i) => s + (i.size || 0), 0)

  const onTileClick = (img, e) => {
    e.preventDefault()
    const key = img.key
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setLightbox(img)
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (e.shiftKey && anchorRef.current) {
        const a = orderedKeys.indexOf(anchorRef.current)
        const b = orderedKeys.indexOf(key)
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          for (let i = lo; i <= hi; i++) next.add(orderedKeys[i])
        } else {
          next.add(key)
        }
      } else {
        next.has(key) ? next.delete(key) : next.add(key)
        anchorRef.current = key
      }
      return next
    })
  }

  const compressSelected = async () => {
    if (!selectedImgs.length || recompress.running) return
    if (!window.confirm(`Recompress ${selectedImgs.length} selected images in place at quality=${settings.quality}, max ${settings.maxDim}px?`)) return
    await runBatch(selectedImgs, { trackPerImage: true })
  }

  const goto = (p) => setQuery((q) => ({ ...q, page: Math.min(Math.max(1, p), totalPages) }))
  const isFiltered = !!(query.uid || query.minSizeKB || query.before)

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-16">
      {/* ── Header + totals ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Image Gallery</h1>
          <p className="text-sm text-txt-tertiary mt-0.5">Every image uploaded to R2.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings((v) => !v)} className={`${btnCls} ${showSettings ? 'text-txt-primary bg-surface-2' : ''}`}>
            Settings
          </button>
          <button onClick={load} disabled={status === 'loading'} className={btnCls}>
            {status === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label={query.uid ? 'Images (this uploader)' : 'Total images'} value={overall.count.toLocaleString()} />
        <Stat label={query.uid ? 'Space (this uploader)' : 'Total space'} value={formatBytes(overall.bytes)} />
        <Stat label="Uploaders" value={(uploaders.length || overall.uploaders || 0).toLocaleString()} />
        <Stat
          label={isFiltered ? 'Matching filters' : 'Showing'}
          value={isFiltered ? `${filtered.count.toLocaleString()} · ${formatBytes(filtered.bytes)}` : `${rangeStart}–${rangeEnd}`}
          accent={isFiltered}
        />
      </div>

      {truncated && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 mb-4">
          This bucket is larger than the walk limit, so totals count the first 200,000 objects. Narrow by uploader for exact per-user numbers.
        </div>
      )}

      {/* ── View controls ───────────────────────────────────────── */}
      <div className="rounded-lg border border-surface-4 bg-surface-2 p-3 mb-3 flex flex-wrap items-end gap-3">
        <Field label="View">
          <select value={query.uid} onChange={(e) => setQ({ uid: e.target.value })} className={`${selectCls} max-w-[15rem]`}>
            <option value="">All uploaders</option>
            {uploaders.map((u) => (
              <option key={u.uid} value={u.uid}>{u.uid} — {u.count.toLocaleString()} · {formatBytes(u.bytes)}</option>
            ))}
          </select>
        </Field>
        <Field label="Sort">
          <select value={query.sort} onChange={(e) => setQ({ sort: e.target.value })} className={selectCls}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Per page">
          <select value={query.pageSize} onChange={(e) => setQ({ pageSize: Number(e.target.value) })} className={selectCls}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Size">
          <select value={query.minSizeKB} onChange={(e) => setQ({ minSizeKB: Number(e.target.value) })} className={selectCls}>
            {MIN_SIZE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Uploaded before">
          <input type="date" value={query.before} onChange={(e) => setQ({ before: e.target.value })} className={selectCls} />
        </Field>
        {isFiltered && (
          <button onClick={() => setQ({ uid: '', minSizeKB: 0, before: '' })} className={btnCls}>Clear filters</button>
        )}
      </div>

      {/* ── Bulk actions ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={recompress.running ? () => { cancelRef.current = true } : compressMatching}
          disabled={status !== 'ready' || filtered.count === 0}
          className={`${btnCls} ${recompress.running ? 'text-amber-300 border-amber-500/50' : ''}`}
          title="Recompress every image matching the current filters, across all pages"
        >
          {recompress.running
            ? `Stop (${recompress.done}/${recompress.total})`
            : `Recompress ${filtered.count.toLocaleString()} matching`}
        </button>
        {selected.size > 0 && (
          <>
            <button onClick={compressSelected} disabled={recompress.running} className={btnCls}>
              Compress {selected.size} selected ({formatBytes(selectedBytes)})
            </button>
            <button onClick={() => setSelected(new Set())} className={btnCls}>Clear selection</button>
          </>
        )}
        {(recompress.done > 0 || recompress.savedBytes > 0) && (
          <span className="text-xs text-txt-tertiary">
            {recompress.done}/{recompress.total} · saved {formatBytes(recompress.savedBytes)}
            {recompress.skipped > 0 && ` · ${recompress.skipped} already small`}
            {recompress.failed > 0 && ` · ${recompress.failed} failed`}
          </span>
        )}
      </div>

      {showSettings && (
        <div className="rounded-lg border border-surface-4 bg-surface-2 p-3 mb-3 flex flex-wrap items-end gap-3">
          <Field label="Quality">
            <select value={settings.quality} onChange={(e) => setSetting('quality', Number(e.target.value))} className={selectCls}>
              {QUALITY_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Max dimension">
            <select value={settings.maxDim} onChange={(e) => setSetting('maxDim', Number(e.target.value))} className={selectCls}>
              {MAX_DIM_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <p className="text-xs text-txt-tertiary max-w-md">
            An image is only overwritten when the re-encode comes out at least 10% smaller, so running this twice costs nothing the second time.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-surface-4 bg-surface-2 p-4 text-sm text-red-400">{error}</div>
      )}

      {status === 'ready' && images.length === 0 && (
        <div className="text-center text-txt-tertiary py-16 text-sm">
          {isFiltered ? 'No images match these filters.' : 'No images uploaded yet.'}
        </div>
      )}

      {status === 'ready' && images.length > 0 && selected.size === 0 && (
        <p className="text-xs text-txt-tertiary mb-3">
          Click an image to view it full screen. Ctrl/Cmd-click to select, or Shift-click another to select everything in between.
        </p>
      )}

      {/* ── Grid (current page only) ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {images.map((img) => {
          const st = imgStatus[img.key]
          const isSel = selected.has(img.key)
          return (
            <div
              key={img.key}
              onClick={(e) => onTileClick(img, e)}
              className={`relative rounded-md overflow-hidden border bg-surface-2 cursor-pointer select-none ${isSel ? 'border-blue-500 ring-2 ring-blue-500' : 'border-surface-4 hover:border-surface-5'}`}
            >
              <div className="aspect-video bg-surface-3 overflow-hidden">
                <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover pointer-events-none" />
              </div>
              {isSel && <div className="absolute inset-0 bg-blue-500/20 pointer-events-none" />}
              <div className="flex items-center justify-between px-1.5 py-1 text-[10px] text-txt-tertiary gap-1">
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate hover:text-txt-primary hover:underline underline-offset-2"
                  title={`${img.uid} · open full image in a new tab`}
                >{formatWhen(img.lastModified)}</a>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span>{formatBytes(img.size)}</span>
                  {st === 'running' ? (
                    <span className="text-txt-tertiary">…</span>
                  ) : st?.startsWith('done:') ? (
                    <span className="text-green-500">-{formatBytes(Number(st.slice(5)))}</span>
                  ) : st === 'skipped' ? (
                    <span className="text-txt-tertiary">ok</span>
                  ) : st === 'failed' ? (
                    <span className="text-red-400">err</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); compressSingle(img) }}
                      disabled={recompress.running}
                      className="text-txt-tertiary hover:text-txt-primary underline underline-offset-2 disabled:opacity-30"
                      title="Compress this image"
                    >
                      compress
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {status === 'ready' && filtered.count > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button onClick={() => goto(1)} disabled={page <= 1} className={btnCls}>First</button>
          <button onClick={() => goto(page - 1)} disabled={page <= 1} className={btnCls}>Prev</button>
          <span className="text-sm text-txt-secondary px-2 tabular-nums">
            Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            <span className="text-txt-tertiary"> · {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {filtered.count.toLocaleString()}</span>
          </span>
          <button onClick={() => goto(page + 1)} disabled={page >= totalPages} className={btnCls}>Next</button>
          <button onClick={() => goto(totalPages)} disabled={page >= totalPages} className={btnCls}>Last</button>
        </div>
      )}

      {/* ── Full-screen viewer ──────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-4"
          style={{ margin: 0 }}
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.url}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={{ boxShadow: '0 8px 60px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 px-3 py-1.5 rounded-lg text-sm font-semibold bg-surface-2/80 border border-surface-4 text-txt-secondary hover:text-txt-primary hover:bg-surface-2"
          >
            Close
          </button>
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-surface-2/80 border border-surface-4 text-xs text-txt-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{formatWhen(lightbox.lastModified)}</span>
            <span className="text-txt-tertiary">{formatBytes(lightbox.size)}</span>
            <span className="text-txt-tertiary font-mono truncate max-w-[16rem]">{lightbox.uid}</span>
            <a href={lightbox.url} target="_blank" rel="noopener noreferrer" className="hover:text-txt-primary underline underline-offset-2">
              open original
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'border-blue-500/40 bg-blue-500/5' : 'border-surface-4 bg-surface-2'}`}>
      <div className="text-[10px] uppercase tracking-wider text-txt-tertiary">{label}</div>
      <div className="text-lg font-bold text-txt-primary tabular-nums mt-0.5 break-words">{value}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-txt-tertiary">{label}</span>
      {children}
    </label>
  )
}
