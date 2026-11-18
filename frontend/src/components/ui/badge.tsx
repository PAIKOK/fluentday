import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-forest text-white',
      sage: 'bg-sage-50 text-forest ring-1 ring-sage',
      coral: 'bg-coral-50 text-forest ring-1 ring-coral/60',
      outline: 'text-muted-foreground ring-1 ring-border',
    },
  },
  defaultVariants: { variant: 'sage' },
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
