import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, RotateCcw } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/features/auth/AuthContext'
import { VocabularyCard } from '@/features/vocabulary/VocabularyCard'
import { useSpeech } from '@/features/vocabulary/useSpeech'
import { useApiQuery } from '@/hooks/useApiQuery'
import { formatLongDate } from '@/lib/date'
import type { Lesson, LessonWord, WordProgress } from '@/types/lesson'

type ProgressById = Record<string, WordProgress>

function withProgress(words: LessonWord[], updates: ProgressById): LessonWord[] {
  return words.map((w) => (updates[w.id] ? { ...w, progress: updates[w.id] } : w))
}

/** The loaded lesson with any changes the learner has made since. */
function applyUpdates(lesson: Lesson | null, updates: ProgressById): Lesson | null {
  if (!lesson) return null
  const words = withProgress(lesson.words, updates)
  return {
    ...lesson,
    words,
    revision_words: withProgress(lesson.revision_words, updates),
    learned_count: words.filter((w) => w.progress.status !== 'new').length,
  }
}

export function VocabularyPage() {
  const { me } = useAuth()
  const speech = useSpeech(me?.profile.accent ?? 'british')
  const { data, error, isLoading, reload } = useApiQuery<Lesson>('/lessons/today')
  const [updates, setUpdates] = useState<ProgressById>({})
  const lesson = applyUpdates(data, updates)

  function onProgress(wordId: string, progress: WordProgress) {
    setUpdates((current) => ({ ...current, [wordId]: progress }))
  }

  const percent = lesson && lesson.words.length ? Math.round((lesson.learned_count / lesson.words.length) * 100) : 0

  return (
    <>
      <PageHeader
        eyebrow={lesson ? formatLongDate(new Date(`${lesson.lesson_date}T12:00:00`)) : 'Daily Vocabulary'}
        title={lesson?.kind === 'revision' ? 'Today’s revision' : 'Today’s words'}
        description="Seven new words a day, each with its meaning, examples and where it comes from."
      />
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={lesson !== null}>
        {lesson && lesson.kind === 'empty' && (
          <EmptyState
            icon={BookOpen}
            title="No words are ready yet"
            description="The FluentDay team is still preparing the vocabulary. Your daily words will appear here as soon as they are published."
            action={<Button variant="outline" asChild><Link to="/app">Back to dashboard</Link></Button>}
          />
        )}

        {lesson && lesson.words.length > 0 && (
          <>
            <div className="mb-6 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-border/60">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{lesson.learned_count} of {lesson.words.length} learned</span>
                <span className="text-muted-foreground">{percent}%</span>
              </div>
              <Progress value={percent} aria-label="Words learned today" />
              {lesson.words.length < lesson.target && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Only {lesson.words.length} new word{lesson.words.length === 1 ? '' : 's'} available today
                  {lesson.revision_words.length > 0 ? ', so the rest of today is revision.' : '.'}
                </p>
              )}
            </div>
            {!speech.supported && <Alert tone="info" className="mb-6">Your browser can’t play pronunciations. Try Chrome, Edge or Safari.</Alert>}
            <div className="space-y-6">
              {lesson.words.map((word, i) => (
                <VocabularyCard key={word.id} word={word} index={i} total={lesson.words.length} speech={speech} onProgress={onProgress} />
              ))}
            </div>
          </>
        )}

        {lesson && lesson.revision_words.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <RotateCcw className="size-5 text-forest-700" />
              <h2 className="text-xl font-semibold">{lesson.kind === 'revision' ? 'You’ve met every word for now — let’s revise' : 'Revision'}</h2>
            </div>
            <div className="space-y-6">
              {lesson.revision_words.map((word) => (
                <VocabularyCard key={word.id} word={word} speech={speech} onProgress={onProgress} />
              ))}
            </div>
          </section>
        )}
      </LoadState>
    </>
  )
}
