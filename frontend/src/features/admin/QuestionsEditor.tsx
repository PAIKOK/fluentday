import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import type { AdminVideo } from '@/types/phase4'

interface Draft {
  prompt: string
  options: string[]
  answer_index: number
  explanation: string
}

const blank = (): Draft => ({ prompt: '', options: ['', ''], answer_index: 0, explanation: '' })

export function QuestionsEditor({ video, onSaved }: { video: AdminVideo; onSaved: (v: AdminVideo) => void }) {
  const [questions, setQuestions] = useState<Draft[]>(
    video.questions.map((q) => ({ prompt: q.prompt, options: q.options, answer_index: q.answer_index, explanation: q.explanation })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (i: number, change: Partial<Draft>) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...change } : q)))
  const valid = questions.every((q) => q.prompt.trim().length >= 3 && q.options.every((o) => o.trim()))

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onSaved(await api<AdminVideo>(`/admin/youtube/videos/${video.id}`, { method: 'PATCH', json: { questions } }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet. Learners won’t see a quiz for this video until you add one.</p>}
      {questions.map((q, qi) => (
        <fieldset key={qi} className="space-y-3 rounded-2xl bg-ivory p-4 ring-1 ring-border/70">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-semibold">Question {qi + 1}</legend>
            <Button size="icon" variant="ghost" className="size-8" aria-label={`Remove question ${qi + 1}`} onClick={() => setQuestions(questions.filter((_, j) => j !== qi))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div>
            <Label htmlFor={`q${qi}`}>Question</Label>
            <Input id={`q${qi}`} maxLength={300} value={q.prompt} onChange={(e) => update(qi, { prompt: e.target.value })} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Options <span className="font-normal text-muted-foreground">(choose the correct one)</span></p>
            {q.options.map((option, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`answer-${qi}`}
                  aria-label={`Option ${oi + 1} is correct`}
                  checked={q.answer_index === oi}
                  onChange={() => update(qi, { answer_index: oi })}
                />
                <Input aria-label={`Option ${oi + 1}`} maxLength={150} value={option} onChange={(e) => update(qi, { options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })} />
                {q.options.length > 2 && (
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Remove option ${oi + 1}`}
                    onClick={() => update(qi, { options: q.options.filter((_, j) => j !== oi), answer_index: q.answer_index >= oi && q.answer_index > 0 ? q.answer_index - 1 : q.answer_index })}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {q.options.length < 4 && (
              <Button size="sm" variant="ghost" onClick={() => update(qi, { options: [...q.options, ''] })}><Plus /> Add option</Button>
            )}
          </div>
          <div>
            <Label htmlFor={`e${qi}`}>Explanation <span className="font-normal text-muted-foreground">(shown after answering)</span></Label>
            <Input id={`e${qi}`} maxLength={500} value={q.explanation} onChange={(e) => update(qi, { explanation: e.target.value })} />
          </div>
        </fieldset>
      ))}
      {questions.length < 5 && <Button variant="outline" onClick={() => setQuestions([...questions, blank()])}><Plus /> Add question</Button>}
      <div className="sticky bottom-0 -mx-6 border-t border-border bg-card px-6 py-4">
        <Button onClick={save} disabled={saving || !valid}>{saving ? 'Saving…' : 'Save questions'}</Button>
      </div>
    </div>
  )
}
