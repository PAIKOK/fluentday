import type { DashboardSummary } from '@/types/learning'
import { buildDailyTasks, completionPercent, DAILY_TARGETS } from './dailyPlan'
import { EMPTY_DASHBOARD_SUMMARY } from './useDashboardSummary'

const word = (id: string, learned: boolean) => ({
  id,
  word: id,
  partOfSpeech: null,
  meaning: null,
  level: null,
  learned,
})

describe('daily plan', () => {
  it('reports 0% for a brand-new learner', () => {
    expect(completionPercent(buildDailyTasks(EMPTY_DASHBOARD_SUMMARY))).toBe(0)
  })

  it('counts only learned words and completed videos', () => {
    const summary: DashboardSummary = {
      ...EMPTY_DASHBOARD_SUMMARY,
      todaysWords: [word('a', true), word('b', true), word('c', false)],
      todaysVideos: [
        { id: 'v1', title: 't', channelName: 'c', thumbnailUrl: null, durationSeconds: null, completed: true },
      ],
    }
    const tasks = buildDailyTasks(summary)
    expect(tasks.find((t) => t.key === 'words')?.done).toBe(2)
    expect(tasks.find((t) => t.key === 'videos')?.done).toBe(1)
    // 3 of 11 steps (7 words + 2 videos + 1 speaking + 1 quiz)
    expect(completionPercent(tasks)).toBe(27)
  })

  it('never exceeds 100% even if more items than the target are done', () => {
    const summary: DashboardSummary = {
      ...EMPTY_DASHBOARD_SUMMARY,
      todaysWords: Array.from({ length: DAILY_TARGETS.words + 3 }, (_, i) => word(String(i), true)),
    }
    expect(completionPercent(buildDailyTasks(summary))).toBeLessThanOrEqual(100)
  })

  it('marks the speaking challenge and quiz done from the backend flags', () => {
    const tasks = buildDailyTasks({ ...EMPTY_DASHBOARD_SUMMARY, speakingChallengeDone: true, quizDone: true })
    expect(tasks.find((t) => t.key === 'speaking')?.done).toBe(1)
    expect(tasks.find((t) => t.key === 'quiz')?.done).toBe(1)
  })
})
