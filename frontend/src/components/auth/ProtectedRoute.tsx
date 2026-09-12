import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-canvas-text-muted">
        Loading session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
