import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { useConfirm } from './ui/ConfirmDialog'
import { useToast } from './ui/Toast'
import { usePathPrefix } from '../hooks/usePathPrefix'
import { COACH_ROLES, COACH_ROLE_LABELS, getCoachByRole, getCoachCareer, findCoachesByName } from '../data/coachModel'

const ROLE_NAME_FIELD = { HC: 'hcName', OC: 'ocName', DC: 'dcName' }

// One line the "same coach?" prompt can quote: "OC at Ohio State (2027–2028)".
function describeCoach(coach, teams) {
  const career = getCoachCareer(coach)
  const cur = career.current
  const team = cur?.teamTid != null ? teams?.[cur.teamTid] : null
  const teamName = team?.name || team?.abbr || (cur?.teamTid != null ? `team ${cur.teamTid}` : 'no team')
  const span = career.years.length
    ? (career.years.length === 1 ? `${career.years[0]}` : `${career.years[0]}–${career.years[career.years.length - 1]}`)
    : ''
  return `${cur?.role || 'coach'} at ${teamName}${span ? ` (${span})` : ''}`
}

/**
 * The coaching-staff card that drops below the team page header. Each row is
 * the role's name (linked to the coach page when a cid coach fills it) plus,
 * when editing is allowed, a pencil that turns the row into an inline input.
 * Saving goes through saveTeamYearCoach: a name nobody in the dynasty has
 * becomes a new coach profile; a name an existing (non-controlled) coach
 * already carries first asks whether it is that same coach — "Same coach"
 * reuses the profile, "Different coach" mints a new one.
 *
 * Rows held by a user-controlled coach (the user's own HC, or a league
 * member's) are never editable here — that name lives on the coach entity.
 */
export default function CoachingStaffPopover({ tid, year, staff, isUserTeam, canEdit, position, onClose }) {
  const { currentDynasty, saveTeamYearCoach } = useDynasty()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const pathPrefix = usePathPrefix()

  const [editingRole, setEditingRole] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const userPosition = currentDynasty?.coachPosition || 'HC'

  const rows = COACH_ROLES.map((role) => {
    const held = getCoachByRole(currentDynasty, tid, year, role)
    const coach = held?.coach || null
    const name = staff?.[ROLE_NAME_FIELD[role]] || null
    const controlled = Boolean(coach && coach.controlledBy != null)
    // Pre-migration saves may show the user's own slot with no coach entity
    // behind it yet — keep that off-limits too rather than minting an NPC
    // twin of the user.
    const userSlot = isUserTeam && !coach && role === userPosition
    return { role, label: COACH_ROLE_LABELS[role], name, cid: coach?.cid || null, editable: canEdit && !controlled && !userSlot }
  }).filter((r) => r.name)

  useEffect(() => {
    if (editingRole && !rows.some((r) => r.role === editingRole)) setEditingRole(null)
  }, [editingRole, rows])

  const beginEdit = (row) => {
    setDraft(row.name || '')
    setEditingRole(row.role)
  }

  const cancelEdit = () => {
    setEditingRole(null)
    setDraft('')
  }

  const commit = async (row) => {
    if (saving) return
    const clean = draft.trim()
    if (!clean) {
      toast.error('Enter a coach name')
      return
    }
    if (clean.toLowerCase() === (row.name || '').trim().toLowerCase()) {
      cancelEdit()
      return
    }
    let reuseCid = null
    const matches = findCoachesByName(currentDynasty?.coaches, clean, { excludeCid: row.cid })
    if (matches.length) {
      const match = matches[0]
      const choice = await confirm({
        title: 'Same coach?',
        message: `${match.name} is already tracked in this dynasty as ${describeCoach(match, currentDynasty?.teams)}. Is this the same coach as the one previously entered?`,
        confirmLabel: 'Same coach',
        extraLabel: 'Different coach',
        extraVariant: 'outline',
        cancelLabel: 'Cancel',
      })
      if (choice === false) return
      if (choice === true) reuseCid = match.cid
    }
    setSaving(true)
    try {
      await saveTeamYearCoach(currentDynasty.id, { tid, year, role: row.role, name: clean, reuseCid })
      toast.success(reuseCid ? 'Coach updated' : 'Coach updated and profile created')
      cancelEdit()
    } catch (err) {
      console.error('[CoachingStaffPopover] save failed:', err)
      toast.error('Failed to save coach. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed z-[9999] w-72 max-w-[calc(100vw-1.5rem)] rounded-lg overflow-hidden"
      style={{
        top: position.top,
        right: position.right,
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--surface-4)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}
    >
      <div className="px-4 py-2.5 border-b border-surface-3">
        <p className="label-xs text-txt-tertiary" style={{ letterSpacing: '1px' }}>Coaching Staff</p>
      </div>
      <div>
        {rows.map((r) => {
          const isEditing = editingRole === r.role
          return (
            <div key={r.role} className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-3 last:border-b-0">
              <span className="w-8 flex-shrink-0 text-xs font-bold text-txt-tertiary">{r.role}</span>
              <div className="min-w-0 flex-1">
                <div className="label-xs text-txt-tertiary">{r.label}</div>
                {isEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={draft}
                      autoFocus
                      disabled={saving}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(r) }
                        if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                      }}
                      aria-label={`${r.label} name`}
                      className="min-w-0 flex-1 px-2 py-1 rounded-md border border-surface-5 bg-surface-2 text-sm font-semibold text-txt-primary"
                      placeholder="Coach name"
                    />
                    <button
                      type="button"
                      onClick={() => commit(r)}
                      disabled={saving}
                      className="text-xs font-semibold text-txt-primary hover:underline disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="text-xs font-semibold text-txt-tertiary hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : r.cid ? (
                  <Link
                    to={`${pathPrefix}/coach/${r.cid}`}
                    onClick={onClose}
                    className="text-sm font-semibold text-txt-primary hover:underline truncate block"
                  >
                    {r.name}
                  </Link>
                ) : (
                  <div className="text-sm font-semibold text-txt-primary truncate">{r.name}</div>
                )}
              </div>
              {r.editable && !isEditing && (
                <button
                  type="button"
                  onClick={() => beginEdit(r)}
                  aria-label={`Edit ${r.label}`}
                  title={`Edit ${r.label}`}
                  className="flex-shrink-0 p-1 rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-surface-3 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
