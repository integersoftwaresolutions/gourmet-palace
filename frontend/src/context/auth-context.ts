import { createContext } from 'react'
import type { AuthUser, Permissions } from '../lib/api'

export type AuthContextValue = {
  user: AuthUser | null
  permissions: Permissions | null
  loading: boolean
  isAuthenticated: boolean
  isOnboarded: boolean
  isAdmin: boolean
  signin: (email: string, password: string) => Promise<AuthUser>
  signout: () => Promise<void>
  refreshUser: () => Promise<AuthUser>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
