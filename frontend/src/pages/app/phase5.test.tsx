import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '@/App'
import { niceMax } from '@/features/progress/ColumnChart'
import { isAnswered, responseText } from '@/features/quiz/quizText'
import { makeMe, mockApi } from '@/test/mockApi'
import type { PronunciationHistory, PronunciationToday, ProgressData, QuizAttempt, QuizHistory, QuizQuestion, QuizToday } from '@/types/phase5'

afterEach(() => vi.unstubAllGlobals())

const me = () => ({ status: 200, body: makeMe() })

function visit(path: string) {
  window.history.pushState({}, '', path)
  render(<App />)
}

const question = (o: Partial<QuizQuestion>): QuizQuestion => ({
  id: 'q1', type: 'meaning', prompt: 'What does “candid” mean?', sentence: null, hint: null, speak_text: null, items: [],
  options: ['truthful and frank', 'very tired', 'careful with money', 'calm'], ...o,
})

const attempt = (o: Partial<QuizAttempt> = {}): QuizAttempt => ({
  id: 'a1', quiz_date: '2026-11-18', kind: 'daily', result: null,
  questions: [
    question({}),
    question({ id: 'q2', type: 'fill_blank', prompt: 'Type the missing word.', sentence: 'We went for a _____ walk.', hint: 'Starts with “b”, 5 letters', options: [] }),
  ],
  ...o,
})

const emptyHistory: QuizHistory = { items: [], quizzes_taken: 0, accuracy: null }

describe('quiz helpers', () => {
  it('knows when a question is answered and shows answers as text', () => {
    const match = question({ type: 'match', items: ['a', 'b'], options: ['one', 'two'] })
    expect(isAnswered(match, [1, -1])).toBe(false)
    expect(isAnswered(match, [1, 0])).toBe(true)
    expect(responseText(match, [1, 0])).toBe('a → two · b → one')
    expect(isAnswered(question({ type: 'fill_blank' }), '  ')).toBe(false)
    expect(responseText(question({}), 0)).toBe('truthful and frank')
    expect(responseText(question({}), null)).toBe('No answer')
  })

  it('rounds chart axes to clean numbers', () => {
    expect(niceMax(0)).toBe(4)
    expect(niceMax(7)).toBe(10)
    expect(niceMax(13)).toBe(20)
    expect(niceMax(420)).toBe(500)
  })
})

describe('quiz page', () => {
  it('explains how to unlock the first quiz', async () => {
    const today: QuizToday = { today: '2026-11-18', learned_words: 1, min_words: 4, attempt: null }
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/quiz/today': () => ({ status: 200, body: today }),
      'GET /api/quiz/history': () => ({ status: 200, body: emptyHistory }),
    })
    visit('/app/quiz')
    expect(await screen.findByText(/Mark 3 more words as learned/)).toBeInTheDocument()
  })

  it('takes the quiz one question at a time and shows the results', async () => {
    let submitted: unknown = null
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/quiz/today': () => ({ status: 200, body: { today: '2026-11-18', learned_words: 6, min_words: 4, attempt: attempt() } }),
      'GET /api/quiz/history': () => ({ status: 200, body: emptyHistory }),
      'POST /api/quiz/a1/submit': (init) => {
        submitted = JSON.parse(String(init?.body))
        return {
          status: 200,
          body: attempt({
            result: {
              score: 1, total: 2, submitted_at: '2026-11-18T08:00:00Z',
              items: [
                { question_id: 'q1', correct: true, response: 0, correct_answer: 'truthful and frank', explanation: '“candid” means: truthful and frank' },
                { question_id: 'q2', correct: false, response: 'quick', correct_answer: 'brisk', explanation: 'Full sentence: We went for a brisk walk.' },
              ],
            },
          }),
        }
      },
    })
    visit('/app/quiz')
    expect(await screen.findByRole('heading', { name: 'What does “candid” mean?' })).toBeInTheDocument()
    const next = screen.getByRole('button', { name: /Next/ })
    expect(next).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'truthful and frank' }))
    fireEvent.click(next)

    fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: 'quick' } })
    fireEvent.click(screen.getByRole('button', { name: /Check answers/ }))

    expect(await screen.findByText('Daily quiz: 50%')).toBeInTheDocument()
    expect(submitted).toEqual({ answers: [0, 'quick'] })
    expect(screen.getByText('brisk')).toBeInTheDocument()
    expect(screen.getByText(/Full sentence: We went for a brisk walk/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/quiz/history')).length).toBe(2) // history refreshed
  })
})

