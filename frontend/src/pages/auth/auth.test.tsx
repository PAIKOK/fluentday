import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '@/App'
import { safeNext } from '@/features/auth/safeNext'
import { makeMe, mockApi, signedOut } from '@/test/mockApi'

afterEach(() => vi.unstubAllGlobals())

function visit(path: string) {
  window.history.pushState({}, '', path)
  render(<App />)
}

async function fillLogin(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('login', () => {
  it('shows the server’s error message', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () => ({ status: 401, body: { detail: 'Incorrect email or password.' } }),
    })
    visit('/login')
    await fillLogin('ana@example.com', 'wrong-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })

  it('offers to resend the confirmation email for unverified accounts', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () => ({
        status: 403,
        body: { detail: { code: 'email_not_verified', message: 'Please confirm your email address first.' } },
      }),
    })
    visit('/login')
    await fillLogin('ana@example.com', 'a-good-password')
    expect(await screen.findByRole('link', { name: /resend the confirmation email/i })).toHaveAttribute(
      'href',
      '/check-email?email=ana%40example.com',
    )
  })

  it('returns to the page the learner originally wanted', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () => ({ status: 200, body: makeMe() }),
    })
    visit('/login?next=%2Fapp%2Fquiz')
    await fillLogin('ana@example.com', 'a-good-password')
    expect(await screen.findByRole('heading', { name: 'Check what you remember' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app/quiz')
  })
})

describe('safeNext', () => {
  it('only allows same-site paths', () => {
    expect(safeNext('/app/quiz')).toBe('/app/quiz')
    expect(safeNext('//evil.example')).toBe('/app')
    expect(safeNext('https://evil.example')).toBe('/app')
    expect(safeNext(null)).toBe('/app')
  })
})

describe('settings', () => {
  it('saves the profile and shows confirmation', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: makeMe() }),
      'PATCH /api/profile': (init) => ({ status: 200, body: { ...makeMe().profile, ...JSON.parse(String(init?.body)) } }),
    })
    visit('/app/settings')
    fireEvent.click(await screen.findByText('Advanced'))
    fireEvent.click(screen.getByRole('switch', { name: /email reminders/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('Your settings have been saved.')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === '/api/profile')!
    const sent = JSON.parse(String(init!.body))
    expect(sent.proficiency_level).toBe('advanced')
    expect(sent.notifications.email).toBe(true)
  })
})
