import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button, Input } from '../../components/ui'
import { ApiClientError, authApi, fieldErrors } from '../../lib/api'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setErrors({})

    if (!token) {
      setFormError('This reset link is invalid or incomplete.')
      return
    }
    if (password !== confirm) {
      setErrors({ confirm: 'Passwords do not match' })
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword({ token, newPassword: password })
      navigate('/signin', { replace: true, state: { reset: true } })
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to reset password. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Choose a new password for your Command Center account."
      badge="Set new password"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label="New password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.newPassword || errors.password}
          hint="Use 8+ characters with at least one letter and one number."
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
        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          required
        />

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
          Update password
        </Button>

        <p className="text-center text-sm text-card-text-muted">
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
