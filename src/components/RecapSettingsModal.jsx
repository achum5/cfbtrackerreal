import { createPortal } from 'react-dom'
import { RECAP_DEPTH_OPTIONS } from '../services/geminiService'

/**
 * Recap Settings — Voice + Length sliders for the game recap prompt, plus an
 * optional "generate social posts" toggle (count) that bakes a social block
 * into the same prompt. Compact: labels + sliders only, no long blurbs.
 */
export default function RecapSettingsModal({
  isOpen,
  onClose,
  perspectiveOptions,
  perspective,
  onPerspectiveChange,
  depth,
  onDepthChange,
  // Social (optional)
  socialEnabled,
  onSocialEnabledChange,
  socialCount,
  onSocialCountChange,
}) {
  if (!isOpen) return null

  const perspIdx = Math.max(0, perspectiveOptions.findIndex(p => p.key === perspective))
  const currentPersp = perspectiveOptions[perspIdx] || perspectiveOptions[Math.floor(perspectiveOptions.length / 2)]
  const depthIdx = Math.max(0, RECAP_DEPTH_OPTIONS.findIndex(d => d.key === depth))
  const currentDepth = RECAP_DEPTH_OPTIONS[depthIdx] || RECAP_DEPTH_OPTIONS[5]

  const sectionLabel = { fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }
  const showSocial = typeof onSocialEnabledChange === 'function'

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-[10001] p-4"
      style={{ margin: 0, backgroundColor: 'rgba(0,0,0,0.65)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-5)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--surface-4)' }}>
          <span className="font-bold" style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Recap Settings</span>
          <button type="button" aria-label="Close" onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-surface-3" style={{ color: 'var(--text-tertiary)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Voice */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span style={sectionLabel}>Voice</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{currentPersp.label}</span>
            </div>
            <input type="range" min={0} max={perspectiveOptions.length - 1} step={1} value={perspIdx}
              onChange={(e) => onPerspectiveChange(perspectiveOptions[Number(e.target.value)].key)} className="w-full" />
            <div className="flex justify-between mt-1" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              <span className="max-w-[80px] leading-tight">{perspectiveOptions[0]?.label}</span>
              <span className="max-w-[80px] text-right leading-tight">{perspectiveOptions[perspectiveOptions.length - 1]?.label}</span>
            </div>
          </div>

          {/* Length */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span style={sectionLabel}>Length</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                {currentDepth.label}{currentDepth.wordTarget ? ` · ${currentDepth.wordTarget} words` : ''}
              </span>
            </div>
            <input type="range" min={0} max={RECAP_DEPTH_OPTIONS.length - 1} step={1} value={depthIdx}
              onChange={(e) => onDepthChange(RECAP_DEPTH_OPTIONS[Number(e.target.value)].key)} className="w-full" />
            <div className="flex justify-between mt-1" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              <span>{RECAP_DEPTH_OPTIONS[0].label}</span>
              <span>{RECAP_DEPTH_OPTIONS[RECAP_DEPTH_OPTIONS.length - 1].label}</span>
            </div>
          </div>

          {/* Social */}
          {showSocial && (
            <div style={{ borderTop: '1px solid var(--surface-4)', paddingTop: '12px' }}>
              <label className="flex items-center justify-between cursor-pointer">
                <span style={sectionLabel}>Generate social posts</span>
                <input type="checkbox" checked={!!socialEnabled} onChange={(e) => onSocialEnabledChange(e.target.checked)} className="w-4 h-4" style={{ accentColor: 'var(--text-primary)' }} />
              </label>
              {socialEnabled && (
                <div className="flex items-center gap-2 mt-2">
                  <input type="number" min="1" max="60" value={socialCount} onChange={(e) => onSocialCountChange(e.target.value)}
                    className="w-16 rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm p-1.5 focus:outline-none" />
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>posts about this game, in the same response</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
