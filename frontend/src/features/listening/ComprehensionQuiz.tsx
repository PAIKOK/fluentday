import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { QuizResult, Video } from '@/types/phase4'

export function ComprehensionQuiz({ video, result, onResult }: { video: Video; result: QuizResult | null; onResult: (r: QuizResult) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => video.questions.map(() => null))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const showResult = result && !retrying

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      onResult(await api<QuizResult>(`/listening/${video.id}/quiz`, { method: 'POST', json: { answers } }))
      setRetrying(false)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Check your understanding</h3>
        {showResult && (
          <span className="font-display text-lg font-bold text-forest">
            {result.score} / {result.total}
          </span>
        )}
      </div>
      <ol className="mt-4 space-y-5">
        {video.questions.map((q, qi) => {
          const item = showResult ? result.items[qi] : null
          return (
            <li key={q.id}>
              <fieldset>
                <legend className="text-sm font-medium">{qi + 1}. {q.prompt}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {q.options.map((option, oi) => {
                    const chosen = item ? item.chosen_index === oi : answers[qi] === oi
                    const isAnswer = item?.answer_index === oi
                    return (
                      <label
                        key={oi}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-xl p-3 text-sm ring-1 has-focus-visible:ring-2 has-focus-visible:ring-ring',
                          item
                            ? isAnswer ? 'bg-sage-50 ring-forest' : chosen ? 'bg-coral-50 ring-coral' : 'bg-ivory ring-border'
                            : chosen ? 'bg-sage-50 ring-forest' : 'bg-ivory ring-border hover:bg-muted',
                          item && 'cursor-default',
                        )}
                      >
                        <input
                          type="radio"
                          name={`${video.id}-${q.id}`}
                          className="sr-only"
                          disabled={Boolean(item)}
                          checked={chosen}
                          onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))}
                        />
                        {item && isAnswer && <CheckCircle2 className="size-4 shrink-0 text-forest" aria-label="Correct answer" />}
                        {item && chosen && !isAnswer && <XCircle className="size-4 shrink-0" aria-label="Your answer" />}
                        {option}
                      </label>
                    )
                  })}
                </div>
                {item?.explanation && <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>}
              </fieldset>
            </li>
          )
        })}
      </ol>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      <div className="mt-5">
        {showResult ? (
          <Button
            variant="outline"
            onClick={() => {
              setAnswers(video.questions.map(() => null))
              setRetrying(true)
            }}
          >
            Try again
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting || answers.some((a) => a === null)}>
            {submitting ? 'Checking…' : 'Check answers'}
          </Button>
        )}
      </div>
    </Card>
  )
}
