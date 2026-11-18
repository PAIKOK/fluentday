import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '@/App'
import { makeMe, mockApi } from '@/test/mockApi'
import type { Word } from '@/types/admin'

afterEach(() => vi.unstubAllGlobals())

const word: Word = {
  id: 'w1', word: 'happy', part_of_speech: 'adjective', pronunciation: '/ˈhæpiː/', definition: 'Enjoying or showing or marked by joy or pleasure.',
  examples: [{ text: 'A happy smile.', source: 'dataset' }], synonyms: [], antonyms: ['unhappy'], level: 'beginner', status: 'approved',
  needs_review: false, review_reasons: [], admin_edited: false, sources: [], starter_rank: 513, updated_at: '2026-11-18T08:00:00Z',
}

describe('starter vocabulary', () => {
  it('loads the bundled word list and shows where each word came from', async () => {
    let loaded = 0
    const fetchMock = mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: makeMe({ role: 'admin' }) }),
      'GET /api/admin/vocabulary/starter': () => ({ status: 200, body: { words_in_file: 2739, loaded, added: 0, updated: 0 } }),
      'POST /api/admin/vocabulary/starter': () => {
        loaded = 2739
        return { status: 200, body: { words_in_file: 2739, loaded, added: 2700, updated: 39 } }
      },
      'GET /api/admin/vocabulary': () => ({ status: 200, body: { items: loaded ? [word] : [], total: loaded ? 1 : 0, page: 1, page_size: 25 } }),
    })
    window.history.pushState({}, '', '/admin/vocabulary')
    render(<App />)

    expect(await screen.findByText(/2,739 of the most useful everyday English words/)).toBeInTheDocument()
    expect(screen.getByText('Load the starter vocabulary or upload a vocabulary book.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Load starter vocabulary/ }))

    expect(await screen.findByText(/2700 words added, 39 existing words filled in/)).toBeInTheDocument()
    expect(await screen.findByText('Starter list #513')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All loaded/ })).toBeDisabled()
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/admin/vocabulary/starter' && init?.method === 'POST')).toBe(true)
  })
})
