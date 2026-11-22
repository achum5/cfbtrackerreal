// Week-to-week changes between two versions of a team's bundled roster.
//
// The CFB 27 rosters ship as one full set (EA's newest ratings week) plus, for
// each older week, a patch that turns the next week's rosters back into that
// week's. A dynasty started on an older roster update applies the patches in
// order, newest first. Patches are small: a week changes a few hundred
// ratings, while a full set is ~14 MB.
//
// Shape of one team's patch (all keys optional):
//   remove: [key]                  players in the newer roster, not the older
//   add:    [player]               players in the older roster, not the newer
//   change: [[key, { field: value, attributes: { name: value } }]]
// A field set to null was absent in the older roster. Players are keyed by
// EA's player id (eaId), or by name for a player that has none.
//
// Shared by the app's roster loader and the scripts that build the patches.

export const rosterKey = (p) =>
  p?.eaId != null ? `ea:${p.eaId}` : `n:${String(p?.name || '').toLowerCase().replace(/[^a-z]/g, '')}`

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// The patch that turns `newer` (array of players) into `older`.
export function diffRoster(newer, older) {
  const olderByKey = new Map(older.map((p) => [rosterKey(p), p]))
  const newerByKey = new Map(newer.map((p) => [rosterKey(p), p]))
  const remove = []
  const change = []
  for (const [key, n] of newerByKey) {
    const o = olderByKey.get(key)
    if (!o) { remove.push(key); continue }
    const delta = {}
    for (const field of new Set([...Object.keys(n), ...Object.keys(o)])) {
      if (field === 'attributes') continue
      if (!same(n[field], o[field])) delta[field] = field in o ? o[field] : null
    }
    const na = n.attributes || {}
    const oa = o.attributes || {}
    const attrDelta = {}
    for (const name of new Set([...Object.keys(na), ...Object.keys(oa)])) {
      if (na[name] !== oa[name]) attrDelta[name] = name in oa ? oa[name] : null
    }
    if (Object.keys(attrDelta).length) delta.attributes = attrDelta
    if (Object.keys(delta).length) change.push([key, delta])
  }
  const add = older.filter((p) => !newerByKey.has(rosterKey(p)))
  const patch = {}
  if (remove.length) patch.remove = remove
  if (add.length) patch.add = add
  if (change.length) patch.change = change
  return patch
}

function applyDelta(p, delta) {
  const out = { ...p }
  for (const [field, value] of Object.entries(delta)) {
    if (field === 'attributes') {
      const attrs = { ...(p.attributes || {}) }
      for (const [name, v] of Object.entries(value)) {
        if (v === null) delete attrs[name]
        else attrs[name] = v
      }
      out.attributes = attrs
    } else if (value === null) {
      delete out[field]
    } else {
      out[field] = value
    }
  }
  return out
}

// Apply one team's patch to its players; returns a new array, best first.
export function applyRosterPatch(players, patch) {
  if (!patch) return players
  const remove = new Set(patch.remove || [])
  const change = new Map(patch.change || [])
  const out = []
  for (const p of players) {
    const key = rosterKey(p)
    if (remove.has(key)) continue
    out.push(change.has(key) ? applyDelta(p, change.get(key)) : p)
  }
  out.push(...(patch.add || []))
  return out.sort((a, b) => (Number(b.overall) || 0) - (Number(a.overall) || 0))
}
