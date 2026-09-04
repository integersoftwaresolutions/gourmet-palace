import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { AdminTabs } from '../../components/layout/SectionTabs'
import { Button, Card, Pill, Select } from '../../components/ui'
import { integrationsApi, type ConnectionRecord } from '../../lib/api'
import { useAppState } from '../../context/useAppState'

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

const channelKeys = ['dine_in', 'takeout', 'delivery', 'third_party', 'direct_online'] as const
type ChannelKey = typeof channelKeys[number]
const emptyChannels: Record<ChannelKey, string> = { dine_in: '', takeout: '', delivery: '', third_party: '', direct_online: '' }

function squareDrafts(connections: ConnectionRecord[]) {
  const square = connections.find((row) => row.provider === 'square')
  const mappings = (square?.mappings || {}) as Record<string, unknown>
  const raw = (mappings.channels || {}) as Record<string, unknown>
  const channels = { ...emptyChannels }
  for (const key of channelKeys) channels[key] = Array.isArray(raw[key]) ? (raw[key] as unknown[]).join(', ') : ''
  const aliases = (mappings.itemAliases || {}) as Record<string, string | Record<string, unknown>>
  return {
    channels,
    channelsApproved: mappings.channelsApproved === true,
    itemAliasesText: Object.entries(aliases).map(([source, alias]) => {
      const name = typeof alias === 'string' ? alias : String(alias.name || '')
      const category = typeof alias === 'string' ? '' : String(alias.category || '')
      return `${source} = ${name}${category ? ` | ${category}` : ''}`
    }).join('\n'),
    itemAliasesApproved: mappings.itemAliasesApproved === true,
  }
}

