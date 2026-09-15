import { useEffect, useState, type FormEvent } from 'react'
import { FiSettings, FiX } from 'react-icons/fi'
import { Button, Drawer, Input, Toggle } from '../components/ui'
import { useAuth } from '../context/useAuth'
import { ApiClientError, authApi, fieldErrors } from '../lib/api'

type Props = { open: boolean; onClose: () => void; onSignOut?: () => void }

export function Settings({ open, onClose, onSignOut }: Props) {
  const { user, refreshUser } = useAuth()
  const [email, setEmail] = useState(true)
  const [inApp, setInApp] = useState(true)
  const [alerts, setAlerts] = useState(true)
  const [brief, setBrief] = useState(true)
  const [saving, setSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (user?.notificationPreferences) {
      setEmail(user.notificationPreferences.email !== false)
      setInApp(user.notificationPreferences.inApp !== false)
      setAlerts(user.notificationPreferences.alerts !== false)
      setBrief(user.notificationPreferences.brief !== false)
    }
  }, [user])

  const save = async () => {
    setSaving(true)
    try {
      await authApi.updatePreferences({ email, inApp, alerts, brief })
      await refreshUser()
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordErrors({})
    setPasswordError(null)
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Passwords do not match' })
      return
    }

    setChangingPassword(true)
    try {
      const res = await authApi.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage(res.message)
    } catch (err) {
      setPasswordErrors(fieldErrors(err))
      setPasswordError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to change password. Try again.',
      )
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} labelledBy="settings-title">
      <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
        <div className="flex items-center gap-2">
          <FiSettings />
          <h2 id="settings-title" className="text-sm font-semibold tracking-widest text-card-text uppercase">
            Settings
          </h2>
        </div>
        <button type="button" aria-label="Close settings" onClick={onClose} className="p-2 text-card-text-muted">
          <FiX />
        </button>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto p-5">
        <section>
          <h3 className="text-lg font-semibold text-card-text">{user?.name}</h3>
          <p className="text-sm text-card-text-muted">
            {user?.email} · {user?.role}
          </p>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-semibold tracking-widest text-card-text-faint uppercase">
            Security
          </h3>
          <form onSubmit={changePassword} className="space-y-3" noValidate>
            <Input
              label="Current password"
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              error={passwordErrors.currentPassword}
              required
            />
            <Input
              label="New password"
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={passwordErrors.newPassword}
              hint="Use 8+ characters with at least one letter and one number."
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={passwordErrors.confirmPassword}
              required
            />
            {passwordMessage && (
              <p className="rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-xs text-success-subtle-text">
                {passwordMessage}
              </p>
            )}
            {passwordError && (
              <p className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-subtle-text">
                {passwordError}
              </p>
            )}
            <Button type="submit" size="sm" loading={changingPassword}>
              Change password
            </Button>
          </form>
        </section>

        <section className=" flex flex-col space-y-4">
          <h3 className="text-xs font-semibold tracking-widest text-card-text-faint uppercase">
            Notifications
          </h3>
          <Toggle label="Email notifications" checked={email} onChange={setEmail} />
          <Toggle label="In-app notifications" checked={inApp} onChange={setInApp} />
          <Toggle label="Critical/business alerts" checked={alerts} onChange={setAlerts} />
          <Toggle label="5:00 AM Pacific Morning Brief" checked={brief} onChange={setBrief} />
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save notification preferences'}
          </Button>
        </section>
      </div>

      <div className="border-t border-card-border p-5">
        <Button
          fullWidth
          variant="outline"
          onClick={() => (onSignOut ? onSignOut() : onClose())}
        >
          Sign out
        </Button>
      </div>
    </Drawer>
  )
}
