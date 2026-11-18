import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { api, errorMessage } from '@/lib/api'
import type { Message } from '@/types/auth'
import { AuthLayout } from './AuthLayout'

export function CheckEmailPage() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [sending, setSending] = useState(false)

  async function resend() {
    setSending(true)
    try {
      const result = await api<Message>('/auth/resend-verification', { method: 'POST', json: { email } })
      setStatus({ tone: 'success', text: result.message })
    } catch (e) {
      setStatus({ tone: 'error', text: errorMessage(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthLayout
      title="Check your email"
      description={
        <>
          We sent a confirmation link{email ? <> to <strong className="text-foreground">{email}</strong></> : ''}. Open it to
          activate your account.
        </>
      }
      footer={
        <Link to="/login" className="font-medium text-forest hover:underline">
          Back to log in
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-sage-50 text-forest ring-1 ring-sage">
          <MailCheck className="size-6" />
        </div>
        {status && <Alert tone={status.tone} className="w-full text-left">{status.text}</Alert>}
        {email && (
          <Button variant="outline" onClick={resend} disabled={sending}>
            {sending ? 'Sending…' : 'Resend the email'}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Can’t find it? Check your spam folder. The link expires in 24 hours.</p>
      </div>
    </AuthLayout>
  )
}
