import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Mic, PenLine, Sparkles, TriangleAlert, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { LessonWord, WordProgress } from '@/types/lesson'
import { EXAMPLE_SOURCE_LABEL, addSentence, updateProgress } from './wordActions'

interface VocabularyCardProps {
  word: LessonWord
  index?: number
  total?: number
  speech: { supported: boolean; speak: (text: string) => void }
  onProgress: (wordId: string, progress: WordProgress) => void
}

export function VocabularyCard({ word, index, total, speech, onProgress }: VocabularyCardProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [sentence, setSentence] = useState('')
  const learned = word.progress.status !== 'new'
  const example = word.examples[0]

  async function run(key: string, action: () => Promise<WordProgress>) {
    setBusy(key)
    setError(null)
    try {
      onProgress(word.id, await action())
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function onAddSentence(event: FormEvent) {
    event.preventDefault()
    if (await run('sentence', () => addSentence(word.id, sentence))) {
      setSentence('')
      setWriting(false)
    }
  }

  return (
    <Card className={cn('p-6 transition-shadow sm:p-7', learned && 'ring-1 ring-sage')}>
      <div className="flex flex-wrap items-center gap-2">
        {index !== undefined && total !== undefined && <Badge variant="outline">Word {index + 1} of {total}</Badge>}
        {word.level && <Badge variant="coral" className="capitalize">{word.level}</Badge>}
        {learned && <Badge variant="sage"><CheckCircle2 className="size-3" /> Learned</Badge>}
        {word.progress.difficult && <Badge variant="outline"><TriangleAlert className="size-3" /> Difficult</Badge>}
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words font-display text-3xl font-bold text-forest">
            <Link to={`/app/vocabulary/${word.id}`} className="hover:underline">{word.word}</Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[word.part_of_speech, word.pronunciation].filter(Boolean).join(' · ') || 'Part of speech not listed'}
          </p>
        </div>
        {speech.supported && (
          <Button size="icon" className="shrink-0" onClick={() => speech.speak(word.word)} aria-label={`Listen to “${word.word}”`}>
            <Volume2 className="size-5" />
          </Button>
        )}
      </div>

      <div className="mt-5">
        <p className="text-lg leading-relaxed">{word.definition}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {word.definition_source
            ? `Definition from ${word.definition_source.book_title}, page ${word.definition_source.page}`
            : 'Definition written by the FluentDay team'}
        </p>
      </div>

      {example && (
        <figure className="mt-5 border-l-2 border-sage pl-4">
          <blockquote className="italic text-foreground/85">“{example.text}”</blockquote>
          <figcaption className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {example.source === 'ai' && <Sparkles className="size-3" />} {EXAMPLE_SOURCE_LABEL[example.source]}
          </figcaption>
        </figure>
      )}

      {(word.synonyms.length > 0 || word.antonyms.length > 0) && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {word.synonyms.length > 0 && <TermList label="Synonyms" terms={word.synonyms} />}
          {word.antonyms.length > 0 && <TermList label="Antonyms" terms={word.antonyms} />}
        </dl>
      )}

      {word.sources.length > 0 && (
        <p className="mt-5 text-xs text-muted-foreground">
          Source: {word.sources.map((s) => `${s.book_title}, p. ${s.page}`).join(' · ')}
        </p>
      )}

      {word.progress.my_sentences.length > 0 && (
        <div className="mt-5 rounded-xl bg-ivory p-4 ring-1 ring-border/70">
          <p className="text-xs font-medium text-muted-foreground">My sentences</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {word.progress.my_sentences.map((s) => <li key={s.id}>{s.text}</li>)}
          </ul>
        </div>
      )}

      {writing && (
        <form onSubmit={onAddSentence} className="mt-5 space-y-2">
          <label htmlFor={`sentence-${word.id}`} className="text-sm font-medium">Write your own sentence with “{word.word}”</label>
          <Textarea id={`sentence-${word.id}`} maxLength={300} autoFocus value={sentence} onChange={(e) => setSentence(e.target.value)} className="min-h-20" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy !== null || sentence.trim().length < 3}>{busy === 'sentence' ? 'Saving…' : 'Save sentence'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setWriting(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button size="sm" variant={learned ? 'secondary' : 'default'} disabled={busy !== null} aria-pressed={learned}
          onClick={() => run('learned', () => updateProgress(word.id, { learned: !learned }))}>
          {learned ? <CheckCircle2 /> : <Circle />} {learned ? 'Learned' : 'Mark as learned'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} aria-pressed={word.progress.difficult}
          onClick={() => run('difficult', () => updateProgress(word.id, { difficult: !word.progress.difficult }))}>
          <TriangleAlert /> {word.progress.difficult ? 'Marked difficult' : 'Mark as difficult'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} aria-pressed={word.progress.saved}
          onClick={() => run('saved', () => updateProgress(word.id, { saved: !word.progress.saved }))}>
          {word.progress.saved ? <BookmarkCheck /> : <Bookmark />} {word.progress.saved ? 'Saved to notebook' : 'Save to notebook'}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to={`/app/pronunciation?word=${word.id}`}><Mic /> Practise speaking</Link>
        </Button>
        {!writing && (
          <Button size="sm" variant="ghost" onClick={() => setWriting(true)}>
            <PenLine /> Add my own sentence
          </Button>
        )}
      </div>
    </Card>
  )
}

function TermList({ label, terms }: { label: string; terms: string[] }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5">
        {terms.map((t) => <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-sm">{t}</span>)}
      </dd>
    </div>
  )
}
