import { useState } from 'react'
import { CheckCircle2, Mic, RotateCcw, Square, Volume2 } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useSpeech } from '@/features/vocabulary/useSpeech'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PronunciationAccent } from '@/types/learning'
import type { PracticeWord, PronunciationAttempt } from '@/types/phase5'
import { useRecorder } from './useRecorder'
import { useSpeechRecognition } from './useSpeechRecognition'

const ACCENTS: { value: PronunciationAccent; label: string }[] = [
  { value: 'british', label: 'British' },
  { value: 'american', label: 'American' },
]

interface PracticePanelProps {
  word: Pick<PracticeWord, 'id' | 'word' | 'part_of_speech' | 'pronunciation' | 'definition' | 'example'>
  accent: PronunciationAccent
  onAccent: (accent: PronunciationAccent) => void
  onAttempt: (attempt: PronunciationAttempt) => void
}

export function PracticePanel({ word, accent, onAccent, onAttempt }: PracticePanelProps) {
  const speech = useSpeech(accent)
  const recognition = useSpeechRecognition(accent)
  const recorder = useRecorder()
  const [result, setResult] = useState<PronunciationAttempt | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listening = recognition.state === 'listening' || recorder.recording
  const canRecord = recognition.supported || recorder.supported

  async function save(transcripts: string[], selfCheck: boolean) {
    setSaving(true)
    setError(null)
    try {
      const attempt = await api<PronunciationAttempt>('/pronunciation/attempts', {
        method: 'POST',
        json: { word_id: word.id, accent, transcripts, self_check: selfCheck },
      })
      setResult(attempt)
      onAttempt(attempt)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function record() {
    setResult(null)
    setError(null)
    await recorder.start()
    if (!recognition.supported) return // the learner presses Stop, then checks themselves
    const heard = await recognition.start()
    recorder.stop()
    if (heard.length > 0) await save(heard, false)
  }

  function stop() {
    if (recognition.supported) recognition.stop()
    else recorder.stop()
  }

  function tryAgain() {
    setResult(null)
    recognition.reset()
    recorder.clear()
  }

  const awaitingSelfCheck = !recognition.supported && recorder.audioUrl && !result

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold text-forest">{word.word}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{[word.part_of_speech, word.pronunciation].filter(Boolean).join(' · ')}</p>
        </div>
        <div role="radiogroup" aria-label="Accent" className="inline-flex rounded-full bg-muted p-1">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={accent === a.value}
              onClick={() => onAccent(a.value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                accent === a.value ? 'bg-card text-forest shadow-soft' : 'text-muted-foreground hover:text-forest',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      {word.definition && <p className="mt-4 leading-relaxed">{word.definition}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {speech.supported ? (
          <>
            <Button variant="secondary" onClick={() => speech.speak(word.word)}><Volume2 /> Play {accent === 'british' ? 'British' : 'American'} pronunciation</Button>
            {word.example && <Button variant="outline" onClick={() => speech.speak(word.example ?? '')}><Volume2 /> Hear it in a sentence</Button>}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Your browser can’t play spoken audio. Try Chrome, Edge or Safari.</p>
        )}
      </div>
      {word.example && <p className="mt-3 border-l-2 border-sage pl-3 text-sm italic text-muted-foreground">“{word.example}”</p>}

      <div className="mt-8 rounded-2xl bg-ivory p-5 text-center ring-1 ring-border/70">
        {!canRecord ? (
          <p className="text-sm text-muted-foreground">Recording isn’t available in this browser. Listen and repeat aloud, then try Chrome or Edge to see what was recognised.</p>
        ) : listening ? (
          <>
            <p className="text-sm font-medium text-forest" role="status">Listening… say “{word.word}”</p>
            <Button className="mt-3" variant="accent" onClick={stop}><Square /> Stop</Button>
          </>
        ) : (
          <>
            <Button size="lg" onClick={record} disabled={saving}><Mic /> {result || recorder.audioUrl ? 'Record again' : 'Record yourself'}</Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {recognition.supported ? 'Say the word once, clearly. Recording stops when you pause.' : 'Press Stop when you’ve finished, then listen back.'}
            </p>
          </>
        )}

        {(recognition.error || recorder.error || error) && (
          <Alert tone="error" className="mt-4 text-left">{recognition.error ?? recorder.error ?? error}</Alert>
        )}

        {result && result.method === 'browser_recognition' && (
          <div className={cn('mt-4 rounded-xl p-4 text-left ring-1', result.recognised ? 'bg-sage-50 ring-sage' : 'bg-coral-50 ring-coral/60')} role="status">
            <p className="text-sm">We heard: <strong>“{result.heard}”</strong></p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.recognised
                ? 'Your browser recognised the word. Try the other accent, or say it in a sentence.'
                : 'That isn’t quite the word. Listen again, slow down, and give each syllable its full sound.'}
            </p>
          </div>
        )}
        {result && result.method === 'self_check' && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-forest" role="status"><CheckCircle2 className="size-4" /> Practice saved.</p>
        )}

        {recorder.audioUrl && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your recording (stays on this device)</p>
            <audio controls src={recorder.audioUrl} className="mx-auto w-full max-w-sm" aria-label="Your recording" />
          </div>
        )}
        {awaitingSelfCheck && (
          <Button className="mt-4" variant="secondary" disabled={saving} onClick={() => save([], true)}><CheckCircle2 /> I compared it — save my practice</Button>
        )}
        {result && <Button className="mt-3" variant="ghost" size="sm" onClick={tryAgain}><RotateCcw /> Clear</Button>}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Feedback comes from your browser’s speech recognition: it shows what was heard, not a score for each sound.
      </p>
    </Card>
  )
}
