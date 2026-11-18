import type { DashboardSummary } from '@/types/learning'

export const DAILY_TARGETS = { words: 7, videos: 2, speaking: 1, quiz: 1 } as const

export interface DailyTask {
  key: 'words' | 'videos' | 'speaking' | 'quiz'
  label: string
  done: number
  target: number
  path: string
}

/** Builds today's checklist from the dashboard summary. */
export function buildDailyTasks(summary: DashboardSummary): DailyTask[] {
  return [
    {
      key: 'words',
      label: 'New words',
      done: summary.todaysWords.filter((w) => w.learned).length,
      target: DAILY_TARGETS.words,
      path: '/app/vocabulary',
    },
    {
      key: 'videos',
      label: 'Listening lessons',
      done: summary.todaysVideos.filter((v) => v.completed).length,
      target: DAILY_TARGETS.videos,
      path: '/app/listening',
    },
    { key: 'speaking', label: 'Speaking challenge', done: summary.speakingChallengeDone ? 1 : 0, target: DAILY_TARGETS.speaking, path: '/app/pronunciation' },
    { key: 'quiz', label: 'Daily quiz', done: summary.quizDone ? 1 : 0, target: DAILY_TARGETS.quiz, path: '/app/quiz' },
  ]
}

/** Overall completion as a whole-number percentage (0–100). */
export function completionPercent(tasks: DailyTask[]): number {
  const target = tasks.reduce((sum, t) => sum + t.target, 0)
  if (target === 0) return 0
  const done = tasks.reduce((sum, t) => sum + Math.min(t.done, t.target), 0)
  return Math.round((done / target) * 100)
}
