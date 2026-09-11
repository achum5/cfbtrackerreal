import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PasteEntrySteps from './PasteEntrySteps'
import { useToast } from './Toast'
import FormattedRecap from '../FormattedRecap'

/**
 * The shared shell for every "copy a prompt, run it in your AI, paste the
 * prose back" modal: week recaps, the Week 1 preview, the playoff preview.
 * All three were separate copies of the same screen and had drifted — the
 * Week 1 preview still had its own pair of plain Copy/Paste buttons while the
 * other two had moved to the three-step Copy prompt → Send to your AI →
 * Paste it back row. One component now owns the chrome, the steps, the
 * paste-into-a-review-box behavior, and the footer, so they cannot drift
 * again.
 *
 * The shell owns the draft box, the manual-paste toggle and the saving flag.
 * Callers own the prompt, what saving means, and their own toasts.
 *
 * Props:
 *   isOpen, onClose
 *   eyebrow, title        header text
 *   prompt                string, or a () => string PasteEntrySteps calls on copy
 *   hasPrompt             false when there is nothing to generate yet (shows `notice` only)
 *   notice                node rendered above everything (e.g. "bracket isn't locked yet")
 *   intro                 node: the line under "AI Prompt"
 *   promptHeaderRight     node placed opposite the "AI Prompt" label
 *   beforeSteps           node between the intro and the step row
 *   afterSteps            node under the "Last saved" line (e.g. a staleness warning)
 *   copyLeading           node joined to the left of the Copy button (e.g. a settings gear)
 *   hints                 PasteEntrySteps hint overrides
 *   saved                 { text, generatedAt } to show instead of the generate
 *                         flow, with a Regenerate link. Omit for a modal that
 *                         always generates (the week recap).
 *   lastSavedAt           timestamp for the "Last saved" line
 *   onSave(text)          async; throw to keep the draft box open
 *   saveLabel             button text (default "Save")
 *   manualNote            node under the draft box
 *   onDelete, deleteLabel footer delete button (omitted when onDelete is absent)
 *   disabled              read-only mode
 */
export default function PromptProseModal({
  isOpen,
  onClose,
  eyebrow,
  title,
  prompt,
  hasPrompt = true,
  notice = null,
  intro = null,
  promptHeaderRight = null,
  beforeSteps = null,
  afterSteps = null,
  copyLeading = null,
  hints = {},
  saved = null,
  lastSavedAt = null,
  onSave,
  saveLabel = 'Save',
  manualNote = null,
  onDelete = null,
  deleteLabel = 'Delete',
  disabled = false,
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft('')
    setShowManual(false)
    setRegenerating(false)
  }, [isOpen, title])

  // Step 3 drops the AI's reply into the VISIBLE box so the user can see it
  // landed, then saves on their click. Reading the clipboard can be blocked
  // (mobile Safari especially); on failure the box opens for a hand paste.
  const handlePasteFill = async () => {
    if (disabled) { toast.error('Read-only mode, cannot save.'); return }
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      setShowManual(true)
      toast.error('Clipboard blocked — paste into the box below, then Save.')
      return
    }
    if (!text.trim()) {
      setShowManual(true)
      toast.error('Clipboard is empty — copy the AI\'s full reply first.')
      return
    }
    setDraft(text)
    setShowManual(true)
    toast.success(`Pasted — review below and hit ${saveLabel}.`)
  }

  const handleSave = async () => {
    if (disabled) { toast.error('Read-only mode, cannot save.'); return }
    const trimmed = (draft || '').trim()
    if (!trimmed) { toast.error('Nothing to save — copy the AI output first.'); return }
    setSaving(true)
    try {
      await onSave?.(trimmed)
    } catch {
      // The caller has already surfaced the failure; keep the draft visible.
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const showSaved = saved?.text && !regenerating
  const savedStamp = lastSavedAt ?? saved?.generatedAt

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] py-8 px-4 sm:p-4 modal-backdrop-in"
      style={{ margin: 0 }}
      onMouseDown={(e) => { e.stopPropagation(); onClose() }}
    >
      <div
        className="card-elevated w-full sm:w-[min(880px,95vw)] max-h-[calc(100dvh-4rem)] sm:max-h-[88vh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-surface-4">
          <div className="flex flex-col min-w-0">
            <span className="label-xs text-txt-tertiary">{eyebrow}</span>
            <h2 className="text-xl sm:text-2xl font-bold text-txt-primary tracking-tight truncate">{title}</h2>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-txt-tertiary hover:text-txt-primary transition-colors -mr-1 p-1.5 rounded-md hover:bg-surface-2 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {notice}

          {showSaved ? (
            <section className="space-y-3">
              <FormattedRecap text={saved.text} />
              <p className="text-xs text-txt-tertiary">
                Saved {savedStamp ? new Date(savedStamp).toLocaleString() : ''}
              </p>
            </section>
          ) : hasPrompt ? (
            <>
              <section>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <label className="text-sm font-semibold text-txt-primary">AI Prompt</label>
                  {promptHeaderRight}
                </div>
                {intro && <p className="text-xs text-txt-tertiary">{intro}</p>}
                {beforeSteps}
              </section>

              <section className="space-y-3">
                <PasteEntrySteps
                  aiPrompt={prompt}
                  onPaste={handlePasteFill}
                  showText={showManual}
                  onToggleText={() => setShowManual(v => !v)}
                  disabled={saving || disabled}
                  copyEmoji={null}
                  labels={{ copy: 'Copy prompt', copyButton: 'Copy prompt', paste: 'Paste it back' }}
                  hints={hints}
                  copyLeading={copyLeading}
                />

                <div className="text-xs text-txt-tertiary text-center">
                  {savedStamp ? `Last saved ${new Date(savedStamp).toLocaleString()}` : 'Not saved yet'}
                </div>

                {afterSteps}

                {showManual && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-full h-44 rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm font-sans p-3 resize-y focus:outline-none focus:ring-2 focus:ring-surface-5"
                      placeholder="Paste the AI's full output here, then Save. Markdown is supported."
                    />
                    {manualNote && <p className="text-xs text-txt-tertiary">{manualNote}</p>}
                    <button
                      onClick={handleSave}
                      disabled={saving || !draft.trim() || disabled}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
                    >
                      {saving ? 'Saving…' : saveLabel}
                    </button>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>

        <div className="border-t border-surface-4 px-5 sm:px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            {showSaved && (
              <button
                onClick={() => setRegenerating(true)}
                className="text-xs text-txt-tertiary hover:text-txt-primary transition-colors"
              >
                Regenerate
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={saving}
                className="text-xs text-txt-tertiary hover:text-red-400 transition-colors disabled:opacity-50"
              >
                {deleteLabel}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-surface-4 text-txt-secondary hover:text-txt-primary hover:border-surface-5 transition-colors bg-transparent"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
