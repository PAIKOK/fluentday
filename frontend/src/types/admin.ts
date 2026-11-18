import type { NotificationPreferences } from './auth'
import type { ProficiencyLevel } from './learning'

export type BookStatus = 'queued' | 'processing' | 'ready' | 'failed'

export interface Book {
  id: string
  slot: number
  title: string
  filename: string
  size_bytes: number
  page_count: number | null
  status: BookStatus
  error: string | null
  word_count: number
  new_word_count: number
  flagged_count: number
  uploaded_at: string
  processed_at: string | null
}

export interface BookSlot {
  slot: number
  book: Book | null
}

export type WordStatus = 'pending' | 'approved' | 'rejected'
export type ContentSource = 'book' | 'admin' | 'ai' | 'dataset'

export interface Example {
  text: string
  source: ContentSource
}

export interface WordSource {
  book_id: string
  book_slot: number
  book_title: string
  page: number
  definition: string | null
  raw_text: string
  confidence: number
}

export interface Word {
  id: string
  word: string
  part_of_speech: string | null
  pronunciation: string | null
  definition: string | null
  examples: Example[]
  synonyms: string[]
  antonyms: string[]
  level: ProficiencyLevel | null
  status: WordStatus
  needs_review: boolean
  review_reasons: string[]
  admin_edited: boolean
  sources: WordSource[]
  /** Position in the starter word list (1 = most useful), for words loaded from it. */
  starter_rank: number | null
  updated_at: string
}

export interface StarterVocabulary {
  words_in_file: number
  loaded: number
  added: number
  updated: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface AdminOverview {
  users_total: number
  users_verified: number
  books_ready: number
  words_total: number
  words_approved: number
  words_pending: number
  words_needing_review: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'subscriber'
  email_verified: boolean
  proficiency_level: ProficiencyLevel | null
  timezone: string | null
  notifications: NotificationPreferences
  created_at: string
  last_login_at: string | null
}
