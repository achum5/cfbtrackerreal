import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty } from '../context/DynastyContext'
import { useToast } from './ui/Toast'
import ImageUpload from './ImageUpload'
import { getEffectiveCharacters } from '../data/socialModel'

/**
 * Edit one social character. Edits are saved as a per-dynasty OVERRIDE on top
 * of the bundled universe (origin stays, customized flips true), so they never
 * touch the shared base and survive re-imports. Renames are safe because posts
 * reference the stable character id, not the handle.
 */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-txt-secondary">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputCls = 'w-full rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm p-2 focus:outline-none focus:ring-2 focus:ring-surface-5'

export default function SocialCharacterEditModal({ isOpen, onClose, character, onSaved }) {
  const { currentDynasty, saveSocialCharacters, isViewOnly } = useDynasty()
  const { toast } = useToast()
  const isNew = !character?.id
  const [f, setF] = useState(() => ({
    displayName: character?.displayName || '',
    handle: character?.handle || '',
    teamTid: character?.teamTid != null ? String(character.teamTid) : '',
    personality: character?.personality || '',
    bio: character?.bio || '',
    category: character?.category || '',
    location: character?.location || '',
    website: character?.website || '',
    joinedLabel: character?.joinedLabel || '',
    followerCount: character?.followerCount || 0,
    followingCount: character?.followingCount || 0,
    color: character?.color || '#1d9bf0',
    verified: !!character?.verified,
    avatar: character?.avatar || null,
    bannerImage: character?.bannerImage || null,
  }))
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const teamOptions = useMemo(() => Object.values(currentDynasty?.teams || {})
    .filter(t => t && !t.isFCS && t.abbr && t.name)
    .map(t => ({ tid: Number(t.tid), name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name)), [currentDynasty?.teams])

  if (!isOpen || !character) return null

  const normalizeHandle = (h) => {
    const s = String(h || '').trim()
    return s ? (s.startsWith('@') ? s : '@' + s) : ''
  }

  const handleSave = async () => {
    if (isViewOnly) { toast.error('Read-only mode.'); return }
    if (!currentDynasty) return
    const handle = normalizeHandle(f.handle)
    if (!handle) { toast.error('Handle is required.'); return }
    if (!f.displayName.trim()) { toast.error('Name is required.'); return }
    setSaving(true)
    try {
      const teamTid = f.teamTid ? Number(f.teamTid) : null
      const kind = teamTid ? 'team' : (character?.kind && character.kind !== 'team' ? character.kind : 'national')

      // For a new account, derive a unique id from the handle.
      let id = character?.id
      if (isNew) {
        const slug = handle.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '') || `acct${Date.now().toString(36)}`
        const existing = getEffectiveCharacters(currentDynasty)
        id = slug
        let n = 2
        while (existing[id]) id = `${slug}_${n++}`
      }

      const record = {
        ...character,
        id,
        kind,
        teamTid,
        displayName: f.displayName.trim(),
        handle,
        personality: f.personality,
        bio: f.bio,
        category: f.category,
        location: f.location,
        website: f.website || null,
        joinedLabel: f.joinedLabel,
        followerCount: Number(f.followerCount) || 0,
        followingCount: Number(f.followingCount) || 0,
        color: f.color || '#1d9bf0',
        verified: !!f.verified,
        avatar: f.avatar || null,
        bannerImage: f.bannerImage || null,
        origin: character?.origin || 'user',
        customized: true,
      }
      await saveSocialCharacters(currentDynasty.id, { [id]: record })
      toast.success(isNew ? 'Account created.' : 'Profile saved.')
      onSaved?.(record)
      onClose?.()
    } catch (err) {
      console.error('[SocialCharacterEditModal] save failed:', err)
      const detail = err?.code ? `${err.code}: ${err.message}` : (err?.message || 'Unknown error')
      toast.error(`Could not save: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[10001] py-8 px-4 sm:p-4"
      style={{ margin: 0 }}
      onMouseDown={(e) => { e.stopPropagation(); onClose() }}
    >
      <div
        className="card-elevated w-full sm:w-[min(640px,95vw)] max-h-[calc(100dvh-4rem)] sm:max-h-[88vh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-4">
          <h2 className="text-lg font-bold text-txt-primary">{isNew ? 'New account' : 'Edit profile'}</h2>
          <button aria-label="Close" onClick={onClose} className="text-txt-tertiary hover:text-txt-primary p-1.5 rounded-md hover:bg-surface-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Images — same uploader used everywhere else in the app */}
          <Field label="Avatar">
            <ImageUpload value={f.avatar || ''} onChange={(url) => set('avatar', url || null)} placeholder="Paste image (Ctrl+V), drop a file, or enter a URL..." />
          </Field>
          <Field label="Banner">
            <ImageUpload value={f.bannerImage || ''} onChange={(url) => set('bannerImage', url || null)} placeholder="Paste image (Ctrl+V), drop a file, or enter a URL..." />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={f.displayName} onChange={(e) => set('displayName', e.target.value)} /></Field>
            <Field label="Handle"><input className={inputCls} value={f.handle} onChange={(e) => set('handle', e.target.value)} placeholder="@handle" /></Field>
          </div>

          <Field label="Team affiliation (optional — leave as National for a non-team account)">
            <select className={inputCls} value={f.teamTid} onChange={(e) => set('teamTid', e.target.value)}>
              <option value="">National (no team)</option>
              {teamOptions.map(t => <option key={t.tid} value={t.tid}>{t.name}</option>)}
            </select>
          </Field>

          <Field label="Personality (how this account posts — fed to the AI)">
            <textarea className={`${inputCls} h-20 resize-y`} value={f.personality} onChange={(e) => set('personality', e.target.value)} />
          </Field>

          <Field label="Bio (shown on the profile)">
            <textarea className={`${inputCls} h-16 resize-y`} value={f.bio} onChange={(e) => set('bio', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><input className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)} /></Field>
            <Field label="Location"><input className={inputCls} value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
            <Field label="Website"><input className={inputCls} value={f.website || ''} onChange={(e) => set('website', e.target.value)} /></Field>
            <Field label="Joined"><input className={inputCls} value={f.joinedLabel} onChange={(e) => set('joinedLabel', e.target.value)} placeholder="Joined March 2016" /></Field>
            <Field label="Followers"><input type="number" className={inputCls} value={f.followerCount} onChange={(e) => set('followerCount', e.target.value)} /></Field>
            <Field label="Following"><input type="number" className={inputCls} value={f.followingCount} onChange={(e) => set('followingCount', e.target.value)} /></Field>
          </div>

          <div className="flex items-center gap-4">
            <Field label="Accent color">
              <div className="flex items-center gap-2">
                <input type="color" value={f.color} onChange={(e) => set('color', e.target.value)} className="w-10 h-8 rounded bg-transparent border border-surface-4 cursor-pointer" />
                <input className={`${inputCls} w-28`} value={f.color} onChange={(e) => set('color', e.target.value)} />
              </div>
            </Field>
            <label className="flex items-center gap-2 cursor-pointer mt-5">
              <input type="checkbox" checked={f.verified} onChange={(e) => set('verified', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: 'var(--text-primary)' }} />
              <span className="text-sm text-txt-secondary">Verified</span>
            </label>
          </div>
        </div>

        <div className="border-t border-surface-4 px-5 py-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-surface-4 text-txt-secondary hover:text-txt-primary bg-transparent">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || isViewOnly}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
