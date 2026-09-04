import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button, Input } from '../../components/ui'
import { ApiClientError, authApi, fieldErrors } from '../../lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSuccess(null)
    setErrors({})
    setLoading(true)
    try {
      const res = await authApi.forgotPassword({ email: email.trim() })
      setSuccess(res.message)
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to submit request. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Enter your work email and we’ll send a reset link if the account exists."
      badge="Password reset"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@gourmetpalace.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />

        {success && (
          <p className="rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-sm text-success-subtle-text">
            {success}
          </p>
        )}

        {formError && (
          <p className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-subtle-text">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          tone="brand"
          shape="rounded"
          fullWidth
          loading={loading}
        >
          Send reset link
        </Button>

        <p className="text-center text-sm text-card-text-muted">
          Remembered it?{' '}
          <Link
            to="/signin"
            className="font-medium text-accent-subtle-text hover:text-accent-hover"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
