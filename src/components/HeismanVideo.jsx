import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildHeismanEmbedUrl, normalizeVideoUrl } from '../utils/heismanVideo'

// Heisman Trophy presentation video: one play button, one player, one
// editor. The button is meant to sit INSIDE other clickable things (award
// cards that are links, the player masthead plates), so it swallows the
// click before the parent sees it.

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
 * Play button that opens the presentation in a modal.
 * Renders nothing when the URL can't be embedded.
 *
 * Props: url, year (for the modal title), size 'xs' | 'sm' | 'md',
 * className / style (merged onto the button), tone 'gold' | 'muted'.
 */
export function HeismanPlayButton({ url, year, size = 'sm', className = '', style, tone = 'gold', title }) {
  const [open, setOpen] = useState(false)
  const embed = buildHeismanEmbedUrl(url)
  if (!embed) return null
  const s = SIZES[size] || SIZES.sm
  const color = tone === 'gold' ? '#fbbf24' : 'var(--text-tertiary)'
  const label = title || `Watch the ${year ? `${year} ` : ''}Heisman presentation`
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-80 ${s.btn} ${className}`}
        style={{ color, ...style }}
        title={label}
        aria-label={label}
      >
        {PLAY_ICON(s.icon)}
      </button>
      {open && (
        <HeismanVideoModal isOpen={open} onClose={() => setOpen(false)} url={url} year={year} />
      )}
    </>
  )
}

/** Full-screen-ish player. Standard modal backdrop; Escape closes. */
export function HeismanVideoModal({ isOpen, onClose, url, year }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])
  if (!isOpen) return null
  const embed = buildHeismanEmbedUrl(url)
  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={(e) => { e.stopPropagation(); onClose?.() }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="card-elevated w-full max-w-4xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-surface-4">
          <div className="flex flex-col min-w-0">
            <span className="label-xs text-txt-tertiary">Heisman Trophy</span>
            <h2 className="text-base sm:text-lg font-bold text-txt-primary tracking-tight truncate">
              {year ? `${year} ` : ''}Presentation
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-txt-tertiary hover:text-txt-primary transition-colors -mr-1 p-1.5 rounded-md hover:bg-surface-2 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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
              This link can't be embedded.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Small editor for the URL — used by the Awards page card so the link can
 * be attached after the awards were pasted (or synced, for PC dynasties).
 * onSave(url) receives the trimmed string; '' removes it.
 */
export function HeismanVideoUrlModal({ isOpen, onClose, initialUrl = '', year, onSave }) {
  const [value, setValue] = useState(initialUrl || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (isOpen) setValue(initialUrl || '') }, [isOpen, initialUrl])
  if (!isOpen) return null
  const trimmed = normalizeVideoUrl(value)
  const playable = !trimmed || !!buildHeismanEmbedUrl(trimmed)
  const submit = async (url) => {
    setSaving(true)
    try { await onSave?.(url) ; onClose?.() } finally { setSaving(false) }
  }
  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={(e) => { e.stopPropagation(); onClose?.() }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="card-elevated w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <span className="label-xs text-txt-tertiary">Heisman Trophy</span>
        <h2 className="text-lg font-bold text-txt-primary tracking-tight mb-1">{year ? `${year} ` : ''}Presentation video</h2>
        <p className="text-xs text-txt-tertiary mb-3">
          Paste a YouTube link to the ceremony. A play button appears wherever this winner is shown.
        </p>
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && playable) submit(trimmed) }}
          placeholder="https://youtu.be/..."
          autoFocus
          className="w-full rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-surface-5"
        />
        {!playable && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--accent-warning)' }}>
            That link doesn't look like a video we can embed.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {initialUrl && (
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
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-surface-4 text-txt-secondary hover:text-txt-primary hover:border-surface-5 transition-colors bg-transparent"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !playable}
              onClick={() => submit(trimmed)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
