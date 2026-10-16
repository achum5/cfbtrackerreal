import { useState, useEffect } from 'react'
import { useToast } from './ui/Toast'
import Modal from './ui/Modal'

export default function TeamRatingsModal({ isOpen, onClose, onSave, currentRatings }) {
  const { toast } = useToast()
  const [overall, setOverall] = useState('')
  const [offense, setOffense] = useState('')
  const [defense, setDefense] = useState('')


  // Limit input to 2 digits (40-99)
  const handleRatingChange = (value, setter) => {
    // Remove non-digits and limit to 2 characters
    const digits = value.replace(/\D/g, '').slice(0, 2)
    setter(digits)
  }

  // Clamp value to 40-99 range on blur
  const handleBlur = (value, setter) => {
    if (!value) return
    const num = parseInt(value)
    if (isNaN(num)) return
    if (num < 40) setter('40')
    else if (num > 99) setter('99')
  }

  // Load current ratings when modal opens
  useEffect(() => {
    if (isOpen && currentRatings) {
      setOverall(currentRatings.overall || '')
      setOffense(currentRatings.offense || '')
      setDefense(currentRatings.defense || '')
    }
  }, [isOpen, currentRatings])

  const handleSave = () => {
    if (!overall || !offense || !defense) {
      toast.error('Please enter all three ratings (Overall, Offense, Defense)')
      return
    }

    const overallNum = parseInt(overall)
    const offenseNum = parseInt(offense)
    const defenseNum = parseInt(defense)

    if (isNaN(overallNum) || isNaN(offenseNum) || isNaN(defenseNum)) {
      toast.error('Ratings must be numbers')
      return
    }

    if (overallNum < 40 || overallNum > 99 || offenseNum < 40 || offenseNum > 99 || defenseNum < 40 || defenseNum > 99) {
      toast.error('Ratings must be between 40 and 99')
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

  const fields = [
    { id: 'rating-ovr', label: 'Overall', value: overall, set: setOverall, placeholder: '85' },
    { id: 'rating-off', label: 'Offense', value: offense, set: setOffense, placeholder: '87' },
    { id: 'rating-def', label: 'Defense', value: defense, set: setDefense, placeholder: '83' },
  ]

  // Shared Modal chrome. The Save button used to be white text on the team
  // color, which disappeared on light team colors.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Team Ratings"
      size="sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-refined">Cancel</button>
          <button type="button" onClick={handleSave} className="btn-refined btn-refined--solid">Save</button>
        </>
      )}
    >
      <p className="text-sm text-txt-tertiary mt-0 mb-4">Ratings run from 40 to 99.</p>
      <div className="grid grid-cols-3 gap-3">
        {fields.map((f) => (
          <div key={f.id}>
            <label htmlFor={f.id} className="block label-sm text-txt-secondary mb-2 text-center">
              {f.label}
            </label>
            <input
              id={f.id}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={f.value}
              onChange={(e) => handleRatingChange(e.target.value, f.set)}
              onBlur={() => handleBlur(f.value, f.set)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              className="w-full px-2 py-3 rounded-lg border border-surface-4 bg-surface-1 text-2xl font-bold tabular-nums text-center text-txt-primary focus:outline-none focus:border-surface-5"
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}
