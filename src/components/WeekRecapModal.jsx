import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { useToast } from './ui/Toast'
import PromptProseModal from './ui/PromptProseModal'
import { buildWeekRecapPrompt, buildPreseasonRecapPrompt } from '../utils/recapPrompts'
import { socialGameTagMap } from '../utils/socialPrompt'
import { extractRecapBlock } from '../utils/recapText'
import {
  extractSocialBlock, parseSocialLines, resolveSocialPosts, buildHandleIndex,
  getEffectiveCharacters, ensureUniverseLoaded, DEFAULT_SOCIAL_SETTINGS,
} from '../data/socialModel'

/**
 * A Week Recap: the user copies a fully-data-bundled prompt, pastes it into
 * their AI of choice, then pastes the AI's narrative back here and saves. The
 * screen is PromptProseModal, shared with the Week 1 preview and the playoff
 * preview so all three offer the identical three-step row.
 *
 * Recaps live at `dynasty.weekRecapsByYear[year][week] = { generatedAt, text }`.
 * Week -1 stores the preseason preview and uses the preseason prompt variant.
 *
 * Props:
 *   isOpen, onClose
 *   year   — number; the season being recapped
 *   week   — number; the week being recapped (use -1 for preseason preview)
 *   onSaved — optional callback fired with the saved text after a successful save
 */
