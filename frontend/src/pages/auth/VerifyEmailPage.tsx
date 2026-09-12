import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button, Input } from '../../components/ui'
import { ApiClientError, authApi, fieldErrors } from '../../lib/api'

type VerificationState = 'idle' | 'verifying' | 'verified' | 'error'
type VerifyLocationState = { email?: string; sent?: boolean } | null

export function VerifyEmailPage() {
  const location = useLocation()
  const routeState = location.state as VerifyLocationState
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get('token') || '',
  )
  const [email, setEmail] = useState(routeState?.email || '')
  const [state, setState] = useState<VerificationState>(token ? 'verifying' : 'idle')
  const [message, setMessage] = useState<string | null>(
    routeState?.sent ? 'Verification email sent. Check your inbox and spam folder.' : null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!token) return

    // Remove the bearer token from the address bar/history as soon as it is captured.
    window.history.replaceState(window.history.state, '', window.location.pathname)

    let cancelled = false
    ;(async () => {
      try {
        const res = await authApi.verifyEmail({ token })
        if (!cancelled) {
          setState('verified')
          setMessage(res.message)
        }
      } catch (err) {
        if (!cancelled) {
          setState('error')
          setMessage(
            err instanceof ApiClientError
              ? err.message
              : 'Unable to verify this email address.',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function resend(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setMessage(null)
    setResending(true)
    try {
      const res = await authApi.resendVerification({ email: email.trim() })
      setState('idle')
      setMessage(res.message)
    } catch (err) {
      setErrors(fieldErrors(err))
      setMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to request another verification email.',
      )
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Verify your email address before signing in."
      badge="Email verification"
      infoTitle="Didn’t receive the message?"
      infoBody="You can request another verification email below. For security, the response is the same whether an account exists or not."
    >
      <div className="flex flex-col gap-5">
        {state === 'verifying' && (
          <p className="rounded-lg border border-card-border bg-card-subtle px-3 py-3 text-sm text-card-text-muted">
            Verifying your email…
          </p>
        )}

        {state === 'verified' && (
          <>
            <p className="rounded-lg border border-success-border bg-success-subtle px-3 py-3 text-sm text-success-subtle-text">
              {message || 'Email verified successfully.'}
            </p>
            <Link
              to="/signin"
              state={{ verified: true }}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-text"
            >
              Continue to sign in
            </Link>
          </>
        )}

        {state !== 'verified' && state !== 'verifying' && (
          <form onSubmit={resend} className="flex flex-col gap-4" noValidate>
            {message && (
              <p
                className={`rounded-lg border px-3 py-3 text-sm ${
                  state === 'error'
                    ? 'border-danger-border bg-danger-subtle text-danger-subtle-text'
                    : 'border-success-border bg-success-subtle text-success-subtle-text'
                }`}
              >
                {message}
              </p>
            )}
            <Input
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
            />
            <Button type="submit" variant="outline" fullWidth loading={resending}>
              Resend verification email
            </Button>
          </form>
        )}

        {state !== 'verified' && (
          <p className="text-center text-sm text-card-text-muted">
            <Link to="/signin" className="font-medium text-accent-subtle-text hover:text-accent-hover">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </AuthLayout>
  )
}
