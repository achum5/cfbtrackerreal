import { useState, useEffect } from 'react'
import { useToast } from './ui/Toast'
import Modal from './ui/Modal'

export default function RecruitingClassRankModal({
  isOpen,
  onClose,
  onSave,
  currentRank,
  seasonLabel,
}) {
  const { toast } = useToast()
  const [rank, setRank] = useState('')
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)


  useEffect(() => {
    if (isOpen) {
      setRank(currentRank ? String(currentRank) : '')
    }
  }, [isOpen, currentRank])

  if (!isOpen) return null

  const handleSave = async () => {
    const rankNum = parseInt(rank, 10)
    if (!rank || isNaN(rankNum) || rankNum < 1 || rankNum > 134) {
      toast.error('Please enter a valid rank between 1 and 134')
      return
    }

    setSaving(true)
    try {
      await onSave(rankNum)
      onClose()
    } catch (error) {
      console.error('Failed to save recruiting class rank:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      await onSave(null)
      onClose()
    } catch (error) {
      console.error('Failed to clear recruiting class rank:', error)
      toast.error('Failed to clear. Please try again.')
    } finally {
      setClearing(false)
    }
  }

  // The shared Modal: same header, close button and footer as every other
  // dialog (this one used to draw its own, with a "×" glyph for close).
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recruiting Class Rank"
      size="sm"
      footer={(
        <>
          {currentRank ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={saving || clearing}
              className="btn-refined btn-refined--danger mr-auto disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Clear Rank'}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="btn-refined">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || clearing || !rank}
            className="btn-refined btn-refined--solid disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    >
      <div className="text-center">
        {seasonLabel ? (
          <p className="text-base font-bold text-txt-primary mb-1 mt-0">{seasonLabel}</p>
        ) : null}
        <p className="text-sm text-txt-tertiary mb-6 mt-0">
          Enter where this recruiting class ranked nationally.
        </p>
        <label htmlFor="class-rank-input" className="block text-sm font-semibold text-txt-primary mb-3">
          National Rank
        </label>
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-bold text-txt-primary" aria-hidden="true">#</span>
          <input
            id="class-rank-input"
            type="number"
            min="1"
            max="134"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && rank) handleSave() }}
            placeholder="1-134"
            className="w-28 px-4 py-3 rounded-lg border-2 border-surface-4 bg-surface-1 text-3xl font-bold text-center text-txt-primary focus:outline-none focus:border-surface-5"
          />
        </div>
      </div>
    </Modal>
  )
}
