import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { QueryError, QueryState, ListSkeleton } from '../components/query'
import { Button, Card, Input, Pill, Select } from '../components/ui'
import { alertsApi, usersApi, type AlertRecord, type AdminUser } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'
import { useAuth } from '../context/useAuth'
import {
  applyEvidenceScope,
  evidenceLinks,
  type EvidenceItem,
} from '../lib/evidenceLinks'

function formatMetric(value: unknown) {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Math.abs(value) > 0 && Math.abs(value) < 1) return `${(value * 100).toFixed(1)}%`
    if (Math.abs(value) >= 100) return money(value)
    return value.toFixed(1)
  }
  if (typeof value === 'object') return null
  return String(value)
}

export function AlertsInbox() {
  const { query, locations, setDatePreset, setCustomFrom, setCustomTo, setSelectedLocationId } = useAppState()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('OPEN')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<AdminUser[]>([])
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => alertsApi.list({ ...query, status: status === 'all' ? '' : status }).then((res) => res.data.alerts),
    [query, status],
    { fallbackError: 'Unable to load alerts' },
  )

  useEffect(() => {
    if (!isAdmin) {
      setUsers([])
      return
    }
    let cancelled = false
    usersApi.list()
      .then((res) => {
        if (!cancelled) setUsers(res.data.users || [])
      })
      .catch(() => {
        if (!cancelled) setUsers([])
      })
    return () => { cancelled = true }
  }, [isAdmin])

  const names = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations])
  const locName = (id: AlertRecord['locationId']) => {
    if (!id) return 'Organization'
    if (typeof id === 'object') return id.name
    return names.get(String(id)) || 'Location'
  }

  const act = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id)
    try {
      await alertsApi.action(id, body)
      setActionError('')
      if (body.action === 'note') setNoteDrafts((prev) => ({ ...prev, [id]: '' }))
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Alert action failed'))
    } finally {
      setBusyId('')
    }
  }

  return (
    <AppShell title="Alerts" subtitle="Open exceptions, assignment, notes and lifecycle" activeNav="alerts">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select value={status} onChange={setStatus} options={[
            { value: 'OPEN', label: 'Open' },
            { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
            { value: 'RESOLVED', label: 'Resolved' },
            { value: 'DISMISSED', label: 'Dismissed' },
            { value: 'all', label: 'All statuses' },
          ]} />
        </div>
        <Pill tone="accent" variant="outline">{data?.length ?? 0} shown</Pill>
      </div>
      {actionError ? <QueryError message={actionError} className="mt-4" /> : null}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
        {(rows) => (
        <Card>
          {rows.length === 0 ? <p className="text-sm text-card-text-muted">No alerts in this scope.</p> : (
            <div className="space-y-3">
              {rows.map((alert) => {
                const actual = formatMetric(alert.actual)
                const normal = formatMetric(alert.normal)
                const delta = typeof alert.delta === 'number' ? `${alert.delta > 0 ? '+' : ''}${alert.delta.toFixed(1)}` : null
                const links = evidenceLinks((alert.evidence || []) as EvidenceItem[])
                const assigneeId = typeof alert.assigneeUserId === 'object' && alert.assigneeUserId
                  ? String(alert.assigneeUserId._id)
                  : String(alert.assigneeUserId || '')
                const assigneeName = typeof alert.assigneeUserId === 'object' && alert.assigneeUserId
                  ? alert.assigneeUserId.name
                  : null
                return (
                <div key={alert._id} className="rounded-lg border border-card-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'} variant="outline">{alert.severity}</Pill>
                        <Pill tone="neutral" variant="outline">{alert.status}</Pill>
                        <span className="text-sm font-semibold text-card-text">{alert.title}</span>
                      </div>
                      <p className="mt-2 text-sm text-card-text-muted">{alert.detail}</p>
                      <p className="mt-1 text-xs text-card-text-faint">{locName(alert.locationId)} · {alert.type} · opened {new Date(alert.createdAt).toLocaleString()}</p>
                      {(actual || normal || delta) && (
                        <p className="mt-2 text-xs text-card-text-muted">
                          {[actual ? `Actual ${actual}` : null, normal ? `Normal ${normal}` : null, delta ? `Delta ${delta}` : null].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {links.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {links.map((link) => (
                            <button
                              key={link.key}
                              type="button"
                              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                              onClick={() => {
                                applyEvidenceScope(link, { setDatePreset, setCustomFrom, setCustomTo, setSelectedLocationId })
                                navigate(link.path)
                              }}
                            >
                              <Pill tone="accent" variant="outline" size="sm">{link.label}</Pill>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 space-y-1">
                        {(alert.notes || []).map((note, i) => (
                          <p key={`${alert._id}-note-${i}`} className="text-xs text-card-text-muted">
                            Note · {note.text}
                            {note.createdAt ? ` · ${new Date(note.createdAt).toLocaleString()}` : ''}
                          </p>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="min-w-[12rem] flex-1">
                          <Input
                            label="Add note"
                            value={noteDrafts[alert._id] || ''}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [alert._id]: e.target.value }))}
                            placeholder="Observation or follow-up"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === alert._id || !(noteDrafts[alert._id] || '').trim()}
                          onClick={() => void act(alert._id, { action: 'note', note: noteDrafts[alert._id] })}
                        >
                          Save note
                        </Button>
                      </div>
                      {isAdmin ? (
                        <div className="mt-3 w-56">
                          <Select
                            label="Assignee"
                            value={assigneeId}
                            onChange={(value) => void act(alert._id, { action: 'assign', assigneeUserId: value || null })}
                            options={[
                              { value: '', label: 'Unassigned' },
                              ...users.filter((u) => u.isActive !== false).map((u) => ({
                                value: u.id,
                                label: `${u.name} · ${u.role}`,
                              })),
                            ]}
                          />
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-card-text-faint">Assignee · {assigneeName || 'Unassigned'}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {alert.status === 'OPEN' && <Button size="sm" variant="outline" disabled={busyId === alert._id} onClick={() => void act(alert._id, { action: 'acknowledge' })}>Acknowledge</Button>}
                      {['OPEN', 'ACKNOWLEDGED'].includes(alert.status) && <Button size="sm" variant="outline" disabled={busyId === alert._id} onClick={() => void act(alert._id, { action: 'resolve' })}>Resolve</Button>}
                      {['OPEN', 'ACKNOWLEDGED'].includes(alert.status) && <Button size="sm" variant="outline" disabled={busyId === alert._id} onClick={() => void act(alert._id, { action: 'dismiss' })}>Dismiss</Button>}
                      {['RESOLVED', 'DISMISSED'].includes(alert.status) && <Button size="sm" variant="outline" disabled={busyId === alert._id} onClick={() => void act(alert._id, { action: 'reopen' })}>Reopen</Button>}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </Card>
        )}
      </QueryState>
    </AppShell>
  )
}
