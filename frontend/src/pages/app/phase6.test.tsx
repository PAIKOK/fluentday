import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '@/App'
import { dashboard, makeMe, mockApi, signedOut } from '@/test/mockApi'
import type { NotificationList } from '@/types/notifications'

afterEach(() => vi.unstubAllGlobals())

const me = () => ({ status: 200, body: makeMe() })

function visit(path: string) {
  window.history.pushState({}, '', path)
  render(<App />)
}

const list: NotificationList = {
  unread: 1,
  items: [{ id: 'n1', kind: 'daily_reminder', title: 'Good morning, Ana! Your FluentDay lesson is ready.', body: "Today's plan:\n7 new words", link: '/app', created_at: '2026-11-18T02:30:00Z', read: false }],
}

describe('notifications', () => {
  it('lists reminders, shows the unread badge and marks them read', async () => {
    let unread = 1
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/notifications/unread-count': () => ({ status: 200, body: { unread } }),
      'GET /api/notifications': () => ({ status: 200, body: { ...list, unread, items: list.items.map((n) => ({ ...n, read: unread === 0 })) } }),
      'POST /api/notifications/read-all': () => {
        unread = 0
        return { status: 200, body: { unread: 0 } }
      },
    })
    visit('/app/notifications')
    expect(await screen.findByText(/Your FluentDay lesson is ready/)).toBeInTheDocument()
    expect(await screen.findAllByText('1 unread')).not.toHaveLength(0)
    expect((await screen.findAllByRole('link', { name: 'Notifications, 1 unread' })).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Mark all as read/ }))
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/notifications/unread-count').length).toBeGreaterThan(1) // badge refreshed
  })

  it('shows the real reminder time and channels on the dashboard', async () => {
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/notifications/unread-count': () => ({ status: 200, body: { unread: 0 } }),
      'GET /api/dashboard': () => ({ status: 200, body: dashboard({ next_reminder: { time: '07:30', channels: ['in_app', 'email'] } }) }),
    })
    visit('/app')
    expect(await screen.findByText('Daily reminder · In-app, Email')).toBeInTheDocument()
    expect(screen.getByText('07:30')).toBeInTheDocument()
  })
})

describe('push setting', () => {
  it('is switched off with an explanation when the server has no push keys', async () => {
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/notifications/unread-count': () => ({ status: 200, body: { unread: 0 } }),
      'GET /api/notifications/push/config': () => ({ status: 200, body: { enabled: false, public_key: null } }),
    })
    visit('/app/settings')
    expect(await screen.findByText(/aren’t set up on this server yet/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Browser push notifications/ })).toBeDisabled()
    expect(screen.getByRole('switch', { name: /Email reminders/ })).toBeEnabled()
  })
})

describe('email unsubscribe', () => {
  it('needs a click (so link scanners cannot unsubscribe) and works without logging in', async () => {
    let body: unknown = null
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/notifications/unsubscribe': (init) => {
        body = JSON.parse(String(init?.body))
        return { status: 200, body: { message: 'ok' } }
      },
    })
    visit('/unsubscribe?token=abc123token')
    const button = await screen.findByRole('button', { name: 'Unsubscribe from emails' })
    expect(body).toBeNull()
    fireEvent.click(button)
    expect(await screen.findByText(/won’t receive reminder emails/)).toBeInTheDocument()
    expect(body).toEqual({ token: 'abc123token' })
  })

  it('explains an incomplete link', async () => {
    mockApi({ 'GET /api/auth/me': signedOut })
    visit('/unsubscribe')
    expect(await screen.findByText(/link is incomplete/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unsubscribe from emails' })).toBeNull()
  })
})

describe('security', () => {
  it('confirms an email only with the sign-up password, and offers a reset when it is wrong', async () => {
    const sent: unknown[] = []
    let attempts = 0
    mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/notifications/unread-count': () => ({ status: 200, body: { unread: 0 } }),
      'GET /api/dashboard': () => ({ status: 200, body: dashboard() }),
      'POST /api/auth/verify-email': (init) => {
        sent.push(JSON.parse(String(init?.body)))
        attempts += 1
        return attempts === 1
          ? { status: 400, body: { detail: { code: 'wrong_password', message: 'That isn’t the password chosen when this account was created.' } } }
          : { status: 200, body: makeMe() }
      },
    })
    visit('/verify-email?token=tok-1234567890')
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'guess' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirm and start learning/ }))
    expect(await screen.findByRole('link', { name: 'Reset the password' })).toHaveAttribute('href', '/forgot-password')

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse-battery' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirm and start learning/ }))
    expect(await screen.findByRole('heading', { name: 'Make FluentDay yours' })).toBeInTheDocument()
    expect(sent).toEqual([{ token: 'tok-1234567890', password: 'guess' }, { token: 'tok-1234567890', password: 'correct-horse-battery' }])
  })

  it('logs out of all devices from settings', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/notifications/unread-count': () => ({ status: 200, body: { unread: 0 } }),
      'GET /api/notifications/push/config': () => ({ status: 200, body: { enabled: false, public_key: null } }),
      'POST /api/auth/logout-all': () => ({ status: 204 }),
    })
    visit('/app/settings')
    fireEvent.click(await screen.findByRole('button', { name: 'Log out of all devices' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/auth/logout-all' && init?.method === 'POST')).toBe(true)
  })
})
