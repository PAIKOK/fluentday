import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './AuthContext'
import { safeNext } from './safeNext'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <Loader2 className="size-6 animate-spin text-forest" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

/** Only signed-in users; others are sent to /login and brought back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { me, isLoading } = useAuth()
  if (isLoading) return <FullPageSpinner />
  if (!me) return <Navigate to="/login?next=/admin" replace />
  if (me.user.role !== 'admin') return <Navigate to="/app" replace />
  return children
}

/**
 * Login/register pages: signed-in users (including someone who has just logged in here)
 * go to ?next= if given, otherwise to their home area.
 */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { me, isLoading } = useAuth()
  const [params] = useSearchParams()
  if (isLoading) return <FullPageSpinner />
  if (me) {
    const home = me.user.role === 'admin' ? '/admin' : '/app'
    return <Navigate to={params.get('next') ? safeNext(params.get('next')) : home} replace />
  }
  return children
}
