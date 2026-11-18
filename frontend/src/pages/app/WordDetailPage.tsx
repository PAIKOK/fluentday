import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, Trash2 } from 'lucide-react'
import { LoadState } from '@/components/common/LoadState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthContext'
import { VocabularyCard } from '@/features/vocabulary/VocabularyCard'
import { EXAMPLE_SOURCE_LABEL, deleteSentence } from '@/features/vocabulary/wordActions'
import { useSpeech } from '@/features/vocabulary/useSpeech'
import { useApiQuery } from '@/hooks/useApiQuery'
import { errorMessage } from '@/lib/api'
import type { LessonWord } from '@/types/lesson'

export function WordDetailPage() {
  const { wordId } = useParams()
  const { me } = useAuth()
  const speech = useSpeech(me?.profile.accent ?? 'british')
  const { data, error, isLoading, reload } = useApiQuery<LessonWord>(`/vocabulary/${wordId}`)
  const [override, setOverride] = useState<LessonWord | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const word = override && override.id === data?.id ? override : data

  async function removeSentence(sentenceId: string) {
    if (!word) return
    try {
      setOverride({ ...word, progress: await deleteSentence(word.id, sentenceId) })
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-3" asChild>
        <Link to="/app/vocabulary"><ArrowLeft /> Today’s words</Link>
      </Button>
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={word !== null}>
        {word && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h1 className="sr-only">{word.word}</h1>
              <VocabularyCard word={word} speech={speech} onProgress={(_, progress) => setOverride({ ...word, progress })} />
            </div>
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-base font-semibold">All examples</h2>
                {word.examples.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No examples yet. Try writing your own sentence.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {word.examples.map((ex, i) => (
                      <li key={i} className="text-sm">
                        <p className="italic">“{ex.text}”</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          {ex.source === 'ai' && <Sparkles className="size-3" />} {EXAMPLE_SOURCE_LABEL[ex.source]}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-6">
                <h2 className="text-base font-semibold">Where it appears</h2>
                {word.sources.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Added by the FluentDay team.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {word.sources.map((s) => <li key={`${s.book_title}-${s.page}`}>{s.book_title} — page {s.page}</li>)}
                  </ul>
                )}
              </Card>
              <Card className="p-6">
                <h2 className="text-base font-semibold">My sentences</h2>
                {word.progress.my_sentences.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Use “Add my own sentence” to practise this word.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {word.progress.my_sentences.map((s) => (
                      <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                        <span>{s.text}</span>
                        <Button size="icon" variant="ghost" className="size-8" aria-label={`Delete sentence: ${s.text}`} onClick={() => removeSentence(s.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {actionError && <p role="alert" className="mt-2 text-sm text-destructive">{actionError}</p>}
              </Card>
              <p className="text-xs text-muted-foreground">First seen on {word.progress.first_lesson_date}{word.progress.learned_on ? ` · learned on ${word.progress.learned_on}` : ''}</p>
            </div>
          </div>
        )}
      </LoadState>
    </>
  )
}
