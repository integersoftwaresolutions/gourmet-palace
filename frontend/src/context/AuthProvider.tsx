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
    return res.data.user
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authApi.me()
        if (!cancelled) {
          setUser(res.data.user)
          setPermissions(res.data.permissions)
        }
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
  }, [])

  const signin = useCallback(
    async (email: string, password: string) => {
      await authApi.signin({ email, password })
      return refreshUser()
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
      isOnboarded: Boolean(user?.onboardingComplete),
      isAdmin: Boolean(permissions?.isAdmin),
      signin,
      signout,
      refreshUser,
    }),
    [user, permissions, loading, signin, signout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
