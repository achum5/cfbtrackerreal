import { useEffect, useState } from 'react'
import { useParams, useNavigate, Outlet } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { useTeamColors } from '../hooks/useTeamColors'
import Sidebar from '../components/Sidebar'

export default function DynastyDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { dynasties, currentDynasty, selectDynasty } = useDynasty()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const teamColors = useTeamColors(currentDynasty?.teamName)

  useEffect(() => {
    if (id && (!currentDynasty || currentDynasty.id !== id)) {
      selectDynasty(id)
    }
  }, [id, currentDynasty, selectDynasty])

  useEffect(() => {
    if (dynasties.length > 0 && !currentDynasty) {
      navigate('/')
    }
  }, [dynasties, currentDynasty, navigate])

  // Expose sidebar toggle to parent (Layout)
  useEffect(() => {
    window.toggleDynastySidebar = () => setSidebarOpen(prev => !prev)
    return () => {
      delete window.toggleDynastySidebar
    }
  }, [])

  if (!currentDynasty) {
    return null
  }

  return (
    <div className="flex gap-6 max-w-7xl mx-auto">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        dynastyId={currentDynasty.id}
        teamColors={teamColors}
        currentYear={currentDynasty.currentYear}
      />

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
