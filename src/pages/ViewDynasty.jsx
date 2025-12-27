import { useState } from 'react'
import { useParams, Outlet, Link } from 'react-router-dom'
import { ViewDynastyProvider, useViewDynasty } from '../context/ViewDynastyContext'
import { useTeamColors } from '../hooks/useTeamColors'
import { getContrastTextColor } from '../utils/colorUtils'
import { getMascotName } from '../data/teams'
import ViewSidebar from '../components/ViewSidebar'

function ViewDynastyContent() {
  const { currentDynasty, loading, error } = useViewDynasty()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const teamColors = useTeamColors(currentDynasty?.teamName)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white text-lg">Loading dynasty...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Dynasty Not Available</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!currentDynasty) {
    return null
  }

  const primaryBgText = getContrastTextColor(teamColors.primary)

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header bar for mobile */}
      <div
        className="lg:hidden sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-lg"
        style={{ backgroundColor: teamColors.primary }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-black/10"
          style={{ color: primaryBgText }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: primaryBgText }}>
            {getMascotName(currentDynasty.teamName) || currentDynasty.teamName}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-black/20"
            style={{ color: primaryBgText }}
          >
            View Only
          </span>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* View-only banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 text-sm">
        <span className="font-medium">You are viewing a shared dynasty</span>
        <span className="mx-2">|</span>
        <Link to="/" className="underline hover:no-underline">
          Create your own dynasty
        </Link>
      </div>

      <ViewSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        dynasty={currentDynasty}
        teamColors={teamColors}
      />

      {/* Main content - offset by sidebar width on desktop */}
      <div className="lg:ml-56 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

export default function ViewDynasty() {
  const { shareCode } = useParams()

  return (
    <ViewDynastyProvider shareCode={shareCode}>
      <ViewDynastyContent />
    </ViewDynastyProvider>
  )
}
