import { Link } from 'react-router-dom'

/**
 * Build player-name link patterns for social post text. buildRecapLinks only
 * handles team + score links, so this adds the players: any full player name
 * that appears in the text and resolves to exactly one roster pid becomes a
 * link to that player's page. Ambiguous names (shared by 2+ players) are
 * skipped to avoid mis-linking. Returned in the { pattern, render } shape
 * FormattedRecap consumes.
 */
export default function buildSocialPlayerLinks(dynasty, text, pathPrefix) {
  const players = dynasty?.players || []
  if (!players.length || !text || !pathPrefix) return []

  const byName = new Map() // full name -> Set(pid)
  for (const p of players) {
    const name = (p?.name || '').trim()
    if (name.length < 5 || p?.pid == null) continue
    if (!text.includes(name)) continue
    if (!byName.has(name)) byName.set(name, new Set())
    byName.get(name).add(p.pid)
  }

  const links = []
  for (const [name, pids] of byName) {
    if (pids.size !== 1) continue // ambiguous — leave it as plain text
    const href = `${pathPrefix}/player/${[...pids][0]}`
    links.push({
      pattern: name,
      render: (matched, key) => <Link key={key} to={href}>{matched}</Link>,
    })
  }
  return links
}
