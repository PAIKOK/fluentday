import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const tones = {
  error: { icon: AlertCircle, className: 'bg-red-50 text-red-900 ring-red-200' },
  success: { icon: CheckCircle2, className: 'bg-sage-50 text-forest ring-sage' },
  info: { icon: Info, className: 'bg-forest-50 text-forest ring-forest/15' },
} as const

export function Alert({ tone = 'info', children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass } = tones[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-2.5 rounded-xl p-3.5 text-sm ring-1', toneClass, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
