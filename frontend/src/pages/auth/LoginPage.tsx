import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError, errorMessage } from '@/lib/api'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setUnverified(false)
    try {
      // On success the auth state changes and <RedirectIfSignedIn> takes the user onwards.
      await login(email, password)
    } catch (e) {
      setUnverified(e instanceof ApiError && e.code === 'email_not_verified')
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to continue your daily lesson."
      footer={
        <>
          New to FluentDay?{' '}
          <Link to="/register" className="font-medium text-forest hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && (
          <Alert tone="error">
            {error}
            {unverified && (
              <>
                {' '}
                <Link to={`/check-email?email=${encodeURIComponent(email)}`} className="font-medium underline">
                  Resend the confirmation email
                </Link>
              </>
            )}
          </Alert>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link to="/forgot-password" className="text-sm text-forest-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !email || !password}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
