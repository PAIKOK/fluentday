import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '@/App'
import { leadingBlanks, shiftMonth } from '@/features/revision/MonthCalendar'
import { formatDuration, parseDuration } from '@/lib/duration'
import { lessonWord, makeMe, mockApi } from '@/test/mockApi'
import type { ListeningToday, NotebookEntry, NotebookPage, RevisionCalendar } from '@/types/phase4'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const me = () => ({ status: 200, body: makeMe() })

function visit(path: string) {
  window.history.pushState({}, '', path)
  render(<App />)
}

const entry = (o: Partial<NotebookEntry> = {}): NotebookEntry => ({
  id: 'n1', category: 'mistakes', title: 'Since vs for', content: 'I have lived here for 3 years.', tags: ['grammar'],
  favourite: false, word_id: null, video_id: null, created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z', ...o,
})

const notebookPage = (items: NotebookEntry[]): NotebookPage => ({
  items, total: items.length, page: 1, page_size: 100, counts: { vocabulary: 2, expressions: 0, sentences: 1, mistakes: items.length },
})

describe('helpers', () => {
  it('formats and parses durations', () => {
    expect(formatDuration(425)).toBe('7:05')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(formatDuration(null)).toBe('')
    expect(parseDuration('6:30')).toBe(390)
    expect(parseDuration('1:02:05')).toBe(3725)
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('6:x')).toBeNull()
  })

  it('works out calendar months', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(leadingBlanks('2026-11')).toBe(6) // 1 November 2026 is a Sunday
    expect(leadingBlanks('2026-06')).toBe(0) // 1 June 2026 is a Monday
  })
})

describe('notebook', () => {
  it('lists notes with category counts and sends filters to the API', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/notebook': () => ({ status: 200, body: notebookPage([entry()]) }),
      'GET /api/notebook/tags': () => ({ status: 200, body: ['grammar'] }),
    })
    visit('/app/notebook?category=mistakes')
    expect(await screen.findByRole('heading', { name: 'Since vs for' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /My Mistakes/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /All/ })).toHaveTextContent('4')
    expect(screen.getByRole('link', { name: /Export PDF/ })).toHaveAttribute('href', '/api/notebook/export.pdf?category=mistakes')

    fireEvent.click(screen.getByRole('button', { name: 'Favourites' }))
    await screen.findByRole('button', { name: 'Favourites', pressed: true })
    const urls = fetchMock.mock.calls.map(([u]) => String(u))
    expect(urls.some((u) => u.includes('category=mistakes') && u.includes('favourite=true'))).toBe(true)
  })

  it('creates a note', async () => {
    let created: unknown = null
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/notebook': () => ({ status: 200, body: notebookPage([]) }),
      'GET /api/notebook/tags': () => ({ status: 200, body: [] }),
      'POST /api/notebook': (init) => {
        created = JSON.parse(String(init?.body))
        return { status: 201, body: entry({ title: 'break the ice', category: 'expressions' }) }
      },
    })
    visit('/app/notebook?category=expressions')
    expect(await screen.findByText('My Expressions is empty')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /New note/ })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'break the ice' } })
    fireEvent.change(within(dialog).getByLabelText('Tags'), { target: { value: 'Social' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add note' }))
    expect(await screen.findByText('“break the ice” saved.')).toBeInTheDocument()
    expect(created).toMatchObject({ category: 'expressions', title: 'break the ice', tags: ['social'] })
  })
})

describe('revision', () => {
  const calendar: RevisionCalendar = {
    month: '2026-11', today: '2026-11-18', total_stages: 4,
    days: Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, due: i === 17 ? 1 : 0, reviewed: 0 })),
  }

  it('reveals the meaning, rates the word and finishes the session', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/revision/queue': () => ({ status: 200, body: { today: '2026-11-18', words: [lessonWord({ progress: { ...lessonWord().progress, status: 'learned' } })] } }),
      'GET /api/revision/calendar': () => ({ status: 200, body: calendar }),
      'POST /api/revision/w1': () => ({ status: 200, body: { word_id: 'w1', stage: 1, due_date: '2026-11-20', mastered: false } }),
    })
    visit('/app/revision')
    expect(await screen.findByRole('heading', { name: 'candid' })).toBeInTheDocument()
    expect(screen.queryByText('truthful and straightforward; frank.')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '18: 1 due' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show meaning/ }))
    expect(screen.getByText('truthful and straightforward; frank.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Remembered/ }))
    expect(await screen.findByText('Revision done for today')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([u]) => String(u) === '/api/revision/w1')!
    expect(JSON.parse(String(call[1]!.body))).toEqual({ rating: 'remembered' })
  })

  it('shows an empty state when nothing is due', async () => {
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/revision/queue': () => ({ status: 200, body: { today: '2026-11-18', words: [] } }),
      'GET /api/revision/calendar': () => ({ status: 200, body: calendar }),
    })
    visit('/app/revision')
    expect(await screen.findByText('Nothing to revise today')).toBeInTheDocument()
  })
})

describe('listening room', () => {
  const today = (questions = true): ListeningToday => ({
    lesson_date: '2026-11-18',
    items: [{
      video: {
        id: 'v1', video_id: 'dQw4w9WgXcQ', channel_key: 'bbc_6min', channel_name: 'BBC Learning English — 6 Minute English',
        title: 'Why do we dream?', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration_seconds: 375, published_at: null,
        questions: questions ? [{ id: 'q1', prompt: 'What is the topic?', options: ['Dreams', 'Food'] }] : [],
      },
      progress: { watched_seconds: 0, completed: false, completed_at: null, notes: '', quiz: null },
    }],
  })

  it('shows the video details and an empty state when nothing is scheduled', async () => {
    mockApi({ 'GET /api/auth/me': me, 'GET /api/listening/today': () => ({ status: 200, body: { lesson_date: '2026-11-18', items: [] } }) })
    visit('/app/listening')
    expect(await screen.findByText('No videos scheduled yet')).toBeInTheDocument()
  })

  it('autosaves notes and scores the comprehension quiz', async () => {
    const patches: unknown[] = []
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/listening/today': () => ({ status: 200, body: today() }),
      'PATCH /api/listening/v1/progress': (init) => {
        patches.push(JSON.parse(String(init?.body)))
        return { status: 200, body: { ...today().items[0].progress } }
      },
      'POST /api/listening/v1/quiz': () => ({
        status: 200,
        body: { score: 1, total: 1, submitted_at: '2026-11-18T09:00:00Z', items: [{ question_id: 'q1', chosen_index: 0, answer_index: 0, correct: true, explanation: 'It is about dreams.' }] },
      }),
    })
    visit('/app/listening')
    expect(await screen.findByRole('heading', { name: 'Why do we dream?' })).toBeInTheDocument()
    expect(screen.getByText('6:15')).toBeInTheDocument()

    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.change(screen.getByLabelText('My notes'), { target: { value: 'night owl = stays up late' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(patches).toContainEqual({ notes: 'night owl = stays up late' })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    vi.useRealTimers()

    fireEvent.click(screen.getByText('Dreams'))
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    expect(await screen.findByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('It is about dreams.')).toBeInTheDocument()
  })
})
