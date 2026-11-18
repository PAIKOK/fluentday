import type { ProficiencyLevel, PronunciationAccent } from './learning'

// --- Pronunciation Lab ---

export interface PracticeWord {
  id: string
  word: string
  part_of_speech: string | null
  pronunciation: string | null
  definition: string | null
  example: string | null
  attempts_today: number
  recognised_today: boolean
}

export interface PronunciationToday {
  today: string
  accent: PronunciationAccent
  words: PracticeWord[]
  completed: boolean
}

export interface PronunciationAttempt {
  id: string
  word_id: string
  word: string
  accent: PronunciationAccent
  heard: string | null
  /** null for a self-check, when there was no recognised speech to compare. */
  recognised: boolean | null
  method: 'browser_recognition' | 'self_check'
  practice_date: string
  created_at: string
}

export interface PronunciationHistory {
  items: PronunciationAttempt[]
  total_attempts: number
  recognised_attempts: number
  days_practised: number
}

// --- Quizzes ---

export type QuestionType = 'meaning' | 'match' | 'fill_blank' | 'synonym' | 'antonym' | 'complete_sentence' | 'listen'
export type QuizResponse = number | number[] | string | null

export interface QuizQuestion {
  id: string
  type: QuestionType
  prompt: string
  sentence: string | null
  hint: string | null
  speak_text: string | null
  items: string[]
  options: string[]
}

export interface QuestionResult {
  question_id: string
  correct: boolean
  response: QuizResponse
  correct_answer: string
  explanation: string
}

export interface QuizAttempt {
  id: string
  quiz_date: string
  kind: 'daily' | 'practice'
  questions: QuizQuestion[]
  result: { score: number; total: number; items: QuestionResult[]; submitted_at: string } | null
}

export interface QuizToday {
  today: string
  learned_words: number
  min_words: number
  attempt: QuizAttempt | null
}

export interface QuizHistory {
  items: { id: string; quiz_date: string; kind: QuizAttempt['kind']; score: number; total: number; submitted_at: string }[]
  quizzes_taken: number
  accuracy: number | null
}

// --- Progress ---

export interface DayActivity {
  date: string
  words_learned: number
  revisions: number
  videos: number
  quizzes: number
  speaking: number
}

export interface ProgressData {
  today: string
  words_learned: number
  words_mastered: number
  revisions_due: number
  in_revision: number
  listening_minutes: number
  videos_completed: number
  quizzes_taken: number
  quiz_accuracy: number | null
  speaking_attempts: number
  streak_days: number
  longest_streak: number
  weekly: DayActivity[]
  monthly: { month: string; words_learned: number; words_mastered: number; total_learned: number }[]
  levels: { level: ProficiencyLevel | null; count: number }[]
}
