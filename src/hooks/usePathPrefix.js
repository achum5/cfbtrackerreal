import { useParams, useLocation } from 'react-router-dom'

/**
 * Hook that returns the correct path prefix for links based on whether
 * we're in view mode (/view/:shareCode) or regular mode (/dynasty/:id)
 */
export function usePathPrefix() {
  const { id, shareCode } = useParams()
  const location = useLocation()

  // Check if we're on a view route
  const isViewMode = location.pathname.startsWith('/view/')

  if (isViewMode && shareCode) {
    return `/view/${shareCode}`
  }

  // Regular dynasty mode
  return `/dynasty/${id}`
}

export default usePathPrefix
