import type { Example } from './admin'
import type { ProficiencyLevel } from './learning'

export interface SourceRef {
  book_title: string
  page: number
}

export interface MySentence {
  id: string
  text: string
  created_at: string
}

export interface WordProgress {
  status: 'new' | 'learned' | 'mastered'
  difficult: boolean
  saved: boolean
  first_lesson_date: string
  learned_on: string | null
  my_sentences: MySentence[]
}

export interface LessonWord {
  id: string
  word: string
  part_of_speech: string | null
  pronunciation: string | null
  definition: string | null
  /** Where the definition was printed; null when the FluentDay team wrote or edited it. */
  definition_source: SourceRef | null
  examples: Example[]
  synonyms: string[]
  antonyms: string[]
  level: ProficiencyLevel | null
  sources: SourceRef[]
  progress: WordProgress
}

export interface Lesson {
  lesson_date: string
  kind: 'new' | 'revision' | 'empty'
  level: ProficiencyLevel | null
  words: LessonWord[]
  revision_words: LessonWord[]
  learned_count: number
  target: number
  /** The learner can still ask for another set of words today. */
  can_add_more: boolean
}

export interface DashboardData {
  lesson_date: string
  lesson_kind: Lesson['kind']
  words_today: { id: string; word: string; part_of_speech: string | null; definition: string | null; level: ProficiencyLevel | null; learned: boolean }[]
  videos_today: { id: string; title: string; channel_name: string; thumbnail_url: string; duration_seconds: number | null; completed: boolean }[]
  words_learned_total: number
  streak_days: number
  revisions_due_today: number
  speaking_challenge_done: boolean
  quiz_done: boolean
  next_reminder: { time: string; channels: ('in_app' | 'email' | 'push')[] } | null
}
