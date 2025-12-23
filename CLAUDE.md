# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**: When you complete a new feature, fix a bug, or make significant changes to the codebase, update this file to reflect those changes. Remove outdated information and add new implementation details so this documentation stays current.

## CRITICAL: Team-Centric Coding Requirement

**ALWAYS store data at the TEAM level, NOT the user/dynasty level.**

### Why This Matters

In this dynasty tracker, users can switch teams during their coaching career (e.g., start at Central Michigan, then move to Ohio State). If data is stored at the dynasty level without team association:

- **Problem**: When user switches from Team A to Team B, Team A's schedule/roster/recruits incorrectly appear under Team B
- **Example**: User coaches at CMU for 3 years, then switches to OSU. If recruits were stored at `dynasty.recruits`, CMU's recruiting class would show up as OSU's recruiting class after the switch.

### The Pattern

**WRONG** (dynasty-level):
```javascript
dynasty.schedule = [...]
dynasty.recruits = [...]
dynasty.teamRatings = {...}
```

**CORRECT** (team-centric):
```javascript
dynasty.schedulesByTeamYear[teamAbbr][year] = [...]
dynasty.recruitingCommitmentsByTeamYear[teamAbbr][year] = {...}
dynasty.teamRatingsByTeamYear[teamAbbr][year] = {...}
```

### Checklist for New Features

When adding any new data storage:
1. Ask: "Does this data belong to a specific team?"
2. If YES → Use `dynasty.{feature}ByTeamYear[teamAbbr][year]` pattern
3. Tag individual records with `team: teamAbbr` field
4. Create helper function like `getCurrent{Feature}(dynasty)` in DynastyContext
5. Filter by team when displaying data

This was a major architectural fix that took significant effort. **Do not regress to dynasty-level storage.**

## Current Work / Reminders

**Last Session (December 2024)**: Team-Centric Data Architecture:

### MAJOR FIX: Team-Centric Data Model

Previously, schedule/roster/preseasonSetup were stored at dynasty level without team association. When user switched teams, old team's data incorrectly appeared under new team.

**New Architecture** (implemented in `DynastyContext.jsx`):

1. **Schedule**: Stored in `dynasty.schedulesByTeamYear[teamAbbr][year]`
   - Helper: `getCurrentSchedule(dynasty)` - gets schedule for current team/year
   - Fallback to legacy `dynasty.schedule` for backwards compatibility

2. **Roster/Players**: Each player has a `team` field
   - When saving roster, `team: teamAbbr` added to each player
   - Helper: `getCurrentRoster(dynasty)` - filters players by current team
   - Legacy players without `team` field treated as belonging to current team

3. **PreseasonSetup**: Stored in `dynasty.preseasonSetupByTeamYear[teamAbbr][year]`
   - Helper: `getCurrentPreseasonSetup(dynasty)` - gets setup for current team/year
   - All save functions update both team-centric structure and preseasonSetup flags

4. **TeamRatings**: Stored in `dynasty.teamRatingsByTeamYear[teamAbbr][year]`
   - Helper: `getCurrentTeamRatings(dynasty)` - gets OVR/OFF/DEF for current team/year
   - Fallback to legacy `dynasty.teamRatings` for backwards compatibility

5. **CoachingStaff**: Stored in `dynasty.coachingStaffByTeamYear[teamAbbr][year]`
   - Helper: `getCurrentCoachingStaff(dynasty)` - gets OC/DC for current team/year
   - Fallback to legacy `dynasty.coachingStaff` for backwards compatibility

6. **GoogleSheet**: Stored in `dynasty.googleSheetsByTeam[teamAbbr]`
   - Helper: `getCurrentGoogleSheet(dynasty)` - gets Sheet ID/URL for current team
   - Fallback to legacy `dynasty.googleSheetId`/`googleSheetUrl`

7. **Recruits**: Stored in `dynasty.recruitsByTeamYear[teamAbbr][year]`
   - Helper: `getCurrentRecruits(dynasty)` - gets recruits for current team/year
   - Fallback to legacy `dynasty.recruits`

8. **Team Switch Logic** (in `advanceWeek`):
   - Tags legacy players with their team before switch
   - Stores current schedule, teamRatings, coachingStaff, googleSheet in team-centric structures
   - New team starts fresh with empty schedule/roster/ratings/staff

9. **Coach Team By Year**: Stored in `dynasty.coachTeamByYear[year]`
   - Helper: `getCoachTeamForYear(dynasty, year)` - gets which team coach was coaching that year
   - Helper: `getCoachHistory(dynasty)` - gets all years with team info sorted by year
   - **LOCKED IN** at start of season (Week 1 of regular_season)
   - Does NOT change when user switches teams during offseason/players leaving phase
   - Use for: coach career records, player leaderboards, any stats tied to "coach's team"
   - Structure: `{ team: 'CMU', teamName: 'Central Michigan Chippewas', position: 'HC', conference: 'MAC' }`

10. **Locked Coaching Staff**: Stored in `dynasty.lockedCoachingStaffByYear[teamAbbr][year]`
    - Helper: `getLockedCoachingStaff(dynasty, year, teamAbbr?)` - gets staff as of Week 12
    - **LOCKED IN** at end of regular season (Week 12 → Conference Championship transition)
    - Preserves OC/DC names even if they're fired during conference championship week
    - Use for: historical season views to show "who were the coordinators that season"
    - Structure: `{ hcName: 'Coach Smith', ocName: 'John Doe', dcName: 'Jane Doe' }`

