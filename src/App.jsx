import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { DynastyProvider } from './context/DynastyContext'
import Home from './pages/Home'
import CreateDynasty from './pages/CreateDynasty'
import DynastyDashboard from './pages/DynastyDashboard'

function App() {
  return (
    <DynastyProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateDynasty />} />
          <Route path="/dynasty/:id" element={<DynastyDashboard />} />
        </Routes>
      </Router>
    </DynastyProvider>
  )
}

export default App
