import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-canvas-text-muted">
        Loading session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
