export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced'

export type PronunciationAccent = 'british' | 'american'

/** Summary shown on the subscriber dashboard. Always computed by the backend. */
export interface DashboardSummary {
  learnerName: string | null
  streakDays: number
  wordsLearned: number
  revisionsDueToday: number
  speakingChallengeDone: boolean
  quizDone: boolean
  todaysWords: DailyWordPreview[]
  todaysVideos: DailyVideoPreview[]
  upcomingReminders: ReminderPreview[]
}

export interface DailyWordPreview {
  id: string
  word: string
  partOfSpeech: string | null
  meaning: string | null
  level: ProficiencyLevel | null
  learned: boolean
}

export interface DailyVideoPreview {
  id: string
  title: string
  channelName: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  completed: boolean
}

export interface ReminderPreview {
  id: string
  label: string
  scheduledFor: string
}
