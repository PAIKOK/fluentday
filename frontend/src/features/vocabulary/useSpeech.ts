import { useCallback, useEffect, useState } from 'react'
import type { PronunciationAccent } from '@/types/learning'

const LANG: Record<PronunciationAccent, string> = { british: 'en-GB', american: 'en-US' }

/** Chooses a voice for the accent: an exact language match first, then any English voice. */
export function pickVoice(voices: SpeechSynthesisVoice[], accent: PronunciationAccent): SpeechSynthesisVoice | null {
  const lang = LANG[accent].toLowerCase()
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    null
  )
}

/** Reads text aloud with the browser's built-in speech (Web Speech API). */
export function useSpeech(accent: PronunciationAccent) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (supported ? window.speechSynthesis.getVoices() : []))
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!supported) return
    const update = () => setVoices(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update)
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = LANG[accent]
      utterance.rate = 0.9
      const voice = pickVoice(voices, accent)
      if (voice) utterance.voice = voice
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    },
    [accent, supported, voices],
  )

  return { supported, speak, speaking }
}
