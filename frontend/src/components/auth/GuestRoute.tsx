import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

/** Redirect signed-in users away from public auth screens. */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-canvas-text-muted">
        Loading session…
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
  }

  return children
}
