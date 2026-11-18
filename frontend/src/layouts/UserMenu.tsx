import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { errorMessage } from '@/lib/api'

interface UserMenuProps {
  onNavigate?: () => void
  /** Show a link to the other area (admin ↔ learner app). */
  switchTo?: 'admin' | 'app'
}

export function UserMenu({ onNavigate, switchTo }: UserMenuProps) {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  if (!me) return null
  const initials = me.profile.full_name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function onLogout() {
    try {
      await logout()
      onNavigate?.()
      navigate('/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-semibold text-forest">
          {initials || '?'}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{me.profile.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">{me.user.email}</span>
        </span>
      </div>
      {switchTo === 'admin' && me.user.role === 'admin' && (
        <Link
          to="/admin"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ShieldCheck className="size-[18px]" /> Admin dashboard
        </Link>
      )}
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-[18px]" /> Log out
      </button>
      {error && <p className="px-3 text-xs text-destructive">{error}</p>}
    </div>
  )
}
