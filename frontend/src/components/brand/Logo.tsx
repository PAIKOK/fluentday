import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface LogoProps {
  to?: string
  className?: string
  showTagline?: boolean
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8', className)}>
      <rect width="32" height="32" rx="9" fill="#142D36" />
      <path d="M11 23V9h10v3h-6.5v3H20v3h-5.5v5z" fill="#C5E5D5" />
      <circle cx="23" cy="22" r="2" fill="#E9A58F" />
    </svg>
  )
}

export function Logo({ to = '/', className, showTagline = false }: LogoProps) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5', className)} aria-label="FluentDay home">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-extrabold tracking-tight text-forest">FluentDay</span>
        {showTagline && <span className="mt-1 text-[11px] text-muted-foreground">Small steps. Fluent English.</span>}
      </span>
    </Link>
  )
}
