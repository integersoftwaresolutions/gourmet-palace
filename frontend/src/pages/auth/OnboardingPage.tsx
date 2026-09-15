import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Button, Input, Select } from '../../components/ui'
import { useAuth } from '../../context/useAuth'
import { ApiClientError, authApi, fieldErrors } from '../../lib/api'
import { timezoneSelectOptions } from '../../lib/timezones'

function slugPreview(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 54)
      .replace(/-+$/g, '') || 'organization'
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user, refreshUser, signout } = useAuth()
  const [organizationName, setOrganizationName] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const slug = useMemo(() => slugPreview(organizationName), [organizationName])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    setLoading(true)
    try {
      await authApi.completeOnboarding({
        organizationName: organizationName.trim(),
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim(),
        timezone: timezone.trim(),
      })
      await refreshUser()
      navigate('/', { replace: true })
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to finish organization setup. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow={`Welcome${user?.name ? `, ${user.name}` : ''}. Create your organization and first location to enter the application.`}
      badge="Organization setup"
      infoTitle="No integrations are configured here."
      infoBody="Square, Google, and other integrations remain available later from Administration."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label="Organization / business name"
          name="organizationName"
          autoComplete="organization"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          error={errors.organizationName}
          required
        />
        <Input
          label="Organization slug"
          name="slugPreview"
          value={slug}
          disabled
          hint="Generated automatically. If this slug already exists, a unique suffix will be added."
        />
        <Input
          label="First location name"
          name="locationName"
          placeholder="Main location"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          error={errors.locationName}
          required
        />
        <Input
          label="Location address"
          name="locationAddress"
          autoComplete="street-address"
          value={locationAddress}
          onChange={(e) => setLocationAddress(e.target.value)}
          error={errors.locationAddress}
          required
        />
        <Select
          label="Timezone"
          name="timezone"
          value={timezone}
          onChange={setTimezone}
          options={timezoneSelectOptions(timezone)}
          error={errors.timezone}
        />
        <p className="-mt-3 text-xs text-card-text-faint">Business days close at 4:00 AM in this location timezone.</p>

        {formError && (
          <p className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-subtle-text">
            {formError}
          </p>
        )}

        <Button type="submit" tone="brand" shape="rounded" fullWidth loading={loading}>
          Create organization and continue
        </Button>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          onClick={() => void signout()}
        >
          Sign out and use another account
        </Button>
      </form>
    </AuthLayout>
  )
}
