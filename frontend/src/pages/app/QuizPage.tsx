import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, RotateCcw } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/features/auth/AuthContext'
import { QuizResults } from '@/features/quiz/QuizResults'
import { QuizRunner } from '@/features/quiz/QuizRunner'
import { useSpeech } from '@/features/vocabulary/useSpeech'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api, errorMessage } from '@/lib/api'
import type { QuizAttempt, QuizHistory, QuizToday } from '@/types/phase5'

export function QuizPage() {
  const { me } = useAuth()
  const speech = useSpeech(me?.profile.accent ?? 'british')
  const today = useApiQuery<QuizToday>('/quiz/today')
  const history = useApiQuery<QuizHistory>('/quiz/history?limit=10')
  const [active, setActive] = useState<QuizAttempt | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempt = active ?? today.data?.attempt ?? null

  async function practise() {
    setStarting(true)
    setError(null)
    try {
      setActive(await api<QuizAttempt>('/quiz/practice', { method: 'POST' }))
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  function submitted(done: QuizAttempt) {
    setActive(done)
    void history.reload()
    window.scrollTo({ top: 0 })
  }

  return (
    <>
      <PageHeader
        eyebrow="Daily Quiz"
        title="Check what you remember"
        description="Short quizzes built only from words you have already learned: meanings, synonyms, antonyms and sentences."
      />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-label="Quiz">
          <LoadState isLoading={today.isLoading} error={today.error} onRetry={today.reload} hasData={today.data !== null}>
            {today.data && !attempt && (
              <EmptyState
                icon={ListChecks}
                title="Your first quiz is almost ready"
                description={`Quizzes use only words you’ve learned. Mark ${today.data.min_words - today.data.learned_words} more word${today.data.min_words - today.data.learned_words === 1 ? '' : 's'} as learned to unlock it.`}
                action={
                  <div className="w-full max-w-xs space-y-3">
                    <Progress value={(today.data.learned_words / today.data.min_words) * 100} aria-label="Words learned towards your first quiz" />
                    <Button variant="outline" asChild><Link to="/app/vocabulary">Go to today’s words</Link></Button>
                  </div>
                }
              />
            )}
            {attempt && !attempt.result && <QuizRunner key={attempt.id} attempt={attempt} speech={speech} onSubmitted={submitted} />}
            {attempt?.result && (
              <div className="space-y-4">
                <QuizResults attempt={attempt} />
                {error && <Alert tone="error">{error}</Alert>}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={practise} disabled={starting}><RotateCcw /> {starting ? 'Preparing…' : 'Practise with a new quiz'}</Button>
                  <Button variant="outline" asChild><Link to="/app/revision">Go to revision</Link></Button>
                </div>
              </div>
            )}
          </LoadState>
        </section>

        <Card className="h-fit p-5">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle as="h2" className="text-base">Quiz history</CardTitle>
            {history.data?.accuracy != null && <span className="text-sm text-muted-foreground">{Math.round(history.data.accuracy * 100)}% accuracy</span>}
          </div>
          <LoadState isLoading={history.isLoading} error={history.error} onRetry={history.reload} hasData={history.data !== null}>
            {history.data && history.data.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Finished quizzes will appear here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {history.data?.items.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      {new Date(`${h.quiz_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      <Badge variant="outline">{h.kind === 'daily' ? 'Daily' : 'Practice'}</Badge>
                    </span>
                    <span className="font-medium">{h.score}/{h.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </LoadState>
        </Card>
      </div>
    </>
  )
}
