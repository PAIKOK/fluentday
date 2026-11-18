import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
  /** Heading level for the title, so it fits the page outline. */
  as?: 'h1' | 'h2' | 'h3'
}

export function EmptyState({ icon: Icon, title, description, action, className, as: Heading = 'h2' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-input bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-sage-50 text-forest ring-1 ring-sage">
        <Icon className="size-5" />
      </div>
      <Heading className="font-sans text-base font-semibold tracking-normal">{title}</Heading>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
