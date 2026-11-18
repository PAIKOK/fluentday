import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'
import { Card } from '@/components/ui/card'

interface AuthLayoutProps {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <header className="mb-8">
        <Logo showTagline />
      </header>
      <main className="w-full max-w-md">
        <Card className="p-7 sm:p-9">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
          <div className="mt-7">{children}</div>
        </Card>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </main>
    </div>
  )
}
