import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { api, errorMessage } from '@/lib/api'
import type { Message } from '@/types/auth'
import { AuthLayout } from '../auth/AuthLayout'

/** Opened from the link in reminder emails. Asks for one click so email scanners that open links can't unsubscribe people. */
export function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(token ? null : 'This unsubscribe link is incomplete. You can turn off emails in Settings.')

  async function unsubscribe() {
    setState('busy')
    try {
      await api<Message>('/notifications/unsubscribe', { method: 'POST', json: { token } })
      setState('done')
    } catch (e) {
      setError(errorMessage(e))
      setState('idle')
    }
  }

  return (
    <AuthLayout title={state === 'done' ? 'You’re unsubscribed' : 'Stop reminder emails?'}>
      <div className="space-y-5">
        {state === 'done' ? (
          <Alert tone="success">You won’t receive reminder emails any more. You can switch them back on in Settings at any time.</Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">We’ll stop sending your daily FluentDay reminder emails. Your account and progress stay as they are.</p>
            {error && <Alert tone="error">{error}</Alert>}
            {token && <Button className="w-full" disabled={state === 'busy'} onClick={unsubscribe}>{state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe from emails'}</Button>}
          </>
        )}
        <Button variant="outline" className="w-full" asChild><Link to="/app/settings">Open settings</Link></Button>
      </div>
    </AuthLayout>
  )
}
