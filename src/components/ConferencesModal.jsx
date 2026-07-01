import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, pointerWithin, closestCenter, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDynasty } from '../context/DynastyContext'
import { readConferencesFromSheet } from '../services/sheetsService'
import { getColorsByAbbr, getLogoByAbbr } from '../data/teamRegistry'
import { getContrastTextColor } from '../utils/colorUtils'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'

// Drag-and-drop conference alignment board. Every FBS team is a colored card in
// a conference column; drag cards between columns to realign. Reuses the same
// dnd-kit model as the depth chart (container map + live onDragOver moves +
// onDragEnd reorder) and the same save path as the old paste flow: build the
// conference-header + team rows and run them through readConferencesFromSheet,
// which validates (every team exactly once) before onSave applies the alignment.

const COL = 'col:' // container-id prefix so a team abbr can never collide with a column id
const UNASSIGNED = 'Unassigned' // holding column for teams with no per-tid conference yet
const colId = (name) => COL + name
const colName = (id) => id.slice(COL.length)

const CONFERENCE_ORDER = [
  'SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12',
  'American', 'Conference USA', 'MAC', 'Mountain West', 'Sun Belt', 'Independent',
]

const findIn = (map, id) => (id in map ? id : Object.keys(map).find((c) => map[c].includes(id)))
const isCol = (id) => typeof id === 'string' && id.startsWith(COL)
const sameOrder = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

// Pointer-driven collisions so the card tracks the cursor and columns register.
// Team cards are preferred over their column so reordering lands precisely.
function collisionDetection(args) {
  const hits = pointerWithin(args)
  const resolved = hits.length ? hits : closestCenter(args)
  return [...resolved].sort((a, b) => (isCol(a.id) ? 1 : 0) - (isCol(b.id) ? 1 : 0))
}

