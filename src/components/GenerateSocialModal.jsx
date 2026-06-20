import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDynasty } from '../context/DynastyContext'
import { useToast } from './ui/Toast'
import { buildSocialPrompt } from '../utils/socialPrompt'
import {
  extractSocialBlock, parseSocialLines, resolveSocialPosts, buildHandleIndex, getEffectiveCharacters,
} from '../data/socialModel'

/**
 * Generate Social Feed — copy/paste flow, decoupled from the Week Recap so the
 * recap stays light and this can run on a heavy model. The user copies the
 * prompt, pastes the AI's `cfb-social` block back, and we parse it into posts.
 * Supports multiple pastes (continuations merge/dedupe) for big 300+ weeks.
 */
export default function GenerateSocialModal({ isOpen, onClose, year, week }) {
  const { currentDynasty, loadSocial, saveSocialPosts, replaceSocialWeek, isViewOnly } = useDynasty()
  const { toast } = useToast()
  const yearNum = Number(year)
  const weekNum = Number(week)
  const promptRef = useRef(null)
  const loadedFor = useRef(null)

  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [addedThisSession, setAddedThisSession] = useState(0)

  // Lazy-load the social data (characters + feed) when the modal opens, so the
  // prompt roster and the parser's handle index are populated.
  useEffect(() => {
    if (!isOpen || !currentDynasty?.id) return
    const key = `${currentDynasty.id}:${yearNum}:${weekNum}`
    if (loadedFor.current === key) return
    loadedFor.current = key
    setDraft('')
    setAddedThisSession(0)
    loadSocial(currentDynasty.id).catch(() => {})
  }, [isOpen, currentDynasty?.id, yearNum, weekNum, loadSocial])

  const { prompt, gameTagMap, gameCount } = useMemo(() => {
    if (!currentDynasty) return { prompt: '', gameTagMap: {}, gameCount: 0 }
    return buildSocialPrompt(currentDynasty, yearNum, weekNum)
  }, [currentDynasty, yearNum, weekNum])

  const existingWeekCount = useMemo(() => {
    const wk = currentDynasty?.socialFeedByYear?.[yearNum]?.[weekNum]
    return Array.isArray(wk) ? wk.length : 0
  }, [currentDynasty?.socialFeedByYear, yearNum, weekNum])

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(prompt)
      else if (promptRef.current) { promptRef.current.select(); document.execCommand('copy') }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the text and copy manually.')
    }
  }

  const handleParse = async () => {
    if (isViewOnly) { toast.error('Read-only mode, cannot save.'); return }
    const text = draft.trim()
    if (!text) { toast.error('Paste the AI response first.'); return }
    const { found, body } = extractSocialBlock(text)
    if (!found) { toast.error('No cfb-social block found in the pasted text.'); return }
    const lines = parseSocialLines(body)
    if (!lines.length) { toast.error('No valid post lines found in the block.'); return }

    setBusy(true)
    try {
      const charactersById = getEffectiveCharacters(currentDynasty)
      const handleIndex = buildHandleIndex(charactersById)
      const { posts, newCharacters } = resolveSocialPosts({
        lines, year: yearNum, week: weekNum, gameTagMap,
        handleIndex, charactersById, teamsById: currentDynasty.teams || {},
        now: () => Date.now(),
      })
      if (!posts.length) {
        toast.error('Could not resolve any posts (unknown handles / teams).')
        return
      }
      const total = await saveSocialPosts(currentDynasty.id, yearNum, weekNum, posts, newCharacters)
      setAddedThisSession(c => c + posts.length)
      setDraft('')
      toast.success(`Added ${posts.length} ${posts.length === 1 ? 'post' : 'posts'} (week total: ${total}).`)
    } catch (err) {
      console.error('[GenerateSocialModal] parse/save failed:', err)
      const detail = err?.code ? `${err.code}: ${err.message}` : (err?.message || 'Unknown error')
      toast.error(`Could not save: ${detail}`)
    } finally {
      setBusy(false)
    }
  }

  if (!isOpen) return null

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
            <span className="label-xs text-txt-tertiary">Social Feed</span>
            <h2 className="text-xl sm:text-2xl font-bold text-txt-primary tracking-tight truncate">
              Generate {yearNum} Week {weekNum} Social
            </h2>
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
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-txt-primary">AI Prompt</label>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
              >
                {copied ? 'Copied!' : 'Copy prompt'}
              </button>
            </div>
            <textarea
              ref={promptRef}
              readOnly
              value={prompt}
              className="w-full h-44 rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-xs font-mono p-3 resize-none focus:outline-none focus:ring-2 focus:ring-surface-5"
            />
            <p className="text-xs text-txt-tertiary mt-1">
              Covers {gameCount} {gameCount === 1 ? 'game' : 'games'} this week. Big weeks produce a lot of posts — use a strong model. If the response gets cut off, paste the rest and parse again; duplicates are ignored.
            </p>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-y-1">
              <label className="text-sm font-semibold text-txt-primary">Paste the AI response</label>
              <span className="text-xs text-txt-tertiary">
                {existingWeekCount} saved this week{addedThisSession > 0 ? ` (+${addedThisSession} just now)` : ''}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full h-56 rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm font-mono p-3 resize-y focus:outline-none focus:ring-2 focus:ring-surface-5"
              placeholder="Paste the AI's full response. We pull out the cfb-social block automatically."
            />
            <p className="text-xs text-txt-tertiary mt-1">
              Paste the whole response — only the fenced cfb-social block is read.
            </p>
          </section>
        </div>

        <div className="border-t border-surface-4 px-5 sm:px-6 py-4 flex gap-2 items-center justify-between">
          {!isViewOnly && existingWeekCount > 0 ? (
            <button
              onClick={async () => {
                if (!window.confirm(`Delete all ${existingWeekCount} social posts this week? This cannot be undone.`)) return
                try { await replaceSocialWeek(currentDynasty.id, yearNum, weekNum, []) } catch (e) { console.error('clear social failed', e) }
              }}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-red-700/40 text-red-400 hover:bg-red-900/20"
            >
              Delete all
            </button>
          ) : <span />}
          <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-surface-4 text-txt-secondary hover:text-txt-primary hover:border-surface-5 transition-colors bg-transparent"
          >
            Close
          </button>
          <button
            onClick={handleParse}
            disabled={busy || !draft.trim() || isViewOnly}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)' }}
          >
            {busy ? 'Adding…' : 'Add posts'}
          </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
