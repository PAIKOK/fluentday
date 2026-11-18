import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '@/lib/api'
import type { Me, Profile } from '@/types/auth'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api<Me>('/auth/me')
      .then((result) => !cancelled && setMe(result))
      .catch((error) => {
        if (!(error instanceof ApiError && error.status === 401)) console.error(error)
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<Me>('/auth/login', { method: 'POST', json: { email, password } })
    setMe(result)
    return result
  }, [])

  const logout = useCallback(async () => {
    await api<void>('/auth/logout', { method: 'POST' })
    setMe(null)
  }, [])

  const setProfile = useCallback((profile: Profile) => {
    setMe((current) => (current ? { ...current, profile } : current))
  }, [])

  const value = useMemo<AuthState>(
    () => ({ me, isLoading, login, logout, setMe, setProfile }),
    [me, isLoading, login, logout, setProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
