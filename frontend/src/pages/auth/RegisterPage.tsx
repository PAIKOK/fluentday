import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { api, errorMessage } from '@/lib/api'
import type { Me } from '@/types/auth'
import { AuthLayout } from './AuthLayout'

export function RegisterPage() {
  const { setMe } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const tooShort = password.length > 0 && password.length < 8

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      // Signed in straight away; <RedirectIfSignedIn> then takes the learner into the app.
      setMe(await api<Me>('/auth/register', { method: 'POST', json: { full_name: fullName, email, password, timezone } }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start your daily English routine — it takes less than a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-forest hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" autoComplete="name" required maxLength={80} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={tooShort}
            aria-describedby="password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id="password-hint" className={tooShort ? 'mt-1.5 text-xs text-destructive' : 'mt-1.5 text-xs text-muted-foreground'}>
            At least 8 characters.
          </p>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !fullName.trim() || !email || password.length < 8}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthLayout>
  )
}
