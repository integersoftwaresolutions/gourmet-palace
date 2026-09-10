import { useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { AdminTabs } from '../../components/layout/SectionTabs'
import { QueryError, QueryState, DualPanelSkeleton } from '../../components/query'
import { Button, Card, Input, Pill, Select } from '../../components/ui'
import { settingsApi, systemApi } from '../../lib/api'
import { asyncMessage } from '../../lib/asyncError'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { businessDate, generalDate, syncedTime } from '../../lib/format'
import { useAppState } from '../../context/useAppState'

export function AdministrationSystemAndThresholds() {
  const { locations } = useAppState()
  const [scope, setScope] = useState('org')
  const { data, error, isLoading, isRefreshing, reload } = useAsyncResource(
    async () => {
      const [s, h] = await Promise.all([settingsApi.list(), systemApi.health()])
      return { settings: s.data, health: h.data }
    },
    [],
    { fallbackError: 'Unable to load system configuration' },
  )
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [edits, setEdits] = useState<{
    scope: string
    margin: string
    weights: { sales: string; demand: string; exceptions: string; operating: string }
  } | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10))

  const settings = data?.settings ?? null
  const health = data?.health ?? null

  const latest = (key: string) => {
    if (!settings) return undefined
    const loc = scope === 'org' ? null : scope
    const row = settings.history.find((r) => r.key === key && String(r.locationId || '') === String(loc || ''))
    return row?.value ?? settings.defaults[key]
  }
  const margin = Number(latest('selectedMargin') ?? 0.15)
  const weights = (latest('scoreWeights') || { sales: 0.4, demand: 0.25, exceptions: 0.2, operating: 0.15 }) as Record<string, number>
  const derivedMargin = String(margin * 100)
  const derivedWeights = {
    sales: String((weights.sales || 0) * 100),
    demand: String((weights.demand || 0) * 100),
    exceptions: String((weights.exceptions || 0) * 100),
    operating: String((weights.operating || 0) * 100),
  }
  const draftMargin = edits?.scope === scope ? edits.margin : derivedMargin
  const draftWeights = edits?.scope === scope ? edits.weights : derivedWeights

  const save = async () => {
    setActionError('')
    const w = Object.fromEntries(Object.entries(draftWeights).map(([k, v]) => [k, Number(v) / 100]))
    const total = Object.values(w).reduce((a, b) => a + b, 0)
    if (Math.abs(total - 1) > 0.001) {
      setActionError('Score weights must total 100%.')
      return
    }
    try {
      const locationId = scope === 'org' ? null : scope
      await Promise.all([
        settingsApi.set({ locationId, key: 'selectedMargin', value: Number(draftMargin) / 100, effectiveFrom: `${effectiveFrom}T00:00:00.000Z` }),
        settingsApi.set({ locationId, key: 'scoreWeights', value: w, effectiveFrom: `${effectiveFrom}T00:00:00.000Z` }),
      ])
      setNotice('New effective-dated settings saved. Historical snapshots are unchanged.')
      setEdits(null)
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Save failed'))
    }
  }

  const connections = health?.connections || []
  const jobs = health?.jobs || []
  const recon = health?.reconciliation || []
  const rerun = async (row: Record<string, unknown>, source = 'calculate') => {
    if (!row.locationId || !row.businessDate) return
    try {
      await systemApi.rerun({ source, locationId: String(row.locationId), businessDate: String(row.businessDate) })
      setNotice(`${source === 'calculate' ? 'Recalculation' : `${source} acquisition`} completed.`)
      reload()
    } catch (e) {
      setActionError(asyncMessage(e, 'Rerun failed'))
    }
  }

  return (
    <AppShell
      title="System & thresholds"
      subtitle="Versioned business controls, source health, reconciliation and recovery"
      activeNav="admin"
      actions={<Button size="sm" variant="outline" onClick={() => window.location.assign(systemApi.exportUrl)}>Export client data</Button>}
    >
      <AdminTabs value="system" />
      {actionError && <QueryError message={actionError} className="mt-4" />}
      {notice && <Card accentBorder="accent" className="mt-4"><p className="text-sm text-card-text-muted">{notice}</p></Card>}
      <QueryState data={data} error={error} isLoading={isLoading} isRefreshing={isRefreshing} onRetry={reload} loader={<DualPanelSkeleton />}>
        {() => (
      <div className="space-y-5">
        <Card title="Effective-dated business controls">
          <div className="mb-4 max-w-xs">
            <p className="mb-1 text-xs text-card-text-muted">Configuration scope</p>
            <Select value={scope} onChange={setScope} options={[{ value: 'org', label: 'Organization default' }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
          </div>
          <div className="mb-4 max-w-xs">
            <Input label="Effective from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} hint="New calculations on/after this date use this version. Older snapshots are not rewritten." />
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <Input label="Selected margin %" type="number" value={draftMargin} onChange={(e) => setEdits({ scope, margin: e.target.value, weights: draftWeights })} />
            <div />
            <Input label="Score · sales %" type="number" value={draftWeights.sales} onChange={(e) => setEdits({ scope, margin: draftMargin, weights: { ...draftWeights, sales: e.target.value } })} />
            <Input label="Score · demand %" type="number" value={draftWeights.demand} onChange={(e) => setEdits({ scope, margin: draftMargin, weights: { ...draftWeights, demand: e.target.value } })} />
            <Input label="Score · exceptions %" type="number" value={draftWeights.exceptions} onChange={(e) => setEdits({ scope, margin: draftMargin, weights: { ...draftWeights, exceptions: e.target.value } })} />
            <Input label="Score · operating %" type="number" value={draftWeights.operating} onChange={(e) => setEdits({ scope, margin: draftMargin, weights: { ...draftWeights, operating: e.target.value } })} />
          </div>
          <Button className="mt-5" onClick={() => void save()}>Save new effective version</Button>
        </Card>
        <Card title="Configuration version history">
          <div className="max-h-80 max-w-full overflow-auto overscroll-x-contain">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-card-border text-xs uppercase text-card-text-faint">
                  <th className="py-2">Effective</th>
                  <th className="py-2">Scope</th>
                  <th className="py-2">Setting</th>
                  <th className="py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {(settings?.history || []).slice(0, 100).map((row, i) => (
                  <tr key={String(row._id || i)} className="border-b border-card-border last:border-0">
                    <td className="py-2 text-card-text-muted">{generalDate(String(row.effectiveFrom || '').slice(0, 10))}</td>
                    <td className="py-2 text-card-text-muted">{row.locationId ? locations.find((l) => l.id === String(row.locationId))?.name || String(row.locationId) : 'Organization default'}</td>
                    <td className="py-2 font-medium text-card-text">{String(row.key || '')}</td>
                    <td className="max-w-xl py-2 font-mono text-xs text-card-text-muted">{JSON.stringify(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(settings?.history || []).length && <p className="py-3 text-sm text-card-text-muted">No configuration versions have been saved yet. Specification defaults are currently effective.</p>}
          </div>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Connector health">
            <div className="space-y-2">
              {connections.length === 0 ? <p className="text-sm text-card-text-muted">No external connector is configured.</p> : connections.map((c) => (
                <div key={c._id} className="flex flex-wrap items-start justify-between gap-2 border-b border-card-border py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-card-text capitalize">{c.provider}</p>
                    <p className="text-xs text-card-text-muted">{syncedTime(c.lastSuccessAt)}</p>
                    {c.lastError ? <p className="mt-1 text-xs text-danger-subtle-text">{c.lastError}</p> : null}
                  </div>
                  <Pill tone={c.status === 'READY' ? 'success' : c.status === 'PARTIAL' ? 'warning' : 'danger'} variant="outline">{c.status}</Pill>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Recent jobs">
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {jobs.slice(0, 30).map((j, i) => (
                <div key={String(j._id || i)} className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-card-text">{String(j.jobType || 'job')} · {String(j.source || '')}</p>
                    <p className="text-xs text-card-text-muted">{businessDate(j.businessDate)} · attempts {String(j.attempts || 0)}</p>
                    {j.error ? <p className="mt-1 truncate text-xs text-danger-subtle-text" title={String(j.error)}>{String(j.error)}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={j.status === 'COMPLETE' ? 'success' : j.status === 'FAILED' ? 'danger' : 'warning'} variant="outline" size="sm">{String(j.status)}</Pill>
                    {String(j.source) === 'square' && j.locationId && j.businessDate ? <Button size="sm" variant="outline" onClick={() => void rerun(j, String(j.source))}>Retry</Button> : null}
                    {String(j.source) === 'google' && j.locationId && j.businessDate ? <Button size="sm" variant="outline" onClick={() => void rerun(j, 'google')}>Retry</Button> : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card title="Reconciliation / data-quality exceptions">
          <div className="space-y-2">
            {recon.length === 0 ? <p className="text-sm text-card-text-muted">No current reconciliation exception is recorded.</p> : recon.map((r, i) => (
              <div key={String(r._id || i)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-card-border p-3">
                <div>
                  <p className="text-sm font-medium text-card-text">{businessDate(r.businessDate)} · {String(r.dataStatus)}</p>
                  <pre className="mt-1 max-w-3xl overflow-auto text-[11px] text-card-text-faint">{JSON.stringify(r.reconciliation || {}, null, 2)}</pre>
                </div>
                <Button size="sm" variant="outline" onClick={() => void rerun(r)}>Recalculate</Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
        )}
      </QueryState>
    </AppShell>
  )
}
