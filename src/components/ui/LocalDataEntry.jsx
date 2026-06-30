import { useState } from 'react'
import Button from './Button'
import { useToast } from './Toast'

/**
 * LocalDataEntry — the universal "no Google Sheet needed" data-entry panel.
 *
 * This is the DEFAULT ingest path for every sheet/AI modal. The flow, top to
 * bottom, mirrors how the user actually works:
 *
 *   1. Copy AI Prompt              (white button, top)
 *   2. ▾ How to get your data      (collapsed help — screenshot instructions)
 *   3. Paste AI output here  [Paste ▾]   (white Paste button with an attached
 *                              arrow that reveals the raw text box)
 *   4. Import                      (parses the pasted TSV and saves)
 *   …  Use Google Sheet instead    (escape hatch to the legacy Sheets flow)
 *
 * The AI prompts already emit tab-separated values, and `splitTsv` turns a
 * pasted reply into the SAME rows[][] the Google readers consume — so each
 * modal's `onImport(text)` reuses its existing parser. No sheet, no OAuth.
 *
 * Props:
 *   aiPrompt      — string copied by the Copy AI Prompt button.
 *   onImport(text)— async; parse + save the pasted text. Throws on failure.
 *   onUseGoogle   — switch to the Google Sheets flow.
 *   onCancel      — close without importing (optional).
 *   importLabel   — primary button text (default "Import").
 *   busy          — external disable (e.g. a parent save in flight).
 *   instructions  — override the default screenshot how-to copy.
 *   children      — optional extra content rendered above the action row
 *                   (e.g. a live preview grid).
 */

const DEFAULT_INSTRUCTIONS = `Take screenshots of the data you want to enter here. It doesn't have to be exact, just clear and fully showing. Upload those along with the copied prompt to your AI platform of choice. It will return a TSV output — copy that, then paste it below.`

export default function LocalDataEntry({
  aiPrompt,
  onImport,
  onUseGoogle,
  onCancel,
  importLabel = 'Import',
  busy = false,
  instructions = DEFAULT_INSTRUCTIONS,
  children = null,
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showText, setShowText] = useState(false)
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt || '')
    } catch {
      // Clipboard API blocked (iframe / http / permissions) — fall back.
      const ta = document.createElement('textarea')
      ta.value = aiPrompt || ''
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setShowText(true)
      toast.error('Your browser blocks clipboard reads. Tap the arrow and paste into the text box.')
      return
    }
    try {
      const clip = await navigator.clipboard.readText()
      if (!clip || !clip.trim()) {
        toast.error('Clipboard is empty. Copy the AI reply first.')
        return
      }
      setText(clip)
      setShowText(true)
    } catch {
      setShowText(true)
      toast.error('Could not read the clipboard. Tap the arrow and paste into the text box.')
    }
  }

  const handleImport = async () => {
    if (!text.trim()) {
      setShowText(true)
      toast.error('Paste the AI output first.')
      return
    }
    setImporting(true)
    try {
      await onImport(text)
      // The parent closes/advances on success; toast there if it wants to.
    } catch (error) {
      console.error('Local import failed:', error)
      toast.error(error?.message || 'Could not import. Check the pasted output and try again.')
    } finally {
      setImporting(false)
    }
  }

  const disabled = busy || importing

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-0.5">
        {/* 1. Copy AI Prompt */}
        <div>
          <button
            type="button"
            onClick={copyPrompt}
            disabled={!aiPrompt}
            className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
          >
            {copied ? 'Copied!' : 'Copy AI Prompt'}
          </button>
        </div>

        {/* 2. Collapsible how-to */}
        <div className="rounded-lg border border-surface-4 bg-surface-2/50">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-txt-secondary hover:text-txt-primary"
          >
            <svg
              className={`w-4 h-4 flex-shrink-0 transition-transform ${showHelp ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            How to get your data
          </button>
          {showHelp && (
            <p className="px-3 pb-3 pt-0 text-xs text-txt-tertiary leading-relaxed">
              {instructions}
            </p>
          )}
        </div>

        {/* 3. Paste AI output + reveal-textarea arrow (both white) */}
        <div>
          <p className="label-xs text-txt-tertiary mb-1.5" style={{ letterSpacing: '1px' }}>Paste AI output here</p>
          <div className="inline-flex rounded-md overflow-hidden border border-surface-5">
            <button
              type="button"
              onClick={pasteFromClipboard}
              disabled={disabled}
              className="px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
            >
              Paste
            </button>
            <button
              type="button"
              onClick={() => setShowText((v) => !v)}
              title={showText ? 'Hide text box' : 'Show text box'}
              aria-label={showText ? 'Hide text box' : 'Show text box'}
              aria-pressed={showText}
              className="px-2 flex items-center justify-center transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)', borderLeft: '1px solid var(--surface-1)' }}
            >
              <svg className={`w-4 h-4 transition-transform ${showText ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {showText && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the AI's TSV reply here."
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              rows={6}
              className="mt-2 w-full rounded-md border border-surface-5 bg-surface-2 p-2 text-sm font-mono text-txt-primary resize-y focus:outline-none focus:ring-2 focus:ring-surface-5"
            />
          )}
        </div>

        {children}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-3">
        <Button variant="ghost" size="sm" onClick={onUseGoogle} disabled={disabled}>Use Google Sheet instead</Button>
        <div className="flex gap-2">
          {onCancel && <Button variant="secondary" size="sm" onClick={onCancel} disabled={disabled}>Cancel</Button>}
          <Button variant="primary" size="sm" onClick={handleImport} disabled={disabled || !text.trim()}>
            {importing ? 'Importing…' : importLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
