import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  Check,
  Flame,
  GraduationCap,
  Headphones,
  PlayCircle,
} from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { buildDailyTasks, completionPercent } from '@/features/dashboard/dailyPlan'
import { useAuth } from '@/features/auth/AuthContext'
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary'
import { formatLongDate, getGreeting } from '@/lib/date'
import { formatDuration } from '@/lib/duration'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { data: summary, error, isLoading, reload } = useDashboardSummary()
  const { me } = useAuth()
  const tasks = buildDailyTasks(summary)
  const percent = completionPercent(tasks)
  const greeting = summary.learnerName ? `${getGreeting()}, ${summary.learnerName}` : getGreeting()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{formatLongDate()}</p>
          <h1 className="mt-1.5 text-3xl font-bold sm:text-4xl">{greeting} 👋</h1>
          <p className="mt-2 text-muted-foreground">Small steps today. Here is your plan.</p>
        </div>
        <Button size="lg" asChild>
          <Link to="/app/vocabulary">
            Continue Learning <ArrowRight />
          </Link>
        </Button>
      </div>

      {error && (
        <Alert tone="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>We couldn’t load today’s lesson. {error}</span>
            <Button size="sm" variant="outline" onClick={reload}>Try again</Button>
          </div>
        </Alert>
      )}

      {me && !me.profile.proficiency_level && (
        <Card className="flex flex-col gap-4 border-sage bg-sage-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Choose your English level</h2>
            <p className="mt-1 text-sm text-muted-foreground">We use it to pick the right seven words for you each day.</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/app/settings">Set my level</Link>
          </Button>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Today&apos;s progress</CardTitle>
              <CardDescription>Complete all four steps to keep your streak going.</CardDescription>
            </div>
            <span className="font-display text-3xl font-extrabold text-forest">{percent}%</span>
          </CardHeader>
          <CardContent>
            <Progress value={percent} aria-label="Daily completion" />
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {tasks.map((task) => {
                const complete = task.done >= task.target
                return (
                  <li key={task.key}>
                    <Link
                      to={task.path}
                      className="flex items-center gap-3 rounded-xl bg-ivory p-3.5 ring-1 ring-border/70 transition-colors hover:bg-muted"
                    >
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full',
                          complete ? 'bg-sage text-forest' : 'ring-1 ring-input',
                        )}
                      >
                        {complete && <Check className="size-4" />}
                      </span>
                      <span className="flex-1 text-sm font-medium">{task.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {task.done}/{task.target}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard icon={Flame} label="Daily streak" value={`${summary.streakDays} days`} tone="coral" />
          <StatCard icon={GraduationCap} label="Words learned" value={summary.wordsLearned} tone="sage" />
          <StatCard icon={CalendarClock} label="Revision due today" value={summary.revisionsDueToday} tone="forest" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Today&apos;s seven words</CardTitle>
              <CardDescription>Chosen for your level from FluentDay&apos;s vocabulary books.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/vocabulary">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading && summary.todaysWords.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground" role="status">Preparing today’s words…</p>
            ) : summary.todaysWords.length === 0 ? (
              <EmptyState
                as="h3"
                icon={BookOpen}
                title="No new words today"
                description="New words appear here as soon as the FluentDay team publishes vocabulary for your level."
              />
            ) : (
              <ul className="divide-y divide-border">
                {summary.todaysWords.map((word) => (
                  <li key={word.id} className="flex items-center justify-between gap-4 py-3">
                    <Link to={`/app/vocabulary/${word.id}`} className="min-w-0 hover:underline">
                      <p className="font-display font-semibold">{word.word}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">{word.meaning}</p>
                    </Link>
                    {word.learned ? <Badge>Learned</Badge> : word.level && <Badge variant="outline">{word.level}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Listening lessons</CardTitle>
              <CardDescription>Two short videos for today.</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.todaysVideos.length === 0 ? (
                <EmptyState
                as="h3"
                  icon={Headphones}
                  title="No videos scheduled yet"
                  description="Today’s lessons from Learn English with TV Series and BBC 6 Minute English will appear here."
                  className="py-8"
                />
              ) : (
                <ul className="space-y-3">
                  {summary.todaysVideos.map((video) => (
                    <li key={video.id}>
                      <Link to="/app/listening" className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="aspect-video w-20 shrink-0 rounded-lg object-cover" loading="lazy" />
                        ) : (
                          <PlayCircle className="size-8 shrink-0 text-forest" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-medium">{video.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[video.channelName, formatDuration(video.durationSeconds)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {video.completed && <Check className="size-4 shrink-0 text-forest" aria-label="Completed" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming reminders</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.upcomingReminders.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl bg-ivory p-4 ring-1 ring-border/70">
                  <Bell className="mt-0.5 size-4 shrink-0 text-forest-700" />
                  <p className="text-sm text-muted-foreground">
                    No reminders set.{' '}
                    <Link to="/app/settings" className="font-medium text-forest underline-offset-4 hover:underline">
                      Choose a reminder time
                    </Link>
                  </p>
                </div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {summary.upcomingReminders.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span>{r.label}</span>
                      <span className="text-muted-foreground">{r.scheduledFor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
