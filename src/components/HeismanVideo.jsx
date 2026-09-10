import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildHeismanEmbedUrl, normalizeVideoUrl } from '../utils/heismanVideo'

// Heisman Trophy presentation video: one play button, one modal.
//
// The button is meant to sit INSIDE other clickable things (award cards that
// are links, the player masthead plates), so it swallows the click before the
// parent sees it.
//
// The modal is both the player and the editor:
//   • video saved      → plays it, with a pencil in the header (when the
//                        caller passed onSave) to swap or remove the link
//   • no video, can edit → the paste-a-link form
//   • no video, no edit  → the button isn't rendered at all
//
// So the card needs exactly one affordance — the play button — and never a
// second "Add video" control competing with the award title for space.

const PLAY_ICON = (cls) => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const SIZES = {
  xs: { btn: 'p-0.5', icon: 'w-3.5 h-3.5' },
  sm: { btn: 'p-1', icon: 'w-4 h-4' },
  md: { btn: 'p-1.5', icon: 'w-6 h-6' },
}

/**
 * Play button that opens the presentation modal.
 *
 * Renders when there's a playable video OR when `onSave` is given (the
 * caller can attach one) — an empty button on a card whose viewer can't
 * edit would be a dead end, so read-only surfaces pass no onSave and the
 * button simply doesn't appear without a video.
 *
 * Props: url, year (modal title), onSave(url) — omit to make it view-only,
 * size 'xs' | 'sm' | 'md', className / style, tone 'gold' | 'muted'.
 */
export function HeismanPlayButton({ url, year, onSave, size = 'sm', className = '', style, tone = 'gold', title }) {
  const [open, setOpen] = useState(false)
  const hasVideo = !!buildHeismanEmbedUrl(url)
  if (!hasVideo && !onSave) return null
  const s = SIZES[size] || SIZES.sm
  const color = tone === 'gold' ? '#fbbf24' : 'var(--text-tertiary)'
  const label = title || (hasVideo
    ? `Watch the ${year ? `${year} ` : ''}Heisman presentation`
    : `Add the ${year ? `${year} ` : ''}Heisman presentation video`)
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-80 ${s.btn} ${className}`}
        // Without a video the button is a quieter invitation, not a promise
        // that something will play.
        style={{ color, ...(hasVideo ? null : { opacity: 0.5 }), ...style }}
        title={label}
        aria-label={label}
      >
        {PLAY_ICON(s.icon)}
      </button>
      {open && (
        <HeismanVideoModal
          isOpen={open}
          onClose={() => setOpen(false)}
          url={url}
          year={year}
          onSave={onSave}
        />
      )}
    </>
  )
}

const PENCIL_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

/**
 * The presentation modal. Plays the saved video, or — when `onSave` is given
 * — lets the user paste a link (no video yet) or edit the saved one (pencil
 * in the header). Escape closes. Standard modal backdrop.
 */
export function HeismanVideoModal({ isOpen, onClose, url, year, onSave }) {
  const canEdit = typeof onSave === 'function'
  // What we just saved, so the video plays the instant it's saved instead of
  // waiting for the dynasty write to round-trip back through the `url` prop
  // (which would flash the "can't be embedded" state in between).
  const [justSaved, setJustSaved] = useState(null)
  const activeUrl = justSaved !== null ? justSaved : url
  const embed = buildHeismanEmbedUrl(activeUrl)
  // Editing whenever there's nothing to play (and we're allowed to fix that).
  const [editing, setEditing] = useState(!embed && canEdit)
  const [value, setValue] = useState(url || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setJustSaved(null)
      return
    }
    setValue(activeUrl || '')
    setEditing(!embed && canEdit)
  }, [isOpen, activeUrl, embed, canEdit])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const trimmed = normalizeVideoUrl(value)
  const playable = !trimmed || !!buildHeismanEmbedUrl(trimmed)
  const submit = async (next) => {
    setSaving(true)
    try {
      await onSave?.(next)
      setJustSaved(next)
      // Removing the video leaves nothing to play, so stay on the form.
      if (next) setEditing(false)
      else { setValue(''); setEditing(true) }
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={(e) => { e.stopPropagation(); onClose?.() }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`card-elevated w-full overflow-hidden ${editing ? 'max-w-md' : 'max-w-4xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-surface-4">
          <div className="flex flex-col min-w-0">
            <span className="label-xs text-txt-tertiary">Heisman Trophy</span>
            <h2 className="text-base sm:text-lg font-bold text-txt-primary tracking-tight truncate">
              {year ? `${year} ` : ''}Presentation
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Pencil — always available while a video is playing, so the
                link can be swapped or removed without hunting for a control
                out on the card. */}
            {canEdit && embed && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit the presentation video link"
                title="Edit video link"
                className="text-txt-tertiary hover:text-txt-primary transition-colors p-1.5 rounded-md hover:bg-surface-2"
              >
                {PENCIL_ICON}
              </button>
            )}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-txt-tertiary hover:text-txt-primary transition-colors -mr-1 p-1.5 rounded-md hover:bg-surface-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {editing ? (
          <div className="p-5">
            <p className="text-xs text-txt-tertiary mb-3">
              Paste a YouTube link to the ceremony. A play button appears wherever this winner is shown.
            </p>
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && playable && trimmed) submit(trimmed) }}
              placeholder="https://youtu.be/..."
              autoFocus
              className="w-full rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-surface-5"
            />
            {!playable && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--accent-warning)' }}>
                That link doesn&apos;t look like a video we can embed.
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                {embed && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => submit('')}
                    className="text-xs text-txt-tertiary hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    Remove video
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (embed ? setEditing(false) : onClose?.())}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-surface-4 text-txt-secondary hover:text-txt-primary hover:border-surface-5 transition-colors bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !playable || !trimmed}
                  onClick={() => submit(trimmed)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-black" style={{ aspectRatio: '16 / 9' }}>
            {embed ? (
              <iframe
                src={embed}
                title={`${year ? `${year} ` : ''}Heisman Trophy presentation`}
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-txt-tertiary">
                This link can&apos;t be embedded.
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
