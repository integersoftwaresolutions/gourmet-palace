import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { QueryError, QueryState, ListSkeleton } from '../components/query'
import { Button, Input, Modal, Pill, Select } from '../components/ui'
import { alertsApi, usersApi, type AlertRecord, type AdminUser } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { money } from '../lib/format'
import { useAppState } from '../context/useAppState'
import { relativeAction } from '../lib/format'
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
  const [dialog, setDialog] = useState<{ alert: AlertRecord; kind: 'note' | 'assign' | 'status' } | null>(null)
  const [assigneeDraft, setAssigneeDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => alertsApi.list({ ...query, status: status === 'all' ? '' : status }).then((res) => res.data.alerts),
    [query, status],
    { fallbackError: 'Unable to load alerts' },
  )

  useEffect(() => {
    if (!isAdmin) {
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
      setDialog(null)
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
        <div className="w-full sm:w-44">
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
      {actionError && !dialog ? <QueryError message={actionError} className="mt-4" /> : null}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
        {(rows) => (
        <>
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
                <div key={alert._id} className="rounded-lg border border-card-border bg-card p-4">
                  <div className="flex flex-col items-stretch gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 break-words xl:flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'} variant="outline">{alert.severity}</Pill>
                        <Pill tone="neutral" variant="outline">{alert.status}</Pill>
                        <span className="text-sm font-semibold text-card-text">{alert.title}</span>
                      </div>
                      <p className="mt-2 text-sm text-card-text-muted">{alert.detail}</p>
                      <p className="mt-1 text-xs text-card-text-faint">{locName(alert.locationId)} · {alert.type} · {relativeAction(alert.createdAt, 'Opened')}</p>
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
                            {note.createdAt ? ` · ${relativeAction(note.createdAt, 'Added')}` : ''}
                          </p>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-card-text-faint">Assignee ? {assigneeName || users.find((user) => user.id === assigneeId)?.name || 'Unassigned'}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setActionError(''); setDialog({ alert, kind: 'note' }) }}>Add note</Button>
                      {isAdmin && <Button size="sm" variant="outline" onClick={() => { setActionError(''); setAssigneeDraft(assigneeId); setDialog({ alert, kind: 'assign' }) }}>Add assignee</Button>}
                      <Button size="sm" variant="outline" onClick={() => { setActionError(''); setStatusDraft(''); setDialog({ alert, kind: 'status' }) }}>Change status</Button>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </>
        )}
      </QueryState>
      <Modal
        open={dialog !== null}
        onClose={() => { if (!busyId) { setDialog(null); setActionError('') } }}
        title={dialog?.kind === 'note' ? 'Add note' : dialog?.kind === 'assign' ? 'Add assignee' : 'Change status'}
        description={dialog ? `${dialog.alert.title} ? ${locName(dialog.alert.locationId)}` : undefined}
        footer={dialog && <>
          <Button variant="outline" size="sm" disabled={!!busyId} onClick={() => { setDialog(null); setActionError('') }}>Cancel</Button>
          <Button size="sm" disabled={!!busyId || (dialog.kind === 'note' && !noteDrafts[dialog.alert._id]?.trim()) || (dialog.kind === 'status' && !statusDraft)} onClick={() => {
            const body = dialog.kind === 'note'
              ? { action: 'note', note: noteDrafts[dialog.alert._id].trim() }
              : dialog.kind === 'assign'
                ? { action: 'assign', assigneeUserId: assigneeDraft || null }
                : { action: statusDraft }
            void act(dialog.alert._id, body)
          }}>{busyId ? 'Saving?' : dialog.kind === 'note' ? 'Save note' : dialog.kind === 'assign' ? 'Save assignee' : 'Save status'}</Button>
        </>}
      >
        {actionError && <p role="alert" className="mb-4 text-sm text-danger-subtle-text">{actionError}</p>}
        {dialog?.kind === 'note' && <Input label="Note" placeholder="Observation or follow-up" disabled={!!busyId} value={noteDrafts[dialog.alert._id] || ''} onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [dialog.alert._id]: e.target.value }))} />}
        {dialog?.kind === 'assign' && <Select label="Assignee" disabled={!!busyId} value={assigneeDraft} onChange={setAssigneeDraft} options={[
          { value: '', label: 'Unassigned' },
          ...users.filter((user) => user.isActive !== false).map((user) => ({ value: user.id, label: `${user.name} ? ${user.role}` })),
        ]} />}
        {dialog?.kind === 'status' && <Select label="New status" disabled={!!busyId} value={statusDraft} onChange={setStatusDraft} options={[
          { value: '', label: 'Choose status', disabled: true },
          ...(dialog.alert.status === 'OPEN' ? [{ value: 'acknowledge', label: 'Acknowledged' }] : []),
          ...(['OPEN', 'ACKNOWLEDGED'].includes(dialog.alert.status) ? [{ value: 'resolve', label: 'Resolved' }, { value: 'dismiss', label: 'Dismissed' }] : [{ value: 'reopen', label: 'Open' }]),
        ]} />}
      </Modal>
    </AppShell>
  )
}