11. **Games**: Each game has a `userTeam` field
    - Set automatically when game is saved via `addGame()` in DynastyContext
    - `userTeam` = the team abbreviation that played this game
    - CPU games don't have `userTeam` (they use `team1`/`team2` instead)
    - Legacy games tagged with team before user switches teams
    - **TeamYear.jsx** filters games by `g.userTeam === teamAbbr`, not by current user's team
    - This ensures games stay with the team that played them after user switches teams

12. **Recruiting Commitments**: Stored in `dynasty.recruitingCommitmentsByTeamYear[teamAbbr][year][commitmentKey]`
    - Commitment keys by phase:
      - `preseason`: Early commitments before season starts
      - `regular_1` through `regular_12`: Weekly commitment tracking during regular season
      - `conf_champ`: Conference Championship week (conference_championship phase)
      - `bowl_1` through `bowl_4`: Bowl weeks (postseason phase weeks 1-4)
      - `signing_1` through `signing_4`: Recruiting weeks (offseason weeks 2-5)
    - Each recruit also creates a player entry with `team: teamAbbr` and `isRecruit: true`
    - **Recruits are excluded from roster displays** - they show on Recruiting page only
    - **Recruiting.jsx** filters by current team when displaying recruiting class

**Components Updated**:
- `Dashboard.jsx` - Uses all team-centric helpers, recruiting commitment prompts for all phases
- `Roster.jsx` - Uses `getCurrentRoster()`
- `TeamYear.jsx` - Uses `getLockedCoachingStaff()`, filters players by `team` field, filters games by `userTeam` field
- `Game.jsx` - Uses `getCurrentTeamRatings()`
- `GameEntryModal.jsx` - Uses `getCurrentTeamRatings()`
- `RecruitingCommitmentsModal.jsx` - Uses team-centric commitment keys, pre-populates existing commitments
- `Recruiting.jsx` - Displays recruiting class with season dropdown, filters by team

13. **Players Leaving**: Stored in `dynasty.playersLeavingByYear[year]`
    - Auto-fills graduating seniors in Google Sheet:
      - **RS Sr**: Always auto-filled (exhausted eligibility, no games requirement)
      - **Sr**: Only auto-filled if 5+ games played
    - Reasons: Graduating, Transfer Portal, Pro Draft
    - Draft declarees trigger Draft Results task in Recruiting Week 1

**Previous Sessions**:
- Recruiting Commitments Feature (December 2024) - Weekly tracking during all phases
- Players Leaving Feature (Offseason Week 1)
- CFP Slot ID System (see cfpConstants.js)
- Bowl Logo Updates

**TODO / Future Work**:
- Team stats still need implementation for:
  - CFP Appearances, National Titles
  - Heisman Winners, First-Team All-Americans
  - User's games as/against each team with win percentages
- Recruiting enhancements:
  - Convert recruits to active roster players when they enroll (start of next season)
  - Remove `isRecruit` flag and assign OVR when player enters roster via preseason sync

## Project Overview

CFB Dynasty Tracker is a React-based web application for tracking College Football (CFB) dynasty mode progression. Users can create dynasties, manage schedules, rosters, and track games through multiple seasons.

## Deployment

- **Production URL**: https://dynastytracker.vercel.app
- **Hosting**: Vercel (auto-deploys from GitHub `main` branch)
- **Firebase Project**: `cfbtracker-200ab`
- **Firebase Console**: https://console.firebase.google.com/project/cfbtracker-200ab

## Development Commands

```bash
# Start development server (runs on port 5000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Code Quality Requirements

**IMPORTANT**: After every code change, always run `npm run build` to check for type errors, syntax errors, and other issues. Fix any errors found before considering the change complete.

**Workflow**:
1. Make code changes
2. Run `npm run build`
3. If errors are found, fix them immediately
4. Repeat until build passes cleanly
5. Only then consider the task complete

This ensures the codebase stays clean and prevents accumulation of technical debt from unchecked errors.

## Git Commit Policy

**IMPORTANT**: Do NOT commit changes automatically after every task. Only commit when the user explicitly says "commit changes" (or similar).

**When user requests a commit**:
1. Run `git add -A` to stage ALL changes
2. Run `git status` to verify what will be committed
3. Create a commit with a descriptive message summarizing all changes
4. Run `git push` to push to GitHub immediately
5. Verify the push was successful

This saves time during development and ensures Vercel only deploys when the user is ready.

## Architecture

### Context Providers (State Management)

The app uses React Context API with a two-provider architecture:

1. **AuthProvider** (`src/context/AuthContext.jsx`)
   - Wraps the entire application
   - Manages Firebase Google Authentication
   - Provides `user`, `loading`, `signInWithGoogle()`, `signOut()`

2. **DynastyProvider** (`src/context/DynastyContext.jsx`)
   - Nested inside AuthProvider
   - Manages all dynasty data (CRUD operations)
   - Handles dual-mode storage (see Data Storage section)
   - Provides `dynasties`, `currentDynasty`, `createDynasty()`, `updateDynasty()`, etc.

### Data Storage: Dual-Mode System

The app operates in two modes based on `VITE_DEV_MODE` environment variable:

**Development Mode** (`VITE_DEV_MODE=true` in `.env`):
- Uses localStorage for data persistence
- No authentication required (bypasses login)
- Fast iteration, no Firebase calls
- Data stored in browser only

**Production Mode** (`VITE_DEV_MODE=false` or `.env` not present):
- Requires Google OAuth authentication
- Data stored in Firebase Firestore
- Real-time sync across devices via `subscribeToDynasties()`
- User-isolated data (each user's dynasties are private)
- Auto-migrates localStorage data on first login

All data operations in `DynastyContext` check the mode and route to appropriate storage:
```javascript
const isDev = import.meta.env.VITE_DEV_MODE === 'true'
if (isDev || !user) {
  // Use localStorage
} else {
  // Use Firestore
}
```

### Firebase Services

**Configuration**: `src/config/firebase.js`
- Exports `auth`, `googleProvider`, `db` (Firestore)
- Google provider configured with OAuth scopes:
  - `https://www.googleapis.com/auth/spreadsheets` - Create/edit Google Sheets
  - `https://www.googleapis.com/auth/drive.file` - Manage created files in Google Drive

