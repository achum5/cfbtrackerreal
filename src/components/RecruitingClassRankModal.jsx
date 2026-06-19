import { useState, useEffect, useMemo } from 'react'
import { getModalColors } from '../utils/colorUtils'
import { useToast } from './ui/Toast'

export default function RecruitingClassRankModal({
  isOpen,
  onClose,
  onSave,
  currentRank,
  seasonLabel,
  teamColors
}) {
  const { toast } = useToast()
  const [rank, setRank] = useState('')
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const modalColors = useMemo(() => getModalColors(teamColors), [teamColors])

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

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="rounded-xl shadow-xl w-full max-w-md border"
        style={{ backgroundColor: modalColors.background, borderColor: modalColors.border }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="p-4 rounded-t-xl flex justify-between items-center"
          style={{ backgroundColor: modalColors.headerBg }}
        >
          <h2 className="text-xl font-bold" style={{ color: modalColors.text }}>
            Recruiting Class Rank
          </h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold hover:opacity-70"
            style={{ color: modalColors.text }}
          >
            ×
          </button>
        </div>

        <div className="p-6 text-center">
          {seasonLabel ? (
            <p className="text-base font-bold mb-1" style={{ color: modalColors.text }}>
              {seasonLabel}
            </p>
          ) : null}
          <p className="text-sm mb-6" style={{ color: modalColors.textMuted }}>
            Enter where this recruiting class ranked nationally.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3" style={{ color: modalColors.text }}>
              National Rank
            </label>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold" style={{ color: modalColors.text }}>#</span>
              <input
                type="number"
                min="1"
                max="134"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                placeholder="1-134"
                className="w-28 px-4 py-3 rounded-lg border-2 text-3xl font-bold text-center focus:outline-none"
                style={{
                  backgroundColor: modalColors.inputBg,
                  borderColor: modalColors.inputBorder,
                  color: modalColors.text
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-b-xl flex justify-center gap-3"
          style={{ borderTop: `2px solid ${modalColors.border}` }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg font-semibold hover:opacity-80"
            style={{ backgroundColor: modalColors.inputBg, color: modalColors.text }}
          >
            Cancel
          </button>
          {currentRank ? (
            <button
              onClick={handleClear}
              disabled={saving || clearing}
              className="px-5 py-2 rounded-lg font-semibold hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: modalColors.inputBg, color: '#f87171' }}
            >
              {clearing ? 'Clearing...' : 'Clear Rank'}
            </button>
          ) : null}
          <button
            onClick={handleSave}
            disabled={saving || clearing || !rank}
            className="px-5 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: modalColors.text, color: modalColors.background }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
