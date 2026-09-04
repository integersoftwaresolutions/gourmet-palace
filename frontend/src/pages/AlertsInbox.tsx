import { useState } from 'react'
import {
  Button,
  Card,
  Input,
  Modal,
  Pill,
  Select,
  Toggle,
} from '../components/ui'
import { AppShell } from '../components/layout/AppShell'
import { openAlertsCount, staticAlerts } from '../data/alerts'
import { cn } from '../lib/cn'

const edgeTone = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  accent: 'bg-accent',
} as const

type AlertSettings = {
  escalateAfterHours: string
  refundThreshold: string
  notifyEmail: boolean
  notifyInApp: boolean
  autoAssignOwner: boolean
  dataQualityDistinct: boolean
}

const defaultSettings: AlertSettings = {
  escalateAfterHours: '4',
  refundThreshold: '25',
  notifyEmail: true,
  notifyInApp: true,
  autoAssignOwner: false,
  dataQualityDistinct: true,
}

export function AlertsInbox() {
  const [severity, setSeverity] = useState('all')
  const [type, setType] = useState('all')
  const [location, setLocation] = useState('all')
  const [status, setStatus] = useState('open')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AlertSettings>(defaultSettings)
  const [draft, setDraft] = useState<AlertSettings>(defaultSettings)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openSettings = () => {
    setDraft(settings)
    setSettingsError(null)
    setSettingsOpen(true)
  }

  const closeSettings = () => {
    setSettingsOpen(false)
    setSettingsError(null)
    setSaving(false)
  }

  const saveSettings = () => {
    const hours = Number(draft.escalateAfterHours)
    const threshold = Number(draft.refundThreshold)

    if (!Number.isFinite(hours) || hours < 1) {
      setSettingsError('Escalation hours must be at least 1.')
      return
    }
    if (!Number.isFinite(threshold) || threshold < 1) {
      setSettingsError('Refund threshold must be at least 1%.')
      return
    }

    setSaving(true)
    // Frontend-only: keep settings in page state for this session.
    window.setTimeout(() => {
      setSettings({
        ...draft,
        escalateAfterHours: String(hours),
        refundThreshold: String(threshold),
      })
      closeSettings()
    }, 250)
  }

  return (
    <AppShell
      title="Alerts"
      subtitle="Prioritized exceptions with evidence, ownership and explicit resolution"
      activeNav="alerts"
      badge={
        <Pill tone="danger" variant="outline">
          {openAlertsCount} open
        </Pill>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select
              size="sm"
              label="Severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: 'all', label: 'All severities' },
                { value: 'critical', label: 'Critical' },
                { value: 'warning', label: 'Warning' },
                { value: 'data-quality', label: 'Data quality' },
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              size="sm"
              label="Type"
              value={type}
              onChange={setType}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'refunds', label: 'Refunds' },
                { value: 'cost', label: 'Cost' },
                { value: 'inventory', label: 'Inventory' },
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              size="sm"
              label="Location"
              value={location}
              onChange={setLocation}
              options={[
                { value: 'all', label: 'All locations' },
                { value: 'wh', label: 'Woodland Hills' },
                { value: 'sv', label: 'Simi Valley' },
                { value: 'so', label: 'Sherman Oaks' },
              ]}
            />
          </div>
          <div className="w-36">
            <Select
              size="sm"
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'acknowledged', label: 'Acknowledged' },
                { value: 'resolved', label: 'Resolved' },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2 pb-0.5">
            <Button
              variant="outline"
              size="sm"
              tone="neutral"
              onClick={() => {
                setSeverity('all')
                setType('all')
                setLocation('all')
                setStatus('open')
              }}
            >
              Clear filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              tone="neutral"
              onClick={openSettings}
            >
              Alert settings
            </Button>
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {staticAlerts.map((alert) => (
            <li key={alert.id}>
              <Card
                padding="none"
                accentBorder={alert.accentBorder ? 'accent' : false}
                className="overflow-hidden"
              >
                <div className="flex">
                  {!alert.accentBorder && (
                    <span
                      className={cn('w-1.5 shrink-0', edgeTone[alert.tone])}
                      aria-hidden
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {alert.badges.map((badge) => (
                          <Pill
                            key={badge.label}
                            tone={badge.tone}
                            variant="outline"
                            size="sm"
                          >
                            {badge.label}
                          </Pill>
                        ))}
                      </div>
                      <h2 className="mt-3 text-base font-semibold text-card-text">
                        {alert.title}
                      </h2>
                      <p className="mt-1 text-sm text-card-text-muted">
                        {alert.detail}
                      </p>
                      <p
                        className={cn(
                          'mt-2 text-xs',
                          alert.metaAccent
                            ? 'text-accent-subtle-text'
                            : 'text-card-text-faint',
                        )}
                      >
                        {alert.meta}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-2 text-xs font-medium text-accent-subtle-text">
                        <button type="button" className="hover:text-accent-hover">
                          Assign
                        </button>
                        <span aria-hidden>·</span>
                        <button type="button" className="hover:text-accent-hover">
                          Dismiss
                        </button>
                        <span aria-hidden>·</span>
                        <button type="button" className="hover:text-accent-hover">
                          Open source →
                        </button>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <Pill
                        tone={
                          alert.status === 'Acknowledged' ? 'accent' : 'neutral'
                        }
                        variant="outline"
                        size="sm"
                        className="w-fit self-start sm:self-end"
                      >
                        {alert.status}
                      </Pill>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" tone="neutral">
                          Acknowledge
                        </Button>
                        <Button variant="outline" size="sm" tone="neutral">
                          Resolve
                        </Button>
                        <Button variant="outline" size="sm" tone="neutral">
                          View evidence
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <div className="space-y-1 text-xs">
          <p className="text-surface-text-muted">
            Critical alerts escalate after {settings.escalateAfterHours} hours
            if unacknowledged. Refunds above {settings.refundThreshold}% vs
            baseline are treated as critical. Thresholds are configured here
            for this session only.
          </p>
          <p className="text-accent-subtle-text">
            {settings.dataQualityDistinct
              ? 'Data-quality alerts remain visually distinct from performance exceptions.'
              : 'Data-quality alerts use the same styling as performance exceptions.'}
          </p>
        </div>
      </div>

      <Modal
        open={settingsOpen}
        onClose={closeSettings}
        title="Alert settings"
        description="Configure escalation and notification preferences for this session. Nothing is saved to the server."
        footer={
          <>
            <Button variant="outline" onClick={closeSettings}>
              Cancel
            </Button>
            <Button tone="brand" loading={saving} onClick={saveSettings}>
              Save settings
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Escalate critical after (hours)"
            type="number"
            min={1}
            value={draft.escalateAfterHours}
            onChange={(e) => {
              setDraft((prev) => ({
                ...prev,
                escalateAfterHours: e.target.value,
              }))
              setSettingsError(null)
            }}
          />

          <Input
            label="Refund spike threshold (%)"
            type="number"
            min={1}
            value={draft.refundThreshold}
            onChange={(e) => {
              setDraft((prev) => ({
                ...prev,
                refundThreshold: e.target.value,
              }))
              setSettingsError(null)
            }}
            hint="Critical when refunds exceed baseline by this percent."
          />

          <Toggle
            id="notify-email"
            label="Email notifications"
            checked={draft.notifyEmail}
            onChange={(checked) =>
              setDraft((prev) => ({ ...prev, notifyEmail: checked }))
            }
          />

          <Toggle
            id="notify-in-app"
            label="In-app notifications"
            checked={draft.notifyInApp}
            onChange={(checked) =>
              setDraft((prev) => ({ ...prev, notifyInApp: checked }))
            }
          />

          <Toggle
            id="auto-assign"
            label="Auto-assign location owner"
            checked={draft.autoAssignOwner}
            onChange={(checked) =>
              setDraft((prev) => ({ ...prev, autoAssignOwner: checked }))
            }
          />

          <Toggle
            id="dq-distinct"
            label="Keep data-quality alerts visually distinct"
            checked={draft.dataQualityDistinct}
            onChange={(checked) =>
              setDraft((prev) => ({
                ...prev,
                dataQualityDistinct: checked,
              }))
            }
          />

          {settingsError && (
            <p className="text-xs text-danger-subtle-text">{settingsError}</p>
          )}
        </div>
      </Modal>
    </AppShell>
  )
}
