import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  tone?: 'sage' | 'coral' | 'forest'
}

const toneClasses = {
  sage: 'bg-sage-50 text-forest ring-sage',
  coral: 'bg-coral-50 text-forest ring-coral/60',
  forest: 'bg-forest-50 text-forest ring-forest/15',
} as const

export function StatCard({ icon: Icon, label, value, hint, tone = 'sage' }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold">{value}</p>
        </div>
        <div className={cn('flex size-10 items-center justify-center rounded-xl ring-1', toneClasses[tone])}>
          <Icon className="size-[18px]" />
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
