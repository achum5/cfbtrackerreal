import { useState, useEffect } from 'react'
import { getContrastTextColor } from '../utils/colorUtils'

export default function RecruitingClassRankModal({
  isOpen,
  onClose,
  onSave,
  currentRank,
  teamColors
}) {
  const [rank, setRank] = useState('')
  const [saving, setSaving] = useState(false)

  const primaryBgText = getContrastTextColor(teamColors.primary)
  const secondaryBgText = getContrastTextColor(teamColors.secondary)

  useEffect(() => {
    if (isOpen) {
      setRank(currentRank ? String(currentRank) : '')
    }
  }, [isOpen, currentRank])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    const rankNum = parseInt(rank, 10)
    if (!rank || isNaN(rankNum) || rankNum < 1 || rankNum > 134) {
      alert('Please enter a valid rank between 1 and 134')
      return
    }

    setSaving(true)
    try {
      await onSave(rankNum)
      onClose()
    } catch (error) {
      console.error('Failed to save recruiting class rank:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-md"
        style={{ backgroundColor: teamColors.secondary }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 rounded-t-lg flex justify-between items-center"
          style={{ backgroundColor: teamColors.primary }}
        >
          <h2 className="text-xl font-bold" style={{ color: primaryBgText }}>
            Recruiting Class Rank
          </h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold hover:opacity-70"
            style={{ color: primaryBgText }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-sm mb-6" style={{ color: secondaryBgText, opacity: 0.7 }}>
            Enter where your recruiting class ranked nationally.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3" style={{ color: secondaryBgText }}>
              National Rank
            </label>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold" style={{ color: teamColors.primary }}>#</span>
              <input
                type="number"
                min="1"
                max="134"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                placeholder="1-134"
                className="w-28 px-4 py-3 rounded-lg border-2 text-3xl font-bold text-center focus:outline-none"
                style={{ borderColor: teamColors.primary, color: teamColors.primary }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 rounded-b-lg flex justify-center gap-3"
          style={{ borderTop: `2px solid ${teamColors.primary}30` }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg font-semibold hover:opacity-80"
            style={{ backgroundColor: '#e5e7eb', color: '#374151' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !rank}
            className="px-5 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: teamColors.primary, color: primaryBgText }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
