import { useMemo } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { useToast } from './ui/Toast'
import { buildWeekPreviewPrompt } from '../utils/recapPrompts'
import PromptProseModal from './ui/PromptProseModal'

const WEEK_ONE = 1

/**
 * Week 1 Preview — the national "what to watch" column for the season opener,
 * shown on Week 0's dashboard task list (both PC and manual dynasties). Saved
 * at dynasty.weekOnePreviewByYear[year] = { generatedAt, text }.
 *
 * The screen itself is PromptProseModal, the same shell the week recap and the
 * playoff preview use, so all three offer the identical Copy prompt → Send to
 * your AI → Paste it back row.
 *
 * Props: isOpen, onClose, year, onSaved
 */
export default function WeekOnePreviewModal({ isOpen, onClose, year, onSaved }) {
  const { currentDynasty, saveWeekOnePreview, deleteWeekOnePreview, isViewOnly } = useDynasty()
  const { toast } = useToast()
  const yearNum = Number(year)

  const existingPreview = currentDynasty?.weekOnePreviewByYear?.[yearNum]

  const prompt = useMemo(
    () => (currentDynasty ? buildWeekPreviewPrompt(currentDynasty, yearNum, WEEK_ONE) : ''),
    [currentDynasty, yearNum]
  )

  const handleSave = async (text) => {
    if (!currentDynasty) return
    try {
      await saveWeekOnePreview(currentDynasty.id, yearNum, text)
      toast.success('Week 1 preview saved.')
      onSaved?.(text)
      onClose?.()
    } catch (err) {
      console.error('[WeekOnePreviewModal] save failed:', err)
      const code = err?.code || err?.name
      toast.error(`Could not save: ${code ? `${code}: ${err?.message || 'Unknown error'}` : err?.message || 'Unknown error'}`)
      throw err
    }
  }

  const handleDelete = async () => {
    if (isViewOnly || !currentDynasty || !existingPreview) return
    if (!window.confirm('Delete this saved Week 1 preview? You can regenerate it any time.')) return
    try {
      await deleteWeekOnePreview(currentDynasty.id, yearNum)
      toast.success('Week 1 preview deleted.')
      onClose?.()
    } catch (err) {
      console.error('[WeekOnePreviewModal] delete failed:', err)
      const code = err?.code || err?.name
      toast.error(`Could not delete: ${code ? `${code}: ${err?.message || 'Unknown error'}` : err?.message || 'Unknown error'}`)
    }
  }

  return (
    <PromptProseModal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Week 1 Preview"
      title={`${yearNum} Season Opener`}
      prompt={prompt}
      intro={<>Copy the prompt, run it in your AI, then copy the <strong className="text-txt-secondary">entire</strong> output and paste it back.</>}
      hints={{
        screenshot: 'Tap Copy prompt — it already includes Week 1\'s schedule, rankings, and conference alignment. No screenshot needed.',
        ai: 'Open your AI, paste the prompt, and it writes the Week 1 preview.',
        paste: 'Copy the AI\'s ENTIRE reply, then tap Paste — it drops into the box below to review before you Save. Tap the arrow to type/paste by hand if the button is blocked.',
      }}
      saved={existingPreview}
      onSave={handleSave}
      saveLabel="Save preview"
      manualNote="Markdown renders when you save."
      onDelete={existingPreview ? handleDelete : null}
      deleteLabel="Delete saved preview"
      disabled={isViewOnly}
    />
  )
}
