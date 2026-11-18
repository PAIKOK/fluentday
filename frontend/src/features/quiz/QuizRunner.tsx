import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Volume2 } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { QuizAttempt, QuizQuestion, QuizResponse } from '@/types/phase5'
import { isAnswered, TYPE_LABELS } from './quizText'

interface Speech {
  supported: boolean
  speak: (text: string) => void
}

interface QuestionProps {
  question: QuizQuestion
  response: QuizResponse
  onChange: (response: QuizResponse) => void
  speech: Speech
}

function Sentence({ text }: { text: string }) {
  const [before, after] = text.split('_____')
  return (
    <p className="mt-4 rounded-2xl bg-ivory p-4 text-lg leading-relaxed ring-1 ring-border/70">
      {before}
      <span className="mx-1 inline-block min-w-16 border-b-2 border-forest align-baseline" aria-label="blank" />
      {after}
    </p>
  )
}

function Choices({ question, response, onChange }: Omit<QuestionProps, 'speech'>) {
  return (
    <div role="radiogroup" aria-label="Answers" className="mt-5 grid gap-2 sm:grid-cols-2">
      {question.options.map((option, i) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={response === i}
          onClick={() => onChange(i)}
          className={cn(
            'rounded-2xl px-4 py-3 text-left text-sm ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-ring',
            response === i ? 'bg-forest text-white ring-forest' : 'bg-card ring-border hover:bg-muted',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function QuestionBody({ question, response, onChange, speech }: QuestionProps) {
  if (question.type === 'fill_blank') {
    return (
      <>
        {question.sentence && <Sentence text={question.sentence} />}
        <label className="mt-5 block text-sm font-medium" htmlFor={`answer-${question.id}`}>Your answer</label>
        <Input
          id={`answer-${question.id}`}
          className="mt-1.5"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={typeof response === 'string' ? response : ''}
          onChange={(e) => onChange(e.target.value)}
        />
        {question.hint && <p className="mt-1.5 text-xs text-muted-foreground">Hint: {question.hint}</p>}
      </>
    )
  }
  if (question.type === 'match') {
    const chosen = Array.isArray(response) ? response : question.items.map(() => -1)
    return (
      <div className="mt-5 space-y-3">
        {question.items.map((item, i) => (
          <div key={item} className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center">
            <label htmlFor={`${question.id}-${i}`} className="font-medium">{item}</label>
            <select
              id={`${question.id}-${i}`}
              value={chosen[i]}
              onChange={(e) => onChange(chosen.map((c, j) => (j === i ? Number(e.target.value) : c)))}
              className="h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value={-1}>Choose a meaning…</option>
              {question.options.map((option, k) => <option key={option} value={k}>{option}</option>)}
            </select>
          </div>
        ))}
      </div>
    )
  }
  return (
    <>
      {question.type === 'listen' && question.speak_text && (
        speech.supported ? (
          <Button className="mt-4" variant="secondary" onClick={() => speech.speak(question.speak_text ?? '')}><Volume2 /> Play the word</Button>
        ) : (
          <Alert tone="info" className="mt-4">Your browser can’t play spoken audio, so pick the word you think it is.</Alert>
        )
      )}
      {question.sentence && <Sentence text={question.sentence} />}
      <Choices question={question} response={response} onChange={onChange} />
    </>
  )
}

interface QuizRunnerProps {
  attempt: QuizAttempt
  speech: Speech
  onSubmitted: (attempt: QuizAttempt) => void
}

export function QuizRunner({ attempt, speech, onSubmitted }: QuizRunnerProps) {
  const questions = attempt.questions
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<QuizResponse[]>(() => questions.map(() => null))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const question = questions[index]
  const last = index === questions.length - 1

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      onSubmitted(await api<QuizAttempt>(`/quiz/${attempt.id}/submit`, { method: 'POST', json: { answers: responses } }))
    } catch (e) {
      setError(errorMessage(e))
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="shrink-0">Question {index + 1} of {questions.length}</span>
        <Progress value={(index / questions.length) * 100} aria-label="Quiz progress" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{TYPE_LABELS[question.type]}</p>
      <h2 className="mt-1 text-xl font-semibold">{question.prompt}</h2>
      <QuestionBody
        key={question.id}
        question={question}
        response={responses[index]}
        onChange={(r) => setResponses(responses.map((old, i) => (i === index ? r : old)))}
        speech={speech}
      />
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft /> Back</Button>
        {last ? (
          <Button disabled={!isAnswered(question, responses[index]) || submitting} onClick={submit}><Check /> {submitting ? 'Checking…' : 'Check answers'}</Button>
        ) : (
          <Button disabled={!isAnswered(question, responses[index])} onClick={() => setIndex(index + 1)}>Next <ArrowRight /></Button>
        )}
      </div>
    </Card>
  )
}
