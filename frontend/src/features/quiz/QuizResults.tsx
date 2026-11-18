import { CheckCircle2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { QuizAttempt } from '@/types/phase5'
import { responseText, TYPE_LABELS } from './quizText'

export function QuizResults({ attempt }: { attempt: QuizAttempt }) {
  const result = attempt.result
  if (!result) return null
  const percent = Math.round((result.score / result.total) * 100)
  const message = percent === 100 ? 'Perfect score!' : percent >= 70 ? 'Great work.' : percent >= 40 ? 'Good effort. Review the ones you missed.' : 'Keep going. These words will come back in revision.'

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex size-20 flex-col items-center justify-center rounded-full bg-sage-50 ring-1 ring-sage">
          <span className="font-display text-2xl font-bold text-forest">{result.score}/{result.total}</span>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{attempt.kind === 'daily' ? 'Daily quiz' : 'Practice quiz'}: {percent}%</h2>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <ol className="mt-6 space-y-3">
        {attempt.questions.map((q, i) => {
          const item = result.items[i]
          return (
            <li key={q.id} className={cn('rounded-2xl p-4 ring-1', item.correct ? 'bg-sage-50/60 ring-sage' : 'bg-coral-50/60 ring-coral/60')}>
              <div className="flex items-start gap-2.5">
                {item.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest" aria-label="Correct" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-[#a2401f]" aria-label="Incorrect" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{TYPE_LABELS[q.type]}</p>
                  <p className="font-medium">{q.prompt}</p>
                  {q.sentence && <p className="mt-1 text-sm italic text-muted-foreground">{q.sentence}</p>}
                  <p className="mt-2 text-sm"><span className="text-muted-foreground">Your answer:</span> {responseText(q, item.response)}</p>
                  {!item.correct && <p className="text-sm"><span className="text-muted-foreground">Correct answer:</span> <strong>{item.correct_answer}</strong></p>}
                  <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
