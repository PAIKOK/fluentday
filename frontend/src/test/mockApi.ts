import { vi } from 'vitest'
import type { Me } from '@/types/auth'
import type { DashboardData, LessonWord } from '@/types/lesson'

type Handler = (init: RequestInit | undefined) => { status: number; body?: unknown }

/** Replaces fetch with handlers keyed by "METHOD /api/path" (query strings ignored). */
export function mockApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const key = `${init?.method ?? 'GET'} ${url.pathname}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    const { status, body } = handler(init)
    return new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const signedOut = () => ({ status: 401, body: { detail: 'Please log in to continue.' } })

export function makeMe(overrides: Partial<Me['user']> = {}, profile: Partial<Me['profile']> = {}): Me {
  return {
    user: { id: 'u1', email: 'ana@example.com', role: 'subscriber', email_verified: true, created_at: '2026-11-17T08:00:00Z', ...overrides },
    profile: {
      full_name: 'Ana Silva',
      proficiency_level: 'intermediate',
      accent: 'british',
      reminder_time: '08:00',
      timezone: 'Asia/Kolkata',
      learning_goals: [],
      notifications: { email: false, push: false, in_app: true },
      ...profile,
    },
  }
}

export function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return { lesson_date: '2026-11-17', lesson_kind: 'empty', words_today: [], videos_today: [], words_learned_total: 0, streak_days: 0, revisions_due_today: 0, speaking_challenge_done: false, quiz_done: false, next_reminder: null, ...overrides }
}

export function lessonWord(overrides: Partial<LessonWord> = {}): LessonWord {
  return {
    id: 'w1',
    word: 'candid',
    part_of_speech: 'adjective',
    pronunciation: '/ˈkændɪd/',
    definition: 'truthful and straightforward; frank.',
    definition_source: { book_title: 'Book One', page: 12 },
    examples: [{ text: 'She gave a candid answer.', source: 'book' }],
    synonyms: ['frank', 'honest'],
    antonyms: ['evasive'],
    level: 'intermediate',
    sources: [{ book_title: 'Book One', page: 12 }],
    progress: { status: 'new', difficult: false, saved: false, first_lesson_date: '2026-11-17', learned_on: null, my_sentences: [] },
    ...overrides,
  }
}
