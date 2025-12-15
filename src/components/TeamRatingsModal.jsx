import { useState, useEffect } from 'react'

export default function TeamRatingsModal({ isOpen, onClose, onSave, teamColors, currentRatings }) {
  const [overall, setOverall] = useState('')
  const [offense, setOffense] = useState('')
  const [defense, setDefense] = useState('')

  // Load current ratings when modal opens
  useEffect(() => {
    if (isOpen && currentRatings) {
      setOverall(currentRatings.overall || '')
      setOffense(currentRatings.offense || '')
      setDefense(currentRatings.defense || '')
    }
  }, [isOpen, currentRatings])

  // Prevent body scroll when modal is open
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

  const handleSave = () => {
    if (!overall || !offense || !defense) {
      alert('Please enter all three ratings (Overall, Offense, Defense)')
      return
    }

    const overallNum = parseInt(overall)
    const offenseNum = parseInt(offense)
    const defenseNum = parseInt(defense)

    if (isNaN(overallNum) || isNaN(offenseNum) || isNaN(defenseNum)) {
      alert('Ratings must be numbers')
      return
    }

    if (overallNum < 0 || overallNum > 99 || offenseNum < 0 || offenseNum > 99 || defenseNum < 0 || defenseNum > 99) {
      alert('Ratings must be between 0 and 99')
      return
    }

    onSave({
      overall: overallNum,
      offense: offenseNum,
      defense: defenseNum
    })

    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-md p-6"
        style={{ backgroundColor: teamColors.secondary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: teamColors.primary }}>
            Team Ratings
          </h2>
          <button
            onClick={onClose}
            className="hover:opacity-70"
            style={{ color: teamColors.primary }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
              Overall Rating (0-99)
            </label>
            <input
              type="number"
              min="0"
              max="99"
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-2 text-lg font-semibold text-center"
              style={{
                borderColor: teamColors.primary,
                backgroundColor: '#ffffff'
              }}
              placeholder="85"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
              Offense Rating (0-99)
            </label>
            <input
              type="number"
              min="0"
              max="99"
              value={offense}
              onChange={(e) => setOffense(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-2 text-lg font-semibold text-center"
              style={{
                borderColor: teamColors.primary,
                backgroundColor: '#ffffff'
              }}
              placeholder="87"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: teamColors.primary }}>
              Defense Rating (0-99)
            </label>
            <input
              type="number"
              min="0"
              max="99"
              value={defense}
              onChange={(e) => setDefense(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-2 text-lg font-semibold text-center"
              style={{
                borderColor: teamColors.primary,
                backgroundColor: '#ffffff'
              }}
              placeholder="83"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg font-semibold border-2 hover:opacity-90 transition-colors"
            style={{
              borderColor: teamColors.primary,
              color: teamColors.primary,
              backgroundColor: teamColors.secondary
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-colors"
            style={{
              backgroundColor: teamColors.primary,
              color: teamColors.secondary
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
