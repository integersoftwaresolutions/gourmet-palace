import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button, Input } from '../../components/ui'
import { ApiClientError, authApi, fieldErrors } from '../../lib/api'

export function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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

    if (password !== confirm) {
      setErrors({ confirm: 'Passwords do not match' })
      return
    }

    setLoading(true)
    try {
      const normalizedEmail = email.trim()
      await authApi.register({
        name: name.trim(),
        email: normalizedEmail,
        password,
      })
      navigate('/verify-email', {
        replace: true,
        state: { email: normalizedEmail, sent: true },
      })
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to create your account. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Create your owner account. You’ll verify your email before setting up the organization."
      badge="Create account"
      infoTitle="What happens next?"
      infoBody="Verify your email, sign in, then create your organization and first location."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
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
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
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

        <Button type="submit" tone="brand" shape="rounded" fullWidth loading={loading}>
          Create account
        </Button>

        <p className="text-center text-sm text-card-text-muted">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-accent-subtle-text hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
