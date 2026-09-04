import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  authApi,
  type AuthUser,
  type Permissions,
} from '../lib/api'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const res = await authApi.me()
    setUser(res.data.user)
    setPermissions(res.data.permissions)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshUser()
      } catch {
        if (!cancelled) {
          setUser(null)
          setPermissions(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  const signin = useCallback(
    async (email: string, password: string) => {
      await authApi.signin({ email, password })
      await refreshUser()
    },
    [refreshUser],
  )

  const signout = useCallback(async () => {
    try {
      await authApi.signout()
    } finally {
      setUser(null)
      setPermissions(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(permissions?.isAdmin),
      signin,
      signout,
      refreshUser,
    }),
    [user, permissions, loading, signin, signout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
