# CFB Dynasty Tracker

## Overview
A React application for tracking EA Sports College Football dynasty mode progress. Track your games, player stats, schedules, rosters, rankings, and season-by-season records.

## Project Structure
```
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── GameEntryModal.jsx
│   │   ├── ScheduleEntryModal.jsx
│   │   ├── RosterEntryModal.jsx
│   │   ├── RankingsEntryModal.jsx
│   │   ├── SearchableSelect.jsx
│   │   └── Layout.jsx
│   ├── pages/               # Page components
│   │   ├── Home.jsx
│   │   ├── CreateDynasty.jsx
│   │   └── DynastyDashboard.jsx
│   ├── context/             # React Context for state management
│   │   └── DynastyContext.jsx
│   ├── data/                # Static data files
│   │   ├── teams.js
│   │   └── teamColors.js
│   ├── hooks/               # Custom React hooks
│   │   └── useTeamColors.js
│   ├── App.jsx              # Main app component with routing
│   ├── main.jsx             # App entry point
│   └── index.css            # Global styles (Tailwind CSS)
├── index.html               # HTML template
├── package.json             # Dependencies and scripts
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── postcss.config.js        # PostCSS configuration
```

## Tech Stack
- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS
- **State Management**: React Context API

## Development
- Dev server runs on port 5000
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Routes
- `/` - Home page
- `/create` - Create new dynasty
- `/dynasty/:id` - Dynasty dashboard

## Team Color Theming System
The UI uses contextual theming based on where the user is in the app:
- **Home page**: Neutral dark gray (#1f2937) header/footer with light gray background - clean and professional
- **Create Dynasty page**: Starts neutral, dynamically updates to selected team's colors as you pick a team
- **Dynasty Dashboard**: Full team color theming - primary color for backgrounds, secondary for accents
- Dynasty cards on home page display in each team's colors for visual identification
- CSS custom properties (`--team-primary`, `--team-secondary`) set dynamically via `useTeamColors` hook
- Team dropdown shows color swatches for visual team selection

## Recent Changes
- December 2, 2025: 
  - Implemented full-page team color theming system across entire UI
  - Layout now applies team colors to page background, header, and footer
  - All pages (Home, CreateDynasty, DynastyDashboard) use consistent team theming
  - SearchableSelect shows color swatches for each team in dropdown
  - CreateDynasty page dynamically updates colors when selecting a team
  - Added CSS custom property utilities in index.css
  - Configured for Replit environment with proper port (5000) and host settings
  - Disabled HMR for stable Replit preview (manual refresh required after changes)
  - Updated all team names to use "Team Name Nickname" format (e.g., "Kentucky Wildcats")
  - Updated teamColors.js to match new team name format
  - Added path aliases (@, @assets) for cleaner imports
