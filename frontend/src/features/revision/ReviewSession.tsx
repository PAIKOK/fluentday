import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, PartyPopper, Volume2 } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { api, errorMessage } from '@/lib/api'
import type { LessonWord } from '@/types/lesson'
import type { ReviewResult, RevisionRating } from '@/types/phase4'

const RATINGS: { rating: RevisionRating; label: string; hint: string; variant: 'outline' | 'secondary' | 'default' }[] = [
  { rating: 'forgot', label: 'Forgot', hint: 'Start again tomorrow', variant: 'outline' },
  { rating: 'difficult', label: 'Difficult', hint: 'See it again tomorrow', variant: 'outline' },
  { rating: 'remembered', label: 'Remembered', hint: 'Next step', variant: 'secondary' },
  { rating: 'easy', label: 'Easy', hint: 'Skip ahead', variant: 'default' },
]

interface ReviewSessionProps {
  words: LessonWord[]
  speech: { supported: boolean; speak: (text: string) => void }
  onReviewed: () => void
}

export function ReviewSession({ words, speech, onReviewed }: ReviewSessionProps) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mastered, setMastered] = useState<string[]>([])
  const word = words[index]

  async function rate(rating: RevisionRating) {
    setSaving(true)
    setError(null)
    try {
      const result = await api<ReviewResult>(`/revision/${word.id}`, { method: 'POST', json: { rating } })
      if (result.mastered) setMastered((m) => [...m, word.word])
      setIndex(index + 1)
      setRevealed(false)
      onReviewed()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!word) {
    return (
      <Card className="flex flex-col items-center p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-sage-50 text-forest ring-1 ring-sage">
          <PartyPopper className="size-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Revision done for today</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          You reviewed {words.length} word{words.length === 1 ? '' : 's'}.
          {mastered.length > 0 && ` Mastered: ${mastered.join(', ')}.`}
        </p>
        <Button className="mt-5" variant="outline" asChild><Link to="/app">Back to dashboard</Link></Button>
      </Card>
    )
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="shrink-0">{index + 1} of {words.length}</span>
        <Progress value={(index / words.length) * 100} aria-label="Revision progress" />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-forest">{word.word}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{[word.part_of_speech, word.pronunciation].filter(Boolean).join(' · ')}</p>
        </div>
        {speech.supported && (
          <Button size="icon" onClick={() => speech.speak(word.word)} aria-label={`Listen to “${word.word}”`}><Volume2 className="size-5" /></Button>
        )}
      </div>
      {word.progress.difficult && <Badge variant="outline" className="mt-3">You found this one difficult</Badge>}

      {revealed ? (
        <div className="mt-6 rounded-2xl bg-ivory p-5 ring-1 ring-border/70">
          <p className="text-lg leading-relaxed">{word.definition}</p>
          {word.examples[0] && <p className="mt-3 border-l-2 border-sage pl-3 text-sm italic text-muted-foreground">“{word.examples[0].text}”</p>}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-input p-6 text-center">
          <p className="text-sm text-muted-foreground">Try to remember what it means, then check.</p>
          <Button className="mt-3" variant="outline" onClick={() => setRevealed(true)}><Eye /> Show meaning</Button>
        </div>
      )}

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      {revealed && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-medium">How well did you remember it?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map((r) => (
              <Button key={r.rating} variant={r.variant} disabled={saving} onClick={() => rate(r.rating)} className="h-auto flex-col gap-0.5 rounded-2xl py-3">
                <span>{r.label}</span>
                <span className="text-[11px] font-normal opacity-75">{r.hint}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
