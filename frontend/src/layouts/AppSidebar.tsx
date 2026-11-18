import { NavLink } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { APP_BASE, appNavigation } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { UserMenu } from './UserMenu'

interface AppSidebarProps {
  onNavigate?: () => void
  /** Unread counts shown next to nav items, keyed by path. */
  badges?: Record<string, number>
}

export function AppSidebar({ onNavigate, badges = {} }: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-6">
        <Logo to={APP_BASE} />
      </div>
      <nav aria-label="App" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {appNavigation.map(({ label, path, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={path === APP_BASE}
                onClick={onNavigate}
                aria-label={badges[path] > 0 ? `${label}, ${badges[path]} unread` : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-forest text-white shadow-soft'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="size-[18px]" />
                {label}
                {badges[path] > 0 && (
                  <span className="ml-auto rounded-full bg-coral px-2 py-0.5 text-xs font-semibold text-forest">
                    {badges[path]}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <UserMenu onNavigate={onNavigate} switchTo="admin" />
      </div>
    </div>
  )
}
