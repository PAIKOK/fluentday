import { useCallback, useEffect, useRef, useState } from 'react'
import type { PronunciationAccent } from '@/types/learning'

// The Web Speech API's recognition interface isn't in TypeScript's DOM types yet.
interface RecognitionAlternative { transcript: string }
interface RecognitionResultEvent { results: ArrayLike<ArrayLike<RecognitionAlternative>> }
interface RecognitionErrorEvent { error: string }
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionConstructor = new () => SpeechRecognitionLike

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.',
  'service-not-allowed': 'Speech recognition isn’t available in this browser right now.',
  'no-speech': 'We didn’t hear anything. Speak a little louder or closer to the microphone.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection.',
}

export type RecognitionState = 'idle' | 'listening' | 'done' | 'error'

/** Browser speech recognition (Chrome and Edge; Safari partly). Returns all alternatives, best first. */
export function useSpeechRecognition(accent: PronunciationAccent) {
  const Recognition = recognitionConstructor()
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const [state, setState] = useState<RecognitionState>('idle')
  const [transcripts, setTranscripts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => recognition.current?.abort(), [])

  const start = useCallback(
    () =>
      new Promise<string[]>((resolve) => {
        if (!Recognition) return resolve([])
        recognition.current?.abort()
        const r = new Recognition()
        r.lang = accent === 'british' ? 'en-GB' : 'en-US'
        r.interimResults = false
        r.maxAlternatives = 5
        let heard: string[] = []
        r.onresult = (e) => {
          const first = e.results[0]
          heard = Array.from({ length: first.length }, (_, i) => first[i].transcript)
        }
        r.onerror = (e) => {
          if (e.error === 'aborted') return
          setError(ERRORS[e.error] ?? 'Speech recognition stopped unexpectedly. Please try again.')
          setState('error')
        }
        r.onend = () => {
          setTranscripts(heard)
          setState((s) => (s === 'error' ? s : 'done'))
          resolve(heard)
        }
        recognition.current = r
        setError(null)
        setTranscripts([])
        setState('listening')
        r.start()
      }),
    [Recognition, accent],
  )

  const stop = useCallback(() => recognition.current?.stop(), [])
  const reset = useCallback(() => {
    recognition.current?.abort()
    setState('idle')
    setTranscripts([])
    setError(null)
  }, [])

  return { supported: Recognition !== null, state, transcripts, error, start, stop, reset }
}
