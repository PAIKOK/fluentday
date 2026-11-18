import type { QuestionType, QuizQuestion, QuizResponse } from '@/types/phase5'

export const TYPE_LABELS: Record<QuestionType, string> = {
  meaning: 'Meaning',
  match: 'Match',
  fill_blank: 'Fill in the blank',
  synonym: 'Synonym',
  antonym: 'Antonym',
  complete_sentence: 'Complete the sentence',
  listen: 'Listen and identify',
}

export function isAnswered(question: QuizQuestion, response: QuizResponse): boolean {
  if (question.type === 'fill_blank') return typeof response === 'string' && response.trim().length > 0
  if (question.type === 'match') return Array.isArray(response) && response.length === question.items.length && response.every((r) => r >= 0)
  return typeof response === 'number'
}

/** The learner's answer as readable text. */
export function responseText(question: QuizQuestion, response: QuizResponse): string {
  if (response === null || response === '') return 'No answer'
  if (typeof response === 'string') return response
  if (Array.isArray(response)) return question.items.map((item, i) => `${item} → ${question.options[response[i]] ?? '?'}`).join(' · ')
  return question.options[response] ?? 'No answer'
}
