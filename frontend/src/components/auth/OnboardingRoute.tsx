import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-canvas-text-muted">
        Loading session…
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/signin" replace />
  if (isOnboarded) return <Navigate to="/" replace />

  return children
}
