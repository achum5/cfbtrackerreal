import { Suspense, Component } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DynastyProvider } from './context/DynastyContext'
import Layout from './components/Layout'
import { ToastProvider, ConfirmProvider } from './components/ui'
import ScrollToTop from './components/ScrollToTop'
import RouteFallback from './components/RouteFallback'

// Eager: entry points, auth, and page wrappers (small + always-on-first-paint)
import Login from './pages/Login'
import Home from './pages/Home'
import CreateDynasty from './pages/CreateDynasty'
import DynastyDashboard from './pages/DynastyDashboard'
import Account from './pages/Account'
import ViewDynasty from './pages/ViewDynasty'
import JoinDynasty from './pages/JoinDynasty'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Contact from './pages/Contact'

// Lazy pages with `.preload()` capability — see routes/lazyPages.js
import {
  Dashboard, Roster, Rankings, Stats, CoachCareer, Coaches, Players, Player, PlayerEdit,
  PlayersByState, AllTimeLineup, Recruiting, Leaders, Awards, AllAmericans,
  AllConference, DynastyRecords, Teams, TeamYear, BowlHistory,
  ConferenceChampionshipHistory, ConferenceStandings, CFPBracket, WeeklyScores, Game,
  GameEdit, DangerZone, LeagueSettings, CardCollection,
} from './routes/lazyPages'

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const isDev = import.meta.env.VITE_DEV_MODE === 'true'

  // In dev mode, skip authentication
  if (isDev) {
    return children
  }

  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public policy pages - no auth required */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />

          {/* Public view routes - no auth required, reuses same components */}
          <Route path="/view/:shareCode" element={<ViewDynasty />}>
            <Route index element={<Dashboard />} />
            <Route path="player/:pid" element={<Player />} />
            <Route path="roster" element={<Roster />} />
            <Route path="rankings" element={<Rankings />} />
            <Route path="rankings/:year" element={<Rankings />} />
            <Route path="stats" element={<Stats />} />
            <Route path="coach-career" element={<CoachCareer />} />
            <Route path="coaches" element={<Coaches />} />
            <Route path="players" element={<Players />} />
            <Route path="players/state/:state" element={<PlayersByState />} />
            <Route path="all-time-lineup" element={<AllTimeLineup />} />
            <Route path="recruiting" element={<Recruiting />} />
            <Route path="recruiting/:tid/:year" element={<Recruiting />} />
            <Route path="recruiting/portal/:tid/:year" element={<Recruiting />} />
            <Route path="leaders" element={<Leaders />} />
            <Route path="awards" element={<Awards />} />
            <Route path="awards/:year" element={<Awards />} />
            <Route path="all-americans" element={<AllAmericans />} />
            <Route path="all-americans/:year" element={<AllAmericans />} />
            <Route path="all-conference" element={<AllConference />} />
            <Route path="all-conference/:year" element={<AllConference />} />
            <Route path="all-conference/:year/:conference" element={<AllConference />} />
            <Route path="dynasty-records" element={<DynastyRecords />} />
            <Route path="dynasty-records/:category" element={<DynastyRecords />} />
            <Route path="teams" element={<Teams />} />
            <Route path="team/:tid/:year" element={<TeamYear />} />
            <Route path="bowl-history" element={<BowlHistory />} />
            <Route path="conference-championship-history" element={<ConferenceChampionshipHistory />} />
            <Route path="conference-standings" element={<ConferenceStandings />} />
            <Route path="conference-standings/:year" element={<ConferenceStandings />} />
            <Route path="cfp-bracket" element={<CFPBracket />} />
            <Route path="cfp-bracket/:year" element={<CFPBracket />} />
            <Route path="weekly-scores" element={<WeeklyScores />} />
            <Route path="weekly-scores/:year" element={<WeeklyScores />} />
            <Route path="weekly-scores/:year/:week" element={<WeeklyScores />} />
            <Route path="cards" element={<CardCollection />} />
            <Route path="game/:gameId" element={<Game />} />
            <Route path="admin" element={<DangerZone />} />
          </Route>

          {/* All other routes wrapped in DynastyProvider */}
          <Route path="/*" element={
            <DynastyProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout>
                      <Home />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/create" element={
                  <ProtectedRoute>
                    <Layout>
                      <CreateDynasty />
                    </Layout>
                  </ProtectedRoute>
                } />
                <Route path="/account" element={
                  <ProtectedRoute>
                    <Layout>
                      <Account />
                    </Layout>
                  </ProtectedRoute>
                } />
                {/* Invite redemption — no ProtectedRoute wrapper because
                    JoinDynasty handles the signed-out case itself with a
                    sign-in CTA (it stashes the URL for post-login bounce). */}
                <Route path="/join/:dynastyId/:token" element={
                  <Layout>
                    <JoinDynasty />
                  </Layout>
                } />
                <Route path="/dynasty/:id" element={
                  <ProtectedRoute>
                    <Layout>
                      <DynastyDashboard />
                    </Layout>
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="player/:pid" element={<Player />} />
                  <Route path="player/:pid/edit" element={<PlayerEdit />} />
                  <Route path="roster" element={<Roster />} />
                  <Route path="rankings" element={<Rankings />} />
                  <Route path="rankings/:year" element={<Rankings />} />
                  <Route path="stats" element={<Stats />} />
                  <Route path="coach-career" element={<CoachCareer />} />
                  <Route path="coaches" element={<Coaches />} />
                  <Route path="players" element={<Players />} />
                  <Route path="players/state/:state" element={<PlayersByState />} />
                  <Route path="all-time-lineup" element={<AllTimeLineup />} />
                  <Route path="recruiting" element={<Recruiting />} />
                  <Route path="recruiting/:tid/:year" element={<Recruiting />} />
                  <Route path="recruiting/portal/:tid/:year" element={<Recruiting />} />
                  <Route path="leaders" element={<Leaders />} />
                  <Route path="awards" element={<Awards />} />
                  <Route path="awards/:year" element={<Awards />} />
                  <Route path="all-americans" element={<AllAmericans />} />
                  <Route path="all-americans/:year" element={<AllAmericans />} />
                  <Route path="all-conference" element={<AllConference />} />
                  <Route path="all-conference/:year" element={<AllConference />} />
                  <Route path="all-conference/:year/:conference" element={<AllConference />} />
                  <Route path="dynasty-records" element={<DynastyRecords />} />
                  <Route path="dynasty-records/:category" element={<DynastyRecords />} />
                  <Route path="teams" element={<Teams />} />
                  <Route path="team/:tid/:year" element={<TeamYear />} />
                  <Route path="bowl-history" element={<BowlHistory />} />
                  <Route path="conference-championship-history" element={<ConferenceChampionshipHistory />} />
                  <Route path="conference-standings" element={<ConferenceStandings />} />
                  <Route path="conference-standings/:year" element={<ConferenceStandings />} />
                  <Route path="cfp-bracket" element={<CFPBracket />} />
                  <Route path="cfp-bracket/:year" element={<CFPBracket />} />
                  <Route path="weekly-scores" element={<WeeklyScores />} />
                  <Route path="weekly-scores/:year" element={<WeeklyScores />} />
                  <Route path="weekly-scores/:year/:week" element={<WeeklyScores />} />
                  <Route path="cards" element={<CardCollection />} />
                  <Route path="game/new" element={<GameEdit />} />
                  <Route path="game/:gameId" element={<Game />} />
                  <Route path="game/:gameId/edit" element={<GameEdit />} />
                  <Route path="admin" element={<DangerZone />} />
                  <Route path="league" element={<LeagueSettings />} />
                </Route>
              </Routes>
            </DynastyProvider>
          } />
        </Routes>
      </Suspense>
    </Router>
  )
}

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary] Uncaught render error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '2rem',
          backgroundColor: '#0f0f0f', color: '#e5e5e5', fontFamily: 'sans-serif',
          textAlign: 'center', gap: '1rem',
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#999', margin: 0, maxWidth: 400 }}>
            The app hit an unexpected error. Your dynasty data is safe — try refreshing, or use the button below to go back to the home screen.
          </p>
          <p style={{ color: '#555', fontSize: '0.75rem', margin: 0, maxWidth: 500, wordBreak: 'break-all' }}>
            {this.state.error?.message}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '0.6rem 1.25rem', borderRadius: 8, border: 'none', background: '#fff', color: '#000', fontWeight: 600, cursor: 'pointer' }}
            >
              Refresh
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              style={{ padding: '0.6rem 1.25rem', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: '#e5e5e5', fontWeight: 600, cursor: 'pointer' }}
            >
              Go Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <RootErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
        <Analytics />
      </AuthProvider>
    </RootErrorBoundary>
  )
}

export default App
