import { useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { AdminTabs } from '../../components/layout/SectionTabs'
import { QueryError, QueryState, TableSkeleton } from '../../components/query'
import { Button, Card, Input, Modal, Pill, Select } from '../../components/ui'
import { locationsApi, type Location } from '../../lib/api'
import { asyncMessage } from '../../lib/asyncError'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { useAppState } from '../../context/useAppState'

export function Locations() {
  const { refreshLocations } = useAppState()
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    async () => {
      const response = await locationsApi.list()
      await refreshLocations()
      return response.data.locations
    },
    [],
    { fallbackError: 'Unable to load locations' },
  )
  const [editing, setEditing] = useState<Location | null>(null)
  const [creating, setCreating] = useState(false)
  const [actionError, setActionError] = useState('')
  const toggle = async (row: Location) => {
    try {
      await locationsApi.update(row.id, { status: row.status === 'active' ? 'inactive' : 'active' })
      setActionError('')
      reload()
    } catch (err) {
      setActionError(asyncMessage(err, 'Update failed'))
    }
  }
  return <AppShell title="Locations" subtitle="Configuration-driven restaurants, timezones and lifecycle state" activeNav="admin">
    <AdminTabs value="locations" />
    <div className="mt-5 space-y-4">
      {actionError && <QueryError message={actionError} />}
      <div><Button size="sm" onClick={() => setCreating(true)}>Add location</Button></div>
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<TableSkeleton />} className="mt-0">
        {(rows) => (
      <Card><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-card-border text-left text-xs uppercase text-card-text-faint"><th className="py-2">Location</th><th>Address</th><th>Timezone</th><th>Business-day cutoff</th><th>Status</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-card-border last:border-0"><td className="py-3 font-medium text-card-text">{row.name}</td><td className="text-card-text-muted">{row.address || '—'}</td><td className="text-card-text-muted">{row.timezone}</td><td className="text-card-text-muted">4:00 AM local</td><td><Pill tone={row.status === 'active' ? 'success' : 'neutral'} variant="outline">{row.status}</Pill></td><td className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(row)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void toggle(row)}>{row.status === 'active' ? 'Deactivate' : 'Activate'}</Button></div></td></tr>)}</tbody></table></div></Card>
        )}
      </QueryState>
    </div>
    {creating && <LocationModal onClose={() => setCreating(false)} onDone={async () => { setCreating(false); reload() }} />}
    {editing && <LocationModal location={editing} onClose={() => setEditing(null)} onDone={async () => { setEditing(null); reload() }} />}
  </AppShell>
}

function LocationModal({ location, onClose, onDone }: { location?: Location; onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(location?.name || '')
  const [address, setAddress] = useState(location?.address || '')
  const [timezone, setTimezone] = useState(location?.timezone || 'America/Los_Angeles')
  const [status, setStatus] = useState<'active' | 'inactive'>(location?.status || 'active')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true); setError('')
    try {
      if (location) await locationsApi.update(location.id, { name, address, timezone, status })
      else await locationsApi.create({ name, address, timezone, status })
      await onDone()
    } catch (err) { setError(asyncMessage(err, 'Save failed')) } finally { setBusy(false) }
  }
  return <Modal open title={location ? 'Edit location' : 'Add location'} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={() => void save()}>{location ? 'Save changes' : 'Create'}</Button></>}>
    <div className="space-y-4">
      <Input label="Location name" value={name} onChange={(event) => setName(event.target.value)} />
      <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
      <Input label="IANA timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="America/Los_Angeles" />
      <p className="-mt-2 text-xs text-card-text-faint">Business days close at 4:00 AM in this location timezone.</p>
      <Select label="Status" value={status} onChange={(value) => setStatus(value as typeof status)} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      {error && <p className="text-sm text-danger-subtle-text">{error}</p>}
    </div>
  </Modal>
}
