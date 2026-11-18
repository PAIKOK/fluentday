import { useCallback, useEffect, useRef, useState } from 'react'

/** Records the microphone so learners can play their own voice back. The audio never leaves the browser. */
export function useRecorder() {
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
  const recorder = useRef<MediaRecorder | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    recorder.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  const start = useCallback(async () => {
    if (!supported) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const r = new MediaRecorder(stream)
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setAudioUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })))
        setRecording(false)
      }
      recorder.current = r
      r.start()
      setAudioUrl(null)
      setRecording(true)
    } catch {
      setError('Microphone access was blocked. Allow it in your browser’s site settings, then try again.')
    }
  }, [supported])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const clear = useCallback(() => setAudioUrl(null), [])

  return { supported, recording, audioUrl, error, start, stop, clear }
}
