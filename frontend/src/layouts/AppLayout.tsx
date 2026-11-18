import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { APP_BASE, appNavigation } from '@/config/navigation'
import { NOTIFICATIONS_READ_EVENT } from '@/features/notifications/events'
import { useApiQuery } from '@/hooks/useApiQuery'
import { AppSidebar } from './AppSidebar'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const unread = useApiQuery<{ unread: number }>('/notifications/unread-count')
  const { reload } = unread
  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_READ_EVENT, reload)
    return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, reload)
  }, [reload])
  const badges = { [`${APP_BASE}/notifications`]: unread.data?.unread ?? 0 }
  const current = appNavigation.find((item) =>
    item.path === APP_BASE ? pathname === APP_BASE || pathname === `${APP_BASE}/` : pathname.startsWith(item.path),
  )

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <AppSidebar badges={badges} />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">FluentDay app sections</SheetDescription>
            <AppSidebar badges={badges} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Logo to={APP_BASE} />
        {current && <span className="ml-auto truncate text-sm text-muted-foreground">{current.label}</span>}
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
