import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthContext'
import { MonthCalendar } from '@/features/revision/MonthCalendar'
import { ReviewSession } from '@/features/revision/ReviewSession'
import { useSpeech } from '@/features/vocabulary/useSpeech'
import { useApiQuery } from '@/hooks/useApiQuery'
import type { LessonWord } from '@/types/lesson'
import type { RevisionCalendar } from '@/types/phase4'

const SCHEDULE = [
  { day: 'Day 1', label: 'Learn' },
  { day: 'Day 2', label: '1st revision' },
  { day: 'Day 4', label: '2nd revision' },
  { day: 'Day 7', label: '3rd revision' },
  { day: 'Day 15', label: '4th revision' },
]

export function RevisionPage() {
  const { me } = useAuth()
  const speech = useSpeech(me?.profile.accent ?? 'british')
  const queue = useApiQuery<{ today: string; words: LessonWord[] }>('/revision/queue')
  const [month, setMonth] = useState<string | null>(null)
  const calendar = useApiQuery<RevisionCalendar>(`/revision/calendar${month ? `?month=${month}` : ''}`)

  return (
    <>
      <PageHeader
        eyebrow="Revision Calendar"
        title="Revise at the right moment"
        description="Each word comes back just before you’re likely to forget it. How well you remember decides when you see it next."
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section aria-label="Today’s revision">
          <LoadState isLoading={queue.isLoading} error={queue.error} onRetry={queue.reload} hasData={queue.data !== null}>
            {queue.data && queue.data.words.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing to revise today"
                description="Words you mark as learned are scheduled here automatically. Check back tomorrow."
                action={<Button variant="outline" asChild><Link to="/app/vocabulary">Go to today’s words</Link></Button>}
              />
            ) : (
              queue.data && <ReviewSession key={queue.data.today} words={queue.data.words} speech={speech} onReviewed={() => void calendar.reload()} />
            )}
          </LoadState>
        </section>
        <div className="space-y-6">
          <LoadState isLoading={calendar.isLoading} error={calendar.error} onRetry={calendar.reload} hasData={calendar.data !== null}>
            {calendar.data && <MonthCalendar data={calendar.data} onMonth={setMonth} />}
          </LoadState>
          <Card className="p-5">
            <h2 className="text-base font-semibold">How the schedule works</h2>
            <ol className="mt-3 grid grid-cols-5 gap-2">
              {SCHEDULE.map((s) => (
                <li key={s.day} className="rounded-xl bg-ivory p-2 text-center ring-1 ring-border/70">
                  <p className="font-display text-sm font-bold text-forest">{s.day}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{s.label}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">After the fourth successful revision a word is mastered. “Easy” skips ahead; “Difficult” and “Forgot” bring it back tomorrow.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
