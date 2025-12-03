import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { DynastyProvider } from './context/DynastyContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import CreateDynasty from './pages/CreateDynasty'
import DynastyDashboard from './pages/DynastyDashboard'

function App() {
  return (
    <DynastyProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateDynasty />} />
            <Route path="/dynasty/:id" element={<DynastyDashboard />} />
          </Routes>
        </Layout>
      </Router>
    </DynastyProvider>
  )
}

export default App
