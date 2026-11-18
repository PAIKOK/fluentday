import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/common/Alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError, api, errorMessage } from '@/lib/api'
import type { Me } from '@/types/auth'
import { AuthLayout } from './AuthLayout'

/** Asks for the sign-up password, so someone who registered another person's email can't keep that account. */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { setMe } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ text: string; wrongPassword: boolean } | null>(
    token ? null : { text: 'This confirmation link is incomplete.', wrongPassword: false },
  )

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const me = await api<Me>('/auth/verify-email', { method: 'POST', json: { token, password } })
      setMe(me)
      navigate(me.user.role === 'admin' ? '/admin' : '/app/settings?welcome=1', { replace: true })
    } catch (e) {
      setError({ text: errorMessage(e), wrongPassword: e instanceof ApiError && e.code === 'wrong_password' })
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Confirm your email" description="Enter the password you chose when you signed up to finish.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && (
          <Alert tone="error">
            {error.text}
            {error.wrongPassword && (
              <>
                {' '}
                <Link to="/forgot-password" className="font-medium underline">Reset the password</Link>
              </>
            )}
          </Alert>
        )}
        {token ? (
          <>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submitting || !password}>
              {submitting ? 'Confirming…' : 'Confirm and start learning'}
            </Button>
          </>
        ) : (
          <Button asChild className="w-full"><Link to="/login">Go to log in</Link></Button>
        )}
      </form>
    </AuthLayout>
  )
}
