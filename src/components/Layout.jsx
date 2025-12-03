import { Link, useLocation } from 'react-router-dom'
import { useDynasty } from '../context/DynastyContext'
import { useTeamColors } from '../hooks/useTeamColors'

export default function Layout({ children }) {
  const location = useLocation()
  const { currentDynasty } = useDynasty()

  const teamColors = useTeamColors(currentDynasty?.teamName)
  
  const isDynastyPage = location.pathname.startsWith('/dynasty/')
  const useTeamTheme = isDynastyPage && currentDynasty
  
  const headerBg = useTeamTheme ? teamColors.primary : '#1f2937'
  const headerText = useTeamTheme ? teamColors.secondary : '#f9fafb'

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ 
        backgroundColor: useTeamTheme ? teamColors.primary : '#f3f4f6'
      }}
    >
      <header
        className="shadow-sm"
        style={{ backgroundColor: headerBg }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <Link 
              to="/" 
              className="text-xl font-bold"
              style={{ color: headerText }}
            >
              CFB Dynasty Tracker
            </Link>
            <Link
              to="/create"
              className="text-sm px-3 py-1.5 rounded transition-colors hover:bg-white/20"
              style={{ color: headerText }}
            >
              + New
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
