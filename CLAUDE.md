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
- `conferenceChampionshipDataByYear[year]` - CC week answers (madeChampionship, opponent, pendingFiring)
- `bowlEligibilityDataByYear[year]` - Bowl eligibility answers
- `cfpResultsByYear[year]` - CFP game results (firstRound, quarterfinals, semifinals, championship)

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
- Box score stats filtering - Only aggregates stats for years player was on user's team (prevents opponent stats from showing)

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
- `advanceWeek()` - Sets classByYear during Signing Day class progression (offseason week 5→6)
- `advanceToNewSeason()` - Sets classByYear for recruit conversion and adds tracking for continuing players

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

### Unified Roster Membership Check - `isPlayerOnRoster()`

**ALWAYS use `isPlayerOnRoster(player, teamAbbr, year)` for roster filtering.** This is the single source of truth exported from DynastyContext.jsx.

```javascript
import { isPlayerOnRoster } from '../context/DynastyContext'

// Filter players for a specific team/year
const rosterPlayers = players.filter(p => isPlayerOnRoster(p, teamAbbr, year))
```

**The function checks (in order)**:
1. Excludes `isHonorOnly` players
2. Excludes `isRecruit` players (not yet enrolled)
3. Excludes players with `recruitYear >= year` (haven't enrolled yet)
4. Excludes players with `leftTeam` + `leftYear` where `year > leftYear`
5. Excludes players with pending departure (`leavingYear` + `leavingReason`)
6. Excludes players with `transferredTo` set (pending transfer)
7. Uses `teamsByYear[year]` as primary check if available
8. Falls back to `team` field
9. Legacy fallback for players without team field

### Roster Data Migration

The `migrateRosterData()` function runs automatically on dynasty load (flag: `_rosterMigratedV3`):
1. **Removes future years** from `teamsByYear` for players who have left
2. **Backfills current year** in `teamsByYear` for active players who are missing it (fixes Signing Day bugs)

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

### Player statsByYear (Stats Storage) - SINGLE SOURCE OF TRUTH

**All stats are now stored ONLY in `player.statsByYear`**. Legacy dynasty-level structures (`dynasty.playerStatsByYear`, `dynasty.detailedStatsByYear`) are deprecated and automatically migrated.

```javascript
player.statsByYear = {
  2025: {
    gamesPlayed: 13,
    snapsPlayed: 850,
    passing: { cmp: 250, att: 350, yds: 3000, td: 25, int: 5, lng: 65, sacks: 10 },
    rushing: { car: 50, yds: 200, td: 3, lng: 25, fumbles: 1 },
    receiving: { rec: 0, yds: 0, td: 0, lng: 0 },
    defense: { tkl: 0, tfl: 0, sacks: 0, ff: 0, int: 0, td: 0 },
    kicking: { fgm: 0, fga: 0, lng: 0, xpm: 0, xpa: 0 },
    punting: { punts: 0, yds: 0, lng: 0, in20: 0 },
    kickReturn: { ret: 0, yds: 0, td: 0, lng: 0 },
    puntReturn: { ret: 0, yds: 0, td: 0, lng: 0 }
  }
}
```

**Stats updates**:
1. **Box score delta tracking** - When games with box scores are saved, `processBoxScoreSave()` calculates the delta between new and old stats and applies it to `player.statsByYear`. This prevents double-counting on edits.
   - Each game stores `statsContributed` for future delta calculations
   - On game deletion, `processBoxScoreDelete()` subtracts the contribution
2. **Manual entry** - TeamStats.jsx saves games/snaps and detailed stats directly to `player.statsByYear`
3. **PlayerEditModal** - Can edit individual player stats per year

**Reading stats** (in Player.jsx, TeamStats.jsx, DynastyRecords.jsx):
- Read ONLY from `player.statsByYear[year]` - NO box score fallbacks
- All components use the same single source of truth

**Delta tracking functions** (DynastyContext.jsx):
- `extractBoxScoreContribution(boxScore)` - Extracts stats contribution from a box score
- `applyBoxScoreDelta(players, newContribution, oldContribution, year)` - Applies delta to player stats
- `processBoxScoreSave(players, newBoxScore, oldContribution, year)` - Handles save/edit with delta tracking
- `processBoxScoreDelete(players, oldContribution, year)` - Subtracts stats on game deletion

**Legacy migration**:
- `migrateLegacyStats()` runs once per dynasty on load
- Migrates `dynasty.playerStatsByYear` and `dynasty.detailedStatsByYear` to each player's `statsByYear`
- Sets `dynasty._statsMigrated = true` when complete

**Stats Entry Workflow** (TeamStats.jsx):
1. **GP/Snaps Entry** (StatsEntryModal) - Enter games played and snaps for entire roster
2. **Detailed Stats Entry** (DetailedStatsEntryModal) - Enter passing, rushing, etc. stats
   - Sheet includes Snaps column (read-only) and sorts by snaps descending
   - Players with most snaps appear at top for quick data entry

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

### CFP First Round Data Format

CFP First Round games in `cfpResultsByYear[year].firstRound[]`:
```javascript
{
  seed1: 5,        // Higher seed (home team)
  seed2: 12,       // Lower seed (away team)
  team1: 'TEAM',   // Higher seed team (home)
  team2: 'OPP',    // Lower seed team (away)
  team1Score: 35,
  team2Score: 28,
  winner: 'TEAM'
}
```
**IMPORTANT**: Higher seed = home team (team1). Sheet data must be transformed from `higherSeed`/`lowerSeed` format.

### Google Sheets OAuth

- Requires OAuth access token (not Firebase ID token)
- Token stored in localStorage with 1-hour expiry
- If expired, user must sign out and back in
- Scopes: `spreadsheets` and `drive.file`

### Schedule Card Design Pattern

Both Dashboard.jsx and TeamYear.jsx use a consistent schedule card design:

```jsx
<div className="flex items-center w-full overflow-hidden">
  {/* W/L or Week Badge - left side */}
  <div className="w-10 sm:w-14 flex-shrink-0 text-center py-2 sm:py-3 rounded-l-xl font-bold text-[10px] sm:text-sm"
    style={{ backgroundColor: hasResult ? (isWin ? '#22c55e' : '#ef4444') : oppColors.textColor, color: ... }}>
    {hasResult ? (isWin ? 'W' : 'L') : weekLabel}
  </div>

  {/* Game Info - right side */}
  <div className="flex-1 flex items-center justify-between py-2 sm:py-3 px-2 sm:px-4 rounded-r-xl min-w-0"
    style={{ backgroundColor: oppColors.backgroundColor }}>
    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
      {/* Location badge: w-6 h-6 sm:w-8 sm:h-8 */}
      {/* Logo: w-7 h-7 sm:w-10 sm:h-10 */}
      {/* Team name + week subtitle */}
    </div>
    {/* Score: text-sm sm:text-lg */}
  </div>
</div>
```

**Mobile-responsive sizing**:
- Week badge: `w-10 sm:w-14`
- Location badge: `w-6 h-6 sm:w-8 sm:h-8`
- Logo: `w-7 h-7 sm:w-10 sm:h-10`
- Gaps: `gap-1.5 sm:gap-3`
- Text: `text-xs sm:text-base` for names, `text-[9px] sm:text-xs` for subtitles

## Hidden Dev Tools

Features hidden with `{false && (...)}` for future use:
- **Roster History button** - All Players page (`Players.jsx:240`)
- **Random Fill button** - Game Entry modal (`GameEntryModal.jsx:1395`)
