import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import type { Message } from '@/types/auth'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await api<Message>('/auth/forgot-password', { method: 'POST', json: { email } })
      setResult({ tone: 'success', text: response.message })
    } catch (e) {
      setResult({ tone: 'error', text: errorMessage(e) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we’ll send you a link to choose a new password."
      footer={
        <Link to="/login" className="font-medium text-forest hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {result && <Alert tone={result.tone}>{result.text}</Alert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !email}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  )
}
