import { BookMarked, CalendarCheck, Sparkles, TrendingUp } from 'lucide-react'
import { SectionHeading } from '@/components/common/SectionHeading'

const steps = [
  {
    icon: Sparkles,
    title: 'Tell us your level',
    text: 'Choose Beginner, Intermediate or Advanced, plus British or American pronunciation.',
  },
  {
    icon: CalendarCheck,
    title: 'Open your daily lesson',
    text: 'Every morning a fresh lesson is waiting: seven words and two short listening videos.',
  },
  {
    icon: BookMarked,
    title: 'Practise and take notes',
    text: 'Listen, speak, quiz yourself and keep what matters in your personal notebook.',
  },
  {
    icon: TrendingUp,
    title: 'Revise at the right time',
    text: 'Spaced revision brings each word back just before you would forget it.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-border/60 bg-card py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How FluentDay works"
          title="Fifteen focused minutes a day"
          description="No overwhelming courses. Just a calm, repeatable routine that builds real fluency over time."
        />
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-2xl bg-ivory p-6 ring-1 ring-border/70">
              <span className="absolute right-5 top-5 font-display text-sm font-bold text-muted-foreground">
                0{i + 1}
              </span>
              <div className="flex size-11 items-center justify-center rounded-xl bg-forest text-sage">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