export default function ConferencesModal({ isOpen, onClose, onSave }) {
  const { currentDynasty } = useDynasty()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const teams = currentDynasty?.teams || currentDynasty?.customTeams
  const currentYear = currentDynasty?.currentYear
  const startYear = currentDynasty?.startYear || currentYear
  const [selectedYear, setSelectedYear] = useState(currentYear)
  // Past seasons through next season (for planning realignment).
  const years = useMemo(() => {
    const list = []
    for (let y = Math.min(startYear, currentYear); y <= currentYear + 1; y++) list.push(y)
    return list
  }, [startYear, currentYear])

  // Build the board STRICTLY from each team's own per-tid source of truth:
  // teams[tid].byYear[year].conference for the selected season, carrying back to
  // the most recent prior season it was set (a conference persists until the
  // team is moved). No default/real-world baseline is consulted, so only this
  // dynasty's real teams appear and none are invented. FCS placeholders are
  // skipped. A team with no conference in any season lands in "Unassigned" so
  // the gap is visible and fixable rather than silently guessed.
  const initial = useMemo(() => {
    const yearNum = Number(selectedYear)
    const minYear = Number(startYear) || yearNum
    const groups = {} // conferenceName -> [abbr]
    for (const t of Object.values(teams || {})) {
      if (!t || t.isFCS || !t.abbr) continue
      const by = t.byYear || {}
      let conf = by[yearNum]?.conference ?? by[String(yearNum)]?.conference
      if (!conf) {
        for (let y = yearNum - 1; y >= minYear; y--) {
          const c = by[y]?.conference ?? by[String(y)]?.conference
          if (c) { conf = c; break }
        }
      }
      const key = conf || UNASSIGNED
      ;(groups[key] ||= []).push(t.abbr)
    }
    for (const k of Object.keys(groups)) groups[k].sort((a, b) => a.localeCompare(b))
    // Always show every standard conference as a column (even when empty) so it
    // stays a drop target and never disappears; then any custom conferences the
    // dynasty invented, then Unassigned last (only when it holds teams).
    const extras = Object.keys(groups).filter((n) => n !== UNASSIGNED && !CONFERENCE_ORDER.includes(n))
    const ordered = [...CONFERENCE_ORDER, ...extras.sort()]
    if (groups[UNASSIGNED]?.length) ordered.push(UNASSIGNED)
    const containers = {}
    for (const n of ordered) containers[colId(n)] = [...(groups[n] || [])]
    return { containers, order: ordered.map(colId) }
  }, [teams, selectedYear, startYear])

  const [containers, setContainers] = useState(initial.containers)
  const [order, setOrder] = useState(initial.order)
  const [activeId, setActiveId] = useState(null)
  const [newConf, setNewConf] = useState('')
  const [saving, setSaving] = useState(false)

  // Default back to the current season each time the modal opens.
  useEffect(() => {
    if (isOpen) setSelectedYear(currentYear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Seed the board from the selected year's alignment (on open and on year change).
  useEffect(() => {
    setContainers(initial.containers)
    setOrder(initial.order)
    setNewConf('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedYear])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const onDragStart = ({ active }) => setActiveId(active.id)
  const onDragCancel = () => setActiveId(null)

  // Live moves for BOTH same- and cross-column drags, so the gap always lands
  // where the cursor is. When the cursor is in a column's empty area the target
  // is the column itself (append at the end); when it's over a card we insert
  // before/after based on which half of that card the cursor sits in. Without
  // the midpoint check, dragging below the last card would resolve to a middle
  // card and open the gap in the middle instead of the bottom.
  const onDragOver = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const translated = active.rect?.current?.translated
    const overRect = over.rect
    setContainers((cs) => {
      const a = findIn(cs, active.id)
      const o = findIn(cs, over.id)
      if (!a || !o) return cs
      // Destination as it stands with the active card removed (handles same-column).
      const src = cs[a].filter((id) => id !== active.id)
      const dst = a === o ? src : cs[o]
      const overIsContainer = over.id in cs
      let insertAt
      if (overIsContainer) {
        insertAt = dst.length
      } else {
        const overIndex = dst.indexOf(over.id)
        if (overIndex < 0) {
          insertAt = dst.length
        } else {
          const activeCenter = translated ? translated.top + translated.height / 2 : 0
          const overCenter = overRect ? overRect.top + overRect.height / 2 : 0
          insertAt = overIndex + (activeCenter > overCenter ? 1 : 0)
        }
      }
      const next = [...dst.slice(0, insertAt), active.id, ...dst.slice(insertAt)]
      if (a === o) {
        return sameOrder(next, cs[a]) ? cs : { ...cs, [a]: next }
      }
      return { ...cs, [a]: src, [o]: next }
    })
  }

  // All reordering happens live in onDragOver; drag end just settles the overlay.
  const onDragEnd = () => setActiveId(null)

  const addConference = () => {
    const name = newConf.trim()
    if (!name) return
    const id = colId(name)
    if (containers[id]) { toast.error('That conference already exists.'); return }
    setContainers((cs) => ({ ...cs, [id]: [] }))
    setOrder((o) => [...o, id])
    setNewConf('')
  }

  const save = async () => {
    // Every real team must belong to a conference before saving. Teams still in
    // the Unassigned holding column would otherwise fail the "missing teams"
    // validation with a generic error — surface a clear one instead.
    const unplaced = containers[colId(UNASSIGNED)] || []
    if (unplaced.length) {
      toast.error(`Assign these teams to a conference first: ${unplaced.join(', ')}`)
      return
    }
    setSaving(true)
    try {
      // Only conferences that still have teams; build the header + team-per-row grid.
      // (Unassigned is never a real conference, so it never reaches the save.)
      const confNames = order.map(colName).filter((n) => n !== UNASSIGNED && (containers[colId(n)] || []).length > 0)
      const cols = confNames.map((n) => containers[colId(n)])
      const maxLen = Math.max(0, ...cols.map((c) => c.length))
      const gridRows = [confNames]
      for (let r = 0; r < maxLen; r++) gridRows.push(cols.map((c) => c[r] ?? ''))
      const conferences = await readConferencesFromSheet(null, teams, { rows: gridRows })
      // Keyed by year so the save applies to the SELECTED season (parents route
      // year-keyed payloads through saveConferenceAlignment per year).
      await onSave({ [String(selectedYear)]: conferences })
      onClose()
    } catch (err) {
      console.error('[ConferencesModal] save failed:', err)
      toast.error(err?.message || 'Could not save. Every team must be in exactly one conference.')
    } finally {
      setSaving(false)
    }
  }

  // Unsaved-changes guard: compare each team's conference on the board against
  // the alignment we seeded from per-tid season data. Only the team→conference
  // assignment matters (intra-column order and empty conferences don't change
  // what would be saved), so we compare abbr→conference maps.
  const isDirty = useMemo(() => {
    const assignmentOf = (cs) => {
      const m = {}
      for (const [cid, abbrs] of Object.entries(cs || {})) {
        const name = colName(cid)
        for (const a of abbrs) m[a] = name
      }
      return m
    }
    const before = assignmentOf(initial.containers)
    const after = assignmentOf(containers)
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const k of keys) if (before[k] !== after[k]) return true
    return false
  }, [initial.containers, containers])

  const requestClose = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: 'Leave without saving?',
        message: 'You have unsaved conference changes. Leaving now discards them.',
        confirmLabel: 'Discard changes',
        variant: 'danger',
      })
      if (!ok) return
    }
    onClose()
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4"
      style={{ margin: 0 }}
      onMouseDown={requestClose}
    >
      <div
        className="w-full max-w-[min(96vw,1100px)] max-h-[92dvh] flex flex-col rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--surface-4)', boxShadow: '0 28px 80px rgba(0,0,0,0.7)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 py-3 flex-shrink-0" style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--surface-4)' }}>
          <h2 className="text-base font-bold text-txt-primary leading-tight flex items-center gap-2 min-w-0" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="relative inline-flex items-center">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Season"
                className="appearance-none bg-surface-3 border border-surface-5 rounded-md pl-2 pr-6 py-0.5 text-base font-bold text-txt-primary tabular cursor-pointer focus:outline-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <svg className="w-4 h-4 absolute right-1.5 pointer-events-none text-txt-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </span>
            Conference Alignment
          </h2>
          <button type="button" aria-label="Close" onClick={requestClose} className="p-1.5 rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-surface-3 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex-1 overflow-auto p-3 sm:p-4">
            <div className="flex gap-2 sm:gap-3 items-start min-h-full">
              {order.map((id) => (
                <ConfColumn key={id} id={id} abbrs={containers[id] || []} teams={teams} />
              ))}
            </div>
          </div>

          {createPortal(
            <DragOverlay zIndex={10000} dropAnimation={null}>
              {activeId ? <TileFace abbr={activeId} teams={teams} dragging /> : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>

        {/* Footer — add a conference + save */}
        <footer className="flex items-center justify-between gap-2 px-5 py-3 flex-shrink-0" style={{ backgroundColor: 'var(--surface-2)', borderTop: '1px solid var(--surface-4)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="text"
              value={newConf}
              onChange={(e) => setNewConf(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addConference() }}
              placeholder="New conference…"
              className="w-40 px-2.5 py-1.5 rounded-md text-sm bg-surface-3 border border-surface-4 text-txt-primary focus:outline-none focus:border-surface-5"
            />
            <button type="button" onClick={addConference} className="text-xs font-semibold px-3 py-1.5 rounded border border-surface-5 text-txt-secondary hover:text-txt-primary hover:bg-surface-3 transition-colors">
              Add
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={requestClose} className="text-xs font-semibold px-3 py-1.5 rounded border border-surface-5 text-txt-secondary hover:text-txt-primary hover:bg-surface-3 transition-colors">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="text-xs font-bold px-4 py-1.5 rounded text-white transition-colors disabled:opacity-60" style={{ backgroundColor: 'var(--accent-info)' }}>
              {saving ? 'Saving…' : 'Save Alignment'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function ConfColumn({ id, abbrs, teams }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div className="flex-shrink-0 w-36 sm:w-40 flex flex-col rounded-lg self-stretch" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--surface-4)' }}>
      <div className="px-2 py-1.5 flex items-center justify-between gap-1 border-b border-surface-4">
        <span className="text-xs font-bold text-txt-primary truncate" title={colName(id)}>{colName(id)}</span>
        <span className="text-[10px] tabular text-txt-tertiary flex-shrink-0">{abbrs.length}</span>
      </div>
      <div ref={setNodeRef} className="flex-1 p-1.5 flex flex-col gap-1 min-h-[3rem]">
        <SortableContext items={abbrs} strategy={verticalListSortingStrategy}>
          {abbrs.length
            ? abbrs.map((a) => <TeamTile key={a} abbr={a} teams={teams} />)
            : <span className="text-[11px] text-txt-tertiary text-center py-3">Drag teams here</span>}
        </SortableContext>
      </div>
    </div>
  )
}

function TileFace({ abbr, teams, dragging }) {
  const colors = getColorsByAbbr(teams, abbr) || { primary: '#374151', secondary: '#ffffff' }
  const logo = getLogoByAbbr(teams, abbr)
  const textColor = getContrastTextColor(colors.primary || '#374151')
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md select-none"
      style={{
        backgroundColor: colors.primary || '#374151',
        color: textColor,
        border: `1px solid ${colors.secondary || 'rgba(255,255,255,0.4)'}`,
        boxShadow: dragging ? '0 10px 26px rgba(0,0,0,0.55)' : 'none',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
    >
      {logo && (
        <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 p-[2px]">
          <img src={logo} alt="" className="w-full h-full object-contain" />
        </span>
      )}
      <span className="text-xs font-bold truncate">{abbr}</span>
    </div>
  )
}

function TeamTile({ abbr, teams }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: abbr })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    touchAction: 'none',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TileFace abbr={abbr} teams={teams} />
    </div>
  )
}
