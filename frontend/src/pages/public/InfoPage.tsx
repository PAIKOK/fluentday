import type { ReactNode } from 'react'

interface InfoPageProps {
  title: string
  intro: string
  children: ReactNode
}

/** Shared layout for About, Contact, Privacy and Terms. */
export function InfoPage({ title, intro, children }: InfoPageProps) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
      <h1 className="text-4xl font-bold text-forest">{title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{intro}</p>
      <div className="mt-10 space-y-8 leading-relaxed text-foreground/85 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-forest">
        {children}
      </div>
    </article>
  )
}
