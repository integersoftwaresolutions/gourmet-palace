import { useMemo, useRef, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { OperationsTabs } from '../components/layout/SectionTabs'
import { QueryError, QueryState, ListSkeleton } from '../components/query'
import { Button, Card, Input, Modal, Pill, Select } from '../components/ui'
import { inventoryApi } from '../lib/api'
import { asyncMessage } from '../lib/asyncError'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useAppState } from '../context/useAppState'

const UNITS = ['lb', 'oz', 'kg', 'g', 'ea', 'case', 'box', 'bag', 'gal', 'qt', 'l', 'ml']
const itemId = (item: { _id?: string; id?: string; itemId?: string }) => String(item._id || item.id || item.itemId || '')

function downloadCsv(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function OperationsIngredientInventory() {
  const { query, locations, selectedLocationId } = useAppState()
  const activeLocations = locations.filter((l) => l.status === 'active')
  const headerLocationId = selectedLocationId !== 'all' ? selectedLocationId : ''
  const [pickedLocationId, setPickedLocationId] = useState('')
  const workingLocationId = headerLocationId || pickedLocationId

  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    () => inventoryApi.list(query).then((r) => r.data.items),
    [query],
    { fallbackError: 'Unable to load inventory' },
  )
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const rows = useMemo(() => data || [], [data])

  const dirtyCount = useMemo(() => {
    return rows.filter((item) => {
      const id = itemId(item)
      if (drafts[id] == null) return false
      const draft = Number(drafts[id])
      return Number.isFinite(draft) && draft !== Number(item.currentQuantity)
    }).length
  }, [rows, drafts])

  const requireLocation = () => {
    if (!workingLocationId) {
      setActionError('Select a location in the header or the location control below. Create, CSV import and copy-previous are per location.')
      return false
    }
    return true
  }

  const setDraft = (id: string, value: string) => setDrafts((cur) => ({ ...cur, [id]: value }))

  const saveBulk = async () => {
    const items = rows.map((item) => {
      const id = itemId(item)
      const quantity = Number(drafts[id])
      if (!Number.isFinite(quantity) || quantity < 0 || quantity === Number(item.currentQuantity)) return null
      return { itemId: id, quantity }
    }).filter((row): row is { itemId: string; quantity: number } => Boolean(row))
    if (!items.length) return
    setBusy('bulk')
    try {
      await inventoryApi.bulkCount(items)
      setDrafts({})
      setActionError('')
      setNotice(`Saved ${items.length} counts.`)
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Bulk count failed'))
    } finally {
      setBusy('')
    }
  }

  const copyPrevious = async () => {
    if (!requireLocation()) return
    setBusy('copy')
    try {
      const res = await inventoryApi.copyPrevious(workingLocationId)
      const next = { ...drafts }
      for (const row of res.data.items) next[row.itemId] = String(row.quantity)
      setDrafts(next)
      setActionError('')
      setNotice('Previous counts loaded into the quantity fields. Review and save bulk counts to persist.')
    } catch (e) {
      setActionError(asyncMessage(e, 'Copy previous failed'))
    } finally {
      setBusy('')
    }
  }

  const exportCsv = async () => {
    setBusy('export')
    try {
      const res = await inventoryApi.exportCsv(query)
      downloadCsv(res.data.csv, `ingredient-inventory-${workingLocationId || 'scope'}.csv`)
      setActionError('')
      setNotice('CSV downloaded.')
    } catch (e) {
      setActionError(asyncMessage(e, 'CSV export failed'))
    } finally {
      setBusy('')
    }
  }

  const importCsv = async (file: File | null) => {
    if (!file) return
    if (!requireLocation()) return
    setBusy('import')
    try {
      const csv = await file.text()
      const res = await inventoryApi.importCsv(workingLocationId, csv)
      const errNote = res.data.errors.length ? ` ${res.data.errors.length} row error(s).` : ''
      setNotice(`CSV import: ${res.data.created} created, ${res.data.updated} updated.${errNote}`)
      setActionError(res.data.errors[0] ? `Row ${res.data.errors[0].row}: ${res.data.errors[0].message}` : '')
      setDrafts({})
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'CSV import failed'))
    } finally {
      setBusy('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <AppShell title="Ingredient inventory" subtitle="Manual counts, par levels, CSV/bulk updates and stale/critical status" activeNav="operations">
      <OperationsTabs value="inventory" />
      <div className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
        {selectedLocationId === 'all' ? (
          <Select
            label="Working location"
            placeholder="Select location"
            value={pickedLocationId}
            onChange={setPickedLocationId}
            options={activeLocations.map((l) => ({ value: l.id, label: l.name }))}
          />
        ) : null}
        <Button size="sm" onClick={() => setCreating(true)}>Create item</Button>
        <Button size="sm" variant="outline" loading={busy === 'copy'} onClick={() => void copyPrevious()}>Copy previous counts</Button>
        <Button size="sm" variant="outline" loading={busy === 'bulk'} disabled={!dirtyCount} onClick={() => void saveBulk()}>
          Save bulk counts{dirtyCount ? ` (${dirtyCount})` : ''}
        </Button>
        <Button size="sm" variant="outline" loading={busy === 'export'} onClick={() => void exportCsv()}>Export CSV</Button>
        <label className="inline-flex">
          <Button size="sm" variant="outline" loading={busy === 'import'} onClick={() => fileRef.current?.click()}>Import CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void importCsv(e.target.files?.[0] || null)} />
        </label>
      </div>
      {actionError ? <QueryError message={actionError} className="mt-4" /> : null}
      {notice ? <p className="mt-3 text-sm text-card-text-muted">{notice}</p> : null}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<ListSkeleton />}>
        {(list) => (
        <Card className="mt-4">
          {list.length === 0 ? <p className="text-sm text-card-text-muted">No inventory items in this scope. Create an item or import a CSV.</p> : list.map((item) => {
            const id = itemId(item)
            return (
            <div key={id} className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border py-3 last:border-0">
              <div className="min-w-[10rem] flex-1">
                <p className="text-sm font-medium text-card-text">{item.name}</p>
                <p className="text-xs text-card-text-muted">
                  par {item.parLevel} {item.unit}
                  {item.daysRemaining != null ? ` · ~${item.daysRemaining.toFixed(1)} days` : ''}
                  {item.stale ? ' · last count stale' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={item.stockStatus === 'critical' ? 'danger' : item.stockStatus === 'low' || item.stale ? 'warning' : 'success'} variant="outline">{item.stale ? 'stale' : item.stockStatus}</Pill>
                <Input
                  aria-label={`${item.name} quantity`}
                  className="w-28"
                  size="sm"
                  type="number"
                  min={0}
                  step="any"
                  value={drafts[id] ?? String(item.currentQuantity ?? 0)}
                  onChange={(e) => setDraft(id, e.target.value)}
                />
                <span className="text-xs text-card-text-muted">{item.unit}</span>
              </div>
            </div>
            )
          })}
        </Card>
        )}
      </QueryState>
      {creating ? (
        <CreateItemModal
          locationId={workingLocationId}
          locations={activeLocations}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload() }}
        />
      ) : null}
    </AppShell>
  )
}

