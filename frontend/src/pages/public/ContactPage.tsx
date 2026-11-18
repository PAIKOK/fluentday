import { Mail } from 'lucide-react'
import { site } from '@/config/site'
import { InfoPage } from './InfoPage'

export function ContactPage() {
  return (
    <InfoPage title="Contact us" intro="Questions, feedback or trouble with your account? We would love to hear from you.">
      <a
        href={`mailto:${site.contactEmail}`}
        className="inline-flex items-center gap-3 rounded-2xl bg-card px-5 py-4 font-medium text-forest shadow-soft ring-1 ring-border/60 hover:bg-muted"
      >
        <Mail className="size-5" /> {site.contactEmail}
      </a>
      <p className="text-sm text-muted-foreground">We usually reply within two working days.</p>
    </InfoPage>
  )
}
