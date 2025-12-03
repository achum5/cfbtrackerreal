import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { DynastyProvider } from './context/DynastyContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import CreateDynasty from './pages/CreateDynasty'
import DynastyDashboard from './pages/DynastyDashboard'
import Dashboard from './pages/dynasty/Dashboard'
import Rankings from './pages/dynasty/Rankings'
import Stats from './pages/dynasty/Stats'
import CoachCareer from './pages/dynasty/CoachCareer'
import TeamHistory from './pages/dynasty/TeamHistory'
import Players from './pages/dynasty/Players'
import AllTimeLineup from './pages/dynasty/AllTimeLineup'
import Recruiting from './pages/dynasty/Recruiting'
import Leaders from './pages/dynasty/Leaders'
import Awards from './pages/dynasty/Awards'
import AllAmericans from './pages/dynasty/AllAmericans'
import AllConference from './pages/dynasty/AllConference'
import DynastyRecords from './pages/dynasty/DynastyRecords'
import TeamAchievements from './pages/dynasty/TeamAchievements'

function App() {
  return (
    <DynastyProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateDynasty />} />
            <Route path="/dynasty/:id" element={<DynastyDashboard />}>
              <Route index element={<Dashboard />} />
              <Route path="rankings" element={<Rankings />} />
              <Route path="stats" element={<Stats />} />
              <Route path="coach-career" element={<CoachCareer />} />
              <Route path="team-history" element={<TeamHistory />} />
              <Route path="players" element={<Players />} />
              <Route path="all-time-lineup" element={<AllTimeLineup />} />
              <Route path="recruiting" element={<Recruiting />} />
              <Route path="leaders" element={<Leaders />} />
              <Route path="awards" element={<Awards />} />
              <Route path="all-americans" element={<AllAmericans />} />
              <Route path="all-conference" element={<AllConference />} />
              <Route path="dynasty-records" element={<DynastyRecords />} />
              <Route path="team-achievements" element={<TeamAchievements />} />
            </Route>
          </Routes>
        </Layout>
      </Router>
    </DynastyProvider>
  )
}

export default App