**Dynasty Service**: `src/services/dynastyService.js`
- Contains all Firestore CRUD functions
- `subscribeToDynasties()` - Real-time listener for user's dynasties
- `migrateLocalStorageData()` - One-time migration from localStorage to Firestore
- All functions scoped to authenticated user via `userId` parameter

**Sheets Service**: `src/services/sheetsService.js`
- Google Sheets API integration for schedule/roster management
- `createDynastySheet()` - Creates new Google Sheet with Schedule and Roster tabs
- `initializeSheetHeaders()` - Sets up headers, protects first row, adds data validation and conditional formatting
- `readScheduleFromSheet()` - Reads schedule data from Google Sheet (auto-converts team abbreviations to uppercase)
- `readRosterFromSheet()` - Reads roster data from Google Sheet
- `getSheetEmbedUrl()` - Generates iframe embed URL for displaying sheets in modals
- `getAccessToken()` - Helper function to retrieve OAuth token from localStorage with expiry validation
- All API calls use OAuth access token (retrieved from localStorage, never Firebase ID tokens)

### OAuth Token Management

**Important**: Google Sheets API requires OAuth access tokens, not Firebase ID tokens.

**Token Storage** (`src/context/AuthContext.jsx`):
- OAuth access token captured during `signInWithGoogle()`
- Stored in localStorage with 1-hour expiry
- Restored on page reload if still valid
- Automatically cleared on sign out
- Token available as `user.accessToken` throughout app

**Authentication Flow**:
- Uses `signInWithPopup` on ALL devices (desktop and mobile)
- `signInWithRedirect` was removed because it's broken on Safari 16.1+, Firefox 109+, and Chrome 115+ due to third-party storage blocking
- On mobile browsers, the popup typically opens in a new tab
- Returns `null` if user closes popup (handled gracefully, not as error)

**Token Flow**:
1. User clicks "Sign in with Google"
2. Popup opens (or new tab on mobile) for Google OAuth
3. After authentication, popup closes and result is returned
4. Access token captured from `GoogleAuthProvider.credentialFromResult()`
5. Token stored: `localStorage.setItem('google_access_token', token)`
6. Expiry set: `localStorage.setItem('google_token_expiry', timestamp)` (1-hour expiry)
7. On subsequent page loads, token restored from localStorage if not expired
8. Google Sheets API calls retrieve token via `getAccessToken()` helper

