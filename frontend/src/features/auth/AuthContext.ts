import { createContext, useContext } from 'react'
import type { Me, Profile } from '@/types/auth'

export interface AuthState {
  me: Me | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<Me>
  logout: () => Promise<void>
  /** Replace the signed-in user (after signing up) or just the profile (after saving settings). */
  setMe: (me: Me | null) => void
  setProfile: (profile: Profile) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
