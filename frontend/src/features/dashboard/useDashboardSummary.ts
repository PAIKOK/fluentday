import { useAuth } from '@/features/auth/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import type { DashboardData } from '@/types/lesson'
import type { DashboardSummary } from '@/types/learning'

const CHANNEL_LABELS = { in_app: 'In-app', email: 'Email', push: 'Push' } as const

export const EMPTY_DASHBOARD_SUMMARY: DashboardSummary = {
  learnerName: null,
  streakDays: 0,
  wordsLearned: 0,
  revisionsDueToday: 0,
  speakingChallengeDone: false,
  quizDone: false,
  todaysWords: [],
  todaysVideos: [],
  upcomingReminders: [],
}

interface DashboardQuery {
  data: DashboardSummary
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/** The learner's dashboard, computed by the backend from their real activity. */
export function useDashboardSummary(): DashboardQuery {
  const { me } = useAuth()
  const { data, isLoading, error, reload } = useApiQuery<DashboardData>('/dashboard')
  const learnerName = me?.profile.full_name.split(' ')[0] ?? null
  if (!data) return { data: { ...EMPTY_DASHBOARD_SUMMARY, learnerName }, isLoading, error, reload }
  return {
    data: {
      learnerName,
      streakDays: data.streak_days,
      wordsLearned: data.words_learned_total,
      revisionsDueToday: data.revisions_due_today,
      speakingChallengeDone: data.speaking_challenge_done,
      quizDone: data.quiz_done,
      todaysWords: data.words_today.map((w) => ({
        id: w.id,
        word: w.word,
        partOfSpeech: w.part_of_speech,
        meaning: w.definition,
        level: w.level,
        learned: w.learned,
      })),
      todaysVideos: data.videos_today.map((v) => ({
        id: v.id,
        title: v.title,
        channelName: v.channel_name,
        thumbnailUrl: v.thumbnail_url,
        durationSeconds: v.duration_seconds,
        completed: v.completed,
      })),
      upcomingReminders: data.next_reminder
        ? [{
            id: 'daily',
            label: `Daily reminder · ${data.next_reminder.channels.map((c) => CHANNEL_LABELS[c]).join(', ')}`,
            scheduledFor: data.next_reminder.time,
          }]
        : [],
    },
    isLoading,
    error,
    reload,
  }
}
