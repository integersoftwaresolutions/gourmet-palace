import { createContext } from 'react'
import type { AuthUser, Permissions } from '../lib/api'

export type AuthContextValue = {
  user: AuthUser | null
  permissions: Permissions | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  signin: (email: string, password: string) => Promise<void>
  signout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
