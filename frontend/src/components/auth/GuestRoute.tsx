import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

/** Redirect authenticated users away from sign-in / sign-up. */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-canvas-text-muted">
        Loading session…
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
