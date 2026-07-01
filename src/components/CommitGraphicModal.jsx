import { useState } from 'react'
import { createPortal } from 'react-dom'
import ImageUpload from './ImageUpload'
import { getContrastTextColor } from '../utils/colorUtils'

// Per-recruit commitment graphic (Hayes-Fawcett-style). Shows the uploaded
// graphic if there is one, lets the user upload/replace it, and offers a
// ready-made AI prompt + a link to ChatGPT to generate one.
const CHATGPT_URL = 'https://chatgpt.com'

function buildGraphicPrompt({ name, position, stars, school }) {
  const s = Number(stars) || 0
  const starText = s > 0 ? `${s}-star ` : ''
  const pos = position || 'ATH'
  return `Create a college football recruiting commitment announcement graphic for ${name}, a ${starText}${pos} who has committed to ${school}.

Make it look like the polished commitment graphics Hayes Fawcett posts on X/Twitter: bold, clean, modern sports-media style. Prominently feature:
- the player's full name: ${name}
- their star rating${s > 0 ? ` (${s} stars)` : ''}
- their position: ${pos}
- the school they committed to: ${school}

Use ${school}'s team colors, leave a clean space to drop in the player's photo, and make it high-resolution and shareable.`
}

export default function CommitGraphicModal({
  isOpen,
  onClose,
  recruit,
  schoolName,
  graphicUrl,
  onSave,
  canEdit = true,
  accent = '#1f2937',
}) {
  const [copied, setCopied] = useState(false)
  if (!isOpen || !recruit) return null

  const accentText = getContrastTextColor(accent)
  const prompt = buildGraphicPrompt({
    name: recruit.name || 'the player',
    position: recruit.position,
    stars: recruit.stars,
    school: schoolName || 'the school',
  })

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = prompt
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="card-elevated w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-surface-4">
          <div className="min-w-0">
            <div className="display-md text-txt-primary truncate">{recruit.name || 'Recruit'}</div>
            <div className="label-xs text-txt-tertiary tracking-widest" style={{ letterSpacing: '1.5px' }}>
              Commit Graphic
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-surface-3 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Generate row — copy the prompt, then open ChatGPT to make the image. */}
          {canEdit && (
            <div className="rounded-lg border border-surface-4 bg-surface-2/50 p-3">
              <p className="text-xs text-txt-secondary leading-relaxed mb-3">
                No graphic yet? Copy the prompt, open ChatGPT to generate one, then upload it below.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="h-9 px-3 rounded-md text-sm font-semibold transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
                >
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>
                <a
                  href={CHATGPT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 inline-flex items-center rounded-md text-sm font-semibold border border-surface-5 text-txt-primary hover:bg-surface-3 transition-colors"
                >
                  Open ChatGPT
                </a>
              </div>
            </div>
          )}

          {/* The graphic itself */}
          {canEdit ? (
            <div>
              <span className="label-sm text-txt-secondary mb-2 block">Graphic</span>
              <ImageUpload
                value={graphicUrl || ''}
                onChange={(url) => onSave(url || '')}
                teamColors={{ primary: accent, secondary: accentText }}
              />
              <p className="label-xs text-txt-muted mt-2">
                Upload the image or paste a URL. It shows up on this recruit's commit card.
              </p>
            </div>
          ) : graphicUrl ? (
            <img src={graphicUrl} alt={`${recruit.name} commit graphic`} className="w-full rounded-lg" />
          ) : (
            <p className="text-sm text-txt-tertiary text-center py-6">No commit graphic yet.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-surface-4 bg-surface-2 flex items-center justify-between gap-3">
          {canEdit && graphicUrl ? (
            <button
              type="button"
              onClick={() => onSave('')}
              className="text-sm font-semibold text-txt-tertiary hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold transition-colors press"
            style={{ backgroundColor: accent, color: accentText }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
