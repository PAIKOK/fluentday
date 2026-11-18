import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ArrowLeft, BookOpenText, FileText, LayoutDashboard, Menu, Users, MonitorPlay } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { UserMenu } from './UserMenu'

const adminNavigation = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard },
  { label: 'Vocabulary books', path: '/admin/books', icon: FileText },
  { label: 'Vocabulary', path: '/admin/vocabulary', icon: BookOpenText },
  { label: 'Listening videos', path: '/admin/youtube', icon: MonitorPlay },
  { label: 'Users', path: '/admin/users', icon: Users },
]

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-6">
        <Logo to="/admin" />
        <Badge variant="coral">Admin</Badge>
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {adminNavigation.map(({ label, path, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={path === '/admin'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-forest text-white shadow-soft' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="size-[18px]" /> {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <Link
          to="/app"
          onClick={onNavigate}
          className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-[18px]" /> Learner app
        </Link>
      </nav>
      <div className="border-t border-border p-3">
        <UserMenu onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <AdminSidebar />
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <SheetDescription className="sr-only">FluentDay admin sections</SheetDescription>
            <AdminSidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Logo to="/admin" />
        <Badge variant="coral">Admin</Badge>
      </header>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
