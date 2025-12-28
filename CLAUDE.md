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

### Phase System

1. **Preseason** - Week 0, setup (schedule/roster entry)
2. **Regular Season** - Weeks 1-12
3. **Conference Championship** - Separate phase (NOT postseason week 1)
4. **Postseason** - Weeks 1-5 (Bowl Weeks)
5. **Offseason** - Weeks 1-5 (Players Leaving, then Recruiting Weeks 1-4)

### Recruiting Commitment Keys

- `preseason`: Early commitments
- `regular_1` through `regular_12`: Regular season weeks
- `conf_champ`: Conference Championship week
- `bowl_1` through `bowl_4`: Bowl weeks
- `signing_1` through `signing_4`: Recruiting weeks (offseason weeks 2-5)

### Key Files

- `src/context/DynastyContext.jsx` - All data operations and helpers
- `src/pages/dynasty/Dashboard.jsx` - Main dashboard with phase-specific tasks
- `src/pages/dynasty/TeamYear.jsx` - Team season page with Stats modal
- `src/pages/dynasty/CoachCareer.jsx` - Coach career page with team links and season tiles
- `src/data/teamAbbreviations.js` - Team abbreviations and colors
- `src/data/cfpConstants.js` - CFP slot ID system
- `src/data/boxScoreConstants.js` - Box score stat categories and keys

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

## Important Notes

### Firestore Updates

Use dot notation for nested fields in production:
```javascript
// Correct - merges field
{ 'preseasonSetup.scheduleEntered': true }

// Wrong - replaces entire object
{ preseasonSetup: { scheduleEntered: true } }
```

### Google Sheets Integration

**Service File**: `src/services/sheetsService.js`

**Sheet Structure**:
- **Schedule Tab** (4 columns): Week, User Team, CPU Team, Site
  - Week pre-filled 1-12, User Team pre-filled with user's team abbreviation
  - Header row protected and frozen
  - STRICT dropdown validation for teams and site (Home/Road/Neutral)
  - Conditional formatting applies team colors to abbreviations

- **Roster Tab** (13 columns): First Name, Last Name, Position, Class, Dev Trait, Jersey #, Archetype, Overall, Height, Weight, Hometown, State, Image URL
  - 85 rows for players
  - STRICT dropdowns for Position, Class, Dev Trait, Archetype, Height, State
  - Auto-filter enabled on header row for sorting/filtering

**Data Sync Process** (in `ScheduleEntryModal.jsx`):
1. `readScheduleFromSheet()` - Reads schedule data, auto-converts team abbreviations to uppercase
2. `readRosterFromSheet()` - Reads roster data, parses First Name + Last Name into `name`, `firstName`, `lastName` fields
3. `onSave(schedule)` → `saveSchedule()` in DynastyContext:
   - Stores in `schedulesByTeamYear[teamAbbr][year]`
   - Sets `preseasonSetup.scheduleEntered = true` (dot notation in Firestore)
4. `onRosterSave(roster)` → `saveRoster()` in DynastyContext:
   - During preseason: Replaces entire roster, assigns PIDs starting from 1
   - After preseason: Merges with existing, continues PID sequence from `nextPID`
   - Tags each player with `team: teamAbbr`
   - Sets `preseasonSetup.rosterEntered = true`

**Player Fields**:
- `name` - Full name (combined from firstName + lastName)
- `firstName`, `lastName` - Separate name fields for sorting
- `pictureUrl` - Player image URL (synced from Image URL column)

**Key Functions**:
- `createDynastySheet()` - Creates new Sheet with Schedule/Roster tabs
- `initializeSheetHeaders()` - Sets up headers, protection, validation, formatting
- `initializeTeamStatsSheet()` - Creates Team Stats tab with team-colored headers
- `restoreGoogleSheet()` - Restores trashed sheets via Drive API (used before creating new)
- `getSheetEmbedUrl()` - Generates iframe embed URL
- `getAccessToken()` - Retrieves OAuth token from localStorage (throws if expired)

**OAuth Requirements**:
- Requires OAuth access token (not Firebase ID token)
- Token stored in localStorage with 1-hour expiry
- If expired, user must sign out and back in
- Scopes: `spreadsheets` (create/edit) and `drive.file` (manage files)

### Team Colors

Use `useTeamColors(teamName)` hook for dynamic theming.

### View-Only Mode

When `isViewOnly` is true from `useDynasty()`, hide all edit/add functionality:
- Edit buttons (roster, player, game, schedule)
- Add sections (roster entry, game entry)
- Use invisible placeholder divs to maintain layout when hiding buttons

### Box Score Stat Keys

Stats from `boxScoreConstants.js` use camelCase keys. Important mappings:
- **Defense**: `solo`, `assists`, `sack`, `iNT`, `pD`, `fF`, `fR`
- **Kicking**: `fGM`, `fGA`, `xPM`, `xPA`
- **Punting**: `punts`, `puntYards`, `puntLong`, `puntIn20`
- **Returns**: `kickReturns`, `kickReturnYards`, `puntReturns`, `puntReturnYards`

## Current Work

**Team Stats Google Sheet** - End of season recap feature with two-tab structure:
- **Offense Tab**: Points, Offense Yards, Yards Per Play, Passing Yards, Passing Yards Per Game, Passing TDs, Rushing Yards, Rushing Yards Per Carry, Rushing TDs, First Downs
- **Defense Tab**: Points Allowed, Total Yards Allowed, Passing Yards Allowed, Rushing Yards Allowed, Sacks, Forced Fumbles, Interceptions
- Pre-fills with aggregated box score data from all games
- Manual override system: sheet values override box score aggregations (like player stats)
- Display on TeamStats.jsx page shows totals and per-game averages

## TODO / Future Work

- Team stats: CFP Appearances, National Titles, Heisman Winners, All-Americans
- User's games as/against each team with win percentages
- Convert recruits to active roster players at season start
