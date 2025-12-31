# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

**IMPORTANT**: Update this file when you complete features or make significant changes.

## CRITICAL: Team-Centric Coding Requirement

**ALWAYS store data at the TEAM level, NOT the user/dynasty level.**

When users switch teams during their coaching career, dynasty-level data causes the old team's data to appear under the new team.

### The Pattern

**WRONG** (dynasty-level):
```javascript
dynasty.schedule = [...]
dynasty.recruits = [...]
```

**CORRECT** (team-centric):
```javascript
dynasty.schedulesByTeamYear[teamAbbr][year] = [...]
dynasty.recruitingCommitmentsByTeamYear[teamAbbr][year] = {...}
```

### Checklist for New Features

1. Ask: "Does this data belong to a specific team?"
2. If YES → Use `dynasty.{feature}ByTeamYear[teamAbbr][year]` pattern
3. Tag individual records with `team: teamAbbr` field
4. Create helper function like `getCurrent{Feature}(dynasty)` in DynastyContext
5. Filter by team when displaying data

## Project Overview

CFB Dynasty Tracker - React web app for tracking College Football dynasty mode. Users create dynasties, manage schedules, rosters, and track games through multiple seasons.

## Deployment

- **Production URL**: https://dynastytracker.vercel.app
- **Hosting**: Vercel (auto-deploys from GitHub `main` branch)
- **Firebase Project**: `cfbtracker-200ab`

## Development Commands

```bash
npm run dev      # Start dev server (port 5000)
npm run build    # Build for production
```

## Code Quality Requirements

**IMPORTANT**: After every code change, run `npm run build` to check for errors. Fix any errors before considering the change complete.

## Git Commit Policy

Do NOT commit automatically. Only commit when user explicitly requests it.

When committing:
1. `git add -A`
2. `git status` to verify
3. Create commit with descriptive message
4. `git push` immediately

## Architecture

### Context Providers

1. **AuthProvider** (`src/context/AuthContext.jsx`) - Firebase Google Auth
2. **DynastyProvider** (`src/context/DynastyContext.jsx`) - Dynasty CRUD, dual-mode storage

### Data Storage Modes

**Dev Mode** (`VITE_DEV_MODE=true`): localStorage, no auth required
**Production Mode**: Firebase Firestore, requires Google OAuth

### Team-Centric Data Structures

All implemented in `DynastyContext.jsx` with helper functions:

| Data | Storage | Helper |
|------|---------|--------|
| Schedule | `schedulesByTeamYear[team][year]` | `getCurrentSchedule()` |
| Roster | `players[]` with `team` field | `getCurrentRoster()` |
| PreseasonSetup | `preseasonSetupByTeamYear[team][year]` | `getCurrentPreseasonSetup()` |
| TeamRatings | `teamRatingsByTeamYear[team][year]` | `getCurrentTeamRatings()` |
| CoachingStaff | `coachingStaffByTeamYear[team][year]` | `getCurrentCoachingStaff()` |
| GoogleSheet | `googleSheetsByTeam[team]` | `getCurrentGoogleSheet()` |
| Recruits | `recruitsByTeamYear[team][year]` | `getCurrentRecruits()` |
| Games | `games[]` with `userTeam` field | Filter by `userTeam` |
| Commitments | `recruitingCommitmentsByTeamYear[team][year][key]` | See Dashboard.jsx |

**Special structures:**
- `coachTeamByYear[year]` - Locked at Week 1 of regular season
- `lockedCoachingStaffByYear[team][year]` - Locked at end of regular season (Week 12)
- `playersLeavingByYear[year]` - Players graduating/transferring/declaring
- `portalTransferClassByYear[year]` - Portal transfer class assignments
- `fringeCaseClassByYear[year]` - Fringe case (5-9 games) class assignments

### Phase System

1. **Preseason** - Week 0, setup (schedule/roster entry)
2. **Regular Season** - Weeks 1-12
3. **Conference Championship** - Separate phase (NOT postseason week 1)
4. **Postseason** - Weeks 1-5 (Bowl Weeks)
5. **Offseason** - Weeks 1-8:
   - Week 1: Players Leaving
   - Weeks 2-5: Recruiting Weeks 1-4
   - Week 6: National Signing Day (YEAR FLIP happens here) - Tasks:
     1. Signing Day (final recruiting commitments) - MUST complete first
     2. Transfer Destinations
     3. Recruiting Class Rank
     4. Position Changes
     5. Portal Transfer Class Assignment (if portal transfers exist)
     6. Fringe Case Class Assignment (if players with 5-9 games exist)
   - Week 7: Training Camp (Training Results, Recruit Overalls, Encourage Transfers)
   - Week 8: Offseason Complete (triggers `advanceToNewSeason()`)

### Key Files

- `src/context/DynastyContext.jsx` - All data operations and helpers
- `src/pages/dynasty/Dashboard.jsx` - Main dashboard with phase-specific tasks
- `src/pages/dynasty/TeamYear.jsx` - Team season page with Stats modal
- `src/pages/dynasty/Player.jsx` - Player profile with stats tables
- `src/pages/dynasty/CoachCareer.jsx` - Coach career page with team links and season tiles
- `src/data/teamAbbreviations.js` - Team abbreviations and colors
- `src/services/sheetsService.js` - Google Sheets integration

### Modal Pattern

