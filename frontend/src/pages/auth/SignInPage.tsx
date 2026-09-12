import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button, Input } from '../../components/ui'
import { useAuth } from '../../context/useAuth'
import { ApiClientError, fieldErrors } from '../../lib/api'

export function SignInPage() {
  const { signin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname?: string }; reset?: boolean; verified?: boolean } | null)
      ?.from?.pathname || '/'
  const state = location.state as { reset?: boolean; verified?: boolean } | null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setErrors({})
    setVerificationRequired(false)
    setLoading(true)
    try {
      const user = await signin(email.trim(), password)
      navigate(user.onboardingComplete ? from : '/onboarding', { replace: true })
    } catch (err) {
      setErrors(fieldErrors(err))
      if (
        err instanceof ApiClientError &&
        err.status === 403 &&
        err.message.toLowerCase().includes('verify')
      ) {
        setVerificationRequired(true)
      }
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to sign in. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {(state?.reset || state?.verified) && (
          <p className="rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-sm text-success-subtle-text">
            {state.reset
              ? 'Password updated successfully. Sign in with your new password.'
              : 'Email verified successfully. You can sign in now.'}
          </p>
        )}

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
            rightSlot={
              <button
                type="button"
                className="text-xs font-semibold text-accent-subtle-text hover:text-accent-hover"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-accent-subtle-text hover:text-accent-hover"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {formError && (
          <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-subtle-text">
            <p>{formError}</p>
            {verificationRequired && (
              <Link
                to="/verify-email"
                state={{ email: email.trim() }}
                className="mt-2 inline-block font-semibold underline"
              >
                Resend verification email
              </Link>
            )}
          </div>
        )}

        <Button type="submit" tone="brand" shape="rounded" fullWidth loading={loading}>
          Sign in
        </Button>

        <p className="text-center text-sm text-card-text-muted">
          Don’t have an account?{' '}
          <Link to="/register" className="font-medium text-accent-subtle-text hover:text-accent-hover">
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
