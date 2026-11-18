import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Clock, Loader2, MessageSquareQuote, Plus } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import { formatDuration } from '@/lib/duration'
import type { NotebookEntry, Video, VideoProgress } from '@/types/phase4'
import { ComprehensionQuiz } from './ComprehensionQuiz'
import { YouTubePlayer, type PlaybackReport } from './YouTubePlayer'

const NOTES_SAVE_DELAY_MS = 1200

export function VideoLesson({ video, initialProgress }: { video: Video; initialProgress: VideoProgress }) {
  const [progress, setProgress] = useState(initialProgress)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const durationSent = useRef(Boolean(video.duration_seconds))
  const duration = video.duration_seconds

  async function patch(body: Record<string, unknown>) {
    try {
      const updated = await api<VideoProgress>(`/listening/${video.id}/progress`, { method: 'PATCH', json: body })
      setProgress((current) => ({ ...updated, notes: current.notes }))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function onPlayback(report: PlaybackReport) {
    const body: Record<string, unknown> = { position_seconds: report.position }
    if (!durationSent.current && report.duration > 0) {
      body.duration_seconds = report.duration
      durationSent.current = true
    }
    if (report.ended) body.completed = true
    void patch(body)
  }

  const watchedPercent = duration ? Math.min(100, Math.round((progress.watched_seconds / duration) * 100)) : null

  return (
    <article className="space-y-4" aria-labelledby={`video-${video.id}`}>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {playerError ? (
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-forest-50 p-6 text-center">
              <img src={video.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover opacity-20" />
              <p className="relative text-sm text-forest">
                {playerError}{' '}
                <a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noreferrer" className="font-medium underline">
                  Open on YouTube
                </a>
              </p>
            </div>
          ) : (
            <YouTubePlayer videoId={video.video_id} title={video.title} onProgress={onPlayback} onError={setPlayerError} />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="sage">{video.channel_name}</Badge>
              {duration ? <Badge variant="outline"><Clock className="size-3" /> {formatDuration(duration)}</Badge> : null}
              {progress.completed && <Badge variant="sage"><CheckCircle2 className="size-3" /> Completed</Badge>}
            </div>
            <h2 id={`video-${video.id}`} className="mt-3 text-xl font-semibold leading-snug">{video.title}</h2>
            {watchedPercent !== null && !progress.completed && (
              <p className="mt-1 text-sm text-muted-foreground">Watched {watchedPercent}%</p>
            )}
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Button
            variant={progress.completed ? 'secondary' : 'default'}
            aria-pressed={progress.completed}
            onClick={() => patch({ completed: !progress.completed })}
          >
            {progress.completed ? <CheckCircle2 /> : <Circle />} {progress.completed ? 'Completed' : 'Mark as completed'}
          </Button>
        </div>

        <NotesPanel videoId={video.id} initialNotes={initialProgress.notes} />
      </div>

      {video.questions.length > 0 && <ComprehensionQuiz video={video} result={progress.quiz} onResult={(quiz) => setProgress((p) => ({ ...p, quiz }))} />}
    </article>
  )
}

function NotesPanel({ videoId, initialNotes }: { videoId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const lastSaved = useRef(initialNotes)

  // Autosave a moment after the learner stops typing.
  useEffect(() => {
    if (notes === lastSaved.current) return
    const id = setTimeout(async () => {
      setState('saving')
      try {
        await api<VideoProgress>(`/listening/${videoId}/progress`, { method: 'PATCH', json: { notes } })
        lastSaved.current = notes
        setState('saved')
      } catch {
        setState('error')
      }
    }, NOTES_SAVE_DELAY_MS)
    return () => clearTimeout(id)
  }, [notes, videoId])

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between">
        <Label htmlFor={`notes-${videoId}`} className="mb-0 text-base font-semibold">My notes</Label>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {state === 'saving' && <><Loader2 className="inline size-3 animate-spin" /> Saving…</>}
          {state === 'saved' && 'Saved'}
          {state === 'error' && <span className="text-destructive">Not saved — check your connection</span>}
        </span>
      </div>
      <Textarea
        id={`notes-${videoId}`}
        maxLength={10000}
        placeholder="Words you heard, questions, ideas…"
        className="mt-3 min-h-40 flex-1"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <ExpressionForm videoId={videoId} />
    </Card>
  )
}

function ExpressionForm({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [meaning, setMeaning] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const entry = await api<NotebookEntry>(`/listening/${videoId}/expressions`, { method: 'POST', json: { text, meaning } })
      setMessage({ tone: 'success', text: `“${entry.title}” saved to My Expressions.` })
      setText('')
      setMeaning('')
      setOpen(false)
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {message && (
        <Alert tone={message.tone} className="mb-3">
          {message.text}{' '}
          {message.tone === 'success' && <Link to="/app/notebook?category=expressions" className="font-medium underline">Open notebook</Link>}
        </Alert>
      )}
      {open ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor={`expr-${videoId}`}>Expression</Label>
            <Input id={`expr-${videoId}`} maxLength={200} required placeholder="e.g. a night owl" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`expr-meaning-${videoId}`}>Meaning <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id={`expr-meaning-${videoId}`} maxLength={1000} value={meaning} onChange={(e) => setMeaning(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving || text.trim().length < 2}>{saving ? 'Saving…' : 'Save expression'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <MessageSquareQuote /> <Plus className="-ml-1 size-3" /> Save an expression
        </Button>
      )}
    </div>
  )
}
