import { useState } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { getEditionConfig } from '../editions'
import { Modal, Button } from './ui'
import { useToast } from './ui/Toast'
import { getSupportStaff, setSupportStaff, isSupportStaffSet, supportStaffTotal } from '../data/dynastyPointsModel'
import SupportStaffEditor from './SupportStaffEditor'

const fmt = (n) => (n == null || n === '' || isNaN(n) ? '—' : Number(n).toLocaleString())

// Support Staff entry — opened from the preseason to-do. Records the support
// staff you hired in-game; their cost feeds the Staff budget lane. Input +
// display are the shared SupportStaffEditor (same as the Blueprint tab).
export default function SupportStaffModal({ isOpen, onClose, year }) {
  const { currentDynasty, updateDynasty, isViewOnly } = useDynasty()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const effects = getEditionConfig(currentDynasty)?.dynastyPoints?.supportStaff?.effects ?? []
  const y = Number(year ?? currentDynasty?.currentYear)
  const supportStaff = getSupportStaff(currentDynasty, y)

  if (!currentDynasty) return null

  // Merge-preserving write (the model keeps budget/allocations intact).
  const write = async (next) => {
    await updateDynasty(currentDynasty.id, { dynastyPoints: setSupportStaff(currentDynasty, y, next) })
  }

  const handleAdd = async (item) => {
    if (isViewOnly) return
    setBusy(true)
    try {
      await write([...supportStaff, item])
      toast.success('Added support staff')
    } catch (e) {
      console.error('[SupportStaffModal] add failed:', e)
      toast.error('Failed to add.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (idx) => {
    if (isViewOnly) return
    setBusy(true)
    try {
      await write(supportStaff.filter((_, i) => i !== idx))
    } catch (e) {
      console.error('[SupportStaffModal] remove failed:', e)
      toast.error('Failed to remove.')
    } finally {
      setBusy(false)
    }
  }

  // Closing with nothing recorded marks the to-do done as "none this year".
  const handleDone = async () => {
    if (!isViewOnly && !isSupportStaffSet(currentDynasty, y)) {
      try { await write([]) } catch { /* non-fatal */ }
    }
    onClose()
  }

  const total = supportStaffTotal(currentDynasty, y)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Support Staff"
      size="md"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-xs text-txt-tertiary tabular-nums">
            {supportStaff.length > 0 ? <>{supportStaff.length} hired · {fmt(total)} pts</> : 'None hired'}
          </span>
          <Button variant="primary" onClick={handleDone} disabled={busy}>Done</Button>
        </div>
      }
    >
      <SupportStaffEditor
        supportStaff={supportStaff}
        effects={effects}
        onAdd={handleAdd}
        onRemove={handleRemove}
        isViewOnly={isViewOnly}
        busy={busy}
      />
    </Modal>
  )
}
