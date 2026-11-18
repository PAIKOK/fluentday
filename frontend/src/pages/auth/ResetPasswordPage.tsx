import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import type { Message } from '@/types/auth'
import { AuthLayout } from './AuthLayout'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is incomplete. Please request a new one.')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const mismatch = confirm.length > 0 && confirm !== password

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api<Message>('/auth/reset-password', { method: 'POST', json: { token, password } })
      setDone(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" description="You can now log in with your new password.">
        <Button asChild size="lg" className="w-full">
          <Link to="/login">Log in</Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Choose a new password"
      footer={
        <Link to="/forgot-password" className="font-medium text-forest hover:underline">
          Request a new link
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" required aria-invalid={mismatch} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {mismatch && <p className="mt-1.5 text-xs text-destructive">Passwords don’t match.</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !token || password.length < 8 || password !== confirm}>
          {submitting ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