**Critical**: The `getAccessToken()` function in `sheetsService.js` ONLY uses OAuth tokens from localStorage. It will throw an error if the token is missing or expired, prompting the user to sign out and back in. This prevents the common mistake of using Firebase ID tokens (which don't work with Google Sheets API).

### Route Structure

- **Public**: `/login` - Google OAuth sign-in page
- **Protected** (wrapped in `<ProtectedRoute>`):
  - `/` - Home page (list of dynasties)
  - `/create` - Create new dynasty
  - `/dynasty/:id` - Dynasty detail view with nested routes:
    - `/dynasty/:id` - Dashboard (default)
    - `/dynasty/:id/roster` - Current roster
    - `/dynasty/:id/rankings` - Final AP Top 25 (Media & Coaches polls)
    - `/dynasty/:id/stats` - Statistics
    - `/dynasty/:id/coach-career` - Coach career tracking
    - `/dynasty/:id/players` - All players list (with search/filter)
    - `/dynasty/:id/player/:pid` - Individual player page
    - `/dynasty/:id/recruiting` - Recruiting class
    - `/dynasty/:id/awards` - Player awards
    - `/dynasty/:id/all-americans` - All-American selections
    - `/dynasty/:id/all-conference` - All-Conference selections
    - `/dynasty/:id/dynasty-records` - Record book
    - `/dynasty/:id/team-achievements` - Team accomplishments
    - `/dynasty/:id/teams` - All FBS teams list
    - `/dynasty/:id/team/:teamAbbr` - Individual team history
    - `/dynasty/:id/team/:teamAbbr/:year` - Team year details
    - `/dynasty/:id/cfp-bracket` - College Football Playoff bracket
    - `/dynasty/:id/bowl-history` - Bowl game history
    - `/dynasty/:id/conference-standings` - Conference standings by year
    - `/dynasty/:id/game/:gameId` - Individual game detail page

`ProtectedRoute` component in `App.jsx` checks dev mode first, then user authentication.

### Dynasty Data Model

Each dynasty object contains:
```javascript
{
  id: string,
  userId: string, // (Firestore only)
  teamName: string,
  coachName: string,
  conference: string,
  startYear: number,
  currentYear: number,
  currentWeek: number,
  currentPhase: 'preseason' | 'regular_season' | 'postseason' | 'offseason',
  googleSheetId: string, // (Optional) ID of associated Google Sheet
  googleSheetUrl: string, // (Optional) Direct URL to Google Sheet
  nextPID: number, // Next Player ID to assign (starts at 1, increments forever)
  schedule: Array<{
    week: number,
    userTeam: string,
    opponent: string,
    location: 'home' | 'away' | 'neutral'
  }>,
  games: Array<{id, week, opponent, location, result, teamScore, opponentScore}>,
  players: Array<{
    pid: number, // Unique Player ID (sequential, persists for player's entire career)
    id: string, // React key (formatted as 'player-{pid}')
    name: string,
    position: string,
    year: string, // Class: Fr, RS Fr, So, RS So, Jr, RS Jr, Sr, RS Sr
    jerseyNumber: string, // Jersey number (e.g., "12", "99")
    devTrait: string, // Elite, Star, Impact, Normal
    archetype: string, // Player archetype (e.g., "Pocket Passer", "Speed Rusher")
    overall: number, // Overall rating (0-99)
    height: string, // Height (e.g., "6'2\"")
    weight: number, // Weight in lbs
    hometown: string,
    state: string // State abbreviation
  }>,
  preseasonSetup: {
    scheduleEntered: boolean,
    rosterEntered: boolean,
    teamRatingsEntered: boolean,
    coachingStaffEntered: boolean // Only required for HC
  },
  conferenceChampionshipsByYear: { // Conference championship results by year
    [year: number]: Array<{
      conference: string,
      team1: string,
      team2: string,
      team1Score: number,
      team2Score: number,
      winner: string // Team abbreviation of winner
    }>
  },
  cfpSeedsByYear: { // CFP seeds entered in Bowl Week 1
    [year: number]: Array<{ seed: number, team: string }> // Seeds 1-12
  },
  cfpResultsByYear: { // CFP game results by round
    [year: number]: {
      firstRound: Array<{ // 4 games: 5v12, 8v9, 6v11, 7v10
        seed1: number,
        seed2: number,
        team1: string,
        team2: string,
        team1Score: number,
        team2Score: number,
        winner: string
      }>,
      // Future: quarterfinals, semifinals, championship
    }
  },
  bowlGamesByYear: { // Bowl game results by week
    [year: number]: {
      week1: Array<{ bowlName, team1, team2, team1Score, team2Score, winner }>,
      // Future: week2, week3, etc.
    }
  },
  lastModified: number, // Timestamp (Date.now()) - auto-updated on every dynasty update
  // ... additional fields
}
```

**Player ID (PID) System**:
- Every player gets a unique sequential PID when first added to the roster
- PIDs start at 1 and increment forever throughout the dynasty's lifetime
- PIDs persist across seasons and are used to track players throughout their careers
- `nextPID` field tracks the next available PID
- Initial roster sync assigns PIDs 1, 2, 3, etc.
- Future player additions (recruiting, transfers) continue incrementing from the current `nextPID`
- PIDs are never reused, even if a player graduates or transfers out

### Google Sheets Integration

**When Enabled**: Dynasties created with authenticated users automatically create Google Sheets.

**Sheet Structure**:
- **Schedule Tab** (4 columns):
  - Week, User Team, CPU Team, Site
  - Week column pre-filled with numbers 1-12 (12 regular season games)
  - User Team column pre-filled with user's team abbreviation
  - Header row is protected (cannot be edited) and frozen (stays visible when scrolling)
  - **Data Validation**:
    - User Team and CPU Team columns have STRICT dropdown validation (only accepts values from list)
    - Site column has STRICT dropdown with options: "Home", "Road", "Neutral"
  - **Conditional Formatting**: Team abbreviations automatically styled with team colors (background + text color)
  - All cells formatted with Barlow font, size 10, bold, italic, centered

- **Roster Tab** (11 columns):
  - A: Name, B: Position, C: Class, D: Dev Trait, E: Jersey #, F: Archetype, G: Overall, H: Height, I: Weight, J: Hometown, K: State
  - 85 rows for players (roster limit)
  - Header row is protected and frozen
  - **Data Validation**:
    - Position (B): STRICT dropdown with all CFB positions: QB, HB, FB, WR, TE, LT, LG, C, RG, RT, LEDG, REDG, DT, SAM, MIKE, WILL, CB, FS, SS, K, P
    - Class (C): STRICT dropdown with: Fr, RS Fr, So, RS So, Jr, RS Jr, Sr, RS Sr
    - Dev Trait (D): STRICT dropdown with: Elite, Star, Impact, Normal
    - Archetype (F): STRICT dropdown with all player archetypes
    - Height (H): Dropdown with heights from 5'6" to 6'8"
    - State (K): STRICT dropdown with all US state abbreviations
  - All cells formatted with Barlow font, size 10, bold, italic, centered

**Team Abbreviations**:
- Dropdown validation contains uppercase team abbreviations only (e.g., "BAMA", "ALA")
- Validation is STRICT (`strict: true`) - users cannot type invalid values
- Users can type uppercase to autocomplete (e.g., typing "BAMA" filters dropdown)
- Lowercase typing won't autocomplete due to Google Sheets case-sensitivity
- When syncing data, team abbreviations are automatically converted to uppercase as a safety measure

**Conditional Formatting**:
- Team color formatting applies to both uppercase and lowercase abbreviations
- Colors defined in `src/data/teamAbbreviations.js`
- Formatting includes team-specific background color and text color for readability
- Only supports bold, italic, and colors (fontFamily/fontSize not allowed in conditional rules)

**Enabling for Existing Dynasties**:
- Function: `createGoogleSheetForDynasty(dynastyId)` in DynastyContext
- Adds `googleSheetId` and `googleSheetUrl` to dynasty
- Only works if user is authenticated (requires OAuth token)

**Entry Modals**:
- **ScheduleEntryModal.jsx**: Combined modal for both schedule AND roster entry
  - Conditionally renders based on `currentDynasty?.googleSheetId`
  - If Google Sheet exists: Shows iframe embed at 95% viewport size
  - If no Google Sheet: Shows custom spreadsheet component
  - "Sync & Save" button syncs BOTH schedule and roster in single operation
  - Modal title: "Schedule and Roster Entry"
  - **Scroll Behavior**: Prevents background scrolling via `document.body.style.overflow = 'hidden'`
  - Takes `onRosterSave` prop in addition to `onSave` for schedule

- **RosterEntryModal.jsx**: Standalone roster modal (currently not used, replaced by combined modal)

**Data Sync Process**:

**Combined Schedule & Roster Sync** (`handleSyncFromSheet` in `ScheduleEntryModal.jsx`):
1. Reads schedule data from Google Sheet via `readScheduleFromSheet()`
2. Reads roster data from Google Sheet via `readRosterFromSheet()`
3. Calls `await onSave(schedule)` → `saveSchedule(dynastyId, schedule)` in DynastyContext
4. Calls `await onRosterSave(roster)` → `saveRoster(dynastyId, players)` in DynastyContext
5. Both operations complete before modal closes

**Schedule Save** (`saveSchedule` in DynastyContext):
1. Team abbreviations automatically converted to uppercase
2. Updates dynasty with schedule data
3. Marks `preseasonSetup.scheduleEntered = true` using:
   - **Dev Mode**: Object spread with full preseasonSetup object
   - **Production Mode**: Firestore dot notation (`'preseasonSetup.scheduleEntered': true`) to merge nested field
4. Schedule displayed in Dashboard's "YYYY Schedule" section with team colors, logos, and vs/@ indicators

**Roster Save** (`saveRoster` in DynastyContext):
1. Handles PID assignment differently based on dynasty phase:
   - **During Preseason**: Replaces entire roster (prevents duplicates on re-sync), assigns PIDs starting from 1
   - **After Preseason**: Merges with existing roster (for recruiting additions), continues PID sequence from `nextPID`
2. Updates dynasty's `nextPID` to the next available number
3. Marks `preseasonSetup.rosterEntered = true` using:
   - **Dev Mode**: Object spread with full preseasonSetup object
   - **Production Mode**: Firestore dot notation (`'preseasonSetup.rosterEntered': true`) to merge nested field
4. Players displayed in Dashboard's "Current Roster" table with clickable names linking to player pages

### Dashboard Features

**Preseason Setup Progress** (`src/pages/dynasty/Dashboard.jsx`):
- Task 1: "Enter Schedule & Roster" - Shows progress: "X/12 games • X/85 players"
- Task 2: "Enter Team Ratings" - Shows: "OVR • OFF • DEF" ratings
- Task 3: "Enter Coordinators" (HC only) - Shows: "OC: Name • DC: Name"
- **Visual States**:
  - **Incomplete**: Circle with number (1, 2, 3), team-colored styling
  - **Complete**: Green circle with checkmark (w-10 h-10, strokeWidth 3), green text, "✓ Ready" indicator
  - Green border and background (`border-green-200 bg-green-50`) when complete
- `canAdvanceFromPreseason()` checks all required tasks (scheduleEntered, rosterEntered, teamRatingsEntered, and coachingStaffEntered for HC users)
- After completion, button text changes to "Edit"

**Schedule Display**:
- Shows full mascot names (e.g., "Oregon Ducks") instead of abbreviations
- Each game tile uses opponent team colors (background + text)
- Team logos displayed next to opponent names
- vs/@ badges with inverted team colors indicate home/away games
- "Road" location in Google Sheet normalized to "away" for proper @ display
- Mascot name mapping for all 136 FBS teams (via `getMascotName()` function)
- Games with results show W/L badge and score with green/red styling

**Roster Display**:
- Player names are clickable links to individual player pages
- Links use team primary color with hover underline
- Route pattern: `/dynasty/:id/player/:pid`

### Player Pages

**All Players List** (`src/pages/dynasty/Players.jsx`):
- Route: `/dynasty/:id/players`
- Search bar: filters by name, position, hometown, state, jersey number, archetype
- Position filter dropdown: All, Offense, Defense, or specific position groups
- Sortable columns: Player, Position, Year, Overall, Dev Trait
- Dev trait badges are color-coded (Elite=gold, Star=purple, Impact=blue, Normal=gray)
- Player count displayed in header
- All player names link to individual player pages

**Individual Player Pages** (`src/pages/dynasty/Player.jsx`):
- Route: `/dynasty/:id/player/:pid`
- Displays player header with team-colored styling:
  - Player name, position, year, dev trait
  - Large overall rating badge (text-6xl)
- Career Honors section: Awards, All-Americans, All-Conference badges
- POW accolades: Conference/National Player of the Week counts with clickable details
- Career statistics tables (Football Reference style) - only shown if player has stats
- Notes & Media section for player notes and external links
- Uses `useParams()` to extract `pid` from URL
- Finds player by matching `pid` in dynasty's players array

### Team Pages (All Teams Feature)

**Teams List Page** (`src/pages/dynasty/Teams.jsx`):
- Route: `/dynasty/:id/teams`
- Displays all 136 FBS teams in alphabetical order
- Search functionality filters by team name, abbreviation, or mascot
- Each team tile shows logo and full mascot name (e.g., "Alabama Crimson Tide")
- Team tiles use team-specific colors (background + text)
- `getMascotName()` function maps abbreviations to full mascot names for logo lookup

**Individual Team Page** (`src/pages/dynasty/Team.jsx`):
- Route: `/dynasty/:id/team/:teamAbbr`
- Header with team logo, name, conference, and **final ranking** (e.g., "#5 Kentucky Wildcats")
- Final ranking pulled from most recent year's media poll in `finalPollsByYear`
- **Team Accomplishments Section**:
  - AP Top 25 Finishes - **dynamically calculated** from `finalPollsByYear` (counts years team appears in media poll)
  - Conference Titles - **dynamically calculated** from `conferenceChampionshipsByYear`
  - CFP Appearances, National Titles - reads from `teamHistories` (placeholder)
  - Heisman Winners, First-Team All-Americans - reads from `teamHistories` (placeholder)
- **Your History Section**:
  - Games played as this team / Win %
  - Games played against this team / Win %
- **Head-to-Head Record**:
  - All-time record vs this opponent
  - Best year and worst year (clickable links)
- **Season-by-Season Grid**:
  - Clickable tiles for each year showing record
  - Links to TeamYear page for game details

**Team Year Page** (`src/pages/dynasty/TeamYear.jsx`):
- Route: `/dynasty/:id/team/:teamAbbr/:year`
- **Conference Championship Section** (if team participated):
  - Shows WIN/LOSS badge with green/red styling
  - Displays score, conference name, opponent
  - Shows "🏆 CHAMPION" indicator for winners
- Shows all games involving that team for a specific year
- Displays season record summary
- Game-by-game details with scores and results

**Conference Championships Data Structure** (fully implemented):
```javascript
dynasty.conferenceChampionshipsByYear = {
  2025: [
    { conference: 'SEC', team1: 'UK', team2: 'UGA', team1Score: 31, team2Score: 24, winner: 'UK' },
    { conference: 'Big Ten', team1: 'OSU', team2: 'MICH', team1Score: 28, team2Score: 35, winner: 'MICH' },
    // ... other conferences
  ],
  2026: [...],
  // ... other years
}
// Conference titles count is calculated by counting times team is 'winner' across all years
```

**Legacy Data Structure** (partially implemented - only teamHistories used for non-CC stats):
```javascript
dynasty.teamHistories = {
  'BAMA': {
    apTop25Media: 3,      // Not yet populated
    apTop25Coaches: 2,    // Not yet populated
    cfpAppearances: 2,    // Not yet populated
    nationalTitles: 1,    // Not yet populated
    heismanWinners: 0,    // Not yet populated
    allAmericans: 5,      // Not yet populated
    gamesAs: 24,          // Not yet populated
    winsAs: 20,           // Not yet populated
    gamesVs: 2,           // Not yet populated
    winsVs: 1             // Not yet populated
  },
  // ... other teams
}
```

### CFP Bracket (`src/pages/dynasty/CFPBracket.jsx`)

- Route: `/dynasty/:id/cfp-bracket`
- Displays 12-team College Football Playoff bracket
- Year selector dropdown to view previous years' brackets

**Bracket Structure**:
- First Round: 4 games (5v12, 8v9, 6v11, 7v10)
- Quarterfinals: 4 games hosted by seeds 1-4 (Sugar, Orange, Rose, Cotton Bowls)
- Semifinals: Peach Bowl and Fiesta Bowl
- Championship: National Championship

**Data Flow**:
1. Seeds entered during Bowl Week 1 → stored in `cfpSeedsByYear[year]`
2. First Round results entered in Bowl Week 1 sheet → extracted and saved to `cfpResultsByYear[year].firstRound`
3. User's CFP games entered via `GameEntryModal` → saved to both `games` array and `cfpResultsByYear`
4. CPU vs CPU games entered via `GameEntryModal` → saved to `cfpResultsByYear` only

**Click Interactions**:
- Click any played matchup to navigate to game page (`/dynasty/:id/game/:gameId`)
- Game pages show full game details with sports broadcast-style UI
- Edit button on game page opens `GameEntryModal` for modifications
- Unplayed matchups are not clickable

**KNOWN ISSUE**: Bracket advancement is broken - winners don't properly populate later rounds after phase changes. This needs fixing.

### Game Page (`src/pages/dynasty/Game.jsx`)

- Route: `/dynasty/:id/game/:gameId`
- Dedicated page for viewing individual game details
- Sports broadcast-style UI design

**Visual Design**:
- Gradient header bar using both teams' colors
- Dark scoreboard section (gray-900 to gray-800 gradient)
- Team logos in colored circular containers with hover effects
- Large score display with winner highlighted in white, loser grayed out
- "WIN" badge (green pill) under winning team's score
- Ranking badges (yellow circles) for ranked teams

**Sections**:
- Scoreboard with teams, logos, scores, rankings
- Scoring Summary table (if quarters data exists)
- Team Ratings cards (OVR, OFF, DEF for both teams)
- Player of the Week cards (Conference and National POW)
- Game Notes section
- Media Links section

**Game Lookup** (in `findGame` function):
- First tries direct ID match in `games[]` array
- Fallback patterns for special game types:
  - `cc-{year}` or `cc-{year}-{slug}`: Conference championships from `conferenceChampionshipsByYear`
  - `bowl-{year}-{slug}`: Bowl games from `games[]` or `bowlGamesByYear`
  - `cfp-{year}-{slug}`: CFP games from `cfpResultsByYear` (quarterfinals, semifinals, championship)

### Bowl Week Modals

**BowlWeek1Modal.jsx** (`src/components/BowlWeek1Modal.jsx`):
- Creates Google Sheet with 30 bowl games + 4 CFP First Round games
- CFP First Round teams pre-filled based on seeds from previous task
- Desktop: Shows embedded iframe
- Mobile: Shows "Open in Google Sheets" button with instructions
- "Save & Move to Trash" syncs data and deletes sheet
- "Save & Keep Sheet" syncs data and keeps sheet for later editing

**Bowl Games Data** (`src/services/sheetsService.js`):
- `BOWL_GAMES_WEEK_1` array contains all 34 game names
- `CFP_FIRST_ROUND_MATCHUPS` maps game names to seed pairings
- `createBowlWeek1Sheet()` accepts `cfpSeeds` parameter for pre-filling
- `readBowlGamesFromSheet()` reads all games with teams and scores

### Team Theming System

The app features dynamic theming based on selected CFB team:

- **Team Data**: `src/data/teams.js` - Team names and logos
- **Team Colors**: `src/data/teamColors.js` - Primary/secondary colors per team
- **Team Abbreviations**: `src/data/teamAbbreviations.js` - Maps abbreviations to full names and colors
- **Hook**: `src/hooks/useTeamColors.js` - Returns colors for a given team
- **Usage**: Layout header, buttons, and dynasty pages use team colors when viewing a dynasty

### Spreadsheet Components

Schedule and Roster entry use custom spreadsheet-like components:

- `ScheduleSpreadsheet.jsx` - Editable schedule grid with team search dropdown
- `RosterSpreadsheet.jsx` - Editable roster grid
- Both support clipboard paste (Ctrl+V) from Excel/Google Sheets
- Use `handlePaste()` to parse tab-delimited data

### Phase System

Dynasties progress through phases:
1. **Preseason** - Week 0, setup mode (schedule/roster entry)
2. **Regular Season** - Weeks 1-12, game entry
3. **Conference Championship** - Separate phase (not postseason week 1)
   - CC game entry, coordinator firing decisions, CFP seeds entry
4. **Postseason** - Weeks 1-5 (Bowl Weeks):
   - Week 1: Bowl Week 1 (30 bowl games + CFP First Round)
   - Week 2: Bowl Week 2 (user's CFP Quarterfinal if applicable)
   - Week 3: Bowl Week 3 (user's CFP Semifinal if applicable)
   - Week 4: National Championship (all remaining CFP results + Championship)
   - Week 5: End of Season Recap (stats, polls, standings entry)
5. **Offseason** - Weeks 1-5:
   - Week 1: Players Leaving
   - Weeks 2-5: Recruiting Weeks 1-4 (formerly "Signing Day")

`advanceWeek()` in DynastyContext handles phase transitions automatically.

**Important Phase/Week Distinction**:
- `conference_championship` is its own phase, NOT postseason week 1
- Postseason week 1 = Bowl Week 1 (displayed as "Bowl Week 1" in UI)
- `getCommitmentKey()` and `getRecruitingLabel()` in Dashboard.jsx handle this mapping

## Important Notes

### Development vs Production

Always check which mode you're in when testing:
- Look for `.env` file with `VITE_DEV_MODE=true` for dev mode
- Change to `false` or remove file to test production Firebase features
- Must restart dev server after changing `.env`

### Firebase Rules

When modifying Firestore operations, ensure Firebase security rules allow user-scoped operations:
```javascript
// Example: Always include userId in queries
where('userId', '==', userId)
```

### Team Colors

Team colors drive the entire UI when viewing a dynasty. If adding new UI elements:
- Use `useTeamColors(teamName)` hook
- Apply colors to backgrounds/text as appropriate
- Use `getContrastTextColor()` utility for text readability

### Async Operations & State Management

Most dynasty operations are async (especially in production mode). Always:
- Use `async/await` in DynastyContext functions
- Handle errors appropriately
- Real-time listener in Firestore mode will update UI automatically after mutations
- **Important**: `createDynasty()` is async - must await before navigating to new dynasty

**State Updates** (`updateDynasty` in DynastyContext):
- **Dev Mode**: Reads from localStorage before each update to prevent race conditions
- **Production Mode**: Uses Firestore dot notation for nested field updates (e.g., `'preseasonSetup.scheduleEntered': true`)
- Updates `currentDynasty` with full updated object from array (not shallow merge) to preserve nested properties
- Immediately saves to localStorage (dev) or Firestore (production) before updating React state

## Troubleshooting

### Dynasty Creation Not Working

**Symptom**: Clicking "Create Dynasty" does nothing

**Common Causes**:
1. Missing `await` on `createDynasty()` call - function returns promise
2. Google Sheets API not enabled in Google Cloud Console
3. OAuth access token expired or missing

**Solution**:
- Ensure `handleSubmit` is async and awaits `createDynasty()`
- Check browser console for errors
- If Google Sheets errors, enable APIs at console.developers.google.com

### Google Sheets Integration Failing

**Symptom**: "Invalid authentication credentials. Expected OAuth 2 access token" error

**Root Cause**: The code was falling back to Firebase ID tokens when OAuth token wasn't available. Google Sheets API requires OAuth access tokens, not Firebase ID tokens.

**Solution Implemented**:
- Updated `getAccessToken()` in `sheetsService.js` to ONLY retrieve OAuth tokens from localStorage
- Removed fallback to `user.getIdToken()` (Firebase ID token)
- Function now throws clear error if OAuth token missing or expired
- All Sheets API calls use this helper function

**If Error Occurs**:
1. Sign out and sign back in to generate fresh OAuth token
2. Verify Google Sheets API and Google Drive API are enabled in Cloud Console
3. Check browser console for `localStorage` keys: `google_access_token` and `google_token_expiry`

**Symptom**: "ConditionalFormatRule.format only supports bold, italic, strikethrough, foreground color and background color"

**Cause**: Trying to set `fontFamily` or `fontSize` in conditional formatting rules

**Solution**: Only use bold, italic, and colors in conditional formatting. Font settings belong in general cell formatting (applied via `repeatCell` requests), not in `addConditionalFormatRule` requests.

**Symptom**: Dropdown validation shows error when typing lowercase team abbreviations

**Solution**: Validation is now STRICT - users must select from dropdown (uppercase only) or type uppercase to autocomplete. When data is synced from sheet, it's automatically converted to uppercase.

### Dev Mode vs Production

**Recommendation**: Use **Production Mode** (Firebase) for reliability and to avoid localStorage race conditions.

**Development Mode** (`VITE_DEV_MODE=true`):
- Uses localStorage for data persistence
- No authentication required (bypasses login)
- Fast iteration, no Firebase calls
- **Limitations**:
  - localStorage race conditions with rapid updates
  - State synchronization issues (React state may not reflect localStorage immediately)
  - Data only persists in browser
- **Use Case**: Quick testing without authentication

**Production Mode** (`VITE_DEV_MODE=false` or not set):
- Uses Firebase Firestore for data storage
- Requires Google OAuth authentication
- Real-time sync via Firestore listeners
- Firestore dot notation prevents nested field replacement
- Data persists across devices
- **Benefits**:
  - No race conditions (Firestore handles concurrent updates)
  - Automatic state updates via real-time listeners
  - More reliable for multi-step operations
- **Google Sheets**: Only works with authenticated users (OAuth token needed)

**Important**: Must restart dev server after changing `.env` file

### Preseason Setup Flags Not Persisting

**Symptom**: "Please complete schedule and roster entry" error even after syncing data from Google Sheets

**Root Cause**: In production mode, when `saveRoster` runs immediately after `saveSchedule`, it uses stale state because Firestore's real-time listener hasn't updated yet. The roster save was replacing the entire `preseasonSetup` object, losing the `scheduleEntered: true` flag.

**Solution Implemented**:
- **Production Mode**: Use Firestore dot notation for nested field updates
  - `saveSchedule`: Uses `'preseasonSetup.scheduleEntered': true` instead of replacing entire object
  - `saveRoster`: Uses `'preseasonSetup.rosterEntered': true` instead of replacing entire object
  - Firestore merges these fields without replacing other properties
- **Dev Mode**: Read from localStorage before each save to get latest data
  - Both `saveSchedule` and `saveRoster` read fresh data from localStorage
  - Spread operator preserves all existing flags: `{ ...dynasty.preseasonSetup, scheduleEntered: true }`
- **State Management**: `updateDynasty` now updates `currentDynasty` with full object from array (not shallow merge)

**Verification**: Check browser console logs when syncing to confirm both flags are true:
```
scheduleEntered: true
rosterEntered: true
Can advance: true
```

### Protected Header Rows

Google Sheets header rows are protected via `addProtectedRange` API request. If users report being able to edit headers, check that protection was applied during sheet creation in `initializeSheetHeaders()`.

### Mobile Authentication

**Status**: Working on both desktop and mobile.

**Implementation**: Uses `signInWithPopup` for ALL devices (desktop and mobile). On mobile browsers, the popup opens as a new tab.

**Why not `signInWithRedirect`?** Modern browsers (Safari 16.1+, Firefox 109+, Chrome 115+) block third-party storage access, breaking the redirect flow. Popup works reliably because it doesn't rely on cross-origin storage.

**Error Handling**:
- `auth/popup-blocked`: Shows message to allow popups
- `auth/popup-closed-by-user`: Returns `null` gracefully