function CreateItemModal({
  locationId,
  locations,
  onClose,
  onCreated,
}: {
  locationId: string
  locations: Array<{ id: string; name: string }>
  onClose: () => void
  onCreated: () => void
}) {
  const [loc, setLoc] = useState(locationId || locations[0]?.id || '')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('lb')
  const [quantity, setQuantity] = useState('0')
  const [parLevel, setParLevel] = useState('0')
  const [cost, setCost] = useState('0')
  const [usage, setUsage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true); setError('')
    try {
      if (!loc) throw new Error('Location is required')
      if (!name.trim()) throw new Error('Item name is required')
      await inventoryApi.create({
        locationId: loc,
        name: name.trim(),
        unit,
        currentQuantity: Number(quantity || 0),
        parLevel: Number(parLevel || 0),
        ingredientCost: Number(cost || 0),
        averageDailyUsage: usage.trim() === '' ? null : Number(usage),
      })
      onCreated()
    } catch (e) {
      setError(asyncMessage(e, 'Create failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Create inventory item" description="Adds a manual ingredient at one location. The opening quantity is recorded as the initial count." footer={
      <>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={busy} onClick={() => void save()}>Create item</Button>
      </>
    }>
      <div className="space-y-4">
        <Select label="Location" value={loc} onChange={setLoc} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
        <Input label="Item name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Unit" value={unit} onChange={setUnit} options={UNITS.map((u) => ({ value: u, label: u }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Opening quantity" type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input label="Par level" type="number" min={0} step="any" value={parLevel} onChange={(e) => setParLevel(e.target.value)} />
          <Input label="Ingredient cost" type="number" min={0} step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Input label="Avg daily usage (optional)" type="number" min={0} step="any" value={usage} onChange={(e) => setUsage(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-danger-subtle-text">{error}</p> : null}
      </div>
    </Modal>
  )
}
