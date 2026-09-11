import { useState, useEffect, useMemo } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { useToast } from './ui/Toast'
import { buildPlayoffPreviewPrompt, PLAYOFF_PREVIEW_DEPTH_OPTIONS } from '../utils/playoffPreviewPrompt'
import RecapSettingsModal from './RecapSettingsModal'
import PromptProseModal from './ui/PromptProseModal'
import {
  extractSocialBlock, parseSocialLines, resolveSocialPosts,
  getEffectiveCharacters, ensureUniverseLoaded,
} from '../data/socialModel'

// Fixed week tag for playoff-preview social posts — the preview itself is a
// once-per-year artifact that lives on the Conference Championship week's
// page (16), the same week its own tab/content lives on in WeeklyScores.jsx —
// NOT Bowl Week 1, since that week's own recap/social hasn't started yet at
// the point this preview gets generated. There's no played game to tag posts
// to; resolveSocialPosts treats any non-game tag as national, which is all
// this prompt ever asks for.
const PLAYOFF_PREVIEW_SOCIAL_WEEK = 16

/**
 * The CFP Playoff Preview, built from the locked 12-team bracket
 * (dynasty.cfpSeedsByYear[year]) instead of a played week's games. Saved at
 * dynasty.playoffPreviewByYear[year] = { generatedAt, text }. The screen is
 * PromptProseModal, shared with the week recap and the Week 1 preview.
 *
 * Props: isOpen, onClose, year, onSaved
 */
export default function PlayoffPreviewModal({ isOpen, onClose, year, onSaved }) {
  const { currentDynasty, savePlayoffPreview, deletePlayoffPreview, isViewOnly, loadSocial, saveSocialPosts } = useDynasty()
  const { toast } = useToast()
  const yearNum = Number(year)

  const existingPreview = currentDynasty?.playoffPreviewByYear?.[yearNum]
  const [showSettings, setShowSettings] = useState(false)
  const [depth, setDepth] = useState('standard')
  const [includeSocial, setIncludeSocial] = useState(currentDynasty?.socialSettings?.enabled !== false)
  const [socialCount, setSocialCount] = useState(8)

  // Load the social universe so the prompt can list real @handles when
  // "Generate social posts" is on, and so the paste-back parser resolves them.
  useEffect(() => {
    if (!isOpen || !currentDynasty?.id) return
    loadSocial(currentDynasty.id).catch(() => {})
  }, [isOpen, currentDynasty?.id, loadSocial])

  const charactersById = useMemo(() => getEffectiveCharacters(currentDynasty), [currentDynasty])

  const prompt = useMemo(
    () => buildPlayoffPreviewPrompt(currentDynasty, yearNum, { depth, includeSocial, socialCount, charactersById }),
    [currentDynasty, yearNum, depth, includeSocial, socialCount, charactersById]
  )

  const handleSave = async (trimmed) => {
    if (!currentDynasty) return
    try {
      const { found: hasSocial, body: socialBody, recapWithoutBlock } = extractSocialBlock(trimmed)
      const previewText = hasSocial ? recapWithoutBlock : trimmed

      await savePlayoffPreview(currentDynasty.id, yearNum, previewText)

      let socialAdded = 0
      if (hasSocial && includeSocial) {
        try {
          await ensureUniverseLoaded()
          const lines = parseSocialLines(socialBody)
          if (lines.length) {
            const { posts, newCharacters } = resolveSocialPosts({
              lines, year: yearNum, week: PLAYOFF_PREVIEW_SOCIAL_WEEK,
              gameTagMap: {},
              handleIndex: Object.fromEntries(Object.values(charactersById).map(c => [c.handle.toLowerCase(), c.id])),
              charactersById, teamsById: currentDynasty.teams || {},
              now: () => Date.now(),
            })
            if (posts.length) {
              await saveSocialPosts(currentDynasty.id, yearNum, PLAYOFF_PREVIEW_SOCIAL_WEEK, posts, newCharacters)
              socialAdded = posts.length
            }
          }
        } catch (e) {
          console.warn('[PlayoffPreviewModal] social parse failed:', e)
        }
      }

      toast.success(socialAdded > 0 ? `Playoff preview saved. Added ${socialAdded} social posts.` : 'Playoff preview saved.')
      onSaved?.(previewText)
      onClose?.()
    } catch (err) {
      console.error('[PlayoffPreviewModal] save failed:', err)
      const code = err?.code || err?.name
      const msg = err?.message || 'Unknown error'
      toast.error(`Could not save: ${code ? `${code}: ${msg}` : msg}`)
      throw err
    }
  }

  const handleDelete = async () => {
    if (isViewOnly || !currentDynasty || !existingPreview) return
    if (!window.confirm('Delete this saved playoff preview? You can regenerate it any time.')) return
    try {
      await deletePlayoffPreview(currentDynasty.id, yearNum)
      toast.success('Playoff preview deleted.')
      onClose?.()
    } catch (err) {
      console.error('[PlayoffPreviewModal] delete failed:', err)
      const code = err?.code || err?.name
      const msg = err?.message || 'Unknown error'
      toast.error(`Could not delete: ${code ? `${code}: ${msg}` : msg}`)
    }
  }

  const settingsGear = (
    <button
      type="button"
      onClick={() => setShowSettings(true)}
      title="Preview length and social posts"
      aria-label="Preview settings"
      className="px-2.5 flex items-center justify-center transition-opacity hover:opacity-90"
      style={{ backgroundColor: 'var(--text-primary)', color: 'var(--surface-1)', borderRight: '1px solid var(--surface-1)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    </button>
  )

  return (
    <>
      <PromptProseModal
        isOpen={isOpen}
        onClose={onClose}
        eyebrow="Playoff Preview"
        title={`${yearNum} College Football Playoff`}
        prompt={prompt}
        hasPrompt={Boolean(prompt)}
        notice={!prompt ? (
          <div className="rounded-md border border-surface-4 bg-surface-2/50 px-3 py-2.5 text-sm text-txt-secondary">
            The 12-team CFP bracket isn't locked in yet — sync your save (or enter CFP seeds) once the field is set, then come back here.
          </div>
        ) : null}
        intro={<>Copy the prompt, run it in your AI, then copy the <strong className="text-txt-secondary">entire</strong> output and paste it back.{includeSocial ? ' The app splits it automatically — the preview saves here, and the social posts go to the Social tab.' : ''}</>}
        hints={{
          screenshot: 'Tap Copy prompt — it already includes the locked 12-team bracket, seeds, and context. No screenshot needed.',
          ai: 'Open your AI, paste the prompt, and it writes the playoff preview.',
          paste: 'Copy the AI\'s ENTIRE reply, then tap Paste — it drops into the box below to review before you Save. Tap the arrow to type/paste by hand if the button is blocked.',
        }}
        copyLeading={settingsGear}
        saved={existingPreview}
        onSave={handleSave}
        saveLabel="Save preview"
        manualNote={`Markdown renders when you save.${includeSocial ? ' Any cfb-social block in the paste is split out to the Social tab automatically.' : ''}`}
        onDelete={existingPreview ? handleDelete : null}
        deleteLabel="Delete saved preview"
        disabled={isViewOnly}
      />

      <RecapSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        depthOptions={PLAYOFF_PREVIEW_DEPTH_OPTIONS}
        depth={depth}
        onDepthChange={setDepth}
        socialEnabled={includeSocial}
        onSocialEnabledChange={setIncludeSocial}
        socialCount={socialCount}
        onSocialCountChange={setSocialCount}
        socialLabel="posts about the playoff bracket, in the same response"
      />
    </>
  )
}
