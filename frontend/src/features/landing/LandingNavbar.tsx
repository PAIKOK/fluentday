import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { landingNavigation } from '@/config/navigation'
import { useAuth } from '@/features/auth/AuthContext'

export function LandingNavbar() {
  const [open, setOpen] = useState(false)
  const { me } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-ivory/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8" aria-label="Main">
        <Logo />
        <div className="hidden items-center gap-8 md:flex">
          {landingNavigation.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-forest">
              {item.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {me ? (
            <Button size="sm" asChild>
              <Link to="/app">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Start Learning</Link>
              </Button>
            </>
          )}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-6">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Logo />
            <div className="mt-8 flex flex-col gap-1">
              {landingNavigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 font-medium text-foreground hover:bg-muted"
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-2">
              {me ? (
                <Button asChild>
                  <Link to="/app">Open dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/login">Log in</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/register">Start Learning</Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
