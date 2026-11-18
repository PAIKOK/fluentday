import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'

const currentYear = new Date().getFullYear()

const footerLinks = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
]

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
        <Logo showTagline />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3">
          {footerLinks.map((link) => (
            <Link key={link.to} to={link.to} className="text-sm text-muted-foreground transition-colors hover:text-forest">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl space-y-1.5 px-5 py-5 text-xs text-muted-foreground sm:px-8">
          <p>© {currentYear} FluentDay. All rights reserved.</p>
          <p>
            Word list:{' '}
            <a href="https://www.newgeneralservicelist.com/" className="underline hover:text-forest">New General Service List</a>{' '}
            (<a href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline hover:text-forest">CC BY-SA 4.0</a>).
            Definitions and examples:{' '}
            <a href="https://en-word.net/" className="underline hover:text-forest">Open English WordNet</a>{' '}
            (<a href="https://creativecommons.org/licenses/by/4.0/" className="underline hover:text-forest">CC BY 4.0</a>).
          </p>
        </div>
      </div>
    </footer>
  )
}
