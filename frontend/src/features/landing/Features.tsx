import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Check,
  Headphones,
  Mic,
  NotebookPen,
} from 'lucide-react'
import { SectionHeading } from '@/components/common/SectionHeading'
import { cn } from '@/lib/utils'

interface Feature {
  id: string
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  points: string[]
  tone: 'sage' | 'coral' | 'forest'
}

const features: Feature[] = [
  {
    id: 'vocabulary',
    icon: BookOpen,
    eyebrow: 'Daily vocabulary',
    title: 'Seven carefully chosen words, every day',
    description:
      'Words come from curated English vocabulary books — never random web lists — and are matched to your level.',
    points: ['Meaning, part of speech and pronunciation', 'Example sentences, synonyms and antonyms', 'Source book and page for every word'],
    tone: 'sage',
  },
  {
    id: 'listening',
    icon: Headphones,
    eyebrow: 'Listening practice',
    title: 'Two real-world listening lessons',
    description:
      'Short videos from Learn English with TV Series and BBC Learning English’s 6 Minute English, picked for you each day.',
    points: ['Notes panel right beside the video', 'Save expressions as you hear them', 'Quick comprehension check'],
    tone: 'coral',
  },
  {
    id: 'pronunciation',
    icon: Mic,
    eyebrow: 'Pronunciation laboratory',
    title: 'Hear it, say it, compare it',
    description:
      'Play a reference pronunciation in British or American English, record yourself and see what was recognised.',
    points: ['British and American reference audio', 'Speech recognition feedback', 'A daily speaking challenge'],
    tone: 'forest',
  },
  {
    id: 'notebook',
    icon: NotebookPen,
    eyebrow: 'Personal notebook',
    title: 'Your private study notebook',
    description: 'Keep the words, expressions, sentences and mistakes that matter to you — searchable and always private.',
    points: ['Four categories with tags and favourites', 'Search and filter instantly', 'Export your notes to PDF'],
    tone: 'sage',
  },
  {
    id: 'progress',
    icon: BarChart3,
    eyebrow: 'Progress tracking',
    title: 'See your English grow',
    description: 'Streaks, mastered words, listening minutes and quiz accuracy — all calculated from what you actually did.',
    points: ['Spaced revision calendar', 'Weekly and monthly activity', 'Level distribution of your vocabulary'],
    tone: 'coral',
  },
]

const toneClasses = {
  sage: 'bg-sage-50 ring-sage',
  coral: 'bg-coral-50 ring-coral/50',
  forest: 'bg-forest-50 ring-forest/10',
} as const

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to practise daily"
          description="A digital study notebook and an English coach, in one calm place."
        />
        <div className="mt-16 space-y-6">
          {features.map((feature, i) => (
            <FeatureRow key={feature.id} feature={feature} reversed={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureRow({ feature, reversed }: { feature: Feature; reversed: boolean }) {
  const Icon = feature.icon
  return (
    <article
      id={feature.id}
      className="grid scroll-mt-24 items-center gap-8 rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 sm:p-10 md:grid-cols-2"
    >
      <div className={cn(reversed && 'md:order-2')}>
        <p className="text-sm font-semibold text-forest-700">{feature.eyebrow}</p>
        <h3 className="mt-2 text-2xl font-bold text-forest sm:text-[1.75rem]">{feature.title}</h3>
        <p className="mt-3 leading-relaxed text-muted-foreground">{feature.description}</p>
        <ul className="mt-6 space-y-2.5">
          {feature.points.map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sage text-forest">
                <Check className="size-3" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div
        className={cn(
          'flex aspect-[4/3] items-center justify-center rounded-2xl ring-1',
          toneClasses[feature.tone],
          reversed && 'md:order-1',
        )}
        aria-hidden="true"
      >
        <div className="flex size-24 items-center justify-center rounded-3xl bg-card shadow-lift">
          <Icon className="size-10 text-forest" strokeWidth={1.5} />
        </div>
      </div>
    </article>
  )
}
