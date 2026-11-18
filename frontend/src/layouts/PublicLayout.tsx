import { Outlet } from 'react-router-dom'
import { Footer } from '@/features/landing/Footer'
import { LandingNavbar } from '@/features/landing/LandingNavbar'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
