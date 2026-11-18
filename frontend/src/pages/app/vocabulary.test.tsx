import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '@/App'
import { pickVoice } from '@/features/vocabulary/useSpeech'
import { dashboard, lessonWord, makeMe, mockApi } from '@/test/mockApi'
import type { Lesson } from '@/types/lesson'

afterEach(() => vi.unstubAllGlobals())

function visit(path: string) {
  window.history.pushState({}, '', path)
  render(<App />)
}

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return { lesson_date: '2026-11-17', kind: 'new', level: 'intermediate', words: [lessonWord()], revision_words: [], learned_count: 0, target: 7, ...overrides }
}

const me = () => ({ status: 200, body: makeMe() })

describe('daily vocabulary', () => {
  it('shows every part of a word card, with the definition’s source', async () => {
    mockApi({ 'GET /api/auth/me': me, 'GET /api/lessons/today': () => ({ status: 200, body: lesson() }) })
    visit('/app/vocabulary')
    expect(await screen.findByRole('link', { name: 'candid' })).toHaveAttribute('href', '/app/vocabulary/w1')
    expect(screen.getByText('adjective · /ˈkændɪd/')).toBeInTheDocument()
    expect(screen.getByText('truthful and straightforward; frank.')).toBeInTheDocument()
    expect(screen.getByText('Definition from Book One, page 12')).toBeInTheDocument()
    expect(screen.getByText('“She gave a candid answer.”')).toBeInTheDocument()
    expect(screen.getByText('From the book')).toBeInTheDocument()
    expect(screen.getByText('frank')).toBeInTheDocument()
    expect(screen.getByText('evasive')).toBeInTheDocument()
    expect(screen.getByText('Source: Book One, p. 12')).toBeInTheDocument()
    expect(screen.getByText('Word 1 of 1')).toBeInTheDocument()
  })

  it('labels definitions written by the team and AI examples', async () => {
    const word = lessonWord({ definition_source: null, examples: [{ text: 'An AI sentence.', source: 'ai' }] })
    mockApi({ 'GET /api/auth/me': me, 'GET /api/lessons/today': () => ({ status: 200, body: lesson({ words: [word] }) }) })
    visit('/app/vocabulary')
    expect(await screen.findByText('Definition written by the FluentDay team')).toBeInTheDocument()
    expect(screen.getByText('AI-generated example')).toBeInTheDocument()
  })

  it('marks a word as learned and updates the progress bar', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/lessons/today': () => ({ status: 200, body: lesson() }),
      'PATCH /api/vocabulary/w1/progress': () => ({ status: 200, body: { ...lessonWord().progress, status: 'learned', learned_on: '2026-11-17' } }),
    })
    visit('/app/vocabulary')
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as learned' }))
    expect(await screen.findByText('1 of 1 learned')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learned' })).toHaveAttribute('aria-pressed', 'true')
    const call = fetchMock.mock.calls.find(([url]) => String(url) === '/api/vocabulary/w1/progress')!
    expect(JSON.parse(String(call[1]!.body))).toEqual({ learned: true })
  })

  it('saves my own sentence', async () => {
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/lessons/today': () => ({ status: 200, body: lesson() }),
      'POST /api/vocabulary/w1/sentences': () => ({
        status: 201,
        body: { ...lessonWord().progress, my_sentences: [{ id: 's1', text: 'I like candid people.', created_at: '2026-11-17T09:00:00Z' }] },
      }),
    })
    visit('/app/vocabulary')
    fireEvent.click(await screen.findByRole('button', { name: /add my own sentence/i }))
    fireEvent.change(screen.getByLabelText(/write your own sentence/i), { target: { value: 'I like candid people.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save sentence' }))
    expect(await screen.findByText('My sentences')).toBeInTheDocument()
    expect(screen.getByText('My sentences').parentElement).toHaveTextContent('I like candid people.')
    expect(screen.queryByLabelText(/write your own sentence/i)).not.toBeInTheDocument()
  })

  it('shows a clear message when no words are published', async () => {
    mockApi({ 'GET /api/auth/me': me, 'GET /api/lessons/today': () => ({ status: 200, body: lesson({ kind: 'empty', words: [] }) }) })
    visit('/app/vocabulary')
    expect(await screen.findByText('No words are ready yet')).toBeInTheDocument()
  })

  it('turns into a revision lesson when every word has been met', async () => {
    const body = lesson({ kind: 'revision', words: [], revision_words: [lessonWord({ id: 'w9', word: 'frugal' })] })
    mockApi({ 'GET /api/auth/me': me, 'GET /api/lessons/today': () => ({ status: 200, body }) })
    visit('/app/vocabulary')
    expect(await screen.findByRole('heading', { level: 1, name: 'Today’s revision' })).toBeInTheDocument()
    expect(screen.getByText(/let’s revise/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'frugal' })).toBeInTheDocument()
  })
})

describe('dashboard', () => {
  it('shows real totals and today’s words from the API', async () => {
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/dashboard': () => ({
        status: 200,
        body: dashboard({
          lesson_kind: 'new',
          streak_days: 4,
          words_learned_total: 23,
          words_today: [
            { id: 'w1', word: 'candid', part_of_speech: 'adjective', definition: 'frank', level: 'intermediate', learned: true },
            { id: 'w2', word: 'frugal', part_of_speech: 'adjective', definition: 'thrifty', level: 'intermediate', learned: false },
          ],
        }),
      }),
    })
    visit('/app')
    expect(await screen.findByText('4 days')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    const newWords = screen.getByRole('link', { name: /new words/i })
    expect(within(newWords).getByText('1/7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /frugal/ })).toHaveAttribute('href', '/app/vocabulary/w2')
  })
})

describe('pickVoice', () => {
  const voice = (lang: string) => ({ lang }) as SpeechSynthesisVoice
  it('prefers the exact accent, then any English voice', () => {
    expect(pickVoice([voice('en-US'), voice('en-GB')], 'british')?.lang).toBe('en-GB')
    expect(pickVoice([voice('fr-FR'), voice('en-AU')], 'american')?.lang).toBe('en-AU')
    expect(pickVoice([voice('fr-FR')], 'british')).toBeNull()
  })
})
