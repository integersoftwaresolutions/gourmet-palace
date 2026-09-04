import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

/** Temporary home: land signed-in users on Overview. */
export function HomePage() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-canvas-text-muted">
        Loading session…
      </div>
    )
  }

  return <Navigate to="/overview" replace />
}