export function AdministrationIntegration() {
  const { locations } = useAppState()
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState<ConnectionRecord[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [toastLoc, setToastLoc] = useState('')
  const [channels, setChannels] = useState<Record<ChannelKey, string>>(emptyChannels)
  const [channelsApproved, setChannelsApproved] = useState(false)
  const [itemAliasesText, setItemAliasesText] = useState('')
  const [itemAliasesApproved, setItemAliasesApproved] = useState(false)
  const [backfillLoc, setBackfillLoc] = useState('')
  const [backfillFrom, setBackfillFrom] = useState('')
  const [backfillTo, setBackfillTo] = useState('')
  const [backfillBusy, setBackfillBusy] = useState(false)

  const applyConnections = (connections: ConnectionRecord[]) => {
    setRows(connections)
    const drafts = squareDrafts(connections)
    setChannels(drafts.channels)
    setChannelsApproved(drafts.channelsApproved)
    setItemAliasesText(drafts.itemAliasesText)
    setItemAliasesApproved(drafts.itemAliasesApproved)
  }

  const load = async () => {
    const r = await integrationsApi.list()
    applyConnections(r.data.connections)
  }

  useEffect(() => {
    let cancelled = false
    integrationsApi.list()
      .then((r) => {
        if (cancelled) return
        applyConnections(r.data.connections)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Unable to load connections')
      })
    return () => { cancelled = true }
  }, [])

  const oauthError = searchParams.get('error')
  const displayError = error || oauthError

  const by = useMemo(() => Object.fromEntries(rows.map((x) => [x.provider, x])) as Record<string, ConnectionRecord>, [rows])

  const connect = async () => {
    try {
      setError('')
      const r = await integrationsApi.connect('square')
      window.location.assign(r.data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start OAuth')
    }
  }
  const discover = async () => {
    try {
      setError('')
      await integrationsApi.discover('square')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed')
    }
  }
  const saveSquare = async (locationId: string, squareLocationId: string) => {
    try {
      const current = (by.square?.mappings || {}) as Record<string, unknown>
      const locs = { ...((current.locations || {}) as Record<string, unknown>), [locationId]: { squareLocationId } }
      await integrationsApi.setMappings('square', { ...current, locations: locs })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Square mapping failed')
    }
  }
  const saveChannels = async () => {
    try {
      const current = (by.square?.mappings || {}) as Record<string, unknown>
      const parsed = Object.fromEntries(channelKeys.map((k) => [k, channels[k].split(',').map((x) => x.trim()).filter(Boolean)]))
      await integrationsApi.setMappings('square', { ...current, channels: parsed, channelsApproved })
      setNotice(channelsApproved
        ? 'Square channel mapping saved and explicitly approved. Direct-order metrics may now publish after validation.'
        : 'Square channel mapping saved as unapproved. Direct-order metrics remain unavailable.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Channel mapping failed')
    }
  }
  const saveItemAliases = async () => {
    try {
      const aliases: Record<string, { name: string; category?: string }> = {}
      for (const rawLine of itemAliasesText.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue
        const [source, ...rest] = line.split('=')
        if (!source?.trim() || !rest.length) throw new Error(`Invalid alias line: ${line}`)
        const [name, category] = rest.join('=').split('|').map((x) => x.trim())
        if (!name) throw new Error(`Canonical name is required: ${line}`)
        aliases[source.trim()] = { name, ...(category ? { category } : {}) }
      }
      const current = (by.square?.mappings || {}) as Record<string, unknown>
      await integrationsApi.setMappings('square', { ...current, itemAliases: aliases, itemAliasesApproved })
      setNotice(itemAliasesApproved
        ? 'Cross-POS item aliases saved and approved for future Square/Toast normalization.'
        : 'Cross-POS item aliases saved as unapproved; provider item names remain unchanged.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Item alias mapping failed')
    }
  }
  const runBackfill = async () => {
    if (!backfillLoc || !backfillFrom || !backfillTo) return
    setBackfillBusy(true)
    setError('')
    setNotice('Running bounded Square historical backfill…')
    try {
      const r = await integrationsApi.squareBackfill(backfillLoc, backfillFrom, backfillTo)
      setNotice(`Square backfill finished: ${r.data.complete} complete, ${r.data.partial} partial, ${r.data.failed} failed across ${r.data.days} day(s). Re-running the same range safely resumes incomplete days.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Square backfill failed')
    } finally {
      setBackfillBusy(false)
    }
  }
  const toast = async (file: File | null) => {
    if (!file || !toastLoc) return
    setNotice('Importing historical Toast export…')
    try {
      const base64 = await toBase64(file)
      const r = await integrationsApi.toastImport({
        locationId: toastLoc,
        fileName: file.name,
        base64,
        mapping: { orderId: 'orderId', businessDate: 'businessDate', netSales: 'netSales', grossSales: 'grossSales', discounts: 'discounts', refunds: 'refunds', channel: 'channel' },
      })
      setNotice(`Toast history imported: ${String(r.data.imported || 0)} rows. Original archive retained privately.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toast import failed')
    }
  }

  const square = by.square
  const sqMeta = (square?.metadata || {}) as Record<string, unknown>
  const sqLocations = Array.isArray(sqMeta.providerLocations) ? sqMeta.providerLocations as Array<Record<string, unknown>> : []

  return (
    <AppShell title="Integrations" subtitle="Square live POS, Toast historical-only import, and canonical mappings" activeNav="admin">
      <AdminTabs value="integrations" />
      <div className="mt-5 space-y-5">
        {displayError && <Card accentBorder="brand"><p className="text-danger-subtle-text">{displayError}</p></Card>}
        {notice && <Card accentBorder="accent"><p className="text-sm text-card-text-muted">{notice}</p></Card>}
        <Card
          title="Square · live V1 POS"
          action={<Pill tone={square?.status === 'READY' ? 'success' : square?.status === 'PARTIAL' ? 'warning' : square?.status === 'ERROR' ? 'danger' : 'neutral'} variant="outline">{square?.status || 'UNAVAILABLE'}</Pill>}
        >
          <p className="text-sm text-card-text-muted">Live order/sales provider. OAuth, explicit restaurant mapping and approved channel mapping are required.</p>
          {square?.lastError && <p className="mt-2 text-xs text-danger-subtle-text">{square.lastError}</p>}
          <div className="mt-4 flex gap-2">
            {!square ? <Button size="sm" onClick={() => void connect()}>Connect with OAuth</Button> : (
              <>
                <Button size="sm" variant="outline" onClick={() => void discover()}>Refresh resources</Button>
                <Button size="sm" variant="outline" onClick={() => void connect()}>Reconnect</Button>
              </>
            )}
          </div>
        </Card>

        <Card title="Canonical location mappings">
          <div className="space-y-5">
            {locations.filter((l) => l.status === 'active').map((l) => {
              const sm = (((by.square?.mappings || {}) as Record<string, unknown>).locations || {}) as Record<string, Record<string, string>>
              return (
                <div key={l.id} className="rounded-lg border border-card-border p-4">
                  <h3 className="font-semibold text-card-text">{l.name}</h3>
                  <div className="mt-3 max-w-md">
                    <p className="mb-1 text-xs text-card-text-muted">Square restaurant</p>
                    <Select value={sm[l.id]?.squareLocationId || ''} onChange={(v) => void saveSquare(l.id, v)} placeholder="Map Square location" options={sqLocations.map((x) => ({ value: String(x.id), label: String(x.name || x.id) }))} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card title="Square historical backfill · bounded and resumable">
          <p className="text-sm text-card-text-muted">Import a client-approved historical window one business day at a time through the same canonical/reconciliation path as live sync. Complete dates are skipped on rerun; Partial/Failed dates can safely resume without duplicate provider orders.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[16rem_1fr_1fr_auto]">
            <div>
              <p className="mb-1 text-xs text-card-text-muted">Location</p>
              <Select value={backfillLoc} onChange={setBackfillLoc} placeholder="Select location" options={locations.filter((l) => l.status === 'active').map((l) => ({ value: l.id, label: l.name }))} />
            </div>
            <label className="text-xs text-card-text-muted">From<input type="date" value={backfillFrom} onChange={(e) => setBackfillFrom(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-card-text" /></label>
            <label className="text-xs text-card-text-muted">To<input type="date" value={backfillTo} onChange={(e) => setBackfillTo(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-card-text" /></label>
            <div className="flex items-end"><Button disabled={backfillBusy || !backfillLoc || !backfillFrom || !backfillTo} onClick={() => void runBackfill()}>{backfillBusy ? 'Backfilling…' : 'Run backfill'}</Button></div>
          </div>
          <p className="mt-2 text-xs text-card-text-faint">Maximum 370 business dates per request. Live acceptance still requires reconciliation against the client-owned Square account.</p>
        </Card>

        <Card title="Square channel mapping · requires explicit approval">
          <p className="text-sm text-card-text-muted">Enter provider source/fulfillment labels or fragments separated by commas. Unmatched traffic remains <strong>Unknown</strong>. Direct-online volume/revenue is withheld until this mapping is explicitly approved and validated against representative Square data.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {channelKeys.map((k) => (
              <label key={k} className="text-xs text-card-text-muted">
                <span className="mb-1 block">{k.replaceAll('_', ' ')}</span>
                <input value={channels[k]} onChange={(e) => setChannels({ ...channels, [k]: e.target.value })} placeholder="e.g. Online Store, Direct" className="h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm text-card-text outline-none focus:border-brand" />
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-card-text">
            <input type="checkbox" checked={channelsApproved} onChange={(e) => setChannelsApproved(e.target.checked)} className="mt-1" />
            <span><strong>I approve this final Square channel mapping for go-live.</strong><span className="block text-xs text-card-text-muted">Only check this after representative data confirms dine-in, takeout, delivery, third-party and direct-online classification.</span></span>
          </label>
          <div className="mt-4"><Button onClick={() => void saveChannels()}>Save channel mapping</Button></div>
        </Card>

        <Card title="Cross-POS canonical item aliases · requires approval">
          <p className="text-sm text-card-text-muted">Map a Square catalog ID/name or Toast item ID/name to one canonical reporting name. One mapping is used by both live Square ingestion and historical Toast import only after explicit approval. Provider IDs remain preserved for provenance.</p>
          <textarea value={itemAliasesText} onChange={(e) => setItemAliasesText(e.target.value)} rows={7} placeholder={'source item id or name = Canonical item name | Optional category\nABC123 = Chicken Breast | Meat'} className="mt-4 w-full rounded-lg border border-card-border bg-card p-3 font-mono text-xs text-card-text outline-none focus:border-brand" />
          <label className="mt-3 flex items-start gap-2 text-sm text-card-text">
            <input type="checkbox" checked={itemAliasesApproved} onChange={(e) => setItemAliasesApproved(e.target.checked)} className="mt-1" />
            <span><strong>I approve these aliases for canonical cross-POS reporting.</strong><span className="block text-xs text-card-text-muted">Uncertain matches should stay unmapped. Reprocessing remains traceable to the original provider facts.</span></span>
          </label>
          <div className="mt-4"><Button onClick={() => void saveItemAliases()}>Save item aliases</Button></div>
        </Card>

        <Card title="Toast historical export · one-time only">
          <p className="text-sm text-card-text-muted">Toast is not a live V1 connector. Upload the client export once; the original file is retained unchanged in private storage and imported into provider-neutral canonical history.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-64">
              <p className="mb-1 text-xs text-card-text-muted">Canonical location</p>
              <Select value={toastLoc} onChange={setToastLoc} options={locations.filter((l) => l.status === 'active').map((l) => ({ value: l.id, label: l.name }))} />
            </div>
            <a
              href="/toast-historical-import-sample.csv"
              download="toast-historical-import-sample.csv"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-border px-4 text-sm font-semibold text-neutral-subtle-text hover:bg-card-hover"
            >
              Download sample CSV
            </a>
            <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-text">
              Upload Toast CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void toast(e.target.files?.[0] || null)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-card-text-faint">Required headers: orderId, businessDate, netSales. Optional: grossSales, discounts, refunds, channel, itemId, itemName, itemCategory, itemQuantity, itemNetSales. Money is in dollars. Repeat orderId for line items. The original file is retained unchanged before parsing.</p>
        </Card>
      </div>
    </AppShell>
  )
}
