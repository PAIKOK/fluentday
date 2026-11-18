export type NotebookCategory = 'vocabulary' | 'expressions' | 'sentences' | 'mistakes'

export interface NotebookEntry {
  id: string
  category: NotebookCategory
  title: string
  content: string
  tags: string[]
  favourite: boolean
  word_id: string | null
  video_id: string | null
  created_at: string
  updated_at: string
}

export interface NotebookPage {
  items: NotebookEntry[]
  total: number
  page: number
  page_size: number
  counts: Record<NotebookCategory, number>
}

export type RevisionRating = 'easy' | 'remembered' | 'difficult' | 'forgot'

export interface ReviewResult {
  word_id: string
  stage: number
  due_date: string | null
  mastered: boolean
}

export interface RevisionCalendar {
  month: string
  today: string
  days: { date: string; due: number; reviewed: number }[]
  total_stages: number
}

export type ChannelKey = 'tv_series' | 'bbc_6min'

export interface Question {
  id: string
  prompt: string
  options: string[]
}

export interface Video {
  id: string
  video_id: string
  channel_key: ChannelKey
  channel_name: string
  title: string
  thumbnail_url: string
  duration_seconds: number | null
  published_at: string | null
  questions: Question[]
}

export interface QuizResult {
  score: number
  total: number
  items: { question_id: string; chosen_index: number | null; answer_index: number; correct: boolean; explanation: string }[]
  submitted_at: string
}

export interface VideoProgress {
  watched_seconds: number
  completed: boolean
  completed_at: string | null
  notes: string
  quiz: QuizResult | null
}

export interface ListeningToday {
  lesson_date: string
  items: { video: Video; progress: VideoProgress }[]
}

export interface Channel {
  key: ChannelKey
  name: string
  url: string
  channel_id: string
  title_filter: string
  active: boolean
  last_imported_at: string | null
}

export interface AdminQuestion extends Question {
  answer_index: number
  explanation: string
}

export interface AdminVideo {
  id: string
  video_id: string
  channel_key: ChannelKey
  title: string
  thumbnail_url: string
  duration_seconds: number | null
  published_at: string | null
  active: boolean
  scheduled_for: string | null
  questions: AdminQuestion[]
  source: string
  times_assigned: number
}
