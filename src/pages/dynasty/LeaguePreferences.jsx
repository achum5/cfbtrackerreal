import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
import { useToast } from '../../components/ui/Toast'
import { getEffectiveCharacters } from '../../data/socialModel'
import SocialCharacterEditModal from '../../components/SocialCharacterEditModal'
import { readClipboardImageAsFile } from '../../utils/clipboardImage'
import { uploadImage } from '../../utils/imageUpload'

/**
 * League Preferences — dynasty-wide settings. First section: Social Media
 * Universe customization (edit a specific account, or mass-edit many at once).
 */

const PAGE_SIZE = 40

function initials(name) {
  const parts = String(name || '').replace(/^@/, '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Avatar({ c, size = 36 }) {
  return (
    <div className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, background: c.avatar ? 'transparent' : (c.color || '#657786'), color: '#fff', fontWeight: 700, fontSize: 12 }}>
      {c.avatar ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : initials(c.displayName)}
    </div>
  )
}

const inputCls = 'rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm p-2 focus:outline-none focus:ring-2 focus:ring-surface-5'

export default function LeaguePreferences() {
  const { currentDynasty, loadSocial, saveSocialCharacters, importSocialUniverse, isViewOnly } = useDynasty()
  const { toast } = useToast()
  const pathPrefix = usePathPrefix()
  const fileRef = useRef(null)

  const [ready, setReady] = useState(false)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')      // all | national | team | conference
  const [teamFilter, setTeamFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(() => new Set())
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)

  // Bulk-edit fields (only applied when set)
  const [bulkVerified, setBulkVerified] = useState('')  // '' | 'yes' | 'no'
  const [bulkColorOn, setBulkColorOn] = useState(false)
  const [bulkColor, setBulkColor] = useState('#1d9bf0')
  const [bulkPersonality, setBulkPersonality] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!currentDynasty?.id) return
    let alive = true
    loadSocial(currentDynasty.id).then(() => alive && setReady(true)).catch(() => alive && setReady(true))
    return () => { alive = false }
  }, [currentDynasty?.id, loadSocial])

  const characters = useMemo(() => getEffectiveCharacters(currentDynasty), [currentDynasty, ready])

  const teamOptions = useMemo(() => {
    const teams = currentDynasty?.teams || {}
    return Object.values(teams)
      .filter(t => t && !t.isFCS && t.abbr && t.name)
      .map(t => ({ tid: Number(t.tid), name: t.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [currentDynasty?.teams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = Object.values(characters).filter(c => {
      if (kind !== 'all' && c.kind !== kind) return false
      if (teamFilter !== 'all' && Number(c.teamTid) !== Number(teamFilter)) return false
      if (q && !(`${c.displayName} ${c.handle} ${c.category} ${c.role}`.toLowerCase().includes(q))) return false
      return true
    })
    list.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
    return list
  }, [characters, search, kind, teamFilter])

  // Reset to page 0 whenever the filter set changes.
  useEffect(() => { setPage(0) }, [search, kind, teamFilter])

  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const selectAllFiltered = () => setSelected(new Set(filtered.map(c => c.id)))
  const clearSelection = () => setSelected(new Set())

  const editingChar = editingId ? characters[editingId] : null

  // Per-row "paste image from clipboard" — same resolution + upload path as the
  // editor's paste button, written straight into avatar/bannerImage so photos
  // can be mass-entered without opening each account. `pasting` holds the key
  // `${id}:${field}` of the row+slot currently uploading.
  const [pasting, setPasting] = useState(null)
  const pasteImageInto = async (c, field) => {
    if (isViewOnly) { toast.error('Read-only mode.'); return }
    if (pasting) return
    const key = `${c.id}:${field}`
    setPasting(key)
    try {
      const result = await readClipboardImageAsFile()
      if (!result.ok) {
        if (result.reason === 'denied') toast.error('Browser blocked clipboard access. Open Edit and use the drop zone instead.')
        else if (result.reason === 'auth_url') toast.error('That link needs login to load. Save the image and use the editor to upload.')
        else if (result.reason === 'fetch_failed') { console.error('Clipboard URL fetch failed:', result.error); toast.error("Couldn't fetch that image. Save it and use the editor.") }
        else toast.error('Nothing image-like in the clipboard.')
        return
      }
      const url = await uploadImage(result.file)
      const base = characters[c.id]
      if (!base) { toast.error('Account not found.'); return }
      await saveSocialCharacters(currentDynasty.id, { [c.id]: { ...base, [field]: url, customized: true } })
      toast.success(`${field === 'avatar' ? 'Profile photo' : 'Cover photo'} set for ${base.displayName}.`)
    } catch (err) {
      console.error('[LeaguePreferences] paste image failed:', err)
      toast.error(`Could not set image: ${err?.message || 'Unknown error'}`)
    } finally {
      setPasting(null)
    }
  }

  const applyBulk = async () => {
    if (isViewOnly) { toast.error('Read-only mode.'); return }
    if (selected.size === 0) return
    const hasChange = bulkVerified || bulkColorOn || bulkPersonality.trim() || bulkCategory.trim()
    if (!hasChange) { toast.error('Set at least one field to apply.'); return }
    setApplying(true)
    try {
      const map = {}
      for (const id of selected) {
        const base = characters[id]
        if (!base) continue
        const rec = { ...base, customized: true }
        if (bulkVerified) rec.verified = bulkVerified === 'yes'
        if (bulkColorOn) rec.color = bulkColor
        if (bulkCategory.trim()) rec.category = bulkCategory.trim()
        if (bulkPersonality.trim()) {
          rec.personality = (base.personality ? base.personality.trim() + ' ' : '') + bulkPersonality.trim()
        }
        map[id] = rec
      }
      await saveSocialCharacters(currentDynasty.id, map)
      toast.success(`Updated ${Object.keys(map).length} accounts.`)
      clearSelection()
      setBulkVerified(''); setBulkColorOn(false); setBulkPersonality(''); setBulkCategory('')
    } catch (err) {
      console.error('[LeaguePreferences] bulk apply failed:', err)
      toast.error(`Could not apply: ${err?.message || 'Unknown error'}`)
    } finally {
      setApplying(false)
    }
  }

  const handleExport = async () => {
    const json = JSON.stringify(Object.values(getEffectiveCharacters(currentDynasty)), null, 2)
    const filename = `social-universe-${String(currentDynasty.name || currentDynasty.id || 'dynasty').replace(/\s+/g, '-')}.json`
    // Prefer a native "Save As" dialog so the user picks the location.
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(json)
        await writable.close()
        return
      } catch (err) {
        if (err?.name === 'AbortError') return // user cancelled the dialog
        // any other error → fall through to the download fallback
      }
    }
    // Fallback (browsers without the File System Access API).
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || isViewOnly) return
    let arr
    try { arr = JSON.parse(await file.text()) } catch { toast.error('That file is not valid JSON.'); return }
    if (!Array.isArray(arr)) { toast.error('Expected a JSON array of accounts.'); return }
    if (!window.confirm(`Import ${arr.length} accounts? This REPLACES this dynasty's entire social universe.`)) return
    try {
      const res = await importSocialUniverse(currentDynasty.id, arr)
      setSelected(new Set())
      toast.success(`Imported ${res.count} accounts${res.skipped ? `, skipped ${res.skipped}` : ''}.`)
    } catch (err) {
      console.error('[LeaguePreferences] import failed:', err)
      toast.error(`Import failed: ${err?.message || 'error'}`)
    }
  }

  if (!currentDynasty) return null

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-display-md text-txt-primary m-0">League Preferences</h1>
        <p className="text-txt-secondary text-sm mt-1">Dynasty-wide customization.</p>
      </div>

      <section className="rounded-xl border border-surface-4 overflow-hidden" style={{ background: 'var(--surface-1)' }}>
        <div className="px-4 py-3 border-b border-surface-4 flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-bold text-txt-primary m-0">Social Media Universe</h2>
            <p className="text-xs text-txt-tertiary mt-0.5">{Object.keys(characters).length.toLocaleString()} accounts. Edit one, or select many to mass-edit.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isViewOnly && (
              <button onClick={() => setCreating(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}>+ New account</button>
            )}
            <button onClick={handleExport} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary">Export</button>
            {!isViewOnly && (
              <>
                <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary">Import</button>
                <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-surface-4">
          <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Search name, handle, role…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All kinds</option>
            <option value="national">National</option>
            <option value="team">Team</option>
            <option value="conference">Conference</option>
          </select>
          <select className={inputCls} value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">All teams</option>
            {teamOptions.map(t => <option key={t.tid} value={t.tid}>{t.name}</option>)}
          </select>
        </div>

        {/* Selection / bulk bar */}
        {!isViewOnly && (
          <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-b border-surface-4 text-xs">
            <button onClick={selectAllFiltered} className="px-2 py-1 rounded border border-surface-4 text-txt-secondary hover:text-txt-primary">Select all {filtered.length}</button>
            {selected.size > 0 && <button onClick={clearSelection} className="px-2 py-1 rounded border border-surface-4 text-txt-secondary hover:text-txt-primary">Clear</button>}
            <span className="text-txt-tertiary">{selected.size} selected</span>
          </div>
        )}

        {selected.size > 0 && !isViewOnly && (
          <div className="px-4 py-3 border-b border-surface-4 bg-surface-2/40 space-y-2">
            <div className="text-xs font-semibold text-txt-secondary">Mass edit {selected.size} accounts — only set fields are applied</div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={inputCls} value={bulkVerified} onChange={(e) => setBulkVerified(e.target.value)}>
                <option value="">Verified: no change</option>
                <option value="yes">Set verified</option>
                <option value="no">Set not verified</option>
              </select>
              <label className="flex items-center gap-1.5 text-sm text-txt-secondary">
                <input type="checkbox" checked={bulkColorOn} onChange={(e) => setBulkColorOn(e.target.checked)} className="w-4 h-4" style={{ accentColor: 'var(--text-primary)' }} />
                Color
                <input type="color" value={bulkColor} onChange={(e) => setBulkColor(e.target.value)} disabled={!bulkColorOn} className="w-8 h-7 rounded bg-transparent border border-surface-4" />
              </label>
              <input className={`${inputCls} w-40`} placeholder="Set category…" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} />
            </div>
            <input className={`${inputCls} w-full`} placeholder="Append to personality (e.g. 'Always uses ALL CAPS.')" value={bulkPersonality} onChange={(e) => setBulkPersonality(e.target.value)} />
            <button onClick={applyBulk} disabled={applying} className="px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}>
              {applying ? 'Applying…' : `Apply to ${selected.size}`}
            </button>
          </div>
        )}

        {/* List */}
        <div>
          {pageItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-txt-tertiary text-sm">{ready ? 'No accounts match.' : 'Loading…'}</div>
          ) : pageItems.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-4">
              {!isViewOnly && (
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 flex-shrink-0" style={{ accentColor: 'var(--text-primary)' }} />
              )}
              <Link to={`${pathPrefix}/social/${encodeURIComponent(c.id)}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                <Avatar c={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-txt-primary truncate group-hover:underline">{c.displayName}</span>
                    {c.verified && <span className="text-[10px]" style={{ color: '#1d9bf0' }}>✓</span>}
                    {c.customized && <span className="text-[9px] px-1 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>edited</span>}
                  </div>
                  <div className="text-xs text-txt-tertiary truncate">{c.handle} · {c.category || c.role || c.kind}</div>
                </div>
              </Link>
              {c.xUrl && (
                <a href={c.xUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="px-3 py-1 rounded-lg text-xs font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary flex-shrink-0">X</a>
              )}
              {!isViewOnly && (
                <button
                  onClick={() => pasteImageInto(c, 'avatar')}
                  disabled={!!pasting}
                  title="Paste profile photo from clipboard and upload"
                  className="px-3 py-1 rounded-lg text-xs font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary flex-shrink-0 disabled:opacity-50"
                >
                  {pasting === `${c.id}:avatar` ? 'Uploading…' : 'Paste PFP'}
                </button>
              )}
              {!isViewOnly && (
                <button
                  onClick={() => pasteImageInto(c, 'bannerImage')}
                  disabled={!!pasting}
                  title="Paste cover photo from clipboard and upload"
                  className="px-3 py-1 rounded-lg text-xs font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary flex-shrink-0 disabled:opacity-50"
                >
                  {pasting === `${c.id}:bannerImage` ? 'Uploading…' : 'Paste Cover'}
                </button>
              )}
              {!isViewOnly && (
                <button onClick={() => setEditingId(c.id)} className="px-3 py-1 rounded-lg text-xs font-semibold border border-surface-4 text-txt-secondary hover:text-txt-primary flex-shrink-0">Edit</button>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-txt-tertiary text-xs">{filtered.length.toLocaleString()} results · page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 rounded border border-surface-4 text-txt-secondary disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded border border-surface-4 text-txt-secondary disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </section>

      {editingChar && (
        <SocialCharacterEditModal isOpen={!!editingChar} onClose={() => setEditingId(null)} character={editingChar} />
      )}
      {creating && (
        <SocialCharacterEditModal isOpen={creating} onClose={() => setCreating(false)} character={{}} />
      )}
    </div>
  )
}
