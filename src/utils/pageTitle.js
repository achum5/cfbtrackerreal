// Browser-tab titles. Every tab used to read "CFB Dynasty Tracker", so a few
// open pages (Top 25, a player, the bracket) were indistinguishable in the tab
// strip and in history. Layout sets the title from the route; the Player, Team
// and Game pages set their own (they know the player / team / matchup), so
// Layout leaves those routes alone.

export const SITE_NAME = 'CFB Dynasty Tracker'

// First path segment after /dynasty/:id (or /view/:code) → page label.
const DYNASTY_SECTION_LABELS = {
  '': 'Dashboard',
  roster: 'Roster',
  rankings: 'Top 25',
  stats: 'Team Stats',
  'coach-career': 'Coach Career',
  'coach-build': 'Coach Build',
  coaches: 'Coaches',
  players: 'All Players',
  compare: 'Compare Players',
  'all-time-lineup': 'All-Time Lineup',
  recruiting: 'Recruiting',
  leaders: 'Leaders',
  awards: 'Awards',
  'all-americans': 'All-Americans',
  'all-conference': 'All-Conference',
  topclasses: 'Top Classes',
  'players-of-week': 'Players of the Week',
  'heisman-watch': 'Heisman Watch',
  'players-leaving': 'Players Leaving',
  'draft-results': 'Draft History',
  'training-results': 'Training Results',
  'injury-report': 'Injury Report',
  'dynasty-records': 'Leaderboards',
  'season-stats': 'Season Stats',
  'team-stats': 'Team Stats',
  teams: 'All Teams',
  'bowl-history': 'Bowl History',
  'conference-championship-history': 'Conference Championships',
  records: 'Records',
  'conference-standings': 'Conference Standings',
  'cfp-bracket': 'CFP Bracket',
  'weekly-scores': 'Around the Country',
  cards: 'Card Collection',
  rivalries: 'Rivalries',
  game: 'Game',
  scouting: 'Scouting Report',
  install: 'Weekly Install',
  'scheme-builder': 'Scheme Builder',
  admin: 'Danger Zone',
  preferences: 'League Preferences',
  league: 'League Members',
  'ai-prompts': 'AI Prompts',
  dev: 'Dev Tools',
}

// Routes whose page sets a more specific title itself.
const SELF_TITLED_SECTIONS = new Set(['player', 'team', 'game'])

const TOP_LEVEL_LABELS = {
  '/': 'My Dynasties',
  '/create': 'Create Dynasty',
  '/account': 'Account',
  '/login': 'Sign In',
  '/contact': 'Contact',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
  '/install': 'Install the App',
}

export function composeTitle(...parts) {
  return [...parts.filter(Boolean), SITE_NAME].join(' – ')
}

/**
 * Title for a pathname, or null when the page sets its own.
 * @param {string} pathname
 * @param {string} [dynastyName] — e.g. "Kentucky Wildcats"
 */
export function titleForPath(pathname, dynastyName) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/'
  const m = path.match(/^\/(?:dynasty|view)\/[^/]+(?:\/([^/]+))?(\/.*)?$/)
  if (m) {
    const section = m[1] || ''
    const rest = m[2] || ''
    // The game editor (/game/new, /game/:id/edit) has no title of its own.
    if (section === 'game' && (rest === '/new' || rest.endsWith('/edit'))) {
      return composeTitle(rest === '/new' ? 'New Game' : 'Edit Game', dynastyName)
    }
    if (SELF_TITLED_SECTIONS.has(section)) return null
    return composeTitle(DYNASTY_SECTION_LABELS[section], dynastyName)
  }
  return composeTitle(TOP_LEVEL_LABELS[path])
}