export default function WeekRecapModal({ isOpen, onClose, year, week, onSaved }) {
  const { currentDynasty, saveWeekRecap, deleteWeekRecap, isViewOnly, loadSocial, saveSocialPosts, updateSocialSettings } = useDynasty()
  const { toast } = useToast()
  const yearNum = Number(year)
  const weekNum = Number(week)
  const isPreseason = weekNum === -1
  // Social is baked into the recap for regular-season weeks (two-in-one).
  const isRegularWeek = weekNum >= 0 && weekNum <= 15

  const existingRecap = currentDynasty?.weekRecapsByYear?.[yearNum]?.[weekNum]
  const [includeSocial, setIncludeSocial] = useState(currentDynasty?.socialSettings?.enabled !== false)

  const socialSettings = useMemo(
    () => ({ ...DEFAULT_SOCIAL_SETTINGS, ...(currentDynasty?.socialSettings || {}) }),
    [currentDynasty?.socialSettings],
  )

  // Local string state so the user can backspace / type freely without the
  // value snapping back while the field is mid-edit. We commit on blur.
  const [perGameStr, setPerGameStr] = useState(String(socialSettings.postsPerGame ?? 1))
  const [nationalStr, setNationalStr] = useState(String(socialSettings.nationalCount ?? 50))

  // Keep local strings in sync when the stored setting changes from outside
  // (e.g. initial dynasty load while the modal is already open).
  useEffect(() => { setPerGameStr(String(socialSettings.postsPerGame ?? 1)) }, [socialSettings.postsPerGame])
  useEffect(() => { setNationalStr(String(socialSettings.nationalCount ?? 50)) }, [socialSettings.nationalCount])

  const setSocialSetting = (key, value) => {
    if (isViewOnly || !currentDynasty?.id) return
    // startTransition defers the Firestore write + the expensive prompt
    // useMemo rebuild so they don't block the UI while the user is typing.
    startTransition(() => {
      updateSocialSettings(currentDynasty.id, { [key]: value }).catch(() => {})
    })
  }

  // Compute the "current rank snapshot" for the saved-week's poll —
  // the slice of rankByWeek[weekNum] across all teams. We compare
  // this against the snapshot stored on the saved recap to flag
  // drift. If they diverge, the recap text references rank values
  // that no longer match the dynasty's current state.
  const currentRankSnapshot = useMemo(() => {
    if (!currentDynasty || !Number.isFinite(yearNum) || !Number.isFinite(weekNum)) return null
    const snap = {}
    const teams = currentDynasty.teams || {}
    for (const [tidKey, team] of Object.entries(teams)) {
      const rbw = team?.byYear?.[yearNum]?.rankByWeek
        ?? team?.byYear?.[String(yearNum)]?.rankByWeek
      if (!rbw) continue
      const v = rbw[weekNum] ?? rbw[String(weekNum)]
      if (typeof v !== 'number' || v < 1 || v > 25) continue
      snap[tidKey] = v
    }
    return snap
  }, [currentDynasty, yearNum, weekNum])

  const recapDrift = useMemo(() => {
    if (!existingRecap?.rankSnapshot || !currentRankSnapshot) return null
    const stored = existingRecap.rankSnapshot
    const changed = []
    const allKeys = new Set([...Object.keys(stored), ...Object.keys(currentRankSnapshot)])
    for (const k of allKeys) {
      if (stored[k] !== currentRankSnapshot[k]) changed.push(k)
    }
    if (changed.length === 0) return null
    return { count: changed.length }
  }, [existingRecap, currentRankSnapshot])

  // Load the social universe + this dynasty's characters when the modal opens
  // so the baked-in roster and the on-save parser resolve real @handles.
  useEffect(() => {
    if (!isOpen || !isRegularWeek || !currentDynasty?.id) return
    loadSocial(currentDynasty.id).catch(() => {})
    // loadSocial is intentionally omitted: it's rebuilt on every provider
    // render (the context value object is a fresh literal each time), so
    // depending on it re-ran this effect every render. For a local/free-tier
    // dynasty loadSocial always setStates, which re-rendered → new loadSocial
    // → effect re-ran → infinite loop that froze the whole recap modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isRegularWeek, currentDynasty?.id])

  // Built lazily — only when the user clicks "Copy prompt" (PasteEntrySteps
  // calls this getter). buildWeekRecapPrompt scans every team + every game, so
  // computing it eagerly on each render pegged the CPU (currentDynasty is a
  // fresh reference every render, defeating memoization). PasteEntrySteps
  // treats a function as "always copyable", which is what we want whenever a
  // dynasty is loaded.
  const buildPrompt = useCallback(() => {
    if (!currentDynasty) return ''
    // Strip saved recap text so the AI always generates fresh. weekRecapsByYear
    // holds previously generated recaps — including them would bias the output.
    // eslint-disable-next-line no-unused-vars
    const { weekRecapsByYear: _stripped, ...dynastyForPrompt } = currentDynasty
    return isPreseason
      ? buildPreseasonRecapPrompt(dynastyForPrompt, yearNum)
      : buildWeekRecapPrompt(dynastyForPrompt, yearNum, weekNum, { includeSocial })
  }, [currentDynasty, yearNum, weekNum, isPreseason, includeSocial])

  const weekLabel = weekNum === 16 ? 'Conference Championship Week'
    : weekNum === 17 ? 'Bowl Week 1'
    : weekNum === 18 ? 'Bowl Week 2'
    : weekNum === 19 ? 'Bowl Week 3 / CFP Semifinals'
    : weekNum === 20 ? 'National Championship'
    : `Week ${weekNum}`

  const heading = isPreseason
    ? `${yearNum} Preseason Preview`
    : `${yearNum} ${weekLabel} Recap`

  // Shared save: take the AI's full output (from the Paste button's clipboard
  // read or the manual textarea), split off any cfb-social block, save the
  // prose recap here and the posts to the Social tab.
  const handleSave = async (trimmed) => {
    if (!currentDynasty) return
    try {
      // Two-in-one: if the pasted response carries a cfb-social block, strip it
      // out of the saved recap text and parse the posts. The recap stores the
      // prose-only text; the posts go to the social feed.
      const { found: hasSocial, body: socialBody, recapWithoutBlock } = extractSocialBlock(trimmed)
      // Pull the recap out of its ```markdown fence and drop anything outside it
      // (e.g. a leading heads-up note the AI added), so the saved recap is clean.
      const recapText = extractRecapBlock(hasSocial ? recapWithoutBlock : trimmed)

      // Merge into the existing year/week map. Build the full nested object so
      // local-storage and Firestore both get a clean replace at the parent.
      // Single-doc subcollection write — bypasses the 1 MB main-doc cap
      // that was breaking saves on long-running dynasties.
      await saveWeekRecap(currentDynasty.id, yearNum, weekNum, {
        generatedAt: Date.now(),
        text: recapText,
        // Snapshot of rankByWeek[weekNum] at save time. We compare
        // this against the live snapshot when the recap is re-opened
        // — if any team's rank has changed since save, we surface a
        // "stale" badge so the user knows the text references old
        // numbers. Cheap to store (one int per ranked team).
        rankSnapshot: currentRankSnapshot || {},
      })

      // Parse + save the social posts (if any). Failure here never blocks the
      // recap save — the recap is already persisted above.
      let socialAdded = 0
      if (hasSocial && isRegularWeek) {
        try {
          await ensureUniverseLoaded()
          const lines = parseSocialLines(socialBody)
          if (lines.length) {
            const charactersById = getEffectiveCharacters(currentDynasty)
            const { posts, newCharacters } = resolveSocialPosts({
              lines, year: yearNum, week: weekNum,
              gameTagMap: socialGameTagMap(currentDynasty, yearNum, weekNum),
              handleIndex: buildHandleIndex(charactersById),
              charactersById, teamsById: currentDynasty.teams || {},
              now: () => Date.now(),
            })
            if (posts.length) {
              await saveSocialPosts(currentDynasty.id, yearNum, weekNum, posts, newCharacters)
              socialAdded = posts.length
            }
          }
        } catch (e) {
          console.warn('[WeekRecapModal] social parse failed:', e)
        }
      }

      toast.success(socialAdded > 0 ? `Recap saved. Added ${socialAdded} social posts.` : 'Recap saved.')
      onSaved?.(recapText)
      onClose?.()
    } catch (err) {
      console.error('[WeekRecapModal] save failed:', err)
      // Surface the real failure (Firestore code + message) instead of a
      // generic "try again" toast — ALABAMA PRINCE was hitting this with
      // no diagnostic info, and the fix depends on which Firestore error
      // it actually is (permission-denied, resource-exhausted for >1MB
      // doc, unauthenticated for an expired token, etc.).
      const code = err?.code || err?.name
      const msg = err?.message || 'Unknown error'
      const detail = code ? `${code}: ${msg}` : msg
      toast.error(`Could not save: ${detail}`)
      throw err
    }
  }

  const handleDelete = async () => {
    if (isViewOnly || !currentDynasty || !existingRecap) return
    if (!window.confirm('Delete this saved recap? You can regenerate it any time.')) return
    try {
      await deleteWeekRecap(currentDynasty.id, yearNum, weekNum)
      toast.success('Recap deleted.')
      onClose?.()
    } catch (err) {
      console.error('[WeekRecapModal] delete failed:', err)
      const code = err?.code || err?.name
      const msg = err?.message || 'Unknown error'
      const detail = code ? `${code}: ${msg}` : msg
      toast.error(`Could not delete: ${detail}`)
    }
  }

  const socialToggle = isRegularWeek ? (
    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-txt-secondary">
      <input
        type="checkbox"
        checked={includeSocial}
        onChange={(e) => setIncludeSocial(e.target.checked)}
        className="w-4 h-4"
        style={{ accentColor: 'var(--text-primary)' }}
      />
      Include social posts
    </label>
  ) : null

  const socialCounts = isRegularWeek && includeSocial ? (
    <div className="mt-3 rounded-md border border-surface-4 bg-surface-2/50 px-3 py-2.5">
      <span className="text-xs font-semibold text-txt-secondary">Social posts to generate</span>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-txt-tertiary">Per game</span>
          <input
            type="number" min={1} max={20} inputMode="numeric"
            value={perGameStr}
            disabled={isViewOnly}
            onChange={(e) => setPerGameStr(e.target.value)}
            onBlur={() => {
              const v = Math.max(1, Math.min(20, parseInt(perGameStr) || 1))
              setPerGameStr(String(v))
              setSocialSetting('postsPerGame', v)
            }}
            className="w-full rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-surface-5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-txt-tertiary">National (per week)</span>
          <input
            type="number" min={0} max={100} inputMode="numeric"
            value={nationalStr}
            disabled={isViewOnly}
            onChange={(e) => setNationalStr(e.target.value)}
            onBlur={() => {
              const v = Math.max(0, Math.min(100, parseInt(nationalStr) || 0))
              setNationalStr(String(v))
              setSocialSetting('nationalCount', v)
            }}
            className="w-full rounded-md border border-surface-4 bg-surface-2 text-txt-primary text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-surface-5"
          />
        </label>
      </div>
    </div>
  ) : null

  const driftWarning = recapDrift ? (
    <div
      className="rounded-md px-3 py-2 text-xs flex items-start gap-2"
      style={{
        backgroundColor: 'rgba(251, 191, 36, 0.10)',
        border: '1px solid rgba(251, 191, 36, 0.30)',
        color: '#fcd34d',
      }}
    >
      <span className="font-bold flex-shrink-0">Stale:</span>
      <span>
        Rankings have changed for {recapDrift.count}{' '}
        team{recapDrift.count === 1 ? '' : 's'} since this recap was generated.
        Regenerate to refresh the rank numbers.
      </span>
    </div>
  ) : null

  return (
    <PromptProseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Week Recap"
      title={heading}
      prompt={currentDynasty ? buildPrompt : ''}
      promptHeaderRight={socialToggle}
      intro={<>Copy the prompt, run it in your AI, then copy the <strong className="text-txt-secondary">entire</strong> output and paste it back.{isRegularWeek && includeSocial ? ' The app splits it automatically — the recap saves here, and the social posts go to the Social tab.' : ''}</>}
      beforeSteps={socialCounts}
      afterSteps={driftWarning}
      hints={{
        screenshot: 'Tap Copy prompt — it already includes this week\'s scores, rankings, and context. No screenshot needed.',
        ai: 'Open your AI, paste the prompt, and it writes the recap.',
        paste: 'Copy the AI\'s ENTIRE reply, then tap Paste — it drops into the box below to review before you Save. Tap the arrow to type/paste by hand if the button is blocked.',
      }}
      lastSavedAt={existingRecap?.generatedAt}
      onSave={handleSave}
      saveLabel="Save recap"
      manualNote={`Markdown renders when you save.${isRegularWeek && includeSocial ? ' Any cfb-social block in the paste is split out to the Social tab automatically.' : ''}`}
      onDelete={existingRecap ? handleDelete : null}
      deleteLabel="Delete saved recap"
      disabled={isViewOnly}
    />
  )
}
