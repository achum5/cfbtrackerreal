import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, pointerWithin, closestCenter, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDynasty, getCustomConferencesForYear } from '../context/DynastyContext'
import { readConferencesFromSheet } from '../services/sheetsService'
import { getColorsByAbbr, getLogoByAbbr } from '../data/teamRegistry'
import { getContrastTextColor } from '../utils/colorUtils'
import { useToast } from './ui/Toast'

// Drag-and-drop conference alignment board. Every FBS team is a colored card in
// a conference column; drag cards between columns to realign. Reuses the same
// dnd-kit model as the depth chart (container map + live onDragOver moves +
// onDragEnd reorder) and the same save path as the old paste flow: build the
// conference-header + team rows and run them through readConferencesFromSheet,
// which validates (every team exactly once) before onSave applies the alignment.

const COL = 'col:' // container-id prefix so a team abbr can never collide with a column id
const colId = (name) => COL + name
const colName = (id) => id.slice(COL.length)

const CONFERENCE_ORDER = [
  'SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12',
  'American', 'Conference USA', 'MAC', 'Mountain West', 'Sun Belt', 'Independent',
]

const findIn = (map, id) => (id in map ? id : Object.keys(map).find((c) => map[c].includes(id)))
const isCol = (id) => typeof id === 'string' && id.startsWith(COL)

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
  const teams = currentDynasty?.teams || currentDynasty?.customTeams
  const year = currentDynasty?.currentYear

  // Effective current-year alignment -> initial columns (known order, then extras).
  const initial = useMemo(() => {
    let eff = {}
    try { eff = getCustomConferencesForYear(currentDynasty, year) || {} } catch { eff = {} }
    const names = Object.keys(eff)
    const ordered = [
      ...CONFERENCE_ORDER.filter((n) => names.includes(n)),
      ...names.filter((n) => !CONFERENCE_ORDER.includes(n)).sort(),
    ]
    const containers = {}
    for (const n of ordered) containers[colId(n)] = [...(eff[n] || [])]
    return { containers, order: ordered.map(colId) }
  }, [currentDynasty, year])

  const [containers, setContainers] = useState(initial.containers)
  const [order, setOrder] = useState(initial.order)
  const [activeId, setActiveId] = useState(null)
  const [newConf, setNewConf] = useState('')
  const [saving, setSaving] = useState(false)

  // Seed fresh from the current alignment each time the modal opens.
  useEffect(() => {
    if (isOpen) { setContainers(initial.containers); setOrder(initial.order); setNewConf('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const onDragStart = ({ active }) => setActiveId(active.id)
  const onDragCancel = () => setActiveId(null)

  const onDragOver = ({ active, over }) => {
    if (!over) return
    setContainers((cs) => {
      const a = findIn(cs, active.id)
      const o = findIn(cs, over.id)
      if (!a || !o || a === o) return cs
      const oItems = cs[o]
      const overIsContainer = over.id in cs
      const overIndex = overIsContainer ? oItems.length : oItems.indexOf(over.id)
      const insertAt = overIndex < 0 ? oItems.length : overIndex
      return {
        ...cs,
        [a]: cs[a].filter((id) => id !== active.id),
        [o]: [...oItems.slice(0, insertAt), active.id, ...oItems.slice(insertAt)],
      }
    })
  }

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    setContainers((cs) => {
      const a = findIn(cs, active.id)
      const o = findIn(cs, over.id)
      if (a && o && a === o) {
        const items = cs[a]
        const oldIndex = items.indexOf(active.id)
        const overIsContainer = over.id in cs
        const newIndex = overIsContainer ? items.length - 1 : items.indexOf(over.id)
        if (oldIndex !== newIndex && newIndex >= 0) return { ...cs, [a]: arrayMove(items, oldIndex, newIndex) }
      }
      return cs
    })
  }

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
    setSaving(true)
    try {
      // Only conferences that still have teams; build the header + team-per-row grid.
      const confNames = order.map(colName).filter((n) => (containers[colId(n)] || []).length > 0)
      const cols = confNames.map((n) => containers[colId(n)])
      const maxLen = Math.max(0, ...cols.map((c) => c.length))
      const gridRows = [confNames]
      for (let r = 0; r < maxLen; r++) gridRows.push(cols.map((c) => c[r] ?? ''))
      const conferences = await readConferencesFromSheet(null, teams, { rows: gridRows })
      await onSave(conferences)
      onClose()
    } catch (err) {
      console.error('[ConferencesModal] save failed:', err)
      toast.error(err?.message || 'Could not save. Every team must be in exactly one conference.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4"
      style={{ margin: 0 }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[min(96vw,1100px)] max-h-[92dvh] flex flex-col rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--surface-4)', boxShadow: '0 28px 80px rgba(0,0,0,0.7)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 py-3 flex-shrink-0" style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--surface-4)' }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-txt-primary leading-tight" style={{ fontFamily: 'var(--font-display)' }}>Conference Alignment</h2>
            <p className="text-[11px] text-txt-tertiary">Drag teams between conferences{year ? ` — ${year}` : ''}.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-surface-3 transition-colors flex-shrink-0">
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
            <button type="button" onClick={onClose} className="text-xs font-semibold px-3 py-1.5 rounded border border-surface-5 text-txt-secondary hover:text-txt-primary hover:bg-surface-3 transition-colors">Cancel</button>
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
      {logo && <img src={logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
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
