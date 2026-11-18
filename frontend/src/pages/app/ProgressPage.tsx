import { BookCheck, CalendarClock, Flame, GraduationCap, Headphones, ListChecks } from 'lucide-react'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardTitle } from '@/components/ui/card'
import { ColumnChart, type ChartPoint, type ChartSeries } from '@/features/progress/ColumnChart'
import { useApiQuery } from '@/hooks/useApiQuery'
import type { DayActivity, ProgressData } from '@/types/phase5'

// Validated with the dataviz palette checker (contrast and colour-blind separation on white).
const LEARNED = '#0a7ea4'
const MASTERED = '#c25e36'

const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function weeklyPoints(days: DayActivity[]): ChartPoint[] {
  return days.map((d) => {
    const date = new Date(`${d.date}T00:00:00`)
    const total = d.words_learned + d.revisions + d.videos + d.quizzes + d.speaking
    const details = [
      d.words_learned && plural(d.words_learned, 'word') + ' learned',
      d.revisions && plural(d.revisions, 'revision'),
      d.videos && plural(d.videos, 'video') + ' watched',
      d.quizzes && (d.quizzes === 1 ? '1 quiz' : `${d.quizzes} quizzes`),
      d.speaking && plural(d.speaking, 'speaking attempt'),
    ].filter((x): x is string => Boolean(x))
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      fullLabel: date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
      values: { total },
      details,
    }
  })
}

function monthlyPoints(months: ProgressData['monthly']): ChartPoint[] {
  return months.map((m) => {
    const date = new Date(`${m.month}-01T00:00:00`)
    return {
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      fullLabel: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      values: { learned: m.words_learned, mastered: m.words_mastered },
      details: [`${m.total_learned} learned in total by then`],
    }
  })
}

const WEEKLY_SERIES: ChartSeries[] = [{ key: 'total', label: 'Learning activities', color: LEARNED }]
const MONTHLY_SERIES: ChartSeries[] = [
  { key: 'learned', label: 'Words learned', color: LEARNED },
  { key: 'mastered', label: 'Words mastered', color: MASTERED },
]

export function ProgressPage() {
  const { data, isLoading, error, reload } = useApiQuery<ProgressData>('/progress')
  const levelMax = Math.max(1, ...(data?.levels.map((l) => l.count) ?? []))

  return (
    <>
      <PageHeader
        eyebrow="My Progress"
        title="Your learning, in numbers"
        description="Words learned and mastered, listening minutes, quiz accuracy and your weekly activity."
      />
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        {data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard icon={GraduationCap} label="Words learned" value={data.words_learned} hint={`${data.in_revision} still in revision`} />
              <StatCard icon={BookCheck} label="Words mastered" value={data.words_mastered} hint="After four successful revisions" tone="forest" />
              <StatCard icon={CalendarClock} label="Awaiting revision" value={data.revisions_due} hint="Due today or overdue" tone="coral" />
              <StatCard icon={Headphones} label="Listening minutes" value={data.listening_minutes} hint={`${plural(data.videos_completed, 'video')} completed`} tone="forest" />
              <StatCard
                icon={ListChecks}
                label="Quiz accuracy"
                value={data.quiz_accuracy === null ? '—' : `${Math.round(data.quiz_accuracy * 100)}%`}
                hint={data.quizzes_taken ? `Across ${data.quizzes_taken === 1 ? '1 quiz' : `${data.quizzes_taken} quizzes`}` : 'Take your first quiz to see this'}
              />
              <StatCard icon={Flame} label="Daily streak" value={plural(data.streak_days, 'day')} hint={`Longest: ${plural(data.longest_streak, 'day')}`} tone="coral" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <CardTitle as="h2" className="text-base">This week</CardTitle>
                <p className="mb-4 text-sm text-muted-foreground">Learning activities per day: words, revisions, videos, quizzes and speaking.</p>
                <ColumnChart label="Learning activities in the last 7 days" data={weeklyPoints(data.weekly)} series={WEEKLY_SERIES} />
              </Card>
              <Card className="p-5">
                <CardTitle as="h2" className="text-base">Monthly progress</CardTitle>
                <p className="mb-4 text-sm text-muted-foreground">Words learned and mastered in the last six months.</p>
                <ColumnChart label="Words learned and mastered per month" data={monthlyPoints(data.monthly)} series={MONTHLY_SERIES} />
              </Card>
            </div>

            <Card className="p-5">
              <CardTitle as="h2" className="text-base">Vocabulary by level</CardTitle>
              <p className="mb-4 text-sm text-muted-foreground">The level of the words you’ve learned.</p>
              <ul className="space-y-3">
                {data.levels.map((l) => (
                  <li key={l.level ?? 'none'} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm">
                    <span>{l.level ? LEVEL_LABELS[l.level] : 'No level set'}</span>
                    <span className="flex items-center gap-2">
                      <span className="h-3 rounded-r-[4px]" style={{ width: `${(l.count / levelMax) * 80}%`, minWidth: l.count ? 6 : 0, backgroundColor: LEARNED }} aria-hidden />
                      <span className="font-medium">{l.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </LoadState>
    </>
  )
}
