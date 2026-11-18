import { api } from '@/lib/api'
import type { WordProgress } from '@/types/lesson'

export function updateProgress(wordId: string, change: Partial<Pick<WordProgress, 'difficult' | 'saved'>> & { learned?: boolean }) {
  return api<WordProgress>(`/vocabulary/${wordId}/progress`, { method: 'PATCH', json: change })
}

export function addSentence(wordId: string, text: string) {
  return api<WordProgress>(`/vocabulary/${wordId}/sentences`, { method: 'POST', json: { text } })
}

export function deleteSentence(wordId: string, sentenceId: string) {
  return api<WordProgress>(`/vocabulary/${wordId}/sentences/${sentenceId}`, { method: 'DELETE' })
}

export const EXAMPLE_SOURCE_LABEL = { book: 'From the book', admin: 'Added by the FluentDay team', ai: 'AI-generated example', dataset: 'From Open English WordNet' } as const
