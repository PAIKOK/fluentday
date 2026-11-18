import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, Headphones, Mic, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const dailyPlan = [
  { icon: BookOpen, label: '7 new words' },
  { icon: Headphones, label: '2 listening lessons' },
  { icon: Mic, label: '1 speaking challenge' },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28 lg:pt-24">
        <div>
          <Badge variant="sage" className="mb-6 px-3 py-1 text-[13px]">
            Small steps. Fluent English.
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.08] text-forest sm:text-5xl lg:text-[3.5rem]">
            Your journey to confident English starts here.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Seven new words. Two listening lessons. A little speaking practice. Every single day.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/register">
                Start Learning <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">Explore Features</a>
            </Button>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            {dailyPlan.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-forest-700" /> {label}
              </li>
            ))}
          </ul>
        </div>

        <HeroIllustration />
      </div>
    </section>
  )
}

/** Illustrative preview of a vocabulary card — clearly decorative, not user data. */
function HeroIllustration() {
  return (
    <div className="relative mx-auto mb-12 w-full max-w-md" aria-hidden="true">
      <div className="absolute -right-6 -top-6 size-40 rounded-full bg-sage/60 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 size-40 rounded-full bg-coral/30 blur-2xl" />
      <Card className="relative rotate-[-1.5deg] p-7 shadow-lift">
        <div className="flex items-center justify-between">
          <Badge variant="outline">Word 3 of 7</Badge>
          <Badge variant="coral">Intermediate</Badge>
        </div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-3xl font-bold text-forest">resilient</p>
            <p className="mt-1 text-sm text-muted-foreground">adjective · /rɪˈzɪl.i.ənt/</p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-full bg-forest text-white">
            <Volume2 className="size-5" />
          </span>
        </div>
        <p className="mt-5 leading-relaxed text-foreground/85">
          Able to recover quickly from difficult conditions.
        </p>
        <p className="mt-3 border-l-2 border-sage pl-3 text-sm italic text-muted-foreground">
          “She stayed resilient through a difficult year.”
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {['tough', 'adaptable', 'strong'].map((s) => (
            <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs text-foreground/80">
              {s}
            </span>
          ))}
        </div>
      </Card>
      <Card className="absolute -bottom-20 -right-4 hidden w-52 rotate-[2deg] p-4 shadow-lift sm:block">
        <p className="text-xs font-medium text-muted-foreground">Today&apos;s plan</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {['Vocabulary', 'Listening', 'Speaking'].map((item, i) => (
            <li key={item} className="flex items-center gap-2">
              <span className={i < 2 ? 'flex size-4 items-center justify-center rounded-full bg-sage text-forest' : 'size-4 rounded-full ring-1 ring-input'}>
                {i < 2 && <Check className="size-3" />}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