describe('pronunciation lab', () => {
  const today: PronunciationToday = {
    today: '2026-11-18', accent: 'american', completed: false,
    words: [
      { id: 'w1', word: 'candid', part_of_speech: 'adjective', pronunciation: '/ˈkændɪd/', definition: 'truthful and frank', example: 'She gave a candid answer.', attempts_today: 1, recognised_today: true },
      { id: 'w2', word: 'brisk', part_of_speech: 'adjective', pronunciation: null, definition: 'quick and energetic', example: null, attempts_today: 0, recognised_today: false },
    ],
  }
  const history: PronunciationHistory = {
    total_attempts: 1, recognised_attempts: 1, days_practised: 1,
    items: [{ id: 'p1', word_id: 'w1', word: 'candid', accent: 'british', heard: 'candid', recognised: true, method: 'browser_recognition', practice_date: '2026-11-18', created_at: '2026-11-18T08:00:00Z' }],
  }

  it('shows the challenge, opens the next word to practise and honours the accent preference', async () => {
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/pronunciation/today': () => ({ status: 200, body: today }),
      'GET /api/pronunciation/history': () => ({ status: 200, body: history }),
    })
    visit('/app/pronunciation')
    expect(await screen.findByRole('heading', { name: 'brisk', level: 2 })).toBeInTheDocument() // first word not yet practised
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'American' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'British' }))
    expect(screen.getByRole('radio', { name: 'British' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: /candid/ }))
    expect(await screen.findByRole('heading', { name: 'candid', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/1 attempt on 1 day/)).toBeInTheDocument()
    // jsdom has no microphone or speech recognition: the page says so instead of showing a dead button.
    expect(screen.getByText(/Recording isn’t available in this browser/)).toBeInTheDocument()
    expect(screen.getByText(/not a score for each sound/)).toBeInTheDocument()
  })
})

describe('progress page', () => {
  it('shows real numbers, charts with a table view and the level breakdown', async () => {
    const days = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18']
    const progress: ProgressData = {
      today: '2026-11-18', words_learned: 12, words_mastered: 2, revisions_due: 3, in_revision: 10, listening_minutes: 47,
      videos_completed: 5, quizzes_taken: 2, quiz_accuracy: 0.75, speaking_attempts: 9, streak_days: 4, longest_streak: 6,
      weekly: days.map((date, i) => ({ date, words_learned: i, revisions: 0, videos: 0, quizzes: 0, speaking: 0 })),
      monthly: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((month, i) => ({ month, words_learned: i, words_mastered: 0, total_learned: i })),
      levels: [{ level: 'beginner', count: 2 }, { level: 'intermediate', count: 9 }, { level: 'advanced', count: 1 }, { level: null, count: 0 }],
    }
    mockApi({ 'GET /api/auth/me': me, 'GET /api/progress': () => ({ status: 200, body: progress }) })
    visit('/app/progress')
    expect(await screen.findByText('75%')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('Longest: 6 days')).toBeInTheDocument()
    const weekly = screen.getByRole('figure', { name: 'Learning activities in the last 7 days' })
    expect(within(weekly).getAllByRole('row')).toHaveLength(8) // header + 7 days
    expect(within(weekly).getByRole('img', { name: /Learning activities: 6\. 6 words learned/ })).toBeInTheDocument()
    const monthly = screen.getByRole('figure', { name: 'Words learned and mastered per month' })
    expect(within(monthly).getByRole('list')).toHaveTextContent('Words learnedWords mastered') // legend for two series
  })
})
