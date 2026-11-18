import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Mic, Trophy } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/features/auth/AuthContext'
import { PracticePanel } from '@/features/pronunciation/PracticePanel'
import { useApiQuery } from '@/hooks/useApiQuery'
import { cn } from '@/lib/utils'
import type { PronunciationAccent } from '@/types/learning'
import type { LessonWord } from '@/types/lesson'
import type { PracticeWord, PronunciationAttempt, PronunciationHistory, PronunciationToday } from '@/types/phase5'

function statusBadge(w: PracticeWord) {
  if (w.recognised_today) return <Badge>Recognised</Badge>
  if (w.attempts_today > 0) return <Badge variant="outline">Practised</Badge>
  return <Badge variant="outline">To practise</Badge>
}

function attemptLabel(a: PronunciationAttempt) {
  if (a.recognised === true) return <Badge>Recognised</Badge>
  if (a.recognised === false) return <Badge variant="coral">Heard something else</Badge>
  return <Badge variant="outline">Self-check</Badge>
}

export function PronunciationPage() {
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()
  const today = useApiQuery<PronunciationToday>('/pronunciation/today')
  const history = useApiQuery<PronunciationHistory>('/pronunciation/history?limit=10')
  const [accentChoice, setAccentChoice] = useState<PronunciationAccent | null>(null)
  const accent = accentChoice ?? today.data?.accent ?? me?.profile.accent ?? 'british'

  const requested = params.get('word')
  const words = today.data?.words ?? []
  const inChallenge = words.find((w) => w.id === requested)
  // A word opened from elsewhere (e.g. a vocabulary card) that isn't part of today's challenge.
  const extra = useApiQuery<LessonWord>(requested && today.data && !inChallenge ? `/vocabulary/${requested}` : null)
  const selected =
    inChallenge ??
    (extra.data && { ...extra.data, example: extra.data.examples[0]?.text ?? null }) ??
    words.find((w) => w.attempts_today === 0) ??
    words[0]
  const practised = words.filter((w) => w.attempts_today > 0).length

  function onAttempt() {
    void today.reload()
    void history.reload()
  }

  return (
    <>
      <PageHeader
        eyebrow="Pronunciation Lab"
        title="Hear it. Say it. Compare it."
        description="Play the reference pronunciation in British or American English, then record yourself and see what was recognised."
      />
      <LoadState isLoading={today.isLoading} error={today.error} onRetry={today.reload} hasData={today.data !== null}>
        {today.data && words.length === 0 && !extra.data ? (
          <EmptyState
            icon={Mic}
            title="Nothing to practise yet"
            description="Words from your daily lessons become speaking practice here."
            action={<Button variant="outline" asChild><Link to="/app/vocabulary">Go to today’s words</Link></Button>}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
            <section aria-labelledby="challenge-title" className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle as="h2" id="challenge-title" className="text-base">Today’s speaking challenge</CardTitle>
                  <span className="text-sm text-muted-foreground">{practised} of {words.length}</span>
                </div>
                <Progress className="mt-3" value={words.length ? (practised / words.length) * 100 : 0} aria-label="Speaking challenge progress" />
                {today.data?.completed && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-forest"><Trophy className="size-4" /> Challenge complete. Well done!</p>
                )}
                <ul className="mt-4 space-y-2">
                  {words.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => setParams({ word: w.id }, { replace: true })}
                        aria-current={selected?.id === w.id ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                          selected?.id === w.id ? 'bg-sage-50 ring-sage' : 'bg-card ring-border hover:bg-muted',
                        )}
                      >
                        <span className="flex items-center gap-2 font-medium">
                          {w.attempts_today > 0 && <CheckCircle2 className="size-4 text-forest" aria-hidden />}
                          {w.word}
                        </span>
                        {statusBadge(w)}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">Practise each word at least once to complete today’s challenge.</p>
              </Card>
            </section>

            <section aria-label="Practice">
              {extra.error && <Alert tone="error" className="mb-4">{extra.error}</Alert>}
              {selected && <PracticePanel key={selected.id} word={selected} accent={accent} onAccent={setAccentChoice} onAttempt={onAttempt} />}
            </section>
          </div>
        )}
      </LoadState>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle as="h2" className="text-base">Practice history</CardTitle>
          {history.data && history.data.total_attempts > 0 && (
            <p className="text-sm text-muted-foreground">
              {history.data.total_attempts} attempt{history.data.total_attempts === 1 ? '' : 's'} on {history.data.days_practised} day{history.data.days_practised === 1 ? '' : 's'} ·{' '}
              {history.data.recognised_attempts} recognised
            </p>
          )}
        </div>
        <LoadState isLoading={history.isLoading} error={history.error} onRetry={history.reload} hasData={history.data !== null}>
          {history.data && history.data.items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Your recordings will be listed here after your first try.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {history.data?.items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span>
                    <span className="font-medium">{a.word}</span>
                    {a.heard && <span className="text-muted-foreground"> · heard “{a.heard}”</span>}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {a.accent === 'british' ? 'British' : 'American'} ·{' '}
                    {new Date(a.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {attemptLabel(a)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </LoadState>
      </Card>
    </>
  )
}
