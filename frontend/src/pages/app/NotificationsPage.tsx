import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadState } from '@/components/common/LoadState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NOTIFICATIONS_READ_EVENT } from '@/features/notifications/events'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AppNotification, NotificationList } from '@/types/notifications'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { data, isLoading, error, reload } = useApiQuery<NotificationList>('/notifications')
  const [actionError, setActionError] = useState<string | null>(null)

  async function markAllRead() {
    setActionError(null)
    try {
      await api('/notifications/read-all', { method: 'POST' })
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT))
      await reload()
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  async function open(n: AppNotification) {
    if (!n.read) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined)
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT))
    }
    if (n.link) navigate(n.link)
    else void reload()
  }

  return (
    <>
      <PageHeader eyebrow="Notifications" title="Your reminders" description="Daily reminders appear here when in-app notifications are switched on." />
      <LoadState isLoading={isLoading} error={error} onRetry={reload} hasData={data !== null}>
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Your first reminder arrives at your chosen reminder time."
            action={<Button variant="outline" asChild><Link to="/app/settings">Reminder settings</Link></Button>}
          />
        ) : (
          data && (
            <Card className="p-2 sm:p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <p className="text-sm text-muted-foreground">{data.unread ? `${data.unread} unread` : 'All caught up'}</p>
                {data.unread > 0 && <Button size="sm" variant="ghost" onClick={markAllRead}><CheckCheck /> Mark all as read</Button>}
              </div>
              {actionError && <Alert tone="error" className="mx-3 mb-2">{actionError}</Alert>}
              <ul className="divide-y divide-border">
                {data.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={cn('flex w-full gap-3 rounded-xl px-3 py-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring', !n.read && 'bg-sage-50/70')}
                    >
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-forest')} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-medium">{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                        <span className="mt-1 block whitespace-pre-line text-sm text-muted-foreground">{n.body}</span>
                        <span className="mt-2 block text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )
        )}
      </LoadState>
    </>
  )
}
