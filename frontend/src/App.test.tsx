import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from './App'
import { dashboard, makeMe, mockApi, signedOut } from './test/mockApi'

function visit(path: string) {
  window.history.pushState({}, '', path)
  render(<App />)
}

afterEach(() => vi.unstubAllGlobals())

describe('App routing', () => {
  it('renders the landing hero on / with sign-up links', async () => {
    mockApi({ 'GET /api/auth/me': signedOut })
    visit('/')
    expect(screen.getByRole('heading', { level: 1, name: /your journey to confident english/i })).toBeInTheDocument()
    expect((await screen.findAllByRole('link', { name: 'Start Learning' }))[0]).toHaveAttribute('href', '/register')
  })

  it('sends signed-out visitors from /app to the login page', async () => {
    mockApi({ 'GET /api/auth/me': signedOut })
    visit('/app/notebook')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe('?next=%2Fapp%2Fnotebook')
  })

  it('shows the dashboard with the learner’s first name and every sidebar section', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: makeMe() }),
      'GET /api/dashboard': () => ({ status: 200, body: dashboard() }),
    })
    visit('/app')
    expect(await screen.findByRole('heading', { level: 1, name: /, Ana/ })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'App' })
    for (const label of ['Dashboard', 'Daily Vocabulary', 'Listening Room', 'Pronunciation Lab', 'Daily Quiz', 'My Notebook', 'Revision Calendar', 'My Progress', 'Settings']) {
      expect(nav).toHaveTextContent(label)
    }
    expect(screen.getByRole('link', { name: /continue learning/i })).toHaveAttribute('href', '/app/vocabulary')
    expect(screen.queryByRole('link', { name: 'Admin dashboard' })).not.toBeInTheDocument()
  })

  it('prompts learners without a level to choose one', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: makeMe({}, { proficiency_level: null }) }),
      'GET /api/dashboard': () => ({ status: 200, body: dashboard() }),
    })
    visit('/app')
    expect(await screen.findByRole('link', { name: 'Set my level' })).toHaveAttribute('href', '/app/settings')
  })

  it('keeps subscribers out of /admin', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: makeMe() }),
      'GET /api/dashboard': () => ({ status: 200, body: dashboard() }),
    })
    visit('/admin/books')
    expect(await screen.findByRole('navigation', { name: 'App' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app')
  })

  it('lets admins into /admin', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: makeMe({ role: 'admin' }) }),
      'GET /api/admin/overview': () => ({
        status: 200,
        body: { users_total: 3, users_verified: 2, books_ready: 1, words_total: 40, words_approved: 10, words_pending: 30, words_needing_review: 4 },
      }),
    })
    visit('/admin')
    expect(await screen.findByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review flagged words' })).toBeInTheDocument()
  })
})