```jsx
<div
  className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
  style={{ margin: 0 }}
>
  <div onClick={(e) => e.stopPropagation()}>
    {/* Modal content */}
  </div>
</div>
```

## Player Data Architecture

### Player teamsByYear (Roster Membership Tracking)

Each player has a `teamsByYear` object tracking which team they were on each season:
```javascript
player.teamsByYear = { 2025: 'UT', 2026: 'UT', 2027: 'MICH' }
```

**Used for**:
- Roster filtering on TeamYear.jsx (PRIMARY check)
- Stats table team display per year (Player.jsx)
- Historical roster accuracy when coaches change teams

**Updated automatically in**:
- `saveRoster()` - Sets teamsByYear[year] = teamAbbr
- `advanceToNewSeason()` - Adds next year for continuing players
- `handleTransferDestinationsSave()` - Sets teamsByYear[nextYear] = destination team
- Recruit creation - Sets teamsByYear for enrollment year

### Player classByYear (Class History Tracking)

Each player has a `classByYear` object tracking what class they were each season:
```javascript
player.classByYear = { 2025: 'Fr', 2026: 'So', 2027: 'RS So' }
```

**Used for**:
- TeamYear.jsx roster display - Shows class for the specific season being viewed
- PlayerEditModal Roster History - Edit class alongside team for each year

**Updated automatically in**:
- `saveRoster()` - Sets classByYear[year] = player.year
- `advanceToNewSeason()` - Sets classByYear for recruit conversion and class progression
- `advanceWeek()` - Sets classByYear during Signing Day/Training Camp class progression

### Player Transfer Fields

**Incoming portal transfers** (players coming TO your team):
- `previousTeam` - Where they transferred from (e.g., Syracuse)
- `isPortal` - true

**Outgoing transfers** (players leaving your team):
- `transferredTo` - Destination team (e.g., Arizona)
- `transferredFrom` - Team they left (set when saving transfer destinations)
- `leftTeam` - true (finalized after advanceToNewSeason)
- `leftYear` - Year they left
- `leftReason` - Transfer reason
- `leavingYear` / `leavingReason` - Pending departure (before advanceToNewSeason)

**IMPORTANT**: `previousTeam` and `transferredFrom` are DIFFERENT:
- `previousTeam` = incoming portal recruit origin
- `transferredFrom` = outgoing transfer origin (where they just left)

### Player Departure Tracking

Players can be marked as leaving via two mechanisms:
1. `playersLeavingByYear[year]` - Array from Players Leaving task
2. `player.leavingYear` + `player.leavingReason` - Direct fields on player

Roster filtering checks BOTH:
```javascript
// Exclude if leftTeam is set and year is past leftYear
if (p.leftTeam && p.leftYear && Number(year) > Number(p.leftYear)) return false
// Exclude if pending departure and year is past leavingYear
if (p.leavingYear && p.leavingReason && Number(year) > Number(p.leavingYear)) return false
```

### Class Progression

**CLASS_PROGRESSION mapping** (in DynastyContext.jsx):
```javascript
{
  'HS': 'Fr',
  'JUCO Fr': 'Fr',   // Drop JUCO prefix, keep class
  'JUCO So': 'So',
  'JUCO Jr': 'Jr',
  'JUCO Sr': 'Sr',
  'Fr': 'So',
  'RS Fr': 'RS So',
  'So': 'Jr',
  'RS So': 'RS Jr',
  'Jr': 'Sr',
  'RS Jr': 'RS Sr',
  'Sr': 'RS Sr',
  'RS Sr': 'RS Sr'
}
```

**Redshirt rules**: Players with ≤4 games get RS prefix added (unless already RS)

### Player statsByYear (Stats Storage)

Stats stored within each player's `statsByYear` field:
```javascript
player.statsByYear = {
  2025: {
    gamesPlayed: 13,
    snapsPlayed: 850,
    passing: { Completions: 250, Yards: 3000, ... },
    rushing: { Carries: 50, Yards: 200, ... },
    // ... other categories
  }
}
```

**Reading stats** (priority order in Player.jsx):
1. `player.statsByYear[year]` - PRIMARY
2. Legacy: `dynasty.detailedStatsByYear[year]` - Fallback

## Important Notes

### Firestore Updates

Use dot notation for nested fields in production:
```javascript
// Correct - merges field
{ 'preseasonSetup.scheduleEntered': true }

// Wrong - replaces entire object
{ preseasonSetup: { scheduleEntered: true } }
```

### Team Colors

Use `useTeamColors(teamName)` hook for dynamic theming.

### View-Only Mode

When `isViewOnly` is true from `useDynasty()`, hide all edit/add functionality.

### Unified Game System

All games stored in `games[]` array with `gameType` field:
- Game types: `regular`, `conference_championship`, `bowl`, `cfp_first_round`, `cfp_quarterfinal`, `cfp_semifinal`, `cfp_championship`
- **CPU games**: Have `team1`/`team2` but NO `opponent` field
- **User games**: Have `opponent` field (and `userTeam`)

### Google Sheets OAuth

- Requires OAuth access token (not Firebase ID token)
- Token stored in localStorage with 1-hour expiry
- If expired, user must sign out and back in
- Scopes: `spreadsheets` and `drive.file`

## Hidden Dev Tools

Features hidden with `{false && (...)}` for future use:
- **Roster History button** - All Players page (`Players.jsx:240`)
- **Random Fill button** - Game Entry modal (`GameEntryModal.jsx:1395`)
