import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DynastyProvider } from './context/DynastyContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import CreateDynasty from './pages/CreateDynasty'
import DynastyDashboard from './pages/DynastyDashboard'
import Dashboard from './pages/dynasty/Dashboard'
import Roster from './pages/dynasty/Roster'
import Rankings from './pages/dynasty/Rankings'
import Stats from './pages/dynasty/Stats'
import CoachCareer from './pages/dynasty/CoachCareer'
import Players from './pages/dynasty/Players'
import Player from './pages/dynasty/Player'
import AllTimeLineup from './pages/dynasty/AllTimeLineup'
import Recruiting from './pages/dynasty/Recruiting'
import Leaders from './pages/dynasty/Leaders'
import Awards from './pages/dynasty/Awards'
import AllAmericans from './pages/dynasty/AllAmericans'
import AllConference from './pages/dynasty/AllConference'
import DynastyRecords from './pages/dynasty/DynastyRecords'
import Teams from './pages/dynasty/Teams'
import Team from './pages/dynasty/Team'
import TeamYear from './pages/dynasty/TeamYear'
import BowlHistory from './pages/dynasty/BowlHistory'
import ConferenceChampionshipHistory from './pages/dynasty/ConferenceChampionshipHistory'
import ConferenceStandings from './pages/dynasty/ConferenceStandings'
import CFPBracket from './pages/dynasty/CFPBracket'
import Game from './pages/dynasty/Game'

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
    <DynastyProvider>
      <Router>
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
          <Route path="/dynasty/:id" element={
            <ProtectedRoute>
              <Layout>
                <DynastyDashboard />
              </Layout>
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="player/:pid" element={<Player />} />
            <Route path="roster" element={<Roster />} />
            <Route path="rankings" element={<Rankings />} />
            <Route path="stats" element={<Stats />} />
            <Route path="coach-career" element={<CoachCareer />} />
                        <Route path="players" element={<Players />} />
            <Route path="all-time-lineup" element={<AllTimeLineup />} />
            <Route path="recruiting" element={<Recruiting />} />
            <Route path="recruiting/:teamAbbr/:year" element={<Recruiting />} />
            <Route path="recruiting/portal/:teamAbbr/:year" element={<Recruiting />} />
            <Route path="leaders" element={<Leaders />} />
            <Route path="awards" element={<Awards />} />
            <Route path="all-americans" element={<AllAmericans />} />
            <Route path="all-conference" element={<AllConference />} />
            <Route path="dynasty-records" element={<DynastyRecords />} />
            <Route path="teams" element={<Teams />} />
            <Route path="team/:teamAbbr" element={<Team />} />
            <Route path="team/:teamAbbr/:year" element={<TeamYear />} />
            <Route path="bowl-history" element={<BowlHistory />} />
            <Route path="conference-championship-history" element={<ConferenceChampionshipHistory />} />
            <Route path="conference-standings" element={<ConferenceStandings />} />
            <Route path="cfp-bracket" element={<CFPBracket />} />
            <Route path="game/:gameId" element={<Game />} />
          </Route>
        </Routes>
      </Router>
    </DynastyProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Analytics />
    </AuthProvider>
  )
}

export default App
