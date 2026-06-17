import { Navigate, useParams } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'

// The Blueprint now lives as the "Program Overview" tab on the Team page
// (team/:tid/:year?tab=blueprint). This route is kept as a redirect so any
// old links/bookmarks to /blueprint still land in the right place.
export default function DynastyBlueprint() {
  const { currentDynasty } = useDynasty()
  const { id } = useParams()

  if (!currentDynasty) return null

  const tid = currentDynasty.currentTid
  const year = currentDynasty.currentYear
  if (!tid || year == null) return <Navigate to={`/dynasty/${id}`} replace />

  return <Navigate to={`/dynasty/${id}/team/${tid}/${year}?tab=blueprint`} replace />
}
